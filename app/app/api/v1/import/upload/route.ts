import { NextResponse } from 'next/server'

// Simple CSV parser for testing
function parseEbinexCsv(content: string) {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  
  const trades = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = lines[i].split(',')
      const trade = {
        tradeId: values[0],
        entryTime: values[1],
        asset: values[2],
        timeframe: values[3],
        direction: values[4],
        candleTime: values[5],
        entryPrice: parseFloat(values[6].replace('$ ', '').replace(',', '')),
        exitPrice: parseFloat(values[7].replace('$ ', '').replace(',', '')),
        amount: parseFloat(values[8].replace('$ ', '')),
        refunded: parseFloat(values[9].replace('$ ', '')),
        executed: parseFloat(values[10].replace('$ ', '')),
        status: values[11],
        profit: parseFloat(values[12])
      }
      trades.push(trade)
    }
  }
  
  return trades
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('csv') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No CSV file provided' },
        { status: 400 }
      )
    }
    
    // Read file content
    const content = await file.text()
    
    // Parse CSV
    const trades = parseEbinexCsv(content)
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Calculate statistics
    const totalRows = trades.length
    const winTrades = trades.filter(t => t.status === 'WIN').length
    const lossTrades = trades.filter(t => t.status === 'LOSE').length
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0)
    const avgStake = trades.reduce((sum, t) => sum + t.amount, 0) / trades.length
    
    // Mock successful upload
    const uploadId = `upload_${Date.now()}`
    
    return NextResponse.json({
      uploadId,
      status: 'completed',
      totalRows,
      importedRows: totalRows,
      duplicateRows: 0,
      errors: [],
      processingTime: 2000,
      statistics: {
        winTrades,
        lossTrades,
        winRate: Math.round((winTrades / totalRows) * 100),
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgStake: Math.round(avgStake * 100) / 100
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 