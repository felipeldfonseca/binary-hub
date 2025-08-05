import { Router, Request, Response } from 'express';
import { tradeService, TradeFilters } from '../services/tradeService';
import { validateTradeData, validateTradeFilters, sanitizeTradeData, createValidationError, logValidationErrors } from '../utils/validation';
import { logger } from 'firebase-functions';

// Extend Express Request to include user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    [key: string]: any;
  };
}

const router = Router();

/**
 * GET /v1/trades - List user trades with filtering and pagination
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Parse and validate filters
    const filters: TradeFilters = {
      start: req.query.start ? new Date(req.query.start as string) : undefined,
      end: req.query.end ? new Date(req.query.end as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      result: req.query.result as 'win' | 'loss' | 'tie' | undefined,
      asset: req.query.asset as string | undefined,
      strategy: req.query.strategy as string | undefined,
    };

    const validation = validateTradeFilters(filters);
    if (!validation.isValid) {
      logValidationErrors(validation.errors, 'GET /v1/trades');
      return res.status(400).json(createValidationError(validation.errors));
    }

    const trades = await tradeService.getUserTrades(userId, filters);
    
    // Calculate pagination info
    const total = trades.length; // In a real implementation, you'd get this from a separate query
    const hasMore = total > (filters.offset || 0) + (filters.limit || 100);

    res.json({
      trades,
      pagination: {
        total,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        hasMore
      }
    });
    return;

  } catch (error) {
    logger.error('Error getting trades:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/trades - Create new trade
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Validate request body
    const validation = validateTradeData(req.body);
    if (!validation.isValid) {
      logValidationErrors(validation.errors, 'POST /v1/trades');
      return res.status(400).json(createValidationError(validation.errors));
    }

    // Sanitize data
    const sanitizedData = sanitizeTradeData(req.body);
    
    // Create trade
    const trade = await tradeService.createTrade(userId, sanitizedData);
    
    res.status(201).json(trade);
    return;

  } catch (error) {
    logger.error('Error creating trade:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * GET /v1/trades/:id - Get specific trade details
 */
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const tradeId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!tradeId) {
      return res.status(400).json({
        error: 'Trade ID is required',
        code: 'MISSING_REQUIRED_FIELD',
        timestamp: new Date().toISOString()
      });
    }

    const trade = await tradeService.getTrade(userId, tradeId);
    
    if (!trade) {
      return res.status(404).json({
        error: 'Trade not found',
        code: 'TRADE_NOT_FOUND',
        details: { tradeId },
        timestamp: new Date().toISOString()
      });
    }

    res.json(trade);
    return;

  } catch (error) {
    logger.error('Error getting trade:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * PUT /v1/trades/:id - Update trade
 */
router.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const tradeId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!tradeId) {
      return res.status(400).json({
        error: 'Trade ID is required',
        code: 'MISSING_REQUIRED_FIELD',
        timestamp: new Date().toISOString()
      });
    }

    // Check if trade exists
    const existingTrade = await tradeService.getTrade(userId, tradeId);
    if (!existingTrade) {
      return res.status(404).json({
        error: 'Trade not found',
        code: 'TRADE_NOT_FOUND',
        details: { tradeId },
        timestamp: new Date().toISOString()
      });
    }

    // Validate update data
    const validation = validateTradeData(req.body);
    if (!validation.isValid) {
      logValidationErrors(validation.errors, 'PUT /v1/trades/:id');
      return res.status(400).json(createValidationError(validation.errors));
    }

    // Sanitize data
    const sanitizedData = sanitizeTradeData(req.body);
    
    // Update trade
    const updatedTrade = await tradeService.updateTrade(userId, tradeId, sanitizedData);
    
    res.json(updatedTrade);
    return;

  } catch (error) {
    logger.error('Error updating trade:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * DELETE /v1/trades/:id - Delete trade
 */
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const tradeId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!tradeId) {
      return res.status(400).json({
        error: 'Trade ID is required',
        code: 'MISSING_REQUIRED_FIELD',
        timestamp: new Date().toISOString()
      });
    }

    // Check if trade exists
    const existingTrade = await tradeService.getTrade(userId, tradeId);
    if (!existingTrade) {
      return res.status(404).json({
        error: 'Trade not found',
        code: 'TRADE_NOT_FOUND',
        details: { tradeId },
        timestamp: new Date().toISOString()
      });
    }

    // Delete trade
    await tradeService.deleteTrade(userId, tradeId);
    
    res.json({ success: true });
    return;

  } catch (error) {
    logger.error('Error deleting trade:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

/**
 * POST /v1/trades/bulk - Bulk create trades (for CSV import)
 */
router.post('/bulk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { trades, importBatch } = req.body;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!Array.isArray(trades)) {
      return res.status(400).json({
        error: 'Trades must be an array',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    if (trades.length === 0) {
      return res.status(400).json({
        error: 'Trades array cannot be empty',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    if (trades.length > 1000) {
      return res.status(400).json({
        error: 'Cannot import more than 1000 trades at once',
        code: 'VALIDATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Validate each trade
    const errors: Array<{ index: number; error: string }> = [];
    const validTrades: any[] = [];

    for (let i = 0; i < trades.length; i++) {
      const validation = validateTradeData(trades[i]);
      if (!validation.isValid) {
        errors.push({
          index: i,
          error: validation.errors.join(', ')
        });
      } else {
        validTrades.push(sanitizeTradeData(trades[i]));
      }
    }

    if (validTrades.length === 0) {
      return res.status(400).json({
        error: 'No valid trades found',
        code: 'VALIDATION_ERROR',
        details: { errors },
        timestamp: new Date().toISOString()
      });
    }

    // Bulk create trades
    const result = await tradeService.bulkCreateTrades(userId, validTrades, importBatch);
    
    res.status(201).json({
      created: result.created,
      errors: [...errors, ...result.errors]
    });
    return;

  } catch (error) {
    logger.error('Error bulk creating trades:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    });
    return;
  }
});

export default router; 