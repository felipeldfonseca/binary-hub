/**
 * Test helpers for «Registrar operação». Lives outside __tests__ so Jest does not run it as a suite.
 *
 * The JSON in fixtures/registrar is what the real functions of migrations 20261020000001..4
 * (fase-3/banco, with its review fixes) answered on a throwaway local Postgres, for an invented user
 * whose accounts (futures Top One, Ebinex, forex, …) have a rule version with a window around the
 * time of the recording (Mon 19 Oct 2026 about 01:25 UTC, Sun 18 Oct 21:25 in New York, so the
 * futures trading day is Mon 19 Oct and the Ebinex one Sun 18 Oct) and, on futures, a US$ 400 limit.
 * Recorded by __tests__/lib/hubRegistrar.pg.test.ts with BH_PG_RECORD; the ids are random:
 *
 *   entry-dry-mes      register_entry dry run: MES long 2 @ 7896.25, stop 11, target 22 (no hour)
 *   entry-dry-ebinex   register_entry dry run: EUR/USD call, US$ 20 at 88 %, 1 min (the next candle)
 *   entry-mes          register_entry: MES long 2 @ 7896.25, stop 11, target 22, setup A, execução no ponto
 *   exit-dry-mes       register_exit dry run of that trade at 7903.75 (no hour)
 *   exit-mes           register_exit of it: +US$ 75,00, +7,50 pts, 0,6818 R, and gate_now
 *   marks-after-exit   add_marks setup C after the exit: «depois do resultado», changed after
 *   undo               undo_entry of an open MNQ trade
 *   after-dry-mes      register_after dry run: MES short 2 @ 7938.50 → 7929.00, stop 12, setup B
 *   after-mes          register_after of it
 *   entry-ebinex       register_entry: EUR/USD call, US$ 20 at 88 %, 1 min
 *   exit-ebinex        register_exit «ganho» after its expiry: +US$ 17,60
 *   slots              image_slots: two new images (webp, png) on an open MGC trade
 *   extras             save_extras: both images, the second first, and a note
 *   trash-done         image_trash_done after the removed file left Storage
 *   exit-usdjpy        register_exit of a USD/JPY short 1 lot @ 151.240 at 151.440: −US$ 132,07,
 *                      pnl_basis 'estimate' (a pair with the dollar as base)
 *   entry-dry-similar  register_entry dry run: GBP/USD call, US$ 20, three minutes after an imported
 *                      GBP/USD call of US$ 10 (similar: that trade)
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, 'fixtures/registrar');

export type RegistrarFixture =
  | 'entry-dry-mes'
  | 'entry-dry-ebinex'
  | 'entry-mes'
  | 'exit-dry-mes'
  | 'exit-mes'
  | 'marks-after-exit'
  | 'undo'
  | 'after-dry-mes'
  | 'after-mes'
  | 'entry-ebinex'
  | 'exit-ebinex'
  | 'slots'
  | 'extras'
  | 'trash-done'
  | 'exit-usdjpy'
  | 'entry-dry-similar';

/** The recorded JSON, as the database answered it (a fresh copy each call) */
export function registrarJson(name: RegistrarFixture): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}
