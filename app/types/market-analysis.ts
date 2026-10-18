// Types for Pre-Session Market Analysis

export interface MarketAnalysisResponse {
  conviction_score: number;
  conviction_label: ConvictionLabel;
  conviction_explanation: string;
  what_to_watch: string[];
  ai_overview: string;
  current_price: CurrentPrice;
  last_updated: string;
  dimensions: AnalysisDimensions;
}

export type ConvictionLabel =
  | 'Poor / Sit Out'
  | 'Mixed / Low Clarity'
  | 'Favorable / Moderate Edge'
  | 'Strong / High Conviction';

export interface CurrentPrice {
  price: string;
  daily_change: string;
  direction: 'up' | 'down' | 'flat';
}

export interface AnalysisDimensions {
  macro_context: MacroContextDimension;
  overnight_context: OvernightContextDimension;
  key_levels: KeyLevelsDimension;
  volatility_regime: VolatilityRegimeDimension;
  news_sentiment: NewsSentimentDimension;
}

export type IndicatorType = 'positive' | 'warning' | 'neutral' | 'info' | 'negative';

export interface BaseDimension {
  title: string;
  subtitle: string;
  indicator_label: string;
  indicator_type: IndicatorType;
  narrative: string;
  bottom_line: string;
}

export interface EconomicEvent {
  time: string;
  event: string;
  impact: 'high' | 'medium' | 'low';
  forecast: string | null;
  actual: string | null;
}

export interface MacroContextDimension extends BaseDimension {
  events: EconomicEvent[];
}

export interface OvernightData {
  prior_close: string;
  current: string;
  gap: string;
  on_high: string;
  on_low: string;
  range: string;
}

export interface OvernightContextDimension extends BaseDimension {
  data: OvernightData;
}

export interface PriceLevel {
  label: string;
  price: string;
  type: 'resistance' | 'support' | 'neutral';
}

export interface KeyLevelsDimension extends BaseDimension {
  levels: PriceLevel[];
}

export interface VolatilityData {
  vix: string;
  trend: 'Rising' | 'Declining' | 'Stable';
  regime: string;
}

export interface VolatilityRegimeDimension extends BaseDimension {
  data: VolatilityData;
}

export interface NewsHeadline {
  title: string;
  source: string;
  time: string;
}

export interface NewsSentimentDimension extends BaseDimension {
  headlines: NewsHeadline[];
}

// Helper function to get conviction color
export function getConvictionColor(score: number): string {
  if (score >= 70) return '#E1FFD9'; // primary green
  if (score >= 40) return '#FFA500'; // warning orange
  return '#FF4444'; // error red
}

// Helper function to get indicator color
export function getIndicatorColor(type: IndicatorType): { bg: string; fg: string } {
  switch (type) {
    case 'positive':
      return { bg: 'rgba(225, 255, 217, 0.15)', fg: '#E1FFD9' };
    case 'warning':
      return { bg: 'rgba(255, 165, 0, 0.15)', fg: '#FFA500' };
    case 'negative':
      return { bg: 'rgba(255, 68, 68, 0.15)', fg: '#FF4444' };
    case 'info':
      return { bg: 'rgba(130, 170, 200, 0.15)', fg: '#82AAC8' };
    case 'neutral':
    default:
      return { bg: 'rgba(255, 255, 255, 0.08)', fg: '#B3B3B3' };
  }
}
