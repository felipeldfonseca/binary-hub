import Link from 'next/link'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/dashboard/HeroSection'
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
          <section id="how-it-works" className="py-20">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Card 1: Connect & Import */}
                <div className="bg-gray-50 rounded-lg p-6 flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">Connect & Import</h3>
                    <p className="text-gray-600 text-sm">Upload a CSV or record trades in seconds.</p>
                  </div>
                </div>

                {/* Card 2: Analyze your trades */}
                <div className="bg-gray-50 rounded-lg p-6 flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">Analyze your trades</h3>
                    <p className="text-gray-600 text-sm">Automatic KPIs and charts adjusted to your period.</p>
                  </div>
                </div>

                {/* Card 3: Improve */}
                <div className="bg-gray-50 rounded-lg p-6 flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-1">Improve</h3>
                    <p className="text-gray-600 text-sm">AI reveals patterns and sends comprehensive reports.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-heading text-3xl font-bold text-text mb-6">
            Pronto para elevar sua disciplina?
          </h2>
          <p className="text-xl text-text mb-8 max-w-2xl mx-auto">
            Junte-se a traders que já estão usando dados para tomar decisões mais inteligentes.
          </p>
          <Link 
            href="/auth/register" 
            className="bg-text text-primary px-8 py-3 text-lg font-medium rounded-lg hover:bg-gray-800 transition-colors"
          >
            Começar Grátis Agora
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