/**
 * @jest-environment node
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_FILE_BYTES,
  entryHistogram,
  entrySpan,
  previewInstant,
  readImportFile,
  sha256Hex,
  totals,
  type ImportRow,
} from '@/lib/domain/import';

const DIR = path.join(__dirname, 'fixtures');
const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

function row(local_entry: string, utc_offset: string | null = null, extra: Partial<ImportRow> = {}): ImportRow {
  return {
    line: 2,
    external_id: 'feedface00000000000000f1',
    symbol: 'BTC/USDT',
    asset_type: 'binary_option',
    direction: 'call',
    local_entry,
    local_exit: null,
    utc_offset,
    entry_price: null,
    exit_price: null,
    quantity: '1',
    stake_amount: '10.00',
    payout_percent: null,
    duration_seconds: 60,
    timeframe: 'M1',
    result: 'win',
    pnl: '9.00',
    commission: '0.00',
    stop_price: null,
    target_price: null,
    ...extra,
  };
}

describe('previewInstant', () => {
  it('reads a zone-less stamp on the file zone, like Postgres AT TIME ZONE', () => {
    expect(previewInstant(row('2026-03-15T20:14:52'), SP)).toEqual({
      instant: new Date('2026-03-15T23:14:52Z'),
      kind: 'normal',
    });
    expect(previewInstant(row('2026-03-08T02:30:00'), NY)).toEqual({
      instant: new Date('2026-03-08T07:30:00Z'),
      kind: 'skipped',
    });
    expect(previewInstant(row('2026-11-01T01:30:00'), NY)).toEqual({
      instant: new Date('2026-11-01T06:30:00Z'),
      kind: 'repeated',
    });
  });

  it('applies a stated offset with the ISO sign and ignores the file zone', () => {
    expect(previewInstant(row('2025-08-12T20:30:10.250', '-03:00'), NY).instant.toISOString()).toBe(
      '2025-08-12T23:30:10.250Z',
    );
    expect(previewInstant(row('2025-08-12T23:41:57.318', '+00:00'), SP).instant.toISOString()).toBe(
      '2025-08-12T23:41:57.318Z',
    );
    expect(previewInstant(row('2025-08-13T05:00:00', '+05:30'), SP).instant.toISOString()).toBe(
      '2025-08-12T23:30:00.000Z',
    );
  });

  it('keeps the fraction on zone-less stamps', () => {
    expect(previewInstant(row('2026-03-15T20:14:52.123456'), 'UTC').instant.toISOString()).toBe(
      '2026-03-15T20:14:52.123Z',
    );
  });

  it('refuses a malformed offset or zone', () => {
    expect(() => previewInstant(row('2026-03-15T20:14:52', '-3'), SP)).toThrow(RangeError);
    expect(() => previewInstant(row('2026-03-15T20:14:52'), '-03:00')).toThrow(RangeError);
  });
});

describe('entrySpan', () => {
  const at = (...times: string[]) => times.map((t) => row(`2026-03-15T${t}:00`));

  it('p10–p90 of the entry minute', () => {
    const rows = at('20:00', '20:10', '20:20', '20:30', '20:40', '20:50', '21:00', '21:10', '21:20', '21:30');
    expect(entrySpan(rows)).toEqual({ from: '20:00', to: '21:20' });
  });

  it('cuts the day at the largest gap, so a session across midnight stays whole', () => {
    const rows = at('23:00', '23:30', '00:00', '00:30', '01:00', '01:30', '22:30', '22:00', '02:00', '21:30');
    expect(entrySpan(rows)).toEqual({ from: '21:30', to: '01:30' });
  });

  it('leaves out rows on another clock (stated offset)', () => {
    const rows = [...at('10:00', '10:30'), row('2026-03-15T23:59:00', '+00:00')];
    expect(entrySpan(rows)).toEqual({ from: '10:00', to: '10:30' });
  });

  it('one row, or none', () => {
    expect(entrySpan(at('09:05'))).toEqual({ from: '09:05', to: '09:05' });
    expect(entrySpan([])).toBeNull();
    expect(entrySpan([row('2026-03-15T10:00:00', '+00:00')])).toBeNull();
  });
});

describe('entryHistogram', () => {
  it('counts entries per slice of the display zone’s day', () => {
    const rows = [
      row('2026-03-15T20:14:52'), // 23:14 UTC
      row('2026-03-15T20:29:59'), // 23:29 UTC
      row('2026-03-15T21:00:00'), // 00:00 UTC
      row('2025-08-12T23:41:57.318', '+00:00'),
    ];
    const utc = entryHistogram(rows, SP, 'UTC');
    expect(utc).toHaveLength(48);
    expect(utc[46]).toBe(2);
    expect(utc[47]).toBe(1);
    expect(utc[0]).toBe(1);
    expect(utc.reduce((a, b) => a + b, 0)).toBe(4);
    const sp = entryHistogram(rows, SP, SP, 24);
    expect(sp[20]).toBe(3);
    expect(sp[21]).toBe(1);
  });

  it('refuses a bad bin count or zone', () => {
    expect(() => entryHistogram([], SP, SP, 0)).toThrow(RangeError);
    expect(() => entryHistogram([], SP, SP, 1.5)).toThrow(RangeError);
    expect(() => entryHistogram([], SP, 'Nowhere')).toThrow(RangeError);
  });
});

describe('totals', () => {
  it('gross pnl and the commissions stated', () => {
    expect(
      totals([row('2026-03-15T20:00:00', null, { pnl: '15.00', commission: '2.68' }), row('2026-03-15T20:00:00', null, { pnl: '-175.00', commission: null })]),
    ).toEqual({ gross: '-160.00', commission: '2.68' });
    expect(totals([row('2026-03-15T20:00:00', null, { commission: null })])).toEqual({ gross: '9.00', commission: null });
    expect(totals([])).toEqual({ gross: '0.00', commission: null });
  });
});

describe('readImportFile', () => {
  it('hashes the raw bytes (BOM and CRLF included) and parses the decoded text', async () => {
    const bytes = fs.readFileSync(path.join(DIR, 'ebinex_iso.csv'));
    const expected = crypto.createHash('sha256').update(bytes).digest('hex');
    const file = new File([new Uint8Array(bytes)], 'August.csv', { type: 'text/csv' });
    const read = await readImportFile(file);
    expect(read).toMatchObject({ fileName: 'August.csv', size: bytes.length, sha256: expected });
    expect(read.outcome.ok && read.outcome.rows.length).toBe(7);
  });

  it('a Blob without a name, and windows-1252 bytes', async () => {
    const bytes = fs.readFileSync(path.join(DIR, 'det_latin1.csv'));
    const read = await readImportFile(new Blob([new Uint8Array(bytes)]));
    expect(read.fileName).toBe('');
    expect(read.outcome.ok && read.outcome.platform).toBe('ebinex');
  });

  it('refuses a file over the size limit without reading it', async () => {
    const big = new Blob([new Uint8Array(MAX_FILE_BYTES + 1)]);
    const read = await readImportFile(big);
    expect(read).toEqual({ fileName: '', size: MAX_FILE_BYTES + 1, sha256: '', outcome: { ok: false, error: 'too_large' } });
  });

  it('an empty file', async () => {
    const read = await readImportFile(new Blob([]));
    expect(read.outcome).toEqual({ ok: false, error: 'empty_file' });
    expect(read.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('sha256Hex takes an ArrayBuffer too', async () => {
    const buf = new TextEncoder().encode('abc');
    expect(await sha256Hex(buf.buffer as ArrayBuffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
