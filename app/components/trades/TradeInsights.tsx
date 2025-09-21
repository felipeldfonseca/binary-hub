'use client'

import React, { useState, useMemo } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Trade } from '@/hooks/useTrades'

interface TradeInsightsProps {
  trades: Trade[]
  selectedTrade?: Trade | null
  onSelectTrade?: (trade: Trade | null) => void
}

interface Pattern {
  id: string
  name: string
  frequency: number
  winRate: number
  avgProfit: number
  description: string
  trades: Trade[]
  confidence: number
}

interface Insight {
  type: 'success' | 'warning' | 'error' | 'info'
  title: string
  description: string
  actionable: boolean
  recommendation?: string
}

export default function TradeInsights({ trades, selectedTrade, onSelectTrade }: TradeInsightsProps) {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'individual'>('overview')
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null)

  // Analyze trading patterns
  const patterns = useMemo(() => {
    if (!trades.length) return []

    const patternMap = new Map<string, Trade[]>()

    // Group trades by various patterns
    trades.forEach(trade => {
      // Time-based patterns
      const hour = new Date(trade.entryTime).getHours()
      const timePattern = hour < 8 ? 'Early Morning' : 
                         hour < 12 ? 'Morning' : 
                         hour < 17 ? 'Afternoon' : 
                         hour < 21 ? 'Evening' : 'Night'
      
      const timeKey = `time_${timePattern}`
      if (!patternMap.has(timeKey)) patternMap.set(timeKey, [])
      patternMap.get(timeKey)!.push(trade)

      // Asset patterns
      const assetKey = `asset_${trade.asset}`
      if (!patternMap.has(assetKey)) patternMap.set(assetKey, [])
      patternMap.get(assetKey)!.push(trade)

      // Strategy patterns
      if (trade.strategy) {
        const strategyKey = `strategy_${trade.strategy}`
        if (!patternMap.has(strategyKey)) patternMap.set(strategyKey, [])
        patternMap.get(strategyKey)!.push(trade)
      }

      // Direction patterns
      const directionKey = `direction_${trade.direction}`
      if (!patternMap.has(directionKey)) patternMap.set(directionKey, [])
      patternMap.get(directionKey)!.push(trade)

      // Amount patterns
      const amountRange = trade.amount <= 50 ? 'Small' :
                         trade.amount <= 200 ? 'Medium' : 'Large'
      const amountKey = `amount_${amountRange}`
      if (!patternMap.has(amountKey)) patternMap.set(amountKey, [])
      patternMap.get(amountKey)!.push(trade)
    })

    // Convert to pattern objects and filter significant patterns
    return Array.from(patternMap.entries())
      .map(([key, patternTrades]) => {
        const wins = patternTrades.filter(t => t.result === 'win').length
        const winRate = wins / patternTrades.length * 100
        const totalProfit = patternTrades.reduce((sum, t) => sum + t.profit, 0)
        const avgProfit = totalProfit / patternTrades.length

        const [type, name] = key.split('_', 2)
        
        return {
          id: key,
          name: name.replace(/([A-Z])/g, ' $1').trim(),
          frequency: patternTrades.length,
          winRate,
          avgProfit,
          description: generatePatternDescription(type, name, patternTrades, isPortuguese),
          trades: patternTrades,
          confidence: Math.min(100, (patternTrades.length / trades.length) * 100 + 
                              (Math.abs(winRate - 50) / 50) * 50)
        } as Pattern
      })
      .filter(p => p.frequency >= 3) // Only show patterns with at least 3 trades
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10) // Top 10 patterns
  }, [trades, isPortuguese])

  // Generate overall insights
  const insights = useMemo(() => {
    if (!trades.length) return []

    const insights: Insight[] = []
    const recentTrades = trades.slice(-10)
    const winRate = recentTrades.filter(t => t.result === 'win').length / recentTrades.length * 100
    const totalPnl = trades.reduce((sum, t) => sum + t.profit, 0)

    // Win rate insights
    if (winRate >= 70) {
      insights.push({
        type: 'success',
        title: isPortuguese ? 'Excelente Taxa de Acerto' : 'Excellent Win Rate',
        description: isPortuguese ? 
          `Sua taxa de acerto recente é de ${winRate.toFixed(1)}%. Continue com a estratégia atual.` :
          `Your recent win rate is ${winRate.toFixed(1)}%. Keep up with your current strategy.`,
        actionable: false
      })
    } else if (winRate < 40) {
      insights.push({
        type: 'warning',
        title: isPortuguese ? 'Taxa de Acerto Baixa' : 'Low Win Rate',
        description: isPortuguese ?
          `Sua taxa de acerto recente é de ${winRate.toFixed(1)}%. Considere revisar sua estratégia.` :
          `Your recent win rate is ${winRate.toFixed(1)}%. Consider reviewing your strategy.`,
        actionable: true,
        recommendation: isPortuguese ?
          'Analise os padrões de perdas e ajuste seu gerenciamento de risco.' :
          'Analyze loss patterns and adjust your risk management.'
      })
    }

    // Consecutive losses
    let consecutiveLosses = 0
    let maxConsecutiveLosses = 0
    for (const trade of recentTrades.reverse()) {
      if (trade.result === 'loss') {
        consecutiveLosses++
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, consecutiveLosses)
      } else {
        consecutiveLosses = 0
      }
    }

    if (maxConsecutiveLosses >= 3) {
      insights.push({
        type: 'error',
        title: isPortuguese ? 'Sequência de Perdas' : 'Losing Streak',
        description: isPortuguese ?
          `Você teve ${maxConsecutiveLosses} perdas consecutivas recentemente.` :
          `You had ${maxConsecutiveLosses} consecutive losses recently.`,
        actionable: true,
        recommendation: isPortuguese ?
          'Considere pausar e revisar sua estratégia antes de continuar.' :
          'Consider taking a break and reviewing your strategy before continuing.'
      })
    }

    // Time-based insights
    const timePerformance = trades.reduce((acc, trade) => {
      const hour = new Date(trade.entryTime).getHours()
      if (!acc[hour]) acc[hour] = { wins: 0, total: 0 }
      acc[hour].total++
      if (trade.result === 'win') acc[hour].wins++
      return acc
    }, {} as Record<number, { wins: number; total: number }>)

    const bestHour = Object.entries(timePerformance)
      .filter(([_, data]) => data.total >= 3)
      .sort(([_, a], [__, b]) => (b.wins / b.total) - (a.wins / a.total))[0]

    if (bestHour) {
      const [hour, data] = bestHour
      const winRateHour = (data.wins / data.total) * 100
      if (winRateHour >= 70) {
        insights.push({
          type: 'info',
          title: isPortuguese ? 'Melhor Horário' : 'Best Trading Time',
          description: isPortuguese ?
            `Você tem ${winRateHour.toFixed(1)}% de acerto entre ${hour}:00-${parseInt(hour)+1}:00.` :
            `You have ${winRateHour.toFixed(1)}% win rate between ${hour}:00-${parseInt(hour)+1}:00.`,
          actionable: true,
          recommendation: isPortuguese ?
            'Considere focar suas operações neste horário.' :
            'Consider focusing your trades during this time.'
        })
      }
    }

    // Asset performance insights
    const assetPerformance = trades.reduce((acc, trade) => {
      if (!acc[trade.asset]) acc[trade.asset] = { wins: 0, total: 0, profit: 0 }
      acc[trade.asset].total++
      acc[trade.asset].profit += trade.profit
      if (trade.result === 'win') acc[trade.asset].wins++
      return acc
    }, {} as Record<string, { wins: number; total: number; profit: number }>)

    const bestAsset = Object.entries(assetPerformance)
      .filter(([_, data]) => data.total >= 3)
      .sort(([_, a], [__, b]) => b.profit - a.profit)[0]

    if (bestAsset) {
      const [asset, data] = bestAsset
      if (data.profit > 0) {
        insights.push({
          type: 'success',
          title: isPortuguese ? 'Melhor Ativo' : 'Best Performing Asset',
          description: isPortuguese ?
            `${asset} é seu ativo mais rentável com $${data.profit.toFixed(2)} de lucro.` :
            `${asset} is your most profitable asset with $${data.profit.toFixed(2)} profit.`,
          actionable: true,
          recommendation: isPortuguese ?
            'Considere aumentar a exposição a este ativo.' :
            'Consider increasing exposure to this asset.'
        })
      }
    }

    return insights.slice(0, 5) // Top 5 insights
  }, [trades, isPortuguese])

  const generatePatternDescription = (type: string, name: string, trades: Trade[], isPortuguese: boolean) => {
    const winRate = trades.filter(t => t.result === 'win').length / trades.length * 100
    const avgProfit = trades.reduce((sum, t) => sum + t.profit, 0) / trades.length

    switch (type) {
      case 'time':
        return isPortuguese ?
          `Operações no período ${name} têm ${winRate.toFixed(1)}% de acerto com lucro médio de $${avgProfit.toFixed(2)}.` :
          `${name} trades have ${winRate.toFixed(1)}% win rate with average profit of $${avgProfit.toFixed(2)}.`
      case 'asset':
        return isPortuguese ?
          `${name} apresenta ${winRate.toFixed(1)}% de acerto em ${trades.length} operações.` :
          `${name} shows ${winRate.toFixed(1)}% win rate across ${trades.length} trades.`
      case 'strategy':
        return isPortuguese ?
          `A estratégia ${name} tem performance de ${winRate.toFixed(1)}% de acerto.` :
          `${name} strategy performs with ${winRate.toFixed(1)}% win rate.`
      case 'direction':
        return isPortuguese ?
          `Operações ${name.toUpperCase()} têm ${winRate.toFixed(1)}% de taxa de acerto.` :
          `${name.toUpperCase()} trades have ${winRate.toFixed(1)}% win rate.`
      case 'amount':
        return isPortuguese ?
          `Operações de valor ${name.toLowerCase()} mostram ${winRate.toFixed(1)}% de acerto.` :
          `${name.toLowerCase()} amount trades show ${winRate.toFixed(1)}% win rate.`
      default:
        return isPortuguese ?
          `Este padrão tem ${winRate.toFixed(1)}% de taxa de acerto.` :
          `This pattern has ${winRate.toFixed(1)}% win rate.`
    }
  }

  const renderInsightIcon = (type: Insight['type']) => {
    const iconClass = "w-5 h-5"
    switch (type) {
      case 'success': return <span className={`${iconClass} text-win`}>✓</span>
      case 'warning': return <span className={`${iconClass} text-warning`}>⚠</span>
      case 'error': return <span className={`${iconClass} text-loss`}>✗</span>
      case 'info': return <span className={`${iconClass} text-primary`}>ℹ</span>
    }
  }

  if (!trades.length) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-400 font-comfortaa">
          {isPortuguese ? 
            'Nenhuma operação encontrada. Adicione operações para ver insights.' :
            'No trades found. Add trades to see insights.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-poly font-bold text-white mb-2">
            {isPortuguese ? 'Insights de Trading' : 'Trading Insights'}
          </h2>
          <p className="text-gray-300 font-comfortaa">
            {isPortuguese ? 'Análise inteligente dos seus padrões' : 'Smart analysis of your patterns'}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-600">
        {[
          { key: 'overview', label: isPortuguese ? 'Visão Geral' : 'Overview' },
          { key: 'patterns', label: isPortuguese ? 'Padrões' : 'Patterns' },
          { key: 'individual', label: isPortuguese ? 'Individual' : 'Individual' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === tab.key
                ? 'text-primary border-primary'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-comfortaa">
            {isPortuguese ? 'Insights Principais' : 'Key Insights'}
          </h3>
          {insights.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-gray-400">
                {isPortuguese ? 
                  'Nenhum insight disponível no momento.' :
                  'No insights available at the moment.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className={`card border-l-4 ${
                  insight.type === 'success' ? 'border-win' :
                  insight.type === 'warning' ? 'border-warning' :
                  insight.type === 'error' ? 'border-loss' :
                  'border-primary'
                }`}>
                  <div className="flex items-start gap-3">
                    {renderInsightIcon(insight.type)}
                    <div className="flex-1">
                      <h4 className="font-bold text-white mb-1">{insight.title}</h4>
                      <p className="text-gray-300 text-sm mb-2">{insight.description}</p>
                      {insight.actionable && insight.recommendation && (
                        <div className="text-xs text-primary bg-primary/10 p-2 rounded">
                          <strong>{isPortuguese ? 'Recomendação: ' : 'Recommendation: '}</strong>
                          {insight.recommendation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'patterns' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-comfortaa">
            {isPortuguese ? 'Padrões Identificados' : 'Identified Patterns'}
          </h3>
          {patterns.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-gray-400">
                {isPortuguese ? 
                  'Nenhum padrão significativo encontrado.' :
                  'No significant patterns found.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patterns.map(pattern => (
                <div 
                  key={pattern.id} 
                  className={`card cursor-pointer transition-all hover:bg-white/15 ${
                    selectedPattern?.id === pattern.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedPattern(selectedPattern?.id === pattern.id ? null : pattern)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-white">{pattern.name}</h4>
                    <div className="text-xs text-gray-400">
                      {pattern.frequency} {isPortuguese ? 'operações' : 'trades'}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <div className={`text-lg font-bold ${pattern.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
                        {pattern.winRate.toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'Taxa' : 'Win Rate'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-lg font-bold ${pattern.avgProfit >= 0 ? 'text-win' : 'text-loss'}`}>
                        ${pattern.avgProfit.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'P&L Médio' : 'Avg P&L'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-primary">
                        {pattern.confidence.toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-400">
                        {isPortuguese ? 'Confiança' : 'Confidence'}
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-xs text-gray-300">{pattern.description}</p>
                </div>
              ))}
            </div>
          )}

          {/* Pattern Details */}
          {selectedPattern && (
            <div className="card">
              <h4 className="text-lg font-bold text-white mb-4">
                {isPortuguese ? 'Detalhes do Padrão: ' : 'Pattern Details: '}{selectedPattern.name}
              </h4>
              <div className="overflow-x-auto">
                <table className="table text-sm">
                  <thead>
                    <tr>
                      <th>{isPortuguese ? 'Data' : 'Date'}</th>
                      <th>{isPortuguese ? 'Ativo' : 'Asset'}</th>
                      <th>{isPortuguese ? 'Direção' : 'Direction'}</th>
                      <th>{isPortuguese ? 'Valor' : 'Amount'}</th>
                      <th>{isPortuguese ? 'Resultado' : 'Result'}</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPattern.trades.slice(0, 10).map(trade => (
                      <tr key={trade.id}>
                        <td>{new Date(trade.entryTime).toLocaleDateString()}</td>
                        <td>{trade.asset}</td>
                        <td>{trade.direction.toUpperCase()}</td>
                        <td>${trade.amount}</td>
                        <td>
                          <span className={trade.result === 'win' ? 'badge-win' : 'badge-loss'}>
                            {trade.result.toUpperCase()}
                          </span>
                        </td>
                        <td className={trade.profit >= 0 ? 'text-win' : 'text-loss'}>
                          ${trade.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selectedPattern.trades.length > 10 && (
                  <div className="text-center text-gray-400 text-sm mt-2">
                    {isPortuguese ? 
                      `Mostrando 10 de ${selectedPattern.trades.length} operações` :
                      `Showing 10 of ${selectedPattern.trades.length} trades`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'individual' && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white font-comfortaa">
            {isPortuguese ? 'Análise Individual' : 'Individual Analysis'}
          </h3>
          
          {/* Trade selector */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isPortuguese ? 'Selecionar Operação' : 'Select Trade'}
            </label>
            <select
              value={selectedTrade?.id || ''}
              onChange={(e) => {
                const trade = trades.find(t => t.id === e.target.value)
                onSelectTrade?.(trade || null)
              }}
              className="form-input w-full"
            >
              <option value="">
                {isPortuguese ? 'Selecione uma operação...' : 'Select a trade...'}
              </option>
              {trades.slice(0, 50).map(trade => (
                <option key={trade.id} value={trade.id}>
                  {new Date(trade.entryTime).toLocaleDateString()} - {trade.asset} {trade.direction.toUpperCase()} 
                  (${trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          {/* Individual trade analysis */}
          {selectedTrade && (
            <div className="card">
              <h4 className="text-lg font-bold text-white mb-4">
                {isPortuguese ? 'Análise da Operação' : 'Trade Analysis'}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Trade Details */}
                <div>
                  <h5 className="font-bold text-primary mb-3">
                    {isPortuguese ? 'Detalhes' : 'Details'}
                  </h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">{isPortuguese ? 'Ativo:' : 'Asset:'}</span>
                      <span className="text-white">{selectedTrade.asset}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{isPortuguese ? 'Direção:' : 'Direction:'}</span>
                      <span className="text-white">{selectedTrade.direction.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{isPortuguese ? 'Valor:' : 'Amount:'}</span>
                      <span className="text-white">${selectedTrade.amount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{isPortuguese ? 'Entrada:' : 'Entry:'}</span>
                      <span className="text-white">{selectedTrade.entryPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">{isPortuguese ? 'Saída:' : 'Exit:'}</span>
                      <span className="text-white">{selectedTrade.exitPrice}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">P&L:</span>
                      <span className={selectedTrade.profit >= 0 ? 'text-win' : 'text-loss'}>
                        ${selectedTrade.profit >= 0 ? '+' : ''}{selectedTrade.profit.toFixed(2)}
                      </span>
                    </div>
                    {selectedTrade.strategy && (
                      <div className="flex justify-between">
                        <span className="text-gray-300">{isPortuguese ? 'Estratégia:' : 'Strategy:'}</span>
                        <span className="text-white">{selectedTrade.strategy}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance Context */}
                <div>
                  <h5 className="font-bold text-primary mb-3">
                    {isPortuguese ? 'Contexto de Performance' : 'Performance Context'}
                  </h5>
                  <div className="space-y-3 text-sm">
                    {/* Similar trades performance */}
                    {(() => {
                      const similarTrades = trades.filter(t => 
                        t.asset === selectedTrade.asset && t.id !== selectedTrade.id
                      )
                      const winRate = similarTrades.length > 0 ? 
                        similarTrades.filter(t => t.result === 'win').length / similarTrades.length * 100 : 0
                      
                      return (
                        <div className="bg-dark-card p-3 rounded">
                          <div className="font-medium text-white mb-1">
                            {isPortuguese ? 'Performance no Ativo' : 'Asset Performance'}
                          </div>
                          <div className="text-gray-300">
                            {similarTrades.length} {isPortuguese ? 'operações similares' : 'similar trades'} 
                            ({winRate.toFixed(1)}% {isPortuguese ? 'de acerto' : 'win rate'})
                          </div>
                        </div>
                      )
                    })()}

                    {/* Time performance */}
                    {(() => {
                      const hour = new Date(selectedTrade.entryTime).getHours()
                      const sameTimetrades = trades.filter(t => {
                        const tradeHour = new Date(t.entryTime).getHours()
                        return tradeHour === hour && t.id !== selectedTrade.id
                      })
                      const winRate = sameTimetrades.length > 0 ?
                        sameTimetrades.filter(t => t.result === 'win').length / sameTimetrades.length * 100 : 0

                      return (
                        <div className="bg-dark-card p-3 rounded">
                          <div className="font-medium text-white mb-1">
                            {isPortuguese ? 'Performance no Horário' : 'Time Performance'}
                          </div>
                          <div className="text-gray-300">
                            {hour}:00 - {sameTimetrades.length} {isPortuguese ? 'operações' : 'trades'} 
                            ({winRate.toFixed(1)}% {isPortuguese ? 'de acerto' : 'win rate'})
                          </div>
                        </div>
                      )
                    })()}

                    {selectedTrade.notes && (
                      <div className="bg-dark-card p-3 rounded">
                        <div className="font-medium text-white mb-1">
                          {isPortuguese ? 'Observações' : 'Notes'}
                        </div>
                        <div className="text-gray-300 text-xs">
                          {selectedTrade.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}