/**
 * Lazy-loaded component exports for optimal bundle splitting
 */
import React from 'react'

// Dashboard Components
export const DashboardV1Modern = React.lazy(
  () => import('@/components/dashboard/versions/DashboardV1Modern')
)

// Analytics Components
export const AnalyticsLayout = React.lazy(
  () => import('@/components/analytics/AnalyticsLayout')
)

export const AnalyticsVersionSelector = React.lazy(
  () => import('@/components/analytics/AnalyticsVersionSelector')
)

// Billing Components
export const BillingDashboard = React.lazy(
  () => import('@/components/billing/BillingDashboard')
)

// AI Components
export const AIDashboard = React.lazy(
  () => import('@/components/ai/AIDashboard')
)

// Social Components
export const SocialFeed = React.lazy(
  () => import('@/components/social/SocialFeed')
)

export const ProfileSettings = React.lazy(
  () => import('@/components/profile/ProfileSettings')
)

// Trades Components
export const TradingAnalytics = React.lazy(
  () => import('@/components/trades/TradingAnalytics')
)

export const RecentTrades = React.lazy(
  () => import('@/components/dashboard/RecentTrades')
)

// Calendar Components
export const TradingCalendar = React.lazy(
  () => import('@/components/dashboard/TradingCalendar')
)

// Performance intensive components that should definitely be lazy loaded
export const ChartComponents = {
  PerformanceChart: React.lazy(
    () => import('@/components/charts/PerformanceChart')
  ),
  
  TradingChart: React.lazy(
    () => import('@/components/charts/TradingChart')
  )
}

// Form Components (heavy with validation)
export const FormComponents = {
  TradeForm: React.lazy(
    () => import('@/components/trades/TradeForm')
  )
}

// Modal Components (only load when needed)
export const ModalComponents = {
  TradeModal: React.lazy(
    () => import('@/components/trades/TradeModal')
  )
}

// Loading Skeletons (simple fallback components)
export const LoadingSkeletons = {
  Dashboard: () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-gray-700 rounded w-1/3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-gray-700 rounded-lg h-48" />
        ))}
      </div>
    </div>
  ),
  Analytics: () => (
    <div className="animate-pulse bg-gray-700 rounded h-12" />
  ),
  Social: () => (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-700 rounded-lg h-32" />
      ))}
    </div>
  ),
  Profile: () => (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-700 rounded w-1/4" />
      <div className="h-32 bg-gray-700 rounded" />
    </div>
  ),
  TradesList: () => (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-gray-700 rounded h-16" />
      ))}
    </div>
  )
}