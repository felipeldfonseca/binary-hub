/**
 * Utility functions for merging CSV trade data with existing localStorage data
 */

interface Trade {
  entryTime: string;
  asset: string;
  direction: string;
  amount: number;
  result: 'win' | 'loss' | 'tie';
  pnl?: number;
  profit?: number;
  [key: string]: any;
}

interface TradeStats {
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: number;
  totalProfit: number;
  avgStake: number;
}

/**
 * Creates a unique key for trade deduplication
 * Based on entryTime + asset + direction + amount
 */
function getTradeKey(trade: Trade): string {
  return `${trade.entryTime}-${trade.asset}-${trade.direction}-${trade.amount}`;
}

/**
 * Merges new trades with existing trades in localStorage
 * Prevents duplicates and recalculates statistics
 */
export function mergeTradesWithExisting(newTrades: Trade[]): {
  allTrades: Trade[];
  mergedStats: TradeStats;
  mergeInfo: {
    existingCount: number;
    newUniqueCount: number;
    totalCount: number;
    duplicatesSkipped: number;
  };
} {
  const existingTrades = localStorage.getItem('binaryHub_trades');
  let allTrades = newTrades;
  let existingCount = 0;
  let duplicatesSkipped = 0;

  if (existingTrades) {
    try {
      const parsedExistingTrades: Trade[] = JSON.parse(existingTrades);
      existingCount = parsedExistingTrades.length;

      // Create a set of existing trade keys for fast lookup
      const existingKeys = new Set(parsedExistingTrades.map(getTradeKey));

      // Filter out duplicates from new trades
      const newUniqueTrades = newTrades.filter((trade: Trade) => {
        const isDuplicate = existingKeys.has(getTradeKey(trade));
        if (isDuplicate) duplicatesSkipped++;
        return !isDuplicate;
      });

      // Merge existing + new unique trades
      allTrades = [...parsedExistingTrades, ...newUniqueTrades];

      console.log(`Merged trades: ${existingCount} existing + ${newUniqueTrades.length} new unique = ${allTrades.length} total (${duplicatesSkipped} duplicates skipped)`);
    } catch (error) {
      console.error('Error parsing existing trades, using new trades only:', error);
      allTrades = newTrades;
    }
  }

  // Calculate statistics for all trades
  const totalTrades = allTrades.length;
  const winTrades = allTrades.filter((t: Trade) => t.result === 'win').length;
  const lossTrades = allTrades.filter((t: Trade) => t.result === 'loss').length;
  const totalProfit = allTrades.reduce((sum: number, t: Trade) => sum + (t.pnl || t.profit || 0), 0);
  const avgStake = totalTrades > 0 ? allTrades.reduce((sum: number, t: Trade) => sum + (t.amount || 0), 0) / totalTrades : 0;

  const mergedStats: TradeStats = {
    totalTrades,
    winTrades,
    lossTrades,
    winRate: totalTrades > 0 ? (winTrades / totalTrades) * 100 : 0,
    totalProfit,
    avgStake
  };

  return {
    allTrades,
    mergedStats,
    mergeInfo: {
      existingCount,
      newUniqueCount: allTrades.length - existingCount,
      totalCount: allTrades.length,
      duplicatesSkipped
    }
  };
}

/**
 * Stores merged trade data and statistics in localStorage
 */
export function storeMergedTradeData(trades: Trade[], stats: TradeStats): void {
  localStorage.setItem('binaryHub_hasData', 'true');
  localStorage.setItem('binaryHub_trades', JSON.stringify(trades));
  localStorage.setItem('binaryHub_stats', JSON.stringify(stats));
}

/**
 * Complete function to merge and store new trades
 */
export function mergeAndStoreTradeData(newTrades: Trade[]): {
  success: boolean;
  mergeInfo: {
    existingCount: number;
    newUniqueCount: number;
    totalCount: number;
    duplicatesSkipped: number;
  };
} {
  try {
    const { allTrades, mergedStats, mergeInfo } = mergeTradesWithExisting(newTrades);
    storeMergedTradeData(allTrades, mergedStats);
    
    return {
      success: true,
      mergeInfo
    };
  } catch (error) {
    console.error('Error merging and storing trade data:', error);
    return {
      success: false,
      mergeInfo: {
        existingCount: 0,
        newUniqueCount: 0,
        totalCount: 0,
        duplicatesSkipped: 0
      }
    };
  }
}