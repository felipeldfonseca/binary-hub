'use client'

import { useCallback, useEffect, useState } from 'react'
import { LOADING, TRY_AGAIN } from '@/components/hub/contas/copy'
import { CARREGAR_ERRO, NAO_SALVO } from './copy'

/** Whether the rules have loaded: the sections show their frame and this until then */
export type Carga = 'carregando' | 'erro' | 'pronto'

/**
 * «Carregando…» or «Não foi possível carregar as regras.» + «Tentar de novo», inside a card. The
 * three cards wait on the same rules_config, so only one of them (`anunciar`, «Quando você opera»)
 * is a live region: a screen reader hears the state once, not three times.
 */
export function EstadoCarga({ carga, onTentar, anunciar = false }: { carga: Exclude<Carga, 'pronto'>; onTentar: () => void; anunciar?: boolean }) {
  if (carga === 'carregando') {
    return (
      <p role={anunciar ? 'status' : undefined} className="hub-nota">
        {LOADING}
      </p>
    )
  }
  return (
    <div className="hub-linha">
      <p role={anunciar ? 'alert' : undefined} className="hub-nota">
        {CARREGAR_ERRO}
      </p>
      <button type="button" className="hub-btn" onClick={onTentar}>
        {TRY_AGAIN}
      </button>
    </div>
  )
}

/** The board's `interruptor`: a 44px switch labelled by the rule's name */
export function Interruptor({
  ligado,
  rotuloId,
  descricaoId,
  onAlternar,
}: {
  ligado: boolean
  rotuloId: string
  descricaoId?: string
  onAlternar: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      className="hub-pz-interruptor"
      aria-checked={ligado}
      aria-labelledby={rotuloId}
      aria-describedby={descricaoId}
      onClick={onAlternar}
    >
      <span className="hub-pz-interruptor__tr" aria-hidden="true" />
    </button>
  )
}

/** A group of pills (aria-pressed), labelled by an element or a text */
export function Pilulas<T extends string>({
  opcoes,
  valor,
  onEscolher,
  rotuloId,
  rotulo,
  className = 'hub-pills',
}: {
  opcoes: readonly { valor: T; texto: string }[]
  valor: T | null
  onEscolher: (valor: T) => void
  rotuloId?: string
  rotulo?: string
  className?: string
}) {
  return (
    <div role="group" aria-labelledby={rotuloId} aria-label={rotulo} className={className}>
      {opcoes.map((o) => (
        <button key={o.valor} type="button" className="hub-pill" aria-pressed={o.valor === valor} onClick={() => onEscolher(o.valor)}>
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** The amber «não salvo» tag */
export function TagNaoSalvo() {
  return <span className="hub-tag hub-tag--mudou">{NAO_SALVO}</span>
}

/**
 * Moves focus to an element once it is on the page: the actions that add or remove a control
 * («+ Definir janela», «Voltar ao padrão», «OK» of the limit form) name where focus goes next,
 * and the element is focused after the render that draws it.
 */
export function useFocoPendente(): (id: string) => void {
  const [pedido, setPedido] = useState<{ id: string; n: number } | null>(null)
  useEffect(() => {
    if (!pedido) return
    // Usually drawn in the same render; a few short retries cover one that comes a moment later
    let tries = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const tentar = () => {
      const el = document.getElementById(pedido.id)
      if (el) el.focus()
      else if (++tries < 10) timer = setTimeout(tentar, 30)
    }
    tentar()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [pedido])
  return useCallback((id: string) => setPedido((p) => ({ id, n: (p?.n ?? 0) + 1 })), [])
}
