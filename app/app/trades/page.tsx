'use client'
import React, { useState } from 'react'
import Navbar from '@/components/layout/Navbar'
import CsvUploadSection from '@/components/dashboard/CsvUploadSection'
import Footer from '@/components/layout/Footer'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTrades, Trade } from '@/hooks/useTrades'
import { useTradeStats } from '@/hooks/useTradeStats'
import TradingAnalytics from '@/components/trades/TradingAnalytics'
import SmartTradeForm from '@/components/trades/SmartTradeForm'
import TradeInsights from '@/components/trades/TradeInsights'
import RiskManager from '@/components/trades/RiskManager'
import PerformancePanel from '@/components/trades/PerformancePanel'
import { ChartErrorBoundary } from '@/components/error/ErrorBoundary'

export default function TradesPage() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<'analytics' | 'form' | 'insights' | 'risk' | 'performance' | 'import'>('analytics')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  const { 
    trades, 
    loading: tradesLoading, 
    error: tradesError,
    createTrade,
    fetchTrades 
  } = useTrades()

  const { 
    stats, 
    loading: statsLoading 
  } = useTradeStats()

  const handleTradeCreate = async (tradeData: Partial<Trade>) => {
    await createTrade(tradeData)
    // Refresh data after creating trade
    await fetchTrades()
  }

  const tabs = [
    { 
      key: 'analytics', 
      label: isPortuguese ? 'Análise' : 'Analytics',
      icon: '📊',
      description: isPortuguese ? 'Visão geral e métricas' : 'Overview and metrics'
    },
    { 
      key: 'form', 
      label: isPortuguese ? 'Nova Operação' : 'New Trade',
      icon: '➕',
      description: isPortuguese ? 'Adicionar operação' : 'Add trade'
    },
    { 
      key: 'insights', 
      label: isPortuguese ? 'Insights' : 'Insights',
      icon: '🧠',
      description: isPortuguese ? 'Padrões e análises' : 'Patterns and analysis'
    },
    { 
      key: 'risk', 
      label: isPortuguese ? 'Risco' : 'Risk',
      icon: '🛡️',
      description: isPortuguese ? 'Gerenciamento de risco' : 'Risk management'
    },
    { 
      key: 'performance', 
      label: isPortuguese ? 'Performance' : 'Performance',
      icon: '🎯',
      description: isPortuguese ? 'Métricas avançadas' : 'Advanced metrics'
    },
    { 
      key: 'import', 
      label: isPortuguese ? 'Importar' : 'Import',
      icon: '📄',
      description: isPortuguese ? 'Upload de dados' : 'Data upload'
    }
  ]

  return (
    <ChartErrorBoundary>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-7xl mx-auto">
              {/* Header */}
              <div className="text-center mb-12">
                <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
                  {isPortuguese ? 'Trading Analytics Dashboard' : 'Trading Analytics Dashboard'}
                </h1>
                <p className="text-xl font-comfortaa font-normal text-white max-w-4xl mx-auto">
                  {isPortuguese 
                    ? 'Plataforma completa de análise de trading com insights inteligentes e ferramentas avançadas.' 
                    : 'Complete trading analysis platform with intelligent insights and advanced tools.'
                  }
                </p>
              </div>

              {/* Error Display */}
              {tradesError && (
                <div className="card border-l-4 border-loss bg-loss/10 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-loss">⚠️</span>
                    <div>
                      <h4 className="font-bold text-white">
                        {isPortuguese ? 'Erro ao carregar dados' : 'Error loading data'}
                      </h4>
                      <p className="text-gray-300 text-sm">{tradesError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Stats Bar */}
              {stats && !statsLoading && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  <div className="card text-center">
                    <div className="text-2xl font-bold text-primary">{stats.totalTrades}</div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Total' : 'Total'}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-win' : 'text-loss'}`}>
                      {stats.winRate.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      {isPortuguese ? 'Taxa' : 'Win Rate'}
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-win' : 'text-loss'}`}>
                      ${stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      P&L Total
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className={`text-2xl font-bold ${stats.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
                      ${stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      P&L Médio
                    </div>
                  </div>
                  <div className="card text-center">
                    <div className="text-2xl font-bold text-loss">
                      ${Math.abs(stats.maxDrawdown).toFixed(0)}
                    </div>
                    <div className="text-sm text-gray-300 font-comfortaa">
                      Max DD
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Navigation */}
              <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-600 pb-4">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg transition-all font-medium ${
                      activeTab === tab.key
                        ? 'bg-primary text-background shadow-glow'
                        : 'bg-dark-card text-gray-300 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <div className="text-left hidden sm:block">
                      <div className="text-sm font-bold">{tab.label}</div>
                      <div className="text-xs opacity-75">{tab.description}</div>
                    </div>
                    <span className="sm:hidden">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-6">
                {activeTab === 'analytics' && (
                  <TradingAnalytics 
                    trades={trades} 
                    stats={stats}
                    loading={tradesLoading || statsLoading}
                  />
                )}

                {activeTab === 'form' && (
                  <SmartTradeForm 
                    onTradeCreate={handleTradeCreate}
                    existingTrades={trades}
                    loading={tradesLoading}
                  />
                )}

                {activeTab === 'insights' && (
                  <TradeInsights 
                    trades={trades}
                    selectedTrade={selectedTrade}
                    onSelectTrade={setSelectedTrade}
                  />
                )}

                {activeTab === 'risk' && (
                  <RiskManager 
                    trades={trades}
                    stats={stats}
                  />
                )}

                {activeTab === 'performance' && (
                  <PerformancePanel 
                    trades={trades}
                    stats={stats}
                  />
                )}

                {activeTab === 'import' && (
                  <div className="space-y-6">
                    <div className="text-center">
                      <h2 className="text-2xl font-poly font-bold text-white mb-4">
                        {isPortuguese ? 'Importar Dados' : 'Import Data'}
                      </h2>
                      <p className="text-gray-300 font-comfortaa mb-8">
                        {isPortuguese 
                          ? 'Importe seus dados do Ebinex ou outras plataformas via CSV.' 
                          : 'Import your Ebinex or other platform data via CSV.'
                        }
                      </p>
                    </div>
                    <CsvUploadSection />
                    
                    {/* Instructions for manual import */}
                    <div className="card">
                      <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
                        {isPortuguese ? 'Importação Manual' : 'Manual Import'}
                      </h3>
                      <p className="text-gray-300 mb-4">
                        {isPortuguese 
                          ? 'Você também pode adicionar operações manualmente usando a aba "Nova Operação" com recursos de análise inteligente.' 
                          : 'You can also add trades manually using the "New Trade" tab with smart analysis features.'
                        }
                      </p>
                      <button
                        onClick={() => setActiveTab('form')}
                        className="btn-primary"
                      >
                        {isPortuguese ? 'Ir para Nova Operação' : 'Go to New Trade'}
                      </button>
                    </div>

                    {/* Recent imports or trades summary */}
                    {trades.length > 0 && (
                      <div className="card">
                        <h3 className="text-lg font-bold text-white mb-4 font-comfortaa">
                          {isPortuguese ? 'Últimas Operações' : 'Recent Trades'}
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="table">
                            <thead>
                              <tr>
                                <th>{isPortuguese ? 'Data' : 'Date'}</th>
                                <th>{isPortuguese ? 'Ativo' : 'Asset'}</th>
                                <th>{isPortuguese ? 'Direção' : 'Direction'}</th>
                                <th>{isPortuguese ? 'Valor' : 'Amount'}</th>
                                <th>{isPortuguese ? 'Resultado' : 'Result'}</th>
                                <th>P&L</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trades.slice(0, 5).map(trade => (
                                <tr key={trade.id}>
                                  <td>{new Date(trade.entryTime).toLocaleDateString()}</td>
                                  <td className="font-medium">{trade.asset}</td>
                                  <td>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                      trade.direction === 'call' ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'
                                    }`}>
                                      {trade.direction.toUpperCase()}
                                    </span>
                                  </td>
                                  <td>${trade.amount}</td>
                                  <td>
                                    <span className={trade.result === 'win' ? 'badge-win' : 'badge-loss'}>
                                      {trade.result.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className={trade.profit >= 0 ? 'text-win' : 'text-loss'}>
                                    ${trade.profit >= 0 ? '+' : ''}{trade.profit.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {trades.length > 5 && (
                            <div className="text-center text-gray-400 text-sm mt-4">
                              {isPortuguese ? 
                                `Mostrando 5 de ${trades.length} operações. Use a aba "Análise" para ver todas.` :
                                `Showing 5 of ${trades.length} trades. Use "Analytics" tab to see all.`}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Loading States */}
              {(tradesLoading || statsLoading) && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
                  <div className="card p-8 text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-white font-comfortaa">
                      {isPortuguese ? 'Carregando dados...' : 'Loading data...'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ChartErrorBoundary>
  )
}