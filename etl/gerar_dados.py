# -*- coding: utf-8 -*-
"""
ETL do Painel RPD (Rendas Petroliferas em Dados) - acao 19.1 do Planeja+.
BLOCO 1: trabalha com TODAS as funcoes (sem agrupar em areas),
metrica principal = PAGO, previsto corrigido para a aba Planejado.

Saidas:
  saida/dados.json                -> consumido pelo painel React
  saida/classificacao_fontes.csv  -> para validacao por especialista

Rodar (dentro da pasta etl/):
    python gerar_dados.py
"""

import json
import unicodedata
import re
from pathlib import Path
import pandas as pd

BASE = Path(__file__).parent
CONFIG = BASE / "config"
BRUTOS = BASE / "dados_brutos"
SAIDA = BASE / "saida"
SAIDA.mkdir(exist_ok=True)

PLANILHA = BRUTOS / "rendas_petroliferas.xlsx"
ABA = "Dados por Ação"
ANO_MIN, ANO_MAX = 2022, 2025


def normaliza(texto):
    if pd.isna(texto):
        return ""
    s = str(texto).strip().upper()
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s)
    return s


def para_numero(valor):
    """Converte valor monetario para float. PRESERVA CENTAVOS."""
    if pd.isna(valor):
        return 0.0
    if isinstance(valor, (int, float)):
        return float(valor)
    s = str(valor).strip()
    s = s.replace("R$", "").replace("\n", "").replace("\t", "").replace(" ", "")
    if s == "" or normaliza(s) in ("NAOENCONTRADO", "NAO ENCONTRADO"):
        return 0.0
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def txt(valor):
    if pd.isna(valor):
        return ""
    s = str(valor).strip()
    return "" if s.lower() == "nan" else s


def carrega_config(nome):
    with open(CONFIG / nome, encoding="utf-8") as f:
        return json.load(f)


# 1. LEITURA
print("1. Lendo planilha...")
df = pd.read_excel(PLANILHA, sheet_name=ABA, header=0)
df.columns = [str(c).strip() for c in df.columns]
print(f"   {len(df)} linhas brutas.")
df = df[df["Ano"].between(ANO_MIN, ANO_MAX)].copy()
print(f"   {len(df)} linhas apos filtrar {ANO_MIN}-{ANO_MAX}.")

# 2. VALORES (preservando centavos)
print("2. Convertendo valores (com centavos)...")
for origem, destino in {"Valor previsto": "previsto", "Despesa empenhada": "empenhado",
                        "Despesa liquidada": "liquidado", "Despesa paga": "pago"}.items():
    df[destino] = df[origem].apply(para_numero)

# 3. MUNICIPIO
print("3. Canonicalizando municipios...")
cfg_mun = carrega_config("municipios.json")
mapa_mun = {m["canonico"]: m for m in cfg_mun["municipios"]}
df["mun_canonico"] = df["Município"].apply(normaliza)
nao_rec = sorted(set(df["mun_canonico"]) - set(mapa_mun.keys()))
if nao_rec:
    print(f"   AVISO: municipios fora da lista: {nao_rec}")
df["municipio"] = df["mun_canonico"].apply(lambda c: mapa_mun.get(c, {}).get("nome", c))
df["uf"] = df["mun_canonico"].apply(lambda c: mapa_mun.get(c, {}).get("uf", ""))
df["regiao"] = df["mun_canonico"].apply(lambda c: mapa_mun.get(c, {}).get("regiao", ""))

# 4. FUNCAO CANONICA (sem agrupar em areas)
print("4. Canonicalizando funcoes (todas, sem agrupar)...")
cfg_fun = carrega_config("mapa_funcao_canonica.json")
mapa_fun = cfg_fun["mapa"]
fun_vazia = cfg_fun["funcao_vazia"]
df["funcao_norm"] = df["Função"].apply(normaliza)
df["funcao"] = df["funcao_norm"].apply(
    lambda f: mapa_fun.get(f, fun_vazia if f == "" else f.title()))
df["funcao_codigo"] = df["Código Função"].apply(txt)

# 5. FONTE (petroleo / outros / nao_informado)
print("5. Classificando fonte de recurso...")
cfg_fonte = carrega_config("regras_fonte.json")
termos = cfg_fonte["petroleo_termos"]
truncados = cfg_fonte["petroleo_truncados"]

def classifica_fonte(t):
    if t == "":
        return "nao_informado"
    for x in termos:
        if x in t:
            return "petroleo"
    for x in truncados:
        if x in t:
            return "petroleo"
    return "outros"

df["fonte_norm"] = df["Fonte de recursos"].apply(normaliza)
df["fonte_classe"] = df["fonte_norm"].apply(classifica_fonte)
df["fonte_original"] = df["Fonte de recursos"].apply(txt)

# 6. REGISTROS (as 5 dimensoes: funcao, subfuncao[vazia], programa, acao, fonte)
print("6. Montando registros...")
registros = []
for _, r in df.iterrows():
    registros.append({
        "municipio": r["municipio"], "uf": r["uf"], "regiao": r["regiao"],
        "ano": int(r["Ano"]),
        "mes": int(r["Número do mês"]) if not pd.isna(r["Número do mês"]) else None,
        "funcao": r["funcao"],
        "funcao_codigo": r["funcao_codigo"],
        "subfuncao": "",                      # nao existe na planilha, reservado
        "programa": txt(r.get("Programa", "")),
        "acao": txt(r["Ação orçamentária"]),
        "fonte_classe": r["fonte_classe"],
        "fonte_original": r["fonte_original"],
        "natureza": txt(r["Natureza da despesa"]),
        "historico": txt(r.get("Histórico (O que de fato foi feito?)", "")),
        "empenhado": round(r["empenhado"], 2),
        "liquidado": round(r["liquidado"], 2),
        "pago": round(r["pago"], 2),
        "previsto": round(r["previsto"], 2),
    })

# 7. AGREGACOES (metrica principal = PAGO)
print("7. Agregando (metrica = pago)...")
pet = df[df["fonte_classe"] == "petroleo"]

def soma(g, col="pago"):
    return round(float(g[col].sum()), 2)

# por funcao (todas, so petroleo, por pago)
por_funcao = sorted(
    [{"funcao": f, "pago": soma(g)} for f, g in pet.groupby("funcao")],
    key=lambda x: x["pago"], reverse=True)

# por ano (pago)
por_ano = [{"ano": int(a), "pago": soma(g)} for a, g in pet.groupby("Ano")]

# por municipio x funcao (para drill / lista de municipios por funcao)
mf = {}
for (mun, fun), g in pet.groupby(["municipio", "funcao"]):
    mf.setdefault(mun, {"municipio": mun, "funcoes": {}})
    mf[mun]["funcoes"][fun] = soma(g)
por_municipio_funcao = sorted(
    mf.values(), key=lambda x: sum(x["funcoes"].values()), reverse=True)

# ciclo (mantem os 3, por pago de referencia mas mostra todos)
ciclo = {"empenhado": soma(pet, "empenhado"), "liquidado": soma(pet, "liquidado"),
         "pago": soma(pet, "pago")}

# PLANEJADO corrigido: previsto 1x por ano por (municipio, funcao, acao)
# pega o valor do ULTIMO mes de cada ano (orcamento atualizado), evitando somar meses
print("8. Calculando planejado corrigido (previsto 1x/ano)...")
planejado = []
prev = df[df["previsto"] > 0].copy()
if len(prev):
    # para cada municipio/ano/funcao/acao, pega a linha do maior mes
    prev["mesnum"] = prev["Número do mês"].fillna(0).astype(int)
    idx = prev.groupby(["municipio", "Ano", "funcao", "Ação orçamentária"])["mesnum"].idxmax()
    prev1 = prev.loc[idx]
    for (mun, ano, fun), g in prev1.groupby(["municipio", "Ano", "funcao"]):
        planejado.append({"municipio": mun, "ano": int(ano), "funcao": fun,
                          "previsto": round(float(g["previsto"].sum()), 2)})

# 9. KPIs
total_pet = soma(pet, "pago")
total_geral = soma(df, "pago")
kpis = {
    "total_petroleo_pago": total_pet,
    "total_geral_pago": total_geral,
    "municipios_cobertos": df["municipio"].nunique(),
    "municipios_totais": len(cfg_mun["municipios"]),
    "ano_inicio": ANO_MIN, "ano_fim": ANO_MAX,
    "funcoes_distintas": len(por_funcao),
}

# 10. ESCRITA
print("9. Escrevendo dados.json...")
import math
def limpa_nan(o):
    if isinstance(o, float):
        return 0 if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: limpa_nan(v) for k, v in o.items()}
    if isinstance(o, list):
        return [limpa_nan(v) for v in o]
    return o

saida = {
    "meta": {"gerado_em": pd.Timestamp.now().strftime("%Y-%m-%d"),
             "fonte": "Monitoramento do orcamento publico municipal (coleta anterior)",
             "metrica_principal": "pago"},
    "kpis": kpis,
    "municipios": cfg_mun["municipios"],
    "agregados": {"por_funcao": por_funcao, "por_ano": por_ano,
                  "por_municipio_funcao": por_municipio_funcao, "ciclo": ciclo,
                  "planejado": planejado},
    "registros": registros,
}
with open(SAIDA / "dados.json", "w", encoding="utf-8") as f:
    json.dump(limpa_nan(saida), f, ensure_ascii=False, indent=2, allow_nan=False)

# tabela de fontes
print("10. Escrevendo classificacao_fontes.csv...")
tab = (df.groupby(["fonte_original", "fonte_classe"])
       .agg(linhas=("pago", "size"), total_pago=("pago", "sum"))
       .reset_index().sort_values("total_pago", ascending=False))
tab["total_pago"] = tab["total_pago"].round(2)
tab.to_csv(SAIDA / "classificacao_fontes.csv", index=False, encoding="utf-8-sig")

print("\n" + "=" * 55)
print("ETL CONCLUIDA (Bloco 1)")
print("=" * 55)
print(f"Registros:              {len(registros)}")
print(f"Municipios com dado:    {kpis['municipios_cobertos']} de {kpis['municipios_totais']}")
print(f"Funcoes distintas:      {kpis['funcoes_distintas']}")
print(f"Renda petrolifera PAGA: R$ {total_pet:,.2f}")
print(f"Registros no planejado: {len(planejado)}")