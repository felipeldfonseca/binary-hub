/**
 * @jest-environment node
 */
import {
  addSeconds,
  candleSeconds,
  ebinexExit,
  floorMinute,
  fractionMs,
  minuteOfDay,
  parseBrDateTime,
  parseIsoDateTime,
  secondsBetween,
  toLocalDateTime,
  type FileStamp,
} from '@/lib/domain/import';

describe('parseBrDateTime', () => {
  it('reads DD/MM/YYYY HH:MM:SS as a zone-less local stamp', () => {
    expect(parseBrDateTime('15/03/2026 20:14:52')).toEqual({ local: '2026-03-15T20:14:52', offset: null });
    expect(parseBrDateTime(' 01/12/2025  00:00:00 ')).toEqual({ local: '2025-12-01T00:00:00', offset: null });
  });

  it('checks the calendar', () => {
    expect(parseBrDateTime('31/02/2026 20:00:00')).toBeNull();
    expect(parseBrDateTime('29/02/2026 10:00:00')).toBeNull();
    expect(parseBrDateTime('29/02/2028 10:00:00')).toEqual({ local: '2028-02-29T10:00:00', offset: null });
    expect(parseBrDateTime('29/02/2100 10:00:00')).toBeNull();
    expect(parseBrDateTime('29/02/2000 10:00:00')).not.toBeNull();
    expect(parseBrDateTime('31/04/2026 10:00:00')).toBeNull();
    expect(parseBrDateTime('00/01/2026 10:00:00')).toBeNull();
    expect(parseBrDateTime('01/13/2026 10:00:00')).toBeNull();
  });

  it('checks the clock', () => {
    expect(parseBrDateTime('15/03/2026 24:00:00')).toBeNull();
    expect(parseBrDateTime('13/03/2026 25:00:00')).toBeNull();
    expect(parseBrDateTime('15/03/2026 23:60:00')).toBeNull();
    expect(parseBrDateTime('15/03/2026 23:59:60')).toBeNull();
  });

  it('refuses other shapes and implausible years', () => {
    expect(parseBrDateTime('2026-03-15 20:14:52')).toBeNull();
    expect(parseBrDateTime('15/03/2026')).toBeNull();
    expect(parseBrDateTime('15/03/26 20:14:52')).toBeNull();
    expect(parseBrDateTime('15/03/0026 20:14:52')).toBeNull();
    expect(parseBrDateTime('')).toBeNull();
  });
});

describe('parseIsoDateTime', () => {
  it.each([
    ['2025-08-12T23:41:57.318+00:00', '2025-08-12T23:41:57.318', '+00:00'],
    ['2025-08-13T00:20:40.500Z', '2025-08-13T00:20:40.500', '+00:00'],
    ['2025-08-12T20:30:10.250-03:00', '2025-08-12T20:30:10.250', '-03:00'],
    ['2025-08-12 23:30:00', '2025-08-12T23:30:00', null],
    ['2025-08-12T23:30:00.123456+05:30', '2025-08-12T23:30:00.123456', '+05:30'],
    ['2025-08-12T23:30:00+14:00', '2025-08-12T23:30:00', '+14:00'],
    ['2025-08-12T23:30:00-12:00', '2025-08-12T23:30:00', '-12:00'],
  ])('%s', (text, local, offset) => {
    expect(parseIsoDateTime(text)).toEqual({ local, offset });
  });

  it.each([
    ['2025-08-12T23:30:00+15:00'],
    ['2025-08-12T23:30:00+14:30'],
    ['2025-08-12T23:30:00+03:60'],
    ['2025-02-30T10:00:00Z'],
    ['2025-08-12T24:00:00Z'],
    ['2025-08-12T23:30:00.1234567Z'],
    ['2025-08-12T23:30Z'],
    ['2025-08-12'],
    ['12/08/2025 23:30:00'],
  ])('rejects %s', (text) => {
    expect(parseIsoDateTime(text)).toBeNull();
  });
});

describe('local stamp arithmetic (no zone)', () => {
  it('addSeconds crosses midnight, month end and year end', () => {
    expect(addSeconds('2026-03-15T23:59:41', 79)).toBe('2026-03-16T00:01:00');
    expect(addSeconds('2026-02-28T23:59:00', 120)).toBe('2026-03-01T00:01:00');
    expect(addSeconds('2028-02-28T23:59:00', 120)).toBe('2028-02-29T00:01:00');
    expect(addSeconds('2025-12-31T23:59:30', 60)).toBe('2026-01-01T00:00:30');
    expect(addSeconds('2026-01-01T00:00:10', -20)).toBe('2025-12-31T23:59:50');
  });

  it('addSeconds keeps the fraction and refuses partial seconds', () => {
    expect(addSeconds('2025-08-12T23:59:59.318', 1)).toBe('2025-08-13T00:00:00.318');
    expect(() => addSeconds('2025-08-12T23:59:59', 0.5)).toThrow(RangeError);
  });

  it('ignores daylight saving: São Paulo’s skipped midnight is just a clock time', () => {
    expect(addSeconds('2018-11-03T23:59:00', 3600)).toBe('2018-11-04T00:59:00');
  });

  it('floorMinute drops seconds and fraction', () => {
    expect(floorMinute('2025-08-12T23:41:57.318')).toBe('2025-08-12T23:41:00');
    expect(floorMinute('2026-03-15T20:14:00')).toBe('2026-03-15T20:14:00');
  });

  it('secondsBetween counts fractions and crosses days', () => {
    expect(secondsBetween('2026-03-11T14:10:00', '2026-03-11T15:12:31')).toBe(3751);
    expect(secondsBetween('2026-03-12T15:00:00', '2026-03-12T14:59:00')).toBe(-60);
    expect(secondsBetween('2025-08-12T23:59:59.900', '2025-08-13T00:00:00.100')).toBeCloseTo(0.2, 9);
  });

  it('refuses text that is not a stamp', () => {
    expect(() => floorMinute('2026-02-30T00:00:00')).toThrow(RangeError);
    expect(() => toLocalDateTime('15/03/2026 20:14:52')).toThrow(RangeError);
  });

  it('toLocalDateTime, fractionMs and minuteOfDay', () => {
    expect(toLocalDateTime('2025-08-12T23:41:57.318')).toEqual({
      year: 2025,
      month: 8,
      day: 12,
      hour: 23,
      minute: 41,
      second: 57,
    });
    expect(fractionMs('2025-08-12T23:41:57.318')).toBe(318);
    expect(fractionMs('2025-08-12T23:41:57.5')).toBe(500);
    expect(fractionMs('2025-08-12T23:41:57.123456')).toBe(123);
    expect(fractionMs('2025-08-12T23:41:57')).toBe(0);
    expect(minuteOfDay('2026-03-15T20:14:52')).toBe(20 * 60 + 14);
  });
});

describe('candleSeconds', () => {
  it.each([
    ['M1', 60],
    ['m5', 300],
    ['M15', 900],
    ['M30', 1800],
    ['H1', 3600],
    ['1m', 60],
    ['5M', 300],
    ['1h', 3600],
    [' M1 ', 60],
  ])('%j → %d', (tempo, s) => {
    expect(candleSeconds(tempo)).toBe(s);
  });

  it.each([['X9'], ['H4'], ['M0'], ['M61'], [''], ['S30'], ['M 1'], ['1d']])('%j → null', (tempo) => {
    expect(candleSeconds(tempo)).toBeNull();
  });
});

describe('ebinexExit: Vela opening + one candle', () => {
  const br = (local: string): FileStamp => ({ local, offset: null });
  const utc = (local: string): FileStamp => ({ local, offset: '+00:00' });

  it('20:14:52, Vela 20:15, M1 → 20:16:00', () => {
    expect(ebinexExit(br('2026-03-15T20:14:52'), '20:15', 60)).toBe('2026-03-15T20:16:00');
  });

  it('entered at :59 seconds still runs a whole candle', () => {
    expect(ebinexExit(br('2026-03-15T20:47:59'), '20:48', 60)).toBe('2026-03-15T20:49:00');
  });

  it('23:59:41, Vela 00:00 → next day 00:01:00', () => {
    expect(ebinexExit(br('2026-03-15T23:59:41'), '00:00', 60)).toBe('2026-03-16T00:01:00');
  });

  it('M5: Vela up to 5 minutes ahead', () => {
    expect(ebinexExit(br('2026-03-16T20:40:40'), '20:45', 300)).toBe('2026-03-16T20:50:00');
  });

  it('ISO UTC row, Vela on the Brasília clock: matched by minute of the hour', () => {
    expect(ebinexExit(utc('2025-08-12T23:41:57.318'), '20:42', 60)).toBe('2025-08-12T23:43:00');
  });

  it('ISO 23:59:30.100+00:00, Vela 21:00 → 2025-08-13T00:01:00 (crosses hour and day)', () => {
    expect(ebinexExit(utc('2025-08-12T23:59:30.100'), '21:00', 60)).toBe('2025-08-13T00:01:00');
  });

  it('a -03:00 row is on Vela’s own clock', () => {
    expect(ebinexExit({ local: '2025-08-12T20:30:10.250', offset: '-03:00' }, '20:31', 60)).toBe('2025-08-12T20:32:00');
  });

  it('Vela further than one candle → null', () => {
    expect(ebinexExit(br('2026-03-16T20:50:50'), '20:55', 60)).toBeNull();
  });

  it('Vela on the entry minute (an hour away) → null', () => {
    expect(ebinexExit(br('2026-03-16T20:50:50'), '20:50', 60)).toBeNull();
  });

  it('same clock, right minute, wrong hour → null', () => {
    expect(ebinexExit(br('2026-03-15T20:14:52'), '21:15', 60)).toBeNull();
  });

  it('the hour is not checked when the row has an offset', () => {
    expect(ebinexExit(utc('2026-03-15T20:14:52'), '21:15', 60)).toBe('2026-03-15T20:16:00');
  });

  it('unreadable Vela → null', () => {
    expect(ebinexExit(br('2026-03-15T20:14:52'), '', 60)).toBeNull();
    expect(ebinexExit(br('2026-03-15T20:14:52'), '20:15:00', 60)).toBeNull();
    expect(ebinexExit(br('2026-03-15T20:14:52'), '24:15', 60)).toBeNull();
    expect(ebinexExit(br('2026-03-15T20:14:52'), '20:75', 60)).toBeNull();
  });
});
