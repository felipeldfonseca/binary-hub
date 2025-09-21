'use client'

import React from 'react'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface StreakData {
  current: {
    type: 'win' | 'loss' | 'none'
    count: number
    trades: Array<{
      id: string
      result: 'win' | 'loss' | 'tie'
      profit: number
      exitTime: Date
    }>
  }
  records: {
    maxWinStreak: number
    maxLossStreak: number
    totalWinStreaks: number
    totalLossStreaks: number
  }
  recent: Array<{
    type: 'win' | 'loss' | 'tie'
    count: number
    startDate: Date
    endDate: Date
  }>
}

export default function StreakTracker() {
  const { trades, loading } = useTrades()
  const { isPortuguese } = useLanguage()

  const calculateStreaks = (): StreakData => {
    if (!trades || trades.length === 0) {
      return {
        current: { type: 'none', count: 0, trades: [] },
        records: { maxWinStreak: 0, maxLossStreak: 0, totalWinStreaks: 0, totalLossStreaks: 0 },
        recent: []
      }
    }

    // Sort trades by exit time (most recent first)
    const sortedTrades = [...trades].sort((a, b) => 
      new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
    )

    // Calculate current streak
    let currentStreak: StreakData['current'] = { type: 'none', count: 0, trades: [] }
    if (sortedTrades.length > 0) {
      const streakTrades = []
      let streakType: 'win' | 'loss' | 'tie' = sortedTrades[0].result
      
      for (const trade of sortedTrades) {
        if (trade.result === streakType && trade.result !== 'tie') {
          streakTrades.push({
            id: trade.id,
            result: trade.result,
            profit: trade.profit,
            exitTime: new Date(trade.exitTime)
          })
        } else {
          break
        }
      }
      
      if (streakType !== 'tie' && streakTrades.length > 0) {
        currentStreak = {
          type: streakType,
          count: streakTrades.length,
          trades: streakTrades
        }
      }
    }

    // Calculate records and streaks
    let maxWinStreak = 0
    let maxLossStreak = 0
    let totalWinStreaks = 0
    let totalLossStreaks = 0
    
    let currentWinCount = 0
    let currentLossCount = 0
    
    // Process trades in chronological order for streak calculation
    const chronologicalTrades = [...sortedTrades].reverse()
    
    for (const trade of chronologicalTrades) {
      if (trade.result === 'win') {
        currentWinCount++
        if (currentLossCount > 0) {
          if (currentLossCount > maxLossStreak) maxLossStreak = currentLossCount
          if (currentLossCount >= 2) totalLossStreaks++
          currentLossCount = 0
        }
      } else if (trade.result === 'loss') {
        currentLossCount++
        if (currentWinCount > 0) {
          if (currentWinCount > maxWinStreak) maxWinStreak = currentWinCount
          if (currentWinCount >= 2) totalWinStreaks++
          currentWinCount = 0
        }
      } else {
        // Tie - reset both counters
        if (currentWinCount > 0) {
          if (currentWinCount > maxWinStreak) maxWinStreak = currentWinCount
          if (currentWinCount >= 2) totalWinStreaks++
          currentWinCount = 0
        }
        if (currentLossCount > 0) {
          if (currentLossCount > maxLossStreak) maxLossStreak = currentLossCount
          if (currentLossCount >= 2) totalLossStreaks++
          currentLossCount = 0
        }
      }
    }
    
    // Handle final streaks
    if (currentWinCount > maxWinStreak) maxWinStreak = currentWinCount
    if (currentWinCount >= 2) totalWinStreaks++
    if (currentLossCount > maxLossStreak) maxLossStreak = currentLossCount
    if (currentLossCount >= 2) totalLossStreaks++

    return {
      current: currentStreak,
      records: { maxWinStreak, maxLossStreak, totalWinStreaks, totalLossStreaks },
      recent: [] // Could be implemented to show recent streak history
    }
  }

  const streakData = calculateStreaks()

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
            {isPortuguese ? 'Rastreador de Sequências' : 'Streak Tracker'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-16 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const getStreakEmoji = (type: 'win' | 'loss' | 'none', count: number) => {
    if (type === 'none') return '😐'
    if (type === 'win') {
      if (count >= 10) return '🚀'
      if (count >= 5) return '🔥'
      if (count >= 3) return '✨'
      return '💚'
    }
    if (type === 'loss') {
      if (count >= 5) return '😵'
      if (count >= 3) return '😰'
      return '🔴'
    }
    return '😐'
  }

  const getStreakMessage = (type: 'win' | 'loss' | 'none', count: number) => {
    if (type === 'none') {
      return isPortuguese 
        ? 'Nenhuma sequência ativa' 
        : 'No active streak'
    }
    
    if (type === 'win') {
      if (count >= 10) {
        return isPortuguese 
          ? 'Você está em chamas! 🔥' 
          : 'You\'re on fire! 🔥'
      }
      if (count >= 5) {
        return isPortuguese 
          ? 'Sequência impressionante!' 
          : 'Impressive streak!'
      }
      if (count >= 3) {
        return isPortuguese 
          ? 'Continue assim!' 
          : 'Keep it up!'
      }
      return isPortuguese 
        ? 'Bom começo!' 
        : 'Good start!'
    }
    
    if (count >= 5) {
      return isPortuguese 
        ? 'Hora de revisar sua estratégia' 
        : 'Time to review your strategy'
    }
    if (count >= 3) {
      return isPortuguese 
        ? 'Mantenha a calma e foque' 
        : 'Stay calm and focus'
    }
    return isPortuguese 
      ? 'Você pode se recuperar!' 
      : 'You can bounce back!'
  }

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <h2 className="font-comfortaa font-bold text-2xl mb-6 text-primary">
          {isPortuguese ? 'Rastreador de Sequências' : 'Streak Tracker'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Current Streak */}
          <div className={`card text-center ${
            streakData.current.type === 'win' 
              ? 'bg-gradient-to-br from-green-500/20 to-primary/20 border-primary/30' 
              : streakData.current.type === 'loss'
              ? 'bg-gradient-to-br from-red-500/20 to-red-400/20 border-red-400/30'
              : ''
          }`}>
            <div className="text-6xl mb-4">
              {getStreakEmoji(streakData.current.type, streakData.current.count)}
            </div>
            <h3 className="font-comfortaa font-bold text-xl mb-2 text-primary">
              {isPortuguese ? 'Sequência Atual' : 'Current Streak'}
            </h3>
            <div className="text-4xl font-bold mb-2 text-white">
              {streakData.current.count}
            </div>
            <div className="text-sm text-gray-300 mb-3">
              {streakData.current.type === 'win' && (
                <span className="text-green-400">
                  {isPortuguese ? 'Vitórias' : 'Wins'}
                </span>
              )}
              {streakData.current.type === 'loss' && (
                <span className="text-red-400">
                  {isPortuguese ? 'Perdas' : 'Losses'}
                </span>
              )}
              {streakData.current.type === 'none' && (
                <span className="text-gray-400">
                  {isPortuguese ? 'Nenhuma' : 'None'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {getStreakMessage(streakData.current.type, streakData.current.count)}
            </p>
          </div>

          {/* Max Win Streak */}
          <div className="card text-center">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="font-comfortaa font-bold text-lg mb-2 text-primary">
              {isPortuguese ? 'Melhor Sequência' : 'Best Win Streak'}
            </h3>
            <div className="text-3xl font-bold mb-2 text-green-400">
              {streakData.records.maxWinStreak}
            </div>
            <div className="text-sm text-gray-400">
              {isPortuguese ? 'vitórias consecutivas' : 'consecutive wins'}
            </div>
            {streakData.records.maxWinStreak >= 5 && (
              <div className="mt-2 text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                {isPortuguese ? 'Excelente!' : 'Excellent!'}
              </div>
            )}
          </div>

          {/* Streak Statistics */}
          <div className="card text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="font-comfortaa font-bold text-lg mb-2 text-primary">
              {isPortuguese ? 'Estatísticas' : 'Streak Stats'}
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  {isPortuguese ? 'Sequências de vitória:' : 'Win streaks:'}
                </span>
                <span className="font-semibold text-green-400">
                  {streakData.records.totalWinStreaks}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  {isPortuguese ? 'Sequências de perda:' : 'Loss streaks:'}
                </span>
                <span className="font-semibold text-red-400">
                  {streakData.records.totalLossStreaks}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">
                  {isPortuguese ? 'Pior sequência:' : 'Worst streak:'}
                </span>
                <span className="font-semibold text-gray-300">
                  {streakData.records.maxLossStreak}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trades Visualization */}
        {streakData.current.trades.length > 0 && (
          <div className="card">
            <h3 className="font-comfortaa font-semibold text-lg mb-4 text-center">
              {isPortuguese ? 'Sequência Atual em Detalhes' : 'Current Streak Details'}
            </h3>
            
            <div className="flex justify-center items-center gap-2 mb-4 overflow-x-auto pb-2">
              {streakData.current.trades.slice(0, 10).reverse().map((trade, index) => (
                <div
                  key={trade.id}
                  className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-transform hover:scale-110 ${
                    trade.result === 'win' 
                      ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' 
                      : 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                  }`}
                  title={`${trade.result === 'win' ? 'Win' : 'Loss'}: $${trade.profit.toFixed(2)}`}
                >
                  {trade.result === 'win' ? '✓' : '✗'}
                </div>
              ))}
              
              {streakData.current.trades.length > 10 && (
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center text-xs text-gray-300">
                  +{streakData.current.trades.length - 10}
                </div>
              )}
            </div>
            
            <div className="text-center text-sm text-gray-400">
              {isPortuguese ? 'Trades mais recentes primeiro' : 'Most recent trades first'}
            </div>
          </div>
        )}

        {/* Streak Tips */}
        <div className="mt-8">
          <div className="card bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-400/20">
            <h3 className="font-comfortaa font-semibold text-lg mb-3 text-purple-400 text-center">
              {isPortuguese ? '💡 Dicas para Sequências' : '💡 Streak Tips'}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="text-gray-300">
                <strong className="text-green-400">
                  {isPortuguese ? 'Para manter sequências de vitória:' : 'To maintain win streaks:'}
                </strong>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {isPortuguese ? 'Mantenha sua disciplina' : 'Stick to your discipline'}</li>
                  <li>• {isPortuguese ? 'Não aumente o risco' : 'Don\'t increase risk'}</li>
                  <li>• {isPortuguese ? 'Celebre, mas não se empolge' : 'Celebrate, but stay focused'}</li>
                </ul>
              </div>
              
              <div className="text-gray-300">
                <strong className="text-red-400">
                  {isPortuguese ? 'Para quebrar sequências de perda:' : 'To break loss streaks:'}
                </strong>
                <ul className="mt-2 space-y-1 text-gray-400">
                  <li>• {isPortuguese ? 'Revise sua estratégia' : 'Review your strategy'}</li>
                  <li>• {isPortuguese ? 'Reduza o tamanho das posições' : 'Reduce position sizes'}</li>
                  <li>• {isPortuguese ? 'Considere uma pausa' : 'Consider taking a break'}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}