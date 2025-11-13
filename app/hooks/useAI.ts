import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { auth } from '../lib/firebase';
import { useErrorHandler } from './useErrorHandler';

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
    kpi?: any;
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
  const { user } = useAuth();
  const { handleError } = useErrorHandler();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = (endpoint: string) => {
    const isDev = process.env.NODE_ENV === 'development';
    const baseUrl = isDev 
      ? 'http://localhost:5004/api' 
      : 'https://us-central1-binary-hub.cloudfunctions.net/api';
    return `${baseUrl}${endpoint}`;
  };

  const getAuthHeaders = async () => {
    const idToken = await auth.currentUser?.getIdToken();
    return {
      'Authorization': `Bearer ${idToken || 'mock-token-for-testing'}`,
      'Content-Type': 'application/json',
    };
  };

  // Generate on-demand AI insight
  const generateInsight = useCallback(async (): Promise<AIInsight> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/insights/generate'), {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate insight');
      }
      
      const insight: AIInsight = await response.json();
      return insight;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

  // Generate comprehensive AI analysis
  const generateComprehensiveAnalysis = useCallback(async (): Promise<ComprehensiveInsight> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/insights/comprehensive'), {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate comprehensive analysis');
      }
      
      const analysis: ComprehensiveInsight = await response.json();
      return analysis;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

  // Get coaching session
  const getCoachingSession = useCallback(async (situation: string, triggerType?: string): Promise<CoachingSession> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/insights/coaching-session'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ situation, triggerType }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get coaching session');
      }
      
      const session: CoachingSession = await response.json();
      return session;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

  // Get strategic recommendations
  const getRecommendations = useCallback(async (): Promise<AIRecommendation[]> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/insights/recommendations'), {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get recommendations');
      }
      
      const data = await response.json();
      return data.recommendations || [];
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

  // Get insights history
  const getInsightsHistory = useCallback(async (options?: {
    type?: string;
    limit?: number;
    since?: Date;
  }): Promise<AIInsight[]> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams();
      
      if (options?.type) queryParams.append('type', options.type);
      if (options?.limit) queryParams.append('limit', options.limit.toString());
      if (options?.since) queryParams.append('since', options.since.toISOString());
      
      const response = await fetch(getApiUrl(`/insights/history?${queryParams.toString()}`), {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get insights history');
      }
      
      const data = await response.json();
      return data.insights || [];
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

  // Get coaching history
  const getCoachingHistory = useCallback(async (options?: {
    sessionType?: string;
    limit?: number;
    since?: Date;
  }): Promise<CoachingSession[]> => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams();
      
      if (options?.sessionType) queryParams.append('sessionType', options.sessionType);
      if (options?.limit) queryParams.append('limit', options.limit.toString());
      if (options?.since) queryParams.append('since', options.since.toISOString());
      
      const response = await fetch(getApiUrl(`/insights/coaching-history?${queryParams.toString()}`), {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get coaching history');
      }
      
      const data = await response.json();
      return data.sessions || [];
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

  // Check trade against rules
  const checkTradeRules = useCallback(async (trade: any) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(getApiUrl('/insights/check-rules'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ trade }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check trade rules');
      }
      
      const result = await response.json();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'An error occurred';
      setError(error);
      handleError(error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, handleError]);

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