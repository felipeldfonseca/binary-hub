# Fase 3 · Registrar operação · decisões do dono (2026-10-18)

Respostas (todas a opção recomendada em levantamento/perguntas.md):
1. Hora da entrada: pode ser corrigida até 15 minutos antes de agora (o app guarda à parte a hora real do registro; marcas
   julgadas pelo relógio do servidor). Para algo mais antigo, «Já fechada».
2. Arquivo × app: o arquivo vale para o dinheiro (preços, contratos, resultado); horários, marcas, stop, alvo e o
   «Posso operar hoje?» da entrada ficam como registrados. Desfazer a importação devolve os valores registrados.
3. Apagar: «Desfazer entrada» no Registrar enquanto aberta e nos primeiros 15 minutos; a página antiga Operações continua
   apagando; o app guarda só data e hora de que uma operação registrada foi apagada; as imagens saem do armazenamento.
4. Mercados novos: completo, com cálculo (quatro cenários novos no quadro: Forex, Ações e opções, Cripto, B3; resultado
   calculado quando a conta é exata, digitado quando não; «Custos» opcional; opções simples sem travas).

Padrões aceitos (ele não objetou): toda a lista «Se você não disser nada, seguimos assim» de levantamento/perguntas.md e
os defaults de levantamento/sintese.md §5 (incl. Review changes D34–D38).
Ordem: revisão do quadro (canvas) ‖ 3-1 Banco ‖ 3-2 Domínio → 3-3 Telas (Futuros + Ebinex; teste do dono) → 3-4 Mercados
novos → 3b importação por colunas.

## Respostas sobre o quadro (2026-10-19/20)
- Ebinex: só 1, 5 e 15 min; ordens casadas em livro de ofertas; entra-se durante a vela do timeframe até 5 s antes de ela fechar; a operação roda a vela seguinte e o resultado sai no fim dela (M5 20:13 → 20:15–20:20; M15 20:13 → 20:15–20:30). Demais corretoras: tempo conta do clique.
- Aviso (nunca bloqueio) quando o risco do stop (ou o stake) passa do que falta do limite do dia (limite + resultado realizado do dia na entrada).
- Operação aberta de ontem conta no dia em que abriu; ES/NQ/GC nos atalhos; preços começam vazios.
- B3: reconhecer o código de série como a raiz (WINZ26 → WIN, calculado) — recomendação aceita; entra na 3-4.
- Quadro v55 (canvas versão 57, 13 cenários) APROVADO em 2026-10-20, com as escolhas desenhadas.
- Prévia do SQL colada no banco real (2026-10-20): Storage pelo SQL Editor ok (bucket, políticas, apagar bucket), nenhuma política aberta, Fase 3 não aplicada; 629 operações, 9 versões, contas b3 1, forex 1, binary 1, futures 3; Postgres 17.6. → usar fase3_aplicar.sql (com Storage).
