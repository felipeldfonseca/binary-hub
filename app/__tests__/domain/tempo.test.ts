/**
 * @jest-environment node
 */
import {
  EVERY_DAY,
  MON_TO_FRI,
  addDays,
  assertTimeZone,
  assertZoneName,
  classifyLocalTime,
  firstLocalHmAtOrAfter,
  formatHhMm,
  hmOn,
  inWindow,
  isValidWindow,
  isZoneName,
  isoWeekdayOf,
  localHmInTradingDay,
  localToUtc,
  nextOffsetChange,
  opensOn,
  parseHhMm,
  resolveLocalHm,
  tradingDay,
  tradingDayBounds,
  tradingDayFor,
  tradingDayOn,
  utcOffsetMinutes,
  utcToLocal,
  weekdayMask,
  windowOccurrenceAt,
  windowOccurrences,
  type DayClock,
  type LocalDateTime,
  type TradingWindow,
} from '@/lib/domain';

const NY = 'America/New_York';
const SP = 'America/Sao_Paulo';

function at(text: string): LocalDateTime {
  const [date, time] = text.split(' ');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  return { year, month, day, hour, minute, second };
}

const iso = (d: Date) => d.toISOString().replace('.000Z', 'Z');

describe('localToUtc matches Postgres', () => {
  // Recorded from PostgreSQL 15.13:
  //   select timestamp '<local>' at time zone '<tz>'   (session time zone UTC)
  const postgres: Array<[string, string, string]> = [
    [NY, '2026-03-08 01:59:59', '2026-03-08T06:59:59Z'],
    [NY, '2026-03-08 02:00', '2026-03-08T07:00:00Z'],
    [NY, '2026-03-08 02:30', '2026-03-08T07:30:00Z'],
    [NY, '2026-03-08 03:00', '2026-03-08T07:00:00Z'],
    [NY, '2026-11-01 01:00', '2026-11-01T06:00:00Z'],
    [NY, '2026-11-01 01:30', '2026-11-01T06:30:00Z'],
    [NY, '2026-11-01 01:59:59', '2026-11-01T06:59:59Z'],
    [NY, '2026-11-01 02:00', '2026-11-01T07:00:00Z'],
    [SP, '2026-02-15 20:30', '2026-02-15T23:30:00Z'],
    [SP, '2026-07-15 20:30', '2026-07-15T23:30:00Z'],
    [SP, '2026-11-01 00:30', '2026-11-01T03:30:00Z'],
    [SP, '2018-11-04 00:30', '2018-11-04T03:30:00Z'],
    [SP, '2019-02-16 23:30', '2019-02-17T02:30:00Z'],
  ];

  it.each(postgres)('%s %s → %s', (tz, local, expected) => {
    expect(iso(localToUtc(at(local), tz))).toBe(expected);
  });
});

describe('New York daylight saving', () => {
  it('reads 02:30 on 8 Mar 2026, which the clock skipped, as 03:30 EDT', () => {
    const local = at('2026-03-08 02:30');
    expect(classifyLocalTime(local, NY)).toBe('skipped');
    const back = utcToLocal(localToUtc(local, NY), NY);
    expect([back.hour, back.minute]).toEqual([3, 30]);
  });

  it('reads 01:30 on 1 Nov 2026, which happened twice, as the later one (EST)', () => {
    const local = at('2026-11-01 01:30');
    expect(classifyLocalTime(local, NY)).toBe('repeated');
    expect(iso(localToUtc(local, NY))).toBe('2026-11-01T06:30:00Z');
  });

  it('keeps the same wall clock in winter and summer', () => {
    expect(iso(localToUtc(at('2026-01-05 10:00'), NY))).toBe('2026-01-05T15:00:00Z');
    expect(iso(localToUtc(at('2026-03-09 10:00'), NY))).toBe('2026-03-09T14:00:00Z');
  });

  it('round-trips every normal quarter hour across both change days', () => {
    for (const date of ['2026-03-08', '2026-11-01']) {
      for (let m = 0; m < 24 * 60; m += 15) {
        const local = at(`${date} ${Math.floor(m / 60)}:${m % 60}`);
        if (classifyLocalTime(local, NY) !== 'normal') continue;
        const back = utcToLocal(localToUtc(local, NY), NY);
        expect([back.date, back.hour, back.minute]).toEqual([date, local.hour, local.minute]);
      }
    }
  });
});

describe('Brasília', () => {
  it('stays at UTC−3 all year, with no daylight saving since 2019', () => {
    for (const month of [1, 2, 4, 7, 10, 11, 12]) {
      const local = { year: 2026, month, day: 15, hour: 20, minute: 30 };
      expect(classifyLocalTime(local, SP)).toBe('normal');
      expect(localToUtc(local, SP).getUTCHours()).toBe(23);
    }
  });

  it('turns a UTC instant into the Brasília clock', () => {
    const local = utcToLocal(new Date('2026-10-17T02:30:00Z'), SP);
    expect([local.date, local.hour, local.minute, local.isoWeekday]).toEqual(['2026-10-16', 23, 30, 5]);
  });
});

describe('input checks', () => {
  it('refuses dates that do not exist', () => {
    expect(() => localToUtc(at('2026-02-30 10:00'), NY)).toThrow(RangeError);
    expect(() => localToUtc(at('2026-13-01 10:00'), NY)).toThrow(RangeError);
    expect(() => localToUtc(at('2026-01-01 24:00'), NY)).toThrow(RangeError);
    expect(() => utcToLocal(new Date('nope'), NY)).toThrow(RangeError);
  });

  it('refuses unknown zone names instead of falling back to UTC', () => {
    expect(() => assertTimeZone('America/Sao_Pualo')).toThrow(RangeError);
    expect(() => localToUtc(at('2026-01-01 10:00'), 'Brasilia')).toThrow(RangeError);
  });

  it('refuses zones that Postgres reads differently, and a missing zone', () => {
    // Postgres flips the sign of '-03:00' and treats CET/EET/MET/WET as fixed offsets
    for (const tz of ['-03:00', '+05:30', '-0300', '+03', 'CET', 'EET', 'MET', 'WET', 'EST5EDT', '']) {
      expect(() => assertTimeZone(tz)).toThrow(RangeError);
    }
    expect(() => localToUtc(at('2026-01-01 10:00'), '-03:00')).toThrow(RangeError);
    expect(() => utcToLocal(new Date(), undefined as unknown as string)).toThrow(RangeError);
    const noZone = { startMin: 20 * 60, endMin: 21 * 60, weekdays: EVERY_DAY } as unknown as TradingWindow;
    expect(() => inWindow(new Date(), noZone)).toThrow(RangeError);
    expect(() => tradingDay(new Date(), noZone)).toThrow(RangeError);
  });

  it('accepts UTC and Area/Location names, including Etc/GMT offsets', () => {
    for (const tz of ['UTC', 'Etc/UTC', 'Etc/GMT+3', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Europe/Paris']) {
      expect(() => assertTimeZone(tz)).not.toThrow();
    }
  });

  it('a zone name as the database knows it, case and all (pg_timezone_names: name = …)', () => {
    for (const tz of ['UTC', 'Etc/GMT+3', 'Etc/GMT-14', 'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'Europe/London', 'America/Port-au-Prince', 'Antarctica/DumontDUrville', 'Asia/Calcutta']) {
      expect([tz, isZoneName(tz)]).toEqual([tz, true]);
      expect(() => assertZoneName(tz)).not.toThrow();
    }
    // Intl reads any case; the database does not (an alias Intl rewrites is refused too, never looser)
    for (const tz of ['america/new_york', 'AMERICA/SAO_PAULO', 'America/new_York', 'us/eastern', 'US/EASTERN', 'Us/Eastern', 'US/EAstern', 'utc', 'Utc', 'etc/utc', 'Etc/Utc', 'ETC/GMT+3', 'Asia/Ho_chi_minh', '', '-03:00', 'EST5EDT', 'GMT', 'Mars/Base']) {
      expect([tz, isZoneName(tz)]).toEqual([tz, false]);
      expect(() => assertZoneName(tz)).toThrow(RangeError);
    }
  });
});

describe('weekday mask', () => {
  it('sets one bit per ISO weekday', () => {
    expect(weekdayMask(['mon'])).toBe(0b1);
    expect(weekdayMask(['mon', 'wed'])).toBe(0b101);
    expect(MON_TO_FRI).toBe(0b0011111);
    expect(EVERY_DAY).toBe(0b1111111);
  });

  it('answers whether a window opens on a weekday', () => {
    expect(opensOn(MON_TO_FRI, 5)).toBe(true);
    expect(opensOn(MON_TO_FRI, 6)).toBe(false);
    expect(opensOn(weekdayMask(['sun']), 7)).toBe(true);
  });
});

describe('windows', () => {
  const topOne: TradingWindow = { tz: NY, startMin: 10 * 60, endMin: 11 * 60, weekdays: MON_TO_FRI };
  const ebinexNight: TradingWindow = { tz: SP, startMin: 20 * 60, endMin: 2 * 60, weekdays: MON_TO_FRI };

  it('follows New York time through daylight saving (10–11 ET)', () => {
    expect(inWindow(new Date('2026-01-05T15:30:00Z'), topOne)).toBe(true); // Mon 10:30 EST
    expect(inWindow(new Date('2026-03-09T14:30:00Z'), topOne)).toBe(true); // Mon 10:30 EDT
    expect(inWindow(new Date('2026-03-09T15:30:00Z'), topOne)).toBe(false); // Mon 11:30 EDT
  });

  it('includes the start and excludes the end', () => {
    expect(inWindow(new Date('2026-03-09T14:00:00Z'), topOne)).toBe(true); // 10:00
    expect(inWindow(new Date('2026-03-09T14:59:59Z'), topOne)).toBe(true); // 10:59:59
    expect(inWindow(new Date('2026-03-09T15:00:00Z'), topOne)).toBe(false); // 11:00
    expect(inWindow(new Date('2026-03-09T15:05:00Z'), topOne)).toBe(false); // 11:05
  });

  it('is closed on days the window does not open', () => {
    expect(inWindow(new Date('2026-03-14T14:30:00Z'), topOne)).toBe(false); // Sat 10:30
  });

  it('counts a window that crosses midnight on the day it opened', () => {
    // Fri 16 Oct 2026, 23:30 Brasília
    expect(inWindow(new Date('2026-10-17T02:30:00Z'), ebinexNight)).toBe(true);
    // Sat 01:30 belongs to Friday night's window
    expect(inWindow(new Date('2026-10-17T04:30:00Z'), ebinexNight)).toBe(true);
    // Sat 02:00 is the end
    expect(inWindow(new Date('2026-10-17T05:00:00Z'), ebinexNight)).toBe(false);
    // Sat 21:00: the window does not open on Saturday
    expect(inWindow(new Date('2026-10-18T00:00:00Z'), ebinexNight)).toBe(false);
    // Mon 01:30 would belong to Sunday night's window, which does not open
    expect(inWindow(new Date('2026-10-19T04:30:00Z'), ebinexNight)).toBe(false);
    // Mon 20:00
    expect(inWindow(new Date('2026-10-19T23:00:00Z'), ebinexNight)).toBe(true);
  });

  it('refuses windows that make no sense', () => {
    expect(isValidWindow({ ...topOne, endMin: topOne.startMin })).toBe(false);
    expect(isValidWindow({ ...topOne, endMin: 24 * 60 })).toBe(false);
    expect(isValidWindow({ ...topOne, weekdays: 0 })).toBe(false);
    expect(() => inWindow(new Date(), { ...topOne, weekdays: 0 })).toThrow(RangeError);
    expect(() => tradingDay(new Date(), { ...topOne, tz: 'Nowhere/City' })).toThrow(RangeError);
  });
});

describe('tradingDay', () => {
  const ebinexNight: TradingWindow = { tz: SP, startMin: 20 * 60, endMin: 2 * 60, weekdays: MON_TO_FRI };

  it('puts 23:30 in Brasília on that same day, not on the next UTC day', () => {
    const instant = new Date('2026-10-17T02:30:00Z'); // Fri 16 Oct, 23:30 Brasília
    expect(instant.toISOString().slice(0, 10)).toBe('2026-10-17');
    expect(tradingDay(instant, SP)).toBe('2026-10-16');
  });

  it('uses the window clock, not UTC', () => {
    const topOne: TradingWindow = { tz: NY, startMin: 10 * 60, endMin: 11 * 60, weekdays: MON_TO_FRI };
    expect(tradingDay(new Date('2026-03-09T03:30:00Z'), topOne)).toBe('2026-03-08'); // Sun 23:30 EDT
  });

  it('keeps a whole night session on the day it opened', () => {
    expect(tradingDay(new Date('2026-10-17T02:30:00Z'), ebinexNight)).toBe('2026-10-16'); // Fri 23:30
    expect(tradingDay(new Date('2026-10-17T04:30:00Z'), ebinexNight)).toBe('2026-10-16'); // Sat 01:30
    expect(tradingDay(new Date('2026-10-17T05:00:00Z'), ebinexNight)).toBe('2026-10-17'); // Sat 02:00
  });

  it('does not split a night session on a day the window does not open', () => {
    expect(tradingDay(new Date('2026-10-19T02:00:00Z'), ebinexNight)).toBe('2026-10-18'); // Sun 23:00
    expect(tradingDay(new Date('2026-10-19T04:30:00Z'), ebinexNight)).toBe('2026-10-18'); // Mon 01:30
  });

  it('turns the month and the year over correctly', () => {
    expect(tradingDay(new Date('2027-01-01T04:00:00Z'), ebinexNight)).toBe('2026-12-31'); // Fri 1 Jan 01:00
    expect(tradingDay(new Date('2026-03-01T04:00:00Z'), ebinexNight)).toBe('2026-02-28'); // Sun 1 Mar 01:00
  });

  it('turns at 18:00 with the dayStartMin option, and at midnight without it (as before)', () => {
    const at1830 = new Date('2026-10-19T22:30:00Z'); // Mon 18:30 EDT
    expect(tradingDay(at1830, NY)).toBe('2026-10-19');
    expect(tradingDay(at1830, NY, { dayStartMin: 1080 })).toBe('2026-10-20');
    expect(tradingDay(at1830, NY, { dayStartMin: 0 })).toBe('2026-10-19');
  });
});

// ---------------------------------------------------------------------------------------------
// Phase 2: the account's day clock, window occurrences, offsets, "HH:MM"
// ---------------------------------------------------------------------------------------------

const TOP_CLOCK: DayClock = { tz: NY, startMin: 1080 };
const BIN_CLOCK: DayClock = { tz: SP, startMin: 0 };

describe('calendar dates', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-11-01', 0)).toBe('2026-11-01');
  });

  it('gives the ISO weekday of a date', () => {
    expect(isoWeekdayOf('2026-10-19')).toBe(1);
    expect(isoWeekdayOf('2026-10-24')).toBe(6);
    expect(isoWeekdayOf('2026-10-25')).toBe(7);
  });

  it('refuses dates that do not exist', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
    expect(() => isoWeekdayOf('19/10/2026')).toThrow(RangeError);
    expect(() => addDays('2026-10-19', 0.5)).toThrow(RangeError);
  });
});

describe('tradingDayOn matches Postgres trading_day_on', () => {
  // Recorded from PostgreSQL 15.13: select trading_day_on('<instant>', '<tz>', <start_min>)
  const postgres: Array<[string, DayClock, string, string]> = [
    ['Mon 17:59 ET', TOP_CLOCK, '2026-10-19T21:59:00Z', '2026-10-19'],
    ['Mon 17:59:59 ET', TOP_CLOCK, '2026-10-19T21:59:59Z', '2026-10-19'],
    ['Mon 18:00 ET', TOP_CLOCK, '2026-10-19T22:00:00Z', '2026-10-20'],
    ['Mon 18:30 ET', TOP_CLOCK, '2026-10-19T22:30:00Z', '2026-10-20'],
    ['Fri 18:30 ET → Saturday', TOP_CLOCK, '2026-10-23T22:30:00Z', '2026-10-24'],
    ['Sun 17:59 ET', TOP_CLOCK, '2026-10-25T21:59:00Z', '2026-10-25'],
    ['Sun 18:00 ET → Monday', TOP_CLOCK, '2026-10-25T22:00:00Z', '2026-10-26'],
    ['Sat 31 Oct 18:00 EDT', TOP_CLOCK, '2026-10-31T22:00:00Z', '2026-11-01'],
    ['Sun 1 Nov 01:30 EDT (first)', TOP_CLOCK, '2026-11-01T05:30:00Z', '2026-11-01'],
    ['Sun 1 Nov 01:30 EST (second)', TOP_CLOCK, '2026-11-01T06:30:00Z', '2026-11-01'],
    ['Sun 1 Nov 17:59 EST', TOP_CLOCK, '2026-11-01T22:59:00Z', '2026-11-01'],
    ['Sun 1 Nov 18:00 EST', TOP_CLOCK, '2026-11-01T23:00:00Z', '2026-11-02'],
    ['Sat 7 Mar 18:00 EST', TOP_CLOCK, '2026-03-07T23:00:00Z', '2026-03-08'],
    ['Sun 8 Mar 03:30 EDT', TOP_CLOCK, '2026-03-08T07:30:00Z', '2026-03-08'],
    ['Sun 8 Mar 17:59 EDT', TOP_CLOCK, '2026-03-08T21:59:00Z', '2026-03-08'],
    ['Sun 8 Mar 18:00 EDT', TOP_CLOCK, '2026-03-08T22:00:00Z', '2026-03-09'],
    ['Mon 9 Mar 18:00 EDT', TOP_CLOCK, '2026-03-09T22:00:00Z', '2026-03-10'],
    ['Mon 23:59 Brasília', BIN_CLOCK, '2026-10-20T02:59:00Z', '2026-10-19'],
    ['Tue 00:00 Brasília', BIN_CLOCK, '2026-10-20T03:00:00Z', '2026-10-20'],
    ['Mon 21:00 Brasília = Tue 00:00 UTC', BIN_CLOCK, '2026-10-20T00:00:00Z', '2026-10-19'],
    ['Mon 22:30 Brasília = Tue 01:30 UTC', BIN_CLOCK, '2026-10-20T01:30:00Z', '2026-10-19'],
  ];

  it.each(postgres)('%s', (_label, clock, instant, expected) => {
    expect(tradingDayOn(new Date(instant), clock)).toBe(expected);
  });

  it('refuses a day clock it cannot compute', () => {
    expect(() => tradingDayOn(new Date(), { tz: NY, startMin: 1440 })).toThrow(RangeError);
    expect(() => tradingDayOn(new Date(), { tz: 'EST5EDT', startMin: 1080 })).toThrow(RangeError);
  });
});

describe('tradingDayBounds', () => {
  const iso = (d: Date) => d.toISOString().replace('.000Z', 'Z');

  it.each([
    ['futures Mon 19 Oct', TOP_CLOCK, '2026-10-19', '2026-10-18T22:00:00Z', '2026-10-19T22:00:00Z'],
    ['futures Sun 1 Nov (25 hours: the clock goes back)', TOP_CLOCK, '2026-11-01', '2026-10-31T22:00:00Z', '2026-11-01T23:00:00Z'],
    ['futures Mon 2 Nov', TOP_CLOCK, '2026-11-02', '2026-11-01T23:00:00Z', '2026-11-02T23:00:00Z'],
    ['futures Sun 8 Mar (23 hours)', TOP_CLOCK, '2026-03-08', '2026-03-07T23:00:00Z', '2026-03-08T22:00:00Z'],
    ['futures Mon 9 Mar', TOP_CLOCK, '2026-03-09', '2026-03-08T22:00:00Z', '2026-03-09T22:00:00Z'],
    ['binary Mon 19 Oct', BIN_CLOCK, '2026-10-19', '2026-10-19T03:00:00Z', '2026-10-20T03:00:00Z'],
  ])('%s', (_label, clock, day, start, end) => {
    const b = tradingDayBounds(day, clock);
    expect([iso(b.start), iso(b.end)]).toEqual([start, end]);
    expect(tradingDayOn(b.start, clock)).toBe(day);
    expect(tradingDayOn(new Date(b.end.getTime() - 1000), clock)).toBe(day);
    expect(tradingDayOn(b.end, clock)).toBe(addDays(day, 1));
  });
});

describe('window occurrences', () => {
  const topOne: TradingWindow = { tz: NY, startMin: 600, endMin: 660, weekdays: MON_TO_FRI };
  const ebinex: TradingWindow = { tz: SP, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI };
  const night: TradingWindow = { tz: SP, startMin: 1320, endMin: 120, weekdays: MON_TO_FRI };
  const iso = (d: Date | undefined) => d?.toISOString().replace('.000Z', 'Z');

  it('opens on the window weekdays only, from two days before to nine after', () => {
    const occ = windowOccurrences(new Date('2026-10-21T15:00:00Z'), [topOne]); // Wed
    expect(occ.map((o) => o.opensOn)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
    ]);
  });

  it('follows each change of offset: 10:00 ET is 14:00 UTC on Fri 30 Oct and 15:00 UTC on Mon 2 Nov', () => {
    const occ = windowOccurrences(new Date('2026-10-30T12:00:00Z'), [topOne], 0, 3);
    expect(occ.map((o) => [o.opensOn, iso(o.start), iso(o.end)])).toEqual([
      ['2026-10-30', '2026-10-30T14:00:00Z', '2026-10-30T15:00:00Z'],
      ['2026-11-02', '2026-11-02T15:00:00Z', '2026-11-02T16:00:00Z'],
    ]);
  });

  it('Ebinex 20:00–21:00 Brasília ends at midnight UTC', () => {
    const at = windowOccurrenceAt(new Date('2026-10-19T23:59:59Z'), [ebinex], BIN_CLOCK);
    expect([iso(at.current?.start), iso(at.current?.end), at.current?.tradingDay]).toEqual([
      '2026-10-19T23:00:00Z', '2026-10-20T00:00:00Z', '2026-10-19',
    ]);
    expect([at.current?.endOnClock.date, at.current?.endOnClock.hour]).toEqual(['2026-10-19', 21]);
    const after = windowOccurrenceAt(new Date('2026-10-20T00:00:00Z'), [ebinex], BIN_CLOCK);
    expect([after.current, iso(after.next?.start), after.next?.tradingDay]).toEqual([null, '2026-10-20T23:00:00Z', '2026-10-20']);
  });

  it('at the exact opening the occurrence is current and the next is the following one; at its close, none is current', () => {
    const open = windowOccurrenceAt(new Date('2026-10-19T14:00:00Z'), [topOne], TOP_CLOCK); // Mon 10:00:00 ET
    expect([iso(open.current?.start), iso(open.next?.start)]).toEqual(['2026-10-19T14:00:00Z', '2026-10-20T14:00:00Z']);
    const close = windowOccurrenceAt(new Date('2026-10-19T15:00:00Z'), [topOne], TOP_CLOCK); // Mon 11:00:00 ET
    expect([close.current, iso(close.next?.start)]).toEqual([null, '2026-10-20T14:00:00Z']);
  });

  it('gives the current and the next occurrence on the account clock', () => {
    const at = windowOccurrenceAt(new Date('2026-10-23T15:30:00Z'), [topOne], TOP_CLOCK); // Fri 11:30 ET
    expect(at.current).toBeNull();
    expect([iso(at.next?.start), at.next?.tradingDay, at.next?.startOnClock.isoWeekday, at.next?.startOnClock.hour]).toEqual([
      '2026-10-26T14:00:00Z', '2026-10-26', 1, 10,
    ]);
  });

  it('a window across midnight closes the next day', () => {
    const at = windowOccurrenceAt(new Date('2026-10-24T04:00:00Z'), [night], BIN_CLOCK); // Sat 01:00 Brasília
    expect([at.current?.opensOn, iso(at.current?.start), iso(at.current?.end), at.current?.tradingDay]).toEqual([
      '2026-10-23', '2026-10-24T01:00:00Z', '2026-10-24T05:00:00Z', '2026-10-23',
    ]);
  });
});

describe('tradingDayFor (the unified trading day) matches Postgres trading_day_for', () => {
  const ebinex: TradingWindow = { tz: SP, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI };
  const topOne: TradingWindow = { tz: NY, startMin: 600, endMin: 660, weekdays: MON_TO_FRI };
  const night: TradingWindow = { tz: SP, startMin: 1320, endMin: 120, weekdays: MON_TO_FRI };
  const across: TradingWindow = { tz: NY, startMin: 1020, endMin: 1140, weekdays: MON_TO_FRI };
  // Recorded from PostgreSQL 15.13: select trading_day_for('<windows>', '<tz>', <start_min>, '<instant>')
  const postgres: Array<[string, DayClock, TradingWindow, string, string]> = [
    ['Ebinex 20–21 Mon 20:59:59 (23:59:59 UTC)', BIN_CLOCK, ebinex, '2026-10-19T23:59:59Z', '2026-10-19'],
    ['Ebinex 20–21 Mon 21:00 (00:00 UTC Tue)', BIN_CLOCK, ebinex, '2026-10-20T00:00:00Z', '2026-10-19'],
    ['Top One 10–11 Mon 10:30 ET', TOP_CLOCK, topOne, '2026-10-19T14:30:00Z', '2026-10-19'],
    ['Top One 10–11 Mon 18:30 ET (outside: the 18:00 turn)', TOP_CLOCK, topOne, '2026-10-19T22:30:00Z', '2026-10-20'],
    ['Overnight 22–02 Mon 23:00', BIN_CLOCK, night, '2026-10-20T02:00:00Z', '2026-10-19'],
    ['Overnight 22–02 Tue 01:00 → Monday', BIN_CLOCK, night, '2026-10-20T04:00:00Z', '2026-10-19'],
    ['Overnight 22–02 Tue 02:00 → Tuesday (end exclusive)', BIN_CLOCK, night, '2026-10-20T05:00:00Z', '2026-10-20'],
    ['Overnight 22–02 Tue 03:00', BIN_CLOCK, night, '2026-10-20T06:00:00Z', '2026-10-20'],
    ['Overnight 22–02 Sat 01:00 → Friday', BIN_CLOCK, night, '2026-10-24T04:00:00Z', '2026-10-23'],
    ['Overnight 22–02 Mon 01:00 → Monday (no Sunday window)', BIN_CLOCK, night, '2026-10-19T04:00:00Z', '2026-10-19'],
    ['Across 18:00 ET 17–19 Mon 18:30 → Monday', TOP_CLOCK, across, '2026-10-19T22:30:00Z', '2026-10-19'],
    ['Across 18:00 ET 17–19 Mon 19:00 → Tuesday', TOP_CLOCK, across, '2026-10-19T23:00:00Z', '2026-10-20'],
    ['Across 18:00 ET 17–19 Fri 18:30 → Friday', TOP_CLOCK, across, '2026-10-23T22:30:00Z', '2026-10-23'],
    ['Across 18:00 ET 17–19 Sun 18:30 → Monday (no Sunday window)', TOP_CLOCK, across, '2026-10-25T22:30:00Z', '2026-10-26'],
  ];

  it.each(postgres)('%s', (_label, clock, window, instant, expected) => {
    expect(tradingDayFor(new Date(instant), clock, [window])).toBe(expected);
  });

  it('is the account day with no window', () => {
    expect(tradingDayFor(new Date('2026-10-19T22:30:00Z'), TOP_CLOCK, [])).toBe('2026-10-20');
  });
});

describe('offsets and the next daylight-saving change', () => {
  it('reads the offset in minutes', () => {
    expect(utcOffsetMinutes(new Date('2026-10-19T12:00:00Z'), NY)).toBe(-240);
    expect(utcOffsetMinutes(new Date('2026-11-02T12:00:00Z'), NY)).toBe(-300);
    expect(utcOffsetMinutes(new Date('2026-10-19T12:00:00Z'), SP)).toBe(-180);
  });

  it('finds New York\'s 1 Nov 2026 change within 14 days, to the second', () => {
    const change = nextOffsetChange(new Date('2026-10-18T12:00:00Z'), NY);
    expect(change).toEqual({ at: new Date('2026-11-01T06:00:00Z'), offsetBeforeMin: -240, offsetAfterMin: -300 });
  });

  it('finds the 8 Mar 2026 change', () => {
    expect(nextOffsetChange(new Date('2026-03-01T00:00:00Z'), NY, 14)).toEqual({
      at: new Date('2026-03-08T07:00:00Z'),
      offsetBeforeMin: -300,
      offsetAfterMin: -240,
    });
  });

  it('says nothing when the change is further away, and Brasília has none', () => {
    expect(nextOffsetChange(new Date('2026-10-17T00:00:00Z'), NY, 14)).toBeNull();
    expect(nextOffsetChange(new Date('2026-10-17T00:00:00Z'), SP, 365)).toBeNull();
  });

  it('refuses a negative range; a range of 0 days finds nothing', () => {
    expect(() => nextOffsetChange(new Date('2026-10-31T12:00:00Z'), NY, -1)).toThrow(RangeError);
    expect(nextOffsetChange(new Date('2026-11-01T05:59:59Z'), NY, 0)).toBeNull();
  });

  it('includes a change exactly at the end of the range', () => {
    const from = new Date(Date.parse('2026-11-01T06:00:00Z') - 14 * 86_400_000);
    expect(nextOffsetChange(from, NY, 14)?.at).toEqual(new Date('2026-11-01T06:00:00Z'));
  });
});

describe('"HH:MM" without Date', () => {
  it.each([
    ['10:00', 600],
    ['00:00', 0],
    ['23:59', 1439],
    ['9:05', 545],
    ['20:00:00', 1200],
    [' 18:00 ', 1080],
  ])('%s → %s', (text, minutes) => {
    expect(parseHhMm(text)).toBe(minutes);
  });

  it.each(['24:00', '10:60', '10', '10h00', '10:5', '10:00:30', '', '-1:00', '10:00 AM'])('refuses %p', (text) => {
    expect(parseHhMm(text)).toBeNull();
  });

  it('formats a minute of the day back', () => {
    expect(formatHhMm(600)).toBe('10:00');
    expect(formatHhMm(545)).toBe('09:05');
    expect(formatHhMm(1439)).toBe('23:59');
    expect(() => formatHhMm(1440)).toThrow(RangeError);
    for (let m = 0; m < 1440; m += 7) expect(parseHhMm(formatHhMm(m))).toBe(m);
  });
});

describe('an "HH:MM" typed on a clock, as an instant (Phase 3; the SQL parity is in registro/cases.test.ts)', () => {
  const NYC = 'America/New_York';
  const SAO = 'America/Sao_Paulo';

  it('reads the current minute on a clock', () => {
    expect(hmOn(new Date('2026-10-14T14:07:59.999Z'), NYC)).toBe('10:07');
    expect(hmOn(new Date('2026-10-14T14:07:59.999Z'), SAO)).toBe('11:07');
  });

  it('resolves near an instant: today’s, or yesterday’s when 12 hours or more ahead', () => {
    const at = new Date('2026-10-14T14:07:30Z');
    expect(resolveLocalHm('10:07', NYC, at)).toEqual(new Date('2026-10-14T14:07:00Z'));
    expect(resolveLocalHm('22:07', NYC, at)).toEqual(new Date('2026-10-15T02:07:00Z'));
    expect(resolveLocalHm('22:08', NYC, at)).toEqual(new Date('2026-10-14T02:08:00Z'));
  });

  it('places an hour on a trading day, and an exit at or after an entry', () => {
    const futuresDay = (d: Date) => tradingDayOn(d, { tz: NYC, startMin: 1080 });
    expect(localHmInTradingDay('2026-10-15', '18:30', NYC, futuresDay)).toEqual(new Date('2026-10-14T22:30:00Z'));
    expect(localHmInTradingDay('2026-10-15', '10:00', NYC, futuresDay)).toEqual(new Date('2026-10-15T14:00:00Z'));
    expect(localHmInTradingDay('2026-10-15', '10:00', NYC, () => '2026-10-16')).toBeNull();
    // Two candidates on the same trading day: the latest wins (SQL: order by c desc limit 1).
    // An overnight window 15:01–04:37 that does not open on Tuesday: Tue 20 Oct 22:16 is outside any
    // window, so it counts on the futures clock (after 18:00 → Wed 21); Wed 21 22:16 is inside
    // Wednesday's window, which opened on Wed 21; Thu 22 22:16 is Thursday's.
    const night = { tz: NYC, startMin: 901, endMin: 277, weekdays: weekdayMask(['mon', 'wed', 'thu', 'fri']) };
    const withWindow = (d: Date) => tradingDayFor(d, { tz: NYC, startMin: 1080 }, [night]);
    expect(withWindow(new Date('2026-10-21T02:16:00Z'))).toBe('2026-10-21');
    expect(withWindow(new Date('2026-10-22T02:16:00Z'))).toBe('2026-10-21');
    expect(localHmInTradingDay('2026-10-21', '22:16', NYC, withWindow)).toEqual(new Date('2026-10-22T02:16:00Z'));
    // Every candidate on the day: the day after's
    expect(localHmInTradingDay('2026-10-15', '10:00', NYC, () => '2026-10-15')).toEqual(new Date('2026-10-16T14:00:00Z'));
    expect(firstLocalHmAtOrAfter(new Date('2026-10-14T14:33:00Z'), '10:33', NYC)).toEqual(new Date('2026-10-14T14:33:00Z'));
    expect(firstLocalHmAtOrAfter(new Date('2026-10-14T14:33:00Z'), '10:20', NYC)).toEqual(new Date('2026-10-15T14:20:00Z'));
  });

  it('refuses what is not an hour', () => {
    expect(() => resolveLocalHm('24:00', NYC, new Date())).toThrow(RangeError);
    expect(() => firstLocalHmAtOrAfter(new Date(), '10h', NYC)).toThrow(RangeError);
    expect(() => resolveLocalHm('10:00', '-03:00', new Date())).toThrow(RangeError);
  });
});
