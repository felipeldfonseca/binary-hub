import { NextRequest, NextResponse } from 'next/server'
import { MarketSelectionData, MarketAccount, MarketPerformance, MarketBankroll, MarketSettings } from '@/types/markets'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Initialize Firebase Admin SDK
if (!getApps().length) {
  if (process.env.NODE_ENV === 'production') {
    initializeApp({
      credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'))
    })
  } else {
    // For development with Firebase emulators
    initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-binary-hub'
    })
  }
}

const db = getFirestore()
const auth = getAuth()

// Collection paths
const MARKET_ACCOUNTS_COLLECTION = 'market_accounts'
const USERS_COLLECTION = 'users'

async function verifyAuthToken(token: string): Promise<string | null> {
  try {
    // For development with Firebase emulators, handle special case
    if (process.env.NODE_ENV === 'development' && token === 'mock-token-for-testing') {
      console.warn('⚠️ Using mock authentication for development only')
      return 'test-user-123'
    }
    
    // Verify real Firebase token
    const decodedToken = await auth.verifyIdToken(token)
    return decodedToken.uid
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

async function getMarketAccounts(userId: string): Promise<MarketAccount[]> {
  try {
    const accountsRef = db.collection(MARKET_ACCOUNTS_COLLECTION).doc(userId).collection('accounts')
    const snapshot = await accountsRef.where('isActive', '==', true).get()
    
    const accounts: MarketAccount[] = []
    snapshot.forEach(doc => {
      const data = doc.data()
      // Convert Firestore Timestamps to JavaScript Dates
      const account = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt),
        bankroll: {
          ...data.bankroll,
          lastUpdated: data.bankroll?.lastUpdated?.toDate ? data.bankroll.lastUpdated.toDate() : new Date(data.bankroll?.lastUpdated)
        },
        performance: {
          ...data.performance,
          lastUpdated: data.performance?.lastUpdated?.toDate ? data.performance.lastUpdated.toDate() : new Date(data.performance?.lastUpdated)
        }
      } as MarketAccount
      accounts.push(account)
    })
    
    return accounts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch (error) {
    console.error('Error fetching market accounts:', error)
    return []
  }
}

async function createMarketAccounts(userId: string, marketData: MarketSelectionData[]): Promise<MarketAccount[]> {
  const batch = db.batch()
  const createdAccounts: MarketAccount[] = []
  
  try {
    for (const market of marketData) {
      const accountId = `${market.marketType}_${Date.now()}`
      const accountRef = db.collection(MARKET_ACCOUNTS_COLLECTION).doc(userId).collection('accounts').doc(accountId)
      
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
        initial: market.initialBankroll,
        current: market.initialBankroll,
        currency: market.currency,
        deposits: market.initialBankroll,
        withdrawals: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        lastUpdated: new Date()
      }
      
      // Initialize settings
      const settings: MarketSettings = {
        displayName: market.displayName,
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
        marketType: market.marketType,
        displayName: market.displayName,
        bankroll,
        performance,
        settings,
        brokerConnections: [],
        isActive: true,
        isPrimary: market.isPrimary,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          experienceLevel: market.experienceLevel,
          tradingStyle: [],
          goals: []
        }
      }
      
      batch.set(accountRef, marketAccount)
      createdAccounts.push(marketAccount)
    }
    
    // Commit the batch
    await batch.commit()
    
    // Update user document with onboarding completion
    const userRef = db.collection(USERS_COLLECTION).doc(userId)
    await userRef.set({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
      marketAccountsCount: createdAccounts.length
    }, { merge: true })
    
    console.log(`✅ Created ${createdAccounts.length} market accounts for user ${userId}`)
    return createdAccounts
    
  } catch (error) {
    console.error('Error creating market accounts:', error)
    throw new Error('Failed to create market accounts')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    const userId = await verifyAuthToken(token)
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { marketAccounts }: { marketAccounts: MarketSelectionData[] } = body

    if (!marketAccounts || marketAccounts.length === 0) {
      return NextResponse.json({ error: 'Market accounts required' }, { status: 400 })
    }

    // Check for existing accounts for this user
    const existingAccounts = await getMarketAccounts(userId)
    
    if (existingAccounts.length > 0) {
      console.log(`User ${userId} already has ${existingAccounts.length} market accounts. Returning existing accounts.`)
      return NextResponse.json({
        success: true,
        message: 'Market accounts already exist for this user',
        accountsCreated: 0,
        accounts: existingAccounts.map(account => ({
          id: account.id,
          marketType: account.marketType,
          displayName: account.displayName,
          isPrimary: account.isPrimary
        }))
      })
    }

    // Validate that at least one market is marked as primary
    const hasPrimaryMarket = marketAccounts.some(market => market.isPrimary)
    if (!hasPrimaryMarket) {
      return NextResponse.json({ error: 'At least one market must be marked as primary' }, { status: 400 })
    }

    // Create market account documents in Firestore
    const createdAccounts = await createMarketAccounts(userId, marketAccounts)
    
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
    // Verify authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.split('Bearer ')[1]
    const userId = await verifyAuthToken(token)
    
    if (!userId) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 })
    }

    // Get market accounts from Firestore
    const marketAccounts = await getMarketAccounts(userId)
    console.log(`✅ Retrieved ${marketAccounts.length} market accounts for user ${userId}`)
    
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