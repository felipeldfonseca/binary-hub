/**
 * @jest-environment node
 */
import fs from 'fs'
import path from 'path'
import { AGENDA_RELEASES, type ReleaseCode } from '@/lib/domain/gate/agenda'
import { parseBea, type BeaResult } from '@/lib/domain/agenda/bea'
import {
  CALENDARS,
  coverableUntil,
  exportCoverableUntil,
  newYorkDate,
  orderUpdates,
  planLoad,
  reconcile,
  runLoad,
  type StoredRow,
} from '@/lib/domain/agenda/carga'
import { AGENDA_LISTS, BEA_CODES, type AgendaLists, type ListBlock, type ListCode } from '@/lib/domain/agenda/listas'
import { addDays, localToUtc } from '@/lib/domain/tempo'
import { fakeAgendaDb } from '@/testing/agendaFakeDb'

// ---------------------------------------------------------------------------------------------------------------
// Invented lists: every list code, whole years, one release a month on day `10 + ord % 10`

const LIST_CODES = AGENDA_RELEASES.filter((r) => !(BEA_CODES as readonly string[]).includes(r.code))
const fakeBlock = (year: number, day: number): ListBlock => ({
  year,
  from: `${year}-01-01`,
  through: `${year}-12-31`,
  source: 'invented',
  read: '2026-11-20',
  entries: Array.from({ length: 12 }, (_, m) => ({ date: `${year}-${String(m + 1).padStart(2, '0')}-${day}` })),
})
function fakeLists(years: readonly number[] = [2026, 2027]): Record<ListCode, ListBlock[]> {
  return Object.fromEntries(
    LIST_CODES.map((r) => [r.code, years.map((y) => fakeBlock(y, 10 + (r.ord % 10)))]),
  ) as Record<ListCode, ListBlock[]>
}
const beaFile = (dates: string[]) => ({
  'Gross Domestic Product': { release_dates: dates },
  'Personal Income and Outlays': { release_dates: dates },
})
const monthlyBea = (year: number, day = 25) =>
  Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, '0')}-${day}T13:30:00+00:00`)
const BEA_OK = parseBea(beaFile([...monthlyBea(2026), ...monthlyBea(2027)]), '2026-11-20')
const BEA_FAIL: BeaResult = { ok: false }

const ny = (date: string, hm: string) => {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hm.split(':').map(Number)
  return localToUtc({ year: y, month: m, day: d, hour: hh, minute: mm }, 'America/New_York')
}
const span = (today: string) => [-1, 0, 1, 2, 3].map((o) => addDays(today, o))

describe('planLoad: coverage', () => {
  it.each([
    ['2026-11-20', '00:30'],
    ['2026-11-20', '09:00'],
    ['2026-11-20', '18:30'],
    ['2026-11-20', '23:30'],
    // the US fall-back day (1 Nov 2026) and spring-forward day (14 Mar 2027)
    ['2026-11-01', '00:30'],
    ['2026-11-01', '23:30'],
    ['2027-03-14', '00:30'],
    ['2027-03-14', '23:30'],
  ])('covers the New York dates now − 1 .. now + 3 on %s at %s New York', (date, hm) => {
    const plan = planLoad(fakeLists(), BEA_OK, ny(date, hm))
    expect(plan.today).toBe(date)
    for (const calendar of CALENDARS) {
      expect(plan.coverage.filter((c) => c.calendar === calendar).map((c) => c.day)).toEqual(span(date))
    }
    expect(plan.missing).toEqual([])
  })

  it('a failing BEA leaves every `us` date uncovered (never half); eu and br stay covered', () => {
    const plan = planLoad(fakeLists(), BEA_FAIL, ny('2026-11-20', '04:00'))
    expect(plan.sources).toEqual({ bea: 'falhou' })
    expect(plan.coverage.filter((c) => c.calendar === 'us')).toEqual([])
    expect(plan.missing).toEqual(span('2026-11-20').map((day) => ({ calendar: 'us', day, codes: ['pce', 'pib_us'] })))
    expect(plan.coverage.filter((c) => c.calendar !== 'us')).toHaveLength(10)
    expect(plan.events.some((e) => e.source === 'bea')).toBe(false)
  })

  it('a code without the year list leaves its calendar uncovered from that year on', () => {
    const lists = fakeLists()
    lists.casas_usadas = lists.casas_usadas.filter((b) => b.year === 2026)
    const plan = planLoad(lists, BEA_OK, ny('2026-12-29', '04:00'))
    expect(plan.coverage.filter((c) => c.calendar === 'us').map((c) => c.day)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
    ])
    expect(plan.missing).toEqual([{ calendar: 'us', day: '2027-01-01', codes: ['casas_usadas'] }])
    expect(coverableUntil('us', '2026-12-29', lists, BEA_OK)).toBe('2026-12-31')
    expect(coverableUntil('us', '2027-01-02', lists, BEA_OK)).toBeNull()
  })

  it('every (calendar, date) of the window is either covered or missing, once', () => {
    const lists = fakeLists([2026])
    const plan = planLoad(lists, BEA_OK, ny('2026-12-30', '12:00'))
    const seen = [...plan.coverage, ...plan.missing].map((c) => `${c.calendar} ${c.day}`)
    expect(new Set(seen).size).toBe(15)
    expect(seen).toHaveLength(15)
  })
})

describe('planLoad: rows', () => {
  it('writes every list and BEA entry with the publisher clock and zone, never `at` or `day`', () => {
    const plan = planLoad(fakeLists(), BEA_OK, ny('2026-11-20', '04:00'))
    expect(plan.events).toHaveLength(LIST_CODES.length * 24 + 2 * 24)
    const cpi = plan.events.find((e) => e.code === 'cpi' && e.local_at.startsWith('2026-12'))
    expect(cpi).toEqual({
      source: 'lista',
      source_key: 'cpi:2026-12-11',
      code: 'cpi',
      calendar: 'us',
      title: 'Consumer Price Index',
      local_at: '2026-12-11T08:30:00',
      local_tz: 'America/New_York',
      status: 'agendado',
    })
    const ecb = plan.events.find((e) => e.code === 'bce_decisao')!
    expect([ecb.local_at.slice(11), ecb.local_tz]).toEqual(['14:15:00', 'Europe/Berlin'])
    const pce = plan.events.find((e) => e.code === 'pce' && e.local_at.startsWith('2026-07'))!
    expect([pce.source, pce.source_key, pce.local_at]).toEqual(['bea', 'pce:2026-07-25', '2026-07-25T09:30:00'])
    for (const e of plan.events) {
      expect(Object.keys(e).sort()).toEqual(['calendar', 'code', 'local_at', 'local_tz', 'source', 'source_key', 'status', 'title'])
    }
  })

  it('the real lists and an answering BEA cover the three calendars on 20 Nov 2026', () => {
    const plan = planLoad(AGENDA_LISTS, BEA_OK, ny('2026-11-20', '04:00'))
    expect(plan.missing).toEqual([])
    expect(plan.coverage).toHaveLength(15)
    const keys = plan.events.map((e) => `${e.source}:${e.source_key}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

// ---------------------------------------------------------------------------------------------------------------

const listsWith = (code: ListCode, entries: ListBlock['entries']): AgendaLists => {
  const lists = fakeLists()
  lists[code] = [{ ...lists[code][0], entries }, lists[code][1]]
  return lists
}

describe('runLoad', () => {
  const NOW = ny('2026-11-20', '04:00')

  it('writes both tables with the service client and gives the counts; twice gives the same', async () => {
    const db = fakeAgendaDb()
    const first = await runLoad(db.client, NOW, { lists: fakeLists(), bea: BEA_OK })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const total = LIST_CODES.length * 24 + 48
    expect(first.events).toEqual({ inserted: total, updated: 0, unchanged: 0 })
    expect(first.sources).toEqual({ bea: 'ok' })
    expect(db.events).toHaveLength(total)
    expect(db.days.map((d) => [d.calendar, d.day, d.source])).toHaveLength(15)
    expect(db.days.every((d) => d.source === 'rota' && d.fetched_at === NOW.toISOString())).toBe(true)
    // the trigger's instant: CPI 08:30 New York on 11 Dec 2026 (EST)
    expect(db.events.find((e) => e.source_key === 'cpi:2026-12-11')?.at).toBe('2026-12-11T13:30:00+00:00')

    const snapshot = JSON.stringify(db.events)
    const later = new Date(NOW.getTime() + 3600_000)
    const second = await runLoad(db.client, later, { lists: fakeLists(), bea: BEA_OK })
    expect(second.ok && second.events).toEqual({ inserted: 0, updated: 0, unchanged: total })
    expect(JSON.stringify(db.events)).toBe(snapshot)
    expect(db.days).toHaveLength(15)
    // reconcile against the first run's rows: all unchanged
    const stored = db.events as unknown as StoredRow[]
    const plan = planLoad(fakeLists(), BEA_OK, later)
    expect(reconcile(stored, plan)).toEqual({
      inserts: [],
      updates: [],
      unchanged: total,
    })
  })

  it.each([['economic_events'], ['economic_calendar_days']] as const)(
    'answers sem_tabelas and writes nothing when %s is missing',
    async (table) => {
      const db = fakeAgendaDb({ missing: [table] })
      expect(await runLoad(db.client, NOW, { lists: fakeLists(), bea: BEA_OK })).toEqual({ ok: false, error: 'sem_tabelas' })
      expect(db.writes).toEqual([])
    },
  )

  it('maps 42P01 to sem_tabelas too; another error throws with its code only', async () => {
    const a = fakeAgendaDb()
    a.failNext('economic_events', 'select', '42P01')
    expect(await runLoad(a.client, NOW, { lists: fakeLists(), bea: BEA_OK })).toEqual({ ok: false, error: 'sem_tabelas' })
    const b = fakeAgendaDb()
    b.failNext('economic_events', 'select', '42501')
    await expect(runLoad(b.client, NOW, { lists: fakeLists(), bea: BEA_OK })).rejects.toMatchObject({ code: '42501' })
    expect(b.writes).toEqual([])
  })

  it('reads past the 1 000-row page', async () => {
    const db = fakeAgendaDb()
    const lists = fakeLists([2026, 2027])
    // 3 years of daily invented CPI dates: > 1 000 rows
    lists.cpi = [2026, 2027, 2028].map((year) => ({
      year,
      from: `${year}-01-01`,
      through: `${year}-12-31`,
      source: 'invented',
      read: '2026-11-20',
      entries: Array.from({ length: 365 }, (_, i) => ({ date: addDays(`${year}-01-01`, i) })),
    }))
    const first = await runLoad(db.client, NOW, { lists, bea: BEA_OK })
    const second = await runLoad(db.client, NOW, { lists, bea: BEA_OK })
    expect(first.ok && second.ok && second.events.inserted).toBe(0)
    expect(db.events.length).toBeGreaterThan(1000)
  })

  it('a moved release moves the row of its original date, writes was_at once and keeps it on a second move', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: listsWith('cpi', [{ date: '2026-12-10' }]), bea: BEA_OK })
    const before = db.events.length
    const row = () => db.events.find((e) => e.source_key === 'cpi:2026-12-10')!
    expect(row().was_at).toBeNull()

    const moved = await runLoad(db.client, NOW, {
      lists: listsWith('cpi', [{ date: '2026-12-18', original: '2026-12-10' }]),
      bea: BEA_OK,
    })
    expect(moved.ok && moved.events.updated).toBe(1)
    expect(db.events).toHaveLength(before)
    expect([row().local_at, row().day, row().at, row().was_at]).toEqual([
      '2026-12-18T08:30:00',
      '2026-12-18',
      '2026-12-18T13:30:00+00:00',
      '2026-12-10T13:30:00+00:00',
    ])

    await runLoad(db.client, NOW, {
      lists: listsWith('cpi', [{ date: '2026-12-22', time: '10:00', original: '2026-12-10' }]),
      bea: BEA_OK,
    })
    expect(db.events).toHaveLength(before)
    expect([row().at, row().was_at]).toEqual(['2026-12-22T15:00:00+00:00', '2026-12-10T13:30:00+00:00'])
  })

  it('a cancelled release keeps its row with status cancelado', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: listsWith('payroll', [{ date: '2026-12-04' }]), bea: BEA_OK })
    const r = await runLoad(db.client, NOW, {
      lists: listsWith('payroll', [{ date: '2026-12-04', status: 'cancelado' }]),
      bea: BEA_OK,
    })
    expect(r.ok && r.events.updated).toBe(1)
    const row = db.events.find((e) => e.source_key === 'payroll:2026-12-04')!
    expect([row.status, row.was_at, row.local_at]).toEqual(['cancelado', null, '2026-12-04T08:30:00'])
  })

  it('a list release postponed without a date becomes adiado; its new date later moves it (was_at once, agendado)', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: listsWith('payroll', [{ date: '2026-12-04' }]), bea: BEA_OK })
    const before = db.events.length
    const row = () => db.events.find((e) => e.source_key === 'payroll:2026-12-04')!
    await runLoad(db.client, NOW, { lists: listsWith('payroll', [{ date: '2026-12-04', status: 'adiado' }]), bea: BEA_OK })
    expect([row().status, row().was_at, row().local_at]).toEqual(['adiado', null, '2026-12-04T08:30:00'])
    await runLoad(db.client, ny('2026-12-08', '04:00'), {
      lists: listsWith('payroll', [{ date: '2026-12-16', original: '2026-12-04' }]),
      bea: BEA_OK,
    })
    expect(db.events).toHaveLength(before)
    expect([row().status, row().local_at, row().was_at]).toEqual(['agendado', '2026-12-16T08:30:00', '2026-12-04T13:30:00+00:00'])
  })

  it('a corrected default hour (no `original`) moves only rows from today on, and never writes was_at', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: listsWith('copom', [{ date: '2026-11-04' }, { date: '2026-12-09' }]), bea: BEA_OK })
    const row = (key: string) => db.events.find((e) => e.source_key === key)!
    const r = await runLoad(db.client, NOW, {
      lists: listsWith('copom', [
        { date: '2026-11-04', time: '18:45' },
        { date: '2026-12-09', time: '18:45' },
      ]),
      bea: BEA_OK,
    })
    expect(r.ok && r.events.updated).toBe(1)
    expect([row('copom:2026-12-09').local_at, row('copom:2026-12-09').was_at]).toEqual(['2026-12-09T18:45:00', null])
    expect([row('copom:2026-11-04').local_at, row('copom:2026-11-04').was_at]).toEqual(['2026-11-04T18:30:00', null])
  })

  it('a time the publisher moves on the same date (`original` = the date) writes was_at once', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: listsWith('cpi', [{ date: '2026-12-10' }]), bea: BEA_OK })
    await runLoad(db.client, NOW, {
      lists: listsWith('cpi', [{ date: '2026-12-10', time: '10:00', original: '2026-12-10' }]),
      bea: BEA_OK,
    })
    const row = db.events.find((e) => e.source_key === 'cpi:2026-12-10')!
    expect([row.local_at, row.was_at]).toEqual(['2026-12-10T10:00:00', '2026-12-10T13:30:00+00:00'])
  })
})

describe('orderUpdates: moves free their days first', () => {
  const stored = (id: number, code: string, day: string): StoredRow => ({
    id,
    source: 'bea',
    source_key: `${code}:${day}`,
    code,
    calendar: 'us',
    title: 't',
    local_at: `${day}T08:30:00`,
    local_tz: 'America/New_York',
    at: '',
    status: 'agendado',
    was_at: null,
  })
  it('a row moving into a day another row leaves goes after it; a cycle keeps its order', () => {
    const rows = [stored(1, 'pce', '2027-01-07'), stored(2, 'pce', '2027-01-14'), stored(3, 'pib_us', '2027-01-14')]
    const a = { id: 1, patch: { local_at: '2027-01-14T08:30:00' } }
    const b = { id: 2, patch: { local_at: '2027-01-21T08:30:00' } }
    const c = { id: 3, patch: { status: 'adiado' as const } }
    expect(orderUpdates(rows, [a, c, b]).map((u) => u.id)).toEqual([3, 2, 1])
    const swapA = { id: 1, patch: { local_at: '2027-01-14T08:30:00' } }
    const swapB = { id: 2, patch: { local_at: '2027-01-07T08:30:00' } }
    expect(orderUpdates(rows, [swapA, swapB]).map((u) => u.id)).toEqual([1, 2])
  })
})

describe('reconcile: the BEA postponed release', () => {
  const NOW = ny('2026-11-20', '04:00')
  const bea = (dates: string[]) => parseBea(beaFile(dates), '2026-11-20')
  const y2026 = monthlyBea(2026)
  const base = [...y2026, ...monthlyBea(2027)]

  it('moves a future row the file no longer lists to the new date before the next one', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(base) })
    const count = db.events.length
    const next = [...y2026.slice(0, 11), '2027-01-06T13:30:00+00:00', ...monthlyBea(2027)]
    const r = await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(next) })
    expect(r.ok && r.events).toEqual({ inserted: 0, updated: 2, unchanged: count - 2 })
    expect(db.events).toHaveLength(count)
    const pce = db.events.find((e) => e.source_key === 'pce:2026-12-25')!
    expect([pce.day, pce.at, pce.was_at, pce.status]).toEqual(['2027-01-06', '2027-01-06T13:30:00+00:00', '2026-12-25T13:30:00+00:00', 'agendado'])
    // a later run finds the moved row by its date: nothing changes
    const again = await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(next) })
    expect(again.ok && again.events).toEqual({ inserted: 0, updated: 0, unchanged: count })
  })

  it('without a new date the row becomes adiado; a past row the file drops is left alone', async () => {
    const db = fakeAgendaDb()
    await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(base) })
    const dropped = base.filter((d) => !d.startsWith('2026-12') && !d.startsWith('2026-10'))
    const r = await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(dropped) })
    expect(r.ok && r.events.updated).toBe(2)
    const status = (key: string) => db.events.find((e) => e.source_key === key)!.status
    expect(status('pce:2026-12-25')).toBe('adiado')
    expect(status('pib_us:2026-12-25')).toBe('adiado')
    expect(status('pce:2026-10-25')).toBe('agendado')
  })

  const on23 = (year: number) => monthlyBea(year, 23)
  const row = (db: ReturnType<typeof fakeAgendaDb>, key: string) => db.events.find((e) => e.source_key === key)
  const pick = (r: ReturnType<typeof row>) => r && [r.local_at.slice(0, 10), r.status, r.was_at]

  it('a date postponed and then restored: the move frees its day before the new row is written (code, day unique)', async () => {
    const db = fakeAgendaDb()
    const full = [...on23(2026), ...on23(2027)]
    await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(full) })
    const postponed = full.filter((d) => !d.startsWith('2026-12')).concat('2027-01-07T13:30:00+00:00').sort()
    await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(postponed) })
    expect(pick(row(db, 'pce:2026-12-23'))).toEqual(['2027-01-07', 'agendado', '2026-12-23T13:30:00+00:00'])
    const restored = [...full, '2027-01-07T13:30:00+00:00'].sort()
    const r = await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(restored) })
    expect(r.ok && r.events.inserted).toBe(2)
    expect(pick(row(db, 'pce:2026-12-23'))?.slice(0, 2)).toEqual(['2026-12-23', 'agendado'])
    expect(pick(row(db, 'pce:2027-01-07'))).toEqual(['2027-01-07', 'agendado', null])
    const again = await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(restored) })
    expect(again.ok && [again.events.inserted, again.events.updated]).toEqual([0, 0])
  })

  it('adiado, the original day passes, then the new date: the same row moves (was_at once, agendado)', async () => {
    const db = fakeAgendaDb()
    const full = [...on23(2026), ...on23(2027)]
    await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(full) })
    const dropped = full.filter((d) => !d.startsWith('2026-12'))
    await runLoad(db.client, ny('2026-12-20', '04:00'), { lists: fakeLists(), bea: bea(dropped) })
    expect(pick(row(db, 'pce:2026-12-23'))).toEqual(['2026-12-23', 'adiado', null])
    const count = db.events.length
    const later = [...dropped, '2027-01-14T13:30:00+00:00'].sort()
    const r = await runLoad(db.client, ny('2027-01-05', '04:00'), { lists: fakeLists(), bea: bea(later) })
    expect(r.ok && r.events.inserted).toBe(0)
    expect(db.events).toHaveLength(count)
    expect(pick(row(db, 'pce:2026-12-23'))).toEqual(['2027-01-14', 'agendado', '2026-12-23T13:30:00+00:00'])
    expect(row(db, 'pce:2027-01-14')).toBeUndefined()
  })

  it('a date moved earlier moves its row too (was_at once), never adiado', async () => {
    const db = fakeAgendaDb()
    const full = [...on23(2026), ...on23(2027)]
    await runLoad(db.client, NOW, { lists: fakeLists(), bea: bea(full) })
    const count = db.events.length
    const earlier = full.map((d) => (d.startsWith('2027-06-23') ? '2027-06-16T13:30:00+00:00' : d))
    const r = await runLoad(db.client, ny('2027-06-01', '04:00'), { lists: fakeLists(), bea: bea(earlier) })
    expect(r.ok && [r.events.inserted, r.events.updated]).toEqual([0, 2])
    expect(db.events).toHaveLength(count)
    expect(pick(row(db, 'pce:2027-06-23'))).toEqual(['2027-06-16', 'agendado', '2027-06-23T13:30:00+00:00'])
    expect(pick(row(db, 'pib_us:2027-06-23'))).toEqual(['2027-06-16', 'agendado', '2027-06-23T13:30:00+00:00'])
  })
})

// ---------------------------------------------------------------------------------------------------------------
// The kit's first load (contract §6 step 4.3): BH_AGENDA_EXPORT=<out.json> BH_AGENDA_BEA=<release_dates.json>

const exportPath = process.env.BH_AGENDA_EXPORT
const exportIt = exportPath ? it : it.skip

describe('export for the paste kit', () => {
  exportIt('writes every event row of the lists period and coverableUntil per calendar', () => {
    const beaPath = process.env.BH_AGENDA_BEA
    if (!beaPath) throw new Error('BH_AGENDA_BEA=<the BEA release_dates.json read today> is required with BH_AGENDA_EXPORT')
    const now = new Date()
    // a BEA file that does not read gives `us: null` (contract §6 4.3), never a failed export
    const bea = parseBea(JSON.parse(fs.readFileSync(beaPath, 'utf8')), newYorkDate(now))
    if (!bea.ok) console.warn('agenda export: the BEA file did not read; coverableUntil.us = null')
    const full = planLoad(AGENDA_LISTS, bea, now)
    // the kit covers from its paste day − 1: the run starts at the export's New York day − 1 (null when that day
    // itself cannot be covered)
    const coverable = Object.fromEntries(
      CALENDARS.map((c) => [c, exportCoverableUntil(c, full.today, AGENDA_LISTS, bea)]),
    )
    const out = {
      generatedAt: now.toISOString(),
      today: full.today,
      sources: full.sources,
      events: full.events,
      coverableUntil: coverable,
    }
    fs.mkdirSync(path.dirname(exportPath!), { recursive: true })
    fs.writeFileSync(exportPath!, JSON.stringify(out, null, 2) + '\n')
    const codes = new Set(full.events.map((e) => e.code as ReleaseCode))
    expect(codes.size).toBe(bea.ok ? 20 : 18)
  })
})

describe('exportCoverableUntil (the export\'s rule)', () => {
  it('starts at the export day − 1; a failed BEA gives us: null', () => {
    const lists = fakeLists([2026])
    lists.casas_usadas = [{ ...lists.casas_usadas[0], from: '2026-11-20' }]
    expect(exportCoverableUntil('us', '2026-11-21', lists, BEA_OK)).toBe('2026-12-31')
    // day − 1 = 19 Nov is not held by casas_usadas: null, although 20 Nov on is
    expect(exportCoverableUntil('us', '2026-11-20', lists, BEA_OK)).toBeNull()
    expect(exportCoverableUntil('us', '2026-11-21', lists, BEA_FAIL)).toBeNull()
    expect(exportCoverableUntil('eu', '2026-11-21', lists, BEA_FAIL)).toBe('2026-12-31')
  })
})
