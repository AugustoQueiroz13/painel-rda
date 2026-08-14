# ETL do Painel RPD

Este guia mostra como gerar o arquivo de dados do painel a partir da
planilha. Sistema Windows com VS Code.

---

## O que esta ETL faz

Lê a planilha de monitoramento do orçamento público, limpa e classifica os dados,
e gera dois arquivos na pasta `saida/`:

- **dados.json**: alimenta o painel.
- **classificacao_fontes.csv**: lista das fontes de recurso com a classificação
  petróleo/outros, para a especialista em orçamento validar antes de publicar.

---

## Estrutura das pastas

```
etl/
├── config/
│   ├── municipios.json         # os 26 municípios, com região
│   ├── mapa_funcao_area.json   # função -> saúde/educação/território/outras
│   └── regras_fonte.json       # regra de classificação petróleo
├── dados_brutos/
│   └── (a planilha .xlsx fica aqui)
├── saida/
│   ├── dados.json              # gerado pela ETL
│   └── classificacao_fontes.csv# gerado pela ETL
├── gerar_dados.py              # o script principal
├── requirements.txt            # bibliotecas necessárias
└── LEIA-ME.md                  # este arquivo
```

---

## Passo 1 - Verificar se você tem Python

Abra o **Prompt de Comando** (ou o terminal do VS Code em `Terminal > Novo Terminal`)
e digite:

```
python --version
```

Se aparecer algo como `Python 3.11.x`, você tem Python. Pode pular para o Passo 3.

Se der erro, siga o Passo 2.

---

## Passo 2 - Instalar o Python (só se não tiver)

1. Acesse https://www.python.org/downloads/
2. Baixe a versão mais recente para Windows.
3. **Importante**: na primeira tela do instalador, marque a caixa
   **"Add Python to PATH"** antes de clicar em Instalar.
4. Conclua a instalação e feche/reabra o VS Code.

---

## Passo 3 - Abrir a pasta no VS Code

1. Abra o VS Code.
2. `Arquivo > Abrir Pasta` e selecione a pasta `etl`.
3. Abra o terminal integrado: `Terminal > Novo Terminal`.
   Ele já vai estar na pasta certa.

---

## Passo 4 - Instalar as bibliotecas

No terminal do VS Code, digite:

```
pip install -r requirements.txt
```

Isso instala o pandas e o openpyxl, que o script usa para ler Excel.
Você só precisa fazer isso uma vez.

---

## Passo 5 - Colocar a planilha no lugar

Copie a planilha para a pasta `dados_brutos/`. O nome do arquivo precisa ser
exatamente:

```
rendas_petroliferas.xlsx
```

Se o nome for diferente, ou renomeie a planilha, ou abra o `gerar_dados.py` e
ajuste a linha que começa com `PLANILHA =`.

---

## Passo 6 - Rodar a ETL

No terminal, digite:

```
python gerar_dados.py
```

Você verá o progresso passo a passo e, ao final, um resumo com os números.
Os dois arquivos aparecem na pasta `saida/`.

---

## Passo 7 - Conferir a classificação (importante)

Antes de publicar qualquer coisa, abra o arquivo
`saida/classificacao_fontes.csv` (pode abrir no Excel).

Ele lista cada fonte de recurso e como foi classificada. Passe para a
especialista em orçamento público validar, principalmente as linhas marcadas
como `petroleo`. Se alguma estiver errada, o ajuste é feito no arquivo
`config/regras_fonte.json`, e depois é só rodar a ETL de novo.

---

## Quando a planilha for atualizada

O fluxo para atualizar os dados do painel é simples:

1. Substitua o arquivo em `dados_brutos/` pela planilha nova.
2. Rode `python gerar_dados.py` de novo.
3. O `dados.json` é regerado com os dados novos.

Nenhuma edição manual de planilha é necessária em momento nenhum. A planilha
original nunca é alterada pela ETL.

---

## Se algo der errado

- **"python não é reconhecido"**: o Python não está no PATH. Refaça o Passo 2
  marcando a caixa "Add Python to PATH".
- **"No such file or directory" na planilha**: confira o nome do arquivo em
  `dados_brutos/` (Passo 5).
- **Erro de acento ou caractere estranho no JSON**: o script já grava em UTF-8,
  então isso não deve acontecer. Se acontecer, me avise.