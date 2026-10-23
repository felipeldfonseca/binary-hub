# Phase 3 survey: what already exists that «Registrar operação» touches (legado)

Base: `feature/rebuild-lean` at `4187a8c` (Phase 2b merged; promoted to `main` as `0239448`, same tree). Static read of
`app/`, `supabase/migrations/`, `supabase/tests/`, `supabase/config.toml`, `.github/workflows/ci.yml` and the approved
boards. Nothing in the repository was changed, the live Supabase project was not called, no `.env` file and no row of
`docs/csv` was read.

Sources: `panel/v31/plano.md` (row 3), `panel/v31/apendice.md` (§A, §B «Fase 3: M6a», §D, §E), `fase2/decisoes.md`,
`mercados/decisoes.md`, `mercados/contrato_2b.md` (§4.8 and the "Old pages" list), `fase2/levantamento/{banco,gate,
personalizar,legado}.md`, the project memory `market-hub-initiative.md`, and the boards `RegistrarOperacao`,
`DiarioHojeEnxuto`, `DiarioDezEnxuto` (market-hub/project) and `ImportarConta`, `Personalizar`, `Inicio`
(mercados/quadros/project). Board locations are given as `Board @offset` (character offset in the `.dc.html`) or by the
script key the board uses.

Labels: **NEW** = not on any board; **ADAPTED** = on a board, changed here.

---

## 0. Summary

1. **No screen writes a trade today, except one hard delete.** Of the old hooks, only `deleteTrade` has a caller (the
   `/trades` bulk delete, `TradesV1Professional.tsx:128`). `createTrade`, `updateTrade`, `quickAddBinaryTrade` and
   `quickAddFuturesTrade` (`hooks/useTradesSupabase.ts:107-272`) have **no caller**; `useTrades` and `useTradeStats` are
   localStorage shims; the legacy `importTrades` REST upsert (`lib/utils/importTrades.ts:18-55`) is reached only by tests.
   There is no "dashboard quick-add" UI: the dashboard's «Adicionar novas operações» just pushes `/trades`
   (`HeroSectionPT.tsx:43-48`), and `/trades` has no add form. Registrar is the first live writer of the rebuild.
2. **`trades` is wide open to the API.** It keeps Supabase's default table grants plus one `FOR ALL USING (auth.uid() =
   user_id)` policy (`20240415000000_initial_schema.sql:265-266`); no migration ever revoked anything on it. A signed-in
   client can today INSERT or UPDATE any column of its own rows, including `trading_day` (the bridge recomputes it only
   when `account_id`, `market_type`, `entry_time` or `user_id` change), `source`, `import_batch_id` and `entry_time`. The
   appendix's plan ("grant update on the columns the old edit uses, from `useTradesSupabase.ts:141`") resolves to an
   **empty list**: nothing calls `updateTrade` and the bulk edit is a no-op (`TradesV1Professional.tsx:347`). The DB tests,
   however, insert ~19 trades as `authenticated` (§7), so INSERT should be narrowed by **column grants**, not revoked.
3. **The bridge trusts a client-supplied `source`.** `trades_bridge` fills `source` only when it is null
   (`20261019000001_markets.sql:1134-1152`), so a REST insert with `source = 'live'` and any `entry_time` would pass as a
   live, server-timed trade. Phase 3 must make `live` (and `registered_at`, `exit_registered_at`, `rule_version_id`,
   `status`) writable only by its RPCs.
4. **The biggest gap: a live trade and the same trade in a later broker file are never matched.** Imports dedupe only by
   `(account_id, source_platform, external_id)` and the old `notes = 'platform:id'` key
   (`20261017000003_import_batches.sql:353-358, 485`). A live trade has neither, so importing the day's Top One or Ebinex
   file would **insert it a second time** and double the day in the limit. Yet the decisions assume the match exists: the
   limit counts a live trade gross «até uma importação completar a comissão» (`fase2/decisoes.md`, owner item 2), and the
   Diário board says only trades «que chegam só pelo arquivo» are recalculated (§3.3). The matching rule is not on any
   board and not in the appendix (open question Q1).
5. **Three as-built mechanisms would break on live rows if reconciliation is done naively:** `import_fix_tz` rewrites
   `entry_time` of every row with a `source_local_entry` (`20261018000002_trading_day.sql:353-360`), `import_undo` deletes
   every row with the batch id (`20261017000003_import_batches.sql:570`), and the preview's "completable" logic only
   fills nulls by external id. A matched live trade must therefore never get `source_local_entry` or `import_batch_id`.
6. **Undo and images.** As built, `import_undo(p_batch uuid)` returns exactly `{"deleted": n}` (pinned by
   `supabase/tests/20_phase1.test.sql:272`) and has no image paths. The owner already decided that undoing an import also
   deletes that batch's marks (memory, Phase 1), so the appendix's `confirmar_cascata` flag is not needed, but the result
   must carry the Storage paths, and any append-only guard on `trade_marks` must let the FK cascade through.
7. **Storage does not exist yet.** No bucket (live diagnostic of 2026-10-17: "No storage buckets yet"), no Storage call
   anywhere in the app, no `storage` schema in the test stub (`supabase/tests/00_supabase_stub.sql`), no service-role key
   in `app/.env.example`, no cron (`app/vercel.json` was removed in Phase 0). The appendix's «cron de sábado apaga as
   pendentes» has nothing to run on.
8. **Appendix M6a vs what was built and drawn** (§8): no `status`, `registered_at`, `exit_registered_at`,
   `rule_version_id` yet (the FK target `unique (id, user_id)` on `account_rule_versions` was prepared,
   `20261018000001_rules_tables.sql:634-635`); `note` and `note_saved_at` already exist (Phase 1); stop and target are
   **prices** in the schema but **points with a time** on the boards; a binary's result is known at **expiry**, so the
   appendix's `limpa` (before `exit_registered_at`) is wrong for Ebinex; `register_entry`'s signature has no stake,
   payout or expiry; `trade_entry_context` has no column for the worst point the limit compares.
9. **Where the button lives.** The Diário header (`DiarioCabecalho.tsx:154-158`) already has the actions row the boards
   put «Registrar operação» in; `AppShell` already hosts a sheet provider (`ImportSheetProvider`) that a Registrar sheet
   can mirror; the import sheet's end screen for a new account (`ImportSheet.tsx:869-888`) is where the 2b board offers
   «Registrar operação». Until the Diário (Phase 4) there is no list where an **open** trade can be found again (Q3).
10. **Old pages will show a live trade wrongly unless it carries `result = 'pending'` while open**: `/trades` and
    `/analytics` map a null result to `'loss'` (`TradesV1Professional.tsx:27`, `AnalyticsV1Professional.tsx:35`), and the
    old balances add every account of a market together by `market_type` (`AccountBalanceDisplay.tsx:88-89`).
    `limit_usage` already ignores `pending` and null `pnl` (`20261018000003_rules_api.sql:619-621`).
11. **Most of the computation exists**: `gate_at`, `rule_version_at`, `compute_trading_day`, `limit_usage` in SQL;
    `evaluatePlan`, `toEntryContext`, `dayUsage`, `parseServerGate`, `possoLinha`, `marcaDoPlano`, `conferidos` in TS
    (§6). Phase 3 adds writers and a few columns, not a second gate.

---

## 1. The old trade forms, pages and hooks

### 1.1 What each one writes, and where the bridge puts it

| Writer | File:line | Live? | What it sends | Where `trades_bridge` places it (as of M5d) | Phase 3 impact |
|---|---|---|---|---|---|
| `createTrade` | `hooks/useTradesSupabase.ts:107-128` | **dead** (no caller) | any `TradeInsert` + `user_id` | no `account_id`: account by `market_type`, else by `asset_type` (`binary_option`→binary, `futures`→futures), preferring the account created from the old data (`legacy_market_type`), then active, primary, `sort_order` (`20261019000001_markets.sql:1106-1120`); `market_type` from the account; `source='after'` (no `ebinex:`/`topone:` note); `trading_day = compute_trading_day(...)` (`:1154`) | None while dead. If it were rewired it would write `after` trades on the device clock. |
| `updateTrade` | `useTradesSupabase.ts:131-154` | **dead** | any `TradeUpdate` | bridge re-runs only on `account_id/market_type/entry_time/user_id` (`20261017000002_trades_accounts.sql:207-209`) | The appendix's "grant update (old edit columns)" list is empty (§2.3). |
| `deleteTrade` | `useTradesSupabase.ts:157-168` | **live**: `/trades` «Excluir Selecionadas» → `TradesV1Professional.tsx:127-130` | `DELETE … eq('id')` | n/a | Hard-deletes a live trade with its marks, context and attachment rows (FK cascade), and orphans its Storage files (§5). Q5. |
| `quickAddBinaryTrade` | `useTradesSupabase.ts:171-219` | **dead** | `asset_type 'binary_option'`, no `market_type`, `pnl = stake·payout/100` or `−stake` (`:184-187`), `entry_time = exit_time = new Date()` (device clock, `:203-204`) | legacy binary account (the 2b fix, contract §4.8) | Its P&L formula is the one Ebinex live trades need (§8 G9). Never reuse its device-clock times. |
| `quickAddFuturesTrade` | `useTradesSupabase.ts:222-272` | **dead** | `asset_type 'futures'`, multiplier hard-coded `ES 50 / NQ 20 / else 1` (`:234`), `result` from the sign | legacy futures account | Shows the missing piece: there is no point-value table for MES/MNQ/MGC (§8 G9). |
| `importTrades` (old CSV) | `lib/utils/importTrades.ts:18-55` | **dead in the UI** (tests only: `__tests__/lib/importTrades.test.ts`, `legacyImport.golden.test.ts:59-66`) | REST `POST /rest/v1/trades?on_conflict=user_id,notes` with `resolution=ignore-duplicates`, `market_type` | `source='import'`, `source_platform/external_id` from `notes`, wall clock kept (`markets.sql:1135-1148`) | Needs only INSERT on legacy columns + `market_type` + `notes`; unaffected by column grants. |
| `useTrades` (all CRUD) | `hooks/useTrades.ts:70-168` | shim | nothing (warns, reads `localStorage`) | — | Only its `Trade` type is used by `/trades` components (`TradesTable.tsx:5`, `BulkActions.tsx:5`). |
| `useTradeStats` | `hooks/useTradeStats.ts:55-151` | shim | nothing | — | Used by `/accomplishments` only. |
| Bulk edit | `components/trades/BulkActions.tsx:131-166` → `onBulkUpdate={async () => {}}` (`TradesV1Professional.tsx:347`) | **no-op** | nothing | — | Confirms the empty UPDATE list. |
| «View» | `TradesTable.tsx:338-345` → `setSelectedTrade` whose value is discarded (`TradesV1Professional.tsx:63, 356`) | no-op | — | — | `/trades` has no detail view to add a note or image to. |

The "trade-stats" cache (`useTradesSupabase.ts:64-104`, key `['trade-stats', uid, filters]`) is computed from the trades
list in the browser; `useRefreshAfterWrite` already invalidates both `['trades']` and `['trade-stats']`
(`hooks/useContas.ts:116-126`), so a Registrar write that calls it refreshes the old pages too.

### 1.2 How the old pages will show live trades

| Page / component | Behaviour with a live trade | Source |
|---|---|---|
| `/trades` (`TradesV1Professional`) | `result null → 'loss'`, `status 'LOSE'`; `long/short → 'call'`; `exitTime = entry_time` when null; win rate over every row (open ones too, `useTradesSupabase.ts:71-74`) | `TradesV1Professional.tsx:26-57` |
| `/analytics` | `result null → 'loss'`; `profit = pnl ?? 0` | `AnalyticsV1Professional.tsx:35-36` |
| Dashboard `RecentTrades` | unknown result shows the raw text (`result ?? '—'`) | `RecentTrades.tsx:65-71` |
| Dashboard calendar | day = `new Date(entry_time).toISOString().slice(0, 10)` (UTC): Ebinex 21:00–23:59 Brasília lands on the next day (plan, Riscos) | `DashboardV1Modern.tsx:44-59` |
| `AccountBalanceDisplay` | sums `pnl` by `market_type` across **every** account of that market (a live trade in «Apex #1» moves the old «Top One» card) | `AccountBalanceDisplay.tsx:82-97` |
| Every old list | `useTradesSupabase` selects `*` ordered by `entry_time desc` with no paging, so PostgREST's `max_rows = 1000` (`supabase/config.toml:9`) cuts the oldest rows silently once the user passes 1 000 trades (629 today) | `useTradesSupabase.ts:23-61` |
| New markets | trades written with an `account_id` get `market_type = acc.market` (`markets.sql:1128-1132`), so `forex`, `stocks`, `crypto`, `b3` reach `trades.market_type` for the first time; the old `MarketType` has no `stocks`/`b3` (`types/markets.ts:3`) and `MARKET_ICONS` falls back to the binary icon (`TradesV1Professional.tsx:17-23, 225`). Contract 2b §2: "the test that the old dashboard and `/trades` survive them belongs" to Phase 3. | |

**Recommendation.** While a trade is open, write `result = 'pending'` (already allowed by the check,
`initial_schema.sql:152`) next to the new `status = 'open'`, and `pnl = null`. The old pages then show «pending» instead
of a loss, and `limit_usage` / `dayUsage` already skip it (`rules_api.sql:619-621`, `lib/domain/gate/usage.ts:80-86`).
Add a Jest case that renders `/trades` and the dashboard with a `stocks`/`b3` row and an open row (contract 2b's
deferred test).

---

## 2. The `trades` table as built

### 2.1 Columns Phase 3 reads or writes

| Column | Origin | Notes for Phase 3 |
|---|---|---|
| `id uuid`, `user_id → profiles(id)` | `initial_schema.sql:132-133` | `user_id` references **profiles**: an RPC that inserts must first `insert into profiles (id) … on conflict do nothing`, as `import_commit` does (`import_batches.sql:438-439`). |
| `symbol`, `asset_type text not null`, `direction` check `long/short/call/put` | `:137-141` | `asset_type` has no check. Contract 2b §4.8: "`trades.asset_type` for the new markets (`forex`, `crypto`, `stock`, `option`) is Phase 3's"; the 2b DB tests already write `forex`, `stock`, `crypto` (`40_markets.test.sql:722-726`). B3 has no value yet (§8 G13). |
| `entry_price`, `exit_price` numeric(18,8); `quantity` default 1 | `:142-144` | |
| `stake_amount`, `payout_percent`, `duration_seconds` | `:147-149` | The Ebinex variant (stake, payout, expiry). Ebinex imports also set `timeframe` (e.g. `M1`, `lib/domain/import/ebinex.ts:282-283`). |
| `result` check `win/loss/breakeven/pending`; `pnl`, `pnl_percent` | `:152-154` | `pending` exists and is unused today. |
| `strategy`, `setup_type`, `entry_reason`, `exit_reason`, `notes` | `:157-164` | `setup_type` is a free-text legacy column; the appendix puts the setup in `trade_marks`. `notes` is the **old import key** (unique per user, `20260510000001_trades_notes_unique.sql:4-5`); the owner's note goes in `note`. |
| `screenshot_entry`, `screenshot_exit` text | `:167-168` | Unused anywhere (only `types/database.ts:259-260`). Do not reuse: one URL per side cannot hold 4 private images. Phase 9 contraction. |
| `entry_time not null`, `exit_time`, `created_at`, `updated_at` (trigger) | `:171-174, 303-305` | |
| `session_id → trading_sessions` + 3 stats triggers | `:134, 311-345` | Fire only when `session_id` is set; Registrar never sets it. |
| `market_type` | `20260510000002_trades_market_type.sql:3` | Set by the bridge from the account. |
| `account_id`, `import_batch_id`, `source` (`live/after/import`), `source_platform`, `external_id`, `source_local_entry/exit`, `trading_day`, `commission` (null = unknown), `stop_price`, `target_price`, `note` (≤ 1 000), `note_saved_at` | `20261017000002_trades_accounts.sql:34-51` | `note`/`note_saved_at` are ready for «Imagens e nota». `stop_price`/`target_price` are **prices** (the Top One reader fills them from `SL`/`TP`, `lib/domain/import/topone.ts:130-137, 194-195`). |
| `unique (id, user_id)`, FK `(account_id, user_id)`, `unique (account_id, source_platform, external_id)` | `:53-57` | The first is what `trade_marks`, `trade_attachments` and `trade_entry_context` need for their composite FKs. The third never fires for live rows (nulls are distinct). |
| Indexes `(user_id, account_id, trading_day)`, `(user_id, symbol, entry_time)` | `:58-59` | Serve the day list and a live↔file match by symbol and time. |
| FK `(import_batch_id, user_id) → import_batches` | `import_batches.sql:37-39` | |

### 2.2 Triggers that fire on a Registrar insert

- `trades_bridge` (BEFORE INSERT or UPDATE OF `account_id, market_type, entry_time, user_id`), last body
  `20261019000001_markets.sql:1097-1157`: with `account_id` given it only checks ownership (`unknown_account`), sets
  `market_type`, leaves a non-null `source` alone, and sets `trading_day = compute_trading_day(acc.id, entry_time)`, which
  is version-aware since Phase 2 (`20261018000002_trading_day.sql:76-90`). An entry inside a window occurrence counts on
  the day that occurrence opened. Nothing to change for live inserts; the guard of §2.3 goes before it or inside it.
- `update_trades_updated_at` (`initial_schema.sql:303-305`).
- The session-stats triggers do not fire (no `session_id`).

### 2.3 Privileges and policies today, and what Phase 3 should do

| Today | Source |
|---|---|
| One policy `"Users can manage own trades" FOR ALL USING (auth.uid() = user_id)` | `initial_schema.sql:265-266` |
| Supabase default grants: `authenticated` and `anon` hold every table privilege (the test stub reproduces it with `alter default privileges … grant all`, `00_supabase_stub.sql:39-42`) | no `revoke` on `trades` in any migration (grep) |
| Contrast: `trading_accounts` UPDATE was narrowed to 7 columns, with a guard block that stops the migration when another grantor left a way around (`20261018000001_rules_tables.sql:743-766`), and is asserted in `40_markets.test.sql:893-896` | |

Recommended for Phase 3 (technical; follows the appendix's intent):

- `revoke insert, update on public.trades from anon, authenticated;`
  `grant insert (user_id, session_id, symbol, asset_type, direction, entry_price, exit_price, quantity, stake_amount,
  payout_percent, duration_seconds, result, pnl, pnl_percent, strategy, setup_type, timeframe, entry_reason, exit_reason,
  notes, screenshot_entry, screenshot_exit, entry_time, exit_time, market_type, account_id, commission, stop_price,
  target_price) on public.trades to authenticated;`
  The old writers and every DB-test insert use only these columns (the 19 test inserts use `user_id, symbol, entry_time,
  direction, asset_type, result, pnl, quantity, account_id, market_type, exit_time, commission, stake_amount,
  payout_percent, notes, timeframe`), and columns a trigger sets are not subject to column privileges, so the bridge keeps
  setting `source`, `source_platform`, `external_id`, `trading_day`. No UPDATE grant at all (no caller, §1.1).
- Keep `anon` out of everything (it already has no row through RLS; drop the privileges too).
- `source = 'live'`, `registered_at`, `exit_registered_at`, `rule_version_id`, `status`, `note`, `note_saved_at`
  become RPC-only by construction (no grant). Belt and braces: a BEFORE INSERT/UPDATE check that a `live` row was written
  with the transaction setting the RPC sets, the same pattern as `binary_hub.save_rules`
  (`20261018000003_rules_api.sql:531-536`, read by `profiles_rules_guard`, `20261018000001_rules_tables.sql:785-814`).
- The appendix's freeze trigger for live rows (`entry_time`, `registered_at`, `exit_registered_at` once set,
  `rule_version_id`, `source`, `account_id`) still matters for the server functions themselves (`import_commit`'s
  completion, `import_fix_tz`), see §3.3.
- A conference block in the migration, like `rules_tables.sql:751-766`: `has_column_privilege('authenticated',
  'public.trades', 'source', 'INSERT')` etc. must be false, and a Jest/DB assertion of the exact INSERT column list.
- DELETE: see Q5.

---

## 3. The import path and live trades

### 3.1 As built

| Piece | What it does | Source |
|---|---|---|
| `import_own_account(p_account)` | caller's account or `not_authenticated` / `unknown_account` / `archived_account` | `20261017000003_import_batches.sql:63-86` (internal; `revoke … from public, anon, authenticated` `:306`) |
| `import_check_platform` | only `ebinex`→binary and `topone`→futures; anything else `unknown_platform` / `wrong_market` | `:289-304` |
| `import_batches.platform` | `check (platform in ('ebinex', 'topone'))` | `:12` |
| `import_checked_rows` | validates every field before casting; Ebinex rows must be `binary_option` + `call/put`, Top One `futures` + `long/short` (`:187-190`); wall clock → instant with the file zone or the row's own offset; `trading_day` by `compute_trading_day` (Phase 2 body `20261018000002_trading_day.sql:167-312`, `:307`) | |
| `import_preview` | counts `new`, `duplicate` (same account + platform + external id), `completable` (duplicate missing commission/stop/target/exit/payout/duration), `other_account` (same `notes` key in another account), `day_changes`, `already_imported` (same SHA-256), `tz_status` | `import_batches.sql:318-395` (classification `:353-358`, completable `:364-373`) |
| `import_commit` | ensures the profile (`:438-439`); inserts with `on conflict (account_id, source_platform, external_id) do update` that fills only nulls (the "completion", `:472-512`); a commit with 0 inserted deletes its batch (`:516-519`); the first wall-clock file confirms the account's zone (`:527-531`) | `:399-542` |
| `import_undo(p_batch)` | refuses legacy / undone batches; `delete from trades where import_batch_id = b.id` (`:570`); releases the zone confirmation when no wall-clock row is left; returns `{"deleted": n}` (`:580`). The header comment already says "(and, from Phase 3 on, their marks and images)" (`:544`). | `:544-582` |
| `import_fix_tz` | re-places **every row with `source_local_entry`** on a new zone and lets the bridge recompute the day | Phase 2 body `20261018000002_trading_day.sql:314-367` (`:353-360`) |
| UI | preview step `PassoPrevia` (`components/hub/importar/passos.tsx:863-970`); "nothing new" test `ImportSheet.tsx:281` and `:475` (`new === 0 && completable === 0 …`); commit `:492`; undo right after commit `:503-512`; «Importações» undo with «Desfazer apaga as {n} operações desta importação.» (`components/hub/contas/copy.ts:208-215`, `Importacoes.tsx:43-50`) | |
| Error codes the app understands | `RPC_ERROR_CODES` (`lib/hub/contasDb.ts:17-32`); anything else becomes `unknown`. New Phase 3 codes must be added there (or to the rules list, `lib/hub/regrasDb.ts:25`). | |

### 3.2 «A revisar»

Not built. The appendix's `trading_accounts.kind ('normal','revisar')` was dropped in Phase 1 because the live database
had no trade without `market_type` (`fase1/levantamento/contas.md` G9; memory: "no 'A revisar' account is needed").
The as-built table has no `kind` column (`20261017000001_trading_accounts.sql:11-43`); a writer without an account and
without a usable market gets `no_account_for_trade` from the bridge (`markets.sql:1117-1119`). Registrar always names
its account, so Phase 3 needs nothing here.

### 3.3 What a live trade must look like so imports keep working

Board facts:
- `DiarioHojeEnxuto` / `DiarioDezEnxuto` `infos.grava` (@398490 / @568892): «O limite só encerra o dia na tela quando as
  operações são registradas durante o pregão; as que chegam só pelo arquivo, depois, entram com o “Posso operar hoje?”
  recalculado, e a operação mostra isso.» So a trade that is both registered and in the file is **one** trade.
- `fase2/decisoes.md` (owner, item 2): «operação sem comissão conta bruto até uma importação completar a comissão».
  So the file **completes** a live trade.
- Memory (Phase 1): «undoing an import also deletes that batch's marks».

Requirements that follow, each tied to as-built code:

| # | Requirement | Why (as built) |
|---|---|---|
| L1 | A live row keeps `source_local_entry = null` and `source_local_exit = null`, always. | `import_fix_tz` moves every row that has them (`trading_day.sql:359`); `import_tz_status` reads them (`import_batches.sql:283`). The broker's own times, if kept, go in new columns (e.g. `broker_entry_time`), never in these. |
| L2 | A live row never gets `import_batch_id`, even when a file completes it. | `import_undo` deletes by batch (`:570`): undoing the file would delete the live trade with its marks and images. Record the link elsewhere (a `matched_batch_id`, or the batch's own list) if "undo" must also undo the completion. |
| L3 | When a file row is matched to a live row, the live row gets `source_platform` + `external_id` (and the old `notes` key `platform:id`, if no other row of the user has it). | Then re-importing the same file finds it by the normal key (`on conflict … do update`, `:485`) and by `other_account` (`:356-358`), and never inserts a duplicate. `notes` is unique per user (`20260510000001`), so set it only when free. |
| L4 | Completion of a live row fills only what is unknown (commission, missing prices) and **never** `entry_time`, `exit_time`, `registered_at`, `exit_registered_at`, `trading_day`, `rule_version_id`, `account_id`, `source`. | The appendix freezes these for live rows; the limit and the plan were evaluated on them; `trading_day` would move with `entry_time`. Whether the file's P&L replaces a typed P&L is Q1. |
| L5 | The match is unambiguous or it does not happen. | Candidate key: same account, same instrument (futures: the root, since the Top One file writes contract codes such as `MNQM6` and the board offers `MES`, `MNQ`, `MGC`, RegistrarOperacao data `px`), same side, same quantity (or stake for binaries), broker entry within a few minutes **before** `registered_at` (the owner registers after placing the order). Index `trades_user_sym_entry` exists (`trades_accounts.sql:59`), but on the root symbol it needs a prefix match or a stored root. |
| L6 | Preview and commit report the matched rows separately. | Today they would be counted `new` (`import_batches.sql:362`) and inserted; `ImportSheet.tsx:281/475` treat "nothing new" by `new`/`completable`/`other_account` only. A NEW line is needed, e.g. «{n} já registradas no app: completamos a comissão.» (**NEW**). |
| L7 | The file's rows for the same day count once in the limit. | `limit_usage` sums every row of the day (`rules_api.sql:613-623`); a duplicate halves «US$ 400». |

### 3.4 The column-mapping import (ImportarConta scenario 8) meets the same rules

Board (2b `ImportarConta`, scenario 8 «Arquivo não reconhecido»): «Não reconhecemos este arquivo. Diga o que é cada
coluna.»; required «Entrada», «Ativo», «Lado», «Quantidade», «Resultado (ou os preços)»; «Opcionais: Saída, Comissão,
Stop, Alvo, ID da operação (evita duplicar), Conta.»; end «Modelo “{nome}” salvo: os próximos arquivos com estas colunas
entram direto.» (script `MP`, `fimModelo`). Decision (`mercados/decisoes.md` item 3): new-market accounts get trades
from Registrar and, right after, this import.

As-built blockers (for the spec that owns scenario 8, listed here because they are legacy constraints):
`import_batches.platform` and `import_check_platform` accept only `ebinex`/`topone` (`import_batches.sql:12, 289-304`);
`import_checked_rows` hard-codes asset type and side per platform (`:187-190`) and requires `external_id`
(`:185`, `bad_id`), while the board makes the ID optional («evita duplicar»); the TS `Platform` type is
`'ebinex' | 'topone'` and `ImportMarket` is binary/futures only (`lib/domain/import/types.ts:13-18`); no table holds a
saved mapping. Without an ID column, dedupe and the live match both fall back to the L5 key.

---

## 4. Where Registrar enters the hub UI

| Place | Today | What the boards show | Phase 3 touchpoint |
|---|---|---|---|
| `app/(hub)/layout.tsx:1-32` | `HubRoot` → `ProtectedRoute` → `HubGate` → `AppShell`; one stylesheet per lane (`:2-6`) | | Add `styles/hub-registrar.css` in the same pattern (the Phase 2 comment: "one file per lane"). |
| `components/hub/AppShell.tsx:6-19` | wraps every hub page in `ImportSheetProvider` and renders `HubHeader` | | A `RegistrarSheetProvider` beside it (focus return, `inert` page, no scroll: `ImportSheetProvider.tsx:46-80`). The import sheet's end screen must be able to open it (one provider for both sheets, or the Registrar provider outside the import one). |
| `components/hub/HubHeader.tsx:17-25, 111-152` | menu Início · Diário · Análises · Mercado · Social · AI · Conquistas; theme, phone menu, profile menu | No board puts Registrar in the header. | Nothing; `AppShell.test.tsx:64-99` pins the menu. |
| `components/hub/HubGate.tsx:44-120` | asks `GET /api/hub/acesso` (HUB_USERS) and hides the hub | | Only hides. RPCs called from the browser are not behind HUB_USERS (RLS limits them to the owner's rows, like the import functions). Any new **API route** must call `requireUser` then `denyHubAccess` (CLAUDE.md) and be added to `EXPECTED_HANDLERS`. |
| `components/hub/contas/DiarioCabecalho.tsx:144-161` | H1 «Diário» and one action, «Importar arquivo» (`hub-btn`, `:154-158`); the selector row with «Janela …» under it; `?importar=1` opens the sheet once and is removed from the URL (`:59-68`) | `DiarioHojeEnxuto`/`DiarioDezEnxuto` @23611: `<a class="btn">Registrar operação</a><a class="btn">Importar arquivo</a>` in the H1 row. `RegistrarOperacao` @24820: `<button class="btn pri">Registrar operação</button><a class="btn">Importar arquivo</a>` next to the account selector. | Add «Registrar operação» first in the existing `.hub-acoes` (ADAPTED: the two boards disagree on primary styling; the Registrar board's `btn pri` fits a phone, where it is the main action). It opens on `conta.current` for **every** market (unlike import, which skips markets without a reader, `:46`). A `?registrar=1` twin of `?importar=1` gives the old pages a link target. |
| `app/(hub)/diario/page.tsx:11-28` | header, «Posso operar hoje?» card, then the placeholder «O Diário chega na Fase 4.» / «Até lá, suas operações continuam na página Operações.» / «Abrir Operações» → `/trades` | Diário boards: «Operações do dia» table with the open trade and «Adicionar imagens ou nota» per row (`DiarioDezEnxuto` @78694) | Phase 4 owns the day table. Phase 3 still needs a way back to an **open** trade to register its exit (Q3). The placeholder text is pinned (`PossoOperarHoje.test.tsx:745`). |
| `components/hub/posso/PossoOperarHojeDiario.tsx:13-26` + `hooks/useRegras.ts:103-112` | `rules_now()` re-read at `changes_at`, on focus, and after any write that invalidates `['hub', uid]` | The Registrar sheet shows the same answer (`F.gate`) | Reuse the same query (one read serves the card, the window line and the sheet; `PossoOperarHoje.test.tsx:749-756` asserts one call). After `register_entry` / `register_exit`, call `useRefreshAfterWrite` (`hooks/useContas.ts:116-126`) so the card and the limit move. |
| `components/hub/importar/ImportSheet.tsx:869-888` (`fimConta`) | new account → «{label} criada.» + «Nada ainda. Importe o histórico ou registre a primeira operação.» with only «Importar histórico» (comment «ADAPTED: Registrar operação arrives in Phase 3», `copy.ts:596-601`); markets without a reader get «Nada ainda: as operações desta conta entram pelo “Registrar operação”, que chega na Fase 3.» and no action (`:873-882`) | 2b `ImportarConta` footer: «Registrar operação» as `btn` before or `btn pri` after the main action (`rod.temLinkAntes` / `rod.temLinkDepois`, @59432 / @59832); script: «escolheu “Registrar à mão”: Registrar operação é o botão principal» | Add «Registrar operação» there (primary for markets without a reader and for IQ Option, `copy.ts:412` «IQ Option não exporta histórico: registre à mão.»); rewrite the four «…, que chega na Fase 3» strings (`copy.ts:126-127, 361-362, 601`, `CONTAS.info` `:124`). The board's «Enviar arquivo» / «Registrar à mão» choice (`I3`, @53124) was not built in 2b; whether it comes back is the registrar spec's call. |
| `components/hub/contas/SuasContas.tsx:36-41` | `activityText`: any imported trade → «só histórico importado» (`copy.ts:137`), else «{n} op. registradas» (`:139`, commented "trades typed on the old pages"), else «sem operações» | Personalizar board: «{n} op. desde então» once rules exist (`copyRegras.ts:114`, used by `lib/hub/regrasConta.ts:360`) | Accounts **with** a version already show «{n} op. desde então», counted from v1 by `fetchTradesSince` (`lib/hub/regrasDb.ts:181-198`), live trades included. For an account **without** a version, an account with imports **and** live trades would still read «só histórico importado»: fix the order and the comment. |
| Personalizar «Nenhuma versão salva» | «Até salvar, as operações ficam em “Histórico importado · só resultado”.» (`components/hub/personalizar/copy.ts:365`; contract 2b: "revisit in Phase 3") and `marcaDoPlano` labels every pre-v1 trade «Histórico importado · só resultado» (`lib/hub/posso.ts:183-185`) | | A trade registered live in an account without rules is not imported history. Q4. |
| Old dashboard CTA | «Adicionar novas operações» / «Add new trades» → `router.push('/trades')` (`HeroSectionPT.tsx:43-48`, `HeroSection.tsx:43-48`), and `/trades` has no form | | Optional: point it to the hub like the import buttons (`DiarioImportLink.tsx:7`, `IMPORT_HREF = '/diario?importar=1'`). Pinned by `HeroSection.test.tsx:102-109` (English). Q6. |

Formatting helpers to avoid for Registrar times: `formatWhen` / `formatDay` use the **device** clock
(`lib/hub/formato.ts:106-125`); mark times and «Entrada registrada às 10:07 ET» are on the account's clock (the board's
`relH` = `hm(m) + ' ET' | ' de Brasília'`), which `horaNoRelogio` + `sufixoRelogio` already give (`lib/hub/posso.ts:45-52`).
`useAgora` is the device clock (`hooks/useAgora.ts:15-37`); the board's «Agora: …» clock is marked «só no protótipo».

---

## 5. Storage and Supabase configuration

| Item | State | Source |
|---|---|---|
| Buckets | none in the live project (diagnostic of 2026-10-17) and none in any migration | memory `market-hub-initiative.md` (Phase 1 diagnostic); `grep storage` over `supabase/` |
| App code using Storage | none: no `supabase.storage`, no `createSignedUrl`, no upload; the only "upload" UIs are the old CSV tab (now a link) and a community mock (`CreatePostModal.tsx:120`) | grep over `app/` |
| `supabase/config.toml` | local only: `[storage] enabled = true`, `file_size_limit = "50MiB"` (`:27-29`); `[api] max_rows = 1000` (`:9`); `[db] major_version = 15` (`:14`) while the live project is Postgres 17.6 and CI runs `postgres:17` (`.github/workflows/ci.yml`, job `db`). No `[storage.buckets]` section. | |
| How SQL reaches the live DB | the owner pastes migrations in the SQL Editor (no CLI link, no `supabase_migrations` history) | memory, Phase 1 |
| Test stub | `auth.users`, `auth.uid()`, `auth.role()`, roles `anon`/`authenticated`, default grants; **no `storage` schema**, no `storage.buckets`, `storage.objects`, `storage.foldername()` | `supabase/tests/00_supabase_stub.sql:1-91` |
| Server secrets | `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `AI_ALLOWED_USERS`, `HUB_USERS`; **no service-role key**; `createServerClient(accessToken?)` uses the anon key plus the caller's JWT (`lib/supabase.ts:89-104`) | |
| Crons | none (`app/vercel.json` removed in Phase 0; no `CRON_SECRET`) | plan §4, apendice §C |
| Upload size | Vercel functions take at most 4.5 MB per request (apendice §B); images are up to 10 MB each (board «até 4 PNG/JPG/WebP de até 10 MB cada», memory 2026-10-16) | |
| `next.config.js` images | `images.formats`, no `remotePatterns`: signed URLs must be shown with `<img>`, or `remotePatterns` must name the Supabase host for `next/image` | `app/next.config.js:18-23` |

Consequences:
- **Direct upload from the browser works without an API route.** `supabase-js` uploads straight to Storage with the
  user's JWT (not through Vercel), so the 4.5 MB limit does not apply. With an insert policy on `storage.objects` that
  requires a `pendente` row of `trade_attachments` for exactly that path and that user, the 4-image limit is enforced by
  the table trigger and the bucket policy together; no service role and no `HUB_USERS` route are needed. The appendix's
  `POST /api/trades/[id]/anexos` is an alternative (then: `requireUser` + `denyHubAccess`, `EXPECTED_HANDLERS`, and the
  signed upload URL created with the caller's JWT).
- **Pending cleanup without a cron.** Stale `pendente` rows (> 1 h) of the same user can be listed and removed by the
  next attach call (the RPC returns their paths; the browser deletes them through the Storage API under the owner's
  policy). A Saturday cron would need a new server secret (service-role key) and a Vercel cron: NEW infrastructure.
- **Deleting a trade deletes rows, not files.** `import_undo`, the `/trades` bulk delete and any future delete must hand
  the paths to the browser (or a route) to remove the objects; SQL must never touch `storage.objects` rows directly
  (apendice §B).
- **Policies on `storage.objects` from the SQL Editor**: verify on the live project in the paste kit's dry run that the
  `postgres` role can create them (Supabase owns `storage.objects` through `supabase_storage_admin`); stop the kit if
  not.
- **DB tests** need a minimal `storage` stub (`buckets`, `objects(bucket_id, name, owner)`, `foldername(text)`) to test
  "5th image refused", "11 MB refused", "GIF refused", "another user's folder refused" (apendice §D), or those cases run
  only in a manual live check.
- **iPhone**: Safari's `canvas.toBlob('image/webp')` falls back to PNG, so "convert to WebP in the browser" (apendice
  §B) cannot be assumed on the owner's phone; the mime check must keep PNG and JPEG, and the size check applies after
  conversion.

---

## 6. Helpers Phase 3 reuses

### 6.1 SQL

| Function | What Registrar uses it for | Source |
|---|---|---|
| `gate_at(p_account, p_at)` (invoker; checks `auth.uid()` and ownership) | the answer at entry: `status`, `warnings`, `checks_evaluated`, `window`, `limit` (`worst_usd`, `net_usd`, `near`), `trading_day`, `version {id, version_no}`; call it **before** inserting the trade so the trade never counts in its own limit | `20261019000001_markets.sql:954-1001` |
| `gate_eval` (pure) | same truth table as `lib/domain/gate`; `checks_evaluated` never lists a check that did not run | `markets.sql:813-952` |
| `limit_usage(account, day, soma, amount, until)` | day result in exit order, net of known commission; skips `pnl is null` and `result = 'pending'` | `20261018000003_rules_api.sql:598-634` |
| `rule_version_at(account, at)` | `rule_version_id` of the entry | `20261018000002_trading_day.sql:62-73` |
| `compute_trading_day(account, at)` | already applied by the bridge | `trading_day.sql:76-90` |
| `rules_limit_amount(resolved)` | limit in the account's currency (`usd` or `brl`) | `markets.sql:166-173` |
| `market_caps(market)` / `market_caps_all()` | per-market facts; the place to add per-market Registrar facts (asset type, side words) so `MARKET_SPEC` keeps parity | `markets.sql:103-163` |
| `import_own_account(p_account)` | ownership + archived check; internal, callable only from definer functions | `import_batches.sql:63-86` |
| Profile guarantee | `insert into profiles (id) … on conflict do nothing` before any trade insert | `import_batches.sql:438-439` |
| Append-only guard pattern | `account_rule_versions_guard` refuses UPDATE/DELETE except the user cascade | `rules_tables.sql:645-679` |
| RPC-only write pattern | transaction setting `binary_hub.save_rules` read by a guard trigger | `rules_api.sql:531-536`, `rules_tables.sql:785-814` |
| Privilege conference pattern | `do $$ … has_column_privilege … raise exception 'privileges_not_applied'` | `rules_tables.sql:749-766`, `markets.sql:1257-1280` |

### 6.2 TypeScript

| Helper | Use in Registrar | Source |
|---|---|---|
| `evaluatePlan`, `toEntryContext`, `BREAK_ORDER`, `EntryContext` | the plan preview before saving; the shape `trade_entry_context` stores (null = not evaluated) | `lib/domain/gate/plan.ts:91-162` |
| `evaluateGate`, `gateTradingDay`, `computeTradingDay`, `parseServerGate`, `answerOf` | previews and parsing `gate_at` | `lib/domain/gate/evaluate.ts:162-205, 207, 369, 430` |
| `dayUsage`, `dayResultFromServer` | the day result for a plan, with `excludeId` for the trade itself (needed for «depois», `register_after`) | `lib/domain/gate/usage.ts:71-141` |
| `versionAt`, `parseRuleVersion`, `usdToCents`, `centsToUsd` | | `lib/domain/gate/rules.ts:133-143, 356-385` |
| `MARKET_SPEC`, `currencyOf`, `limitKey` | currency of stake/limit text (R$ on B3) | `lib/domain/markets.ts:89-182` |
| `utcToLocal`, `localToUtc`, `tradingDayOn`, `tradingDayFor`, `windowOccurrenceAt`, `parseHhMm`, `formatHhMm` | times on the account's clock, the «depois» time field ("HH:MM" without `Date`) | `lib/domain/tempo.ts:87, 165, 290, 366, 385, 451, 461` |
| `possoLinha`, `possoTexto`, `marcaDoPlano`, `conferidos`, `regraDoEstado`, `horaNoRelogio`, `sufixoRelogio`, `dinheiroCompacto`, `janelaLinha` | the gate line, «Fora do plano: …», «Conferidos: janela e limite.», times with « ET» / « de Brasília» | `lib/hub/posso.ts:45-217` |
| `parseRulesNow`, `AccountNow` (`version.id`, `rules`, `gate`, `today`) | what the sheet knows without a new read | `lib/hub/regras.ts:896-965` |
| `useRulesNow`, `regrasKeys` | | `hooks/useRegras.ts:21-25, 103-112` |
| `useHubDb`, `hubKeys`, `useRefreshAfterWrite`, `useContaAtual` | client with the JWT; cache refresh after a write; account in context | `hooks/useContas.ts:20-38, 116-188` |
| `run`, `rpc` (30 s timeout, object answer), `toHubError`, `HubDataError` | error codes only, never database text | `lib/hub/contasDb.ts:48-101, 318-335` |
| `formatMoney`, `SIMBOLO_MOEDA` | «US$ 400», «R$ 500» | `lib/hub/formato.ts:21-43` |
| Ebinex exit rule `ebinexExit` | the file's exit = candle opening (the minute after the order) + candle length; useful to match a live binary to its file row | `lib/domain/import/ebinex.ts:59-70` |
| Test fixtures `testing/gate.ts` (`TOP_ONE`, `EBINEX`, `et`, `brt`, `topOneRules`, `trade`, `version`) | Phase 3 Jest cases | `app/testing/gate.ts:8-55` |

Boundary: `lib/domain` may import only itself (ESLint rule, pinned by `__tests__/domain/boundary.test.ts`); pt-BR words
stay in `lib/hub` / components.

---

## 7. Tests that pin behaviour Phase 3 must keep

### 7.1 Jest (`app/__tests__`)

| Test | What it pins | Phase 3 effect |
|---|---|---|
| `api/routesRequireAuth.test.ts:11-16, 76-78` | the exact list of route handlers on disk | Any new route (e.g. `POST /api/trades/[id]/anexos`) must be added, and turn away a request without a token. |
| `components/hub/DiarioCabecalho.test.tsx:100-105, 218-243` | H1 «Diário», a button named exactly «Importar arquivo», `?importar=1` opening once | A second button «Registrar operação» does not break them (exact-name queries). |
| `components/hub/PossoOperarHoje.test.tsx:733-757` (`/diario`) | order H1 → selector → card → «O Diário chega na Fase 4.»; `rules_now` read **once** for card and window line | Anything Phase 3 adds to `/diario` must sit where the order still holds and share the `rules_now` query. |
| `components/hub/AppShell.test.tsx:64-99` | menu items and order, «em breve» | Do not add Registrar to the menu. |
| `components/dashboard/oldImportButtons.test.tsx:49-101` | old pages link to `/diario?importar=1`, no file input | Unchanged. |
| `components/dashboard/HeroSection.test.tsx:102-109` | «Add new trades» pushes `/trades` | Changes only if Q6 is yes. |
| `domain/gate/cases.test.ts` + `cases.json`; `gate.test.ts:159-173` (`toEntryContext` shape incl. `day_worst_at_entry_cents`); `tabelas.test.ts` | TS = SQL truth table | `register_entry`'s stored context must be what `toEntryContext` gives for the same inputs (apendice: «a mesma tabela-verdade testa os dois lados»). |
| `domain/tempo.test.ts` | parity with Postgres `AT TIME ZONE` | The «depois» entry time conversion must agree. |
| `domain/markets.test.ts` | `MARKET_SPEC` = the `market_caps_all()` literal parsed out of `20261019000001_markets.sql` | A new per-market field (asset type, side words) must change both sides, and the test's file path if the literal moves to a Phase 3 migration. |
| `domain/import/*` (parity, fixtures, readers), `lib/legacyImport.golden.test.ts`, `lib/importTrades.test.ts` | readers frozen; legacy request body | Untouched unless reconciliation changes `ImportRow`. |
| `domain/boundary.test.ts` | `lib/domain` imports | New domain code (P&L, point values, matching) stays pure. |
| `lib/hubContasDb.test.ts`, `hooks/useRegras.test.tsx`, `lib/hubPosso.test.ts` | error mapping, cache keys, posso words incl. «Histórico importado · só resultado» | Q4 may change `marcaDoPlano`. |
| `lib/hubRegras.pg.test.ts`, `lib/hubMercados.pg.test.ts` | the rules layer against real SQL; skipped unless `BH_PG_URL` | A `register_*` pg test can follow the same harness (`testing/pg.ts`). |

### 7.2 Database (`supabase/tests`, CI job `db` on `postgres:17`)

| Test | What it pins | Phase 3 effect |
|---|---|---|
| `run.sh:33-46` | stub, pre-Phase-1 migrations, legacy seed, then every later migration, then every `*.test.sql` | A `50_phase3.test.sql` slots in; a storage stub goes in `00_supabase_stub.sql`. |
| `20_phase1.test.sql:71-96` | old-page REST inserts **as `authenticated`** still land on the right account with `source` set by the bridge; a trade cannot point at another user's account | Requires INSERT on those columns to stay granted (§2.3). |
| `20_phase1.test.sql:150-300` | preview/commit/re-import/completion/other account/undo; `import_undo` returns **exactly** `{"deleted": 2}` (`:272`) | Adding image paths to the answer changes this assertion. |
| `20_phase1.test.sql:105-110`, `40_markets.test.sql:897-899` | `anon` runs no import or rules function | New `register_*` functions: same revoke, and extend the regex list. |
| `30_phase2.test.sql:143-148` `tests.drift()` and the final checks | every stored `trading_day` = `compute_trading_day(account, entry_time)` | Live trades must satisfy it (they do through the bridge); keep the check in Phase 3's conference. |
| `30_phase2.test.sql:900-940` | `gate_at` / limit with trades inserted as `authenticated`, incl. `soma`, example and archived accounts | Same INSERT grant requirement. |
| `40_markets.test.sql:412-420, 714-730, 830-870` | trading days of new-market trades (`asset_type 'forex'/'stock'/'crypto'`), old-page trades landing on legacy accounts | Fixes the asset-type vocabulary unless Phase 3 changes it. |
| `40_markets.test.sql:893-896` | `authenticated` UPDATE columns on `trading_accounts` = exactly 7 | Registrar must not need more. |

---

## 8. Gaps between apendice §B «Fase 3: M6a» and what was built or drawn

| # | Appendix | As built / boards | Recommendation |
|---|---|---|---|
| G1 | `trades.status text not null default 'closed' check (open, closed)` | no column; `result` already allows `pending` (`initial_schema.sql:152`) | Add `status` as sketched (629 rows become `closed` by default) **and** write `result = 'pending'`, `pnl = null` while open (§1.2). Check: `status = 'open'` only for `source = 'live'`. |
| G2 | `registered_at`, `exit_registered_at`, `rule_version_id` + FK `(rule_version_id, user_id)` | none; FK target ready (`rules_tables.sql:634-635`) | As sketched; `registered_at` null for `import`/`after`. |
| G3 | Freeze trigger on live rows; `revoke update` then `grant update (old edit columns from useTradesSupabase.ts:141)` | the old edit has no caller; the bridge accepts a client `source` | Column grants for INSERT, no UPDATE grant (§2.3); freeze trigger still guards server functions. |
| G4 | `register_entry(account, symbol, direction, qty, price, stop, target, setup)` | Board futures: «Ativo», «Lado», «Contratos», «Preço de entrada» (with «Sugestão: o último preço na tela. Ajuste ao da sua plataforma.»), «Stop e alvo, em pontos · opcional»; binary: «Par», «Direção», «Expiração», «Stake, US$», «Payout, %» | Add stake, payout, expiry; setup **optional** (the board allows marking later); emotion/execution marks at entry also go through `trade_marks`. Price suggestion needs market data: `/api/market/quote` exists but checks only `requireUser`, not `HUB_USERS` (`app/api/market/quote/route.ts:43-45`), contrary to CLAUDE.md; leave the suggestion for Phase 5. |
| G5 | `register_exit(trade, price, pnl, result)`: `exit_time = exit_registered_at = now()` | Board binary: the result is known at expiry («Hora em que o resultado passa a ser conhecido: a saída registrada; na binária, o vencimento (já se sabe na entrada).», RegistrarOperacao @62365); «Opção vencida» / «Como terminou?» | Binary: `exit_time = registered_at + expiry`, `exit_registered_at = now()` when the result is recorded. Futures: `exit_time = exit_registered_at = now()` live; typed time only in «depois». |
| G6 | `trade_marks_v.limpa = source = 'live' and marked_at < coalesce(exit_registered_at, 'infinity')` | wrong for binaries (G5); the board also says «Mudou uma marca depois? Em Análises vale a de antes da saída, e a troca fica guardada.» | `limpa = source = 'live' and marked_at < known_at`, `known_at` = expiry for binaries, `exit_registered_at` otherwise; the view also exposes the latest mark per kind. |
| G7 | `trade_marks.kind in ('setup','execucao','emocao','seguiu_texto')`, `value text` | Board groups: Setup A/B/C; Execução cedo/no ponto/tarde; Emoção Calmo/Confiante/Ansioso/Frustrado/Neutro (RegistrarOperacao script `GRUPOS`) | Check the value per kind; `seguiu_texto` has no Phase 3 screen (Diário review, later). |
| G8 | `trade_entry_context(... day_pnl_at_entry numeric(18,2) ...)` | TS `EntryContext` also has `day_worst_at_entry_cents` (`plan.ts:141-143`), which is what the limit compares; `GateResult.warnings` (`fora_janela`, `limite` in «aviso»/«avisar» modes) has no column | Add `day_worst_at_entry` and `warnings text[]`; keep `gate` nullable (nothing evaluated → null). `screen`, `market_as_of`, `bias*` stay null until Phase 5. |
| G9 | `pnl` passed in | No point-value table (only `ES 50 / NQ 20` hard-coded in a dead hook, `useTradesSupabase.ts:234`); board futures are micros (`MES`, `MNQ`, `MGC`) | NEW pure domain table of point values per root (and tick) for the offered futures; binary P&L as `quickAddBinaryTrade` (`:184-187`): win `stake × payout / 100`, loss `−stake`, draw/refund 0. Commission stays null (unknown) until a file completes it. |
| G10 | `stop`, `target` (prices implied) | columns are prices (Top One `SL`/`TP`); the boards take **points** and show a time: «stop 11 · alvo 22 pts · às 10:05» (`DiarioHojeEnxuto` data `stopTxt`) | Store prices (`entry ∓ points` by side) so file and live agree, plus `levels_at timestamptz` (server time) for «às 10:05»; show points by difference. |
| G11 | `trade_attachments` + bucket + policies; route + "cron de sábado" | no bucket, no Storage code, no service role, no cron, no storage stub (§5); legacy `screenshot_entry/exit` unused | As sketched for the table and bucket; browser-direct upload under a policy tied to a `pendente` row; cleanup in the next attach call; storage stub for DB tests. |
| G12 | `import_undo(batch, confirmar_cascata)` returns image paths; refuses without confirmation | as built `import_undo(p_batch)` → `{"deleted": n}`; owner already decided undo deletes the batch's marks | Keep one argument; return `{"deleted", "paths"}`; the confirmation text gains «e as marcas e imagens delas» (ADAPTED from `copy.ts:208-211`); update `20_phase1.test.sql:272`. Guards on child tables must let the FK cascade through. |
| G13 | nothing on `asset_type` | 2b tests use `forex`, `stock`, `crypto`; contract adds `option`; B3 has none | One constant per market in `market_caps` (`futures`, `binary_option`, `forex`, `stock`, `crypto`, `option`, and a B3 value). |
| G14 | nothing on matching a file to a live trade | §3.3 | Reconciliation rules L1–L7; Q1. |
| G15 | `register_after(...)` with `origin = 'reconstructed'` | `source = 'after'` already labels every legacy hand-typed row (`trades_accounts.sql:99`, bridge `:198`) | Distinguish by the presence of `trade_entry_context` with `origin = 'reconstructed'` (legacy `after` rows have none). The typed entry time goes through `AT TIME ZONE` in SQL (CLAUDE.md), and the gate is evaluated at that instant **before** inserting. |
| G16 | «Desde»: "a primeira operação ao vivo já tem versão de regra" (§E) | a live trade in an account with no version gets `rule_version_id = null` and `marcaDoPlano` calls it «Histórico importado · só resultado» | Q4. |
| G17 | `trades.note` for «uma nota» | `note` ≤ 1 000 and `note_saved_at` exist (`trades_accounts.sql:50-51`); no writer | A `save_note` RPC sets `note_saved_at = now()`; same for imported and `after` trades (board «Adicionar imagens ou nota» appears on any trade row). |

---

## 9. Risks

| # | Risk | Where | Mitigation |
|---|---|---|---|
| R1 | A day's file imported after live registration doubles the day (limit, Análises). | §3.3 | Reconciliation before Phase 3 ships, or block import of days that have live trades until it exists. |
| R2 | `import_fix_tz` rewrites a matched live trade's `entry_time` (if the broker time went into `source_local_entry`), or the freeze trigger makes `import_fix_tz` fail for the whole account. | `trading_day.sql:353-360` | L1; a DB test: fix the zone of an account that has live and imported trades. |
| R3 | Undoing a file deletes a live trade it completed. | `import_batches.sql:570` | L2; DB test. |
| R4 | Forged live trades through REST (`source = 'live'`, past `entry_time`). | bridge `markets.sql:1134` | §2.3 grants + guard; DB test as `authenticated`. |
| R5 | Client edits `trading_day`, `import_batch_id`, `entry_time` of any trade today. | `initial_schema.sql:265-266` | No UPDATE grant (§2.3). |
| R6 | `/trades` bulk delete removes a live trade (evidence) and orphans its images; or fails with `append_only` if the marks guard blocks the cascade. | `TradesV1Professional.tsx:127-130` | Q5. |
| R7 | Old pages show an open trade as a loss. | §1.2 | `result = 'pending'` while open. |
| R8 | 1 000-row cut in old lists. | `config.toml:9`, `useTradesSupabase.ts:28-32` | Known since Phase 2; Registrar's own lists come from an RPC returning one `jsonb`. |
| R9 | Device clock on the phone shows a wrong «Agora». | `useAgora.ts` | Times of record are `now()` in SQL; display the server offset from `rules_now.server_now`. |
| R10 | Storage policies cannot be created from the SQL Editor on the hosted project. | §5 | Dry run in the paste kit; stop the kit otherwise. |
| R11 | iPhone uploads PNG, not WebP. | §5 | Accept PNG/JPEG; size check after conversion. |
| R12 | The board's futures roots (`MES`) vs the Top One file's contract codes (`MNQM6`) break any symbol-equality match. | §3.3 L5 | Match on the root; store it. |

---

## 10. Open questions for the owner

**Q1. When the day's broker file comes in after you registered the trades live, what happens to those trades?**
- (a) The file finds each registered trade (same account, asset, side, contracts or stake, entry a few minutes before
  your registration) and only completes it: commission and the broker's ID. Your times, result, marks and plan stay. The
  preview says «{n} já registradas no app: completamos a comissão.» (NEW).
- (b) Like (a), but the file's result (P&L) also replaces the one you typed.
- (c) No matching: the file is imported as usual and you avoid importing days you registered.
*Recommend (a)*: it is what «até uma importação completar a comissão» and «as que chegam só pelo arquivo» assume, it
keeps the evidence (times, marks) untouched, and the difference between the typed and the file P&L can be shown later.
If the match is ambiguous (two equal trades in the same minutes), the row is imported as new and the preview says so.

**Q2. Undoing an import that completed registered trades: what does it do to them?**
- (a) Nothing: they stay as registered, and only the trades the file added are deleted.
- (b) It also removes the commission and ID the file filled in.
*Recommend (a)* for Phase 3 (simpler, and undo exists to remove a wrong file's new trades); revisit if a wrong
commission ever needs undoing.

**Q3. Until the Diário arrives (Phase 4), where do you find an open trade to register its exit?**
- (a) A short NEW block under «Posso operar hoje?» on `/diario`: «Abertas agora» with one line per open trade and a
  «Registrar saída» button (only open trades, nothing else of the day).
- (b) The «Registrar operação» button reopens the sheet on the open trade of the current account when there is one.
- (c) Both.
*Recommend (c)*: the button covers the phone flow you will test, and the list covers two open trades or another
account; the full «Operações do dia» stays Phase 4.

**Q4. Registering in an account that has no rules saved yet (no «desde»):**
- (a) Allowed; the sheet shows «Sem janela salva · Definir», and the trade is marked «Sem regras na entrada» (NEW),
  never «Histórico importado».
- (b) Refused with «Salve as regras desta conta antes de registrar.» and a link to Personalizar (NEW).
*Recommend (a)*: your accounts all have rules, and refusing would block a quick first trade in a new account; but the
label must stop calling a live trade "imported history".

**Q5. Deleting trades on the old Operações page (`/trades`): what about trades registered live?**
- (a) The old page cannot delete them (the delete is refused and the page shows its error); deleting a registered trade
  comes with the Diário, with its images and marks.
- (b) It deletes them as today, with marks and context; images stay in Storage until a cleanup.
*Recommend (a)*: registered trades are evidence with server times, and the old page cannot remove their images.

**Q6. The old dashboard's «Adicionar novas operações» opens Operações, which has no form. Point it to Registrar?**
- (a) Yes: it opens the Diário with the Registrar sheet (`/diario?registrar=1`), like the import buttons did in Phase 1.
- (b) Leave it until Phase 9.
*Recommend (a)*: one line, same pattern as `IMPORT_HREF`, and the old page then leads somewhere that works.

**Q7. Stop and target («em pontos» on the board): stored how?**
- (a) As prices (entry minus/plus the points, by side), with the time you noted them; the Diário shows them back in
  points.
- (b) As points.
*Recommend (a)*: the Top One file brings SL/TP as prices, so live and imported trades compare directly, and the
risk:reward of Análises comes out the same either way.
