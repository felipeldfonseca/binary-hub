import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '10')
  const offset = parseInt(searchParams.get('offset') || '0')
  const result = searchParams.get('result')
  const asset = searchParams.get('asset')
  
  // Mock trades data
  const allTrades = [
    {
      id: '68915477593a1b66d8941cda',
      tradeId: '68915477593a1b66d8941cda',
      asset: 'MEMXUSDT',
      direction: 'put',
      amount: 8,
      entryPrice: 2.4664,
      exitPrice: 2.4651,
      entryTime: '2025-08-05T00:46:47.013+00:00',
      exitTime: '2025-08-05T00:47:47.013+00:00',
      result: 'win',
      profit: 7.36,
      status: 'WIN',
      timeframe: 'M1',
      candleTime: '21:47',
      platform: 'Ebinex',
      createdAt: '2025-08-05T00:46:47.013+00:00',
      updatedAt: '2025-08-05T00:47:47.013+00:00'
    },
    {
      id: '68915477593a1b66d8941cdb',
      tradeId: '68915477593a1b66d8941cdb',
      asset: 'MEMXUSDT',
      direction: 'call',
      amount: 10,
      entryPrice: 2.4651,
      exitPrice: 2.4668,
      entryTime: '2025-08-05T00:47:12.245+00:00',
      exitTime: '2025-08-05T00:48:12.245+00:00',
      result: 'win',
      profit: 8.95,
      status: 'WIN',
      timeframe: 'M1',
      candleTime: '21:48',
      platform: 'Ebinex',
      createdAt: '2025-08-05T00:47:12.245+00:00',
      updatedAt: '2025-08-05T00:48:12.245+00:00'
    },
    {
      id: '68915477593a1b66d8941cdc',
      tradeId: '68915477593a1b66d8941cdc',
      asset: 'MEMXUSDT',
      direction: 'put',
      amount: 12,
      entryPrice: 2.4668,
      exitPrice: 2.4655,
      entryTime: '2025-08-05T00:47:35.892+00:00',
      exitTime: '2025-08-05T00:48:35.892+00:00',
      result: 'loss',
      profit: -12.00,
      status: 'LOSE',
      timeframe: 'M1',
      candleTime: '21:49',
      platform: 'Ebinex',
      createdAt: '2025-08-05T00:47:35.892+00:00',
      updatedAt: '2025-08-05T00:48:35.892+00:00'
    },
    {
      id: '68915477593a1b66d8941cdd',
      tradeId: '68915477593a1b66d8941cdd',
      asset: 'MEMXUSDT',
      direction: 'call',
      amount: 15,
      entryPrice: 2.4655,
      exitPrice: 2.4672,
      entryTime: '2025-08-05T00:48:01.156+00:00',
      exitTime: '2025-08-05T00:49:01.156+00:00',
      result: 'win',
      profit: 13.42,
      status: 'WIN',
      timeframe: 'M1',
      candleTime: '21:50',
      platform: 'Ebinex',
      createdAt: '2025-08-05T00:48:01.156+00:00',
      updatedAt: '2025-08-05T00:49:01.156+00:00'
    },
    {
      id: '68915477593a1b66d8941cde',
      tradeId: '68915477593a1b66d8941cde',
      asset: 'MEMXUSDT',
      direction: 'put',
      amount: 8,
      entryPrice: 2.4672,
      exitPrice: 2.4659,
      entryTime: '2025-08-05T00:48:25.734+00:00',
      exitTime: '2025-08-05T00:49:25.734+00:00',
      result: 'win',
      profit: 7.36,
      status: 'WIN',
      timeframe: 'M1',
      candleTime: '21:51',
      platform: 'Ebinex',
      createdAt: '2025-08-05T00:48:25.734+00:00',
      updatedAt: '2025-08-05T00:49:25.734+00:00'
    }
  ]
  
  // Apply filters
  let filteredTrades = allTrades
  if (result) {
    filteredTrades = filteredTrades.filter(t => t.result === result)
  }
  if (asset) {
    filteredTrades = filteredTrades.filter(t => t.asset === asset)
  }
  
  // Apply pagination
  const paginatedTrades = filteredTrades.slice(offset, offset + limit)
  
  return NextResponse.json({
    trades: paginatedTrades,
    pagination: {
      total: filteredTrades.length,
      limit,
      offset,
      hasMore: offset + limit < filteredTrades.length
    }
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Mock trade creation
    const newTrade = {
      id: `trade_${Date.now()}`,
      tradeId: `trade_${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    return NextResponse.json(newTrade, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create trade', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 