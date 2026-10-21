/**
 * Test helpers for Phase 3c (partial exits, «Mover stop», «Desfazer», the breakeven rule on a trade).
 * Lives outside __tests__ so Jest does not run it as a suite.
 *
 * The JSON in fixtures/parciais is what the real functions of migrations 20261023000001..3 answered
 * (fase-3c/banco after its review fixes),
 * and what the API's table reads returned, on a throwaway local Postgres whose clock the recorder
 * moved between steps (__tests__/lib/hubParciais.pg.test.ts, with BH_PG_RECORD; an interposed clock
 * read the shift from a file). Invented user and data, random ids (ids.json). Fri 23 Oct 2026, ET:
 *
 *   agora-sex-0900          09:00 rules_now(): «Padrão Futuros» breakeven MES +8, MNQ +30, MGC +5 for
 *                           «Top One #1» and «Apex A» (US$ 400 each); «FTMO» its own EUR/USD +7,5 pips
 *   entry-mes               10:12 MES Compra 3 ct a 7.912,50, stop 10 · alvo 20 (rule: em 7.920,50)
 *   partial-dry-mes         10:18 «Parcial» 1 ct a 7.920,50: +8 pts · +US$ 40, ficam 2
 *   partial-mes             the same, registered (undo: the partial)
 *   dia-top-1018            Top One's trades and exits of the day, and rules_now(): the partial counts
 *   stop-mes-breakeven      10:19 «Mover stop» Breakeven with «Preço agora» 7.920,50 (+8 pts)
 *   stop-mes-desfeito       10:20 «Desfazer» the move (the stop back to 7.902,50)
 *   exit-dry-mes / exit-mes 10:31 «Saída» 2 ct a 7.926,00: +US$ 135, no total +US$ 175, R 1,1667
 *   dia-top-1031            the day after the exit
 *   after-dry-mgc / after-mgc  10:45 «Já fechada» MGC Venda 2 ct, 10:24 → 10:31 (4.409,30) and 10:38
 *                           (4.421,30), breakeven told at 4.409,30 (+12 pts): +US$ 120, R 0,4
 *   dia-top-1045            the day with the MGC trade
 *   partial-mnq-limite      Apex 10:53 MNQ partial 2 ct a 30.855 (−US$ 100) after ES −US$ 300: «encerrado»
 *   dia-apex-1053           the day at the limit (the partial counts at 10:53)
 *   partial-mnq-desfeita    10:55 «Desfazer» the partial: the day back to −US$ 300
 *   dia-apex-1055           the day after the undo
 *   partial-eurusd          FTMO 11:17 EUR/USD partial 0,50 lote a 1,08650 (+13 pips · +US$ 65)
 *   stop-eurusd-ajuste      the stop to 1,08560 with the price at 1,08650 (garante 4 pips)
 *   stop-mes-entrada-ajuste    11:31 Top One MES 2 ct a 7.930,00: «Outro preço» at the entry without
 *                           «Preço agora» (an «ajuste», no points)
 *   stop-mes-entrada-breakeven 11:32 the same level with «Preço agora» 7.934,25, after «Desfazer»
 *                           (a breakeven, +4,25 pts)
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, 'fixtures/parciais');

export const PARCIAIS_FIXTURES = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .sort();

/** One recorded answer (or rows), as JSON */
export function parciaisJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

export interface ParciaisIds {
  user: string;
  accounts: { topOne: string; apex: string; ftmo: string };
  trades: Record<'mes' | 'mgc' | 'mnq' | 'eur' | 'mesEntrada', string>;
}

export const idsParciais = (): ParciaisIds => parciaisJson('ids') as ParciaisIds;
