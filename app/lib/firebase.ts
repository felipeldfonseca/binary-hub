// Firebase stub for lean rebuild
// This file provides mock exports to prevent import errors
// Actual functionality is handled by Supabase

console.warn('Firebase stub loaded - using Supabase for all operations');

// Mock Firebase Auth user type
interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: () => Promise<string>;
}

// Mock auth object with compatible interface
export const auth = {
  currentUser: null as MockUser | null,
  onAuthStateChanged: (_callback: (user: MockUser | null) => void) => {
    // Return unsubscribe function
    return () => {};
  },
  signOut: async () => {},
};

// Mock Firestore types
interface MockDocRef {
  id: string;
}

interface MockCollection {
  doc: (id?: string) => MockDocRef;
}

// Mock Firestore object
export const db = {
  collection: (_name: string): MockCollection => ({
    doc: (id?: string) => ({ id: id || 'mock-id' }),
  }),
  doc: (_path: string) => ({ id: 'mock-id' }),
};

// Mock storage object
export const storage = {};

// Mock functions object
export const functions = {};

// Default export
const app = {};
export default app;
