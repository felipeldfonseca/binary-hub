import type { TradeInsert } from '@/types/database';

interface ImportTradesParams {
  trades: Omit<TradeInsert, 'user_id'>[];
  userId: string;
  /** Account the trades belong to — every screen lists trades filtered by it */
  marketType: string;
  /** User JWT; falls back to the anon key, which RLS will reject */
  accessToken?: string | null;
  signal?: AbortSignal;
}

/**
 * Insert parsed CSV trades into one account, skipping the ones already
 * imported (unique constraint on user_id + notes).
 * Returns how many rows were actually inserted.
 */
export async function importTrades({
  trades,
  userId,
  marketType,
  accessToken,
  signal,
}: ImportTradesParams): Promise<number> {
  // A trade without an account is stored but never shown anywhere
  if (!marketType) throw new Error('No account selected for the import');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Raw fetch with the JWT from the auth context — avoids calling getSession(),
  // which can deadlock on the Supabase auth lock
  const response = await fetch(
    `${supabaseUrl}/rest/v1/trades?on_conflict=user_id%2Cnotes&select=id`,
    {
      method: 'POST',
      signal,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken ?? supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(trades.map(t => ({ ...t, user_id: userId, market_type: marketType }))),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const insertedRows = await response.json() as Array<{ id: string }>;
  return insertedRows.length;
}
