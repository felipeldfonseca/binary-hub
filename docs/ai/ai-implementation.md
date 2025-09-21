# Binary Hub – AI Implementation Specification

*Version 1.0 • Social Trading Platform • January 2025*

---

## Overview

This document provides comprehensive implementation details for Binary Hub's AI analysis features, including individual trade analysis, daily/weekly reports, pattern recognition, and multi-model AI strategy using Gemini 2.5 Flash Light for bulk analysis and GPT-4o for individual trades.

## Table of Contents

1. [AI Architecture & Strategy](#1-ai-architecture--strategy)
2. [Multi-Model Implementation](#2-multi-model-implementation)
3. [Individual Trade Analysis](#3-individual-trade-analysis)
4. [On-Demand Reports](#4-on-demand-reports)
5. [Pattern Recognition Engine](#5-pattern-recognition-engine)
6. [AI Usage Management](#6-ai-usage-management)
7. [Prompt Engineering](#7-prompt-engineering)
8. [Performance & Cost Optimization](#8-performance--cost-optimization)
9. [Quality Control & Feedback](#9-quality-control--feedback)
10. [Testing & Monitoring](#10-testing--monitoring)

---

## 1. AI Architecture & Strategy

### 1.1 Multi-Model Strategy

```typescript
// AI Model Configuration
export interface AIModelConfig {
  provider: 'openai' | 'google';
  model: string;
  costPerToken: {
    input: number;
    output: number;
  };
  limits: {
    maxTokens: number;
    rateLimit: number;
    requestsPerMinute: number;
  };
  capabilities: string[];
}

export const AI_MODELS: Record<string, AIModelConfig> = {
  'gemini-2.5-flash-light': {
    provider: 'google',
    model: 'gemini-2.5-flash-light',
    costPerToken: {
      input: 0.000002,  // $0.002 per 1K tokens
      output: 0.000008  // $0.008 per 1K tokens
    },
    limits: {
      maxTokens: 8192,
      rateLimit: 1000,
      requestsPerMinute: 300
    },
    capabilities: ['batch_analysis', 'pattern_recognition', 'report_generation']
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    costPerToken: {
      input: 0.000005,  // $0.005 per 1K tokens
      output: 0.000015  // $0.015 per 1K tokens
    },
    limits: {
      maxTokens: 128000,
      rateLimit: 500,
      requestsPerMinute: 100
    },
    capabilities: ['detailed_analysis', 'complex_reasoning', 'educational_content']
  }
};

// AI Service Routing
export class AIServiceRouter {
  selectModel(analysisType: AIAnalysisType, dataSize: number): string {
    switch (analysisType) {
      case 'individual_trade':
        return 'gpt-4o'; // Detailed analysis for single trades
      
      case 'daily_report':
      case 'weekly_report':
        return dataSize > 50 ? 'gemini-2.5-flash-light' : 'gpt-4o';
      
      case 'pattern_recognition':
      case 'batch_analysis':
        return 'gemini-2.5-flash-light'; // Cost-effective for bulk operations
      
      case 'educational_content':
        return 'gpt-4o'; // Better for detailed explanations
      
      default:
        return 'gemini-2.5-flash-light'; // Default to cost-effective model
    }
  }
}
```

### 1.2 Subscription-based Usage Limits

```typescript
// Subscription-based Usage Limits
export const AI_USAGE_LIMITS: Record<SubscriptionTier, AIUsageLimits> = {
  free: {
    individualTrades: {
      monthly: 5,
      daily: 2
    },
    weeklyReports: {
      monthly: 4,
      daily: 1
    },
    dailyReports: {
      monthly: 0, // No daily reports for free tier
      daily: 0
    },
    costLimit: 2.00 // $2 per month
  },
  pro: {
    individualTrades: {
      monthly: 100,
      daily: 10
    },
    weeklyReports: {
      monthly: 30,
      daily: 1
    },
    dailyReports: {
      monthly: 30,
      daily: 1
    },
    costLimit: 20.00 // $20 per month
  },
  collaborative: {
    individualTrades: {
      monthly: 300,
      daily: 20
    },
    weeklyReports: {
      monthly: 30,
      daily: 1
    },
    dailyReports: {
      monthly: 30,
      daily: 1
    },
    costLimit: 50.00 // $50 per month
  },
  ai_enhanced: {
    individualTrades: {
      monthly: 1000,
      daily: 50
    },
    weeklyReports: {
      monthly: 30,
      daily: 1
    },
    dailyReports: {
      monthly: 30,
      daily: 1
    },
    costLimit: 100.00 // $100 per month
  }
};
```

---

## 2. Multi-Model Implementation

### 2.1 Gemini 2.5 Flash Light Integration

```typescript
// Gemini Service Implementation
export class GeminiAIService {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    this.model = this.client.getGenerativeModel({ 
      model: 'gemini-2.5-flash-light',
      generationConfig: {
        temperature: 0.3,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 2048
      }
    });
  }
  
  async analyzeDailyTrades(userId: string, trades: Trade[], date: string): Promise<DailyAnalysisResult> {
    const prompt = this.buildDailyAnalysisPrompt(trades, date);
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      return this.parseDailyAnalysisResponse(response, trades);
    } catch (error) {
      throw new AIAnalysisError('Failed to generate daily analysis', error);
    }
  }
  
  async generateWeeklyReport(userId: string, weeklyData: WeeklyTradingData): Promise<WeeklyReportResult> {
    const prompt = this.buildWeeklyReportPrompt(weeklyData);
    
    const result = await this.model.generateContent(prompt);
    const response = result.response.text();
    
    return this.parseWeeklyReportResponse(response, weeklyData);
  }
}
```

### 2.2 GPT-4o Integration

```typescript
// OpenAI Service Implementation
export class OpenAIService {
  private client: OpenAI;
  
  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async analyzeIndividualTrade(trade: Trade, userContext: UserTradingContext): Promise<IndividualTradeAnalysis> {
    const prompt = this.buildIndividualTradePrompt(trade, userContext);
    
    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt('individual_trade_analysis')
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });
      
      const response = completion.choices[0].message.content;
      return this.parseIndividualTradeResponse(response, trade);
    } catch (error) {
      throw new AIAnalysisError('Failed to analyze individual trade', error);
    }
  }
}
```

---

## 3. Individual Trade Analysis

### 3.1 Trade Analysis Engine

```typescript
// Individual Trade Analysis Service
export class TradeAnalysisService {
  private openaiService: OpenAIService;
  private usageTracker: AIUsageTracker;
  
  async analyzeIndividualTrade(
    userId: string,
    tradeId: string,
    analysisOptions: TradeAnalysisOptions = {}
  ): Promise<TradeAnalysisResult> {
    // Check usage limits
    await this.checkUsageLimits(userId, 'individual_trade');
    
    // Get trade data and user context
    const [trade, userContext] = await Promise.all([
      this.getTradeData(tradeId),
      this.getUserTradingContext(userId)
    ]);
    
    if (!trade || trade.authorId !== userId) {
      throw new Error('Trade not found or access denied');
    }
    
    const startTime = Date.now();
    
    try {
      // Generate analysis using GPT-4o
      const analysis = await this.openaiService.analyzeIndividualTrade(trade, userContext);
      
      // Save analysis result
      const analysisRecord = await this.saveAnalysisResult(userId, tradeId, analysis);
      
      // Track usage
      await this.usageTracker.trackUsage(userId, 'individual_trade', 'gpt-4o', {
        tokensUsed: analysis.tokensUsed,
        processingTime: Date.now() - startTime,
        success: true
      });
      
      return {
        analysisId: analysisRecord.id,
        analysis,
        status: 'completed',
        processingTime: Date.now() - startTime
      };
      
    } catch (error) {
      await this.usageTracker.trackUsage(userId, 'individual_trade', 'gpt-4o', {
        tokensUsed: { input: 0, output: 0 },
        processingTime: Date.now() - startTime,
        success: false
      });
      
      throw error;
    }
  }
}
```

---

## 4. On-Demand Reports

### 4.1 User-Requested Report Generation

```typescript
// On-Demand Report Generation Service
export class OnDemandReportService {
  private geminiService: GeminiAIService;
  private openaiService: OpenAIService;
  private usageTracker: AIUsageTracker;
  
  constructor() {
    this.geminiService = new GeminiAIService();
    this.openaiService = new OpenAIService();
    this.usageTracker = new AIUsageTracker();
  }
  
  async generateDailyReport(userId: string, date: Date): Promise<DailyReportResult> {
    // Check subscription and usage limits
    const subscription = await this.getUserSubscription(userId);
    if (!this.canGenerateDailyReport(subscription)) {
      throw new Error('Daily reports not available in current subscription');
    }
    
    await this.checkUsageLimits(userId, 'daily_report');
    
    // Get trades for the specified date
    const trades = await this.getTradesForDate(userId, date);
    
    if (trades.length === 0) {
      return this.generateNoTradingDayReport(userId, date);
    }
    
    // Choose model based on data size - use Gemini for cost efficiency
    const model = trades.length > 20 ? 'gemini-2.5-flash-light' : 'gpt-4o';
    
    const startTime = Date.now();
    
    try {
      let report: DailyReport;
      
      if (model === 'gemini-2.5-flash-light') {
        report = await this.geminiService.analyzeDailyTrades(userId, trades, date.toISOString());
      } else {
        report = await this.openaiService.generateDetailedDailyReport(userId, trades, date);
      }
      
      // Save report
      const reportRecord = await this.saveDailyReport(userId, date, report, model);
      
      // Track usage
      await this.usageTracker.trackUsage(userId, 'daily_report', model, {
        tokensUsed: report.tokensUsed,
        processingTime: Date.now() - startTime,
        success: true
      });
      
      return {
        reportId: reportRecord.id,
        report,
        generatedAt: new Date(),
        model
      };
      
    } catch (error) {
      await this.usageTracker.trackUsage(userId, 'daily_report', model, {
        tokensUsed: { input: 0, output: 0 },
        processingTime: Date.now() - startTime,
        success: false
      });
      
      throw error;
    }
  }
  
  async generateWeeklyReport(userId: string, weekStart: Date): Promise<WeeklyReportResult> {
    const subscription = await this.getUserSubscription(userId);
    if (!this.canGenerateWeeklyReport(subscription)) {
      throw new Error('Weekly reports not available in current subscription');
    }
    
    await this.checkUsageLimits(userId, 'weekly_report');
    
    // Get week's trading data
    const weeklyData = await this.getWeeklyTradingData(userId, weekStart);
    
    if (weeklyData.totalTrades === 0) {
      return this.generateNoTradingWeekReport(userId, weekStart);
    }
    
    const startTime = Date.now();
    
    try {
      // Use Gemini for weekly reports (more cost-effective for larger datasets)
      const report = await this.geminiService.generateWeeklyReport(userId, weeklyData);
      
      // Save report
      const reportRecord = await this.saveWeeklyReport(userId, weekStart, report, 'gemini-2.5-flash-light');
      
      // Track usage
      await this.usageTracker.trackUsage(userId, 'weekly_report', 'gemini-2.5-flash-light', {
        tokensUsed: report.tokensUsed,
        processingTime: Date.now() - startTime,
        success: true
      });
      
      return {
        reportId: reportRecord.id,
        report,
        generatedAt: new Date(),
        model: 'gemini-2.5-flash-light'
      };
      
    } catch (error) {
      await this.usageTracker.trackUsage(userId, 'weekly_report', 'gemini-2.5-flash-light', {
        tokensUsed: { input: 0, output: 0 },
        processingTime: Date.now() - startTime,
        success: false
      });
      
      throw error;
    }
  }
  
  private canGenerateDailyReport(subscription: SubscriptionTier): boolean {
    return ['pro', 'collaborative', 'ai_enhanced'].includes(subscription);
  }
  
  private canGenerateWeeklyReport(subscription: SubscriptionTier): boolean {
    return ['free', 'pro', 'collaborative', 'ai_enhanced'].includes(subscription);
  }
}

// Frontend Report Request Components
export const DailyReportWidget: React.FC<{ date: Date }> = ({ date }) => {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const { data: report, mutate: generateReport } = useDailyReport(date);
  const { data: usageStats } = useAIUsageStats();
  const { data: trades } = useTradesForDate(date);
  
  const canGenerateReport = (): boolean => {
    if (!usageStats || !user) return false;
    
    const limits = AI_USAGE_LIMITS[user.subscription];
    const hasAccess = limits.dailyReports.monthly > 0;
    const withinLimits = usageStats.dailyReports.used < limits.dailyReports.monthly;
    const withinDailyLimit = usageStats.dailyReports.usedToday < limits.dailyReports.daily;
    
    return hasAccess && withinLimits && withinDailyLimit;
  };
  
  const handleGenerateReport = async () => {
    if (!canGenerateReport() || !trades || trades.length === 0) return;
    
    setGenerating(true);
    
    try {
      await generateReport();
      toast.success('Daily report generated successfully!');
    } catch (error) {
      toast.error('Failed to generate daily report');
    } finally {
      setGenerating(false);
    }
  };
  
  if (!trades || trades.length === 0) {
    return (
      <Card className="daily-report-widget">
        <CardContent className="text-center py-8">
          <CalendarIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No trades recorded for {format(date, 'MMM dd, yyyy')}</p>
          <p className="text-sm text-gray-500 mt-2">Trade during the day to generate your AI report</p>
        </CardContent>
      </Card>
    );
  }
  
  if (report) {
    return <DailyReportDisplay report={report} />;
  }
  
  return (
    <Card className="daily-report-widget">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Daily Trading Report</h3>
            <p className="text-gray-600">{format(date, 'MMM dd, yyyy')}</p>
          </div>
          <AIUsageBadge 
            used={usageStats?.dailyReports.used || 0}
            limit={AI_USAGE_LIMITS[user.subscription].dailyReports.monthly}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="text-center py-6">
          <BrainIcon className="w-12 h-12 mx-auto text-blue-500 mb-4" />
          <p className="text-gray-700 mb-2">
            Get AI insights about your {trades.length} trades today
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Analyze performance, patterns, and get personalized recommendations
          </p>
          
          {!canGenerateReport() ? (
            <div className="text-center">
              {AI_USAGE_LIMITS[user.subscription].dailyReports.monthly === 0 ? (
                <div>
                  <p className="text-gray-600 mb-2">Daily reports available in Pro tier</p>
                  <Button onClick={() => router.push('/pricing')}>
                    Upgrade to Pro
                  </Button>
                </div>
              ) : (
                <p className="text-red-600">Daily report limit reached</p>
              )}
            </div>
          ) : (
            <Button 
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Generating Report...
                </>
              ) : (
                <>
                  <ChartBarIcon className="w-4 h-4 mr-2" />
                  Generate Daily Report
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const WeeklyReportWidget: React.FC<{ weekStart: Date }> = ({ weekStart }) => {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const { data: report, mutate: generateReport } = useWeeklyReport(weekStart);
  const { data: usageStats } = useAIUsageStats();
  const { data: weeklyTrades } = useWeeklyTrades(weekStart);
  
  const canGenerateReport = (): boolean => {
    if (!usageStats || !user) return false;
    
    const limits = AI_USAGE_LIMITS[user.subscription];
    const withinLimits = usageStats.weeklyReports.used < limits.weeklyReports.monthly;
    const withinDailyLimit = usageStats.weeklyReports.usedToday < limits.weeklyReports.daily;
    
    return withinLimits && withinDailyLimit;
  };
  
  const handleGenerateReport = async () => {
    if (!canGenerateReport() || !weeklyTrades || weeklyTrades.length === 0) return;
    
    setGenerating(true);
    
    try {
      await generateReport();
      toast.success('Weekly report generated successfully!');
    } catch (error) {
      toast.error('Failed to generate weekly report');
    } finally {
      setGenerating(false);
    }
  };
  
  const weekEnd = addDays(weekStart, 6);
  
  if (!weeklyTrades || weeklyTrades.length === 0) {
    return (
      <Card className="weekly-report-widget">
        <CardContent className="text-center py-8">
          <CalendarIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">
            No trades for the week of {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
          </p>
          <p className="text-sm text-gray-500 mt-2">Complete some trades to generate your weekly analysis</p>
        </CardContent>
      </Card>
    );
  }
  
  if (report) {
    return <WeeklyReportDisplay report={report} />;
  }
  
  return (
    <Card className="weekly-report-widget">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Weekly Trading Report</h3>
            <p className="text-gray-600">
              {format(weekStart, 'MMM dd')} - {format(weekEnd, 'MMM dd, yyyy')}
            </p>
          </div>
          <AIUsageBadge 
            used={usageStats?.weeklyReports.used || 0}
            limit={AI_USAGE_LIMITS[user.subscription].weeklyReports.monthly}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="text-center py-6">
          <TrendingUpIcon className="w-12 h-12 mx-auto text-green-500 mb-4" />
          <p className="text-gray-700 mb-2">
            Analyze your {weeklyTrades.length} trades this week
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Get comprehensive weekly insights, patterns, and strategic recommendations
          </p>
          
          {!canGenerateReport() ? (
            <p className="text-red-600">Weekly report limit reached</p>
          ) : (
            <Button 
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Generating Report...
                </>
              ) : (
                <>
                  <DocumentReportIcon className="w-4 h-4 mr-2" />
                  Generate Weekly Report
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

---

## 5. Pattern Recognition Engine

### 5.1 Pattern Detection System

```typescript
// Pattern Recognition Service
export class PatternRecognitionService {
  private geminiService: GeminiAIService;
  private patterns: Map<string, DetectedPattern> = new Map();
  
  async analyzeUserPatterns(userId: string): Promise<PatternAnalysisResult> {
    // Get comprehensive trading history
    const tradingHistory = await this.getUserTradingHistory(userId, 90); // Last 90 days
    
    if (tradingHistory.length < 10) {
      return this.generateMinimalPatternsResult(userId, tradingHistory.length);
    }
    
    // Detect patterns using Gemini (cost-effective for bulk analysis)
    const detectedPatterns = await this.geminiService.recognizePatterns(userId, tradingHistory);
    
    // Cache patterns for future use
    await this.cacheUserPatterns(userId, detectedPatterns);
    
    return {
      userId,
      analysisDate: new Date(),
      totalTrades: tradingHistory.length,
      patterns: detectedPatterns,
      recommendations: this.generatePatternRecommendations(detectedPatterns),
      confidence: this.calculateOverallConfidence(detectedPatterns)
    };
  }
  
  private generatePatternRecommendations(patterns: DetectedPattern[]): PatternRecommendation[] {
    const recommendations: PatternRecommendation[] = [];
    
    // Time-based pattern recommendations
    const timePatterns = patterns.filter(p => p.category === 'time');
    timePatterns.forEach(pattern => {
      if (pattern.impact === 'negative' && pattern.confidence > 0.7) {
        recommendations.push({
          type: 'avoidance',
          title: 'Avoid Trading During Low-Performance Hours',
          description: `Your analysis shows poor performance during ${pattern.description}. Consider avoiding trades during these times.`,
          priority: 'high',
          relatedPattern: pattern.id
        });
      }
    });
    
    // Asset-based pattern recommendations
    const assetPatterns = patterns.filter(p => p.category === 'asset');
    assetPatterns.forEach(pattern => {
      if (pattern.impact === 'positive' && pattern.confidence > 0.8) {
        recommendations.push({
          type: 'focus',
          title: 'Focus on High-Performing Assets',
          description: `You show strong performance with ${pattern.description}. Consider increasing focus on these assets.`,
          priority: 'medium',
          relatedPattern: pattern.id
        });
      }
    });
    
    // Emotional pattern recommendations
    const emotionalPatterns = patterns.filter(p => p.category === 'emotional');
    emotionalPatterns.forEach(pattern => {
      if (pattern.impact === 'negative') {
        recommendations.push({
          type: 'emotional_control',
          title: 'Improve Emotional Trading Control',
          description: `Pattern detected: ${pattern.description}. Consider implementing cooling-off periods or position size limits.`,
          priority: 'high',
          relatedPattern: pattern.id
        });
      }
    });
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }
}

// Pattern Display Components
export const PatternAnalysisPanel: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: patterns, loading, refetch } = usePatternAnalysis(userId);
  const [selectedCategory, setSelectedCategory] = useState<PatternCategory | 'all'>('all');
  
  const filteredPatterns = useMemo(() => {
    if (!patterns || selectedCategory === 'all') return patterns?.patterns || [];
    return patterns.patterns.filter(p => p.category === selectedCategory);
  }, [patterns, selectedCategory]);
  
  if (loading) {
    return <PatternAnalysisSkeleton />;
  }
  
  if (!patterns) {
    return (
      <Card className="pattern-analysis-panel">
        <CardContent className="text-center py-8">
          <SearchIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            Pattern analysis requires at least 10 trades
          </p>
          <Button onClick={() => refetch()}>
            Analyze Patterns
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="pattern-analysis-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Trading Patterns</h3>
            <p className="text-gray-600">
              AI-detected patterns from {patterns.totalTrades} trades
            </p>
          </div>
          <PatternConfidenceIndicator confidence={patterns.confidence} />
        </div>
      </CardHeader>
      
      <CardContent>
        <PatternCategoryTabs
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          patterns={patterns.patterns}
        />
        
        <div className="mt-6 space-y-4">
          {filteredPatterns.map(pattern => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </div>
        
        {patterns.recommendations.length > 0 && (
          <div className="mt-8">
            <h4 className="text-md font-semibold mb-4">Recommendations</h4>
            <div className="space-y-3">
              {patterns.recommendations.map(rec => (
                <RecommendationCard key={rec.relatedPattern} recommendation={rec} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const PatternCard: React.FC<{ pattern: DetectedPattern }> = ({ pattern }) => {
  const impactColors = {
    positive: 'text-green-600 bg-green-50 border-green-200',
    negative: 'text-red-600 bg-red-50 border-red-200',
    neutral: 'text-gray-600 bg-gray-50 border-gray-200'
  };
  
  const categoryIcons = {
    time: ClockIcon,
    asset: CurrencyDollarIcon,
    emotional: HeartIcon,
    strategy: ChartBarIcon,
    risk: ShieldIcon
  };
  
  const Icon = categoryIcons[pattern.category] || ChartBarIcon;
  
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      impactColors[pattern.impact]
    )}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium">{pattern.name}</h5>
            <ConfidenceBadge confidence={pattern.confidence} />
          </div>
          <p className="text-sm">{pattern.description}</p>
          
          {pattern.examples && pattern.examples.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium mb-1">Examples:</p>
              <ul className="text-xs space-y-1">
                {pattern.examples.slice(0, 3).map((example, index) => (
                  <li key={index} className="opacity-75">• {example}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

---

## 6. AI Usage Management

### 6.1 Usage Tracking & Limits

```typescript
// Usage Management Service
export class AIUsageManager {
  async checkUsageLimits(userId: string, analysisType: AIAnalysisType): Promise<void> {
    const [subscription, currentUsage] = await Promise.all([
      this.getUserSubscription(userId),
      this.getCurrentUsage(userId)
    ]);
    
    const limits = AI_USAGE_LIMITS[subscription];
    const typeKey = this.getUsageTypeKey(analysisType);
    
    // Check monthly limit
    if (currentUsage[typeKey].monthly >= limits[typeKey].monthly) {
      throw new UsageLimitError(
        `Monthly limit reached for ${analysisType}`,
        'monthly_limit',
        limits[typeKey].monthly
      );
    }
    
    // Check daily limit
    if (currentUsage[typeKey].daily >= limits[typeKey].daily) {
      throw new UsageLimitError(
        `Daily limit reached for ${analysisType}`,
        'daily_limit',
        limits[typeKey].daily
      );
    }
    
    // Check cost limit
    if (currentUsage.totalCost >= limits.costLimit) {
      throw new UsageLimitError(
        'Monthly cost limit reached',
        'cost_limit',
        limits.costLimit
      );
    }
  }
  
  async trackUsage(
    userId: string,
    analysisType: AIAnalysisType,
    model: string,
    metrics: UsageMetrics
  ): Promise<void> {
    const usage: AIUsageRecord = {
      userId,
      analysisType,
      model,
      timestamp: new Date(),
      tokensUsed: metrics.tokensUsed,
      cost: this.calculateCost(model, metrics.tokensUsed),
      processingTime: metrics.processingTime,
      success: metrics.success,
      billingPeriod: this.getCurrentBillingPeriod(userId)
    };
    
    // Save detailed usage record
    await db.collection('ai_usage').add(usage);
    
    // Update aggregated usage statistics
    await this.updateUsageAggregates(userId, usage);
    
    // Check if user is approaching limits
    await this.checkAndNotifyLimits(userId, analysisType);
  }
  
  private async updateUsageAggregates(userId: string, usage: AIUsageRecord): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const month = format(new Date(), 'yyyy-MM');
    
    const updates = {
      [`usage.${usage.analysisType}.monthly`]: admin.firestore.FieldValue.increment(1),
      [`usage.${usage.analysisType}.daily.${today}`]: admin.firestore.FieldValue.increment(1),
      [`costs.monthly.${month}`]: admin.firestore.FieldValue.increment(usage.cost),
      [`costs.daily.${today}`]: admin.firestore.FieldValue.increment(usage.cost),
      lastUpdated: new Date()
    };
    
    await db.collection('user_ai_usage').doc(userId).update(updates);
  }
  
  async getUserUsageStats(userId: string): Promise<UserAIUsage> {
    const doc = await db.collection('user_ai_usage').doc(userId).get();
    
    if (!doc.exists) {
      return this.initializeUserUsage(userId);
    }
    
    const data = doc.data();
    const today = format(new Date(), 'yyyy-MM-dd');
    
    return {
      individualTrades: {
        monthly: data.usage?.individualTrades?.monthly || 0,
        daily: data.usage?.individualTrades?.daily?.[today] || 0
      },
      dailyReports: {
        monthly: data.usage?.dailyReports?.monthly || 0,
        daily: data.usage?.dailyReports?.daily?.[today] || 0
      },
      weeklyReports: {
        monthly: data.usage?.weeklyReports?.monthly || 0,
        daily: data.usage?.weeklyReports?.daily?.[today] || 0
      },
      totalCost: data.costs?.monthly?.[format(new Date(), 'yyyy-MM')] || 0,
      lastUpdated: data.lastUpdated?.toDate() || new Date()
    };
  }
}

// Usage Display Components
export const AIUsageDashboard: React.FC = () => {
  const { user } = useAuth();
  const { data: usageStats } = useAIUsageStats();
  const { data: usageHistory } = useAIUsageHistory();
  
  if (!usageStats) {
    return <UsageDashboardSkeleton />;
  }
  
  const limits = AI_USAGE_LIMITS[user.subscription];
  
  return (
    <div className="ai-usage-dashboard">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <UsageCard
          title="Individual Trade Analysis"
          used={usageStats.individualTrades.monthly}
          limit={limits.individualTrades.monthly}
          dailyUsed={usageStats.individualTrades.daily}
          dailyLimit={limits.individualTrades.daily}
          icon={<SearchIcon />}
        />
        
        <UsageCard
          title="Daily Reports"
          used={usageStats.dailyReports.monthly}
          limit={limits.dailyReports.monthly}
          dailyUsed={usageStats.dailyReports.daily}
          dailyLimit={limits.dailyReports.daily}
          icon={<DocumentReportIcon />}
        />
        
        <UsageCard
          title="Weekly Reports"
          used={usageStats.weeklyReports.monthly}
          limit={limits.weeklyReports.monthly}
          dailyUsed={usageStats.weeklyReports.daily}
          dailyLimit={limits.weeklyReports.daily}
          icon={<ChartBarIcon />}
        />
      </div>
      
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Cost Usage</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-600">Monthly Cost</span>
            <span className="text-2xl font-bold">
              ${usageStats.totalCost.toFixed(2)} / ${limits.costLimit.toFixed(2)}
            </span>
          </div>
          <Progress 
            value={(usageStats.totalCost / limits.costLimit) * 100} 
            className="w-full"
          />
          
          {usageStats.totalCost / limits.costLimit > 0.8 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangleIcon className="w-4 h-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  You're approaching your monthly cost limit
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {usageHistory && (
        <Card className="mt-6">
          <CardHeader>
            <h3 className="text-lg font-semibold">Usage History</h3>
          </CardHeader>
          <CardContent>
            <UsageHistoryChart data={usageHistory} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const UsageCard: React.FC<{
  title: string;
  used: number;
  limit: number;
  dailyUsed: number;
  dailyLimit: number;
  icon: React.ReactNode;
}> = ({ title, used, limit, dailyUsed, dailyLimit, icon }) => {
  const monthlyPercentage = limit > 0 ? (used / limit) * 100 : 0;
  const dailyPercentage = dailyLimit > 0 ? (dailyUsed / dailyLimit) * 100 : 0;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="font-medium">{title}</h4>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Monthly</span>
              <span>{used} / {limit}</span>
            </div>
            <Progress value={monthlyPercentage} className="h-2" />
          </div>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Today</span>
              <span>{dailyUsed} / {dailyLimit}</span>
            </div>
            <Progress value={dailyPercentage} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

## 7. Prompt Engineering

### 7.1 System Prompts

```typescript
// Prompt Templates
export class PromptTemplates {
  static getSystemPrompt(analysisType: AIAnalysisType): string {
    const basePrompt = `
You are an expert binary options trading analyst and educator with deep knowledge of:
- Technical analysis and market patterns
- Risk management principles
- Trading psychology and behavioral finance
- Educational content delivery

CORE PRINCIPLES:
- Provide educational insights only, never financial advice
- Focus on skill development and learning opportunities
- Be specific and actionable in recommendations
- Acknowledge both strengths and areas for improvement
- Use clear, accessible language
- Always emphasize risk management
- Never guarantee profits or outcomes
- Maintain a supportive, educational tone

IMPORTANT DISCLAIMERS:
- All analysis is for educational purposes only
- Past performance does not guarantee future results
- Trading involves substantial risk of loss
- Users should never risk more than they can afford to lose
`;

    switch (analysisType) {
      case 'individual_trade':
        return basePrompt + `
INDIVIDUAL TRADE ANALYSIS FOCUS:
- Evaluate trade execution quality and timing
- Assess risk/reward ratio and position sizing
- Identify decision-making patterns
- Highlight learning opportunities
- Provide specific improvement suggestions
- Consider user's experience level and trading context
- Format response as structured JSON with clear categories
`;

      case 'daily_report':
        return basePrompt + `
DAILY REPORT ANALYSIS FOCUS:
- Summarize daily trading performance objectively
- Identify patterns in trade timing, asset selection, and outcomes
- Analyze emotional trading indicators (revenge trading, overconfidence)
- Evaluate risk management adherence
- Provide next-day preparation recommendations
- Include both positive reinforcement and improvement areas
- Structure insights by importance and actionability
`;

      case 'weekly_report':
        return basePrompt + `
WEEKLY REPORT ANALYSIS FOCUS:
- Provide comprehensive weekly performance overview
- Analyze trends and patterns across multiple trading sessions
- Compare performance to previous weeks and user goals
- Identify strategic insights and longer-term patterns
- Recommend strategic adjustments for the following week
- Include progress tracking and milestone recognition
- Balance detailed analysis with actionable takeaways
`;

      case 'pattern_recognition':
        return basePrompt + `
PATTERN RECOGNITION FOCUS:
- Identify recurring patterns in trading behavior and outcomes
- Analyze time-based, asset-based, and emotional patterns
- Quantify pattern strength and reliability
- Distinguish between positive and negative patterns
- Provide pattern-specific recommendations
- Consider statistical significance and confidence levels
- Focus on actionable pattern insights
`;

      default:
        return basePrompt;
    }
  }

  static buildIndividualTradePrompt(trade: Trade, context: UserTradingContext): string {
    return `
Analyze this binary options trade in detail:

TRADE DETAILS:
- Asset: ${trade.asset}
- Direction: ${trade.direction}
- Amount: $${trade.amount}
- Strike Price: ${trade.strikePrice}
- Entry Time: ${trade.entryTime}
- Expiration: ${trade.expirationTime}
- Result: ${trade.result}
- Payout: $${trade.payout || 0}
- Strategy: ${trade.strategy || 'Not specified'}
- Notes: ${trade.notes || 'None provided'}

TRADER CONTEXT:
- Experience Level: ${context.tradingExperience}
- Total Trades: ${context.totalTrades}
- Overall Win Rate: ${context.winRate.toFixed(1)}%
- Recent Performance: ${context.recentPerformance}
- Risk Profile: ${context.riskProfile}
- Strength Areas: ${context.strengthAreas.join(', ') || 'None identified'}
- Improvement Areas: ${context.improvementAreas.join(', ') || 'None specified'}

ANALYSIS REQUIREMENTS:
Provide a comprehensive analysis in JSON format with these sections:

{
  "executionQuality": {
    "score": 0-100,
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1", "weakness2"],
    "summary": "Overall execution assessment"
  },
  "timingAnalysis": {
    "entryTiming": "excellent|good|fair|poor",
    "marketConditions": "Description of market context",
    "timingScore": 0-100,
    "recommendations": ["timing improvement suggestions"]
  },
  "riskAssessment": {
    "positionSizing": "appropriate|too_large|too_small",
    "riskRewardRatio": "calculated ratio or assessment",
    "riskScore": 0-100,
    "improvements": ["risk management suggestions"]
  },
  "strategicInsights": {
    "strategyAlignment": "how well trade fits stated strategy",
    "decisionLogic": "assessment of trade reasoning",
    "improvements": ["strategic suggestions"]
  },
  "learningOpportunities": {
    "keyLessons": ["lesson1", "lesson2", "lesson3"],
    "skillDevelopment": ["areas to focus on"],
    "practiceAreas": ["specific skills to practice"]
  },
  "overallScore": 0-100,
  "summary": "2-3 sentence overall assessment",
  "nextSteps": ["3 specific actionable recommendations"]
}

Focus on education and skill development. Be constructive and specific.
`;
  }

  static buildDailyAnalysisPrompt(trades: Trade[], date: string): string {
    const tradesData = trades.map(trade => ({
      asset: trade.asset,
      direction: trade.direction,
      amount: trade.amount,
      result: trade.result,
      payout: trade.payout,
      entryTime: trade.entryTime,
      strategy: trade.strategy,
      notes: trade.notes
    }));

    return `
Analyze this day's binary options trading session:

DATE: ${date}
TOTAL TRADES: ${trades.length}

TRADES DATA:
${JSON.stringify(tradesData, null, 2)}

Provide a comprehensive daily analysis in JSON format:

{
  "summary": {
    "totalTrades": ${trades.length},
    "winRate": "calculated percentage",
    "netPnL": "calculated profit/loss",
    "bestPerformingAsset": "asset with best performance",
    "worstPerformingAsset": "asset with worst performance",
    "tradingHours": "hours span of trading activity",
    "overallAssessment": "excellent|good|moderate|needs_improvement"
  },
  "patterns": [
    {
      "type": "timing|asset|emotional|strategy|risk",
      "description": "detailed pattern description",
      "confidence": 0.0-1.0,
      "impact": "positive|negative|neutral",
      "examples": ["specific examples from today's trades"]
    }
  ],
  "insights": [
    {
      "category": "performance|risk|emotional|strategy",
      "title": "insight title",
      "message": "detailed insight description",
      "priority": "high|medium|low",
      "actionable": true/false
    }
  ],
  "emotionalIndicators": {
    "revengeTrading": "detected|not_detected",
    "overconfidence": "detected|not_detected",
    "impulsiveDecisions": "detected|not_detected",
    "analysis": "emotional state assessment"
  },
  "riskManagement": {
    "positionSizing": "consistent|inconsistent",
    "riskLevels": "appropriate|too_high|too_low",
    "riskScore": 0-100,
    "improvements": ["risk management suggestions"]
  },
  "recommendations": [
    {
      "category": "strategy|risk|timing|emotional",
      "action": "specific action to take",
      "reasoning": "why this recommendation is important",
      "priority": "high|medium|low",
      "timeframe": "immediate|short_term|long_term"
    }
  ],
  "tomorrowPreparation": [
    "specific preparation step 1",
    "specific preparation step 2",
    "specific preparation step 3"
  ]
}

Important: Focus on educational value and avoid any language that could be construed as financial advice.
`;
  }

  static buildWeeklyReportPrompt(weeklyData: WeeklyTradingData): string {
    return `
Generate a comprehensive weekly trading report:

WEEK PERIOD: ${weeklyData.weekStart.toISOString()} to ${weeklyData.weekEnd.toISOString()}

WEEKLY STATISTICS:
- Total Trades: ${weeklyData.totalTrades}
- Win Rate: ${(weeklyData.winRate * 100).toFixed(1)}%
- Net P&L: $${weeklyData.totalPnL.toFixed(2)}
- Trading Days: ${weeklyData.tradingDays}

ASSET BREAKDOWN:
${JSON.stringify(weeklyData.assetBreakdown, null, 2)}

TIME OF DAY BREAKDOWN:
${JSON.stringify(weeklyData.timeOfDayBreakdown, null, 2)}

STRATEGY PERFORMANCE:
${JSON.stringify(weeklyData.strategyPerformance, null, 2)}

Provide comprehensive weekly analysis in JSON format:

{
  "weeklyOverview": {
    "performanceGrade": "A|B|C|D|F",
    "keyHighlights": ["highlight1", "highlight2", "highlight3"],
    "improvementAreas": ["area1", "area2", "area3"],
    "weeklyTrend": "improving|stable|declining"
  },
  "performanceAnalysis": {
    "consistency": {
      "score": 0-100,
      "dailyVariation": "low|moderate|high",
      "analysis": "consistency assessment"
    },
    "efficiency": {
      "tradesPerDay": "average number",
      "timeUtilization": "assessment of trading time usage",
      "recommendations": ["efficiency improvements"]
    }
  },
  "strategicInsights": [
    {
      "insight": "strategic observation",
      "evidence": "supporting data",
      "recommendation": "strategic recommendation",
      "impact": "high|medium|low"
    }
  ],
  "goalProgress": {
    "goalsAssessment": "progress toward stated goals",
    "achievedMilestones": ["milestone1", "milestone2"],
    "upcomingTargets": ["target1", "target2"]
  },
  "nextWeekPlan": {
    "focusAreas": ["area1", "area2", "area3"],
    "strategicAdjustments": ["adjustment1", "adjustment2"],
    "skillDevelopment": ["skill to practice"],
    "riskManagement": ["risk guidelines for next week"]
  },
  "motivationalMessage": "Encouraging and educational closing message"
}

Emphasize learning, progress, and strategic development.
`;
  }
}
```

---

## 8. Performance & Cost Optimization

### 8.1 Cost Optimization Strategies

```typescript
// Cost Optimization Service
export class CostOptimizationService {
  // Batch similar requests to reduce API calls
  async batchAnalyzeRequests(requests: AnalysisRequest[]): Promise<AnalysisResult[]> {
    // Group requests by model and type
    const batches = this.groupRequestsForBatching(requests);
    const results: AnalysisResult[] = [];
    
    for (const batch of batches) {
      if (batch.model === 'gemini-2.5-flash-light') {
        // Gemini can handle multiple requests in one call
        const batchResult = await this.geminiService.batchAnalyze(batch.requests);
        results.push(...batchResult);
      } else {
        // GPT-4o requires individual calls but with delay management
        const batchResults = await this.openaiService.sequentialAnalyze(batch.requests);
        results.push(...batchResults);
      }
    }
    
    return results;
  }
  
  // Intelligent prompt optimization
  optimizePromptLength(originalPrompt: string, maxTokens: number): string {
    // Analyze prompt sections by importance
    const sections = this.parsePromptSections(originalPrompt);
    
    // Prioritize sections by importance
    const prioritized = sections.sort((a, b) => b.importance - a.importance);
    
    let optimizedPrompt = '';
    let currentTokens = 0;
    
    for (const section of prioritized) {
      const sectionTokens = this.estimateTokens(section.content);
      
      if (currentTokens + sectionTokens <= maxTokens) {
        optimizedPrompt += section.content + '\n';
        currentTokens += sectionTokens;
      } else {
        // Truncate or summarize less important sections
        const remainingTokens = maxTokens - currentTokens;
        if (remainingTokens > 50 && section.canSummarize) {
          const summarized = this.summarizeSection(section.content, remainingTokens);
          optimizedPrompt += summarized + '\n';
        }
        break;
      }
    }
    
    return optimizedPrompt.trim();
  }
  
  // Smart caching strategy
  async getCachedAnalysisOrGenerate(
    cacheKey: string,
    generator: () => Promise<any>,
    ttl: number = 3600
  ): Promise<any> {
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    // Generate new analysis
    const result = await generator();
    
    // Cache result
    await this.cache.set(cacheKey, result, ttl);
    
    return result;
  }
  
  // Dynamic model selection based on complexity and cost
  selectOptimalModel(analysisRequest: AnalysisRequest): string {
    const complexity = this.assessComplexity(analysisRequest);
    const userTier = analysisRequest.userTier;
    const budgetRemaining = analysisRequest.budgetRemaining;
    
    // For simple requests or budget constraints, use Gemini
    if (complexity < 0.5 || budgetRemaining < 0.5) {
      return 'gemini-2.5-flash-light';
    }
    
    // For complex analysis and premium users with budget, use GPT-4o
    if (complexity > 0.7 && ['pro', 'ai_enhanced'].includes(userTier) && budgetRemaining > 0.8) {
      return 'gpt-4o';
    }
    
    // Default to cost-effective option
    return 'gemini-2.5-flash-light';
  }
  
  private assessComplexity(request: AnalysisRequest): number {
    let complexity = 0;
    
    // Data size factor
    if (request.dataSize > 100) complexity += 0.3;
    if (request.dataSize > 500) complexity += 0.2;
    
    // Analysis type factor
    switch (request.type) {
      case 'individual_trade':
        complexity += 0.6; // Detailed analysis
        break;
      case 'pattern_recognition':
        complexity += 0.4; // Moderate complexity
        break;
      case 'daily_report':
      case 'weekly_report':
        complexity += 0.3; // Can be handled efficiently
        break;
    }
    
    // User context factor
    if (request.userContext?.experience === 'beginner') {
      complexity += 0.2; // Need more educational content
    }
    
    return Math.min(complexity, 1.0);
  }
}

// Performance Monitoring
export class AIPerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  
  async trackAnalysisPerformance(
    analysisType: AIAnalysisType,
    model: string,
    metrics: {
      processingTime: number;
      tokensUsed: TokenUsage;
      cost: number;
      userSatisfaction?: number;
    }
  ): Promise<void> {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      analysisType,
      model,
      processingTime: metrics.processingTime,
      tokensUsed: metrics.tokensUsed,
      cost: metrics.cost,
      userSatisfaction: metrics.userSatisfaction,
      efficiency: this.calculateEfficiency(metrics)
    };
    
    // Store in-memory for quick access
    const key = `${analysisType}_${model}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
    
    // Persist to database
    await db.collection('ai_performance_metrics').add(metric);
    
    // Alert on performance degradation
    await this.checkPerformanceAlerts(analysisType, model);
  }
  
  async generatePerformanceReport(): Promise<PerformanceReport> {
    const endDate = new Date();
    const startDate = subDays(endDate, 30); // Last 30 days
    
    const snapshot = await db.collection('ai_performance_metrics')
      .where('timestamp', '>=', startDate)
      .where('timestamp', '<=', endDate)
      .get();
    
    const metrics = snapshot.docs.map(doc => doc.data() as PerformanceMetric);
    
    return {
      period: { startDate, endDate },
      totalRequests: metrics.length,
      averageProcessingTime: this.calculateAverage(metrics, 'processingTime'),
      totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
      averageUserSatisfaction: this.calculateAverage(
        metrics.filter(m => m.userSatisfaction), 
        'userSatisfaction'
      ),
      modelComparison: this.compareModelPerformance(metrics),
      trends: this.analyzeTrends(metrics),
      recommendations: this.generateOptimizationRecommendations(metrics)
    };
  }
  
  private calculateEfficiency(metrics: any): number {
    // Efficiency = output quality / (processing time * cost)
    const timeScore = Math.max(0, 1 - (metrics.processingTime / 60000)); // Normalize to 60s
    const costScore = Math.max(0, 1 - (metrics.cost / 0.10)); // Normalize to $0.10
    const qualityScore = metrics.userSatisfaction || 0.7; // Default if not provided
    
    return (timeScore * 0.3 + costScore * 0.3 + qualityScore * 0.4);
  }
}
```

---

## 9. Quality Control & Feedback

### 9.1 Feedback Collection System

```typescript
// Feedback Collection Service
export class AIFeedbackService {
  async collectAnalysisFeedback(
    userId: string,
    analysisId: string,
    feedback: AnalysisFeedback
  ): Promise<void> {
    const feedbackRecord = {
      userId,
      analysisId,
      rating: feedback.rating, // 1-5 stars
      categories: feedback.categories, // accuracy, usefulness, clarity
      textFeedback: feedback.textFeedback,
      reportedIssues: feedback.reportedIssues || [],
      timestamp: new Date(),
      analysisType: await this.getAnalysisType(analysisId)
    };
    
    // Save feedback
    await db.collection('ai_feedback').add(feedbackRecord);
    
    // Update analysis record with feedback
    await db.collection('ai_analysis_results').doc(analysisId).update({
      'feedback.rating': feedback.rating,
      'feedback.receivedAt': new Date()
    });
    
    // Trigger quality improvements if needed
    if (feedback.rating <= 2) {
      await this.handleLowQualityFeedback(feedbackRecord);
    }
    
    // Update model performance metrics
    await this.updateModelPerformance(analysisId, feedback);
  }
  
  private async handleLowQualityFeedback(feedback: FeedbackRecord): Promise<void> {
    // Log for manual review
    console.warn('Low quality AI analysis detected:', {
      analysisId: feedback.analysisId,
      rating: feedback.rating,
      issues: feedback.reportedIssues
    });
    
    // Create alert for development team
    await this.createQualityAlert({
      type: 'low_rating',
      analysisId: feedback.analysisId,
      userId: feedback.userId,
      details: feedback,
      priority: feedback.rating === 1 ? 'high' : 'medium'
    });
    
    // Auto-flag for prompt improvement
    await this.flagForPromptImprovement(feedback.analysisType, feedback.reportedIssues);
  }
  
  async generateQualityReport(): Promise<QualityReport> {
    const thirtyDaysAgo = subDays(new Date(), 30);
    
    const snapshot = await db.collection('ai_feedback')
      .where('timestamp', '>=', thirtyDaysAgo)
      .get();
    
    const feedbacks = snapshot.docs.map(doc => doc.data() as FeedbackRecord);
    
    return {
      period: { start: thirtyDaysAgo, end: new Date() },
      totalFeedbacks: feedbacks.length,
      averageRating: this.calculateAverageRating(feedbacks),
      ratingDistribution: this.getRatingDistribution(feedbacks),
      commonIssues: this.identifyCommonIssues(feedbacks),
      improvementTrends: this.analyzeImprovementTrends(feedbacks),
      recommendations: this.generateQualityRecommendations(feedbacks)
    };
  }
}

// Feedback Components
export const AnalysisFeedbackWidget: React.FC<{ 
  analysisId: string; 
  analysisType: AIAnalysisType;
}> = ({ analysisId, analysisType }) => {
  const [feedback, setFeedback] = useState<AnalysisFeedback>({
    rating: 0,
    categories: { accuracy: 0, usefulness: 0, clarity: 0 },
    textFeedback: '',
    reportedIssues: []
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const handleSubmitFeedback = async () => {
    if (feedback.rating === 0) {
      toast.error('Please provide a rating');
      return;
    }
    
    setSubmitting(true);
    
    try {
      await submitAnalysisFeedback(analysisId, feedback);
      setSubmitted(true);
      toast.success('Thank you for your feedback!');
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (submitted) {
    return (
      <Card className="feedback-widget">
        <CardContent className="text-center py-6">
          <CheckCircleIcon className="w-8 h-8 mx-auto text-green-500 mb-2" />
          <p className="text-green-700">Feedback submitted successfully!</p>
          <p className="text-sm text-gray-600 mt-1">
            Your input helps us improve our AI analysis quality.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="feedback-widget">
      <CardHeader>
        <h4 className="text-md font-semibold">Rate this Analysis</h4>
        <p className="text-sm text-gray-600">
          Help us improve our AI insights
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div>
          <label className="block text-sm font-medium mb-2">Overall Rating</label>
          <StarRating
            rating={feedback.rating}
            onRatingChange={(rating) => setFeedback(prev => ({ ...prev, rating }))}
            size="lg"
          />
        </div>
        
        {/* Category Ratings */}
        <div className="space-y-4">
          <h5 className="text-sm font-medium">Rate Specific Aspects</h5>
          
          <CategoryRating
            label="Accuracy"
            description="How accurate were the insights?"
            rating={feedback.categories.accuracy}
            onRatingChange={(rating) => 
              setFeedback(prev => ({
                ...prev,
                categories: { ...prev.categories, accuracy: rating }
              }))
            }
          />
          
          <CategoryRating
            label="Usefulness"
            description="How helpful was this analysis?"
            rating={feedback.categories.usefulness}
            onRatingChange={(rating) => 
              setFeedback(prev => ({
                ...prev,
                categories: { ...prev.categories, usefulness: rating }
              }))
            }
          />
          
          <CategoryRating
            label="Clarity"
            description="How clear and understandable was it?"
            rating={feedback.categories.clarity}
            onRatingChange={(rating) => 
              setFeedback(prev => ({
                ...prev,
                categories: { ...prev.categories, clarity: rating }
              }))
            }
          />
        </div>
        
        {/* Text Feedback */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Additional Comments (Optional)
          </label>
          <TextArea
            value={feedback.textFeedback}
            onChange={(value) => setFeedback(prev => ({ ...prev, textFeedback: value }))}
            placeholder="Share any specific feedback or suggestions..."
            rows={3}
          />
        </div>
        
        {/* Issue Reporting */}
        {feedback.rating <= 2 && (
          <div>
            <label className="block text-sm font-medium mb-2">
              What issues did you notice? (Select all that apply)
            </label>
            <IssueCheckboxes
              selectedIssues={feedback.reportedIssues}
              onIssuesChange={(issues) => 
                setFeedback(prev => ({ ...prev, reportedIssues: issues }))
              }
            />
          </div>
        )}
        
        <Button 
          onClick={handleSubmitFeedback}
          disabled={feedback.rating === 0 || submitting}
          className="w-full"
        >
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </CardContent>
    </Card>
  );
};

const IssueCheckboxes: React.FC<{
  selectedIssues: string[];
  onIssuesChange: (issues: string[]) => void;
}> = ({ selectedIssues, onIssuesChange }) => {
  const issueOptions = [
    { id: 'inaccurate_data', label: 'Inaccurate analysis of my trades' },
    { id: 'irrelevant_advice', label: 'Advice not relevant to my situation' },
    { id: 'unclear_language', label: 'Difficult to understand' },
    { id: 'missing_context', label: 'Missing important context' },
    { id: 'generic_response', label: 'Too generic, not personalized' },
    { id: 'technical_error', label: 'Technical error or formatting issue' },
    { id: 'inappropriate_content', label: 'Inappropriate or concerning content' }
  ];
  
  const handleIssueToggle = (issueId: string) => {
    if (selectedIssues.includes(issueId)) {
      onIssuesChange(selectedIssues.filter(id => id !== issueId));
    } else {
      onIssuesChange([...selectedIssues, issueId]);
    }
  };
  
  return (
    <div className="space-y-2">
      {issueOptions.map(option => (
        <div key={option.id} className="flex items-center space-x-2">
          <Checkbox
            id={option.id}
            checked={selectedIssues.includes(option.id)}
            onCheckedChange={() => handleIssueToggle(option.id)}
          />
          <label htmlFor={option.id} className="text-sm">
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
};
```

---

## 10. Testing & Monitoring

### 10.1 AI System Testing

```typescript
// AI Testing Suite
export class AITestingSuite {
  private testCases: Map<AIAnalysisType, TestCase[]> = new Map();
  
  constructor() {
    this.initializeTestCases();
  }
  
  private initializeTestCases(): void {
    // Individual Trade Analysis Test Cases
    this.testCases.set('individual_trade', [
      {
        id: 'winning_trade_basic',
        description: 'Analyze a basic winning trade',
        input: {
          trade: this.createTestTrade({ result: 'win', winRate: 0.7 }),
          context: this.createTestContext({ experience: 'intermediate' })
        },
        expectedOutputs: {
          executionQuality: { score: { min: 60, max: 100 } },
          overallScore: { min: 60, max: 100 },
          learningOpportunities: { minItems: 2 }
        }
      },
      {
        id: 'losing_trade_beginner',
        description: 'Analyze losing trade for beginner',
        input: {
          trade: this.createTestTrade({ result: 'loss', amount: 50 }),
          context: this.createTestContext({ experience: 'beginner' })
        },
        expectedOutputs: {
          learningOpportunities: { minItems: 3 },
          nextSteps: { minItems: 3 },
          tone: 'educational_supportive'
        }
      }
    ]);
    
    // Daily Report Test Cases
    this.testCases.set('daily_report', [
      {
        id: 'profitable_day',
        description: 'Analyze profitable trading day',
        input: {
          trades: this.createTestTrades(8, { winRate: 0.75 }),
          date: '2025-01-15'
        },
        expectedOutputs: {
          summary: { winRate: { min: 70, max: 80 } },
          patterns: { minItems: 2 },
          recommendations: { minItems: 2 }
        }
      },
      {
        id: 'losing_day',
        description: 'Analyze challenging trading day',
        input: {
          trades: this.createTestTrades(6, { winRate: 0.33 }),
          date: '2025-01-16'
        },
        expectedOutputs: {
          emotionalIndicators: { required: true },
          recommendations: { minItems: 3, priorityHigh: { min: 1 } }
        }
      }
    ]);
  }
  
  async runTestSuite(analysisType?: AIAnalysisType): Promise<TestResults> {
    const typesToTest = analysisType ? [analysisType] : Array.from(this.testCases.keys());
    const results: TestResult[] = [];
    
    for (const type of typesToTest) {
      const testCases = this.testCases.get(type) || [];
      
      for (const testCase of testCases) {
        const result = await this.runSingleTest(type, testCase);
        results.push(result);
      }
    }
    
    return this.compileTestResults(results);
  }
  
  private async runSingleTest(analysisType: AIAnalysisType, testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      // Execute AI analysis
      const result = await this.executeAnalysis(analysisType, testCase.input);
      
      // Validate outputs
      const validationResults = this.validateOutputs(result, testCase.expectedOutputs);
      
      return {
        testCaseId: testCase.id,
        analysisType,
        status: validationResults.allPassed ? 'passed' : 'failed',
        executionTime: Date.now() - startTime,
        validationResults,
        actualOutput: result,
        errors: validationResults.errors
      };
      
    } catch (error) {
      return {
        testCaseId: testCase.id,
        analysisType,
        status: 'error',
        executionTime: Date.now() - startTime,
        errors: [error.message],
        actualOutput: null
      };
    }
  }
  
  private validateOutputs(actualOutput: any, expectedOutputs: any): ValidationResult {
    const errors: string[] = [];
    let checksRun = 0;
    let checksPassed = 0;
    
    // Validate structure
    if (expectedOutputs.structure) {
      checksRun++;
      if (this.validateStructure(actualOutput, expectedOutputs.structure)) {
        checksPassed++;
      } else {
        errors.push('Output structure validation failed');
      }
    }
    
    // Validate content quality
    if (expectedOutputs.contentQuality) {
      checksRun++;
      if (this.validateContentQuality(actualOutput, expectedOutputs.contentQuality)) {
        checksPassed++;
      } else {
        errors.push('Content quality validation failed');
      }
    }
    
    // Validate specific fields
    for (const [field, criteria] of Object.entries(expectedOutputs)) {
      if (field === 'structure' || field === 'contentQuality') continue;
      
      checksRun++;
      if (this.validateField(actualOutput, field, criteria)) {
        checksPassed++;
      } else {
        errors.push(`Field validation failed: ${field}`);
      }
    }
    
    return {
      allPassed: errors.length === 0,
      checksRun,
      checksPassed,
      errors
    };
  }
}

// Monitoring and Alerts
export class AIMonitoringService {
  private alerts: AlertRule[] = [
    {
      id: 'high_error_rate',
      condition: 'error_rate > 0.05',
      threshold: 0.05,
      window: 300, // 5 minutes
      severity: 'high'
    },
    {
      id: 'slow_response_time',
      condition: 'avg_response_time > 30000',
      threshold: 30000, // 30 seconds
      window: 600, // 10 minutes
      severity: 'medium'
    },
    {
      id: 'low_user_satisfaction',
      condition: 'avg_rating < 3.0',
      threshold: 3.0,
      window: 3600, // 1 hour
      severity: 'high'
    },
    {
      id: 'usage_spike',
      condition: 'requests_per_minute > 100',
      threshold: 100,
      window: 60, // 1 minute
      severity: 'medium'
    }
  ];
  
  async checkAlerts(): Promise<Alert[]> {
    const activeAlerts: Alert[] = [];
    
    for (const rule of this.alerts) {
      const isTriggered = await this.evaluateAlertRule(rule);
      
      if (isTriggered) {
        const alert: Alert = {
          id: this.generateAlertId(),
          ruleId: rule.id,
          severity: rule.severity,
          message: this.generateAlertMessage(rule),
          triggeredAt: new Date(),
          resolved: false
        };
        
        activeAlerts.push(alert);
        await this.sendAlert(alert);
      }
    }
    
    return activeAlerts;
  }
  
  async generateSystemHealthReport(): Promise<SystemHealthReport> {
    const endTime = new Date();
    const startTime = subHours(endTime, 24); // Last 24 hours
    
    const [
      errorRate,
      avgResponseTime,
      userSatisfaction,
      requestVolume,
      costMetrics
    ] = await Promise.all([
      this.calculateErrorRate(startTime, endTime),
      this.calculateAvgResponseTime(startTime, endTime),
      this.calculateUserSatisfaction(startTime, endTime),
      this.calculateRequestVolume(startTime, endTime),
      this.calculateCostMetrics(startTime, endTime)
    ]);
    
    return {
      period: { startTime, endTime },
      overall: this.calculateOverallHealth([
        errorRate.health,
        avgResponseTime.health,
        userSatisfaction.health,
        requestVolume.health
      ]),
      metrics: {
        errorRate,
        avgResponseTime,
        userSatisfaction,
        requestVolume,
        costMetrics
      },
      alerts: await this.getActiveAlerts(),
      recommendations: this.generateHealthRecommendations()
    };
  }
}
```

---

## Implementation Timeline

### Phase 1: Core Infrastructure (Weeks 1-2)
- Multi-model service setup (Gemini + GPT-4o)
- Usage tracking and limits system
- Basic individual trade analysis
- Cost optimization framework

### Phase 2: Report Generation (Weeks 3-4)
- On-demand daily reports
- On-demand weekly reports
- Pattern recognition engine
- Report display components

### Phase 3: Quality & Optimization (Weeks 5-6)
- Feedback collection system
- Performance monitoring
- Advanced prompt engineering
- Cost optimization implementations

### Phase 4: Testing & Launch (Weeks 7-8)
- Comprehensive testing suite
- Monitoring and alerting
- Production deployment
- User acceptance testing

---

*This AI Implementation Specification provides the complete technical foundation for Binary Hub's AI analysis features. The multi-model approach optimizes costs while maintaining quality, and the on-demand report generation aligns with user workflow and budget considerations.*

**Version:** 1.0  
**Date:** January 2025  
**Next Review:** February 2025