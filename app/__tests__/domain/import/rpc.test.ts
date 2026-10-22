/**
 * @jest-environment node
 */
/**
 * What reaches import_preview / import_commit must pass the server's own checks (the same
 * patterns as public.import_checked_rows and import_clean_errors), so no row is refused for
 * its shape and no cast error can escape.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  EBINEX_COLUMNS,
  FILE_ERROR_CODES,
  IMPORT_ROW_KEYS,
  ROW_ERROR_CODES,
  ROW_WARNING_CODES,
  TOPONE_COLUMNS,
  buildImportArgs,
  decodeCsvBytes,
  parseImportText,
  parseMappedRecords,
  previewArgs,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  suggestColumns,
  type FieldKey,
  type ImportRow,
  type ImportFile,
  type MappedFile,
  type ParsedFile,
  type Platform,
} from '@/lib/domain/import';
import type { AccountMarket } from '@/lib/domain';

const DIR = path.join(__dirname, 'fixtures');
const SHA = 'a'.repeat(64);
const ACCOUNT = '00000000-0000-4000-8000-000000000001';

// The server's patterns
const LINE = /^\d{1,7}$/;
const EXTERNAL_ID = /^\S{1,80}$/;
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?$/;
const OFFSET = /^[+-](0\d|1[0-4]):[0-5]\d$/;
const PRICE = /^\d{1,10}(\.\d{1,8})?$/;
const MONEY = /^-?\d{1,16}(\.\d{1,2})?$/;
const MONEY_NON_NEGATIVE = /^\d{1,16}(\.\d{1,2})?$/;
const PAYOUT = /^\d{1,4}(\.\d{1,4})?$/;
const DURATION = /^\d{1,6}$/;
const TIMEFRAME = /^[A-Za-z0-9]{1,8}$/;
const CODE = /^[a-z_]{1,40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

/** Every check public.import_checked_rows makes, as a list of the ones that fail. */
function serverRejects(platform: Platform, r: ImportRow): string[] {
  const bad: string[] = [];
  const check = (name: string, ok: boolean) => {
    if (!ok) bad.push(name);
  };
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
  check('line', LINE.test(String(r.line)));
  // A mapped row may come without an ID (the database derives one); a real one never starts with «@»
  check(
    'external_id',
    r.external_id === null ? platform === 'modelo' : EXTERNAL_ID.test(r.external_id) && !(platform === 'modelo' && r.external_id.startsWith('@')),
  );
  check('symbol', r.symbol.trim().length >= 1 && Array.from(r.symbol.trim()).length <= 40);
  if (platform === 'ebinex') {
    check('asset_type', r.asset_type === 'binary_option' && (r.direction === 'call' || r.direction === 'put'));
  } else if (platform === 'topone') {
    check('asset_type', r.asset_type === 'futures' && (r.direction === 'long' || r.direction === 'short'));
  } else {
    // 'modelo': the database derives asset_type from the instrument
    check('asset_type', r.asset_type === null && (r.direction === 'long' || r.direction === 'short'));
  }
  check('pnl_basis', platform === 'modelo' ? ['file', 'prices', 'estimate'].indexOf(r.pnl_basis) >= 0 : r.pnl_basis === 'file');
  check('local_entry', STAMP.test(r.local_entry));
  check('local_exit', r.local_exit === null || STAMP.test(r.local_exit));
  check('utc_offset', r.utc_offset === null || OFFSET.test(r.utc_offset));
  check('result', ['win', 'loss', 'breakeven'].indexOf(r.result) >= 0);
  check('pnl', MONEY.test(r.pnl));
  check('entry_price', r.entry_price === null || PRICE.test(r.entry_price));
  check('exit_price', r.exit_price === null || PRICE.test(r.exit_price));
  check('quantity', PRICE.test(r.quantity) && Number(r.quantity) > 0);
  check('stake_amount', r.stake_amount === null || MONEY_NON_NEGATIVE.test(r.stake_amount));
  check('payout_percent', r.payout_percent === null || PAYOUT.test(r.payout_percent));
  check('commission', r.commission === null || MONEY_NON_NEGATIVE.test(r.commission));
  check('stop_price', r.stop_price === null || PRICE.test(r.stop_price));
  check('target_price', r.target_price === null || PRICE.test(r.target_price));
  check('duration_seconds', r.duration_seconds === null || DURATION.test(text(r.duration_seconds)!));
  check('timeframe', r.timeframe === null || TIMEFRAME.test(r.timeframe));
  return bad;
}

function args(out: ImportFile, fileTz = out.fileTzHint ?? 'UTC') {
  return buildImportArgs({
    accountId: ACCOUNT,
    platform: out.platform,
    fileName: 'export.csv',
    sha256: SHA,
    fileTz,
    outcome: out,
  });
}

function assertServerAccepts(out: ImportFile) {
  const a = args(out);
  // What actually travels is JSON
  const sent = JSON.parse(JSON.stringify(a));
  expect(sent.p_sha256).toMatch(SHA256);
  expect(Array.from(sent.p_file_name as string).length).toBeLessThanOrEqual(255);
  expect(sent.p_rows_total).toBe(out.records);
  expect(sent.p_rows_total).toBe(out.rows.length + out.errors.length);
  for (const row of sent.p_rows as ImportRow[]) {
    expect(Object.keys(row)).toEqual([...IMPORT_ROW_KEYS]);
    expect({ line: row.line, rejected: serverRejects(out.platform, row) }).toEqual({ line: row.line, rejected: [] });
  }
  for (const e of sent.p_errors as Array<Record<string, unknown>>) {
    expect(Object.keys(e)).toEqual(['line', 'code']);
    expect(String(e.line)).toMatch(LINE);
    expect(e.code).toMatch(CODE);
  }
}

describe('every fixture builds arguments the server accepts', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.csv'));
  for (const file of files) {
    const out = parseImportText(decodeCsvBytes(fs.readFileSync(path.join(DIR, file))));
    if (!out.ok) continue;
    it(file, () => assertServerAccepts(out));
  }
});

describe('edge values stay within the server’s bounds', () => {
  it('Ebinex at the limits', () => {
    const header = EBINEX_COLUMNS.join(',');
    const rows = [
      // 64-char ID, 40-char symbol, 10 integer digits + 8 decimals, 16-digit amounts
      `${'f'.repeat(64)},16/03/2026 20:10:10,${'S'.repeat(40)},M1,bull,20:11,9999999999.99999999,9999999999.99999999,` +
        '"$ 9,999,999,999,999,999.99",$ 0,"$ 9,999,999,999,999,999.99",lose,"-$9,999,999,999,999,999.99"',
      // payout just under 10000 %
      'feedface00000000000000e2,16/03/2026 20:10:10,BTC/USDT,M1,bull,20:11,1,2,$ 1,$ 0,$ 1,win,+$99.99',
      // offset at the limit, 6-digit fraction, H1 candle
      'feedface00000000000000e3,2026-03-16T20:10:10.123456-14:00,BTC/USDT,H1,bear,21:10,2,1,$ 1,$ 0,$ 1,win,0.9',
      // amounts with more decimals than cents
      'feedface00000000000000e4,16/03/2026 20:10:10,BTC/USDT,m5,bull,20:15,1,2,$ 10.005,$ 0,$ 10.005,win,9.0049',
      // refunds, tie and cancelled
      'feedface00000000000000e5,16/03/2026 20:10:10,BTC/USDT,M1,bull,20:11,5,5,$ 3,$ 3,$ 0,refunded,$3',
      'feedface00000000000000e6,16/03/2026 20:10:10,BTC/USDT,M1,bull,20:11,5,,$ 3,$ 3,$ 0,refunded,$3',
      // odd Tempo text is not sent as a timeframe
      'feedface00000000000000e7,16/03/2026 20:10:10,BTC/USDT,1 minuto,bull,20:11,1,2,$ 1,$ 0,$ 1,win,0.9',
    ];
    const out = parseImportText([header, ...rows].join('\n'));
    if (!out.ok) throw new Error(out.error);
    expect(out.errors).toEqual([]);
    expect(out.rows).toHaveLength(7);
    expect(out.rows[1].payout_percent).toBe('9999.0000');
    expect(out.rows[2].utc_offset).toBe('-14:00');
    expect(out.rows[3]).toMatchObject({ stake_amount: '10.01', pnl: '9.00' });
    expect(out.rows[6].timeframe).toBeNull();
    assertServerAccepts(out);
  });

  it('Top One at the limits', () => {
    const header = TOPONE_COLUMNS.join(',');
    const rows = [
      `MNQM6/900000000951,MNQM6,BUY,9999999999.99999999,0.00000001,12/03/2026 14:30:00,0.00000001,` +
        '12/03/2026 14:30:00,9999999999,0m 0s,"-$9,999,999,999,999,999.994",9999999999.99999999,' +
        '"9,999,999,999,999,999.994",0%',
      'MNQM6/900000000952,MNQM6,SELL,,,12/03/2026 14:30:00,,,,,$0.005,0.00000001,0.0049999,0%',
    ];
    const out = parseImportText([header, ...rows].join('\n'));
    if (!out.ok) throw new Error(out.error);
    expect(out.errors).toEqual([]);
    expect(out.rows[0]).toMatchObject({ pnl: '-9999999999999999.99', commission: '9999999999999999.99' });
    expect(out.rows[1]).toMatchObject({ pnl: '0.01', result: 'win', commission: '0.00', quantity: '0.00000001' });
    assertServerAccepts(out);
  });

  it('a value one step past a limit is a row error, not a server rejection', () => {
    const header = TOPONE_COLUMNS.join(',');
    const out = parseImportText(
      [
        header,
        'MNQM6/900000000961,MNQM6,BUY,0,0,12/03/2026 14:30:00,10000000000,,,,$1,1,1,0%',
        'MNQM6/900000000962,MNQM6,BUY,0,0,12/03/2026 14:30:00,1,,,,"$10,000,000,000,000,000",1,1,0%',
        'MNQM6/900000000963,MNQM6,BUY,0,0,12/03/2026 14:30:00,1,,,,$1,10000000000,1,0%',
        `${'M'.repeat(65)},MNQM6,BUY,0,0,12/03/2026 14:30:00,1,,,,$1,1,1,0%`,
        `MNQM6/900000000964,${'M'.repeat(41)},BUY,0,0,12/03/2026 14:30:00,1,,,,$1,1,1,0%`,
      ].join('\n'),
    );
    if (!out.ok) throw new Error(out.error);
    expect(out.rows).toEqual([]);
    expect(out.errors.map((e) => e.code)).toEqual([
      'bad_number',
      'bad_number',
      'bad_quantity',
      'bad_id',
      'missing_symbol',
    ]);
    assertServerAccepts(out);
  });
});

describe('codes', () => {
  it('every code fits the server’s pattern for error codes', () => {
    for (const code of [...ROW_ERROR_CODES, ...ROW_WARNING_CODES, ...FILE_ERROR_CODES]) expect(code).toMatch(CODE);
  });
});

describe('buildImportArgs', () => {
  const out = parseImportText(fs.readFileSync(path.join(DIR, 'ebinex_atual_erros.csv'), 'utf8'));
  if (!out.ok) throw new Error(out.error);

  it('sends rows, errors as {line, code} and the record count', () => {
    const a = args(out, 'America/Sao_Paulo');
    expect(a).toMatchObject({
      p_account: ACCOUNT,
      p_platform: 'ebinex',
      p_file_name: 'export.csv',
      p_sha256: SHA,
      p_file_tz: 'America/Sao_Paulo',
      p_rows_total: 16,
    });
    expect(a.p_rows).toHaveLength(5);
    expect(a.p_errors[2]).toEqual({ line: 6, code: 'duplicate_in_file' });
    expect(a.p_errors.map((e) => e.line)).toEqual([4, 5, 6, 7, 8, 9, 10, 13, 14, 15, 17]);
  });

  it('the preview takes the same arguments minus the file name', () => {
    const a = args(out);
    const p = previewArgs(a);
    expect(Object.keys(p).sort()).toEqual(
      ['p_account', 'p_platform', 'p_sha256', 'p_file_tz', 'p_rows', 'p_errors', 'p_rows_total'].sort(),
    );
    expect(p.p_rows).toBe(a.p_rows);
  });

  it('drops anything that is not an ImportRow key', () => {
    const extra = { ...out, rows: out.rows.map((r) => ({ ...r, notes: 'x', user_id: 'y' })) } as ParsedFile;
    for (const row of args(extra).p_rows) expect(Object.keys(row)).toEqual([...IMPORT_ROW_KEYS]);
  });

  it('cuts a long file name to 255 characters', () => {
    const a = buildImportArgs({
      accountId: ACCOUNT,
      platform: 'ebinex',
      fileName: 'ã'.repeat(300),
      sha256: SHA,
      fileTz: 'UTC',
      outcome: out,
    });
    expect(a.p_file_name).toBe('ã'.repeat(255));
  });

  it('refuses a wrong platform, hash, zone or account', () => {
    const base = { accountId: ACCOUNT, platform: 'ebinex' as Platform, fileName: 'f.csv', sha256: SHA, fileTz: 'UTC', outcome: out };
    expect(() => buildImportArgs({ ...base, platform: 'topone' })).toThrow(RangeError);
    expect(() => buildImportArgs({ ...base, sha256: 'A'.repeat(64) })).toThrow(RangeError);
    expect(() => buildImportArgs({ ...base, fileTz: '-03:00' })).toThrow(RangeError);
    expect(() => buildImportArgs({ ...base, fileTz: 'Mars/Olympus' })).toThrow(RangeError);
    expect(() => buildImportArgs({ ...base, accountId: '' })).toThrow(RangeError);
  });

  it('a reader\'s file never sends p_format: today\'s calls stay as they are', () => {
    expect(args(out)).not.toHaveProperty('p_format');
    expect(previewArgs(args(out))).not.toHaveProperty('p_format');
  });
});

/** A mapped file, read with the pre-fill from its names (and a few choices) */
function mappedFile(text: string, kind: 'trade' | 'fill', market: AccountMarket, over: Partial<Record<string, FieldKey>> = {}, net: boolean | null = null): MappedFile {
  const s = sniffFile(text);
  if (!s.ok) throw new Error(s.error);
  const suggested = suggestColumns(s.headers, kind, market);
  const columns = s.headers.map((h, i) => (h in over ? over[h] ?? null : suggested[i]));
  const dec = sniffDecimalMark(s.records, columns, s.delimiter);
  const out = parseMappedRecords({
    records: s.records,
    choices: {
      rowKind: kind,
      headers: s.headers,
      headerSkip: s.headerSkip,
      delimiter: s.delimiter,
      decimalMark: dec.decided ?? dec.fallback,
      dateOrder: sniffDateOrder(s.records, columns).decided ?? 'dmy',
      columns,
      resultIsNet: net,
      sideWords: {},
      openCloseWords: {},
    },
    market,
    templateId: '11111111-2222-4333-8444-555555555555',
  });
  if (!out.ok) throw new Error(out.error);
  return out;
}

describe('mapped files (Phase 3b): p_platform modelo and p_format', () => {
  const files: [string, MappedFile][] = [
    [
      'the board sample, net, no exit time',
      mappedFile(
        'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Nº Negócio\n01/10/2026 09:34:31;MESZ6;C;2;6.801,00;6.797,25;-39,98;2,48;83395\n01/10/2026 09:35:54;MNQZ6;V;1;25.129,50;25.124,75;8,26;1,24;49089\n13/10/2026 10:00:00;MESZ6;C;1;bad;6.797,25;-39,98;2,48;83396',
        'trade',
        'futures',
        {},
        true,
      ),
    ],
    [
      'prices only, no ID (the database keys), forex estimate',
      mappedFile('Open Time,Symbol,Side,Volume,Open Price,Close Price\n2026-10-14 08:40:12,USDJPY,BUY,0.50,151.200,151.350\n2026-10-14 08:41:12,EURUSD,SELL,1.00,1.08710,1.08745', 'trade', 'forex'),
    ],
    [
      'executions with UTC in the header',
      mappedFile('Date(UTC),Pair,Side,Price,Executed,Fee,Trade ID\n2026-10-11 00:05:12,BTCUSDT,BUY,112400.00,0.0125BTC,1.41USDT,8812001\n2026-10-11 00:21:40,BTCUSDT,SELL,112952.00,0.0125BTC,1.41USDT,8812003\n2026-10-11 00:22:00,ETHUSDT,SELL,4100,0.1ETH,0.4USDT,8812004', 'fill', 'crypto'),
    ],
  ];

  it.each(files)('%s: every row passes the server\'s patterns', (_, out) => {
    expect(out.rows.length).toBeGreaterThan(0);
    assertServerAccepts(out);
  });

  it('the bases: the file\'s result, the prices, an estimate', () => {
    expect(files[0][1].rows.map((r) => r.pnl_basis)).toEqual(['file', 'file']);
    expect(files[1][1].rows.map((r) => [r.pnl_basis, r.external_id])).toEqual([
      ['estimate', null],
      ['prices', null],
    ]);
  });

  it('commit and preview carry the format; the slices count, never the lines', () => {
    const out = files[2][1];
    const a = args(out);
    expect(a.p_platform).toBe('modelo');
    expect(a.p_format).toEqual({ sig: out.format.sig, template: '11111111-2222-4333-8444-555555555555' });
    expect(previewArgs(a).p_format).toEqual(a.p_format);
    expect(a.p_rows_total).toBe(out.rows.length + out.errors.length);
    expect(a.p_rows.map((r) => r.external_id)).toEqual(['8812001>8812003']);
    expect(a.p_errors).toEqual([{ line: 4, code: 'unbalanced_symbol' }]);
  });

  it('refuses a mapped file whose format is not a signature and a model id', () => {
    const out = files[0][1];
    const base = { accountId: ACCOUNT, platform: 'modelo' as Platform, fileName: 'f.csv', sha256: SHA, fileTz: 'UTC' };
    expect(() => buildImportArgs({ ...base, outcome: { ...out, format: { sig: 'x', template: null } } })).toThrow(RangeError);
    expect(() => buildImportArgs({ ...base, outcome: { ...out, format: { sig: out.format.sig, template: 'model-1' } } })).toThrow(RangeError);
    expect(buildImportArgs({ ...base, outcome: { ...out, format: { sig: out.format.sig, template: null } } }).p_format).toEqual({ sig: out.format.sig, template: null });
    expect(() => buildImportArgs({ ...base, platform: 'topone', outcome: out })).toThrow(RangeError);
  });
});
