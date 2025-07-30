'use client'
import PublicRoute from '../../components/auth/PublicRoute'
import Navbar from '../../components/layout/Navbar'
import FAQSection from '@/components/layout/FAQSection'
import CheckIcon from '@/components/icons/CheckIcon'
import XIcon from '@/components/icons/XIcon'
import Footer from '@/components/layout/Footer'
import FooterPT from '@/components/layout/FooterPT'
import { useLanguage } from '@/lib/contexts/LanguageContext'

export default function PlansPage() {
  const { isPortuguese } = useLanguage()

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
                  {isPortuguese 
                    ? 'Escolha o plano que impulsiona sua '
                    : 'Choose the plan that powers your '
                  }<span className="text-primary">
                    {isPortuguese ? 'jornada de trading' : 'trading journey'}
                  </span>
                </h1>
                <p className="text-xl font-comfortaa font-normal text-white max-w-3xl mx-auto">
                  {isPortuguese 
                    ? 'Comece grátis. Desbloqueie insights premium quando estiver pronto.'
                    : 'Start free. Unlock premium insights when you\'re ready.'
                  }
                </p>
              </div>

              {/* Pricing Cards */}
              <div className="grid lg:grid-cols-3 gap-8 mb-16">
                {/* Free Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">
                      {isPortuguese ? 'Gratuito' : 'Free'}
                    </h3>
                    <div className="text-4xl font-bold text-primary mb-2">$0</div>
                    <p className="text-gray-400">
                      {isPortuguese ? 'Sempre grátis' : 'Forever free'}
                    </p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* Available Features */}
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Registrar 100 operações / mês' : 'Record 100 trades / month'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Registro manual' : 'Manual journaling'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Importação CSV (Ebinex)' : 'CSV import (Ebinex)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'KPIs básicos (Taxa de Acerto, P&L Líquido, Resultado)' : 'Basic KPIs (Win Rate, Net P&L, Result)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Mapa de Performance' : 'Performance Heatmap'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Insights de IA semanais' : 'Weekly AI insights'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Calendário econômico: Eventos de alto impacto' : 'Economic calendar: High-impact events'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Exportação de dados: CSV' : 'Data export: CSV'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Suporte prioritário: Comunidade' : 'Priority support: Community'}
                    </li>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-600 my-4"></div>
                    
                    {/* Unavailable Features */}
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Integrações API' : 'API integrations'}
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Análises avançadas' : 'Advanced analytics'}
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'KPIs de estratégia' : 'Strategy KPIs'}
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Relatório Edge PDF' : 'Edge Report PDF'}
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Dashboards personalizados' : 'Custom dashboards'}
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Gestão de equipe' : 'Team management'}
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200 mt-auto">
                    {isPortuguese ? 'Começar' : 'Get Started'}
                  </button>
                </div>

                {/* Premium Plan */}
                <div className="bg-primary/10 p-8 rounded-lg border border-primary relative flex flex-col h-full">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-dark-background px-4 py-1 rounded-full text-sm font-medium">
                      {isPortuguese ? 'Mais Popular' : 'Most Popular'}
                    </span>
                  </div>
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">
                      {isPortuguese ? 'Premium' : 'Premium'}
                    </h3>
                    <div className="text-4xl font-bold text-primary mb-2">$97</div>
                    <p className="text-gray-400">
                      {isPortuguese ? 'por mês' : 'per month'}
                    </p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* Available Features */}
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Ilimitado' : 'Unlimited'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Registro manual' : 'Manual journaling'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Importação CSV (Ebinex)' : 'CSV import (Ebinex)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'KPIs básicos (Taxa de Acerto, P&L Líquido, Resultado)' : 'Basic KPIs (Win Rate, Net P&L, Result)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Análises avançadas' : 'Advanced analytics'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'KPIs de estratégia' : 'Strategy KPIs'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Mapa de Performance' : 'Performance Heatmap'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Insights de IA diários' : 'Daily AI insights'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Relatório Edge PDF' : 'Edge Report PDF'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Calendário econômico: Todos os eventos + filtros' : 'Economic calendar: All events + filters'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Dashboards personalizados: 2' : 'Custom dashboards: 2'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Exportação de dados: CSV · Excel · JSON' : 'Data export: CSV · Excel · JSON'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Suporte prioritário: Em 24h' : 'Priority support: Within 24h'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Teste gratuito: 14 dias' : 'Free trial: 14 days'}
                    </li>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-600 my-4"></div>
                    
                    {/* Unavailable Features */}
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Integrações API' : 'API integrations'}
                    </li>
                    <li className="flex items-center text-gray-500">
                      <XIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Gestão de equipe' : 'Team management'}
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 bg-primary text-dark-background rounded-full hover:scale-105 transition-all duration-200 font-medium mt-auto">
                    {isPortuguese ? 'Começar Teste Gratuito' : 'Start Free Trial'}
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">
                      {isPortuguese ? 'Enterprise' : 'Enterprise'}
                    </h3>
                    <div className="text-4xl font-bold text-primary mb-2">
                      {isPortuguese ? 'Personalizado' : 'Custom'}
                    </div>
                    <p className="text-gray-400">
                      {isPortuguese ? 'Entre em contato' : 'Contact Us'}
                    </p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* All Features Available */}
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Ilimitado + sincronização automática' : 'Unlimited + auto-sync'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Registro manual' : 'Manual journaling'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Importação CSV (Ebinex)' : 'CSV import (Ebinex)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'KPIs básicos (Taxa de Acerto, P&L Líquido, Resultado)' : 'Basic KPIs (Win Rate, Net P&L, Result)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Análises avançadas' : 'Advanced analytics'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'KPIs de estratégia' : 'Strategy KPIs'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Mapa de Performance' : 'Performance Heatmap'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Insights de IA em tempo real' : 'Real-time AI insights'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Relatório Edge PDF (white-label)' : 'Edge Report PDF (white-label)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Calendário econômico: Todos + alertas de equipe' : 'Economic calendar: All + team alerts'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Dashboards personalizados: Ilimitado' : 'Custom dashboards: Unlimited'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Gestão de equipe (10+ usuários)' : 'Team management (10+ users)'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Integrações API: Todos os corretores + personalizado' : 'API integrations: All brokers + custom'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Exportação de dados: API & Webhooks' : 'Data export: API & Webhooks'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Suporte prioritário: CSM dedicado' : 'Priority support: Dedicated CSM'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Marcação: Logotipo e cores personalizados' : 'Branding: Custom logo & colors'}
                    </li>
                    <li className="flex items-center text-gray-300">
                      <CheckIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                      {isPortuguese ? 'Teste gratuito: Projeto piloto' : 'Free trial: Pilot project'}
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200 mt-auto">
                    {isPortuguese ? 'Entre em contato' : 'Contact Us'}
                  </button>
                </div>
              </div>
              <p className="text-base font-comfortaa font-normal text-white text-center mb-12">
                {isPortuguese ? 'Cancele a qualquer momento • Sem taxas ocultas' : 'Cancel anytime • No hidden fees'}
              </p>

              {/* FAQ Section */}
              <FAQSection variant="plans" />
            </div>
          </div>
        </main>
        {isPortuguese ? <FooterPT /> : <Footer />}
      </div>
    </PublicRoute>
  )
} 