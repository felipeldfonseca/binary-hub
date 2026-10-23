/**
 * @jest-environment node
 *
 * Reading an unrecognised file before its columns are known (banco_dominio.md §5.3, §13): the
 * separator, the header line under a statement's title lines, the limits.
 */
import {
  MAX_COLUMNS,
  findHeader,
  headerClocks,
  headerSignature,
  readCsv,
  sniffDelimiter,
  sniffFile,
  type FieldKey,
} from '@/lib/domain/import';

describe('readCsv with another separator', () => {
  it('semicolon and tab, with the same quoting rules', () => {
    expect(readCsv('a;b;"c;d"\n1;"2\n3";4', { delimiter: ';' }).map((r) => [r.line, r.cells])).toEqual([
      [1, ['a', 'b', 'c;d']],
      [2, ['1', '2\n3', '4']],
    ]);
    expect(readCsv('a\tb\n1,5\t"x\ty"', { delimiter: '\t' }).map((r) => r.cells)).toEqual([
      ['a', 'b'],
      ['1,5', 'x\ty'],
    ]);
  });

  it('the comma stays the default', () => {
    expect(readCsv('a;b,c').map((r) => r.cells)).toEqual([['a;b', 'c']]);
  });
});

describe('the separator', () => {
  it.each([
    ['comma', 'Date,Symbol,Side,Qty\n2026-10-14 10:00,MESZ6,Buy,1\n2026-10-14 10:05,MESZ6,Sell,1', ','],
    ['semicolon with decimal commas', 'Data;Papel;C/V;Res.\n14/10/2026;WINZ26;V;88,50\n14/10/2026;WINZ26;C;-31,00\n14/10/2026;WDOX26;C;5.412,5', ';'],
    ['tab', 'Data\tPapel\tLado\n14/10/2026\tWINZ26\tV\n14/10/2026\tWINZ26\tC', '\t'],
    ['one column', 'abc\ndef', ','],
  ] as const)('%s', (_, text, d) => {
    expect(sniffDelimiter(text)).toBe(d);
  });
});

describe('the header line', () => {
  it('skips the title lines of a statement (up to 20)', () => {
    const text = ['Relatório de Performance', '', 'Conta: 123;;;', 'Data;Papel;C/V;Qtd', '14/10/2026 10:00;WINZ26;V;1', '14/10/2026 10:05;WINZ26;C;1'].join('\n');
    const s = sniffFile(text);
    expect(s).toMatchObject({ ok: true, delimiter: ';', headerSkip: 2, headerLine: 4, headers: ['data', 'papel', 'c/v', 'qtd'] });
    if (s.ok) expect(s.records.map((r) => r.line)).toEqual([5, 6]);
  });

  it('a header with one empty name, and data rows with one separator more, are still found', () => {
    expect(findHeader(readCsv('a,,c,d\n1,2,3,4,\n5,6,7,8,'))).toBe(0);
  });

  it('a model\'s separator and number of title lines are used as given', () => {
    const text = 'title\nA;B\n1;2';
    expect(sniffFile(text, { delimiter: ';', headerSkip: 1 })).toMatchObject({ ok: true, headers: ['a', 'b'], headerSkip: 1 });
  });

  it('file errors: no header in 21 records, more than 100 columns, nothing under the header, a quote never closed', () => {
    const titles = Array.from({ length: 21 }, (_, i) => `title ${i}`);
    expect(sniffFile([...titles, 'a,b,c', '1,2,3'].join('\n'))).toEqual({ ok: false, error: 'header_not_found' });
    const wide = Array.from({ length: MAX_COLUMNS + 1 }, (_, i) => `c${i}`).join(',');
    expect(sniffFile(`${wide}\n${wide}`)).toEqual({ ok: false, error: 'too_many_columns', line: 1 });
    expect(sniffFile(Array.from({ length: MAX_COLUMNS }, (_, i) => `c${i}`).join(',') + '\n1')).toMatchObject({ ok: true });
    expect(sniffFile('a,b,c')).toEqual({ ok: false, error: 'empty_file' });
    expect(sniffFile('')).toEqual({ ok: false, error: 'empty_file' });
    expect(sniffFile('a,b\n"1,2')).toEqual({ ok: false, error: 'malformed_csv', line: 2 });
  });

  it('the names a model keeps, and their signature', () => {
    const s = sniffFile('﻿"Preço";Preço;"Ação  #1"\n1;2;3');
    expect(s).toMatchObject({ ok: true, rawHeaders: ['Preço', 'Preço', 'Ação  #1'], headers: ['preco', 'preco#2', 'acao #1'] });
    if (s.ok) expect(s.sig).toBe(headerSignature(['preco', 'preco#2', 'acao #1']));
  });
});

describe('header clocks of the mapped time columns', () => {
  it('only time columns take a clock', () => {
    const columns: (FieldKey | null)[] = ['time', 'symbol', null];
    expect(headerClocks(['date(utc)', 'symbol (utc)', 'time utc'], columns)).toEqual([{ offset: '+00:00' }, null, null]);
  });
});
