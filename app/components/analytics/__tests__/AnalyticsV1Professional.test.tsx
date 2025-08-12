/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AnalyticsV1Professional from '../versions/AnalyticsV1Professional'

// Mock the hooks
jest.mock('@/lib/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    isPortuguese: false,
    language: 'en',
    setLanguage: jest.fn()
  })
}))

jest.mock('@/hooks/useTradeStats', () => ({
  useTradeStats: () => ({
    stats: {
      totalTrades: 10,
      winRate: 60,
      totalPnl: 150,
      avgPnl: 15,
      maxDrawdown: -50
    },
    loading: false,
    error: null
  })
}))

jest.mock('@/hooks/useTrades', () => ({
  useTrades: () => ({
    trades: [
      {
        id: '1',
        asset: 'EURUSD',
        direction: 'call',
        amount: 25,
        profit: 20,
        entryTime: new Date('2025-08-09T10:30:00Z'),
        result: 'win',
        strategy: 'Test Strategy'
      }
    ],
    loading: false,
    error: null
  })
}))

describe('AnalyticsV1Professional', () => {
  it('renders the component with data', () => {
    render(<AnalyticsV1Professional />)
    
    // Check if the main title is rendered
    expect(screen.getByText('Professional Analytics')).toBeInTheDocument()
    
    // Check if overview tab is active by default
    expect(screen.getByText('Overview')).toBeInTheDocument()
    
    // Check if key metrics are displayed
    expect(screen.getByText('10')).toBeInTheDocument() // Total trades
    expect(screen.getByText('60.0%')).toBeInTheDocument() // Win rate
  })

  it('renders empty state when no data', () => {
    // Override the mock to return no trades
    jest.doMock('@/hooks/useTrades', () => ({
      useTrades: () => ({
        trades: [],
        loading: false,
        error: null
      })
    }))

    render(<AnalyticsV1Professional />)
    
    // Should show empty state
    expect(screen.getByText('Import your data to get started')).toBeInTheDocument()
  })
})