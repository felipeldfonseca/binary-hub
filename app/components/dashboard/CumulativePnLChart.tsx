'use client'

import React, { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'
import { useAccountTransactions } from '@/hooks/useAccountTransactions'
import { buildCumulativePnlCurve, buildBalanceCurve } from '@/lib/utils/equityCurve'
import { useToastHelpers } from '@/components/ui/Toast'
import type { MarketType } from '@/types/markets'

type ViewMode = 'pnl' | 'balance'
type Period = 'week' | 'month' | '3months' | 'ytd' | 'all'

function getPeriodStart(period: Period): Date | null {
  if (period === 'all') return null
  const now = new Date()
  if (period === 'ytd') return new Date(now.getFullYear(), 0, 1)
  const days: Record<Exclude<Period, 'all' | 'ytd'>, number> = {
    week: 7, month: 30, '3months': 90,
  }
  const d = new Date(now)
  d.setDate(d.getDate() - days[period as Exclude<Period, 'all' | 'ytd'>])
  return d
}

interface AddTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { type: 'deposit' | 'withdrawal'; amount: number; date: string; notes?: string }) => Promise<void>
  isSubmitting: boolean
  isPortuguese: boolean
}

function AddTransactionModal({ isOpen, onClose, onSubmit, isSubmitting, isPortuguese }: AddTransactionModalProps) {
  const [type, setType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) {
      setError(isPortuguese ? 'Valor inválido' : 'Invalid amount')
      return
    }
    await onSubmit({ type, amount: parsed, date, notes: notes || undefined })
    setAmount('')
    setNotes('')
    setError('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white font-comfortaa">
            {isPortuguese ? 'Registrar Movimentação' : 'Record Transaction'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-2 block font-comfortaa">
              {isPortuguese ? 'Tipo' : 'Type'}
            </label>
            <div className="flex gap-2">
              {(['deposit', 'withdrawal'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2 rounded-lg font-comfortaa font-medium transition-all text-sm ${
                    type === t
                      ? t === 'deposit'
                        ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                        : 'bg-red-500/20 border border-red-500/50 text-red-400'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  {t === 'deposit'
                    ? (isPortuguese ? 'Depósito' : 'Deposit')
                    : (isPortuguese ? 'Retirada' : 'Withdrawal')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block font-comfortaa">
              {isPortuguese ? 'Valor (USD)' : 'Amount (USD)'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={e => { setAmount(e.target.value); setError('') }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-comfortaa focus:outline-none focus:border-[#E1FFD9]/50"
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block font-comfortaa">
              {isPortuguese ? 'Data' : 'Date'}
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-comfortaa focus:outline-none focus:border-[#E1FFD9]/50"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block font-comfortaa">
              {isPortuguese ? 'Observações (opcional)' : 'Notes (optional)'}
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-comfortaa focus:outline-none focus:border-[#E1FFD9]/50"
            />
          </div>

          {error && <p className="text-red-400 text-sm font-comfortaa">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-comfortaa text-sm"
            >
              {isPortuguese ? 'Cancelar' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-gray-900 font-semibold rounded-lg hover:opacity-90 transition-opacity font-comfortaa text-sm disabled:opacity-50"
            >
              {isSubmitting
                ? (isPortuguese ? 'Salvando...' : 'Saving...')
                : (isPortuguese ? 'Salvar' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Keep period prop for backward compat but manage period internally
interface CumulativePnLChartProps {
  period?: string
  isLoading?: boolean
}

export default function CumulativePnLChart({ isLoading = false }: CumulativePnLChartProps) {
  const { isPortuguese } = useLanguage()
  const { showSuccess, showError } = useToastHelpers()
  const { marketAccounts, activeMarket, setActiveMarket } = useMarketContext()
  const { trades, isLoading: tradesLoading } = useTradesSupabase()
  const { transactions, addTransaction } = useAccountTransactions()

  const [viewMode, setViewMode] = useState<ViewMode>('pnl')
  const [period, setPeriod] = useState<Period>('all')
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)

  const periodLabels: Record<Period, string> = {
    week: '7D',
    month: '1M',
    '3months': '3M',
    ytd: 'YTD',
    all: isPortuguese ? 'Tudo' : 'All',
  }

  // Trades filtered by period (P&L view only)
  const filteredTrades = useMemo(() => {
    if (viewMode === 'balance' || period === 'all') return trades
    const start = getPeriodStart(period)
    if (!start) return trades
    return trades.filter(t => new Date(t.entry_time) >= start)
  }, [trades, period, viewMode])

  // Build chart data
  const { pnlData, balanceData, currentBalance } = useMemo(() => {
    const initialBankroll = activeMarket?.bankroll.initial ?? 1000
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
    const totalDeposits = transactions
      .filter(tx => tx.type === 'deposit')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const totalWithdrawals = transactions
      .filter(tx => tx.type === 'withdrawal')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const bal = initialBankroll + totalPnl + totalDeposits - totalWithdrawals

    return {
      pnlData: buildCumulativePnlCurve(filteredTrades),
      balanceData: buildBalanceCurve(trades, transactions, bal),
      currentBalance: bal,
    }
  }, [filteredTrades, trades, transactions, activeMarket])

  const chartData = viewMode === 'pnl' ? pnlData : balanceData
  const dataKey = viewMode === 'pnl' ? 'cumulativePnl' : 'balance'

  const currentValue = viewMode === 'pnl'
    ? (pnlData[pnlData.length - 1]?.cumulativePnl ?? 0)
    : currentBalance
  const isPositive = currentValue >= 0

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', {
      month: 'short', day: 'numeric',
    })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const val = payload[0].value as number
    const dailyPnl = payload[0].payload?.dailyPnl as number | undefined
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-gray-400 text-xs font-comfortaa mb-1">{formatDate(label)}</p>
        <p className={`font-bold font-comfortaa ${val >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
          ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {viewMode === 'pnl' && dailyPnl !== undefined && (
          <p className={`text-xs font-comfortaa mt-1 ${dailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {dailyPnl >= 0 ? '+' : ''}
            ${Math.abs(dailyPnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {' '}{isPortuguese ? 'no dia' : 'that day'}
          </p>
        )}
      </div>
    )
  }

  if (isLoading || tradesLoading) {
    return (
      <div className="card">
        <div className="h-6 bg-gray-700/40 rounded mb-2 w-1/3 animate-pulse" />
        <div className="h-4 bg-gray-700/20 rounded mb-6 w-2/3 animate-pulse" />
        <div className="h-64 bg-gray-700/20 rounded animate-pulse" />
      </div>
    )
  }

  const hasData = chartData.length > 0

  return (
    <>
      <div className="card">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Account selector (only shown if multiple accounts) */}
            {marketAccounts.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowAccountDropdown(v => !v)}
                  className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white font-comfortaa hover:border-gray-600 transition-colors"
                >
                  <span>{activeMarket?.displayName ?? 'Account'}</span>
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showAccountDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[180px]">
                    {marketAccounts.map(acc => (
                      <button
                        key={acc.marketType}
                        onClick={() => {
                          setActiveMarket(acc.marketType as MarketType)
                          setShowAccountDropdown(false)
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-comfortaa hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                          activeMarket?.marketType === acc.marketType ? 'text-[#E1FFD9]' : 'text-gray-300'
                        }`}
                      >
                        <span>{acc.displayName}</span>
                        {acc.isPrimary && (
                          <span className="text-xs text-[#E1FFD9]/50 ml-2">
                            {isPortuguese ? 'PRINCIPAL' : 'PRIMARY'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* P&L / Balance toggle */}
            <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
              {(['pnl', 'balance'] as ViewMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 rounded-md text-sm font-comfortaa font-medium transition-all ${
                    viewMode === mode
                      ? 'bg-gray-700 text-white shadow'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {mode === 'pnl'
                    ? 'P&L'
                    : (isPortuguese ? 'Saldo' : 'Balance')}
                </button>
              ))}
            </div>
          </div>

          {/* Current value + add transaction */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500 font-comfortaa mb-0.5">
                {viewMode === 'pnl'
                  ? (isPortuguese ? 'P&L Total' : 'Total P&L')
                  : (isPortuguese ? 'Saldo Atual' : 'Current Balance')}
              </p>
              <p className={`text-2xl font-bold font-comfortaa tabular-nums ${isPositive ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
                {isPositive ? '' : '-'}$
                {Math.abs(currentValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <button
              onClick={() => setShowTransactionModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-600 transition-colors font-comfortaa shrink-0"
              title={isPortuguese ? 'Registrar depósito ou retirada' : 'Record deposit or withdrawal'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline text-xs">{isPortuguese ? 'Movimentação' : 'Transaction'}</span>
            </button>
          </div>
        </div>

        {/* Period filter (P&L mode only) */}
        {viewMode === 'pnl' && (
          <div className="flex gap-1 mb-4">
            {(Object.keys(periodLabels) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded-md text-xs font-comfortaa font-medium transition-all ${
                  period === p
                    ? 'bg-[#E1FFD9]/15 text-[#E1FFD9] border border-[#E1FFD9]/25'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        )}

        {/* Chart or empty state */}
        {!hasData ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-300 font-comfortaa font-medium mb-1">
              {isPortuguese ? 'Nenhuma operação ainda' : 'No trades yet'}
            </p>
            <p className="text-gray-500 text-sm font-comfortaa">
              {isPortuguese
                ? 'Importe seu histórico CSV para ver o gráfico'
                : 'Import your CSV history to see the chart'}
            </p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E1FFD9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E1FFD9" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(75,85,99,0.15)" />
                <XAxis
                  dataKey="date"
                  stroke="#4B5563"
                  fontSize={11}
                  fontFamily="Comfortaa, sans-serif"
                  tickFormatter={formatDate}
                  tick={{ fill: '#6B7280' }}
                />
                <YAxis
                  stroke="#4B5563"
                  fontSize={11}
                  fontFamily="Comfortaa, sans-serif"
                  tickFormatter={v => `$${Math.abs(v).toLocaleString('en-US', { notation: 'compact' })}`}
                  tick={{ fill: '#6B7280' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke="#E1FFD9"
                  strokeWidth={2}
                  fill="url(#colorEquity)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#E1FFD9', strokeWidth: 2, fill: '#111827' }}
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <AddTransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSubmit={async ({ type, amount, date, notes }) => {
          try {
            await addTransaction.mutateAsync({
              type,
              amount,
              transaction_date: date,
              notes,
              market_type: activeMarket?.marketType ?? 'binary',
            })
            setShowTransactionModal(false)
            showSuccess(
              isPortuguese ? 'Movimentação registrada' : 'Transaction recorded',
              isPortuguese
                ? `${type === 'deposit' ? 'Depósito' : 'Retirada'} de $${amount.toFixed(2)} registrado`
                : `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} of $${amount.toFixed(2)} recorded`
            )
          } catch (err) {
            showError(
              isPortuguese ? 'Erro ao registrar' : 'Error recording transaction',
              err instanceof Error ? err.message : 'Unknown error'
            )
          }
        }}
        isSubmitting={addTransaction.isPending}
        isPortuguese={isPortuguese}
      />
    </>
  )
}
