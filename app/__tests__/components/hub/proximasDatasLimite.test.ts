/**
 * @jest-environment node
 */
/** Phase 5-1 · D3: the next-dates read at PostgREST's 1,000-row cap drops its last, maybe cut, instant */
import type { AgendaRow } from '@/lib/domain/gate'
import { cortarNoLimite } from '@/components/hub/personalizar/useProximasDatas'

const row = (iso: string): AgendaRow => ({ code: 'cpi', calendar: 'us', at: new Date(iso), wasAt: null, status: 'agendado', day: iso.slice(0, 10), localTz: 'America/New_York' })

describe('cortarNoLimite', () => {
  it('under the cap the rows stay', () => {
    const rows = [row('2027-01-13T13:30:00Z'), row('2027-02-10T13:30:00Z')]
    expect(cortarNoLimite(rows, 3)).toEqual(rows)
  })
  it('at the cap the last instant leaves (it may be cut)', () => {
    const rows = [row('2027-01-13T13:30:00Z'), row('2027-02-10T13:30:00Z'), row('2027-02-10T13:30:00Z')]
    expect(cortarNoLimite(rows, 3)).toEqual([rows[0]])
  })
})
