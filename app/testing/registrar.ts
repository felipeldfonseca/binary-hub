/**
 * Test helpers for «Registrar operação». Lives outside __tests__ so Jest does not run it as a suite.
 *
 * The JSON in fixtures/registrar is what the real functions of migration 20261020000003 (fase-3/banco)
 * answered on a throwaway local Postgres, for an invented user whose accounts (futures Top One,
 * Ebinex, …) have a rule version with a window around the time of the recording (Sun 18 Oct 2026
 * about 23:39 UTC, so the futures trading day is Mon 19 Oct) and, on futures, a US$ 400 limit.
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
  | 'trash-done';

/** The recorded JSON, as the database answered it (a fresh copy each call) */
export function registrarJson(name: RegistrarFixture): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}
