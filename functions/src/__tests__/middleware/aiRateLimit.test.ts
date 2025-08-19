import { Request, Response, NextFunction } from 'express';
import { aiRateLimit, trackAIUsage, getUserUsageStats, resetUserRateLimits } from '../../middleware/aiRateLimit';

// Mock Firebase Admin
jest.mock('firebase-admin/firestore');
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

interface MockAuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    plan?: 'free' | 'pro';
    [key: string]: any;
  };
  rateLimitInfo?: any;
}

describe('AI Rate Limiting Middleware', () => {
  let mockReq: Partial<MockAuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: {
        uid: 'test-user-123',
        email: 'test@example.com',
        plan: 'free',
      },
      headers: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn(),
      send: jest.fn(),
    };

    mockNext = jest.fn();

    // Mock Firestore
    const mockDoc = {
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
    };

    const mockCollection = {
      doc: jest.fn().mockReturnValue(mockDoc),
      where: jest.fn().mockReturnThis(),
      get: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
      batch: jest.fn().mockReturnValue({
        set: jest.fn(),
        update: jest.fn(),
        commit: jest.fn(),
      }),
    };

    jest.doMock('firebase-admin/firestore', () => ({
      getFirestore: () => mockDb,
    }));
  });

  describe('aiRateLimit middleware', () => {
    it('should allow requests within rate limits for free users', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      // Mock rate limit check - within limits
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding rate limits for free users', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      // Mock rate limit check - exceeded limits
      const now = Date.now();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'test-user-123',
          endpoint: '/insights/generate',
          requests: Array.from({ length: 5 }, () => ({ timestamp: now - 1000, success: true })),
          totalTokensUsed: 0,
          resetTime: now + 900000,
        }),
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow higher limits for pro users', async () => {
      mockReq.user!.plan = 'pro';
      const middleware = aiRateLimit('/insights/generate');
      
      // Mock rate limit check - would exceed free limit but within pro limit
      const now = Date.now();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'test-user-123',
          endpoint: '/insights/generate',
          requests: Array.from({ length: 8 }, () => ({ timestamp: now - 1000, success: true })),
          totalTokensUsed: 0,
          resetTime: now + 900000,
        }),
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalledWith(429);
    });

    it('should block unauthenticated requests', async () => {
      delete mockReq.user;
      const middleware = aiRateLimit('/insights/generate');

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should block requests exceeding token limits', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      // Mock rate limit check - within request limits
      mockDb.collection().doc().get
        .mockResolvedValueOnce({
          exists: false,
        })
        // Mock token usage check - exceeded daily limit
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            dailyUsage: 3000, // Exceeds free daily limit of 2000
            monthlyUsage: 10000,
            dailyResetTime: Date.now() + 86400000,
            monthlyResetTime: Date.now() + 2592000000,
          }),
        });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Token limit exceeded',
          code: 'TOKEN_LIMIT_EXCEEDED',
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      mockDb.collection().doc().get.mockResolvedValue({
        exists: false,
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '3',
          'X-RateLimit-Remaining': '3',
          'X-Token-Limit-Daily': '2000',
          'X-Token-Limit-Monthly': '50000',
        })
      );
    });

    it('should handle unknown endpoints gracefully', async () => {
      const middleware = aiRateLimit('/unknown/endpoint');

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle Firestore errors gracefully', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      mockDb.collection().doc().get.mockRejectedValue(new Error('Firestore error'));

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should proceed despite error
    });
  });

  describe('trackAIUsage middleware', () => {
    beforeEach(() => {
      mockReq.rateLimitInfo = {
        userId: 'test-user-123',
        endpoint: '/insights/generate',
        tier: 'free',
        config: { maxRequests: 3 },
      };
    });

    it('should track usage for successful requests', async () => {
      const middleware = trackAIUsage(400);
      
      // Mock successful response
      mockRes.statusCode = 200;
      
      // Create a spy for the original res.send
      const originalSend = jest.fn();
      mockRes.send = jest.fn().mockImplementation((data) => {
        originalSend(data);
        // Simulate the middleware's behavior
        if (mockReq.rateLimitInfo) {
          expect(mockDb.batch).toHaveBeenCalled();
        }
        return mockRes;
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should track failed requests without tokens', async () => {
      const middleware = trackAIUsage(400);
      
      // Mock failed response
      mockRes.statusCode = 500;
      
      const originalSend = jest.fn();
      mockRes.send = jest.fn().mockImplementation((data) => {
        originalSend(data);
        return mockRes;
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests without rateLimitInfo', async () => {
      delete mockReq.rateLimitInfo;
      const middleware = trackAIUsage(400);

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getUserUsageStats', () => {
    it('should retrieve user usage statistics', async () => {
      const userId = 'test-user-123';
      
      // Mock rate limits data
      mockDb.collection().where().get.mockResolvedValue({
        docs: [
          {
            data: () => ({
              userId,
              endpoint: '/insights/generate',
              requests: [{ timestamp: Date.now(), success: true, tokens: 400 }],
              totalTokensUsed: 400,
            }),
          },
        ],
      });

      // Mock token usage data
      mockDb.collection().doc().get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            dailyUsage: 800,
            monthlyUsage: 5000,
            dailyResetTime: Date.now() + 86400000,
            monthlyResetTime: Date.now() + 2592000000,
          }),
        })
        // Mock monthly stats
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            userId,
            year: 2024,
            month: 1,
            endpoints: {
              '/insights/generate': {
                requests: 10,
                successfulRequests: 8,
                tokensUsed: 3200,
              },
            },
          }),
        });

      const stats = await getUserUsageStats(userId);

      expect(stats).toHaveProperty('rateLimits');
      expect(stats).toHaveProperty('tokenUsage');
      expect(stats).toHaveProperty('monthlyStats');
      expect(stats.rateLimits['/insights/generate']).toBeDefined();
    });

    it('should handle missing data gracefully', async () => {
      const userId = 'test-user-123';
      
      mockDb.collection().where().get.mockResolvedValue({ docs: [] });
      mockDb.collection().doc().get.mockResolvedValue({ exists: false });

      const stats = await getUserUsageStats(userId);

      expect(stats.rateLimits).toEqual({});
      expect(stats.tokenUsage).toEqual({});
      expect(stats.monthlyStats).toEqual({});
    });

    it('should handle Firestore errors', async () => {
      const userId = 'test-user-123';
      
      mockDb.collection().where().get.mockRejectedValue(new Error('Firestore error'));

      const stats = await getUserUsageStats(userId);

      expect(stats.rateLimits).toEqual({});
      expect(stats.tokenUsage).toEqual({});
      expect(stats.monthlyStats).toEqual({});
    });
  });

  describe('resetUserRateLimits', () => {
    it('should reset specific endpoint rate limits', async () => {
      const userId = 'test-user-123';
      const endpoint = '/insights/generate';

      await resetUserRateLimits(userId, endpoint);

      expect(mockDb.collection().doc()).toHaveBeenCalledWith(`${userId}_${endpoint}`);
    });

    it('should reset all user rate limits', async () => {
      const userId = 'test-user-123';
      
      mockDb.collection().where().get.mockResolvedValue({
        docs: [
          { ref: { delete: jest.fn() } },
          { ref: { delete: jest.fn() } },
        ],
      });

      await resetUserRateLimits(userId);

      expect(mockDb.batch().commit).toHaveBeenCalled();
    });

    it('should handle errors during reset', async () => {
      const userId = 'test-user-123';
      
      mockDb.collection().doc().delete.mockRejectedValue(new Error('Delete error'));

      await expect(resetUserRateLimits(userId, '/insights/generate')).rejects.toThrow();
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should have different limits for different endpoints', async () => {
      const generateMiddleware = aiRateLimit('/insights/generate');
      const coachMiddleware = aiRateLimit('/insights/coach');
      
      // Both should work, but with different configurations
      mockDb.collection().doc().get.mockResolvedValue({ exists: false });

      await generateMiddleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      (mockNext as jest.MockedFunction<NextFunction>).mockClear();

      await coachMiddleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should handle time window correctly', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      const now = Date.now();
      // Mock requests outside the time window (should be filtered out)
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          userId: 'test-user-123',
          endpoint: '/insights/generate',
          requests: [
            { timestamp: now - 20 * 60 * 1000, success: true }, // 20 minutes ago (outside 15min window)
            { timestamp: now - 5 * 60 * 1000, success: true },   // 5 minutes ago (within window)
          ],
          totalTokensUsed: 0,
          resetTime: now + 900000,
        }),
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow because only 1 request in window
    });

    it('should update reset time correctly', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      mockDb.collection().doc().get.mockResolvedValue({ exists: false });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockDb.collection().doc().set).toHaveBeenCalledWith(
        expect.objectContaining({
          resetTime: expect.any(Number),
        })
      );
    });
  });

  describe('Token Limit Calculations', () => {
    it('should reset counters when periods expire', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      const now = Date.now();
      const yesterdayStart = now - 25 * 60 * 60 * 1000; // 25 hours ago
      
      mockDb.collection().doc().get
        .mockResolvedValueOnce({ exists: false }) // Rate limit check
        .mockResolvedValueOnce({ // Token usage check
          exists: true,
          data: () => ({
            dailyUsage: 1500,
            monthlyUsage: 10000,
            dailyResetTime: yesterdayStart, // Expired
            monthlyResetTime: now + 2592000000,
          }),
        });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow because daily counter reset
    });

    it('should calculate monthly reset correctly', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      const now = Date.now();
      const lastMonth = now - 32 * 24 * 60 * 60 * 1000; // 32 days ago
      
      mockDb.collection().doc().get
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            dailyUsage: 100,
            monthlyUsage: 60000, // Would exceed limit if not reset
            dailyResetTime: now + 86400000,
            monthlyResetTime: lastMonth, // Expired
          }),
        });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should allow because monthly counter reset
    });
  });

  describe('Error Messages', () => {
    it('should provide appropriate error messages for different user tiers', async () => {
      const middleware = aiRateLimit('/insights/generate');
      
      // Mock exceeded limit
      const now = Date.now();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          requests: Array.from({ length: 5 }, () => ({ timestamp: now - 1000 })),
          resetTime: now + 900000,
        }),
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Atualize para Pro'),
        })
      );
    });

    it('should provide different message for pro users', async () => {
      mockReq.user!.plan = 'pro';
      const middleware = aiRateLimit('/insights/generate');
      
      const now = Date.now();
      mockDb.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({
          requests: Array.from({ length: 12 }, () => ({ timestamp: now - 1000 })), // Exceeds pro limit
          resetTime: now + 900000,
        }),
      });

      await middleware(mockReq as MockAuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Aguarde alguns minutos'),
        })
      );
    });
  });
});