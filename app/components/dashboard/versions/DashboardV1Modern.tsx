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

export default function DashboardV1Modern() {
  const { isPortuguese } = useLanguage()
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('weekly')
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
  
  // Build calendar data from real trades
  const calendarData = useMemo(() => {
    const byDay: Record<string, { pnl: number; wins: number; count: number }> = {}
    trades.forEach(t => {
      const date = new Date(t.entry_time).toISOString().slice(0, 10)
      if (!byDay[date]) byDay[date] = { pnl: 0, wins: 0, count: 0 }
      byDay[date].pnl   += t.pnl ?? 0
      byDay[date].count++
      if (t.result === 'win') byDay[date].wins++
    })
    return Object.entries(byDay).map(([date, d]) => ({
      date,
      pnl:     parseFloat(d.pnl.toFixed(2)),
      trades:  d.count,
      winRate: d.count > 0 ? parseFloat((d.wins / d.count * 100).toFixed(1)) : 0,
    }))
  }, [trades])

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
              <RecentTrades />
            )}
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
                  data={calendarData}
                  month={selectedCalendarMonth}
                  onMonthChange={setSelectedCalendarMonth}
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