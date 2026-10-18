'use client'
import React from 'react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AnalyticsV1Professional from './versions/AnalyticsV1Professional'

export default function AnalyticsLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative pt-32 pb-16">
        <div className="container mx-auto px-4 sm:px-8 lg:px-12">
          <div className="max-w-7xl mx-auto">
            <AnalyticsV1Professional />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
