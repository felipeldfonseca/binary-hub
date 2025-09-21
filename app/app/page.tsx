'use client'
import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import PublicRoute from '@/components/auth/PublicRoute'
import { useLanguage } from '@/lib/contexts/LanguageContext'
import VersionSelector, { LandingVersion } from '@/components/layout/VersionSelector'

// Import landing page versions
import LandingPageAnimatedV1 from '@/components/layout/versions/LandingPageAnimatedV1'

// Import fallback components for missing versions
import LandingHeroSection from '@/components/layout/LandingHeroSection'
import LandingHeroSectionPT from '@/components/layout/LandingHeroSectionPT'
import HowItWorksSection from '@/components/layout/HowItWorksSection'
import HowItWorksSectionPT from '@/components/layout/HowItWorksSectionPT'
import MissionSection from '@/components/layout/MissionSection'
import MissionSectionPT from '@/components/layout/MissionSectionPT'
import KeyFeatureSection from '@/components/layout/KeyFeatureSection'
import KeyFeatureSectionPT from '@/components/layout/KeyFeatureSectionPT'
import PlansComparisonSection from '@/components/layout/PlansComparisonSection'
import PlansComparisonSectionPT from '@/components/layout/PlansComparisonSectionPT'
import CommunityFeaturesSection from '@/components/layout/CommunityFeaturesSection'
import SocialProofSection from '@/components/layout/SocialProofSection'
import SocialProofSectionPT from '@/components/layout/SocialProofSectionPT'
import FAQSection from '@/components/layout/FAQSection'

export default function HomePage() {
  const { isPortuguese } = useLanguage()
  const [currentVersion, setCurrentVersion] = useState<LandingVersion>('animated-v1')

  const renderLandingPage = () => {
    switch (currentVersion) {
      case 'animated-v1':
        return <LandingPageAnimatedV1 />
      case 'original':
      default:
        // Original component structure
        return (
          <>
            {/* Hero Section - Language-aware */}
            {isPortuguese ? <LandingHeroSectionPT /> : <LandingHeroSection />}
            
            {/* How It Works Section */}
            {isPortuguese ? <HowItWorksSectionPT /> : <HowItWorksSection />}
            
            {/* Mission Section */}
            {isPortuguese ? <MissionSectionPT /> : <MissionSection />}
            
            {/* Key Feature Section */}
            {isPortuguese ? <KeyFeatureSectionPT /> : <KeyFeatureSection />}
            
            {/* Community Features Section */}
            <CommunityFeaturesSection />
            
            {/* Plans Comparison Section */}
            {isPortuguese ? <PlansComparisonSectionPT /> : <PlansComparisonSection />}

            {/* Social Proof Section */}
            {isPortuguese ? <SocialProofSectionPT /> : <SocialProofSection />}

            {/* FAQ Section */}
            <FAQSection variant="landing" />

            {/* CTA Section */}
            <section className="py-20 bg-primary">
              <div className="container mx-auto px-4 text-center">
                <h2 className="font-poly text-3xl font-bold text-gray-600 mb-2">
                  {isPortuguese ? 'Pare de adivinhar.' : 'Stop guessing.'}
                </h2>
                <h2 className="font-poly text-3xl font-bold text-gray-600 mb-8">
                  {isPortuguese ? 'Comece a operar com dados.' : 'Start trading with data.'}
                </h2>
                <Link 
                  href="/auth/register" 
                  className="bg-gray-800 text-primary px-8 py-3 text-lg font-comfortaa font-bold rounded-full hover:bg-gray-700 transition-colors"
                >
                  {isPortuguese ? 'Registre-se hoje gratuitamente' : 'Register today for free'}
                </Link>
              </div>
            </section>
          </>
        )
    }
  }

  return (
    <PublicRoute>
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <Navbar />
        
        <main className="relative">
          {/* Version Selector */}
          <div className="bg-gray-900 py-8">
            <div className="container mx-auto px-4">
              <VersionSelector 
                currentVersion={currentVersion}
                onVersionChange={setCurrentVersion}
              />
            </div>
          </div>
          
          {/* Render Selected Landing Page Version */}
          {renderLandingPage()}
        </main>
        
        <Footer />
      </div>
    </PublicRoute>
  )
} 