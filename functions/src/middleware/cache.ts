import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';
import { logger } from 'firebase-functions';
import crypto from 'crypto';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

export interface CacheMiddlewareOptions {
  ttl?: number; // Cache TTL in seconds
  keyGenerator?: (req: Request) => string; // Custom key generator
  condition?: (req: Request, res: Response) => boolean; // Cache condition
  tags?: string[] | ((req: Request) => string[]); // Cache tags
  varyBy?: string[]; // Headers to vary cache by
  skipCache?: boolean; // Skip cache (for debugging)
  useRedis?: boolean; // Force Redis usage
  useMemory?: boolean; // Force memory cache usage
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, options?: CacheMiddlewareOptions): string {
  if (options?.keyGenerator) {
    return options.keyGenerator(req);
  }

  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.uid || 'anonymous';
  const method = req.method;
  const path = req.path;
  const query = JSON.stringify(req.query);
  
  // Include vary headers in key
  let varyData = '';
  if (options?.varyBy) {
    const varyValues = options.varyBy.map(header => req.get(header) || '').join('|');
    varyData = crypto.createHash('md5').update(varyValues).digest('hex');
  }

  const keyData = `${method}:${path}:${query}:${userId}:${varyData}`;
  return crypto.createHash('md5').update(keyData).digest('hex');
}

/**
 * Get cache tags from request
 */
function getCacheTags(req: Request, options?: CacheMiddlewareOptions): string[] {
  if (!options?.tags) return [];
  
  if (Array.isArray(options.tags)) {
    return options.tags;
  }
  
  if (typeof options.tags === 'function') {
    return options.tags(req);
  }
  
  return [];
}

/**
 * Cache middleware for API responses
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip cache if disabled
    if (options.skipCache) {
      return next();
    }

    // Check cache condition
    if (options.condition && !options.condition(req, res)) {
      return next();
    }

    // Only cache GET requests by default
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = generateCacheKey(req, options);
    const startTime = Date.now();

    try {
      // Try to get from cache
      const cachedData = await cacheService.get(cacheKey, {
        useRedis: options.useRedis,
        useMemory: options.useMemory
      });

      if (cachedData) {
        const duration = Date.now() - startTime;
        logger.debug(`Cache HIT: ${cacheKey} (${duration}ms)`);
        
        // Set cache headers
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        res.set('X-Cache-Duration', `${duration}ms`);
        
        return res.json(cachedData);
      }

      // Cache miss - intercept response
      const originalJson = res.json;
      res.json = function(data: any) {
        const duration = Date.now() - startTime;
        
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const tags = getCacheTags(req, options);
          cacheService.set(cacheKey, data, {
            ttl: options.ttl,
            tags,
            useRedis: options.useRedis,
            useMemory: options.useMemory
          }).catch(error => {
            logger.error('Cache set error:', error);
          });
          
          // Set cache headers
          res.set('X-Cache', 'MISS');
          res.set('X-Cache-Key', cacheKey);
          res.set('X-Cache-Duration', `${duration}ms`);
          
          logger.debug(`Cache MISS: ${cacheKey} (${duration}ms)`);
        }
        
        return originalJson.call(this, data);
      };
      
    } catch (error) {
      logger.error('Cache middleware error:', error);
    }

    return next();
  };
}

/**
 * Cache invalidation middleware
 * Invalidates cache when data changes (POST, PUT, DELETE)
 */
export function cacheInvalidationMiddleware(options: {
  patterns?: string[]; // Cache key patterns to invalidate
  tags?: string[] | ((req: Request) => string[]); // Cache tags to invalidate
  condition?: (req: Request, res: Response) => boolean; // Invalidation condition
} = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if condition not met
    if (options.condition && !options.condition(req, res)) {
      return next();
    }

    // Only invalidate on write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    const originalJson = res.json;
    res.json = function(data: any) {
      // Only invalidate on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const authReq = req as AuthenticatedRequest;
        const userId = authReq.user?.uid;
        
        // Invalidate by tags
        const tags = options.tags 
          ? (Array.isArray(options.tags) ? options.tags : options.tags(req))
          : [];
        
        // Add default user tag
        if (userId) {
          tags.push(`user:${userId}`);
        }
        
        // Invalidate tags
        tags.forEach(tag => {
          cacheService.invalidateByTag(tag).catch(error => {
            logger.error(`Cache invalidation error for tag ${tag}:`, error);
          });
        });
        
        logger.debug(`Cache invalidated for tags: ${tags.join(', ')}`);
      }
      
      return originalJson.call(this, data);
    };

    return next();
  };
}

/**
 * Cache warming middleware
 * Warms cache after successful operations
 */
export function cacheWarmingMiddleware(options: {
  condition?: (req: Request, res: Response) => boolean;
  warmFunction?: (req: Request) => Promise<void>;
} = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    res.json = function(data: any) {
      // Only warm cache on successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (!options.condition || options.condition(req, res)) {
          const authReq = req as AuthenticatedRequest;
          const userId = authReq.user?.uid;
          
          if (options.warmFunction) {
            options.warmFunction(req).catch(error => {
              logger.error('Cache warming error:', error);
            });
          } else if (userId) {
            // Default warming
            cacheService.warmCache(userId).catch(error => {
              logger.error('Default cache warming error:', error);
            });
          }
        }
      }
      
      return originalJson.call(this, data);
    };

    return next();
  };
}

/**
 * Cache statistics middleware
 * Adds cache statistics to response headers
 */
export function cacheStatsMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    res.json = function(data: any) {
      const stats = cacheService.getStats();
      
      // Add cache stats to response headers
      res.set('X-Cache-Hit-Rate', `${stats.overall.hitRate.toFixed(2)}%`);
      res.set('X-Cache-Total-Hits', stats.overall.totalHits.toString());
      res.set('X-Cache-Total-Misses', stats.overall.totalMisses.toString());
      res.set('X-Cache-Memory-Keys', stats.memory.keys.toString());
      res.set('X-Cache-Redis-Connected', stats.redis.connected.toString());
      
      return originalJson.call(this, data);
    };

    return next();
  };
}

/**
 * Cache health check middleware
 */
export function cacheHealthMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/cache/health') {
      try {
        const health = await cacheService.healthCheck();
        const stats = cacheService.getStats();
        
        return res.json({
          status: 'ok',
          cache: {
            redis: {
              enabled: health.redis,
              connected: stats.redis.connected,
              stats: stats.redis
            },
            memory: {
              enabled: health.memory,
              stats: stats.memory
            },
            overall: stats.overall
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        logger.error('Cache health check error:', error);
        return res.status(500).json({
          status: 'error',
          error: 'Cache health check failed',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return next();
  };
}

/**
 * Cache management middleware (for admin operations)
 */
export function cacheManagementMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/cache/')) {
      try {
        switch (req.path) {
          case '/cache/clear':
            if (req.method === 'POST') {
              await cacheService.clear();
              return res.json({ 
                status: 'ok', 
                message: 'Cache cleared',
                timestamp: new Date().toISOString()
              });
            }
            break;
            
          case '/cache/stats':
            if (req.method === 'GET') {
              const stats = cacheService.getStats();
              return res.json({
                status: 'ok',
                stats,
                timestamp: new Date().toISOString()
              });
            }
            break;
            
          case '/cache/invalidate':
            if (req.method === 'POST') {
              const { tag } = req.body;
              if (tag) {
                await cacheService.invalidateByTag(tag);
                return res.json({
                  status: 'ok',
                  message: `Cache invalidated for tag: ${tag}`,
                  timestamp: new Date().toISOString()
                });
              }
              return res.status(400).json({
                error: 'Tag parameter required',
                timestamp: new Date().toISOString()
              });
            }
            break;
        }
      } catch (error) {
        logger.error('Cache management error:', error);
        return res.status(500).json({
          status: 'error',
          error: 'Cache management operation failed',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return next();
  };
}