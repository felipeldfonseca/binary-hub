'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import TradeCard from './TradeCard'

interface TradesGridProps {
  trades: Trade[]
  loading?: boolean
  onTradeClick?: (trade: Trade) => void
  onTradeEdit?: (trade: Trade) => void
  onTradeDelete?: (tradeId: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  viewMode?: 'grid' | 'compact'
  sortBy?: 'date' | 'profit' | 'asset' | 'result'
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  className?: string
}

export default function TradesGrid({
  trades,
  loading = false,
  onTradeClick,
  onTradeEdit,
  onTradeDelete,
  onLoadMore,
  hasMore = false,
  viewMode = 'grid',
  sortBy = 'date',
  sortOrder = 'desc',
  onSortChange,
  className = ''
}: TradesGridProps) {
  const { isPortuguese } = useLanguage()
  const [draggedTrade, setDraggedTrade] = useState<Trade | null>(null)

  // Sort trades based on selected criteria
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime()
          break
        case 'profit':
          comparison = a.profit - b.profit
          break
        case 'asset':
          comparison = a.asset.localeCompare(b.asset)
          break
        case 'result':
          const resultOrder = { 'win': 3, 'tie': 2, 'loss': 1 }
          comparison = (resultOrder[a.result as keyof typeof resultOrder] || 0) - 
                      (resultOrder[b.result as keyof typeof resultOrder] || 0)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [trades, sortBy, sortOrder])

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, trade: Trade) => {
    setDraggedTrade(trade)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', trade.id)
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedTrade(null)
  }, [])

  // Handle sort change
  const handleSortChange = useCallback((newSortBy: string) => {
    if (newSortBy === sortBy) {
      // Toggle sort order if same field
      onSortChange?.(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new sort field with default order
      onSortChange?.(newSortBy, 'desc')
    }
  }, [sortBy, sortOrder, onSortChange])

  // Get grid classes based on view mode
  const getGridClasses = () => {
    if (viewMode === 'compact') {
      return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4'
    }
    return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
  }

  // Get statistics
  const stats = useMemo(() => {
    const totalTrades = trades.length
    const wins = trades.filter(t => t.result === 'win').length
    const losses = trades.filter(t => t.result === 'loss').length
    const ties = trades.filter(t => t.result === 'tie').length
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
    const totalPnl = trades.reduce((sum, t) => sum + t.profit, 0)

    return { totalTrades, wins, losses, ties, winRate, totalPnl }
  }, [trades])

  return (
    <div className={`w-full ${className}`}>
      {/* Header with stats and controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="bg-white/10 px-3 py-2 rounded-lg backdrop-blur-sm">
            <span className="text-white/70">
              {isPortuguese ? 'Total:' : 'Total:'}
            </span>
            <span className="ml-2 font-semibold text-white">
              {stats.totalTrades}
            </span>
          </div>
          
          <div className="bg-win/20 px-3 py-2 rounded-lg backdrop-blur-sm">
            <span className="text-win/80">
              {isPortuguese ? 'Vitórias:' : 'Wins:'}
            </span>
            <span className="ml-2 font-semibold text-win">
              {stats.wins}
            </span>
          </div>
          
          <div className="bg-error/20 px-3 py-2 rounded-lg backdrop-blur-sm">
            <span className="text-error/80">
              {isPortuguese ? 'Derrotas:' : 'Losses:'}
            </span>
            <span className="ml-2 font-semibold text-error">
              {stats.losses}
            </span>
          </div>
          
          <div className="bg-primary/20 px-3 py-2 rounded-lg backdrop-blur-sm">
            <span className="text-primary/80">
              {isPortuguese ? 'Taxa:' : 'Win Rate:'}
            </span>
            <span className="ml-2 font-semibold text-primary">
              {stats.winRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Sort and View Controls */}
        <div className="flex items-center gap-3">
          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-')
                onSortChange?.(field, order as 'asc' | 'desc')
              }}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm backdrop-blur-sm focus:border-primary focus:outline-none"
            >
              <option value="date-desc" className="bg-background text-white">
                {isPortuguese ? 'Mais Recentes' : 'Most Recent'}
              </option>
              <option value="date-asc" className="bg-background text-white">
                {isPortuguese ? 'Mais Antigos' : 'Oldest First'}
              </option>
              <option value="profit-desc" className="bg-background text-white">
                {isPortuguese ? 'Maior Lucro' : 'Highest Profit'}
              </option>
              <option value="profit-asc" className="bg-background text-white">
                {isPortuguese ? 'Menor Lucro' : 'Lowest Profit'}
              </option>
              <option value="asset-asc" className="bg-background text-white">
                {isPortuguese ? 'Ativo A-Z' : 'Asset A-Z'}
              </option>
              <option value="result-desc" className="bg-background text-white">
                {isPortuguese ? 'Vitórias Primeiro' : 'Wins First'}
              </option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-white/10 rounded-lg p-1 backdrop-blur-sm">
            <button
              onClick={() => onSortChange?.('viewMode', viewMode === 'grid' ? 'compact' : 'grid')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-primary text-background' 
                  : 'text-white hover:bg-white/10'
              }`}
              title={isPortuguese ? 'Vista em Grade' : 'Grid View'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => onSortChange?.('viewMode', viewMode === 'compact' ? 'grid' : 'compact')}
              className={`p-2 rounded transition-colors ${
                viewMode === 'compact' 
                  ? 'bg-primary text-background' 
                  : 'text-white hover:bg-white/10'
              }`}
              title={isPortuguese ? 'Vista Compacta' : 'Compact View'}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 16a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && trades.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="spinner mb-4"></div>
            <p className="text-white/70">
              {isPortuguese ? 'Carregando operações...' : 'Loading trades...'}
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && trades.length === 0 && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {isPortuguese ? 'Nenhuma operação encontrada' : 'No trades found'}
            </h3>
            <p className="text-white/70 mb-6">
              {isPortuguese 
                ? 'Comece importando seus dados ou adicionando uma nova operação.' 
                : 'Start by importing your data or adding a new trade.'
              }
            </p>
          </div>
        </div>
      )}

      {/* Trades Grid */}
      {trades.length > 0 && (
        <>
          <div className={getGridClasses()}>
            {sortedTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                onClick={onTradeClick}
                onEdit={onTradeEdit}
                onDelete={onTradeDelete}
                onDragStart={handleDragStart}
                isDragging={draggedTrade?.id === trade.id}
                className="animate-fade-in"
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={onLoadMore}
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin"></div>
                    {isPortuguese ? 'Carregando...' : 'Loading...'}
                  </div>
                ) : (
                  isPortuguese ? 'Carregar Mais' : 'Load More'
                )}
              </button>
            </div>
          )}

          {/* Drag and Drop Instructions */}
          {draggedTrade && (
            <div className="fixed bottom-4 right-4 bg-primary text-background px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce">
              <p className="text-sm font-medium">
                {isPortuguese 
                  ? 'Arraste para categorizar ou organizar' 
                  : 'Drag to categorize or organize'
                }
              </p>
            </div>
          )}
        </>
      )}

      {/* Drag End Handler */}
      {draggedTrade && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDragEnd}
          className="fixed inset-0 z-40 pointer-events-none"
        />
      )}
    </div>
  )
}