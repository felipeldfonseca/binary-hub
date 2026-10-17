/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseImportText, type ParsedFile } from '@/lib/domain/import';
import {
  displaySpan,
  fileDays,
  groupByMarket,
  labelTaken,
  parseSize,
  resolveContaAtual,
  sizeToText,
  sortAccounts,
  visibleAccounts,
  zoneBars,
  zoneKeyOf,
  type TradingAccount,
} from '@/lib/hub/contas';
import {
  formatDateRange,
  formatDay,
  formatMoney,
  formatOffset,
  formatShift,
  formatWhen,
} from '@/lib/hub/formato';

const FIXTURES = path.join(__dirname, '../domain/import/fixtures');
const parsed = (name: string) => parseImportText(fs.readFileSync(path.join(FIXTURES, `${name}.csv`), 'utf8')) as ParsedFile;

let seq = 0;
function account(overrides: Partial<TradingAccount> = {}): TradingAccount {
  seq += 1;
  return {
    id: `acc-${seq}`,
    market: 'futures',
    label: `Conta ${seq}`,
    platform: null,
    firm: null,
    external_ref: null,
    phase: null,
    size: null,
    file_tz: 'UTC',
    tz_applied_at: null,
    is_primary: false,
    is_example: false,
    archived_at: null,
    sort_order: 0,
    created_at: `2026-10-0${seq % 9}T00:00:00Z`,
    ...overrides,
  };
}

describe('formatting', () => {
  it('writes money from exact decimals the pt-BR way', () => {
    expect(formatMoney('1272.5', { signed: true })).toBe('+US$ 1.272,50');
    expect(formatMoney('-484.84', { signed: true })).toBe('−US$ 484,84');
    expect(formatMoney('0', { signed: true })).toBe('US$ 0,00');
    expect(formatMoney('1234567.891')).toBe('US$ 1.234.567,89');
  });

  it('writes offsets with a typographic minus', () => {
    expect(formatOffset('-03:00')).toBe('−03:00');
    expect(formatOffset('+00:00')).toBe('+00:00');
  });

  it('reads the shifts import_fix_tz reports', () => {
    expect(formatShift('03:00:00')).toBe('+3 h');
    expect(formatShift('-03:00:00')).toBe('−3 h');
    expect(formatShift('02:30:00')).toBe('+2 h 30 min');
    expect(formatShift('00:30:00')).toBe('+30 min');
    expect(formatShift('1 day 02:00:00')).toBe('+26 h');
    expect(formatShift('nonsense')).toBe('nonsense');
  });

  it('writes the days a file covers as on the boards', () => {
    expect(formatDateRange('2026-08-04', '2026-10-13', 2026)).toBe('4 ago–13 out');
    expect(formatDateRange('2026-08-04', '2026-08-29', 2026)).toBe('4–29 ago');
    expect(formatDateRange('2025-08-04', '2025-08-29', 2026)).toBe('4–29 ago 2025');
    expect(formatDateRange('2025-12-04', '2026-01-13', 2026)).toBe('4 dez 2025–13 jan 2026');
    expect(formatDateRange('2026-03-15', '2026-03-15', 2026)).toBe('15 mar');
  });

  it('writes when something happened, with the year only when it is not this one', () => {
    const now = new Date(2026, 9, 17, 12, 0);
    expect(formatWhen(new Date(2026, 9, 15, 14, 32).toISOString(), now)).toBe('15 out, 14:32');
    expect(formatWhen(new Date(2025, 0, 2, 9, 5).toISOString(), now)).toBe('2 jan 2025, 09:05');
    expect(formatDay(new Date(2026, 9, 15, 14, 32).toISOString(), now)).toBe('15 out');
  });
});

describe('accounts', () => {
  it('lists Futuros first, then Opções binárias, by sort order and creation', () => {
    const a = account({ market: 'binary', label: 'Ebinex', sort_order: 0 });
    const b = account({ market: 'futures', label: 'Top One', sort_order: 1 });
    const c = account({ market: 'futures', label: 'Apex', sort_order: 0 });
    expect(sortAccounts([a, b, c]).map((x) => x.label)).toEqual(['Apex', 'Top One', 'Ebinex']);
    expect(groupByMarket(sortAccounts([a, b, c])).map((g) => [g.market, g.accounts.length])).toEqual([
      ['futures', 2],
      ['binary', 1],
    ]);
  });

  it('never lists example accounts and keeps archived ones apart', () => {
    const shown = account({ label: 'Top One' });
    const example = account({ label: 'Apex A', is_example: true });
    const closed = account({ label: 'Velha', archived_at: '2026-10-01T00:00:00Z' });
    const { active, archived } = visibleAccounts([shown, example, closed]);
    expect(active.map((a) => a.label)).toEqual(['Top One']);
    expect(archived.map((a) => a.label)).toEqual(['Velha']);
  });

  it('picks the conta atual: URL, then the saved choice, then the primary, then the first', () => {
    const first = account({ label: 'Primeira' });
    const primary = account({ label: 'Principal', is_primary: true });
    const saved = account({ label: 'Escolhida' });
    const active = [first, primary, saved];
    expect(resolveContaAtual(active, { fromUrl: first.id, saved: saved.id })?.label).toBe('Primeira');
    expect(resolveContaAtual(active, { fromUrl: 'gone', saved: saved.id })?.label).toBe('Escolhida');
    expect(resolveContaAtual(active, { fromUrl: null, saved: 'archived-one' })?.label).toBe('Principal');
    expect(resolveContaAtual([first, saved], {})?.label).toBe('Primeira');
    expect(resolveContaAtual([], {})).toBeNull();
  });

  it('checks nicknames against every account, ignoring case and spaces', () => {
    const list = [account({ id: 'x', label: 'Top One' }), account({ id: 'y', label: 'Velha', archived_at: '2026-01-01T00:00:00Z' })];
    expect(labelTaken(' top one ', list)).toBe(true);
    expect(labelTaken('VELHA', list)).toBe(true);
    expect(labelTaken('Top One', list, 'x')).toBe(false);
    expect(labelTaken('Nova', list)).toBe(false);
    expect(labelTaken('  ', list)).toBe(false);
  });

  it('reads "Tamanho US$" with pt-BR separators', () => {
    expect(parseSize('50.000')).toBe('50000');
    expect(parseSize('2500')).toBe('2500');
    expect(parseSize('1.250,5')).toBe('1250.50');
    expect(parseSize('')).toBeNull();
    expect(parseSize('0')).toBe('invalid');
    expect(parseSize('50,000.00')).toBe('invalid');
    expect(parseSize('abc')).toBe('invalid');
    expect(sizeToText(50000)).toBe('50.000');
    expect(sizeToText('1250.50')).toBe('1.250,50');
    expect(sizeToText(null)).toBe('');
  });

  it('knows the zones the import offers', () => {
    expect(zoneKeyOf('America/Sao_Paulo')).toBe('br');
    expect(zoneKeyOf('UTC')).toBe('utc');
    expect(zoneKeyOf('Asia/Tokyo')).toBeNull();
  });
});

describe('zone step data', () => {
  const topone = parsed('topone_ok');

  it('shows where the entries would fall on New York’s clock for each candidate zone', () => {
    // The fixture's entries are 13:35–15:14 on the file's (UTC) clock, in March around the US clock change
    const asUtc = displaySpan(topone.rows, 'UTC', 'America/New_York');
    const asNy = displaySpan(topone.rows, 'America/New_York', 'America/New_York');
    expect(asNy).not.toEqual(asUtc);
    expect(asNy?.from).toMatch(/^\d{2}:\d{2}$/);
  });

  it('scales the half-hour bars to the busiest one', () => {
    const bars = zoneBars(topone.rows, 'UTC', 'America/New_York');
    expect(bars).toHaveLength(48);
    expect(Math.max(...bars)).toBe(1);
    expect(bars.every((h) => h >= 0 && h <= 1)).toBe(true);
  });

  it('gives the first and last day on the file’s clock', () => {
    expect(fileDays(topone.rows)).toEqual({ first: '2026-03-06', last: expect.stringMatching(/^2026-03-\d{2}$/) });
    expect(fileDays([])).toBeNull();
  });
});
