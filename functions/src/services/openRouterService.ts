import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// AI Model configurations with championship-winning models
export const AI_MODELS = {
  // Primary: Ultra-cheap, competition-proven model
  primary: {
    id: 'deepseek/deepseek-chat-v3-0324',
    name: 'DeepSeek V3',
    costPer1MTokens: 0.24, // $0.24 per 1M tokens
    maxTokens: 32000,
    useCase: 'bulk_analysis'
  },
  // Premium: High-quality, still very affordable
  premium: {
    id: 'qwen/qwen3-max', 
    name: 'Qwen3 Max',
    costPer1MTokens: 1.2, // $1.2 per 1M tokens
    maxTokens: 8000,
    useCase: 'detailed_analysis'
  },
  // Fallback: Keep Gemini as backup
  fallback: {
    id: 'google/gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    costPer1MTokens: 0.075, // Google's pricing
    maxTokens: 32000,
    useCase: 'backup'
  }
} as const;

export interface OpenRouterRequest {
  model: keyof typeof AI_MODELS;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
}

export interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  created: number;
}

export interface AIAnalysisResult {
  id: string;
  type: string;
  analysis: any;
  model: string;
  modelName: string;
  tokensUsed: number;
  cost: number;
  confidence: number;
  createdAt: string;
  userId: string;
}

/**
 * OpenRouter AI Service - Championship-winning models at startup prices
 */
export class OpenRouterService {
  private readonly SUBSCRIPTION_LIMITS = {
    free: {
      individual_trade: 5, // per month
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

  /**
   * Route AI request to optimal model based on complexity
   */
  async analyzeWithAI(request: {
    type: 'individual_trade' | 'daily_report' | 'weekly_report' | 'pattern_analysis';
    userId: string;
    data: any;
    forceModel?: keyof typeof AI_MODELS;
  }): Promise<string> {
    // Check usage limits
    const canUseAI = await this.checkUsageLimits(request.userId, request.type);
    if (!canUseAI.allowed) {
      throw new Error(canUseAI.reason || 'Usage limit exceeded');
    }

    // Determine optimal model
    const optimalModel = request.forceModel || this.selectOptimalModel(request.type);
    
    // Generate analysis
    const analysis = await this.generateAnalysis(request, optimalModel);
    
    // Store result
    await this.storeAnalysisResult(analysis);
    
    // Update usage tracking
    await this.updateUsageTracking(
      request.userId, 
      request.type, 
      analysis.cost, 
      analysis.tokensUsed
    );
    
    return analysis.id;
  }

  /**
   * Select optimal model based on analysis type
   */
  private selectOptimalModel(type: string): keyof typeof AI_MODELS {
    switch (type) {
      case 'individual_trade':
        // Use premium model for detailed individual analysis
        return 'premium';
      case 'pattern_analysis':
        // Use premium model for complex pattern recognition
        return 'premium'; 
      case 'daily_report':
      case 'weekly_report':
        // Use primary (ultra-cheap) model for bulk reports
        return 'primary';
      default:
        return 'primary';
    }
  }

  /**
   * Generate AI analysis using OpenRouter
   */
  private async generateAnalysis(
    request: { type: string; data: any; userId: string },
    modelKey: keyof typeof AI_MODELS
  ): Promise<AIAnalysisResult> {
    const model = AI_MODELS[modelKey];
    const prompt = this.buildPrompt(request.type, request.data);
    
    try {
      const response = await this.callOpenRouter({
        model: modelKey,
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
        max_tokens: model.maxTokens,
        temperature: request.type === 'individual_trade' ? 0.7 : 0.5
      });

      const analysis = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage.total_tokens;
      const cost = (tokensUsed / 1000000) * model.costPer1MTokens; // Convert to cost per actual tokens

      return {
        id: this.generateAnalysisId(),
        type: request.type,
        analysis: this.parseAnalysisResponse(analysis, request.type),
        model: model.id,
        modelName: model.name,
        tokensUsed,
        cost,
        confidence: this.calculateConfidence(analysis, modelKey),
        createdAt: new Date().toISOString(),
        userId: request.userId
      };
    } catch (error) {
      logger.error(`${model.name} analysis error:`, error);
      throw new Error(`Failed to analyze with ${model.name}: ${error}`);
    }
  }

  /**
   * Call OpenRouter API using Node.js built-in fetch
   */
  private async callOpenRouter(request: OpenRouterRequest): Promise<OpenRouterResponse> {
    const model = AI_MODELS[request.model];
    
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://binaryhub.app', // Your site URL
        'X-Title': 'Binary Hub - Social Trading Platform'
      },
      body: JSON.stringify({
        model: model.id,
        messages: request.messages,
        max_tokens: request.max_tokens || model.maxTokens,
        temperature: request.temperature || 0.7,
        top_p: request.top_p || 1.0,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return response.json() as Promise<OpenRouterResponse>;
  }

  /**
   * Build prompts for different analysis types
   */
  private buildPrompt(type: string, data: any): string {
    switch (type) {
      case 'individual_trade':
        return this.buildTradeAnalysisPrompt(data);
      case 'daily_report':
        return this.buildDailyReportPrompt(data);
      case 'weekly_report':
        return this.buildWeeklyReportPrompt(data);
      case 'pattern_analysis':
        return this.buildPatternAnalysisPrompt(data);
      default:
        throw new Error('Invalid analysis type');
    }
  }

  /**
   * System prompts optimized for trading competition winners
   */
  private getSystemPrompt(type: string): string {
    const basePrompt = `You are a championship-winning AI trading analyst. Your models have proven profitable in live trading competitions. Provide precise, actionable insights in Portuguese for Brazilian traders. Focus on practical, profitable strategies.

CRITICAL: This is educational analysis, not investment advice.`;
    
    switch (type) {
      case 'individual_trade':
        return `${basePrompt}

You excel at individual trade analysis. Examine entry timing, market context, risk management, and probability assessment. Provide specific lessons that improve future decision-making.`;

      case 'daily_report':
        return `${basePrompt}

You specialize in daily performance analysis. Identify patterns, efficiency metrics, risk exposure, and tactical adjustments. Your daily insights help traders maintain consistent profitability.`;

      case 'weekly_report':
        return `${basePrompt}

You create comprehensive weekly strategic analysis. Focus on behavioral patterns, market adaptation, risk evolution, and strategic positioning. Your weekly insights drive long-term profitability.`;

      case 'pattern_analysis':
        return `${basePrompt}

You identify profitable trading patterns with championship-level accuracy. Analyze behavioral tendencies, market timing, risk patterns, and strategic opportunities. Your pattern recognition creates sustainable edge.`;

      default:
        return basePrompt;
    }
  }

  /**
   * Enhanced trade analysis prompt
   */
  private buildTradeAnalysisPrompt(tradeData: any): string {
    return `
ANÁLISE DE TRADE INDIVIDUAL (Modelo vencedor de competição)

Dados do Trade:
- Ativo: ${tradeData.asset || 'N/A'}
- Direção: ${tradeData.direction || 'N/A'}
- Valor: R$ ${tradeData.amount || 'N/A'}
- Resultado: ${tradeData.result || 'N/A'}
- Lucro/Prejuízo: R$ ${tradeData.profit || 'N/A'}
- Horário: ${tradeData.entryTime || 'N/A'}
- Duração: ${tradeData.duration || 'N/A'}

Contexto Adicional:
- Sequência anterior: ${tradeData.previousSequence || 'N/A'}
- Condições de mercado: ${tradeData.marketConditions || 'N/A'}
- Estratégia utilizada: ${tradeData.strategy || 'N/A'}

Forneça análise EXTREMAMENTE específica e acionável:

1. AVALIAÇÃO TÉCNICA (0-10)
   - Timing de entrada
   - Seleção de ativo
   - Gerenciamento de risco
   - Contexto de mercado

2. ANÁLISE COMPORTAMENTAL
   - Disciplina demonstrada
   - Emoções envolvidas
   - Aderência à estratégia

3. LIÇÕES PRÁTICAS
   - O que funcionou
   - O que pode melhorar
   - Padrões identificados

4. AÇÕES ESPECÍFICAS
   - Próximos passos
   - Ajustes necessários
   - Oportunidades similares

Responda em JSON estruturado:
{
  "technical_score": number,
  "timing_analysis": "string",
  "risk_assessment": "string", 
  "behavioral_insights": "string",
  "key_lessons": ["string"],
  "specific_actions": ["string"],
  "quality_score": number,
  "confidence_level": number
}`;
  }

  /**
   * Enhanced daily report prompt
   */
  private buildDailyReportPrompt(data: any): string {
    const { trades, date, stats } = data;
    
    return `
RELATÓRIO DIÁRIO DE TRADING (${date})
Análise com IA vencedora de competições

Resumo Estatístico:
- Total de trades: ${trades?.length || 0}
- Win rate: ${stats?.winRate || 0}%
- Lucro total: R$ ${stats?.totalProfit || 0}
- Maior gain: R$ ${stats?.bestTrade || 0}
- Maior loss: R$ ${stats?.worstTrade || 0}

Trades do Dia:
${trades?.map((trade: any, i: number) => `
${i+1}. ${trade.asset} ${trade.direction} - R$ ${trade.amount} - ${trade.result} (${trade.profit >= 0 ? '+' : ''}R$ ${trade.profit}) às ${trade.entryTime}
`).join('') || 'Nenhum trade registrado'}

ANÁLISE REQUERIDA:

1. PERFORMANCE ANALYSIS
   - Eficiência geral do dia
   - Pontos fortes identificados
   - Áreas de melhoria

2. PATTERN IDENTIFICATION
   - Horários mais lucrativos
   - Ativos de melhor performance
   - Sequências de vitória/derrota

3. RISK MANAGEMENT
   - Exposição de risco
   - Tamanhos de posição
   - Controle emocional

4. TACTICAL RECOMMENDATIONS
   - Ajustes para amanhã
   - Estratégias a manter
   - Estratégias a evitar

Responda em JSON estruturado com insights acionáveis.`;
  }

  /**
   * Enhanced weekly report prompt  
   */
  private buildWeeklyReportPrompt(data: any): string {
    const { trades, weekStart, weekEnd, stats } = data;
    
    return `
ANÁLISE SEMANAL ESTRATÉGICA (${weekStart} a ${weekEnd})
IA com histórico comprovado em competições de trading

Estatísticas da Semana:
- Trades totais: ${trades?.length || 0}
- Taxa de vitória: ${stats?.winRate || 0}%
- Lucro líquido: R$ ${stats?.totalProfit || 0}
- Melhor dia: ${stats?.bestDay || 'N/A'}
- Pior dia: ${stats?.worstDay || 'N/A'}
- Consistência: ${stats?.consistency || 'N/A'}

Performance Diária:
${Object.entries(stats?.dailyBreakdown || {}).map(([day, dayStats]: [string, any]) => `
${day}: ${dayStats.trades || 0} trades | ${dayStats.winRate || 0}% vitórias | R$ ${dayStats.profit || 0}
`).join('')}

ANÁLISE ESTRATÉGICA COMPLETA:

1. EVOLUÇÃO SEMANAL
   - Tendências de performance
   - Curva de aprendizado
   - Adaptação ao mercado

2. ANÁLISE COMPORTAMENTAL  
   - Padrões de disciplina
   - Gestão emocional
   - Consistência estratégica

3. EFICIÊNCIA OPERACIONAL
   - Horários ótimos
   - Ativos mais lucrativos
   - Estratégias vencedoras

4. GESTÃO DE RISCO
   - Exposição semanal
   - Controle de drawdown
   - Preservação de capital

5. PLANO ESTRATÉGICO
   - Objetivos próxima semana
   - Ajustes necessários
   - Oportunidades identificadas

Forneça insights de nível profissional em JSON estruturado.`;
  }

  /**
   * Enhanced pattern analysis prompt
   */
  private buildPatternAnalysisPrompt(data: any): string {
    const { trades, timeframe, userStats } = data;
    
    return `
ANÁLISE AVANÇADA DE PADRÕES
Reconhecimento com IA vencedora de competições

Período: ${timeframe}
Total de operações: ${trades?.length || 0}
Performance geral: ${userStats?.overallWinRate || 0}% win rate

Dados para Análise de Padrões:
${trades?.slice(-100).map((trade: any) => `
${trade.date} | ${trade.asset} | ${trade.direction} | R$ ${trade.amount} | ${trade.result} | ${trade.entryTime}
`).join('') || 'Dados insuficientes'}

IDENTIFICAÇÃO DE PADRÕES PROFISSIONAIS:

1. PADRÕES TEMPORAIS
   - Horários de maior lucro
   - Dias da semana mais eficientes
   - Duração ótima de trades

2. PADRÕES DE ATIVOS
   - Pares de moedas mais lucrativos
   - Correlações de performance
   - Especialização por ativo

3. PADRÕES COMPORTAMENTAIS
   - Sequências de vitória/derrota
   - Impacto emocional nos resultados
   - Disciplina vs. impulsos

4. PADRÕES DE RISCO
   - Relação valor vs. resultado
   - Gestão de bankroll
   - Recuperação de perdas

5. OPORTUNIDADES ESTRATÉGICAS
   - Nichos de alta performance
   - Melhorias pontuais
   - Vantagens competitivas

Identifique padrões lucrativos específicos e acionáveis em JSON estruturado.`;
  }

  /**
   * Parse AI response with enhanced error handling
   */
  private parseAnalysisResponse(response: string, type: string): any {
    try {
      // Clean response and extract JSON
      const cleanResponse = response.trim();
      
      // Try to find JSON block
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...parsed,
          structured: true,
          raw_response: cleanResponse
        };
      }
      
      // Fallback to structured plain text
      return {
        type,
        content: cleanResponse,
        structured: false,
        raw_response: cleanResponse
      };
    } catch (error) {
      logger.warn('Failed to parse AI response, using plain text format');
      return {
        type,
        content: response,
        structured: false,
        parse_error: error,
        raw_response: response
      };
    }
  }

  /**
   * Calculate confidence based on model and response quality
   */
  private calculateConfidence(response: string, model: keyof typeof AI_MODELS): number {
    let confidence = 0.6; // Base confidence for championship models
    
    // Response quality indicators
    if (response.length > 800) confidence += 0.15;
    if (response.includes('{') && response.includes('}')) confidence += 0.1;
    if (response.includes('score') || response.includes('analysis')) confidence += 0.05;
    
    // Model-specific adjustments
    if (model === 'premium') confidence += 0.1; // Qwen3 Max bonus
    if (model === 'primary') confidence += 0.05; // DeepSeek proven in competition
    
    return Math.min(1.0, confidence);
  }

  /**
   * Check usage limits with updated tiers
   */
  private async checkUsageLimits(userId: string, analysisType: string): Promise<{
    allowed: boolean;
    reason?: string;
    remaining?: number;
  }> {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        return { allowed: false, reason: 'User not found' };
      }

      const userData = userDoc.data();
      const subscription = userData?.subscription?.tier || 'free';
      
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usageDoc = await db.collection('users').doc(userId)
        .collection('ai_usage').doc(currentMonth).get();
      const currentUsage = usageDoc.exists ? usageDoc.data() : {};
      
      const limits = this.SUBSCRIPTION_LIMITS[subscription as keyof typeof this.SUBSCRIPTION_LIMITS];
      if (!limits) {
        return { allowed: false, reason: 'Invalid subscription tier' };
      }

      const limit = limits[analysisType as keyof typeof limits];
      const used = currentUsage?.[analysisType] || 0;
      
      if (limit === undefined) {
        return { allowed: false, reason: 'Invalid analysis type' };
      }
      
      if (used >= limit) {
        return { 
          allowed: false, 
          reason: `Limite mensal atingido para ${analysisType}. Upgrade para mais análises de IA.`,
          remaining: 0
        };
      }
      
      return { 
        allowed: true, 
        remaining: limit - used
      };
    } catch (error) {
      logger.error('Error checking usage limits:', error);
      return { allowed: false, reason: 'Erro ao verificar limites de uso' };
    }
  }

  /**
   * Store analysis result in database
   */
  private async storeAnalysisResult(analysis: AIAnalysisResult): Promise<void> {
    try {
      await db.collection('ai_analyses').doc(analysis.id).set(analysis);
      logger.info('Analysis stored successfully', { 
        id: analysis.id, 
        model: analysis.modelName, 
        cost: analysis.cost 
      });
    } catch (error) {
      logger.error('Error storing analysis result:', error);
      throw error;
    }
  }

  /**
   * Update usage tracking
   */
  private async updateUsageTracking(
    userId: string, 
    analysisType: string, 
    cost: number, 
    tokensUsed: number
  ): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().substring(0, 7);
      const usageRef = db.collection('users').doc(userId)
        .collection('ai_usage').doc(currentMonth);
      
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
      
      logger.info('Usage tracking updated', { 
        userId, 
        analysisType, 
        cost, 
        tokensUsed 
      });
    } catch (error) {
      logger.error('Error updating usage tracking:', error);
      // Don't throw - usage tracking failures shouldn't break analysis
    }
  }

  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `openrouter_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Health check for OpenRouter service
   */
  async healthCheck(): Promise<{ 
    status: string; 
    latency?: number; 
    model?: string; 
    error?: string; 
  }> {
    try {
      const startTime = Date.now();
      
      const response = await this.callOpenRouter({
        model: 'primary',
        messages: [{ role: 'user', content: 'Test connection' }],
        max_tokens: 10,
        temperature: 0
      });
      
      const latency = Date.now() - startTime;
      
      if (!response.choices[0]?.message?.content) {
        throw new Error('Invalid response structure');
      }
      
      return {
        status: 'healthy',
        latency,
        model: AI_MODELS.primary.name
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Get cost analysis for transparency
   */
  getCostAnalysis(): any {
    const models = Object.entries(AI_MODELS).map(([key, model]) => ({
      key,
      name: model.name,
      costPer1MTokens: model.costPer1MTokens,
      useCase: model.useCase
    }));

    const comparison = {
      vs_gpt4o: {
        deepseek_savings: ((150 - 0.24) / 150 * 100).toFixed(1) + '%',
        qwen_savings: ((150 - 1.2) / 150 * 100).toFixed(1) + '%'
      },
      vs_gemini: {
        deepseek_savings: ((75 - 0.24) / 75 * 100).toFixed(1) + '%'
      }
    };

    return {
      models,
      comparison
    };
  }
}

export default new OpenRouterService();