'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import { LOADING, TRY_AGAIN } from '@/components/hub/contas/copy'
import { useHubDb } from '@/hooks/useContas'
import { diarioKeys } from '@/hooks/useDiario'
import { useDiarioPagina } from './useDiarioPagina'
import { TITULO } from './ids'
import { ERRO_DIARIO } from './copyMes'

/** The browser's own word on the connection (React Query's onlineManager listens to the same events) */
function ouvirNavegador(avisar: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}
const navegadorOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/**
 * «Sem conexão» (C5's condition, contract §2.2): React Query's onlineManager says offline, or the browser does, or any
 * Diário read of the open account waits for the connection (fetchStatus 'paused': the calendar, the month shown, the
 * open day, the week's own month, the drill's images). A read that already answered stays idle when the connection
 * drops, so the paused reads alone would miss board 10e (the data drawn, the band over it).
 */
export function useSemConexao(): boolean {
  const { conta } = useDiarioPagina()
  const { userId } = useHubDb()
  const queryClient = useQueryClient()
  const online = useSyncExternalStore(
    (avisar) => onlineManager.subscribe(() => avisar()),
    () => onlineManager.isOnline(),
    () => true,
  )
  const offlineNoNavegador = useSyncExternalStore(ouvirNavegador, navegadorOffline, () => false)
  const chave = diarioKeys.conta(userId, conta.id)
  const pausada = useSyncExternalStore(
    (avisar) => queryClient.getQueryCache().subscribe(() => avisar()),
    () => queryClient.getQueryCache().findAll({ queryKey: chave }).some((q) => q.state.fetchStatus === 'paused'),
    () => false,
  )
  return !online || offlineNoNavegador || pausada
}

/**
 * The Diário's states around the calendar, the open day and the week (lane L1, contract §2.2 C6, C6b, C7; board
 * `carregando`, `erro`): while the calendar has no answer, «Carregando…» in a card of the regions' height (C6), or the
 * same card empty and busy when the device is offline (C6b, not drawn: the band above says why; a paused read is not
 * an error, and the reads resume with the connection); when the calendar, the month shown or the open day failed
 * without data (also while the Phase 4 SQL is missing), «Não foi possível carregar o Diário.» and «Tentar de novo»,
 * which reads the three again and gives the focus to «Calendário» once it is drawn (else to the H1). An answer that
 * came keeps the regions drawn when a later read of it fails (as the Phase 3 bridge).
 */
export default function DiarioEstados({ children }: { children?: ReactNode }) {
  const { calendario, mesLido, diaLido } = useDiarioPagina()
  const semConexao = useSemConexao()
  const tentou = useRef<HTMLButtonElement | null>(null)

  // After «Tentar de novo»: once the button is gone, the focus goes to «Calendário» when it came, else to the H1 —
  // never left on the page's start. Left alone when the focus moved on meanwhile
  useEffect(() => {
    const botao = tentou.current
    if (!botao || botao.isConnected) return
    const ativo = document.activeElement
    const perdido = !ativo || ativo === document.body
    const cal = document.getElementById(TITULO.calendario)
    if (cal) {
      tentou.current = null
      if (perdido) cal.focus()
      return
    }
    if (!calendario.isFetching && !mesLido.isFetching && !diaLido.isFetching) {
      tentou.current = null
      if (perdido) document.querySelector<HTMLElement>('.hub-diario h1, h1')?.focus()
    }
  })

  const falhou = [calendario, mesLido, diaLido].some((q) => q.isError && !q.data)
  if (falhou) {
    return (
      <section aria-label="Diário" className="hub-dr-cartao hub-dr-topo-estado">
        <p role="alert" className="hub-dr-topo-erro">
          {ERRO_DIARIO}
        </p>
        <div>
          <button
            type="button"
            className="hub-btn"
            onClick={(event) => {
              tentou.current = event.currentTarget
              void calendario.refetch()
              void mesLido.refetch()
              void diaLido.refetch()
            }}
          >
            {TRY_AGAIN}
          </button>
        </div>
      </section>
    )
  }
  if (!calendario.data) {
    return semConexao ? (
      <section aria-label="Diário" aria-busy="true" className="hub-dr-cartao hub-dr-topo-estado" />
    ) : (
      <section aria-label="Diário" className="hub-dr-cartao hub-dr-topo-estado">
        <p role="status" className="hub-dr-sub">
          {LOADING}
        </p>
      </section>
    )
  }
  return <>{children}</>
}
