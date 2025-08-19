import { Router, Request, Response } from 'express';
import { tradeService } from '../services/tradeService';
import { analyticsService } from '../services/analyticsService';
import { cacheMiddleware, cacheInvalidationMiddleware, cacheStatsMiddleware } from '../middleware/cache';
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

// Add cache statistics to all responses
router.use(cacheStatsMiddleware());

/**
 * GET /v1/analytics/dashboard - Get dashboard statistics
 */
router.get('/dashboard', 
  cacheMiddleware({
    ttl: 900, // 15 minutes
    tags: (req) => {
      const authReq = req as AuthenticatedRequest;
      return [`user:${authReq.user?.uid}`, 'analytics', 'dashboard'];
    }
  }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'weekly';

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Validate period
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid period. Must be daily, weekly, monthly, or yearly',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Use enhanced analytics service with caching
    const dashboardData = await analyticsService.getDashboardAnalytics(userId, period);
    
    res.json(dashboardData);
    return;

  } catch (error) {
    logger.error('Error getting dashboard analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/analytics/performance - Get detailed performance metrics
 */
router.get('/performance',
  cacheMiddleware({
    ttl: 1800, // 30 minutes
    tags: (req) => {
      const authReq = req as AuthenticatedRequest;
      return [`user:${authReq.user?.uid}`, 'analytics', 'performance'];
    }
  }),
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;
    const groupBy = (req.query.groupBy as 'day' | 'week' | 'month') || 'day';

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Validate groupBy
    if (!['day', 'week', 'month'].includes(groupBy)) {
      return res.status(400).json({
        error: 'Invalid groupBy. Must be day, week, or month',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Determine analytics period based on date range
    let analyticsPeriod: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly';
    if (start && end) {
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) analyticsPeriod = 'daily';
      else if (diffDays <= 30) analyticsPeriod = 'weekly';
      else if (diffDays <= 365) analyticsPeriod = 'monthly';
      else analyticsPeriod = 'yearly';
    }

    // Use enhanced analytics service with comprehensive data
    const analyticsData = await analyticsService.getAnalytics(userId, analyticsPeriod);
    
    res.json({
      dateRange: {
        start: start?.toISOString(),
        end: end?.toISOString()
      },
      ...analyticsData
    });
    return;

  } catch (error) {
    logger.error('Error getting performance analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/analytics/assets - Get asset performance analytics
 */
router.get('/assets',
  cacheMiddleware({
    ttl: 1800, // 30 minutes
    tags: (req) => {
      const authReq = req as AuthenticatedRequest;
      return [`user:${authReq.user?.uid}`, 'analytics', 'assets'];
    }
  }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.uid;
      const asset = req.query.asset as string;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString()
        });
      }

      const assetAnalytics = await analyticsService.getAssetAnalytics(userId, asset);
      
      res.json({
        assets: assetAnalytics,
        timestamp: new Date().toISOString()
      });
      return;

    } catch (error) {
      logger.error('Error getting asset analytics:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
      return;
    }
  });

/**
 * GET /v1/analytics/export - Export analytics data
 */
router.get('/export', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const format = (req.query.format as 'csv' | 'json') || 'csv';
    const start = req.query.start ? new Date(req.query.start as string) : undefined;
    const end = req.query.end ? new Date(req.query.end as string) : undefined;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format. Must be csv or json',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Get trades
    const trades = await tradeService.getUserTrades(userId, {
      start,
      end,
      limit: 10000 // Allow larger exports
    });

    if (format === 'json') {
      res.json({
        trades,
        exportInfo: {
          totalTrades: trades.length,
          dateRange: {
            start: start?.toISOString(),
            end: end?.toISOString()
          },
          exportedAt: new Date().toISOString()
        }
      });
      return;
    } else {
      // Generate CSV
      const csvHeaders = [
        'ID',
        'Asset',
        'Direction',
        'Amount',
        'Entry Price',
        'Exit Price',
        'Entry Time',
        'Exit Time',
        'Result',
        'Profit',
        'Strategy',
        'Platform'
      ];

      const csvRows = trades.map(trade => [
        trade.tradeId,
        trade.asset,
        trade.direction,
        trade.amount,
        trade.entryPrice,
        trade.exitPrice,
        trade.entryTime.toISOString(),
        trade.exitTime.toISOString(),
        trade.result,
        trade.profit,
        trade.strategy || '',
        trade.platform
      ]);

      const csvContent = [csvHeaders, ...csvRows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="trades-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
      return;
    }

  } catch (error) {
    logger.error('Error exporting analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

export default router; 