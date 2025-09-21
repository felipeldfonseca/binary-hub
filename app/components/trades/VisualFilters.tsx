'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Trade, TradeFilters } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface FilterTag {
  id: string
  label: string
  value: any
  type: 'result' | 'asset' | 'direction' | 'timeframe' | 'strategy' | 'platform' | 'date'
  color: string
  count: number
  icon?: string
}

interface VisualFiltersProps {
  trades: Trade[]
  filters: TradeFilters
  onFiltersChange: (filters: TradeFilters) => void
  onClearFilters: () => void
  className?: string
}

export default function VisualFilters({
  trades,
  filters,
  onFiltersChange,
  onClearFilters,
  className = ''
}: VisualFiltersProps) {
  const { isPortuguese } = useLanguage()
  const [isExpanded, setIsExpanded] = useState(false)

  // Generate filter tags from trades data
  const filterTags = useMemo(() => {
    const tags: FilterTag[] = []
    
    // Result filters
    const results = ['win', 'loss', 'tie'] as const
    results.forEach(result => {
      const count = trades.filter(t => t.result === result).length
      if (count > 0) {
        tags.push({
          id: `result-${result}`,
          label: isPortuguese 
            ? (result === 'win' ? 'Vitórias' : result === 'loss' ? 'Derrotas' : 'Empates')
            : (result === 'win' ? 'Wins' : result === 'loss' ? 'Losses' : 'Ties'),
          value: result,
          type: 'result',
          color: result === 'win' ? 'bg-win/20 text-win border-win/30' : 
                 result === 'loss' ? 'bg-error/20 text-error border-error/30' : 
                 'bg-neutral/20 text-neutral border-neutral/30',
          count,
          icon: result === 'win' ? '✅' : result === 'loss' ? '❌' : '➖'
        })
      }
    })
    
    // Asset filters (top 10 most traded)
    const assetCounts = trades.reduce((acc, trade) => {
      acc[trade.asset] = (acc[trade.asset] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(assetCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([asset, count]) => {
        tags.push({
          id: `asset-${asset}`,
          label: asset,
          value: asset,
          type: 'asset',
          color: 'bg-primary/20 text-primary border-primary/30',
          count,
          icon: '📈'
        })
      })
    
    // Direction filters
    const directions = ['call', 'put'] as const
    directions.forEach(direction => {
      const count = trades.filter(t => t.direction === direction).length
      if (count > 0) {
        tags.push({
          id: `direction-${direction}`,
          label: direction === 'call' ? '▲ CALL' : '▼ PUT',
          value: direction,
          type: 'direction',
          color: direction === 'call' ? 'bg-win/20 text-win border-win/30' : 'bg-error/20 text-error border-error/30',
          count,
          icon: direction === 'call' ? '📈' : '📉'
        })
      }
    })
    
    // Timeframe filters
    const timeframeCounts = trades.reduce((acc, trade) => {
      acc[trade.timeframe] = (acc[trade.timeframe] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(timeframeCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .forEach(([timeframe, count]) => {
        tags.push({
          id: `timeframe-${timeframe}`,
          label: timeframe,
          value: timeframe,
          type: 'timeframe',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          count,
          icon: '⏱️'
        })
      })
    
    // Strategy filters (if strategies exist)
    const strategyCounts = trades
      .filter(t => t.strategy)
      .reduce((acc, trade) => {
        if (trade.strategy) {
          acc[trade.strategy] = (acc[trade.strategy] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)
    
    Object.entries(strategyCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .forEach(([strategy, count]) => {
        tags.push({
          id: `strategy-${strategy}`,
          label: strategy,
          value: strategy,
          type: 'strategy',
          color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          count,
          icon: '🎯'
        })
      })
    
    // Platform filters
    const platformCounts = trades.reduce((acc, trade) => {
      acc[trade.platform] = (acc[trade.platform] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    Object.entries(platformCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([platform, count]) => {
        tags.push({
          id: `platform-${platform}`,
          label: platform,
          value: platform,
          type: 'platform',
          color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
          count,
          icon: '🏢'
        })
      })
    
    return tags
  }, [trades, isPortuguese])

  // Quick date range filters
  const dateRangeFilters = useMemo(() => [
    {
      id: 'today',
      label: isPortuguese ? 'Hoje' : 'Today',
      getValue: () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return { start: today, end: new Date() }
      }
    },
    {
      id: 'yesterday',
      label: isPortuguese ? 'Ontem' : 'Yesterday',
      getValue: () => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(0, 0, 0, 0)
        const endOfYesterday = new Date(yesterday)
        endOfYesterday.setHours(23, 59, 59, 999)
        return { start: yesterday, end: endOfYesterday }
      }
    },
    {
      id: 'week',
      label: isPortuguese ? 'Esta Semana' : 'This Week',
      getValue: () => {
        const today = new Date()
        const dayOfWeek = today.getDay()
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - dayOfWeek)
        startOfWeek.setHours(0, 0, 0, 0)
        return { start: startOfWeek, end: new Date() }
      }
    },
    {
      id: 'month',
      label: isPortuguese ? 'Este Mês' : 'This Month',
      getValue: () => {
        const today = new Date()
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        return { start: startOfMonth, end: new Date() }
      }
    }
  ], [isPortuguese])

  // Check if a filter is active
  const isFilterActive = useCallback((tag: FilterTag) => {
    switch (tag.type) {
      case 'result':
        return filters.result === tag.value
      case 'asset':
        return filters.asset === tag.value
      case 'strategy':
        return filters.strategy === tag.value
      default:
        return false
    }
  }, [filters])

  // Handle filter toggle
  const handleFilterToggle = useCallback((tag: FilterTag) => {
    const isActive = isFilterActive(tag)
    const newFilters = { ...filters }
    
    if (isActive) {
      // Remove filter
      switch (tag.type) {
        case 'result':
          delete newFilters.result
          break
        case 'asset':
          delete newFilters.asset
          break
        case 'strategy':
          delete newFilters.strategy
          break
      }
    } else {
      // Add filter
      switch (tag.type) {
        case 'result':
          newFilters.result = tag.value
          break
        case 'asset':
          newFilters.asset = tag.value
          break
        case 'strategy':
          newFilters.strategy = tag.value
          break
      }
    }
    
    onFiltersChange(newFilters)
  }, [filters, isFilterActive, onFiltersChange])

  // Handle date range filter
  const handleDateRangeFilter = useCallback((rangeId: string) => {
    const range = dateRangeFilters.find(r => r.id === rangeId)
    if (range) {
      const { start, end } = range.getValue()
      onFiltersChange({
        ...filters,
        start,
        end
      })
    }
  }, [dateRangeFilters, filters, onFiltersChange])

  // Get active filters count
  const activeFiltersCount = useMemo(() => {
    return Object.keys(filters).filter(key => 
      key !== 'limit' && key !== 'offset' && filters[key as keyof TradeFilters] !== undefined
    ).length
  }, [filters])

  // Group tags by type for display
  const groupedTags = useMemo(() => {
    return filterTags.reduce((acc, tag) => {
      if (!acc[tag.type]) acc[tag.type] = []
      acc[tag.type].push(tag)
      return acc
    }, {} as Record<string, FilterTag[]>)
  }, [filterTags])

  const typeLabels = {
    result: isPortuguese ? 'Resultado' : 'Result',
    asset: isPortuguese ? 'Ativos' : 'Assets',
    direction: isPortuguese ? 'Direção' : 'Direction',
    timeframe: isPortuguese ? 'Tempo' : 'Timeframe',
    strategy: isPortuguese ? 'Estratégia' : 'Strategy',
    platform: isPortuguese ? 'Plataforma' : 'Platform'
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-white">
            {isPortuguese ? 'Filtros' : 'Filters'}
          </h3>
          {activeFiltersCount > 0 && (
            <span className="bg-primary text-background px-2 py-1 rounded-full text-xs font-semibold">
              {activeFiltersCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {activeFiltersCount > 0 && (
            <button
              onClick={onClearFilters}
              className="text-xs text-white/70 hover:text-white transition-colors"
            >
              {isPortuguese ? 'Limpar Tudo' : 'Clear All'}
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title={isExpanded ? (isPortuguese ? 'Ocultar' : 'Collapse') : (isPortuguese ? 'Expandir' : 'Expand')}
          >
            <svg
              className={`w-4 h-4 text-white/70 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick Date Range Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {dateRangeFilters.map((range) => {
          const isActive = filters.start && filters.end
          return (
            <button
              key={range.id}
              onClick={() => handleDateRangeFilter(range.id)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                ${isActive 
                  ? 'bg-primary/30 text-primary border-primary/50' 
                  : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10'
                }
              `}
            >
              📅 {range.label}
            </button>
          )
        })}
      </div>

      {/* Filter Tags */}
      <div className={`transition-all duration-300 ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-24 opacity-100'} overflow-hidden`}>
        <div className="space-y-4">
          {Object.entries(groupedTags).map(([type, tags]) => (
            <div key={type}>
              <div className="text-xs font-medium text-white/70 mb-2 uppercase tracking-wide">
                {typeLabels[type as keyof typeof typeLabels] || type}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isActive = isFilterActive(tag)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => handleFilterToggle(tag)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                        ${isActive 
                          ? `${tag.color} scale-105 shadow-lg` 
                          : 'bg-white/5 text-white/70 border-white/20 hover:bg-white/10 hover:scale-105'
                        }
                        flex items-center gap-1.5
                      `}
                    >
                      {tag.icon && <span>{tag.icon}</span>}
                      <span>{tag.label}</span>
                      <span className="bg-black/20 px-1.5 py-0.5 rounded text-xs">
                        {tag.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {activeFiltersCount > 0 && (
        <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="text-xs text-white/70 mb-2">
            {isPortuguese ? 'Filtros Ativos:' : 'Active Filters:'}
          </div>
          <div className="flex flex-wrap gap-2">
            {filters.result && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-win/20 text-win rounded text-xs">
                {isPortuguese ? 'Resultado:' : 'Result:'} {filters.result}
                <button
                  onClick={() => onFiltersChange({ ...filters, result: undefined })}
                  className="hover:bg-win/20 rounded p-0.5"
                >
                  ×
                </button>
              </span>
            )}
            {filters.asset && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded text-xs">
                {isPortuguese ? 'Ativo:' : 'Asset:'} {filters.asset}
                <button
                  onClick={() => onFiltersChange({ ...filters, asset: undefined })}
                  className="hover:bg-primary/20 rounded p-0.5"
                >
                  ×
                </button>
              </span>
            )}
            {filters.strategy && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                {isPortuguese ? 'Estratégia:' : 'Strategy:'} {filters.strategy}
                <button
                  onClick={() => onFiltersChange({ ...filters, strategy: undefined })}
                  className="hover:bg-purple-500/20 rounded p-0.5"
                >
                  ×
                </button>
              </span>
            )}
            {(filters.start || filters.end) && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                📅 {isPortuguese ? 'Data' : 'Date Range'}
                <button
                  onClick={() => onFiltersChange({ ...filters, start: undefined, end: undefined })}
                  className="hover:bg-blue-500/20 rounded p-0.5"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}