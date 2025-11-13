'use client'
import { useState } from 'react'
import { useMarketAccounts } from '@/hooks/useMarketAccounts'
import { MarketAccount, MarketType, getMarketConfig, getMarketColorClass, formatCurrency } from '@/types/markets'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface MarketTabsProps {
  showAddButton?: boolean
  onAddMarket?: () => void
}

export default function MarketTabs({ showAddButton = true, onAddMarket }: MarketTabsProps) {
  const { isPortuguese } = useLanguage()
  const { marketAccounts, activeMarket, setActiveMarket, isLoading } = useMarketAccounts()
  const [showDropdown, setShowDropdown] = useState(false)

  if (isLoading) {
    return (
      <div className="border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-6 py-4">
            <div className="animate-pulse space-x-4 flex">
              <div className="h-10 bg-gray-700 rounded-lg w-32"></div>
              <div className="h-10 bg-gray-700 rounded-lg w-32"></div>
              <div className="h-10 bg-gray-700 rounded-lg w-32"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (marketAccounts.length === 0) {
    return (
      <div className="border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-gray-400 mb-4">
                {isPortuguese ? 'Nenhum mercado configurado' : 'No markets configured'}
              </p>
              {showAddButton && onAddMarket && (
                <button
                  onClick={onAddMarket}
                  className="btn-primary px-6 py-2"
                >
                  {isPortuguese ? 'Adicionar Mercado' : 'Add Market'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show dropdown if too many markets (mobile optimization)
  const showAsDropdown = marketAccounts.length > 4

  if (showAsDropdown) {
    return (
      <div className="border-b border-gray-700">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 rounded-lg px-4 py-3 transition-colors"
              >
                {activeMarket && (
                  <>
                    <MarketTabContent market={activeMarket} isActive={true} />
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg shadow-lg border border-gray-600 min-w-64 z-50">
                  <div className="py-2">
                    {marketAccounts.map((market) => (
                      <button
                        key={market.id}
                        onClick={() => {
                          setActiveMarket(market.marketType)
                          setShowDropdown(false)
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors ${
                          activeMarket?.id === market.id ? 'bg-gray-700' : ''
                        }`}
                      >
                        <MarketTabContent market={market} isActive={activeMarket?.id === market.id} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showAddButton && onAddMarket && (
              <button
                onClick={onAddMarket}
                className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="text-sm">{isPortuguese ? 'Adicionar' : 'Add'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Regular tab layout
  return (
    <div className="border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-1 py-2 overflow-x-auto">
          {marketAccounts.map((market) => (
            <button
              key={market.id}
              onClick={() => setActiveMarket(market.marketType)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all whitespace-nowrap ${
                activeMarket?.id === market.id
                  ? 'bg-gray-800 text-white border-b-2 border-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <MarketTabContent market={market} isActive={activeMarket?.id === market.id} />
            </button>
          ))}

          {showAddButton && onAddMarket && (
            <button
              onClick={onAddMarket}
              className="text-gray-400 hover:text-primary transition-colors flex items-center gap-2 px-4 py-3 hover:bg-gray-800/50 rounded-lg ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-sm">{isPortuguese ? 'Adicionar' : 'Add'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface MarketTabContentProps {
  market: MarketAccount
  isActive: boolean
}

function MarketTabContent({ market, isActive }: MarketTabContentProps) {
  const config = getMarketConfig(market.marketType)
  const { isPortuguese } = useLanguage()
  
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${
        isActive ? getMarketColorClass(market.marketType) : 'bg-gray-600'
      }`}>
        {config.icon}
      </div>
      <div className="text-left">
        <div className={`font-medium text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
          {market.displayName}
        </div>
        <div className={`text-xs ${isActive ? 'text-gray-300' : 'text-gray-500'}`}>
          {formatCurrency(market.bankroll.current, market.bankroll.currency)}
          {market.isPrimary && (
            <span className="ml-2 bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs">
              {isPortuguese ? 'PRINCIPAL' : 'PRIMARY'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}