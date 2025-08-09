'use client'

import React from 'react'
import HeroSection from '@/components/dashboard/HeroSection'
import HeroSectionPT from '@/components/dashboard/HeroSectionPT'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'

export default function DashboardV2Gamified() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('weekly')
  const { trades } = useTrades()

  // Mock gamification data
  const gamificationData = {
    level: {
      current: 7,
      name: isPortuguese ? 'Expert' : 'Expert',
      xp: 2450,
      xpToNext: 3000,
      progress: (2450 / 3000) * 100
    },
    streaks: {
      win: 5,
      current: 5,
      best: 12,
      daily: 7
    },
    badges: {
      total: 12,
      recent: [
        { id: 1, name: isPortuguese ? 'Primeira Vitória' : 'First Win', icon: '🏆', earned: true },
        { id: 2, name: isPortuguese ? '10 Vitórias' : '10 Wins', icon: '🔥', earned: true },
        { id: 3, name: isPortuguese ? 'Semana Lucrativa' : 'Profitable Week', icon: '💰', earned: true },
        { id: 4, name: isPortuguese ? 'Guru Expert' : 'Expert Guru', icon: '⭐', earned: true },
        { id: 5, name: isPortuguese ? 'Diamante' : 'Diamond Trader', icon: '💎', earned: false },
        { id: 6, name: isPortuguese ? 'Lenda' : 'Legend', icon: '👑', earned: false }
      ]
    },
    leaderboard: {
      position: 3,
      total: 150,
      competitors: [
        { rank: 1, name: 'TraderPro99', score: 3850, avatar: '🎯' },
        { rank: 2, name: 'BinaryMaster', score: 3200, avatar: '🚀' },
        { rank: 3, name: isPortuguese ? 'Você' : 'You', score: 2450, avatar: '🌟' },
        { rank: 4, name: 'CryptoKing', score: 2100, avatar: '👑' },
        { rank: 5, name: 'ForexNinja', score: 1950, avatar: '🥷' }
      ]
    },
    dailyChallenge: {
      title: isPortuguese ? 'Faça 3 trades lucrativos' : 'Make 3 profitable trades',
      progress: 2,
      target: 3,
      reward: '100 XP + 🏆',
      timeLeft: '14h 32m'
    },
    achievements: [
      { title: isPortuguese ? 'Série de Vitórias' : 'Win Streak', value: '5 trades', icon: '🔥', color: 'from-orange-500 to-red-500' },
      { title: isPortuguese ? 'Taxa de Acerto' : 'Win Rate', value: '60%', icon: '🎯', color: 'from-green-500 to-emerald-500' },
      { title: isPortuguese ? 'Lucro Total' : 'Total Profit', value: '$34.00', icon: '💰', color: 'from-yellow-500 to-amber-500' },
      { title: isPortuguese ? 'Nível Atual' : 'Current Level', value: 'Expert', icon: '⭐', color: 'from-purple-500 to-pink-500' }
    ]
  }

  // Calculate win rate for progress rings
  const winRate = stats ? (stats.winTrades / stats.totalTrades) * 100 : 60
  const profitGoal = 100 // Monthly goal in dollars
  const currentProfit = stats?.totalPnl || 34
  const profitProgress = Math.min((Math.abs(currentProfit) / profitGoal) * 100, 100)

  return (
    <>
      {/* Hero Section - Keep personalized welcome and CTA */}
      {isPortuguese ? <HeroSectionPT /> : <HeroSection />}
      
      {/* VERSION 2: GAMIFIED DASHBOARD - Gaming Experience */}
      
      {/* Level & XP Section */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                🎮 {isPortuguese ? 'Seu Progresso de Trader' : 'Your Trader Progress'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Level & XP Card */}
              <div className="card bg-gradient-to-br from-purple-800/30 to-pink-800/30 border-purple-400/30">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl">⭐</div>
                    <div>
                      <h3 className="font-heading text-2xl font-bold text-purple-300">
                        {isPortuguese ? 'Nível' : 'Level'} {gamificationData.level.current}
                      </h3>
                      <p className="text-purple-400">{gamificationData.level.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{gamificationData.level.xp.toLocaleString()} XP</p>
                    <p className="text-sm text-purple-400">
                      {(gamificationData.level.xpToNext - gamificationData.level.xp).toLocaleString()} {isPortuguese ? 'para próximo' : 'to next'}
                    </p>
                  </div>
                </div>
                
                {/* XP Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-purple-300 mb-2">
                    <span>{gamificationData.level.name}</span>
                    <span>{isPortuguese ? 'Próximo Nível' : 'Next Level'}</span>
                  </div>
                  <div className="w-full bg-purple-900/50 rounded-full h-4">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-4 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${gamificationData.level.progress}%` }}
                    ></div>
                  </div>
                  <div className="text-center mt-2 text-sm text-purple-300">
                    {gamificationData.level.progress.toFixed(1)}% {isPortuguese ? 'completo' : 'complete'}
                  </div>
                </div>
              </div>

              {/* Streak Tracker */}
              <div className="card bg-gradient-to-br from-orange-800/30 to-red-800/30 border-orange-400/30">
                <div className="text-center">
                  <div className="text-6xl mb-4">🔥</div>
                  <h3 className="font-heading text-2xl font-bold text-orange-300 mb-2">
                    {isPortuguese ? 'Série de Vitórias' : 'Win Streak'}
                  </h3>
                  <div className="text-4xl font-bold text-white mb-2">
                    {gamificationData.streaks.win}
                  </div>
                  <p className="text-orange-400 mb-4">
                    {isPortuguese ? 'trades consecutivos' : 'consecutive trades'}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-orange-900/30 rounded-lg p-3">
                      <div className="text-lg font-bold text-white">{gamificationData.streaks.best}</div>
                      <div className="text-xs text-orange-300">{isPortuguese ? 'Melhor Série' : 'Best Streak'}</div>
                    </div>
                    <div className="bg-orange-900/30 rounded-lg p-3">
                      <div className="text-lg font-bold text-white">{gamificationData.streaks.daily}</div>
                      <div className="text-xs text-orange-300">{isPortuguese ? 'Dias Ativos' : 'Active Days'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Achievement Metrics */}
      <section className="py-12 bg-dark-card/30">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4">
                🏆 {isPortuguese ? 'Conquistas Recentes' : 'Recent Achievements'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {gamificationData.achievements.map((achievement, index) => (
                <div key={index} className={`card bg-gradient-to-br ${achievement.color}/20 border-white/10 hover:scale-105 transition-all duration-300`}>
                  <div className="text-center">
                    <div className="text-4xl mb-3">{achievement.icon}</div>
                    <h3 className="font-heading text-lg font-bold mb-2">{achievement.title}</h3>
                    <div className="text-2xl font-bold text-white">{achievement.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Progress Rings & Daily Challenge */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Progress Rings */}
              <div className="card">
                <h3 className="font-heading text-2xl font-bold mb-6 flex items-center gap-2">
                  🎯 {isPortuguese ? 'Metas de Progresso' : 'Progress Goals'}
                </h3>
                
                <div className="grid grid-cols-2 gap-8">
                  {/* Win Rate Ring */}
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${winRate * 2.83} 283`}
                          className="text-green-500 transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-green-400">{Math.round(winRate)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}</p>
                  </div>
                  
                  {/* Profit Goal Ring */}
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-gray-700"
                        />
                        <circle
                          cx="50"
                          cy="50"
                          r="45"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${profitProgress * 2.83} 283`}
                          className="text-yellow-500 transition-all duration-1000"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-bold text-yellow-400">{Math.round(profitProgress)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-400">{isPortuguese ? 'Meta Mensal' : 'Monthly Goal'}</p>
                  </div>
                </div>
              </div>

              {/* Daily Challenge */}
              <div className="card bg-gradient-to-br from-blue-800/30 to-cyan-800/30 border-blue-400/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-3xl">🎊</div>
                  <h3 className="font-heading text-2xl font-bold text-blue-300">
                    {isPortuguese ? 'Desafio Diário' : 'Daily Challenge'}
                  </h3>
                </div>
                
                <div className="mb-4">
                  <p className="text-lg text-white mb-2">{gamificationData.dailyChallenge.title}</p>
                  <div className="flex items-center gap-2 text-blue-300">
                    <span>⏰</span>
                    <span className="text-sm">{gamificationData.dailyChallenge.timeLeft} {isPortuguese ? 'restantes' : 'left'}</span>
                  </div>
                </div>
                
                {/* Challenge Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-blue-300 mb-2">
                    <span>{isPortuguese ? 'Progresso' : 'Progress'}</span>
                    <span>{gamificationData.dailyChallenge.progress}/{gamificationData.dailyChallenge.target}</span>
                  </div>
                  <div className="w-full bg-blue-900/50 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-cyan-500 h-3 rounded-full transition-all duration-700"
                      style={{ width: `${(gamificationData.dailyChallenge.progress / gamificationData.dailyChallenge.target) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="bg-blue-900/30 rounded-lg p-3 text-center">
                  <div className="text-sm text-blue-300 mb-1">{isPortuguese ? 'Recompensa' : 'Reward'}</div>
                  <div className="text-lg font-bold text-white">{gamificationData.dailyChallenge.reward}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badges & Achievements */}
      <section className="py-12 bg-dark-card/30">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4">
                🏅 {isPortuguese ? 'Coleção de Badges' : 'Badge Collection'}
              </h2>
              <p className="text-gray-400">
                {gamificationData.badges.total} {isPortuguese ? 'badges conquistados' : 'badges earned'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {gamificationData.badges.recent.map((badge) => (
                <div key={badge.id} className={`card text-center transition-all duration-300 hover:scale-110 ${
                  badge.earned 
                    ? 'bg-gradient-to-br from-yellow-800/30 to-amber-800/30 border-yellow-400/30' 
                    : 'bg-gray-800/30 border-gray-600/30 opacity-50'
                }`}>
                  <div className={`text-4xl mb-2 ${badge.earned ? 'animate-pulse' : 'grayscale'}`}>
                    {badge.icon}
                  </div>
                  <p className="text-sm font-medium">{badge.name}</p>
                  {badge.earned && (
                    <div className="text-xs text-yellow-400 mt-1">✓ {isPortuguese ? 'Conquistado' : 'Earned'}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard */}
      <section className="py-12">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-4">
                🏆 {isPortuguese ? 'Ranking Semanal' : 'Weekly Leaderboard'}
              </h2>
              <p className="text-gray-400">
                {isPortuguese ? 'Você está em' : 'You are ranked'} #{gamificationData.leaderboard.position} {isPortuguese ? 'de' : 'of'} {gamificationData.leaderboard.total}
              </p>
            </div>
            
            <div className="card">
              <div className="space-y-4">
                {gamificationData.leaderboard.competitors.map((competitor, index) => (
                  <div key={competitor.rank} className={`flex items-center justify-between p-4 rounded-lg transition-all duration-300 ${
                    competitor.rank === 3 
                      ? 'bg-gradient-to-r from-purple-800/30 to-pink-800/30 border border-purple-400/30' 
                      : 'bg-gray-800/30 hover:bg-gray-700/30'
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl font-bold w-8 text-center ${
                        competitor.rank === 1 ? 'text-yellow-400' :
                        competitor.rank === 2 ? 'text-gray-300' :
                        competitor.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {competitor.rank === 1 ? '🥇' :
                         competitor.rank === 2 ? '🥈' :
                         competitor.rank === 3 ? '🥉' : `#${competitor.rank}`}
                      </div>
                      <div className="text-2xl">{competitor.avatar}</div>
                      <div>
                        <div className={`font-bold ${competitor.rank === 3 ? 'text-purple-300' : 'text-white'}`}>
                          {competitor.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {competitor.score.toLocaleString()} XP
                        </div>
                      </div>
                    </div>
                    
                    {competitor.rank === 3 && (
                      <div className="text-purple-300 font-bold animate-pulse">
                        {isPortuguese ? 'Você!' : 'That\'s You!'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gamified Dashboard Summary */}
      <div className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="card bg-gradient-to-r from-purple-800/20 to-pink-800/20 border-purple-400/20 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="text-3xl">🎮</div>
              <h3 className="font-heading text-xl font-bold">
                {isPortuguese ? 'Dashboard V2 - Experiência Gamificada' : 'Dashboard V2 - Gamified Experience'}
              </h3>
            </div>
            <p className="text-gray-400 max-w-3xl mx-auto mb-6">
              {isPortuguese 
                ? 'Esta versão transforma o trading em uma experiência de jogo envolvente, com níveis, conquistas, desafios diários e rankings para manter você motivado e engajado.'
                : 'This version transforms trading into an engaging gaming experience, with levels, achievements, daily challenges and rankings to keep you motivated and engaged.'
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Sistema de Níveis' : 'Level System'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Conquistas & Badges' : 'Achievements & Badges'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Série de Vitórias' : 'Win Streaks'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Desafios Diários' : 'Daily Challenges'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Ranking Global' : 'Global Leaderboard'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}