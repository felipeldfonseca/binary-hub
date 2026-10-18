'use client'

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { OnboardingData } from '../OnboardingWizard'

interface PreferencesStepProps {
  data: OnboardingData
  onDataChange: (updates: Partial<OnboardingData>) => void
  onNext: () => void
  onBack: () => void
}

export default function PreferencesStep({ data, onDataChange, onNext, onBack }: PreferencesStepProps) {
  const { isPortuguese } = useLanguage()

  const experienceLevels = [
    {
      value: 'beginner' as const,
      title: isPortuguese ? 'Iniciante' : 'Beginner',
      description: isPortuguese 
        ? 'Novo no trading, buscando aprender o básico'
        : 'New to trading, looking to learn the basics',
      icon: '🌱'
    },
    {
      value: 'intermediate' as const,
      title: isPortuguese ? 'Intermediário' : 'Intermediate',
      description: isPortuguese 
        ? 'Tenho alguma experiência, quero melhorar minhas estratégias'
        : 'Have some experience, want to improve strategies',
      icon: '🚀'
    },
    {
      value: 'advanced' as const,
      title: isPortuguese ? 'Avançado' : 'Advanced',
      description: isPortuguese 
        ? 'Trader experiente, foco em otimização e consistência'
        : 'Experienced trader, focusing on optimization and consistency',
      icon: '⭐'
    }
  ]

  const tradingStyles = [
    {
      value: 'scalping',
      title: 'Scalping',
      description: isPortuguese 
        ? 'Operações rápidas, múltiplas por dia'
        : 'Quick trades, multiple per day'
    },
    {
      value: 'dayTrading',
      title: isPortuguese ? 'Day Trading' : 'Day Trading',
      description: isPortuguese 
        ? 'Operações durante o dia, sem overnight'
        : 'Trades during the day, no overnight'
    },
    {
      value: 'swingTrading',
      title: isPortuguese ? 'Swing Trading' : 'Swing Trading',
      description: isPortuguese 
        ? 'Operações de alguns dias a semanas'
        : 'Trades lasting days to weeks'
    },
    {
      value: 'longTerm',
      title: isPortuguese ? 'Longo Prazo' : 'Long Term',
      description: isPortuguese 
        ? 'Investimentos de meses a anos'
        : 'Investments lasting months to years'
    }
  ]

  const goals = [
    {
      value: 'consistentProfits',
      title: isPortuguese ? 'Lucros Consistentes' : 'Consistent Profits',
      icon: '💰'
    },
    {
      value: 'skillImprovement',
      title: isPortuguese ? 'Melhorar Habilidades' : 'Improve Skills',
      icon: '📈'
    },
    {
      value: 'riskManagement',
      title: isPortuguese ? 'Gestão de Risco' : 'Risk Management',
      icon: '🛡️'
    },
    {
      value: 'communityLearning',
      title: isPortuguese ? 'Aprender com a Comunidade' : 'Learn from Community',
      icon: '👥'
    },
    {
      value: 'aiInsights',
      title: isPortuguese ? 'Insights de IA' : 'AI Insights',
      icon: '🤖'
    },
    {
      value: 'educationalContent',
      title: isPortuguese ? 'Conteúdo Educacional' : 'Educational Content',
      icon: '🎓'
    }
  ]

  const toggleTradingStyle = (style: string) => {
    const current = data.tradingStyle || []
    if (current.includes(style)) {
      onDataChange({ tradingStyle: current.filter(s => s !== style) })
    } else {
      onDataChange({ tradingStyle: [...current, style] })
    }
  }

  const toggleGoal = (goal: string) => {
    const current = data.goals || []
    if (current.includes(goal)) {
      onDataChange({ goals: current.filter(g => g !== goal) })
    } else {
      onDataChange({ goals: [...current, goal] })
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        className="max-w-4xl w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-6 font-comfortaa">
            {isPortuguese ? 'Personalize sua experiência' : 'Customize your experience'}
          </h1>
          <p className="text-xl text-gray-300">
            {isPortuguese 
              ? 'Ajude-nos a personalizar a plataforma para você'
              : 'Help us personalize the platform for you'
            }
          </p>
        </div>

        <div className="space-y-12">
          {/* Experience Level */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-2xl font-semibold text-white mb-6">
              {isPortuguese ? 'Qual é seu nível de experiência?' : 'What is your experience level?'}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {experienceLevels.map((level, index) => (
                <motion.button
                  key={level.value}
                  onClick={() => onDataChange({ experienceLevel: level.value })}
                  className={`p-6 rounded-xl border-2 text-left transition-all duration-300 ${
                    data.experienceLevel === level.value
                      ? 'border-primary bg-primary/10 backdrop-blur-sm'
                      : 'border-gray-700 bg-white/5 hover:bg-white/8 hover:border-gray-600'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-3xl mb-3">{level.icon}</div>
                  <h3 className="font-semibold text-white mb-2">{level.title}</h3>
                  <p className="text-gray-300 text-sm">{level.description}</p>
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* Trading Style */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-2xl font-semibold text-white mb-6">
              {isPortuguese ? 'Qual é seu estilo de trading?' : 'What is your trading style?'}
              <span className="text-gray-400 text-sm block mt-1">
                {isPortuguese ? 'Selecione todas que se aplicam' : 'Select all that apply'}
              </span>
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              {tradingStyles.map((style, index) => (
                <motion.button
                  key={style.value}
                  onClick={() => toggleTradingStyle(style.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                    data.tradingStyle?.includes(style.value)
                      ? 'border-primary bg-primary/10 backdrop-blur-sm'
                      : 'border-gray-700 bg-white/5 hover:bg-white/8 hover:border-gray-600'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white mb-1">{style.title}</h3>
                      <p className="text-gray-300 text-sm">{style.description}</p>
                    </div>
                    {data.tradingStyle?.includes(style.value) && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* Goals */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h2 className="text-2xl font-semibold text-white mb-6">
              {isPortuguese ? 'Quais são seus objetivos?' : 'What are your goals?'}
              <span className="text-gray-400 text-sm block mt-1">
                {isPortuguese ? 'Selecione todas que se aplicam' : 'Select all that apply'}
              </span>
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {goals.map((goal, index) => (
                <motion.button
                  key={goal.value}
                  onClick={() => toggleGoal(goal.value)}
                  className={`p-4 rounded-xl border-2 text-center transition-all duration-300 ${
                    data.goals?.includes(goal.value)
                      ? 'border-primary bg-primary/10 backdrop-blur-sm'
                      : 'border-gray-700 bg-white/5 hover:bg-white/8 hover:border-gray-600'
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + index * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-2xl mb-2">{goal.icon}</div>
                  <h3 className="font-medium text-white text-sm">{goal.title}</h3>
                  {data.goals?.includes(goal.value) && (
                    <div className="mt-2 w-4 h-4 bg-primary rounded-full mx-auto" />
                  )}
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* Notifications */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <h2 className="text-2xl font-semibold text-white mb-6">
              {isPortuguese ? 'Preferências de notificação' : 'Notification preferences'}
            </h2>
            
            <div className="bg-white/5 rounded-xl p-6 space-y-4">
              {[
                {
                  key: 'tradeAlerts' as const,
                  title: isPortuguese ? 'Alertas de Trading' : 'Trade Alerts',
                  description: isPortuguese 
                    ? 'Notificações sobre suas operações'
                    : 'Notifications about your trades'
                },
                {
                  key: 'performanceReports' as const,
                  title: isPortuguese ? 'Relatórios de Desempenho' : 'Performance Reports',
                  description: isPortuguese 
                    ? 'Resumos semanais e mensais'
                    : 'Weekly and monthly summaries'
                },
                {
                  key: 'aiInsights' as const,
                  title: isPortuguese ? 'Insights de IA' : 'AI Insights',
                  description: isPortuguese 
                    ? 'Análises e recomendações da IA'
                    : 'AI analysis and recommendations'
                },
                {
                  key: 'socialUpdates' as const,
                  title: isPortuguese ? 'Atualizações Sociais' : 'Social Updates',
                  description: isPortuguese 
                    ? 'Atividades da comunidade'
                    : 'Community activities'
                }
              ].map((notification, index) => (
                <div key={notification.key} className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-white">{notification.title}</h3>
                    <p className="text-gray-400 text-sm">{notification.description}</p>
                  </div>
                  
                  <button
                    onClick={() => onDataChange({
                      notifications: {
                        ...data.notifications,
                        [notification.key]: !data.notifications[notification.key]
                      }
                    })}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      data.notifications[notification.key] ? 'bg-primary' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        data.notifications[notification.key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </motion.section>
        </div>

        {/* Navigation */}
        <motion.div 
          className="flex justify-between items-center mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
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
            {isPortuguese ? 'Finalizar' : 'Finish'}
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  )
}