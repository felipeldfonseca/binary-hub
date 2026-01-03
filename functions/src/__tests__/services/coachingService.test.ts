import { coachingService } from '../../services/coachingService';
import { tradeService } from '../../services/tradeService';
import * as openaiService from '../../services/openai';
import { aiInsightsService } from '../../services/aiInsightsService';

// Mock dependencies
jest.mock('../../services/tradeService');
jest.mock('../../services/openai');
jest.mock('../../services/aiInsightsService');
// Note: firebase-admin/firestore is mocked globally in setup.ts

const mockTradeService = tradeService as jest.Mocked<typeof tradeService>;
const mockOpenaiService = openaiService as jest.Mocked<typeof openaiService>;
const mockAiInsightsService = aiInsightsService as jest.Mocked<typeof aiInsightsService>;

describe('CoachingService', () => {
  const mockUserId = 'test-user-123';
  const mockUserProfile = {
    firstName: 'John',
    email: 'john@example.com',
    plan: 'pro' as const,
  };

  const mockTrades = [
    {
      id: '1',
      userId: mockUserId,
      result: 'win' as const,
      profit: 85,
      amount: 100,
      entryTime: new Date('2024-01-01T10:00:00Z'),
    },
    {
      id: '2',
      userId: mockUserId,
      result: 'loss' as const,
      profit: -100,
      amount: 100,
      entryTime: new Date('2024-01-01T11:00:00Z'),
    },
    {
      id: '3',
      userId: mockUserId,
      result: 'loss' as const,
      profit: -100,
      amount: 150, // Increased stake after loss
      entryTime: new Date('2024-01-01T12:00:00Z'),
    },
    {
      id: '4',
      userId: mockUserId,
      result: 'loss' as const,
      profit: -150,
      amount: 200, // Further increased stake
      entryTime: new Date('2024-01-01T13:00:00Z'),
    },
  ];

  const mockFirestore = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => mockUserProfile,
        }),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn().mockResolvedValue({}),
          })),
          add: jest.fn().mockResolvedValue({ id: 'coaching-session-123' }),
        })),
      })),
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Firestore
    jest.doMock('firebase-admin/firestore', () => ({
      getFirestore: () => mockFirestore,
    }));

    // Mock trade service
    mockTradeService.getUserTrades.mockResolvedValue(mockTrades as any);

    // Mock OpenAI service
    mockOpenaiService.generateTradeCoach.mockResolvedValue({
      message: 'Stay disciplined and focused on your trading plan. Remember that losses are part of the learning process.',
      quote: '"The market is a device for transferring money from the impatient to the patient." - Warren Buffett',
    });

    // Mock AI insights service
    mockAiInsightsService.getInsights.mockResolvedValue([]);
  });

  describe('providePersonalizedCoaching', () => {
    it('should provide coaching for user request trigger', async () => {
      const result = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'I am struggling with consecutive losses',
        'user_request'
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(mockUserId);
      expect(result.trigger).toBe('user_request');
      expect(result.message).toContain('disciplined');
      expect(result.quote).toContain('Warren Buffett');
      expect(result.actionPlan).toBeInstanceOf(Array);
      expect(result.followUpActions).toBeInstanceOf(Array);
      expect(result.metadata.aiGenerated).toBe(true);
    });

    it('should detect loss streak and provide appropriate urgency', async () => {
      // Mock trades with current loss streak
      const lossStreakTrades = [
        { ...mockTrades[0], result: 'loss' as const },
        { ...mockTrades[1], result: 'loss' as const },
        { ...mockTrades[2], result: 'loss' as const },
        { ...mockTrades[3], result: 'loss' as const },
      ];

      mockTradeService.getUserTrades.mockResolvedValue(lossStreakTrades as any);

      const result = await coachingService.providePersonalizedCoaching(
        mockUserId,
        undefined,
        'loss_streak'
      );

      expect(result.sessionType).toBe('psychological');
      expect(result.urgency).toBe('high');
      expect(result.actionPlan[0]).toContain('PARE');
    });

    it('should determine session type correctly based on trigger', async () => {
      const emotionalResult = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Feeling overwhelmed',
        'emotional_state'
      );

      expect(emotionalResult.sessionType).toBe('psychological');

      const performanceResult = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Low win rate',
        'low_performance'
      );

      expect(performanceResult.sessionType).toBe('technical');
    });

    it('should assess urgency based on trading state', async () => {
      // Mock extreme risk scenario
      const extremeRiskTrades = Array.from({ length: 10 }, (_, i) => ({
        ...mockTrades[0],
        id: `extreme-${i}`,
        result: 'loss' as const,
        profit: -100,
      }));

      mockTradeService.getUserTrades.mockResolvedValue(extremeRiskTrades as any);

      const result = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Multiple consecutive losses',
        'loss_streak'
      );

      expect(result.urgency).toBe('critical');
    });

    it('should generate appropriate action plan for different session types', async () => {
      const motivationalResult = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Celebrating a milestone',
        'milestone'
      );

      expect(motivationalResult.sessionType).toBe('motivational');
      expect(motivationalResult.actionPlan).toContain('Celebre suas conquistas recentes');

      const technicalResult = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Need to improve strategy',
        'low_performance'
      );

      expect(technicalResult.sessionType).toBe('technical');
      expect(technicalResult.actionPlan).toContain('Revise estratégia de entrada');
    });

    it('should handle OpenAI service errors gracefully', async () => {
      mockOpenaiService.generateTradeCoach.mockRejectedValue(new Error('OpenAI API error'));

      const result = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Test situation',
        'user_request'
      );

      expect(result).toBeDefined();
      expect(result.message).toContain('disciplina');
      expect(result.quote).toContain('Jim Rohn');
    });
  });

  describe('monitorAndCoach', () => {
    it('should identify coaching triggers and provide coaching', async () => {
      // Mock trades that would trigger coaching (loss streak)
      const triggerTrades = [
        { ...mockTrades[0], result: 'loss' as const },
        { ...mockTrades[1], result: 'loss' as const },
        { ...mockTrades[2], result: 'loss' as const },
        { ...mockTrades[3], result: 'win' as const },
      ];

      mockTradeService.getUserTrades.mockResolvedValue(triggerTrades as any);

      const result = await coachingService.monitorAndCoach(mockUserId);

      expect(result).toBeDefined();
      expect(result!.trigger).toBe('loss_streak');
    });

    it('should return null when no coaching trigger is identified', async () => {
      // Mock trades with good performance
      const goodTrades = mockTrades.map(trade => ({
        ...trade,
        result: 'win' as const,
        profit: 85,
      }));

      mockTradeService.getUserTrades.mockResolvedValue(goodTrades as any);

      const result = await coachingService.monitorAndCoach(mockUserId);

      expect(result).toBeNull();
    });

    it('should return null for insufficient trade data', async () => {
      mockTradeService.getUserTrades.mockResolvedValue([mockTrades[0]] as any);

      const result = await coachingService.monitorAndCoach(mockUserId);

      expect(result).toBeNull();
    });

    it('should detect revenge trading patterns', async () => {
      // First trade loss, second trade with doubled stake
      const revengeTrades = [
        { ...mockTrades[0], result: 'loss' as const, amount: 100 },
        { ...mockTrades[1], result: 'loss' as const, amount: 200 }, // Doubled stake
        { ...mockTrades[2], result: 'win' as const, amount: 100 },
      ];

      mockTradeService.getUserTrades.mockResolvedValue(revengeTrades as any);

      const result = await coachingService.monitorAndCoach(mockUserId);

      expect(result).toBeDefined();
      expect(result!.trigger).toBe('emotional_state');
    });
  });

  describe('celebrateMilestone', () => {
    it('should create celebratory coaching session', async () => {
      const milestone = {
        type: 'win_streak' as const,
        value: 10,
        message: '10 consecutive wins achieved!',
        reward: 'Congratulations bonus',
      };

      const result = await coachingService.celebrateMilestone(mockUserId, milestone);

      expect(result).toBeDefined();
      expect(result.trigger).toBe('milestone');
      expect(result.sessionType).toBe('motivational');
      expect(result.situation).toContain('Parabéns');
      expect(result.situation).toContain(milestone.message);
    });
  });

  describe('provideCrisisIntervention', () => {
    it('should provide crisis intervention for major losses', async () => {
      const result = await coachingService.provideCrisisIntervention(
        mockUserId,
        'major_losses'
      );

      expect(result).toBeDefined();
      expect(result.trigger).toBe('emotional_state');
      expect(result.sessionType).toBe('psychological');
      expect(result.situation).toContain('perdas significativas');
    });

    it('should provide crisis intervention for emotional breakdown', async () => {
      const result = await coachingService.provideCrisisIntervention(
        mockUserId,
        'emotional_breakdown'
      );

      expect(result.situation).toContain('sobrecarregado emocionalmente');
    });

    it('should provide crisis intervention for revenge trading', async () => {
      const result = await coachingService.provideCrisisIntervention(
        mockUserId,
        'revenge_trading'
      );

      expect(result.situation).toContain('revenge trading');
    });
  });

  describe('generateStrategicRecommendations', () => {
    it('should generate recommendations based on trading performance', async () => {
      const recommendations = await coachingService.generateStrategicRecommendations(mockUserId);

      expect(recommendations).toBeInstanceOf(Array);
      
      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation).toHaveProperty('category');
        expect(recommendation).toHaveProperty('priority');
        expect(recommendation).toHaveProperty('title');
        expect(recommendation).toHaveProperty('description');
        expect(recommendation).toHaveProperty('actionSteps');
        expect(recommendation).toHaveProperty('expectedOutcome');
        expect(recommendation).toHaveProperty('timeframe');
        
        expect(['mindset', 'strategy', 'risk_management', 'discipline', 'education'])
          .toContain(recommendation.category);
        expect(recommendation.priority).toBeGreaterThanOrEqual(1);
        expect(recommendation.priority).toBeLessThanOrEqual(10);
        expect(recommendation.actionSteps).toBeInstanceOf(Array);
      }
    });

    it('should prioritize recommendations correctly', async () => {
      // Mock low win rate scenario
      const lowWinTrades = mockTrades.map(trade => ({
        ...trade,
        result: 'loss' as const,
        profit: -100,
      }));

      mockTradeService.getUserTrades.mockResolvedValue(lowWinTrades as any);

      const recommendations = await coachingService.generateStrategicRecommendations(mockUserId);

      expect(recommendations.length).toBeGreaterThan(0);
      
      // Should have high priority mindset recommendation
      const mindsetRec = recommendations.find(r => r.category === 'mindset');
      if (mindsetRec) {
        expect(mindsetRec.priority).toBeGreaterThanOrEqual(8);
      }
    });

    it('should detect high stake variability', async () => {
      const variableStakeTrades = [
        { ...mockTrades[0], amount: 50 },
        { ...mockTrades[1], amount: 200 },
        { ...mockTrades[2], amount: 100 },
        { ...mockTrades[3], amount: 300 },
      ];

      mockTradeService.getUserTrades.mockResolvedValue(variableStakeTrades as any);

      const recommendations = await coachingService.generateStrategicRecommendations(mockUserId);

      const riskMgmtRec = recommendations.find(r => r.category === 'risk_management');
      expect(riskMgmtRec).toBeDefined();
      expect(riskMgmtRec?.title).toContain('Padronizar Gestão de Risco');
    });

    it('should return empty array for insufficient data', async () => {
      mockTradeService.getUserTrades.mockResolvedValue([]);

      const recommendations = await coachingService.generateStrategicRecommendations(mockUserId);

      expect(recommendations).toEqual([]);
    });
  });

  describe('getCoachingHistory', () => {
    it('should retrieve coaching history with filters', async () => {
      const mockCoachingData = [
        {
          id: 'session1',
          userId: mockUserId,
          sessionType: 'motivational',
          timestamp: '2024-01-01T10:00:00Z',
        },
      ];

      const mockGet = jest.fn().mockResolvedValue({
        docs: mockCoachingData.map(data => ({
          data: () => data,
        })),
      });

      const mockLimit = jest.fn().mockReturnValue({ get: mockGet });
      const mockOrderBy = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCollection = jest.fn().mockReturnValue({ 
        where: mockWhere,
        orderBy: mockOrderBy,
      });

      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({ collection: mockCollection }),
      });

      const history = await coachingService.getCoachingHistory(mockUserId, {
        sessionType: 'motivational',
        limit: 10,
      });

      expect(mockWhere).toHaveBeenCalledWith('sessionType', '==', 'motivational');
      expect(history).toBeInstanceOf(Array);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing user profile gracefully', async () => {
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({
            exists: false,
            data: () => null,
          }),
          collection: jest.fn(() => ({
            doc: jest.fn(() => ({
              set: jest.fn().mockResolvedValue({}),
            })),
          })),
        }),
      });

      const result = await coachingService.providePersonalizedCoaching(
        mockUserId,
        'Test situation',
        'user_request'
      );

      expect(result).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should handle Firestore errors', async () => {
      mockFirestore.collection.mockReturnValue({
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockRejectedValue(new Error('Firestore error')),
        }),
      });

      await expect(
        coachingService.providePersonalizedCoaching(mockUserId, 'Test', 'user_request')
      ).rejects.toThrow();
    });

    it('should calculate stake variability correctly', async () => {
      // Test with consistent stakes (should be low variability)
      const consistentTrades = mockTrades.map(trade => ({
        ...trade,
        amount: 100, // Same amount for all
      }));

      mockTradeService.getUserTrades.mockResolvedValue(consistentTrades as any);

      const recommendations = await coachingService.generateStrategicRecommendations(mockUserId);
      
      // Should not have risk management recommendation for consistent stakes
      const riskMgmtRec = recommendations.find(r => r.category === 'risk_management');
      expect(riskMgmtRec?.title).not.toContain('Padronizar Gestão de Risco');
    });

    it('should handle recent loss streaks correctly', async () => {
      const recentLosses = [
        { ...mockTrades[0], result: 'loss' as const },
        { ...mockTrades[1], result: 'loss' as const },
        { ...mockTrades[2], result: 'loss' as const },
        { ...mockTrades[3], result: 'loss' as const },
        { ...mockTrades[0], result: 'loss' as const, id: '5' },
        { ...mockTrades[0], result: 'loss' as const, id: '6' },
        { ...mockTrades[0], result: 'loss' as const, id: '7' },
      ];

      mockTradeService.getUserTrades.mockResolvedValue(recentLosses as any);

      const recommendations = await coachingService.generateStrategicRecommendations(mockUserId);
      
      expect(recommendations.length).toBeGreaterThan(0);
      
      const strategyRec = recommendations.find(r => r.category === 'strategy');
      expect(strategyRec).toBeDefined();
      expect(strategyRec?.priority).toBe(10);
    });
  });
});