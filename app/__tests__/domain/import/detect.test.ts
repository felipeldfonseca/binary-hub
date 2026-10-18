/**
 * @jest-environment node
 */
import { EBINEX_COLUMNS, TOPONE_COLUMNS, detectPlatform } from '@/lib/domain/import';

/** Deterministic shuffle, so "any order" is tested without randomness. */
function rotate<T>(xs: readonly T[], by: number): T[] {
  return xs.slice(by).concat(xs.slice(0, by));
}

describe('detectPlatform', () => {
  it.each(Array.from({ length: EBINEX_COLUMNS.length }, (_, i) => i))(
    'finds every Ebinex column by name, rotated by %d',
    (by) => {
      const header = rotate(EBINEX_COLUMNS, by).reverse();
      const det = detectPlatform(header);
      expect(det.platform).toBe('ebinex');
      if (det.platform !== 'ebinex') return;
      for (const c of EBINEX_COLUMNS) expect(header[det.index[c]]).toBe(c);
    },
  );

  it.each(Array.from({ length: TOPONE_COLUMNS.length }, (_, i) => i))(
    'finds every Top One column by name, rotated by %d',
    (by) => {
      const header = rotate(TOPONE_COLUMNS, by).map((c) => `"${c}"`);
      const det = detectPlatform(header);
      expect(det.platform).toBe('topone');
      if (det.platform !== 'topone') return;
      for (const c of TOPONE_COLUMNS) expect(header[det.index[c]]).toBe(`"${c}"`);
    },
  );

  it('ignores case, accents, quotes, spaces and extra columns', () => {
    const header = ['Extra', ...EBINEX_COLUMNS.map((c) => ` ${c.toUpperCase().replace('Ã', 'A')} `), 'Another'];
    const det = detectPlatform(header);
    expect(det.platform).toBe('ebinex');
    if (det.platform === 'ebinex') expect(det.index.ID).toBe(1);
  });

  it('accepts Ticket# without the space', () => {
    expect(detectPlatform(TOPONE_COLUMNS.map((c) => (c === 'Ticket #' ? 'Ticket#' : c))).platform).toBe('topone');
  });

  it('names the missing columns when at least half matched', () => {
    expect(detectPlatform(TOPONE_COLUMNS.filter((c) => c !== 'Lots' && c !== 'Gain'))).toEqual({
      platform: null,
      error: 'missing_columns',
      best: 'topone',
      missing: ['Lots', 'Gain'],
    });
  });

  it('a repeated column is refused', () => {
    expect(detectPlatform([...EBINEX_COLUMNS, 'Valor'])).toEqual({
      platform: null,
      error: 'duplicate_columns',
      best: 'ebinex',
    });
  });

  it('anything else is unknown', () => {
    expect(detectPlatform(['Date', 'Symbol', 'Qty', 'Price'])).toEqual({ platform: null, error: 'unknown_format' });
    expect(detectPlatform([''])).toEqual({ platform: null, error: 'unknown_format' });
    expect(detectPlatform(['Date', 'Date'])).toEqual({ platform: null, error: 'unknown_format' });
  });
});
