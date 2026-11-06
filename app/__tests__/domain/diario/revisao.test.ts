/**
 * @jest-environment node
 *
 * «Revisão do dia» (Phase 4): the days due a review (only days with a trade registered in the app,
 * before today), the week's «Revisões», the saved versions and «o dia mudou» (a commission that
 * arrives with the file counts), against the approved boards' invented days.
 */
import {
  carryInOf,
  dayChanged,
  isPendingReview,
  pendingReviews,
  previousVersions,
  reviewTimes,
  weekReviews,
  type DayReview,
} from '@/lib/domain/diario';
import { brt, et } from '@/testing/gate';
import { ebinexDays, facts, topOneDays } from '@/testing/diario';

describe('days due a review', () => {
  it('Top One on 1º dez: five, three of them in the last 4 weeks (file-only days never count)', () => {
    expect(pendingReviews(topOneDays(), '2026-12-01')).toEqual({
      days: ['2026-10-20', '2026-10-27', '2026-11-13', '2026-11-18', '2026-11-30'],
      recent: ['2026-11-13', '2026-11-18', '2026-11-30'],
    });
  });

  it('today is never pending; history days and file-only days never are', () => {
    const days = topOneDays();
    const day = (d: string) => days.find((x) => x.day === d)!;
    expect(isPendingReview(day('2026-12-01'), '2026-12-01')).toBe(false);
    expect(isPendingReview(day('2026-12-01'), '2026-12-02')).toBe(true);
    expect(isPendingReview(day('2026-10-28'), '2026-12-01')).toBe(false);
    expect(isPendingReview(day('2026-10-13'), '2026-12-01')).toBe(false);
  });

  it('«nas últimas 4 semanas» starts 28 days before today', () => {
    const p = pendingReviews(topOneDays(), '2026-11-27');
    expect(p.days).toEqual(['2026-10-20', '2026-10-27', '2026-11-13', '2026-11-18']);
    expect(p.recent).toEqual(['2026-10-20', '2026-10-27', '2026-11-13', '2026-11-18'].filter((d) => d >= '2026-10-30'));
  });

  it('«nas últimas 4 semanas» includes the day exactly 28 days back', () => {
    const p = pendingReviews(topOneDays(), '2026-11-17');
    expect(p.recent).toContain('2026-10-20');
    expect(pendingReviews(topOneDays(), '2026-11-18').recent).not.toContain('2026-10-20');
  });

  it('Ebinex on 11 nov: the file-only days (21 out, 4 nov) are not pending', () => {
    expect(pendingReviews(ebinexDays(), '2026-11-11').days).toEqual(['2026-10-17', '2026-10-26', '2026-10-28']);
  });
});

describe('«Revisões» of a week', () => {
  it('a reviewed file-only day counts; an unreviewed one does not', () => {
    const days = topOneDays().filter((d) => d.day >= '2026-10-26' && d.day <= '2026-10-30');
    expect(weekReviews(days, '2026-12-01')).toEqual({ counted: 3, reviewed: 2 });
    const reviewed = days.map((d) =>
      d.day === '2026-10-28' ? { ...d, review: { firstSavedAt: et('2026-10-28 19:00'), savedAt: et('2026-10-28 19:00'), versions: 1 } } : d,
    );
    expect(weekReviews(reviewed, '2026-12-01')).toEqual({ counted: 4, reviewed: 3 });
  });
});

describe('«Revisões» and a review saved on a history day (review, 10 Oct)', () => {
  it('the day the rules began with only history on it: its written review counts', () => {
    const days = ebinexDays().filter((d) => d.kind === 'historico').slice(0, 1);
    expect(days).toHaveLength(1);
    expect(weekReviews(days, '2026-12-01')).toEqual({ counted: 0, reviewed: 0 });
    const reviewed = days.map((d) => ({ ...d, review: { firstSavedAt: brt('2026-10-10 21:00'), savedAt: brt('2026-10-11 04:32'), versions: 2 } }));
    expect(weekReviews(reviewed, '2026-12-01')).toEqual({ counted: 1, reviewed: 1 });
  });
});

describe('«Do pregão anterior» (the twin of diario_dia\'s carry_in)', () => {
  const reviews = [
    { day: '2026-10-13', carryForward: 'Antes das regras' },
    { day: '2026-10-20', carryForward: null },
    { day: '2026-10-21', carryForward: 'Esperar o reteste.' },
  ];
  it('the newest earlier day with a text; none on a history day or before «desde»\'s day; on «desde»\'s day itself, any earlier one', () => {
    expect(carryInOf(reviews, '2026-10-22', '2026-10-14', 'diario')).toEqual({ day: '2026-10-21', text: 'Esperar o reteste.' });
    expect(carryInOf(reviews, '2026-10-21', '2026-10-14', 'diario')).toEqual({ day: '2026-10-13', text: 'Antes das regras' });
    expect(carryInOf(reviews, '2026-10-22', '2026-10-14', 'historico')).toBeNull();
    expect(carryInOf(reviews, '2026-10-13', '2026-10-14', 'misto')).toBeNull();
    expect(carryInOf(reviews, '2026-10-14', '2026-10-14', 'misto')).toEqual({ day: '2026-10-13', text: 'Antes das regras' });
    expect(carryInOf(reviews, '2026-10-14', null, 'diario')).toBeNull();
  });
});

describe('the saved versions', () => {
  const v = (id: number, at: string) => ({
    id,
    savedAt: et(at),
    written: true,
    worked: 'Esperei o reteste da mínima para vender.',
    differently: null,
    followed: 'sim' as const,
    carryForward: 'Uma operação por vez.',
    autoSummary: facts({ trades: 3, net: '368.5' }),
  });

  it('«Salva às 11:33 · editada às 18:05»; one save has no «editada»', () => {
    const review: DayReview = { ...v(12, '2026-11-10 18:05'), firstSavedAt: et('2026-11-10 11:33'), versions: 2, written: true, previous: [v(11, '2026-11-10 11:33')] };
    expect(reviewTimes(review)).toEqual({ savedAt: et('2026-11-10 11:33'), editedAt: et('2026-11-10 18:05') });
    expect(reviewTimes({ ...review, firstSavedAt: review.savedAt, versions: 1 })).toEqual({ savedAt: et('2026-11-10 18:05'), editedAt: null });
  });

  it('«Versões anteriores»: newest first', () => {
    const review: DayReview = {
      ...v(14, '2026-11-12 09:00'),
      firstSavedAt: et('2026-11-10 11:33'),
      versions: 3,
      written: true,
      previous: [v(11, '2026-11-10 11:33'), v(12, '2026-11-10 18:05')],
    };
    expect(previousVersions(review).map((x) => x.id)).toEqual([12, 11]);
  });
});

describe('«Depois da revisão, o dia mudou»', () => {
  it('19 nov: saved with 5 trades at −US$ 453,00; the file brought the commissions (−US$ 465,40)', () => {
    expect(dayChanged({ trades: 5, net: '-453' }, { trades: 5, net: '-465.4' })).toBe(true);
  });

  it('10 nov: saved at 18:05 with 4 trades (+US$ 307,50); the file added one (5, +US$ 267,93)', () => {
    expect(dayChanged({ trades: 4, net: '307.5' }, { trades: 5, net: '267.93' })).toBe(true);
  });

  it('the same numbers, whatever the scale, are not a change', () => {
    expect(dayChanged({ trades: 5, net: '-453' }, { trades: 5, net: '-453.00' })).toBe(false);
    expect(dayChanged({ trades: 0, net: '0' }, { trades: 0, net: '0.00' })).toBe(false);
  });

  it('another trade with a zero result still changes the day', () => {
    expect(dayChanged({ trades: 2, net: '85' }, { trades: 3, net: '85' })).toBe(true);
  });

  it('a Brasília account behaves the same', () => {
    const a = facts({ day: '2026-11-11', trades: 4, net: '-7.4', limit: null, window: { rule: true, evaluated: 4, inside: 3, outside: [{ tradeId: 't', at: brt('2026-11-11 21:25') }] } });
    expect(dayChanged(a, { ...a, net: '-7.40' })).toBe(false);
  });
});
