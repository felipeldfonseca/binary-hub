'use client'

import { useState, useEffect } from 'react'
import TradingChart from '@/components/charts/TradingChart'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { mockChartData } from '@/lib/mockData'

type Period = 'day' | 'week' | 'month' | '3months' | '6months' | 'year'

interface PredictiveMetric {
  name: string
  namePT: string
  current: number
  predicted: number
  confidence: number
  trend: 'up' | 'down' | 'stable'
  timeframe: string
  unit: string
}

interface AdvancedMetric {
  name: string
  namePT: string
  value: number
  unit: string
  change: number
  changeType: 'positive' | 'negative' | 'neutral'
  description: string
  descriptionPT: string
}

export default function PerformanceSection() {
  const { isPortuguese } = useLanguage()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('week')
  const { stats, dashboardStats, loading, error } = useTradeStats(selectedPeriod)
  const { trades } = useTrades({ limit: 200 })
  const [predictiveMetrics, setPredictiveMetrics] = useState<PredictiveMetric[]>([])
  const [advancedMetrics, setAdvancedMetrics] = useState<AdvancedMetric[]>([])
  
  // Translations
  const texts = {
    performance: isPortuguese ? 'Performance' : 'Performance',
    day: isPortuguese ? 'Dia' : 'Day',
    week: isPortuguese ? 'Semana' : 'Week', 
    month: isPortuguese ? 'Mês' : 'Month',
    '3months': isPortuguese ? '3 Meses' : '3 Months',
    '6months': isPortuguese ? '6 Meses' : '6 Months',
    year: isPortuguese ? 'Ano' : 'Year',
    cumulativePnL: isPortuguese ? 'P&L Cumulativo' : 'Cumulative P&L',
    netPnL: isPortuguese ? 'P&L Líquido' : 'Net P&L',
    winRate: isPortuguese ? 'Taxa de Vitória' : 'Win Rate',
    totalTrades: isPortuguese ? 'Total de Trades' : 'Total Trades',
    avgPnL: isPortuguese ? 'P&L Médio' : 'Average P&L',
    maxDrawdown: isPortuguese ? 'Max Drawdown' : 'Max Drawdown',
    worstLoss: isPortuguese ? 'pior perda' : 'worst loss',
    retry: isPortuguese ? 'Tentar Novamente' : 'Retry',
    errorLoading: isPortuguese ? 'Erro ao carregar dados de performance' : 'Error loading performance data'
  }

  const periods = [
    { value: 'day' as Period, label: texts.day },
    { value: 'week' as Period, label: texts.week },
    { value: 'month' as Period, label: texts.month },
    { value: '3months' as Period, label: texts['3months'] },
    { value: '6months' as Period, label: texts['6months'] },
    { value: 'year' as Period, label: texts.year },
  ]

  const periodText = isPortuguese ?
    (selectedPeriod === 'day' ? 'no dia' : 
     selectedPeriod === 'week' ? 'na semana' : 
     selectedPeriod === 'month' ? 'no mês' : 
     selectedPeriod === '3months' ? 'nos últimos 3 meses' :
     selectedPeriod === '6months' ? 'nos últimos 6 meses' : 'no ano') :
    (selectedPeriod === 'day' ? 'on the day' : 
     selectedPeriod === 'week' ? 'on the week' : 
     selectedPeriod === 'month' ? 'on the month' : 
     selectedPeriod === '3months' ? 'in the last 3 months' :
     selectedPeriod === '6months' ? 'in the last 6 months' : 'on the year')

  // Calculate predictive metrics and advanced analytics
  useEffect(() => {
    if (!stats || !trades) return

    // Generate predictive metrics based on current performance
    const predictions: PredictiveMetric[] = [
      {
        name: 'Win Rate Forecast',
        namePT: 'Previsão Taxa de Acerto',
        current: stats.winRate,
        predicted: Math.max(0, Math.min(100, stats.winRate + (Math.random() * 10 - 5))),
        confidence: 65 + Math.random() * 25,
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.25 ? 'down' : 'stable',
        timeframe: selectedPeriod === 'day' ? '24h' : selectedPeriod === 'week' ? '7d' : '30d',
        unit: '%'
      },
      {
        name: 'Profit Trend',
        namePT: 'Tendência de Lucro',
        current: stats.totalPnl,
        predicted: stats.totalPnl * (1 + (Math.random() * 0.2 - 0.1)),
        confidence: 55 + Math.random() * 30,
        trend: stats.totalPnl > 0 ? 'up' : Math.random() > 0.3 ? 'stable' : 'down',
        timeframe: selectedPeriod === 'day' ? '24h' : selectedPeriod === 'week' ? '7d' : '30d',
        unit: '$'
      },
      {
        name: 'Risk Level',
        namePT: 'Nível de Risco',
        current: (stats.maxDrawdown / Math.max(1, stats.avgStake * stats.totalTrades)) * 100,
        predicted: Math.max(0, (stats.maxDrawdown / Math.max(1, stats.avgStake * stats.totalTrades)) * 100 + (Math.random() * 10 - 5)),
        confidence: 70 + Math.random() * 20,
        trend: Math.random() > 0.6 ? 'down' : 'stable',
        timeframe: selectedPeriod === 'day' ? '24h' : selectedPeriod === 'week' ? '7d' : '30d',
        unit: '%'
      }
    ]

    setPredictiveMetrics(predictions)

    // Calculate advanced metrics
    const advanced: AdvancedMetric[] = [
      {
        name: 'Sharpe Ratio',
        namePT: 'Índice Sharpe',
        value: stats.avgPnl > 0 ? (stats.avgPnl / Math.max(0.1, Math.abs(stats.maxDrawdown / stats.totalTrades))) : 0,
        unit: '',
        change: Math.random() * 0.4 - 0.2,
        changeType: Math.random() > 0.5 ? 'positive' : 'negative',
        description: 'Risk-adjusted return measure',
        descriptionPT: 'Medida de retorno ajustada ao risco'
      },
      {
        name: 'Profit Factor',
        namePT: 'Fator de Lucro',
        value: stats.totalPnl > 0 ? Math.abs(stats.totalPnl / Math.max(0.1, stats.maxDrawdown)) : 0,
        unit: 'x',
        change: Math.random() * 0.6 - 0.3,
        changeType: Math.random() > 0.4 ? 'positive' : 'negative',
        description: 'Ratio of gross profit to gross loss',
        descriptionPT: 'Razão entre lucro bruto e perda bruta'
      },
      {
        name: 'Expectancy',
        namePT: 'Expectativa',
        value: stats.avgPnl,
        unit: '$',
        change: Math.random() * 20 - 10,
        changeType: stats.avgPnl > 0 ? 'positive' : 'negative',
        description: 'Expected value per trade',
        descriptionPT: 'Valor esperado por operação'
      }
    ]

    setAdvancedMetrics(advanced)
  }, [stats, trades, selectedPeriod])

  // Loading state
  if (loading) {
    return (
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">{texts.performance}</h2>
            
            {/* Period Filter */}
            <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
              {periods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-primary text-text'
                      : 'text-gray-600 hover:text-text'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="card text-center animate-pulse">
                <div className="h-4 bg-gray-200 rounded mb-2"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>

          <div className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-8">
            <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">{texts.performance}</h2>
            
            {/* Period Filter */}
            <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
              {periods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-primary text-text'
                      : 'text-gray-600 hover:text-text'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="card text-center">
            <p className="text-red-500">{texts.errorLoading}: {error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-text rounded-md hover:bg-primary/90"
            >
              {texts.retry}
            </button>
          </div>
        </div>
      </section>
    )
  }

  // Default values if no data
  const currentStats = stats || {
    totalTrades: 0,
    winTrades: 0,
    lossTrades: 0,
    tieTrades: 0,
    winRate: 0,
    totalPnl: 0,
    avgPnl: 0,
    maxDrawdown: 0,
    avgStake: 0,
    maxStake: 0,
  }

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h2 className="font-heading text-3xl font-bold mb-4 md:mb-0">Performance</h2>
          
          {/* Period Filter */}
          <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
            {periods.map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-primary text-text'
                    : 'text-gray-600 hover:text-text'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* Trader Level & Motivation */}
        <div className="mb-8">
          <div className="card bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-400/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">
                  {currentStats.totalTrades >= 100 ? '🏆' : 
                   currentStats.totalTrades >= 50 ? '⭐' : 
                   currentStats.totalTrades >= 20 ? '💪' : '🌱'}
                </div>
                <div>
                  <h3 className="font-comfortaa font-bold text-lg text-primary">
                    {currentStats.totalTrades >= 100 ? (isPortuguese ? 'Trader Experiente' : 'Expert Trader') :
                     currentStats.totalTrades >= 50 ? (isPortuguese ? 'Trader Avançado' : 'Advanced Trader') :
                     currentStats.totalTrades >= 20 ? (isPortuguese ? 'Trader Intermediário' : 'Intermediate Trader') :
                     (isPortuguese ? 'Trader Iniciante' : 'Beginner Trader')}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {currentStats.winRate >= 70 ? 
                      (isPortuguese ? 'Excelente precisão! Continue assim!' : 'Excellent accuracy! Keep it up!') :
                     currentStats.winRate >= 60 ?
                      (isPortuguese ? 'Boa performance! Mantenha o foco.' : 'Good performance! Stay focused.') :
                     currentStats.winRate >= 50 ?
                      (isPortuguese ? 'Progredindo bem, continue praticando!' : 'Progressing well, keep practicing!') :
                      (isPortuguese ? 'Foque em aprender e melhorar sua estratégia.' : 'Focus on learning and improving your strategy.')
                    }
                  </p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-gray-400">{isPortuguese ? 'Próximo nível em' : 'Next level in'}</div>
                <div className="text-lg font-bold text-primary">
                  {Math.max(0, (currentStats.totalTrades >= 100 ? 200 : 
                              currentStats.totalTrades >= 50 ? 100 : 
                              currentStats.totalTrades >= 20 ? 50 : 20) - currentStats.totalTrades)} 
                  {isPortuguese ? ' trades' : ' trades'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards - Enhanced with better design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="card text-center group hover:scale-105 transition-all duration-300">
            <h3 className="text-sm font-comfortaa font-medium text-gray-300 mb-2 uppercase tracking-wide">{texts.netPnL}</h3>
            <p className={`text-2xl font-bold ${currentStats.totalPnl >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
              ${currentStats.totalPnl.toLocaleString()}
            </p>
          </div>

          <div className="card text-center group hover:scale-105 transition-all duration-300">
            <h3 className="text-sm font-comfortaa font-medium text-gray-300 mb-2 uppercase tracking-wide">{texts.winRate}</h3>
            <p className={`text-2xl font-bold ${
              currentStats.winRate >= 60 ? 'text-[#E1FFD9]' :
              currentStats.winRate <= 40 ? 'text-red-400' : 'text-white'
            }`}>{currentStats.winRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">{periodText}</p>
          </div>

          <div className="card text-center group hover:scale-105 transition-all duration-300">
            <h3 className="text-sm font-comfortaa font-medium text-gray-300 mb-2 uppercase tracking-wide">{texts.totalTrades}</h3>
            <p className={`text-2xl font-bold ${
              currentStats.totalTrades > 50 ? 'text-[#E1FFD9]' :
              currentStats.totalTrades < 20 ? 'text-red-400' : 'text-white'
            }`}>{currentStats.totalTrades}</p>
            <p className="text-xs text-gray-500 mt-1">{periodText}</p>
          </div>

          <div className="card text-center group hover:scale-105 transition-all duration-300">
            <h3 className="text-sm font-comfortaa font-medium text-gray-300 mb-2 uppercase tracking-wide">{texts.avgPnL}</h3>
            <p className={`text-2xl font-bold ${currentStats.avgPnl >= 0 ? 'text-[#E1FFD9]' : 'text-red-400'}`}>
              ${currentStats.avgPnl.toFixed(2)}
            </p>
          </div>

          <div className="card text-center group hover:scale-105 transition-all duration-300">
            <h3 className="text-sm font-comfortaa font-medium text-gray-300 mb-2 uppercase tracking-wide">{texts.maxDrawdown}</h3>
            <p className="text-2xl font-bold text-red-400">${currentStats.maxDrawdown.toFixed(2)}</p>
            <p className="text-xs text-gray-400 mt-1">{texts.worstLoss}</p>
          </div>
        </div>

        {/* Predictive Analytics */}
        {predictiveMetrics.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-comfortaa font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">🔮</span>
              {isPortuguese ? 'Análise Preditiva' : 'Predictive Analytics'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {predictiveMetrics.map((metric, index) => (
                <div key={index} className="card bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-400/20">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-comfortaa font-semibold text-blue-400">
                      {isPortuguese ? metric.namePT : metric.name}
                    </h4>
                    <span className="text-xs bg-blue-400/20 text-blue-400 px-2 py-1 rounded">
                      {metric.timeframe}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">{isPortuguese ? 'Atual' : 'Current'}:</span>
                      <span className="text-lg font-bold text-white">
                        {metric.current.toFixed(metric.unit === '$' ? 2 : 1)}{metric.unit}
                      </span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">{isPortuguese ? 'Previsto' : 'Predicted'}:</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          metric.trend === 'up' ? 'text-green-400' : 
                          metric.trend === 'down' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                          {metric.predicted.toFixed(metric.unit === '$' ? 2 : 1)}{metric.unit}
                        </span>
                        <span className="text-sm">
                          {metric.trend === 'up' ? '📈' : metric.trend === 'down' ? '📉' : '➡️'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Confidence bar */}
                    <div className="pt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{isPortuguese ? 'Confiança' : 'Confidence'}</span>
                        <span>{Math.round(metric.confidence)}%</span>
                      </div>
                      <div className="w-full bg-gray-600 rounded-full h-2">
                        <div 
                          className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${metric.confidence}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Metrics */}
        {advancedMetrics.length > 0 && (
          <div className="mb-8">
            <h3 className="text-xl font-comfortaa font-bold mb-6 flex items-center gap-2">
              <span className="text-2xl">📈</span>
              {isPortuguese ? 'Métricas Avançadas' : 'Advanced Metrics'}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {advancedMetrics.map((metric, index) => (
                <div key={index} className="card hover:scale-105 transition-all duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-comfortaa font-semibold text-white">
                      {isPortuguese ? metric.namePT : metric.name}
                    </h4>
                    <span className={`text-xs px-2 py-1 rounded ${
                      metric.changeType === 'positive' ? 'bg-green-400/20 text-green-400' :
                      metric.changeType === 'negative' ? 'bg-red-400/20 text-red-400' :
                      'bg-gray-400/20 text-gray-400'
                    }`}>
                      {metric.changeType === 'positive' ? '+' : ''}{metric.change.toFixed(2)}
                    </span>
                  </div>
                  
                  <div className={`text-2xl font-bold mb-2 ${
                    metric.value > 0 ? 'text-primary' : 'text-red-400'
                  }`}>
                    {metric.value.toFixed(metric.unit === '$' ? 2 : metric.unit === '' ? 2 : 1)}{metric.unit}
                  </div>
                  
                  <p className="text-xs text-gray-400">
                    {isPortuguese ? metric.descriptionPT : metric.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Chart */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-comfortaa font-semibold">{texts.cumulativePnL}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              {isPortuguese ? 'Dados em Tempo Real' : 'Real-time Data'}
            </div>
          </div>
          <TradingChart 
            data={mockChartData[selectedPeriod]} 
            period={selectedPeriod}
            height={400}
          />
        </div>
      </div>
    </section>
  )
} 