/**
 * @jest-environment node
 *
 * The golden test of formatos.md §1: the Top One header mapped by hand («Ticket #» → ID, «Open Time»
 * → Entrada, …, «Duration» and «Gain» ignored) reads the invented Top One fixtures into the same
 * rows as the built-in reader, except what a mapped row leaves to the database (asset_type). The
 * built-in reader keeps winning on detection (routeFile), so a Top One file never reaches a model.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  TOPONE_COLUMNS,
  decodeCsvBytes,
  parseImportText,
  parseMappedRecords,
  routeFile,
  sniffDateOrder,
  sniffDecimalMark,
  sniffFile,
  suggestColumns,
  type FieldKey,
  type MappedFile,
  type ParsedFile,
  type TopOneColumn,
} from '@/lib/domain/import';

const DIR = path.join(__dirname, '../fixtures');

const BY_HAND: Record<TopOneColumn, FieldKey | null> = {
  'Ticket #': 'trade_id',
  Symbol: 'symbol',
  Side: 'side',
  SL: 'stop',
  TP: 'target',
  'Open Time': 'entry_time',
  'Open Price': 'entry_price',
  'Close Time': 'exit_time',
  'Close Price': 'exit_price',
  Duration: null,
  PnL: 'pnl',
  Lots: 'quantity',
  Commissions: 'commission',
  Gain: null,
};

function both(name: string): { reader: ParsedFile; mapped: MappedFile } {
  const text = decodeCsvBytes(fs.readFileSync(path.join(DIR, `${name}.csv`)));
  const reader = parseImportText(text);
  if (!reader.ok) throw new Error(reader.error);
  const s = sniffFile(text);
  if (!s.ok) throw new Error(s.error);
  // The file's own names, in its order: «"Ticket #"» is «ticket #» after normalisation
  const columns = s.rawHeaders.map((h) => BY_HAND[TOPONE_COLUMNS.find((c) => c === h.replace(/"/g, '').trim()) as TopOneColumn] ?? null);
  const dec = sniffDecimalMark(s.records, columns, s.delimiter);
  const dates = sniffDateOrder(s.records, columns);
  expect(dec.decided).toBe('point');
  const mapped = parseMappedRecords({
    records: s.records,
    choices: {
      rowKind: 'trade',
      headers: s.headers,
      headerSkip: s.headerSkip,
      delimiter: s.delimiter,
      decimalMark: 'point',
      dateOrder: dates.decided ?? 'dmy',
      columns,
      // Top One's PnL is gross; Commissions apart
      resultIsNet: false,
      sideWords: {},
      openCloseWords: {},
    },
    market: 'futures',
  });
  if (!mapped.ok) throw new Error(mapped.error);
  return { reader, mapped };
}

describe.each(['topone_ok', 'topone_erros', 'det_topone_sem_aspas'])('%s mapped by hand = the Top One reader', (name) => {
  const { reader, mapped } = both(name);

  it('the same rows, key by key (asset_type aside: the database derives it, futures)', () => {
    expect(mapped.rows.length).toBe(reader.rows.length);
    expect(mapped.rows).toEqual(reader.rows.map((r) => ({ ...r, asset_type: null })));
  });

  it('the same row errors, by line and code', () => {
    expect(mapped.errors.map((e) => [e.line, e.code])).toEqual(reader.errors.map((e) => [e.line, e.code]));
    expect(mapped.records).toBe(reader.records);
  });

  it('the same notices of offsets and commissions, and the same zone need', () => {
    expect(mapped.notices.find((n) => n.code === 'commission_in_file')).toEqual(reader.notices.find((n) => n.code === 'commission_in_file'));
    expect(mapped.needsFileTz).toBe(reader.needsFileTz);
  });
});

describe('the Top One header', () => {
  it('is a reader\'s file: routed to the reader, never to a model, in any account', () => {
    const header = TOPONE_COLUMNS.map((c) => `"${c}"`);
    for (const m of ['futures', 'forex', 'binary'] as const) expect(routeFile(header, m)).toBe('reader');
  });

  it('pre-fills «mapa» like the hand mapping, «Duration» and «Gain» left to the user', () => {
    const headers = TOPONE_COLUMNS.map((c) => c.toLowerCase());
    expect(suggestColumns(headers, 'trade', 'futures')).toEqual(TOPONE_COLUMNS.map((c) => BY_HAND[c]));
  });
});
