# Binary Hub: plano de construção

## 1. Resumo

- Cada fase termina numa tela aprovada rodando no app com os seus dados, e só começa a próxima depois do seu OK.
- O diário vem primeiro (contas, importação, regras, registro, Diário). Depois vêm o estado do mercado, Análises, Padrões e, por fim, Mercado e Início com IA.
- São cerca de 85–106 dias de trabalho (4,5–5 meses). A primeira tela nova aparece em cerca de uma semana, e as páginas antigas funcionam até você aceitar as novas.

## 2. Decisões antes de começar

1. **Onde testar e publicar.** Proponho:
   - um segundo projeto Supabase gratuito como ambiente de teste, restaurado de uma cópia do atual;
   - você confirma quais migrações estão aplicadas no projeto real;
   - o deploy do Firebase é desligado;
   - o app fica na Vercel com as telas novas visíveis só para uma lista de usuários (`HUB_USERS`).

   *Recomendo sim*: sem isso você não registra pelo celular durante a janela.
2. **Yahoo enquanto só você usa.** *Recomendo sim*, atrás da lista e sempre mostrando o horário do dado. Antes de abrir o app para outros, é preciso licença paga. Se for não, só a Fase 5 espera.
3. **Social, AI e Conquistas no menu novo.** *Recomendo* "em breve", sem link para as páginas falsas de hoje.
4. **Limpeza cedo.** *Recomendo* apagar já na Fase 0 as rotas de API falsas; uma delas grava operações no log do servidor.

Outras perguntas ficam para quando a fase precisar:
- fuso da Top One e perdas com Resultado positivo: com o ensaio da Fase 0;
- "A revisar" e se desfazer importação apaga marcas: na Fase 1;
- fonte do calendário econômico: na Fase 5;
- critério do veredito da pergunta: na Fase 7;
- agendador e orçamento de IA: na Fase 8.

## 3. Fases

| Fase | O que entra | Você testa | Dias |
|---|---|---|---|
| **0 · Base segura e moldura** | Verificação em cada PR e Firebase fora do deploy. Moldura claro/escuro em pt-BR. Funções de fuso. Ensaio dos seus 4 arquivos. | `/diario` vazio nos dois temas, no celular. Relatório do ensaio. | 5–6 |
| **1 · Contas e importação** | Contas de verdade, mais "A revisar". ImportarConta com lotes que se desfazem. Suas contas e seletor de conta. Stop, alvo e comissão da Top One; saída e payout da Ebinex. | Duas contas separadas. Reimportar sem duplicar. Desfazer um lote. Ebinex no horário certo de Brasília (hoje aparece 3 h antes). | 9–11 |
| **2 · Regras e janelas** | A data "desde" antes do primeiro registro ao vivo. Janelas, regras com versões, preferências e "Posso operar hoje?" por conta. O bloqueio aparece como "ativo na Fase 5". | 10–11 ET na Top One e 20–21 na Ebinex, limite de US$ 400. | 6–7 |
| **3 · Registrar operação** | Setup A/B/C, operação aberta, saída, marcas com horário do servidor. Avisos de janela e de limite. Variante Ebinex. 4 imagens e uma nota. | Registrar pelo celular. Às 11:05 aparece "Fora da sua janela". A 5ª imagem é recusada. | 8–9 |
| **4 · Diário** | Calendário seg–sex com a Semana, no fuso da conta. O dia: plano, operações, marcas "limpas", imagens e revisão. A semana. A linha do tempo fica marcada "chega na Fase 5". | Seus dias reais; depois, `/trades` passa a abrir `/diario`. | 9–11 |
| **5 · Estado do mercado** | Fundamentos e Técnica por regra, sem IA, a cada 5 min. "O que a tela dizia" gravado na entrada. Bloqueio ativo. A linha do tempo no Diário. | Uma semana comparando a linha do tempo com o seu gráfico. | 8–10 |
| **6 · Análises** | Tudo menos Padrões. Fator de lucro bruto, payoff à parte, acerto só sobre as decididas, valores esmaecidos com o n, Top One como "bruto". Somas feitas no banco. Saem os "insights" automáticos antigos. | Os KPIs por conta contra a sua planilha. | 8–10 |
| **7 · Padrões** | Motor de evidência em TypeScript, com níveis idênticos à referência. Uma fotografia por sábado. A pergunta pré-registrada. | Dois sábados retroativos, no ambiente de teste. | 9–12 |
| **8 · Mercado, AtivoES, Início, IA** | 8a: Mercado e a página do ativo com gráfico (biblioteca nova, com o seu OK). 8b: leituras compartilhadas e conferidas, com teto de gasto. Início. Resumo do dia. | Uma manhã inteira. Antes de ligar a IA: custo medido e leituras recusadas. | 20–26 |
| **9 · Troca e limpeza** | Redirects. Saem colunas e páginas antigas. | Os mesmos números; os links antigos funcionam. | 3–4 |

## 4. Fase 0 em detalhe

- **Banco.** Nada muda. A fase:
  - copia o projeto real para o ambiente de teste;
  - lista as migrações aplicadas;
  - resolve a `20240415000001`, que está fora de ordem.

  A primeira migração (contas) abre a Fase 1 e roda primeiro no ambiente de teste.
- **Telas.**
  - Cabeçalho das pranchas, que não some ao rolar, com o menu Início · Diário · Análises · Mercado · Social · AI · Conquistas.
  - Troca claro (#505050) / escuro (#17191A).
  - `/diario` vazio.
  - As cores novas valem só nas telas novas.
  - O acesso é conferido no servidor contra `HUB_USERS`.
- **Cálculo.** Hora do arquivo mais o fuso dá o instante, o dia do pregão e se está dentro da janela.
- **Ensaio.** Script local, fora do repositório, que imprime só totais.
- **Testes.**
  - Horário de verão de Nova York (8/3 e 1/11).
  - Brasília.
  - Janela que passa da meia-noite.
  - Troca de tema.
  - Rotas que exigem login.
- **Primeiro PR, "Base segura".** Não muda nada visível.
  - Verificação em PR com Node 22.
  - Deploy com as variáveis do Supabase.
  - Sai o workflow do Firebase, e sai o redirecionamento em `app/vercel.json`.
  - `docs/csv/` entra no `.gitignore`.
  - Saem as rotas falsas.
  - Entram as funções de tempo com testes.

  O segundo PR traz a moldura.

## 5. Para depois

- **Social, AI e Conquistas:** não foram desenhadas.
- **Grupos de cópia:** você ainda opera uma conta por vez.
- **Dados pagos e cadastro aberto:** exigem licença e um plano pago da Vercel; o Hobby é só para uso pessoal.
- **Assistente de IA:** você não escolheu.

## 6. Riscos

- **Mudança de dia.** Corrigir o fuso põe as operações Ebinex no horário certo. Nas páginas antigas, que agrupam os dias em UTC, as das 21:00–23:59 de Brasília passam para o dia seguinte; nas novas, todas ficam no dia certo. A correção é feita conta a conta: contagem primeiro, depois o seu OK. Rodar de novo não muda nada, e dá para reverter.
- **Duplicatas.** A chave antiga de importação fica até nenhuma tela usá-la. A nota nova vai numa coluna própria.
- **Evidência confiável.** Os horários vêm do banco e não podem ser editados. Importadas e dias reconstruídos ficam fora da pergunta e dos Padrões.
- **Custo de IA.** Cerca de US$ 0,60 por análise, o que pode passar de US$ 200 por mês. Para conter: leitura compartilhada, custo medido antes e corte automático no teto.
- **Repositório público.**
  - O `August_25.csv` já está no histórico; você decide se sai.
  - Revogar as chaves antigas do `.env` da raiz.
  - Testes só com dados inventados.
- **Prazo.** As fases são sequenciais, para uma pessoa. O controle é a sua aprovação ao fim de cada fase.
