import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Trade, TradeService } from './tradeService';
import { generateInsight, generateTradeCoach } from './openai';

const getDb = () => getFirestore();
const tradeService = new TradeService();

export interface PatternAnalysis {
  timeBasedPatterns: {
    bestPerformingHours: number[];
    worstPerformingHours: number[];
    bestPerformingDays: string[];
    worstPerformingDays: string[];
  };
  assetPerformance: {
    [asset: string]: {
      winRate: number;
      totalTrades: number;
      avgProfit: number;
      recommendation: 'keep' | 'avoid' | 'improve';
    };
  };
  behavioralPatterns: {
    averageTradeSize: number;
    stakeSizeConsistency: number; // 0-1 scale
    emotionalTrading: {
      revengeTrading: boolean;
      overtrading: boolean;
      undertrading: boolean;
    };
    streakBehavior: {
      winStreakMax: number;
      lossStreakMax: number;
      recoverabilityScore: number; // How well user recovers from losses
    };
  };
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  riskScore: number; // 0-100
  factors: {
    stakeSizeVariability: number;
    lossStreakTolerance: number;
    drawdownRecovery: number;
    diversification: number;
  };
  warnings: string[];
  recommendations: string[];
}

export interface PerformancePrediction {
  expectedWinRate: number;
  expectedMonthlyReturn: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  requiredChanges: string[];
  potentialUpside: number;
  maxDownside: number;
}

export interface ComprehensiveInsight {
  id: string;
  userId: string;
  type: 'comprehensive' | 'pattern' | 'risk' | 'prediction';
  title: string;
  summary: string;
  patternAnalysis: PatternAnalysis;
  riskAssessment: RiskAssessment;
  performancePrediction: PerformancePrediction;
  actionableInsights: string[];
  urgentWarnings: string[];
  timestamp: Date;
  metadata: {
    tradesAnalyzed: number;
    analysisDepth: 'basic' | 'advanced' | 'comprehensive';
    aiGenerated: boolean;
  };
}

export class AIInsightsService {
  /**
   * Generate comprehensive trading insights
   */
  async generateComprehensiveInsights(userId: string): Promise<ComprehensiveInsight> {
    try {
      logger.info('Starting comprehensive insight generation', { userId });
      
      // Get user's trade history (last 90 days for comprehensive analysis)
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const trades = await tradeService.getUserTrades(userId, {
        start: threeMonthsAgo,
        limit: 1000
      });

      if (trades.length < 10) {
        throw new Error('Insufficient trade data for comprehensive analysis (minimum 10 trades required)');
      }

      // Perform comprehensive analysis
      const patternAnalysis = await this.analyzePatterns(trades);
      const riskAssessment = await this.assessRisk(trades);
      const performancePrediction = await this.predictPerformance(trades, patternAnalysis);

      // Generate AI-powered insights
      const aiInsight = await this.generateAIInsight(userId, trades, patternAnalysis, riskAssessment);

      const comprehensiveInsight: ComprehensiveInsight = {
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        type: 'comprehensive',
        title: 'Análise Abrangente de Performance',
        summary: aiInsight.insight,
        patternAnalysis,
        riskAssessment,
        performancePrediction,
        actionableInsights: this.generateActionableInsights(patternAnalysis, riskAssessment, performancePrediction),
        urgentWarnings: this.generateUrgentWarnings(riskAssessment, trades),
        timestamp: new Date(),
        metadata: {
          tradesAnalyzed: trades.length,
          analysisDepth: trades.length > 100 ? 'comprehensive' : trades.length > 50 ? 'advanced' : 'basic',
          aiGenerated: true
        }
      };

      // Save insight to database
      await this.saveInsight(comprehensiveInsight);

      logger.info('Comprehensive insight generated successfully', { 
        userId, 
        tradesAnalyzed: trades.length,
        insightId: comprehensiveInsight.id 
      });

      return comprehensiveInsight;
    } catch (error) {
      logger.error('Error generating comprehensive insights:', error);
      throw error;
    }
  }

  /**
   * Analyze trading patterns
   */
  private async analyzePatterns(trades: Trade[]): Promise<PatternAnalysis> {
    try {
      // Time-based analysis
      const hourlyPerformance = new Map<number, { wins: number; total: number; profit: number }>();
      const dailyPerformance = new Map<string, { wins: number; total: number; profit: number }>();
      
      // Asset performance analysis
      const assetPerformance = new Map<string, { wins: number; total: number; profit: number }>();
      
      // Behavioral pattern data
      const stakeSizes = trades.map(t => t.amount);
      const profits = trades.map(t => t.profit);
      
      for (const trade of trades) {
        const hour = new Date(trade.entryTime).getHours();
        const day = new Date(trade.entryTime).toLocaleDateString('en', { weekday: 'long' });
        const asset = trade.asset;
        
        // Time-based tracking
        if (!hourlyPerformance.has(hour)) {
          hourlyPerformance.set(hour, { wins: 0, total: 0, profit: 0 });
        }
        if (!dailyPerformance.has(day)) {
          dailyPerformance.set(day, { wins: 0, total: 0, profit: 0 });
        }
        if (!assetPerformance.has(asset)) {
          assetPerformance.set(asset, { wins: 0, total: 0, profit: 0 });
        }
        
        const isWin = trade.result === 'win';
        
        hourlyPerformance.get(hour)!.total++;
        dailyPerformance.get(day)!.total++;
        assetPerformance.get(asset)!.total++;
        
        if (isWin) {
          hourlyPerformance.get(hour)!.wins++;
          dailyPerformance.get(day)!.wins++;
          assetPerformance.get(asset)!.wins++;
        }
        
        hourlyPerformance.get(hour)!.profit += trade.profit;
        dailyPerformance.get(day)!.profit += trade.profit;
        assetPerformance.get(asset)!.profit += trade.profit;
      }

      // Calculate best/worst performing times
      const bestHours = Array.from(hourlyPerformance.entries())
        .filter(([_, data]) => data.total >= 5) // Minimum trades for statistical significance
        .sort(([_, a], [__, b]) => (b.wins / b.total) - (a.wins / a.total))
        .slice(0, 3)
        .map(([hour]) => hour);

      const worstHours = Array.from(hourlyPerformance.entries())
        .filter(([_, data]) => data.total >= 5)
        .sort(([_, a], [__, b]) => (a.wins / a.total) - (b.wins / b.total))
        .slice(0, 3)
        .map(([hour]) => hour);

      const bestDays = Array.from(dailyPerformance.entries())
        .filter(([_, data]) => data.total >= 3)
        .sort(([_, a], [__, b]) => (b.wins / b.total) - (a.wins / a.total))
        .slice(0, 3)
        .map(([day]) => day);

      const worstDays = Array.from(dailyPerformance.entries())
        .filter(([_, data]) => data.total >= 3)
        .sort(([_, a], [__, b]) => (a.wins / a.total) - (b.wins / b.total))
        .slice(0, 3)
        .map(([day]) => day);

      // Asset performance analysis
      const assetAnalysis: { [asset: string]: any } = {};
      for (const [asset, data] of assetPerformance.entries()) {
        if (data.total >= 5) {
          const winRate = data.wins / data.total;
          const avgProfit = data.profit / data.total;
          
          let recommendation: 'keep' | 'avoid' | 'improve';
          if (winRate > 0.6 && avgProfit > 0) {
            recommendation = 'keep';
          } else if (winRate < 0.4 || avgProfit < -10) {
            recommendation = 'avoid';
          } else {
            recommendation = 'improve';
          }
          
          assetAnalysis[asset] = {
            winRate,
            totalTrades: data.total,
            avgProfit,
            recommendation
          };
        }
      }

      // Behavioral pattern analysis
      const avgStakeSize = stakeSizes.reduce((a, b) => a + b, 0) / stakeSizes.length;
      const stakeStdDev = Math.sqrt(
        stakeSizes.reduce((sq, stake) => sq + Math.pow(stake - avgStakeSize, 2), 0) / stakeSizes.length
      );
      const stakeSizeConsistency = Math.max(0, 1 - (stakeStdDev / avgStakeSize));

      // Streak analysis
      let currentWinStreak = 0;
      let currentLossStreak = 0;
      let maxWinStreak = 0;
      let maxLossStreak = 0;
      let recoveryScore = 0;
      
      for (let i = 0; i < trades.length; i++) {
        const trade = trades[i];
        if (trade.result === 'win') {
          currentWinStreak++;
          currentLossStreak = 0;
          maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else {
          currentLossStreak++;
          currentWinStreak = 0;
          maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
          
          // Check recovery after losses
          if (i < trades.length - 1 && trades[i + 1].result === 'win') {
            recoveryScore++;
          }
        }
      }

      const recoverabilityScore = recoveryScore / Math.max(1, trades.filter(t => t.result === 'loss').length);

      // Emotional trading detection
      const revengeTrading = this.detectRevengeTrading(trades);
      const overtrading = this.detectOvertrading(trades);
      const undertrading = this.detectUndertrading(trades);

      return {
        timeBasedPatterns: {
          bestPerformingHours: bestHours,
          worstPerformingHours: worstHours,
          bestPerformingDays: bestDays,
          worstPerformingDays: worstDays
        },
        assetPerformance: assetAnalysis,
        behavioralPatterns: {
          averageTradeSize: avgStakeSize,
          stakeSizeConsistency,
          emotionalTrading: {
            revengeTrading,
            overtrading,
            undertrading
          },
          streakBehavior: {
            winStreakMax: maxWinStreak,
            lossStreakMax: maxLossStreak,
            recoverabilityScore
          }
        }
      };
    } catch (error) {
      logger.error('Error analyzing patterns:', error);
      throw error;
    }
  }

  /**
   * Assess trading risk
   */
  private async assessRisk(trades: Trade[]): Promise<RiskAssessment> {
    try {
      const stakes = trades.map(t => t.amount);
      const profits = trades.map(t => t.profit);
      
      // Calculate risk factors
      const avgStake = stakes.reduce((a, b) => a + b, 0) / stakes.length;
      const stakeStdDev = Math.sqrt(
        stakes.reduce((sq, stake) => sq + Math.pow(stake - avgStake, 2), 0) / stakes.length
      );
      const stakeSizeVariability = (stakeStdDev / avgStake) * 100;

      // Loss streak tolerance
      let maxConsecutiveLosses = 0;
      let currentStreak = 0;
      for (const trade of trades) {
        if (trade.result === 'loss') {
          currentStreak++;
          maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentStreak);
        } else {
          currentStreak = 0;
        }
      }
      const lossStreakTolerance = Math.min(100, (10 - maxConsecutiveLosses) * 10);

      // Drawdown recovery
      let maxDrawdown = 0;
      let runningTotal = 0;
      let peak = 0;
      for (const trade of trades) {
        runningTotal += trade.profit;
        if (runningTotal > peak) peak = runningTotal;
        const drawdown = peak - runningTotal;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      }
      const drawdownRecovery = Math.max(0, 100 - (maxDrawdown / avgStake * 10));

      // Asset diversification
      const uniqueAssets = new Set(trades.map(t => t.asset)).size;
      const diversification = Math.min(100, uniqueAssets * 10);

      // Calculate overall risk score
      const factors = {
        stakeSizeVariability: Math.max(0, 100 - stakeSizeVariability),
        lossStreakTolerance,
        drawdownRecovery,
        diversification
      };

      const riskScore = (
        factors.stakeSizeVariability * 0.3 +
        factors.lossStreakTolerance * 0.3 +
        factors.drawdownRecovery * 0.25 +
        factors.diversification * 0.15
      );

      let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
      if (riskScore >= 80) riskLevel = 'low';
      else if (riskScore >= 60) riskLevel = 'medium';
      else if (riskScore >= 40) riskLevel = 'high';
      else riskLevel = 'extreme';

      // Generate warnings and recommendations
      const warnings = this.generateRiskWarnings(factors, maxConsecutiveLosses, stakeSizeVariability);
      const recommendations = this.generateRiskRecommendations(factors, riskLevel);

      return {
        riskLevel,
        riskScore: Math.round(riskScore),
        factors,
        warnings,
        recommendations
      };
    } catch (error) {
      logger.error('Error assessing risk:', error);
      throw error;
    }
  }

  /**
   * Predict future performance
   */
  private async predictPerformance(trades: Trade[], patterns: PatternAnalysis): Promise<PerformancePrediction> {
    try {
      const recentTrades = trades.slice(-30); // Last 30 trades for trend analysis
      const winRate = recentTrades.filter(t => t.result === 'win').length / recentTrades.length;
      const avgProfit = recentTrades.reduce((sum, t) => sum + t.profit, 0) / recentTrades.length;
      const avgStake = recentTrades.reduce((sum, t) => sum + t.amount, 0) / recentTrades.length;

      // Expected win rate based on patterns and consistency
      let expectedWinRate = winRate;
      if (patterns.behavioralPatterns.stakeSizeConsistency > 0.8) {
        expectedWinRate += 0.05; // Consistency bonus
      }
      if (patterns.behavioralPatterns.emotionalTrading.revengeTrading) {
        expectedWinRate -= 0.1; // Revenge trading penalty
      }
      if (patterns.behavioralPatterns.emotionalTrading.overtrading) {
        expectedWinRate -= 0.08; // Overtrading penalty
      }

      expectedWinRate = Math.max(0.2, Math.min(0.8, expectedWinRate));

      // Monthly return prediction
      const tradesPerMonth = (trades.length / 3) * 1.1; // Assuming 3 months of data, slight growth
      const expectedMonthlyReturn = tradesPerMonth * avgProfit * expectedWinRate;

      // Confidence intervals
      const standardError = Math.sqrt(winRate * (1 - winRate) / recentTrades.length);
      const confidenceInterval = {
        lower: Math.max(0, expectedWinRate - 1.96 * standardError),
        upper: Math.min(1, expectedWinRate + 1.96 * standardError)
      };

      // Required changes for improvement
      const requiredChanges = [];
      if (patterns.behavioralPatterns.stakeSizeConsistency < 0.7) {
        requiredChanges.push('Padronizar tamanho das apostas');
      }
      if (patterns.behavioralPatterns.emotionalTrading.revengeTrading) {
        requiredChanges.push('Eliminar trading por vingança');
      }
      if (Object.values(patterns.assetPerformance).some(p => p.recommendation === 'avoid')) {
        requiredChanges.push('Evitar ativos de baixa performance');
      }
      if (patterns.timeBasedPatterns.worstPerformingHours.length > 0) {
        requiredChanges.push('Evitar horários de baixa performance');
      }

      // Potential upside/downside
      const potentialUpside = expectedMonthlyReturn * 1.5; // Optimistic scenario
      const maxDownside = expectedMonthlyReturn * -0.5; // Conservative downside

      return {
        expectedWinRate: Math.round(expectedWinRate * 100) / 100,
        expectedMonthlyReturn: Math.round(expectedMonthlyReturn * 100) / 100,
        confidenceInterval: {
          lower: Math.round(confidenceInterval.lower * 100) / 100,
          upper: Math.round(confidenceInterval.upper * 100) / 100
        },
        requiredChanges,
        potentialUpside: Math.round(potentialUpside * 100) / 100,
        maxDownside: Math.round(maxDownside * 100) / 100
      };
    } catch (error) {
      logger.error('Error predicting performance:', error);
      throw error;
    }
  }

  /**
   * Generate AI-powered insight using OpenAI
   */
  private async generateAIInsight(
    userId: string, 
    trades: Trade[], 
    patterns: PatternAnalysis, 
    risk: RiskAssessment
  ): Promise<any> {
    try {
      const winRate = trades.filter(t => t.result === 'win').length / trades.length;
      const avgStake = trades.reduce((sum, t) => sum + t.amount, 0) / trades.length;
      const maxLossStreak = patterns.behavioralPatterns.streakBehavior.lossStreakMax;

      return await generateInsight({
        uid: userId,
        kpi: {
          winRate: Math.round(winRate * 100),
          avgStake,
          lossStreak: maxLossStreak
        },
        ruleBrokenMost: risk.warnings[0] || 'Nenhuma violação crítica detectada'
      });
    } catch (error) {
      logger.error('Error generating AI insight:', error);
      // Return fallback insight
      return {
        insight: 'Análise de performance baseada em padrões identificados nos seus dados de trading.',
        kpi: {
          winRate: Math.round((trades.filter(t => t.result === 'win').length / trades.length) * 100),
          lossStreak: patterns.behavioralPatterns.streakBehavior.lossStreakMax
        },
        acao: 'Continue seguindo seu plano de trading e mantendo disciplina.'
      };
    }
  }

  /**
   * Generate actionable insights
   */
  private generateActionableInsights(
    patterns: PatternAnalysis, 
    risk: RiskAssessment, 
    prediction: PerformancePrediction
  ): string[] {
    const insights = [];

    // Time-based insights
    if (patterns.timeBasedPatterns.bestPerformingHours.length > 0) {
      insights.push(
        `Concentre suas operações entre ${patterns.timeBasedPatterns.bestPerformingHours[0]}h-${patterns.timeBasedPatterns.bestPerformingHours[patterns.timeBasedPatterns.bestPerformingHours.length - 1]}h para melhor performance`
      );
    }

    // Asset insights
    const avoidAssets = Object.entries(patterns.assetPerformance)
      .filter(([_, data]) => data.recommendation === 'avoid')
      .map(([asset]) => asset);
    
    if (avoidAssets.length > 0) {
      insights.push(`Evite operar ${avoidAssets.slice(0, 3).join(', ')} devido à baixa performance histórica`);
    }

    // Risk insights
    if (risk.riskLevel === 'high' || risk.riskLevel === 'extreme') {
      insights.push('Implemente gestão de risco mais rigorosa para reduzir exposição');
    }

    // Behavioral insights
    if (patterns.behavioralPatterns.emotionalTrading.revengeTrading) {
      insights.push('Estabeleça regras claras para parar de operar após perdas consecutivas');
    }

    if (patterns.behavioralPatterns.stakeSizeConsistency < 0.7) {
      insights.push('Padronize o tamanho das suas apostas para melhor consistência');
    }

    // Performance prediction insights
    if (prediction.expectedWinRate < 0.5) {
      insights.push('Revise sua estratégia - taxa de vitórias projetada abaixo de 50%');
    }

    return insights.slice(0, 5); // Limit to 5 most important insights
  }

  /**
   * Generate urgent warnings
   */
  private generateUrgentWarnings(risk: RiskAssessment, trades: Trade[]): string[] {
    const warnings = [];

    if (risk.riskLevel === 'extreme') {
      warnings.push('⚠️ RISCO EXTREMO: Suspenda operações e revise sua estratégia imediatamente');
    }

    const recentLosses = trades.slice(-5).filter(t => t.result === 'loss').length;
    if (recentLosses >= 4) {
      warnings.push('⚠️ ALERTA: 4+ perdas nas últimas 5 operações - considere pausa');
    }

    const totalLoss = trades.slice(-10).reduce((sum, t) => sum + Math.min(0, t.profit), 0);
    if (Math.abs(totalLoss) > trades.slice(-10).reduce((sum, t) => sum + t.amount, 0) * 0.3) {
      warnings.push('⚠️ DRAWDOWN ALTO: Perdas recentes excedem 30% do capital operado');
    }

    return warnings;
  }

  // Helper methods for emotional trading detection
  private detectRevengeTrading(trades: Trade[]): boolean {
    // Check if stake sizes increase significantly after losses
    for (let i = 1; i < trades.length; i++) {
      const prevTrade = trades[i - 1];
      const currentTrade = trades[i];
      
      if (prevTrade.result === 'loss' && currentTrade.amount > prevTrade.amount * 1.5) {
        return true;
      }
    }
    return false;
  }

  private detectOvertrading(trades: Trade[]): boolean {
    // Check for excessive trading frequency
    const tradesPerDay = new Map<string, number>();
    
    for (const trade of trades) {
      const day = new Date(trade.entryTime).toDateString();
      tradesPerDay.set(day, (tradesPerDay.get(day) || 0) + 1);
    }
    
    const maxTradesInDay = Math.max(...Array.from(tradesPerDay.values()));
    return maxTradesInDay > 20; // More than 20 trades in a single day
  }

  private detectUndertrading(trades: Trade[]): boolean {
    // Check if trading frequency is too low
    const daysBetweenTrades = [];
    
    for (let i = 1; i < trades.length; i++) {
      const prevDate = new Date(trades[i - 1].entryTime);
      const currentDate = new Date(trades[i].entryTime);
      const daysDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
      daysBetweenTrades.push(daysDiff);
    }
    
    const avgDaysBetween = daysBetweenTrades.reduce((a, b) => a + b, 0) / daysBetweenTrades.length;
    return avgDaysBetween > 7; // More than 7 days average between trades
  }

  private generateRiskWarnings(factors: any, maxLosses: number, stakeVariability: number): string[] {
    const warnings = [];
    
    if (maxLosses > 8) {
      warnings.push('Sequência de perdas excessiva detectada');
    }
    if (stakeVariability > 50) {
      warnings.push('Variação de apostas muito alta - risco de gestão inadequada');
    }
    if (factors.diversification < 30) {
      warnings.push('Portfólio pouco diversificado - concentração de risco');
    }
    
    return warnings;
  }

  private generateRiskRecommendations(factors: any, riskLevel: string): string[] {
    const recommendations = [];
    
    if (riskLevel !== 'low') {
      recommendations.push('Implemente stop-loss mais rigoroso');
      recommendations.push('Reduza o tamanho das posições');
    }
    if (factors.diversification < 50) {
      recommendations.push('Diversifique entre mais ativos');
    }
    if (factors.stakeSizeVariability < 70) {
      recommendations.push('Padronize o tamanho das apostas');
    }
    
    return recommendations;
  }

  /**
   * Save insight to database
   */
  private async saveInsight(insight: ComprehensiveInsight): Promise<void> {
    try {
      const db = getDb();
      await db.collection('insights')
        .doc(insight.userId)
        .collection('insights')
        .doc(insight.id)
        .set({
          ...insight,
          timestamp: insight.timestamp.toISOString()
        });
    } catch (error) {
      logger.error('Error saving insight:', error);
      throw error;
    }
  }

  /**
   * Get user's insights with filtering
   */
  async getInsights(
    userId: string, 
    options: {
      type?: 'comprehensive' | 'pattern' | 'risk' | 'prediction';
      limit?: number;
      since?: Date;
    } = {}
  ): Promise<ComprehensiveInsight[]> {
    try {
      const db = getDb();
      let query = db.collection('insights').doc(userId).collection('insights') as any;
      
      if (options.type) {
        query = query.where('type', '==', options.type);
      }
      
      if (options.since) {
        query = query.where('timestamp', '>=', options.since.toISOString());
      }
      
      const snapshot = await query
        .orderBy('timestamp', 'desc')
        .limit(options.limit || 10)
        .get();
      
      return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          ...data,
          timestamp: new Date(data.timestamp)
        } as ComprehensiveInsight;
      });
    } catch (error) {
      logger.error('Error getting insights:', error);
      throw error;
    }
  }
}

export const aiInsightsService = new AIInsightsService();