/**
 * Test helpers for the Diário's data layer (Phase 4). Lives outside __tests__ so Jest does not run
 * it as a suite.
 *
 * The JSON in fixtures/diario is what the real functions of migrations 20261105000001..2
 * (fase-4/banco) answered on a throwaway local Postgres whose clock the recorder moved between
 * steps (__tests__/lib/hubDiario.pg.test.ts, with BH_PG_RECORD; an interposed clock read the shift
 * from a file). Invented user and data, random ids (ids.json); the reads at Mon 26 Oct 2026 09:00
 * ET (13:00 UTC), when Top One's and Ebinex's trading day is the 26th:
 *
 *   calendario-top       Top One #1 (Futuros): history on 12 and 13 Oct, rules from Wed 14 Oct 09:12 ET
 *                        (window 10:00–11:00 Mon–Fri, US$ 400 that ends the day, breakeven MES +8);
 *                        14 Oct misto, 15 Oct «Já fechada», 21 Oct the limit day, 22 Oct reviewed (two
 *                        versions), 23 Oct an entry still open
 *   calendario-ebx       Ebinex (binárias, Brasília): history on Fri 9 Oct, Saturday 24 and Sunday 25 Oct
 *   mes-top-2026-10      diario_mes of October (the ISO weeks 28 Sep – 1 Nov): ● 14 and 21 Oct, ■ 21 Oct
 *   mes-ebx-2026-10      the 13:30 of Sunday 25 Oct outside the 09:00–12:00 window
 *   dia-top-1014         the misto day: 08:50 history, three recalculated, the 11:20 outside the window
 *   dia-top-1015         «Já fechada»: the frozen plan, a day due a review, the commission still to come
 *   dia-top-1021         the limit at 10:38 with US$ 426,66 of loss, the 10:52 entry after it (−US$ 38,74)
 *   dia-top-1022         a live MES with a partial, the stop to breakeven and the exit; the review edited
 *   dia-top-1023         «Antes de operar» in two versions, «Do pregão anterior» from the 22nd, an open entry
 *   dia-top-1026         today before trading: the plan now, Friday's open entry elsewhere
 *   dia-ebx-1024         Saturday on its own day clock, inside the every-day window
 *   revisao-1022-previa  save_day_review dry run on 22 Oct 11:40 ET (no review yet)
 *   revisao-1022         the review saved (worked, followed «sim», carry-over)
 *   revisao-1022-repetida  the same client_key again: «repeated», nothing written
 *   revisao-1022-editada   18:05 ET: a second version («em parte», «O que você faria diferente?»)
 *   nota-1023            «Antes de operar» at 09:40 ET on 23 Oct
 *   nota-1023-editada    edited at 10:42 ET, after the 10:04 entry
 *
 * Then (the review of 5 Nov), each read at its own moment:
 *   dia-top-1027-aberta  Tue 27 Oct 11:40 ET: a live MES of 2 still open with a partial at +10 and the stop
 *                        at the breakeven, «Já fechada» in and outside the window, an old-page trade (no
 *                        app context), a live entry undone and a «Já fechada» deleted on the old page
 *   dia-top-1027         17:00 ET, after the broker's file: a link that closed the live MES, one that
 *                        corrected a «Já fechada»'s exit price, one that only completed the commission
 *   dia-top-1028         Wed 28 Oct 10:40 ET: a live MES at 10:30, then a «Já fechada» of 10:05 reaching the
 *                        limit at 10:20 (the facts put the 10:30 after it; its own plan stays «no plano»)
 *   dia-ebx-1028         an Ebinex binary still open
 *   calendario-b3, dia-b3-1028   Clear (B3, R$): rules from 28 Oct, a «Já fechada» WIN with «Custos»
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, 'fixtures/diario');

export const DIARIO_FIXTURES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort();

/** One recorded answer, as JSON */
export function diarioJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

export interface DiarioIds {
  user: string;
  accounts: { top: string; ebx: string };
  trades: Record<'jaFechada' | 'live' | 'aberta', string>;
}

export const idsDiario = (): DiarioIds => diarioJson('ids') as DiarioIds;
