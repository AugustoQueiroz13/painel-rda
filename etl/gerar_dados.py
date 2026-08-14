# -*- coding: utf-8 -*-
"""
ETL do Painel RPD (Rendas Petroliferas em Dados) - acao 19.1 do Planeja+.

O que este script faz:
  1. Le a planilha bruta de monitoramento do orcamento publico.
  2. Limpa e padroniza os dados (valores, municipios, funcoes, fontes).
  3. Classifica cada gasto em area de politica e em origem petroleo/outros.
  4. Calcula as agregacoes que o painel usa.
  5. Escreve dois arquivos:
       - saida/dados.json            -> consumido pelo painel React
       - saida/classificacao_fontes.csv -> para validacao por especialista

Como rodar (no terminal, dentro da pasta etl/):
    python gerar_dados.py

Requisitos: pandas, openpyxl  (ver requirements.txt)
"""

import json
import unicodedata
import re
from pathlib import Path
import pandas as pd

# ----------------------------------------------------------------------
# CAMINHOS  (relativos a esta pasta etl/)
# ----------------------------------------------------------------------
BASE = Path(__file__).parent
CONFIG = BASE / "config"
BRUTOS = BASE / "dados_brutos"
SAIDA = BASE / "saida"
SAIDA.mkdir(exist_ok=True)

PLANILHA = BRUTOS / "rendas_petroliferas.xlsx"
ABA = "Dados por Ação"
ANO_MIN, ANO_MAX = 2022, 2025   # 2021 tem dados insuficientes

# ----------------------------------------------------------------------
# FUNCOES AUXILIARES
# ----------------------------------------------------------------------
def normaliza(texto):
    """Maiusculo, sem acento, sem espaco extra. Base de toda comparacao."""
    if pd.isna(texto):
        return ""
    s = str(texto).strip().upper()
    s = "".join(c for c in unicodedata.normalize("NFD", s)
                if unicodedata.category(c) != "Mn")
    s = re.sub(r"\s+", " ", s)
    return s


def para_numero(valor):
    """Converte valor monetario (que pode vir como texto) para float.
    Trata 'R$', pontos de milhar, virgula decimal, quebras de linha e lixo."""
    if pd.isna(valor):
        return 0.0
    if isinstance(valor, (int, float)):
        return float(valor)
    s = str(valor).strip()
    s = s.replace("R$", "").replace("\n", "").replace("\t", "").replace(" ", "")
    if s == "" or normaliza(s) in ("NAOENCONTRADO", "NAO ENCONTRADO"):
        return 0.0
    # formato brasileiro: 1.234.567,89
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def carrega_config(nome):
    with open(CONFIG / nome, encoding="utf-8") as f:
        return json.load(f)


def txt(valor):
    """Converte para texto seguro. Vazio ou NaN vira string vazia.
    Evita que 'NaN' apareca no JSON (que quebra o parse no navegador)."""
    if pd.isna(valor):
        return ""
    s = str(valor).strip()
    return "" if s.lower() == "nan" else s


# ----------------------------------------------------------------------
# 1. LEITURA
# ----------------------------------------------------------------------
print("1. Lendo planilha...")
df = pd.read_excel(PLANILHA, sheet_name=ABA, header=0)
df.columns = [str(c).strip() for c in df.columns]
print(f"   {len(df)} linhas brutas.")

df = df[df["Ano"].between(ANO_MIN, ANO_MAX)].copy()
print(f"   {len(df)} linhas apos filtrar {ANO_MIN}-{ANO_MAX}.")

# ----------------------------------------------------------------------
# 2. LIMPEZA DE VALORES
# ----------------------------------------------------------------------
print("2. Convertendo valores monetarios...")
COLS_VALOR = {
    "Valor previsto": "previsto",
    "Despesa empenhada": "empenhado",
    "Despesa liquidada": "liquidado",
    "Despesa paga": "pago",
}
for origem, destino in COLS_VALOR.items():
    df[destino] = df[origem].apply(para_numero)

# ----------------------------------------------------------------------
# 3. CANONICALIZACAO DE MUNICIPIO
# ----------------------------------------------------------------------
print("3. Canonicalizando municipios...")
cfg_mun = carrega_config("municipios.json")
mapa_mun = {m["canonico"]: m for m in cfg_mun["municipios"]}

df["mun_canonico"] = df["Município"].apply(normaliza)
nao_reconhecidos = sorted(set(df["mun_canonico"]) - set(mapa_mun.keys()))
if nao_reconhecidos:
    print(f"   AVISO: municipios fora da lista dos 26: {nao_reconhecidos}")

df["municipio"] = df["mun_canonico"].apply(
    lambda c: mapa_mun.get(c, {}).get("nome", c))
df["uf"] = df["mun_canonico"].apply(
    lambda c: mapa_mun.get(c, {}).get("uf", ""))
df["regiao"] = df["mun_canonico"].apply(
    lambda c: mapa_mun.get(c, {}).get("regiao", ""))

# ----------------------------------------------------------------------
# 4. CLASSIFICACAO DE AREA (pelo texto da funcao)
# ----------------------------------------------------------------------
print("4. Classificando area de politica...")
cfg_area = carrega_config("mapa_funcao_area.json")
mapa_area = cfg_area["mapa"]
area_default = cfg_area["area_default"]

df["funcao_norm"] = df["Função"].apply(normaliza)
df["area"] = df["funcao_norm"].apply(lambda f: mapa_area.get(f, area_default))
# preserva original + codigo para auditoria (municipios podem ter codigo proprio)
df["funcao_original"] = df["Função"].apply(txt)
df["funcao_codigo"] = df["Código Função"].apply(txt)

# ----------------------------------------------------------------------
# 5. CLASSIFICACAO DE FONTE (petroleo / outros / nao_informado)
# ----------------------------------------------------------------------
print("5. Classificando fonte de recurso...")
cfg_fonte = carrega_config("regras_fonte.json")
termos = cfg_fonte["petroleo_termos"]
truncados = cfg_fonte["petroleo_truncados"]

def classifica_fonte(texto_norm):
    if texto_norm == "":
        return "nao_informado"
    for t in termos:
        if t in texto_norm:
            return "petroleo"
    for t in truncados:
        if t in texto_norm:
            return "petroleo"
    return "outros"

df["fonte_norm"] = df["Fonte de recursos"].apply(normaliza)
df["fonte_classe"] = df["fonte_norm"].apply(classifica_fonte)
df["fonte_original"] = df["Fonte de recursos"].apply(txt)

# ----------------------------------------------------------------------
# 6. MONTAGEM DOS REGISTROS LIMPOS
# ----------------------------------------------------------------------
print("6. Montando registros limpos...")
registros = []
for _, r in df.iterrows():
    registros.append({
        "municipio": r["municipio"],
        "uf": r["uf"],
        "regiao": r["regiao"],
        "ano": int(r["Ano"]),
        "mes": int(r["Número do mês"]) if not pd.isna(r["Número do mês"]) else None,
        "area": r["area"],
        "funcao_original": r["funcao_original"],
        "funcao_codigo": r["funcao_codigo"],
        "fonte_classe": r["fonte_classe"],
        "fonte_original": r["fonte_original"],
        "acao": txt(r["Ação orçamentária"]),
        "natureza": txt(r["Natureza da despesa"]),
        "historico": txt(r.get("Histórico (O que de fato foi feito?)", "")),
        "empenhado": round(r["empenhado"], 2),
        "liquidado": round(r["liquidado"], 2),
        "pago": round(r["pago"], 2),
    })

# ----------------------------------------------------------------------
# 7. AGREGACOES (o painel le prontas, nao soma no navegador)
#    Nota: 'previsto' fica de fora dos agregados por estar inflado na
#    planilha (repeticao mensal). Sera tratado numa versao futura.
# ----------------------------------------------------------------------
print("7. Calculando agregacoes...")
pet = df[df["fonte_classe"] == "petroleo"]

def soma(grupo, col="liquidado"):
    return round(float(grupo[col].sum()), 2)

# por area (so petroleo)
por_area = [
    {"area": a, "liquidado": soma(g)}
    for a, g in pet.groupby("area")
]

# por ano (so petroleo)
por_ano = [
    {"ano": int(a), "liquidado": soma(g)}
    for a, g in pet.groupby("Ano")
]

# por municipio x area (so petroleo) -> para grafico empilhado
por_mun_area = {}
for (mun, area), g in pet.groupby(["municipio", "area"]):
    por_mun_area.setdefault(mun, {"municipio": mun, "territorio": 0,
                                  "educacao": 0, "saude": 0, "outras": 0})
    por_mun_area[mun][area] = soma(g)
por_mun_area = sorted(por_mun_area.values(),
                      key=lambda x: x["territorio"] + x["educacao"] + x["saude"] + x["outras"],
                      reverse=True)

# ciclo do gasto (so petroleo)
ciclo = {
    "empenhado": soma(pet, "empenhado"),
    "liquidado": soma(pet, "liquidado"),
    "pago": soma(pet, "pago"),
}

# territorio por dentro (subfuncoes)
terr = pet[pet["area"] == "territorio"]
territorio_detalhe = [
    {"funcao": a.title(), "liquidado": soma(g)}
    for a, g in terr.groupby("funcao_norm")
    if soma(g) > 0
]
territorio_detalhe.sort(key=lambda x: x["liquidado"], reverse=True)

# ----------------------------------------------------------------------
# 8. KPIs
# ----------------------------------------------------------------------
total_pet = soma(pet, "liquidado")
total_geral = soma(df, "liquidado")
muns_com_dado = df["municipio"].nunique()

kpis = {
    "total_petroleo_liquidado": total_pet,
    "total_geral_liquidado": total_geral,
    "pct_petroleo": round(100 * total_pet / total_geral, 1) if total_geral else 0,
    "municipios_cobertos": muns_com_dado,
    "municipios_totais": len(cfg_mun["municipios"]),
    "ano_inicio": ANO_MIN,
    "ano_fim": ANO_MAX,
}

# ----------------------------------------------------------------------
# 9. ESCRITA DO dados.json
# ----------------------------------------------------------------------
print("8. Escrevendo dados.json...")

def limpa_nan(obj):
    """Percorre a estrutura e troca qualquer NaN/inf remanescente por 0 ou ''.
    Garantia extra para o JSON nunca sair invalido para o navegador."""
    import math
    if isinstance(obj, float):
        return 0 if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, dict):
        return {k: limpa_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [limpa_nan(v) for v in obj]
    return obj

saida = {
    "meta": {
        "gerado_em": pd.Timestamp.now().strftime("%Y-%m-%d"),
        "fonte": "Planilha de monitoramento do orcamento publico (coleta anterior)",
        "observacao": "Valores de despesa liquidada. Previsto omitido nesta versao.",
    },
    "kpis": kpis,
    "municipios": cfg_mun["municipios"],
    "agregados": {
        "por_area": por_area,
        "por_ano": por_ano,
        "por_municipio_area": por_mun_area,
        "ciclo": ciclo,
        "territorio_detalhe": territorio_detalhe,
    },
    "registros": registros,
}

with open(SAIDA / "dados.json", "w", encoding="utf-8") as f:
    json.dump(limpa_nan(saida), f, ensure_ascii=False, indent=2, allow_nan=False)

# ----------------------------------------------------------------------
# 10. ESCRITA DA TABELA DE CLASSIFICACAO (para validacao humana)
# ----------------------------------------------------------------------
print("9. Escrevendo classificacao_fontes.csv...")
tabela = (df.groupby(["fonte_original", "fonte_classe"])
          .agg(linhas=("liquidado", "size"),
               total_liquidado=("liquidado", "sum"))
          .reset_index()
          .sort_values("total_liquidado", ascending=False))
tabela["total_liquidado"] = tabela["total_liquidado"].round(2)
tabela.to_csv(SAIDA / "classificacao_fontes.csv", index=False, encoding="utf-8-sig")

# ----------------------------------------------------------------------
# RESUMO
# ----------------------------------------------------------------------
print("\n" + "=" * 55)
print("ETL CONCLUIDA")
print("=" * 55)
print(f"Registros processados:      {len(registros)}")
print(f"Municipios com dado:        {muns_com_dado} de {kpis['municipios_totais']}")
print(f"Renda petrolifera liquidada: R$ {total_pet:,.2f}")
print(f"% do gasto que e petroleo:   {kpis['pct_petroleo']}%")
print(f"Fontes distintas na tabela:  {tabela['fonte_original'].nunique()}")
print(f"\nArquivos gerados em: {SAIDA}")
print("  - dados.json")
print("  - classificacao_fontes.csv  (validar com especialista)")