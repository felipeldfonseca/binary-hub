import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'weekly'
  
  // Mock data for testing
  const mockData = {
    period,
    stats: {
      totalTrades: 45,
      winTrades: 28,
      lossTrades: 17,
      winRate: 62.2,
      totalPnl: 1250.50,
      avgPnl: 27.78,
      maxDrawdown: -150.00,
      avgStake: 85.00,
      maxStake: 200.00
    },
    performance: [
      { date: '2025-08-01', trades: 5, pnl: 125.00 },
      { date: '2025-08-02', trades: 3, pnl: -45.00 },
      { date: '2025-08-03', trades: 7, pnl: 180.00 },
      { date: '2025-08-04', trades: 4, pnl: 95.00 },
      { date: '2025-08-05', trades: 6, pnl: 210.00 },
      { date: '2025-08-06', trades: 8, pnl: 320.00 },
      { date: '2025-08-07', trades: 12, pnl: 365.50 }
    ]
  }
  
  return NextResponse.json(mockData)
} 