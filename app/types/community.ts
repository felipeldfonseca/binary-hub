// Community Trade Sharing Types

export interface SharedTrade {
  id: string
  userId: string
  tradeId: string              // Reference to original trade
  
  // Post Content
  title: string                // "Great EURUSD scalp today!"
  description?: string         // Strategy explanation
  tags: string[]              // ["scalping", "forex", "breakout"]
  
  // Trade Snapshot (for display)
  asset: string
  direction: 'call' | 'put'
  amount: number
  result: 'win' | 'loss' | 'tie'
  profit: number
  entryTime: Date
  exitTime: Date
  entryPrice?: number
  exitPrice?: number
  
  // Community Features
  likes: number
  comments: Comment[]
  shares: number
  views: number
  
  // Privacy & Moderation
  isPublic: boolean
  isVerified: boolean         // Trade authenticity
  moderationStatus: 'approved' | 'pending' | 'flagged'
  
  // User Info (for display)
  userDisplayName: string
  userAvatar?: string
  userTier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'
  
  createdAt: Date
  updatedAt: Date
}

export interface TradeComment {
  id: string
  userId: string
  userDisplayName: string
  userAvatar?: string
  content: string
  replies: TradeComment[]
  likes: number
  parentId?: string           // For nested replies
  createdAt: Date
  updatedAt: Date
}

export interface CommunityFeed {
  posts: SharedTrade[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  filters: {
    timeframe: '1h' | '24h' | '7d' | '30d'
    asset?: string
    result?: 'win' | 'loss'
    strategy?: string
    tags?: string[]
    sortBy: 'recent' | 'popular' | 'trending' | 'mostLiked'
  }
}

export interface TradeShareData {
  tradeId: string
  title: string
  description?: string
  tags: string[]
  privacy: 'public' | 'followers' | 'private'
  shareToFeed: boolean
  notifyFollowers: boolean
}

export interface TradeReaction {
  id: string
  userId: string
  type: 'like' | 'love' | 'fire' | 'clap' | 'thinking'
  createdAt: Date
}

export interface CommunityUser {
  id: string
  displayName: string
  avatar?: string
  bio?: string
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond'
  followers: number
  following: number
  totalTrades: number
  winRate: number
  totalPnl: number
  badges: string[]
  isFollowing?: boolean
  isVerified: boolean
  joinedAt: Date
}

export interface TradingStrategy {
  id: string
  name: string
  description: string
  category: 'scalping' | 'swing' | 'day_trading' | 'position' | 'arbitrage' | 'news_trading' | 'technical' | 'fundamental'
  tags: string[]
  popularity: number
  usedByCount: number
}

export interface CommunityChallenge {
  id: string
  title: string
  description: string
  goal: {
    type: 'trades_count' | 'win_rate' | 'profit_target' | 'streak'
    target: number
    timeframe: 'daily' | 'weekly' | 'monthly'
  }
  participants: number
  reward: {
    type: 'xp' | 'badge' | 'title' | 'premium_days'
    value: string
  }
  startDate: Date
  endDate: Date
  isActive: boolean
  hasJoined: boolean
}

export interface CommunityStats {
  totalMembers: number
  activeToday: number
  totalTrades: number
  totalProfit: number
  avgWinRate: number
  topPerformers: CommunityUser[]
  trendingStrategies: TradingStrategy[]
  activeChallenges: CommunityChallenge[]
}

// API Response Types
export interface CommunityFeedResponse {
  success: boolean
  data: CommunityFeed
  message?: string
}

export interface SharedTradeResponse {
  success: boolean
  data: SharedTrade
  message?: string
}

export interface CommunityUsersResponse {
  success: boolean
  data: {
    users: CommunityUser[]
    pagination: {
      page: number
      limit: number
      total: number
      hasMore: boolean
    }
  }
  message?: string
}

export interface TradingStrategiesResponse {
  success: boolean
  data: TradingStrategy[]
  message?: string
}

// Hooks data types
export interface UseCommunityFeedOptions {
  filters?: Partial<CommunityFeed['filters']>
  enabled?: boolean
  refetchInterval?: number
}

export interface UseSharedTradeOptions {
  tradeId: string
  enabled?: boolean
}

export interface UseCommunityStatsOptions {
  timeframe?: '24h' | '7d' | '30d'
  enabled?: boolean
}