import PublicRoute from '../../components/auth/PublicRoute'
import Navbar from '../../components/layout/Navbar'

export default function AboutPage() {
  return (
    <PublicRoute>
      <div className="min-h-screen bg-background">
        {/* Navbar */}
        <Navbar />
        
        {/* Main Content */}
        <main className="pt-32 pb-16">
          <div className="container mx-auto px-4 sm:px-8 lg:px-12">
            <div className="max-w-4xl mx-auto">
              {/* Hero Section */}
              <div className="text-center mb-16">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                  About <span className="text-primary">Binary Hub</span>
                </h1>
                <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                  Empowering traders with intelligent insights and comprehensive journaling tools
                </p>
              </div>

              {/* Content Sections */}
              <div className="space-y-16">
                {/* Mission Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8">Our Mission</h2>
                  <p className="text-lg text-gray-300 leading-relaxed">
                    Binary Hub was created with a simple mission: to help traders make better decisions 
                    through comprehensive journaling, advanced analytics, and AI-powered insights. 
                    We believe that successful trading is not just about making the right trades, 
                    but about understanding your patterns, learning from your mistakes, and continuously improving.
                  </p>
                </section>

                {/* Features Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8">What We Offer</h2>
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Smart Journaling</h3>
                      <p className="text-gray-300">
                        Track your trades with intelligent forms that adapt to your trading style and 
                        capture all the details that matter for your analysis.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Advanced Analytics</h3>
                      <p className="text-gray-300">
                        Get deep insights into your trading performance with comprehensive charts, 
                        statistics, and performance metrics.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">AI Insights</h3>
                      <p className="text-gray-300">
                        Leverage artificial intelligence to identify patterns, suggest improvements, 
                        and get personalized trading recommendations.
                      </p>
                    </div>
                    <div className="bg-gray-800/50 p-6 rounded-lg">
                      <h3 className="text-xl font-semibold text-primary mb-4">Community Events</h3>
                      <p className="text-gray-300">
                        Connect with other traders, participate in events, and learn from the 
                        collective wisdom of the trading community.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Team Section */}
                <section>
                  <h2 className="text-3xl font-bold text-white mb-8">Our Team</h2>
                  <p className="text-lg text-gray-300 leading-relaxed">
                    Binary Hub is built by traders, for traders. Our team combines years of 
                    trading experience with cutting-edge technology to create tools that actually 
                    help you improve your trading performance.
                  </p>
                </section>
              </div>
            </div>
          </div>
        </main>
      </div>
    </PublicRoute>
  )
} 