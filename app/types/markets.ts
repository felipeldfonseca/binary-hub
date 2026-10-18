// Market Types and Interfaces for Multi-Market Account System

export type MarketType = 'binary' | 'forex' | 'crypto' | 'futures' | 'options'

export type CurrencyType = 'USD' | 'EUR' | 'BRL' | 'GBP' | 'JPY' | 'USDT' | 'BTC' | 'ETH'

export interface MarketConfig {
  id: MarketType
  name: string
  namePortuguese: string
  icon: string
  color: string
  description: string
  descriptionPortuguese: string
  defaultCurrency: CurrencyType
  supportedCurrencies: CurrencyType[]
  category: 'traditional' | 'crypto' | 'derivatives'
  complexity: 'beginner' | 'intermediate' | 'advanced'
  minStartingBalance?: number
}

export const MARKET_CONFIGS: Record<MarketType, MarketConfig> = {
  forex: {
    id: 'forex',
    name: 'Forex',
    namePortuguese: 'Forex',
    icon: '💱',
    color: 'blue',
    description: 'Foreign exchange trading with major and minor currency pairs',
    descriptionPortuguese: 'Negociação de moedas estrangeiras com pares principais e secundários',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'JPY', 'BRL'],
    category: 'traditional',
    complexity: 'intermediate',
    minStartingBalance: 500
  },
  crypto: {
    id: 'crypto',
    name: 'Cryptocurrency',
    namePortuguese: 'Criptomoedas',
    icon: '₿',
    color: 'purple',
    description: '24/7 digital asset trading with high volatility opportunities',
    descriptionPortuguese: 'Negociação 24/7 de ativos digitais com oportunidades de alta volatilidade',
    defaultCurrency: 'USDT',
    supportedCurrencies: ['USDT', 'BTC', 'ETH', 'USD'],
    category: 'crypto',
    complexity: 'intermediate',
    minStartingBalance: 100
  },
  futures: {
    id: 'futures',
    name: 'Futures',
    namePortuguese: 'Futuros',
    icon: '📈',
    color: 'green',
    description: 'Professional futures contracts with leverage and margin requirements',
    descriptionPortuguese: 'Contratos futuros profissionais com alavancagem e requisitos de margem',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'EUR'],
    category: 'derivatives',
    complexity: 'advanced',
    minStartingBalance: 2000
  },
  options: {
    id: 'options',
    name: 'Options',
    namePortuguese: 'Opções',
    icon: '🎯',
    color: 'yellow',
    description: 'Sophisticated options strategies with Greeks and implied volatility',
    descriptionPortuguese: 'Estratégias sofisticadas de opções com Greeks e volatilidade implícita',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD'],
    category: 'derivatives',
    complexity: 'advanced',
    minStartingBalance: 1000
  },
  binary: {
    id: 'binary',
    name: 'Binary Options',
    namePortuguese: 'Opções Binárias',
    icon: '📊',
    color: 'orange',
    description: 'Fixed-return trading with honest analysis and transition guidance',
    descriptionPortuguese: 'Negociação de retorno fixo com análise honesta e orientação de transição',
    defaultCurrency: 'USD',
    supportedCurrencies: ['USD', 'BRL', 'EUR'],
    category: 'derivatives',
    complexity: 'beginner',
    minStartingBalance: 50
  }
}

export interface BrokerConnection {
  id: string
  platform: 'MT4' | 'MT5' | 'Binance' | 'Coinbase' | 'InteractiveBrokers' | 'IQOption' | 'Deriv' | 'TradingView' | 'Manual'
  displayName: string
  marketType: MarketType
  isActive: boolean
  autoSyncEnabled: boolean
  lastSync?: Date
  apiCredentials?: {
    encrypted: string
    keyId: string
  }
  status: 'connected' | 'disconnected' | 'error' | 'syncing'
  createdAt: Date
  updatedAt: Date
}

export interface MarketPerformance {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  profitLoss: number
  profitLossPercentage: number
  bestTrade: number
  worstTrade: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  maxDrawdown: number
  currentDrawdown: number
  totalVolume: number
  averageTradeSize: number
  tradingDays: number
  averageTradesPerDay: number
  lastUpdated: Date
}

export interface MarketBankroll {
  initial: number
  current: number
  currency: CurrencyType
  deposits: number
  withdrawals: number
  realizedPnL: number
  unrealizedPnL?: number
  availableBalance?: number
  marginUsed?: number
  freeMargin?: number
  lastUpdated: Date
}

export interface MarketSettings {
  displayName: string
  defaultLotSize?: number
  maxRiskPerTrade?: number
  stopLossStrategy?: 'fixed' | 'percentage' | 'atr'
  takeProfitStrategy?: 'fixed' | 'percentage' | 'rr_ratio'
  notifications: {
    tradeAlerts: boolean
    performanceReports: boolean
    aiInsights: boolean
    socialUpdates: boolean
  }
  privacy: {
    sharePerformance: boolean
    shareTradeHistory: boolean
    allowFollowers: boolean
  }
  preferences: {
    timezone: string
    chartType: 'candlestick' | 'line' | 'bar'
    defaultTimeframe: string
  }
}

export interface MarketAccount {
  id: string
  userId: string
  marketType: MarketType
  displayName: string
  bankroll: MarketBankroll
  performance: MarketPerformance
  settings: MarketSettings
  brokerConnections: BrokerConnection[]
  isActive: boolean
  isPrimary: boolean
  createdAt: Date
  updatedAt: Date
  metadata?: {
    experienceLevel: 'beginner' | 'intermediate' | 'advanced'
    tradingStyle: string[]
    goals: string[]
    notes?: string
  }
}

export interface MarketSelectionData {
  marketType: MarketType
  displayName: string
  initialBankroll: number
  currency: CurrencyType
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  isPrimary: boolean
}

// Helper functions
export const getMarketConfig = (marketType: MarketType): MarketConfig => {
  return MARKET_CONFIGS[marketType]
}

export const getMarketName = (marketType: MarketType, isPortuguese: boolean = false): string => {
  const config = getMarketConfig(marketType)
  return isPortuguese ? config.namePortuguese : config.name
}

export const getMarketDescription = (marketType: MarketType, isPortuguese: boolean = false): string => {
  const config = getMarketConfig(marketType)
  return isPortuguese ? config.descriptionPortuguese : config.description
}

export const getMarketsByComplexity = (complexity: 'beginner' | 'intermediate' | 'advanced'): MarketType[] => {
  return Object.values(MARKET_CONFIGS)
    .filter(config => config.complexity === complexity)
    .map(config => config.id)
}

export const getMarketColorClass = (marketType: MarketType): string => {
  const colorMap = {
    forex: 'bg-blue-500',
    crypto: 'bg-purple-500', 
    futures: 'bg-green-500',
    options: 'bg-yellow-500',
    binary: 'bg-orange-500'
  }
  return colorMap[marketType] || 'bg-gray-500'
}

export const getMarketBorderClass = (marketType: MarketType): string => {
  const colorMap = {
    forex: 'border-blue-500',
    crypto: 'border-purple-500', 
    futures: 'border-green-500',
    options: 'border-yellow-500',
    binary: 'border-orange-500'
  }
  return colorMap[marketType] || 'border-gray-500'
}

export const getMarketTextClass = (marketType: MarketType): string => {
  const colorMap = {
    forex: 'text-blue-500',
    crypto: 'text-purple-500', 
    futures: 'text-green-500',
    options: 'text-yellow-500',
    binary: 'text-orange-500'
  }
  return colorMap[marketType] || 'text-gray-500'
}

export const formatCurrency = (amount: number, currency: CurrencyType): string => {
  const formatMap: Record<CurrencyType, Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    EUR: new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }),
    BRL: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
    JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
    USDT: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    BTC: new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 }),
    ETH: new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
  }
  
  const formatter = formatMap[currency]
  if (currency === 'USDT') {
    return `${formatter.format(amount)} USDT`
  } else if (currency === 'BTC') {
    return `₿${formatter.format(amount)}`
  } else if (currency === 'ETH') {
    return `Ξ${formatter.format(amount)}`
  }
  
  return formatter.format(amount)
}