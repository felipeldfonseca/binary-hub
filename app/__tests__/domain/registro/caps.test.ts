/**
 * @jest-environment node
 *
 * The Registrar's descriptors: TRADE_CAPS and INSTRUMENT_SPEC (TypeScript) and trade_caps_all() and
 * instrument_specs() (the database) hold the same values. The SQL literals are parsed out of the
 * newest migration that defines them (20261020000001_trade_cycle.sql first, 20261022000001_registrar_mercados.sql
 * since 3-4), so a change on one side without the other fails here, in CI, without a database. The
 * descriptors the SQL answered when cases.json was recorded must hold the same values too.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ACOES_B3,
  B3_FUTUROS,
  INSTRUMENT_SPEC,
  TRADE_CAPS,
  durationsOf,
  expiryRuleOf,
  instrumentSpecsJson,
  platformKey,
  tradeCapsJson,
  tradeInstrument,
  tradeMatchKey,
} from '@/lib/domain/registro';
import { parseNumeric } from '@/lib/domain/registro/numeric';
import { ACCOUNT_MARKETS, MARKET_SPEC } from '@/lib/domain';
import cases from './cases.json';

const MIGRATIONS = path.join(__dirname, '../../../../supabase/migrations');

/** The jsonb literal between the two `tag`s of a migration */
function literal(text: string, tag: string): Record<string, unknown> {
  // Exactly two tags (comments included), so the text between them is the literal
  expect(text.split(tag).length).toBe(3);
  return JSON.parse(text.split(tag)[1]);
}

/** The newest migration (by name) whose text holds `tag`: the one the database ends with */
function newest(tag: string): { file: string; text: string } {
  const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files.reverse()) {
    const text = fs.readFileSync(path.join(MIGRATIONS, file), 'utf8');
    if (text.includes(tag)) return { file, text };
  }
  throw new Error(`no migration defines ${tag}`);
}

describe('TRADE_CAPS / INSTRUMENT_SPEC = the migration’s literals', () => {
  it('reads both literals from the newest migration that defines them (3-4: 20261022000001)', () => {
    const caps = newest('$tcaps$');
    const specs = newest('$ispec$');
    expect(caps.file).toBe(specs.file);
    expect(caps.file >= '20261022000001').toBe(true);
    expect(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, tradeCapsJson(TRADE_CAPS[m])]))).toEqual(literal(caps.text, '$tcaps$'));
    expect(instrumentSpecsJson()).toEqual(literal(specs.text, '$ispec$'));
  });

  it('changed only what 3-4 describes since 20261020000001 (futures stops, the B3 outside the catalog, the B3 catalog rows)', () => {
    const old = fs.readFileSync(path.join(MIGRATIONS, '20261020000001_trade_cycle.sql'), 'utf8');
    const caps0 = literal(old, '$tcaps$') as Record<string, Record<string, unknown>>;
    const specs0 = literal(old, '$ispec$') as Record<string, Record<string, Record<string, unknown>>>;
    const caps = Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, tradeCapsJson(TRADE_CAPS[m])]));
    expect(caps).toEqual({
      ...caps0,
      futures: { ...caps0.futures, stops: 'price' },
      b3: { ...caps0.b3, price_dp: 8, pnl: 'typed', mult: null },
    });
    const specs = instrumentSpecsJson();
    expect(specs.forex).toEqual(specs0.forex);
    expect(specs.futures).toEqual(Object.fromEntries(Object.entries(specs0.futures).map(([k, r]) => [k, { ...r, stops: 'pts' }])));
    expect(Object.fromEntries(B3_FUTUROS.map((k) => [k, specs.b3[k]]))).toEqual(specs0.b3);
  });

  it('matches what the database answered when the shared cases were recorded', () => {
    expect(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, tradeCapsJson(TRADE_CAPS[m])]))).toEqual(cases.descriptors.trade_caps_all);
    expect(instrumentSpecsJson()).toEqual(cases.descriptors.instrument_specs);
  });
});

describe('the descriptors', () => {
  it('has a form for every account market', () => {
    expect(Object.keys(TRADE_CAPS).sort()).toEqual([...ACCOUNT_MARKETS].sort());
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TRADE_CAPS)).toBe(true);
    expect(Object.isFrozen(TRADE_CAPS.binary.durations)).toBe(true);
    expect(Object.isFrozen(TRADE_CAPS.binary.durationsByPlatform!.ebinex)).toBe(true);
    expect(Object.isFrozen(INSTRUMENT_SPEC.futures)).toBe(true);
    expect(Object.isFrozen(INSTRUMENT_SPEC.futures!.MES)).toBe(true);
  });

  it('keys every instrument by its own match key, with decimal amounts', () => {
    for (const [market, rows] of Object.entries(INSTRUMENT_SPEC)) {
      for (const [key, row] of Object.entries(rows ?? {})) {
        expect(tradeMatchKey(market, key)).toBe(key);
        for (const amount of [row.tick, row.mult, row.pip]) {
          if (amount !== undefined && amount !== null) expect(parseNumeric(amount)).not.toBeNull();
        }
        // A computed result needs a multiplier
        if (row.pnl === 'prices' || row.pnl === 'prices_div_exit') expect(row.mult).toBeTruthy();
        // Pips need a pip
        if (row.stops === 'pips' || (row.stops === undefined && TRADE_CAPS[market as keyof typeof TRADE_CAPS].stops === 'pips')) {
          expect(row.pip).toBeTruthy();
        }
      }
    }
  });

  it('computes the six futures the Registrar offers (board: MES 0,25 · US$ 5, MNQ 0,25 · US$ 2, MGC 0,10 · US$ 10)', () => {
    const offered = ['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC'].map((s) => tradeInstrument('futures', s)!);
    expect(offered.map((s) => [s.key, s.tick, s.mult, s.pnl, s.stops, s.known])).toEqual([
      ['MES', '0.25', '5', 'prices', 'pts', true],
      ['MNQ', '0.25', '2', 'prices', 'pts', true],
      ['MGC', '0.10', '10', 'prices', 'pts', true],
      ['ES', '0.25', '50', 'prices', 'pts', true],
      ['NQ', '0.25', '20', 'prices', 'pts', true],
      ['GC', '0.10', '100', 'prices', 'pts', true],
    ]);
    // Futures take no costs and no typed result where the result is computed (C33, C34)
    expect(TRADE_CAPS.futures.costs).toBe(false);
    expect(TRADE_CAPS.futures.correct).toBe(false);
  });

  it('divides by the exit price only on pairs with the dollar as base', () => {
    for (const [key, row] of Object.entries(INSTRUMENT_SPEC.forex ?? {})) {
      if (row.pnl === 'prices_div_exit') expect(key.startsWith('USD')).toBe(true);
      if (row.pnl === 'prices') expect(key.endsWith('USD')).toBe(true);
    }
  });

  it('gives binaries four expirations, Ebinex three (1, 5 and 15 min: the owner, 2026-10-19), and the Ebinex candle rule', () => {
    expect(TRADE_CAPS.binary.durations).toEqual([60, 120, 300, 900]);
    expect(TRADE_CAPS.binary.durationsByPlatform).toEqual({ ebinex: [60, 300, 900] });
    expect(durationsOf('ebinex')).toEqual([60, 300, 900]);
    expect(durationsOf(' Ebinex ')).toEqual([60, 300, 900]);
    expect(durationsOf('EBINEX')).toEqual([60, 300, 900]);
    expect(durationsOf('pocketoption')).toEqual([60, 120, 300, 900]);
    expect(durationsOf(null)).toEqual([60, 120, 300, 900]);
    expect(durationsOf('')).toEqual([60, 120, 300, 900]);
    // btrim drops spaces only; an inherited key is no platform
    expect(durationsOf('\tebinex')).toEqual([60, 120, 300, 900]);
    expect(durationsOf('constructor')).toEqual([60, 120, 300, 900]);
    expect(platformKey('  Ebinex ')).toBe('ebinex');
    expect(platformKey(undefined)).toBe('');
    expect(TRADE_CAPS.binary.directions).toEqual(['call', 'put']);
    expect(expiryRuleOf('ebinex')).toBe('next_candle');
    expect(expiryRuleOf(' Ebinex ')).toBe('next_candle');
    expect(expiryRuleOf('pocketoption')).toBe('entry');
    expect(expiryRuleOf(null)).toBe('entry');
    // btrim drops spaces only
    expect(expiryRuleOf('\tebinex')).toBe('entry');
    expect(expiryRuleOf('constructor')).toBe('entry');
  });

  it('computes the B3 catalog (56 stocks and ETFs, 1:1, up to 4 decimals) and types any other B3 code', () => {
    expect(Object.keys(INSTRUMENT_SPEC.b3 ?? {}).sort()).toEqual([...B3_FUTUROS, ...ACOES_B3].sort());
    for (const code of ACOES_B3) {
      expect(tradeInstrument('b3', code)).toMatchObject({ key: code, pnl: 'prices', mult: '1', priceDp: 4, qtyDp: 0, stops: 'price', tick: null, known: true });
    }
    expect(tradeInstrument('b3', 'PETR4F')).toEqual(tradeInstrument('b3', 'PETR4'));
    expect(tradeInstrument('b3', 'BGIX26')).toMatchObject({ key: 'BGIX26', pnl: 'typed', mult: null, priceDp: 8, assetType: 'b3', known: false });
    expect(tradeInstrument('b3', 'XPTO3')).toMatchObject({ pnl: 'typed', priceDp: 8, known: false });
    expect(tradeInstrument('b3', 'WINZ26')).toEqual(tradeInstrument('b3', 'WIN'));
  });

  it('takes stop and target as a price on a futures root outside the table (ZN, SR3), points on the table', () => {
    expect(tradeInstrument('futures', 'ZNZ6')).toMatchObject({ key: 'ZN', stops: 'price', pnl: 'typed', priceDp: 8, known: false });
    expect(tradeInstrument('futures', 'SR3')).toMatchObject({ stops: 'price', pnl: 'typed' });
    expect(tradeInstrument('futures', 'MCLZ6')).toMatchObject({ key: 'MCL', stops: 'pts', tick: '0.01', mult: '100', pnl: 'prices' });
    expect(tradeInstrument('futures', 'MESZ6')).toEqual(tradeInstrument('futures', 'MES'));
  });

  it('gives each market the asset type the accounts use', () => {
    expect(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, TRADE_CAPS[m].assetType]))).toEqual({
      futures: 'futures',
      binary: 'binary_option',
      forex: 'forex',
      stocks: 'stock',
      crypto: 'crypto',
      b3: 'b3',
      options: 'option',
    });
    // B3 futures are futures; a B3 stock takes the market's
    expect(tradeInstrument('b3', 'WINZ26')!.assetType).toBe('futures');
    expect(tradeInstrument('b3', 'PETR4')!.assetType).toBe('b3');
    // Every market of the form is an account market with a currency
    for (const m of ACCOUNT_MARKETS) expect(MARKET_SPEC[m].currency).toMatch(/^(USD|BRL)$/);
  });

  it('turns an option into the option’s contract, and a non-100 contract into a typed result', () => {
    const option = { right: 'call' as const, strike: '200', expires_on: '2026-11-20' };
    expect(tradeInstrument('stocks', 'AAPL', option)).toMatchObject({ assetType: 'option', qtyDp: 0, priceDp: 2, mult: '100', pnl: 'prices' });
    expect(tradeInstrument('stocks', 'AAPL', { ...option, multiplier: '100.0000' })).toMatchObject({ mult: '100.0000', pnl: 'prices' });
    expect(tradeInstrument('stocks', 'AAPL', { ...option, multiplier: '50' })).toMatchObject({ mult: '50', pnl: 'typed' });
    // A market without options ignores the contract (the payload check refuses it first)
    expect(tradeInstrument('futures', 'MES', option)).toMatchObject({ assetType: 'futures', mult: '5' });
    expect(tradeInstrument('stocks', 'AAPL', { ...option, multiplier: 'muitos' })).toBeNull();
    expect(tradeInstrument('xyz', 'AAPL')).toBeNull();
  });
});
