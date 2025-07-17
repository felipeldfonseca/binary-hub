import { jest } from "@jest/globals";

// Mock Firebase Admin SDK
jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
}));

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
}));

jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.mock("firebase-admin/storage", () => ({
  getStorage: jest.fn(() => ({
    bucket: jest.fn(),
  })),
}));

// Mock Firebase Functions
jest.mock("firebase-functions", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
  },
}));

jest.mock("firebase-functions/v2/https", () => ({
  onRequest: jest.fn(),
}));

jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentCreated: jest.fn(),
}));

jest.mock("firebase-functions/v2/scheduler", () => ({
  onSchedule: jest.fn(),
}));

// Mock OpenAI
jest.mock("openai", () => {
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

// Set up environment variables for testing
process.env.OPENAI_API_KEY = "test-api-key";
process.env.FIREBASE_PROJECT_ID = "test-project";

// Global test timeout
jest.setTimeout(30000); 