import PublicRoute from '../../../components/auth/PublicRoute'
import Navbar from '../../../components/layout/Navbar'
import FAQSection from '@/components/layout/FAQSection'

export default function PlansPagePT() {
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
                Escolha o plano que impulsiona <span className="text-primary">sua jornada de trading</span>
              </h1>
                <p className="text-xl font-montserrat font-semibold text-white max-w-3xl mx-auto">
                  <span className="text-primary">Comece grátis.</span> Desbloqueie análises premium quando estiver pronto.
                </p>
              </div>

              {/* Pricing Cards */}
              <div className="grid lg:grid-cols-3 gap-8 mb-16">
                {/* Free Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">Grátis</h3>
                    <div className="text-4xl font-bold text-primary mb-2">R$0</div>
                    <p className="text-gray-400">Sempre grátis</p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* Available Features */}
                                    <li className="flex items-center text-gray-300">
                  <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Registre 100 trades / mês
                </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Diário manual
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Importação CSV (Ebinex)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      KPIs básicos (Taxa de Acerto, P&L Líquido, Resultado)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Mapa de Calor de Performance
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Insights de IA Semanais
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Calendário econômico: Eventos de alto impacto
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Exportação de dados: CSV
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Suporte prioritário: Comunidade
                    </li>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-600 my-4"></div>
                    
                    {/* Unavailable Features */}
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Integrações API
                    </li>
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Análises avançadas
                    </li>
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      KPIs de estratégia
                    </li>
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Relatório Edge PDF
                    </li>
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Dashboards personalizados
                    </li>
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Gerenciamento de equipe
                    </li>

                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200 mt-auto">
                    Começar
                  </button>
                </div>

                {/* Premium Plan */}
                <div className="bg-primary/10 p-8 rounded-lg border border-primary relative flex flex-col h-full">
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary text-dark-background px-4 py-1 rounded-full text-sm font-medium">
                      Mais Popular
                    </span>
                  </div>
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">Premium</h3>
                    <div className="text-4xl font-bold text-primary mb-2">R$97</div>
                    <p className="text-gray-400">por mês</p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* Available Features */}
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Ilimitado
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Diário manual
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Importação CSV (Ebinex)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      KPIs básicos (Taxa de Acerto, P&L Líquido, Resultado)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Análises avançadas
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      KPIs de estratégia
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Mapa de Calor de Performance
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Insights de IA Diários
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Relatório Edge PDF
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Calendário econômico: Todos os eventos + filtros
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Dashboards personalizados: 2
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Exportação de dados: CSV · Excel · JSON
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Suporte prioritário: Em até 24h
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Teste gratuito: 14 dias
                    </li>
                    
                    {/* Divider */}
                    <div className="border-t border-gray-600 my-4"></div>
                    
                    {/* Unavailable Features */}
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Integrações API
                    </li>
                    <li className="flex items-center text-gray-500">
                      <svg className="w-5 h-5 text-gray-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Gerenciamento de equipe
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 bg-primary text-dark-background rounded-full hover:scale-105 transition-all duration-200 font-medium mt-auto">
                    Iniciar Teste Grátis
                  </button>
                </div>

                {/* Enterprise Plan */}
                <div className="bg-gray-800/50 p-8 rounded-lg border border-gray-700 flex flex-col h-full">
                  <div className="text-center mb-8">
                    <h3 className="text-2xl font-bold text-white mb-4 font-poly">Empresarial</h3>
                    <div className="text-2xl font-bold text-primary mb-2">Personalizado</div>
                    <p className="text-gray-400">Entre em Contato</p>
                  </div>
                  <ul className="space-y-4 mb-8 flex-1 ml-4 mr-4">
                    {/* All Features Available */}
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Ilimitado + sincronização automática
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Diário manual
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Importação CSV (Ebinex)
                    </li>

                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      KPIs básicos (Taxa de Acerto, P&L Líquido, Resultado)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Análises avançadas
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      KPIs de estratégia 
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Mapa de Calor de Performance
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Insights de IA em tempo real
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Relatório Edge PDF (white-label)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Calendário econômico: Todos + alertas da equipe
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Dashboards personalizados: Ilimitados
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Gerenciamento de equipe (10+ usuários)
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Integrações API: Todas as corretoras + personalizadas
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Exportação de dados: API & Webhooks
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Suporte prioritário: CSM dedicado
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Branding: Logo e cores personalizadas
                    </li>
                    <li className="flex items-center text-gray-300">
                      <svg className="w-5 h-5 text-primary mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Teste gratuito: Projeto piloto
                    </li>
                  </ul>
                  <button className="w-full py-3 px-6 border border-primary text-primary rounded-full hover:bg-primary hover:text-dark-background transition-all duration-200 mt-auto">
                    Entre em Contato
                  </button>
                </div>
              </div>
              <p className="text-base font-montserrat font-normal text-white text-center mb-12">
                Cancele a qualquer momento • Sem taxas ocultas
              </p>

              {/* FAQ Section */}
              <FAQSection variant="plans" />
            </div>
          </div>
        </main>
      </div>
    </PublicRoute>
  )
} 