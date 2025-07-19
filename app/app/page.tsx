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
      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="font-heading text-3xl font-bold text-center mb-12">
            Funcionalidades Principais
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-text" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd"></path>
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold mb-2">Log Manual & CSV</h3>
              <p className="text-gray-600">
                Registre trades manualmente ou importe CSV da sua corretora. 
                Processo rápido e intuitivo.
              </p>
            </div>
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-text" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"></path>
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold mb-2">Dashboard & KPIs</h3>
              <p className="text-gray-600">
                Win Rate, P&L, streaks e métricas essenciais em um dashboard 
                limpo e focado nos dados.
              </p>
            </div>
            <div className="card text-center">
              <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-text" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"></path>
                </svg>
              </div>
              <h3 className="font-heading text-xl font-semibold mb-2">Calendário Heat-Map</h3>
              <p className="text-gray-600">
                Visualize sua performance diária com cores que indicam 
                lucro/prejuízo de forma intuitiva.
              </p>
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