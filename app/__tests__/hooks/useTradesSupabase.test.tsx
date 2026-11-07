/**
 * The old trades page's writes (Phase 4 review): the Diário's link «Página antiga de operações»
 * sends the owner there to delete and export, so every write also marks the Diário stale; coming
 * back to /diario within React Query's staleTime must not show a deleted trade.
 */
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'

/** A query builder whose every step chains and whose answer is empty */
function chain(): Record<string, unknown> {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'lte', 'limit', 'single', 'in']) c[m] = () => c
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res, rej)
  return c
}

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ from: () => chain(), storage: { from: () => ({}) } })) }))
jest.mock('@/lib/contexts/AuthContextSupabase', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const spy = jest.spyOn(queryClient, 'invalidateQueries')
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  return { spy, wrapper }
}

const keys = (spy: jest.SpyInstance) => spy.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey)

describe('the old page\'s writes mark the Diário stale', () => {
  it.each([
    ['delete', (h: ReturnType<typeof useTradesSupabase>) => h.deleteTrade.mutateAsync('t-1')],
    ['update', (h: ReturnType<typeof useTradesSupabase>) => h.updateTrade.mutateAsync({ tradeId: 't-1', updates: { notes: 'x' } })],
    ['create', (h: ReturnType<typeof useTradesSupabase>) => h.createTrade.mutateAsync({ symbol: 'MESZ6' } as never)],
  ])('%s', async (_label, write) => {
    const { spy, wrapper } = setup()
    const { result } = renderHook(() => useTradesSupabase(), { wrapper })
    await act(async () => {
      await write(result.current)
    })
    expect(keys(spy)).toEqual(expect.arrayContaining([['trades'], ['trade-stats'], ['trading-sessions'], ['hub', 'user-1', 'diario']]))
  })
})
