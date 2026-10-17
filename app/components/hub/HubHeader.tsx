'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import ThemeSwitch from './ThemeSwitch'

interface NavItem {
  label: string
  /** No href: the screen is not built yet and shows "em breve" */
  href?: string
}

// Início, Análises and Mercado open the current pages until their new screens land
export const HUB_NAV: readonly NavItem[] = [
  { label: 'Início', href: '/dashboard' },
  { label: 'Diário', href: '/diario' },
  { label: 'Análises', href: '/analytics' },
  { label: 'Mercado', href: '/market' },
  { label: 'Social' },
  { label: 'AI' },
  { label: 'Conquistas' },
]

const isCurrent = (pathname: string | null, href: string) =>
  !!pathname && (pathname === href || pathname.startsWith(`${href}/`))

type OpenMenu = 'nav' | 'profile' | null

export default function HubHeader() {
  const pathname = usePathname()
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = useState<OpenMenu>(null)
  const headerRef = useRef<HTMLElement>(null)
  const navButtonRef = useRef<HTMLButtonElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  const navMenuRef = useRef<HTMLElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(null)
  }, [pathname])

  // The menus are not next to their buttons in the page order, so take focus into them
  useEffect(() => {
    const menu = open === 'nav' ? navMenuRef.current : open === 'profile' ? profileMenuRef.current : null
    menu?.querySelector<HTMLElement>('a, button')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (target: EventTarget | null) => !headerRef.current?.contains(target as Node)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(null)
      ;(open === 'nav' ? navButtonRef : profileButtonRef).current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) setOpen(null)
    }
    // Tabbing past the last item must not leave the menu covering the control that has focus
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) setOpen(null)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  const toggle = (menu: Exclude<OpenMenu, null>) => setOpen((current) => (current === menu ? null : menu))
  const name = profile?.display_name?.trim() || user?.email || ''
  const initial = name.charAt(0).toUpperCase() || '?'

  return (
    <header ref={headerRef} className="hub-header">
      <Link href="/dashboard" aria-label="Binary Hub, início" className="hub-logo">
        <span className="hub-logo__binary">binary</span>
        <span className="hub-logo__hub">hub</span>
      </Link>

      <nav aria-label="Principal" className="hub-nav">
        <ul className="hub-nav__list">
          {HUB_NAV.map((item) => (
            <li key={item.label}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="hub-nav__link"
                  aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              ) : (
                <span className="hub-nav__soon">
                  {item.label}
                  <span className="hub-nav__soon-tag">em breve</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="hub-actions">
        <ThemeSwitch />
        <button
          ref={navButtonRef}
          type="button"
          className="hub-icon-button hub-menu-button"
          aria-label="Menu"
          aria-expanded={open === 'nav'}
          aria-controls="hub-menu-celular"
          onClick={() => toggle('nav')}
        >
          {open === 'nav' ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <button
          ref={profileButtonRef}
          type="button"
          className="hub-icon-button"
          aria-label="Abrir menu do perfil"
          aria-expanded={open === 'profile'}
          aria-controls="hub-menu-perfil"
          onClick={() => toggle('profile')}
        >
          {initial}
        </button>

        {open === 'profile' && (
          <div ref={profileMenuRef} id="hub-menu-perfil" className="hub-popover hub-popover--profile">
            {user?.email && <p className="hub-popover__note">{user.email}</p>}
            <button type="button" className="hub-popover__item" onClick={() => void signOut()}>
              Sair
            </button>
          </div>
        )}
      </div>

      {open === 'nav' && (
        <nav ref={navMenuRef} id="hub-menu-celular" aria-label="Principal" className="hub-popover hub-popover--nav">
          <ul className="hub-popover__list">
            {HUB_NAV.map((item) => (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hub-popover__item"
                    aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}
                    onClick={() => setOpen(null)}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="hub-popover__item hub-popover__item--soon">
                    {item.label}
                    <span className="hub-popover__tag">em breve</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  )
}
