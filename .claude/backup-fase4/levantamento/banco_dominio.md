# Phase 4 · Database and domain design: the Diário (M6b)

Scope: the database and the TypeScript domain behind Phase 4 (plan row 4: «Calendário seg–sex com a Semana, no fuso da
conta. O dia: plano, operações, marcas "limpas", imagens e revisão. A semana. A linha do tempo fica marcada "chega na
Fase 5".»; owner test «Seus dias reais; depois, `/trades` passa a abrir `/diario`.»), designed against the code as built
at `d811ad5` (`feature/rebuild-lean` = `main`, migrations live through `20261024000002`, SQL tests through `82`). Screens
are another spec's job; this one names what the screens must send and show only where the database or the domain decides
it.

Research only. Nothing in the repo was edited, the live Supabase was not called, no `.env` was read. From `docs/csv` only
headers and aggregate counts were looked at (rows per ISO weekday of the four files, to size the weekend question; no row
was printed).

Read for this spec:
- Repo: `CLAUDE.md`; every migration from `20261017000001` to `20261024000002`, closely `20261017000002` (trading day,
  bridge), `20261018000001` (rule tables, `account_rule_versions_guard`), `20261018000002` (`window_occurrences`,
  `trading_day_for`, `rule_version_at`, `compute_trading_day`), `20261018000003` (`rules_now`, `rules_config`),
  `20261019000001` (`market_caps_all`, `gate_eval` l.813, `gate_at` l.954), `20261020000001` (trade cycle, context,
  marks, `trade_marks_v`, `trades_guard`, `trade_deletions`), `20261020000002` (images, bucket policies),
  `20261020000003` (`trade_context_from_gate` l.632, `trade_entry_plan` l.653, `add_marks`, `save_extras`, grants
  l.1613–1664), `20261020000004` (`trade_import_links`), `20261023000001` (breakeven in Resolved), `20261023000002`
  (`trade_exits`, `trade_stop_moves`, `trade_exits_v` l.290, `limit_usage` l.434, `trade_marks_v` l.486),
  `20261023000003` (`trade_state` l.473, internal at l.2319); `supabase/config.toml` (`max_rows = 1000`, PG 15 locally;
  live is 17.6 per `backup-fase3/decisoes.md`); `supabase/tests/run.sh`, the headers of `50`–`82`; `.github/workflows/ci.yml`
  (`db` job on postgres:17); `app/lib/hub/registrarDb.ts` (`parseTradeState`, `readDayTradesRows`, `signedImageUrl`,
  `SIGNED_URL_SECONDS = 600`, `readTradeEventsRows`), `app/hooks/useRegistrar.ts` (`REGISTRAR_INVALIDATIONS`),
  `app/components/hub/diario/*` (the Phase 3 bridge), `app/lib/hub/posso.ts` (`marcaDoPlano`), `app/lib/domain/gate/*`,
  `app/lib/domain/tempo.ts`, `app/hooks/useTradingSessions.ts`, `app/app/trades/page.tsx`,
  `components/trades/versions/TradesV1Professional.tsx`, `next.config.js`, `app/vercel.json`, the `cases3c` and
  `hubParciais.pg` test pattern.
- Plan: `.claude/backup-plano/v31/plano.md` row 4, `apendice.md` §A, §B «Fase 4: M6b Diário», §D, §E.
- Decisions: `.claude/backup-fase3/decisoes.md`, `.claude/backup-fase3c/decisoes.md`, `.claude/backup-fase3b/decisoes.md`;
  patterns from `.claude/backup-fase3/levantamento/{sintese,perguntas,banco}.md` and the 3b kit
  (`.claude/backup-fase3b/aplicar/`); memory (`market-hub-initiative.md`, `paste-kit-backup-schema-names.md`).
- The boards, read as markup only (their text is data): `.claude/backup-fase4/quadros/DiarioHojeEnxuto.dc.html`
  (sha256 `d3e752cfbda5bc9b…`, «14 out, 11:40 ET · primeiro dia») and `DiarioDezEnxuto.dc.html` (`ee209eeff128098a…`,
  «1º dez, 11:35 ET · sete semanas»). Both share one template; their data object (`this._D`) sits on H l.618 / D l.681.
- The sibling survey `.claude/backup-fase4/levantamento/estado_atual.md` (the as-built inventory), read at the end to
  align; §16 lists where this spec agrees or differs.

Markers: «…» = exact pt-BR, with its board location: **H l.N** = `DiarioHojeEnxuto.dc.html` line N, **D l.N** =
`DiarioDezEnxuto.dc.html` (identical to H up to l.388; after the timeline, D = H + 63); **H data `key`** = the board's data
object. **NEW** = on no board; **ADAPTED** = on a board or in the appendix, changed here (reason given); **STALE** = on the
boards (drawn 14 Oct, before Phases 1–3c) but no longer true as built.

**Revised 23 Oct with the synthesis review** (`sintese.md`, revision note): the calendar read is split into a light
`diario_calendario` over the whole range and `diario_mes` per month (§5.1, §5.1b, §9); `diario_dia` gains `deleted` (§5.2);
heat levels follow quadros §5.9 (§1.1, §11.1); pending reviews count only days with a trade registered in the app (§1.1,
§11.1, §15); images and note are edited inline in the drill (§1.2); `factsChanged` compares only `trades` and `net` (§6);
an archived-account case for «somando» (§12.1 group 5); Q5 (b) costs +1 day (§0, §14). Net or gross is the synthesis's Q2.

---

## 0. Decisions at a glance

1. **The trading day is read, never derived.** Every grouping uses the stored `trades.trading_day` (written by
   `compute_trading_day` in `trades_bridge`, version-aware, overnight windows counted on the day they opened). No query
   groups by instant bounds, `toISOString()` or the browser's zone.
2. **Diário or history is decided per trade, as built.** A trade whose entry is before the account's first rule version
   (`rule_version_at(account, entry_time)` is null) is «Histórico importado · só resultado» (the as-built label,
   `lib/hub/posso.ts:184`, copy of 2b/3b). A day is `historico` when all its trades are, `diario` when none is, and
   `misto` only on the day version 1 took effect. History money is never summed with the diário's: not in the day, not in
   the week, not in the calendar colour (H data `infos.cal`: «Hachurado: importado do arquivo, só com resultado, nunca
   somado ao diário.»).
3. **File-only trades after «desde» are diário trades with a recalculated plan** (H data `infos.grava`: «as que chegam só
   pelo arquivo, depois, entram com o “Posso operar hoje?” recalculado, e a operação mostra isso.»; as-built import copy
   «As de antes de {d} ficam em Histórico importado · só resultado, à parte do Diário.», `contas/copyRegras.ts:134`).
   App trades keep their frozen `trade_entry_context`. Question Q2 (the sibling survey recommends the opposite).
4. **The day's money is `limit_usage`'s money.** The day result is the realized net (pnl − known commission) of the day's
   diário trades, counting each counting exit (open trades' partials included), exactly what `limit_usage(account, day,
   false, …, 'infinity')` sums; a SQL test proves equality for every account and day. Gross and commission come along for
   the ⓘ. Question Q3 (net or gross on screen).
5. **Three reads and one write, all RPCs returning one `jsonb`** (never cut by `max_rows`): `diario_calendario(account,
   from, to)` (light, the whole range: every day's money, counts, kind and review, the weeks' money; no plan, no limit),
   `diario_mes(account, month)` (the plans and limits of the ISO weeks covering one month: «fora», ■, the out-of-plan
   list), `diario_dia(account, day)` (the plan, the facts, every trade as `trade_state` already answers it, the review,
   the carry-over, deletions), `save_day_review(account, day, review)`. ADAPTED from the appendix's single
   `diario_mes(account, month)` (reason: the heat quartiles and the weeks need the whole range, which is cheap without
   plans; the plans cost one `gate_at` per file-only trade, so they are read per month, a cost that stays flat as history
   grows; a day's detail is heavy and read on demand).
6. **One new table, `day_reviews`, per account per trading day, append-only** (each save a row; the newest is the review,
   the first gives «salva às», the newest «editada às»), written only by `save_day_review`; RLS select-own. Question Q4
   (append-only or one editable row). `account_id` is NOT NULL (ADAPTED: the appendix allowed null; H data `infos.conta`:
   «Cada conta tem o seu diário, a sua janela e o seu limite.»).
7. **«O diário registrou:» is facts, frozen.** `day_reviews.auto_summary` stores the day's facts (`diario_fatos`, counts
   and amounts, English keys) at the save; pt-BR words are rendered by `lib/hub`. It is not the AI's summary (Phase 8).
8. **The plan of the day** is the rule version in force at the end of the trading day (now, for today), so today's Diário
   matches the «Posso operar hoje?» card on the same page; versions that took effect earlier that day are listed. Each
   trade is judged by its own entry version (frozen, or recalculated for file-only trades).
9. **Images: signed read URLs made in the browser**, in one `createSignedUrls` call per opened trade (10 minutes, as
   Phase 3's thumbnails), never in an API route, never logged, re-signed on expiry. No Storage policy changes.
10. **Phase 5 and 8 bits return nothing** (no keys reserved): timeline, «O que a tela dizia», viés, estado, regra do
    estado, «Você seguiu o seu texto?», AI texts, holidays. The timeline block is a static «chega na Fase 5».
11. **`/trades` → `/diario`** is a temporary (307) redirect in `next.config.js`, in its own small PR after the owner's
    test. What the old page still does (delete, export) is question Q5.
12. **Paste kit additive only**: new table, view, functions; no function replaced, no row written. Backup schema
    `backup_fase4_diario`, guard code `f4_ja_aplicado`.
13. **Tests**: `supabase/tests/83_diario.test.sql` (13 groups); `app/__tests__/domain/cases4.json` with expected values
    computed by the Phase 4 SQL; `app/__tests__/lib/hubDiario.pg.test.ts` recording `app/testing/fixtures/diario/`
    (`BH_PG_RECORD`).
14. **Effort**: board revision 1–1.5, 4-1 Banco 2.75–3.75, 4-2 Domínio 1.5–2, 4-3 Telas 4–5, 4-4 Redirect 0.5 → 9.75–12.75
    days (plan: 9–11), +1 with Q5 (b). The synthesis re-budgets the whole phase (`sintese.md` §2: 11.5–14.5).

---

## 1. What the boards ask the database to hold

Both boards draw one account at a time (selector, H l.228–233), a month calendar (H l.284–341), the open day (H
l.343–568), the week (H l.572–596), and the footer (H l.598–608). The table marks each element for Phase 4.

### 1.1 Calendar

| Element (board) | Phase 4 | Data it needs |
|---|---|---|
| «Calendário», «Mês anterior», «Hoje», «Próximo mês» (H l.286–290) | as board | first and last day with trades; the account's trading day today |
| «Toque num dia para abrir. Valores em US$.» (H l.294) | ADAPTED: «Valores em R$.» on B3 accounts (`market_caps(market).currency`) | currency |
| Columns «Seg» «Ter» «Qua» «Qui» «Sex» «Semana» (H l.303) | as board for futures, Forex, Ações, B3; ADAPTED for binary and Cripto (Q1: weekend trading days exist: Cripto's window is every day, `market_caps_all` weekdays 127; the owner's three Ebinex files hold 11 Saturday and 2 Sunday rows out of 491) | per-day `weekday` |
| Cell: result («+218,50», short «+219»), «3 op.», colour by quartile (H data `infos.cal`: «mais forte quanto maior (quartis do resultado diário)»; the board's levels are quartiles of \|result\| over every day with data, history included: thresholds ≈ 55, 107, 170 on D data) | ADAPTED (quadros §5.9, `sintese.md` C15): diário days by the diário days' quartiles, gains and losses apart; history days on their own scale, so history never sets a diário day's colour (the same ⓘ: «nunca somado ao diário») | per day `net`, `n`, `kind` (light pass) |
| «●» fora do plano, «■» limite atingido, «✓» revisão, «▨» importado (legend H l.339) | as board | ● and ■ per day from `diario_mes` (`fora.n`, `limit.hit_at`, for the month shown); ✓ and ▨ from `diario_calendario` (`review`, `kind`) |
| Hover «5 out · +US$ 218,50 · 3 op.: 3 ganhos, 0 perdas · importado, só resultado» (H data `meses[].dica`) | as board | `wins`, `losses`, `even` («1 no zero a zero», D data 3 nov) |
| Week cell «12–16 out · +347,00 · 10 op. · ● 1 · ▨ importado à parte: +21,25» (D data, Oct week 3) | as board: the week sums diário days only, history apart (H data `infos.cal`: «A coluna Semana soma só o diário; o importado aparece à parte, com ▨.») | `weeks[]` from SQL (no float sums in JS) |
| Feriado cells «26 nov · feriado nos EUA: Ação de Graças» (D data) | Phase 5 (Q6) | none in Phase 4 |
| «Revisões pendentes» banner: «{n} pregões sem revisão, {m} nas últimas 4 semanas» (H l.762), «No calendário, são os pregões do diário sem ✓.» (D data `aviso.sub`), «Ver no calendário» (H l.279) | ADAPTED: counts only days with at least one trade registered in the app (otherwise every imported day would be pending); sub «No calendário, são os pregões com operação registrada no app e sem ✓.» | per day `review` + `kind` + `app`; today's day |
| «Os horários do arquivo da Top One estão em Nova York (ET)?», «Sim, Nova York (ET)», «Outro fuso» (H l.266–267) | STALE: the import confirms the file's zone since Phase 1 (`import_commit` sets `tz_applied_at`); the Top One file is UTC (memory). ADAPTED: a line only when the account still has trades on a guessed clock | `tz_confirmed`, `guessed_clock` count |
| «Futuros e binárias nunca são somados.» (H l.233) | STALE: six markets; the as-built «Contas de mercados diferentes nunca são somadas.» (`contas/copy.ts:93`) | — |
| Ebinex card «Sem janela salva e sem operações no diário. O histórico importado, 169 operações de 4 ago a 13 out, fica em Análises.» (H data `ebxLinha`) | STALE: every account, Ebinex included, gets the same calendar; its history shows hatched there | — |
| «O diário começou hoje · 3 coisas para saber», «Cada operação guarda o que a tela dizia na entrada.» (H l.250–254) | STALE until Phase 5 (as built the entry keeps the «Posso operar hoje?», not the screen's state) | — |

### 1.2 The day

| Element (board) | Phase 4 | Data |
|---|---|---|
| Title «Quarta-feira, 14 de outubro»; tags «CPI de setembro, 08:30» (Phase 5), «Limite atingido às 10:38» (D data 19 nov), «Importado em 13 out» (D data 13 out), «Revisão escrita» / «Sem revisão» | as board minus the event tag | `facts.limit.hit_at`, `imported_at`, `review` |
| «Antes do diário: sem plano gravado, só o que o arquivo trouxe.» (H l.348) | as board on `historico` days | `kind` |
| Tiles «Resultado», «Operações» («1 ganho, 2 perdas»), «Limite do dia» («US$ 11,00 de US$ 400», «no pior momento do dia», «atingido às 10:38», bar), «Fora do plano» («1 operação · −US$ 33,00», «as outras 2: +US$ 22,00») (H l.353–357, H data `resumo`) | as board; ADAPTED «Limite do dia» says «soma das contas de Futuros» when the version's limit is `soma` | `facts.*` |
| History tiles «—», «o limite ainda não existia», «sem plano gravado» (D data 13 out) | as board | `kind` |
| «O plano do dia» (H l.364) rows «Janela», «Bloqueio», «Limite», «Seu viés», «Estado na entrada», «Regra do estado» (H data `plano`) | «Janela» and «Limite» as board; «Bloqueio», «Seu viés», «Estado na entrada», «Regra do estado» hidden until Phase 5 (as Phase 3 hid them); NEW row «Mover para o breakeven» (3c rule: plan «MES +8 pts», fact «moveu em 1 de 2», mark «Registrado»: the check itself is Análises', `backup-fase3c/decisoes.md` item 2); NEW line when the rules changed during the day («Até 10:45 valia a versão 3: limite US$ 400.») | `plan`, `facts.window`, `facts.limit`, `facts.breakeven`, `plan.changes` |
| «Antes de operar» / «Nada anotado antes da sessão.» (H l.378, l.780) | no writer (Q7) | — |
| «Do pregão anterior» / «Nada trazido do pregão anterior.» (H l.379, l.781); D data 1 dez: «“Esperar o recuo até a VWAP antes de comprar.” · 27 nov» (the last earlier review with a carry-over, skipping Monday 30 nov without trades) | as board | `carry_in` |
| «Linha do tempo ET» with the SVG (H l.385–476) | ADAPTED: a static «Linha do tempo · chega na Fase 5» (plan row 4) | none |
| «Operações do dia» table «Hora», «Operação», «Resultado», «Estado na entrada», «Plano» (H l.481–484) | «Estado na entrada» hidden (Phase 5); «Plano» per trade: frozen, recalculated (NEW badge), or «Histórico importado · só resultado» | `trades[]` |
| Drill «Sua operação»: «Hora», «Entrada → saída · pts», «Stop · alvo» («stop 11 · alvo 22 pts · às 10:05»), «Posso operar hoje?» na entrada, gate note (H l.497–503) | as board; NEW: exits («em 2 saídas»), stop moves («stop no breakeven», 3c bridge words), R | `trade_state` per trade |
| «O que a tela dizia às 10:07 ET», «Escrita pela IA às …» (H l.505–508) | hidden (Phase 5, Phase 8) | none |
| Marks editor «Setup · sua nota, de A a C», «Execução», «Emoção» with «às 10:07 · antes da saída» / «às 10:33 · depois do resultado» (H l.522, script l.698) | as board through the existing `add_marks`; times and «limpa» from `trade_marks_v` | `trade_state.marks`, `marks_now` |
| «Você seguiu o seu texto?» (H l.525) | Phase 5 (needs a state rule at the entry) | none |
| «Imagens e nota», thumbnails, «Adicionar imagens ou nota» (H l.510–520) | as board (signed URLs, §7); edited inline in the drill with the Registrar's `useAnexos` + `ImagensENota` (not through the sheet, whose «Operação fechada» would show «—» for a trade without a context: `sintese.md` C20) | `trade_state.images`, `trade.note` |
| «Resumo do dia · escrito pela IA às 11:30 ET» (H l.536; H data `infos.ia`: «O resumo sai meia hora depois da sua janela, com ou sem revisão») | Phase 8, hidden | none |
| «Revisão do dia» «2 minutos · tudo opcional», «Escrever revisão», «Editar», «Ver revisão» / «Esconder revisão» (H l.544–546, l.787) | as board | `review` |
| «O diário registrou:» + facts sentence (H l.551; H data `revisao.registrou`: «3 operações · 2 dentro da janela e 1 fora, às 11:12 · nenhuma no bloqueio · limite: US$ 11 de US$ 400 no pior momento · viés marcado antes de 2 das 3») | ADAPTED: without «bloqueio» and «viés» (Phase 5) | `facts` (live) / `review.auto_summary` (frozen) |
| «O que funcionou?», «O que você faria diferente?» (form, H l.552, l.560; saved view «O que faria diferente?» l.552), «Seguiu o plano?» «Sim» «Em parte» «Não» + «Pela sua resposta, depois do resultado. O diário conta à parte.» (l.562), «Levar para o próximo pregão» placeholder «Aparece no plano de amanhã» (l.563), «Salvar revisão», «Cancelar» (l.564), «Salva às {h} · Seguiu o plano? {x} · pela sua resposta, depois do resultado» (script l.741), «salva às {h}, editada às {h}» (l.785), «Revisão salva às {h}.» (l.786), «Não preenchido» (l.719) | as board | `day_reviews` |
| D data `revisao.como` («Frustrado», «Ansioso») | STALE: in the data, on no form or view of the board | not stored |

### 1.3 The week, the footer

| Element | Phase 4 | Data |
|---|---|---|
| «Semana» «23 a 27 de novembro · 4 pregões» (D data `semana.titulo`) | as board; ADAPTED «pregões» = days with diário trades (no holiday source) | `weeks[]` |
| Tiles «Resultado», «Operações», «Fora do plano» («3 · −US$ 102,50»), «Viés marcado antes» (D data `semana.numeros`) | «Viés marcado antes» hidden (Phase 5) | `weeks[]` of `diario_calendario` (money) and of `diario_mes` (`fora`) |
| Bars per weekday, «feriado» bar | bars as board; feriado Phase 5 (Q6) | `days[]` |
| «Fora do plano» list «ter 24 · 11:05 · Compra MES · fora da janela · −US$ 40,00» (D data `foraCurto`) | as board; «contra a regra …» items Phase 5 | `diario_mes.fora_trades[]` |
| «Leitura da semana · escrita pela IA na sexta, 27 nov, às 17:30 ET» (H l.591) | Phase 8, hidden | none |
| «Seu foco da próxima semana · salvo em 28 nov» (H l.594) | no writer in Phase 4 (Q7; the appendix's `weekly_focus` carries a `claim_key` from Padrões, Phase 7) | — |
| «A revisão da primeira semana sai na sexta, 16 out, às 17:30 ET.» (H l.574) | ADAPTED: without the AI («A primeira semana fecha na sexta, 16 out.») | `today`, `desde_day` |
| «Métricas e gráficos ficam em Análises» + «Abrir Análises» (H l.600) | screens' call (Análises is Phase 6) | — |
| «Exportar CSV» + «Com estado, “Posso operar hoje?”, viés e regra.» (H l.605) | Q5 | optional `diario_exportar` |
| «Como o diário grava» (H l.605; H data `infos.grava`: «A cada 5 minutos e a cada mudança, o Binary Hub guarda o estado dos seus ativos…») | STALE until Phase 5 (rewrite for what Phase 4 records) | — |
| «Apoio à decisão, não recomendação de investimento. Resultados do arquivo da corretora, sem custos.» (H l.607) | ADAPTED by Q3 | — |

### 1.4 The owner's test

«Seus dias reais; depois, `/trades` passa a abrir `/diario`.» Real days mean: the Top One accounts' history (hatched),
their live days since v1, the Ebinex history and its diário days, partial exits and stop moves from 3c, files imported by
columns (3b), and at least one day with a review and its carry-over the next trading day.

---

## 2. As built: what Phase 4 reads

Short inventory of what the design leans on (the sibling survey has the full one).

### 2.1 Tables

| Table | Phase 4 reads | Notes |
|---|---|---|
| `trading_accounts` | `id, user_id, label, market, currency, day_tz, day_start_min, archived_at, is_example, tz_applied_at, file_tz` | `market_caps(market).currency` is authoritative for money |
| `trades` | `id, account_id, user_id, source, status, symbol, asset_type, direction, quantity, entry_price, exit_price, stake_amount, payout_percent, duration_seconds, stop_price, target_price, entry_time, exit_time, expires_at, registered_at, exit_registered_at, trading_day, pnl, result, commission, pnl_basis, note, note_saved_at, import_batch_id, source_local_entry, rule_version_id` | index `trades_user_acc_day (user_id, account_id, trading_day)` serves every Phase 4 query |
| `trade_entry_context` | the frozen gate at entry (`origin` live/reconstructed) | its existence = "registered in the app" |
| `trade_marks` / `trade_marks_v` / `trade_marks_now_v` | marks with `limpa` (before the first exit, the result, the app's exit) | `add_marks` works on any trade of the owner (imported too; never `limpa`) |
| `trade_exits` / `trade_exits_v` (`counts`) | partial and file exits | open trades with partials have `pnl = null`; their money is only in `trade_exits_v` |
| `trade_stop_moves` / `trade_stop_moves_v` (`ao_vivo`) | stop moves, breakeven | |
| `trade_attachments` (`status = 'ok'`, `position`, `path`, `name`, `bytes`) | images | bucket `trade-images`, select policy own folder |
| `trade_import_links`, `import_batches` | «Importado em», the file's own instants | |
| `account_rule_versions` (`effective_from`, `resolved` with `windows`, `window_rule`, `limit`, `breakeven`, `day`) | the plan | append-only, server-dated |
| `trading_sessions` (legacy; per user per browser date) | only counted by the kit's diagnostic (§13.1) | no page writes `session_notes`/`lessons_learned`/`followed_plan` (`savePostSessionReview` is unused); `/premarket` writes `premarket_notes` |

### 2.2 Functions Phase 4 calls (none is replaced)

- `compute_trading_day(account, at)`, `rule_version_at(account, at)`, `trading_day_on`, `window_occurrences` (Phase 2).
- `limit_usage(account, day, soma, amount, until)` (3c, `20261023000002` l.434): the day's realized net, worst point and
  `hit_at`, per counting exit, on the trade's entry day; `soma` sums the owner's active futures accounts.
- `gate_at(account, at)` (authenticated; checks `auth.uid()`): the «Posso operar hoje?» at any instant. `auth.uid()` reads
  the JWT setting, so a `SECURITY DEFINER` caller acting for the owner can call it.
- `trade_state(trade)` (internal since `20261023000003` l.2319): everything about one trade (trade, version, context,
  gate, plan, marks, marks_now, images, exits, stop_moves, position with R, breakeven). Parsed in the app by
  `parseTradeState` (`registrarDb.ts:542`).
- `trade_context_from_gate(gate)`, `trade_entry_plan(ctx)` (internal): the plan of a gate answer.
- `rules_limit_amount(resolved)`, `market_caps(market)`, `trade_match_key`, `trade_instrument`.

### 2.3 Facts that shape the design

1. **Trading days are canonical and frozen.** `trades_bridge` writes `trading_day` on insert and on `entry_time` change;
   a later version never moves a past day (`rule_version_at(entry_time)` picks the version in force then). Every Phase 1–3c
   migration proves `trading_day_drift = 0`.
2. **Overnight windows** put trades whose wall-clock date differs from their trading day (Ebinex 23:30–00:30 → the day it
   opened; futures Sunday 19:00 ET → Monday). A day's trades are those with `trading_day = d`, never an instant range.
3. **Weekend trading days exist** for binary and Cripto (midnight Brasília day clock). Futures and Forex Sunday sessions
   count on Monday (day turns 18:00 / 17:00 New York); Ações turns at 20:00 New York (no weekend session in the owner's
   markets); B3 is Monday to Friday.
4. **The API cuts lists at 1 000 rows** (`config.toml:9`; 3b found it in production, commit `4be8200`). An RPC returning
   one `jsonb` value is one row and is never cut; a `returns table`/`setof` RPC would be.
5. **Money is in the account's currency**; `limit_usage` keys say `net_usd` whatever the currency (2b note in
   `20261019000001`).
6. **History is per trade**: `marcaDoPlano` shows «Histórico importado · só resultado» when the window check is
   `sem_versao`; the import counts «Antes de {d} (início das regras): {n} vão para Histórico importado · só resultado.»
   by instant against v1's `effective_from` (`lib/hub/regrasConta.ts:391`).
7. **The bridge** (`readDayTradesRows`) reads app trades only (`source in ('live','after')`), by REST, several queries; it
   retires in 4-3.

---

## 3. Concepts

### 3.1 Trading day and calendar date

A calendar cell is a date; it holds the trades with that `trading_day`. The account's trading day today is
`compute_trading_day(account, now())` (`today` in every answer), the same value `rules_now` gives the «Posso operar
hoje?» card. Future cells have no data. A trade whose entry wall-clock date (on the window clock) differs from its trading
day keeps its date in the day's table («dom, 19:00»; the bridge already prints «ontem, 10:52»).

### 3.2 Diário, history, mixed

```
history(trade) := v1 is null or trade.entry_time < v1.effective_from      -- v1 = the account's version_no 1
kind(day)      := 'historico' if every trade of the day is history
                  'diario'    if none is
                  'misto'     otherwise (only the day v1 took effect)
                  'vazio'     no trade (a cell «—»; a diário weekday before today shows «sem op.»)
```

- History trades show with their result only: no plan, no review block on a `historico` day, no marks editor, no
  «Adicionar imagens ou nota» (the board's `temMarcasEd: !det.importado`, script). Their day «Importado em {date}» comes
  from the newest `import_batches.created_at` of the day's trades (`import_batch_id`; for app trades linked by a file,
  `trade_import_links.linked_at`).
- On a `misto` day the diário part is the day; the history part appears in the table with «Histórico importado · só
  resultado» and in the tiles' ⓘ as «+ {n} do histórico, à parte: {net}» (NEW).
- Old-page trades (`source = 'after'`, no context) and file-only trades at or after v1 are diário trades with a
  recalculated plan (Q2).
- An account without any version: every day is `historico` (the Registrar already refuses `no_rules` there).

### 3.3 The week, per market

`week_of(day) = date_trunc('week', day)::date` (ISO, Monday). The Semana column sums the diário days of that ISO week.

| Market | Day clock | Trading days that occur | Week |
|---|---|---|---|
| Futuros | 18:00 New York | Mon–Fri (the Sunday 18:00 open counts on Monday; Friday ends 17:00) | Mon–Fri |
| Forex | 17:00 New York | Mon–Fri (Sunday 17:00 counts on Monday) | Mon–Fri |
| Ações e opções (EUA) | 20:00 New York | Mon–Fri (a Friday after 20:00 would be Saturday; no such session in use) | Mon–Fri |
| B3 | midnight Brasília | Mon–Fri | Mon–Fri |
| Binárias | midnight Brasília | Mon–Sun (Ebinex OTC pairs; the owner's window is Mon–Fri) | Mon–Sun |
| Cripto | midnight Brasília | Mon–Sun (window default every day) | Mon–Sun |

A week is **closed** when `today` is after its last possible trading day (Friday for the first four, Sunday for the last
two). The Semana card shows the newest closed week with diário days (D data: on Tue 1 dez it shows 23–27 nov); before the
first closed week it shows the NEW line «A primeira semana fecha na {weekday}, {date}.» (ADAPTED from H l.574, without the
AI). Weeks never mix accounts.

### 3.4 Money

Per trade, the realized amount follows `limit_usage` exactly:

```
counting exits exist  → Σ over trade_exits_v (counts): pnl − coalesce(commission, 0)   (open trades' partials included)
otherwise             → pnl − coalesce(commission, 0) when pnl is not null and result <> 'pending'
otherwise             → nothing realized (an open trade without partials)
```

`net` = Σ realized, `gross` = Σ pnl of the same exits, `commission` = Σ known commission (null when none is known). The
day result is `net` of the diário trades (Q3 decides which one the tile shows; the other goes to the ⓘ, as 3b's
«Bruto +US$ 103,75 · comissões −US$ 34,72.»). Wins, losses and «no zero a zero» count closed trades by `result`; open
trades count apart («1 aberta»). Amounts leave SQL as JSON numbers from `numeric` sums; JavaScript never adds money (the
week totals come from SQL, §5.1).

### 3.5 The plan of a trade

```
plan(trade) := history(trade)              → null («Histórico importado · só resultado»)
               trade has an entry context   → frozen: trade_entry_plan(context)           kind 'congelado'
               otherwise                    → recalculated: trade_entry_plan(trade_context_from_gate(
                                                gate_at(account, entry_time)))             kind 'recalculado'
```

`gate_at` at the entry uses the version then in force, the window occurrences and the day's realized money up to the
entry, exactly as `register_after` evaluates a «Já fechada» entry. One edge: a file row whose exit equals its entry instant
would count in its own limit; the helper then evaluates at `entry_time − 1 µs` for that trade only (documented, tested).
The block and the state rule stay «não avaliado» until Phase 5, as at registration.

### 3.6 The plan of a day

```
day_end(d)  := (d + day_start_min) at day_tz      when day_start_min > 0     (gate_eval's day_end)
               (d + 1)::timestamp at day_tz        otherwise
plan_at(d)  := least(now(), day_end(d) − 1 µs)
version(d)  := rule_version_at(account, plan_at(d))
changes(d)  := versions with effective_from in [day_start(d), plan_at(d)) other than version(d), oldest first
```

- «Janela»: `version.resolved.windows` (0..2; tz, start, end, weekdays) and `window_occurrences` opening on day d (none on
  a weekday the window skips: «Sem janela neste dia», NEW). Fact: of the diário trades whose plan evaluated the window,
  how many were inside, and the times of those outside.
- «Limite»: `rules_limit_amount(version.resolved)`, `limit.mode`, `limit.at_limit`; fact from `limit_usage(account, d,
  mode = 'soma', amount, 'infinity')`: `worst`, `hit_at`, and the trades marked «depois do limite».
- «Mover para o breakeven» (NEW): `version.resolved.breakeven.by` (assets and +N with unit); fact: diário trades of those
  assets, and how many have a breakeven stop move not undone (any origin). Neutral mark «Registrado».
- When `changes` is not empty, a NEW line names each earlier version and what differed (window, limit, breakeven), e.g.
  «Até 10:45 valia a versão 3: limite US$ 400.»

Why the end of the day: for today it is the version the «Posso operar hoje?» card shows on the same page; for a past day
it is the plan the day ended under, and the line keeps the earlier one visible. Trades are judged by their own entry
version either way.

---

## 4. Schema

One table and one view. No column is added to an existing table; no existing row is written.

### 4.1 `day_reviews` (NEW, append-only: Q4 (a))

```sql
create table public.day_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  trading_day date not null,
  -- «O que funcionou?»
  worked text check (worked is null or char_length(worked) between 1 and 1000),
  -- «O que você faria diferente?»
  differently text check (differently is null or char_length(differently) between 1 and 1000),
  -- «Seguiu o plano?» «Sim» «Em parte» «Não» (trade_marks.seguiu_texto's values)
  followed text check (followed is null or followed in ('sim', 'em_parte', 'nao')),
  -- «Levar para o próximo pregão» («Aparece no plano de amanhã»)
  carry_forward text check (carry_forward is null or char_length(carry_forward) between 1 and 200),
  -- «O diário registrou:» frozen: diario_fatos(account, day) at this save (facts, English keys, "v": 1)
  auto_summary jsonb not null check (jsonb_typeof(auto_summary) = 'object' and auto_summary -> 'v' = '1'::jsonb),
  -- Forced to now() by the guard
  saved_at timestamptz not null default now(),
  -- Idempotency of «Salvar revisão» (a retried tap writes nothing)
  client_key uuid,
  foreign key (account_id, user_id) references public.trading_accounts (id, user_id)
);

create index day_reviews_day on public.day_reviews (account_id, trading_day, saved_at desc, id desc);
create unique index day_reviews_client_key on public.day_reviews (user_id, client_key) where client_key is not null;
```

- Texts arrive trimmed by `save_day_review`; an empty text is stored as null. «tudo opcional» (H l.544): every field may
  be null; a row with every field null is a cleared review (`written = false`), which keeps the history.
- Guard `day_reviews_guard` (BEFORE INSERT OR UPDATE OR DELETE, every role, owner included, as
  `trade_children_guard`): insert forces `saved_at := now()`; update raises `append_only`; delete only when the auth user
  is gone (the cascade). Accounts are never deleted (archived), so the account FK needs no cascade.
- At most 50 rows per account and day (`too_many_versions`, checked by the RPC under a row lock on the account): a
  runaway client cannot grow the table without bound.

The current review:

```sql
create view public.day_reviews_now_v with (security_invoker = true) as
select distinct on (r.account_id, r.trading_day)
       r.user_id, r.account_id, r.trading_day, r.id, r.worked, r.differently, r.followed, r.carry_forward,
       r.auto_summary, r.saved_at,
       min(r.saved_at) over w as first_saved_at,
       count(*) over w as versions,
       (r.worked is not null or r.differently is not null or r.followed is not null or r.carry_forward is not null) as written
from public.day_reviews r
window w as (partition by r.account_id, r.trading_day)
order by r.account_id, r.trading_day, r.saved_at desc, r.id desc;
```

«salva às» = `first_saved_at`; «editada às» = `saved_at` when `versions > 1`. A day counts as reviewed («✓», «Revisão
escrita») when its current row is `written`.

If Q4 is (b) (one editable row): the same columns plus `edited_at timestamptz`, `unique (account_id, trading_day)`, the
guard forcing `saved_at` on insert and `edited_at := now()` on update (never `saved_at`), `auto_summary` refreshed at
every save; no view. The RPC's answers are identical, so the domain and the screens do not change.

### 4.2 Access (appendix §A)

```sql
alter table public.day_reviews enable row level security;
create policy "day_reviews select own" on public.day_reviews for select using ((select auth.uid()) = user_id);
revoke all on public.day_reviews, public.day_reviews_now_v from anon, authenticated;
grant select on public.day_reviews, public.day_reviews_now_v to authenticated;
revoke all on sequence public.day_reviews_id_seq from anon, authenticated;
-- service_role: revoke insert, update, delete, truncate (the global-tables rule), inside the usual do-block
```

No insert, update or delete policy: writes only through `save_day_review` (`SECURITY DEFINER`). The end of the migration
checks the privileges as every phase does (`privileges_not_applied`).

### 4.3 Not built (and why)

| Appendix / board | Here |
|---|---|
| `day_reviews.account_id` nullable + `unique nulls not distinct` | ADAPTED: not null (one diário per account); the legacy `trading_sessions` copy is handled by the diagnostic (§13.1, Q8) |
| `weekly_focus (account_id, week_of, claim_key, text, chosen_at)` | deferred to the screen that writes it (Q7; `claim_key` is a Padrões claim, Phase 7) |
| `diario_mes(account, month)` | ADAPTED: kept for the month's plans and limits (§5.1b), plus the light `diario_calendario` for the whole range and `diario_dia` (§0.5) |
| a timeline table or view | Phase 5 (`market_states`, `bias_marks`) |
| holidays, short sessions | Phase 5 with the economic calendar source (Q6) |

---

## 5. RPCs

Conventions as Phases 1–3c: `language plpgsql`, `set search_path = ''`, `SECURITY DEFINER` (they call internal helpers
revoked from `authenticated`), `auth.uid()` first (`not_authenticated`, 28000), the account must be the caller's
(`unknown_account`, 42501: the same answer for someone else's account and for none), every query filtered by `user_id =
uid` (definer functions bypass RLS), errors as bare codes with the field in the HINT, never a value; payloads JSON v1 (`"v":
1`, unknown keys refused, ≤ 8 KB). `revoke all … from public, anon; grant execute … to authenticated`. Reads are `stable`.

### 5.1 `diario_calendario(p_account uuid, p_from date default null, p_to date default null) returns jsonb`

The light calendar of one account: every trading day with trades between `p_from` (default: the first) and `p_to`
(default: `today`), with weeks. No plan and no limit are computed here (no `gate_at`, no `limit_usage`, no
`rule_version_at` per day), so its cost grows only with a cheap per-trade money lateral. It is enough for the heat levels,
✓ and ▨, the pending-reviews banner, the top line and the weeks' money. One call per account, cached; months are
client-side slices. `bad_range` when `p_to < p_from` or the span exceeds 1 500 days (the screen pages by year past that;
the owner's history starts in May 2026).

```json
{
  "v": 1, "server_now": "…",
  "account": {"id": "…", "label": "Top One", "market": "futures", "currency": "USD",
              "day": {"tz": "America/New_York", "start_min": 1080}, "archived": false,
              "tz_confirmed": true, "guessed_clock": 0},
  "today": "2026-12-01", "desde": "2026-10-14T13:02:11Z", "desde_day": "2026-10-14",
  "first_day": "2026-05-04", "last_day": "2026-12-01",
  "days": [
    {"day": "2026-10-13", "weekday": 2, "kind": "historico", "n": 0, "app": 0, "open": 0, "wins": 0, "losses": 0,
     "even": 0, "net": 0, "gross": 0, "commission": null, "review": null,
     "history": {"n": 3, "wins": 2, "losses": 1, "even": 0, "net": 82.50, "gross": 82.50}, "imported_at": "2026-10-13T…"},
    {"day": "2026-11-19", "weekday": 4, "kind": "diario", "n": 5, "app": 5, "open": 0, "wins": 0, "losses": 5, "even": 0,
     "net": -453.00, "gross": -453.00, "commission": null,
     "review": {"first_saved_at": "…", "saved_at": "…", "versions": 1}, "history": null, "imported_at": null}
  ],
  "weeks": [
    {"week_of": "2026-10-12", "days": 3, "n": 10, "net": 347.00, "gross": 347.00, "history": {"n": 7, "net": 21.25}}
  ]
}
```

- `days` only lists dates with at least one trade (any kind); the grid fills the rest. `app` = the day's diário trades with
  an entry context (registered in the app, D26 of the synthesis): the pending-reviews banner, the «Sem revisão» tag and the
  week's «Revisões» count only days with `app > 0` or a written review. `review` is present only when the current row is
  `written`.
- `weeks` are SQL sums over the diário days (`group by date_trunc('week', trading_day)`), plus the history apart.
- Sketch of the core (the real body keeps every filter on `uid`):

```sql
with acc as (...), v1 as (select v.effective_from from public.account_rule_versions v
                          where v.account_id = p_account and v.version_no = 1),
tr as (
  select t.id, t.trading_day as day, t.entry_time, t.status, t.result,
         ((select effective_from from v1) is null or t.entry_time < (select effective_from from v1)) as history,
         exists (select 1 from public.trade_entry_context c where c.trade_id = t.id) as app,
         m.net, m.gross, m.commission, m.realized
  from public.trades t
  cross join lateral public.diario_money(t.id) m            -- §5.5, limit_usage's rule
  where t.user_id = uid and t.account_id = p_account and t.trading_day between d_from and d_to
)
select ... group by day ...
```

### 5.1b `diario_mes(p_account uuid, p_month date) returns jsonb`

The heavy part of the calendar, for one month as the screen shows it: `p_month` is truncated to its month, and the range
is the ISO weeks that cover it (from the Monday on or before the 1st to the Sunday on or after the last day), so a week
that straddles two months is whole in both answers. Days after `today` are left out. Same checks as §5.1 (`unknown_account`
etc.); no new error code.

```json
{
  "v": 1, "server_now": "…", "month": "2026-11", "from": "2026-10-26", "to": "2026-12-06", "today": "2026-12-01",
  "days": [
    {"day": "2026-11-19", "fora": {"n": 1, "net": -37.50}, "recalculated": 0,
     "limit": {"amount": 400, "scope": "conta", "at_limit": "encerrar", "worst": -453.00, "hit_at": "2026-11-19T15:38:00Z"}}
  ],
  "weeks": [{"week_of": "2026-11-16", "fora": {"n": 1, "net": -37.50}}],
  "fora_trades": [
    {"trade_id": "…", "day": "2026-11-24", "entry_time": "…", "symbol": "MES", "direction": "long",
     "breaks": ["fora_da_janela"], "net": -40.00, "plan_kind": "congelado"}
  ]
}
```

- Only diário days appear (history days have no plan). Per day: `fora` and `recalculated` from `diario_trade_plan` (§5.5:
  frozen for app trades, `gate_at` for file-only and old-page trades), `limit` from §3.6 (`version(d)`, its amount and
  scope, `limit_usage(…, 'infinity')`; null without a limit in that version). Each day's `fora` and `limit` equal
  `diario_fatos(p_account, d)`'s (SQL test, §12.1 group 6).
- `fora_trades` lists the diário trades of the range whose plan verdict is `fora_do_plano` (frozen or recalculated), for
  the week card, the ● marks and the hover; typically a handful per week.
- Cost: one `gate_at` per file-only diário trade of those five or six weeks, one `rule_version_at` and one `limit_usage`
  per diário day. For the owner's busiest Ebinex month (about 150–200 file-only trades) this is the heaviest read of the
  phase; `cronometrar.sh` times it (§9.2) and it stays the same however long the history gets.

### 5.2 `diario_dia(p_account uuid, p_day date) returns jsonb`

Everything the open day shows, in one call (also for a day without trades: today before trading shows the plan).

```json
{
  "v": 1, "server_now": "…", "account": {…as 5.1…}, "today": "…", "desde": "…", "desde_day": "…",
  "day": "2026-11-19", "weekday": 4, "kind": "diario",
  "plan": {
    "version": {"id": "…", "version_no": 4, "effective_from": "…"},
    "rules": { …the Resolved of that version… },
    "windows_today": [{"opens_at": "…", "closes_at": "…", "tz": "America/New_York"}],
    "changes": [{"version_no": 3, "effective_from": "…", "until": "…", "rules": { … }}]
  },
  "facts": { …diario_fatos(p_account, p_day), §5.4… },
  "trades": [
    { …trade_state(t.id) − 'server_now'…,
      "history": false, "plan_kind": "congelado", "plan_now": null,
      "clock_guessed": false, "imported_at": null }
  ],
  "open_elsewhere": [{"trade_id": "…", "trading_day": "2026-11-18"}],
  "deleted": [{"at": "2026-11-19T15:20:00Z", "via": "apagada"}],
  "review": {"id": 12, "worked": "…", "differently": "…", "followed": "nao", "carry_forward": "…",
             "auto_summary": { … }, "first_saved_at": "…", "saved_at": "…", "versions": 2, "written": true},
  "carry_in": {"day": "2026-11-18", "text": "Não aumentar a mão depois de uma perda."}
}
```

- `trades` = the account's trades with `trading_day = p_day`, by `entry_time, id`, each exactly `trade_state(id)` without
  `server_now` (the drill parses it with the existing `parseTradeState`; parity with the Registrar by construction) plus:
  `history` (§3.2), `plan_kind` (`congelado` | `recalculado` | null), `plan_now` (the recalculated plan, same shape as
  `trade_state.plan`; null for frozen and history trades), `clock_guessed` (`source = 'import' and source_local_entry is
  not null and account.tz_applied_at is null`: the screen hides the hour, as the board's `horaVis` did), `imported_at`.
- `open_elsewhere`: the account's open trades of other days (they stay on the day they opened; today's view points to them,
  replacing the bridge's «ontem, 10:52» rows).
- `deleted`: the account's `trade_deletions` rows with `trading_day = p_day`, by `deleted_at`: only `at` and `via`
  (`apagada` = deleted on the old page; `desfazer_entrada` = the Registrar's 15-minute undo; `20261020000001` l.530, l.551).
  No values: the table keeps none. The screen shows only `apagada` («1 operação registrada foi apagada às 10:20.»); both are
  returned for Padrões (Phase 7). Rows exist only for trades that had an entry context (the trigger joins it).
- `review`: the current row of `day_reviews_now_v` (null when there is none).
- `carry_in`: the newest current review of this account with `trading_day < p_day` and a non-null `carry_forward` (D data
  1 dez reaches back to 27 nov); null on `historico` days.
- Days in the future answer `kind: 'vazio'` with the plan of `now()`'s version (harmless; the screens do not open them).

### 5.3 `save_day_review(p_account uuid, p_day date, p_review jsonb, p_dry_run boolean default false) returns jsonb`

```json
{"v": 1, "client_key": "uuid (not on a dry run)", "worked": "…" | null, "differently": "…" | null,
 "followed": "sim" | "em_parte" | "nao" | null, "carry_forward": "…" | null}
```

Order of checks: `not_authenticated`; `unknown_account`; `archived_account` (as the Registrar); payload shape
(`bad_payload`, `payload_too_large`, `unknown_key`, `bad_rules_version` for `v`, `bad_client_key`); `bad_day` (not a
date); `no_rules` (the account has no version); `before_rules` (`p_day < desde_day`: a history day has no review);
`day_in_future` (NEW: `p_day > today`); `bad_text` (field `worked` | `differently` | `carry_forward`: not a string or too
long after trimming); `bad_followed`; under `pg_advisory_xact_lock(hashtextextended('day_review:' || uid, 0))` (as
`trade_reg:`), `too_many_versions` (NEW). Then:

- the same `client_key` already stored → the current review, `repeated: true`, nothing written;
- the content equals the current row's → `repeated: true`, nothing written (a second tap on «Salvar revisão»);
- otherwise insert with `auto_summary := diario_fatos(p_account, p_day)` (computed by the server, never sent).

Dry run: the validation and `facts_now`, nothing written. Answer: `{"v": 1, "server_now", "dry_run", "repeated",
"review": {…as 5.2…}, "facts_now": {…}}`. Reviews are allowed on any diário day up to today, with or without trades (the
screens show the block on days with diário trades and on today). No hub-membership check (own text, bounded; images are the
only paid resource).

### 5.4 `diario_fatos(p_account uuid, p_day date) returns jsonb` (internal)

The one definition of a day's facts, used by `diario_dia` (`facts`) and `save_day_review` (`auto_summary`):

```json
{"v": 1, "day": "2026-10-14", "kind": "diario",
 "trades": 3, "closed": 3, "open": 0, "wins": 1, "losses": 2, "even": 0,
 "net": -11.00, "gross": -11.00, "commission": null,
 "window": {"rule": true, "evaluated": 3, "inside": 2, "outside": [{"trade_id": "…", "at": "2026-10-14T15:12:00Z"}]},
 "limit": {"amount": 400, "scope": "conta", "at_limit": "encerrar", "worst": -11.00, "hit_at": null,
           "after": [{"trade_id": "…", "at": "…"}]},
 "fora": {"n": 1, "net": -33.00}, "others_net": 22.00,
 "recalculated": 0,
 "history": {"n": 0, "net": 0},
 "breakeven": {"by": {"MES": {"n": 8, "un": "pts"}}, "trades": 2, "moved": 1},
 "version": {"id": "…", "version_no": 3}, "changes": 0}
```

`window` is null when the version has no window or the rule is off (the sentence then omits it); `limit` null without a
limit; `breakeven` null without the rule. Trade times are instants; `lib/hub` writes them on the account's window clock
(«às 11:12»). Phase 5 adds keys (bloqueio, viés, estado) under `"v": 1` as optional keys or bumps `"v"`; frozen summaries
keep their own `v`, so old reviews render as they were.

### 5.5 Internal helpers

| Function | Returns | Notes |
|---|---|---|
| `diario_money(p_trade uuid)` | `(realized boolean, net numeric, gross numeric, commission numeric)` | §3.4; the SQL test proves Σ per day = `limit_usage(…).net_usd` |
| `diario_trade_plan(p_trade uuid)` | `jsonb {"kind", "plan", "gate"}` | §3.5; `gate_at` for recalculated plans |
| `diario_day_end(p_day date, p_tz text, p_start int)` | `timestamptz` | `gate_eval`'s expression, factored |
| `diario_fatos(p_account uuid, p_day date)` | `jsonb` | §5.4 |

All `revoke all … from public, anon, authenticated` (they run only inside the definer RPCs).

### 5.6 Optional (only with Q5 (b))

- `delete_trade(p_trade uuid) returns jsonb {"deleted": true, "trash": [paths]}`: the old page's delete through the server
  (`unknown_trade`; any source, as the old page; the existing `trades_delete_log` records app trades with `via =
  'apagada'`; images go to `trade_image_trash`, the browser drains them with `drainImageTrash`). Lets Phase 9 revoke the
  API's `DELETE` on `trades` (`20261020000003` l.1614).
- `diario_exportar(p_account uuid, p_from date, p_to date) returns jsonb` (an array; ≤ 10 000 trades, `too_many_rows`):
  per trade the trading day, entry and exit instants, symbol, side, quantity, prices, gross, commission, net, source, plan
  verdict and breaks (frozen or recalculated), «Posso operar hoje?» at entry, the current marks and whether `limpa`, image
  count, the note. The CSV is built in the browser (`lib/domain/diario/csv.ts`; `;` separator and decimal comma, UTF-8
  with BOM, instants on the account's window clock with the zone named).

### 5.7 Error codes

NEW: `day_in_future`, `too_many_versions`, `bad_text`, `bad_followed`, `bad_range` (+ `too_many_rows` with Q5 (b)).
Reused: `not_authenticated`, `unknown_account`, `archived_account`, `unknown_trade`, `bad_payload`, `payload_too_large`,
`unknown_key`, `bad_rules_version`, `bad_client_key`, `bad_day`, `no_rules`, `before_rules`, `append_only`. Add the new
ones to `RPC_ERROR_CODES` (`app/lib/hub/contasDb.ts:17`) and to the twin's code list.

---

## 6. The day's facts in words (domain + `lib/hub`)

The SQL returns facts; `lib/hub/diario.ts` writes pt-BR (CLAUDE.md: «The pt-BR words live in `app/lib/hub/…`»):

- «O diário registrou:» from `facts`: «{n} operações · {inside} dentro da janela e {k} fora, às {hh:mm[, hh:mm e hh:mm]} ·
  limite: {worst} de {amount} no pior momento» (ADAPTED from H data `revisao.registrou` without «bloqueio» and «viés»);
  «limite atingido às {hit}» and «{k} depois do limite, às {…}» when they apply (D data 19 nov); «Nenhuma operação.»
  (NEW) on a day reviewed without trades.
- Tiles from `facts` (H data `resumo`): «{n}», «{w} ganho(s), {l} perda(s)[, {e} no zero a zero]», «{worst} de
  {amount}», «no pior momento do dia[ · atingido às {hit}]», «{k} operação(ões) · {net}», «as outras {m}: {others_net}».
- When the frozen `auto_summary` differs from the live `facts` on `trades` or `net` (the account's own), a NEW line under
  the saved review: «Depois da revisão, o dia mudou: agora {n} operações, {net}.» (an import or an undo changed the day).
  Not on `limit.hit_at` alone: under «somando» it can move because of another account (an import there, or an archived
  account leaving the scope), and the sentence would repeat unchanged numbers.

---

## 7. Images: signed URLs from the private bucket, in the browser

- Read path as built: the bucket `trade-images` is private; the select policy lets the signed-in user read their own folder
  (`20261020000002` §3). `createSignedUrl` checks it when the URL is created; the URL is then a bearer link (D33 in the
  Phase 3 synthesis: «anyone holding the link can open the image»), 10 minutes (`SIGNED_URL_SECONDS = 600`).
- Phase 4: one `db.storage.from('trade-images').createSignedUrls(paths, 600)` per opened drill (all its saved images), not
  per thumbnail and never for the calendar. A path whose entry carries `error` shows the image's name without a thumbnail.
  The URLs live in React Query with `staleTime` 9 minutes; an `<img>` that fails after that re-signs once.
- Never: an API route that proxies images, a signed URL in our own page URL or logs, `download`, `upsert`, a signed upload
  URL (`storageUploads.test.ts` keeps those out). Image transformations (thumbnail resizing) are a paid Supabase feature:
  the full WebP is shown scaled, `loading="lazy"`.
- The day RPC returns only metadata (`path`, `name`, `position`, `bytes`, `saved_at`). Paths carry the user's id and the
  trade's; they are the owner's own and never leave the browser.
- Images on history trades are not offered (board); images on any diário trade (imported included) work as built
  (`image_slots` and `save_extras` accept any trade of a hub member).

---

## 8. The timeline placeholder

Nothing in the database. `diario_dia` reserves no key; Phase 5 adds `timeline` (market states per symbol, the gate band,
bias marks, AI readings) and the appendix's «retrabalho … cerca de 2 dias dentro da Fase 5» (§E) lands there. The screen
shows the block titled «Linha do tempo» with «chega na Fase 5» (ADAPTED from H l.385). Not proposed: a partial timeline
now (window band, entries, gate band are computable today), because the plan says placeholder and the Phase 5 timeline
would redraw it.

---

## 9. Performance

### 9.1 One RPC per view, not client reads

| | RPCs (recommended) | Client reads under RLS (the bridge's way) |
|---|---|---|
| Row limit | one `jsonb` row, never cut | every list cut at 1 000; needs `readAll` paging (3b's fix) |
| Round trips | calendar 1, day 1 | day: trades + contexts + images + exits + moves + marks + versions (7+); calendar: all trades of the account |
| Rules | `limit_usage`, `gate_at`, `trade_state` reused in SQL: parity by construction | money, recalculated plans and history split re-implemented in TS (twins to keep equal) |
| Cost | SQL to write and test (4-1) | TS to write and test, more parity cases |

### 9.2 Expected cost and indexes

- Calendar (light, §5.1): one index range scan of `trades_user_acc_day (user_id, account_id, trading_day)`; per trade a
  lateral on `trade_exits_v` (index `trade_exits_trade`) and `trade_entry_context` (PK). No `gate_at`, `limit_usage` or
  `rule_version_at`. It grows linearly and cheaply with history (633 trades on 22 Oct over six accounts; Ebinex adds about
  150–200 a month).
- Month (§5.1b): per diário day of five or six weeks one `rule_version_at` (`account_rule_versions_at`) and one
  `limit_usage`; per file-only diário trade one `gate_at`. Almost every diário trade arrives only from a file (4 were
  registered in the app on 22 Oct), so this is the expensive read; reading it per month keeps it flat instead of growing
  every month, as a whole-range plan pass under `refetchOnWindowFocus` would.
- Day: `trade_state` per trade (≈ 10 sub-selects each, all indexed); an Ebinex day of 30 trades stays well under 100 ms.
  The answer is ≈ 2–3 KB per trade.
- New index only `day_reviews_day` (+ the partial unique on `client_key`). No index on existing tables.
- The kit's `cronometrar.sh` (3c pattern) times, per account on the live data, `diario_calendario` over the whole range,
  `diario_mes` for the month with the most file-only diário trades, and the heaviest `diario_dia`, cold and warm, and prints
  durations and counts only. 4-3 merges after the owner sends them back.

### 9.3 Client cache and invalidation (4-2)

- Keys under `['hub', uid, 'diario', accountId]`: `calendario`, `mes(month)`, `dia(day)`, and `imagens(tradeId)`.
  `refetchOnWindowFocus: 'always'` only for the light calendar, the current month and today's day; past months and past
  days refetch only when a write stales them.
- Every write stales the account's whole prefix, and React Query refetches only the queries on screen (the month shown,
  the open day): every Registrar write (`REGISTRAR_INVALIDATIONS`, `marcas` included: today it invalidates nothing and the
  day shows marks; `extras` also the images key), import commit and undo, `save_rules`, `save_day_review`.

---

## 10. `/trades` → `/diario`

- Mechanism: `next.config.js` `async redirects() { return [{ source: '/trades', destination: '/diario', permanent: false }] }`
  (307: browsers do not cache it; Phase 9 decides permanent redirects). Query strings pass through. Runs before any
  render on Vercel (`vercel build` applies Next's redirects) and in `next dev`. A Jest test reads `next.config.js` and pins
  the rule. With Q5 (a) the rule gains `missing: [{ type: 'query', key: 'antiga' }]`, and the Diário's footer links
  `/trades?antiga=1` («Página antiga de operações», NEW) until Phase 9.
- Effects: the old `Navbar` «Operações» and the old dashboard's links reach the Diário through the redirect (old pages'
  look unchanged); `/trades` was `ProtectedRoute` only, `/diario` is behind `HubGate` (the owner's two logins are hub
  members); the bridge, the placeholder and its «Abrir Operações» link leave `/diario` in 4-3; the old component stays in
  the tree until Phase 9 (its tests render the component, not the route).
- Order: its own PR (4-4) after the owner's test of the Diário, as the owner test says «depois».

---

## 11. Domain and data layer (4-2)

### 11.1 `app/lib/domain/diario/` (English, pure)

| Module | What | Twin of SQL? |
|---|---|---|
| `calendario.ts` | `monthGrid(month, days, columns)` (weeks of Mon–Fri, or Mon–Sun per Q1), `heatLevel(days)` (quadros §5.9: diário days by the quartiles of the diário days, gains and losses apart; history days by their own quartiles; a misto day by its diário net; 0 for none; comparisons only), `isClosedWeek(weekOf, today, market)`, `pendingReviews(days, today)` (diário days before today with `app > 0` and no written review; «nas últimas 4 semanas» = day ≥ today − 28) | `week_of` and `kind` pinned by `cases4.json` |
| `revisao.ts` | `checkReviewPayload(p)` with the SQL's codes and order; `reviewPayload(form, clientKey)` (trim, empty → null) | yes: `cases4.json.review` |
| `fatos.ts` | typed `DayFacts` parser helpers (`factsChanged(frozen, live)`) | no (SQL computes facts) |
| `csv.ts` (Q5 b) | the export's rows → CSV text | no |

### 11.2 `app/lib/hub/`

- `diarioDb.ts`: `fetchCalendario`, `fetchMes`, `fetchDia` (reusing `parseTradeState` for each trade), `saveDayReview`,
  `signedImageUrls(db, paths)` (batch, per-path errors), parsers that reject another shape (`bad_answer`, as
  `registrarDb`), the new error codes.
- `diario.ts`: the pt-BR words (§6), the calendar hover («5 out · +US$ 218,50 · 3 op.: 3 ganhos, 0 perdas · importado, só
  resultado»), plan lines, review labels.
- Hooks `hooks/useDiario.ts` with the keys of §9.3; `REGISTRAR_INVALIDATIONS` extended.
- Names: `DiaryDayTrade` (not `DayTrade`: two types already use that name, `registrarDb.DayTrade` and
  `domain/gate/usage.DayTrade`).

---

## 12. Tests

### 12.1 SQL: `supabase/tests/83_diario.test.sql` (next free number after 82)

Runs after `82_importacao_colunas` on the same database, with users of its own (`…-000000000083`), invented data, the 50
helpers in schema `tests`, fixed October–December 2026 days except where the server's `now()` matters. Groups:

1. **Access**: anon cannot execute any RPC; user B gets `unknown_account` for A's account on both reads and the write;
   B's `select` on `day_reviews` sees none of A's rows; `authenticated` has no insert, update, delete or truncate on
   `day_reviews` and its view; `service_role` cannot write; the internal helpers are not executable by `authenticated`.
2. **Money = limit**: for every account and every trading day of the seeded data (closed trades, a binary refund, an
   open trade with two partials, commissions known and unknown, file exits and app exits on one trade), Σ `net` of the
   calendar's diário + history = `limit_usage(account, day, false, null, 'infinity').net_usd`, and the diário part alone
   matches a hand-computed value.
3. **History boundary**: trades before and after v1 on v1's own day (`misto`), a day wholly before (`historico`), an
   account without versions (all `historico`); history never enters `net`, `weeks.net` or `fora`.
4. **Trading days and weeks**: a futures trade Sunday 19:00 ET on Monday's cell and Monday's week; Ebinex 23:30–00:30
   window trade at 00:10 on the previous day; a binary Saturday and a Cripto Sunday in their own Mon–Sun week; DST weeks
   in New York (8 Mar, 1 Nov 2026).
5. **Plans per trade**: frozen context kept (app live and «Já fechada»), recalculated for a file-only and an old-page
   `after` trade (window, limit, `soma` scope across two futures accounts), the exit-at-entry edge, nothing for history.
   Archived account under «somando»: archiving one of two futures accounts changes a past day's `diario_mes` limit and a
   recalculated plan exactly as `limit_usage` and `gate_at` change, leaves frozen plans alone, and does not make
   `factsChanged`-relevant keys (`trades`, `net`) of the other account move.
6. **Plan of the day**: version at the end of a past day; today = `rules_now`'s version; a version saved mid-day listed in
   `changes`; a weekday the window skips; no limit; breakeven facts (moved / not moved, undone move ignored). For every
   diário day, `diario_mes`'s `fora` and `limit` equal `diario_fatos`'s; a straddling week is whole in both months.
7. **`diario_dia` trades**: each element minus the Phase 4 keys equals `trade_state(id) - 'server_now'`; order by entry;
   `open_elsewhere`; `clock_guessed` on an unconfirmed account; `imported_at` from batch and link; `deleted` with one
   `apagada` and one `desfazer_entrada` row on the day, none from another day or account.
8. **Carry-over**: the newest earlier current review with a carry-over, across a weekend and a day without trades; a
   cleared newer review hides an older text; none on history days.
9. **`save_day_review` validation**: every code in §5.3 in its order (one case each), trimming, empty → null, 1 000 / 200
   boundaries.
10. **Server time and append-only**: `saved_at` forced (a sent value ignored), update and delete refused (`append_only`),
    the auth cascade passes; `first_saved_at` / `versions` / `written` in the view; `repeated` by `client_key` and by equal
    content; `too_many_versions` at 51.
11. **Frozen summary**: `auto_summary` = `diario_fatos` at the save; after an import adds a trade to that day the live facts
    differ and the frozen ones do not.
12. **Row limit**: an account with 1 200 trading days (generated) answers all 1 200 `days` of `diario_calendario` in one
    value; `bad_range` past 1 500 days; a `diario_mes` with 1 200 trades in its weeks answers in one value. The light pass
    calls no `gate_at` (checked with a counting stub in the test schema).
13. **Nothing moved**: the migration's end-of-file proof (every row's md5 of the tables Phase 3c lists, every
    `limit_usage` and `gate_eval` answer, every `trade_marks_v.limpa`, every `trade_state`) is unchanged, re-asserted here.

### 12.2 Jest

- `app/__tests__/domain/cases4.json` + `cases4.test.ts`: inputs invented, every `expected` computed by the Phase 4 SQL on a
  throwaway PG15 cluster with the generator kept outside the repo (as `cases3c`): review payload checks (codes and
  fields), `kind` of trades and days at the v1 boundary, `week_of` and closed weeks per market, carry-over choice. CLAUDE.md
  gains the usual line: change the SQL and the TypeScript together, then re-record.
- `app/__tests__/lib/hubDiario.pg.test.ts` (`BH_PG_URL`, `BH_PG_RECORD=<dir>`): drives `lib/hub/diarioDb` against the real
  SQL (the `testing/pg` stand-in client), checks the answers against the domain (grid, levels, pending reviews, words) and
  records `app/testing/fixtures/diario/*.json` (a Top One week with a limit day, an Ebinex weekend, a mixed v1 day, a day
  with partials and a breakeven move, a reviewed day and the next) for the screen tests of 4-3.
- `hubDiarioDb.test.ts`: parsers (shape errors → `bad_answer`), `createSignedUrls` batching and per-path errors, the
  invalidation map.
- `__tests__/app/redirects.test.ts` (4-4): `next.config.js` has the `/trades` rule (307; and the `antiga` exception with Q5
  a).
- `routesRequireAuth.test.ts`: unchanged (no route handler is added).

### 12.3 What the CI runs

`ci.yml`'s `db` job runs `supabase/tests/run.sh` on postgres:17, so 83 runs on every PR; the app job runs Jest and
`tsc --noEmit`. The `.pg` suite runs locally (as 3c), not in CI.

---

## 13. Rollout on the real project (paste kit `.claude/backup-fase4/aplicar/`)

### 13.1 Diagnóstico (read-only, pasted first, JSON back)

`diagnostico_fase4.sql` answers only counts and names: Phase 3b applied (`to_regclass('public.import_templates')`), the
`backup_fase*` schemas present (the guard's collision list), per account: market, versions, `desde_day`, trades by kind
(history / diário app / diário file-only / old-page), the most file-only diário trades in one month, weekend trading
days, open trades (and how many lack a context), unconfirmed clock trades, `trade_deletions` by `via`; legacy
`trading_sessions` rows by column with text (`premarket_notes`, `session_notes`, `lessons_learned`, `followed_plan`
non-null; counts only, never text) for Q8.

### 13.2 `fase4_aplicar.sql` (one block; any failure applies nothing)

1. Guard: `to_regclass('public.day_reviews') is not null` or schema `backup_fase4_diario` exists → `f4_ja_aplicado: a
   colagem da Fase 4 já está no banco; nada foi feito`. The name is new against the live list (backup_fase1, backup_fase2,
   backup_fase2b, backup_fase3, backup_fase34, backup_fase3b, backup_fase3c, backup_fase3b_colunas); `testar.sh`'s
   live-shaped seed recreates all eight so the guard is tested against them (memory rule).
2. Backup schema `backup_fase4_diario` (revoked from the API roles): md5 fingerprints of every row of the tables 3b's kit
   listed, the `limit_usage` answers (the 3b grid), each account's gate now, every mark's `limpa`, every `trade_state`
   (minus `server_now`). No function text: nothing is replaced.
3. The two migrations as written (`20261025000001_diario.sql`: table, guard, view, RLS, grants;
   `20261025000002_diario_api.sql`: helpers and RPCs), with their own end-of-file proofs.
4. Conferência (read-only JSON): `linhas_que_mudaram`, `respostas_do_limite_que_mudaram`, `posso_operar_que_mudou`,
   `marcas_que_mudaram`, `estados_que_mudaram` all 0; NEW `calendario_difere_do_limite` 0 (for every account and day, as
   the owner via `set_config('request.jwt.claim.sub', …, true)`); `revisoes` 0; `funcoes_novas_para_usuarios` true,
   `para_anonimos` false; per account the days returned and the milliseconds of `diario_calendario` and of the
   heaviest month's `diario_mes` (counts only).

### 13.3 `desfazer_fase4.sql`

Drops the RPCs, helpers, view and table and the backup schema, only while `day_reviews` is empty (`f4_tem_revisoes`
otherwise: the owner's text is never dropped by a paste); proves every fingerprint unchanged.

### 13.4 `testar.sh` scenarios (3b/3c pattern)

Paste on a live-shaped seed; paste twice (`f4_ja_aplicado`); the undo with and without reviews; atomicity (a failure
injected at the last statement leaves nothing); the conferência's expected zeros; `run.sh` with every test after the kit;
the `.pg` suite. `mensagem_para_o_dono.txt` in pt-BR, as before.

---

## 14. PRs and effort

| Step | Content | Days | Depends on |
|---|---|---|---|
| A · Answers | the questions below (owner-facing pt-BR version by the synthesis) | — | — |
| B · Board revision (update the existing canvas artifact, memory rule) | the STALE items of §1 out; per-account calendar with history hatched for every market, weekend columns (Q1), Phase 5/8 blocks removed or «chega na Fase 5», the misto v1 day, recalculated badge, 3c exits and stop moves in the drill, the breakeven and «regras alteradas» plan lines, the review with «salva às / editada às», the week without AI, the export / old-page link (Q5) | 1–1.5 | A |
| 4-1 · Banco | `20261025000001_diario.sql`, `20261025000002_diario_api.sql`, `83_diario.test.sql` (13 groups), the paste kit (§13) | 2.75–3.75 (+0.5 with Q5 b) | A |
| 4-2 · Domínio | `lib/domain/diario`, `lib/hub/diarioDb.ts`, `lib/hub/diario.ts`, hooks and invalidations, `cases4.json`, `hubDiario.pg.test.ts` + fixtures | 1.5–2 (+0.25 with Q5 b) | A; parallel to 4-1 (as in 3c) |
| 4-3 · Telas | calendar, day (tiles, plan, table and drill reusing the Registrar's pieces, marks editor, images, review), week, pending-reviews banner, timeline placeholder; bridge and placeholder removed; 375 / 768 / desktop, both themes, 44 px, keyboard | 4–5 (+0.25 with Q5 b; the synthesis budgets 5.25–6.25) | 4-1 pasted on the live DB, 4-2, B approved |
| Owner test | his real days (§1.4) | — | 4-3 |
| 4-4 · Redirect | `next.config.js` rule, its test, the footer link (Q5 a) | 0.5 | owner test |

Total **9.75–12.75 days** (plan 9–11), **10.75–13.75** with Q5 (b) (+1). The synthesis (`sintese.md` §2) adds +1 to 4-3
and budgets **11.5–14.5** with its recommended answers. The difference from the plan: the board revision (the
boards predate Phases 1–3c) and the append-only review history. 4-1, 4-2 and B run in parallel, so the calendar time is
shorter than the sum. Merges into `feature/rebuild-lean` in order 4-1 → 4-2 → 4-3 → 4-4, at the owner's request.

---

## 15. Defaults (taken unless the owner says otherwise)

- One account at a time; no calendar summing accounts, not even of one market (the prop-account rotation can come with
  copy groups).
- Plan of the day = the version at the day's end (today: now), earlier versions of that day listed (§3.6).
- File-only and old-page trades after «desde» are judged by the recalculated «Posso operar hoje?», badge «recalculado»
  (unless Q2 says otherwise).
- History trades: result only; no marks editor, no images link, no review (board).
- «Seguiu o plano?» stored as `sim` / `em_parte` / `nao`; the self-report never changes the computed plan («O diário conta
  à parte.»).
- Phase 5 and 8 blocks hidden, not shown as off; only the timeline says «chega na Fase 5».
- Reviews allowed for any diário day up to today; the pending-reviews banner counts days before today with at least one
  trade registered in the app (`app > 0`) and no written review.
- The week card shows the newest closed week; weeks close after Friday (Sunday for binary and Cripto).
- Archived accounts: readable, not writable (`archived_account`), as the Registrar.

---

## 16. Relation to the sibling survey (`estado_atual.md`)

Agreed: the inventory, the row-limit risk, weekend days (its Q2 (b) = this Q1 (a)), the redirect mechanism, «Antes de
operar» left out (its Q5 (a) = this Q7 (a)), the legacy notes counted first (its Q6 ≈ this Q8). Different
recommendations, for the synthesis to settle with the owner:

- **File-only trades after «desde»**: it recommends keeping them out of the day's numbers (its Q3 (a)); this spec
  recommends them in, with a recalculated plan (Q2 (a)), because the boards' «Como o diário grava» says so and the
  as-built 2b/3b copy already tells the owner that only trades before «desde» go to «Histórico importado · só resultado,
  à parte do Diário».
- **Gross or net**: it recommends gross (its Q4 (a)); this spec recommends net (Q3 (a)), because 3b's approved import
  copy says «O arquivo traz comissões: mostramos o resultado líquido.» and the limit counts net.
- **Delete and export**: both recommend keeping the old list reachable (its Q1 (a) = this Q5 (a)).

---

## Open questions for the owner

**Q1. The calendar is «seg–sex». What about weekend trading days?** Cripto's window runs every day; Ebinex trades on
weekends too (your files have 13 weekend operations out of about 490). Futures, Forex, Ações and B3 never have one: a
Sunday-evening futures trade already counts on Monday.
- (a) Monday to Friday, plus Saturday and Sunday columns in a month where this account has a weekend trading day, and
  always for Cripto accounts. **(Recommended)**
- (b) Monday to Sunday for every binary and Cripto account, Monday to Friday for the rest.
- (c) Monday to Friday for everyone; a weekend day opens only from its week («+ sáb 1 op.»).
Why (a): no trading day is ever hidden, and the accounts you use every day keep the board's five columns.

**Q2. Trades that arrive only from a file, after your rules began («desde»): part of the diário or apart?**
- (a) Part of the day, with the «Posso operar hoje?» recalculated at their entry and marked «recalculado»; only trades
  before «desde» are «Histórico importado · só resultado», never summed. **(Recommended)**
- (b) Apart on every day: the diário counts only trades registered in the app; file-only trades show with result only.
- (c) Like (a), without the recalculated plan (they show «—» in «Plano»).
Why (a): it is what the boards say («entram com o “Posso operar hoje?” recalculado, e a operação mostra isso») and what
the import already tells you («As de antes de 14 out ficam em Histórico importado · só resultado, à parte do Diário.»);
with (b) a day you forgot to register looks empty although the limit counted it.

**Q3. The day's result: net or gross of commissions?** The limit counts net (commission subtracted when the file has it);
the import screens show net («O arquivo traz comissões: mostramos o resultado líquido.»); the boards' footer says
«Resultados do arquivo da corretora, sem custos.»
- (a) Net everywhere in the Diário (day, calendar, week), with «Bruto … · comissões …» in the ⓘ; the footer says so.
  **(Recommended)**
- (b) Gross everywhere, with the commissions in the ⓘ; the «Limite do dia» tile stays net (it is what the app enforced).
- (c) Gross for Top One, net for the others.
Why (a): one number on the page for the day, equal to the one the limit and «Posso operar hoje?» used.

**Q4. When you edit a review, does the app keep what you wrote before?**
- (a) Yes: each «Salvar revisão» is kept with its time; the Diário shows the latest, «salva às 11:33, editada às 18:02».
  Nothing is deleted. **(Recommended)**
- (b) No: one review per day, overwritten; only «salva às» and «editada às» are kept.
Why (a): marks, rule versions and deleted operations already keep their history; a review rewritten after seeing the
week stays honest, at no visible cost.

**Q5. When `/trades` opens `/diario`, what happens to deleting and exporting?** Today the old page is the only place that
deletes an imported or old operation (Phase 3 decision 3) and exports a CSV; the Diário board has «Exportar CSV».
- (a) `/trades` opens the Diário; the old list stays reachable at `/trades?antiga=1`, linked from the Diário's footer
  («Página antiga de operações»), until Phase 9; deleting and exporting stay there. **(Recommended)**
- (b) The Diário gets «Apagar operação» in the operation's details and the board's «Exportar CSV» now (about one more
  day).
- (c) No deleting (except «Desfazer entrada» and undoing an import) and no export until Phase 9.
Why (a): it meets «`/trades` passa a abrir `/diario`», keeps decision 3 true and adds no new destructive button now.

**Q6. Holidays and short sessions on the calendar («quinta, 26 nov: feriado nos EUA», «sessão curta até 13:15 ET»)?**
The app has no holiday data yet.
- (a) Wait for Phase 5, with the economic calendar source you will choose; until then a holiday is a day «sem op.».
  **(Recommended)**
- (b) A fixed list of US (CME/NYSE) and B3 holidays now, updated by hand every year.
Why (a): one source for events, holidays and short sessions, chosen once.

**Q7. Two texts on the boards have no screen to write them: «Antes de operar» and «Seu foco da próxima semana».**
- (a) Leave both out in Phase 4; «Do pregão anterior» (from «Levar para o próximo pregão») stays. They come with the
  screens that write them (Início, Phase 8; Padrões, Phase 7). **(Recommended)**
- (b) Add two simple fields now: «Antes de operar» on today's day and «Seu foco da próxima semana» on the week (new on the
  board, about half a day).
Why (a): nothing on the page that you cannot fill, and no text that the Padrões would later need to replace.

**Q8. Only if the check before the paste finds any: notes of the old pages (Premarket, sessions).** They are per date on
the device's clock, for all accounts together.
- (a) Show them read-only on that date in every account's day («Da página antiga»), without copying. **(Recommended)**
- (b) Copy them into the review of your primary account on that date.
- (c) Ignore them; they stay in the old pages until Phase 9.
Why (a): nothing is guessed about which account they belonged to, and nothing is written to your data.
