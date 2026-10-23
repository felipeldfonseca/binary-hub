**Verdict: no real defects found in the Phase 3c database for security or live data. It is safe to hand the paste kit to the owner.**

I reviewed the three migrations, the paste file and the undo file. I also ran the SQL suites and tried attacks on a scratch PG 15 cluster, which I have since stopped and deleted (`rev_banco/` is gone).

**What holds:**
- **Grants, definer functions and search_path:**
  - All 34 new or replaced functions have an empty search_path.
  - The 7 definer functions are the 6 API functions plus `trade_exits_check`.
  - None of the 34 can be run by anon or PUBLIC.
  - The API set adds `register_partial`, `move_stop` and `undo_event`; `limit_usage`, `rules_resolve` and `market_caps_all` keep the same grants as before.
  - Signed-in users cannot run `trade_state`, `trade_exits_apply`, `trade_last_event`, `import_stage` or `import_exits_link` ("permission denied").
- **Row-level security and anon:**
  - The new tables and both views give signed-in users SELECT only; anon gets nothing, including the replaced `trade_marks_v`.
  - Sequences are revoked from both roles; `service_role` cannot insert, update, delete or truncate.
- **Cross-user access:** user W sees 0 of V's 33 exits and 23 stop moves. W's calls to `register_partial`, `move_stop` and `undo_event` on V's trade return `unknown_trade`. `limit_usage` on V's account returns all zeros for W.
- **Append-only:** a signed-in user cannot insert, update or delete exit or stop-move rows, even after setting `binary_hub.exits` to `void:<id>`. As superuser:
  - updating an exit's pnl, deleting a file exit or editing a stop move fails with `append_only`;
  - setting the `fix_tz` flag still blocks a pnl change.
- **Deferred totals check:** a direct change to `trades.pnl`, a change to `trades.quantity`, or an extra app exit row each fails at commit with `exits_mismatch`. Every function that writes trades either keeps the sums in step or is excluded.
- **Server time:** `registered_at`, `moved_at` and `voided_at` are set by the guards. Only the partial's hour can be typed, as decided.
- **Live data:**
  - The replaced functions only add behaviour: a call without exits takes the old statements.
  - The extra `limit_usage` branch only applies when exit rows exist, and the new tables start empty.
  - No stored rule gains the `breakeven` key, so `rules_current` is unchanged and no account gets a new version.
  - The `import_undo` fix (`linked_at` order) changes nothing on live, which has one link per trade.
  - The owner's pair is re-imported as two duplicates (covered by test 81, section 8.8).
  - The paste proves all of this on the live database itself and rolls back otherwise.
- **Paste and undo kits:**
  - The three migrations sit in `fase3c_aplicar.sql` byte for byte as committed.
  - The backup schema holds hashes and function text, with row-level security on and no grants.
  - The undo file restores the 16 functions and the old `trade_marks_v`, and refuses while any exit, stop move or breakeven rule exists.
  - Everything runs as one transaction.
- **Test runs:** on PG 15, suites 20, 30, 40, 60, 70, 80 and 81 passed; 50 failed (first note below).
- **Commit scan:** no keys and no personal data in the commit, apart from the author line.

**Notes (not Phase 3c defects):**
1. **`supabase/tests/50_phase3.test.sql` depends on the time of day.** At line 1723 the preview returns `"day_changes": 3`, but the test expects 0. I reproduced this at 23:36 UTC (19:36 New York), with both the committed test and the 4c02dac copy (`base_tests/50_phase3.test.sql`) run against the pre-3c migrations. So the fault is in the existing test, not in this branch. CI will fail if it runs around that hour; the harness passed at 23:24 UTC.
2. **The header of `vivo_depois_3c.sql` says it imports the Top One file again, but it never does.** That case is covered only by test 81, not on the live-shaped state.