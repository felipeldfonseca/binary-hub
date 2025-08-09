import { renderHook, waitFor } from '@testing-library/react'
import { useTradeStats } from '@/hooks/useTradeStats'

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

// Mock DOM methods for export functionality
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: jest.fn(() => 'mock-object-url'),
    revokeObjectURL: jest.fn(),
  },
})

Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => ({
    href: '',
    download: '',
    click: jest.fn(),
  })),
})

Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn(),
})

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn(),
})

describe('useTradeStats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockClear()
  })

  describe('fetchDashboardStats', () => {
    it('fetches dashboard stats successfully', async () => {
      const mockDashboardStats = {
        period: 'week',
        stats: {
          totalTrades: 100,
          winTrades: 65,
          lossTrades: 30,
          tieTrades: 5,
          winRate: 65.0,
          totalPnl: 1500.50,
          avgPnl: 15.01,
          maxDrawdown: 250.00,
          avgStake: 100.0,
          maxStake: 500.0,
        },
        performance: [
          { date: '2024-01-01', trades: 10, pnl: 150.00 },
          { date: '2024-01-02', trades: 8, pnl: 120.00 },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockDashboardStats),
      })

      const { result } = renderHook(() => useTradeStats('week'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.dashboardStats).toEqual(mockDashboardStats)
      expect(result.current.stats).toEqual(mockDashboardStats.stats)
      expect(result.current.error).toBeNull()
    })

    it('uses correct period parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          period: 'month',
          stats: {},
          performance: [],
        }),
      })

      renderHook(() => useTradeStats('month'))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      const callArgs = mockFetch.mock.calls[0]
      const url = callArgs[0]
      expect(url).toContain('period=month')
    })

    it('handles API error correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Internal server error' }),
      })

      const { result } = renderHook(() => useTradeStats())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Internal server error')
      expect(result.current.dashboardStats).toBeNull()
    })

    it('handles 404 error with specific message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: jest.fn().mockResolvedValue({}),
      })

      const { result } = renderHook(() => useTradeStats())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('API endpoints not yet implemented. This feature will be available in Phase B.')
    })

    it('does not fetch when user is null', () => {
      jest.mocked(require('@/hooks/useAuth').useAuth).mockReturnValue({
        user: null,
      })

      renderHook(() => useTradeStats())

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('fetchPerformanceMetrics', () => {
    it('fetches performance metrics successfully', async () => {
      const mockPerformanceMetrics = {
        period: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-31T23:59:59Z',
        },
        metrics: {
          totalTrades: 150,
          winTrades: 90,
          lossTrades: 55,
          tieTrades: 5,
          winRate: 60.0,
          totalPnl: 2000.0,
          avgPnl: 13.33,
          maxDrawdown: 300.0,
          avgStake: 120.0,
          maxStake: 600.0,
        },
        assetBreakdown: [
          { asset: 'EURUSD', trades: 50, winRate: 65.0, totalPnl: 800.0 },
          { asset: 'GBPUSD', trades: 40, winRate: 55.0, totalPnl: 600.0 },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockPerformanceMetrics),
      })

      const { result } = renderHook(() => useTradeStats())

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await waitFor(async () => {
        await result.current.fetchPerformanceMetrics(startDate, endDate)
      })

      expect(result.current.performanceMetrics).toEqual(mockPerformanceMetrics)
      
      const callArgs = mockFetch.mock.calls[1] // Second call after dashboard stats
      const url = callArgs[0]
      expect(url).toContain('start=2024-01-01T00:00:00.000Z')
      expect(url).toContain('end=2024-01-31T00:00:00.000Z')
    })

    it('fetches performance metrics without date filters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          period: { start: '', end: '' },
          metrics: {},
          assetBreakdown: [],
        }),
      })

      const { result } = renderHook(() => useTradeStats())

      await waitFor(async () => {
        await result.current.fetchPerformanceMetrics()
      })

      const callArgs = mockFetch.mock.calls[1] // Second call after dashboard stats
      const url = callArgs[0]
      expect(url).not.toContain('start=')
      expect(url).not.toContain('end=')
    })
  })

  describe('exportTrades', () => {
    it('exports trades as CSV successfully', async () => {
      const mockBlob = new Blob(['mock csv data'], { type: 'text/csv' })
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(mockBlob),
      })

      const { result } = renderHook(() => useTradeStats())

      await waitFor(async () => {
        await result.current.exportTrades('csv')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('format=csv'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer mock-id-token',
            'Content-Type': 'application/json',
          },
        })
      )

      expect(window.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(document.createElement).toHaveBeenCalledWith('a')
    })

    it('exports trades as JSON successfully', async () => {
      const mockJsonData = {
        trades: [
          { id: '1', asset: 'EURUSD', amount: 100 },
          { id: '2', asset: 'GBPUSD', amount: 150 },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJsonData),
      })

      const { result } = renderHook(() => useTradeStats())

      let exportResult
      await waitFor(async () => {
        exportResult = await result.current.exportTrades('json')
      })

      expect(exportResult).toEqual(mockJsonData)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('format=json'),
        expect.any(Object)
      )
    })

    it('includes date filters in export', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValue(new Blob()),
      })

      const { result } = renderHook(() => useTradeStats())

      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')

      await waitFor(async () => {
        await result.current.exportTrades('csv', startDate, endDate)
      })

      const callArgs = mockFetch.mock.calls[1] // Second call after dashboard stats
      const url = callArgs[0]
      expect(url).toContain('start=2024-01-01T00:00:00.000Z')
      expect(url).toContain('end=2024-01-31T00:00:00.000Z')
    })

    it('throws error when user is not authenticated', async () => {
      jest.mocked(require('@/hooks/useAuth').useAuth).mockReturnValue({
        user: null,
      })

      const { result } = renderHook(() => useTradeStats())

      await expect(result.current.exportTrades()).rejects.toThrow('User not authenticated')
    })

    it('handles export API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'Export failed' }),
      })

      const { result } = renderHook(() => useTradeStats())

      await expect(result.current.exportTrades()).rejects.toThrow('Export failed')
    })
  })

  describe('error handling', () => {
    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useTradeStats())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
    })

    it('handles non-Error objects', async () => {
      mockFetch.mockRejectedValueOnce('String error')

      const { result } = renderHook(() => useTradeStats())

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
              json: jest.fn().mockResolvedValue({
                period: 'week',
                stats: {},
                performance: [],
              }),
            })
          }, 100)
        })
      )

      const { result } = renderHook(() => useTradeStats())

      // Initially loading should be true
      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('period changes', () => {
    it('refetches data when period changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          period: 'month',
          stats: {},
          performance: [],
        }),
      })

      const { result, rerender } = renderHook(
        ({ period }) => useTradeStats(period),
        {
          initialProps: { period: 'week' as const },
        }
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Change period
      rerender({ period: 'month' as const })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2) // Initial call + period change call
      })

      const secondCallArgs = mockFetch.mock.calls[1]
      const url = secondCallArgs[0]
      expect(url).toContain('period=month')
    })
  })

})