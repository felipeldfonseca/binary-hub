'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface NavItem {
  href: string
  label: string
  external?: boolean
  url?: string
  isDropdown?: boolean
}

export default function Navbar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [selectedLanguage, setSelectedLanguage] = useState('Language')
  const [selectedTheme, setSelectedTheme] = useState('dark') // Current page is dark mode
  
  // Scroll-based navigation visibility
  const [isNavVisible, setIsNavVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)
  
  // Different navigation items for landing page vs dashboard
  const landingNavItems: NavItem[] = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About us' },
    { href: '/plans', label: 'Plans' },
    { href: '/docs', label: 'Docs', external: true, url: 'https://github.com/your-repo' },
    { href: '#', label: 'Settings', isDropdown: true },
  ]
  
  const dashboardNavItems: NavItem[] = [
    { href: '/dashboard', label: 'Home' },
    { href: '/trades', label: 'Trades' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/events', label: 'Events' },
    { href: '/ai', label: 'AI' },
    { href: '/dashboard/plans', label: 'Plans' },
  ]

  const navItems = user ? dashboardNavItems : landingNavItems
  const isLandingPage = !user
  const navButtonSpacing = isLandingPage ? 'px-3' : 'px-4' // Reduced spacing for landing page

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth < 1280 // Match xl breakpoint (1280px)
      setIsMobile(mobile)
      if (!mobile) {
        setIsMobileMenuOpen(false)
      } else {
        // Close Settings dropdown when hamburger menu appears (below xl breakpoint)
        setIsSettingsOpen(false)
        setIsLanguageOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.settings-dropdown') && 
          !target.closest('.language-dropdown') && 
          !target.closest('.profile-dropdown') && 
          !target.closest('.settings-button') &&
          !target.closest('.profile-button')) {
        setIsSettingsOpen(false)
        setIsLanguageOpen(false)
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll-based navigation visibility
  useEffect(() => {
    let ticking = false

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY
          
          // Show navbar when scrolling up or at the top
          if (currentScrollY < lastScrollY || currentScrollY < 25) {
            setIsNavVisible(true)
          } 
          // Hide navbar when scrolling down (but not at the very top)
          else if (currentScrollY > lastScrollY && currentScrollY > 25) {
            setIsNavVisible(false)
          }
          
          setLastScrollY(currentScrollY)
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [lastScrollY])

  const handleSettingsClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSettingsOpen(!isSettingsOpen)
    setIsLanguageOpen(false) // Close language dropdown when settings is clicked
  }

  const handleLanguageClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsLanguageOpen(!isLanguageOpen)
  }

  const handleLanguageSelect = (language: string, label: string) => {
    setSelectedLanguage(label)
    setIsLanguageOpen(false)
  }

  const handleThemeSelect = (theme: string) => {
    setSelectedTheme(theme)
    // TODO: Implement actual theme switching logic
  }

  const handleProfileClick = () => {
    setIsProfileOpen(!isProfileOpen)
  }

  const handleLogout = async () => {
    try {
      await logout()
      setIsProfileOpen(false)
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const router = useRouter();

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 bg-transparent pt-4 navbar-transition ${
        isNavVisible ? 'navbar-scroll-visible' : 'navbar-scroll-hidden'
      }`}>
        <div className="container mx-auto px-4 sm:px-8 lg:px-12 py-4 md:py-6">
          <nav className="flex items-center justify-between">
            {/* Mobile Hamburger Menu */}
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`xl:hidden flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary/10 transition-all duration-300 ${
                isMobileMenuOpen ? 'bg-primary/20' : ''
              }`}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

            {/* Logo */}
            <Link href={user ? "/dashboard" : "/"} className="flex items-center">
              <div className="flex items-center space-x-1">
                <div className="logo-poly font-normal text-primary">
                  binary
                </div>
                <div className="bg-primary text-dark-background px-2 py-0.5 rounded-15px font-poly text-dark-background font-normal" style={{fontSize: '23px'}}>
                  hub
                </div>
              </div>
            </Link>

            {/* Desktop Navigation Links - Floating Tab with smooth transitions */}
            <div className={`hidden xl:flex items-center transition-all duration-400 ${
              isMobile ? 'animate-slide-out-right' : 'animate-slide-in-right'
            }`}>
              <div className={`navbar-tab flex items-center relative ${
                isLandingPage ? 'justify-center gap-7' : 'justify-center gap-7'
              }`} style={{ minWidth: 'auto', width: 'auto' }}>
                {navItems.map((item) => (
                  <div key={item.href} className="relative">
                    {item.isDropdown ? (
                      <>
                        <button
                          onClick={handleSettingsClick}
                          className={`settings-button nav-link ${navButtonSpacing} py-1 rounded-full text-sm transition-all duration-300 ${
                            isSettingsOpen 
                              ? 'active bg-black/20 text-black font-medium' 
                              : 'text-gray-800 hover:bg-black/10 hover:text-black'
                          }`}
                        >
                          {item.label}
                        </button>
                        {/* Settings Dropdown - positioned relative to Settings button */}
                        {isSettingsOpen && !user && (
                          <div className="settings-dropdown absolute top-full mt-2 right-0 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div className="p-4">
                              {/* Theme Toggle */}
                              <div className="mb-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Theme</p>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleThemeSelect('dark')}
                                    className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTheme === 'dark'
                                        ? 'bg-gray-500 text-white' // Selected state
                                        : 'bg-gray-300 text-gray-700 hover:bg-gray-400' // Unselected state
                                    }`}
                                  >
                                    Dark
                                  </button>
                                  <button 
                                    onClick={() => handleThemeSelect('light')}
                                    className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                                      selectedTheme === 'light'
                                        ? 'bg-primary text-gray-700' // Selected state
                                        : 'bg-primary/80 text-gray-700 hover:bg-primary/90' // Unselected state
                                    }`}
                                  >
                                    Light
                                  </button>
                                </div>
                              </div>
                              
                              {/* Divider */}
                              <div className="border-t border-gray-200 my-4"></div>
                              
                              {/* Language Selection */}
                              <div className="language-dropdown relative">
                                <button
                                  onClick={handleLanguageClick}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-700 bg-white hover:bg-gray-50 transition-colors flex items-center justify-between"
                                >
                                  <span>{selectedLanguage}</span>
                                  <svg className={`w-4 h-4 transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {isLanguageOpen && (
                                  <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                                    <button
                                      onClick={() => {
                                        setIsLanguageOpen(false);
                                        router.push('/');
                                      }}
                                      className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-md"
                                    >
                                      English
                                    </button>
                                    <button
                                      onClick={() => {
                                        setIsLanguageOpen(false);
                                        router.push('/pt');
                                      }}
                                      className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 transition-colors last:rounded-b-md"
                                    >
                                      Português
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : item.external ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`nav-link ${navButtonSpacing} py-1 rounded-full text-sm transition-all duration-300 text-gray-800 hover:bg-black/10 hover:text-black`}
                      >
                        {item.label}
                      </a>
                    ) : (
                  <Link
                    href={item.href}
                    className={`nav-link ${navButtonSpacing} py-1 rounded-full text-sm transition-all duration-300 ${
                      pathname === item.href 
                        ? 'active bg-black/20 text-black font-medium' 
                        : 'text-gray-800 hover:bg-black/10 hover:text-black'
                    }`}
                  >
                    {item.label}
                  </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side Buttons */}
            <div className="flex items-center">
              {!user ? (
                <>
                  <Link
                    href="/auth/login"
                    className="px-6 py-2 rounded-full border border-primary text-primary bg-transparent font-medium text-sm mr-2 transition-all duration-200 hover:bg-primary/10"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/register"
                    className="px-6 py-2 rounded-full bg-primary text-dark-background font-medium text-sm transition-all duration-200 hover:scale-105"
                  >
                    Sign Up
                  </Link>
                </>
              ) : (
              <div className="relative profile-dropdown">
                <button 
                  onClick={handleProfileClick}
                  className={`profile-button transition-all duration-300 ${
                isMobile ? 'w-10 h-10 animate-scale-out' : 'w-12 h-12 md:w-14 md:h-14 animate-scale-in'
                  } ${isProfileOpen ? 'bg-primary/20' : 'hover:bg-primary/10'}`}
                >
                <svg fill="currentColor" viewBox="0 0 20 20" className="w-6 h-6 md:w-7 md:h-7">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </button>
                
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-50">
                    <div className="px-4 py-2 border-b border-gray-700">
                      <p className="text-sm text-gray-300">Signed in as</p>
                      <p className="text-sm font-medium text-white truncate">{user?.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Your Profile
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Settings
                    </Link>
                    <div className="border-t border-gray-700 mt-2">
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="xl:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[55]" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu Panel */}
      <div className={`xl:hidden fixed top-0 left-0 h-full w-64 bg-dark-background/95 backdrop-blur-lg z-[60] transform transition-transform duration-300 ease-in-out mobile-menu ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="pt-20 px-6 relative z-[65]">
          <nav className="flex flex-col space-y-4">
            {navItems.map((item) => (
              <div key={item.href}>
                {item.isDropdown ? (
                  <div>
                    <button
                      onClick={handleSettingsClick}
                      className="settings-button nav-link block px-4 py-3 rounded-lg text-base transition-all duration-300 text-green-400 hover:bg-primary/10 w-full text-left"
                    >
                      {item.label}
                    </button>
                    {isSettingsOpen && (
                      <div className="ml-4 mt-2 space-y-2">
                        <div className="text-sm text-gray-300 mb-2">Theme</div>
                        <div className="flex gap-2 mb-4">
                          <button 
                            onClick={() => handleThemeSelect('dark')}
                            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                              selectedTheme === 'dark'
                                ? 'bg-gray-500 text-white' // Selected state
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600' // Unselected state
                            }`}
                          >
                            Dark
                          </button>
                          <button 
                            onClick={() => handleThemeSelect('light')}
                            className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                              selectedTheme === 'light'
                                ? 'bg-primary text-gray-700' // Selected state
                                : 'bg-primary/80 text-gray-300 hover:bg-primary/90' // Unselected state
                            }`}
                          >
                            Light
                          </button>
                        </div>
                        <div className="language-dropdown relative">
                          <button
                            onClick={handleLanguageClick}
                            className="w-full px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors flex items-center justify-between"
                          >
                            <span>{selectedLanguage}</span>
                            <svg className={`w-3 h-3 transition-transform ${isLanguageOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {isLanguageOpen && (
                            <div className="absolute top-full mt-1 left-0 right-0 bg-gray-700 rounded shadow-lg border border-gray-600 z-[70]">
                              <button
                                onClick={() => {
                                  setIsLanguageOpen(false);
                                  setIsMobileMenuOpen(false);
                                  router.push('/');
                                }}
                                className="w-full px-2 py-1 text-xs text-left text-white hover:bg-gray-600 transition-colors first:rounded-t"
                              >
                                English
                              </button>
                              <button
                                onClick={() => {
                                  setIsLanguageOpen(false);
                                  setIsMobileMenuOpen(false);
                                  router.push('/pt');
                                }}
                                className="w-full px-2 py-1 text-xs text-left text-white hover:bg-gray-600 transition-colors last:rounded-b"
                              >
                                Português
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : item.external ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="nav-link block px-4 py-3 rounded-lg text-base transition-all duration-300 text-green-400 hover:bg-primary/10"
                  >
                    {item.label}
                  </a>
                ) : (
              <Link
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`nav-link block px-4 py-3 rounded-lg text-base transition-all duration-300 ${
                  pathname === item.href 
                    ? 'bg-primary/20 text-green-400 font-medium' 
                    : 'text-green-400 hover:bg-primary/10'
                }`}
              >
                {item.label}
              </Link>
                )}
              </div>
            ))}
            

            
            {/* User Profile Section in Mobile Menu */}
            {user && (
              <div className="mt-8 pt-6 border-t border-gray-600">
                <div className="px-4 py-3 bg-gray-800/50 rounded-lg mb-4">
                  <p className="text-xs text-gray-400">Signed in as</p>
                  <p className="text-sm font-medium text-green-400 truncate">{user?.email}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="nav-link block px-4 py-3 rounded-lg text-base transition-all duration-300 text-green-400 hover:bg-primary/10"
                >
                  Your Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="nav-link block px-4 py-3 rounded-lg text-base transition-all duration-300 text-green-400 hover:bg-primary/10"
                >
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 rounded-lg text-base transition-all duration-300 text-red-400 hover:bg-red-500/10"
                >
                  Sign Out
                </button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  )
} 