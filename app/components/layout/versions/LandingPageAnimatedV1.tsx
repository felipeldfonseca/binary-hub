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

// Final CTA Section
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
            {isPortuguese ? 'Pare de adivinhar.' : 'Stop guessing.'}
          </h2>
        </ProgressiveTextReveal>
        <ProgressiveTextReveal trigger={sectionVisible} delay={200}>
          <h2 className="font-poly text-3xl font-bold text-gray-600 mb-8">
            {isPortuguese ? 'Comece a operar com dados.' : 'Start trading with data.'}
          </h2>
        </ProgressiveTextReveal>
        <ProgressiveTextReveal trigger={sectionVisible} delay={400}>
          <Link 
            href="/auth/register" 
            className="bg-gray-800 text-primary px-8 py-3 text-lg font-comfortaa font-bold rounded-full hover:bg-gray-700 transition-all duration-300 hover:scale-105 inline-block"
            style={{ willChange: 'transform' }}
          >
            {isPortuguese ? 'Registre-se hoje gratuitamente' : 'Register today for free'}
          </Link>
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
      <AnimatedHowItWorksSection />
      <AnimatedCommunitySection />
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