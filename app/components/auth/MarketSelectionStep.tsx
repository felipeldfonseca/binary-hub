'use client'
import { useState } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { 
  MarketType, 
  MarketSelectionData, 
  MARKET_CONFIGS, 
  getMarketConfig, 
  getMarketColorClass,
  getMarketBorderClass,
  getMarketTextClass,
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
  const [currentStep, setCurrentStep] = useState<'selection' | 'configuration'>('selection')
  const [selectedMarketTypes, setSelectedMarketTypes] = useState<MarketType[]>(
    selectedMarkets.map(m => m.marketType)
  )

  const handleMarketToggle = (marketType: MarketType) => {
    if (selectedMarketTypes.includes(marketType)) {
      setSelectedMarketTypes(prev => prev.filter(m => m !== marketType))
      onMarketChange(selectedMarkets.filter(m => m.marketType !== marketType))
    } else {
      const config = getMarketConfig(marketType)
      setSelectedMarketTypes(prev => [...prev, marketType])
      
      const newMarketData: MarketSelectionData = {
        marketType,
        displayName: isPortuguese ? config.namePortuguese : config.name,
        initialBankroll: config.minStartingBalance || 1000,
        currency: config.defaultCurrency,
        experienceLevel: 'beginner',
        isPrimary: selectedMarkets.length === 0
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

  const canProceed = selectedMarkets.length > 0

  const marketsByComplexity = {
    beginner: Object.values(MARKET_CONFIGS).filter(c => c.complexity === 'beginner'),
    intermediate: Object.values(MARKET_CONFIGS).filter(c => c.complexity === 'intermediate'),
    advanced: Object.values(MARKET_CONFIGS).filter(c => c.complexity === 'advanced')
  }

  if (currentStep === 'selection') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-white mb-4">
              {isPortuguese ? 'Quais mercados você negocia?' : 'Which markets do you trade?'}
            </h1>
            <p className="text-gray-400 text-lg">
              {isPortuguese 
                ? 'Selecione todos os mercados em que você está ativo. Você pode adicionar mais mercados depois.'
                : 'Select all markets where you are active. You can add more markets later.'
              }
            </p>
          </div>

          {/* Beginner Markets */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full"></span>
              {isPortuguese ? 'Iniciante' : 'Beginner Friendly'}
            </h2>
            <div className="grid md:grid-cols-1 gap-4">
              {marketsByComplexity.beginner.map(config => (
                <MarketSelectionCard
                  key={config.id}
                  config={config}
                  isSelected={selectedMarketTypes.includes(config.id)}
                  onToggle={() => handleMarketToggle(config.id)}
                  isPortuguese={isPortuguese}
                />
              ))}
            </div>
          </div>

          {/* Intermediate Markets */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
              {isPortuguese ? 'Intermediário' : 'Intermediate'}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {marketsByComplexity.intermediate.map(config => (
                <MarketSelectionCard
                  key={config.id}
                  config={config}
                  isSelected={selectedMarketTypes.includes(config.id)}
                  onToggle={() => handleMarketToggle(config.id)}
                  isPortuguese={isPortuguese}
                />
              ))}
            </div>
          </div>

          {/* Advanced Markets */}
          <div className="mb-12">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-400 rounded-full"></span>
              {isPortuguese ? 'Avançado' : 'Advanced'}
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {marketsByComplexity.advanced.map(config => (
                <MarketSelectionCard
                  key={config.id}
                  config={config}
                  isSelected={selectedMarketTypes.includes(config.id)}
                  onToggle={() => handleMarketToggle(config.id)}
                  isPortuguese={isPortuguese}
                />
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={onBack}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              {isPortuguese ? '← Voltar' : '← Back'}
            </button>

            {selectedMarkets.length > 0 && (
              <div className="text-center">
                <p className="text-sm text-gray-400 mb-2">
                  {isPortuguese 
                    ? `${selectedMarkets.length} mercado(s) selecionado(s)`
                    : `${selectedMarkets.length} market(s) selected`
                  }
                </p>
                <button
                  onClick={() => setCurrentStep('configuration')}
                  disabled={!canProceed}
                  className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPortuguese ? 'Configurar Contas →' : 'Configure Accounts →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Configuration Step
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            {isPortuguese ? 'Configure suas contas de trading' : 'Configure your trading accounts'}
          </h1>
          <p className="text-gray-400">
            {isPortuguese 
              ? 'Configure o capital inicial e preferências para cada mercado'
              : 'Set up initial capital and preferences for each market'
            }
          </p>
        </div>

        <div className="space-y-6 mb-8">
          {selectedMarkets.map((market, index) => (
            <MarketConfigurationCard
              key={market.marketType}
              market={market}
              onUpdate={(updates) => updateMarketData(market.marketType, updates)}
              onSetPrimary={() => setPrimaryMarket(market.marketType)}
              isPortuguese={isPortuguese}
            />
          ))}
        </div>

        {/* Primary Market Notice */}
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-gray-800 text-sm font-bold">!</span>
            </div>
            <div>
              <h3 className="font-semibold text-primary mb-1">
                {isPortuguese ? 'Mercado Principal' : 'Primary Market'}
              </h3>
              <p className="text-sm text-gray-300">
                {isPortuguese 
                  ? 'Seu mercado principal será exibido por padrão no dashboard e receberá insights de IA priorizados.'
                  : 'Your primary market will be displayed by default on the dashboard and receive prioritized AI insights.'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => setCurrentStep('selection')}
            className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
          >
            {isPortuguese ? '← Voltar' : '← Back'}
          </button>

          <button
            onClick={onNext}
            className="btn-primary px-8 py-3"
          >
            {isPortuguese ? 'Criar Conta →' : 'Create Account →'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface MarketSelectionCardProps {
  config: typeof MARKET_CONFIGS[keyof typeof MARKET_CONFIGS]
  isSelected: boolean
  onToggle: () => void
  isPortuguese: boolean
}

function MarketSelectionCard({ config, isSelected, onToggle, isPortuguese }: MarketSelectionCardProps) {
  return (
    <button
      onClick={onToggle}
      className={`p-6 rounded-lg border-2 text-left transition-all duration-300 transform hover:scale-105 ${
        isSelected
          ? `${getMarketBorderClass(config.id)} bg-gray-800/50`
          : 'border-gray-700 hover:border-gray-600 bg-gray-800/30'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
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
              <div className={`w-2 h-2 rounded-full ${getMarketColorClass(config.id)}`}></div>
            )}
          </div>
          
          <p className="text-gray-400 text-sm mb-3">
            {isPortuguese ? config.descriptionPortuguese : config.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs">
            <span className={`px-2 py-1 rounded-full ${
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
    </button>
  )
}

interface MarketConfigurationCardProps {
  market: MarketSelectionData
  onUpdate: (updates: Partial<MarketSelectionData>) => void
  onSetPrimary: () => void
  isPortuguese: boolean
}

function MarketConfigurationCard({ market, onUpdate, onSetPrimary, isPortuguese }: MarketConfigurationCardProps) {
  const config = getMarketConfig(market.marketType)
  
  return (
    <div className={`border-2 rounded-lg p-6 ${
      market.isPrimary 
        ? `${getMarketBorderClass(market.marketType)} bg-gray-800/50`
        : 'border-gray-700 bg-gray-800/30'
    }`}>
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getMarketColorClass(market.marketType)}`}>
            {config.icon}
          </div>
          <div>
            <h3 className="font-semibold text-white text-lg">{market.displayName}</h3>
            <p className="text-gray-400 text-sm">
              {isPortuguese ? config.namePortuguese : config.name}
            </p>
          </div>
        </div>
        
        {!market.isPrimary && (
          <button
            onClick={onSetPrimary}
            className="text-sm text-gray-400 hover:text-primary transition-colors"
          >
            {isPortuguese ? 'Definir como principal' : 'Set as primary'}
          </button>
        )}
        
        {market.isPrimary && (
          <div className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
            {isPortuguese ? 'PRINCIPAL' : 'PRIMARY'}
          </div>
        )}
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

        {/* Experience Level */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {isPortuguese ? 'Nível de Experiência' : 'Experience Level'}
          </label>
          <select
            value={market.experienceLevel}
            onChange={(e) => onUpdate({ experienceLevel: e.target.value as 'beginner' | 'intermediate' | 'advanced' })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="beginner">{isPortuguese ? 'Iniciante' : 'Beginner'}</option>
            <option value="intermediate">{isPortuguese ? 'Intermediário' : 'Intermediate'}</option>
            <option value="advanced">{isPortuguese ? 'Avançado' : 'Advanced'}</option>
          </select>
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
    </div>
  )
}