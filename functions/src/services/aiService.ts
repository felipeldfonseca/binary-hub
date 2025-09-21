import { Configuration, OpenAIApi } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();

// Initialize AI clients
const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AIAnalysisRequest {
  type: 'individual_trade' | 'daily_report' | 'weekly_report' | 'pattern_analysis';
  userId: string;
  data: any;
  model?: 'gpt4o' | 'gemini' | 'auto';
}

export interface AIAnalysisResponse {
  id: string;
  type: string;
  analysis: any;
  model: string;
  tokensUsed: number;
  cost: number;
  confidence: number;
  createdAt: string;
}

export interface UsageLimits {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  resetDate?: string;
}

export class AIService {
  private readonly COST_PER_TOKEN = {
    gpt4o: 0.00003, // GPT-4o pricing (input tokens)
    gemini: 0.000001 // Gemini 2.5 Flash Light pricing
  };

  private readonly TOKEN_LIMITS = {
    gpt4o: 8000, // Max tokens for detailed analysis
    gemini: 32000 // Max tokens for bulk analysis
  };

  private readonly SUBSCRIPTION_LIMITS = {
    free: {
      individual_trade: 5, // per month
      daily_report: 0,
      weekly_report: 0,
      pattern_analysis: 0
    },
    pro: {
      individual_trade: 100, // per month
      daily_report: 30,
      weekly_report: 4,
      pattern_analysis: 10
    },
    premium: {
      individual_trade: 500, // per month
      daily_report: 100,
      weekly_report: 20,
      pattern_analysis: 50
    }
  };

  /**
   * Route AI request to optimal model based on complexity and cost
   */
  async routeAIRequest(request: AIAnalysisRequest): Promise<string> {
    const userId = request.userId;
    
    // Check user subscription and usage limits
    const canUseAI = await this.checkUsageLimits(userId, request.type);
    if (!canUseAI.allowed) {
      throw new Error(canUseAI.reason);
    }

    // Determine optimal model
    const optimalModel = this.determineOptimalModel(request);
    
    let analysis: AIAnalysisResponse;
    
    switch (optimalModel) {
      case 'gpt4o':
        analysis = await this.analyzeWithGPT4o(request);
        break;
      case 'gemini':
        analysis = await this.analyzeWithGemini(request);
        break;
      default:
        throw new Error('Invalid model selection');
    }

    // Store analysis result
    await this.storeAnalysisResult(analysis);
    
    // Update usage tracking
    await this.updateUsageTracking(userId, request.type, analysis.cost, analysis.tokensUsed);
    
    return analysis.id;
  }

  /**
   * Check if user can use AI features based on subscription and limits
   */
  private async checkUsageLimits(userId: string, analysisType: string): Promise<UsageLimits> {
    try {
      // Get user profile and subscription info
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return { allowed: false, reason: 'User not found' };
      }

      const userData = userDoc.data();
      const subscription = userData?.subscription?.tier || 'free';
      
      // Get current month usage
      const currentMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
      const usageDoc = await db.collection('users').doc(userId).collection('ai_usage').doc(currentMonth).get();
      const currentUsage = usageDoc.exists ? usageDoc.data() : {};
      
      const limit = this.SUBSCRIPTION_LIMITS[subscription as keyof typeof this.SUBSCRIPTION_LIMITS]?.[analysisType as keyof typeof this.SUBSCRIPTION_LIMITS.free];
      const used = currentUsage?.[analysisType] || 0;
      
      if (limit === undefined) {
        return { allowed: false, reason: 'Invalid analysis type' };
      }
      
      if (used >= limit) {
        return { 
          allowed: false, 
          reason: `Monthly limit reached for ${analysisType}. Upgrade for more AI analysis.`,
          remaining: 0
        };
      }
      
      return { 
        allowed: true, 
        remaining: limit - used,
        resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
      };
    } catch (error) {
      logger.error('Error checking usage limits:', error);
      return { allowed: false, reason: 'Error checking usage limits' };
    }
  }

  /**
   * Determine optimal AI model based on request type and data size
   */
  private determineOptimalModel(request: AIAnalysisRequest): 'gpt4o' | 'gemini' {
    if (request.model && request.model !== 'auto') {
      return request.model;
    }

    // Individual trade analysis - use GPT-4o for detailed insights
    if (request.type === 'individual_trade') {
      return 'gpt4o';
    }

    // Bulk analysis (daily/weekly reports) - use Gemini for cost efficiency
    if (request.type === 'daily_report' || request.type === 'weekly_report') {
      return 'gemini';
    }

    // Pattern analysis - use GPT-4o for complex pattern recognition
    if (request.type === 'pattern_analysis') {
      return 'gpt4o';
    }

    // Default to Gemini for cost efficiency
    return 'gemini';
  }

  /**
   * Analyze using GPT-4o for detailed individual analysis
   */
  private async analyzeWithGPT4o(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const prompt = this.buildPrompt(request);
      
      const response = await openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(request.type)
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.TOKEN_LIMITS.gpt4o,
        temperature: 0.7
      });

      const analysis = response.data.choices[0]?.message?.content;
      const tokensUsed = response.data.usage?.total_tokens || 0;
      const cost = tokensUsed * this.COST_PER_TOKEN.gpt4o;

      return {
        id: this.generateAnalysisId(),
        type: request.type,
        analysis: this.parseAnalysisResponse(analysis || '', request.type),
        model: 'gpt4o',
        tokensUsed,
        cost,
        confidence: this.calculateConfidence(analysis || '', 'gpt4o'),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('GPT-4o analysis error:', error);
      throw new Error('Failed to analyze with GPT-4o');
    }
  }

  /**
   * Analyze using Gemini for bulk analysis
   */
  private async analyzeWithGemini(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const prompt = this.buildPrompt(request);
      
      const result = await model.generateContent([
        this.getSystemPrompt(request.type),
        prompt
      ]);
      
      const response = await result.response;
      const analysis = response.text();
      
      // Estimate tokens (Gemini doesn't provide exact count)
      const tokensUsed = Math.ceil(analysis.length / 4); // Rough estimation
      const cost = tokensUsed * this.COST_PER_TOKEN.gemini;

      return {
        id: this.generateAnalysisId(),
        type: request.type,
        analysis: this.parseAnalysisResponse(analysis, request.type),
        model: 'gemini',
        tokensUsed,
        cost,
        confidence: this.calculateConfidence(analysis, 'gemini'),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Gemini analysis error:', error);
      throw new Error('Failed to analyze with Gemini');
    }
  }

  /**
   * Build prompt based on request type and data
   */
  private buildPrompt(request: AIAnalysisRequest): string {
    switch (request.type) {
      case 'individual_trade':
        return this.buildTradeAnalysisPrompt(request.data);
      case 'daily_report':
        return this.buildDailyReportPrompt(request.data);
      case 'weekly_report':
        return this.buildWeeklyReportPrompt(request.data);
      case 'pattern_analysis':
        return this.buildPatternAnalysisPrompt(request.data);
      default:
        throw new Error('Invalid analysis type');
    }
  }

  /**
   * Get system prompt for different analysis types
   */
  private getSystemPrompt(type: string): string {
    const basePrompt = `You are an expert binary options trading analyst. Provide insights in Portuguese for Brazilian traders. Be specific, actionable, and educational.`;
    
    switch (type) {
      case 'individual_trade':
        return `${basePrompt} Analyze this individual trade and provide detailed insights about entry timing, market conditions, and lessons learned.`;
      case 'daily_report':
        return `${basePrompt} Generate a comprehensive daily trading report analyzing all trades, patterns, and performance metrics.`;
      case 'weekly_report':
        return `${basePrompt} Create a detailed weekly analysis identifying trends, patterns, and strategic recommendations.`;
      case 'pattern_analysis':
        return `${basePrompt} Identify trading patterns, behavioral tendencies, and provide strategic recommendations for improvement.`;
      default:
        return basePrompt;
    }
  }

  /**
   * Build trade analysis prompt
   */
  private buildTradeAnalysisPrompt(tradeData: any): string {
    return `
Analise este trade de opções binárias:

Dados do Trade:
- Ativo: ${tradeData.asset}
- Direção: ${tradeData.direction}
- Valor: $${tradeData.amount}
- Resultado: ${tradeData.result}
- Lucro/Prejuízo: $${tradeData.profit}
- Horário de Entrada: ${tradeData.entryTime}
- Preço de Entrada: ${tradeData.entryPrice || 'N/A'}
- Preço de Saída: ${tradeData.exitPrice || 'N/A'}

Forneça uma análise estruturada com:
1. Avaliação da entrada (timing, condições de mercado)
2. Análise do resultado
3. Lições aprendidas
4. Recomendações para trades similares
5. Score de qualidade do trade (1-10)

Responda em formato JSON com as seguintes chaves:
{
  "evaluation": "string",
  "outcome_analysis": "string", 
  "lessons": "string",
  "recommendations": "string",
  "quality_score": number,
  "confidence": number
}
`;
  }

  /**
   * Build daily report prompt
   */
  private buildDailyReportPrompt(data: any): string {
    const { trades, date } = data;
    
    return `
Gere um relatório diário de trading para ${date}:

Trades do Dia (${trades.length} trades):
${trades.map((trade: any, index: number) => `
${index + 1}. ${trade.asset} ${trade.direction} - $${trade.amount} - ${trade.result} (${trade.profit >= 0 ? '+' : ''}$${trade.profit})
`).join('')}

Forneça análise com:
1. Performance geral do dia
2. Análise de ativos mais negociados
3. Padrões de horário identificados
4. Pontos fortes e fracos
5. Recomendações para amanhã

Responda em formato JSON estruturado.
`;
  }

  /**
   * Build weekly report prompt
   */
  private buildWeeklyReportPrompt(data: any): string {
    const { trades, weekStart, weekEnd, stats } = data;
    
    return `
Análise Semanal de Trading (${weekStart} a ${weekEnd}):

Estatísticas da Semana:
- Total de Trades: ${trades.length}
- Taxa de Vitória: ${stats.winRate}%
- Lucro Total: $${stats.totalProfit}
- Melhor Dia: ${stats.bestDay}
- Pior Dia: ${stats.worstDay}

Trades por Dia:
${Object.entries(stats.dailyBreakdown).map(([day, dayStats]: [string, any]) => `
${day}: ${dayStats.trades} trades, ${dayStats.winRate}% vitórias, $${dayStats.profit} lucro
`).join('')}

Forneça análise completa incluindo:
1. Tendências da semana
2. Evolução da performance
3. Padrões comportamentais
4. Análise de risco
5. Plano estratégico para próxima semana

Responda em formato JSON estruturado.
`;
  }

  /**
   * Build pattern analysis prompt
   */
  private buildPatternAnalysisPrompt(data: any): string {
    const { trades, timeframe, patterns } = data;
    
    return `
Análise de Padrões de Trading:

Período: ${timeframe}
Total de Trades: ${trades.length}

Padrões Identificados:
${patterns.map((pattern: any) => `
- ${pattern.name}: ${pattern.frequency} ocorrências, ${pattern.successRate}% sucesso
`).join('')}

Histórico de Trades para Análise:
${trades.slice(-50).map((trade: any) => `
${trade.date} | ${trade.asset} | ${trade.direction} | $${trade.amount} | ${trade.result}
`).join('')}

Analise e identifique:
1. Padrões de comportamento
2. Tendências de performance
3. Fatores de risco
4. Oportunidades de melhoria
5. Recomendações estratégicas

Responda em formato JSON estruturado.
`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAnalysisResponse(response: string, type: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to plain text with structure
      return {
        type,
        content: response,
        structured: false
      };
    } catch (error) {
      logger.warn('Failed to parse AI response as JSON, using plain text');
      return {
        type,
        content: response,
        structured: false
      };
    }
  }

  /**
   * Calculate confidence score based on response quality
   */
  private calculateConfidence(response: string, model: string): number {
    let confidence = 0.5; // Base confidence
    
    // Adjust based on response length and structure
    if (response.length > 500) confidence += 0.2;
    if (response.includes('{') && response.includes('}')) confidence += 0.2;
    
    // Model-specific adjustments
    if (model === 'gpt4o') confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  /**
   * Store analysis result in database
   */
  private async storeAnalysisResult(analysis: AIAnalysisResponse): Promise<void> {
    try {
      await db.collection('ai_analyses').doc(analysis.id).set({
        ...analysis,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error storing analysis result:', error);
      throw error;
    }
  }

  /**
   * Update usage tracking for billing and limits
   */
  private async updateUsageTracking(userId: string, analysisType: string, cost: number, tokensUsed: number): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usageRef = db.collection('users').doc(userId).collection('ai_usage').doc(currentMonth);
      
      const usageDoc = await usageRef.get();
      
      if (usageDoc.exists) {
        const currentData = usageDoc.data() || {};
        await usageRef.update({
          [analysisType]: (currentData[analysisType] || 0) + 1,
          totalCost: (currentData.totalCost || 0) + cost,
          totalTokens: (currentData.totalTokens || 0) + tokensUsed,
          lastUpdated: new Date().toISOString()
        });
      } else {
        await usageRef.set({
          [analysisType]: 1,
          totalCost: cost,
          totalTokens: tokensUsed,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      logger.error('Error updating usage tracking:', error);
      // Don't throw error for usage tracking failures
    }
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get user's AI analysis history
   */
  async getAnalysisHistory(userId: string, analysisType?: string, limitCount = 20): Promise<AIAnalysisResponse[]> {
    try {
      let analysisQuery = db.collection('ai_analyses')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount);

      if (analysisType) {
        analysisQuery = db.collection('ai_analyses')
          .where('userId', '==', userId)
          .where('type', '==', analysisType)
          .orderBy('createdAt', 'desc')
          .limit(limitCount);
      }

      const snapshot = await analysisQuery.get();
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AIAnalysisResponse[];
    } catch (error) {
      logger.error('Error getting analysis history:', error);
      return [];
    }
  }

  /**
   * Get usage statistics for user
   */
  async getUsageStats(userId: string): Promise<any> {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usageDoc = await db.collection('users').doc(userId).collection('ai_usage').doc(currentMonth).get();
      
      if (!usageDoc.exists) {
        return {
          individual_trade: 0,
          daily_report: 0,
          weekly_report: 0,
          pattern_analysis: 0,
          totalCost: 0,
          totalTokens: 0
        };
      }
      
      return usageDoc.data();
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      return null;
    }
  }
}

export default new AIService();