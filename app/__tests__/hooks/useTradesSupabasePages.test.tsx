/**
 * Step 4-4: the old list at /trades?antiga=1 (delete and export, until Phase 9) reads every trade.
 * PostgREST caps one select at 1,000 rows, so the hook reads pages of 1,000 with .range() under a
 * total order (entry_time desc, then id desc) until a short page, or until filters.limit.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'

type Call = [string, ...unknown[]]

/** Each select the hook sends: its steps in order, answered from `rows` by its .range() */
const selects: Call[][] = []
let rows: { id: string }[] = []
let failOnSelect: number | null = null

function builder(): Record<string, unknown> {
  const calls: Call[] = []
  const index = selects.push(calls) - 1
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'limit', 'range']) {
    b[m] = (...args: unknown[]) => {
      calls.push([m, ...args])
      return b
    }
  }
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
    const range = calls.find(([m]) => m === 'range')
    const answer =
      failOnSelect === index
        ? { data: null, error: { message: 'canceling statement due to statement timeout', code: '57014' } }
        : { data: range ? rows.slice(range[1] as number, (range[2] as number) + 1) : rows.slice(0, 1000), error: null }
    return Promise.resolve(answer).then(res, rej)
  }
  return b
}

jest.mock('@/lib/supabase', () => ({
  createDataClient: jest.fn(() => ({ from: (table: string) => (table === 'trades' ? builder() : {}), storage: { from: () => ({}) } })),
}))
jest.mock('@/lib/contexts/AuthContextSupabase', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }),
}))

/** Invented trades, newest first, as the database answers the hook's order */
const tradesOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t-${String(n - i).padStart(5, '0')}` }))

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const step = (calls: Call[], m: string) => calls.filter(([name]) => name === m).map(([, ...args]) => args)

beforeEach(() => {
  selects.length = 0
  rows = []
  failOnSelect = null
})

describe('useTradesSupabase reads every trade', () => {
  it('2,345 trades come back in three pages of a stable order', async () => {
    rows = tradesOf(2345)
    const { result } = renderHook(() => useTradesSupabase(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBeNull()
    expect(result.current.trades).toHaveLength(2345)
    expect(result.current.trades).toEqual(rows)
    expect(selects.map((c) => step(c, 'range'))).toEqual([[[0, 999]], [[1000, 1999]], [[2000, 2999]]])
    for (const calls of selects) {
      expect(step(calls, 'select')).toEqual([['*']])
      expect(step(calls, 'eq')).toEqual([['user_id', 'user-1']])
      expect(step(calls, 'order')).toEqual([
        ['entry_time', { ascending: false }],
        ['id', { ascending: false }],
      ])
      expect(step(calls, 'limit')).toEqual([])
      // .range() comes last, after the filters and the order
      expect(calls[calls.length - 1][0]).toBe('range')
    }
  })

  it('an error on page 2 fails the query (no partial list)', async () => {
    rows = tradesOf(2345)
    failOnSelect = 1
    const { result } = renderHook(() => useTradesSupabase(), { wrapper })
    await waitFor(() => expect(result.current.error).not.toBeNull())

    expect(result.current.error).toMatchObject({ code: '57014' })
    expect(result.current.trades).toEqual([])
    expect(selects).toHaveLength(2)
  })

  it('filters.limit = 1,500 stops at 1,500 rows', async () => {
    rows = tradesOf(2345)
    const { result } = renderHook(() => useTradesSupabase({ limit: 1500 }), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trades).toHaveLength(1500)
    expect(result.current.trades).toEqual(rows.slice(0, 1500))
    expect(selects.map((c) => step(c, 'range'))).toEqual([[[0, 999]], [[1000, 1499]]])
  })

  it('a short first page makes one call', async () => {
    rows = tradesOf(633)
    const { result } = renderHook(() => useTradesSupabase(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trades).toHaveLength(633)
    expect(selects).toHaveLength(1)
    expect(step(selects[0], 'range')).toEqual([[0, 999]])
  })

  it('exactly 1,000 trades take a second, empty page', async () => {
    rows = tradesOf(1000)
    const { result } = renderHook(() => useTradesSupabase(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.trades).toHaveLength(1000)
    expect(selects.map((c) => step(c, 'range'))).toEqual([[[0, 999]], [[1000, 1999]]])
  })

  it('every page keeps the filters', async () => {
    rows = tradesOf(1200)
    const filters = {
      symbol: 'MESZ6',
      result: 'win' as const,
      sessionId: 's-1',
      marketType: 'futures',
      dateFrom: '2026-10-01T00:00:00Z',
      dateTo: '2026-10-31T23:59:59Z',
    }
    const { result } = renderHook(() => useTradesSupabase(filters), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(selects).toHaveLength(2)
    for (const calls of selects) {
      expect(step(calls, 'eq')).toEqual([
        ['user_id', 'user-1'],
        ['symbol', 'MESZ6'],
        ['result', 'win'],
        ['session_id', 's-1'],
        ['market_type', 'futures'],
      ])
      expect(step(calls, 'gte')).toEqual([['entry_time', '2026-10-01T00:00:00Z']])
      expect(step(calls, 'lte')).toEqual([['entry_time', '2026-10-31T23:59:59Z']])
    }
  })
})
