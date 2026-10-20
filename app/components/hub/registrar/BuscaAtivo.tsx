'use client'

import type { ModeloAtivo } from '@/lib/hub/registrarForm'
import { ATIVO } from './copy'
import { CampoTexto, GrupoPills } from './ui'

/** The chips' group (`l-ativo`): after a search result is chosen, its pressed chip takes the focus */
export const GRUPO_ATIVO = 'ativo'

/** Moves the focus to the instrument chip that is pressed (the one a search result just added) */
export function focarAtivoEscolhido() {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(`[aria-labelledby="l-${GRUPO_ATIVO}"] [aria-pressed="true"]`)?.focus())
}

/**
 * The instrument block of a price market (RO l.336–343, 1079–1090, 1147–1151): «Ativo» / «Par» /
 * «Moeda» / «Ativo-objeto» chips (the account's last ones, else the board's examples, futures the
 * six roots), «Buscar ativo / par / moeda» over the approved catalog, its results as pills (≤ 6) and
 * «Usar “XAUUSD”» when nothing of the catalog matches. The results status is for screen readers
 * (polite, N: the board shows the results silently). The model is registrarForm's (m.ativo).
 */
export default function BuscaAtivo({
  m,
  aoEscolher,
  aoBuscar,
}: {
  m: ModeloAtivo
  /** A chip (daBusca false) or a search result / «Usar» (daBusca true), by its code */
  aoEscolher: (codigo: string, daBusca: boolean) => void
  aoBuscar: (texto: string) => void
}) {
  const escolhido = m.chips.find((c) => c.selecionado)?.valor ?? null
  const resultados = [
    ...m.busca.resultados.map((c) => ({ codigo: c, rotulo: c })),
    ...(m.busca.usar ? [{ codigo: m.busca.usar, rotulo: ATIVO.usar(m.busca.usar) }] : []),
  ]
  return (
    <GrupoPills
      id={GRUPO_ATIVO}
      titulo={m.rotulo}
      opcoes={m.chips.map((c) => ({ valor: c.valor, rotulo: c.rotulo }))}
      valor={escolhido}
      aoEscolher={(c) => aoEscolher(c, false)}
      depois={
        <>
          <div className="hub-reg-busca-campo">
            <CampoTexto
              id="f-busca"
              rotulo={m.busca.rotulo}
              valor={m.busca.valor}
              tipo="search"
              mono={false}
              classe="hub-reg-busca"
              placeholder={m.busca.placeholder}
              aoMudar={aoBuscar}
            />
          </div>
          {resultados.length > 0 && (
            <div role="group" aria-label={ATIVO.resultadosAria} className="hub-pills">
              {resultados.map((o) => (
                <button key={o.codigo} type="button" className="hub-pill" onClick={() => aoEscolher(o.codigo, true)}>
                  {o.rotulo}
                </button>
              ))}
            </div>
          )}
          {/* Always on the page, so a screen reader hears each new count (N) */}
          <p role="status" className="sr-only">
            {m.busca.status}
          </p>
        </>
      }
    />
  )
}
