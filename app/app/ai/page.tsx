'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AILayout from '@/components/ai/AILayout'

export default function AIPage() {
  return (
    <ProtectedRoute>
      <AILayout />
    </ProtectedRoute>
  )
}