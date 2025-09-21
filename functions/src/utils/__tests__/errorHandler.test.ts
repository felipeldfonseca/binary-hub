import { 
  AppError, 
  ErrorCodes, 
  createErrorResponse, 
  createAuthError, 
  createValidationError,
  mapFirebaseError,
  withTimeout 
} from '../errorHandler';

describe('Error Handler Utils', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError(
        ErrorCodes.AUTH_REQUIRED,
        'Custom auth message',
        401,
        { userId: 'test-user' }
      );

      expect(error.name).toBe('AppError');
      expect(error.code).toBe(ErrorCodes.AUTH_REQUIRED);
      expect(error.message).toBe('Custom auth message');
      expect(error.statusCode).toBe(401);
      expect(error.details).toEqual({ userId: 'test-user' });
      expect(error.isOperational).toBe(true);
    });
  });

  describe('createErrorResponse', () => {
    it('should create standardized error response in English', () => {
      const response = createErrorResponse(
        ErrorCodes.VALIDATION_ERROR,
        'Custom validation message',
        { field: 'email' },
        'en'
      );

      expect(response.error).toBe('Custom validation message');
      expect(response.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(response.details).toEqual({ field: 'email' });
      expect(response.timestamp).toBeDefined();
    });

    it('should create standardized error response in Portuguese', () => {
      const response = createErrorResponse(
        ErrorCodes.AUTH_REQUIRED,
        undefined,
        undefined,
        'pt'
      );

      expect(response.error).toBe('Autenticação é obrigatória');
      expect(response.code).toBe(ErrorCodes.AUTH_REQUIRED);
    });
  });

  describe('Error creators', () => {
    it('should create auth error correctly', () => {
      const error = createAuthError('Token expired', { tokenId: '123' });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCodes.AUTH_REQUIRED);
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Token expired');
      expect(error.details).toEqual({ tokenId: '123' });
    });

    it('should create validation error correctly', () => {
      const error = createValidationError('Invalid email format');

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('mapFirebaseError', () => {
    it('should map Firebase auth errors correctly', () => {
      const firebaseError = { code: 'auth/invalid-email', message: 'Invalid email' };
      const appError = mapFirebaseError(firebaseError);

      expect(appError.code).toBe(ErrorCodes.AUTH_REQUIRED);
      expect(appError.statusCode).toBe(401);
    });

    it('should map Firebase permission errors correctly', () => {
      const firebaseError = { code: 'permission-denied', message: 'Access denied' };
      const appError = mapFirebaseError(firebaseError);

      expect(appError.code).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
      expect(appError.statusCode).toBe(403);
    });

    it('should handle unknown Firebase errors', () => {
      const firebaseError = { code: 'unknown-error', message: 'Unknown error' };
      const appError = mapFirebaseError(firebaseError);

      expect(appError.code).toBe(ErrorCodes.FIREBASE_ERROR);
      expect(appError.statusCode).toBe(500);
    });
  });

  describe('withTimeout', () => {
    it('should resolve with promise result when within timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000);

      expect(result).toBe('success');
    });

    it('should reject with timeout error when promise takes too long', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(withTimeout(promise, 100, 'Custom timeout')).rejects.toThrow(AppError);
    });
  });
});