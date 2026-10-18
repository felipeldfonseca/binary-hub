'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface PlatformOverviewStepProps {
  onNext: () => void
  onBack: () => void
}

interface Feature {
  icon: string
  title: string
  titlePT: string
  description: string
  descriptionPT: string
  color: string
  benefits: string[]
  benefitsPT: string[]
}

export default function PlatformOverviewStep({ onNext, onBack }: PlatformOverviewStepProps) {
  const { isPortuguese } = useLanguage()
  const [selectedFeature, setSelectedFeature] = useState(0)

  const features: Feature[] = [
    {
      icon: '📊',
      title: 'Universal Trading Journal',
      titlePT: 'Diário Universal de Trading',
      description: 'Track trades across all markets with advanced analytics',
      descriptionPT: 'Rastreie operações em todos os mercados com analytics avançados',
      color: 'from-blue-500 to-cyan-500',
      benefits: [
        'Multi-market support (Binary, Forex, Crypto, Futures, Options)',
        'Automated performance tracking',
        'Advanced risk management tools',
        'Pattern recognition'
      ],
      benefitsPT: [
        'Suporte multi-mercado (Binário, Forex, Crypto, Futuros, Opções)',
        'Rastreamento automático de desempenho',
        'Ferramentas avançadas de gestão de risco',
        'Reconhecimento de padrões'
      ]
    },
    {
      icon: '🤖',
      title: 'Championship AI Insights',
      titlePT: 'Insights de IA Campeões',
      description: 'AI models with +117% and +76% proven performance',
      descriptionPT: 'Modelos de IA com desempenho comprovado de +117% e +76%',
      color: 'from-purple-500 to-pink-500',
      benefits: [
        'Qwen3 Max AI: +117% performance',
        'DeepSeek V3 AI: +76% performance',
        'Daily market analysis',
        'Personalized trading recommendations'
      ],
      benefitsPT: [
        'IA Qwen3 Max: +117% de desempenho',
        'IA DeepSeek V3: +76% de desempenho',
        'Análise diária de mercado',
        'Recomendações personalizadas de trading'
      ]
    },
    {
      icon: '👥',
      title: 'Social Trading Community',
      titlePT: 'Comunidade Social de Trading',
      description: 'Learn and share with traders worldwide',
      descriptionPT: 'Aprenda e compartilhe com traders do mundo todo',
      color: 'from-green-500 to-emerald-500',
      benefits: [
        'Follow successful traders',
        'Share your best strategies',
        'Participate in trading challenges',
        'Get feedback from the community'
      ],
      benefitsPT: [
        'Siga traders bem-sucedidos',
        'Compartilhe suas melhores estratégias',
        'Participe de desafios de trading',
        'Receba feedback da comunidade'
      ]
    },
    {
      icon: '🎓',
      title: 'Educational Resources',
      titlePT: 'Recursos Educacionais',
      description: 'Comprehensive learning materials for all skill levels',
      descriptionPT: 'Materiais de aprendizado abrangentes para todos os níveis',
      color: 'from-orange-500 to-red-500',
      benefits: [
        'Interactive tutorials',
        'Market analysis guides',
        'Risk management courses',
        'Live webinars and workshops'
      ],
      benefitsPT: [
        'Tutoriais interativos',
        'Guias de análise de mercado',
        'Cursos de gestão de risco',
        'Webinars e workshops ao vivo'
      ]
    }
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        className="max-w-6xl w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-6 font-comfortaa">
            {isPortuguese ? 'O que você pode fazer aqui?' : 'What can you do here?'}
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            {isPortuguese
              ? 'Binary Hub é a primeira plataforma de educação de trading universal. Explore os recursos que irão transformar sua jornada de trading.'
              : 'Binary Hub is the first universal trading education platform. Explore the features that will transform your trading journey.'
            }
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {/* Feature Selection */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 border-2 ${
                  selectedFeature === index
                    ? 'bg-white/10 border-white/20 backdrop-blur-sm'
                    : 'bg-white/5 border-white/10 hover:bg-white/8'
                }`}
                onClick={() => setSelectedFeature(index)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <div className="text-4xl">{feature.icon}</div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {isPortuguese ? feature.titlePT : feature.title}
                    </h3>
                    <p className="text-gray-300 text-sm">
                      {isPortuguese ? feature.descriptionPT : feature.description}
                    </p>
                  </div>
                  {selectedFeature === index && (
                    <div className="w-3 h-3 bg-primary rounded-full" />
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Feature Details */}
          <div className="lg:sticky lg:top-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFeature}
                className={`p-8 rounded-2xl bg-gradient-to-br ${features[selectedFeature].color}/20 border border-white/10 backdrop-blur-sm`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-6xl mb-6 text-center">
                  {features[selectedFeature].icon}
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-4 text-center">
                  {isPortuguese ? features[selectedFeature].titlePT : features[selectedFeature].title}
                </h3>
                
                <p className="text-gray-300 mb-6 text-center">
                  {isPortuguese ? features[selectedFeature].descriptionPT : features[selectedFeature].description}
                </p>

                <div className="space-y-3">
                  <h4 className="font-semibold text-white mb-3">
                    {isPortuguese ? 'Principais benefícios:' : 'Key benefits:'}
                  </h4>
                  {(isPortuguese ? features[selectedFeature].benefitsPT : features[selectedFeature].benefits).map((benefit, idx) => (
                    <motion.div
                      key={idx}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{benefit}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isPortuguese ? 'Voltar' : 'Back'}
          </button>

          <motion.button
            onClick={onNext}
            className="bg-gradient-to-r from-primary to-blue-500 text-white font-semibold px-8 py-3 rounded-full hover:from-primary/90 hover:to-blue-500/90 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isPortuguese ? 'Continuar' : 'Continue'}
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}