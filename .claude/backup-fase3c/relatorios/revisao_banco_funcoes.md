Phase 3c database review (worktree `/Users/felipefonseca/Dev/binary-hub/.claude/worktrees/wf_b0d1d9d9-e62-1`, commit 62686a1, read-only). I reproduced each finding below on a throwaway PG 15 cluster with invented data.

**Defects**

1. **Registering a stop at the entry without «Preço agora» crashes with a raw database error.** (`supabase/migrations/20261023000003_parciais_api.sql:939` against the check in `20261023000002_trade_exits.sql:177`)
   - `move_stop` with `{"kind":"ajuste","stop_price":<the entry price>}` and no `price_now` stores the move as kind `breakeven` with `price_now` null.
   - The table check `kind = 'ajuste' or price_now is not null` then fails, and the caller gets `new row for relation "trade_stop_moves" violates check constraint "trade_stop_moves_check"` instead of a bare code.
   - The owner's decisions make «Preço agora» optional for «Outro preço», so this request is valid. Fix: either store it as `ajuste` when there is no price, or refuse it with `bad_price`/`price_now`.

2. **A position whose exits were registered as separate app trades gets linked whole to one of them, which counts money twice.** (`import_stage`, same file, lines 1352–1403)
   - Setup: two app trades, MCL long 1 ct each, same entry and price, exits registered for US$ 10 and US$ 20. The Top One file has the matching two rows (US$ 5 and US$ 10).
   - Result: the two rows become one group, linked to the first trade (now 2 ct, US$ 15). The second trade stays unlinked with its app's US$ 20.
   - The day then shows US$ 35 where the broker says US$ 15. At 4c02dac, each row linked to its own app trade.
   - Before 3c, registering each exit as its own trade was the only way to record two exits. Nothing checks for a second candidate app trade before matching the group as a whole.

3. **The import preview miscounts writes on app trades that take the new "exits path".** (`import_preview`, lines 1611 and 1628–1629)
   - `linked_differs` only reads the single-row patch. A grouped link whose money differs shows `linked_differs: 0`, yet the commit records `differs {pnl, exit_price}`, so the «com preço ou resultado diferente» warning is lost.
   - A row attached to an app trade counts as `new: 1` in the preview, but the commit answers `inserted: 0` and puts the line in `rows_linked`.

**Test quality (mutation run)**
- I ran 166 single-edit mutants of the three migrations against all eight suites (20–81): 105 were caught, 61 survived. About 17 of the survivors are equivalent or dead code: a15 a38 a48 a57 a60 a63 a77 a81 a89 a97 a98 r19 s07 s12 s30 b01 b20.
- Survivors that show real gaps in the tests:
  - **R for a short trade with exits** is never tested: removing `abs()` in `trade_r_of` passes (a02).
  - **Import branches with no test:**
    - A row of a position whose earlier rows sit in two different trades (the owner's pair) must not attach, but `n_targets >= 1` passes (b08/b08b).
    - Matching a group by its total size (a53), and skipping app trades that already have file exits (a54).
    - Grouping rows with an exit before the entry (a50) or by open price (a51).
    - A single row linked to an app trade that has partials (a55), and a duplicate row plus an attached row where the file corrects money (a56).
    - Hour placement: a middle row clamped to the registered exit (a61), an open trade with as many partials as file rows (a62), a file exit after now on an open trade via the exits path (a67).
    - The entry price taken from the file on the exits path (b04).
    - Sums restored after undoing an attach on an imported grouped trade, which uses the last exit's wall clock (s18).
    - A grouped position whose rows carry no commission (a71), and `file_exit_at` after `import_fix_tz` (a80).
  - **Partials and stop moves:**
    - A partial on an option contract: dropping the contract multiplier passes (b27).
    - `prev_stop`/`same_stop` after a stop move is undone (a37).
    - `pnl_basis` order when one exit is typed and another estimated (s14).
    - A trade whose only partial was undone and then closed (b10).
    - Boundaries: `price_then` equal to the entry (a45); the 15-minute undo limit is never pinned, since the tests jump 16 minutes (a19/a39).
    - `costs` inside `exits` on a market without costs (a82), and `breakeven` on a binary «Já fechada» (a13).
  - **Defence-in-depth paths no test reaches:**
    - Commit check: the `exit_time`, `quantity` boundary, `result` and `final` hints (s19–s23, s32). Only the `sums` hint is tested.
    - Table guards: forced `registered_at` (s01), binary refusal (s02), and `not_app_trade` (b26).
    - Undo and time-zone fix flags: undoing a row twice (s03), undoing while changing another column (s04), `fix_tz` on an app trade (s05), undoing a reconstructed move (s08).
    - `limit_usage` tie order inside one instant (s27).
  - **Preview and dry-run keys** checked only partly: `new` with attached rows, `day_changes`, `completable`, `duplicate` (a91 a92 a93 b23), and `open_after` after an earlier partial (a95).
- A flake that predates 3c: `supabase/tests/50_phase3.test.sql:1723` fails with `day_changes 3 ≠ 0` whenever it runs between 18:00 New York time and 00:00 UTC. It fails the same way at 4c02dac. I ran my suites with a shifted clock so it would not interfere.

The scratch cluster and `rev_banco2/` are deleted, and nothing in the worktree was changed.

**Verdict:** the 3c database is sound (sums, limit per exit, undo, the `import_undo` fix and the rule all held up), but three defects should be fixed before merge: the raw constraint error, the double-counting regression and the wrong preview counts. The import tests also need cases for the grouping and hour-placement branches.