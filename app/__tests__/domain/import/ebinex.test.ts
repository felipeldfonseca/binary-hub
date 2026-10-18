/**
 * @jest-environment node
 */
/**
 * Ebinex rules on small invented files: status and sign, amounts, prices, IDs, dates, exit, duplicates.
 */
import {
  EBINEX_COLUMNS,
  parseImportText,
  type EbinexColumn,
  type ImportRow,
  type ParsedFile,
  type RowIssue,
} from '@/lib/domain/import';

const BASE: Record<EbinexColumn, string> = {
  ID: 'feedface00000000000000a1',
  Data: '16/03/2026 20:10:10',
  Ativo: 'BTC/USDT',
  Tempo: 'M1',
  Previsão: 'bull',
  Vela: '20:11',
  'P. ABRT': '"$ 64,000.00"',
  'P. FECH': '"$ 64,010.00"',
  Valor: '$ 10',
  Estornado: '$ 0',
  Executado: '$ 10',
  Status: 'win',
  Resultado: '+$9.00',
};

/** One CSV line; cells that contain a comma must be given already quoted. */
function line(over: Partial<Record<EbinexColumn, string>> = {}): string {
  const r = { ...BASE, ...over };
  return EBINEX_COLUMNS.map((c) => r[c]).join(',');
}

function parse(...lines: string[]): ParsedFile {
  const out = parseImportText([EBINEX_COLUMNS.join(','), ...lines].join('\n'));
  if (!out.ok) throw new Error(`file error ${out.error}`);
  return out;
}

const one = (over: Partial<Record<EbinexColumn, string>>) => parse(line(over));
const first = (out: ParsedFile): ImportRow => out.rows[0];
const codes = (list: RowIssue<string>[]) => list.map((i) => (i.column ? `${i.code}(${i.column})` : i.code));

describe('status, sign and amounts', () => {
  it('win: pnl and payout from Resultado and Executado', () => {
    expect(first(one({}))).toMatchObject({ result: 'win', pnl: '9.00', stake_amount: '10.00', payout_percent: '90.0000' });
  });

  it('win with no sign (old export) is positive', () => {
    expect(first(one({ Resultado: '9' }))).toMatchObject({ result: 'win', pnl: '9.00' });
  });

  it('lose: negative whatever the text says, unsigned counted in a notice', () => {
    const signed = one({ Status: 'lose', Resultado: '-$10.00', 'P. FECH': '"$ 63,990.00"' });
    expect(first(signed)).toMatchObject({ result: 'loss', pnl: '-10.00', payout_percent: null });
    expect(signed.notices).toEqual([]);
    const unsigned = one({ Status: 'LOSE', Resultado: '$ 10', 'P. FECH': '"$ 63,990.00"' });
    expect(first(unsigned).pnl).toBe('-10.00');
    expect(unsigned.notices).toEqual([{ code: 'unsigned_losses_negated', rows: 1 }]);
  });

  it('a sign that contradicts the status is an error', () => {
    expect(codes(one({ Resultado: '-$9.00' }).errors)).toEqual(['sign_mismatch(Resultado)']);
    expect(codes(one({ Status: 'lose', Resultado: '+$10.00' }).errors)).toEqual(['sign_mismatch(Resultado)']);
    expect(
      codes(one({ Status: 'refunded', Estornado: '$ 10', Executado: '$ 0', Resultado: '-$10.00' }).errors),
    ).toEqual(['sign_mismatch(Resultado)']);
  });

  it('refunded: breakeven, stake = Valor, a + sign is allowed', () => {
    const out = one({ Status: 'refunded', Estornado: '$ 10', Executado: '$ 0', Resultado: '+$10.00' });
    expect(first(out)).toMatchObject({ result: 'breakeven', pnl: '0.00', stake_amount: '10.00', payout_percent: null });
    expect(out.warnings).toEqual([]);
  });

  it('a refund that does not return the refunded amount is a warning', () => {
    const out = one({ Status: 'refunded', Estornado: '$ 10', Executado: '$ 0', Resultado: '$ 9' });
    expect(codes(out.warnings)).toEqual(['refund_amount_mismatch']);
  });

  it('partial refund on a loss is a warning too; stake is what ran', () => {
    const out = one({ Status: 'lose', Estornado: '$ 4', Executado: '$ 6', Resultado: '-$6', 'P. FECH': '"$ 63,990.00"' });
    expect(codes(out.warnings)).toEqual(['partial_refund']);
    expect(first(out)).toMatchObject({ stake_amount: '6.00', pnl: '-6.00' });
  });

  it('Brazilian notation is never read as hundreds', () => {
    expect(codes(one({ Resultado: '"+$9,00"' }).errors)).toEqual(['bad_number(Resultado)']);
    expect(codes(one({ Valor: '"$ 10,00"' }).errors)).toEqual(['bad_number(Valor)']);
  });

  it('Valor, Estornado and Executado take no sign', () => {
    expect(codes(one({ Valor: '+$10' }).errors)).toEqual(['bad_number(Valor)']);
    expect(codes(one({ Estornado: '-$0' }).errors)).toEqual(['bad_number(Estornado)']);
    expect(codes(one({ Executado: '' }).errors)).toEqual(['bad_number(Executado)']);
  });

  it('Valor 0 → zero_stake; parts that do not add up → inconsistent_amounts', () => {
    expect(codes(one({ Valor: '$ 0', Executado: '$ 0' }).errors)).toEqual(['zero_stake']);
    expect(codes(one({ Executado: '$ 5' }).errors)).toEqual(['inconsistent_amounts']);
    expect(codes(one({ Estornado: '$ 10', Executado: '$ 0' }).errors)).toEqual(['inconsistent_amounts']);
  });

  it('the parts are checked as written, before rounding to cents', () => {
    const out = one({ Valor: '$ 10.01', Estornado: '$ 5.005', Executado: '$ 5.005', Resultado: '+$4.50' });
    expect(out.errors).toEqual([]);
    expect(codes(out.warnings)).toEqual(['partial_refund']);
  });

  it('amounts beyond numeric(18,2) or a payout beyond numeric(8,4) fail alone', () => {
    expect(codes(one({ Valor: '12345678901234567', Executado: '12345678901234567' }).errors)).toEqual([
      'bad_number(Valor)',
    ]);
    expect(codes(one({ Valor: '$ 0.01', Executado: '$ 0.01', Resultado: '+$1.00' }).errors)).toEqual([
      'bad_number(Resultado)',
    ]);
  });

  it('amounts are rounded to cents before the payout is computed', () => {
    expect(first(one({ Valor: '$ 3', Executado: '$ 3', Resultado: '+$2.7' }))).toMatchObject({
      pnl: '2.70',
      payout_percent: '90.0000',
    });
    expect(first(one({ Valor: '$ 3', Executado: '$ 3', Resultado: '+$1' })).payout_percent).toBe('33.3333');
  });

  it('unknown status and direction', () => {
    expect(codes(one({ Status: 'pending' }).errors)).toEqual(['unknown_status']);
    expect(codes(one({ Previsão: 'up' }).errors)).toEqual(['bad_direction']);
    expect(first(one({ Previsão: 'BEAR', Status: 'Win', 'P. FECH': '"$ 63,990.00"' }))).toMatchObject({
      direction: 'put',
      result: 'win',
    });
  });

  it('Ebinex has no commission beyond the payout: 0.00, never null', () => {
    expect(first(one({})).commission).toBe('0.00');
  });
});

describe('prices', () => {
  it('kept as written, up to 8 decimals', () => {
    expect(first(one({ 'P. ABRT': '$ 0.5', 'P. FECH': '$ 0.50000001' }))).toMatchObject({
      entry_price: '0.5',
      exit_price: '0.50000001',
    });
  });

  it('more than 8 decimals, a sign or more than 10 integer digits → bad_number', () => {
    expect(codes(one({ 'P. ABRT': '$ 0.123456789' }).errors)).toEqual(['bad_number(P. ABRT)']);
    expect(codes(one({ 'P. FECH': '-$5' }).errors)).toEqual(['bad_number(P. FECH)']);
    expect(codes(one({ 'P. ABRT': '12345678901' }).errors)).toEqual(['bad_number(P. ABRT)']);
  });

  it('missing prices are warnings', () => {
    expect(codes(one({ 'P. ABRT': '' }).warnings)).toEqual(['missing_price(P. ABRT)']);
    const out = one({ 'P. FECH': '' });
    expect(codes(out.warnings)).toEqual(['missing_price(P. FECH)']);
    expect(first(out)).toMatchObject({ exit_price: null, local_exit: '2026-03-16T20:12:00' });
  });

  it('a result against the price move is a warning', () => {
    expect(codes(one({ 'P. FECH': '"$ 63,990.00"' }).warnings)).toEqual(['price_status_mismatch']);
    expect(codes(one({ 'P. FECH': '"$ 64,000.00"' }).warnings)).toEqual(['price_status_mismatch']);
  });
});

describe('ids, symbols and dates', () => {
  it('ID: kept as written, trimmed; spaces or more than 64 characters → bad_id', () => {
    expect(first(one({ ID: '  FeedFace00000000000000A1 ' })).external_id).toBe('FeedFace00000000000000A1');
    expect(codes(one({ ID: '"feedface 01"' }).errors)).toEqual(['bad_id']);
    expect(codes(one({ ID: 'f'.repeat(65) }).errors)).toEqual(['bad_id']);
    expect(first(one({ ID: 'f'.repeat(64) })).external_id).toHaveLength(64);
    expect(codes(one({ ID: '' }).errors)).toEqual(['missing_id']);
  });

  it('Ativo: 1 to 40 characters', () => {
    expect(codes(one({ Ativo: 'X'.repeat(41) }).errors)).toEqual(['missing_symbol']);
    expect(first(one({ Ativo: 'X'.repeat(40) })).symbol).toHaveLength(40);
  });

  it('calendar-invalid dates are errors, never rolled over', () => {
    expect(codes(one({ Data: '31/02/2026 20:00:00' }).errors)).toEqual(['bad_date(Data)']);
    expect(codes(one({ Data: '29/02/2026 20:00:00' }).errors)).toEqual(['bad_date(Data)']);
    expect(codes(one({ Data: '16/03/2026 24:00:00' }).errors)).toEqual(['bad_date(Data)']);
    expect(codes(one({ Data: '' }).errors)).toEqual(['missing_date']);
  });

  it('a file mixing offset and no-offset rows keeps each row’s own', () => {
    const out = parse(
      line(),
      line({ ID: 'feedface00000000000000a2', Data: '2025-08-12T23:41:57.318Z', Vela: '20:42' }),
    );
    expect(out.variant).toBe('ebinex_mixed');
    expect(out.needsFileTz).toBe(true);
    expect(out.rows.map((r) => r.utc_offset)).toEqual([null, '+00:00']);
    expect(out.notices).toEqual([{ code: 'file_has_offset', offsets: ['+00:00'], rows: 1 }]);
  });
});

describe('exit time', () => {
  it('Vela across midnight', () => {
    expect(first(one({ Data: '15/03/2026 23:59:41', Vela: '00:00' })).local_exit).toBe('2026-03-16T00:01:00');
  });

  it('Vela across the hour', () => {
    expect(first(one({ Data: '15/03/2026 20:59:05', Vela: '21:00' })).local_exit).toBe('2026-03-15T21:01:00');
  });

  it('Vela an hour off on the same clock → warning, no exit', () => {
    const out = one({ Data: '15/03/2026 20:14:52', Vela: '21:15' });
    expect(codes(out.warnings)).toEqual(['vela_mismatch(Vela)']);
    expect(first(out).local_exit).toBeNull();
  });

  it('Tempo unreadable or over an hour → no exit, no duration; odd text is not sent as timeframe', () => {
    const h4 = one({ Tempo: 'H4' });
    expect(codes(h4.warnings)).toEqual(['exit_unknown(Tempo)']);
    expect(first(h4)).toMatchObject({ timeframe: 'H4', duration_seconds: null, local_exit: null });
    expect(first(one({ Tempo: '"1 min"' }))).toMatchObject({ timeframe: null, duration_seconds: null });
    expect(first(one({ Tempo: '' }))).toMatchObject({ timeframe: null, duration_seconds: null });
  });

  it('a cancelled refund has no exit and no warning', () => {
    const out = one({ Status: 'refunded', Estornado: '$ 10', Executado: '$ 0', Resultado: '$10.00', 'P. FECH': '', Vela: 'xx' });
    expect(out.warnings).toEqual([]);
    expect(first(out)).toMatchObject({ local_exit: null, exit_price: null, duration_seconds: 60 });
    expect(out.notices).toEqual([{ code: 'refunds_as_breakeven', rows: 1, withoutClose: 1 }]);
  });
});

describe('duplicates and line numbers', () => {
  it('the first valid occurrence wins; later ones point at it and lose their warnings', () => {
    const out = parse(
      line({ Data: '31/02/2026 20:00:00' }), // L2: invalid, does not count as the first
      line(), // L3: kept
      line({ 'P. FECH': '' }), // L4: duplicate (its missing_price warning is dropped)
      line({ Status: 'refunded', Estornado: '$ 10', Executado: '$ 0', Resultado: '$10' }), // L5: duplicate
    );
    expect(out.rows.map((r) => r.line)).toEqual([3]);
    expect(out.errors).toEqual([
      { line: 2, code: 'bad_date', column: 'Data' },
      { line: 4, code: 'duplicate_in_file', firstLine: 3 },
      { line: 5, code: 'duplicate_in_file', firstLine: 3 },
    ]);
    expect(out.warnings).toEqual([]);
    expect(out.notices).toEqual([]);
    expect(out.records).toBe(4);
  });

  it('IDs differing only in case are different trades', () => {
    expect(parse(line({ ID: 'feedface00000000000000aa' }), line({ ID: 'FEEDFACE00000000000000AA' })).rows).toHaveLength(2);
  });

  it('lines are physical: leading blank lines, blank lines between rows, quoted newlines', () => {
    const text = [
      '',
      '',
      EBINEX_COLUMNS.join(','), // L3
      line({ ID: 'feedface00000000000000b1' }), // L4
      '', // L5
      line({ ID: 'feedface00000000000000b2', Ativo: '"BTC\n/USDT"' }), // L6–L7: control character in Ativo
      line({ ID: 'feedface00000000000000b3', Status: 'pending' }), // L8
      '   ', // L9
      line({ ID: 'feedface00000000000000b4' }), // L10
    ].join('\r\n');
    const out = parseImportText(text);
    if (!out.ok) throw new Error(out.error);
    expect(out.rows.map((r) => r.line)).toEqual([4, 10]);
    expect(out.errors).toEqual([
      { line: 6, code: 'missing_symbol' },
      { line: 8, code: 'unknown_status' },
    ]);
    expect(out.records).toBe(4);
  });

  it('a row with too few or too many cells is column_count', () => {
    const out = parse(line() + ',extra', 'feedface00000000000000c1,16/03/2026 20:10:10');
    expect(out.errors).toEqual([
      { line: 2, code: 'column_count' },
      { line: 3, code: 'column_count' },
    ]);
  });
});
