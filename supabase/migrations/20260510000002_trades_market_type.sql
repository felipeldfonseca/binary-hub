-- Add market_type to trades so each trade knows which account it belongs to.
-- Matches the market_type convention used in account_transactions.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS market_type TEXT;
CREATE INDEX IF NOT EXISTS idx_trades_user_market_type ON trades(user_id, market_type);
