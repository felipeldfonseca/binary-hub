import { Router, Request, Response } from 'express';
import { importService } from '../services/importService';
import { validateImportRequest, createValidationError, logValidationErrors } from '../utils/validation';
import { logger } from 'firebase-functions';
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
    fileSize: 10 * 1024 * 1024, // 10MB limit
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
 * POST /v1/import/validate-csv - Validate CSV headers and structure
 */
router.post('/validate-csv', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const { headers, sampleRows } = req.body;

    if (!Array.isArray(headers)) {
      return res.status(400).json({
        error: 'Headers must be an array',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Create a sample CSV content for validation
    let csvContent = headers.join(',') + '\n';
    if (sampleRows && Array.isArray(sampleRows)) {
      for (const row of sampleRows.slice(0, 5)) { // Limit to 5 sample rows
        if (Array.isArray(row)) {
          csvContent += row.join(',') + '\n';
        }
      }
    }

    const validation = await importService.validateCsv(csvContent);

    res.json({
      isValid: validation.isValid,
      totalRows: validation.totalRows,
      errors: validation.errors,
      warnings: validation.warnings
    });
    return;

  } catch (error) {
    logger.error('Error validating CSV:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/import/upload - Upload CSV file
 */
router.post('/upload', upload.single('csv'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'CSV file is required',
        code: 'MISSING_REQUIRED_FIELD',
        timestamp: new Date().toISOString()
      });
    }

    // Validate file
    const fileValidation = validateImportRequest({
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    if (!fileValidation.isValid) {
      logValidationErrors(fileValidation.errors, 'POST /v1/import/upload');
      return res.status(400).json(createValidationError(fileValidation.errors));
    }

    // Process CSV upload
    const result = await importService.processCsvUpload(
      userId,
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      uploadId: result.importId,
      status: result.status,
      progress: result.status === 'completed' ? 100 : 0,
      totalRows: result.totalRows,
      importedRows: result.importedRows,
      duplicateRows: result.duplicateRows,
      errors: result.errors,
      processingTime: result.processingTime
    });
    return;

  } catch (error) {
    logger.error('Error uploading CSV:', error);
    
    if (error instanceof Error && error.message === 'Only CSV files are allowed') {
      return res.status(400).json({
        error: 'Only CSV files are allowed',
        code: 'INVALID_FILE_TYPE',
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/import/status/:uploadId - Get import status
 */
router.get('/status/:uploadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const uploadId = req.params.uploadId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!uploadId) {
      return res.status(400).json({
        error: 'Upload ID is required',
        code: 'MISSING_REQUIRED_FIELD',
        timestamp: new Date().toISOString()
      });
    }

    const importRecord = await importService.getImportStatus(uploadId);
    
    if (!importRecord) {
      return res.status(404).json({
        error: 'Import record not found',
        code: 'IMPORT_NOT_FOUND',
        details: { uploadId },
        timestamp: new Date().toISOString()
      });
    }

    // Check if user owns this import
    if (importRecord.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      uploadId: importRecord.importId,
      status: importRecord.status,
      progress: importRecord.status === 'completed' ? 100 : 
                importRecord.status === 'failed' ? 0 : 50,
      totalRows: importRecord.totalRows,
      importedRows: importRecord.importedRows,
      errors: importRecord.errors,
      createdAt: importRecord.createdAt.toISOString(),
      completedAt: importRecord.completedAt?.toISOString(),
      metadata: importRecord.metadata
    });
    return;

  } catch (error) {
    logger.error('Error getting import status:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/import/history - Get import history
 */
router.get('/history', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        error: 'Limit must be between 1 and 100',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    const imports = await importService.getImportHistory(userId, limit);

    res.json({
      imports: imports.map(imp => ({
        importId: imp.importId,
        fileName: imp.fileName,
        status: imp.status,
        totalRows: imp.totalRows,
        importedRows: imp.importedRows,
        duplicateRows: imp.duplicateRows,
        createdAt: imp.createdAt.toISOString(),
        completedAt: imp.completedAt?.toISOString(),
        metadata: imp.metadata
      }))
    });
    return;

  } catch (error) {
    logger.error('Error getting import history:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

export default router; 