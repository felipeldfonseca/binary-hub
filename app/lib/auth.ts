import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  OAuthProvider
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

// Types
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  createdAt: Date
  updatedAt: Date
}

// Auth Providers
const googleProvider = new GoogleAuthProvider()
const appleProvider = new OAuthProvider('apple.com')

// Convert Firebase User to AuthUser
export const formatUser = (user: User): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL
})

// Create user profile in Firestore
export const createUserProfile = async (user: AuthUser): Promise<void> => {
  const userRef = doc(db, 'users', user.uid)
  const userDoc = await getDoc(userRef)
  
  if (!userDoc.exists()) {
    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: new Date(),
      updatedAt: new Date()
    }
    
    await setDoc(userRef, profile)
  }
}

// Email/Password Authentication
export const registerWithEmail = async (email: string, password: string, displayName?: string) => {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password)
    
    // Update display name if provided
    if (displayName) {
      await updateProfile(user, { displayName })
    }
    
    const authUser = formatUser(user)
    await createUserProfile(authUser)
    
    return { user: authUser, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export const loginWithEmail = async (email: string, password: string) => {
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password)
    const authUser = formatUser(user)
    
    return { user: authUser, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Social Authentication
export const signInWithGoogle = async () => {
  try {
    const { user } = await signInWithPopup(auth, googleProvider)
    const authUser = formatUser(user)
    await createUserProfile(authUser)
    
    return { user: authUser, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

export const signInWithApple = async () => {
  try {
    const { user } = await signInWithPopup(auth, appleProvider)
    const authUser = formatUser(user)
    await createUserProfile(authUser)
    
    return { user: authUser, error: null }
  } catch (error: any) {
    return { user: null, error: error.message }
  }
}

// Logout
export const logout = async () => {
  try {
    await signOut(auth)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
}

// Password Reset
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { error: null }
  } catch (error: any) {
    return { error: error.message }
  }
} 