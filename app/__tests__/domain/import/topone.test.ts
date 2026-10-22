/**
 * @jest-environment node
 */
/**
 * Top One rules on small invented files: amounts, levels, lots, times, tickets, duplicates.
 */
import {
  TOPONE_COLUMNS,
  parseImportText,
  type ImportRow,
  type ParsedFile,
  type RowIssue,
  type TopOneColumn,
} from '@/lib/domain/import';

const BASE: Record<TopOneColumn, string> = {
  'Ticket #': 'MNQM6/900000000901',
  Symbol: 'MNQM6',
  Side: 'BUY',
  SL: '0',
  TP: '0',
  'Open Time': '12/03/2026 14:30:00',
  'Open Price': '21500',
  'Close Time': '12/03/2026 14:31:00',
  'Close Price': '21505',
  Duration: '1m 0s',
  PnL: '$10',
  Lots: '1',
  Commissions: '2.68',
  Gain: '0.02%',
};

/** One CSV line, every cell quoted as Top One writes it. */
function line(over: Partial<Record<TopOneColumn, string>> = {}): string {
  const r = { ...BASE, ...over };
  return TOPONE_COLUMNS.map((c) => `"${r[c]}"`).join(',');
}

function parse(...lines: string[]): ParsedFile {
  const out = parseImportText([TOPONE_COLUMNS.map((c) => `"${c}"`).join(','), ...lines].join('\n'));
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

const one = (over: Partial<Record<TopOneColumn, string>>) => parse(line(over));
const first = (out: ParsedFile): ImportRow => out.rows[0];
const codes = (list: RowIssue<string>[]) => list.map((i) => (i.column ? `${i.code}(${i.column})` : i.code));

describe('Top One rows', () => {
  it('a plain row', () => {
    const out = one({});
    expect(first(out)).toEqual({
      line: 2,
      external_id: 'MNQM6/900000000901',
      symbol: 'MNQM6',
      asset_type: 'futures',
      direction: 'long',
      local_entry: '2026-03-12T14:30:00',
      local_exit: '2026-03-12T14:31:00',
      utc_offset: null,
      entry_price: '21500',
      exit_price: '21505',
      quantity: '1',
      stake_amount: null,
      payout_percent: null,
      duration_seconds: null,
      timeframe: null,
      result: 'win',
      pnl: '10.00',
      commission: '2.68',
      stop_price: null,
      target_price: null,
      pnl_basis: 'file',
    });
    expect(out.warnings).toEqual([]);
    expect(out.notices).toEqual([{ code: 'commission_in_file', gross: '10.00', commission: '2.68' }, { code: 'sl_tp_empty' }]);
  });

  it('SL / TP of 0 or empty are not set; any other level is kept', () => {
    expect(first(one({ SL: '0', TP: '' }))).toMatchObject({ stop_price: null, target_price: null });
    expect(first(one({ SL: '0.00', TP: '21550.75' }))).toMatchObject({ stop_price: null, target_price: '21550.75' });
    const set = one({ SL: '21400.25', TP: '0' });
    expect(first(set)).toMatchObject({ stop_price: '21400.25', target_price: null });
    expect(set.notices.map((n) => n.code)).toEqual(['commission_in_file']);
    expect(codes(one({ SL: '-5' }).errors)).toEqual(['bad_number(SL)']);
    expect(codes(one({ TP: 'abc' }).errors)).toEqual(['bad_number(TP)']);
  });

  it('commission: rounded half-up to cents; empty → null; negative → error', () => {
    expect(first(one({ Commissions: '2.6799999999999997' })).commission).toBe('2.68');
    expect(first(one({ Commissions: '2.675' })).commission).toBe('2.68');
    expect(first(one({ Commissions: '2.6749' })).commission).toBe('2.67');
    expect(first(one({ Commissions: '5.359999999999999' })).commission).toBe('5.36');
    expect(first(one({ Commissions: '0' })).commission).toBe('0.00');
    const none = one({ Commissions: '' });
    expect(first(none).commission).toBeNull();
    expect(none.notices).toEqual([{ code: 'sl_tp_empty' }]);
    expect(codes(one({ Commissions: '-2.68' }).errors)).toEqual(['bad_number(Commissions)']);
    expect(codes(one({ Commissions: '2,68' }).errors)).toEqual(['bad_number(Commissions)']);
  });

  it('result comes from gross PnL; commission is kept apart', () => {
    expect(first(one({ PnL: '$1', Commissions: '2.68' }))).toMatchObject({ result: 'win', pnl: '1.00', commission: '2.68' });
    expect(first(one({ PnL: '-$175' }))).toMatchObject({ result: 'loss', pnl: '-175.00' });
    expect(first(one({ PnL: '$0' }))).toMatchObject({ result: 'breakeven', pnl: '0.00' });
    expect(first(one({ PnL: '$1,250.5' })).pnl).toBe('1250.50');
  });

  it('unreadable PnL is an error, never 900', () => {
    expect(codes(one({ PnL: '+$9,00' }).errors)).toEqual(['bad_number(PnL)']);
    expect(codes(one({ PnL: '' }).errors)).toEqual(['bad_number(PnL)']);
  });

  it('Lots must be a positive number (legacy turned 0 into 1)', () => {
    expect(codes(one({ Lots: '0' }).errors)).toEqual(['bad_quantity']);
    expect(codes(one({ Lots: '-1' }).errors)).toEqual(['bad_quantity']);
    expect(codes(one({ Lots: '+1' }).errors)).toEqual(['bad_quantity']);
    expect(codes(one({ Lots: '' }).errors)).toEqual(['bad_quantity']);
    expect(codes(one({ Lots: 'one' }).errors)).toEqual(['bad_quantity']);
    expect(codes(one({ Lots: '0.000000001' }).errors)).toEqual(['bad_quantity']);
    expect(first(one({ Lots: '0.5' })).quantity).toBe('0.5');
    expect(first(one({ Lots: '3' })).quantity).toBe('3');
  });

  it('Side: BUY/SELL in any case; anything else is an error', () => {
    expect(first(one({ Side: 'sell' })).direction).toBe('short');
    expect(codes(one({ Side: 'HOLD' }).errors)).toEqual(['bad_direction']);
    expect(codes(one({ Side: '' }).errors)).toEqual(['bad_direction']);
  });

  it('Open Time: missing / unreadable / impossible', () => {
    expect(codes(one({ 'Open Time': '' }).errors)).toEqual(['missing_date']);
    expect(codes(one({ 'Open Time': '13/03/2026 25:00:00' }).errors)).toEqual(['bad_date(Open Time)']);
    expect(codes(one({ 'Open Time': '31/02/2026 10:00:00' }).errors)).toEqual(['bad_date(Open Time)']);
    expect(codes(one({ 'Open Time': '2026-03-12T14:30:00Z' }).errors)).toEqual(['bad_date(Open Time)']);
  });

  it('Close Time: empty, unreadable, before the open', () => {
    const empty = one({ 'Close Time': '', 'Close Price': '', Duration: '' });
    expect(codes(empty.warnings)).toEqual(['missing_exit']);
    expect(first(empty)).toMatchObject({ local_exit: null, exit_price: null });
    const bad = one({ 'Close Time': '12/03/2026 14:61:00' });
    expect(codes(bad.warnings)).toEqual(['bad_exit_time']);
    expect(first(bad).local_exit).toBeNull();
    const before = one({ 'Close Time': '12/03/2026 14:29:59' });
    expect(codes(before.warnings)).toEqual(['exit_before_entry']);
    expect(first(before).local_exit).toBeNull();
  });

  it('Duration: ±1 s of Close − Open passes; more is a warning; unreadable is ignored', () => {
    expect(one({ Duration: '0m 59s' }).warnings).toEqual([]);
    expect(one({ Duration: '1m 1s' }).warnings).toEqual([]);
    expect(codes(one({ Duration: '0m 58s' }).warnings)).toEqual(['duration_mismatch']);
    expect(one({ Duration: 'about a minute' }).warnings).toEqual([]);
    expect(
      one({ 'Close Time': '12/03/2026 15:32:31', Duration: '1h 2m 31s' }).warnings,
    ).toEqual([]);
  });

  it('Open Price empty or 0 is a missing price', () => {
    expect(codes(one({ 'Open Price': '' }).warnings)).toEqual(['missing_price(Open Price)']);
    expect(first(one({ 'Open Price': '0' })).entry_price).toBeNull();
    expect(codes(one({ 'Close Price': '1.123456789' }).errors)).toEqual(['bad_number(Close Price)']);
  });

  it('ticket: the full text is the ID; a prefix that is not the symbol is a warning', () => {
    expect(first(one({})).external_id).toBe('MNQM6/900000000901');
    expect(codes(one({ 'Ticket #': 'MESM6/900000000902' }).warnings)).toEqual(['ticket_symbol_mismatch']);
    expect(one({ 'Ticket #': '900000000903' }).warnings).toEqual([]);
    expect(codes(one({ 'Ticket #': '' }).errors)).toEqual(['missing_id']);
    expect(codes(one({ 'Ticket #': 'MNQM6 / 1' }).errors)).toEqual(['bad_id']);
    expect(codes(one({ Symbol: '' }).errors)).toEqual(['missing_symbol']);
  });

  it('a repeated ticket is an error pointing at the first', () => {
    const out = parse(line(), line({ PnL: '$20' }), line({ 'Ticket #': 'MNQM6/900000000902' }));
    expect(out.rows.map((r) => r.line)).toEqual([2, 4]);
    expect(out.errors).toEqual([{ line: 3, code: 'duplicate_in_file', firstLine: 2 }]);
    expect(out.notices[0]).toEqual({ code: 'commission_in_file', gross: '20.00', commission: '5.36' });
  });
});
