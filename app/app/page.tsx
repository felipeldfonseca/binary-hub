import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/dashboard/HeroSection'
import HowItWorksSection from '@/components/layout/HowItWorksSection'
import MissionSection from '@/components/layout/MissionSection'
import KeyFeatureSection from '@/components/layout/KeyFeatureSection'
import PlansComparisonSection from '@/components/layout/PlansComparisonSection'
import SocialProofSection from '@/components/layout/SocialProofSection'
import FAQSection from '@/components/layout/FAQSection'
import PublicRoute from '@/components/auth/PublicRoute'

export default function HomePage() {
  return (
    <PublicRoute>
    <div className="min-h-screen bg-background">
        {/* Navbar (copied from dashboard, but with landing page CTAs) */}
        <Navbar />
        <main className="relative">
          {/* Hero Section (copied from dashboard) */}
          <HeroSection />
          
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
            className="bg-gray-800 text-primary px-8 py-3 text-lg font-normal rounded-full hover:bg-gray-700 transition-colors font-montserrat"
          >
            Register today for free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="flex items-center space-x-1">
                <div className="logo-poly font-normal text-primary">
                  binary
                </div>
                <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal" style={{fontSize: '23px'}}>
                  hub
                </div>
              </div>
            </div>
            <div className="flex space-x-6 text-sm text-gray-600">
              <Link href="/privacy" className="hover:text-primary transition-colors">
                Privacidade
              </Link>
              <Link href="/terms" className="hover:text-primary transition-colors">
                Termos
              </Link>
              <Link href="/support" className="hover:text-primary transition-colors">
                Suporte
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-center text-sm text-gray-600">
            <p>&copy; 2025 Binary Hub. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
      </main>
    </div>
    </PublicRoute>
  )
} 