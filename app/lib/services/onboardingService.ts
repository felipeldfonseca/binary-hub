import { auth } from '@/lib/firebase'

interface OnboardingState {
  completed: boolean
  completedAt?: Date
  marketAccountsCount: number
  lastChecked: Date
}

const ONBOARDING_STORAGE_KEY = 'onboarding-state'

export class OnboardingService {
  private static instance: OnboardingService
  private cachedState: Map<string, OnboardingState> = new Map()

  static getInstance(): OnboardingService {
    if (!OnboardingService.instance) {
      OnboardingService.instance = new OnboardingService()
    }
    return OnboardingService.instance
  }

  /**
   * Check if user has completed onboarding by verifying market accounts exist
   */
  async checkOnboardingStatus(userId?: string): Promise<OnboardingState> {
    const currentUserId = userId || auth.currentUser?.uid
    
    if (!currentUserId) {
      throw new Error('User not authenticated')
    }

    // Check cache first (valid for 5 minutes)
    const cached = this.cachedState.get(currentUserId)
    if (cached && Date.now() - cached.lastChecked.getTime() < 5 * 60 * 1000) {
      return cached
    }

    try {
      // Get auth token
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        throw new Error('Failed to get authentication token')
      }

      // Check for existing market accounts
      const response = await fetch('/api/v1/markets/setup', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        // If unauthorized, user needs to log in again
        if (response.status === 401) {
          throw new Error('Authentication expired')
        }
        throw new Error('Failed to check onboarding status')
      }

      const data = await response.json()
      const marketAccounts = data.marketAccounts || []
      
      const state: OnboardingState = {
        completed: marketAccounts.length > 0,
        completedAt: marketAccounts.length > 0 ? new Date() : undefined,
        marketAccountsCount: marketAccounts.length,
        lastChecked: new Date()
      }

      // Cache the result
      this.cachedState.set(currentUserId, state)

      // Store in localStorage for offline access
      try {
        localStorage.setItem(`${ONBOARDING_STORAGE_KEY}-${currentUserId}`, JSON.stringify({
          ...state,
          lastChecked: state.lastChecked.toISOString(),
          completedAt: state.completedAt?.toISOString()
        }))
      } catch (err) {
        console.warn('Failed to cache onboarding state in localStorage:', err)
      }

      return state
    } catch (error) {
      console.error('Error checking onboarding status:', error)
      
      // Try to get cached state from localStorage as fallback
      try {
        const cachedData = localStorage.getItem(`${ONBOARDING_STORAGE_KEY}-${currentUserId}`)
        if (cachedData) {
          const parsed = JSON.parse(cachedData)
          return {
            completed: parsed.completed || false,
            completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
            marketAccountsCount: parsed.marketAccountsCount || 0,
            lastChecked: new Date(parsed.lastChecked || Date.now())
          }
        }
      } catch (err) {
        console.warn('Failed to read cached onboarding state:', err)
      }

      // Default to not completed if we can't determine status
      return {
        completed: false,
        marketAccountsCount: 0,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Mark onboarding as completed
   */
  async markOnboardingCompleted(userId?: string): Promise<void> {
    const currentUserId = userId || auth.currentUser?.uid
    
    if (!currentUserId) {
      throw new Error('User not authenticated')
    }

    const state: OnboardingState = {
      completed: true,
      completedAt: new Date(),
      marketAccountsCount: 0, // Will be updated by checkOnboardingStatus
      lastChecked: new Date()
    }

    // Update cache
    this.cachedState.set(currentUserId, state)

    // Store in localStorage
    try {
      localStorage.setItem(`${ONBOARDING_STORAGE_KEY}-${currentUserId}`, JSON.stringify({
        ...state,
        lastChecked: state.lastChecked.toISOString(),
        completedAt: state.completedAt?.toISOString()
      }))
    } catch (err) {
      console.warn('Failed to cache onboarding completion in localStorage:', err)
    }
  }

  /**
   * Clear onboarding cache (useful for testing or when user logs out)
   */
  clearCache(userId?: string): void {
    const currentUserId = userId || auth.currentUser?.uid
    
    if (currentUserId) {
      this.cachedState.delete(currentUserId)
      try {
        localStorage.removeItem(`${ONBOARDING_STORAGE_KEY}-${currentUserId}`)
      } catch (err) {
        console.warn('Failed to clear onboarding cache from localStorage:', err)
      }
    }
  }

  /**
   * Clear all cached data (useful when user logs out)
   */
  clearAllCache(): void {
    this.cachedState.clear()
    try {
      // Remove all onboarding state entries from localStorage
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(ONBOARDING_STORAGE_KEY)) {
          localStorage.removeItem(key)
        }
      })
    } catch (err) {
      console.warn('Failed to clear all onboarding cache from localStorage:', err)
    }
  }
}

export const onboardingService = OnboardingService.getInstance()