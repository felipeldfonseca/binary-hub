'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useAI } from '@/hooks/useAI'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'

// Gamified AI Types
type AIGameTab = 'ai-companion' | 'challenges' | 'achievements' | 'leaderboard' | 'mini-games' | 'skill-tree' | 'rewards'
type AIPersonality = 'mentor' | 'competitor' | 'friend' | 'coach' | 'strategist'
type ChallengeType = 'daily' | 'weekly' | 'monthly' | 'special'
type SkillCategory = 'analysis' | 'risk-management' | 'pattern-recognition' | 'psychology' | 'strategy'

interface AICompanion {
  id: string
  name: string
  personality: AIPersonality
  level: number
  experience: number
  mood: 'happy' | 'neutral' | 'concerned' | 'excited' | 'proud'
  avatar: string
  lastInteraction: Date
  relationship: number // 0-100
  specializations: SkillCategory[]
  quotes: {
    greeting: string
    greetingPT: string
    encouragement: string
    encouragementPT: string
    advice: string
    advicePT: string
  }
}

interface Message {
  type: 'user' | 'ai'
  message: string
  timestamp: Date
  mood?: 'happy' | 'neutral' | 'concerned' | 'excited' | 'proud'
}

interface GameChallenge {
  id: string
  name: string
  namePT: string
  description: string
  descriptionPT: string
  type: ChallengeType
  category: SkillCategory
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  progress: number
  maxProgress: number
  xpReward: number
  gemReward: number
  deadline: Date
  completed: boolean
  icon: string
  requirements: string[]
  requirementsPT: string[]
}

interface Achievement {
  id: string
  name: string
  namePT: string
  description: string
  descriptionPT: string
  category: SkillCategory
  rarity: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  icon: string
  progress: number
  maxProgress: number
  unlocked: boolean
  unlockedAt?: Date
  xpReward: number
  gemReward: number
  badge: string
}

interface MiniGame {
  id: string
  name: string
  namePT: string
  description: string
  descriptionPT: string
  category: SkillCategory
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  xpReward: number
  gemReward: number
  playTime: number
  highScore: number
  lastPlayed?: Date
  icon: string
  unlocked: boolean
}

export default function AIV2Gamified() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<AIGameTab>('ai-companion')
  const [selectedCompanion, setSelectedCompanion] = useState<AIPersonality>('mentor')
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<Message[]>([])
  const [companionAnimation, setCompanionAnimation] = useState('idle')
  const [userLevel, setUserLevel] = useState(12)
  const [userXP, setUserXP] = useState(2847)
  const [userGems, setUserGems] = useState(156)
  const [totalAchievements, setTotalAchievements] = useState(23)
  
  const { generateInsight, getCoachingSession, loading: aiLoading } = useAI()
  const { stats, loading: statsLoading } = useTradeStats('monthly')
  const { trades, loading: tradesLoading } = useTrades({ limit: 50 })

  const hasData = trades.length > 0
  const loading = statsLoading || tradesLoading

  // AI Companions
  const aiCompanions: Record<AIPersonality, AICompanion> = useMemo(() => ({
    mentor: {
      id: 'mentor-sage',
      name: 'Professor Sage',
      personality: 'mentor',
      level: 45,
      experience: 12500,
      mood: 'proud',
      avatar: '🧙‍♂️',
      lastInteraction: new Date(),
      relationship: 85,
      specializations: ['analysis', 'strategy'],
      quotes: {
        greeting: 'Welcome back, my dear student. Ready to learn something new today?',
        greetingPT: 'Bem-vindo de volta, meu caro estudante. Pronto para aprender algo novo hoje?',
        encouragement: 'Every loss is a lesson, every win is validation of your growth.',
        encouragementPT: 'Cada perda é uma lição, cada vitória é validação do seu crescimento.',
        advice: 'Remember, patience and discipline are the trader\'s greatest allies.',
        advicePT: 'Lembre-se, paciência e disciplina são os maiores aliados do trader.'
      }
    },
    competitor: {
      id: 'rival-ace',
      name: 'Ace Trader',
      personality: 'competitor',
      level: 38,
      experience: 9800,
      mood: 'excited',
      avatar: '🏆',
      lastInteraction: new Date(),
      relationship: 72,
      specializations: ['risk-management', 'psychology'],
      quotes: {
        greeting: 'Ready to beat your personal best? I\'ve been waiting for our next challenge!',
        greetingPT: 'Pronto para superar seu recorde pessoal? Estive esperando nosso próximo desafio!',
        encouragement: 'You\'re getting stronger! But can you beat my latest score?',
        encouragementPT: 'Você está ficando mais forte! Mas consegue superar minha última pontuação?',
        advice: 'Winners never quit, quitters never win. Let\'s push those limits!',
        advicePT: 'Vencedores nunca desistem, desistentes nunca vencem. Vamos quebrar esses limites!'
      }
    },
    friend: {
      id: 'buddy-luna',
      name: 'Luna',
      personality: 'friend',
      level: 28,
      experience: 7200,
      mood: 'happy',
      avatar: '🌟',
      lastInteraction: new Date(),
      relationship: 94,
      specializations: ['psychology', 'pattern-recognition'],
      quotes: {
        greeting: 'Hey there! How was your trading day? I\'m here if you need to talk!',
        greetingPT: 'Oi! Como foi seu dia de trading? Estou aqui se precisar conversar!',
        encouragement: 'You\'re doing amazing! I believe in you completely.',
        encouragementPT: 'Você está indo incrível! Acredito em você completamente.',
        advice: 'Sometimes the best trade is the one you don\'t take. Trust your instincts!',
        advicePT: 'Às vezes a melhor operação é aquela que você não faz. Confie nos seus instintos!'
      }
    },
    coach: {
      id: 'coach-titan',
      name: 'Coach Titan',
      personality: 'coach',
      level: 52,
      experience: 15600,
      mood: 'concerned',
      avatar: '💪',
      lastInteraction: new Date(),
      relationship: 78,
      specializations: ['risk-management', 'strategy'],
      quotes: {
        greeting: 'Time to work! No shortcuts to success, only consistent effort.',
        greetingPT: 'Hora de trabalhar! Não há atalhos para o sucesso, apenas esforço consistente.',
        encouragement: 'Push through the pain! Champions are made in moments like these.',
        encouragementPT: 'Supere a dor! Campeões são feitos em momentos como estes.',
        advice: 'Discipline equals freedom. Follow your plan, trust the process.',
        advicePT: 'Disciplina é igual liberdade. Siga seu plano, confie no processo.'
      }
    },
    strategist: {
      id: 'strategist-nova',
      name: 'Nova',
      personality: 'strategist',
      level: 41,
      experience: 11200,
      mood: 'neutral',
      avatar: '🎯',
      lastInteraction: new Date(),
      relationship: 81,
      specializations: ['analysis', 'pattern-recognition'],
      quotes: {
        greeting: 'Data indicates optimal trading conditions. Shall we analyze the patterns?',
        greetingPT: 'Os dados indicam condições ótimas de trading. Vamos analisar os padrões?',
        encouragement: 'Statistical probability favors prepared minds. You\'re on the right track.',
        encouragementPT: 'A probabilidade estatística favorece mentes preparadas. Você está no caminho certo.',
        advice: 'Logic over emotion. Let the data guide your decisions.',
        advicePT: 'Lógica sobre emoção. Deixe os dados guiarem suas decisões.'
      }
    }
  }), [])

  // Game Challenges
  const challenges: GameChallenge[] = useMemo(() => [
    {
      id: 'daily-streak',
      name: 'Daily Streak',
      namePT: 'Sequência Diária',
      description: 'Make 5 profitable trades in a row',
      descriptionPT: 'Faça 5 operações lucrativas seguidas',
      type: 'daily',
      category: 'strategy',
      difficulty: 'medium',
      progress: 3,
      maxProgress: 5,
      xpReward: 150,
      gemReward: 10,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      completed: false,
      icon: '🔥',
      requirements: ['5 consecutive wins', 'Min $10 profit each'],
      requirementsPT: ['5 vitórias consecutivas', 'Min $10 lucro cada']
    },
    {
      id: 'risk-master',
      name: 'Risk Master',
      namePT: 'Mestre do Risco',
      description: 'Keep risk below 2% for 10 trades',
      descriptionPT: 'Mantenha risco abaixo de 2% por 10 operações',
      type: 'weekly',
      category: 'risk-management',
      difficulty: 'hard',
      progress: 7,
      maxProgress: 10,
      xpReward: 300,
      gemReward: 25,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      completed: false,
      icon: '🛡️',
      requirements: ['Risk < 2% per trade', '10 trades minimum'],
      requirementsPT: ['Risco < 2% por operação', '10 operações mínimo']
    }
  ], [])

  // Achievements
  const achievements: Achievement[] = useMemo(() => [
    {
      id: 'first-win',
      name: 'First Victory',
      namePT: 'Primeira Vitória',
      description: 'Win your first trade',
      descriptionPT: 'Ganhe sua primeira operação',
      category: 'strategy',
      rarity: 'bronze',
      icon: '🏅',
      progress: 1,
      maxProgress: 1,
      unlocked: true,
      unlockedAt: new Date('2024-01-15'),
      xpReward: 50,
      gemReward: 5,
      badge: '🥉'
    }
  ], [])

  // Mini Games
  const miniGames: MiniGame[] = useMemo(() => [
    {
      id: 'pattern-match',
      name: 'Pattern Match',
      namePT: 'Combinação de Padrões',
      description: 'Match candlestick patterns with their names',
      descriptionPT: 'Combine padrões de candlestick com seus nomes',
      category: 'pattern-recognition',
      difficulty: 'beginner',
      xpReward: 25,
      gemReward: 3,
      playTime: 2,
      highScore: 850,
      icon: '🎮',
      unlocked: true
    }
  ], [])

  // Handle companion interaction
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage: Message = {
      type: 'user',
      message: chatInput,
      timestamp: new Date()
    }

    setChatHistory(prev => [...prev, userMessage])
    setChatInput('')
    setCompanionAnimation('thinking')

    // Simulate AI response
    setTimeout(() => {
      const companion = aiCompanions[selectedCompanion]
      const responses = [
        companion.quotes.advice,
        companion.quotes.encouragement,
        isPortuguese ? companion.quotes.advicePT : companion.quotes.advice,
        isPortuguese ? companion.quotes.encouragementPT : companion.quotes.encouragement
      ]

      const aiMessage: Message = {
        type: 'ai',
        message: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
        mood: companion.mood
      }

      setChatHistory(prev => [...prev, aiMessage])
      setCompanionAnimation('talking')
      
      setTimeout(() => setCompanionAnimation('idle'), 2000)
    }, 1500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#505050] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎮</div>
          <h2 className="text-2xl font-bold text-white mb-2 font-comfortaa">
            {isPortuguese ? 'Carregando Jogo...' : 'Loading Game...'}
          </h2>
          <p className="text-gray-400">
            {isPortuguese ? 'Preparando experiência gamificada' : 'Preparing gamified experience'}
          </p>
        </div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="min-h-screen bg-[#505050] px-4 py-8">
        <div className="container mx-auto max-w-6xl">
          <div className="card text-center py-16">
            <div className="text-6xl mb-6">🎮</div>
            <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
              {isPortuguese ? 'IA Gamificada' : 'Gamified AI'}
            </h3>
            <p className="text-gray-300 mb-6">
              {isPortuguese 
                ? 'Precisa de dados de trades para começar sua aventura com IA.'
                : 'Need trade data to start your AI adventure.'
              }
            </p>
            <button 
              onClick={() => window.location.href = '/trades'}
              className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-6 py-3 rounded-lg hover:shadow-lg transition-all font-comfortaa"
            >
              {isPortuguese ? '+ Adicionar Trades' : '+ Add Trades'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#505050] px-4 py-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header with User Stats */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="hero-title text-3xl md:text-4xl font-poly font-bold text-white mb-2">
                {isPortuguese ? 'IA Gamificada' : 'Gamified AI'}
              </h1>
              <p className="text-xl font-comfortaa font-normal text-white">
                {isPortuguese 
                  ? 'Aprenda trading de forma divertida com seu companheiro IA'
                  : 'Learn trading the fun way with your AI companion'
                }
              </p>
            </div>
            
            <div className="flex items-center gap-6 bg-gray-800/50 rounded-lg p-4">
              <div className="text-center">
                <div className="text-sm text-gray-400">{isPortuguese ? 'Nível' : 'Level'}</div>
                <div className="text-lg font-bold text-[#E1FFD9]">{userLevel}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">XP</div>
                <div className="text-lg font-bold text-[#E1FFD9]">{userXP}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">{isPortuguese ? 'Gemas' : 'Gems'}</div>
                <div className="text-lg font-bold text-blue-400">{userGems} 💎</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-400">{isPortuguese ? 'Conquistas' : 'Achievements'}</div>
                <div className="text-lg font-bold text-yellow-400">{totalAchievements} 🏆</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: 'ai-companion', icon: '🤖', label: isPortuguese ? 'Companheiro IA' : 'AI Companion' },
              { id: 'challenges', icon: '🎯', label: isPortuguese ? 'Desafios' : 'Challenges' },
              { id: 'achievements', icon: '🏆', label: isPortuguese ? 'Conquistas' : 'Achievements' },
              { id: 'mini-games', icon: '🎮', label: isPortuguese ? 'Mini Jogos' : 'Mini Games' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AIGameTab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[#E1FFD9] text-[#2D3748]'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="card text-center py-16">
          <div className="text-6xl mb-6">🎮</div>
          <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
            {isPortuguese ? 'IA Gamificada V2' : 'Gamified AI V2'}
          </h3>
          <p className="text-gray-300 mb-6">
            {isPortuguese 
              ? 'Experiência de IA com elementos de gamificação, companheiros interativos, conquistas e desafios diários.'
              : 'AI experience with gamification elements, interactive companions, achievements and daily challenges.'
            }
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Companheiros IA' : 'AI Companions'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Sistema de Conquistas' : 'Achievement System'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Desafios Diários' : 'Daily Challenges'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Mini Jogos' : 'Mini Games'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}