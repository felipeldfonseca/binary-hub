import { Request, Response, NextFunction } from 'express';
import { logger } from 'firebase-functions';
import { performanceMonitoringService } from '../services/performanceMonitoringService';
import { getFirestore } from 'firebase-admin/firestore';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

interface PerformanceContext {
  startTime: number;
  startCpuUsage: NodeJS.CpuUsage;
  requestId: string;
  endpoint: string;
  method: string;
  userId?: string;
}

/**
 * Performance monitoring middleware for tracking API endpoint performance
 */
export function performanceTrackingMiddleware() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const startCpuUsage = process.cpuUsage();
    const requestId = generateRequestId();
    const endpoint = req.route?.path || req.path;
    const method = req.method;
    const userId = req.user?.uid;

    // Store performance context in request
    (req as any).performanceContext = {
      startTime,
      startCpuUsage,
      requestId,
      endpoint,
      method,
      userId
    } as PerformanceContext;

    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const endCpuUsage = process.cpuUsage(startCpuUsage);
      const statusCode = res.statusCode;

      // Track performance
      performanceMonitoringService.trackAPIPerformance({
        endpoint,
        method,
        userId,
        responseTime,
        statusCode,
        cpuUsage: {
          user: endCpuUsage.user,
          system: endCpuUsage.system
        },
        metadata: {
          requestId,
          userAgent: req.headers['user-agent'],
          contentLength: res.get('content-length'),
          ip: req.ip
        }
      });

      // Log slow requests
      if (responseTime > 1000) {
        logger.warn('Slow request detected', {
          requestId,
          endpoint,
          method,
          responseTime,
          statusCode,
          userId
        });
      }

      // Log errors
      if (statusCode >= 400) {
        logger.error('Request error', {
          requestId,
          endpoint,
          method,
          responseTime,
          statusCode,
          userId,
          error: (req as any).error?.message
        });
      }

      // Call original end
      originalEnd.call(this, chunk, encoding, cb);
    };

    next();
  };
}

/**
 * Database operation tracking middleware
 */
export function createDatabaseTracker() {
  const db = getFirestore();
  const originalGet = db.collection.prototype.get;
  const originalAdd = db.collection.prototype.add;
  const originalSet = db.doc.prototype.set;
  const originalUpdate = db.doc.prototype.update;
  const originalDelete = db.doc.prototype.delete;

  // Track collection.get()
  db.collection.prototype.get = function() {
    const startTime = Date.now();
    const collectionPath = this.path;
    
    return originalGet.call(this).then((snapshot: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'query',
        collection: collectionPath,
        executionTime,
        documentsProcessed: snapshot.size,
        queryComplexity: determineQueryComplexity(this)
      });
      
      return snapshot;
    }).catch((error: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'query',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 0,
        error: error.message,
        queryComplexity: determineQueryComplexity(this)
      });
      
      throw error;
    });
  };

  // Track collection.add()
  db.collection.prototype.add = function(data: any) {
    const startTime = Date.now();
    const collectionPath = this.path;
    
    return originalAdd.call(this, data).then((result: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 1
      });
      
      return result;
    }).catch((error: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 0,
        error: error.message
      });
      
      throw error;
    });
  };

  // Track doc.set()
  db.doc.prototype.set = function(data: any, options?: any) {
    const startTime = Date.now();
    const docPath = this.path;
    const collectionPath = docPath.split('/').slice(0, -1).join('/');
    
    return originalSet.call(this, data, options).then((result: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 1
      });
      
      return result;
    }).catch((error: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 0,
        error: error.message
      });
      
      throw error;
    });
  };

  // Track doc.update()
  db.doc.prototype.update = function(data: any, ...args: any[]) {
    const startTime = Date.now();
    const docPath = this.path;
    const collectionPath = docPath.split('/').slice(0, -1).join('/');
    
    return originalUpdate.call(this, data, ...args).then((result: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 1
      });
      
      return result;
    }).catch((error: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 0,
        error: error.message
      });
      
      throw error;
    });
  };

  // Track doc.delete()
  db.doc.prototype.delete = function() {
    const startTime = Date.now();
    const docPath = this.path;
    const collectionPath = docPath.split('/').slice(0, -1).join('/');
    
    return originalDelete.call(this).then((result: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 1
      });
      
      return result;
    }).catch((error: any) => {
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      performanceMonitoringService.trackDatabasePerformance({
        operation: 'write',
        collection: collectionPath,
        executionTime,
        documentsProcessed: 0,
        error: error.message
      });
      
      throw error;
    });
  };

  logger.info('Database performance tracking initialized');
}

/**
 * Error tracking middleware
 */
export function errorTrackingMiddleware() {
  return (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const context = (req as any).performanceContext as PerformanceContext;
    
    if (context) {
      const responseTime = Date.now() - context.startTime;
      
      // Track error in performance metrics
      performanceMonitoringService.trackAPIPerformance({
        endpoint: context.endpoint,
        method: context.method,
        userId: context.userId,
        responseTime,
        statusCode: error.status || 500,
        error: error.message || 'Unknown error',
        metadata: {
          requestId: context.requestId,
          stack: error.stack,
          userAgent: req.headers['user-agent'],
          ip: req.ip
        }
      });
    }

    // Store error in request for response tracking
    (req as any).error = error;
    
    next(error);
  };
}

/**
 * Request correlation middleware
 */
export function requestCorrelationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || generateRequestId();
    
    // Set request ID in headers
    res.setHeader('x-request-id', requestId);
    
    // Store in request context
    (req as any).requestId = requestId;
    
    // Add to logger context
    logger.info('Request started', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    next();
  };
}

/**
 * Memory usage tracking middleware
 */
export function memoryTrackingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const memoryBefore = process.memoryUsage();
    
    // Track memory after response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const memoryAfter = process.memoryUsage();
      const memoryDiff = {
        rss: memoryAfter.rss - memoryBefore.rss,
        heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
        heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
        external: memoryAfter.external - memoryBefore.external
      };
      
      // Log significant memory increases
      if (memoryDiff.heapUsed > 50 * 1024 * 1024) { // 50MB
        logger.warn('High memory usage detected', {
          requestId: (req as any).requestId,
          endpoint: req.path,
          method: req.method,
          memoryDiff,
          memoryAfter
        });
      }
      
      originalEnd.call(this, chunk, encoding, cb);
    };
    
    next();
  };
}

/**
 * Rate limiting with performance tracking
 */
export function performanceBasedRateLimiting() {
  const requestCounts = new Map<string, { count: number; lastReset: number; avgResponseTime: number }>();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const baseLimit = 100;
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const key = req.user?.uid || req.ip;
    const now = Date.now();
    
    // Get or create request data
    let requestData = requestCounts.get(key);
    if (!requestData || (now - requestData.lastReset) > windowMs) {
      requestData = { count: 0, lastReset: now, avgResponseTime: 0 };
      requestCounts.set(key, requestData);
    }
    
    // Calculate dynamic limit based on performance
    let limit = baseLimit;
    if (requestData.avgResponseTime > 5000) { // If avg response time > 5s
      limit = Math.floor(baseLimit * 0.5); // Reduce limit by 50%
    } else if (requestData.avgResponseTime > 2000) { // If avg response time > 2s
      limit = Math.floor(baseLimit * 0.75); // Reduce limit by 25%
    }
    
    // Check if limit exceeded
    if (requestData.count >= limit) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((windowMs - (now - requestData.lastReset)) / 1000),
        limit,
        avgResponseTime: requestData.avgResponseTime
      });
    }
    
    // Increment count
    requestData.count++;
    
    // Track response time for dynamic limiting
    const startTime = Date.now();
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const responseTime = Date.now() - startTime;
      
      // Update average response time
      requestData!.avgResponseTime = (requestData!.avgResponseTime + responseTime) / 2;
      
      originalEnd.call(this, chunk, encoding, cb);
    };
    
    next();
  };
}

/**
 * Helper functions
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function determineQueryComplexity(query: any): 'simple' | 'medium' | 'complex' {
  // Simple heuristic based on query constraints
  const constraints = query._queryOptions || {};
  let complexity = 0;
  
  // Count constraints
  if (constraints.where) complexity += Object.keys(constraints.where).length;
  if (constraints.orderBy) complexity += 1;
  if (constraints.limit) complexity += 0.5;
  if (constraints.offset) complexity += 1;
  
  if (complexity <= 1) return 'simple';
  if (complexity <= 3) return 'medium';
  return 'complex';
}

/**
 * Response size tracking
 */
export function responseSizeTrackingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const originalJson = res.json;
    
    res.send = function(body?: any) {
      const size = Buffer.byteLength(body || '', 'utf8');
      res.setHeader('x-response-size', size.toString());
      
      // Log large responses
      if (size > 1024 * 1024) { // 1MB
        logger.warn('Large response detected', {
          requestId: (req as any).requestId,
          endpoint: req.path,
          method: req.method,
          responseSize: size,
          statusCode: res.statusCode
        });
      }
      
      return originalSend.call(this, body);
    };
    
    res.json = function(obj?: any) {
      const body = JSON.stringify(obj);
      const size = Buffer.byteLength(body, 'utf8');
      res.setHeader('x-response-size', size.toString());
      
      if (size > 1024 * 1024) { // 1MB
        logger.warn('Large JSON response detected', {
          requestId: (req as any).requestId,
          endpoint: req.path,
          method: req.method,
          responseSize: size,
          statusCode: res.statusCode
        });
      }
      
      return originalJson.call(this, obj);
    };
    
    next();
  };
}