'use client'
import React, { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Brain, Clock, TrendingUp, BarChart3, Zap, Star } from 'lucide-react'

interface AIAnalysis {
  id: string
  type: 'individual_trade' | 'daily_report' | 'weekly_report' | 'pattern_analysis'
  analysis: any
  model: string
  tokensUsed: number
  cost: number
  confidence: number
  createdAt: string
}

interface AIAnalysisCardProps {
  analysis: AIAnalysis
  onShare?: () => void
}

export default function AIAnalysisCard({ analysis, onShare }: AIAnalysisCardProps) {
  const { isPortuguese } = useLanguage()
  const [expanded, setExpanded] = useState(false)

  const getTypeIcon = () => {
    switch (analysis.type) {
      case 'individual_trade':
        return <TrendingUp className="h-5 w-5" />
      case 'daily_report':
        return <BarChart3 className="h-5 w-5" />
      case 'weekly_report':
        return <BarChart3 className="h-5 w-5" />
      case 'pattern_analysis':
        return <Brain className="h-5 w-5" />
      default:
        return <Zap className="h-5 w-5" />
    }
  }

  const getTypeName = () => {
    switch (analysis.type) {
      case 'individual_trade':
        return isPortuguese ? 'Análise de Trade' : 'Trade Analysis'
      case 'daily_report':
        return isPortuguese ? 'Relatório Diário' : 'Daily Report'
      case 'weekly_report':
        return isPortuguese ? 'Relatório Semanal' : 'Weekly Report'
      case 'pattern_analysis':
        return isPortuguese ? 'Análise de Padrões' : 'Pattern Analysis'
      default:
        return isPortuguese ? 'Análise AI' : 'AI Analysis'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString(isPortuguese ? 'pt-BR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderAnalysisContent = () => {
    if (analysis.analysis.structured && typeof analysis.analysis === 'object') {
      return renderStructuredAnalysis()
    } else {
      return renderPlainTextAnalysis()
    }
  }

  const renderStructuredAnalysis = () => {
    const data = analysis.analysis

    if (analysis.type === 'individual_trade') {
      return (
        <div className="space-y-4">
          {data.evaluation && (
            <div>
              <h4 className="font-medium text-orange-400 mb-2">
                {isPortuguese ? 'Avaliação' : 'Evaluation'}
              </h4>
              <p className="text-gray-200 text-sm">{data.evaluation}</p>
            </div>
          )}
          
          {data.outcome_analysis && (
            <div>
              <h4 className="font-medium text-orange-400 mb-2">
                {isPortuguese ? 'Análise do Resultado' : 'Outcome Analysis'}
              </h4>
              <p className="text-gray-200 text-sm">{data.outcome_analysis}</p>
            </div>
          )}
          
          {data.lessons && (
            <div>
              <h4 className="font-medium text-orange-400 mb-2">
                {isPortuguese ? 'Lições Aprendidas' : 'Lessons Learned'}
              </h4>
              <p className="text-gray-200 text-sm">{data.lessons}</p>
            </div>
          )}
          
          {data.recommendations && (
            <div>
              <h4 className="font-medium text-orange-400 mb-2">
                {isPortuguese ? 'Recomendações' : 'Recommendations'}
              </h4>
              <p className="text-gray-200 text-sm">{data.recommendations}</p>
            </div>
          )}
          
          {data.quality_score && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
              <Star className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-300">
                {isPortuguese ? 'Qualidade do Trade' : 'Trade Quality'}: 
                <span className="font-medium ml-1">{data.quality_score}/10</span>
              </span>
            </div>
          )}
        </div>
      )
    } else {
      // For reports and pattern analysis, render as structured content
      return (
        <div className="space-y-3">
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <h4 className="font-medium text-orange-400 mb-1 capitalize">
                {key.replace(/_/g, ' ')}
              </h4>
              <p className="text-gray-200 text-sm">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </p>
            </div>
          ))}
        </div>
      )
    }
  }

  const renderPlainTextAnalysis = () => (
    <div className="text-gray-200 text-sm whitespace-pre-wrap">
      {analysis.analysis.content || analysis.analysis}
    </div>
  )

  const getConfidenceColor = () => {
    if (analysis.confidence >= 0.8) return 'text-green-400'
    if (analysis.confidence >= 0.6) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getModelBadgeColor = () => {
    return analysis.model === 'gpt4o' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
  }

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
            {getTypeIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-white">{getTypeName()}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="h-3 w-3" />
              {formatDate(analysis.createdAt)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${getModelBadgeColor()}`}>
            {analysis.model.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Analysis Content */}
      <div className={`${expanded ? '' : 'max-h-32 overflow-hidden'} relative`}>
        {renderAnalysisContent()}
        {!expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-900 to-transparent" />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-700 mt-4">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Brain className="h-3 w-3" />
            <span>
              {isPortuguese ? 'Confiança' : 'Confidence'}: 
              <span className={`ml-1 font-medium ${getConfidenceColor()}`}>
                {(analysis.confidence * 100).toFixed(0)}%
              </span>
            </span>
          </div>
          <div>
            {isPortuguese ? 'Tokens' : 'Tokens'}: {analysis.tokensUsed.toLocaleString()}
          </div>
          <div>
            {isPortuguese ? 'Custo' : 'Cost'}: ${analysis.cost.toFixed(4)}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onShare && (
            <button
              onClick={onShare}
              className="text-sm text-gray-400 hover:text-orange-400 transition-colors"
            >
              {isPortuguese ? 'Compartilhar' : 'Share'}
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-orange-400 hover:text-orange-300 transition-colors"
          >
            {expanded 
              ? (isPortuguese ? 'Recolher' : 'Collapse')
              : (isPortuguese ? 'Ver Mais' : 'Read More')
            }
          </button>
        </div>
      </div>
    </div>
  )
}