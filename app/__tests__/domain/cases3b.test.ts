/**
 * @jest-environment node
 *
 * Phase 3b (the column-mapping import): the browser's twins against the SQL of migrations
 * 20261024000001..2. Every "expected" in cases3b.json was computed by that SQL on a throwaway
 * Postgres by a generator kept outside the repo (gen3b.mjs), from invented inputs and from the
 * mapped reader's own outputs for the board's files (app/testing/mappedFiles.ts: the cases with a
 * "sample"). Change the SQL and the TypeScript together, then re-record:
 *
 *   BH_CASES3B_DUMP=/tmp/f.json npx jest --ci __tests__/domain/cases3b.test.ts   the reader's outputs
 *   node gen3b.mjs <url of an empty database> <worktree> --fixtures /tmp/f.json    writes cases3b.json
 *
 *   header_sig  headerSignature = import_template_sig, and normaliseHeaders' names of the board's files
 *   instrument  tradeInstrument / tradeMatchKey = trade_instrument / trade_match_key for mapped symbols
 *   pnl         pnlFromPrices = trade_pnl
 *   rows        mappedRowCodes = import_checked_rows('modelo'): code, asset type, basis, the key of a
 *               row without an ID; the reader's rows of every board file are accepted as sent
 *   format      formatProblem = import_check_format (bad_format)
 *   template    checkTemplate = import_template_save (bad_template and its HINT); templatePayload's
 *               model of every board file is saved
 *   links       assignImportLinks = import_stage('modelo'): never a trade with an option contract
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  checkTemplate,
  formatProblem,
  headerSignature,
  mappedRowCodes,
  normaliseHeaders,
  readSymbol,
  sniffFile,
  templatePayload,
  toRpcRow,
  type ImportRow,
} from '@/lib/domain/import';
import { assignImportLinks, pnlFromPrices, tradeInstrument, tradeMatchKey, type MatchRow, type MatchTrade } from '@/lib/domain/registro';
import type { AccountMarket } from '@/lib/domain';
import { SAMPLES, readSample, sampleChoices } from '@/testing/mappedFiles';

const DUMP = process.env.BH_CASES3B_DUMP;
const FILE = path.join(__dirname, 'cases3b.json');

/** Raw header lines the readers' names come from, beyond the board's files */
const RAW_HEADERS: readonly { label: string; raw: string[] }[] = [
  { label: 'accents, quotes, a BOM, repeats and an empty name', raw: ['﻿"Preço"', 'Preço', 'PREÇO', ' Res.  Líq. ', '', 'Nº Negócio'] },
  { label: 'a control character and a dotted capital I', raw: ['Pre\u0001ço', 'İd', 'Data/Hora', 'a\u0085b'] },
  { label: 'a long name repeated', raw: ['n'.repeat(90), 'n'.repeat(90), 'Ativo'] },
  { label: 'a non-BMP character and a full-width one', raw: ['𝒜 col', '～', 'Ａ', 'a'] },
];

/** The reader's outputs the generator asks the SQL about */
function readerOutputs() {
  const seen = new Set<string>();
  const headers: { label: string; raw: string[]; headers: string[] }[] = [];
  const templates: { label: string; sample: string; payload: unknown }[] = [];
  for (const s of SAMPLES) {
    const { sniffed, choices } = sampleChoices(s);
    if (!seen.has(sniffed.sig)) {
      seen.add(sniffed.sig);
      headers.push({ label: `${s.label}: the file's names`, raw: sniffed.rawHeaders, headers: sniffed.headers });
    }
    templates.push({ label: `${s.label}: «Salvar como modelo»`, sample: s.label, payload: templatePayload({ ...choices, name: s.label.slice(0, 60) }) });
  }
  for (const r of RAW_HEADERS) headers.push({ label: r.label, raw: r.raw, headers: normaliseHeaders(r.raw) });
  return {
    rows: SAMPLES.map((s) => ({ label: s.label, sample: s.label, market: s.market, tz: s.tz, rows: readSample(s).rows.map(toRpcRow) })),
    headers,
    templates,
  };
}

if (DUMP) {
  it('writes the reader\'s outputs for the generator', () => {
    fs.writeFileSync(DUMP, `${JSON.stringify(readerOutputs(), null, 2)}\n`);
  });
} else {
  type Case<T> = T & { label: string };
  interface Cases {
    about: string;
    header_sig: { cases: Case<{ headers: string[]; raw?: string[]; expected: string }>[] };
    instrument: { cases: Case<{ market: AccountMarket; symbol: string; expected: { asset_type: string; pnl: string; mult: string | null; key: string; known: boolean } }>[] };
    pnl: { cases: Case<{ market: AccountMarket; symbol: string; direction: 'long' | 'short'; quantity: string; entry: string; exit: string; expected: string | null }>[] };
    rows: {
      cases: Case<{
        market: AccountMarket;
        tz: string;
        sample?: string;
        rows: Record<string, unknown>[];
        expected: { line: number; code: string | null; asset_type: string | null; pnl_basis: string | null; key_kind: string | null; key: string | null; hash: string | null; n: number | null }[];
      }>[];
    };
    format: { cases: Case<{ format: unknown; expected: string }>[] };
    template: { cases: Case<{ payload: unknown; sample?: string; expected: { code: string | null; hint: string | null } }>[] };
    links: {
      cases: Case<{
        trades: { id: string; symbol: string; direction: 'long' | 'short'; entry: string; quantity: string; entry_price: string; option: unknown; origin?: string }[];
        rows: { line: number; symbol: string; direction: 'long' | 'short'; entry: string; exit: string; entry_price: string; exit_price: string; quantity: string }[];
        expected: Record<string, string>;
      }>[];
    };
  }
  const CASES: Cases = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  it('was computed by the SQL of Phase 3b, with the reader\'s outputs of the board\'s files', () => {
    expect(CASES.about).toMatch(/20261024000001\.\.2/);
    for (const s of SAMPLES) expect(CASES.rows.cases.filter((c) => c.sample === s.label)).toHaveLength(1);
  });

  describe('the header signature (import_template_sig)', () => {
    it.each(CASES.header_sig.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      expect(headerSignature(c.headers)).toBe(c.expected);
      // The names a model keeps are the ones the reader gives the file today
      if (c.raw) expect(normaliseHeaders(c.raw)).toEqual(c.headers);
    });

    it('covers every board file as the reader sniffs it now', () => {
      for (const s of SAMPLES) {
        const sniffed = sniffFile(s.text);
        if (!sniffed.ok) throw new Error('file');
        expect(CASES.header_sig.cases.some((c) => c.expected === sniffed.sig)).toBe(true);
      }
    });
  });

  describe('instruments of mapped symbols (trade_instrument, trade_match_key)', () => {
    it.each(CASES.instrument.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      const spec = tradeInstrument(c.market, c.symbol);
      expect(spec && { asset_type: spec.assetType, pnl: spec.pnl, mult: spec.mult, key: tradeMatchKey(c.market, c.symbol), known: spec.known }).toEqual(c.expected);
    });

    it('a futures symbol written another way is stored as one the instrument table knows', () => {
      const known = (market: AccountMarket, symbol: string) => CASES.instrument.cases.find((c) => c.market === market && c.symbol === symbol)?.expected.known;
      for (const [market, written] of [
        ['futures', 'MES 12-26'],
        ['futures', '/MESZ26'],
        ['futures', 'MNQ 12-26'],
        ['b3', 'WINFUT'],
      ] as const) {
        const r = readSymbol(written, market);
        expect(r.ok && known(market, r.symbol)).toBe(true);
      }
      expect(known('futures', 'MES 12-26')).toBe(false);
    });
  });

  describe('the result from the prices (trade_pnl)', () => {
    it.each(CASES.pnl.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      const spec = tradeInstrument(c.market, c.symbol);
      expect(spec && pnlFromPrices(spec, c.direction === 'long' ? 1 : -1, c.quantity, c.entry, c.exit)).toBe(c.expected);
    });
  });

  describe('a mapped file\'s rows (import_checked_rows)', () => {
    it.each(CASES.rows.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      const got = mappedRowCodes(c.market, c.rows).map((r) => ({
        line: Number(r.line),
        code: r.code,
        asset_type: r.asset_type,
        pnl_basis: r.pnl_basis,
        key_kind: r.key_kind,
        key: r.key_kind === 'synthetic' ? null : r.external_id,
        hash: r.key_kind === 'synthetic' ? (r.external_id as string).slice(0, 33) : null,
        n: r.key_kind === 'synthetic' ? Number((r.external_id as string).split('.')[1]) : null,
      }));
      // The database answers rows in line order
      expect(got.sort((a, b) => a.line - b.line)).toEqual(c.expected);
    });

    it.each(SAMPLES.map((s) => [s.label, s] as const))('%s: every row the reader sends is accepted, with the basis it sent', (label, s) => {
      const c = CASES.rows.cases.find((x) => x.sample === label);
      const rows: ImportRow[] = readSample(s).rows.map(toRpcRow);
      // The recording is of the reader as it reads the file today
      expect(c?.rows).toEqual(JSON.parse(JSON.stringify(rows)));
      expect(c?.expected.filter((e) => e.code !== null)).toEqual([]);
      const byLine = new Map((c?.expected ?? []).map((e) => [e.line, e]));
      for (const r of rows) {
        expect(byLine.get(r.line)).toMatchObject({ pnl_basis: r.pnl_basis, key_kind: r.external_id === null ? 'synthetic' : 'real' });
      }
    });
  });

  describe('the file\'s format (import_check_format)', () => {
    it.each(CASES.format.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      // The generator's user has no models
      expect(formatProblem(c.format, []) ?? 'ok').toBe(c.expected);
    });
  });

  describe('«Salvar como modelo» (import_template_save, without a batch)', () => {
    it.each(CASES.template.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      const p = checkTemplate(c.payload);
      expect(p === null ? { code: null, hint: null } : p.code === 'bad_template' ? { code: p.code, hint: p.field } : { code: p.code, hint: null }).toEqual(c.expected);
    });

    it('the model of every board file is saved as the screens would send it', () => {
      for (const s of SAMPLES) {
        const c = CASES.template.cases.find((x) => x.sample === s.label);
        const { choices } = sampleChoices(s);
        expect(c?.payload).toEqual(JSON.parse(JSON.stringify(templatePayload({ ...choices, name: s.label.slice(0, 60) }))));
        expect(c?.expected).toEqual({ code: null, hint: null });
      }
    });
  });

  describe('links onto trades registered in the app (import_stage)', () => {
    it.each(CASES.links.cases.map((c) => [c.label, c] as const))('%s', (_label, c) => {
      const rows: MatchRow[] = c.rows.map((r, i) => ({
        rn: i + 1,
        line: r.line,
        symbol: r.symbol,
        direction: r.direction,
        entryTime: new Date(`${r.entry}Z`),
        exitTime: new Date(`${r.exit}Z`),
        quantity: r.quantity,
        stake: null,
        entryPrice: r.entry_price,
      }));
      const trades: MatchTrade[] = c.trades.map((t) => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entryTime: new Date(t.entry),
        origin: t.origin === 'reconstructed' ? 'reconstructed' : 'live',
        expiresAt: null,
        quantity: t.quantity,
        stake: null,
        entryPrice: t.entry_price,
        option: t.option !== null && t.option !== undefined,
      }));
      const links = assignImportLinks('stocks', rows, trades);
      expect(Object.fromEntries(Array.from(links.entries(), ([rn, id]) => [String(rn), id]))).toEqual(c.expected);
    });
  });
}
