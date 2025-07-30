'use client'
import React from 'react'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/dashboard/HeroSection'
import HeroSectionPT from '@/components/dashboard/HeroSectionPT'
import PerformanceSection from '@/components/dashboard/PerformanceSection'
import CalendarSection from '@/components/dashboard/CalendarSection'
import EventsSection from '@/components/dashboard/EventsSection'
import Footer from '@/components/layout/Footer'
import FooterPT from '@/components/layout/FooterPT'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function DashboardPage() {
  const { isPortuguese } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="relative">
        {isPortuguese ? <HeroSectionPT /> : <HeroSection />}
        <PerformanceSection />
        <CalendarSection />
        <EventsSection />
      </main>
      {isPortuguese ? <FooterPT /> : <Footer />}
    </div>
  )
} 