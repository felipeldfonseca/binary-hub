'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades, Trade } from '@/hooks/useTrades'

// AI-Powered Analytics Types
type AIAnalyticsTab = 'neural-dashboard' | 'ml-predictions' | 'pattern-recognition' | 'ai-optimization' | 'market-sentiment' | 'risk-ai' | 'auto-insights'
type PredictionModel = 'lstm' | 'transformer' | 'random_forest' | 'neural_network' | 'ensemble'
type MarketRegime = 'bullish' | 'bearish' | 'sideways' | 'volatile' | 'stable'

interface AIModel {
  id: string
  name: string
  type: PredictionModel
  accuracy: number
  confidence: number
  status: 'training' | 'active' | 'analyzing' | 'optimizing'
  lastUpdate: Date
  predictions: {
    nextTrade: { probability: number; direction: 'call' | 'put'; confidence: number }
    marketDirection: { trend: MarketRegime; confidence: number; timeframe: string }
    optimalEntry: { timestamp: Date; asset: string; confidence: number }
  }
}

interface PatternRecognition {
  id: string
  name: string
  type: 'bullish' | 'bearish' | 'reversal' | 'continuation'
  confidence: number
  occurrences: number
  successRate: number
  avgReturn: number
  description: string
  descriptionPT: string
  tradingSignal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
}

interface AIInsight {
  id: string
  type: 'optimization' | 'risk_warning' | 'opportunity' | 'pattern_alert' | 'market_change'
  title: string
  titlePT: string
  description: string
  descriptionPT: string
  confidence: number
  impact: 'high' | 'medium' | 'low'
  actionable: boolean
  suggestedAction?: string
  suggestedActionPT?: string
}

interface NeuralNetworkVisualization {
  layers: Array<{
    id: string
    name: string
    nodes: number
    activation: 'relu' | 'sigmoid' | 'tanh' | 'softmax'
    weights: number[]
  }>
  connections: Array<{
    from: string
    to: string
    weight: number
    strength: number
  }>
  currentPrediction: number
  confidence: number
}

export default function AnalyticsV3AIPowered() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<AIAnalyticsTab>('neural-dashboard')
  const [selectedModel, setSelectedModel] = useState<PredictionModel>('neural_network')
  const [realTimeMode, setRealTimeMode] = useState(true)
  const [autoOptimization, setAutoOptimization] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Hooks
  const { stats, loading: statsLoading } = useTradeStats('allTime')
  const { trades, loading: tradesLoading } = useTrades()

  const hasData = trades.length > 0
  const loading = statsLoading || tradesLoading

  // Mock AI Models Data
  const aiModels: AIModel[] = useMemo(() => [
    {
      id: 'lstm-1',
      name: 'LSTM Price Predictor',
      type: 'lstm',
      accuracy: 87.3,
      confidence: 92.1,
      status: 'active',
      lastUpdate: new Date(),
      predictions: {
        nextTrade: { probability: 0.78, direction: 'call', confidence: 0.85 },
        marketDirection: { trend: 'bullish', confidence: 0.82, timeframe: '4h' },
        optimalEntry: { timestamp: new Date(Date.now() + 3600000), asset: 'EUR/USD', confidence: 0.89 }
      }
    },
    {
      id: 'transformer-1',
      name: 'Transformer Analysis',
      type: 'transformer',
      accuracy: 91.7,
      confidence: 89.4,
      status: 'analyzing',
      lastUpdate: new Date(),
      predictions: {
        nextTrade: { probability: 0.82, direction: 'put', confidence: 0.76 },
        marketDirection: { trend: 'volatile', confidence: 0.91, timeframe: '1h' },
        optimalEntry: { timestamp: new Date(Date.now() + 1800000), asset: 'GBP/USD', confidence: 0.83 }
      }
    },
    {
      id: 'ensemble-1',
      name: 'Ensemble Predictor',
      type: 'ensemble',
      accuracy: 94.2,
      confidence: 95.8,
      status: 'optimizing',
      lastUpdate: new Date(),
      predictions: {
        nextTrade: { probability: 0.91, direction: 'call', confidence: 0.94 },
        marketDirection: { trend: 'stable', confidence: 0.88, timeframe: '2h' },
        optimalEntry: { timestamp: new Date(Date.now() + 2700000), asset: 'USD/JPY', confidence: 0.92 }
      }
    }
  ], [])

  // Mock Pattern Recognition Data
  const recognizedPatterns: PatternRecognition[] = useMemo(() => [
    {
      id: 'hammer-pattern',
      name: 'Hammer Reversal',
      type: 'reversal',
      confidence: 89.3,
      occurrences: 34,
      successRate: 76.5,
      avgReturn: 12.4,
      description: 'Strong bullish reversal pattern detected',
      descriptionPT: 'Padrão de reversão altista forte detectado',
      tradingSignal: 'buy'
    },
    {
      id: 'doji-pattern',
      name: 'Doji Indecision',
      type: 'reversal',
      confidence: 72.1,
      occurrences: 28,
      successRate: 68.2,
      avgReturn: 8.7,
      description: 'Market indecision, potential reversal',
      descriptionPT: 'Indecisão do mercado, possível reversão',
      tradingSignal: 'hold'
    },
    {
      id: 'engulfing-pattern',
      name: 'Bullish Engulfing',
      type: 'bullish',
      confidence: 94.7,
      occurrences: 19,
      successRate: 84.2,
      avgReturn: 18.3,
      description: 'Strong bullish momentum confirmed',
      descriptionPT: 'Momentum altista forte confirmado',
      tradingSignal: 'strong_buy'
    }
  ], [])

  // Mock AI Insights
  const aiInsights: AIInsight[] = useMemo(() => [
    {
      id: 'risk-warning-1',
      type: 'risk_warning',
      title: 'High Volatility Alert',
      titlePT: 'Alerta de Alta Volatilidade',
      description: 'Market volatility increased by 35% in the last 2 hours. Consider reducing position sizes.',
      descriptionPT: 'Volatilidade do mercado aumentou 35% nas últimas 2 horas. Considere reduzir tamanhos de posição.',
      confidence: 0.91,
      impact: 'high',
      actionable: true,
      suggestedAction: 'Reduce trade size by 20-30%',
      suggestedActionPT: 'Reduza tamanho da operação em 20-30%'
    },
    {
      id: 'opportunity-1',
      type: 'opportunity',
      title: 'Optimal Entry Window',
      titlePT: 'Janela de Entrada Ótima',
      description: 'AI models predict 87% probability of upward movement in EUR/USD within next 45 minutes.',
      descriptionPT: 'Modelos de IA preveem 87% de probabilidade de movimento ascendente no EUR/USD nos próximos 45 minutos.',
      confidence: 0.87,
      impact: 'high',
      actionable: true,
      suggestedAction: 'Consider CALL position on EUR/USD',
      suggestedActionPT: 'Considere posição CALL no EUR/USD'
    },
    {
      id: 'pattern-alert-1',
      type: 'pattern_alert',
      title: 'Bullish Pattern Confirmed',
      titlePT: 'Padrão Altista Confirmado',
      description: 'Triple bottom pattern confirmed on GBP/USD with 94% historical success rate.',
      descriptionPT: 'Padrão triplo fundo confirmado no GBP/USD com 94% de taxa de sucesso histórica.',
      confidence: 0.94,
      impact: 'medium',
      actionable: true,
      suggestedAction: 'Monitor for entry opportunity',
      suggestedActionPT: 'Monitore oportunidade de entrada'
    }
  ], [])

  // Neural Network Visualization
  const neuralNetwork: NeuralNetworkVisualization = useMemo(() => ({
    layers: [
      { id: 'input', name: 'Input Layer', nodes: 15, activation: 'relu', weights: Array(15).fill(0).map(() => Math.random()) },
      { id: 'hidden1', name: 'Hidden Layer 1', nodes: 32, activation: 'relu', weights: Array(32).fill(0).map(() => Math.random()) },
      { id: 'hidden2', name: 'Hidden Layer 2', nodes: 16, activation: 'relu', weights: Array(16).fill(0).map(() => Math.random()) },
      { id: 'output', name: 'Output Layer', nodes: 3, activation: 'softmax', weights: Array(3).fill(0).map(() => Math.random()) }
    ],
    connections: [],
    currentPrediction: 0.847,
    confidence: 0.923
  }), [])

  // Real-time updates simulation
  useEffect(() => {
    if (realTimeMode) {
      const interval = setInterval(() => {
        // Simulate real-time model updates
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [realTimeMode])

  // Neural Network Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Draw neural network visualization
      const layers = neuralNetwork.layers
      const layerSpacing = canvas.width / (layers.length + 1)
      
      layers.forEach((layer, layerIndex) => {
        const x = layerSpacing * (layerIndex + 1)
        const nodeSpacing = canvas.height / (layer.nodes + 1)
        
        for (let nodeIndex = 0; nodeIndex < layer.nodes; nodeIndex++) {
          const y = nodeSpacing * (nodeIndex + 1)
          const activation = layer.weights[nodeIndex]
          
          // Draw node
          ctx.beginPath()
          ctx.arc(x, y, 8, 0, 2 * Math.PI)
          ctx.fillStyle = `rgba(225, 255, 217, ${activation})`
          ctx.fill()
          ctx.strokeStyle = '#E1FFD9'
          ctx.stroke()
          
          // Draw connections to next layer
          if (layerIndex < layers.length - 1) {
            const nextLayer = layers[layerIndex + 1]
            const nextX = layerSpacing * (layerIndex + 2)
            const nextNodeSpacing = canvas.height / (nextLayer.nodes + 1)
            
            for (let nextNodeIndex = 0; nextNodeIndex < nextLayer.nodes; nextNodeIndex++) {
              const nextY = nextNodeSpacing * (nextNodeIndex + 1)
              
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(nextX, nextY)
              ctx.strokeStyle = `rgba(225, 255, 217, ${Math.random() * 0.3 + 0.1})`
              ctx.lineWidth = 1
              ctx.stroke()
            }
          }
        }
      })
      
      requestAnimationFrame(animate)
    }
    
    animate()
  }, [neuralNetwork])

  const renderNeuralDashboard = () => (
    <div className="space-y-6">
      {/* AI Models Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {aiModels.map((model) => (
          <div key={model.id} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white font-comfortaa">{model.name}</h3>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                model.status === 'active' ? 'bg-green-500/20 text-green-400' :
                model.status === 'analyzing' ? 'bg-blue-500/20 text-blue-400' :
                model.status === 'optimizing' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {model.status.toUpperCase()}
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">{isPortuguese ? 'Precisão' : 'Accuracy'}</span>
                <span className="text-white font-semibold">{model.accuracy.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{isPortuguese ? 'Confiança' : 'Confidence'}</span>
                <span className="text-white font-semibold">{model.confidence.toFixed(1)}%</span>
              </div>
              
              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">
                  {isPortuguese ? 'Próxima Previsão' : 'Next Prediction'}
                </h4>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    model.predictions.nextTrade.direction === 'call' 
                      ? 'bg-green-500/20 text-green-400' 
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {model.predictions.nextTrade.direction.toUpperCase()}
                  </span>
                  <span className="text-white font-semibold">
                    {(model.predictions.nextTrade.probability * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Neural Network Visualization */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white font-comfortaa">
            {isPortuguese ? 'Rede Neural em Tempo Real' : 'Real-Time Neural Network'}
          </h3>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-400">{isPortuguese ? 'Previsão Atual' : 'Current Prediction'}</div>
              <div className="text-lg font-bold text-[#E1FFD9]">{(neuralNetwork.currentPrediction * 100).toFixed(1)}%</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">{isPortuguese ? 'Confiança' : 'Confidence'}</div>
              <div className="text-lg font-bold text-[#E1FFD9]">{(neuralNetwork.confidence * 100).toFixed(1)}%</div>
            </div>
          </div>
        </div>
        
        <canvas 
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full h-[300px] bg-gray-900/50 rounded-lg"
        />
      </div>

      {/* AI Insights */}
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-white font-comfortaa mb-6">
          {isPortuguese ? 'Insights da IA' : 'AI Insights'}
        </h3>
        <div className="space-y-4">
          {aiInsights.map((insight) => (
            <div key={insight.id} className="p-4 bg-gray-800/50 rounded-lg border-l-4 border-[#E1FFD9]">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-white">
                  {isPortuguese ? insight.titlePT : insight.title}
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    insight.impact === 'high' ? 'bg-red-500/20 text-red-400' :
                    insight.impact === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {insight.impact.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-400">
                    {(insight.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-3">
                {isPortuguese ? insight.descriptionPT : insight.description}
              </p>
              {insight.actionable && (
                <div className="bg-[#E1FFD9]/10 p-3 rounded">
                  <div className="text-xs text-gray-400 mb-1">
                    {isPortuguese ? 'Ação Sugerida' : 'Suggested Action'}
                  </div>
                  <div className="text-sm text-[#E1FFD9]">
                    {isPortuguese ? insight.suggestedActionPT : insight.suggestedAction}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderMLPredictions = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-white font-comfortaa mb-6">
          {isPortuguese ? 'Previsões de Machine Learning' : 'Machine Learning Predictions'}
        </h3>
        
        {/* Model Selection */}
        <div className="flex gap-2 mb-6">
          {['lstm', 'transformer', 'random_forest', 'neural_network', 'ensemble'].map((model) => (
            <button
              key={model}
              onClick={() => setSelectedModel(model as PredictionModel)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedModel === model
                  ? 'bg-[#E1FFD9] text-[#2D3748]'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {model.toUpperCase().replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Predictions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiModels.map((model) => (
            <div key={model.id} className="p-4 bg-gray-800/50 rounded-lg">
              <h4 className="font-semibold text-white mb-3">{model.name}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Direção' : 'Direction'}</span>
                  <span className={`font-medium ${
                    model.predictions.nextTrade.direction === 'call' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {model.predictions.nextTrade.direction.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Probabilidade' : 'Probability'}</span>
                  <span className="text-white font-medium">
                    {(model.predictions.nextTrade.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Tendência' : 'Trend'}</span>
                  <span className="text-white font-medium">
                    {model.predictions.marketDirection.trend.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderPatternRecognition = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="text-xl font-semibold text-white font-comfortaa mb-6">
          {isPortuguese ? 'Reconhecimento de Padrões' : 'Pattern Recognition'}
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {recognizedPatterns.map((pattern) => (
            <div key={pattern.id} className="p-4 bg-gray-800/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white">{pattern.name}</h4>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  pattern.tradingSignal === 'strong_buy' ? 'bg-green-500/20 text-green-400' :
                  pattern.tradingSignal === 'buy' ? 'bg-green-500/30 text-green-300' :
                  pattern.tradingSignal === 'hold' ? 'bg-yellow-500/20 text-yellow-400' :
                  pattern.tradingSignal === 'sell' ? 'bg-red-500/30 text-red-300' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {pattern.tradingSignal.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              
              <p className="text-gray-300 text-sm mb-3">
                {isPortuguese ? pattern.descriptionPT : pattern.description}
              </p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Confiança' : 'Confidence'}</span>
                  <span className="text-white font-medium">{pattern.confidence.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Taxa de Sucesso' : 'Success Rate'}</span>
                  <span className="text-white font-medium">{pattern.successRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Retorno Médio' : 'Avg Return'}</span>
                  <span className="text-[#E1FFD9] font-medium">+{pattern.avgReturn.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{isPortuguese ? 'Ocorrências' : 'Occurrences'}</span>
                  <span className="text-white font-medium">{pattern.occurrences}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#505050] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-2xl font-bold text-white mb-2 font-comfortaa">
            {isPortuguese ? 'Inicializando IA...' : 'Initializing AI...'}
          </h2>
          <p className="text-gray-400">
            {isPortuguese ? 'Carregando modelos avançados' : 'Loading advanced models'}
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
            <div className="text-6xl mb-6">🤖</div>
            <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
              {isPortuguese ? 'Analytics V3 IA Avançada' : 'Analytics V3 AI-Powered'}
            </h3>
            <p className="text-gray-300 mb-6">
              {isPortuguese 
                ? 'Precisa de dados de trades para ativar a análise com IA avançada.'
                : 'Need trade data to activate advanced AI analysis.'
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
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="hero-title text-3xl md:text-4xl font-poly font-bold text-white mb-2">
                {isPortuguese ? 'Analytics IA Avançada' : 'AI-Powered Analytics'}
              </h1>
              <p className="text-xl font-comfortaa font-normal text-white">
                {isPortuguese 
                  ? 'Análise preditiva com Machine Learning e redes neurais'
                  : 'Predictive analysis with Machine Learning and neural networks'
                }
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setRealTimeMode(!realTimeMode)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  realTimeMode
                    ? 'bg-[#E1FFD9] text-[#2D3748]'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {isPortuguese ? 'Tempo Real' : 'Real-Time'}
              </button>
              <button
                onClick={() => setAutoOptimization(!autoOptimization)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  autoOptimization
                    ? 'bg-[#E1FFD9] text-[#2D3748]'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {isPortuguese ? 'Auto-Otimização' : 'Auto-Optimization'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { id: 'neural-dashboard', icon: '🧠', label: isPortuguese ? 'Dashboard Neural' : 'Neural Dashboard' },
              { id: 'ml-predictions', icon: '🔮', label: isPortuguese ? 'Previsões ML' : 'ML Predictions' },
              { id: 'pattern-recognition', icon: '🎯', label: isPortuguese ? 'Padrões' : 'Patterns' },
              { id: 'ai-optimization', icon: '⚡', label: isPortuguese ? 'Otimização' : 'Optimization' },
              { id: 'market-sentiment', icon: '📊', label: isPortuguese ? 'Sentimento' : 'Sentiment' },
              { id: 'risk-ai', icon: '🛡️', label: isPortuguese ? 'Risk IA' : 'AI Risk' },
              { id: 'auto-insights', icon: '💡', label: isPortuguese ? 'Insights Auto' : 'Auto Insights' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AIAnalyticsTab)}
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
        {activeTab === 'neural-dashboard' && renderNeuralDashboard()}
        {activeTab === 'ml-predictions' && renderMLPredictions()}
        {activeTab === 'pattern-recognition' && renderPatternRecognition()}
        
        {/* Placeholder for other tabs */}
        {!['neural-dashboard', 'ml-predictions', 'pattern-recognition'].includes(activeTab) && (
          <div className="card text-center py-16">
            <div className="text-6xl mb-6">🚧</div>
            <h3 className="text-2xl font-bold text-white mb-4 font-comfortaa">
              {isPortuguese ? 'Em Desenvolvimento' : 'Under Development'}
            </h3>
            <p className="text-gray-300">
              {isPortuguese 
                ? 'Esta seção avançada está sendo desenvolvida.'
                : 'This advanced section is being developed.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}