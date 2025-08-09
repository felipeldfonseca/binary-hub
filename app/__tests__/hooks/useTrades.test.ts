import { renderHook, waitFor } from '@testing-library/react'
import { useTrades } from '@/hooks/useTrades'

// Mock the auth hook
const mockUser = {
  uid: 'test-uid',
  email: 'test@example.com',
  displayName: 'Test User',
}

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}))

jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
      uid: 'test-uid',
    },
  },
}))

// Mock fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('useTrades', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('fetchTrades', () => {
    it('fetches trades successfully', async () => {
      const mockResponse = {
        trades: [
          {
            id: '1',
            userId: 'test-uid',
            tradeId: 'trade-1',
            asset: 'EURUSD',
            direction: 'call',
            amount: 100,
            entryPrice: 1.2000,
            exitPrice: 1.2050,
            entryTime: new Date('2024-01-01T10:00:00Z'),
            exitTime: new Date('2024-01-01T10:01:00Z'),
            timeframe: '1m',
            candleTime: '10:00',
            refunded: 0,
            executed: 100,
            status: 'WIN',
            result: 'win',
            profit: 80,
            payout: 180,
            platform: 'IQ Option',
            createdAt: new Date('2024-01-01T10:00:00Z'),
            updatedAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
        pagination: {
          total: 1,
          limit: 10,
          offset: 0,
          hasMore: false,
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      })

      const { result } = renderHook(() => useTrades())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.trades).toEqual(mockResponse.trades)
      expect(result.current.pagination).toEqual(mockResponse.pagination)
      expect(result.current.error).toBeNull()
    })

    it('handles API error correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal server error' }),
      })

      const { result } = renderHook(() => useTrades())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Internal server error')
      expect(result.current.trades).toEqual([])
    })

    it('handles 404 error with specific message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({}),
      })

      const { result } = renderHook(() => useTrades())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('API endpoints not yet implemented. This feature will be available in Phase B.')
    })

    it('constructs query params correctly', async () => {
      const filters = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
        limit: 20,
        offset: 10,
        result: 'win' as const,
        asset: 'EURUSD',
        strategy: 'scalping',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ trades: [], pagination: { total: 0, limit: 20, offset: 10, hasMore: false } }),
      })

      renderHook(() => useTrades(filters))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callArgs = mockFetch.mock.calls[0]
      const url = callArgs[0]
      
      expect(url).toContain('start=2024-01-01T00:00:00.000Z')
      expect(url).toContain('end=2024-01-31T00:00:00.000Z')
      expect(url).toContain('limit=20')
      expect(url).toContain('offset=10')
      expect(url).toContain('result=win')
      expect(url).toContain('asset=EURUSD')
      expect(url).toContain('strategy=scalping')
    })

    it('does not fetch when user is null', () => {
      jest.mocked(require('@/hooks/useAuth').useAuth).mockReturnValue({
        user: null,
      })

      renderHook(() => useTrades())

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('createTrade', () => {
    it('creates trade successfully', async () => {
      const newTrade = {
        asset: 'GBPUSD',
        direction: 'put' as const,
        amount: 50,
        entryPrice: 1.3000,
        exitPrice: 1.2950,
      }

      const mockCreatedTrade = {
        id: '2',
        userId: 'test-uid',
        ...newTrade,
        tradeId: 'trade-2',
        entryTime: new Date(),
        exitTime: new Date(),
        timeframe: '1m',
        candleTime: '10:00',
        refunded: 0,
        executed: 50,
        status: 'WIN',
        result: 'win',
        profit: 40,
        payout: 90,
        platform: 'IQ Option',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockCreatedTrade),
      })

      const { result } = renderHook(() => useTrades())

      let createdTrade
      await waitFor(async () => {
        createdTrade = await result.current.createTrade(newTrade)
        expect(createdTrade).toEqual(mockCreatedTrade)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5004/binary-hub/us-central1/api/v1/trades',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-id-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newTrade),
        }
      )
    })

    it('throws error when user is not authenticated', async () => {
      jest.mocked(require('@/hooks/useAuth').useAuth).mockReturnValue({
        user: null,
      })

      const { result } = renderHook(() => useTrades())

      await expect(result.current.createTrade({})).rejects.toThrow('User not authenticated')
    })
  })

  describe('updateTrade', () => {
    it('updates trade successfully', async () => {
      const tradeId = 'trade-1'
      const updates = { amount: 150 }
      const mockUpdatedTrade = {
        id: tradeId,
        userId: 'test-uid',
        amount: 150,
        asset: 'EURUSD',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUpdatedTrade),
      })

      const { result } = renderHook(() => useTrades())

      // Set initial trades
      result.current.trades = [{
        id: tradeId,
        userId: 'test-uid',
        amount: 100,
        asset: 'EURUSD',
      } as any]

      let updatedTrade
      await waitFor(async () => {
        updatedTrade = await result.current.updateTrade(tradeId, updates)
        expect(updatedTrade).toEqual(mockUpdatedTrade)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:5004/binary-hub/us-central1/api/v1/trades/${tradeId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer mock-id-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      )
    })
  })

  describe('deleteTrade', () => {
    it('deletes trade successfully', async () => {
      const tradeId = 'trade-1'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      })

      const { result } = renderHook(() => useTrades())

      let deleteResult
      await waitFor(async () => {
        deleteResult = await result.current.deleteTrade(tradeId)
        expect(deleteResult).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `http://localhost:5004/binary-hub/us-central1/api/v1/trades/${tradeId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': 'Bearer mock-id-token',
            'Content-Type': 'application/json',
          },
        }
      )
    })
  })

  describe('bulkCreateTrades', () => {
    it('creates multiple trades successfully', async () => {
      const trades = [
        { asset: 'EURUSD', amount: 100 },
        { asset: 'GBPUSD', amount: 150 },
      ]
      const importBatch = 'batch-123'
      
      const mockResponse = { created: 2, batch: importBatch }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      })

      // Mock the fetchTrades function to be called after bulk create
      const mockFetchTrades = jest.fn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ trades: [], pagination: {} }),
      })

      const { result } = renderHook(() => useTrades())

      let bulkResult
      await waitFor(async () => {
        bulkResult = await result.current.bulkCreateTrades(trades, importBatch)
        expect(bulkResult).toEqual(mockResponse)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5004/binary-hub/us-central1/api/v1/trades/bulk',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer mock-id-token',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trades, importBatch }),
        }
      )
    })
  })

  describe('error handling', () => {
    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useTrades())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
    })

    it('handles non-Error objects', async () => {
      mockFetch.mockRejectedValueOnce('String error')

      const { result } = renderHook(() => useTrades())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('An error occurred')
    })
  })

  describe('loading states', () => {
    it('sets loading to true during fetch', async () => {
      mockFetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: jest.fn().mockResolvedValue({ trades: [], pagination: {} }),
            })
          }, 100)
        })
      )

      const { result } = renderHook(() => useTrades())

      // Initially loading should be true
      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })
})