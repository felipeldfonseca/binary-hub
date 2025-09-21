'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ProfileSettings } from '@/components/lazy'
import LazyWrapper from '@/components/shared/LazyWrapper'

export default function EditProfilePage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Edit Profile</h1>
                <p className="text-gray-400">Update your trading profile and social settings</p>
              </div>
              
              <LazyWrapper
                threshold={0.1}
                rootMargin="100px"
              >
                <ProfileSettings />
              </LazyWrapper>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}