import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import HeroSectionPT from '@/components/dashboard/HeroSectionPT'
import HowItWorksSectionPT from '@/components/layout/HowItWorksSectionPT'
import MissionSectionPT from '@/components/layout/MissionSectionPT'
import KeyFeatureSectionPT from '@/components/layout/KeyFeatureSectionPT'
import PlansComparisonSectionPT from '@/components/layout/PlansComparisonSectionPT'
import SocialProofSectionPT from '@/components/layout/SocialProofSectionPT'
import FAQSection from '@/components/layout/FAQSection'
import CTASectionPT from '@/components/layout/CTASectionPT'
import FooterPT from '@/components/layout/FooterPT'
import PublicRoute from '@/components/auth/PublicRoute'

export default function HomePagePT() {
  return (
    <PublicRoute>
    <div className="min-h-screen bg-background">
        <Navbar />
        <main className="relative">
          <HeroSectionPT />
          <HowItWorksSectionPT />
          <MissionSectionPT />
          <KeyFeatureSectionPT />
          <PlansComparisonSectionPT />
          <SocialProofSectionPT />
          <FAQSection variant="landing" />
          <CTASectionPT />
        </main>
        <FooterPT />
    </div>
    </PublicRoute>
  )
} 