'use client'

import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { OnboardingData } from '../OnboardingWizard'
import { getMarketConfig, getMarketColorClass, formatCurrency } from '@/types/markets'

interface CompleteStepProps {
  data: OnboardingData
  onComplete: () => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}

export default function CompleteStep({ data, onComplete, onBack, isLoading, error }: CompleteStepProps) {
  const { isPortuguese } = useLanguage()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        className="max-w-4xl w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Success Header */}
        <div className="text-center mb-12">
          <motion.div
            className="w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.div>

          <h1 className="text-4xl font-bold text-white mb-6 font-comfortaa">
            {isPortuguese ? 'Você está pronto!' : "You're all set!"}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            {isPortuguese 
              ? 'Sua conta Binary Hub foi configurada com sucesso. Aqui está um resumo das suas preferências:'
              : 'Your Binary Hub account has been successfully configured. Here\'s a summary of your preferences:'
            }
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Trading Accounts */}
          <motion.div 
            className="bg-white/5 rounded-xl p-6 backdrop-blur-sm"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">📊</span>
              </div>
              <h2 className="text-xl font-semibold text-white">
                {isPortuguese ? 'Contas de Trading' : 'Trading Accounts'}
              </h2>
            </div>
            
            <div className="space-y-3">
              {data.selectedMarkets.map((market, index) => {
                const config = getMarketConfig(market.marketType)
                return (
                  <motion.div
                    key={market.marketType}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getMarketColorClass(market.marketType)}`}>
                        {config.icon}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">{market.displayName}</div>
                        {market.isPrimary && (
                          <div className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            {isPortuguese ? 'Principal' : 'Primary'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium text-sm">
                        {formatCurrency(market.initialBankroll, market.currency)}
                      </div>
                      <div className="text-gray-400 text-xs">{market.currency}</div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* Profile Summary */}
          <motion.div 
            className="bg-white/5 rounded-xl p-6 backdrop-blur-sm"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">👤</span>
              </div>
              <h2 className="text-xl font-semibold text-white">
                {isPortuguese ? 'Seu Perfil' : 'Your Profile'}
              </h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-gray-400 text-sm mb-1">
                  {isPortuguese ? 'Nível de Experiência' : 'Experience Level'}
                </div>
                <div className="text-white font-medium capitalize">
                  {data.experienceLevel === 'beginner' ? (isPortuguese ? 'Iniciante' : 'Beginner') :
                   data.experienceLevel === 'intermediate' ? (isPortuguese ? 'Intermediário' : 'Intermediate') :
                   isPortuguese ? 'Avançado' : 'Advanced'}
                </div>
              </div>
              
              {data.tradingStyle && data.tradingStyle.length > 0 && (
                <div>
                  <div className="text-gray-400 text-sm mb-2">
                    {isPortuguese ? 'Estilo de Trading' : 'Trading Style'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data.tradingStyle.map((style, index) => (
                      <span key={index} className="bg-primary/20 text-primary px-2 py-1 rounded-full text-xs">
                        {style === 'dayTrading' ? 'Day Trading' :
                         style === 'swingTrading' ? 'Swing Trading' :
                         style === 'longTerm' ? (isPortuguese ? 'Longo Prazo' : 'Long Term') :
                         style}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {data.goals && data.goals.length > 0 && (
                <div>
                  <div className="text-gray-400 text-sm mb-1">
                    {isPortuguese ? 'Objetivos Principais' : 'Main Goals'}
                  </div>
                  <div className="text-white text-sm">
                    {data.goals.length} {isPortuguese ? 'objetivos selecionados' : 'goals selected'}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Next Steps */}
        <motion.div 
          className="bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20 rounded-xl p-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <h3 className="text-xl font-semibold text-white mb-4">
            {isPortuguese ? 'Próximos passos' : 'Next steps'}
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">1</div>
              <div>
                <div className="text-white font-medium text-sm">
                  {isPortuguese ? 'Explorar o Dashboard' : 'Explore Dashboard'}
                </div>
                <div className="text-gray-400 text-xs">
                  {isPortuguese ? 'Familiarize-se com a interface' : 'Get familiar with the interface'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">2</div>
              <div>
                <div className="text-white font-medium text-sm">
                  {isPortuguese ? 'Registrar Primeira Operação' : 'Log First Trade'}
                </div>
                <div className="text-gray-400 text-xs">
                  {isPortuguese ? 'Comece seu diário de trading' : 'Start your trading journal'}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">3</div>
              <div>
                <div className="text-white font-medium text-sm">
                  {isPortuguese ? 'Conectar com a Comunidade' : 'Connect with Community'}
                </div>
                <div className="text-gray-400 text-xs">
                  {isPortuguese ? 'Siga outros traders' : 'Follow other traders'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div 
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {isPortuguese ? 'Voltar' : 'Back'}
          </button>

          <motion.button
            onClick={onComplete}
            disabled={isLoading}
            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold px-8 py-3 rounded-full hover:from-green-400 hover:to-emerald-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            whileHover={!isLoading ? { scale: 1.05 } : {}}
            whileTap={!isLoading ? { scale: 0.95 } : {}}
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isLoading 
              ? (isPortuguese ? 'Finalizando...' : 'Finishing...')
              : (isPortuguese ? 'Começar a usar! 🚀' : 'Start using! 🚀')
            }
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}