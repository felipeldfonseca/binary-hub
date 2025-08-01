# API Infrastructure Documentation

*Version 1.0 • July 2025*

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [Data Models](#data-models)
4. [API Endpoints](#api-endpoints)
5. [Error Handling](#error-handling)
6. [Development Guidelines](#development-guidelines)
7. [Testing Strategy](#testing-strategy)
8. [Performance & Scalability](#performance--scalability)

---

## 🎯 Overview

### **Architecture**
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: Firestore (NoSQL)
- **Authentication**: Firebase Auth
- **Storage**: Cloud Storage (CSV uploads)
- **AI Integration**: OpenAI GPT-4

### **Base URL**
```
Production: https://us-central1-binary-hub.cloudfunctions.net/api
Development: http://localhost:5001/binary-hub/us-central1/api
```

### **API Versioning**
- Current version: `v1`
- All endpoints prefixed with `/v1`
- Backward compatibility maintained for 6 months

---

## 🔐 Authentication & Security

### **Authentication Flow**
```typescript
// 1. Client obtains Firebase ID token
const idToken = await auth.currentUser?.getIdToken()

// 2. Include in request headers
headers: {
  'Authorization': `Bearer ${idToken}`,
  'Content-Type': 'application/json'
}
```

### **Middleware**
```typescript
// Authentication middleware
const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.split(' ')[1]
    const decodedToken = await auth.verifyIdToken(token)
    req.user = decodedToken
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
```

### **Security Measures**
- ✅ Rate limiting: 100 requests per 15 minutes per IP
- ✅ CORS enabled for specified origins
- ✅ Helmet.js for security headers
- ✅ Input validation and sanitization
- ✅ User-specific data isolation

---

## 📊 Data Models

### **Trade Model**
```typescript
interface Trade {
  // Core Fields
  id: string                    // Auto-generated unique ID
  userId: string               // Firebase user ID
  tradeId: string              // Exchange trade ID (from CSV)
  
  // Trade Details
  asset: string                // Asset/currency pair (e.g., "EUR/USD")
  direction: 'call' | 'put'    // Trade direction
  amount: number               // Trade amount in USD
  entryPrice: number           // Entry price
  exitPrice: number            // Exit price
  entryTime: Date              // Entry timestamp
  exitTime: Date               // Exit timestamp
  
  // Results
  result: 'win' | 'loss' | 'open'  // Trade result
  profit: number               // Calculated profit/loss
  payout: number               // Payout percentage
  
  // Metadata
  platform: string             // Trading platform (e.g., "Ebinex")
  strategy: string             // Strategy used
  notes?: string               // User notes
  screenshots?: string[]       // Screenshot URLs
  
  // System Fields
  createdAt: Date              // Record creation time
  updatedAt: Date              // Last update time
  importedAt?: Date            // CSV import timestamp
  importBatch?: string         // Import batch ID
}
```

### **User Model**
```typescript
interface User {
  uid: string                  // Firebase user ID
  email: string                // User email
  firstName?: string           // User's first name
  lastName?: string            // User's last name
  plan: 'free' | 'pro'        // Subscription plan
  timezone: string             // User timezone
  language: 'en' | 'pt'       // User language preference
  
  // Settings
  notifications: {
    email: boolean
    push: boolean
    weeklyInsights: boolean
  }
  
  // Usage tracking
  tradeCount: number           // Total trades
  lastTradeAt?: Date           // Last trade timestamp
  createdAt: Date              // Account creation
  updatedAt: Date              // Last update
}
```

### **Analytics Model**
```typescript
interface Analytics {
  userId: string               // User ID
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  startDate: Date
  endDate: Date
  
  // Performance Metrics
  totalTrades: number
  winTrades: number
  lossTrades: number
  winRate: number              // Percentage (0-100)
  totalPnl: number             // Total profit/loss
  avgPnl: number               // Average P&L per trade
  maxDrawdown: number          // Maximum drawdown
  
  // Risk Metrics
  avgStake: number             // Average stake size
  maxStake: number             // Maximum stake
  riskRewardRatio: number      // Risk/reward ratio
  
  // Time-based Metrics
  tradesPerDay: number         // Average trades per day
  bestDay: string              // Best performing day
  worstDay: string             // Worst performing day
  
  // Asset Performance
  assetPerformance: {
    [asset: string]: {
      trades: number
      winRate: number
      totalPnl: number
    }
  }
}
```

### **Rule Model**
```typescript
interface Rule {
  id: string                   // Auto-generated ID
  userId: string               // User ID
  title: string                // Rule title
  description: string          // Rule description
  category: 'risk' | 'strategy' | 'psychology' | 'custom'
  isActive: boolean            // Rule status
  
  // Violation tracking
  violations: number           // Number of violations
  lastViolatedAt?: Date        // Last violation timestamp
  
  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

### **Insight Model**
```typescript
interface Insight {
  id: string                   // Auto-generated ID
  userId: string               // User ID
  type: 'weekly' | 'monthly' | 'on_demand' | 'coaching'
  title: string                // Insight title
  content: string              // AI-generated content
  action?: string              // Recommended action
  
  // Metadata
  metadata: {
    totalTrades: number
    winRate: number
    avgStake: number
    lossStreak: number
    aiGenerated: boolean
    kpi?: any
  }
  
  timestamp: Date              // Generation timestamp
}
```

---

## 🌐 API Endpoints

### **Authentication Endpoints**

#### `GET /v1/auth/profile`
Get current user profile
```typescript
Response: {
  uid: string
  email: string
  firstName?: string
  lastName?: string
  plan: 'free' | 'pro'
  timezone: string
  language: 'en' | 'pt'
}
```

#### `PUT /v1/auth/profile`
Update user profile
```typescript
Request: {
  firstName?: string
  lastName?: string
  timezone?: string
  language?: 'en' | 'pt'
  notifications?: {
    email?: boolean
    push?: boolean
    weeklyInsights?: boolean
  }
}
```

### **Trade Endpoints**

#### `GET /v1/trades`
List user trades with filtering and pagination
```typescript
Query Parameters:
- start?: string (ISO date)
- end?: string (ISO date)
- limit?: number (default: 100, max: 1000)
- offset?: number (default: 0)
- result?: 'win' | 'loss' | 'open'
- asset?: string
- strategy?: string

Response: {
  trades: Trade[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}
```

#### `POST /v1/trades`
Create new trade
```typescript
Request: {
  asset: string
  direction: 'call' | 'put'
  amount: number
  entryPrice: number
  exitPrice: number
  entryTime: string (ISO date)
  exitTime: string (ISO date)
  result: 'win' | 'loss' | 'open'
  strategy?: string
  notes?: string
  platform?: string
}

Response: {
  id: string
  ...Trade
}
```

#### `GET /v1/trades/:id`
Get specific trade details
```typescript
Response: Trade
```

#### `PUT /v1/trades/:id`
Update trade
```typescript
Request: Partial<Trade>
Response: Trade
```

#### `DELETE /v1/trades/:id`
Delete trade
```typescript
Response: { success: boolean }
```

#### `POST /v1/trades/bulk`
Bulk create trades (for CSV import)
```typescript
Request: {
  trades: Trade[]
  importBatch?: string
}

Response: {
  created: number
  errors: Array<{ index: number, error: string }>
}
```

### **Analytics Endpoints**

#### `GET /v1/analytics/dashboard`
Get dashboard statistics
```typescript
Query Parameters:
- period?: 'daily' | 'weekly' | 'monthly' | 'yearly' (default: 'weekly')

Response: {
  period: string
  stats: {
    totalTrades: number
    winTrades: number
    lossTrades: number
    winRate: number
    totalPnl: number
    avgPnl: number
    maxDrawdown: number
  }
  performance: Array<{
    date: string
    trades: number
    pnl: number
  }>
}
```

#### `GET /v1/analytics/performance`
Get detailed performance metrics
```typescript
Query Parameters:
- start?: string (ISO date)
- end?: string (ISO date)
- groupBy?: 'day' | 'week' | 'month'

Response: {
  period: { start: string, end: string }
  metrics: Analytics
  assetBreakdown: Array<{
    asset: string
    trades: number
    winRate: number
    totalPnl: number
  }>
}
```

#### `GET /v1/analytics/export`
Export analytics data
```typescript
Query Parameters:
- format?: 'csv' | 'json' (default: 'csv')
- start?: string (ISO date)
- end?: string (ISO date)

Response: File download
```

### **Rules Endpoints**

#### `GET /v1/rules`
List user rules
```typescript
Response: Rule[]
```

#### `POST /v1/rules`
Create new rule
```typescript
Request: {
  title: string
  description: string
  category: 'risk' | 'strategy' | 'psychology' | 'custom'
  isActive?: boolean (default: true)
}

Response: Rule
```

#### `PUT /v1/rules/:id`
Update rule
```typescript
Request: Partial<Rule>
Response: Rule
```

#### `DELETE /v1/rules/:id`
Delete rule
```typescript
Response: { success: boolean }
```

### **Insights Endpoints**

#### `GET /v1/insights`
List user insights
```typescript
Query Parameters:
- type?: 'weekly' | 'monthly' | 'on_demand' | 'coaching'
- limit?: number (default: 10)

Response: Insight[]
```

#### `POST /v1/insights/generate`
Generate on-demand insight
```typescript
Request: {
  type?: 'analysis' | 'coaching'
  context?: string
}

Response: Insight
```

### **Import Endpoints**

#### `POST /v1/import/validate-csv`
Validate CSV headers and structure
```typescript
Request: {
  headers: string[]
  sampleRows?: string[][]
}

Response: {
  isValid: boolean
  expectedHeaders: string[]
  missingHeaders: string[]
  extraHeaders: string[]
  suggestions: string[]
}
```

#### `POST /v1/import/upload`
Upload CSV file
```typescript
Request: FormData with CSV file

Response: {
  uploadId: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress?: number
}
```

#### `GET /v1/import/status/:uploadId`
Get import status
```typescript
Response: {
  uploadId: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  totalRows?: number
  importedRows?: number
  errors?: Array<{ row: number, error: string }>
  createdAt: string
  completedAt?: string
}
```

---

## ⚠️ Error Handling

### **Error Response Format**
```typescript
{
  error: string              // Human-readable error message
  code: string               // Error code for programmatic handling
  details?: any              // Additional error details
  timestamp: string          // Error timestamp
}
```

### **HTTP Status Codes**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `422` - Unprocessable Entity (business logic errors)
- `429` - Too Many Requests (rate limiting)
- `500` - Internal Server Error

### **Common Error Codes**
```typescript
// Authentication
AUTH_REQUIRED: 'Authentication required'
INVALID_TOKEN: 'Invalid or expired token'
INSUFFICIENT_PERMISSIONS: 'Insufficient permissions'

// Validation
VALIDATION_ERROR: 'Validation failed'
MISSING_REQUIRED_FIELD: 'Missing required field'
INVALID_FORMAT: 'Invalid data format'

// Business Logic
TRADE_NOT_FOUND: 'Trade not found'
RULE_NOT_FOUND: 'Rule not found'
DUPLICATE_TRADE: 'Trade already exists'
INVALID_TRADE_DATA: 'Invalid trade data'

// Import
INVALID_CSV_FORMAT: 'Invalid CSV format'
IMPORT_FAILED: 'Import failed'
FILE_TOO_LARGE: 'File too large'

// Rate Limiting
RATE_LIMIT_EXCEEDED: 'Rate limit exceeded'
```

### **Error Handling Examples**
```typescript
// Validation error
{
  error: 'Validation failed',
  code: 'VALIDATION_ERROR',
  details: {
    field: 'amount',
    message: 'Amount must be greater than 0'
  }
}

// Business logic error
{
  error: 'Trade not found',
  code: 'TRADE_NOT_FOUND',
  details: {
    tradeId: 'abc123'
  }
}
```

---

## 🛠️ Development Guidelines

### **Code Structure**
```typescript
// functions/src/
├── index.ts                  # Main entry point
├── middleware/               # Middleware functions
│   ├── auth.ts              # Authentication middleware
│   ├── validation.ts        # Request validation
│   └── rateLimit.ts         # Rate limiting
├── routes/                  # Route handlers
│   ├── trades.ts            # Trade endpoints
│   ├── analytics.ts         # Analytics endpoints
│   ├── rules.ts             # Rules endpoints
│   └── insights.ts          # Insights endpoints
├── services/                # Business logic
│   ├── tradeService.ts      # Trade operations
│   ├── analyticsService.ts  # Analytics calculations
│   └── aiService.ts         # AI integration
├── utils/                   # Utility functions
│   ├── validation.ts        # Data validation
│   ├── errors.ts            # Error handling
│   └── helpers.ts           # Helper functions
└── types/                   # TypeScript types
    ├── trade.ts             # Trade types
    ├── user.ts              # User types
    └── api.ts               # API types
```

### **Request Validation**
```typescript
// Example validation middleware
const validateTrade = (req: Request, res: Response, next: NextFunction) => {
  const { asset, direction, amount, entryPrice, exitPrice } = req.body
  
  const errors = []
  
  if (!asset) errors.push('Asset is required')
  if (!['call', 'put'].includes(direction)) errors.push('Invalid direction')
  if (amount <= 0) errors.push('Amount must be greater than 0')
  if (entryPrice <= 0) errors.push('Entry price must be greater than 0')
  if (exitPrice <= 0) errors.push('Exit price must be greater than 0')
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: { errors }
    })
  }
  
  next()
}
```

### **Database Operations**
```typescript
// Example trade service
class TradeService {
  async createTrade(userId: string, tradeData: Partial<Trade>): Promise<Trade> {
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const trade: Trade = {
      id: tradeId,
      userId,
      ...tradeData,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await db.collection('trades').doc(userId).collection('trades').doc(tradeId).set(trade)
    
    return trade
  }
  
  async getUserTrades(userId: string, filters: TradeFilters): Promise<Trade[]> {
    let query = db.collection('trades').doc(userId).collection('trades')
    
    if (filters.start) {
      query = query.where('entryTime', '>=', filters.start)
    }
    if (filters.end) {
      query = query.where('entryTime', '<=', filters.end)
    }
    if (filters.result) {
      query = query.where('result', '==', filters.result)
    }
    
    const snapshot = await query.orderBy('entryTime', 'desc').limit(filters.limit || 100).get()
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Trade[]
  }
}
```

### **Error Handling**
```typescript
// Example error handling
const handleError = (error: any, res: Response) => {
  logger.error('API Error:', error)
  
  if (error.code === 'permission-denied') {
    return res.status(403).json({
      error: 'Insufficient permissions',
      code: 'INSUFFICIENT_PERMISSIONS'
    })
  }
  
  if (error.code === 'not-found') {
    return res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND'
    })
  }
  
  return res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  })
}
```

---

## 🧪 Testing Strategy

### **Unit Tests**
```typescript
// Example test structure
describe('TradeService', () => {
  describe('createTrade', () => {
    it('should create a valid trade', async () => {
      const tradeData = {
        asset: 'EUR/USD',
        direction: 'call',
        amount: 100,
        entryPrice: 1.0500,
        exitPrice: 1.0550,
        result: 'win'
      }
      
      const trade = await tradeService.createTrade('user123', tradeData)
      
      expect(trade.id).toBeDefined()
      expect(trade.userId).toBe('user123')
      expect(trade.asset).toBe('EUR/USD')
    })
  })
})
```

### **Integration Tests**
```typescript
// Example integration test
describe('Trade API', () => {
  it('should create and retrieve trade', async () => {
    // Create trade
    const createResponse = await request(app)
      .post('/v1/trades')
      .set('Authorization', `Bearer ${validToken}`)
      .send(validTradeData)
    
    expect(createResponse.status).toBe(201)
    expect(createResponse.body.id).toBeDefined()
    
    // Retrieve trade
    const getResponse = await request(app)
      .get(`/v1/trades/${createResponse.body.id}`)
      .set('Authorization', `Bearer ${validToken}`)
    
    expect(getResponse.status).toBe(200)
    expect(getResponse.body.id).toBe(createResponse.body.id)
  })
})
```

### **Performance Tests**
```typescript
// Example performance test
describe('Analytics Performance', () => {
  it('should calculate analytics within 2 seconds', async () => {
    const startTime = Date.now()
    
    const response = await request(app)
      .get('/v1/analytics/dashboard?period=monthly')
      .set('Authorization', `Bearer ${validToken}`)
    
    const duration = Date.now() - startTime
    
    expect(response.status).toBe(200)
    expect(duration).toBeLessThan(2000)
  })
})
```

---

## ⚡ Performance & Scalability

### **Caching Strategy**
```typescript
// Redis caching for analytics
const cacheAnalytics = async (userId: string, period: string, data: any) => {
  const key = `analytics:${userId}:${period}`
  await redis.setex(key, 3600, JSON.stringify(data)) // 1 hour cache
}

const getCachedAnalytics = async (userId: string, period: string) => {
  const key = `analytics:${userId}:${period}`
  const cached = await redis.get(key)
  return cached ? JSON.parse(cached) : null
}
```

### **Database Optimization**
```typescript
// Composite indexes for common queries
// trades collection: userId + entryTime + result
// analytics collection: userId + period + startDate
// rules collection: userId + isActive + category
```

### **Rate Limiting**
```typescript
// Tiered rate limiting
const rateLimitConfig = {
  // Free users
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // 100 requests per window
  },
  // Pro users
  pro: {
    windowMs: 15 * 60 * 1000,
    max: 500 // 500 requests per window
  }
}
```

### **Monitoring**
```typescript
// Performance monitoring
const monitorPerformance = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  
  res.on('finish', () => {
    const duration = Date.now() - startTime
    logger.info('API Performance', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.uid
    })
  })
  
  next()
}
```

---

## 📋 Implementation Checklist

### **Phase A: Foundation**
- [ ] Set up Firebase Functions project structure
- [ ] Implement authentication middleware
- [ ] Create basic CRUD operations for trades
- [ ] Set up error handling and logging
- [ ] Implement rate limiting
- [ ] Create data validation utilities

### **Phase B: Core Features**
- [ ] Implement trade management endpoints
- [ ] Create analytics calculation service
- [ ] Build rules management system
- [ ] Add insights generation
- [ ] Implement CSV import validation

### **Phase C: Advanced Features**
- [ ] Add bulk operations for CSV import
- [ ] Implement real-time updates
- [ ] Add caching layer
- [ ] Create performance monitoring
- [ ] Add comprehensive testing

---

## 🚀 Next Steps

1. **Review and approve this documentation**
2. **Set up the development environment**
3. **Start with Phase A implementation**
4. **Create unit tests for each component**
5. **Implement monitoring and logging**
6. **Deploy to staging environment**
7. **Perform integration testing**
8. **Deploy to production**

---

*This documentation serves as the foundation for building a robust, scalable API infrastructure for the Binary Hub trading platform.* 