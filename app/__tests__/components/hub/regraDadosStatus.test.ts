/**
 * @jest-environment node
 */
/**
 * Phase 5-1 · the status line «Hoje: …» of «Dados econômicos» (c3 §3.10), the edges no board draws: 0 and 0
 * minutes with «Aguardo em volta do horário» next to other behaviours (c3 l.679: the sentence's ending
 * changes), and a wait carried over the 18:00 New York turn of the day, named as «Como fica hoje» shows it.
 */
import { releasesOf, type AgendaRead, type AgendaRow, type ReleaseCode, type ReleaseMode, type Rules } from '@/lib/domain/gate'
import { topOneRules } from '@/testing/gate'
import { et, leituraDoDia } from '@/testing/agenda'
import { modosDaRegra } from '@/lib/hub/comoFicaHoje'
import { statusDados, type EstadoDados } from '@/components/hub/personalizar/regraDados'

function regras(patch: Partial<Record<ReleaseCode, ReleaseMode>> = {}, block: Partial<NonNullable<Rules['block']>> = {}): Rules {
  const r = topOneRules()
  const b = { ...r.block!, ...block }
  const map: Record<string, ReleaseMode> = { ...releasesOf(b), ...patch }
  const releases = Object.fromEntries(Object.entries(map).filter(([, v]) => v !== 'normal')) as NonNullable<Rules['block']>['releases']
  return { ...r, block: { ...b, releases } }
}
const estadoDe = (r: Rules): EstadoDados => ({
  on: r.block!.on,
  beforeMin: r.block!.beforeMin,
  afterMin: r.block!.afterMin,
  propria: false,
  modos: modosDaRegra(r),
  proprios: [],
  calendars: r.block!.calendars,
  atalho: 'personalizado',
})
const status = (r: Rules, when: string, agenda: AgendaRead = leituraDoDia(et(when))) => statusDados(estadoDe(r), r, agenda, et(when)).replace(/ /g, ' ')

describe('«Hoje: …» at the edges (c3 §3.10)', () => {
  it('0 and 0 minutes, «Aguardo» today next to other behaviours: the ending is c3 l.679\'s, after the comma', () => {
    const r = regras({ payroll: 'depois' }, { beforeMin: 0, afterMin: 0 })
    expect(status(r, '2026-12-10 07:00')).toBe('Hoje: CPI às 08:30 ET, com 0 minuto antes e depois, “Aguardo em volta do horário” não cria espera.')
  })

  it('a wait carried over 18:00 New York is named on the new day, as «Como fica hoje» shows it', () => {
    const when = '2026-12-10 18:02'
    // the world's CPI of 10 Dec moved to 17:55, in the 18:02 read (E5 reads from a lead before the day)
    const cpi = leituraDoDia(et('2026-12-10 07:00')).rows.find((x: AgendaRow) => x.code === 'cpi' && x.day === '2026-12-10')!
    const read = leituraDoDia(et(when))
    const agenda: AgendaRead = { ...read, rows: [{ ...cpi, at: et('2026-12-10 17:55') }, ...read.rows] }
    expect(status(regras(), when, agenda)).toBe('Hoje: CPI às 17:55 ET, você aguarda das 17:50 às 18:05.')
  })
})
