/**
 * @jest-environment node
 *
 * Cells of a mapped file (banco_dominio.md §5.4, C8, C10, C20, D14–D16): dates and header clocks,
 * sides, «Abre ou fecha», symbols, IDs, «Conta».
 */
import { createHash } from 'node:crypto';
import {
  accountKey,
  accountRouteHash,
  dateOrderEvidence,
  decideDateOrder,
  headerClock,
  isDollarQuoted,
  isOccSymbol,
  normaliseB3Continuous,
  normaliseFuturesSymbol,
  readDateTime,
  readMappedId,
  readOpenClose,
  readSide,
  readSymbol,
  wordKey,
} from '@/lib/domain/import';
import { tradeMatchKey } from '@/lib/domain/registro';

describe('dates and times (D14)', () => {
  it.each([
    ['14/10/2026 10:02:11', 'dmy', '2026-10-14T10:02:11', null],
    ['10/14/2026 10:02:11', 'mdy', '2026-10-14T10:02:11', null],
    ['10/1/2026 9:31:05 AM', 'mdy', '2026-10-01T09:31:05', null],
    ['10/1/2026 12:05:00 AM', 'mdy', '2026-10-01T00:05:00', null],
    ['10/1/2026 12:05:00 PM', 'mdy', '2026-10-01T12:05:00', null],
    ['10/1/2026 1:05 p.m.', 'mdy', '2026-10-01T13:05:00', null],
    ['14.10.2026 08:40:12', 'dmy', '2026-10-14T08:40:12', null],
    ['14-10-26 08:40', 'dmy', '2026-10-14T08:40:00', null],
    ['14/10/2026 10:02:11,250', 'dmy', '2026-10-14T10:02:11.250', null],
    ['2026-10-14 10:02:11', null, '2026-10-14T10:02:11', null],
    ['2026-10-14T10:02:11.123456Z', null, '2026-10-14T10:02:11.123456', '+00:00'],
    ['2026-10-14T10:02:11-03:00', null, '2026-10-14T10:02:11', '-03:00'],
    ['2026-10-14 10:02:11 +0530', null, '2026-10-14T10:02:11', '+05:30'],
    ['2026.10.14 10:02', null, '2026-10-14T10:02:00', null],
    ['20261014;094512', null, '2026-10-14T09:45:12', null],
    ['20261014 094512', null, '2026-10-14T09:45:12', null],
    ['01-Oct-2026 09:34:31', null, '2026-10-01T09:34:31', null],
    ['1 Oct 2026 9:34 AM', null, '2026-10-01T09:34:00', null],
    ['Oct 1, 2026 9:34:31 AM', null, '2026-10-01T09:34:31', null],
    ['14 out 2026 09:34', null, '2026-10-14T09:34:00', null],
    ['1791972131', null, '2026-10-14T10:02:11', '+00:00'],
    ['1791972131250', null, '2026-10-14T10:02:11.250', '+00:00'],
  ] as const)('%j (%s) → %s %s', (text, order, local, offset) => {
    expect(readDateTime(text, order)).toEqual({ local, offset });
  });

  it.each([
    ['31/02/2026 10:00:00', 'dmy'],
    ['14/10/2026', 'dmy'],
    ['14/10/2026 25:00:00', 'dmy'],
    ['13/10/2026 13:00 PM', 'dmy'],
    ['2026-10-14T10:00:00+15:00', null],
    ['09/10/2026 10:00:00', null],
    ['soon', null],
    ['', null],
  ] as const)('refuses %j (%s)', (text, order) => {
    expect(readDateTime(text, order)).toBeNull();
  });

  it('says which order a cell shows', () => {
    expect(dateOrderEvidence('14/10/2026 10:00')).toBe('dmy');
    expect(dateOrderEvidence('10/14/2026 10:00')).toBe('mdy');
    expect(dateOrderEvidence('09/10/2026 10:00')).toBe('either');
    expect(dateOrderEvidence('10/10/2026 10:00')).toBe('fixed');
    expect(dateOrderEvidence('2026-10-09 10:00')).toBe('fixed');
    expect(dateOrderEvidence('MESZ6')).toBeNull();
  });

  it('decides the order over every cell, and asks when none shows it or they disagree', () => {
    expect(decideDateOrder(['09/10/2026 10:00', '14/10/2026 10:00'])).toEqual({ decided: 'dmy', ambiguous: true, conflict: false, ask: false });
    expect(decideDateOrder(['09/10/2026 10:00', '08/10/2026 10:00'])).toEqual({ decided: null, ambiguous: true, conflict: false, ask: true });
    expect(decideDateOrder(['14/10/2026 10:00', '10/14/2026 10:00'])).toEqual({ decided: null, ambiguous: false, conflict: true, ask: true });
    expect(decideDateOrder(['2026-10-09 10:00'])).toEqual({ decided: null, ambiguous: false, conflict: false, ask: false });
  });
});

describe('a clock in the header (C20)', () => {
  it.each([
    ['Trade Time(UTC+0)', { offset: '+00:00' }],
    ['Closing Time (UTC+1)', { offset: '+01:00' }],
    ['Hora (GMT−3)', { offset: '-03:00' }],
    ['time utc+05:30', { offset: '+05:30' }],
    ['UTC-0 time', { offset: '+00:00' }],
    ['Date(UTC)', { offset: '+00:00' }],
    ['date (gmt)', { offset: '+00:00' }],
    ['Time UTC', { hint: 'UTC' }],
    ['Fill Time', null],
    ['Outcome', null],
  ] as const)('%j → %j', (name, clock) => {
    expect(headerClock(name)).toEqual(clock);
  });
});

describe('sides and «Abre ou fecha» (D15)', () => {
  it.each(['C', 'compra', 'Comprado', 'BUY', 'b', 'BOT', 'Bought', 'Long', 'L', 'Buy to Cover'])('%j → buy', (w) => {
    expect(readSide(w)).toBe('buy');
  });
  it.each(['V', 'venda', 'Vendido', 'sell', 'S', 'SLD', 'Sold', 'SHORT', 'Sell Short'])('%j → sell', (w) => {
    expect(readSide(w)).toBe('sell');
  });

  it('a saved answer reads an unknown word and wins over the built-in one', () => {
    expect(readSide('X')).toBeNull();
    expect(readSide(' x ', { x: 'sell' })).toBe('sell');
    expect(readSide('X', { x: 'skip' })).toBe('skip');
    expect(readSide('Buy', { buy: 'sell' })).toBe('sell');
    expect(wordKey(' Ação.  Final. ')).toBe('acao. final');
  });

  it('«Abre ou fecha»: open, close, IBKR\'s «C;O» flip and its other codes', () => {
    expect(['O', 'Open', 'abertura', 'TO OPEN', 'BTO', 'E', 'Entry'].map((w) => readOpenClose(w))).toEqual(Array(7).fill('open'));
    expect(['C', 'close', 'Fechamento', 'TO CLOSE', 'STC', 'X', 'Exit'].map((w) => readOpenClose(w))).toEqual(Array(7).fill('close'));
    expect(readOpenClose('C;O')).toBe('flip');
    expect(readOpenClose('O;P')).toBe('open');
    expect(readOpenClose('C;Ep')).toBe('close');
    expect(readOpenClose('?')).toBeNull();
    expect(readOpenClose('?', { '?': 'open' })).toBe('open');
  });
});

describe('symbols (C8, C10, Q6)', () => {
  it.each([
    ['MES 12-26', 'MESZ26'],
    ['MNQ 3-27', 'MNQH27'],
    ['ES 12-2026', 'ESZ26'],
    ['MES DEC26', 'MESZ26'],
    ['MES Dec 26', 'MESZ26'],
    ['/MESZ26', 'MESZ26'],
    ['/esz6', 'ESZ6'],
    ['CON.F.US.MES.Z26', 'MESZ26'],
    ['CON.F.US.ENQ.H27', 'ENQH27'],
    ['MESZ6', null],
    ['MES 13-26', null],
    ['MES XYZ26', null],
  ] as const)('%j → %s', (text, symbol) => {
    expect(normaliseFuturesSymbol(text)).toBe(symbol);
  });

  it('the normalised symbol finds its root, so the result computes and links', () => {
    expect(tradeMatchKey('futures', 'MES 12-26')).toBe('MES1226');
    expect(tradeMatchKey('futures', normaliseFuturesSymbol('MES 12-26'))).toBe('MES');
  });

  it('Profit\'s continuous series of the B3 futures become their root (B3 accounts only)', () => {
    expect(['WINFUT', 'win$', 'WDO$N', 'INDFUT', 'DOL$'].map(normaliseB3Continuous)).toEqual(['WIN', 'WIN', 'WDO', 'IND', 'DOL']);
    expect(['PETR4', 'WINZ26', 'BGIFUT'].map(normaliseB3Continuous)).toEqual([null, null, null]);
    expect(readSymbol('WINFUT', 'b3')).toEqual({ ok: true, symbol: 'WIN', normalised: true });
    expect(readSymbol('WINFUT', 'futures')).toEqual({ ok: true, symbol: 'WINFUT', normalised: false });
    expect(tradeMatchKey('b3', 'WIN')).toBe('WIN');
  });

  it('reads a symbol per market', () => {
    expect(readSymbol(' MES 12-26 ', 'futures')).toEqual({ ok: true, symbol: 'MESZ26', normalised: true });
    expect(readSymbol('MESZ6', 'futures')).toEqual({ ok: true, symbol: 'MESZ6', normalised: false });
    expect(readSymbol('WIN 12-26', 'b3')).toEqual({ ok: true, symbol: 'WINZ26', normalised: true });
    expect(readSymbol('MES 12-26', 'stocks')).toEqual({ ok: true, symbol: 'MES 12-26', normalised: false });
    expect(readSymbol('AAPL  261120C00150000', 'stocks')).toEqual({ ok: false, code: 'bad_option' });
    expect(readSymbol('AAPL261120P00150000', 'options')).toEqual({ ok: false, code: 'bad_option' });
    expect(readSymbol('ETHBTC', 'crypto')).toEqual({ ok: false, code: 'not_dollar_quote' });
    expect(readSymbol('BTCUSD_PERP', 'crypto')).toEqual({ ok: false, code: 'not_dollar_quote' });
    expect(readSymbol('BTC/USDC', 'crypto')).toEqual({ ok: true, symbol: 'BTC/USDC', normalised: false });
    expect(readSymbol('', 'forex')).toEqual({ ok: false, code: 'missing_symbol' });
    expect(readSymbol('X'.repeat(41), 'forex')).toEqual({ ok: false, code: 'missing_symbol' });
  });

  it('OCC and dollar quotes', () => {
    expect(isOccSymbol('NVDA  261120C00190000')).toBe(true);
    expect(isOccSymbol('BRK.B 261120P00450000')).toBe(true);
    expect(isOccSymbol('AAPL')).toBe(false);
    expect(['BTCUSDT', 'ETH/USDC', 'SOLUSD', 'BTC-USDT'].every(isDollarQuoted)).toBe(true);
    expect(['USDT', 'ETHBTC', 'BTCUSD_PERP'].some(isDollarQuoted)).toBe(false);
  });
});

describe('IDs and «Conta»', () => {
  it('an ID: up to 64 characters without spaces, never starting with «@»', () => {
    expect(readMappedId(' 83395 ')).toBe('83395');
    expect(readMappedId('')).toBe('missing');
    expect(readMappedId('@a1b2')).toBe('bad');
    expect(readMappedId('a b')).toBe('bad');
    expect(readMappedId('x'.repeat(65))).toBe('bad');
    expect(readMappedId('x'.repeat(64))).toBe('x'.repeat(64));
  });

  it('a «Conta» value is compared loosely and kept only as a hash', () => {
    expect(accountKey('  apx-0001 ')).toBe('APX-0001');
    expect(accountRouteHash('apx-0001')).toBe(createHash('sha256').update('APX-0001', 'utf8').digest('hex'));
    expect(accountRouteHash('APX-0001')).toMatch(/^[0-9a-f]{64}$/);
  });
});
