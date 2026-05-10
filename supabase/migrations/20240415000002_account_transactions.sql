CREATE TABLE account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_type TEXT NOT NULL DEFAULT 'binary',
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  transaction_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own transactions" ON account_transactions
  FOR ALL USING (auth.uid() = user_id);
CREATE INDEX idx_acct_tx_user_date ON account_transactions(user_id, transaction_date DESC);
