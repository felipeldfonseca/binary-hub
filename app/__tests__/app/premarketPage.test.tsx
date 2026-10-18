import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import PremarketPage from '@/app/premarket/page'

const mockPush = jest.fn()
const mockAuth: { user: { id: string } | null; loading: boolean } = { user: null, loading: false }

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockAuth,
}))

jest.mock('@/hooks/useWatchlist', () => ({
  useWatchlist: () => ({ watchlist: [], primaryInstruments: [], isLoading: false }),
}))

jest.mock('@/hooks/useMarketData', () => ({
  useMarketData: () => ({
    quotes: [],
    summary: { positive: 0, negative: 0, unchanged: 0, avgChange: 0 },
    isLoading: false,
    isFetching: false,
    refreshQuotes: jest.fn(),
  }),
}))

jest.mock('@/hooks/useTradingSessions', () => ({
  useTradingSessions: () => ({
    todaySession: null,
    savePremarketNotes: { mutateAsync: jest.fn() },
    createOrGetTodaySession: { mutateAsync: jest.fn() },
  }),
}))

describe('PremarketPage', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('sends a visitor without a session to the login page', async () => {
    mockAuth.user = null

    render(<PremarketPage />)

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/auth/login'))
    expect(screen.queryByText('Premarket Analysis')).not.toBeInTheDocument()
  })

  it('shows the page to a signed-in user', () => {
    mockAuth.user = { id: 'user-1' }

    render(<PremarketPage />)

    expect(screen.getByText('Premarket Analysis')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
