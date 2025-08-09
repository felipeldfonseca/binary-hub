'use client'

import React, { useState, useCallback } from 'react'
import { Trade } from '@/hooks/useTrades'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useToastHelpers } from '@/components/ui/Toast'

interface BulkActionsProps {
  selectedIds: string[]
  selectedTrades: Trade[]
  onBulkDelete: (tradeIds: string[]) => Promise<void>
  onBulkUpdate: (tradeIds: string[], updates: Partial<Trade>) => Promise<void>
  onExport: (tradeIds: string[]) => Promise<void>
  onClearSelection: () => void
  loading?: boolean
}

interface BulkEditData {
  strategy?: string
  notes?: string
  result?: 'win' | 'loss' | 'tie'
}

const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  selectedTrades,
  onBulkDelete,
  onBulkUpdate,
  onExport,
  onClearSelection,
  loading = false,
}) => {
  const { isPortuguese } = useLanguage()
  const { showSuccess, showError } = useToastHelpers()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showBulkEdit, setShowBulkEdit] = useState(false)
  const [bulkEditData, setBulkEditData] = useState<BulkEditData>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const translations = {
    en: {
      bulkActions: 'Bulk Actions',
      selected: '{{count}} selected',
      selectTrades: 'Select trades to perform bulk actions',
      actions: 'Actions',
      edit: 'Bulk Edit',
      delete: 'Delete Selected',
      export: 'Export Selected',
      clearSelection: 'Clear Selection',
      deleteConfirmTitle: 'Delete Selected Trades',
      deleteConfirmMessage: 'Are you sure you want to delete {{count}} selected trades? This action cannot be undone.',
      confirmDelete: 'Yes, Delete All',
      cancel: 'Cancel',
      bulkEditTitle: 'Bulk Edit Selected Trades',
      bulkEditDescription: 'Edit common fields for {{count}} selected trades. Leave fields empty to keep existing values.',
      strategy: 'Strategy',
      strategyPlaceholder: 'Enter new strategy (optional)',
      notes: 'Notes',
      notesPlaceholder: 'Enter new notes (optional)',
      result: 'Result',
      keepExisting: 'Keep Existing',
      win: 'Win',
      loss: 'Loss',
      tie: 'Tie',
      apply: 'Apply Changes',
      applyingChanges: 'Applying changes...',
      deletingTrades: 'Deleting trades...',
      exportingTrades: 'Exporting trades...',
      success: 'Success',
      error: 'Error',
      tradesDeleted: '{{count}} trades deleted successfully',
      tradesUpdated: '{{count}} trades updated successfully',
      tradesExported: '{{count}} trades exported successfully',
      operationFailed: 'Operation failed. Please try again.',
    },
    pt: {
      bulkActions: 'Ações em Lote',
      selected: '{{count}} selecionadas',
      selectTrades: 'Selecione operações para executar ações em lote',
      actions: 'Ações',
      edit: 'Editar em Lote',
      delete: 'Excluir Selecionadas',
      export: 'Exportar Selecionadas',
      clearSelection: 'Limpar Seleção',
      deleteConfirmTitle: 'Excluir Operações Selecionadas',
      deleteConfirmMessage: 'Tem certeza que deseja excluir {{count}} operações selecionadas? Esta ação não pode ser desfeita.',
      confirmDelete: 'Sim, Excluir Todas',
      cancel: 'Cancelar',
      bulkEditTitle: 'Editar Operações Selecionadas em Lote',
      bulkEditDescription: 'Edite campos comuns para {{count}} operações selecionadas. Deixe campos vazios para manter valores existentes.',
      strategy: 'Estratégia',
      strategyPlaceholder: 'Digite nova estratégia (opcional)',
      notes: 'Observações',
      notesPlaceholder: 'Digite novas observações (opcional)',
      result: 'Resultado',
      keepExisting: 'Manter Existente',
      win: 'Ganho',
      loss: 'Perda',
      tie: 'Empate',
      apply: 'Aplicar Alterações',
      applyingChanges: 'Aplicando alterações...',
      deletingTrades: 'Excluindo operações...',
      exportingTrades: 'Exportando operações...',
      success: 'Sucesso',
      error: 'Erro',
      tradesDeleted: '{{count}} operações excluídas com sucesso',
      tradesUpdated: '{{count}} operações atualizadas com sucesso',
      tradesExported: '{{count}} operações exportadas com sucesso',
      operationFailed: 'Operação falhou. Tente novamente.',
    }
  }

  const t = translations[isPortuguese ? 'pt' : 'en']

  const handleBulkDelete = useCallback(async () => {
    setActionLoading('delete')
    try {
      await onBulkDelete(selectedIds)
      showSuccess(t.success, t.tradesDeleted.replace('{{count}}', selectedIds.length.toString()))
      setShowDeleteConfirm(false)
      onClearSelection()
    } catch (error) {
      showError(t.error, t.operationFailed)
    } finally {
      setActionLoading(null)
    }
  }, [selectedIds, onBulkDelete, onClearSelection, showSuccess, showError, t])

  const handleBulkEdit = useCallback(async () => {
    setActionLoading('edit')
    try {
      // Only include non-empty fields in the update
      const updates: Partial<Trade> = {}
      
      if (bulkEditData.strategy !== undefined && bulkEditData.strategy !== '') {
        updates.strategy = bulkEditData.strategy
      }
      
      if (bulkEditData.notes !== undefined && bulkEditData.notes !== '') {
        updates.notes = bulkEditData.notes
      }
      
      if (bulkEditData.result && bulkEditData.result !== '') {
        updates.result = bulkEditData.result
        updates.status = bulkEditData.result === 'win' ? 'WIN' : 'LOSE'
        
        // Recalculate profit based on new result
        selectedTrades.forEach(trade => {
          if (bulkEditData.result === 'win') {
            updates.profit = trade.amount * 0.8 // 80% payout
          } else if (bulkEditData.result === 'loss') {
            updates.profit = -trade.amount
          } else {
            updates.profit = 0
          }
        })
      }

      if (Object.keys(updates).length === 0) {
        showError(t.error, 'No changes to apply')
        return
      }

      await onBulkUpdate(selectedIds, updates)
      showSuccess(t.success, t.tradesUpdated.replace('{{count}}', selectedIds.length.toString()))
      setShowBulkEdit(false)
      setBulkEditData({})
      onClearSelection()
    } catch (error) {
      showError(t.error, t.operationFailed)
    } finally {
      setActionLoading(null)
    }
  }, [selectedIds, bulkEditData, selectedTrades, onBulkUpdate, onClearSelection, showSuccess, showError, t])

  const handleExport = useCallback(async () => {
    setActionLoading('export')
    try {
      await onExport(selectedIds)
      showSuccess(t.success, t.tradesExported.replace('{{count}}', selectedIds.length.toString()))
      onClearSelection()
    } catch (error) {
      showError(t.error, t.operationFailed)
    } finally {
      setActionLoading(null)
    }
  }, [selectedIds, onExport, onClearSelection, showSuccess, showError, t])

  const handleBulkEditInputChange = useCallback((field: keyof BulkEditData, value: string) => {
    setBulkEditData(prev => ({
      ...prev,
      [field]: value === '' ? undefined : value
    }))
  }, [])

  if (selectedIds.length === 0) {
    return (
      <div className="bg-white/5 border border-gray-700 rounded-lg p-4">
        <div className="text-center text-gray-400">
          <div className="text-2xl mb-2">⚡</div>
          <p className="text-sm">{t.selectTrades}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-comfortaa font-semibold">{t.bulkActions}</h3>
            <p className="text-sm text-gray-400">
              {t.selected.replace('{{count}}', selectedIds.length.toString())}
            </p>
          </div>
          <button
            onClick={onClearSelection}
            className="text-gray-400 hover:text-white text-sm"
            disabled={loading || actionLoading !== null}
          >
            {t.clearSelection}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowBulkEdit(true)}
            disabled={loading || actionLoading !== null}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-50 flex items-center space-x-2"
          >
            {actionLoading === 'edit' && (
              <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{actionLoading === 'edit' ? t.applyingChanges : t.edit}</span>
          </button>

          <button
            onClick={handleExport}
            disabled={loading || actionLoading !== null}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {actionLoading === 'export' && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{actionLoading === 'export' ? t.exportingTrades : t.export}</span>
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || actionLoading !== null}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {actionLoading === 'delete' && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{actionLoading === 'delete' ? t.deletingTrades : t.delete}</span>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-comfortaa font-semibold mb-4 text-red-400">
              {t.deleteConfirmTitle}
            </h3>
            <p className="text-gray-300 mb-6">
              {t.deleteConfirmMessage.replace('{{count}}', selectedIds.length.toString())}
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={actionLoading === 'delete'}
                className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={actionLoading === 'delete'}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {actionLoading === 'delete' && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{t.confirmDelete}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-600 rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-gray-600">
              <h3 className="text-lg font-comfortaa font-semibold mb-2">
                {t.bulkEditTitle}
              </h3>
              <p className="text-sm text-gray-400">
                {t.bulkEditDescription.replace('{{count}}', selectedIds.length.toString())}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Strategy */}
              <div>
                <label className="block text-sm font-comfortaa font-medium text-gray-200 mb-2">
                  {t.strategy}
                </label>
                <input
                  type="text"
                  value={bulkEditData.strategy || ''}
                  onChange={(e) => handleBulkEditInputChange('strategy', e.target.value)}
                  placeholder={t.strategyPlaceholder}
                  className="form-input w-full"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-comfortaa font-medium text-gray-200 mb-2">
                  {t.notes}
                </label>
                <textarea
                  value={bulkEditData.notes || ''}
                  onChange={(e) => handleBulkEditInputChange('notes', e.target.value)}
                  placeholder={t.notesPlaceholder}
                  rows={3}
                  className="form-input w-full resize-none"
                />
              </div>

              {/* Result */}
              <div>
                <label className="block text-sm font-comfortaa font-medium text-gray-200 mb-2">
                  {t.result}
                </label>
                <select
                  value={bulkEditData.result || ''}
                  onChange={(e) => handleBulkEditInputChange('result', e.target.value)}
                  className="form-input w-full"
                >
                  <option value="" className="bg-gray-800">{t.keepExisting}</option>
                  <option value="win" className="bg-gray-800">{t.win}</option>
                  <option value="loss" className="bg-gray-800">{t.loss}</option>
                  <option value="tie" className="bg-gray-800">{t.tie}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 p-6 border-t border-gray-600">
              <button
                onClick={() => {
                  setShowBulkEdit(false)
                  setBulkEditData({})
                }}
                disabled={actionLoading === 'edit'}
                className="px-4 py-2 text-sm border border-gray-600 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleBulkEdit}
                disabled={actionLoading === 'edit'}
                className="btn-primary px-6 py-2 text-sm disabled:opacity-50 flex items-center space-x-2"
              >
                {actionLoading === 'edit' && (
                  <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{actionLoading === 'edit' ? t.applyingChanges : t.apply}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BulkActions