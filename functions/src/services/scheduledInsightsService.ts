import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { aiInsightsService } from './aiInsightsService';
import { coachingService } from './coachingService';
import { TradeService } from './tradeService';

const getDb = () => getFirestore();
const tradeService = new TradeService();

export interface ScheduledInsightConfig {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  enabled: boolean;
  lastGenerated?: Date;
  nextScheduled?: Date;
  timezone: string;
}

export interface WeeklyInsightSummary {
  id: string;
  userId: string;
  period: {
    start: Date;
    end: Date;
    week: number;
    year: number;
  };
  tradingActivity: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgStake: number;
    bestDay: string;
    worstDay: string;
  };
  keyInsights: string[];
  recommendations: string[];
  milestonesAchieved: string[];
  warningsFlags: string[];
  aiGenerated: boolean;
  timestamp: Date;
}

export interface MonthlyReport {
  id: string;
  userId: string;
  period: {
    start: Date;
    end: Date;
    month: number;
    year: number;
  };
  performance: {
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgMonthlyReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    consistencyScore: number;
  };
  achievements: {
    milestones: string[];
    improvements: string[];
    strengths: string[];
  };
  areasForImprovement: {
    weaknesses: string[];
    recommendations: string[];
    actionPlan: string[];
  };
  forecast: {
    expectedNextMonthWinRate: number;
    projectedReturn: number;
    confidenceLevel: number;
  };
  timestamp: Date;
}

export class ScheduledInsightsService {
  /**
   * Generate weekly insights for all active users
   */
  async generateWeeklyInsightsForAllUsers(): Promise<void> {
    try {
      logger.info('Starting weekly insights generation for all users');
      
      const db = getDb();
      
      // Get all users with active subscriptions or recent activity
      const usersSnapshot = await db.collection('users')
        .where('plan', 'in', ['pro', 'free']) // Active plans
        .get();

      const batchSize = 10; // Process users in batches to avoid timeouts
      const users = usersSnapshot.docs;
      
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        const promises = batch.map(userDoc => this.generateWeeklyInsightForUser(userDoc.id));
        
        await Promise.allSettled(promises);
        
        // Add delay between batches to avoid rate limiting
        if (i + batchSize < users.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info(`Weekly insights generation completed for ${users.length} users`);
    } catch (error) {
      logger.error('Error generating weekly insights for all users:', error);
    }
  }

  /**
   * Generate weekly insight for a specific user
   */
  async generateWeeklyInsightForUser(userId: string): Promise<WeeklyInsightSummary | null> {
    try {
      // Get user's trading data for the past week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const trades = await tradeService.getUserTrades(userId, {
        start: weekAgo,
        limit: 500
      });

      // Skip if no trading activity
      if (trades.length === 0) {
        logger.info(`No trading activity for user ${userId} in the past week`);
        return null;
      }

      // Calculate weekly performance metrics
      const weeklyMetrics = this.calculateWeeklyMetrics(trades);
      
      // Generate comprehensive insights
      const comprehensiveInsight = await aiInsightsService.generateComprehensiveInsights(userId);
      
      // Extract key insights and recommendations
      const keyInsights = this.extractKeyInsights(comprehensiveInsight);
      const recommendations = this.extractRecommendations(comprehensiveInsight);
      
      // Check for milestones
      const milestones = await this.checkWeeklyMilestones(userId, weeklyMetrics, trades);
      
      // Identify warning flags
      const warningFlags = this.identifyWarningFlags(comprehensiveInsight);

      const weekNumber = this.getWeekNumber(new Date());
      const currentYear = new Date().getFullYear();

      const weeklySummary: WeeklyInsightSummary = {
        id: `weekly_${userId}_${currentYear}_${weekNumber}`,
        userId,
        period: {
          start: weekAgo,
          end: new Date(),
          week: weekNumber,
          year: currentYear
        },
        tradingActivity: weeklyMetrics,
        keyInsights,
        recommendations,
        milestonesAchieved: milestones,
        warningsFlags: warningFlags,
        aiGenerated: true,
        timestamp: new Date()
      };

      // Save weekly summary
      await this.saveWeeklySummary(weeklySummary);

      // Trigger coaching if warning flags exist
      if (warningFlags.length > 0) {
        await coachingService.providePersonalizedCoaching(userId, undefined, 'low_performance');
      }

      // Celebrate milestones if any
      for (const milestone of milestones) {
        await coachingService.celebrateMilestone(userId, {
          type: 'consistency',
          value: weeklyMetrics.winRate,
          message: milestone
        });
      }

      logger.info(`Weekly insight generated for user ${userId}`, {
        trades: trades.length,
        winRate: weeklyMetrics.winRate,
        milestones: milestones.length
      });

      return weeklySummary;
    } catch (error) {
      logger.error(`Error generating weekly insight for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Generate monthly reports for all users
   */
  async generateMonthlyReportsForAllUsers(): Promise<void> {
    try {
      logger.info('Starting monthly reports generation for all users');
      
      const db = getDb();
      const usersSnapshot = await db.collection('users')
        .where('plan', 'in', ['pro', 'free'])
        .get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          await this.generateMonthlyReportForUser(userDoc.id);
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          logger.error(`Error generating monthly report for user ${userDoc.id}:`, error);
        }
      }

      logger.info(`Monthly reports generation completed for ${usersSnapshot.docs.length} users`);
    } catch (error) {
      logger.error('Error generating monthly reports for all users:', error);
    }
  }

  /**
   * Generate monthly report for a specific user
   */
  async generateMonthlyReportForUser(userId: string): Promise<MonthlyReport | null> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get trades for the entire last month
      const trades = await tradeService.getUserTrades(userId, {
        start: lastMonth,
        end: thisMonth,
        limit: 1000
      });

      if (trades.length < 10) {
        logger.info(`Insufficient trading activity for user ${userId} monthly report`);
        return null;
      }

      // Calculate comprehensive monthly metrics
      const monthlyMetrics = this.calculateMonthlyMetrics(trades);
      
      // Generate insights and recommendations
      const insights = await aiInsightsService.generateComprehensiveInsights(userId);
      
      // Identify achievements and improvements
      const achievements = await this.identifyMonthlyAchievements(userId, monthlyMetrics, trades);
      const improvements = this.identifyAreasForImprovement(insights);
      
      // Generate forecast for next month
      const forecast = this.generateMonthlyForecast(monthlyMetrics, insights.performancePrediction);

      const monthlyReport: MonthlyReport = {
        id: `monthly_${userId}_${lastMonth.getFullYear()}_${lastMonth.getMonth() + 1}`,
        userId,
        period: {
          start: lastMonth,
          end: thisMonth,
          month: lastMonth.getMonth() + 1,
          year: lastMonth.getFullYear()
        },
        performance: monthlyMetrics,
        achievements,
        areasForImprovement: improvements,
        forecast,
        timestamp: new Date()
      };

      // Save monthly report
      await this.saveMonthlyReport(monthlyReport);

      logger.info(`Monthly report generated for user ${userId}`, {
        period: `${lastMonth.getFullYear()}-${lastMonth.getMonth() + 1}`,
        trades: trades.length,
        winRate: monthlyMetrics.winRate
      });

      return monthlyReport;
    } catch (error) {
      logger.error(`Error generating monthly report for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Process scheduled coaching interventions
   */
  async processScheduledCoaching(): Promise<void> {
    try {
      logger.info('Processing scheduled coaching interventions');
      
      const db = getDb();
      const now = new Date();
      
      // Get all scheduled coaching sessions that are due
      const scheduledSnapshot = await db.collection('scheduled_coaching')
        .where('scheduledFor', '<=', now.toISOString())
        .limit(50)
        .get();

      for (const doc of scheduledSnapshot.docs) {
        const data = doc.data();
        
        try {
          // Provide follow-up coaching
          await coachingService.monitorAndCoach(data.userId);
          
          // Remove from scheduled queue
          await doc.ref.delete();
          
          logger.info(`Processed scheduled coaching for user ${data.userId}`);
        } catch (error) {
          logger.error(`Error processing scheduled coaching for user ${data.userId}:`, error);
        }
      }

      logger.info(`Processed ${scheduledSnapshot.docs.length} scheduled coaching sessions`);
    } catch (error) {
      logger.error('Error processing scheduled coaching:', error);
    }
  }

  /**
   * Monitor users for automatic interventions
   */
  async monitorUsersForInterventions(): Promise<void> {
    try {
      logger.info('Monitoring users for automatic interventions');
      
      const db = getDb();
      const usersSnapshot = await db.collection('users').limit(100).get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          // Check if user needs intervention
          const intervention = await coachingService.monitorAndCoach(userDoc.id);
          
          if (intervention) {
            logger.info(`Automatic intervention triggered for user ${userDoc.id}`, {
              type: intervention.sessionType,
              urgency: intervention.urgency
            });
          }
        } catch (error) {
          logger.error(`Error monitoring user ${userDoc.id}:`, error);
        }
      }

      logger.info('User monitoring completed');
    } catch (error) {
      logger.error('Error monitoring users for interventions:', error);
    }
  }

  // Helper methods
  private calculateWeeklyMetrics(trades: any[]): WeeklyInsightSummary['tradingActivity'] {
    const wins = trades.filter(t => t.result === 'win').length;
    const winRate = trades.length > 0 ? wins / trades.length : 0;
    const totalPnL = trades.reduce((sum, t) => sum + t.profit, 0);
    const avgStake = trades.reduce((sum, t) => sum + t.amount, 0) / trades.length;

    // Find best and worst days
    const dailyPnL = new Map<string, number>();
    trades.forEach(trade => {
      const day = new Date(trade.entryTime).toDateString();
      dailyPnL.set(day, (dailyPnL.get(day) || 0) + trade.profit);
    });

    const sortedDays = Array.from(dailyPnL.entries()).sort(([, a], [, b]) => b - a);
    const bestDay = sortedDays[0]?.[0] || '';
    const worstDay = sortedDays[sortedDays.length - 1]?.[0] || '';

    return {
      totalTrades: trades.length,
      winRate: Math.round(winRate * 100) / 100,
      totalPnL: Math.round(totalPnL * 100) / 100,
      avgStake: Math.round(avgStake * 100) / 100,
      bestDay,
      worstDay
    };
  }

  private calculateMonthlyMetrics(trades: any[]): MonthlyReport['performance'] {
    const wins = trades.filter(t => t.result === 'win').length;
    const winRate = wins / trades.length;
    const totalPnL = trades.reduce((sum, t) => sum + t.profit, 0);
    const avgStake = trades.reduce((sum, t) => sum + t.amount, 0) / trades.length;

    // Calculate max drawdown
    let maxDrawdown = 0;
    let runningTotal = 0;
    let peak = 0;
    
    for (const trade of trades.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())) {
      runningTotal += trade.profit;
      if (runningTotal > peak) peak = runningTotal;
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Calculate Sharpe ratio (simplified)
    const dailyReturns = this.calculateDailyReturns(trades);
    const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const dailyStdDev = Math.sqrt(
      dailyReturns.reduce((sq, ret) => sq + Math.pow(ret - avgDailyReturn, 2), 0) / dailyReturns.length
    );
    const sharpeRatio = dailyStdDev > 0 ? avgDailyReturn / dailyStdDev : 0;

    // Calculate consistency score
    const weeklyReturns = this.calculateWeeklyReturns(trades);
    const positiveWeeks = weeklyReturns.filter(r => r > 0).length;
    const consistencyScore = weeklyReturns.length > 0 ? positiveWeeks / weeklyReturns.length : 0;

    return {
      totalTrades: trades.length,
      winRate,
      totalPnL,
      avgMonthlyReturn: totalPnL,
      maxDrawdown,
      sharpeRatio,
      consistencyScore
    };
  }

  private calculateDailyReturns(trades: any[]): number[] {
    const dailyPnL = new Map<string, number>();
    
    trades.forEach(trade => {
      const day = new Date(trade.entryTime).toDateString();
      dailyPnL.set(day, (dailyPnL.get(day) || 0) + trade.profit);
    });

    return Array.from(dailyPnL.values());
  }

  private calculateWeeklyReturns(trades: any[]): number[] {
    const weeklyPnL = new Map<string, number>();
    
    trades.forEach(trade => {
      const week = this.getWeekKey(new Date(trade.entryTime));
      weeklyPnL.set(week, (weeklyPnL.get(week) || 0) + trade.profit);
    });

    return Array.from(weeklyPnL.values());
  }

  private getWeekKey(date: Date): string {
    const year = date.getFullYear();
    const week = this.getWeekNumber(date);
    return `${year}-W${week}`;
  }

  private getWeekNumber(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
  }

  private extractKeyInsights(insight: any): string[] {
    const insights = [];
    
    if (insight.actionableInsights && insight.actionableInsights.length > 0) {
      insights.push(...insight.actionableInsights.slice(0, 3));
    }
    
    if (insight.summary) {
      insights.push(insight.summary.substring(0, 200));
    }

    return insights;
  }

  private extractRecommendations(insight: any): string[] {
    const recommendations = [];
    
    if (insight.riskAssessment?.recommendations) {
      recommendations.push(...insight.riskAssessment.recommendations.slice(0, 3));
    }
    
    if (insight.performancePrediction?.requiredChanges) {
      recommendations.push(...insight.performancePrediction.requiredChanges.slice(0, 2));
    }

    return recommendations;
  }

  private async checkWeeklyMilestones(userId: string, metrics: any, trades: any[]): Promise<string[]> {
    const milestones = [];
    
    // Win rate milestones
    if (metrics.winRate >= 0.7) {
      milestones.push('Taxa de vitórias acima de 70% nesta semana!');
    } else if (metrics.winRate >= 0.6) {
      milestones.push('Consistência excelente com 60%+ de vitórias');
    }

    // Profit milestones
    if (metrics.totalPnL > 100) {
      milestones.push('Mais de R$ 100 de lucro na semana');
    }

    // Consistency milestones
    if (trades.length >= 20 && metrics.winRate > 0.5) {
      milestones.push('Volume alto com resultados positivos');
    }

    // Recovery milestone
    const recentLosses = trades.slice(0, 5).filter(t => t.result === 'loss').length;
    if (recentLosses <= 1 && trades.length >= 10) {
      milestones.push('Excelente recuperação - mantendo consistência');
    }

    return milestones;
  }

  private identifyWarningFlags(insight: any): string[] {
    const warnings = [];
    
    if (insight.urgentWarnings && insight.urgentWarnings.length > 0) {
      warnings.push(...insight.urgentWarnings);
    }
    
    if (insight.riskAssessment?.riskLevel === 'high' || insight.riskAssessment?.riskLevel === 'extreme') {
      warnings.push('Nível de risco elevado detectado');
    }

    return warnings;
  }

  private async identifyMonthlyAchievements(userId: string, metrics: any, trades: any[]): Promise<MonthlyReport['achievements']> {
    const milestones = [];
    const improvements = [];
    const strengths = [];

    // Milestones
    if (metrics.winRate >= 0.65) {
      milestones.push('Taxa de vitórias consistente acima de 65%');
    }
    if (metrics.totalPnL > 500) {
      milestones.push('Lucro mensal superior a R$ 500');
    }
    if (metrics.consistencyScore > 0.7) {
      milestones.push('Alta consistência semanal');
    }

    // Compare with previous month to identify improvements
    // This would require historical data comparison
    improvements.push('Análise de melhoria baseada em comparação histórica');

    // Identify strengths
    if (metrics.maxDrawdown < metrics.avgMonthlyReturn * 0.2) {
      strengths.push('Excelente controle de drawdown');
    }
    if (metrics.sharpeRatio > 1.0) {
      strengths.push('Boa relação risco-retorno');
    }

    return {
      milestones,
      improvements,
      strengths
    };
  }

  private identifyAreasForImprovement(insight: any): MonthlyReport['areasForImprovement'] {
    const weaknesses = [];
    const recommendations = [];
    const actionPlan = [];

    if (insight.riskAssessment?.warnings) {
      weaknesses.push(...insight.riskAssessment.warnings.slice(0, 3));
    }

    if (insight.riskAssessment?.recommendations) {
      recommendations.push(...insight.riskAssessment.recommendations.slice(0, 3));
    }

    if (insight.actionableInsights) {
      actionPlan.push(...insight.actionableInsights.slice(0, 3));
    }

    return {
      weaknesses,
      recommendations,
      actionPlan
    };
  }

  private generateMonthlyForecast(metrics: any, prediction: any): MonthlyReport['forecast'] {
    return {
      expectedNextMonthWinRate: prediction?.expectedWinRate || metrics.winRate,
      projectedReturn: prediction?.expectedMonthlyReturn || metrics.totalPnL * 1.1,
      confidenceLevel: prediction?.confidenceInterval?.upper || 0.8
    };
  }

  private async saveWeeklySummary(summary: WeeklyInsightSummary): Promise<void> {
    const db = getDb();
    await db.collection('weekly_insights')
      .doc(summary.userId)
      .collection('insights')
      .doc(summary.id)
      .set({
        ...summary,
        period: {
          ...summary.period,
          start: summary.period.start.toISOString(),
          end: summary.period.end.toISOString()
        },
        timestamp: summary.timestamp.toISOString()
      });
  }

  private async saveMonthlyReport(report: MonthlyReport): Promise<void> {
    const db = getDb();
    await db.collection('monthly_reports')
      .doc(report.userId)
      .collection('reports')
      .doc(report.id)
      .set({
        ...report,
        period: {
          ...report.period,
          start: report.period.start.toISOString(),
          end: report.period.end.toISOString()
        },
        timestamp: report.timestamp.toISOString()
      });
  }
}

export const scheduledInsightsService = new ScheduledInsightsService();

// Firebase Cloud Functions for scheduling
export const generateWeeklyInsights = onSchedule('0 8 * * 1', async (event) => {
  // Runs every Monday at 8 AM
  await scheduledInsightsService.generateWeeklyInsightsForAllUsers();
});

export const generateMonthlyReports = onSchedule('0 9 1 * *', async (event) => {
  // Runs on the 1st day of every month at 9 AM
  await scheduledInsightsService.generateMonthlyReportsForAllUsers();
});

export const processScheduledCoaching = onSchedule('0 */6 * * *', async (event) => {
  // Runs every 6 hours
  await scheduledInsightsService.processScheduledCoaching();
});

export const monitorUsersDaily = onSchedule('0 18 * * *', async (event) => {
  // Runs daily at 6 PM
  await scheduledInsightsService.monitorUsersForInterventions();
});