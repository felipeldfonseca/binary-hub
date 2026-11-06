'use client'

import type { ReactNode } from 'react'
import { TRY_AGAIN } from '@/components/hub/contas/copy'
import { useDiarioPagina } from './useDiarioPagina'
import { ERRO_DIARIO } from './copyMes'

/**
 * The Diário's states around the calendar, the open day and the week (lane L1, contract §2.2 C6, C6b, C7). B0's stub:
 * the regions once the calendar answered; a minimal C7 when the calendar, the month shown or the open day failed
 * without data (also while the Phase 4 SQL is missing); nothing while loading. L1 builds the loading card, the first
 * load offline and the look, keeping C7's role and text.
 */
export default function DiarioEstados({ children }: { children?: ReactNode }) {
  const { calendario, mesLido, diaLido } = useDiarioPagina()
  const falhou = [calendario, mesLido, diaLido].some((q) => q.isError && !q.data)
  if (falhou) {
    return (
      <section aria-label="Diário">
        <p role="alert">{ERRO_DIARIO}</p>
        <button
          type="button"
          className="hub-btn"
          onClick={() => {
            void calendario.refetch()
            void mesLido.refetch()
            void diaLido.refetch()
          }}
        >
          {TRY_AGAIN}
        </button>
      </section>
    )
  }
  if (!calendario.data) return null
  return <>{children}</>
}
