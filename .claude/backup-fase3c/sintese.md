# Fase 3c · synthesis: partial exits, stop moves and the breakeven rule

Inputs: `fase3c/decisoes.md` (owner, FINAL), `fase3c/banco.md` (database, prototyped on PG 15), `fase3c/regra.md` (the
rule), `fase3c/telas.md` (screens), Phase 3 decisions and contracts, the repo at `feature/rebuild-lean` 4c02dac (read-only;
checked: `trades.client_key` + `trades_client_key` index in `20261020000001:275,298`; `trade_marks_v` at
`20261020000001:415-424`). Nothing was rendered, nothing in the repo or the live DB was touched.

Precedence for the board and code agents: **this file** → `decisoes.md` → `banco.md` for the database, `regra.md` for the
rule's semantics and storage, `telas.md` for screens and copy → Phase 3 contracts. Where this file says «cut», the spec text
stays only as a reference for later phases.

---

## 1. The cut (what Phase 3c ships)

1. **Partial exits, exits only** (decision 1). One entry; any number of partials (quantity < open, price, hour); one final
   «Saída» that closes everything still open. Every price market (futures, forex, stocks/options, crypto, B3); never
   Ebinex/binaries. Storage: banco's `trade_exits` (rows only for trades with more than one exit; no backfill; `trades`
   holds the sums; the commit-time invariant; R on the initial stop).
2. **Stop moves** (decisions 2–3). «Mover stop» with the shortcut «Breakeven · {entrada}» or «Outro preço»; server time
   only; the points in favour at that moment shown and stored. Storage: banco's `trade_stop_moves`, amended (§4).
3. **«Desfazer»** for the newest partial **or** stop move (telas), within 15 minutes of registering it, while the trade is
   open; the row is kept and marked undone. Named by event id (§4.3).
4. **The daily limit counts each exit at its own minute**, an open trade's partials included, on the trade's (entry)
   trading day (banco §6, proven identical on every stored answer).
5. **The breakeven rule** in Personalizar › Suas regras: optional, **per asset** (Q1), versioned with the
   absent-when-off rule (no spurious versions). Storage and resolve: regra §2. UI: **Futuros only now** («Padrão Futuros» +
   «só nesta conta», like the window), the database accepts every price market so later markets need no migration.
6. **Registrar hints, never a verdict**: the rule line at entry and on the open trade («Sua regra: breakeven com +8 pts, em
   7.920,50.»), the rule beside the live preview in «Mover stop», the suggestion after a partial that reached +N with a
   «Mover para o breakeven» button, a neutral breakeven line in step 3. No «No ponto / Cedo / Tarde» in the Registrar:
   decision 2 leaves the check to Análises.
7. **Step 2 «Operação aberta»**: «O que registrar agora?» (Saída · Parcial · Mover stop, «Saída» default), «Agora»,
   «Linha do tempo», limit banners after a partial, «passa do limite» warning on a looser stop (telas §4).
8. **Step 3**: the sum, the average exit, R «com o stop inicial», the timeline, the breakeven line (telas §5).
9. **«Já fechada» with several exits** («+ Outra saída», 2–20 rows adding up to the entry) and an optional «Movi o stop
   para o breakeven» with the price then, stored as a reconstructed move (never «ao vivo»).
10. **Bridge and chooser**: «Operações do dia» second line («1 parcial, +US$ 40,00 · stop no breakeven» / «em 2 saídas»),
    «Operações abertas» «2 ct em aberto».
11. **Imports group a broker position** (same symbol, side, open instant and open price; with an exit) into one trade with
    one file exit per row; link to an app trade with partials; attach later rows; exact undo (banco §9). This is
    required, not optional: without it a Top One file with two rows for an app trade with a partial would link one row and
    insert the other as a second trade, doubling the money.
12. **The pre-existing `import_undo` bug** (banco §9.8, registered value lost when two batches touch one app trade and are
    undone newest first) is fixed by the replaced `import_undo` (`x.linked_at > l.linked_at`).

## 2. Out of the cut

| Item | Source | Where it goes |
|---|---|---|
| Classification no ponto / cedo / tarde / não moveu, adherence, «what happened after» in R, tolerance (regra Q3) | regra §5 | Phase 6 (Análises), Phase 7 (Padrões); regra §5 is the draft |
| «Chegou a +N?» question at the exit, mark kind `alcance_be` (regra Q2) | regra §4.5 | Phase 6 decides; Phase 5/8 market data may replace it |
| Verdict marca after a move in the Registrar; «BE no ponto/cedo/tarde» marcas in the day list | regra §4.3, §4.6 | Phase 4/6, computed, never stored |
| The rule's row on Forex, Ações e opções, Cripto and B3 accounts; free-code assets (ZN, NG…) in the rule | regra §3.2–3.3 | later, same row; no migration needed |
| «Não» answer in «Já fechada» («não moveu» stored explicitly) | telas §3.3 | dropped: no consumer before Phase 6; a «Já fechada» trade without a move reads «sem dado» |
| `rule_favor` copied into each stop move | banco §3.2 | dropped: derived from the trade's frozen version (`trade_breakeven`) |
| `limit_room` in the `move_stop` answer | banco §7.1 | dropped: the sheet computes the warning from the gate it already holds (as the entry's) |
| Merging the owner's existing 2-row Top One pair | banco Q4 | never automatic; a one-off «Juntar» only if asked |
| Partial entries, moving the target, trailing stops in «Já fechada», undoing a final exit | decisions, telas §12 | not planned |
| Tick-multiple check on the rule's N | telas §8.2 | dropped: N is a threshold, not a price (regra) |

## 3. Contradictions resolved

| # | Topic | banco | regra | telas | Resolution | Why |
|---|---|---|---|---|---|---|
| C1 | Rule granularity | one N per account `{"favor": N}` | N per asset `{"on", "by": {KEY: N}}` | N per asset | **per asset**, regra's shapes (Settings `{"on", "by"}`, Resolved `{"by": {KEY: {"n", "un"}}}`) | MES and MNQ points differ ~4×; one N misjudges the other asset. Owner confirms in Q1 (his decision says «+N pontos», singular) |
| C2 | Rule inheritance | account only; MarketRules refuse the key | market default + whole-object override | «Padrão Futuros» + «só nesta conta» | market default + override (regra/telas) | the window's pattern; the owner already knows it |
| C3 | Rule markets | all price markets | all price markets in the UI | Futuros only now | DB/TS: every price market (`market_caps.rules.breakeven`, false only for binary); UI: Futuros only | the owner trades futures at Top One; extending later is UI only |
| C4 | What is typed at a move | points in favour (`favor`, required for breakeven) | prefers the price then | «Preço agora», required for every move (telas Q4) | **«Preço agora»**, required for «Breakeven», optional for «Outro preço»; the server computes and freezes the points in favour against the entry at that moment and stores both (`price_now`, `favor`) — subject to Q2 | the price is on every screen and checkable (tick, safe side); the app shows «Com +8,00 pts a favor», which is the owner's «com quantos pontos»; decision 3 asks only the time for other adjustments |
| C5 | Stop-move undo | none (correct with another move) | — | «Desfazer» on the newest partial or move | **undo both**, newest event only, 15 min, open trade, kept with `voided_at` | a mistaken «Breakeven» tap would otherwise stay in the history forever and Phase 6 would judge it |
| C6 | Marks after a partial (banco Q3 / telas Q3) | cut stays at the final exit | — | cut at the first partial | **first partial** (non-undone): `trade_marks_v.limpa` adds `least(first partial's exit_time, its registered_at)` to the existing `least(...)` | a realized partial reveals part of the result; marks after it are not blind. No existing answer changes (no trade has partials); the conferência checks the view anyway |
| C7 | Caps | 20 partials, 50 moves | 20 assets | 10 exits, 20 moves | **20 exits per trade** (19 partials + the final; «Já fechada» 2–20 rows), **20 moves**, 20 assets in the rule; imports uncapped | one number for the app; a broker may split a position into many rows |
| C8 | Verdict in the Registrar | — | «No ponto / Cedo / Tarde» marca after a move; «+8 pts: 2 antes da sua regra» | neutral facts + rule | **neutral** (telas copy) | decision 2: «sugere … e depois confere nas Análises» |
| C9 | Rule line wording and place | «Sua regra: breakeven com +8 pts» | «Breakeven pela sua regra: +10 pts, em 7922,50» under the stop line | «Sua regra: breakeven com +8 pts, em 7.920,50.» in step 1 and step 2's summary | telas | the screens spec owns copy |
| C10 | Personalizar placement | — | own group «Durante a operação» after «Regra por estado», with the nota that it does not change «Posso operar hoje?» | a row between «Limite do dia» and «Regra por estado» | **regra's group and nota**, telas's row inside it (switch, one line per asset, «Adicionar ativo» pills of the futures table, «Remover»), telas's example values (MES +8, MNQ +30, MGC +5) | keeps the gate rules together and says plainly this one never blocks |
| C11 | Partial hour | typed «HH:MM» like the exit, no cap | — | typed, prefilled with the server's minute | **like the exit** (no 15-minute cap), the server's registration time kept apart — subject to Q3, because decision 1 says «hora do servidor» | a partial is an exit; the limit counts it at its minute and the file never corrects hours |
| C12 | «Já fechada» exit order | refused out of order (`exit_before_partial`) | — | rows sorted by hour on save | the client sorts by hour (ties keep row order); the server check stays as a guard | both |
| C13 | «Corrigir» / «Custos» with several exits | per exit `pnl`/`costs` | — | one correction for the total (difference on the last exit); one «Custos» for the trade | telas in the UI; the payload carries the typed `pnl` on the last exit only and `costs` on the final exit only; `register_partial` refuses `costs` | the server stays per-exit; the limit sees the correction and costs at the last exit's minute |
| C14 | Breakeven in «Já fechada» | `"breakeven": {"favor": "4"}` | not evaluated | Sim / Não + «Preço quando moveu» | one optional pill «Movi o stop para o breakeven» + «Preço quando moveu»; `"breakeven": {"price_then": "4409.30"}`; one `trade_stop_moves` row `origin 'reconstructed'` | follows C4; «Não» cut (§2) |
| C15 | Breakeven on the trade | `trade_state.breakeven_rule` | `trade_state.breakeven = {key, n, un, level}` via `trade_breakeven()` | needs N and the level | regra's `trade_breakeven` / `trade_state.breakeven` | richer, one source |
| C16 | What a breakeven move is | stored `kind` from the shortcut | geometric (stop ≥ entry − one step) | stop = entry | stored `kind`: «Breakeven» shortcut, or an «Outro preço» exactly at the entry, is `breakeven`; anything else `ajuste`. Phase 6 may add the geometric reading | display needs a stored fact; the file may later correct the entry |
| C17 | SQL test file names | `80_parciais` | `80_regra_breakeven` | — | `80_regra_breakeven.test.sql`, `81_parciais.test.sql` | order of the migrations |
| C18 | Partial chips / «Metade» / 1-contract trades (telas Q6) | quantity with the instrument's decimals | — | chips for contracts, field + «Metade» otherwise; «Parcial» hidden when the open quantity cannot be split | telas | — |
| C19 | Off state text | — | «Desligada: o Registrar não sugere e as Análises não conferem.» | «Desligada: o app não sugere o breakeven.» | regra's | says both consequences |
| C20 | Version note text | — | «breakeven MES +10 pts» | «breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC» | telas's | reads as a sentence |

## 4. Gaps found while reconciling (fixed in the cut)

### 4.1 No idempotency on the new writes (bug in banco's design)

As built, `register_entry` and `register_after` are idempotent through `trades.client_key` (unique per user) and
`register_exit` through «already closed → `repeated`». banco's `register_partial` and `move_stop` have no key: a retried tap
after a lost answer (telas §4.9, contract C5) **registers a second partial or move**. Fix: `client_key uuid` on
`trade_exits` (app rows) and `trade_stop_moves` (live rows), unique `(user_id, client_key) where client_key is not null`,
frozen by the guards; a repeat returns `repeated: true` with `trade_state` and writes nothing. `client_key` required on
non-dry-run writes, as `register_entry`.

### 4.2 «Undo the last» walks back on a retry (bug in banco's design)

banco's `undo_partial(p_trade)` undoes «the last non-undone partial» and is «repeatable (walks back)». A retry after a lost
answer would undo the **previous** partial too. Fix: one `undo_event(p_trade uuid, p_event jsonb)` with `{"v": 1, "kind":
"parcial" | "stop", "id": <bigint>}`; the event must be the newest non-undone app partial or live move by registration time
(`registered_at` / `moved_at`, ties by id), the trade open, ≤ 15 minutes after that event's registration. Already undone →
`repeated: true` (success). Codes: `nothing_to_undo`, `not_newest` («Só o último registro pode ser desfeito.»),
`undo_too_late`, `not_open`.

### 4.3 Stop-move undo needs storage

`trade_stop_moves` gains `voided_at` (set once through the guard flag `binary_hub.moves = 'void:<id>'`, like the exits);
`stop_now` = the newest non-undone move, else the initial stop; a later move's `prev_stop` is computed over non-undone moves.

### 4.4 Already-closed checks

«Partials» in `register_exit` means **counting** partials: a trade whose only partial was undone takes the as-built
single-exit path (no rows written), so its undone row stays and nothing counts.

### 4.5 Test database version

The live project runs Postgres 17.6; the prototype and every earlier harness ran on PG 15 (only 14 and 15 are installed
here). Phase 3's paste worked the same way. Keep the harness on 15 and avoid version-specific syntax; note it in the PR.

## 5. The consolidated model (deltas over banco.md and regra.md)

### 5.1 Migrations (one paste kit)

1. `20261023000001_regra_breakeven.sql` — regra §2.3 items 1–7 and 9 (caps, `rules_is_dist`, `rules_check_breakeven`,
   `rules_check_market`, `rules_check_account`, `rules_check_resolved`, `rules_resolve`; proof block). **Not prototyped in SQL
   yet** (banco prototyped the other shape): PR A prototypes it first on the throwaway cluster.
2. `20261023000002_trade_exits.sql` — banco §3, §4, §5.1, §6, §11 with §4.1–4.3 above: tables (+ `client_key`; moves
   + `price_now`, `voided_at`, `client_key`, − `rule_favor`), guards, views, sums, invariant triggers, `limit_usage`, the
   `trade_marks_v` change (C6), privileges, end block.
3. `20261023000003_parciais_api.sql` — banco §8 and §9 with: `register_partial` (+ `client_key`, no `costs`),
   `register_exit`, `move_stop` (`{"v", "client_key", "kind", "stop_price"?, "price_now"?}`), `undo_event`,
   `register_after` (`exits[]`, `breakeven.price_then`), `trade_check_payload`, `trade_breakeven` (regra §2.3.8),
   `trade_state` (+ `exits`, `stop_moves`, `position {quantity, closed, open, realized_pnl, partials, stop_initial,
   stop_now, stop_kind, r, undo: {kind, id, until} | null}`, `breakeven {key, n, un, level} | null`), the import functions,
   privileges, end block.

### 5.2 Error codes (merged)

New: `partial_too_large`, `exit_before_partial`, `too_many_exits`, `too_many_moves`, `same_stop`, `nothing_to_undo`,
`not_newest`, `bad_breakeven`, `exits_mismatch` (a bug; generic copy). A missing or bad «Preço agora» is `bad_price` with
hint `price_now`; a stop on the wrong side of it is `bad_stop` with hint `stop_price`; a «Já fechada» price then not in
favour is `bad_stop` with hint `breakeven`. If Q2 is answered «pontos», `price_now` becomes `favor` and `bad_favor` returns.

### 5.3 What the screens read

`trade_state` (above) for the sheet; the step-1 rule line from the gate answer's `rules.breakeven` (already returned by
`gate_at` when present); the bridge and chooser lines from `trade_exits_v` / `trade_stop_moves_v` (select own, RLS) for the
day's trades — no new RPC.

### 5.4 Conferência additions (over banco §13.3 and regra §2.3.9)

`trade_marks_v` answers (`limpa` per mark) identical; every account's `rules_current` identical; `market_caps_all()` equal
to the old after removing `rules.breakeven`; no stored rule jsonb holds `breakeven`; new tables empty. The undo kit refuses
once any exit, stop move or breakeven key exists.

## 6. Questions for the owner (`perguntas.md`)

| Q | Question | Default drawn | If answered otherwise |
|---|---|---|---|
| Q1 | N per asset or one N per account | per asset | Settings `{"on", "favor"}`, Resolved `{"favor": {"n", "un"}}` with the unit of the account's market; the row becomes one field; no asset list |
| Q2 | At a move, type the price now or the points in favour | price now (app computes the points) | payload `favor` (in the asset's unit) instead of `price_now`; the safe-side check uses entry + favour; the field becomes «Pontos a favor agora»; the partial's suggestion prefills the partial's points |
| Q3 | Partial hour: correctable like the exit, or server time only | like the exit, no cap | (b) no hour field, `exit_time = registered_at`; (c) refuse older than 15 minutes (`partial_too_old`) |

## 7. Accepted defaults (no question)

1. Undo for the newest partial or stop move, 15 minutes, kept as undone (C5, §4.2).
2. Marks after the first partial count as «depois do resultado» (C6).
3. The rule's UI is Futuros only now; the database accepts every price market (C3).
4. The Registrar never judges; Análises (Phase 6) do (C8).
5. Up to 20 exits and 20 stop moves per trade; up to 20 assets in the rule (C7).
6. «Parcial» hidden while the open quantity cannot be split (telas Q6).
7. One «Corrigir» for the total and one «Custos» per trade, both on the last exit (C13).
8. «Já fechada»: several exits and an optional reconstructed breakeven, no «Não» (C14).
9. A Top One position in several rows becomes one trade; the owner's existing pair stays two trades (banco Q4).
10. A mid-session export closes an open app trade at its last row, as Phase 3 (banco Q6).
11. The rule's N is any number > 0 with up to 8 decimals, not tied to the tick.
12. «Preço agora» required with «Breakeven», optional with «Outro preço» (C4).

## 8. Boards (before any screen code)

Extend the approved v57 boards with invented data (telas §9, amended here):

- **RegistrarOperacao.dc.html** → 16 scenarios. New 14 (MES 3 ct: partial, suggestion, breakeven, exit), 15 («Já fechada» MGC
  in two exits, breakeven reconstructed via the pill + price), 16 (MNQ partial that reaches the limit, then «Desfazer»).
  Step-2 actions in scenarios 6–9 in their units through «Preencher exemplo». Undo link also on a stop move. No verdict
  marcas. Rule values MES +8, MNQ +30, MGC +5.
- **Personalizar.dc.html** → the group «Durante a operação» (regra's heading and nota) with the row «Mover para o
  breakeven» (telas layout): «Padrão Futuros» on with three assets, Top One inheriting («padrão de Futuros»), one account
  with its own value («só nesta conta», «Voltar ao padrão»), off state, on with no asset («Sem ativo: esta regra não age.»),
  «não salvo» and «Ao salvar: versão nova desde … em …». Ebinex and non-futures accounts without the group.
- If Q1/Q2/Q3 come back non-default, redraw only the affected fields before showing the board.
- Render check (375, 768, 1280; claro/escuro; keyboard) only when `df -h` shows ≥ 1.2 GB free; delete Chrome profiles after.

## 9. PR split, order and effort

| Step | Content | Depends on | Effort |
|---|---|---|---|
| 0 · Boards | §8; owner approval | Q1–Q3 (defaults if silent) | ~1 agent-day |
| **PR A · Regra do breakeven** (lane A) | migration 1; `80_regra_breakeven.test.sql`; TS twins (`markets.ts` caps, `gate/rules.ts`, `hub/regras.ts`, `rascunho.ts`, `regrasDb` codes, `regrasConta` summary); parity tests (`hubRegras.pg`); Personalizar group and row + tests | boards approved | M · ~0.6k SQL + ~1.2k TS/tests · ~1.5 days |
| **PR B · Saídas e stop no banco** (lane B, parallel with A on the shapes fixed here) | migrations 2–3 (port of `proto/01,02,04,06` ≈ 2.4k lines, amended by §4); `81_parciais.test.sql` (from `proto/03,05,07` + §4 cases: repeat with `client_key`, undo by id, stop-move undo, marks cut); the two list changes in `50_phase3.test.sql`; TS twins (`gate/usage.ts` with exits, `registro` slice pnl / R / `breakeven.ts`, payload builders), `registrarDb` (wrappers, `TradeState` decode, import keys, error codes), parity tests | shapes from PR A (migration 3's `trade_breakeven` reads Resolved) | L · ~3k SQL + ~1.5k TS/tests · ~3 days |
| Paste kit | `fase3c_aplicar.sql` (backup schema, three migrations, conferência), `desfazer_fase3c.sql`, harness (fingerprint → paste → 80/81 pass → second paste fails clean → undo → refusal with a partial present); scratchpad only | A and B reviewed | S–M · ~0.5–1 day |
| Owner pastes | message banco §13.5, extended with the rule | kit | — |
| **PR C · Registrar: parciais e stop** (two lanes, file ownership as Phase 3-4) | C1: step 2 (pills, «Parcial», «Mover stop», «Agora», «Linha do tempo», «Desfazer», banners, suggestion), step 3, bridge/chooser lines, import sheet lines. C2: step 1 rule line, «Já fechada» exits and breakeven pill, Rascunho v3 | B merged, paste applied | L · ~2.5–3 days |
| Owner test and approval | the three new scenarios on the real app | C | — |

Total ≈ 9 agent-days plus review. Order: boards → A ‖ B → kit → paste → C → owner test. Deploy order as regra §2.3.10:
the paste first, then the app. PR A's Personalizar row writes a key the live database refuses (`unknown_key`) until the
paste is applied, so A and B merge into `feature/rebuild-lean` only after the owner has pasted the kit.

## 10. Risks

- **Imports** are the largest surface (four functions replaced). Mitigation: the one-row path verbatim; suites 20/50/60
  compare whole objects; every banco §12.1 item 10 case plus both undo orders.
- **Rules**: regra's shape is unproven in SQL; the conferência's «no account changes `rules_current`» is the guard. One trap:
  `rules_resolve` must stay `immutable` and call only immutable functions (`trade_instrument`, `trade_match_key`).
- **Old open tabs** reject a version with the tenth key until reloaded (regra §2.3.10): acceptable, only the new app writes it.
- **Old pages** show the average exit with 8 decimals and a trade with partials as one row; while open, partials are
  invisible there (banco §10). Accepted until Phase 9.
- **Limit twins**: `dayUsage` must match `limit_usage` per exit, including an open trade's partials; shared fixtures.
