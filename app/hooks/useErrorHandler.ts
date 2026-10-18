import { useCallback } from 'react'
import { useToastHelpers } from '@/components/ui/Toast'
import { logger } from '@/lib/utils/logger'

export interface ApiError {
  error: string
  code: string
  details?: any
  timestamp: string
}

export interface ErrorHandlerOptions {
  showToast?: boolean
  logError?: boolean
  context?: string
  fallbackMessage?: string
  language?: 'en' | 'pt'
}

// Portuguese error messages for better UX
const ErrorMessagesPortuguese: Record<string, string> = {
  // Authentication errors
  AUTH_REQUIRED: 'Faça login para continuar',
  INVALID_TOKEN: 'Sessão expirada. Faça login novamente',
  INSUFFICIENT_PERMISSIONS: 'Você não tem permissão para esta ação',
  TOKEN_EXPIRED: 'Sessão expirada. Faça login novamente',

  // Validation errors
  VALIDATION_ERROR: 'Dados inválidos fornecidos',
  MISSING_REQUIRED_FIELD: 'Campos obrigatórios não preenchidos',
  INVALID_INPUT: 'Dados inválidos',
  INVALID_FILE_TYPE: 'Tipo de arquivo inválido',
  FILE_TOO_LARGE: 'Arquivo muito grande',

  // Resource errors
  RESOURCE_NOT_FOUND: 'Recurso não encontrado',
  TRADE_NOT_FOUND: 'Operação não encontrada',
  IMPORT_NOT_FOUND: 'Importação não encontrada',
  USER_NOT_FOUND: 'Usuário não encontrado',

  // Business logic errors
  DUPLICATE_RESOURCE: 'Recurso já existe',
  OPERATION_NOT_ALLOWED: 'Operação não permitida',
  RATE_LIMIT_EXCEEDED: 'Muitas solicitações. Tente novamente em alguns minutos',
  QUOTA_EXCEEDED: 'Limite excedido',

  // CSV/Import errors
  CSV_PARSE_ERROR: 'Erro ao processar arquivo CSV',
  CSV_VALIDATION_ERROR: 'Arquivo CSV inválido',
  IMPORT_FAILED: 'Falha na importação',
  BULK_OPERATION_FAILED: 'Operação em lote falhou',

  // External service errors
  OPENAI_ERROR: 'Erro no serviço de IA',
  FIREBASE_ERROR: 'Erro no servidor',
  STORAGE_ERROR: 'Erro no armazenamento',

  // General errors
  INTERNAL_ERROR: 'Erro interno do servidor',
  SERVICE_UNAVAILABLE: 'Serviço temporariamente indisponível',
  TIMEOUT_ERROR: 'Tempo limite esgotado',
  NETWORK_ERROR: 'Erro de conexão'
}

export function useErrorHandler() {
  const { showError, showWarning } = useToastHelpers()

  const handleError = useCallback((
    error: Error | ApiError | any,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      logError = true,
      context,
      fallbackMessage = 'Ocorreu um erro inesperado',
      language = 'pt'
    } = options

    let errorMessage: string
    let errorCode: string | undefined
    let errorDetails: any

    // Parse different error formats
    if (error && typeof error === 'object' && 'error' in error && 'code' in error) {
      // API Error format
      const apiError = error as ApiError
      errorCode = apiError.code
      errorDetails = apiError.details
      
      // Use localized message if available
      if (language === 'pt' && ErrorMessagesPortuguese[apiError.code]) {
        errorMessage = ErrorMessagesPortuguese[apiError.code]
      } else {
        errorMessage = apiError.error
      }
    } else if (error instanceof Error) {
      // Standard Error object
      errorMessage = error.message
      errorCode = 'JAVASCRIPT_ERROR'
    } else if (typeof error === 'string') {
      // String error
      errorMessage = error
      errorCode = 'STRING_ERROR'
    } else {
      // Unknown error format
      errorMessage = fallbackMessage
      errorCode = 'UNKNOWN_ERROR'
      errorDetails = error
    }

    // Log error for debugging
    if (logError) {
      logger.error(`Error${context ? ` in ${context}` : ''}:`, {
        message: errorMessage,
        code: errorCode,
        details: errorDetails,
        originalError: error
      })
    }

    // Show toast notification
    if (showToast) {
      // Show warning for user-actionable errors
      if (errorCode && ['AUTH_REQUIRED', 'VALIDATION_ERROR', 'MISSING_REQUIRED_FIELD'].includes(errorCode)) {
        showWarning('Atenção', errorMessage)
      } else {
        showError('Erro', errorMessage)
      }
    }

    return {
      message: errorMessage,
      code: errorCode,
      details: errorDetails
    }
  }, [showError, showWarning])

  const handleApiError = useCallback(async (response: Response, context?: string) => {
    let apiError: ApiError
    
    try {
      apiError = await response.json()
    } catch {
      // If response is not JSON, create a generic error
      apiError = {
        error: `HTTP ${response.status} - ${response.statusText}`,
        code: 'HTTP_ERROR',
        timestamp: new Date().toISOString()
      }
    }

    return handleError(apiError, { context })
  }, [handleError])

  const wrapAsyncOperation = useCallback(<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    return operation().catch(error => {
      handleError(error, { context })
      return null
    })
  }, [handleError])

  return {
    handleError,
    handleApiError,
    wrapAsyncOperation
  }
}

// Hook for handling form errors specifically
export function useFormErrorHandler() {
  const { handleError } = useErrorHandler()

  const handleFormError = useCallback((error: any, fieldName?: string) => {
    const context = fieldName ? `Form field: ${fieldName}` : 'Form validation'
    
    // Extract field-specific errors if available
    if (error?.details?.errors && Array.isArray(error.details.errors)) {
      const fieldErrors = error.details.errors
      const errorMessage = fieldErrors.join(', ')
      
      handleError({
        ...error,
        error: errorMessage
      }, { 
        context,
        showToast: true,
        logError: false // Form errors don't need detailed logging
      })
    } else {
      handleError(error, { context })
    }
  }, [handleError])

  return { handleFormError }
}

// Hook for handling async operations with loading states
export function useAsyncOperation() {
  const { handleError } = useErrorHandler()

  const executeAsync = useCallback(async <T>(
    operation: () => Promise<T>,
    options: {
      onSuccess?: (result: T) => void
      onError?: (error: any) => void
      context?: string
      showSuccessToast?: boolean
      successMessage?: string
    } = {}
  ): Promise<{ data: T | null; error: any | null }> => {
    try {
      const result = await operation()
      
      if (options.onSuccess) {
        options.onSuccess(result)
      }
      
      if (options.showSuccessToast && options.successMessage) {
        const { showSuccess } = useToastHelpers()
        showSuccess('Sucesso', options.successMessage)
      }
      
      return { data: result, error: null }
    } catch (error) {
      const errorResult = handleError(error, { context: options.context })
      
      if (options.onError) {
        options.onError(errorResult)
      }
      
      return { data: null, error: errorResult }
    }
  }, [handleError])

  return { executeAsync }
}