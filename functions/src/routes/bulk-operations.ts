import { Router, Request, Response } from 'express';
import { bulkOperationsService, BulkImportRequest, BulkTradeOperation, BatchAnalyticsRequest } from '../services/bulkOperationsService';
import { logger } from 'firebase-functions';
import { validateTradeData, logValidationErrors, createValidationError } from '../utils/validation';
import multer from 'multer';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

/**
 * POST /v1/bulk/import/csv - Bulk CSV import with progress tracking
 */
router.post('/import/csv', upload.array('csvFiles', 10), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No CSV files provided',
        code: 'NO_FILES_PROVIDED',
        timestamp: new Date().toISOString()
      });
    }

    // Validate file count
    if (files.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 files allowed per batch',
        code: 'TOO_MANY_FILES',
        timestamp: new Date().toISOString()
      });
    }

    // Parse options
    const options = {
      skipDuplicates: req.body.skipDuplicates === 'true',
      validateBeforeImport: req.body.validateBeforeImport !== 'false', // Default to true
      maxConcurrent: parseInt(req.body.maxConcurrent || '3')
    };

    // Generate batch ID
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare bulk import request
    const bulkRequest: BulkImportRequest = {
      files: files.map(file => ({
        buffer: file.buffer,
        fileName: file.originalname,
        fileSize: file.size
      })),
      userId,
      batchId,
      options
    };

    // Start bulk import (async process)
    const importBatchId = await bulkOperationsService.processBulkCsvImport(bulkRequest);

    res.status(202).json({
      batchId: importBatchId,
      status: 'processing',
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      options,
      statusUrl: `/v1/bulk/import/status/${importBatchId}`,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error starting bulk CSV import:', error);
    
    if (error instanceof Error && error.message.includes('Only CSV files are allowed')) {
      return res.status(400).json({
        error: 'Only CSV files are allowed',
        code: 'INVALID_FILE_TYPE',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to start bulk import',
      code: 'BULK_IMPORT_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/bulk/import/status/:batchId - Get bulk import progress
 */
router.get('/import/status/:batchId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { batchId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!batchId) {
      return res.status(400).json({
        error: 'Batch ID is required',
        code: 'MISSING_BATCH_ID',
        timestamp: new Date().toISOString()
      });
    }

    const progress = await bulkOperationsService.getBulkImportProgress(batchId);

    if (!progress) {
      return res.status(404).json({
        error: 'Batch not found',
        code: 'BATCH_NOT_FOUND',
        details: { batchId },
        timestamp: new Date().toISOString()
      });
    }

    // Check if user owns this batch
    if (progress.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      ...progress,
      // Add computed fields
      successRate: progress.totalRows > 0 
        ? Math.round((progress.successfulRows / progress.totalRows) * 100) 
        : 0,
      errorRate: progress.totalRows > 0 
        ? Math.round((progress.failedRows / progress.totalRows) * 100) 
        : 0,
      duplicateRate: progress.totalRows > 0 
        ? Math.round((progress.duplicateRows / progress.totalRows) * 100) 
        : 0
    });
    return;

  } catch (error) {
    logger.error('Error getting bulk import status:', error);
    res.status(500).json({
      error: 'Failed to get import status',
      code: 'STATUS_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/bulk/import/cancel/:batchId - Cancel bulk import
 */
router.post('/import/cancel/:batchId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { batchId } = req.params;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const success = await bulkOperationsService.cancelBulkOperation(batchId, userId);

    if (!success) {
      return res.status(400).json({
        error: 'Failed to cancel operation',
        code: 'CANCEL_FAILED',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      batchId,
      status: 'cancelled',
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error cancelling bulk import:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Batch not found',
        code: 'BATCH_NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    }

    if (error instanceof Error && error.message.includes('Cannot cancel')) {
      return res.status(400).json({
        error: error.message,
        code: 'CANNOT_CANCEL',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to cancel operation',
      code: 'CANCEL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/bulk/import/history - Get bulk import history
 */
router.get('/import/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (limit > 100) {
      return res.status(400).json({
        error: 'Maximum limit is 100',
        code: 'LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      });
    }

    const history = await bulkOperationsService.getBulkOperationHistory(userId, limit);

    res.json({
      history: history.map(item => ({
        ...item,
        // Add computed summary
        summary: {
          totalFiles: item.totalFiles,
          successfulRows: item.successfulRows,
          failedRows: item.failedRows,
          duplicateRows: item.duplicateRows,
          successRate: item.totalRows > 0 
            ? Math.round((item.successfulRows / item.totalRows) * 100) 
            : 0
        }
      })),
      total: history.length,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error getting bulk import history:', error);
    res.status(500).json({
      error: 'Failed to get import history',
      code: 'HISTORY_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/bulk/trades/update - Bulk update trades
 */
router.post('/trades/update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const { tradeIds, updateData, filters } = req.body;

    // Validate request
    if (!tradeIds && !filters) {
      return res.status(400).json({
        error: 'Either tradeIds or filters must be provided',
        code: 'MISSING_CRITERIA',
        timestamp: new Date().toISOString()
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Update data is required',
        code: 'MISSING_UPDATE_DATA',
        timestamp: new Date().toISOString()
      });
    }

    // Validate update data against trade schema
    const validation = validateTradeData(updateData);
    if (!validation.isValid && validation.errors.some(err => err.includes('required'))) {
      // Allow partial updates, but validate format of provided fields
      const formatErrors = validation.errors.filter(err => !err.includes('required'));
      if (formatErrors.length > 0) {
        logValidationErrors(formatErrors, 'POST /v1/bulk/trades/update');
        return res.status(400).json(createValidationError(formatErrors));
      }
    }

    const operation: BulkTradeOperation = {
      operationType: 'update',
      tradeIds: tradeIds || [],
      updateData,
      filters
    };

    const results = await bulkOperationsService.performBulkTradeOperations(userId, [operation]);
    const result = results[0];

    res.json({
      operationId: result.operationId,
      success: result.failedOperations === 0,
      totalTrades: result.totalTrades,
      successfulOperations: result.successfulOperations,
      failedOperations: result.failedOperations,
      affectedTradeIds: result.affectedTradeIds,
      errors: result.errors,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error performing bulk trade update:', error);
    res.status(500).json({
      error: 'Failed to update trades',
      code: 'BULK_UPDATE_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/bulk/trades/delete - Bulk delete trades
 */
router.post('/trades/delete', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const { tradeIds, filters } = req.body;

    // Validate request
    if (!tradeIds && !filters) {
      return res.status(400).json({
        error: 'Either tradeIds or filters must be provided',
        code: 'MISSING_CRITERIA',
        timestamp: new Date().toISOString()
      });
    }

    // Safety check - prevent accidental deletion of all trades
    if (filters && !tradeIds) {
      const maxDeletionWarning = 100;
      if (!req.body.confirmBulkDelete) {
        return res.status(400).json({
          error: 'Bulk deletion with filters requires confirmation',
          code: 'CONFIRMATION_REQUIRED',
          details: {
            message: 'Add "confirmBulkDelete": true to proceed with bulk deletion',
            warning: `This operation may affect multiple trades`
          },
          timestamp: new Date().toISOString()
        });
      }
    }

    const operation: BulkTradeOperation = {
      operationType: 'delete',
      tradeIds: tradeIds || [],
      filters
    };

    const results = await bulkOperationsService.performBulkTradeOperations(userId, [operation]);
    const result = results[0];

    res.json({
      operationId: result.operationId,
      success: result.failedOperations === 0,
      totalTrades: result.totalTrades,
      successfulOperations: result.successfulOperations,
      failedOperations: result.failedOperations,
      affectedTradeIds: result.affectedTradeIds,
      errors: result.errors,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error performing bulk trade deletion:', error);
    res.status(500).json({
      error: 'Failed to delete trades',
      code: 'BULK_DELETE_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/bulk/analytics/calculate - Batch analytics calculations
 */
router.post('/analytics/calculate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const { period, dateRanges, metrics } = req.body;

    // Validate request
    if (!period || !dateRanges || !metrics) {
      return res.status(400).json({
        error: 'Period, dateRanges, and metrics are required',
        code: 'MISSING_REQUIRED_FIELDS',
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(dateRanges) || dateRanges.length === 0) {
      return res.status(400).json({
        error: 'dateRanges must be a non-empty array',
        code: 'INVALID_DATE_RANGES',
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        error: 'metrics must be a non-empty array',
        code: 'INVALID_METRICS',
        timestamp: new Date().toISOString()
      });
    }

    // Validate period
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
      return res.status(400).json({
        error: 'Invalid period. Must be daily, weekly, monthly, or yearly',
        code: 'INVALID_PERIOD',
        timestamp: new Date().toISOString()
      });
    }

    // Validate metrics
    const validMetrics = ['winRate', 'totalPnl', 'avgPnl', 'maxDrawdown', 'riskRewardRatio'];
    const invalidMetrics = metrics.filter((m: string) => !validMetrics.includes(m));
    if (invalidMetrics.length > 0) {
      return res.status(400).json({
        error: `Invalid metrics: ${invalidMetrics.join(', ')}`,
        code: 'INVALID_METRICS',
        details: { validMetrics },
        timestamp: new Date().toISOString()
      });
    }

    // Convert date strings to Date objects
    const processedDateRanges = dateRanges.map((range: any) => ({
      start: new Date(range.start),
      end: new Date(range.end),
      label: range.label || 'Unnamed Period'
    }));

    const request: BatchAnalyticsRequest = {
      userId,
      period,
      dateRanges: processedDateRanges,
      metrics
    };

    const result = await bulkOperationsService.calculateBatchAnalytics(request);

    res.json({
      ...result,
      success: true,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error calculating batch analytics:', error);
    res.status(500).json({
      error: 'Failed to calculate analytics',
      code: 'BATCH_ANALYTICS_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/bulk/trades/operations - Multiple bulk operations in sequence
 */
router.post('/trades/operations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const { operations } = req.body;

    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({
        error: 'operations must be a non-empty array',
        code: 'INVALID_OPERATIONS',
        timestamp: new Date().toISOString()
      });
    }

    if (operations.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 operations per request',
        code: 'TOO_MANY_OPERATIONS',
        timestamp: new Date().toISOString()
      });
    }

    // Validate each operation
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      if (!op.operationType || !['update', 'delete'].includes(op.operationType)) {
        return res.status(400).json({
          error: `Invalid operationType at index ${i}`,
          code: 'INVALID_OPERATION_TYPE',
          timestamp: new Date().toISOString()
        });
      }

      if (!op.tradeIds && !op.filters) {
        return res.status(400).json({
          error: `Either tradeIds or filters required at index ${i}`,
          code: 'MISSING_CRITERIA',
          timestamp: new Date().toISOString()
        });
      }

      if (op.operationType === 'update' && !op.updateData) {
        return res.status(400).json({
          error: `updateData required for update operation at index ${i}`,
          code: 'MISSING_UPDATE_DATA',
          timestamp: new Date().toISOString()
        });
      }
    }

    const results = await bulkOperationsService.performBulkTradeOperations(userId, operations);

    // Calculate overall success
    const totalOperations = results.reduce((sum, r) => sum + r.totalTrades, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.successfulOperations, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failedOperations, 0);

    res.json({
      success: totalFailed === 0,
      summary: {
        totalOperations: operations.length,
        totalTrades: totalOperations,
        successfulOperations: totalSuccessful,
        failedOperations: totalFailed,
        successRate: totalOperations > 0 
          ? Math.round((totalSuccessful / totalOperations) * 100) 
          : 100
      },
      results,
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    logger.error('Error performing bulk trade operations:', error);
    res.status(500).json({
      error: 'Failed to perform bulk operations',
      code: 'BULK_OPERATIONS_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

export default router;