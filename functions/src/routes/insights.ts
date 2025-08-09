import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { generateInsight, generateTradeCoach } from '../services/openai';

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
router.post('/generate', async (req: AuthenticatedRequest, res: Response) => {
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
router.post('/coach', async (req: AuthenticatedRequest, res: Response) => {
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

export default router;