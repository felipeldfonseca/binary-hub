/**
 * @jest-environment node
 */
import { randomBytes } from 'crypto'
import { fakeAgendaDb, type FakeAgendaDb } from '@/testing/agendaFakeDb'

let db: FakeAgendaDb
const mockCreateServiceClient = jest.fn()
jest.mock('@/lib/server/supabaseAdmin', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}))

import { GET } from '@/app/api/cron/agenda/route'

// Made at run time, so no secret-like literal sits in the public repository
const SECRET = randomBytes(24).toString('hex')
const KEY = randomBytes(24).toString('hex')
const URL_ = 'https://example.invalid'
const beaJson = {
  'Gross Domestic Product': { release_dates: Array.from({ length: 12 }, (_, m) => `2026-${String(m + 1).padStart(2, '0')}-25T13:30:00+00:00`).concat(Array.from({ length: 12 }, (_, m) => `2027-${String(m + 1).padStart(2, '0')}-25T13:30:00+00:00`)) },
  'Personal Income and Outlays': { release_dates: ['2026-11-25T13:30:00+00:00', '2026-12-23T13:30:00+00:00'] },
}

/** A request that only exposes the Authorization header: touching anything else (url, body, json) throws */
function cronRequest(authorization?: string): Request {
  const headers = new Headers(authorization === undefined ? {} : { authorization })
  return new Proxy({} as Request, {
    get(_target, prop) {
      if (prop === 'headers') return headers
      throw new Error(`the route read request.${String(prop)}`)
    },
  })
}

const env = { ...process.env }
const fetchMock = jest.fn()

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-20T09:05:00Z'), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })
  process.env = { ...env, CRON_SECRET: SECRET, SUPABASE_SERVICE_ROLE_KEY: KEY, NEXT_PUBLIC_SUPABASE_URL: URL_ }
  db = fakeAgendaDb()
  mockCreateServiceClient.mockReset()
  mockCreateServiceClient.mockImplementation(() => db.client)
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => beaJson })
  global.fetch = fetchMock as unknown as typeof fetch
})
afterEach(() => {
  jest.useRealTimers()
  process.env = env
})

describe('GET /api/cron/agenda: the secret', () => {
  it.each([
    ['no header', undefined],
    ['a wrong secret of the same length', `Bearer ${SECRET.replace(/.$/, 'X')}`],
    ['a wrong secret of another length', 'Bearer short'],
    ['the secret without Bearer', SECRET],
    ['a user token', 'Bearer user-session-forged'],
  ])('401 with %s, nothing read or written', async (_name, header) => {
    const res = await GET(cronRequest(header))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('401 when CRON_SECRET is unset, even with an empty Bearer', async () => {
    delete process.env.CRON_SECRET
    for (const header of [undefined, 'Bearer ', 'Bearer undefined']) {
      const res = await GET(cronRequest(header))
      expect(res.status).toBe(401)
    }
    expect(mockCreateServiceClient).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/agenda: the load', () => {
  const auth = `Bearer ${SECRET}`

  it.each([['SUPABASE_SERVICE_ROLE_KEY'], ['NEXT_PUBLIC_SUPABASE_URL']])('503 sem_chave without %s', async (name) => {
    delete process.env[name]
    const res = await GET(cronRequest(auth))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'sem_chave' })
    expect(db.writes).toEqual([])
  })

  it.each([['PGRST205'], ['42P01']])('503 sem_tabelas when the client answers %s, nothing written', async (code) => {
    db.failNext('economic_events', 'select', code)
    const res = await GET(cronRequest(auth))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'sem_tabelas' })
    expect(db.writes).toEqual([])
  })

  it('200 with the counts, the coverage and what is missing; never echoes a header or a key', async () => {
    const res = await GET(cronRequest(auth))
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(text).not.toContain(SECRET)
    expect(text).not.toContain(KEY)
    expect(text).not.toContain(URL_)
    const body = JSON.parse(text)
    expect(Object.keys(body).sort()).toEqual(['coverage', 'events', 'missing', 'ok', 'sources'])
    expect(body.ok).toBe(true)
    expect(body.sources).toEqual({ bea: 'ok' })
    expect(body.events.inserted).toBe(db.events.length)
    expect(body.events).toEqual({ inserted: db.events.length, updated: 0, unchanged: 0 })
    // 20 Nov 2026 04:05 New York: dates 19..23 Nov in the three calendars (the real lists)
    expect(body.coverage).toHaveLength(15)
    expect(body.missing).toEqual([])
    expect(db.days.every((d) => d.source === 'rota')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://apps.bea.gov/API/signup/release_dates.json')
  })

  it('writing twice gives the same result', async () => {
    const first = await (await GET(cronRequest(auth))).json()
    const rows = JSON.stringify(db.events)
    const second = await (await GET(cronRequest(auth))).json()
    expect(second.events).toEqual({ inserted: 0, updated: 0, unchanged: first.events.inserted })
    expect(second.coverage).toEqual(first.coverage)
    expect(JSON.stringify(db.events)).toBe(rows)
  })

  it('a failing BEA: 200, sources falhou, no `us` coverage', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })
    const body = await (await GET(cronRequest(auth))).json()
    expect(body.sources).toEqual({ bea: 'falhou' })
    expect(body.coverage.filter((c: { calendar: string }) => c.calendar === 'us')).toEqual([])
    expect(body.missing.every((m: { calendar: string; codes: string[] }) => m.calendar === 'us' && m.codes.join() === 'pce,pib_us')).toBe(true)
  })

  it('another database error: 500 without the database text', async () => {
    db.failNext('economic_events', 'upsert', '42501')
    const res = await GET(cronRequest(auth))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ ok: false, error: 'erro' })
  })
})
