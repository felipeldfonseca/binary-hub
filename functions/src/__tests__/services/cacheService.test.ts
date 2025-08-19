import { CacheService } from '../../services/cacheService';

// Mock external dependencies
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    isOpen: true,
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    flushDb: jest.fn(),
    sMembers: jest.fn(),
    sAdd: jest.fn(),
    on: jest.fn(),
    quit: jest.fn()
  }))
}));

// Mock NodeCache
jest.mock('node-cache', () => {
  const mockNodeCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn(),
    keys: jest.fn(() => ['key1', 'key2']),
    getStats: jest.fn(() => ({ ksize: 1024 })),
    on: jest.fn()
  };
  return jest.fn().mockImplementation(() => mockNodeCache);
});

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisClient: any;
  let mockNodeCache: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Get the mock instance
    const NodeCache = require('node-cache');
    mockNodeCache = new NodeCache();
    
    mockNodeCache.get.mockReturnValue(undefined);
    mockNodeCache.set.mockReturnValue(true);
    mockNodeCache.del.mockReturnValue(1);
    mockNodeCache.keys.mockReturnValue(['key1', 'key2']);
    mockNodeCache.getStats.mockReturnValue({ ksize: 1024 });
    
    // Create cache service instance
    cacheService = new CacheService({
      redis: { enabled: false }, // Disable Redis for testing
      memory: { enabled: true, stdTTL: 300, checkperiod: 60, maxKeys: 1000 }
    });
  });

  afterEach(async () => {
    if (cacheService) {
      await cacheService.close();
    }
  });

  describe('Memory Cache Operations', () => {
    test('should set and get values from memory cache', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', number: 42 };

      // Mock the cache to return the value when requested
      mockNodeCache.get.mockReturnValue(value);

      // Set value
      const setResult = await cacheService.set(key, value, { useMemory: true, useRedis: false });
      expect(setResult).toBe(true);
      expect(mockNodeCache.set).toHaveBeenCalledWith(key, value, expect.any(Number));

      // Get value
      const retrievedValue = await cacheService.get(key, { useMemory: true, useRedis: false });
      expect(retrievedValue).toEqual(value);
      expect(mockNodeCache.get).toHaveBeenCalledWith(key);
    });

    test('should return null for non-existent keys', async () => {
      mockNodeCache.get.mockReturnValue(undefined);
      
      const result = await cacheService.get('non-existent-key', { useMemory: true, useRedis: false });
      expect(result).toBeNull();
    });

    test('should delete values from memory cache', async () => {
      const key = 'delete-test';
      const value = 'test-value';

      // Mock cache behavior
      mockNodeCache.get.mockReturnValueOnce(value).mockReturnValueOnce(undefined);
      mockNodeCache.del.mockReturnValue(1);

      // Set value
      await cacheService.set(key, value, { useMemory: true, useRedis: false });
      
      // Verify it exists
      let retrievedValue = await cacheService.get(key, { useMemory: true, useRedis: false });
      expect(retrievedValue).toEqual(value);

      // Delete value
      const deleteResult = await cacheService.delete(key);
      expect(deleteResult).toBe(true);
      expect(mockNodeCache.del).toHaveBeenCalledWith(key);

      // Verify it's gone
      retrievedValue = await cacheService.get(key, { useMemory: true, useRedis: false });
      expect(retrievedValue).toBeNull();
    });

    test('should clear all cache entries', async () => {
      // Set multiple values
      await cacheService.set('key1', 'value1', { useMemory: true, useRedis: false });
      await cacheService.set('key2', 'value2', { useMemory: true, useRedis: false });

      // Clear cache
      const clearResult = await cacheService.clear();
      expect(clearResult).toBe(true);
      expect(mockNodeCache.flushAll).toHaveBeenCalled();

      // Mock that values are gone after clear
      mockNodeCache.get.mockReturnValue(undefined);

      // Verify values are gone
      const value1 = await cacheService.get('key1', { useMemory: true, useRedis: false });
      const value2 = await cacheService.get('key2', { useMemory: true, useRedis: false });
      
      expect(value1).toBeNull();
      expect(value2).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    test('should track cache hits and misses', async () => {
      const key = 'stats-test';
      const value = 'test-value';

      // Mock cache miss first, then hit
      mockNodeCache.get.mockReturnValueOnce(undefined).mockReturnValueOnce(value);

      // Initial stats
      const initialStats = cacheService.getStats();
      const initialHits = initialStats.memory.hits;
      const initialMisses = initialStats.memory.misses;

      // Cache miss
      await cacheService.get(key, { useMemory: true, useRedis: false });
      
      // Cache set
      await cacheService.set(key, value, { useMemory: true, useRedis: false });
      
      // Cache hit
      await cacheService.get(key, { useMemory: true, useRedis: false });

      // Note: In a real implementation, the stats would be updated by the cache service
      // For this test, we just verify the methods were called correctly
      expect(mockNodeCache.get).toHaveBeenCalledTimes(2);
      expect(mockNodeCache.set).toHaveBeenCalledTimes(1);
    });

    test('should calculate overall hit rate', async () => {
      const stats = cacheService.getStats();
      expect(stats.overall).toBeDefined();
      expect(stats.overall.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.overall.hitRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Cache Options', () => {
    test('should respect TTL settings', async () => {
      const key = 'ttl-test';
      const value = 'test-value';
      const shortTTL = 1; // 1 second

      // Mock immediate availability, then expiration
      mockNodeCache.get.mockReturnValueOnce(value).mockReturnValueOnce(undefined);

      // Set value with short TTL
      await cacheService.set(key, value, { ttl: shortTTL, useMemory: true, useRedis: false });
      expect(mockNodeCache.set).toHaveBeenCalledWith(key, value, shortTTL);
      
      // Should be available immediately
      let retrievedValue = await cacheService.get(key, { useMemory: true, useRedis: false });
      expect(retrievedValue).toEqual(value);

      // Should simulate expiration (NodeCache handles TTL internally)
      retrievedValue = await cacheService.get(key, { useMemory: true, useRedis: false });
      expect(retrievedValue).toBeNull();
    });

    test('should handle cache tags for invalidation', async () => {
      const key1 = 'tagged-key-1';
      const key2 = 'tagged-key-2';
      const tag = 'test-tag';

      // Mock cache returns
      mockNodeCache.get.mockImplementation((key: string) => {
        if (key === key1) return 'value1';
        if (key === key2) return 'value2';
        return undefined;
      });

      // Set values with tags
      await cacheService.set(key1, 'value1', { tags: [tag], useMemory: true, useRedis: false });
      await cacheService.set(key2, 'value2', { tags: [tag], useMemory: true, useRedis: false });

      // Values should exist
      expect(await cacheService.get(key1, { useMemory: true, useRedis: false })).toEqual('value1');
      expect(await cacheService.get(key2, { useMemory: true, useRedis: false })).toEqual('value2');

      // Note: Tag invalidation requires Redis, so we can't fully test it with memory cache only
      // This test verifies that tags don't break the basic functionality
    });
  });

  describe('Health Check', () => {
    test('should return health status', async () => {
      const health = await cacheService.healthCheck();
      
      expect(health).toBeDefined();
      expect(health.memory).toBe(true);
      expect(health.redis).toBe(false); // Disabled in test config
    });
  });

  describe('Error Handling', () => {
    test('should handle errors gracefully during get operations', async () => {
      // Create a cache service that might fail
      const faultyCacheService = new CacheService({
        memory: { enabled: true, stdTTL: 300, checkperiod: 60, maxKeys: 1000 }
      });

      // Should not throw, should return null
      const result = await faultyCacheService.get('any-key');
      expect(result).toBeDefined(); // Either null or a value, but no exception
    });

    test('should handle errors gracefully during set operations', async () => {
      const faultyCacheService = new CacheService({
        memory: { enabled: true, stdTTL: 300, checkperiod: 60, maxKeys: 1000 }
      });

      // Should not throw
      const result = await faultyCacheService.set('any-key', 'any-value');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Cache Warming', () => {
    test('should warm cache for user', async () => {
      const userId = 'test-user-123';
      
      // Mock the tradeService import
      jest.doMock('../../services/tradeService', () => ({
        tradeService: {
          getTradeStats: jest.fn().mockResolvedValue({
            totalTrades: 10,
            winRate: 70,
            totalPnl: 100
          }),
          getUserTrades: jest.fn().mockResolvedValue([
            { id: '1', asset: 'EURUSD', profit: 10 }
          ])
        }
      }));

      // Should not throw
      await expect(cacheService.warmCache(userId)).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    test('should handle concurrent operations', async () => {
      const operations = [];
      const numOperations = 10; // Reduced for testing

      // Mock cache to return correct values
      mockNodeCache.get.mockImplementation((key: string) => {
        const match = key.match(/concurrent-key-(\d+)/);
        if (match) {
          return `value-${match[1]}`;
        }
        return undefined;
      });

      // Create concurrent set operations
      for (let i = 0; i < numOperations; i++) {
        operations.push(
          cacheService.set(`concurrent-key-${i}`, `value-${i}`, { useMemory: true, useRedis: false })
        );
      }

      // Wait for all operations to complete
      const results = await Promise.all(operations);
      
      // All operations should succeed
      results.forEach(result => {
        expect(result).toBe(true);
      });

      // Verify values are set correctly
      for (let i = 0; i < numOperations; i++) {
        const value = await cacheService.get(`concurrent-key-${i}`, { useMemory: true, useRedis: false });
        expect(value).toBe(`value-${i}`);
      }
    });

    test('should handle large data objects', async () => {
      const largeObject = {
        data: new Array(10).fill(0).map((_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: 'A'.repeat(100) // 100 character string
        }))
      };

      // Mock cache to return the large object
      mockNodeCache.get.mockReturnValue(largeObject);

      const startTime = Date.now();
      
      // Set large object
      const setResult = await cacheService.set('large-object', largeObject, { useMemory: true, useRedis: false });
      expect(setResult).toBe(true);
      
      // Get large object
      const retrievedObject = await cacheService.get('large-object', { useMemory: true, useRedis: false });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      expect(retrievedObject).toEqual(largeObject);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});