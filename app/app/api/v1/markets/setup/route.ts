import { NextRequest, NextResponse } from 'next/server'
import { MarketSelectionData, MarketAccount, MarketPerformance, MarketBankroll, MarketSettings } from '@/types/markets'

// Simple file-based storage for development persistence
// In production this would be Firebase/database
import fs from 'fs'
import path from 'path'

const STORAGE_FILE = path.join(process.cwd(), 'temp-market-accounts.json')

function loadAccounts(): { [userId: string]: MarketAccount[] } {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading accounts:', error)
  }
  return {}
}

function saveAccounts(accounts: { [userId: string]: MarketAccount[] }) {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(accounts, null, 2))
  } catch (error) {
    console.error('Error saving accounts:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (simplified for development)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    // Mock user ID for development - in production this would verify the token
    // For now, use the token as user ID for testing different users
    const userId = token === 'mock-token-for-testing' ? 'test-user-123' : token

    // Parse request body
    const body = await request.json()
    const { marketAccounts }: { marketAccounts: MarketSelectionData[] } = body

    if (!marketAccounts || marketAccounts.length === 0) {
      return NextResponse.json({ error: 'Market accounts required' }, { status: 400 })
    }

    // Validate that at least one market is marked as primary
    const hasPrimaryMarket = marketAccounts.some(market => market.isPrimary)
    if (!hasPrimaryMarket) {
      return NextResponse.json({ error: 'At least one market must be marked as primary' }, { status: 400 })
    }

    // Create market account documents (mock for development)
    const createdAccounts: MarketAccount[] = []
    
    for (const marketData of marketAccounts) {
      const accountId = `${userId}_${marketData.marketType}_${Date.now()}`
      
      // Initialize performance metrics
      const performance: MarketPerformance = {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitLoss: 0,
        profitLossPercentage: 0,
        bestTrade: 0,
        worstTrade: 0,
        averageWin: 0,
        averageLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        currentDrawdown: 0,
        totalVolume: 0,
        averageTradeSize: 0,
        tradingDays: 0,
        averageTradesPerDay: 0,
        lastUpdated: new Date()
      }
      
      // Initialize bankroll
      const bankroll: MarketBankroll = {
        initial: marketData.initialBankroll,
        current: marketData.initialBankroll,
        currency: marketData.currency,
        deposits: marketData.initialBankroll,
        withdrawals: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        lastUpdated: new Date()
      }
      
      // Initialize settings
      const settings: MarketSettings = {
        displayName: marketData.displayName,
        maxRiskPerTrade: 0.02, // 2% default
        notifications: {
          tradeAlerts: true,
          performanceReports: true,
          aiInsights: true,
          socialUpdates: true
        },
        privacy: {
          sharePerformance: false,
          shareTradeHistory: false,
          allowFollowers: true
        },
        preferences: {
          timezone: 'UTC',
          chartType: 'candlestick',
          defaultTimeframe: '1h'
        }
      }
      
      // Create market account
      const marketAccount: MarketAccount = {
        id: accountId,
        userId,
        marketType: marketData.marketType,
        displayName: marketData.displayName,
        bankroll,
        performance,
        settings,
        brokerConnections: [],
        isActive: true,
        isPrimary: marketData.isPrimary,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          experienceLevel: marketData.experienceLevel,
          tradingStyle: [],
          goals: []
        }
      }
      
      createdAccounts.push(marketAccount)
    }
    
    // Store accounts persistently for development
    const allAccounts = loadAccounts()
    allAccounts[userId] = createdAccounts
    saveAccounts(allAccounts)
    console.log(`Mock: Created ${createdAccounts.length} market accounts for user ${userId}`)
    console.log('Stored accounts:', allAccounts)
    
    return NextResponse.json({
      success: true,
      accountsCreated: createdAccounts.length,
      accounts: createdAccounts.map(account => ({
        id: account.id,
        marketType: account.marketType,
        displayName: account.displayName,
        isPrimary: account.isPrimary
      }))
    })
    
  } catch (error) {
    console.error('Error creating market accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication (simplified for development)
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    // Mock user ID for development - in production this would verify the token
    // For now, use the token as user ID for testing different users
    const userId = token === 'mock-token-for-testing' ? 'test-user-123' : token

    // Get stored market accounts for this user
    const allAccounts = loadAccounts()
    const storedAccounts = allAccounts[userId] || []
    console.log(`Getting accounts for user ${userId}:`, storedAccounts)
    console.log('All stored accounts:', allAccounts)
    
    // If no stored accounts, check if mock data is requested for testing
    const url = new URL(request.url)
    const includeMock = url.searchParams.get('mock') === 'true'
    
    let marketAccounts: MarketAccount[] = storedAccounts
    
    if (marketAccounts.length === 0 && includeMock) {
      marketAccounts = [
      {
        id: `${userId}_binary_1734120000000`,
        userId,
        marketType: 'binary',
        displayName: 'My Binary Options',
        bankroll: {
          initial: 1000,
          current: 1250,
          currency: 'USD',
          deposits: 1000,
          withdrawals: 0,
          realizedPnL: 250,
          unrealizedPnL: 0,
          lastUpdated: new Date()
        },
        performance: {
          totalTrades: 45,
          winningTrades: 28,
          losingTrades: 17,
          winRate: 62.2,
          profitLoss: 250,
          profitLossPercentage: 25,
          bestTrade: 85,
          worstTrade: -50,
          averageWin: 32.5,
          averageLoss: -25,
          profitFactor: 1.3,
          maxDrawdown: 150,
          currentDrawdown: 0,
          totalVolume: 22500,
          averageTradeSize: 500,
          tradingDays: 15,
          averageTradesPerDay: 3,
          lastUpdated: new Date()
        },
        settings: {
          displayName: 'My Binary Options',
          maxRiskPerTrade: 0.02,
          notifications: {
            tradeAlerts: true,
            performanceReports: true,
            aiInsights: true,
            socialUpdates: true
          },
          privacy: {
            sharePerformance: false,
            shareTradeHistory: false,
            allowFollowers: true
          },
          preferences: {
            timezone: 'UTC',
            chartType: 'candlestick',
            defaultTimeframe: '1h'
          }
        },
        brokerConnections: [],
        isActive: true,
        isPrimary: true,
        createdAt: new Date('2024-12-01'),
        updatedAt: new Date(),
        metadata: {
          experienceLevel: 'intermediate',
          tradingStyle: [],
          goals: []
        }
      },
      {
        id: `${userId}_forex_1734120060000`,
        userId,
        marketType: 'forex',
        displayName: 'Forex Trading',
        bankroll: {
          initial: 5000,
          current: 4850,
          currency: 'USD',
          deposits: 5000,
          withdrawals: 0,
          realizedPnL: -150,
          unrealizedPnL: 0,
          lastUpdated: new Date()
        },
        performance: {
          totalTrades: 12,
          winningTrades: 6,
          losingTrades: 6,
          winRate: 50,
          profitLoss: -150,
          profitLossPercentage: -3,
          bestTrade: 200,
          worstTrade: -120,
          averageWin: 150,
          averageLoss: -75,
          profitFactor: 0.97,
          maxDrawdown: 300,
          currentDrawdown: 150,
          totalVolume: 60000,
          averageTradeSize: 5000,
          tradingDays: 8,
          averageTradesPerDay: 1.5,
          lastUpdated: new Date()
        },
        settings: {
          displayName: 'Forex Trading',
          maxRiskPerTrade: 0.01,
          notifications: {
            tradeAlerts: true,
            performanceReports: true,
            aiInsights: true,
            socialUpdates: false
          },
          privacy: {
            sharePerformance: true,
            shareTradeHistory: false,
            allowFollowers: true
          },
          preferences: {
            timezone: 'UTC',
            chartType: 'candlestick',
            defaultTimeframe: '4h'
          }
        },
        brokerConnections: [],
        isActive: true,
        isPrimary: false,
        createdAt: new Date('2024-12-01'),
        updatedAt: new Date(),
        metadata: {
          experienceLevel: 'beginner',
          tradingStyle: [],
          goals: []
        }
      }]
    }

    return NextResponse.json({
      success: true,
      marketAccounts
    })

  } catch (error) {
    console.error('Error fetching market accounts:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}