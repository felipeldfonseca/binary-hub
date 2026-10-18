import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMarketData } from '@/hooks/useMarketData'

const mockFetch = jest.fn()
const mockAuth: { session: { access_token: string } | null } = { session: null }

jest.mock('@/lib/contexts/AuthContextSupabase', () => ({
  useAuth: () => mockAuth,
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ in: () => ({ eq: async () => ({ data: [], error: null }) }) }),
    }),
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

describe('useMarketData', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ regularMarketPrice: 7862.25, regularMarketPreviousClose: 7816 }),
    })
    global.fetch = mockFetch as unknown as typeof fetch
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('sends the session token with each quote request', async () => {
    mockAuth.session = { access_token: 'user-jwt' }

    const { result } = renderHook(() => useMarketData(['ES']), { wrapper })

    await waitFor(() => expect(result.current.quotes).toHaveLength(1))
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/market/quote?symbol=ES=F')
    expect(init.headers.Authorization).toBe('Bearer user-jwt')
    expect(result.current.quotes[0].lastPrice).toBe(7862.25)
  })

  it('reports an error instead of empty prices when the session is rejected', async () => {
    mockAuth.session = { access_token: 'expired-jwt' }
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'Unauthorized' }) })

    const { result } = renderHook(() => useMarketData(['ES']), { wrapper })

    await waitFor(() => expect(result.current.error).toBeTruthy())
    expect(result.current.quotes).toEqual([])
  })

  it('skips a symbol the data source cannot serve without failing the rest', async () => {
    mockAuth.session = { access_token: 'user-jwt' }
    mockFetch.mockImplementation(async (url: string) =>
      url.includes('NQ')
        ? { ok: false, status: 500, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ regularMarketPrice: 7862.25 }) }
    )

    const { result } = renderHook(() => useMarketData(['ES', 'NQ']), { wrapper })

    await waitFor(() => expect(result.current.quotes).toHaveLength(1))
    expect(result.current.quotes[0].symbol).toBe('ES')
    expect(result.current.error).toBeNull()
  })

  it('waits for a session before requesting quotes', async () => {
    mockAuth.session = null

    renderHook(() => useMarketData(['ES']), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
