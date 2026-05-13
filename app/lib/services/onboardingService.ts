// Lean rebuild - onboarding service using localStorage only

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
   * Check if user has completed onboarding
   */
  async checkOnboardingStatus(userId?: string): Promise<OnboardingState> {
    const currentUserId = userId || 'default-user'

    // Check cache first (valid for 5 minutes)
    const cached = this.cachedState.get(currentUserId)
    if (cached && Date.now() - cached.lastChecked.getTime() < 5 * 60 * 1000) {
      return cached
    }

    // Try to get from localStorage
    try {
      const cachedData = localStorage.getItem(`${ONBOARDING_STORAGE_KEY}-${currentUserId}`)
      const onboardingCompleted = localStorage.getItem('binaryHub_onboardingCompleted')

      if (cachedData) {
        const parsed = JSON.parse(cachedData)
        const state: OnboardingState = {
          completed: parsed.completed || onboardingCompleted === 'true',
          completedAt: parsed.completedAt ? new Date(parsed.completedAt) : undefined,
          marketAccountsCount: parsed.marketAccountsCount || 1,
          lastChecked: new Date()
        }
        this.cachedState.set(currentUserId, state)
        return state
      }

      // Default state - completed if onboardingCompleted flag is set
      const state: OnboardingState = {
        completed: onboardingCompleted === 'true',
        marketAccountsCount: onboardingCompleted === 'true' ? 1 : 0,
        lastChecked: new Date()
      }

      this.cachedState.set(currentUserId, state)
      return state
    } catch (err) {
      console.warn('Failed to read onboarding state:', err)
      // Default to completed to avoid onboarding loop
      return {
        completed: true,
        marketAccountsCount: 1,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Mark onboarding as completed
   */
  async markOnboardingCompleted(userId?: string): Promise<void> {
    const currentUserId = userId || 'default-user'

    const state: OnboardingState = {
      completed: true,
      completedAt: new Date(),
      marketAccountsCount: 1,
      lastChecked: new Date()
    }

    // Update cache
    this.cachedState.set(currentUserId, state)

    // Store in localStorage
    try {
      localStorage.setItem('binaryHub_onboardingCompleted', 'true')
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
   * Clear onboarding cache
   */
  clearCache(userId?: string): void {
    const currentUserId = userId || 'default-user'

    this.cachedState.delete(currentUserId)
    try {
      localStorage.removeItem(`${ONBOARDING_STORAGE_KEY}-${currentUserId}`)
    } catch (err) {
      console.warn('Failed to clear onboarding cache from localStorage:', err)
    }
  }

  /**
   * Clear all cached data
   */
  clearAllCache(): void {
    this.cachedState.clear()
    try {
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
