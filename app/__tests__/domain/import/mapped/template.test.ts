/**
 * @jest-environment node
 *
 * Saved models (banco_dominio.md §4, R13): the names a model keeps, the header signature (the SQL's
 * sha256 over the code-point-sorted names), the JSON v1 payload of import_template_save and a row
 * read back, the browser's twin of its checks, and the matching of a file to the user's models.
 */
import { createHash } from 'node:crypto';
import {
  checkTemplate,
  columnsFromTemplate,
  compareCodePoints,
  headerSignature,
  matchTemplate,
  normaliseHeaders,
  sha256Text,
  templateFromRow,
  templateMisfits,
  templatePayload,
  utf8Bytes,
  type MappingChoices,
  type Template,
  type TemplatePayloadV1,
} from '@/lib/domain/import';

const nodeSha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('SHA-256 of a text', () => {
  it.each(['', 'abc', 'preco\npreco#2', 'Ação «Nº» ﬁ 𝒜 😀', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000)])('%j as node:crypto', (s) => {
    expect(sha256Text(s)).toBe(nodeSha(s));
  });

  it('UTF-8 bytes as TextEncoder writes them, a lone surrogate as U+FFFD', () => {
    for (const s of ['a', 'é', '€', '𝒜', '\ud835', 'x\udc00y']) expect(utf8Bytes(s)).toEqual(Array.from(new TextEncoder().encode(s)));
  });
});

describe('the names and the signature', () => {
  it('normalised, at most 80 characters, repeats numbered in file order', () => {
    expect(normaliseHeaders(['﻿"Preço"', 'Preço', 'PREÇO', ' Res.  Líq. ', ''])).toEqual(['preco', 'preco#2', 'preco#3', 'res. liq.', '']);
    // A suffix never makes a name equal to another column's
    expect(normaliseHeaders(['a', 'a', 'a#2'])).toEqual(['a', 'a#3', 'a#2']);
    const long = 'n'.repeat(90);
    expect(normaliseHeaders([long, long]).map((h) => Array.from(h).length)).toEqual([80, 80]);
    expect(normaliseHeaders([long, long])[1].endsWith('#2')).toBe(true);
  });

  it('sorted by code point, as collate "C" over UTF-8 (not by UTF-16 unit)', () => {
    // U+FF5E sorts before U+1D49C by code point; by UTF-16 unit (0xD835) it would come after
    expect(['𝒜', '～'].sort(compareCodePoints)).toEqual(['～', '𝒜']);
    expect(['𝒜', '～'].sort()).toEqual(['𝒜', '～']);
    expect(['b', 'a', 'ab', ''].sort(compareCodePoints)).toEqual(['', 'a', 'ab', 'b']);
  });

  it('= sha256 of the sorted names joined by line feeds; order-free', () => {
    const h = ['papel', 'data/hora', 'c/v', '', '～', '𝒜'];
    expect(headerSignature(h)).toBe(nodeSha(['', 'c/v', 'data/hora', 'papel', '～', '𝒜'].join('\n')));
    expect(headerSignature([...h].reverse())).toBe(headerSignature(h));
    expect(headerSignature(['a', 'b'])).not.toBe(headerSignature(['a', 'b', 'c']));
  });
});

const CHOICES: MappingChoices = {
  rowKind: 'trade',
  headers: ['data/hora', 'papel', 'c/v', 'qtd', 'pr. entrada', 'pr. saida', 'res. liq.', 'corretagem', 'emolumentos', 'taxa', 'nº negocio'],
  headerSkip: 0,
  delimiter: ';',
  decimalMark: 'comma',
  dateOrder: 'dmy',
  columns: ['entry_time', 'symbol', 'side', 'quantity', 'entry_price', 'exit_price', 'pnl', 'commission', 'fee', 'fee', 'trade_id'],
  resultIsNet: true,
  sideWords: { x: 'buy' },
  openCloseWords: {},
};

describe('the payload of import_template_save (JSON v1)', () => {
  const payload = templatePayload({ ...CHOICES, name: ' Profit ', accountRoutes: { [sha256Text('APX-0001')]: 'acc-1' }, tzHint: 'America/Sao_Paulo' });

  it('carries the choices by header name, never a cell value', () => {
    expect(payload).toEqual<TemplatePayloadV1>({
      v: 1,
      name: 'Profit',
      headers: CHOICES.headers,
      header_skip: 0,
      delimiter: 'semicolon',
      decimal_mark: 'comma',
      date_order: 'dmy',
      row_kind: 'trade',
      columns: {
        'data/hora': 'entry_time',
        papel: 'symbol',
        'c/v': 'side',
        qtd: 'quantity',
        'pr. entrada': 'entry_price',
        'pr. saida': 'exit_price',
        'res. liq.': 'pnl',
        corretagem: 'commission',
        emolumentos: 'fee',
        taxa: 'fee',
        'nº negocio': 'trade_id',
      },
      result_is_net: true,
      side_words: { x: 'buy' },
      open_close_words: {},
      account_routes: { [sha256Text('APX-0001')]: 'acc-1' },
      tz_hint: 'America/Sao_Paulo',
    });
    expect(checkTemplate(payload)).toBeNull();
  });

  it('reads back as the same model (a row of import_templates)', () => {
    const row = { ...payload, id: '11111111-2222-4333-8444-555555555555', header_sig: headerSignature(payload.headers), last_used_at: '2026-10-22T10:00:00Z', created_at: 'x' };
    const t = templateFromRow(row) as Template;
    expect(t).toMatchObject({ ...CHOICES, id: row.id, name: 'Profit', sig: row.header_sig, tzHint: 'America/Sao_Paulo', lastUsedAt: '2026-10-22T10:00:00Z' });
    expect(templatePayload(t)).toEqual(payload);
    expect(templateFromRow({ ...row, row_kind: 'other' })).toBeNull();
    expect(templateFromRow({ ...row, delimiter: '|' })).toBeNull();
    expect(templateFromRow(null)).toBeNull();
    // An unknown field name in the stored columns reads as an ignored column
    expect(templateFromRow({ ...row, columns: { ...row.columns, papel: 'stake' } })?.columns[1]).toBeNull();
  });

  it.each([
    ['name', { name: '  ' }],
    ['name', { name: 'n'.repeat(61) }],
    ['headers', { headers: ['only'] }],
    ['headers', { headers: ['Papel', 'qtd'] }],
    ['headers', { headers: ['a', 'a'] }],
    ['columns', { columns: { nope: 'symbol' } }],
    ['columns', { columns: { ...payload.columns, taxa: 'pnl' } }],
    ['columns', { columns: { ...payload.columns, papel: 'price' } }],
    ['columns', { columns: { 'data/hora': 'entry_time', papel: 'symbol' } }],
    ['side_words', { side_words: { x: 'long' } }],
    ['side_words', { side_words: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`w${i}`, 'buy'])) }],
    ['account_routes', { account_routes: { 'APX-0001': 'acc-1' } }],
    ['header_skip', { header_skip: 21 }],
  ] as const)('refuses a bad %s', (field, over) => {
    expect(checkTemplate({ ...payload, ...(over as Partial<TemplatePayloadV1>) })).toEqual({ code: 'bad_template', field });
  });

  it('a model without a side column is allowed (the quantity may be signed)', () => {
    const { 'c/v': _side, ...columns } = payload.columns;
    expect(checkTemplate({ ...payload, columns })).toBeNull();
  });
});

describe('matching a file to the models (§4.6)', () => {
  const model = (id: string, headers: string[], lastUsedAt: string | null = null): Template => ({
    ...CHOICES,
    headers,
    columns: headers.map(() => null),
    id,
    name: id,
    sig: headerSignature(headers),
    accountRoutes: {},
    tzHint: null,
    lastUsedAt,
  });
  const A = model('A', CHOICES.headers, '2026-10-01');

  it('the same set applies the model, whatever the order', () => {
    expect(matchTemplate([...CHOICES.headers].reverse(), [A])).toEqual({ kind: 'exact', template: A });
  });

  it('a set sharing at least 60 % of the names pre-fills «mapa» (a column more: «nova»)', () => {
    const file = [...CHOICES.headers, 'estrategia'];
    const m = matchTemplate(file, [A]);
    expect(m).toEqual({ kind: 'changed', template: A, shared: 11 });
    const filled = columnsFromTemplate(file, { headers: CHOICES.headers, columns: CHOICES.columns });
    expect(filled).toEqual([...CHOICES.columns, null]);
  });

  it('the best share wins, then the most recently used; under 60 %, none', () => {
    const B = model('B', CHOICES.headers.slice(0, 8), '2026-10-20');
    const C = model('C', CHOICES.headers.slice(0, 10), '2026-09-01');
    expect(matchTemplate(CHOICES.headers.slice(0, 9), [B, C])).toMatchObject({ kind: 'changed', template: { id: 'C' } });
    const B2 = model('B2', CHOICES.headers.slice(1, 10), '2026-10-21');
    expect(matchTemplate(CHOICES.headers.slice(0, 10).concat('z'), [C, B2])).toMatchObject({ kind: 'changed', template: { id: 'C' } });
    expect(matchTemplate(['x', 'y', 'papel'], [A])).toEqual({ kind: 'none' });
  });

  it('a model whose separator, title lines or deciding numbers disagree with the file goes to «mapa» (D12)', () => {
    const file = { delimiter: ';' as const, headerSkip: 0, decimalDecided: null, dateOrderDecided: null };
    expect(templateMisfits(A, file)).toEqual([]);
    expect(templateMisfits(A, { ...file, delimiter: ',', headerSkip: 2, decimalDecided: 'point', dateOrderDecided: 'mdy' })).toEqual(['delimiter', 'header_skip', 'decimal_mark', 'date_order']);
    // Nothing decides in this file: the model's mark reads it
    expect(templateMisfits(A, { ...file, decimalDecided: null })).toEqual([]);
  });
});
