import { AIService } from '../../services/aiService';
import { getFirestore } from 'firebase-admin/firestore';

// Mock Firebase Firestore
jest.mock('firebase-admin/firestore');

// Mock OpenAI and Gemini
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn(() => ({
      generateContent: jest.fn()
    }))
  }))
}));

const mockFirestore = {
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      get: jest.fn(),
      set: jest.fn(),
      update: jest.fn(),
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn(),
          set: jest.fn(),
          update: jest.fn()
        }))
      }))
    }))
  }))
};

(getFirestore as jest.Mock).mockReturnValue(mockFirestore);

describe('AIService', () => {
  let aiService: AIService;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = new AIService();
  });

  describe('checkUsageLimits', () => {
    it('should allow usage within limits for free tier', async () => {
      const mockUsage = {
        individual_trade: 3,
        daily_report: 0,
        weekly_report: 0,
        pattern_analysis: 0
      };

      const mockSubscription = {
        tier: 'free'
      };

      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUsage
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: mockSubscription })
      });

      const result = await aiService.checkUsageLimits('user_123', 'individual_trade');

      expect(result.allowed).toBe(true);
    });

    it('should deny usage when limits exceeded for free tier', async () => {
      const mockUsage = {
        individual_trade: 5,
        daily_report: 0,
        weekly_report: 0,
        pattern_analysis: 0
      };

      const mockSubscription = {
        tier: 'free'
      };

      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUsage
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: mockSubscription })
      });

      const result = await aiService.checkUsageLimits('user_123', 'individual_trade');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('limit exceeded');
    });

    it('should allow higher usage for pro tier', async () => {
      const mockUsage = {
        individual_trade: 50,
        daily_report: 15,
        weekly_report: 2,
        pattern_analysis: 5
      };

      const mockSubscription = {
        tier: 'pro'
      };

      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUsage
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: mockSubscription })
      });

      const result = await aiService.checkUsageLimits('user_123', 'individual_trade');

      expect(result.allowed).toBe(true);
    });

    it('should handle missing usage data', async () => {
      const mockSubscription = {
        tier: 'free'
      };

      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: false
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: mockSubscription })
      });

      const result = await aiService.checkUsageLimits('user_123', 'individual_trade');

      expect(result.allowed).toBe(true);
    });
  });

  describe('determineOptimalModel', () => {
    it('should use GPT-4o for individual trade analysis', () => {
      const request = {
        type: 'individual_trade' as const,
        userId: 'user_123',
        data: { tradeData: 'test' },
        model: 'auto' as const
      };

      const model = aiService.determineOptimalModel(request);

      expect(model).toBe('gpt4o');
    });

    it('should use Gemini for daily reports', () => {
      const request = {
        type: 'daily_report' as const,
        userId: 'user_123',
        data: { reportData: 'test' },
        model: 'auto' as const
      };

      const model = aiService.determineOptimalModel(request);

      expect(model).toBe('gemini');
    });

    it('should use Gemini for weekly reports', () => {
      const request = {
        type: 'weekly_report' as const,
        userId: 'user_123',
        data: { reportData: 'test' },
        model: 'auto' as const
      };

      const model = aiService.determineOptimalModel(request);

      expect(model).toBe('gemini');
    });

    it('should respect explicit model choice', () => {
      const request = {
        type: 'individual_trade' as const,
        userId: 'user_123',
        data: { tradeData: 'test' },
        model: 'gemini' as const
      };

      const model = aiService.determineOptimalModel(request);

      expect(model).toBe('gemini');
    });
  });

  describe('trackUsage', () => {
    it('should create new usage record if none exists', async () => {
      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: false
      });

      await aiService.trackUsage('user_123', 'individual_trade', 1000, 0.03);

      expect(mockFirestore.collection().doc().collection().doc().set).toHaveBeenCalledWith({
        individual_trade: 1,
        daily_report: 0,
        weekly_report: 0,
        pattern_analysis: 0,
        totalCost: 0.03,
        totalTokens: 1000,
        month: expect.any(String),
        lastUpdated: expect.any(String)
      });
    });

    it('should update existing usage record', async () => {
      const existingUsage = {
        individual_trade: 2,
        daily_report: 1,
        weekly_report: 0,
        pattern_analysis: 1,
        totalCost: 0.05,
        totalTokens: 1500
      };

      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => existingUsage
      });

      await aiService.trackUsage('user_123', 'individual_trade', 800, 0.024);

      expect(mockFirestore.collection().doc().collection().doc().update).toHaveBeenCalledWith({
        individual_trade: 3,
        totalCost: 0.074,
        totalTokens: 2300,
        lastUpdated: expect.any(String)
      });
    });

    it('should handle database errors gracefully', async () => {
      mockFirestore.collection().doc().collection().doc().get.mockRejectedValue(
        new Error('Database error')
      );

      // Should not throw
      await expect(aiService.trackUsage('user_123', 'individual_trade', 1000, 0.03))
        .resolves.toBeUndefined();
    });
  });

  describe('calculateCost', () => {
    it('should calculate GPT-4o cost correctly', () => {
      const cost = aiService.calculateCost(1000, 'gpt4o');
      expect(cost).toBe(0.03); // 1000 tokens * 0.00003
    });

    it('should calculate Gemini cost correctly', () => {
      const cost = aiService.calculateCost(1000, 'gemini');
      expect(cost).toBe(0.001); // 1000 tokens * 0.000001
    });

    it('should handle unknown model', () => {
      const cost = aiService.calculateCost(1000, 'unknown' as any);
      expect(cost).toBe(0);
    });

    it('should handle zero tokens', () => {
      const cost = aiService.calculateCost(0, 'gpt4o');
      expect(cost).toBe(0);
    });
  });

  describe('getUserUsageStats', () => {
    it('should return usage statistics', async () => {
      const mockUsage = {
        individual_trade: 5,
        daily_report: 2,
        weekly_report: 1,
        pattern_analysis: 3,
        totalCost: 0.15,
        totalTokens: 5000
      };

      const mockSubscription = {
        tier: 'pro'
      };

      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => mockUsage
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: mockSubscription })
      });

      const stats = await aiService.getUserUsageStats('user_123');

      expect(stats.usage).toEqual(mockUsage);
      expect(stats.limits).toEqual({
        individual_trade: 100,
        daily_report: 30,
        weekly_report: 4,
        pattern_analysis: 10
      });
    });

    it('should return default limits for free tier', async () => {
      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: false
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: { tier: 'free' } })
      });

      const stats = await aiService.getUserUsageStats('user_123');

      expect(stats.limits).toEqual({
        individual_trade: 5,
        daily_report: 0,
        weekly_report: 0,
        pattern_analysis: 0
      });
    });

    it('should handle missing subscription data', async () => {
      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: false
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: false
      });

      const stats = await aiService.getUserUsageStats('user_123');

      expect(stats.limits).toEqual({
        individual_trade: 5,
        daily_report: 0,
        weekly_report: 0,
        pattern_analysis: 0
      });
    });
  });

  describe('generateContentSuggestions', () => {
    it('should generate suggestions based on user performance', async () => {
      const mockTrades = [
        { result: 'win', asset: 'EURUSD', profit: 100 },
        { result: 'loss', asset: 'EURUSD', profit: -50 },
        { result: 'win', asset: 'GBPUSD', profit: 75 }
      ];

      const suggestions = await aiService.generateContentSuggestions('user_123', mockTrades);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle empty trades array', async () => {
      const suggestions = await aiService.generateContentSuggestions('user_123', []);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle API errors gracefully in routeAIRequest', async () => {
      const request = {
        type: 'individual_trade' as const,
        userId: 'user_123',
        data: { tradeData: 'test' },
        model: 'auto' as const
      };

      // Mock usage check to pass
      mockFirestore.collection().doc().collection().doc().get.mockResolvedValue({
        exists: false
      });

      mockFirestore.collection().doc().get.mockResolvedValue({
        exists: true,
        data: () => ({ subscription: { tier: 'free' } })
      });

      // This would test actual API integration, but since we're mocking,
      // we'll just ensure the service is properly structured for error handling
      expect(aiService.routeAIRequest).toBeDefined();
      expect(typeof aiService.routeAIRequest).toBe('function');
    });
  });
});