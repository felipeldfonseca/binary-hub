'use client'
import React from 'react'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import LazyWrapper from '@/components/shared/LazyWrapper'

export default function DiscoverPage() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-6xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Discover Traders</h1>
                <p className="text-gray-400">Find and connect with successful binary options traders</p>
              </div>
              
              <LazyWrapper
                threshold={0.1}
                rootMargin="100px"
              >
                <div className="bg-gray-800/50 rounded-lg p-8 text-center">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white">User Discovery Coming Soon</h3>
                    <p className="text-gray-400 max-w-md mx-auto">
                      We're building an advanced trader discovery system with filters for trading style, 
                      performance metrics, and social activity.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center mt-6">
                      <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">Search by Performance</span>
                      <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">Filter by Strategy</span>
                      <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm">Social Rankings</span>
                    </div>
                  </div>
                </div>
              </LazyWrapper>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </ProtectedRoute>
  )
}