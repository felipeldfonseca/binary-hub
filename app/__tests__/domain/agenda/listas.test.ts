import { AGENDA_RELEASES, type ReleaseCode } from '@/lib/domain/gate/agenda'
import { AGENDA_LISTS, BEA_CODES, type ListCode } from '@/lib/domain/agenda/listas'
import {
  PUBLISHER_TZ,
  PUBLISHING_TIME,
  RULE_CODES,
  SOURCE_TITLE,
  lastTuesday,
  nthUsBusinessDay,
  ruleDates,
} from '@/lib/domain/agenda/regrasOrgaos'
import { HORA_HABITUAL } from '@/lib/hub/dadosEconomicos'
import { isZoneName, localToUtc } from '@/lib/domain/tempo'

const LIST_CODES = AGENDA_RELEASES.map((r) => r.code).filter(
  (c) => !(BEA_CODES as readonly string[]).includes(c),
) as ListCode[]
const DATE = /^\d{4}-\d{2}-\d{2}$/
const validDate = (d: string) => DATE.test(d) && new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) === d

describe('the yearly lists', () => {
  it('cover every code but the BEA two', () => {
    expect(Object.keys(AGENDA_LISTS).sort()).toEqual([...LIST_CODES].sort())
  })

  it.each(LIST_CODES)('%s has a 2026 block; dates valid, sorted, inside the block, one per day', (code) => {
    const blocks = AGENDA_LISTS[code]
    expect(blocks.some((b) => b.year === 2026)).toBe(true)
    for (const b of blocks) {
      expect(validDate(b.from) && validDate(b.through)).toBe(true)
      expect(b.from <= b.through).toBe(true)
      expect(b.from.slice(0, 4)).toBe(String(b.year))
      expect(b.through.slice(0, 4)).toBe(String(b.year))
      expect(b.source).toMatch(/^https:\/\/|rule/)
      expect(validDate(b.read)).toBe(true)
      const dates = b.entries.map((e) => e.date)
      expect([...dates].sort()).toEqual(dates)
      expect(new Set(dates).size).toBe(dates.length)
      for (const e of b.entries) {
        expect(validDate(e.date)).toBe(true)
        expect(e.date >= b.from && e.date <= b.through).toBe(true)
        if (e.time !== undefined) expect(e.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
        if (e.original !== undefined) expect(validDate(e.original)).toBe(true)
      }
    }
  })

  it('has 2027 where the publisher has published it; NAR 2027 is missing (open point O4)', () => {
    const with2027 = LIST_CODES.filter((c) => AGENDA_LISTS[c].some((b) => b.year === 2027))
    expect(LIST_CODES.filter((c) => !with2027.includes(c))).toEqual(['casas_usadas'])
    // IBGE has published only the first 2027 dates
    expect(AGENDA_LISTS.ipca.find((b) => b.year === 2027)?.through).toBe('2027-01-12')
    expect(AGENDA_LISTS.pib_br.find((b) => b.year === 2027)?.through).toBe('2027-03-02')
  })

  it('the default publishing times are the publisher-zone times of HORA_HABITUAL', () => {
    for (const r of AGENDA_RELEASES) {
      expect({ code: r.code, hora: PUBLISHING_TIME[r.code], tz: PUBLISHER_TZ[r.code] }).toEqual({
        code: r.code,
        ...HORA_HABITUAL[r.code],
      })
      expect(isZoneName(PUBLISHER_TZ[r.code])).toBe(true)
      expect(SOURCE_TITLE[r.code].length).toBeGreaterThan(0)
      expect(SOURCE_TITLE[r.code].length).toBeLessThanOrEqual(120)
    }
  })

  it('times are on the publisher clock: the ECB at 14:15 Frankfurt is 08:15 New York in December', () => {
    const at = localToUtc({ year: 2026, month: 12, day: 17, hour: 14, minute: 15 }, PUBLISHER_TZ.bce_decisao)
    expect(at.toISOString()).toBe('2026-12-17T13:15:00.000Z')
    expect(AGENDA_LISTS.bce_decisao.flatMap((b) => b.entries).map((e) => e.date)).toContain('2026-12-17')
  })

  it('carries the December 2026 and January 2027 dates of c2 §4 (FOMC 2027 as the 18 Nov 2026 page lists it)', () => {
    const dates = (code: ListCode) => AGENDA_LISTS[code].flatMap((b) => b.entries.map((e) => e.date))
    const expected: Partial<Record<ReleaseCode, string[]>> = {
      hicp_eu: ['2026-12-01', '2027-01-06'],
      pib_br: ['2026-12-02'],
      jolts: ['2026-12-01', '2027-01-05'],
      ism_ind: ['2026-12-01', '2027-01-04'],
      ism_serv: ['2026-12-03', '2027-01-06'],
      payroll: ['2026-12-04', '2027-01-08'],
      fomc_decisao: ['2026-12-09', '2027-01-27'],
      fomc_entrevista: ['2026-12-09', '2027-01-27'],
      casas_usadas: ['2026-12-09'],
      copom: ['2026-12-09', '2027-01-27'],
      cpi: ['2026-12-10', '2027-01-13'],
      ipca: ['2026-12-11', '2027-01-12'],
      ppi: ['2026-12-15', '2027-01-14'],
      varejo_us: ['2026-12-16', '2027-01-15'],
      bce_decisao: ['2026-12-17'],
      bce_entrevista: ['2026-12-17'],
      casas_novas: ['2026-12-23', '2027-01-27'],
      confianca_us: ['2026-12-29', '2027-01-26'],
    }
    for (const [code, want] of Object.entries(expected) as [ListCode, string[]][]) {
      const got = dates(code).filter((d) => d >= '2026-12-01' && d <= '2027-01-31')
      expect({ code, got }).toEqual({ code, got: want })
    }
    expect(dates('fomc_decisao').filter((d) => d.startsWith('2027'))).toHaveLength(8)
  })
})

describe('the publishers rules', () => {
  it('ISM: 1st and 3rd US business day (1 and 3 Dec 2026; 4 and 6 Jan 2027 after New Year)', () => {
    expect(nthUsBusinessDay(2026, 12, 1)).toBe('2026-12-01')
    expect(nthUsBusinessDay(2026, 12, 3)).toBe('2026-12-03')
    expect(nthUsBusinessDay(2027, 1, 1)).toBe('2027-01-04')
    expect(nthUsBusinessDay(2027, 1, 3)).toBe('2027-01-06')
    // a holiday inside the count: Labor Day, Mon 7 Sep 2026
    expect(nthUsBusinessDay(2026, 9, 1)).toBe('2026-09-01')
    expect(nthUsBusinessDay(2027, 9, 1)).toBe('2027-09-01')
    expect(nthUsBusinessDay(2027, 2, 1)).toBe('2027-02-01')
  })

  it('Conference Board: last Tuesday (24 Nov 2026, the page next release)', () => {
    expect(lastTuesday(2026, 11)).toBe('2026-11-24')
    expect(lastTuesday(2026, 12)).toBe('2026-12-29')
    expect(lastTuesday(2027, 1)).toBe('2027-01-26')
  })

  it('every rule gives twelve dates a year, flagged as rule blocks', () => {
    for (const code of RULE_CODES) {
      expect(ruleDates(code, 2026)).toHaveLength(12)
      expect(AGENDA_LISTS[code].every((b) => b.rule === true)).toBe(true)
    }
  })
})
