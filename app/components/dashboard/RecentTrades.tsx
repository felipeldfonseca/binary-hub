'use client'

import React, { useMemo } from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import Link from 'next/link'

interface RecentTradesProps {
  limit?: number
  isDemoMode?: boolean
}

export default function RecentTrades({ limit = 5, isDemoMode = false }: RecentTradesProps) {
  const { isPortuguese } = useLanguage()
  
  // Memoize the filters to prevent infinite loop
  const tradesFilters = useMemo(() => ({ limit }), [limit])
  const { trades, loading, error } = useTrades(tradesFilters)

  // Generate mock demo trades
  const demoTrades = useMemo(() => [
    {
      id: 'demo-1',
      userId: 'demo-user',
      tradeId: 'DEMO-001',
      asset: 'BTCUSDT',
      direction: 'call' as const,
      amount: 50,
      entryPrice: 45250.00,
      exitPrice: 45380.00,
      entryTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      exitTime: new Date(Date.now() - 4 * 60 * 1000),
      timeframe: 'M1',
      candleTime: '14:25',
      refunded: 0,
      executed: 50,
      status: 'WIN' as const,
      result: 'win' as const,
      profit: 42.50,
      payout: 92.50,
      platform: 'Demo Platform',
      strategy: 'Momentum',
      createdAt: new Date(Date.now() - 4 * 60 * 1000),
      updatedAt: new Date(Date.now() - 4 * 60 * 1000),
    },
    {
      id: 'demo-2',
      userId: 'demo-user',
      tradeId: 'DEMO-002',
      asset: 'ETHUSDT',
      direction: 'put' as const,
      amount: 35,
      entryPrice: 2845.50,
      exitPrice: 2820.75,
      entryTime: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
      exitTime: new Date(Date.now() - 14 * 60 * 1000),
      timeframe: 'M1',
      candleTime: '14:15',
      refunded: 0,
      executed: 35,
      status: 'WIN' as const,
      result: 'win' as const,
      profit: 29.75,
      payout: 64.75,
      platform: 'Demo Platform',
      strategy: 'Support/Resistance',
      createdAt: new Date(Date.now() - 14 * 60 * 1000),
      updatedAt: new Date(Date.now() - 14 * 60 * 1000),
    },
    {
      id: 'demo-3',
      userId: 'demo-user',
      tradeId: 'DEMO-003',
      asset: 'EURUSD',
      direction: 'call' as const,
      amount: 25,
      entryPrice: 1.0852,
      exitPrice: 1.0845,
      entryTime: new Date(Date.now() - 32 * 60 * 1000), // 32 minutes ago
      exitTime: new Date(Date.now() - 31 * 60 * 1000),
      timeframe: 'M1',
      candleTime: '13:58',
      refunded: 0,
      executed: 25,
      status: 'LOSE' as const,
      result: 'loss' as const,
      profit: -25.00,
      payout: 0,
      platform: 'Demo Platform',
      strategy: 'Trend Following',
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
      updatedAt: new Date(Date.now() - 31 * 60 * 1000),
    },
    {
      id: 'demo-4',
      userId: 'demo-user',
      tradeId: 'DEMO-004',
      asset: 'GBPUSD',
      direction: 'put' as const,
      amount: 40,
      entryPrice: 1.2735,
      exitPrice: 1.2710,
      entryTime: new Date(Date.now() - 58 * 60 * 1000), // 58 minutes ago
      exitTime: new Date(Date.now() - 57 * 60 * 1000),
      timeframe: 'M1',
      candleTime: '13:32',
      refunded: 0,
      executed: 40,
      status: 'WIN' as const,
      result: 'win' as const,
      profit: 34.00,
      payout: 74.00,
      platform: 'Demo Platform',
      strategy: 'News Trading',
      createdAt: new Date(Date.now() - 57 * 60 * 1000),
      updatedAt: new Date(Date.now() - 57 * 60 * 1000),
    },
    {
      id: 'demo-5',
      userId: 'demo-user',
      tradeId: 'DEMO-005',
      asset: 'USDJPY',
      direction: 'call' as const,
      amount: 30,
      entryPrice: 149.85,
      exitPrice: 150.12,
      entryTime: new Date(Date.now() - 85 * 60 * 1000), // 1h 25m ago
      exitTime: new Date(Date.now() - 84 * 60 * 1000),
      timeframe: 'M1',
      candleTime: '13:05',
      refunded: 0,
      executed: 30,
      status: 'WIN' as const,
      result: 'win' as const,
      profit: 25.50,
      payout: 55.50,
      platform: 'Demo Platform',
      strategy: 'Pattern Recognition',
      createdAt: new Date(Date.now() - 84 * 60 * 1000),
      updatedAt: new Date(Date.now() - 84 * 60 * 1000),
    }
  ], [])

  // Use demo trades when in demo mode
  const displayTrades = isDemoMode ? demoTrades : trades
  const displayLoading = isDemoMode ? false : loading
  const displayError = isDemoMode ? null : error

  // Translations
  const texts = {
    title: isPortuguese ? 'Trades Recentes' : 'Recent Trades',
    viewAll: isPortuguese ? 'Ver Todos' : 'View All',
    asset: isPortuguese ? 'Ativo' : 'Asset',
    direction: isPortuguese ? 'Direção' : 'Direction',
    amount: isPortuguese ? 'Valor' : 'Amount',
    result: isPortuguese ? 'Resultado' : 'Result',
    pnl: isPortuguese ? 'P&L' : 'P&L',
    time: isPortuguese ? 'Tempo' : 'Time',
    call: isPortuguese ? 'Compra' : 'Call',
    put: isPortuguese ? 'Venda' : 'Put',
    win: isPortuguese ? 'Vitória' : 'Win',
    loss: isPortuguese ? 'Perda' : 'Loss',
    tie: isPortuguese ? 'Empate' : 'Tie',
    noTrades: isPortuguese ? 'Nenhum trade encontrado' : 'No trades found',
    addFirst: isPortuguese ? 'Adicionar primeiro trade' : 'Add your first trade',
    ago: isPortuguese ? 'atrás' : 'ago',
    minutes: isPortuguese ? 'min' : 'min',
    hours: isPortuguese ? 'h' : 'h',
    days: isPortuguese ? 'd' : 'd'
  }

  // Format relative time
  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) return `${diffDays}${texts.days} ${texts.ago}`
    if (diffHours > 0) return `${diffHours}${texts.hours} ${texts.ago}`
    if (diffMinutes > 0) return `${diffMinutes}${texts.minutes} ${texts.ago}`
    return isPortuguese ? 'Agora' : 'Now'
  }

  // Get result badge styling
  const getResultBadge = (result: string) => {
    switch (result) {
      case 'win':
        return {
          className: 'bg-green-500 bg-opacity-20 text-green-400 border border-green-500 border-opacity-30',
          text: texts.win
        }
      case 'loss':
        return {
          className: 'bg-red-500 bg-opacity-20 text-red-400 border border-red-500 border-opacity-30',
          text: texts.loss
        }
      case 'tie':
        return {
          className: 'bg-gray-500 bg-opacity-20 text-gray-400 border border-gray-500 border-opacity-30',
          text: texts.tie
        }
      default:
        return {
          className: 'bg-gray-500 bg-opacity-20 text-gray-400 border border-gray-500 border-opacity-30',
          text: result
        }
    }
  }

  // Get direction styling
  const getDirectionBadge = (direction: string) => {
    return direction === 'call' 
      ? {
          className: 'bg-blue-500 bg-opacity-20 text-blue-400',
          text: texts.call,
          icon: '↗'
        }
      : {
          className: 'bg-orange-500 bg-opacity-20 text-orange-400',
          text: texts.put,
          icon: '↘'
        }
  }

  // Loading skeleton
  if (displayLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 bg-gray-200 bg-opacity-20 rounded w-1/3 animate-pulse"></div>
          <div className="h-6 bg-gray-200 bg-opacity-20 rounded w-20 animate-pulse"></div>
        </div>
        
        <div className="space-y-4">
          {[...Array(limit)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-200 bg-opacity-10 rounded-lg animate-pulse">
              <div className="h-10 w-10 bg-gray-200 bg-opacity-20 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 bg-opacity-20 rounded w-1/2"></div>
                <div className="h-3 bg-gray-200 bg-opacity-20 rounded w-1/3"></div>
              </div>
              <div className="h-6 w-16 bg-gray-200 bg-opacity-20 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (displayError) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-comfortaa font-semibold text-white">
            {texts.title}
          </h3>
        </div>
        
        <div className="text-center py-8">
          <div className="text-red-400 text-lg mb-2">⚠️</div>
          <p className="text-red-400 font-comfortaa text-sm">{displayError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card relative">
      {/* Demo Mode Badge */}
      {isDemoMode && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="bg-orange-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold font-comfortaa shadow-lg">
            {isPortuguese ? 'MODO DEMO' : 'DEMO MODE'}
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-comfortaa font-semibold text-white">
          {texts.title}
        </h3>
        <Link 
          href="/trades"
          className="text-[#E1FFD9] hover:text-white text-sm font-comfortaa font-medium transition-colors"
        >
          {texts.viewAll} →
        </Link>
      </div>

      {/* Trades list */}
      {displayTrades.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-4">📊</div>
          <p className="text-gray-400 font-comfortaa mb-4">{texts.noTrades}</p>
          <Link
            href="/trades"
            className="btn-primary inline-block text-sm px-6 py-2"
          >
            {texts.addFirst}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTrades.slice(0, limit).map((trade) => {
            const resultBadge = getResultBadge(trade.result)
            const directionBadge = getDirectionBadge(trade.direction)
            
            return (
              <div
                key={trade.id}
                className="flex items-center gap-4 p-4 bg-gray-800 bg-opacity-30 rounded-lg border border-gray-700 hover:bg-opacity-50 transition-all duration-200 cursor-pointer group"
              >
                {/* Asset icon */}
                <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                  <span className="text-white font-bold text-sm">
                    {trade.asset.substring(0, 3)}
                  </span>
                </div>

                {/* Trade details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-comfortaa font-semibold">
                      {trade.asset}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${directionBadge.className}`}>
                      {directionBadge.icon} {directionBadge.text}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>${trade.amount.toLocaleString()}</span>
                    <span>{getRelativeTime(trade.entryTime)}</span>
                  </div>
                </div>

                {/* Result and P&L */}
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold mb-1 ${resultBadge.className}`}>
                    {resultBadge.text}
                  </div>
                  <div className={`text-sm font-bold ${
                    trade.profit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
                  </div>
                </div>

                {/* Hover arrow */}
                <div className="text-gray-500 group-hover:text-[#E1FFD9] transition-colors">
                  →
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick stats */}
      {displayTrades.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400 font-comfortaa mb-1">
                {isPortuguese ? 'Últimos 5' : 'Last 5'}
              </div>
              <div className="text-lg font-bold text-white">
                {Math.min(displayTrades.length, limit)}
              </div>
            </div>
            
            <div>
              <div className="text-xs text-gray-400 font-comfortaa mb-1">
                {isPortuguese ? 'Vitórias' : 'Wins'}
              </div>
              <div className="text-lg font-bold text-green-400">
                {displayTrades.slice(0, limit).filter(t => t.result === 'win').length}
              </div>
            </div>
            
            <div>
              <div className="text-xs text-gray-400 font-comfortaa mb-1">
                {texts.pnl}
              </div>
              <div className={`text-lg font-bold ${
                displayTrades.slice(0, limit).reduce((sum, t) => sum + t.profit, 0) >= 0 
                  ? 'text-green-400' 
                  : 'text-red-400'
              }`}>
                ${displayTrades.slice(0, limit).reduce((sum, t) => sum + t.profit, 0).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}