'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function HeroSectionPT() {
  const router = useRouter()
  return (
    <section className="w-full min-h-[60vh] flex items-center pt-20 sm:pt-24 lg:pt-28">
      <div className="container mx-auto px-4 flex flex-col items-center text-center">
        <h1 className="hero-title font-poly font-normal mb-6 sm:mb-8 leading-tight">
          <span className="text-primary block text-[clamp(2rem,5vw,4rem)]">
            Domine suas estratégias.
          </span>
          <span className="text-white block text-[clamp(2rem,5vw,4rem)]">
            Opere como um profissional.
          </span>
        </h1>
        <div className="hero-description mb-8 sm:mb-10 lg:mb-12 max-w-3xl">
          <p className="text-white text-[clamp(1rem,3vw,2rem)] leading-relaxed">
            Todas as métricas essenciais em um só lugar.
          </p>
          <p className="text-white text-[clamp(1rem,3vw,2rem)] leading-relaxed">
            Conheça seu operacional como nunca antes.
          </p>
        </div>
        <button 
          onClick={() => router.push('/pt/plans')}
          className="btn-primary font-montserrat font-semibold transition-all duration-300 hover:scale-105 text-lg px-8 py-4 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2"
        >
          Conheça nossos planos premium
        </button>
      </div>
    </section>
  )
} 