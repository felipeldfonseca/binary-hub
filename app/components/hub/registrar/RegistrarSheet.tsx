'use client'

import { useEffect, useRef } from 'react'
import type { CloseRegistrarOptions } from './abrir'

/**
 * The «Registrar operação» sheet. PLACEHOLDER of the shared base (contract §2.5): lane A replaces
 * this file with the sheet of the approved board (RegistrarOperacao.dc.html v57), in the import
 * sheet's frame (.hub-veu + section.hub-folha, Escape, the Tab trap). Its props are the contract
 * between the provider (ImportSheetProvider) and the sheet; keep them.
 */
export interface RegistrarSheetProps {
  /** The account the sheet opens on; null when the hub has no account it can register on */
  accountId: string | null
  /** A trade to open on (open → its «Operação aberta», closed → its «Operação fechada») */
  tradeId: string | null
  /** Closes the sheet (the provider returns focus to the opener, or to `focusId`) */
  onClose: (options?: CloseRegistrarOptions) => void
}

export default function RegistrarSheet({ onClose }: RegistrarSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  return (
    <>
      <div className="hub-veu" aria-hidden="true" onClick={() => onClose()} />
      <section
        className="hub-folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-registrar"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
      >
        <div className="hub-folha__cab">
          <h2 id="t-registrar">Registrar operação</h2>
          <button ref={closeRef} type="button" className="hub-fechar" aria-label="Fechar" onClick={() => onClose()}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </section>
    </>
  )
}
