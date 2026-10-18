/**
 * Which broker a file comes from, decided by its header names (in any order), never by
 * position or by the data.
 */
import { normalizeHeader } from './text';
import {
  EBINEX_COLUMNS,
  TOPONE_COLUMNS,
  type CanonicalColumn,
  type EbinexIndex,
  type Platform,
  type TopOneIndex,
} from './types';

export { EBINEX_COLUMNS, TOPONE_COLUMNS };

/** Other spellings seen or expected, after normalizeHeader. 'Previsao' needs none: accents are dropped. */
const ALIASES: Readonly<Record<string, string>> = { 'ticket#': 'ticket #' };

export type Detection =
  | { platform: 'ebinex'; index: EbinexIndex }
  | { platform: 'topone'; index: TopOneIndex }
  | {
      platform: null;
      error: 'unknown_format' | 'missing_columns' | 'duplicate_columns';
      /** The platform the header matched best, when at least half of its columns were found */
      best?: Platform;
      missing?: CanonicalColumn[];
    };

interface Match {
  platform: Platform;
  total: number;
  index: Partial<Record<CanonicalColumn, number>>;
  found: number;
  missing: CanonicalColumn[];
  duplicated: boolean;
}

function match(platform: Platform, columns: readonly CanonicalColumn[], header: string[]): Match {
  const index: Partial<Record<CanonicalColumn, number>> = {};
  const missing: CanonicalColumn[] = [];
  let found = 0;
  let duplicated = false;
  for (const column of columns) {
    const name = normalizeHeader(column);
    const at: number[] = [];
    header.forEach((h, i) => {
      if (h === name) at.push(i);
    });
    if (at.length === 0) missing.push(column);
    else {
      found++;
      index[column] = at[0];
      if (at.length > 1) duplicated = true;
    }
  }
  return { platform, total: columns.length, index, found, missing, duplicated };
}

/**
 * Matches the header against each broker's columns by name. Every column is required; extra
 * columns are ignored.
 * - all found → the platform and where each column is;
 * - at least half of the best match found → 'duplicate_columns' if one of them appears twice,
 *   else 'missing_columns' with our names for the missing ones;
 * - otherwise → 'unknown_format'.
 */
export function detectPlatform(header: string[]): Detection {
  const names = header.map((h) => {
    const n = normalizeHeader(h);
    return ALIASES[n] ?? n;
  });
  const candidates = [match('ebinex', EBINEX_COLUMNS, names), match('topone', TOPONE_COLUMNS, names)];
  const best = candidates.reduce((a, b) => (b.found / b.total > a.found / a.total ? b : a));

  if (best.found * 2 < best.total) return { platform: null, error: 'unknown_format' };
  if (best.duplicated) return { platform: null, error: 'duplicate_columns', best: best.platform };
  if (best.missing.length > 0) {
    return { platform: null, error: 'missing_columns', best: best.platform, missing: best.missing };
  }
  return best.platform === 'ebinex'
    ? { platform: 'ebinex', index: best.index as EbinexIndex }
    : { platform: 'topone', index: best.index as TopOneIndex };
}
