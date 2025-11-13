'use client'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PublicRoute from '@/components/auth/PublicRoute'
import LandingPageAnimatedV1 from '@/components/layout/versions/LandingPageAnimatedV1'

export default function HomePage() {
  return (
    <PublicRoute>
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <Navbar />
        
        <main className="relative">
          {/* Performance Animated Landing Page */}
          <LandingPageAnimatedV1 />
        </main>
        
        <Footer />
      </div>
    </PublicRoute>
  )
} 