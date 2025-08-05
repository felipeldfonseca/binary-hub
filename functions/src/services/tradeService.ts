import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();

export interface Trade {
  // Core Fields
  id: string;
  userId: string;
  tradeId: string; // Exchange trade ID (from CSV)
  
  // Trade Details
  asset: string;
  direction: 'call' | 'put';
  amount: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date;
  exitTime: Date;
  
  // CSV-Specific Fields
  timeframe: string;
  candleTime: string;
  refunded: number;
  executed: number;
  status: 'WIN' | 'LOSE';
  result: 'win' | 'loss' | 'tie';
  profit: number;
  
  // Results
  payout: number;
  
  // Metadata
  platform: string;
  strategy?: string;
  notes?: string;
  screenshots?: string[];
  
  // System Fields
  createdAt: Date;
  updatedAt: Date;
  importedAt?: Date;
  importBatch?: string;
}

export interface TradeFilters {
  start?: Date;
  end?: Date;
  limit?: number;
  offset?: number;
  result?: 'win' | 'loss' | 'tie';
  asset?: string;
  strategy?: string;
}

export interface TradeStats {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  tieTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  maxDrawdown: number;
  avgStake: number;
  maxStake: number;
}

export class TradeService {
  /**
   * Create a new trade
   */
  async createTrade(userId: string, tradeData: Partial<Trade>): Promise<Trade> {
    try {
      const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const trade: Trade = {
        id: tradeId,
        userId,
        ...tradeData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Trade;
      
      await db.collection('users').doc(userId).collection('trades').doc(tradeId).set(trade);
      
      logger.info(`Trade created: ${tradeId} for user: ${userId}`);
      return trade;
    } catch (error) {
      logger.error('Error creating trade:', error);
      throw new Error('Failed to create trade');
    }
  }

  /**
   * Get trades for a user with optional filters
   */
  async getUserTrades(userId: string, filters: TradeFilters = {}): Promise<Trade[]> {
    try {
      let query = db.collection('users').doc(userId).collection('trades') as any;
      
      // Apply filters
      if (filters.start) {
        query = query.where('entryTime', '>=', filters.start);
      }
      if (filters.end) {
        query = query.where('entryTime', '<=', filters.end);
      }
      if (filters.result) {
        query = query.where('result', '==', filters.result);
      }
      if (filters.asset) {
        query = query.where('asset', '==', filters.asset);
      }
      if (filters.strategy) {
        query = query.where('strategy', '==', filters.strategy);
      }
      
      // Apply pagination
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      
      const snapshot = await query
        .orderBy('entryTime', 'desc')
        .offset(offset)
        .limit(limit)
        .get();
      
          return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    })) as Trade[];
    } catch (error) {
      logger.error('Error getting user trades:', error);
      throw new Error('Failed to get user trades');
    }
  }

  /**
   * Get a specific trade by ID
   */
  async getTrade(userId: string, tradeId: string): Promise<Trade | null> {
    try {
      const doc = await db.collection('users').doc(userId).collection('trades').doc(tradeId).get();
      
      if (!doc.exists) {
        return null;
      }
      
      return {
        id: doc.id,
        ...doc.data()
      } as Trade;
    } catch (error) {
      logger.error('Error getting trade:', error);
      throw new Error('Failed to get trade');
    }
  }

  /**
   * Update a trade
   */
  async updateTrade(userId: string, tradeId: string, data: Partial<Trade>): Promise<Trade> {
    try {
      const updateData = {
        ...data,
        updatedAt: new Date()
      };
      
      await db.collection('users').doc(userId).collection('trades').doc(tradeId).update(updateData);
      
      // Get the updated trade
      const updatedTrade = await this.getTrade(userId, tradeId);
      if (!updatedTrade) {
        throw new Error('Trade not found');
      }
      
      logger.info(`Trade updated: ${tradeId} for user: ${userId}`);
      return updatedTrade;
    } catch (error) {
      logger.error('Error updating trade:', error);
      throw new Error('Failed to update trade');
    }
  }

  /**
   * Delete a trade
   */
  async deleteTrade(userId: string, tradeId: string): Promise<boolean> {
    try {
      await db.collection('users').doc(userId).collection('trades').doc(tradeId).delete();
      
      logger.info(`Trade deleted: ${tradeId} for user: ${userId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting trade:', error);
      throw new Error('Failed to delete trade');
    }
  }

  /**
   * Bulk create trades (for CSV import)
   */
  async bulkCreateTrades(userId: string, trades: Partial<Trade>[], importBatch?: string): Promise<{
    created: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    try {
      const batch = db.batch();
      const errors: Array<{ index: number; error: string }> = [];
      let created = 0;

      for (let i = 0; i < trades.length; i++) {
        try {
          const trade = trades[i];
          const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const tradeData: Trade = {
            id: tradeId,
            userId,
            ...trade,
            importBatch,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Trade;
          
          const docRef = db.collection('users').doc(userId).collection('trades').doc(tradeId);
          batch.set(docRef, tradeData);
          created++;
        } catch (error) {
          errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      await batch.commit();
      
      logger.info(`Bulk created ${created} trades for user: ${userId}`);
      return { created, errors };
    } catch (error) {
      logger.error('Error bulk creating trades:', error);
      throw new Error('Failed to bulk create trades');
    }
  }

  /**
   * Get trade statistics for a user
   */
  async getTradeStats(userId: string, period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly'): Promise<TradeStats> {
    try {
      const trades = await this.getUserTrades(userId, { limit: 1000 });
      
      if (trades.length === 0) {
        return {
          totalTrades: 0,
          winTrades: 0,
          lossTrades: 0,
          tieTrades: 0,
          winRate: 0,
          totalPnl: 0,
          avgPnl: 0,
          maxDrawdown: 0,
          avgStake: 0,
          maxStake: 0,
        };
      }

      const winTrades = trades.filter(t => t.result === 'win').length;
      const lossTrades = trades.filter(t => t.result === 'loss').length;
      const tieTrades = trades.filter(t => t.result === 'tie').length;
      const totalTrades = trades.length;
      
      const totalPnl = trades.reduce((sum, t) => sum + (t.profit || 0), 0);
      const avgPnl = totalPnl / totalTrades;
      const winRate = totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0;
      
      const stakes = trades.map(t => t.amount);
      const avgStake = stakes.reduce((sum, s) => sum + s, 0) / stakes.length;
      const maxStake = Math.max(...stakes);
      
      // Calculate max drawdown (simplified)
      let maxDrawdown = 0;
      let runningTotal = 0;
      let peak = 0;
      
      for (const trade of trades.sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())) {
        runningTotal += trade.profit || 0;
        if (runningTotal > peak) {
          peak = runningTotal;
        }
        const drawdown = peak - runningTotal;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      return {
        totalTrades,
        winTrades,
        lossTrades,
        tieTrades,
        winRate,
        totalPnl,
        avgPnl,
        maxDrawdown,
        avgStake,
        maxStake,
      };
    } catch (error) {
      logger.error('Error getting trade stats:', error);
      throw new Error('Failed to get trade statistics');
    }
  }

  /**
   * Check if trades exist by trade IDs (for deduplication)
   */
  async findExistingTrades(userId: string, tradeIds: string[]): Promise<string[]> {
    try {
      const existingTradeIds: string[] = [];
      
      // Firestore has a limit of 10 items in 'in' queries, so we need to batch
      const batchSize = 10;
      for (let i = 0; i < tradeIds.length; i += batchSize) {
        const batch = tradeIds.slice(i, i + batchSize);
        const snapshot = await db
          .collection('users')
          .doc(userId)
          .collection('trades')
          .where('tradeId', 'in', batch)
          .get();
        
        existingTradeIds.push(...snapshot.docs.map(doc => doc.data().tradeId));
      }
      
      return existingTradeIds;
    } catch (error) {
      logger.error('Error finding existing trades:', error);
      throw new Error('Failed to check existing trades');
    }
  }
}

export const tradeService = new TradeService(); 