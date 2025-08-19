import { NextResponse } from 'next/server'

// Improved CSV parser for Ebinex format with proper quote handling
function parseEbinexCsv(content: string) {
  const lines = content.trim().split('\n')
  
  // Parse CSV with proper quote handling for comma-separated values
  function parseCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // Don't forget the last field
    result.push(current.trim())
    return result
  }
  
  const headers = parseCsvLine(lines[0])
  console.log('CSV Headers:', headers)
  console.log('Total lines:', lines.length)
  
  const trades = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCsvLine(lines[i])
      
      // Helper function to safely parse numbers
      const safeParseFloat = (str: string) => {
        if (!str || str === '') return 0
        const cleaned = str.replace(/[$\s,]/g, '')
        const parsed = parseFloat(cleaned)
        return isNaN(parsed) ? 0 : parsed
      }
      
      // Based on your CSV format:
      // ID, Data, Ativo, Tempo, Previsão, Vela, P. ABRT, P. FECH, Valor, Estornado, Executado, Status, Resultado
      const entryPrice = safeParseFloat(values[6])    // P. ABRT (opening price)
      const exitPrice = safeParseFloat(values[7])     // P. FECH (closing price)
      const amount = safeParseFloat(values[8])        // Valor (stake amount)
      const refunded = safeParseFloat(values[9])      // Estornado (refunded amount)
      const executed = safeParseFloat(values[10])     // Executado (executed amount)
      const rawStatus = values[11] || 'UNKNOWN'       // Status (WIN/LOSE/REFUNDED)
      const rawProfit = safeParseFloat(values[12])    // Resultado (profit amount)
      
      // Determine correct status and profit
      let status = rawStatus
      let profit = rawProfit
      
      // Handle REFUNDED case: when entry price equals exit price
      if (entryPrice === exitPrice) {
        status = 'REFUNDED'
        profit = 0 // No profit/loss on refunded trades
      } else if (status === 'LOSE') {
        // For LOSE trades, profit should be negative
        profit = -rawProfit
      }
      // WIN trades keep positive profit as-is
      
      const trade = {
        tradeId: values[0] || `trade-${i}`,                    // ID
        entryTime: values[1] || new Date().toISOString(),      // Data
        asset: values[2] || 'UNKNOWN',                         // Ativo
        timeframe: values[3] || '1m',                          // Tempo
        direction: values[4] || 'call',                        // Previsão
        candleTime: values[5] || '00:00',                      // Vela
        entryPrice,                                            // P. ABRT (opening price)
        exitPrice,                                             // P. FECH (closing price)
        amount,                                                // Valor (stake amount)
        refunded,                                              // Estornado (refunded amount)
        executed,                                              // Executado (executed amount)
        status,                                                // Status (WIN/LOSE/REFUNDED)
        profit                                                 // Resultado (net profit/loss)
      }
      
      // Log first few trades to debug
      if (i <= 3) {
        console.log(`Trade ${i}:`, trade)
        console.log(`Raw values:`, values)
      }
      
      trades.push(trade)
    }
  }
  
  // Sort trades chronologically by entryTime (earliest first)
  trades.sort((a, b) => {
    const dateA = new Date(a.entryTime)
    const dateB = new Date(b.entryTime)
    return dateA.getTime() - dateB.getTime()
  })
  
  console.log('Trades sorted chronologically:')
  trades.forEach((trade, index) => {
    console.log(`${index + 1}. ${trade.entryTime} - ${trade.status} - $${trade.profit}`)
  })
  
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
    
    // Debug: Log the parsed trades
    console.log('Parsed trades:', trades.slice(0, 3)) // Log first 3 trades
    console.log('Trade structure sample:', trades[0])
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Calculate statistics with correct PnL logic
    const totalRows = trades.length
    const winTrades = trades.filter(t => t.status === 'WIN').length
    const lossTrades = trades.filter(t => t.status === 'LOSE').length
    const refundedTrades = trades.filter(t => t.status === 'REFUNDED').length
    
    // Calculate total profit correctly (profit is already positive/negative)
    const totalProfit = trades.reduce((sum, trade) => sum + trade.profit, 0)
    
    const avgStake = trades.length > 0 ? trades.reduce((sum, t) => sum + (t.amount || 0), 0) / trades.length : 0
    
    // Mock successful upload
    const uploadId = `upload_${Date.now()}`
    
    // Store the parsed trades data in a way the frontend can access
    // Note: In a real implementation, this would be saved to Firestore
    // For now, we'll use headers to signal the frontend to set localStorage
    const response = NextResponse.json({
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
        refundedTrades,
        winRate: Math.round((winTrades / totalRows) * 100),
        totalProfit: Math.round(totalProfit * 100) / 100,
        avgStake: Math.round(avgStake * 100) / 100
      },
      // Include the actual trades data so frontend can store it
      trades: trades.map(trade => {
        // Status and profit are already correctly calculated in the parser
        const result = trade.status === 'WIN' ? 'win' : 
                      trade.status === 'LOSE' ? 'loss' : 
                      trade.status === 'REFUNDED' ? 'refunded' : 'tie'
        
        return {
          id: trade.tradeId,
          entryTime: trade.entryTime,
          asset: trade.asset,
          direction: trade.direction,
          amount: trade.amount,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          result,
          profit: trade.profit,
          pnl: trade.profit,
          status: `$ ${trade.profit.toFixed(2)}`,
          // Additional fields for compatibility
          timeframe: trade.timeframe,
          candleTime: trade.candleTime,
          refunded: trade.refunded,
          executed: trade.executed
        }
      })
    })
    
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 