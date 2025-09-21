import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { generateTradeCoach } from './openai';
import { TradeService } from './tradeService';
import { aiInsightsService } from './aiInsightsService';

const getDb = () => getFirestore();
const tradeService = new TradeService();

export interface CoachingSession {
  id: string;
  userId: string;
  sessionType: 'motivational' | 'technical' | 'psychological' | 'strategic';
  trigger: 'loss_streak' | 'low_performance' | 'emotional_state' | 'user_request' | 'milestone';
  situation: string;
  message: string;
  quote: string;
  actionPlan: string[];
  followUpActions: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata: {
    tradesAnalyzed: number;
    currentWinRate: number;
    recentLossStreak: number;
    emotionalState: 'calm' | 'frustrated' | 'confident' | 'anxious' | 'desperate';
    aiGenerated: boolean;
  };
}

export interface TradingMilestone {
  type: 'first_win' | 'win_streak' | 'profit_milestone' | 'consistency' | 'recovery' | 'discipline';
  value: number;
  message: string;
  reward?: string;
}

export interface CoachingRecommendation {
  category: 'mindset' | 'strategy' | 'risk_management' | 'discipline' | 'education';
  priority: number; // 1-10
  title: string;
  description: string;
  actionSteps: string[];
  expectedOutcome: string;
  timeframe: string;
}

export class CoachingService {
  /**
   * Provide personalized coaching based on user's current situation
   */
  async providePersonalizedCoaching(
    userId: string,
    situation?: string,
    triggerType: CoachingSession['trigger'] = 'user_request'
  ): Promise<CoachingSession> {
    try {
      logger.info('Starting personalized coaching session', { userId, triggerType });

      // Get user profile and recent trading data
      const db = getDb();
      const userDoc = await db.collection('users').doc(userId).get();
      const userProfile = userDoc.data();
      
      // Get recent trades (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentTrades = await tradeService.getUserTrades(userId, {
        start: thirtyDaysAgo,
        limit: 100
      });

      // Analyze current trading state
      const tradingState = await this.analyzeTradingState(recentTrades);
      
      // Determine coaching type and urgency
      const sessionType = this.determineCoachingType(tradingState, triggerType);
      const urgency = this.assessUrgency(tradingState);
      
      // Generate situation context if not provided
      const contextualSituation = situation || this.generateSituationContext(tradingState, triggerType);
      
      // Generate AI coaching response
      const aiResponse = await generateTradeCoach({
        firstName: userProfile?.firstName || 'Trader',
        situation: contextualSituation
      });

      // Generate action plan and follow-up actions
      const actionPlan = this.generateActionPlan(sessionType, tradingState);
      const followUpActions = this.generateFollowUpActions(sessionType, urgency);

      const coachingSession: CoachingSession = {
        id: `coaching_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        sessionType,
        trigger: triggerType,
        situation: contextualSituation,
        message: aiResponse.message,
        quote: aiResponse.quote,
        actionPlan,
        followUpActions,
        urgency,
        timestamp: new Date(),
        metadata: {
          tradesAnalyzed: recentTrades.length,
          currentWinRate: tradingState.winRate,
          recentLossStreak: tradingState.lossStreak,
          emotionalState: tradingState.emotionalState,
          aiGenerated: true
        }
      };

      // Save coaching session
      await this.saveCoachingSession(coachingSession);

      // Schedule follow-up if urgency is high or critical
      if (urgency === 'high' || urgency === 'critical') {
        await this.scheduleFollowUp(userId, coachingSession);
      }

      logger.info('Personalized coaching session completed', {
        userId,
        sessionId: coachingSession.id,
        sessionType,
        urgency
      });

      return coachingSession;
    } catch (error) {
      logger.error('Error providing personalized coaching:', error);
      throw error;
    }
  }

  /**
   * Monitor trading patterns and trigger automatic coaching
   */
  async monitorAndCoach(userId: string): Promise<CoachingSession | null> {
    try {
      // Get recent trades for monitoring
      const recentTrades = await tradeService.getUserTrades(userId, {
        limit: 20
      });

      if (recentTrades.length < 5) {
        return null; // Not enough data for monitoring
      }

      const tradingState = await this.analyzeTradingState(recentTrades);
      
      // Check for coaching triggers
      const trigger = this.identifyCoachingTrigger(tradingState, recentTrades);
      
      if (trigger) {
        return await this.providePersonalizedCoaching(userId, undefined, trigger);
      }

      return null;
    } catch (error) {
      logger.error('Error monitoring trading patterns:', error);
      return null;
    }
  }

  /**
   * Celebrate trading milestones
   */
  async celebrateMilestone(userId: string, milestone: TradingMilestone): Promise<CoachingSession> {
    try {
      const situation = `Parabéns! Você alcançou um marco importante: ${milestone.message}`;
      
      return await this.providePersonalizedCoaching(userId, situation, 'milestone');
    } catch (error) {
      logger.error('Error celebrating milestone:', error);
      throw error;
    }
  }

  /**
   * Provide crisis intervention coaching
   */
  async provideCrisisIntervention(userId: string, crisis: 'major_losses' | 'emotional_breakdown' | 'revenge_trading'): Promise<CoachingSession> {
    try {
      let situation = '';
      
      switch (crisis) {
        case 'major_losses':
          situation = 'Enfrentando perdas significativas e precisando de orientação para recuperação';
          break;
        case 'emotional_breakdown':
          situation = 'Sentindo-se sobrecarregado emocionalmente com o trading';
          break;
        case 'revenge_trading':
          situation = 'Identificado padrão de revenge trading - necessário intervenção imediata';
          break;
      }

      return await this.providePersonalizedCoaching(userId, situation, 'emotional_state');
    } catch (error) {
      logger.error('Error providing crisis intervention:', error);
      throw error;
    }
  }

  /**
   * Generate strategic coaching recommendations
   */
  async generateStrategicRecommendations(userId: string): Promise<CoachingRecommendation[]> {
    try {
      const recentTrades = await tradeService.getUserTrades(userId, { limit: 100 });
      const insights = await aiInsightsService.getInsights(userId, { limit: 1 });
      
      const recommendations: CoachingRecommendation[] = [];
      
      if (recentTrades.length > 10) {
        const winRate = recentTrades.filter(t => t.result === 'win').length / recentTrades.length;
        const avgStake = recentTrades.reduce((sum, t) => sum + t.amount, 0) / recentTrades.length;
        const stakeVariability = this.calculateStakeVariability(recentTrades);
        
        // Mindset recommendations
        if (winRate < 0.5) {
          recommendations.push({
            category: 'mindset',
            priority: 9,
            title: 'Recalibrar Mentalidade de Trading',
            description: 'Sua taxa de vitórias está abaixo de 50%. É hora de refocalizar na qualidade em vez da quantidade.',
            actionSteps: [
              'Pare de operar por 48 horas para reflexão',
              'Revise suas últimas 20 operações e identifique padrões',
              'Defina critérios mais rigorosos para entrada em posições',
              'Pratique trading em conta demo por 1 semana'
            ],
            expectedOutcome: 'Melhoria na seleção de operações e aumento da taxa de vitórias',
            timeframe: '2-3 semanas'
          });
        }

        // Risk management recommendations
        if (stakeVariability > 0.3) {
          recommendations.push({
            category: 'risk_management',
            priority: 8,
            title: 'Padronizar Gestão de Risco',
            description: 'Variação excessiva no tamanho das apostas indica falta de disciplina na gestão de risco.',
            actionSteps: [
              'Defina um valor fixo por operação (ex: 2% do capital)',
              'Nunca aumente aposta após perdas',
              'Use calculadora de posição antes de cada trade',
              'Implemente stop-loss automático'
            ],
            expectedOutcome: 'Redução da volatilidade dos resultados e melhor preservação de capital',
            timeframe: '1-2 semanas'
          });
        }

        // Strategy recommendations
        const recentLosses = recentTrades.slice(0, 10).filter(t => t.result === 'loss').length;
        if (recentLosses >= 7) {
          recommendations.push({
            category: 'strategy',
            priority: 10,
            title: 'Revisão Completa de Estratégia',
            description: '70%+ das operações recentes resultaram em perdas. Estratégia atual não está funcionando.',
            actionSteps: [
              'Suspenda operações imediatamente',
              'Analise completamente sua estratégia atual',
              'Estude estratégias alternativas',
              'Teste nova estratégia em demo por 2 semanas',
              'Implemente gradualmente com stakes reduzidos'
            ],
            expectedOutcome: 'Nova estratégia com melhor taxa de sucesso',
            timeframe: '3-4 semanas'
          });
        }

        // Discipline recommendations
        const revengeTrading = this.detectRevengeTrading(recentTrades);
        if (revengeTrading) {
          recommendations.push({
            category: 'discipline',
            priority: 9,
            title: 'Eliminar Revenge Trading',
            description: 'Detectado padrão de revenge trading - aumentar apostas após perdas.',
            actionSteps: [
              'Implemente regra de parar após 3 perdas consecutivas',
              'Defina limite diário de perdas (ex: 5% do capital)',
              'Use alarmes para controle emocional',
              'Pratique técnicas de respiração antes de cada trade'
            ],
            expectedOutcome: 'Maior controle emocional e redução de perdas impulsivas',
            timeframe: '2-3 semanas'
          });
        }

        // Education recommendations
        if (insights.length === 0 || recentTrades.length < 50) {
          recommendations.push({
            category: 'education',
            priority: 5,
            title: 'Aprofundar Conhecimentos',
            description: 'Expandir conhecimento em análise técnica e gestão de risco.',
            actionSteps: [
              'Estude 30 min/dia sobre análise técnica',
              'Participe de comunidades de trading',
              'Mantenha diário de trading detalhado',
              'Faça curso de psicologia do trading'
            ],
            expectedOutcome: 'Maior confiança e melhores decisões de trading',
            timeframe: '4-6 semanas'
          });
        }
      }

      // Sort by priority (highest first)
      return recommendations.sort((a, b) => b.priority - a.priority).slice(0, 5);
    } catch (error) {
      logger.error('Error generating strategic recommendations:', error);
      return [];
    }
  }

  /**
   * Analyze current trading state
   */
  private async analyzeTradingState(trades: any[]): Promise<{
    winRate: number;
    lossStreak: number;
    avgProfit: number;
    emotionalState: 'calm' | 'frustrated' | 'confident' | 'anxious' | 'desperate';
    riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  }> {
    if (trades.length === 0) {
      return {
        winRate: 0,
        lossStreak: 0,
        avgProfit: 0,
        emotionalState: 'calm',
        riskLevel: 'low'
      };
    }

    const winRate = trades.filter(t => t.result === 'win').length / trades.length;
    const avgProfit = trades.reduce((sum, t) => sum + t.profit, 0) / trades.length;
    
    // Calculate current loss streak
    let lossStreak = 0;
    for (const trade of trades) {
      if (trade.result === 'loss') {
        lossStreak++;
      } else {
        break;
      }
    }

    // Determine emotional state
    let emotionalState: 'calm' | 'frustrated' | 'confident' | 'anxious' | 'desperate';
    if (lossStreak >= 5) {
      emotionalState = 'desperate';
    } else if (lossStreak >= 3) {
      emotionalState = 'frustrated';
    } else if (winRate < 0.4) {
      emotionalState = 'anxious';
    } else if (winRate > 0.6) {
      emotionalState = 'confident';
    } else {
      emotionalState = 'calm';
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    if (lossStreak >= 6 || winRate < 0.3) {
      riskLevel = 'extreme';
    } else if (lossStreak >= 4 || winRate < 0.4) {
      riskLevel = 'high';
    } else if (lossStreak >= 2 || winRate < 0.5) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    return {
      winRate,
      lossStreak,
      avgProfit,
      emotionalState,
      riskLevel
    };
  }

  /**
   * Determine coaching type based on trading state
   */
  private determineCoachingType(
    tradingState: any,
    trigger: CoachingSession['trigger']
  ): CoachingSession['sessionType'] {
    if (trigger === 'emotional_state' || tradingState.emotionalState === 'desperate') {
      return 'psychological';
    }
    if (trigger === 'low_performance' || tradingState.winRate < 0.4) {
      return 'technical';
    }
    if (trigger === 'loss_streak' || tradingState.lossStreak >= 3) {
      return 'psychological';
    }
    if (trigger === 'milestone') {
      return 'motivational';
    }
    return 'strategic';
  }

  /**
   * Assess coaching urgency
   */
  private assessUrgency(tradingState: any): CoachingSession['urgency'] {
    if (tradingState.riskLevel === 'extreme') return 'critical';
    if (tradingState.riskLevel === 'high') return 'high';
    if (tradingState.riskLevel === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Generate situation context
   */
  private generateSituationContext(
    tradingState: any,
    trigger: CoachingSession['trigger']
  ): string {
    switch (trigger) {
      case 'loss_streak':
        return `Enfrentando sequência de ${tradingState.lossStreak} perdas consecutivas`;
      case 'low_performance':
        return `Taxa de vitórias de ${Math.round(tradingState.winRate * 100)}% - abaixo do esperado`;
      case 'emotional_state':
        return `Estado emocional: ${tradingState.emotionalState} - precisa de suporte`;
      case 'milestone':
        return 'Celebrando conquista importante no trading';
      default:
        return 'Buscando orientação para melhorar performance no trading';
    }
  }

  /**
   * Generate action plan
   */
  private generateActionPlan(
    sessionType: CoachingSession['sessionType'],
    tradingState: any
  ): string[] {
    const basePlans = {
      motivational: [
        'Celebre suas conquistas recentes',
        'Defina próxima meta realista',
        'Mantenha disciplina atual',
        'Compartilhe sucesso com comunidade'
      ],
      technical: [
        'Revise estratégia de entrada',
        'Analise setups perdedores',
        'Ajuste critérios de seleção',
        'Pratique em conta demo'
      ],
      psychological: [
        'Pare operações por 24-48h',
        'Pratique técnicas de relaxamento',
        'Revise regras de stop-loss',
        'Busque suporte se necessário'
      ],
      strategic: [
        'Analise performance mensal',
        'Identifique pontos de melhoria',
        'Ajuste gestão de risco',
        'Defina metas para próximo período'
      ]
    };

    let plan = [...basePlans[sessionType]];

    // Add specific actions based on trading state
    if (tradingState.lossStreak >= 3) {
      plan.unshift('PARE de operar imediatamente');
    }
    if (tradingState.winRate < 0.4) {
      plan.push('Considere mudar estratégia');
    }

    return plan;
  }

  /**
   * Generate follow-up actions
   */
  private generateFollowUpActions(
    sessionType: CoachingSession['sessionType'],
    urgency: CoachingSession['urgency']
  ): string[] {
    const followUps = [];

    if (urgency === 'critical' || urgency === 'high') {
      followUps.push('Check-in em 24 horas');
      followUps.push('Acompanhamento semanal obrigatório');
    } else {
      followUps.push('Revisão em 1 semana');
    }

    if (sessionType === 'psychological') {
      followUps.push('Avaliação de estado emocional');
    }
    if (sessionType === 'technical') {
      followUps.push('Análise de próximas 10 operações');
    }

    return followUps;
  }

  /**
   * Identify coaching triggers from trading patterns
   */
  private identifyCoachingTrigger(
    tradingState: any,
    recentTrades: any[]
  ): CoachingSession['trigger'] | null {
    // Loss streak trigger
    if (tradingState.lossStreak >= 3) {
      return 'loss_streak';
    }

    // Low performance trigger
    if (tradingState.winRate < 0.4 && recentTrades.length >= 10) {
      return 'low_performance';
    }

    // Emotional state trigger
    if (tradingState.emotionalState === 'desperate' || tradingState.emotionalState === 'frustrated') {
      return 'emotional_state';
    }

    // Revenge trading detection
    if (this.detectRevengeTrading(recentTrades)) {
      return 'emotional_state';
    }

    return null;
  }

  /**
   * Detect revenge trading patterns
   */
  private detectRevengeTrading(trades: any[]): boolean {
    for (let i = 1; i < Math.min(trades.length, 10); i++) {
      const prevTrade = trades[i - 1];
      const currentTrade = trades[i];
      
      if (prevTrade.result === 'loss' && currentTrade.amount > prevTrade.amount * 1.5) {
        return true;
      }
    }
    return false;
  }

  /**
   * Calculate stake size variability
   */
  private calculateStakeVariability(trades: any[]): number {
    const stakes = trades.map(t => t.amount);
    const avgStake = stakes.reduce((a, b) => a + b, 0) / stakes.length;
    const variance = stakes.reduce((sum, stake) => sum + Math.pow(stake - avgStake, 2), 0) / stakes.length;
    const stdDev = Math.sqrt(variance);
    return stdDev / avgStake; // Coefficient of variation
  }

  /**
   * Save coaching session to database
   */
  private async saveCoachingSession(session: CoachingSession): Promise<void> {
    try {
      const db = getDb();
      await db.collection('coaching')
        .doc(session.userId)
        .collection('sessions')
        .doc(session.id)
        .set({
          ...session,
          timestamp: session.timestamp.toISOString()
        });

      // Also save to insights collection for unified access
      await db.collection('insights')
        .doc(session.userId)
        .collection('insights')
        .doc(session.id)
        .set({
          id: session.id,
          type: 'coaching',
          title: `Coaching: ${session.sessionType}`,
          content: session.message,
          action: session.actionPlan.join('; '),
          quote: session.quote,
          timestamp: session.timestamp.toISOString(),
          metadata: {
            ...session.metadata,
            sessionType: session.sessionType,
            urgency: session.urgency,
            trigger: session.trigger
          }
        });
    } catch (error) {
      logger.error('Error saving coaching session:', error);
      throw error;
    }
  }

  /**
   * Schedule follow-up coaching
   */
  private async scheduleFollowUp(userId: string, session: CoachingSession): Promise<void> {
    try {
      const db = getDb();
      const followUpDate = new Date();
      
      // Schedule based on urgency
      if (session.urgency === 'critical') {
        followUpDate.setHours(followUpDate.getHours() + 24);
      } else if (session.urgency === 'high') {
        followUpDate.setDate(followUpDate.getDate() + 3);
      } else {
        followUpDate.setDate(followUpDate.getDate() + 7);
      }

      await db.collection('scheduled_coaching')
        .doc(`${userId}_${followUpDate.getTime()}`)
        .set({
          userId,
          originalSessionId: session.id,
          scheduledFor: followUpDate.toISOString(),
          type: 'follow_up',
          urgency: session.urgency,
          createdAt: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error scheduling follow-up:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get coaching history for user
   */
  async getCoachingHistory(
    userId: string,
    options: {
      limit?: number;
      sessionType?: CoachingSession['sessionType'];
      since?: Date;
    } = {}
  ): Promise<CoachingSession[]> {
    try {
      const db = getDb();
      let query = db.collection('coaching').doc(userId).collection('sessions') as any;
      
      if (options.sessionType) {
        query = query.where('sessionType', '==', options.sessionType);
      }
      
      if (options.since) {
        query = query.where('timestamp', '>=', options.since.toISOString());
      }
      
      const snapshot = await query
        .orderBy('timestamp', 'desc')
        .limit(options.limit || 20)
        .get();
      
      return snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          ...data,
          timestamp: new Date(data.timestamp)
        } as CoachingSession;
      });
    } catch (error) {
      logger.error('Error getting coaching history:', error);
      throw error;
    }
  }
}

export const coachingService = new CoachingService();