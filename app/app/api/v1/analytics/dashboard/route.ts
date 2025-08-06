import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || 'weekly'
  
  // Mock data that reflects uploaded trades
  const mockData = {
    period,
    stats: {
      totalTrades: 10,
      winTrades: 8,
      lossTrades: 2,
      winRate: 80.0,
      totalPnl: 82.28,
      avgPnl: 8.23,
      maxDrawdown: -12.00,
      avgStake: 13.80,
      maxStake: 25.00
    },
    performance: [
      { date: '2025-08-01', trades: 2, pnl: 15.31 },
      { date: '2025-08-02', trades: 1, pnl: -12.00 },
      { date: '2025-08-03', trades: 2, pnl: 31.25 },
      { date: '2025-08-04', trades: 1, pnl: 7.36 },
      { date: '2025-08-05', trades: 4, pnl: 40.36 }
    ],
    recentTrades: [
      { id: '68915477593a1b66d8941cda', asset: 'MEMXUSDT', result: 'win', profit: 7.36, amount: 8 },
      { id: '68915477593a1b66d8941cdb', asset: 'MEMXUSDT', result: 'win', profit: 8.95, amount: 10 },
      { id: '68915477593a1b66d8941cdc', asset: 'MEMXUSDT', result: 'loss', profit: -12.00, amount: 12 },
      { id: '68915477593a1b66d8941cdd', asset: 'MEMXUSDT', result: 'win', profit: 13.42, amount: 15 },
      { id: '68915477593a1b66d8941cde', asset: 'MEMXUSDT', result: 'win', profit: 7.36, amount: 8 }
    ]
  }
  
  return NextResponse.json(mockData)
} 