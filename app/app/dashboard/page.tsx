'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import DashboardV1Modern from '@/components/dashboard/versions/DashboardV1Modern'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-7xl mx-auto">
              <DashboardV1Modern />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}