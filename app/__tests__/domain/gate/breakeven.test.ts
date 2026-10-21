/**
 * @jest-environment node
 *
 * «Mover para o breakeven com +N» in the versioned rules (Phase 3c, 20261023000001_regra_breakeven.sql):
 * the optional tenth key of a version, the settings' check and the absent-when-off rule. The SQL's
 * codes for every shape are recorded in ../cases3c.json (cases3c.test.ts: rules_is_dist,
 * rules_check_breakeven, rules_check_resolved, rules_resolve); here, the domain form.
 */
import {
  BREAKEVEN_UNITS,
  MAX_BREAKEVEN_ASSETS,
  checkBreakevenSetting,
  checkRules,
  isBreakevenKey,
  isBreakevenN,
  parseRules,
  toResolvedJson,
} from '@/lib/domain/gate';

const TOP_ONE = {
  v: 1,
  market: 'futures',
  windows: [{ tz: 'America/New_York', start_min: 600, end_min: 660, weekdays: 31 }],
  windows_from: 'market',
  window_rule: { on: true, outside: 'fora' },
  block: { on: true, before_min: 5, after_min: 10, calendars: ['us'] },
  limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' },
  states: { alinhadas: null, so_tecnica: null, so_fundamentos: null, em_conflito: null, sem_direcao: null },
  day: { tz: 'America/New_York', start_min: 1080 },
};
const FTMO = {
  v: 1,
  market: 'forex',
  windows: [],
  windows_from: null,
  window_rule: { on: true, outside: 'fora' },
  block: null,
  limit: null,
  states: null,
  day: { tz: 'America/New_York', start_min: 1020 },
};
const EBINEX = { ...FTMO, market: 'binary', day: { tz: 'America/Sao_Paulo', start_min: 0 } };

describe('a version with the rule (the tenth key)', () => {
  it('reads it per asset, «+N» as decimal text, and writes the same jsonb back', () => {
    const json = { ...TOP_ONE, breakeven: { by: { MES: { n: 8, un: 'pts' }, MNQ: { n: 30, un: 'pts' }, MGC: { n: 7.5, un: 'pts' } } } };
    expect(checkRules(json)).toBeNull();
    const r = parseRules(json);
    expect(r.breakeven).toEqual({ by: { MES: { n: '8', un: 'pts' }, MNQ: { n: '30', un: 'pts' }, MGC: { n: '7.5', un: 'pts' } } });
    expect(toResolvedJson(r)).toEqual(json);
  });

  it('a version without it has no key at all: nine keys, as before Phase 3c', () => {
    const r = parseRules(TOP_ONE);
    expect('breakeven' in r).toBe(false);
    expect(Object.keys(toResolvedJson(r))).toHaveLength(9);
    expect(toResolvedJson(r)).toEqual(TOP_ONE);
  });

  it('pips and price units on the other markets; never on binaries', () => {
    expect(checkRules({ ...FTMO, breakeven: { by: { EURUSD: { n: 7.5, un: 'pips' }, XAUUSD: { n: 1.2, un: 'price' } } } })).toBeNull();
    expect(checkRules({ ...EBINEX, breakeven: { by: { EURUSD: { n: 5, un: 'pips' } } } })).toBe('not_for_market');
  });

  it('refuses what rules_check_resolved refuses', () => {
    const bad = (b: unknown) => checkRules({ ...TOP_ONE, breakeven: b });
    expect(bad(null)).toBe('bad_breakeven');
    expect(bad({ by: {} })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 8, un: 'pts' } }, on: true })).toBe('bad_breakeven');
    expect(bad({ by: { MESZ5: { n: 8, un: 'pts' } } })).toBe('bad_breakeven');
    expect(bad({ by: { mes: { n: 8, un: 'pts' } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 0, un: 'pts' } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: '8', un: 'pts' } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 8 } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 8, un: 'ticks' } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 0.123456789, un: 'pts' } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 1000000.5, un: 'pts' } } })).toBe('bad_breakeven');
    expect(bad({ by: { MES: { n: 8, un: 'pts', x: 1 } } })).toBe('bad_breakeven');
    // An eleventh key, or the tenth under another name, is not a version
    expect(checkRules({ ...TOP_ONE, be: { by: { MES: { n: 8, un: 'pts' } } } })).toBe('bad_rules');
    // The unit is not checked against today's instruments: an old version stays valid
    expect(bad({ by: { MES: { n: 8, un: 'pips' } } })).toBeNull();
  });

  it('holds at most twenty assets', () => {
    const by = (k: number) =>
      Object.fromEntries(Array.from({ length: k }, (_, i) => [`A${String.fromCharCode(65 + i)}`, { n: 1, un: 'price' }]));
    expect(checkRules({ ...FTMO, breakeven: { by: by(MAX_BREAKEVEN_ASSETS) } })).toBeNull();
    expect(checkRules({ ...FTMO, breakeven: { by: by(MAX_BREAKEVEN_ASSETS + 1) } })).toBe('bad_breakeven');
  });
});

describe('the stored setting {on, by} (rules_check_breakeven)', () => {
  it('takes on/off with assets and numbers', () => {
    expect(checkBreakevenSetting('futures', { on: true, by: { MES: 8, MNQ: 30 } })).toBeNull();
    expect(checkBreakevenSetting('futures', { on: false, by: {} })).toBeNull();
    expect(checkBreakevenSetting('b3', { on: true, by: { WIN: 150, PETR4: 0.3 } })).toBeNull();
  });

  it('refuses binaries first, then the shape', () => {
    expect(checkBreakevenSetting('binary', { on: true, by: {} })).toBe('not_for_market');
    expect(checkBreakevenSetting('binary', 'x')).toBe('not_for_market');
    expect(checkBreakevenSetting('futures', 'x')).toBe('bad_breakeven');
    expect(checkBreakevenSetting('futures', { on: true, by: {}, favor: 8 })).toBe('unknown_key');
    expect(checkBreakevenSetting('futures', { on: 'sim', by: {} })).toBe('bad_breakeven');
    expect(checkBreakevenSetting('futures', { on: true })).toBe('bad_breakeven');
    // A contract month is not the asset's key (WINZ26 → WIN, MESZ5 → MES)
    expect(checkBreakevenSetting('b3', { on: true, by: { WINZ26: 1 } })).toBe('bad_breakeven');
    expect(checkBreakevenSetting('futures', { on: true, by: { MESZ5: 1 } })).toBe('bad_breakeven');
    expect(checkBreakevenSetting('futures', { on: true, by: { MES: -1 } })).toBe('bad_breakeven');
  });

  it('keys and numbers', () => {
    expect(isBreakevenKey('forex', 'EURUSD')).toBe(true);
    expect(isBreakevenKey('forex', 'EUR/USD')).toBe(false);
    expect(isBreakevenKey('b3', 'PETR4F')).toBe(false);
    expect(isBreakevenKey('b3', 'PETR4')).toBe(true);
    expect(isBreakevenKey('futures', 'MESZ5')).toBe(false);
    expect(isBreakevenKey('futures', 'A'.repeat(21))).toBe(false);
    expect(isBreakevenN(7.5)).toBe(true);
    expect(isBreakevenN(1e-8)).toBe(true);
    expect(isBreakevenN(1e-9)).toBe(false);
    expect(isBreakevenN(1000000)).toBe(true);
    expect(isBreakevenN(1000000.01)).toBe(false);
    expect(isBreakevenN(0)).toBe(false);
    expect(isBreakevenN(Number.NaN)).toBe(false);
    expect(BREAKEVEN_UNITS).toEqual(['pts', 'pips', 'price']);
  });
});
