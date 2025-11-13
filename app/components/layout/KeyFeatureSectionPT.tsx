import Link from 'next/link'

export default function KeyFeatureSectionPT() {
  return (
    <section className="py-20 bg-gradient-to-b from-gray-900/30 to-transparent">
      <div className="container mx-auto px-4">
        {/* AI Reports Feature */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="font-poly text-4xl font-bold text-text mb-4">
              Relatórios de IA <span className="text-primary">Revolucionários</span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Análises profundas e personalizadas utilizando os modelos de IA mais avançados do mercado
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-12">
            {/* Daily Analysis Card */}
            <div className="group">
              <div className="card p-6 bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <div className="relative overflow-hidden">
                  {/* Animated Background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Icon with Pulse Animation */}
                  <div className="relative w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse"></div>
                    <svg className="relative z-10 w-7 h-7 text-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 2C8.4 2 8 2.4 8 3s.4 1 1 1 1-.4 1-1-.4-1-1-1zM9 8c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM9 14c-.6 0-1 .4-1 1s.4 1 1 1 1-.4 1-1-.4-1-1-1zM21 13.1c-.1 0-.3.1-.4.2l-1 .9c0-.1-.1-.2-.1-.2l.5-1.1c.2-.4.1-.9-.3-1.2s-.9-.1-1.2.3l-.5 1.1c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1c-.1 0-.2-.1-.2-.1l1.1-.5c.4-.2.5-.7.3-1.2-.2-.4-.7-.5-1.2-.3l-1.1.5c0-.1-.1-.2-.2-.1l1-.9c.3-.4.3-.9-.1-1.2-.4-.3-.9-.3-1.2.1l-1 .9c0-.1-.1-.2-.2-.1l.5-1.1c.2-.4.1-.9-.3-1.2-.4-.2-.9-.1-1.2.3l-.5 1.1c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1c-.1 0-.2-.1-.2-.1l1.1-.5c.4-.2.5-.7.3-1.2-.2-.4-.7-.5-1.2-.3L3.9 4.6c0-.1-.1-.2-.2-.1l1-.9c.3-.4.3-.9-.1-1.2-.4-.3-.9-.3-1.2.1L2.5 3.4c0-.1-.1-.2-.2-.1l.5-1.1c.2-.4.1-.9-.3-1.2-.4-.2-.9-.1-1.2.3L.8 2.4c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1C-.9 1.2-1 1.2-1 1.3l1.1-.5c.4-.2.5-.7.3-1.2-.2-.4-.7-.5-1.2-.3L-2.9.8c0-.1-.1-.2-.2-.1l1-.9c.3-.4.3-.9-.1-1.2-.4-.3-.9-.3-1.2.1L-4.3.6c0-.1-.1-.2-.2-.1l.5-1.1c.2-.4.1-.9-.3-1.2-.4-.2-.9-.1-1.2.3L-6 0c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1c-.1 0-.2-.1-.2-.1L-8.7-2c.4-.2.5-.7.3-1.2-.2-.4-.7-.5-1.2-.3l-1.1.5c0-.1-.1-.2-.2-.1l1-.9c.3-.4.3-.9-.1-1.2-.4-.3-.9-.3-1.2.1l-1 .9c0-.1-.1-.2-.2-.1l.5-1.1c.2-.4.1-.9-.3-1.2-.4-.2-.9-.1-1.2.3l-.5 1.1c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1c-.1 0-.2-.1-.2-.1l1.1-.5c.4-.2.5-.7.3-1.2-.2-.4-.7-.5-1.2-.3l-1.1.5c0-.1-.1-.2-.2-.1l1-.9c.3-.4.3-.9-.1-1.2-.4-.3-.9-.3-1.2.1l-1 .9c0-.1-.1-.2-.2-.1l.5-1.1c.2-.4.1-.9-.3-1.2-.4-.2-.9-.1-1.2.3l-.5 1.1c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1c-.1 0-.2-.1-.2-.1l1.1-.5c.4-.2.5-.7.3-1.2-.2-.4-.7-.5-1.2-.3l-1.1.5c0-.1-.1-.2-.2-.1l1-.9c.3-.4.3-.9-.1-1.2-.4-.3-.9-.3-1.2.1l-1 .9c0-.1-.1-.2-.2-.1l.5-1.1c.2-.4.1-.9-.3-1.2-.4-.2-.9-.1-1.2.3l-.5 1.1c-.1 0-.2-.1-.2-.1l.9-1c.3-.4.2-.9-.2-1.2-.4-.3-.9-.2-1.2.2l-.9 1c-.1 0-.2-.1-.2-.1L21 13.1z"/>
                    </svg>
                  </div>
                  
                  <h3 className="font-poly text-xl font-bold text-white mb-3">Análise Diária Inteligente</h3>
                  <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                    Relatórios automáticos todas as manhãs com insights profundos sobre seu desempenho e mercado.
                  </p>
                  
                  {/* Feature Tags */}
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">GPT-4o</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">Automático</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pattern Detection Card */}
            <div className="group">
              <div className="card p-6 bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  <div className="relative w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse"></div>
                    <svg className="relative z-10 w-7 h-7 text-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 6L12 10.5 8.5 8 12 5.5 15.5 8zM8.5 16L12 13.5 15.5 16 12 18.5 8.5 16z"/>
                    </svg>
                  </div>
                  
                  <h3 className="font-poly text-xl font-bold text-white mb-3">Detecção de Padrões</h3>
                  <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                    Identificação automática de padrões comportamentais e oportunidades de melhoria em tempo real.
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">ML Avançado</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">Tempo Real</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Insights Card */}
            <div className="group">
              <div className="card p-6 bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-primary/20 hover:border-primary/40 transition-all duration-300 hover:scale-105">
                <div className="relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  <div className="relative w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                    <div className="absolute inset-0 bg-primary/20 rounded-xl animate-pulse"></div>
                    <svg className="relative z-10 w-7 h-7 text-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                    </svg>
                  </div>
                  
                  <h3 className="font-poly text-xl font-bold text-white mb-3">Insights de Performance</h3>
                  <p className="text-gray-300 text-sm mb-4 leading-relaxed">
                    Métricas avançadas e recomendações personalizadas para otimizar sua estratégia de trading.
                  </p>
                  
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">Personalizado</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full border border-primary/20">Acionável</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Models Showcase */}
          <div className="card p-8 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-primary/30">
            <div className="text-center mb-8">
              <h3 className="font-poly text-2xl font-bold text-primary mb-4">Tecnologia de Ponta</h3>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Utilizamos os modelos de IA mais avançados para diferentes tipos de análise, garantindo máxima precisão e eficiência
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full mb-4">
                  <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">GPT-4o (OpenAI)</h4>
                <p className="text-gray-400 text-sm">Para análises individuais profundas e recomendações detalhadas</p>
              </div>
              
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full mb-4">
                  <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Gemini 2.5 Flash (Google)</h4>
                <p className="text-gray-400 text-sm">Para relatórios diários automáticos rápidos e eficientes</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 