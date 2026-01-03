import { PerformanceMonitoringService } from '../../services/performanceMonitoringService';
import { logger } from 'firebase-functions';

// Mock Firebase Admin SDK
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue({
      docs: [],
      size: 0,
      empty: true
    }),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    batch: jest.fn(() => ({
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined)
    }))
  }))
}));

// Mock Firebase Functions logger
jest.mock('firebase-functions', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('PerformanceMonitoringService', () => {
  let performanceMonitoringService: PerformanceMonitoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Create a fresh instance for each test
    performanceMonitoringService = new PerformanceMonitoringService();
  });

  afterEach(() => {
    // Clean up timers after each test
    performanceMonitoringService.cleanup();
  });

  describe('trackAPIPerformance', () => {
    it('should track API performance metrics', () => {
      const metric = {
        endpoint: '/api/test',
        method: 'GET',
        userId: 'user123',
        responseTime: 1500,
        statusCode: 200
      };

      expect(() => {
        performanceMonitoringService.trackAPIPerformance(metric);
      }).not.toThrow();

      expect(logger.debug).toHaveBeenCalledWith(
        'API performance metric tracked',
        expect.objectContaining({
          endpoint: '/api/test',
          responseTime: 1500,
          statusCode: 200
        })
      );
    });

    it('should include memory usage in metrics', () => {
      const metric = {
        endpoint: '/api/memory-test',
        method: 'POST',
        responseTime: 800,
        statusCode: 201
      };

      performanceMonitoringService.trackAPIPerformance(metric);

      // Verify that memory usage is captured (indirectly through logger)
      expect(logger.debug).toHaveBeenCalled();
    });
  });

  describe('trackDatabasePerformance', () => {
    it('should track database operation metrics', () => {
      const metric = {
        operation: 'query' as const,
        collection: 'users',
        userId: 'user123',
        executionTime: 250,
        documentsProcessed: 10,
        queryComplexity: 'medium' as const
      };

      expect(() => {
        performanceMonitoringService.trackDatabasePerformance(metric);
      }).not.toThrow();

      expect(logger.debug).toHaveBeenCalledWith(
        'Database performance metric tracked',
        expect.objectContaining({
          operation: 'query',
          collection: 'users',
          executionTime: 250
        })
      );
    });

    it('should handle different operation types', () => {
      const writeMetric = {
        operation: 'write' as const,
        collection: 'trades',
        executionTime: 500,
        documentsProcessed: 1
      };

      performanceMonitoringService.trackDatabasePerformance(writeMetric);

      expect(logger.debug).toHaveBeenCalledWith(
        'Database performance metric tracked',
        expect.objectContaining({
          operation: 'write',
          collection: 'trades'
        })
      );
    });
  });

  describe('trackOpenAIUsage', () => {
    it('should track OpenAI usage and cost', () => {
      const metric = {
        model: 'gpt-4o-mini',
        operation: 'completion' as const,
        userId: 'user123',
        tokensUsed: {
          prompt: 100,
          completion: 50,
          total: 150
        },
        cost: 0.025,
        responseTime: 2000,
        cacheHit: false
      };

      expect(() => {
        performanceMonitoringService.trackOpenAIUsage(metric);
      }).not.toThrow();

      expect(logger.debug).toHaveBeenCalledWith(
        'OpenAI usage metric tracked',
        expect.objectContaining({
          model: 'gpt-4o-mini',
          operation: 'completion',
          cost: 0.025,
          tokensUsed: 150
        })
      );
    });

    it('should track cache hits', () => {
      const cacheHitMetric = {
        model: 'gpt-3.5-turbo',
        operation: 'completion' as const,
        tokensUsed: {
          prompt: 50,
          completion: 25,
          total: 75
        },
        cost: 0,
        responseTime: 100,
        cacheHit: true
      };

      performanceMonitoringService.trackOpenAIUsage(cacheHitMetric);

      expect(logger.debug).toHaveBeenCalledWith(
        'OpenAI usage metric tracked',
        expect.objectContaining({
          cost: 0,
          cacheHit: true
        })
      );
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return performance summary for valid period', async () => {
      // Mock empty data
      const summary = await performanceMonitoringService.getPerformanceSummary('24h');

      expect(summary).toBeDefined();
      expect(summary.period).toBe('24h');
      expect(summary.timestamp).toBeInstanceOf(Date);
      expect(summary.apiMetrics).toBeDefined();
      expect(summary.databaseMetrics).toBeDefined();
      expect(summary.openaiMetrics).toBeDefined();
      expect(summary.systemMetrics).toBeDefined();
      expect(summary.activeAlerts).toBeDefined();
    });

    it('should handle different time periods', async () => {
      const periods = ['1h', '24h', '7d', '30d'] as const;

      for (const period of periods) {
        const summary = await performanceMonitoringService.getPerformanceSummary(period);
        expect(summary.period).toBe(period);
      }
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts', () => {
      const alerts = performanceMonitoringService.getActiveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  describe('configureAlert', () => {
    it('should configure new alert', () => {
      const alertConfig = {
        id: 'test_alert',
        name: 'Test Alert',
        type: 'response_time' as const,
        threshold: 5000,
        duration: 5,
        severity: 'high' as const,
        enabled: true,
        cooldown: 15
      };

      expect(() => {
        performanceMonitoringService.configureAlert(alertConfig);
      }).not.toThrow();

      expect(logger.info).toHaveBeenCalledWith(
        'Alert configured: Test Alert',
        expect.objectContaining({ config: alertConfig })
      );
    });
  });

  describe('clearAlert', () => {
    it('should clear alert by ID', () => {
      const alertId = 'test_alert_123';

      expect(() => {
        performanceMonitoringService.clearAlert(alertId);
      }).not.toThrow();
    });
  });

  describe('getOpenAICostInsights', () => {
    it('should return cost insights', async () => {
      const insights = await performanceMonitoringService.getOpenAICostInsights('24h');

      expect(insights).toBeDefined();
      expect(insights.period).toBe('24h');
      expect(insights.totalCost).toBeDefined();
      expect(insights.totalRequests).toBeDefined();
      expect(insights.modelBreakdown).toBeInstanceOf(Array);
      expect(insights.operationBreakdown).toBeInstanceOf(Array);
    });
  });

  describe('getPerformanceTrends', () => {
    it('should return performance trends', async () => {
      const trends = await performanceMonitoringService.getPerformanceTrends('24h');

      expect(trends).toBeDefined();
      expect(trends.period).toBe('24h');
      expect(trends.trends).toBeInstanceOf(Array);
      expect(trends.summary).toBeDefined();
    });
  });

  describe('getSystemHealth', () => {
    it('should return current system health metrics', () => {
      const health = performanceMonitoringService.getSystemHealth();

      expect(health).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.cpu).toBeDefined();
      expect(health.memory).toBeDefined();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include memory metrics', () => {
      const health = performanceMonitoringService.getSystemHealth();

      expect(health.memory.free).toBeGreaterThanOrEqual(0);
      expect(health.memory.total).toBeGreaterThan(0);
      expect(health.memory.heapUsed).toBeGreaterThanOrEqual(0);
      expect(health.memory.heapTotal).toBeGreaterThan(0);
    });

    it('should include CPU metrics', () => {
      const health = performanceMonitoringService.getSystemHealth();

      expect(health.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(health.cpu.loadAverage).toBeInstanceOf(Array);
      expect(health.cpu.loadAverage).toHaveLength(3);
    });
  });

  describe('Alert System', () => {
    it('should trigger alerts for high response times', () => {
      // Configure alert
      performanceMonitoringService.configureAlert({
        id: 'high_response_time',
        name: 'High Response Time',
        type: 'response_time',
        threshold: 1000,
        duration: 1,
        severity: 'high',
        enabled: true,
        cooldown: 5
      });

      // Track high response time
      performanceMonitoringService.trackAPIPerformance({
        endpoint: '/slow-endpoint',
        method: 'GET',
        responseTime: 5000,
        statusCode: 200
      });

      // Verify alert was logged
      expect(logger.warn).toHaveBeenCalledWith(
        'Alert triggered',
        expect.objectContaining({
          severity: 'high'
        })
      );
    });

    it('should respect cooldown periods', () => {
      jest.clearAllMocks();

      // Configure alert with short cooldown
      performanceMonitoringService.configureAlert({
        id: 'cooldown_test',
        name: 'Cooldown Test',
        type: 'response_time',
        threshold: 1000,
        duration: 1,
        severity: 'high',
        enabled: true,
        cooldown: 1 // 1 minute
      });

      // Trigger alert twice quickly
      performanceMonitoringService.trackAPIPerformance({
        endpoint: '/test1',
        method: 'GET',
        responseTime: 5000,
        statusCode: 200
      });

      performanceMonitoringService.trackAPIPerformance({
        endpoint: '/test2',
        method: 'GET',
        responseTime: 5000,
        statusCode: 200
      });

      // Should only trigger once due to cooldown
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in performance summary gracefully', async () => {
      // Mock error in database operation
      const mockError = new Error('Database connection failed');
      jest.spyOn(performanceMonitoringService as any, 'getAPIMetrics')
        .mockRejectedValueOnce(mockError);

      await expect(
        performanceMonitoringService.getPerformanceSummary('1h')
      ).rejects.toThrow('Failed to get performance summary');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting performance summary:',
        mockError
      );
    });

    it('should handle errors in cost insights gracefully', async () => {
      const mockError = new Error('Failed to fetch metrics');
      jest.spyOn(performanceMonitoringService as any, 'getOpenAIMetrics')
        .mockRejectedValueOnce(mockError);

      await expect(
        performanceMonitoringService.getOpenAICostInsights('24h')
      ).rejects.toThrow('Failed to get OpenAI cost insights');

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting OpenAI cost insights:',
        mockError
      );
    });
  });

  describe('Metrics Buffer Management', () => {
    it('should flush metrics when buffer is full', () => {
      const flushSpy = jest.spyOn(performanceMonitoringService as any, 'flushMetrics');
      
      // Fill buffer beyond maxBufferSize
      for (let i = 0; i < 1500; i++) {
        performanceMonitoringService.trackAPIPerformance({
          endpoint: `/test-${i}`,
          method: 'GET',
          responseTime: 100,
          statusCode: 200
        });
      }

      expect(flushSpy).toHaveBeenCalled();
    });
  });
});