'use client'
import React, { useState, useMemo } from 'react'
import HeroSection from '@/components/dashboard/HeroSection'
import HeroSectionPT from '@/components/dashboard/HeroSectionPT'
import MetricsOverview from '@/components/dashboard/MetricsOverview'
import CumulativePnLChart from '@/components/dashboard/CumulativePnLChart'
import TradingCalendar from '@/components/dashboard/TradingCalendar'
import EconomicCalendar from '@/components/dashboard/EconomicCalendar'
import RecentTrades from '@/components/dashboard/RecentTrades'
import CsvUploadModal from '@/components/dashboard/CsvUploadModal'
import AccountBalanceDisplay from '@/components/dashboard/AccountBalanceDisplay'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'allTime' | 'ytd'
type AssetType = 'crypto' | 'forex'

interface Asset {
  symbol: string
  name: string
}

export default function DashboardV1Modern() {
  const { isPortuguese } = useLanguage()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly')
  const [selectedAssetType, setSelectedAssetType] = useState<AssetType>('crypto')
  const [selectedAsset, setSelectedAsset] = useState<string>('BTC/USDT')
  const [selectedCalendarMonth, setSelectedCalendarMonth] = useState<Date>(new Date())
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [showCsvUploadModal, setShowCsvUploadModal] = useState(false)
  
  const { activeMarket } = useMarketContext()

  // Load trades for the active account
  const { trades, stats, isLoading: tradesLoading, refetch } = useTradesSupabase(
    activeMarket?.marketType ? { marketType: activeMarket.marketType } : undefined
  )
  // Load ALL trades (no filter) to detect whether the user is brand new
  const { trades: allTrades, isLoading: allTradesLoading } = useTradesSupabase()

  const thisAccountEmpty = !tradesLoading && trades.length === 0
  // Only treat as first-time if there is no data in ANY account
  const isFirstTimeUser = !allTradesLoading && allTrades.length === 0

  const handleImportData = () => {
    setShowCsvUploadModal(true)
  }

  const handleCsvUploadSuccess = () => {
    setShowCsvUploadModal(false)
    refetch()
  }

  const handleResetData = () => {
    localStorage.removeItem('binaryHub_hasData')
    window.location.reload()
  }
  
  // Asset definitions - memoized to prevent recreation
  const cryptoAssets = useMemo(() => [
    { symbol: 'BTC/USDT', name: 'Bitcoin' },
    { symbol: 'ETH/USDT', name: 'Ethereum' },
    { symbol: 'XRP/USDT', name: 'XRP' },
    { symbol: 'SOL/USDT', name: 'Solana' },
    { symbol: 'BNB/USDT', name: 'Binance Coin' },
    { symbol: 'ADA/USDT', name: 'Cardano' }
  ], [])
  
  const forexAssets = useMemo(() => [
    { symbol: 'EUR/USD', name: 'Euro / US Dollar' },
    { symbol: 'GBP/USD', name: 'British Pound / US Dollar' },
    { symbol: 'USD/JPY', name: 'US Dollar / Japanese Yen' },
    { symbol: 'USD/CHF', name: 'US Dollar / Swiss Franc' }
  ], [])
  
  const currentAssets = useMemo(() => 
    selectedAssetType === 'crypto' ? cryptoAssets : forexAssets, 
    [selectedAssetType, cryptoAssets, forexAssets]
  )

  // Mock data for calendar - memoized
  const mockCalendarData = useMemo(() => [
    { date: '2025-08-01', pnl: 250, trades: 3, winRate: 66.7 },
    { date: '2025-08-02', pnl: -120, trades: 2, winRate: 0 },
    { date: '2025-08-03', pnl: 400, trades: 4, winRate: 75 },
    { date: '2025-08-05', pnl: 180, trades: 2, winRate: 100 },
    { date: '2025-08-06', pnl: -80, trades: 1, winRate: 0 },
    { date: '2025-08-07', pnl: 320, trades: 3, winRate: 66.7 },
    { date: '2025-08-08', pnl: 150, trades: 2, winRate: 50 },
    { date: '2025-08-09', pnl: 200, trades: 3, winRate: 66.7 }
  ], [])

  return (
    <>
      {/* Hero Section - Keep personalized welcome and CTA */}
      {isPortuguese ? <HeroSectionPT /> : <HeroSection />}
      
      {/* Account balance — cards (≤2 accounts) or pill strip (3+) */}
      <div className="pt-8">
        <AccountBalanceDisplay />
      </div>

      {/* Key Metrics Overview */}
      <MetricsOverview 
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        isDemoMode={isDemoMode && isFirstTimeUser}
      />
      
      {/* Cumulative P&L Chart or Onboarding */}
      <section className="pb-8">
        <div className="container mx-auto px-4">
          {isFirstTimeUser && !isDemoMode ? (
            /* First-Time User Onboarding — only shown when NO trades exist anywhere */
            <div className="card bg-gradient-to-br from-blue-900/20 to-green-900/20 border-[#E1FFD9]/20 text-center">
              <h3 className="text-2xl font-bold text-white mb-2 font-comfortaa">
                {isPortuguese ? 'Bem-vindo ao Binary Hub!' : 'Welcome to Binary Hub!'}
              </h3>
              <p className="text-gray-300 text-lg mb-8">
                {isPortuguese
                  ? 'Importe seus dados de trading para visualizar análises profissionais'
                  : 'Import your trading data to unlock professional analytics'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <button
                  onClick={handleImportData}
                  className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-8 py-3 rounded-lg hover:shadow-xl transition-all duration-200 shadow-lg font-comfortaa transform hover:scale-105"
                >
                  {isPortuguese ? 'Importar Dados CSV' : 'Import CSV Data'}
                </button>
                <button
                  onClick={() => setIsDemoMode(true)}
                  className="text-[#E1FFD9] hover:text-[#C4F5A8] transition-colors duration-200 font-comfortaa px-4 py-2 rounded-lg border border-[#E1FFD9]/30 hover:border-[#C4F5A8]/50 bg-[#E1FFD9]/5"
                >
                  {isPortuguese ? 'Ver Demo' : 'See Demo'}
                </button>
              </div>
            </div>
          ) : thisAccountEmpty && !isDemoMode ? (
            /* This account has no trades yet — compact prompt, doesn't block layout */
            <div className="card border border-dashed border-gray-700 text-center py-10">
              <p className="text-gray-400 font-comfortaa mb-4">
                {isPortuguese
                  ? `Nenhuma operação importada para ${activeMarket?.displayName ?? 'esta conta'} ainda.`
                  : `No trades imported for ${activeMarket?.displayName ?? 'this account'} yet.`}
              </p>
              <button
                onClick={handleImportData}
                className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-6 py-2.5 rounded-lg hover:shadow-lg transition-all duration-200 font-comfortaa text-sm"
              >
                {isPortuguese ? 'Importar CSV' : 'Import CSV'}
              </button>
            </div>
          ) : (
            /* Regular Chart Display */
            <div className="relative">
              {isFirstTimeUser && isDemoMode && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="bg-orange-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold font-comfortaa shadow-lg">
                    {isPortuguese ? 'MODO DEMO' : 'DEMO MODE'}
                  </div>
                </div>
              )}
              <CumulativePnLChart period={selectedPeriod} />
              {isFirstTimeUser && isDemoMode && (
                <div className="text-center mt-4">
                  <button 
                    onClick={() => setIsDemoMode(false)}
                    className="text-gray-400 hover:text-white transition-colors text-sm font-comfortaa"
                  >
                    {isPortuguese ? '← Voltar para boas-vindas' : '← Back to welcome screen'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      
      {/* Recent Trades */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                {isPortuguese ? 'Operações Recentes' : 'Recent Trades'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Resumo das suas últimas operações com detalhes de performance'
                  : 'Summary of your latest trades with performance details'
                }
              </p>
            </div>
            
            {isFirstTimeUser && !isDemoMode ? (
              /* Empty State for Recent Trades */
              <div className="card text-center py-16">
                <div className="mb-4 flex justify-center opacity-60">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 font-comfortaa">
                  {isPortuguese ? 'Suas operações aparecerão aqui' : 'Your trades will appear here'}
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  {isPortuguese 
                    ? 'Após importar seus dados CSV, você verá uma tabela detalhada com todas as suas operações.'
                    : 'After importing your CSV data, you\'ll see a detailed table with all your trades.'
                  }
                </p>
                <button 
                  onClick={handleImportData}
                  className="text-[#E1FFD9] hover:text-[#C4F5A8] transition-colors font-comfortaa hover:scale-105 transform transition-all duration-200 flex items-center gap-2 justify-center mx-auto"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {isPortuguese ? 'Importar Dados Agora' : 'Import Data Now'}
                </button>
              </div>
            ) : (
              <RecentTrades isDemoMode={isDemoMode && isFirstTimeUser} />
            )}
          </div>
        </div>
      </section>
      
      {/* Trading Chart - With Asset Selection */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                {isPortuguese ? 'Gráficos de Trading' : 'Trading Charts'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto mb-8">
                {isPortuguese 
                  ? 'Análise técnica avançada com múltiplos tipos de gráficos e indicadores'
                  : 'Advanced technical analysis with multiple chart types and indicators'
                }
              </p>
              
              {/* Asset Selection Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
                {/* Crypto/Forex Toggle */}
                <div className="flex bg-gray-800/50 rounded-xl p-1 border border-gray-700/50">
                  <button
                    onClick={() => {
                      setSelectedAssetType('crypto')
                      setSelectedAsset('BTC/USDT')
                    }}
                    className={`px-6 py-3 rounded-lg text-sm font-comfortaa font-medium transition-all duration-200 flex items-center gap-2 ${
                      selectedAssetType === 'crypto'
                        ? 'bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] shadow-lg'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {isPortuguese ? 'Crypto' : 'Crypto'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAssetType('forex')
                      setSelectedAsset('EUR/USD')
                    }}
                    className={`px-6 py-3 rounded-lg text-sm font-comfortaa font-medium transition-all duration-200 flex items-center gap-2 ${
                      selectedAssetType === 'forex'
                        ? 'bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] shadow-lg'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    Forex
                  </button>
                </div>
                
                {/* Asset Dropdown */}
                <div className="relative">
                  <select
                    value={selectedAsset}
                    onChange={(e) => {
                      setSelectedAsset(e.target.value)
                      e.target.blur()
                    }}
                    className="appearance-none bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 pr-10 text-white font-comfortaa font-medium focus:outline-none focus:ring-2 focus:ring-[#E1FFD9]/50 focus:border-[#E1FFD9]/50 transition-all duration-200 min-w-[200px]"
                  >
                    {currentAssets.map((asset) => (
                      <option key={asset.symbol} value={asset.symbol} className="bg-gray-800 text-white">
                        {asset.symbol} - {asset.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-comfortaa font-semibold text-white mb-2">
                    {selectedAsset}
                  </h3>
                  <p className="text-sm text-gray-400 font-comfortaa">
                    {currentAssets.find(asset => asset.symbol === selectedAsset)?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${selectedAssetType === 'crypto' ? 'bg-orange-400' : 'bg-blue-400'} animate-pulse`}></div>
                  <span className="text-sm text-gray-400 font-comfortaa">
                    {selectedAssetType === 'crypto' ? 'Binance' : 'Forex Market'}
                  </span>
                </div>
              </div>
              
              <div className="text-center p-8">
                <div className="mb-4 flex justify-center">
                  {selectedAssetType === 'crypto' ? (
                    <svg className="w-16 h-16 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-16 h-16 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  )}
                </div>
                <p className="text-gray-400">
                  {isPortuguese ? 'Gráfico Interativo de Trading' : 'Interactive Trading Chart'}
                </p>
                <p className="text-sm text-gray-300 mt-2">
                  {isPortuguese ? 
                    `Análise técnica para ${selectedAsset} com candlesticks, volume e indicadores` : 
                    `Technical analysis for ${selectedAsset} with candlesticks, volume and indicators`
                  }
                </p>
                <div className="mt-4 text-xs text-gray-300 font-comfortaa">
                  {isPortuguese ? 
                    `Fonte: ${selectedAssetType === 'crypto' ? 'Binance API' : 'Forex Market Data'}` :
                    `Source: ${selectedAssetType === 'crypto' ? 'Binance API' : 'Forex Market Data'}`
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Trading Calendar - GitHub-style heatmap */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                {isPortuguese ? 'Calendário de Trading' : 'Trading Calendar'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Visualize sua atividade de trading ao longo do tempo'
                  : 'Visualize your trading activity over time'
                }
              </p>
            </div>
            
            {isFirstTimeUser && !isDemoMode ? (
              /* Empty State for Trading Calendar */
              <div className="card text-center py-16">
                <div className="mb-4 flex justify-center opacity-60">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2 font-comfortaa">
                  {isPortuguese ? 'Seu calendário de trading aparecerá aqui' : 'Your trading calendar will appear here'}
                </h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">
                  {isPortuguese 
                    ? 'Após importar dados, você verá um mapa de calor da sua atividade diária, similar a versão apresentada no modo Demo.'
                    : 'After importing data, you\'ll see a heatmap of your daily trading activity, similar to the version shown in Demo mode.'
                  }
                </p>
                <div className="flex items-center justify-center gap-4 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-600 rounded-sm"></div>
                    <span>{isPortuguese ? 'Sem trades' : 'No trades'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                    <span>{isPortuguese ? 'Trading ativo' : 'Active trading'}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative">
                {isFirstTimeUser && isDemoMode && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-orange-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold font-comfortaa shadow-lg">
                      {isPortuguese ? 'MODO DEMO' : 'DEMO MODE'}
                    </div>
                  </div>
                )}
                <TradingCalendar 
                  data={isDemoMode ? mockCalendarData : []} 
                  month={selectedCalendarMonth}
                  onMonthChange={setSelectedCalendarMonth}
                  isDemoMode={isDemoMode && isFirstTimeUser}
                />
              </div>
            )}
          </div>
        </div>
      </section>
      
      {/* Economic Calendar */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl font-bold mb-4">
                {isPortuguese ? 'Calendário Econômico' : 'Economic Calendar'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Eventos econômicos importantes que podem impactar seus trades'
                  : 'Important economic events that may impact your trades'
                }
              </p>
            </div>
            <EconomicCalendar />
          </div>
        </div>
      </section>
      
      {/* Modern Metrics Dashboard Summary */}
      <div className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="card bg-gradient-to-r from-blue-800/20 to-green-800/20 border-primary/20 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="font-heading text-xl font-bold">
                {isPortuguese ? 'Dashboard V1 - Modern Metrics' : 'Dashboard V1 - Modern Metrics'}
              </h3>
            </div>
            <p className="text-gray-400 max-w-3xl mx-auto mb-6">
              {isPortuguese 
                ? 'Esta versão do dashboard foca em métricas profissionais e análise técnica avançada, similar às plataformas Bloomberg e TradingView, com gráficos interativos e dados em tempo real.'
                : 'This dashboard version focuses on professional metrics and advanced technical analysis, similar to Bloomberg and TradingView platforms, with interactive charts and real-time data.'
              }
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-300 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Gráficos Interativos' : 'Interactive Charts'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Métricas em Tempo Real' : 'Real-time Metrics'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Análise Técnica' : 'Technical Analysis'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Calendário Visual' : 'Visual Calendar'}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                {isPortuguese ? 'Eventos Econômicos' : 'Economic Events'}
              </div>
            </div>
            
            {/* Development Controls */}
            {process.env.NODE_ENV === 'development' && (
              <div className="border-t border-gray-700/50 pt-4 text-xs">
                <p className="text-gray-500 mb-2">Development Controls:</p>
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={handleResetData}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-xs hover:bg-red-500/30 transition-colors"
                  >
                    Reset to Empty State
                  </button>
                  <button 
                    onClick={handleImportData}
                    className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-xs hover:bg-green-500/30 transition-colors"
                  >
                    Load Sample Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSV Upload Modal */}
      <CsvUploadModal 
        isOpen={showCsvUploadModal}
        onClose={() => setShowCsvUploadModal(false)}
        onSuccess={handleCsvUploadSuccess}
      />
    </>
  )
}