import { Router, Request, Response } from 'express';
import { tradeService } from '../services/tradeService';
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

/**
 * GET /v1/analytics/dashboard - Get dashboard statistics
 */
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
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

    // Get trade statistics
    const stats = await tradeService.getTradeStats(userId, period);

    // Get recent trades for performance chart
    const recentTrades = await tradeService.getUserTrades(userId, {
      limit: 30,
      end: new Date()
    });

    // Calculate performance data (simplified - in real implementation, you'd group by date)
    const performance = recentTrades.map(trade => ({
      date: trade.entryTime.toISOString().split('T')[0],
      trades: 1,
      pnl: trade.profit || 0
    }));

    // Group by date and sum
    const groupedPerformance = performance.reduce((acc, item) => {
      const existing = acc.find(p => p.date === item.date);
      if (existing) {
        existing.trades += item.trades;
        existing.pnl += item.pnl;
      } else {
        acc.push(item);
      }
      return acc;
    }, [] as typeof performance);

    res.json({
      period,
      stats: {
        totalTrades: stats.totalTrades,
        winTrades: stats.winTrades,
        lossTrades: stats.lossTrades,
        winRate: stats.winRate,
        totalPnl: stats.totalPnl,
        avgPnl: stats.avgPnl,
        maxDrawdown: stats.maxDrawdown,
        avgStake: stats.avgStake,
        maxStake: stats.maxStake
      },
      performance: groupedPerformance.sort((a, b) => a.date.localeCompare(b.date))
    });
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
router.get('/performance', async (req: AuthenticatedRequest, res: Response) => {
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

    // Get trades with date filters
    const trades = await tradeService.getUserTrades(userId, {
      start,
      end,
      limit: 1000
    });

    // Calculate metrics
    const totalTrades = trades.length;
    const winTrades = trades.filter(t => t.result === 'win').length;
    const lossTrades = trades.filter(t => t.result === 'loss').length;
    const tieTrades = trades.filter(t => t.result === 'tie').length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    const totalPnl = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const avgPnl = totalTrades > 0 ? totalPnl / totalTrades : 0;

    // Calculate asset breakdown
    const assetBreakdown = trades.reduce((acc, trade) => {
      const asset = trade.asset;
      if (!acc[asset]) {
        acc[asset] = {
          asset,
          trades: 0,
          winRate: 0,
          totalPnl: 0
        };
      }
      
      acc[asset].trades++;
      if (trade.result === 'win') {
        acc[asset].totalPnl += trade.profit || 0;
      }
      
      return acc;
    }, {} as Record<string, { asset: string; trades: number; winRate: number; totalPnl: number }>);

    // Calculate win rates for each asset
    Object.values(assetBreakdown).forEach(asset => {
      const assetTrades = trades.filter(t => t.asset === asset.asset);
      const assetWinTrades = assetTrades.filter(t => t.result === 'win').length;
      asset.winRate = assetTrades.length > 0 ? (assetWinTrades / assetTrades.length) * 100 : 0;
    });

    res.json({
      period: {
        start: start?.toISOString(),
        end: end?.toISOString()
      },
      metrics: {
        totalTrades,
        winTrades,
        lossTrades,
        tieTrades,
        winRate,
        totalPnl,
        avgPnl
      },
      assetBreakdown: Object.values(assetBreakdown)
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