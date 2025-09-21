import { logger } from 'firebase-functions';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TradeValidationResult extends ValidationResult {
  trade?: any;
}

/**
 * Validate trade data
 */
export function validateTradeData(data: any): TradeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!data.asset) {
    errors.push('Asset is required');
  }
  
  if (!data.direction || !['call', 'put'].includes(data.direction)) {
    errors.push('Direction must be "call" or "put"');
  }
  
  if (!data.amount || data.amount <= 0) {
    errors.push('Amount must be greater than 0');
  }
  
  if (!data.entryPrice || data.entryPrice <= 0) {
    errors.push('Entry price must be greater than 0');
  }
  
  if (!data.exitPrice || data.exitPrice <= 0) {
    errors.push('Exit price must be greater than 0');
  }
  
  if (!data.entryTime) {
    errors.push('Entry time is required');
  } else {
    const entryTime = new Date(data.entryTime);
    if (isNaN(entryTime.getTime())) {
      errors.push('Entry time must be a valid date');
    }
  }
  
  if (!data.exitTime) {
    errors.push('Exit time is required');
  } else {
    const exitTime = new Date(data.exitTime);
    if (isNaN(exitTime.getTime())) {
      errors.push('Exit time must be a valid date');
    }
  }
  
  if (!data.result || !['win', 'loss', 'tie'].includes(data.result)) {
    errors.push('Result must be "win", "loss", or "tie"');
  }

  // Optional validations
  if (data.amount && data.amount > 10000) {
    warnings.push('Amount seems unusually high');
  }
  
  if (data.entryTime && data.exitTime) {
    const entryTime = new Date(data.entryTime);
    const exitTime = new Date(data.exitTime);
    if (exitTime < entryTime) {
      errors.push('Exit time cannot be before entry time');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    trade: errors.length === 0 ? data : undefined
  };
}

/**
 * Validate trade filters
 */
export function validateTradeFilters(filters: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate date ranges
  if (filters.start) {
    const startDate = new Date(filters.start);
    if (isNaN(startDate.getTime())) {
      errors.push('Start date must be a valid date');
    }
  }
  
  if (filters.end) {
    const endDate = new Date(filters.end);
    if (isNaN(endDate.getTime())) {
      errors.push('End date must be a valid date');
    }
  }
  
  if (filters.start && filters.end) {
    const startDate = new Date(filters.start);
    const endDate = new Date(filters.end);
    if (endDate < startDate) {
      errors.push('End date cannot be before start date');
    }
  }

  // Validate pagination
  if (filters.limit && (filters.limit < 1 || filters.limit > 1000)) {
    errors.push('Limit must be between 1 and 1000');
  }
  
  if (filters.offset && filters.offset < 0) {
    errors.push('Offset must be non-negative');
  }

  // Validate result filter
  if (filters.result && !['win', 'loss', 'tie'].includes(filters.result)) {
    errors.push('Result filter must be "win", "loss", or "tie"');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate import request
 */
export function validateImportRequest(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data.fileName) {
    errors.push('File name is required');
  }
  
  if (!data.fileSize || data.fileSize <= 0) {
    errors.push('File size must be greater than 0');
  }
  
  if (data.fileSize && data.fileSize > 10 * 1024 * 1024) { // 10MB
    errors.push('File size must be less than 10MB');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sanitize trade data
 */
export function sanitizeTradeData(data: any): any {
  const sanitized = { ...data };
  
  // Remove undefined values
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });
  
  // Convert string numbers to actual numbers
  if (typeof sanitized.amount === 'string') {
    sanitized.amount = parseFloat(sanitized.amount);
  }
  
  if (typeof sanitized.entryPrice === 'string') {
    sanitized.entryPrice = parseFloat(sanitized.entryPrice);
  }
  
  if (typeof sanitized.exitPrice === 'string') {
    sanitized.exitPrice = parseFloat(sanitized.exitPrice);
  }
  
  if (typeof sanitized.profit === 'string') {
    sanitized.profit = parseFloat(sanitized.profit);
  }
  
  // Convert string dates to Date objects
  if (typeof sanitized.entryTime === 'string') {
    sanitized.entryTime = new Date(sanitized.entryTime);
  }
  
  if (typeof sanitized.exitTime === 'string') {
    sanitized.exitTime = new Date(sanitized.exitTime);
  }
  
  return sanitized;
}

/**
 * Validate user ID format
 */
export function validateUserId(userId: string): boolean {
  // Firebase user IDs are typically 28 characters long
  return typeof userId === 'string' && userId.length > 0 && userId.length <= 128;
}

/**
 * Validate trade ID format
 */
export function validateTradeId(tradeId: string): boolean {
  return typeof tradeId === 'string' && tradeId.length > 0 && tradeId.length <= 128;
}

/**
 * Create validation error response
 */
export function createValidationError(errors: string[]): any {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: { errors },
    timestamp: new Date().toISOString()
  };
}

/**
 * Log validation errors
 */
export function logValidationErrors(errors: string[], context: string): void {
  logger.warn(`Validation errors in ${context}:`, { errors });
}

/**
 * Validate request body
 */
export function validateRequestBody(body: any, requiredFields: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of requiredFields) {
    if (!body || body[field] === undefined || body[field] === null || body[field] === '') {
      errors.push(`${field} is required`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
} 