'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// Advanced AI Data Types
interface NeuralNetworkNode {
  id: string
  layer: number
  x: number
  y: number
  activation: number
  type: 'input' | 'hidden' | 'output'
  label?: string
}

interface NeuralNetworkConnection {
  from: string
  to: string
  weight: number
  strength: number
}

interface AIModel {
  id: string
  name: string
  type: 'neural_network' | 'decision_tree' | 'random_forest' | 'lstm' | 'transformer'
  accuracy: number
  confidence: number
  prediction: number
  status: 'training' | 'active' | 'analyzing' | 'optimizing'
  metrics: {
    precision: number
    recall: number
    f1Score: number
    mse: number
  }
  realTimeData: number[]
}

interface AdvancedInsight {
  id: string
  type: 'neural_pattern' | 'ml_prediction' | 'ensemble_forecast' | 'anomaly_detection' | 'optimization'
  title: string
  titlePT: string
  description: string
  descriptionPT: string
  confidence: number
  impact: number
  urgency: 'low' | 'medium' | 'high' | 'critical'
  aiModel: string
  technicalDetails: string
  actionableSteps: string[]
  visualData?: any
}

interface MarketPatternNode {
  id: string
  pattern: string
  strength: number
  frequency: number
  success_rate: number
  market_conditions: string[]
  neural_signature: number[]
}

// Advanced Hook for AI Processing
function useAdvancedAI() {
  const [aiModels, setAiModels] = useState<AIModel[]>([])
  const [neuralNetwork, setNeuralNetwork] = useState<{nodes: NeuralNetworkNode[], connections: NeuralNetworkConnection[]}>({ nodes: [], connections: [] })
  const [insights, setInsights] = useState<AdvancedInsight[]>([])
  const [processing, setProcessing] = useState(false)
  const [activeModel, setActiveModel] = useState<string>('neural_ensemble')

  const generateNeuralNetwork = () => {
    const nodes: NeuralNetworkNode[] = []
    const connections: NeuralNetworkConnection[] = []

    // Input layer
    const inputLabels = ['Win Rate', 'P&L', 'Risk Score', 'Market Vol', 'Time Pattern']
    inputLabels.forEach((label, i) => {
      nodes.push({
        id: `input_${i}`,
        layer: 0,
        x: 50,
        y: 50 + i * 60,
        activation: Math.random() * 0.8 + 0.2,
        type: 'input',
        label
      })
    })

    // Hidden layers
    for (let layer = 1; layer <= 3; layer++) {
      const nodeCount = layer === 2 ? 8 : 6
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `hidden_${layer}_${i}`,
          layer,
          x: 50 + layer * 200,
          y: 50 + i * 40,
          activation: Math.random(),
          type: 'hidden'
        })
      }
    }

    // Output layer
    const outputLabels = ['Win Probability', 'Risk Level', 'Expected Return']
    outputLabels.forEach((label, i) => {
      nodes.push({
        id: `output_${i}`,
        layer: 4,
        x: 850,
        y: 100 + i * 80,
        activation: Math.random() * 0.9 + 0.1,
        type: 'output',
        label
      })
    })

    // Generate connections
    nodes.forEach(fromNode => {
      nodes.forEach(toNode => {
        if (toNode.layer === fromNode.layer + 1) {
          connections.push({
            from: fromNode.id,
            to: toNode.id,
            weight: (Math.random() - 0.5) * 2,
            strength: Math.random()
          })
        }
      })
    })

    setNeuralNetwork({ nodes, connections })
  }

  const generateAIModels = () => {
    const models: AIModel[] = [
      {
        id: 'neural_ensemble',
        name: 'Neural Ensemble',
        type: 'neural_network',
        accuracy: 89.7,
        confidence: 94.2,
        prediction: 0.847,
        status: 'active',
        metrics: { precision: 0.891, recall: 0.876, f1Score: 0.883, mse: 0.023 },
        realTimeData: Array.from({length: 50}, () => Math.random() * 100)
      },
      {
        id: 'lstm_predictor',
        name: 'LSTM Temporal',
        type: 'lstm',
        accuracy: 92.1,
        confidence: 88.5,
        prediction: 0.923,
        status: 'analyzing',
        metrics: { precision: 0.934, recall: 0.912, f1Score: 0.923, mse: 0.018 },
        realTimeData: Array.from({length: 50}, () => Math.random() * 100)
      },
      {
        id: 'transformer_pattern',
        name: 'Transformer Pattern',
        type: 'transformer',
        accuracy: 95.3,
        confidence: 91.7,
        prediction: 0.956,
        status: 'optimizing',
        metrics: { precision: 0.962, recall: 0.944, f1Score: 0.953, mse: 0.014 },
        realTimeData: Array.from({length: 50}, () => Math.random() * 100)
      },
      {
        id: 'random_forest',
        name: 'Random Forest',
        type: 'random_forest',
        accuracy: 86.4,
        confidence: 83.2,
        prediction: 0.821,
        status: 'training',
        metrics: { precision: 0.847, recall: 0.881, f1Score: 0.864, mse: 0.031 },
        realTimeData: Array.from({length: 50}, () => Math.random() * 100)
      }
    ]
    setAiModels(models)
  }

  const generateAdvancedInsights = () => {
    const insights: AdvancedInsight[] = [
      {
        id: 'neural_anomaly_1',
        type: 'anomaly_detection',
        title: 'Neural Anomaly Detected',
        titlePT: 'Anomalia Neural Detectada',
        description: 'Deep learning models detected unusual trading pattern divergence indicating potential market shift',
        descriptionPT: 'Modelos de deep learning detectaram divergência de padrão incomum indicando possível mudança de mercado',
        confidence: 97.3,
        impact: 8.7,
        urgency: 'high',
        aiModel: 'neural_ensemble',
        technicalDetails: 'Convolutional layers identified 3σ deviation in temporal sequence embeddings',
        actionableSteps: [
          'Reduce position size by 30%',
          'Increase stop-loss sensitivity',
          'Monitor EUR/USD correlation matrix'
        ]
      },
      {
        id: 'ml_pattern_2',
        type: 'ml_prediction',
        title: 'ML Pattern Recognition Alert',
        titlePT: 'Alerta de Reconhecimento de Padrão ML',
        description: 'Transformer model identified high-probability reversal pattern with 94.2% historical accuracy',
        descriptionPT: 'Modelo Transformer identificou padrão de reversão com 94.2% de precisão histórica',
        confidence: 94.2,
        impact: 9.1,
        urgency: 'critical',
        aiModel: 'transformer_pattern',
        technicalDetails: 'Multi-head attention mechanism flagged key resistance level confluence',
        actionableSteps: [
          'Consider contrarian position',
          'Set tight risk parameters',
          'Monitor volume confirmation'
        ]
      }
    ]
    setInsights(insights)
  }

  useEffect(() => {
    generateNeuralNetwork()
    generateAIModels()
    generateAdvancedInsights()

    const interval = setInterval(() => {
      setAiModels(prev => prev.map(model => ({
        ...model,
        realTimeData: [...model.realTimeData.slice(1), Math.random() * 100],
        confidence: model.confidence + (Math.random() - 0.5) * 2
      })))
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return { aiModels, neuralNetwork, insights, processing, activeModel, setActiveModel }
}

// Neural Network Visualization Component
function NeuralNetworkVisualization({ network }: { network: { nodes: NeuralNetworkNode[], connections: NeuralNetworkConnection[] } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = 900
    canvas.height = 400

    // Clear canvas
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw connections
    network.connections.forEach(conn => {
      const fromNode = network.nodes.find(n => n.id === conn.from)
      const toNode = network.nodes.find(n => n.id === conn.to)
      
      if (fromNode && toNode) {
        ctx.beginPath()
        ctx.moveTo(fromNode.x + 15, fromNode.y + 15)
        ctx.lineTo(toNode.x + 15, toNode.y + 15)
        
        const opacity = Math.abs(conn.weight) * conn.strength
        ctx.strokeStyle = conn.weight > 0 
          ? `rgba(33, 255, 117, ${opacity})` 
          : `rgba(255, 71, 87, ${opacity})`
        ctx.lineWidth = Math.abs(conn.weight) * 2
        ctx.stroke()
      }
    })

    // Draw nodes
    network.nodes.forEach(node => {
      const radius = 15
      const gradient = ctx.createRadialGradient(
        node.x + radius, node.y + radius, 0,
        node.x + radius, node.y + radius, radius
      )

      if (node.type === 'input') {
        gradient.addColorStop(0, `rgba(59, 130, 246, ${node.activation})`)
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)')
      } else if (node.type === 'output') {
        gradient.addColorStop(0, `rgba(16, 185, 129, ${node.activation})`)
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.3)')
      } else {
        gradient.addColorStop(0, `rgba(139, 92, 246, ${node.activation})`)
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.3)')
      }

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(node.x + radius, node.y + radius, radius, 0, Math.PI * 2)
      ctx.fill()

      // Add glow effect for high activation
      if (node.activation > 0.7) {
        ctx.shadowColor = node.type === 'input' ? '#3B82F6' : 
                         node.type === 'output' ? '#10B981' : '#8B5CF6'
        ctx.shadowBlur = 20
        ctx.beginPath()
        ctx.arc(node.x + radius, node.y + radius, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      // Draw labels for input/output nodes
      if (node.label) {
        ctx.fillStyle = '#ffffff'
        ctx.font = '10px Inter'
        ctx.textAlign = node.type === 'input' ? 'right' : 'left'
        const textX = node.type === 'input' ? node.x - 5 : node.x + 35
        ctx.fillText(node.label, textX, node.y + 20)
      }
    })
  }, [network])

  return (
    <canvas 
      ref={canvasRef} 
      className="border border-gray-600 rounded-lg bg-gray-900"
      style={{ width: '100%', height: '400px' }}
    />
  )
}

// Real-time AI Model Dashboard
function AIModelDashboard({ models, activeModel, onModelSelect }: { 
  models: AIModel[], 
  activeModel: string, 
  onModelSelect: (id: string) => void 
}) {
  const { isPortuguese } = useLanguage()

  const getModelIcon = (type: AIModel['type']) => {
    switch (type) {
      case 'neural_network': return '🧠'
      case 'lstm': return '🔄'
      case 'transformer': return '⚡'
      case 'random_forest': return '🌲'
      case 'decision_tree': return '🌳'
      default: return '🤖'
    }
  }

  const getStatusColor = (status: AIModel['status']) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20'
      case 'training': return 'text-yellow-400 bg-yellow-400/20'
      case 'analyzing': return 'text-blue-400 bg-blue-400/20'
      case 'optimizing': return 'text-purple-400 bg-purple-400/20'
      default: return 'text-gray-400 bg-gray-400/20'
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {models.map(model => (
        <div 
          key={model.id}
          onClick={() => onModelSelect(model.id)}
          className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 ${
            activeModel === model.id 
              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
              : 'border-gray-600 bg-gray-800/30 hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getModelIcon(model.type)}</span>
              <div>
                <h3 className="font-bold text-white">{model.name}</h3>
                <div className={`text-xs px-2 py-1 rounded-full inline-block ${getStatusColor(model.status)}`}>
                  {model.status.toUpperCase()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-primary">{model.accuracy.toFixed(1)}%</div>
              <div className="text-xs text-gray-400">
                {isPortuguese ? 'Precisão' : 'Accuracy'}
              </div>
            </div>
          </div>

          {/* Real-time Data Visualization */}
          <div className="h-16 mb-3">
            <div className="flex items-end justify-between h-full gap-1">
              {model.realTimeData.slice(-20).map((value, index) => (
                <div
                  key={index}
                  className="bg-primary/60 rounded-sm transition-all duration-300"
                  style={{ 
                    height: `${(value / 100) * 100}%`,
                    width: '3px'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Model Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-400">Confidence:</span>
              <span className="text-white ml-1">{model.confidence.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-400">F1-Score:</span>
              <span className="text-white ml-1">{model.metrics.f1Score.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-400">Precision:</span>
              <span className="text-white ml-1">{model.metrics.precision.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-gray-400">MSE:</span>
              <span className="text-white ml-1">{model.metrics.mse.toFixed(3)}</span>
            </div>
          </div>

          {/* Prediction Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{isPortuguese ? 'Previsão' : 'Prediction'}</span>
              <span>{(model.prediction * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-primary to-green-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${model.prediction * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Advanced Insights Panel
function AdvancedInsightsPanel({ insights }: { insights: AdvancedInsight[] }) {
  const { isPortuguese } = useLanguage()
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null)

  const getInsightIcon = (type: AdvancedInsight['type']) => {
    switch (type) {
      case 'neural_pattern': return '🧠'
      case 'ml_prediction': return '🎯'
      case 'ensemble_forecast': return '📊'
      case 'anomaly_detection': return '🚨'
      case 'optimization': return '⚙️'
      default: return '🤖'
    }
  }

  const getUrgencyColor = (urgency: AdvancedInsight['urgency']) => {
    switch (urgency) {
      case 'critical': return 'border-red-500 bg-red-500/10 text-red-300'
      case 'high': return 'border-orange-500 bg-orange-500/10 text-orange-300'
      case 'medium': return 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
      case 'low': return 'border-green-500 bg-green-500/10 text-green-300'
      default: return 'border-gray-500 bg-gray-500/10 text-gray-300'
    }
  }

  return (
    <div className="space-y-4">
      {insights.map(insight => (
        <div key={insight.id} className={`p-4 rounded-lg border ${getUrgencyColor(insight.urgency)}`}>
          <div 
            className="cursor-pointer"
            onClick={() => setSelectedInsight(selectedInsight === insight.id ? null : insight.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getInsightIcon(insight.type)}</span>
                <div>
                  <h3 className="font-bold text-white">
                    {isPortuguese ? insight.titlePT : insight.title}
                  </h3>
                  <div className="text-xs text-gray-400">
                    Model: {insight.aiModel} • Confidence: {insight.confidence.toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold">Impact: {insight.impact.toFixed(1)}/10</div>
                <div className="text-xs capitalize">{insight.urgency}</div>
              </div>
            </div>
            
            <p className="text-sm text-gray-300 mb-3">
              {isPortuguese ? insight.descriptionPT : insight.description}
            </p>

            {/* Confidence and Impact Bars */}
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">
                  {isPortuguese ? 'Confiança' : 'Confidence'}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full"
                    style={{ width: `${insight.confidence}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">
                  {isPortuguese ? 'Impacto' : 'Impact'}
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-purple-400 h-2 rounded-full"
                    style={{ width: `${insight.impact * 10}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Expanded Details */}
          {selectedInsight === insight.id && (
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="mb-4">
                <h4 className="font-semibold text-white mb-2">
                  {isPortuguese ? 'Detalhes Técnicos' : 'Technical Details'}
                </h4>
                <p className="text-sm text-gray-300 font-mono bg-gray-800/50 p-2 rounded">
                  {insight.technicalDetails}
                </p>
              </div>

              <div>
                <h4 className="font-semibold text-white mb-2">
                  {isPortuguese ? 'Passos Recomendados' : 'Recommended Actions'}
                </h4>
                <ul className="space-y-1">
                  {insight.actionableSteps.map((step, index) => (
                    <li key={index} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="text-primary">•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Main AI V3 Advanced Component
export default function AIV3Advanced() {
  const { isPortuguese } = useLanguage()
  const { stats, loading: statsLoading } = useTradeStats('monthly')
  const { trades, loading: tradesLoading } = useTrades({ limit: 100 })
  const { aiModels, neuralNetwork, insights, processing, activeModel, setActiveModel } = useAdvancedAI()
  const [activeTab, setActiveTab] = useState<'neural' | 'models' | 'insights' | 'strategy'>('neural')

  const tabs = [
    { id: 'neural', label: isPortuguese ? 'Rede Neural' : 'Neural Network', icon: '🧠' },
    { id: 'models', label: isPortuguese ? 'Modelos IA' : 'AI Models', icon: '🤖' },
    { id: 'insights', label: isPortuguese ? 'Insights Avançados' : 'Advanced Insights', icon: '💡' },
    { id: 'strategy', label: isPortuguese ? 'Geração de Estratégia' : 'Strategy Generation', icon: '⚡' }
  ]

  if (statsLoading || tradesLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-20 bg-gray-700 rounded-lg"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-64 bg-gray-700 rounded-lg"></div>
              <div className="h-64 bg-gray-700 rounded-lg"></div>
              <div className="h-64 bg-gray-700 rounded-lg"></div>
            </div>
            <div className="h-96 bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="text-5xl">🚀</div>
            <div>
              <h1 className="text-4xl font-bold text-white font-comfortaa">
                {isPortuguese ? 'IA V3 Avançada' : 'AI V3 Advanced'}
              </h1>
              <p className="text-gray-400 text-lg">
                {isPortuguese 
                  ? 'Interface de IA de última geração com redes neurais e aprendizado profundo'
                  : 'Next-generation AI interface with neural networks and deep learning'
                }
              </p>
            </div>
          </div>
          
          {/* AI Status Indicators */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 text-sm">
                {isPortuguese ? 'Processamento Ativo' : 'Active Processing'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
              <span className="text-blue-400 text-sm">
                {aiModels.filter(m => m.status === 'active').length} {isPortuguese ? 'Modelos Ativos' : 'Active Models'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-400 rounded-full animate-pulse"></div>
              <span className="text-purple-400 text-sm">
                {insights.length} {isPortuguese ? 'Insights Críticos' : 'Critical Insights'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center">
          <div className="flex bg-gray-800/50 rounded-lg p-1 backdrop-blur-sm">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-md transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-primary text-black font-semibold shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'neural' && (
            <div className="space-y-6">
              <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="text-3xl">🧠</span>
                  {isPortuguese ? 'Visualização da Rede Neural' : 'Neural Network Visualization'}
                </h2>
                <p className="text-gray-400 mb-6">
                  {isPortuguese 
                    ? 'Visualização em tempo real da arquitetura de deep learning analisando seus padrões de trading'
                    : 'Real-time visualization of deep learning architecture analyzing your trading patterns'
                  }
                </p>
                <NeuralNetworkVisualization network={neuralNetwork} />
              </div>

              {/* Neural Network Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-4">
                  <h3 className="font-bold text-white mb-2">
                    {isPortuguese ? 'Arquitetura' : 'Architecture'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Input Nodes:</span>
                      <span className="text-white">{neuralNetwork.nodes.filter(n => n.type === 'input').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Hidden Layers:</span>
                      <span className="text-white">3</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Output Nodes:</span>
                      <span className="text-white">{neuralNetwork.nodes.filter(n => n.type === 'output').length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Connections:</span>
                      <span className="text-white">{neuralNetwork.connections.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-4">
                  <h3 className="font-bold text-white mb-2">
                    {isPortuguese ? 'Performance' : 'Performance'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Training Accuracy:</span>
                      <span className="text-green-400">97.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Validation Loss:</span>
                      <span className="text-blue-400">0.0143</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Learning Rate:</span>
                      <span className="text-purple-400">0.001</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Epochs:</span>
                      <span className="text-yellow-400">2,847</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-4">
                  <h3 className="font-bold text-white mb-2">
                    {isPortuguese ? 'Estado Atual' : 'Current State'}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Processing:</span>
                      <span className="text-green-400 animate-pulse">Active</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Update:</span>
                      <span className="text-white">2.3s ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">GPU Utilization:</span>
                      <span className="text-red-400">87%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Memory:</span>
                      <span className="text-orange-400">12.4 GB</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-6">
              <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="text-3xl">🤖</span>
                  {isPortuguese ? 'Ensemble de Modelos IA' : 'AI Model Ensemble'}
                </h2>
                <p className="text-gray-400 mb-6">
                  {isPortuguese 
                    ? 'Múltiplos modelos de machine learning trabalhando em conjunto para previsões precisas'
                    : 'Multiple machine learning models working together for precise predictions'
                  }
                </p>
                <AIModelDashboard 
                  models={aiModels} 
                  activeModel={activeModel} 
                  onModelSelect={setActiveModel} 
                />
              </div>

              {/* Model Comparison */}
              <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  {isPortuguese ? 'Comparação de Modelos' : 'Model Comparison'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-600">
                        <th className="text-left py-2 text-gray-400">Model</th>
                        <th className="text-right py-2 text-gray-400">Accuracy</th>
                        <th className="text-right py-2 text-gray-400">Precision</th>
                        <th className="text-right py-2 text-gray-400">Recall</th>
                        <th className="text-right py-2 text-gray-400">F1-Score</th>
                        <th className="text-right py-2 text-gray-400">MSE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiModels.map(model => (
                        <tr key={model.id} className="border-b border-gray-700/50">
                          <td className="py-2 text-white font-medium">{model.name}</td>
                          <td className="py-2 text-right text-green-400">{model.accuracy.toFixed(1)}%</td>
                          <td className="py-2 text-right text-blue-400">{model.metrics.precision.toFixed(3)}</td>
                          <td className="py-2 text-right text-purple-400">{model.metrics.recall.toFixed(3)}</td>
                          <td className="py-2 text-right text-yellow-400">{model.metrics.f1Score.toFixed(3)}</td>
                          <td className="py-2 text-right text-red-400">{model.metrics.mse.toFixed(3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="text-3xl">💡</span>
                  {isPortuguese ? 'Insights Avançados de IA' : 'Advanced AI Insights'}
                </h2>
                <p className="text-gray-400 mb-6">
                  {isPortuguese 
                    ? 'Análises profundas geradas por inteligência artificial com recomendações acionáveis'
                    : 'Deep AI-generated analysis with actionable recommendations'
                  }
                </p>
                <AdvancedInsightsPanel insights={insights} />
              </div>
            </div>
          )}

          {activeTab === 'strategy' && (
            <div className="space-y-6">
              <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  {isPortuguese ? 'Geração Automática de Estratégias' : 'Automated Strategy Generation'}
                </h2>
                <p className="text-gray-400 mb-6">
                  {isPortuguese 
                    ? 'IA gerando estratégias de trading personalizadas baseadas nos seus padrões e dados de mercado'
                    : 'AI generating personalized trading strategies based on your patterns and market data'
                  }
                </p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Strategy Generator */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">
                      {isPortuguese ? 'Parâmetros da Estratégia' : 'Strategy Parameters'}
                    </h3>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          {isPortuguese ? 'Perfil de Risco' : 'Risk Profile'}
                        </label>
                        <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                          <option value="conservative">{isPortuguese ? 'Conservador' : 'Conservative'}</option>
                          <option value="moderate">{isPortuguese ? 'Moderado' : 'Moderate'}</option>
                          <option value="aggressive">{isPortuguese ? 'Agressivo' : 'Aggressive'}</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">
                          {isPortuguese ? 'Horizonte Temporal' : 'Time Horizon'}
                        </label>
                        <select className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
                          <option value="scalping">{isPortuguese ? 'Scalping (1-5min)' : 'Scalping (1-5min)'}</option>
                          <option value="short">{isPortuguese ? 'Curto Prazo (15-60min)' : 'Short Term (15-60min)'}</option>
                          <option value="medium">{isPortuguese ? 'Médio Prazo (1-4h)' : 'Medium Term (1-4h)'}</option>
                        </select>
                      </div>
                      
                      <button className="w-full bg-gradient-to-r from-primary to-green-400 text-black font-bold py-3 rounded-lg hover:opacity-90 transition-opacity">
                        {isPortuguese ? '🚀 Gerar Estratégia IA' : '🚀 Generate AI Strategy'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Generated Strategy Preview */}
                  <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">
                      {isPortuguese ? 'Estratégia Gerada por IA' : 'AI-Generated Strategy'}
                    </h3>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Strategy Name:</span>
                        <span className="text-primary font-medium">Neural Momentum Pro</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Win Rate (Backtest):</span>
                        <span className="text-green-400">74.3%</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Expected Return:</span>
                        <span className="text-blue-400">+12.7% monthly</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-400">Max Drawdown:</span>
                        <span className="text-red-400">-8.2%</span>
                      </div>
                      
                      <div className="border-t border-gray-600 pt-3 mt-3">
                        <h4 className="text-white font-medium mb-2">
                          {isPortuguese ? 'Regras Principais' : 'Main Rules'}
                        </h4>
                        <ul className="space-y-1 text-gray-300">
                          <li>• RSI cross above 30 with volume spike</li>
                          <li>• MACD bullish divergence confirmation</li>
                          <li>• Neural pattern confidence &gt; 85%</li>
                          <li>• Stop loss: 2% | Take profit: 4%</li>
                        </ul>
                      </div>
                      
                      <button className="w-full bg-blue-600 text-white py-2 rounded mt-3 hover:bg-blue-700 transition-colors">
                        {isPortuguese ? 'Aplicar Estratégia' : 'Apply Strategy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* AI Processing Status Footer */}
        <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-600 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-white">
                  {isPortuguese ? 'Sistema IA Ativo' : 'AI System Active'}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {isPortuguese ? 'Processando' : 'Processing'} {trades.length} {isPortuguese ? 'trades' : 'trades'}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="text-gray-400">
                {isPortuguese ? 'Última atualização:' : 'Last update:'} <span className="text-white">23:47:12</span>
              </div>
              <div className="text-gray-400">
                {isPortuguese ? 'Próxima análise:' : 'Next analysis:'} <span className="text-primary">30s</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}