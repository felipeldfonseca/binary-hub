-- Add unique constraint for CSV deduplication
-- This allows the upsert-based import to skip duplicates without a separate SELECT
-- NULL notes are excluded from the constraint (allows multiple trades without notes)
ALTER TABLE trades
  ADD CONSTRAINT trades_user_id_notes_unique UNIQUE (user_id, notes);
