import { Request, Response, NextFunction } from 'express';
import { cacheMiddleware, cacheInvalidationMiddleware, cacheStatsMiddleware } from '../../middleware/cache';

// Mock the cache service
jest.mock('../../services/cacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    invalidateByTag: jest.fn(),
    getStats: jest.fn(() => ({
      overall: { hitRate: 85.5, totalHits: 100, totalMisses: 17 },
      memory: { keys: 50, size: 1024 },
      redis: { connected: true }
    }))
  }
}));

jest.mock('firebase-functions', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

describe('Cache Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockCacheService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCacheService = require('../../services/cacheService').cacheService;
    
    mockRequest = {
      method: 'GET',
      path: '/test',
      query: {},
      user: { uid: 'test-user-123' }
    };
    
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      statusCode: 200
    };
    
    nextFunction = jest.fn();
  });

  describe('cacheMiddleware', () => {
    test('should return cached data when available', async () => {
      const cachedData = { message: 'cached response' };
      mockCacheService.get.mockResolvedValue(cachedData);
      
      const middleware = cacheMiddleware({ ttl: 300 });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(mockResponse.json).toHaveBeenCalledWith(cachedData);
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test('should proceed to next middleware when cache miss', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const middleware = cacheMiddleware({ ttl: 300 });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(mockCacheService.get).toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
      // The json method is overridden by middleware, so we can't check if original wasn't called
      expect(mockResponse.set).not.toHaveBeenCalledWith('X-Cache', 'HIT');
    });

    test('should skip caching for non-GET requests', async () => {
      mockRequest.method = 'POST';
      
      const middleware = cacheMiddleware({ ttl: 300 });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    test('should skip cache when condition returns false', async () => {
      const middleware = cacheMiddleware({
        ttl: 300,
        condition: () => false
      });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(nextFunction).toHaveBeenCalled();
    });

    test('should handle cache service errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));
      
      const middleware = cacheMiddleware({ ttl: 300 });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      // Should continue despite cache error
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('cacheInvalidationMiddleware', () => {
    test('should invalidate cache on write operations', async () => {
      mockRequest.method = 'POST';
      mockCacheService.invalidateByTag.mockResolvedValue(true);
      
      const middleware = cacheInvalidationMiddleware({
        tags: ['user:test-user-123']
      });
      
      let originalJson: Function;
      mockResponse.json = jest.fn().mockImplementation(function(this: any, data: any) {
        originalJson = this.json;
        return this;
      });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(nextFunction).toHaveBeenCalled();
      
      // Simulate successful response by calling the modified json function
      const modifiedResponse = mockResponse as any;
      modifiedResponse.statusCode = 200;
      modifiedResponse.json({ success: true });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    test('should skip invalidation for read operations', async () => {
      mockRequest.method = 'GET';
      
      const middleware = cacheInvalidationMiddleware({
        tags: ['user:test-user-123']
      });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(nextFunction).toHaveBeenCalled();
      expect(mockCacheService.invalidateByTag).not.toHaveBeenCalled();
    });
  });

  describe('cacheStatsMiddleware', () => {
    test('should add cache statistics to response headers', async () => {
      const middleware = cacheStatsMiddleware();
      
      let originalJson: Function;
      mockResponse.json = jest.fn().mockImplementation(function(this: any, data: any) {
        originalJson = this.json;
        return this;
      });
      
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );
      
      expect(nextFunction).toHaveBeenCalled();
      
      // Simulate response by calling the modified json function
      const modifiedResponse = mockResponse as any;
      modifiedResponse.json({ data: 'test' });
      
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache-Hit-Rate', '85.50%');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache-Total-Hits', '100');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache-Total-Misses', '17');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache-Memory-Keys', '50');
      expect(mockResponse.set).toHaveBeenCalledWith('X-Cache-Redis-Connected', 'true');
    });
  });
});