// Lean rebuild shim - no Firebase API calls for AI features
import { useState, useCallback } from 'react';

export interface AIInsight {
  id: string;
  type: 'on_demand' | 'weekly' | 'coaching' | 'comprehensive';
  title: string;
  content: string;
  action?: string;
  quote?: string;
  timestamp: string;
  metadata: {
    totalTrades?: number;
    winRate?: number;
    avgStake?: number;
    lossStreak?: number;
    aiGenerated: boolean;
    kpi?: unknown;
    situation?: string;
  };
}

export interface AIRecommendation {
  id: string;
  category: 'risk_management' | 'strategy' | 'psychology' | 'performance';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  confidence: number;
  impact: string;
  timeframe: string;
  timestamp: string;
}

export interface ComprehensiveInsight {
  summary: {
    overallPerformance: string;
    keyStrengths: string[];
    improvementAreas: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
  detailedAnalysis: {
    winRateAnalysis: string;
    riskManagementAnalysis: string;
    emotionalTradingAnalysis: string;
    assetDiversificationAnalysis: string;
  };
  recommendations: AIRecommendation[];
  predictions: {
    nextWeekPerformance: {
      prediction: number;
      confidence: number;
      reasoning: string;
    };
    riskAdjustments: string[];
  };
  metadata: {
    analysisDate: string;
    dataPoints: number;
    modelVersion: string;
  };
}

export interface CoachingSession {
  id: string;
  type: 'motivational' | 'strategic' | 'corrective' | 'educational';
  title: string;
  content: string;
  actionItems: string[];
  followUpDate?: string;
  timestamp: string;
  metadata: {
    situation: string;
    triggerType: string;
    aiGenerated: boolean;
  };
}

export function useAI() {
  const [loading] = useState(false);
  const [error] = useState<string | null>(null);

  const generateInsight = useCallback(async (): Promise<AIInsight> => {
    console.warn('useAI: AI features not available in lean rebuild');
    throw new Error('AI features not available in lean rebuild');
  }, []);

  const generateComprehensiveAnalysis = useCallback(async (): Promise<ComprehensiveInsight> => {
    console.warn('useAI: AI features not available in lean rebuild');
    throw new Error('AI features not available in lean rebuild');
  }, []);

  const getCoachingSession = useCallback(
    async (_situation: string, _triggerType?: string): Promise<CoachingSession> => {
      console.warn('useAI: AI features not available in lean rebuild');
      throw new Error('AI features not available in lean rebuild');
    },
    []
  );

  const getRecommendations = useCallback(async (): Promise<AIRecommendation[]> => {
    console.warn('useAI: AI features not available in lean rebuild');
    return [];
  }, []);

  const getInsightsHistory = useCallback(
    async (_options?: { type?: string; limit?: number; since?: Date }): Promise<AIInsight[]> => {
      console.warn('useAI: AI features not available in lean rebuild');
      return [];
    },
    []
  );

  const getCoachingHistory = useCallback(
    async (_options?: {
      sessionType?: string;
      limit?: number;
      since?: Date;
    }): Promise<CoachingSession[]> => {
      console.warn('useAI: AI features not available in lean rebuild');
      return [];
    },
    []
  );

  const checkTradeRules = useCallback(async (_trade: unknown) => {
    console.warn('useAI: AI features not available in lean rebuild');
    return { passed: true, violations: [] };
  }, []);

  return {
    loading,
    error,
    generateInsight,
    generateComprehensiveAnalysis,
    getCoachingSession,
    getRecommendations,
    getInsightsHistory,
    getCoachingHistory,
    checkTradeRules,
  };
}
