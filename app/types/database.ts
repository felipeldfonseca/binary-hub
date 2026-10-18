// Auto-generated types for Supabase
// Run `supabase gen types typescript` to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          timezone: string;
          preferred_language: string;
          default_instruments: string[];
          trading_start_time: string;
          trading_end_time: string;
          plan: 'free' | 'pro';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          preferred_language?: string;
          default_instruments?: string[];
          trading_start_time?: string;
          trading_end_time?: string;
          plan?: 'free' | 'pro';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          timezone?: string;
          preferred_language?: string;
          default_instruments?: string[];
          trading_start_time?: string;
          trading_end_time?: string;
          plan?: 'free' | 'pro';
          created_at?: string;
          updated_at?: string;
        };
      };
      watchlist_items: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          asset_type: 'futures' | 'crypto' | 'stock' | 'index' | 'metal';
          display_name: string | null;
          is_primary: boolean;
          notes: string | null;
          notify_premarket: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          symbol: string;
          asset_type: 'futures' | 'crypto' | 'stock' | 'index' | 'metal';
          display_name?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          notify_premarket?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          symbol?: string;
          asset_type?: 'futures' | 'crypto' | 'stock' | 'index' | 'metal';
          display_name?: string | null;
          is_primary?: boolean;
          notes?: string | null;
          notify_premarket?: boolean;
          sort_order?: number;
          created_at?: string;
        };
      };
      market_snapshots: {
        Row: {
          id: string;
          symbol: string;
          last_price: number | null;
          open_price: number | null;
          high_price: number | null;
          low_price: number | null;
          previous_close: number | null;
          change_amount: number | null;
          change_percent: number | null;
          volume: number | null;
          market_status: string | null;
          data_source: string | null;
          snapshot_date: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          symbol: string;
          last_price?: number | null;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          previous_close?: number | null;
          change_amount?: number | null;
          change_percent?: number | null;
          volume?: number | null;
          market_status?: string | null;
          data_source?: string | null;
          snapshot_date: string;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          symbol?: string;
          last_price?: number | null;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          previous_close?: number | null;
          change_amount?: number | null;
          change_percent?: number | null;
          volume?: number | null;
          market_status?: string | null;
          data_source?: string | null;
          snapshot_date?: string;
          fetched_at?: string;
        };
      };
      trading_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_date: string;
          premarket_notes: string | null;
          market_bias: 'bullish' | 'bearish' | 'neutral' | 'mixed' | null;
          key_levels: string | null;
          planned_instruments: string[] | null;
          session_notes: string | null;
          lessons_learned: string | null;
          emotional_state:
            | 'calm'
            | 'anxious'
            | 'confident'
            | 'frustrated'
            | 'neutral'
            | null;
          followed_plan: boolean | null;
          total_trades: number;
          winning_trades: number;
          losing_trades: number;
          total_pnl: number;
          ai_summary: string | null;
          ai_generated_at: string | null;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_date: string;
          premarket_notes?: string | null;
          market_bias?: 'bullish' | 'bearish' | 'neutral' | 'mixed' | null;
          key_levels?: string | null;
          planned_instruments?: string[] | null;
          session_notes?: string | null;
          lessons_learned?: string | null;
          emotional_state?:
            | 'calm'
            | 'anxious'
            | 'confident'
            | 'frustrated'
            | 'neutral'
            | null;
          followed_plan?: boolean | null;
          total_trades?: number;
          winning_trades?: number;
          losing_trades?: number;
          total_pnl?: number;
          ai_summary?: string | null;
          ai_generated_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_date?: string;
          premarket_notes?: string | null;
          market_bias?: 'bullish' | 'bearish' | 'neutral' | 'mixed' | null;
          key_levels?: string | null;
          planned_instruments?: string[] | null;
          session_notes?: string | null;
          lessons_learned?: string | null;
          emotional_state?:
            | 'calm'
            | 'anxious'
            | 'confident'
            | 'frustrated'
            | 'neutral'
            | null;
          followed_plan?: boolean | null;
          total_trades?: number;
          winning_trades?: number;
          losing_trades?: number;
          total_pnl?: number;
          ai_summary?: string | null;
          ai_generated_at?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          symbol: string;
          asset_type: 'futures' | 'crypto' | 'stock' | 'binary_option';
          direction: 'long' | 'short' | 'call' | 'put';
          entry_price: number | null;
          exit_price: number | null;
          quantity: number;
          stake_amount: number | null;
          payout_percent: number | null;
          duration_seconds: number | null;
          result: 'win' | 'loss' | 'breakeven' | 'pending' | null;
          pnl: number | null;
          pnl_percent: number | null;
          strategy: string | null;
          setup_type: string | null;
          timeframe: string | null;
          entry_reason: string | null;
          exit_reason: string | null;
          notes: string | null;
          screenshot_entry: string | null;
          screenshot_exit: string | null;
          entry_time: string;
          exit_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id?: string | null;
          symbol: string;
          asset_type: 'futures' | 'crypto' | 'stock' | 'binary_option';
          direction: 'long' | 'short' | 'call' | 'put';
          entry_price?: number | null;
          exit_price?: number | null;
          quantity?: number;
          stake_amount?: number | null;
          payout_percent?: number | null;
          duration_seconds?: number | null;
          result?: 'win' | 'loss' | 'breakeven' | 'pending' | null;
          pnl?: number | null;
          pnl_percent?: number | null;
          strategy?: string | null;
          setup_type?: string | null;
          timeframe?: string | null;
          entry_reason?: string | null;
          exit_reason?: string | null;
          notes?: string | null;
          screenshot_entry?: string | null;
          screenshot_exit?: string | null;
          entry_time: string;
          exit_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          symbol?: string;
          asset_type?: 'futures' | 'crypto' | 'stock' | 'binary_option';
          direction?: 'long' | 'short' | 'call' | 'put';
          entry_price?: number | null;
          exit_price?: number | null;
          quantity?: number;
          stake_amount?: number | null;
          payout_percent?: number | null;
          duration_seconds?: number | null;
          result?: 'win' | 'loss' | 'breakeven' | 'pending' | null;
          pnl?: number | null;
          pnl_percent?: number | null;
          strategy?: string | null;
          setup_type?: string | null;
          timeframe?: string | null;
          entry_reason?: string | null;
          exit_reason?: string | null;
          notes?: string | null;
          screenshot_entry?: string | null;
          screenshot_exit?: string | null;
          entry_time?: string;
          exit_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      trading_rules: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_analyses: {
        Row: {
          id: string;
          user_id: string;
          analysis_type: 'session_review' | 'trade_analysis' | 'weekly_report';
          target_id: string | null;
          prompt_context: Json | null;
          result: string | null;
          model_used: string | null;
          tokens_used: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          analysis_type: 'session_review' | 'trade_analysis' | 'weekly_report';
          target_id?: string | null;
          prompt_context?: Json | null;
          result?: string | null;
          model_used?: string | null;
          tokens_used?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          analysis_type?: 'session_review' | 'trade_analysis' | 'weekly_report';
          target_id?: string | null;
          prompt_context?: Json | null;
          result?: string | null;
          model_used?: string | null;
          tokens_used?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type WatchlistItem =
  Database['public']['Tables']['watchlist_items']['Row'];
export type WatchlistItemInsert =
  Database['public']['Tables']['watchlist_items']['Insert'];
export type WatchlistItemUpdate =
  Database['public']['Tables']['watchlist_items']['Update'];

export type MarketSnapshot =
  Database['public']['Tables']['market_snapshots']['Row'];
export type MarketSnapshotInsert =
  Database['public']['Tables']['market_snapshots']['Insert'];

export type TradingSession =
  Database['public']['Tables']['trading_sessions']['Row'];
export type TradingSessionInsert =
  Database['public']['Tables']['trading_sessions']['Insert'];
export type TradingSessionUpdate =
  Database['public']['Tables']['trading_sessions']['Update'];

export type Trade = Database['public']['Tables']['trades']['Row'];
export type TradeInsert = Database['public']['Tables']['trades']['Insert'];
export type TradeUpdate = Database['public']['Tables']['trades']['Update'];

export type TradingRule = Database['public']['Tables']['trading_rules']['Row'];
export type TradingRuleInsert =
  Database['public']['Tables']['trading_rules']['Insert'];
export type TradingRuleUpdate =
  Database['public']['Tables']['trading_rules']['Update'];

export type AIAnalysis = Database['public']['Tables']['ai_analyses']['Row'];
export type AIAnalysisInsert =
  Database['public']['Tables']['ai_analyses']['Insert'];

// Asset types
export type AssetType = 'futures' | 'crypto' | 'stock' | 'index' | 'metal';
export type TradeAssetType = 'futures' | 'crypto' | 'stock' | 'binary_option';
export type TradeDirection = 'long' | 'short' | 'call' | 'put';
export type TradeResult = 'win' | 'loss' | 'breakeven' | 'pending';
export type MarketBias = 'bullish' | 'bearish' | 'neutral' | 'mixed';
export type EmotionalState =
  | 'calm'
  | 'anxious'
  | 'confident'
  | 'frustrated'
  | 'neutral';
