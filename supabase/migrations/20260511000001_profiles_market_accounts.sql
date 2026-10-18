-- Store user's market account configuration in their profile
-- so it persists across sessions and devices.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS market_accounts JSONB DEFAULT '[]'::jsonb;
