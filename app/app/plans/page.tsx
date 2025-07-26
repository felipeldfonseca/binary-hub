import PublicRoute from '../../components/auth/PublicRoute'
import Navbar from '../../components/layout/Navbar'
import FAQSection from '@/components/layout/FAQSection'
import CheckIcon from '@/components/icons/CheckIcon'
import XIcon from '@/components/icons/XIcon'
import Footer from '@/components/layout/Footer'

export default function PlansPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <Navbar />

        {/* Main Content */}
        <main className="pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-6xl mx-auto">
              {/* Hero Section */}
              <div className="text-center mb-16">
                <h1 className="hero-title text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
                  Choose the plan that powers your <span className="text-primary">trading journey</span>
                </h1>
                <p className="text-xl font-montserrat font-normal text-white max-w-3xl mx-auto">
                  <span className="text-primary">Start free.</span> Unlock premium insights when you're ready.
                </p>
              </div>

              {/* Pricing Cards */}
              <div className="grid lg:grid-cols-3 gap-8 mb-16">
                {/* Free Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">Free</h3>
                    <div className="text-4xl font-bold text-primary mb-2">$0</div>
                    <p className="text-gray-400">Forever free</p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* Available Features */}
                                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Record 100 trades / month
                </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Manual journaling
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      CSV import (Ebinex)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Basic KPIs (Win Rate, Net P&L, Result)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Performance Heatmap
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Weekly AI insights
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Economic calendar: High-impact events
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Data export: CSV
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Priority support: Community
                    </li>

                    {/* Divider */}
                    <div className="border-t border-gray-600 my-4"></div>

                    {/* Unavailable Features */}
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      API integrations
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Advanced analytics
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Strategy KPIs
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Edge Report PDF
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Custom dashboards
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Team management
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200 mt-auto">
                    Get Started
                  </button>
                </div>

                {/* Premium Plan */}
                <div className="bg-primary/10 p-8 rounded-lg border border-primary relative flex flex-col h-full">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-dark-background px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">Premium</h3>
                    <div className="text-4xl font-bold text-primary mb-2">$97</div>
                    <p className="text-gray-400">per month</p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* Available Features */}
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Unlimited
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Manual journaling
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      CSV import (Ebinex)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Basic KPIs (Win Rate, Net P&L, Result)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Advanced analytics
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Strategy KPIs
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Performance Heatmap
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Daily AI insights
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Edge Report PDF
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Economic calendar: All events + filters
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Custom dashboards: 2
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Data export: CSV · Excel · JSON
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Priority support: Within 24h
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Free trial: 14 days
                    </li>

                    {/* Divider */}
                    <div className="border-t border-gray-600 my-4"></div>

                    {/* Unavailable Features */}
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      API integrations
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Team management
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 bg-primary text-dark-background rounded-full hover:scale-105 transition-all duration-200 font-medium mt-auto">
                    Start Free Trial
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">Enterprise</h3>
                    <div className="text-4xl font-bold text-primary mb-2">Custom</div>
                    <p className="text-gray-400">Contact Us</p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* All Features Available */}
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Unlimited + auto-sync
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Manual journaling
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      CSV import (Ebinex)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Basic KPIs (Win Rate, Net P&L, Result)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Advanced analytics
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Strategy KPIs
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Performance Heatmap
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Real-time AI insights
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Edge Report PDF (white-label)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Economic calendar: All + team alerts
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Custom dashboards: Unlimited
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Team management (10+ users)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      API integrations: All brokers + custom
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Data export: API & Webhooks
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Priority support: Dedicated CSM
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Branding: Custom logo & colors
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      Free trial: Pilot project
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200 mt-auto">
                    Contact Us
                  </button>
                </div>
              </div>
              <p className="text-base font-montserrat font-normal text-white text-center mb-12">
                Cancel anytime • No hidden fees
              </p>

              {/* FAQ Section */}
              <FAQSection variant="plans" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </PublicRoute>
  )
} 