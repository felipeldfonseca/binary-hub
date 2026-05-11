'use client'

import React, { useMemo, useState } from 'react'
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

interface EditBalanceModalProps {
  displayName: string
  current: number
  onSave: (value: number) => void
  onCancel: () => void
}

function EditBalanceModal({ displayName, current, onSave, onCancel }: EditBalanceModalProps) {
  const [value, setValue] = useState(current.toString())
  const parsed = parseFloat(value)
  const isValid = !isNaN(parsed) && parsed > 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onCancel}>
      <div className="card max-w-sm w-full mx-4 border border-[#E1FFD9]/20" onClick={e => e.stopPropagation()}>
        <h3 className="font-comfortaa font-bold text-white text-lg mb-1">
          Edit Starting Capital
        </h3>
        <p className="text-sm text-gray-400 font-comfortaa mb-5">
          {displayName} — enter the amount you deposited when you opened this account
        </p>
        <div className="relative mb-4">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-comfortaa">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && isValid) onSave(parsed) }}
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white font-comfortaa focus:outline-none focus:border-[#E1FFD9]/50 focus:ring-1 focus:ring-[#E1FFD9]/30"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors font-comfortaa text-sm"
          >
            Cancel
          </button>
          <button
            disabled={!isValid}
            onClick={() => onSave(parsed)}
            className="flex-1 py-2 rounded-lg bg-[#E1FFD9] text-[#2D3748] font-comfortaa font-semibold text-sm hover:bg-[#C4F5A8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AccountBalanceDisplay() {
  const { isPortuguese } = useLanguage()
  const { marketAccounts, activeMarket, setActiveMarket, updateAccountBalance } = useMarketContext()
  const [editingMarketType, setEditingMarketType] = useState<string | null>(null)

  // Fetch ALL trades once — we'll filter per-account below
  const { trades } = useTradesSupabase()
  const { transactions } = useAccountTransactions()

  const balances = useMemo(
    () =>
      marketAccounts.map(acc => {
        // Filter trades and transactions to this account only
        const accTrades = trades.filter(t => (t as typeof t & { market_type?: string | null }).market_type === acc.marketType)
        const accPnl = accTrades.reduce((s, t) => s + (t.pnl ?? 0), 0)

        const accTx = transactions.filter(tx => tx.market_type === acc.marketType)
        const deps = accTx.filter(tx => tx.type === 'deposit').reduce((s, tx) => s + tx.amount, 0)
        const wds  = accTx.filter(tx => tx.type === 'withdrawal').reduce((s, tx) => s + tx.amount, 0)

        const currentBalance = acc.bankroll.initial + accPnl + deps - wds
        return { ...acc, currentBalance, pnlChange: accPnl }
      }),
    [marketAccounts, trades, transactions]
  )

  const editingAccount = editingMarketType
    ? balances.find(a => a.marketType === editingMarketType)
    : null

  const useStrip = marketAccounts.length > 2

  // ── cards layout (1–2 accounts) ──────────────────────────────────────────
  if (!useStrip) {
    return (
      <>
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 pb-4">
          <div className="max-w-7xl mx-auto">
            <div className={`grid gap-4 ${balances.length === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2'}`}>
              {balances.map(acc => {
                const isActive = activeMarket?.marketType === acc.marketType
                const isUp = acc.pnlChange >= 0
                return (
                  <div
                    key={acc.marketType}
                    onClick={() => setActiveMarket(acc.marketType as MarketType)}
                    className={`card border cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                      isActive
                        ? 'border-[#E1FFD9]/40 shadow-[0_0_16px_rgba(225,255,217,0.08)]'
                        : 'border-[#E1FFD9]/10 hover:border-[#E1FFD9]/25'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-xs font-comfortaa font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                          {isPortuguese ? 'Saldo Atual' : 'Current Balance'}
                        </p>
                        <p className="text-xs text-gray-500 font-comfortaa">{acc.displayName}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="text-[10px] text-[#E1FFD9]/70 bg-[#E1FFD9]/10 px-2 py-0.5 rounded-full font-comfortaa">
                            {isPortuguese ? 'Ativo' : 'Active'}
                          </span>
                        )}
                        {acc.isPrimary && !isActive && (
                          <span className="text-[10px] text-[#E1FFD9]/40 bg-[#E1FFD9]/5 px-2 py-0.5 rounded-full font-comfortaa">
                            {isPortuguese ? 'Principal' : 'Primary'}
                          </span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setEditingMarketType(acc.marketType) }}
                          className="text-gray-600 hover:text-gray-300 transition-colors p-1 rounded"
                          title={isPortuguese ? 'Editar capital inicial' : 'Edit starting capital'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
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

                    <div className="mt-2 text-xs text-gray-600 font-comfortaa">
                      {isPortuguese ? 'Capital inicial:' : 'Starting capital:'} {fmt(acc.bankroll.initial)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {editingAccount && (
          <EditBalanceModal
            displayName={editingAccount.displayName}
            current={editingAccount.bankroll.initial}
            onSave={value => {
              updateAccountBalance(editingAccount.marketType as MarketType, value)
              setEditingMarketType(null)
            }}
            onCancel={() => setEditingMarketType(null)}
          />
        )}
      </>
    )
  }

  // ── pill strip layout (3+ accounts) ──────────────────────────────────────
  return (
    <>
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

                  <button
                    onClick={e => { e.stopPropagation(); setEditingMarketType(acc.marketType) }}
                    className="text-gray-600 hover:text-gray-300 transition-colors ml-1"
                    title={isPortuguese ? 'Editar capital inicial' : 'Edit starting capital'}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </button>
              )
            })}

            <span className="text-gray-700 text-lg font-light select-none">|</span>
            <div className="px-3 py-2 text-sm font-comfortaa text-gray-400">
              {isPortuguese ? 'Total:' : 'Total:'}
              {' '}
              <span className="text-white font-semibold tabular-nums">
                {fmt(balances.reduce((s, a) => s + a.currentBalance, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {editingAccount && (
        <EditBalanceModal
          displayName={editingAccount.displayName}
          current={editingAccount.bankroll.initial}
          onSave={value => {
            updateAccountBalance(editingAccount.marketType as MarketType, value)
            setEditingMarketType(null)
          }}
          onCancel={() => setEditingMarketType(null)}
        />
      )}
    </>
  )
}
