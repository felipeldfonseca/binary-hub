'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useToastHelpers } from '@/components/ui/Toast'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { supabase } from '@/lib/supabase'
import { parseEbinexCsv } from '@/lib/utils/ebinexParser'
import { parseTopOneCsv } from '@/lib/utils/topOneParser'
import { detectBrokerFormat } from '@/lib/utils/csvBrokerDetect'

interface UploadStatus {
  uploadId: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  totalRows: number
  importedRows: number
  duplicateRows: number
  errors: Array<{ row: number; error: string }>
  processingTime: number
}

interface CsvUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function CsvUploadModal({ isOpen, onClose, onSuccess }: CsvUploadModalProps) {
  const { isPortuguese } = useLanguage()
  const { user, session } = useAuth()
  const { handleApiError } = useErrorHandler()
  const { showSuccess, showError } = useToastHelpers()
  const { marketAccounts, activeMarket } = useMarketContext()
  const [selectedMarketType, setSelectedMarketType] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Default to active market when modal opens
  const effectiveMarketType = selectedMarketType || activeMarket?.marketType || ''

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      setError(isPortuguese ? 'Por favor, faça login para enviar arquivos' : 'Please log in to upload files')
      return
    }

    setUploading(true)
    setError(null)
    setUploadStatus(null)

    try {
      const text = await file.text()

      const format = detectBrokerFormat(text)
      if (!format) {
        const msg = isPortuguese
          ? 'Formato CSV não reconhecido. Suportamos Ebinex e Top One Futures.'
          : 'Unrecognized CSV format. We support Ebinex and Top One Futures.'
        setError(msg)
        setUploading(false)
        return
      }

      const { trades: parsed, parseErrors } =
        format === 'topone' ? parseTopOneCsv(text) : parseEbinexCsv(text)

      if (parsed.length === 0) {
        const msg = parseErrors[0]?.error ?? (isPortuguese ? 'Nenhuma operação encontrada no CSV' : 'No trades found in CSV')
        setError(msg)
        setUploading(false)
        return
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
      // Use JWT from auth context — avoids calling getSession() which can deadlock
      const accessToken = session?.access_token ?? supabaseKey

      const timeoutMsg = isPortuguese
        ? 'Conexão com o servidor expirou. Verifique sua conexão e tente novamente.'
        : 'Server connection timed out. Check your connection and try again.'

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 20000)

      let insertedRows: Array<{ id: string }> = []
      try {
        const response = await fetch(
          `${supabaseUrl}/rest/v1/trades?on_conflict=user_id%2Cnotes&select=id`,
          {
            method: 'POST',
            signal: controller.signal,
            headers: {
              apikey: supabaseKey,
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=ignore-duplicates,return=representation',
            },
            body: JSON.stringify(parsed.map(t => ({ ...t, user_id: user.id, market_type: effectiveMarketType || null }))),
          }
        )
        clearTimeout(timeoutId)

        if (!response.ok) {
          const errBody = await response.text()
          throw new Error(`HTTP ${response.status}: ${errBody.slice(0, 200)}`)
        }

        insertedRows = await response.json() as Array<{ id: string }>
      } catch (e: unknown) {
        clearTimeout(timeoutId)
        if (e instanceof Error && e.name === 'AbortError') throw new Error(timeoutMsg)
        throw e
      }

      const importedRows = insertedRows.length
      const duplicateRows = parsed.length - importedRows

      const uploadId = `import-${Date.now()}`
      setUploadStatus({
        uploadId,
        status: 'completed',
        progress: 100,
        totalRows: parsed.length,
        importedRows,
        duplicateRows,
        errors: parseErrors,
        processingTime: 0,
      })

      showSuccess(
        isPortuguese ? 'Upload concluído' : 'Upload completed',
        isPortuguese
          ? `${importedRows} operações importadas (${duplicateRows} duplicatas ignoradas)`
          : `${importedRows} trades imported (${duplicateRows} duplicates skipped)`
      )

      setTimeout(() => { onSuccess?.() }, 1500)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : (isPortuguese ? 'Falha no upload' : 'Upload failed')
      setError(errorMessage)
      showError(isPortuguese ? 'Erro no upload' : 'Upload error', errorMessage)
    } finally {
      setUploading(false)
    }
  }, [user, session, effectiveMarketType, isPortuguese, showSuccess, showError, onSuccess])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'))
    if (!csvFile) {
      setError(isPortuguese ? 'Por favor, selecione um arquivo CSV válido' : 'Please select a valid CSV file')
      return
    }
    await uploadFile(csvFile)
  }, [isPortuguese, uploadFile])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset so the same file can be re-selected after an error or retry
    e.target.value = ''
    if (!file) return
    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      setError(isPortuguese ? 'Por favor, selecione um arquivo CSV válido' : 'Please select a valid CSV file')
      return
    }
    await uploadFile(file)
  }, [isPortuguese, uploadFile])

  const resetUpload = useCallback(() => {
    setUploadStatus(null)
    setError(null)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white font-comfortaa">
            {isPortuguese ? 'Importar Dados CSV' : 'Import CSV Data'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Account selector */}
          {marketAccounts.length > 0 && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-300 mb-1.5 font-comfortaa">
                {isPortuguese ? 'Importar para a conta:' : 'Import to account:'}
              </label>
              <select
                value={effectiveMarketType}
                onChange={e => setSelectedMarketType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E1FFD9]/40 font-comfortaa"
              >
                {marketAccounts.map(acc => (
                  <option key={acc.id} value={acc.marketType}>
                    {acc.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="text-gray-400 text-center mb-6">
            {isPortuguese
              ? 'Faça upload do seu arquivo CSV para importar seu histórico de trading. Detectaremos e pularemos automaticamente trades duplicados.'
              : 'Upload your CSV file to import your trading history. We will automatically detect and skip duplicate trades.'
            }
          </p>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-6 ${
              isDragOver
                ? 'border-[#E1FFD9] bg-[#E1FFD9]/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#E1FFD9] mx-auto"></div>
                <p className="text-lg font-comfortaa font-medium text-white">
                  {isPortuguese ? 'Enviando...' : 'Uploading...'}
                </p>
                <p className="text-sm text-gray-400">
                  {isPortuguese ? 'Aguarde enquanto processamos seu arquivo' : 'Please wait while we process your file'}
                </p>
              </div>
            ) : uploadStatus ? (
              <div className="space-y-4">
                {uploadStatus.status === 'completed' ? (
                  <div className="text-green-400">
                    <div className="text-4xl mb-2">✓</div>
                    <h3 className="text-lg font-comfortaa font-medium mb-2">
                      {isPortuguese ? 'Import Concluído!' : 'Import Complete!'}
                    </h3>
                    <div className="text-sm space-y-1 mb-4">
                      <p>{isPortuguese ? 'Total de operações:' : 'Total trades:'} {uploadStatus.totalRows}</p>
                      <p>{isPortuguese ? 'Importadas:' : 'Imported:'} {uploadStatus.importedRows}</p>
                      <p>{isPortuguese ? 'Duplicadas ignoradas:' : 'Duplicates skipped:'} {uploadStatus.duplicateRows}</p>
                      {uploadStatus.errors.length > 0 && (
                        <p className="text-red-400">{isPortuguese ? 'Erros:' : 'Errors:'} {uploadStatus.errors.length}</p>
                      )}
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => {
                          onSuccess?.()
                          onClose()
                        }}
                        className="px-6 py-2 bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-gray-900 font-semibold rounded-md hover:bg-gradient-to-r hover:from-[#C4F5A8] hover:to-[#E1FFD9] transition-colors font-comfortaa"
                      >
                        {isPortuguese ? 'Ver Dados Importados' : 'View Imported Data'}
                      </button>
                      <button
                        onClick={resetUpload}
                        className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors font-comfortaa"
                      >
                        {isPortuguese ? 'Importar Mais' : 'Import More'}
                      </button>
                    </div>
                  </div>
                ) : uploadStatus.status === 'failed' ? (
                  <div className="text-red-400">
                    <div className="text-4xl mb-2">✗</div>
                    <h3 className="text-lg font-comfortaa font-medium mb-2">
                      {isPortuguese ? 'Falha no Upload' : 'Upload Failed'}
                    </h3>
                    <p className="text-sm">{uploadStatus.errors[0]?.error || (isPortuguese ? 'Erro desconhecido' : 'Unknown error')}</p>
                    <button
                      onClick={resetUpload}
                      className="mt-4 px-4 py-2 bg-[#E1FFD9] text-gray-900 rounded-md hover:bg-[#C4F5A8] transition-colors font-comfortaa"
                    >
                      {isPortuguese ? 'Tentar Novamente' : 'Try Again'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E1FFD9] mx-auto"></div>
                    <p className="text-lg font-comfortaa font-medium text-white">
                      {isPortuguese ? 'Processando...' : 'Processing...'}
                    </p>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadStatus.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400">
                      {isPortuguese ? 'Progresso:' : 'Progress:'} {uploadStatus.progress}%
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-4xl mb-4">📄</div>
                <h3 className="text-lg font-comfortaa font-medium text-white">
                  {isPortuguese ? 'Arraste seu arquivo CSV aqui' : 'Drop your CSV file here'}
                </h3>
                <p className="text-sm text-gray-400">
                  {isPortuguese ? 'ou clique para navegar' : 'or click to browse'}
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload-modal"
                />
                <label
                  htmlFor="csv-upload-modal"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-gray-900 rounded-md hover:bg-gradient-to-r hover:from-[#C4F5A8] hover:to-[#E1FFD9] cursor-pointer transition-colors font-comfortaa font-medium"
                >
                  {isPortuguese ? 'Escolher Arquivo' : 'Choose File'}
                </label>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-500/50 rounded-md">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-red-300 hover:text-red-100 text-sm"
              >
                {isPortuguese ? 'Dispensar' : 'Dismiss'}
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 space-y-4">
            <p className="text-xs text-[#E1FFD9]/70 font-comfortaa font-medium uppercase tracking-wide">
              {isPortuguese ? 'Formatos suportados' : 'Supported formats'}
            </p>

            {/* Ebinex */}
            <div>
              <p className="text-sm font-comfortaa font-medium text-white mb-1">Ebinex</p>
              <ol className="text-sm text-gray-400 space-y-0.5 list-decimal list-inside">
                <li>{isPortuguese ? 'Vá para Histórico de Operações' : 'Go to Trade History'}</li>
                <li>{isPortuguese ? 'Selecione o período e clique em "Exportar CSV"' : 'Select date range and click "Export CSV"'}</li>
                <li>{isPortuguese ? 'Faça upload aqui' : 'Upload here'}</li>
              </ol>
              <p className="text-xs text-gray-600 mt-1">
                {isPortuguese ? 'Máx. 50 trades por arquivo.' : 'Max 50 trades per file.'}
              </p>
            </div>

            {/* Top One Futures */}
            <div>
              <p className="text-sm font-comfortaa font-medium text-white mb-1">Top One Futures</p>
              <ol className="text-sm text-gray-400 space-y-0.5 list-decimal list-inside">
                <li>{isPortuguese ? 'Acesse o portal da Top One' : 'Log into the Top One portal'}</li>
                <li>{isPortuguese ? 'Vá para Histórico de Trades' : 'Go to Trade History'}</li>
                <li>{isPortuguese ? 'Clique em "Export" → CSV' : 'Click "Export" → CSV'}</li>
                <li>{isPortuguese ? 'Faça upload aqui' : 'Upload here'}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}