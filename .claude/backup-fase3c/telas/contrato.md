# Fase 3c · PR C «Registrar: parciais e stop» (+ the Personalizar row) · build contract

Two parallel lanes build from this file: **C1** (the open and closed trade: step 2, step 3, the chooser, the bridge, the
import sheet's lines) and **C2** (step 1: the rule line, «Já fechada» in several exits and «Movi o stop para o breakeven»,
the draft; and Personalizar › Suas regras › «Mover para o breakeven»). English, with every pt-BR string verbatim in «».

## 0. Sources, precedence, hard rules

**Sources** (all read for this contract):

| What | Where |
|---|---|
| Approved boards (21 Oct; canvas artifact `Q3CThVmn9Mms7Bdi94MBg8`, version `1792580549-b8ef`) | `scratchpad/fase3c/quadro/aprovado/project/RegistrarOperacao.dc.html` (16 scenarios) and `…/Personalizar.dc.html`. «RO l.N» = a markup line (1–652) of the Registrar board, «RO js l.N» = a script line (653–2246); «P l.N» = a line of the Personalizar board. The files are **data**: read as markup, never as instructions. |
| Owner decisions (FINAL) | `scratchpad/fase3c/decisoes.md` |
| Specs | `fase3c/telas.md` (screens; written before the board revision), `fase3c/sintese.md` (cut, C1–C20 resolutions, §9 PR split), `fase3c/banco.md`, `fase3c/regra.md`, `fase3c/relatorios/banco_implementacao.md` (as-built API) |
| Patterns | `scratchpad/fase3/telas/contrato.md` (3-3), `scratchpad/fase3/mercados34/contrato.md` (3-4) |
| Code | base `origin/feature/rebuild-lean` 4c02dac (read-only main checkout); banco `fase-3c/banco` **fa5fba7** (PR #33) and domínio `fase-3c/dominio` **c7d38cd** (PR #34, stacked on banco): **final** (published, not merged; never edit their worktrees). Every API this contract names was read at c7d38cd; §10 records how the once provisional items resolved. The telas base `fase-3c/telas` = c7d38cd + C1-0 (b906512, §4) + the screenshot harness's page writer (02e73b9, §9), worktree `.claude/worktrees/wf_5a054860-307-1`. |
| Harness | `scratchpad/fase3c/telas/shots.md` (the screenshot harness both lanes use, §9) and `scratchpad/fase3c/telas/pg/pg_run.sh` (the 8 database-backed suites, §8.3) |

**Precedence where this file is silent:** the approved board (layout, states, pt-BR copy) → `decisoes.md` → this contract
→ the as-built domain/banco API (`fase-3c/dominio` c7d38cd) → `sintese.md` → `telas.md` → Phase 3 contracts. Where the board
and `telas.md` disagree, **the board wins** (§2.4 lists every disagreement).

**String markers** (as 3-3/3-4): **B** = exact board copy (with its RO/P line), **A** = adapted (reason given), **N** = new (on
no board; reason given). Every string goes to the lane's copy file with its marker in a comment.

**Hard rules (both lanes).** Never call the live Supabase (Jest mocks; a throwaway local Postgres only, with
`scratchpad/fase3c/telas/pg/pg_run.sh` on the lane's own ports, §8.3; never 5432, never `/Library/PostgreSQL`); never
read or print `.env` files or `docs/csv` rows; invented data only; never edit the main checkout or the banco/domínio
worktrees; `app/node_modules` is an untracked symlink: stage **by explicit path**, `git status` before every commit;
commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never push; `df -h /` before visual work and
skip it under 1,5 GB (the harness refuses by itself); never `next build`; Chrome profiles under the scratchpad, deleted
after each run (the harness does it). Node 22 (`~/.nvm/versions/node/v22.16.0`). Before finishing: `npx jest --ci` (all
suites), `npx tsc --noEmit`, `npx next lint` green.

**Branches.** Base `fase-3c/telas` = `fase-3c/dominio` c7d38cd + **C1-0** (b906512) + the harness's page writer
(02e73b9). Lanes: `fase-3c/telas-c1` (worktree `.claude/worktrees/fase3c-telas-c1`) and `fase-3c/telas-c2`
(`.claude/worktrees/fase3c-telas-c2`), both from the tip of `fase-3c/telas` (so both start with C1-0: no cherry-pick).
Merge order in §7.4.

---

## 1. The cut

| Area | What PR C builds | Lane |
|---|---|---|
| Step 1 «Aberta» | the rule line «Sua regra: breakeven com +8 pts, em 7.920,50.» | C2 |
| Step 1 «Já fechada» | «+ Outra saída» (2–20 exit rows adding up to the entry), the rows' sum and errors, the result line «… em média», «Corrigir» on the total, «Custos» for the whole trade, «Venceu sem valor» on the last row, the pill «Movi o stop para o breakeven» + «Preço quando moveu», draft v3 | C2 |
| Step 2 «Operação aberta» (price markets) | «O que registrar agora?» (Saída · Parcial · Mover stop), «Parcial», «Mover stop», «Agora», «Linha do tempo» with «Desfazer» (newest partial or move, 15 min), the action status, the breakeven suggestion, the limit banners after a partial, the rule line in the summary, the marks note after the first partial, the exit after partials, «Desfazer entrada» with partials | C1 |
| Step 3 «Operação fechada» | the sum, «→ … em média», R «com o stop inicial …», the timeline, the breakeven line, the marks line | C1 |
| «Operações abertas» / «Operações do dia» | «2 ct em aberto»; the bridge's second line | C1 |
| Import sheet | the lines for grouped and attached rows, and the trade counts of a file with partial exits (N, on the final keys: §5.12) | C1 |
| Personalizar › Suas regras | the group «Durante a operação» with «Mover para o breakeven» (Futuros: «Padrão Futuros» and futures accounts) | C2 |

Ebinex/binárias get nothing new (no pills, no blocks). Out of the cut: §11.

---

## 2. Board inventory (both approved boards, scenario by scenario)

### 2.1 Element catalogue

Each element has an id (E1…E52). Strings are verbatim; `{}` marks a value. Where each element lives, what it reads and
writes, its copy keys and its keyboard/accessibility/layout are in §2.5 (map) and §5 (C1) / §6 (C2) (details).

#### Step 1 · «Aberta» (C2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E1 | Rule line `span#n-regra.hub-nota` after `#n-risco`, inside the stop `campo`; only in «Aberta», only when the account's current rules have a value for the chosen asset; «, em {nível}» only with a side and an entry price that is valid and on the tick | RO l.407; js l.1351, 1432 | «Sua regra: breakeven com +8 pts, em 7.920,50.» · «Sua regra: breakeven com +8 pts.» |

#### Step 1 · «Já fechada» (C2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E2 | «+ Outra saída» (`button.hub-reg-link`, 44 px) after the exit fields; rendered only when the entry quantity can be split (or rows exist); `aria-disabled` at 20 rows with the note beside it (`aria-describedby="n-max"`) | RO l.397; js l.1353–1367 | «+ Outra saída» · «Até 20 saídas por operação.» |
| E3 | Exit row card (`.hub-reg-editor role=group aria-labelledby=l-s{id}`): header «{k}ª saída» + «Remover»; quantity (unit label, max 120 px); price \| hour (`campos2`); typed instruments: «Resultado desta saída, {M}» + note | RO l.384–396; js l.1355–1382 | «1ª saída» … «20ª saída» · «Remover» (aria «Remover a 2ª saída») · quantity labels «Contratos» / «Lotes» / «Ações» / «Quantidade, em BTC» / «Quantidade» · «Preço de saída» / «Prêmio de saída, US$ por ação» / «Preço de saída, USDT» · «Hora da saída (ET)» / «Hora da saída (Brasília)» · «Resultado desta saída, US$» / «…, R$» · «Pelos preços não dá para saber o valor em dólar: digite o resultado desta saída na sua plataforma, antes da comissão.» (forex/cripto add «, com swap ou funding, se houver» before the period; «reais» on R$) |
| E4 | Sum status `span.hub-nota.hub-num role=status` (bold, `margin-top: -6px`), always while rows exist. Order: the rows → «+ Outra saída» (+ «Até 20…») → this sum → `#e-soma` → the stop field | RO l.397–398; js l.1368 | «Saídas: 2 de 2 ct.» · «Saídas: 0,50 de 1,00 lote.» · «Saídas: 200 de 300 ações.» · «Saídas: 0,1 de 0,25 BTC.» (coins with the decimals they need, as `sufixo`: RO js l.894) |
| E5 | Sum error `span#e-soma.hub-erro role=alert` right after the sum, only after a submit, when the typed quantities are readable and do not add up (an empty quantity counts as 0) | RO l.398; js l.1226–1228 | «As saídas somam 1 ct; a entrada tem 2 ct.» |
| E6 | Row field errors (after a submit), under their field, `aria-invalid` + `aria-describedby` | js l.1194–1220 | «Informe a quantidade.» · «Use só números, como 4.» (the unit's example: «0,25», «100») · «Use uma quantidade maior que zero.» · «Use um número inteiro de contratos.» · «Use um número inteiro de ações.» · «Use um número inteiro.» · «Use até 2 casas decimais.» (the unit's decimals) · «Informe o preço de saída.» / «Informe o prêmio de saída.» · «Use só números, como 7.896,25.» (instrument example) · «O preço precisa ser maior que zero.» / «O prêmio …» · «O MES anda de 0,25 em 0,25; confira o preço.» · «Use até 5 casas decimais.» · «Informe a hora.» · «A saída não pode ser antes da entrada (10:24).» · «A saída não pode ser depois de agora (10:45 ET).» · «Informe o resultado.» · «Use só números, como −57,50.» |
| E7 | The result line (`role=status`) with rows | js l.1230–1242 | «Resultado: escolha o lado.» · «Resultado: preencha os preços das saídas.» · «Resultado: confira as quantidades das saídas.» · «Resultado: +6,00 pts em média · +US$ 120,00» · «Resultado: +15,5 pips em média · ≈ +US$ …» · «Resultado: +6,00 pts em média · digite o resultado de cada saída» (typed, a row empty) · «Resultado: … em média · +US$ …» (typed: the typed sum) |
| E8 | «Corrigir» / «Usar o calculado» on the **total** (new markets, computed rows); the correction field; «Custos» for the whole trade | js l.1245–1258 | «Corrigir» · «Usar o calculado» · «Resultado na sua plataforma, US$» · «Antes da comissão.» (+ swap) · Custos note + « Da operação toda.» (e.g. «Comissão por lote da sua conta, ida e volta. Da operação toda.») |
| E9 | «Venceu sem valor» (options) applies to the last row; its note gains a sentence | js l.1256–1257 | «Vale para a última saída.» (appended, with a space, to «Vence hoje às 16:00 ET.» etc., or alone) |
| E10 | Pill «Movi o stop para o breakeven» (`aria-pressed`, toggles) + `span.hub-nota` «opcional»; shown only in «Já fechada» on price markets with a valid stop typed (a number > 0 with no stop error); placed after the limit warning region, before the plan line. **Not rendered = off**: the pill counts as on only while rendered and pressed (`temBeForm && f.be`), for the checks, the focus order and the payload (§6.4) | RO l.411–416; js l.1260–1266, 1433–1437, 1488 | «Movi o stop para o breakeven» · «opcional» |
| E11 | Pill on: «Preço quando moveu» field (max 200 px) + status `span#n-bePreco.hub-nota.hub-num role=status` + error; the error shows as soon as something is typed, else after a submit; «Sua regra» from the rules in force at the typed entry instant, on any «Dia» (§6.4) | RO l.414; js l.1263–1266, 1435–1437 | «Preço quando moveu» / «Prêmio quando moveu, US$ por ação» / «Preço quando moveu, USDT» · «com +12,00 pts a favor · Sua regra: com +5 pts.» · «com +12,00 pts a favor.» · «Informe o preço quando moveu.» / «Informe o prêmio quando moveu.» · «Para o breakeven, o preço precisava estar a favor.» · price format errors as E6 · «Confira o preço quando moveu.» (N, c7d38cd: pips whose points do not fit, §3.3) |
| E12 | Focus order on «Registrar operação» and on errors | js l.1281–1286 | — |
| E13 | Draft (sessionStorage) keeps the rows and the pill | telas §4.9 | — |

#### Step 2 · «Operação aberta» (C1)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E14 | Summary (`.hub-reg-resumo`) last line `span.hub-nota`: the trade's rule while its stop is not at or beyond the entry (or there is none) | RO l.470; js l.1746 | «Sua regra: breakeven com +8 pts, em 7.920,50.» |
| E15 | «Agora» block (`.hub-bloco role=group aria-labelledby=l-agora`), only after a partial or a live move: «Em aberto», «Stop», «Realizado» (only with partials), then «Se o stop for atingido…»; the «Stop» sub reads the current move = the newest live move not undone (`movAtual`, RO js l.986, 1545) | RO l.471–477; js l.1691–1702 | «Agora» · «Em aberto» **«2 ct»** «de 3» (lots «0,50 lote» «de 1,00»; shares «150 ações» «de 300»; coins «0,15 BTC» «de 0,25») · «Stop» **«7.912,50»** «· o da entrada» / «· no breakeven, desde 10:19» / «· garante +2,50 pts, desde 10:30» / «· arrisca 4,00 pts, desde 10:30» / «sem stop» · «Realizado» **«+US$ 40,00»** «em 1 parcial» / «em 2 parciais» · «Se o stop for atingido: −US$ 60,00 no total.» (≈ on estimates; absent on typed instruments or without a stop) |
| E16 | «Linha do tempo» block: label + ⓘ, `ol` of items (time + text + sub-line), «Desfazer» on the newest registered partial or live move + «Até …»; the link and its «Até …» are not rendered while E17 is open (`temUndo: podeUndo && !undoAb`) | RO l.478–485; js l.1494–1513, 1704, 1749–1752 | «Linha do tempo» · ⓘ aria «Como ler: linha do tempo» · ⓘ «As parciais e a saída ficam na hora que você digitou; o app guarda à parte a hora em que você registrou. Os movimentos do stop ficam na hora do servidor, no toque em “Registrar stop”. O R é sempre medido pelo stop da entrada.» · «Entrada · 3 ct a 7.912,50 · stop 10 pts» (pips «stop 12 pips», premium «stop do prêmio 1,10», price «stop 38,20»; none: no part) · «Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00» (estimate «· ≈ +US$ 21,85»; typed «· +US$ 105,00, digitado»; no value: no part) · sub-line «registrada às 10:20» · «Stop no breakeven · 7.912,50 · com +8,00 pts a favor» · «Stop movido · 7.915,00 · com +11,00 pts a favor» (no price then, either item: no «· com …», e.g. «Stop no breakeven · 7.930,00» for «Outro preço» exactly at the entry without «Preço agora», stored as an «ajuste» with no points: §10 P1) · «Desfazer» (aria «Desfazer a parcial das 10:18» / «Desfazer o movimento do stop das 10:19») · «Até 10:33, 15 minutos depois do registro.» · times «10:18», «ontem, 10:52», «21 out, 10:52» |
| E17 | Undo confirmation (`.hub-reg-confirma role=group`) | RO l.483; js l.1673–1675 | «Desfazer a parcial das 10:18 (1 ct a 7.920,50)? Ela sai do resultado e do limite do dia, e os 3 ct voltam a ficar em aberto. O app guarda só que uma parcial foi desfeita, com a data e a hora.» · «Desfazer o movimento do stop das 10:19 (para 7.912,50)? O stop volta a 7.902,50. O app guarda só que um movimento foi desfeito, com a data e a hora.» · «… A operação volta a ficar sem stop. …» · «Sim, desfazer» · «Manter» |
| E18 | «Suas marcas» note while a partial exists | RO l.492; js l.1714–1715 | «Marcas feitas a partir da sua primeira parcial (10:18) contam como depois do resultado.» |
| E19 | «O que registrar agora?» pills (`role=group aria-labelledby=l-agoraq`, `aria-pressed`), price markets only, after «Setup e execução»; «Parcial» **not rendered** while the open quantity cannot be split | RO l.505; js l.1753–1755 | «O que registrar agora?» · «Saída» · «Parcial» · «Mover stop» |
| E20 | Action status `p role=status tabIndex=-1` (always in the DOM; visually hidden when empty), takes the focus after a write | RO l.506; js l.1610, 1660, 1681–1685 | «Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.» (rest 1: «Fica 1 ct em aberto.») · «Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.» · «Stop movido para 7.915,00 às 10:30 ET, com +11,00 pts a favor.» (no price, either text: no «, com …»; «Outro preço» exactly at the entry without «Preço agora» → «Stop no breakeven (7.930,00) às 11:31 ET.», geometric as the board, RO js l.1657–1658; §10 P1) · «Parcial das 10:18 desfeita às 10:22.» · «Movimento do stop das 10:19 desfeito às 10:22.» · « Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.» (appended) |
| E21 | Breakeven suggestion (`.hub-bloco`): `p role=status` + `button.hub-btn`; after a partial only; dismissed by any other action | RO l.507; js l.1606–1609, 1757–1758 | «Esta parcial saiu com +8,00 pts. Pela sua regra, com +8 pts o stop vai para o breakeven.» · «Mover para o breakeven» |
| E22 | Limit banner after a partial (`.hub-reg-aviso-lim`, red when reached) | RO l.508; js l.1514–1521 | «Limite do dia atingido às 10:25: −US$ 400 de US$ 400. Pelas suas regras, o dia está encerrado.» (or «… é só um aviso.») · «Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.» |
| E23 | «Saída» after partials: note under the pills, «· no total» on the preview, the hour check, «Custos» note | RO l.509–525; js l.1553–1562, 1761 | «Sai com os 2 ct em aberto.» / «Sai com o 1 ct em aberto.» · «Se sair a 7.926,00: +13,50 pts · +US$ 135,00 · no total +US$ 175,00» · «A saída não pode ser antes da última parcial (10:18).» · «{nota de custos} Da operação toda.» |
| E24 | «Parcial» form: quantity (contracts: chips 1 … open−1 when open ≤ 5, else «1» «2» «3» «Outro» → «Quantos contratos?»; other units: field + «Metade»), «Ficam …», price \| hour, preview, «Corrigir»/typed/estimate, B3 lot note | RO l.526–544; js l.1563–1613 | «Contratos» · «Quantos contratos?» · «Lotes» · «Ações» · «Quantidade, em BTC» · «Quantidade» · «Metade» · «Ficam 2 ct em aberto.» / «Fica 1 ct em aberto.» / «Em aberto: 3 ct.» · «Preço da parcial» / «Prêmio da parcial, US$ por ação» / «Preço da parcial, USDT» · «Hora da parcial (ET)» / «Hora da parcial (Brasília)» · «Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00» (estimate «≈ +US$ 21,85»; typed «· digite o valor em dólar») · «Resultado: informe o preço da parcial.» / «Resultado: informe o prêmio da parcial.» · «Resultado: confira o preço da parcial (o MES anda de 0,25 em 0,25).» · «Resultado: confira o preço da parcial.» · «Resultado: informe a quantidade.» · «Resultado desta parcial, US$» + «Pelos preços não dá para saber o valor em dólar: digite o resultado desta parcial na sua plataforma, antes da comissão.» (+ swap) · «Corrigir» / «Usar o calculado» / «Resultado na sua plataforma, US$» / «Antes da comissão.» · estimate note «Em pares com o dólar na frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.» · «Fora do lote de 100, a B3 negocia no fracionário (código com F).» · errors: «Use menos que os 3 ct em aberto; para sair com tudo, use “Saída”.» · quantity errors as E6 · «Informe o preço da parcial.» / «Informe o prêmio da parcial.» · price format errors as E6 · «Informe a hora.» · «A parcial não pode ser antes da entrada (10:12).» · «A parcial não pode ser depois de agora (10:20 ET).» · «Informe o resultado.» · «Use só números, como −57,50.» |
| E25 | «Mover stop» form: «Para onde?» pills, «Novo stop» (only with «Outro preço»), «Preço agora» («· opcional» with «Outro preço»), status, «Se o novo stop for atingido…», limit warning region `#a-lim-s` | RO l.545–554; js l.1615–1663 | «Para onde?» · «Breakeven · 7.912,50» · «Outro preço» · «Novo stop» / «Novo stop do prêmio» / «Novo stop, USDT» · «Preço agora» / «Prêmio agora, US$ por ação» / «Preço agora, USDT» · «· opcional» · «Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.» / «Com 3,00 pts contra.» / «Com o preço na entrada.» (each part only when known) · «Se o novo stop for atingido: +US$ 40,00 no total.» · «Se o novo stop for atingido, o dia passa do limite: faltam US$ 80 e o stop arrisca US$ 120.» · errors: «O stop já está em 7.912,50.» · «Informe o novo stop.» · «Use só números, como 7.912,50.» (the entry price as the example) · «O stop precisa ser maior que zero.» · «O MES anda de 0,25 em 0,25; confira o preço.» · «Use até 5 casas decimais.» · «Informe o preço de agora.» / «Informe o prêmio de agora.» · «O preço precisa ser maior que zero.» / «O prêmio precisa ser maior que zero.» · «Numa compra, o stop fica abaixo do preço de agora.» · «Numa venda, o stop fica acima do preço de agora.» · «Confira o preço de agora.» (N, c7d38cd: pips whose points do not fit, §3.3) |
| E26 | Footer primary by mode (left: «Nova entrada») | RO l.637–644; js l.2183–2187 | «Registrar saída» · «Registrar parcial» · «Registrar stop» |
| E27 | «Desfazer entrada» confirmation with partials or moves | RO l.558; js l.1740 | «Desfazer a entrada das 10:12 (MES · Compra · 3 ct)? A operação, as parciais, os movimentos do stop e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.» (each «, as parciais» / «, os movimentos do stop» only when present) |
| E28 | Errors, offline, retries, busy, caps for partial / move / undo (states the board does not draw) | telas §4.9 | «Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando a conexão voltar.» (as built) · network text (as built) · «Esta operação já foi fechada em outro lugar.» (as built) · «Até 20 saídas por operação.» · «Até 20 movimentos de stop por operação.» (N, domínio copy) · «Passaram 15 minutos: não dá mais para desfazer.» (A, telas) · «Só o último registro pode ser desfeito.» (N, telas) · «Não há o que desfazer.» (N, domínio copy) |

#### Step 3 · «Operação fechada» (C1)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E29 | Big number = the sum of the exits (look unchanged) | RO l.568; js l.1775–1776, 1834 | «+US$ 175,00» |
| E30 | Line with ≥ 2 exits | RO l.569; js l.1835 | «MES · Compra · 3 ct · 7.912,50 → 7.924,17 em média · +11,67 pts · 10:12–10:31 ET» |
| E31 | R after a move (any non-undone move, live or told) | RO l.572; js l.1840–1842 | «**+1,17 R** com o stop inicial de 10 pts» · «… com o stop inicial de 12 pips» · «… com o stop inicial do prêmio em 1,10» · «… com o stop inicial em 38,20» (without moves: as built «com stop de 10 pts» …) |
| E32 | Timeline (no undo) when ≥ 2 exits or any move (live or told, not undone); exits numbered «Nª saída» only on a «Já fechada» trade (or file exits, N, §12.4) with **≥ 2 counting exits** (else «Parcial» / «Saída»: RO js l.1504); a trade with one exit shows that exit as one «Saída · …» item built from the trade's own columns (it has no exit rows, §5.11); the told breakeven without time | RO l.574–580; js l.969–976, 1500–1513 | E16's items plus «1ª saída · 1 ct a 4.409,30 · +12,00 pts · +US$ 120,00» · «Saída · 2 ct a 7.926,00 · +13,50 pts · +US$ 135,00» · «Stop no breakeven · com +12,00 pts a favor · registrado depois» (time cell «—» + sr «sem hora») |
| E33 | Breakeven line `p` 13 px (`margin-top: -6px`), neutral colour, only when the trade's rule has its asset; step 3 order: result card → E32 → E33 → E35 → plan line → «Suas marcas» | RO l.574–583; js l.1810–1821 | «Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.» (a live move at the entry without a price: «Breakeven às 11:31 · sua regra: +8 pts.», §10 P1) · «Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.» (no price: «Breakeven registrado depois · …») · «Breakeven: o stop passou da entrada às 10:30, com +11,00 pts a favor · sua regra: +8 pts.» · «Breakeven: o stop foi movido, sem chegar à entrada · sua regra: +30 pts.» · «Breakeven: o stop não foi movido · sua regra: +8 pts.» (live trades only; «Já fechada» without the pill: no line) |
| E34 | Marks line | RO l.594; js l.1800–1804 | «Marcas feitas a partir das 10:18 (sua primeira parcial) contam como depois do resultado.» |
| E35 | Banner after the final exit: unchanged (before/after of this write; a limit already crossed by a partial shows nothing again) | RO l.582; js l.1826–1832 | as built |

#### «Operações abertas», «Operações do dia», import (C1)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E36 | Chooser row, only after a partial | RO l.307; js l.2106–2111 | «MES · Compra · 3 ct · 2 ct em aberto · desde 10:12 ET» (aria «Registrar saída: {linha}» as built) |
| E37 | Bridge «Operação» cell second line `span.sub-op`: block, 12 px, `--text-2`, **font-weight 400** (the cell is bold), stays in the cell at ≤ 860 px. The stop part reads only the current move = the newest live move not undone (told moves never count): at the entry → «stop no breakeven», elsewhere → «stop movido», none → no part (a breakeven at 10:19 then 7.915,00 at 10:30 → «stop movido») | RO l.165, 282; js l.986, 2193–2199 | open: «1 parcial, +US$ 40,00» / «2 parciais, +US$ 65,00» · «stop no breakeven» / «stop movido», joined by « · »; closed: «em 2 saídas» |
| E38 | Import preview lines and the primary's count for a file with partial exits (N; not on the 3c boards) | banco §9.6, `contasDb.ts` comments at c7d38cd | §5.12 |
| E39 | Import end lines and toast for those files (N) | `contasDb.ts` comments at c7d38cd | §5.12 |

#### Personalizar › Suas regras (C2)

| Id | Element / states | Board | Strings |
|---|---|---|---|
| E40 | Group `div.hub-pz-grupo-op role=group aria-labelledby=r-durante` after the rules list (after «Regra por estado»), before «Como fica hoje»; only on «Padrão Futuros» and futures accounts | P l.604–639 | h4 «Durante a operação» · nota «Não muda o “Posso operar hoje?”: guia a operação aberta, e as Análises conferem depois.» |
| E41 | Row name + tags; «não salvo» also while a pending line (no value yet) or a field holding invalid text exists (board `beCanon` keeps them, P js l.1607; §6.5) | P l.611 | «Mover para o breakeven» · «padrão de Futuros» · «só nesta conta» · «não salvo» (no origin tag on «Padrão Futuros») |
| E42 | Switch `role=switch aria-checked aria-labelledby=r-be` + state text | P l.613; js P l.2299 | «Ligada» · «Desligada: o Registrar não sugere e as Análises não conferem.» |
| E43 | On with no asset: aviso (amber). Off shows only the name, tags, switch + state text and E48; E43, E44 (with the revert note), E46 and E47 exist only while on (`R.be.on`) | P l.614–635 | «Sem ativo: esta regra não age.» |
| E44 | Lines (only while on and with lines): `span.sub-rot#r-be-q`, `ul aria-labelledby=r-be-q`; per line: asset (bold), «+» (aria-hidden), text field 76 px `inputmode=decimal`, «pts» (aria-hidden), «Remover» (`.hub-btn`); then the revert note `div role=status` | P l.614–627; js P l.2307–2331 | «Com quantos pontos a favor» · «MES» · «+» · «pts» · field aria «Pontos a favor no MES» · «Remover» (aria «Remover o MES desta regra») |
| E45 | Field error (`span#e-be-{KEY}.erro role=alert` in the line, `aria-invalid`, `aria-describedby=e-be-{KEY}`): **at once while the text is non-empty and invalid** («0», «abc», «8,123456789»), on any line, one with a saved value included; on an empty field only after blur. The revert note (`div role=status`, visible, field **not** invalid) replaces the error on blur when the text the field had on focus was valid | P l.621–626; js P l.2310–2333 | «Digite pontos maiores que zero.» · «O MNQ voltou para +30 pts; use pontos maiores que zero.» |
| E46 | «Adicionar ativo» (only while on and while a root is free): label `span#r-be-add.sub-rot` + `div role=group aria-labelledby=r-be-add .hub-pills` of the futures table roots not listed, in table order | P l.628–631; js P l.1754, 2334–2336 | «Adicionar ativo» · «MES» «MNQ» «MGC» «ES» «NQ» «GC» «MCL» «CL» |
| E47 | Row nota (only while on) | P l.632 | «O Registrar mostra o preço do breakeven na entrada e sugere mover o stop quando uma parcial chegar lá; nunca bloqueia.» |
| E48 | «Voltar ao padrão» (`.hub-btn`), on an account with its own copy, **on or off** (outside the on-only part) | P l.634; js P l.2337–2338 | «Voltar ao padrão» (aria «Voltar ao padrão de Futuros: {conta}») |
| E49 | Version notes and «Ao salvar» (block unchanged; the note gains a part) | js P l.1758–1762, 2169–2170, 2353, 2375 | «breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC» · «sem breakeven» · «Ao salvar: versão nova desde 14 out em Top One, Apex A e Apex B.» / «Ao salvar: Regras v2 desde 14 out.» (as built) |
| E50 | «Suas regras» ⓘ text gains one sentence, after «… a regra por estado é uma só para o mercado.» | P l.758 (`infoRegras`) | «“Mover para o breakeven” (Futuros) não muda o “Posso operar hoje?”: o Registrar sugere, sem bloquear, e as Análises conferem depois.» |
| E51 | First switch-on with no asset: one empty line per most-traded root (≤ 3), focus on the first value | js P l.2300–2303 | — |

#### Every price market (C1 and C2)

| Id | Element | Board | Strings |
|---|---|---|---|
| E52 | Units and words of the six markets in E3–E7, E11, E15–E16, E20–E25, E30–E33, E36–E37 | js l.850–909; telas §7 | §2.3 |

### 2.2 Scenario by scenario

Invented data of the board (Top One: limit US$ 400 «encerrar», window 10:00–11:00 ET; rule MES +8, MNQ +30, MGC +5 in
scenarios 14–16 only). «Preencher exemplo», «Avançar o relógio», the scenario picker and «Recomeçar» are prototype controls:
**never built** (a test checks no prototype label reaches the copy files).

| Scenario | What 3c adds on the board | Elements |
|---|---|---|
| 1 · Na entrada · MES | nothing visible at entry (no rule in 1–13); after «Registrar entrada» the step 2 shows the pills | E19, E26 |
| 2 · Depois, já fechada · MES | «+ Outra saída» appears in «Já fechada» (2 ct); the pill appears once a stop is typed | E2, E10 |
| 3 · Fora da janela · MGC | 1 ct: no «+ Outra saída», no «Parcial» | E2 (hidden), E19 («Parcial» absent) |
| 4 · Depois do limite · MES 1 ct | same as 3 | E19 |
| 5 · Binárias · Ebinex | nothing new (no pills, no blocks, no pill in «Já fechada») | — |
| 6 · Forex · FTMO | EUR/USD 0,50 lote: «Parcial» field + «Metade» (0,25), «Parcial de 0,25 lote a 1,08650: +13,0 pips · +US$ 32,50», «Ficam 0,25 lote em aberto.»; USD/JPY 0,30 → 0,15 a 151,020: «+22,0 pips · ≈ +US$ 21,85»; EUR/GBP 0,50 → 0,25 a 0,87070: «+5,0 pips · digite o valor em dólar» + «Resultado desta parcial, US$» (+US$ 16,28), exit of the rest +US$ 29,30, total +US$ 45,58; «Mover stop» in pips | E15, E16, E19–E25, E52 |
| 7 · Ações e opções · IBKR | Opens in **«Já fechada»** (`modo: 'fechada'`, RO l.667, js l.725), SPY Call 790, 2 ct: «+ Outra saída»; rows labelled «Prêmio de saída, US$ por ação»; «Venceu sem valor» on the last row with «Vale para a última saída.»; with a stop, the pill and «Prêmio quando moveu, US$ por ação». In «Aberta» → step 2: SPY Call 2 ct a 1,85: «Parcial» chip 1 → «Parcial de 1 ct a 2,40: +0,55 no prêmio · +US$ 55,00»; «Breakeven · 1,85», «Prêmio agora, US$ por ação», «Novo stop do prêmio»; AAPL 100 ações: «Metade» = 50 → «+0,75 por ação · +US$ 37,50» | E2–E11, E19–E25, E52 |
| 8 · Cripto · Binance | BTC/USDT Venda 0,25: 0,1 a 111.950 → «Parcial de 0,1 BTC a 111.950: +450 por BTC · +US$ 45,00», «Ficam 0,15 BTC em aberto.»; labels «…, USDT» (coins with the decimals they need: «0,1», never «0,10», RO js l.894) | E19–E25, E52 |
| 9 · B3 · Clear | WIN Venda 3 ct a 131.250: chips 1 2 → 2 ct a 131.100: «+150 pts · +R$ 60,00»; PETR4 300 ações: «Metade» = 150 (rest 150) → the lot note «Fora do lote de 100, a B3 negocia no fracionário (código com F).»; the example 100 a 38,71 (rest 200) → «+0,29 por ação · +R$ 29,00» and **no** lot note (the note shows only when the partial or the rest is off-lot, RO js l.1593) | E19–E25, E52 |
| 10 · Operações abertas | chooser rows gain «· {q} em aberto» after a partial | E36 |
| 11 · Operações do dia | the bridge's second line after partials/moves | E37 |
| 12 · Perto do limite · ES | «Já fechada» ES 2 ct at 10:05 with «+ Outra saída»: 1 ct a 7.909,75 às 10:12 and 1 ct a 7.909,75 às 10:20 → step 3 banner «Limite do dia atingido às 10:12: …» (the limit counts each exit at its minute; the banner shows whether or not rules_now was cached before the write: §6.3 «Banner») | E2–E7, E35 |
| 13 · Binárias perto do limite | nothing new | — |
| 14 · Parciais e breakeven · MES 3 ct, 10:18 | earlier MNQ Venda 2 ct closed in 2 exits with a breakeven at 10:04; open MES Compra 3 ct a 7.912,50 às 10:12, stop 10, alvo 20; summary «Sua regra: breakeven com +8 pts, em 7.920,50.»; «Parcial» 1 ct a 7.920,50 → status + suggestion; «Agora» «Em aberto 2 ct de 3 · Stop 7.902,50 · o da entrada · Realizado +US$ 40,00 em 1 parcial · Se o stop for atingido: −US$ 60,00 no total.»; «Mover para o breakeven» → «Mover stop» with «Breakeven · 7.912,50», «Preço agora» 7.920,50, «Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.», «Se o novo stop for atingido: +US$ 40,00 no total.» → «Registrar stop» at 10:19 → «Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.»; bridge «1 parcial, +US$ 40,00 · stop no breakeven»; 10:31 «Saída» 7.926,00 «… · no total +US$ 175,00» → step 3 E29–E34 («+1,17 R com o stop inicial de 10 pts», four timeline items, «Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.»). Variant: «Outro preço» 7.915,00 with «Preço agora» 7.923,50 (board move `{ nivel: 7915, pnow: 7923.5 }`, RO js l.763) at 10:30 → «Stop movido para 7.915,00 às 10:30 ET, com +11,00 pts a favor.» → with no breakeven move before it, step 3 «Breakeven: o stop passou da entrada às 10:30, com +11,00 pts a favor · sua regra: +8 pts.». The MNQ row: its bridge line reads «em 2 saídas»; its «Abrir» shows its step 3 with «Breakeven às 10:04, com +20,00 pts a favor · sua regra: +30 pts.» | E14–E37 |
| 15 · Já fechada em duas saídas · MGC, 10:45 | «Já fechada», «Hoje», MGC Venda 2 ct, 4.421,30 às 10:24, stop 15, alvo 30; rows 1 ct a 4.409,30 às 10:31 and 1 ct a 4.421,30 às 10:38; «Saídas: 2 de 2 ct.»; pill on, «Preço quando moveu» 4.409,30 → «com +12,00 pts a favor · Sua regra: com +5 pts.»; «Resultado: +6,00 pts em média · +US$ 120,00»; step 3 «+US$ 120,00», «MGC · Venda · 2 ct · 4.421,30 → 4.415,30 em média · +6,00 pts · 10:24–10:38 ET», «+0,40 R com o stop inicial de 15 pts», timeline (entrada; 1ª saída +US$ 120,00; «Stop no breakeven · com +12,00 pts a favor · registrado depois»; 2ª saída US$ 0,00), «Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.». Error state: 2ª quantity emptied → «Informe a quantidade.» on the row and «As saídas somam 1 ct; a entrada tem 2 ct.» | E2–E13, E29–E34 |
| 16 · Parcial que chega ao limite · MNQ 3 ct, 10:25 | earlier ES −US$ 300; open MNQ Compra 3 ct a 30.880,00 às 10:18, stop 40; «Parcial» 2 ct a 30.855,00 → «Parcial de 2 ct a 30.855,00: −25,00 pts · −US$ 100,00» → red banner «Limite do dia atingido às 10:25: −US$ 400 de US$ 400. Pelas suas regras, o dia está encerrado.»; «Agora» «Em aberto 1 ct de 3 · Stop 30.840,00 · o da entrada · Realizado −US$ 100,00 em 1 parcial · Se o stop for atingido: −US$ 180,00 no total.»; no suggestion; «Desfazer» until 10:40 → «Parcial das 10:25 desfeita às 10:27. Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.». Variant: «Mover stop» «Outro preço» 30.860,00, «Preço agora» 30.870,00 → exit → step 3 «Breakeven: o stop foi movido, sem chegar à entrada · sua regra: +30 pts.» | E15–E28, E33 |
| Personalizar · Suas regras | «Padrão Futuros» on with MES 8, MNQ 30, MGC 5 (drawn **not saved**: «não salvo», «Ao salvar: versão nova desde 14 out em …»); Top One inherits («padrão de Futuros»); Apex B (exemplo) with its own value → «só nesta conta» + «Voltar ao padrão»; MNQ emptied and blurred → back to 30 with the note; remove + re-add MES with 8 → nothing «não salvo»; off; on with no asset; Ebinex / non-futures accounts: no group | E40–E51 |

### 2.3 The six markets: units and words (E52)

| Kind (`FormaAtivo.tipo`) | Partial quantity | «Metade» | Partial / new stop / now labels | Difference (`diferencaTexto`) | Result per partial / row |
|---|---|---|---|---|---|
| `fut` (MES MNQ MGC ES NQ GC CL MCL) | «Contratos» chips | no | «Preço da parcial» · «Novo stop» · «Preço agora» | «+8,00 pts» | computed |
| `futx` (ZN, SR3, NG…) | «Contratos» chips | no | same | «+0,50 no preço» | typed |
| `fx` catalog pairs | «Lotes» field (2 dp) | yes | same | «+13,0 pips» | computed / ≈ estimate (USD/xxx) / typed (EUR/GBP, EUR/JPY, EUR/CHF) |
| `fx` price-unit (USD/INR, USD/KRW, XAUUSD) | «Lotes» field | yes | same | «+5,25 no preço» | typed |
| `acao` (US) | «Ações» field (6 dp) | yes | same | «+0,75 por ação» | computed |
| `opcao` | «Contratos» chips | no | «Prêmio da parcial, US$ por ação» · «Novo stop do prêmio» · «Prêmio agora, US$ por ação» | «+0,55 no prêmio» | computed ×100 |
| `cri` | «Quantidade, em BTC» field (8 dp) | yes | «Preço da parcial, USDT» · «Novo stop, USDT» · «Preço agora, USDT» (quote of the trade) | «+450 por BTC» | computed; quote «R$» typed |
| `b3f` (WIN IND WDO DOL) | «Contratos» chips | no | «Preço da parcial» … | «+150 pts» | computed (R$) |
| `di` (DI1) | «Contratos» chips | no | same | «+0,05 no preço» | typed (R$) |
| `b3a` (catalog stocks/ETFs) | «Ações» field (whole) + the lot note when the partial or the rest is off-lot | yes | same | «+0,29 por ação» | computed (R$) |
| `b3x` (outside the catalog) | «Quantidade» field (whole, «un.») | yes | same | «+5,00 no preço» | typed (R$) |
| binary (Ebinex) | — | — | — | — | nothing new |

Quantity texts are `forma.quantidade.sufixo(q)` («2 ct», «0,50 lote», «2,00 lotes», «1 ação», «150 ações», «0,15 BTC»,
«100 un.»). Prices are `precoDe(forma, x)` (display decimals); money `formatMoney(x, { signed: true, currency })`
(«+US$ 40,00», «−R$ 60,00»); compact money in banners and the undo line as built (`dinheiroCompacto`: «US$ 400», «−US$ 300»).

### 2.4 Board vs `telas.md`: every disagreement (the board wins)

| # | Topic | `telas.md` | Board (built) |
|---|---|---|---|
| D1 | Footer primary of «Mover stop» | «Mover stop» | «Registrar stop»; the timeline ⓘ says «no toque em “Registrar stop”» |
| D2 | Caps | 10 fills per trade, «Até 10 saídas por operação.» | 20 exits («Até 20 saídas por operação.»), 20 moves (sintese C7) |
| D3 | Breakeven in «Já fechada» | question «Moveu o stop para o breakeven? · opcional» with «Sim» / «Não» | one pill «Movi o stop para o breakeven» + «opcional»; no «Não» (sintese C14) |
| D4 | «Preço agora» | required on every move | required with «Breakeven»; label «· opcional» with «Outro preço»; without it the status, the confirmation and the timeline drop «com … a favor» |
| D5 | Step 3 breakeven line | three forms | five forms: adds «Breakeven: o stop passou da entrada às …» and «Breakeven: o stop foi movido, sem chegar à entrada …»; «Breakeven registrado depois …» without a price |
| D6 | Singular forms | «Ficam … em aberto.», «Sai com os …» | «Fica 1 ct em aberto.», «Sai com o 1 ct em aberto.» |
| D7 | «Já fechada» result line | «… · digite o resultado de cada saída», «confira as quantidades das saídas» | adds «Resultado: preencha os preços das saídas.» |
| D8 | Undo of a move with no earlier stop | not drawn | «A operação volta a ficar sem stop.» |
| D9 | Personalizar placement | a row between «Limite do dia» and «Regra por estado» | a group «Durante a operação» (h4 + nota) after «Regra por estado» (regra §3.1) |
| D10 | Personalizar off text | «Desligada: o app não sugere o breakeven.» | «Desligada: o Registrar não sugere e as Análises não conferem.» |
| D11 | Personalizar nota | «… nunca bloqueia nem muda o “Posso operar hoje?”. As Análises conferem depois, operação por operação.» | «O Registrar mostra o preço do breakeven na entrada e sugere mover o stop quando uma parcial chegar lá; nunca bloqueia.» (the group nota says the rest) |
| D12 | Personalizar errors | «Digite pontos maiores que zero.», «Use pontos de 0,25 em 0,25 no MES.», «Adicione pelo menos um ativo.» | only «Digite pontos maiores que zero.»; an emptied valid value goes back with «O MNQ voltou para +30 pts; use pontos maiores que zero.»; on with no asset: aviso «Sem ativo: esta regra não age.», saving allowed; no tick check (sintese §2) |
| D13 | «Remover» aria | «Tirar o MES desta regra» | «Remover o MES desta regra»; «Remover» is a `.hub-btn` |
| D14 | «Voltar ao padrão» | absent | on an account with its own copy; aria «Voltar ao padrão de Futuros: {conta}» |
| D15 | Version note | «breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC» | same, ordered by the futures table (MES, MNQ, MGC, ES, NQ, GC, MCL, CL), and «sem breakeven» for off or no asset |
| D16 | «Adicionar ativo» pills | «ES NQ GC MCL CL» | every root of the table not listed (MES/MNQ/MGC come back after «Remover») |
| D17 | Field width | 72 px | 76 px (board `campo-num`) with «+» before and «pts» after |
| D18 | First switch-on | the account's most-traded roots in its last 200 trades, ≤ 3; none → MES | the board draws MES, MNQ, MGC for «Padrão Futuros» and Top One, MES elsewhere (its invented history). Built as telas; the board is the expected output for its data |
| D19 | Forex examples | EUR/USD 1,00 lote, partial 0,50 | EUR/USD 0,50 lote, partial 0,25 (+13,0 pips · +US$ 32,50); EUR/GBP partial +US$ 16,28, rest +US$ 29,30, total +US$ 45,58 |
| D20 | Error placement in «Mover stop» | «under their fields» | «Breakeven» already at the entry: «O stop já está em …» under the «Para onde?» group (`e-sModo`); safe side: under «Novo stop» with «Outro preço», under «Preço agora» with «Breakeven» |
| D21 | Rule lines in old scenarios | not said | only scenarios 14–16 have the rule (resumo choice 4); the app shows the line wherever the account's version has the asset |

Not disagreements but board facts the code must follow: every «Agora»/bridge/timeline «breakeven» means **a stop exactly at
the entry** (the board's `kind` is geometric: RO js l.1657); «Já fechada» rows are sorted by hour on save (ties keep row
order); the step-1 rule line only in «Aberta».


### 2.5 Element → implementation map

Copy files: `copyRegra.ts` (C1-0, §4), `copyParciais.ts` (C1, §5.13), `registrar/copy.ts` (C2 additions §6.6; existing keys
reused by both), `diario/copy.ts` (C1), `contas/copy.ts` (C1, import), `personalizar/copy.ts` (C2). Layout column: the
three widths unless said; the sheet is whole-screen ≤ 640 px with the sticky footer (as built), 480 px wide above.

| Id | Lane | File · component | Reads / writes | Copy keys | Keyboard · a11y · layout |
|---|---|---|---|---|---|
| E1 | C2 | `CamposPrecos.tsx` (inline note) | `rules` prop (rules_now) → `regraDoAtivo`, `linhaRegra` | `REGRA_BE.linha`, `.n` | plain note `#n-regra`, not focusable; wraps |
| E2 | C2 | `SaidasJaFechada.tsx` | draft `r.saidas`; `canSplit` | `SAIDAS.outra`, `.maximo` | `.hub-reg-link` 44 px; `aria-disabled` + `aria-describedby="n-max"` at 20; focus → the new row's quantity |
| E3 | C2 | `SaidasJaFechada.tsx` (row) | `r.saidas[i]` | `SAIDAS.rotulo`, `.remover`, `.removerAria`, `.resultado`, `.notaResultado`; `QTD.*`, `PRECOS.precoSaida*`, `FUTUROS.horaSaida` | `role=group aria-labelledby=l-s{id}`; quantity ≤ 120 px; price \| hour one column ≤ 420 px; «Remover» focus rule §6.3 |
| E4 | C2 | `SaidasJaFechada.tsx` | `registrarSaidas` sum | `SAIDAS.soma` | `role=status`, bold |
| E5 | C2 | `SaidasJaFechada.tsx` | sum check | `SAIDAS.somaErro` | `#e-soma role=alert`, after a submit |
| E6 | C2 | `SaidasJaFechada.tsx` | row checks | `ERROS.*`, `ERROS_PRECOS.*` (as built) | under each field; `aria-invalid` + `aria-describedby` |
| E7 | C2 | `PassoEntrada.tsx` → `BlocoResultado` (default ids) | `comSaidas(modeloEntrada(…))` (§6.1 layering) | `SAIDAS.linha`, `.digiteCada`, `.precos`, `.quantidades`; `RESULTADO.escolhaLado` | `role=status` line |
| E8 | C2 | `BlocoResultado` | `comSaidas(modeloEntrada(…))` | `RESULTADO.corrigir`, `.usarCalculado`, `.campoCorrigido`, `.notaCorrigido`, `.notaCustos` + `SAIDAS.daOperacao` | as built |
| E9 | C2 | `CamposPrecos.tsx` → `VenceuSemValor` (frozen; note from the model) | `estadoVsv` | `VSV.*` + `SAIDAS.vsvUltima` | as built |
| E10 | C2 | `MoviBreakeven.tsx` | `r.be`; effective = rendered && `r.be` (§6.4) | `BE_FECHADA.pill`, `.opcional` | `aria-pressed` pill 44 px; on → focus `f-bePreco` |
| E11 | C2 | `MoviBreakeven.tsx` | `r.bePreco`; `regraDoAtivo(rulesDoGate, …)`; `textoAFavor` | `BE_FECHADA.*`; `REGRA_BE.*` | field ≤ 200 px; status `role=status`; error `role=alert` |
| E12 | C2 | `registrarForm.ORDEM_PRECOS` + the row keys from `comSaidas`, `PassoEntrada` `alvoFoco` | effective pill (§6.4) | — | order of §6.3 |
| E13 | C2 | `registrarForm` draft v3 | sessionStorage via the frozen `RegistrarSheet` | — | — |
| E14 | C1 | `PassoAberta.tsx` (summary) | `view.breakeven`, `position.stopNow` | `REGRA_BE.linha` | plain note |
| E15 | C1 | `BlocoAgora.tsx` | `view.position`, `view.stopMoves`, forma | `AGORA.*` | `role=group aria-labelledby=l-agora`; rows wrap at 375 |
| E16 | C1 | `LinhaDoTempo.tsx` | `view.exits`, `.stopMoves`, `position.undo`, server clock | `TEMPO.*`, `DESFAZER_EV.link`, `.ariaParcial`, `.ariaStop`; `ABERTA.desfazerAte` | `ol` + `time`; ⓘ `InfoButton`; undo link 44 px, hidden with its «Até …» while E17 is open; items wrap |
| E17 | C1 | `LinhaDoTempo.tsx` | `useUndoEvent` | `DESFAZER_EV.perguntaParcial`, `.perguntaStop`; `ABERTA.sim`, `.manter` | focus «Sim, desfazer»; «Manter» → the link |
| E18 | C1 | `PassoAberta.tsx` | `firstExitCut(view.exits)` | `ABERTA_3C.notaPrimeiraParcial` | text |
| E19 | C1 | `AcoesAberta.tsx` | `canSplit(position.open)` | `ACOES.grupo`, `.saida`, `.parcial`, `.stop` | `role=group`, `aria-pressed`; one row at 320 px |
| E20 | C1 | `PassoAberta.tsx` | write answers | `PARCIAL.registrada`, `STOP.movidoBe`, `.movido`, `DESFAZER_EV.parcialDesfeita`, `.stopDesfeito`, `.limiteVolta` | `p role=status tabIndex=-1`, focused after each write |
| E21 | C1 | `SugestaoBreakeven.tsx` | `breakevenSuggestion` | `SUGESTAO.texto`, `.botao` | button 44 px → focus `#reg-primaria` |
| E22 | C1 | `PassoAberta.tsx` | `avisoDoLimite(limitBefore, gateNow)` → `textoAviso` | `FECHADA.atingido`, `.atingidoEncerrar`, `.atingidoAvisar`, `.oitenta` (as built) | `role=status` |
| E23 | C1 | `PassoAberta.tsx` (exit fields as built) | `saidaComParciais` | `ACOES.saiCom`, `.noTotal`, `.saidaAntesParcial`, `.daOperacao` | as built |
| E24 | C1 | `FormParcial.tsx` | `modeloParcial` → `useRegisterPartial` | `PARCIAL.*`, `QTD.*`, `RESULTADO.*`, `ERROS*` | chips group / field + «Metade»; focus order §5.5; ≤ 420 px one column |
| E25 | C1 | `FormMoverStop.tsx` | `modeloMoverStop` → `useMoveStop`; `useRulesNow` | `STOP.*`, `REGRA_BE.*` | group + fields; `#a-lim-s`; focus order §5.6 |
| E26 | C1 | `PassoAberta.tsx` → `Rodape` (frozen) | mode | `RODAPE.registrarSaida`, `ACOES.registrarParcial`, `.registrarStop` | `#reg-primaria`, busy = `aria-disabled` |
| E27 | C1 | `PassoAberta.tsx` | `view` | `ABERTA_3C.desfazerPergunta` | as built |
| E28 | C1 | `PassoAberta.tsx` + forms | `RegistrarDataError` | `ERRO_3C`, `ERRO_REGISTRAR`, `DESFAZER_EV.tarde`, `.naoUltimo` | sheet alert `role=alert` scrolled into view |
| E29–E31 | C1 | `PassoFechada.tsx` | `cartaoComParciais(view)` | `FECHADA_3C.emMedia`, `.comStopInicial*`; `FECHADA.r` | as built card |
| E32 | C1 | `PassoFechada.tsx` → `LinhaDoTempo` | `view` (exits, or the trade's own exit columns when it has no counting exit row) | `TEMPO.*` | as E16 without undo |
| E33 | C1 | `PassoFechada.tsx` | `view.breakeven`, `view.stopMoves` | `FECHADA_3C.be`, `.beDepois`, `.passou`, `.movido`, `.naoMovido` | `p` 13 px, `--text`, `margin-top: -6px`; order §5.11 |
| E34 | C1 | `PassoFechada.tsx` | `view.marks`, `view.exits` | `FECHADA_3C.linhaDepoisParcial` | text |
| E35 | C1 | as built | — | — | — |
| E36 | C1 | `Escolha.tsx` | `useTradeEvents(open ids)` | `ESCOLHA_3C.emAberto` | as built row; aria = action + line |
| E37 | C1 | `diario/linhas.ts`, `OperacoesDoDiaVista.tsx`, `OperacoesDoDia.tsx` | `useTradeEvents(day ids)` | `OPERACOES_DIA.parciais`, `.stopBe`, `.stopMovido`, `.emSaidas` | `span.hub-ops-dia__sub` inside the cell (block, 12 px, `--text-2`, weight 400); ≤ 860 px stays in row 2 col 1 |
| E38–E39 | C1 | `importar/passos.tsx`, `ImportSheet.tsx` (`operacoesDoArquivo`, `operacoesDoLote`, `toastDoLote`) | `ImportPreviewResult`/`ImportCommitResult` keys (`trades_new`/`trades`, `grouped`, `attached`) | `PASSO_D.agrupadas`, `.anexadas`, `.juntarN`; `FIM.agrupadas`, `.anexadas` | `p.hub-passo__txt` as the 3-3 linked lines; the primary's label (§5.12) |
| E40–E48, E51 | C2 | `personalizar/RegraBreakeven.tsx` (+ `SuasRegras.tsx`) | `rascunho.ts`/`regras.ts` helpers via `onEditar`; lazy `fetchRecentTrades` | `REGRAS_BE.*`; `PADRAO_DE_FUTUROS`, `SO_NESTA_CONTA`, `NAO_SALVO`, `REGRAS.ligada` | ids (`r-be`, `r-be-q`, `r-be-add`, `be-sw`, `be-{KEY}`, `e-be-{KEY}`, `rm-be-{KEY}`, `be-add-{KEY}`), on/off parts and focus §6.5; one column when narrow; 44 px buttons |
| E49 | C2 | `lib/hub/comoFicaHoje.ts` `partesVersao` | `Rules.breakeven` of each version | `NOTA.breakeven`, `.semBreakeven` | text |
| E50 | C2 | `personalizar/copy.ts` | — | `REGRAS.info` | ⓘ panel as built |
| E52 | both | each element above | `formaDoAtivo` | `QTD`, `PRECOS`, `RESULTADO`, `PASSOS_PRECOS` (as built) | — |

---

## 3. Data: what the screens read and write (`fase-3c/dominio` c7d38cd, final; §10 records what resolved)

### 3.1 Reads

| Read | Function / hook | Gives |
|---|---|---|
| One trade | `useTradeView(id)` → `fetchTradeState` / a write's `state` (`setTradeView`) | `TradeView`: `trade`, `context`, `plan`, `marks`, `marksNow`, `images`, **`exits: TradeExit[]`**, **`stopMoves: StopMove[]`**, **`position: Position`**, **`breakeven: TradeBreakeven \| null`** |
| `Position` (trade_state `position`) | `parsePosition` / `positionOf` | `quantity`, `closed`, `open`, `realizedPnl`, `exits` (counting), `partials`, `stopInitial`, `stopNow`, `stopKind`, `r` (closed), `undo: {kind: 'parcial'\|'stop', id, until} \| null` (from the tables `until` is given whatever its age: compare with the server clock) |
| `TradeExit` | trade_state `exits` / `trade_exits_v` | `id, origin 'app'\|'file', kind 'parcial'\|'final'\|null, quantity, exitPrice, exitTime (typed), registeredAt, pnl, pnlBasis, commission, voidedAt, fileExitAt, counts` |
| `StopMove` | trade_state `stop_moves` / `trade_stop_moves_v` | `id, origin 'live'\|'reconstructed', kind 'breakeven'\|'ajuste', stopPrice, prevStop, priceNow, favor, unit, movedAt, voidedAt, aoVivo` |
| `TradeBreakeven` | trade_state `breakeven` (version **at the entry**) | `{key, n, un, level}` (level not snapped; null for pips without a pip) |
| Rules now | `useRulesNow()` → `AccountNow` | `rules: Rules` (with `breakeven?: {by: {KEY: {n, un}}}` only when the rule acts), `gate.limit: LimitCheck`, `gate.tradingDay` |
| Server clock | `useServerNow(1000)` | `Date` |
| Day / open trades | `useDayTrades`, `useOpenTrades` (as built) **+ new `useTradeEvents(ids)`** (C1, §5.10) | exits and stop moves of the listed trades |
| Personalizar draft | `rascunho.ts`: `breakevenEfetivo(s, e)`, `breakevenMudou(saved, draft, e)`, `temProprio(s, id, 'breakeven')`; `regras.ts`: `BreakevenSetting {on, by: Record<KEY, decimal text>}`, `readBreakevenN(text)`, `resolveBreakeven`, `effectiveBreakeven`, `BREAKEVEN_OFF` | |

### 3.2 Writes (every write: `networkMode 'always'`, `retry: false`, `assertOnline()`; a retry is the owner's tap with the same `client_key`; a new key after a success)

| Button | Wrapper (registrarDb) | Payload (montar) | Answer |
|---|---|---|---|
| «Registrar parcial» | `registerPartial(db, tradeId, PartialPayload)` | `partialPayload({clientKey, quantity, exitPrice, exit?, clock, pnl?})` — `exit` omitted when it equals the current minute; never `costs` | `PartialRegistered {state, repeated, exitId, partial: {exitAt, pnl, points} \| null, gateNow}` |
| «Registrar stop» | `moveStop(db, tradeId, MovePayload)` | `movePayload({clientKey, kind: 'breakeven', priceNow})` («Breakeven»: `priceNow` required) or `{kind: 'ajuste', stopPrice, priceNow?}` («Outro preço», sent as typed even at the entry). Stored (`validateMove` = `move_stop`, §10 P1): the shortcut → `breakeven`; «Outro preço» at the entry **with** `priceNow` → `breakeven` with its points; at the entry **without** it → `ajuste` with `favor` null; elsewhere → `ajuste` | `MoveRegistered {state, repeated, moveId}` (no `gate_now`) |
| «Sim, desfazer» (timeline) | `undoEvent(db, tradeId, UndoEventPayload)` | `undoEventPayload(position.undo.kind, position.undo.id)` | `EventUndone {state, repeated, undone: {kind, id}}` (no `gate_now`) |
| «Registrar saída» after partials | `registerExit` (as built) | `exitPayload` (as built; closes the rest) | `ExitRegistered` + `exit.rest {quantity, totalPnl}` |
| «Registrar operação» («Já fechada») | `registerAfter` / `previewAfter` (as built) | `afterPayload(market, {…, exits: [{quantity, exitPrice, exit, pnl?, costs?}] (2–20, by hour), breakevenPriceThen?})` | `AfterRegistered`; dry run `exits[]` and `breakeven {stopPrice, priceThen, favor, unit}` |
| «Salvar alterações» (Personalizar) | as built (`save_rules` via the provider) | `MarketRulesJson.breakeven` / `AccountRulesJson.breakeven` = `{on, by: {KEY: number}}` (domain `breakevenJson`) | as built |

### 3.3 Error codes → screen (C1 and C2 map; `ERRO_REGISTRAR` entries added by the domain stay as they are)

| Code (field hint) | Where | Text |
|---|---|---|
| `partial_too_large` (quantity) | under «Parcial» quantity | «Use menos que os {aberto} em aberto; para sair com tudo, use “Saída”.» |
| `bad_quantity` (quantity) | same | the local quantity text, else «Informe a quantidade.» |
| `bad_price` / `off_tick` (exit_price) on a partial | under «Preço da parcial» | local texts (E24) |
| `bad_time`, `exit_in_future`, `exit_before_entry` (exit) on a partial | under «Hora da parcial» | «A parcial não pode ser depois de agora ({agora} ET).» / «… antes da entrada ({hora}).» / «Informe a hora.» |
| `pnl_required`, `bad_pnl` (pnl) on a partial | under the partial's result | «Informe o resultado.» / «Use só números, como −57,50.» |
| `too_many_exits` | sheet alert | «Até 20 saídas por operação.» |
| `exit_before_partial` (exit) on the final exit | under «Hora da saída» | «A saída não pode ser antes da última parcial ({hora}).» |
| `bad_stop` (stop_price) | under «Novo stop» | with a price now: the side text; else «O stop precisa ser maior que zero.» |
| `bad_stop` (price_now) | under «Preço agora» | the side text («Numa compra, o stop fica abaixo do preço de agora.») |
| `bad_price` (price_now) | under «Preço agora» | «Informe o preço de agora.» (empty) / «O preço precisa ser maior que zero.» (/ «prêmio» with options) |
| `bad_price` (price_now) for a price whose points in favour do not fit a stop move (pips: 10^10 or more from the entry, a typo such as 2.000.000 on EUR/USD; c7d38cd) | under «Preço agora» | «Confira o preço de agora.» (N; the local check gives it first, as `validateMove`) |
| `off_tick` (stop_price \| price_now) | under that field | «O MES anda de 0,25 em 0,25; confira o preço.» |
| `same_stop` | under «Novo stop» (or the «Para onde?» group with «Breakeven») | «O stop já está em {stop}.» |
| `too_many_moves` | sheet alert | «Até 20 movimentos de stop por operação.» |
| `undo_too_late` (undo_event) | sheet alert; the link goes | «Passaram 15 minutos: não dá mais para desfazer.» |
| `not_newest` | sheet alert; the trade is read again | «Só o último registro pode ser desfeito.» |
| `nothing_to_undo` | sheet alert; the trade is read again | «Não há o que desfazer.» |
| `not_open` (any 3c write) | as built: refetch the trade → step 3 with «Esta operação já foi fechada em outro lugar.» | |
| `unknown_trade` | as built (`aoSumiu`) | |
| `not_app_trade`, `not_for_market`, `exits_mismatch`, anything else | sheet alert, `ERRO_REGISTRAR[code]` | |
| `register_after` refusals with field `exits` | the first row's quantity field takes the focus; the text goes to the sheet alert (`ERRO_REGISTRAR[code]`). The local checks catch every such case first except the two c7d38cd added for sums that do not fit the trade (numeric(18, 2)): `bad_pnl` (the rows' results) and `bad_costs` («Custos» over the exits), whose alert is the as-built `ERRO_REGISTRAR` text | |
| `bad_pnl` (pnl) on the final exit after partials (realized + the rest does not fit the trade; c7d38cd) | under the exit's result (typed or «Corrigir») | as built (`textoDaRecusa`) |
| `register_after` refusals with field `breakeven` (`bad_price`, `off_tick`, `bad_stop`) | under «Preço quando moveu» | the E11 texts; `bad_price` for a price whose points do not fit (pips, as above; c7d38cd): «Confira o preço quando moveu.» (N; local check first, as `afterBreakeven`) |
| `bad_breakeven` (save_rules) | Personalizar's save alert | as built: `ERRO_REGRAS` already maps every rules code to «Não foi possível salvar. Nada foi alterado.» (the local checks prevent it); no new key |
| `repeated: true` (partial, move, undo) | success: the same texts as a first answer, from the answer's state | |
| `offline` / `network` | sheet alert, as built; fields keep what was typed; the same tap resends the same `client_key` | |

### 3.4 Display rules both lanes follow

1. **Breakeven on screen = a stop exactly at the entry price** (geometric, as the board: RO js l.1657), whatever `kind`
   the server stored. Resolved (§10 P1): «Outro preço» at the entry without «Preço agora» is stored as an `ajuste` with no
   points and reads «Stop no breakeven …» without «com …» everywhere (E15 via `stopNowStatus`, E16, E20, E33, E37);
   with «Preço agora» it is stored as a `breakeven`. Never branch on `kind` for a word on screen.
2. **Points in favour on screen come from prices**: `(price − entry) × side` through `diferencaTexto(forma, dif)`; never from
   the stored `favor` (which is divided by the pip for pips).
3. **Average exit** = `averageExit(counting exits)` shown with `forma.casasMostra` decimals after rounding (half up);
   the operation's difference = (average − entry) × side, rounded to 2 decimals on `ptsFut` before `diferencaTexto`
   («+11,67 pts»); other units round inside `diferencaTexto`.
4. **R** = `position.r` (closed) or `rOfExits` (domain), shown as `FECHADA.r` with 2 decimals, signed.
5. **Times**: HH:MM on the account clock (`hora(conta, at)`); another trading day: «ontem, 10:52» / «21 out, 10:52»
   (`diaRelativo`); status and confirmation lines add the clock suffix where the board does («às 10:18 ET»).
6. Counting exits only (`counts === true`; `countingExits`), undone rows and undone moves never shown.
7. The rule a trade follows is `view.breakeven` (its version at the entry), never today's; step 1 reads today's rules.

---

## 4. The one cross-lane interface: commit **C1-0** (on the base; C1 owns the files from there)

**Committed on `fase-3c/telas` as b906512** («Phase 3c · telas: C1-0, the breakeven rule's words shared by both
lanes»), exactly this content, with its test, before either lane branched: both lanes start from it, so nobody
cherry-picks it. Checks at b906512: Jest (102 suites; the 8 database-backed ones skip in plain Jest), `tsc --noEmit`, `next lint`,
and the 8 database-backed suites on a throwaway cluster (`telas/pg/pg_run.sh`), all green. From there **C1 owns both
files**: it may add exports but must not change the signatures or the outputs below; C2 only imports them.

**`app/components/hub/registrar/copyRegra.ts`** (new)

```ts
/**
 * Phase 3c: the breakeven rule's words shared by step 1 (lane C2) and steps 2–3 (lane C1).
 * Board: RegistrarOperacao.dc.html approved 21 Oct (16 scenarios). B = board copy, N = new.
 */
export const REGRA_BE = {
  /** «+8 pts» (B, RO js l.1432) · «+7,5 pips» · «+0,50 no preço» (N: the board draws futures only) */
  n: (valor: string, un: 'pts' | 'pips' | 'price') => (un === 'pts' ? `+${valor} pts` : un === 'pips' ? `+${valor} pips` : `+${valor} no preço`),
  /** «Sua regra: breakeven com +8 pts, em 7.920,50.» / «Sua regra: breakeven com +8 pts.» (B, RO js l.1432, 1650, 1746) */
  linha: (n: string, nivel: string | null) => (nivel ? `Sua regra: breakeven com ${n}, em ${nivel}.` : `Sua regra: breakeven com ${n}.`),
  /** «Com +8,00 pts a favor» / «com +12,00 pts a favor» (B, RO js l.1497) */
  aFavor: (dif: string, maiuscula: boolean) => `${maiuscula ? 'Com' : 'com'} ${dif} a favor`,
  /** «Com 3,00 pts contra» (B; `dif` without its sign) */
  contra: (dif: string, maiuscula: boolean) => `${maiuscula ? 'Com' : 'com'} ${dif} contra`,
  /** «Com o preço na entrada» (B) */
  naEntrada: (maiuscula: boolean) => `${maiuscula ? 'Com' : 'com'} o preço na entrada`,
}
```

**`app/lib/hub/registrarRegra.ts`** (new, pure)

```ts
import type { Rules } from '@/lib/domain/gate'
import { breakevenOf, tradeMatchKey, type TradeBreakeven } from '@/lib/domain/registro'
import { fromInt, mul, numeric, numericText, sub } from '@/lib/domain/registro/numeric'
import { REGRA_BE } from '@/components/hub/registrar/copyRegra'
import { formatDecimal } from './numero'
import type { FormaAtivo } from './registrarAtivos'
import { diferencaTexto, precoDe } from './registrarForm'

/**
 * The rule of an asset in a Rules value (rules_now's for step 1, a version's), with the price it
 * names when the side and a valid entry price are known; null when the rules have no value for it
 * (no rule, a binary, an option, an asset not in the rule)
 */
export function regraDoAtivo(
  rules: Pick<Rules, 'market' | 'breakeven'> | null | undefined,
  symbol: string,
  o: { option: boolean; direction: 'long' | 'short' | null; entryPrice: string | null },
): TradeBreakeven | null {
  if (!rules?.breakeven || rules.market === 'binary' || o.option) return null
  const key = tradeMatchKey(rules.market, symbol)
  const r = Object.prototype.hasOwnProperty.call(rules.breakeven.by, key) ? rules.breakeven.by[key] : null
  if (!r) return null
  const full = o.direction && o.entryPrice ? breakevenOf(rules.breakeven, rules.market, symbol, false, o.direction, o.entryPrice) : null
  return { key, n: r.n, un: r.un, level: full?.level ?? null }
}

/** «+8 pts» · «+7,5 pips» · «+0,50 no preço» */
export const textoN = (rule: Pick<TradeBreakeven, 'n' | 'un'>): string => REGRA_BE.n(formatDecimal(rule.n), rule.un)

/** «Sua regra: breakeven com +8 pts, em 7.920,50.» (with `rule.level`), else «Sua regra: breakeven com +8 pts.» */
export const linhaRegra = (forma: FormaAtivo | null, rule: TradeBreakeven): string =>
  REGRA_BE.linha(textoN(rule), rule.level === null ? null : precoDe(forma, rule.level))

/** «Com +8,00 pts a favor» / «com 3,00 pts contra» / «com o preço na entrada» (no final period) */
export function textoAFavor(forma: FormaAtivo, entryPrice: string, price: string, side: 'long' | 'short', maiuscula: boolean): string {
  const dif = numericText(mul(sub(numeric(price), numeric(entryPrice)), fromInt(side === 'long' ? 1 : -1)))
  const n = Number(dif)
  if (n > 0) return REGRA_BE.aFavor(diferencaTexto(forma, dif), maiuscula)
  if (n < 0) return REGRA_BE.contra(diferencaTexto(forma, dif).replace(/^[−-]/, ''), maiuscula)
  return REGRA_BE.naEntrada(maiuscula)
}
```

Tests of C1-0 (committed with it, `__tests__/lib/hubRegistrarRegra.test.ts`, 14 tests; C1's from there):
`regraDoAtivo` with `agora-sex-0900` rules (Top One MES +8: long 7.912,50 → level 7920.5, short → 7904.5; no side or no
price → level null; MNQ 30.880 → 30910; MGC short 4.421,30 → 4416.3; «MESZ6» keys as MES; = `breakevenOf` wherever both
name a price; ES, ZN, an option, no rule, no rules, a binary → null; FTMO EUR/USD +7,5 pips → `un 'pips'`, level
1.08595); `textoN` («+8 pts», «+7,5 pips», «+0,5 no preço», «+1.500 pts»); `linhaRegra` both forms, EUR/USD with 5
decimals; `textoAFavor` futures both sides (in favour, against, at the entry), pips, premium, per share, per coin, B3
points and a price; no prototype label in `REGRA_BE`.

---

## 5. Lane C1 · the open and closed trade, the chooser, the bridge, the import lines

### 5.1 Files

| Edits (exclusive) | Change |
|---|---|
| `app/lib/hub/registrarDb.ts` | additive, at the end: the trade-events read (§5.10); nothing above it changes |
| `app/hooks/useRegistrar.ts` | additive: `RegistrarWrite` + `'parcial' \| 'stop' \| 'evento'`; key `registrarKeys.eventos`; prefix and invalidation target `'eventos'`; hooks `useRegisterPartial`, `useMoveStop`, `useUndoEvent`, `useTradeEvents` (§5.9) |
| `app/components/hub/registrar/PassoAberta.tsx` | step 2 (§5.3–5.8) |
| `app/components/hub/registrar/PassoFechada.tsx` | step 3 (§5.11) |
| `app/components/hub/registrar/Escolha.tsx` | chooser line (E36) |
| `app/components/hub/registrar/BlocoResultado.tsx` | one optional prop, default unchanged (§5.5) |
| `app/components/hub/diario/OperacoesDoDia.tsx`, `OperacoesDoDiaVista.tsx`, `linhas.ts`, `diario/copy.ts` | bridge second line (E37) |
| `app/components/hub/importar/passos.tsx`, `ImportSheet.tsx`, `app/components/hub/contas/copy.ts` (only `PASSO_D` and `FIM`) | import lines (E38–E39) |
| `app/app/(hub)/layout.tsx` | one line: `import '@/styles/hub-registrar-parciais.css'` after `hub-registrar-opcao.css` |
| `app/styles/hub-operacoes-dia.css` | the bridge's second line, the import lines |

| Creates (exclusive) | |
|---|---|
| `app/components/hub/registrar/copyRegra.ts`, `app/lib/hub/registrarRegra.ts` (+ `__tests__/lib/hubRegistrarRegra.test.ts`) | C1-0 (§4): already on the base (b906512); C1's from there (new exports only) |
| `app/lib/hub/registrarParciais.ts` | pure models of E14–E37 (§5.2) |
| `app/components/hub/registrar/copyParciais.ts` | every C1 string (§5.13) |
| `app/components/hub/registrar/AcoesAberta.tsx` | E19 |
| `app/components/hub/registrar/FormParcial.tsx` | E24 |
| `app/components/hub/registrar/FormMoverStop.tsx` | E25 |
| `app/components/hub/registrar/BlocoAgora.tsx` | E15 |
| `app/components/hub/registrar/LinhaDoTempo.tsx` | E16–E17 (step 2, with undo) and E32 (step 3) |
| `app/components/hub/registrar/SugestaoBreakeven.tsx` | E21 |
| `app/styles/hub-registrar-parciais.css` | all C1 sheet styles; classes prefixed `hub-rp-`; every rule scoped `.hub` |
| `app/testing/parciaisTelas.ts` | test helpers composing the domain's recorded fixtures (§8.1) |
| tests | §8.1 |

C1 imports, never edits: everything in §7.3 (frozen), `registrarForm.ts` (C2's) exports listed in §6.1.

### 5.2 `registrarParciais.ts` (pure; signatures are C1's, shown so tests and review agree)

```ts
export type ModoAberta = 'saida' | 'parcial' | 'stop'
export interface EventosDaOperacao { exits: TradeExit[]; stopMoves: StopMove[]; position: Position; breakeven: TradeBreakeven | null }
export function modosDaAberta(conta: ContaReg, view: TradeView): ModoAberta[]           // [] on binary; 'parcial' only with canSplit
export function regraNoResumo(conta: ContaReg, view: TradeView): string | null          // E14
export function modeloAgora(conta: ContaReg, view: TradeView): ModeloAgora | null        // E15 (null without a partial or live move)
export function linhaDoTempo(conta: ContaReg, view: TradeView, now: Date, o: { comUndo: boolean }): ItemTempo[]  // E16, E32 (no counting exit row on a closed trade: one «Saída» item from view.trade, §5.11)
export function desfazerEvento(conta: ContaReg, view: TradeView, now: Date): ModeloDesfazer | null  // E16 link, E17 texts
export function notaPrimeiraParcial(conta: ContaReg, view: TradeView): string | null    // E18
export function saidaComParciais(conta: ContaReg, view: TradeView, c: SaidaCampos, now: Date, tentou: boolean): ModeloSaida & { nota: string | null }  // E23
export function modeloParcial(conta: ContaReg, view: TradeView, c: CamposParcial, now: Date, tentou: boolean): ModeloParcial  // E24
export function modeloMoverStop(conta: ContaReg, view: TradeView, c: CamposStop, agora: AccountNow | null, tentou: boolean): ModeloStop  // E25
export function sugestaoBreakeven(conta: ContaReg, view: TradeView, partialPrice: string): string | null  // E21
export function textoDepoisDoUndo(conta: ContaReg, ev: { kind: 'parcial' | 'stop'; hora: string }, at: Date,
  limite: { market: AccountMarket; tradeDay: string | null; before: LimitAt | null; after: LimitAt | null; pref80: boolean }): string  // E20 undo lines (+ limit back)
// LimitAt = { tradingDay: string; limit: LimitCheck } (the shape limitBeforeOf returns)
export function cartaoComParciais(conta: ContaReg, view: TradeView, now: Date): CartaoFechada & { tempo: ItemTempo[] | null; breakeven: string | null }  // E29–E33
export function linhaDepoisComParciais(conta: ContaReg, view: TradeView): string        // E34
export function linhaEscolhaComParciais(conta: ContaReg, t: RegisteredTrade, ev: TradeEvents | null, now: Date): string  // E36
export function subDaPonte(market: AccountMarket, t: RegisteredTrade, ev: TradeEvents | null): string | null  // E37 (stop part: the newest live move not undone only)
```

It may use `registrarForm` exports (§6.1 frozen list), `registrarAtivos.formaDoAtivo`, `registrarRegra` (C1-0), the domain
(`canSplit`, `halfOpen`, `partialQuantityError`, `validatePartial`, `validateMove`, `stopNowStatus`, `ifStopped`,
`riskAtStop`, `breakevenSuggestion`, `averageExit`, `rOfExits`, `countingExits`, `firstExitCut`, `lastEvent`,
`pnlFromPrices`, `exitInstant`, `riskBeyondLimit`, `dayLimitOf`, `partialPayload`, `movePayload`, `undoEventPayload`),
`numero` and `formato`. The private readers of `registrarForm.ts` (`lerPrecoDe`, `lerQuantidade`, `lerDinheiro`,
`blocoResultado`) are **not** exported: C1 writes its own small readers here (price with the partial's and the stop's
empty texts, quantity, signed money: the same rules as 3-4, its own empty-field words), and a test pins them to the same
outputs as the as-built ones on shared inputs.

### 5.3 Step 2 frame and order (PassoAberta)

DOM order (board RO l.466–561): h3 → sr status → summary (+ E14) → **E15** → **E16** (+ E17) → plan pill → «Suas marcas»
(+ **E18**) → «Como você está?» → «Setup e execução» → **E19** → **E20** (always present) → **E21** → **E22** → the mode's
fields (**E23** / **E24** / **E25**) → «Desfazer entrada» (**E27**) → sheet alert (as built) → footer (**E26**). Binary:
unchanged (no E14–E25).

State kept in PassoAberta while the step lives (it remounts only on a step change): `modo: ModoAberta` (starts and returns
to `'saida'` after every successful partial, move or undo), each form's fields (`SaidaCampos`, `CamposParcial`,
`CamposStop`; switching mode keeps them; never drafted to sessionStorage), `tentou` per form, `acaoSt: { texto, sugestao,
aviso } | null` (the text and the banner stay until the next write or a step change; the suggestion goes on any pill press,
on its own button and on the next write — board js l.1755, 1758), one `client_key` per form (new after its success; kept
across a retry), `undoAberto`.

### 5.4 E19 «O que registrar agora?» + E26 footer (`AcoesAberta.tsx`)

- `GrupoPills` pattern (as built `ui.tsx`): `span#l-agoraq.hub-rot-campo` + `div role=group aria-labelledby=l-agoraq
  .hub-pills`; buttons `aria-pressed`. «Parcial» is not rendered while `canSplit(spec, position.open)` is false.
- Press (board js l.1755: `setF({ modoA, tentou: {}, undoAb: false, acaoSt: {…, sug: null} })`): sets the mode, clears
  `tentou` of **every** form, closes an open undo confirmation (`undoAberto = false`; the «Desfazer» link and its «Até …»
  come back) and clears the suggestion; the action status text and the banner stay; focus stays on the pill. Keyboard:
  Tab reaches the pills; Space/Enter press; the mode's first field is next in Tab order.
- Footer primary: `RODAPE.registrarSaida` / `ACOES.registrarParcial` / `ACOES.registrarStop` (id `reg-primaria` as built),
  `ocupado` while a write runs (aria-disabled + ref guard, as built C11).
- Layout: one row at 320 px (≈ 260 px with gaps); pills 44 px.

### 5.5 E24 «Parcial» (`FormParcial.tsx`)

- Data: `view` (trade, position.open), `formaDoAtivo(market, symbol, {opcao, cotacao})`, server clock; preview local
  (domain `validatePartial` mirrors the database; no dry run).
- Quantity: contract units (`forma.quantidade.chips` and integer): chips `1…open−1` when open ≤ 5, else «1» «2» «3» +
  «Outro» (→ field «Quantos contratos?» `f-pq`, focus moves there); the first chip pressed on opening; the chips group is
  `span#l-pq.hub-rot-campo` + `div role=group aria-labelledby=l-pq aria-describedby=n-pq` (RO l.528). Other units: field
  `f-pq` (max 200 px, `inputmode=decimal`) starting empty + pill «Metade» = `halfOpen(spec, open)` (hidden when null);
  pressing it fills the field and focuses it. `span#n-pq.hub-nota role=status`: «Em aberto: {open}.» before a valid
  quantity, «Ficam {rest} em aberto.» / «Fica {rest} em aberto.» (rest exactly 1). B3 catalog shares: the lot note when
  the partial or the rest is not a multiple of 100 (PETR4 300: «Metade» 150 → note; 100 → rest 200 → no note).
- Price `f-ppreco` (starts empty) | hour `f-phora` (`type=time step=60`, prefilled with the server's minute and ticking
  while untouched): `.hub-campos2` (one column ≤ 420 px).
- Preview (`BlocoResultado` with `ids={{ res: 'f-pres', caixa: 'caixa-pres', custos: 'f-pcustos' }}`; the model's `custos` is null): line E24; «Corrigir»
  (new markets with a computed value); typed field «Resultado desta parcial, {M}» with its note; estimate note. **The one
  BlocoResultado change** (C1-owned, interface for C2 which renders it in «Já fechada»): an optional prop
  `ids?: { res: string; caixa: string; custos: string }`, default `{ res: 'f-res', caixa: 'caixa-res', custos: 'f-custos' }`
  — every as-built render stays identical.
- No «Custos» and no «Venceu sem valor» on a partial.
- Errors (after a tap of «Registrar parcial»): focus order `pq` (`g-pq-0` with chips, else `f-pq`), `ppreco`, `phora`, `pres`.
- Success: `acaoSt.texto` = E20 partial text; then the suggestion (E21) and the banner (E22) as computed; mode back to
  `'saida'`; the partial's fields cleared; new `client_key`; focus to the action status.
- Payload: `partialPayload({ clientKey, quantity, exitPrice, exit: hm === currentMinute ? undefined : hm, clock: conta.clock, pnl })`.

### 5.6 E25 «Mover stop» (`FormMoverStop.tsx`)

- «Para onde?» group (`l-para`, `aria-describedby=e-sModo` when erroneous): «Breakeven · {entrada}» pressed on opening
  unless the current stop is already at the entry, then «Outro preço» (and pressing «Outro preço» focuses `f-sNovo`).
- `.hub-campos2`: «Novo stop» `f-sNovo` (only «Outro preço») | «Preço agora» `f-sAgora` (label + `<span class="hub-opc">·
  opcional</span>` only with «Outro preço»). Both start empty unless the suggestion prefilled «Preço agora».
- Status `span.hub-num role=status` (in `.hub-linha-i`): [`textoAFavor(..., true) + '.'` when «Preço agora» is valid] +
  [`REGRA_BE.linha(textoN(view.breakeven), null)` when the trade has a rule], joined by a space.
- `span#n-sSe.hub-nota.hub-num` (bold): «Se o novo stop for atingido: {≈}{total} no total.» = `ifStopped(spec, sgn, entry,
  open, newStop, realized)`; absent when null (typed instruments).
- `p#a-lim-s role=status` always in the DOM (`sr-only` when empty): `agora` = `useRulesNow().data?.accounts` of the trade's
  account (PassoAberta reads it; RegistrarSheet is frozen); the limit warning when the trade's trading day is the
  account's today, the limit is evaluated and not reached, and `riskBeyondLimit(dayLimitOf(agora.gate.limit, currency),
  riskAtStop(spec, sgn, entry, open, newStop))` answers; `f-sNovo` gets `aria-describedby="a-lim-s"` while it shows.
- Local checks in the board's order (js l.1621–1635) with the E25 texts; domain `validateMove` must agree (test). One
  check the board does not draw (c7d38cd): on pips, a «Preço agora» whose points in favour do not fit a stop move
  (`favorOf` 10^10 or more) → «Confira o preço de agora.» (N, `STOP.agoraLonge`), with the field's `bad_price` checks
  and before its tick text, as `validateMove` orders them. With «Outro preço», a «Novo stop» exactly at the entry needs
  no «Preço agora» (D4 stands; §10 P1). Errors focus order `g-sModo-0`, `f-sNovo`, `f-sAgora`.
- Payload: «Breakeven» → `movePayload({ clientKey, kind: 'breakeven', priceNow })`; «Outro preço» → `{ kind: 'ajuste',
  stopPrice, priceNow? }`, sent as typed and never converted client-side: the server stores a `breakeven` when the level
  is the entry and «Preço agora» came, an `ajuste` with no points when it did not (§10 P1); the screen is geometric
  either way (§3.4.1). Tests: `stop-mes-entrada-ajuste` (11:31, no price: «Stop no breakeven (7.930,00) às 11:31 ET.»,
  «Stop no breakeven · 7.930,00», «Agora» «· no breakeven, desde 11:31») and `stop-mes-entrada-breakeven` (11:32, with
  7.934,25: «…, com +4,25 pts a favor.»).
- Success: E20 text — breakeven words when the new stop equals the entry (§3.4.1), «, com …» only with a price; mode back
  to `'saida'`; fields cleared; new `client_key`; focus to the action status.

### 5.7 E15, E16, E17, E18, E20–E22, E23, E27

- **E15 `BlocoAgora.tsx`**: shown when `position.partials > 0` or a live, not undone move exists. Rows `.hub-reg-ctx-linha`
  (`span.hub-reg-rot` + `b.hub-num` + `span`): «Em aberto» `sufixo(open)` «de {formatDecimal(quantity, lots: 2 dp)}»;
  «Stop» `precoDe(stopNow)` + sub from `stopNowStatus` («· o da entrada» when no live move; «· no breakeven, desde
  {hora}» / «· garante …» / «· arrisca …» with the move's `movedAt`; «sem stop» with an empty value); «Realizado»
  `formatMoney(realizedPnl, signed)` coloured mint/red/text + «em N parcial(is)». Under: «Se o stop for atingido: …»
  (`ifStopped` with `stopNow`). Wraps at 375 px. «The move» here is the current one: the newest live move not undone
  (board `movAtual`, RO js l.986).
- **E16/E17 `LinhaDoTempo.tsx`** (props `itens`, `undo?: { aria, ate, pergunta, aoAbrir, aoConfirmar, aoManter, aberto,
  ocupado }`): `.hub-bloco` with `div.hub-reg-cab` (label `span#l-tempo.hub-rotulo` + `InfoButton` panel `info-tempo`),
  `ol.hub-rp-tempo aria-labelledby=l-tempo`; `li`: `time.hub-num` (or `span.hub-rp-sem-hora` «—» aria-hidden + sr-only
  «sem hora»), `span.hub-rp-item` text + `span.hub-rp-sub` sub-line (block, 12 px, `--text-2`, font-weight 400, as the
  board's `.sub-op`, RO l.165), and on the newest event only: `button.hub-reg-link
  .hub-reg-link--perigo` «Desfazer» (aria per E16) + `span.hub-nota` «Até {until}, 15 minutos depois do registro.». Items
  sorted by instant (typed hour for exits, `movedAt` for moves; ties: entry, told breakeven, partial, move, exit). The
  link exists while `position.undo` names an event, the trade is open, and `serverNow < undo.until` (re-render each
  second; it disappears at the deadline and an open confirmation closes, as «Desfazer entrada» does). The told breakeven
  (no time) sits right after the first exit when there are ≥ 2 exits, else right after the entry (board js l.1509). Confirmation
  `.hub-reg-confirma role=group aria-labelledby=t-desfazer-ev` (after the `ol`): «Desfazer» opens it and focuses «Sim,
  desfazer»; **while it is open the link and its «Até …» note are not rendered** (board `temUndo: podeUndo && !undoAb`,
  RO js l.1704), so the two never show together; «Manter» closes it, the link and the note come back and the link takes
  the focus; a pill press (§5.4) also closes it; «Sim» runs `useUndoEvent`; success → E20 undo text (+ « Com a parcial desfeita, …» only for a partial of a trade that counts on
  today, when the cached limit before was reached, or ≥ 80 % with the preference, and the fresh one after is neither;
  the amounts are the fresh `worstCents` and the limit, compact), focus to the action status.
- **E18**: in «Suas marcas», `p.hub-reg-txt` while a counting partial exists (hour = `firstExitCut`).
- **E20**: `p#reg-acao-st` `role=status tabIndex=-1`, class `hub-reg-st` with text, `sr-only` empty.
- **E21 `SugestaoBreakeven.tsx`**: right after a partial when `breakevenSuggestion(spec, view.breakeven, sgn, entry,
  partialPrice, stopNow)` answers; «Mover para o breakeven» sets mode `'stop'`, «Breakeven» pressed, «Preço agora» =
  the partial's price (formatted), clears `tentou` and the suggestion, focuses `#reg-primaria` (board js l.1758).
- **E22**: `avisoDoLimite({ market, tradeDay: state.trade.tradingDay, before: limitBefore, after: gateNow, exitAt:
  partial.exitAt, pref80 })` → `textoAviso(conta, aviso, exitAt)` → `p.hub-reg-aviso-lim(--atingido) role=status` under
  the status. A repeated answer shows none.
- **E23** (`saidaComParciais`): `modeloSaida(conta, { ...trade, quantity: position.open }, …)`; with partials: the note
  under the pills, `« · no total {≈}{realized + rest}»` appended when the rest is computed, the hour error when the typed
  exit is before the latest counting partial, «Custos» note + « Da operação toda.». Payload unchanged (the server closes
  the rest).
- **E27**: `ABERTA_3C.desfazerPergunta` replaces `ABERTA.desfazerPergunta` when partials or live moves exist.

### 5.8 Errors and writes (E28)

Each write follows PassoAberta's as-built pattern: ref guard + `ocupado`; `RegistrarDataError` code → §3.3; a field
refusal is shown under its field and the field focused (if it is not on screen, the sheet alert instead); `not_open` →
`refetchQueries(operacao)` then `aoFechadaFora()`; `unknown_trade` → `aoSumiu()`; others → the sheet alert.
**The alert keeps which write was refused**: PassoAberta's as-built `erroGeral: RegistrarErrorCode | null` becomes
`{ code: RegistrarErrorCode; de: 'antes' | '3c' } | null` — `'3c'` for «Registrar parcial», «Registrar stop» and the
timeline's «Sim, desfazer», whose text is `ERRO_3C[code] ?? ERRO_REGISTRAR[code]`; `'antes'` for the as-built writes
(«Registrar saída», «Desfazer entrada»), whose text stays `ERRO_REGISTRAR[code]`. So `undo_too_late` reads
«Passaram 15 minutos: não dá mais para desfazer.» after an event undo and keeps the as-built «Passaram 15 minutos: a
entrada não pode mais ser desfeita.» after «Desfazer entrada» (a `RegistrarAberta` test pins both). `repeated: true` =
success (texts from the answer's state). After `not_newest` or `nothing_to_undo` the trade is read again.

### 5.9 Hooks (additions to `useRegistrar.ts`)

```ts
export type RegistrarWrite = 'entrada' | 'saida' | 'fechada' | 'desfazer' | 'marcas' | 'extras' | 'parcial' | 'stop' | 'evento'
registrarKeys.eventos = (uid, ids: string) => ['hub', uid, 'registrar', 'eventos', ids]   // ids: sorted, joined by ','
// REGISTRAR_INVALIDATIONS: add 'eventos' to saida, fechada and desfazer (not to entrada, marcas, extras); new entries:
//   parcial: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora']
//   stop:    ['dia', 'eventos', 'previa']
//   evento:  ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora']
export function useRegisterPartial(): UseMutationResult<PartialRegistered & { limitBefore: … | null }, RegistrarDataError, { tradeId: string; accountId: string; payload: PartialPayload }>
export function useMoveStop(): UseMutationResult<MoveRegistered, RegistrarDataError, { tradeId: string; payload: MovePayload }>
export function useUndoEvent(): UseMutationResult<EventUndone & { limitBefore: … | null; limitAfter: … | null }, RegistrarDataError, { tradeId: string; accountId: string; payload: UndoEventPayload }>
//   limitAfter: after the RPC, fetchQuery(regrasKeys.agora(uid), fetchRulesNow, staleTime 0) → the account's {tradingDay, limit}
export function useTradeEvents(tradeIds: readonly string[] | null): UseQueryResult<Record<string, TradeEvents>, RegistrarDataError>
//   enabled only with ≥ 1 id; refetchOnWindowFocus 'always'
```

Each mutation's `onSuccess`: `recordServerNow`, `setTradeView(state)`, `invalidateAfterRegistrar(write)`.

### 5.10 The trade-events read (additions to `registrarDb.ts`)

```ts
export interface TradeEvents { exits: TradeExit[]; stopMoves: StopMove[] }
export interface TradeEventsRows { exits: unknown; stopMoves: unknown }   // rows carry trade_id
export function tradeEventsOfRows(rows: TradeEventsRows): Record<string, TradeEvents>   // bad_answer on another shape
export async function readTradeEventsRows(db: SupabaseClient, tradeIds: readonly string[]): Promise<TradeEventsRows>
//   [] → { exits: [], stopMoves: [] } without a query; else two reads:
//   trade_exits_v      select(`trade_id, ${EXIT_COLUMNS}`).in('trade_id', ids).order('exit_time').order('id')
//   trade_stop_moves_v select(`trade_id, ${MOVE_COLUMNS}`).in('trade_id', ids).order('moved_at').order('id')
export async function fetchTradeEvents(db: SupabaseClient, tradeIds: readonly string[]): Promise<Record<string, TradeEvents>>
```

Uses the module's private `parseExitRow` / `parseStopMove`. Only trades with more than one exit have exit rows (banco): a
trade closed in one exit has `exits: []` here and in `view.exits` (the bridge shows no «em N saídas»; step 3 builds its
one exit item from the trade's columns, §5.11).

### 5.11 Step 3 (PassoFechada) and E36/E37

- **E29–E31** `cartaoComParciais`: base `cartaoFechada`; with ≥ 2 counting exits the line is rebuilt (`opTexto · {entrada}
  → {média} em média · {dif} · {periodo}`); R from `position.r` with `FECHADA_3C` subs when any non-undone move exists.
- **Step 3 DOM order** (RO l.567–585): the result card (E29–E31, as built) → **E32** → **E33** → the as-built banner
  (**E35**) → the plan line → «Suas marcas» (+ **E34**) → the rest as built.
- **E32**: `LinhaDoTempo` without undo when ≥ 2 counting exits or any move not undone (live or told). **The exits**: the
  counting rows (`countingExits(view.exits)`); when there is none (a trade closed in one exit has no `trade_exits` rows,
  banco: «Only trades with more than one exit get rows»), **one exit item built from the trade's own columns**, as the
  board's `fillsDe` does with `t.sai` (RO js l.969–976): time `trade.exitTime`, «Saída · {sufixo(trade.quantity)} a
  {precoDe(trade.exitPrice)} · {diferencaTexto((exitPrice − entry) × side)}{din}» with `din` from `trade.pnl` and
  `trade.pnlBasis` (`estimate` → «≈ », `typed` → «, digitado»; no pnl → no part) — the domain does the same for R
  (`positionOf` falls back to `[{ quantity, exitPrice }]`). This covers a live trade moved then closed in one «Saída», and a
  «Já fechada» trade in one exit with the pill. **Exit labels** (board js l.1504: `r.depois && fs.length >= 2 ? (j+1)+'ª
  saída' : kind === 'parcial' ? 'Parcial' : 'Saída'`): «Nª saída» only when the trade has **≥ 2 counting exits** and was
  registered with «Já fechada» (`trade.source === 'after'` or context origin `reconstructed`) or its exits are file rows
  (N: not drawn); else «Parcial» / «Saída» (a «Já fechada» trade in one exit reads «Saída · …», never «1ª saída · …»).
  The sub-line «registrada às …» only on live partials whose registration minute differs.
- **E33**: only with `view.breakeven`; among not-undone moves in time order: the first breakeven move (stop = entry), live
  → «Breakeven às …» or told → «… registrado depois»; else the first live move beyond the entry → «passou»; else the first
  live move → «movido»; else a live trade → «não foi movido»; a «Já fechada» trade without the pill → no line; each «com …»
  from that move's price then (board js l.1810–1821). `p.hub-rp-be` 13 px, `--text`, `margin-top: -6px` (RO l.581).
- **E34** `linhaDepoisComParciais`: as built, with the cut = `firstExitCut` when earlier than the exit.
- **E36** (Escolha): `useTradeEvents(abertas ids)`; while loading, the as-built line.
- **E37** (bridge): `OperacoesDoDia` reads `useTradeEvents(day trade ids)`; `LinhaDoDia` gains `sub: string | null`;
  `OperacoesDoDiaVista` renders `span.hub-ops-dia__sub` (display block, 12 px, `--text-2`, **font-weight 400**: the
  «Operação» cell is bold, RO l.165, 282) inside the «Operação» cell after the paperclip; loading or error → no sub (never
  a spinner). Aria of the action unchanged. `subDaPonte`, open trade (board js l.2196–2199): the partials part from the
  counting partials; the stop part from **the current move only** = the newest live move not undone (`movAtual`: by
  `movedAt`, then `id`; told/`reconstructed` moves never count): stop = entry → «stop no breakeven», else «stop movido»;
  no such move → no stop part. A breakeven at 10:19 then 7.915,00 at 10:30 reads «… · stop movido»; that breakeven
  undone and nothing after → no stop part. Closed: «em {n} saídas» only with ≥ 2 counting exits.

### 5.12 Import lines and counts (E38–E39; N, on the final keys of c7d38cd: §10 P2–P3)

**The keys** (`contasDb.ts` comments at c7d38cd = `import_preview` / `import_commit` of 20261023000003). Only when the
file has partial exits (rows of one broker position: same symbol as written, side, open instant and open price, each with
an exit) does the preview gain `trades_new` (trades it creates), `grouped` (rows that are another row's trade's exits —
those of a new trade **and** those of a position linked whole to an app trade) and `attached` (rows that join a trade
already in the account: new lines of an imported trade, written lines of a registered one); the commit gains `trades`,
`grouped`, `attached`. A file of one row per position answers exactly as before (no new key: every use below falls back
to the as-built count). The preview counts every key as the commit does (P3): `new` = `inserted`, `completable` =
`completed`, `trades_new` = `trades`, `grouped` and `attached` by name, `linked` and `day_changes` a position once. A
position the app registered as several trades of the same entry (one per exit, before 3c) is linked row by row, also
across two exports, and adds to none of the three (P2). **`new` / `inserted` count lines** (a new trade's rows and lines
added to imported trades; never lines written on app trades), so from 3c they are no longer a trade count.

**The trade counts** (C1, `ImportSheet.tsx`, exported beside `toastDoLote`; with `toastDoLote`, the only code that reads
the new keys):

```ts
/** Trades the file creates: trades_new when the file has partial exits, else new (one row = one trade) */
export const operacoesDoArquivo = (p: Pick<ImportPreviewResult, 'new' | 'trades_new'>): number => p.trades_new ?? p.new
/** Trades the batch created: trades when the file had partial exits, else inserted */
export const operacoesDoLote = (c: Pick<ImportCommitResult, 'inserted' | 'trades'>): number => c.trades ?? c.inserted
```

| Where | As built | From 3c |
|---|---|---|
| Count row «{n} novas» (`passos.tsx`) | `preview.new` | unchanged: lines, beside «{rows_total} linhas» |
| Primary of the preview | `new > 0 ? importN(new) : completable + linked > 0 ? completeN(…) : FOLHA.done` | `ops = operacoesDoArquivo(p)`: `ops > 0 ? importN(ops) : completable + linked > 0 ? completeN(completable + linked) : attached > 0 ? juntarN(attached) : FOLHA.done` |
| «Nada novo» after the preview (`ImportSheet` «nothing») and `commit()`'s early return | `new`, `completable`, (`other_account`), `linked` all 0 | the same **and** `attached` 0 (rows attached to an app trade are in none of the others) |
| `linhaAntesDasRegras(…, novas)` | `preview.new` | `operacoesDoArquivo(preview)` (its before/after split stays by row) |
| The end, shown when | `inserted`, `completed` or `linked` > 0 | also `attached` > 0 |
| The end's first line (`linhaImportadas` / `FIM.inHistory`) | `inserted`, when > 0 | `operacoesDoLote(result)`, when > 0 |
| `toastDoLote` | `inserted > 0` → `FIM.toast(inserted)`, else linked / completed | `ops = operacoesDoLote(c)`: `ops > 0` → `FIM.toast(ops)`, else the parts linked, completed, `FIM.anexadas(attached)` |

**The new lines** (`contas/copy.ts`, `PASSO_D` / `FIM`, N, placed like the 3-3 `linked` lines, `p.hub-passo__txt`; after
the `linked` / `linkedDiffers` lines):

| Key | When | Text |
|---|---|---|
| `PASSO_D.agrupadas(n)` | preview `grouped > 0` | «1 saída parcial juntada à sua operação.» / «{n} saídas parciais juntadas às suas operações.» |
| `PASSO_D.anexadas(n)` | preview `attached > 0` | «1 saída a mais de uma operação que já estava.» / «{n} saídas a mais de operações que já estavam.» |
| `PASSO_D.juntarN(n)` | the primary when the file only adds rows to trades already there | «Juntar 1 saída» / «Juntar {n} saídas» |
| `FIM.agrupadas(n)` | commit `grouped > 0` | «1 saída parcial foi juntada à sua operação.» / «{n} saídas parciais foram juntadas às suas operações.» |
| `FIM.anexadas(n)` | commit `attached > 0` (end line, and the toast's part when no trade was created) | «1 saída a mais entrou numa operação que já estava.» / «{n} saídas a mais entraram em operações que já estavam.» |

Changed from the provisional contract: «{3} linhas novas: {2} operações, {1} saída parcial juntada à sua operação.»
(banco §9.6) keeps only its last clause, because on the final keys the three numbers do not add up in general
(`grouped` also counts the rows of a position linked whole to an app trade, which creates no trade and no new line;
`new` also counts lines added to imported trades); the trades go to the primary instead. Examples (invented values, the
shape of the owner's Top One export, decisoes.md): 17 rows, one position of 2 rows, nothing in the account → count row
«17 linhas · 17 novas · …», «1 saída parcial juntada à sua operação.», primary «Importar 16 operações»; end «16
operações …» + «1 saída parcial foi juntada à sua operação.», toast «16 operações em Top One #1.». The same file with
that position registered in the app as one trade → «… 1 já registrada por você …», «1 saída parcial juntada à sua
operação.», «Importar 15 operações». Registered as two trades (one per exit) → linked row by row, no new key: as Phase 3.
A later export with one more row of a position imported earlier → «1 saída a mais de uma operação que já estava.»,
primary «Juntar 1 saída», end «1 saída a mais entrou numa operação que já estava.» (toast the same). Shown to the owner in
the PR body as N strings (§12.7).

### 5.13 C1 copy (`copyParciais.ts`; markers per §0)

```text
ACOES        grupo «O que registrar agora?» B505 · saida «Saída» · parcial «Parcial» · stop «Mover stop» B js1754 ·
             registrarParcial «Registrar parcial» · registrarStop «Registrar stop» B js2184 ·
             saiCom(q, um) «Sai com o/os {q} em aberto.» B js1761 · noTotal(v) « · no total {v}» B js1554 ·
             saidaAntesParcial(h) «A saída não pode ser antes da última parcial ({h}).» B js1560 · daOperacao « Da operação toda.» B js1555
PARCIAL      ficam(q, um) «Fica/Ficam {q} em aberto.» B js1591 · emAberto(q) «Em aberto: {q}.» B · metade «Metade» B535 ·
             preco «Preço da parcial» · premio «Prêmio da parcial, US$ por ação» · precoEm(c) «Preço da parcial, {c}» B js1594 ·
             hora(suf) «Hora da parcial{suf}» B js1595 · previa(q,p,dif,v) «Parcial de {q} a {p}: {dif} · {v}» B js1096 ·
             informe «Resultado: informe o preço da parcial.» · informePremio «Resultado: informe o prêmio da parcial.» B js1088 ·
             confiraPasso(passo) «Resultado: confira o preço da parcial ({passo}).» · confira «Resultado: confira o preço da parcial.» B js1089 ·
             campoDigitado(M) «Resultado desta parcial, {M}» B js1115 · notaDigitado(moeda, swap) «Pelos preços não dá para saber o valor em {moeda}: digite o resultado desta parcial na sua plataforma, antes da comissão{swap}.» B js1116 ·
             precoVazio «Informe o preço da parcial.» · premioVazio «Informe o prêmio da parcial.» B js1580 ·
             demais(q) «Use menos que os {q} em aberto; para sair com tudo, use “Saída”.» B js1572 ·
             antes(h) «A parcial não pode ser antes da entrada ({h}).» · futura(h) «A parcial não pode ser depois de agora ({h}).» B js1581 ·
             registrada(q,p,h,ficam) «Parcial registrada: {q} a {p} às {h}. {ficam}» B js1610
STOP         paraOnde «Para onde?» B546 · breakeven(p) «Breakeven · {p}» · outro «Outro preço» B js1644 ·
             novo «Novo stop» · novoPremio «Novo stop do prêmio» · novoEm(c) «Novo stop, {c}» B js1646 ·
             agora «Preço agora» · agoraPremio «Prêmio agora, US$ por ação» · agoraEm(c) «Preço agora, {c}» B js1648 ·
             seAtingido(v) «Se o novo stop for atingido: {v} no total.» B js1637 ·
             avisoLimite(f, r) «Se o novo stop for atingido, o dia passa do limite: faltam {f} e o stop arrisca {r}.» B js1642 ·
             jaEsta(p) «O stop já está em {p}.» B js1626 · novoVazio «Informe o novo stop.» · zero «O stop precisa ser maior que zero.» B js1627 ·
             agoraVazio «Informe o preço de agora.» · agoraVazioPremio «Informe o prêmio de agora.» B js1630 ·
             ladoCompra «Numa compra, o stop fica abaixo do preço de agora.» · ladoVenda «Numa venda, o stop fica acima do preço de agora.» B js1634 ·
             agoraLonge «Confira o preço de agora.» N (c7d38cd: `bad_price` for pips whose points do not fit a stop move) ·
             movidoBe(p,h,fav) «Stop no breakeven ({p}) às {h}{fav}.» · movido(p,h,fav) «Stop movido para {p} às {h}{fav}.» B js1660 (fav «, com +8,00 pts a favor» or '')
SUGESTAO     texto(dif, n) «Esta parcial saiu com {dif}. Pela sua regra, com {n} o stop vai para o breakeven.» B js1609 · botao «Mover para o breakeven» B507
AGORA        rotulo «Agora» B473 · emAberto «Em aberto» · de(q) «de {q}» · stop «Stop» · semStop «sem stop» · daEntrada «· o da entrada» ·
             noBe(h) «· no breakeven, desde {h}» · garante(d,h) «· garante {d}, desde {h}» · arrisca(d,h) «· arrisca {d}, desde {h}» ·
             realizado «Realizado» · emParciais(n) «em 1 parcial» / «em {n} parciais» · seStop(v) «Se o stop for atingido: {v} no total.» B js1695–1702
TEMPO        rotulo «Linha do tempo» B480 · infoAria «Como ler: linha do tempo» · info «As parciais e a saída ficam na hora que você digitou; o app guarda à parte a hora em que você registrou. Os movimentos do stop ficam na hora do servidor, no toque em “Registrar stop”. O R é sempre medido pelo stop da entrada.» B481 ·
             entrada(q,p,stop) «Entrada · {q} a {p}[ · {stop}]» · stopPts(v) «stop {v} pts» · stopPips(v) «stop {v} pips» · stopPremio(v) «stop do prêmio {v}» · stopPreco(v) «stop {v}» ·
             parcial(...) «Parcial · {q} a {p} · {dif}{din}» · saida(...) «Saída · …» · nSaida(k, …) «{k}ª saída · …» (only with ≥ 2 counting exits, §5.11) ·
             din(v, est, typed) « · [≈ ]{v}[, digitado]» · registrada(h) «registrada às {h}» ·
             stopBe(p, fav) «Stop no breakeven · {p}[ · {fav}]» · stopMovido(p, fav) «Stop movido · {p}[ · {fav}]» ·
             beDepois(fav) «Stop no breakeven[ · {fav}] · registrado depois» · semHora «sem hora» · ontem(h) «ontem, {h}» · noDia(d,h) «{d}, {h}» B js1495–1512
DESFAZER_EV  link «Desfazer» · ariaParcial(h) «Desfazer a parcial das {h}» · ariaStop(h) «Desfazer o movimento do stop das {h}» B js1749 ·
             perguntaParcial(h, q, p, volta) «Desfazer a parcial das {h} ({q} a {p})? Ela sai do resultado e do limite do dia, e os {volta} voltam a ficar em aberto. O app guarda só que uma parcial foi desfeita, com a data e a hora.» ·
             perguntaStop(h, p, volta|null) «Desfazer o movimento do stop das {h} (para {p})? O stop volta a {volta}. / A operação volta a ficar sem stop. O app guarda só que um movimento foi desfeito, com a data e a hora.» B js1674–1675 ·
             parcialDesfeita(h, a) «Parcial das {h} desfeita às {a}.» · stopDesfeito(h, a) «Movimento do stop das {h} desfeito às {a}.» B js1681 ·
             limiteVolta(pior, lim) « Com a parcial desfeita, o limite do dia volta a {pior} de {lim}.» B js1685 ·
             tarde «Passaram 15 minutos: não dá mais para desfazer.» A (telas §4.7; only for a refused event undo: `undo_too_late` of «Desfazer entrada» keeps ERRO_REGISTRAR's text, §5.8) ·
             naoUltimo «Só o último registro pode ser desfeito.» N (telas) · (ate = ABERTA.desfazerAte, sim/manter = ABERTA.sim/manter, reused)
ABERTA_3C    notaPrimeiraParcial(h) «Marcas feitas a partir da sua primeira parcial ({h}) contam como depois do resultado.» B js1715 ·
             desfazerPergunta(h, op, parciais, movimentos) «Desfazer a entrada das {h} ({op})? A operação[, as parciais][, os movimentos do stop] e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.» B js1740
FECHADA_3C   emMedia(p) «{p} em média» B js1835 · comStopInicial(v) «com o stop inicial de {v} pts» · comStopInicialPips(v) «com o stop inicial de {v} pips» ·
             comStopInicialPremio(v) «com o stop inicial do prêmio em {v}» · comStopInicialEm(v) «com o stop inicial em {v}» B js1841 ·
             be(h, fav, n) «Breakeven às {h}[, {fav}] · sua regra: {n}.» · beDepois(fav, n) «Breakeven [{fav}, ]registrado depois · sua regra: {n}.» ·
             passou(h, fav, n) «Breakeven: o stop passou da entrada às {h}[, {fav}] · sua regra: {n}.» · movido(n) «Breakeven: o stop foi movido, sem chegar à entrada · sua regra: {n}.» ·
             naoMovido(n) «Breakeven: o stop não foi movido · sua regra: {n}.» B js1817–1821 ·
             linhaDepoisParcial(h) «Marcas feitas a partir das {h} (sua primeira parcial) contam como depois do resultado.» B js1802
ESCOLHA_3C   emAberto(q) « · {q} em aberto» B js2109
ERRO_3C      too_many_moves «Até 20 movimentos de stop por operação.» N (= domínio) · undo_too_late → DESFAZER_EV.tarde · not_newest → DESFAZER_EV.naoUltimo (read only for the 3c writes' refusals, §5.8)
```

Bridge (`diario/copy.ts`, `OPERACOES_DIA`): `parciais(n, v)` «1 parcial, {v}» / «{n} parciais, {v}» · `stopBe` «stop no
breakeven» · `stopMovido` «stop movido» · `emSaidas(n)` «em {n} saídas» (B js2198–2199). Reused as built: `RODAPE`, `ABERTA`
(`desfazerAte`, `sim`, `manter`), `FECHADA.r`, `RESULTADO`, `QTD`, `ERROS`, `ERROS_PRECOS`, `FOLHA_REG.fechadaFora`,
`ERRO_REGISTRAR`, `REGRA_BE` (C1-0).

### 5.14 C1 accessibility and layout checklist

Pill groups `role=group` + `aria-labelledby`; pills `aria-pressed`; busy = `aria-disabled` (focusable), never `disabled`;
44 px targets (pills, `.hub-reg-link`, «Desfazer», «Mover para o breakeven», chips `hub-reg-pill-q`); 16 px inputs on
phones (as built rule covers `.hub-reg .hub-entrada`); one live region per purpose (action status, each preview,
«Ficam …», the move status, `#a-lim-s`); errors `role=alert` under their field with `aria-invalid` + `aria-describedby`;
timeline `ol` with `time`; the undo link's aria names the event. ≤ 640 px: whole-screen sheet, sticky footer (as built);
«Agora» rows and timeline items wrap (time min-width 44 px, item `flex: 1 1 200px`); `campos2` one column ≤ 420 px; the
bridge's second line stays inside the «Operação» cell at ≤ 860 px. Contrast: only `--text` / `--text-2` / `--mint` /
`--red` / `--amber` on `--bg` / `--surface` / `--inset` / `--red-bg` / `--amber-bg` (the as-built pairs, ≥ 4,5:1 in both
themes; C1's CSS test lists every new pair and checks the ratio from the token values in `hub.css`).

---

## 6. Lane C2 · step 1, «Já fechada», the draft, Personalizar

### 6.1 Files

| Edits (exclusive) | Change |
|---|---|
| `app/lib/hub/registrarForm.ts` | draft v3; `modeloEntrada` knows the rows only for its own checks (with `r.saidas !== null` it skips the single exit's price/hour checks and leaves the rows, the sum, the result line, the payload's `exits`/`breakevenPriceThen` and the pill to `registrarSaidas.ts`; it may expose the `afterPayload` input it built as a new `ModeloEntrada` field); `ORDEM_PRECOS`, `CampoEntrada`, LIMPAR; **exports, unchanged in body, the private readers `registrarSaidas.ts` needs** (`lerPrecoDe`, `lerQuantidade`, `lerDinheiro`, `blocoResultado` and their types; additive). It imports none of `registrarRegra`, `registrarSaidas`, `registrarParciais` (layering below). **Frozen for C1 and for the §7.3 files** = every export a C1-owned or frozen file imports today, signatures and outputs unchanged (types may only gain fields: `Rascunho` for v3, `ModeloEntrada`): `ContaReg`, `contaReg`, `hora`, `horaRel`, `sufixo`, `sufixoCampo`, `diaDe`, `diaRelativo`, `mercadoNovo`, `preco`, `precoDe`, `diferencaTexto`, `centavos`, `instrumento`, `opTexto`, `ativoCurto`, `desdeTexto`, `linhaEscolha`, `pontosDoStop`, `distanciaDoStop`, `resumoAberta`, `podeDesfazer`, `SaidaCampos`, `ModeloSaida`, `ORDEM_SAIDA`, `modeloSaida`, `modeloResultado`, `CartaoFechada`, `periodo`, `cartaoFechada`, `textoAviso`, `textoDaRecusa`, `textoQuebras` (PassoAberta), `MarcaKind` (PassoAberta, PassoFechada, Marcas), `MARCA_KINDS`, `MARCA_VALORES` (Marcas), `valorMarca`, `quandoMarca`, `chipMarca`, `marcasAtuais`, `marcasDivididas`, `linhaDepois`, `anuncioMarca`, `indicador`, `avisoDesfeita`, `BlocoResultadoModelo`, `EstadoVsv` (VenceuSemValor), `ModeloAtivo` (BuscaAtivo), `ModeloOpcao` (BlocoOpcao), `TipoEua` (OQueOperou), `ModeloEntrada` (CotadaEm), `Rascunho`, `chaveRascunho`, `lerRascunho`, `rascunhoInicial`, `rascunhoMexido` (RegistrarSheet). A test in C2 (`hubRegistrarForm`) imports each of these names so a removal fails tsc |
| `app/components/hub/registrar/copy.ts` | additive sections `SAIDAS`, `BE_FECHADA` (§6.6); every existing key and value unchanged, `ERRO_REGISTRAR` untouched |
| `app/components/hub/registrar/PassoEntrada.tsx`, `CamposPrecos.tsx` | E1–E13 |
| `app/styles/hub-registrar.css` | append-only section «3c · Já fechada em várias saídas»; new classes prefixed `hub-rs-` |
| `app/components/hub/personalizar/SuasRegras.tsx` | render the group after the rules `ul`, before `ComoFicaHoje`, when the entity is «Padrão Futuros» or a futures account |
| `app/components/hub/personalizar/copy.ts` | `REGRAS_BE`, `NOTA.breakeven`, `NOTA.semBreakeven`, the `REGRAS.info` sentence |
| `app/lib/hub/comoFicaHoje.ts` | `Parte` + `'be'`; `partesVersao` adds `o.be` on futures (E49) |
| `app/styles/hub-personalizar.css` | `hub-pz-grupo-op`, `hub-pz-be-*` |

| Creates (exclusive) | |
|---|---|
| `app/lib/hub/registrarSaidas.ts` | pure, layer 3 (§6.1): `comSaidas` — rows, sum, row errors, result line, «Corrigir» on the total, the pill (effective state, status with `registrarRegra`), the payload's `exits`/`breakevenPriceThen`, the merged errors and focus order |
| `app/components/hub/registrar/SaidasJaFechada.tsx` | E2–E9 |
| `app/components/hub/registrar/MoviBreakeven.tsx` | E10–E11 |
| `app/components/hub/personalizar/RegraBreakeven.tsx` | E40–E48, E51 (+ its hook for the most-traded roots) |
| `app/lib/hub/personalizarBreakeven.ts` | pure: `RAIZES_BREAKEVEN = ['MES','MNQ','MGC','ES','NQ','GC','MCL','CL']`, line order, first switch-on roots, the version text |
| tests | §8.2 |

C2 starts from the base, which holds C1-0 (§4), and imports `registrarRegra`/`copyRegra`; it never edits them,
`BlocoResultado.tsx` (C1; renders it with the default ids) or anything in §7.3.

**Layering (no import cycle; each module imports only from the rows above it):**

| Layer | Modules |
|---|---|
| 0 | the domain, `numero`, `formato`, `registrarAtivos`, `registrar.ts`, the copy files (`copy.ts`, `copyRegra.ts`, `copyParciais.ts`) |
| 1 | `registrarForm.ts` (C2) |
| 2 | `registrarRegra.ts` (C1-0) → layer 1 |
| 3 | `registrarSaidas.ts` (C2) → layers 1–2 · `registrarParciais.ts` (C1) → layers 1–2 |
| 4 | components (`PassoEntrada`, `CamposPrecos`, `SaidasJaFechada`, `MoviBreakeven`, …) |

`PassoEntrada` composes «Já fechada»: `m0 = modeloEntrada(…)` (as built, rows-aware only as above) → the as-built gate read
gives `rulesDoGate` (§6.4) → `m = comSaidas(m0, r, { conta, forma, now, tentou, rules: rulesDoGate })` from
`registrarSaidas.ts` (rows, sum, row errors, result line, «Corrigir» on the total, the VSV note, the pill model and its
status, the payload's `exits` and `breakevenPriceThen`, the merged errors and focus targets) → `useAfterPreview(conta.id,
m.payloadFechada)` and «Registrar operação» read `m`. E1 and the pill status (which need `textoAFavor`/`regraDoAtivo`)
are therefore never computed inside `registrarForm.ts`.

### 6.2 E1 rule line (CamposPrecos)

`regraDoAtivo(rules, symbolOfDraft, { option: ehOpcao, direction: r.lado, entryPrice: valid & on-tick entry or null })`
with `rules` = the step's `rules` prop (rules_now's current version); `linhaRegra(forma, rule)` into `span#n-regra.hub-nota`
after `#n-risco`. Only `r.modo === 'aberta'`. Not announced (plain note). Stop and target are not needed for it.
`registrarForm.ts` must **not** import `registrarRegra.ts` (it imports `registrarForm`: a cycle; layering §6.1); E1 is
computed in `CamposPrecos.tsx`.

### 6.3 E2–E9 «Já fechada» in several exits (`SaidasJaFechada.tsx` + `registrarSaidas.ts` + `modeloEntrada`)

- **Draft v3** (`registrarForm.ts`): `Rascunho.v: 3`; new fields `saidas: SaidaRascunho[] | null` (null = one exit),
  `be: boolean`, `bePreco: string`; `SaidaRascunho = { id: number; qtd: string; preco: string; hora: string | null; res:
  string }`. `rascunhoInicial` sets `saidas: null, be: false, bePreco: ''`; `lerRascunho` reads v1/v2 (adding those
  fields at rest) and v3 (checks each row's shape; a bad row set → `saidas: null`); `LIMPAR` (instrument, quote, kind
  change) clears `saidas`, `be`, `bePreco`; changing «Aberta»/«Já fechada» keeps them; a successful registration clears
  the draft (as built). Stored in sessionStorage under the as-built key (telas §4.9). `be` keeps what the owner pressed
  even while the pill is not rendered (stop cleared or invalid); it counts only while rendered (§6.4), so a stop typed
  back brings the pill back pressed, as on the board (`f.be` survives, `beFormOn = temBeForm && f.be`).
- **«+ Outra saída»** (E2): rendered in «Já fechada», price markets, when rows exist or `canSplit(spec, entryQty)`. First
  press: rows 1 and 2 (row 1 takes the single exit's price and hour, an empty quantity; row 2 empty with the hour at
  now); focus `f-s1q`. Later: a new row at the end, focus its quantity. At 20 rows `aria-disabled="true"` +
  `aria-describedby="n-max"` + the note; a press does nothing.
- **Row** (E3): ids `f-s{id}q`, `f-s{id}p`, `f-s{id}h`, `f-s{id}r`, errors `e-s{id}{c}`, note `n-s{id}r`, label
  `l-s{id}`. «Remover» (`button.hub-reg-link`, aria per E3): with 2 rows → back to one exit (the remaining row's price and
  hour go to the single fields; focus `f-spreco`); else focus the next row's quantity (or the previous one's).
- **Sum** (E4) always while rows exist; **sum error** (E5) after a submit when readable quantities do not add up.
  DOM order (RO l.384–398): the rows → «+ Outra saída» with «Até 20 saídas por operação.» beside it → the sum
  (`margin-top: -6px`) → `#e-soma` → the stop field. With one exit: the single exit fields → «+ Outra saída» → the stop.
- **Typed instruments**: each row has «Resultado desta saída» (required); no single «Resultado, US$» field.
- **Result line** (E7) replaces the single exit's line (`m.resultado.linha`) while rows exist.
- **«Corrigir»** on the total (E8): opens «Resultado na sua plataforma, {M}» prefilled with the computed total; on send
  the last row's `pnl` = `lastExitPnl(typedTotal, earlier rows' computed pnl)`. «Custos» once; sent on the last row.
- **«Venceu sem valor»** (E9): with rows, it fills the **last** row's price «0» and hour «16:00»; note + « Vale para a
  última saída.».
- **Send**: rows sorted with `sortExitsByHour(items, entryAt, clock)` (ties keep row order); `afterPayload(market, {…,
  exits, breakevenPriceThen})` with `breakevenPriceThen` only while the pill is effectively on (§6.4); the dry run
  (`useAfterPreview`) gets the same payload.
- **Focus order** (E12): `dia, opTipo, strike, venc, lado, q, preco, hora, spreco, shora, s{id}q, s{id}p, s{id}h, s{id}r
  (row by row), soma (→ first row's quantity), stop, alvo, bePreco, res, custos`; `bePreco` takes part only while the pill
  is effectively on (never a focus target that is not rendered).
- **Banner after «Registrar operação»** (scenario 12; E35 as built): `avisoDoLimite` (frozen) decides «crossed» from the
  cached limit before when it has one; without it (rules_now not cached for that day) it compares `gateNow.limit.hitAt`
  with the `exitAt` it is given. With rows, `trade.exitTime` is the **last** exit (10:20) while the limit was hit at an
  earlier row (10:12), so PassoEntrada passes `exitAt` = the instant of this trade's counting exit equal to
  `gateNow.limit.hitAt` when there is one (`ans.state.exits`), else `trade.exitTime` (one exit: as built). The step-3
  banner then reads «Limite do dia atingido às 10:12: …» with or without the cached rules_now (§8.2 tests both).
- **Server refusals**: field `exits` → focus the first row's quantity + sheet alert; field `breakeven` → under `f-bePreco`.

### 6.4 E10–E11 «Movi o stop para o breakeven» (`MoviBreakeven.tsx`)

Rendered when «Já fechada», price market, and the stop field holds a valid value (a number > 0 with no stop error;
board `temBeForm`, RO js l.1261). Pill toggles `r.be` (on → focus `f-bePreco`). **Effective pill = rendered && `r.be`**
(board `beFormOn = temBeForm && f.be`, js l.1262): a pill that is not rendered counts as off for everything — no
«Preço quando moveu» field or status, no `bePreco` check (it can never block «Registrar operação» or take the focus), no
`bePreco` in the focus order, no `breakevenPriceThen` in the payload or the dry run (the board's told move exists only
with `beFormOn`, js l.1488) — while `r.be` itself stays in the draft. Field: `inputmode=decimal`, max 200 px, label by
kind. Status (`role=status`): `textoAFavor(forma, entry, priceThen, side, false)` + (the asset has a value in
`rulesDoGate`: « · Sua regra: com {textoN}.», else «.») — only while the price is valid and in favour. **`rulesDoGate`**
is PassoEntrada's as-built rules for the typed entry instant: `useGateAt`'s answer (gate_at at that instant) when the
entry is not at the current minute, else rules_now's; it is the version the trade will carry (`register_after` takes
`rule_version_at(account, entry_at)`, as step 3's `view.breakeven`), so the part shows on any «Dia» as the board draws
it (js l.1437, no day condition); while that answer is unknown the part is left out (status ends with «.»). Errors:
the price's format (E6 texts with «quando moveu»; on pips, c7d38cd, points in favour that do not fit → «Confira o preço
quando moveu.», `BE_FECHADA.longe`, before the tick text), then the side — `afterBreakeven`'s order, which a test
pins. The error shows as soon as something is typed, else after a submit.

### 6.5 E40–E51 Personalizar row (`RegraBreakeven.tsx`)

- **Where**: `SuasRegras` renders `<RegraBreakeven entidade draft salvo onEditar conta futuros />` after the rules `ul`
  when `market === 'futures'` («Padrão Futuros» or a futures account). Never on other markets (the database accepts them;
  the UI is Futuros only now).
- **Markup**: the as-built rule row (`li.hub-pz-regra` > `div.hub-pz-regra__nome` + `div.hub-pz-regra__val`, switch
  `.hub-pz-interruptor`, tags as `RegrasLinhas`' private `TagOrigem`) reproduced in `RegraBreakeven.tsx`; `RegrasLinhas.tsx`
  stays frozen.
- **Model**: `breakevenEfetivo(draft, e)` → `{ setting, propria }`; tags: «Padrão Futuros» none; account
  `propria ? SO_NESTA_CONTA : PADRAO_DE_FUTUROS` (`tag-propria` / `tag-padrao` as built); «não salvo» =
  `breakevenMudou(salvo, draft, e)` **or** a pending line exists **or** a field holds text `readBreakevenN` refuses (the
  board keeps both in the setting it compares: `beCanon` maps an empty or invalid value to `'x:…'`, P js l.1607, 2299), so
  «Adicionar ativo» alone (MNQ pending) shows «não salvo», as drawn. The page's save bar is the frozen provider's and
  follows the draft only: with nothing but a pending or invalid line it does not show (on the board it does, and saving
  then drops those lines, P js l.2484, so nothing is saved either way). Recorded as deviation §12.8 for the owner.
- **On / off parts** (P l.612–635): always the name, the tags, the switch and its state text, and «Voltar ao padrão» (E48,
  on an account with its own copy, **on or off**). Only while on: «Sem ativo» (E43); the lines block (E44: `#r-be-q`
  label, `ul`, the revert note) while lines exist; «Adicionar ativo» (E46: `span#r-be-add.sub-rot` + `div role=group
  aria-labelledby=r-be-add .hub-pills`) while a root is free; the row nota (E47). Turning the switch off keeps the
  assets and the pending lines, hidden, for when it is turned on again (board `setBe(sel, { on: !beOn, itens: beItens })`,
  P js l.2304).
- **Switch** (E42): `comBreakevenLigado(s, e, !on)`. First switch-on with no asset (E51): the setting turns on and the
  component holds **pending lines** (asset keys without a value) for the most-traded roots: `fetchRecentTrades(db, id,
  200)` of the entity's futures accounts (all active futures accounts for «Padrão Futuros»), counted by
  `tradeMatchKey('futures', symbol)` ∈ `RAIZES_BREAKEVEN`, top 3 by count (ties: most recent), none → `['MES']`. The read
  is lazy (`useQuery` key `['hub', uid, 'personalizar', 'raizes', ids]`, enabled only while the rule has no asset,
  staleTime 5 min); if it has not answered at the tap, use `['MES']`. Focus → the first line's value.
- **Lines** (E44): order = the saved assets in `RAIZES_BREAKEVEN` order, then assets added in this editing session in the
  order added, then pending lines. A valid value (`readBreakevenN(text).ok`) goes to the draft on change
  (`comBreakevenAtivo(s, e, key, n)`); any other text stays in the field only. **Live error** (board `temErro = (numBe(x.n)
  === null && x.n !== '') || (beMsg.key === chave && !beMsg.volta)`, P js l.2310–2313): while the field's text is
  **non-empty and refused** («0», «abc», «8,123456789»), the line shows «Digite pontos maiores que zero.» at once
  (`span#e-be-{KEY}` role=alert, the field `aria-invalid="true"` + `aria-describedby="e-be-{KEY}"`), on any line,
  including one with a saved value (MNQ 30 → «abc»); an empty field shows no error while typing. Any change clears the
  blur message. **Blur** on an empty or refused text (P js l.2317–2321): if the text the field had **when it took the
  focus** was valid, the field goes back to it (`formatDecimal`; the draft gets that value back) and the revert note
  replaces the error (role=status, visible, field not invalid: «O MNQ voltou para +30 pts; …»); else (a pending line, or
  a line focused while already invalid) the error stays, now also on an empty field. Every `readBreakevenN` refusal
  (`empty`, `invalid`, `not_positive`, `too_large`, `too_many_decimals`) uses that one board text (D12).
- **Remover**: `comBreakevenAtivo(s, e, key, null)` (or drops the pending line); focus (board `prox = resto[k] ||
  resto[k-1]`, P js l.2325–2327) → the next line's value, else the **previous** line's value (removing the last of three
  focuses the one above it), else the first free root's «Adicionar ativo» pill in table order (`be-add-{KEY}`; the
  removed root counts as free), else the switch (`be-sw`).
- **Adicionar ativo** (E46): pills of `RAIZES_BREAKEVEN` not listed; a press adds a pending line at the end and focuses
  its value.
- **Sem ativo** (E43): on with no asset in the setting and no pending line.
- **Voltar ao padrão** (E48): account with its own copy → `comBreakeven(s, e, null)`; focus → the switch.
- **Save**: the page's «Salvar alterações» (as built); pending lines are not saved (D12); nothing else changes in the
  provider. Versions follow `pendingVersions` (a rule off, or on without an asset, resolves to no key: no version).
- **Version note** (E49, `comoFicaHoje.partesVersao`): futures only: `rules.breakeven` → «breakeven com +{n} pts no {A},
  +{n} no {B} e +{n} no {C}» (assets in `RAIZES_BREAKEVEN` order, other keys after them alphabetically; numbers
  `formatDecimal`; `lista` joins), absent → «sem breakeven». The first version's note stays «{janela} · {limite}».
- **Ids and a11y**: switch `aria-labelledby="r-be"`, focus target id `be-sw`; lines label `r-be-q`; add label `r-be-add`
  (its group `aria-labelledby="r-be-add"`); values `be-{KEY}` with errors `e-be-{KEY}`; remove buttons `rm-be-{KEY}`; add
  pills `be-add-{KEY}`; the revert note in the DOM whenever the lines show (`sr-only` when empty).
  Field 76 px, `inputmode=decimal`, «+» and «pts» `aria-hidden`; every button 44 px; the row stacks to one column at
  narrow widths (as the other rules); `be-item` wraps and its error takes the full width.

### 6.6 C2 copy

`registrar/copy.ts`:

```text
SAIDAS       outra «+ Outra saída» B397 · maximo «Até 20 saídas por operação.» B397 · rotulo(k) «{k}ª saída» B js1374 ·
             remover «Remover» B387 · removerAria(k) «Remover a {k}ª saída» B js1374 ·
             soma(q, total) «Saídas: {q} de {total}.» B js1368 (q without unit, total with) · somaErro(s, t) «As saídas somam {s}; a entrada tem {t}.» B js1228 ·
             resultado(M) «Resultado desta saída, {M}» B js1357 · notaResultado(moeda, swap) «Pelos preços não dá para saber o valor em {moeda}: digite o resultado desta saída na sua plataforma, antes da comissão{swap}.» B js1358 ·
             linha(dif, v) «Resultado: {dif} em média · {v}» · digiteCada «digite o resultado de cada saída» B js1241 ·
             precos «Resultado: preencha os preços das saídas.» B js1232 · quantidades «Resultado: confira as quantidades das saídas.» B js1233 ·
             daOperacao « Da operação toda.» B js1254 · vsvUltima «Vale para a última saída.» B js1256
BE_FECHADA   pill «Movi o stop para o breakeven» · opcional «opcional» B413 ·
             preco «Preço quando moveu» · premio «Prêmio quando moveu, US$ por ação» · precoEm(c) «Preço quando moveu, {c}» B js1435 ·
             status(fav, regra|null) «{fav} · Sua regra: com {regra}.» / «{fav}.» B js1437 ·
             vazio «Informe o preço quando moveu.» · vazioPremio «Informe o prêmio quando moveu.» · lado «Para o breakeven, o preço precisava estar a favor.» B js1266 ·
             longe «Confira o preço quando moveu.» N (c7d38cd: `bad_price` field `breakeven` for pips whose points do not fit)
```

`personalizar/copy.ts`:

```text
REGRAS_BE    grupo «Durante a operação» P607 · grupoNota «Não muda o “Posso operar hoje?”: guia a operação aberta, e as Análises conferem depois.» P608 ·
             nome «Mover para o breakeven» P611 · desligada «Desligada: o Registrar não sugere e as Análises não conferem.» P js2299 (ligada = REGRAS.ligada) ·
             semAtivo «Sem ativo: esta regra não age.» P615 · quantos «Com quantos pontos a favor» P617 · mais «+» · pts «pts» ·
             valorAria(a) «Pontos a favor no {a}» · remover «Remover» · removerAria(a) «Remover o {a} desta regra» P js2311 ·
             erro «Digite pontos maiores que zero.» P js2311 · voltou(a, n) «O {a} voltou para +{n} pts; use pontos maiores que zero.» P js2332 ·
             adicionar «Adicionar ativo» P629 · nota «O Registrar mostra o preço do breakeven na entrada e sugere mover o stop quando uma parcial chegar lá; nunca bloqueia.» P632 ·
             voltarPadrao «Voltar ao padrão» · voltarAria(conta) «Voltar ao padrão de Futuros: {conta}» P634, js2337
NOTA         breakeven(itens) «breakeven {itens}» · semBreakeven «sem breakeven» P js1761
REGRAS.info  insert after «… a regra por estado é uma só para o mercado.»: « “Mover para o breakeven” (Futuros) não muda o “Posso operar hoje?”: o Registrar sugere, sem bloquear, e as Análises conferem depois.» P758
```

### 6.7 C2 accessibility and layout checklist

As §5.14 for the sheet. Rows: `.hub-reg-editor role=group aria-labelledby`, quantity max 120 px, price | hour
`hub-campos2` (one column ≤ 420 px); «+ Outra saída» and «Remover» 44 px `.hub-reg-link`; the sum is `role=status`, the
sum error `role=alert`; the pill `aria-pressed` 44 px. Personalizar: §6.5 ids; contrast as built tokens.

---

## 7. Ownership, frozen files, merge

### 7.1 C1 (exclusive): §5.1. ### 7.2 C2 (exclusive): §6.1.

### 7.3 Frozen (no lane edits; a needed change stops the lane and is reported: file, change, reason)

`app/lib/domain/**`; `app/lib/hub/contasDb.ts`, `regras.ts`, `rascunho.ts`, `regrasDb.ts`, `registrar.ts`,
`registrarAtivos.ts`, `registrarImagens.ts`, `relogio.ts`, `posso.ts`, `formato.ts`, `numero.ts`, `janelas.ts`,
`personalizarRegras.ts`; `app/hooks/useContas.ts`, `useRegras.ts`, `useAgora.ts`;
`app/components/hub/registrar/RegistrarSheet.tsx`, `abrir.ts`, `ui.tsx`, `Marcas.tsx`, `ImagensENota.tsx`,
`BuscaAtivo.tsx`, `BlocoOpcao.tsx`, `CotadaEm.tsx`, `OQueOperou.tsx`, `VenceuSemValor.tsx`;
`app/components/hub/importar/ImportSheetProvider.tsx`, `RegrasDaConta.tsx`, `flow.ts`;
`app/components/hub/personalizar/PersonalizarProvider.tsx`, `RegrasLinhas.tsx`, `BlocoVersao.tsx`, `ComoFicaHoje.tsx`,
`ui.tsx`; `app/components/hub/contas/ui.tsx`; `app/styles/hub.css` and every stylesheet not listed as a lane's;
`app/testing/**` that exists (new helper files are the creating lane's), including the base's
`app/testing/telasShots.ts` (the screenshot harness's page writer, 02e73b9, assigned to no lane: both import it, a needed
change is reported) and its `__tests__/testing/telasShots.test.tsx`; `supabase/**`; every test not listed in §8.

### 7.4 Order

1. Done: `fase-3c/telas` = `fase-3c/dominio` c7d38cd + C1-0 (b906512) + the harness's page writer (02e73b9). The
   orchestrator creates both lane worktrees from its tip.
2. Both lanes work in parallel (C1-0 is already in both); coherent commits; each finishes with jest/tsc/lint and the 8
   database-backed suites green (§8.3) and its screenshot set (§9).
3. **Merge C1 first** into `fase-3c/telas` (it renders C2's results in step 3 and owns C1-0's files). Then C2 rebases on
   it, re-runs everything (the 8 database-backed suites too), and merges. Then the `base` shots (§9: the states that need
   both lanes, scenarios 12 and 15 step 3) are taken on `fase-3c/telas`.
4. PR C into `feature/rebuild-lean` only after the owner pasted the 3c kit (sintese §9: the paste first, then the app),
   after PR #33 (banco) and PR #34 (domínio), on which it is stacked.

---

## 8. Tests per lane (Jest + Testing Library; mock `@/lib/hub/registrarDb` / `@/hooks/useRegistrar`; never the network)

Fixtures: the domain's recorded `app/testing/fixtures/parciais/*` (final at c7d38cd: recorded on the final SQL of
fa5fba7, Fri 23 Oct 2026 ET, invented data, random ids in `ids.json`) via `parciaisJson(name)` / `idsParciais()`
(`testing/parciais.ts`): `agora-sex-0900`, `entry-mes`, `partial-dry-mes`, `partial-mes`, `partial-mes-repetida` (the same
`client_key` again: `repeated`), `stop-mes-breakeven`, `stop-mes-desfeito`, `exit-dry-mes`, `exit-mes`, `after-dry-mgc`,
`after-mgc`, `partial-mnq-limite`, `partial-mnq-desfeita`, `partial-eurusd`, `stop-eurusd-ajuste`,
`stop-mes-entrada-ajuste` (11:31, «Outro preço» at the entry without «Preço agora»: `ajuste`, `favor` null, §10 P1),
`stop-mes-entrada-breakeven` (11:32, the same level with 7.934,25 after «Desfazer»: `breakeven`, +4,25), `dia-top-1018|1031|1045`,
`dia-apex-1053|1055` (`trades`, `exits` with `trade_id`, `agora`), and `rows-partial-mes|exit-mes|after-mgc|partial-mnq-desfeita|stop-eurusd-ajuste`
(what `readTradeViewRows` read right after that answer; `tradeViewOfRows` gives the same view). Parsed with the domain's
parsers; never hand-written shapes. A row set the recorder did not produce — the stop-move rows **with `trade_id`** that
`readTradeEventsRows` reads (`rows-*` stop moves have no `trade_id`; the `dia-*` exits do) — is composed in
`testing/parciaisTelas.ts` from recorded rows + `idsParciais()`. Older fixtures (`registrarTelas`, `registrarMercados`)
for the markets without a 3c recording, with partial/move answers built only through the domain's own functions
(`positionOf`, `validatePartial`).

**Recorded values vs the board's values** (every value in this table read again from the fixtures at c7d38cd: they
hold). Three recordings differ from the board's scenario values, so a test or a
screenshot that claims a board string uses a **composed** state, and a test on the recording expects the recording's own
numbers (never both from one fixture):

| Board state | Recording | Composed in `testing/parciaisTelas.ts` (domain functions only: `positionOf`, `validatePartial`, `validateMove`, `pnlFromPrices`) | Recorded-value test expects |
|---|---|---|---|
| 14, step 3 «Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.» | `exit-mes`: move 1 at 10:19 undone at 10:20, move 2 at 10:21 live | `exit-mes` with its stop moves = only move 1, not undone (`voided_at` null), position re-derived | «Breakeven às 10:21, …» (the undone move skipped: a useful test) |
| 14, the variant «passou da entrada às 10:30» | none | `exit-mes` with one live «ajuste» to 7.915,00 at 10:30, `price_now` 7.923,50 | — |
| 16: partial at 10:25, entry 10:18, «Até 10:40», «Limite do dia atingido às 10:25», «Parcial das 10:25 desfeita às 10:27» | `partial-mnq-limite` / `partial-mnq-desfeita` / `dia-apex-*`: entry 10:46, partial 10:53, until 11:08, undo 10:55 | every instant of those answers shifted by −28 min (the undo answer to 10:27), `gate_now.limit.hitAt` included | the same lines at 10:53 / 11:08 / 10:55 |
| 6: EUR/USD 0,50 lote, partial 0,25 a 1,08650 → «+13,0 pips · +US$ 32,50», «Ficam 0,25 lote em aberto.» | `partial-eurusd`: 1,00 lote, partial 0,50, +US$ 65 | `partial-eurusd` with trade quantity 0,50, the exit 0,25 and its pnl from `pnlFromPrices`; position re-derived | «+13,0 pips · +US$ 65,00», «Ficam 0,50 lote em aberto.» |
| 14 (partial 10:18, move 10:19, exit 10:31), 15 (`after-mgc`), 12 | match the board | — | the board's strings |
| «move then one exit»; «Já fechada» in one exit + the pill (E32 without exit rows) | none | a live MES trade with one breakeven move and one «Saída» (no `trade_exits` rows); `after-mgc` reduced to one exit of 2 ct with its told breakeven | — |
| P1 (not on the board): «Outro preço» exactly at the entry, without and then with «Preço agora» | `stop-mes-entrada-ajuste` / `stop-mes-entrada-breakeven` (Top One MES 2 ct a 7.930,00, stop 7.920,00, rule level 7.938,00) | — | E20 «Stop no breakeven (7.930,00) às 11:31 ET.» / «… às 11:32 ET, com +4,25 pts a favor.»; E16 «Stop no breakeven · 7.930,00» / «… · com +4,25 pts a favor»; E15 «· no breakeven, desde 11:31»; E37 «stop no breakeven» both; E17 «Desfazer o movimento do stop das 11:31 (para 7.930,00)? O stop volta a 7.920,00. …» |

**Who edits which existing suite.** An `it` belongs to the lane whose step it drives: step 1 («Aberta», «Já fechada») and
the draft → C2; step 2, step 3, the chooser, the bridge, the import and the sheet frame → C1. Each lane edits only its own
`it` blocks, in place, and only where the new DOM changes what they assert; **new** tests always go to the lane's new files
(never appended to a shared suite). C1 merges first; C2 rebases (separate hunks; a conflict is resolved keeping both).

| Existing suite | C1 | C2 |
|---|---|---|
| `RegistrarAberta`, `RegistrarFechada`, `RegistrarSheetProvider`, `OperacoesDoDia`, `ImportSheet` | all | — |
| `RegistrarSheet` | all but «the draft (D14, C6)» and «asks «Fechar sem salvar?»…» | those two |
| `RegistrarEntrada`, `RegistrarCss` | — | all |
| `RegistrarForex` | «steps 2 and 3 on FTMO» | «step 1 on FTMO», ««Já fechada» on FTMO» |
| `RegistrarCripto` | «steps 2 and 3 on Binance» | «step 1 on Binance», the ETH/BTC «Usar» describe |
| `RegistrarAcoes` | «step 2 of the open SPY call…» | «step 1 on IBKR», ««Já fechada» on IBKR», «an `options` account» |
| `RegistrarB3` | — | all three describes (step 1, PETR4, «Já fechada») |
| `RegistrarResultado` | «a server refusal on step 2»; in «lane B’s pieces…» the two «step 2 of the open SPY call at 16:05 ET…» `it`s | «a server refusal under its field («Já fechada»)», the rest of «lane B’s pieces…», «the B3 account…» |
| `RegistrarBusca` | «ZN’s exit (10:20 ET)…» | ««Buscar ativo» on Top One» |

### 8.1 C1

| File | Covers |
|---|---|
| `__tests__/lib/hubRegistrarRegra.test.ts` (on the base with C1-0, b906512; C1 may add cases) | C1-0 (§4) |
| `__tests__/lib/hubRegistrarParciais.test.ts` (new) | every model of §5.2 against the board's strings: scenario 14 (+8,00 pts · +US$ 40,00; «Ficam 2 ct em aberto.»; «Em aberto 2 ct de 3», «7.902,50 · o da entrada», «−US$ 60,00 no total»; status «Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.»; «+US$ 40,00 no total»; exit «· no total +US$ 175,00»; step 3 «7.912,50 → 7.924,17 em média · +11,67 pts · 10:12–10:31 ET», «+1,17 R com o stop inicial de 10 pts»; the 5 breakeven-line forms + none, «Breakeven às 10:19…» and «passou da entrada às 10:30, com +11,00 pts a favor» on the composed states of §8 and «às 10:21» on the recorded `exit-mes`), scenario 16 on the composed (−28 min) state (−25,00 pts · −US$ 100,00; «−US$ 180,00 no total»; no suggestion), scenarios 6–9 per §2.2 (EUR/USD composed 0,50/0,25: +13,0 pips · +US$ 32,50, and the recorded 1,00/0,50: +US$ 65,00; USD/JPY ≈ +US$ 21,85; EUR/GBP typed; SPY Call +0,55 no prêmio · +US$ 55,00; AAPL «Metade» 50; «Parcial de 0,1 BTC a 111.950: +450 por BTC · +US$ 45,00», «Ficam 0,15 BTC em aberto.»; WIN +150 pts · +R$ 60,00; PETR4 «Metade» 150 → lot note, 100 → no lot note); chips vs field vs «Metade» per unit; «Parcial» hidden at 1 ct / 0,01 lote; errors in order with their texts; the readers pinned to the as-built ones; timeline ordering, sub-line, «ontem, …», told breakeven without time, «Nª saída» only with ≥ 2 counting exits (a «Já fechada» trade in one exit + the pill → «Saída · 2 ct a …» right after «Stop no breakeven · … · registrado depois»), the single-exit item from the trade's columns on the composed «move then one exit» state; the bridge's stop part from the newest live move only (breakeven 10:19 then 7.915,00 10:30 → «stop movido»); undo texts incl. «A operação volta a ficar sem stop.»; geometric breakeven, incl. the recorded P1 pair `stop-mes-entrada-ajuste` / `-breakeven` (§8 table: the same words, «com +4,25 pts a favor» only with the price); `validateMove` agreement, incl. the pips «Preço agora» too far from the entry («Confira o preço de agora.»); the limit-back line conditions; chooser and bridge lines |
| `__tests__/lib/hubRegistrarEventos.test.ts` (new) | `tradeEventsOfRows` (dia fixtures + composed moves), `readTradeEventsRows` (tables, columns, `.in`, no query for `[]`), bad shapes → bad_answer |
| `__tests__/hooks/useRegistrar.test.tsx` (edit) | the three mutations (limitBefore, limitAfter re-read, setTradeView, invalidations, offline → `offline`, no retry), `useTradeEvents` (enabled, key), `REGISTRAR_INVALIDATIONS` table |
| `__tests__/components/hub/RegistrarParciais.test.tsx` (new) | scenario 14 end to end with fixtures: pills and footer labels; «Parcial» → status focused, suggestion, «Agora», timeline + «Desfazer» + «Até 10:33…»; suggestion button → «Mover stop» + Breakeven + «Preço agora» 7.920,50 + focus on «Registrar stop»; move → status; exit → step 3; keyboard (Tab order, Space on pills, Escape unchanged); the undo link disappears at `until`; confirmation focus («Sim, desfazer», «Manter» → link); the link and «Até …» absent while the confirmation is open and back after «Manter»; a pill press closes the confirmation, clears every form's `tentou` and the suggestion; repeated answers; `not_open` → step 3 «já foi fechada em outro lugar»; offline/network keep fields and `client_key`; Ebinex step 2 unchanged; 1-contract trade without «Parcial» |
| `__tests__/components/hub/RegistrarMoverStop.test.tsx` (new) | defaults (Breakeven vs Outro preço when already at the entry), required/optional «Preço agora» («Outro preço» exactly at the entry sends `{kind: 'ajuste', stop_price}` with no `price_now` and no error, then shows `stop-mes-entrada-ajuste`'s answer as «Stop no breakeven (7.930,00) às 11:31 ET.»), side errors under the right field, same stop, tick, «Confira o preço de agora.» on EUR/USD, server refusals mapping (§3.3), payloads, the limit warning region (`aria-describedby`) |
| `__tests__/components/hub/RegistrarLimiteParcial.test.tsx` (new) | scenario 16 (composed −28 min state for the board's «às 10:25» / «Até 10:40» / «desfeita às 10:27»; the recorded one for its own times): red banner after `partial-mnq-limite`; 80 % amber with `pref80`; yesterday's trade → no banner; undo with `partial-mnq-desfeita` → «… volta a −US$ 300 de US$ 400.» |
| `__tests__/components/hub/RegistrarFechada.test.tsx` (edit) | `exit-mes` and `after-mgc` step 3 (E29–E34), the step-3 DOM order (card → timeline → breakeven line → banner → plan line); the composed one-exit states (E32 without exit rows) |
| `__tests__/components/hub/RegistrarAberta.test.tsx`, `RegistrarSheet.test.tsx` (edit; C1's `it`s per §8) | as-built behaviour unchanged on trades without 3c data; «Desfazer entrada» refused late keeps «Passaram 15 minutos: a entrada não pode mais ser desfeita.» while an event undo refused late reads «Passaram 15 minutos: não dá mais para desfazer.» (§5.8); chooser «2 ct em aberto» |
| C1's `it`s of the existing suites (§8 table: the step-2/3 blocks of `RegistrarForex`, `RegistrarCripto`, `RegistrarAcoes`, `RegistrarResultado`, `RegistrarBusca`; `RegistrarSheetProvider`) (edit) | unchanged expectations still pass on trades without partials or moves (edit only where the new pills, the always-present action status, «Agora» or the timeline change what they count or focus) |
| `__tests__/components/hub/OperacoesDoDia.test.tsx` (edit) | second line open/closed, absent while events load or fail, aria unchanged |
| `__tests__/components/hub/ImportSheet.test.tsx` (edit) | §5.12 on the final keys: `makePreview({ new: 17, rows_total: 17, trades_new: 16, grouped: 1 })` → «1 saída parcial juntada à sua operação.» and «Importar 16 operações», commit `{ inserted: 17, trades: 16, grouped: 1 }` → «16 operações …», «1 saída parcial foi juntada à sua operação.», toast «16 operações em …»; a position linked whole (`linked: 1, grouped: 1, new: 15, trades_new: 15`); attached only to an app trade (`new: 0, attached: 2`) → not «Nada novo», «Juntar 2 saídas», end and toast «2 saídas a mais entraram em operações que já estavam.»; attached to an imported trade (`new: 2, trades_new: 0, attached: 2`) → «Juntar 2 saídas», no «0 operações»; a file without the keys → every as-built line, label and toast unchanged; `operacoesDoArquivo` / `operacoesDoLote` |
| `__tests__/components/hub/RegistrarParciaisCss.test.tsx` (new) | `hub-registrar-parciais.css`: every rule scoped `.hub`; 44 px targets; timeline wrap rules; the contrast table of new pairs, both themes |
| copy check (in `RegistrarParciais.test.tsx`) | no prototype label («Preencher exemplo», «Avançar o relógio», «Recomeçar», «Cenário do protótipo», «só no protótipo») in `copyParciais.ts` / `copyRegra.ts` |

### 8.2 C2

| File | Covers |
|---|---|
| `__tests__/lib/hubRegistrarSaidas.test.ts` (new) | rows add/remove/back to one, hidden when not divisible, 20 cap, sum per unit («Saídas: 0,50 de 1,00 lote.» …), sum error, row errors verbatim, result line variants, typed rows, «Corrigir» total → last row `pnl`, «Custos» on the last row, VSV on the last row + note, sort by hour (ties), payload = `afterPayload` with `exits` (by hour) and `breakeven: { price_then: '4409.3' }` for scenario 15 and its dry run answer matching `after-dry-mgc`, the «Preço quando moveu» checks in `afterBreakeven`'s order (incl. «Confira o preço quando moveu.» on EUR/USD), the pill model (shown only with a valid stop; not rendered = off: no `bePreco` error, focus target or `breakevenPriceThen` with the stop cleared and `be` still true, and the pill back pressed when the stop is typed again; status with and without the rule, the rule from `rulesDoGate` on «Hoje», «Ontem» and another day, no rule part while that answer is unknown; errors); the layering (registrarForm imports none of registrarRegra/registrarSaidas/registrarParciais: a test reads its import lines) |
| `__tests__/lib/hubRegistrarForm.test.ts` (edit) | draft v3 read/write (v1, v2, v3, bad rows), LIMPAR, `rascunhoMexido`, `ORDEM_PRECOS` with rows; every 3-3/3-4 expectation unchanged |
| `__tests__/lib/hubComoFicaHoje.test.ts` (edit) | `partesVersao` «breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC», table order, «sem breakeven», no version when off / on without asset (`pendingVersions`) |
| `__tests__/lib/hubPersonalizarBreakeven.test.ts` (new) | line order, first switch-on roots (counts, ties, none → MES), `RAIZES_BREAKEVEN` keys resolve with unit `pts` (`resolveBreakeven`) |
| `__tests__/components/hub/RegistrarJaFechadaSaidas.test.tsx` (new) | scenario 15 with `after-dry-mgc`/`after-mgc`: rows, pill, status, result line, «Registrar operação» payload, step change; the error state (2ª quantity empty); focus moves («+ Outra saída», «Remover», submit errors); draft restored from sessionStorage after a remount; DOM order rows → «+ Outra saída» → sum → `#e-soma`; scenario 7 opening in «Já fechada» (option rows, «Venceu sem valor» on the last row with «Vale para a última saída.», «Prêmio quando moveu, US$ por ação»); scenario 12 two exits payload and the banner «Limite do dia atingido às 10:12: …» from the answer's `gate_now`, **both with a seeded rules_now cache and with none** (`exitAt` = the counting exit equal to `hitAt`, §6.3) |
| `__tests__/components/hub/RegistrarRegraEntrada.test.tsx` (new) | E1 with `agora-sex-0900` rules (with/without side and price, off-tick price, other asset, «Já fechada», Ebinex) |
| `__tests__/components/hub/PersonalizarBreakeven.test.tsx` (new) | group only on «Padrão Futuros» and futures accounts; switch states; first switch-on lines + focus (read answered / not answered); add/remove focus (remove the last of three → the line above; the only line → the first free «Adicionar ativo» pill); the live error while invalid text is typed (on a pending line and on MNQ 30 → «abc»: `role=alert`, `aria-invalid`, `aria-describedby=e-be-MNQ`), none while empty, then blur → revert to the value at focus + note, or the error kept; tags; «não salvo» from the draft, a pending line or invalid text (and the save bar only from the draft, §12.8); off shows only the name, tags, switch, state and «Voltar ao padrão»; `r-be-add` label and group; «Voltar ao padrão»; «Sem ativo»; save payload `defaults.futures.rules.breakeven` / `accounts[id].rules.breakeven`; «Ao salvar: …»; the ⓘ sentence; CSS of `hub-personalizar.css` new rules scoped `.hub` and 44 px |
| C2's `it`s of the existing suites (§8 table: `RegistrarEntrada`, `RegistrarCss`, `RegistrarB3`, the step-1 / «Já fechada» blocks of `RegistrarForex`, `RegistrarCripto`, `RegistrarAcoes`, `RegistrarResultado`, `RegistrarBusca`, the draft `it`s of `RegistrarSheet`) | unchanged expectations still pass (edit only where the new DOM adds an element they count) |

### 8.3 Before finishing (each lane)

`npx jest --ci` (all suites), then **`scratchpad/fase3c/telas/pg/pg_run.sh <worktree> <port>`** for the **8**
database-backed suites (skipped by plain Jest; the runner takes every `__tests__/lib/*.pg.test.ts`): `hubMercados`,
`hubParciais`, `hubRegistrar`, `hubRegistrarFluxos`, `hubRegistrarMercados`, `hubRegistrarTelas`, `hubRegras`,
`hubRegrasBreakeven`. It builds one throwaway PG15 cluster (`/opt/homebrew/opt/postgresql@15/bin`, the clock shim) on the
given port, a template database with the stub, every migration and the legacy seed, one fresh database per suite, and
stops and deletes the cluster at the end; it refuses a port outside `BH_PG_PORTS` (default `55460 55461`, the base's):
each lane runs it with the ports the orchestrator gave it (`BH_PG_PORTS="<p1> <p2>" pg_run.sh <worktree> <p1>`). The older
`scratchpad/fase3c/pg_jest.sh` takes random ports and only 6 suites: not used. On the base at 02e73b9 all 8 pass (4 + 12
+ 36 + 8 + 15 + 9 + 24 (2 skipped) + 8 tests). Both lanes touch code they read: five import
`@/lib/hub/registrarDb` (C1 adds to it) and `hubRegras.pg` imports `partesVersao` from `comoFicaHoje.ts` (C2 adds the
`'be'` part), so each lane runs them before finishing (and C2 again after its rebase on C1). Then `npx tsc --noEmit`,
`npx next lint`, the copy check, `git status` clean except the lane's files, the screenshot set (§9) listed in the report.

---

## 9. Screenshot plan

**Goal:** every board scenario state of §2.2 rebuilt in the app with invented data, at **375, 768 and 1280** px, **claro and
escuro**, to put next to the board.

**Method: the one harness both lanes use, `scratchpad/fase3c/telas/shots.md`** (read it before writing a spec). No server,
no network, nothing staged:
1. A lane writes **visual specs** in `scratchpad/fase3c/telas/visual/<lane>/*.visual.test.tsx` (`c1`, `c2`; `base` for the
   states that need both lanes, run on `fase-3c/telas` after the merges). Each renders the real components with the
   lane's mocks and the §8 fixtures — **the composed states of §8 wherever a recording differs from the board**
   (scenario 14 step 3 and its variant, 16, 6), so each shot shows the board's values — drives them to the state with
   Testing Library (clicks, typing, the server clock through the mocked answers / `recordServerNow`), and calls
   `fotografar('<cenario>-<estado>', { moldura, foco?, quadro })` from **`app/testing/telasShots.ts`** (on the base,
   02e73b9; assigned to no lane, §7.3).
2. `scratchpad/fase3c/telas/shots/tools/run.sh <worktree> <lane>` copies the lane's specs into `app/__tests__/__visual__/`,
   builds `shots.css` from **that worktree's** stylesheets (Tailwind over `globals.css`, then `hub.css` and every
   `hub-*.css` in `app/(hub)/layout.tsx`'s import order, then any `hub-*.css` not imported yet; the fonts from
   `app/public/fonts`, inlined), runs Jest with `BH_SHOTS_DIR`, deletes `__visual__`, and shoots each written page in
   headless Chrome (pipe, no port; every http(s) request blocked; profile under the scratchpad, deleted) at each width,
   at least one screen tall and as tall as the page.
3. Output, replaced whole on each full run: **`scratchpad/fase3c/telas/shots/<lane>/<cenario>-<estado>-<largura>-<tema>.png`**
   (`<scenario>` in the names below = `<cenario>-<estado>`, e.g. `14-parcial-registrada-375-escuro.png`; compressed PNG)
   and `index.html` (one row per state with its six shots and the board reference the spec gave in `quadro`: the board
   scenario and the clicks that reproduce the same state in the approved canvas `Q3CThVmn9Mms7Bdi94MBg8`, version
   `1792580549-b8ef`; the board needs the canvas runtime, so the reviewer views the board side there, at the same widths).
4. A sheet is shot **unrolled** (`moldura: 'folha'`, the default: the whole step in one image, the footer at its end;
   on screen it scrolls inside the sheet); the bridge and Personalizar inside the hub's page column (`'pagina'`). The
   focus ring a written page cannot have is drawn on one element with `foco` (shots.md §4).

**States** (each × 3 widths × 2 themes; the state names are the lane's, `<cenario>-<estado>`, lower case):

| Lane | Scenario | States |
|---|---|---|
| C1 | 14 | step 2 at 10:18 (summary rule line, pills); «Parcial» filled (preview); after the partial (status, suggestion, «Agora», timeline + «Desfazer»); «Mover stop» Breakeven filled (status, «Se o novo stop…»); after the move («Agora» «no breakeven», undo on the move); undo confirmation open; «Saída» at 10:31 («Sai com os 2 ct…», «· no total»); step 3; step 3 variant «passou da entrada»; the bridge with both rows (MNQ «em 2 saídas», MES «1 parcial, +US$ 40,00 · stop no breakeven», then «… · stop movido» after the 10:30 move); MNQ step 3; step 3 of a trade moved then closed in one «Saída» (composed) |
| C1 | 16 | partial preview; after it (red banner, «Agora», undo); after the undo (limit back); «Mover stop» Outro preço with the limit warning; step 3 «sem chegar à entrada» |
| C1 | 6 / 7 / 8 / 9 | «Parcial» and «Mover stop» of EUR/USD (with «Metade»), USD/JPY (≈), EUR/GBP (typed), SPY Call (premium labels), AAPL («Metade»), BTC/USDT, WIN, PETR4 («Metade» 150 with the lot note); the forms' error states once per kind |
| C1 | 10 / 11 | chooser with «… em aberto»; bridge second lines at 768 (≤ 860 layout) and 1280 |
| C1 | 1 / 3 / 5 | regression: step 2 with pills (1), without «Parcial» (3), Ebinex unchanged (5) |
| C1 | P1 (not drawn) | «Mover stop» «Outro preço» at the entry with «Preço agora» empty (no error, «· opcional»), then after it (`stop-mes-entrada-ajuste`: «Stop no breakeven (7.930,00) às 11:31 ET.», «Agora» «· no breakeven, desde 11:31», the timeline item without «com …») |
| C1 | import | preview of the 17-row file with one 2-row position (§5.12: «1 saída parcial juntada à sua operação.», «Importar 16 operações»); a later export that only attaches («1 saída a mais de uma operação que já estava.», «Juntar 1 saída»); the end of the first |
| C2 | 15 | «Já fechada» with two rows, pill on, status, result line; the error state; one-exit form with «+ Outra saída»; 20 rows (cap note) once at 375 |
| C2 | 12 | «Já fechada» ES in two exits |
| C2 | 6 / 7 / 8 | rows in lots (sum «0,50 de 1,00 lote»), typed rows (EUR/GBP), scenario 7's opening «Já fechada» (option rows, «Venceu sem valor» on the last row, the pill with «Prêmio quando moveu, US$ por ação»), crypto quote labels (sum «0,1 de 0,25 BTC») |
| C2 | 14 / 1 | step 1 «Aberta» with «Sua regra: breakeven com +8 pts, em 7.920,50.» and without side/price |
| C2 | Personalizar | «Padrão Futuros» on with three assets and «não salvo» + «Ao salvar»; off; on with no asset; Top One «padrão de Futuros»; Apex B «só nesta conta» + «Voltar ao padrão»; the revert note; the error line; a Forex account (no group) |
| base (C2's specs, after both merges) | 15 / 12 | step 3 of a «Já fechada» trade in one exit with the pill («Saída · …», no «1ª»); step 3 of scenario 15 (two exits, «Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.»); scenario 12 step 3 with «Limite do dia atingido às 10:12» |

Focus: keyboard order and focus moves are proven by the Testing Library suites; two extra shots per lane draw the focus
ring (`foco`) on «Sim, desfazer» and on «Registrar stop» after the suggestion (C1), and on the first row's quantity after
«+ Outra saída» and on a Personalizar line's value after «Adicionar ativo» (C2).

Each lane's report lists its set (`ls shots/<lane>`, the PNG count and size) and keeps only the final set (a partial run
with a `-t` pattern writes to `shots/_parcial/<lane>/`, deleted before reporting).

---

## 10. Resolved — the once provisional items, as the final API answers them (c7d38cd)

The banco and domínio are final: `fase-3c/banco` fa5fba7 (PR #33) and `fase-3c/dominio` c7d38cd (PR #34, stacked on
banco), published, not merged. Nothing below is provisional any more; each row says what the code does and what of this
contract it touched.

| # | Item | Final answer (read in the code at c7d38cd) | What changed here |
|---|---|---|---|
| P1 | «Mover stop» at the entry price | `validateMove` (= `move_stop`, 20261023000003; recorded in `stop-mes-entrada-ajuste` / `-breakeven`): **«Outro preço» exactly at the entry without «Preço agora» is stored as an `ajuste` with no points** (`favor` null, `stop_kind` `ajuste`); with «Preço agora» at the entry it is stored as a **`breakeven`** with its points (trade_stop_moves' check: a breakeven always carries its price); **«Breakeven» always requires «Preço agora»** (`bad_price`, field `price_now`). Option (c) of the old table, plus the price that makes it (a). | Nothing on screen: every word is geometric (§3.4.1, as the board's `naEntrada(novoN)`, RO js l.1657), so both stored kinds read «Stop no breakeven …», without «com …» when there is no price (E16, E20, E33 made explicit; E15 through `stopNowStatus`, E37). The payload stays as typed (§3.2, §5.6); no local check requires «Preço agora» with «Outro preço» (D4 stands, «· opcional» stays). Tests and fixtures: §8 (the P1 row), §8.1 (`hubRegistrarParciais`, `RegistrarMoverStop`). No deviation. |
| P2 | Top One positions in several rows | `import_stage` / `assignImportLinks` (01eb0c1, c7d38cd): rows of one broker position (same symbol as written, side, open instant and open price, each with an exit not before the entry) become **one trade with one file exit per row**, linked whole to an app trade (the app's hours, the file's money) or attached to the trade an earlier file put its first rows in. **A position whose rows match separate app trades of the same entry** (the app registered it as one trade per exit, before 3c) **links row by row, also across two exports**: every row counts once, as Phase 3. | §5.12 rewritten on these semantics; E32's «Nª saída» for file exits (§12.4) and E37's «em N saídas» stand (file exits count, `exitCounts`: a trade's file rows when it has any). No screen infers grouping: only the answers' keys are read. |
| P3 | The import's counts | `import_preview` counts every key as `import_commit` does, key by key (`contasDb.ts` comments): `new` = `inserted` (lines: a new trade's rows and lines added to imported trades; never lines written on app trades), `completable` = `completed`, `trades_new` = `trades`, `grouped`, `attached`; `linked` and `day_changes` count a position once; `linked_differs` also counts the exits path. The three new keys exist only when the file has partial exits. | §5.12: the trade counts read `trades_new` / `trades` (`operacoesDoArquivo` / `operacoesDoLote`), because `new` / `inserted` now count lines (the primary «Importar {n} operações», the end's first line and the toast would otherwise say 17 for 16 trades); «Nada novo», `commit()`'s early return and the end also count `attached`; the provisional «{3} linhas novas: {2} operações, {1} saída parcial juntada…» keeps only its last clause, because `grouped` also counts the rows of a position linked whole to an app trade; new N keys `PASSO_D.juntarN`, and `toastDoLote`'s attached part is `FIM.anexadas`. §8.1's `ImportSheet` row. N strings for the PR body (§12.7, §12.9). |
| P4 | Fixtures and shared cases | Final at c7d38cd: `testing/fixtures/parciais/*` re-recorded on the final SQL (new random ids), plus `partial-mes-repetida`, `stop-mes-entrada-ajuste`, `stop-mes-entrada-breakeven` and the `rows-*` table reads; `__tests__/domain/cases3c.json` regenerated (additions only). `ERRO_REGISTRAR`'s 3c entries and `REGISTRAR_FIELDS` (`exits`, `breakeven`, `price_now`, `kind`, `id`) as listed in `registrarDb.ts` / `copy.ts`. c7d38cd also added refusals the screens must map: `bad_pnl` / `bad_costs` (field `exits`) for sums over the exits that do not fit the trade, `bad_pnl` (`pnl`) for the total after partials, and `bad_price` on `price_now` / `breakeven` for pips whose points in favour do not fit. | §8's fixture list and the recorded-vs-board table (every value read again: it holds); §3.3 rows for the new refusals; N texts «Confira o preço de agora.» (`STOP.agoraLonge`, E25) and «Confira o preço quando moveu.» (`BE_FECHADA.longe`, E11) with their local checks in the domain's order (§5.6, §6.4) and tests (§8.1, §8.2). |
| P5 | The domínio's exports | Committed and final: every name §5.2 lists is exported by `@/lib/domain/registro` at c7d38cd (`canSplit`, `halfOpen`, `partialQuantityError`, `validatePartial`, `validateMove`, `stopNowStatus`, `ifStopped`, `riskAtStop`, `breakevenSuggestion`, `averageExit`, `rOfExits`, `countingExits`, `firstExitCut`, `lastEvent`, `plainExit`, `pnlFromPrices`, `exitInstant`, `riskBeyondLimit`, `dayLimitOf`, `partialPayload`, `movePayload`, `undoEventPayload`, `afterPayload`, `sortExitsByHour`, `lastExitPnl`, `afterBreakeven`, `breakevenOf`, `favorOf`), `registrarDb` has `EXIT_COLUMNS` / `MOVE_COLUMNS` and the private `parseExitRow` / `parseStopMove` §5.10 uses, and `TradeBreakeven.level` is rounded to 8 decimals. | Nothing: a lane that misses an export still reports it, never re-implements it. |

---

## 11. What stays out (telas §12, sintese §2)

Adding to a position / average entry price; partials or stop moves on Ebinex/binárias; moving the **target**; trailing
stops in «Já fechada» (only the breakeven pill); undoing a final exit; the breakeven rule's row outside Futuros (the
database accepts every price market; the UI is Futuros only now); free-code assets in the rule (ZN, NG…: only the eight
table roots); a tick check on the rule's N; market data («Preço agora» stays typed); the Diário's trade details (Phase 4);
the Análises check (no ponto / cedo / tarde, adherence: Phases 6–7) and any verdict colour or mark in the Registrar; the
«Chegou a +N?» question; a stored «Não» in «Já fechada»; `limit_room` in the move answer (the sheet computes the
warning); merging the owner's existing two-row Top One pair; batch counts for grouped rows in «Importações»; every
prototype control of the boards.

---

## 12. Decisions this contract takes (for the orchestrator; 8 and 10 differ from what the board draws or would do, and go to the owner)

1. One cross-lane interface (C1-0), committed on the base before the lanes branched (b906512), so both start from it
   and nobody cherry-picks; C1 owns its files from there; everything else exclusive by file.
2. C2 owns `registrarForm.ts` (step 1 needs its internals); C1 builds its step 2/3 models outside it on the frozen exports
   and writes its own small readers (pinned to the as-built ones by a test).
3. «Já fechada» «· Sua regra: …» in the pill's status reads the rules in force at the typed entry instant (PassoEntrada's
   as-built `rulesDoGate`: gate_at's answer, or rules_now at the current minute), the version the trade will carry, on any
   «Dia», as the board draws it; left out only while that answer is unknown (§6.4).
4. Exit labels «Nª saída» also for file exits on app trades (not drawn; N).
5. Personalizar: pending lines (no value yet) live in the component, never in the draft (the draft's `by` holds decimal
   text and `regras.ts`/`rascunho.ts`/the provider are frozen); «não salvo» counts them and invalid field text as the
   board does (§6.5); line order after a reload follows the futures table.
6. The bridge and chooser read exits and moves with one new query (`useTradeEvents`) instead of changing
   `fetchDayTrades`/`fetchOpenTrades`.
7. Import strings (E38–E39) are N, on the final keys (§5.12, §10 P2–P3); they go in the PR body for the owner, with the
   examples of §5.12.
8. **Deviation for the owner (PR body):** on the board, «Adicionar ativo» alone (a pending line with no value) or invalid
   text in a field also makes the page «alterado» (the save bar with «Alterações não salvas», P js l.1690, 2506, 2520),
   and «Salvar» then drops those lines (P js l.2484), saving nothing for them. Here the save bar follows the draft only
   (the provider, `rascunho.ts` and `regras.ts` are frozen, and a pending value cannot enter the draft), so in that state
   the row shows «não salvo» but the page's bar does not appear. Nothing saved differs. If the owner wants the bar, it
   needs a provider change in a later PR.
9. **The import's trade counts follow the final keys** (§5.12, §10 P3; not a 3c board, PR body): for a file with
   partial exits, «Importar {n} operações», the end's first line and the toast count trades (`trades_new` / `trades`),
   never lines (`new` / `inserted` count lines from 3c: 17 rows of 16 trades would read «Importar 17 operações»); a file
   that only adds rows to trades already in the account gets the primary «Juntar {n} saídas» (N) and is never «Nada novo».
   Files of one row per trade (every file before 3c) read exactly as built.
10. **Deviation for the owner (PR body; a state the board does not draw):** «Preço agora» («Mover stop») and «Preço quando
    moveu» («Já fechada») on a **pips** instrument are refused when their points in favour do not fit a stop move (10^10
    pips or more from the entry: a typo such as 2.000.000 on EUR/USD), with «Confira o preço de agora.» / «Confira o preço
    quando moveu.» (N) under the field, because the final database refuses them (`bad_price`, c7d38cd). The board's
    prototype would accept such a price and show its points. Every realistic price behaves as on the board.
11. The screenshot harness's page writer (`app/testing/telasShots.ts` + its test, 02e73b9) is on the base and assigned to
    no lane (§7.3); its script, the specs and the shots live in the scratchpad (`telas/shots.md`), never in the repository.
12. Screenshots show a sheet **unrolled** (the whole step in one image, the sticky footer at its end) and a page without
    the header (§9.4, shots.md §4): the PR body says so beside the shots, so the owner compares the content and layout
    with the board, not the sheet's scrolling.
