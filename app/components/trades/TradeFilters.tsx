'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { TradeFilters } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface TradeFiltersProps {
  onFiltersChange: (filters: TradeFilters) => void
  loading?: boolean
  totalTrades?: number
  filteredTrades?: number
}

interface SavedFilter {
  id: string
  name: string
  filters: TradeFilters
}

interface FilterState {
  startDate: string
  endDate: string
  result: string
  asset: string
  strategy: string
  minAmount: string
  maxAmount: string
}

const TradeFiltersComponent: React.FC<TradeFiltersProps> = ({
  onFiltersChange,
  loading = false,
  totalTrades = 0,
  filteredTrades = 0,
}) => {
  const { isPortuguese } = useLanguage()

  const translations = {
    en: {
      title: 'Filters & Search',
      dateRange: 'Date Range',
      startDate: 'Start Date',
      endDate: 'End Date',
      result: 'Result',
      allResults: 'All Results',
      wins: 'Wins Only',
      losses: 'Losses Only',
      ties: 'Ties Only',
      asset: 'Asset',
      assetPlaceholder: 'e.g., EURUSD, GBPUSD',
      strategy: 'Strategy',
      strategyPlaceholder: 'e.g., Support/Resistance',
      amountRange: 'Amount Range ($)',
      minAmount: 'Min Amount',
      maxAmount: 'Max Amount',
      quickFilters: 'Quick Filters',
      today: 'Today',
      thisWeek: 'This Week',
      thisMonth: 'This Month',
      last30Days: 'Last 30 Days',
      last90Days: 'Last 90 Days',
      clearAll: 'Clear All',
      applyFilters: 'Apply Filters',
      saveFilter: 'Save Filter Set',
      savedFilters: 'Saved Filters',
      filterName: 'Filter Name',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      showingResults: 'Showing {{filtered}} of {{total}} trades',
      noFiltersApplied: 'No filters applied',
      filtersSaved: 'Filter set saved successfully',
      filtersDeleted: 'Filter set deleted',
      enterFilterName: 'Enter filter name...',
    },
    pt: {
      title: 'Filtros e Busca',
      dateRange: 'Período',
      startDate: 'Data Inicial',
      endDate: 'Data Final',
      result: 'Resultado',
      allResults: 'Todos os Resultados',
      wins: 'Apenas Ganhos',
      losses: 'Apenas Perdas',
      ties: 'Apenas Empates',
      asset: 'Ativo',
      assetPlaceholder: 'ex.: EURUSD, GBPUSD',
      strategy: 'Estratégia',
      strategyPlaceholder: 'ex.: Suporte/Resistência',
      amountRange: 'Faixa de Valor ($)',
      minAmount: 'Valor Mínimo',
      maxAmount: 'Valor Máximo',
      quickFilters: 'Filtros Rápidos',
      today: 'Hoje',
      thisWeek: 'Esta Semana',
      thisMonth: 'Este Mês',
      last30Days: 'Últimos 30 Dias',
      last90Days: 'Últimos 90 Dias',
      clearAll: 'Limpar Tudo',
      applyFilters: 'Aplicar Filtros',
      saveFilter: 'Salvar Conjunto de Filtros',
      savedFilters: 'Filtros Salvos',
      filterName: 'Nome do Filtro',
      save: 'Salvar',
      cancel: 'Cancelar',
      delete: 'Excluir',
      showingResults: 'Mostrando {{filtered}} de {{total}} operações',
      noFiltersApplied: 'Nenhum filtro aplicado',
      filtersSaved: 'Conjunto de filtros salvo com sucesso',
      filtersDeleted: 'Conjunto de filtros excluído',
      enterFilterName: 'Digite o nome do filtro...',
    }
  }

  const t = translations[isPortuguese ? 'pt' : 'en']

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    startDate: '',
    endDate: '',
    result: '',
    asset: '',
    strategy: '',
    minAmount: '',
    maxAmount: '',
  })

  // Saved filters state
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [newFilterName, setNewFilterName] = useState('')

  // Expanded state for mobile
  const [isExpanded, setIsExpanded] = useState(false)

  // Load saved filters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('binary-hub-saved-filters')
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading saved filters:', error)
      }
    }
  }, [])

  // Save filters to localStorage
  const saveFiltersToStorage = useCallback((filters: SavedFilter[]) => {
    try {
      localStorage.setItem('binary-hub-saved-filters', JSON.stringify(filters))
    } catch (error) {
      console.error('Error saving filters:', error)
    }
  }, [])

  const handleFilterChange = useCallback((field: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }, [])

  const convertFiltersToTradeFilters = useCallback((filterState: FilterState): TradeFilters => {
    const tradeFilters: TradeFilters = {}

    if (filterState.startDate) {
      tradeFilters.start = new Date(filterState.startDate)
    }
    
    if (filterState.endDate) {
      tradeFilters.end = new Date(filterState.endDate)
    }

    if (filterState.result && filterState.result !== 'all') {
      tradeFilters.result = filterState.result as 'win' | 'loss' | 'tie'
    }

    if (filterState.asset) {
      tradeFilters.asset = filterState.asset
    }

    if (filterState.strategy) {
      tradeFilters.strategy = filterState.strategy
    }

    // Note: minAmount and maxAmount would need to be added to TradeFilters interface
    // For now, we'll skip them but they can be implemented in the backend

    return tradeFilters
  }, [])

  const applyFilters = useCallback(() => {
    const tradeFilters = convertFiltersToTradeFilters(filters)
    onFiltersChange(tradeFilters)
    setIsExpanded(false) // Collapse on mobile after applying
  }, [filters, convertFiltersToTradeFilters, onFiltersChange])

  const clearAllFilters = useCallback(() => {
    const emptyFilters: FilterState = {
      startDate: '',
      endDate: '',
      result: '',
      asset: '',
      strategy: '',
      minAmount: '',
      maxAmount: '',
    }
    setFilters(emptyFilters)
    onFiltersChange({})
  }, [onFiltersChange])

  const applyQuickFilter = useCallback((type: 'today' | 'thisWeek' | 'thisMonth' | 'last30Days' | 'last90Days') => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let startDate: Date

    switch (type) {
      case 'today':
        startDate = today
        break
      case 'thisWeek':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - today.getDay()) // Start of week
        break
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1) // Start of month
        break
      case 'last30Days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 30)
        break
      case 'last90Days':
        startDate = new Date(today)
        startDate.setDate(today.getDate() - 90)
        break
    }

    const newFilters = {
      ...filters,
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    }

    setFilters(newFilters)
    const tradeFilters = convertFiltersToTradeFilters(newFilters)
    onFiltersChange(tradeFilters)
  }, [filters, convertFiltersToTradeFilters, onFiltersChange])

  const saveCurrentFilters = useCallback(() => {
    if (!newFilterName.trim()) return

    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: newFilterName.trim(),
      filters: convertFiltersToTradeFilters(filters),
    }

    const updatedFilters = [...savedFilters, newFilter]
    setSavedFilters(updatedFilters)
    saveFiltersToStorage(updatedFilters)
    setNewFilterName('')
    setShowSaveDialog(false)
  }, [newFilterName, filters, savedFilters, convertFiltersToTradeFilters, saveFiltersToStorage])

  const applySavedFilter = useCallback((savedFilter: SavedFilter) => {
    // Convert saved TradeFilters back to FilterState
    const filterState: FilterState = {
      startDate: savedFilter.filters.start ? savedFilter.filters.start.toISOString().split('T')[0] : '',
      endDate: savedFilter.filters.end ? savedFilter.filters.end.toISOString().split('T')[0] : '',
      result: savedFilter.filters.result || '',
      asset: savedFilter.filters.asset || '',
      strategy: savedFilter.filters.strategy || '',
      minAmount: '',
      maxAmount: '',
    }

    setFilters(filterState)
    onFiltersChange(savedFilter.filters)
  }, [onFiltersChange])

  const deleteSavedFilter = useCallback((filterId: string) => {
    const updatedFilters = savedFilters.filter(f => f.id !== filterId)
    setSavedFilters(updatedFilters)
    saveFiltersToStorage(updatedFilters)
  }, [savedFilters, saveFiltersToStorage])

  const hasActiveFilters = Object.values(filters).some(value => value !== '')
  const resultCount = filteredTrades !== totalTrades ? filteredTrades : totalTrades

  return (
    <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-comfortaa font-semibold">{t.title}</h3>
        
        {/* Mobile toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <span className="text-2xl">{isExpanded ? '−' : '+'}</span>
        </button>

        {/* Results summary */}
        <div className="hidden md:block text-sm text-gray-400">
          {hasActiveFilters ? (
            t.showingResults.replace('{{filtered}}', resultCount.toString()).replace('{{total}}', totalTrades.toString())
          ) : (
            `${totalTrades} ${totalTrades === 1 ? 'trade' : 'trades'}`
          )}
        </div>
      </div>

      {/* Filter Content */}
      <div className={`space-y-6 ${isExpanded ? 'block' : 'hidden md:block'}`}>
        {/* Quick Filters */}
        <div>
          <label className="block text-sm font-comfortaa font-medium text-gray-200 mb-3">
            {t.quickFilters}
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyQuickFilter('today')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              {t.today}
            </button>
            <button
              onClick={() => applyQuickFilter('thisWeek')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              {t.thisWeek}
            </button>
            <button
              onClick={() => applyQuickFilter('thisMonth')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              {t.thisMonth}
            </button>
            <button
              onClick={() => applyQuickFilter('last30Days')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              {t.last30Days}
            </button>
            <button
              onClick={() => applyQuickFilter('last90Days')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
            >
              {t.last90Days}
            </button>
          </div>
        </div>

        {/* Main Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.startDate}
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="form-input w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.endDate}
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="form-input w-full"
            />
          </div>

          {/* Result Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.result}
            </label>
            <select
              value={filters.result}
              onChange={(e) => handleFilterChange('result', e.target.value)}
              className="form-input w-full"
            >
              <option value="" className="bg-gray-800">{t.allResults}</option>
              <option value="win" className="bg-gray-800">{t.wins}</option>
              <option value="loss" className="bg-gray-800">{t.losses}</option>
              <option value="tie" className="bg-gray-800">{t.ties}</option>
            </select>
          </div>

          {/* Asset Filter */}
          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.asset}
            </label>
            <input
              type="text"
              value={filters.asset}
              onChange={(e) => handleFilterChange('asset', e.target.value)}
              placeholder={t.assetPlaceholder}
              className="form-input w-full"
            />
          </div>
        </div>

        {/* Additional Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.strategy}
            </label>
            <input
              type="text"
              value={filters.strategy}
              onChange={(e) => handleFilterChange('strategy', e.target.value)}
              placeholder={t.strategyPlaceholder}
              className="form-input w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.minAmount}
            </label>
            <input
              type="number"
              value={filters.minAmount}
              onChange={(e) => handleFilterChange('minAmount', e.target.value)}
              placeholder="0.00"
              step="0.01"
              className="form-input w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-comfortaa font-medium text-gray-200">
              {t.maxAmount}
            </label>
            <input
              type="number"
              value={filters.maxAmount}
              onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
              placeholder="1000.00"
              step="0.01"
              className="form-input w-full"
            />
          </div>
        </div>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div>
            <label className="block text-sm font-comfortaa font-medium text-gray-200 mb-3">
              {t.savedFilters}
            </label>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map(filter => (
                <div key={filter.id} className="flex items-center bg-white/10 rounded-lg">
                  <button
                    onClick={() => applySavedFilter(filter)}
                    className="px-3 py-1 hover:bg-white/10 rounded-l-lg text-sm transition-colors"
                  >
                    {filter.name}
                  </button>
                  <button
                    onClick={() => deleteSavedFilter(filter.id)}
                    className="px-2 py-1 hover:bg-red-500/20 rounded-r-lg text-xs text-red-400 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/20">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={applyFilters}
              disabled={loading}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {t.applyFilters}
            </button>
            
            <button
              onClick={clearAllFilters}
              disabled={loading}
              className="px-4 py-2 text-sm border border-gray-600 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {t.clearAll}
            </button>

            {hasActiveFilters && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="px-4 py-2 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {t.saveFilter}
              </button>
            )}
          </div>

          {/* Mobile Results Summary */}
          <div className="md:hidden text-sm text-gray-400">
            {hasActiveFilters ? (
              t.showingResults.replace('{{filtered}}', resultCount.toString()).replace('{{total}}', totalTrades.toString())
            ) : (
              `${totalTrades} ${totalTrades === 1 ? 'trade' : 'trades'}`
            )}
          </div>
        </div>
      </div>

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="text-lg font-comfortaa font-semibold mb-4">{t.saveFilter}</h4>
            
            <input
              type="text"
              value={newFilterName}
              onChange={(e) => setNewFilterName(e.target.value)}
              placeholder={t.enterFilterName}
              className="form-input w-full mb-4"
              onKeyDown={(e) => e.key === 'Enter' && saveCurrentFilters()}
            />
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-white/10 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={saveCurrentFilters}
                disabled={!newFilterName.trim()}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradeFiltersComponent