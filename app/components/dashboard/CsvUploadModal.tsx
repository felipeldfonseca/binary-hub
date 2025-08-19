'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useToastHelpers } from '@/components/ui/Toast'
import { useLanguage } from '@/lib/contexts/LanguageContext'

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
  const { user } = useAuth()
  const { handleApiError } = useErrorHandler()
  const { showSuccess, showError } = useToastHelpers()
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

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
  }, [isPortuguese])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      setError(isPortuguese ? 'Por favor, selecione um arquivo CSV válido' : 'Please select a valid CSV file')
      return
    }

    await uploadFile(file)
  }, [isPortuguese])

  const uploadFile = useCallback(async (file: File) => {
    if (!user) {
      setError(isPortuguese ? 'Por favor, faça login para enviar arquivos' : 'Please log in to upload files')
      return
    }

    setUploading(true)
    setError(null)
    setUploadStatus(null)

    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        throw new Error(isPortuguese ? 'Autenticação necessária' : 'Authentication required')
      }

      const formData = new FormData()
      formData.append('csv', file)

      const response = await fetch('/api/v1/import/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorResult = await handleApiError(response, 'CSV Upload')
        setError(errorResult.message)
        return
      }

      const result = await response.json()
      setUploadStatus(result)
      
      // Store the imported trades data
      if (result.status === 'completed' && result.trades) {
        // Mark that user has imported data
        localStorage.setItem('binaryHub_hasData', 'true')
        
        // Store the actual trades data (in a real app, this would be in Firestore)
        localStorage.setItem('binaryHub_trades', JSON.stringify(result.trades))
        
        // Store statistics
        localStorage.setItem('binaryHub_stats', JSON.stringify(result.statistics))
      }
      
      showSuccess(
        isPortuguese ? 'Upload concluído' : 'Upload completed', 
        isPortuguese ? `${result.importedRows} operações foram importadas com sucesso` : `${result.importedRows} trades imported successfully`
      )

      // Poll for status updates
      if (result.status === 'processing') {
        pollUploadStatus(result.uploadId)
      } else if (result.status === 'completed') {
        // Call success callback after a short delay
        setTimeout(() => {
          onSuccess?.()
        }, 1500)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : (isPortuguese ? 'Falha no upload' : 'Upload failed')
      setError(errorMessage)
      showError(isPortuguese ? 'Erro no upload' : 'Upload error', errorMessage)
    } finally {
      setUploading(false)
    }
  }, [user, isPortuguese, handleApiError, showSuccess, showError, onSuccess])

  const pollUploadStatus = useCallback(async (uploadId: string) => {
    try {
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) return

      const response = await fetch(`/api/v1/import/status/${uploadId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const status = await response.json()
        setUploadStatus(status)

        if (status.status === 'processing') {
          // Continue polling
          setTimeout(() => pollUploadStatus(uploadId), 2000)
        } else if (status.status === 'completed') {
          // Call success callback after upload completes
          setTimeout(() => {
            onSuccess?.()
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Error polling upload status:', error)
    }
  }, [onSuccess])

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
          <p className="text-gray-400 text-center mb-6">
            {isPortuguese 
              ? 'Faça upload do seu arquivo CSV do Ebinex para importar seu histórico de trading. Detectaremos e pularemos automaticamente trades duplicados.' 
              : 'Upload your Ebinex CSV file to import your trading history. We will automatically detect and skip duplicate trades.'
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
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50">
            <h3 className="font-comfortaa font-medium mb-3 text-white">
              {isPortuguese ? 'Como exportar do Ebinex:' : 'How to export from Ebinex:'}
            </h3>
            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
              <li>{isPortuguese ? 'Entre na sua conta Ebinex' : 'Log into your Ebinex account'}</li>
              <li>{isPortuguese ? 'Vá para seu histórico de trading' : 'Go to your trading history'}</li>
              <li>{isPortuguese ? 'Selecione o período que deseja exportar' : 'Select the date range you want to export'}</li>
              <li>{isPortuguese ? 'Clique no botão "Exportar CSV"' : 'Click the "Export CSV" button'}</li>
              <li>{isPortuguese ? 'Faça upload do arquivo baixado aqui' : 'Upload the downloaded file here'}</li>
            </ol>
            <p className="text-xs text-gray-400 mt-3">
              {isPortuguese 
                ? 'Nota: O Ebinex permite exportar até 50 trades por vez. Você pode enviar múltiplos arquivos para importar seu histórico completo de trading.'
                : 'Note: Ebinex allows exporting up to 50 trades at a time. You can upload multiple files to import your complete trading history.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}