import { logger } from 'firebase-functions';
import { Response } from 'express';

// Standard error response interface
export interface ErrorResponse {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}

// Error codes enum
export enum ErrorCodes {
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // Resource errors
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  TRADE_NOT_FOUND = 'TRADE_NOT_FOUND',
  IMPORT_NOT_FOUND = 'IMPORT_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // Business logic errors
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  OPERATION_NOT_ALLOWED = 'OPERATION_NOT_ALLOWED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

  // CSV/Import errors
  CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',
  CSV_VALIDATION_ERROR = 'CSV_VALIDATION_ERROR',
  IMPORT_FAILED = 'IMPORT_FAILED',
  BULK_OPERATION_FAILED = 'BULK_OPERATION_FAILED',

  // External service errors
  OPENAI_ERROR = 'OPENAI_ERROR',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',

  // General errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

// Localized error messages
const ErrorMessages = {
  en: {
    [ErrorCodes.AUTH_REQUIRED]: 'Authentication is required',
    [ErrorCodes.INVALID_TOKEN]: 'Invalid authentication token',
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
    [ErrorCodes.TOKEN_EXPIRED]: 'Authentication token has expired',
    
    [ErrorCodes.VALIDATION_ERROR]: 'Validation failed',
    [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Required field is missing',
    [ErrorCodes.INVALID_INPUT]: 'Invalid input provided',
    [ErrorCodes.INVALID_FILE_TYPE]: 'Invalid file type',
    [ErrorCodes.FILE_TOO_LARGE]: 'File is too large',
    
    [ErrorCodes.RESOURCE_NOT_FOUND]: 'Resource not found',
    [ErrorCodes.TRADE_NOT_FOUND]: 'Trade not found',
    [ErrorCodes.IMPORT_NOT_FOUND]: 'Import record not found',
    [ErrorCodes.USER_NOT_FOUND]: 'User not found',
    
    [ErrorCodes.DUPLICATE_RESOURCE]: 'Resource already exists',
    [ErrorCodes.OPERATION_NOT_ALLOWED]: 'Operation not allowed',
    [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded',
    [ErrorCodes.QUOTA_EXCEEDED]: 'Quota exceeded',
    
    [ErrorCodes.CSV_PARSE_ERROR]: 'Failed to parse CSV file',
    [ErrorCodes.CSV_VALIDATION_ERROR]: 'CSV validation failed',
    [ErrorCodes.IMPORT_FAILED]: 'Import operation failed',
    [ErrorCodes.BULK_OPERATION_FAILED]: 'Bulk operation failed',
    
    [ErrorCodes.OPENAI_ERROR]: 'AI service error',
    [ErrorCodes.FIREBASE_ERROR]: 'Database error',
    [ErrorCodes.STORAGE_ERROR]: 'Storage service error',
    
    [ErrorCodes.INTERNAL_ERROR]: 'Internal server error',
    [ErrorCodes.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
    [ErrorCodes.TIMEOUT_ERROR]: 'Request timed out',
    [ErrorCodes.NETWORK_ERROR]: 'Network error'
  },
  pt: {
    [ErrorCodes.AUTH_REQUIRED]: 'Autenticação é obrigatória',
    [ErrorCodes.INVALID_TOKEN]: 'Token de autenticação inválido',
    [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'Permissões insuficientes',
    [ErrorCodes.TOKEN_EXPIRED]: 'Token de autenticação expirou',
    
    [ErrorCodes.VALIDATION_ERROR]: 'Falha na validação',
    [ErrorCodes.MISSING_REQUIRED_FIELD]: 'Campo obrigatório não informado',
    [ErrorCodes.INVALID_INPUT]: 'Entrada inválida fornecida',
    [ErrorCodes.INVALID_FILE_TYPE]: 'Tipo de arquivo inválido',
    [ErrorCodes.FILE_TOO_LARGE]: 'Arquivo muito grande',
    
    [ErrorCodes.RESOURCE_NOT_FOUND]: 'Recurso não encontrado',
    [ErrorCodes.TRADE_NOT_FOUND]: 'Operação não encontrada',
    [ErrorCodes.IMPORT_NOT_FOUND]: 'Registro de importação não encontrado',
    [ErrorCodes.USER_NOT_FOUND]: 'Usuário não encontrado',
    
    [ErrorCodes.DUPLICATE_RESOURCE]: 'Recurso já existe',
    [ErrorCodes.OPERATION_NOT_ALLOWED]: 'Operação não permitida',
    [ErrorCodes.RATE_LIMIT_EXCEEDED]: 'Limite de taxa excedido',
    [ErrorCodes.QUOTA_EXCEEDED]: 'Cota excedida',
    
    [ErrorCodes.CSV_PARSE_ERROR]: 'Falha ao analisar arquivo CSV',
    [ErrorCodes.CSV_VALIDATION_ERROR]: 'Validação do CSV falhou',
    [ErrorCodes.IMPORT_FAILED]: 'Operação de importação falhou',
    [ErrorCodes.BULK_OPERATION_FAILED]: 'Operação em lote falhou',
    
    [ErrorCodes.OPENAI_ERROR]: 'Erro do serviço de IA',
    [ErrorCodes.FIREBASE_ERROR]: 'Erro do banco de dados',
    [ErrorCodes.STORAGE_ERROR]: 'Erro do serviço de armazenamento',
    
    [ErrorCodes.INTERNAL_ERROR]: 'Erro interno do servidor',
    [ErrorCodes.SERVICE_UNAVAILABLE]: 'Serviço temporariamente indisponível',
    [ErrorCodes.TIMEOUT_ERROR]: 'Tempo limite da solicitação esgotado',
    [ErrorCodes.NETWORK_ERROR]: 'Erro de rede'
  }
};

// Application Error class
export class AppError extends Error {
  public readonly code: ErrorCodes;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCodes,
    message?: string,
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Ensure the stack trace is captured properly
    Error.captureStackTrace(this, AppError);
  }
}

// Create standardized error response
export function createErrorResponse(
  code: ErrorCodes,
  message?: string,
  details?: any,
  language: 'en' | 'pt' = 'en'
): ErrorResponse {
  const defaultMessage = ErrorMessages[language][code] || ErrorMessages.en[code];
  
  return {
    error: message || defaultMessage,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}

// Error handler middleware function
export function handleError(
  error: Error | AppError,
  res: Response,
  context: string,
  language: 'en' | 'pt' = 'en'
): void {
  let statusCode = 500;
  let errorCode = ErrorCodes.INTERNAL_ERROR;
  let errorMessage = 'Internal server error';
  let details: any;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    errorMessage = error.message;
    details = error.details;
  } else {
    // Map common error types
    if (error.message.includes('Authentication')) {
      statusCode = 401;
      errorCode = ErrorCodes.AUTH_REQUIRED;
    } else if (error.message.includes('Permission') || error.message.includes('Forbidden')) {
      statusCode = 403;
      errorCode = ErrorCodes.INSUFFICIENT_PERMISSIONS;
    } else if (error.message.includes('Not found')) {
      statusCode = 404;
      errorCode = ErrorCodes.RESOURCE_NOT_FOUND;
    } else if (error.message.includes('Validation')) {
      statusCode = 400;
      errorCode = ErrorCodes.VALIDATION_ERROR;
    }
    
    errorMessage = error.message;
  }

  // Log error details
  logger.error(`Error in ${context}:`, {
    code: errorCode,
    message: errorMessage,
    details,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });

  // Send error response
  const errorResponse = createErrorResponse(errorCode, errorMessage, details, language);
  res.status(statusCode).json(errorResponse);
}

// Async error handler wrapper
export function asyncHandler(fn: Function) {
  return (req: any, res: Response, next: any) => {
    Promise.resolve(fn(req, res, next)).catch((error: Error) => {
      const language = req.headers['accept-language']?.includes('pt') ? 'pt' : 'en';
      handleError(error, res, `${req.method} ${req.originalUrl}`, language);
    });
  };
}

// Specific error creators
export const createAuthError = (message?: string, details?: any) => 
  new AppError(ErrorCodes.AUTH_REQUIRED, message, 401, details);

export const createValidationError = (message?: string, details?: any) => 
  new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details);

export const createNotFoundError = (resource: string, details?: any) => 
  new AppError(ErrorCodes.RESOURCE_NOT_FOUND, `${resource} not found`, 404, details);

export const createForbiddenError = (message?: string, details?: any) => 
  new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, message, 403, details);

export const createCSVError = (message?: string, details?: any) => 
  new AppError(ErrorCodes.CSV_PARSE_ERROR, message, 400, details);

export const createImportError = (message?: string, details?: any) => 
  new AppError(ErrorCodes.IMPORT_FAILED, message, 500, details);

export const createRateLimitError = (message?: string, details?: any) => 
  new AppError(ErrorCodes.RATE_LIMIT_EXCEEDED, message, 429, details);

// Firebase error mapping
export function mapFirebaseError(error: any): AppError {
  const errorCode = error.code || '';
  
  switch (errorCode) {
    case 'auth/invalid-email':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return new AppError(ErrorCodes.AUTH_REQUIRED, 'Invalid credentials', 401);
    
    case 'auth/too-many-requests':
      return new AppError(ErrorCodes.RATE_LIMIT_EXCEEDED, 'Too many requests', 429);
    
    case 'permission-denied':
      return new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, 'Access denied', 403);
    
    case 'not-found':
      return new AppError(ErrorCodes.RESOURCE_NOT_FOUND, 'Resource not found', 404);
    
    case 'already-exists':
      return new AppError(ErrorCodes.DUPLICATE_RESOURCE, 'Resource already exists', 409);
    
    default:
      return new AppError(ErrorCodes.FIREBASE_ERROR, error.message || 'Firebase error', 500);
  }
}

// OpenAI error mapping
export function mapOpenAIError(error: any): AppError {
  const status = error.response?.status || 500;
  
  if (status === 401) {
    return new AppError(ErrorCodes.OPENAI_ERROR, 'OpenAI API authentication failed', 500);
  } else if (status === 429) {
    return new AppError(ErrorCodes.RATE_LIMIT_EXCEEDED, 'OpenAI rate limit exceeded', 500);
  } else if (status >= 500) {
    return new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'OpenAI service unavailable', 503);
  } else {
    return new AppError(ErrorCodes.OPENAI_ERROR, error.message || 'OpenAI error', 500);
  }
}

// Request timeout wrapper
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new AppError(
          ErrorCodes.TIMEOUT_ERROR,
          errorMessage || `Operation timed out after ${timeoutMs}ms`,
          408
        ));
      }, timeoutMs);
    })
  ]);
}

// Retry wrapper with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  context?: string
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        logger.error(`Operation failed after ${maxRetries} attempts${context ? ` in ${context}` : ''}:`, error);
        break;
      }
      
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(`Operation failed on attempt ${attempt}${context ? ` in ${context}` : ''}, retrying in ${delay}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}