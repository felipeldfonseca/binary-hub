import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { cacheService } from './cacheService';
import { analyticsService } from './analyticsService';
import { tradeService } from './tradeService';

export interface WarmingStrategy {
  name: string;
  description: string;
  priority: number; // 1 = highest priority
  condition?: (userId: string) => Promise<boolean>;
  execute: (userId: string) => Promise<void>;
}

export interface WarmingStats {
  totalUsers: number;
  successfulWarmings: number;
  failedWarmings: number;
  duration: number;
  strategies: {
    [strategyName: string]: {
      executed: number;
      successful: number;
      failed: number;
      avgDuration: number;
    };
  };
}

/**
 * Service for warming cache with commonly accessed data
 * Implements various warming strategies based on user patterns
 */
export class CacheWarmingService {
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }
  private warmingStrategies: WarmingStrategy[] = [];

  constructor() {
    this.registerWarmingStrategies();
  }

  /**
   * Register all warming strategies
   */
  private registerWarmingStrategies(): void {
    // Strategy 1: Dashboard Analytics (Most Common)
    this.warmingStrategies.push({
      name: 'dashboard-analytics',
      description: 'Warm dashboard analytics for active users',
      priority: 1,
      condition: async (userId: string) => {
        // Warm for users who have trades
        const trades = await tradeService.getUserTrades(userId, { limit: 1 });
        return trades.length > 0;
      },
      execute: async (userId: string) => {
        const periods: ('daily' | 'weekly' | 'monthly' | 'yearly')[] = ['weekly', 'monthly'];
        
        for (const period of periods) {
          await analyticsService.getDashboardAnalytics(userId, period);
        }
      }
    });

    // Strategy 2: Comprehensive Analytics
    this.warmingStrategies.push({
      name: 'comprehensive-analytics',
      description: 'Warm comprehensive analytics for power users',
      priority: 2,
      condition: async (userId: string) => {
        // Warm for users with more than 50 trades
        const trades = await tradeService.getUserTrades(userId, { limit: 51 });
        return trades.length > 50;
      },
      execute: async (userId: string) => {
        await analyticsService.getAnalytics(userId, 'weekly');
        await analyticsService.getAnalytics(userId, 'monthly');
      }
    });

    // Strategy 3: Recent Trades
    this.warmingStrategies.push({
      name: 'recent-trades',
      description: 'Warm recent trades list',
      priority: 3,
      execute: async (userId: string) => {
        await tradeService.getUserTrades(userId, { limit: 50 });
        await tradeService.getUserTrades(userId, { limit: 20 });
      }
    });

    // Strategy 4: Asset Performance
    this.warmingStrategies.push({
      name: 'asset-performance',
      description: 'Warm asset performance analytics',
      priority: 4,
      condition: async (userId: string) => {
        // Warm for users with trades in multiple assets
        const trades = await tradeService.getUserTrades(userId, { limit: 100 });
        const uniqueAssets = new Set(trades.map(t => t.asset));
        return uniqueAssets.size > 2;
      },
      execute: async (userId: string) => {
        await analyticsService.getAssetAnalytics(userId);
      }
    });

    // Strategy 5: Trade Statistics
    this.warmingStrategies.push({
      name: 'trade-statistics',
      description: 'Warm trade statistics for different periods',
      priority: 5,
      execute: async (userId: string) => {
        const periods: ('daily' | 'weekly' | 'monthly' | 'yearly')[] = ['weekly', 'monthly'];
        
        for (const period of periods) {
          await tradeService.getTradeStats(userId, period);
        }
      }
    });

    // Sort by priority
    this.warmingStrategies.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Warm cache for a specific user
   */
  async warmUserCache(userId: string, strategies?: string[]): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting cache warming for user: ${userId}`);
      
      // Filter strategies if specified
      const strategiesToExecute = strategies 
        ? this.warmingStrategies.filter(s => strategies.includes(s.name))
        : this.warmingStrategies;

      for (const strategy of strategiesToExecute) {
        const strategyStartTime = Date.now();
        
        try {
          // Check condition if specified
          if (strategy.condition) {
            const shouldExecute = await strategy.condition(userId);
            if (!shouldExecute) {
              logger.debug(`Skipping strategy ${strategy.name} for user ${userId} - condition not met`);
              continue;
            }
          }

          // Execute strategy
          await strategy.execute(userId);
          
          const strategyDuration = Date.now() - strategyStartTime;
          logger.debug(`Strategy ${strategy.name} completed for user ${userId} in ${strategyDuration}ms`);
          
        } catch (error) {
          logger.error(`Strategy ${strategy.name} failed for user ${userId}:`, error);
          // Continue with other strategies
        }
      }

      const totalDuration = Date.now() - startTime;
      logger.info(`Cache warming completed for user ${userId} in ${totalDuration}ms`);
      
    } catch (error) {
      logger.error(`Cache warming failed for user ${userId}:`, error);
    }
  }

  /**
   * Warm cache for multiple users
   */
  async warmUsersCache(userIds: string[], concurrency = 5): Promise<WarmingStats> {
    const startTime = Date.now();
    const stats: WarmingStats = {
      totalUsers: userIds.length,
      successfulWarmings: 0,
      failedWarmings: 0,
      duration: 0,
      strategies: {}
    };

    // Initialize strategy stats
    this.warmingStrategies.forEach(strategy => {
      stats.strategies[strategy.name] = {
        executed: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0
      };
    });

    logger.info(`Starting batch cache warming for ${userIds.length} users with concurrency ${concurrency}`);

    // Process users in batches
    for (let i = 0; i < userIds.length; i += concurrency) {
      const batch = userIds.slice(i, i + concurrency);
      
      await Promise.allSettled(
        batch.map(async (userId) => {
          try {
            await this.warmUserCache(userId);
            stats.successfulWarmings++;
          } catch (error) {
            stats.failedWarmings++;
            logger.error(`Cache warming failed for user ${userId}:`, error);
          }
        })
      );

      // Log progress
      const progress = Math.min(i + concurrency, userIds.length);
      logger.info(`Cache warming progress: ${progress}/${userIds.length} users completed`);
    }

    stats.duration = Date.now() - startTime;
    
    logger.info(`Batch cache warming completed: ${stats.successfulWarmings} successful, ${stats.failedWarmings} failed, ${stats.duration}ms total`);
    
    return stats;
  }

  /**
   * Warm cache for active users (users with recent trades)
   */
  async warmActiveUsersCache(days = 7, limit = 100): Promise<WarmingStats> {
    try {
      logger.info(`Finding active users from last ${days} days (limit: ${limit})`);
      
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      // Get active users from trades collection
      const activeUserIds = new Set<string>();
      
      // Query across all users' trades (simplified approach)
      const usersSnapshot = await this.db.collection('users').limit(limit).get();
      
      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        
        // Check if user has recent trades
        const tradesSnapshot = await this.db
          .collection('users')
          .doc(userId)
          .collection('trades')
          .where('entryTime', '>=', cutoffDate)
          .limit(1)
          .get();
        
        if (!tradesSnapshot.empty) {
          activeUserIds.add(userId);
        }
      }

      const activeUsers = Array.from(activeUserIds);
      logger.info(`Found ${activeUsers.length} active users for cache warming`);
      
      if (activeUsers.length === 0) {
        return {
          totalUsers: 0,
          successfulWarmings: 0,
          failedWarmings: 0,
          duration: 0,
          strategies: {}
        };
      }

      return await this.warmUsersCache(activeUsers);
      
    } catch (error) {
      logger.error('Error warming active users cache:', error);
      throw error;
    }
  }

  /**
   * Smart warming based on user access patterns
   */
  async smartWarmCache(): Promise<WarmingStats> {
    try {
      logger.info('Starting smart cache warming');
      
      // Get users who accessed the system recently
      const recentAccessUsers = await this.getRecentAccessUsers();
      
      // Prioritize users by activity level
      const prioritizedUsers = await this.prioritizeUsers(recentAccessUsers);
      
      // Warm cache for high-priority users first
      return await this.warmUsersCache(prioritizedUsers.slice(0, 50), 3); // Top 50 users, concurrency 3
      
    } catch (error) {
      logger.error('Smart cache warming error:', error);
      throw error;
    }
  }

  /**
   * Get users who accessed the system recently
   */
  private async getRecentAccessUsers(hours = 24): Promise<string[]> {
    // This is a simplified implementation
    // In a real system, you'd track user access patterns
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;
    
    // For now, get users with recent trades as proxy for activity
    const activeUsers = new Set<string>();
    const usersSnapshot = await this.db.collection('users').limit(200).get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      const tradesSnapshot = await this.db
        .collection('users')
        .doc(userId)
        .collection('trades')
        .where('createdAt', '>=', new Date(cutoffTime))
        .limit(1)
        .get();
      
      if (!tradesSnapshot.empty) {
        activeUsers.add(userId);
      }
    }
    
    return Array.from(activeUsers);
  }

  /**
   * Prioritize users based on activity patterns
   */
  private async prioritizeUsers(userIds: string[]): Promise<string[]> {
    const userPriorities: Array<{ userId: string; score: number }> = [];
    
    for (const userId of userIds) {
      let score = 0;
      
      try {
        // Get user's trade count (higher = better)
        const trades = await tradeService.getUserTrades(userId, { limit: 100 });
        score += Math.min(trades.length, 100); // Max 100 points for trades
        
        // Recent activity bonus
        const recentTrades = trades.filter(t => 
          t.createdAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        );
        score += recentTrades.length * 2; // 2 points per recent trade
        
        // Diversity bonus (multiple assets)
        const uniqueAssets = new Set(trades.map(t => t.asset));
        score += uniqueAssets.size * 5; // 5 points per unique asset
        
        userPriorities.push({ userId, score });
        
      } catch (error) {
        logger.error(`Error calculating priority for user ${userId}:`, error);
        userPriorities.push({ userId, score: 0 });
      }
    }
    
    // Sort by score (highest first)
    userPriorities.sort((a, b) => b.score - a.score);
    
    return userPriorities.map(up => up.userId);
  }

  /**
   * Warm cache for specific data patterns
   */
  async warmSpecificData(pattern: 'dashboard' | 'trades' | 'analytics' | 'assets', userIds?: string[]): Promise<void> {
    const users = userIds || await this.getRecentAccessUsers(48); // Last 48 hours
    
    logger.info(`Warming ${pattern} data for ${users.length} users`);
    
    const strategies = this.warmingStrategies.filter(strategy => {
      switch (pattern) {
        case 'dashboard':
          return strategy.name.includes('dashboard');
        case 'trades':
          return strategy.name.includes('trades');
        case 'analytics':
          return strategy.name.includes('analytics');
        case 'assets':
          return strategy.name.includes('asset');
        default:
          return false;
      }
    });
    
    const strategyNames = strategies.map(s => s.name);
    
    for (const userId of users.slice(0, 30)) { // Limit to 30 users for specific warming
      await this.warmUserCache(userId, strategyNames);
    }
    
    logger.info(`Completed warming ${pattern} data`);
  }

  /**
   * Schedule cache warming
   */
  async scheduleWarmingTask(): Promise<void> {
    try {
      logger.info('Executing scheduled cache warming');
      
      // Different warming strategies based on time of day
      const hour = new Date().getHours();
      
      if (hour >= 6 && hour <= 9) {
        // Morning: Warm dashboard data (users checking their performance)
        await this.warmSpecificData('dashboard');
      } else if (hour >= 12 && hour <= 14) {
        // Lunch: Light warming
        await this.warmActiveUsersCache(3, 50); // Last 3 days, 50 users
      } else if (hour >= 18 && hour <= 22) {
        // Evening: Full analytics warming (users analyzing their day)
        await this.smartWarmCache();
      } else {
        // Off-hours: Maintenance warming
        await this.warmActiveUsersCache(1, 20); // Last day, 20 most active users
      }
      
    } catch (error) {
      logger.error('Scheduled cache warming error:', error);
    }
  }

  /**
   * Get warming statistics
   */
  getWarmingStrategies(): WarmingStrategy[] {
    return [...this.warmingStrategies];
  }
}

export const cacheWarmingService = new CacheWarmingService();