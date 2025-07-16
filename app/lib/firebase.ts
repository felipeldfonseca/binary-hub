import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef123456',
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Initialize Firebase services
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)

// Connect to Firebase emulators in development
if (process.env.NODE_ENV === 'development') {
  try {
    // Auth emulator
    connectAuthEmulator(auth, 'http://localhost:9088')
  } catch (error) {
    // Emulator already connected
  }
  
  try {
    // Firestore emulator
    connectFirestoreEmulator(db, 'localhost', 8888)
  } catch (error) {
    // Emulator already connected
  }
  
  try {
    // Functions emulator
    connectFunctionsEmulator(functions, 'localhost', 5002)
  } catch (error) {
    // Emulator already connected
  }
  
  try {
    // Storage emulator
    connectStorageEmulator(storage, 'localhost', 9188)
  } catch (error) {
    // Emulator already connected
  }
}

export default app 