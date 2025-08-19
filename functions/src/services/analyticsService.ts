import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { cacheService } from './cacheService';
import { tradeService, Trade, TradeStats } from './tradeService';

export interface AnalyticsData {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  stats: TradeStats;
  performance: PerformanceData[];
  assetBreakdown: AssetPerformance[];
  timeAnalysis: TimeAnalysis;
  streakAnalysis: StreakAnalysis;
  riskMetrics: RiskMetrics;
}

export interface PerformanceData {
  date: string;
  trades: number;
  pnl: number;
  winRate: number;
  volume: number;
}

export interface AssetPerformance {
  asset: string;
  trades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  volume: number;
  bestStreak: number;
  worstStreak: number;
}

export interface TimeAnalysis {
  bestHour: { hour: number; winRate: number; trades: number };
  worstHour: { hour: number; winRate: number; trades: number };
  bestDay: { day: string; winRate: number; trades: number };
  worstDay: { day: string; winRate: number; trades: number };
  tradingFrequency: { [hour: string]: number };
}

export interface StreakAnalysis {
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  streakHistory: Array<{ type: 'win' | 'loss'; length: number; startDate: string; endDate: string }>;
}

export interface RiskMetrics {
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  profitFactor: number;
  recoveryFactor: number;
  avgRiskReward: number;
  consistencyRatio: number;
}

export interface DashboardData {
  period: string;
  stats: TradeStats & {
    todayTrades: number;
    todayPnl: number;
    weekTrend: 'up' | 'down' | 'neutral';
    monthTrend: 'up' | 'down' | 'neutral';
  };
  performance: PerformanceData[];
  quickInsights: string[];
  alerts: Array<{ type: 'warning' | 'info' | 'success'; message: string }>;
}

/**
 * Analytics service with comprehensive caching and performance optimization
 */
export class AnalyticsService {
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }

  /**
   * Get dashboard analytics with caching
   */
  async getDashboardAnalytics(userId: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly'): Promise<DashboardData> {
    const cacheKey = `analytics:dashboard:${userId}:${period}`;
    const cacheTTL = this.getCacheTTL(period);

    try {
      // Try cache first
      const cached = await cacheService.get<DashboardData>(cacheKey);
      if (cached) {
        logger.debug(`Dashboard analytics cache hit for user ${userId}`);
        return cached;
      }

      logger.debug(`Dashboard analytics cache miss for user ${userId} - computing...`);
      const startTime = Date.now();

      // Get date range for period
      const { startDate, endDate } = this.getDateRange(period);

      // Get trades for the period
      const trades = await tradeService.getUserTrades(userId, {
        start: startDate,
        end: endDate,
        limit: 10000
      });

      // Calculate basic stats
      const stats = await this.calculateBasicStats(trades, period);

      // Get today's data for quick insights
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTrades = trades.filter(t => t.entryTime >= today);
      const todayPnl = todayTrades.reduce((sum, t) => sum + (t.profit || 0), 0);

      // Calculate performance data
      const performance = this.calculatePerformanceData(trades);

      // Generate trends
      const weekTrend = this.calculateTrend(trades, 'week');
      const monthTrend = this.calculateTrend(trades, 'month');

      // Generate quick insights
      const quickInsights = this.generateQuickInsights(trades, stats);

      // Generate alerts
      const alerts = this.generateAlerts(trades, stats);

      const result: DashboardData = {
        period,
        stats: {
          ...stats,
          todayTrades: todayTrades.length,
          todayPnl,
          weekTrend,
          monthTrend
        },
        performance,
        quickInsights,
        alerts
      };

      // Cache the result
      await cacheService.set(cacheKey, result, {
        ttl: cacheTTL,
        tags: [`user:${userId}`, 'analytics', 'dashboard']
      });

      const duration = Date.now() - startTime;
      logger.info(`Dashboard analytics computed for user ${userId} in ${duration}ms`);

      return result;
    } catch (error) {
      logger.error('Error getting dashboard analytics:', error);
      throw new Error('Failed to get dashboard analytics');
    }
  }

  /**
   * Get comprehensive analytics with caching
   */
  async getAnalytics(userId: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly'): Promise<AnalyticsData> {
    const cacheKey = `analytics:comprehensive:${userId}:${period}`;
    const cacheTTL = this.getCacheTTL(period);

    try {
      // Try cache first
      const cached = await cacheService.get<AnalyticsData>(cacheKey);
      if (cached) {
        logger.debug(`Comprehensive analytics cache hit for user ${userId}`);
        return cached;
      }

      logger.debug(`Comprehensive analytics cache miss for user ${userId} - computing...`);
      const startTime = Date.now();

      // Get date range for period
      const { startDate, endDate } = this.getDateRange(period);

      // Get trades for the period
      const trades = await tradeService.getUserTrades(userId, {
        start: startDate,
        end: endDate,
        limit: 10000
      });

      // Calculate all analytics components
      const [stats, performance, assetBreakdown, timeAnalysis, streakAnalysis, riskMetrics] = await Promise.all([
        this.calculateBasicStats(trades, period),
        Promise.resolve(this.calculatePerformanceData(trades)),
        Promise.resolve(this.calculateAssetBreakdown(trades)),
        Promise.resolve(this.calculateTimeAnalysis(trades)),
        Promise.resolve(this.calculateStreakAnalysis(trades)),
        Promise.resolve(this.calculateRiskMetrics(trades))
      ]);

      const result: AnalyticsData = {
        period,
        stats,
        performance,
        assetBreakdown,
        timeAnalysis,
        streakAnalysis,
        riskMetrics
      };

      // Cache the result
      await cacheService.set(cacheKey, result, {
        ttl: cacheTTL,
        tags: [`user:${userId}`, 'analytics', 'comprehensive']
      });

      const duration = Date.now() - startTime;
      logger.info(`Comprehensive analytics computed for user ${userId} in ${duration}ms`);

      return result;
    } catch (error) {
      logger.error('Error getting comprehensive analytics:', error);
      throw new Error('Failed to get comprehensive analytics');
    }
  }

  /**
   * Get asset performance analytics with caching
   */
  async getAssetAnalytics(userId: string, asset?: string): Promise<AssetPerformance[]> {
    const cacheKey = asset 
      ? `analytics:asset:${userId}:${asset}`
      : `analytics:assets:${userId}:all`;
    const cacheTTL = 1800; // 30 minutes

    try {
      // Try cache first
      const cached = await cacheService.get<AssetPerformance[]>(cacheKey);
      if (cached) {
        logger.debug(`Asset analytics cache hit for user ${userId}`);
        return cached;
      }

      const trades = await tradeService.getUserTrades(userId, {
        asset,
        limit: 5000
      });

      const assetBreakdown = this.calculateAssetBreakdown(trades);

      // Cache the result
      await cacheService.set(cacheKey, assetBreakdown, {
        ttl: cacheTTL,
        tags: [`user:${userId}`, 'analytics', 'assets']
      });

      return assetBreakdown;
    } catch (error) {
      logger.error('Error getting asset analytics:', error);
      throw new Error('Failed to get asset analytics');
    }
  }

  /**
   * Calculate basic statistics
   */
  private async calculateBasicStats(trades: Trade[], period: string): Promise<TradeStats> {
    if (trades.length === 0) {
      return {
        totalTrades: 0,
        winTrades: 0,
        lossTrades: 0,
        tieTrades: 0,
        winRate: 0,
        totalPnl: 0,
        avgPnl: 0,
        maxDrawdown: 0,
        avgStake: 0,
        maxStake: 0
      };
    }

    const winTrades = trades.filter(t => t.result === 'win').length;
    const lossTrades = trades.filter(t => t.result === 'loss').length;
    const tieTrades = trades.filter(t => t.result === 'tie').length;
    const totalTrades = trades.length;
    
    const totalPnl = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const avgPnl = totalPnl / totalTrades;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
    
    const stakes = trades.map(t => t.amount);
    const avgStake = stakes.reduce((sum, s) => sum + s, 0) / stakes.length;
    const maxStake = Math.max(...stakes);
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let runningTotal = 0;
    let peak = 0;
    
    const sortedTrades = trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
    
    for (const trade of sortedTrades) {
      runningTotal += trade.profit || 0;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      totalTrades,
      winTrades,
      lossTrades,
      tieTrades,
      winRate,
      totalPnl,
      avgPnl,
      maxDrawdown,
      avgStake,
      maxStake
    };
  }

  /**
   * Calculate performance data grouped by date
   */
  private calculatePerformanceData(trades: Trade[]): PerformanceData[] {
    const performanceMap = new Map<string, PerformanceData>();

    trades.forEach(trade => {
      const date = trade.entryTime.toISOString().split('T')[0];
      
      if (!performanceMap.has(date)) {
        performanceMap.set(date, {
          date,
          trades: 0,
          pnl: 0,
          winRate: 0,
          volume: 0
        });
      }

      const dayData = performanceMap.get(date)!;
      dayData.trades++;
      dayData.pnl += trade.profit || 0;
      dayData.volume += trade.amount;
    });

    // Calculate win rates
    performanceMap.forEach((dayData, date) => {
      const dayTrades = trades.filter(t => t.entryTime.toISOString().split('T')[0] === date);
      const dayWins = dayTrades.filter(t => t.result === 'win').length;
      dayData.winRate = dayTrades.length > 0 ? (dayWins / dayTrades.length) * 100 : 0;
    });

    return Array.from(performanceMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate asset breakdown with detailed metrics
   */
  private calculateAssetBreakdown(trades: Trade[]): AssetPerformance[] {
    const assetMap = new Map<string, AssetPerformance>();

    trades.forEach(trade => {
      if (!assetMap.has(trade.asset)) {
        assetMap.set(trade.asset, {
          asset: trade.asset,
          trades: 0,
          winRate: 0,
          totalPnl: 0,
          avgPnl: 0,
          volume: 0,
          bestStreak: 0,
          worstStreak: 0
        });
      }

      const assetData = assetMap.get(trade.asset)!;
      assetData.trades++;
      assetData.totalPnl += trade.profit || 0;
      assetData.volume += trade.amount;
    });

    // Calculate derived metrics for each asset
    assetMap.forEach((assetData, asset) => {
      const assetTrades = trades.filter(t => t.asset === asset);
      const assetWins = assetTrades.filter(t => t.result === 'win').length;
      
      assetData.winRate = assetTrades.length > 0 ? (assetWins / assetTrades.length) * 100 : 0;
      assetData.avgPnl = assetTrades.length > 0 ? assetData.totalPnl / assetTrades.length : 0;
      
      // Calculate streaks
      const streaks = this.calculateAssetStreaks(assetTrades);
      assetData.bestStreak = streaks.longestWin;
      assetData.worstStreak = streaks.longestLoss;
    });

    return Array.from(assetMap.values()).sort((a, b) => b.trades - a.trades);
  }

  /**
   * Calculate time-based analytics
   */
  private calculateTimeAnalysis(trades: Trade[]): TimeAnalysis {
    const hourlyStats = new Map<number, { trades: number; wins: number }>();
    const dailyStats = new Map<string, { trades: number; wins: number }>();
    const tradingFrequency: { [hour: string]: number } = {};

    trades.forEach(trade => {
      const hour = trade.entryTime.getHours();
      const day = trade.entryTime.toLocaleDateString('en-US', { weekday: 'long' });
      const isWin = trade.result === 'win';

      // Hourly stats
      if (!hourlyStats.has(hour)) {
        hourlyStats.set(hour, { trades: 0, wins: 0 });
      }
      const hourData = hourlyStats.get(hour)!;
      hourData.trades++;
      if (isWin) hourData.wins++;

      // Daily stats
      if (!dailyStats.has(day)) {
        dailyStats.set(day, { trades: 0, wins: 0 });
      }
      const dayData = dailyStats.get(day)!;
      dayData.trades++;
      if (isWin) dayData.wins++;

      // Trading frequency
      const hourKey = hour.toString().padStart(2, '0');
      tradingFrequency[hourKey] = (tradingFrequency[hourKey] || 0) + 1;
    });

    // Find best/worst hours and days
    let bestHour = { hour: 0, winRate: 0, trades: 0 };
    let worstHour = { hour: 0, winRate: 100, trades: 0 };
    
    hourlyStats.forEach((stats, hour) => {
      const winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
      if (stats.trades >= 5) { // Minimum trades for significance
        if (winRate > bestHour.winRate) {
          bestHour = { hour, winRate, trades: stats.trades };
        }
        if (winRate < worstHour.winRate) {
          worstHour = { hour, winRate, trades: stats.trades };
        }
      }
    });

    let bestDay = { day: '', winRate: 0, trades: 0 };
    let worstDay = { day: '', winRate: 100, trades: 0 };
    
    dailyStats.forEach((stats, day) => {
      const winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
      if (stats.trades >= 5) { // Minimum trades for significance
        if (winRate > bestDay.winRate) {
          bestDay = { day, winRate, trades: stats.trades };
        }
        if (winRate < worstDay.winRate) {
          worstDay = { day, winRate, trades: stats.trades };
        }
      }
    });

    return {
      bestHour,
      worstHour,
      bestDay,
      worstDay,
      tradingFrequency
    };
  }

  /**
   * Calculate streak analysis
   */
  private calculateStreakAnalysis(trades: Trade[]): StreakAnalysis {
    const sortedTrades = trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
    
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentStreakType: 'win' | 'loss' | null = null;
    let streakStart: Date | null = null;
    
    const streakHistory: Array<{ type: 'win' | 'loss'; length: number; startDate: string; endDate: string }> = [];

    sortedTrades.forEach((trade, index) => {
      const isWin = trade.result === 'win';
      const isLoss = trade.result === 'loss';

      if (isWin) {
        if (currentStreakType === 'loss' && currentLossStreak > 0) {
          // End loss streak
          streakHistory.push({
            type: 'loss',
            length: currentLossStreak,
            startDate: streakStart!.toISOString(),
            endDate: sortedTrades[index - 1].entryTime.toISOString()
          });
          currentLossStreak = 0;
        }
        
        if (currentStreakType !== 'win') {
          streakStart = trade.entryTime;
          currentStreakType = 'win';
        }
        
        currentWinStreak++;
        longestWinStreak = Math.max(longestWinStreak, currentWinStreak);
      } else if (isLoss) {
        if (currentStreakType === 'win' && currentWinStreak > 0) {
          // End win streak
          streakHistory.push({
            type: 'win',
            length: currentWinStreak,
            startDate: streakStart!.toISOString(),
            endDate: sortedTrades[index - 1].entryTime.toISOString()
          });
          currentWinStreak = 0;
        }
        
        if (currentStreakType !== 'loss') {
          streakStart = trade.entryTime;
          currentStreakType = 'loss';
        }
        
        currentLossStreak++;
        longestLossStreak = Math.max(longestLossStreak, currentLossStreak);
      }
    });

    return {
      currentWinStreak,
      currentLossStreak,
      longestWinStreak,
      longestLossStreak,
      streakHistory: streakHistory.slice(-20) // Keep last 20 streaks
    };
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics(trades: Trade[]): RiskMetrics {
    if (trades.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        sharpeRatio: 0,
        profitFactor: 0,
        recoveryFactor: 0,
        avgRiskReward: 0,
        consistencyRatio: 0
      };
    }

    const sortedTrades = trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
    const profits = sortedTrades.map(t => t.profit || 0);
    const totalPnl = profits.reduce((sum, p) => sum + p, 0);
    
    // Calculate running balance and drawdowns
    let runningBalance = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    
    sortedTrades.forEach(trade => {
      runningBalance += trade.profit || 0;
      if (runningBalance > peak) {
        peak = runningBalance;
      }
      const drawdown = peak - runningBalance;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
      }
    });

    // Calculate Sharpe ratio (simplified)
    const avgReturn = profits.reduce((sum, p) => sum + p, 0) / profits.length;
    const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgReturn, 2), 0) / profits.length;
    const volatility = Math.sqrt(variance);
    const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0;

    // Calculate profit factor
    const grossProfit = profits.filter(p => p > 0).reduce((sum, p) => sum + p, 0);
    const grossLoss = Math.abs(profits.filter(p => p < 0).reduce((sum, p) => sum + p, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 100 : 0;

    // Calculate recovery factor
    const recoveryFactor = maxDrawdown > 0 ? totalPnl / maxDrawdown : totalPnl;

    // Calculate average risk-reward
    const winners = profits.filter(p => p > 0);
    const losers = profits.filter(p => p < 0);
    const avgWin = winners.length > 0 ? winners.reduce((sum, p) => sum + p, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, p) => sum + p, 0) / losers.length) : 0;
    const avgRiskReward = avgLoss > 0 ? avgWin / avgLoss : 0;

    // Calculate consistency ratio (percentage of positive months)
    const monthlyPnl = this.groupTradesByMonth(sortedTrades);
    const positiveMonths = Object.values(monthlyPnl).filter(pnl => pnl > 0).length;
    const totalMonths = Object.keys(monthlyPnl).length;
    const consistencyRatio = totalMonths > 0 ? (positiveMonths / totalMonths) * 100 : 0;

    return {
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      profitFactor,
      recoveryFactor,
      avgRiskReward,
      consistencyRatio
    };
  }

  /**
   * Helper methods
   */
  private getDateRange(period: string): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'yearly':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    return { startDate, endDate };
  }

  private getCacheTTL(period: string): number {
    switch (period) {
      case 'daily': return 300; // 5 minutes
      case 'weekly': return 900; // 15 minutes
      case 'monthly': return 1800; // 30 minutes
      case 'yearly': return 3600; // 1 hour
      default: return 900;
    }
  }

  private calculateTrend(trades: Trade[], period: 'week' | 'month'): 'up' | 'down' | 'neutral' {
    const days = period === 'week' ? 7 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const recentTrades = trades.filter(t => t.entryTime >= cutoff);
    const previousTrades = trades.filter(t => t.entryTime < cutoff && t.entryTime >= new Date(cutoff.getTime() - days * 24 * 60 * 60 * 1000));
    
    const recentPnl = recentTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    const previousPnl = previousTrades.reduce((sum, t) => sum + (t.profit || 0), 0);
    
    if (recentPnl > previousPnl * 1.05) return 'up';
    if (recentPnl < previousPnl * 0.95) return 'down';
    return 'neutral';
  }

  private generateQuickInsights(trades: Trade[], stats: TradeStats): string[] {
    const insights: string[] = [];

    if (stats.winRate > 70) {
      insights.push(`Excellent win rate at ${stats.winRate.toFixed(1)}%`);
    } else if (stats.winRate < 40) {
      insights.push(`Win rate needs improvement at ${stats.winRate.toFixed(1)}%`);
    }

    if (stats.avgPnl > stats.avgStake * 0.7) {
      insights.push('Strong average profit per trade');
    }

    if (trades.length >= 100) {
      insights.push('Good sample size for reliable statistics');
    }

    const recentTrades = trades.slice(0, 10);
    const recentWinRate = recentTrades.filter(t => t.result === 'win').length / recentTrades.length * 100;
    if (recentWinRate > stats.winRate + 10) {
      insights.push('Recent performance is above average');
    }

    return insights.slice(0, 3); // Limit to 3 insights
  }

  private generateAlerts(trades: Trade[], stats: TradeStats): Array<{ type: 'warning' | 'info' | 'success'; message: string }> {
    const alerts: Array<{ type: 'warning' | 'info' | 'success'; message: string }> = [];

    if (stats.maxDrawdown > stats.avgStake * 10) {
      alerts.push({
        type: 'warning',
        message: 'High drawdown detected - consider risk management'
      });
    }

    const recentTrades = trades.slice(0, 5);
    const recentLosses = recentTrades.filter(t => t.result === 'loss').length;
    if (recentLosses >= 4) {
      alerts.push({
        type: 'warning',
        message: 'Recent losing streak - consider taking a break'
      });
    }

    if (stats.winRate > 70 && stats.totalTrades > 50) {
      alerts.push({
        type: 'success',
        message: 'Excellent performance - keep up the good work!'
      });
    }

    return alerts;
  }

  private calculateAssetStreaks(trades: Trade[]): { longestWin: number; longestLoss: number } {
    const sortedTrades = trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime());
    
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let longestWin = 0;
    let longestLoss = 0;

    sortedTrades.forEach(trade => {
      if (trade.result === 'win') {
        currentWinStreak++;
        currentLossStreak = 0;
        longestWin = Math.max(longestWin, currentWinStreak);
      } else if (trade.result === 'loss') {
        currentLossStreak++;
        currentWinStreak = 0;
        longestLoss = Math.max(longestLoss, currentLossStreak);
      }
    });

    return { longestWin, longestLoss };
  }

  private groupTradesByMonth(trades: Trade[]): { [month: string]: number } {
    const monthlyPnl: { [month: string]: number } = {};

    trades.forEach(trade => {
      const monthKey = trade.entryTime.toISOString().substring(0, 7); // YYYY-MM
      monthlyPnl[monthKey] = (monthlyPnl[monthKey] || 0) + (trade.profit || 0);
    });

    return monthlyPnl;
  }
}

export const analyticsService = new AnalyticsService();