'use client'

import { Moon, Sun } from 'lucide-react'
import { useHubTheme } from './HubRoot'

export default function ThemeSwitch() {
  const { theme, setTheme } = useHubTheme()
  const dark = theme === 'escuro'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Modo escuro"
      className="hub-theme-switch"
      onClick={() => setTheme(dark ? 'claro' : 'escuro')}
    >
      <Sun size={16} strokeWidth={2} aria-hidden="true" className="hub-theme-switch__icon hub-theme-switch__icon--sun" />
      <Moon size={16} strokeWidth={2} aria-hidden="true" className="hub-theme-switch__icon hub-theme-switch__icon--moon" />
      {/* Position and icon follow the frame's data-tema in CSS, so they are right before hydration */}
      <span aria-hidden="true" className="hub-theme-switch__knob">
        <Sun size={16} strokeWidth={2} className="hub-theme-switch__knob-sun" />
        <Moon size={16} strokeWidth={2} className="hub-theme-switch__knob-moon" />
      </span>
    </button>
  )
}
