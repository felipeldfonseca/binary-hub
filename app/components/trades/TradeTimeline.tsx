'use client'

import React, { useMemo, useState } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { format, isToday, isYesterday, isSameDay, parseISO } from 'date-fns'
import { ptBR, enUS } from 'date-fns/locale'

interface TradeTimelineProps {
  trades: Trade[]
  loading?: boolean
  onTradeClick?: (trade: Trade) => void
  onTradeEdit?: (trade: Trade) => void
  onTradeDelete?: (tradeId: string) => void
  className?: string
}

interface GroupedTrades {
  date: string
  dateLabel: string
  trades: Trade[]
  dayStats: {
    totalTrades: number
    wins: number
    losses: number
    ties: number
    totalPnl: number
    winRate: number
  }
}

export default function TradeTimeline({
  trades,
  loading = false,
  onTradeClick,
  onTradeEdit,
  onTradeDelete,
  className = ''
}: TradeTimelineProps) {
  const { isPortuguese } = useLanguage()
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  // Group trades by date
  const groupedTrades = useMemo(() => {
    const groups: Record<string, Trade[]> = {}
    
    trades.forEach(trade => {
      const date = new Date(trade.entryTime)
      const dateKey = format(date, 'yyyy-MM-dd')
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(trade)
    })
    
    // Convert to array and sort by date (newest first)
    return Object.entries(groups)
      .map(([dateKey, dayTrades]) => {
        const date = parseISO(dateKey)
        const sortedTrades = dayTrades.sort((a, b) => 
          new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
        )
        
        // Calculate day stats
        const wins = sortedTrades.filter(t => t.result === 'win').length
        const losses = sortedTrades.filter(t => t.result === 'loss').length
        const ties = sortedTrades.filter(t => t.result === 'tie').length
        const totalPnl = sortedTrades.reduce((sum, t) => sum + t.profit, 0)
        const winRate = sortedTrades.length > 0 ? (wins / sortedTrades.length) * 100 : 0
        
        // Format date label
        let dateLabel: string
        if (isToday(date)) {
          dateLabel = isPortuguese ? 'Hoje' : 'Today'
        } else if (isYesterday(date)) {
          dateLabel = isPortuguese ? 'Ontem' : 'Yesterday'
        } else {
          dateLabel = format(date, 'EEEE, dd MMMM yyyy', {
            locale: isPortuguese ? ptBR : enUS
          })
        }
        
        return {
          date: dateKey,
          dateLabel,
          trades: sortedTrades,
          dayStats: {
            totalTrades: sortedTrades.length,
            wins,
            losses,
            ties,
            totalPnl,
            winRate
          }
        } as GroupedTrades
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [trades, isPortuguese])

  // Toggle day expansion
  const toggleDay = (dateKey: string) => {
    const newExpanded = new Set(expandedDays)
    if (newExpanded.has(dateKey)) {
      newExpanded.delete(dateKey)
    } else {
      newExpanded.add(dateKey)
    }
    setExpandedDays(newExpanded)
  }

  // Format currency
  const formatCurrency = (value: number) => {
    const symbol = isPortuguese ? 'R$' : '$'
    const sign = value >= 0 ? '+' : '-'
    return `${sign}${symbol}${Math.abs(value).toFixed(2)}`
  }

  // Format time
  const formatTime = (date: Date) => {
    const dateObj = new Date(date)
    return format(dateObj, 'HH:mm', {
      locale: isPortuguese ? ptBR : enUS
    })
  }

  // Get result classes
  const getResultClasses = (result: 'win' | 'loss' | 'tie') => {
    if (result === 'win') return 'bg-win/20 text-win border-win/30'
    if (result === 'loss') return 'bg-error/20 text-error border-error/30'
    return 'bg-neutral/20 text-neutral border-neutral/30'
  }

  const getResultIcon = (result: 'win' | 'loss' | 'tie') => {
    if (result === 'win') return '✅'
    if (result === 'loss') return '❌'
    return '➖'
  }

  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return 'text-win'
    if (pnl < 0) return 'text-error'
    return 'text-neutral'
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Loading State */}
      {loading && trades.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <p className="text-white/70">
              {isPortuguese ? 'Carregando histórico...' : 'Loading history...'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && trades.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {isPortuguese ? 'Nenhuma operação encontrada' : 'No trades found'}
            </h3>
            <p className="text-white/70">
              {isPortuguese 
                ? 'Sua linha do tempo aparecerá aqui quando você tiver operações.' 
                : 'Your timeline will appear here when you have trades.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {groupedTrades.length > 0 && (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/20"></div>
          
          {/* Timeline Items */}
          <div className="space-y-6">
            {groupedTrades.map((group, index) => {
              const isExpanded = expandedDays.has(group.date)
              const dayPnlColor = getPnlColor(group.dayStats.totalPnl)
              
              return (
                <div key={group.date} className="relative">
                  {/* Date Header */}
                  <div className="flex items-start gap-4">
                    {/* Timeline Dot */}
                    <div className={`
                      relative z-10 w-12 h-12 rounded-full border-4 border-background
                      flex items-center justify-center text-lg font-bold flex-shrink-0
                      ${group.dayStats.totalPnl > 0 
                        ? 'bg-win text-background' 
                        : group.dayStats.totalPnl < 0 
                        ? 'bg-error text-white' 
                        : 'bg-neutral text-white'
                      }
                    `}>
                      {group.dayStats.totalTrades}
                    </div>
                    
                    {/* Day Summary Card */}
                    <div
                      onClick={() => toggleDay(group.date)}
                      className="flex-1 card cursor-pointer hover:scale-105 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white text-lg">
                            {group.dateLabel}
                          </h3>
                          <p className="text-sm text-white/70">
                            {group.dayStats.totalTrades} {isPortuguese ? 'operações' : 'trades'}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <div className={`text-xl font-bold ${dayPnlColor}`}>
                            {formatCurrency(group.dayStats.totalPnl)}
                          </div>
                          <div className="text-sm text-white/70">
                            {group.dayStats.winRate.toFixed(1)}% {isPortuguese ? 'acertos' : 'win rate'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Day Stats */}
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-win"></div>
                          <span className="text-white/70">
                            {group.dayStats.wins} {isPortuguese ? 'vitórias' : 'wins'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-error"></div>
                          <span className="text-white/70">
                            {group.dayStats.losses} {isPortuguese ? 'derrotas' : 'losses'}
                          </span>
                        </div>
                        {group.dayStats.ties > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-neutral"></div>
                            <span className="text-white/70">
                              {group.dayStats.ties} {isPortuguese ? 'empates' : 'ties'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Expand/Collapse Indicator */}
                      <div className="flex justify-center mt-3">
                        <svg
                          className={`w-4 h-4 text-white/50 transform transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Trade List */}
                  {isExpanded && (
                    <div className="ml-16 mt-4 space-y-3 animate-fade-in">
                      {group.trades.map((trade, tradeIndex) => (
                        <div
                          key={trade.id}
                          onClick={() => onTradeClick?.(trade)}
                          className={`
                            relative p-4 rounded-lg border cursor-pointer
                            transition-all duration-200 hover:scale-102 hover:shadow-lg
                            ${getResultClasses(trade.result)}
                          `}
                        >
                          {/* Trade Timeline Connector */}
                          {tradeIndex < group.trades.length - 1 && (
                            <div className="absolute left-4 bottom-0 w-0.5 h-6 bg-white/10 transform translate-y-full"></div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Time */}
                              <div className="text-sm font-mono text-white/70 bg-black/20 px-2 py-1 rounded">
                                {formatTime(trade.entryTime)}
                              </div>
                              
                              {/* Asset & Direction */}
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">
                                  {trade.asset}
                                </span>
                                <span className={`text-sm font-semibold ${
                                  trade.direction === 'call' ? 'text-win' : 'text-error'
                                }`}>
                                  {trade.direction === 'call' ? '▲ CALL' : '▼ PUT'}
                                </span>
                              </div>
                              
                              {/* Amount */}
                              <span className="text-sm text-white/70">
                                ${trade.amount.toFixed(2)}
                              </span>
                              
                              {/* Timeframe */}
                              <span className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
                                {trade.timeframe}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {/* Result */}
                              <div className="flex items-center gap-1.5">
                                <span className="text-lg">
                                  {getResultIcon(trade.result)}
                                </span>
                                <span className="font-semibold">
                                  {trade.result === 'win' ? (isPortuguese ? 'VITÓRIA' : 'WIN') :
                                   trade.result === 'loss' ? (isPortuguese ? 'DERROTA' : 'LOSS') :
                                   (isPortuguese ? 'EMPATE' : 'TIE')}
                                </span>
                              </div>
                              
                              {/* Profit */}
                              <div className={`font-bold ${getPnlColor(trade.profit)}`}>
                                {formatCurrency(trade.profit)}
                              </div>
                              
                              {/* Quick Actions */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {onTradeEdit && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onTradeEdit(trade)
                                    }}
                                    className="p-1 hover:bg-white/10 rounded transition-colors"
                                    title={isPortuguese ? 'Editar' : 'Edit'}
                                  >
                                    <svg className="w-3 h-3 text-white/70" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                  </button>
                                )}
                                {onTradeDelete && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onTradeDelete(trade.id)
                                    }}
                                    className="p-1 hover:bg-error/20 rounded transition-colors"
                                    title={isPortuguese ? 'Excluir' : 'Delete'}
                                  >
                                    <svg className="w-3 h-3 text-error" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Trade Notes Preview */}
                          {trade.notes && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <p className="text-xs text-white/70 italic">
                                "{trade.notes.length > 60 ? trade.notes.substring(0, 60) + '...' : trade.notes}"
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}