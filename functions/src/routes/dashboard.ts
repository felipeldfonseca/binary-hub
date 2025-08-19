import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { analyticsService } from '../services/analyticsService';
import { cacheMiddleware, cacheStatsMiddleware } from '../middleware/cache';
import { logger } from 'firebase-functions';

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

// Add cache statistics to all responses
router.use(cacheStatsMiddleware());

/**
 * GET /dashboard/stats - Get dashboard statistics (Legacy - with caching)
 */
router.get('/stats',
  cacheMiddleware({
    ttl: 600, // 10 minutes
    tags: (req) => {
      const authReq = req as AuthenticatedRequest;
      return [`user:${authReq.user?.uid}`, 'dashboard', 'stats'];
    }
  }),
  async (req: AuthenticatedRequest, res: Response) => {
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

    const db = getDb();
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

/**
 * GET /dashboard/performance - Get performance data (Legacy - with caching)
 */
router.get('/performance',
  cacheMiddleware({
    ttl: 900, // 15 minutes
    tags: (req) => {
      const authReq = req as AuthenticatedRequest;
      return [`user:${authReq.user?.uid}`, 'dashboard', 'performance'];
    }
  }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const uid = req.user.uid;
    
    // Get all trades for performance calculation
    const db = getDb();
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

/**
 * GET /dashboard/enhanced - Get enhanced dashboard with comprehensive analytics
 */
router.get('/enhanced',
  cacheMiddleware({
    ttl: 300, // 5 minutes for real-time feel
    tags: (req) => {
      const authReq = req as AuthenticatedRequest;
      return [`user:${authReq.user?.uid}`, 'dashboard', 'enhanced'];
    }
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const uid = req.user.uid;
      const { period = 'weekly' } = req.query;

      // Validate period
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period as string)) {
        return res.status(400).json({
          error: 'Invalid period. Must be daily, weekly, monthly, or yearly',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        });
      }

      // Get comprehensive dashboard data using analytics service
      const dashboardData = await analyticsService.getDashboardAnalytics(uid, period as 'daily' | 'weekly' | 'monthly' | 'yearly');

      return res.json({
        ...dashboardData,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Get enhanced dashboard error:', error);
      return res.status(500).json({ 
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  });

export default router;