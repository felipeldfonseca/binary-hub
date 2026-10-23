# Phase 4 · Diário boards: what they draw, what is stale after Phases 1–3c, and the board revision

Read-only survey of the two approved Diário boards, checked against what Phases 0–3c and 3b built. Sources: the boards
`.claude/backup-fase4/quadros/DiarioHojeEnxuto.dc.html` and `DiarioDezEnxuto.dc.html` (markup, script and the embedded data
object, read in full); the plan (`backup-plano/v31/plano.md` row 4) and appendix (`apendice.md` §A, §B «Fase 4: M6b Diário»,
§D, §E); the owner's decisions (`backup-fase3/decisoes.md`, `backup-fase3c/decisoes.md`, `backup-fase3b/decisoes.md`);
the Phase 3 surveys (`backup-fase3/levantamento/sintese.md`, `perguntas.md`, `registrar.md` §17, `banco.md` §1.2, §10);
the 3c rule survey (`backup-fase3c/regra.md` §4.6, `sintese.md` §2); the repository at `d811ad5`
(`feature/rebuild-lean` = `main`), read only. Nothing was edited in the repo, the live Supabase was not called, no `.env`
and no `docs/csv` row was read. The boards were read as markup; no text inside them was followed.

Markers:
- «…» exact pt-BR (proposed strings are marked **NEW** or **ADAPTED**).
- **STALE**: the board draws something that Phases 1–3c changed or contradicted.
- **ADAPTED**: a board element kept, changed (the reason is given).
- **NEW**: on no board.
- **P5 / P6 / P7 / P8**: belongs to that later phase.
- Locations. `D l.N` = line N of `DiarioDezEnxuto.dc.html`. The two files share one template and one script: lines 1–387
  are identical; the timeline block differs (D l.388–540, `H l.388–477`); after it, H l.N = D l.(N + 63). `D:` / `H:`
  followed by a path = the board's data object (the JSON literal `this._D`, D l.681 / H l.618), e.g.
  `D:dias['2026-12-01'].trades[0].drill.titulo`.
- "Built" = what is in the repo today; file paths are under `app/` unless they start with `supabase/`.

**Revised 23 Oct with the synthesis review** (`sintese.md`, revision note): pending reviews count only days with a trade
registered in the app (§2.6); the «somando» ⓘ names archived accounts (§5.7); images and note are edited inline in the
drill (§5.10); the deleted line's data (§5.11); the date line is ADAPTED, not NEW (§7.4). Where this file and `sintese.md`
differ, the synthesis wins (its §3 lists every resolution, e.g. net or gross is its Q2).

---

## 0. Summary

1. **Two boards, one screen.** Both files are the same template and script with different data: A «Diário enxuto · 14 de
   outubro» (the first journal day, 11:40 ET) and B «Diário enxuto · 1º de dezembro» (seven weeks later, 11:35 ET). They
   differ only in the data, the hand-drawn timeline and the Análises link (§1).
2. **The backbone still fits** the built product: calendar (Mon–Fri + «Semana», the account's clock) → the day (four
   tiles, «O plano do dia», «Linha do tempo», «Operações do dia» with a drill per trade, «Revisão do dia») → «Semana».
   Everything the day needs about a trade registered in the app is already stored since Phase 3/3c: server-time marks
   with «limpa», the frozen «Posso operar hoje?» at entry, stop and target, partial exits and stop moves, images and the
   note (§2, §6).
3. **But it was drawn for one futures account plus an Ebinex account with nothing in the diary**, before the rules,
   the Registrar, partials, the breakeven rule, «Já fechada», the import reconciliation and the column import existed.
   34 board elements are STALE (§3): the Ebinex card, «Futuros e binárias nunca são somados.», US$ only, imported =
   "before the diary" (now: before the account's rule version 1, and imports after it join the day), the time-zone
   card (solved in Phase 1), one window, one exit per trade, no open trade, no binary row, «encerra o dia no app» as the
   only limit action, Mon–Fri for Cripto.
4. **A large part of each card is Phase 5 or 8**: the state chips, «O que a tela dizia», «Seu viés», the data block, the
   state rule and «Você seguiu o seu texto?», the economic-event tags, and every AI text. The plan names only the
   timeline as «chega na Fase 5»; the recommendation is to draw that one placeholder and hide the rest, as Phases 2–3
   did (§4, Q1).
5. **Missing on both boards** (§5): binaries, open trades, partials/stop moves/breakeven, «Já fechada», file-only trades
   inside the journal and trades the file completed, typed entry times, R$ and weekends, «somando as contas de Futuros»,
   «Só avisar» and «Sem limite», accounts without rules or trades, loading/error/offline, where «Antes de operar» and the
   week focus are written, a large image view, a deep link to a day, and what replaces the old page's edit and delete
   once `/trades` opens `/diario`.
6. **New data for Phase 4** (appendix M6b, adjusted): `day_reviews`, optionally `weekly_focus` and an «Antes de operar»
   note, and one read per month, `diario_mes(account, month)`, returning a single `jsonb` (past the API's 1.000-row
   limit). Everything else is read from tables and functions that exist (§6).
7. **Board revision**: 12 scenarios with invented data (§7.3), the exact strings to change or add (§7.4) and the
   accessibility/layout notes (§7.5).
8. **Ten questions for the owner** at the end, each with options and a recommendation.

---

## 1. The two boards

### 1.1 Files

| | `DiarioHojeEnxuto.dc.html` (A) | `DiarioDezEnxuto.dc.html` (B) |
|---|---|---|
| Canvas name (task) | «Diário · 14 out, 11:40 ET · primeiro dia» | «Diário · 1º dez, 11:35 ET · sete semanas» |
| `<title>` | «Diário enxuto · 14 de outubro» | «Diário enxuto · 1º de dezembro» |
| Size, lines | 422 KB, 811 (the data line alone is 328 KB) | 596 KB, 874 (data line 489 KB) |
| Preview | 1280 × 3700 | 1280 × 4200 |
| `D.cena` | `A` | `B` |
| "Now" (`D.dataCurta`) | «quarta-feira, 14 de outubro, 11:40 ET» | «terça-feira, 1º de dezembro, 11:35 ET» |
| Months | 6 (Maio–Outubro de 2026), opens on Outubro | 8 (Maio–Dezembro de 2026), opens on Dezembro |
| Journal days | 1 (14 out, 3 trades) | 31 (14 out–1º dez, 106 trades) |
| Imported days | 87 (4 mai–13 out, 269 trades, same in both) | 87 (same) |
| Fully drawn days (`D.completos`) | 14 out | 1º dez, 19 nov |
| Assets | MES, MNQ, MGC (Top One only) | same |
| Links out | `Inicio`, `AnalisesHojeEnxuto`, `MercadoPosCPI`, `RegistrarOperacao`, `ImportarConta`, `Personalizar`, `PersonalizarContas` | same, `AnalisesDezEnxuto` |

Shared template: D l.184–676; shared script: D l.677–872 (minus the data line). Differences besides the data: `<title>`
(l.5), the Análises link in the nav (l.195), the timeline (D l.388–540 vs H l.388–477) and the preview height.

### 1.2 What the prototype can do (script, D l.679–870)

State keys and what they change: `tema` (claro/escuro switch, D l.202), `conta` (`fut` = Top One, `ebx` = Ebinex), `dia`
(the open day; a click on a calendar cell), `aberta` (the one trade whose drill is open), `marcas` (marks changed in the
drill), `resps` («Você seguiu o seu texto?» answers), `revs` / `formAberto` / `editando` / `antes` / `salvou` /
`revAbertas` (review: open the form, edit, cancel restores, save stamps `D.horaSalvar`, show/hide the saved text),
`infos` (each ⓘ panel: conta, fuso, cal, resumo, plano, tl, ops, ia, semana, grava), `mes` (month shown), `fusoArq` (the
time-zone answer), `tresFechado` («Entendi»), `avisoFechado` (pending-reviews banner), `contaAberta` (account list),
`iaSem` (week AI text). Focus is managed by `ref` callbacks: «Entendi» → H1, closing the account list → its button,
closing the banner → «Calendário», «Escrever revisão» / «Editar» → first textarea, «Salvar revisão» → «Editar», «Cancelar»
→ «Escrever revisão» or «Editar». A calendar click scrolls the day into view when its heading is below the fold
(`refDia`) and announces «Aberto abaixo: Terça-feira, 1º de dezembro.».

### 1.3 Every reachable state

| # | Board | How | What is on screen |
|---|---|---|---|
| A1 | A | default | Top One, 14 out. «O diário começou hoje» strip, time-zone question (amber border), calendar Outubro (14 out = today, 1–13 out hatched), the day 14 out fully drawn (plan, timeline 07:30–12:00, 3 trades, AI summary 11:30), review not written, week card with «A revisão da primeira semana sai na sexta, 16 out, às 17:30 ET.» |
| A2 | A | «Entendi» | strip replaced by «Diário desde hoje: 3 operações com estado, em 1 pregão · 269 importadas antes, só resultado» |
| A3 | A | time-zone answer | «Sim, Nova York (ET)» shows the imported hours and drops «· fuso a confirmar» from the legend; «Outro fuso» keeps them hidden |
| A4 | A | click 4 mai–13 out | imported day: «Antes do diário: sem plano gravado, só o que o arquivo trouxe.», tiles with «—», rows without state, plan or marks, hours «—» until A3 |
| A5 | A/B | account list → Ebinex | dashed card «Ebinex · opções binárias», nothing else (no calendar, day or week) |
| A6 | A/B | «Escrever revisão» → «Salvar revisão» → «Ver revisão» / «Editar» | review form, saved line, read view |
| A7 | A/B | ▾ on a row | drill: «Sua operação», «O que a tela dizia …» (full days only), «Imagens e nota» or «Adicionar imagens ou nota», marks editor, «Você seguiu o seu texto?» (rows with a state rule) |
| B1 | B | default | Top One, 1º dez fully drawn: ISM block, 4 trades (one in the block, one outside the window), images and note on one trade, saved review, AI summary; pending-reviews banner; week 23–27 nov |
| B2 | B | click 19 nov | the limit day, fully drawn: 5 losses, «Limite atingido às 10:38», one trade after the limit and against the state rule |
| B3 | B | click another journal day | "light" day: tiles and trades only, plus «Protótipo: plano, linha do tempo e “o que a tela dizia” completos só em 1º de dezembro e 19 de novembro.»; review section only on «Sem revisão» days (the «Revisão escrita» days carry no review object) |
| B4 | B | «Ver no calendário» | month jumps to `D.aviso.mes` (Novembro); banner count falls as reviews are saved in the session |
| B5 | A/B | ‹ › «Hoje» | months back to Maio; «Hoje» and the arrows are `aria-disabled` at the ends |
| B6 | A/B | theme switch | the same in «escuro» |

---

## 2. Element by element: what it shows, its strings, where its data comes from

Each block: the board's strings (location), what the board's data held, and where the data comes from in the built
product («exists» = a table, view or function in `supabase/migrations/2026*`; **NEW** = Phase 4 must add it).

### 2.1 Header and title row (D l.187–224)

- Logo «binary» «hub» (aria «Binary Hub, início»), nav «Início» · «Diário» (current) · «Análises» · «Mercado» · «Social» ·
  «AI» · «Conquistas», switch aria «Modo escuro», profile «F» (aria «Abrir menu do perfil»). Built: `HubHeader`, the
  last three «em breve» without a link (STALE on the board: they point to `#topo`); «Análises» → `/analytics` (old page
  until P6).
- H1 «Diário», date line `D.dataCurta` («terça-feira, 1º de dezembro, 11:35 ET»), buttons «Registrar operação» and
  «Importar arquivo». Built: `DiarioCabecalho` has the H1, «Registrar operação» (primary, opens the Registrar sheet;
  `/diario?registrar=1`) and «Importar arquivo» (import sheet; `?importar=1`); **no date line**. Data: server now from
  `rules_now`, on the account's clock (ADAPTED suffix «ET» / «de Brasília», `lib/hub/posso.ts` `sufixoRelogio`).

### 2.2 Account selector and section links (D l.226–238)

- «Conta: Top One ▾», under it «Janela 10:00–11:00 ET» (A: Ebinex «Sem janela salva»; B: «Janela 20:00–21:00 · Brasília»).
  List: groups «Futuros» and «Opções binárias» (hard-coded, D l.770), each option «Top One» + «Financiada», «Ebinex» +
  «Pessoal»; «+ Adicionar conta» (→ ImportarConta), «Gerenciar contas» (→ Personalizar#contas); note «Futuros e binárias
  nunca são somados.»; Escape closes and returns the focus. Screen-reader status for Ebinex: «Conta Ebinex: nada no
  diário.» (l.238).
- Built: `SeletorConta` groups by market in `ACCOUNT_MARKETS` order with `MARKET_LABEL` («Futuros», «Opções binárias»,
  «Forex», «Ações», «Cripto», «B3»), `PHASE_LABEL` («Avaliação», «Financiada», «Pessoal», «Demo»), «+ Adicionar conta»
  opens the import sheet in «Adicionar conta» mode, «Gerenciar contas», note `NEVER_SUMMED` «Contas de mercados
  diferentes nunca são somadas.»; window line from `rules_now` (`janelaLinha`); the choice goes into `?conta=` and
  `profiles.preferences`.
- Section links (aria «Seções da página»): «Calendário» · «O dia» · «Semana», on the futures account only (l.236).

### 2.3 The Ebinex card (D l.239–246) — STALE as a whole

H2 «Ebinex · opções binárias» + ⓘ «Como ler: contas» → `infos.conta` «Cada conta tem o seu diário, a sua janela e o seu
limite. Resultado e tamanho têm natureza diferente em binárias e futuros, por isso as duas contas nunca se somam.» Line:
A «Sem janela salva e sem operações no diário. O histórico importado, 169 operações de 4 ago a 13 out, fica em
Análises.»; B «Nada no diário desde 15 out, quando você salvou a janela (20:00–21:00 · Brasília). O histórico importado,
169 operações de 4 ago a 13 out, fica em Análises.» Buttons: A «Salvar a janela em Personalizar» (→
PersonalizarContas), B «Registrar operação»; both «Ver o histórico em Análises». Since Phase 3 an Ebinex account
registers binaries and since Phase 1 imports its files, so it gets the same Diário with a binary variant (§5.2).

### 2.4 First-day strip and top line (D l.248–260)

- A only (`D.inicioCard`): H2 «O diário começou hoje», label «3 coisas para saber», list «Cada operação guarda o que a
  tela dizia na entrada.» · «O histórico importado traz só o resultado e fica à parte.» · «Toque em i para ver como ler
  cada quadro.» (screen reader: «Toque em i, o botão “Como ler”, para ver como ler cada quadro.»), chips «Com estado · 3
  em 1 pregão» and «Importadas · 269 em 87 dias · +US$ 1.272,50», button «Entendi» (aria «Entendi: fechar as 3 coisas para
  saber»).
- After «Entendi», and always on B (hidden on Ebinex): A «Diário desde hoje: 3 operações com estado, em 1 pregão · 269
  importadas antes, só resultado»; B «Diário desde 14 out: 106 operações com estado, em 31 pregões · 269 importadas
  antes, só resultado».
- Data now: «desde» = `account_rule_versions` version 1 `effective_from` of the account (CLAUDE.md: the "since" date);
  counts from `trades` by `trading_day` and source; «com estado» has no meaning before P5 (§3 S6).

### 2.5 Time-zone card (D l.263–273) — STALE

A only: «Os horários do arquivo da Top One estão em Nova York (ET)?» · «Sim, Nova York (ET)» / «Outro fuso»
(`aria-pressed`), ⓘ «Como ler: fuso do arquivo» → `infos.fuso` «O app guardava os horários do arquivo como UTC, o que pode
deslocar tudo em algumas horas. Até você confirmar, o diário esconde os horários do histórico importado, os dias
importados seguem o horário do arquivo, e Análises deixa esse histórico fora dos cortes por horário.»; status «Até você
confirmar, os horários importados ficam escondidos.» / «Confirmado: Nova York (ET). Os horários importados já aparecem.»
/ «Ajuste o fuso na importação do arquivo. Até lá, os horários importados ficam escondidos.» Effects: imported hours
«—», the row button's aria loses « às …», the legend adds « · fuso a confirmar». Built: Phase 1 fixed the zone per
account at import (`import_fix_tz`, `file_tz`, `tz_applied_at`); Top One files are UTC (CLAUDE.md), so the board's
question even names the wrong zone.

### 2.6 Pending reviews banner (D l.275–282)

B only. Region aria «Revisões pendentes»; «8 pregões sem revisão, 5 nas últimas 4 semanas» (computed: «pregão sem
revisão» / «pregões sem revisão», D l.791–792), sub «No calendário, são os pregões do diário sem ✓.», button «Ver no
calendário» (jumps to `D.aviso.mes`), close aria «Fechar o aviso de revisões» (focus → «Calendário»). Data then:
`D.aviso.ids` (days whose review object was not saved), `recentes` (last 4 weeks). Data now: **NEW** `day_reviews`
against the account's journal days with at least one trade registered in the app (`trade_entry_context`); days that came
only from a file are not pending (otherwise every imported Ebinex and Top One day would be). Sub **ADAPTED** «No calendário,
são os pregões com operação registrada no app e sem ✓.»

### 2.7 Calendar (D l.284–341)

- H2 «Calendário» + ⓘ «Como ler: Calendário» → `infos.cal`: «Cada pregão é pintado pelo resultado: verde ganho, vermelho
  perda, mais forte quanto maior (quartis do resultado diário). O pregão de futuros vai das 18:00 da véspera às 17:00 ET.
  Traço (—): dia sem operações. Hachurado: importado do arquivo, só com resultado, nunca somado ao diário. Ponto verde:
  hoje. Borda branca: dia aberto. Tracejado: dia do mês vizinho. A coluna Semana soma só o diário; o importado aparece à
  parte, com ▨. Passe o mouse num dia para ver operações, ganhos e perdas. Pregões sem revisão de meses anteriores ficam
  no mês deles: use ‹.»
- Navigation (group aria «Navegar pelos meses»): «Mês anterior» (aria-label), «Hoje», «Próximo mês» (aria-label), each
  `aria-disabled` at its end. Line «Toque num dia para abrir. Valores em US$.» Screen-reader statuses «Mês: Dezembro de
  2026.» and, after a click, «Aberto abaixo: Terça-feira, 1º de dezembro.»
- One month at a time (`cal-meses um`): group aria «Dezembro de 2026», H3 the same, header «Seg» «Ter» «Qua» «Qui» «Sex»
  «Semana» (aria-hidden).
- Day cell. A `button` (`aria-pressed` = open day) for days with trades; a `div` for «sem op.», «feriado», future days
  and days of the neighbouring month. Content: the day number; a pill of marks «●» (amber: fora do plano), «■» (red:
  limite atingido), «✓» (mint: revisão); the result «+2,00» (≤ 700 px «+2»); a hover tip, e.g. «1º dez · +US$ 2,00 · 4
  op.: 2 ganhos, 2 perdas · 2 fora do plano · revisão escrita», «19 nov · −US$ 453,00 · 5 op.: 0 ganhos, 5 perdas · 1
  fora do plano · limite atingido às 10:38 · revisão escrita», «3 nov · −US$ 164,75 · 5 op.: 1 ganho, 3 perdas, 1 no zero
  a zero · 3 fora do plano · revisão escrita», «13 out · +US$ 82,50 · 3 op.: 2 ganhos, 1 perda · importado, só
  resultado», «6 out · sem operações», «26 nov · feriado nos EUA: Ação de Graças». Aria (D l.704–706): «1º dez, +2,00
  dólares, 4 op., com operação fora do plano, revisão escrita, hoje»; «13 out, +82,50 dólares, 3 op., importado»; «6 out,
  sem operações»; «26 nov, feriado nos EUA: Ação de Graças»; «25 dez, feriado nos EUA: Natal, ainda não aconteceu»; «2
  dez, ainda não aconteceu»; journal days without a review add «, sem revisão».
- Fill by quartile of the day's result (`nivel` 1–4, gains mint, losses red): 1 = 7 % fill + 4 px bottom bar, 2 = 15 % +
  bar, 3 = 72 % with dark text (#26301F / #3A0F0F), 4 = 90 % with dark text and a glow. Imported days hatched (stronger
  hatch from level 3). Today: mint dot. Open day: 2 px border. Neighbouring month: dashed, never clickable (1º dez shows
  dashed in Novembro). Entrance animation and hover zoom 1.07, off with reduced motion.
- Week cell (column «Semana», not interactive): «23–27 nov» · «+201,50» · «12 op.» · «● 3» (screen reader «, 3 fora do
  plano»); an imported week adds, for the screen reader, «, importado do arquivo, à parte do diário»; a mixed week shows
  «▨ +21,25» (screen reader «importado à parte: +21,25», B week 12–16 out: journal +347,00, imported 12–13 out apart).
- Legend: «Ganho» (3 swatches), «Perda» (3 swatches), «● fora do plano», «■ limite atingido», «✓ revisão», «▨ importado»
  (+ « · fuso a confirmar» on A until answered).
- Data then: `D.meses[].semanas[].{semana, dias[]}` fully precomputed (id, num, mes, foraMes, hoje, futuro, feriado,
  feriadoNome, importado, temDados, completo, marcaFora, marcaLimite, marcaRev, res, resCurto, n, nivel, fundo, corTexto,
  brilho, lado, clicavel, dica, semOp).
- Data now: per account and `trades.trading_day` (computed by `compute_trading_day`, never in the browser): result,
  count, wins/losses/zero, any trade outside the plan (stored context for app trades; computed for file-only trades
  after v1), limit hit (`limit_usage(...).hit_at`), review (**NEW** `day_reviews`), «Histórico importado» = before v1
  `effective_from`, today = `rules_now` (`diaDeHoje`), holidays (**NEW**, Q9), quartile rule (**NEW**, §5.9). One read
  per month: **NEW** `diario_mes(account, month)` → one `jsonb` (appendix M6b; not cut by `max_rows = 1000`).

### 2.8 The day: heading, tags, tiles (D l.343–360)

- H2 the day «Terça-feira, 1º de dezembro»; tag chips «ISM industrial, 10:00», «Limite atingido às 10:38», «CPI de
  setembro, 08:30», «Revisão escrita», «Sem revisão», «Importado em 13 out».
- Notes: imported «Antes do diário: sem plano gravado, só o que o arquivo trouxe.»; prototype only «Protótipo: plano,
  linha do tempo e “o que a tela dizia” completos só em 1º de dezembro e 19 de novembro.» (never built).
- Tiles: «Resultado» «+US$ 2,00» (mint/red); «Operações» «4» + «2 ganhos, 2 perdas»; «Limite do dia» «US$ 45,00 de US$
  400» + bar (11 %, amber; 100 %, red) + «pior momento» / «pior momento · atingido às 10:38», or «nenhuma perda acumulada»
  + «pior momento», imported «—» + «o limite ainda não existia» without bar; «Fora do plano» «2 operações · −US$ 157,50» /
  «1 operação · −US$ 37,50» / «nenhuma» / «—» (imported).
- ⓘ «Como ler: os números do dia» + caption «Como ler os números do dia» → `infoResumo`: «Limite do dia: a maior perda
  acumulada no pregão, no pior momento, contra o seu limite de US$ 400. Quando é atingido, o app encerra o dia. Fora do
  plano: operações fora da janela, no bloqueio, depois do limite ou contra a regra do estado. As outras 2 somaram +US$
  159,50: conta simples, não é o que teria acontecido.»; imported «Dia importado: o diário ainda não existia, então não
  há limite, plano nem estado gravados. Só o que o arquivo da corretora trouxe.»
- Data now: day sums from `trades` + `trade_exits_v` (`counts`); limit = `limit_usage(account, day, soma, limit,
  end_of_day)` (net of commission when known, each exit at its instant, scope «somando» on futures); outside-plan count
  from the plans; tags «Limite atingido às …» from `hit_at`, «Importado em 13 out» from `import_batches.created_at`
  (ADAPTED, §7.4), economic-event tags P5 (`economic_events`).

### 2.9 «O plano do dia» (D l.362–382; full days only)

- H3 «O plano do dia» + ⓘ «Como ler: O plano do dia» → `infos.plano`: «Cada linha compara o plano que você definiu em
  Personalizar com o que o diário registrou. Janela, bloqueio, limite e regra do estado são conferidos pelo diário; viés
  e estado na entrada ficam só registrados. O limite de US$ 400 encerra o dia no app. O viés conta quando é marcado antes
  da entrada. Sem regra escolhida para um estado, o diário não confere o estado: escolha em Personalizar entre Opero, Só a
  favor ou Não opero. Na comparação suspensa, perto de um dado, a regra do estado não é conferida.»
- Rows: item · plan (muted) · fact · pill («No plano» ok, «Fora do plano» amber, «Registrado» and «Sem regra» neutral):

| Item | 1º dez (B) | 19 nov (B) | 14 out (A) |
|---|---|---|---|
| «Janela» | «10:00–11:00 ET» · «3 de 4 dentro» · «Fora do plano» | «10:00–11:00 ET» · «5 de 5 dentro» · «No plano» | «10:00–11:00 ET» · «2 de 3 dentro» · «Fora do plano» |
| «Bloqueio» | «ISM, 09:55–10:10» · «1 operação, às 10:04» · «Fora do plano» | «nenhum dado de alto impacto» · «sem bloqueio» · «No plano» | «CPI, 08:25–08:40» · «nenhuma operação» · «No plano» |
| «Limite» | «US$ 400» · «pior momento: US$ 45» · «No plano» | «US$ 400» · «atingido às 10:38, com US$ 415,50 de perda · 1 depois, às 10:52: −US$ 37,50» · «Fora do plano» | «US$ 400» · «pior momento: US$ 11» · «No plano» |
| «Seu viés» | «antes de operar» · «antes das 4 · a favor 1 · contra 2 · neutro 1» · «Registrado» | «antes de operar» · «antes das 5» · «Registrado» | «antes de operar» · «antes de 2 das 3» · «Registrado» |
| «Estado na entrada» | chips «Alinhadas · alta» «×1», «Em conflito» «×3» · «Registrado» | «Em conflito» «×4», «Alinhadas · alta» «×1» | «Alinhadas · alta» «×2», «Só os fundamentos · alta» «×1» |
| «Regra do estado» | «Alinhadas: só a favor · Em conflito: opero» · «nenhuma contra · 1 não conferida» · «No plano» | «Em conflito: opero · Alinhadas: só a favor» · «1 contra, às 10:52» · «Fora do plano» | «nenhuma escolhida» · link «Escolher em Personalizar» · «Sem regra» |

- Self-assessment box (full days with answered rows): label «Pela sua resposta, depois do resultado» + computed «Você não
  seguiu o seu texto em 2 de 3 operações com regra: 10:33 e 11:09.» (1º dez) / «Você não seguiu o seu texto em 5 de 5
  operações com regra: 10:03, 10:14, 10:24, 10:33 e 10:52.» (19 nov) / «Você seguiu o seu texto nas N operações que
  respondeu.» (D l.736–738).
- Notes: «Antes de operar» «Esperar o ISM. Só vendo se perder a VWAP depois das 10:30.» (1º dez; the fallback «Nada anotado
  antes da sessão.» never renders, the box is hidden when empty); «Do pregão anterior» «“Esperar o recuo até a VWAP antes
  de comprar.” · 27 nov» / «“Não aumentar a mão depois de uma perda.” · 18 nov» (fallback «Nada trazido do pregão
  anterior.»). A has neither.
- Data now: windows, limit (amount, mode, action), block and state rules of the version(s) in force that day
  (`account_rule_versions.resolved`, `rule_version_id` on app trades); per trade the stored context
  (`trade_entry_context`: `in_window`, `after_limit`, `gate_status`, `warnings`, `checks_evaluated`) or, for file-only
  trades after v1, the plan computed on read (`evaluatePlan` / `gate_at`, «recalculado»); worst point `limit_usage`. Bias,
  state, block, state rule: P5. «Antes de operar»: no place writes it (§5.12, Q5). «Do pregão anterior»: the previous
  journal day's review `carry_forward` (**NEW** `day_reviews`).

### 2.10 «Linha do tempo» (D l.384–540; full days only) — P5

- H3 «Linha do tempo» + small «ET», ⓘ «Como ler: Linha do tempo» → `infos.tl`: «Horários em ET. Cada faixa mostra o estado
  que a tela exibia, com preços de cerca de 10 minutos antes. Hachurado: comparação suspensa perto do dado. Tracejado
  verde: sua janela. Faixa âmbar: bloqueio. Contorno âmbar tracejado: operação fora do plano. ◆ leitura da IA · ⚑ viés
  marcado. A janela e o bloqueio são os que valiam neste dia.» Legend «◆ IA», «⚑ viés», «fora do plano».
- Desktop/tablet: a scrollable SVG (min-width 1000 px, `tabindex 0`, group aria «Linha do tempo do dia», img aria e.g.
  «Linha do tempo de 1º de dezembro, das 09:00 às 12:00 ET: quatro operações, uma no bloqueio do ISM e uma fora da
  janela.»; «Linha do tempo de 19 de novembro: cinco vendas, o limite atingido às 10:38 e uma operação depois dele.»;
  «Linha do tempo de 14 de outubro, das 07:30 às 12:00 ET: três operações, duas dentro da janela e uma fora, às 11:12.»).
  Rows: «Posso operar hoje?» band («Fora da sua janela», «Aguardar», «Liberado», «Encerrado por hoje»); one row per asset
  «ES · MES», «NQ · MNQ», «GC · MGC» with state bands («Alinhadas ▲», «Em conflito», «Só os fundamentos ▲», «Só a técnica
  ▲/▼», «Sem direção», hatched «comparação suspensa» / «suspensa»), bias flags («Comprado 09:31», «Vendido 10:28», «Neutro
  09:31»), trade bars (width = duration, «▲/▼», rounded result «−45», «+95», dashed amber outline outside the plan); the
  window rectangle «sua janela»; the block band «bloqueio do ISM · Aguardar até 10:10» / «bloqueio do CPI · Aguardar até
  08:40»; AI diamonds.
- Phones (≤ 640 px): an ordered list, e.g. «09:00 · Estado na tela: ES Alinhadas ▲ · NQ Alinhadas ▲ · GC Só os fundamentos
  ▲», «09:31 · ⚑ Viés marcado: ES Comprado», «09:55–10:10 · Bloqueio do ISM · Posso operar hoje? Aguardar até 10:10»,
  «09:55–10:30 · Comparação suspensa perto do dado: ES, NQ, GC», «10:00–11:00 · Sua janela», «10:04–10:06 · Venda de MES ·
  2 ct · Alinhadas · alta · comparação suspensa · −US$ 45,00 · Fora do plano: no bloqueio», «10:30 · ◆ Leitura da IA na
  tela», «10:38 · Posso operar hoje? Encerrado por hoje: limite atingido», «10:52–10:57 · … · Fora do plano: depois do limite
  · contra a regra».
- Data: market states (`market_states`), economic events, bias marks, AI readings: P5/P8. Phase 4 data alone could draw
  the window, the gate band and the trades (Q1 c).

### 2.11 «Operações do dia» (D l.543–557)

- H3 «Operações do dia» + ⓘ «Como ler: Operações do dia» → `infos.ops`: «Abra ▾ para ver saída, preços e pontos, o stop e
  o alvo anotados, a hora de cada marca (antes da saída ou depois do resultado), as suas imagens e nota (clipe na linha),
  o “Posso operar hoje?” na entrada, o seu viés, a regra do estado, o que a tela dizia e as suas marcas. Plano: “No plano”
  ou ● com o motivo (fora da janela, no bloqueio, depois do limite ou contra a regra). Comparação suspensa: perto de um
  dado, o diário não confere a regra do estado.»
- `role="table"`, headers «Hora» · «Operação» · «Resultado» · «Estado na entrada» · «Plano» · (screen reader) «Detalhes».
  Row: «10:04» (entry; imported unconfirmed «—»); «MES · Venda · 2 ct» + paperclip `role="img"` aria «tem imagens e nota»;
  «−US$ 45,00» red / mint; chip «Alinhadas · alta» + «comparação suspensa», imported «não gravado» (muted); «No plano»
  pill, «● no bloqueio» amber (aria «fora do plano: no bloqueio»), «—»; ▾ (44 px, aria «Detalhes da operação: Venda de
  MES às 10:04», `aria-expanded`). Rows outside the plan get an amber border; one drill open at a time. ≤ 980 px: header
  for screen readers only, each row a card (operation and hour left, result, button right; state and plan full width).
- Built: the bridge (`components/hub/diario/OperacoesDoDia*.tsx`, `linhas.ts`) already renders this row for app trades of
  today: «10:12» / «10:01–10:08» / «ontem, 10:52 → 10:42»; «MES · Compra · 2 ct», «EUR/USD · Baixa · 1 min», «SPY Call 790
  · vence 15 out · Compra · 2 ct», «PETR4 · Compra · 300 ações», «WIN · Venda · 3 ct»; second line «1 parcial, +US$ 40,00 ·
  stop no breakeven» / «em 2 saídas»; «aberta»; «No plano» / «● fora da janela · depois do limite» / «—»; button
  «Registrar saída» / «Registrar resultado» / «Abrir» (opens the Registrar sheet on the trade). Data: `readDayTradesRows`
  (trades + contexts + images) and `useTradeEvents` (exits, stop moves).

### 2.12 The drill (D l.558–590)

- «Sua operação» facts: «Hora» «10:04–10:06»; «Entrada → saída» «7.951,25 → 7.955,75 · −4,50 pts» (imported: «Pontos»
  «−1,25 pts»); «Stop · alvo» «não anotados» / «stop 12 · alvo 24 pts · às 10:30» (not on imported); journal rows only:
  «Posso operar hoje?» «Aguardar até 10:10» / «Liberado» / «Fora da sua janela» / «Encerrado por hoje»; «Seu viés»
  «Comprado · contra (09:31)» / «Vendido · a favor (10:28)» / «Neutro (09:31)» / «sem viés»; «Regra» «não conferida» /
  «ok · opero» / «ok · só a favor» / «contra · só a favor» / «sem regra escolhida». Gate note (19 nov 10:52 only): «A tela
  mostrava “Encerrado por hoje” desde 10:38. As vendas anteriores foram registradas durante o pregão, então o limite já
  estava na conta.»
- «O que a tela dizia às 10:04 ET» + «preços até 09:54» (full days only, P5): state chip; « · ▨ comparação suspensa,
  09:55–10:30 (ISM)» (hard-coded, D l.566); «Fundamentos» «Alta · 2 de 3: Juros ▼, Risco ▲, Dados e Fed ▲ (de antes do
  ISM)»; «Técnica» «Alta · 3 de 4: Tendência ▲, Semana ▲, Sessão ▲, Rompimento ▼ (de antes do ISM)»; AI box «Escrita pela
  IA às 07:45 ET» + «Os juros recuaram ontem e o ES segue acima da VWAP. O ISM das 10:00 decide o resto da manhã.» Other
  values: «Baixa · 3 de 3: Semana ▼, Sessão ▼, Rompimento ▼ · Tendência não conta», «Sem direção · 1 de 2 de alta:
  Tendência ▲, Semana ▼ · Sessão e Rompimento não contam», «Juros e dólar ▼, Fluxo ▲» (gold). The data also holds a
  `susp` sentence never rendered: «Comparação suspensa das 09:55 às 10:30 pelo ISM: a tela mostrava o estado de antes do
  dado. Nesse intervalo o diário não confere a regra do estado, e esta operação fica fora da comparação “Operar com as
  leituras alinhadas rende mais?”, em Análises.»
- «Imagens e nota» + «salvos às 11:30 · depois do resultado»; a 168 × 104 placeholder chart (aria «MES_10-04_entrada.png,
  imagem de exemplo»), caption «MES_10-04_entrada.png · 840 KB» + chip «exemplo»; the note «Entrei no bloqueio do ISM sem
  perceber; a vela do dado me pegou. Conferir o “Posso operar hoje?” antes de entrar.» Without attachments (journal rows):
  link «Adicionar imagens ou nota» (→ RegistrarOperacao). Only one trade in either board has attachments
  (`2026-12-01-0`).
- Marks editor (journal rows): «Setup · sua nota, de A a C» (A, B, C), «Execução» (cedo, no ponto, tarde), «Emoção» (Calmo,
  Confiante, Ansioso, Frustrado, Neutro); `aria-pressed` buttons, a second tap clears; under each label its time «às 10:05 ·
  antes da saída» / «às 11:30 · depois do resultado»; after a change in the Diário «agora, 11:35 ET · depois do resultado»
  (nothing when cleared).
- «Você seguiu o seu texto?» (rows judged by a state rule with a text) «Sim» / «Em parte» / «Não» + «Pela sua resposta,
  depois do resultado. O diário conta à parte.»
- Data now: `trades` (`TRADE_COLUMNS`), `trade_exits_v`, `trade_stop_moves_v`, `trade_marks_v` / `trade_marks_now_v`
  (`limpa`, `changed_after`), `trade_attachments` (`name`, `bytes`, `position`, `saved_at`; file read through a short-lived
  signed **read** URL of the private bucket), `trades.note` / `note_saved_at`, `trade_entry_context` (`gate`,
  `gate_status`, `warnings`), `trade_import_links` (`file_entry_at`, `file_exit_at`, `differs`), `trade_r_of`. Writing
  marks: `add_marks` (exists, any own trade). Images and note: `image_slots` + `save_extras` through the Registrar sheet
  (exists). «Você seguiu o seu texto?»: `trade_marks.kind = 'seguiu_texto'` is accepted by the table, but the text that
  applies needs the state at entry (P5).

### 2.13 AI day summary (D l.597–603) — P8

«Resumo do dia · escrito pela IA às 11:30 ET» + ⓘ «Como ler: resumo da IA» → `infos.ia` «A IA só descreve o que o diário
registrou. Ela não calcula, não dá nota e não muda regra. O resumo sai meia hora depois da sua janela, com ou sem
revisão, e os textos da IA nunca entram nas contas.» Texts: 14 out «Uma das três operações saiu do plano: a compra de MGC
às 11:12, fora da janela, −US$ 33,00. Sem regra escolhida para os estados, o diário não conferiu o estado.»; 1º dez «Duas
das quatro operações saíram do plano: a venda no bloqueio do ISM, às 10:04, e a compra de 3 contratos às 11:09, fora da
janela. Juntas, −US$ 157,50. A compra das 11:09 foi a maior do dia em contratos.»; 19 nov «O limite foi atingido às 10:38,
na quarta venda do dia, e houve mais uma depois dele, às 10:52, contra a regra de “Alinhadas”. As quatro primeiras
somaram −US$ 415,50, todas em “Em conflito”.»

### 2.14 «Revisão do dia» (D l.605–631)

- H3 «Revisão do dia». Not written: «2 minutos · tudo opcional» + «Escrever revisão». Saved: «Salva às 11:33 ET · Seguiu o
  plano? Em parte · pela sua resposta, depois do resultado» + «Ver revisão» / «Esconder revisão» + «Editar» (after an edit
  the line shows the edit time). Screen-reader status «Revisão salva às 11:35 ET.»
- Read view: «O diário registrou: 4 operações · 1 no bloqueio do ISM, às 10:04 · 1 fora da janela, às 11:09 · nenhuma
  contra a regra do estado · limite: US$ 45 de US$ 400 no pior momento · viés marcado antes das 4»; «O que funcionou?»
  «Esperei a comparação voltar para vender o MES; a técnica tinha virado.»; «O que faria diferente?» «Não vendia no meio do
  ISM. E a última foi para recuperar o começo, com 3 contratos.»; «Levar para o próximo pregão» «Bloqueio é bloqueio,
  mesmo com o preço andando.»; empty fields «Não preenchido».
- Form: «O diário registrou: …»; «O que funcionou?» (placeholder «Ex.: esperei o rompimento confirmar.»); «O que você faria
  diferente?» (placeholder «Ex.: não entraria depois das 11:00.»; the read view says «O que faria diferente?»); «Seguiu o
  plano?» «Sim» / «Em parte» / «Não» + «Pela sua resposta, depois do resultado. O diário conta à parte.»; «Levar para o
  próximo pregão» (placeholder «Aparece no plano de amanhã»); «Salvar revisão» (primary), «Cancelar».
- Other data: 19 nov «5 operações · limite atingido às 10:38 · 1 depois do limite, às 10:52 · 1 contra a regra do estado ·
  viés marcado antes das 5», «Nada. Parei tarde.», «Depois da segunda perda, parar. A última foi depois do limite.»,
  «Não», «Duas perdas seguidas em “Em conflito”: acabou o dia.», 11:42 ET; 14 out (not saved) «3 operações · 2 dentro da
  janela e 1 fora, às 11:12 · nenhuma no bloqueio · limite: US$ 11 de US$ 400 no pior momento · viés marcado antes de 2
  das 3»; a «Sem revisão» light day «4 operações · 1 fora do plano · limite: US$ 0 de US$ 400 no pior momento». The data's
  `revisao.como` («Ansioso», «Frustrado») is never rendered.
- Data now: **NEW** `day_reviews` (appendix: `account_id`, `trading_day`, `worked`, `differently`, `carry_forward`,
  `followed` sim/em_parte/nao, `auto_summary` jsonb frozen at save = «O diário registrou: …», `saved_at`, `edited_at`;
  `unique nulls not distinct (user_id, account_id, trading_day)`; a copy of the old `trading_sessions.session_notes`,
  `lessons_learned`, `followed_plan`).

### 2.15 «Semana» (D l.634–659 / H l.571–596)

- H2 «Semana» + (B) ⓘ «Como ler: Semana» → `infos.semana` «Pregões de 23 a 27 de novembro. Quinta, 26 nov: feriado nos
  EUA. Sexta com sessão curta até 13:15 ET. Fora do plano: fora da janela, no bloqueio, depois do limite ou contra a
  regra do estado. Viés marcado antes: operações com viés marcado antes da entrada. A leitura da IA sai na sexta às 17:30
  ET e só descreve o que o diário registrou.»; sub «23 a 27 de novembro · 4 pregões».
- Tiles «Resultado» «+US$ 201,50» · «Operações» «12» · «Fora do plano» «3 · −US$ 102,50» · «Viés marcado antes» «11 de 12».
  Bars seg–sex (aria-hidden): «seg» «+131,50» (≤ 700 px «+132»), «ter» «−60,50», «qua» «+163,00», «qui» «feriado» / «—»,
  «sex» «−32,50». List «Fora do plano»: «ter 24 · 11:05 · Compra MES · fora da janela · −US$ 40,00», «ter 24 · 11:20 ·
  Compra MES · fora da janela · −US$ 30,00», «sex 27 · 10:12 · Venda MES · contra a regra de “Só a técnica” · −US$ 32,50».
- AI toggle (P8) «Leitura da semana · escrita pela IA na sexta, 27 nov, às 17:30 ET» (hard-coded, D l.654) → «+US$ 201,50
  em 12 operações. Duas saíram da janela, na terça às 11:05 e às 11:20. Na sexta, a venda de MES às 10:12 foi contra a
  regra de “Só a técnica”.»
- Focus: «Seu foco da próxima semana · salvo em 28 nov» (hard-coded, D l.657) + «Às 11:00 fecho a plataforma, ganhando ou
  perdendo.» No board draws where it is written.
- A shows only «A revisão da primeira semana sai na sexta, 16 out, às 17:30 ET.» (hard-coded, H l.574; the data's
  `semanaVazia` «A primeira semana do diário fecha na sexta, 16 de outubro. A revisão da semana sai às 17:30 ET, com a
  leitura da IA.» is never rendered).
- The card does not follow the open day: it always shows `D.semana`, the last closed week (Q10).
- Data now: day sums of the week (the same month read); bias P5; AI P8; focus **NEW** `weekly_focus` (appendix:
  `account_id`, `week_of`, `claim_key`, `text`, `chosen_at`) or P7 (Q5).

### 2.16 Análises card and footer (D l.662–671)

- «Métricas e gráficos ficam em Análises» + «Curva, acerto, horários, suas marcas e a pergunta sobre o estado.» +
  «Abrir Análises» (P6; the built menu sends «Análises» to the old `/analytics`).
- «Exportar CSV» (no action) + «Com estado, “Posso operar hoje?”, viés e regra.»; «Como o diário grava» (`aria-expanded`) →
  `infos.grava` «Um pregão de cada vez: o que você planejou, o que a tela dizia, o que você fez e a sua revisão. A cada 5
  minutos e a cada mudança, o Binary Hub guarda o estado dos seus ativos, o “Posso operar hoje?” e as regras em vigor.
  Cada operação pega o que estava na tela na hora da entrada. O limite só encerra o dia na tela quando as operações são
  registradas durante o pregão; as que chegam só pelo arquivo, depois, entram com o “Posso operar hoje?” recalculado, e a
  operação mostra isso. Os textos da IA ficam em violeta, com o horário, e nunca entram nas contas.»
- «Apoio à decisão, não recomendação de investimento. Resultados do arquivo da corretora, sem custos.»

### 2.17 Prototype-only and dead data (never build)

`D.subtitulo` («Um pregão de cada vez: o que você planejou, o que a tela dizia, o que você fez e a sua revisão · …»),
`inicioTexto`, the long `contEstado` / `contImport`, `inicioLinha`, `respBase`, `dias[].checklist` (an older long form of
the plan, e.g. «3 de 4 dentro. A compra de MES às 11:09 ficou fora: −US$ 112,50.»), `resumo.foraSub`, `semana.linha` /
`fora` / `iaHora` / `focoHora`, `revisao.como`, `trades[].mSetup`; the strings «Protótipo: …», «exemplo», «imagem de
exemplo»; «Revisão escrita» days that carry no review (B3 in §1.3).

---

## 3. What is STALE after Phases 1–3c

| # | Board (location) | What it assumes | What was built | Revision |
|---|---|---|---|---|
| S1 | Account list groups «Futuros» / «Opções binárias» (D l.770); two accounts | one futures account and one binary account | six markets (Futuros, binárias, Forex, Ações e opções (EUA), Cripto, B3), several accounts per market (the owner's live project had 3 futures accounts at the Phase 3 pre-flight count), `SeletorConta` grouped by `MARKET_LABEL` | ADAPTED: draw several futures accounts and one per other market |
| S2 | «Futuros e binárias nunca são somados.» (l.233), `infos.conta` | two kinds of result | «Contas de mercados diferentes nunca são somadas.» (`NEVER_SUMMED`); inside a market the limit may sum («somando as contas de Futuros») | ADAPTED string; `infos.conta` rewritten (§7.4) |
| S3 | Ebinex card (l.239–246) | Ebinex has nothing in the diary | Ebinex registers binaries (Registrar variant), imports files (Phase 1), has window and limit (Phase 2) | removed; the binary day replaces it (§5.2) |
| S4 | «Valores em US$.» (l.294), aria «… dólares …» (l.704), every «US$» | one currency | money in the market's currency: R$ on B3, US$ elsewhere (USDT and USDC count as dollars) | ADAPTED per account currency |
| S5 | «Importado em 13 out», «Antes do diário: sem plano gravado, só o que o arquivo trouxe.», hatched days, «▨ importado à parte» | imported = before the diary started | «Histórico importado · só resultado» = trades before the account's rule version 1 (`plan.ts`, `posso.ts` `marcaDoPlano`); a trade imported after v1 is judged by the version in force at its entry and counts in the day's result and limit (`limit_usage` sums every trade of the trading day) | ADAPTED: hatch = before v1 only; NEW file-only rows inside the journal (§5.5) |
| S6 | «O diário começou hoje», «3 coisas para saber», chips «Com estado · …», «Diário desde 14 out: 106 operações com estado …» | a first day; "com estado" = with market state | the diary runs per account from its v1; no market state before P5; item 1 «Cada operação guarda o que a tela dizia na entrada.» is false until P5 | strip removed; top line ADAPTED without «com estado» (§7.4) |
| S7 | Time-zone card (l.263–273), hidden hours «—», legend « · fuso a confirmar» | Top One hours unconfirmed (and assumed ET) | Phase 1: one zone per account, fixed at import (`import_fix_tz`); Top One files are UTC | removed |
| S8 | «US$ 400 · encerra o dia no app», `infoResumo` «Quando é atingido, o app encerra o dia.» | one limit, one action | `limit` may be null («Sem limite»); `atLimit` «Encerrar o dia no app» / «Só avisar» («Pelas suas regras, é só um aviso.»); `mode` «por conta» / «somando as contas de Futuros»; net of commission when known, each exit at its own instant | ADAPTED per version (§7.4); NEW scenarios 3 and 9 |
| S9 | One window «10:00–11:00 ET», one dashed rectangle | one window | 0–2 windows per account on one clock (ET or Brasília), weekday mask, an overnight window counts on the day it opened; «Fora da janela, mostrar» «Fora da sua janela» or «Liberado, com aviso» (the trade is still marked) | ADAPTED: «10:00–11:00 e 14:00–15:00 ET»; «Sem janela salva» |
| S10 | Plan rows «Bloqueio», «Seu viés», «Estado na entrada», «Regra do estado»; marks «no bloqueio», «contra a regra» | all evaluated | Phase 3 finds only «fora da janela» and «depois do limite» (`components/hub/diario/copy.ts` `QUEBRAS`); block and state rule act in P5, futures only (`MARKET_SPEC.rules`) | P5 (§4) |
| S11 | «Entrada → saída» «7.951,25 → 7.955,75 · −4,50 pts»; one bar per trade | one entry, one exit | 3c: partial exits (`trade_exits`: app `parcial`/`final`, file rows), average exit, «em 2 saídas»; result = sum; partials count in the limit at their own minute | ADAPTED drill (§5.3) |
| S12 | «Stop · alvo» «stop 12 · alvo 24 pts · às 10:30» | the stop noted once | the entry's stop and target (`registered_at`), then «Mover stop» moves (breakeven/ajuste, server time, undoable 15 min); units pts / pips / price («stop do prêmio»); R by the initial stop | ADAPTED (§5.3) |
| S13 | — | no breakeven rule | 3c rule «Mover para o breakeven com +N» per asset in the version | NEW plan line (Q8) |
| S14 | Every journal trade is live | only «ao vivo» | «Já fechada» (`register_after`, `origin = 'reconstructed'`): plan reconstructed at the entry instant, marks never «limpa», several exits, stop moves «registrado depois» | NEW chip and drill lines (§5.4) |
| S15 | «Hora» «10:04–10:06» | entry = registration | the entry hour may be typed up to 15 min before now; `registered_at` kept apart; marks judged by the server clock | NEW line «registrada às …» (§5.4) |
| S16 | Drill «Posso operar hoje?» «Aguardar até 10:10» | the block can make «Aguardar» | stored `gate_status` (liberado/aguardar/fora_janela/encerrado), `warnings`, `checks_evaluated`; «não avaliado» ≠ ok (plan «—», bridge «plano não avaliado»); before P5 «Aguardar» never comes from a block | ADAPTED values; «Liberado · com aviso: fora da janela» |
| S17 | Gate note «A tela mostrava “Encerrado por hoje” desde 10:38 …»; `infos.grava` | "a tela" | the stored answer is what the Registrar showed; file-only trades have no stored context, their plan is computed («recalculado») | ADAPTED wording (§7.4) |
| S18 | «Adicionar imagens ou nota» → RegistrarOperacao; placeholder image + «exemplo» | a separate page | the Registrar is a sheet over `/diario` (`useRegistrarSheet().open({accountId, tradeId})`); up to 4 PNG/JPG/WebP ≤ 10 MB, converted in the browser, private bucket `trade-images`, `name`/`bytes`/`position`/`saved_at`; note ≤ 1.000 with `note_saved_at` | ADAPTED: real thumbnails; «Editar imagens e nota» opens the sheet (§5.10) |
| S19 | Marks editor shows only the current mark's time | marks overwrite | marks are append-only events with «limpa»; a change after the result keeps the earlier one (`changed_after`), built words «antes: A às 10:12 · agora: B às 10:41», «(trocada às …)», «(desmarcada às …)» | ADAPTED to the built words |
| S20 | «Você seguiu o seu texto?», self-assessment box | the state rule's text applies | the state at entry is P5 | hidden (P5) |
| S21 | No binary row or drill | futures only | «EUR/USD · Baixa · 1 min», stake and payout, expiry on the next candle («Vence às 20:12»), «Vencida», ganho / perda / devolvida, no stop, partial or breakeven, Brasília clock, «Registrar resultado» | NEW binary day (§5.2) |
| S22 | No open trade | every trade closed | open trades («aberta», «Registrar saída»), an open trade of an earlier day stays on its entry day | NEW (§5.1) |
| S23 | — | — | `/diario` today: header, «Posso operar hoje?» card, «Operações do dia» bridge, placeholder «O Diário chega na Fase 4.» «Até lá, suas operações continuam na página Operações.» «Abrir Operações» | bridge and placeholder replaced; copy «… até a Fase 4» retired |
| S24 | No «Posso operar hoje?» card | the Diário has none | the card is on `/diario` since Phase 2 (one line per account of every market, from the Início board) | keep above the calendar until the Início (P8) (§5.15) |
| S25 | «Ver o histórico em Análises», «Abrir Análises» | Análises exists | the menu's «Análises» is the old `/analytics` until P6 | hidden until P6 |
| S26 | «Seg»…«Sex» + «Semana» | Mon–Fri for every account | Cripto windows every day, day at midnight Brasília (weekend trading days by design); binaries also on the Brasília calendar day; futures/Forex/Ações Sunday evening belongs to Monday | Q6 |
| S27 | «O pregão de futuros vai das 18:00 da véspera às 17:00 ET.» | futures clock | the account's own day clock (futures 18:00 NY, Forex 17:00 NY, Ações 20:00 NY, binárias/Cripto/B3 midnight Brasília; a Phase 1 backfill account may keep midnight Brasília) | ADAPTED sentence per clock |
| S28 | «Resultados do arquivo da corretora, sem custos.» | results only from files | results computed by the server from prices (`pnl_basis` prices/estimate/typed/outcome/file); commission from the file when it comes | ADAPTED (Q4) |
| S29 | «Exportar CSV» «Com estado, “Posso operar hoje?”, viés e regra.» | an export | none built; state and bias are P5 | out of Phase 4 (default §5.16) |
| S30 | «feriado nos EUA: Ação de Graças», «Sexta com sessão curta até 13:15 ET» | a holiday source | none exists; B3 and US calendars differ; Cripto has none | Q9 |
| S31 | Hard-coded «· ▨ comparação suspensa, 09:55–10:30 (ISM)» (l.566), «Leitura da semana · … 27 nov …» (l.654), «salvo em 28 nov» (l.657), «… sai na sexta, 16 out, às 17:30 ET.» (H l.574) | prototype | — | computed or hidden |
| S32 | Nav «Social» / «AI» / «Conquistas» → `#topo` | links | «em breve», no link | as built |
| S33 | Two labels for one field: «O que faria diferente?» (read) vs «O que você faria diferente?» (form) | — | — | one label: «O que você faria diferente?» |
| S34 | `infos.ops` lists «o seu viés, a regra do estado, o que a tela dizia» | all in the drill | P5 | ADAPTED text (§7.4) |

---

## 4. What belongs to later phases

| Element (location) | Phase | Proposal for Phase 4 (Q1 recommendation) |
|---|---|---|
| «Linha do tempo» (D l.384–540) | P5 (plan: «A linha do tempo fica marcada "chega na Fase 5"»; appendix §E budgets ~2 days of rework in P5) | **placeholder card** (§7.4: «Linha do tempo» + «Chega na Fase 5, com o estado do mercado ao longo do dia.») on every journal day, in every market (the same words everywhere) |
| «Estado na entrada» column, chips, «comparação suspensa», «não gravado» | P5 | hidden (column dropped, as the bridge does) |
| Drill «O que a tela dizia às …», «preços até …», «Fundamentos», «Técnica» | P5 | hidden |
| «Seu viés» (plan row, drill fact), «Viés marcado antes» (week tile), «⚑» | P5 (`bias_marks`) | hidden |
| «Bloqueio» row, «no bloqueio», block band, «Aguardar até 10:10» from a block | P5, futures only | hidden; one muted line on futures accounts (below) |
| «Regra do estado» row, drill «Regra», «contra a regra», «Você seguiu o seu texto?», self-assessment box | P5, futures only | hidden; same muted line |
| Day tags «ISM industrial, 10:00», «CPI de setembro, 08:30» | P5 (`economic_events`) | hidden |
| «Escrita pela IA às …», «Resumo do dia · escrito pela IA …», «Leitura da semana · escrita pela IA …», «◆ IA», `infos.ia` | P8 (needs the scheduler, model and budget decisions) | hidden, no placeholder |
| «Métricas e gráficos ficam em Análises» card, «Ver o histórico em Análises» | P6 | hidden until Análises exists |
| «Seu foco da próxima semana» with `claim_key` | P7 (Padrões) or Phase 4 as free text | Q5 |
| Breakeven verdict «BE no ponto» / «BE cedo» / «BE tarde» / «Não moveu» (3c `regra.md` §4.6) | P4 or P6 (the tolerance is a P6 decision) | Q8 |
| «Exportar CSV» | P6/P9 | out of Phase 4 |
| «Confirmada» / «Pouco fundamentada» (marks info, built Registrar copy) | P7 | stays as built in the Registrar; the Diário's marks ⓘ reuses `FECHADA.marcasInfo` |

Futures accounts' muted line in «O plano do dia» (NEW, ADAPTED from the built «O bloqueio de dados fica ativo na Fase 5»):
«Bloqueio de dados, viés e regra do estado chegam na Fase 5.» Other markets have none of the three and show nothing.

---

## 5. What is missing (NEW on both boards)

### 5.1 Open trades
A row with «aberta» (muted, no result), the bridge's second line («1 parcial, +US$ 40,00 · stop no breakeven»), action
«Registrar saída» (price markets) / «Registrar resultado» (binary) opening the Registrar sheet on it; the drill shows what
is known (entry, stop, partials, marks) and no «Entrada → saída». Tiles: «Operações» «3 · 1 aberta»; «Resultado» counts
realized money only (partials included). An open trade of an earlier day stays on its entry trading day (Phase 3
decision: «Operação aberta de ontem conta no dia em que abriu»); today's day shows a NEW line «1 operação aberta de
ontem: MNQ · Compra · 1 ct.» with a link to that day.

### 5.2 Binaries (Ebinex)
Row «20:10–20:12 · EUR/USD · Alta · 1 min · +US$ 17,60 · No plano»; open: «20:31 · GBP/USD · Baixa · 5 min · aberta» + «Vence
às 20:40.» + «Registrar resultado»; refunded «US$ 0,00 · devolvida». Drill «Sua operação»: «Hora» «20:10 · vela 20:11–20:12
de Brasília»; «Stake · payout» «US$ 20 · payout 88%»; «Como terminou?» «Ganho» / «Perda» / «Devolvida» (the Registrar's
words, `components/hub/registrar/copy.ts` `EBINEX`); no «Stop · alvo», no partials, no breakeven. Times on Brasília («de Brasília» suffix), window «Janela 20:00–21:00 ·
Brasília», day at midnight Brasília. Tiles: «Operações» «4» + «2 ganhos, 1 perda, 1 devolvida». Data: `trades.stake_amount`,
`payout_percent`, `timeframe`, `duration_seconds`, `expires_at`, `result`.

### 5.3 Partial exits, stop moves, R (3c)
Drill block «Linha do tempo da operação» (ADAPTED name: the built Registrar block is «Linha do tempo», which would clash with
the day's «Linha do tempo»), reusing the Registrar's items (`components/hub/registrar/copyParciais.ts` `TEMPO`): «Entrada · 3
ct a 7.912,50 · stop 10 pts», «Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00» (+ «registrada às 10:20»), «Stop no
breakeven · 7.912,50 · com +8,00 pts a favor», «Stop movido · 7.915,00 · com +11,00 pts a favor», «Saída · 2 ct a 7.931,00 ·
+18,50 pts · +US$ 185,00», «1ª saída · …» (file rows), «Stop no breakeven · com +12,00 pts a favor · registrado depois»
(«Já fechada»). Facts: «Saída média» «7.927,50 · em 2 saídas»; «R» «+1,8 R · com stop de 10 pts» (built `FECHADA.r`,
`comStop`; only with an initial stop). Undone events are not listed. «Desfazer» stays in the Registrar (15 min).

### 5.4 «Já fechada» and typed entry hours
Chip «Registrada depois» on the row (NEW), drill line «Registrada às 18:02, depois do resultado: as marcas contam como
depois do resultado.» (NEW). Typed hour: «Hora» «10:04–10:06» + «registrada às 10:09» (NEW, from `registered_at` when it
differs from `entry_time` by a minute or more).

### 5.5 File-only trades inside the journal, and trades the file completed
- File-only (imported after v1, no app registration): chip «Do arquivo» (NEW); plan computed on read with the version in
  force, ⓘ line «Sem registro no app: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.» (NEW,
  ADAPTED from `infos.grava`); no stop/target («não anotados»), marks editable or not per Q2.
- Completed by the file (`trade_import_links`): drill line «Completada pelo arquivo de 22 out: comissão US$ 2,48.» (NEW);
  when the file disagreed on money (`differs`): «O arquivo corrigiu o preço de saída: 7.955,75 → 7.956,00.» (NEW; decision 2
  of Phase 3: the file wins on money, hours and marks stay); the broker's own instants when they differ by a minute or
  more: «Na corretora: 10:04:31–10:06:12.» (NEW, `file_entry_at` / `file_exit_at`).
- A day that mixes history and journal (v1 saved during the day): trades before `effective_from` keep «Histórico importado
  · só resultado» in the «Plano» column; the day is a journal day (NEW edge, scenario 4).

### 5.6 Several windows, versions changing during the day
Plan row «Janela» «10:00–11:00 e 14:00–15:00 ET»; when the version changed during the day: «Janela» «10:00–11:00 ET até 10:15
· 10:00–11:30 ET depois (versão 4)» (NEW). Each trade is judged by its own version (`rule_version_id`).

### 5.7 Limit variants
«Sem limite»: tile «Limite do dia» «sem limite» (no bar), plan row «Limite» «sem limite» · «Sem regra» (NEW). «Só avisar»: plan
«US$ 400 · só avisa» (ADAPTED from «encerra o dia no app»); a trade after the limit is still «● depois do limite».
«Somando»: tile sub «pior momento · somando as contas de Futuros» and ⓘ «Com “somando as contas de Futuros”, o pior momento
inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você arquivar uma delas, ela sai
da soma, também nos dias passados.» (NEW: `limit_usage` scopes by `archived_at is null` now). B3: «R$ 120,00 de R$ 300».

### 5.8 Weekends and currencies
Cripto (and Ebinex if its trades fall on weekends) need Saturday/Sunday cells (Q6). B3: «Toque num dia para abrir. Valores em
R$.»; aria «… reais …» (ADAPTED). Cripto: «Valores em US$ (USDT e USDC contam como dólar).» (ADAPTED, the built rule).

### 5.9 Calendar details the boards leave open
- Quartiles: of the account's journal days' results shown in the calendar's range, gains and losses apart (gains 1–4 by the
  quartiles of positive days, losses likewise); history days quartiled on their own (NEW rule; the board says only «quartis
  do resultado diário»).
- Range: from the first month with any trade of the account (history included) to the current month; «Hoje» = the account's
  trading day now (`rules_now`).
- Keyboard: the board tabs through every day button (≈ 22 per month); proposal in §7.5.
- Week cells open the week (Q10).

### 5.10 Images: a large view
Tapping a thumbnail opens a dialog with the image at full width, its name and «Fechar» (NEW: «MES_10-04_entrada.png · 840 KB»,
«Imagem 1 de 2», «Anterior» / «Próxima»). Thumbnails use a short-lived signed read URL. «Editar imagens e nota» (built
`ANEXOS.editarAria`) opens the editor inline in the drill (the Registrar's `useAnexos` + `ImagensENota`; not the sheet,
whose «Operação fechada» would show «—» for a file-only trade: `sintese.md` C20); «Adicionar imagens ou nota» kept for trades
with none.

### 5.11 Deleted registered trades
`trade_deletions` keeps the time of every deleted registered trade, with `via` = `apagada` (old page) or `desfazer_entrada`
(the Registrar's 15-minute undo). A muted day line «1 operação registrada foi apagada às 10:20.» (NEW), only for `apagada`,
keeps the evidence honest without values; data from `diario_dia.deleted` (`banco_dominio.md` §5.2).

### 5.12 «Antes de operar» and the week focus
No board draws where they are written; the old `/premarket` page writes `trading_sessions.premarket_notes` per date (no
account). Q5.

### 5.13 States without data
- Account without rule version 1: «Esta conta ainda não tem regras. Até você salvar as regras em Personalizar, as operações
  importadas ficam em Histórico importado · só resultado.» + «Definir as regras» (NEW, ADAPTED from the built
  `personalizar/copy.ts` «Até salvar, …»).
- Account without trades: calendar empty, day «Nenhuma operação neste dia.» (NEW), today «Nenhuma operação registrada hoje.»
  (built bridge string) + «Registrar operação».
- No account: the built empty state of the header (`DiarioCabecalho`).
- Loading «Carregando…» (built `LOADING`); error «Não foi possível carregar o Diário.» + «Tentar de novo» (NEW / built
  `TRY_AGAIN`); offline «Sem conexão. Tente de novo quando a conexão voltar.» (built bridge string).
- Review save offline «Sem conexão. A revisão não foi salva.» (NEW); the form keeps what was typed.

### 5.14 Deep link and «Ver no Diário»
`/diario?conta=…&dia=2026-11-10` opens that day; `&op=<trade>` also opens its drill and focuses its row (NEW). The Registrar's
«Ver no Diário» (built, today focuses the bridge's heading) goes to the trade's day and row.

### 5.15 Where the «Posso operar hoje?» card goes
Board: absent. Built: under the header. Default: keep it there (compact) until the Início (P8) takes it; it shows every
account's line, while the rest of the page is one account.

### 5.16 Old pages
Plan test: «Seus dias reais; depois, /trades passa a abrir /diario.» A redirect `/trades` → `/diario` (NEW). The old page is
today the only way to edit a trade's fields or delete a trade older than 15 minutes (Phase 3 decision 3 «a página antiga
Operações continua apagando»). Q3.

---

## 6. Data map

| What the Diário shows | Source | Status |
|---|---|---|
| Accounts, current account, window line | `trading_accounts`, `profiles.preferences`, `rules_now` | exists |
| «Diário desde …» | `account_rule_versions` v1 `effective_from` | exists |
| Today, server now, today's gate | `rules_now`, `gate_at` | exists |
| Day of a trade | `trades.trading_day` (`compute_trading_day`) | exists |
| Trade fields, note | `trades` (`TRADE_COLUMNS`) | exists |
| Plan of an app trade | `trade_entry_context` + `trade_entry_plan` | exists |
| Plan of a file-only trade after v1 | `evaluatePlan` (TS mirror) or `gate_at` per instant, with the day's trades | exists (computed on read) |
| History before v1 | v1 `effective_from` | exists |
| Exits, stop moves, R, breakeven rule of the trade | `trade_exits_v`, `trade_stop_moves_v`, `trade_r_of`, `trade_breakeven` | exists |
| Marks, «limpa», changed after | `trade_marks_v`, `trade_marks_now_v`; write `add_marks` | exists |
| Images | `trade_attachments` + bucket `trade-images` (signed read URL); write `image_slots` + `save_extras` | exists |
| Import of a day, file corrections | `import_batches`, `trade_import_links` | exists |
| Deleted registered trades | `trade_deletions` | exists |
| Limit worst point and hit | `limit_usage(account, day, soma, limit, until)` | exists |
| Month (calendar sums + the open day) | `diario_mes(account, month)` → one `jsonb` | **NEW** |
| Review, «Do pregão anterior», pending reviews | `day_reviews` | **NEW** |
| «Antes de operar» | `day_reviews.before_text` + `before_saved_at`, or its own table | **NEW** (Q5) |
| Week focus | `weekly_focus` | **NEW** (Q5) |
| Holidays | static list per exchange | **NEW** (Q9) |
| State, bias, events, «o que a tela dizia» | `market_states`, `bias_marks`, `economic_events`, `trade_entry_context.screen` | P5 |
| AI texts | `ai_readings` | P8 |

All reads run in the browser with the user's session (row-level security) or through `SECURITY DEFINER` functions keyed on
`auth.uid()`; nothing private is rendered on the server (CLAUDE.md "Auth and access").

---

## 7. Proposed board revision

### 7.1 Principles
- Update the existing canvas artifact (memory: «Update that canvas; do not create a new one»); keep both files as the base,
  one template, many scenarios, as the Registrar and ImportarConta boards did.
- Keep the lean board's rules: one message per card, explanations behind ⓘ, honesty lines visible («conta simples, não é o
  que teria acontecido», «pela sua resposta, depois do resultado»).
- Phase 5/8 parts hidden except the timeline placeholder and the futures line (Q1 a).
- Every string that already exists in the built app is reused as is (Registrar, bridge, Posso, contas copy).

### 7.2 What stays
Header and title row (+ date line); selector (built version) and «Seções da página»; pending-reviews banner; calendar
(month, navigation, cell anatomy, marks ● ■ ✓, hatch for history, today dot, open border, tooltip and aria pattern,
legend, mobile 5-column layout with the week as a row); the day heading and the four tiles; «Como ler os números do dia»;
«O plano do dia» with «Janela» and «Limite»; «Operações do dia» row and drill (facts, images and note, marks editor);
«Revisão do dia» (closed / form / saved / read / edit, «O diário registrou: …», «Do pregão anterior»); «Semana» tiles, bars
and «Fora do plano» list; «Como o diário grava»; the footer's «Apoio à decisão, não recomendação de investimento.»

### 7.3 Scenarios to draw (invented data)

Accounts (the approved Registrar board's examples plus one): Futuros «Top One» (Financiada, «Janela 10:00–11:00 ET», limit
US$ 400, «Encerrar o dia no app», por conta, breakeven MES +8 pts / MNQ +30 pts) and «Lucid 50k» (Avaliação, same window,
limit US$ 400 «somando as contas de Futuros»); Opções binárias «Ebinex» (Pessoal, «Janela 20:00–21:00 · Brasília», no
limit); Forex «FTMO»; Ações «IBKR»; Cripto «Binance» (every day, 20:00–22:00 Brasília); B3 «Clear» (10:00–11:00 Brasília,
R$ 300). Rules v1 of Top One from «quarta-feira, 14 de outubro, 09:12 ET». All numbers invented.

1. **Hoje, no meio da janela** · Top One · «quinta-feira, 12 de novembro, 10:42 ET». Posso card «Top One · Liberado · até 11:00
   ET». Trades: «10:04–10:11 · MES · Venda · 2 ct · +US$ 45,00 · No plano» (setup A «às 10:04 · antes da saída»); «10:18 · MES ·
   Compra · 3 ct · aberta» + «1 parcial, +US$ 40,00 · stop no breakeven» + «Registrar saída». Tiles «Resultado» «+US$ 85,00»
   (realized), «Operações» «2 · 1 aberta», «Limite do dia» «nenhuma perda acumulada», «Fora do plano» «nenhuma». Plan
   «Janela» «10:00–11:00 ET» · «2 de 2 dentro»; «Limite» «US$ 400 · encerra o dia» · «pior momento: US$ 0»; futures line.
   Timeline placeholder. «Antes de operar» field (if Q5 a) saved «anotado às 09:40, antes da 1ª entrada». Review «Escrever
   revisão». Shows: open trade, partial, the placeholder, the Posso card's place.
2. **Um dia completo** · Top One · «terça-feira, 10 de novembro», opened from the calendar on a later day: five trades —
   (a) live «10:03–10:09 · MES · Venda · 2 ct · +US$ 82,50 · No plano» with 2 images and a note, marks before the exit and one
   changed after («antes: B às 10:04 · agora: C às 11:20»); (b) «10:14–10:41 · MES · Compra · 3 ct · +US$ 225,00 · em 2 saídas»
   with a breakeven move and R «+1,5 R»; (c) «Já fechada» «10:22–10:30 · MNQ · Venda · 1 ct · −US$ 61,00» chip «Registrada
   depois»; (d) file-only «11:20–11:26 · MES · Compra · 1 ct · −US$ 31,25 · ● fora da janela» chip «Do arquivo»; (e) live and
   completed by the file, «O arquivo corrigiu o preço de saída: …», commission shown (Q4). Review saved with «Do pregão
   anterior». One deleted line «1 operação registrada foi apagada às 10:20.» Shows: every trade kind of 1–3c in one day.
3. **Limite atingido** · Top One · «quinta-feira, 19 de novembro» (the B board's day without P5): five losses, the last one
   after the limit; tag «Limite atingido às 10:38», tile «US$ 453,00 de US$ 400 · pior momento · atingido às 10:38» (red bar), «10:52–10:57 · MES · Venda ·
   1 ct · −US$ 37,50 · ● depois do limite», drill «Posso operar hoje?» «Encerrado por hoje» + note ADAPTED (§7.4). Variant
   panel: the same with «Só avisar» («Pelas suas regras, é só um aviso.»; the trade still «● depois do limite»).
4. **Calendário: histórico, início das regras, revisões pendentes, feriado** · Top One · Outubro and Novembro: 1–13 out
   hatched «Histórico importado · só resultado»; 14 out mixed day (one trade at 08:50 before v1, «Histórico importado · só
   resultado» in its row); week 12–16 out with «▨ +21,25»; banner «3 pregões sem revisão, 2 nas últimas 4 semanas»;
   Novembro with «26 nov · feriado nos EUA: Ação de Graças» (Q9 a) and «sem op.» days. Phone frame of the same month.
5. **Um dia do histórico** · Top One · «quinta-feira, 8 de outubro»: «Histórico importado · só resultado» note, tiles «—»,
   rows with hours (no «—»), no plan, drill «Sua operação» with «Pontos» only (+ images/note per Q2).
6. **Ebinex** · «quarta-feira, 11 de novembro, 21:20 de Brasília»: «20:10–20:12 · EUR/USD · Alta · 1 min · +US$ 17,60 · No
   plano»; «20:31–20:40 · GBP/USD · Baixa · 5 min · US$ 0,00 · devolvida»; «21:12 · EUR/USD · Baixa · 15 min · aberta» + «Vence às
   21:30.» + «Registrar resultado» + «● fora da janela»; drill of the first (§5.2), plan «Janela 20:00–21:00 · Brasília» · «Limite»
   «sem limite» (§5.7; the built Registrar notes that the owner's Ebinex has no limit), calendar on Brasília, «Linha do tempo» placeholder, no futures line.
7. **Cripto com fim de semana** · Binance: calendar with «Sáb» «Dom» columns (Q6 a), a Saturday trade «BTC/USDT · Venda · 0,25
   BTC», «Valores em US$ (USDT e USDC contam como dólar).»
8. **B3 em reais** · Clear: «WIN · Venda · 3 ct · −R$ 180,00», tile «R$ 180,00 de R$ 300», «Valores em R$.», aria «reais».
9. **Somando as contas de Futuros** · Lucid 50k: tile «US$ 245,00 de US$ 400 · pior momento · somando as contas de Futuros»,
   its ⓘ line, and the selector open with two futures accounts and «Contas de mercados diferentes nunca são somadas.»
10. **Estados sem dados** (one frame, four panels): account without rules; account without trades; loading; error with
    «Tentar de novo» and offline.
11. **Semana** · two panels: a closed week (Top One 23–27 nov: tiles «Resultado», «Operações», «Fora do plano», and in place
    of «Viés marcado antes» «Revisões» «4 de 4» — NEW, ADAPTED), bars, «Fora do plano» list, focus (Q5); and the week in
    progress «Semana em andamento · 2 de 5 pregões» (NEW).
12. **Celular, 375 px, claro e escuro**: the day of scenario 2 with the drill of (b) open, the image dialog, the review
    form, and the calendar month; the same day in «escuro».

### 7.4 Strings to change or add (board → revision)

| Where | Board (STALE) | Revision |
|---|---|---|
| Date line (D l.221, `D.dataCurta` «terça-feira, 1º de dezembro, 11:35 ET») | drawn, not built | **ADAPTED** to the account's window clock: «quinta-feira, 12 de novembro, 10:42 ET» / «… 20:48 de Brasília» |
| Selector note (l.233) | «Futuros e binárias nunca são somados.» | «Contas de mercados diferentes nunca são somadas.» (built) |
| `infos.conta` | «… binárias e futuros, por isso as duas contas nunca se somam.» | removed with the Ebinex card |
| Top line (l.260) | «Diário desde 14 out: 106 operações com estado, em 31 pregões · 269 importadas antes, só resultado» | **ADAPTED** «Diário desde 14 out: 106 operações em 31 pregões · 269 antes, em Histórico importado · só resultado» |
| Strip, time-zone card, Ebinex card | (l.248–259, 263–273, 239–246) | removed |
| Calendar line (l.294) | «Toque num dia para abrir. Valores em US$.» | per currency: «… Valores em US$.» / «… Valores em R$.» / «… Valores em US$ (USDT e USDC contam como dólar).» |
| Cell aria (l.704) | «…, +2,00 dólares, …» | «…, +2,00 dólares, …» / «…, −180,00 reais, …» |
| Tooltip / tag of history | «importado, só resultado» / «Importado em 13 out» | «Histórico importado · só resultado» / tag «Histórico importado · 13 out» |
| History note (l.348) | «Antes do diário: sem plano gravado, só o que o arquivo trouxe.» | **ADAPTED** «Antes das suas regras: sem plano, só o que o arquivo trouxe.» |
| `infoResumo` imported | «Dia importado: o diário ainda não existia, …» | **ADAPTED** «Antes da primeira versão das suas regras não há janela, limite nem plano: só o que o arquivo da corretora trouxe.» |
| `infos.cal` day clock | «O pregão de futuros vai das 18:00 da véspera às 17:00 ET.» | kept on a futures account on the 18:00 NY clock; **ADAPTED** from the account's own day clock otherwise: «O pregão desta conta vai das 17:00 da véspera às 17:00 ET.» (Forex), «O pregão desta conta vai das 20:00 da véspera às 20:00 ET.» (Ações), «O pregão desta conta vai da meia-noite à meia-noite de Brasília.» (binárias, Cripto, B3, and any account on that clock) |
| `infos.cal` hatch | «Hachurado: importado do arquivo, só com resultado, nunca somado ao diário.» | «Hachurado: Histórico importado, antes das suas regras, só com resultado, nunca somado ao diário.» |
| `infos.cal` week | «A coluna Semana soma só o diário; o importado aparece à parte, com ▨.» | «A coluna Semana soma só o diário; o histórico aparece à parte, com ▨.» |
| Legend | «▨ importado · fuso a confirmar» | «▨ histórico importado» |
| `infoResumo` limit | «Limite do dia: a maior perda acumulada no pregão, no pior momento, contra o seu limite de US$ 400. Quando é atingido, o app encerra o dia.» | **ADAPTED** «Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia.» / «… ao atingir o limite o app só avisa.»; with «somando»: «… contra o seu limite de US$ 400, somando as contas de Futuros. …» |
| Plan «Limite» | «US$ 400» (plan column) and `infos.plano` «O limite de US$ 400 encerra o dia no app.» | «US$ 400 · encerra o dia» / «US$ 400 · só avisa» / «sem limite» |
| `infos.plano` | (whole text) | **ADAPTED** «Cada linha compara as regras que valiam neste dia, em Personalizar, com o que o diário registrou: janela e limite. Uma operação fora da janela ou depois do limite fica fora do plano, mesmo quando a tela só avisava.» (+ futures: «Bloqueio de dados, viés e regra do estado chegam na Fase 5.») |
| Plan futures line | — | **NEW** «Bloqueio de dados, viés e regra do estado chegam na Fase 5.» |
| Timeline (l.384–540) | the SVG and list | **NEW** H3 «Linha do tempo» + chip «chega na Fase 5» + «Chega na Fase 5, com o estado do mercado ao longo do dia.» |
| Table headers | «Hora» · «Operação» · «Resultado» · «Estado na entrada» · «Plano» · «Detalhes» | «Hora» · «Operação» · «Resultado» · «Plano» · «Detalhes» (built bridge set + «Detalhes») |
| `infos.ops` | (whole text) | **ADAPTED** «Abra ▾ para ver as saídas, os preços e os pontos, o stop e o alvo, os movimentos do stop, a hora de cada marca (antes da saída ou depois do resultado), as suas imagens e nota (clipe na linha) e o “Posso operar hoje?” na entrada. Plano: “No plano” ou ● com o motivo (fora da janela ou depois do limite).» |
| Gate note (19 nov) | «A tela mostrava “Encerrado por hoje” desde 10:38. As vendas anteriores foram registradas durante o pregão, então o limite já estava na conta.» | **ADAPTED** «Na entrada, o “Posso operar hoje?” dizia “Encerrado por hoje” desde 10:38: as operações anteriores já estavam registradas.» |
| Row chips | — | **NEW** «Registrada depois», «Do arquivo» |
| Open row | — | «aberta», «Registrar saída», «Registrar resultado» (built) |
| Open trade of yesterday | — | **NEW** «1 operação aberta de ontem: MNQ · Compra · 1 ct.» |
| Drill facts | «Entrada → saída», «Stop · alvo» «… · às 10:30» | + «Saída média» «… · em 2 saídas», «R» «+1,5 R · com stop de 10 pts», «Comissão» «US$ 4,96», «registrada às 10:09» |
| Drill trade timeline | — | **ADAPTED** «Linha do tempo da operação» + the built `TEMPO` items |
| Drill «Já fechada» | — | **NEW** «Registrada às 18:02, depois do resultado: as marcas contam como depois do resultado.» |
| Drill file | — | **NEW** «Completada pelo arquivo de 22 out: comissão US$ 2,48.», «O arquivo corrigiu o preço de saída: 7.955,75 → 7.956,00.», «Na corretora: 10:04:31–10:06:12.», «Sem registro no app: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.» |
| Drill binary | — | **NEW** «Stake · payout» «US$ 20 · payout 88%», «Hora» «20:10 · vela 20:11–20:12 de Brasília», «Como terminou?» «Ganho» |
| Images | placeholder + «exemplo», «Adicionar imagens ou nota» | real thumbnails; «Editar imagens e nota» (built aria) when there are some; «Adicionar imagens ou nota» otherwise; both open the editor inline in the drill; dialog «Imagem 1 de 2» «Anterior» «Próxima» «Fechar» (NEW) |
| Marks history | «agora, 11:35 ET · depois do resultado» | built «antes: B às 10:04 · agora: C às 11:20» / «(desmarcada às 11:20)»; status «Setup C, às 11:20, depois do resultado.» (built `MARCAS.anuncio`) |
| Deleted line | — | **NEW** «1 operação registrada foi apagada às 10:20.» / «2 operações registradas foram apagadas.» |
| Limit «somando» | — | **NEW** «pior momento · somando as contas de Futuros», ⓘ «Com “somando as contas de Futuros”, o pior momento inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você arquivar uma delas, ela sai da soma, também nos dias passados.» |
| Review read label | «O que faria diferente?» | «O que você faria diferente?» |
| Review offline | — | **NEW** «Sem conexão. A revisão não foi salva.» |
| «O diário registrou» | «… · nenhuma contra a regra do estado · … · viés marcado antes das 4» | only Phase 4 facts: «4 operações · 1 fora da janela, às 11:09 · limite: US$ 45 de US$ 400 no pior momento» |
| Week empty (H l.574) | «A revisão da primeira semana sai na sexta, 16 out, às 17:30 ET.» | **NEW** «Semana em andamento · 2 de 5 pregões» |
| Week tile | «Viés marcado antes» «11 de 12» | **ADAPTED** «Revisões» «4 de 4» |
| `infos.semana` | (holiday, short session, bias, AI) | **ADAPTED** «Pregões de 23 a 27 de novembro. Quinta, 26 nov: feriado nos EUA. Fora do plano: fora da janela ou depois do limite. A coluna Semana do calendário traz os mesmos números.» |
| Week focus | «Seu foco da próxima semana · salvo em 28 nov» | per Q5: field «Seu foco da próxima semana» + «Salvar» → «salvo em 28 nov» |
| Footer | «Resultados do arquivo da corretora, sem custos.» | per Q4 (a): «Resultados brutos: registrados por você ou do arquivo da corretora; a comissão aparece quando o arquivo a traz.» |
| Footer | «Exportar CSV» + «Com estado, “Posso operar hoje?”, viés e regra.» | removed (later phase) |
| `infos.grava` | (whole text) | **ADAPTED** «Um pregão de cada vez: o que você planejou, o que você fez e a sua revisão. Cada operação registrada guarda o “Posso operar hoje?” da entrada, com a hora do servidor; as que chegam só pelo arquivo têm o “Posso operar hoje?” recalculado, e a operação mostra isso. As marcas guardam a hora: as de antes da saída contam como limpas.» |
| Placeholder retired | «O Diário chega na Fase 4.» «Até lá, suas operações continuam na página Operações.» «Abrir Operações» | removed; the bridge's copy «… até a Fase 4» retired |
| Error | — | **NEW** «Não foi possível carregar o Diário.» + «Tentar de novo» (built) |
| No rules | — | **NEW** «Esta conta ainda não tem regras. Até você salvar as regras em Personalizar, as operações importadas ficam em Histórico importado · só resultado.» + «Definir as regras» |
| Empty day | — | **NEW** «Nenhuma operação neste dia.»; today «Nenhuma operação registrada hoje.» (built) |

### 7.5 Accessibility and layout

- **Widths.** 375 px: one column, 16 px side gutters, tiles 1 per row (≤ 520), calendar 5 (or 7) columns with the week as a
  full row under each week, results shortened («+132»), tooltips off (their content stays in the aria-label), table rows as
  cards, drill one column, review fields stacked. 768 px: tiles 2 per row, rows as 4-column cards (board ≤ 980 rule), one
  month. Desktop: max-width 1152 px, tiles 4, table grid, drill 2 columns. A 7-column calendar (Q6 a) needs its own phone
  layout: at 375 px with 16 px gutters and the card's 16 px padding a cell is (311 − 24) / 7 ≈ 41 px wide, under 44; drop
  the card's side padding around the grid on phones (≈ 45 px) and keep only the number and «+2».
- **Both themes.** Tokens are the built `hub.css` ones (identical to the boards'). The calendar's fixed fills (7/15/72/90 %)
  and dark text (#26301F / #3A0F0F) on levels 3–4 must be rechecked on `#17191A`; the amber `--amber-bg` in claro is
  `rgba(0,0,0,0.20)` (verify amber text ≥ 4.5:1 on it and on `--inset`). Draw scenario 12 in both themes.
- **44 px.** Every button and link is ≥ 44 px (the board's `.btn`, row ▾, section links); the 26 px ⓘ keeps its 44 px hit area
  (`::after` inset −9 px, as the built `InfoButton`). Calendar cells ≥ 44 × 44 at 375 px (58 px tall on the board).
- **Keyboard.** Calendar: one tab stop per month (roving tabindex on the open day), arrows move by day, Home/End to the
  week's edges, PageUp/PageDown change the month, Enter opens the day (NEW; the board tabs through every cell). Week cells
  become buttons if Q10 a. Escape closes the account list and the image dialog, focus returns to the opener. Opening a day
  announces «Aberto abaixo: …» (board) and moves nothing; «Ver no Diário» focuses the trade's row.
- **Screen readers.** Week bars are aria-hidden on the board: add a visually hidden list «seg, +131,50 · ter, −60,50 …»;
  marks ● ■ ✓ stay in the cell's aria; the paperclip keeps «tem imagens e nota»; the drill region is labelled by its row;
  mark saves announce the built `MARCAS.anuncio`; the review save announces «Revisão salva às 11:35 ET.»
- **Motion.** The calendar's entrance and hover zoom stay off with reduced motion (board rule).
- **Never colour alone.** Results keep their sign; plan breaks keep their words; the history hatch has «▨» and the aria
  «importado» → «Histórico importado».

---

## Open questions for the owner

**Q1. Phase 5 and 8 pieces on the Phase 4 Diário.** The boards draw the market state, «O que a tela dizia», your bias, the
data block, the state rule, «Você seguiu o seu texto?» and AI texts, none of which exists before Phase 5 or 8.
- (a) Draw only the timeline as a placeholder («Linha do tempo · chega na Fase 5», as the plan says) and one line on futures
  accounts, «Bloqueio de dados, viés e regra do estado chegam na Fase 5.»; hide everything else, as Phases 2 and 3 did.
  **(Recommended)**
- (b) A placeholder in each place («O que a tela dizia chega na Fase 5.», «Seu viés · chega na Fase 5», …).
- (c) Build a partial timeline now from what exists (window, the «Posso operar hoje?» band computed from your rules, the
  trades as bars, the limit hit), with the market-state rows «chega na Fase 5»: about 1.5–2 days more now, less in Phase 5.

Why (a): the plan budgets the timeline's rework in Phase 5, and a screen full of "later" lines hides the parts that work.

**Q2. Imported trades in the Diário: marks, images and note?** The database already accepts them on any trade.
- (a) Trades imported after your rules started (they are part of the journal day) get the marks editor, images and note like
  any trade, with every mark «depois do resultado»; the history before the rules stays read-only, as the board draws.
  **(Recommended)**
- (b) Every imported trade read-only (the board's rule for imported days).
- (c) Everything editable, the history included.

Why (a): a day you forgot to register should not be a second-class day, and «depois do resultado» keeps the evidence honest;
the history stays «só resultado».

**Q3. When `/trades` opens `/diario`, what replaces the old page's edit and delete?** Today it is the only way to delete a
trade after the Registrar's 15 minutes or to fix a wrong price.
- (a) In the trade's details: «Apagar operação» (with confirmation; the app keeps only the date and time, as decided in
  Phase 3) and «Corrigir valores» for money only (prices, quantity, result, costs), through the server; hours, stop, marks
  and the «Posso operar hoje?» of the entry never change. About 1–1.5 days more. **(Recommended)**
- (b) Only «Apagar operação»; a wrong price is fixed by the broker file or by deleting and registering again with «Já fechada»
  (the marks then count as after the result).
- (c) Keep `/trades` reachable until Phase 9 and redirect only the menu.

Why (a): it keeps what the old page allowed without letting the journal's times be rewritten; the file still wins on money.

**Q4. The day's result: gross or net of commission?** Top One's file brings the commission; app trades are gross until the
file arrives; the daily limit already counts net when the commission is known; the Análises plan shows Top One «bruto».
- (a) Gross everywhere in the Diário (calendar, tiles, rows), with the commission shown when the file brought it
  («Comissão US$ 4,96»); the limit tile keeps the limit's rule and says so. **(Recommended)**
- (b) Net when known, gross otherwise, with a «bruto» marker on days whose commission has not come yet.
- (c) Both, side by side.

Why (a): a gross number never changes when a file arrives, matches the broker's PnL and the Análises, and the limit stays
exactly as it works today.

**Q5. Where do «Antes de operar», «Levar para o próximo pregão» and the week focus get written?** The boards show them but draw
no place to write the first and the last; the old Pré-mercado page writes a pre-session note per date, with no account.
- (a) «Antes de operar» as a short field on today's day (saved with the server time: «anotado às 09:40, antes da 1ª
  entrada»); «Levar para o próximo pregão» from the review, as drawn; «Seu foco da próxima semana» as a free-text field in the
  week card, from Friday's close; the old pre-session notes copied once into the matching days (how, in Q7).
  **(Recommended)**
- (b) Only the review fields now; «Antes de operar» and the focus wait for Padrões (Phase 7), which picks the focus from a
  pattern.
- (c) Keep writing the pre-session note on the old page until Phase 9 and only show it in the Diário.

**Q6. The calendar for markets that trade on weekends.** Cripto windows run every day, and binaries follow the calendar day in
Brasília; the plan says «Calendário seg–sex».
- (a) Mon–Fri as the plan, plus «Sáb» and «Dom» columns only for accounts whose window or trades include weekends.
  **(Recommended)**
- (b) Always Mon–Fri; weekend trades appear in the week's «Semana» cell as «fim de semana: +US$ 42,00» and open from there.
- (c) Seven columns for every account.

**Q7. One review per account, and the old notes.** The appendix allows a review without an account; the old Operações era
(`trading_sessions`) kept notes, lessons and «seguiu o plano» per date.
- (a) One review per account and trading day; the old notes copied as read-only «Anotação da página antiga» shown on that date
  in every account. **(Recommended)**
- (b) One review per date for all accounts of the same market.
- (c) Per account, and the old notes are not copied.

Why (a): you trade one account at a time, the rules and limit are per account, and the old notes have no account to belong
to.

**Q8. Breakeven in the day.** Phase 3c records the stop moves and your rule «+N pontos» per asset; the verdict («no ponto»,
«cedo», «tarde», «não moveu») needs a tolerance that the 3c survey left to Análises.
- (a) The Diário shows the moves and your rule («Sua regra: breakeven com +8 pts»), without a verdict; the verdict comes with
  Análises (Phase 6). **(Recommended)**
- (b) A small mark next to «No plano» now («BE no ponto» / «BE cedo» / «BE tarde» / «Não moveu»), with a tolerance of one tick.

**Q9. Holidays.** The board names US holidays and a short Friday session; there is no source for them, and B3's calendar is
different.
- (a) A fixed list per exchange in the app (US: CME and NYSE holidays and early closes; B3), shown only on accounts of those
  markets and reviewed once a year; Cripto has none. **(Recommended)**
- (b) No holiday names until the economic calendar of Phase 5; such days just read «sem op.».
- (c) You mark holidays yourself.

**Q10. Which week the «Semana» card shows.** The board always shows the last closed week, whatever day is open.
- (a) The week of the open day; a tap on a week in the calendar opens it; the current week reads «Semana em andamento · 2 de 5
  pregões». **(Recommended)**
- (b) Always the last closed week, as drawn.

### If you say nothing, these defaults apply
- One account at a time, as the boards and the selector; no «all futures accounts» view (accounts of different markets are
  never summed; ask if you want one for Futuros).
- The «Posso operar hoje?» card stays under the header until the Início (Phase 8).
- «Exportar CSV» and the «Métricas e gráficos ficam em Análises» card wait for Análises (Phase 6).
- The quartile rule of §5.9, the deep link `?dia=` and «Ver no Diário» to the trade's row (§5.14), the image dialog (§5.10),
  the deleted-trade line (§5.11), «Registrada depois» and «Do arquivo» chips (§5.4–5.5), R and commission in the drill.
- `/trades` redirects to `/diario` after your test of real days (plan row 4), with the answer to Q3.
- Times in the account's window clock (as the bridge does), days always from `trading_day`.
