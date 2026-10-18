/**
 * @jest-environment node
 */
/**
 * The new reader against the frozen legacy one on the same fixtures. They must agree on every
 * dedupe key and instant, except for the deliberate fixes: the Brasília clock of the current
 * Ebinex export (legacy stored it as UTC, 3 h early), unsigned losses of the old ISO export
 * (legacy stored them positive) and windows-1252 files (legacy lost the Previsão column).
 */
import fs from 'node:fs';
import path from 'node:path';
import { decodeCsvBytes, parseImportText, previewInstant, type ImportRow, type ParsedFile } from '@/lib/domain/import';
import { parseEbinexCsv } from '@/lib/utils/ebinexParser';
import { parseTopOneCsv } from '@/lib/utils/topOneParser';

const DIR = path.join(__dirname, 'fixtures');
const SP = 'America/Sao_Paulo';
const HOUR = 3600 * 1000;

interface LegacyTrade {
  notes?: string | null;
  symbol: string;
  direction: string;
  result?: string | null;
  pnl?: number | null;
  quantity?: number | null;
  entry_price?: number | null;
  exit_price?: number | null;
  stake_amount?: number | null;
  entry_time: string;
  exit_time?: string | null;
  timeframe?: string | null;
}

const CASES = [
  'ebinex_atual_ok',
  'ebinex_atual_erros',
  'ebinex_iso',
  'topone_ok',
  'topone_erros',
  'det_ebinex_sem_acento',
  'det_ebinex_reordenado',
  'det_topone_sem_aspas',
  'det_latin1',
];

function both(name: string): { out: ParsedFile; legacy: LegacyTrade[] } {
  const bytes = fs.readFileSync(path.join(DIR, `${name}.csv`));
  const out = parseImportText(decodeCsvBytes(bytes));
  if (!out.ok) throw new Error(`${name}: ${out.error}`);
  const text = bytes.toString('utf8');
  const legacy = (out.platform === 'topone' ? parseTopOneCsv(text) : parseEbinexCsv(text)).trades as LegacyTrade[];
  return { out, legacy };
}

/** The legacy trade the database would have kept for this row: the first with the same notes. */
function legacyFor(platform: string, row: ImportRow, legacy: LegacyTrade[]): LegacyTrade {
  const t = legacy.find((x) => x.notes === `${platform}:${row.external_id}`);
  if (!t) throw new Error(`no legacy trade for line ${row.line}`);
  return t;
}

const num = (d: string | null) => (d === null ? null : Number(d));
const ms = (iso: string) => Date.parse(iso);

describe.each(CASES)('%s', (name) => {
  const { out, legacy } = both(name);

  it('every new row has a legacy trade with notes = platform:external_id', () => {
    expect(out.rows.length).toBeGreaterThan(0);
    for (const row of out.rows) {
      expect(legacyFor(out.platform, row, legacy).notes).toBe(`${out.platform}:${row.external_id}`);
    }
  });

  it('direction, symbol, quantity, prices and timeframe agree', () => {
    for (const row of out.rows) {
      const old = legacyFor(out.platform, row, legacy);
      // Legacy reads windows-1252 as UTF-8, loses the Previsão column and defaults to 'put'
      const direction = name === 'det_latin1' ? old.direction : row.direction;
      expect([row.line, direction, row.symbol, num(row.quantity)]).toEqual([
        row.line,
        old.direction,
        old.symbol,
        old.quantity,
      ]);
      expect(num(row.entry_price)).toBe(old.entry_price);
      expect(num(row.exit_price)).toBe(old.exit_price);
      if (out.platform === 'ebinex') expect(row.timeframe).toBe(old.timeframe);
    }
  });

  it('instants agree (current Ebinex format: exactly 3 h later, the Brasília fix)', () => {
    for (const row of out.rows) {
      const old = legacyFor(out.platform, row, legacy);
      if (out.platform === 'topone') {
        expect(previewInstant(row, 'UTC').instant.getTime()).toBe(ms(old.entry_time));
        if (row.local_exit !== null) {
          const exit = previewInstant({ local_entry: row.local_exit, utc_offset: null }, 'UTC').instant;
          expect(exit.getTime()).toBe(ms(old.exit_time!));
        }
      } else if (row.utc_offset !== null) {
        expect(previewInstant(row, SP).instant.getTime()).toBe(ms(old.entry_time));
      } else if (row.local_entry >= '2019-03-01') {
        // São Paulo has had no daylight saving since Feb 2019
        expect(previewInstant(row, SP).instant.getTime() - ms(old.entry_time)).toBe(3 * HOUR);
      }
    }
  });

  it('result and pnl agree (old ISO losses: negated)', () => {
    for (const row of out.rows) {
      const old = legacyFor(out.platform, row, legacy);
      expect(row.result).toBe(old.result);
      const oldPnl = old.pnl ?? 0;
      const unsignedIsoLoss = row.utc_offset !== null && row.result === 'loss' && oldPnl > 0;
      expect(Number(row.pnl)).toBe(unsignedIsoLoss ? -oldPnl : oldPnl);
    }
  });
});

it('the deliberate fixes are visible on the same rows', () => {
  const iso = both('ebinex_iso');
  const losses = iso.out.rows.filter((r) => r.result === 'loss');
  expect(losses.map((r) => [r.pnl, legacyFor('ebinex', r, iso.legacy).pnl])).toEqual([
    ['-10.00', 10],
    ['-20.00', 20],
  ]);
  const ok = both('ebinex_atual_ok');
  const partial = ok.out.rows.find((r) => r.line === 12)!;
  expect([partial.stake_amount, legacyFor('ebinex', partial, ok.legacy).stake_amount]).toEqual(['5.00', 10]);
  const latin1 = both('det_latin1');
  expect([latin1.out.rows[0].direction, latin1.legacy[0].direction]).toEqual(['call', 'put']);
});
