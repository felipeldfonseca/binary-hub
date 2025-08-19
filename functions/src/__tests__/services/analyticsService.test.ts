import { AnalyticsService } from '../../services/analyticsService';
import { TradeService } from '../../services/tradeService';

// Mock dependencies
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => ({}))
}));

jest.mock('../../services/cacheService', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn()
  }
}));

jest.mock('../../services/tradeService', () => ({
  tradeService: {
    getUserTrades: jest.fn(),
    getTradeStats: jest.fn()
  }
}));

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockTradeService: jest.Mocked<TradeService>;
  let mockCacheService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    analyticsService = new AnalyticsService();
    mockTradeService = require('../../services/tradeService').tradeService;
    mockCacheService = require('../../services/cacheService').cacheService;
  });

  const mockTrades = [
    {
      id: '1',
      userId: 'test-user',
      tradeId: 'trade-1',
      asset: 'EURUSD',
      direction: 'call' as const,
      amount: 100,
      entryPrice: 1.1000,
      exitPrice: 1.1050,
      entryTime: new Date('2023-01-01T10:00:00Z'),
      exitTime: new Date('2023-01-01T10:05:00Z'),
      timeframe: 'M5',
      candleTime: '10:00',
      refunded: 0,
      executed: 100,
      status: 'WIN' as const,
      result: 'win' as const,
      profit: 80,
      payout: 80,
      platform: 'Ebinex',
      createdAt: new Date('2023-01-01T10:05:00Z'),
      updatedAt: new Date('2023-01-01T10:05:00Z')
    },
    {
      id: '2',
      userId: 'test-user',
      tradeId: 'trade-2',
      asset: 'GBPUSD',
      direction: 'put' as const,
      amount: 100,
      entryPrice: 1.2000,
      exitPrice: 1.1950,
      entryTime: new Date('2023-01-01T11:00:00Z'),
      exitTime: new Date('2023-01-01T11:05:00Z'),
      timeframe: 'M5',
      candleTime: '11:00',
      refunded: 0,
      executed: 100,
      status: 'LOSE' as const,
      result: 'loss' as const,
      profit: -100,
      payout: 0,
      platform: 'Ebinex',
      createdAt: new Date('2023-01-01T11:05:00Z'),
      updatedAt: new Date('2023-01-01T11:05:00Z')
    }
  ];

  const mockTradeStats = {
    totalTrades: 2,
    winTrades: 1,
    lossTrades: 1,
    tieTrades: 0,
    winRate: 50,
    totalPnl: -20,
    avgPnl: -10,
    maxDrawdown: 100,
    avgStake: 100,
    maxStake: 100
  };

  describe('getDashboardAnalytics', () => {
    test('should return cached data when available', async () => {
      const cachedData = {
        period: 'weekly',
        stats: mockTradeStats,
        performance: [],
        quickInsights: [],
        alerts: []
      };

      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await analyticsService.getDashboardAnalytics('test-user', 'weekly');

      expect(result).toEqual(cachedData);
      expect(mockCacheService.get).toHaveBeenCalledWith('analytics:dashboard:test-user:weekly');
      expect(mockTradeService.getUserTrades).not.toHaveBeenCalled();
    });

    test('should compute and cache data when not cached', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getDashboardAnalytics('test-user', 'weekly');

      expect(result).toBeDefined();
      expect(result.period).toBe('weekly');
      expect(result.stats).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.quickInsights).toBeDefined();
      expect(result.alerts).toBeDefined();

      expect(mockCacheService.set).toHaveBeenCalled();
      expect(mockTradeService.getUserTrades).toHaveBeenCalled();
    });

    test('should calculate correct statistics from trades', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getDashboardAnalytics('test-user', 'weekly');

      expect(result.stats.totalTrades).toBe(2);
      expect(result.stats.winTrades).toBe(1);
      expect(result.stats.lossTrades).toBe(1);
      expect(result.stats.winRate).toBe(50);
      expect(result.stats.totalPnl).toBe(-20);
    });

    test('should generate performance data grouped by date', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getDashboardAnalytics('test-user', 'weekly');

      expect(result.performance).toBeDefined();
      expect(Array.isArray(result.performance)).toBe(true);
      
      // Should have one entry for the date since both trades are on the same date
      expect(result.performance.length).toBe(1);
      expect(result.performance[0].date).toBe('2023-01-01');
      expect(result.performance[0].trades).toBe(2);
      expect(result.performance[0].pnl).toBe(-20);
    });

    test('should generate quick insights based on performance', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getDashboardAnalytics('test-user', 'weekly');

      expect(result.quickInsights).toBeDefined();
      expect(Array.isArray(result.quickInsights)).toBe(true);
    });

    test('should generate alerts for concerning patterns', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Create trades with consecutive losses to trigger alerts
      const losingTrades = Array.from({ length: 5 }, (_, i) => ({
        ...mockTrades[1], // Use the losing trade as template
        id: `loss-${i}`,
        tradeId: `loss-trade-${i}`,
        entryTime: new Date(`2023-01-01T${10 + i}:00:00Z`),
        exitTime: new Date(`2023-01-01T${10 + i}:05:00Z`)
      }));
      
      mockTradeService.getUserTrades.mockResolvedValue(losingTrades);

      const result = await analyticsService.getDashboardAnalytics('test-user', 'weekly');

      expect(result.alerts).toBeDefined();
      expect(Array.isArray(result.alerts)).toBe(true);
    });

    test('should handle different time periods', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const periods: ('daily' | 'weekly' | 'monthly' | 'yearly')[] = ['daily', 'weekly', 'monthly', 'yearly'];
      
      for (const period of periods) {
        const result = await analyticsService.getDashboardAnalytics('test-user', period);
        expect(result.period).toBe(period);
      }
    });
  });

  describe('getAnalytics', () => {
    test('should return comprehensive analytics data', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getAnalytics('test-user', 'weekly');

      expect(result).toBeDefined();
      expect(result.period).toBe('weekly');
      expect(result.stats).toBeDefined();
      expect(result.performance).toBeDefined();
      expect(result.assetBreakdown).toBeDefined();
      expect(result.timeAnalysis).toBeDefined();
      expect(result.streakAnalysis).toBeDefined();
      expect(result.riskMetrics).toBeDefined();
    });

    test('should calculate asset breakdown correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getAnalytics('test-user', 'weekly');

      expect(result.assetBreakdown).toBeDefined();
      expect(result.assetBreakdown.length).toBe(2); // EURUSD and GBPUSD
      
      const eurUsdAsset = result.assetBreakdown.find(a => a.asset === 'EURUSD');
      const gbpUsdAsset = result.assetBreakdown.find(a => a.asset === 'GBPUSD');
      
      expect(eurUsdAsset).toBeDefined();
      expect(eurUsdAsset!.trades).toBe(1);
      expect(eurUsdAsset!.winRate).toBe(100);
      
      expect(gbpUsdAsset).toBeDefined();
      expect(gbpUsdAsset!.trades).toBe(1);
      expect(gbpUsdAsset!.winRate).toBe(0);
    });

    test('should calculate time analysis', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getAnalytics('test-user', 'weekly');

      expect(result.timeAnalysis).toBeDefined();
      expect(result.timeAnalysis.bestHour).toBeDefined();
      expect(result.timeAnalysis.worstHour).toBeDefined();
      expect(result.timeAnalysis.bestDay).toBeDefined();
      expect(result.timeAnalysis.worstDay).toBeDefined();
      expect(result.timeAnalysis.tradingFrequency).toBeDefined();
    });

    test('should calculate streak analysis', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      // Create alternating win/loss pattern
      const alternatingTrades = [
        { ...mockTrades[0], entryTime: new Date('2023-01-01T10:00:00Z'), result: 'win' as const },
        { ...mockTrades[1], entryTime: new Date('2023-01-01T11:00:00Z'), result: 'loss' as const },
        { ...mockTrades[0], entryTime: new Date('2023-01-01T12:00:00Z'), result: 'win' as const },
        { ...mockTrades[1], entryTime: new Date('2023-01-01T13:00:00Z'), result: 'loss' as const }
      ];
      
      mockTradeService.getUserTrades.mockResolvedValue(alternatingTrades);

      const result = await analyticsService.getAnalytics('test-user', 'weekly');

      expect(result.streakAnalysis).toBeDefined();
      expect(result.streakAnalysis.currentWinStreak).toBeDefined();
      expect(result.streakAnalysis.currentLossStreak).toBeDefined();
      expect(result.streakAnalysis.longestWinStreak).toBeDefined();
      expect(result.streakAnalysis.longestLossStreak).toBeDefined();
      expect(result.streakAnalysis.streakHistory).toBeDefined();
    });

    test('should calculate risk metrics', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getAnalytics('test-user', 'weekly');

      expect(result.riskMetrics).toBeDefined();
      expect(result.riskMetrics.maxDrawdown).toBeDefined();
      expect(result.riskMetrics.maxDrawdownPercent).toBeDefined();
      expect(result.riskMetrics.sharpeRatio).toBeDefined();
      expect(result.riskMetrics.profitFactor).toBeDefined();
      expect(result.riskMetrics.recoveryFactor).toBeDefined();
      expect(result.riskMetrics.avgRiskReward).toBeDefined();
      expect(result.riskMetrics.consistencyRatio).toBeDefined();
    });
  });

  describe('getAssetAnalytics', () => {
    test('should return asset performance for all assets', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      const result = await analyticsService.getAssetAnalytics('test-user');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    test('should return asset performance for specific asset', async () => {
      mockCacheService.get.mockResolvedValue(null);
      const eurUsdTrades = mockTrades.filter(t => t.asset === 'EURUSD');
      mockTradeService.getUserTrades.mockResolvedValue(eurUsdTrades);

      const result = await analyticsService.getAssetAnalytics('test-user', 'EURUSD');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].asset).toBe('EURUSD');
    });

    test('should use cached data when available', async () => {
      const cachedData = [
        { asset: 'EURUSD', trades: 1, winRate: 100, totalPnl: 80, avgPnl: 80, volume: 100, bestStreak: 1, worstStreak: 0 }
      ];
      
      mockCacheService.get.mockResolvedValue(cachedData);

      const result = await analyticsService.getAssetAnalytics('test-user', 'EURUSD');

      expect(result).toEqual(cachedData);
      expect(mockTradeService.getUserTrades).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle trade service errors gracefully', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.getDashboardAnalytics('test-user')).rejects.toThrow('Failed to get dashboard analytics');
    });

    test('should handle empty trade data', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue([]);

      const result = await analyticsService.getDashboardAnalytics('test-user');

      expect(result).toBeDefined();
      expect(result.stats.totalTrades).toBe(0);
      expect(result.performance).toEqual([]);
    });

    test('should handle cache service errors gracefully', async () => {
      mockCacheService.get.mockRejectedValue(new Error('Cache error'));
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      // Should still work without cache
      const result = await analyticsService.getDashboardAnalytics('test-user');
      expect(result).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeTrades = Array.from({ length: 1000 }, (_, i) => ({
        ...mockTrades[0],
        id: `trade-${i}`,
        tradeId: `trade-${i}`,
        entryTime: new Date(`2023-01-${Math.floor(i / 30) + 1}T${i % 24}:00:00Z`),
        profit: Math.random() > 0.5 ? 80 : -100,
        result: Math.random() > 0.5 ? 'win' as const : 'loss' as const
      }));

      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(largeTrades);

      const startTime = Date.now();
      const result = await analyticsService.getDashboardAnalytics('test-user');
      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should use appropriate cache TTL for different periods', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockTradeService.getUserTrades.mockResolvedValue(mockTrades);

      await analyticsService.getDashboardAnalytics('test-user', 'daily');
      
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          ttl: 300, // 5 minutes for daily
          tags: expect.any(Array)
        })
      );
    });
  });
});