// Binary Hub - Firestore Data Model Types
// Based on data_model.md

export interface User {
  uid: string
  email: string
  plan: 'free' | 'pro'
  tz: string
  createdAt: string
  lastLogin?: string
  mentorCode?: string
  displayName?: string
  photoURL?: string
  termsAcceptedAt?: string
}

export interface Trade {
  tradeId: string
  timestamp: string
  asset: string
  timeframe: string
  candleTime: string
  direction: 'BUY' | 'SELL'
  stake: number
  executedValue: number
  openPrice?: number
  closePrice?: number
  result: 'WIN' | 'LOSS'
  pnl?: number
  refund?: number
  status?: 'OK' | 'ERROR'
  emotion?: string
  tag?: string
  source: 'manual' | 'csv'
  uploadId?: string
  createdAt?: string
  updatedAt?: string
}

export interface TradeInput {
  asset: string
  timeframe: string
  candleTime: string
  direction: 'BUY' | 'SELL'
  stake: number
  executedValue: number
  openPrice?: number
  closePrice?: number
  result: 'WIN' | 'LOSS'
  emotion?: string
  tag?: string
  timestamp?: string
}

export interface Rule {
  ruleId: string
  text: string
  active: boolean
  brokenCount?: number
  createdAt: string
  updatedAt?: string
}

export interface RuleInput {
  text: string
  active?: boolean
}

export interface Insight {
  insightId: string
  createdAt: string
  text: string
  kpiReference?: string[]
  modelVersion?: string
  userId?: string
}

export interface Upload {
  uploadId: string
  fileName: string
  mimeType: string
  size: number
  fileUrl: string
  createdAt: string
  processed: boolean
  error?: string
  totalRows?: number
  importedRows?: number
  skippedRows?: number
  errorLines?: string[]
}

export interface AuditLog {
  auditId: string
  action: 'deduplicate' | 'deleteTrade' | 'importCSV' | 'createRule' | 'updateRule' | 'deleteRule'
  relatedId?: string
  details?: {
    before?: any
    after?: any
    reason?: string
    metadata?: any
  }
  createdAt: string
  userId?: string
}

export interface Subscription {
  plan: 'free' | 'pro'
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
  renewAt?: string
  cancelAt?: string
  stripeId?: string
  stripeCustomerId?: string
  stripePriceId?: string
  createdAt?: string
  updatedAt?: string
}

// KPI and Dashboard Types
export interface KPI {
  winRate: number
  streakMax: number
  streakCurrent: number
  totalTrades: number
  totalWins: number
  totalLosses: number
  totalStake: number
  totalPnl: number
  avgPnl: number
  avgStake: number
  bestDay?: string
  worstDay?: string
  profitableDays: number
  unprofitableDays: number
  period: 'daily' | 'weekly' | 'monthly' | 'all'
  calculatedAt: string
}

export interface DailyStats {
  date: string
  trades: number
  wins: number
  losses: number
  winRate: number
  totalStake: number
  totalPnl: number
  avgPnl: number
  bestTrade?: number
  worstTrade?: number
  emotions?: { [key: string]: number }
  assets?: { [key: string]: number }
}

export interface CalendarHeatMapData {
  date: string
  value: number
  trades: number
  winRate: number
  status: 'win' | 'loss' | 'neutral'
}

// API Response Types
export interface ImportSummary {
  uploadId: string
  totalRows: number
  imported: number
  skipped: number
  errors: string[]
  duplicates: number
  createdAt: string
  status: 'processing' | 'completed' | 'failed'
}

export interface ExportJob {
  jobId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  downloadUrl?: string
  expiresAt?: string
  createdAt: string
}

// Error Types
export interface FirestoreError {
  code: string
  message: string
  details?: any
}

// Query Types
export interface TradeQuery {
  uid: string
  startDate?: string
  endDate?: string
  asset?: string
  result?: 'WIN' | 'LOSS'
  limit?: number
  orderBy?: 'timestamp' | 'createdAt'
  orderDirection?: 'asc' | 'desc'
}

export interface RuleQuery {
  uid: string
  active?: boolean
  limit?: number
}

export interface InsightQuery {
  uid: string
  limit?: number
  since?: string
}

// Utility Types
export type FirestoreTimestamp = {
  seconds: number
  nanoseconds: number
}

export type DocumentReference = {
  id: string
  path: string
}

export type QuerySnapshot<T> = {
  docs: T[]
  empty: boolean
  size: number
}

export type DocumentSnapshot<T> = {
  id: string
  data: T | undefined
  exists: boolean
}

// Collection Names (for type safety)
export const COLLECTIONS = {
  USERS: 'users',
  TRADES: 'trades',
  RULES: 'rules',
  INSIGHTS: 'insights',
  UPLOADS: 'uploads',
  AUDIT: 'audit',
  SUBSCRIPTIONS: 'subscriptions',
} as const

export type CollectionName = typeof COLLECTIONS[keyof typeof COLLECTIONS]

// Firestore Path Helpers
export const getTradesPath = (uid: string) => `${COLLECTIONS.TRADES}/${uid}`
export const getTradePath = (uid: string, tradeId: string) => `${COLLECTIONS.TRADES}/${uid}/${tradeId}`
export const getRulesPath = (uid: string) => `${COLLECTIONS.RULES}/${uid}`
export const getRulePath = (uid: string, ruleId: string) => `${COLLECTIONS.RULES}/${uid}/${ruleId}`
export const getInsightsPath = (uid: string) => `${COLLECTIONS.INSIGHTS}/${uid}`
export const getUploadsPath = (uid: string) => `${COLLECTIONS.UPLOADS}/${uid}`
export const getAuditPath = (uid: string) => `${COLLECTIONS.AUDIT}/${uid}`
export const getUserPath = (uid: string) => `${COLLECTIONS.USERS}/${uid}`
export const getSubscriptionPath = (uid: string) => `${COLLECTIONS.SUBSCRIPTIONS}/${uid}` 