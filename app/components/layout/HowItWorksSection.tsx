'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HowItWorksSection() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const [interactionCount, setInteractionCount] = useState(0)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.3 }
    )

    const section = document.getElementById('how-it-works')
    if (section) observer.observe(section)

    return () => observer.disconnect()
  }, [])

  const steps = [
    {
      id: 'individual',
      title: 'Poder Individual',
      subtitle: 'Seu Assistant Pessoal de IA',
      benefits: [
        'Análise instantânea de cada operação',
        'Padrões únicos do SEU histórico',
        'Insights personalizados para SEU estilo',
        'Dashboard adaptado ao SEU perfil'
      ],
      quote: 'Primeiro, domine sua própria estratégia',
      demoText: 'Upload seu histórico → IA analisa → Insights personalizados',
      conversionText: 'Comece sua análise individual agora'
    },
    {
      id: 'community',
      title: 'Poder Comunitário',
      subtitle: 'Sua Rede de Crescimento',
      benefits: [
        'Conecte-se com traders disciplinados',
        'Compartilhe conquistas e desafios',
        'Aprenda com estratégias validadas',
        'Compita de forma saudável e construtiva'
      ],
      quote: 'Depois, acelere com sabedoria coletiva',
      demoText: 'Perfil verificado → Conexões inteligentes → Crescimento acelerado',
      conversionText: 'Explore a comunidade'
    }
  ]

  const handleStepInteraction = (stepIndex: number) => {
    setActiveStep(stepIndex)
    setInteractionCount(prev => prev + 1)
  }

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-b from-gray-900/30 to-transparent">
      <div className="container mx-auto px-4">
        <div className={`text-center mb-16 ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
          <h2 className="font-poly text-3xl font-bold text-center mb-4 text-text">
            Duas Forças, Um Objetivo: <span className="text-primary">Seu Sucesso</span>
          </h2>
          <p className="text-center text-gray-400 mb-8 max-w-3xl mx-auto">
            Combine o poder da análise individual com a sabedoria coletiva da comunidade
          </p>
          
          {/* Interactive Progress Indicator */}
          <div className="flex justify-center items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${activeStep === 0 ? 'bg-primary scale-125' : 'bg-gray-600'}`}></div>
              <span className={`text-sm ${activeStep === 0 ? 'text-primary font-semibold' : 'text-gray-400'}`}>Individual</span>
            </div>
            <div className="w-8 h-px bg-gray-600"></div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full transition-all duration-300 ${activeStep === 1 ? 'bg-primary scale-125' : 'bg-gray-600'}`}></div>
              <span className={`text-sm ${activeStep === 1 ? 'text-primary font-semibold' : 'text-gray-400'}`}>Comunidade</span>
            </div>
          </div>
        </div>

        {/* Dual Value Proposition */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Individual Power */}
          <div className="card p-8 bg-gray-800/30">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="font-poly text-2xl font-bold text-primary">Poder Individual</h3>
            </div>
            
            <h4 className="text-xl font-semibold text-white mb-4">Seu Assistant Pessoal de IA</h4>
            
            <ul className="space-y-3 mb-6 text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Análise instantânea de cada operação
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Padrões únicos do SEU histórico
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Insights personalizados para SEU estilo
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Dashboard adaptado ao SEU perfil
              </li>
            </ul>
            
            <p className="text-primary font-medium italic">
              "Primeiro, domine sua própria estratégia"
            </p>
          </div>

          {/* Community Power */}
          <div className="card p-8 bg-gray-800/30">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M16 4c0-1.11.89-2 2-2s2 .89 2 2-.89 2-2 2-2-.89-2-2zm4 18v-6h2.5l-2.54-7.63A1.5 1.5 0 0 0 18.54 7h-.79l-.28-.9C17.18 5.46 16.65 5 16 5s-1.18.46-1.47 1.1L14.25 7h-.79a1.5 1.5 0 0 0-1.42 1.37L9.5 16H12v6h4zM12.5 11.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S11 9.17 11 10s.67 1.5 1.5 1.5zM5.5 6c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm2 16v-6H10l-2.54-7.63A1.5 1.5 0 0 0 6.04 7h-.79L4.97 6.1C4.68 5.46 4.15 5 3.5 5s-1.18.46-1.47 1.1L1.75 7H.96a1.5 1.5 0 0 0-1.42 1.37L-2 16h2.5v6h7z"/>
                </svg>
              </div>
              <h3 className="font-poly text-2xl font-bold text-primary">Poder Comunitário</h3>
            </div>
            
            <h4 className="text-xl font-semibold text-white mb-4">Sua Rede de Crescimento</h4>
            
            <ul className="space-y-3 mb-6 text-gray-300">
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Conecte-se com traders disciplinados
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Compartilhe conquistas e desafios
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Aprenda com estratégias validadas
              </li>
              <li className="flex items-start">
                <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                Compita de forma saudável e construtiva
              </li>
            </ul>
            
            <p className="text-primary font-medium italic">
              "Depois, acelere com sabedoria coletiva"
            </p>
          </div>
        </div>

        {/* Synergy Section */}
        <div className="card p-8 bg-gradient-to-r from-gray-800/50 to-gray-700/50 text-center">
          <h3 className="font-poly text-2xl font-bold text-primary mb-4">Sinergia Perfeita</h3>
          <div className="max-w-2xl mx-auto">
            <p className="text-white text-lg leading-relaxed">
              <span className="text-primary font-semibold">IA + Comunidade = Resultados Exponenciais</span>
            </p>
            <div className="grid md:grid-cols-3 gap-6 mt-6 text-sm text-gray-300">
              <div>Seus dados alimentam insights individuais</div>
              <div>Insights da comunidade refinam a IA</div>
              <div>Todos crescem juntos, mais rápido</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 