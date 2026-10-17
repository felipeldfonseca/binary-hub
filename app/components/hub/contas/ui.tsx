'use client'

import { useState } from 'react'

/** The boards' "i" toggle: aria-label «Como ler: {tema}», opens the panel `panelId`. */
export function InfoButton({
  panelId,
  label,
  open,
  onToggle,
}: {
  panelId: string
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button type="button" className="hub-info" aria-expanded={open} aria-controls={panelId} aria-label={label} onClick={onToggle}>
      i
    </button>
  )
}

export function InfoPanel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="hub-info-painel">
      {children}
    </div>
  )
}

export function useToggle(initial = false): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initial)
  return [value, () => setValue((v) => !v), setValue]
}

/** «▸ Ver linhas» style disclosure button */
export function Disclosure({
  open,
  controls,
  onToggle,
  children,
}: {
  open: boolean
  controls: string
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" className="hub-abre" aria-expanded={open} aria-controls={controls} onClick={onToggle}>
      <span className="hub-seta" aria-hidden="true">
        ▸
      </span>
      {children}
    </button>
  )
}
