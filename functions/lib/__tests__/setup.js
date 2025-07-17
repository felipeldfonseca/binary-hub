"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Mock Firebase Admin SDK
globals_1.jest.mock('firebase-admin/app', () => ({
    initializeApp: globals_1.jest.fn(),
}));
globals_1.jest.mock('firebase-admin/firestore', () => ({
    getFirestore: globals_1.jest.fn(() => ({
        collection: globals_1.jest.fn(),
        doc: globals_1.jest.fn(),
    })),
}));
globals_1.jest.mock('firebase-admin/auth', () => ({
    getAuth: globals_1.jest.fn(() => ({
        verifyIdToken: globals_1.jest.fn(),
    })),
}));
globals_1.jest.mock('firebase-admin/storage', () => ({
    getStorage: globals_1.jest.fn(() => ({
        bucket: globals_1.jest.fn(),
    })),
}));
// Mock Firebase Functions
globals_1.jest.mock('firebase-functions', () => ({
    logger: {
        info: globals_1.jest.fn(),
        error: globals_1.jest.fn(),
        warn: globals_1.jest.fn(),
        log: globals_1.jest.fn(),
    },
}));
globals_1.jest.mock('firebase-functions/v2/https', () => ({
    onRequest: globals_1.jest.fn(),
}));
globals_1.jest.mock('firebase-functions/v2/firestore', () => ({
    onDocumentCreated: globals_1.jest.fn(),
}));
globals_1.jest.mock('firebase-functions/v2/scheduler', () => ({
    onSchedule: globals_1.jest.fn(),
}));
// Mock OpenAI
globals_1.jest.mock('openai', () => {
    return {
        __esModule: true,
        default: globals_1.jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: globals_1.jest.fn(),
                },
            },
        })),
    };
});
// Set up environment variables for testing
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.FIREBASE_PROJECT_ID = 'test-project';
// Global test timeout
globals_1.jest.setTimeout(30000);
//# sourceMappingURL=setup.js.map