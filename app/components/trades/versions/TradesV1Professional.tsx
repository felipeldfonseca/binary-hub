'use client'
import React, { useState } from 'react'
import CsvUploadSection from '@/components/dashboard/CsvUploadSection'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTrades, Trade } from '@/hooks/useTrades'
import { useTradeStats } from '@/hooks/useTradeStats'
import TradesTable from '@/components/trades/TradesTable'
import TradeForm from '@/components/trades/TradeForm'
import TradeFilters from '@/components/trades/TradeFilters'
import TradeModal from '@/components/trades/TradeModal'
import BulkActions from '@/components/trades/BulkActions'

export default function TradesV1Professional() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<'table' | 'form' | 'filters' | 'import'>('table')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<keyof Trade>('entryTime')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    asset: '',
    result: '',
    minAmount: '',
    maxAmount: ''
  })

  const { 
    trades, 
    loading: tradesLoading, 
    error: tradesError,
    createTrade,
    updateTrade,
    deleteTrade,
    fetchTrades 
  } = useTrades()

  const { 
    stats, 
    loading: statsLoading 
  } = useTradeStats()

  // Filter trades based on current filters
  const filteredTrades = trades.filter(trade => {
    if (filters.dateRange?.start && new Date(trade.entryTime) < new Date(filters.dateRange.start)) return false
    if (filters.dateRange?.end && new Date(trade.entryTime) > new Date(filters.dateRange.end)) return false
    if (filters.asset && !trade.asset.toLowerCase().includes(filters.asset.toLowerCase())) return false
    if (filters.result && trade.result !== filters.result) return false
    if (filters.minAmount && trade.amount < parseFloat(filters.minAmount)) return false
    if (filters.maxAmount && trade.amount > parseFloat(filters.maxAmount)) return false
    return true
  })

  // Sort trades
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime()
    }
    
    return 0
  })

  const handleTradeCreate = async (tradeData: Partial<Trade>) => {
    await createTrade(tradeData)
    await fetchTrades()
    setActiveTab('table')
  }

  const handleTradeUpdate = async (tradeData: Partial<Trade>) => {
    if (selectedTrade) {
      await updateTrade(selectedTrade.id, tradeData)
      await fetchTrades()
      setSelectedTrade(null)
    }
  }

  const handleBulkDelete = async (tradeIds: string[]) => {
    await Promise.all(tradeIds.map(id => deleteTrade(id)))
    await fetchTrades()
    setSelectedIds([])
  }

  const handleBulkUpdate = async (tradeIds: string[], updates: Partial<Trade>) => {
    await Promise.all(tradeIds.map(id => updateTrade(id, updates)))
    await fetchTrades()
    setSelectedIds([])
  }

  const handleExport = async (tradeIds: string[]) => {
    const tradesToExport = trades.filter(trade => tradeIds.includes(trade.id))
    const csvData = [
      ['Date', 'Asset', 'Direction', 'Amount', 'Entry Price', 'Exit Price', 'Result', 'Profit', 'Strategy', 'Notes'],
      ...tradesToExport.map(trade => [
        new Date(trade.entryTime).toISOString(),
        trade.asset,
        trade.direction,
        trade.amount.toString(),
        trade.entryPrice.toString(),
        trade.exitPrice.toString(),
        trade.result,
        trade.profit.toString(),
        trade.strategy || '',
        trade.notes || ''
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvData], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trades_export_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSort = (field: keyof Trade, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
  }

  const tabs = [
    { 
      key: 'table', 
      label: isPortuguese ? 'Tabela' : 'Table',
      icon: '📋',
      description: isPortuguese ? 'Visualização em tabela' : 'Table view'
    },
    { 
      key: 'form', 
      label: isPortuguese ? 'Nova Operação' : 'New Trade',
      icon: '➕',
      description: isPortuguese ? 'Adicionar operação' : 'Add trade'
    },
    { 
      key: 'filters', 
      label: isPortuguese ? 'Filtros' : 'Filters',
      icon: '🔍',
      description: isPortuguese ? 'Filtros avançados' : 'Advanced filters'
    },
    { 
      key: 'import', 
      label: isPortuguese ? 'Importar' : 'Import',
      icon: '📄',
      description: isPortuguese ? 'Upload de dados' : 'Data upload'
    }
  ]

  return (
    <>
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
          {isPortuguese ? 'Gerenciamento Profissional de Operações' : 'Professional Trade Management'}
        </h1>
        <p className="text-xl font-comfortaa font-normal text-white max-w-4xl mx-auto">
          {isPortuguese 
            ? 'Interface avançada estilo Excel/Airtable com recursos profissionais de filtragem, ordenação e ações em lote.' 
            : 'Advanced Excel/Airtable-style interface with professional filtering, sorting, and bulk action features.'
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
        {activeTab === 'table' && (
          <>
            {/* Bulk Actions */}
            <BulkActions
              selectedIds={selectedIds}
              selectedTrades={trades.filter(t => selectedIds.includes(t.id))}
              onBulkDelete={handleBulkDelete}
              onBulkUpdate={handleBulkUpdate}
              onExport={handleExport}
              onClearSelection={() => setSelectedIds([])}
              loading={tradesLoading}
            />
            
            {/* Advanced Table */}
            <TradesTable
              trades={sortedTrades}
              loading={tradesLoading}
              onTradeSelect={setSelectedTrade}
              onBulkSelect={setSelectedIds}
              selectedIds={selectedIds}
              onSort={handleSort}
              sortField={sortField}
              sortDirection={sortDirection}
              pagination={null}
              onPageChange={() => {}}
            />
          </>
        )}

        {activeTab === 'form' && (
          <TradeForm
            onTradeCreate={handleTradeCreate}
            loading={tradesLoading}
          />
        )}

        {activeTab === 'filters' && (
          <TradeFilters
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={() => setFilters({
              dateRange: { start: '', end: '' },
              asset: '',
              result: '',
              minAmount: '',
              maxAmount: ''
            })}
            trades={trades}
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
                  : 'Import your Ebinex or other platform data via CSV.'}
              </p>
            </div>
            <CsvUploadSection />
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

      {/* Professional Table Dashboard Summary */}
      <div className="mt-16 py-8">
        <div className="card bg-gradient-to-r from-indigo-800/20 to-blue-800/20 border-primary/20 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-3xl">📋</div>
            <h3 className="font-heading text-xl font-bold">
              {isPortuguese ? 'Trades V1 - Professional Table' : 'Trades V1 - Professional Table'}
            </h3>
          </div>
          <p className="text-gray-400 max-w-3xl mx-auto mb-6">
            {isPortuguese 
              ? 'Esta versão da página de trades oferece uma interface profissional estilo Excel/Airtable com recursos avançados de filtragem, ordenação, ações em lote e exportação de dados.'
              : 'This trades page version offers a professional Excel/Airtable-style interface with advanced filtering, sorting, bulk actions, and data export capabilities.'
            }
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Tabela Avançada' : 'Advanced Table'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Ações em Lote' : 'Bulk Actions'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Filtros Avançados' : 'Advanced Filters'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Exportação CSV' : 'CSV Export'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Ordenação Dinâmica' : 'Dynamic Sorting'}
            </div>
          </div>
        </div>
      </div>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onUpdate={handleTradeUpdate}
          onDelete={async () => {
            await deleteTrade(selectedTrade.id)
            await fetchTrades()
            setSelectedTrade(null)
          }}
        />
      )}
    </>
  )
}