'use client'

import React, { useMemo } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'
import { useAccountTransactions } from '@/hooks/useAccountTransactions'
import type { MarketType } from '@/types/markets'

const MARKET_ICONS: Record<string, string> = {
  binary: '⬡',
  forex: '₤',
  crypto: '₿',
  futures: '📈',
  options: '◎',
}

function fmt(n: number) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AccountBalanceDisplay() {
  const { isPortuguese } = useLanguage()
  const { marketAccounts, activeMarket, setActiveMarket } = useMarketContext()

  // trades/transactions default to [] while loading — cards render immediately
  // from initialBankroll and update in place when data arrives
  const { trades } = useTradesSupabase()
  const { transactions } = useAccountTransactions()

  const totalPnl = useMemo(
    () => trades.reduce((s, t) => s + (t.pnl ?? 0), 0),
    [trades]
  )

  const balances = useMemo(
    () =>
      marketAccounts.map(acc => {
        const accTx = transactions.filter(tx => tx.market_type === acc.marketType)
        const deps = accTx.filter(tx => tx.type === 'deposit').reduce((s, tx) => s + tx.amount, 0)
        const wds  = accTx.filter(tx => tx.type === 'withdrawal').reduce((s, tx) => s + tx.amount, 0)
        // While loading, currentBalance = initialBankroll (no trades factored in yet)
        const currentBalance = acc.bankroll.initial + totalPnl + deps - wds
        return { ...acc, currentBalance, pnlChange: totalPnl }
      }),
    [marketAccounts, transactions, totalPnl]
  )

  const useStrip = marketAccounts.length > 2

  // ── cards layout (1–2 accounts) ──────────────────────────────────────────
  if (!useStrip) {
    return (
      <div className="container mx-auto px-4 sm:px-8 lg:px-12 pb-4">
        <div className="max-w-7xl mx-auto">
          <div className={`grid gap-4 ${balances.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2'}`}>
            {balances.map(acc => {
              const isUp = acc.pnlChange >= 0
              return (
                <div
                  key={acc.marketType}
                  className="card border border-[#E1FFD9]/10 hover:border-[#E1FFD9]/25 hover:scale-[1.02] transition-all duration-200"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-comfortaa font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                        {isPortuguese ? 'Saldo Atual' : 'Current Balance'}
                      </p>
                      <p className="text-xs text-gray-600 font-comfortaa">{acc.displayName}</p>
                    </div>
                    {acc.isPrimary && (
                      <span className="text-[10px] text-[#E1FFD9]/50 bg-[#E1FFD9]/10 px-2 py-0.5 rounded-full font-comfortaa">
                        {isPortuguese ? 'Principal' : 'Primary'}
                      </span>
                    )}
                  </div>

                  <p className={`text-3xl font-bold font-comfortaa tabular-nums ${isUp ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
                    {isUp ? '' : '-'}{fmt(acc.currentBalance)}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-sm font-comfortaa font-medium ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                      {isUp ? '↗ +' : '↘ -'}{fmt(acc.pnlChange)}
                    </span>
                    <span className="text-xs text-gray-600">
                      {isPortuguese ? 'P&L total' : 'total P&L'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── pill strip layout (3+ accounts) ──────────────────────────────────────
  return (
    <div className="container mx-auto px-4 sm:px-8 lg:px-12 pb-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 flex-wrap">
          {balances.map(acc => {
            const isActive = activeMarket?.marketType === acc.marketType
            const isUp = acc.pnlChange >= 0
            const icon = MARKET_ICONS[acc.marketType] ?? '◆'

            return (
              <button
                key={acc.marketType}
                onClick={() => setActiveMarket(acc.marketType as MarketType)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? 'bg-[#E1FFD9]/10 border-[#E1FFD9]/30 shadow-[0_0_12px_rgba(225,255,217,0.08)]'
                    : 'bg-gray-800/60 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-base ${isActive ? 'text-[#E1FFD9]' : 'text-gray-500'}`}>{icon}</span>
                  <span className={`text-sm font-comfortaa font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                    {acc.displayName}
                  </span>
                  {acc.isPrimary && (
                    <span className="text-[10px] text-[#E1FFD9]/40 font-comfortaa ml-0.5">
                      {isPortuguese ? 'principal' : 'primary'}
                    </span>
                  )}
                </div>

                <span className="text-gray-700">·</span>

                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm font-bold font-comfortaa tabular-nums ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {fmt(acc.currentBalance)}
                  </span>
                  <span className={`text-xs font-comfortaa ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '+' : '-'}{fmt(acc.pnlChange)}
                  </span>
                </div>
              </button>
            )
          })}

          {(
            <>
              <span className="text-gray-700 text-lg font-light select-none">|</span>
              <div className="px-3 py-2 text-sm font-comfortaa text-gray-400">
                {isPortuguese ? 'Total:' : 'Total:'}
                {' '}
                <span className="text-white font-semibold tabular-nums">
                  {fmt(balances.reduce((s, a) => s + a.currentBalance, 0))}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
