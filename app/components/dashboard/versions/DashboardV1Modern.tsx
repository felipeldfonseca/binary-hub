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
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTradeStats } from '@/hooks/useTradeStats'

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
  
  // Check if user has any trading data
  const { stats, fetchDashboardStats } = useTradeStats('weekly')
  const hasNoData = !stats || stats.totalTrades === 0
  
  // Open CSV upload modal
  const handleImportData = () => {
    setShowCsvUploadModal(true)
  }
  
  // Handle successful CSV upload
  const handleCsvUploadSuccess = () => {
    setShowCsvUploadModal(false)
    // Refetch stats to update the UI
    fetchDashboardStats?.()
    // Refresh the page to ensure all components get updated data
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }
  
  // Reset data state (for testing)
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
      
      {/* VERSION 1: MODERN METRICS - Bloomberg/TradingView Style */}
      
      {/* Key Metrics Overview */}
      <MetricsOverview 
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        isDemoMode={isDemoMode && hasNoData}
      />
      
      {/* Cumulative P&L Chart or Onboarding */}
      <section className="pb-8">
        <div className="container mx-auto px-4">
          {hasNoData && !isDemoMode ? (
            /* First-Time User Onboarding */
            <div className="card bg-gradient-to-br from-blue-900/20 to-green-900/20 border-[#E1FFD9]/20 text-center">
              <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
                <div className="w-20 h-20 bg-[#E1FFD9]/10 rounded-2xl flex items-center justify-center animate-pulse">
                  <svg className="w-12 h-12 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-bold text-white mb-2 font-comfortaa">
                    {isPortuguese ? 'Bem-vindo ao Binary Hub!' : 'Welcome to Binary Hub!'}
                  </h3>
                  <p className="text-gray-300 text-lg">
                    {isPortuguese 
                      ? 'Importe seus dados de trading para visualizar análises profissionais'
                      : 'Import your trading data to unlock professional analytics'
                    }
                  </p>
                </div>
              </div>
              
              {/* Features Preview */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="flex items-center gap-3 text-left bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                  <div className="w-12 h-12 bg-[#E1FFD9]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white font-comfortaa">
                      {isPortuguese ? 'Análises em Tempo Real' : 'Real-Time Analytics'}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {isPortuguese ? 'Métricas profissionais e insights' : 'Professional metrics & insights'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                  <div className="w-12 h-12 bg-[#E1FFD9]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white font-comfortaa">
                      {isPortuguese ? 'Gráficos Avançados' : 'Advanced Charts'}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {isPortuguese ? 'Visualizações interativas' : 'Interactive visualizations'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-left bg-gray-800/30 p-4 rounded-lg border border-gray-700/50">
                  <div className="w-12 h-12 bg-[#E1FFD9]/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white font-comfortaa">
                      {isPortuguese ? 'Insights Personalizados' : 'Personal Insights'}
                    </h4>
                    <p className="text-sm text-gray-400">
                      {isPortuguese ? 'Recomendações baseadas em IA' : 'AI-powered recommendations'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Onboarding Steps */}
              <div className="bg-gray-800/40 rounded-lg p-6 mb-8 border border-gray-700/30">
                <h4 className="text-lg font-semibold text-white mb-4 font-comfortaa">
                  {isPortuguese ? 'Como começar:' : 'Getting started:'}
                </h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#E1FFD9]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h5 className="font-semibold text-white text-sm mb-1">
                      {isPortuguese ? '1. Exportar CSV' : '1. Export CSV'}
                    </h5>
                    <p className="text-xs text-gray-400">
                      {isPortuguese ? 'Da sua corretora (Ebinex, etc.)' : 'From your broker (Ebinex, etc.)'}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#E1FFD9]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <h5 className="font-semibold text-white text-sm mb-1">
                      {isPortuguese ? '2. Importar Dados' : '2. Import Data'}
                    </h5>
                    <p className="text-xs text-gray-400">
                      {isPortuguese ? 'Upload seu arquivo CSV' : 'Upload your CSV file'}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#E1FFD9]/10 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-8 h-8 text-[#E1FFD9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <h5 className="font-semibold text-white text-sm mb-1">
                      {isPortuguese ? '3. Ver Análises' : '3. View Analytics'}
                    </h5>
                    <p className="text-xs text-gray-400">
                      {isPortuguese ? 'Insights profissionais instantâneos' : 'Instant professional insights'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <button 
                  onClick={handleImportData}
                  className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-[#2D3748] font-semibold px-8 py-3 rounded-lg hover:bg-gradient-to-r hover:from-[#C4F5A8] hover:to-[#E1FFD9] hover:shadow-xl transition-all duration-200 shadow-lg font-comfortaa transform hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {isPortuguese ? 'Importar Dados CSV' : 'Import CSV Data'}
                </button>
                
                <button 
                  onClick={() => setIsDemoMode(true)}
                  className="text-[#E1FFD9] hover:text-[#C4F5A8] transition-colors duration-200 font-comfortaa px-4 py-2 rounded-lg border border-[#E1FFD9]/30 hover:border-[#C4F5A8]/50 bg-[#E1FFD9]/5 hover:bg-[#C4F5A8]/10 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  {isPortuguese ? 'Ver Demo com Dados de Exemplo' : 'See Demo with Sample Data'}
                </button>
              </div>
            </div>
          ) : (
            /* Regular Chart Display */
            <div className="relative">
              {hasNoData && isDemoMode && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="bg-orange-500/90 text-white px-4 py-2 rounded-full text-sm font-semibold font-comfortaa shadow-lg">
                    {isPortuguese ? 'MODO DEMO' : 'DEMO MODE'}
                  </div>
                </div>
              )}
              <CumulativePnLChart period={selectedPeriod} />
              {hasNoData && isDemoMode && (
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
            
            {hasNoData && !isDemoMode ? (
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
              <RecentTrades isDemoMode={isDemoMode && hasNoData} />
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
            
            {hasNoData && !isDemoMode ? (
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
                {hasNoData && isDemoMode && (
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
                  isDemoMode={isDemoMode && hasNoData}
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