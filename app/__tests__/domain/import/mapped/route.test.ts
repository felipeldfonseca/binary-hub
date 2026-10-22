/**
 * @jest-environment node
 *
 * Where a file goes once the account is known (R5, C28, D37): the readers first, a near-complete
 * reader file stays its error in that reader's market, anything else is mapped (or refused in a
 * binaries account). detectPlatform is unchanged.
 */
import { ACCOUNT_MARKETS } from '@/lib/domain';
import { EBINEX_COLUMNS, TOPONE_COLUMNS, detectPlatform, routeFile } from '@/lib/domain/import';

const without = (cols: readonly string[], ...drop: string[]) => cols.filter((c) => drop.indexOf(c) < 0);

describe('routeFile', () => {
  it('a reader\'s whole header goes to the reader, in any account (step g handles another market)', () => {
    for (const m of ACCOUNT_MARKETS) {
      expect(routeFile([...TOPONE_COLUMNS], m)).toBe('reader');
      expect(routeFile([...EBINEX_COLUMNS], m)).toBe('reader');
    }
  });

  it('a generic closed-position export (8 of Top One\'s 14 names) is mapped, even in futures', () => {
    const generic = ['Symbol', 'Side', 'SL', 'TP', 'Open Time', 'Open Price', 'Close Time', 'Close Price', 'Volume', 'Profit'];
    // As built, detection stops it at «Faltam colunas…»
    expect(detectPlatform(generic)).toMatchObject({ platform: null, error: 'missing_columns', best: 'topone' });
    expect(routeFile(generic, 'futures')).toBe('mapping');
    expect(routeFile(generic, 'forex')).toBe('mapping');
    expect(routeFile(generic, 'binary')).toBe('binary_error');
  });

  it('Top One with one or two names missing stays its error in futures; mapped elsewhere', () => {
    const two = without(TOPONE_COLUMNS, 'Gain', 'Duration');
    expect(routeFile(two, 'futures')).toBe('reader_error');
    expect(routeFile(without(TOPONE_COLUMNS, 'Gain'), 'futures')).toBe('reader_error');
    expect(routeFile(without(TOPONE_COLUMNS, 'Gain', 'Duration', 'SL'), 'futures')).toBe('mapping');
    expect(routeFile(two, 'stocks')).toBe('mapping');
  });

  it('every name found with one repeated stays the reader\'s error; two repeated, or a repeat and a gap, is mapped', () => {
    expect(routeFile([...TOPONE_COLUMNS, 'Symbol'], 'futures')).toBe('reader_error');
    expect(routeFile([...TOPONE_COLUMNS, 'Symbol', 'Side'], 'futures')).toBe('mapping');
    expect(routeFile([...without(TOPONE_COLUMNS, 'Gain'), 'Symbol'], 'futures')).toBe('mapping');
  });

  it('Ebinex: near-complete stays its error in binaries; an unknown file in binaries is refused', () => {
    expect(routeFile(without(EBINEX_COLUMNS, 'Vela', 'Estornado'), 'binary')).toBe('reader_error');
    expect(routeFile(without(EBINEX_COLUMNS, 'Vela'), 'futures')).toBe('mapping');
    expect(routeFile(['Date', 'Asset', 'Amount'], 'binary')).toBe('binary_error');
    expect(routeFile(['Date', 'Asset', 'Amount'], 'crypto')).toBe('mapping');
  });
});
