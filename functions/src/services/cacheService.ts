import { createClient, RedisClientType } from 'redis';
import NodeCache from 'node-cache';
import { logger } from 'firebase-functions';

export interface CacheConfig {
  redis: {
    enabled: boolean;
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
  };
  memory: {
    enabled: boolean;
    stdTTL: number; // Default TTL in seconds
    checkperiod: number; // Check period for expired keys
    maxKeys: number; // Maximum number of keys
  };
}

export interface CacheStats {
  redis: {
    connected: boolean;
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    errors: number;
  };
  memory: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    keys: number;
    size: number;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
  };
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  useRedis?: boolean; // Force Redis usage
  useMemory?: boolean; // Force memory cache usage
  compress?: boolean; // Compress data
  tags?: string[]; // Cache tags for invalidation
}

/**
 * Comprehensive caching service with Redis and memory cache support
 * Provides tiered caching with fallback mechanisms
 */
export class CacheService {
  private redisClient: RedisClientType | null = null;
  private memoryCache: NodeCache;
  private config: CacheConfig;
  private stats: CacheStats;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      redis: {
        enabled: process.env.NODE_ENV === 'production' && !!process.env.REDIS_URL,
        url: process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        ...config?.redis
      },
      memory: {
        enabled: true,
        stdTTL: 3600, // 1 hour default
        checkperiod: 600, // Check every 10 minutes
        maxKeys: 10000,
        ...config?.memory
      }
    };

    // Initialize memory cache
    this.memoryCache = new NodeCache({
      stdTTL: this.config.memory.stdTTL,
      checkperiod: this.config.memory.checkperiod,
      maxKeys: this.config.memory.maxKeys,
      useClones: false // For performance
    });

    // Initialize stats
    this.stats = {
      redis: { connected: false, hits: 0, misses: 0, sets: 0, deletes: 0, errors: 0 },
      memory: { hits: 0, misses: 0, sets: 0, deletes: 0, keys: 0, size: 0 },
      overall: { totalHits: 0, totalMisses: 0, hitRate: 0 }
    };

    // Initialize Redis if enabled
    this.initializeRedis();

    // Setup memory cache event listeners
    this.setupMemoryCacheListeners();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.redis.enabled) {
      logger.info('Redis caching disabled');
      return;
    }

    try {
      const redisConfig = this.config.redis.url 
        ? { url: this.config.redis.url }
        : {
            socket: {
              host: this.config.redis.host,
              port: this.config.redis.port
            },
            password: this.config.redis.password,
            database: this.config.redis.db
          };

      this.redisClient = createClient(redisConfig);

      this.redisClient.on('error', (err) => {
        logger.error('Redis Client Error:', err);
        this.stats.redis.errors++;
        this.stats.redis.connected = false;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis Client Connected');
        this.stats.redis.connected = true;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Redis Client Disconnected');
        this.stats.redis.connected = false;
      });

      await this.redisClient.connect();
      logger.info('Redis cache initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis:', error);
      this.config.redis.enabled = false;
      this.stats.redis.errors++;
    }
  }

  /**
   * Setup memory cache event listeners for stats
   */
  private setupMemoryCacheListeners(): void {
    this.memoryCache.on('set', (key: string, value: any) => {
      this.stats.memory.sets++;
    });

    this.memoryCache.on('del', (key: string, value: any) => {
      this.stats.memory.deletes++;
    });

    this.memoryCache.on('expired', (key: string, value: any) => {
      this.stats.memory.deletes++;
    });
  }

  /**
   * Get value from cache with tiered fallback
   */
  async get<T = any>(key: string, options?: CacheOptions): Promise<T | null> {
    const useRedis = options?.useRedis ?? this.config.redis.enabled;
    const useMemory = options?.useMemory ?? this.config.memory.enabled;

    try {
      // Try memory cache first (fastest)
      if (useMemory) {
        const memoryValue = this.memoryCache.get<T>(key);
        if (memoryValue !== undefined) {
          this.stats.memory.hits++;
          this.updateOverallStats();
          logger.debug(`Cache HIT (memory): ${key}`);
          return memoryValue;
        }
        this.stats.memory.misses++;
      }

      // Try Redis cache (if memory miss)
      if (useRedis && this.redisClient?.isOpen) {
        try {
          const redisValue = await this.redisClient.get(key);
          if (redisValue) {
            const parsedValue = JSON.parse(redisValue);
            this.stats.redis.hits++;
            
            // Store in memory cache for faster access next time
            if (useMemory) {
              this.memoryCache.set(key, parsedValue, options?.ttl || this.config.memory.stdTTL);
            }
            
            this.updateOverallStats();
            logger.debug(`Cache HIT (redis): ${key}`);
            return parsedValue;
          }
          this.stats.redis.misses++;
        } catch (redisError) {
          logger.error('Redis get error:', redisError);
          this.stats.redis.errors++;
        }
      }

      this.updateOverallStats();
      logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with tiered storage
   */
  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    const useRedis = options?.useRedis ?? this.config.redis.enabled;
    const useMemory = options?.useMemory ?? this.config.memory.enabled;
    const ttl = options?.ttl || this.config.memory.stdTTL;

    let success = false;

    try {
      // Store in memory cache
      if (useMemory) {
        this.memoryCache.set(key, value, ttl);
        this.stats.memory.sets++;
        success = true;
        logger.debug(`Cache SET (memory): ${key}, TTL: ${ttl}s`);
      }

      // Store in Redis cache
      if (useRedis && this.redisClient?.isOpen) {
        try {
          const serializedValue = JSON.stringify(value);
          if (ttl > 0) {
            await this.redisClient.setEx(key, ttl, serializedValue);
          } else {
            await this.redisClient.set(key, serializedValue);
          }
          this.stats.redis.sets++;
          success = true;
          logger.debug(`Cache SET (redis): ${key}, TTL: ${ttl}s`);
        } catch (redisError) {
          logger.error('Redis set error:', redisError);
          this.stats.redis.errors++;
        }
      }

      // Handle cache tags for invalidation
      if (options?.tags && options.tags.length > 0) {
        await this.tagKey(key, options.tags);
      }

      return success;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    let success = false;

    try {
      // Delete from memory cache
      if (this.config.memory.enabled) {
        const deleted = this.memoryCache.del(key);
        if (deleted > 0) {
          this.stats.memory.deletes++;
          success = true;
        }
      }

      // Delete from Redis cache
      if (this.config.redis.enabled && this.redisClient?.isOpen) {
        try {
          const deleted = await this.redisClient.del(key);
          if (deleted > 0) {
            this.stats.redis.deletes++;
            success = true;
          }
        } catch (redisError) {
          logger.error('Redis delete error:', redisError);
          this.stats.redis.errors++;
        }
      }

      logger.debug(`Cache DELETE: ${key}`);
      return success;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<boolean> {
    let success = false;

    try {
      // Clear memory cache
      if (this.config.memory.enabled) {
        this.memoryCache.flushAll();
        success = true;
      }

      // Clear Redis cache
      if (this.config.redis.enabled && this.redisClient?.isOpen) {
        try {
          await this.redisClient.flushDb();
          success = true;
        } catch (redisError) {
          logger.error('Redis clear error:', redisError);
          this.stats.redis.errors++;
        }
      }

      logger.info('Cache cleared');
      return success;
    } catch (error) {
      logger.error('Cache clear error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTag(tag: string): Promise<boolean> {
    try {
      const tagKey = `tags:${tag}`;
      
      // Get keys with this tag from Redis
      if (this.config.redis.enabled && this.redisClient?.isOpen) {
        try {
          const keys = await this.redisClient.sMembers(tagKey);
          if (keys.length > 0) {
            // Delete all tagged keys
            await this.redisClient.del(keys);
            // Delete the tag set
            await this.redisClient.del(tagKey);
            
            // Also delete from memory cache
            keys.forEach(key => this.memoryCache.del(key));
            
            logger.info(`Invalidated ${keys.length} cache entries with tag: ${tag}`);
            return true;
          }
        } catch (redisError) {
          logger.error('Redis tag invalidation error:', redisError);
          this.stats.redis.errors++;
        }
      }

      return false;
    } catch (error) {
      logger.error('Tag invalidation error:', error);
      return false;
    }
  }

  /**
   * Associate key with tags for invalidation
   */
  private async tagKey(key: string, tags: string[]): Promise<void> {
    if (!this.config.redis.enabled || !this.redisClient?.isOpen) {
      return;
    }

    try {
      for (const tag of tags) {
        const tagKey = `tags:${tag}`;
        await this.redisClient.sAdd(tagKey, key);
      }
    } catch (error) {
      logger.error('Tag key error:', error);
      this.stats.redis.errors++;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    // Update memory cache stats
    this.stats.memory.keys = this.memoryCache.keys().length;
    this.stats.memory.size = this.memoryCache.getStats().ksize;

    // Update overall stats
    this.updateOverallStats();

    return { ...this.stats };
  }

  /**
   * Update overall statistics
   */
  private updateOverallStats(): void {
    const totalHits = this.stats.redis.hits + this.stats.memory.hits;
    const totalMisses = this.stats.redis.misses + this.stats.memory.misses;
    const total = totalHits + totalMisses;
    
    this.stats.overall.totalHits = totalHits;
    this.stats.overall.totalMisses = totalMisses;
    this.stats.overall.hitRate = total > 0 ? (totalHits / total) * 100 : 0;
  }

  /**
   * Warm cache with commonly accessed data
   */
  async warmCache(userId: string): Promise<void> {
    try {
      logger.info(`Warming cache for user: ${userId}`);
      
      // Import trade service dynamically to avoid circular dependencies
      const { tradeService } = await import('./tradeService');
      
      // Warm user's trade statistics
      const statsKey = `stats:${userId}:weekly`;
      const stats = await tradeService.getTradeStats(userId, 'weekly');
      await this.set(statsKey, stats, { ttl: 1800, tags: [`user:${userId}`, 'stats'] }); // 30 minutes
      
      // Warm recent trades
      const tradesKey = `trades:${userId}:recent`;
      const recentTrades = await tradeService.getUserTrades(userId, { limit: 50 });
      await this.set(tradesKey, recentTrades, { ttl: 900, tags: [`user:${userId}`, 'trades'] }); // 15 minutes
      
      logger.info(`Cache warmed for user: ${userId}`);
    } catch (error) {
      logger.error('Cache warming error:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ redis: boolean; memory: boolean }> {
    return {
      redis: this.config.redis.enabled && this.redisClient?.isOpen === true,
      memory: this.config.memory.enabled
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.redisClient?.isOpen) {
      await this.redisClient.quit();
    }
    this.memoryCache.flushAll();
  }
}

// Singleton instance
export const cacheService = new CacheService();