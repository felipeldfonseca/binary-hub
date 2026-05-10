export interface CumulativePnlPoint {
  date: string;
  dailyPnl: number;
  cumulativePnl: number;
}

export interface BalanceCurvePoint {
  date: string;
  balance: number;
  event: 'trade' | 'deposit' | 'withdrawal' | 'start';
}

interface TradeInput {
  pnl: number | null;
  entry_time: string;
}

interface TransactionInput {
  type: 'deposit' | 'withdrawal';
  amount: number;
  transaction_date: string;
}

/**
 * Builds a cumulative P&L curve grouped by calendar day.
 * Starts at zero. Each point represents end-of-day cumulative P&L.
 */
export function buildCumulativePnlCurve(trades: TradeInput[]): CumulativePnlPoint[] {
  if (trades.length === 0) return [];

  // Sort ascending by entry_time
  const sorted = [...trades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );

  // Group by YYYY-MM-DD
  const byDate = new Map<string, number>();
  for (const trade of sorted) {
    const date = trade.entry_time.slice(0, 10); // fast YYYY-MM-DD extraction
    const pnl = trade.pnl ?? 0;
    byDate.set(date, (byDate.get(date) ?? 0) + pnl);
  }

  const points: CumulativePnlPoint[] = [];
  let cumulative = 0;

  byDate.forEach((dailyPnl, date) => {
    cumulative += dailyPnl;
    points.push({ date, dailyPnl, cumulativePnl: cumulative });
  });

  return points;
}

/**
 * Builds a balance curve by merging trades + deposit/withdrawal events
 * into a chronological timeline starting from the inferred initial capital.
 */
export function buildBalanceCurve(
  trades: TradeInput[],
  transactions: TransactionInput[],
  currentBalance: number
): BalanceCurvePoint[] {
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalDeposits = transactions
    .filter((tx) => tx.type === 'deposit')
    .reduce((sum, tx) => sum + tx.amount, 0);
  const totalWithdrawals = transactions
    .filter((tx) => tx.type === 'withdrawal')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const initialCapital = currentBalance - totalPnl - totalDeposits + totalWithdrawals;

  // Collect all events with a unified date key
  interface RawEvent {
    date: string; // YYYY-MM-DD
    timestamp: number;
    pnlDelta: number;
    event: 'trade' | 'deposit' | 'withdrawal';
  }

  const events: RawEvent[] = [];

  for (const trade of trades) {
    events.push({
      date: trade.entry_time.slice(0, 10),
      timestamp: new Date(trade.entry_time).getTime(),
      pnlDelta: trade.pnl ?? 0,
      event: 'trade',
    });
  }

  for (const tx of transactions) {
    const delta = tx.type === 'deposit' ? tx.amount : -tx.amount;
    events.push({
      date: tx.transaction_date.slice(0, 10),
      timestamp: new Date(tx.transaction_date).getTime(),
      pnlDelta: delta,
      event: tx.type,
    });
  }

  // Sort ascending by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);

  const today = new Date().toISOString().slice(0, 10);
  const startDate = events.length > 0 ? events[0].date : today;

  const points: BalanceCurvePoint[] = [
    { date: startDate, balance: initialCapital, event: 'start' },
  ];

  // Group events by date, accumulating daily deltas
  // We track per-date the dominant event type (deposit/withdrawal > trade)
  const byDate = new Map<string, { delta: number; event: 'trade' | 'deposit' | 'withdrawal' }>();

  for (const ev of events) {
    const existing = byDate.get(ev.date);
    if (!existing) {
      byDate.set(ev.date, { delta: ev.pnlDelta, event: ev.event });
    } else {
      existing.delta += ev.pnlDelta;
      // Prioritize deposit/withdrawal label over trade
      if (ev.event === 'deposit' || ev.event === 'withdrawal') {
        existing.event = ev.event;
      }
    }
  }

  let runningBalance = initialCapital;

  byDate.forEach(({ delta, event }, date) => {
    runningBalance += delta;
    points.push({ date, balance: runningBalance, event });
  });

  // Ensure the last data point reflects currentBalance (rounding guard)
  if (points.length > 1) {
    points[points.length - 1].balance = currentBalance;
  }

  return points;
}
