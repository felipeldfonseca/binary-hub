'use client'
import React, { useState, useMemo, useCallback } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  BarChart2, ArrowLeftRight, Coins, TrendingUp, TrendingDown, Target,
  CheckCircle, AlertTriangle, Lightbulb, Shield, Brain, AlertCircle,
  StopCircle, Star, Clock, Ban,
} from 'lucide-react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import type { Trade as SupabaseTrade } from '@/types/database'

// ─── Internal trade shape ─────────────────────────────────────────────────────
interface Trade {
  id: string
  asset: string
  direction: string
  amount: number
  entryTime: Date
  result: 'win' | 'loss' | 'tie'
  profit: number
}

function adaptTrade(t: SupabaseTrade): Trade {
  return {
    id: t.id,
    asset: t.symbol,
    direction: t.direction ?? 'call',
    amount: t.stake_amount ?? 0,
    entryTime: new Date(t.entry_time),
    result: t.result === 'breakeven' ? 'tie' : (t.result ?? 'loss') as 'win' | 'loss' | 'tie',
    profit: t.pnl ?? 0,
  }
}

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'allTime'

// ─── Chart tooltips ───────────────────────────────────────────────────────────
// Defined outside the component so recharts never remounts them on re-render.
// High-contrast colours: slate-800 bg, slate-100 text.

function EquityTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: val >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 14 }}>
        {val >= 0 ? '+' : '−'}${Math.abs(val).toFixed(2)}
      </p>
    </div>
  )
}

function PnlBarTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; dataKey: string; payload: { trades?: number } }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const { value: val } = payload[0]
  const trades = payload[0].payload.trades
  return (
    <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: val >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 14 }}>
        {val >= 0 ? '+' : '−'}${Math.abs(val).toFixed(2)}
      </p>
      {trades !== undefined && (
        <p style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{trades} trades</p>
      )}
    </div>
  )
}

function AssetTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const { value: val, dataKey } = payload[0]
  return (
    <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: dataKey === 'winRate' ? (val >= 50 ? '#4ade80' : '#f87171') : dataKey === 'trades' ? '#818cf8' : (val >= 0 ? '#4ade80' : '#f87171'), fontWeight: 700, fontSize: 14 }}>
        {dataKey === 'pnl' ? `${val >= 0 ? '+' : '−'}$${Math.abs(val).toFixed(2)}` :
         dataKey === 'winRate' ? `${val}%` : `${val}`}
      </p>
    </div>
  )
}

function HourTooltip({ active, payload, label }: {
  active?: boolean; payload?: { value: number }[]; label?: string
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px' }}>
      <p style={{ color: '#94a3b8', fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: val >= 50 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 14 }}>{val}%</p>
    </div>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MARKET_ICONS: Record<string, React.ReactNode> = {
  binary:  <BarChart2 size={14} />,
  forex:   <ArrowLeftRight size={14} />,
  crypto:  <Coins size={14} />,
  futures: <TrendingUp size={14} />,
  options: <Target size={14} />,
}
// Axis label colour — light enough to read on dark card backgrounds
const AXIS_COLOR = '#cbd5e1'

// ─── Main component ───────────────────────────────────────────────────────────
export default function AnalyticsV1Professional() {
  const { isPortuguese } = useLanguage()
  const { activeMarket, marketAccounts, setActiveMarket } = useMarketContext()
  const [period, setPeriod] = useState<TimePeriod>('allTime')
  const [sortAssetBy, setSortAssetBy] = useState<'pnl' | 'winRate' | 'trades'>('pnl')

  // ── Data ─────────────────────────────────────────────────────────────────────
  const accountFilter = useMemo(
    () => activeMarket?.marketType ? { marketType: activeMarket.marketType } : undefined,
    [activeMarket?.marketType],
  )
  const { trades: rawTrades, isLoading } = useTradesSupabase(accountFilter)
  const allTrades = useMemo(() => rawTrades.map(t => adaptTrade(t as SupabaseTrade)), [rawTrades])

  // Client-side period filter — shares the React Query cache
  const dateFrom = useMemo(() => {
    const now = new Date()
    switch (period) {
      case 'daily':   { const s = new Date(now); s.setHours(0, 0, 0, 0); return s }
      case 'weekly':  { const s = new Date(now); s.setDate(now.getDate() - 7); return s }
      case 'monthly': { const s = new Date(now); s.setMonth(now.getMonth() - 1); return s }
      default: return null
    }
  }, [period])

  const trades = useMemo(
    () => dateFrom ? allTrades.filter(t => t.entryTime >= dateFrom) : allTrades,
    [allTrades, dateFrom],
  )

  // ── Core stats (expanded) ──────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = trades.length
    if (total === 0) return {
      total: 0, wins: 0, losses: 0, ties: 0,
      winRate: 0, totalPnl: 0, profitFactor: 0,
      avgWin: 0, avgLoss: 0, maxDrawdown: 0,
      stdDev: 0, bestTrade: 0, worstTrade: 0, avgStake: 0,
    }

    const wins   = trades.filter(t => t.result === 'win').length
    const losses = trades.filter(t => t.result === 'loss').length
    const ties   = total - wins - losses
    const winRate = (wins / total) * 100
    const totalPnl = trades.reduce((s, t) => s + t.profit, 0)

    const grossProfit = trades.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0)
    const grossLoss   = Math.abs(trades.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0
    const avgWin  = wins   > 0 ? grossProfit / wins   : 0
    const avgLoss = losses > 0 ? grossLoss   / losses : 0

    // Max drawdown: deepest peak-to-trough drop as % of starting capital (always 0–100%)
    const initialBalance = activeMarket?.bankroll?.initial ?? 1000
    const sorted = [...trades].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
    let cum = 0, peak = 0, maxDrawdown = 0
    sorted.forEach(t => {
      cum += t.profit
      if (cum > peak) peak = cum
      const peakBalance   = initialBalance + peak
      const troughBalance = initialBalance + cum
      const dd = peakBalance > 0
        ? Math.max(0, (peakBalance - troughBalance) / peakBalance * 100)
        : 0
      if (dd > maxDrawdown) maxDrawdown = dd
    })

    // Trade P&L std dev (consistency)
    const avgPnl = totalPnl / total
    const variance = trades.reduce((s, t) => s + Math.pow(t.profit - avgPnl, 2), 0) / total
    const stdDev = Math.sqrt(variance)

    const profits = trades.map(t => t.profit)
    const bestTrade  = Math.max(...profits)
    const worstTrade = Math.min(...profits)
    const avgStake = trades.reduce((s, t) => s + t.amount, 0) / total

    return {
      total, wins, losses, ties, winRate, totalPnl,
      profitFactor, avgWin, avgLoss, maxDrawdown,
      stdDev, bestTrade, worstTrade, avgStake,
    }
  }, [trades])

  // ── Equity curve ─────────────────────────────────────────────────────────────
  const equityData = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
    let cum = 0
    return sorted.map(t => {
      cum += t.profit
      return {
        date: t.entryTime.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { month: 'short', day: 'numeric' }),
        cumPnl: parseFloat(cum.toFixed(2)),
      }
    })
  }, [trades, isPortuguese])

  // ── P&L bars — granularity adapts to period ───────────────────────────────
  const pnlBars = useMemo(() => {
    if (!trades.length) return []
    const g: Record<string, { pnl: number; wins: number; losses: number; trades: number; sk: string }> = {}
    trades.forEach(t => {
      const d = t.entryTime
      let key: string, sk: string
      if (period === 'daily') {
        key = `${d.getHours().toString().padStart(2, '0')}h`
        sk  = d.getHours().toString().padStart(3, '0')
      } else if (period === 'weekly') {
        key = d.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        sk  = d.toISOString().slice(0, 10)
      } else if (period === 'monthly') {
        const wk = Math.ceil(d.getDate() / 7)
        const mo = d.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { month: 'short' })
        key = `${mo} W${wk}`
        sk  = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-W${wk}`
      } else {
        key = d.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', { month: 'short', year: '2-digit' })
        sk  = d.toISOString().slice(0, 7)
      }
      if (!g[key]) g[key] = { pnl: 0, wins: 0, losses: 0, trades: 0, sk }
      g[key].pnl += t.profit; g[key].trades++
      if (t.result === 'win') g[key].wins++
      else if (t.result === 'loss') g[key].losses++
    })
    return Object.entries(g)
      .sort(([, a], [, b]) => a.sk.localeCompare(b.sk))
      .map(([label, d]) => ({
        label,
        pnl:     parseFloat(d.pnl.toFixed(2)),
        winRate: d.trades > 0 ? parseFloat((d.wins / d.trades * 100).toFixed(1)) : 0,
        trades:  d.trades,
      }))
  }, [trades, period, isPortuguese])

  // ── Win/Loss donut ────────────────────────────────────────────────────────────
  const donutData = useMemo(() => [
    { name: isPortuguese ? 'Ganhos'  : 'Wins',   value: stats.wins,   color: '#4ade80' },
    { name: isPortuguese ? 'Perdas'  : 'Losses', value: stats.losses, color: '#f87171' },
    ...(stats.ties > 0
      ? [{ name: isPortuguese ? 'Empates' : 'Ties', value: stats.ties, color: '#94a3b8' }]
      : []),
  ].filter(d => d.value > 0), [stats, isPortuguese])

  // ── Asset performance ─────────────────────────────────────────────────────────
  const assetData = useMemo(() => {
    const m: Record<string, { pnl: number; wins: number; count: number }> = {}
    trades.forEach(t => {
      if (!m[t.asset]) m[t.asset] = { pnl: 0, wins: 0, count: 0 }
      m[t.asset].pnl += t.profit; m[t.asset].count++
      if (t.result === 'win') m[t.asset].wins++
    })
    return Object.entries(m)
      .map(([asset, d]) => ({
        asset:    asset.length > 14 ? asset.slice(0, 14) + '…' : asset,
        fullName: asset,
        pnl:      parseFloat(d.pnl.toFixed(2)),
        winRate:  d.count > 0 ? parseFloat((d.wins / d.count * 100).toFixed(1)) : 0,
        trades:   d.count,
      }))
      .sort((a, b) =>
        sortAssetBy === 'pnl'     ? b.pnl - a.pnl :
        sortAssetBy === 'winRate' ? b.winRate - a.winRate :
        b.trades - a.trades,
      )
      .slice(0, 12)
  }, [trades, sortAssetBy])

  // ── Hour-of-day ───────────────────────────────────────────────────────────────
  const hourData = useMemo(() => {
    const h: Record<number, { wins: number; count: number }> = {}
    trades.forEach(t => {
      const hr = t.entryTime.getHours()
      if (!h[hr]) h[hr] = { wins: 0, count: 0 }
      h[hr].count++
      if (t.result === 'win') h[hr].wins++
    })
    return Object.entries(h)
      .map(([hr, d]) => ({
        hour:    `${hr.toString().padStart(2, '0')}h`,
        trades:  d.count,
        winRate: d.count > 0 ? parseFloat((d.wins / d.count * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour))
  }, [trades])

  // ── Streak ────────────────────────────────────────────────────────────────────
  const streak = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
    if (!sorted.length) return { current: 0, type: 'neutral' as const, maxWin: 0, maxLoss: 0 }
    let maxWin = 0, maxLoss = 0, curW = 0, curL = 0
    sorted.forEach(t => {
      if      (t.result === 'win')  { curW++; curL = 0; maxWin  = Math.max(maxWin,  curW) }
      else if (t.result === 'loss') { curL++; curW = 0; maxLoss = Math.max(maxLoss, curL) }
      else                          { curW = 0; curL = 0 }
    })
    const lastResult = sorted[sorted.length - 1].result
    let current = 0
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].result === lastResult) current++
      else break
    }
    return { current, type: lastResult as 'win' | 'loss' | 'tie', maxWin, maxLoss }
  }, [trades])

  // ── Insights (dynamic, data-driven) ─────────────────────────────────────────
  const insights = useMemo(() => {
    if (!trades.length) return { strengths: [], improvements: [], recommendations: [] }

    const strengths:       { icon: React.ReactNode; text: string }[] = []
    const improvements:    { icon: React.ReactNode; text: string }[] = []
    const recommendations: { icon: React.ReactNode; text: string }[] = []

    const wr = stats.winRate
    if (wr >= 65)      strengths.push({ icon: <Target size={13} className="text-win shrink-0 mt-0.5" />, text: isPortuguese ? `Taxa de acerto excelente: ${wr.toFixed(1)}%` : `Excellent win rate: ${wr.toFixed(1)}%` })
    else if (wr >= 50) strengths.push({ icon: <CheckCircle size={13} className="text-win shrink-0 mt-0.5" />, text: isPortuguese ? `Taxa de acerto positiva: ${wr.toFixed(1)}%` : `Positive win rate: ${wr.toFixed(1)}%` })
    else               improvements.push({ icon: <AlertTriangle size={13} className="text-loss shrink-0 mt-0.5" />, text: isPortuguese ? `Taxa de acerto abaixo de 50%: ${wr.toFixed(1)}%` : `Win rate below 50%: ${wr.toFixed(1)}%` })

    if (stats.profitFactor >= 1.5)  strengths.push({ icon: <TrendingUp size={13} className="text-win shrink-0 mt-0.5" />, text: isPortuguese ? `Fator de lucro sólido: ${stats.profitFactor.toFixed(2)}` : `Strong profit factor: ${stats.profitFactor.toFixed(2)}` })
    else if (stats.profitFactor < 1 && stats.total >= 10) improvements.push({ icon: <TrendingDown size={13} className="text-loss shrink-0 mt-0.5" />, text: isPortuguese ? `Fator de lucro < 1 — perdas superam ganhos` : `Profit factor < 1 — losses outweigh gains` })

    if (stats.maxDrawdown < 15)      strengths.push({ icon: <Shield size={13} className="text-win shrink-0 mt-0.5" />, text: isPortuguese ? `Drawdown controlado: ${stats.maxDrawdown.toFixed(1)}%` : `Controlled drawdown: ${stats.maxDrawdown.toFixed(1)}%` })
    else if (stats.maxDrawdown > 30) improvements.push({ icon: <TrendingDown size={13} className="text-loss shrink-0 mt-0.5" />, text: isPortuguese ? `Drawdown alto: ${stats.maxDrawdown.toFixed(1)}% — revisar gestão de risco` : `High drawdown: ${stats.maxDrawdown.toFixed(1)}% — review risk management` })

    if (streak.maxLoss <= 3)      strengths.push({ icon: <Brain size={13} className="text-win shrink-0 mt-0.5" />, text: isPortuguese ? 'Ótimo controle emocional — sequências de perda curtas' : 'Strong emotional control — short loss streaks' })
    else if (streak.maxLoss >= 8) improvements.push({ icon: <AlertCircle size={13} className="text-loss shrink-0 mt-0.5" />, text: isPortuguese ? `Sequência máxima de perdas: ${streak.maxLoss} — revisar disciplina` : `Max loss streak of ${streak.maxLoss} — review discipline` })

    // Recommendations
    const stopAfter = Math.max(3, Math.round(streak.maxLoss * 0.6))
    recommendations.push({ icon: <StopCircle size={13} className="text-gray-300 shrink-0 mt-0.5" />, text: isPortuguese ? `Pare após ${stopAfter} perdas consecutivas` : `Stop trading after ${stopAfter} consecutive losses` })

    const bestAsset = [...assetData].filter(a => a.trades >= 5).sort((a, b) => b.winRate - a.winRate)[0]
    if (bestAsset) recommendations.push({ icon: <Star size={13} className="text-gray-300 shrink-0 mt-0.5" />, text: isPortuguese ? `${bestAsset.fullName} tem sua melhor taxa de acerto (${bestAsset.winRate}%)` : `${bestAsset.fullName} has your highest win rate (${bestAsset.winRate}%)` })

    const bestHour  = [...hourData].filter(h => h.trades >= 3).sort((a, b) => b.winRate - a.winRate)[0]
    const worstHour = [...hourData].filter(h => h.trades >= 3).sort((a, b) => a.winRate - b.winRate)[0]
    if (bestHour  && bestHour.winRate  > 60) recommendations.push({ icon: <Clock size={13} className="text-gray-300 shrink-0 mt-0.5" />, text: isPortuguese ? `Melhor horário: ${bestHour.hour} (${bestHour.winRate}% de acerto)` : `Best hour: ${bestHour.hour} (${bestHour.winRate}% win rate)` })
    if (worstHour && worstHour.winRate < 40) recommendations.push({ icon: <Ban size={13} className="text-gray-300 shrink-0 mt-0.5" />, text: isPortuguese ? `Evite operar às ${worstHour.hour} (${worstHour.winRate}% de acerto)` : `Avoid trading at ${worstHour.hour} (${worstHour.winRate}% win rate)` })

    return { strengths, improvements, recommendations }
  }, [trades, stats, streak, assetData, hourData, isPortuguese])

  // ── CSV export ────────────────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const rows = [...trades]
      .sort((a, b) => b.entryTime.getTime() - a.entryTime.getTime())
      .map(t => [t.entryTime.toISOString(), t.asset, t.direction, t.amount.toFixed(2), t.result, t.profit.toFixed(2)])
    const csv = [['Date', 'Asset', 'Direction', 'Stake', 'Result', 'P&L'], ...rows].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics_${activeMarket?.marketType ?? 'all'}_${period}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [trades, period, activeMarket?.marketType])

  const fmtPnl = (v: number) => `${v >= 0 ? '+' : '−'}$${Math.abs(v).toFixed(2)}`

  const periodTabs: { key: TimePeriod; label: string }[] = [
    { key: 'daily',   label: isPortuguese ? 'Hoje'    : 'Today'    },
    { key: 'weekly',  label: isPortuguese ? '7 Dias'  : '7 Days'   },
    { key: 'monthly', label: isPortuguese ? '30 Dias' : '30 Days'  },
    { key: 'allTime', label: isPortuguese ? 'Tudo'    : 'All Time' },
  ]

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4" />
          <p className="text-gray-400 font-comfortaa">{isPortuguese ? 'Carregando...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">

      {/* ── Page header: title + account switcher + period tabs ────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold font-heading text-white">
          {isPortuguese ? 'Análises' : 'Analytics'}
        </h1>

        <div className="flex flex-wrap items-center gap-3">
          {/* Account switcher */}
          {marketAccounts.length > 1 && <>
            <div className="flex items-center gap-1.5">
              {marketAccounts.map(acc => (
                <button
                  key={acc.marketType}
                  onClick={() => setActiveMarket(acc.marketType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeMarket?.marketType === acc.marketType
                      ? 'bg-white/20 ring-2 ring-primary/40 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {MARKET_ICONS[acc.marketType] ?? <BarChart2 size={14} />}
                  <span>{acc.displayName}</span>
                </button>
              ))}
            </div>
            <div className="w-px h-6 bg-white/20 hidden sm:block" />
          </>}

          {/* Period tabs */}
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            {periodTabs.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  period === p.key
                    ? 'bg-primary text-background shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!trades.length && (
        <div className="card text-center py-20">
          <div className="mb-4 text-gray-500 flex justify-center"><BarChart2 size={48} /></div>
          <h3 className="text-xl font-bold text-white mb-2">
            {isPortuguese ? 'Nenhuma operação neste período' : 'No trades in this period'}
          </h3>
          <p className="text-gray-400 font-comfortaa">
            {isPortuguese
              ? 'Tente outro período ou importe dados na aba Trades.'
              : 'Try a different period or import data in the Trades tab.'}
          </p>
        </div>
      )}

      {trades.length > 0 && <>

        {/* ── KPI strip ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

          <div className="card text-center">
            <div className={`text-3xl font-bold mb-1 ${stats.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
              {stats.winRate.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-comfortaa">
              {isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.wins}W · {stats.losses}L{stats.ties > 0 ? ` · ${stats.ties}T` : ''}
            </div>
          </div>

          <div className="card text-center">
            <div className={`text-3xl font-bold mb-1 ${stats.totalPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              {fmtPnl(stats.totalPnl)}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-comfortaa">Net P&L</div>
            <div className="text-xs text-gray-400 mt-1">
              {stats.total} {isPortuguese ? 'operações' : 'trades'} · avg {fmtPnl(stats.total > 0 ? stats.totalPnl / stats.total : 0)}
            </div>
          </div>

          <div className="card text-center">
            <div className={`text-3xl font-bold mb-1 ${stats.profitFactor >= 1 ? 'text-win' : 'text-loss'}`}>
              {isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-comfortaa">
              {isPortuguese ? 'Fator de Lucro' : 'Profit Factor'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              ↑${stats.avgWin.toFixed(2)} · ↓${stats.avgLoss.toFixed(2)}
            </div>
          </div>

          <div className="card text-center">
            <div className={`text-3xl font-bold mb-1 ${stats.maxDrawdown < 20 ? 'text-win' : stats.maxDrawdown < 40 ? 'text-yellow-400' : 'text-loss'}`}>
              {stats.maxDrawdown.toFixed(1)}%
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wide font-comfortaa">
              {isPortuguese ? 'Max Drawdown' : 'Max Drawdown'}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {isPortuguese ? 'Seq. atual' : 'Streak'}: {streak.current} {streak.type === 'win' ? (isPortuguese ? 'G' : 'W') : streak.type === 'loss' ? (isPortuguese ? 'P' : 'L') : ''}
            </div>
          </div>

        </div>

        {/* ── Equity curve (2/3) + Donut (1/3) ─────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-6">

          <div className="card md:col-span-2">
            <h2 className="font-heading font-bold text-white mb-6 text-lg">
              {isPortuguese ? 'Curva de Capital' : 'Equity Curve'}
            </h2>
            {equityData.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={equityData} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={stats.totalPnl >= 0 ? '#4ade80' : '#f87171'} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={stats.totalPnl >= 0 ? '#4ade80' : '#f87171'} stopOpacity={0}   />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false} axisLine={false}
                    interval={Math.max(0, Math.floor(equityData.length / 7) - 1)}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v}`}
                  />
                  <Tooltip content={<EquityTooltip />} cursor={false} />
                  <ReferenceLine y={0} stroke="#ffffff20" strokeDasharray="4 4" />
                  <Area
                    type="monotone" dataKey="cumPnl"
                    stroke={stats.totalPnl >= 0 ? '#4ade80' : '#f87171'}
                    strokeWidth={2} fill="url(#eqGrad)"
                    dot={false} activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-gray-500 font-comfortaa text-sm">
                {isPortuguese ? 'Dados insuficientes' : 'Not enough data'}
              </div>
            )}
          </div>

          {/* Donut */}
          <div className="card flex flex-col">
            <h2 className="font-heading font-bold text-white mb-4 text-lg">
              {isPortuguese ? 'Distribuição' : 'Distribution'}
            </h2>
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="relative mx-auto" style={{ width: 180, height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData} cx="50%" cy="50%"
                      innerRadius={56} outerRadius={76}
                      dataKey="value" stroke="none" paddingAngle={3}
                    >
                      {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className={`text-2xl font-bold leading-none ${stats.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
                    {stats.winRate.toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">WR</span>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-400 font-comfortaa">{d.name}</span>
                    <span className="font-bold text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── P&L by Period (1/2) + Asset Performance (1/2) ────────────────── */}
        <div className="grid md:grid-cols-2 gap-6">

          <div className="card">
            <h2 className="font-heading font-bold text-white mb-6 text-lg">
              {isPortuguese ? 'P&L por Período' : 'P&L by Period'}
            </h2>
            {pnlBars.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pnlBars} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false} axisLine={false}
                    interval={pnlBars.length > 14 ? Math.floor(pnlBars.length / 10) : 0}
                  />
                  <YAxis
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v => `$${v}`}
                  />
                  <Tooltip content={<PnlBarTooltip />} cursor={false} />
                  <ReferenceLine y={0} stroke="#ffffff18" />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {pnlBars.map((e, i) => (
                      <Cell key={i} fill={e.pnl >= 0 ? '#4ade80' : '#f87171'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">
                {isPortuguese ? 'Sem dados' : 'No data'}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading font-bold text-white text-lg">
                {isPortuguese ? 'Por Ativo' : 'By Asset'}
              </h2>
              <div className="flex gap-1 bg-white/5 rounded-lg p-1 text-xs">
                {(['pnl', 'winRate', 'trades'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => setSortAssetBy(key)}
                    className={`px-2.5 py-1 rounded transition-all font-comfortaa ${
                      sortAssetBy === key ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {key === 'pnl' ? 'P&L' : key === 'winRate' ? 'Win%' : 'Vol'}
                  </button>
                ))}
              </div>
            </div>
            {assetData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={assetData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                    tickLine={false} axisLine={false}
                    tickFormatter={v =>
                      sortAssetBy === 'pnl' ? `$${v}` :
                      sortAssetBy === 'winRate' ? `${v}%` : `${v}`
                    }
                  />
                  <YAxis
                    type="category" dataKey="asset"
                    tick={{ fill: '#e2e8f0', fontSize: 11 }}
                    tickLine={false} axisLine={false} width={88}
                  />
                  <Tooltip content={<AssetTooltip />} cursor={false} />
                  <Bar dataKey={sortAssetBy} radius={[0, 4, 4, 0]}>
                    {assetData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={
                          sortAssetBy === 'pnl'     ? (e.pnl     >= 0  ? '#4ade80' : '#f87171') :
                          sortAssetBy === 'winRate' ? (e.winRate >= 50  ? '#4ade80' : '#f87171') :
                          '#818cf8'
                        }
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-500 text-sm">
                {isPortuguese ? 'Sem dados' : 'No data'}
              </div>
            )}
          </div>

        </div>

        {/* ── Streak (1/3) + Risk metrics (1/3) + Trade stats (1/3) ─────────── */}
        <div className="grid md:grid-cols-3 gap-6">

          <div className="card">
            <h2 className="font-heading font-bold text-white mb-4 text-base">
              {isPortuguese ? 'Sequências' : 'Streaks'}
            </h2>
            <div className="space-y-3">
              {[
                { label: isPortuguese ? 'Sequência atual' : 'Current streak', value: `${streak.current} ${streak.type === 'win' ? (isPortuguese ? 'G' : 'W') : streak.type === 'loss' ? (isPortuguese ? 'P' : 'L') : '—'}`, color: streak.type === 'win' ? 'text-win' : streak.type === 'loss' ? 'text-loss' : 'text-gray-300' },
                { label: isPortuguese ? 'Melhor sequência' : 'Best win streak',  value: `${streak.maxWin}${isPortuguese ? 'G' : 'W'}`,  color: 'text-win'  },
                { label: isPortuguese ? 'Pior sequência'   : 'Worst loss streak', value: `${streak.maxLoss}${isPortuguese ? 'P' : 'L'}`, color: 'text-loss' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-400 font-comfortaa">{row.label}</span>
                  <span className={`font-bold text-sm ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-heading font-bold text-white mb-4 text-base">
              {isPortuguese ? 'Risco' : 'Risk'}
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Max Drawdown', value: `${stats.maxDrawdown.toFixed(1)}%`, color: stats.maxDrawdown < 15 ? 'text-win' : stats.maxDrawdown < 30 ? 'text-yellow-400' : 'text-loss' },
                { label: isPortuguese ? 'Desvio padrão P&L' : 'P&L Std Dev',        value: `$${stats.stdDev.toFixed(2)}`, color: 'text-gray-300' },
                { label: isPortuguese ? 'Stake médio'       : 'Avg Stake',           value: `$${stats.avgStake.toFixed(2)}`, color: 'text-gray-300' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-400 font-comfortaa">{row.label}</span>
                  <span className={`font-bold text-sm ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-heading font-bold text-white mb-4 text-base">
              {isPortuguese ? 'Extremos' : 'Extremes'}
            </h2>
            <div className="space-y-3">
              {[
                { label: isPortuguese ? 'Melhor operação' : 'Best trade',  value: fmtPnl(stats.bestTrade),  color: 'text-win'  },
                { label: isPortuguese ? 'Pior operação'   : 'Worst trade', value: fmtPnl(stats.worstTrade), color: 'text-loss' },
                { label: isPortuguese ? 'Fator de lucro'  : 'Profit factor', value: isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞', color: stats.profitFactor >= 1 ? 'text-win' : 'text-loss' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm text-gray-400 font-comfortaa">{row.label}</span>
                  <span className={`font-bold text-sm ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Hour-of-day (full width) ──────────────────────────────────────── */}
        {hourData.length > 1 && (
          <div className="card">
            <h2 className="font-heading font-bold text-white mb-1 text-lg">
              {isPortuguese ? 'Performance por Horário' : 'Performance by Hour'}
            </h2>
            <p className="text-xs text-gray-500 font-comfortaa mb-6">
              {isPortuguese
                ? 'Taxa de acerto por hora — verde ≥ 50%, vermelho < 50%'
                : 'Win rate per hour — green ≥ 50%, red < 50%'}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: AXIS_COLOR, fontSize: 11 }}
                  tickLine={false} axisLine={false}
                  tickFormatter={v => `${v}%`} domain={[0, 100]}
                />
                <Tooltip content={<HourTooltip />} cursor={false} />
                <ReferenceLine y={50} stroke="#ffffff25" strokeDasharray="4 4" />
                <Bar dataKey="winRate" radius={[4, 4, 0, 0]}>
                  {hourData.map((e, i) => (
                    <Cell key={i} fill={e.winRate >= 50 ? '#4ade80' : '#f87171'} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Insights ─────────────────────────────────────────────────────── */}
        {(insights.strengths.length > 0 || insights.improvements.length > 0) && (
          <div className="grid md:grid-cols-2 gap-6">

            <div className="card border border-win/20 bg-win/5">
              <h2 className="font-heading font-bold text-white mb-4 text-base flex items-center gap-2">
                <CheckCircle size={16} className="text-win shrink-0" />
                {isPortuguese ? 'Pontos Fortes' : 'Strengths'}
              </h2>
              <ul className="space-y-2">
                {insights.strengths.length > 0
                  ? insights.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300 font-comfortaa">
                        {s.icon}
                        {s.text}
                      </li>
                    ))
                  : <li className="text-sm text-gray-500 font-comfortaa italic">
                      {isPortuguese ? 'Continue operando para gerar insights.' : 'Keep trading to generate insights.'}
                    </li>
                }
              </ul>
            </div>

            <div className="card border border-loss/20 bg-loss/5">
              <h2 className="font-heading font-bold text-white mb-4 text-base flex items-center gap-2">
                <AlertTriangle size={16} className="text-loss shrink-0" />
                {isPortuguese ? 'Áreas de Melhoria' : 'Areas to Improve'}
              </h2>
              <ul className="space-y-2">
                {insights.improvements.length > 0
                  ? insights.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-300 font-comfortaa">
                        {s.icon}
                        {s.text}
                      </li>
                    ))
                  : <li className="text-sm text-gray-500 font-comfortaa italic">
                      {isPortuguese ? 'Nenhuma área crítica identificada.' : 'No critical areas identified.'}
                    </li>
                }
              </ul>
            </div>

          </div>
        )}

        {/* Recommendations */}
        {insights.recommendations.length > 0 && (
          <div className="card border border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-white text-base flex items-center gap-2">
                <Lightbulb size={16} className="text-primary shrink-0" />
                {isPortuguese ? 'Recomendações' : 'Recommendations'}
              </h2>
              <button
                onClick={handleExport}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white transition-all font-comfortaa"
              >
                ↓ {isPortuguese ? 'Exportar CSV' : 'Export CSV'}
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {insights.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-300 font-comfortaa bg-white/5 rounded-lg px-3 py-2">
                  {r.icon}
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        )}

      </>}
    </div>
  )
}
