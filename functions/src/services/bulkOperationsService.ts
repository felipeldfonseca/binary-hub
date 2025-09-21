import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { importService, ImportResult } from './importService';
import { tradeService, Trade, TradeFilters } from './tradeService';
import { AppError, ErrorCodes, withTimeout, withRetry } from '../utils/errorHandler';

// Initialize Firestore inside the service
const getDb = () => getFirestore();

export interface BulkImportRequest {
  files: Array<{
    buffer: Buffer;
    fileName: string;
    fileSize: number;
  }>;
  userId: string;
  batchId: string;
  options?: {
    skipDuplicates?: boolean;
    validateBeforeImport?: boolean;
    maxConcurrent?: number;
  };
}

export interface BulkImportProgress {
  batchId: string;
  userId: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  currentFile?: string;
  filesProcessed: number;
  totalFiles: number;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  duplicateRows: number;
  errors: BulkError[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedTimeRemaining?: number; // milliseconds
}

export interface BulkError {
  fileIndex?: number;
  fileName?: string;
  rowIndex?: number;
  error: string;
  code: string;
  timestamp: Date;
}

export interface BulkTradeOperation {
  operationType: 'update' | 'delete';
  tradeIds: string[];
  updateData?: Partial<Trade>;
  filters?: TradeFilters;
}

export interface BulkTradeResult {
  operationId: string;
  operationType: 'update' | 'delete';
  totalTrades: number;
  successfulOperations: number;
  failedOperations: number;
  errors: BulkError[];
  affectedTradeIds: string[];
}

export interface BatchAnalyticsRequest {
  userId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  dateRanges: Array<{
    start: Date;
    end: Date;
    label: string;
  }>;
  metrics: ('winRate' | 'totalPnl' | 'avgPnl' | 'maxDrawdown' | 'riskRewardRatio')[];
}

export interface BatchAnalyticsResult {
  calculationId: string;
  userId: string;
  results: Array<{
    period: string;
    dateRange: { start: Date; end: Date; label: string };
    metrics: { [key: string]: number };
    tradeCount: number;
  }>;
  totalCalculationTime: number;
  completedAt: Date;
}

export class BulkOperationsService {
  /**
   * Process multiple CSV files with progress tracking
   */
  async processBulkCsvImport(request: BulkImportRequest): Promise<string> {
    const { files, userId, batchId, options = {} } = request;
    
    logger.info('Starting bulk CSV import', {
      batchId,
      userId,
      fileCount: files.length,
      totalSize: files.reduce((sum, f) => sum + f.fileSize, 0)
    });

    // Create initial progress record
    const progress: BulkImportProgress = {
      batchId,
      userId,
      status: 'processing',
      progress: 0,
      filesProcessed: 0,
      totalFiles: files.length,
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      duplicateRows: 0,
      errors: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.updateBulkProgress(progress);

    try {
      const maxConcurrent = options.maxConcurrent || 3;
      const results: ImportResult[] = [];
      let currentFileIndex = 0;

      // Process files in batches
      while (currentFileIndex < files.length) {
        const batch = files.slice(currentFileIndex, currentFileIndex + maxConcurrent);
        
        const batchPromises = batch.map(async (file, index) => {
          const globalIndex = currentFileIndex + index;
          
          try {
            // Update progress for current file
            await this.updateBulkProgress({
              ...progress,
              currentFile: file.fileName,
              progress: Math.round((globalIndex / files.length) * 100)
            });

            // Validate CSV if option is enabled
            if (options.validateBeforeImport) {
              const validation = await importService.validateCsv(file.buffer.toString('utf-8'));
              if (!validation.isValid) {
                throw new Error(`CSV validation failed: ${validation.errors.join(', ')}`);
              }
              progress.totalRows += validation.totalRows;
            }

            // Process CSV
            const result = await withTimeout(
              importService.processCsvUpload(userId, file.buffer, file.fileName),
              300000, // 5 minute timeout
              `CSV import timed out for file: ${file.fileName}`
            );

            // Update counters
            progress.processedRows += result.totalRows;
            progress.successfulRows += result.importedRows;
            progress.duplicateRows += result.duplicateRows;
            progress.failedRows += result.errors.length;

            // Add file-specific errors
            result.errors.forEach(error => {
              progress.errors.push({
                fileIndex: globalIndex,
                fileName: file.fileName,
                rowIndex: error.row,
                error: error.error,
                code: error.code,
                timestamp: new Date()
              });
            });

            return result;

          } catch (error) {
            logger.error(`Error processing file ${file.fileName}:`, error);
            
            progress.errors.push({
              fileIndex: globalIndex,
              fileName: file.fileName,
              error: error instanceof Error ? error.message : 'Unknown error',
              code: 'FILE_PROCESSING_ERROR',
              timestamp: new Date()
            });

            progress.failedRows++;

            // Return failed result
            return {
              importId: `failed-${Date.now()}`,
              status: 'failed' as const,
              totalRows: 0,
              importedRows: 0,
              duplicateRows: 0,
              errors: [{
                row: 0,
                error: error instanceof Error ? error.message : 'Unknown error',
                code: 'FILE_PROCESSING_ERROR'
              }],
              processingTime: 0
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        progress.filesProcessed += batch.length;
        currentFileIndex += maxConcurrent;

        // Update progress
        progress.progress = Math.round((progress.filesProcessed / files.length) * 100);
        progress.updatedAt = new Date();
        await this.updateBulkProgress(progress);
      }

      // Finalize progress
      progress.status = progress.errors.length === 0 ? 'completed' : 'completed';
      progress.progress = 100;
      progress.completedAt = new Date();
      progress.updatedAt = new Date();

      await this.updateBulkProgress(progress);

      logger.info('Bulk CSV import completed', {
        batchId,
        filesProcessed: progress.filesProcessed,
        successfulRows: progress.successfulRows,
        duplicateRows: progress.duplicateRows,
        failedRows: progress.failedRows,
        errorCount: progress.errors.length
      });

      return batchId;

    } catch (error) {
      logger.error('Bulk CSV import failed:', error);
      
      // Update progress with error
      progress.status = 'failed';
      progress.errors.push({
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'BULK_IMPORT_FAILED',
        timestamp: new Date()
      });
      progress.updatedAt = new Date();
      progress.completedAt = new Date();

      await this.updateBulkProgress(progress);
      throw error;
    }
  }

  /**
   * Perform bulk operations on trades (update/delete)
   */
  async performBulkTradeOperations(
    userId: string, 
    operations: BulkTradeOperation[]
  ): Promise<BulkTradeResult[]> {
    const operationId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting bulk trade operations', {
      operationId,
      userId,
      operationCount: operations.length
    });

    const results: BulkTradeResult[] = [];

    for (const operation of operations) {
      try {
        let targetTradeIds = operation.tradeIds;

        // If filters are provided, get trade IDs from filters
        if (operation.filters) {
          const filteredTrades = await tradeService.getUserTrades(userId, operation.filters);
          targetTradeIds = filteredTrades.map(trade => trade.id);
        }

        const result: BulkTradeResult = {
          operationId: `${operationId}-${operation.operationType}`,
          operationType: operation.operationType,
          totalTrades: targetTradeIds.length,
          successfulOperations: 0,
          failedOperations: 0,
          errors: [],
          affectedTradeIds: []
        };

        // Process trades in batches to avoid Firestore limits
        const batchSize = 50;
        for (let i = 0; i < targetTradeIds.length; i += batchSize) {
          const batch = targetTradeIds.slice(i, i + batchSize);
          
          try {
            if (operation.operationType === 'update' && operation.updateData) {
              await this.performBulkUpdate(userId, batch, operation.updateData);
            } else if (operation.operationType === 'delete') {
              await this.performBulkDelete(userId, batch);
            }

            result.successfulOperations += batch.length;
            result.affectedTradeIds.push(...batch);

          } catch (error) {
            logger.error(`Bulk ${operation.operationType} batch failed:`, error);
            
            result.failedOperations += batch.length;
            result.errors.push({
              error: error instanceof Error ? error.message : 'Unknown error',
              code: `BULK_${operation.operationType.toUpperCase()}_FAILED`,
              timestamp: new Date()
            });
          }
        }

        results.push(result);

      } catch (error) {
        logger.error(`Bulk operation failed:`, error);
        
        results.push({
          operationId: `${operationId}-${operation.operationType}`,
          operationType: operation.operationType,
          totalTrades: operation.tradeIds.length,
          successfulOperations: 0,
          failedOperations: operation.tradeIds.length,
          errors: [{
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'BULK_OPERATION_FAILED',
            timestamp: new Date()
          }],
          affectedTradeIds: []
        });
      }
    }

    return results;
  }

  /**
   * Calculate analytics for multiple periods in batch
   */
  async calculateBatchAnalytics(request: BatchAnalyticsRequest): Promise<BatchAnalyticsResult> {
    const calculationId = `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    logger.info('Starting batch analytics calculation', {
      calculationId,
      userId: request.userId,
      periodCount: request.dateRanges.length,
      metrics: request.metrics
    });

    const results: BatchAnalyticsResult['results'] = [];

    try {
      // Process each date range
      for (const dateRange of request.dateRanges) {
        const trades = await tradeService.getUserTrades(request.userId, {
          start: dateRange.start,
          end: dateRange.end,
          limit: 10000 // High limit for analytics
        });

        const metrics: { [key: string]: number } = {};

        // Calculate requested metrics
        for (const metricType of request.metrics) {
          switch (metricType) {
            case 'winRate':
              const winTrades = trades.filter(t => t.result === 'win').length;
              metrics.winRate = trades.length > 0 ? (winTrades / trades.length) * 100 : 0;
              break;

            case 'totalPnl':
              metrics.totalPnl = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
              break;

            case 'avgPnl':
              const totalPnl = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
              metrics.avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;
              break;

            case 'maxDrawdown':
              metrics.maxDrawdown = this.calculateMaxDrawdown(trades);
              break;

            case 'riskRewardRatio':
              metrics.riskRewardRatio = this.calculateRiskRewardRatio(trades);
              break;
          }
        }

        results.push({
          period: request.period,
          dateRange,
          metrics,
          tradeCount: trades.length
        });
      }

      const totalCalculationTime = Date.now() - startTime;

      logger.info('Batch analytics calculation completed', {
        calculationId,
        periodCount: results.length,
        totalTime: totalCalculationTime
      });

      return {
        calculationId,
        userId: request.userId,
        results,
        totalCalculationTime,
        completedAt: new Date()
      };

    } catch (error) {
      logger.error('Batch analytics calculation failed:', error);
      throw new Error('Failed to calculate batch analytics');
    }
  }

  /**
   * Get bulk import progress
   */
  async getBulkImportProgress(batchId: string): Promise<BulkImportProgress | null> {
    try {
      const doc = await getDb().collection('bulk_operations').doc(batchId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        batchId: doc.id,
        ...doc.data()
      } as BulkImportProgress;

    } catch (error) {
      logger.error('Error getting bulk import progress:', error);
      throw new Error('Failed to get bulk import progress');
    }
  }

  /**
   * Cancel bulk operation
   */
  async cancelBulkOperation(batchId: string, userId: string): Promise<boolean> {
    try {
      const progress = await this.getBulkImportProgress(batchId);
      
      if (!progress || progress.userId !== userId) {
        throw new Error('Bulk operation not found or unauthorized');
      }

      if (progress.status === 'completed') {
        throw new Error('Cannot cancel completed operation');
      }

      await this.updateBulkProgress({
        ...progress,
        status: 'cancelled',
        updatedAt: new Date(),
        completedAt: new Date()
      });

      return true;

    } catch (error) {
      logger.error('Error cancelling bulk operation:', error);
      throw new Error('Failed to cancel bulk operation');
    }
  }

  /**
   * Get bulk operation history for user
   */
  async getBulkOperationHistory(userId: string, limit = 20): Promise<BulkImportProgress[]> {
    try {
      const snapshot = await getDb()
        .collection('bulk_operations')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        batchId: doc.id,
        ...doc.data()
      })) as BulkImportProgress[];

    } catch (error) {
      logger.error('Error getting bulk operation history:', error);
      throw new Error('Failed to get bulk operation history');
    }
  }

  /**
   * Private helper methods
   */
  private async updateBulkProgress(progress: BulkImportProgress): Promise<void> {
    try {
      await getDb().collection('bulk_operations').doc(progress.batchId).set(progress);
    } catch (error) {
      logger.error('Error updating bulk progress:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  private async performBulkUpdate(userId: string, tradeIds: string[], updateData: Partial<Trade>): Promise<void> {
    const db = getDb();
    const batch = db.batch();

    const updateDataWithTimestamp = {
      ...updateData,
      updatedAt: new Date()
    };

    for (const tradeId of tradeIds) {
      const docRef = db.collection('users').doc(userId).collection('trades').doc(tradeId);
      batch.update(docRef, updateDataWithTimestamp);
    }

    await batch.commit();
  }

  private async performBulkDelete(userId: string, tradeIds: string[]): Promise<void> {
    const db = getDb();
    const batch = db.batch();

    for (const tradeId of tradeIds) {
      const docRef = db.collection('users').doc(userId).collection('trades').doc(tradeId);
      batch.delete(docRef);
    }

    await batch.commit();
  }

  private calculateMaxDrawdown(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    let maxDrawdown = 0;
    let runningTotal = 0;
    let peak = 0;

    // Sort by entry time
    const sortedTrades = trades.sort((a, b) => 
      new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
    );

    for (const trade of sortedTrades) {
      runningTotal += trade.profit || 0;
      
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateRiskRewardRatio(trades: Trade[]): number {
    if (trades.length === 0) return 0;

    const winningTrades = trades.filter(t => t.result === 'win');
    const losingTrades = trades.filter(t => t.result === 'loss');

    if (losingTrades.length === 0) return 0;

    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / winningTrades.length 
      : 0;
    
    const avgLoss = Math.abs(
      losingTrades.reduce((sum, t) => sum + (t.profit || 0), 0) / losingTrades.length
    );

    return avgLoss > 0 ? avgWin / avgLoss : 0;
  }
}

export const bulkOperationsService = new BulkOperationsService();