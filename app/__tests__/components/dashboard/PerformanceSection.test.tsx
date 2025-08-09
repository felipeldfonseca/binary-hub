import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PerformanceSection from '@/components/dashboard/PerformanceSection'

// Mock the hooks
const mockUseTradeStats = {
  stats: {
    totalTrades: 150,
    winTrades: 90,
    lossTrades: 55,
    tieTrades: 5,
    winRate: 60.0,
    totalPnl: 2500.50,
    avgPnl: 16.67,
    maxDrawdown: 450.25,
    avgStake: 100.0,
    maxStake: 500.0,
  },
  dashboardStats: null,
  loading: false,
  error: null,
}

jest.mock('@/hooks/useTradeStats', () => ({
  useTradeStats: jest.fn(() => mockUseTradeStats),
}))

// Mock the PerformanceChart component
jest.mock('@/components/charts/PerformanceChart', () => {
  return function MockPerformanceChart({ period }: { period: string }) {
    return <div data-testid="performance-chart">Mock Chart for {period}</div>
  }
})

const { useTradeStats } = require('@/hooks/useTradeStats')

describe('PerformanceSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useTradeStats.mockReturnValue(mockUseTradeStats)
  })

  it('renders performance section with stats', () => {
    render(<PerformanceSection />)
    
    expect(screen.getByText('Performance')).toBeInTheDocument()
    
    // Check KPI cards
    expect(screen.getByText('Net P&L')).toBeInTheDocument()
    expect(screen.getByText('$2,500.5')).toBeInTheDocument() // Formatted total PnL
    
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    
    expect(screen.getByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    
    expect(screen.getByText('Average P&L')).toBeInTheDocument()
    expect(screen.getByText('$16.67')).toBeInTheDocument()
    
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument()
    expect(screen.getByText('$450.25')).toBeInTheDocument()
  })

  it('displays period filter buttons', () => {
    render(<PerformanceSection />)
    
    const periodButtons = ['Day', 'Week', 'Month', '3 Months', '6 Months', 'Year']
    
    periodButtons.forEach(period => {
      expect(screen.getByRole('button', { name: period })).toBeInTheDocument()
    })
    
    // Week should be selected by default
    const weekButton = screen.getByRole('button', { name: 'Week' })
    expect(weekButton).toHaveClass('bg-primary', 'text-text')
  })

  it('changes selected period when button is clicked', async () => {
    const user = userEvent.setup()
    render(<PerformanceSection />)
    
    const monthButton = screen.getByRole('button', { name: 'Month' })
    await user.click(monthButton)
    
    // Check if useTradeStats was called with the new period
    expect(useTradeStats).toHaveBeenCalledWith('month')
    
    // Check if the button is now selected
    expect(monthButton).toHaveClass('bg-primary', 'text-text')
  })

  it('displays loading state', () => {
    useTradeStats.mockReturnValue({
      ...mockUseTradeStats,
      loading: true,
    })

    render(<PerformanceSection />)
    
    // Should show loading skeletons
    expect(screen.getAllByText('Performance')).toHaveLength(1)
    const loadingCards = screen.container.querySelectorAll('.animate-pulse')
    expect(loadingCards.length).toBeGreaterThan(0)
  })

  it('displays error state', async () => {
    const user = userEvent.setup()
    useTradeStats.mockReturnValue({
      ...mockUseTradeStats,
      loading: false,
      error: 'Failed to load data',
    })

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: jest.fn() },
      writable: true,
    })

    render(<PerformanceSection />)
    
    expect(screen.getByText('Error loading performance data: Failed to load data')).toBeInTheDocument()
    
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    expect(retryButton).toBeInTheDocument()
    
    await user.click(retryButton)
    expect(window.location.reload).toHaveBeenCalled()
  })

  it('displays default values when no stats available', () => {
    useTradeStats.mockReturnValue({
      ...mockUseTradeStats,
      stats: null,
    })

    render(<PerformanceSection />)
    
    // Should show zero values
    expect(screen.getByText('$0')).toBeInTheDocument() // Net P&L
    expect(screen.getByText('0.0%')).toBeInTheDocument() // Win Rate
    expect(screen.getByText('0')).toBeInTheDocument() // Total Trades
    expect(screen.getByText('$0.00')).toBeInTheDocument() // Average P&L and Max Drawdown
  })

  it('renders performance chart with correct period', () => {
    render(<PerformanceSection />)
    
    const chart = screen.getByTestId('performance-chart')
    expect(chart).toBeInTheDocument()
    expect(chart).toHaveTextContent('Mock Chart for week')
    
    expect(screen.getByText('Cumulative Net P&L')).toBeInTheDocument()
  })

  it('updates chart period when filter changes', async () => {
    const user = userEvent.setup()
    render(<PerformanceSection />)
    
    const dayButton = screen.getByRole('button', { name: 'Day' })
    await user.click(dayButton)
    
    const chart = screen.getByTestId('performance-chart')
    expect(chart).toHaveTextContent('Mock Chart for day')
  })

  it('applies correct color classes for positive P&L', () => {
    render(<PerformanceSection />)
    
    const netPnl = screen.getByText('$2,501')
    expect(netPnl).toHaveClass('text-win')
    
    const avgPnl = screen.getByText('$16.67')
    expect(avgPnl).toHaveClass('text-win')
  })

  it('applies correct color classes for negative P&L', () => {
    useTradeStats.mockReturnValue({
      ...mockUseTradeStats,
      stats: {
        ...mockUseTradeStats.stats,
        totalPnl: -1500.0,
        avgPnl: -10.0,
      },
    })

    render(<PerformanceSection />)
    
    const netPnl = screen.getByText('-$1,500')
    expect(netPnl).toHaveClass('text-loss')
    
    const avgPnl = screen.getByText('-$10.00')
    expect(avgPnl).toHaveClass('text-loss')
  })

  it('displays correct period text for different periods', async () => {
    const user = userEvent.setup()
    const periodTests = [
      { button: 'Day', text: 'on the day' },
      { button: 'Week', text: 'on the week' },
      { button: 'Month', text: 'on the month' },
      { button: '3 Months', text: 'in the last 3 months' },
      { button: '6 Months', text: 'in the last 6 months' },
      { button: 'Year', text: 'on the year' },
    ]

    for (const { button, text } of periodTests) {
      render(<PerformanceSection />)
      
      const periodButton = screen.getByRole('button', { name: button })
      await user.click(periodButton)
      
      expect(screen.getAllByText(text)[0]).toBeInTheDocument()
      
      // Clean up for next iteration
      screen.unmount()
    }
  })

  it('formats large numbers correctly', () => {
    useTradeStats.mockReturnValue({
      ...mockUseTradeStats,
      stats: {
        ...mockUseTradeStats.stats,
        totalPnl: 12345.67,
        totalTrades: 1250,
      },
    })

    render(<PerformanceSection />)
    
    expect(screen.getByText('$12,346')).toBeInTheDocument() // Formatted with commas
    expect(screen.getByText('1250')).toBeInTheDocument()
  })

  it('has proper responsive layout classes', () => {
    render(<PerformanceSection />)
    
    const section = screen.getByText('Performance').closest('section')
    expect(section).toHaveClass('py-16', 'bg-background')
    
    const container = section?.querySelector('.container')
    expect(container).toHaveClass('mx-auto', 'px-4')
    
    const kpiGrid = section?.querySelector('.grid')
    expect(kpiGrid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-5')
  })

  it('handles edge case with zero trades', () => {
    useTradeStats.mockReturnValue({
      ...mockUseTradeStats,
      stats: {
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        tieTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnl: 0,
        maxDrawdown: 0,
        avgStake: 0,
        maxStake: 0,
      },
    })

    render(<PerformanceSection />)
    
    expect(screen.getByText('0')).toBeInTheDocument() // Total trades
    expect(screen.getByText('0.0%')).toBeInTheDocument() // Win rate
    expect(screen.getByText('$0')).toBeInTheDocument() // Net P&L
  })
})