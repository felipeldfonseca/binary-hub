import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MarketPage from '@/app/market/page'
import { MOCK_ANALYSIS } from '@/lib/mockMarketAnalysis'

const mockFetch = jest.fn()
const mockPush = jest.fn()
const mockAuth: {
  user: { id: string } | null
  session: { access_token: string } | null
  loading: boolean
} = { user: { id: 'user-1' }, session: { access_token: 'user-jwt' }, loading: false }

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))

jest.mock('@/components/layout/Navbar', () => ({
  __esModule: true,
  default: () => null,
}))

describe('MarketPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({ ok: true, json: async () => MOCK_ANALYSIS })
    global.fetch = mockFetch as unknown as typeof fetch
    mockAuth.user = { id: 'user-1' }
    mockAuth.session = { access_token: 'user-jwt' }
  })

  it('sends the session token when asking for a live analysis', async () => {
    render(<MarketPage />)

    // The page opens on sample data; the refresh button unlocks once that has loaded
    const refresh = screen.getByRole('button', { name: 'Refresh analysis' })
    await waitFor(() => expect(refresh).not.toBeDisabled(), { timeout: 4000 })

    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(refresh)

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('/api/market/analysis')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer user-jwt')
  })

  it('sends a visitor without a session to the login page', async () => {
    mockAuth.user = null
    mockAuth.session = null

    render(<MarketPage />)

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/login'))
    expect(screen.queryByRole('button', { name: 'Refresh analysis' })).not.toBeInTheDocument()
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
