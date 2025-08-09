'use client'
import React from 'react'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/dashboard/HeroSection'
import HeroSectionPT from '@/components/dashboard/HeroSectionPT'
import MetricsOverview from '@/components/dashboard/MetricsOverview'
import PerformanceSection from '@/components/dashboard/PerformanceSection'
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel'
import PatternAnalysis from '@/components/dashboard/PatternAnalysis'
import RiskAssessment from '@/components/dashboard/RiskAssessment'
import TimeAnalytics from '@/components/dashboard/TimeAnalytics'
import AssetPerformance from '@/components/dashboard/AssetPerformance'
import TradingCalendar from '@/components/dashboard/TradingCalendar'
import EconomicCalendar from '@/components/dashboard/EconomicCalendar'
import RecentTrades from '@/components/dashboard/RecentTrades'
import CalendarSection from '@/components/dashboard/CalendarSection'
import EventsSection from '@/components/dashboard/EventsSection'

import Footer from '@/components/layout/Footer'

import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function DashboardPage() {
  const { isPortuguese } = useLanguage()

  // Mock data for calendar and economic events
  const mockCalendarData = [
    { date: '2025-08-01', pnl: 250, trades: 3, winRate: 66.7 },
    { date: '2025-08-02', pnl: -120, trades: 2, winRate: 0 },
    { date: '2025-08-03', pnl: 400, trades: 4, winRate: 75 },
    { date: '2025-08-05', pnl: 180, trades: 2, winRate: 100 },
    { date: '2025-08-06', pnl: -80, trades: 1, winRate: 0 },
    { date: '2025-08-07', pnl: 320, trades: 3, winRate: 66.7 },
    { date: '2025-08-08', pnl: 150, trades: 2, winRate: 50 },
    { date: '2025-08-09', pnl: 200, trades: 3, winRate: 66.7 }
  ]

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative">
        {/* Hero Section - Keep personalized welcome */}
        {isPortuguese ? <HeroSectionPT /> : <HeroSection />}
        
        {/* AI-Powered Insights Panel - Prominent placement after hero */}
        <AIInsightsPanel />
        
        {/* New Metrics Overview - Key KPIs at the top */}
        <MetricsOverview period="week" />
        
        {/* Enhanced Performance Section with predictive analytics */}
        <PerformanceSection />
        
        {/* AI Analytics Section Header */}
        <div className="py-8 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h2 className="font-heading text-3xl font-bold mb-2">
                {isPortuguese ? 'Analytics Avançados com IA' : 'AI-Powered Advanced Analytics'}
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                {isPortuguese 
                  ? 'Insights profundos alimentados por inteligência artificial para otimizar sua performance de trading'
                  : 'Deep AI-powered insights to optimize your trading performance and identify opportunities'
                }
              </p>
            </div>
          </div>
        </div>
        
        {/* Pattern Recognition & Risk Assessment */}
        <PatternAnalysis />
        <RiskAssessment />
        
        {/* Time-based & Asset Analytics */}
        <TimeAnalytics />
        <AssetPerformance />
        
        {/* Main Dashboard Grid - Professional layout */}
        <section className="py-8 bg-background">
          <div className="container mx-auto px-4">
            <div className="mb-8 text-center">
              <h2 className="font-heading text-2xl font-bold mb-2">
                {isPortuguese ? 'Calendário e Atividades' : 'Calendar & Activities'}
              </h2>
              <p className="text-gray-400">
                {isPortuguese 
                  ? 'Acompanhe seu histórico de trading e eventos econômicos importantes'
                  : 'Track your trading history and important economic events'
                }
              </p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Trading Calendar */}
              <div className="lg:col-span-2">
                <TradingCalendar 
                  data={mockCalendarData}
                  month={new Date()}
                  isLoading={false}
                />
              </div>
              
              {/* Right Column - Recent Trades */}
              <div>
                <RecentTrades limit={5} />
              </div>
            </div>
            
            {/* Economic Calendar - Full Width */}
            <div className="mt-8">
              <EconomicCalendar 
                date={new Date()}
                isLoading={false}
              />
            </div>
          </div>
        </section>
        
        {/* Keep existing sections for backwards compatibility */}
        <CalendarSection />
        <EventsSection />
        
        {/* AI Dashboard Summary Footer */}
        <div className="py-8 bg-background">
          <div className="container mx-auto px-4">
            <div className="card bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-white/10 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="text-3xl">🤖</div>
                <h3 className="font-heading text-xl font-bold">
                  {isPortuguese ? 'Dashboard Analítico V3 - Powered by AI' : 'Analytical Dashboard V3 - Powered by AI'}
                </h3>
              </div>
              <p className="text-gray-400 max-w-3xl mx-auto mb-6">
                {isPortuguese 
                  ? 'Esta versão do dashboard utiliza inteligência artificial avançada para analisar seus padrões de trading, identificar oportunidades de melhoria e fornecer recomendações personalizadas baseadas em sua performance histórica.'
                  : 'This version of the dashboard uses advanced artificial intelligence to analyze your trading patterns, identify improvement opportunities, and provide personalized recommendations based on your historical performance.'
                }
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  {isPortuguese ? 'Análise em Tempo Real' : 'Real-time Analysis'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  {isPortuguese ? 'Insights Personalizados' : 'Personalized Insights'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  {isPortuguese ? 'Previsões Avançadas' : 'Advanced Predictions'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  {isPortuguese ? 'Reconhecimento de Padrões' : 'Pattern Recognition'}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  {isPortuguese ? 'Avaliação de Risco' : 'Risk Assessment'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}