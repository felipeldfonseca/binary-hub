# Binary Hub – Sprint 5-6 Implementation Guide

*AI Integration & Enhancement • Weeks 9-12 • January 2025*

---

## Overview

This guide details integrating AI capabilities into Binary Hub's existing infrastructure. We'll build upon your current trading journal and new social platform to add on-demand AI analysis, pattern recognition, and intelligent insights while implementing cost optimization through multi-model routing.

**Building Upon:**
- ✅ Your existing trading journal and analytics
- ✅ Social platform with posts and interactions (Sprint 3-4)
- ✅ Enhanced user profiles and authentication (Sprint 1-2)
- ✅ Current dashboard and component structure

**Sprint 5-6 Goals:**
- Implement multi-model AI service (GPT-4o + Gemini 2.5 Flash Light)
- Add on-demand individual trade analysis
- Create AI-powered daily/weekly report generation
- Build pattern recognition and insight system
- Integrate AI features with subscription tiers
- Add social sharing of AI insights

## Table of Contents

1. [Sprint 5: AI Infrastructure & Trade Analysis](#1-sprint-5-ai-infrastructure--trade-analysis)
2. [Sprint 6: Advanced AI Features & Social Integration](#2-sprint-6-advanced-ai-features--social-integration)
3. [Cost Optimization Strategy](#3-cost-optimization-strategy)
4. [Usage Tracking & Limits](#4-usage-tracking--limits)
5. [AI-Social Integration](#5-ai-social-integration)

---

## 1. Sprint 5: AI Infrastructure & Trade Analysis

### 1.1 AI Service Architecture

**Building on:** Your existing functions structure
**Adding:** Multi-model AI routing with cost optimization

```typescript
// functions/src/services/aiService.ts - NEW FILE
import { Configuration, OpenAIApi } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase-admin/firestore';

const db = getFirestore();

// Initialize AI clients
const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  })
);

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface AIAnalysisRequest {
  type: 'individual_trade' | 'daily_report' | 'weekly_report' | 'pattern_analysis';
  userId: string;
  data: any;
  model?: 'gpt4o' | 'gemini' | 'auto';
}

export interface AIAnalysisResponse {
  id: string;
  type: string;
  analysis: any;
  model: string;
  tokensUsed: number;
  cost: number;
  confidence: number;
  createdAt: string;
}

export class AIService {
  private readonly COST_PER_TOKEN = {
    gpt4o: 0.00003, // GPT-4o pricing
    gemini: 0.000001 // Gemini 2.5 Flash Light pricing
  };

  private readonly TOKEN_LIMITS = {
    gpt4o: 8000, // Max tokens for detailed analysis
    gemini: 32000 // Max tokens for bulk analysis
  };

  /**
   * Route AI request to optimal model based on complexity and cost
   */
  async routeAIRequest(request: AIAnalysisRequest): Promise<string> {
    const userId = request.userId;
    
    // Check user subscription and usage limits
    const canUseAI = await this.checkUsageLimits(userId, request.type);
    if (!canUseAI.allowed) {
      throw new Error(canUseAI.reason);
    }

    // Determine optimal model
    const modelChoice = await this.selectOptimalModel(request);
    
    // Route to appropriate service
    let response: AIAnalysisResponse;
    
    if (modelChoice === 'gpt4o') {
      response = await this.processWithGPT4o(request);
    } else {
      response = await this.processWithGemini(request);
    }

    // Track usage and cost
    await this.trackUsage(userId, response);

    return response.id;
  }

  /**
   * Select optimal model based on request type and content size
   */
  private async selectOptimalModel(request: AIAnalysisRequest): Promise<'gpt4o' | 'gemini'> {
    if (request.model && request.model !== 'auto') {
      return request.model;
    }

    // Use GPT-4o for individual trade analysis (higher quality)
    if (request.type === 'individual_trade') {
      return 'gpt4o';
    }

    // Use Gemini for bulk operations (cost effective)
    if (request.type === 'daily_report' || request.type === 'weekly_report') {
      return 'gemini';
    }

    // Default to Gemini for cost efficiency
    return 'gemini';
  }

  /**
   * Process individual trade analysis with GPT-4o
   */
  private async processWithGPT4o(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const trade = request.data;
    
    const prompt = this.buildTradeAnalysisPrompt(trade);
    
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert binary options trading analyst. Provide detailed, actionable insights based on trade data. Respond in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from GPT-4o');
      }

      const analysis = JSON.parse(content);
      const tokensUsed = response.data.usage?.total_tokens || 0;

      return {
        id: this.generateAnalysisId(),
        type: request.type,
        analysis,
        model: 'gpt4o',
        tokensUsed,
        cost: tokensUsed * this.COST_PER_TOKEN.gpt4o,
        confidence: analysis.confidence || 0.85,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('GPT-4o analysis error:', error);
      throw new Error('Failed to analyze trade with GPT-4o');
    }
  }

  /**
   * Process bulk analysis with Gemini 2.5 Flash Light
   */
  private async processWithGemini(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    let prompt: string;
    
    if (request.type === 'daily_report') {
      prompt = this.buildDailyReportPrompt(request.data);
    } else if (request.type === 'weekly_report') {
      prompt = this.buildWeeklyReportPrompt(request.data);
    } else {
      prompt = this.buildTradeAnalysisPrompt(request.data);
    }

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse JSON response
      const analysis = JSON.parse(text);
      
      // Estimate tokens (Gemini doesn't provide exact count)
      const estimatedTokens = Math.ceil(text.length / 4);

      return {
        id: this.generateAnalysisId(),
        type: request.type,
        analysis,
        model: 'gemini',
        tokensUsed: estimatedTokens,
        cost: estimatedTokens * this.COST_PER_TOKEN.gemini,
        confidence: analysis.confidence || 0.80,
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Gemini analysis error:', error);
      throw new Error('Failed to analyze with Gemini');
    }
  }

  /**
   * Build prompt for individual trade analysis
   */
  private buildTradeAnalysisPrompt(trade: any): string {
    return `
Analyze this binary options trade and provide insights in JSON format:

Trade Data:
- Asset: ${trade.asset}
- Direction: ${trade.direction}
- Amount: $${trade.amount}
- Entry Time: ${trade.entryTime}
- Result: ${trade.result || 'pending'}
- Strategy: ${trade.strategy || 'not specified'}
- Notes: ${trade.notes || 'none'}

Please provide analysis in this JSON format:
{
  "confidence": 0.85,
  "summary": "Brief summary of the trade",
  "strengths": ["What was done well"],
  "weaknesses": ["Areas for improvement"],
  "recommendations": ["Specific actionable advice"],
  "riskAssessment": {
    "level": "low|medium|high",
    "factors": ["Risk factors identified"]
  },
  "technicalAnalysis": {
    "entryTiming": "Assessment of entry timing",
    "assetChoice": "Analysis of asset selection",
    "positionSize": "Evaluation of position sizing"
  },
  "emotionalFactors": ["Emotional patterns observed"],
  "futureConsiderations": ["What to watch for next time"]
}
`;
  }

  /**
   * Build prompt for daily report generation
   */
  private buildDailyReportPrompt(data: any): string {
    const { trades, date, userId } = data;
    
    return `
Generate a comprehensive daily trading report for ${date}:

Trading Session Data:
- Total Trades: ${trades.length}
- Trades: ${JSON.stringify(trades, null, 2)}

Provide analysis in this JSON format:
{
  "confidence": 0.80,
  "date": "${date}",
  "summary": {
    "totalTrades": ${trades.length},
    "winningTrades": 0,
    "losingTrades": 0,
    "winRate": 0,
    "totalPnL": 0,
    "bestTrade": {},
    "worstTrade": {}
  },
  "patterns": {
    "timeOfDay": "When trades were most/least successful",
    "assets": "Which assets performed best/worst",
    "strategies": "Strategy performance breakdown"
  },
  "insights": [
    "Key insights from today's trading"
  ],
  "recommendations": [
    "Specific recommendations for improvement"
  ],
  "riskManagement": {
    "assessment": "How well risk was managed",
    "suggestions": ["Risk management improvements"]
  },
  "nextSteps": [
    "What to focus on tomorrow"
  ]
}
`;
  }

  /**
   * Build prompt for weekly report generation
   */
  private buildWeeklyReportPrompt(data: any): string {
    const { trades, weekStart, weekEnd, userId } = data;
    
    return `
Generate a comprehensive weekly trading report for ${weekStart} to ${weekEnd}:

Week's Trading Data:
- Total Trades: ${trades.length}
- Trades: ${JSON.stringify(trades, null, 2)}

Provide analysis in this JSON format:
{
  "confidence": 0.82,
  "period": {
    "start": "${weekStart}",
    "end": "${weekEnd}"
  },
  "summary": {
    "totalTrades": ${trades.length},
    "tradingDays": 0,
    "winRate": 0,
    "totalPnL": 0,
    "bestDay": {},
    "worstDay": {},
    "consistency": "Assessment of consistency"
  },
  "trends": {
    "performance": "Weekly performance trend",
    "emotional": "Emotional patterns observed",
    "technical": "Technical execution trends"
  },
  "strengths": ["What worked well this week"],
  "weaknesses": ["Areas that need attention"],
  "patterns": {
    "daily": "Daily performance patterns",
    "assets": "Asset-specific patterns",
    "strategies": "Strategy effectiveness"
  },
  "goals": {
    "achieved": ["Goals met this week"],
    "missed": ["Goals not achieved"],
    "nextWeek": ["Recommended goals for next week"]
  },
  "actionPlan": [
    "Specific actions to take next week"
  ]
}
`;
  }

  /**
   * Check if user can make AI request based on subscription and usage
   */
  private async checkUsageLimits(userId: string, analysisType: string): Promise<{allowed: boolean, reason?: string}> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return { allowed: false, reason: 'User not found' };
    }

    const userData = userDoc.data();
    const subscription = userData.subscription || { tier: 'free' };
    
    // Get current month's usage
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const usageDoc = await getDoc(doc(db, 'users', userId, 'usage', monthKey));
    const usage = usageDoc.exists() ? usageDoc.data() : {
      tradeAnalyses: 0,
      dailyReports: 0,
      weeklyReports: 0
    };

    // Define limits by subscription tier
    const limits = {
      free: {
        tradeAnalyses: 5,
        dailyReports: 2,
        weeklyReports: 1
      },
      pro: {
        tradeAnalyses: 50,
        dailyReports: 10,
        weeklyReports: 4
      },
      collaborative: {
        tradeAnalyses: 100,
        dailyReports: 20,
        weeklyReports: 8
      },
      ai_enhanced: {
        tradeAnalyses: -1, // unlimited
        dailyReports: -1,
        weeklyReports: -1
      }
    };

    const userLimits = limits[subscription.tier] || limits.free;
    const fieldMap = {
      individual_trade: 'tradeAnalyses',
      daily_report: 'dailyReports',
      weekly_report: 'weeklyReports'
    };

    const field = fieldMap[analysisType];
    if (!field) {
      return { allowed: false, reason: 'Invalid analysis type' };
    }

    const currentUsage = usage[field] || 0;
    const limit = userLimits[field];

    if (limit !== -1 && currentUsage >= limit) {
      return { 
        allowed: false, 
        reason: `Monthly limit reached for ${analysisType}. Upgrade subscription for more AI analyses.` 
      };
    }

    return { allowed: true };
  }

  /**
   * Track AI usage for billing and limits
   */
  private async trackUsage(userId: string, response: AIAnalysisResponse): Promise<void> {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const fieldMap = {
      individual_trade: 'tradeAnalyses',
      daily_report: 'dailyReports',
      weekly_report: 'weeklyReports'
    };

    const field = fieldMap[response.type];
    if (!field) return;

    const usageRef = doc(db, 'users', userId, 'usage', monthKey);
    
    try {
      await updateDoc(usageRef, {
        [field]: increment(1),
        totalCost: increment(response.cost),
        totalTokens: increment(response.tokensUsed),
        lastUsage: serverTimestamp()
      });
    } catch (error) {
      // Document doesn't exist, create it
      await setDoc(usageRef, {
        [field]: 1,
        totalCost: response.cost,
        totalTokens: response.tokensUsed,
        lastUsage: serverTimestamp(),
        createdAt: serverTimestamp()
      });
    }

    // Store analysis result
    await setDoc(doc(db, 'users', userId, 'aiAnalyses', response.id), {
      ...response,
      createdAt: serverTimestamp()
    });
  }

  private generateAnalysisId(): string {
    return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const aiService = new AIService();
```

### 1.2 AI API Routes Integration

**Building on:** Your existing API structure in `/functions/src/routes/`
**Adding:** AI analysis endpoints

```typescript
// functions/src/routes/ai.ts - NEW FILE
import { Router } from 'express';
import { auth } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { aiService } from '../services/aiService';
import { getFirestore, doc, getDoc, collection, query, where, orderBy, limit as firestoreLimit, getDocs } from 'firebase-admin/firestore';
import Joi from 'joi';

const router = Router();
const db = getFirestore();

// Analyze individual trade
const analyzeTradeSchema = Joi.object({
  tradeId: Joi.string().required(),
  analysisType: Joi.string().valid('full', 'quick', 'pattern_only').default('full'),
  forceRegenerate: Joi.boolean().default(false)
});

router.post('/analyze-trade', auth, validateRequest({ body: analyzeTradeSchema }), async (req, res) => {
  try {
    const { tradeId, analysisType, forceRegenerate } = req.body;
    const userId = req.user!.uid;

    // Get trade data from your existing trades collection
    const tradeDoc = await getDoc(doc(db, 'users', userId, 'trades', tradeId));
    if (!tradeDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TRADE_NOT_FOUND',
          message: 'Trade not found'
        }
      });
    }

    const tradeData = tradeDoc.data();

    // Check if analysis already exists and not forcing regeneration
    if (!forceRegenerate) {
      const existingAnalysisQuery = query(
        collection(db, 'users', userId, 'aiAnalyses'),
        where('type', '==', 'individual_trade'),
        where('data.tradeId', '==', tradeId),
        orderBy('createdAt', 'desc'),
        firestoreLimit(1)
      );
      
      const existingSnapshot = await getDocs(existingAnalysisQuery);
      if (!existingSnapshot.empty) {
        const existingAnalysis = existingSnapshot.docs[0].data();
        return res.json({
          success: true,
          data: {
            analysisId: existingSnapshot.docs[0].id,
            status: 'completed',
            analysis: existingAnalysis
          }
        });
      }
    }

    // Request AI analysis
    const analysisId = await aiService.routeAIRequest({
      type: 'individual_trade',
      userId,
      data: { ...tradeData, tradeId },
      model: 'auto'
    });

    res.json({
      success: true,
      data: {
        analysisId,
        status: 'completed'
      }
    });

  } catch (error: any) {
    console.error('Analyze trade error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'ANALYSIS_FAILED',
        message: error.message
      }
    });
  }
});

// Generate daily report
const dailyReportSchema = Joi.object({
  date: Joi.string().isoDate().default(() => new Date().toISOString().split('T')[0]),
  forceRegenerate: Joi.boolean().default(false)
});

router.post('/reports/daily', auth, validateRequest({ body: dailyReportSchema }), async (req, res) => {
  try {
    const { date, forceRegenerate } = req.body;
    const userId = req.user!.uid;

    // Get trades for the specific date
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const tradesQuery = query(
      collection(db, 'users', userId, 'trades'),
      where('entryTime', '>=', startDate.toISOString()),
      where('entryTime', '<', endDate.toISOString()),
      orderBy('entryTime', 'asc')
    );

    const tradesSnapshot = await getDocs(tradesQuery);
    const trades = tradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (trades.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_TRADES_FOUND',
          message: 'No trades found for the specified date'
        }
      });
    }

    // Check for existing report
    if (!forceRegenerate) {
      const existingReportQuery = query(
        collection(db, 'users', userId, 'aiAnalyses'),
        where('type', '==', 'daily_report'),
        where('data.date', '==', date),
        orderBy('createdAt', 'desc'),
        firestoreLimit(1)
      );
      
      const existingSnapshot = await getDocs(existingReportQuery);
      if (!existingSnapshot.empty) {
        const existingReport = existingSnapshot.docs[0].data();
        return res.json({
          success: true,
          data: {
            reportId: existingSnapshot.docs[0].id,
            status: 'completed',
            report: existingReport
          }
        });
      }
    }

    // Generate new report
    const analysisId = await aiService.routeAIRequest({
      type: 'daily_report',
      userId,
      data: { trades, date, userId },
      model: 'auto'
    });

    res.json({
      success: true,
      data: {
        reportId: analysisId,
        status: 'completed'
      }
    });

  } catch (error: any) {
    console.error('Generate daily report error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: error.message
      }
    });
  }
});

// Get AI analysis by ID
router.get('/analysis/:analysisId', auth, async (req, res) => {
  try {
    const { analysisId } = req.params;
    const userId = req.user!.uid;

    const analysisDoc = await getDoc(doc(db, 'users', userId, 'aiAnalyses', analysisId));
    if (!analysisDoc.exists()) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: 'Analysis not found'
        }
      });
    }

    res.json({
      success: true,
      data: analysisDoc.data()
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch analysis'
      }
    });
  }
});

// Get usage statistics
router.get('/usage', auth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const usageDoc = await getDoc(doc(db, 'users', userId, 'usage', monthKey));
    const usage = usageDoc.exists() ? usageDoc.data() : {
      tradeAnalyses: 0,
      dailyReports: 0,
      weeklyReports: 0,
      totalCost: 0,
      totalTokens: 0
    };

    // Get user subscription to determine limits
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.data();
    const subscription = userData?.subscription || { tier: 'free' };

    const limits = {
      free: { tradeAnalyses: 5, dailyReports: 2, weeklyReports: 1 },
      pro: { tradeAnalyses: 50, dailyReports: 10, weeklyReports: 4 },
      collaborative: { tradeAnalyses: 100, dailyReports: 20, weeklyReports: 8 },
      ai_enhanced: { tradeAnalyses: -1, dailyReports: -1, weeklyReports: -1 }
    };

    const userLimits = limits[subscription.tier] || limits.free;

    res.json({
      success: true,
      data: {
        usage,
        limits: userLimits,
        subscription: subscription.tier,
        resetDate: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
      }
    });

  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch usage statistics'
      }
    });
  }
});

export { router as aiRouter };
```

### 1.3 Frontend AI Integration

**Building on:** Your existing hooks and components
**Adding:** AI analysis UI components

```typescript
// app/hooks/useAI.ts - NEW HOOK
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/AuthContext';
import { aiApi } from '@/lib/api/ai';

export function useTradeAnalysis(tradeId: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ai', 'trade-analysis', tradeId],
    queryFn: () => aiApi.analyzeTradeById(tradeId),
    enabled: !!user && !!tradeId
  });
}

export function useAnalyzeTrade() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: aiApi.analyzeTrade,
    onSuccess: (data, variables) => {
      // Invalidate trade analysis cache
      queryClient.invalidateQueries(['ai', 'trade-analysis', variables.tradeId]);
      queryClient.invalidateQueries(['ai', 'usage']);
    }
  });
}

export function useGenerateDailyReport() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: aiApi.generateDailyReport,
    onSuccess: () => {
      queryClient.invalidateQueries(['ai', 'reports']);
      queryClient.invalidateQueries(['ai', 'usage']);
    }
  });
}

export function useAIUsage() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ai', 'usage'],
    queryFn: aiApi.getUsage,
    enabled: !!user
  });
}

export function useAIReports(type?: 'daily' | 'weekly') {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['ai', 'reports', type],
    queryFn: () => aiApi.getReports(type),
    enabled: !!user
  });
}
```

```typescript
// app/lib/api/ai.ts - NEW API CLIENT
import { getAuth } from 'firebase/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const aiApi = {
  async analyzeTrade(data: { tradeId: string; analysisType?: string; forceRegenerate?: boolean }) {
    const response = await fetch(`${API_BASE}/ai/analyze-trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to analyze trade');
    }

    return response.json();
  },

  async analyzeTradeById(tradeId: string) {
    // Check if analysis exists first
    try {
      const analysis = await this.getAnalysis(tradeId);
      return analysis;
    } catch (error) {
      // If no analysis exists, create one
      return this.analyzeTrade({ tradeId });
    }
  },

  async generateDailyReport(data: { date?: string; forceRegenerate?: boolean }) {
    const response = await fetch(`${API_BASE}/ai/reports/daily`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate daily report');
    }

    return response.json();
  },

  async generateWeeklyReport(data: { weekStart?: string; forceRegenerate?: boolean }) {
    const response = await fetch(`${API_BASE}/ai/reports/weekly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getIdToken()}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate weekly report');
    }

    return response.json();
  },

  async getAnalysis(analysisId: string) {
    const response = await fetch(`${API_BASE}/ai/analysis/${analysisId}`, {
      headers: {
        'Authorization': `Bearer ${await getIdToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch analysis');
    }

    return response.json();
  },

  async getUsage() {
    const response = await fetch(`${API_BASE}/ai/usage`, {
      headers: {
        'Authorization': `Bearer ${await getIdToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch usage');
    }

    return response.json();
  },

  async getReports(type?: string) {
    const params = type ? `?type=${type}` : '';
    const response = await fetch(`${API_BASE}/ai/reports${params}`, {
      headers: {
        'Authorization': `Bearer ${await getIdToken()}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch reports');
    }

    return response.json();
  }
};

async function getIdToken() {
  const auth = getAuth();
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  throw new Error('Not authenticated');
}
```

### 1.4 AI Analysis UI Components

**Building on:** Your existing trade components
**Adding:** AI analysis display and controls

```typescript
// app/components/ai/TradeAnalysisCard.tsx - NEW COMPONENT
'use client';

import React, { useState } from 'react';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  Lightbulb,
  Target,
  Shield,
  Heart,
  RefreshCw,
  Share2
} from 'lucide-react';
import { useAnalyzeTrade, useTradeAnalysis } from '@/hooks/useAI';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatPercentage } from '@/lib/utils';

interface TradeAnalysisCardProps {
  tradeId: string;
  trade: any; // Your existing Trade interface
  onShare?: (analysis: any) => void;
}

export function TradeAnalysisCard({ tradeId, trade, onShare }: TradeAnalysisCardProps) {
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  
  const { data: existingAnalysis, isLoading: isLoadingAnalysis } = useTradeAnalysis(tradeId);
  const analyzeTradeMutation = useAnalyzeTrade();

  const handleAnalyze = async () => {
    try {
      await analyzeTradeMutation.mutateAsync({
        tradeId,
        analysisType: 'full',
        forceRegenerate: false
      });
    } catch (error) {
      console.error('Failed to analyze trade:', error);
    }
  };

  const handleRegenerate = async () => {
    try {
      await analyzeTradeMutation.mutateAsync({
        tradeId,
        analysisType: 'full',
        forceRegenerate: true
      });
    } catch (error) {
      console.error('Failed to regenerate analysis:', error);
    }
  };

  const analysis = existingAnalysis?.data?.analysis;
  const isAnalyzing = analyzeTradeMutation.isLoading;
  const hasAnalysis = !!analysis;

  if (!hasAnalysis && !isLoadingAnalysis) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Brain className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">AI Trade Analysis</h3>
              <p className="text-sm text-gray-600">
                Get detailed insights and recommendations for this trade
              </p>
            </div>
          </div>
          
          <Button
            onClick={handleAnalyze}
            loading={isAnalyzing}
            disabled={isAnalyzing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Trade'}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoadingAnalysis || !analysis) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <Brain className="h-5 w-5 text-blue-600 animate-pulse" />
          <span className="text-gray-600">Loading AI analysis...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Brain className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">AI Trade Analysis</h3>
              <p className="text-blue-100 text-sm">
                Confidence: {formatPercentage(analysis.confidence * 100)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isAnalyzing}
              className="text-white border-white hover:bg-white hover:text-blue-600"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
            
            {onShare && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShare(analysis)}
                className="text-white border-white hover:bg-white hover:text-blue-600"
              >
                <Share2 className="h-4 w-4 mr-1" />
                Share
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 border-b border-gray-200">
        <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Quick Insights */}
      <div className="p-4 space-y-4">
        {/* Risk Assessment */}
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${
            analysis.riskAssessment?.level === 'low' ? 'bg-green-100' :
            analysis.riskAssessment?.level === 'medium' ? 'bg-yellow-100' :
            'bg-red-100'
          }`}>
            <Shield className={`h-4 w-4 ${
              analysis.riskAssessment?.level === 'low' ? 'text-green-600' :
              analysis.riskAssessment?.level === 'medium' ? 'text-yellow-600' :
              'text-red-600'
            }`} />
          </div>
          <div>
            <span className="font-medium text-gray-900">Risk Level: </span>
            <Badge variant={
              analysis.riskAssessment?.level === 'low' ? 'success' :
              analysis.riskAssessment?.level === 'medium' ? 'warning' :
              'destructive'
            }>
              {analysis.riskAssessment?.level?.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Top Recommendation */}
        {analysis.recommendations?.[0] && (
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Lightbulb className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <span className="font-medium text-gray-900">Key Recommendation: </span>
              <p className="text-gray-700">{analysis.recommendations[0]}</p>
            </div>
          </div>
        )}

        {/* View Full Analysis Button */}
        <button
          onClick={() => setShowFullAnalysis(!showFullAnalysis)}
          className="w-full text-center py-2 text-blue-600 hover:text-blue-700 font-medium"
        >
          {showFullAnalysis ? 'Hide Details' : 'View Full Analysis'}
        </button>
      </div>

      {/* Full Analysis */}
      {showFullAnalysis && (
        <div className="border-t border-gray-200 p-4 space-y-6">
          {/* Strengths */}
          {analysis.strengths?.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <h4 className="font-medium text-gray-900">Strengths</h4>
              </div>
              <ul className="space-y-1">
                {analysis.strengths.map((strength: string, index: number) => (
                  <li key={index} className="text-gray-700 text-sm flex items-start">
                    <span className="text-green-600 mr-2">•</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {analysis.weaknesses?.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-medium text-gray-900">Areas for Improvement</h4>
              </div>
              <ul className="space-y-1">
                {analysis.weaknesses.map((weakness: string, index: number) => (
                  <li key={index} className="text-gray-700 text-sm flex items-start">
                    <span className="text-yellow-600 mr-2">•</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Technical Analysis */}
          {analysis.technicalAnalysis && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Target className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium text-gray-900">Technical Analysis</h4>
              </div>
              <div className="space-y-2 text-sm">
                {analysis.technicalAnalysis.entryTiming && (
                  <div>
                    <span className="font-medium text-gray-900">Entry Timing: </span>
                    <span className="text-gray-700">{analysis.technicalAnalysis.entryTiming}</span>
                  </div>
                )}
                {analysis.technicalAnalysis.assetChoice && (
                  <div>
                    <span className="font-medium text-gray-900">Asset Selection: </span>
                    <span className="text-gray-700">{analysis.technicalAnalysis.assetChoice}</span>
                  </div>
                )}
                {analysis.technicalAnalysis.positionSize && (
                  <div>
                    <span className="font-medium text-gray-900">Position Sizing: </span>
                    <span className="text-gray-700">{analysis.technicalAnalysis.positionSize}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Emotional Factors */}
          {analysis.emotionalFactors?.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Heart className="h-5 w-5 text-pink-600" />
                <h4 className="font-medium text-gray-900">Emotional Insights</h4>
              </div>
              <ul className="space-y-1">
                {analysis.emotionalFactors.map((factor: string, index: number) => (
                  <li key={index} className="text-gray-700 text-sm flex items-start">
                    <span className="text-pink-600 mr-2">•</span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* All Recommendations */}
          {analysis.recommendations?.length > 1 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Lightbulb className="h-5 w-5 text-purple-600" />
                <h4 className="font-medium text-gray-900">All Recommendations</h4>
              </div>
              <ul className="space-y-1">
                {analysis.recommendations.map((recommendation: string, index: number) => (
                  <li key={index} className="text-gray-700 text-sm flex items-start">
                    <span className="text-purple-600 mr-2">•</span>
                    {recommendation}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Future Considerations */}
          {analysis.futureConsiderations?.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                <h4 className="font-medium text-gray-900">Future Considerations</h4>
              </div>
              <ul className="space-y-1">
                {analysis.futureConsiderations.map((consideration: string, index: number) => (
                  <li key={index} className="text-gray-700 text-sm flex items-start">
                    <span className="text-indigo-600 mr-2">•</span>
                    {consideration}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

This completes Sprint 5 core implementation. Should I continue with Sprint 6 (Advanced AI Features & Social Integration) or move to the final Sprint 7-8 guide?