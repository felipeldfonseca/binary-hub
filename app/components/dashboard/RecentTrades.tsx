'use client'

import React, { useMemo } from 'react'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import Link from 'next/link'

interface RecentTradesProps {
  limit?: number
}

export default function RecentTrades({ limit = 5 }: RecentTradesProps) {
  const { isPortuguese } = useLanguage()
  const { activeMarket } = useMarketContext()

  const accountFilter = useMemo(
    () => activeMarket?.marketType ? { marketType: activeMarket.marketType } : undefined,
    [activeMarket?.marketType],
  )

  const { trades: rawTrades, isLoading, error } = useTradesSupabase(accountFilter)

  // Sort by most recent, take `limit`
  const displayTrades = useMemo(
    () =>
      [...rawTrades]
        .sort((a, b) => new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime())
        .slice(0, limit),
    [rawTrades, limit],
  )

  const texts = {
    title:     isPortuguese ? 'Operações Recentes' : 'Recent Trades',
    viewAll:   isPortuguese ? 'Ver Todos' : 'View All',
    call:      isPortuguese ? 'Compra' : 'Call',
    put:       isPortuguese ? 'Venda' : 'Put',
    long:      isPortuguese ? 'Long' : 'Long',
    short:     isPortuguese ? 'Short' : 'Short',
    win:       isPortuguese ? 'Vitória' : 'Win',
    loss:      isPortuguese ? 'Perda' : 'Loss',
    tie:       isPortuguese ? 'Empate' : 'Tie',
    noTrades:  isPortuguese ? 'Nenhuma operação encontrada' : 'No trades found',
    addFirst:  isPortuguese ? 'Importar operações' : 'Import trades',
    pnl:       'P&L',
    wins:      isPortuguese ? 'Vitórias' : 'Wins',
    last:      isPortuguese ? `Últimos ${limit}` : `Last ${limit}`,
    ago:       isPortuguese ? 'atrás' : 'ago',
    min:       isPortuguese ? 'min' : 'min',
    h:         'h',
    d:         'd',
  }

  const getRelativeTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffH   = Math.floor(diffMin / 60)
    const diffD   = Math.floor(diffH / 24)
    if (diffD  > 0) return `${diffD}${texts.d} ${texts.ago}`
    if (diffH  > 0) return `${diffH}${texts.h} ${texts.ago}`
    if (diffMin > 0) return `${diffMin}${texts.min} ${texts.ago}`
    return isPortuguese ? 'Agora' : 'Now'
  }

  const getResultBadge = (result: string | null) => {
    switch (result) {
      case 'win':        return { className: 'bg-green-500/20 text-green-400 border border-green-500/30', text: texts.win }
      case 'loss':       return { className: 'bg-red-500/20 text-red-400 border border-red-500/30',   text: texts.loss }
      case 'breakeven':  return { className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30', text: texts.tie }
      default:           return { className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30', text: result ?? '—' }
    }
  }

  const getDirectionBadge = (direction: string | null) => {
    switch (direction) {
      case 'call':  return { className: 'bg-blue-500/20 text-blue-400',   text: texts.call,  icon: '↗' }
      case 'put':   return { className: 'bg-orange-500/20 text-orange-400', text: texts.put,  icon: '↘' }
      case 'long':  return { className: 'bg-blue-500/20 text-blue-400',   text: texts.long,  icon: '↗' }
      case 'short': return { className: 'bg-orange-500/20 text-orange-400', text: texts.short, icon: '↘' }
      default:      return { className: 'bg-gray-500/20 text-gray-400',   text: direction ?? '—', icon: '→' }
    }
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-white/10 rounded w-1/3 animate-pulse" />
          <div className="h-6 bg-white/10 rounded w-20 animate-pulse" />
        </div>
        <div className="space-y-4">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-lg animate-pulse">
              <div className="h-10 w-10 bg-white/10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-1/2" />
                <div className="h-3 bg-white/10 rounded w-1/3" />
              </div>
              <div className="h-6 w-16 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <h3 className="text-xl font-comfortaa font-semibold text-white mb-4">{texts.title}</h3>
        <p className="text-red-400 text-sm font-comfortaa">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-comfortaa font-semibold text-white">{texts.title}</h3>
        <Link href="/trades" className="text-primary hover:text-white text-sm font-comfortaa font-medium transition-colors">
          {texts.viewAll} →
        </Link>
      </div>

      {displayTrades.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400 font-comfortaa mb-4">{texts.noTrades}</p>
          <Link href="/trades" className="btn-primary inline-block text-sm px-6 py-2">
            {texts.addFirst}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayTrades.map(trade => {
              const resultBadge    = getResultBadge(trade.result)
              const directionBadge = getDirectionBadge(trade.direction)
              const profit         = trade.pnl ?? 0

              return (
                <div
                  key={trade.id}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/5 transition-all duration-200 cursor-pointer group hover:bg-white/10"
                >
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">
                      {trade.symbol.substring(0, 3)}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-comfortaa font-semibold truncate">{trade.symbol}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${directionBadge.className}`}>
                        {directionBadge.icon} {directionBadge.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>${(trade.stake_amount ?? 0).toLocaleString()}</span>
                      <span>{getRelativeTime(trade.entry_time)}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`px-3 py-0.5 rounded-full text-xs font-semibold mb-1 ${resultBadge.className}`}>
                      {resultBadge.text}
                    </div>
                    <div className={`text-sm font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-gray-500 group-hover:text-primary transition-colors">→</div>
                </div>
              )
            })}
          </div>

          {/* Quick stats footer */}
          <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400 font-comfortaa mb-1">{texts.last}</div>
              <div className="text-lg font-bold text-white">{displayTrades.length}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-comfortaa mb-1">{texts.wins}</div>
              <div className="text-lg font-bold text-green-400">
                {displayTrades.filter(t => t.result === 'win').length}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-comfortaa mb-1">{texts.pnl}</div>
              <div className={`text-lg font-bold ${
                displayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${displayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0).toFixed(2)}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
