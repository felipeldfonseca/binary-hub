import { CME_HOLIDAYS, CME_HOLIDAYS_SOURCE, cmeHolidayOn, isUsHoliday } from '@/lib/domain/agenda/feriados'
import { addDays, isoWeekdayOf } from '@/lib/domain/tempo'

const pad = (n: number) => String(n).padStart(2, '0')
const nthWeekday = (year: number, month: number, isoWeekday: number, n: number) => {
  let d = `${year}-${pad(month)}-01`
  while (isoWeekdayOf(d) !== isoWeekday) d = addDays(d, 1)
  return addDays(d, 7 * (n - 1))
}
const lastWeekday = (year: number, month: number, isoWeekday: number) => {
  let d = addDays(month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`, -1)
  while (isoWeekdayOf(d) !== isoWeekday) d = addDays(d, -1)
  return d
}
const observed = (d: string) => (isoWeekdayOf(d) === 6 ? addDays(d, -1) : isoWeekdayOf(d) === 7 ? addDays(d, 1) : d)

/** The eleven US federal holidays by statute (5 U.S.C. 6103), on their observed day */
function federal(year: number): string[] {
  return [
    observed(`${year}-01-01`),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    lastWeekday(year, 5, 1),
    observed(`${year}-06-19`),
    observed(`${year}-07-04`),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 10, 1, 2),
    observed(`${year}-11-11`),
    nthWeekday(year, 11, 4, 4),
    observed(`${year}-12-25`),
  ]
}

describe('CME holidays (US federal holidays only, no CME source)', () => {
  it('is sorted, one entry per date, all closed days with a name', () => {
    const dates = CME_HOLIDAYS.map((h) => h.date)
    expect([...dates].sort()).toEqual(dates)
    expect(new Set(dates).size).toBe(dates.length)
    for (const h of CME_HOLIDAYS) {
      expect(h.kind).toBe('fechado')
      expect(h.closeNy).toBeUndefined()
      expect(h.nome.length).toBeGreaterThan(0)
      expect(isoWeekdayOf(h.date)).toBeLessThanOrEqual(5)
    }
    expect(CME_HOLIDAYS_SOURCE).toBe('us_federal')
  })

  it('holds exactly the federal holidays of 2026 and 2027 (and New Year 2028 observed on 31 Dec 2027)', () => {
    const expected = [...federal(2026), ...federal(2027), observed('2028-01-01')].sort()
    expect(CME_HOLIDAYS.map((h) => h.date)).toEqual(expected)
  })

  it('Thanksgiving 2026 is Thursday 26 Nov', () => {
    expect(cmeHolidayOn('2026-11-26')).toEqual({ date: '2026-11-26', kind: 'fechado', nome: 'Ação de Graças' })
    expect(isoWeekdayOf('2026-11-26')).toBe(4)
    expect(isUsHoliday('2026-11-26')).toBe(true)
    expect(isUsHoliday('2026-11-27')).toBe(false)
    expect(cmeHolidayOn('2026-11-27')).toBeNull()
  })
})
