import { Router, Request, Response } from 'express';
import { realTimeService } from '../services/realTimeService';
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
 * GET /realtime/events - Establish SSE connection
 */
router.get('/events', (req: AuthenticatedRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  try {
    const clientId = realTimeService.initializeSSE(req.user.uid, res);
    
    // Log connection
    logger.info(`SSE connection established for user ${req.user.uid}, client ${clientId}`);
    
    // The response is handled by realTimeService and will be closed when client disconnects
    // No explicit return needed as the connection is managed by the real-time service
    
  } catch (error) {
    logger.error('Error establishing SSE connection:', error);
    res.status(500).json({ error: 'Failed to establish real-time connection' });
  }
});

/**
 * POST /realtime/subscribe - Update client subscriptions
 */
router.post('/subscribe', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const { clientId, subscriptions } = req.body;

    if (!clientId || !Array.isArray(subscriptions)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Expected clientId and subscriptions array.' 
      });
    }

    realTimeService.subscribe(clientId, subscriptions);

    return res.json({ 
      success: true, 
      message: 'Subscriptions updated',
      subscriptions 
    });
  } catch (error) {
    logger.error('Error updating subscriptions:', error);
    return res.status(500).json({ error: 'Failed to update subscriptions' });
  }
});

/**
 * GET /realtime/status - Get real-time service status
 */
router.get('/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalClients = realTimeService.getActiveClientsCount();
    const userClients = req.user ? realTimeService.getUserClientsCount(req.user.uid) : 0;

    return res.json({
      status: 'active',
      totalClients,
      userClients,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting real-time status:', error);
    return res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * POST /realtime/test-notification - Send test notification (development only)
 */
router.post('/test-notification', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoints not available in production' });
  }

  try {
    const { type = 'info', title, message } = req.body;

    realTimeService.emitNotification(req.user.uid, {
      type,
      title: title || 'Test Notification',
      message: message || 'This is a test notification from the real-time service'
    });

    return res.json({ 
      success: true, 
      message: 'Test notification sent' 
    });
  } catch (error) {
    logger.error('Error sending test notification:', error);
    return res.status(500).json({ error: 'Failed to send test notification' });
  }
});

/**
 * POST /realtime/test-trade-event - Trigger test trade event (development only)
 */
router.post('/test-trade-event', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoints not available in production' });
  }

  try {
    const { eventType = 'trade_created', tradeData } = req.body;

    const mockTrade = tradeData || {
      id: `test-${Date.now()}`,
      asset: 'BTCUSD',
      direction: 'call',
      amount: 25,
      entryPrice: 45000,
      exitPrice: 45100,
      result: 'win',
      profit: 22.50,
      entryTime: new Date().toISOString(),
      exitTime: new Date().toISOString(),
      platform: 'Test Platform'
    };

    switch (eventType) {
      case 'trade_created':
        realTimeService.emitTradeCreated(req.user.uid, mockTrade);
        break;
      case 'trade_updated':
        realTimeService.emitTradeUpdated(req.user.uid, mockTrade);
        break;
      case 'trade_deleted':
        realTimeService.emitTradeDeleted(req.user.uid, mockTrade.id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid event type' });
    }

    return res.json({ 
      success: true, 
      message: `Test ${eventType} event sent`,
      eventType,
      tradeData: mockTrade
    });
  } catch (error) {
    logger.error('Error sending test trade event:', error);
    return res.status(500).json({ error: 'Failed to send test trade event' });
  }
});

/**
 * POST /realtime/test-import-progress - Simulate import progress (development only)
 */
router.post('/test-import-progress', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Test endpoints not available in production' });
  }

  try {
    const uploadId = `test-upload-${Date.now()}`;
    const totalRows = 100;
    const userId = req.user.uid;

    // Simulate progress updates
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      
      realTimeService.emitImportProgress(userId, {
        uploadId,
        status: progress < 100 ? 'processing' : 'completed',
        progress,
        totalRows,
        processedRows: Math.floor((progress / 100) * totalRows),
        errors: progress === 50 ? [{ row: 25, error: 'Invalid date format' }] : []
      });

      if (progress >= 100) {
        clearInterval(interval);
        
        // Send completion notification
        realTimeService.emitNotification(userId, {
          type: 'success',
          title: 'Import Completed',
          message: `Successfully imported ${totalRows} trades`,
          data: { uploadId, totalRows }
        });
      }
    }, 1000);

    return res.json({ 
      success: true, 
      message: 'Test import progress simulation started',
      uploadId
    });
  } catch (error) {
    logger.error('Error simulating import progress:', error);
    return res.status(500).json({ error: 'Failed to simulate import progress' });
  }
});

export default router;