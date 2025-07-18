import React from 'react'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/dashboard/HeroSection'
import PerformanceSection from '@/components/dashboard/PerformanceSection'
import CalendarSection from '@/components/dashboard/CalendarSection'
import EventsSection from '@/components/dashboard/EventsSection'
import Footer from '@/components/layout/Footer'

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative">
        <HeroSection />
        <PerformanceSection />
        <CalendarSection />
        <EventsSection />
      </main>
      <Footer />
    </div>
  )
} 