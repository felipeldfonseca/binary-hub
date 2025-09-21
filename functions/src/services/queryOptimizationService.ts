import { getFirestore, QuerySnapshot, DocumentData } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { cacheService } from './cacheService';

export interface QueryOptimizationConfig {
  batchSize: number;
  maxConcurrentQueries: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  indexHints: string[];
  enablePagination: boolean;
}

export interface OptimizedQueryResult<T> {
  data: T[];
  totalCount: number;
  fromCache: boolean;
  queryTime: number;
  nextPageToken?: string;
}

/**
 * Advanced query optimization service for Firestore operations
 * Implements intelligent caching, batching, and performance monitoring
 */
export class QueryOptimizationService {
  private readonly db = getFirestore();
  private readonly defaultConfig: QueryOptimizationConfig = {
    batchSize: 500,
    maxConcurrentQueries: 10,
    cacheEnabled: true,
    cacheTTL: 900, // 15 minutes
    indexHints: [],
    enablePagination: true
  };

  /**
   * Execute optimized batch queries with intelligent caching
   */
  async executeBatchQuery<T>(
    userId: string,
    collectionPath: string,
    filters: Array<{ field: string; operator: any; value: any }> = [],
    options: Partial<QueryOptimizationConfig> = {}
  ): Promise<OptimizedQueryResult<T>> {
    const config = { ...this.defaultConfig, ...options };
    const startTime = Date.now();

    // Generate cache key based on query parameters
    const cacheKey = this.generateCacheKey(userId, collectionPath, filters, config);

    try {
      // Try cache first if enabled
      if (config.cacheEnabled) {
        const cached = await cacheService.get<OptimizedQueryResult<T>>(cacheKey);
        if (cached) {
          logger.debug(`Query cache hit for ${collectionPath}`);
          return {
            ...cached,
            fromCache: true,
            queryTime: Date.now() - startTime
          };
        }
      }

      // Execute optimized query
      let query = this.db.collection(collectionPath);

      // Apply filters with index optimization
      filters.forEach(filter => {
        query = query.where(filter.field, filter.operator, filter.value);
      });

      // Add user-specific filtering for security
      if (collectionPath.includes('trades') || collectionPath.includes('analytics')) {
        query = query.where('userId', '==', userId);
      }

      // Execute query with pagination support
      const snapshot = await this.executeWithRetry(() => 
        query.limit(config.batchSize).get()
      );

      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];

      const result: OptimizedQueryResult<T> = {
        data,
        totalCount: data.length,
        fromCache: false,
        queryTime: Date.now() - startTime,
        nextPageToken: snapshot.docs.length === config.batchSize ? 
          snapshot.docs[snapshot.docs.length - 1].id : undefined
      };

      // Cache the result if enabled
      if (config.cacheEnabled && data.length > 0) {
        await cacheService.set(cacheKey, result, {
          ttl: config.cacheTTL,
          tags: [`user:${userId}`, collectionPath.split('/')[0]]
        });
      }

      logger.info(`Optimized query executed: ${collectionPath} (${result.queryTime}ms, ${data.length} items)`);
      return result;

    } catch (error) {
      logger.error(`Query optimization error for ${collectionPath}:`, error);
      throw new Error(`Failed to execute optimized query: ${error}`);
    }
  }

  /**
   * Execute aggregated queries with caching
   */
  async executeAggregatedQuery(
    userId: string,
    aggregations: Array<{
      collection: string;
      operation: 'count' | 'sum' | 'avg' | 'max' | 'min';
      field?: string;
      filters?: Array<{ field: string; operator: any; value: any }>;
    }>,
    cacheTTL: number = 1800
  ): Promise<{ [key: string]: number }> {
    const cacheKey = `aggregation:${userId}:${JSON.stringify(aggregations)}`;
    
    try {
      // Try cache first
      const cached = await cacheService.get<{ [key: string]: number }>(cacheKey);
      if (cached) {
        logger.debug(`Aggregation cache hit for user ${userId}`);
        return cached;
      }

      const results: { [key: string]: number } = {};
      
      // Execute aggregations in parallel with concurrency control
      const chunks = this.chunkArray(aggregations, this.defaultConfig.maxConcurrentQueries);
      
      for (const chunk of chunks) {
        const promises = chunk.map(async (agg, index) => {
          const key = `${agg.collection}_${agg.operation}_${agg.field || 'count'}`;
          
          let query = this.db.collection(agg.collection);
          
          // Apply user filtering
          query = query.where('userId', '==', userId);
          
          // Apply additional filters
          if (agg.filters) {
            agg.filters.forEach(filter => {
              query = query.where(filter.field, filter.operator, filter.value);
            });
          }

          const snapshot = await query.get();
          
          switch (agg.operation) {
            case 'count':
              results[key] = snapshot.size;
              break;
            case 'sum':
            case 'avg':
              const values = snapshot.docs
                .map(doc => doc.data()[agg.field!])
                .filter(val => typeof val === 'number');
              
              if (agg.operation === 'sum') {
                results[key] = values.reduce((sum, val) => sum + val, 0);
              } else {
                results[key] = values.length > 0 ? 
                  values.reduce((sum, val) => sum + val, 0) / values.length : 0;
              }
              break;
            case 'max':
            case 'min':
              const numValues = snapshot.docs
                .map(doc => doc.data()[agg.field!])
                .filter(val => typeof val === 'number');
              
              if (numValues.length > 0) {
                results[key] = agg.operation === 'max' ? 
                  Math.max(...numValues) : Math.min(...numValues);
              } else {
                results[key] = 0;
              }
              break;
          }
        });

        await Promise.all(promises);
      }

      // Cache the results
      await cacheService.set(cacheKey, results, {
        ttl: cacheTTL,
        tags: [`user:${userId}`, 'aggregation']
      });

      return results;

    } catch (error) {
      logger.error('Aggregated query error:', error);
      throw new Error('Failed to execute aggregated query');
    }
  }

  /**
   * Preload frequently accessed data
   */
  async preloadUserData(userId: string): Promise<void> {
    const preloadTasks = [
      // Preload recent trades
      this.executeBatchQuery(userId, `trades/${userId}/trades`, [
        { field: 'timestamp', operator: '>=', value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() }
      ], { batchSize: 1000, cacheTTL: 600 }),

      // Preload dashboard stats
      this.executeAggregatedQuery(userId, [
        { collection: `trades/${userId}/trades`, operation: 'count' },
        { collection: `trades/${userId}/trades`, operation: 'sum', field: 'profit' },
        { collection: `trades/${userId}/trades`, operation: 'avg', field: 'amount' }
      ], 900),

      // Preload user profile
      this.executeBatchQuery(userId, 'users', [
        { field: '__name__', operator: '==', value: userId }
      ], { batchSize: 1, cacheTTL: 3600 })
    ];

    try {
      await Promise.all(preloadTasks);
      logger.info(`Data preloaded for user ${userId}`);
    } catch (error) {
      logger.error(`Data preload error for user ${userId}:`, error);
    }
  }

  /**
   * Optimize query indexes based on usage patterns
   */
  async analyzeQueryPerformance(
    queries: Array<{ collection: string; filters: any[]; executionTime: number }>
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Analyze slow queries
    const slowQueries = queries.filter(q => q.executionTime > 1000);
    
    slowQueries.forEach(query => {
      if (query.filters.length > 1) {
        const indexFields = query.filters.map(f => f.field).join(', ');
        recommendations.push(
          `Consider composite index on ${query.collection}: [${indexFields}]`
        );
      }
      
      if (query.filters.some(f => f.operator === 'array-contains')) {
        recommendations.push(
          `Array-contains queries on ${query.collection} may need optimization`
        );
      }
    });

    // Analyze frequent collections
    const collectionCounts = queries.reduce((acc, q) => {
      acc[q.collection] = (acc[q.collection] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });

    Object.entries(collectionCounts)
      .filter(([_, count]) => count > 10)
      .forEach(([collection, count]) => {
        recommendations.push(
          `High query frequency on ${collection} (${count} queries) - consider more aggressive caching`
        );
      });

    return recommendations;
  }

  /**
   * Execute query with intelligent retry logic
   */
  private async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        logger.warn(`Query retry ${attempt}/${maxRetries} after ${delay}ms delay`);
      }
    }
    
    throw lastError!;
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(
    userId: string,
    collectionPath: string,
    filters: Array<{ field: string; operator: any; value: any }>,
    config: QueryOptimizationConfig
  ): string {
    const filterHash = JSON.stringify(filters.sort((a, b) => a.field.localeCompare(b.field)));
    return `query:${userId}:${collectionPath}:${Buffer.from(filterHash).toString('base64')}:${config.batchSize}`;
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get query performance metrics
   */
  async getPerformanceMetrics(userId: string): Promise<{
    cacheHitRate: number;
    avgQueryTime: number;
    totalQueries: number;
    slowQueries: number;
  }> {
    const cacheStats = cacheService.getStats();
    const userCacheStats = cacheStats.tags[`user:${userId}`] || {
      hits: 0,
      misses: 0,
      avgResponseTime: 0
    };

    return {
      cacheHitRate: userCacheStats.hits + userCacheStats.misses > 0 ?
        (userCacheStats.hits / (userCacheStats.hits + userCacheStats.misses)) * 100 : 0,
      avgQueryTime: userCacheStats.avgResponseTime,
      totalQueries: userCacheStats.hits + userCacheStats.misses,
      slowQueries: 0 // This would need to be tracked separately
    };
  }
}

export const queryOptimizationService = new QueryOptimizationService();