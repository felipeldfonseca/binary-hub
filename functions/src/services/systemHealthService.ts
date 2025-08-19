import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { performanceMonitoringService, Alert, AlertConfig } from './performanceMonitoringService';
import { cacheService } from './cacheService';
import { enhancedOpenAIService } from './enhancedOpenAIService';
import * as os from 'os';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
  details?: any;
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: HealthCheckResult[];
  metrics: {
    uptime: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    activeConnections: number;
    responseTime: {
      p50: number;
      p95: number;
      p99: number;
    };
  };
  alerts: {
    active: number;
    critical: number;
    warnings: number;
  };
}

export interface HealthThreshold {
  service: string;
  responseTimeWarning: number;
  responseTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
}

/**
 * Comprehensive system health monitoring and alerting service
 */
export class SystemHealthService {
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private healthThresholds: Map<string, HealthThreshold> = new Map();
  private alertSubscribers: Set<(alert: Alert) => void> = new Set();
  private healthCheckInterval = 60000; // 1 minute
  private criticalAlertCooldown = 300000; // 5 minutes
  private lastCriticalAlert = new Map<string, number>();

  constructor() {
    this.initializeHealthThresholds();
    this.startHealthMonitoring();
    this.setupAlertHandlers();
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const timestamp = new Date();
    
    // Run all health checks
    const services = await this.runAllHealthChecks();
    
    // Calculate overall status
    const criticalServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (criticalServices.length > 0) {
      overall = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    const loadAverage = os.loadavg();

    // Get performance metrics
    const performanceSummary = await performanceMonitoringService.getPerformanceSummary('1h');
    
    // Get active alerts
    const activeAlerts = performanceMonitoringService.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = activeAlerts.filter(a => a.severity === 'high' || a.severity === 'medium').length;

    return {
      overall,
      timestamp,
      services,
      metrics: {
        uptime,
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
        },
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000,
          loadAverage
        },
        activeConnections: 0, // Would need connection tracking
        responseTime: {
          p50: performanceSummary.apiMetrics.avgResponseTime,
          p95: performanceSummary.apiMetrics.p95ResponseTime,
          p99: performanceSummary.apiMetrics.p99ResponseTime
        }
      },
      alerts: {
        active: activeAlerts.length,
        critical: criticalAlerts,
        warnings: warningAlerts
      }
    };
  }

  /**
   * Run individual health check
   */
  async runHealthCheck(service: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      switch (service) {
        case 'database':
          result = await this.checkDatabaseHealth();
          break;
        case 'cache':
          result = await this.checkCacheHealth();
          break;
        case 'openai':
          result = await this.checkOpenAIHealth();
          break;
        case 'storage':
          result = await this.checkStorageHealth();
          break;
        case 'functions':
          result = await this.checkFunctionsHealth();
          break;
        default:
          throw new Error(`Unknown service: ${service}`);
      }
    } catch (error: any) {
      result = {
        service,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message
      };
    }

    // Store result
    this.healthChecks.set(service, result);
    
    // Check thresholds and trigger alerts if necessary
    this.evaluateServiceHealth(result);
    
    return result;
  }

  /**
   * Get health history for a service
   */
  async getHealthHistory(service: string, period: '1h' | '24h' | '7d' = '24h'): Promise<any> {
    const { startTime, endTime } = this.getPeriodRange(period);
    
    try {
      const snapshot = await this.db.collection('health_checks')
        .where('service', '==', service)
        .where('timestamp', '>=', startTime)
        .where('timestamp', '<=', endTime)
        .orderBy('timestamp', 'asc')
        .get();
      
      const history = snapshot.docs.map(doc => doc.data());
      
      // Calculate uptime percentage
      const totalChecks = history.length;
      const healthyChecks = history.filter((h: any) => h.status === 'healthy').length;
      const uptime = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : 0;
      
      // Calculate average response time
      const responseTimes = history
        .filter((h: any) => h.responseTime)
        .map((h: any) => h.responseTime);
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum: number, time: number) => sum + time, 0) / responseTimes.length
        : 0;

      return {
        service,
        period,
        uptime,
        avgResponseTime,
        totalChecks,
        healthyChecks,
        degradedChecks: history.filter((h: any) => h.status === 'degraded').length,
        unhealthyChecks: history.filter((h: any) => h.status === 'unhealthy').length,
        history
      };
    } catch (error) {
      logger.error(`Error getting health history for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to health alerts
   */
  subscribeToAlerts(callback: (alert: Alert) => void): () => void {
    this.alertSubscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.alertSubscribers.delete(callback);
    };
  }

  /**
   * Configure health thresholds
   */
  configureThreshold(threshold: HealthThreshold): void {
    this.healthThresholds.set(threshold.service, threshold);
    logger.info(`Health threshold configured for ${threshold.service}`, threshold);
  }

  /**
   * Generate health report
   */
  async generateHealthReport(period: '24h' | '7d' | '30d' = '24h'): Promise<any> {
    const services = ['database', 'cache', 'openai', 'storage', 'functions'];
    
    const healthReports = await Promise.all(
      services.map(async service => {
        try {
          return await this.getHealthHistory(service, period);
        } catch (error) {
          logger.error(`Error getting health report for ${service}:`, error);
          return {
            service,
            period,
            uptime: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );

    // Calculate overall system uptime
    const totalUptime = healthReports.reduce((sum, report) => sum + (report.uptime || 0), 0);
    const avgUptime = healthReports.length > 0 ? totalUptime / healthReports.length : 0;

    // Get performance summary
    const performanceSummary = await performanceMonitoringService.getPerformanceSummary(period);

    return {
      period,
      timestamp: new Date(),
      overallUptime: avgUptime,
      services: healthReports,
      performance: performanceSummary,
      recommendations: this.generateHealthRecommendations(healthReports, performanceSummary)
    };
  }

  /**
   * Private methods
   */
  private async runAllHealthChecks(): Promise<HealthCheckResult[]> {
    const services = ['database', 'cache', 'openai', 'storage', 'functions'];
    
    const results = await Promise.allSettled(
      services.map(service => this.runHealthCheck(service))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          service: services[index],
          status: 'unhealthy' as const,
          lastChecked: new Date(),
          error: result.reason?.message || 'Health check failed'
        };
      }
    });
  }

  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Simple read test
      const testRef = this.db.collection('_health_check').doc('test');
      await testRef.get();
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: responseTime > 5000 ? 'degraded' : 'healthy',
        responseTime,
        lastChecked: new Date(),
        details: {
          type: 'firestore',
          operation: 'read'
        }
      };
    } catch (error: any) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message,
        details: {
          type: 'firestore',
          operation: 'read'
        }
      };
    }
  }

  private async checkCacheHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const cacheHealth = await cacheService.healthCheck();
      const responseTime = Date.now() - startTime;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (!cacheHealth.redis.connected) {
        status = 'unhealthy';
      } else if (responseTime > 1000) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        service: 'cache',
        status,
        responseTime,
        lastChecked: new Date(),
        details: cacheHealth
      };
    } catch (error: any) {
      return {
        service: 'cache',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  private async checkOpenAIHealth(): Promise<HealthCheckResult> {
    try {
      const healthCheck = await enhancedOpenAIService.healthCheck();
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (healthCheck.status === 'unhealthy') {
        status = 'unhealthy';
      } else if (healthCheck.latency && healthCheck.latency > 10000) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        service: 'openai',
        status,
        responseTime: healthCheck.latency,
        lastChecked: new Date(),
        error: healthCheck.error,
        details: {
          apiStatus: healthCheck.status
        }
      };
    } catch (error: any) {
      return {
        service: 'openai',
        status: 'unhealthy',
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  private async checkStorageHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would require Firebase Storage SDK setup
      // For now, return a basic health check
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'storage',
        status: 'healthy',
        responseTime,
        lastChecked: new Date(),
        details: {
          type: 'firebase_storage'
        }
      };
    } catch (error: any) {
      return {
        service: 'storage',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  private async checkFunctionsHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check memory usage and CPU
      const memoryUsage = process.memoryUsage();
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      const responseTime = Date.now() - startTime;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (memoryPercentage > 90) {
        status = 'unhealthy';
      } else if (memoryPercentage > 75) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      return {
        service: 'functions',
        status,
        responseTime,
        lastChecked: new Date(),
        details: {
          memoryUsage: {
            heapUsed: memoryUsage.heapUsed,
            heapTotal: memoryUsage.heapTotal,
            percentage: memoryPercentage
          },
          uptime: process.uptime()
        }
      };
    } catch (error: any) {
      return {
        service: 'functions',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastChecked: new Date(),
        error: error.message
      };
    }
  }

  private evaluateServiceHealth(result: HealthCheckResult): void {
    const threshold = this.healthThresholds.get(result.service);
    if (!threshold) return;

    const now = Date.now();
    const lastAlert = this.lastCriticalAlert.get(result.service) || 0;

    // Check if we should trigger an alert
    let shouldAlert = false;
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (result.status === 'unhealthy') {
      shouldAlert = true;
      severity = 'critical';
    } else if (result.status === 'degraded') {
      shouldAlert = true;
      severity = 'high';
    } else if (result.responseTime && result.responseTime > threshold.responseTimeCritical) {
      shouldAlert = true;
      severity = 'critical';
    } else if (result.responseTime && result.responseTime > threshold.responseTimeWarning) {
      shouldAlert = true;
      severity = 'medium';
    }

    // Check cooldown for critical alerts
    if (shouldAlert && severity === 'critical' && (now - lastAlert) < this.criticalAlertCooldown) {
      return; // Skip alert due to cooldown
    }

    if (shouldAlert) {
      const alert: Alert = {
        id: `health_${result.service}_${Date.now()}`,
        configId: `health_${result.service}`,
        timestamp: new Date(),
        severity,
        message: `${result.service} health check failed: ${result.status}${result.error ? ` - ${result.error}` : ''}`,
        value: result.responseTime || 0,
        threshold: severity === 'critical' ? threshold.responseTimeCritical : threshold.responseTimeWarning
      };

      this.triggerAlert(alert);

      if (severity === 'critical') {
        this.lastCriticalAlert.set(result.service, now);
      }
    }
  }

  private triggerAlert(alert: Alert): void {
    logger.warn('Health alert triggered', alert);
    
    // Notify subscribers
    this.alertSubscribers.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Error in alert callback:', error);
      }
    });
    
    // Store alert in database
    this.storeAlert(alert);
  }

  private async storeAlert(alert: Alert): Promise<void> {
    try {
      await this.db.collection('health_alerts').doc(alert.id).set({
        ...alert,
        timestamp: alert.timestamp,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error storing health alert:', error);
    }
  }

  private initializeHealthThresholds(): void {
    const defaultThresholds: HealthThreshold[] = [
      {
        service: 'database',
        responseTimeWarning: 1000,
        responseTimeCritical: 5000,
        errorRateWarning: 5,
        errorRateCritical: 10
      },
      {
        service: 'cache',
        responseTimeWarning: 500,
        responseTimeCritical: 2000,
        errorRateWarning: 3,
        errorRateCritical: 8
      },
      {
        service: 'openai',
        responseTimeWarning: 5000,
        responseTimeCritical: 15000,
        errorRateWarning: 2,
        errorRateCritical: 5
      },
      {
        service: 'storage',
        responseTimeWarning: 2000,
        responseTimeCritical: 10000,
        errorRateWarning: 5,
        errorRateCritical: 15
      },
      {
        service: 'functions',
        responseTimeWarning: 1000,
        responseTimeCritical: 3000,
        errorRateWarning: 3,
        errorRateCritical: 10
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.healthThresholds.set(threshold.service, threshold);
    });
  }

  private setupAlertHandlers(): void {
    // Subscribe to our own alerts for additional processing
    this.subscribeToAlerts((alert) => {
      // Could add integrations here (email, Slack, PagerDuty, etc.)
      if (alert.severity === 'critical') {
        logger.error('CRITICAL ALERT:', alert);
        // In a real implementation, you might send notifications here
      }
    });
  }

  private startHealthMonitoring(): void {
    // Run initial health check
    this.runAllHealthChecks().then(results => {
      logger.info('Initial health check completed', {
        healthy: results.filter(r => r.status === 'healthy').length,
        degraded: results.filter(r => r.status === 'degraded').length,
        unhealthy: results.filter(r => r.status === 'unhealthy').length
      });
    });

    // Set up periodic health checks
    setInterval(async () => {
      try {
        const results = await this.runAllHealthChecks();
        
        // Store results in database for historical tracking
        const batch = this.db.batch();
        results.forEach(result => {
          const docRef = this.db.collection('health_checks').doc();
          batch.set(docRef, {
            ...result,
            timestamp: result.lastChecked
          });
        });
        
        await batch.commit();
        
      } catch (error) {
        logger.error('Error in periodic health check:', error);
      }
    }, this.healthCheckInterval);
  }

  private getPeriodRange(period: string): { startTime: Date; endTime: Date } {
    const endTime = new Date();
    const startTime = new Date();

    switch (period) {
      case '1h':
        startTime.setHours(startTime.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(startTime.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(startTime.getDate() - 30);
        break;
    }

    return { startTime, endTime };
  }

  private generateHealthRecommendations(healthReports: any[], performanceSummary: any): string[] {
    const recommendations: string[] = [];

    // Check service uptimes
    healthReports.forEach(report => {
      if (report.uptime < 95) {
        recommendations.push(`${report.service} uptime is below 95% (${report.uptime.toFixed(1)}%) - investigate recurring issues`);
      }
    });

    // Check performance metrics
    if (performanceSummary.apiMetrics.avgResponseTime > 2000) {
      recommendations.push('Average API response time is high - consider optimizing slow endpoints');
    }

    if (performanceSummary.apiMetrics.errorRate > 5) {
      recommendations.push('API error rate is elevated - review error patterns and implement fixes');
    }

    if (performanceSummary.openaiMetrics.totalCost > 100) {
      recommendations.push('OpenAI costs are high - consider optimization strategies');
    }

    return recommendations;
  }
}

export const systemHealthService = new SystemHealthService();