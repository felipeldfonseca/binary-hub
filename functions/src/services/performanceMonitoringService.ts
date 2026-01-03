import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { Request, Response } from 'express';
import * as os from 'os';
import * as v8 from 'v8';

export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  endpoint: string;
  method: string;
  userId?: string;
  responseTime: number;
  statusCode: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  cpuUsage?: {
    user: number;
    system: number;
  };
  error?: string;
  metadata?: any;
}

export interface DatabaseMetric {
  id: string;
  timestamp: Date;
  operation: 'read' | 'write' | 'query' | 'transaction';
  collection: string;
  userId?: string;
  executionTime: number;
  documentsProcessed: number;
  error?: string;
  queryComplexity?: 'simple' | 'medium' | 'complex';
}

export interface OpenAIMetric {
  id: string;
  timestamp: Date;
  model: string;
  operation: 'completion' | 'embedding' | 'moderation';
  userId?: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  cost: number;
  responseTime: number;
  error?: string;
  cacheHit?: boolean;
}

export interface SystemHealthMetric {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    free: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  disk?: {
    free: number;
    total: number;
  };
  activeConnections: number;
  uptime: number;
}

export interface AlertConfig {
  id: string;
  name: string;
  type: 'response_time' | 'error_rate' | 'memory_usage' | 'cpu_usage' | 'database_performance' | 'openai_cost';
  threshold: number;
  duration: number; // minutes
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // minutes
  lastTriggered?: Date;
}

export interface Alert {
  id: string;
  configId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface PerformanceSummary {
  timestamp: Date;
  period: '1h' | '24h' | '7d' | '30d';
  apiMetrics: {
    totalRequests: number;
    avgResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    slowestEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
  };
  databaseMetrics: {
    totalOperations: number;
    avgExecutionTime: number;
    slowestQueries: Array<{ collection: string; operation: string; avgTime: number }>;
    errorRate: number;
  };
  openaiMetrics: {
    totalRequests: number;
    totalCost: number;
    avgResponseTime: number;
    tokenUsage: { prompt: number; completion: number; total: number };
    cacheHitRate: number;
  };
  systemMetrics: {
    avgCpuUsage: number;
    avgMemoryUsage: number;
    peakMemoryUsage: number;
    uptime: number;
  };
  activeAlerts: number;
}

/**
 * Comprehensive Performance Monitoring Service for Firebase Functions
 * Tracks API performance, database queries, OpenAI usage, and system health
 */
export class PerformanceMonitoringService {
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }
  private alerts: Map<string, AlertConfig> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsBuffer: PerformanceMetric[] = [];
  private dbMetricsBuffer: DatabaseMetric[] = [];
  private openaiMetricsBuffer: OpenAIMetric[] = [];
  private bufferFlushInterval = 30000; // 30 seconds
  private maxBufferSize = 1000;
  private healthCheckInterval = 60000; // 1 minute
  private flushIntervalId?: NodeJS.Timeout;
  private healthIntervalId?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultAlerts();
    this.startPeriodicFlush();
    this.startHealthMonitoring();
  }

  /**
   * Track API endpoint performance
   */
  trackAPIPerformance(metric: Omit<PerformanceMetric, 'id' | 'timestamp' | 'memoryUsage'>): void {
    const id = this.generateId();
    const timestamp = new Date();
    const memoryUsage = process.memoryUsage();

    const fullMetric: PerformanceMetric = {
      id,
      timestamp,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      ...metric
    };

    this.metricsBuffer.push(fullMetric);
    this.checkBufferSize();
    this.evaluateAlerts(fullMetric);

    logger.debug('API performance metric tracked', {
      endpoint: fullMetric.endpoint,
      responseTime: fullMetric.responseTime,
      statusCode: fullMetric.statusCode
    });
  }

  /**
   * Track database operation performance
   */
  trackDatabasePerformance(metric: Omit<DatabaseMetric, 'id' | 'timestamp'>): void {
    const id = this.generateId();
    const timestamp = new Date();

    const fullMetric: DatabaseMetric = {
      id,
      timestamp,
      ...metric
    };

    this.dbMetricsBuffer.push(fullMetric);
    this.checkBufferSize();

    logger.debug('Database performance metric tracked', {
      operation: fullMetric.operation,
      collection: fullMetric.collection,
      executionTime: fullMetric.executionTime
    });
  }

  /**
   * Track OpenAI usage and cost
   */
  trackOpenAIUsage(metric: Omit<OpenAIMetric, 'id' | 'timestamp'>): void {
    const id = this.generateId();
    const timestamp = new Date();

    const fullMetric: OpenAIMetric = {
      id,
      timestamp,
      ...metric
    };

    this.openaiMetricsBuffer.push(fullMetric);
    this.checkBufferSize();

    logger.debug('OpenAI usage metric tracked', {
      model: fullMetric.model,
      operation: fullMetric.operation,
      cost: fullMetric.cost,
      tokensUsed: fullMetric.tokensUsed.total
    });
  }

  /**
   * Get performance summary for specified period
   */
  async getPerformanceSummary(period: '1h' | '24h' | '7d' | '30d'): Promise<PerformanceSummary> {
    const timestamp = new Date();
    const { startTime, endTime } = this.getPeriodRange(period);

    try {
      // Fetch metrics from Firestore
      const [apiMetrics, dbMetrics, openaiMetrics] = await Promise.all([
        this.getAPIMetrics(startTime, endTime),
        this.getDatabaseMetrics(startTime, endTime),
        this.getOpenAIMetrics(startTime, endTime)
      ]);

      // Calculate API metrics
      const totalRequests = apiMetrics.length;
      const responseTimes = apiMetrics.map(m => m.responseTime).sort((a, b) => a - b);
      const errors = apiMetrics.filter(m => m.statusCode >= 400);
      
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);
      const p95ResponseTime = responseTimes[p95Index] || 0;
      const p99ResponseTime = responseTimes[p99Index] || 0;
      const errorRate = totalRequests > 0 ? (errors.length / totalRequests) * 100 : 0;

      // Calculate slowest endpoints
      const endpointTimes = new Map<string, number[]>();
      apiMetrics.forEach(m => {
        if (!endpointTimes.has(m.endpoint)) {
          endpointTimes.set(m.endpoint, []);
        }
        endpointTimes.get(m.endpoint)!.push(m.responseTime);
      });

      const slowestEndpoints = Array.from(endpointTimes.entries())
        .map(([endpoint, times]) => ({
          endpoint,
          avgResponseTime: times.reduce((sum, time) => sum + time, 0) / times.length
        }))
        .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        .slice(0, 5);

      // Calculate database metrics
      const totalDbOperations = dbMetrics.length;
      const dbExecutionTimes = dbMetrics.map(m => m.executionTime);
      const avgDbExecutionTime = dbExecutionTimes.length > 0
        ? dbExecutionTimes.reduce((sum, time) => sum + time, 0) / dbExecutionTimes.length
        : 0;

      const dbErrors = dbMetrics.filter(m => m.error);
      const dbErrorRate = totalDbOperations > 0 ? (dbErrors.length / totalDbOperations) * 100 : 0;

      // Calculate slowest queries
      const queryTimes = new Map<string, { times: number[]; operation: string }>();
      dbMetrics.forEach(m => {
        const key = m.collection;
        if (!queryTimes.has(key)) {
          queryTimes.set(key, { times: [], operation: m.operation });
        }
        queryTimes.get(key)!.times.push(m.executionTime);
      });

      const slowestQueries = Array.from(queryTimes.entries())
        .map(([collection, data]) => ({
          collection,
          operation: data.operation,
          avgTime: data.times.reduce((sum, time) => sum + time, 0) / data.times.length
        }))
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 5);

      // Calculate OpenAI metrics
      const totalOpenAIRequests = openaiMetrics.length;
      const totalCost = openaiMetrics.reduce((sum, m) => sum + m.cost, 0);
      const avgOpenAIResponseTime = openaiMetrics.length > 0
        ? openaiMetrics.reduce((sum, m) => sum + m.responseTime, 0) / openaiMetrics.length
        : 0;

      const tokenUsage = openaiMetrics.reduce(
        (acc, m) => ({
          prompt: acc.prompt + m.tokensUsed.prompt,
          completion: acc.completion + m.tokensUsed.completion,
          total: acc.total + m.tokensUsed.total
        }),
        { prompt: 0, completion: 0, total: 0 }
      );

      const cacheHits = openaiMetrics.filter(m => m.cacheHit === true).length;
      const cacheHitRate = totalOpenAIRequests > 0 ? (cacheHits / totalOpenAIRequests) * 100 : 0;

      // Get system metrics
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const uptime = process.uptime();

      return {
        timestamp,
        period,
        apiMetrics: {
          totalRequests,
          avgResponseTime,
          p95ResponseTime,
          p99ResponseTime,
          errorRate,
          slowestEndpoints
        },
        databaseMetrics: {
          totalOperations: totalDbOperations,
          avgExecutionTime: avgDbExecutionTime,
          slowestQueries,
          errorRate: dbErrorRate
        },
        openaiMetrics: {
          totalRequests: totalOpenAIRequests,
          totalCost,
          avgResponseTime: avgOpenAIResponseTime,
          tokenUsage,
          cacheHitRate
        },
        systemMetrics: {
          avgCpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to ms
          avgMemoryUsage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          peakMemoryUsage: memoryUsage.heapTotal,
          uptime
        },
        activeAlerts: this.activeAlerts.size
      };

    } catch (error) {
      logger.error('Error getting performance summary:', error);
      throw new Error('Failed to get performance summary');
    }
  }

  /**
   * Get system health metrics
   */
  getSystemHealth(): SystemHealthMetric {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    return {
      timestamp: new Date(),
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to ms
        loadAverage: os.loadavg()
      },
      memory: {
        free: os.freemem(),
        total: os.totalmem(),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external
      },
      activeConnections: 0, // Would need to track connections
      uptime
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(period: '24h' | '7d' | '30d'): Promise<any> {
    const { startTime, endTime } = this.getPeriodRange(period);

    try {
      const apiMetrics = await this.getAPIMetrics(startTime, endTime);
      
      // Group metrics by hour/day based on period
      const groupBy = period === '24h' ? 'hour' : 'day';
      const trends = this.groupMetricsByTime(apiMetrics, groupBy);

      return {
        period,
        trends,
        summary: {
          totalDataPoints: trends.length,
          avgResponseTime: trends.reduce((sum, t) => sum + t.avgResponseTime, 0) / trends.length,
          maxResponseTime: Math.max(...trends.map(t => t.maxResponseTime)),
          minResponseTime: Math.min(...trends.map(t => t.minResponseTime))
        }
      };

    } catch (error) {
      logger.error('Error getting performance trends:', error);
      throw new Error('Failed to get performance trends');
    }
  }

  /**
   * Configure alert
   */
  configureAlert(config: AlertConfig): void {
    this.alerts.set(config.id, config);
    logger.info(`Alert configured: ${config.name}`, { config });
  }

  /**
   * Disable alert
   */
  disableAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.enabled = false;
      this.alerts.set(alertId, alert);
      logger.info(`Alert disabled: ${alert.name}`);
    }
  }

  /**
   * Clear alert
   */
  clearAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(alertId);
      logger.info(`Alert cleared: ${alertId}`);
    }
  }

  /**
   * Get OpenAI cost insights
   */
  async getOpenAICostInsights(period: '24h' | '7d' | '30d'): Promise<any> {
    const { startTime, endTime } = this.getPeriodRange(period);

    try {
      const metrics = await this.getOpenAIMetrics(startTime, endTime);
      
      const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
      const avgCostPerRequest = metrics.length > 0 ? totalCost / metrics.length : 0;
      
      // Group by model
      const modelCosts = new Map<string, { cost: number; requests: number; tokens: number }>();
      metrics.forEach(m => {
        if (!modelCosts.has(m.model)) {
          modelCosts.set(m.model, { cost: 0, requests: 0, tokens: 0 });
        }
        const data = modelCosts.get(m.model)!;
        data.cost += m.cost;
        data.requests++;
        data.tokens += m.tokensUsed.total;
      });

      // Group by operation
      const operationCosts = new Map<string, { cost: number; requests: number }>();
      metrics.forEach(m => {
        if (!operationCosts.has(m.operation)) {
          operationCosts.set(m.operation, { cost: 0, requests: 0 });
        }
        const data = operationCosts.get(m.operation)!;
        data.cost += m.cost;
        data.requests++;
      });

      return {
        period,
        totalCost,
        avgCostPerRequest,
        totalRequests: metrics.length,
        totalTokens: metrics.reduce((sum, m) => sum + m.tokensUsed.total, 0),
        modelBreakdown: Array.from(modelCosts.entries()).map(([model, data]) => ({
          model,
          ...data,
          avgCostPerRequest: data.requests > 0 ? data.cost / data.requests : 0
        })),
        operationBreakdown: Array.from(operationCosts.entries()).map(([operation, data]) => ({
          operation,
          ...data,
          avgCostPerRequest: data.requests > 0 ? data.cost / data.requests : 0
        }))
      };

    } catch (error) {
      logger.error('Error getting OpenAI cost insights:', error);
      throw new Error('Failed to get OpenAI cost insights');
    }
  }

  /**
   * Private methods
   */
  private initializeDefaultAlerts(): void {
    const defaultAlerts: AlertConfig[] = [
      {
        id: 'high_response_time',
        name: 'High Response Time',
        type: 'response_time',
        threshold: 5000, // 5 seconds
        duration: 5, // 5 minutes
        severity: 'high',
        enabled: true,
        cooldown: 15 // 15 minutes
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        type: 'error_rate',
        threshold: 10, // 10%
        duration: 5,
        severity: 'critical',
        enabled: true,
        cooldown: 10
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        type: 'memory_usage',
        threshold: 80, // 80%
        duration: 10,
        severity: 'high',
        enabled: true,
        cooldown: 20
      },
      {
        id: 'high_openai_cost',
        name: 'High OpenAI Cost',
        type: 'openai_cost',
        threshold: 50, // $50 per hour
        duration: 60,
        severity: 'medium',
        enabled: true,
        cooldown: 60
      }
    ];

    defaultAlerts.forEach(alert => this.alerts.set(alert.id, alert));
  }

  private evaluateAlerts(metric: PerformanceMetric): void {
    this.alerts.forEach(alert => {
      if (!alert.enabled) return;
      
      // Check cooldown
      if (alert.lastTriggered && 
          (Date.now() - alert.lastTriggered.getTime()) < alert.cooldown * 60 * 1000) {
        return;
      }

      let shouldTrigger = false;
      let value = 0;

      switch (alert.type) {
        case 'response_time':
          value = metric.responseTime;
          shouldTrigger = value > alert.threshold;
          break;
        case 'memory_usage':
          value = (metric.memoryUsage.heapUsed / metric.memoryUsage.heapTotal) * 100;
          shouldTrigger = value > alert.threshold;
          break;
      }

      if (shouldTrigger) {
        this.triggerAlert(alert, value);
      }
    });
  }

  private triggerAlert(config: AlertConfig, value: number): void {
    const alert: Alert = {
      id: this.generateId(),
      configId: config.id,
      timestamp: new Date(),
      severity: config.severity,
      message: `${config.name}: ${value.toFixed(2)} exceeds threshold of ${config.threshold}`,
      value,
      threshold: config.threshold
    };

    this.activeAlerts.set(alert.id, alert);
    config.lastTriggered = new Date();
    
    logger.warn('Alert triggered', alert);
  }

  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0 && 
        this.dbMetricsBuffer.length === 0 && 
        this.openaiMetricsBuffer.length === 0) {
      return;
    }

    try {
      const batch = this.db.batch();
      const timestamp = new Date();

      // Flush API metrics
      this.metricsBuffer.forEach(metric => {
        const docRef = this.db.collection('performance_metrics')
          .doc(timestamp.toISOString().substring(0, 10)) // YYYY-MM-DD
          .collection('api_metrics')
          .doc(metric.id);
        batch.set(docRef, metric);
      });

      // Flush database metrics
      this.dbMetricsBuffer.forEach(metric => {
        const docRef = this.db.collection('performance_metrics')
          .doc(timestamp.toISOString().substring(0, 10))
          .collection('db_metrics')
          .doc(metric.id);
        batch.set(docRef, metric);
      });

      // Flush OpenAI metrics
      this.openaiMetricsBuffer.forEach(metric => {
        const docRef = this.db.collection('performance_metrics')
          .doc(timestamp.toISOString().substring(0, 10))
          .collection('openai_metrics')
          .doc(metric.id);
        batch.set(docRef, metric);
      });

      await batch.commit();

      logger.debug('Metrics flushed to Firestore', {
        apiMetrics: this.metricsBuffer.length,
        dbMetrics: this.dbMetricsBuffer.length,
        openaiMetrics: this.openaiMetricsBuffer.length
      });

      // Clear buffers
      this.metricsBuffer = [];
      this.dbMetricsBuffer = [];
      this.openaiMetricsBuffer = [];

    } catch (error) {
      logger.error('Error flushing metrics:', error);
    }
  }

  private checkBufferSize(): void {
    if (this.metricsBuffer.length + this.dbMetricsBuffer.length + this.openaiMetricsBuffer.length > this.maxBufferSize) {
      this.flushMetrics();
    }
  }

  private startPeriodicFlush(): void {
    this.flushIntervalId = setInterval(() => {
      this.flushMetrics();
    }, this.bufferFlushInterval);
  }

  private startHealthMonitoring(): void {
    this.healthIntervalId = setInterval(async () => {
      const health = this.getSystemHealth();
      
      // Store system health
      try {
        await this.db.collection('system_health')
          .doc(health.timestamp.toISOString())
          .set(health);
      } catch (error) {
        logger.error('Error storing system health:', error);
      }
      
    }, this.healthCheckInterval);
  }

  /**
   * Cleanup method for tests and graceful shutdown
   */
  cleanup(): void {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = undefined;
    }
    if (this.healthIntervalId) {
      clearInterval(this.healthIntervalId);
      this.healthIntervalId = undefined;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
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

  private async getAPIMetrics(startTime: Date, endTime: Date): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];
    
    try {
      // Get date range for document IDs
      const dates = this.getDateRange(startTime, endTime);
      
      for (const date of dates) {
        const snapshot = await this.db.collection('performance_metrics')
          .doc(date)
          .collection('api_metrics')
          .where('timestamp', '>=', startTime)
          .where('timestamp', '<=', endTime)
          .get();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          metrics.push({
            ...data,
            timestamp: data.timestamp.toDate()
          } as PerformanceMetric);
        });
      }
    } catch (error) {
      logger.error('Error getting API metrics:', error);
    }

    return metrics;
  }

  private async getDatabaseMetrics(startTime: Date, endTime: Date): Promise<DatabaseMetric[]> {
    const metrics: DatabaseMetric[] = [];
    
    try {
      const dates = this.getDateRange(startTime, endTime);
      
      for (const date of dates) {
        const snapshot = await this.db.collection('performance_metrics')
          .doc(date)
          .collection('db_metrics')
          .where('timestamp', '>=', startTime)
          .where('timestamp', '<=', endTime)
          .get();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          metrics.push({
            ...data,
            timestamp: data.timestamp.toDate()
          } as DatabaseMetric);
        });
      }
    } catch (error) {
      logger.error('Error getting database metrics:', error);
    }

    return metrics;
  }

  private async getOpenAIMetrics(startTime: Date, endTime: Date): Promise<OpenAIMetric[]> {
    const metrics: OpenAIMetric[] = [];
    
    try {
      const dates = this.getDateRange(startTime, endTime);
      
      for (const date of dates) {
        const snapshot = await this.db.collection('performance_metrics')
          .doc(date)
          .collection('openai_metrics')
          .where('timestamp', '>=', startTime)
          .where('timestamp', '<=', endTime)
          .get();
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          metrics.push({
            ...data,
            timestamp: data.timestamp.toDate()
          } as OpenAIMetric);
        });
      }
    } catch (error) {
      logger.error('Error getting OpenAI metrics:', error);
    }

    return metrics;
  }

  private getDateRange(startTime: Date, endTime: Date): string[] {
    const dates: string[] = [];
    const current = new Date(startTime);
    
    while (current <= endTime) {
      dates.push(current.toISOString().substring(0, 10)); // YYYY-MM-DD
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  }

  private groupMetricsByTime(metrics: PerformanceMetric[], groupBy: 'hour' | 'day'): any[] {
    const grouped = new Map<string, PerformanceMetric[]>();
    
    metrics.forEach(metric => {
      let key: string;
      if (groupBy === 'hour') {
        key = metric.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      } else {
        key = metric.timestamp.toISOString().substring(0, 10); // YYYY-MM-DD
      }
      
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });
    
    return Array.from(grouped.entries()).map(([time, groupMetrics]) => {
      const responseTimes = groupMetrics.map(m => m.responseTime);
      const errors = groupMetrics.filter(m => m.statusCode >= 400).length;
      
      return {
        time,
        totalRequests: groupMetrics.length,
        avgResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
        maxResponseTime: Math.max(...responseTimes),
        minResponseTime: Math.min(...responseTimes),
        errorRate: groupMetrics.length > 0 ? (errors / groupMetrics.length) * 100 : 0,
        errors
      };
    }).sort((a, b) => a.time.localeCompare(b.time));
  }
}

// Export singleton instance only in non-test environments to prevent memory leaks
export const performanceMonitoringService = process.env.NODE_ENV === 'test' 
  ? null as any // Return null in tests to prevent timer instantiation
  : new PerformanceMonitoringService();