'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function LandingHeroSection() {
  const router = useRouter()
  const [socialProofCount, setSocialProofCount] = useState(247)
  const [recentActivity, setRecentActivity] = useState("5 traders registrados hoje")
  const [showDemo, setShowDemo] = useState(false)

  // Simulated real-time social proof updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSocialProofCount(prev => prev + Math.floor(Math.random() * 3))
      const activities = [
        "3 traders registrados nos últimos 10 min",
        "Análise AI gerada há 2 min",
        "Nova conexão criada agora",
        "2 insights compartilhados hoje"
      ]
      setRecentActivity(activities[Math.floor(Math.random() * activities.length)])
    }, 8000)

    return () => clearInterval(interval)
  }, [])

  return (
    <section className="w-full min-h-[70vh] flex items-center pt-20 sm:pt-24 lg:pt-28 relative overflow-hidden">
      {/* Background Animation */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-2 h-2 bg-primary rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-20 w-1 h-1 bg-primary rounded-full animate-ping delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-1.5 h-1.5 bg-primary rounded-full animate-pulse delay-2000"></div>
      </div>

      <div className="container mx-auto px-4 flex flex-col items-center text-center relative z-10">
        {/* Real-time Social Proof */}
        <div className="mb-6 flex items-center gap-4 text-sm text-gray-300 bg-gray-800/40 px-4 py-2 rounded-full backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="font-medium text-green-400">{socialProofCount}</span>
            <span>traders ativos</span>
          </div>
          <div className="w-px h-4 bg-gray-600"></div>
          <span className="animate-fade-in">{recentActivity}</span>
        </div>

        <h1 className="hero-title font-poly font-normal mb-6 sm:mb-8 leading-tight">
          <span className="text-primary block text-[clamp(2rem,5vw,4rem)] animate-slide-up">
            A Plataforma Definitiva para
          </span>
          <span className="text-white block text-[clamp(2rem,5vw,4rem)] animate-slide-up delay-200">
            Evolução em Trading
          </span>
        </h1>

        {/* Multi-Market Value Proposition */}
        <div className="hero-description mb-8 sm:mb-10 lg:mb-12 max-w-4xl">
          <p className="text-white text-[clamp(1rem,2.5vw,1.5rem)] leading-relaxed mb-4 animate-fade-in delay-400">
            <span className="text-primary font-semibold">IA vencedora de competições</span> analisa todos os mercados: Opções Binárias, Forex, Crypto, Futuros.
          </p>
          <p className="text-white text-[clamp(1rem,2.5vw,1.5rem)] leading-relaxed animate-fade-in delay-600">
            <span className="text-primary font-semibold">Comunidade multi-mercado</span> conecta traders para aprendizado colaborativo.
          </p>
        </div>
        
        {/* Multi-Market Value Highlights */}
        <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-gray-300">
          <div className="bg-gray-800/50 px-4 py-2 rounded-full hover:bg-gray-700/60 transition-all cursor-pointer group">
            <span className="group-hover:text-primary transition-colors">IA Campeã em Competições</span>
            <div className="group-hover:block hidden absolute mt-2 p-2 bg-gray-800 rounded text-xs max-w-xs z-20">
              Modelos que ganharam +117% em competições reais de trading
            </div>
          </div>
          <div className="bg-gray-800/50 px-4 py-2 rounded-full hover:bg-gray-700/60 transition-all cursor-pointer group">
            <span className="group-hover:text-primary transition-colors">Todos os Mercados</span>
            <div className="group-hover:block hidden absolute mt-2 p-2 bg-gray-800 rounded text-xs max-w-xs z-20">
              Binary Options, Forex, Crypto, Futuros - tudo em uma plataforma
            </div>
          </div>
          <div className="bg-gray-800/50 px-4 py-2 rounded-full hover:bg-gray-700/60 transition-all cursor-pointer group">
            <span className="group-hover:text-primary transition-colors">Aprendizado Colaborativo</span>
            <div className="group-hover:block hidden absolute mt-2 p-2 bg-gray-800 rounded text-xs max-w-xs z-20">
              Traders de diferentes mercados compartilhando conhecimento
            </div>
          </div>
        </div>

        {/* Progressive Commitment Ladder */}
        <div className="flex flex-col items-center space-y-4 mb-8">
          {/* Primary CTA with Urgency */}
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button 
              onClick={() => router.push('/auth/register')}
              className="btn-primary font-comfortaa font-bold transition-all duration-300 hover:scale-105 text-lg px-8 py-4 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2 relative overflow-hidden group"
            >
              <span className="relative z-10">Começar Gratuitamente</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>
            
            {/* Secondary CTA - Demo */}
            <button 
              onClick={() => setShowDemo(!showDemo)}
              className="px-8 py-4 rounded-full border border-primary text-primary bg-transparent font-comfortaa font-bold text-lg transition-all duration-200 hover:bg-primary/10 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2"
            >
              Ver Demo IA ao Vivo
            </button>
          </div>

          {/* Trust Signals */}
          <div className="text-xs text-gray-400 flex items-center gap-4 mt-4">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              100% Grátis para começar
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Sem cartão de crédito
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Setup em 2 minutos
            </span>
          </div>
        </div>

        {/* Multi-Market AI Demo Preview */}
        {showDemo && (
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-6 max-w-2xl mx-auto mt-8 animate-slide-down">
            <div className="text-center mb-4">
              <h3 className="text-primary font-semibold mb-4">Preview: IA Campeã Analisando Multi-Mercados</h3>
              <div className="grid md:grid-cols-2 gap-4 text-left text-sm">
                <div className="bg-gray-900/50 rounded p-4">
                  <div className="text-primary font-bold mb-2">Forex (EUR/USD)</div>
                  <div className="text-green-400 mb-1">✓ Win rate 23% maior em horários de Londres</div>
                  <div className="text-blue-400">💡 Skill transferível para GBP/USD</div>
                </div>
                <div className="bg-gray-900/50 rounded p-4">
                  <div className="text-primary font-bold mb-2">Crypto (BTC/USDT)</div>
                  <div className="text-green-400 mb-1">✓ Padrão de volatilidade identificado</div>
                  <div className="text-blue-400">💡 Mesma disciplina do forex aplicável</div>
                </div>
              </div>
              <div className="bg-gray-900/30 rounded p-3 mt-4 text-yellow-400 text-sm">
                <strong>IA Cross-Market:</strong> "Sua gestão de risco funciona bem em ambos os mercados. Considere aplicar o mesmo stop-loss ratio em crypto."
              </div>
              <button 
                onClick={() => router.push('/auth/register')}
                className="mt-4 bg-primary text-gray-800 px-6 py-2 rounded font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Testar IA em Seus Mercados
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-primary rounded-full flex justify-center">
          <div className="w-1 h-3 bg-primary rounded-full mt-2 animate-ping"></div>
        </div>
      </div>
    </section>
  )
} 