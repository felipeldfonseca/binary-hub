'use client'
import { useState } from 'react'

export default function MultiMarketShowcase() {
  const [activeMarket, setActiveMarket] = useState('binary')

  const markets = [
    {
      id: 'binary',
      name: 'Binary Options',
      description: 'Onde tudo começou',
      details: 'Análise honesta da matemática, gestão de risco, e transição para mercados sustentáveis',
      features: ['Análise de R:R', 'Gestão emocional', 'Timing de entrada', 'Evolução gradual'],
      color: 'from-orange-500 to-red-500',
      icon: '📊'
    },
    {
      id: 'forex',
      name: 'Forex',
      description: 'O mercado mais líquido',
      details: 'Análise técnica avançada, correlações de pares, e estratégias de swing trading',
      features: ['Análise de pares', 'Gerenciamento de posição', 'News trading', 'Scalping/Swing'],
      color: 'from-blue-500 to-cyan-500',
      icon: '💱'
    },
    {
      id: 'crypto',
      name: 'Cryptocurrency',
      description: 'Mercados 24/7',
      details: 'Volatilidade extrema, DeFi, análise on-chain e estratégias de HODLing',
      features: ['Análise on-chain', 'Volatilidade', 'DeFi strategies', 'Portfolio management'],
      color: 'from-purple-500 to-pink-500',
      icon: '₿'
    },
    {
      id: 'futures',
      name: 'Futures',
      description: 'Mercados profissionais',
      details: 'Contratos futuros, commodities, índices e gestão de margem avançada',
      features: ['Contratos futuros', 'Gestão de margem', 'Commodities', 'Índices'],
      color: 'from-green-500 to-emerald-500',
      icon: '📈'
    },
    {
      id: 'options',
      name: 'Options',
      description: 'Estratégias sofisticadas',
      details: 'Greeks, volatilidade implícita, estratégias multi-leg e income generation',
      features: ['Greeks analysis', 'Volatilidade', 'Multi-leg strategies', 'Income generation'],
      color: 'from-yellow-500 to-orange-500',
      icon: '🎯'
    }
  ]

  return (
    <section className="py-20 bg-gradient-to-b from-gray-900/50 to-transparent">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="font-poly text-3xl font-bold text-white mb-4">
            Todos os Mercados. <span className="text-primary">Uma Plataforma.</span>
          </h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Seja qual for seu mercado preferido, nossa IA campeã e comunidade especializada 
            ajudam você a evoluir suas habilidades de trading.
          </p>
        </div>

        {/* Market Selection */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {markets.map((market) => (
            <button
              key={market.id}
              onClick={() => setActiveMarket(market.id)}
              className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
                activeMarket === market.id
                  ? 'bg-primary text-gray-800 scale-105'
                  : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/60'
              }`}
            >
              <span className="mr-2">{market.icon}</span>
              {market.name}
            </button>
          ))}
        </div>

        {/* Market Details */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Market Info */}
          <div className="space-y-6">
            {markets
              .filter(market => market.id === activeMarket)
              .map((market) => (
                <div key={market.id} className="animate-fade-in">
                  <div className="flex items-center mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${market.color} flex items-center justify-center text-white text-2xl mr-4`}>
                      {market.icon}
                    </div>
                    <div>
                      <h3 className="font-poly text-2xl font-bold text-white">{market.name}</h3>
                      <p className="text-primary font-medium">{market.description}</p>
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                    {market.details}
                  </p>

                  <div className="grid md:grid-cols-2 gap-4">
                    {market.features.map((feature, index) => (
                      <div key={index} className="flex items-center text-gray-300">
                        <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>

          {/* AI Analysis Preview */}
          <div className="bg-gray-800/30 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="font-semibold text-white">IA Especializada por Mercado</h4>
            </div>
            
            <div className="bg-gray-900/50 rounded p-4 mb-4">
              <div className="text-primary font-medium mb-2">Análise Cross-Market:</div>
              {activeMarket === 'binary' && (
                <p className="text-sm text-gray-300">
                  "Sua disciplina em binary options pode ser aplicada em forex com melhor R:R. 
                  Considere EUR/USD com timeframes maiores."
                </p>
              )}
              {activeMarket === 'forex' && (
                <p className="text-sm text-gray-300">
                  "Padrão de suporte/resistência identificado funciona bem em crypto. 
                  BTC/USDT mostra correlação similar ao EUR/USD."
                </p>
              )}
              {activeMarket === 'crypto' && (
                <p className="text-sm text-gray-300">
                  "Volatilidade de crypto pode ser gerenciada com técnicas de forex. 
                  Aplicar stop-loss percentual constante."
                </p>
              )}
              {activeMarket === 'futures' && (
                <p className="text-sm text-gray-300">
                  "Gestão de risco em futures é similar a forex, mas com leverage maior. 
                  Adaptar position sizing proporcionalmente."
                </p>
              )}
              {activeMarket === 'options' && (
                <p className="text-sm text-gray-300">
                  "Timing de entrada em options pode usar análise técnica de forex. 
                  Greeks adicionar camada de sofisticação."
                </p>
              )}
            </div>

            <div className="flex items-center text-sm text-gray-400">
              <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Powered by Qwen3 Max & DeepSeek V3 (campeões em competições)
            </div>
          </div>
        </div>

        {/* Cross-Market Learning CTA */}
        <div className="mt-16 text-center">
          <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-lg p-8">
            <h3 className="font-poly text-2xl font-bold text-white mb-4">
              Aprenda Através dos Mercados
            </h3>
            <p className="text-gray-300 max-w-2xl mx-auto mb-6">
              Skills de um mercado fortalecem performance em outros. 
              Nossa IA identifica transferências de conhecimento personalizadas para seu perfil.
            </p>
            <button className="bg-primary text-gray-800 px-8 py-3 rounded-full font-bold hover:bg-primary/90 transition-colors">
              Descobrir Conexões entre Mercados
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}