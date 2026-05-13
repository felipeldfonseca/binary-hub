'use client'
import React, { useState, useMemo } from 'react'
import CsvUploadSection from '@/components/dashboard/CsvUploadSection'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { Trade as LegacyTrade } from '@/hooks/useTrades'
import { useTradesSupabase } from '@/hooks/useTradesSupabase'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import type { Trade as SupabaseTrade } from '@/types/database'
import TradesTable from '@/components/trades/TradesTable'
import TradeFilters from '@/components/trades/TradeFilters'
import BulkActions from '@/components/trades/BulkActions'

// Map Supabase snake_case trade to the legacy camelCase shape that child components expect
function adaptTrade(t: SupabaseTrade & { market_type?: string | null }): LegacyTrade {
  const result = t.result === 'breakeven' ? 'tie' : (t.result ?? 'loss') as 'win' | 'loss' | 'tie'
  return {
    id: t.id,
    userId: t.user_id,
    tradeId: t.id,
    asset: t.symbol,
    direction: (t.direction === 'long' || t.direction === 'short')
      ? 'call' // futures don't have call/put — map for legacy compat
      : (t.direction as 'call' | 'put'),
    amount: t.stake_amount ?? 0,
    entryPrice: t.entry_price ?? 0,
    exitPrice: t.exit_price ?? 0,
    entryTime: new Date(t.entry_time),
    exitTime: t.exit_time ? new Date(t.exit_time) : new Date(t.entry_time),
    timeframe: t.timeframe ?? '',
    candleTime: '',
    refunded: 0,
    executed: 0,
    status: result === 'win' ? 'WIN' : 'LOSE',
    result,
    profit: t.pnl ?? 0,
    payout: t.payout_percent ?? 0,
    platform: '',
    marketType: (t.market_type as LegacyTrade['marketType']) ?? undefined,
    strategy: t.strategy ?? undefined,
    notes: t.notes ?? undefined,
    screenshots: [],
    createdAt: new Date(t.created_at),
    updatedAt: new Date(t.updated_at ?? t.created_at),
  }
}

export default function TradesV1Professional() {
  const { isPortuguese } = useLanguage()
  const { activeMarket, marketAccounts, setActiveMarket } = useMarketContext()
  const [activeTab, setActiveTab] = useState<'table' | 'filters' | 'import'>('table')
  const [, setSelectedTrade] = useState<LegacyTrade | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortField, setSortField] = useState<keyof LegacyTrade>('entryTime')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    asset: '',
    result: '',
    minAmount: '',
    maxAmount: '',
    marketType: ''
  })

  const supabaseFilters = useMemo(() => ({
    marketType: activeMarket?.marketType,
  }), [activeMarket?.marketType])

  const {
    trades: rawTrades,
    stats,
    isLoading,
    error,
    deleteTrade,
  } = useTradesSupabase(supabaseFilters)

  // Adapt to legacy shape for child components
  const trades = useMemo(
    () => rawTrades.map(t => adaptTrade(t as SupabaseTrade & { market_type?: string | null })),
    [rawTrades]
  )

  const tradesError = error?.message ?? null

  // Filter trades based on current filters
  const filteredTrades = trades.filter(trade => {
    if (filters.dateRange?.start && new Date(trade.entryTime) < new Date(filters.dateRange.start)) return false
    if (filters.dateRange?.end && new Date(trade.entryTime) > new Date(filters.dateRange.end)) return false
    if (filters.asset && !trade.asset.toLowerCase().includes(filters.asset.toLowerCase())) return false
    if (filters.result && trade.result !== filters.result) return false
    if (filters.marketType && trade.marketType !== filters.marketType) return false
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

  const handleBulkDelete = async (tradeIds: string[]) => {
    await Promise.all(tradeIds.map(id => deleteTrade.mutateAsync(id)))
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

  // Reset to first page whenever filters or sort change
  const handleSort = (field: keyof LegacyTrade, direction: 'asc' | 'desc') => {
    setSortField(field)
    setSortDirection(direction)
    setPage(0)
  }

  // Paginate after sorting
  const pagedTrades = useMemo(
    () => sortedTrades.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [sortedTrades, page]
  )

  const pagination = {
    total: sortedTrades.length,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    hasMore: (page + 1) * PAGE_SIZE < sortedTrades.length,
  }

  const tabs = [
    {
      key: 'table',
      label: isPortuguese ? 'Tabela' : 'Table',
      icon: '📋',
      description: isPortuguese ? 'Visualização em tabela' : 'Table view'
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
      {/* Title */}
      <h1 className="text-2xl font-bold font-heading text-white text-center mb-6">
        {isPortuguese ? 'Histórico de Operações' : 'Trade History'}
      </h1>

      {/* Market Selection */}
      <div className="text-center mb-8">
        {activeMarket && marketAccounts.length > 1 && (
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-gray-300">{isPortuguese ? 'Mostrando operações de:' : 'Showing trades from:'}</span>
            <div className="flex items-center gap-2">
              {marketAccounts.map((market) => {
                const isActive = market.marketType === activeMarket?.marketType
                const marketConfig = {
                  binary: { icon: '📊' },
                  forex: { icon: '💱' },
                  crypto: { icon: '₿' },
                  futures: { icon: '📈' },
                  options: { icon: '🎯' }
                }
                const config = marketConfig[market.marketType as keyof typeof marketConfig]

                return (
                  <button
                    key={market.marketType}
                    onClick={() => setActiveMarket(market.marketType)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-white font-medium transition-all ${
                      isActive
                        ? 'bg-white/20 ring-2 ring-primary/50'
                        : 'bg-white/10 hover:bg-white/15'
                    }`}
                  >
                    <span>{config?.icon}</span>
                    <span>{market.displayName}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {activeMarket && marketAccounts.length === 1 && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
            <span>{isPortuguese ? 'Mostrando operações de:' : 'Showing trades from:'}</span>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-white font-medium">
              <span>
                {activeMarket.marketType === 'binary' ? '📊'
                  : activeMarket.marketType === 'forex' ? '💱'
                  : activeMarket.marketType === 'crypto' ? '₿'
                  : activeMarket.marketType === 'futures' ? '📈' : '🎯'}
              </span>
              <span>{activeMarket.displayName}</span>
            </span>
          </div>
        )}
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
      {stats && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
              {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(0)}
            </div>
            <div className="text-sm text-gray-300 font-comfortaa">
              P&L Total
            </div>
          </div>
          <div className="card text-center">
            <div className={`text-2xl font-bold ${stats.avgWin >= 0 ? 'text-win' : 'text-loss'}`}>
              {stats.avgWin >= 0 ? '+' : ''}${stats.avgWin.toFixed(2)}
            </div>
            <div className="text-sm text-gray-300 font-comfortaa">
              {isPortuguese ? 'Média/Vitória' : 'Avg Win'}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && trades.length === 0 && !tradesError && (
        <div className="card text-center py-12 mb-8">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-xl font-bold text-white mb-2">
            {isPortuguese ? 'Nenhuma operação encontrada' : 'No trades found'}
          </h3>
          <p className="text-gray-400 font-comfortaa mb-6">
            {isPortuguese
              ? 'Importe suas operações via CSV para começar.'
              : 'Import your trades via CSV to get started.'}
          </p>
          <button
            onClick={() => setActiveTab('import')}
            className="btn-primary"
          >
            {isPortuguese ? 'Importar CSV' : 'Import CSV'}
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-600 pb-4">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
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
            <BulkActions
              selectedIds={selectedIds}
              selectedTrades={trades.filter(t => selectedIds.includes(t.id))}
              onBulkDelete={handleBulkDelete}
              onBulkUpdate={async () => {}}
              onExport={handleExport}
              onClearSelection={() => setSelectedIds([])}
              loading={isLoading}
            />

            <TradesTable
              trades={pagedTrades}
              loading={isLoading}
              onTradeSelect={setSelectedTrade}
              onBulkSelect={setSelectedIds}
              selectedIds={selectedIds}
              onSort={handleSort}
              sortField={sortField}
              sortDirection={sortDirection}
              pagination={pagination}
              onPageChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE))}
            />
          </>
        )}

        {activeTab === 'filters' && (
          <TradeFilters
            onFiltersChange={(newFilters) => { setFilters(newFilters as typeof filters); setPage(0) }}
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
    </>
  )
}
