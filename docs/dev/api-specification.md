# Binary Hub – API Design Specification

*Version 1.0 • Social Trading Platform • January 2025*

---

## Overview

This document specifies the complete REST API design for Binary Hub's social trading platform, including authentication, social features, trading functionality, AI analysis, and business operations.

## Table of Contents

1. [API Architecture](#1-api-architecture)
2. [Authentication & Authorization](#2-authentication--authorization)  
3. [Social Platform APIs](#3-social-platform-apis)
4. [Trading Core APIs](#4-trading-core-apis)
5. [AI Analysis APIs](#5-ai-analysis-apis)
6. [Business & Platform APIs](#6-business--platform-apis)
7. [Real-time WebSocket Events](#7-real-time-websocket-events)
8. [Error Handling](#8-error-handling)
9. [Rate Limiting](#9-rate-limiting)
10. [API Testing Strategy](#10-api-testing-strategy)

---

## 1. API Architecture

### 1.1 Base Configuration

```yaml
# API Base Configuration
Base URL: https://api.binaryhub.app/v1
Authentication: Bearer Token (Firebase ID Token)
Content-Type: application/json
Rate Limiting: Tier-based (see section 9)
Versioning: URL path versioning (/v1/, /v2/)
```

### 1.2 Common Response Structure

```typescript
// Success Response
interface APIResponse<T> {
  success: true;
  data: T;
  metadata?: {
    pagination?: PaginationInfo;
    timing?: number;
    version?: string;
  };
}

// Error Response  
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
  };
}

// Pagination Info
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}
```

### 1.3 HTTP Status Codes

| Status | Usage | Description |
|--------|--------|-------------|
| 200 | Success | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## 2. Authentication & Authorization

### 2.1 Authentication Endpoints

```typescript
// Register New User
POST /auth/register
Body: {
  email: string;
  password: string;
  displayName: string;
  acceptTerms: boolean;
}
Response: {
  success: true;
  data: {
    user: UserProfile;
    idToken: string;
    refreshToken: string;
  };
}

// Login User
POST /auth/login  
Body: {
  email: string;
  password: string;
}
Response: {
  success: true;
  data: {
    user: UserProfile;
    idToken: string;
    refreshToken: string;
  };
}

// Social Login (Google, Apple)
POST /auth/social
Body: {
  provider: 'google' | 'apple';
  idToken: string;
}
Response: {
  success: true;
  data: {
    user: UserProfile;
    idToken: string;
    refreshToken: string;
    isNewUser: boolean;
  };
}

// Refresh Token
POST /auth/refresh
Body: {
  refreshToken: string;
}
Response: {
  success: true;
  data: {
    idToken: string;
    refreshToken: string;
  };
}

// Logout
POST /auth/logout
Headers: Authorization: Bearer {idToken}
Response: {
  success: true;
  data: { message: "Logged out successfully" };
}
```

### 2.2 Authorization Middleware

```typescript
// Permission Levels
enum Permission {
  READ_PUBLIC = 'read:public',
  READ_PROFILE = 'read:profile', 
  WRITE_PROFILE = 'write:profile',
  READ_TRADES = 'read:trades',
  WRITE_TRADES = 'write:trades',
  READ_SOCIAL = 'read:social',
  WRITE_SOCIAL = 'write:social',
  ACCESS_AI = 'access:ai',
  ADMIN = 'admin'
}

// Subscription-based permissions
interface TierPermissions {
  free: Permission[];
  pro: Permission[];
  collaborative: Permission[];
  ai_enhanced: Permission[];
}
```

---

## 3. Social Platform APIs

### 3.1 Profile Management

```typescript
// Get Public Profile
GET /profiles/{username}
Query: {
  include?: 'stats' | 'achievements' | 'recent_trades';
}
Response: {
  success: true;
  data: PublicProfile;
}

// Get Own Profile
GET /profiles/me
Response: {
  success: true;
  data: PrivateProfile;
}

// Update Profile
PUT /profiles/me
Body: {
  displayName?: string;
  bio?: string;
  avatar?: string;
  location?: string;
  privacy?: PrivacySettings;
}
Response: {
  success: true;
  data: PrivateProfile;
}

// Upload Avatar
POST /profiles/me/avatar
Body: FormData {
  avatar: File; // Max 5MB, jpg/png only
}
Response: {
  success: true;
  data: {
    avatarUrl: string;
    thumbnailUrl: string;
  };
}

// Search Profiles
GET /profiles/search
Query: {
  q: string; // search term
  filters?: {
    winRate?: 'high' | 'medium' | 'low';
    tradingSince?: string; // ISO date
    location?: string;
  };
  page?: number;
  limit?: number; // max 50
}
Response: {
  success: true;
  data: PublicProfile[];
  metadata: { pagination: PaginationInfo };
}

// Get Profile Suggestions
GET /profiles/suggestions
Query: {
  type?: 'new_traders' | 'experienced' | 'similar_performance';
  limit?: number; // max 20
}
Response: {
  success: true;
  data: ProfileSuggestion[];
}
```

### 3.2 Social Relationships

```typescript
// Follow User
POST /social/follow/{userId}
Body: {
  notificationsEnabled?: boolean; // default: true
}
Response: {
  success: true;
  data: {
    following: true;
    followedAt: string;
    mutualFollow: boolean;
  };
}

// Unfollow User
DELETE /social/follow/{userId}
Response: {
  success: true;
  data: { following: false };
}

// Get Followers
GET /social/followers/{userId}
Query: {
  page?: number;
  limit?: number; // max 100
}
Response: {
  success: true;
  data: FollowRelationship[];
  metadata: { pagination: PaginationInfo };
}

// Get Following
GET /social/following/{userId}
Query: {
  page?: number;
  limit?: number; // max 100
}
Response: {
  success: true;
  data: FollowRelationship[];
  metadata: { pagination: PaginationInfo };
}

// Block User
POST /social/block/{userId}
Body: {
  reason?: string;
}
Response: {
  success: true;
  data: { blocked: true };
}

// Unblock User
DELETE /social/block/{userId}
Response: {
  success: true;
  data: { blocked: false };
}

// Get Blocked Users
GET /social/blocked
Response: {
  success: true;
  data: BlockedUser[];
}
```

### 3.3 Social Content & Feed

```typescript
// Create Post
POST /posts
Body: {
  type: 'trade' | 'insight' | 'achievement' | 'general';
  content: string; // max 500 chars
  hashtags?: string[]; // max 5
  attachments?: string[]; // image URLs
  tradeRef?: string; // trade ID if type is 'trade'
  visibility: 'public' | 'followers' | 'private';
}
Response: {
  success: true;
  data: Post;
}

// Get Post
GET /posts/{postId}
Response: {
  success: true;
  data: Post;
}

// Update Post
PUT /posts/{postId}
Body: {
  content?: string;
  hashtags?: string[];
  visibility?: 'public' | 'followers' | 'private';
}
Response: {
  success: true;
  data: Post;
}

// Delete Post
DELETE /posts/{postId}
Response: {
  success: true;
  data: { deleted: true };
}

// Get Feed
GET /feed
Query: {
  type?: 'following' | 'trending' | 'discover';
  page?: number;
  limit?: number; // max 50
  since?: string; // ISO timestamp for real-time updates
}
Response: {
  success: true;
  data: FeedItem[];
  metadata: { 
    pagination: PaginationInfo;
    lastUpdate: string;
  };
}

// Like Post
POST /posts/{postId}/like
Response: {
  success: true;
  data: {
    liked: true;
    likesCount: number;
  };
}

// Unlike Post
DELETE /posts/{postId}/like
Response: {
  success: true;
  data: {
    liked: false;
    likesCount: number;
  };
}

// Get Post Comments
GET /posts/{postId}/comments
Query: {
  page?: number;
  limit?: number; // max 100
}
Response: {
  success: true;
  data: Comment[];
  metadata: { pagination: PaginationInfo };
}

// Add Comment
POST /posts/{postId}/comments
Body: {
  content: string; // max 280 chars
  parentId?: string; // for replies
}
Response: {
  success: true;
  data: Comment;
}

// Update Comment
PUT /comments/{commentId}
Body: {
  content: string;
}
Response: {
  success: true;
  data: Comment;
}

// Delete Comment
DELETE /comments/{commentId}
Response: {
  success: true;
  data: { deleted: true };
}
```

### 3.4 Achievements & Notifications

```typescript
// Get User Achievements
GET /achievements/{userId}
Response: {
  success: true;
  data: Achievement[];
}

// Get Notifications
GET /notifications
Query: {
  type?: 'follow' | 'like' | 'comment' | 'achievement' | 'ai';
  unread?: boolean;
  page?: number;
  limit?: number; // max 50
}
Response: {
  success: true;
  data: Notification[];
  metadata: { 
    pagination: PaginationInfo;
    unreadCount: number;
  };
}

// Mark Notification as Read
PUT /notifications/{notificationId}/read
Response: {
  success: true;
  data: { read: true };
}

// Mark All Notifications as Read
PUT /notifications/read-all
Response: {
  success: true;
  data: { readCount: number };
}

// Update Notification Settings
PUT /notifications/settings
Body: {
  email: {
    follows: boolean;
    likes: boolean;
    comments: boolean;
    achievements: boolean;
    aiReports: boolean;
  };
  push: {
    follows: boolean;
    likes: boolean;
    comments: boolean;
    achievements: boolean;
    aiReports: boolean;
  };
}
Response: {
  success: true;
  data: NotificationSettings;
}
```

---

## 4. Trading Core APIs

### 4.1 Trade Management

```typescript
// Create Trade
POST /trades
Body: {
  asset: string; // e.g., "EUR/USD"
  direction: 'call' | 'put';
  amount: number;
  strikePrice: number;
  expirationTime: string; // ISO datetime
  result?: 'win' | 'loss'; // if completed
  payout?: number; // if win
  entryTime: string; // ISO datetime
  strategy?: string;
  notes?: string;
  tags?: string[];
  social?: {
    share: boolean;
    visibility: 'public' | 'followers' | 'private';
    commentary?: string;
  };
}
Response: {
  success: true;
  data: Trade;
}

// Get Trades
GET /trades
Query: {
  startDate?: string; // ISO date
  endDate?: string; // ISO date
  asset?: string;
  result?: 'win' | 'loss';
  strategy?: string;
  page?: number;
  limit?: number; // max 100
  sort?: 'newest' | 'oldest' | 'amount' | 'payout';
}
Response: {
  success: true;
  data: Trade[];
  metadata: { 
    pagination: PaginationInfo;
    summary: TradeSummary;
  };
}

// Get Trade by ID
GET /trades/{tradeId}
Response: {
  success: true;
  data: Trade;
}

// Update Trade
PUT /trades/{tradeId}
Body: {
  result?: 'win' | 'loss';
  payout?: number;
  notes?: string;
  tags?: string[];
  strategy?: string;
}
Response: {
  success: true;
  data: Trade;
}

// Delete Trade
DELETE /trades/{tradeId}
Response: {
  success: true;
  data: { deleted: true };
}

// Share Trade
POST /trades/{tradeId}/share
Body: {
  visibility: 'public' | 'followers' | 'private';
  commentary?: string;
  hashtags?: string[];
}
Response: {
  success: true;
  data: {
    postId: string;
    sharedAt: string;
  };
}

// CSV Import
POST /trades/import
Body: FormData {
  file: File; // CSV file, max 10MB
  source: 'ebinex' | 'manual';
  mergeStrategy: 'skip_duplicates' | 'update_existing';
}
Response: {
  success: true;
  data: {
    importId: string;
    status: 'processing';
    estimatedTime: number; // seconds
  };
}

// Get Import Status
GET /trades/import/{importId}
Response: {
  success: true;
  data: {
    status: 'processing' | 'completed' | 'failed';
    progress?: number; // 0-100
    results?: {
      imported: number;
      updated: number;
      skipped: number;
      errors: string[];
    };
  };
}
```

### 4.2 Trading Analytics

```typescript
// Get Dashboard Stats
GET /dashboard/stats
Query: {
  period?: 'today' | 'week' | 'month' | 'year' | 'all';
  startDate?: string; // ISO date
  endDate?: string; // ISO date
}
Response: {
  success: true;
  data: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    currentStreak: number;
    bestStreak: number;
    worstStreak: number;
    profitableDays: number;
    tradingDays: number;
    averageTradeSize: number;
    largestWin: number;
    largestLoss: number;
    riskRewardRatio: number;
  };
}

// Get Performance Chart Data
GET /dashboard/performance
Query: {
  period: 'week' | 'month' | 'quarter' | 'year';
  metric: 'pnl' | 'winrate' | 'trades_count' | 'streak';
}
Response: {
  success: true;
  data: {
    labels: string[]; // dates
    values: number[];
    summary: {
      trend: 'up' | 'down' | 'stable';
      changePercent: number;
      period: string;
    };
  };
}

// Get Trading Calendar
GET /dashboard/calendar
Query: {
  year: number;
  month: number;
}
Response: {
  success: true;
  data: {
    days: CalendarDay[];
    summary: {
      tradingDays: number;
      profitableDays: number;
      totalPnL: number;
    };
  };
}

// Get Asset Performance
GET /analytics/assets
Query: {
  period?: 'week' | 'month' | 'quarter' | 'year';
  minTrades?: number; // minimum trades for inclusion
}
Response: {
  success: true;
  data: AssetPerformance[];
}

// Get Strategy Analysis
GET /analytics/strategies
Query: {
  period?: 'week' | 'month' | 'quarter' | 'year';
}
Response: {
  success: true;
  data: StrategyAnalysis[];
}

// Get Time Analysis
GET /analytics/time
Query: {
  period?: 'week' | 'month' | 'quarter' | 'year';
  groupBy: 'hour' | 'day' | 'week';
}
Response: {
  success: true;
  data: TimeAnalysis[];
}
```

### 4.3 Trading Rules

```typescript
// Get Rules
GET /rules
Response: {
  success: true;
  data: Rule[];
}

// Create Rule
POST /rules
Body: {
  title: string;
  description: string;
  category: 'risk_management' | 'strategy' | 'emotional' | 'time_management';
  priority: 'high' | 'medium' | 'low';
  isActive: boolean;
  social?: {
    isShared: boolean;
    visibility: 'public' | 'followers';
  };
}
Response: {
  success: true;
  data: Rule;
}

// Update Rule
PUT /rules/{ruleId}
Body: {
  title?: string;
  description?: string;
  category?: string;
  priority?: string;
  isActive?: boolean;
}
Response: {
  success: true;
  data: Rule;
}

// Delete Rule
DELETE /rules/{ruleId}
Response: {
  success: true;
  data: { deleted: true };
}

// Check Rule Adherence
POST /rules/check
Body: {
  tradeId: string;
  ruleIds?: string[]; // if not provided, checks all active rules
}
Response: {
  success: true;
  data: {
    violations: RuleViolation[];
    adherenceScore: number; // 0-100
  };
}
```

---

## 5. AI Analysis APIs

### 5.1 Individual Trade Analysis

```typescript
// Analyze Single Trade
POST /ai/analyze-trade
Body: {
  tradeId: string;
  analysisType: 'full' | 'quick' | 'pattern_only';
  forceRegenerate?: boolean;
}
Response: {
  success: true;
  data: {
    analysisId: string;
    status: 'processing' | 'completed';
    estimatedTime?: number; // seconds if processing
    analysis?: TradeAnalysis; // if completed
  };
}

// Get Trade Analysis
GET /ai/trade-analysis/{analysisId}
Response: {
  success: true;
  data: TradeAnalysis;
}

// Rate Trade Analysis
POST /ai/trade-analysis/{analysisId}/feedback
Body: {
  rating: 1 | 2 | 3 | 4 | 5; // 1=poor, 5=excellent
  feedback?: string;
  categories?: {
    accuracy: number;
    usefulness: number;
    clarity: number;
  };
}
Response: {
  success: true;
  data: { feedbackRecorded: true };
}
```

### 5.2 Daily & Weekly Reports

```typescript
// Generate Daily Report
POST /ai/reports/daily
Body: {
  date: string; // ISO date, defaults to yesterday
  forceRegenerate?: boolean;
}
Response: {
  success: true;
  data: {
    reportId: string;
    status: 'processing' | 'completed';
    estimatedTime?: number;
  };
}

// Generate Weekly Report  
POST /ai/reports/weekly
Body: {
  weekStart: string; // ISO date (Monday)
  forceRegenerate?: boolean;
}
Response: {
  success: true;
  data: {
    reportId: string;
    status: 'processing' | 'completed';
    estimatedTime?: number;
  };
}

// Get AI Report
GET /ai/reports/{reportId}
Response: {
  success: true;
  data: AIReport;
}

// Get All Reports
GET /ai/reports
Query: {
  type?: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number; // max 50
}
Response: {
  success: true;
  data: AIReport[];
  metadata: { pagination: PaginationInfo };
}

// Share AI Report
POST /ai/reports/{reportId}/share
Body: {
  visibility: 'public' | 'followers' | 'private';
  commentary?: string;
  shareSections?: string[]; // which sections to share
}
Response: {
  success: true;
  data: {
    postId: string;
    sharedAt: string;
  };
}
```

### 5.3 Pattern Recognition & Insights

```typescript
// Get AI Patterns
GET /ai/patterns
Query: {
  category?: 'time' | 'asset' | 'emotional' | 'strategy';
  minConfidence?: number; // 0-100
}
Response: {
  success: true;
  data: {
    patterns: AIPattern[];
    summary: {
      totalPatterns: number;
      highConfidencePatterns: number;
      lastAnalysis: string;
    };
  };
}

// Get AI Insights
GET /ai/insights
Query: {
  type?: 'recommendation' | 'warning' | 'achievement' | 'pattern';
  priority?: 'high' | 'medium' | 'low';
  unread?: boolean;
  page?: number;
  limit?: number; // max 50
}
Response: {
  success: true;
  data: AIInsight[];
  metadata: { 
    pagination: PaginationInfo;
    unreadCount: number;
  };
}

// Mark Insight as Read
PUT /ai/insights/{insightId}/read
Response: {
  success: true;
  data: { read: true };
}

// Dismiss Insight
DELETE /ai/insights/{insightId}
Response: {
  success: true;
  data: { dismissed: true };
}

// Get AI Recommendations
GET /ai/recommendations
Query: {
  category?: 'risk_management' | 'strategy' | 'emotional' | 'timing';
  active?: boolean;
}
Response: {
  success: true;
  data: AIRecommendation[];
}

// Apply AI Recommendation
POST /ai/recommendations/{recommendationId}/apply
Body: {
  customNotes?: string;
}
Response: {
  success: true;
  data: {
    applied: true;
    appliedAt: string;
    ruleCreated?: boolean;
  };
}
```

### 5.4 AI Usage & Limits

```typescript
// Get AI Usage Stats
GET /ai/usage
Query: {
  period?: 'current_month' | 'last_month' | 'current_billing_cycle';
}
Response: {
  success: true;
  data: {
    tradeAnalyses: {
      used: number;
      limit: number;
      resetDate: string;
    };
    dailyReports: {
      used: number;
      limit: number;
      resetDate: string;
    };
    weeklyReports: {
      used: number;
      limit: number;
      resetDate: string;
    };
    subscriptionTier: string;
  };
}

// Get AI Feature Availability
GET /ai/features
Response: {
  success: true;
  data: {
    tradeAnalysis: {
      available: boolean;
      remaining?: number;
      resetDate?: string;
    };
    dailyReports: {
      available: boolean;
      remaining?: number;
      resetDate?: string;
    };
    weeklyReports: {
      available: boolean;
      remaining?: number;
      resetDate?: string;
    };
    patternRecognition: boolean;
    insights: boolean;
    recommendations: boolean;
  };
}
```

---

## 6. Business & Platform APIs

### 6.1 Subscription Management

```typescript
// Get Subscription Info
GET /billing/subscription
Response: {
  success: true;
  data: {
    currentTier: 'free' | 'pro' | 'collaborative' | 'ai_enhanced';
    status: 'active' | 'past_due' | 'canceled' | 'trial';
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialEnd?: string;
    features: string[];
  };
}

// Create Checkout Session
POST /billing/checkout
Body: {
  tier: 'pro' | 'collaborative' | 'ai_enhanced';
  billingCycle: 'monthly' | 'annually';
  successUrl: string;
  cancelUrl: string;
}
Response: {
  success: true;
  data: {
    sessionId: string;
    checkoutUrl: string;
  };
}

// Create Customer Portal Session
POST /billing/portal
Body: {
  returnUrl: string;
}
Response: {
  success: true;
  data: {
    portalUrl: string;
  };
}

// Cancel Subscription
POST /billing/cancel
Body: {
  reason?: string;
  feedback?: string;
}
Response: {
  success: true;
  data: {
    canceledAt: string;
    accessUntil: string;
  };
}

// Resume Subscription
POST /billing/resume
Response: {
  success: true;
  data: {
    resumedAt: string;
    status: 'active';
  };
}

// Get Billing History
GET /billing/history
Query: {
  page?: number;
  limit?: number; // max 50
}
Response: {
  success: true;
  data: BillingTransaction[];
  metadata: { pagination: PaginationInfo };
}
```

### 6.2 Platform Management

```typescript
// Get Platform Settings
GET /settings
Response: {
  success: true;
  data: UserSettings;
}

// Update Settings
PUT /settings
Body: {
  timezone?: string;
  language?: 'en' | 'pt';
  currency?: 'USD' | 'BRL' | 'EUR';
  notifications?: NotificationSettings;
  privacy?: PrivacySettings;
  trading?: TradingSettings;
}
Response: {
  success: true;
  data: UserSettings;
}

// Export User Data
POST /data/export
Body: {
  format: 'json' | 'csv';
  includeDeleted?: boolean;
  sections?: string[]; // trades, posts, profile, etc.
}
Response: {
  success: true;
  data: {
    exportId: string;
    status: 'processing';
    estimatedTime: number;
  };
}

// Get Export Status
GET /data/export/{exportId}
Response: {
  success: true;
  data: {
    status: 'processing' | 'completed' | 'failed';
    downloadUrl?: string;
    expiresAt?: string;
  };
}

// Delete Account
DELETE /account
Body: {
  confirmation: string; // must be "DELETE"
  reason?: string;
  feedback?: string;
}
Response: {
  success: true;
  data: {
    deletedAt: string;
    dataRetentionDays: number;
  };
}
```

### 6.3 Content Moderation

```typescript
// Report Content
POST /moderation/report
Body: {
  type: 'post' | 'comment' | 'user' | 'trade';
  targetId: string;
  reason: 'spam' | 'inappropriate' | 'harassment' | 'fake' | 'other';
  description?: string;
}
Response: {
  success: true;
  data: {
    reportId: string;
    submittedAt: string;
  };
}

// Get Community Guidelines
GET /moderation/guidelines
Response: {
  success: true;
  data: {
    guidelines: CommunityGuideline[];
    lastUpdated: string;
  };
}
```

---

## 7. Real-time WebSocket Events

### 7.1 WebSocket Connection

```typescript
// Connection URL
wss://api.binaryhub.app/v1/ws

// Authentication
{
  type: 'auth',
  payload: {
    idToken: string;
  }
}

// Subscription Management
{
  type: 'subscribe',
  payload: {
    channels: string[]; // 'feed', 'notifications', 'trade_updates'
  }
}
```

### 7.2 Event Types

```typescript
// New Post in Feed
{
  type: 'feed_update',
  payload: {
    action: 'new_post' | 'post_updated' | 'post_deleted',
    post: Post,
    timestamp: string
  }
}

// New Notification
{
  type: 'notification',
  payload: {
    notification: Notification,
    unreadCount: number
  }
}

// Trade Update
{
  type: 'trade_update',
  payload: {
    action: 'created' | 'updated' | 'shared',
    trade: Trade,
    timestamp: string
  }
}

// AI Analysis Complete
{
  type: 'ai_analysis_complete',
  payload: {
    analysisId: string,
    type: 'trade' | 'daily_report' | 'weekly_report',
    status: 'completed' | 'failed'
  }
}

// Social Interaction
{
  type: 'social_interaction',
  payload: {
    action: 'followed' | 'unfollowed' | 'liked' | 'commented',
    actor: PublicProfile,
    target: string, // user ID or post ID
    timestamp: string
  }
}

// System Message
{
  type: 'system_message',
  payload: {
    level: 'info' | 'warning' | 'error',
    message: string,
    actionRequired?: boolean
  }
}
```

---

## 8. Error Handling

### 8.1 Error Codes

```typescript
// Authentication Errors
AUTH_001: "Invalid credentials"
AUTH_002: "Token expired"
AUTH_003: "Account suspended"
AUTH_004: "Email not verified"

// Validation Errors  
VAL_001: "Missing required field"
VAL_002: "Invalid field format"
VAL_003: "Value out of range"
VAL_004: "File too large"

// Permission Errors
PERM_001: "Insufficient permissions"
PERM_002: "Resource not accessible"
PERM_003: "Feature not available in current tier"

// Business Logic Errors
BIZ_001: "Trade already exists"
BIZ_002: "Cannot follow yourself"
BIZ_003: "AI analysis limit reached"
BIZ_004: "Invalid subscription state"

// System Errors
SYS_001: "Database unavailable"
SYS_002: "External service error"
SYS_003: "Rate limit exceeded"
```

### 8.2 Error Response Examples

```typescript
// Validation Error
{
  success: false,
  error: {
    code: "VAL_002",
    message: "Validation failed",
    details: {
      field: "email",
      value: "invalid-email",
      expected: "Valid email address"
    },
    timestamp: "2025-01-15T10:30:00Z"
  }
}

// Rate Limit Error
{
  success: false,
  error: {
    code: "SYS_003",
    message: "Rate limit exceeded",
    details: {
      limit: 100,
      remaining: 0,
      resetTime: "2025-01-15T11:00:00Z"
    },
    timestamp: "2025-01-15T10:30:00Z"
  }
}
```

---

## 9. Rate Limiting

### 9.1 Rate Limits by Endpoint Category

```typescript
// Rate Limits (requests per minute)
interface RateLimits {
  // Authentication
  auth: {
    login: 5;
    register: 3;
    refresh: 20;
  };
  
  // Social Features
  social: {
    posts_create: 10;
    likes: 60;
    follows: 30;
    comments: 20;
  };
  
  // Trading
  trading: {
    trades_create: 30;
    trades_read: 100;
    csv_import: 2;
  };
  
  // AI Features  
  ai: {
    analyze_trade: 10; // Free: 5, Pro: 10, AI: 20
    generate_report: 3; // Free: 1, Pro: 3, AI: 5
    patterns: 20;
  };
  
  // General API
  general: {
    read: 300;
    write: 100;
  };
}
```

### 9.2 Rate Limit Headers

```typescript
// Response Headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1642265400
X-RateLimit-Category: "social"
```

---

## 10. API Testing Strategy

### 10.1 Test Categories

```typescript
// Unit Tests
- Input validation
- Authentication middleware
- Business logic functions
- Error handling

// Integration Tests  
- Database operations
- External service calls
- WebSocket connections
- File uploads

// End-to-End Tests
- Complete user flows
- Cross-feature interactions
- Real-time functionality
- Payment processing
```

### 10.2 Mock Data & Test Utilities

```typescript
// Test User Profiles
const testUsers = {
  freeUser: { tier: 'free', trades: 45 },
  proUser: { tier: 'pro', trades: 250 },
  aiUser: { tier: 'ai_enhanced', trades: 500 }
};

// Mock AI Responses
const mockAIAnalysis = {
  confidence: 0.85,
  patterns: ['timeOfDay', 'assetPerformance'],
  recommendations: ['reducePositionSize', 'avoidLateTrades']
};

// Rate Limit Testing
const rateLimitTests = {
  burst: 'Test rapid consecutive requests',
  sustained: 'Test continuous load over time',
  recovery: 'Test behavior after limits reset'
};
```

---

## Implementation Notes

### Security Considerations
- All endpoints require authentication except public profile views
- Sensitive data (phone, email) only accessible to profile owner
- Rate limiting prevents abuse and ensures fair usage
- Input validation prevents injection attacks
- CORS configured for frontend domains only

### Performance Optimization
- Database queries optimized with proper indexing
- Pagination required for large result sets
- Caching implemented for frequently accessed data
- WebSocket connections managed efficiently
- AI analysis queued for background processing

### Monitoring & Analytics
- API response times tracked per endpoint
- Error rates monitored and alerted
- Rate limit violations logged
- User behavior analytics collected
- AI model performance metrics tracked

---

*This API specification serves as the complete technical contract between frontend and backend systems for Binary Hub's social trading platform. All endpoints follow RESTful principles and support the social, trading, and AI features outlined in the project requirements.*

**Version:** 1.0  
**Date:** January 2025  
**Next Review:** February 2025