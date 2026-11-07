/**
 * Fase 4 · telas (B0, contract §3.2): the Diário's two writes fail at once offline, as the Registrar's do. With
 * @tanstack/query-core's default networkMode a save started offline would wait paused (no «Sem conexão. A revisão não
 * foi salva.», and the review sent silently on reconnect); useSaveDayReview and useSaveDayNote now run with
 * networkMode 'always', no retry, and assertDiarioOnline() first: offline → DiarioDataError 'network', nothing sent.
 * Recorded answers of fixtures/diario (invented data).
 */
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import * as diarioDb from '@/lib/hub/diarioDb'
import { assertDiarioOnline, useSaveDayNote, useSaveDayReview } from '@/hooks/useDiario'
import { notePayload, reviewPayload } from '@/lib/domain/diario'
import { diarioJson } from '@/testing/diarioDb'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

jest.mock('@/lib/hub/diarioDb', () => ({
  ...jest.requireActual('@/lib/hub/diarioDb'),
  saveDayReview: jest.fn(),
  saveDayNote: jest.fn(),
}))

const db = diarioDb as jest.Mocked<typeof diarioDb>
const KEY = '0b3f1c2a-1111-4c2d-8e3f-000000000002'
const ACC = 'acc-1'

/** The app's defaults for mutations (lib/providers/QueryProvider sets none): the hooks' own options must decide */
function setup() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, wrapper }
}

const revisao = () => reviewPayload({ worked: 'Esperei o reteste.', differently: '', followed: 'sim', carryForward: '' }, KEY)

beforeEach(() => {
  jest.clearAllMocks()
  db.saveDayReview.mockResolvedValue(diarioDb.parseReviewSaved(diarioJson('revisao-1022')))
  db.saveDayNote.mockResolvedValue(diarioDb.parseNoteSaved(diarioJson('nota-1023')))
})

afterEach(() => {
  onlineManager.setOnline(true)
})

describe('assertDiarioOnline', () => {
  it('throws network when React Query or the browser says offline; nothing when online', () => {
    expect(() => assertDiarioOnline()).not.toThrow()
    onlineManager.setOnline(false)
    expect(() => assertDiarioOnline()).toThrow(expect.objectContaining({ name: 'DiarioDataError', code: 'network' }))
    onlineManager.setOnline(true)
    const onLine = jest.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      expect(() => assertDiarioOnline()).toThrow(expect.objectContaining({ code: 'network' }))
    } finally {
      onLine.mockRestore()
    }
  })
})

describe('offline, the Diário’s writes fail at once', () => {
  it('«Salvar revisão»: DiarioDataError network, nothing sent, no paused mutation; online again, the same tap saves once', async () => {
    const { queryClient, wrapper } = setup()
    const { result } = renderHook(() => useSaveDayReview(), { wrapper })
    onlineManager.setOnline(false)
    const payload = revisao()
    let erro: unknown = null
    await act(async () => {
      try {
        await result.current.mutateAsync({ accountId: ACC, day: '2026-10-22', payload })
      } catch (e) {
        erro = e
      }
    })
    expect(erro).toBeInstanceOf(diarioDb.DiarioDataError)
    expect((erro as diarioDb.DiarioDataError).code).toBe('network')
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.code).toBe('network')
    expect(result.current.isPaused).toBe(false)
    expect(db.saveDayReview).not.toHaveBeenCalled()
    expect(queryClient.getMutationCache().getAll().some((m) => m.state.isPaused)).toBe(false)

    // Back online: nothing was queued; the owner's tap again (the same client_key) saves once
    act(() => onlineManager.setOnline(true))
    await new Promise((r) => setTimeout(r, 20))
    expect(db.saveDayReview).not.toHaveBeenCalled()
    await act(async () => {
      await result.current.mutateAsync({ accountId: ACC, day: '2026-10-22', payload })
    })
    expect(db.saveDayReview).toHaveBeenCalledTimes(1)
    expect(db.saveDayReview.mock.calls[0][3].client_key).toBe(KEY)
  })

  it('«Antes de operar»: DiarioDataError network, nothing sent; online again, one call', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useSaveDayNote(), { wrapper })
    onlineManager.setOnline(false)
    const payload = notePayload('Só compro acima da VWAP.', KEY)
    await act(async () => {
      await expect(result.current.mutateAsync({ accountId: ACC, day: '2026-10-23', payload })).rejects.toMatchObject({ code: 'network' })
    })
    expect(result.current.isPaused).toBe(false)
    expect(db.saveDayNote).not.toHaveBeenCalled()

    act(() => onlineManager.setOnline(true))
    await act(async () => {
      await result.current.mutateAsync({ accountId: ACC, day: '2026-10-23', payload })
    })
    expect(db.saveDayNote).toHaveBeenCalledTimes(1)
  })

  it('a refusal online is not retried (retry: false)', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useSaveDayReview(), { wrapper })
    db.saveDayReview.mockRejectedValue(new diarioDb.DiarioDataError('too_many_versions'))
    await act(async () => {
      await expect(result.current.mutateAsync({ accountId: ACC, day: '2026-10-22', payload: revisao() })).rejects.toMatchObject({ code: 'too_many_versions' })
    })
    expect(db.saveDayReview).toHaveBeenCalledTimes(1)
  })
})
