import { jest } from '@jest/globals';

// Environment configuration for testing
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8889';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9089';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = 'localhost:9189';
process.env.GCLOUD_PROJECT = 'demo-test';

// Mock Firebase Admin SDK with emulator-compatible setup
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []), // Initially no apps
  cert: jest.fn(),
}));

// @ts-ignore - Suppress TypeScript errors for complex Jest mocks
jest.mock('firebase-admin/firestore', () => ({
  getFirestore: jest.fn(() => {
    // Create a factory function to avoid circular references
    const createMockCollection = (): any => ({
      doc: jest.fn(() => createMockDoc()),
      // @ts-ignore
      add: jest.fn().mockResolvedValue({ id: 'mock-new-doc-id' }),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      // @ts-ignore
      get: jest.fn().mockResolvedValue({
        docs: [],
        forEach: jest.fn(),
        empty: true,
        size: 0,
      }),
    });

    const createMockDoc = (): any => ({
      exists: true,
      data: jest.fn(() => ({})),
      id: 'mock-doc-id',
      collection: jest.fn(() => createMockCollection()), // Support nested collections
      // @ts-ignore
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({}),
        id: 'mock-doc-id',
      }),
      // @ts-ignore
      set: jest.fn().mockResolvedValue(undefined),
      // @ts-ignore
      update: jest.fn().mockResolvedValue(undefined),
      // @ts-ignore
      delete: jest.fn().mockResolvedValue(undefined),
    });

    const mockBatch = {
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      // @ts-ignore
      commit: jest.fn().mockResolvedValue([]),
    };

    return {
      collection: jest.fn(() => createMockCollection()),
      doc: jest.fn(() => createMockDoc()),
      batch: jest.fn(() => mockBatch),
      // @ts-ignore
      runTransaction: jest.fn().mockResolvedValue({}),
      collectionGroup: jest.fn(() => createMockCollection()),
    };
  }),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({ 
      seconds: Math.floor(date.getTime() / 1000), 
      nanoseconds: 0 
    })),
  },
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _type: 'server_timestamp' })),
    increment: jest.fn((value: number) => ({ _type: 'increment', _value: value })),
    arrayUnion: jest.fn((...values: unknown[]) => ({ _type: 'array_union', _values: values })),
    arrayRemove: jest.fn((...values: unknown[]) => ({ _type: 'array_remove', _values: values })),
  },
}));

jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    createCustomToken: jest.fn(),
    setCustomUserClaims: jest.fn(),
    deleteUser: jest.fn(),
    getUserByEmail: jest.fn(),
    updateUser: jest.fn(),
  })),
}));

jest.mock('firebase-admin/storage', () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        exists: jest.fn(),
        download: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
        getMetadata: jest.fn(),
      })),
    })),
  })),
}));

// Mock Firebase Functions
jest.mock('firebase-functions', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock('firebase-functions/v2/https', () => ({
  onRequest: jest.fn((options, handler) => handler),
}));

jest.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: jest.fn((options, handler) => handler),
}));

jest.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: jest.fn((options, handler) => handler),
}));

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

// Mock Express and related modules
jest.mock('express', () => {
  const mockApp = {
    use: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    post: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    listen: jest.fn(),
  };
  
  const mockExpress = Object.assign(jest.fn(() => mockApp), {
    json: jest.fn(() => (req: any, res: any, next: any) => next()),
    urlencoded: jest.fn(() => (req: any, res: any, next: any) => next()),
    Router: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      use: jest.fn(),
    })),
  });
  
  return mockExpress;
});

jest.mock('cors', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

jest.mock('helmet', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req: any, res: any, next: any) => next());
});

// Set up environment variables for testing
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
process.env.OPENAI_API_KEY = 'test-legacy-key'; // For backward compatibility
process.env.FIREBASE_PROJECT_ID = 'demo-test';
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  // Initialize any global test setup here
  jest.useFakeTimers();
});

afterAll(async () => {
  // Clean up any global test resources here
  jest.useRealTimers();
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// Add cleanup for each test to prevent memory leaks
beforeEach(() => {
  // Use fake timers for each test to prevent real setInterval calls
  jest.useFakeTimers();
});

afterEach(() => {
  // Clear any timers set during tests and restore real timers
  jest.clearAllTimers();
  jest.useRealTimers();
}); 