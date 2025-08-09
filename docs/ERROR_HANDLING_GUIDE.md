# Error Handling Guide - Binary Hub

This document outlines the comprehensive error handling system implemented throughout the Binary Hub application.

## Overview

The error handling system provides:
- Standardized error responses across all API endpoints
- Consistent error codes and messages in English and Portuguese
- Error boundaries for React components
- Enhanced logging for debugging and monitoring
- User-friendly error notifications via toast system

## Backend Error Handling

### Error Response Format

All API endpoints return errors in this standardized format:

```typescript
interface ErrorResponse {
  error: string;        // Human-readable error message
  code: string;         // Machine-readable error code
  details?: any;        // Additional context (optional)
  timestamp: string;    // ISO timestamp when error occurred
}
```

### Error Codes

The system uses predefined error codes grouped by category:

#### Authentication Errors
- `AUTH_REQUIRED` - Authentication is required
- `INVALID_TOKEN` - Invalid authentication token
- `INSUFFICIENT_PERMISSIONS` - User lacks required permissions
- `TOKEN_EXPIRED` - Authentication token has expired

#### Validation Errors
- `VALIDATION_ERROR` - General validation failure
- `MISSING_REQUIRED_FIELD` - Required field is missing
- `INVALID_INPUT` - Invalid input provided
- `INVALID_FILE_TYPE` - Invalid file type uploaded
- `FILE_TOO_LARGE` - File exceeds size limit

#### Resource Errors
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `TRADE_NOT_FOUND` - Specific trade not found
- `IMPORT_NOT_FOUND` - Import record not found
- `USER_NOT_FOUND` - User not found

#### CSV/Import Errors
- `CSV_PARSE_ERROR` - Failed to parse CSV file
- `CSV_VALIDATION_ERROR` - CSV validation failed
- `IMPORT_FAILED` - Import operation failed
- `BULK_OPERATION_FAILED` - Bulk operation failed

### Using the Error Handler

#### Creating Errors

```typescript
import { createAuthError, createValidationError, AppError, ErrorCodes } from '../utils/errorHandler';

// Quick error creation
throw createAuthError('User not authenticated');
throw createValidationError('Invalid email format', { field: 'email' });

// Custom error
throw new AppError(
  ErrorCodes.RATE_LIMIT_EXCEEDED,
  'Too many requests',
  429,
  { limit: 100, window: '15min' }
);
```

#### Async Route Handler

```typescript
import { asyncHandler } from '../utils/errorHandler';

router.get('/endpoint', asyncHandler(async (req, res) => {
  // Your route logic here
  // Any thrown errors are automatically handled
}));
```

#### Manual Error Handling

```typescript
import { handleError } from '../utils/errorHandler';

try {
  // risky operation
} catch (error) {
  handleError(error, res, 'POST /api/endpoint', 'pt');
}
```

## Frontend Error Handling

### Error Boundaries

Error boundaries catch JavaScript errors anywhere in the component tree:

```tsx
import ErrorBoundary, { ChartErrorBoundary, FormErrorBoundary } from '@/components/error/ErrorBoundary';

// General error boundary
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// Specialized boundaries
<ChartErrorBoundary>
  <PerformanceChart />
</ChartErrorBoundary>

<FormErrorBoundary>
  <TradeForm />
</FormErrorBoundary>
```

### Using Error Handlers in Hooks

```tsx
import { useErrorHandler, useFormErrorHandler } from '@/hooks/useErrorHandler';

function useMyAPI() {
  const { handleApiError, wrapAsyncOperation } = useErrorHandler();

  const fetchData = async () => {
    const response = await fetch('/api/data');
    
    if (!response.ok) {
      await handleApiError(response, 'Fetching data');
      return null;
    }
    
    return response.json();
  };

  // Wrap operations that might throw
  const safeOperation = () => wrapAsyncOperation(
    async () => {
      // risky operation
    },
    'Safe operation context'
  );
}
```

### Toast Notifications

```tsx
import { useToastHelpers } from '@/components/ui/Toast';

function MyComponent() {
  const { showSuccess, showError, showWarning } = useToastHelpers();

  const handleSuccess = () => {
    showSuccess('Upload Complete', 'Your trades have been imported successfully');
  };

  const handleError = () => {
    showError('Upload Failed', 'Please check your CSV format and try again');
  };
}
```

## CSV Processing Error Handling

The CSV processing system includes comprehensive error handling:

### Validation Errors
- Invalid headers detection with suggestions
- Row-level parsing errors with line numbers
- Data type validation with specific error messages

### Processing Errors
- Timeout protection for large files
- Memory usage monitoring
- Duplicate detection with detailed reporting

### Logging
- Detailed processing metrics
- Error categorization and counting
- Performance monitoring

## Logging Best Practices

### Backend Logging

```typescript
import { logger } from 'firebase-functions';

// Structured logging
logger.info('Operation started', {
  userId: 'user123',
  operation: 'csv-import',
  timestamp: new Date().toISOString()
});

logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  context: 'CSV processing',
  userId: 'user123'
});
```

### Frontend Logging

```typescript
import { logger } from '@/lib/utils/logger';

// Development: logs to console
// Production: stores in sessionStorage for debugging
logger.info('User action', { action: 'file-upload', fileName: 'trades.csv' });
logger.error('API call failed', { endpoint: '/api/trades', status: 500 });
```

## Error Recovery Strategies

### Retry Logic

The system includes automatic retry with exponential backoff:

```typescript
import { withRetry } from '../utils/errorHandler';

const result = await withRetry(
  async () => {
    // operation that might fail
  },
  3,      // max retries
  1000,   // base delay (ms)
  'API call context'
);
```

### Timeout Protection

```typescript
import { withTimeout } from '../utils/errorHandler';

const result = await withTimeout(
  longRunningOperation(),
  30000,  // 30 second timeout
  'Operation timed out'
);
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rates by Endpoint**
   - Track 4xx and 5xx response rates
   - Monitor error code distribution

2. **CSV Processing Metrics**
   - Parse success rates
   - Processing times
   - Memory usage

3. **Frontend Error Rates**
   - JavaScript errors
   - API call failures
   - Component rendering errors

### Alert Thresholds

- Error rate > 5% for any endpoint
- CSV processing failures > 10%
- Component errors > 1%
- API response time > 5 seconds

## Testing Error Scenarios

### Unit Tests

```typescript
describe('Error Handling', () => {
  it('should handle authentication errors', async () => {
    const response = await request(app)
      .get('/api/protected')
      .expect(401);
    
    expect(response.body).toMatchObject({
      error: expect.any(String),
      code: 'AUTH_REQUIRED',
      timestamp: expect.any(String)
    });
  });
});
```

### Integration Tests

Test error scenarios:
- Invalid CSV files
- Large file uploads
- Network timeouts
- Database connection failures

## Common Pitfalls and Solutions

### 1. Not Handling Promise Rejections
```typescript
// Bad
async function badFunction() {
  fetch('/api/data'); // Unhandled promise
}

// Good
async function goodFunction() {
  try {
    await fetch('/api/data');
  } catch (error) {
    handleError(error, context);
  }
}
```

### 2. Generic Error Messages
```typescript
// Bad
throw new Error('Something went wrong');

// Good
throw createValidationError('Email format is invalid', { 
  field: 'email', 
  provided: email 
});
```

### 3. Missing Context in Logs
```typescript
// Bad
logger.error('Failed', error);

// Good
logger.error('CSV import failed', {
  error: error.message,
  userId,
  fileName,
  fileSize,
  processingStep: 'validation'
});
```

## Migration Guide

If you're updating existing code to use the new error handling:

1. **Replace manual error responses** with error handlers
2. **Wrap async routes** with `asyncHandler`
3. **Add error boundaries** to React components
4. **Update error messages** to use standard codes
5. **Add structured logging** to operations

This comprehensive error handling system ensures better user experience, easier debugging, and more reliable application behavior.