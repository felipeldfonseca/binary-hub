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
 *   agora-antes-seg-0930-et  rules_now() shape before the save: both «Sem janela salva · Definir»
 *   agora-*             rules_now() shapes (gate_at of both accounts) on the following days, with two
 *                       invented Top One losses on Mon 19 Oct (−US$ 250 out at 10:12 ET, −US$ 180
 *                       out at 10:31 ET):
 *     agora-seg-0930-et   Mon 19 Oct 09:30 ET: Top One «Fora da sua janela · abre às 10:00 ET»
 *     agora-seg-1005-et   Mon 10:05 ET: Top One «Liberado · até 11:00 ET»
 *     agora-seg-1045-et   Mon 10:45 ET: Top One «Encerrado por hoje · limite atingido às 10:31»
 *     agora-seg-2030-brt  Mon 20:30 de Brasília: Ebinex «Liberado · até 21:00 de Brasília»; Top
 *                         One already on Tuesday's trading day («abre amanhã às 10:00 ET»)
 *     agora-sab-1200-et   Sat 24 Oct 12:00 ET: both «Fora da sua janela · hoje não é dia da janela»
 *
 * Re-recorded for Fase 2b on the markets migration (20261019000001), the server clock again at Sat
 * 17 Oct 2026 ~20:06 UTC: the same answers, with rules_config() carrying a builtin and a defaults key
 * for every market.
 *
 * Fase 2b, the owner's two accounts beside one account in each new market (the Início and
 * Personalizar boards), recorded by the «new markets» block of hubRegras.pg.test.ts:
 *
 *   contas-mercados               trading_accounts rows as fetchAccounts reads them (ACCOUNT_COLUMNS)
 *   config-mercados               rules_config(): Top One #1 (futures, Financiada) v1 10:00–11:00 ET
 *                                 seg–sex, US$ 400; Ebinex (binary) no version; FTMO (forex,
 *                                 Avaliação, firm FTMO, mt5) v1 08:00–10:00 ET seg–sex, US$ 1.000;
 *                                 IBKR (stocks, Pessoal, ibkr) no version; Binance (crypto, Pessoal,
 *                                 binance) v1 20:00–22:00 de Brasília every day, no limit; Clear (b3,
 *                                 Pessoal, profit) v1 10:00–11:00 de Brasília seg–sex, R$ 500. Each
 *                                 window is its market's default (saved by the creation payload)
 *   agora-mercados-seg-0830-et    gate_at of the six at Mon 19 Oct 2026 08:30 ET, no trades: Top One
 *                                 «Fora da sua janela · abre às 10:00 ET»; Ebinex and IBKR «Sem
 *                                 janela salva · Definir»; FTMO «Liberado · até 10:00 ET», US$ 0 de
 *                                 US$ 1.000; Binance «Fora da sua janela · abre às 20:00 de
 *                                 Brasília»; Clear «Fora da sua janela · abre às 10:00 de Brasília»,
 *                                 R$ 0 de R$ 500
 */
import fs from 'fs';
import path from 'path';
import type { TradingAccount } from '@/lib/hub/contas';
import {
  parseRulesConfig,
  parseRulesNow,
  parseSaveResult,
  type RulesConfig,
  type RulesNow,
  type SaveRulesResult,
} from '@/lib/hub/regras';

const DIR = path.join(__dirname, 'fixtures/regras');

export type AgoraFixture =
  | 'agora-antes-seg-0930-et'
  | 'agora-seg-0930-et'
  | 'agora-seg-1005-et'
  | 'agora-seg-1045-et'
  | 'agora-seg-2030-brt'
  | 'agora-sab-1200-et';

/** The Fase 2b recordings with an account in every creatable market */
export type MercadosFixture = 'config-mercados' | 'agora-mercados-seg-0830-et';

/** The recorded JSON, as the database answered it (a fresh copy each call) */
export function regrasJson(name: 'config-antes' | 'config-depois' | 'save-dono' | AgoraFixture | MercadosFixture): Record<string, unknown> {
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

/** trading_accounts rows of the six-market owner, as fetchAccounts reads them (a fresh copy each call) */
export function contasMercados(): TradingAccount[] {
  return JSON.parse(fs.readFileSync(path.join(DIR, 'contas-mercados.json'), 'utf8'));
}
/** rules_config() of the six-market owner */
export const configMercados = (): RulesConfig => parseRulesConfig(regrasJson('config-mercados'));
/** rules_now() of the six-market owner at Mon 19 Oct 2026 08:30 ET */
export const agoraMercados = (): RulesNow => parseRulesNow(regrasJson('agora-mercados-seg-0830-et'));

/** The ids of the six-market owner's accounts */
export function idsMercados(): { topOne: string; ebinex: string; ftmo: string; ibkr: string; binance: string; clear: string } {
  const byLabel = (label: string) => contasMercados().find((a) => a.label === label)!.id;
  return {
    topOne: byLabel('Top One #1'),
    ebinex: byLabel('Ebinex'),
    ftmo: byLabel('FTMO'),
    ibkr: byLabel('IBKR'),
    binance: byLabel('Binance'),
    clear: byLabel('Clear'),
  };
}
