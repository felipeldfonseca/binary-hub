/**
 * @jest-environment node
 *
 * Parsing the stored rules (account_rule_versions.resolved, v1). The full list of shapes the
 * database refuses, with its codes, is in cases.json (group "resolved"); here, the owner's first
 * versions and the conversions.
 */
import {
  centsToUsd,
  parseRuleVersion,
  parseRules,
  RulesError,
  toResolvedJson,
  usdToCents,
  type Rules,
} from '@/lib/domain/gate';

// The versions the owner's first save creates (fase-2/banco, tests.topone_v1 / tests.binary_v1)
const TOP_ONE_V1 = {
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
const EBINEX_V1 = {
  v: 1,
  market: 'binary',
  windows: [{ tz: 'America/Sao_Paulo', start_min: 1200, end_min: 1260, weekdays: 31 }],
  windows_from: 'market',
  window_rule: { on: true, outside: 'fora' },
  block: null,
  limit: null,
  states: null,
  day: { tz: 'America/Sao_Paulo', start_min: 0 },
};

describe('parseRules', () => {
  it('reads the owner\'s Top One v1', () => {
    expect(parseRules(TOP_ONE_V1)).toEqual<Rules>({
      market: 'futures',
      windows: [{ tz: 'America/New_York', startMin: 600, endMin: 660, weekdays: 31 }],
      windowsFrom: 'market',
      windowRule: { on: true, outside: 'fora' },
      block: { on: true, beforeMin: 5, afterMin: 10, calendars: ['us'] },
      limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' },
      states: { alinhadas: null, so_tecnica: null, so_fundamentos: null, em_conflito: null, sem_direcao: null },
      day: { tz: 'America/New_York', startMin: 1080 },
    });
  });

  it('reads the owner\'s Ebinex v1', () => {
    expect(parseRules(EBINEX_V1)).toEqual<Rules>({
      market: 'binary',
      windows: [{ tz: 'America/Sao_Paulo', startMin: 1200, endMin: 1260, weekdays: 31 }],
      windowsFrom: 'market',
      windowRule: { on: true, outside: 'fora' },
      block: null,
      limit: null,
      states: null,
      day: { tz: 'America/Sao_Paulo', startMin: 0 },
    });
  });

  it('goes back to the same jsonb', () => {
    expect(toResolvedJson(parseRules(TOP_ONE_V1))).toEqual(TOP_ONE_V1);
    expect(toResolvedJson(parseRules(EBINEX_V1))).toEqual(EBINEX_V1);
  });

  it('throws a RulesError with the database code, never a value', () => {
    let error: unknown;
    try {
      parseRules({ ...TOP_ONE_V1, limit: { usd: 'quatrocentos', mode: 'conta', at_limit: 'encerrar' } });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(RulesError);
    expect(error).toMatchObject({ code: 'bad_limit', message: 'bad_limit' });
    expect(() => parseRules(null)).toThrow(expect.objectContaining({ code: 'bad_rules' }));
    expect(() => parseRules({ ...TOP_ONE_V1, v: 2 })).toThrow(expect.objectContaining({ code: 'bad_rules_version' }));
  });
});

describe('money: dollars ↔ cents, exactly', () => {
  it.each([
    [400, 40000],
    [400.1, 40010],
    [400.5, 40050],
    [0.07, 7],
    [1.1, 110],
    [-415.5, -41550],
    [999999.99, 99999999],
    [0, 0],
  ])('%p → %p', (usd, cents) => {
    expect(usdToCents(usd)).toBe(cents);
    expect(centsToUsd(cents)).toBe(usd);
  });

  it.each([400.001, '400', '400,00', null, Number.NaN, Infinity, 1e21, 1e-7])('refuses %p', (x) => {
    expect(usdToCents(x)).toBeNull();
  });

  it('round-trips every cent value up to US$ 1.000', () => {
    for (let c = 0; c <= 100_000; c += 1) expect(usdToCents(centsToUsd(c))).toBe(c);
  });
});

describe('parseRuleVersion', () => {
  it('reads a version as rules_config() lists it', () => {
    const v = parseRuleVersion({
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      version_no: 1,
      effective_from: '2026-10-17T15:04:05.123456+00:00',
      effective_day: '2026-10-17',
      origin: 'salvar',
      copied_from: null,
      resolved: TOP_ONE_V1,
    });
    expect(v).toMatchObject({ versionNo: 1, origin: 'salvar', copiedFrom: null, effectiveFrom: new Date('2026-10-17T15:04:05.123Z') });
    expect(v.rules.limit?.cents).toBe(40000);
  });

  it('reads gate_at\'s `version` with its `rules`', () => {
    const v = parseRuleVersion({ id: 'x', version_no: 4, effective_from: '2026-10-17T15:04:05+00:00', origin: 'salvar' }, EBINEX_V1);
    expect([v.versionNo, v.rules.market]).toEqual([4, 'binary']);
  });

  it('refuses an unknown origin and a bad instant', () => {
    expect(() => parseRuleVersion({ version_no: 1, origin: 'importar', resolved: TOP_ONE_V1 })).toThrow(RulesError);
    expect(() => parseRuleVersion({ version_no: 1, effective_from: 'hoje', resolved: TOP_ONE_V1 })).toThrow(RulesError);
  });
});
