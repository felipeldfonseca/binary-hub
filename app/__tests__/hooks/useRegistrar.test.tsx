import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as registrarDb from '@/lib/hub/registrarDb'
import * as imagens from '@/lib/hub/registrarImagens'
import { regrasKeys } from '@/hooks/useRegras'
import { hubKeys } from '@/hooks/useContas'
import {
  REGISTRAR_INVALIDATIONS,
  invalidateAfterRegistrar,
  previewKey,
  recordServerNow,
  registrarKeys,
  useAddMarks,
  useDayTrades,
  useEntryPreview,
  useExitPreview,
  useGateAt,
  useImageTrashSweep,
  useMoveStop,
  useOpenTrades,
  useRegisterAfter,
  useRegisterEntry,
  useRegisterExit,
  useRegisterPartial,
  useRegistrarDefaults,
  useTradeEvents,
  useUndoEvent,
  useSaveImagesAndNote,
  useServerClock,
  useServerNow,
  useTradeView,
  useUndoEntry,
} from '@/hooks/useRegistrar'
import * as regrasDb from '@/lib/hub/regrasDb'
import { movePayload, partialPayload, undoEventPayload } from '@/lib/domain/registro'
import { idsParciais } from '@/testing/parciais'
import { agoraParciais, desfeitaMnq, eventosRows, estadoJson, parcialMnq, parcialParciais, stopParciais } from '@/testing/parciaisTelas'
import { newClientKey } from '@/lib/hub/registrarDb'
import { entryPayload, entryPayload as buildEntry, exitPayload, afterPayload, type EntryPayload } from '@/lib/domain/registro'
import {
  abertasTelas,
  agoraTelas,
  diaTelas,
  entradaTelas,
  estadoTelas,
  fechadaTelas,
  idsTelas,
  operacaoTelas,
  previaTelas,
  recentesTelas,
  saidaTelas,
} from '@/testing/registrarTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchDayTrades: jest.fn(),
  fetchGateAt: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewEntry: jest.fn(),
  previewExit: jest.fn(),
  registerEntry: jest.fn(),
  registerExit: jest.fn(),
  registerAfter: jest.fn(),
  addMarks: jest.fn(),
  undoEntry: jest.fn(),
  drainImageTrash: jest.fn(),
  registerPartial: jest.fn(),
  moveStop: jest.fn(),
  undoEvent: jest.fn(),
  fetchTradeEvents: jest.fn(),
}))

jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn() }))

jest.mock('@/lib/hub/registrarImagens', () => ({
  ...jest.requireActual('@/lib/hub/registrarImagens'),
  saveImagesAndNote: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const saveImagesAndNote = imagens.saveImagesAndNote as jest.MockedFunction<typeof imagens.saveImagesAndNote>

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { queryClient, wrapper }
}

const ids = idsTelas()
/** register_exit's dry run for the MES exit (the shape the parser gives) */
const previewExitAnswer = (): registrarDb.ExitDryRun => ({ repeated: false, serverNow: new Date('2026-10-22T14:37:00Z'), tradeId: ids.trades.mes, ...(saidaTelas('exit-mes-oitenta').exit as NonNullable<registrarDb.ExitRegistered['exit']>) })
const top = { id: ids.accounts.topOne, market: 'futures' as const }
let online = true

beforeAll(() => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online })
})

beforeEach(() => {
  online = true
  jest.clearAllMocks()
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('cache keys and what each write makes stale', () => {
  it('sit under the hub’s keys, so an import commit or undo (useRefreshAfterWrite) refreshes them', () => {
    for (const key of [
      registrarKeys.all('u'),
      registrarKeys.abertas('u', 'a'),
      registrarKeys.dia('u', 'a', '2026-10-22'),
      registrarKeys.operacao('u', 't'),
      registrarKeys.recentes('u', 'a'),
      registrarKeys.previa('u', 'entrada', 'a', '{}'),
      registrarKeys.relogio('u'),
      registrarKeys.eventos('u', 'a,b'),
    ]) {
      expect(key.slice(0, 2)).toEqual(hubKeys.all('u'))
    }
    expect(registrarKeys.abertas('u', null)).toEqual(['hub', 'u', 'registrar', 'abertas', 'todas'])
  })

  it('names the caches per write (never rules_config: it reads no trade)', () => {
    expect(REGISTRAR_INVALIDATIONS).toEqual({
      entrada: ['abertas', 'dia', 'recentes', 'previa', 'regrasAgora', 'atividade', 'paginasAntigas'],
      saida: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora', 'paginasAntigas'],
      fechada: ['dia', 'eventos', 'recentes', 'previa', 'regrasAgora', 'atividade', 'paginasAntigas'],
      desfazer: ['abertas', 'dia', 'eventos', 'recentes', 'previa', 'regrasAgora', 'atividade', 'paginasAntigas'],
      marcas: [],
      extras: ['dia'],
      // Phase 3c: a partial counts on the day's limit; a move changes no money; an event undone leaves the limit
      parcial: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora'],
      stop: ['dia', 'eventos', 'previa'],
      evento: ['abertas', 'dia', 'eventos', 'previa', 'regrasAgora'],
    })
  })

  it('invalidates exactly those keys', async () => {
    const queryClient = new QueryClient()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')
    await invalidateAfterRegistrar(queryClient, 'u', 'saida')
    expect(spy.mock.calls.map(([f]) => f)).toEqual([
      { queryKey: ['hub', 'u', 'registrar', 'abertas'] },
      { queryKey: ['hub', 'u', 'registrar', 'dia'] },
      // Phase 3c: the exits and moves the chooser and the bridge read
      { queryKey: ['hub', 'u', 'registrar', 'eventos'] },
      // The dry runs only go stale: the one on screen is not asked again about what was just written
      { queryKey: ['hub', 'u', 'registrar', 'previa'], refetchType: 'none' },
      { queryKey: regrasKeys.agora('u') },
      { queryKey: ['trades'] },
      { queryKey: ['trade-stats'] },
    ])
    spy.mockClear()
    await invalidateAfterRegistrar(queryClient, 'u', 'entrada')
    expect(spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).toContainEqual(['hub', 'u', 'atividade'])
    expect(spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)).not.toContainEqual(regrasKeys.config('u'))
  })
})

describe('reads', () => {
  it('open trades, a trade, the day, the starting values', async () => {
    db.fetchOpenTrades.mockResolvedValue(abertasTelas())
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-aberta'))
    db.fetchDayTrades.mockResolvedValue(diaTelas('dia-qui-1031'))
    db.fetchRecentTrades.mockResolvedValue(recentesTelas('recentes-top-one'))
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        open: useOpenTrades(top.id),
        trade: useTradeView(ids.trades.mes),
        day: useDayTrades(top, '2026-10-22'),
        defaults: useRegistrarDefaults(top),
        none: useTradeView(null),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.defaults.data).toBeDefined())
    await waitFor(() => expect(result.current.day.data).toHaveLength(4))
    expect(result.current.open.data?.map((t) => t.symbol)).toEqual(['MNQ', 'MES', 'MGC'])
    expect(result.current.trade.data?.trade.symbol).toBe('MES')
    expect(result.current.defaults.data).toMatchObject({ symbol: 'MGC', quantity: '1' })
    expect(result.current.none.fetchStatus).toBe('idle')
    expect(db.fetchOpenTrades).toHaveBeenCalledWith(expect.anything(), top.id)
    // The day since 18:00 ET the evening before
    expect(db.fetchDayTrades).toHaveBeenCalledWith(expect.anything(), top.id, '2026-10-22', new Date('2026-10-21T22:00:00.000Z'))
  })
})

describe('the entry preview', () => {
  it('asks at once, then after 300 ms of quiet; keys on the payload without its client_key; keeps the last answer while asking', async () => {
    jest.useFakeTimers()
    db.previewEntry.mockResolvedValue(previaTelas('entry-dry-mes-digitada'))
    const { wrapper } = setup()
    const base = buildEntry('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7905.25', stop: '10', clock: 'America/New_York', entry: '10:20' })
    const { result, rerender } = renderHook(({ p }: { p: EntryPayload }) => useEntryPreview(top.id, p), { wrapper, initialProps: { p: { ...base, client_key: newClientKey() } as EntryPayload } })
    await waitFor(() => expect(result.current.data?.limitRoom).toMatchObject({ left: '155' }))
    expect(db.previewEntry).toHaveBeenCalledTimes(1)
    expect(db.previewEntry.mock.calls[0][2]).not.toHaveProperty('client_key')
    // A new client_key alone is the same preview
    rerender({ p: { ...base, client_key: newClientKey() } })
    await act(async () => {
      jest.advanceTimersByTime(300)
    })
    expect(db.previewEntry).toHaveBeenCalledTimes(1)
    // A change waits for the quiet; the old answer stays on screen until the new one arrives
    rerender({ p: { ...base, stop_pts: '12' } })
    await act(async () => {
      jest.advanceTimersByTime(299)
    })
    expect(db.previewEntry).toHaveBeenCalledTimes(1)
    // Kept, but as a placeholder: it answers stop 10, not the stop on screen
    expect(result.current.data?.limitRoom).toMatchObject({ left: '155' })
    expect(result.current.isPlaceholderData).toBe(true)
    await act(async () => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.data?.limitRoom).toMatchObject({ left: '155' })
    await waitFor(() => expect(db.previewEntry).toHaveBeenCalledTimes(2))
    expect(db.previewEntry.mock.calls[1][2]).toMatchObject({ stop_pts: '12' })
  })

  it('the gate at a typed hour: nothing for the current minute (rules_now answers it), gate_at otherwise', async () => {
    const entry = agoraTelas('agora-qui-1031-et').accounts[0]
    db.fetchGateAt.mockResolvedValue(entry)
    const { wrapper } = setup()
    const { result, rerender } = renderHook(({ at }: { at: Date | null }) => useGateAt(top.id, at), { wrapper, initialProps: { at: null as Date | null } })
    expect(result.current.fetchStatus).toBe('idle')
    rerender({ at: new Date('2026-10-22T14:20:00Z') })
    await waitFor(() => expect(result.current.data?.gate.status).toBe('liberado'))
    expect(db.fetchGateAt).toHaveBeenCalledWith(expect.anything(), top.id, new Date('2026-10-22T14:20:00Z'))
  })

  it('a payload built on every render (the server clock ticks) does not redraw the form every 300 ms', async () => {
    jest.useFakeTimers()
    db.previewEntry.mockResolvedValue(previaTelas('entry-dry-mes-digitada'))
    const { wrapper } = setup()
    let renders = 0
    const { rerender } = renderHook(
      ({ tick }: { tick: number }) => {
        renders += tick >= 0 ? 1 : 0
        return useEntryPreview(top.id, { ...buildEntry('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7905.25', clock: 'America/New_York' }), client_key: newClientKey() })
      },
      { wrapper, initialProps: { tick: 0 } },
    )
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    rerender({ tick: 1 })
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    const settled = renders
    for (let k = 0; k < 10; k++) {
      await act(async () => {
        jest.advanceTimersByTime(400)
      })
    }
    expect(renders).toBe(settled)
    expect(db.previewEntry).toHaveBeenCalledTimes(1)
  })

  it('an incomplete form shows no dry run at once; another account never shows this one’s answer', async () => {
    const mes = previaTelas('entry-dry-mes-digitada')
    db.previewEntry.mockImplementation(async (_db, accountId) => (accountId === top.id ? mes : new Promise<never>(() => {})))
    const { wrapper } = setup()
    const payload = buildEntry('futures', { symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7905.25', stop: '10', clock: 'America/New_York', entry: '10:20' })
    const { result, rerender } = renderHook(({ acc, p }: { acc: string; p: EntryPayload | null }) => useEntryPreview(acc, p, { debounceMs: 0 }), {
      wrapper,
      initialProps: { acc: top.id, p: payload as EntryPayload | null },
    })
    await waitFor(() => expect(result.current.data?.limitRoom).toMatchObject({ above: false }))
    // The price erased: no warning left over from the last complete form
    rerender({ acc: top.id, p: null })
    expect(result.current.data).toBeUndefined()
    rerender({ acc: top.id, p: payload })
    await waitFor(() => expect(result.current.data).toBeDefined())
    // Another account: nothing until its own answer
    rerender({ acc: ids.accounts.ebinex, p: payload })
    await waitFor(() => expect(db.previewEntry).toHaveBeenLastCalledWith(expect.anything(), ids.accounts.ebinex, expect.anything()))
    expect(result.current.data).toBeUndefined()
  })

  it('the gate at the current minute (null) has no data, even after a typed hour', async () => {
    db.fetchGateAt.mockResolvedValue(agoraTelas('agora-qui-1031-et').accounts[0])
    const { wrapper } = setup()
    const { result, rerender } = renderHook(({ at }: { at: Date | null }) => useGateAt(top.id, at, { debounceMs: 0 }), { wrapper, initialProps: { at: new Date('2026-10-22T14:20:00Z') as Date | null } })
    await waitFor(() => expect(result.current.data).toBeDefined())
    rerender({ at: null })
    expect(result.current.data).toBeUndefined()
  })

  it('a stable key whatever the key order', () => {
    expect(previewKey({ b: 1, a: { d: 2, c: 3 }, client_key: 'x' })).toBe(previewKey({ a: { c: 3, d: 2 }, b: 1 }))
  })
})

describe('writes', () => {
  it('«Registrar entrada»: the answer becomes the trade’s view, the server clock is kept, the lists go stale', async () => {
    const answer = entradaTelas('entry-mes')
    db.registerEntry.mockResolvedValue(answer)
    const { queryClient, wrapper } = setup()
    const spy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRegisterEntry(), { wrapper })
    const payload = entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7912.50', clock: 'America/New_York' })
    await act(async () => {
      await result.current.mutateAsync({ accountId: top.id, payload })
    })
    expect(db.registerEntry).toHaveBeenCalledWith(expect.anything(), top.id, payload)
    const view = queryClient.getQueryData(registrarKeys.operacao('user-1', answer.state.trade.id))
    expect(view).toMatchObject({ trade: { symbol: 'MES', status: 'open' } })
    expect(view).not.toHaveProperty('serverNow')
    expect(queryClient.getQueryData(registrarKeys.relogio('user-1'))).toMatchObject({ offsetMs: expect.any(Number) })
    expect(spy).toHaveBeenCalledWith({ queryKey: regrasKeys.agora('user-1') })
  })

  it('offline: nothing is sent, the code is «offline»', async () => {
    online = false
    const { wrapper } = setup()
    const { result } = renderHook(() => useRegisterEntry(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ accountId: top.id, payload: entryPayload('futures', { symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '1', clock: 'America/New_York' }) })).rejects.toMatchObject({ code: 'offline' })
    })
    expect(db.registerEntry).not.toHaveBeenCalled()
  })

  it('a refusal comes back as its code and field, never retried', async () => {
    db.registerEntry.mockRejectedValue(new registrarDb.RegistrarDataError('entry_too_old', 'entry'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useRegisterEntry(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ accountId: top.id, payload: {} as never })).rejects.toMatchObject({ code: 'entry_too_old', field: 'entry' })
    })
    expect(db.registerEntry).toHaveBeenCalledTimes(1)
  })

  it('«Registrar saída»: the limit before it comes from the cached rules_now (for the banner)', async () => {
    db.registerExit.mockResolvedValue(saidaTelas('exit-mes-oitenta'))
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(regrasKeys.agora('user-1'), agoraTelas('agora-qui-1031-et'))
    const { result } = renderHook(() => useRegisterExit(), { wrapper })
    let done: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      done = await result.current.mutateAsync({ tradeId: ids.trades.mes, accountId: top.id, payload: exitPayload('futures', { exitPrice: '7902.50', clock: 'America/New_York' }) })
    })
    expect(done?.limitBefore).toMatchObject({ tradingDay: '2026-10-22', limit: { worstCents: -24500, near: false } })
    expect(done?.gateNow?.limit).toMatchObject({ near: true })
    expect(queryClient.getQueryData(registrarKeys.operacao('user-1', ids.trades.mes))).toMatchObject({ trade: { status: 'closed' } })
  })

  it('«Registrar saída» never asks the dry run on screen again (it would answer `repeated`); it is only stale', async () => {
    db.previewExit.mockResolvedValue(previewExitAnswer())
    db.registerExit.mockResolvedValue(saidaTelas('exit-mes-oitenta'))
    const { queryClient, wrapper } = setup()
    const payload = exitPayload('futures', { exitPrice: '7902.50', clock: 'America/New_York' })
    const { result } = renderHook(() => ({ preview: useExitPreview(ids.trades.mes, payload, { debounceMs: 0 }), exit: useRegisterExit() }), { wrapper })
    await waitFor(() => expect(result.current.preview.data).toBeDefined())
    await act(async () => {
      await result.current.exit.mutateAsync({ tradeId: ids.trades.mes, accountId: top.id, payload })
    })
    expect(db.previewExit).toHaveBeenCalledTimes(1)
    const previa = queryClient.getQueryCache().findAll({ queryKey: ['hub', 'user-1', 'registrar', 'previa'] })
    expect(previa.length).toBeGreaterThan(0)
    expect(previa.every((q) => q.state.isInvalidated)).toBe(true)
  })

  it('«Já fechada», a mark, «Desfazer entrada», «Salvar imagens e nota»', async () => {
    db.registerAfter.mockResolvedValue(fechadaTelas())
    db.addMarks.mockResolvedValue(estadoTelas('marks-mes-aberta'))
    db.undoEntry.mockResolvedValue({ serverNow: new Date(), tradeId: 'es-1', trash: ['u/es-1/a.webp'] })
    const extras = estadoTelas('extras-mes')
    saveImagesAndNote.mockResolvedValue({ state: extras, savedAt: new Date(), noteSavedAt: new Date(), failed: [], savedIds: {} })
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(registrarKeys.operacao('user-1', 'es-1'), operacaoTelas('operacao-mes-aberta'))
    const { result } = renderHook(() => ({ after: useRegisterAfter(), marks: useAddMarks(), undo: useUndoEntry(), extras: useSaveImagesAndNote() }), { wrapper })
    await act(async () => {
      await result.current.after.mutateAsync({ accountId: ids.accounts.ebinex, payload: afterPayload('binary', { symbol: 'GBP/USD', direction: 'call', stake: '20', payout: '87', durationS: 300, clock: 'America/Sao_Paulo', day: '2026-10-22', entry: '20:13', outcome: 'ganho' }) })
      await result.current.marks.mutateAsync({ tradeId: ids.trades.mes, marks: { emocao: 'calmo' } })
      await result.current.undo.mutateAsync({ tradeId: 'es-1' })
      await result.current.extras.mutateAsync({ tradeId: ids.trades.mes, input: { items: [], note: 'x' } })
    })
    expect(db.addMarks).toHaveBeenCalledWith(expect.anything(), ids.trades.mes, { v: 1, marks: { emocao: 'calmo' } })
    expect(db.drainImageTrash).toHaveBeenCalledWith(expect.anything(), ['u/es-1/a.webp'])
    expect(queryClient.getQueryData(registrarKeys.operacao('user-1', 'es-1'))).toBeNull()
    expect(saveImagesAndNote).toHaveBeenCalledWith(expect.anything(), ids.trades.mes, { items: [], note: 'x' }, { onProgress: undefined })
    expect(queryClient.getQueryData(registrarKeys.operacao('user-1', ids.trades.mes))).toMatchObject({ trade: { note: 'Saí no stop: o rompimento não confirmou.' } })
  })
})

describe('Phase 3c writes and reads', () => {
  const ids3c = idsParciais()
  const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>

  it('«Registrar parcial»: the limit before it (cached rules_now), the answer as the trade’s view, the lists and the limit stale', async () => {
    db.registerPartial.mockResolvedValue(parcialParciais('partial-mes'))
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(regrasKeys.agora('user-1'), agoraParciais('agora-sex-0900'))
    const spy = jest.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRegisterPartial(), { wrapper })
    const payload = partialPayload({ clientKey: newClientKey(), quantity: '1', exitPrice: '7920.5', clock: 'America/New_York' })
    let done: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      done = await result.current.mutateAsync({ tradeId: ids3c.trades.mes, accountId: ids3c.accounts.topOne, payload })
    })
    expect(db.registerPartial).toHaveBeenCalledWith(expect.anything(), ids3c.trades.mes, payload)
    expect(done?.limitBefore).toMatchObject({ tradingDay: '2026-10-23', limit: { state: 'ok', worstCents: 0 } })
    expect(queryClient.getQueryData(registrarKeys.operacao('user-1', ids3c.trades.mes))).toMatchObject({ position: { open: '2', partials: 1 } })
    expect(queryClient.getQueryData(registrarKeys.relogio('user-1'))).toMatchObject({ offsetMs: expect.any(Number) })
    const keys = spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)
    expect(keys).toEqual([
      ['hub', 'user-1', 'registrar', 'abertas'],
      ['hub', 'user-1', 'registrar', 'dia'],
      ['hub', 'user-1', 'registrar', 'eventos'],
      ['hub', 'user-1', 'registrar', 'previa'],
      regrasKeys.agora('user-1'),
    ])
  })

  it('«Registrar stop»: the move’s answer as the view; offline nothing is sent; a refusal is never retried', async () => {
    db.moveStop.mockResolvedValueOnce(stopParciais('stop-mes-breakeven'))
    const { queryClient, wrapper } = setup()
    const { result } = renderHook(() => useMoveStop(), { wrapper })
    const payload = movePayload({ clientKey: newClientKey(), kind: 'breakeven', priceNow: '7920.5' })
    await act(async () => {
      await result.current.mutateAsync({ tradeId: ids3c.trades.mes, payload })
    })
    expect(queryClient.getQueryData(registrarKeys.operacao('user-1', ids3c.trades.mes))).toMatchObject({ position: { stopNow: '7912.5', stopKind: 'breakeven' } })
    online = false
    await act(async () => {
      await expect(result.current.mutateAsync({ tradeId: ids3c.trades.mes, payload })).rejects.toMatchObject({ code: 'offline' })
    })
    expect(db.moveStop).toHaveBeenCalledTimes(1)
    online = true
    db.moveStop.mockRejectedValueOnce(new registrarDb.RegistrarDataError('same_stop', 'stop_price'))
    await act(async () => {
      await expect(result.current.mutateAsync({ tradeId: ids3c.trades.mes, payload })).rejects.toMatchObject({ code: 'same_stop', field: 'stop_price' })
    })
    expect(db.moveStop).toHaveBeenCalledTimes(2)
  })

  it('«Sim, desfazer»: the limit before (cached) and after (rules_now read again at once)', async () => {
    const p = parcialMnq()
    db.undoEvent.mockResolvedValue(desfeitaMnq())
    fetchRulesNow.mockResolvedValue(agoraParciais('dia-apex-1055', { min: -28 }))
    const { queryClient, wrapper } = setup()
    queryClient.setQueryData(regrasKeys.agora('user-1'), agoraParciais('dia-apex-1053', { min: -28 }))
    const { result } = renderHook(() => useUndoEvent(), { wrapper })
    let done: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      done = await result.current.mutateAsync({ tradeId: ids3c.trades.mnq, accountId: ids3c.accounts.apex, payload: undoEventPayload('parcial', p.exitId) })
    })
    expect(db.undoEvent).toHaveBeenCalledWith(expect.anything(), ids3c.trades.mnq, { v: 1, kind: 'parcial', id: p.exitId })
    expect(done?.limitBefore?.limit).toMatchObject({ state: 'atingido', worstCents: -40000 })
    expect(done?.limitAfter?.limit).toMatchObject({ state: 'ok', worstCents: -30000 })
    expect(fetchRulesNow).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryData(registrarKeys.operacao('user-1', ids3c.trades.mnq))).toMatchObject({ position: { open: '3', partials: 0, undo: null } })
  })

  it('«Sim, desfazer» without a fresh rules_now: limitAfter null, the undo still succeeds', async () => {
    db.undoEvent.mockResolvedValue(desfeitaMnq())
    fetchRulesNow.mockRejectedValue(new Error('offline'))
    const { wrapper } = setup()
    const { result } = renderHook(() => useUndoEvent(), { wrapper })
    let done: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      done = await result.current.mutateAsync({ tradeId: ids3c.trades.mnq, accountId: ids3c.accounts.apex, payload: undoEventPayload('parcial', 5) })
    })
    expect(done?.limitAfter).toBeNull()
    expect(done?.limitBefore).toBeNull()
  })

  it('useTradeEvents: one read for the listed trades (sorted, deduplicated); nothing without ids', async () => {
    const rows = eventosRows({ json: estadoJson('exit-mes') })
    const { tradeEventsOfRows } = jest.requireActual('@/lib/hub/registrarDb') as typeof registrarDb
    db.fetchTradeEvents.mockResolvedValue(tradeEventsOfRows(rows))
    const { queryClient, wrapper } = setup()
    const { result, rerender } = renderHook(({ list }: { list: string[] | null }) => useTradeEvents(list), { wrapper, initialProps: { list: null as string[] | null } })
    expect(result.current.fetchStatus).toBe('idle')
    rerender({ list: [] })
    expect(result.current.fetchStatus).toBe('idle')
    rerender({ list: ['b', ids3c.trades.mes, 'b'] })
    await waitFor(() => expect(result.current.data).toBeDefined())
    const sorted = ['b', ids3c.trades.mes].sort()
    expect(db.fetchTradeEvents).toHaveBeenCalledWith(expect.anything(), sorted)
    expect(queryClient.getQueryData(registrarKeys.eventos('user-1', sorted.join(',')))).toBeDefined()
    expect(result.current.data?.[ids3c.trades.mes].exits).toHaveLength(2)
  })
})

describe('the server’s clock', () => {
  it('takes the newest answer: rules_now’s or a Registrar write’s', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-10-22T14:31:00Z'))
    const { queryClient, wrapper } = setup()
    // rules_now said 14:31:05 when the device read 14:31:00
    queryClient.setQueryData(regrasKeys.agora('user-1'), agoraTelas('agora-qui-1031-et'), { updatedAt: Date.parse('2026-10-22T14:31:00Z') })
    const { result } = renderHook(() => ({ clock: useServerClock(), now: useServerNow(60_000) }), { wrapper })
    const serverNow = agoraTelas('agora-qui-1031-et').serverNow.getTime()
    expect(result.current.clock?.offsetMs).toBe(serverNow - Date.parse('2026-10-22T14:31:00Z'))
    expect(result.current.now.getTime()).toBe(serverNow)
    // A write answered later, with another offset
    act(() => {
      jest.setSystemTime(new Date('2026-10-22T14:38:00Z'))
      recordServerNow(queryClient, 'user-1', new Date('2026-10-22T14:38:30Z'))
    })
    await waitFor(() => expect(result.current.clock?.offsetMs).toBe(30000))
    await waitFor(() => expect(result.current.now.getTime() - Date.now()).toBe(30000))
  })
})

describe('the image trash sweep', () => {
  it('runs once per signed-in session, whatever mounts it', async () => {
    const { queryClient, wrapper } = setup()
    renderHook(() => useImageTrashSweep(), { wrapper })
    renderHook(() => useImageTrashSweep(), { wrapper })
    await waitFor(() => expect(db.drainImageTrash).toHaveBeenCalledTimes(1))
    expect(db.drainImageTrash).toHaveBeenCalledWith(expect.anything())
    // Another tab (another QueryClient) sweeps on its own
    const other = new QueryClient()
    const otherWrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={other}>{children}</QueryClientProvider>
    renderHook(() => useImageTrashSweep(), { wrapper: otherWrapper })
    await waitFor(() => expect(db.drainImageTrash).toHaveBeenCalledTimes(2))
    expect(queryClient).not.toBe(other)
  })
})
