import { Response } from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { EventEmitter } from 'events';

// Extend EventEmitter class size limit for many clients
EventEmitter.defaultMaxListeners = 1000;

interface SSEClient {
  id: string;
  userId: string;
  response: Response;
  lastPing: Date;
  subscriptions: Set<string>;
}

interface RealtimeEvent {
  type: 'trade_created' | 'trade_updated' | 'trade_deleted' | 'import_progress' | 'analytics_updated' | 'notification';
  userId: string;
  data: any;
  timestamp: string;
}

interface ImportProgress {
  uploadId: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  errors?: Array<{ row: number; error: string }>;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  data?: any;
  createdAt: string;
  read: boolean;
}

class RealTimeService {
  private clients: Map<string, SSEClient> = new Map();
  private eventEmitter: EventEmitter = new EventEmitter();
  private _db: ReturnType<typeof getFirestore> | null = null;
  
  private get db() {
    if (!this._db) {
      this._db = getFirestore();
    }
    return this._db;
  }
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start heartbeat to clean up dead connections
    this.startHeartbeat();
    
    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize SSE connection for a client
   */
  initializeSSE(userId: string, response: Response): string {
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Set up SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Create client object
    const client: SSEClient = {
      id: clientId,
      userId,
      response,
      lastPing: new Date(),
      subscriptions: new Set(['trades', 'analytics', 'imports', 'notifications'])
    };

    // Store client
    this.clients.set(clientId, client);

    // Send initial connection message
    this.sendToClient(clientId, {
      type: 'connection',
      data: { 
        clientId, 
        message: 'Connected to real-time updates',
        timestamp: new Date().toISOString()
      }
    });

    // Handle client disconnect
    response.on('close', () => {
      this.removeClient(clientId);
    });

    response.on('error', (error) => {
      logger.error('SSE Client error:', error);
      this.removeClient(clientId);
    });

    logger.info(`SSE client connected: ${clientId} for user ${userId}`);
    return clientId;
  }

  /**
   * Subscribe client to specific data streams
   */
  subscribe(clientId: string, subscriptions: string[]) {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions = new Set(subscriptions);
      this.sendToClient(clientId, {
        type: 'subscription_updated',
        data: { subscriptions: Array.from(client.subscriptions) }
      });
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        client.response.write(message);
        client.lastPing = new Date();
      } catch (error) {
        logger.error('Error sending to client:', error);
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Broadcast event to all subscribed clients
   */
  private broadcast(event: RealtimeEvent) {
    const clients = Array.from(this.clients.values()).filter(
      client => client.userId === event.userId && client.subscriptions.has(this.getSubscriptionType(event.type))
    );

    clients.forEach(client => {
      this.sendToClient(client.id, {
        type: event.type,
        data: event.data,
        timestamp: event.timestamp
      });
    });

    logger.info(`Broadcasted ${event.type} event to ${clients.length} clients for user ${event.userId}`);
  }

  /**
   * Get subscription type from event type
   */
  private getSubscriptionType(eventType: string): string {
    if (eventType.startsWith('trade_')) return 'trades';
    if (eventType.startsWith('import_')) return 'imports';
    if (eventType.startsWith('analytics_')) return 'analytics';
    if (eventType === 'notification') return 'notifications';
    return 'general';
  }

  /**
   * Remove client from active connections
   */
  private removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.response.end();
      } catch (error) {
        // Client already disconnected
      }
      this.clients.delete(clientId);
      logger.info(`SSE client disconnected: ${clientId}`);
    }
  }

  /**
   * Send heartbeat to all clients and clean up dead connections
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const clients = Array.from(this.clients.entries());

      clients.forEach(([clientId, client]) => {
        // Check if client is still alive (last ping within 60 seconds)
        if (now.getTime() - client.lastPing.getTime() > 60000) {
          this.removeClient(clientId);
        } else {
          // Send heartbeat
          this.sendToClient(clientId, {
            type: 'heartbeat',
            data: { timestamp: now.toISOString() }
          });
        }
      });

      logger.info(`Heartbeat: ${this.clients.size} active SSE clients`);
    }, 30000); // Every 30 seconds
  }

  /**
   * Set up Firestore listeners for real-time events
   */
  private setupEventListeners() {
    // Listen for trade changes
    this.eventEmitter.on('trade_created', (userId: string, trade: any) => {
      this.broadcast({
        type: 'trade_created',
        userId,
        data: trade,
        timestamp: new Date().toISOString()
      });
    });

    this.eventEmitter.on('trade_updated', (userId: string, trade: any) => {
      this.broadcast({
        type: 'trade_updated',
        userId,
        data: trade,
        timestamp: new Date().toISOString()
      });
    });

    this.eventEmitter.on('trade_deleted', (userId: string, tradeId: string) => {
      this.broadcast({
        type: 'trade_deleted',
        userId,
        data: { id: tradeId },
        timestamp: new Date().toISOString()
      });
    });

    // Listen for import progress
    this.eventEmitter.on('import_progress', (userId: string, progress: ImportProgress) => {
      this.broadcast({
        type: 'import_progress',
        userId,
        data: progress,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for analytics updates
    this.eventEmitter.on('analytics_updated', (userId: string, analytics: any) => {
      this.broadcast({
        type: 'analytics_updated',
        userId,
        data: analytics,
        timestamp: new Date().toISOString()
      });
    });

    // Listen for notifications
    this.eventEmitter.on('notification', (userId: string, notification: Notification) => {
      this.broadcast({
        type: 'notification',
        userId,
        data: notification,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Emit trade events
   */
  emitTradeCreated(userId: string, trade: any) {
    this.eventEmitter.emit('trade_created', userId, trade);
    
    // Also trigger analytics update
    setTimeout(() => {
      this.emitAnalyticsUpdate(userId);
    }, 1000);
  }

  emitTradeUpdated(userId: string, trade: any) {
    this.eventEmitter.emit('trade_updated', userId, trade);
    
    // Also trigger analytics update
    setTimeout(() => {
      this.emitAnalyticsUpdate(userId);
    }, 1000);
  }

  emitTradeDeleted(userId: string, tradeId: string) {
    this.eventEmitter.emit('trade_deleted', userId, tradeId);
    
    // Also trigger analytics update
    setTimeout(() => {
      this.emitAnalyticsUpdate(userId);
    }, 1000);
  }

  /**
   * Emit import progress events
   */
  emitImportProgress(userId: string, progress: ImportProgress) {
    this.eventEmitter.emit('import_progress', userId, progress);
  }

  /**
   * Emit analytics update events
   */
  async emitAnalyticsUpdate(userId: string) {
    try {
      // Get latest analytics data
      const tradesSnapshot = await this.db.collection('trades').doc(userId).collection('trades')
        .orderBy('entryTime', 'desc')
        .limit(100)
        .get();

      const trades = tradesSnapshot.docs.map(doc => doc.data());

      // Calculate basic stats
      const totalTrades = trades.length;
      const wins = trades.filter(t => t.result === 'win').length;
      const losses = trades.filter(t => t.result === 'loss').length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const totalPnl = trades.reduce((sum, t) => sum + (t.profit || 0), 0);

      const analytics = {
        totalTrades,
        wins,
        losses,
        winRate: Math.round(winRate * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        updatedAt: new Date().toISOString()
      };

      this.eventEmitter.emit('analytics_updated', userId, analytics);
    } catch (error) {
      logger.error('Error calculating analytics:', error);
    }
  }

  /**
   * Emit notification events
   */
  emitNotification(userId: string, notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
    const fullNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      read: false
    };

    // Store notification in Firestore
    this.db.collection('notifications').doc(userId).collection('notifications').add(fullNotification)
      .catch(error => logger.error('Error storing notification:', error));

    this.eventEmitter.emit('notification', userId, fullNotification);
  }

  /**
   * Get active clients count
   */
  getActiveClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients for a specific user
   */
  getUserClientsCount(userId: string): number {
    return Array.from(this.clients.values()).filter(client => client.userId === userId).length;
  }

  /**
   * Cleanup service
   */
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    this.clients.forEach((client, clientId) => {
      this.removeClient(clientId);
    });

    this.eventEmitter.removeAllListeners();
  }
}

// Export singleton instance
export const realTimeService = new RealTimeService();