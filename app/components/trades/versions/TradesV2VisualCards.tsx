'use client'
import React, { useState, useMemo } from 'react'
import CsvUploadSection from '@/components/dashboard/CsvUploadSection'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useTrades, Trade } from '@/hooks/useTrades'
import { useTradeStats } from '@/hooks/useTradeStats'
import TradeForm from '@/components/trades/TradeForm'
import TradeModal from '@/components/trades/TradeModal'

export default function TradesV2VisualCards() {
  const { isPortuguese } = useLanguage()
  const [activeTab, setActiveTab] = useState<'cards' | 'form' | 'filters' | 'import'>('cards')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'wins' | 'losses' | 'by-asset'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'profit' | 'amount'>('newest')
  const [searchTerm, setSearchTerm] = useState('')
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

  // Filter and search trades
  const filteredTrades = useMemo(() => {
    let filtered = trades.filter(trade => {
      // Basic filters
      if (filters.dateRange?.start && new Date(trade.entryTime) < new Date(filters.dateRange.start)) return false
      if (filters.dateRange?.end && new Date(trade.entryTime) > new Date(filters.dateRange.end)) return false
      if (filters.asset && !trade.asset.toLowerCase().includes(filters.asset.toLowerCase())) return false
      if (filters.result && trade.result !== filters.result) return false
      if (filters.minAmount && trade.amount < parseFloat(filters.minAmount)) return false
      if (filters.maxAmount && trade.amount > parseFloat(filters.maxAmount)) return false
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesAsset = trade.asset.toLowerCase().includes(searchLower)
        const matchesStrategy = trade.strategy?.toLowerCase().includes(searchLower) || false
        const matchesNotes = trade.notes?.toLowerCase().includes(searchLower) || false
        if (!matchesAsset && !matchesStrategy && !matchesNotes) return false
      }
      
      // View mode filter
      if (viewMode === 'wins' && trade.result !== 'win') return false
      if (viewMode === 'losses' && trade.result !== 'loss') return false
      
      return true
    })

    // Sort trades
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
        case 'oldest':
          return new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
        case 'profit':
          return b.profit - a.profit
        case 'amount':
          return b.amount - a.amount
        default:
          return 0
      }
    })

    return filtered
  }, [trades, filters, searchTerm, viewMode, sortBy])

  // Group trades by asset for asset view
  const tradesByAsset = useMemo(() => {
    const grouped = filteredTrades.reduce((acc, trade) => {
      if (!acc[trade.asset]) {
        acc[trade.asset] = []
      }
      acc[trade.asset].push(trade)
      return acc
    }, {} as Record<string, Trade[]>)
    return grouped
  }, [filteredTrades])

  const handleTradeCreate = async (tradeData: Partial<Trade>) => {
    await createTrade(tradeData)
    await fetchTrades()
    setActiveTab('cards')
  }

  const handleTradeUpdate = async (tradeData: Partial<Trade>) => {
    if (selectedTrade) {
      await updateTrade(selectedTrade.id, tradeData)
      await fetchTrades()
      setSelectedTrade(null)
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - new Date(date).getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffDays > 0) {
      return `${diffDays}d ago`
    } else if (diffHours > 0) {
      return `${diffHours}h ago`
    } else {
      return 'Just now'
    }
  }

  const getAssetIcon = (asset: string) => {
    if (asset.includes('USD')) return '💱'
    if (asset.includes('BTC') || asset.includes('ETH')) return '🪙'
    if (asset.includes('EUR')) return '🇪🇺'
    if (asset.includes('GBP')) return '🇬🇧'
    if (asset.includes('JPY')) return '🇯🇵'
    if (asset.includes('AUD')) return '🇦🇺'
    if (asset.includes('CAD')) return '🇨🇦'
    return '📊'
  }

  const getMiniChart = (trade: Trade) => {
    const isWin = trade.result === 'win'
    const bars = Array.from({ length: 8 }, (_, i) => {
      const height = Math.random() * 20 + 10
      return (
        <div
          key={i}
          className={`w-1 bg-gradient-to-t ${
            isWin ? 'from-teal-600 to-teal-400' : 'from-red-600 to-red-400'
          } rounded-sm opacity-60`}
          style={{ height: `${height}px` }}
        />
      )
    })
    
    return <div className="flex items-end gap-0.5 h-6">{bars}</div>
  }

  const TradeCard = ({ trade }: { trade: Trade }) => {
    const isWin = trade.result === 'win'
    const cardBg = isWin 
      ? 'bg-gradient-to-br from-teal-900/50 via-teal-800/30 to-green-900/50' 
      : 'bg-gradient-to-br from-red-900/50 via-red-800/30 to-pink-900/50'
    const borderColor = isWin ? 'border-teal-500/30' : 'border-red-500/30'
    
    return (
      <div 
        className={`group card ${cardBg} ${borderColor} border-2 hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden`}
        onClick={() => setSelectedTrade(trade)}
      >
        {/* Quick Actions - Show on Hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
          <button className="p-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs backdrop-blur-sm">
            ✏️
          </button>
          <button className="p-1 bg-white/20 hover:bg-white/30 rounded text-white text-xs backdrop-blur-sm">
            📋
          </button>
          <button className="p-1 bg-white/20 hover:bg-red-400/30 rounded text-white text-xs backdrop-blur-sm">
            🗑️
          </button>
        </div>

        {/* Asset Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getAssetIcon(trade.asset)}</span>
            <div>
              <h3 className="font-bold text-white text-lg">{trade.asset}</h3>
              <p className="text-xs text-gray-300">{formatTimeAgo(trade.entryTime)}</p>
            </div>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-bold ${
            isWin ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {isWin ? '💰 WIN' : '📉 LOSS'}
          </div>
        </div>

        {/* Trade Direction & Amount */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{trade.direction === 'call' ? '⬆️' : '⬇️'}</span>
            <span className="text-sm text-gray-300 font-medium uppercase">{trade.direction}</span>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white">${trade.amount}</div>
            <div className="text-xs text-gray-300">Stake</div>
          </div>
        </div>

        {/* Price Movement */}
        <div className="bg-white/10 rounded-lg p-3 mb-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-sm">
            <div>
              <div className="text-gray-300">Entry</div>
              <div className="font-bold text-white">{trade.entryPrice.toFixed(5)}</div>
            </div>
            <div className="text-2xl">{isWin ? '📈' : '📉'}</div>
            <div>
              <div className="text-gray-300">Exit</div>
              <div className="font-bold text-white">{trade.exitPrice.toFixed(5)}</div>
            </div>
          </div>
        </div>

        {/* Mini Chart */}
        <div className="mb-3">
          <div className="text-xs text-gray-300 mb-1">Performance</div>
          {getMiniChart(trade)}
        </div>

        {/* Profit/Loss */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-right flex-1">
            <div className={`text-2xl font-bold ${isWin ? 'text-teal-400' : 'text-red-400'}`}>
              {trade.profit >= 0 ? '+' : ''}${trade.profit.toFixed(2)}
            </div>
            <div className="text-xs text-gray-300">
              {((trade.profit / trade.amount) * 100).toFixed(1)}% ROI
            </div>
          </div>
        </div>

        {/* Strategy & Time */}
        <div className="border-t border-white/10 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-sm">🎯</span>
              <span className="text-xs text-gray-300 truncate">
                {trade.strategy || 'No Strategy'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm">⏱️</span>
              <span className="text-xs text-gray-300">{trade.timeframe}</span>
            </div>
          </div>
        </div>

        {/* Platform Badge */}
        <div className="absolute top-2 left-2">
          <div className="bg-white/20 px-2 py-1 rounded-full text-xs text-white backdrop-blur-sm">
            {trade.platform}
          </div>
        </div>
      </div>
    )
  }

  const StatsCard = ({ title, value, subtitle, icon, color }: {
    title: string
    value: string | number
    subtitle: string
    icon: string
    color: 'teal' | 'red' | 'blue' | 'purple'
  }) => {
    const gradients = {
      teal: 'bg-gradient-to-br from-teal-800/50 to-green-800/50 border-teal-500/30',
      red: 'bg-gradient-to-br from-red-800/50 to-pink-800/50 border-red-500/30',
      blue: 'bg-gradient-to-br from-blue-800/50 to-indigo-800/50 border-blue-500/30',
      purple: 'bg-gradient-to-br from-purple-800/50 to-indigo-800/50 border-purple-500/30'
    }

    return (
      <div className={`card ${gradients[color]} border-2 text-center hover:scale-105 transition-all duration-300`}>
        <div className="text-3xl mb-2">{icon}</div>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <div className="text-sm text-gray-300 font-medium mb-1">{title}</div>
        <div className="text-xs text-gray-400">{subtitle}</div>
      </div>
    )
  }

  const tabs = [
    { 
      key: 'cards', 
      label: isPortuguese ? 'Cards Visuais' : 'Visual Cards',
      icon: '🎴',
      description: isPortuguese ? 'Visualização em cards' : 'Card view'
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
      description: isPortuguese ? 'Filtros visuais' : 'Visual filters'
    },
    { 
      key: 'import', 
      label: isPortuguese ? 'Importar' : 'Import',
      icon: '📄',
      description: isPortuguese ? 'Upload de dados' : 'Data upload'
    }
  ]

  const viewModes = [
    { key: 'all', label: isPortuguese ? 'Todos' : 'All', icon: '🎴' },
    { key: 'wins', label: isPortuguese ? 'Ganhos' : 'Wins', icon: '💰' },
    { key: 'losses', label: isPortuguese ? 'Perdas' : 'Losses', icon: '📉' },
    { key: 'by-asset', label: isPortuguese ? 'Por Ativo' : 'By Asset', icon: '📊' }
  ]

  const sortOptions = [
    { key: 'newest', label: isPortuguese ? 'Mais Recente' : 'Newest', icon: '🕐' },
    { key: 'oldest', label: isPortuguese ? 'Mais Antigo' : 'Oldest', icon: '📅' },
    { key: 'profit', label: isPortuguese ? 'Por Lucro' : 'By Profit', icon: '💰' },
    { key: 'amount', label: isPortuguese ? 'Por Valor' : 'By Amount', icon: '💵' }
  ]

  return (
    <>
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
          {isPortuguese ? 'Trading Cards Visuais' : 'Visual Trading Cards'}
        </h1>
        <p className="text-xl font-comfortaa font-normal text-white max-w-4xl mx-auto">
          {isPortuguese 
            ? 'Interface moderna baseada em cards com gráficos visuais, animações interativas e organização intuitiva das suas operações.' 
            : 'Modern card-based interface with visual charts, interactive animations, and intuitive organization of your trades.'
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

      {/* Visual Stats Overview */}
      {stats && !statsLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatsCard
            icon="🎴"
            title={isPortuguese ? 'Total' : 'Total'}
            value={stats.totalTrades}
            subtitle={isPortuguese ? 'Operações' : 'Trades'}
            color="blue"
          />
          <StatsCard
            icon="📊"
            title={isPortuguese ? 'Taxa de Acerto' : 'Win Rate'}
            value={`${stats.winRate.toFixed(1)}%`}
            subtitle={`${stats.winTrades}/${stats.totalTrades} wins`}
            color={stats.winRate >= 50 ? 'teal' : 'red'}
          />
          <StatsCard
            icon="💰"
            title="P&L Total"
            value={`${stats.totalPnl >= 0 ? '+' : ''}$${stats.totalPnl.toFixed(0)}`}
            subtitle={isPortuguese ? 'Lucro Total' : 'Total Profit'}
            color={stats.totalPnl >= 0 ? 'teal' : 'red'}
          />
          <StatsCard
            icon="⚡"
            title="P&L Médio"
            value={`${stats.avgPnl >= 0 ? '+' : ''}$${stats.avgPnl.toFixed(2)}`}
            subtitle={isPortuguese ? 'Por Operação' : 'Per Trade'}
            color={stats.avgPnl >= 0 ? 'teal' : 'red'}
          />
          <StatsCard
            icon="🎯"
            title="Max Drawdown"
            value={`$${Math.abs(stats.maxDrawdown).toFixed(0)}`}
            subtitle={isPortuguese ? 'Perda Máxima' : 'Maximum Loss'}
            color="purple"
          />
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
                ? 'bg-gradient-to-r from-teal-600 to-green-600 text-white shadow-glow'
                : 'bg-dark-card text-gray-300 hover:bg-teal-600/20 hover:text-white'
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
        {activeTab === 'cards' && (
          <>
            {/* Visual Controls */}
            <div className="card bg-gradient-to-r from-teal-800/20 to-green-800/20 border-teal-500/30 border">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                {/* Search */}
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                      type="text"
                      placeholder={isPortuguese ? 'Buscar por ativo, estratégia...' : 'Search by asset, strategy...'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-10 py-2 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                    />
                  </div>
                </div>

                {/* View Mode */}
                <div className="flex gap-2">
                  {viewModes.map(mode => (
                    <button
                      key={mode.key}
                      onClick={() => setViewMode(mode.key as any)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        viewMode === mode.key
                          ? 'bg-teal-600 text-white'
                          : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                      }`}
                    >
                      <span className="mr-1">{mode.icon}</span>
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                >
                  {sortOptions.map(option => (
                    <option key={option.key} value={option.key} className="bg-dark-card text-white">
                      {option.icon} {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cards Grid */}
            {viewMode === 'by-asset' ? (
              // Group by Asset View
              <div className="space-y-8">
                {Object.entries(tradesByAsset).map(([asset, assetTrades]) => (
                  <div key={asset}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{getAssetIcon(asset)}</span>
                      <h2 className="text-2xl font-bold text-white">{asset}</h2>
                      <span className="text-teal-400 text-sm">
                        ({assetTrades.length} trades)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {assetTrades.map(trade => (
                        <TradeCard key={trade.id} trade={trade} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Regular Grid View
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTrades.map(trade => (
                  <TradeCard key={trade.id} trade={trade} />
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredTrades.length === 0 && !tradesLoading && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🎴</div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {isPortuguese ? 'Nenhuma operação encontrada' : 'No trades found'}
                </h3>
                <p className="text-gray-300 mb-6">
                  {isPortuguese 
                    ? 'Ajuste seus filtros ou adicione sua primeira operação' 
                    : 'Adjust your filters or add your first trade'}
                </p>
                <button
                  onClick={() => setActiveTab('form')}
                  className="bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all"
                >
                  ➕ {isPortuguese ? 'Adicionar Operação' : 'Add Trade'}
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === 'form' && (
          <TradeForm
            onTradeCreate={handleTradeCreate}
            loading={tradesLoading}
          />
        )}

        {activeTab === 'filters' && (
          <div className="card bg-gradient-to-br from-teal-800/20 to-green-800/20 border-teal-500/30 border">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              🎨 {isPortuguese ? 'Filtros Visuais' : 'Visual Filters'}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  📅 {isPortuguese ? 'Período' : 'Date Range'}
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={filters.dateRange.start}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value }
                    }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                  />
                  <input
                    type="date"
                    value={filters.dateRange.end}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value }
                    }))}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                  />
                </div>
              </div>

              {/* Asset Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  💱 {isPortuguese ? 'Ativo' : 'Asset'}
                </label>
                <input
                  type="text"
                  placeholder={isPortuguese ? 'Ex: EURUSD, BTCUSD...' : 'Ex: EURUSD, BTCUSD...'}
                  value={filters.asset}
                  onChange={(e) => setFilters(prev => ({ ...prev, asset: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                />
              </div>

              {/* Result Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  🎯 {isPortuguese ? 'Resultado' : 'Result'}
                </label>
                <select
                  value={filters.result}
                  onChange={(e) => setFilters(prev => ({ ...prev, result: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                >
                  <option value="" className="bg-dark-card">{isPortuguese ? 'Todos' : 'All'}</option>
                  <option value="win" className="bg-dark-card">💰 {isPortuguese ? 'Ganhos' : 'Wins'}</option>
                  <option value="loss" className="bg-dark-card">📉 {isPortuguese ? 'Perdas' : 'Losses'}</option>
                </select>
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  💰 {isPortuguese ? 'Valor Mínimo' : 'Min Amount'}
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.minAmount}
                  onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  💵 {isPortuguese ? 'Valor Máximo' : 'Max Amount'}
                </label>
                <input
                  type="number"
                  placeholder="1000"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
                />
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilters({
                      dateRange: { start: '', end: '' },
                      asset: '',
                      result: '',
                      minAmount: '',
                      maxAmount: ''
                    })
                    setSearchTerm('')
                  }}
                  className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg font-medium transition-all"
                >
                  🗑️ {isPortuguese ? 'Limpar Filtros' : 'Clear Filters'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-poly font-bold text-white mb-4 flex items-center justify-center gap-2">
                📊 {isPortuguese ? 'Importar Dados' : 'Import Data'}
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
          <div className="card bg-gradient-to-br from-teal-800/50 to-green-800/50 border-teal-500/30 border p-8 text-center">
            <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white font-comfortaa">
              {isPortuguese ? 'Carregando cards...' : 'Loading cards...'}
            </p>
          </div>
        </div>
      )}

      {/* Visual Cards Summary */}
      <div className="mt-16 py-8">
        <div className="card bg-gradient-to-r from-teal-800/20 via-green-800/20 to-emerald-800/20 border-teal-500/20 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="text-3xl">🎴</div>
            <h3 className="font-heading text-xl font-bold">
              {isPortuguese ? 'Trades V2 - Visual Cards' : 'Trades V2 - Visual Cards'}
            </h3>
          </div>
          <p className="text-gray-400 max-w-3xl mx-auto mb-6">
            {isPortuguese 
              ? 'Esta versão da página de trades oferece uma experiência visual moderna com cards interativos, gráficos em miniatura, animações suaves e organização intuitiva por categorias.'
              : 'This trades page version offers a modern visual experience with interactive cards, mini charts, smooth animations, and intuitive organization by categories.'
            }
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Cards Visuais' : 'Visual Cards'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Mini Gráficos' : 'Mini Charts'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Drag & Drop' : 'Drag & Drop'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Filtros Visuais' : 'Visual Filters'}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-lime-400 rounded-full animate-pulse"></div>
              {isPortuguese ? 'Animações Suaves' : 'Smooth Animations'}
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