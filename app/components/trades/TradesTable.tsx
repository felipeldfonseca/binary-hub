'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'

interface TradesTableProps {
  trades: Trade[]
  loading: boolean
  onTradeSelect: (trade: Trade) => void
  onBulkSelect: (selectedIds: string[]) => void
  selectedIds: string[]
  onSort: (field: keyof Trade, direction: 'asc' | 'desc') => void
  sortField?: keyof Trade
  sortDirection?: 'asc' | 'desc'
  pagination?: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  } | null
  onPageChange: (offset: number) => void
}

type SortableField = 'entryTime' | 'exitTime' | 'asset' | 'amount' | 'result' | 'profit'

const TradesTable: React.FC<TradesTableProps> = ({
  trades,
  loading,
  onTradeSelect,
  onBulkSelect,
  selectedIds,
  onSort,
  sortField,
  sortDirection,
  pagination,
  onPageChange,
}) => {
  const { isPortuguese } = useLanguage()
  const [selectAll, setSelectAll] = useState(false)

  const translations = {
    en: {
      selectAll: 'Select All',
      entryTime: 'Entry Time',
      exitTime: 'Exit Time',
      asset: 'Asset',
      direction: 'Direction',
      amount: 'Amount',
      entryPrice: 'Entry Price',
      exitPrice: 'Exit Price',
      result: 'Result',
      profit: 'Profit',
      actions: 'Actions',
      call: 'CALL',
      put: 'PUT',
      win: 'WIN',
      loss: 'LOSS',
      tie: 'TIE',
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      noTrades: 'No trades found',
      loadingTrades: 'Loading trades...',
      showingResults: 'Showing {{start}} to {{end}} of {{total}} trades',
      previous: 'Previous',
      next: 'Next',
    },
    pt: {
      selectAll: 'Selecionar Todos',
      entryTime: 'Hora de Entrada',
      exitTime: 'Hora de Saída',
      asset: 'Ativo',
      direction: 'Direção',
      amount: 'Valor',
      entryPrice: 'Preço de Entrada',
      exitPrice: 'Preço de Saída',
      result: 'Resultado',
      profit: 'Lucro',
      actions: 'Ações',
      call: 'CALL',
      put: 'PUT',
      win: 'GANHO',
      loss: 'PERDA',
      tie: 'EMPATE',
      view: 'Ver',
      edit: 'Editar',
      delete: 'Deletar',
      noTrades: 'Nenhuma operação encontrada',
      loadingTrades: 'Carregando operações...',
      showingResults: 'Mostrando {{start}} até {{end}} de {{total}} operações',
      previous: 'Anterior',
      next: 'Próxima',
    }
  }

  const t = translations[isPortuguese ? 'pt' : 'en']

  const handleSelectAll = useCallback(() => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)
    if (newSelectAll) {
      onBulkSelect(trades.map(trade => trade.id))
    } else {
      onBulkSelect([])
    }
  }, [selectAll, trades, onBulkSelect])

  const handleRowSelect = useCallback((tradeId: string, checked: boolean) => {
    if (checked) {
      onBulkSelect([...selectedIds, tradeId])
    } else {
      onBulkSelect(selectedIds.filter(id => id !== tradeId))
      setSelectAll(false)
    }
  }, [selectedIds, onBulkSelect])

  const handleSort = useCallback((field: SortableField) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc'
    onSort(field, newDirection)
  }, [sortField, sortDirection, onSort])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(isPortuguese ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat(isPortuguese ? 'pt-BR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  const SortIcon: React.FC<{ field: SortableField }> = ({ field }) => {
    if (sortField !== field) {
      return <span className="text-gray-400">↕</span>
    }
    return (
      <span className="text-primary">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const ResultBadge: React.FC<{ result: string }> = ({ result }) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-semibold"
    
    switch (result.toLowerCase()) {
      case 'win':
        return <span className={`${baseClasses} badge-win`}>{t.win}</span>
      case 'loss':
        return <span className={`${baseClasses} badge-loss`}>{t.loss}</span>
      default:
        return <span className={`${baseClasses} bg-gray-500 text-white`}>{t.tie}</span>
    }
  }

  const DirectionBadge: React.FC<{ direction: string }> = ({ direction }) => {
    const isCall = direction.toLowerCase() === 'call'
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${
        isCall ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isCall ? t.call : t.put}
      </span>
    )
  }

  // Pagination calculations
  const currentPage = pagination ? Math.floor(pagination.offset / pagination.limit) + 1 : 1
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.limit) : 1
  const startIndex = pagination ? pagination.offset + 1 : 1
  const endIndex = pagination ? Math.min(pagination.offset + pagination.limit, pagination.total) : trades.length
  const totalTrades = pagination ? pagination.total : trades.length

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="spinner"></div>
        <span className="ml-3 font-comfortaa">{t.loadingTrades}</span>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-xl font-comfortaa font-semibold mb-2">{t.noTrades}</h3>
        <p className="text-gray-400">Start by adding your first trade or importing a CSV file.</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Table */}
      <div className="overflow-x-auto rounded-lg">
        <table className="table w-full">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-primary bg-transparent border-gray-300 rounded focus:ring-primary focus:ring-2"
                />
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('entryTime')}
              >
                <div className="flex items-center gap-2">
                  {t.entryTime}
                  <SortIcon field="entryTime" />
                </div>
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('asset')}
              >
                <div className="flex items-center gap-2">
                  {t.asset}
                  <SortIcon field="asset" />
                </div>
              </th>
              <th className="px-4 py-3">{t.direction}</th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center gap-2">
                  {t.amount}
                  <SortIcon field="amount" />
                </div>
              </th>
              <th className="px-4 py-3">{t.entryPrice}</th>
              <th className="px-4 py-3">{t.exitPrice}</th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('result')}
              >
                <div className="flex items-center gap-2">
                  {t.result}
                  <SortIcon field="result" />
                </div>
              </th>
              <th 
                className="px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => handleSort('profit')}
              >
                <div className="flex items-center gap-2">
                  {t.profit}
                  <SortIcon field="profit" />
                </div>
              </th>
              <th className="px-4 py-3">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr key={trade.id} className="border-b border-gray-700 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(trade.id)}
                    onChange={(e) => handleRowSelect(trade.id, e.target.checked)}
                    className="w-4 h-4 text-primary bg-transparent border-gray-300 rounded focus:ring-primary focus:ring-2"
                  />
                </td>
                <td className="px-4 py-3 text-sm">
                  {formatDateTime(trade.entryTime)}
                </td>
                <td className="px-4 py-3 font-medium">
                  {trade.asset}
                </td>
                <td className="px-4 py-3">
                  <DirectionBadge direction={trade.direction} />
                </td>
                <td className="px-4 py-3 font-medium">
                  {formatCurrency(trade.amount)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {trade.entryPrice.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-sm">
                  {trade.exitPrice.toFixed(4)}
                </td>
                <td className="px-4 py-3">
                  <ResultBadge result={trade.result} />
                </td>
                <td className={`px-4 py-3 font-semibold ${
                  trade.profit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrency(trade.profit)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => onTradeSelect(trade)}
                    className="text-primary hover:text-primary/80 text-sm font-medium mr-3"
                  >
                    {t.view}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white/5 rounded-lg">
          <div className="text-sm text-gray-400">
            {t.showingResults
              .replace('{{start}}', startIndex.toString())
              .replace('{{end}}', endIndex.toString())
              .replace('{{total}}', totalTrades.toString())}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(Math.max(0, pagination.offset - pagination.limit))}
              disabled={pagination.offset === 0}
              className="px-3 py-1 text-sm border border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
            >
              {t.previous}
            </button>
            
            <span className="px-3 py-1 text-sm">
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={() => onPageChange(pagination.offset + pagination.limit)}
              disabled={!pagination.hasMore}
              className="px-3 py-1 text-sm border border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5"
            >
              {t.next}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradesTable