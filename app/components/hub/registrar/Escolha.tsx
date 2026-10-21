'use client'

import { useTradeEvents } from '@/hooks/useRegistrar'
import type { RegisteredTrade } from '@/lib/hub/registrarDb'
import type { ContaReg } from '@/lib/hub/registrarForm'
import { linhaEscolhaComParciais } from '@/lib/hub/registrarParciais'
import { ESCOLHA, RODAPE } from './copy'
import { Rodape } from './ui'

/**
 * «Operações abertas» (RO l.300–303, 1597–1602): the account's open trades, oldest first, each with
 * «Registrar saída» / «Registrar resultado»; the footer offers «Nova entrada». No step indicator.
 * Phase 3c (RO l.307): after a partial the row says what is still open («· 2 ct em aberto»); while
 * the exits are read (or when the read fails) the row is as built.
 */
export default function Escolha({
  conta,
  abertas,
  now,
  headingRef,
  aoAbrir,
  aoNovaEntrada,
}: {
  conta: ContaReg
  abertas: readonly RegisteredTrade[]
  now: Date
  headingRef: React.RefObject<HTMLHeadingElement>
  aoAbrir: (tradeId: string) => void
  aoNovaEntrada: () => void
}) {
  const acao = conta.market === 'binary' ? RODAPE.registrarResultado : RODAPE.registrarSaida
  const ordem = abertas.slice().sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
  const eventos = useTradeEvents(conta.market === 'binary' ? null : ordem.map((t) => t.id))
  return (
    <div className="hub-passo">
      <h3 id="t-escolha" ref={headingRef} tabIndex={-1}>
        {ESCOLHA.titulo}
      </h3>
      <ul className="hub-reg-escolha" aria-labelledby="t-escolha">
        {ordem.map((t) => {
          const txt = linhaEscolhaComParciais(conta, t, eventos.data?.[t.id] ?? null, now)
          return (
            <li key={t.id}>
              <span>{txt}</span>
              <button type="button" className="hub-btn" aria-label={ESCOLHA.aria(acao, txt)} onClick={() => aoAbrir(t.id)}>
                {acao}
              </button>
            </li>
          )
        })}
      </ul>
      <Rodape esquerda={{ rotulo: RODAPE.novaEntrada, aoClicar: aoNovaEntrada }} />
    </div>
  )
}
