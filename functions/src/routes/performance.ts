import { Router } from 'express';
import { logger } from 'firebase-functions';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { systemHealthService } from '../services/systemHealthService';
import { enhancedOpenAIService } from '../services/enhancedOpenAIService';
import { cacheService } from '../services/cacheService';
import { realTimeDashboardService } from '../services/realTimeDashboardService';

const router = Router();

/**
 * GET /performance/summary
 * Get comprehensive performance summary
 */
router.get('/summary', async (req, res) => {
  try {
    const period = (req.query.period as '1h' | '24h' | '7d' | '30d') || '24h';
    const summary = await performanceMonitoringService.getPerformanceSummary(period);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    logger.error('Error getting performance summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance summary',
      details: error.message
    });
  }
});

/**
 * GET /performance/trends
 * Get performance trends over time
 */
router.get('/trends', async (req, res) => {
  try {
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    const trends = await performanceMonitoringService.getPerformanceTrends(period);
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error: any) {
    logger.error('Error getting performance trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance trends',
      details: error.message
    });
  }
});

/**
 * GET /performance/alerts
 * Get active performance alerts
 */
router.get('/alerts', async (req, res) => {
  try {
    const severity = req.query.severity as 'low' | 'medium' | 'high' | 'critical';
    const alerts = performanceMonitoringService.getActiveAlerts();
    
    const filteredAlerts = severity 
      ? alerts.filter(alert => alert.severity === severity)
      : alerts;
    
    res.json({
      success: true,
      data: {
        alerts: filteredAlerts,
        summary: {
          total: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          high: alerts.filter(a => a.severity === 'high').length,
          medium: alerts.filter(a => a.severity === 'medium').length,
          low: alerts.filter(a => a.severity === 'low').length
        }
      }
    });
  } catch (error: any) {
    logger.error('Error getting performance alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance alerts',
      details: error.message
    });
  }
});

/**
 * DELETE /performance/alerts/:alertId
 * Clear a specific alert
 */
router.delete('/alerts/:alertId', async (req, res) => {
  try {
    const { alertId } = req.params;
    performanceMonitoringService.clearAlert(alertId);
    
    res.json({
      success: true,
      message: 'Alert cleared successfully'
    });
  } catch (error: any) {
    logger.error('Error clearing alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear alert',
      details: error.message
    });
  }
});

/**
 * GET /performance/system-health
 * Get current system health status
 */
router.get('/system-health', async (req, res) => {
  try {
    const systemStatus = await systemHealthService.getSystemStatus();
    
    res.json({
      success: true,
      data: systemStatus
    });
  } catch (error: any) {
    logger.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system health',
      details: error.message
    });
  }
});

/**
 * GET /performance/system-health/:service
 * Get health status for a specific service
 */
router.get('/system-health/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const healthResult = await systemHealthService.runHealthCheck(service);
    
    res.json({
      success: true,
      data: healthResult
    });
  } catch (error: any) {
    logger.error(`Error checking ${req.params.service} health:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to check ${req.params.service} health`,
      details: error.message
    });
  }
});

/**
 * GET /performance/system-health/:service/history
 * Get health history for a specific service
 */
router.get('/system-health/:service/history', async (req, res) => {
  try {
    const { service } = req.params;
    const period = (req.query.period as '1h' | '24h' | '7d') || '24h';
    
    const history = await systemHealthService.getHealthHistory(service, period);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    logger.error(`Error getting ${req.params.service} health history:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to get ${req.params.service} health history`,
      details: error.message
    });
  }
});

/**
 * GET /performance/health-report
 * Generate comprehensive health report
 */
router.get('/health-report', async (req, res) => {
  try {
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    const report = await systemHealthService.generateHealthReport(period);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    logger.error('Error generating health report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate health report',
      details: error.message
    });
  }
});

/**
 * GET /performance/openai/usage
 * Get OpenAI usage statistics
 */
router.get('/openai/usage', async (req, res) => {
  try {
    const period = (req.query.period as '1h' | '24h' | '7d' | '30d') || '24h';
    const userId = req.query.userId as string;
    
    const usage = await enhancedOpenAIService.getUsageStats(userId, period);
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error: any) {
    logger.error('Error getting OpenAI usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenAI usage stats',
      details: error.message
    });
  }
});

/**
 * GET /performance/openai/models
 * Get OpenAI model performance metrics
 */
router.get('/openai/models', async (req, res) => {
  try {
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    const performance = await enhancedOpenAIService.getModelPerformance(period);
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error: any) {
    logger.error('Error getting OpenAI model performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenAI model performance',
      details: error.message
    });
  }
});

/**
 * GET /performance/openai/cost-insights
 * Get OpenAI cost insights and optimization recommendations
 */
router.get('/openai/cost-insights', async (req, res) => {
  try {
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    const insights = await performanceMonitoringService.getOpenAICostInsights(period);
    
    res.json({
      success: true,
      data: insights
    });
  } catch (error: any) {
    logger.error('Error getting OpenAI cost insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get OpenAI cost insights',
      details: error.message
    });
  }
});

/**
 * GET /performance/cache/stats
 * Get cache performance statistics
 */
router.get('/cache/stats', async (req, res) => {
  try {
    const stats = cacheService.getStats();
    const health = await cacheService.healthCheck();
    
    res.json({
      success: true,
      data: {
        stats,
        health,
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      details: error.message
    });
  }
});

/**
 * POST /performance/cache/clear
 * Clear cache (specific keys or patterns)
 */
router.post('/cache/clear', async (req, res) => {
  try {
    const { pattern, keys } = req.body;
    
    if (pattern) {
      // Clear by pattern
      await cacheService.clearByPattern(pattern);
      res.json({
        success: true,
        message: `Cache cleared for pattern: ${pattern}`
      });
    } else if (keys && Array.isArray(keys)) {
      // Clear specific keys
      await Promise.all(keys.map(key => cacheService.delete(key)));
      res.json({
        success: true,
        message: `Cleared ${keys.length} cache keys`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Must provide either pattern or keys array'
      });
    }
  } catch (error: any) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

/**
 * GET /performance/real-time
 * Get real-time performance metrics (for dashboard)
 */
router.get('/real-time', async (req, res) => {
  try {
    const [systemStatus, performanceSummary] = await Promise.all([
      systemHealthService.getSystemStatus(),
      performanceMonitoringService.getPerformanceSummary('1h')
    ]);
    
    const realTimeMetrics = {
      timestamp: new Date(),
      system: {
        status: systemStatus.overall,
        uptime: systemStatus.metrics.uptime,
        memory: systemStatus.metrics.memory,
        cpu: systemStatus.metrics.cpu,
        responseTime: systemStatus.metrics.responseTime
      },
      api: {
        totalRequests: performanceSummary.apiMetrics.totalRequests,
        avgResponseTime: performanceSummary.apiMetrics.avgResponseTime,
        errorRate: performanceSummary.apiMetrics.errorRate,
        slowestEndpoints: performanceSummary.apiMetrics.slowestEndpoints.slice(0, 3)
      },
      database: {
        totalOperations: performanceSummary.databaseMetrics.totalOperations,
        avgExecutionTime: performanceSummary.databaseMetrics.avgExecutionTime,
        errorRate: performanceSummary.databaseMetrics.errorRate
      },
      openai: {
        totalRequests: performanceSummary.openaiMetrics.totalRequests,
        totalCost: performanceSummary.openaiMetrics.totalCost,
        avgResponseTime: performanceSummary.openaiMetrics.avgResponseTime,
        cacheHitRate: performanceSummary.openaiMetrics.cacheHitRate
      },
      alerts: {
        active: systemStatus.alerts.active,
        critical: systemStatus.alerts.critical
      }
    };
    
    res.json({
      success: true,
      data: realTimeMetrics
    });
  } catch (error: any) {
    logger.error('Error getting real-time metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time metrics',
      details: error.message
    });
  }
});

/**
 * POST /performance/alerts/configure
 * Configure performance alert thresholds
 */
router.post('/alerts/configure', async (req, res) => {
  try {
    const alertConfig = req.body;
    
    // Validate alert config
    if (!alertConfig.id || !alertConfig.name || !alertConfig.type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required alert configuration fields'
      });
    }
    
    performanceMonitoringService.configureAlert(alertConfig);
    
    res.json({
      success: true,
      message: 'Alert configuration saved successfully'
    });
  } catch (error: any) {
    logger.error('Error configuring alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure alert',
      details: error.message
    });
  }
});

/**
 * GET /performance/metrics/export
 * Export performance metrics in various formats
 */
router.get('/metrics/export', async (req, res) => {
  try {
    const format = (req.query.format as 'json' | 'csv') || 'json';
    const period = (req.query.period as '24h' | '7d' | '30d') || '24h';
    
    const data = await performanceMonitoringService.getPerformanceSummary(period);
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = this.convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=performance-metrics-${period}.csv`);
      res.send(csvData);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=performance-metrics-${period}.json`);
      res.json(data);
    }
  } catch (error: any) {
    logger.error('Error exporting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/snapshot
 * Get real-time dashboard snapshot
 */
router.get('/dashboard/snapshot', async (req, res) => {
  try {
    const snapshot = await realTimeDashboardService.getRealtimeSnapshot();
    
    res.json({
      success: true,
      data: snapshot
    });
  } catch (error: any) {
    logger.error('Error getting dashboard snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard snapshot',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/trends
 * Get performance trends for dashboard charts
 */
router.get('/dashboard/trends', async (req, res) => {
  try {
    const period = (req.query.period as '1h' | '6h' | '24h') || '6h';
    const trends = await realTimeDashboardService.getPerformanceTrends(period);
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error: any) {
    logger.error('Error getting dashboard trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard trends',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/health-timeline
 * Get system health timeline
 */
router.get('/dashboard/health-timeline', async (req, res) => {
  try {
    const period = (req.query.period as '1h' | '6h' | '24h') || '6h';
    const timeline = await realTimeDashboardService.getHealthTimeline(period);
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error: any) {
    logger.error('Error getting health timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health timeline',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/issues
 * Get top issues and recommendations
 */
router.get('/dashboard/issues', async (req, res) => {
  try {
    const issues = await realTimeDashboardService.getTopIssues();
    
    res.json({
      success: true,
      data: issues
    });
  } catch (error: any) {
    logger.error('Error getting top issues:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top issues',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/widgets/:widgetId
 * Get specific widget data
 */
router.get('/dashboard/widgets/:widgetId', async (req, res) => {
  try {
    const { widgetId } = req.params;
    const widget = await realTimeDashboardService.getWidget(widgetId);
    
    if (!widget) {
      return res.status(404).json({
        success: false,
        error: 'Widget not found'
      });
    }
    
    res.json({
      success: true,
      data: widget
    });
  } catch (error: any) {
    logger.error('Error getting widget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get widget',
      details: error.message
    });
  }
});

/**
 * POST /performance/dashboard/widgets/:widgetId/refresh
 * Refresh specific widget data
 */
router.post('/dashboard/widgets/:widgetId/refresh', async (req, res) => {
  try {
    const { widgetId } = req.params;
    const widget = await realTimeDashboardService.updateWidget(widgetId);
    
    res.json({
      success: true,
      data: widget
    });
  } catch (error: any) {
    logger.error('Error refreshing widget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh widget',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/layouts
 * Get available dashboard layouts
 */
router.get('/dashboard/layouts', async (req, res) => {
  try {
    const layouts = realTimeDashboardService.getDashboardLayouts();
    
    res.json({
      success: true,
      data: layouts
    });
  } catch (error: any) {
    logger.error('Error getting dashboard layouts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard layouts',
      details: error.message
    });
  }
});

/**
 * GET /performance/dashboard/layouts/:layoutId
 * Get specific dashboard layout
 */
router.get('/dashboard/layouts/:layoutId', async (req, res) => {
  try {
    const { layoutId } = req.params;
    const layout = await realTimeDashboardService.getDashboardLayout(layoutId);
    
    if (!layout) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard layout not found'
      });
    }
    
    res.json({
      success: true,
      data: layout
    });
  } catch (error: any) {
    logger.error('Error getting dashboard layout:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard layout',
      details: error.message
    });
  }
});

/**
 * WebSocket endpoint for real-time metrics streaming
 * Note: This would require WebSocket setup in the main application
 */
router.get('/stream', (req, res) => {
  res.json({
    success: false,
    error: 'WebSocket streaming not implemented in this version',
    suggestion: 'Use the /performance/dashboard/snapshot endpoint with polling for live updates'
  });
});

/**
 * Helper function to convert data to CSV
 */
function convertToCSV(data: any): string {
  // Simple CSV conversion - in production, you'd want a more robust solution
  const headers = ['Timestamp', 'Total Requests', 'Avg Response Time', 'Error Rate', 'OpenAI Cost'];
  const row = [
    data.timestamp,
    data.apiMetrics.totalRequests,
    data.apiMetrics.avgResponseTime,
    data.apiMetrics.errorRate,
    data.openaiMetrics.totalCost
  ];
  
  return [headers.join(','), row.join(',')].join('\n');
}

export default router;