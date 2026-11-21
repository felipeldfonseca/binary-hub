/**
 * The agenda's hooks (Phase 5-1, contract §3.8): the cache key, the clock day D on the server clock
 * (the read changes key at 18:00 New York for futures), an account change, no read without an account.
 * Invented data only (the boards' world: Top One on 18:00 New York).
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import * as agendaDb from '@/lib/hub/agendaDb'
import { agendaKeys, calendarsKeyOf, useAgendaDoDia, useCoberturaProxima, useDadosDaSemana, useProximasDatas, type AgendaConta } from '@/hooks/useAgenda'
import { RELOGIO_TOP, et } from '@/testing/agenda'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))
jest.mock('@/lib/hub/agendaDb', () => ({
  ...jest.requireActual('@/lib/hub/agendaDb'),
  fetchAgendaDoDia: jest.fn(),
  fetchDadosDaSemana: jest.fn(),
  fetchProximasDatas: jest.fn(),
  fetchCoberturaProxima: jest.fn(),
}))

const db = agendaDb as jest.Mocked<typeof agendaDb>

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, wrapper }
}

const top: AgendaConta = { calendars: ['us'], clock: RELOGIO_TOP }
const vazio = {} as Awaited<ReturnType<typeof agendaDb.fetchAgendaDoDia>>

/** The keys the hook's queries hold */
const diaKeys = (qc: QueryClient) =>
  qc
    .getQueryCache()
    .getAll()
    .map((q) => q.queryKey)
    .filter((k) => k[3] === 'dia' && k[5] !== '') // a null account's disabled query holds ['', '']

beforeEach(() => {
  jest.clearAllMocks()
  db.fetchAgendaDoDia.mockResolvedValue(vazio)
  db.fetchDadosDaSemana.mockResolvedValue([])
  db.fetchProximasDatas.mockResolvedValue([])
  db.fetchCoberturaProxima.mockResolvedValue({ covered: [], ate: '2026-12-17' })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('the key (contract §3.8)', () => {
  it('calendarsKey = the codes sorted, joined by \',\'', () => {
    expect(calendarsKeyOf(['us'])).toBe('us')
    expect(calendarsKeyOf(['eu', 'us'])).toBe('eu,us')
    expect(calendarsKeyOf(['us', 'eu', 'br'])).toBe('br,eu,us')
    expect(calendarsKeyOf(['us', 'br'])).toEqual(calendarsKeyOf(['br', 'us']))
    expect(agendaKeys.dia('user-1', calendarsKeyOf(['eu', 'us']), '2026-12-03')).toEqual(['hub', 'user-1', 'agenda', 'dia', 'eu,us', '2026-12-03'])
  })
})

describe('useAgendaDoDia', () => {
  it('reads D on the account\'s clock, and again with D+1 when the clock day turns at 18:00 New York', async () => {
    jest.useFakeTimers({ now: et('2026-12-09 17:59:30') })
    const { queryClient, wrapper } = setup()
    renderHook(() => useAgendaDoDia(top), { wrapper })
    await waitFor(() => expect(db.fetchAgendaDoDia).toHaveBeenCalledTimes(1))
    expect(diaKeys(queryClient)).toEqual([agendaKeys.dia('user-1', 'us', '2026-12-09')])

    await act(async () => {
      jest.advanceTimersByTime(31_000) // 18:00:01 ET
    })
    await waitFor(() => expect(db.fetchAgendaDoDia).toHaveBeenCalledTimes(2))
    expect(diaKeys(queryClient)).toContainEqual(agendaKeys.dia('user-1', 'us', '2026-12-10'))
    const [, arg] = db.fetchAgendaDoDia.mock.calls[1]
    expect(arg.calendars).toEqual(['us'])
    expect(arg.at.getTime()).toBeGreaterThanOrEqual(et('2026-12-09 18:00').getTime())
  })

  it('an account change changes the key and reads again; a null account reads nothing', async () => {
    jest.useFakeTimers({ now: et('2026-12-03 09:00') })
    const { queryClient, wrapper } = setup()
    const { rerender } = renderHook(({ conta }: { conta: AgendaConta | null }) => useAgendaDoDia(conta), {
      wrapper,
      initialProps: { conta: null as AgendaConta | null },
    })
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(db.fetchAgendaDoDia).not.toHaveBeenCalled()

    rerender({ conta: top })
    await waitFor(() => expect(db.fetchAgendaDoDia).toHaveBeenCalledTimes(1))
    rerender({ conta: { calendars: ['us', 'eu'], clock: RELOGIO_TOP } })
    await waitFor(() => expect(db.fetchAgendaDoDia).toHaveBeenCalledTimes(2))
    expect(diaKeys(queryClient)).toEqual([agendaKeys.dia('user-1', 'us', '2026-12-03'), agendaKeys.dia('user-1', 'eu,us', '2026-12-03')])
  })

  it('enabled: false reads nothing', async () => {
    jest.useFakeTimers({ now: et('2026-12-03 09:00') })
    const { wrapper } = setup()
    renderHook(() => useAgendaDoDia(top, { enabled: false }), { wrapper })
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(db.fetchAgendaDoDia).not.toHaveBeenCalled()
  })
})

describe('useDadosDaSemana', () => {
  it('keyed by the week\'s first day; null reads nothing', async () => {
    const { queryClient, wrapper } = setup()
    const { rerender } = renderHook(({ w }: { w: { weekOf: string; start: Date; end: Date } | null }) => useDadosDaSemana(w), {
      wrapper,
      initialProps: { w: null as { weekOf: string; start: Date; end: Date } | null },
    })
    expect(db.fetchDadosDaSemana).not.toHaveBeenCalled()
    const w = { weekOf: '2026-12-07', start: et('2026-12-06 18:00'), end: et('2026-12-13 18:00') }
    rerender({ w })
    await waitFor(() => expect(db.fetchDadosDaSemana).toHaveBeenCalledWith(expect.anything(), { start: w.start, end: w.end }))
    expect(queryClient.getQueryCache().find({ queryKey: agendaKeys.semana('user-1', '2026-12-07') })).toBeDefined()
  })
})

describe('useProximasDatas (Personalizar\'s «Próxima» column)', () => {
  it('agendaKeys.proximas on today\'s clock day; 400 days from that day\'s start; enabled: false reads nothing', async () => {
    jest.useFakeTimers({ now: et('2026-12-03 19:00') }) // after 18:00 ET: the Top One day is 4 Dec
    const { queryClient, wrapper } = setup()
    const { rerender } = renderHook(({ on }: { on: boolean }) => useProximasDatas(RELOGIO_TOP, { enabled: on }), { wrapper, initialProps: { on: false } })
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(db.fetchProximasDatas).not.toHaveBeenCalled()
    rerender({ on: true })
    await waitFor(() => expect(db.fetchProximasDatas).toHaveBeenCalledTimes(1))
    expect(db.fetchProximasDatas.mock.calls[0][1]).toEqual({ from: et('2026-12-03 18:00'), days: agendaDb.PROXIMAS_DATAS_DIAS })
    expect(queryClient.getQueryCache().find({ queryKey: agendaKeys.proximas('user-1', '2026-12-04') })).toBeDefined()
    expect(agendaKeys.proximas('user-1', '2026-12-04').slice(0, 3)).toEqual(agendaKeys.all('user-1'))
  })
})

describe('useCoberturaProxima («Depois de {dia}»)', () => {
  it('the account\'s calendars from today on its clock, 14 days; a null account reads nothing', async () => {
    jest.useFakeTimers({ now: et('2026-12-03 09:00') })
    const { queryClient, wrapper } = setup()
    const { rerender } = renderHook(({ conta }: { conta: AgendaConta | null }) => useCoberturaProxima(conta), {
      wrapper,
      initialProps: { conta: null as AgendaConta | null },
    })
    await act(async () => {
      jest.advanceTimersByTime(100)
    })
    expect(db.fetchCoberturaProxima).not.toHaveBeenCalled()
    rerender({ conta: { calendars: ['us', 'eu'], clock: RELOGIO_TOP } })
    await waitFor(() => expect(db.fetchCoberturaProxima).toHaveBeenCalledTimes(1))
    expect(db.fetchCoberturaProxima.mock.calls[0][1]).toEqual({ calendars: ['us', 'eu'], from: '2026-12-03', days: 14 })
    expect(queryClient.getQueryCache().find({ queryKey: agendaKeys.cobertura('user-1', 'eu,us', '2026-12-03') })).toBeDefined()
  })
})
