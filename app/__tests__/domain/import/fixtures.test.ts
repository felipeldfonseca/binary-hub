/**
 * @jest-environment node
 */
/**
 * The synthetic fixtures end to end (bytes → rows), with the expected results.
 * "L" is the physical line in the file, header = 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tradingDay, utcToLocal } from '@/lib/domain';
import {
  decodeCsvBytes,
  normalizeHeader,
  parseImportText,
  previewInstant,
  readCsv,
  type ImportRow,
  type ParsedFile,
  type ParseOutcome,
  type RowIssue,
} from '@/lib/domain/import';

const DIR = path.join(__dirname, 'fixtures');
const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

function load(name: string): ParseOutcome {
  return parseImportText(decodeCsvBytes(fs.readFileSync(path.join(DIR, `${name}.csv`))));
}

function parsed(name: string): ParsedFile {
  const out = load(name);
  if (!out.ok) throw new Error(`${name} did not parse: ${out.error}`);
  return out;
}

function row(out: ParsedFile, line: number): ImportRow {
  const r = out.rows.find((x) => x.line === line);
  if (!r) throw new Error(`no row at line ${line}`);
  return r;
}

/** Issues as compact strings: 'L4 bad_date(Data)', 'L6 duplicate_in_file@2'. */
function issues(list: RowIssue<string>[]): string[] {
  return list.map(
    (i) => `L${i.line} ${i.code}${i.column ? `(${i.column})` : ''}${i.firstLine ? `@${i.firstLine}` : ''}`,
  );
}

const instant = (r: Pick<ImportRow, 'local_entry' | 'utc_offset'>, tz: string) =>
  previewInstant(r, tz).instant.toISOString();

describe('ebinex_atual_ok: current format, valid rows', () => {
  const out = parsed('ebinex_atual_ok');

  it('has 12 rows, no errors, one warning and the refunds notice', () => {
    expect(out).toMatchObject({
      platform: 'ebinex',
      variant: 'ebinex_br',
      market: 'binary',
      records: 12,
      needsFileTz: true,
      fileTzHint: SP,
    });
    expect(out.rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(out.errors).toEqual([]);
    expect(issues(out.warnings)).toEqual(['L12 partial_refund']);
    expect(out.notices).toEqual([{ code: 'refunds_as_breakeven', rows: 2, withoutClose: 1 }]);
  });

  it('L2: win, payout 90, exit = Vela opening + one candle; São Paulo instant 3 h ahead', () => {
    expect(row(out, 2)).toEqual({
      line: 2,
      external_id: 'feedface0000000000000001',
      symbol: 'BTC/USDT',
      asset_type: 'binary_option',
      direction: 'call',
      local_entry: '2026-03-15T20:14:52',
      local_exit: '2026-03-15T20:16:00',
      utc_offset: null,
      entry_price: '64210.55',
      exit_price: '64233.10',
      quantity: '1',
      stake_amount: '10.00',
      payout_percent: '90.0000',
      duration_seconds: 60,
      timeframe: 'M1',
      result: 'win',
      pnl: '9.00',
      commission: '0.00',
      stop_price: null,
      target_price: null,
      pnl_basis: 'file',
    });
    expect(instant(row(out, 2), SP)).toBe('2026-03-15T23:14:52.000Z');
  });

  it('L3: bear win at payout 96', () => {
    expect(row(out, 3)).toMatchObject({ direction: 'put', result: 'win', pnl: '24.00', payout_percent: '96.0000' });
  });

  it('L4: a loss is negative and has no payout', () => {
    expect(row(out, 4)).toMatchObject({ result: 'loss', pnl: '-20.00', stake_amount: '20.00', payout_percent: null });
  });

  it('L5: refunded tie is breakeven with the exit computed', () => {
    expect(row(out, 5)).toMatchObject({
      result: 'breakeven',
      pnl: '0.00',
      stake_amount: '10.00',
      payout_percent: null,
      entry_price: '64200.00',
      exit_price: '64200.00',
      local_exit: '2026-03-15T21:04:00',
    });
  });

  it('L6: refunded without P. FECH (cancelled) has no exit, but keeps its duration', () => {
    expect(row(out, 6)).toMatchObject({
      result: 'breakeven',
      pnl: '0.00',
      stake_amount: '15.00',
      entry_price: '142.37',
      exit_price: null,
      local_exit: null,
      duration_seconds: 60,
    });
  });

  it('L7: Vela 00:00 after 23:59:41 ends the next day; the trading day stays the 15th', () => {
    const r = row(out, 7);
    expect(r.local_exit).toBe('2026-03-16T00:01:00');
    const at = previewInstant(r, SP).instant;
    expect(tradingDay(at, SP)).toBe('2026-03-15');
    expect(at.toISOString().slice(0, 10)).toBe('2026-03-16');
  });

  it('L8: 21:40:05 São Paulo is the next UTC day; 4-decimal prices kept', () => {
    const r = row(out, 8);
    expect(instant(r, SP)).toBe('2026-03-16T00:40:05.000Z');
    expect(tradingDay(previewInstant(r, SP).instant, SP)).toBe('2026-03-15');
    expect([r.entry_price, r.exit_price]).toEqual(['0.5123', '0.5101']);
  });

  it('L9: 8-decimal prices with thousands separators stay exact', () => {
    expect([row(out, 9).entry_price, row(out, 9).exit_price]).toEqual(['104250.12345678', '104251.00000001']);
  });

  it('L10: thousands in every amount; integer prices', () => {
    expect(row(out, 10)).toMatchObject({
      pnl: '1248.00',
      stake_amount: '1300.00',
      payout_percent: '96.0000',
      entry_price: '1234',
      exit_price: '1233',
    });
  });

  it('L11: M5 lasts 300 s and ends 5 min after Vela', () => {
    expect(row(out, 11)).toMatchObject({ timeframe: 'M5', duration_seconds: 300, local_exit: '2026-03-16T20:50:00' });
  });

  it('L12: partial refund stakes only what ran', () => {
    expect(row(out, 12)).toMatchObject({ stake_amount: '5.00', payout_percent: '90.0000', pnl: '4.50' });
  });

  it('L13: a wall clock São Paulo skipped (4 Nov 2018) parses; the preview flags it', () => {
    const r = row(out, 13);
    expect(r.local_entry).toBe('2018-11-04T00:30:15');
    expect(previewInstant(r, SP).kind).toBe('skipped');
    expect(instant(r, SP)).toBe('2018-11-04T03:30:15.000Z');
  });
});

describe('ebinex_atual_erros: one row per problem', () => {
  const out = parsed('ebinex_atual_erros');

  it('counts records (blank lines skipped), rows, errors and warnings', () => {
    expect(out.records).toBe(16);
    expect(out.rows.map((r) => r.line)).toEqual([2, 11, 12, 16, 18]);
    expect(out.errors).toHaveLength(11);
    expect(out.warnings).toHaveLength(4);
    expect(out.notices).toEqual([]);
  });

  it('reports each error on its physical line, with no values', () => {
    expect(issues(out.errors)).toEqual([
      'L4 bad_date(Data)',
      'L5 missing_id',
      'L6 duplicate_in_file@2',
      'L7 unknown_status',
      'L8 bad_direction',
      'L9 sign_mismatch(Resultado)',
      'L10 inconsistent_amounts',
      'L13 column_count',
      'L14 zero_stake',
      'L15 missing_symbol',
      'L17 bad_number(Resultado)',
    ]);
    for (const e of [...out.errors, ...out.warnings]) {
      for (const key of Object.keys(e)) expect(['line', 'code', 'column', 'firstLine']).toContain(key);
    }
  });

  it('imports the rows with warnings', () => {
    expect(issues(out.warnings)).toEqual([
      'L11 vela_mismatch(Vela)',
      'L12 price_status_mismatch',
      'L16 loss_not_full_stake',
      'L18 exit_unknown(Tempo)',
    ]);
    expect(row(out, 11).local_exit).toBeNull();
    expect(row(out, 16)).toMatchObject({ result: 'loss', pnl: '-9.00', stake_amount: '10.00' });
    expect(row(out, 18)).toMatchObject({ timeframe: 'X9', duration_seconds: null, local_exit: null });
  });
});

describe('ebinex_iso: old format, CRLF, upper case, unsigned amounts', () => {
  const out = parsed('ebinex_iso');

  it('keeps every stated offset, needs no file zone, negates unsigned losses', () => {
    expect(out).toMatchObject({ variant: 'ebinex_iso', records: 7, needsFileTz: false });
    expect(out.rows).toHaveLength(7);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect(out.notices).toEqual([
      { code: 'file_has_offset', offsets: ['+00:00', '-03:00'], rows: 7 },
      { code: 'unsigned_losses_negated', rows: 2 },
    ]);
  });

  it('L2: local clock as written plus the offset; exit on the UTC clock', () => {
    expect(row(out, 2)).toMatchObject({
      local_entry: '2025-08-12T23:41:57.318',
      utc_offset: '+00:00',
      direction: 'put',
      result: 'win',
      pnl: '9.20',
      payout_percent: '92.0000',
      local_exit: '2025-08-12T23:43:00',
    });
  });

  it('L3 and L8: unsigned LOSE amounts become negative', () => {
    expect(row(out, 3)).toMatchObject({ result: 'loss', pnl: '-10.00' });
    expect(row(out, 8)).toMatchObject({ result: 'loss', pnl: '-20.00', local_entry: '2025-08-12T23:35:00.000' });
  });

  it('L4: the offset row is never re-zoned; its São Paulo trading day is the 12th', () => {
    const r = row(out, 4);
    expect(instant(r, SP)).toBe('2025-08-13T00:05:12.004Z');
    expect(instant(r, 'UTC')).toBe('2025-08-13T00:05:12.004Z');
    expect(tradingDay(previewInstant(r, SP).instant, SP)).toBe('2025-08-12');
  });

  it('L5: Z becomes +00:00', () => {
    expect(row(out, 5)).toMatchObject({ utc_offset: '+00:00', local_entry: '2025-08-13T00:20:40.500' });
  });

  it('L6: a -03:00 offset is kept with the local clock as written', () => {
    const r = row(out, 6);
    expect(r).toMatchObject({
      utc_offset: '-03:00',
      local_entry: '2025-08-12T20:30:10.250',
      local_exit: '2025-08-12T20:32:00',
    });
    expect(instant(r, SP)).toBe('2025-08-12T23:30:10.250Z');
  });

  it('L7: the minute-of-hour rule crosses the hour and the day', () => {
    expect(row(out, 7).local_exit).toBe('2025-08-13T00:01:00');
  });
});

describe('ebinex_iso_sem_offset', () => {
  it('reads an ISO time with no offset like the DD/MM format', () => {
    const out = parsed('ebinex_iso_sem_offset');
    expect(out).toMatchObject({ variant: 'ebinex_br', needsFileTz: true });
    expect(out.rows[0]).toMatchObject({
      line: 2,
      local_entry: '2025-08-12T23:30:00',
      utc_offset: null,
      local_exit: '2025-08-12T23:32:00',
    });
    expect(instant(out.rows[0], SP)).toBe('2025-08-13T02:30:00.000Z');
  });
});

describe('topone_ok: every cell quoted', () => {
  const out = parsed('topone_ok');

  it('has 7 rows, no warnings, and the gross/commission totals', () => {
    expect(out).toMatchObject({ platform: 'topone', variant: 'topone', market: 'futures', records: 7, fileTzHint: 'UTC' });
    expect(out.rows).toHaveLength(7);
    expect(out.errors).toEqual([]);
    expect(out.warnings).toEqual([]);
    expect(out.notices).toEqual([{ code: 'commission_in_file', gross: '1240.75', commission: '20.00' }]);
  });

  it('L2: float-noise commission rounds to cents; 14:32:10 UTC is 09:32 in New York (EST)', () => {
    const r = row(out, 2);
    expect(r).toMatchObject({ direction: 'short', result: 'win', pnl: '15.00', commission: '2.68', quantity: '1' });
    const ny = utcToLocal(previewInstant(r, 'UTC').instant, NY);
    expect([ny.hour, ny.minute]).toEqual([9, 32]);
  });

  it('L3: two lots; 13:35:02 UTC is 09:35 in New York (EDT, after 8 Mar)', () => {
    const r = row(out, 3);
    expect(r).toMatchObject({ direction: 'long', result: 'loss', pnl: '-175.00', quantity: '2', commission: '5.36' });
    const ny = utcToLocal(previewInstant(r, 'UTC').instant, NY);
    expect([ny.hour, ny.minute]).toEqual([9, 35]);
  });

  it('L4: breakeven with SL and TP set', () => {
    expect(row(out, 4)).toEqual({
      line: 4,
      external_id: 'MNQM6/900000000003',
      symbol: 'MNQM6',
      asset_type: 'futures',
      direction: 'long',
      local_entry: '2026-03-10T14:05:00',
      local_exit: '2026-03-10T14:05:59',
      utc_offset: null,
      entry_price: '21450',
      exit_price: '21450',
      quantity: '1',
      stake_amount: null,
      payout_percent: null,
      duration_seconds: null,
      timeframe: null,
      result: 'breakeven',
      pnl: '0.00',
      commission: '2.68',
      stop_price: '21400.25',
      target_price: '21550.75',
      pnl_basis: 'file',
    });
  });

  it('L5–L7: hour durations and 1 s truncation pass; grouped PnL', () => {
    expect(row(out, 5).local_exit).toBe('2026-03-11T15:12:31');
    expect(row(out, 6).local_exit).toBe('2026-03-12T14:25:10');
    expect(row(out, 7).pnl).toBe('1250.50');
  });

  it('L8: second contract', () => {
    expect(row(out, 8)).toMatchObject({ symbol: 'MESM6', commission: '1.24', pnl: '26.25', stop_price: null });
  });
});

describe('topone_erros', () => {
  const out = parsed('topone_erros');

  it('counts records, rows, errors and warnings', () => {
    expect(out.records).toBe(11);
    expect(out.rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 11, 12]);
    expect(issues(out.errors)).toEqual([
      'L6 bad_direction',
      'L7 missing_id',
      'L8 bad_quantity',
      'L9 duplicate_in_file@2',
      'L10 bad_date(Open Time)',
    ]);
    expect(issues(out.warnings)).toEqual([
      'L2 missing_exit',
      'L3 exit_before_entry',
      'L4 ticket_symbol_mismatch',
      'L11 duration_mismatch',
    ]);
    expect(out.notices).toEqual([
      { code: 'commission_in_file', gross: '70.00', commission: '13.40' },
      { code: 'sl_tp_empty' },
    ]);
  });

  it('L2: no close and no commission → exit and commission null', () => {
    expect(row(out, 2)).toMatchObject({ local_exit: null, exit_price: null, commission: null, result: 'breakeven' });
  });

  it('L3: a close before the open is dropped', () => {
    expect(row(out, 3)).toMatchObject({ local_exit: null, exit_price: '21490' });
  });

  it('L5: side in mixed case; L12: unquoted row', () => {
    expect(row(out, 5).direction).toBe('long');
    expect(row(out, 12)).toMatchObject({ external_id: 'MNQM6/900000000109', direction: 'short', pnl: '10.00' });
  });
});

describe('detection', () => {
  it('Previsao without the accent is Ebinex', () => {
    expect(parsed('det_ebinex_sem_acento').platform).toBe('ebinex');
  });

  it('matches Ebinex columns by name when Data comes before ID', () => {
    const out = parsed('det_ebinex_reordenado');
    expect(out.rows[0]).toMatchObject({
      external_id: 'feedface0000000000000402',
      local_entry: '2026-03-16T20:10:10',
      entry_price: '64000.00',
    });
  });

  it('a missing Vela column is a file error naming it', () => {
    expect(load('det_ebinex_sem_vela')).toEqual({
      ok: false,
      error: 'missing_columns',
      platform: 'ebinex',
      missingColumns: ['Vela'],
    });
  });

  it('Top One without quotes', () => {
    expect(parsed('det_topone_sem_aspas')).toMatchObject({ platform: 'topone', records: 1 });
  });

  it('another CSV is an unknown format', () => {
    expect(load('det_desconhecido')).toEqual({ ok: false, error: 'unknown_format' });
  });

  it('a header with no data is an empty file', () => {
    expect(load('det_vazio')).toEqual({ ok: false, error: 'empty_file', platform: 'ebinex' });
  });

  it('windows-1252 bytes are decoded by the fallback', () => {
    const out = parsed('det_latin1');
    expect(out.platform).toBe('ebinex');
    expect(out.rows).toHaveLength(1);
  });
});

describe('fixtures hold only invented IDs', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.csv'));
  const SYNTHETIC = /^feedface[0-9a-f]{16}$|^[A-Z0-9]+\/9000000\d{5}$/;

  it.each(files)('%s', (file) => {
    const records = readCsv(decodeCsvBytes(fs.readFileSync(path.join(DIR, file))));
    const header = records[0].cells.map(normalizeHeader);
    const col = header.findIndex((h) => h === 'id' || h === 'ticket #');
    if (col < 0) {
      // Only the unknown-format fixture has no ID column
      expect(file).toBe('det_desconhecido.csv');
      return;
    }
    for (const r of records.slice(1)) {
      const id = (r.cells[col] ?? '').trim();
      if (id) expect(id).toMatch(SYNTHETIC);
    }
  });
});
