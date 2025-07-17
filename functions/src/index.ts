import { onRequest } from 'firebase-functions/v2/https';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { generateInsight, generateTradeCoach, checkTradeRules, validateCSVHeaders } from './services/openai';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();
const auth = getAuth();
const storage = getStorage();

// Create Express app
const app = express();

// Configure middleware
app.use(helmet());
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
}));

// Add health check endpoints for Cloud Run
app.get('/_ah/warmup', (_, res) => {
  res.status(200).send('OK');
});

app.get('/_health', (_, res) => {
  res.status(200).send('OK');
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Configure additional middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// Authentication middleware
const authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // For development, accept mock tokens
    if (token === 'mock-token-for-testing') {
      req.user = { uid: 'test-user-123', email: 'test@example.com' };
      return next();
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.post('/auth/exchange-token', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    return res.json({
      token: req.headers.authorization?.split(' ')[1],
      uid: req.user.uid,
      email: req.user.email,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() // 1 hour
    });
  } catch (error) {
    logger.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/auth/profile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    return res.json({
      uid: req.user.uid,
      email: req.user.email
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Trades routes
app.get('/trades', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const { start, end, limit = 100 } = req.query;

    let query = db.collection('trades').doc(uid).collection('trades')
      .orderBy('timestamp', 'desc');

    if (start) {
      query = query.where('timestamp', '>=', start);
    }
    if (end) {
      query = query.where('timestamp', '<=', end);
    }

    query = query.limit(Math.min(Number(limit), 1000));

    const snapshot = await query.get();
    const trades = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(trades);
  } catch (error) {
    logger.error('Get trades error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/trades', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const tradeData = req.body;

    // Validate required fields
    const requiredFields = ['asset', 'type', 'amount'];
    const missingFields = requiredFields.filter(field => !tradeData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }

    // Generate trade ID
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const trade = {
      tradeId,
      asset: tradeData.asset,
      type: tradeData.type,
      amount: tradeData.amount,
      entry_price: tradeData.entry_price,
      exit_price: tradeData.exit_price,
      result: tradeData.result || 'OPEN',
      platform: tradeData.platform || 'Manual',
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('trades').doc(uid).collection('trades').doc(tradeId).set(trade);

    return res.status(201).json({ id: tradeId, ...trade });
  } catch (error) {
    logger.error('Create trade error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard routes
app.get('/dashboard/stats', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const { period = 'weekly' } = req.query;

    // Get trades for the period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    const snapshot = await db.collection('trades').doc(uid).collection('trades')
      .where('timestamp', '>=', startDate.toISOString())
      .orderBy('timestamp', 'desc')
      .get();

    const trades = snapshot.docs.map(doc => doc.data());

    // Calculate KPIs
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const totalPnl = trades.reduce((sum, t) => sum + ((t.result === 'WIN' ? t.amount : -t.amount) || 0), 0);

    return res.json({
      totalTrades,
      wins,
      losses,
      winRate: Math.round(winRate * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
      period
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/dashboard/performance', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    
    // Get all trades for performance calculation
    const snapshot = await db.collection('trades').doc(uid).collection('trades')
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();

    const trades = snapshot.docs.map(doc => doc.data());

    // Group trades by date for performance chart
    const performanceData = trades.reduce((acc: any, trade) => {
      const date = new Date(trade.timestamp).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { date, trades: 0, pnl: 0 };
      }
      acc[date].trades++;
      acc[date].pnl += trade.result === 'WIN' ? trade.amount : -trade.amount;
      return acc;
    }, {});

    const performance = Object.values(performanceData).sort((a: any, b: any) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return res.json(performance);
  } catch (error) {
    logger.error('Get dashboard performance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Rules routes
app.get('/rules', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const snapshot = await db.collection('rules').doc(uid).collection('rules').get();
    
    const rules = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(rules);
  } catch (error) {
    logger.error('Get rules error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/rules', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const ruleData = req.body;

    // Validate required fields
    const requiredFields = ['title', 'description', 'category'];
    const missingFields = requiredFields.filter(field => !ruleData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missing: missingFields 
      });
    }

    const ruleId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const rule = {
      ruleId,
      title: ruleData.title,
      description: ruleData.description,
      category: ruleData.category,
      is_active: ruleData.is_active || true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await db.collection('rules').doc(uid).collection('rules').doc(ruleId).set(rule);

    return res.status(201).json({ id: ruleId, ...rule });
  } catch (error) {
    logger.error('Create rule error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Insights routes
app.get('/insights', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const snapshot = await db.collection('insights').doc(uid).collection('insights')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const insights = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json(insights);
  } catch (error) {
    logger.error('Get insights error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate on-demand insight
app.post('/insights/generate', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    
    // Get user profile
    const userProfileSnapshot = await db.collection('users').doc(uid).get();
    const userProfile = userProfileSnapshot.data();
    
    // Get recent trades (last 30 days)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tradesSnapshot = await db.collection('trades').doc(uid).collection('trades')
      .where('timestamp', '>=', monthAgo.toISOString())
      .get();
    
    if (tradesSnapshot.empty) {
      return res.status(400).json({ error: 'No trades found for analysis' });
    }
    
    const trades = tradesSnapshot.docs.map(doc => doc.data());
    
    // Calculate KPIs
    const winTrades = trades.filter(t => t.result === 'WIN');
    const winRate = Math.round((winTrades.length / trades.length) * 100);
    const avgStake = trades.reduce((sum, t) => sum + (t.stake || 0), 0) / trades.length;
    
    // Calculate loss streak
    let currentStreak = 0;
    let maxLossStreak = 0;
    for (const trade of trades.reverse()) {
      if (trade.result === 'LOSS') {
        currentStreak++;
        maxLossStreak = Math.max(maxLossStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    // Get user's broken rules
    const rulesSnapshot = await db.collection('rules').doc(uid).collection('rules')
      .where('active', '==', true)
      .get();
    
    let ruleBrokenMost = 'Nenhuma regra quebrada identificada';
    if (!rulesSnapshot.empty) {
      const rules = rulesSnapshot.docs.map(doc => doc.data());
      const brokenRule = rules.find(r => r.violations && r.violations > 0);
      if (brokenRule) {
        ruleBrokenMost = brokenRule.description || brokenRule.name || 'Regra não especificada';
      }
    }
    
    // Generate AI insight
    const aiInsight = await generateInsight({
      uid,
      firstName: userProfile?.firstName || 'Trader',
      kpi: {
        winRate,
        avgStake,
        lossStreak: maxLossStreak
      },
      ruleBrokenMost
    });
    
    // Save insight
    const insight = {
      type: 'on_demand',
      title: 'Análise Personalizada',
      content: aiInsight.insight,
      action: aiInsight.acao,
      timestamp: new Date().toISOString(),
      metadata: {
        totalTrades: trades.length,
        winRate: winRate / 100,
        avgStake,
        lossStreak: maxLossStreak,
        aiGenerated: true,
        kpi: aiInsight.kpi
      }
    };
    
    const docRef = await db.collection('insights').doc(uid).collection('insights').add(insight);
    
    return res.json({
      id: docRef.id,
      ...insight
    });
  } catch (error) {
    logger.error('Generate insight error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Trade coaching endpoint
app.post('/insights/coach', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const { situation } = req.body;
    
    if (!situation) {
      return res.status(400).json({ error: 'Situation is required' });
    }
    
    // Get user profile
    const userProfileSnapshot = await db.collection('users').doc(uid).get();
    const userProfile = userProfileSnapshot.data();
    
    // Generate coaching response
    const coaching = await generateTradeCoach({
      firstName: userProfile?.firstName || 'Trader',
      situation
    });
    
    // Save coaching session
    const coachingSession = {
      type: 'coaching',
      title: 'Suporte Motivacional',
      content: coaching.message,
      quote: coaching.quote,
      timestamp: new Date().toISOString(),
      metadata: {
        situation,
        aiGenerated: true
      }
    };
    
    const docRef = await db.collection('insights').doc(uid).collection('insights').add(coachingSession);
    
    return res.json({
      id: docRef.id,
      ...coachingSession
    });
  } catch (error) {
    logger.error('Generate coaching error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Rule checking endpoint
app.post('/trades/check-rules', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const { trade } = req.body;
    
    if (!trade) {
      return res.status(400).json({ error: 'Trade data is required' });
    }
    
    // Get user's active rules
    const rulesSnapshot = await db.collection('rules').doc(uid).collection('rules')
      .where('active', '==', true)
      .get();
    
    if (rulesSnapshot.empty) {
      return res.json({ violations: [] });
    }
    
    const rules = rulesSnapshot.docs.map(doc => doc.data());
    const ruleDescriptions = rules.map(r => r.description || r.name || 'Regra não especificada');
    
    // Check rules using AI
    const ruleCheck = await checkTradeRules({
      trade,
      rules: ruleDescriptions
    });
    
    return res.json(ruleCheck);
  } catch (error) {
    logger.error('Check trade rules error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV validation endpoint
app.post('/trades/validate-csv', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { headers } = req.body;
    
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({ error: 'Headers array is required' });
    }
    
    // Expected headers for Ebinex CSV
    const expectedHeaders = [
      'ID',
      'Data',
      'Ativo',
      'Direção',
      'Valor',
      'Resultado',
      'Payout',
      'Horário'
    ];
    
    // Validate using AI
    const validation = await validateCSVHeaders({
      receivedHeaders: headers,
      expectedHeaders
    });
    
    return res.json(validation);
  } catch (error) {
    logger.error('Validate CSV headers error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Export the API
// Configure HTTPS function with options
export const api = onRequest({
  secrets: ['OPENAI_API_KEY']
}, app);

// Background functions
export const processCSVUpload = onDocumentCreated({
  document: 'uploads/{userId}/files/{fileId}',
  memory: '1GiB',
  timeoutSeconds: 540,
  region: 'us-central1',
},
  async (event) => {
    const { userId, fileId } = event.params;
    const data = event.data?.data();
    
    if (!data || data.type !== 'csv') {
      logger.log('Not a CSV file, skipping processing');
      return;
    }

    try {
      logger.log(`Processing CSV upload for user ${userId}, file ${fileId}`);
      
      // Update status to processing
      await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
        status: 'processing',
        updatedAt: new Date().toISOString()
      });

      // TODO: Add actual CSV processing logic here
      // For now, just simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update status to completed
      await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
        status: 'completed',
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      logger.log(`CSV processing completed for user ${userId}, file ${fileId}`);
    } catch (error) {
      logger.error('CSV processing error:', error);
      
      // Update status to failed
      await db.collection('uploads').doc(userId).collection('files').doc(fileId).update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date().toISOString()
      });
    }
  }
);

// Scheduled function to generate weekly insights
export const generateWeeklyInsights = onSchedule({
  schedule: '0 8 * * 1',
  memory: '1GiB',
  timeoutSeconds: 540,
  region: 'us-central1',
  retryCount: 3
}, async () => {
  logger.log('Generating weekly insights for all users');
  
  try {
    // Get all users with recent trades
    const usersSnapshot = await db.collection('trades').listDocuments();
    
    for (const userDoc of usersSnapshot) {
      const userId = userDoc.id;
      
      // Get user profile for firstName
      const userProfileSnapshot = await db.collection('users').doc(userId).get();
      const userProfile = userProfileSnapshot.data();
      
      // Get last week's trades
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const tradesSnapshot = await db.collection('trades').doc(userId).collection('trades')
        .where('timestamp', '>=', weekAgo.toISOString())
        .get();
      
      if (tradesSnapshot.empty) {
        continue;
      }
      
      const trades = tradesSnapshot.docs.map(doc => doc.data());
      
      // Calculate KPIs
      const winTrades = trades.filter(t => t.result === 'WIN');
      const lossTrades = trades.filter(t => t.result === 'LOSS');
      const winRate = Math.round((winTrades.length / trades.length) * 100);
      const avgStake = trades.reduce((sum, t) => sum + (t.stake || 0), 0) / trades.length;
      
      // Calculate loss streak
      let currentStreak = 0;
      let maxLossStreak = 0;
      for (const trade of trades.reverse()) {
        if (trade.result === 'LOSS') {
          currentStreak++;
          maxLossStreak = Math.max(maxLossStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      
      // Get user's broken rules (if any)
      const rulesSnapshot = await db.collection('rules').doc(userId).collection('rules')
        .where('active', '==', true)
        .get();
      
      let ruleBrokenMost = 'Nenhuma regra quebrada identificada';
      if (!rulesSnapshot.empty) {
        const rules = rulesSnapshot.docs.map(doc => doc.data());
        const brokenRule = rules.find(r => r.violations && r.violations > 0);
        if (brokenRule) {
          ruleBrokenMost = brokenRule.description || brokenRule.name || 'Regra não especificada';
        }
      }
      
      // Generate AI insight
      const aiInsight = await generateInsight({
        uid: userId,
        firstName: userProfile?.firstName || 'Trader',
        kpi: {
          winRate,
          avgStake,
          lossStreak: maxLossStreak
        },
        ruleBrokenMost
      });
      
      // Create insight document
      const insight = {
        type: 'weekly_summary',
        title: 'Análise Semanal Inteligente',
        content: aiInsight.insight,
        action: aiInsight.acao,
        timestamp: new Date().toISOString(),
        metadata: {
          totalTrades: trades.length,
          winRate: winRate / 100,
          avgStake,
          lossStreak: maxLossStreak,
          aiGenerated: true,
          kpi: aiInsight.kpi
        }
      };
      
      await db.collection('insights').doc(userId).collection('insights').add(insight);
      logger.log(`Generated AI insight for user ${userId}`);
    }
    
    logger.log('Weekly insights generation completed');
  } catch (error) {
    logger.error('Weekly insights generation error:', error);
  }
});

// Cleanup function for old data
export const cleanupOldData = onSchedule({
  schedule: '0 2 * * *',
  memory: '1GiB',
  timeoutSeconds: 540,
  region: 'us-central1',
  retryCount: 3
}, async () => {
  logger.log('Running daily cleanup');
  
  try {
    // Clean up old uploads (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const uploadsSnapshot = await db.collectionGroup('files')
      .where('createdAt', '<', thirtyDaysAgo.toISOString())
      .get();
    
    const batch = db.batch();
    uploadsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    logger.log(`Cleaned up ${uploadsSnapshot.size} old upload records`);
  } catch (error) {
    logger.error('Cleanup error:', error);
  }
}); 