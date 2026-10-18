/**
 * @jest-environment node
 *
 * The Registrar's descriptors: TRADE_CAPS and INSTRUMENT_SPEC (TypeScript) and trade_caps_all() and
 * instrument_specs() (the database, migration 20261020000001_trade_cycle.sql) hold the same values.
 * The SQL literals are parsed out of the migration file, so a change on one side without the other
 * fails here, in CI, without a database. Until the database PR (fase-3/banco) is in this tree, the
 * descriptors the SQL answered when cases.json was recorded stand in for the file (cases.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  INSTRUMENT_SPEC,
  TRADE_CAPS,
  expiryRuleOf,
  instrumentSpecsJson,
  tradeCapsJson,
  tradeInstrument,
  tradeMatchKey,
} from '@/lib/domain/registro';
import { parseNumeric } from '@/lib/domain/registro/numeric';
import { ACCOUNT_MARKETS, MARKET_SPEC } from '@/lib/domain';
import cases from './cases.json';

const MIGRATIONS = path.join(__dirname, '../../../../supabase/migrations');
const MIGRATION = path.join(MIGRATIONS, '20261020000001_trade_cycle.sql');

/** The jsonb literal between the two `tag`s of the migration */
function literal(text: string, tag: string): Record<string, unknown> {
  // Exactly two tags (comments included), so the text between them is the literal
  expect(text.split(tag).length).toBe(3);
  return JSON.parse(text.split(tag)[1]);
}

describe('TRADE_CAPS / INSTRUMENT_SPEC = the migration’s literals', () => {
  const present = fs.existsSync(MIGRATION);

  it('reads the literals from 20261020000001_trade_cycle.sql once the database PR is in the tree', () => {
    if (!present) {
      // Before fase-3/banco merges, no Phase 3 migration may exist without this file
      const later = fs.readdirSync(MIGRATIONS).filter((f) => f.split('_')[0] >= '20261020000001');
      expect(later).toEqual([]);
      return;
    }
    const text = fs.readFileSync(MIGRATION, 'utf8');
    expect(Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, tradeCapsJson(TRADE_CAPS[m])]))).toEqual(literal(text, '$tcaps$'));
    expect(instrumentSpecsJson()).toEqual(literal(text, '$ispec$'));
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

  it('gives binaries four expirations and the Ebinex candle rule', () => {
    expect(TRADE_CAPS.binary.durations).toEqual([60, 120, 300, 900]);
    expect(TRADE_CAPS.binary.directions).toEqual(['call', 'put']);
    expect(expiryRuleOf('ebinex')).toBe('next_candle');
    expect(expiryRuleOf(' Ebinex ')).toBe('next_candle');
    expect(expiryRuleOf('pocketoption')).toBe('entry');
    expect(expiryRuleOf(null)).toBe('entry');
    // btrim drops spaces only
    expect(expiryRuleOf('\tebinex')).toBe('entry');
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
