'use client'
import React from 'react'
import { useParams } from 'next/navigation'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PublicProfile from '@/components/social/PublicProfile'
import LazyWrapper from '@/components/shared/LazyWrapper'

export default function PublicProfilePage() {
  const params = useParams()
  const username = params.username as string

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-6xl mx-auto">
              <LazyWrapper
                threshold={0.1}
                rootMargin="100px"
              >
                <PublicProfile username={username} />
              </LazyWrapper>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}