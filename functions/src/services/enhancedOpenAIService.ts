import OpenAI from 'openai';
import { logger } from 'firebase-functions';
import { performanceMonitoringService } from './performanceMonitoringService';
import { cacheService } from './cacheService';

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface OpenAICallContext {
  operation: 'completion' | 'embedding' | 'moderation';
  model: string;
  userId?: string;
  cacheKey?: string;
  metadata?: any;
}

interface ModelPricing {
  [model: string]: {
    input: number;  // per 1K tokens
    output: number; // per 1K tokens
  };
}

/**
 * Enhanced OpenAI service with comprehensive performance monitoring and cost tracking
 */
export class EnhancedOpenAIService {
  private client: OpenAI;
  private modelPricing: ModelPricing = {
    'gpt-4o': { input: 0.005, output: 0.015 },
    'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
    'gpt-3.5-turbo': { input: 0.001, output: 0.002 },
    'text-embedding-ada-002': { input: 0.0001, output: 0 },
    'text-embedding-3-small': { input: 0.00002, output: 0 },
    'text-embedding-3-large': { input: 0.00013, output: 0 }
  };

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Enhanced chat completion with performance tracking
   */
  async createChatCompletion(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams,
    context?: Partial<OpenAICallContext>
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const startTime = Date.now();
    const callContext: OpenAICallContext = {
      operation: 'completion',
      model: params.model,
      ...context
    };

    // Generate cache key for cacheable requests
    const cacheKey = this.generateCacheKey('completion', params);
    callContext.cacheKey = cacheKey;

    try {
      // Check cache first for deterministic requests
      if (this.isCacheable(params)) {
        const cached = await cacheService.get(cacheKey);
        if (cached) {
          logger.debug('OpenAI cache hit', { model: params.model, cacheKey });
          
          // Track cache hit
          this.trackUsage({
            ...callContext,
            responseTime: Date.now() - startTime,
            tokensUsed: cached.usage || { prompt: 0, completion: 0, total: 0 },
            cost: 0, // No cost for cache hits
            cacheHit: true
          });
          
          return cached;
        }
      }

      // Make API call
      const response = await this.client.chat.completions.create(params);
      const responseTime = Date.now() - startTime;

      // Calculate tokens and cost
      const tokensUsed = this.extractTokenUsage(response);
      const cost = this.calculateCost(params.model, tokensUsed);

      // Cache response if appropriate
      if (this.isCacheable(params) && response.choices[0]?.message) {
        const cacheData = {
          ...response,
          usage: tokensUsed
        };
        await cacheService.set(cacheKey, cacheData, {
          ttl: this.getCacheTTL(params),
          tags: ['openai', 'completions', params.model]
        });
      }

      // Track usage
      this.trackUsage({
        ...callContext,
        responseTime,
        tokensUsed,
        cost,
        cacheHit: false
      });

      // Log expensive requests
      if (cost > 0.1) { // $0.10
        logger.warn('Expensive OpenAI request', {
          model: params.model,
          cost,
          tokensUsed,
          userId: context?.userId
        });
      }

      return response;

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      // Track error
      this.trackUsage({
        ...callContext,
        responseTime,
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        cost: 0,
        error: error.message,
        cacheHit: false
      });

      logger.error('OpenAI API error', {
        model: params.model,
        error: error.message,
        responseTime,
        userId: context?.userId
      });

      throw error;
    }
  }

  /**
   * Enhanced embeddings with performance tracking
   */
  async createEmbedding(
    params: OpenAI.Embeddings.EmbeddingCreateParams,
    context?: Partial<OpenAICallContext>
  ): Promise<OpenAI.Embeddings.CreateEmbeddingResponse> {
    const startTime = Date.now();
    const callContext: OpenAICallContext = {
      operation: 'embedding',
      model: params.model,
      ...context
    };

    const cacheKey = this.generateCacheKey('embedding', params);
    callContext.cacheKey = cacheKey;

    try {
      // Check cache
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug('OpenAI embedding cache hit', { model: params.model, cacheKey });
        
        this.trackUsage({
          ...callContext,
          responseTime: Date.now() - startTime,
          tokensUsed: cached.usage || { prompt: 0, completion: 0, total: 0 },
          cost: 0,
          cacheHit: true
        });
        
        return cached;
      }

      // Make API call
      const response = await this.client.embeddings.create(params);
      const responseTime = Date.now() - startTime;

      // Calculate tokens and cost
      const tokensUsed = this.extractEmbeddingTokenUsage(response);
      const cost = this.calculateCost(params.model, tokensUsed);

      // Cache response
      const cacheData = {
        ...response,
        usage: tokensUsed
      };
      await cacheService.set(cacheKey, cacheData, {
        ttl: 86400, // 24 hours - embeddings are stable
        tags: ['openai', 'embeddings', params.model]
      });

      // Track usage
      this.trackUsage({
        ...callContext,
        responseTime,
        tokensUsed,
        cost,
        cacheHit: false
      });

      return response;

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      this.trackUsage({
        ...callContext,
        responseTime,
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        cost: 0,
        error: error.message,
        cacheHit: false
      });

      logger.error('OpenAI embedding error', {
        model: params.model,
        error: error.message,
        responseTime,
        userId: context?.userId
      });

      throw error;
    }
  }

  /**
   * Get usage statistics for a user or globally
   */
  async getUsageStats(userId?: string, period: '1h' | '24h' | '7d' | '30d' = '24h'): Promise<any> {
    try {
      return await performanceMonitoringService.getOpenAICostInsights(period);
    } catch (error) {
      logger.error('Error getting OpenAI usage stats:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  async getModelPerformance(period: '24h' | '7d' | '30d' = '24h'): Promise<any> {
    const summary = await performanceMonitoringService.getPerformanceSummary(period);
    
    return {
      period,
      models: summary.openaiMetrics,
      recommendations: this.generateOptimizationRecommendations(summary.openaiMetrics)
    };
  }

  /**
   * Health check for OpenAI service
   */
  async healthCheck(): Promise<{ status: string; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
        temperature: 0
      });
      
      const latency = Date.now() - startTime;
      
      if (!response.choices[0]?.message?.content) {
        throw new Error('Invalid response');
      }
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Private methods
   */
  private trackUsage(context: OpenAICallContext & {
    responseTime: number;
    tokensUsed: TokenUsage;
    cost: number;
    error?: string;
    cacheHit: boolean;
  }): void {
    performanceMonitoringService.trackOpenAIUsage({
      model: context.model,
      operation: context.operation,
      userId: context.userId,
      tokensUsed: context.tokensUsed,
      cost: context.cost,
      responseTime: context.responseTime,
      error: context.error,
      cacheHit: context.cacheHit
    });
  }

  private generateCacheKey(operation: string, params: any): string {
    // Create stable cache key based on operation and parameters
    const keyData = {
      operation,
      model: params.model,
      ...(operation === 'completion' && {
        messages: params.messages,
        temperature: params.temperature || 1,
        max_tokens: params.max_tokens,
        top_p: params.top_p || 1
      }),
      ...(operation === 'embedding' && {
        input: params.input,
        dimensions: params.dimensions
      })
    };
    
    const keyString = JSON.stringify(keyData);
    return `openai:${operation}:${this.hashString(keyString)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private isCacheable(params: OpenAI.Chat.Completions.ChatCompletionCreateParams): boolean {
    // Only cache deterministic requests
    const temperature = params.temperature || 1;
    const topP = params.top_p || 1;
    
    return temperature <= 0.1 && topP <= 0.1;
  }

  private getCacheTTL(params: OpenAI.Chat.Completions.ChatCompletionCreateParams): number {
    // Longer TTL for more deterministic requests
    const temperature = params.temperature || 1;
    
    if (temperature === 0) return 3600; // 1 hour for completely deterministic
    if (temperature <= 0.1) return 1800; // 30 minutes for nearly deterministic
    return 600; // 10 minutes for others
  }

  private extractTokenUsage(response: OpenAI.Chat.Completions.ChatCompletion): TokenUsage {
    if (response.usage) {
      return {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens
      };
    }
    
    // Estimate if usage not provided
    const content = response.choices[0]?.message?.content || '';
    const estimatedCompletion = Math.ceil(content.length / 4); // Rough estimate
    
    return {
      prompt: 0, // Can't estimate without input
      completion: estimatedCompletion,
      total: estimatedCompletion
    };
  }

  private extractEmbeddingTokenUsage(response: OpenAI.Embeddings.CreateEmbeddingResponse): TokenUsage {
    if (response.usage) {
      return {
        prompt: response.usage.prompt_tokens,
        completion: 0, // Embeddings don't have completion tokens
        total: response.usage.total_tokens
      };
    }
    
    return {
      prompt: 0,
      completion: 0,
      total: 0
    };
  }

  private calculateCost(model: string, tokensUsed: TokenUsage): number {
    const pricing = this.modelPricing[model];
    if (!pricing) {
      logger.warn(`Unknown model pricing: ${model}`);
      return 0;
    }
    
    const inputCost = (tokensUsed.prompt / 1000) * pricing.input;
    const outputCost = (tokensUsed.completion / 1000) * pricing.output;
    
    return inputCost + outputCost;
  }

  private generateOptimizationRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];
    
    if (metrics.cacheHitRate < 30) {
      recommendations.push('Consider increasing cache TTL or using more deterministic parameters to improve cache hit rate');
    }
    
    if (metrics.totalCost > 100) { // $100
      recommendations.push('High OpenAI costs detected. Consider using cheaper models for non-critical operations');
    }
    
    if (metrics.avgResponseTime > 5000) {
      recommendations.push('High average response times. Consider optimizing prompts or using faster models');
    }
    
    return recommendations;
  }

  /**
   * Batch processing with cost optimization
   */
  async batchProcess<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    options: {
      batchSize?: number;
      delayMs?: number;
      maxCostPerBatch?: number;
    } = {}
  ): Promise<any[]> {
    const { batchSize = 10, delayMs = 1000, maxCostPerBatch = 1.0 } = options;
    const results: any[] = [];
    let totalCost = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchStartTime = Date.now();
      let batchCost = 0;

      // Process batch items in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const result = await processor(item);
          return result;
        })
      );

      // Calculate batch cost (this would need to be tracked in processor)
      const batchEndTime = Date.now();
      const batchTime = batchEndTime - batchStartTime;

      logger.debug('Batch processed', {
        batchNumber: Math.floor(i / batchSize) + 1,
        itemsProcessed: batch.length,
        processingTime: batchTime,
        estimatedCost: batchCost
      });

      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : null));
      totalCost += batchCost;

      // Check if we're approaching cost limit
      if (totalCost > maxCostPerBatch) {
        logger.warn('Batch processing cost limit approached', {
          totalCost,
          maxCostPerBatch,
          itemsRemaining: items.length - i - batchSize
        });
      }

      // Add delay between batches to avoid rate limits
      if (i + batchSize < items.length && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    logger.info('Batch processing completed', {
      totalItems: items.length,
      totalCost,
      successfulResults: results.filter(r => r !== null).length
    });

    return results;
  }
}

export const enhancedOpenAIService = new EnhancedOpenAIService();