import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import LandingHeroSection from '@/components/layout/LandingHeroSection'
import HowItWorksSection from '@/components/layout/HowItWorksSection'
import MissionSection from '@/components/layout/MissionSection'
import KeyFeatureSection from '@/components/layout/KeyFeatureSection'
import PlansComparisonSection from '@/components/layout/PlansComparisonSection'
import SocialProofSection from '@/components/layout/SocialProofSection'
import FAQSection from '@/components/layout/FAQSection'
import Footer from '@/components/layout/Footer'
import PublicRoute from '@/components/auth/PublicRoute'

export default function HomePage() {
  return (
    <PublicRoute>
    <div className="min-h-screen bg-background">
        {/* Navbar (copied from dashboard, but with landing page CTAs) */}
        <Navbar />
        <main className="relative">
          {/* Hero Section - Landing page specific */}
          <LandingHeroSection />
          
          {/* How It Works Section */}
          <HowItWorksSection />
          
          {/* Mission Section */}
          <MissionSection />
          
          {/* Key Feature Section */}
          <KeyFeatureSection />
          
          {/* Plans Comparison Section */}
          <PlansComparisonSection />

          {/* Social Proof Section */}
          <SocialProofSection />

          {/* FAQ Section */}
          <FAQSection variant="landing" />

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-poly text-3xl font-bold text-gray-600 mb-2">
            Stop guessing.
          </h2>
          <h2 className="font-poly text-3xl font-bold text-gray-600 mb-8">
            Start trading with data.
          </h2>
          <Link 
            href="/auth/register" 
            className="bg-gray-800 text-primary px-8 py-3 text-lg font-comfortaa font-bold rounded-full hover:bg-gray-700 transition-colors"
          >
            Register today for free
          </Link>
        </div>
      </section>
        </main>
        <Footer />
    </div>
    </PublicRoute>
  )
} 