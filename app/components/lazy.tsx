'use client'
import React from 'react'
import LazyWrapper from '@/components/shared/LazyWrapper'

// Lazy-loaded dashboard components
export const DashboardV1Modern = React.lazy(() => import('@/components/dashboard/versions/DashboardV1Modern'))

// Lazy-loaded trades components  
export const TradesList = React.lazy(() => import('@/components/trades/TradesTable'))

// Lazy-loaded charts and analytics
export const RecentTrades = React.lazy(() => import('@/components/dashboard/RecentTrades'))
export const TradingCalendar = React.lazy(() => import('@/components/dashboard/TradingCalendar'))

// Lazy-loaded AI components
export const AIDashboard = React.lazy(() => import('@/components/ai/AIDashboard'))

// Lazy-loaded social components
export const SocialFeed = React.lazy(() => import('@/components/social/SocialFeed'))

// Lazy-loaded profile components
export const ProfileSettings = React.lazy(() => import('@/components/profile/ProfileSettings'))

// Lazy-loaded billing components
export const BillingDashboard = React.lazy(() => import('@/components/billing/BillingDashboard'))

// Loading skeletons for various components
export const LoadingSkeletons = {
  Dashboard: () => (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="h-32 bg-gray-700 rounded-lg"></div>
        <div className="h-32 bg-gray-700 rounded-lg"></div>
        <div className="h-32 bg-gray-700 rounded-lg"></div>
      </div>
      <div className="h-96 bg-gray-700 rounded-lg"></div>
      <div className="h-64 bg-gray-700 rounded-lg"></div>
    </div>
  ),
  
  TradesList: () => (
    <div className="animate-pulse space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-700 rounded-lg"></div>
      ))}
    </div>
  ),
  
  Charts: () => (
    <div className="animate-pulse">
      <div className="h-96 bg-gray-700 rounded-lg"></div>
    </div>
  ),
  
  General: () => (
    <div className="animate-pulse bg-gray-700 rounded-lg h-32"></div>
  )
}

// Wrapper components with built-in loading states
export function LazyDashboard(props: any) {
  return (
    <LazyWrapper fallback={<LoadingSkeletons.Dashboard />}>
      <DashboardV1Modern {...props} />
    </LazyWrapper>
  )
}

export function LazyTradesList(props: any) {
  return (
    <LazyWrapper fallback={<LoadingSkeletons.TradesList />}>
      <TradesList {...props} />
    </LazyWrapper>
  )
}

export function LazyCharts(props: any) {
  return (
    <LazyWrapper fallback={<LoadingSkeletons.Charts />}>
      <div {...props}>Chart content will be loaded here</div>
    </LazyWrapper>
  )
}