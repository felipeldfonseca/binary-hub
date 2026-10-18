'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useLanguage } from '@/lib/contexts/LanguageContext'

// Scroll Progress Indicator Component
const ScrollProgressIndicator = () => {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const updateScrollProgress = () => {
      const currentProgress = window.pageYOffset
      const scrollHeight = document.body.scrollHeight - window.innerHeight
      if (scrollHeight) {
        setScrollProgress(Math.min((currentProgress / scrollHeight) * 100, 100))
      }
    }

    const throttledUpdateScrollProgress = () => {
      requestAnimationFrame(updateScrollProgress)
    }

    window.addEventListener('scroll', throttledUpdateScrollProgress, { passive: true })
    updateScrollProgress()

    return () => window.removeEventListener('scroll', throttledUpdateScrollProgress)
  }, [])

  return (
    <div className="fixed top-0 left-0 w-full h-1 bg-gray-800/50 z-50">
      <div 
        className="h-full bg-gradient-to-r from-primary to-green-400 transition-all duration-150 ease-out"
        style={{ width: `${scrollProgress}%` }}
      />
    </div>
  )
}

// Parallax Background Component
const ParallaxBackground = () => {
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    const updateScrollY = () => setScrollY(window.pageYOffset)
    const throttledUpdateScrollY = () => requestAnimationFrame(updateScrollY)
    
    window.addEventListener('scroll', throttledUpdateScrollY, { passive: true })
    return () => window.removeEventListener('scroll', throttledUpdateScrollY)
  }, [])

  return (
    <>
      {/* Layer 1 - Slowest */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{ transform: `translate3d(0, ${scrollY * 0.2}px, 0)` }}
      >
        <div className="absolute top-20 left-10 w-4 h-4 bg-primary rounded-full"></div>
        <div className="absolute top-60 right-20 w-3 h-3 bg-primary rounded-full"></div>
        <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-primary rounded-full"></div>
      </div>
      
      {/* Layer 2 - Medium */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{ transform: `translate3d(0, ${scrollY * 0.4}px, 0)` }}
      >
        <div className="absolute top-40 right-10 w-2 h-2 bg-primary rounded-full animate-pulse"></div>
        <div className="absolute top-80 left-20 w-1 h-1 bg-primary rounded-full animate-ping"></div>
        <div className="absolute bottom-20 right-1/4 w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
      </div>
      
      {/* Layer 3 - Fastest */}
      <div 
        className="absolute inset-0 opacity-15"
        style={{ transform: `translate3d(0, ${scrollY * 0.6}px, 0)` }}
      >
        <div className="absolute top-32 left-1/3 w-1 h-1 bg-primary rounded-full animate-ping"></div>
        <div className="absolute top-96 right-1/3 w-2 h-2 bg-primary rounded-full animate-pulse"></div>
      </div>
    </>
  )
}

// Animated Counter Component
const AnimatedCounter = ({ end, suffix = '', duration = 2000, trigger }: { 
  end: number; 
  suffix?: string; 
  duration?: number; 
  trigger: boolean;
}) => {
  const [count, setCount] = useState(0)
  const countRef = useRef(0)
  const animationRef = useRef<number>()

  useEffect(() => {
    if (!trigger) return

    const startTime = Date.now()
    const animate = () => {
      const currentTime = Date.now()
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentCount = Math.floor(easeOutQuart * end)
      
      if (currentCount !== countRef.current) {
        countRef.current = currentCount
        setCount(currentCount)
      }
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [end, duration, trigger])

  return <span>{count}{suffix}</span>
}

// Intersection Observer Hook for Performance
const useIntersectionObserver = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered) {
          setIsVisible(true)
          setHasTriggered(true) // Only trigger once for performance
        }
      },
      { threshold, rootMargin: '50px' }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold, hasTriggered])

  return [ref, isVisible, hasTriggered] as const
}

// Progressive Text Reveal Component
const ProgressiveTextReveal = ({ 
  children, 
  delay = 0, 
  trigger 
}: { 
  children: React.ReactNode; 
  delay?: number; 
  trigger: boolean; 
}) => {
  const [isRevealed, setIsRevealed] = useState(false)

  useEffect(() => {
    if (trigger) {
      const timeout = setTimeout(() => setIsRevealed(true), delay)
      return () => clearTimeout(timeout)
    }
  }, [trigger, delay])

  return (
    <div
      className={`transition-all duration-1000 ease-out ${
        isRevealed 
          ? 'opacity-100 transform translate-y-0' 
          : 'opacity-0 transform translate-y-8'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// Hero Section with Animations
const AnimatedHeroSection = () => {
  const router = useRouter()
  const { isPortuguese } = useLanguage()
  const [socialProofCount, setSocialProofCount] = useState(247)
  const [recentActivity, setRecentActivity] = useState(
    isPortuguese ? "5 traders registrados hoje" : "5 traders registered today"
  )
  const [showDemo, setShowDemo] = useState(false)
  const [heroRef, heroVisible] = useIntersectionObserver(0.2)

  // Social proof animation
  useEffect(() => {
    const interval = setInterval(() => {
      setSocialProofCount(prev => prev + Math.floor(Math.random() * 3))
      const activities = isPortuguese ? [
        "3 traders registrados nos últimos 10 min",
        "Análise AI gerada há 2 min",
        "Nova conexão criada agora",
        "2 insights compartilhados hoje"
      ] : [
        "3 traders registered in the last 10 min",
        "AI analysis generated 2 min ago",
        "New connection created now",
        "2 insights shared today"
      ]
      setRecentActivity(activities[Math.floor(Math.random() * activities.length)])
    }, 8000)

    return () => clearInterval(interval)
  }, [isPortuguese])

  return (
    <section 
      ref={heroRef}
      className="w-full min-h-screen flex items-center relative overflow-hidden"
      style={{ scrollSnapAlign: 'start' }}
    >
      <ParallaxBackground />
      
      <div className="container mx-auto px-4 flex flex-col items-center text-center relative z-10 py-20">
        {/* Social Proof with entrance animation */}
        <ProgressiveTextReveal trigger={heroVisible} delay={200}>
          <div className="mb-6 flex items-center gap-4 text-sm text-gray-300 bg-gray-800/40 px-4 py-2 rounded-full backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="font-medium text-green-400">
                <AnimatedCounter end={socialProofCount} trigger={heroVisible} />
              </span>
              <span>{isPortuguese ? 'traders ativos' : 'active traders'}</span>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <span className="animate-fade-in">{recentActivity}</span>
          </div>
        </ProgressiveTextReveal>

        {/* Main Title with staggered animation */}
        <div className="mb-6 sm:mb-8">
          <ProgressiveTextReveal trigger={heroVisible} delay={400}>
            <h1 className="hero-title font-poly font-normal leading-tight">
              <span className="text-primary block text-[clamp(2rem,5vw,4rem)]">
                {isPortuguese ? 'Evolua Individualmente,' : 'Evolve Individually,'}
              </span>
            </h1>
          </ProgressiveTextReveal>
          <ProgressiveTextReveal trigger={heroVisible} delay={600}>
            <h1 className="hero-title font-poly font-normal leading-tight">
              <span className="text-white block text-[clamp(2rem,5vw,4rem)]">
                {isPortuguese ? 'Cresça em Comunidade.' : 'Grow in Community.'}
              </span>
            </h1>
          </ProgressiveTextReveal>
        </div>

        {/* Value Proposition */}
        <div className="hero-description mb-8 sm:mb-10 lg:mb-12 max-w-4xl">
          <ProgressiveTextReveal trigger={heroVisible} delay={800}>
            <p className="text-white text-[clamp(1rem,2.5vw,1.5rem)] leading-relaxed mb-4">
              <span className="text-primary font-semibold">
                {isPortuguese ? 'IA personalizada' : 'Personalized AI'}
              </span>{' '}
              {isPortuguese 
                ? 'transforma seus dados em insights únicos.' 
                : 'transforms your data into unique insights.'
              }
            </p>
          </ProgressiveTextReveal>
          <ProgressiveTextReveal trigger={heroVisible} delay={1000}>
            <p className="text-white text-[clamp(1rem,2.5vw,1.5rem)] leading-relaxed">
              <span className="text-primary font-semibold">
                {isPortuguese ? 'Comunidade ativa' : 'Active community'}
              </span>{' '}
              {isPortuguese 
                ? 'acelera seu crescimento através de conexões inteligentes.' 
                : 'accelerates your growth through smart connections.'
              }
            </p>
          </ProgressiveTextReveal>
        </div>
        
        {/* Interactive Highlights */}
        <ProgressiveTextReveal trigger={heroVisible} delay={1200}>
          <div className="flex flex-wrap justify-center gap-4 mb-8 text-sm text-gray-300">
            <div className="bg-gray-800/50 px-4 py-2 rounded-full hover:bg-gray-700/60 transition-all cursor-pointer group transform hover:scale-105">
              <span className="group-hover:text-primary transition-colors">
                {isPortuguese ? 'IA Personalizada para SEU Trading' : 'Personalized AI for YOUR Trading'}
              </span>
            </div>
            <div className="bg-gray-800/50 px-4 py-2 rounded-full hover:bg-gray-700/60 transition-all cursor-pointer group transform hover:scale-105">
              <span className="group-hover:text-primary transition-colors">
                {isPortuguese ? 'Comunidade de Traders Comprometidos' : 'Community of Committed Traders'}
              </span>
            </div>
            <div className="bg-gray-800/50 px-4 py-2 rounded-full hover:bg-gray-700/60 transition-all cursor-pointer group transform hover:scale-105">
              <span className="group-hover:text-primary transition-colors">
                {isPortuguese ? 'Insights Individuais + Coletivos' : 'Individual + Collective Insights'}
              </span>
            </div>
          </div>
        </ProgressiveTextReveal>

        {/* CTA Buttons */}
        <ProgressiveTextReveal trigger={heroVisible} delay={1400}>
          <div className="flex flex-col items-center space-y-4 mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <button 
                onClick={() => router.push('/auth/register')}
                className="btn-primary font-comfortaa font-bold transition-all duration-300 hover:scale-105 text-lg px-8 py-4 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2 relative overflow-hidden group"
                style={{ willChange: 'transform' }}
              >
                <span className="relative z-10">
                  {isPortuguese ? 'Começar Gratuitamente' : 'Start Free'}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </button>
              
              <button 
                onClick={() => setShowDemo(!showDemo)}
                className="px-8 py-4 rounded-full border border-primary text-primary bg-transparent font-comfortaa font-bold text-lg transition-all duration-200 hover:bg-primary/10 hover:scale-105 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2"
                style={{ willChange: 'transform' }}
              >
                {isPortuguese ? 'Ver Demo IA ao Vivo' : 'See Live AI Demo'}
              </button>
            </div>

            {/* Trust Signals */}
            <div className="text-xs text-gray-400 flex items-center gap-4 mt-4">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? '100% Grátis para começar' : '100% Free to start'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Sem cartão de crédito' : 'No credit card'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Setup em 2 minutos' : '2-minute setup'}
              </span>
            </div>
          </div>
        </ProgressiveTextReveal>

        {/* Expandable Demo */}
        {showDemo && (
          <div className="bg-gray-800/60 backdrop-blur-sm rounded-lg p-6 max-w-md mx-auto mt-8 animate-slide-down">
            <div className="text-center mb-4">
              <h3 className="text-primary font-semibold mb-2">
                {isPortuguese ? 'Preview: Análise IA em Tempo Real' : 'Preview: Real-time AI Analysis'}
              </h3>
              <div className="bg-gray-900/50 rounded p-4 text-left text-sm">
                <div className="text-green-400 mb-2">
                  {isPortuguese 
                    ? '✓ Padrão identificado: Win rate 23% maior em EUR/USD'
                    : '✓ Pattern identified: 23% higher win rate on EUR/USD'
                  }
                </div>
                <div className="text-yellow-400 mb-2">
                  {isPortuguese 
                    ? '⚠ Alerta: Overtrading detectado nos últimos 3 dias'
                    : '⚠ Alert: Overtrading detected in the last 3 days'
                  }
                </div>
                <div className="text-blue-400">
                  {isPortuguese 
                    ? '💡 Recomendação: Focar operações 15-17h para melhor performance'
                    : '💡 Recommendation: Focus trades 3-5pm for better performance'
                  }
                </div>
              </div>
              <button 
                onClick={() => router.push('/auth/register')}
                className="mt-4 bg-primary text-gray-800 px-4 py-2 rounded font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                {isPortuguese ? 'Ver Análise Completa' : 'See Full Analysis'}
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

// How It Works Section with Scroll Animations
const AnimatedHowItWorksSection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  const steps = [
    {
      id: 'individual',
      title: isPortuguese ? 'Poder Individual' : 'Individual Power',
      subtitle: isPortuguese ? 'Seu Assistant Pessoal de IA' : 'Your Personal AI Assistant',
      benefits: isPortuguese ? [
        'Análise instantânea de cada operação',
        'Padrões únicos do SEU histórico',
        'Insights personalizados para SEU estilo',
        'Dashboard adaptado ao SEU perfil'
      ] : [
        'Instant analysis of each trade',
        'Unique patterns from YOUR history',
        'Personalized insights for YOUR style',
        'Dashboard adapted to YOUR profile'
      ],
      quote: isPortuguese 
        ? 'Primeiro, domine sua própria estratégia' 
        : 'First, master your own strategy'
    },
    {
      id: 'community',
      title: isPortuguese ? 'Poder Comunitário' : 'Community Power',
      subtitle: isPortuguese ? 'Sua Rede de Crescimento' : 'Your Growth Network',
      benefits: isPortuguese ? [
        'Conecte-se com traders disciplinados',
        'Compartilhe conquistas e desafios',
        'Aprenda com estratégias validadas',
        'Compita de forma saudável e construtiva'
      ] : [
        'Connect with disciplined traders',
        'Share achievements and challenges',
        'Learn from validated strategies',
        'Compete in a healthy and constructive way'
      ],
      quote: isPortuguese 
        ? 'Depois, acelere com sabedoria coletiva' 
        : 'Then, accelerate with collective wisdom'
    }
  ]

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gradient-to-b from-gray-900/30 to-transparent relative"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-16">
            <h2 className="font-poly text-3xl font-bold text-center mb-4 text-text">
              {isPortuguese ? 'Duas Forças, Um Objetivo: ' : 'Two Forces, One Goal: '}
              <span className="text-primary">
                {isPortuguese ? 'Seu Sucesso' : 'Your Success'}
              </span>
            </h2>
            <p className="text-center text-gray-400 mb-8 max-w-3xl mx-auto">
              {isPortuguese 
                ? 'Combine o poder da análise individual com a sabedoria coletiva da comunidade'
                : 'Combine the power of individual analysis with the collective wisdom of the community'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        {/* Dual Cards with Parallax */}
        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {steps.map((step, index) => (
            <ProgressiveTextReveal 
              key={step.id} 
              trigger={sectionVisible} 
              delay={200 + index * 300}
            >
              <div 
                className="card p-8 bg-gray-800/30 transform transition-all duration-500 hover:scale-105 hover:bg-gray-800/50"
                style={{ willChange: 'transform' }}
              >
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <h3 className="font-poly text-2xl font-bold text-primary">{step.title}</h3>
                </div>
                
                <h4 className="text-xl font-semibold text-white mb-4">{step.subtitle}</h4>
                
                <ul className="space-y-3 mb-6 text-gray-300">
                  {step.benefits.map((benefit, benefitIndex) => (
                    <li key={benefitIndex} className="flex items-start">
                      <span className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      {benefit}
                    </li>
                  ))}
                </ul>
                
                <p className="text-primary font-medium italic">"{step.quote}"</p>
              </div>
            </ProgressiveTextReveal>
          ))}
        </div>

        {/* Synergy Section */}
        <ProgressiveTextReveal trigger={sectionVisible} delay={800}>
          <div className="card p-8 bg-gradient-to-r from-gray-800/50 to-gray-700/50 text-center">
            <h3 className="font-poly text-2xl font-bold text-primary mb-4">
              {isPortuguese ? 'Sinergia Perfeita' : 'Perfect Synergy'}
            </h3>
            <div className="max-w-2xl mx-auto">
              <p className="text-white text-lg leading-relaxed">
                <span className="text-primary font-semibold">
                  {isPortuguese ? 'IA + Comunidade = Resultados Exponenciais' : 'AI + Community = Exponential Results'}
                </span>
              </p>
              <div className="grid md:grid-cols-3 gap-6 mt-6 text-sm text-gray-300">
                <div>{isPortuguese ? 'Seus dados alimentam insights individuais' : 'Your data feeds individual insights'}</div>
                <div>{isPortuguese ? 'Insights da comunidade refinam a IA' : 'Community insights refine AI'}</div>
                <div>{isPortuguese ? 'Todos crescem juntos, mais rápido' : 'Everyone grows together, faster'}</div>
              </div>
            </div>
          </div>
        </ProgressiveTextReveal>
      </div>
    </section>
  )
}

// Community Features with Scroll Animations
const AnimatedCommunitySection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gray-900/50"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-16">
            <h2 className="font-poly text-3xl font-bold text-text mb-4">
              {isPortuguese ? 'Nossa Comunidade Está ' : 'Our Community is '}
              <span className="text-primary">
                {isPortuguese ? 'Nascendo' : 'Growing'}
              </span>
            </h2>
            <p className="text-gray-400 max-w-3xl mx-auto">
              {isPortuguese 
                ? 'Seja um dos primeiros membros fundadores e ajude a construir a melhor comunidade de trading do Brasil'
                : 'Be one of the first founding members and help build the best trading community'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        {/* Stats with animated counters */}
        <ProgressiveTextReveal trigger={sectionVisible} delay={200}>
          <div className="grid md:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                <AnimatedCounter end={247} suffix="+" trigger={sectionVisible} />
              </div>
              <div className="text-gray-400">
                {isPortuguese ? 'Traders Ativos' : 'Active Traders'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                <AnimatedCounter end={89} suffix="%" trigger={sectionVisible} />
              </div>
              <div className="text-gray-400">
                {isPortuguese ? 'Satisfação' : 'Satisfaction'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                <AnimatedCounter end={1420} suffix="+" trigger={sectionVisible} />
              </div>
              <div className="text-gray-400">
                {isPortuguese ? 'Análises IA' : 'AI Analyses'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                <AnimatedCounter end={156} suffix="+" trigger={sectionVisible} />
              </div>
              <div className="text-gray-400">
                {isPortuguese ? 'Conexões' : 'Connections'}
              </div>
            </div>
          </div>
        </ProgressiveTextReveal>

        {/* Feature Cards */}
        <ProgressiveTextReveal trigger={sectionVisible} delay={400}>
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="card p-6 bg-gray-800/50 transform transition-all duration-500 hover:scale-105">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">
                {isPortuguese ? 'Perfis Públicos de Trader' : 'Public Trader Profiles'}
              </h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• {isPortuguese ? 'Compartilhe métricas com controle de privacidade' : 'Share metrics with privacy control'}</li>
                <li>• {isPortuguese ? 'Mostre suas conquistas e especialidades' : 'Show your achievements and specialties'}</li>
                <li>• {isPortuguese ? 'Construa reputação baseada em resultados' : 'Build reputation based on results'}</li>
              </ul>
            </div>

            <div className="card p-6 bg-gray-800/50 transform transition-all duration-500 hover:scale-105">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">
                {isPortuguese ? 'Feed Social Inteligente' : 'Smart Social Feed'}
              </h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• {isPortuguese ? 'Timeline com insights e análises de qualidade' : 'Timeline with quality insights and analysis'}</li>
                <li>• {isPortuguese ? 'Filtros por tipo de estratégia e ativo' : 'Filters by strategy type and asset'}</li>
                <li>• {isPortuguese ? 'Algoritmo que destaca conteúdo relevante' : 'Algorithm that highlights relevant content'}</li>
              </ul>
            </div>

            <div className="card p-6 bg-gray-800/50 transform transition-all duration-500 hover:scale-105">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h4 className="text-xl font-semibold text-white mb-3">
                {isPortuguese ? 'Sistema de Seguidores' : 'Follower System'}
              </h4>
              <ul className="text-gray-300 text-sm space-y-2">
                <li>• {isPortuguese ? 'Siga traders que admira e respeita' : 'Follow traders you admire and respect'}</li>
                <li>• {isPortuguese ? 'Receba notificações de suas melhores análises' : 'Get notifications of their best analysis'}</li>
                <li>• {isPortuguese ? 'Construa sua própria base de seguidores' : 'Build your own follower base'}</li>
              </ul>
            </div>
          </div>
        </ProgressiveTextReveal>

        {/* Founder Benefits */}
        <ProgressiveTextReveal trigger={sectionVisible} delay={600}>
          <div className="card p-8 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-primary mb-4">
                {isPortuguese ? 'Vantagens de Membro Fundador' : 'Founding Member Benefits'}
              </h3>
              <p className="text-white mb-6">
                {isPortuguese 
                  ? 'Seja um dos primeiros e ganhe benefícios exclusivos permanentes'
                  : 'Be one of the first and gain permanent exclusive benefits'
                }
              </p>
              <div className="grid md:grid-cols-4 gap-4 text-sm">
                <div className="bg-gray-800/50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105">
                  <div className="text-primary font-semibold mb-2">
                    {isPortuguese ? 'Badge Exclusivo' : 'Exclusive Badge'}
                  </div>
                  <div className="text-gray-300">
                    {isPortuguese ? 'Identificação permanente de fundador' : 'Permanent founder identification'}
                  </div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105">
                  <div className="text-primary font-semibold mb-2">
                    {isPortuguese ? 'Acesso Antecipado' : 'Early Access'}
                  </div>
                  <div className="text-gray-300">
                    {isPortuguese ? 'Teste novos recursos antes de todos' : 'Test new features before everyone'}
                  </div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105">
                  <div className="text-primary font-semibold mb-2">
                    {isPortuguese ? 'Voz Ativa' : 'Active Voice'}
                  </div>
                  <div className="text-gray-300">
                    {isPortuguese ? 'Influencie o desenvolvimento da comunidade' : 'Influence community development'}
                  </div>
                </div>
                <div className="bg-gray-800/50 p-4 rounded-lg transform transition-all duration-300 hover:scale-105">
                  <div className="text-primary font-semibold mb-2">
                    {isPortuguese ? 'Networking Premium' : 'Premium Networking'}
                  </div>
                  <div className="text-gray-300">
                    {isPortuguese ? 'Conecte-se com outros fundadores' : 'Connect with other founders'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ProgressiveTextReveal>
      </div>
    </section>
  )
}

// Pricing Plans Section with Animations
const AnimatedPricingSection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  const plans = [
    {
      id: 'free',
      name: isPortuguese ? 'Skill Builder' : 'Skill Builder',
      price: isPortuguese ? 'Grátis' : 'Free',
      description: isPortuguese ? 'Perfeito para começar' : 'Perfect to get started',
      features: [
        isPortuguese ? '5 análises de IA por mês' : '5 AI analyses per month',
        isPortuguese ? 'Recursos sociais básicos' : 'Basic social features',
        isPortuguese ? '1 relatório semanal de IA' : '1 weekly AI report',
        isPortuguese ? 'Comunidades por mercado' : 'Market-specific communities',
        isPortuguese ? 'Tracking de performance básico' : 'Basic performance tracking'
      ],
      cta: isPortuguese ? 'Começar Grátis' : 'Start Free',
      highlight: false
    },
    {
      id: 'pro',
      name: 'Pro Trader',
      price: isPortuguese ? 'R$ 97/mês' : '$19 USDT',
      description: isPortuguese ? 'Para traders sérios' : 'For serious traders',
      features: [
        isPortuguese ? '50 análises de IA por mês' : '50 AI analyses per month',
        isPortuguese ? 'Recursos sociais avançados' : 'Advanced social features',
        isPortuguese ? 'Relatórios diários de IA' : 'Daily AI reports',
        isPortuguese ? 'Filtros de mercado e insights cross-market' : 'Market filters and cross-market insights',
        isPortuguese ? 'Análise de screenshot' : 'Screenshot analysis',
        isPortuguese ? 'Acesso a trading rooms colaborativas' : 'Collaborative trading room access'
      ],
      cta: isPortuguese ? 'Escolher Pro' : 'Choose Pro',
      highlight: true
    },
    {
      id: 'premium',
      name: 'Premium',
      price: isPortuguese ? 'R$ 147/mês' : '$29 USDT',
      description: isPortuguese ? 'Experiência completa' : 'Complete experience',
      features: [
        isPortuguese ? 'Análises de IA ilimitadas' : 'Unlimited AI analyses',
        isPortuguese ? 'Coaching de execução em tempo real' : 'Real-time execution coaching',
        isPortuguese ? 'Reconhecimento avançado de padrões' : 'Advanced pattern recognition',
        isPortuguese ? 'Simulador de trading com coaching de IA' : 'Trading simulator with AI coaching',
        isPortuguese ? 'Suporte prioritário' : 'Priority support',
        isPortuguese ? 'Acesso beta a novos recursos' : 'Beta access to new features'
      ],
      cta: isPortuguese ? 'Escolher Premium' : 'Choose Premium',
      highlight: false
    }
  ]

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gradient-to-b from-gray-900/20 to-gray-900/50"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-16">
            <h2 className="font-poly text-3xl font-bold text-white mb-4">
              {isPortuguese ? 'Escolha Seu ' : 'Choose Your '}
              <span className="text-primary">
                {isPortuguese ? 'Plano' : 'Plan'}
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Comece grátis e evolua conforme suas necessidades crescem'
                : 'Start free and evolve as your needs grow'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <ProgressiveTextReveal 
              key={plan.id} 
              trigger={sectionVisible} 
              delay={200 + index * 150}
            >
              <div className={`card p-6 transform transition-all duration-500 hover:scale-105 ${
                plan.highlight 
                  ? 'bg-gradient-to-b from-primary/10 to-primary/5 border-2 border-primary scale-105' 
                  : 'bg-gray-800/30 border border-gray-700/50'
              }`}>
                {plan.highlight && (
                  <div className="bg-primary text-gray-800 text-xs font-bold px-3 py-1 rounded-full w-fit mx-auto mb-4">
                    {isPortuguese ? 'MAIS POPULAR' : 'MOST POPULAR'}
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="font-poly text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-3xl font-bold text-primary mb-2">{plan.price}</div>
                  <p className="text-gray-400 text-sm">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start text-gray-300 text-sm">
                      <svg className="w-4 h-4 text-green-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 rounded-full font-bold text-sm transition-all duration-300 hover:scale-105 ${
                  plan.highlight 
                    ? 'bg-primary text-gray-800 hover:bg-primary/90'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}>
                  {plan.cta}
                </button>
              </div>
            </ProgressiveTextReveal>
          ))}
        </div>

        <ProgressiveTextReveal trigger={sectionVisible} delay={800}>
          <div className="text-center mt-12">
            <p className="text-gray-400 text-sm mb-4">
              {isPortuguese 
                ? 'Todos os planos incluem garantia de 30 dias. Cancele a qualquer momento.'
                : 'All plans include 30-day guarantee. Cancel anytime.'
              }
            </p>
            <div className="flex justify-center items-center gap-6 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Sem cartão de crédito' : 'No credit card'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Setup instantâneo' : 'Instant setup'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Suporte dedicado' : 'Dedicated support'}
              </span>
            </div>
          </div>
        </ProgressiveTextReveal>
      </div>
    </section>
  )
}

// Social Proof Section with Animations 
const AnimatedSocialProofSection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  const testimonials = [
    {
      name: 'Carlos Silva',
      role: isPortuguese ? 'Trader Forex' : 'Forex Trader',
      content: isPortuguese 
        ? 'A IA identificou padrões no meu trading que eu nem sabia que existiam. Minha consistência melhorou 40% em 2 meses.'
        : 'The AI identified patterns in my trading that I didn\'t even know existed. My consistency improved 40% in 2 months.',
      profit: '+67%'
    },
    {
      name: 'Ana Costa',
      role: isPortuguese ? 'Crypto Trader' : 'Crypto Trader', 
      content: isPortuguese 
        ? 'Finalmente uma comunidade séria. Aprendi mais aqui em 3 meses do que em anos tentando sozinha.'
        : 'Finally a serious community. I learned more here in 3 months than in years trying alone.',
      profit: '+134%'
    },
    {
      name: 'Roberto Lima',
      role: isPortuguese ? 'Ex-Binary Options' : 'Ex-Binary Options',
      content: isPortuguese 
        ? 'A transição para forex foi suave com a ajuda da plataforma. Hoje opero com R:R positivo e disciplina.'
        : 'The transition to forex was smooth with the platform\'s help. Today I trade with positive R:R and discipline.',
      profit: '+89%'
    }
  ]

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gray-900/30"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-16">
            <h2 className="font-poly text-3xl font-bold text-white mb-4">
              <span className="text-primary">{isPortuguese ? 'Traders Reais.' : 'Real Traders.'}</span>
              {' '}{isPortuguese ? 'Resultados Reais.' : 'Real Results.'}
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Veja como nossa plataforma está transformando a jornada de traders em todos os mercados'
                : 'See how our platform is transforming traders\' journeys across all markets'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <ProgressiveTextReveal 
              key={testimonial.name} 
              trigger={sectionVisible} 
              delay={200 + index * 150}
            >
              <div className="card p-6 bg-gray-800/50 transform transition-all duration-500 hover:scale-105">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-gray-800 font-bold mr-3">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{testimonial.name}</h4>
                    <p className="text-gray-400 text-sm">{testimonial.role}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="text-green-400 font-bold text-xl">{testimonial.profit}</div>
                    <div className="text-gray-500 text-xs text-right">
                      {isPortuguese ? 'lucro' : 'profit'}
                    </div>
                  </div>
                </div>
                
                <blockquote className="text-gray-300 italic leading-relaxed">
                  "{testimonial.content}"
                </blockquote>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.97a1 1 0 00.95.69h4.172c.969 0 1.371 1.24.588 1.81l-3.374 2.45a1 1 0 00-.364 1.118l1.286 3.97c.3.921-.755 1.688-1.54 1.118l-3.374-2.45a1 1 0 00-1.176 0l-3.374 2.45c-.784.57-1.838-.197-1.539-1.118l1.286-3.97a1 1 0 00-.364-1.118L2.049 9.397c-.783-.57-.38-1.81.588-1.81h4.172a1 1 0 00.95-.69l1.286-3.97z" />
                      </svg>
                    ))}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {isPortuguese ? 'Verificado' : 'Verified'}
                    <svg className="inline w-3 h-3 ml-1 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            </ProgressiveTextReveal>
          ))}
        </div>

        <ProgressiveTextReveal trigger={sectionVisible} delay={800}>
          <div className="mt-16 text-center">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">
                  <AnimatedCounter end={92} suffix="%" trigger={sectionVisible} />
                </div>
                <div className="text-gray-400 text-sm">
                  {isPortuguese ? 'Melhoria na Consistência' : 'Consistency Improvement'}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">
                  <AnimatedCounter end={156} suffix="+" trigger={sectionVisible} />
                </div>
                <div className="text-gray-400 text-sm">
                  {isPortuguese ? 'Traders Transformados' : 'Traders Transformed'}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">
                  <AnimatedCounter end={78} suffix="%" trigger={sectionVisible} />
                </div>
                <div className="text-gray-400 text-sm">
                  {isPortuguese ? 'Redução de Drawdown' : 'Drawdown Reduction'}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary mb-2">
                  <AnimatedCounter end={4.9} trigger={sectionVisible} />/5
                </div>
                <div className="text-gray-400 text-sm">
                  {isPortuguese ? 'Avaliação Média' : 'Average Rating'}
                </div>
              </div>
            </div>
          </div>
        </ProgressiveTextReveal>
      </div>
    </section>
  )
}

// FAQ Section with Animations
const AnimatedFAQSection = () => {
  const { isPortuguese } = useLanguage()
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  const faqs = [
    {
      question: isPortuguese ? 'Como a IA analisa meu trading?' : 'How does the AI analyze my trading?',
      answer: isPortuguese 
        ? 'Nossa IA avançada utiliza algoritmos de aprendizado de máquina para identificar padrões únicos no seu histórico de trades, detectar comportamentos que levam a lucros ou perdas, e gerar insights personalizados para seu estilo específico de trading.'
        : 'Our advanced AI uses machine learning algorithms to identify unique patterns in your trading history, detect behaviors that lead to profits or losses, and generate personalized insights for your specific trading style.'
    },
    {
      question: isPortuguese ? 'Posso usar com qualquer mercado?' : 'Can I use it with any market?',
      answer: isPortuguese 
        ? 'Sim! Suportamos Binary Options, Forex, Cryptocurrency, Futures e Options. Nossa IA é treinada para entender as nuances de cada mercado e pode até identificar como suas habilidades se transferem entre diferentes mercados.'
        : 'Yes! We support Binary Options, Forex, Cryptocurrency, Futures and Options. Our AI is trained to understand the nuances of each market and can even identify how your skills transfer between different markets.'
    },
    {
      question: isPortuguese ? 'É realmente gratuito para começar?' : 'Is it really free to get started?',
      answer: isPortuguese 
        ? 'Completamente gratuito! Você recebe 5 análises de IA por mês, acesso à comunidade e relatórios semanais sem precisar de cartão de crédito. Você só paga se quiser mais recursos avançados.'
        : 'Completely free! You get 5 AI analyses per month, community access and weekly reports without needing a credit card. You only pay if you want more advanced features.'
    },
    {
      question: isPortuguese ? 'Meus dados estão seguros?' : 'Is my data secure?',
      answer: isPortuguese 
        ? 'Absolutamente. Usamos criptografia de ponta a ponta, todos os dados são anonimizados para análise, você controla 100% da privacidade do que compartilha, e seguimos padrões bancários de segurança.'
        : 'Absolutely. We use end-to-end encryption, all data is anonymized for analysis, you control 100% of the privacy of what you share, and we follow banking-level security standards.'
    },
    {
      question: isPortuguese ? 'Como funciona a comunidade?' : 'How does the community work?',
      answer: isPortuguese 
        ? 'Nossa comunidade conecta traders disciplinados através de perfis públicos (com controle de privacidade), feed inteligente com insights de qualidade, sistema de seguidores e grupos específicos por mercado e estratégia.'
        : 'Our community connects disciplined traders through public profiles (with privacy controls), smart feed with quality insights, follower system and specific groups by market and strategy.'
    },
    {
      question: isPortuguese ? 'Posso cancelar a qualquer momento?' : 'Can I cancel anytime?',
      answer: isPortuguese 
        ? 'Sim, você pode cancelar sua assinatura a qualquer momento, sem perguntas ou taxas de cancelamento. Oferecemos garantia de 30 dias para todos os planos pagos.'
        : 'Yes, you can cancel your subscription anytime, no questions asked or cancellation fees. We offer a 30-day guarantee for all paid plans.'
    }
  ]

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gradient-to-b from-gray-900/50 to-gray-900/20"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-16">
            <h2 className="font-poly text-3xl font-bold text-white mb-4">
              {isPortuguese ? 'Perguntas ' : 'Frequently '}
              <span className="text-primary">
                {isPortuguese ? 'Frequentes' : 'Asked'}
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Tudo que você precisa saber sobre a plataforma e como ela pode transformar seu trading'
                : 'Everything you need to know about the platform and how it can transform your trading'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <ProgressiveTextReveal 
              key={index} 
              trigger={sectionVisible} 
              delay={200 + index * 100}
            >
              <div className="card p-6 bg-gray-800/30 mb-4 transform transition-all duration-300 hover:bg-gray-800/50">
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h3 className="font-semibold text-white pr-4">{faq.question}</h3>
                  <svg 
                    className={`w-5 h-5 text-primary transform transition-transform duration-200 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`} 
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                
                {openFAQ === index && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <p className="text-gray-300 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                )}
              </div>
            </ProgressiveTextReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// Enhanced Final CTA Section
const AnimatedCTASection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.5)

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-primary relative overflow-hidden"
      style={{ scrollSnapAlign: 'start' }}
    >
      {/* Background Animation */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 left-10 w-3 h-3 bg-gray-600 rounded-full animate-pulse"></div>
        <div className="absolute top-20 right-20 w-2 h-2 bg-gray-600 rounded-full animate-ping"></div>
        <div className="absolute bottom-20 left-1/4 w-2.5 h-2.5 bg-gray-600 rounded-full animate-pulse"></div>
      </div>

      <div className="container mx-auto px-4 text-center relative z-10">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <h2 className="font-poly text-3xl font-bold text-gray-600 mb-2">
            {isPortuguese ? 'Evolua Seu Trading.' : 'Evolve Your Trading.'}
          </h2>
        </ProgressiveTextReveal>
        <ProgressiveTextReveal trigger={sectionVisible} delay={200}>
          <h2 className="font-poly text-3xl font-bold text-gray-600 mb-4">
            {isPortuguese ? 'Cresça em Comunidade.' : 'Grow in Community.'}
          </h2>
        </ProgressiveTextReveal>
        <ProgressiveTextReveal trigger={sectionVisible} delay={400}>
          <p className="text-gray-700 mb-8 max-w-2xl mx-auto">
            {isPortuguese 
              ? 'Junte-se a centenas de traders que já descobriram como IA avançada e comunidade especializada podem transformar qualquer estratégia de trading.'
              : 'Join hundreds of traders who have already discovered how advanced AI and specialized community can transform any trading strategy.'
            }
          </p>
        </ProgressiveTextReveal>
        <ProgressiveTextReveal trigger={sectionVisible} delay={600}>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <Link 
              href="/auth/register" 
              className="bg-gray-800 text-primary px-8 py-4 text-lg font-comfortaa font-bold rounded-full hover:bg-gray-700 transition-all duration-300 hover:scale-105 inline-block"
              style={{ willChange: 'transform' }}
            >
              {isPortuguese ? 'Começar Gratuitamente Hoje' : 'Start Free Today'}
            </Link>
            <div className="text-gray-700 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Setup em 2 minutos' : '2-minute setup'}
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Sem cartão necessário' : 'No card required'}
              </div>
            </div>
          </div>
        </ProgressiveTextReveal>
      </div>
    </section>
  )
}

// Mission Section with Animations
const AnimatedMissionSection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-primary relative overflow-hidden"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Side - Animated Phrases */}
          <div className="space-y-6">
            <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
              <h2 className="font-poly text-4xl font-bold text-gray-600">
                {isPortuguese ? 'Universal. Inteligente.' : 'Universal. Intelligent.'}
              </h2>
            </ProgressiveTextReveal>
            <ProgressiveTextReveal trigger={sectionVisible} delay={200}>
              <h2 className="font-poly text-4xl font-bold text-gray-600">
                {isPortuguese ? 'Educação. Evolução.' : 'Education. Evolution.'}
              </h2>
            </ProgressiveTextReveal>
          </div>
          
          {/* Right Side - Mission Statement */}
          <div className="space-y-6">
            <ProgressiveTextReveal trigger={sectionVisible} delay={400}>
              <p className="text-lg font-medium text-gray-600 leading-relaxed">
                {isPortuguese 
                  ? 'Binary Hub é a plataforma definitiva de educação em trading, onde traders de TODOS os mercados evoluem suas habilidades através de IA avançada e aprendizado colaborativo.'
                  : 'Binary Hub is the ultimate trading education platform, where traders from ALL markets evolve their skills through advanced AI and collaborative learning.'
                }
              </p>
            </ProgressiveTextReveal>
            <ProgressiveTextReveal trigger={sectionVisible} delay={600}>
              <p className="text-base text-gray-700 leading-relaxed">
                {isPortuguese 
                  ? 'Conectamos traders de Binary Options, Forex, Crypto, Futuros e Options em uma comunidade focada em crescimento sustentável e educação de qualidade.'
                  : 'We connect traders from Binary Options, Forex, Crypto, Futures and Options in a community focused on sustainable growth and quality education.'
                }
              </p>
            </ProgressiveTextReveal>
          </div>
        </div>
      </div>
    </section>
  )
}

// Journey Section with Animations
const AnimatedJourneySection = () => {
  const { isPortuguese } = useLanguage()
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  const journeySteps = [
    {
      phase: isPortuguese ? 'Descoberta' : 'Discovery',
      title: isPortuguese ? 'Identifique Seus Padrões' : 'Identify Your Patterns',
      description: isPortuguese 
        ? 'IA analisa seu histórico e revela insights únicos do seu estilo de trading'
        : 'AI analyzes your history and reveals unique insights about your trading style'
    },
    {
      phase: isPortuguese ? 'Evolução' : 'Evolution', 
      title: isPortuguese ? 'Aprenda Continuamente' : 'Learn Continuously',
      description: isPortuguese 
        ? 'Combine análises individuais com sabedoria coletiva da comunidade'
        : 'Combine individual analysis with collective wisdom from the community'
    },
    {
      phase: isPortuguese ? 'Maestria' : 'Mastery',
      title: isPortuguese ? 'Domine Qualquer Mercado' : 'Master Any Market', 
      description: isPortuguese 
        ? 'Transfira habilidades entre mercados e torne-se um trader completo'
        : 'Transfer skills between markets and become a complete trader'
    }
  ]

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gradient-to-b from-gray-900/20 to-transparent relative"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-16">
            <h2 className="font-poly text-3xl font-bold text-white mb-4">
              {isPortuguese ? 'Sua Jornada de ' : 'Your Journey from '}
              <span className="text-primary">
                {isPortuguese ? 'Crescimento' : 'Growth'}
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Da análise individual ao sucesso colaborativo - cada passo planejado para sua evolução'
                : 'From individual analysis to collaborative success - every step planned for your evolution'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {journeySteps.map((step, index) => (
            <ProgressiveTextReveal 
              key={step.phase} 
              trigger={sectionVisible} 
              delay={200 + index * 200}
            >
              <div className="relative">
                {/* Connection Line */}
                {index < journeySteps.length - 1 && (
                  <div className="hidden md:block absolute top-6 -right-4 w-8 h-0.5 bg-primary/30"></div>
                )}
                
                <div className="card p-6 bg-gray-800/30 text-center transform transition-all duration-500 hover:scale-105 hover:bg-gray-800/50">
                  <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-gray-800 font-bold text-xl">
                    {index + 1}
                  </div>
                  <h3 className="text-primary font-semibold mb-2">{step.phase}</h3>
                  <h4 className="font-poly text-xl font-bold text-white mb-4">{step.title}</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            </ProgressiveTextReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// Multi-Market Showcase with Animations and SVG Icons
const AnimatedMultiMarketSection = () => {
  const { isPortuguese } = useLanguage()
  const [activeMarket, setActiveMarket] = useState('forex')
  const [sectionRef, sectionVisible] = useIntersectionObserver(0.3)

  const markets = [
    {
      id: 'forex',
      name: 'Forex',
      description: isPortuguese ? 'O mercado mais líquido' : 'The most liquid market',
      details: isPortuguese 
        ? 'Análise técnica avançada, correlações de pares, e estratégias de swing trading'
        : 'Advanced technical analysis, pair correlations, and swing trading strategies',
      features: [
        isPortuguese ? 'Análise de pares' : 'Pair analysis',
        isPortuguese ? 'Gerenciamento de posição' : 'Position management', 
        isPortuguese ? 'News trading' : 'News trading',
        isPortuguese ? 'Scalping/Swing' : 'Scalping/Swing'
      ],
      color: 'from-blue-500 to-cyan-500',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
    },
    {
      id: 'crypto',
      name: 'Cryptocurrency',
      description: isPortuguese ? 'Mercados 24/7' : '24/7 markets',
      details: isPortuguese 
        ? 'Volatilidade extrema, DeFi, análise on-chain e estratégias de HODLing'
        : 'Extreme volatility, DeFi, on-chain analysis and HODLing strategies',
      features: [
        isPortuguese ? 'Análise on-chain' : 'On-chain analysis',
        isPortuguese ? 'Volatilidade' : 'Volatility',
        isPortuguese ? 'DeFi strategies' : 'DeFi strategies',
        isPortuguese ? 'Portfolio management' : 'Portfolio management'
      ],
      color: 'from-purple-500 to-pink-500',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
    },
    {
      id: 'futures',
      name: 'Futures',
      description: isPortuguese ? 'Mercados profissionais' : 'Professional markets',
      details: isPortuguese 
        ? 'Contratos futuros, commodities, índices e gestão de margem avançada'
        : 'Futures contracts, commodities, indices and advanced margin management',
      features: [
        isPortuguese ? 'Contratos futuros' : 'Futures contracts',
        isPortuguese ? 'Gestão de margem' : 'Margin management',
        isPortuguese ? 'Commodities' : 'Commodities',
        isPortuguese ? 'Índices' : 'Indices'
      ],
      color: 'from-green-500 to-emerald-500',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
    },
    {
      id: 'options',
      name: 'Options',
      description: isPortuguese ? 'Estratégias sofisticadas' : 'Sophisticated strategies',
      details: isPortuguese 
        ? 'Greeks, volatilidade implícita, estratégias multi-leg e income generation'
        : 'Greeks, implied volatility, multi-leg strategies and income generation',
      features: [
        isPortuguese ? 'Greeks analysis' : 'Greeks analysis',
        isPortuguese ? 'Volatilidade' : 'Volatility',
        isPortuguese ? 'Multi-leg strategies' : 'Multi-leg strategies',
        isPortuguese ? 'Income generation' : 'Income generation'
      ],
      color: 'from-yellow-500 to-orange-500',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
    },
    {
      id: 'binary',
      name: 'Binary Options',
      description: isPortuguese ? 'Onde tudo começou' : 'Where it all started',
      details: isPortuguese 
        ? 'Análise honesta da matemática, gestão de risco, e transição para mercados sustentáveis'
        : 'Honest mathematical analysis, risk management, and transition to sustainable markets',
      features: [
        isPortuguese ? 'Análise de R:R' : 'R:R analysis',
        isPortuguese ? 'Gestão emocional' : 'Emotional management',
        isPortuguese ? 'Timing de entrada' : 'Entry timing',
        isPortuguese ? 'Evolução gradual' : 'Gradual evolution'
      ],
      color: 'from-orange-500 to-red-500',
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )
    }
  ]

  return (
    <section 
      ref={sectionRef}
      className="py-20 bg-gradient-to-b from-gray-900/50 to-transparent"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="container mx-auto px-4">
        <ProgressiveTextReveal trigger={sectionVisible} delay={0}>
          <div className="text-center mb-12">
            <h2 className="font-poly text-3xl font-bold text-white mb-4">
              {isPortuguese ? 'Todos os Mercados. ' : 'All Markets. '}
              <span className="text-primary">
                {isPortuguese ? 'Uma Plataforma.' : 'One Platform.'}
              </span>
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              {isPortuguese 
                ? 'Seja qual for seu mercado preferido, nossa IA avançada e comunidade especializada ajudam você a evoluir suas habilidades de trading.'
                : 'Whatever your preferred market, our advanced AI and specialized community help you evolve your trading skills.'
              }
            </p>
          </div>
        </ProgressiveTextReveal>

        {/* Market Selection */}
        <ProgressiveTextReveal trigger={sectionVisible} delay={200}>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {markets.map((market) => (
              <button
                key={market.id}
                onClick={() => setActiveMarket(market.id)}
                className={`px-6 py-3 rounded-full font-medium transition-all duration-300 transform hover:scale-105 ${
                  activeMarket === market.id
                    ? 'bg-primary text-gray-800 scale-105'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/60'
                }`}
                style={{ willChange: 'transform' }}
              >
                <span className="mr-2">{market.icon}</span>
                {market.name}
              </button>
            ))}
          </div>
        </ProgressiveTextReveal>

        {/* Market Details */}
        <ProgressiveTextReveal trigger={sectionVisible} delay={400}>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Market Info */}
            <div className="space-y-6">
              {markets
                .filter(market => market.id === activeMarket)
                .map((market) => (
                  <div key={market.id} className="animate-fade-in">
                    <div className="flex items-center mb-4">
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${market.color} flex items-center justify-center text-white mr-4`}>
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
            <div className="bg-gray-800/30 rounded-lg p-6 transform transition-all duration-500 hover:scale-105">
              <div className="flex items-center mb-4">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mr-3">
                  <svg className="w-4 h-4 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-semibold text-white">
                  {isPortuguese ? 'IA Especializada por Mercado' : 'Market-Specialized AI'}
                </h4>
              </div>
              
              <div className="bg-gray-900/50 rounded p-4 mb-4">
                <div className="text-primary font-medium mb-2">
                  {isPortuguese ? 'Análise Cross-Market:' : 'Cross-Market Analysis:'}
                </div>
                {activeMarket === 'forex' && (
                  <p className="text-sm text-gray-300">
                    {isPortuguese 
                      ? '"Padrão de suporte/resistência identificado funciona bem em crypto. BTC/USDT mostra correlação similar ao EUR/USD."'
                      : '"Support/resistance pattern identified works well in crypto. BTC/USDT shows similar correlation to EUR/USD."'
                    }
                  </p>
                )}
                {activeMarket === 'crypto' && (
                  <p className="text-sm text-gray-300">
                    {isPortuguese 
                      ? '"Volatilidade de crypto pode ser gerenciada com técnicas de forex. Aplicar stop-loss percentual constante."'
                      : '"Crypto volatility can be managed with forex techniques. Apply consistent percentage stop-loss."'
                    }
                  </p>
                )}
                {activeMarket === 'futures' && (
                  <p className="text-sm text-gray-300">
                    {isPortuguese 
                      ? '"Gestão de risco em futures é similar a forex, mas com leverage maior. Adaptar position sizing proporcionalmente."'
                      : '"Risk management in futures is similar to forex, but with higher leverage. Adapt position sizing proportionally."'
                    }
                  </p>
                )}
                {activeMarket === 'options' && (
                  <p className="text-sm text-gray-300">
                    {isPortuguese 
                      ? '"Timing de entrada em options pode usar análise técnica de forex. Greeks adicionar camada de sofisticação."'
                      : '"Entry timing in options can use forex technical analysis. Greeks add sophistication layer."'
                    }
                  </p>
                )}
                {activeMarket === 'binary' && (
                  <p className="text-sm text-gray-300">
                    {isPortuguese 
                      ? '"Sua disciplina em binary options pode ser aplicada em forex com melhor R:R. Considere EUR/USD com timeframes maiores."'
                      : '"Your binary options discipline can be applied to forex with better R:R. Consider EUR/USD with larger timeframes."'
                    }
                  </p>
                )}
              </div>

              <div className="flex items-center text-sm text-gray-400">
                <svg className="w-4 h-4 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {isPortuguese ? 'Powered by Advanced AI Models' : 'Powered by Advanced AI Models'}
              </div>
            </div>
          </div>
        </ProgressiveTextReveal>
      </div>
    </section>
  )
}

// Main Landing Page Component
export default function LandingPageAnimatedV1() {
  return (
    <div 
      className="min-h-screen bg-background relative"
      style={{ 
        scrollSnapType: 'y mandatory',
        scrollBehavior: 'smooth' 
      }}
    >
      <ScrollProgressIndicator />
      
      <AnimatedHeroSection />
      <AnimatedMissionSection />
      <AnimatedJourneySection />
      <AnimatedHowItWorksSection />
      <AnimatedMultiMarketSection />
      <AnimatedPricingSection />
      <AnimatedCommunitySection />
      <AnimatedSocialProofSection />
      <AnimatedFAQSection />
      <AnimatedCTASection />
      
      {/* Performance monitoring styles */}
      <style jsx global>{`
        * {
          will-change: auto;
        }
        
        .performance-optimized {
          transform: translate3d(0, 0, 0);
          backface-visibility: hidden;
          perspective: 1000px;
        }
        
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}