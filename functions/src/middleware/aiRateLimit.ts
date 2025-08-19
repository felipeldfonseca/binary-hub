import { Request, Response, NextFunction } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const getDb = () => getFirestore();

// Simple rate limiting for AI endpoints
export const aiRateLimit = (endpoint: string) => {
  return async (req: any, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const userId = req.user.uid;
      const userTier = req.user.plan || 'free';
      
      // Simple rate limits
      const limits: any = {
        '/insights/generate': { free: 3, pro: 10 },
        '/insights/coach': { free: 5, pro: 20 },
        '/trades/check-rules': { free: 10, pro: 50 },
        '/import/validate-csv': { free: 5, pro: 20 }
      };

      const limit = limits[endpoint]?.[userTier] || 5;
      const windowMs = 15 * 60 * 1000; // 15 minutes
      
      const now = Date.now();
      const windowStart = now - windowMs;
      
      const db = getDb();
      const rateLimitDoc = db.collection('rate_limits').doc(`${userId}_${endpoint}`);
      const doc = await rateLimitDoc.get();
      
      let requests: any[] = [];
      if (doc.exists) {
        requests = doc.data()?.requests || [];
      }
      
      // Remove old requests
      requests = requests.filter((r: any) => r.timestamp > windowStart);
      
      if (requests.length >= limit) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          details: {
            limit,
            resetTime: now + windowMs
          }
        });
        return;
      }
      
      // Add current request
      requests.push({ timestamp: now, success: false });
      
      await rateLimitDoc.set({
        userId,
        endpoint,
        requests,
        resetTime: now + windowMs
      });

      // Set headers
      res.set({
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': (limit - requests.length).toString()
      });

      req.rateLimitInfo = {
        userId,
        endpoint,
        tier: userTier,
        config: { maxRequests: limit }
      };

      next();
    } catch (error) {
      logger.error('Error in AI rate limit middleware:', error);
      next(); // Allow request to proceed if rate limit check fails
    }
  };
};

export const trackAIUsage = (tokens: number) => {
  return (req: any, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      // Track usage for successful requests
      if (res.statusCode >= 200 && res.statusCode < 300 && req.rateLimitInfo) {
        // Update the request to mark as successful
        // This is a simplified version - in production you'd want more robust tracking
        logger.info('AI usage tracked', {
          userId: req.rateLimitInfo.userId,
          endpoint: req.rateLimitInfo.endpoint,
          tokens,
          success: true
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

// Simplified stats function
export async function getUserUsageStats(userId: string): Promise<any> {
  try {
    const db = getDb();
    
    // Get basic rate limit info
    const rateLimitsSnapshot = await db.collection('rate_limits')
      .where('userId', '==', userId)
      .get();
    
    const rateLimits: any = {};
    for (const doc of rateLimitsSnapshot.docs) {
      const data = doc.data();
      rateLimits[data.endpoint] = {
        requests: data.requests?.length || 0,
        resetTime: data.resetTime
      };
    }
    
    return {
      rateLimits,
      tokenUsage: {},
      monthlyStats: {}
    };
  } catch (error) {
    logger.error('Error getting user usage stats:', error);
    return {
      rateLimits: {},
      tokenUsage: {},
      monthlyStats: {}
    };
  }
}

export async function resetUserRateLimits(userId: string, endpoint?: string): Promise<void> {
  try {
    const db = getDb();
    
    if (endpoint) {
      await db.collection('rate_limits').doc(`${userId}_${endpoint}`).delete();
    } else {
      const snapshot = await db.collection('rate_limits')
        .where('userId', '==', userId)
        .get();
      
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    }
    
    logger.info(`Rate limits reset for user ${userId}`, { endpoint });
  } catch (error) {
    logger.error('Error resetting rate limits:', error);
    throw error;
  }
}