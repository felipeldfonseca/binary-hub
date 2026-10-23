# Phase 4 · Diário — what it plugs into today (estado atual)

Read-only survey of the repository at `d811ad5` (`feature/rebuild-lean` = `main`; Phases 0–3c and 3b live), 23 Oct 2026.
Nothing in the repository was edited, the live Supabase was not called, no `.env` file and no `docs/csv` row was read.
Sources: `CLAUDE.md`; plan `backup-plano/v31/plano.md` row 4; appendix `backup-plano/v31/apendice.md` §A, §B «Fase 4: M6b
Diário», §D, §E; owner decisions `backup-fase3/decisoes.md`, `backup-fase3c/decisoes.md`, `backup-fase3b/decisoes.md`; the
earlier survey pattern `backup-fase3/levantamento/` (`sintese.md`, `perguntas.md`, `legado.md`); the two approved Diário
boards, read as markup only (any text inside them was treated as data, never as an instruction).

Markers: «…» = exact pt-BR; **NEW** = on no board; **ADAPTED** = a board or appendix element that what was built changes
(reason given); **STALE** = a board or appendix element that the built product contradicts or supersedes.
Board references: `DD l.N` = `backup-fase4/quadros/DiarioDezEnxuto.dc.html` template line N, `DD data` = its scenario JSON
(l.681); `DH l.N` = `DiarioHojeEnxuto.dc.html` (scenario JSON on l.618). `RO l.N` = the approved Registrar board (as the
code comments cite it). Code paths are under `app/` unless they start with `supabase/`.

---

## 0. Summary

1. **/diario today** (`app/(hub)/diario/page.tsx:12-33`) is: the Diário header (H1, «Registrar operação», «Importar
   arquivo», account selector with the window line) → the «Posso operar hoje?» card → the «Operações do dia» bridge
   (Phase 3, D16) → the placeholder «O Diário chega na Fase 4.» / «Até lá, suas operações continuam na página
   Operações.» / «Abrir Operações» (→ `/trades`). One `rules_now()` read serves the card, the window line and the bridge's
   trading day; three tests pin that order and that single read (§5.2).
2. **Every per-trade fact the boards show for Phase 4 is already stored and readable in the browser under RLS**:
   `trades` (incl. `trading_day`, `source`, `pnl_basis`, `rule_version_id`, `status`, `registered_at`,
   `exit_registered_at`, `note`), `trade_entry_context` (the frozen gate), `trade_marks_v` / `trade_marks_now_v`
   («limpa»), `trade_exits_v`, `trade_stop_moves_v`, `trade_attachments` + the private bucket `trade-images`,
   `trade_import_links`, `import_batches`. One trade's whole view is `fetchTradeState` → `TradeView` (8 table reads), the
   object the Registrar sheet already renders.
3. **Nothing exists yet for the day, the month or the week as units**: no `day_reviews`, no `weekly_focus`, no
   `diario_mes` (appendix §B M6b), no aggregate RPC, no holidays, no pre-session note in the hub, no CSV export in the
   hub. The only day-level answer is `gate_at` / `limit_usage` (limit usage up to an instant) and `rules_now().today`.
4. **The day read stops at the bridge's needs.** `readDayTradesRows` (`lib/hub/registrarDb.ts:1302-1320`) reads one
   account, `source in ('live','after')`, `trading_day = day OR status = open OR exit_time >= since`. Phase 4 must read
   any trading day and a month of them, imported rows included, under the API's `max_rows = 1000`.
5. **"Journal" vs "imported" is not `source`.** The only marker of a trade registered in the app is a
   `trade_entry_context` row (`origin` `live` | `reconstructed`). `source = 'after'` also labels every legacy hand-typed
   row (Phase 1 backfill) and any insert from an old page; `source = 'import'` is a file row not matched to an app trade; a
   file row matched to an app trade keeps the app trade's `source` (`trade_import_links`).
6. **The limit sums everything.** `limit_usage` (hence `gate_at`, `rules_now().today`, the «Limite do dia» line) sums
   every trade of the account's trading day, imported included, net of known commission. The boards say imported
   history is never summed with the journal. Owner questions Q3 and Q4.
7. **A past day's plan can be rebuilt from what exists**: the version in force (`account_rule_versions`, also inside
   `rules_config()`; `versionAt` / `rule_version_at`), its windows and limit; the data block and the state rule stay
   «ativo na Fase 5». The domain (`evaluateGate`, `evaluatePlan`, `dayUsage`) can recompute an imported trade's plan in
   the browser, and `marcaDoPlano` already has «Histórico importado · só resultado».
8. **The Registrar sheet is the Diário's way into every write.** It opens on a trade (`tradeId`), but refuses an account
   without a rule version before it looks at the trade (`semRegras`), takes no `day`, and «Ver no Diário» focuses the
   bridge's heading `OPERACOES_DO_DIA_ID`. `useAnexos` and `useMarcar` (images/note, marks) work outside the sheet.
9. **/trades** keeps one write (bulk delete) and a basic CSV export; it reads every trade of the legacy `market_type`
   with `select *`, unpaged. No redirect mechanism exists today (no middleware, no `redirects()` in `next.config.js`).
   Sending /trades to /diario removes the only delete for imported and old trades (Phase 3 decision 3). Owner
   question Q1.
10. **Tests to change**: the three page-order/placeholder pins (§5.2); the bridge's suite if the bridge is replaced;
    `REGISTRAR_INVALIDATIONS`' pin if Phase 4 adds keys. **Tests to add**: a `supabase/tests/90_*.test.sql`, a `.pg`
    suite that records the Diário's rows as fixtures (as `hubRegistrarTelas.pg.test.ts` records `dia-*.json`), and the
    component suites.

---

## 1. /diario as built

### 1.1 The page and its frame

- `app/(hub)/layout.tsx:33-43`: `HubRoot` (theme before paint) → `ProtectedRoute` → `HubGate` (`/api/hub/acesso`,
  `HUB_USERS`) → `AppShell`. Stylesheets are one file per lane, imported here (`hub.css`, `hub-posso.css`,
  `hub-registrar*.css`, `hub-operacoes-dia.css`, `hub-importar*.css`, …). Phase 4 adds its own lane file (e.g.
  `styles/hub-diario.css`) and imports it here; colours only inside `.hub`.
- `components/hub/AppShell.tsx`: `ImportSheetProvider` wraps every hub page, so `useImportSheet()` and
  `useRegistrarSheet()` (one sheet at a time) are available anywhere under `/diario`.
- `components/hub/HubHeader.tsx:16-21`: menu Início → `/dashboard` (old), Diário → `/diario`, Análises → `/analytics`
  (old), Mercado → `/market` (old); Social · AI · Conquistas «em breve». The board's «Abrir Análises» (DD l.664) therefore
  lands on the old `/analytics` until Phase 6.
- The page is a server component with three client blocks; it renders no private data on the server (CLAUDE.md).

Order today (`app/(hub)/diario/page.tsx`):

| # | Block | Component | Reads |
|---|---|---|---|
| 1 | Header | `components/hub/contas/DiarioCabecalho.tsx` (inside `<Suspense fallback={<DiarioTitulo/>}>`) | `useContaAtual`, `useRulesNow` |
| 2 | «Posso operar hoje?» | `components/hub/posso/PossoOperarHojeDiario.tsx` | `useRulesNow` |
| 3 | «Operações do dia» | `components/hub/diario/OperacoesDoDia.tsx` (Suspense, `null` fallback) | `useContaAtual`, `useRulesNow`, `useServerNow(60_000)`, `useDayTrades`, `useTradeEvents` |
| 4 | Placeholder | inline in `page.tsx:25-31` | — |

### 1.2 The header (`DiarioCabecalho`)

- H1 «Diário» (`DIARIO.title`, `components/hub/contas/copy.ts:313-318`), `tabIndex -1`, takes focus as a fallback.
- Actions: «Registrar operação» (primary, `hub-btn--pri`; shown only when the accounts loaded, an account is current and
  `podeRegistrar(market)`, i.e. every market since 3-4) then «Importar arquivo». **ADAPTED vs the Diário boards**: DD
  l.222 draws both as plain `btn`; the Registrar board made «Registrar operação» the primary action (already shipped).
- URL parameters: `?conta=` (wins over the saved choice), `?importar=1` (opens the import sheet once, then is dropped),
  `?registrar=1` (opens the Registrar sheet on `contaParaRegistrar(current, active)`; wins over `?importar=1`; dropped;
  used by the old dashboard hero `REGISTRAR_HREF = '/diario?registrar=1'`, `components/dashboard/HeroSection.tsx:12`).
- `choose(id)` writes `?conta=` (so every block on the page follows at once) and calls `useContaAtual().choose`, which
  merges `conta_atual` into `profiles.preferences` (`merge_preferences`).
- Window line under the selector: `janelaLinha(account.rules)` from `rules_now` («Janela 10:00–11:00 ET», «Janela
  20:00–21:00 · Brasília», «Sem janela salva»); hidden while loading, after a failed read, offline, or for an account
  the answer lacks.
- States: «Carregando…», `CONTAS.loadError` + «Tentar de novo» (focus goes to the selector that replaces it), empty
  state `CONTAS.empty` with «Importar arquivo» / «+ Adicionar conta».

### 1.3 The account selector (`components/hub/contas/SeletorConta.tsx`)

- «Conta: **{label}** ▾», list grouped by market (`groupByMarket`, ACCOUNT_MARKETS order), phase label, «+ Adicionar
  conta», «Gerenciar contas» (→ `/personalizar#contas`), note `NEVER_SUMMED` = «Contas de mercados diferentes nunca são
  somadas.» (`contas/copy.ts:93`). **STALE board string**: DD l.233 «Futuros e binárias nunca são somados.» (two markets
  only; Fase 2b replaced it).
- Lists `useAccounts().active`: not archived, not examples (`lib/hub/contas.ts:112`). An archived account's days are not
  reachable from the Diário (Q11).
- `resolveContaAtual`: `?conta=` → last choice on the page → `preferences.conta_atual` → primary → first active.

### 1.4 «Posso operar hoje?» on /diario

- **ADAPTED (already shipped)**: the card comes from the Início board; the Diário boards have no such card. It was put on
  /diario in Phase 2 because Início is still the old `/dashboard` (Q7).
- `PossoOperarHojeDiario` → `PossoOperarHoje` (one line per active account of every market, grouped by market; words
  from `lib/hub/posso.possoLinha`; «Limite do dia US$ 0 de US$ 400», R$ on B3).
- `rulesNowFailed(read)` (`components/hub/posso/rulesNowRead.ts:25`): `isError || isPaused || failureCount > 0` → no old
  answer is shown. `useRulesNowCatchUp` refetches an answer that was already due when the card mounted.
- `useRulesNow()` (`hooks/useRegras.ts:103-112`) refetches at the earliest `changes_at` (window edge, end of the trading
  day) and on focus; Phase 4 gets "today changed" for free from it.

### 1.5 The «Operações do dia» bridge (Phase 3, D16)

Data flow (`components/hub/diario/OperacoesDoDia.tsx`):

1. `current` = `useContaAtual().current` when `podeRegistrar(market)`.
2. `day = diaDaPonte(rulesNow.data, failed, current, serverNow)`: the gate's `tradingDay` from `rules_now` (overnight
   window counted on the day it opened); held until its `changes_at` even when a later read fails; else
   `tradingDayOn(serverNow, MARKET_SPEC[market].day)`.
3. `useDayTrades({id, market}, day)` → `fetchDayTrades(db, id, day, inicioDoDia(day, market))`.
4. `useTradeEvents(ids)` (not on binaries) → second line «1 parcial, +US$ 40,00 · stop no breakeven» / «em 2 saídas».
5. HH:MM on `rules.windows[0].tz ?? MARKET_SPEC[market].windowTz` (ET on Futuros, Forex, Ações; Brasília on Ebinex,
   Cripto, B3).
6. `linhasDoDia` (`components/hub/diario/linhas.ts`) builds rows; `OperacoesDoDiaVista` renders a `role="table"`.

Row shape (`LinhaDoDia`): `hora` («10:12», «10:01–10:08», «ontem, 10:52 → 10:42», «21 out, …»), `operacao`
(`opTexto`: «MES · Compra · 2 ct», «EUR/USD · Baixa · 1 min», «SPY Call 790 · vence 15 out · Compra · 2 ct»), `clip`
(«tem imagens e nota» / «tem imagens» / «tem nota»), `sub`, `resultado` (signed money in the account currency, `null`
= «aberta»), `plano` («No plano» / «● fora da janela · depois do limite» / «—»), `acao` («Registrar saída»,
«Registrar resultado», «Abrir») + `acaoAria`.

Copy (`components/hub/diario/copy.ts`): title «Operações do dia», empty «Nenhuma operação registrada hoje.», NEW
«Não foi possível carregar as operações do dia.», NEW «Sem conexão. Tente de novo quando a conexão voltar.», columns
«Hora · Operação · Resultado · Plano · (Ação)». `QUEBRAS` shows only `fora_da_janela` and `depois_do_limite` (the block
and the state rule act in Phase 5).

What the bridge deliberately leaves out (Phase 4's job): imported trades («Phase 4 shows the whole day»,
`registrarDb.ts:1299-1300`), any day but today, the drill, the day's totals.

Board vs bridge (**ADAPTED**): the board's table (DD l.547) is «Hora · Operação · Resultado · Estado na entrada · Plano ·
(Detalhes ▾)» with an inline drill; the bridge has no «Estado na entrada» (Phase 5) and a button that opens the
Registrar sheet instead of a drill.

### 1.6 The Registrar sheet as Phase 4's entry point (`components/hub/registrar/`)

- Open: `useRegistrarSheet().open({ accountId, tradeId?, opener?, fallback? })` (`abrir.ts:15-24`). No `day` option:
  «Já fechada» on another day is chosen inside the form («Dia», bounded by «desde» … today).
- Start (`RegistrarSheet.tsx:135-163`): accounts = `registraveis(active)` (podeRegistrar, primary first); if the account's
  `rules_now` answer has `version === null` → `semRegras` **before** looking at `tradeId` (`:144-146`); with `tradeId`
  → open trade «Operação aberta», closed → «Operação fechada», gone → «Esta operação não foi encontrada.». Consequence:
  an imported trade of an account that has no rule version cannot be opened in the sheet (no marks, images or note from
  there), although the server accepts them (§2.3, §2.5).
- «Ver no Diário» (`RegistrarSheet.tsx:261-264`): pushes `/diario?conta=<id>` when needed and closes with
  `focusId: OPERACOES_DO_DIA_ID` (`'operacoes-do-dia'`, `abrir.ts:46`). Phase 4 must keep an element with that id or
  re-point the constant (the board's heading id is `t-ops`, DD l.544).
- «Operação fechada» (`PassoFechada.tsx`) already renders, from a `TradeView`: the card (`cartaoComParciais`), the
  timeline of exits and stop moves (`linhaDoTempo`, Phase 3c), the plan (`PlanoDaOperacao`), marks split «antes da
  saída» / «depois do resultado» (`marcasDivididas`), «Imagens e nota» (`ImagensENota` + `useAnexos`).
- Hooks usable outside the sheet: `useAnexos(conta: ContaReg, view: TradeView)` (`ImagensENota.tsx:71`) and
  `useMarcar(conta, view)` (`Marcas.tsx:66`); `useMexido` reads `FolhaContext`, whose default is a no-op, so they run
  outside the sheet. `ContaReg` comes from `contaReg(account, rules | null, desdeDay | null)` (`lib/hub/registrarForm.ts:117`).

### 1.7 The import sheet and «Importações»

- «Importar arquivo» opens `ImportSheet` on the current account (every market reads a file since 3b: reader or column
  mapping). Batches are listed and undone in Personalizar › Suas contas › «Importações» (`components/hub/contas/Importacoes.tsx`,
  rendered by `SuasContas.tsx:345`), with the undo counted in trades (`fetchBatchUndo`, 3b fix).
- After a commit or an undo, `useRefreshAfterWrite()` invalidates `['hub', uid]`, `['trades']`, `['trade-stats']`,
  `['account-transactions']` (`hooks/useContas.ts:175-184`): any Phase 4 key under `['hub', uid, …]` refreshes with it.
- The file-zone confirmation lives in the import sheet (`tz_applied_at`, `import_fix_tz`). **STALE**: the board's card
  «Os horários do arquivo da Top One estão em Nova York (ET)?» (DD l.266) predates Phase 1; Top One files are UTC
  (Phase 0 rehearsal) and the question is asked in the import flow, per account.

### 1.8 The placeholder

`page.tsx:25-31`: «O Diário chega na Fase 4.» · «Até lá, suas operações continuam na página Operações.» · «Abrir
Operações» (`hub-button`, → `/trades`). Phase 4 removes it; `__tests__/lib/hubRegistrar.test.ts:50` asserts the string
is in `page.tsx` (§5.2).

---

## 2. The data (database at migration `20261024000002`)

### 2.1 `trades` (columns Phase 4 reads)

| Group | Columns | Meaning for the Diário |
|---|---|---|
| Owner, account | `id`, `user_id`, `account_id` (never null since Phase 1; FK `(account_id, user_id)`), legacy `market_type` | One account per trade; the old pages still read `market_type` |
| Origin | `source` `live` \| `after` \| `import`; `source_platform`, `external_id` (file ticket), `import_batch_id`, `notes` (old import key, not the user's note) | See §2.2 for what "journal" means |
| Instrument | `symbol`, `asset_type`, `direction` (`long` `short` `call` `put`), `quantity`, `stake_amount`, `payout_percent`, `duration_seconds`, `timeframe`, `option_right`, `strike`, `expires_on`, `multiplier` | `opTexto` / `ativoCurto` already format them per market |
| Prices | `entry_price`, `exit_price` (average of counting exits), `stop_price` (initial stop; R is measured on it), `target_price` | Drill «Entrada → saída · pts», «Stop · alvo» |
| Money | `pnl` (gross, account currency; null while open), `result` (`win` `loss` `breakeven` `pending`), `commission` (null = unknown, not zero), `pnl_basis` (`prices` `estimate` `typed` `outcome` `file`; null before Phase 3) | Day result, wins/losses; «Top One como bruto» |
| Times | `entry_time`, `exit_time` (last counting exit), `expires_at` (binary), `trading_day` (date, `compute_trading_day`), `source_local_entry`/`_exit` (file wall clock) | The calendar keys on `trading_day`, never on `entry_time`'s date |
| Server facts | `status` (`open`/`closed`), `registered_at` (forced `now()` on every insert since Phase 3; null on older rows), `exit_registered_at`, `rule_version_id` (version in force at entry, app trades), `client_key` | «limpa», «Já fechada» vs live, which version judged the entry |
| Note | `note` (≤ 1 000), `note_saved_at` (forced) | Drill «Imagens e nota» |

- Privileges (`20261020000003_trade_api.sql:1613-1620`): `select`, `delete` (the old `/trades`), `insert` on the old
  writers' columns; **no UPDATE** for the API. `trades_guard` freezes `registered_at`, `client_key`, `expires_at`,
  `rule_version_id` on every row and, on app trades, `entry_time`, `account_id`, `source`, instrument and stop/target.
  The note changes only through `save_extras`.
- Indexes useful to Phase 4: `trades_user_acc_day (user_id, account_id, trading_day)`, `trades_open (user_id,
  account_id) where status='open'`, `trades_import_batch`.
- Deleting a trade: `trades_delete_log` writes `trade_deletions` (times and ids only) for app trades
  (`via` `desfazer_entrada` | `apagada`); `trade_attachments_to_trash` queues its images.

### 2.2 What "registered in the app" means

- `trade_entry_context` (`20261020000001_trade_cycle.sql:320-349`), one row per app trade, written only by the register
  functions; "its existence is what 'registered in the app' means". Columns: `origin` (`live` = registered while open,
  `reconstructed` = «Já fechada»), `captured_at`, `evaluated_at` (= entry), `gate_status`, `warnings`,
  `checks_evaluated` (`janela` `bloqueio` `limite` `estado`; a missing check = «não avaliado», never "ok"),
  `in_window`, `in_block`, `after_limit`, `day_pnl_at_entry`, `day_worst_at_entry`, `state_choice`, `rule_ok`, `gate`
  (gate_at's whole answer at the entry, without `rules`). Select-only; append-only guard.
- **STALE (appendix §B M6a)**: the appendix sketched `market_as_of`, `screen`, `bias`, `bias_marked_at` and `in_block`
  semantics with Phase 5 data; the as-built table has none of the first four. «O que a tela dizia» (DD l.564-569) and
  «Seu viés» need Phase 5 columns or tables (`bias_marks`).
- `source` alone does not separate journal and history:
  - `live`: registered in the app while open (always has a context).
  - `after`: «Já fechada» in the app (context `reconstructed`) **or** a legacy hand-typed row (Phase 1 backfill
    `update trades set source='after' where source is null`, `20261017000002_trades_accounts.sql:99`) **or** any insert by
    an old page (`trades_bridge`, `20261019000001_markets.sql:1150`). Legacy ones have no context
    (`backup-fase3/levantamento/legado.md` G15).
  - `import`: a file row not matched to an app trade. A file row that completed an app trade (decision 2: the file wins
    on money) leaves the trade's `source` as it was and writes `trade_import_links` (`before`/`after` jsonb,
    `differs`, `file_entry_at`/`file_exit_at`, `closed`, `set_key`).
- So the journal predicate is `exists trade_entry_context` (or the reader's `DayTrade.origin !== null`).

### 2.3 Marks

- `trade_marks` (append-only, server `marked_at`): kinds `setup` (A B C), `execucao` (cedo, no_ponto, tarde), `emocao`
  (calmo, confiante, ansioso, frustrado, neutro), `seguiu_texto` (sim, em_parte, nao); value null = «desmarcar».
- `trade_marks_v` (latest def `20261023000002_trade_exits.sql:486-496`): `limpa` = the trade has a `live` context and
  the mark is earlier than the first of: result known (`trade_result_known_at(exit_time, expires_at)`), the app's exit
  registration, the first non-undone `trade_exits` row (its `exit_time` or `registered_at`). Imported and «Já fechada»
  trades never have a «limpa» mark.
- `trade_marks_now_v` (`20261020000001_trade_cycle.sql:427-437`): per trade and kind, `current_value/at/limpa`,
  `clean_value/at` (the one Análises counts), `changed_after`.
- `add_marks(p_trade, {"v":1,"marks":{…}})` accepts **any trade of the owner**, imported included, up to 100 marks per
  trade, and answers `trade_state`. `seguiu_texto` has no screen yet (Phase 3 synthesis put «Você seguiu o seu texto?»
  in Phase 4; the board shows it only for a trade with a state-rule text at entry, DD l.588, which needs the Phase 5
  state).

### 2.4 Exits and stop moves (Phase 3c)

- `trade_exits` / `trade_exits_v.counts`: rows only for trades with more than one exit; file rows win over app rows;
  undone rows never count. `trades` holds the sums on a closed trade; an **open** trade with partials keeps `pnl = null`
  and its realized money lives only in the exits.
- `trade_stop_moves` / `trade_stop_moves_v.ao_vivo` (live, not undone, before the result was knowable).
- `limit_usage` counts each counting exit at its own instant, on the trade's (entry) trading day.

### 2.5 Images and note

- `trade_attachments`: `path` `{uid}/{trade_id}/{attachment_id}.{png|jpg|webp}`, `mime`, `name` (display), `bytes`,
  `status` `pendente`/`ok`, `position` 1–4, `saved_at`. At most 4 per trade, three ways (reservation, upload policy,
  save). Bucket `trade-images`, private, 10 MiB, PNG/JPEG/WebP; select policy = the caller's own folder.
- `image_slots(p_trade, {"v":1,"keep":[ids],"new":[{mime,bytes,name}]})` requires a `hub_members` row; `save_extras(p_trade,
  {"v":1,"note":text|null,"images":[ids in order]})` writes the note and the ordered list. Both accept **any trade of the
  owner** (no `not_app_trade` check), imported included.
- Upload only with the Storage API's plain `upload` (no signed upload URL; `__tests__/lib/storageUploads.test.ts`).
  Thumbnails: `signedImageUrl(db, path)` (10-minute URL, one call per image; `ImagensENota` signs one at a time).
- `trade_image_trash` + `drainImageTrash` (browser removes files, then `image_trash_done`); `useImageTrashSweep` runs
  once per session when a Registrar screen mounts.

### 2.6 Imports

- `import_batches`: `id`, `account_id`, `platform` (`ebinex`, `topone`, `modelo` since 3b), `file_name`, `file_tz`,
  `rows_total/inserted/duplicate/completed/other_account/error/linked`, `error_rows` (line + code only), `is_legacy`
  (one per account, the pre-Phase-1 imports, `created_at = min(trades.created_at)`), `status` `done`/`undone`,
  `created_at`, `undone_at`, 3b's `template_id`, `template_name`, `header_sig`. Select-only to the owner.
- The board's day tag «Importado em 13 out» (DD data, day `2026-05-04` `tags`) = `import_batches.created_at` of the
  trade's `import_batch_id`.
- `trading_accounts.tz_applied_at` / `file_tz`: whether the file zone was confirmed (`tzConfirmed`). The board's
  «▨ importado · fuso a confirmar» legend (DD l.336) maps to `tz_applied_at is null` with imported rows.

### 2.7 Rules, versions and the trading day

- `account_rule_versions` (select own, append-only): `id`, `account_id`, `version_no`, `effective_from` (server),
  `resolved` (jsonb Resolved v1: windows with zone, `window_rule`, `block`, `limit`, `states`, `day`, `breakeven`),
  `origin` (`salvar` `criar` `copiar`), `copied_from`.
- SQL functions granted to `authenticated` and usable from the browser:
  - `compute_trading_day(p_account uuid, p_at timestamptz) → date` (version-aware; `20261018000002_trading_day.sql:76`).
  - `trading_day_on(p_at, p_tz, p_start_min) → date`, `trading_day_for(p_windows, p_day_tz, p_day_start, p_at) → date`,
    `rule_version_at(p_account, p_at) → account_rule_versions`, `window_occurrences(p_windows, p_at, p_from, p_to)`.
  - `limit_usage(p_account uuid, p_day date, p_soma boolean, p_usd numeric, p_until timestamptz) → jsonb`
    `{"trades": int, "net_usd": numeric, "worst_usd": numeric ≤ 0, "hit_at": timestamptz|null}`
    (`20261023000002_trade_exits.sql:434-480`). Counts **every** trade of the scope with `trading_day = p_day`, any
    `source`, `pnl − coalesce(commission, 0)`, realized by `p_until`; `p_soma` = every active futures account. `*_usd`
    keys hold reais on B3.
  - `gate_at(p_account, p_at) → jsonb` (`20261019000001_markets.sql:954-1001`): `gate_eval` keys `at`, `trading_day`,
    `status`, `warnings`, `checks_evaluated`, `window` (`state`, `position`, `current {opens_at, closes_at}`, `next
    {…, trading_day}`), `limit` (`state`, `usd`, `mode`, `at_limit`, `trades`, `net_usd`, `worst_usd`, `hit_at`, `used`,
    `near`), `block`, `state_rule`, `changes_at`; plus `account_id`, `label`, `market`, `desde`, `desde_day`, `version
    {id, version_no, effective_from, origin}`, `rules`, `today {trades, net_usd, worst_usd}`. Works at any instant, so
    `gate_at(account, <end of a past trading day>)` is a past day's limit answer under the version in force then.
  - `rules_now() → {"server_now", "accounts": [gate_at(a, now()) …]}` (active, non-example accounts, by `sort_order`,
    `created_at`).
  - `rules_config() → {rev, server_now, builtin, defaults, preferences, accounts: [{account_id, label, market,
    archived_at, is_example, day {tz, start_min}, settings, window, current, versions: [{id, version_no,
    effective_from, effective_day, origin, copied_from, resolved}]}], …}` — every account incl. archived/example.
- Trading day rule (CLAUDE.md): `compute_trading_day`; an entry inside a window occurrence counts on the day it opened;
  before v1 only the day clock (`day_tz`, `day_start_min`: futures 18:00 NY, forex 17:00 NY, stocks 20:00 NY,
  binary/crypto/B3 midnight Brasília). Never `toISOString()`.
- Weekdays: `MARKET_SPEC[m].window.weekdays` — Mon–Fri everywhere except Cripto (every day, `20:00–22:00`). Crypto
  trading days fall on weekends; binaries can too (Ebinex trades at weekends, midnight Brasília day clock). Q2.

### 2.8 Accounts and preferences

- `trading_accounts`: `market`, `label`, `platform`, `firm`, `external_ref`, `phase`, `size`, `currency`, `file_tz`,
  `tz_applied_at`, `day_tz`, `day_start_min`, `is_primary`, `is_example`, `archived_at`, `sort_order`, `created_at`.
  The API selects every column (select-own policy) but updates only `label, firm, external_ref, phase, size,
  is_primary, archived_at`. `ACCOUNT_COLUMNS` (`lib/hub/contasDb.ts:108`) **omits `day_tz`, `day_start_min`,
  `currency`**: the Diário gets the day clock from `rules_config().accounts[].day`, a version's `rules.day`, or by adding
  the columns to the select.
- `profiles.preferences` (`HubPreferences`, `contasDb.ts:357-367`): `conta_atual`, `theme`, `display_tz` («Horários na
  tela»), `calendars`, `language`, `alerts {state_change, before_block, limit_80}`. Written only by `merge_preferences`
  (instant keys) and `save_rules`.
- Old `trading_sessions` (initial schema): `session_date` (device date, per user, **not per account**),
  `premarket_notes`, `market_bias`, `key_levels`, `planned_instruments`, `session_notes`, `lessons_learned`,
  `emotional_state`, `followed_plan`, stats, `ai_summary`. Read/written only by the old `/premarket` page
  (`hooks/useTradingSessions.ts`, `format(new Date(), 'yyyy-MM-dd')`). Appendix M6b plans copying `session_notes`,
  `lessons_learned`, `followed_plan` into `day_reviews` (Q6). Row count unknown (not queried).

### 2.9 What Phase 4 finds missing (all NEW to the database)

| Need (board) | Exists? | Appendix |
|---|---|---|
| «Revisão do dia» (DD l.607-630): «O que funcionou?», «O que você faria diferente?», «Seguiu o plano?», «Levar para o próximo pregão», «O diário registrou: …» | No | `day_reviews` (account_id nullable, trading_day, worked, differently, carry_forward, followed `sim`/`em_parte`/`nao`, auto_summary jsonb frozen at save, saved_at, edited_at; `unique nulls not distinct (user_id, account_id, trading_day)`) |
| «Do pregão anterior» (DD l.379) | No (it is the previous review's carry_forward) | via `day_reviews` |
| «Antes de operar» (DD l.378) | No hub source | not in appendix (Q5) |
| «Revisões pendentes» banner (DD l.276) | No | via `day_reviews` |
| Calendar month sums, marks ● ■ ✓, week column (DD l.286-340) | No aggregate | `diario_mes(account, month) → jsonb` (one value, not cut by max_rows) |
| «Seu foco da próxima semana · salvo em …» (DD l.657) | No | `weekly_focus` (account_id, week_of, claim_key, text, chosen_at) (Q9) |
| Holidays «quinta, 26 nov: feriado nos EUA» (DD data `semana`) | No data anywhere | — (Q10) |
| «Exportar CSV · Com estado, “Posso operar hoje?”, viés e regra.» (DD l.668) | Only the old `/trades` basic export | — |
| Timeline, «O que a tela dizia», «Seu viés», «Estado na entrada» | Phase 5 (`market_states`, `bias_marks`) | M7a |
| «Resumo do dia · escrito pela IA», «Leitura da semana» | Phase 8 (`ai_readings`) | M7b |

PG version: the decisions record Postgres 17.6 on the live project (`backup-fase3/decisoes.md`), so `unique nulls not
distinct` is available (appendix said PG15). The schema changes reach the live project only through the owner's paste kit
(`.claude/backup-fase*/aplicar/` pattern); the kit's backup schema name must not reuse a `backup_fase*` already live
(memory, 22 Oct: backup_fase1, 2, 2b, 3, 34, 3b, 3c exist; `backup_fase4` is not among them).

### 2.10 The API row limit

`supabase/config.toml:9` `max_rows = 1000` (hosted default too). Any list read can be cut silently. Patterns already in
the code: `readAll` (`contasDb.ts:292-306`, exact count + ranges), `UNDO_ID_CHUNK = 100` ids per `in()` filter, and the
test double `testing/apiPaginada.ts`. `readDayTradesRows` passes every trade id of the day to one `in()` (fine for a
day, not for a month). `/trades` and the old dashboard read `select *` unpaged (629 trades in the live project on 20
Oct; cut at 1 000).

---

## 3. The TypeScript layer Phase 4 calls

### 3.1 Hooks and cache keys

`hooks/useContas.ts`

| Export | Shape / behaviour |
|---|---|
| `hubKeys` | `all ['hub', uid]`, `contas`, `atividade`, `formatos`, `importacoes(accountId)`, `preferencias`, `templates`, `mercadosDosModelos` |
| `useHubDb()` | `{ db: createDataClient(token), userId }` (JWT client; never `getSession`) |
| `useAccounts()` | `{ all, active, archived, isLoading, isError, isRetrying, refetch }` (`fetchAccounts`: non-example, by `sort_order`, `created_at`) |
| `useContaAtual()` | `{ current, active, isLoading, isError, isRetrying, refetch, choose(id) }` |
| `usePreferences()` | `HubPreferences`, `retry: false` |
| `useImportBatches(accountId)`, `useBatchUndo(accountId, batchId)` | `ImportBatch[]`, `BatchUndo {trades, exits, registered, existing}` |
| `useRefreshAfterWrite()` | invalidates `['hub', uid]` + old pages' keys |

`hooks/useRegras.ts`: `regrasKeys.config/agora`; `useRulesConfig()` (`staleTime Infinity`, `refetchOnMount 'always'`, no
focus refetch; built for Personalizar's draft); `useRulesNow()` (refetch at `changes_at`, on focus);
`invalidateAfterSave`; `useTradesSinceRules(accounts)`.

`hooks/useRegistrar.ts`

| Export | Shape / behaviour |
|---|---|
| `registrarKeys` | `all ['hub', uid, 'registrar']`, `abertas(accountId \| 'todas')`, `dia(accountId, day)`, `operacao(tradeId)`, `recentes(accountId)`, `previa(kind, target, payload)`, `relogio`, `eventos(ids)` |
| `REGISTRAR_INVALIDATIONS` (`:100-114`) | `entrada: abertas dia recentes previa regrasAgora atividade paginasAntigas` · `saida: abertas dia eventos previa regrasAgora paginasAntigas` · `fechada: dia eventos recentes previa regrasAgora atividade paginasAntigas` · `desfazer: all of them` · `marcas: []` · `extras: dia` · `parcial: abertas dia eventos previa regrasAgora` · `stop: dia eventos previa` · `evento: abertas dia eventos previa regrasAgora` |
| `invalidateAfterRegistrar(qc, uid, write)` | dry runs only marked stale |
| `useServerClock()`, `useServerNow(everyMs)` | server offset from the newest answer with `server_now` (rules_now or a write) |
| `useOpenTrades(accountId \| null)` | `RegisteredTrade[]`, refetch on focus |
| `useTradeView(tradeId)` | `TradeView \| null` (`fetchTradeState`), refetch on focus; writes put their answer here (`setTradeView`) |
| `useDayTrades({id, market} \| null, day)` | `DayTrade[]`, key `registrarKeys.dia`, refetch on focus |
| `useTradeEvents(ids)` | `Record<tradeId, TradeEvents>` |
| Writes | `useRegisterEntry/Exit/After/Partial`, `useMoveStop`, `useUndoEvent`, `useAddMarks`, `useUndoEntry`, `useSaveImagesAndNote` (`networkMode 'always'`, `retry false`, `assertOnline`) |

### 3.2 `lib/hub/registrarDb.ts` (reads and answers)

```ts
interface RegisteredTrade { id; accountId: string|null; source: 'live'|'after'|'import'|null; status: 'open'|'closed';
  symbol; assetType; direction: 'long'|'short'|'call'|'put'; quantity: string|null; entryPrice; exitPrice; stakeAmount;
  payoutPercent; durationSeconds: number|null; timeframe; stopPrice; targetPrice;
  option: {right; strike; expiresOn; multiplier}|null; entryTime: Date; exitTime: Date|null; expiresAt: Date|null;
  registeredAt: Date|null; exitRegisteredAt: Date|null; tradingDay: string|null; pnl: string|null;
  result: 'win'|'loss'|'breakeven'|'pending'|null; commission: string|null; pnlBasis: PnlBasis|null;
  note: string|null; noteSavedAt: Date|null }            // decimals as text (lib/domain/registro/numeric)
interface StoredContext { gateStatus; warnings; checksEvaluated; inWindow; inBlock; afterLimit; dayPnlAtEntry;
  dayWorstAtEntry; stateChoice; ruleOk; origin: 'live'|'reconstructed'; capturedAt; evaluatedAt }
interface EntryPlanAnswer { breaks: PlanBreak[]; verdict: 'no_plano'|'fora_do_plano'|'nao_avaliado'; checksEvaluated }
interface TradeImage { id; path; mime; bytes: number|null; name; position: number|null; savedAt: Date|null }
interface TradeView { trade; version: {id; versionNo}|null; context: StoredContext|null; gate: GateResult|null;
  plan: EntryPlanAnswer|null; marks: MarkEvent[]; marksNow: MarkNow[]; images: TradeImage[]; exits: TradeExit[];
  stopMoves: StopMove[]; position: Position; breakeven: TradeBreakeven|null }
interface TradeState extends TradeView { serverNow: Date }   // what every write answers (SQL trade_state, not callable)
interface DayTrade { trade: RegisteredTrade; origin: 'live'|'reconstructed'|null; plan: EntryPlanAnswer|null; images: number }
interface TradeEvents { exits: TradeExit[]; stopMoves: StopMove[] }
```

| Function | Reads / calls |
|---|---|
| `fetchTradeState(db, tradeId)` = `tradeViewOfRows(await readTradeViewRows(db, tradeId))` | `trades` (`TRADE_COLUMNS`), then in parallel `trade_entry_context`, `trade_marks_v`, `trade_marks_now_v`, `trade_attachments` (status ok, by position), `account_rule_versions` (`id, version_no, resolved`), `trade_exits_v`, `trade_stop_moves_v` |
| `readDayTradesRows(db, accountId, day, since)` / `dayTradesOfRows` / `fetchDayTrades` | `trades`: `account_id = …`, `source in (live, after)`, `or(trading_day.eq.day, status.eq.open, exit_time.gte."since")`, by `entry_time`; then contexts and `trade_attachments` ids (status ok) with `in(trade_id, ids)` |
| `readTradeEventsRows` / `fetchTradeEvents(db, ids)` | `trade_exits_v`, `trade_stop_moves_v` with `in(trade_id, ids)` |
| `fetchOpenTrades(db, accountId?)` | `trades` `status = open` |
| `fetchRecentTrades(db, accountId, 200)` | `RECENT_COLUMNS`, imports included |
| `fetchGateAt(db, accountId, at)` | `gate_at` → `AccountNow` |
| `addMarks`, `imageSlots`, `saveExtras`, `uploadImage`, `signedImageUrl`, `drainImageTrash`, `imageTrashDone`, `undoEntry`, register_* | the Phase 3/3c RPCs |
| Constants | `TRADE_COLUMNS`, `EXIT_COLUMNS`, `MOVE_COLUMNS`, `IMAGE_BUCKET = 'trade-images'`, `SIGNED_URL_SECONDS = 600` |

Errors: every failure is a `RegistrarDataError(code, field?)`; a wrong answer shape is `bad_answer`, never a guess.

### 3.3 Domain

- `lib/domain/tempo.ts`: `utcToLocal`, `localToUtc`, `tradingDayOn(instant, DayClock)`, `tradingDayBounds(day, clock) →
  {start, end}`, `tradingDayFor(instant, clock, windows)`, `windowOccurrences`, `addDays(date, n)`, `isoWeekdayOf(date)`,
  `opensOn(mask, isoWeekday)`, `MON_TO_FRI`, `EVERY_DAY`, `formatHhMm`, `hmOn`. Everything a calendar needs (month grid by
  ISO date strings; weekday from the date string, never the device clock).
- `lib/domain/gate`: `parseRules`, `parseRuleVersion`, `versionAt(versions, instant)`, `evaluateGate(now, account,
  version, day)`, `evaluatePlan({tradeId, entryAt, account, version, trades, direction, state?, events?})`,
  `dayUsage(trades, {tradingDay, until, limitCents?, excludeId?}) → DayResult {trades, netCents, worstCents, hit}`,
  `dayResultFromServer`, `parseServerGate`, `GateResult`, `LimitCheck`, `PlanBreak`, `BREAK_ORDER`. Twins of the SQL,
  pinned by `__tests__/domain/gate/cases.json` and `__tests__/domain/cases3c.json`.
- `lib/domain/registro`: `entryPlanOf(context)`, `positionOf(trade, exits, moves, origin, now)`, `resultKnownAt`,
  `MARK_KINDS`, `PNL_BASES`, numeric arithmetic (`numeric.ts`).
- `lib/domain/markets.ts`: `MARKET_SPEC` (currency, `day`, `windowTz`, `window.weekdays`, `rules.block/states/soma/…`),
  `currencyOf`, `ACCOUNT_MARKETS`.

### 3.4 Words and formatting already approved

- `lib/hub/posso.ts`: `janelaLinha(rules)`, `possoLinha(label, gate, rules)` («Liberado · até 11:00 ET», «Aguardar até
  HH:MM», «Fora da sua janela · abre às …», «Encerrado por hoje · limite atingido às …»), `horaNoRelogio(instant, tz)`,
  `sufixoRelogio(tz)` (« ET» / « de Brasília»), `dinheiroCompacto(cents, currency)`, `marcaDoPlano(plan)` («No plano»,
  «● fora da janela · …», «Histórico importado · só resultado», «—»), `conferidos(checks)`, `regraDoEstado(check)`
  («ativo na Fase 5», «sem regra escolhida», «não conferida»).
- `lib/hub/formato.ts`: `formatMoney(decimal, {signed, currency})` («+US$ 1.272,50», «−R$ 484,84»), `formatDiaMes`
  («1º nov»), `formatDayMonth`, `formatDateRange`, `formatInt`.
- `lib/hub/registrarForm.ts`: `opTexto`, `ativoCurto`, `contaReg`, `hora`, `horaRel`, `diaRelativo`, `marcasDivididas`,
  `chipMarca`, `marcasAtuais`, `valorMarca`, `quandoMarca`, `cartaoFechada`, `periodo`, `linhaGate`, `linhaLimite`,
  `quebrasDoGate`, `textoQuebras`, `pontosDoStop`.
- `lib/hub/registrarParciais.ts`: `linhaDoTempo(conta, view, now, {comUndo})`, `cartaoComParciais`, `subDaPonte`,
  `formaDaOperacao`.
- `components/hub/copyMercados.ts` (`MERCADO[m].nome`), `components/hub/contas/copy.ts` (`MARKET_LABEL`, `PHASE_LABEL`,
  `LOADING`, `TRY_AGAIN`, `NEVER_SUMMED`), `components/hub/personalizar/copy.ts` (`ATIVO_NA_FASE_5 = 'ativo na Fase 5'`).

---

## 4. The old pages

### 4.1 `/trades`

- `app/trades/page.tsx` → `ProtectedRoute` (any signed-in user; no `HUB_USERS`) → `TradesV1Professional`
  (`components/trades/versions/TradesV1Professional.tsx`).
- Reads `useTradesSupabase({ marketType: activeMarket?.marketType })` (`hooks/useTradesSupabase.ts:23-61`):
  `trades select * where user_id … [and market_type …] order by entry_time desc`, unpaged; legacy market context
  (`useMarketContext`, `profiles.market_accounts`), so two Top One accounts show summed under «futures».
- Does: client filters (dates on the device clock, asset, result, market type, amount), sort, 50-row pages, **bulk
  delete** (`deleteTrade` → `delete from trades`; the only delete UI for imported and legacy trades, Phase 3 decision 3),
  **CSV export** of basic columns (`Date, Asset, Direction, Amount, Entry Price, Exit Price, Result, Profit, Strategy,
  Notes`; `toISOString` dates), and an «Importar» tab that now only links to `/diario?importar=1` (`DiarioImportLink`).
- Linked from: the old `Navbar` («Operações», `components/layout/Navbar.tsx:45`), the old dashboard's `RecentTrades`
  («Ver todas», `components/dashboard/RecentTrades.tsx:120,128`), and the /diario placeholder.

### 4.2 `/dashboard` (old Início)

- `DashboardV1Modern` with `MetricsOverview`, `CumulativePnLChart`, `AccountBalanceDisplay`, `RecentTrades` (all
  `useTradesSupabase`), `useAccountTransactions`, and `TradingCalendar` (`components/dashboard/TradingCalendar.tsx`,
  groups days by `toISOString().split('T')[0]`, i.e. UTC dates). **Not reusable** for the Diário calendar (it breaks the
  trading-day rule: Ebinex trades after 21:00 Brasília land on the next UTC date). The plan's risk section already
  accepts that the old pages disagree with the new ones until Phase 9.
- `HeroSection(PT)` links «Registrar operação» to `/diario?registrar=1`.

### 4.3 How `/trades` could open `/diario`

There is no `middleware.ts` and `next.config.js` has no `redirects()`/`rewrites()`; `app/vercel.json` only pins the
framework. Options:

| Mechanism | Effect | Cost |
|---|---|---|
| `next.config.js` `async redirects() { return [{ source: '/trades', destination: '/diario', permanent: false }] }` | 307 before any render, on Vercel and `next dev`; deep links keep working | Smallest; the old page becomes unreachable unless moved to another path |
| `app/trades/page.tsx` → server `redirect('/diario')` (`next/navigation`) | Same, per route | Same |
| Client `router.replace('/diario')` inside the old page | Flashes the old shell first | Worse |
| Keep the page, add a banner «Operações agora ficam no Diário» | Nothing breaks | Does not meet «/trades passa a abrir /diario» |

Consequences to settle before the redirect: (1) bulk delete and CSV export lose their only screen (Q1); (2) `/diario`
is behind `HUB_USERS`, `/trades` was not (a non-member gets HubGate's refusal; acceptable for a personal app); (3) keep
the `Navbar`/`RecentTrades` links (they then reach the Diário through the redirect, or point them at `/diario`);
(4) temporary (307), so Phase 9's permanent redirects stay a later decision; (5) the old components stay in the tree
(their tests render the component, not the route: `oldPagesMercados`, `oldPagesPending`, `oldImportButtons`).

---

## 5. Tests that pin this today

### 5.1 Database

- `supabase/tests/run.sh`: throwaway cluster (initdb) or `DATABASE_URL`, stub, pre-Phase-1 migrations, invented legacy
  seed (`10_seed_legacy.sql`), then every migration, then `*.test.sql` in order: `20_phase1`, `30_phase2`, `40_markets`,
  `50_phase3`, `60_import_counts`, `70_registrar_mercados`, `80_regra_breakeven`, `81_parciais`, `82_importacao_colunas`.
  Phase 4's SQL gets the next file (e.g. `90_diario.test.sql`): two users, RLS, the month/day answers, `max_rows`, the
  review writes.
- `.pg` Jest suites against the real SQL (`testing/pg.ts`: `BH_PG_URL`, `psql`, `asUser`, `asUserExec`;
  `BH_PG_RECORD=<dir>` writes fixtures): `hubRegistrarTelas.pg.test.ts` records `testing/fixtures/registrar-telas/
  dia-qui-1031.json`, `dia-qui-1042.json`, `dia-ebinex.json` (rows of `readDayTradesRows`), `operacao-*.json` (rows of a
  trade view), `agora-*.json` (rules_now); `hubRegistrarMercados.pg.test.ts` → `registrar-mercados/dia-*.json`;
  `hubParciais.pg.test.ts` → `parciais/dia-*.json`, `rows-*.json`. Phase 4 follows the same pattern for its day/month
  rows (record on a throwaway cluster, change SQL and TypeScript together, re-record).
- Parity: `__tests__/domain/gate/cases.json`, `__tests__/domain/registro/cases.json`, `__tests__/domain/cases3c.json`
  (expected values computed by the SQL). A Phase 4 aggregate computed both in SQL and TS (`dayUsage`) needs the same.

### 5.2 Screens and libraries

| Test | Pins | Phase 4 effect |
|---|---|---|
| `__tests__/lib/hubRegistrar.test.ts:50` | `page.tsx` contains «O Diário chega na Fase 4.» | must change |
| `__tests__/components/hub/PossoOperarHoje.test.tsx:742-767` | /diario order H1 → selector → card → bridge → placeholder; one `fetchRulesNow` call | must change |
| `__tests__/components/hub/OperacoesDoDia.test.tsx` (40 cases) | the bridge's rows in six markets, states, the day from rules_now held until `changes_at`, focus after the sheet and after «Ver no Diário», page order (`:576-600`), the owner's test 11:05 and 10:42 | rewrite or retire with the bridge |
| `__tests__/lib/hubRegistrarDbTelas.test.ts:49-85` | `readDayTradesRows`' filters (app trades of the day, open ones, closed since the day began), then contexts and images; one read when empty | extend or add a sibling for the new read |
| `__tests__/components/hub/DiarioCabecalho.test.tsx` | header, `?conta=`/`?importar=`/`?registrar=`, window line, six markets, «Registrar operação» | keep |
| `__tests__/components/hub/SeletorConta.test.tsx` | selector | keep |
| `__tests__/hooks/useRegistrar.test.tsx` | `REGISTRAR_INVALIDATIONS`, server clock, previews | update if Phase 4 adds keys to the table |
| `__tests__/hooks/useRegras.test.tsx` | `rulesNowRefetchDelay`, `changedOnlyHere` | keep |
| `RegistrarSheet*.test.tsx`, `RegistrarFechada.test.tsx`, `RegistrarParciais*.test.tsx` | the sheet incl. «Ver no Diário» → `OPERACOES_DO_DIA_ID` | update if the id moves |
| `__tests__/lib/hubRegistrarImagens.test.ts`, `__tests__/lib/storageUploads.test.ts` | images pipeline; no signed upload URLs | keep |
| `__tests__/api/routesRequireAuth.test.ts` | every route handler in `EXPECTED_HANDLERS` | add any Phase 4 route (none needed if everything is RPC/RLS) |
| `__tests__/components/hub/hubCss.test.ts`, `RegistrarCss.test.tsx`, `hubPossoCss.test.ts` | lane stylesheets scoped to `.hub` | add the Diário lane's |
| `__tests__/components/dashboard/oldPages*.test.tsx`, `oldImportButtons.test.tsx` | the old `/trades` and dashboard render with open trades and new markets | keep (component-level) |
| `__tests__/domain/tempo.test.ts`, `__tests__/domain/gate/*`, `__tests__/domain/markets.test.ts` | DST, overnight windows, trading days, gate tables, `MARKET_SPEC` = SQL | keep; calendar helpers add cases |

---

## 6. Reuse, extend, build: the seams

### 6.1 Reuse as is

- Frame: `(hub)/layout.tsx`, `AppShell`, `HubGate`, theme tokens, lane CSS pattern.
- Header and selector: `DiarioCabecalho`, `SeletorConta`, `useContaAtual` (`?conta=` contract), `contaParaRegistrar`.
- Today's trading day and its refresh: `useRulesNow`, `diaDeHoje`, `diaDaPonte`, `rulesNowFailed`,
  `useRulesNowCatchUp`, `useServerNow`.
- One trade, fully: `useTradeView` / `fetchTradeState` / `TradeView`, and every formatter of §3.4; `linhaDoTempo` for
  exits and stop moves; `marcasDivididas` + `chipMarca` for «antes da saída» / «depois do resultado»; `possoLinha` on
  `TradeView.gate` for «Posso operar hoje?» na entrada; `marcaDoPlano` / `entryPlanOf` for the plan cell.
- Writes from the day: `useAddMarks` (any owner trade), `useSaveImagesAndNote` + `useAnexos` (any owner trade, hub
  member), `useRegistrarSheet().open({ accountId, tradeId })` for exits, partials, stop moves, «Desfazer».
- Day maths: `dayUsage` (journal/imported split is just a filter on its input), `evaluatePlan` for an imported trade's
  recalculated plan, `versionAt` + `parseRuleVersion` for the version of a past day, `tradingDayBounds`.
- Images: `signedImageUrl`, `TradeImage.name/bytes` («MES_10-04_entrada.png · 840 KB»), `formatImageSize`.
- Imports: `trades.import_batch_id` → `import_batches.created_at` for «Importado em …»; `tzConfirmed`.
- Invalidation: `useRefreshAfterWrite` already reaches any key under `['hub', uid]`.

### 6.2 Extend

| Seam | Today | Phase 4 needs |
|---|---|---|
| `readDayTradesRows(db, accountId, day, since)` (`registrarDb.ts:1302`) | `source in (live, after)`; today + carry-overs | a reader for **any** trading day of an account, every `source`, contexts for all; the carry-overs (open trades of earlier days, closed today) only when the day is today. Either an options argument (`{ sources, carryOver }`) keeping the bridge's call and its fixtures, or a new `readDiaRows` with its own fixtures |
| `DayTrade` | `{trade, origin, plan, images}` | plus the exits and stop moves (today a second read `fetchTradeEvents`), the marks' «limpa» summary (`trade_marks_now_v`), and the batch for imported rows; `origin === null` = not registered in the app |
| `in(trade_id, ids)` reads | unchunked | chunk at 100 ids (`UNDO_ID_CHUNK` pattern) for months |
| `registrarKeys` / `REGISTRAR_INVALIDATIONS` | `dia` prefix = the bridge | add the Diário's keys (e.g. `['hub', uid, 'diario', …]`) to `entrada`, `saida`, `fechada`, `desfazer`, `parcial`, `evento`, `stop`, `extras`; `marcas` is `[]` today, so a day/month that counts «limpa» marks or shows marks needs `marcas` to touch it (or to read them from `operacao`) |
| `OPERACOES_DO_DIA_ID` (`abrir.ts:46`) and `irDiario` | focuses the bridge's H2 | focus the day's «Operações do dia»; also pass the trade's `trading_day` so /diario opens on that day (today it always shows today) |
| `OpenRegistrarOptions` | `{accountId, tradeId?, opener?, fallback?}` | optionally `day` (NEW) to start «Já fechada» on the selected past day |
| `RegistrarSheet` start | `semRegras` before `tradeId` | open on a `tradeId` even without a version (closed trade: view, marks, images, note) — or the Diário drill writes marks/images itself (`useMarcar`, `useAnexos`) |
| `inicioDoDia(day, market)` / `diaDaPonte` fallback | `MARKET_SPEC[market].day` | the account's own day clock (`rules.day`, `rules_config().accounts[].day`, or `day_tz`/`day_start_min` added to `ACCOUNT_COLUMNS`): a Phase 1 backfill account in a new market kept midnight Brasília (`markets.ts` header) |
| `ACCOUNT_COLUMNS` | no `day_tz`, `day_start_min`, `currency` | add them if the calendar needs the clock before the rules are read |
| Account selector | active only | unchanged unless Q11 says otherwise |
| `page.tsx` | header → card → bridge → placeholder | header → (card, Q7) → calendar → day → week; remove the placeholder and «Abrir Operações» |

### 6.3 Build (NEW)

- **Database** (one migration + paste kit, appendix §A rules: owner FK to `auth.users`, composite child FKs, one
  policy per command, server-written facts through `SECURITY DEFINER` functions with `search_path = ''` and revoked from
  `anon`):
  - `day_reviews` and its writer (`save_day_review(p_account, p_day, p_review jsonb)`-style: server `saved_at` /
    `edited_at`, frozen `auto_summary` built by the server from the day's facts, «Seguiu o plano?» `sim`/`em_parte`/`nao`).
  - `weekly_focus` if Q9 says so.
  - `diario_mes(p_account, p_month)` (appendix) → one jsonb per month: per `trading_day` the journal and imported sums
    (count, wins, losses, gross, net), plan breaks («fora do plano» count and sum), limit reached (worst ≤ −limit of the
    version in force), review present; per week the same. One value, so `max_rows` never cuts it. Its TypeScript twin
    (or parser) with SQL-computed cases.
- **Screens**: calendar (Mon–Fri + «Semana» column, Q2), the day (title, tags, tiles «Resultado · Operações · Limite do dia
  · Fora do plano», «O plano do dia», «Operações do dia» with drill, «Revisão do dia»), the week, the timeline placeholder
  «chega na Fase 5» (plan row 4; exact words NEW), «Exportar CSV» if in scope.
- **Tests**: `90_diario.test.sql`, a `.pg` recorder for the Diário's rows, component suites at 375/768/desktop, both
  themes.

### 6.4 Shapes to plug into (verbatim from the code)

```ts
// hooks/useRegistrar.ts
registrarKeys.dia(uid, accountId, day)        // ['hub', uid, 'registrar', 'dia', accountId, day]
registrarKeys.operacao(uid, tradeId)          // ['hub', uid, 'registrar', 'operacao', tradeId]  (TradeView | null)
registrarKeys.eventos(uid, idsJoined)         // ['hub', uid, 'registrar', 'eventos', 'id1,id2']
useDayTrades(account: {id; market} | null, day: string | null): UseQueryResult<DayTrade[], RegistrarDataError>
useTradeView(tradeId: string | null): UseQueryResult<TradeView | null, RegistrarDataError>

// components/hub/registrar/abrir.ts
interface OpenRegistrarOptions { accountId: string | null; tradeId?: string | null; opener?: HTMLElement | null; fallback?: HTMLElement | null }
interface CloseRegistrarOptions { focusId?: string }
const OPERACOES_DO_DIA_ID = 'operacoes-do-dia'

// lib/hub/regras.ts
interface AccountNow { accountId; label; market; desde: Date | null; desdeDay: string | null;
  version: {id; versionNo; effectiveFrom; origin} | null; rules: Rules | null; gate: GateResult;
  today: { trades: number; netCents: number; worstCents: number } }
interface RulesNow { serverNow: Date; accounts: AccountNow[] }
interface ConfigVersion extends RuleVersion { id; versionNo; effectiveFrom: Date; effectiveDay: string; origin; copiedFrom }
interface AccountConfig { id; label; market; archivedAt; isExample; day: DayClock; current: Rules; versions: ConfigVersion[] }

// lib/domain/gate/evaluate.ts
interface GateResult { at; tradingDay; status: 'liberado'|'aguardar'|'fora_janela'|'encerrado'|null; warnings;
  checksEvaluated; window: WindowCheck; limit: LimitCheck; block: BlockCheck; stateRule; changesAt: Date | null }
// LimitEvaluated: { evaluated: true; state: 'ok'|'atingido'; cents; mode: 'conta'|'soma'; atLimit: 'encerrar'|'avisar';
//   trades; netCents; worstCents; hitAt: Date | null; used; near }

// lib/domain/gate/usage.ts
interface DayTrade { id?; tradingDay; entryAt; exitAt: Date | null; pnlCents: number | null; commissionCents: number | null;
  result?; exits?: DayExit[] }   // ← note: a different DayTrade than registrarDb's
dayUsage(trades, { tradingDay, until, limitCents?, excludeId? }): { tradingDay; until; trades; netCents; worstCents; hit }
```

SQL answers the Diário can call as the user: `gate_at(p_account, p_at)`, `limit_usage(p_account, p_day, p_soma, p_usd,
p_until)`, `compute_trading_day(p_account, p_at)`, `rule_version_at(p_account, p_at)`, `rules_now()`, `rules_config()`
(shapes in §2.7). `trade_state(uuid)` is **not** callable by the API (revoked); a trade is read from the tables.

### 6.5 The boards against what is built

| Board element | Where | Status in Phase 4 |
|---|---|---|
| H1 «Diário» + date line «terça-feira, 1º de dezembro, 11:35 ET» | DD l.220-221 | The date line is not built; on whose clock (ET vs Brasília per account) is a spec choice (ADAPTED: the account's window clock, as the bridge) |
| «Registrar operação» · «Importar arquivo» | DD l.222 | Built (ADAPTED: Registrar primary) |
| Selector note «Futuros e binárias nunca são somados.» | DD l.233 | STALE → «Contas de mercados diferentes nunca são somadas.» |
| Section nav «Calendário · O dia · Semana» only for the futures account (`contaFut`) | DD l.236 | STALE condition: every market has the journal since 3-4 |
| Dashed card «Ebinex · opções binárias» / «Sem janela salva e sem operações no diário. …» / «Ver o histórico em Análises» | DD l.241-245, DH data `ebxLinha` | STALE: Ebinex registers since Phase 3 and has windows and limits since Phase 2; binaries get the same Diário |
| «O diário começou hoje · 3 coisas para saber», item 1 «Cada operação guarda o que a tela dizia na entrada.» | DH l.250-257 | STALE until Phase 5 (no market state is recorded) |
| Chips «Com estado · …» / «Importadas · …»; line «Diário desde 14 out: 106 operações com estado, em 31 pregões · 269 importadas antes, só resultado» | DH l.256, DD data `linhaTopo` | ADAPTED: "com estado" means "with market state" (Phase 5); in Phase 4 the count is of trades registered in the app (context) |
| Fuso card «Os horários do arquivo da Top One estão em Nova York (ET)?» | DD l.266 | STALE (asked per account in the import since Phase 1; Top One files are UTC) |
| «Revisões pendentes» banner, «Ver no calendário» | DD l.276-279 | needs `day_reviews` |
| Calendar, «Toque num dia para abrir. Valores em US$.», legend «● fora do plano · ■ limite atingido · ✓ revisão · ▨ importado · fuso a confirmar» | DD l.286-337 | ADAPTED: «Valores em R$» on B3 accounts (`currencyOf`); data from the month read |
| Day tiles «Resultado · Operações · Limite do dia · Fora do plano», «as outras 2: +US$ 159,50» | DD l.352-357 | data: day trades + `dayUsage`/`limit_usage` + plan breaks |
| «Antes do diário: sem plano gravado, só o que o arquivo trouxe.» | DD l.348 | days before «desde» (or imported-only days) |
| «O plano do dia»: Janela · Bloqueio · Limite · Seu viés · Estado na entrada · Regra do estado | DD l.364-375, DD data `plano` | Janela, Limite: from the version in force; Bloqueio, Seu viés, Estado na entrada, Regra do estado: Phase 5 → «ativo na Fase 5» or hidden (Phase 3 hid Phase 5 elements; ADAPTED) |
| «Antes de operar» / «Do pregão anterior» | DD l.378-379 | «Do pregão anterior» = last review's «Levar para o próximo pregão»; «Antes de operar» has no source (Q5) |
| «Linha do tempo ET» | DD l.385-540 | Phase 5; marked «chega na Fase 5» (plan) |
| «Operações do dia» with «Estado na entrada» and ▾ drill | DD l.544-595 | «Estado na entrada» Phase 5; drill facts from `TradeView` |
| Drill «Sua operação»: Hora, «Entrada → saída · pts», «Stop · alvo», «Posso operar hoje?», «Seu viés», «Regra» | DD l.560-562 | all but viés and regra exist (Phase 5) |
| «O que a tela dizia às …», «Escrita pela IA às …» | DD l.564-569 | Phase 5 / Phase 8 |
| «Imagens e nota» with thumbnails, «exemplo» chip | DD l.570-581 | images and note exist; «exemplo» is prototype-only |
| «Adicionar imagens ou nota» (→ RegistrarOperacao) | DD l.583 | `useAnexos` inline or the sheet on the trade |
| Mark editor with times | DD l.584-586 | `useMarcar` + `marcasDivididas` |
| «Você seguiu o seu texto?» + «Pela sua resposta, depois do resultado. O diário conta à parte.» | DD l.588-589 | mark `seguiu_texto` exists; the question needs the state at entry (Phase 5) |
| «Resumo do dia · escrito pela IA às …» | DD l.599 | Phase 8 |
| «Revisão do dia · 2 minutos · tudo opcional», «Escrever revisão», form, «Salvar revisão» | DD l.607-630 | `day_reviews` (NEW table) |
| «Semana»: «Resultado · Operações · Fora do plano · Viés marcado antes», bars, «Fora do plano» list, «Leitura da semana · escrita pela IA …», «Seu foco da próxima semana · salvo em …» | DD l.635-660 | numbers, bars, list: from the month read; «Viés marcado antes» Phase 5; IA Phase 8; focus Q9 |
| «Métricas e gráficos ficam em Análises» + «Abrir Análises» | DD l.663-664 | lands on the old `/analytics` until Phase 6 |
| «Exportar CSV», «Como o diário grava» («A cada 5 minutos e a cada mudança, o Binary Hub guarda o estado…»), «Apoio à decisão, não recomendação de investimento. Resultados do arquivo da corretora, sem custos.» | DD l.668-670 | export NEW in the hub; «Como o diário grava» STALE until Phase 5; «sem custos» conflicts with the limit's net (Q4) |
| «Posso operar hoje?» card on /diario | not on the Diário boards | built in Phase 2 (ADAPTED), Q7 |

---

## 7. Gotchas found while reading

1. **Limit vs journal**: `limit_usage` sums imported trades of the day; a Diário that never sums imported history will
   show a «Limite do dia» that disagrees with its own «Resultado» on mixed days unless the split is explicit (Q3).
2. **Legacy `after` rows**: on a past day they look like «Já fechada» trades unless the reader requires a context.
3. **Two `DayTrade` types**: `lib/hub/registrarDb.DayTrade` (a bridge row) and `lib/domain/gate/usage.DayTrade` (the
   limit's input). Name Phase 4's types apart.
4. **Open trades with partials** have `pnl = null`; their realized money is in `trade_exits_v` only. A day result that
   reads `trades.pnl` misses it; `dayUsage` with `exits` or `limit_usage` counts it.
5. **Days of an open trade**: it counts on its entry day; the bridge also shows yesterday's open trade today. On a past
   day the trade appears once, on its own day.
6. **Clock of HH:MM**: the bridge writes hours on the account's window clock; the board writes «Linha do tempo ET» for
   futures. Binaries, Cripto and B3 are on Brasília.
7. **Weekend trading days** exist for Cripto (every day) and can for binaries (Q2).
8. **Archived accounts** disappear from the selector, and `rules_now` lists only active accounts.
9. **Marks write `[]` invalidations**: a day that counts marks must be told, or read marks from the trade's view.
10. **One signed URL per image**: a day with many thumbnails makes many Storage calls (`createSignedUrls` batches them;
    not used yet).
11. **`/trades` redirect and the Navbar**: the old pages' `Navbar` keeps «Operações» → `/trades`; with the redirect it
    lands on the Diário (behind `HUB_USERS`).
12. **No holiday data**: «feriado» cells on the board have no source.

---

## Open questions for the owner

**Q1. When `/trades` opens `/diario`, where do «apagar» and «exportar» go?** Today `/trades` is the only screen that
deletes an imported or old trade (Phase 3 decision 3: «a página antiga Operações continua apagando») and the only CSV
export.
- (a) `/trades` sends to `/diario`; the old list stays reachable at another address, linked from the Diário's footer
  («Página antiga de operações»), until Phase 9. Deleting and exporting stay there, unchanged. **(Recommended)**
- (b) `/trades` sends to `/diario`, and the Diário gets «Apagar operação» in the trade's details (the database already
  logs deleted app trades and sends their images to the trash) and the board's «Exportar CSV».
- (c) `/trades` sends to `/diario`; no delete and no export until Phase 9.
Why (a): it meets «/trades passa a abrir /diario» with no new destructive control in Phase 4, and decision 3 stays true.

**Q2. The calendar is «seg–sex». What about weekend trading days?** Cripto's window runs every day and its trades fall
on Saturdays and Sundays; Ebinex can trade at weekends.
- (a) Monday to Friday for every account; a weekend day with trades is reachable only from the week or a list.
- (b) The columns follow the account: Monday to Friday, plus Saturday and Sunday when the account's window includes them
  or a weekend day of that month has trades. **(Recommended)**
- (c) Monday to Sunday for every account.
Why (b): no trading day is ever hidden, and futures, Forex, Ações and B3 keep the board's five columns.

**Q3. Trades that came only from a file on days of the diary (after «desde»): in the day's numbers or apart?** The
boards say imported history is never summed with the diary; the «Limite do dia» that «Posso operar hoje?» used counts
every trade of the day, file trades included.
- (a) The diary counts only trades registered in the app; file-only trades show in the day apart («importada · só
  resultado», with the plan recalculated and labelled so), never in the day's «Resultado» or the calendar's colour; the
  «Limite do dia» tile shows the limit as the app counted it (all trades). **(Recommended)**
- (b) Same split, and the «Limite do dia» tile counts only the diary's trades (it can then disagree with what «Posso
  operar hoje?» said that day).
- (c) On diary days everything is summed; only days before «desde» count as imported history.
Why (a): the limit is about money lost that day, whoever wrote the trade; the diary's evidence (hours, marks, plan at
entry) stays only for trades registered in the app.

**Q4. Gross or net of costs?** `trades.pnl` is gross; the daily limit subtracts known commission; the board's footer says
«Resultados do arquivo da corretora, sem custos.» and Análises will show Top One «bruto».
- (a) Results gross everywhere in the Diário (day, calendar, week), with «bruto» stated once; the «Limite do dia» tile
  uses the limit's own number (net when the commission is known). **(Recommended)**
- (b) Net of known costs everywhere.
- (c) Gross everywhere, the limit tile included (it then differs from «Posso operar hoje?»).
Why (a): same numbers as the broker file and the future Análises, and the limit tile matches what the app enforced.

**Q5. «Antes de operar» (the note on the day's plan) has nowhere to come from.** No hub screen writes a pre-session note;
the old Premarket page saves one per date on the device's clock, for all accounts together.
- (a) Leave it out in Phase 4; show «Do pregão anterior» (from the last review's «Levar para o próximo pregão»). The
  pre-session note comes with the screen that writes it (Início or the asset page, Phase 8). **(Recommended)**
- (b) Add a short «Antes de operar» field to the day itself, per account (new, not on the board as an input).
- (c) Show the old Premarket page's note for that date.

**Q6. The old sessions' notes («session_notes», «lessons_learned», «followed_plan»).** The technical plan says to copy
them into the new day reviews. They are per date, not per account, and it is not known whether any exist.
- (a) Count them first in the paste kit's check; copy only if there are any, as a review for «todas as contas» on that
  date. **(Recommended)**
- (b) Never copy; the old page keeps them until Phase 9.

**Q7. Does «Posso operar hoje?» stay on the Diário?** It came from the Início board and sits on `/diario` since Phase 2,
because Início is still the old page.
- (a) Keep it at the top of the Diário until the new Início (Phase 8). **(Recommended)**
- (b) Remove it, as the Diário boards draw no such card.
Why (a): it is the only place the app shows it today.

**Q8. Marks, images and note on a file-only trade.** The database accepts them on any of your trades, but the Registrar
sheet does not open on an account that has no rules yet.
- (a) The Diário's trade details let you mark, add images and a note on any trade (marks on file trades never count as
  «limpas»). **(Recommended)**
- (b) Only on trades registered in the app.

**Q9. «Seu foco da próxima semana».** The board shows a saved focus; no screen on it writes one, and the technical plan
ties it to a pattern (Padrões, Phase 7).
- (a) The Phase 4 week shows its numbers, bars and the «Fora do plano» list; the focus comes with Padrões. **(Recommended)**
- (b) A free-text «foco da próxima semana» in the week block now.

**Q10. Holidays on the calendar** («quinta, 26 nov: feriado nos EUA»). There is no holiday data in the app.
- (a) None in Phase 4: a weekday without trades shows «—». **(Recommended)**
- (b) A fixed list in the code for CME, NYSE and B3, updated once a year.
- (c) Wait for the economic calendar of Phase 5.

**Q11. Archived accounts.** The selector lists only active accounts, so an archived account's days cannot be opened.
- (a) Keep it so in Phase 4; their history goes to Análises. **(Recommended)**
- (b) An «Arquivadas» group in the selector, read-only.
