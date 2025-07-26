'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/contexts/AuthContext'

export default function FooterPT() {
  const pathname = usePathname()
  const { user } = useAuth()
  
  const institutionalLinks = [
    { href: '/pt/about', label: 'Sobre nós' },
    { href: '/pt/plans', label: 'Planos' },
    { href: '/docs', label: 'Docs' },
    { href: '#faqs', label: 'FAQs', isFAQ: true },
  ]

  const socialLinks = [
    { href: 'https://facebook.com', label: 'Facebook', icon: 'facebook' },
    { href: 'https://linkedin.com', label: 'LinkedIn', icon: 'linkedin' },
    { href: 'https://twitter.com', label: 'X', icon: 'x' },
    { href: 'https://instagram.com', label: 'Instagram', icon: 'instagram' },
    { href: 'https://youtube.com', label: 'YouTube', icon: 'youtube' },
  ]

  const handleFAQClick = (e: React.MouseEvent) => {
    e.preventDefault()
    
    // Remove focus from the button to prevent it from staying selected
    const button = e.currentTarget as HTMLButtonElement
    button.blur()
    
    // Check if current page has FAQs section
    const hasFAQsOnPage = pathname === '/pt' || pathname === '/pt/plans'
    
    if (hasFAQsOnPage) {
      // Scroll to FAQs section on current page
      const faqsSection = document.getElementById('faqs')
      if (faqsSection) {
        faqsSection.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // Navigate to plans page FAQs section
      window.location.href = '/pt/plans#faqs'
    }
  }

  const getSocialIcon = (icon: string) => {
    const iconClass = "w-5 h-5"
    
    switch (icon) {
      case 'facebook':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        )
      case 'linkedin':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        )
      case 'x':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
          </svg>
        )
      case 'instagram':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.62 5.367 11.987 11.988 11.987 6.62 0 11.987-5.367 11.987-11.987C24.014 5.367 18.637.001 12.017.001zM17.96 12c0 3.27-2.69 5.96-5.96 5.96S6.04 15.27 6.04 12s2.69-5.96 5.96-5.96S17.96 8.73 17.96 12zm-2.8 0c0 1.75-1.41 3.16-3.16 3.16s-3.16-1.41-3.16-3.16 1.41-3.16 3.16-3.16 3.16 1.41 3.16 3.16zm4.84-5.8c0 .82-.66 1.48-1.48 1.48s-1.48-.66-1.48-1.48.66-1.48 1.48-1.48 1.48.66 1.48 1.48z" />
          </svg>
        )
      case 'youtube':
        return (
          <svg className={iconClass} fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto px-4 pt-20 pb-16" style={{ paddingTop: '5rem', paddingBottom: '4rem' }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Logo and Description */}
          <div className="space-y-6">
            <Link href={user ? "/dashboard" : "/pt"} className="flex items-center space-x-1">
              <div className="flex items-center space-x-1">
                <div className="logo-poly font-normal text-primary">
                  binary
                </div>
                <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal" style={{fontSize: '23px'}}>
                  hub
                </div>
              </div>
            </Link>
          </div>

          {/* Institutional Links */}
          <div>
            <h3 className="font-semibold text-text mb-4">Empresa</h3>
            <nav className="space-y-2">
              {institutionalLinks
                .filter(link => !(link.isFAQ && pathname === '/pt/about'))
                .map((link) => (
                link.isFAQ ? (
                  <button
                    key={link.href}
                    onClick={handleFAQClick}
                    className="block text-sm text-white hover:text-primary transition-colors text-left w-full focus:outline-none focus:ring-0 focus:border-0"
                  >
                    {link.label}
                  </button>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block text-sm text-white hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </nav>
          </div>

          {/* Social Links */}
          <div>
            <h3 className="font-semibold text-text mb-4">Siga-nos</h3>
            <div className="flex space-x-4">
              {socialLinks.map((link) => (
                <a
                  key={link.icon}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-primary transition-colors"
                  aria-label={link.label}
                >
                  {getSocialIcon(link.icon)}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-white">
          <p>&copy; 2025 Binary Hub. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
} 