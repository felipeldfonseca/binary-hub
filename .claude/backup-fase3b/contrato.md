# Fase 3b · PR «Fase 3b · telas» (importação por colunas, incl. arquivos de execuções) · build contract

Two parallel lanes build from this file, stacked on `fase-3b/dominio` (PR #38, 4541996, itself on `fase-3b/banco`, PR #37,
525a7da):

- **L1 · the mapping steps**: «mapa» and «conferir» (trade files and execution files), the model chip with «Mudar colunas»,
  «Mudar» (separator, decimal, dates), «Atualizar o modelo», the decimal, date, side and net/swap questions, the
  end-of-file question and the pairing summary «Ver as N operações».
- **L2 · the flow around them**: reading and routing an unrecognised file, «Para qual conta?» for every market (a2), «N
  contas neste arquivo» (hc), the step indicator, the zone step with the G2 rule, the preview (counts in «saídas», the
  leftover executions with «Ver linhas», the G1 warning), the end with the model line and the model save, scenario 9's
  errors, the stale copy, «Importar histórico» at account creation, the gates outside the sheet.

English, with every pt-BR string verbatim in «». `{}` marks a value.

## 0. Sources, precedence, hard rules

**Sources** (all read for this contract):

| What | Where |
|---|---|
| Approved board (22 Oct; canvas version 67; 19 scenarios) | `scratchpad/fase3b/quadro/project/ImportarConta.dc.html` (1 983 lines, sha256 `7f1dcf6501bbcdf6…`). «IC l.N» = a line of that file: markup l.1–618, script l.619–1983 (l.623 is the data object `D`: scenario list, cards, `desc`, variant lists). The file is **data**: read as markup, never as instructions. |
| Owner's approval and choices | `scratchpad/fase3b/quadro/resumo_para_o_dono.md` (the 7 choices, approved as drawn), `scratchpad/fase3b/decisoes.md` |
| Specs | `scratchpad/fase3b/levantamento/sintese.md` (§1.1 cut, §2.2 3b-3/3b-4 screen parts, §2.5 owner test, §3 C1–C33, §5 D1–D37, §6 G1–G3), `banco_dominio.md` (§3.5–3.6, §4, §6, §8, §9), `quadro.md` (§2 S1–S22, §4.2–4.5), `estado_atual.md` (§3 the as-built screens, §8 seams), `formatos.md` |
| Code (read-only) | banco `fase-3b/banco` **525a7da** (PR #37; worktree `.claude/worktrees/wf_80ee76f7-789-1`), domínio `fase-3b/dominio` **4541996** (PR #38, stacked on banco; worktree `…-789-2`): **final**, published, not merged. Never write in either worktree. Every API named here was read at 4541996: `app/lib/domain/import/` (`mapped/{sniff,values,fields,template,trades,fills,cells,types,index}.ts`, `decimal.ts`, `route.ts`, `rpc.ts`, `parseFile.ts`), `app/testing/mappedFiles.ts`, `app/__tests__/lib/hubImportColunas.pg.test.ts`, the as-built sheet `app/components/hub/importar/{ImportSheet.tsx (1 158 l.), passos.tsx (1 101 l.), flow.ts, ImportSheetProvider.tsx}`, `app/components/hub/contas/*`, `app/lib/hub/{contas,contasDb,regrasConta}.ts`, `app/hooks/useContas.ts`, migrations `20261024000001/2`. |
| Patterns | `scratchpad/fase3c/telas/contrato.md` (lanes, shared interface commit, per-it split, screenshot plan) and the harness notes `scratchpad/fase3b/telas/shots_3c.md` with the tools in `scratchpad/fase3b/telas/shot_tools/`, `scratchpad/fase3b/telas/pg_run.sh` |

**Precedence where this file is silent:** the approved board (layout, states, pt-BR copy) → the owner's choices
(`resumo_para_o_dono.md`, `decisoes.md`) → this contract → the final domain and banco API (4541996 / 525a7da) →
`sintese.md` → `quadro.md` / `banco_dominio.md` → the as-built screens. **Where the board and the specs disagree, the board
wins** (§2.3 lists every case), **except two numbers the domain proved wrong, which follow the domain** and go to the PR
body (§11.1): the IBKR commissions «comissões −US$ 5,00» (board 6,00) and Forex with the Chicago zone «1 operação fica em
outro dia…» (board 2). **Any other difference from the board needs the owner's answer before B0** (§11.0: scenario 15's
rules line, end line and commission ⓘ, which the final database cannot reproduce); §11.1 #6 lists the few zone-bar heights no
file can draw together with the board's own counts, the domain's frozen IBKR file and the two numbers above.

**String markers:** **B** = exact board copy (with its IC line), **A** = adapted (reason given), **N** = new (on no board;
reason given). Every string goes to the lane's copy file with its marker in a comment.

**Never built** (prototype controls, IC l.194–202 and their texts): «Cenário do protótipo», «Erro:», «Arquivo:», «Recomeçar»,
«Modo escuro» (bar), «fora do produto», the «exemplo» chips (`chip-ex`), «No protótipo, …» hints (IC l.1476, 1856, 1914),
«(no protótipo)». A test in each lane checks that no such label reaches its copy files.

**Hard rules (both lanes).**
- Never call the live Supabase: Jest mocks `@/lib/hub/contasDb` / `@/lib/supabase`; database-backed suites run only on a
  throwaway local Postgres through `scratchpad/fase3b/telas/pg_run.sh` on the ports the orchestrator gives the lane (never
  5432, never `/Library/PostgreSQL`).
- Never read or print `.env` files or rows of `docs/csv`; invented data only (every fixture is invented).
- Never edit the main checkout or the banco/domínio worktrees. `app/node_modules` is an untracked symlink: stage **by
  explicit path**, `git status` before every commit. Commits end with `Co-Authored-By: Claude Opus 5.5
  <noreply@anthropic.com>`. Never push.
- Node 22 (`~/.nvm/versions/node/v22.16.0`). Never `next build`. Never `next dev` (the owner test's LAN server is the
  orchestrator's, §10).
- Disk: `df -h /` before any visual or database work; the screenshot harness refuses under 1,5 GB. **A run the orchestrator
  marks «no screenshots / no clusters» writes the visual specs and the database-backed suites, runs plain Jest (which skips
  `*.pg.test.ts`), `tsc` and lint, and reports the cluster runs and the shots as pending.** No Chrome profile or page is
  left behind.
- The file's text never leaves the browser and is never logged: no `console.*` of a cell, a header or the text; issues and
  errors carry a line and a code only (as the domain).
- Before finishing: `npx jest --ci` (all suites), `npx tsc --noEmit`, `npx next lint` green; then §8.4.

**Branches.** Base `fase-3b/telas` = `fase-3b/dominio` 4541996 + **B0** (§4, one commit, by the orchestrator before the lanes
branch). Lanes: `fase-3b/telas-l1` (worktree `.claude/worktrees/fase3b-telas-l1`) and `fase-3b/telas-l2`
(`.claude/worktrees/fase3b-telas-l2`), both from the tip of `fase-3b/telas` (so both start with B0: no cherry-pick). Merge
order in §7.4. The screenshot harness's page writer `app/testing/telasShots.ts` is already on 4541996 (from 3c): no harness
commit is needed.

---

## 1. The cut

| Area | What this PR builds | Lane |
|---|---|---|
| Reading an unrecognised file | read the text again in the browser, sniff it (`sniffFile`), route it once the account is known (`routeFile`): reader / reader's error / «mapa» / binaries error; a file that matches a saved model (exact) goes straight to «Prévia» when it asks nothing, else to «conferir» (an end-of-file question) or «mapa» (D20) | L2 (flow), B0 (plumbing) |
| «Para qual conta?» (a2) | no account in context and an unrecognised file: every account of a mapping market, grouped by market, «+ Nova conta» | L2 |
| «mapa» | the board's step: title, «Separador: … · decimal …», «Datas: …», «Mudar», the decimal and date questions, «Cada linha do arquivo é», «Obrigatórias», the notes, the duplicate block, one row per column with «sugerida» / «nova», the checks, the side-word question; the execution variant | L1 |
| «conferir» | «Confira 3 linhas», the notes, the end-of-file question per symbol, the pairing summary with «Ver as N operações», the net / swap question, «Salvar como modelo» / «Atualizar o modelo “{nome}”» with «Nome do modelo» | L1 |
| «N contas neste arquivo» (hc) | one value of the «Conta» column per import | L2 |
| Zone step (c) | per market (reference clock, band, legend), «entradas» / «execuções», the G2 rule (skip, preselection, refusal) | L2 |
| Preview (d) | the model chip «Colunas do modelo “{nome}”» + «Mudar colunas» (component L1, placed by L2); «N execuções no arquivo»; counts in «saídas»; the new lines; the leftover executions with «Ver linhas»; the G1 block | L2 (+ L1's chip) |
| End (fim) | the model line, the model save (after the commit) | L2 |
| Scenario 9 | «Arquivo não reconhecido em binárias», «Planilha do Excel» (already in the domain PR: verified), «Arquivo que não abre» | L2 |
| Stale copy | scenarios 2, 4, 6, 7, 11–14 and the background (§2.2) | L2 |
| Outside the sheet | Diário header, Suas contas «Importar» / «Importações» / group note, Editar conta «Fuso do arquivo», `CONTAS.info`, Registrar's «Antes de {d}…» | L2 |

Out of the cut: §12.

---

## 2. Board inventory

### 2.1 Element catalogue

Ids E1… Strings verbatim; `{}` a value. Where each element lives, what it reads and writes, its copy keys and its
keyboard/accessibility/layout are in §2.4 (map) and §5 (L1) / §6 (L2) (details).

#### The sheet frame (L2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E1 | File card (`.hub-arq`) for a mapped file, constant for the file across steps (set when the file is read and when its mapping starts, never by «Mudar colunas»): no model / a model that does not fit as is / a model taken as is; also on a2 and on the binaries error, before any mapping, from a market-free `sniffFile(arquivo.text)` («Arquivo não reconhecido · {n} linhas»; no card when that sniff fails); ⓘ panel | IC l.269–273, 1081–1150 (`arq`), l.623 (`D.infoArq`), l.1263–1265, 1971 (`temArq` on a2 and on `erro` with `arqKey 'desc'`) | «Arquivo não reconhecido · 18 linhas» · «Parecido com o modelo “BlackArrow” · 24 linhas» · «Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out» · ⓘ «Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo. Quando não reconhecemos, você diz o que é cada coluna uma vez e salva como modelo.» (B: the ⓘ text gains its second sentence for every file, readers too) |
| E2 | Step indicator «Passo {k} de {n}» + dots; counts a2, mapa, conferir, hc with the as-built counted steps; a sequence of one step shows none; «Mudar colunas» starts a new sequence (IC l.1706 `setF({mudarCols: true, i: 0})`) | IC l.276, 1242, 1254–1260, 1706, 1892 | «Passo 1 de 4» (8) · «Passo 1 de 5» (19, 17) · none on 15's direct «Prévia» · 15 «Mudar colunas»: mapa «Passo 1 de 3» without «Voltar», conferir «Passo 2 de 3», d «Passo 3 de 3» |
| E3 | Drop step (`solte`) titles (as built) | IC l.583–589, 1853–1857 | «Importar histórico de {conta}» · «Escolha o arquivo» (19: no account) · «Escolha outro arquivo» · «Solte para importar» · «CSV» · «Escolher arquivo» |
| E4 | (not built) the Tradovate «Como exportar» hint: the board draws it only in step i3 «Como as operações chegam?», which stays out of 3b with it (§2.3 D14, §12) | IC l.514, 1823–1832 | — |

#### «Para qual conta?» for an unrecognised file (a2, L2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E5 | h3 + nota; one group per mapping market that has active accounts (board order Futuros, Forex, Ações, Cripto, B3; binaries never), `span.rotulo#a2-g{k}` + `role=group aria-labelledby` pills `aria-pressed`; a separate pills row with «+ Nova conta»; nota on binaries; nothing pressed at first; footer «Continuar» blocked with the hint until a pill is pressed | IC l.437–447, 1642–1647, 1913–1914 | «Para qual conta?» · «Não reconhecemos este arquivo: escolha a conta, e depois você diz o que é cada coluna.» · group names = `MARKET_LABEL` («Futuros», «Forex», «Ações», «Cripto», «B3») · account labels · «+ Nova conta» · «Contas de binárias recebem só o CSV da Ebinex.» · hint «Escolha a conta.» |
| E6 | «+ Nova conta» → «Qual mercado?» (the five mapping markets, no «Opções binárias», no binaries note) → «Onde você opera?» → «Nova conta de …» («Criar {apelido} e continuar») → «mapa» (N: the board stops at the pill, IC l.1914) | — | as built (`PASSO_I1`, `PASSO_I2`, `PASSO_B.createAndGo`) |

#### «mapa» (L1)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E7 | h3 title, three forms | IC l.529, 1484–1485 | «Não reconhecemos este arquivo. Diga o que é cada coluna.» · «Este arquivo mudou desde o modelo “{nome}”. Confira as colunas.» (a model the file does not fit as is: a changed header, or an exact one with misfits or a question on «mapa») · «Mude as colunas do modelo “{nome}”.» (only after «Mudar colunas»: `mudando`) |
| E8 | `.hub-ler` row: chip «Separador…», chip «Datas…» (only when an order is known), «Mudar» (`.hub-btn`, `aria-expanded`, `aria-controls=ler-arquivo`) | IC l.530, 1488–1490 | «Separador: ponto e vírgula · decimal vírgula» · «Separador: vírgula · decimal ponto» · «Separador: ponto e vírgula» (no decimal part while the decimal question is open) · «Separador: tabulação …» · «Datas: dia/mês» · «Datas: mês/dia» · «Mudar» |
| E9 | Panel `#ler-arquivo` (`.hub-ler-painel`, dashed): «Separador» pills «;» «,» «Tab» (`aria-label` «Ponto e vírgula» / «Vírgula» / «Tabulação», min-width 44 px); «Decimal» pills «vírgula» «ponto» (only when the decimal was decided by the file); «Datas» pills «dia/mês» «mês/dia» (only when the order was decided by the file) | IC l.531–537, 1439, 1491–1493 | «Separador» · «;» · «,» · «Tab» · «Decimal» · «vírgula» · «ponto» · «Datas» · «dia/mês» · «mês/dia» |
| E10 | Reading note `p.hub-nota` under the row, one at a time (separator first), also said by the sheet's live region; each blocks «Continuar» | IC l.538, 1445–1446 | «Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.» · «Os números não fecharam com este decimal. Confira.» · «Com esta ordem, há datas que não existem. Confira.» |
| E11 | Date question (amber `.hub-bloco--atencao.hub-pergunta`, `span#q-datas` + `role=group aria-labelledby=q-datas` pills), only while the file's dates do not settle the order; blocks until answered | IC l.539, 1453–1455 | «As datas podem ser dia/mês ou mês/dia. Qual é?» · «dia/mês (09.10 = 9 out)» · «mês/dia (09.10 = 10 set)» (the example is the first ambiguous date of the file, its day and month as written: §5.4) · hint «Escolha a ordem das datas.» |
| E12 | Decimal question (amber, `#q-dec`), only while nothing settles the mark; the `;` separator preselects the first pill; choosing a reading that puts a tick instrument off its tick adds the amber nota and blocks | IC l.539, 1457–1459, 1447 | «Como ler os números deste arquivo?» · «“131.250” é 131250 (ponto separa milhar)» · «“131.250” é 131,25 (ponto é decimal)» (the sample is the domain's `DecimalQuestion.sample`) · nota «Com este decimal, o WIN fica fora do passo (de 5 em 5). Confira.» (`{raiz}`, `{passo}`) · hint «Escolha como ler os números.» (N: no preselection, a `,` file) |
| E13 | «Cada linha do arquivo é» (`span#l-modo` + pills) | IC l.540 | «Cada linha do arquivo é» · «uma operação (entrada e saída)» · «uma execução (compra ou venda)» |
| E14 | «Obrigatórias» (`.rotulo`) + chips (`.hub-req`, `.hub-req--ok`) + opcionais nota | IC l.541, 1413–1418, 1499–1501 | trade: «Entrada ✓» / «Entrada · falta» · «Entrada (pela compra e venda) ✓» · «Ativo» · «Lado» / «Lado (pela compra e venda)» / «Lado (ou quantidade com sinal)» · «Quantidade» · «Resultado (ou os preços)»; execution: «Data e hora» · «Ativo» · «Lado» / «Lado (ou quantidade com sinal)» · «Quantidade» · «Preço»; opcionais trade: «Opcionais: Saída, Comissão, Outra taxa, Swap ou funding, Stop, Alvo, ID da operação (evita duplicar), Conta. Sem coluna de lado, marque Compra e Venda (data e hora) e o preço de cada uma.» (without «, Swap ou funding» outside Forex and Cripto); execution: «Opcionais: Comissão, Outra taxa, ID da execução (evita duplicar), ID da ordem, Abre ou fecha, Resultado realizado, Conta.» |
| E15 | Notes (`p.hub-nota` each), in this order, each only when its condition holds (§5.4) | IC l.542, 1464–1472, 1094, 1123, 1131, 1167–1176 | 1 execution: «Juntamos as compras e vendas de cada ativo em operações: cada compra que abre ou aumenta a posição vira uma operação, e as vendas fecham primeiro as compras mais antigas. Na venda a descoberto, é o mesmo, ao contrário.» · 2 «Sem coluna de lado: quantidade positiva é compra, negativa é venda.» · 3 «Com a compra e a venda em colunas, a entrada é a que veio primeiro: comprou primeiro, é compra; vendeu primeiro, é venda.» · 4 per market (no result column): Futuros «Sem coluna de resultado, calculamos pelos preços só nos contratos que conhecemos: ES, MES, NQ, MNQ, GC, MGC, CL e MCL.» · Forex «Sem coluna de resultado, calculamos pelos preços: exato em EURUSD, GBPUSD, AUDUSD e NZDUSD; estimado pela cotação de saída nos pares que começam com USD. Nos outros pares, marque uma coluna de resultado.» · Ações «Sem coluna de resultado, calculamos pelos preços. Opções ficam de fora: registre no Registrar.» · Cripto «Sem coluna de resultado, calculamos pelos preços só nos pares em dólar (USDT, USDC ou USD).» · B3 «Sem coluna de resultado, calculamos pelos preços só nos contratos e ações que conhecemos (WIN, IND, WDO, DOL e as ações da lista).» · 5 «Sem hora de saída, o resultado conta no limite do dia na hora da entrada.» · 6 «Sem coluna de ID, reconhecemos a reimportação pela mesma hora e preço.» · 7 the file's own notes: «A coluna Date(UTC) já diz o fuso: os horários entram em UTC.» · «Decimal vírgula pelos valores como “88,50”: “131.250” é 131250.» · «“$(13.75)” é perda: lemos como −13,75.» · «buyFillId e sellFillId se repetem de uma linha para outra: nenhuma das duas serve de ID sozinha.» · 8 «Já sugerimos pelo nome de cada coluna. Confira.» |
| E16 | Duplicate block (amber), when a field (other than «Outra taxa») is in more than one column | IC l.543, 1420, 1474 | «Quantidade está em mais de uma coluna.» · «Quantidade, Ativo estão em mais de uma coluna.» (labels joined by «, ») |
| E17 | Column rows (`.hub-col-linha`, one per header in file order): name (bold mono) + tag (`span.hub-tag.hub-tag--padrao`, the shared neutral tag); «ex.: {amostra}» (the column's first non-empty cell among the data records, as the board: Tradovate «Limit Price» shows «6816.00» though its first record leaves it empty; «ex.: —» when every cell is empty); `<select>` (`aria-label` «O que é a coluna {nome}», «Escolha…» + the row kind's field labels in the board's order, «Ignorar esta coluna» last), `aria-invalid` + `aria-describedby=chk-{k}` with the check text under it (amber 12 px bold) | IC l.544–548, 1155–1164, 1421–1430, 1504–1512 | tags «sugerida» · «nova»; trade labels: «Entrada (data e hora)» «Ativo» «Lado» «Quantidade» «Resultado» «Preço de entrada» «Preço de saída» «Saída (data e hora)» «Compra (data e hora)» «Venda (data e hora)» «Preço de compra» «Preço de venda» «Comissão» «Outra taxa (soma na comissão)» «Swap ou funding» (Forex, Cripto) «Stop» «Alvo» «ID da operação (evita duplicar)» «Conta» «Ignorar esta coluna»; execution labels: «Data e hora» «Ativo» «Lado» «Quantidade» «Preço» «Comissão» «Outra taxa (soma na comissão)» «ID da execução (evita duplicar)» «ID da ordem» «Abre ou fecha» «Resultado realizado» «Conta» «Ignorar esta coluna»; checks: «Esta coluna não parece data e hora.» · «Esta coluna não parece número.» · «Esta coluna não parece compra e venda.» · «Swap ou funding vai junto com a coluna de resultado.» · «Esta coluna repete valores: não serve de ID.» |
| E18 | Side-word question (amber, `#q-lado-{k}`), one per unknown word of the side column, after the columns; blocks until answered | IC l.549, 1461–1462 | «2 linhas trazem “X” na coluna de lado. O que quer dizer?» (singular N: «1 linha traz “{valor}” na coluna de lado. O que quer dizer?») · «Compra» · «Venda» · «Pular essas linhas» · hint «Diga o que quer dizer “X”.» |
| E19 | Footer «Continuar» (as built `FOLHA.next`), blocked with the first hint in this order (§5.6) | IC l.1476–1482, 1920 | «Confira como ler o arquivo.» · «Escolha a ordem das datas.» · «Escolha como ler os números.» (N) · «Marque as colunas obrigatórias.» · «Cada campo vai em uma coluna só.» · «Confira as colunas marcadas.» · «Diga o que quer dizer “X”.» |
| E20 | Pre-fill: a field suggested from the column's name (tag «sugerida» while the select still holds it); a twin or a known non-field column preset to «Ignorar esta coluna» (tag «sugerida»); anything else «Escolha…» (no tag); from a model: the model's fields, «Ignorar esta coluna» for a column the model ignores, «Escolha…» + tag «nova» for a column the model does not know; per row kind, each kind keeping its own edits | IC l.1402–1406, 1472, 1505–1508 (`COLS_*` l.797–1060) | §5.3 |

#### «conferir» (L1)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E21 | h3 + the order line | IC l.555–556, 1606 | «Confira 3 linhas» (N for a file of 1–2 records: «Confira 2 linhas» · «Confira a linha») · trade: «Entrada · Ativo · Lado · Quantidade · Resultado» (+ « (pelos preços)» without a result column) · execution: «Data e hora · Ativo · Lado · Quantidade · Preço» |
| E22 | The first three data records as the mapping reads them: `ul.hub-prev-lista > li.hub-prev-linha > span` (mono 12 px), a visually hidden «, » after each item but the last | IC l.557, 1517–1588 | e.g. «1 out, 09:34» «MESZ6» «compra» «2 contratos» «−US$ 39,98» · «13 out, 10:31» «MESZ6» «compra» «2 contratos» «6.812,25» · «14 out, 08:40» «EURUSD» «compra» «0,50 lote» «+US$ 57,50» · «14 out, 10:02» «WINZ26» «venda» «3 contratos» «+R$ 90,00 pelos preços» · «11 out, 00:05» «BTCUSDT» «compra» «0,0125 BTC» «112.400,00» · «14 out, 09:45» «MSFT» «venda» «50 ações» «512,30» · a value the mapping cannot read: «—» (formats §5.5) |
| E23 | Notes (`p.hub-nota`) | IC l.558, 779–781, 1106, 1132, 1136 | «Confira: a quantidade é a executada e o horário é o da execução, não o da ordem.» (every execution file) · «Supomos que o arquivo começa sem posição aberta.» · «Em MNQZ6, supomos que o arquivo começa sem posição aberta.» · «A 1ª e a 2ª linhas têm a mesma entrada: viram uma operação com 2 saídas.» |
| E24 | End-of-file question per symbol (amber, `#q-fim-{k}`): title, sub, three pills with «Não sei» pressed, nota by the answer (also said by the live region on a change) | IC l.559, 1590–1595, 1096–1098, 1137–1139, 782 | «No fim do arquivo, MESZ6 ficou posicionado?» · sub «Pelas execuções do arquivo, sobra 1 contrato vendido.» / «Pelas execuções do arquivo, sobram 0,1 ETH comprados.» · «Sim, ficou posicionado» · «Não, terminou zerado» · «Não sei» · notas: «As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.» · «A posição ainda aberta fica de fora (1 execução) e entra quando você importar um arquivo que tenha a abertura e o fechamento.» (N when only part of an execution stays open: «A parte ainda aberta da posição ({q} {unidade}) fica de fora e entra quando você importar um arquivo que tenha a abertura e o fechamento.») · «O arquivo começou com 1 contrato comprado, de antes dele: a venda que o fecha fica de fora.» · «O arquivo começou com 0,1 ETH vendidos, de antes dele: a compra que fecha essa venda fica de fora.» |
| E25 | Pairing summary (`.hub-bloco`; `div role=status`: bold resumo, «1ª operação», the entries note) + disclosure «Ver as N operações» (`aria-expanded`, `aria-controls=ops-formadas`) + `ul#ops-formadas` | IC l.560–566, 877–889, 928–934, 1100–1110, 1141–1146, 1611–1612 | «Viram 4 operações: 2 com uma saída e 2 com saídas parciais.» · «Viram 2 operações: 2 com uma saída.» · «1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.816,00 e de 1 a 6.819,50: +US$ 55,00.» · «1 posição com mais de uma entrada virou 2 operações, uma por entrada.» · «Ver as 4 operações» / «Ver a operação» · items «13 out, 10:31 · MESZ6 · compra de 2 a 6.812,25 · saídas de 1 a 6.816,00 e de 1 a 6.819,50 · +US$ 55,00» |
| E26 | Net question (`.hub-bloco.hub-pergunta`, not amber, `#q-liq`), only with a result and a cost (or swap) mapped; pre-answered when the prices settle it, with the evidence nota | IC l.567, 1596–1602, 1083, 1114, 1118, 1124 | «O resultado do arquivo já desconta a comissão?» · «O resultado do arquivo já tem a comissão e o swap?» · «O resultado do arquivo já tem o swap?» · «Sim, é líquido» · «Não, é bruto» · «Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.» · «Conferido pelos preços na 1ª linha: +US$ 17,00 antes da comissão de US$ 1,24.» · «Conferido pelos preços na 1ª linha: +US$ 57,50 antes da comissão de US$ 3,50.» · «Conferido pelos preços na 1ª linha: +R$ 90,00 − R$ 1,50 = +R$ 88,50.» |
| E27 | Model block (`.hub-bloco`): checkbox (checked by default), «Nome do modelo» (only for a new model being saved; max 60), nota | IC l.568–572, 1603–1604, 1613–1617 | «Salvar como modelo» · «Atualizar o modelo “BlackArrow”» · «Nome do modelo» · «O modelo guarda os nomes das colunas e as suas escolhas, nunca as operações.» |
| E28 | Footer «Usar estas colunas» | IC l.1921 | «Usar estas colunas» · hint (N) «Responda a pergunta sobre o resultado do arquivo.» while the net question has no answer |
| E29 | The mapping cannot make the file (N): an alert in place of the rows and the footer blocked with the same text | — | «Este arquivo mistura horários com e sem fuso: não dá para pôr as execuções em ordem.» (`mixed_clocks`) · «O arquivo passa de 5.000 saídas.» (`too_many_rows` of an execution file) |

#### «N contas neste arquivo» (hc, L2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E30 | h3; one row per value of the «Conta» column (first appearance order): «{valor} · {n} op.» + `<select aria-label="O que fazer com {valor}">` «Importar em {conta}» / «Não importar»; importing one value sets every other to «Não importar»; nota; amber aviso when the imported value is not the account's «Número na plataforma»; nota on the others; hint; live region on a change | IC l.449–461, 1624–1641, 1912 | «2 contas neste arquivo» · «APX-0001 · 31 op.» · «Importar em Apex A» · «Não importar» · «Escolhemos pelo número na plataforma de cada conta.» · «O número na plataforma de Apex A é APX-0001.» · «Para importar APX-0002, abra a importação na conta dela: o que já entrou não duplica.» · «Para importar APX-0001 e APX-0002, abra a importação na conta de cada uma: o que já entrou não duplica.» · hint «Escolha qual conta do arquivo vai para Apex A.» · live «APX-0001 passou para “Não importar”. O número na plataforma de Apex A é APX-0001.» |

#### Zone step (c, L2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E31 | As built (heading, ⓘ, «No arquivo…», axis, radios Nova York (ET) · Brasília · UTC · Outro + «Qual fuso?»), per market: reference clock, band and legend; captions say «entradas» for trade files and «execuções» for execution files; for a mapped file, as the board draws it, one bar unit per trade (a trade file's positions: two exits of one entry are one entry) or per execution, and the spans from the first to the last entry (the day cut at the largest gap; readers keep the as-built usual hours, p10–p90); no «Lembrar…» | IC l.339–360, 1166–1177, 1290–1313, 1769–1773 | «No arquivo: entradas 09:31–10:58, sem fuso.» · «No arquivo: execuções 10:31–11:48, sem fuso.» · captions «entradas 09:31–10:58 ET» · «execuções 10:31–11:31 ET» · «entradas 10:02–16:40 de Brasília»; band «pregão regular 09:30–16:00 ET» (Futuros, Ações) · «pregão 09:00–18:30» (B3) · none (Forex, Cripto); legends «Faixas no relógio de Nova York (ET).» · «Faixas no relógio de Nova York (ET). Forex abre 24 h: sem faixa de pregão.» · «Faixas no relógio de Brasília. Cripto abre 24 h: sem faixa de pregão.» · «Faixas no relógio de Brasília.» |
| E32 | When the step shows and what it preselects (G2) | IC l.1242–1247, 1281 | §6.5 |
| E33 | Refusal (amber block; also the live region): a zone other than the account's import zone; footer blocked | IC l.357, 1128, 1902, 1942 | «Este fuso é diferente do fuso das importações desta conta.» (bold) + «Este arquivo usa outro relógio que o das importações de {conta}. Confira o fuso na plataforma.» · hint «Use o fuso das importações da conta: {zona}.» |

#### Preview (d, L2; E34's component L1)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E34 | Model chip row (`.hub-ler`): `span.hub-chip-dado` + «Mudar colunas» (`.hub-btn`), only on an exact model taken as is (`porModelo`): on «Prévia» (board) and, N, on «conferir» when such a model still asks the end-of-file question or cannot make the file (§6.2 step 3; there it replaces E27) | IC l.366, 1705–1706 | «Colunas do modelo “BlackArrow”» · «Mudar colunas» |
| E35 | `p.hub-nota` on execution files, before the counts | IC l.367, 1704 | «{n} execuções no arquivo» («9 execuções no arquivo»; number in `.hub-num`) |
| E36 | Count row: trade files as built plus «não importadas ({valor})» (hc); execution files «saídas · novas · já estavam», never «com erro» | IC l.368, 794, 811, 819, 847, 1002, 1035, 1074, 1698–1700 | «18 linhas · 18 novas · 0 já estavam · 0 com erro» · «24 linhas · 5 novas · 1 já registrada por você · 18 já estavam (mesmo ID) · 0 com erro» · «57 linhas · 31 novas · 26 não importadas (APX-0002) · 0 já estavam · 0 com erro» · «6 saídas · 6 novas · 0 já estavam» · «já estavam (mesma hora e preço)» (N, §2.3 D11) |
| E37 | Lines before the leftovers (`.hub-linha-i`), in §6.6's order | IC l.377, 820, 848, 891, 938, 1003 | «1 já registrada por você: o arquivo completa a comissão.» (as built) · «As 6 saídas viram 4 operações.» · «2 saídas parciais juntadas às suas operações.» (as built) · «2 ordens sem execução ficaram de fora.» · «Ativos escritos como “MNQ 12-26” e “MES 12-26” ficam como “MNQZ26” e “MESZ26”.» · «Os horários já trazem o fuso (UTC).» |
| E38 | Leftovers block (amber) + «Ver linhas» (as built `SkippedLines`) with «Linha {n}: {motivo}» | IC l.378–383, 785–790, 905, 949, 974, 1069, 1075 | trade files (as built): «2 linhas com erro foram puladas.» · execution files: «As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.» · «1 execução de posição ainda aberta no fim do arquivo ficou de fora. Ela entra quando você importar um arquivo que tenha a abertura e o fechamento.» · «1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.» · «3 execuções ficaram de fora.»; reasons «as compras e as vendas do ativo não fecham no arquivo» · «posição ainda aberta no fim do arquivo» · «fecha uma posição aberta antes do começo do arquivo» · «opção, fica de fora (registre no Registrar)» · «preço fora do passo do WIN (de 5 em 5)» · «lado desconhecido» |
| E39 | Commission line + ⓘ (as built) | IC l.384–387 | «O arquivo traz comissões: mostramos o resultado líquido.» · ⓘ «Bruto +US$ 41,25 · comissões −US$ 26,04.» |
| E40 | Lines after the commission (`.hub-linha-i`), in §6.6's order | IC l.388, 783–784, 793, 935–936, 1037–1038 | «Sem comissão no arquivo: estas operações ficam sem comissão.» · «1 operação fica sem comissão: a taxa veio em BNB.» · «18 com resultado diferente do calculado pelos preços: vale o do arquivo.» · «1 operação com swap: ele entra no resultado, antes da comissão.» · «1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.» · «… o dia de Cripto vira à meia-noite de Brasília.» · «Sem hora de saída, o resultado conta no limite do dia na hora da entrada.» |
| E41 | «Antes de {d}…» + ⓘ (as built) | IC l.389–392, 791 | «Antes de 14 out (início das regras): 18 vão para Histórico importado · só resultado.» |
| E42 | Zone line (as built; none when every row states its offset) | IC l.393, 1701 | «Fuso do arquivo: Nova York (ET) · lembrado para Ylos 50k» · «Fuso do arquivo: Nova York (ET) · lembrado de Ylos 50k» |
| E43 | G1 block (amber, `role=status`, 13 px bold), last in the step | IC l.394, 816 | «18 operações caem em dias em que Top One já tem operações de outro formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.» |
| E44 | Primary (as built: `PASSO_D.importN` on `trades_new ?? new`, «Completar…», «Juntar…», «Concluir») | IC l.1903–1906 | «Importar 18 operações» · «Importar 4 operações» |

#### End, errors, account creation, outside the sheet (L2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E45 | «Nada novo» (f) for a mapped file: no zone block and no «Confirmar fuso» (a mapped file never confirms a zone, G2); execution files count «saídas» (N) | — | «Nada novo: as {n} saídas já estão em {conta}.» · «Nada novo: a saída já está em {conta}.» (N) |
| E46 | End lines: as built (`FIM.inHistory` / `linhaImportadas`, completed, linked, agrupadas, anexadas) + the model line + «Desfazer depois…»; toast as built | IC l.591–596, 1619–1620, 1862–1866, 1933–1937 | «Importação feita» · «4 operações em Histórico importado · só resultado, à parte do Diário.» · «2 saídas parciais foram juntadas às suas operações.» · «Modelo “BlackArrow” salvo: os próximos arquivos com estas colunas entram direto.» · «Modelo “BlackArrow” atualizado: os próximos arquivos com estas colunas entram direto.» · «Colunas usadas só neste arquivo.» · «Desfazer depois: Personalizar › Suas contas › Importações.» · toast «4 operações em Lucid 50k.» + «Desfazer»; N on a failed save: «O modelo “{nome}” não foi salvo. As operações já entraram; no próximo arquivo, diga de novo o que é cada coluna.» · «O modelo “{nome}” não foi salvo: já são 50 modelos. As operações já entraram.» · N with no batch (§6.8): «O modelo “{nome}” não foi atualizado: este arquivo não trouxe operações novas.» |
| E47 | Error «Arquivo não reconhecido em binárias» (context Ebinex) | IC l.576–581, 1850 | «Não conseguimos ler o arquivo.» · «Em contas de binárias, lemos só o CSV da Ebinex.» · primary «Escolher outro arquivo» |
| E48 | Error «Planilha do Excel» (built by the domain PR: `spreadsheet`, `ERRO.spreadsheet`; verified here) | IC l.1851 | «Não conseguimos ler o arquivo.» · «Salve como CSV na sua plataforma ou no Excel e tente de novo.» |
| E49 | Error «Arquivo que não abre» = the sniff's `header_not_found`; the sniff's other failures (N) | IC l.1849 | «Não conseguimos ler o arquivo.» · «Não achamos a linha com os nomes das colunas.» · N: «O arquivo passa de 100 colunas.» (`too_many_columns`); `empty_file`, `malformed_csv`, `too_many_rows` as built |
| E50 | «Qual mercado?»: the note «Ainda não lemos arquivos …» no longer shows (every market reads a file) | IC l.1784–1785 | (none) |
| E51 | «Nova conta de …»: «Moeda e virada do dia» for the four new markets, with or without a file | IC l.292, 1359 | as built |
| E52 | «{conta} criada.» (fimConta) for every market: «Registrar operação» (secondary) before «Importar histórico» (primary); MetaTrader 4/5: no «Importar histórico», «Registrar operação» primary, the MetaTrader line; IQ Option as built | IC l.1878–1886, 1923–1927 | «Nada ainda. Importe o histórico ou registre a primeira operação.» · «Importar histórico» · «Registrar operação» · MetaTrader: «Nada ainda. Registre a primeira operação.» + «O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.» (MT4: «O relatório do MetaTrader 4 sai em HTML e vai precisar de um leitor próprio, que vem depois.», as built) |
| E53 | Diário header «Importar arquivo» opens on the current account for every market (A: the 2b gate is lifted) | IC l.248 | as built |
| E54 | Suas contas: «Importar» and the menu's «Importar arquivo» / «Importações» on every account; the group note `CONTAS.semLeitor` never shows; `CONTAS.info` drops «em breve» (A, quadro §4.2) | — | `CONTAS.info`: «… Nas contas de Forex, de Ações, de Cripto e da B3, as operações entram pelo “Registrar operação” e também por um CSV em que você diz o que é cada coluna. …» |
| E55 | Editar conta «Fuso do arquivo» on every market (as built for readers) | — | as built |
| E56 | Registrar «Já fechada» before the account's rules (A, quadro S22) | — | «Antes de {d} esta conta não tinha regras: essas operações entram pela importação de arquivo.» |
| E57 | Background (as built since Phase 3): «Registrar operação» primary, «Importar arquivo», the account menu by market | IC l.243–256 | as built |
| E58 | Copy that must not exist anywhere in the app (stale board copy) | quadro S9, S13, S19 | «Informe por contrato» · «Seguir bruto» · «A conta fica marcada “bruto”» · «CSV, Excel ou HTML» · «Lembrar para os próximos arquivos deste modelo» · «Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.» |

### 2.2 Scenario by scenario

The board's invented world (IC l.1180–1186, D.contas): «hoje» is Thursday 15 Oct 2026. Accounts: Futuros — Top One
(«Top One · Financiada», Top One imports in UTC, rules since 14 out), Apex A (number APX-0001, rules since 14 out), Ylos 50k
(BlackArrow, rules since 14 out), Lucid 50k (Tradovate, rules since 15 out); Opções binárias — Ebinex; Forex — E8 50k
(Match-Trader); Ações — IBKR; Cripto — Binance; B3 — Mini-índice (Profit) (each rules since 15 out). B0's fixtures (§4.3)
rebuild this world. «Counts» below are the database's answers (composed and proven in L2's fixtures, §6.10); every other
number is computed in the browser from the file (B0's board-sized files).

| Scenario · variant | Steps (board fluxo, IC l.1230–1248) | What the app shows (elements) |
|---|---|---|
| 1 · Arquivo da Top One reconhecido | a → c → d → fim (as built) | as built; the card's ⓘ gains its second sentence (E1) |
| 2 · Conta nova a partir do arquivo (Apex A, exemplo) | a → b → c → d → fim | A Rithmic example: the app has no Rithmic reader, so such a file goes through the mapping (8). Stale copy fixed on the board and already true in the app: no «Informe por contrato» / «Seguir bruto» block (E58); a file without commission says «Sem comissão no arquivo: estas operações ficam sem comissão.» (E40, mapped files). Nothing new to build. |
| 3 · Arquivo já importado | f → c → fimFuso (as built) | as built |
| 4 · Operações que já estão em outra conta | d → fim | as built: the count item «em outra conta» (S3); «3 linhas com erro foram puladas.» + «Ver linhas»; «Desfazer depois: Personalizar › Suas contas › Importações.». The board's «Mover para esta conta» / «Deixar onde estão» stays a later step (not built since Phase 1). |
| 5 · Arquivo de binárias na conta de futuros | g → … (as built) | as built |
| 6 · Duas contas no mesmo arquivo (exemplo) | h → grupo → c → d → fim | not built (copy groups, «Criar: Apex B»: deferred since Phase 1); its stale copy is E58 |
| 7 · Adicionar conta sem arquivo | i1 → i2 → (i3) → b → fimConta → solte | as built (i3 is not built, C12, and its Tradovate hint stays out with it: E4, D14, §12) |
| 8 · «Conta sem outro formato» (Ylos 50k, BlackArrow, 18 linhas) | mapa → conferir → c → d → fim | **Card** «Arquivo não reconhecido · 18 linhas». **mapa** (E7–E20): every column «sugerida» (Data/Hora → «Entrada (data e hora)», Papel → «Ativo», C/V → «Lado», Qtd → «Quantidade», Pr. Entrada → «Preço de entrada», Pr. Saída → «Preço de saída», Res. Líq. → «Resultado», Corretagem → «Comissão», Nº Negócio → «ID da operação (evita duplicar)»); «Separador: ponto e vírgula · decimal vírgula» · «Datas: dia/mês»; every chip ✓; notes «Sem hora de saída, …», «Já sugerimos pelo nome de cada coluna. Confira.». «Mudar» → «,» → «Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.» + «Confira como ler o arquivo.». Papel → «Quantidade»: «Esta coluna não parece número.» under Papel, «Quantidade está em mais de uma coluna.», «Ativo · falta», hint «Marque as colunas obrigatórias.». **conferir**: «1 out, 09:34 · MESZ6 · compra · 2 contratos · −US$ 39,98», «1 out, 09:35 · MNQZ6 · venda · 1 contrato · +US$ 8,26», «1 out, 10:31 · MESZ6 · compra · 1 contrato · +US$ 26,26»; «O resultado do arquivo já desconta a comissão?» with «Sim, é líquido» pressed and «Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.»; «Salvar como modelo» ✓, «Nome do modelo» «BlackArrow». **c**: nothing preselected (hint «Escolha um fuso para continuar.»), «No arquivo: entradas 09:31–10:58, sem fuso.», futures band and legend. **d** (Nova York): «18 linhas · 18 novas · 0 já estavam · 0 com erro»; commission line, ⓘ «Bruto +US$ 41,25 · comissões −US$ 26,04.» («Não, é bruto»: «Bruto +US$ 15,21 · comissões −US$ 26,04.» and «18 com resultado diferente do calculado pelos preços: vale o do arquivo.»); «Sem hora de saída, …»; «Antes de 14 out (início das regras): 18 vão para Histórico importado · só resultado.»; «Fuso do arquivo: Nova York (ET) · lembrado para Ylos 50k»; «Importar 18 operações». **fim**: «18 operações em Histórico importado · só resultado, à parte do Diário.», «Modelo “BlackArrow” salvo: os próximos arquivos com estas colunas entram direto.», «Desfazer depois: …»; toast «18 operações em Ylos 50k.» |
| 8 · «Conta que já recebe outro formato» (Top One) | mapa → conferir → c → d → fim | as above with «Nome do modelo» «Minha plataforma» (D1). **c**: UTC preselected (Top One's import zone); «Brasília» → E33 block («… das importações de Top One …») + hint «Use o fuso das importações da conta: UTC.»; back to UTC. **d**: the counts as above, the zone line «Fuso do arquivo: UTC · lembrado para Top One», then the G1 block «18 operações caem em dias em que Top One já tem operações de outro formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.» (`other_source` 18). **fim**: «Modelo “Minha plataforma” salvo: …» |
| 8 · «Performance.csv da Tradovate» (Lucid 50k, 6 linhas) | mapa → conferir → c → d → fim | **mapa**: symbol → «Ativo», qty → «Quantidade», buyPrice → «Preço de compra», sellPrice → «Preço de venda», pnl → «Resultado», boughtTimestamp → «Compra (data e hora)», soldTimestamp → «Venda (data e hora)» (all «sugerida»); duration, buyFillId, sellFillId → «Ignorar esta coluna» «sugerida»; «Separador: vírgula · decimal ponto» · «Datas: mês/dia»; chips «Entrada (pela compra e venda) ✓», «Lado (pela compra e venda) ✓»; notes «Com a compra e a venda em colunas, …», «Sem coluna de ID, …», «“$(13.75)” é perda: lemos como −13,75.», «buyFillId e sellFillId se repetem …», «Já sugerimos …». buyFillId → «ID da operação (evita duplicar)»: «Esta coluna repete valores: não serve de ID.» (the no-ID note goes). **conferir**: «13 out, 11:20 · MESZ6 · venda · 2 contratos · +US$ 37,50», «13 out, 11:20 · MESZ6 · venda · 1 contrato · −US$ 13,75», «13 out, 11:02 · MNQZ6 · compra · 1 contrato · +US$ 7,50»; «A 1ª e a 2ª linhas têm a mesma entrada: viram uma operação com 2 saídas.»; no net question; «Nome do modelo» «Tradovate». **c** «No arquivo: entradas 10:31–11:20, sem fuso.». **d**: «6 linhas · 6 novas · 0 já estavam · 0 com erro»; «2 saídas parciais juntadas às suas operações.»; «Sem comissão no arquivo: estas operações ficam sem comissão.»; «Antes de 15 out (início das regras): 4 vão para Histórico importado · só resultado.»; «Importar 4 operações» (the trades +55,00, +7,50, +17,00, +23,75). **fim**: «4 operações em …», «2 saídas parciais foram juntadas às suas operações.», «Modelo “Tradovate” salvo: …» |
| 9 · Erros | — | «Arquivo que não abre»: E49 «Não achamos a linha com os nomes das colunas.»; «Sem operações»: as built «O arquivo não tem operações.»; «Linhas sem data»: as built (d with «Ver linhas», «Linha 4: data vazia»); «Perdas com valor positivo»: as built; **«Arquivo não reconhecido em binárias»** (context Ebinex): the card «Arquivo não reconhecido · 18 linhas» (E1, from the market-free sniff) above E47; **«Planilha do Excel»**: E48 (no card). Each: primary «Escolher outro arquivo» → «Escolha outro arquivo». |
| 10 · Duplicar conta | — | not built (as before) |
| 11 · Forex numa mesa (FTMO, MetaTrader 5) | i1 → i2 → b → fimConta | i1 without the «Ainda não lemos…» note (E50); b with «Moeda e virada do dia» (as built); **fimConta** «FTMO 100k criada.» «Nada ainda. Registre a primeira operação.» + «O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.»; primary «Registrar operação» (E52) |
| 12 · Cripto (Binance) · 13 · Ações (IBKR) · 14 · B3 (Mini-índice) | i1 → i2 → b → fimConta → solte | **fimConta** «{conta} criada.» «Nada ainda. Importe o histórico ou registre a primeira operação.»; «Registrar operação» before «Importar histórico» (primary) → «Importar histórico de {conta}» (E3, E52) |
| 15 · «As mesmas colunas» (Ylos 50k, model BlackArrow, 24 linhas) | d → fim | **Card** «Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out». No indicator. **d**: E34 «Colunas do modelo “BlackArrow”» + «Mudar colunas»; «24 linhas · 5 novas · 1 já registrada por você · 18 já estavam (mesmo ID) · 0 com erro»; «1 já registrada por você: o arquivo completa a comissão.»; commission line, board ⓘ «Bruto +US$ 62,50 · comissões −US$ 8,68.» (the 6 rows the import inserts or completes; **owner gate §11.0 G1**: the final database does not say which rows those are, so as built the ⓘ sums the whole file, «Bruto +US$ 103,75 · comissões −US$ 34,72.»); «Sem hora de saída, …»; board: no «Antes de…» line (**G1**: as built «Antes de 14 out (início das regras): até 5 vão …»); «Fuso do arquivo: Nova York (ET) · lembrado de Ylos 50k»; «Importar 5 operações». **fim** board «5 operações importadas.» (**G1**: as built «… As de antes de 14 out ficam em Histórico importado · só resultado, à parte do Diário.»), «1 já registrada por você foi completada.», no model line, «Desfazer depois: …». **«Mudar colunas»** starts a new sequence (IC l.1706): mapa «Mude as colunas do modelo “BlackArrow”.» (the model's fields, no tags; «Passo 1 de 3», no «Voltar») → conferir «Atualizar o modelo “BlackArrow”» ✓ (no name field; «Passo 2 de 3», «Voltar» to mapa) → d (no chip; «Passo 3 de 3», «Voltar» to conferir) → fim «Modelo “BlackArrow” atualizado: …». The zone step never shows (the model's zone is the account's). |
| 15 · «Uma coluna a mais» (24 linhas + Estratégia) | mapa → conferir → d → fim | **Card** «Parecido com o modelo “BlackArrow” · 24 linhas». **mapa** «Este arquivo mudou desde o modelo “BlackArrow”. Confira as colunas.»; the model's fields without tags; «Estratégia» «Escolha…» with tag «nova» (ex.: Rompimento); notes «Sem hora de saída, …» (no «Já sugerimos …»). **conferir** «Atualizar o modelo “BlackArrow”» ✓. **d** as «As mesmas colunas» without the chip. **fim** «Modelo “BlackArrow” atualizado: …» |
| 16 · «Tradovate (futuros)» (Lucid 50k, Orders, 11 linhas) | mapa → conferir → c → d → fim | **mapa** «Cada linha do arquivo é» «uma execução (compra ou venda)» pressed; orderId → «ID da execução (evita duplicar)», Account → «Conta», B/S → «Lado», Contract → «Ativo», Fill Time → «Data e hora», Filled Qty → «Quantidade», Avg Fill Price → «Preço» (all «sugerida»); avgPrice, filledQty, Status, Timestamp, Quantity, Limit Price → «Ignorar esta coluna» «sugerida»; «Separador: vírgula · decimal ponto» · «Datas: mês/dia»; notes 1 (execution), 4 (Futuros), 8. **conferir** «Data e hora · Ativo · Lado · Quantidade · Preço»; «13 out, 10:31 · MESZ6 · compra · 2 contratos · 6.812,25», «13 out, 10:38 · MESZ6 · venda · 1 contrato · 6.816,00», «13 out, 10:44 · MESZ6 · venda · 1 contrato · 6.819,50» (the cancelled line 3 is not an execution); «Confira: a quantidade é a executada …», «Supomos que o arquivo começa sem posição aberta.»; E25 «Viram 4 operações: 2 com uma saída e 2 com saídas parciais.», «1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.816,00 e de 1 a 6.819,50: +US$ 55,00.», «1 posição com mais de uma entrada virou 2 operações, uma por entrada.», «Ver as 4 operações» → the four items of IC l.878–881; «Nome do modelo» «Tradovate». **c** «No arquivo: execuções 10:31–11:31, sem fuso.». **d** «9 execuções no arquivo»; «6 saídas · 6 novas · 0 já estavam»; «As 6 saídas viram 4 operações.», «2 saídas parciais juntadas às suas operações.», «2 ordens sem execução ficaram de fora.»; «Sem comissão no arquivo: …»; «Antes de 15 out …: 4 vão …»; «Importar 4 operações». **fim** as 8 · Performance with «Modelo “Tradovate” salvo: …» |
| 16 · «Tradovate, termina posicionado» (13 linhas) | mapa → conferir → c → d → fim | **conferir**: notes «Confira: …», «Em MNQZ6, supomos que o arquivo começa sem posição aberta.»; E24 «No fim do arquivo, MESZ6 ficou posicionado?» / «Pelas execuções do arquivo, sobra 1 contrato vendido.» / «Não sei» pressed / nota «As 7 execuções de MESZ6 ficaram de fora: …»; E25 per answer (IC l.1140–1147): «Não sei» «Viram 2 operações: 2 com uma saída.» (MNQ only); «Sim» the four operations + nota «A posição ainda aberta fica de fora (1 execução) e entra …»; «Não» «Viram 5 operações: 4 com uma saída e 1 com saídas parciais.», «1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.819,50 e de 1 a 6.821,00: +US$ 80,00.» + nota «O arquivo começou com 1 contrato comprado, de antes dele: a venda que o fecha fica de fora.». **c** «No arquivo: execuções 10:31–11:48, sem fuso.». **d** «10 execuções no arquivo»; «Não sei»: «2 saídas · 2 novas · 0 já estavam», «As 2 saídas viram 2 operações.», «3 ordens sem execução ficaram de fora.», leftovers «As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.» + «Ver linhas» (lines 2, 4, 5, 10, 11, 12, 13 «as compras e as vendas do ativo não fecham no arquivo»), «Importar 2 operações»; «Sim»: «6 saídas · 6 novas · 0 já estavam», «As 6 saídas viram 4 operações.», «2 saídas parciais …», «3 ordens …», «1 execução de posição ainda aberta no fim do arquivo ficou de fora. Ela entra …» («Linha 13: posição ainda aberta no fim do arquivo»); «Não»: «6 saídas · 6 novas · 0 já estavam», «As 6 saídas viram 5 operações.», «1 saída parcial juntada à sua operação.», «3 ordens …», «1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.» («Linha 4: fecha uma posição aberta antes do começo do arquivo»), «Importar 5 operações» |
| 16 · «Binance (cripto)» (Binance, 8 linhas) | mapa → conferir → d → fim (no c) | **mapa**: Date(UTC) → «Data e hora», Pair → «Ativo», Side → «Lado», Price → «Preço», Executed → «Quantidade», Fee → «Comissão», Trade ID → «ID da execução …» («sugerida»); Amount «Escolha…»; «Separador: vírgula · decimal ponto» (no «Datas»); notes 1, 4 (Cripto), «A coluna Date(UTC) já diz o fuso: os horários entram em UTC.», 8. **conferir**: «11 out, 00:05 · BTCUSDT · compra · 0,0125 BTC · 112.400,00», «11 out, 00:20 · ETHUSDT · compra · 0,1000 ETH · 4.120,50», «11 out, 00:21 · BTCUSDT · venda · 0,0125 BTC · 112.952,00»; «Em BTCUSDT, supomos …»; «No fim do arquivo, ETHUSDT ficou posicionado?» / «Pelas execuções do arquivo, sobram 0,1 ETH comprados.»; E25 per answer (IC l.928–934, 1099–1103): «Não sei» «Viram 2 operações: 1 com uma saída e 1 com saídas parciais.» (BTCUSDT 11 out 00:05 +US$ 6,90; 12 out 14:05 «saídas de 0,0100 a 113.420,00 e de 0,0100 a 113.005,00 · +US$ 0,65») + nota «As 3 execuções de ETHUSDT ficaram de fora: …»; «Sim» «Viram 3 operações: 2 com uma saída e 1 com saídas parciais.» (+ «11 out, 00:20 · ETHUSDT · compra de 0,1000 a 4.120,50 · saída de 0,1000 a 4.135,00 · +US$ 1,45») + nota «A posição ainda aberta fica de fora (1 execução) e entra …»; «Não» the same count (+ «11 out, 01:02 · ETHUSDT · venda de 0,1000 a 4.135,00 · saída de 0,1000 a 4.108,00 · +US$ 2,70») + nota «O arquivo começou com 0,1 ETH vendidos, de antes dele: a compra que fecha essa venda fica de fora.»; «1ª operação: BTCUSDT, compra de 0,0125 a 112.400,00; saída de 0,0125 a 112.952,00: +US$ 6,90.» in all three; «Nome do modelo» «Binance». **d** «8 execuções no arquivo»; «Os horários já trazem o fuso (UTC).» the last of E37's lines (before the leftovers); no zone line. «Não sei»: «3 saídas · 3 novas · 0 já estavam», «As 3 saídas viram 2 operações.», «1 saída parcial juntada à sua operação.», leftovers «As 3 execuções de ETHUSDT ficaram de fora: as compras e as vendas do arquivo não fecham.» (lines 3, 5, 6), ⓘ «Bruto +US$ 7,55 · comissões −US$ 2,82.», «1 operação fica sem comissão: a taxa veio em BNB.», «1 operação fica em outro dia que o do arquivo: o dia de Cripto vira à meia-noite de Brasília.», «Antes de 15 out …: 2 vão …», «Importar 2 operações». «Sim»: «4 saídas · 4 novas · 0 já estavam», «As 4 saídas viram 3 operações.», «1 saída parcial …», leftovers «1 execução de posição ainda aberta no fim do arquivo ficou de fora. …» («Linha 6: posição ainda aberta no fim do arquivo»), ⓘ «Bruto +US$ 9,00 · comissões −US$ 2,82.», «2 operações ficam sem comissão: a taxa veio em BNB.», «2 operações ficam em outro dia …», «… 3 vão …», «Importar 3 operações». «Não»: «4 saídas · 4 novas · 0 já estavam», «As 4 saídas viram 3 operações.», «1 saída parcial …», leftovers «1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.» («Linha 3: fecha uma posição aberta antes do começo do arquivo»), ⓘ «Bruto +US$ 10,25 · comissões −US$ 3,64.», «1 operação fica sem comissão: a taxa veio em BNB.», «2 operações ficam em outro dia …», «… 3 vão …», «Importar 3 operações» |
| 16 · «Interactive Brokers (ações)» (IBKR, 8 linhas) | mapa → conferir → c → d → fim | **mapa**: Symbol → «Ativo», DateTime → «Data e hora», Quantity → «Quantidade», TradePrice → «Preço», IBCommission → «Comissão», Open/CloseIndicator → «Abre ou fecha», TradeID → «ID da execução …»; AssetClass «Escolha…»; chip «Lado (ou quantidade com sinal) ✓»; notes 1, «Sem coluna de lado: quantidade positiva é compra, negativa é venda.», 4 (Ações), 8. **conferir**: «14 out, 09:45 · MSFT · venda · 50 ações · 512,30», «14 out, 10:15 · NVDA · compra · 300 ações · 187,42», «14 out, 10:33 · NVDA · venda · 300 ações · 188,10»; only «Confira: …» (no end-of-file question: «Abre ou fecha»); E25 «Viram 2 operações: 1 com uma saída e 1 com saídas parciais.», «1ª operação: NVDA, compra de 300 a 187,42; saída de 300 a 188,10: +US$ 204,00.», «Ver as 2 operações». **c** «No arquivo: execuções 09:45–15:35, sem fuso.». **d** «8 execuções no arquivo»; «3 saídas · 3 novas · 0 já estavam»; «As 3 saídas viram 2 operações.», «1 saída parcial juntada à sua operação.»; leftovers «3 execuções ficaram de fora.» (lines 2 «fecha uma posição aberta antes do começo do arquivo», 7 «opção, fica de fora (registre no Registrar)», 9 «posição ainda aberta no fim do arquivo»); ⓘ «Bruto +US$ 283,00 · comissões −US$ 5,00.» (**domain**; board 6,00); «Importar 2 operações» |
| 16 · (N, no board) «termina posicionado» read by the saved model «Tradovate» (Lucid 50k after 16 Tradovate's import; owner test step 4) | conferir → d → fim (no c: the model's zone is the account's) | **Card** «Modelo “Tradovate” · Futuros · 13 linhas · 13 out». **conferir** first (an exact model that still asks, §6.2 step 3): E34 «Colunas do modelo “Tradovate”» + «Mudar colunas» in place of E27; the rows, notes, E24 and E25 as 16 «termina posicionado»; «Usar estas colunas» → d with the chip; fim without a model line (a touch). |
| 17 · Duas contas no arquivo (NinjaTrader, Apex A, 57 linhas) | mapa → conferir → hc → c → d → fim | **mapa**: Trade number «Escolha…»; Instrument → «Ativo», Account → «Conta», Market pos. → «Lado», Qty, Entry price, Exit price, Entry time → «Entrada (data e hora)», Exit time → «Saída (data e hora)», Profit → «Resultado», Commission → «Comissão»; «Separador: vírgula · decimal ponto» · «Datas: mês/dia»; notes «Sem coluna de ID, …», «Já sugerimos …». **conferir**: «1 out, 09:31 · MNQ 12-26 · venda · 1 contrato · +US$ 17,00», «1 out, 09:52 · MES 12-26 · compra · 2 contratos · +US$ 62,50», «1 out, 10:15 · MNQ 12-26 · compra · 1 contrato · −US$ 17,50»; «Não, é bruto» pressed + «Conferido pelos preços na 1ª linha: +US$ 17,00 antes da comissão de US$ 1,24.»; «Nome do modelo» «NinjaTrader». **hc** E30: «APX-0001 · 31 op.» «Importar em Apex A», «APX-0002 · 26 op.» «Não importar»; switch APX-0002 to «Importar em Apex A» → APX-0001 «Não importar», aviso «O número na plataforma de Apex A é APX-0001.», live line. **c** «No arquivo: entradas 09:31–11:58, sem fuso.». **d** «57 linhas · 31 novas · 26 não importadas (APX-0002) · 0 já estavam · 0 com erro»; «Ativos escritos como “MNQ 12-26” e “MES 12-26” ficam como “MNQZ26” e “MESZ26”.»; ⓘ «Bruto +US$ 186,50 · comissões −US$ 44,64.» («Sim»: «Bruto +US$ 231,14 …» + «31 com resultado diferente …»); «Antes de 14 out …: 31 vão …»; «Importar 31 operações». APX-0002 instead: «57 linhas · 26 novas · 31 não importadas (APX-0001) …», «Bruto +US$ 141,25 · comissões −US$ 37,20.» (Sim: 178,45 + «26 com resultado diferente …»), «Antes de 14 out (início das regras): 26 vão para Histórico importado · só resultado.», «Importar 26 operações»; **fim** «26 operações em Histórico importado · só resultado, à parte do Diário.» (IC l.998–1007: every APX-0002 entry is before 14 out too) |
| 18 · «Datas claras» (E8 50k, 14 linhas) | mapa → conferir → c → d → fim | **mapa**: Position ID → «ID da operação …», Open Time → «Entrada …», Close Time → «Saída …», Symbol, Side, Volume → «Quantidade», Open Price, Close Price, Swap → «Swap ou funding», Commission → «Comissão», Profit → «Resultado»; «Datas: dia/mês»; opcionais with «Swap ou funding»; note 8. **conferir**: «14 out, 08:40 · EURUSD · compra · 0,50 lote · +US$ 57,50», «14 out, 09:12 · EURGBP · venda · 0,25 lote · +US$ 19,84», «13 out, 17:48 · EURUSD · venda · 1,00 lote · −US$ 35,00»; «O resultado do arquivo já tem a comissão e o swap?» with «Não, é bruto» + «Conferido pelos preços na 1ª linha: +US$ 57,50 antes da comissão de US$ 3,50.»; «Nome do modelo» «Match-Trader». **c** Forex legend, no band, «No arquivo: entradas 06:05–17:48, sem fuso.». **d** «14 linhas · 14 novas · 0 já estavam · 0 com erro»; ⓘ «Bruto +US$ 212,40 · comissões −US$ 40,25.» («Sim»: «Bruto +US$ 258,85 …» + «12 com resultado diferente …»); «1 operação com swap: ele entra no resultado, antes da comissão.»; Nova York: «1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.»; «Outro» → Chicago: the same line with **1** (**domain**; board 2); UTC: no day line; «Antes de 15 out …: 14 vão …» |
| 18 · «Datas ambíguas» | the same | **mapa**: E11 «As datas podem ser dia/mês ou mês/dia. Qual é?» «dia/mês (09.10 = 9 out)» «mês/dia (09.10 = 10 set)», no «Datas» chip, hint «Escolha a ordem das datas.»; after «dia/mês»: chip «Datas: dia/mês», no hint |
| 19 · «Com resultado e custos» (no account, Mini-índice, 18 linhas) | solte → a2 → mapa → conferir → c → d → fim | **solte** «Escolha o arquivo». **a2** card «Arquivo não reconhecido · 18 linhas» (E1); E5 (Futuros: Top One, Apex A, Ylos 50k, Lucid 50k, in this order · Forex: E8 50k · Ações: IBKR · Cripto: Binance · B3: Mini-índice), «Passo 1 de 5», hint «Escolha a conta.»; Mini-índice → Continuar. **mapa**: Emolumentos → «Outra taxa (soma na comissão)» «sugerida» (the rest as 8); «Separador: ponto e vírgula · decimal vírgula» · «Datas: dia/mês»; notes «Sem hora de saída, …», «Decimal vírgula pelos valores como “88,50”: “131.250” é 131250.», «Já sugerimos …»; E18 «2 linhas trazem “X” na coluna de lado. O que quer dizer?» + hint «Diga o que quer dizer “X”.». **conferir**: «14 out, 10:02 · WINZ26 · venda · 3 contratos · +R$ 88,50», «14 out, 10:15 · WINZ26 · compra · 2 contratos · −R$ 31,00», «14 out, 11:20 · WDOX26 · compra · 1 contrato · +R$ 64,25»; «Sim, é líquido» + «Conferido pelos preços na 1ª linha: +R$ 90,00 − R$ 1,50 = +R$ 88,50.»; «Nome do modelo» «Profit (Nelogica)». **c** B3 band «pregão 09:00–18:30», «Faixas no relógio de Brasília.», «No arquivo: entradas 10:02–16:40, sem fuso.», captions «… de Brasília». **d** «18 linhas · 16 novas · 0 já estavam · 2 com erro»; «2 linhas com erro foram puladas.» + «Ver linhas» («Linha 9: preço fora do passo do WIN (de 5 em 5)», «Linha 15: lado desconhecido»); ⓘ «Bruto +R$ 412,00 · comissões −R$ 22,50.» («Não»: «Bruto +R$ 389,50 …» + «16 com resultado diferente …»); «Sem hora de saída, …»; «Antes de 15 out …: 16 vão …»; «Fuso do arquivo: Brasília · lembrado para Mini-índice»; «Importar 16 operações». «Pular essas linhas»: «18 linhas · 14 novas · 0 já estavam · 4 com erro» (lines 6, 9, 11, 15), ⓘ «Bruto +R$ 413,00 · comissões −R$ 21,60.» («Não»: 391,40) |
| 19 · «Só preços» | the same | **mapa**: «Separador: ponto e vírgula» · «Datas: dia/mês»; E12 «Como ler os números deste arquivo?» with «“131.250” é 131250 (ponto separa milhar)» pressed; «“131.250” é 131,25 (ponto é decimal)» → nota «Com este decimal, o WIN fica fora do passo (de 5 em 5). Confira.» + hint «Confira como ler o arquivo.»; notes 4 (B3), 5, 8; E18 as above. **conferir** «Entrada · Ativo · Lado · Quantidade · Resultado (pelos preços)»; «14 out, 10:02 · WINZ26 · venda · 3 contratos · +R$ 90,00 pelos preços» …; no net question. **d** as above without the commission line: «Sem comissão no arquivo: …», «Sem hora de saída, …» |
| Background | — | as built (E57); the account menu lists the accounts by market |

### 2.3 Board vs specs: every disagreement (the board wins), and the as-built rules the PR keeps

| # | Topic | Specs | Board (built) |
|---|---|---|---|
| D1 | Default «Nome do modelo» | the account's platform label, else «Minha plataforma» (sintese §1.1) | the account's platform label, **except a reader's platform** (Top One, Ebinex) or an unknown one (`naosei`, `outra`, none) → «Minha plataforma» (8 · Top One) |
| D2 | Tradovate Performance.csv (buy and sell in columns) | deferred (C13, C14, §1.2) | drawn and approved (choice 1); the domain reads it (`buy_time`/`sell_time`/`buy_price`/`sell_price`) |
| D3 | Pre-fill | fields only, tag «sugerida» (D4) | also «Ignorar esta coluna» + «sugerida» on twins and known non-field columns (16 Tradovate, 8 Performance); «Escolha…» elsewhere (§5.3) |
| D4 | conferir rows of an execution file | «the first three rows» | the first three **executions** (IC l.869: the cancelled line 3 is skipped) |
| D5 | Execution counts | C24: «{n} execuções no arquivo» apart from the database's counts | the same, plus: never «com erro»; leftovers in their own block (choice 2) |
| D6 | G2 refusal | the as-built `tz_mismatch` alert after the preview | refused **on the zone step**, as soon as the zone is picked: amber block + blocked footer (IC l.357, 1284, 1902); the block's first sentence «Este fuso é diferente do fuso das importações desta conta.» for confirmed and unconfirmed accounts alike |
| D7 | «Para qual conta?» for an unrecognised file | as built `a`: a preselected account | nothing preselected; «Escolha a conta.» (IC l.1914) |
| D8 | «N contas neste arquivo» | D8 | as drawn: «Escolhemos pelo número na plataforma de cada conta.», the warning when another value goes to the account (choice 6) |
| D9 | conferir quantities | Registrar's units («ct», «lote», …) (D9) | «2 contratos» / «1 contrato», «0,50 lote» / «2,00 lotes», «50 ações» / «1 ação», «0,0125 BTC» (IC l.1565–1574) |
| D10 | Side «X» | «O que quer dizer “{valor}”?» | «2 linhas trazem “X” na coluna de lado. O que quer dizer?» with «Pular essas linhas»; skipped and empty sides read «lado desconhecido» (the readers' «direção desconhecida» stays for Ebinex and Top One) |
| D11 | Duplicates without an ID | «já estavam (mesma hora e preço)» (D23) | draws only 0 («já estavam»): the spec's word is kept for a count above 0 (N) |
| D12 | Offsets line | as built «Os horários já trazem o fuso (+00:00).» | «Os horários já trazem o fuso (UTC).» for a mapped file (+00:00 → «UTC»; readers unchanged) |
| D13 | Preview order | as built | avisos → leftovers → commission → «depois» lines → «Antes de…» → zone line → G1 (IC l.365–394); for reader files this is the as-built order |
| D14 | The Tradovate hint | i3 «Como as operações chegam?» is out of 3b (C12); «Nothing ships in 3b (it lives in i3)» (C13) | drawn only in i3 (scenario 7, IC l.514, 1823–1832), which stays out: **not built** (§12) |
| D15 | Day lines | futures and binaries only (as built) | «… o dia de Forex vira às 17:00 de Nova York.», «… o dia de Cripto vira à meia-noite de Brasília.» (IC l.936, 1038); Ações and B3 from quadro §4.3 (A) |
| D16 | The card's ⓘ | as built (one sentence) | two sentences (`D.infoArq`, IC l.623) |
| D17 | Execution leftovers headline | D27's plural | the board's singulars, «As {n} execuções de {ativo} …», «{n} execuções ficaram de fora.» (mixed); plurals of the others N |
| D18 | Net question evidence | prices − costs + swap | «… = …» for net, «… antes da comissão de …» for gross (IC l.1083, 1114, 1118, 1124) |
| D19 | Zone step of a mapped file | as built: bars per row, «No arquivo: entradas {p10–p90}» (the usual hours) | bars per trade (8 · Performance: one unit at 10:30, three at 11:00 for its 6 rows: IC l.1133 `{21: 33, 22: 100}`) or per execution; spans from the first to the last entry (16ta «execuções 10:31–11:48», 18 «entradas 06:05–17:48»: unreachable by p10–p90 with the files' other numbers). Built so for mapped files (§6.5); readers keep the as-built rule |
| D20 | An exact model that still needs an answer | sintese: an exact model goes straight to «Prévia» | the board's 15 asks nothing; owner decision 3 asks the end-of-file question per symbol, every time (R1 keeps the answer out of the model): such a file starts on «conferir» with the chip (N, §6.2 step 3), and one with a new side word or a failing column check on «mapa» |

**Two numbers follow the domain** (owner told in the PR body, §11.1 #1–#2): IBKR «Bruto +US$ 283,00 · comissões −US$ 5,00.»
(the file's imported executions: NVDA 1,50 + 1,50, AAPL 1,00 + 0,60 + 0,40; the left-out MSFT, option and TSLA costs are
not imported; board 6,00); Forex with Chicago: «1 operação fica em outro dia que o do arquivo: …» (17:00 New York rule; board
2).

**Where the board cannot be reproduced on the final database (owner gate §11.0 G1, asked before B0):** scenario 15's board
has no «Antes de…» line, ends at «5 operações importadas.» and shows the ⓘ of the 6 rows it inserts or completes («+US$ 62,50
· −US$ 8,68»). The as-built `linhaAntesDasRegras` / `linhaImportadas` and the `commission_in_file` notice count every row of
the file, and the file also holds the 18 rows of 1–13 out already imported: neither `import_preview` (525a7da: counts,
`first_day`/`last_day` over every row without an error) nor `import_commit` says which rows are new, so the browser gets «até
5 vão …», «… As de antes de 14 out ficam …» and «Bruto +US$ 103,75 · comissões −US$ 34,72.». The lanes build whichever the
owner picks (§11.0).

### 2.4 Element → implementation map

Copy files: **L1** `app/components/hub/importar/copyMapa.ts` (new: `MAPA`, `LER`, `CAMPO`, `REQ`, `NOTA_MAPA`, `CHECAGEM`,
`PERGUNTA`, `DICA_MAPA`, `CONFERIR`, `FIM_ARQUIVO`, `PAREAMENTO`, `LIQUIDO`, `MODELO`, `CHIP_MODELO`); **L2**
`app/components/hub/contas/copy.ts` (additions: `ARQUIVO`, `PASSO_A2`, `PASSO_HC`, `PASSO_C`, `PASSO_D`,
`PASSO_F`, `FIM_MODELO`, `ERRO`, `ERROR_TEXT`, `rowErrorReason`, `CONTAS.info`, `FIM_CONTA`) and one string of
`app/components/hub/registrar/copy.ts`. Layout: the sheet is 480 px wide above 640 px and the whole width with 16 px gutters
at ≤ 640 px (as built, hub.css); «at three widths» = 375, 768, 1280.

| Id | Lane | File · component | Reads / writes | Copy keys | Keyboard · a11y · layout |
|---|---|---|---|---|---|
| E1 | L2 | `ImportSheet.tsx` (file card, as built) + `lib/hub/importPrevia.ts` `linhaDoArquivoMapeado(arquivo, inicial: Mapeamento \| null, market: AccountMarket \| null)` | with a Mapeamento (the one `iniciarMapeamento` returned, kept in `Flow.mapeado.cartao`): `porModelo` → «Modelo …» (its rows' days and count), else a model match → «Parecido com …», else «Arquivo não reconhecido»; without one (a2, the binaries error): `sniffFile(arquivo.text)` with no market, `records.length` (no card when it fails) | `ARQUIVO.naoReconhecido`, `.parecido`, `.doModelo`, `.info` (B, two sentences) | as built; text wraps |
| E2 | L2 | `flow.ts` (`COUNTED`, `ahead`) | `Mapeamento`, `planoMapeado` (§6.3) | `FOLHA.step` | as built |
| E3 | L2 | `passos.tsx` `PassoSolte` (as built) | — | `SOLTE.*` | as built |
| E5–E6 | L2 | `PassoContaArquivo.tsx` (new) | `useAccounts().active`, `MARKET_SPEC[m].mapping`; writes `flow.choice` | `PASSO_A2.*`, `MARKET_LABEL` | `span.hub-rotulo#a2-g{k}`, `role=group aria-labelledby`, pills `aria-pressed` 44 px; groups stack; pills wrap at 375 |
| E7–E20 | L1 | `PassoMapa.tsx` (B0 placeholder → L1) + `lib/hub/importMapaVista.ts` `vistaMapa` + `lib/hub/importMapeado.ts` (edits) | `Mapeamento` (writes it through `onChange`), `ArquivoMapeavel.text` (re-read on «Separador»), market | `MAPA`, `LER`, `CAMPO`, `REQ`, `NOTA_MAPA`, `CHECAGEM`, `PERGUNTA`, `DICA_MAPA` | §5.7 |
| E21–E29 | L1 | `PassoConferir.tsx` (B0 placeholder → L1) + `vistaConferir` | `Mapeamento`, `arquivoDoMapeamento({...m, accountValue: null}, market, null)` (every account's rows, so the end-of-file answers are always given under the all-accounts keys, §6.7; positions, notices, end-of-file questions) | `CONFERIR`, `FIM_ARQUIVO`, `PAREAMENTO`, `LIQUIDO`, `MODELO` | §5.7 |
| E30 | L2 | `PassoContasDoArquivo.tsx` (new) + `importPrevia.ts` `contasDoArquivo`, `valorPreSelecionado` | `Mapeamento` (writes `accountValue` only), the account (`label`, `external_ref`), the model's `accountRoutes` | `PASSO_HC.*` | rows `.hub-conta-linha` (text 13 px `flex 1 1 150px` + `select.hub-sel` `flex 1 1 170px`); stacked at 375; select 44 px; aviso `.hub-bloco--atencao`; live line in the sheet's status |
| E31–E33 | L2 | `passos.tsx` `PassoFuso` (widened to every market, props §6.5) + `importPrevia.ts` `relogioDoMercado`, `mostrarFuso`, `fusoPreSelecionado`, `recusaLocal`, `linhasDoFuso`, `faixaToda` | the `ImportFile` (a reader's rows; a trade file's `positions`; an execution file's `executionTimes`), the account, `useImportFormats`, the model's `tzHint` | `PASSO_C.*` | as built (radios, select); the refusal block after the legend, `aria-describedby` of the primary = `dica-pri` |
| E34 | L1 (component, and its place on conferir) / L2 (its place on d) | `ChipModelo.tsx` (B0 placeholder → L1), rendered by L2's `PassoPrevia` and by L1's `PassoConferir` (prop `onMudarColunas`) | `nome`, `onMudar` | `CHIP_MODELO.texto`, `.mudar` | `.hub-ler` row: chip + `.hub-btn` 44 px; wraps |
| E35–E44 | L2 | `PassoPrevia.tsx` (new file: the as-built `PassoPrevia`, `Count`, `ErrorLines`, `SkippedLines` moved out of `passos.tsx`, re-exported from it) + `importPrevia.ts` `linhasDaPrevia` | `ImportPreviewResult` (+ `duplicate_same`, `other_source`), the `ImportFile`, `Mapeamento` | `PASSO_D.*`, `rowErrorReason` | as built; G1 `div.hub-bloco--atencao role=status` 13 px bold, last |
| E45 | L2 | `passos.tsx` `PassoNadaNovo` (+ props `mapeado`, `unidade`) | preview | `PASSO_F.*` | as built |
| E46 | L2 | `ImportSheet.tsx` (`fim`) | `ImportCommitResult`, the model save's outcome | `FIM.*`, `FIM_MODELO.*` | as built |
| E47–E49 | L2 | `passos.tsx` `PassoErro` (+ prop `motivo`) | route, sniff failure | `ERRO.*` | as built |
| E50–E52 | L2 | `passos.tsx` `PassoMercado` (+ prop `mercados`), `ImportSheet.tsx` (`b`, `fimConta`) | `MARKET_SPEC`, the created account's `platform` | `PASSO_I1`, `FIM_CONTA` | as built |
| E53–E56 | L2 | `DiarioCabecalho.tsx`, `SuasContas.tsx`, `EditarConta.tsx`, `contas/copy.ts`, `registrar/copy.ts` | `MARKET_SPEC[m].reader \|\| MARKET_SPEC[m].mapping` | `CONTAS.info`, `ERROS_PRECOS.antesRegras` | as built |
| E58 | both | a test per lane over its copy files | — | — | — |

---

## 3. Data: what the screens read and write (`fase-3b/dominio` 4541996 and `fase-3b/banco` 525a7da, final)

### 3.1 Reads

| Read | Function | Gives |
|---|---|---|
| A dropped or chosen file | `readImportFile(file)` (as built) | `{fileName, size, sha256, outcome}`; `outcome.error` `unknown_format` / `missing_columns` / `duplicate_columns` are the mapping's candidates; `spreadsheet`, `too_large`, `malformed_csv`, `too_many_rows`, `empty_file` stay errors (as built) |
| The text again | `lerArquivoMapeavel(file, lido)` (B0) | `ArquivoMapeavel` (`decodeCsvBytes` of the bytes; never logged) |
| Where it goes | `routeFile(cabecalhoDoLeitor(arquivo), market)` (B0): the header the readers saw, i.e. the first record of the **comma** read `parseImportText` made (`readCsv(text, {maxRecords: MAX_RECORDS + 1})[0].cells`; that read already succeeded, since its failures are `malformed_csv` / `too_many_rows`), never the sniffed header (a «;» Top One export sniffed as «;» would route to `'reader'`, which the comma reader cannot read) | `'reader' \| 'reader_error' \| 'mapping' \| 'binary_error'` |
| The user's models | `fetchTemplates(db)` (L2, new in `contasDb.ts`) via `useImportTemplates()` (L2, `useContas.ts`) | `Template[]` (`templateFromRow`; rows it cannot use dropped); a failed read counts as `[]` (§10.2) |
| Accounts in use | `useImportFormats()` (as built: standing batches' platforms per account), `useAccounts()` | the G2 «import zone» of an account (§6.5) |
| Rules | `useRulesConfig()` (as built) | «Antes de {d}…», «{n} operações importadas…» (as built) |
| The mapping | domain `@/lib/domain/import`: `sniffFile`, `matchTemplate`, `templateMisfits`, `columnsFromTemplate`, `suggestColumns`, `suggestRowKind`, `fieldsFor`, `requirementsOf`, `missingRequirements`, `mappingProblems`, `hasBuySellPair`, `columnCheck`, `quantityIsSigned`, `unknownSideWords`, `sniffDecimalMark`, `sniffDateOrder`, `decimalEvidence`, `parseAmountCell`, `readDateTime`, `readSide`, `readSymbol`, `normaliseFuturesSymbol`, `headerClocks`, `mappedContext`, `netQuestion`, `netAsked`, `parseMappedRecords`, `endOfFileKey`, `accountKey`, `accountRouteHash`, `templatePayload`, `checkTemplate`, `MAX_TEMPLATE_NAME`, `buildImportArgs`, `previewArgs`; `@/lib/domain/registro` `tradeInstrument`, `tradeMatchKey` (the tick text) | `MappedFile`: `rows`, `errors`, `warnings`, `notices`, `records`, `countUnit`, `needsFileTz`, `fileTzHint`, `notImported`, `executions`, `unfilled`, `executionTimes`, `endOfFile`, `positions`, `format` |

`MappedFile.notices` the screens use: `file_has_offset {offsets, rows}`, `commission_in_file {gross, commission}`,
`result_net_converted` (no line: the as-built commission line says it), `symbol_normalised {rows, symbols}`, `identical_rows
{rows}`, `swap_in_result {rows}`, `commission_other_asset {trades, assets}`, `unfilled_orders {rows}`, `split_entries
{positions, trades}`, `flat_start_assumed {symbols}`. Not shown in 3b (§12): `merged_fills`, the partial notices
`opened_before_file {fills}`, `open_at_end {fills}`, `no_price_result {fills}`. `warnings` used: `result_differs_from_prices`.

### 3.2 Writes (as built: no retry; a failure shows the sheet's alert and keeps the step)

| Button | Call | Args | Answer |
|---|---|---|---|
| «Continuar» on «Prévia»'s way (c, or the step before d) | `importPreview(db, previewArgs(buildImportArgs({accountId, platform: 'modelo', fileName, sha256, fileTz, outcome: mappedFile})))` (as built) | `p_platform 'modelo'`, `p_format {sig, template}` (built by `buildImportArgs` from `MappedFile.format`), `p_rows`, `p_errors`, `p_rows_total` | `ImportPreviewResult` + (3b) `duplicate_same?` (only > 0), `other_source?` (only > 0); `tz_status` `'tz_mismatch'` for a zone the account refuses (a mapped file never gets `tz_not_confirmed`) |
| «Importar {n} operações» (and «Completar…», «Juntar…») | `importCommit(db, args)` (as built), with the zone the preview used | the same as the preview + `p_file_name` | `ImportCommitResult` + `duplicate_same?` |
| (after a commit, no button) | `saveTemplate(db, payload, batchId, replaces)` (L2, new: rpc `import_template_save`) | `modeloASalvar(m, …).payload` (§4.1): `p_template` (JSON v1), `p_batch` = the commit's `batch_id` (none: §6.8's no-batch rule, never a route without a batch), `p_replaces` = the model's id for «Atualizar o modelo» | `{template_id, header_sig, created}` |
| «Desfazer» (toast) | `importUndo` (as built) | — | the model stays (C25) |

### 3.3 Error codes → screen

| Code | Where | Text |
|---|---|---|
| `bad_format` (preview/commit) | sheet alert (`ERROR_TEXT`, N) | «Não conseguimos ler o formato deste arquivo. Tente de novo.» |
| `tz_mismatch` (preview `tz_status`, or commit) on a mapped file | back on the zone step (or stays there) with E33's block for that zone, never the alert | E33 |
| `wrong_market` (as built) | sheet alert, as built | «Este arquivo é de outro mercado.» |
| `bad_template`, `too_many_templates`, `unknown_template`, `unknown_batch` from `import_template_save` | the end's model line (E46 N), never the alert | «O modelo “{nome}” não foi salvo. …» / «… já são 50 modelos. …» |
| the same codes reaching `ERROR_TEXT` anywhere else (N) | sheet alert | `bad_template` «O modelo de colunas não pôde ser salvo.» · `too_many_templates` «Você já tem 50 modelos de colunas.» · `unknown_template` «Este modelo de colunas não foi encontrado.» |
| row codes in `preview.errors` (lines) | «Linha {n}: {motivo}» (E38) | as built `rowErrorReason` + (N, L2) `no_price_result` «sem resultado: este ativo não tem conta pelos preços» · `not_dollar_quote` «par fora do dólar (USDT, USDC ou USD)» · `bad_option` «opção, fica de fora (registre no Registrar)» (B) · `off_tick` «preço fora do passo do {raiz} (de {passo} em {passo})» (B; the root and tick from the record's symbol, browser only; without a tick: «preço fora do passo do ativo») · `missing_price` «execução sem preço» · `open_at_end` «posição ainda aberta no fim do arquivo» (B) · `opened_before_file` «fecha uma posição aberta antes do começo do arquivo» (B) · `unbalanced_symbol` «as compras e as vendas do ativo não fecham no arquivo» (B) · `symbol_has_error` «outra execução do ativo tem erro» · `position_too_large` «operação grande demais para guardar» · `bad_direction` on a mapped file «lado desconhecido» (B; readers keep «direção desconhecida») · `bad_number` on a mapped file, whose `column` is a `FieldKey` (a price, money or cost field: `entry_price`, `exit_price`, `buy_price`, `sell_price`, `pnl`, `commission`, `fee`, `swap`, `stop`, `target`, `price`, `realized`; domain trades.ts / fills.ts / cells.ts): «número inválido em {CAMPO[column]}» («Linha 7: número inválido em Preço de entrada»; `CAMPO` is B0's, §4.2), never the key; readers as built (their column is the file's header) · `pnl_mismatch` «resultado diferente do calculado pelos preços» · `sign_mismatch` (as built) |
| `offline` / network | as built | as built |

### 3.4 Display rules both lanes follow

1. Money: `formatMoney(x, { signed: true, currency })` with the account's currency (US$; R$ for B3); unsigned amounts
   (a cost in «− US$ 2,48», «antes da comissão de US$ 1,24») without a sign; the Unicode minus «−».
2. Quantities and prices in conferir and the pairing list: pt-BR digits (thousands «.», decimal «,»), **the decimals the
   file wrote** («6.812,25», «112.400,00», «0,0125», «0,1000 ETH» in a row), except the end-of-file sub and notes, which
   write the leftover without trailing zeros («0,1 ETH»).
3. Dates in conferir and the pairing list: the file's own clock, «{d} {mês}, HH:MM» (`1 out, 09:34`, the day without a
   leading zero, the month as «jan … dez»); a row with an offset is shown as written.
4. A count's noun agrees with its number (as built `ops`); every new plural has its singular (N where the board has none).
5. The file's text, cells and headers are shown only in the browser and never sent, stored or logged; the model keeps names
   and choices only (`templatePayload`), and «Conta» values only as hashes (`accountRouteHash`).

---

## 4. The one cross-lane interface: commit **B0** (on the base, before the lanes branch)

Committed on `fase-3b/telas` by the orchestrator as one commit («Phase 3b · telas: B0, the mapped file's shared state, the
step placeholders and the board's files»), with its tests, before either lane branches: both lanes start from it. Checks at
B0: `npx jest --ci` (all suites), `tsc --noEmit`, `next lint`, and (when clusters are allowed) the 9 database-backed suites
with `pg_run.sh`. From there **L1 owns** `lib/hub/importMapeado.ts`, `PassoMapa.tsx`, `PassoConferir.tsx`, `ChipModelo.tsx`,
`copyMapa.ts` and `hub-importar-mapa.css`; **L2 owns** `hub-importar.css`; `app/testing/mapeadoTelas.ts`, its test and
`app/app/(hub)/layout.tsx` are **frozen** (a needed change stops the lane and is reported: file, change, reason). L1 may change
the **bodies** of the B0 functions and add exports; it must not change a B0 **type, signature, prop or copy key name** (L2
imports them), nor a label of B0's `CAMPO` (L2 prints it in «Ver linhas», §3.3).

### 4.1 `app/lib/hub/importMapeado.ts` (new)

```ts
/**
 * Phase 3b · telas: the column-mapping import's shared state, between the mapping steps (lane L1: «mapa»,
 * «conferir», the model chip) and the import sheet (lane L2). Pure but for lerArquivoMapeavel. The file's text,
 * cells and header names stay in the browser: never sent (only ImportRow and the model's names and choices are),
 * never stored, never logged.
 */
import {
  accountKey, accountRouteHash, checkTemplate, columnsFromTemplate, decodeCsvBytes, endOfFileKey, headerClocks,
  mappedContext, mappingProblems, matchTemplate, missingRequirements, netAsked, netQuestion, parseMappedRecords,
  quantityIsSigned, readCsv, sniffDateOrder, sniffDecimalMark, sniffFile, suggestColumns, suggestRowKind, templateMisfits,
  templatePayload, unknownSideWords, MAX_RECORDS,
  type CsvDelimiter, type DateOrder, type DateOrderDecision, type DecimalDecision, type DecimalMark, type EndOfFileAnswer,
  type FieldKey, type FileErrorCode, type MappedOutcome, type MappingChoices, type ReadImportFileResult, type RowKind,
  type SideWordAnswer, type SniffedFile, type Template, type TemplateMatch, type TemplatePayloadV1,
} from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'
import { DICA_MAPA, MODELO } from '@/components/hub/importar/copyMapa'
import { PLATFORM_LABEL } from '@/components/hub/contas/copy'

/** A file no reader took, read again as text */
export interface ArquivoMapeavel {
  fileName: string
  size: number
  /** readImportFile's, over the raw bytes */
  sha256: string
  text: string
}

/** One column on screen: a field, «Ignorar esta coluna» ('ignorar') or «Escolha…» (null); both last are null for the domain */
export type ColunaUi = FieldKey | 'ignorar' | null

export interface Mapeamento {
  /** The file read with `lido.delimiter` (sniffFile) */
  lido: SniffedFile
  /** The «Separador» pill pressed; differs from lido.delimiter while a re-read with it failed (E10) */
  separador: CsvDelimiter
  rowKind: RowKind
  /** Per row kind, so «Cada linha do arquivo é» keeps what each kind was given; indexed like lido.headers */
  colunas: Record<RowKind, ColunaUi[]>
  /** The pre-fill per row kind: «sugerida» while a column still holds it (origem 'nomes' only) */
  sugeridas: Record<RowKind, ColunaUi[]>
  /** Columns a changed model does not know («nova») */
  novas: boolean[]
  /** sniffDecimalMark over the mapped number columns of `rowKind` */
  decimal: DecimalDecision
  /** The «Decimal» pill or the question's pill pressed; null: the question is open with nothing pressed */
  decimalMark: DecimalMark | null
  /** sniffDateOrder over the mapped date columns */
  datas: DateOrderDecision
  /** The order in use (decided, a model's, the question's answer); null: none needed, or the question is open */
  dateOrder: DateOrder | null
  sideWords: Record<string, SideWordAnswer>
  openCloseWords: Record<string, 'open' | 'close'>
  /** The net question's answer (the prices' pre-answer, a model's, or a pill); null: not asked, or open */
  resultIsNet: boolean | null
  /** Only the answers the owner gave; a key absent is «Não sei» (pre-selected) */
  endOfFile: Record<string, EndOfFileAnswer>
  /** «N contas neste arquivo»: the «Conta» value imported now; null: every row. Written by the sheet (L2) only */
  accountValue: string | null
  match: TemplateMatch
  /**
   * An exact model whose facts fit the file and whose mapping passes «mapa» on it (bloqueioDoMapa null), taken as is: the
   * chip «Colunas do modelo “{nome}”» (E34), no model block, a touch after the commit
   */
  porModelo: boolean
  /**
   * Where the sheet starts the file (set by iniciarMapeamento, never changed after): 'previa' (porModelo and nothing to
   * ask: 15), 'conferir' (porModelo, but an execution file with an end-of-file question, or arquivoDoMapeamento fails:
   * owner decision 3, D20), 'mapa' (every other file)
   */
  inicio: 'mapa' | 'conferir' | 'previa'
  /** 'nomes': pre-filled from the column names; 'modelo': from the model (a changed match, or «Mudar colunas») */
  origem: 'nomes' | 'modelo'
  /** «Mudar colunas» was pressed (E7's «Mude as colunas do modelo …»); false everywhere else */
  mudando: boolean
  /** «Salvar como modelo» / «Atualizar o modelo “{nome}”» (checked by default) */
  salvar: boolean
  /** «Nome do modelo» as typed */
  nome: string
  /** The model's name, or the default name (D1): what an emptied «Nome do modelo» saves */
  nomePadrao: string
}

/** The text again (decodeCsvBytes over the bytes; Blob.arrayBuffer, else FileReader) */
export async function lerArquivoMapeavel(file: Blob, lido: Pick<ReadImportFileResult, 'fileName' | 'size' | 'sha256'>): Promise<ArquivoMapeavel>

/** The default «Nome do modelo» (D1): the platform's label; a reader's platform (topone, ebinex), naosei, outra or none → «Minha plataforma» */
export function nomePadraoDoModelo(platform: string | null): string

export type InicioMapeamento = { ok: true; mapeamento: Mapeamento } | { ok: false; error: FileErrorCode; line?: number }

/**
 * The header the readers saw (routeFile's input, §3.1): the first record of the comma read parseImportText made,
 * readCsv(arquivo.text, {maxRecords: MAX_RECORDS + 1})[0].cells (it cannot throw for a file readImportFile called
 * unknown_format / missing_columns / duplicate_columns: that same read succeeded)
 */
export function cabecalhoDoLeitor(arquivo: ArquivoMapeavel): string[]

/**
 * The mapping of a file whose account is known: sniffFile (its failures returned as they are), matchTemplate over the
 * user's models, then
 *   exact and templateMisfits(…) = []  → the model's choices, origem 'modelo', salvar true, nome = the model's; then
 *                                         bloqueioDoMapa(m) ≠ null (a new side word, a failing column check) → porModelo
 *                                         false, inicio 'mapa' («Atualizar o modelo»: the answer goes into the model);
 *                                         else porModelo true and inicio = 'conferir' when arquivoDoMapeamento(m, market,
 *                                         null) fails or is an execution file with endOfFile.length > 0, else 'previa';
 *   exact with misfits, or changed      → inicio 'mapa', the model's choices on the names it knows (columnsFromTemplate: a known name it
 *                                         ignores → 'ignorar', a new name → null + novas), the model's row kind, porModelo
 *                                         false, origem 'modelo', salvar true («Atualizar o modelo»), nome = the model's;
 *   none                                → rowKind = suggestRowKind; colunas[k] = suggestColumns(headers, k, market, values) for
 *                                         both kinds (null stays null in B0: L1 adds the «Ignorar» pre-set, §5.3); decimal over
 *                                         the mapped number columns, decimalMark = decided ?? question?.preselect ?? (question ?
 *                                         null : fallback); datas over the mapped date columns, dateOrder = decided (null while
 *                                         `ask`); resultIsNet = netQuestion(…)?.preanswer ?? null; origem 'nomes', salvar true,
 *                                         nome = nomePadrao = ctx.nomePadrao.
 * endOfFile {}, accountValue null, mudando false, sideWords/openCloseWords {} (or the model's), separador = lido.delimiter;
 * inicio 'mapa' and porModelo false but for the first case.
 */
export function iniciarMapeamento(
  arquivo: ArquivoMapeavel,
  ctx: { market: AccountMarket; templates: readonly Template[]; nomePadrao: string },
): InicioMapeamento

/** The domain's choices: 'ignorar' and null → null; decimalMark ?? decimal.fallback; resultIsNet only when netAsked */
export function escolhasDe(m: Mapeamento): MappingChoices

/**
 * parseMappedRecords with m's records and choices, accountValue, endOfFile, the model's id and tz hint (exact or changed
 * match; null otherwise) and `fileTz` (null on «mapa» and «conferir»: wall clocks; the zone once the zone step has one).
 * endOfFile: «conferir» always reads every account's rows (accountValue null), so with two or more «Conta» values its
 * answers are stored under endOfFileKey(S, conta) = JSON [accountKey(conta), S]; once hc set accountValue, the domain
 * keys that account's questions by S alone (fills.ts accountKeys), so the answers passed are: each stored key whose
 * JSON [k, S] has k = accountKey(accountValue) → S; other accounts' composite keys dropped; plain keys (a file with one
 * «Conta» value or none) kept. m.endOfFile itself is never re-keyed (Voltar to conferir finds it intact).
 */
export function arquivoDoMapeamento(m: Mapeamento, market: AccountMarket, fileTz: string | null): MappedOutcome

/**
 * «Mudar colunas» (E34, on «Prévia» or «conferir»): porModelo false, origem 'modelo', mudando true (title «Mude as colunas
 * do modelo “{nome}”.»), the model block «Atualizar o modelo “{nome}”» checked; every answer kept
 */
export function mudarColunas(m: Mapeamento): Mapeamento

/** What to save after the commit (E46), or null when nothing is saved («Salvar …» unchecked: «Colunas usadas só neste arquivo.») */
export interface ModeloASalvar {
  payload: TemplatePayloadV1
  /** p_replaces: the model «Atualizar o modelo» re-keys; null for a new model and for a touch */
  replaces: string | null
  /** 'salvo' (origem 'nomes'), 'atualizado' (origem 'modelo', not porModelo), 'tocado' (porModelo: no end line) */
  tipo: 'salvo' | 'atualizado' | 'tocado'
  nome: string
}
/**
 * templatePayload(escolhasDe(m) + name = m.nome.trim() || m.nomePadrao, accountRoutes = the model's routes + the one for
 * `rota` (accountRouteHash(valor) → contaId; routes only when a column is «Conta», at most 50: a 51st is not added),
 * tzHint). checkTemplate(payload) must be null for any mapping bloqueioDoMapa / bloqueioDoConferir let through (tested).
 */
export function modeloASalvar(m: Mapeamento, ctx: { tzHint: string | null; rota: { valor: string; contaId: string } | null }): ModeloASalvar | null

/**
 * «Continuar» on «mapa» (E19): the first hint that blocks, or null. B0 checks, in this order: separador ≠ lido.delimiter
 * (DICA_MAPA.ler); datas.ask and dateOrder null (DICA_MAPA.datas); decimal.question and decimalMark null
 * (DICA_MAPA.numeros); missingRequirements (DICA_MAPA.obrigatorias); mappingProblems duplicate_field (DICA_MAPA.umaColuna);
 * swap_without_pnl (DICA_MAPA.marcadas); a word of the «Lado» column that unknownSideWords finds and m.sideWords does not
 * answer (DICA_MAPA.lado(the first)): iniciarMapeamento's `inicio` needs it at B0. L1 completes it (§5.6: the E17 checks,
 * the tick nota) without changing the order of these.
 */
export function bloqueioDoMapa(m: Mapeamento, market: AccountMarket): string | null

/** «Usar estas colunas» on «conferir» (E28, E29). B0: null. L1: §5.6 */
export function bloqueioDoConferir(m: Mapeamento, market: AccountMarket): string | null
```

`lerArquivoMapeavel` is the only impure function. Test file (B0, then L1's): `__tests__/lib/hubImportMapeado.test.ts` — on
every B0 file (§4.3): `iniciarMapeamento` (match kind, row kind, suggested columns per kind = the domain's, decimal and date
decisions, resultIsNet pre-answer, nome/nomePadrao: «BlackArrow», «Minha plataforma» for `topone`, «Tradovate»,
«NinjaTrader», «Match-Trader», «Profit (Nelogica)», «Binance», «Interactive Brokers»), the sniff failures returned as codes,
`escolhasDe` (ignorar → null), `arquivoDoMapeamento` = `parseMappedRecords` on the same input, its end-of-file translation
(`f16c`: «Sim» given under `endOfFileKey('MESZ6', 'LT50K-0193')` on every account's read → with `accountValue` «LT50K-0193»
one question, key «MESZ6», answer 'yes'; the other account's answer dropped; `m.endOfFile` unchanged), `inicio` and
`porModelo` (`f15` + `modeloBlackArrow()` → 'previa'; `f16ta` + `modeloTradovate()` → 'conferir'; `f16t` + `modeloTradovate()`
→ 'previa'; `f15b` → 'mapa'; `f19` + its own model saved without the «X» answer → 'mapa', porModelo false),
`cabecalhoDoLeitor` (the comma read's first record, also for a «;» file: one cell), `mudarColunas` (`mudando`),
`modeloASalvar` (each `tipo`, `replaces`, the route hash, no route without «Conta», `checkTemplate(payload)` null on every
B0 file, «Salvar» unchecked → null), `bloqueioDoMapa` B0 order, `lerArquivoMapeavel` on a jsdom `File` (UTF-8 with BOM, CRLF).

### 4.2 Placeholders and copy (new; L1 replaces the bodies, keeps the props and key names)

```ts
// app/components/hub/importar/PassoMapa.tsx
export interface PassoMapaProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  arquivo: ArquivoMapeavel
  mapeamento: Mapeamento
  market: AccountMarket
  onChange: (m: Mapeamento) => void
  /** What the sheet's one live region says now (E10, E12's nota, E16): called after the change that shows it */
  onAnuncio: (texto: string) => void
}
export default function PassoMapa(p: PassoMapaProps): JSX.Element   // B0: <div className="hub-passo"><h3 id="t-passo" tabIndex={-1} ref>{title}</h3></div>

// app/components/hub/importar/PassoConferir.tsx
export interface PassoConferirProps {
  headingRef: React.RefObject<HTMLHeadingElement>
  mapeamento: Mapeamento
  market: AccountMarket
  onChange: (m: Mapeamento) => void
  /** E24's nota after an answer */
  onAnuncio: (texto: string) => void
  /**
   * A model taken as is that starts here (inicio 'conferir', porModelo): the sheet's «Mudar colunas»; PassoConferir then
   * renders <ChipModelo> after the order line and no model block (E27). null otherwise
   */
  onMudarColunas: (() => void) | null
}
export default function PassoConferir(p: PassoConferirProps): JSX.Element  // B0: the heading «Confira 3 linhas» only

// app/components/hub/importar/ChipModelo.tsx
export interface ChipModeloProps { nome: string; onMudar: () => void }
export default function ChipModelo(p: ChipModeloProps): JSX.Element   // B0: the final markup (E34)
```

`app/components/hub/importar/copyMapa.ts` (B0 keys; L1 adds the rest, §5.10):

```ts
export const MAPA = {
  /** B IC l.1485 */ titulo: 'Não reconhecemos este arquivo. Diga o que é cada coluna.',
  /** B IC l.1484 */ tituloMudou: (nome: string) => `Este arquivo mudou desde o modelo “${nome}”. Confira as colunas.`,
  /** B IC l.1485 */ tituloMudar: (nome: string) => `Mude as colunas do modelo “${nome}”.`,
}
export const CONFERIR = {
  /** B IC l.555 */ titulo: 'Confira 3 linhas',
  /** B IC l.1921 */ usar: 'Usar estas colunas',
}
export const DICA_MAPA = {
  /** B IC l.1477 */ ler: 'Confira como ler o arquivo.',
  /** B IC l.1478 */ datas: 'Escolha a ordem das datas.',
  /** N: a decimal question with nothing pressed (a «,» file) */ numeros: 'Escolha como ler os números.',
  /** B IC l.1479 */ obrigatorias: 'Marque as colunas obrigatórias.',
  /** B IC l.1480 */ umaColuna: 'Cada campo vai em uma coluna só.',
  /** B IC l.1481 */ marcadas: 'Confira as colunas marcadas.',
  /** B IC l.1482 */ lado: (valor: string) => `Diga o que quer dizer “${valor}”.`,
}
export const MODELO = {
  /** A (D1): the default name when the account's platform says nothing about the file */ nomePadrao: 'Minha plataforma',
}
export const CHIP_MODELO = {
  /** B IC l.1705 */ texto: (nome: string) => `Colunas do modelo “${nome}”`,
  /** B IC l.366 */ mudar: 'Mudar colunas',
}
/** B IC l.1155–1164 (`NV.CAMPOS`): the select's labels; also L2's «número inválido em {CAMPO[campo]}» (§3.3) */
export const CAMPO: Record<FieldKey, string> = {
  entry_time: 'Entrada (data e hora)', symbol: 'Ativo', side: 'Lado', quantity: 'Quantidade', pnl: 'Resultado',
  entry_price: 'Preço de entrada', exit_price: 'Preço de saída', exit_time: 'Saída (data e hora)',
  buy_time: 'Compra (data e hora)', sell_time: 'Venda (data e hora)', buy_price: 'Preço de compra', sell_price: 'Preço de venda',
  commission: 'Comissão', fee: 'Outra taxa (soma na comissão)', swap: 'Swap ou funding', stop: 'Stop', target: 'Alvo',
  trade_id: 'ID da operação (evita duplicar)', account: 'Conta',
  time: 'Data e hora', price: 'Preço', fill_id: 'ID da execução (evita duplicar)', order_id: 'ID da ordem',
  open_close: 'Abre ou fecha', realized: 'Resultado realizado',
}
```

### 4.3 `app/testing/mapeadoTelas.ts` (new, frozen): the board's world and its files

Invented data only; rows 1–3 of each file are the board's (IC l.623 `desc`, l.841–1065; for Tradovate the board's `LIN_TV`,
IC l.870–873, so every «ex.:» sample is the board's). Zone bars and spans (§6.5): one unit per trade (a trade file) or per
execution, on the file's clock, by half hour; spans from the first to the last entry. Exports:

- `HOJE_QUADRO = new Date('2026-10-15T15:00:00Z')` (Thursday 15 Oct 2026, 11:00 ET: «hoje» of the board).
- `CONTAS_QUADRO`: `TradingAccount`s (via `makeAccount`) — `topOne` (futures, «Top One», `topone`, financiada, `file_tz`
  'UTC', `tz_applied_at` set, primary), `ylos` (futures, «Ylos 50k», `blackarrow`, firm «Ylos Trading», avaliação,
  'America/New_York', not confirmed) and `ylosDepois` (the same, confirmed: after scenario 8's import), `lucid` («Lucid 50k»,
  `tradovate`, firm «Lucid Trading», NY, not confirmed), `apexA` («Apex A», `ninja`, firm «Apex Trader Funding»,
  `external_ref` «APX-0001», NY, not confirmed), `e8` (forex, «E8 50k», `matchtrader`, firm «E8 Markets», NY), `ibkr`
  (stocks, «IBKR», `ibkr`, pessoal, NY), `binance` (crypto, «Binance», `binance`, pessoal, 'UTC'), `mini` (b3, «Mini-índice»,
  `profit`, pessoal, 'America/Sao_Paulo'), `ebinex` (binary, «Ebinex», `ebinex`, pessoal). Rules «desde»: 14 out for Top
  One, Ylos 50k and Apex A; 15 out for the others (L2's rules fixture, §6.10). **Order** (the app sorts by market, then
  `sort_order`, then `created_at`; `makeAccount` gives every account 0 and one date): `sort_order` topOne 0, apexA 1, ylos
  and ylosDepois 2, lucid 3 (the board's menu, IC l.1181: «Top One, Apex A, Ylos 50k, Lucid 50k»), every other account 0;
  L2's database-backed suite creates them with the same `sort_order`. Pinned: `sortAccounts(CONTAS_QUADRO)` gives that order.
- `ARQUIVOS_QUADRO`: `{ nome, texto }` per key; `arquivoQuadro(key): File` (`new File([texto], nome, {type: 'text/csv'})`)
  and `lidoQuadro(key): ReadImportFileResult` (`{fileName, size, sha256: 'ab'.repeat(32), outcome: parseImportText(texto)}`:
  what the sheet's mocked `readImportFile` answers).
- `MODELO_BLACKARROW_LINHA` (an `import_templates` row as PostgREST returns it: F8's normalised headers, `BLACKARROW_FIELDS`,
  `delimiter 'semicolon'`, `decimal_mark 'comma'`, `date_order 'dmy'`, `result_is_net true`, `tz_hint 'America/New_York'`,
  name «BlackArrow») and `modeloBlackArrow(): Template` (`templateFromRow` of it); `MODELO_TRADOVATE_LINHA` /
  `modeloTradovate()` the same for `f16t` (TV_HEADER normalised, the execution kind, the board's fields, `delimiter 'comma'`,
  `decimal_mark 'point'`, `date_order 'mdy'`, `tz_hint 'America/New_York'`, name «Tradovate»).

| Key | File | Composition (targets the test pins) |
|---|---|---|
| `f8` | «BlackArrow (8)», 18 data rows | BLACKARROW's header and 3 rows first; dates 01/10–13/10/2026; entries from 09:31 (the first) to 10:58 (the last) on the wall clock, 8 in 09:30–09:59, 6 in 10:00–10:29, 4 in 10:30–10:59 (the board's bars, IC l.1084); MESZ6 and MNQZ6 only; 21 contracts; each «Res. Líq.» = the price result − 1,24 × Qtd; Σ «Res. Líq.» = 15,21; Σ «Corretagem» = 26,04; every money and price cell with a comma part (no ambiguous decimal cell); unique «Nº Negócio». Pinned: delimiter `;`, decimal decided comma, date order dmy decided, `suggestColumns` = `BLACKARROW_FIELDS`, `netQuestion` = commission/true with evidence line 2 (−37.50, 2.48, −39.98); resultIsNet true → `commission_in_file` gross 41.25 / 26.04; false → gross 15.21 and 18 `result_differs_from_prices`; every entry before 2026-10-14 in New York, UTC and Brasília. |
| `f8p` | «Performance.csv», 6 rows | PERFORMANCE's header and 4 rows + 2 rows of one buy of 2 MESZ6 at 6812.25 on 10/13/2026 10:31:05, sold 1 at 6816.00 (10:38:40, «$18.75») and 1 at 6819.50 (10:44:12, «$36.25»), both with the same buyFillId. Pinned: 6 rows, 4 positions (+23,75 [37.50, −13.75], +7,50, +17,00, +55,00 [18.75, 36.25]); the positions' entries 10:31 (one) and 11:02, 11:05, 11:20 (the board's bars per trade, 1 and 3, IC l.1133); span 10:31–11:20; `columnCheck(…, 'trade_id')` = 'repeats' for buyFillId and sellFillId; no commission. |
| `f15` | «BlackArrow (15)», 24 rows | `f8`'s 18 rows + 6 rows dated 14/10–15/10/2026, 7 contracts, Σ «Res. Líq.» 53,82, Σ «Corretagem» 8,68 (each net = prices − 1,24 × Qtd), new IDs. Pinned with `modeloBlackArrow()`: exact match, no misfits; gross 103,75 / 34,72; days 2026-10-01..2026-10-15. |
| `f15b` | «BlackArrow (15) + Estratégia» | `f15` + a last column «Estratégia» («Rompimento», «Pullback», …). Pinned: `matchTemplate` changed, shared 9; the new column `columnsFromTemplate` → null. |
| `f16t`, `f16ta`, `f16b`, `f16i` | Tradovate Orders (11), ending positioned (13), Binance (8), IBKR (8) | `BINANCE`, `IBKR` of `testing/mappedFiles.ts` unchanged; `f16t` / `f16ta` = `TRADOVATE` / `TRADOVATE_OPEN` with physical lines 2, 4 and 5 replaced by the board's `LIN_TV` rows (IC l.870–873): only the ignored «Timestamp» (10:31:04, 10:31:05, 10:43:58) and «Limit Price» (empty, 6816.00, 6819.50) change, so the samples read «ex.: 10/13/2026 10:31:04» and «ex.: 6816.00» (the column's first non-empty cell) as the board. Pinned: those two samples; executions 9 / 10 / 8 / 8, unfilled 2 / 3 / 0 / 0, the end-of-file questions (MESZ6 net −1, 7 fills; ETHUSDT net +0.1, 3 fills), positions per answer as IC l.877–885, 928–933, 1107–1110; executions per half hour 3, 5, 1 (`f16t`, 10:31–11:31) and 3, 5, 2 (`f16ta`, 10:31–11:48), the board's (IC l.1092, 1148). |
| `f16c` | Tradovate Orders, two accounts (N: no board; §6.7's re-keying) | TV_HEADER; «Account» LT50K-0193 and LT50K-0194, each with a buy of 1 MESZ6 that a sell of 1 closes and a last buy of 1 MESZ6 left open, plus one cancelled row. Pinned: `contasDoArquivo` 2 values; with `accountValue` null two end-of-file questions with `account` set (keys `endOfFileKey('MESZ6', v)`), net +1 each; with `accountValue` «LT50K-0193» one question keyed «MESZ6». |
| `f17` | «NinjaTrader», 57 rows | NINJA's header and 3 rows first; 31 rows APX-0001 (with both «MNQ 12-26» and «MES 12-26»), 26 APX-0002; M/D/YYYY with a day above 12 in some row; **every** entry of both values before 14 out (New York, so «Antes de 14 out …: 31 vão …» / «26 vão …» and the end «… em Histórico importado …», IC l.998–1007); for each value the first entry 09:31 and the last 11:58; APX-0001's trades per half hour 10, 8, 6, 4, 3 at 09:30–11:30 (the board's 5:4:3:2:1, IC l.1115, cannot be met by 31: the 11:30 bar reads 30 % for 20 %); each «Profit» = the price result (gross). APX-0001: Σ Profit 186,50, Σ Commission 44,64 (36 contracts); APX-0002: 141,25 / 37,20 (30 contracts). Pinned: values APX-0001 31, APX-0002 26 in first-appearance order; net pre-answer false, evidence line 2 (17.00, 1.24); per value gross (false) 186.50 / 141.25, (true) 231.14 / 178.45 with 31 / 26 differs; `symbol_normalised` symbols MNQZ26, MESZ26. |
| `f18`, `f18a` | «Forex», 14 rows | FOREX's header and 3 rows first; 2 EURGBP rows, 12 rows of EURUSD/GBPUSD/AUDUSD/NZDUSD (exact pairs); Σ Profit 218,60, Σ Swap −6,20 (row 3 only), Σ \|Commission\| 40,25; each computed row's Profit = the price result; dd.mm.yyyy with 13.10 and 14.10; entries from 06:05 (the first) to 17:48:55 (row 3, 13.10, the last), every other entry between 06:05 and 15:59 (so New York and Chicago move exactly one trade to another day, UTC none: deviation #2); per half hour (IC l.1119) 06:00 ×1, 08:30 ×2, 09:00 ×2, 09:30, 10:00, 10:30, 12:00, 13:00, 14:30, 15:00 ×1 each, 15:30 ×1 (the board's 16:00 entry: none may sit at 16:00–16:59 with Chicago's 1), 17:30 ×1. Pinned: preanswer false (evidence +57.50, 3.50), resultIsNet false → gross 212.40 / 40.25, true → 258.85 + 12 differs; `swap_in_result` 1. `f18a`: the same rows on 08.10–09.10 (every day ≤ 12): `datas.ask` true, the first ambiguous cell «09.10.2026 …». |
| `f19`, `f19p` | «B3», 18 rows | B3's header and 3 rows first; «X» sides on physical lines 6 and 11, an empty side on line 15, line 9 a WIN price off its 5 tick; every other WIN price on the tick and written «131.250»-like; WDO prices «5.412,5»-like; money with a comma part; dates 14/10/2026; entries from 10:02 (the first) to 16:40 (the last); the 18 lines per half hour as the board (IC l.1125, Brasília) 10:00 ×4, 10:30 ×3, 11:00 ×3, 13:00 ×2, 14:00 ×2, 14:30 ×2, 16:30 ×2, with line 9 at 11:00 and line 15 at 14:00, so the 16 trades the zone step draws read 4, 3, 2, 2, 1, 2, 2 (§11.1 #6). With X answered and resultIsNet true: gross 412.00 / 22.50 over 16 rows; false: 389.50 + 16 differs; «Pular essas linhas»: 14 rows, 413.00 / 391.40, 21.60; errors [9 off_tick, 15 bad_direction] (+ 6, 11 bad_direction when skipped); decimal decided comma with the ambiguous «131.250». `f19p`: header «Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Nº Negócio», 18 WIN-only rows (LIN_B3P first), the same side and tick lines, no deciding number cell: `decimal.question` with sample «131.250», preselect comma; read with point: every WIN price off its tick. |
| `f9ilegivel` | «relatorio.csv» | a text with no line of two cells or more: `sniffFile` → `header_not_found` |

Test `__tests__/testing/mapeadoTelas.test.ts` (B0, frozen): every «Pinned» value above, through the domain and B0's
`importMapeado.ts` only (no React, no database).

### 4.4 Stylesheets and layout (B0)

`app/styles/hub-importar-mapa.css` (L1's) and `app/styles/hub-importar.css` (L2's), each a header comment only; two lines in
`app/app/(hub)/layout.tsx` after `import '@/styles/hub-registrar-parciais.css'`: `import '@/styles/hub-importar.css'` then
`import '@/styles/hub-importar-mapa.css'`.

---

## 5. Lane L1 · «mapa», «conferir», the model chip

### 5.1 Files (exclusive)

| File | Change |
|---|---|
| `app/lib/hub/importMapeado.ts` | from B0: the bodies of `iniciarMapeamento` (the pre-fill of §5.3), `bloqueioDoMapa`, `bloqueioDoConferir`; new exports: the edits of §5.2. May add **optional** fields to `Mapeamento` (L2 only reads B0's fields and writes `accountValue` by spreading). |
| `app/lib/hub/importMapaVista.ts` (new, pure) | `vistaMapa(m, arquivo, market)` and `vistaConferir(m, market)`: every text, chip, note, check, question and row of E7–E29 as data (§5.4–5.5); the components only render them |
| `app/components/hub/importar/PassoMapa.tsx`, `PassoConferir.tsx`, `ChipModelo.tsx` | the steps (props of §4.2) |
| `app/components/hub/importar/copyMapa.ts` | B0's keys + §5.10 |
| `app/styles/hub-importar-mapa.css` | §5.9 |
| Tests | §8.1 |

L1 edits no existing file outside this list and no existing test.

### 5.2 The edits (pure, `importMapeado.ts`; each returns a new `Mapeamento`)

`comModo(m, rowKind)` (E13: the kind's own `colunas`/`sugeridas` come back; decimal, dates and the net pre-answer are
decided again over that kind's mapped columns) · `comColuna(m, index, valor: ColunaUi)` (E17; decimal and dates decided again
over the mapped number/date columns, the user's pressed pills kept; `resultIsNet` re-pre-answered while the owner has not
pressed a net pill) · `comSeparador(m, arquivo, d)` (E9: `d` = the sniffed delimiter → back to it; else `sniffFile(text,
{delimiter: d, headerSkip: m.lido.headerSkip})`, i.e. the **same header line**: when it is ok, its header has ≥ 2 cells and
every record has the header's width, a fresh mapping of the re-read file (`iniciarMapeamento` rules, keeping
`salvar`/`nome`); otherwise (a failure such as `header_not_found`, a narrower header, a ragged record) the columns stay,
`separador = d`: E10's note and the block. Without `headerSkip`, `findHeader` would skip `f8`'s header — one cell when read
with «,» — as a title line and take the first data row, five cells «01/10/2026 09:34:31;MESZ6;C;2;6.801» «00;6.797» …, as
the header, which every record matches: a nonsense mapping instead of the note)
· `comDecimal(m, mark)` (E9 pills and E12 pills) · `comDatas(m, order)` (E9 pills, E11 pills) · `comPalavraDeLado(m,
word, answer)` (E18) · `comFimDoArquivo(m, key, answer)` (E24) · `comLiquido(m, net: boolean)` (E26) · `comSalvar(m,
boolean)` · `comNome(m, text)` (E27; at most `MAX_TEMPLATE_NAME` characters).

### 5.3 Pre-fill (E20), per row kind

From the names (`origem 'nomes'`), for each kind `k`:
1. `f = suggestColumns(headers, k, market, values)` with `values = {records, decimalMark: decided ?? fallback over every
   column, dateOrder: decided over every column}`.
2. A column with `f[i] === null` gets **'ignorar'** («Ignorar esta coluna», tag «sugerida») when
   - (twin) `suggestColumns([headers[i]], k, market)[0]` is a field another column already holds in `f`
     (Tradovate: avgPrice, filledQty, Timestamp, Quantity);
   - or `synonymName(rawHeader)` ∈ `IGNORAVEIS = ['status', 'duration', 'limit price', 'stop price']` (Tradovate Status, Limit
     Price; Performance duration);
   - or its `synonymName` ends in «id» and `columnCheck(values, i, k === 'trade' ? 'trade_id' : 'fill_id') === 'repeats'`
     (Performance buyFillId, sellFillId);
   otherwise it stays **null** («Escolha…», no tag: Binance Amount, IBKR AssetClass, NinjaTrader Trade number).
3. `sugeridas[k] = colunas[k] = that array`.

From a model (`origem 'modelo'`): `colunas[model.rowKind] = sugeridas[…] = columnsFromTemplate(headers, model)` with a name the
model knows and ignores → 'ignorar', a name it does not know → null and `novas[i] = true`; the other kind as «from the names».

Tags: «sugerida» when `origem === 'nomes'`, `colunas[k][i] !== null` and `colunas[k][i] === sugeridas[k][i]`; «nova» whenever
`novas[i]` (whatever the select holds). A test runs the rule on every B0 file and gets exactly §2.2's columns.

### 5.4 «mapa» (`vistaMapa`)

- **E7 title**: `origem 'nomes'` → `MAPA.titulo`; `mudando` (set only by `mudarColunas`) → `tituloMudar(nome)`; otherwise
  (`'modelo'`: a changed header, or an exact model with misfits or with a question «mapa» asks) → `tituloMudou(nome)`. The
  match kind never decides it: an exact model the file contradicts is not a «Mudar colunas».
- **E8 chips**: `LER.separador(nome)` with «ponto e vírgula» / «vírgula» / «tabulação» of `m.separador`, plus « · decimal
  vírgula|ponto» while `decimalMark` is known and `decimal.question` is null; `LER.datas` «Datas: dia/mês|mês/dia» while
  `dateOrder` is known (decided, the model's, or answered); none for a file without day-month dates (ISO, IBKR, Binance).
- **E9 panel** (open while «Mudar» is pressed): separator pills (the pressed one = `separador`); «Decimal» pills only when
  `decimal.decided !== null`; «Datas» pills only when `datas.decided !== null`.
- **E10** in this order, one shown: `separador !== lido.delimiter` → separator note; `decimal.decided !== null &&
  decimalMark !== decimal.decided` → decimal note; `datas.decided !== null && dateOrder !== datas.decided` → dates note.
- **E11** while `datas.ask`: the example = the first mapped date cell whose `dateOrderEvidence` is 'either', its first two
  numbers as written with their separator («09.10»); each pill «… = {d} {mês}» for its reading (day without a leading zero).
- **E12** while `decimal.question`: pills from `question.readings` (comma first), each «“{sample}” é {value} ({parenthesis})»
  with the value in pt-BR digits **without grouping** («131250», «131,25»); parentheses: a «.» sample → «ponto separa
  milhar» / «ponto é decimal»; a «,» sample → «vírgula é decimal» / «vírgula separa milhar» (N). The pressed pill =
  `decimalMark`. Tick nota: the pressed reading gives `off_tick` errors (`arquivoDoMapeamento(m, market, null)`) and the other
  reading none → `PERGUNTA.decimalPasso(raiz, passo)` with `raiz = tradeMatchKey(market, symbol)` of the first off-tick row
  (its record's symbol, browser only) and `passo` = `tradeInstrument(...).tick` in pt-BR digits.
- **E13** pressed = `rowKind`.
- **E14** `requirementsOf(rowKind)` with `missingRequirements(rowKind, escolhasDe(m).columns, signed)`, `signed =
  quantityIsSigned(records, quantity column, mark)` of the column mapped to «Quantidade» (the requirement); labels: entry
  «Entrada» or, with the buy/sell pair and no «Entrada», «Entrada (pela compra e venda)»; side «Lado (pela compra e venda)»
  with the pair, else «Lado (ou quantidade com sinal)» when **the file has** a signed quantity column (IC l.1410
  `temColSinal`: some column `i` with `sugeridas[rowKind][i] === 'quantity'` or `colunas[rowKind][i] === 'quantity'` and
  `quantityIsSigned(records, i, mark)`; never any number column, since costs and results are negative too), else «Lado»: so
  IBKR with «Quantity» set to «Escolha…» reads «Lado (ou quantidade com sinal) · falta», as the board; each «{rótulo} ✓» (`.hub-req--ok`) or «{rótulo} · falta». Opcionais by
  row kind (swap only where `fieldsFor` offers it).
- **E15** notes in the board's order, each when: 1 `rowKind 'fill'`; 2 no side column and `signed`; 3 trade, no side column,
  `hasBuySellPair`; 4 trade without «Resultado» or fill without «Resultado realizado» (the market's text: Futuros, Forex,
  Ações (and Opções), Cripto, B3); 5 trade without «Saída» and without the pair; 6 neither «ID da operação» nor «ID da
  execução»; 7 the file's own: (a) per mapped date column whose `headerClocks` gives an offset: «A coluna {cabeçalho como
  escrito} já diz o fuso: os horários entram em {UTC | UTC+1 | UTC−3 | UTC+5:30}.» (B for UTC, N for the others), (b)
  `decimal.decided` with an ambiguous cell among the mapped number cells: «Decimal {vírgula|ponto} pelos valores como
  “{the first deciding cell}”: “{the first ambiguous cell}” é {its value under the decided mark, no grouping}.», (c) the
  result column holds a parenthesised value: «“{the first such cell}” é perda: lemos como {−valor}.», (d) the columns the
  pre-fill set to 'ignorar' by the repeating-ID rule: two or more «{A} e {B} se repetem de uma linha para outra: nenhuma das
  duas serve de ID sozinha.» (B), one «{A} se repete de uma linha para outra: não serve de ID.» (N) (from `sugeridas`: the
  note stays when the owner changes the select); 8 `origem 'nomes'` and some `sugeridas` value is not null.
- **E16** `mappingProblems(...)` `duplicate_field`s → their `CAMPO` labels in field order, «, »-joined, + « está|estão em mais
  de uma coluna.».
- **E17** per column: `CAMPO[field]` options of `fieldsFor(rowKind, market)` (+ «Ignorar esta coluna»); check = the first of
  `columnCheck(values, i, field)` ('not_date' / 'not_number' / 'not_side' / 'repeats' texts) and, for «Swap ou funding»
  without «Resultado», the swap text; `values = {records, decimalMark: escolhasDe(m).decimalMark, dateOrder, sideWords}`;
  «ex.: {cell}» = the column's first non-empty cell among the data records, as written («ex.: —» when all are empty).
  Tags «sugerida» / «nova» as `<span class="hub-tag hub-tag--padrao">` (hub.css's neutral tag: the board's style).
- **E18** for the column mapped to «Lado»: `unknownSideWords(records, i)` (without the answers, so an answered question stays
  with its pill pressed); one block per word, «{rows} linhas trazem …» / «1 linha traz …»; pressed = `sideWords[word]`.
  Shown in both row kinds (A: the board draws it on trade files).

### 5.5 «conferir» (`vistaConferir`, over `arquivoDoMapeamento({...m, accountValue: null}, market, null)`: every account's rows, §6.7)

- **E21** title: 3 rows or more → «Confira 3 linhas»; 2 → «Confira 2 linhas»; 1 → «Confira a linha» (N).
- **E22 rows**: trade files the first three data records; execution files the first three records with an executed quantity
  (D4). Items, `—` when the mapping cannot read one:
  - time: the entry cell (or the earlier of «Compra»/«Venda (data e hora)»; for executions «Data e hora») read with
    `readDateTime(cell, dateOrder)` → «{d} {mês}, HH:MM» (§3.4.3);
  - symbol: the cell as written («MNQ 12-26», not normalised);
  - side: `readSide(cell, sideWords)` → «compra» / «venda»; an unknown word → the cell as written («X»); with the pair, the
    earlier time's side; with a signed quantity, its sign;
  - quantity (|q| with the cell's decimals): Futuros, B3 «1 contrato» / «{q} contratos»; Forex 2 decimals, «{q} lote» below 2,
    else «{q} lotes»; Ações «1 ação» / «{q} ações»; Cripto «{q} {ativo}» (the cell's asset suffix, else the symbol without its
    USDT/USDC/USD quote);
  - trade result: with «Resultado» the cell's value as written in money («−US$ 39,98», «+R$ 88,50»); without it, the
    MappedFile row of that line: «{money} pelos preços» when its basis is 'prices' or 'estimate', else «pelos preços»;
  - execution price: the cell in pt-BR digits with its decimals («6.812,25», «112.400,00»).
- **E23 notes**: execution files «Confira: a quantidade …» (B); `flat_start_assumed` with no end-of-file question → «Supomos
  que o arquivo começa sem posição aberta.», with questions → «Em {símbolos «, … e …»}, supomos que o arquivo começa sem
  posição aberta.»; trade files: shown rows of one position («A 1ª e a 2ª linhas têm a mesma entrada: viram uma operação com 2
  saídas.»; three: «A 1ª, a 2ª e a 3ª linhas têm a mesma entrada: viram uma operação com {k} saídas.», N).
- **E24** per `endOfFile` question (MappedFile, current answers): title «No fim do arquivo, {symbol} ficou posicionado?» (with
  `account` set: «No fim do arquivo, {symbol} ({conta}) ficou posicionado?», N); sub by market and `net`'s sign (q = |net|
  without trailing zeros; Forex 2 decimals): Futuros, B3 «sobra 1 contrato vendido|comprado» / «sobram {q} contratos
  vendidos|comprados»; Cripto «sobram {q} {ativo} comprados|vendidos»; Ações «sobra 1 ação comprada|vendida» / «sobram {q}
  ações compradas|vendidas»; Forex «sobra {q} lote comprado|vendido» (q < 2) / «sobram {q} lotes comprados|vendidos»; all
  prefixed «Pelas execuções do arquivo, » and ended «.» (B for the two drawn, N for the rest); pressed = `endOfFile[key] ??
  'unknown'`; nota: 'unknown' «As {fills} execuções de {symbol} ficaram de fora: as compras e as vendas do arquivo não
  fecham.»; 'yes' «A posição ainda aberta fica de fora ({n} execução|execuções) e entra quando você importar um arquivo que
  tenha a abertura e o fechamento.» (`n` = the `open_at_end` error lines whose record's symbol is {symbol}, and with
  `account` set whose «Conta» is that value) when those executions' quantities add up to |net|; otherwise part of an
  execution stays open (the domain counts it only in the file-wide partial notice `open_at_end {fills}`, no error line) →
  «A parte ainda aberta da posição ({q} {unidade}) fica de fora e entra quando você importar um arquivo que tenha a abertura
  e o fechamento.» (N; q = |net| as in the sub; never «(0 execuções)»); 'no' with `net > 0`
  «O arquivo começou com {q} {unidade} vendido(s)…, de antes dele: a compra que fecha essa venda fica de fora.», with `net < 0`
  «O arquivo começou com {q} {unidade} comprado(s)…, de antes dele: a venda que o fecha fica de fora.» (plural «… que os fecha
  …», N).
- **E25** execution files only: `n = positions.length`, `a` with one exit, `b` with several: «Viram {n} operações: {a} com
  uma saída e {b} com saídas parciais.» (a zero part and its « e » dropped); n = 1 «Vira 1 operação, com uma saída.» / «Vira 1
  operação, com saídas parciais.» (N); n = 0 «Nenhuma operação: todas as execuções ficaram de fora.» (N, no disclosure);
  «1ª operação: {symbol}, {compra|venda} de {q} a {preço}; {saídas}: {resultado}.» with «saída de {q} a {p}» / «saídas de
  {q1} a {p1} e de {q2} a {p2}» (three or more: «…, de … e de …»), the position's gross `pnl`; `split_entries` → «{p} posição
  com mais de uma entrada virou {t} operações, uma por entrada.» (plural «{p} posições … viraram …», N); disclosure «Ver as {n}
  operações» / «Ver a operação»; items «{d} {mês}, HH:MM · {symbol} · {compra|venda} de {q} a {p} · {saídas} · {resultado}».
- **E26** when `netAsked(rowKind, columns)`: the form from the mapped costs (trade files: `netQuestion(...).form`; execution
  files: «commission», no pre-answer, N); pressed = `resultIsNet`; nota from `netQuestion(...).evidence` (trade files, when
  pre-answered): `k = evidence.line − lido.headerLine`; net: «Conferido pelos preços na {k}ª linha: {P} − {C} = {F}.» (swap ≠
  0: «{P} − {C} + {S} = {F}.», N); gross: «Conferido pelos preços na {k}ª linha: {F} antes da comissão de {C}.» (form
  'swap': «{F} antes do swap.», N); P, F, S signed money, C unsigned.
- **E27** label `origem 'nomes'` «Salvar como modelo», `'modelo'` «Atualizar o modelo “{model's name}”»; «Nome do modelo»
  (`maxLength` 60) only for `'nomes'` while checked; the nota always. **Not shown when `porModelo`** (a model taken as is that
  starts on «conferir»: nothing to save, a touch after the commit): there `onMudarColunas` is set and E34's chip row
  («Colunas do modelo “{nome}”» + «Mudar colunas») stands after the order line (D20, N).

### 5.6 What blocks

`bloqueioDoMapa` (E19), the first that holds: E10 or E12's tick nota → `ler`; `datas.ask && dateOrder === null` → `datas`;
`decimal.question && decimalMark === null` → `numeros`; a requirement missing → `obrigatorias`; a duplicate → `umaColuna`;
any E17 check → `marcadas`; an unanswered E18 word → `lado(valor)` (the first). `bloqueioDoConferir` (E28–E29):
`arquivoDoMapeamento` fails → `CONFERIR.falha[error]`; `netAsked && resultIsNet === null` → `CONFERIR.responda`; else null.
`modeloASalvar(...)` is never refused by `checkTemplate` once both pass (test over every B0 file and every edit path).
`iniciarMapeamento` uses both for an exact model that fits (§4.1): `bloqueioDoMapa` ≠ null → `inicio 'mapa'`; else
`bloqueioDoConferir` ≠ null or an execution file with an end-of-file question → `inicio 'conferir'`; else `'previa'`.

### 5.7 Keyboard, accessibility, layout

- Focus: the h3 on entering the step (the sheet does it, as built). «Mudar», a pill, a select and «Ver as N operações» keep the
  focus where it is on use; a re-read with another separator re-renders the columns and leaves the focus on the pressed pill.
- Tab order «mapa»: «Mudar» → the panel's pills (when open) → E11/E12 pills → E13 pills → each column's select in file order →
  E18 pills → the footer. «conferir»: «Mudar colunas» (when the chip shows) → E24 pills → «Ver as N operações» → E26 pills →
  the checkbox → «Nome do modelo» → the footer.
- Pill groups `role=group aria-labelledby` (`l-sep`, `l-dec`, `l-datas`, `q-datas`, `q-dec`, `l-modo`, `q-lado-{k}`,
  `q-fim-{k}`, `q-liq`), `aria-pressed`; separator pills with their `aria-label`; «Mudar» and «Ver …» `aria-expanded` +
  `aria-controls` (`ler-arquivo`, `ops-formadas`); selects `aria-label`, `aria-invalid`, `aria-describedby=chk-{k}`; E22 rows a
  list with visually hidden «, » separators; E25's resumo `role=status` (it changes with E24's answers); amber blocks carry
  their text (never colour alone).
- 44 px: pills, «Mudar», «Mudar colunas», «Ver …», selects, the checkbox row (`.hub-check`), the name field. Tags and chips are
  not interactive.
- 375: one column per `.hub-col-linha` (≤ 480 px), the tags wrap under the name, long names break anywhere; chips, «Mudar»
  and pills wrap; E22 items wrap inside their row; no horizontal scroll. 768 and 1280: the 480 px sheet, `.hub-col-linha` in two
  columns (`minmax(0,1fr) minmax(0,1.6fr)`).

### 5.8 The live region

`onAnuncio(text)` after the change that shows it: E10's note, E12's tick nota, E16's text (new or changed), E24's nota after an
answer. The sheet puts it in its one `role=status` while on «mapa» / «conferir» (§6.3).

### 5.9 `hub-importar-mapa.css`

Every rule under `.hub`; tokens only (no new colour): `.hub-ler` (flex wrap, gap 6), `.hub-ler-painel` (the board's `.editor`:
dashed `--neutral-border`, radius 14, padding 12/14/14, gap 12), `.hub-req` (dashed `--text-2`, `--text-2` 12 px bold) and
`.hub-req--ok` (solid `--mint-border`, `--mint`), `.hub-col-linha` (grid `minmax(0,1fr) minmax(0,1.6fr)`, gap 4/12, padding
8 0, top border `--border`; one column at `max-width: 480px`), `.hub-col-nome`, `.hub-col-tit` (mono 13 bold), `.hub-chk`
(`--amber` 12 px bold), `.hub-pergunta .hub-pill` (padding 8 14,
line-height 1.35, left aligned), `.hub-prev-lista`, `.hub-prev-linha` (`--inset`, radius 12, mono 12, wrap), `.hub-ops-lista`
(padding-left 18, 13 px). Contrast (test, both themes, over the sheet: claro `#505050`, escuro `#1E2123`): `--text-2`,
`--mint`, `--amber`, `--text` on `--inset` — each ≥ 4.5:1. **No rule here (nor in L2's `hub-importar.css`) may target a
class that `hub.css` or another existing stylesheet defines** unless it is scoped under one of the lane's new classes (as
`.hub-pergunta .hub-pill`): `.hub .hub-tag {…}` (0,2,0, loaded after hub.css) would beat `.hub-tag--propria` / `--mudou` /
`--todas` (0,1,0) and grey every rule tag of Personalizar. The tags «sugerida» / «nova» therefore use the existing
`hub-tag hub-tag--padrao` (neutral border, `--text-2`, 11 px bold: the board's `.tag`); the CSS test asserts this file
defines no `.hub-tag` selector and that every class it defines outside such a scope is absent from `app/styles/*.css`.

### 5.10 `copyMapa.ts` (B0's keys + these; marker in a comment on each)

`LER` (separador names, «decimal», «Datas: …», «Mudar», «Separador», «Decimal», «Datas», «Ponto e vírgula», «Vírgula»,
«Tabulação», the three E10 notes: B IC l.1439–1446, 1488–1489, 530–535) · `CAMPO` (B0's, unchanged; + «Ignorar esta
coluna» B IC l.1160, 1164 in `CHECAGEM`) ·
`REQ` (labels, «Obrigatórias», «✓», «· falta», the two opcionais, B IC l.541, 1413–1418, 1499–1501) · `NOTA_MAPA` (E15, B IC
l.1465–1472, 1094, 1123, 1131, 1167–1176; the N forms marked) · `CHECAGEM` (E17, B IC l.1421, 1427–1428; «ex.: …» B l.546;
«Escolha…» B l.546; «sugerida», «nova» B l.1508) · `PERGUNTA` (E11, E12, E18, B IC l.1454, 1458–1462, 1447; N singulars and
the «,» sample) · `DICA_MAPA` (B0) · `CONFERIR` (B0 + ordem lines B l.1606, the row words «compra» «venda» «contrato(s)» «lote(s)»
«ação/ações» «pelos preços» B l.1555–1583, the E23 notes B l.779–781, 1132, the E21/E29 N texts, `responda` N) ·
`FIM_ARQUIVO` (E24, B l.1593–1595, 1096–1098, 1137–1139, 782; N forms marked) · `PAREAMENTO` (E25, B l.886–889, 1612; N
forms) · `LIQUIDO` (E26, B l.1600–1602, 1083, 1114; N forms) · `MODELO` (E27, B l.569–571, 1614) · `CHIP_MODELO` (B0). A test:
no prototype label (§0) and no «exemplo» in it.

---

## 6. Lane L2 · the flow around the mapping

### 6.1 Files (exclusive)

| File | Change |
|---|---|
| `app/components/hub/importar/ImportSheet.tsx` | reading and routing (§6.2), the `Flow` additions and steps a2 / mapa / conferir / hc (§6.3), the zone rule (§6.5), preview / commit / model save / fim (§6.6, §6.8), «+ Nova conta» from a2, fimConta (§6.9) |
| `app/components/hub/importar/flow.ts` | `Passo` gains `'a2' \| 'mapa' \| 'conferir' \| 'hc'`; `COUNTED` gains them; `ahead` for the mapped steps (§6.3); `fileSummary`/`emptyFileSummary` unchanged |
| `app/components/hub/importar/passos.tsx` | `PassoErro` (texts §6.9), `PassoMercado` (+ `mercados?: AccountMarket[]`; the «Ainda não lemos…» note only for a market with neither reader nor mapping), `PassoFuso` (every market, §6.5), `PassoNadaNovo` (+ `mapeado`, `unidade`); `PassoPrevia`, `Count`, `ErrorLines`, `SkippedLines` **moved** to `PassoPrevia.tsx` and re-exported from here |
| `app/components/hub/importar/PassoPrevia.tsx` (new) | the moved preview + the mapped lines (§6.6) |
| `app/components/hub/importar/PassoContaArquivo.tsx` (new) | a2 (E5) |
| `app/components/hub/importar/PassoContasDoArquivo.tsx` (new) | hc (E30) |
| `app/lib/hub/importPrevia.ts` (new, pure) | `linhaDoArquivoMapeado`, `planoMapeado`, `zonaDaConta`, `mostrarFuso`, `fusoPreSelecionado`, `recusaLocal`, `relogioDoMercado`, `linhasDoFuso`, `faixaToda`, `linhasDaPrevia`, `motivoDaLinha`, `paresDeAtivos`, `contasDoArquivo`, `valorPreSelecionado`, `linhaDoModelo` |
| `app/lib/hub/contasDb.ts` | `RPC_ERROR_CODES` + `bad_format`, `bad_template`, `too_many_templates`, `unknown_template`; `ImportPreviewResult` + `duplicate_same?`, `other_source?`; `ImportCommitResult` + `duplicate_same?`; `TEMPLATE_COLUMNS`, `fetchTemplates`, `TemplateSaved`, `saveTemplate` (§6.10) |
| `app/hooks/useContas.ts` | `hubKeys.templates`, `useImportTemplates`; the template key in the refresh after a save |
| `app/lib/hub/contas.ts` | if needed, an export for the per-market reference clock (`REFERENCE_TZ` stays for readers); `displaySpan` gains an optional last parameter, the span rule (`faixa = entrySpan`: readers unchanged; mapped files pass `faixaToda`, §6.5) |
| `app/components/hub/contas/copy.ts` | §6.11 (never rename or remove `PLATFORM_LABEL`, `MARKET_LABEL`, `FOLHA`, used by L1 and B0) |
| `app/components/hub/contas/DiarioCabecalho.tsx`, `SuasContas.tsx`, `EditarConta.tsx` | gates `reader \|\| mapping` (E53–E55) |
| `app/components/hub/registrar/copy.ts` | only `ERROS_PRECOS.antesRegras` (E56) |
| `app/styles/hub-importar.css` | §6.12 |
| `app/testing/mapeadoRespostas.ts` (new) | the composed database answers and the board world's rules (§6.10) |
| `CLAUDE.md` | one bullet under `app/lib/domain/import`'s line: the screens' mapping state `lib/hub/importMapeado.ts` (+ `importMapaVista.ts`, `importPrevia.ts`) and the steps `PassoMapa` / `PassoConferir` |
| Tests | §8.2 |

### 6.2 Reading and routing (`onFile`)

1. `lido = await readImportFile(file)` (as built). A reader's file with rows → as built (account in context of its market →
   `afterAccount`; another market → g; none → a). `spreadsheet`, `too_large`, `malformed_csv`, `too_many_rows`, `empty_file`
   → erro, as built.
2. `unknown_format` / `missing_columns` / `duplicate_columns`: `arquivo = await lerArquivoMapeavel(file, lido)`; `header =
   cabecalhoDoLeitor(arquivo)` (B0: the comma read's first record, the header the readers saw, §3.1; never `readCsv(text,
   {maxRecords: 1})`, which throws `too_many_rows` at the second record, nor the sniffed header).
   - With an account in context (`fileTarget` now takes every active account): `routeFile(header, account.market)`:
     `'reader_error'` → erro as built («Faltam colunas…» / «O cabeçalho tem colunas repetidas.»); `'binary_error'` → erro
     E47 with `flow.mapeado = {arquivo, mapeamento: null, cartao}` (E1's card above it); `'mapping'` →
     `comecarMapeamento(account, arquivo)`; `'reader'` cannot happen (the comma read named no reader).
   - Without one: a broken match that `routeFile(header, PLATFORM_MARKET[lido.outcome.platform])` calls `'reader_error'` →
     erro as built; else → `a2` (`flow.mapeado = {arquivo, mapeamento: null, cartao}`, `choice: null`), with `cartao =
     linhaDoArquivoMapeado(arquivo, null, null)` («Arquivo não reconhecido · {n} linhas» from a market-free `sniffFile`; null
     when it fails) on a2 and on the binaries error.
3. `comecarMapeamento(account, arquivo)`: wait for `useImportTemplates` (its data, or `[]` on error); `r =
   iniciarMapeamento(arquivo, {market: account.market, templates, nomePadrao: nomePadraoDoModelo(account.platform)})`; `!r.ok` →
   erro with `r.error` (E49); else `cartao = linhaDoArquivoMapeado(arquivo, r.mapeamento, account.market)` (kept for the file:
   «Mudar colunas» never changes it, IC l.1081–1150) and by `r.mapeamento.inicio`: `'previa'` → `depoisDoConferir` (15);
   `'conferir'` → conferir with E34's chip (`onMudarColunas`) in place of E27 (D20: a model taken as is whose execution file
   still asks the end-of-file question, as owner decision 3 wants every time, or that `arquivoDoMapeamento` cannot make, E29;
   «Usar estas colunas» → `depoisDoConferir`); `'mapa'` → mapa.
4. `depoisDoConferir` («Usar estas colunas», or an exact model): `contasDoArquivo(m).length >= 2` → hc (with
   `valorPreSelecionado`); else `depoisDasContas`.
5. `depoisDasContas`: `f = arquivoDoMapeamento(m, market, null)` (always ok here: a file it cannot make stops on conferir,
   E29, including a model's file, step 3); `mostrarFuso(f, m, account, formats)` → c (preselected `fusoPreSelecionado`); else
   `runPreview(account, zonaDaConta(account, formats) ?? account.file_tz, …)`.
6. `runPreview` / `commit` take an `ImportFile`: for a mapped file `arquivoDoMapeamento(m, market, tz)` (the zone given, so the
   positions are the database's) with `platform: 'modelo'`; `tz_status 'tz_mismatch'` → c with that zone refused (E33), never
   the alert; `'tz_not_confirmed'` (not answered for `'modelo'`) is treated the same: a mapped file never opens `conf`.

### 6.3 Flow state, steps, indicator, «Voltar»

`Flow` gains `mapeado: { arquivo: ArquivoMapeavel; mapeamento: Mapeamento | null; cartao: string | null } | null` (`cartao`:
E1's line, §6.2), `recusados: string[]` (zones the preview refused), `anuncio: string` (L1's `onAnuncio` and hc's line, cleared on every step change), `modelo: { tipo:
'salvo' | 'atualizado' | 'tocado' | 'naoSalvo' | 'erro' | 'limite' | 'semLote'; nome: string } | null`, and `mercadosPermitidos:
AccountMarket[] | null` (i1 from a2). The status text (as built) adds `flow.anuncio` while on mapa / conferir / hc, and E33's
text on c. Steps:

| Step | Body | Primary |
|---|---|---|
| `a2` | `PassoContaArquivo` | «Continuar», blocked «Escolha a conta.» while `choice` is null; an account → `comecarMapeamento`; «+ Nova conta» → i1 with `mercadosPermitidos` = the mapping markets |
| `mapa` | `<PassoMapa arquivo mapeamento market onChange onAnuncio />` | «Continuar», blocked `bloqueioDoMapa(m, market)` → conferir |
| `conferir` | `<PassoConferir … onMudarColunas={m.porModelo ? mudar : null} />` | `CONFERIR.usar`, blocked `bloqueioDoConferir(m, market)` → `depoisDoConferir` |
| `hc` | `PassoContasDoArquivo` | «Continuar», blocked «Escolha qual conta do arquivo vai para {conta}.» → `depoisDasContas` |

Indicator (E2): `COUNTED` gains `a2`, `mapa`, `conferir`, `hc`; `ahead` for them = `planoMapeado(passo, m, account,
formats)`: after a2 `['mapa', 'conferir', 'c', 'd']` (an estimate until the account is chosen), after mapa `['conferir',
…hc?, …c?, 'd']`, after conferir `[…hc?, …c?, 'd']`, after hc `[…c?, 'd']`, with `hc? = contasDoArquivo(m).length >= 2`
and `c? = mostrarFuso(arquivoDoMapeamento(m, market, null), …)` (memoised on `m`). Board counts: 8 «Passo k de 4», 17 and 19
«… de 5», 16 Binance «… de 3», 15 «Mudar colunas» «1 de 3», «2 de 3», «3 de 3», 15's direct «Prévia» none.

«Voltar» (as built, history): mapa → solte (or a2, or b); conferir → mapa with every edit kept (→ solte when the file started
there, `inicio 'conferir'`); hc → conferir; c → hc / conferir; d → c / hc / conferir / mapa / solte (`inicio 'previa'`).
**«Mudar colunas»** (E34, on d or on conferir) → `mudarColunas(m)` and mapa with **`history: []`**: the board starts a new
sequence there (IC l.1706 `setF({mudarCols: true, i: 0})`; IC l.1892 `temVoltar: ix > 0`), so `stepIndicator` counts mapa as
«Passo 1 de 3» (trail [mapa], ahead conferir, d; with the old history the trail [solte, d, mapa] would read «2 de 4», then «3
de 4» and «4 de 4», since `d` is counted and no break follows it) and mapa has no «Voltar»; conferir then «Voltar» → mapa, d →
conferir. Tested in ImportColunas (§8.2): 1/3, 2/3, 3/3 and the three «Voltar» states.
Leaving the sheet as built (a mapped file is no «dirty» form: no «Fechar sem salvar?»).

### 6.4 a2 and «+ Nova conta»

Groups = `MARKET_ORDER` markets with `MARKET_SPEC[m].mapping` and at least one active account, labelled `MARKET_LABEL[m]`;
account pills in the as-built account order (`sortAccounts`: market, `sort_order`, `created_at`; with §4.3's `sort_order` it
is the board's «Top One, Apex A, Ylos 50k, Lucid 50k», asserted in ImportColunas and the `19-a2` spec); nothing preselected
(D7). «+ Nova conta» → i1 («Qual mercado?» with the five
mapping markets in board order, no binaries) → i2 → b («Criar {apelido} e continuar», as built `createAndGo` whenever a file
is in the flow, mapped or not) → after `createFromForm`: `comecarMapeamento(created, arquivo)` (instead of the reader's
`afterAccount`). Step b's read-only row for a mapped file is the as-built «Plataforma» / «Mesa e plataforma» row (no file
platform).

### 6.5 Zone step (E31–E33), G2

- `zonaDaConta(account, formats) = tzConfirmed(account) || (formats[account.id]?.length ?? 0) > 0 ? account.file_tz : null`
  (the account's import zone: confirmed, or already holding imported trades).
- `mostrarFuso(f, m, account, formats) = f.needsFileTz && !(m.match.kind !== 'none' && m.match.template.tzHint !== null &&
  m.match.template.tzHint === zonaDaConta(account, formats))` (15: skipped; 16 Binance: `needsFileTz` false).
- `fusoPreSelecionado`: `zonaDaConta(...) ?? f.fileTzHint ?? (account.platform ∈ {binance, bybit} ? 'UTC' : null)` → its
  `ZoneKey` (a zone outside the five: nothing pressed). 8 Ylos: none; 8 Top One: UTC.
- Refused (E33) when `recusaLocal(account, tz) = tzConfirmed(account) && tz !== account.file_tz`, or `tz ∈ flow.recusados`;
  then the block after the legend, the primary blocked with «Use o fuso das importações da conta: {zoneName(account.file_tz)}.»,
  the live region «Este fuso é diferente do fuso das importações desta conta. Este arquivo usa outro relógio que o das
  importações de {conta}. Confira o fuso na plataforma.».
- `PassoFuso` props become `{ headingRef, market: AccountMarket, linhas: ImportRow[], toda: boolean, palavra: 'entradas' |
  'execucoes', zone, onChange, recusa: { conta: string; zona: string } | null }`. `linhas = linhasDoFuso(file)`
  (`importPrevia.ts`): a reader's rows as they are (as built); a trade file **one row per trade** from `file.positions`
  (`{local_entry, utc_offset}` of each position: the board counts trades, 8 · Performance's bars 1 and 3 for its 6 rows, IC
  l.1133); an execution file one per `executionTimes` entry (`{local_entry: local, utc_offset: offset}`). Each is built as a
  **full `ImportRow`** (`line`, those two fields, every other field neutral: `external_id` null, `symbol` '', `direction`
  'long', `quantity`/`pnl` '0', `result` 'breakeven', `pnl_basis` 'file', the rest null), so `entrySpan`, `entryHistogram`
  (frozen domain, `ImportRow[]`) and `displaySpan` / `zoneBars` (contas.ts) type-check without a cast; these rows only draw
  the step and are never sent. `toda` (mapped files): the spans run from the first to the last entry (`faixaToda(linhas)`:
  the day cut at the largest gap between entries, as `entrySpan` does, then the first and the last minute), as the board's
  captions (16ta «execuções 10:31–11:48», 18 «entradas 06:05–17:48»; `entrySpan`'s p10–p90 would give «10:31–11:31» and,
  with only the 13 out trade after 16:00 as #2 requires, an end before 16:00); readers keep `entrySpan` (as built).
  `relogioDoMercado(market)`: futures NY + band «pregão regular 09:30–16:00 ET» + «Faixas no relógio de
  Nova York (ET).»; forex NY, no band, «… Forex abre 24 h: sem faixa de pregão.»; stocks and options NY + the same band; crypto
  Brasília, no band, «Faixas no relógio de Brasília. Cripto abre 24 h: sem faixa de pregão.»; b3 Brasília + band «pregão
  09:00–18:30» (`.hub-faixa24__banda--b3`, left 37.5 %, width 39.583 %) + «Faixas no relógio de Brasília.»; binary as built.
  Captions «{palavra} {span} ET» (NY reference) / «{palavra} {span} de Brasília»; «No arquivo: {palavra} {span}, sem fuso.».
  The as-built call sites pass the reader's values (no change on screen for Ebinex and Top One).

### 6.6 Preview (E34–E44): `linhasDaPrevia(file, preview, m, conta)` and `PassoPrevia`

Order in the step (D13): undone chip (as built) → E34 (`m.porModelo` only) → E35 (execution files) → E36 → E37 lines → E38 →
E39 (+ the as-built «SL e TP» line, readers) → E40 lines → E41 → E42 → E43.

- **E36 count**, trade files and readers: «linhas» = `rows_total + file.notImported`, «novas» = `new`, then (> 0 only) `linked`
  «já registrada(s) por você», `other_account` «em outra conta», `notImported` «não importadas ({os valores não importados,
  «e»-joined})», then `duplicate` with «já estavam» (0, or `duplicate_same` above 0 but below `duplicate`), «já estavam (mesma
  hora e preço)» (`duplicate_same === duplicate > 0`, N), «já estavam (mesmo ID)» (else), then `errors.length` «com erro».
  Execution files: `rows_total − errors.length` «saídas» («saída» for 1), `new` «novas», (> 0) `linked`, `other_account`, then
  `duplicate` with the same three words; never «com erro».
- **E37** in order, each when > 0: as built otherNote, completable, linked, linkedDiffers; execution files «As {s} saídas viram
  {n} operações.» with `s = file.rows.length`, `n = file.positions.length` (s = 1: «A saída vira 1 operação.»; n = 1: «As {s}
  saídas viram 1 operação.», N); as built agrupadas, anexadas; `unfilled_orders` «{n} ordens sem execução ficaram de fora.» («1
  ordem sem execução ficou de fora.», N); `symbol_normalised` → `paresDeAtivos` (the written spellings from the records whose
  `normaliseFuturesSymbol` differs, first-seen order): «Ativos escritos como “{a}” e “{b}” ficam como “{A}” e “{B}”.» (three or
  more «“a”, “b” e “c”»; one «O ativo escrito como “{a}” fica como “{A}”.», N); `identical_rows` «{n} linhas iguais a outras
  do arquivo (mesma hora, ativo, lado, quantidade e preços) entraram como saídas a mais das mesmas operações.» (1: «1 linha
  igual a outra do arquivo (…) entrou como uma saída a mais da mesma operação.», N); `file_has_offset` «Os horários já trazem o
  fuso ({lista}).» with «+00:00» → «UTC» on mapped files (D12); the as-built reader notices.
- **E38**, trade files and readers as built («{n} linhas com erro foram puladas.»); execution files (any `errors`): all
  `unbalanced_symbol` with exactly one end-of-file question answered «Não sei» → «As {n} execuções de {symbol} ficaram de fora:
  as compras e as vendas do arquivo não fecham.» («1 execução de {symbol} ficou de fora: …», N); all `open_at_end` → «1
  execução de posição ainda aberta no fim do arquivo ficou de fora. Ela entra quando você importar um arquivo que tenha a
  abertura e o fechamento.» / «{n} execuções de posições ainda abertas no fim do arquivo ficaram de fora. Elas entram quando
  você importar um arquivo que tenha a abertura e o fechamento.» (A, D27); all `opened_before_file` → «1 execução fecha uma
  posição aberta antes do começo do arquivo e ficou de fora.» / «{n} execuções fecham posições abertas antes do começo do
  arquivo e ficaram de fora.» (N); else «{n} execuções ficaram de fora.» («1 execução ficou de fora.», N). «Ver linhas» lists
  «Linha {n}: {motivoDaLinha(code, …)}» (§3.3; `off_tick`'s root and tick from the line's record; `bad_direction` on a mapped
  file «lado desconhecido»).
- **E40** in order: no row with a commission and no `commission_other_asset` (mapped files only, not binaries) → «Sem comissão
  no arquivo: estas operações ficam sem comissão.»; `commission_other_asset` → «{n} operação fica|operações ficam sem comissão:
  a taxa veio em {ativos «e»-joined}.»; `result_differs_from_prices` warnings → «{n} com resultado diferente do calculado pelos
  preços: vale o do arquivo.»; `swap_in_result` → «{n} operação|operações com swap: ele entra no resultado, antes da comissão.»
  (plural N); `day_changes` (as built position) with the market's tail: futures «o dia de Futuros vira às 18:00 de Nova York.»
  (as built), binary (as built), forex «o dia de Forex vira às 17:00 de Nova York.» (B), crypto «o dia de Cripto vira à
  meia-noite de Brasília.» (B), stocks and options «o dia de Ações vira às 20:00 de Nova York.» (A), b3 «o dia da B3 vira à
  meia-noite de Brasília.» (A); a trade file without «Saída» and without the buy/sell pair → «Sem hora de saída, o resultado
  conta no limite do dia na hora da entrada.».
- **E41–E42** as built (`linhaAntesDasRegras(config, account.id, file.rows, zoneUsed, operacoesDoArquivo(preview))`; the
  zone line only when `file.needsFileTz`). Scenario 15's E39 ⓘ, E41 and E46 lines follow the owner's G1 (§11.0).
- **E43** `preview.other_source` → «{n} operação cai|operações caem em dias em que {conta} já tem operações de outro formato de
  arquivo. Se forem as mesmas na corretora, elas vão se repetir.» (singular N), for readers too (the key is answered for every
  platform).
- **E44** as built (`operacoesDoArquivo`).

### 6.7 hc (E30)

`contasDoArquivo(m)`: with a column mapped to «Conta», the non-empty values by `accountKey`, the first spelling, the row count
(execution files: rows that are executions), in first-appearance order. `valorPreSelecionado(m, account)`: the value whose key
equals `accountKey(account.external_ref)`; else the value whose `accountRouteHash` routes to this account in the model's
`accountRoutes`; else none («Não importar» everywhere, blocked). Importing one value sets every other to «Não importar»; the
step writes `{...m, accountValue}` (the value as written). Rows «{valor} · {n} op.» (execution files «{valor} · {n} linhas»,
N); the aviso while the imported value's key ≠ the account's number's key (an account without a number: none); the nota on the
values not imported («dela» for one, «de cada uma» for several); live line on a change. One value or none: no hc (N).
**End-of-file answers across hc** (execution files with two or more «Conta» values): «conferir» reads every account's rows,
so the domain asks per account and symbol and the answers are stored under `endOfFileKey(S, conta)`; with `accountValue` set
the domain keys that account's questions by `S` alone (fills.ts `accountKeys`), so `{...m, accountValue}` alone would lose
every «Sim» / «Não» and leave the symbol out as «Não sei». B0's `arquivoDoMapeamento` passes the chosen account's answers
under `S` (§4.1); hc writes only `accountValue`. Tested on `f16c` (§8.2: an answer given on conferir reaches the preview's
args after hc).

### 6.8 Commit, the model save, fim, «Nada novo»

- `commit` (as built, with the `ImportFile`) → on success `s = modeloASalvar(m, {tzHint: file.needsFileTz ? zoneUsed :
  (m.match.kind !== 'none' ? m.match.template.tzHint : null), rota: m.accountValue ? {valor: m.accountValue, contaId:
  account.id} : null})`; `s === null` → `modelo = {tipo: 'naoSalvo'}`; `checkTemplate(s.payload)` not null → `'erro'`; else
  `saveTemplate(db, s.payload, commit.batch_id, s.replaces)` → `s.tipo`; `too_many_templates` → `'limite'`; any other failure →
  `'erro'`. One busy state covers both calls; the model save never shows the sheet's alert. The templates query is refreshed
  after a save.
- **No batch** (`commit.batch_id === null`: the commit inserted and linked nothing, e.g. «Completar…» only, and the database
  deleted the batch): `import_template_save` (525a7da) checks every route against the batch account's market, which it reads
  only from `p_batch`, so any route fails (`bad_template`, hint `account_routes`); and its update path **replaces**
  `account_routes`, so a payload without routes would erase the model's. Hence, with no batch: `tocado` → no call (no line;
  nothing to change); `salvo` → saved with `account_routes` `{}` (a new model loses nothing; the new route waits for an import
  with a batch); `atualizado` → saved with `{}` when the model has no routes, else no call and `modelo = {tipo: 'semLote'}`,
  line «O modelo “{nome}” não foi atualizado: este arquivo não trouxe operações novas.» (N). Never the «não foi salvo» line
  after a good import.
- **fim** (E46): the as-built lines, then `linhaDoModelo(modelo)` (`salvo` «Modelo “{nome}” salvo: os próximos arquivos com
  estas colunas entram direto.», `atualizado` «Modelo “{nome}” atualizado: …», `naoSalvo` «Colunas usadas só neste arquivo.»,
  `tocado` none, `erro` / `limite` / `semLote` the N lines), then «Desfazer depois: …» (as built, only with a batch). Toast and «Desfazer»
  as built (the model stays).
- **«Nada novo»** (f) for a mapped file: no zone block and no «Confirmar fuso» (G2); execution files: «Nada novo: as {n} saídas
  já estão em {conta}.» / «Nada novo: a saída já está em {conta}.» and the count «{n} saídas · 0 novas · {n} já estavam …»
  (N). No model is saved (no commit, C25).

### 6.9 Errors, account creation, outside the sheet

- `PassoErro`: `unknown_format` now says «Em contas de binárias, lemos só o CSV da Ebinex.» (the only way it is reached, E47;
  the old «Por enquanto lemos…» goes, E58); `header_not_found` «Não achamos a linha com os nomes das colunas.» (B);
  `too_many_columns` «O arquivo passa de 100 colunas.» (N); the rest as built (`spreadsheet` from the domain PR).
- b: «Moeda e virada do dia» whenever `!MARKET_SPEC[formMarket].reader` (with or without a file).
- fimConta (E52): for every market, «Nada ainda. Importe o histórico ou registre a primeira operação.», secondary «Registrar
  operação» (when `podeRegistrar`), primary «Importar histórico» → solte on the new account; a MetaTrader platform (`mt4`,
  `mt5`): «Nada ainda. Registre a primeira operação.» + `RELATORIO_MT[platform]`, «Registrar operação» primary, no «Importar
  histórico»; IQ Option as built. `FIM_CONTA.semLeitorArquivo`'s «Ainda não lemos arquivos …» never shows.
- E53 `DiarioCabecalho`: `importId` for `reader || mapping`. E54 `SuasContas`: «Importar» (button and menu) and «Importações»
  for `reader || mapping`; the group note only for a market with neither (none today). E55 `EditarConta`: «Fuso do arquivo»
  for `reader || mapping`. `CONTAS.info` (A). E56 Registrar's `antesRegras` (A).

### 6.10 Data layer and fixtures

```ts
// contasDb.ts (additions)
export const TEMPLATE_COLUMNS =
  'id, name, header_sig, headers, header_skip, delimiter, decimal_mark, date_order, row_kind, columns, result_is_net, side_words, open_close_words, account_routes, tz_hint, last_used_at'
/** The caller's models (RLS: own rows), most recently used first; a row templateFromRow cannot use is dropped */
export async function fetchTemplates(db: SupabaseClient): Promise<Template[]>
export interface TemplateSaved { template_id: string; header_sig: string; created: boolean }
export const saveTemplate = (db: SupabaseClient, payload: TemplatePayloadV1, batchId: string | null, replaces: string | null) =>
  rpc<TemplateSaved>(db, 'import_template_save', { p_template: payload, p_batch: batchId, p_replaces: replaces })

// useContas.ts (additions)
hubKeys.templates = (uid) => ['hub', uid, 'templates']
export function useImportTemplates(enabled = true)   // fetchTemplates, as useImportFormats
```

`app/testing/mapeadoRespostas.ts` (L2's, new): `regrasQuadro()` (a `RulesConfig` whose first versions start 14 out for Top One,
Ylos 50k, Apex A and 15 out for the others, built like `testing/regras.ts`); `previaQuadro(estado)` / `commitQuadro(estado)` —
one `ImportPreviewResult` / `ImportCommitResult` per board state of §2.2 (8 sem/outro/performance, 15 mesmas/mais, 16 ×4 with
each end-of-file answer, 17 APX-0001/APX-0002, 18 per zone, 19 and «Pular», 19p, re-imports for «Nada novo»), with
`rows_total`, `errors` (the B0 file's lines), `trades_new`/`grouped`, `linked`, `duplicate(_same)`, `other_source`,
`day_changes`, `tz_*`. **Each composed answer is proven equal to the real one** in `__tests__/lib/hubImportTelas.pg.test.ts`
(§8.2), which imports the B0 files through the real SQL in the board's world (the accounts, the rules, a Top One Trade History
in UTC on 1–13 out for G1, scenario 8's file before 15's, a registered app trade for 15's «1 já registrada por você»).

### 6.11 Copy (`contas/copy.ts` additions; marker in a comment on each)

`ARQUIVO.info` (B IC l.623), `.naoReconhecido(n)` «Arquivo não reconhecido · {n} linhas» (B l.1081), `.parecido(nome, n)`
(B l.1134), `.doModelo(nome, …)` «Modelo “{nome}” · {mercado} · {ops} · {dias}» (B l.1085; execution files «{n} linhas» in
place of «{ops}», N) · `PASSO_A2` (B l.439–445, 1643, 1914) · `PASSO_HC` (B l.451–459,
1630–1640, 1912; N forms) · `PASSO_C` (`inFile(palavra, span)`, `cap(palavra, span, ref)`, legends and bands B l.1167–1177,
`recusaTitulo` B l.357, `recusa(conta)` B l.1128, `recusaDica(zona)` B l.1902) · `PASSO_D` (`execucoes` B l.367, `saidas` B
l.794, `naoImportadas` B l.1002, `alreadySame` N, `saidasViram` B l.891, `ordensSemExecucao` B l.891, `ativosNormalizados` B
l.1003, `linhasIguais` N, `sobras*` B l.785–790, 905, 949, 974, `semComissao` B l.783, `taxaOutroAtivo` B l.935, `difere` B
l.793, `comSwap` B l.1037, `semSaida` B l.784, `dayChanges(count, market: AccountMarket)` B/A, `g1(n, conta)` B l.816) ·
`rowErrorReason(code, extra & {mapeado?: boolean, raiz?, passo?})` (B l.788–790, 974, 1069; N codes; on a mapped file
`bad_number` prints `CAMPO[column]` from B0's `copyMapa.ts`, §3.3) · `PASSO_F.saidas*` (N) · `FIM_MODELO` (B l.1619–1620; N
`erro`, `limite`, `semLote`) · `ERRO.unknownFormat` (A: binaries text B l.1850), `.headerNotFound` (B
l.1849), `.tooManyColumns` (N) · `ERROR_TEXT` + 4 codes (N) · `CONTAS.info` (A) · `FIM_CONTA` (as built; `semLeitor*` kept,
never shown). `registrar/copy.ts` `ERROS_PRECOS.antesRegras` (A). A test: no prototype label and no E58 string in any copy
file.

### 6.12 Keyboard, accessibility, layout; `hub-importar.css`

- a2: pills `aria-pressed` 44 px, groups `role=group aria-labelledby=a2-g{k}`; Tab: the groups' pills in order → «+ Nova conta»
  → footer. hc: one native select per row (`aria-label`), aviso and notas plain text; Tab: the selects → footer. c: as built
  (radios, select); the refusal block is text (never colour alone). d: as built + E34's «Mudar colunas» and «Ver linhas»
  (`aria-expanded`/`aria-controls`).
- The live region: as built + `flow.anuncio` (mapa, conferir, hc) + E33.
- `hub-importar.css`, every rule under `.hub`, tokens only: `.hub-grupo-a` (column, gap 6), `.hub-conta-linha` (flex wrap, gap
  4/10, padding 6 0, top border; the text `flex 1 1 150px`, the select `flex 1 1 170px`), `.hub-faixa24__banda--b3` (a new
  modifier of hub.css's `.hub-faixa24__banda`, which it does not restyle). Never a rule on a class an existing stylesheet
  defines (§5.9). Contrast test (both themes) for any new text colour; 44 px for the new interactive elements; 375: rows
  stack, no horizontal scroll.

---

## 7. Ownership, frozen files, merge

### 7.1 L1 (exclusive): §5.1. ### 7.2 L2 (exclusive): §6.1.

### 7.3 Frozen (no lane edits; a needed change stops the lane and is reported: file, change, reason)

`app/lib/domain/**`; `supabase/**`; `app/testing/**` that exists at B0 (incl. `mappedFiles.ts`, `telasShots.ts`, `hubHarness.tsx`,
`regras.ts`) and B0's `mapeadoTelas.ts` + `__tests__/testing/mapeadoTelas.test.ts`; `app/app/(hub)/layout.tsx`;
`app/components/hub/importar/ImportSheetProvider.tsx`, `RegrasDaConta.tsx`; `app/components/hub/contas/ui.tsx`,
`Importacoes.tsx`, `SeletorConta.tsx`, `copyRegras.ts`; every `app/components/hub/registrar/*` file except the one string of
`copy.ts` (L2); `app/lib/hub/*` except the files the lanes own (L1: `importMapeado.ts`, `importMapaVista.ts`; L2:
`contasDb.ts`, `importPrevia.ts`, `contas.ts`); `app/hooks/*` except `useContas.ts` (L2); `app/styles/hub.css` and every
stylesheet but the lanes' two; every existing test not listed in §8.

### 7.4 Order

1. The orchestrator commits **B0** on `fase-3b/telas` (= `fase-3b/dominio` 4541996 + B0), runs its checks (§4), and creates
   both lane worktrees from its tip.
2. Both lanes work in parallel; coherent commits; each finishes with §8.4.
3. **Merge L1 first** into `fase-3b/telas` (L2 renders L1's components and calls its functions). L2 rebases on it, turns its
   flow suite's placeholder expectations into the real steps' (§8.2), re-runs everything (database-backed suites too) and
   merges. Then the `base` shots (§9) on `fase-3b/telas`.
4. The PR «Fase 3b · telas» goes into `feature/rebuild-lean` stacked on #38 (on #37) and **merges only after the owner pasted
   `fase3b_aplicar.sql`, after #37 and #38 in that order, and after his test** (§10). `main` only on his request.

---

## 8. Tests per lane (Jest + Testing Library; database-backed suites on throwaway clusters only)

**Fixtures.** B0's `testing/mapeadoTelas.ts` (the board's world and files, frozen), the domain's `testing/mappedFiles.ts`
(frozen), L2's `testing/mapeadoRespostas.ts` (the composed answers, each proven against the real SQL in
`hubImportTelas.pg.test.ts`). Never hand-written `MappedFile`s: always the domain's `parseMappedRecords` (through
`arquivoDoMapeamento`). Clock: `HOJE_QUADRO` (`useAgora` mocked as the existing suite does).

**Mocks.** L1's component suites render a step alone inside a host that keeps the `Mapeamento` in `useState` (no database, no
sheet). L2's sheet suites mock `@/lib/hub/contasDb` (`fetchAccounts`, `fetchImportFormats`, `fetchTemplates`, `createAccount`,
`importPreview`, `importCommit`, `importUndo`, `importFixTz`, `saveTemplate`), `readImportFile` → `lidoQuadro(key)` while the
input receives `arquivoQuadro(key)` (so `lerArquivoMapeavel` reads the real text), `regrasDb.fetchRulesConfig` →
`regrasQuadro()`, and stub `RegistrarSheet` as the existing suite does.

**Who edits which existing suite.** No existing suite is shared: L1 edits none; every existing suite that changes is L2's
(`ImportSheet.test.tsx`, `SuasContas.test.tsx`, `DiarioCabecalho.test.tsx`, `hubContasDb.test.ts`, and the **three** suites
that pin `ERROS_PRECOS.antesRegras`'s old text «… entram pela importação por colunas, logo depois da Fase 3.» (4541996):
`__tests__/components/hub/RegistrarResultado.test.tsx` l.200, `__tests__/lib/hubRegistrarFormMercados.test.ts` l.291 and
`__tests__/lib/hubRegistrar.test.ts` l.49 (`toContain` on the copy file), each only in that assertion). New tests always go
to the lane's new files.

### 8.1 L1

| File | Covers |
|---|---|
| `__tests__/lib/hubImportMapeado.test.ts` (B0's, edit) | B0's cases + the edits of §5.2 on every B0 file; the pre-fill rule (§5.3) gives §2.2's columns and tags on every file; `comSeparador` (8 «,» → `header_not_found` on the same header line → kept, note, block, never `f8`'s data cells as names; back to «;» → clean; a file whose re-read with `headerSkip` works → fresh columns); `inicio` / `porModelo` / `mudando` (§4.1's cases, and `mudarColunas` from 'previa' and from 'conferir'); decimal and dates re-decided on a column change, pressed pills kept; the mode switch keeps each kind's edits; `bloqueioDoMapa` / `bloqueioDoConferir` order; `modeloASalvar` never refused by `checkTemplate` once both pass (every file × the board's edit paths) |
| `__tests__/lib/hubImportMapaVista.test.ts` (new) | every E7–E29 string of every §2.2 state (the board's strings): titles, chips, the notes in order per file, checks (Papel → «Quantidade», buyFillId → «ID…», «Swap ou funding» without «Resultado»), the duplicate line, chip labels (IBKR's «Lado (ou quantidade com sinal) ✓», and «… · falta» with «Quantity» on «Escolha…»; Forex «Lado»), E7's three titles (an exact model with misfits → «Este arquivo mudou…», never «Mude as colunas…»), the «ex.:» samples (`f16t` «10/13/2026 10:31:04», «6816.00»), the three questions (18a, 19p with and without the tick nota, 19's «X» and its singular), every hint in order, the rows of every file (units per market, «pelos preços», «—»), the notes (R2, both «Supomos …» forms, the same-entry note), E24's sub and notas for every answer on 16ta and 16b (7, 3, 1 executions) and the partial «Sim» note on a file where the open lot is part of an execution (buy 3, sell 2: «A parte ainda aberta da posição (1 contrato) …», never «(0 execuções)»), E25 per answer (= the positions; «Ver as 4 operações» / «Ver a operação»), E26's forms and evidence (8, 17, 18, 19), E27's labels; every N form; no prototype label and no «exemplo» in `copyMapa.ts` |
| `__tests__/components/hub/ImportMapa.test.tsx` (new) | `PassoMapa` with a host on 8, 8 · Performance, 16 Tradovate, 19: «Mudar» (`aria-expanded`, focus stays), «,» → note + `onAnuncio`; Papel → «Quantidade» (`aria-invalid`, `aria-describedby`, check text, duplicate block, «sugerida» gone); the mode switch and back (edits kept); question pills by keyboard (Tab, Space); Tab order of §5.7; the execution variant |
| `__tests__/components/hub/ImportConferir.test.tsx` (new) | `PassoConferir` with a host on 8, 15b, 16ta, 16b, 17: the rows list with hidden separators; the net pills; the checkbox and «Nome do modelo» (max 60, emptied → `nomePadrao` saved); 16ta's answers change E25 (`role=status`) and call `onAnuncio`; «Ver as 4 operações»; «Atualizar o modelo “BlackArrow”»; E29; with `onMudarColunas` (16ta + `modeloTradovate()`): the chip row after the order line, no E27, «Mudar colunas» calls it; `f16c`: the per-account question form and its answer stored under the composite key |
| `__tests__/components/hub/ImportMapaCss.test.tsx` (new) | `hub-importar-mapa.css`: every rule under `.hub`; no `.hub-tag` selector and no class an existing stylesheet defines unless scoped under a new class (§5.9); one column at ≤ 480 px; 44 px targets; the contrast table of §5.9 in both themes |
| `__tests__/lib/hubImportMapa.pg.test.ts` (new, database-backed) | on a throwaway cluster: every B0 file as L1 leaves it (pre-fill + the board's answers) → `modeloASalvar` → `import_template_save` accepts (`created`); the saved row read back (`templateFromRow`) → `iniciarMapeamento` on the same file → exact, `porModelo`, the same `escolhasDe`; execution files per end-of-file answer: `import_preview`'s `trades_new ?? new` = E25's n, `grouped` = Σ (exits − 1), `errors` = the lines E24's nota counts; trade files: the stored `pnl` (commit) = the file's gross under the pre-answered net question |

### 8.2 L2

| File | Covers |
|---|---|
| `__tests__/components/hub/ImportSheet.test.tsx` (edit) | only the as-built expectations 3b changes: the 2b describes («an account without a file reader is never a file's destination» → every market is one), the «Qual mercado?» note, «{conta} criada.» for the new markets («Importar histórico» + «Registrar operação»; MetaTrader), `unknown_format`'s text, the card's ⓘ; everything else unchanged |
| `__tests__/components/hub/ImportColunas.test.tsx` (new) | the sheet through every §2.2 state (placeholders before L1's merge, the real steps after the rebase): routing (reader; `reader_error` with and without an account; mapping; `binary_error`; sniff failures; spreadsheet); the header `routeFile` gets (a «;» file with Top One's names stays a mapping); a2 (the card «Arquivo não reconhecido · 18 linhas», groups and the board's account order «Top One, Apex A, Ylos 50k, Lucid 50k», nothing pressed, hint, «+ Nova conta» → i1 without binaries → i2 → b → mapa); the binaries error with the card; 15 straight to «Prévia», E34, «Mudar colunas» → mapa «Passo 1 de 3» without «Voltar» → conferir «2 de 3» («Voltar» → mapa) → d «3 de 3» («Voltar» → conferir) → «atualizado», the card unchanged throughout; «Mudar colunas» from conferir too; a saved «Tradovate» model + `f16ta` → conferir first with the chip and E24, then «Prévia» (owner test step 4); 15b; hc (by number, by route, none → blocked; a switch → aviso + live line; «não importadas (…)»; `accountValue` in the args; `f16c`: «Sim» given on conferir for LT50K-0193 reaches `importPreview`'s rows after hc, as `open_at_end` and not `unbalanced_symbol`); the zone rule (8 Ylos nothing pressed; Top One UTC pressed, Brasília refused on the step; an unconfirmed account holding imports refused after the preview's `tz_mismatch`; 15 and Binance skipped); «execuções» captions; the zone step's spans and bars per trade / execution (8 · Performance 1 and 3, 16ta «10:31–11:48», 18 «06:05–17:48»); every preview line and its order per state (E35–E43), the primaries; the commit's args (`p_platform 'modelo'`, `p_format {sig, template}`, the rows on the chosen zone); the model save (payload, `p_batch`, `p_replaces`, each end line, failures as lines, never the alert; no batch: no touch, a new model without routes, «… não foi atualizado: …» for a model with routes); a mapped file's «Ver linhas» with «número inválido em Preço de entrada» (never a field key); toast; «Desfazer» keeps the model; «Nada novo» for a mapped file; the indicator's counts; «Voltar» chain; no «Como exportar» anywhere; fimConta per market and platform; scenario 9; a reader file calls exactly the as-built RPCs and never reads `import_templates` |
| `__tests__/lib/hubImportPrevia.test.ts` (new) | every function of `importPrevia.ts` on the B0 files and the composed answers (card lines, `planoMapeado`, zone rule, leftovers' headline forms, `motivoDaLinha`, `paresDeAtivos`, `contasDoArquivo`, `valorPreSelecionado`, `linhaDoModelo`) |
| `__tests__/lib/hubContasDb.test.ts` (edit) | `fetchTemplates` (columns, order, rows it cannot use dropped), `saveTemplate` (args, answer, errors → the new codes), the widened types |
| `__tests__/components/hub/SuasContas.test.tsx`, `DiarioCabecalho.test.tsx` (edit) | the gates for Forex, Ações, Cripto, B3 (and «Fuso do arquivo» in Editar conta), no `CONTAS.semLeitor` note, `CONTAS.info` |
| `RegistrarResultado.test.tsx`, `hubRegistrarFormMercados.test.ts`, `hubRegistrar.test.ts` (edit: the one assertion each) | E56 |
| `__tests__/components/hub/ImportFluxoCss.test.tsx` (new) | `hub-importar.css`: scoping, no class an existing stylesheet defines (§5.9), 44 px, the b3 band, contrast of any new pair |
| `__tests__/lib/hubImportTelas.pg.test.ts` (new, database-backed) | §6.10's proof (every composed answer = the real one) and the wrappers on the real SQL: `fetchTemplates`/`saveTemplate` create, touch (exact), `p_replaces` (changed), the route saved and preselected next time; with no batch (a re-import that only completes): no touch call, a new model saved without routes, a model with routes untouched (`account_routes` read back unchanged); G2 (Top One UTC: Brasília → `tz_mismatch` on preview and commit; `recusaLocal` agrees); G1 `other_source` 18 and none on a re-import; «Nada novo» on a re-import; «Desfazer» keeps the model; a Top One file answers exactly as before (no `p_format`) |

### 8.3 Copy checks (each lane, in its own suite)

No prototype label (§0), no «exemplo», and no E58 string in the lane's copy files; every string of the lane's copy file carries
its marker.

### 8.4 Before finishing (each lane)

`npx jest --ci` (all suites); when clusters are allowed, `BH_PG_PORTS="<p1> <p2>" scratchpad/fase3b/telas/pg_run.sh
<worktree> <p1>` (the 9 existing database-backed suites + the lane's new one; ports given by the orchestrator); `npx tsc
--noEmit`; `npx next lint`; §8.3; `git status` clean but the lane's files; when screenshots are allowed, the lane's set (§9),
listed in the report (`ls`, count, size). In a run marked «no screenshots / no clusters», the report lists those steps as
pending.

---

## 9. Screenshot plan

**Goal:** every board state of §2.2 rebuilt in the app with invented data, at **375, 768 and 1280** px, **claro and escuro**,
to put next to the board.

**Harness** (`fase3b/telas/shots_3c.md`, unchanged method): the tools in `scratchpad/fase3b/telas/shot_tools/` still point at
3c (`T=…/fase3c/telas`, lanes `c1|c2|base`). Before any shot the orchestrator copies them to
`scratchpad/fase3b/telas/shots/tools/` with `T=…/fase3b/telas` and lanes `l1|l2|base|integ|final`, and re-runs the smoke spec.
Visual specs: `scratchpad/fase3b/telas/visual/<lane>/*.visual.test.tsx` (never in the worktree; the runner copies them to
`app/__tests__/__visual__/` for the run). Output: `scratchpad/fase3b/telas/shots/<lane>/<cenario>-<estado>-<largura>-<tema>.png`
+ `index.html`; `quadro` = «IC {cenário} · {variante do Arquivo:}: {os cliques}» in the approved canvas (version 67). Each spec
asserts the state's strings (from §2.1/§2.2) before `fotografar`. The sheet is shot unrolled (`moldura 'folha'`), Suas contas
in `'pagina'`. ≥ 1,5 GB free on `/` (the runner refuses below); none of it in this run.

| Lane | Scenario | States (`<cenario>-<estado>`) |
|---|---|---|
| L1 | 8 | `8-mapa`; `8-mapa-mudar-virgula` (panel open, «,», note); `8-mapa-papel-qtd`; `8-conferir`; `8-conferir-bruto` («Não, é bruto» pressed); `8g-conferir` («Minha plataforma») |
| L1 | 8 · Performance | `8p-mapa`; `8p-mapa-id` (buyFillId → «ID…»); `8p-conferir` |
| L1 | 15 | `15-mudar-mapa` («Mude as colunas…»); `15-mudar-conferir` («Atualizar o modelo …»); `15b-mapa` («nova»); `15b-conferir` |
| L1 | 16 | `16t-mapa`; `16t-conferir-ops` («Ver as 4 operações» open); `16ta-conferir-modelo` (N: the chip in place of E27); `16ta-conferir-naosei`, `-sim`, `-nao`; `16b-mapa`; `16b-conferir-naosei`, `-sim`, `-nao`; `16i-mapa`; `16i-conferir` |
| L1 | 17 | `17-mapa`; `17-conferir` |
| L1 | 18 | `18-mapa`; `18-conferir`; `18a-mapa` (question, hint); `18a-mapa-respondida` |
| L1 | 19 | `19-mapa` (X question); `19-mapa-venda`; `19-conferir`; `19p-mapa`; `19p-mapa-decimal` (tick nota, hint); `19p-conferir` |
| L1 | focus | `8-mapa-foco-separador` (focus on «,» with the panel open); `8-mapa-foco-select` (Papel's select with its check) |
| L2 | 19 | `19-solte`; `19-a2` (the card, the board's account order); `19-a2-escolhida` |
| L2 | 8 | `8-c`; `8-c-ny`; `8-d`; `8-d-bruto`; `8-fim` (+ toast); `8g-c` (UTC pressed); `8g-c-brasilia` (E33, hint); `8g-d` (G1); `8p-c`; `8p-d`; `8p-fim` |
| L2 | 15 | `15-d` (E34); `15-fim`; `15-mudar-d`; `15-mudar-fim` («atualizado»); `15b-d`; `15b-fim` |
| L2 | 16 | `16t-c` («execuções»); `16t-d`; `16t-fim`; `16ta-d-naosei` (leftovers, «Ver linhas» open), `-sim`, `-nao`; `16b-d-naosei`, `-sim`, `-nao` (no zone line); `16i-c`; `16i-d` («Ver linhas» open) |
| L2 | 17 | `17-hc`; `17-hc-trocada` (aviso); `17-c`; `17-d`; `17-d-apx2` |
| L2 | 18 | `18-c-chicago` («Outro» → Chicago); `18-d`; `18-d-chicago`; `18-d-liquido` («Sim» → 12 differs) |
| L2 | 19 | `19-c` (B3 band); `19-d` («Ver linhas» open); `19-d-pular`; `19p-d` |
| L2 | 9 / 11–14 | `9-binarias` (the card above E47); `9-excel`; `9-ilegivel`; `11-fim-conta` (MetaTrader); `12-fim-conta`; `14-fim-conta`; `i1-mercados` (no note) |
| L2 | outside | `contas-forex` (Suas contas with «Importar» on Forex/B3 rows, page frame) |
| L2 | focus | `17-hc-foco` (a select); `8g-c-foco` (the refused radio) |
| base (after both merges) | 8 / 15 / 16 / 19 | the full paths with the real steps: `8-caminho-mapa`, `8-caminho-conferir`, `15-caminho-mudar-mapa` («Passo 1 de 3», no «Voltar», the card «Modelo “BlackArrow” · …»), `15-caminho-mudar-conferir` («Passo 2 de 3»), `16ta-caminho-modelo` (the saved «Tradovate» model: conferir first, «Passo 1 de 2»), `16ta-caminho-conferir-sim`, `19-caminho-mapa` (each the same state as L1's, reached through the sheet from «solte») |

About 110 states × 6 ≈ 660 shots, 35–45 MB. Each lane's report lists its set; partial runs go to `shots/_parcial/<lane>/` and
are deleted before reporting. The zone bars count trades / executions as the board; where they still differ, §11.1 #6.

---

## 10. Off until the paste; the owner's test

### 10.1 How the screens stay off

- **No flag.** The screens are the third PR of a stack (#37 banco → #38 domínio → «Fase 3b · telas») and merge into
  `feature/rebuild-lean` only **after the owner pasted `fase3b_aplicar.sql`**, after #37 and #38 in that order, and after his
  test (as 3c). `main` is promoted only on his request. No deploy has them before that.
- Nothing in the lanes calls the live Supabase (§0).
- **A reader file never touches 3b** (tested, §8.2): the Ebinex and Top One paths call exactly the as-built RPCs with exactly
  the as-built arguments, and `useImportTemplates` is enabled only once a file needs the mapping, so `import_templates` is never
  read for them.
- Should a build ever run against a database without the paste: the templates read fails and counts as «no model»; the first
  `import_preview` with `p_format` fails (no such signature) and shows the as-built «Algo deu errado. Tente de novo.»; nothing is
  written.

### 10.2 The owner's test (after the paste, before any merge; sintese §2.5)

- **Run**: the orchestrator runs `fase-3b/telas` locally over the LAN (`next dev -H 0.0.0.0 -p 3001`, a launch config
  `binary-hub-fase3b`, the owner's `app/.env.local` linked into the worktree by the orchestrator; the lanes never do this) and
  the owner opens it on his phone.
- **Files**: invented CSVs written from B0's files to `scratchpad/fase3b/telas/teste_dono/` (never committed).
- **Accounts** (R16): «Apex #1» (futures) and two throwaway accounts made in the test, «Teste 3b Forex» and «Teste 3b B3»,
  archived at the end; his Top One and Ebinex accounts are not touched.
- **Plan row** (pt-BR, sintese §2.5): «Numa conta de teste (Futuros, Forex ou B3), importar um CSV inventado de outra
  plataforma dizendo o que é cada coluna. Reimportar o mesmo arquivo: 0 novas, sem aviso de outro formato. Um segundo arquivo
  com as mesmas colunas entra direto pelo modelo. Um arquivo de execuções vira operações, com as parciais juntadas; um ativo que
  não fecha no fim do arquivo é perguntado. Desfazer os lotes no fim.»
- **Steps** (pt-BR in the PR body): 1) Apex #1 › «Importar arquivo» › `blackarrow.csv` → «mapa» → «Confira 3 linhas» → fuso →
  «Prévia» → importar; 2) o mesmo arquivo de novo → «Nada novo», sem aviso de outro formato; 3) `blackarrow-2.csv` → direto à
  «Prévia» com «Colunas do modelo “…”»; 4) `tradovate-ordens.csv` → «uma execução» → «Ver as 4 operações» → importar;
  `tradovate-posicionado.csv` (mesmas colunas: o modelo «Tradovate» o lê) → «Confira 3 linhas» com «Colunas do modelo
  “Tradovate”» e a pergunta do fim do arquivo (Sim / Não / Não sei), depois «Prévia» (§6.2 step 3: an exact model whose
  execution file asks starts on «conferir», never straight at «Prévia»); 5) «Teste 3b Forex» › `forex.csv` (swap);
  6) sem conta escolhida › `b3.csv` → «Para qual conta?» → «Teste 3b B3»; 7) Personalizar › Suas contas › Importações:
  «Desfazer» cada lote. The models made in the test stay (there is no list in 3b); if he wants them gone, a one-line delete he
  pastes himself.

---

## 11. For the owner (PR body) and the decisions this contract takes

### 11.0 Owner gate (the orchestrator asks before B0; the lanes start after his answer)

**ANSWERED 2026-10-22: (a).** The as-built lines stay (whole-file ⓘ and «Antes de…»); §11.1 #3–#4 go to the PR body. No database change.

Only the two numbers of §11.1 #1–#2 may differ from the board without asking. One more difference cannot be avoided on the
final database:

**G1 · Scenario 15** («As mesmas colunas», and its «Uma coluna a mais» and «Mudar colunas» paths). The board's preview has no
«Antes de…» line, its ⓘ reads «Bruto +US$ 62,50 · comissões −US$ 8,68.» (the 6 rows the import inserts or completes) and its
end «5 operações importadas.» (IC l.818–823, 1866). `import_preview` / `import_commit` (525a7da) answer counts only
(`first_day`/`last_day` span every row without an error, duplicates included), so the browser cannot tell the 6 new rows
from the 18 already imported, and the as-built rules count the whole file: «Antes de 14 out (início das regras): até 5 vão
para Histórico importado · só resultado.», «Bruto +US$ 103,75 · comissões −US$ 34,72.», «5 operações importadas. As de antes
de 14 out ficam em Histórico importado · só resultado, à parte do Diário.». Options: **(a)** accept these lines in 3b (they
go to the PR body as §11.1 #3–#4; nothing else changes); **(b)** keep the board: the database must say which rows are new
(e.g. their lines in both answers), a change to #37, which is final, so a follow-up database PR lands first and L2 builds
E39/E41/E46 on it. No default: the lanes wait for his answer. Question ready to paste (pt-BR):

> No cenário 15 (o mesmo arquivo BlackArrow de novo, com 6 linhas novas), o quadro mostra só as linhas novas: sem a frase
> «Antes de 14 out…», ⓘ «Bruto +US$ 62,50 · comissões −US$ 8,68.» e no fim «5 operações importadas.». O banco aprovado (PR
> #37) não diz quais linhas do arquivo são novas, então o app conta o arquivo todo, como já faz hoje: «Antes de 14 out (início
> das regras): até 5 vão para Histórico importado · só resultado.», ⓘ «Bruto +US$ 103,75 · comissões −US$ 34,72.» e no fim «5
> operações importadas. As de antes de 14 out ficam em Histórico importado · só resultado, à parte do Diário.». (a) Fica
> assim na 3b? (b) Ou prefere como no quadro, o que pede uma mudança no banco (PR #37) antes das telas?

Everything else the board draws is built as drawn (the 22 Oct reviews' findings: §2.3 D14, D19, D20 and §6.3), but for the
bar heights of §11.1 #6, which no file can draw with the board's own counts (31 trades in 5:4:3:2:1, 16 trades in an
18-unit drawing), the domain's frozen IBKR file and #2.

### 11.1 Where the app differs from the approved board

1. **IBKR commissions** (16 · Interactive Brokers): «comissões −US$ 5,00», not 6,00: only the imported executions' costs count
   (the option, the close from before the file and the open TSLA stay out with theirs). The domain proved it on the real SQL.
2. **Forex with Chicago** (18): «1 operação fica em outro dia que o do arquivo …», not 2: with the 17:00 New York turn only the
   13 out 17:48 entry changes day. Proved on the real SQL.
3. **(Only with the owner's G1 (a), §11.0) Scenario 15's rules lines**: the preview adds «Antes de 14 out (início das regras):
   até 5 vão para Histórico importado · só resultado.» and the end «5 operações importadas. As de antes de 14 out ficam em
   Histórico importado · só resultado, à parte do Diário.»; the board shows neither. The file also holds the 18 rows of 1–13
   out already imported, and the database does not say which rows are new.
4. **(Only with G1 (a)) Scenario 15's commission ⓘ** sums the whole file, as for every file today: «Bruto +US$ 103,75 ·
   comissões −US$ 34,72.» (the board shows the 6 new rows only).
5. (Withdrawn: the Tradovate hint is not built; it stays with step i3, §12.)
6. **Zone bars where the files cannot match the drawing** (the captions, the band and every other bar are the board's; bars
   count trades and executions, as the board): 16 · Interactive Brokers (the domain's frozen file has an execution at 14:00
   where the board draws a second one at 11:30, so the app draws eight single, full-height bars where the board draws six
   half-height bars and one full); 17 (31 trades cannot make the board's 5:4:3:2:1: the 11:30 bar reads 30 % for 20 %);
   18 (the board's 16:00 trade sits at 15:30: with #2, no trade may enter between 16:00 and 17:00 New York); 19 (the two
   refused lines are not drawn, so the 11:00 and 14:00 bars are lower).
7. **«Ignorar esta coluna» pre-set**: a column is pre-set to «Ignorar» when it repeats another's field (Tradovate's
   avgPrice…), is a known non-field (Status, duration, Limit Price, Stop Price) or is an ID that repeats; any other unknown name
   starts at «Escolha…». This gives exactly the board on its eight files.
8. **Words the board does not draw** (examples in the PR): «já estavam (mesma hora e preço)»; the singular/plural forms;
   «Nada novo: as N saídas já estão em …»; the hc rows of an execution file «… · N linhas»; a single «Conta» value skips «N
   contas neste arquivo»; «+ Nova conta» from «Para qual conta?» goes through «Qual mercado?» (without binárias), «Onde você
   opera?» and «Nova conta de …»; the model-save failure lines; «Escolha como ler os números.»; «Responda a pergunta sobre o
   resultado do arquivo.»; the conferir failures; «O arquivo passa de 100 colunas.»; the new row reasons; the error texts of
   the new database codes; the identical-rows line; «A coluna … já diz o fuso: … UTC−3» forms; «A parte ainda aberta da
   posição (…) fica de fora …»; «O modelo “…” não foi atualizado: este arquivo não trouxe operações novas.»; «número inválido
   em Preço de entrada» (the column's label); «Confira 3 linhas» with «Colunas do modelo “…”» when a saved model's execution
   file ends positioned (the question is asked every time, owner decision 3); «Mudar colunas» also there.
9. **«Nada novo» of a mapped file** has no «Confirmar fuso»: a mapped file never confirms or moves another format's zone (G2).
10. **Screenshots** show a sheet unrolled (the whole step, footer at its end) with invented data; compare content and layout,
    not scrolling.

### 11.2 Decisions this contract takes (for the orchestrator)

1. One cross-lane interface (B0) committed before the lanes: the shared state type, its plumbing with reference bodies, the
   three components' props as placeholders, the B0 copy keys, the board-sized files; L1 owns the code from there, the files are
   frozen.
2. L1 never touches the database or the sheet; L2 owns every database call, the flow, the preview and the model save.
3. The model is saved (or touched) **after** the commit, through `import_template_save` with `p_batch` and `p_replaces`; a
   failure is a line on the end screen, never a lost import.
4. The G2 refusal is local for a confirmed account and comes from the preview's `tz_mismatch` for an unconfirmed one holding
   imports (the browser cannot see whether those trades have offsets).
5. The B0 files are composed to the board's numbers, and every composed database answer is proven against the real SQL
   before a test or a shot relies on it.
6. «Escolha…» and «Ignorar esta coluna» are both «no field» for the domain; the screen keeps them apart only to draw the board.
7. Scenario 15's rules lines and commission ⓘ are the owner's call (§11.0 G1): the board needs the database to say which rows
   are new, which it does not.
8. `CONTAS.info`, the gates and Registrar's «… pela importação de arquivo.» change with this PR (quadro §4.2), though not on this
   board.
9. A mapped file's zone step follows the board: spans from the first to the last entry, bars per trade or execution (D19);
   readers keep the as-built usual hours and bars per row.
10. An exact model is taken as is only where it asks nothing: the file starts on «conferir» when an execution file still has an
    end-of-file question (or cannot be made) and on «mapa» when «mapa» would block (D20, `inicio`); «Mudar colunas» starts a
    new sequence (`history: []`).
11. The end-of-file answers survive hc: «conferir» always reads every account, and B0's `arquivoDoMapeamento` hands the chosen
    account's answers to the domain under its keys (§4.1, §6.7).
12. With no batch, the model save sends no route and never touches a model with routes (§6.8).

---

## 12. What stays out (sintese §1.2 and the board)

A list of models (rename, delete: C7; RLS delete exists, no screen) and Importações showing a batch's model name; step i3
«Como as operações chegam?» and per-platform «Como exportar», the Tradovate hint included (the board draws it only there,
D14); «Mover para esta conta» /
«Deixar onde estão» (4) and the copy groups with «Criar: Apex B» (6); several «Conta» values imported in one go; Excel, HTML,
MetaTrader, PDF readers; US options contracts (rows refused with a reason); currency fields; a zone per model; commissions from
another Tradovate file; composite IDs; separate date and time columns; «O lado parece ser o da saída. Inverter?» and the «Abre ou
fecha» word question (domain functions exist, not drawn); lines for executions only partly left out and for merged fills
(domain notices exist, not drawn); «Duplicar conta» (10); every prototype control of the board.
