-- Binary Hub Lean Schema
-- Focused on: Premarket Analysis -> Trading -> Journaling -> Analytics

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    preferred_language TEXT DEFAULT 'pt-BR',

    -- Trading preferences
    default_instruments TEXT[] DEFAULT ARRAY['ES', 'NQ', 'BTC', 'ETH'],
    trading_start_time TIME DEFAULT '09:00',
    trading_end_time TIME DEFAULT '17:00',

    -- Subscription (simple for now)
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WATCHLIST
-- User's instruments they want to track in premarket
-- ============================================================================
CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    symbol TEXT NOT NULL,           -- ES, NQ, BTC, ETH, SOL, AAPL, etc.
    asset_type TEXT NOT NULL,       -- futures, crypto, stock, index, metal
    display_name TEXT,              -- "S&P 500 E-mini", "Bitcoin", etc.

    -- User preferences for this instrument
    is_primary BOOLEAN DEFAULT false,  -- Main instruments they trade
    notes TEXT,                         -- Personal notes about this instrument

    -- Notification settings
    notify_premarket BOOLEAN DEFAULT true,

    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, symbol)
);

-- ============================================================================
-- MARKET DATA CACHE
-- Cached market data for premarket analysis
-- ============================================================================
CREATE TABLE market_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL,

    -- Price data
    last_price DECIMAL(18, 8),
    open_price DECIMAL(18, 8),
    high_price DECIMAL(18, 8),
    low_price DECIMAL(18, 8),
    previous_close DECIMAL(18, 8),

    -- Change metrics
    change_amount DECIMAL(18, 8),
    change_percent DECIMAL(8, 4),

    -- Volume
    volume BIGINT,

    -- Additional context
    market_status TEXT,             -- pre_market, open, after_hours, closed
    data_source TEXT,               -- yahoo, alpha_vantage, etc.

    snapshot_date DATE NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(symbol, snapshot_date)
);

-- ============================================================================
-- TRADING SESSIONS
-- A trading session is a period of trading (usually a day)
-- ============================================================================
CREATE TABLE trading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    session_date DATE NOT NULL,

    -- Premarket notes (before trading)
    premarket_notes TEXT,
    market_bias TEXT CHECK (market_bias IN ('bullish', 'bearish', 'neutral', 'mixed')),
    key_levels TEXT,                -- Important S/R levels noted
    planned_instruments TEXT[],     -- What they plan to trade

    -- Post-session review
    session_notes TEXT,
    lessons_learned TEXT,
    emotional_state TEXT CHECK (emotional_state IN ('calm', 'anxious', 'confident', 'frustrated', 'neutral')),
    followed_plan BOOLEAN,

    -- Computed stats (denormalized for quick access)
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    total_pnl DECIMAL(18, 2) DEFAULT 0,

    -- AI Analysis (generated on-demand)
    ai_summary TEXT,
    ai_generated_at TIMESTAMPTZ,

    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, session_date)
);

-- ============================================================================
-- TRADES
-- Individual trade records
-- ============================================================================
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES trading_sessions(id) ON DELETE SET NULL,

    -- Instrument
    symbol TEXT NOT NULL,
    asset_type TEXT NOT NULL,       -- futures, crypto, stock, binary_option

    -- Trade details
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short', 'call', 'put')),
    entry_price DECIMAL(18, 8),
    exit_price DECIMAL(18, 8),
    quantity DECIMAL(18, 8) DEFAULT 1,

    -- For binary options
    stake_amount DECIMAL(18, 2),
    payout_percent DECIMAL(8, 4),
    duration_seconds INTEGER,       -- Option duration

    -- Results
    result TEXT CHECK (result IN ('win', 'loss', 'breakeven', 'pending')),
    pnl DECIMAL(18, 2),
    pnl_percent DECIMAL(8, 4),

    -- Context
    strategy TEXT,                  -- Name of strategy used
    setup_type TEXT,                -- e.g., "breakout", "reversal", "trend_follow"
    timeframe TEXT,                 -- e.g., "1m", "5m", "15m"

    -- Notes
    entry_reason TEXT,
    exit_reason TEXT,
    notes TEXT,

    -- Screenshots (URLs to Supabase storage)
    screenshot_entry TEXT,
    screenshot_exit TEXT,

    -- Timestamps
    entry_time TIMESTAMPTZ NOT NULL,
    exit_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TRADING RULES
-- Personal rules the trader sets for themselves
-- ============================================================================
CREATE TABLE trading_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    title TEXT NOT NULL,
    description TEXT,
    category TEXT,                  -- risk_management, entry, exit, mindset

    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AI ANALYSIS REQUESTS
-- Track AI analysis requests and results
-- ============================================================================
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    analysis_type TEXT NOT NULL,    -- session_review, trade_analysis, weekly_report
    target_id UUID,                 -- session_id or trade_id being analyzed

    prompt_context JSONB,           -- Context sent to AI
    result TEXT,                    -- AI response

    model_used TEXT,                -- gpt-4o-mini, gemini-flash, etc.
    tokens_used INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

-- Trades indexes
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_session_id ON trades(session_id);
CREATE INDEX idx_trades_user_entry_time ON trades(user_id, entry_time DESC);
CREATE INDEX idx_trades_user_symbol ON trades(user_id, symbol);
CREATE INDEX idx_trades_user_result ON trades(user_id, result);

-- Sessions indexes
CREATE INDEX idx_sessions_user_id ON trading_sessions(user_id);
CREATE INDEX idx_sessions_user_date ON trading_sessions(user_id, session_date DESC);

-- Watchlist indexes
CREATE INDEX idx_watchlist_user_id ON watchlist_items(user_id);

-- Market snapshots indexes
CREATE INDEX idx_market_snapshots_symbol_date ON market_snapshots(symbol, snapshot_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Watchlist: users can only manage their own watchlist
CREATE POLICY "Users can manage own watchlist" ON watchlist_items
    FOR ALL USING (auth.uid() = user_id);

-- Trading sessions: users can only manage their own sessions
CREATE POLICY "Users can manage own sessions" ON trading_sessions
    FOR ALL USING (auth.uid() = user_id);

-- Trades: users can only manage their own trades
CREATE POLICY "Users can manage own trades" ON trades
    FOR ALL USING (auth.uid() = user_id);

-- Trading rules: users can only manage their own rules
CREATE POLICY "Users can manage own rules" ON trading_rules
    FOR ALL USING (auth.uid() = user_id);

-- AI analyses: users can only see their own analyses
CREATE POLICY "Users can manage own ai analyses" ON ai_analyses
    FOR ALL USING (auth.uid() = user_id);

-- Market snapshots: anyone authenticated can read (public market data)
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read market data" ON market_snapshots
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON trading_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_trades_updated_at
    BEFORE UPDATE ON trades
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_rules_updated_at
    BEFORE UPDATE ON trading_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update session stats when trades change
CREATE OR REPLACE FUNCTION update_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the session stats
    UPDATE trading_sessions
    SET
        total_trades = (SELECT COUNT(*) FROM trades WHERE session_id = COALESCE(NEW.session_id, OLD.session_id)),
        winning_trades = (SELECT COUNT(*) FROM trades WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND result = 'win'),
        losing_trades = (SELECT COUNT(*) FROM trades WHERE session_id = COALESCE(NEW.session_id, OLD.session_id) AND result = 'loss'),
        total_pnl = (SELECT COALESCE(SUM(pnl), 0) FROM trades WHERE session_id = COALESCE(NEW.session_id, OLD.session_id))
    WHERE id = COALESCE(NEW.session_id, OLD.session_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to update session stats
CREATE TRIGGER update_session_stats_on_insert
    AFTER INSERT ON trades
    FOR EACH ROW
    WHEN (NEW.session_id IS NOT NULL)
    EXECUTE FUNCTION update_session_stats();

CREATE TRIGGER update_session_stats_on_update
    AFTER UPDATE ON trades
    FOR EACH ROW
    WHEN (NEW.session_id IS NOT NULL OR OLD.session_id IS NOT NULL)
    EXECUTE FUNCTION update_session_stats();

CREATE TRIGGER update_session_stats_on_delete
    AFTER DELETE ON trades
    FOR EACH ROW
    WHEN (OLD.session_id IS NOT NULL)
    EXECUTE FUNCTION update_session_stats();

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- SEED DATA: Default watchlist items for new users
-- ============================================================================

-- Function to seed default watchlist for new users
CREATE OR REPLACE FUNCTION seed_default_watchlist()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default instruments for new user
    INSERT INTO watchlist_items (user_id, symbol, asset_type, display_name, is_primary, sort_order)
    VALUES
        (NEW.id, 'ES', 'futures', 'S&P 500 E-mini', true, 1),
        (NEW.id, 'NQ', 'futures', 'NASDAQ-100 E-mini', true, 2),
        (NEW.id, 'BTC', 'crypto', 'Bitcoin', true, 3),
        (NEW.id, 'ETH', 'crypto', 'Ethereum', true, 4),
        (NEW.id, 'SOL', 'crypto', 'Solana', false, 5);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_seed_watchlist
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION seed_default_watchlist();
