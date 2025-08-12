'use client'

import React from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface AIVersion {
  id: string
  name: string
  description: string
  icon: string
  badge?: string
  available: boolean
  features: string[]
}

interface AIVersionSelectorProps {
  currentVersion: string
  onVersionChange: (version: string) => void
}

export default function AIVersionSelector({ 
  currentVersion, 
  onVersionChange 
}: AIVersionSelectorProps) {
  const { isPortuguese } = useLanguage()

  const versions: AIVersion[] = [
    {
      id: 'v1-basic',
      name: isPortuguese ? 'V1 IA Básica' : 'V1 Basic AI',
      description: isPortuguese 
        ? 'Interface fundamental de IA com análises básicas e recomendações simples (Em Desenvolvimento)'
        : 'Fundamental AI interface with basic analysis and simple recommendations (In Development)',
      icon: '🤖',
      badge: isPortuguese ? 'EM DESENVOLVIMENTO' : 'IN DEVELOPMENT',
      available: false,
      features: [
        isPortuguese ? 'Análise básica de padrões' : 'Basic pattern analysis',
        isPortuguese ? 'Recomendações simples' : 'Simple recommendations',
        isPortuguese ? 'Interface intuitiva' : 'Intuitive interface'
      ]
    },
    {
      id: 'v2-enhanced',
      name: isPortuguese ? 'V2 IA Melhorada' : 'V2 Enhanced AI',
      description: isPortuguese 
        ? 'IA intermediária com análise visual avançada e previsões em tempo real (Em Desenvolvimento)'
        : 'Intermediate AI with advanced visual analysis and real-time predictions (In Development)',
      icon: '📊',
      badge: isPortuguese ? 'EM DESENVOLVIMENTO' : 'IN DEVELOPMENT',
      available: false,
      features: [
        isPortuguese ? 'Análise visual avançada' : 'Advanced visual analysis',
        isPortuguese ? 'Previsões em tempo real' : 'Real-time predictions',
        isPortuguese ? 'Dashboards interativos' : 'Interactive dashboards'
      ]
    },
    {
      id: 'v3-advanced',
      name: isPortuguese ? 'V3 IA Avançada' : 'V3 Advanced AI',
      description: isPortuguese 
        ? 'Interface de IA de última geração com redes neurais, deep learning e recursos futuristas'
        : 'Next-generation AI interface with neural networks, deep learning and futuristic features',
      icon: '🚀',
      badge: isPortuguese ? 'ATUAL' : 'CURRENT',
      available: true,
      features: [
        isPortuguese ? 'Redes neurais visualizadas' : 'Visualized neural networks',
        isPortuguese ? 'Ensemble de modelos ML' : 'ML model ensemble',
        isPortuguese ? 'Geração automática de estratégias' : 'Automated strategy generation',
        isPortuguese ? 'Detecção de anomalias' : 'Anomaly detection',
        isPortuguese ? 'Interface futurística' : 'Futuristic interface'
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-white font-comfortaa mb-2">
          {isPortuguese ? 'Versões de Inteligência Artificial' : 'Artificial Intelligence Versions'}
        </h3>
        <p className="text-gray-400">
          {isPortuguese ? 'Escolha sua experiência de IA preferida' : 'Choose your preferred AI experience'}
        </p>
      </div>

      {/* Version Cards */}
      <div className="grid gap-4">
        {versions.map((version) => (
          <div
            key={version.id}
            onClick={() => version.available && onVersionChange(version.id)}
            className={`
              relative p-6 rounded-lg border transition-all duration-300 
              ${version.available ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}
              ${currentVersion === version.id 
                ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
                : version.available 
                  ? 'border-gray-600 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-700/30' 
                  : 'border-gray-700 bg-gray-800/20'
              }
            `}
          >
            {/* Badge */}
            {version.badge && (
              <div className={`
                absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold
                ${currentVersion === version.id 
                  ? 'bg-primary text-black' 
                  : version.available 
                    ? 'bg-blue-500/20 text-blue-300' 
                    : 'bg-gray-600/20 text-gray-400'
                }
              `}>
                {version.badge}
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="text-4xl">{version.icon}</div>
              <div className="flex-1">
                <h4 className={`
                  text-xl font-bold font-comfortaa mb-3
                  ${currentVersion === version.id ? 'text-primary' : 'text-white'}
                `}>
                  {version.name}
                </h4>
                
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  {version.description}
                </p>

                {/* Features */}
                <div className="mb-4">
                  <h5 className="text-sm font-semibold text-white mb-2">
                    {isPortuguese ? 'Principais Recursos:' : 'Key Features:'}
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {version.features.map((feature, index) => (
                      <span 
                        key={index}
                        className={`
                          px-2 py-1 rounded text-xs
                          ${version.available 
                            ? 'bg-blue-500/20 text-blue-300' 
                            : 'bg-gray-600/20 text-gray-400'
                          }
                        `}
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                
                {currentVersion === version.id && version.available && (
                  <div className="flex items-center gap-2 text-xs text-primary">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    {isPortuguese ? 'Versão Ativa' : 'Active Version'}
                  </div>
                )}
              </div>
            </div>

            {/* Progress Indicator for Development Versions */}
            {!version.available && (
              <div className="mt-4 pt-4 border-t border-gray-600/30">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{isPortuguese ? 'Progresso de Desenvolvimento' : 'Development Progress'}</span>
                  <span>
                    {version.id === 'v1-basic' ? '25%' : '45%'}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: version.id === 'v1-basic' ? '25%' : '45%' 
                    }}
                  />
                </div>
              </div>
            )}

            {/* Special AI Capabilities for V3 */}
            {version.id === 'v3-advanced' && version.available && (
              <div className="mt-4 pt-4 border-t border-gray-600/30">
                <h5 className="text-sm font-semibold text-white mb-2">
                  {isPortuguese ? 'Capacidades Avançadas:' : 'Advanced Capabilities:'}
                </h5>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-green-400">🧠</span>
                    <span className="text-gray-300">
                      {isPortuguese ? 'Redes Neurais' : 'Neural Networks'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">⚡</span>
                    <span className="text-gray-300">
                      {isPortuguese ? 'Processamento RT' : 'Real-time Processing'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-purple-400">🎯</span>
                    <span className="text-gray-300">
                      {isPortuguese ? 'ML Ensemble' : 'ML Ensemble'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">🚨</span>
                    <span className="text-gray-300">
                      {isPortuguese ? 'Detecção Anomalias' : 'Anomaly Detection'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* AI Technology Info */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-blue-400 text-2xl">🧠</div>
          <div>
            <h4 className="font-bold text-blue-300 font-comfortaa mb-2">
              {isPortuguese ? 'Tecnologia de IA de Ponta' : 'Cutting-Edge AI Technology'}
            </h4>
            <p className="text-sm text-blue-200 leading-relaxed">
              {isPortuguese 
                ? 'Nossa plataforma utiliza as mais avançadas técnicas de inteligência artificial, incluindo deep learning, redes neurais convolucionais, transformers e algoritmos de ensemble para fornecer insights precisos e acionáveis sobre seus padrões de trading.'
                : 'Our platform utilizes the most advanced artificial intelligence techniques, including deep learning, convolutional neural networks, transformers, and ensemble algorithms to provide precise and actionable insights about your trading patterns.'
              }
            </p>
            
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                'TensorFlow',
                'PyTorch', 
                'Transformers',
                'LSTM',
                'CNN',
                'Random Forest'
              ].map((tech, index) => (
                <span 
                  key={index}
                  className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Future Roadmap */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="text-purple-400 text-2xl">🚀</div>
          <div>
            <h4 className="font-bold text-purple-300 font-comfortaa mb-2">
              {isPortuguese ? 'Roadmap Futuro' : 'Future Roadmap'}
            </h4>
            <p className="text-sm text-purple-200 mb-3">
              {isPortuguese 
                ? 'Próximas funcionalidades planejadas para tornar a experiência ainda mais avançada:'
                : 'Upcoming features planned to make the experience even more advanced:'
              }
            </p>
            
            <ul className="space-y-1 text-sm text-purple-200">
              <li className="flex items-center gap-2">
                <span className="text-purple-400">•</span>
                {isPortuguese ? 'Modelos GPT especializados em trading' : 'Trading-specialized GPT models'}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">•</span>
                {isPortuguese ? 'Assistente virtual de trading' : 'Virtual trading assistant'}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">•</span>
                {isPortuguese ? 'Auto-trading com aprovação manual' : 'Auto-trading with manual approval'}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">•</span>
                {isPortuguese ? 'Análise de sentimento de mercado' : 'Market sentiment analysis'}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}