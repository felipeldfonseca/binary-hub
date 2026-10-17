/**
 * Test helpers for the rules screens (Personalizar, the «Posso operar hoje?» card, account
 * creation). Lives outside __tests__ so Jest does not run it as a suite.
 *
 * The JSON in fixtures/regras is what the real functions of migration 20261018000003 answered on a
 * throwaway local Postgres, for an invented user with the owner's two accounts (recorded by
 * __tests__/lib/hubRegras.pg.test.ts with BH_PG_RECORD; the ids are random):
 *
 *   config-antes        rules_config() before anything is saved (rev 'none')
 *   save-dono           save_rules() of the owner's Phase 2 rules (Top One 10:00–11:00 ET seg–sex,
 *                       limit US$ 400 «por conta», «Encerrar o dia no app»; Ebinex 20:00–21:00 de
 *                       Brasília seg–sex, no limit), saved on Sat 17 Oct 2026
 *   config-depois       rules_config() right after it (v1 of both accounts)
 *   agora-*             rules_now() shapes (gate_at of both accounts) on the following days, with two
 *                       invented Top One losses on Mon 19 Oct (−US$ 250 out at 10:12 ET, −US$ 180
 *                       out at 10:31 ET):
 *     agora-seg-0930-et   Mon 19 Oct 09:30 ET: Top One «Fora da sua janela · abre às 10:00 ET»
 *     agora-seg-1005-et   Mon 10:05 ET: Top One «Liberado · até 11:00 ET»
 *     agora-seg-1045-et   Mon 10:45 ET: Top One «Encerrado por hoje · limite atingido às 10:31»
 *     agora-seg-2030-brt  Mon 20:30 de Brasília: Ebinex «Liberado · até 21:00 de Brasília»; Top
 *                         One already on Tuesday's trading day («abre amanhã às 10:00 ET»)
 *     agora-sab-1200-et   Sat 24 Oct 12:00 ET: both «Fora da sua janela · hoje não é dia da janela»
 */
import fs from 'fs';
import path from 'path';
import {
  parseRulesConfig,
  parseRulesNow,
  parseSaveResult,
  type RulesConfig,
  type RulesNow,
  type SaveRulesResult,
} from '@/lib/hub/regras';

const DIR = path.join(__dirname, 'fixtures/regras');

export type AgoraFixture = 'agora-seg-0930-et' | 'agora-seg-1005-et' | 'agora-seg-1045-et' | 'agora-seg-2030-brt' | 'agora-sab-1200-et';

/** The recorded JSON, as the database answered it (a fresh copy each call) */
export function regrasJson(name: 'config-antes' | 'config-depois' | 'save-dono' | AgoraFixture): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

/** rules_config() of the owner before the Phase 2 save */
export const configAntes = (): RulesConfig => parseRulesConfig(regrasJson('config-antes'));
/** rules_config() of the owner after the Phase 2 save */
export const configDepois = (): RulesConfig => parseRulesConfig(regrasJson('config-depois'));
/** save_rules() of the owner's Phase 2 rules */
export const saveDono = (): SaveRulesResult => parseSaveResult(regrasJson('save-dono'));
/** rules_now() at one of the owner's test times */
export const agora = (name: AgoraFixture): RulesNow => parseRulesNow(regrasJson(name));

/** The ids of the recorded accounts */
export function idsDono(): { topOne: string; ebinex: string } {
  const c = configAntes();
  return {
    topOne: c.accounts.find((a) => a.market === 'futures')!.id,
    ebinex: c.accounts.find((a) => a.market === 'binary')!.id,
  };
}
