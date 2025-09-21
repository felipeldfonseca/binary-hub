/**
 * Lazy-loaded component exports for optimal bundle splitting
 */
import React from 'react'
import { createLazyComponent } from '@/lib/performance'
import { LoadingSkeletons } from '@/components/shared/LazyWrapper'

// Dashboard Components
export const DashboardV1Modern = createLazyComponent(
  () => import('@/components/dashboard/versions/DashboardV1Modern'),
  LoadingSkeletons.Dashboard
)

// Analytics Components
export const AnalyticsLayout = createLazyComponent(
  () => import('@/components/analytics/AnalyticsLayout'),
  LoadingSkeletons.Analytics
)

export const AnalyticsVersionSelector = createLazyComponent(
  () => import('@/components/analytics/AnalyticsVersionSelector'),
  () => <div className="animate-pulse bg-gray-700 rounded h-12" />
)

// Billing Components
export const BillingDashboard = createLazyComponent(
  () => import('@/components/billing/BillingDashboard'),
  () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-700 rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-700 rounded-lg h-48" />
        ))}
      </div>
    </div>
  )
)

// AI Components
export const AIDashboard = createLazyComponent(
  () => import('@/components/ai/AIDashboard'),
  () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-700 rounded w-1/4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-700 rounded-lg h-32" />
        ))}
      </div>
    </div>
  )
)

// Social Components
export const SocialFeed = createLazyComponent(
  () => import('@/components/social/SocialFeed'),
  LoadingSkeletons.Social
)

export const ProfileSettings = createLazyComponent(
  () => import('@/components/profile/ProfileSettings'),
  LoadingSkeletons.Profile
)

// Trades Components
export const TradingAnalytics = createLazyComponent(
  () => import('@/components/trades/TradingAnalytics'),
  LoadingSkeletons.TradesList
)

export const RecentTrades = createLazyComponent(
  () => import('@/components/dashboard/RecentTrades'),
  () => (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 bg-gray-700 rounded w-1/3" />
      {[1, 2, 3].map(i => (
        <div key={i} className="flex items-center justify-between p-3 bg-gray-700 rounded">
          <div className="space-y-2">
            <div className="h-4 bg-gray-600 rounded w-24" />
            <div className="h-3 bg-gray-600 rounded w-16" />
          </div>
          <div className="w-16 h-6 bg-gray-600 rounded" />
        </div>
      ))}
    </div>
  )
)

// Calendar Components
export const TradingCalendar = createLazyComponent(
  () => import('@/components/dashboard/TradingCalendar'),
  () => (
    <div className="animate-pulse">
      <div className="bg-gray-700 rounded-lg h-80" />
    </div>
  )
)

// Performance intensive components that should definitely be lazy loaded
export const ChartComponents = {
  PerformanceChart: createLazyComponent(
    () => import('@/components/charts/PerformanceChart'),
    () => <div className="animate-pulse bg-gray-700 rounded h-64" />
  ),
  
  TradingChart: createLazyComponent(
    () => import('@/components/charts/TradingChart'),
    () => <div className="animate-pulse bg-gray-700 rounded h-48" />
  )
}

// Form Components (heavy with validation)
export const FormComponents = {
  TradeForm: createLazyComponent(
    () => import('@/components/trades/TradeForm'),
    () => (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/4" />
        <div className="h-10 bg-gray-700 rounded" />
        <div className="h-4 bg-gray-700 rounded w-1/4" />
        <div className="h-10 bg-gray-700 rounded" />
        <div className="h-10 bg-gray-700 rounded w-32" />
      </div>
    )
  )
}

// Modal Components (only load when needed)
export const ModalComponents = {
  TradeModal: createLazyComponent(
    () => import('@/components/trades/TradeModal'),
    () => (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md animate-pulse">
          <div className="space-y-4">
            <div className="h-6 bg-gray-700 rounded w-1/2" />
            <div className="h-32 bg-gray-700 rounded" />
            <div className="flex gap-3">
              <div className="h-10 bg-gray-700 rounded flex-1" />
              <div className="h-10 bg-gray-700 rounded flex-1" />
            </div>
          </div>
        </div>
      </div>
    )
  )
}

// Export all component categories
export {
  LoadingSkeletons
}