'use client'

import React, { useState, useCallback } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import TradeForm from './TradeForm'

interface TradeModalProps {
  trade: Trade | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (tradeId: string, updates: Partial<Trade>) => Promise<void>
  onDelete: (tradeId: string) => Promise<void>
  loading?: boolean
}

const TradeModal: React.FC<TradeModalProps> = ({
  trade,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  loading = false,
}) => {
  const { isPortuguese } = useLanguage()
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const translations = {
    en: {
      tradeDetails: 'Trade Details',
      editTrade: 'Edit Trade',
      basicInfo: 'Basic Information',
      tradeId: 'Trade ID',
      asset: 'Asset',
      direction: 'Direction',
      amount: 'Amount',
      timeframe: 'Timeframe',
      platform: 'Platform',
      priceInfo: 'Price Information',
      entryPrice: 'Entry Price',
      exitPrice: 'Exit Price',
      entryTime: 'Entry Time',
      exitTime: 'Exit Time',
      resultsInfo: 'Results',
      result: 'Result',
      status: 'Status',
      profit: 'Profit',
      payout: 'Payout',
      additionalInfo: 'Additional Information',
      strategy: 'Strategy',
      notes: 'Notes',
      importInfo: 'Import Information',
      importedAt: 'Imported At',
      importBatch: 'Import Batch',
      createdAt: 'Created At',
      updatedAt: 'Updated At',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      close: 'Close',
      save: 'Save Changes',
      cancel: 'Cancel',
      deleteConfirmTitle: 'Delete Trade',
      deleteConfirmMessage: 'Are you sure you want to delete this trade? This action cannot be undone.',
      confirmDelete: 'Yes, Delete',
      call: 'CALL',
      put: 'PUT',
      win: 'WIN',
      loss: 'LOSS',
      tie: 'TIE',
      noStrategy: 'No strategy specified',
      noNotes: 'No notes added',
      noBatch: 'N/A',
    },
    pt: {
      tradeDetails: 'Detalhes da Operação',
      editTrade: 'Editar Operação',
      basicInfo: 'Informações Básicas',
      tradeId: 'ID da Operação',
      asset: 'Ativo',
      direction: 'Direção',
      amount: 'Valor',
      timeframe: 'Timeframe',
      platform: 'Plataforma',
      priceInfo: 'Informações de Preço',
      entryPrice: 'Preço de Entrada',
      exitPrice: 'Preço de Saída',
      entryTime: 'Hora de Entrada',
      exitTime: 'Hora de Saída',
      resultsInfo: 'Resultados',
      result: 'Resultado',
      status: 'Status',
      profit: 'Lucro',
      payout: 'Pagamento',
      additionalInfo: 'Informações Adicionais',
      strategy: 'Estratégia',
      notes: 'Observações',
      importInfo: 'Informações da Importação',
      importedAt: 'Importado em',
      importBatch: 'Lote de Importação',
      createdAt: 'Criado em',
      updatedAt: 'Atualizado em',
      actions: 'Ações',
      edit: 'Editar',
      delete: 'Excluir',
      close: 'Fechar',
      save: 'Salvar Alterações',
      cancel: 'Cancelar',
      deleteConfirmTitle: 'Excluir Operação',
      deleteConfirmMessage: 'Tem certeza que deseja excluir esta operação? Esta ação não pode ser desfeita.',
      confirmDelete: 'Sim, Excluir',
      call: 'CALL',
      put: 'PUT',
      win: 'GANHO',
      loss: 'PERDA',
      tie: 'EMPATE',
      noStrategy: 'Nenhuma estratégia especificada',
      noNotes: 'Nenhuma observação adicionada',
      noBatch: 'N/A',
    }
  }

  const t = translations[isPortuguese ? 'pt' : 'en']

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(isPortuguese ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount)
  }, [isPortuguese])

  const formatDateTime = useCallback((date: Date) => {
    return new Intl.DateTimeFormat(isPortuguese ? 'pt-BR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(date))
  }, [isPortuguese])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const handleSave = useCallback(async (updates: Partial<Trade>) => {
    if (!trade) return

    try {
      await onUpdate(trade.id, updates)
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating trade:', error)
    }
  }, [trade, onUpdate])

  const handleDelete = useCallback(async () => {
    if (!trade) return

    try {
      await onDelete(trade.id)
      setShowDeleteConfirm(false)
      onClose()
    } catch (error) {
      console.error('Error deleting trade:', error)
    }
  }, [trade, onDelete, onClose])

  const ResultBadge: React.FC<{ result: string }> = ({ result }) => {
    const baseClasses = "px-3 py-1 rounded-full text-sm font-semibold"
    
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
      <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
        isCall ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      }`}>
        {isCall ? t.call : t.put}
      </span>
    )
  }

  if (!isOpen || !trade) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-600 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-600">
          <h2 className="text-2xl font-comfortaa font-semibold">
            {isEditing ? t.editTrade : t.tradeDetails}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none"
            disabled={loading}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isEditing ? (
            <TradeForm
              initialData={trade}
              onSubmit={handleSave}
              onCancel={handleCancelEdit}
              loading={loading}
              isEdit={true}
            />
          ) : (
            <div className="space-y-8">
              {/* Basic Information */}
              <section>
                <h3 className="text-lg font-comfortaa font-semibold mb-4 text-primary">
                  {t.basicInfo}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.tradeId}
                    </label>
                    <p className="text-sm font-mono bg-gray-700 px-3 py-2 rounded">
                      {trade.tradeId || trade.id}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.asset}
                    </label>
                    <p className="text-lg font-semibold">{trade.asset}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.direction}
                    </label>
                    <DirectionBadge direction={trade.direction} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.amount}
                    </label>
                    <p className="text-lg font-semibold">{formatCurrency(trade.amount)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.timeframe}
                    </label>
                    <p className="text-sm">{trade.timeframe}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.platform}
                    </label>
                    <p className="text-sm">{trade.platform}</p>
                  </div>
                </div>
              </section>

              {/* Price Information */}
              <section>
                <h3 className="text-lg font-comfortaa font-semibold mb-4 text-primary">
                  {t.priceInfo}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.entryPrice}
                    </label>
                    <p className="text-lg font-mono">{trade.entryPrice.toFixed(5)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.exitPrice}
                    </label>
                    <p className="text-lg font-mono">{trade.exitPrice.toFixed(5)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.entryTime}
                    </label>
                    <p className="text-sm">{formatDateTime(trade.entryTime)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.exitTime}
                    </label>
                    <p className="text-sm">{formatDateTime(trade.exitTime)}</p>
                  </div>
                </div>
              </section>

              {/* Results */}
              <section>
                <h3 className="text-lg font-comfortaa font-semibold mb-4 text-primary">
                  {t.resultsInfo}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.result}
                    </label>
                    <ResultBadge result={trade.result} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.status}
                    </label>
                    <p className="text-sm">{trade.status}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.profit}
                    </label>
                    <p className={`text-lg font-semibold ${
                      trade.profit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(trade.profit)}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.payout}
                    </label>
                    <p className="text-lg font-semibold">{formatCurrency(trade.payout)}</p>
                  </div>
                </div>
              </section>

              {/* Additional Information */}
              <section>
                <h3 className="text-lg font-comfortaa font-semibold mb-4 text-primary">
                  {t.additionalInfo}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.strategy}
                    </label>
                    <p className="text-sm bg-gray-700 px-3 py-2 rounded">
                      {trade.strategy || t.noStrategy}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      {t.notes}
                    </label>
                    <p className="text-sm bg-gray-700 px-3 py-2 rounded min-h-[2.5rem]">
                      {trade.notes || t.noNotes}
                    </p>
                  </div>
                </div>
              </section>

              {/* Import Information */}
              {(trade.importedAt || trade.importBatch) && (
                <section>
                  <h3 className="text-lg font-comfortaa font-semibold mb-4 text-primary">
                    {t.importInfo}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trade.importedAt && (
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {t.importedAt}
                        </label>
                        <p className="text-sm">{formatDateTime(trade.importedAt)}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">
                        {t.importBatch}
                      </label>
                      <p className="text-sm font-mono">{trade.importBatch || t.noBatch}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Metadata */}
              <section>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <span className="font-medium">{t.createdAt}:</span> {formatDateTime(trade.createdAt)}
                  </div>
                  <div>
                    <span className="font-medium">{t.updatedAt}:</span> {formatDateTime(trade.updatedAt)}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!isEditing && (
          <div className="flex items-center justify-between p-6 border-t border-gray-600">
            <div className="flex space-x-2">
              <button
                onClick={handleEdit}
                disabled={loading}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {t.edit}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {t.delete}
              </button>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-sm border border-gray-600 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {t.close}
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-comfortaa font-semibold mb-4 text-red-400">
              {t.deleteConfirmTitle}
            </h3>
            <p className="text-gray-300 mb-6">
              {t.deleteConfirmMessage}
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-white/10 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>}
                {t.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradeModal