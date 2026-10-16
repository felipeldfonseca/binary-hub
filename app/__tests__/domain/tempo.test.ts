/**
 * @jest-environment node
 */
import {
  EVERY_DAY,
  MON_TO_FRI,
  assertTimeZone,
  classifyLocalTime,
  inWindow,
  isValidWindow,
  localToUtc,
  opensOn,
  tradingDay,
  utcToLocal,
  weekdayMask,
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
});
