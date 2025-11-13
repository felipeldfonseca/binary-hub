'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { 
  MarketType, 
  MarketSelectionData, 
  MARKET_CONFIGS, 
  getMarketConfig, 
  getMarketColorClass,
  getMarketBorderClass,
  CurrencyType 
} from '@/types/markets'

interface MarketSelectionStepProps {
  selectedMarkets: MarketSelectionData[]
  onMarketChange: (markets: MarketSelectionData[]) => void
  onNext: () => void
  onBack: () => void
}

export default function MarketSelectionStep({
  selectedMarkets,
  onMarketChange,
  onNext,
  onBack
}: MarketSelectionStepProps) {
  const { isPortuguese } = useLanguage()
  const [showConfiguration, setShowConfiguration] = useState(false)

  const handleMarketToggle = (marketType: MarketType) => {
    if (selectedMarkets.find(m => m.marketType === marketType)) {
      // Remove market
      onMarketChange(selectedMarkets.filter(m => m.marketType !== marketType))
    } else {
      // Add market
      const config = getMarketConfig(marketType)
      const newMarketData: MarketSelectionData = {
        marketType,
        displayName: isPortuguese ? config.namePortuguese : config.name,
        initialBankroll: config.minStartingBalance || 1000,
        currency: config.defaultCurrency,
        experienceLevel: 'beginner',
        isPrimary: selectedMarkets.length === 0 // First market is primary
      }
      onMarketChange([...selectedMarkets, newMarketData])
    }
  }

  const updateMarketData = (marketType: MarketType, updates: Partial<MarketSelectionData>) => {
    onMarketChange(
      selectedMarkets.map(market => 
        market.marketType === marketType 
          ? { ...market, ...updates }
          : market
      )
    )
  }

  const setPrimaryMarket = (marketType: MarketType) => {
    onMarketChange(
      selectedMarkets.map(market => ({
        ...market,
        isPrimary: market.marketType === marketType
      }))
    )
  }

  const handleNext = () => {
    if (selectedMarkets.length === 0) {
      return // Show error state
    }
    
    if (showConfiguration) {
      onNext()
    } else {
      setShowConfiguration(true)
    }
  }

  const marketsByComplexity = {
    beginner: Object.values(MARKET_CONFIGS).filter(c => c.complexity === 'beginner'),
    intermediate: Object.values(MARKET_CONFIGS).filter(c => c.complexity === 'intermediate'),
    advanced: Object.values(MARKET_CONFIGS).filter(c => c.complexity === 'advanced')
  }

  if (showConfiguration && selectedMarkets.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <motion.div 
          className="max-w-4xl w-full"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-6 font-comfortaa">
              {isPortuguese ? 'Configure suas contas' : 'Configure your accounts'}
            </h1>
            <p className="text-xl text-gray-300">
              {isPortuguese 
                ? 'Configure o capital inicial para cada mercado selecionado'
                : 'Set up initial capital for each selected market'
              }
            </p>
          </div>

          <div className="space-y-6 mb-12">
            {selectedMarkets.map((market, index) => (
              <MarketConfigCard
                key={market.marketType}
                market={market}
                onUpdate={(updates) => updateMarketData(market.marketType, updates)}
                onSetPrimary={() => setPrimaryMarket(market.marketType)}
                isPortuguese={isPortuguese}
              />
            ))}
          </div>

          {/* Primary Market Notice */}
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-gray-800 text-sm font-bold">!</span>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-2">
                  {isPortuguese ? 'Mercado Principal' : 'Primary Market'}
                </h3>
                <p className="text-gray-300 text-sm">
                  {isPortuguese 
                    ? 'Seu mercado principal será exibido por padrão no dashboard e receberá insights de IA priorizados.'
                    : 'Your primary market will be displayed by default on the dashboard and receive prioritized AI insights.'
                  }
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => setShowConfiguration(false)}
              className="flex items-center gap-2 px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {isPortuguese ? 'Voltar para seleção' : 'Back to selection'}
            </button>

            <motion.button
              onClick={handleNext}
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div 
        className="max-w-6xl w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-6 font-comfortaa">
            {isPortuguese ? 'Quais mercados você negocia?' : 'Which markets do you trade?'}
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            {isPortuguese 
              ? 'Selecione todos os mercados em que você está ativo. Você pode adicionar mais mercados depois!'
              : 'Select all markets where you are active. You can add more markets later!'
            }
          </p>
        </div>

        {/* Market Categories */}
        <div className="space-y-12 mb-12">
          {/* Beginner Markets */}
          <div>
            <motion.div 
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="w-3 h-3 bg-green-400 rounded-full" />
              <h2 className="text-2xl font-semibold text-white">
                {isPortuguese ? 'Iniciante' : 'Beginner Friendly'}
              </h2>
              <span className="bg-green-400/20 text-green-400 px-3 py-1 rounded-full text-sm">
                {isPortuguese ? 'Recomendado para começar' : 'Recommended to start'}
              </span>
            </motion.div>
            
            <div className="grid md:grid-cols-1 gap-6">
              {marketsByComplexity.beginner.map((config, index) => (
                <MarketCard
                  key={config.id}
                  config={config}
                  isSelected={!!selectedMarkets.find(m => m.marketType === config.id)}
                  onToggle={() => handleMarketToggle(config.id)}
                  isPortuguese={isPortuguese}
                  delay={index * 0.1}
                />
              ))}
            </div>
          </div>

          {/* Intermediate Markets */}
          <div>
            <motion.div 
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="w-3 h-3 bg-yellow-400 rounded-full" />
              <h2 className="text-2xl font-semibold text-white">
                {isPortuguese ? 'Intermediário' : 'Intermediate'}
              </h2>
            </motion.div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {marketsByComplexity.intermediate.map((config, index) => (
                <MarketCard
                  key={config.id}
                  config={config}
                  isSelected={!!selectedMarkets.find(m => m.marketType === config.id)}
                  onToggle={() => handleMarketToggle(config.id)}
                  isPortuguese={isPortuguese}
                  delay={0.5 + index * 0.1}
                />
              ))}
            </div>
          </div>

          {/* Advanced Markets */}
          <div>
            <motion.div 
              className="flex items-center gap-3 mb-6"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 }}
            >
              <div className="w-3 h-3 bg-red-400 rounded-full" />
              <h2 className="text-2xl font-semibold text-white">
                {isPortuguese ? 'Avançado' : 'Advanced'}
              </h2>
            </motion.div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {marketsByComplexity.advanced.map((config, index) => (
                <MarketCard
                  key={config.id}
                  config={config}
                  isSelected={!!selectedMarkets.find(m => m.marketType === config.id)}
                  onToggle={() => handleMarketToggle(config.id)}
                  isPortuguese={isPortuguese}
                  delay={0.7 + index * 0.1}
                />
              ))}
            </div>
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

          {selectedMarkets.length > 0 && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-1">
                  {isPortuguese 
                    ? `${selectedMarkets.length} mercado(s) selecionado(s)`
                    : `${selectedMarkets.length} market(s) selected`
                  }
                </p>
              </div>
              
              <motion.button
                onClick={handleNext}
                className="bg-gradient-to-r from-primary to-blue-500 text-white font-semibold px-8 py-3 rounded-full hover:from-primary/90 hover:to-blue-500/90 transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isPortuguese ? 'Configurar Contas →' : 'Configure Accounts →'}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

// Market Card Component
interface MarketCardProps {
  config: typeof MARKET_CONFIGS[keyof typeof MARKET_CONFIGS]
  isSelected: boolean
  onToggle: () => void
  isPortuguese: boolean
  delay: number
}

function MarketCard({ config, isSelected, onToggle, isPortuguese, delay }: MarketCardProps) {
  return (
    <motion.button
      onClick={onToggle}
      className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 ${
        isSelected
          ? `${getMarketBorderClass(config.id)} bg-white/10 backdrop-blur-sm`
          : 'border-gray-700 hover:border-gray-600 bg-white/5 hover:bg-white/8'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
          isSelected ? getMarketColorClass(config.id) : 'bg-gray-700'
        }`}>
          {config.icon}
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-white text-lg">
              {isPortuguese ? config.namePortuguese : config.name}
            </h3>
            {isSelected && (
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            )}
          </div>
          
          <p className="text-gray-300 text-sm mb-4">
            {isPortuguese ? config.descriptionPortuguese : config.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs">
            <span className={`px-3 py-1 rounded-full ${
              config.complexity === 'beginner' ? 'bg-green-500/20 text-green-400' :
              config.complexity === 'intermediate' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {config.complexity}
            </span>
            <span className="text-gray-500">
              {isPortuguese ? 'Min:' : 'Min:'} {config.defaultCurrency} {config.minStartingBalance || 0}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

// Market Configuration Card Component
interface MarketConfigCardProps {
  market: MarketSelectionData
  onUpdate: (updates: Partial<MarketSelectionData>) => void
  onSetPrimary: () => void
  isPortuguese: boolean
}

function MarketConfigCard({ market, onUpdate, onSetPrimary, isPortuguese }: MarketConfigCardProps) {
  const config = getMarketConfig(market.marketType)
  
  return (
    <motion.div 
      className={`border-2 rounded-xl p-6 ${
        market.isPrimary 
          ? `${getMarketBorderClass(market.marketType)} bg-white/10 backdrop-blur-sm`
          : 'border-gray-700 bg-white/5'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${getMarketColorClass(market.marketType)}`}>
            {config.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">{market.displayName}</h3>
            <p className="text-gray-400 text-sm">
              {isPortuguese ? config.namePortuguese : config.name}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!market.isPrimary && (
            <button
              onClick={onSetPrimary}
              className="text-sm text-gray-400 hover:text-primary transition-colors px-3 py-1 rounded-lg hover:bg-white/5"
            >
              {isPortuguese ? 'Definir como principal' : 'Set as primary'}
            </button>
          )}
          
          {market.isPrimary && (
            <div className="bg-primary/20 text-primary text-xs px-3 py-1 rounded-full font-medium">
              {isPortuguese ? 'PRINCIPAL' : 'PRIMARY'}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Account Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isPortuguese ? 'Nome da Conta' : 'Account Name'}
          </label>
          <input
            type="text"
            value={market.displayName}
            onChange={(e) => onUpdate({ displayName: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={isPortuguese ? 'Minha Conta Forex' : 'My Forex Account'}
          />
        </div>

        {/* Initial Bankroll */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isPortuguese ? 'Capital Inicial' : 'Initial Capital'}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={market.initialBankroll}
              onChange={(e) => onUpdate({ initialBankroll: parseFloat(e.target.value) || 0 })}
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
              min={config.minStartingBalance || 0}
              step="0.01"
            />
            <select
              value={market.currency}
              onChange={(e) => onUpdate({ currency: e.target.value as CurrencyType })}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {config.supportedCurrencies.map(currency => (
                <option key={currency} value={currency}>{currency}</option>
              ))}
            </select>
          </div>
          {config.minStartingBalance && market.initialBankroll < config.minStartingBalance && (
            <p className="text-red-400 text-xs mt-1">
              {isPortuguese 
                ? `Mínimo recomendado: ${config.defaultCurrency} ${config.minStartingBalance}`
                : `Recommended minimum: ${config.defaultCurrency} ${config.minStartingBalance}`
              }
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}