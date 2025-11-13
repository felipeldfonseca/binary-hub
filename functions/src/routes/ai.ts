import { Router, Request, Response } from 'express';
import { logger } from 'firebase-functions';
import openRouterService from '../services/openRouterService';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

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
 * POST /ai/analyze/trade - Analyze individual trade
 */
router.post('/analyze/trade', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { tradeId, tradeData } = req.body;
    
    if (!tradeData) {
      return res.status(400).json({ error: 'Trade data is required' });
    }

    // Validate required trade fields
    const requiredFields = ['asset', 'direction', 'amount', 'result', 'profit'];
    for (const field of requiredFields) {
      if (tradeData[field] === undefined) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }

    const analysisId = await openRouterService.analyzeWithAI({
      type: 'individual_trade',
      userId: req.user.uid,
      data: tradeData
    });

    return res.json({
      success: true,
      data: {
        analysisId,
        message: 'Trade analysis initiated'
      }
    });
  } catch (error: any) {
    logger.error('Trade analysis error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /ai/analyze/daily-report - Generate daily trading report
 */
router.post('/analyze/daily-report', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { date } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Get trades for the specified date
    const tradesSnapshot = await db.collection('trades').doc(req.user.uid).collection('userTrades')
      .where('entryTime', '>=', new Date(date + 'T00:00:00.000Z'))
      .where('entryTime', '<', new Date(date + 'T23:59:59.999Z'))
      .orderBy('entryTime', 'asc')
      .get();

    const trades = tradesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (trades.length === 0) {
      return res.status(400).json({ error: 'No trades found for the specified date' });
    }

    const analysisId = await openRouterService.analyzeWithAI({
      type: 'daily_report',
      userId: req.user.uid,
      data: { trades, date }
    });

    return res.json({
      success: true,
      data: {
        analysisId,
        tradesAnalyzed: trades.length,
        message: 'Daily report generation initiated'
      }
    });
  } catch (error: any) {
    logger.error('Daily report error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /ai/analyze/weekly-report - Generate weekly trading report
 */
router.post('/analyze/weekly-report', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { weekStart, weekEnd } = req.body;
    
    if (!weekStart || !weekEnd) {
      return res.status(400).json({ error: 'Week start and end dates are required' });
    }

    // Get trades for the specified week
    const tradesSnapshot = await db.collection('trades').doc(req.user.uid).collection('userTrades')
      .where('entryTime', '>=', new Date(weekStart))
      .where('entryTime', '<=', new Date(weekEnd))
      .orderBy('entryTime', 'asc')
      .get();

    const trades = tradesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (trades.length === 0) {
      return res.status(400).json({ error: 'No trades found for the specified week' });
    }

    // Calculate weekly stats
    const stats = calculateWeeklyStats(trades, weekStart, weekEnd);

    const analysisId = await openRouterService.analyzeWithAI({
      type: 'weekly_report',
      userId: req.user.uid,
      data: { trades, weekStart, weekEnd, stats }
    });

    return res.json({
      success: true,
      data: {
        analysisId,
        tradesAnalyzed: trades.length,
        message: 'Weekly report generation initiated'
      }
    });
  } catch (error: any) {
    logger.error('Weekly report error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * POST /ai/analyze/patterns - Analyze trading patterns
 */
router.post('/analyze/patterns', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { timeframe = '30d', maxTrades = 100 } = req.body;
    
    // Calculate date range based on timeframe
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get trades for pattern analysis
    const tradesSnapshot = await db.collection('trades').doc(req.user.uid).collection('userTrades')
      .where('entryTime', '>=', startDate)
      .where('entryTime', '<=', endDate)
      .orderBy('entryTime', 'desc')
      .limit(maxTrades)
      .get();

    const trades = tradesSnapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (trades.length < 10) {
      return res.status(400).json({ error: 'Insufficient trade data for pattern analysis (minimum 10 trades required)' });
    }

    // Identify basic patterns
    const patterns = identifyBasicPatterns(trades);

    const analysisId = await openRouterService.analyzeWithAI({
      type: 'pattern_analysis',
      userId: req.user.uid,
      data: { trades, timeframe, patterns }
    });

    return res.json({
      success: true,
      data: {
        analysisId,
        tradesAnalyzed: trades.length,
        patternsFound: patterns.length,
        message: 'Pattern analysis initiated'
      }
    });
  } catch (error: any) {
    logger.error('Pattern analysis error:', error);
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /ai/analysis/:analysisId - Get analysis result
 */
router.get('/analysis/:analysisId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { analysisId } = req.params;
    
    const analysisDoc = await db.collection('ai_analyses').doc(analysisId).get();
    
    if (!analysisDoc.exists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const analysisData = analysisDoc.data();
    
    // Check if user owns this analysis (security check)
    if (analysisData?.userId !== req.user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      success: true,
      data: {
        id: analysisDoc.id,
        ...analysisData
      }
    });
  } catch (error: any) {
    logger.error('Get analysis error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ai/history - Get user's AI analysis history
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { type, limit = '20' } = req.query;
    
    // Get analysis history from database directly
    let query = db.collection('ai_analyses')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit as string));

    if (type) {
      query = db.collection('ai_analyses')
        .where('userId', '==', req.user.uid)
        .where('type', '==', type)
        .orderBy('createdAt', 'desc')
        .limit(parseInt(limit as string));
    }

    const snapshot = await query.get();
    const history = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return res.json({
      success: true,
      data: {
        analyses: history,
        count: history.length
      }
    });
  } catch (error: any) {
    logger.error('Get history error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ai/usage - Get user's AI usage statistics
 */
router.get('/usage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get usage statistics from database directly
    const currentMonth = new Date().toISOString().substring(0, 7);
    const usageDoc = await db.collection('users').doc(req.user.uid)
      .collection('ai_usage').doc(currentMonth).get();
    
    const usageStats = usageDoc.exists ? usageDoc.data() : {
      individual_trade: 0,
      daily_report: 0,
      weekly_report: 0,
      pattern_analysis: 0,
      totalCost: 0,
      totalTokens: 0
    };
    
    // Get user subscription info for limits
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const subscription = userData?.subscription?.tier || 'free';

    return res.json({
      success: true,
      data: {
        currentUsage: usageStats,
        subscription,
        limits: getSubscriptionLimits(subscription)
      }
    });
  } catch (error: any) {
    logger.error('Get usage error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ai/models/info - Get information about AI models and costs
 */
router.get('/models/info', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const costAnalysis = openRouterService.getCostAnalysis();
    const healthCheck = await openRouterService.healthCheck();

    return res.json({
      success: true,
      data: {
        message: "Powered by championship-winning AI models",
        models: costAnalysis.models,
        cost_savings: costAnalysis.comparison,
        service_health: healthCheck,
        competitive_advantage: {
          performance: "Models that won trading competitions",
          cost: "625x cheaper than GPT-4o", 
          reliability: "OpenRouter API with multiple fallbacks"
        }
      }
    });
  } catch (error: any) {
    logger.error('Models info error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /ai/suggestions/content - Get AI content suggestions for social posts
 */
router.get('/suggestions/content', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { tradeId, context = 'general' } = req.query;
    
    // Get recent trades for context
    const recentTradesSnapshot = await db.collection('trades').doc(req.user.uid).collection('userTrades')
      .orderBy('entryTime', 'desc')
      .limit(5)
      .get();

    const recentTrades = recentTradesSnapshot.docs.map((doc: any) => doc.data());
    
    // Generate content suggestions based on recent performance
    const suggestions = generateContentSuggestions(recentTrades, context as string);

    return res.json({
      success: true,
      data: {
        suggestions,
        context
      }
    });
  } catch (error: any) {
    logger.error('Content suggestions error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper functions

function calculateWeeklyStats(trades: any[], weekStart: string, weekEnd: string): any {
  const winningTrades = trades.filter(t => t.result === 'win');
  const totalProfit = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
  
  // Group trades by day
  const dailyBreakdown: any = {};
  trades.forEach(trade => {
    const day = new Date(trade.entryTime).toISOString().substring(0, 10);
    if (!dailyBreakdown[day]) {
      dailyBreakdown[day] = { trades: 0, profit: 0, wins: 0 };
    }
    dailyBreakdown[day].trades++;
    dailyBreakdown[day].profit += trade.profit || 0;
    if (trade.result === 'win') dailyBreakdown[day].wins++;
  });

  // Calculate win rate for each day
  Object.keys(dailyBreakdown).forEach(day => {
    dailyBreakdown[day].winRate = (dailyBreakdown[day].wins / dailyBreakdown[day].trades * 100).toFixed(1);
  });

  // Find best and worst days
  const days = Object.entries(dailyBreakdown);
  const bestDay = days.reduce((best, current) => 
    (current[1] as any).profit > (best[1] as any).profit ? current : best
  )[0];
  const worstDay = days.reduce((worst, current) => 
    (current[1] as any).profit < (worst[1] as any).profit ? current : worst
  )[0];

  return {
    totalTrades: trades.length,
    winRate: (winningTrades.length / trades.length * 100).toFixed(1),
    totalProfit: totalProfit.toFixed(2),
    bestDay,
    worstDay,
    dailyBreakdown
  };
}

function identifyBasicPatterns(trades: any[]): any[] {
  const patterns: any[] = [];
  
  // Winning/losing streaks
  let currentStreak = 1;
  let streakType = trades[0]?.result;
  
  for (let i = 1; i < trades.length; i++) {
    if (trades[i].result === streakType) {
      currentStreak++;
    } else {
      if (currentStreak >= 3) {
        patterns.push({
          name: `${streakType}_streak`,
          frequency: 1,
          successRate: streakType === 'win' ? 100 : 0,
          description: `${currentStreak} consecutive ${streakType}s`
        });
      }
      streakType = trades[i].result;
      currentStreak = 1;
    }
  }
  
  // Asset preferences
  const assetCounts: any = {};
  trades.forEach(trade => {
    assetCounts[trade.asset] = (assetCounts[trade.asset] || 0) + 1;
  });
  
  const topAsset = Object.entries(assetCounts).reduce((top, current) => 
    (current[1] as number) > (top[1] as number) ? current : top
  );
  
  if ((topAsset[1] as number) > trades.length * 0.3) {
    patterns.push({
      name: 'asset_preference',
      frequency: topAsset[1] as number,
      successRate: calculateAssetSuccessRate(trades, topAsset[0] as string),
      description: `Strong preference for ${topAsset[0]}`
    });
  }
  
  return patterns;
}

function calculateAssetSuccessRate(trades: any[], asset: string): number {
  const assetTrades = trades.filter(t => t.asset === asset);
  const wins = assetTrades.filter(t => t.result === 'win').length;
  return assetTrades.length > 0 ? (wins / assetTrades.length * 100) : 0;
}

function getSubscriptionLimits(subscription: string): any {
  // Updated limits leveraging 625x cheaper AI models
  const limits = {
    free: {
      individual_trade: 5,
      daily_report: 0,
      weekly_report: 1, // 1 weekly report for free users
      pattern_analysis: 0
    },
    pro: {
      individual_trade: 50, // 10x more with cheaper models
      daily_report: 30,
      weekly_report: 4,
      pattern_analysis: 20
    },
    premium: {
      individual_trade: 200, // Even more with cost savings
      daily_report: 100,
      weekly_report: 20,
      pattern_analysis: 50
    }
  };
  
  return limits[subscription as keyof typeof limits] || limits.free;
}

function generateContentSuggestions(recentTrades: any[], context: string): string[] {
  const suggestions: string[] = [];
  
  if (recentTrades.length === 0) {
    return [
      "Começando minha jornada no trading! 📈",
      "Estudando o mercado antes do próximo trade 📚",
      "Preparando estratégias para esta semana 🎯"
    ];
  }
  
  const winningTrades = recentTrades.filter(t => t.result === 'win');
  const winRate = winningTrades.length / recentTrades.length;
  
  if (winRate > 0.7) {
    suggestions.push(
      "Sequência positiva! Mantendo a disciplina e foco 🎯",
      "Estratégia funcionando bem hoje! 📈💪",
      "Consistência é a chave do sucesso no trading ✨"
    );
  } else if (winRate < 0.3) {
    suggestions.push(
      "Dia desafiador, mas cada perda é uma lição 📚",
      "Revisando estratégias e ajustando para amanhã 🔧",
      "Disciplina e paciência são fundamentais 🧘‍♂️"
    );
  } else {
    suggestions.push(
      "Dia equilibrado, analisando oportunidades 📊",
      "Focando na qualidade dos setups 🎯",
      "Cada trade é uma oportunidade de aprender 📈"
    );
  }
  
  // Add asset-specific suggestions
  const topAsset = getMostTradedAsset(recentTrades);
  if (topAsset) {
    suggestions.push(`Focando em ${topAsset} hoje! Mercado interessante 📈`);
  }
  
  return suggestions.slice(0, 5);
}

function getMostTradedAsset(trades: any[]): string | null {
  if (trades.length === 0) return null;
  
  const assetCounts: any = {};
  trades.forEach(trade => {
    assetCounts[trade.asset] = (assetCounts[trade.asset] || 0) + 1;
  });
  
  return Object.entries(assetCounts).reduce((top, current) => 
    (current[1] as number) > (top[1] as number) ? current : top
  )[0] as string;
}

export default router;