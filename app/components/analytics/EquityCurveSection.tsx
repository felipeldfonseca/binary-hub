'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useTradesSupabase } from '@/hooks/useTradesSupabase';
import { useAccountTransactions } from '@/hooks/useAccountTransactions';
import { useMarketContext } from '@/lib/contexts/MarketContextSupabase';
import {
  buildCumulativePnlCurve,
  buildBalanceCurve,
  type CumulativePnlPoint,
  type BalanceCurvePoint,
} from '@/lib/utils/equityCurve';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabType = 'pnl' | 'balance';

interface TransactionFormValues {
  type: 'deposit' | 'withdrawal';
  amount: string;
  transaction_date: string;
  notes: string;
}

interface FormErrors {
  amount?: string;
  transaction_date?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${month}/${day}/${year.slice(2)}`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadEntry {
  value: number;
  dataKey: string;
  payload: CumulativePnlPoint & BalanceCurvePoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  tab: TabType;
}

function CustomTooltip({ active, payload, label, tab }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const value = payload[0]?.value ?? 0;
  const isPositive = value >= 0;

  return (
    <div className="bg-[#0f0f0f] border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
      <p className="text-white/50 text-xs mb-1">{label ? formatDate(label) : ''}</p>
      {tab === 'pnl' && (
        <>
          <p
            className="text-sm font-semibold"
            style={{ color: isPositive ? '#4ade80' : '#ef4444' }}
          >
            {formatCurrency(value)}
          </p>
          <p className="text-white/40 text-xs mt-0.5">
            Daily: {formatCurrency((payload[0]?.payload as CumulativePnlPoint)?.dailyPnl ?? 0)}
          </p>
        </>
      )}
      {tab === 'balance' && (
        <>
          <p className="text-sm font-semibold text-[#60a5fa]">{formatCurrency(value)}</p>
          {(payload[0]?.payload as BalanceCurvePoint)?.event !== 'trade' &&
            (payload[0]?.payload as BalanceCurvePoint)?.event !== 'start' && (
              <p
                className="text-xs mt-0.5 capitalize"
                style={{
                  color:
                    (payload[0]?.payload as BalanceCurvePoint)?.event === 'deposit'
                      ? '#60a5fa'
                      : '#f97316',
                }}
              >
                {(payload[0]?.payload as BalanceCurvePoint)?.event}
              </p>
            )}
        </>
      )}
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

interface SummaryStatsProps {
  totalPnl: number;
  winRate: number;
  bestDay: number;
  worstDay: number;
}

function SummaryStats({ totalPnl, winRate, bestDay, worstDay }: SummaryStatsProps) {
  const stats = [
    {
      label: 'Total P&L',
      value: formatCurrency(totalPnl),
      color: totalPnl >= 0 ? '#4ade80' : '#ef4444',
    },
    {
      label: 'Win Rate',
      value: `${winRate.toFixed(1)}%`,
      color: winRate >= 50 ? '#4ade80' : '#ef4444',
    },
    {
      label: 'Best Day',
      value: formatCurrency(bestDay),
      color: '#4ade80',
    },
    {
      label: 'Worst Day',
      value: formatCurrency(worstDay),
      color: '#ef4444',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-3"
        >
          <p className="text-white/40 text-xs mb-1">{stat.label}</p>
          <p className="text-sm font-semibold font-comfortaa" style={{ color: stat.color }}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <div className="h-9 w-32 bg-white/10 rounded-lg" />
          <div className="h-9 w-32 bg-white/10 rounded-lg" />
        </div>
        <div className="h-9 w-36 bg-white/10 rounded-lg" />
      </div>
      <div className="h-64 bg-white/5 rounded-xl" />
      <div className="grid grid-cols-4 gap-3 mt-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/5 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-white/30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      </div>
      <p className="text-white/60 font-comfortaa text-sm">No trades yet</p>
      <p className="text-white/30 text-xs mt-1">
        Start logging trades to see your equity curve
      </p>
    </div>
  );
}

// ─── Add Transaction Modal ────────────────────────────────────────────────────

interface AddTransactionModalProps {
  onClose: () => void;
  onSubmit: (values: TransactionFormValues) => Promise<void>;
  isSubmitting: boolean;
}

function AddTransactionModal({ onClose, onSubmit, isSubmitting }: AddTransactionModalProps) {
  const [form, setForm] = useState<TransactionFormValues>({
    type: 'deposit',
    amount: '',
    transaction_date: todayISO(),
    notes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};
    const amt = parseFloat(form.amount);
    if (!form.amount || isNaN(amt) || amt <= 0) {
      next.amount = 'Amount must be a positive number';
    }
    if (!form.transaction_date) {
      next.transaction_date = 'Date is required';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(form);
  };

  const isDeposit = form.type === 'deposit';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-comfortaa font-semibold text-lg">Add Transaction</h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div>
            <label className="text-white/50 text-xs mb-2 block">Type</label>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: 'deposit' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  isDeposit
                    ? 'bg-[#60a5fa]/20 text-[#60a5fa] border border-[#60a5fa]/30'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Deposit
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: 'withdrawal' }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  !isDeposit
                    ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/30'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Withdrawal
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-white/50 text-xs mb-2 block">Amount (USD)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => {
                setForm((f) => ({ ...f, amount: e.target.value }));
                if (errors.amount) setErrors((er) => ({ ...er, amount: undefined }));
              }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 transition-colors"
            />
            {errors.amount && (
              <p className="text-[#ef4444] text-xs mt-1">{errors.amount}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="text-white/50 text-xs mb-2 block">Date</label>
            <input
              type="date"
              value={form.transaction_date}
              max={todayISO()}
              onChange={(e) => {
                setForm((f) => ({ ...f, transaction_date: e.target.value }));
                if (errors.transaction_date)
                  setErrors((er) => ({ ...er, transaction_date: undefined }));
              }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30 transition-colors [color-scheme:dark]"
            />
            {errors.transaction_date && (
              <p className="text-[#ef4444] text-xs mt-1">{errors.transaction_date}</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-white/50 text-xs mb-2 block">Notes (optional)</label>
            <input
              type="text"
              placeholder="e.g. Monthly funding"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/20 text-sm focus:outline-none focus:border-white/30 transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white/80 hover:border-white/20 transition-all text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
              style={{
                backgroundColor: isDeposit
                  ? 'rgba(96,165,250,0.15)'
                  : 'rgba(249,115,22,0.15)',
                border: `1px solid ${isDeposit ? 'rgba(96,165,250,0.3)' : 'rgba(249,115,22,0.3)'}`,
                color: isDeposit ? '#60a5fa' : '#f97316',
              }}
            >
              {isSubmitting ? 'Saving...' : `Add ${isDeposit ? 'Deposit' : 'Withdrawal'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EquityCurveSection() {
  const [tab, setTab] = useState<TabType>('pnl');
  const [showModal, setShowModal] = useState(false);

  const { trades, isLoading: tradesLoading } = useTradesSupabase();
  const { activeMarket } = useMarketContext();
  const currentBalance = activeMarket?.bankroll.current ?? 0;
  const marketType = activeMarket?.marketType ?? 'binary';

  const { transactions, isLoading: txLoading, addTransaction } = useAccountTransactions(marketType);

  const isLoading = tradesLoading || txLoading;

  // Build chart data
  const pnlCurve = useMemo(() => buildCumulativePnlCurve(trades), [trades]);
  const balanceCurve = useMemo(
    () => buildBalanceCurve(trades, transactions, currentBalance),
    [trades, transactions, currentBalance]
  );

  // Summary stats derived from pnlCurve
  const summaryStats = useMemo(() => {
    const completedTrades = trades.filter((t) => t.result !== 'pending' && t.result !== null);
    const wins = completedTrades.filter((t) => t.result === 'win').length;
    const winRate =
      completedTrades.length > 0 ? (wins / completedTrades.length) * 100 : 0;
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    const dailyPnls = pnlCurve.map((p) => p.dailyPnl);
    const bestDay = dailyPnls.length > 0 ? Math.max(...dailyPnls) : 0;
    const worstDay = dailyPnls.length > 0 ? Math.min(...dailyPnls) : 0;

    return { totalPnl, winRate, bestDay, worstDay };
  }, [trades, pnlCurve]);

  const handleAddTransaction = useCallback(
    async (values: TransactionFormValues) => {
      await addTransaction.mutateAsync({
        type: values.type,
        amount: parseFloat(values.amount),
        transaction_date: new Date(values.transaction_date).toISOString(),
        notes: values.notes || null,
        market_type: marketType,
      });
      setShowModal(false);
    },
    [addTransaction, marketType]
  );

  // Determine if the current tab has data
  const hasTrades = trades.length > 0;

  // Chart color config
  const pnlColor = '#4ade80';
  const pnlColorLight = '#E1FFD9';
  const balanceColor = '#60a5fa';
  const balanceColorDark = '#3b82f6';

  const chartData = tab === 'pnl' ? pnlCurve : balanceCurve;
  const dataKey = tab === 'pnl' ? 'cumulativePnl' : 'balance';

  // Y-axis domain with padding — cast through unknown to appease the union type
  const allValues = (chartData as unknown as Array<Record<string, unknown>>).map(
    (d) => (typeof d[dataKey] === 'number' ? (d[dataKey] as number) : 0)
  );
  const minVal = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 0;
  const padding = Math.abs(maxVal - minVal) * 0.12 || 50;
  const yMin = Math.floor(minVal - padding);
  const yMax = Math.ceil(maxVal + padding);

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        {/* Tab switcher */}
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('pnl')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'pnl'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Cumulative P&amp;L
          </button>
          <button
            onClick={() => setTab('balance')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'balance'
                ? 'bg-white/10 text-white'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Account Balance
          </button>
        </div>

        {/* Add Transaction button */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Transaction
        </button>
      </div>

      {/* Chart area */}
      {!hasTrades ? (
        <EmptyState />
      ) : (
        <div className="w-full" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id="gradPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={pnlColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={pnlColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={balanceColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={balanceColor} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.05)"
                vertical={false}
              />

              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                minTickGap={40}
              />

              <YAxis
                domain={[yMin, yMax]}
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    notation: 'compact',
                    maximumFractionDigits: 1,
                  }).format(v)
                }
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={64}
              />

              <Tooltip
                content={<CustomTooltip tab={tab} />}
                cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
              />

              {tab === 'pnl' && (
                <ReferenceLine
                  y={0}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 4"
                />
              )}

              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={tab === 'pnl' ? pnlColor : balanceColorDark}
                strokeWidth={2}
                fill={tab === 'pnl' ? 'url(#gradPnl)' : 'url(#gradBalance)'}
                dot={false}
                activeDot={{
                  r: 4,
                  stroke: tab === 'pnl' ? pnlColorLight : balanceColor,
                  strokeWidth: 2,
                  fill: '#0f0f0f',
                }}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary stats */}
      <SummaryStats
        totalPnl={summaryStats.totalPnl}
        winRate={summaryStats.winRate}
        bestDay={summaryStats.bestDay}
        worstDay={summaryStats.worstDay}
      />

      {/* Add Transaction Modal */}
      {showModal && (
        <AddTransactionModal
          onClose={() => setShowModal(false)}
          onSubmit={handleAddTransaction}
          isSubmitting={addTransaction.isPending}
        />
      )}
    </div>
  );
}
