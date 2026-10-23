# Fase 3b · importação por colunas · decisões do dono (2026-10-21)

Respostas às 4 perguntas de levantamento/perguntas.md:
1. Plataformas de futuros fora da Top One: Tradovate (tem ou vai ter). Sem outras corretoras citadas e sem linha de cabeçalho
   real: o primeiro arquivo de teste é o de ordens da Tradovate (Orders) com dados inventados, e o Performance.csv também.
2. Arquivos de execuções (uma compra/venda por linha): SIM, na 3b, como a última parte (3b-4), pareando como na 3c (cada
   entrada vira uma operação; as vendas fecham as compras mais antigas primeiro; venda parcial = saída parcial).
3. Posição que não fecha no fim do arquivo: perguntar por ativo «No fim do arquivo, {ativo} ficou posicionado?» com
   Sim / Não / «Não sei» (já marcado; deixa o ativo de fora).
4. Mesmas operações em dois formatos na mesma conta: avisar na prévia, contando só as que entrariam.
Padrões de perguntas.md («Se você não disser nada, seguimos assim») aceitos.

## Quadro aprovado (2026-10-22)
O dono aprovou o quadro ImportarConta da 3b (canvas versão 67, 19 cenários; cópia em .claude/backup-fase3b/quadro/) com as
7 escolhas como desenhadas (resumo_para_o_dono.md): Performance.csv da Tradovate como opção do cenário 8 com modelo
«Tradovate»; execuções de fora num quadro próprio com «Ver linhas» (não em «com erro»); reimportar o Performance.csv
reconhecido por mesma hora e preço (buyFillId/sellFillId ignorados); a frase «Sem coluna de lado…» em todo arquivo de uma
operação por linha; Binance sem o passo do fuso (Date(UTC)); cenário 17 só avisa quando o número da conta difere; contas
dos exemplos Ylos 50k, Lucid 50k e Top One.

## Cenário 15 (2026-10-22)
O dono escolheu (a): contar o arquivo todo, como a importação já faz hoje (ⓘ e «Antes de…» sobre o arquivo inteiro); sem mudança no banco. Vai como desvio no PR das telas (contrato §11.1 #3–#4).

## Modelos entre mercados (2026-10-23)
O dono escolheu: um modelo salvo em outro mercado continua sendo sugerido («Parecido com o modelo …»), mas «Atualizar o modelo» vem DESMARCADO e o app salva um modelo novo; no mesmo mercado fica como no quadro. Sem mudar o banco.
