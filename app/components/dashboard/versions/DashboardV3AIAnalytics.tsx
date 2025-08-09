'use client'

import React from 'react'
import HeroSection from '@/components/dashboard/HeroSection'
import HeroSectionPT from '@/components/dashboard/HeroSectionPT'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'
import { useTrades } from '@/hooks/useTrades'

export default function DashboardV3AIAnalytics() {
  const { isPortuguese } = useLanguage()
  const { stats } = useTradeStats('weekly')
  const { trades } = useTrades()

  // Mock AI analysis data and predictions
  const aiAnalyticsData = {
    aiConfidence: 87,
    patternsIdentified: 12,
    nextTradeSuccess: 67,
    riskScore: 3.2,
    marketSentiment: {
      direction: 'Bullish',
      confidence: 72,
      volatility: 'Medium-High'
    },
    optimalTradingWindow: '14:30-16:00 UTC',
    recommendedAsset: 'EUR/USD',
    aiInsights: [
      {
        id: 1,
        type: 'performance',
        title: isPortuguese ? 'Padrão de Performance Identificado' : 'Performance Pattern Identified',
        message: isPortuguese 
          ? 'Sua taxa de acerto aumenta 15% quando negocia EUR/USD às terças-feiras'
          : 'Your win rate increases by 15% when trading EUR/USD on Tuesdays',
        confidence: 89,
        icon: '🧠'
      },
      {
        id: 2,
        type: 'strategy',
        title: isPortuguese ? 'Estratégia Otimizada Detectada' : 'Optimized Strategy Detected',
        message: isPortuguese 
          ? 'Padrão detectado: Você performa melhor com stakes menores ($25-35)'
          : 'Pattern detected: You perform better with smaller stakes ($25-35)',
        confidence: 76,
        icon: '🎯'
      },
      {
        id: 3,
        type: 'risk',
        title: isPortuguese ? 'Alerta de Risco' : 'Risk Alert',
        message: isPortuguese 
          ? 'Estratégia atual mostra 73% de correlação com volatilidade do mercado'
          : 'Current strategy shows 73% correlation with market volatility',
        confidence: 73,
        icon: '⚠️'
      }
    ],
    predictiveModels: [
      {
        name: isPortuguese ? 'Probabilidade de Sucesso' : 'Next Trade Success',
        value: '67%',
        trend: 'up',
        confidence: 84,
        icon: '🔮'
      },
      {
        name: isPortuguese ? 'Janela Ótima' : 'Optimal Window',
        value: '14:30-16:00',
        trend: 'stable',
        confidence: 91,
        icon: '⏰'
      },
      {
        name: isPortuguese ? 'Asset Recomendado' : 'Recommended Asset',
        value: 'EUR/USD',
        trend: 'up',
        confidence: 84,
        icon: '💱'
      },
      {
        name: isPortuguese ? 'Score de Risco' : 'Risk Score',
        value: '3.2/5.0',
        trend: 'stable',
        confidence: 78,
        icon: '🛡️'
      }
    ],
    patternRecognition: {
      profitablePatterns: 3,
      bestStrategy: isPortuguese ? 'Seguir Tendência' : 'Trend Following',
      bestWinRate: 78,
      weakness: isPortuguese ? 'Trading em alta volatilidade' : 'Trading during high volatility periods'
    },
    anomalyDetection: [
      {
        type: 'unusual_volume',
        severity: 'medium',
        message: isPortuguese ? 'Volume acima da média detectado' : 'Above average volume activity detected',
        timestamp: '2h ago'
      },
      {
        type: 'correlation_break',
        severity: 'high',
        message: isPortuguese ? 'Quebra de correlação USD/JPY identificada' : 'USD/JPY correlation break identified',
        timestamp: '45m ago'
      }
    ]
  }

  // Calculate real-time metrics from actual data
  const winRate = stats ? (stats.winTrades / stats.totalTrades) * 100 : 60
  const profitability = stats?.totalPnl || 34

  return (
    <>
      {/* Hero Section - Keep personalized welcome and CTA */}
      {isPortuguese ? <HeroSectionPT /> : <HeroSection />}
      
      {/* VERSION 3: AI ANALYTICS DASHBOARD - Future of Trading */}
      
      {/* AI Confidence & Overview */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-4xl font-bold mb-4 bg-gradient-to-r from-orange-400 via-red-400 to-orange-600 bg-clip-text text-transparent">
                🤖 {isPortuguese ? 'Centro de Inteligência Artificial' : 'AI Intelligence Center'}
              </h2>
              <p className="text-gray-400 max-w-3xl mx-auto text-lg">
                {isPortuguese 
                  ? 'Análise preditiva avançada com machine learning e reconhecimento de padrões para maximizar seus resultados'
                  : 'Advanced predictive analytics with machine learning and pattern recognition to maximize your results'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* AI Confidence Score */}
              <div className="card bg-gradient-to-br from-orange-900/30 to-red-900/30 border-orange-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-red-500/10 opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-4xl">🧠</div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-orange-300">{aiAnalyticsData.aiConfidence}%</div>
                      <div className="text-orange-400 text-sm">{isPortuguese ? 'Confiança IA' : 'AI Confidence'}</div>
                    </div>
                  </div>
                  
                  <h3 className="font-heading text-xl font-bold text-orange-300 mb-3">
                    {isPortuguese ? 'Sistema Neural Ativo' : 'Neural System Active'}
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">{isPortuguese ? 'Padrões Identificados' : 'Patterns Identified'}</span>
                      <span className="text-orange-300 font-bold">{aiAnalyticsData.patternsIdentified}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">{isPortuguese ? 'Modelos Ativos' : 'Active Models'}</span>
                      <span className="text-orange-300 font-bold">7</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">{isPortuguese ? 'Precisão Histórica' : 'Historical Accuracy'}</span>
                      <span className="text-orange-300 font-bold">84.3%</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-orange-500/20">
                    <div className="w-full bg-orange-900/50 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-1000"
                        style={{ width: `${aiAnalyticsData.aiConfidence}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-orange-400 mt-1 text-center">
                      {isPortuguese ? 'Sistema de IA Otimizado' : 'AI System Optimized'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Predictions */}
              <div className="card bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-4xl animate-pulse">🔮</div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-cyan-300">{aiAnalyticsData.nextTradeSuccess}%</div>
                      <div className="text-cyan-400 text-sm">{isPortuguese ? 'Próximo Trade' : 'Next Trade'}</div>
                    </div>
                  </div>
                  
                  <h3 className="font-heading text-xl font-bold text-cyan-300 mb-3">
                    {isPortuguese ? 'Predições em Tempo Real' : 'Real-time Predictions'}
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="bg-cyan-900/30 rounded-lg p-3">
                      <div className="text-sm text-cyan-300 mb-1">{isPortuguese ? 'Asset Recomendado' : 'Recommended Asset'}</div>
                      <div className="text-white font-bold">{aiAnalyticsData.recommendedAsset}</div>
                      <div className="text-xs text-cyan-400">84% {isPortuguese ? 'sucesso histórico' : 'historical success'}</div>
                    </div>
                    <div className="bg-cyan-900/30 rounded-lg p-3">
                      <div className="text-sm text-cyan-300 mb-1">{isPortuguese ? 'Janela Ótima' : 'Optimal Window'}</div>
                      <div className="text-white font-bold">{aiAnalyticsData.optimalTradingWindow}</div>
                      <div className="text-xs text-cyan-400">{isPortuguese ? 'Baseado em análise histórica' : 'Based on historical analysis'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Market Sentiment AI */}
              <div className="card bg-gradient-to-br from-purple-900/30 to-pink-900/30 border-purple-400/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-4xl">📊</div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-purple-300">{aiAnalyticsData.marketSentiment.direction}</div>
                      <div className="text-purple-400 text-sm">{aiAnalyticsData.marketSentiment.confidence}% {isPortuguese ? 'confiança' : 'confidence'}</div>
                    </div>
                  </div>
                  
                  <h3 className="font-heading text-xl font-bold text-purple-300 mb-3">
                    {isPortuguese ? 'Sentimento do Mercado' : 'Market Sentiment AI'}
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-300">{isPortuguese ? 'Tendência:' : 'Trend:'} <span className="text-green-400 font-bold">{isPortuguese ? 'Alta' : 'Bullish'}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-300">{isPortuguese ? 'Volatilidade:' : 'Volatility:'} <span className="text-yellow-400 font-bold">{aiAnalyticsData.marketSentiment.volatility}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                      <span className="text-sm text-gray-300">{isPortuguese ? 'Volume:' : 'Volume:'} <span className="text-blue-400 font-bold">{isPortuguese ? 'Acima da Média' : 'Above Average'}</span></span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-purple-500/20">
                    <div className="text-xs text-purple-400 text-center">
                      {isPortuguese ? 'Análise Neural de Mercado' : 'Neural Market Analysis'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Insights Panel */}
      <section className="py-16 bg-dark-card/30">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                ⚡ {isPortuguese ? 'Insights Inteligentes' : 'Smart Insights'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Descobertas automáticas da IA baseadas na análise dos seus padrões de trading'
                  : 'Automated AI discoveries based on analysis of your trading patterns'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {aiAnalyticsData.aiInsights.map((insight) => (
                <div key={insight.id} className="card bg-gradient-to-br from-gray-800/50 to-gray-900/50 border-orange-400/20 hover:border-orange-400/40 transition-all duration-300 hover:scale-105">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{insight.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-orange-300">{insight.title}</h3>
                        <div className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 rounded-full">
                          {insight.confidence}%
                        </div>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{insight.message}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                        <span className="text-xs text-orange-400">{isPortuguese ? 'Análise Ativa' : 'Active Analysis'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Predictive Models */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                🎯 {isPortuguese ? 'Modelos Preditivos' : 'Predictive Models'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Algoritmos de machine learning analisando seus dados para previsões precisas'
                  : 'Machine learning algorithms analyzing your data for accurate predictions'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {aiAnalyticsData.predictiveModels.map((model, index) => (
                <div key={index} className="card bg-gradient-to-br from-cyan-800/30 to-blue-800/30 border-cyan-400/30 hover:scale-105 transition-all duration-300">
                  <div className="text-center">
                    <div className="text-4xl mb-4">{model.icon}</div>
                    <h3 className="font-heading text-lg font-bold text-cyan-300 mb-2">{model.name}</h3>
                    <div className="text-2xl font-bold text-white mb-2">{model.value}</div>
                    
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${
                        model.trend === 'up' ? 'bg-green-400' : 
                        model.trend === 'down' ? 'bg-red-400' : 'bg-yellow-400'
                      } animate-pulse`}></div>
                      <span className="text-xs text-cyan-400">
                        {model.confidence}% {isPortuguese ? 'precisão' : 'accuracy'}
                      </span>
                    </div>
                    
                    <div className="bg-cyan-900/30 rounded-lg p-2">
                      <div className="text-xs text-cyan-300">{isPortuguese ? 'Modelo ML' : 'ML Model'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pattern Recognition & Risk Analysis */}
      <section className="py-16 bg-dark-card/30">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Pattern Recognition */}
              <div className="card bg-gradient-to-br from-green-800/30 to-emerald-800/30 border-green-400/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-4xl">🔍</div>
                  <h3 className="font-heading text-2xl font-bold text-green-300">
                    {isPortuguese ? 'Reconhecimento de Padrões' : 'Pattern Recognition'}
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-green-900/30 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-green-300 font-semibold">{isPortuguese ? 'Padrões Lucrativos' : 'Profitable Patterns'}</span>
                      <span className="text-2xl font-bold text-green-300">{aiAnalyticsData.patternRecognition.profitablePatterns}</span>
                    </div>
                    <div className="text-sm text-green-400">{isPortuguese ? 'Identificados nos últimos 30 dias' : 'Identified in last 30 days'}</div>
                  </div>
                  
                  <div className="bg-green-900/30 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-green-300 font-semibold">{isPortuguese ? 'Melhor Estratégia' : 'Best Strategy'}</span>
                      <span className="text-green-300 font-bold">{aiAnalyticsData.patternRecognition.bestWinRate}%</span>
                    </div>
                    <div className="text-sm text-green-400">{aiAnalyticsData.patternRecognition.bestStrategy}</div>
                  </div>
                  
                  <div className="bg-red-900/30 rounded-lg p-4 border border-red-500/20">
                    <div className="text-red-300 font-semibold mb-2">{isPortuguese ? 'Fraqueza Identificada' : 'Weakness Detected'}</div>
                    <div className="text-sm text-red-400">{aiAnalyticsData.patternRecognition.weakness}</div>
                  </div>
                </div>
              </div>

              {/* Risk Analysis */}
              <div className="card bg-gradient-to-br from-red-800/30 to-orange-800/30 border-red-400/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-4xl">🛡️</div>
                  <h3 className="font-heading text-2xl font-bold text-red-300">
                    {isPortuguese ? 'Análise de Risco IA' : 'AI Risk Analysis'}
                  </h3>
                </div>
                
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <div className="text-5xl font-bold text-red-300 mb-2">
                      {aiAnalyticsData.riskScore}/5.0
                    </div>
                    <div className="text-red-400">{isPortuguese ? 'Score de Risco Atual' : 'Current Risk Score'}</div>
                    <div className="text-sm text-gray-400 mt-1">{isPortuguese ? 'Risco Médio' : 'Medium Risk'}</div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">{isPortuguese ? 'Exposição de Portfólio' : 'Portfolio Exposure'}</span>
                      <span className="text-yellow-400">65%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">{isPortuguese ? 'Correlação de Mercado' : 'Market Correlation'}</span>
                      <span className="text-red-400">73%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">{isPortuguese ? 'Drawdown Máximo' : 'Max Drawdown'}</span>
                      <span className="text-red-400">-12.5%</span>
                    </div>
                  </div>
                  
                  <div className="bg-red-900/30 rounded-lg p-3 mt-4">
                    <div className="text-red-300 font-semibold text-sm">{isPortuguese ? 'Recomendação IA' : 'AI Recommendation'}</div>
                    <div className="text-xs text-red-400 mt-1">
                      {isPortuguese 
                        ? 'Considere reduzir exposição durante alta volatilidade'
                        : 'Consider reducing exposure during high volatility'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Anomaly Detection */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                🚨 {isPortuguese ? 'Detecção de Anomalias' : 'Anomaly Detection'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Sistema de alerta em tempo real para padrões incomuns no mercado'
                  : 'Real-time alert system for unusual market patterns'
                }
              </p>
            </div>
            
            <div className="space-y-4">
              {aiAnalyticsData.anomalyDetection.map((anomaly, index) => (
                <div key={index} className={`card ${
                  anomaly.severity === 'high' 
                    ? 'bg-gradient-to-r from-red-800/30 to-orange-800/30 border-red-400/40' 
                    : 'bg-gradient-to-r from-yellow-800/30 to-amber-800/30 border-yellow-400/40'
                } hover:scale-[1.02] transition-all duration-300`}>
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl ${anomaly.severity === 'high' ? 'animate-bounce' : 'animate-pulse'}`}>
                      {anomaly.severity === 'high' ? '🔴' : '🟡'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`font-bold ${
                          anomaly.severity === 'high' ? 'text-red-300' : 'text-yellow-300'
                        }`}>
                          {isPortuguese ? 'Anomalia Detectada' : 'Anomaly Detected'}
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className={`px-2 py-1 rounded-full text-xs ${
                            anomaly.severity === 'high' 
                              ? 'bg-red-500/20 text-red-300' 
                              : 'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {anomaly.severity === 'high' ? (isPortuguese ? 'Alto' : 'High') : (isPortuguese ? 'Médio' : 'Medium')}
                          </div>
                          <span className="text-xs text-gray-400">{anomaly.timestamp}</span>
                        </div>
                      </div>
                      <p className="text-gray-300">{anomaly.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Performance Prediction Charts */}
      <section className="py-16 bg-dark-card/30">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                📈 {isPortuguese ? 'Predição de Performance' : 'Performance Prediction'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Modelos de machine learning prevendo sua performance futura'
                  : 'Machine learning models predicting your future performance'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* AI Prediction Chart Placeholder */}
              <div className="card">
                <h3 className="font-heading text-xl font-bold mb-4 text-cyan-300">
                  {isPortuguese ? 'Previsão de Lucros - 7 Dias' : 'Profit Forecast - 7 Days'}
                </h3>
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-400 mb-2">
                    {isPortuguese ? 'Gráfico de Predição IA' : 'AI Prediction Chart'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isPortuguese ? 'Modelo neural prevendo +$127 nos próximos 7 dias' : 'Neural model predicting +$127 in next 7 days'}
                  </p>
                  <div className="mt-4 flex justify-center">
                    <div className="px-4 py-2 bg-green-500/20 text-green-300 rounded-full text-sm">
                      91% {isPortuguese ? 'Confiança' : 'Confidence'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Neural Network Visualization */}
              <div className="card">
                <h3 className="font-heading text-xl font-bold mb-4 text-orange-300">
                  {isPortuguese ? 'Rede Neural Ativa' : 'Active Neural Network'}
                </h3>
                <div className="text-center p-8">
                  <div className="text-6xl mb-4">🧠</div>
                  <p className="text-gray-400 mb-2">
                    {isPortuguese ? 'Conexões Neurais' : 'Neural Connections'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {isPortuguese ? '247 neurônios processando padrões em tempo real' : '247 neurons processing patterns in real-time'}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-lg font-bold text-orange-300">7</div>
                      <div className="text-xs text-gray-400">{isPortuguese ? 'Camadas' : 'Layers'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-cyan-300">247</div>
                      <div className="text-xs text-gray-400">{isPortuguese ? 'Neurônios' : 'Neurons'}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-300">1.2K</div>
                      <div className="text-xs text-gray-400">{isPortuguese ? 'Conexões' : 'Connections'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Analytics Dashboard Summary */}
      <div className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="card bg-gradient-to-r from-orange-800/20 to-red-800/20 border-orange-400/20 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="text-3xl">🤖</div>
              <h3 className="font-heading text-xl font-bold">
                {isPortuguese ? 'Dashboard V3 - IA & Analytics Preditivos' : 'Dashboard V3 - AI & Predictive Analytics'}
              </h3>
            </div>
            <p className="text-gray-400 max-w-3xl mx-auto mb-6">
              {isPortuguese 
                ? 'O futuro do trading chegou! Esta versão utiliza inteligência artificial avançada, machine learning e análise preditiva para fornecer insights inteligentes, detectar padrões e prever movimentos de mercado com precisão neural.'
                : 'The future of trading is here! This version uses advanced artificial intelligence, machine learning and predictive analytics to provide smart insights, detect patterns and predict market movements with neural precision.'
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Insights Inteligentes' : 'Smart Insights'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Modelos Preditivos' : 'Predictive Models'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Reconhecimento de Padrões' : 'Pattern Recognition'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Análise de Risco IA' : 'AI Risk Analysis'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Sentimento do Mercado' : 'Market Sentiment'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Detecção de Anomalias' : 'Anomaly Detection'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}