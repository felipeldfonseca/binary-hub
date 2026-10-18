'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AnalyticsLayout from '@/components/analytics/AnalyticsLayout'

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsLayout />
    </ProtectedRoute>
  )
}