import { Router, Request, Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
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

/**
 * GET /dashboard/stats - Get dashboard statistics
 */
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
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
 * GET /dashboard/performance - Get performance data
 */
router.get('/performance', async (req: AuthenticatedRequest, res: Response) => {
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

export default router;