'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function HeroSectionPT() {
  const router = useRouter()
  const { user } = useAuth()

  // Get user's display name or email
  const getUserName = (user: any) => {
    let name = user?.displayName || user?.email?.split('@')[0] || 'Trader'
    
    // Get only the first name (before any space)
    const firstName = name.split(' ')[0]
    
    // Capitalize the first letter
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
  }

  const userName = getUserName(user)

  return (
    <section className="w-full min-h-[40vh] flex items-center pt-24 sm:pt-28 lg:pt-32 pb-4 sm:pb-8 lg:pb-12">
      <div className="container mx-auto px-4 flex flex-col items-center text-center">
        {/* Hero Title - Personalized welcome message */}
        <h1 className="hero-title font-poly font-normal mb-6 sm:mb-8 lg:mb-10 leading-tight">
          <span className="text-primary block text-[clamp(2.5rem,6vw,4rem)]">
            Olá, {userName}!
          </span>
        </h1>
        
        {/* Hero Description - Friendly prompt */}
        <div className="hero-description mb-2 sm:mb-3 lg:mb-4 max-w-3xl">
          <p className="text-white text-[clamp(1.25rem,4vw,2rem)] leading-relaxed">
            Você operou hoje?
          </p>
        </div>
        
        {/* CTA Button - Add new trades */}
        <button 
          onClick={() => router.push('/trades/new')}
          className="btn-primary font-comfortaa font-bold transition-all duration-300 hover:scale-105 text-lg px-8 py-4 max-xl:text-base max-xl:px-6 max-xl:py-3 max-md:text-sm max-md:px-4 max-md:py-2"
        >
          Adicionar novas operações
        </button>
      </div>
    </section>
  )
} 