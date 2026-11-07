/**
 * @jest-environment node
 *
 * The shared cases of Phase 4 (the Diário): every "expected" in cases4.json was computed by the
 * functions of migrations 20261105000001..2 (fase-4/banco) on a throwaway PG15 cluster, with the
 * generator kept outside the repo (.claude/backup-fase4/gen4: `bash gerar.sh <worktree>
 * <worktree>/app/__tests__/domain/cases4.json`, BH_PORT a free port; deterministic, so an
 * unchanged SQL re-records the same file). Change the SQL and the TypeScript together, then
 * re-record.
 *
 * The TypeScript twins must give the same answer for the same inputs: «Salvar revisão» and «Antes
 * de operar»'s payload checks (codes, fields and their order) and what the server stores
 * (lib/domain/diario/payload: diario_check_review, diario_check_note, diario_text), the ISO week
 * and when a week is closed per market (diario_week_closed), a day's bounds on its clock
 * (diario_day_end = tempo.tradingDayBounds), history and the day's kind at version 1's instant,
 * and «Do pregão anterior» (diario_dia's carry_in). The money, the plans and the facts need a
 * database's rows: hubDiario.pg.test.ts and its recorded answers (hubDiarioDb.test.ts).
 */
import raw from './cases4.json';
import {
  carryInOf,
  checkNotePayload,
  checkReviewPayload,
  dayKindOf,
  diarioText,
  isHistoryEntry,
  isWeekClosed,
  noteValue,
  reviewValues,
  weekOf,
} from '@/lib/domain/diario';
import { MARKET_SPEC, type AccountMarket } from '@/lib/domain/markets';
import { isoWeekdayOf, tradingDayBounds, tradingDayOn } from '@/lib/domain/tempo';

type Expected = { code: string; field: string | null } | ({ ok: true } & Record<string, unknown>);
interface PayloadCase {
  label: string;
  dry_run: boolean;
  payload: unknown;
  expected: Expected;
}
interface Cases {
  about: string;
  review: PayloadCase[];
  note: PayloadCase[];
  text: { max: number; input: unknown; expected: { value: string | null } | { error: true } }[];
  week: {
    week_of: { day: string; weekday: number; week_of: string }[];
    closed: { market: AccountMarket; week_of: string; today: string; closed: boolean }[];
  };
  day_end: { day: string; tz: string; start_min: number; start: string; end: string }[];
  kind: {
    label: string;
    market: AccountMarket;
    v1_effective_from: string | null;
    desde_day: string | null;
    trades: { entry: string; trading_day: string; history: boolean }[];
    days: { day: string; kind: string; n: number; history: number }[];
  }[];
  carry: {
    label: string;
    desde_day: string;
    reviews: { day: string; versions: { carry_forward?: string; worked?: string; followed?: string }[] }[];
    carry_in: { day: string; expected: { day: string; text: string } | null }[];
  }[];
}

const cases = raw as unknown as Cases;

describe('cases4.json', () => {
  it('records every group', () => {
    expect(cases.about).toMatch(/20261105000001_diario\.sql and 20261105000002_diario_api\.sql/);
    expect([cases.review.length, cases.note.length, cases.text.length, cases.week.week_of.length, cases.week.closed.length]).toEqual([49, 14, 14, 13, 56]);
    expect([cases.day_end.length, cases.kind.length, cases.carry.length]).toEqual([28, 4, 5]);
  });
});

describe('«Salvar revisão»: diario_check_review and what save_day_review stores', () => {
  it.each(cases.review.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const problem = checkReviewPayload(c.payload, c.dry_run);
    if ('ok' in c.expected) {
      expect(problem).toBeNull();
      const v = reviewValues(c.payload as Record<string, unknown>);
      expect({ ok: true, worked: v.worked, differently: v.differently, followed: v.followed, carry_forward: v.carryForward }).toEqual(c.expected);
    } else {
      expect(problem).toEqual(c.expected);
    }
  });
});

describe('«Antes de operar»: diario_check_note and what save_day_note stores', () => {
  it.each(cases.note.map((c) => [c.label, c] as const))('%s', (_label, c) => {
    const problem = checkNotePayload(c.payload, c.dry_run);
    if ('ok' in c.expected) {
      expect(problem).toBeNull();
      expect({ ok: true, text: noteValue(c.payload as Record<string, unknown>) }).toEqual(c.expected);
    } else {
      expect(problem).toEqual(c.expected);
    }
  });
});

describe('diario_text', () => {
  it.each(cases.text.map((c, i) => [i, c] as const))('case %i', (_i, c) => {
    expect(diarioText(c.input, c.max)).toEqual(c.expected);
  });
});

describe('weeks', () => {
  it.each(cases.week.week_of.map((c) => [c.day, c] as const))('%s: its ISO weekday and Monday', (_d, c) => {
    expect([isoWeekdayOf(c.day), weekOf(c.day)]).toEqual([c.weekday, c.week_of]);
  });
  it.each(cases.week.closed.map((c) => [`${c.market} ${c.week_of} on ${c.today}`, c] as const))('%s', (_l, c) => {
    expect(isWeekClosed(c.market, c.week_of, c.today)).toBe(c.closed);
  });
});

describe('a day on its clock (diario_day_end)', () => {
  it.each(cases.day_end.map((c) => [`${c.day} ${c.tz} ${c.start_min}`, c] as const))('%s', (_l, c) => {
    const b = tradingDayBounds(c.day, { tz: c.tz, startMin: c.start_min });
    expect([b.start.toISOString(), b.end.toISOString()]).toEqual([new Date(c.start).toISOString(), new Date(c.end).toISOString()]);
  });
});

describe('history and the day\'s kind at version 1', () => {
  it.each(cases.kind.map((c) => [c.label, c] as const))('%s', (_l, c) => {
    const desde = c.v1_effective_from ? new Date(c.v1_effective_from) : null;
    const clock = MARKET_SPEC[c.market].day;
    expect(desde ? tradingDayOn(desde, clock) : null).toBe(c.desde_day);
    for (const t of c.trades) {
      expect([t.entry, isHistoryEntry(new Date(t.entry), desde), tradingDayOn(new Date(t.entry), clock)]).toEqual([t.entry, t.history, t.trading_day]);
    }
    const days = c.days.map((d) => {
      const on = c.trades.filter((t) => t.trading_day === d.day);
      const history = on.filter((t) => isHistoryEntry(new Date(t.entry), desde)).length;
      const n = on.length - history;
      return { day: d.day, kind: dayKindOf(n, history), n, history };
    });
    expect(days).toEqual(c.days);
  });
});

describe('«Do pregão anterior» (carry_in)', () => {
  it.each(cases.carry.map((c) => [c.label, c] as const))('%s', (_l, c) => {
    // Each day's CURRENT review is its newest version, as the server stores it
    const current = c.reviews.map((r) => {
      const v = r.versions[r.versions.length - 1];
      return { day: r.day, carryForward: reviewValues(v as Record<string, unknown>).carryForward };
    });
    for (const q of c.carry_in) {
      expect([q.day, carryInOf(current, q.day, c.desde_day, 'vazio')]).toEqual([q.day, q.expected]);
    }
    expect(carryInOf(current, '2026-12-31', c.desde_day, 'historico')).toBeNull();
  });
});
