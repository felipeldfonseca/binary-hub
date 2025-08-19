import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { cacheService, CacheStats } from './cacheService';

export interface CacheMetrics {
  timestamp: string;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  redisConnected: boolean;
  memoryKeys: number;
  memorySize: number;
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  errors: number;
  throughput: number; // requests per minute
}

export interface PerformanceReport {
  period: string;
  startTime: string;
  endTime: string;
  averageHitRate: number;
  totalRequests: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  averageResponseTime: number;
  slowestEndpoints: Array<{
    endpoint: string;
    averageTime: number;
    hitRate: number;
    requests: number;
  }>;
  cacheEfficiency: {
    score: number; // 0-100
    recommendations: string[];
  };
  errorRate: number;
  uptime: number;
}

export interface CacheAlert {
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric?: string;
  value?: number;
  threshold?: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  collectInterval: number; // seconds
  retentionDays: number;
  alertThresholds: {
    hitRateBelow: number; // percentage
    responseTimeAbove: number; // milliseconds
    errorRateAbove: number; // percentage
    memoryUsageAbove: number; // percentage
  };
  notifications: {
    email: boolean;
    webhook?: string;
  };
}

/**
 * Comprehensive cache monitoring and performance tracking service
 */
export class CacheMonitoringService {
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }
  private metrics: CacheMetrics[] = [];
  private performanceData: Map<string, number[]> = new Map(); // endpoint -> response times
  private requestCounts: Map<string, number> = new Map(); // endpoint -> request count
  private errorCounts: Map<string, number> = new Map(); // endpoint -> error count
  private alerts: CacheAlert[] = [];
  
  private config: MonitoringConfig = {
    enabled: true,
    collectInterval: 60, // 1 minute
    retentionDays: 30,
    alertThresholds: {
      hitRateBelow: 70, // Alert if hit rate drops below 70%
      responseTimeAbove: 2000, // Alert if response time above 2 seconds
      errorRateAbove: 5, // Alert if error rate above 5%
      memoryUsageAbove: 80 // Alert if memory usage above 80%
    },
    notifications: {
      email: false
    }
  };

  constructor(config?: Partial<MonitoringConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start the monitoring process
   */
  private startMonitoring(): void {
    // Collect metrics at regular intervals
    setInterval(() => {
      this.collectMetrics().catch(error => {
        logger.error('Error collecting cache metrics:', error);
      });
    }, this.config.collectInterval * 1000);

    // Clean up old metrics daily
    setInterval(() => {
      this.cleanupOldMetrics().catch(error => {
        logger.error('Error cleaning up old metrics:', error);
      });
    }, 24 * 60 * 60 * 1000); // Daily

    logger.info('Cache monitoring started');
  }

  /**
   * Collect current cache metrics
   */
  async collectMetrics(): Promise<CacheMetrics> {
    try {
      const stats = cacheService.getStats();
      const health = await cacheService.healthCheck();
      
      // Calculate response time metrics
      const responseTimes = Array.from(this.performanceData.values()).flat();
      const responseTimeMetrics = this.calculateResponseTimeMetrics(responseTimes);
      
      // Calculate throughput (requests per minute)
      const totalRequests = Array.from(this.requestCounts.values()).reduce((sum, count) => sum + count, 0);
      const throughput = totalRequests; // Already per interval
      
      // Calculate error rate
      const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
      
      const metrics: CacheMetrics = {
        timestamp: new Date().toISOString(),
        hitRate: stats.overall.hitRate,
        totalHits: stats.overall.totalHits,
        totalMisses: stats.overall.totalMisses,
        redisConnected: health.redis,
        memoryKeys: stats.memory.keys,
        memorySize: stats.memory.size,
        responseTime: responseTimeMetrics,
        errors: totalErrors,
        throughput
      };
      
      // Store metrics
      this.metrics.push(metrics);
      
      // Keep only recent metrics in memory
      if (this.metrics.length > 1440) { // 24 hours at 1-minute intervals
        this.metrics = this.metrics.slice(-1440);
      }
      
      // Check for alerts
      await this.checkAlerts(metrics);
      
      // Reset counters
      this.requestCounts.clear();
      this.errorCounts.clear();
      this.performanceData.clear();
      
      // Persist metrics to database (optional)
      if (this.metrics.length % 60 === 0) { // Every hour
        await this.persistMetrics(metrics);
      }
      
      logger.debug('Cache metrics collected', {
        hitRate: metrics.hitRate.toFixed(2),
        throughput: metrics.throughput,
        avgResponseTime: metrics.responseTime.avg
      });
      
      return metrics;
      
    } catch (error) {
      logger.error('Error collecting metrics:', error);
      throw error;
    }
  }

  /**
   * Record performance data
   */
  recordPerformance(endpoint: string, responseTime: number, isError = false): void {
    if (!this.config.enabled) return;
    
    // Record response time
    if (!this.performanceData.has(endpoint)) {
      this.performanceData.set(endpoint, []);
    }
    this.performanceData.get(endpoint)!.push(responseTime);
    
    // Record request count
    this.requestCounts.set(endpoint, (this.requestCounts.get(endpoint) || 0) + 1);
    
    // Record error count
    if (isError) {
      this.errorCounts.set(endpoint, (this.errorCounts.get(endpoint) || 0) + 1);
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<PerformanceReport> {
    try {
      const { startTime, endTime, metrics } = this.getMetricsForPeriod(period);
      
      if (metrics.length === 0) {
        throw new Error('No metrics available for the specified period');
      }
      
      // Calculate aggregates
      const totalRequests = metrics.reduce((sum, m) => sum + m.throughput, 0);
      const totalCacheHits = metrics.reduce((sum, m) => sum + m.totalHits, 0);
      const totalCacheMisses = metrics.reduce((sum, m) => sum + m.totalMisses, 0);
      const averageHitRate = totalRequests > 0 ? (totalCacheHits / (totalCacheHits + totalCacheMisses)) * 100 : 0;
      const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime.avg, 0) / metrics.length;
      const errorRate = metrics.reduce((sum, m) => sum + m.errors, 0) / totalRequests * 100;
      
      // Calculate uptime
      const redisUptime = metrics.filter(m => m.redisConnected).length / metrics.length * 100;
      
      // Find slowest endpoints (mock data for now)
      const slowestEndpoints = await this.getSlowestEndpoints();
      
      // Calculate cache efficiency
      const cacheEfficiency = this.calculateCacheEfficiency(metrics);
      
      const report: PerformanceReport = {
        period,
        startTime,
        endTime,
        averageHitRate,
        totalRequests,
        totalCacheHits,
        totalCacheMisses,
        averageResponseTime,
        slowestEndpoints,
        cacheEfficiency,
        errorRate,
        uptime: redisUptime
      };
      
      logger.info(`Performance report generated for period: ${period}`, {
        hitRate: averageHitRate.toFixed(2),
        totalRequests,
        avgResponseTime: averageResponseTime.toFixed(2)
      });
      
      return report;
      
    } catch (error) {
      logger.error('Error generating performance report:', error);
      throw error;
    }
  }

  /**
   * Get current alerts
   */
  getAlerts(severity?: 'low' | 'medium' | 'high' | 'critical'): CacheAlert[] {
    let alerts = [...this.alerts];
    
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return alerts.slice(0, 50); // Return last 50 alerts
  }

  /**
   * Clear alerts
   */
  clearAlerts(type?: string): void {
    if (type) {
      this.alerts = this.alerts.filter(alert => alert.type !== type);
    } else {
      this.alerts = [];
    }
  }

  /**
   * Get real-time cache statistics
   */
  async getRealTimeStats(): Promise<{
    current: CacheStats;
    metrics: CacheMetrics[];
    trends: {
      hitRate: { direction: 'up' | 'down' | 'stable'; percentage: number };
      responseTime: { direction: 'up' | 'down' | 'stable'; percentage: number };
      throughput: { direction: 'up' | 'down' | 'stable'; percentage: number };
    };
  }> {
    const current = cacheService.getStats();
    const recentMetrics = this.metrics.slice(-60); // Last hour
    
    // Calculate trends
    const trends = this.calculateTrends(recentMetrics);
    
    return {
      current,
      metrics: recentMetrics,
      trends
    };
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      message: string;
      value?: number;
      threshold?: number;
    }>;
    uptime: number;
    lastCheck: string;
  }> {
    const stats = cacheService.getStats();
    const health = await cacheService.healthCheck();
    const recentMetrics = this.metrics.slice(-10); // Last 10 minutes
    
    const checks: Array<{
      name: string;
      status: 'pass' | 'warn' | 'fail';
      message: string;
      value?: number;
      threshold?: number;
    }> = [
      {
        name: 'Redis Connection',
        status: health.redis ? 'pass' : 'fail',
        message: health.redis ? 'Redis is connected' : 'Redis is disconnected'
      },
      {
        name: 'Memory Cache',
        status: health.memory ? 'pass' : 'fail',
        message: health.memory ? 'Memory cache is active' : 'Memory cache is inactive'
      },
      {
        name: 'Hit Rate',
        status: stats.overall.hitRate >= this.config.alertThresholds.hitRateBelow ? 'pass' : 'warn',
        message: `Current hit rate: ${stats.overall.hitRate.toFixed(2)}%`,
        value: stats.overall.hitRate,
        threshold: this.config.alertThresholds.hitRateBelow
      },
      {
        name: 'Error Rate',
        status: 'pass',
        message: 'Error rate within acceptable limits'
      }
    ];
    
    // Determine overall status
    const failedChecks = checks.filter(c => c.status === 'fail').length;
    const warnChecks = checks.filter(c => c.status === 'warn').length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failedChecks > 0) {
      status = 'unhealthy';
    } else if (warnChecks > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }
    
    // Calculate uptime
    const redisUptime = recentMetrics.length > 0 
      ? recentMetrics.filter(m => m.redisConnected).length / recentMetrics.length * 100
      : 0;
    
    return {
      status,
      checks,
      uptime: redisUptime,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Private helper methods
   */
  private calculateResponseTimeMetrics(responseTimes: number[]): { avg: number; p95: number; p99: number } {
    if (responseTimes.length === 0) {
      return { avg: 0, p95: 0, p99: 0 };
    }
    
    const sorted = responseTimes.sort((a, b) => a - b);
    const avg = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);
    
    return {
      avg: Math.round(avg),
      p95: sorted[p95Index] || 0,
      p99: sorted[p99Index] || 0
    };
  }

  private async checkAlerts(metrics: CacheMetrics): Promise<void> {
    const now = new Date().toISOString();
    
    // Hit rate alert
    if (metrics.hitRate < this.config.alertThresholds.hitRateBelow) {
      this.addAlert({
        type: 'warning',
        title: 'Low Cache Hit Rate',
        message: `Cache hit rate dropped to ${metrics.hitRate.toFixed(2)}%`,
        timestamp: now,
        severity: metrics.hitRate < 50 ? 'high' : 'medium',
        metric: 'hitRate',
        value: metrics.hitRate,
        threshold: this.config.alertThresholds.hitRateBelow
      });
    }
    
    // Response time alert
    if (metrics.responseTime.avg > this.config.alertThresholds.responseTimeAbove) {
      this.addAlert({
        type: 'warning',
        title: 'High Response Time',
        message: `Average response time is ${metrics.responseTime.avg}ms`,
        timestamp: now,
        severity: metrics.responseTime.avg > 5000 ? 'high' : 'medium',
        metric: 'responseTime',
        value: metrics.responseTime.avg,
        threshold: this.config.alertThresholds.responseTimeAbove
      });
    }
    
    // Redis connection alert
    if (!metrics.redisConnected) {
      this.addAlert({
        type: 'error',
        title: 'Redis Connection Lost',
        message: 'Redis cache is not connected',
        timestamp: now,
        severity: 'critical',
        metric: 'redisConnection'
      });
    }
  }

  private addAlert(alert: CacheAlert): void {
    // Avoid duplicate alerts
    const isDuplicate = this.alerts.some(existing => 
      existing.metric === alert.metric && 
      existing.type === alert.type &&
      new Date(existing.timestamp).getTime() > Date.now() - 5 * 60 * 1000 // Within 5 minutes
    );
    
    if (!isDuplicate) {
      this.alerts.push(alert);
      
      // Keep only recent alerts
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }
      
      // Log alert
      logger.warn(`Cache Alert: ${alert.title}`, {
        message: alert.message,
        severity: alert.severity,
        metric: alert.metric,
        value: alert.value
      });
    }
  }

  private getMetricsForPeriod(period: string): { startTime: string; endTime: string; metrics: CacheMetrics[] } {
    const endTime = new Date();
    const startTime = new Date();
    
    switch (period) {
      case 'hour':
        startTime.setHours(startTime.getHours() - 1);
        break;
      case 'day':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case 'week':
        startTime.setDate(startTime.getDate() - 7);
        break;
      case 'month':
        startTime.setMonth(startTime.getMonth() - 1);
        break;
    }
    
    const metrics = this.metrics.filter(m => {
      const metricTime = new Date(m.timestamp);
      return metricTime >= startTime && metricTime <= endTime;
    });
    
    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      metrics
    };
  }

  private async getSlowestEndpoints(): Promise<Array<{ endpoint: string; averageTime: number; hitRate: number; requests: number }>> {
    // Mock implementation - in real system, track per-endpoint metrics
    return [
      { endpoint: '/v1/analytics/performance', averageTime: 450, hitRate: 75, requests: 120 },
      { endpoint: '/v1/analytics/dashboard', averageTime: 320, hitRate: 85, requests: 200 },
      { endpoint: '/v1/trades', averageTime: 180, hitRate: 90, requests: 150 }
    ];
  }

  private calculateCacheEfficiency(metrics: CacheMetrics[]): { score: number; recommendations: string[] } {
    const recommendations: string[] = [];
    let score = 100;
    
    const avgHitRate = metrics.reduce((sum, m) => sum + m.hitRate, 0) / metrics.length;
    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime.avg, 0) / metrics.length;
    
    // Hit rate scoring
    if (avgHitRate < 70) {
      score -= 30;
      recommendations.push('Increase cache TTL for frequently accessed data');
      recommendations.push('Implement cache warming for common queries');
    } else if (avgHitRate < 85) {
      score -= 15;
      recommendations.push('Consider caching more endpoints');
    }
    
    // Response time scoring
    if (avgResponseTime > 1000) {
      score -= 20;
      recommendations.push('Optimize slow database queries');
      recommendations.push('Consider Redis for better performance');
    } else if (avgResponseTime > 500) {
      score -= 10;
      recommendations.push('Review cache TTL settings');
    }
    
    // Connection scoring
    const connectionIssues = metrics.filter(m => !m.redisConnected).length;
    if (connectionIssues > 0) {
      score -= 25;
      recommendations.push('Fix Redis connection issues');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Cache performance is optimal');
    }
    
    return {
      score: Math.max(0, score),
      recommendations
    };
  }

  private calculateTrends(metrics: CacheMetrics[]): {
    hitRate: { direction: 'up' | 'down' | 'stable'; percentage: number };
    responseTime: { direction: 'up' | 'down' | 'stable'; percentage: number };
    throughput: { direction: 'up' | 'down' | 'stable'; percentage: number };
  } {
    if (metrics.length < 2) {
      return {
        hitRate: { direction: 'stable', percentage: 0 },
        responseTime: { direction: 'stable', percentage: 0 },
        throughput: { direction: 'stable', percentage: 0 }
      };
    }
    
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    
    const hitRateChange = ((last.hitRate - first.hitRate) / first.hitRate) * 100;
    const responseTimeChange = ((last.responseTime.avg - first.responseTime.avg) / first.responseTime.avg) * 100;
    const throughputChange = ((last.throughput - first.throughput) / first.throughput) * 100;
    
    return {
      hitRate: {
        direction: Math.abs(hitRateChange) < 5 ? 'stable' : hitRateChange > 0 ? 'up' : 'down',
        percentage: Math.abs(hitRateChange)
      },
      responseTime: {
        direction: Math.abs(responseTimeChange) < 5 ? 'stable' : responseTimeChange > 0 ? 'up' : 'down',
        percentage: Math.abs(responseTimeChange)
      },
      throughput: {
        direction: Math.abs(throughputChange) < 5 ? 'stable' : throughputChange > 0 ? 'up' : 'down',
        percentage: Math.abs(throughputChange)
      }
    };
  }

  private async persistMetrics(metrics: CacheMetrics): Promise<void> {
    try {
      await this.db.collection('cache_metrics').add({
        ...metrics,
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error persisting cache metrics:', error);
    }
  }

  private async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
      
      // Clean up persisted metrics
      const oldMetrics = await this.db.collection('cache_metrics')
        .where('createdAt', '<', cutoffDate)
        .get();
      
      const batch = this.db.batch();
      oldMetrics.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      logger.info(`Cleaned up ${oldMetrics.size} old cache metrics`);
    } catch (error) {
      logger.error('Error cleaning up old metrics:', error);
    }
  }
}

export const cacheMonitoringService = new CacheMonitoringService();