**Fase 3c · banco is implemented and committed, and every check passes.** The database suite (all 8 SQL suites) is green on PG 15 and on a throwaway PG 17.5 cluster. The paste-kit harness ends with 0 failures on both versions. On the live-shaped state the kit proves 9,690 limit answers unchanged.

**Worktree / branch / commits**
- Worktree: `/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_b0d1d9d9-e62-1`
- Branch: `fase-3c/banco`, from `origin/feature/rebuild-lean` at 4c02dac. Not pushed.
- One commit: `62686a1 Phase 3c · banco: partial exits, stop moves and the breakeven rule`.

**Files**
- `supabase/migrations/20261023000001_regra_breakeven.sql` (633 lines)
- `supabase/migrations/20261023000002_trade_exits.sql` (616 lines)
- `supabase/migrations/20261023000003_parciais_api.sql` (2,220 lines)
- New tests: `supabase/tests/80_regra_breakeven.test.sql`, `supabase/tests/81_parciais.test.sql`
- Edited tests: `supabase/tests/50_phase3.test.sql` (the two catalog lists), `supabase/tests/40_markets.test.sql`
- TypeScript: `app/lib/domain/markets.ts`, `app/__tests__/domain/markets.test.ts`

Each migration ends with its own proof block. Migration 1 proves `rules_current`, the gate answers and every stored rule row are unchanged. Migration 2 proves every `limit_usage` answer, gate answer and mark's «limpa» is unchanged, and that the new tables are empty. Migration 3 proves every trade's `trade_state` (old keys) is unchanged, plus privileges and empty `search_path`.

## API

**Tables** (row-level security: select own; the API can only SELECT; anon nothing)
- `trade_exits`:
  - Columns: id, user_id, trade_id, account_id, origin `app|file`, kind `parcial|final` (null for file rows), quantity, exit_price, exit_time, registered_at, pnl, pnl_basis `prices|estimate|typed|file`, commission, voided_at, client_key.
  - File rows also carry batch_id, line, source_platform, external_id, file_exit_at, source_local_exit.
  - Only trades with more than one exit get rows. The exits that count are the file rows when any exist, else the app rows not undone.
- `trade_stop_moves`: id, user_id, trade_id, origin `live|reconstructed`, kind `breakeven|ajuste`, stop_price, prev_stop, price_now, favor (computed by the server), unit `pts|pips|price`, moved_at, voided_at, client_key.
- Views: `trade_exits_v` (adds `counts`) and `trade_stop_moves_v` (adds `ao_vivo`).
- `trades` gets no new column. A closed trade with exits holds their sums (quantity, last exit_time, weighted average exit_price to 8 decimals, pnl, commission, result). Deferred commit-time triggers enforce this and raise `exits_mismatch`.
- `limit_usage` counts each exit at its own instant, including an open trade's partials. `trade_marks_v` treats marks as «limpa» only before the first exit that is not undone.

**New RPCs** (authenticated only)

| RPC | Payload | Answer |
|---|---|---|
| `register_partial(p_trade uuid, p_exit jsonb, p_dry_run bool = false)` | `{v, client_key, quantity, exit_price, exit?, clock?, pnl?}` | `trade_state` + `{dry_run, repeated, exit_id, exit_at, pnl, points, gate_now}` |
| `move_stop(p_trade uuid, p_move jsonb)` | `{v, client_key, kind: "breakeven", price_now}` or `{v, client_key, kind: "ajuste", stop_price, price_now?}` | `trade_state` + `{repeated, move_id}` |
| `undo_event(p_trade uuid, p_event jsonb)` | `{v, kind: "parcial"\|"stop", id}` | `trade_state` + `{repeated, undone: {kind, id}}` |

- `register_partial`'s dry run answers `{dry_run, repeated, server_now, trade_id, exit_at, quantity, open_after, exit_price, pnl, pnl_basis, commission, points}`.
- `move_stop`: «Breakeven» requires `price_now`. An «ajuste» exactly at the entry is stored as a breakeven.
- `undo_event` undoes only the newest event, within 15 minutes, while the trade is open. Undoing an event already undone answers `repeated: true`.

**Replaced** (same signatures; every old key and answer kept)
- `register_exit`: after partials it closes the rest and adds `quantity` and `total_pnl`.
- `register_after`: accepts `exits` (2–20 rows) and `breakeven: {price_then}`.
- `trade_state` adds:
  - `exits` and `stop_moves`;
  - `position {quantity, closed, open, realized_pnl, exits, partials, stop_initial, stop_now, stop_kind, r, undo}`, where `undo` is `{kind, id, until}` or null;
  - `breakeven {key, n, un, level}` or null.
- `import_preview`, `import_commit`, `import_undo`, `import_fix_tz`: rows of one Top One position become one trade with one exit per row. They link it to an app trade (the app's hours, the file's money) or attach later rows to it. Only files with partial exits get the new keys: `trades_new`, `grouped`, `attached` in the preview and `trades`, `grouped`, `attached` in the commit.
- The `import_undo` ordering bug is fixed: a batch now gives back only to later batches.

**Rules**
- MarketRules and AccountRules accept `breakeven: {on, by: {KEY: N}}`.
- A version gets `breakeven: {by: {KEY: {n, un}}}` only when the rule acts, so no existing account resolves differently.
- `market_caps_all` gains `rules.breakeven`, false only for binaries.

**Error codes**
- New: `partial_too_large`, `exit_before_partial`, `too_many_exits`, `too_many_moves`, `same_stop`, `nothing_to_undo`, `not_newest`, `bad_breakeven`, and `exits_mismatch` (a bug code, errcode 23514).
- Reused with new fields in the hint: `bad_price` (`price_now`, `breakeven`, `exits`), `off_tick` (`stop_price`, `price_now`, `breakeven`, `exits`), `bad_stop` (`stop_price`, `price_now`, `breakeven`), and `bad_quantity`, `bad_time`, `exit_in_future` (`exits`).

## Test results
- `supabase/tests/run.sh`: 20, 30, 40, 50, 60, 70, 80 and 81 all pass, on PG 15 and PG 17.5. The PG 17.5 run used the binaries in `/Library/PostgreSQL/17`, on a cluster of its own; the server already running there was not touched.
- `npx jest --ci`: 94 suites (3,515 tests) pass; 6 database-backed suites are skipped. I ran those 6 separately against a local cluster with the 3c migrations, using the clock shim: all pass (96 tests; 2 recorders skipped by design). The script is `scratchpad/fase3c/pg_jest.sh`.
- `tsc --noEmit`: 0 errors. `next lint`: only the warning already in `Toast.tsx`.

## Paste kit
Location: `scratchpad/fase3c/aplicar/`
- `montar.py`: builds both SQL files from the migrations, copied verbatim. It refuses a wrong tree before writing anything; tested.
- `fase3c_aplicar.sql`: one transaction that writes the `backup_fase3c` schema, runs the three migrations, then the conferência.
- `desfazer_fase3c.sql`: refuses if any exit, stop move or breakeven rule exists.
- `testar.sh`, `semear_vivo.sql` / `semear_3c.sql` (live-shaped state, including 2 trades registered in the app: one linked to a file, one open), `vivo_depois_3c.sql`, `cronometrar.sh`, `mensagem_para_o_dono.txt`, and the `saida_*.txt` logs.

What the harness checked:
- **Conferência on the live-shaped state:** every "changed" count is 0. That covers rows, limit answers, «Posso operar hoje?», resolved rules, invalid rule rows, marks, trade states and the descriptor beyond the breakeven key. Saídas, ajustes de stop and regras de breakeven are 0, the new functions are callable by authenticated users and not by anon, and the four new triggers are present.
- **Second paste:** fails on its first line and changes nothing.
- **Undo:** gives back every row, function definition, privilege, trigger, policy and the marks view exactly.
- **Undo refusal:** after re-pasting and registering a partial, the undo refuses and changes nothing.
- **Atomicity:** a conflicting object makes the paste fail with nothing applied, not even the backup schema.
- **Suite state:** on the state the 4c02dac suites leave, the paste proves 5,730 limit answers unchanged, and 80 and 81 then pass on it.
- **Timing:** the paste takes about 5 s on the live-shaped state; the undo under 1 s.

## Deviations from the specs
1. **Test 40 edited too.** It pinned `market_caps_all()`; it now compares with `rules.breakeven` stripped. I also added the `MARKET_SPEC` twin field and made the parity test read the newest migration (regra §2.3.1). The other TS twins are not done: rules checker, `regras`, `dayUsage` with exits, `registrarDb` wrappers, decoders and error-code copy.
2. **Hints and caps.**
   - For a breakeven on the wrong side of the price, `bad_stop` names `price_now`, since there is no stop field.
   - Caps are 19 partials plus the final exit, and 20 stop moves not undone. A runaway client also stops at 50 rows, undone ones included.
   - `costs` on a partial returns `unknown_key`.
   - `undo_event` takes the id as a JSON number or a string of digits. Ties for the newest event break by time, then kind, then id.
3. **Marks cut.** «Limpa» is cut by any exit row not undone, app or file. The spec said "the first partial"; the result is the same for app rows.
4. **Imports, beyond the prototype.**
   - Positions group by the exact symbol. Rows with no entry price, or with an exit before the entry, stay on their own.
   - The preview's `linked` counts positions (identical for one-row files).
   - A duplicate row whose position gains attached rows takes the exits path. This avoids two link rows for the same trade and batch.
   - Matching skips app trades that already have file exits.
   - `trade_exits_apply` also keeps an imported trade's wall clock (`source_local_exit`) in step.
5. **`import_undo` design extended.** While another batch's file exits remain on a trade, the sums come from those exits and the reopening passes to the next later batch. Once the last ones go, the sums return to what the batch found. This fixes an order the prototype missed: undoing an older batch first, after it closed an open app trade and a newer batch attached rows. Tests 8.11 and 8.12 cover both orders.
6. **«Já fechada» errors.** Errors from one row of `exits` are reported with the field `exits`.
7. **Counts in the owner's message.** The message expects 631 trades, 2 in the app, 6 accounts, 9 versions (from the task). The harness state had 633 trades and 5 versions, because of the legacy seed.