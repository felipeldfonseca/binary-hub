import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import * as diarioDb from '@/lib/hub/diarioDb'
import { hubKeys } from '@/hooks/useContas'
import { registrarKeys } from '@/hooks/useRegistrar'
import {
  SIGNED_URLS_STALE_MS,
  diarioKeys,
  invalidateDiario,
  isCurrentDay,
  isCurrentMonth,
  useDayImages,
  useDiarioCalendario,
  useDiarioDia,
  useDiarioMes,
  useSaveDayNote,
  useSaveDayReview,
} from '@/hooks/useDiario'
import { notePayload, reviewPayload } from '@/lib/domain/diario'
import { diarioJson } from '@/testing/diarioDb'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/diarioDb', () => {
  const actual = jest.requireActual('@/lib/hub/diarioDb')
  return {
    ...actual,
    fetchCalendario: jest.fn(),
    fetchMes: jest.fn(),
    fetchDia: jest.fn(),
    saveDayReview: jest.fn(),
    saveDayNote: jest.fn(),
    signedImageUrls: jest.fn(),
  }
})

const db = diarioDb as jest.Mocked<typeof diarioDb>
const KEY = '0b3f1c2a-1111-4c2d-8e3f-000000000001'

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, wrapper }
}

beforeEach(() => {
  jest.clearAllMocks()
  db.fetchCalendario.mockResolvedValue(diarioDb.parseCalendar(diarioJson('calendario-top')))
  db.fetchMes.mockResolvedValue(diarioDb.parseMonth(diarioJson('mes-top-2026-10')))
  db.fetchDia.mockResolvedValue(diarioDb.parseDay(diarioJson('dia-top-1022')))
  db.saveDayReview.mockResolvedValue(diarioDb.parseReviewSaved(diarioJson('revisao-1022')))
  db.saveDayNote.mockResolvedValue(diarioDb.parseNoteSaved(diarioJson('nota-1023')))
  db.signedImageUrls.mockResolvedValue({ 'u/t/a.webp': 'https://x/a' })
})

describe('keys', () => {
  it('sit under the hub\'s and the account\'s prefix', () => {
    for (const key of [
      diarioKeys.all('u'),
      diarioKeys.conta('u', 'a'),
      diarioKeys.calendario('u', 'a'),
      diarioKeys.mes('u', 'a', '2026-10'),
      diarioKeys.dia('u', 'a', '2026-10-22'),
      diarioKeys.imagens('u', 'a', 't', 'p1,p2'),
    ]) {
      expect(key.slice(0, 2)).toEqual(hubKeys.all('u'))
      expect(key.slice(0, 3)).toEqual(['hub', 'u', 'diario'])
    }
    for (const key of [diarioKeys.calendario('u', 'a'), diarioKeys.mes('u', 'a', '2026-10'), diarioKeys.dia('u', 'a', '2026-10-22')]) {
      expect(key.slice(0, 4)).toEqual(diarioKeys.conta('u', 'a'))
    }
  })

  it('only the current month and today are read again on focus', () => {
    expect([isCurrentMonth('2026-10', '2026-10-26'), isCurrentMonth('2026-09', '2026-10-26'), isCurrentMonth('2026-09', null)]).toEqual([true, false, true])
    expect([isCurrentDay('2026-10-26', '2026-10-26'), isCurrentDay('2026-10-22', '2026-10-26'), isCurrentDay('2026-10-22', undefined)]).toEqual([true, false, true])
    expect(SIGNED_URLS_STALE_MS).toBe(9 * 60_000)
  })

  it('invalidateDiario: one account, or every account', async () => {
    const queryClient = new QueryClient()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')
    await invalidateDiario(queryClient, 'u', 'a')
    await invalidateDiario(queryClient, 'u')
    expect(spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).toEqual([
      ['hub', 'u', 'diario', 'a'],
      ['hub', 'u', 'diario'],
    ])
  })
})

describe('reads', () => {
  it('the calendar, the month and the day; each answer\'s clock is kept', async () => {
    const { wrapper, queryClient } = setup()
    const { result } = renderHook(
      () => ({
        cal: useDiarioCalendario('acc-1'),
        mes: useDiarioMes('acc-1', '2026-10', { today: '2026-10-26' }),
        dia: useDiarioDia('acc-1', '2026-10-22', { today: '2026-10-26' }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.cal.isSuccess && result.current.mes.isSuccess && result.current.dia.isSuccess).toBe(true))
    expect(db.fetchCalendario).toHaveBeenCalledWith(expect.anything(), 'acc-1')
    expect(db.fetchMes).toHaveBeenCalledWith(expect.anything(), 'acc-1', '2026-10')
    expect(db.fetchDia).toHaveBeenCalledWith(expect.anything(), 'acc-1', '2026-10-22')
    expect(result.current.cal.data?.today).toBe('2026-10-26')
    expect(queryClient.getQueryData(registrarKeys.relogio('user-1'))).toMatchObject({ offsetMs: expect.any(Number) })
    // A past day is never read again on focus; the calendar always
    expect(queryClient.getQueryCache().find({ queryKey: diarioKeys.dia('user-1', 'acc-1', '2026-10-22') })?.options).toMatchObject({ refetchOnWindowFocus: false })
    expect(queryClient.getQueryCache().find({ queryKey: diarioKeys.calendario('user-1', 'acc-1') })?.options).toMatchObject({ refetchOnWindowFocus: 'always' })
    expect(queryClient.getQueryCache().find({ queryKey: diarioKeys.mes('user-1', 'acc-1', '2026-10') })?.options).toMatchObject({ refetchOnWindowFocus: 'always' })
  })

  it('on focus: the calendar, the current month and today are read again; a past month and a past day are not', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        cal: useDiarioCalendario('acc-1'),
        mesAgora: useDiarioMes('acc-1', '2026-10', { today: '2026-10-26' }),
        mesPassado: useDiarioMes('acc-1', '2026-09', { today: '2026-10-26' }),
        hoje: useDiarioDia('acc-1', '2026-10-26', { today: '2026-10-26' }),
        passado: useDiarioDia('acc-1', '2026-10-22', { today: '2026-10-26' }),
      }),
      { wrapper },
    )
    await waitFor(() => expect(Object.values(result.current).every((q) => q.isSuccess)).toBe(true))
    const count = () => ({
      cal: db.fetchCalendario.mock.calls.length,
      meses: db.fetchMes.mock.calls.map(([, , m]) => m).sort(),
      dias: db.fetchDia.mock.calls.map(([, , d]) => d).sort(),
    })
    expect(count()).toEqual({ cal: 1, meses: ['2026-09', '2026-10'], dias: ['2026-10-22', '2026-10-26'] })
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(db.fetchCalendario).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(count()).toEqual({ cal: 2, meses: ['2026-09', '2026-10', '2026-10'], dias: ['2026-10-22', '2026-10-26', '2026-10-26'] }))
    focusManager.setFocused(undefined)
  })

  it('nothing is read without an account or a day', async () => {
    const { wrapper } = setup()
    renderHook(() => ({ cal: useDiarioCalendario(null), dia: useDiarioDia('acc-1', null) }), { wrapper })
    await act(async () => {
      await Promise.resolve()
    })
    expect(db.fetchCalendario).not.toHaveBeenCalled()
    expect(db.fetchDia).not.toHaveBeenCalled()
  })

  it('the images of one trade, signed once for its sorted paths', async () => {
    const { wrapper, queryClient } = setup()
    const { result } = renderHook(() => useDayImages('acc-1', 't-1', ['u/t/b.webp', 'u/t/a.webp']), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(db.signedImageUrls).toHaveBeenCalledWith(expect.anything(), ['u/t/a.webp', 'u/t/b.webp'])
    expect(queryClient.getQueryData(diarioKeys.imagens('user-1', 'acc-1', 't-1', 'u/t/a.webp,u/t/b.webp'))).toEqual({ 'u/t/a.webp': 'https://x/a' })
    const none = renderHook(() => useDayImages('acc-1', 't-2', []), { wrapper })
    expect(none.result.current.fetchStatus).toBe('idle')
    // Signed again only after 9 minutes: another view of the same trade within them reads the cache
    expect(queryClient.getQueryCache().find({ queryKey: diarioKeys.imagens('user-1', 'acc-1', 't-1', 'u/t/a.webp,u/t/b.webp') })?.options).toMatchObject({
      staleTime: SIGNED_URLS_STALE_MS,
      refetchOnWindowFocus: false,
    })
    const again = renderHook(() => useDayImages('acc-1', 't-1', ['u/t/a.webp', 'u/t/b.webp']), { wrapper })
    await waitFor(() => expect(again.result.current.isSuccess).toBe(true))
    expect(db.signedImageUrls).toHaveBeenCalledTimes(1)
  })
})

describe('writes', () => {
  it('«Salvar revisão» reads the account\'s Diário again; a dry run does not', async () => {
    const { wrapper, queryClient } = setup()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useSaveDayReview(), { wrapper })
    const payload = reviewPayload({ worked: 'x', differently: '', followed: 'sim', carryForward: '' }, KEY)
    await act(async () => {
      await result.current.mutateAsync({ accountId: 'acc-1', day: '2026-10-22', payload })
    })
    expect(db.saveDayReview).toHaveBeenCalledWith(expect.anything(), 'acc-1', '2026-10-22', payload, { dryRun: false })
    expect(spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).toEqual([['hub', 'user-1', 'diario', 'acc-1']])
    spy.mockClear()
    db.saveDayReview.mockResolvedValueOnce(diarioDb.parseReviewSaved(diarioJson('revisao-1022-previa')))
    await act(async () => {
      await result.current.mutateAsync({ accountId: 'acc-1', day: '2026-10-22', payload, dryRun: true })
    })
    expect(spy).not.toHaveBeenCalled()
  })

  it('«Antes de operar» reads the day again; a refusal is the database\'s code', async () => {
    const { wrapper, queryClient } = setup()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useSaveDayNote(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ accountId: 'acc-1', day: '2026-10-23', payload: notePayload('Só a favor da VWAP.', KEY) })
    })
    expect(spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).toEqual([diarioKeys.dia('user-1', 'acc-1', '2026-10-23')])
    db.saveDayNote.mockRejectedValueOnce(new diarioDb.DiarioDataError('not_today', 'day'))
    let failure: unknown
    await act(async () => {
      failure = await result.current.mutateAsync({ accountId: 'acc-1', day: '2026-10-22', payload: notePayload('x', KEY) }).catch((e: unknown) => e)
    })
    expect(failure).toMatchObject({ code: 'not_today', field: 'day' })
  })
})
