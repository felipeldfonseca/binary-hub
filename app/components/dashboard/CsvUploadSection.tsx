'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useToastHelpers } from '@/components/ui/Toast'
import { ChartErrorBoundary } from '@/components/error/ErrorBoundary'
import { useMarketContext } from '@/lib/contexts/MarketContext'
import { parseEbinexCsv } from '@/lib/utils/ebinexParser'
import { parseTopOneCsv } from '@/lib/utils/topOneParser'
import { detectBrokerFormat } from '@/lib/utils/csvBrokerDetect'
import { importTrades } from '@/lib/utils/importTrades'

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

export default function CsvUploadSection() {
  const { user, session } = useAuth()
  const { handleApiError } = useErrorHandler()
  const { showSuccess, showError } = useToastHelpers()
  const { marketAccounts, activeMarket } = useMarketContext()
  const queryClient = useQueryClient()
  const [selectedMarketType, setSelectedMarketType] = useState<string>('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Default to the account the Trades page is showing
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
      setError('Please log in to upload files')
      return
    }

    setUploading(true)
    setError(null)
    setUploadStatus(null)

    try {
      const text = await file.text()

      const format = detectBrokerFormat(text)
      if (!format) {
        setError('Unrecognized CSV format. We support Ebinex and Top One Futures.')
        setUploading(false)
        return
      }

      const { trades: parsed, parseErrors } =
        format === 'topone' ? parseTopOneCsv(text) : parseEbinexCsv(text)

      if (parsed.length === 0) {
        setError(parseErrors[0]?.error ?? 'No trades found in CSV')
        setUploading(false)
        return
      }

      // The unique constraint on (user_id, notes) handles dedup
      const importedRows = await importTrades({
        trades: parsed,
        userId: user.id,
        marketType: effectiveMarketType,
        accessToken: session?.access_token,
      })
      const duplicateRows = parsed.length - importedRows

      setUploadStatus({
        uploadId: `import-${Date.now()}`,
        status: 'completed',
        progress: 100,
        totalRows: parsed.length,
        importedRows,
        duplicateRows,
        errors: parseErrors,
        processingTime: 0,
      })

      showSuccess('Upload concluído', `${importedRows} operações importadas (${duplicateRows} duplicatas ignoradas)`)

      // The trades table and stats on this page read from these caches
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['trade-stats'] })
      queryClient.invalidateQueries({ queryKey: ['trading-sessions'] })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      showError('Erro no upload', errorMessage)
    } finally {
      setUploading(false)
    }
  }, [user, session, effectiveMarketType, queryClient, showSuccess, showError])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'))

    if (!csvFile) {
      setError('Please select a valid CSV file')
      return
    }

    await uploadFile(csvFile)
  }, [uploadFile])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    // Reset input so the same file can be re-selected after an error or retry
    e.target.value = ''
    if (!file) return

    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      setError('Please select a valid CSV file')
      return
    }

    await uploadFile(file)
  }, [uploadFile])

  const resetUpload = useCallback(() => {
    setUploadStatus(null)
    setError(null)
  }, [])

  return (
    <ChartErrorBoundary>
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-center mb-8">
            Import Your Trades
          </h2>
          
          <p className="text-gray-300 text-center mb-8">
            Upload your Ebinex CSV file to import your trading history. 
            We'll automatically detect and skip any duplicate trades.
          </p>

          {/* Account selector */}
          {marketAccounts.length > 0 && (
            <div className="mb-5">
              <label htmlFor="csv-upload-account" className="block text-sm font-medium text-gray-300 mb-1.5 font-comfortaa">
                Import to account:
              </label>
              <select
                id="csv-upload-account"
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

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-primary bg-primary/10'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-lg font-comfortaa font-medium">Uploading...</p>
                <p className="text-sm text-gray-500">Please wait while we process your file</p>
              </div>
            ) : uploadStatus ? (
              <div className="space-y-4">
                {uploadStatus.status === 'completed' ? (
                  <div className="text-green-600">
                    <div className="text-4xl mb-2">✓</div>
                    <h3 className="text-lg font-comfortaa font-medium mb-2">Upload Complete!</h3>
                    <div className="text-sm space-y-1">
                      <p>Total rows: {uploadStatus.totalRows}</p>
                      <p>Imported: {uploadStatus.importedRows}</p>
                      <p>Duplicates skipped: {uploadStatus.duplicateRows}</p>
                      {uploadStatus.errors.length > 0 && (
                        <p className="text-red-500">Errors: {uploadStatus.errors.length}</p>
                      )}
                    </div>
                    <button
                      onClick={resetUpload}
                      className="mt-4 px-4 py-2 bg-primary text-text rounded-md hover:bg-primary/90"
                    >
                      Upload Another File
                    </button>
                  </div>
                ) : uploadStatus.status === 'failed' ? (
                  <div className="text-red-600">
                    <div className="text-4xl mb-2">✗</div>
                    <h3 className="text-lg font-comfortaa font-medium mb-2">Upload Failed</h3>
                    <p className="text-sm">{uploadStatus.errors[0]?.error || 'Unknown error'}</p>
                    <button
                      onClick={resetUpload}
                      className="mt-4 px-4 py-2 bg-primary text-text rounded-md hover:bg-primary/90"
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="text-lg font-comfortaa font-medium">Processing...</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadStatus.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-500">
                      Progress: {uploadStatus.progress}%
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-4xl mb-4">📄</div>
                <h3 className="text-lg font-comfortaa font-medium">Drop your CSV file here</h3>
                <p className="text-sm text-gray-500">
                  or click to browse
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="inline-block px-6 py-3 bg-gradient-to-r from-[#E1FFD9] to-[#C4F5A8] text-gray-900 font-semibold rounded-md hover:bg-gradient-to-r hover:from-[#C4F5A8] hover:to-[#E1FFD9] cursor-pointer transition-colors"
                >
                  Choose File
                </label>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-red-500 hover:text-red-700 text-sm"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-8 p-6 bg-gray-50 rounded-lg">
            <h3 className="font-comfortaa font-medium mb-4">How to export from Ebinex:</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              <li>Log into your Ebinex account</li>
              <li>Go to your trading history</li>
              <li>Select the date range you want to export</li>
              <li>Click the "Export CSV" button</li>
              <li>Upload the downloaded file here</li>
            </ol>
            <p className="text-xs text-gray-500 mt-4">
              Note: Ebinex allows exporting up to 50 trades at a time. 
              You can upload multiple files to import your complete trading history.
            </p>
          </div>
          </div>
        </div>
      </section>
    </ChartErrorBoundary>
  )
} 