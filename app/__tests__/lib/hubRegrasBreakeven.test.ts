/**
 * @jest-environment node
 *
 * «Mover para o breakeven com +N» in Personalizar's data (lib/hub/regras, rascunho, regrasDb):
 * the setting read and written, what it resolves to, the account's own against the market's, the
 * draft's edits, the typed «+N» and asset, and the new code. The SQL side is cases3c.json
 * (rules_resolve, rules_check_breakeven) and hubRegrasBreakeven.pg.test.ts (save_rules).
 */
import { MARKET_SPEC, type AccountMarket } from '@/lib/domain/gate';
import {
  BREAKEVEN_OFF,
  accountRulesJson,
  accountSettingsFromJson,
  breakevenKeyOf,
  effectiveBreakeven,
  emptyAccountSettings,
  marketRulesJson,
  marketSettingsFromJson,
  readBreakevenN,
  resolveBreakeven,
  resolveRules,
  sameAccount,
  sameBreakeven,
  sameMarket,
  withAccountRule,
  type MarketSettings,
  type RulesSettings,
} from '@/lib/hub/regras';
import { breakevenEfetivo, breakevenMudou, comBreakeven, comBreakevenAtivo, comBreakevenLigado, temProprio } from '@/lib/hub/rascunho';
import { REGRAS_ERROR_CODES, RULES_RPC_ERROR_CODES, toRegrasError } from '@/lib/hub/regrasDb';
import { ERRO_REGRAS } from '@/components/hub/personalizar/copy';
import type { AccountConfig } from '@/lib/hub/regras';

const BUILTIN_FUT = { v: 1, window_rule: { on: true, outside: 'fora' }, block: { on: true, before_min: 5, after_min: 10 } };
const BUILTIN = { v: 1, window_rule: { on: true, outside: 'fora' } };

function settings(over: Partial<Record<AccountMarket, MarketSettings>> = {}): RulesSettings {
  const markets = Object.fromEntries(
    (Object.keys(MARKET_SPEC) as AccountMarket[]).map((m) => [m, marketSettingsFromJson(m, null, [], m === 'futures' ? BUILTIN_FUT : BUILTIN)]),
  ) as Record<AccountMarket, MarketSettings>;
  return { markets: { ...markets, ...over }, accounts: {}, displayTz: 'et', calendars: ['us'] };
}
const TOP = { id: 'top', market: 'futures' as const, day: { tz: 'America/New_York', startMin: 1080 } };
const FTMO = { id: 'ftmo', market: 'forex' as const, day: { tz: 'America/New_York', startMin: 1020 } };
const EBX = { id: 'ebx', market: 'binary' as const, day: { tz: 'America/Sao_Paulo', startMin: 0 } };
const conta = (a: typeof TOP | typeof FTMO): { tipo: 'conta'; conta: AccountConfig } => ({ tipo: 'conta', conta: a as unknown as AccountConfig });

describe('the stored setting ↔ the editor\'s form', () => {
  it('reads «+N» as decimal text and writes it back as JSON numbers; absent stays absent', () => {
    const m = marketSettingsFromJson('futures', { ...BUILTIN_FUT, breakeven: { on: true, by: { MES: 8, MGC: 7.5 } } }, [], BUILTIN_FUT);
    expect(m.breakeven).toEqual({ on: true, by: { MES: '8', MGC: '7.5' } });
    expect(marketRulesJson('futures', m).breakeven).toEqual({ on: true, by: { MES: 8, MGC: 7.5 } });
    const none = marketSettingsFromJson('futures', BUILTIN_FUT, [], BUILTIN_FUT);
    expect('breakeven' in none).toBe(false);
    expect('breakeven' in marketRulesJson('futures', none)).toBe(false);
    const a = accountSettingsFromJson('forex', { v: 1, breakeven: { on: false, by: { EURUSD: 7.5 } } }, null);
    expect(a.breakeven).toEqual({ on: false, by: { EURUSD: '7.5' } });
    expect(accountRulesJson('forex', a)).toEqual({ v: 1, limit: null, breakeven: { on: false, by: { EURUSD: 7.5 } } });
    expect('breakeven' in accountRulesJson('forex', emptyAccountSettings())).toBe(false);
  });

  it('a binary never stores it; a malformed one is not the as-built shape', () => {
    expect('breakeven' in marketRulesJson('binary', { ...settings().markets.binary, breakeven: { on: true, by: { EURUSD: '5' } } })).toBe(false);
    expect('breakeven' in marketSettingsFromJson('binary', { ...BUILTIN, breakeven: { on: true, by: {} } }, [], BUILTIN)).toBe(false);
    expect(() => accountSettingsFromJson('futures', { v: 1, breakeven: { on: true, by: { MES: '8' } } }, null)).toThrow('bad_answer');
    expect(() => accountSettingsFromJson('futures', { v: 1, breakeven: { by: {} } }, null)).toThrow('bad_answer');
  });

  it('compares by value («10,0» is 10), and the setting takes part in sameMarket / sameAccount', () => {
    expect(sameBreakeven({ on: true, by: { MES: '10.0' } }, { on: true, by: { MES: '10' } })).toBe(true);
    expect(sameBreakeven({ on: true, by: { MES: '10' } }, { on: false, by: { MES: '10' } })).toBe(false);
    const s = settings();
    expect(sameMarket('futures', s.markets.futures, { ...s.markets.futures, breakeven: { on: true, by: { MES: '8' } } })).toBe(false);
    expect(sameAccount('forex', undefined, { ...emptyAccountSettings(), breakeven: { on: true, by: {} } })).toBe(false);
  });
});

describe('what a setting resolves to (rules_resolve)', () => {
  it('only when on with an asset whose unit is known; the account\'s own replaces the market\'s whole', () => {
    expect(resolveBreakeven('futures', { on: true, by: { MES: '10.50', ZN: '0.5' } })).toEqual({ by: { MES: { n: '10.5', un: 'pts' }, ZN: { n: '0.5', un: 'price' } } });
    expect(resolveBreakeven('futures', { on: false, by: { MES: '10' } })).toBeNull();
    expect(resolveBreakeven('futures', { on: true, by: {} })).toBeNull();
    expect(resolveBreakeven('binary', { on: true, by: { EURUSD: '5' } })).toBeNull();
    expect(resolveBreakeven('forex', { on: true, by: { EURUSD: '7.5', XAUUSD: '1.2', USDJPY: 'x' } })).toEqual({ by: { EURUSD: { n: '7.5', un: 'pips' }, XAUUSD: { n: '1.2', un: 'price' } } });

    const s = settings({ futures: { ...settings().markets.futures, breakeven: { on: true, by: { MES: '10', MNQ: '40' } } } });
    expect(resolveRules(TOP, s).breakeven).toEqual({ by: { MES: { n: '10', un: 'pts' }, MNQ: { n: '40', un: 'pts' } } });
    const own = { ...s, accounts: { top: { ...emptyAccountSettings(), breakeven: { on: true, by: { MNQ: '30' } } } } };
    expect(effectiveBreakeven(own, TOP)).toEqual({ on: true, by: { MNQ: '30' } });
    expect(resolveRules(TOP, own).breakeven).toEqual({ by: { MNQ: { n: '30', un: 'pts' } } });
    const off = { ...s, accounts: { top: { ...emptyAccountSettings(), breakeven: { on: false, by: { MNQ: '30' } } } } };
    expect('breakeven' in resolveRules(TOP, off)).toBe(false);
    // Never set anywhere: the rules are the nine keys of before
    expect('breakeven' in resolveRules(FTMO, settings())).toBe(false);
    expect('breakeven' in resolveRules(EBX, { ...settings(), accounts: { ebx: { ...emptyAccountSettings(), breakeven: { on: true, by: { EURUSD: '5' } } } } })).toBe(false);
  });
});

describe('«só nesta conta» and the draft\'s edits', () => {
  it('an account\'s own setting equal to the market\'s is not kept (a market never set is off, with no asset)', () => {
    const s = settings({ futures: { ...settings().markets.futures, breakeven: { on: true, by: { MES: '10' } } } });
    expect(withAccountRule(s, TOP, { breakeven: { on: true, by: { MES: '10.0' } } }).accounts.top.breakeven).toBeUndefined();
    expect(withAccountRule(s, TOP, { breakeven: { on: true, by: { MES: '8' } } }).accounts.top.breakeven).toEqual({ on: true, by: { MES: '8' } });
    expect(withAccountRule(settings(), FTMO, { breakeven: { on: false, by: {} } }).accounts.ftmo.breakeven).toBeUndefined();
    const own = withAccountRule(s, TOP, { breakeven: { on: false, by: { MES: '10' } } });
    expect(withAccountRule(own, TOP, { breakeven: null }).accounts.top.breakeven).toBeUndefined();
    // Other keys of the account are untouched
    expect(withAccountRule(own, TOP, { windowRule: { outside: 'aviso' } }).accounts.top.breakeven).toEqual({ on: false, by: { MES: '10' } });
  });

  it('«Padrão Futuros»: the switch keeps the assets; off with no asset is the same as never set', () => {
    const PADRAO = { tipo: 'padrao' } as const;
    let s = comBreakevenLigado(settings(), PADRAO, true);
    expect(s.markets.futures.breakeven).toEqual({ on: true, by: {} });
    s = comBreakevenAtivo(s, PADRAO, 'MES', '8');
    s = comBreakevenAtivo(s, PADRAO, 'MNQ', '30');
    expect(s.markets.futures.breakeven).toEqual({ on: true, by: { MES: '8', MNQ: '30' } });
    s = comBreakevenLigado(s, PADRAO, false);
    expect(s.markets.futures.breakeven).toEqual({ on: false, by: { MES: '8', MNQ: '30' } });
    s = comBreakevenAtivo(comBreakevenAtivo(s, PADRAO, 'MES', null), PADRAO, 'MNQ', null);
    expect('breakeven' in s.markets.futures).toBe(false);
    expect(breakevenEfetivo(s, PADRAO)).toEqual({ setting: BREAKEVEN_OFF, propria: false });
    expect(breakevenMudou(settings(), s, PADRAO)).toBe(false);
  });

  it('an account: an edit makes its own copy; «Voltar ao padrão» drops it; «não salvo» on the row', () => {
    const base = settings({ futures: { ...settings().markets.futures, breakeven: { on: true, by: { MES: '8', MNQ: '30' } } } });
    const e = conta(TOP);
    expect(breakevenEfetivo(base, e)).toEqual({ setting: { on: true, by: { MES: '8', MNQ: '30' } }, propria: false });
    const s = comBreakevenAtivo(base, e, 'MNQ', '40');
    expect(temProprio(s, 'top', 'breakeven')).toBe(true);
    expect(breakevenEfetivo(s, e)).toEqual({ setting: { on: true, by: { MES: '8', MNQ: '40' } }, propria: true });
    expect(breakevenMudou(base, s, e)).toBe(true);
    expect(breakevenMudou(base, s, { tipo: 'padrao' })).toBe(false);
    const back = comBreakeven(s, e, null);
    expect(temProprio(back, 'top', 'breakeven')).toBe(false);
    expect(breakevenMudou(base, back, e)).toBe(false);
  });
});

describe('what the row takes', () => {
  it('«+N» typed the pt-BR way: above zero, at most 1 000 000 and 8 decimals, no tick', () => {
    expect(readBreakevenN('10')).toEqual({ ok: true, n: '10' });
    expect(readBreakevenN('7,5')).toEqual({ ok: true, n: '7.5' });
    expect(readBreakevenN('7.50')).toEqual({ ok: true, n: '7.5' });
    expect(readBreakevenN('0,00000001')).toEqual({ ok: true, n: '0.00000001' });
    expect(readBreakevenN('')).toEqual({ ok: false, reason: 'empty' });
    expect(readBreakevenN('dez')).toEqual({ ok: false, reason: 'invalid' });
    expect(readBreakevenN('0')).toEqual({ ok: false, reason: 'not_positive' });
    expect(readBreakevenN('0,000000001')).toEqual({ ok: false, reason: 'too_many_decimals' });
    expect(readBreakevenN('1.000.001')).toEqual({ ok: false, reason: 'too_large' });
    expect(readBreakevenN('1.000.000')).toEqual({ ok: true, n: '1000000' });
  });

  it('the asset as the rule keys it, with the form\'s refusals', () => {
    expect(breakevenKeyOf('futures', 'MESZ5', {})).toEqual({ ok: true, key: 'MES' });
    expect(breakevenKeyOf('forex', 'eur/usd', {})).toEqual({ ok: true, key: 'EURUSD' });
    expect(breakevenKeyOf('b3', 'WINZ26', {})).toEqual({ ok: true, key: 'WIN' });
    expect(breakevenKeyOf('b3', 'PETR4F', {})).toEqual({ ok: true, key: 'PETR4' });
    expect(breakevenKeyOf('crypto', 'BTC/USDT', {})).toEqual({ ok: true, key: 'BTCUSDT' });
    expect(breakevenKeyOf('futures', '  ', {})).toEqual({ ok: false, reason: 'empty' });
    expect(breakevenKeyOf('futures', 'M#S', {})).toEqual({ ok: false, reason: 'invalid' });
    expect(breakevenKeyOf('futures', 'MES', { MES: '8' })).toEqual({ ok: false, reason: 'repeated' });
    const twenty = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`K${i}`, '1']));
    expect(breakevenKeyOf('futures', 'MNQ', twenty)).toEqual({ ok: false, reason: 'too_many' });
  });

  it('bad_breakeven is a code the save answers, with the generic copy', () => {
    expect(RULES_RPC_ERROR_CODES).toContain('bad_breakeven');
    expect(REGRAS_ERROR_CODES).toContain('bad_breakeven');
    expect(toRegrasError({ message: 'bad_breakeven' }).code).toBe('bad_breakeven');
    expect(ERRO_REGRAS.bad_breakeven).toBe(ERRO_REGRAS.bad_rules);
  });
});
