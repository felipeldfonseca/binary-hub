/**
 * @jest-environment node
 *
 * The instrument catalogs of «Buscar ativo» (lib/domain/registro/catalogo, the approved 2b lists):
 * counts, no duplicates, every code a symbol the server takes, aliases to catalog codes, and the
 * B3 stock rows of INSTRUMENT_SPEC built from the same list.
 */
import {
  ACOES_B3,
  ACOES_EUA,
  ALIASES_B3,
  B3_FUTUROS,
  CATALOGO,
  CATALOGO_REVISTO,
  CRIPTO_CATALOGO,
  FOREX_CATALOGO,
  FUTUROS_CATALOGO,
  INDICES_OPCOES,
  INSTRUMENT_SPEC,
  tradeInstrument,
  tradeMatchKey,
} from '@/lib/domain/registro';

/** trade_check_payload's symbol: btrim, 1–40 characters, this pattern */
const SYMBOL_RE = /^[A-Za-z0-9][A-Za-z0-9./:() _-]*$/;

describe('the catalogs', () => {
  it('holds the approved counts (18 futures, 16 pairs, 670 US stocks and ETFs, 5 index options, 27 coins, 61 B3 codes)', () => {
    expect(FUTUROS_CATALOGO).toHaveLength(18);
    expect(FOREX_CATALOGO).toHaveLength(16);
    expect(ACOES_EUA).toHaveLength(670);
    expect(INDICES_OPCOES).toHaveLength(5);
    expect(CRIPTO_CATALOGO).toHaveLength(27);
    expect(B3_FUTUROS).toHaveLength(5);
    expect(ACOES_B3).toHaveLength(56);
    expect(CATALOGO.b3).toHaveLength(61);
    expect(CATALOGO_REVISTO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('keeps the board’s order where the board draws it', () => {
    expect(FUTUROS_CATALOGO.slice(0, 8)).toEqual(['MES', 'ES', 'MNQ', 'NQ', 'MGC', 'GC', 'MCL', 'CL']);
    expect(FOREX_CATALOGO[0]).toBe('EUR/USD');
    expect(ACOES_EUA.slice(0, 4)).toEqual(['SPY', 'MU', 'NVDA', 'QQQ']);
    expect(CATALOGO.b3.slice(0, 6)).toEqual(['WIN', 'WDO', 'IND', 'DOL', 'DI1', 'VALE3']);
    expect(CRIPTO_CATALOGO.slice(0, 2)).toEqual(['BTC', 'ETH']);
  });

  it('has no duplicate and only symbols the server takes', () => {
    const lists: readonly (readonly string[])[] = [FUTUROS_CATALOGO, FOREX_CATALOGO, ACOES_EUA, INDICES_OPCOES, CRIPTO_CATALOGO, CATALOGO.b3];
    for (const list of lists) {
      expect(new Set(list).size).toBe(list.length);
      for (const code of list) {
        expect(code).toMatch(SYMBOL_RE);
        expect(code.length).toBeLessThanOrEqual(40);
        expect(code).toBe(code.trim().toUpperCase());
      }
    }
    // The index options are not stocks
    for (const i of INDICES_OPCOES) expect(ACOES_EUA as readonly string[]).not.toContain(i);
  });

  it('points every former B3 code at a catalog code (and none is in the catalog itself)', () => {
    for (const [old, now] of Object.entries(ALIASES_B3)) {
      expect(ACOES_B3 as readonly string[]).toContain(now);
      expect(CATALOGO.b3).not.toContain(old);
    }
    expect(ALIASES_B3.ELET3).toBe('AXIA3');
    expect(Object.isFrozen(ALIASES_B3)).toBe(true);
  });

  it('gives every code the match key the server groups it by', () => {
    for (const code of FUTUROS_CATALOGO) expect(tradeMatchKey('futures', code)).toBe(code);
    for (const code of FOREX_CATALOGO) expect(tradeMatchKey('forex', code)).toBe(code.replace('/', ''));
    for (const code of ACOES_EUA) expect(tradeMatchKey('stocks', code)).toBe(code.replace(/[^A-Z0-9]/g, ''));
    for (const code of CRIPTO_CATALOGO) expect(tradeMatchKey('crypto', code)).toBe(code);
    for (const code of CATALOGO.b3) expect(tradeMatchKey('b3', code)).toBe(code);
    expect(tradeMatchKey('stocks', 'BRK.B')).toBe('BRKB');
  });

  it('computes the futures and B3 rows the descriptors have, and types the rest', () => {
    const computedFutures = FUTUROS_CATALOGO.filter((c) => tradeInstrument('futures', c)!.pnl === 'prices');
    expect(computedFutures).toEqual(['MES', 'ES', 'MNQ', 'NQ', 'MGC', 'GC', 'MCL', 'CL']);
    expect(Object.keys(INSTRUMENT_SPEC.futures ?? {}).sort()).toEqual([...computedFutures].sort());
    expect(CATALOGO.b3.filter((c) => tradeInstrument('b3', c)!.pnl === 'typed')).toEqual(['DI1']);
    // Every forex pair of the catalog has a row (computed, estimated or typed)
    for (const p of FOREX_CATALOGO) expect(tradeInstrument('forex', p)!.known).toBe(true);
  });
});
