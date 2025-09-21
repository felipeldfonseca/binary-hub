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
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore'
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
  
  // NEW SOCIAL FIELDS FOR PHASE 1:
  username?: string // unique username for @mentions and URLs
  bio?: string // short bio for profile
  location?: string // user location
  website?: string // personal website URL
  tradingSince?: string // when they started trading
  
  // Social stats (calculated fields)
  socialStats?: {
    followersCount: number
    followingCount: number
    postsCount: number
    likesReceived: number
  }
  
  // Enhanced privacy controls for social features
  privacy?: {
    allowsFollows: boolean // can users follow this profile
    requiresFollowApproval: boolean // manual approval for follows
    showsOnlineStatus: boolean // show when user is online
    allowsDirectMessages: boolean // can receive DMs
  }
  
  // Social preferences
  socialPreferences?: {
    defaultPostVisibility: 'public' | 'followers' | 'private'
    autoShareTrades: boolean // automatically share good trades
    notifyOnMentions: boolean
    notifyOnFollows: boolean
  }
}

// Achievement type for user profiles
export interface Achievement {
  id: string
  type: 'streak' | 'profit' | 'trades' | 'winrate' | 'consistency' | 'milestone'
  title: string
  description: string
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  earnedAt: Date
}

// NEW: Public profile interface for social features
export interface PublicProfile {
  id: string
  displayName: string
  username?: string
  bio?: string
  photoURL: string
  location?: string
  website?: string
  tradingSince?: string
  
  // Trading performance (if public)
  stats?: {
    totalTrades: number
    winRate: number
    totalProfit: number
    avgStake: number
    currentStreak: number
    bestStreak: number
    profitableDays: number
  }
  
  // Social stats
  socialStats: {
    followersCount: number
    followingCount: number
    postsCount: number
    likesReceived: number
  }
  
  // Current user's relationship to this profile
  relationship?: {
    isFollowing: boolean
    isFollower: boolean
    isBlocked: boolean
    isMuted: boolean
  }
  
  // Recent achievements
  recentAchievements: Achievement[]
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
      updatedAt: new Date(),
      
      // Initialize social fields with defaults
      socialStats: {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        likesReceived: 0
      },
      
      // Initialize privacy settings with safe defaults
      privacy: {
        allowsFollows: true,
        requiresFollowApproval: false,
        showsOnlineStatus: true,
        allowsDirectMessages: true
      },
      
      // Initialize social preferences with sensible defaults
      socialPreferences: {
        defaultPostVisibility: 'public',
        autoShareTrades: false,
        notifyOnMentions: true,
        notifyOnFollows: true
      }
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

// Username utilities for social features
export const createUniqueUsername = async (displayName: string): Promise<string> => {
  const baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 15)
  
  let username = baseUsername
  let counter = 1
  
  // Check if username exists
  while (await usernameExists(username)) {
    username = `${baseUsername}${counter}`
    counter++
  }
  
  return username
}

export const usernameExists = async (username: string): Promise<boolean> => {
  const usernamesRef = collection(db, 'usernames')
  const q = query(usernamesRef, where('username', '==', username))
  const snapshot = await getDocs(q)
  return !snapshot.empty
}

export const updateUsername = async (uid: string, newUsername: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate username
    if (newUsername.length < 3 || newUsername.length > 20) {
      return { success: false, error: 'Username must be between 3 and 20 characters' }
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores' }
    }
    
    // Check if username already exists
    if (await usernameExists(newUsername)) {
      return { success: false, error: 'Username already taken' }
    }
    
    // Get current user data to get old username
    const userRef = doc(db, 'users', uid)
    const userDoc = await getDoc(userRef)
    const oldUsername = userDoc.data()?.username
    
    // Update user profile
    await updateDoc(userRef, { 
      username: newUsername,
      updatedAt: new Date()
    })
    
    // Add new username to usernames collection
    const usernameRef = doc(db, 'usernames', newUsername)
    await setDoc(usernameRef, {
      uid,
      username: newUsername,
      createdAt: new Date()
    })
    
    // Remove old username if it exists
    if (oldUsername) {
      const oldUsernameRef = doc(db, 'usernames', oldUsername)
      await deleteDoc(oldUsernameRef)
    }
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const getUserByUsername = async (username: string): Promise<PublicProfile | null> => {
  try {
    const usernameRef = doc(db, 'usernames', username)
    const usernameDoc = await getDoc(usernameRef)
    
    if (!usernameDoc.exists()) {
      return null
    }
    
    const uid = usernameDoc.data().uid
    const userRef = doc(db, 'users', uid)
    const userDoc = await getDoc(userRef)
    
    if (!userDoc.exists()) {
      return null
    }
    
    const userData = userDoc.data() as UserProfile
    
    // Convert to PublicProfile (hiding sensitive data)
    const publicProfile: PublicProfile = {
      id: userData.uid,
      displayName: userData.displayName,
      username: userData.username,
      bio: userData.bio,
      photoURL: userData.photoURL || '',
      location: userData.location,
      website: userData.website,
      tradingSince: userData.tradingSince,
      socialStats: userData.socialStats || {
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        likesReceived: 0
      },
      recentAchievements: []
    }
    
    return publicProfile
  } catch (error) {
    console.error('Error getting user by username:', error)
    return null
  }
} 