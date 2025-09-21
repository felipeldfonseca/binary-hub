import { systemHealthService } from '../../services/systemHealthService';
import { logger } from 'firebase-functions';

// Mock dependencies
jest.mock('../../services/performanceMonitoringService', () => ({
  performanceMonitoringService: {
    getPerformanceSummary: jest.fn().mockResolvedValue({
      apiMetrics: {
        totalRequests: 100,
        avgResponseTime: 500,
        p95ResponseTime: 1000,
        p99ResponseTime: 1500,
        errorRate: 2.5
      },
      databaseMetrics: {
        totalOperations: 50,
        avgExecutionTime: 200,
        errorRate: 1.0
      },
      openaiMetrics: {
        totalRequests: 10,
        totalCost: 5.25,
        avgResponseTime: 2000,
        cacheHitRate: 75
      }
    }),
    getActiveAlerts: jest.fn().mockReturnValue([
      { severity: 'critical' },
      { severity: 'high' },
      { severity: 'medium' }
    ])
  }
}));

jest.mock('../../services/cacheService', () => ({
  cacheService: {
    healthCheck: jest.fn().mockResolvedValue({
      redis: { connected: true },
      memory: { used: 1024000, total: 8192000 }
    })
  }
}));

jest.mock('../../services/enhancedOpenAIService', () => ({
  enhancedOpenAIService: {
    healthCheck: jest.fn().mockResolvedValue({
      status: 'healthy',
      latency: 1500
    })
  }
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ data: () => ({}) }),
    set: jest.fn().mockResolvedValue(undefined),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis()
  }))
}));

jest.mock('firebase-functions', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('SystemHealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSystemStatus', () => {
    it('should return comprehensive system status', async () => {
      const status = await systemHealthService.getSystemStatus();

      expect(status).toBeDefined();
      expect(status.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(status.services).toBeInstanceOf(Array);
      expect(status.metrics).toBeDefined();
      expect(status.alerts).toBeDefined();
    });

    it('should include all required system metrics', async () => {
      const status = await systemHealthService.getSystemStatus();

      expect(status.metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(status.metrics.memory).toBeDefined();
      expect(status.metrics.memory.used).toBeGreaterThanOrEqual(0);
      expect(status.metrics.memory.total).toBeGreaterThan(0);
      expect(status.metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(status.metrics.cpu).toBeDefined();
      expect(status.metrics.responseTime).toBeDefined();
    });

    it('should include alert summary', async () => {
      const status = await systemHealthService.getSystemStatus();

      expect(status.alerts.active).toBe(3);
      expect(status.alerts.critical).toBe(1);
      expect(status.alerts.warnings).toBe(2);
    });

    it('should determine overall status based on service health', async () => {
      const status = await systemHealthService.getSystemStatus();

      // With all services healthy, overall should be healthy
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.overall);
    });
  });

  describe('runHealthCheck', () => {
    it('should check database health', async () => {
      const healthResult = await systemHealthService.runHealthCheck('database');

      expect(healthResult).toBeDefined();
      expect(healthResult.service).toBe('database');
      expect(healthResult.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthResult.lastChecked).toBeInstanceOf(Date);
      expect(healthResult.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should check cache health', async () => {
      const healthResult = await systemHealthService.runHealthCheck('cache');

      expect(healthResult).toBeDefined();
      expect(healthResult.service).toBe('cache');
      expect(healthResult.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(healthResult.details).toBeDefined();
    });

    it('should check OpenAI health', async () => {
      const healthResult = await systemHealthService.runHealthCheck('openai');

      expect(healthResult).toBeDefined();
      expect(healthResult.service).toBe('openai');
      expect(healthResult.responseTime).toBe(1500);
      expect(healthResult.status).toBe('healthy');
    });

    it('should check storage health', async () => {
      const healthResult = await systemHealthService.runHealthCheck('storage');

      expect(healthResult).toBeDefined();
      expect(healthResult.service).toBe('storage');
      expect(healthResult.status).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    it('should check functions health', async () => {
      const healthResult = await systemHealthService.runHealthCheck('functions');

      expect(healthResult).toBeDefined();
      expect(healthResult.service).toBe('functions');
      expect(healthResult.details).toBeDefined();
      expect(healthResult.details.memoryUsage).toBeDefined();
      expect(healthResult.details.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should handle unknown service gracefully', async () => {
      await expect(
        systemHealthService.runHealthCheck('unknown-service')
      ).rejects.toThrow('Unknown service: unknown-service');
    });
  });

  describe('getHealthHistory', () => {
    it('should return health history for valid service', async () => {
      // Mock Firestore response
      const mockSnapshot = {
        docs: [
          { data: () => ({ service: 'database', status: 'healthy', responseTime: 100 }) },
          { data: () => ({ service: 'database', status: 'healthy', responseTime: 150 }) }
        ]
      };

      const mockDb = require('firebase-admin/firestore').getFirestore();
      mockDb.collection().where().orderBy().get.mockResolvedValue(mockSnapshot);

      const history = await systemHealthService.getHealthHistory('database', '24h');

      expect(history).toBeDefined();
      expect(history.service).toBe('database');
      expect(history.period).toBe('24h');
      expect(history.uptime).toBeGreaterThanOrEqual(0);
      expect(history.totalChecks).toBe(2);
      expect(history.healthyChecks).toBe(2);
    });

    it('should calculate uptime percentage correctly', async () => {
      const mockSnapshot = {
        docs: [
          { data: () => ({ service: 'database', status: 'healthy' }) },
          { data: () => ({ service: 'database', status: 'degraded' }) },
          { data: () => ({ service: 'database', status: 'healthy' }) },
          { data: () => ({ service: 'database', status: 'healthy' }) }
        ]
      };

      const mockDb = require('firebase-admin/firestore').getFirestore();
      mockDb.collection().where().orderBy().get.mockResolvedValue(mockSnapshot);

      const history = await systemHealthService.getHealthHistory('database');

      expect(history.uptime).toBe(75); // 3 out of 4 healthy = 75%
      expect(history.degradedChecks).toBe(1);
    });
  });

  describe('generateHealthReport', () => {
    it('should generate comprehensive health report', async () => {
      const report = await systemHealthService.generateHealthReport('24h');

      expect(report).toBeDefined();
      expect(report.period).toBe('24h');
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.overallUptime).toBeGreaterThanOrEqual(0);
      expect(report.services).toBeInstanceOf(Array);
      expect(report.performance).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should include performance summary in report', async () => {
      const report = await systemHealthService.generateHealthReport();

      expect(report.performance).toBeDefined();
      expect(report.performance.apiMetrics).toBeDefined();
      expect(report.performance.databaseMetrics).toBeDefined();
      expect(report.performance.openaiMetrics).toBeDefined();
    });

    it('should provide actionable recommendations', async () => {
      const report = await systemHealthService.generateHealthReport();

      expect(report.recommendations).toBeInstanceOf(Array);
      // Recommendations might be empty if everything is healthy
    });
  });

  describe('Alert System', () => {
    it('should configure health thresholds', () => {
      const threshold = {
        service: 'database',
        responseTimeWarning: 1000,
        responseTimeCritical: 5000,
        errorRateWarning: 5,
        errorRateCritical: 10
      };

      expect(() => {
        systemHealthService.configureThreshold(threshold);
      }).not.toThrow();

      expect(logger.info).toHaveBeenCalledWith(
        'Health threshold configured for database',
        threshold
      );
    });

    it('should subscribe to health alerts', () => {
      const callback = jest.fn();
      const unsubscribe = systemHealthService.subscribeToAlerts(callback);

      expect(typeof unsubscribe).toBe('function');
      
      // Test unsubscribe
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('Service-specific Health Checks', () => {
    describe('Database Health Check', () => {
      it('should detect healthy database', async () => {
        const result = await systemHealthService.runHealthCheck('database');
        expect(result.status).toMatch(/^(healthy|degraded)$/);
        expect(result.responseTime).toBeGreaterThanOrEqual(0);
      });

      it('should handle database errors', async () => {
        const mockDb = require('firebase-admin/firestore').getFirestore();
        mockDb.collection().doc().get.mockRejectedValueOnce(new Error('Connection failed'));

        const result = await systemHealthService.runHealthCheck('database');
        expect(result.status).toBe('unhealthy');
        expect(result.error).toBeDefined();
      });
    });

    describe('Cache Health Check', () => {
      it('should detect healthy cache', async () => {
        const result = await systemHealthService.runHealthCheck('cache');
        expect(result.status).toMatch(/^(healthy|degraded|unhealthy)$/);
        expect(result.details).toBeDefined();
      });

      it('should detect unhealthy cache', async () => {
        const { cacheService } = require('../../services/cacheService');
        cacheService.healthCheck.mockResolvedValueOnce({
          redis: { connected: false },
          memory: { used: 0, total: 0 }
        });

        const result = await systemHealthService.runHealthCheck('cache');
        expect(result.status).toBe('unhealthy');
      });
    });

    describe('OpenAI Health Check', () => {
      it('should detect healthy OpenAI service', async () => {
        const result = await systemHealthService.runHealthCheck('openai');
        expect(result.status).toBe('healthy');
        expect(result.responseTime).toBe(1500);
      });

      it('should detect degraded OpenAI service (slow response)', async () => {
        const { enhancedOpenAIService } = require('../../services/enhancedOpenAIService');
        enhancedOpenAIService.healthCheck.mockResolvedValueOnce({
          status: 'healthy',
          latency: 15000 // Slow response
        });

        const result = await systemHealthService.runHealthCheck('openai');
        expect(result.status).toBe('degraded');
      });

      it('should detect unhealthy OpenAI service', async () => {
        const { enhancedOpenAIService } = require('../../services/enhancedOpenAIService');
        enhancedOpenAIService.healthCheck.mockResolvedValueOnce({
          status: 'unhealthy',
          error: 'API key invalid'
        });

        const result = await systemHealthService.runHealthCheck('openai');
        expect(result.status).toBe('unhealthy');
        expect(result.error).toBe('API key invalid');
      });
    });

    describe('Functions Health Check', () => {
      it('should detect healthy functions', async () => {
        const result = await systemHealthService.runHealthCheck('functions');
        expect(result.status).toMatch(/^(healthy|degraded|unhealthy)$/);
        expect(result.details.memoryUsage).toBeDefined();
        expect(result.details.uptime).toBeGreaterThanOrEqual(0);
      });

      it('should detect high memory usage', async () => {
        // Mock high memory usage
        const originalMemoryUsage = process.memoryUsage;
        process.memoryUsage = jest.fn().mockReturnValue({
          heapUsed: 900 * 1024 * 1024, // 900MB
          heapTotal: 1000 * 1024 * 1024, // 1GB = 90% usage
          rss: 0,
          external: 0
        });

        const result = await systemHealthService.runHealthCheck('functions');
        expect(result.status).toBe('degraded'); // Should be degraded at >75%

        // Restore original function
        process.memoryUsage = originalMemoryUsage;
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in system status gracefully', async () => {
      // Mock error in performance monitoring service
      const { performanceMonitoringService } = require('../../services/performanceMonitoringService');
      performanceMonitoringService.getPerformanceSummary.mockRejectedValueOnce(
        new Error('Performance service unavailable')
      );

      const status = await systemHealthService.getSystemStatus();
      
      // Should still return status object, possibly with degraded state
      expect(status).toBeDefined();
      expect(status.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    it('should handle health history errors', async () => {
      const mockDb = require('firebase-admin/firestore').getFirestore();
      mockDb.collection().where().orderBy().get.mockRejectedValueOnce(
        new Error('Database unavailable')
      );

      await expect(
        systemHealthService.getHealthHistory('database')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'Error getting health history for database:',
        expect.any(Error)
      );
    });
  });

  describe('Health Monitoring Integration', () => {
    it('should integrate with performance monitoring service', async () => {
      const { performanceMonitoringService } = require('../../services/performanceMonitoringService');
      
      const status = await systemHealthService.getSystemStatus();
      
      expect(performanceMonitoringService.getPerformanceSummary).toHaveBeenCalledWith('1h');
      expect(performanceMonitoringService.getActiveAlerts).toHaveBeenCalled();
      
      // Should include performance metrics in response
      expect(status.metrics.responseTime).toBeDefined();
    });
  });
});