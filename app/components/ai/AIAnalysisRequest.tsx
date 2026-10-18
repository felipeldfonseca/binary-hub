'use client'
import React, { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Brain, TrendingUp, BarChart3, Zap, Calendar, Clock, Loader2 } from 'lucide-react'

interface AIAnalysisRequestProps {
  onAnalysisRequested?: (analysisId: string) => void
  tradeData?: any // For individual trade analysis
  disabled?: boolean
}

export default function AIAnalysisRequest({ onAnalysisRequested, tradeData, disabled }: AIAnalysisRequestProps) {
  const { isPortuguese } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [selectedType, setSelectedType] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [weekEnd, setWeekEnd] = useState('')

  const analysisTypes = [
    {
      id: 'individual_trade',
      name: isPortuguese ? 'Análise de Trade Individual' : 'Individual Trade Analysis',
      description: isPortuguese 
        ? 'Análise detalhada de um trade específico com insights e recomendações'
        : 'Detailed analysis of a specific trade with insights and recommendations',
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      available: !!tradeData,
      tier: 'free'
    },
    {
      id: 'daily_report',
      name: isPortuguese ? 'Relatório Diário' : 'Daily Report',
      description: isPortuguese 
        ? 'Relatório completo do desempenho de um dia específico'
        : 'Complete performance report for a specific day',
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      available: true,
      tier: 'pro'
    },
    {
      id: 'weekly_report',
      name: isPortuguese ? 'Relatório Semanal' : 'Weekly Report',
      description: isPortuguese 
        ? 'Análise abrangente de uma semana de trading com tendências'
        : 'Comprehensive analysis of a week of trading with trends',
      icon: <BarChart3 className="h-5 w-5" />,
      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      available: true,
      tier: 'pro'
    },
    {
      id: 'pattern_analysis',
      name: isPortuguese ? 'Análise de Padrões' : 'Pattern Analysis',
      description: isPortuguese 
        ? 'Identificação de padrões comportamentais e estratégicos'
        : 'Identification of behavioral and strategic patterns',
      icon: <Brain className="h-5 w-5" />,
      color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      available: true,
      tier: 'premium'
    }
  ]

  const handleAnalysisRequest = async () => {
    if (!selectedType || loading) return

    setLoading(true)
    try {
      let endpoint = ''
      let payload: any = {}

      switch (selectedType) {
        case 'individual_trade':
          endpoint = '/api/v1/ai/analyze/trade'
          payload = { tradeData }
          break
        case 'daily_report':
          endpoint = '/api/v1/ai/analyze/daily-report'
          payload = { date: selectedDate }
          break
        case 'weekly_report':
          endpoint = '/api/v1/ai/analyze/weekly-report'
          payload = { weekStart, weekEnd }
          break
        case 'pattern_analysis':
          endpoint = '/api/v1/ai/analyze/patterns'
          payload = { timeframe: '30d' }
          break
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer mock-token-for-testing`
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error('Falha ao solicitar análise')
      }

      const result = await response.json()
      onAnalysisRequested?.(result.data.analysisId)
      
      // Reset form
      setSelectedType('')
      setSelectedDate('')
      setWeekStart('')
      setWeekEnd('')
    } catch (error) {
      console.error('Error requesting analysis:', error)
      // TODO: Show error toast
    }
    setLoading(false)
  }

  const isFormValid = () => {
    if (!selectedType) return false
    
    switch (selectedType) {
      case 'individual_trade':
        return !!tradeData
      case 'daily_report':
        return !!selectedDate
      case 'weekly_report':
        return !!weekStart && !!weekEnd
      case 'pattern_analysis':
        return true
      default:
        return false
    }
  }

  const getTierBadge = (tier: string) => {
    const colors = {
      free: 'bg-gray-500/20 text-gray-400',
      pro: 'bg-blue-500/20 text-blue-400',
      premium: 'bg-purple-500/20 text-purple-400'
    }
    
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${colors[tier as keyof typeof colors]}`}>
        {tier.toUpperCase()}
      </span>
    )
  }

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">
            {isPortuguese ? 'Análise AI' : 'AI Analysis'}
          </h3>
          <p className="text-gray-400">
            {isPortuguese ? 'Obtenha insights inteligentes sobre seus trades' : 'Get intelligent insights about your trades'}
          </p>
        </div>
      </div>

      {/* Analysis Type Selection */}
      <div className="space-y-3 mb-6">
        <h4 className="font-medium text-gray-300">
          {isPortuguese ? 'Tipo de Análise' : 'Analysis Type'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analysisTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              disabled={!type.available || disabled}
              className={`p-4 rounded-lg border text-left transition-all ${
                selectedType === type.id
                  ? type.color
                  : 'border-gray-600 hover:border-gray-500 bg-gray-800/50'
              } ${!type.available || disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {type.icon}
                  <span className="font-medium text-white">{type.name}</span>
                </div>
                {getTierBadge(type.tier)}
              </div>
              <p className="text-sm text-gray-400">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Date Selection for Daily Report */}
      {selectedType === 'daily_report' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isPortuguese ? 'Selecionar Data' : 'Select Date'}
          </label>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-orange-500 outline-none"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      )}

      {/* Week Selection for Weekly Report */}
      {selectedType === 'weekly_report' && (
        <div className="mb-6 space-y-4">
          <label className="block text-sm font-medium text-gray-300">
            {isPortuguese ? 'Período da Semana' : 'Week Period'}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {isPortuguese ? 'Início' : 'Start'}
              </label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-orange-500 outline-none"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {isPortuguese ? 'Fim' : 'End'}
              </label>
              <input
                type="date"
                value={weekEnd}
                onChange={(e) => setWeekEnd(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-600 focus:border-orange-500 outline-none"
                max={new Date().toISOString().split('T')[0]}
                min={weekStart}
              />
            </div>
          </div>
        </div>
      )}

      {/* Request Button */}
      <button
        onClick={handleAnalysisRequest}
        disabled={!isFormValid() || loading || disabled}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isPortuguese ? 'Processando...' : 'Processing...'}
          </>
        ) : (
          <>
            <Brain className="h-4 w-4" />
            {isPortuguese ? 'Solicitar Análise' : 'Request Analysis'}
          </>
        )}
      </button>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-2">
          <Clock className="h-4 w-4 text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">
              {isPortuguese ? 'Tempo de Processamento' : 'Processing Time'}
            </p>
            <p className="text-blue-400">
              {isPortuguese 
                ? 'Análises individuais: ~30s | Relatórios: 1-2 minutos'
                : 'Individual analysis: ~30s | Reports: 1-2 minutes'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}