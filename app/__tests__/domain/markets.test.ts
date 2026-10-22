/**
 * @jest-environment node
 *
 * The market descriptor: MARKET_SPEC (TypeScript) and market_caps_all() (the database, migration
 * M5d) hold the same values. The SQL literal is parsed out of the migration file, so a change on
 * one side without the other fails here, in CI, without a database.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ACCOUNT_MARKETS,
  assertTimeZone,
  CREATABLE_MARKETS,
  currencyOf,
  EVERY_DAY,
  isAccountMarket,
  isValidWindow,
  limitKey,
  MARKET_SPEC,
  marketCapsJson,
  MON_TO_FRI,
  WINDOW_TZS,
  type AccountMarket,
} from '@/lib/domain';
import { checkRules, type AccountMarket as GateAccountMarket } from '@/lib/domain/gate';
import { PLATFORM_MARKET, type ImportMarket } from '@/lib/domain/import';
import { windowError } from '@/lib/hub/regras';

const MIGRATIONS = path.join(__dirname, '../../../supabase/migrations');

/** The newest migration (by name) that defines market_caps_all(): the one the database ends with */
function newestCaps(): { file: string; text: string } {
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort().reverse();
  for (const file of files) {
    const text = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    if (text.includes('$caps$')) return { file, text };
  }
  throw new Error('no migration defines market_caps_all');
}

/** The jsonb literal of market_caps_all(), between its two $caps$ tags */
function sqlCaps(text = newestCaps().text): Record<string, unknown> {
  // Exactly two tags (comments included), so the text between them is the literal
  expect(text.match(/\$caps\$/g)?.length).toBe(2);
  const [, literal] = text.split('$caps$');
  return JSON.parse(literal);
}

describe('MARKET_SPEC = market_caps_all() (the newest migration that defines it)', () => {
  it('reads the literal of Phase 3b (20261024000001: + mapping)', () => {
    expect(newestCaps().file >= '20261024000001').toBe(true);
  });

  it('changed only rules.breakeven (3c) and mapping (3b) since 20261019000001 (every market but binaries)', () => {
    const old = sqlCaps(fs.readFileSync(path.join(MIGRATIONS, '20261019000001_markets.sql'), 'utf8')) as Record<
      string,
      { rules: Record<string, boolean> }
    >;
    expect(sqlCaps()).toEqual(
      Object.fromEntries(
        Object.entries(old).map(([m, c]) => [
          m,
          { ...c, mapping: m !== 'binary', rules: { ...c.rules, breakeven: m !== 'binary' } },
        ]),
      ),
    );
  });

  it('changed only mapping since Phase 3c (20261023000001)', () => {
    const c3 = sqlCaps(fs.readFileSync(path.join(MIGRATIONS, '20261023000001_regra_breakeven.sql'), 'utf8'));
    expect(sqlCaps()).toEqual(
      Object.fromEntries(Object.entries(c3).map(([m, c]) => [m, { ...(c as object), mapping: m !== 'binary' }])),
    );
  });

  it('holds the same seven markets with the same values', () => {
    const caps = sqlCaps();
    expect(Object.keys(caps).sort()).toEqual([...ACCOUNT_MARKETS].sort());
    expect(caps).toEqual(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, marketCapsJson(MARKET_SPEC[m])])));
  });

  it('writes the SQL shape: snake_case keys, nothing else', () => {
    expect(marketCapsJson(MARKET_SPEC.forex)).toEqual({
      creatable: true,
      reader: false,
      mapping: true,
      currency: 'USD',
      day: { tz: 'America/New_York', start_min: 1020 },
      rules: { block: false, states: false, soma: false, padrao: false, breakeven: true },
      window_tzs: ['America/New_York', 'America/Sao_Paulo'],
      window_tz: 'America/New_York',
      window: { start_min: 480, end_min: 600, weekdays: MON_TO_FRI },
      second_window: { start_min: 180, end_min: 300 },
    });
  });
});

describe('the descriptor', () => {
  it('offers six markets, in the boards\' order; options stays valid but is never offered', () => {
    expect(CREATABLE_MARKETS).toEqual(['futures', 'binary', 'forex', 'stocks', 'crypto', 'b3']);
    expect(ACCOUNT_MARKETS).toEqual([...CREATABLE_MARKETS, 'options']);
    expect(MARKET_SPEC.options.creatable).toBe(false);
  });

  it('counts money in reais only on B3 (USDT and USDC are dollars)', () => {
    expect(ACCOUNT_MARKETS.filter((m) => currencyOf(m) === 'BRL')).toEqual(['b3']);
    expect(currencyOf('crypto')).toBe('USD');
    expect(limitKey('BRL')).toBe('brl');
    expect(limitKey('USD')).toBe('usd');
  });

  it('gives the data block, the state rule, «somando» and «Padrão» to futures only', () => {
    for (const rule of ['block', 'states', 'soma', 'padrao'] as const) {
      expect(ACCOUNT_MARKETS.filter((m) => MARKET_SPEC[m].rules[rule])).toEqual(['futures']);
    }
  });

  it('has file readers only for futures (Top One) and binaries (Ebinex)', () => {
    expect(ACCOUNT_MARKETS.filter((m) => MARKET_SPEC[m].reader)).toEqual(['futures', 'binary']);
    // Every file format's market is an account market with a reader
    for (const m of Object.values(PLATFORM_MARKET)) expect(MARKET_SPEC[m].reader).toBe(true);
    const fileMarket: ImportMarket = 'futures';
    const accountMarket: AccountMarket = fileMarket;
    expect(accountMarket).toBe('futures');
  });

  it('imports a file by its columns in every market but binaries (Phase 3b)', () => {
    expect(ACCOUNT_MARKETS.filter((m) => !MARKET_SPEC[m].mapping)).toEqual(['binary']);
  });

  it.each([
    ['futures', 'America/New_York', 1080],
    ['binary', 'America/Sao_Paulo', 0],
    ['forex', 'America/New_York', 1020],
    ['stocks', 'America/New_York', 1200],
    ['crypto', 'America/Sao_Paulo', 0],
    ['b3', 'America/Sao_Paulo', 0],
    ['options', 'America/New_York', 1200],
  ] as const)('%s: a new account\'s day turns on %s at minute %i', (m, tz, startMin) => {
    expect(MARKET_SPEC[m].day).toEqual({ tz, startMin });
    expect(() => assertTimeZone(MARKET_SPEC[m].day.tz)).not.toThrow();
  });

  it.each(ACCOUNT_MARKETS.map((m) => [m]))('%s: window clocks New York and Brasília, its own among them', (m) => {
    const spec = MARKET_SPEC[m];
    expect(spec.windowTzs).toEqual(WINDOW_TZS);
    expect(spec.windowTzs).toContain(spec.windowTz);
  });

  it.each(ACCOUNT_MARKETS.map((m) => [m]))('%s: the suggested windows are valid windows of its rules', (m) => {
    const spec = MARKET_SPEC[m];
    const first = { tz: spec.windowTz, ...spec.window };
    const second = { tz: spec.windowTz, ...spec.secondWindow, weekdays: spec.window.weekdays };
    for (const w of [first, second]) {
      expect(windowError(w)).toBeNull();
      expect(isValidWindow(w)).toBe(true);
    }
    // Saved as the market's two windows, the database (and checkRules) accepts them
    const resolved = {
      v: 1,
      market: m,
      windows: [first, second].map((w) => ({ tz: w.tz, start_min: w.startMin, end_min: w.endMin, weekdays: w.weekdays })),
      windows_from: 'market',
      window_rule: { on: true, outside: 'fora' },
      block: spec.rules.block ? { on: true, before_min: 5, after_min: 10, calendars: [] } : null,
      limit: { [limitKey(spec.currency)]: 400, mode: 'conta', at_limit: 'encerrar' },
      states: spec.rules.states
        ? { alinhadas: null, so_tecnica: null, so_fundamentos: null, em_conflito: null, sem_direcao: null }
        : null,
      day: { tz: spec.day.tz, start_min: spec.day.startMin },
    };
    expect(checkRules(resolved)).toBeNull();
  });

  it('suggests every day for crypto and Monday to Friday elsewhere', () => {
    expect(MARKET_SPEC.crypto.window.weekdays).toBe(EVERY_DAY);
    expect(ACCOUNT_MARKETS.filter((m) => MARKET_SPEC[m].window.weekdays !== MON_TO_FRI)).toEqual(['crypto']);
  });

  it('describes options like stocks, except that it is not offered', () => {
    expect({ ...MARKET_SPEC.options, creatable: true }).toEqual(MARKET_SPEC.stocks);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(MARKET_SPEC)).toBe(true);
    expect(Object.isFrozen(MARKET_SPEC.b3.day)).toBe(true);
    expect(Object.isFrozen(ACCOUNT_MARKETS)).toBe(true);
    expect(Object.isFrozen(CREATABLE_MARKETS)).toBe(true);
  });
});

describe('isAccountMarket', () => {
  it.each(ACCOUNT_MARKETS.map((m) => [m]))('accepts %s', (m) => {
    expect(isAccountMarket(m)).toBe(true);
  });

  it.each(['xyz', 'Forex', 'FUTURES', '', 'toString', 'constructor', '__proto__', null, undefined, 1, {}, ['forex']])(
    'refuses %p',
    (x) => {
      expect(isAccountMarket(x)).toBe(false);
    },
  );

  it('is the same type in the gate', () => {
    const m: GateAccountMarket = 'b3';
    expect(isAccountMarket(m)).toBe(true);
  });
});
