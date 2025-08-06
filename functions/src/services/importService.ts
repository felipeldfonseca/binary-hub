import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { csvParserService, ParsedTrade } from './csvParser';
import { tradeService, Trade } from './tradeService';

// Initialize Firestore inside the service
const getDb = () => getFirestore();

export interface ImportRecord {
  importId: string;
  userId: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errors: ImportError[];
  status: 'processing' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  metadata: {
    fileSize: number;
    processingTime: number;
    csvFormat: string;
  };
}

export interface ImportError {
  row: number;
  field?: string;
  error: string;
  code: string;
}

export interface ImportResult {
  importId: string;
  status: 'processing' | 'completed' | 'failed';
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  errors: ImportError[];
  processingTime: number;
}

export interface DeduplicationResult {
  newTrades: Partial<Trade>[];
  duplicateTradeIds: string[];
  totalProcessed: number;
}

export class ImportService {
  /**
   * Process CSV upload with deduplication
   */
  async processCsvUpload(
    userId: string, 
    csvFile: Buffer, 
    fileName: string
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const importId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const db = getDb();
      // Create import record
      const importRecord: ImportRecord = {
        importId,
        userId,
        fileName,
        totalRows: 0,
        importedRows: 0,
        duplicateRows: 0,
        errors: [],
        status: 'processing',
        createdAt: new Date(),
        metadata: {
          fileSize: csvFile.length,
          processingTime: 0,
          csvFormat: 'Ebinex'
        }
      };

      await this.createImportRecord(importRecord);

      // Parse CSV
      const csvContent = csvFile.toString('utf-8');
      const parsedTrades = csvParserService.parseEbinexCsv(csvContent);
      
      // Update total rows
      await this.updateImportRecord(importId, {
        totalRows: parsedTrades.length
      });

      // Check for existing trades
      const tradeIds = parsedTrades.map(t => t.tradeId);
      const existingTradeIds = await tradeService.findExistingTrades(userId, tradeIds);
      
      // Filter out duplicates
      const newTrades = parsedTrades.filter(trade => !existingTradeIds.includes(trade.tradeId));
      const duplicateTradeIds = parsedTrades
        .filter(trade => existingTradeIds.includes(trade.tradeId))
        .map(trade => trade.tradeId);

      // Convert to trade model
      const tradesToImport = newTrades.map(parsedTrade => 
        csvParserService.convertToTradeModel(parsedTrade, userId)
      );

      // Import new trades
      const importResult = await tradeService.bulkCreateTrades(userId, tradesToImport, importId);

      // Calculate processing time
      const processingTime = Date.now() - startTime;

      // Update import record with results
      await this.updateImportRecord(importId, {
        importedRows: importResult.created,
        duplicateRows: duplicateTradeIds.length,
        errors: importResult.errors.map(err => ({
          row: err.index,
          error: err.error,
          code: 'IMPORT_ERROR'
        })),
        status: 'completed',
        completedAt: new Date(),
        metadata: {
          fileSize: csvFile.length,
          processingTime,
          csvFormat: 'Ebinex'
        }
      });

      logger.info(`CSV import completed for user ${userId}: ${importResult.created} trades imported, ${duplicateTradeIds.length} duplicates`);

      return {
        importId,
        status: 'completed',
        totalRows: parsedTrades.length,
        importedRows: importResult.created,
        duplicateRows: duplicateTradeIds.length,
        errors: importResult.errors.map(err => ({
          row: err.index,
          error: err.error,
          code: 'IMPORT_ERROR'
        })),
        processingTime
      };

    } catch (error) {
      logger.error('CSV import error:', error);
      
      // Update import record with error
      await this.updateImportRecord(importId, {
        status: 'failed',
        errors: [{
          row: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'IMPORT_FAILED'
        }],
        completedAt: new Date()
      });

      throw new Error('CSV import failed');
    }
  }

  /**
   * Process multiple CSV files
   */
  async processMultipleCsvs(
    userId: string, 
    csvFiles: Array<{ buffer: Buffer; fileName: string }>
  ): Promise<ImportResult[]> {
    const results: ImportResult[] = [];

    for (const file of csvFiles) {
      try {
        const result = await this.processCsvUpload(userId, file.buffer, file.fileName);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to process file: ${file.fileName}`, error);
        // Continue with other files
        results.push({
          importId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: 'failed',
          totalRows: 0,
          importedRows: 0,
          duplicateRows: 0,
          errors: [{
            row: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: 'IMPORT_FAILED'
          }],
          processingTime: 0
        });
      }
    }

    return results;
  }

  /**
   * Get import status
   */
  async getImportStatus(importId: string): Promise<ImportRecord | null> {
    try {
      const doc = await getDb().collection('imports').doc(importId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return {
        importId: doc.id,
        ...doc.data()
      } as ImportRecord;
    } catch (error) {
      logger.error('Error getting import status:', error);
      throw new Error('Failed to get import status');
    }
  }

  /**
   * Get import history for a user
   */
  async getImportHistory(userId: string, limit = 50): Promise<ImportRecord[]> {
    try {
      const snapshot = await getDb()
        .collection('users')
        .doc(userId)
        .collection('imports')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => ({
        importId: doc.id,
        ...doc.data()
      })) as ImportRecord[];
    } catch (error) {
      logger.error('Error getting import history:', error);
      throw new Error('Failed to get import history');
    }
  }

  /**
   * Validate CSV before upload
   */
  async validateCsv(csvContent: string): Promise<{
    isValid: boolean;
    totalRows: number;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const lines = csvContent.trim().split('\n');
      
      if (lines.length < 2) {
        return {
          isValid: false,
          totalRows: 0,
          errors: ['CSV file is empty or has no data rows'],
          warnings: []
        };
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const validation = csvParserService.validateHeaders(headers);
      
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!validation.isValid) {
        errors.push(`Invalid CSV format: ${validation.missingHeaders.join(', ')}`);
      }

      if (validation.extraHeaders.length > 0) {
        warnings.push(`Extra headers found: ${validation.extraHeaders.join(', ')}`);
      }

      // Check data rows
      let validRows = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const trade = csvParserService.parseRow(line, headers);
          if (trade) {
            validRows++;
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return {
        isValid: errors.length === 0,
        totalRows: validRows,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Error validating CSV:', error);
      return {
        isValid: false,
        totalRows: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      };
    }
  }

  /**
   * Create import record
   */
  private async createImportRecord(importRecord: ImportRecord): Promise<void> {
    try {
      await getDb().collection('imports').doc(importRecord.importId).set(importRecord);
      await getDb()
        .collection('users')
        .doc(importRecord.userId)
        .collection('imports')
        .doc(importRecord.importId)
        .set(importRecord);
    } catch (error) {
      logger.error('Error creating import record:', error);
      throw new Error('Failed to create import record');
    }
  }

  /**
   * Update import record
   */
  private async updateImportRecord(importId: string, updates: Partial<ImportRecord>): Promise<void> {
    try {
      await getDb().collection('imports').doc(importId).update(updates);
      
      // Also update in user's import collection
      const userDoc = await getDb().collection('imports').doc(importId).get();
      if (userDoc.exists) {
        const data = userDoc.data() as ImportRecord;
        await getDb()
          .collection('users')
          .doc(data.userId)
          .collection('imports')
          .doc(importId)
          .update(updates);
      }
    } catch (error) {
      logger.error('Error updating import record:', error);
      throw new Error('Failed to update import record');
    }
  }
}

export const importService = new ImportService(); 