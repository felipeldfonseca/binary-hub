'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { auth } from '@/lib/firebase'

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
  const { user } = useAuth()
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
      setError('Please select a valid CSV file')
      return
    }

    await uploadFile(csvFile)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
      setError('Please select a valid CSV file')
      return
    }

    await uploadFile(file)
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
      const idToken = await auth.currentUser?.getIdToken()
      if (!idToken) {
        throw new Error('Authentication required')
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
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      setUploadStatus(result)

      // Poll for status updates
      if (result.status === 'processing') {
        pollUploadStatus(result.uploadId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [user])

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
        }
      }
    } catch (error) {
      console.error('Error polling upload status:', error)
    }
  }, [])

  const resetUpload = useCallback(() => {
    setUploadStatus(null)
    setError(null)
  }, [])

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-center mb-8">
            Import Your Trades
          </h2>
          
          <p className="text-gray-600 text-center mb-8">
            Upload your Ebinex CSV file to import your trading history. 
            We'll automatically detect and skip any duplicate trades.
          </p>

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
                  className="inline-block px-6 py-3 bg-primary text-text rounded-md hover:bg-primary/90 cursor-pointer transition-colors"
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
  )
} 