import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { performanceMonitoringService } from './performanceMonitoringService';
import { systemHealthService } from './systemHealthService';
import { cacheService } from './cacheService';

export interface DashboardWidget {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'alert' | 'list' | 'gauge';
  data: any;
  lastUpdated: Date;
  refreshInterval: number; // seconds
  status: 'healthy' | 'warning' | 'critical';
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  refreshInterval: number;
  lastUpdated: Date;
}

/**
 * Real-time dashboard service for system performance monitoring
 * Provides widgets and layouts for monitoring dashboards
 */
export class RealTimeDashboardService {
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }
  private widgets: Map<string, DashboardWidget> = new Map();
  private layouts: Map<string, DashboardLayout> = new Map();
  private updateInterval = 30000; // 30 seconds

  constructor() {
    this.initializeDefaultWidgets();
    this.startRealTimeUpdates();
  }

  /**
   * Get dashboard layout by ID
   */
  async getDashboardLayout(layoutId: string): Promise<DashboardLayout | null> {
    return this.layouts.get(layoutId) || null;
  }

  /**
   * Get all available dashboard layouts
   */
  getDashboardLayouts(): DashboardLayout[] {
    return Array.from(this.layouts.values());
  }

  /**
   * Get widget by ID
   */
  getWidget(widgetId: string): DashboardWidget | null {
    return this.widgets.get(widgetId) || null;
  }

  /**
   * Update widget data
   */
  async updateWidget(widgetId: string): Promise<DashboardWidget> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget not found: ${widgetId}`);
    }

    try {
      const newData = await this.fetchWidgetData(widget.type, widget.id);
      widget.data = newData.data;
      widget.status = newData.status;
      widget.lastUpdated = new Date();

      this.widgets.set(widgetId, widget);
      return widget;
    } catch (error) {
      logger.error(`Error updating widget ${widgetId}:`, error);
      widget.status = 'critical';
      widget.lastUpdated = new Date();
      this.widgets.set(widgetId, widget);
      return widget;
    }
  }

  /**
   * Get real-time metrics snapshot
   */
  async getRealtimeSnapshot(): Promise<any> {
    const timestamp = new Date();
    
    try {
      const [systemStatus, performanceSummary, cacheStats] = await Promise.all([
        systemHealthService.getSystemStatus(),
        performanceMonitoringService.getPerformanceSummary('1h'),
        this.getCacheStats()
      ]);

      return {
        timestamp,
        system: {
          status: systemStatus.overall,
          uptime: systemStatus.metrics.uptime,
          memory: {
            used: systemStatus.metrics.memory.used,
            total: systemStatus.metrics.memory.total,
            percentage: systemStatus.metrics.memory.percentage
          },
          cpu: {
            usage: systemStatus.metrics.cpu.usage,
            loadAverage: systemStatus.metrics.cpu.loadAverage[0] // 1-minute load average
          }
        },
        api: {
          totalRequests: performanceSummary.apiMetrics.totalRequests,
          avgResponseTime: performanceSummary.apiMetrics.avgResponseTime,
          p95ResponseTime: performanceSummary.apiMetrics.p95ResponseTime,
          errorRate: performanceSummary.apiMetrics.errorRate,
          slowestEndpoints: performanceSummary.apiMetrics.slowestEndpoints.slice(0, 5)
        },
        database: {
          totalOperations: performanceSummary.databaseMetrics.totalOperations,
          avgExecutionTime: performanceSummary.databaseMetrics.avgExecutionTime,
          errorRate: performanceSummary.databaseMetrics.errorRate,
          slowestQueries: performanceSummary.databaseMetrics.slowestQueries.slice(0, 5)
        },
        openai: {
          totalRequests: performanceSummary.openaiMetrics.totalRequests,
          totalCost: performanceSummary.openaiMetrics.totalCost,
          avgResponseTime: performanceSummary.openaiMetrics.avgResponseTime,
          cacheHitRate: performanceSummary.openaiMetrics.cacheHitRate
        },
        cache: cacheStats,
        alerts: {
          active: systemStatus.alerts.active,
          critical: systemStatus.alerts.critical,
          warnings: systemStatus.alerts.warnings
        },
        services: systemStatus.services.map(service => ({
          name: service.service,
          status: service.status,
          responseTime: service.responseTime
        }))
      };
    } catch (error) {
      logger.error('Error getting realtime snapshot:', error);
      throw error;
    }
  }

  /**
   * Get performance trends for charts
   */
  async getPerformanceTrends(period: '1h' | '6h' | '24h' = '6h'): Promise<any> {
    try {
      const trends = await performanceMonitoringService.getPerformanceTrends(period);
      
      return {
        period,
        trends: trends.trends,
        charts: {
          responseTime: trends.trends.map((point: any) => ({
            time: point.time,
            value: point.avgResponseTime,
            peak: point.maxResponseTime
          })),
          requestVolume: trends.trends.map((point: any) => ({
            time: point.time,
            value: point.totalRequests
          })),
          errorRate: trends.trends.map((point: any) => ({
            time: point.time,
            value: point.errorRate
          }))
        }
      };
    } catch (error) {
      logger.error('Error getting performance trends:', error);
      throw error;
    }
  }

  /**
   * Get system health timeline
   */
  async getHealthTimeline(period: '1h' | '6h' | '24h' = '6h'): Promise<any> {
    try {
      const endTime = new Date();
      const startTime = new Date();
      
      switch (period) {
        case '1h':
          startTime.setHours(startTime.getHours() - 1);
          break;
        case '6h':
          startTime.setHours(startTime.getHours() - 6);
          break;
        case '24h':
          startTime.setDate(startTime.getDate() - 1);
          break;
      }

      const snapshots = await this.db.collection('system_health_snapshots')
        .where('timestamp', '>=', startTime)
        .where('timestamp', '<=', endTime)
        .orderBy('timestamp', 'asc')
        .limit(100)
        .get();

      const timeline = snapshots.docs.map(doc => {
        const data = doc.data();
        return {
          timestamp: data.timestamp.toDate(),
          overall: data.overall,
          memory: data.metrics.memory.percentage,
          cpu: data.metrics.cpu.usage,
          responseTime: data.metrics.responseTime.p95,
          alerts: data.alerts.active
        };
      });

      return {
        period,
        timeline,
        summary: {
          totalPoints: timeline.length,
          healthyPoints: timeline.filter((point: any) => point.overall === 'healthy').length,
          degradedPoints: timeline.filter((point: any) => point.overall === 'degraded').length,
          unhealthyPoints: timeline.filter((point: any) => point.overall === 'unhealthy').length,
          avgMemoryUsage: timeline.reduce((sum: number, point: any) => sum + point.memory, 0) / timeline.length,
          avgCpuUsage: timeline.reduce((sum: number, point: any) => sum + point.cpu, 0) / timeline.length,
          avgResponseTime: timeline.reduce((sum: number, point: any) => sum + point.responseTime, 0) / timeline.length
        }
      };
    } catch (error) {
      logger.error('Error getting health timeline:', error);
      throw error;
    }
  }

  /**
   * Get top issues and recommendations
   */
  async getTopIssues(): Promise<any> {
    try {
      const [systemStatus, performanceSummary] = await Promise.all([
        systemHealthService.getSystemStatus(),
        performanceMonitoringService.getPerformanceSummary('1h')
      ]);

      const issues: any[] = [];
      const recommendations: string[] = [];

      // Check system issues
      if (systemStatus.overall === 'unhealthy') {
        issues.push({
          severity: 'critical',
          category: 'system',
          title: 'System Unhealthy',
          description: 'One or more critical services are down',
          services: systemStatus.services.filter(s => s.status === 'unhealthy').map(s => s.service)
        });
        recommendations.push('Immediate investigation required for critical services');
      }

      // Check performance issues
      if (performanceSummary.apiMetrics.avgResponseTime > 5000) {
        issues.push({
          severity: 'high',
          category: 'performance',
          title: 'High Response Times',
          description: `Average response time is ${performanceSummary.apiMetrics.avgResponseTime.toFixed(0)}ms`,
          value: performanceSummary.apiMetrics.avgResponseTime
        });
        recommendations.push('Optimize slow endpoints and consider scaling');
      }

      if (performanceSummary.apiMetrics.errorRate > 5) {
        issues.push({
          severity: 'high',
          category: 'reliability',
          title: 'High Error Rate',
          description: `Error rate is ${performanceSummary.apiMetrics.errorRate.toFixed(1)}%`,
          value: performanceSummary.apiMetrics.errorRate
        });
        recommendations.push('Review error patterns and implement fixes');
      }

      // Check cost issues
      if (performanceSummary.openaiMetrics.totalCost > 50) {
        issues.push({
          severity: 'medium',
          category: 'cost',
          title: 'High OpenAI Costs',
          description: `OpenAI costs are $${performanceSummary.openaiMetrics.totalCost.toFixed(2)} in the last hour`,
          value: performanceSummary.openaiMetrics.totalCost
        });
        recommendations.push('Review OpenAI usage patterns and consider optimization');
      }

      // Check memory usage
      if (systemStatus.metrics.memory.percentage > 85) {
        issues.push({
          severity: 'high',
          category: 'resources',
          title: 'High Memory Usage',
          description: `Memory usage is ${systemStatus.metrics.memory.percentage.toFixed(1)}%`,
          value: systemStatus.metrics.memory.percentage
        });
        recommendations.push('Monitor memory usage and consider optimization');
      }

      return {
        issues: issues.sort((a, b) => {
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return severityOrder[b.severity as keyof typeof severityOrder] - severityOrder[a.severity as keyof typeof severityOrder];
        }),
        recommendations,
        summary: {
          totalIssues: issues.length,
          critical: issues.filter(i => i.severity === 'critical').length,
          high: issues.filter(i => i.severity === 'high').length,
          medium: issues.filter(i => i.severity === 'medium').length,
          low: issues.filter(i => i.severity === 'low').length
        }
      };
    } catch (error) {
      logger.error('Error getting top issues:', error);
      throw error;
    }
  }

  /**
   * Private methods
   */
  private initializeDefaultWidgets(): void {
    const defaultWidgets: DashboardWidget[] = [
      {
        id: 'system_status',
        title: 'System Status',
        type: 'gauge',
        data: { status: 'healthy', uptime: 0 },
        lastUpdated: new Date(),
        refreshInterval: 30,
        status: 'healthy'
      },
      {
        id: 'response_time',
        title: 'Response Time',
        type: 'metric',
        data: { current: 0, p95: 0, trend: 'stable' },
        lastUpdated: new Date(),
        refreshInterval: 30,
        status: 'healthy'
      },
      {
        id: 'error_rate',
        title: 'Error Rate',
        type: 'metric',
        data: { current: 0, trend: 'stable' },
        lastUpdated: new Date(),
        refreshInterval: 30,
        status: 'healthy'
      },
      {
        id: 'active_alerts',
        title: 'Active Alerts',
        type: 'alert',
        data: { active: 0, critical: 0, warnings: 0 },
        lastUpdated: new Date(),
        refreshInterval: 15,
        status: 'healthy'
      },
      {
        id: 'openai_costs',
        title: 'OpenAI Costs',
        type: 'metric',
        data: { hourly: 0, daily: 0, trend: 'stable' },
        lastUpdated: new Date(),
        refreshInterval: 60,
        status: 'healthy'
      },
      {
        id: 'slowest_endpoints',
        title: 'Slowest Endpoints',
        type: 'list',
        data: { endpoints: [] },
        lastUpdated: new Date(),
        refreshInterval: 60,
        status: 'healthy'
      }
    ];

    defaultWidgets.forEach(widget => this.widgets.set(widget.id, widget));

    // Create default layout
    const defaultLayout: DashboardLayout = {
      id: 'default',
      name: 'System Overview',
      widgets: defaultWidgets,
      refreshInterval: 30,
      lastUpdated: new Date()
    };

    this.layouts.set('default', defaultLayout);
  }

  private async fetchWidgetData(type: string, widgetId: string): Promise<{ data: any; status: 'healthy' | 'warning' | 'critical' }> {
    switch (widgetId) {
      case 'system_status':
        const systemStatus = await systemHealthService.getSystemStatus();
        return {
          data: {
            status: systemStatus.overall,
            uptime: systemStatus.metrics.uptime,
            services: systemStatus.services.length,
            healthyServices: systemStatus.services.filter(s => s.status === 'healthy').length
          },
          status: systemStatus.overall === 'healthy' ? 'healthy' : 
                 systemStatus.overall === 'degraded' ? 'warning' : 'critical'
        };

      case 'response_time':
        const perfSummary = await performanceMonitoringService.getPerformanceSummary('1h');
        return {
          data: {
            current: perfSummary.apiMetrics.avgResponseTime,
            p95: perfSummary.apiMetrics.p95ResponseTime,
            p99: perfSummary.apiMetrics.p99ResponseTime,
            trend: this.calculateTrend(perfSummary.apiMetrics.avgResponseTime, 1000)
          },
          status: perfSummary.apiMetrics.avgResponseTime > 5000 ? 'critical' :
                 perfSummary.apiMetrics.avgResponseTime > 2000 ? 'warning' : 'healthy'
        };

      case 'error_rate':
        const errorSummary = await performanceMonitoringService.getPerformanceSummary('1h');
        return {
          data: {
            current: errorSummary.apiMetrics.errorRate,
            trend: this.calculateTrend(errorSummary.apiMetrics.errorRate, 5)
          },
          status: errorSummary.apiMetrics.errorRate > 10 ? 'critical' :
                 errorSummary.apiMetrics.errorRate > 5 ? 'warning' : 'healthy'
        };

      case 'active_alerts':
        const alerts = performanceMonitoringService.getActiveAlerts();
        const critical = alerts.filter(a => a.severity === 'critical').length;
        const warnings = alerts.filter(a => a.severity === 'high' || a.severity === 'medium').length;
        return {
          data: {
            active: alerts.length,
            critical,
            warnings,
            low: alerts.filter(a => a.severity === 'low').length
          },
          status: critical > 0 ? 'critical' : warnings > 0 ? 'warning' : 'healthy'
        };

      case 'openai_costs':
        const costSummary = await performanceMonitoringService.getPerformanceSummary('1h');
        const dailyCostSummary = await performanceMonitoringService.getPerformanceSummary('24h');
        return {
          data: {
            hourly: costSummary.openaiMetrics.totalCost,
            daily: dailyCostSummary.openaiMetrics.totalCost,
            trend: this.calculateTrend(costSummary.openaiMetrics.totalCost, 10)
          },
          status: costSummary.openaiMetrics.totalCost > 50 ? 'warning' : 'healthy'
        };

      case 'slowest_endpoints':
        const endpointSummary = await performanceMonitoringService.getPerformanceSummary('1h');
        return {
          data: {
            endpoints: endpointSummary.apiMetrics.slowestEndpoints.slice(0, 5)
          },
          status: 'healthy'
        };

      default:
        return { data: {}, status: 'healthy' };
    }
  }

  private calculateTrend(current: number, threshold: number): 'up' | 'down' | 'stable' {
    // This is a simplified trend calculation
    // In a real implementation, you'd compare with historical data
    if (current > threshold * 1.2) return 'up';
    if (current < threshold * 0.8) return 'down';
    return 'stable';
  }

  private async getCacheStats(): Promise<any> {
    try {
      const stats = cacheService.getStats();
      const health = await cacheService.healthCheck();
      
      return {
        hitRate: stats.overall.hitRate,
        totalHits: stats.overall.totalHits,
        totalMisses: stats.overall.totalMisses,
        connected: health.redis.connected,
        memoryUsage: health.memory.used,
        status: health.redis.connected ? 'healthy' : 'critical'
      };
    } catch (error) {
      return {
        hitRate: 0,
        totalHits: 0,
        totalMisses: 0,
        connected: false,
        memoryUsage: 0,
        status: 'critical'
      };
    }
  }

  private startRealTimeUpdates(): void {
    // Update all widgets periodically
    setInterval(async () => {
      for (const [widgetId, widget] of this.widgets) {
        try {
          const timeSinceUpdate = Date.now() - widget.lastUpdated.getTime();
          if (timeSinceUpdate >= widget.refreshInterval * 1000) {
            await this.updateWidget(widgetId);
          }
        } catch (error) {
          logger.error(`Error updating widget ${widgetId}:`, error);
        }
      }
    }, this.updateInterval);

    logger.info('Real-time dashboard updates started');
  }
}

export const realTimeDashboardService = new RealTimeDashboardService();