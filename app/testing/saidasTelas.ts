/**
 * Test helpers for Phase 3c lane C2 (step 1: «Já fechada» in several exits, «Movi o stop para o
 * breakeven», the rule line; telas contract §8.2). Lives outside __tests__ so Jest does not run it as
 * a suite. Everything comes from the domain's recorded fixtures (testing/fixtures/parciais, Fri 23
 * Oct 2026 ET, invented data) through the data layer's own parsers; where a state the boards draw was
 * never recorded (scenario 12's ES in two exits), a recorded answer is edited, its values computed by
 * the domain (pnlFromPrices), and parsed the same way.
 *
 *   contasParciais        the accounts of the recording (Top One #1, Apex A: futures; FTMO: forex)
 *   agoraParciais         rules_now() at 10:31 (dia-top-1031: «Liberado», Top One +US$ 175 on the
 *                         day), answered at another instant, optionally edited
 *   gateAtParciais        gate_at() at an entry instant: the dry run's recorded gate with the rules
 *   previaMgc, fechadaMgc scenario 15: after-dry-mgc and after-mgc
 *   fechadaEs12           scenario 12: ES 2 ct at 10:05, 1 ct a 7.909,75 at 10:12 and at 10:20, the
 *                         day at −US$ 300 before: the limit hit at 10:12 (−US$ 550 de US$ 400)
 */
import type { TradingAccount } from '@/lib/hub/contas';
import { pnlFromPrices, tradeInstrument } from '@/lib/domain/registro';
import type { AccountNow, RulesNow } from '@/lib/hub/regras';
import { parseRulesNow } from '@/lib/hub/regras';
import { parseAfterDryRun, parseAfterRegistered, type AfterDryRun, type AfterRegistered } from '@/lib/hub/registrarDb';
import { makeAccount } from './hubHarness';
import { idsParciais, parciaisJson } from './parciais';

type Json = Record<string, any>;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** trading_accounts rows as fetchAccounts reads them, with the recording's ids */
export function contasParciais(): TradingAccount[] {
  const ids = idsParciais();
  return [
    makeAccount({ id: ids.accounts.topOne, label: 'Top One #1', market: 'futures', platform: 'topone', phase: 'financiada', is_primary: true, sort_order: 0 }),
    makeAccount({ id: ids.accounts.apex, label: 'Apex A', market: 'futures', platform: null, phase: 'avaliacao', sort_order: 1 }),
    makeAccount({ id: ids.accounts.ftmo, label: 'FTMO', market: 'forex', platform: 'mt5', phase: 'avaliacao', sort_order: 2 }),
  ];
}

/** dia-top-1031's rules_now() JSON (10:31: Top One «Liberado», MES +US$ 175 on the day) */
export const agoraJson = (): Json => clone((parciaisJson('dia-top-1031') as Json).agora);

/**
 * rules_now() as answered at `serverNow` (each account's `at` too), after `edit`: the sheet's clock
 * (useServerNow) follows server_now
 */
export function agoraParciais(serverNow: string, edit: (json: Json) => void = () => undefined): RulesNow {
  const json = agoraJson();
  json.server_now = serverNow;
  for (const a of json.accounts) a.at = serverNow;
  edit(json);
  return parseRulesNow(json);
}

/** gate_at() of an account at an entry instant: a recorded dry run's gate with the account's rules (fetchGateAt's shape) */
export function gateAtParciais(accountId: string, at: string, gate: Json = (parciaisJson('after-dry-mgc') as Json).gate): AccountNow {
  const rules = agoraJson().accounts.find((a: Json) => a.account_id === accountId).rules;
  return parseRulesNow({ server_now: at, accounts: [{ ...clone(gate), account_id: accountId, at, rules }] }).accounts[0];
}

/** Scenario 15's dry run (10:45: MGC Venda 2 ct, 10:31 and 10:38, breakeven at 4.409,30) */
export const previaMgc = (): AfterDryRun => parseAfterDryRun(parciaisJson('after-dry-mgc'));
/** Scenario 15 registered */
export const fechadaMgc = (): AfterRegistered => parseAfterRegistered(parciaisJson('after-mgc'));

/** The scenario 12 trade: ES Compra 2 ct a 7.912,25, stop 2,5 pts, alvo 5 pts, 10:05 ET */
export const ES12 = { entry: '7912.25', exit: '7909.75', stop: '7909.75', target: '7917.25' } as const;

/**
 * Scenario 12 registered (Top One, Fri 23 Oct; the board's 16 Oct with the recording's day): ES 2 ct
 * at 10:05 in two exits of 1 ct a 7.909,75 (10:12, 10:20), −US$ 125 each. The day had −US$ 300: the
 * first exit reaches the limit at 10:12 (−US$ 425), the second ends it at −US$ 550 de US$ 400.
 */
export function fechadaEs12(): AfterRegistered {
  const json = clone(parciaisJson('after-mgc')) as Json;
  const spec = tradeInstrument('futures', 'ES', null)!;
  const cada = pnlFromPrices(spec, 1, '1', ES12.entry, ES12.exit) as string; // -125
  const total = pnlFromPrices(spec, 1, '2', ES12.entry, ES12.exit) as string; // -250
  const at = (hm: string) => `2026-10-23T14:${hm}:00+00:00`;
  const t = json.trade;
  Object.assign(t, {
    symbol: 'ES',
    quantity: 2,
    direction: 'long',
    entry_price: Number(ES12.entry),
    stop_price: Number(ES12.stop),
    target_price: Number(ES12.target),
    entry_time: at('05'),
    exit_time: at('20'),
    exit_price: Number(ES12.exit),
    pnl: Number(total),
    result: 'loss',
    registered_at: '2026-10-23T14:24:05+00:00',
    exit_registered_at: '2026-10-23T14:24:05+00:00',
  });
  json.exits = [
    { ...json.exits[0], quantity: 1, exit_price: Number(ES12.exit), exit_time: at('12'), pnl: Number(cada), registered_at: t.registered_at },
    { ...json.exits[1], quantity: 1, exit_price: Number(ES12.exit), exit_time: at('20'), pnl: Number(cada), registered_at: t.registered_at },
  ];
  json.stop_moves = [];
  json.breakeven = null;
  json.position = { ...json.position, r: -1, stop_now: Number(ES12.stop), stop_kind: null, realized_pnl: Number(total), stop_initial: Number(ES12.stop) };
  json.r = -1;
  json.points = -2.5;
  json.entry_at = at('05');
  json.registered_at = t.registered_at;
  json.server_now = t.registered_at;
  json.context = { ...json.context, captured_at: t.registered_at, evaluated_at: at('05'), day_pnl_at_entry: -300, day_worst_at_entry: -300 };
  const g = json.gate_now;
  g.at = t.registered_at;
  g.status = 'encerrado';
  g.limit = { ...g.limit, used: 550, near: false, state: 'atingido', hit_at: at('12'), trades: 2, net_usd: -550, worst_usd: -550 };
  g.today = { trades: 2, net_usd: -550, worst_usd: -550 };
  return parseAfterRegistered(json);
}

/** rules_now() at 10:24 of scenario 12: Top One with −US$ 300 on the day (75 % of US$ 400) */
export const agoraEs12 = (): RulesNow =>
  agoraParciais('2026-10-23T14:24:05.000Z', (json) => {
    const top = json.accounts.find((a: Json) => a.label === 'Top One #1');
    top.limit = { ...top.limit, used: 300, near: false, state: 'ok', trades: 1, net_usd: -300, worst_usd: -300 };
    top.today = { trades: 1, net_usd: -300, worst_usd: -300 };
  });
