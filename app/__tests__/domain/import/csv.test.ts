/**
 * @jest-environment node
 */
import { CsvError, MAX_RECORDS, decodeCsvBytes, normalizeHeader, parseImportText, readCsv } from '@/lib/domain/import';

function csvError(fn: () => unknown): CsvError {
  try {
    fn();
  } catch (e) {
    if (e instanceof CsvError) return e;
    throw e;
  }
  throw new Error('expected a CsvError');
}

describe('readCsv', () => {
  it('splits cells and records, keeping each record’s physical line', () => {
    expect(readCsv('a,b\n1,2\n3,4')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
      { line: 3, cells: ['3', '4'] },
    ]);
  });

  it('a quoted newline keeps the record on its starting line and moves the next one down', () => {
    expect(readCsv('h1,h2\n"one\ntwo",x\nnext,y')).toEqual([
      { line: 1, cells: ['h1', 'h2'] },
      { line: 2, cells: ['one\ntwo', 'x'] },
      { line: 4, cells: ['next', 'y'] },
    ]);
    expect(readCsv('h\r\n"a\r\nb\r\nc"\r\nz').map((r) => r.line)).toEqual([1, 2, 5]);
  });

  it('skips blank lines (empty or spaces) but counts them', () => {
    expect(readCsv('\n\nh\n\n  \nv\n\n')).toEqual([
      { line: 3, cells: ['h'] },
      { line: 6, cells: ['v'] },
    ]);
  });

  it('a line of only commas is a record', () => {
    expect(readCsv('a,b\n,\n')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['', ''] },
    ]);
  });

  it('a quoted empty cell is a record', () => {
    expect(readCsv('a\n""')).toEqual([
      { line: 1, cells: ['a'] },
      { line: 2, cells: [''] },
    ]);
  });

  it('reads "" as one quote and commas inside quotes as text', () => {
    expect(readCsv('"say ""hi""","$ 1,234.56"')[0].cells).toEqual(['say "hi"', '$ 1,234.56']);
  });

  it('handles CRLF, LF and CR-only line ends, mixed', () => {
    expect(readCsv('a\r\nb\rc\nd')).toEqual([
      { line: 1, cells: ['a'] },
      { line: 2, cells: ['b'] },
      { line: 3, cells: ['c'] },
      { line: 4, cells: ['d'] },
    ]);
  });

  it('strips a leading BOM', () => {
    expect(readCsv('﻿ID,Data')[0].cells).toEqual(['ID', 'Data']);
  });

  it('keeps a quote that does not open a cell as text', () => {
    expect(readCsv('ab"c,d')[0].cells).toEqual(['ab"c', 'd']);
  });

  it('an unterminated quote is malformed_csv on the line where it opened', () => {
    const e = csvError(() => readCsv('a,b\n1,2\n3,"oops\n4,5\n'));
    expect([e.code, e.line, e.message]).toEqual(['malformed_csv', 3, 'malformed_csv']);
  });

  it('stops at the first record over the limit', () => {
    const e = csvError(() => readCsv('h\n1\n2\n3\n', { maxRecords: 3 }));
    expect([e.code, e.line]).toEqual(['too_many_rows', 4]);
    expect(readCsv('h\n1\n2\n', { maxRecords: 3 })).toHaveLength(3);
  });
});

describe('record limit of a file', () => {
  const header = 'ID,Data,Ativo,Tempo,Previsão,Vela,P. ABRT,P. FECH,Valor,Estornado,Executado,Status,Resultado';
  const filler = (n: number) => header + '\n' + 'x\n'.repeat(n);

  it(`accepts ${MAX_RECORDS} data records`, () => {
    const out = parseImportText(filler(MAX_RECORDS));
    expect(out.ok && out.records).toBe(MAX_RECORDS);
  });

  it(`refuses ${MAX_RECORDS + 1} with too_many_rows`, () => {
    expect(parseImportText(filler(MAX_RECORDS + 1))).toEqual({
      ok: false,
      error: 'too_many_rows',
      line: MAX_RECORDS + 2,
    });
  });

  it('a malformed file names the line', () => {
    expect(parseImportText(`${header}\n"a,b`)).toEqual({ ok: false, error: 'malformed_csv', line: 2 });
  });

  it('a file with no records is empty', () => {
    expect(parseImportText('')).toEqual({ ok: false, error: 'empty_file' });
    expect(parseImportText('﻿\r\n\r\n')).toEqual({ ok: false, error: 'empty_file' });
  });
});

describe('decodeCsvBytes', () => {
  const utf8 = (s: string) => new TextEncoder().encode(s);

  it('reads UTF-8 and drops the BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...Array.from(utf8('Previsão'))]);
    expect(decodeCsvBytes(bytes)).toBe('Previsão');
  });

  it('accepts an ArrayBuffer', () => {
    expect(decodeCsvBytes(utf8('ID,Data').buffer as ArrayBuffer)).toBe('ID,Data');
  });

  it('falls back to windows-1252 when the bytes are not UTF-8', () => {
    // 'Previsão' in windows-1252 (ã = 0xE3), and 0x80 = '€'
    const bytes = new Uint8Array([0x50, 0x72, 0x65, 0x76, 0x69, 0x73, 0xe3, 0x6f, 0x2c, 0x80]);
    expect(decodeCsvBytes(bytes)).toBe('Previsão,€');
    expect(decodeCsvBytes(new Uint8Array([0x93, 0x41, 0x94, 0x96, 0x9f, 0xa0, 0xff]))).toBe('“A”–Ÿ ÿ');
  });

  it('decodes long windows-1252 files whole', () => {
    const bytes = new Uint8Array(20000).fill(0xe3);
    bytes[19999] = 0x80;
    const text = decodeCsvBytes(bytes);
    expect(text).toHaveLength(20000);
    expect(text.slice(0, 3)).toBe('ããã');
    expect(text[19999]).toBe('€');
  });

  it('keeps CRLF for readCsv to handle', () => {
    expect(decodeCsvBytes(utf8('a\r\nb'))).toBe('a\r\nb');
  });
});

describe('normalizeHeader', () => {
  it.each([
    ['Previsão', 'previsao'],
    ['Previsao', 'previsao'],
    ['"Ticket #"', 'ticket #'],
    ['  P.  ABRT ', 'p. abrt'],
    ['﻿ID', 'id'],
    ['Previsão', 'previsao'],
  ])('%j → %j', (input, expected) => {
    expect(normalizeHeader(input)).toBe(expected);
  });
});
