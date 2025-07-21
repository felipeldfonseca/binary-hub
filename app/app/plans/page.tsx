import PublicRoute from '../../components/auth/PublicRoute'
import Navbar from '../../components/layout/Navbar'

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
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-poly font-bold text-white mb-6">
                  Choose the plan that fits <span className="text-primary">your trading journey</span>
                </h1>
                <p className="text-xl font-montserrat font-semibold text-white max-w-3xl mx-auto">
                  <span className="text-primary">Start for free.</span> Unlock premium analytics whenever you’re ready.
                </p>
              </div>

              {/* Pricing Cards */}
              <div className="grid md:grid-cols-3 gap-8 mb-16">
                {/* Free Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4">Free</h3>
                    <div className="text-4xl font-bold text-primary mb-2">$0</div>
                    <p className="text-gray-400">Forever free</p>
                  </div>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Up to 50 trades per month
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Basic analytics
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Community access
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200">
                    Get Started
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-primary/10 p-8 rounded-lg border border-primary relative">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-dark-background px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4">Pro</h3>
                    <div className="text-4xl font-bold text-primary mb-2">$19</div>
                    <p className="text-gray-400">per month</p>
                  </div>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Unlimited trades
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Advanced analytics
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      AI insights
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Priority support
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Export data
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 bg-primary text-dark-background rounded-full hover:scale-105 transition-all duration-200 font-medium">
                    Start Free Trial
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4">Enterprise</h3>
                    <div className="text-4xl font-bold text-primary mb-2">Custom</div>
                    <p className="text-gray-400">Contact us</p>
                  </div>
                  <ul className="space-y-4 mb-8">
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Everything in Pro
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Custom integrations
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Dedicated support
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Team management
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Custom branding
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200">
                    Contact Sales
                  </button>
                </div>
              </div>
              <p className="text-base font-montserrat font-normal text-white text-center mb-12">
                Cancel anytime • No hidden fees
              </p>

              {/* FAQ Section */}
              <section className="text-center">
                <h2 className="text-3xl font-bold text-white mb-8">Frequently Asked Questions</h2>
                <div className="grid md:grid-cols-2 gap-8 text-left">
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Can I change plans anytime?</h3>
                    <p className="text-gray-300">
                      Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Is there a free trial?</h3>
                    <p className="text-gray-300">
                      Yes, we offer a 14-day free trial for the Pro plan. No credit card required to start.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">What payment methods do you accept?</h3>
                    <p className="text-gray-300">
                      We accept all major credit cards, PayPal, and bank transfers for enterprise plans.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-primary mb-4">Can I cancel anytime?</h3>
                    <p className="text-gray-300">
                      Absolutely. You can cancel your subscription at any time with no cancellation fees.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </PublicRoute>
  )
} 