import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { generateInsight, generateTradeCoach, checkTradeRules } from '../services/openai';
import { aiInsightsService } from '../services/aiInsightsService';
import { coachingService } from '../services/coachingService';
import { aiRateLimit, trackAIUsage } from '../middleware/aiRateLimit';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

const router = Router();
// Firebase admin is initialized in the main index.ts
const getDb = () => getFirestore();

/**
 * GET /insights - Get user insights
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
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

/**
 * POST /insights/generate - Generate on-demand insight
 */
router.post('/generate', 
  aiRateLimit('/insights/generate'),
  trackAIUsage(400),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
    
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

/**
 * POST /insights/coach - Trade coaching endpoint
 */
router.post('/coach',
  aiRateLimit('/insights/coach'),
  trackAIUsage(250),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const db = getDb();
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

/**
 * POST /insights/comprehensive - Generate comprehensive AI analysis
 */
router.post('/comprehensive',
  aiRateLimit('/insights/generate'), // Use same rate limit as generate
  trackAIUsage(800), // Comprehensive analysis uses more tokens
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const uid = req.user.uid;
      
      logger.info('Generating comprehensive insight', { uid });
      
      // Generate comprehensive AI insights
      const comprehensiveInsight = await aiInsightsService.generateComprehensiveInsights(uid);
      
      return res.json(comprehensiveInsight);
    } catch (error: any) {
      logger.error('Generate comprehensive insight error:', error);
      
      if (error.message && error.message.includes('Insufficient trade data')) {
        return res.status(400).json({
          error: 'Insufficient trade data',
          code: 'INSUFFICIENT_DATA',
          message: 'Minimum 10 trades required for comprehensive analysis'
        });
      }
      
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /insights/coaching-session - Advanced coaching session
 */
router.post('/coaching-session',
  aiRateLimit('/insights/coach'),
  trackAIUsage(300),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const uid = req.user.uid;
      const { situation, triggerType } = req.body;
      
      logger.info('Starting advanced coaching session', { uid, triggerType });
      
      // Provide personalized coaching
      const coachingSession = await coachingService.providePersonalizedCoaching(
        uid,
        situation,
        triggerType || 'user_request'
      );
      
      return res.json(coachingSession);
    } catch (error) {
      logger.error('Advanced coaching session error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * POST /insights/check-rules - Check trade against user rules
 */
router.post('/check-rules',
  aiRateLimit('/trades/check-rules'),
  trackAIUsage(150),
  async (req: AuthenticatedRequest, res: Response) => {
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
      const db = getDb();
      const rulesSnapshot = await db.collection('rules').doc(uid).collection('rules')
        .where('isActive', '==', true)
        .get();
      
      if (rulesSnapshot.empty) {
        return res.json({ violations: [] });
      }
      
      const rules = rulesSnapshot.docs.map(doc => doc.data().description || doc.data().title);
      
      logger.info('Checking trade against rules', { uid, rulesCount: rules.length });
      
      // Check rules using AI
      const ruleCheckResult = await checkTradeRules({ trade, rules });
      
      // Update violation counts for broken rules
      const batch = db.batch();
      for (const violation of ruleCheckResult.violations) {
        if (violation.violated) {
          const ruleDoc = rulesSnapshot.docs.find(doc => 
            (doc.data().description || doc.data().title) === violation.rule
          );
          if (ruleDoc) {
            batch.update(ruleDoc.ref, {
              violations: (ruleDoc.data().violations || 0) + 1,
              lastViolatedAt: new Date().toISOString()
            });
          }
        }
      }
      
      await batch.commit();
      
      return res.json(ruleCheckResult);
    } catch (error) {
      logger.error('Check rules error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * GET /insights/recommendations - Get strategic recommendations
 */
router.get('/recommendations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    
    logger.info('Generating strategic recommendations', { uid });
    
    // Generate strategic recommendations
    const recommendations = await coachingService.generateStrategicRecommendations(uid);
    
    return res.json({ recommendations });
  } catch (error) {
    logger.error('Get recommendations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /insights/history - Get user's insight history
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const { type, limit, since } = req.query;
    
    const options: any = {};
    if (type) options.type = type as string;
    if (limit) options.limit = parseInt(limit as string);
    if (since) options.since = new Date(since as string);
    
    // Get insights history
    const insights = await aiInsightsService.getInsights(uid, options);
    
    return res.json({ insights });
  } catch (error) {
    logger.error('Get insights history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /insights/coaching-history - Get coaching session history
 */
router.get('/coaching-history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    const { sessionType, limit, since } = req.query;
    
    const options: any = {};
    if (sessionType) options.sessionType = sessionType as any;
    if (limit) options.limit = parseInt(limit as string);
    if (since) options.since = new Date(since as string);
    
    // Get coaching history
    const sessions = await coachingService.getCoachingHistory(uid, options);
    
    return res.json({ sessions });
  } catch (error) {
    logger.error('Get coaching history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;