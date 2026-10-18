# Binary Hub - Database Design Document

*Version 1.0 - Social Trading Platform Architecture*

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Collection Schema](#collection-schema)
4. [Indexing Strategy](#indexing-strategy)
5. [Security Rules](#security-rules)
6. [Performance Optimization](#performance-optimization)
7. [Data Migration Strategy](#data-migration-strategy)
8. [Backup & Recovery](#backup--recovery)

---

## Overview

Binary Hub uses Firestore as its primary database, designed to support a social trading platform with real-time features, AI analysis, and scalable performance. The database architecture prioritizes user privacy, social interactions, and efficient AI data processing.

### Key Requirements
- **Social Features**: Follow/follower relationships, posts, feeds, notifications
- **AI Integration**: Daily/weekly reports, individual trade analysis, pattern tracking
- **Real-time Updates**: Live social feeds, notifications, performance metrics
- **Privacy Controls**: Granular visibility settings for all user data
- **Scalability**: Support for 10K+ concurrent users and social interactions

### Database Technology Stack
- **Primary Database**: Firestore (NoSQL document database)
- **Real-time**: Firestore real-time listeners
- **Indexing**: Composite indexes for complex queries
- **Security**: Firestore Security Rules
- **Backup**: Automated daily backups to Cloud Storage

---

## Architecture Principles

### 1. Document-Oriented Design
- Each collection represents a distinct entity type
- Documents contain all related data to minimize reads
- Subcollections for one-to-many relationships

### 2. Denormalization Strategy
- User display names and avatars stored in multiple places
- Social metrics (follower counts, post metrics) calculated and stored
- Feed generation uses denormalized data for performance

### 3. Privacy-First Design
- All user data scoped by UID
- Granular privacy controls stored separately
- Public data clearly separated from private data

### 4. Social-Optimized Structure
- Follow relationships stored bidirectionally for efficient queries
- Feed generation optimized for real-time updates
- Social metrics pre-calculated and cached

---

## Collection Schema

### Core User Collections

#### `users/{uid}`
**Purpose**: Private user account data and preferences
```typescript
{
  // Account Information
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: timestamp;
  lastSignIn: timestamp;
  isActive: boolean;
  
  // Subscription & Billing
  subscription: {
    tier: 'free' | 'pro' | 'collaborative' | 'ai_enhanced';
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    stripeCustomerId?: string;
    subscriptionId?: string;
    currentPeriodStart?: timestamp;
    currentPeriodEnd?: timestamp;
    cancelAtPeriodEnd?: boolean;
  };
  
  // User Preferences
  preferences: {
    language: 'en' | 'pt';
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      follows: boolean;
      likes: boolean;
      comments: boolean;
      aiReports: boolean;
      weeklyDigest: boolean;
    };
    privacy: {
      profileDiscoverable: boolean;
      showOnlineStatus: boolean;
      allowDirectMessages: boolean;
    };
  };
  
  // AI Usage Tracking
  aiUsage: {
    individualAnalysesUsed: number; // current period
    lastAnalysisRequest: timestamp;
    weeklyReportsEnabled: boolean;
    dailyReportsEnabled: boolean;
  };
  
  // Platform Metadata
  metadata: {
    lastUpdated: timestamp;
    version: string; // schema version for migrations
    flags?: string[]; // feature flags
  };
}
```

#### `profiles/{uid}`
**Purpose**: Public trader profile information
```typescript
{
  // Basic Profile Information
  basic: {
    username: string; // unique, indexed
    displayName: string;
    avatar: string; // Firebase Storage URL
    bio: string; // max 280 characters
    location?: string; // country/state level
    website?: string;
    tradingSince: timestamp;
    isVerified: boolean;
    verificationBadges: string[]; // ['email', 'phone', 'identity']
  };
  
  // Social Statistics
  stats: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
    likesReceived: number;
    commentsReceived: number;
    profileViews: number;
    lastActiveAt: timestamp;
  };
  
  // Trading Performance (Privacy-Controlled)
  trading: {
    totalTrades: number;
    winRate?: number; // hidden if privacy setting disabled
    monthlyPnL?: number; // current month, hidden if private
    bestWinStreak?: number;
    currentStreak?: number;
    averageTradeSize?: number;
    riskScore?: number; // 1-10 scale
    tradingStyle?: string[]; // ['scalping', 'swing', 'news']
    favoriteAssets?: string[]; // ['EURUSD', 'BTCUSD']
    lastTradeDate?: timestamp;
  };
  
  // Achievements & Badges
  achievements: {
    badges: {
      id: string;
      name: string;
      description: string;
      iconUrl: string;
      unlockedAt: timestamp;
      isPublic: boolean;
    }[];
    milestones: {
      totalTrades: number[];
      winStreaks: number[];
      monthlyProfits: number[];
      customGoals: string[];
    };
    lastCalculated: timestamp;
  };
  
  // Privacy Controls
  privacy: {
    profileVisibility: 'public' | 'community' | 'followers' | 'private';
    tradingMetricsVisibility: {
      winRate: boolean;
      pnl: boolean;
      streaks: boolean;
      tradeCount: boolean;
      riskScore: boolean;
      tradingStyle: boolean;
    };
    socialSettings: {
      allowFollowers: boolean;
      requireFollowApproval: boolean;
      allowComments: boolean;
      allowMentions: boolean;
      showInSearch: boolean;
      showInLeaderboards: boolean;
    };
  };
  
  // SEO & Discovery
  seo: {
    slug: string; // URL-friendly username
    keywords: string[]; // for search optimization
    lastIndexed: timestamp;
  };
  
  // Metadata
  metadata: {
    createdAt: timestamp;
    lastUpdated: timestamp;
    version: string;
  };
}
```

### Social Interaction Collections

#### `follows/{uid}/following/{targetUid}`
**Purpose**: Users that this user follows
```typescript
{
  // Follow Information
  followedAt: timestamp;
  followType: 'manual' | 'suggested' | 'bulk_import';
  
  // Interaction Settings
  notificationsEnabled: boolean;
  status: 'active' | 'muted' | 'blocked';
  
  // Engagement Tracking
  lastInteraction?: timestamp;
  interactionCount: number;
  
  // Metadata
  source?: string; // how they found this user
  tags?: string[]; // user-defined tags
}
```

#### `follows/{uid}/followers/{followerUid}`
**Purpose**: Users that follow this user
```typescript
{
  // Follow Information
  followedAt: timestamp;
  status: 'active' | 'pending' | 'blocked';
  
  // Notifications
  notificationSent: boolean;
  
  // Metadata
  source?: string;
  mutualFollows?: string[]; // common connections
  lastSeen?: timestamp;
}
```

#### `posts/{uid}/{postId}`
**Purpose**: User-generated content and trade sharing
```typescript
{
  // Content
  content: string; // max 500 characters
  type: 'text' | 'trade_share' | 'achievement' | 'ai_insight' | 'milestone';
  
  // Media & Attachments
  media?: {
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    alt?: string;
  }[];
  
  // Trade Reference (for trade_share posts)
  tradeRef?: {
    tradeId: string;
    asset: string;
    direction: 'call' | 'put';
    result: 'win' | 'loss' | 'pending';
    profit?: number;
    timestamp: timestamp;
  };
  
  // AI Insight Reference (for ai_insight posts)
  aiInsightRef?: {
    reportId: string;
    insightType: 'daily' | 'weekly' | 'individual';
    summary: string;
    confidence: number;
  };
  
  // Social Features
  hashtags?: string[];
  mentions?: string[]; // @username mentions
  visibility: 'public' | 'followers' | 'private';
  
  // Engagement Metrics
  metrics: {
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    viewsCount: number;
    saveCount: number;
  };
  
  // Engagement Data (for quick lookup)
  interactions: {
    likes: string[]; // uid array, max 100 for performance
    saves: string[]; // uid array
    shares: string[]; // uid array
  };
  
  // Moderation
  moderation: {
    status: 'approved' | 'pending' | 'flagged' | 'removed';
    flags?: string[]; // reasons for flagging
    reviewedBy?: string; // moderator uid
    reviewedAt?: timestamp;
    reportCount: number;
  };
  
  // Metadata
  metadata: {
    createdAt: timestamp;
    updatedAt: timestamp;
    isEdited: boolean;
    editHistory?: timestamp[];
    ipAddress?: string; // for moderation
    userAgent?: string; // for analytics
  };
}
```

#### `comments/{postId}/{commentId}`
**Purpose**: Comments on posts
```typescript
{
  // Comment Data
  authorId: string;
  content: string; // max 280 characters
  
  // Threading
  parentCommentId?: string; // for replies
  depth: number; // reply depth (max 3)
  
  // Social Features
  mentions?: string[];
  
  // Engagement
  likesCount: number;
  repliesCount: number;
  likes: string[]; // uid array, max 50
  
  // Moderation
  isReported: boolean;
  reportCount: number;
  moderationStatus: 'approved' | 'pending' | 'removed';
  
  // Metadata
  createdAt: timestamp;
  updatedAt?: timestamp;
  isEdited: boolean;
}
```

### Feed & Discovery Collections

#### `feed/{uid}/{feedItemId}`
**Purpose**: Personalized social feed for each user
```typescript
{
  // Content Reference
  authorId: string;
  authorDisplayName: string; // denormalized for performance
  authorAvatar: string; // denormalized for performance
  
  // Post Information
  postId: string;
  postType: 'text' | 'trade_share' | 'achievement' | 'ai_insight';
  contentPreview: string; // first 100 characters
  
  // Media Preview
  mediaPreview?: {
    type: 'image' | 'video';
    thumbnailUrl: string;
  };
  
  // Engagement Preview
  engagementPreview: {
    likesCount: number;
    commentsCount: number;
    hasLiked: boolean; // for this specific user
    hasSaved: boolean;
  };
  
  // Feed Algorithm
  timestamp: timestamp; // original post timestamp
  score: number; // algorithmic ranking score
  feedType: 'following' | 'trending' | 'recommended';
  
  // User Interaction
  isRead: boolean;
  clickedAt?: timestamp;
  engagedAt?: timestamp; // last like/comment/share
  
  // Metadata
  addedToFeedAt: timestamp;
  ttl: timestamp; // when to remove from feed
}
```

#### `notifications/{uid}/{notificationId}`
**Purpose**: User notifications
```typescript
{
  // Notification Content
  type: 'follow' | 'like' | 'comment' | 'mention' | 'ai_report' | 'achievement';
  title: string;
  message: string;
  
  // Actor Information (who triggered the notification)
  actorId?: string;
  actorDisplayName?: string;
  actorAvatar?: string;
  
  // Reference Data
  referenceType?: 'post' | 'comment' | 'profile' | 'trade' | 'ai_report';
  referenceId?: string;
  
  // Action Data
  actionUrl?: string; // deep link to relevant content
  actionText?: string; // "View Post", "See Report"
  
  // Status
  isRead: boolean;
  readAt?: timestamp;
  
  // Delivery
  channels: {
    push: boolean;
    email: boolean;
    inApp: boolean;
  };
  deliveryStatus: {
    push?: 'sent' | 'delivered' | 'failed';
    email?: 'sent' | 'delivered' | 'failed';
  };
  
  // Metadata
  createdAt: timestamp;
  expiresAt?: timestamp; // auto-delete old notifications
  priority: 'low' | 'normal' | 'high';
}
```

### Trading Data Collections

#### `trades/{uid}/{tradeId}`
**Purpose**: Individual trade records with social integration
```typescript
{
  // Core Trading Data
  basic: {
    asset: string; // 'BTC/USDT', 'EUR/USD'
    direction: 'call' | 'put';
    amount: number;
    entryTime: timestamp;
    entryPrice: number;
    exitTime?: timestamp;
    exitPrice?: number;
    result: 'win' | 'loss' | 'tie' | 'pending';
    profit: number; // can be negative
    roi: number; // return on investment percentage
    platform: string; // 'ebinex', 'manual'
  };
  
  // Strategy & Analysis
  strategy?: {
    name: string; // 'Support/Resistance', 'Trend Following'
    confidence: number; // 1-10 scale
    reasoning?: string; // user's explanation
    indicators?: string[]; // ['RSI', 'MACD', 'Moving Average']
    timeframe: string; // '1m', '5m', '15m', '1h'
  };
  
  // Social Integration
  social: {
    isShared: boolean;
    postRef?: string; // reference to post if shared
    sharedAt?: timestamp;
    visibility: 'private' | 'followers' | 'public';
    context?: string; // explanation for social sharing
    tags?: string[]; // hashtags
    reactions?: {
      [uid: string]: 'like' | 'fire' | 'thinking' | 'sad';
    };
  };
  
  // AI Analysis
  aiAnalysis?: {
    individualAnalysisId?: string; // reference to detailed AI analysis
    quickInsight?: string; // brief AI comment
    confidence?: number; // AI confidence in the trade
    suggestedImprovements?: string[];
    riskAssessment?: 'low' | 'medium' | 'high';
    emotionalState?: 'confident' | 'fearful' | 'greedy' | 'disciplined';
  };
  
  // Performance Tracking
  performance: {
    isPartOfStreak: boolean;
    streakPosition?: number; // position in current streak
    contributesToGoals: string[]; // which goals this trade helps
    timeOfDay: string; // '09:30', for pattern analysis
    marketSession: 'asian' | 'european' | 'american' | 'overlap';
    volatility: 'low' | 'medium' | 'high';
  };
  
  // Metadata
  metadata: {
    createdAt: timestamp;
    updatedAt: timestamp;
    source: 'manual' | 'csv_import' | 'api_sync';
    importBatch?: string; // for CSV imports
    version: string; // schema version
    notes?: string; // private user notes
  };
}
```

### AI Analysis Collections

#### `ai_reports/{uid}/{reportId}`
**Purpose**: AI-generated daily/weekly analysis reports
```typescript
{
  // Report Information
  type: 'daily' | 'weekly' | 'monthly';
  period: {
    startDate: timestamp;
    endDate: timestamp;
    timezone: string;
  };
  
  // AI Model Information
  aiModel: {
    provider: 'openai' | 'google'; // GPT-4o vs Gemini 2.5 Flash Light
    model: string; // specific model version
    promptVersion: string;
    processingTime: number; // milliseconds
    tokenUsage?: number;
    cost?: number; // tracking for optimization
  };
  
  // Analysis Content
  analysis: {
    executiveSummary: string;
    keyFindings: string[];
    performanceAnalysis: {
      winRateAnalysis: string;
      profitabilityInsights: string;
      consistencyScore: number; // 0-100
      improvementAreas: string[];
    };
    patternAnalysis: {
      identifiedPatterns: {
        name: string;
        description: string;
        occurrences: number;
        successRate: number;
        examples: string[]; // tradeId references
      }[];
      emotionalPatterns: string;
      timingPatterns: string;
      assetPerformance: Record<string, number>;
    };
    riskAssessment: {
      currentRiskLevel: 'low' | 'medium' | 'high';
      riskTrends: string;
      positionSizingAnalysis: string;
      suggestedAdjustments: string[];
    };
    recommendations: {
      priority: 'high' | 'medium' | 'low';
      category: 'strategy' | 'risk' | 'timing' | 'emotional';
      title: string;
      description: string;
      actionItems: string[];
      expectedImpact: string;
    }[];
  };
  
  // Performance Metrics
  metrics: {
    totalTrades: number;
    winRate: number;
    profitLoss: number;
    averageTradeSize: number;
    largestWin: number;
    largestLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    averageHoldTime?: number; // for longer timeframe trades
    riskRewardRatio: number;
  };
  
  // Time-based Analysis
  timeAnalysis: {
    bestPerformingHours: string[];
    worstPerformingHours: string[];
    bestPerformingDays: string[];
    performanceBySession: {
      asian: number;
      european: number;
      american: number;
      overlap: number;
    };
  };
  
  // Social Integration
  socialSharing: {
    isShared: boolean;
    sharedAt?: timestamp;
    postRef?: string;
    visibility: 'public' | 'followers' | 'private';
    selectedInsights?: string[]; // which insights were shared
  };
  
  // User Feedback
  feedback: {
    rating?: 1 | 2 | 3 | 4 | 5; // user rating of report quality
    liked?: boolean; // thumbs up/down
    feedbackText?: string;
    helpfulInsights?: string[]; // which insights were marked helpful
    submittedAt?: timestamp;
  };
  
  // Metadata
  metadata: {
    generatedAt: timestamp;
    status: 'processing' | 'completed' | 'failed' | 'expired';
    priority: 'normal' | 'high'; // for processing queue
    retryCount?: number;
    errorMessage?: string;
    dataQuality: {
      sufficientTrades: boolean;
      dataCompletenessScore: number; // 0-100
      analysisReliability: number; // 0-100
    };
  };
}
```

#### `ai_insights/{uid}/{insightId}`
**Purpose**: Individual AI insights and recommendations
```typescript
{
  // Insight Information
  type: 'pattern' | 'recommendation' | 'warning' | 'achievement' | 'educational';
  category: 'strategy' | 'risk_management' | 'emotional' | 'timing' | 'market_analysis';
  
  // Content
  title: string;
  description: string;
  actionItems: string[];
  keyTakeaways: string[];
  
  // AI Analysis
  aiAnalysis: {
    confidence: number; // 0-100
    evidenceStrength: 'weak' | 'moderate' | 'strong';
    dataPoints: string[]; // supporting evidence
    relatedTrades: string[]; // tradeId references
    similarPatterns?: string[]; // references to similar insights
  };
  
  // Priority & Urgency
  priority: 'low' | 'medium' | 'high' | 'critical';
  urgency: 'can_wait' | 'this_week' | 'immediate';
  impact: 'low' | 'medium' | 'high'; // expected impact on performance
  
  // User Interaction
  userResponse: {
    isRead: boolean;
    readAt?: timestamp;
    isDismissed: boolean;
    dismissedAt?: timestamp;
    isActedUpon?: boolean;
    actionTakenAt?: timestamp;
    userNotes?: string;
  };
  
  // Social Features
  socialSharing: {
    isShareable: boolean; // some insights may be too personal
    isShared: boolean;
    sharedAt?: timestamp;
    postRef?: string;
    anonymizedVersion?: string; // version safe for sharing
  };
  
  // Feedback & Learning
  feedback: {
    wasHelpful?: boolean;
    accuracyRating?: 1 | 2 | 3 | 4 | 5;
    feedbackText?: string;
    followUpNeeded?: boolean;
  };
  
  // Metadata
  metadata: {
    createdAt: timestamp;
    expiresAt?: timestamp; // for time-sensitive insights
    sourceReportId?: string; // if from daily/weekly report
    aiModel: string;
    processingCost?: number;
    relatedInsights?: string[]; // insight IDs
  };
}
```

#### `ai_patterns/{uid}`
**Purpose**: Long-term AI pattern tracking for each user
```typescript
{
  // Identified Patterns
  patterns: {
    [patternId: string]: {
      name: string;
      description: string;
      type: 'profitable' | 'losing' | 'neutral';
      
      // Pattern Statistics
      firstIdentified: timestamp;
      lastSeen: timestamp;
      occurrences: number;
      successRate: number;
      averageProfit: number;
      confidence: number; // how certain AI is about this pattern
      
      // Pattern Details
      conditions: string[]; // what triggers this pattern
      outcomes: string[]; // typical results
      examples: string[]; // tradeId references
      
      // Trend Analysis
      trend: 'improving' | 'stable' | 'declining';
      trendData: {
        timestamp: timestamp;
        successRate: number;
        occurrences: number;
      }[]; // historical trend data
    };
  };
  
  // Risk Profiles
  riskProfile: {
    currentLevel: 'conservative' | 'moderate' | 'aggressive' | 'reckless';
    riskTolerance: number; // 0-100 scale
    typicalPositionSize: number;
    maxPositionSize: number;
    
    // Risk Patterns
    riskPatterns: {
      oversizing: boolean; // tends to risk too much
      undersizing: boolean; // tends to risk too little
      emotionalSizing: boolean; // position size varies with emotions
      consistentSizing: boolean; // maintains consistent risk
    };
    
    // Risk Trends
    riskTrends: {
      direction: 'improving' | 'stable' | 'deteriorating';
      recentChanges: string[];
      suggestedAdjustments: string[];
    };
  };
  
  // Performance Metrics Tracking
  performanceMetrics: {
    consistencyScore: number; // 0-100, how consistent performance is
    improvementTrend: 'improving' | 'stable' | 'declining';
    volatilityScore: number; // how volatile the results are
    
    // Strength Areas
    strengthAreas: {
      timing: number; // 0-100
      assetSelection: number;
      riskManagement: number;
      emotionalControl: number;
      strategyExecution: number;
    };
    
    // Weakness Areas  
    weaknessAreas: {
      area: string;
      severity: 'minor' | 'moderate' | 'major';
      improvementSuggestions: string[];
      targetMetrics: string[];
    }[];
  };
  
  // Learning Progression
  learningProgression: {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    experiencePoints: number;
    masteryCounts: {
      [skill: string]: number; // how many times they've demonstrated skill
    };
    
    // Learning Goals
    currentGoals: {
      goal: string;
      progress: number; // 0-100
      targetDate?: timestamp;
      milestones: string[];
    }[];
    
    // Completed Achievements
    completedAchievements: {
      name: string;
      description: string;
      completedAt: timestamp;
      difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
    }[];
  };
  
  // Metadata
  metadata: {
    lastAnalysis: timestamp;
    nextScheduledAnalysis: timestamp;
    dataQuality: number; // 0-100, based on trade data completeness
    analysisReliability: number; // how reliable the patterns are
    totalDataPoints: number; // number of trades analyzed
    version: string; // pattern analysis version
  };
}
```

### Platform Management Collections

#### `admin/users/{uid}`
**Purpose**: Administrative user management
```typescript
{
  // Account Status
  accountStatus: 'active' | 'suspended' | 'banned' | 'deleted';
  suspensionReason?: string;
  suspensionExpiry?: timestamp;
  
  // Moderation History
  moderationHistory: {
    action: 'warning' | 'suspension' | 'ban' | 'content_removal';
    reason: string;
    moderatorId: string;
    timestamp: timestamp;
    duration?: number; // in hours
  }[];
  
  // Platform Metrics
  platformMetrics: {
    totalLogins: number;
    lastLoginAt: timestamp;
    totalSessionTime: number; // in minutes
    averageSessionTime: number;
    featureUsage: {
      [feature: string]: number; // usage counts
    };
  };
  
  // Support History
  supportTickets: {
    ticketId: string;
    status: 'open' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high';
    createdAt: timestamp;
    resolvedAt?: timestamp;
  }[];
  
  // Risk Indicators
  riskIndicators: {
    multipleAccounts: boolean;
    suspiciousActivity: boolean;
    reportedByUsers: number;
    contentViolations: number;
    lastRiskAssessment: timestamp;
  };
}
```

#### `system/counters`
**Purpose**: Global platform counters and statistics
```typescript
{
  // User Statistics
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
  };
  
  // Social Statistics
  socialStats: {
    totalPosts: number;
    postsToday: number;
    totalFollowConnections: number;
    totalLikes: number;
    totalComments: number;
  };
  
  // Trading Statistics
  tradingStats: {
    totalTrades: number;
    tradesToday: number;
    tradesThisWeek: number;
    activeTraders: number;
  };
  
  // AI Statistics
  aiStats: {
    totalReportsGenerated: number;
    reportsToday: number;
    individualAnalysesTotal: number;
    individualAnalysesToday: number;
    totalAICost: number;
    averageCostPerAnalysis: number;
  };
  
  // Performance Metrics
  performance: {
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
    lastUpdated: timestamp;
  };
}
```

---

## Indexing Strategy

### Required Composite Indexes

#### Social Features Indexes
```javascript
// For efficient profile discovery
profiles: [
  ['basic.username', 'asc'], // unique username lookup
  ['stats.followersCount', 'desc'], // trending users
  ['trading.winRate', 'desc', 'privacy.tradingMetricsVisibility.winRate', '==', true], // leaderboards
  ['basic.tradingSince', 'asc'], // veteran traders
  ['metadata.lastUpdated', 'desc'], // recently active
]

// For follow relationships
follows/{uid}/following: [
  ['followedAt', 'desc'], // recent follows
  ['status', '==', 'active', 'followedAt', 'desc'], // active follows only
  ['lastInteraction', 'desc'], // engagement-based sorting
]

follows/{uid}/followers: [
  ['followedAt', 'desc'], // recent followers
  ['status', '==', 'active', 'followedAt', 'desc'], // active followers only
]

// For social feed generation
posts: [
  ['metadata.createdAt', 'desc'], // chronological posts
  ['visibility', '==', 'public', 'metadata.createdAt', 'desc'], // public posts
  ['type', '==', 'trade_share', 'metadata.createdAt', 'desc'], // trade posts
  ['moderation.status', '==', 'approved', 'metadata.createdAt', 'desc'], // approved content
]

// For notifications
notifications/{uid}: [
  ['createdAt', 'desc'], // recent notifications
  ['isRead', '==', false, 'createdAt', 'desc'], // unread notifications
  ['type', '==', 'follow', 'createdAt', 'desc'], // notification types
]
```

#### Trading & AI Indexes
```javascript
// For trading analysis
trades/{uid}: [
  ['basic.entryTime', 'desc'], // recent trades
  ['basic.result', '==', 'win', 'basic.entryTime', 'desc'], // winning trades
  ['basic.asset', '==', 'BTCUSD', 'basic.entryTime', 'desc'], // asset-specific
  ['strategy.name', '==', 'Support/Resistance', 'basic.entryTime', 'desc'], // strategy analysis
]

// For AI reports
ai_reports/{uid}: [
  ['period.startDate', 'desc'], // recent reports
  ['type', '==', 'daily', 'period.startDate', 'desc'], // report types
  ['metadata.status', '==', 'completed', 'period.startDate', 'desc'], // completed reports
]

// For AI insights
ai_insights/{uid}: [
  ['metadata.createdAt', 'desc'], // recent insights
  ['priority', '==', 'high', 'metadata.createdAt', 'desc'], // high priority
  ['userResponse.isRead', '==', false, 'metadata.createdAt', 'desc'], // unread insights
]
```

#### Search & Discovery Indexes
```javascript
// For user search
profiles: [
  ['basic.displayName', 'asc'], // name search (requires additional text search)
  ['basic.location', '==', 'Brazil', 'stats.followersCount', 'desc'], // location-based
  ['trading.tradingStyle', 'array-contains', 'scalping', 'trading.winRate', 'desc'], // style-based
]
```

### Security Rules

#### User Data Protection
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only access their own private data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Profiles are readable by authenticated users, writable by owner
    match /profiles/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Follow relationships
    match /follows/{userId}/following/{targetId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /follows/{userId}/followers/{followerId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null; // anyone can follow
      allow update, delete: if request.auth != null && 
        (request.auth.uid == userId || request.auth.uid == followerId);
    }
    
    // Posts visibility based on privacy settings
    match /posts/{userId}/{postId} {
      allow read: if request.auth != null && 
        (resource.data.visibility == 'public' || 
         resource.data.visibility == 'followers' && isFollower(userId) ||
         request.auth.uid == userId);
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Comments readable by all authenticated users
    match /comments/{postId}/{commentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.auth.uid == resource.data.authorId;
    }
    
    // Feed items only accessible by owner
    match /feed/{userId}/{feedItemId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // only server can write to feed
    }
    
    // Notifications only accessible by owner
    match /notifications/{userId}/{notificationId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Trading data only accessible by owner
    match /trades/{userId}/{tradeId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // AI reports only accessible by owner
    match /ai_reports/{userId}/{reportId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // AI insights only accessible by owner
    match /ai_insights/{userId}/{insightId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // AI patterns only accessible by owner
    match /ai_patterns/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Admin collections only accessible by admins
    match /admin/{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.admin == true;
    }
    
    // System collections read-only for authenticated users
    match /system/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // only server can write
    }
    
    // Helper functions
    function isFollower(userId) {
      return exists(/databases/$(database)/documents/follows/$(userId)/followers/$(request.auth.uid));
    }
  }
}
```

---

## Performance Optimization

### 1. Denormalization Strategy

#### User Profile Data
- Store display names and avatars in posts for faster feed rendering
- Cache follower/following counts in profile documents
- Pre-calculate social metrics (likes received, comments received)

#### Feed Generation
- Generate feeds asynchronously using Cloud Functions
- Store feed items with all necessary display data
- Implement TTL for feed items to prevent infinite growth

#### Social Metrics
- Update counters using distributed counters pattern
- Cache expensive aggregations (trending users, popular posts)
- Use batch writes for related updates

### 2. Query Optimization

#### Feed Queries
```typescript
// Efficient feed query with pagination
const feedQuery = db.collection(`feed/${userId}`)
  .orderBy('timestamp', 'desc')
  .limit(20)
  .startAfter(lastDocSnapshot);
```

#### Social Relationship Queries
```typescript
// Get following list with user data
const followingQuery = db.collection(`follows/${userId}/following`)
  .orderBy('followedAt', 'desc')
  .limit(50);

// Then fetch profile data in batches
const profileBatch = db.getAll(...profileRefs);
```

### 3. Caching Strategy

#### Application-Level Caching
- Cache user profiles for 5 minutes
- Cache social metrics for 1 minute
- Cache AI reports for 1 hour
- Cache trending content for 15 minutes

#### CDN Caching
- Cache profile avatars and media for 24 hours
- Cache static content (achievement badges) for 7 days

### 4. Real-time Optimization

#### Efficient Listeners
```typescript
// Optimized notification listener
const notificationListener = db.collection(`notifications/${userId}`)
  .where('isRead', '==', false)
  .orderBy('createdAt', 'desc')
  .limit(10)
  .onSnapshot(callback);
```

#### Batched Updates
```typescript
// Batch social metric updates
const batch = db.batch();
batch.update(postRef, { 'metrics.likesCount': FieldValue.increment(1) });
batch.update(userRef, { 'stats.likesReceived': FieldValue.increment(1) });
await batch.commit();
```

---

## Data Migration Strategy

### Schema Versioning
- Include version field in all document schemas
- Implement migration functions for schema changes
- Support backward compatibility for at least 2 versions

### Migration Process
1. **Backup**: Create full database backup before migration
2. **Gradual Migration**: Migrate documents in batches
3. **Validation**: Verify migration success with sample queries
4. **Monitoring**: Monitor performance during and after migration

### Example Migration Function
```typescript
async function migrateUserProfiles() {
  const batch = db.batch();
  const profiles = await db.collection('profiles').get();
  
  profiles.docs.forEach(doc => {
    const data = doc.data();
    if (data.version !== '2.0') {
      const updatedData = {
        ...data,
        // Add new fields
        'achievements.badges': data.badges || [],
        'privacy.socialSettings.showInLeaderboards': true,
        version: '2.0'
      };
      batch.update(doc.ref, updatedData);
    }
  });
  
  await batch.commit();
}
```

---

## Backup & Recovery

### Automated Backup Strategy
- **Daily backups** to Cloud Storage
- **Incremental backups** every 6 hours for critical collections
- **Retention policy**: Keep daily backups for 30 days, weekly for 1 year

### Critical Collections Priority
1. **users** - User account data
2. **profiles** - Public profile information
3. **trades** - Trading data
4. **follows** - Social relationships
5. **posts** - User-generated content

### Recovery Procedures
1. **Point-in-time recovery** for accidental deletions
2. **Full database restore** for catastrophic failures
3. **Selective collection restore** for targeted issues

### Disaster Recovery Plan
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Geographic redundancy**: Multi-region backup storage
- **Testing**: Monthly disaster recovery drills

---

## Monitoring & Alerting

### Database Performance Metrics
- **Read/Write operations per second**
- **Query performance and slow queries**
- **Index usage and efficiency**
- **Storage usage and growth trends**

### Alert Thresholds
- **Error rate** > 1%
- **Response time** > 500ms (95th percentile)
- **Storage usage** > 80% of quota
- **Daily active users** decline > 20%

### Cost Monitoring
- **Daily spend tracking** per collection
- **Read/write operation costs**
- **Storage and network egress costs**
- **AI processing costs** (separate tracking)

---

*This database design provides a robust foundation for Binary Hub's social trading platform, ensuring scalability, performance, and security while supporting all planned features including social interactions, AI analysis, and real-time collaboration.*