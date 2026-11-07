'use client'

import Link from 'next/link'
import { useToggle } from '@/components/hub/contas/ui'
import { SECAO } from './ids'
import { PAGINA_ANTIGA, RODAPE } from './copyMes'

/**
 * The Diário's footer (lane L1, contract §2.2 K1–K4; board dez 13): «Como o diário grava» (a disclosure with how the
 * Diário keeps a trading day), the line on the results (net, decision support), and the discreet link to the old
 * list of trades (`/trades?antiga=1`, which opens it before and after step 4-4's redirect: §7.5). Static: it reads no
 * data.
 */
export default function RodapeDiario() {
  const [aberto, alternar] = useToggle()
  return (
    <section id={SECAO.rodape} aria-label={RODAPE.regiao} className="hub-dr-rod">
      <div className="hub-dr-rod-acoes">
        <button type="button" className="hub-btn" aria-expanded={aberto} aria-controls="info-grava" onClick={alternar}>
          {RODAPE.grava}
        </button>
      </div>
      {aberto && (
        <div id="info-grava" className="hub-info-painel hub-dr-rod-painel">
          {RODAPE.gravaTexto}
        </div>
      )}
      <p className="hub-dr-rod-linha">{RODAPE.linha}</p>
      <div>
        <Link href={PAGINA_ANTIGA} className="hub-dr-rod-link">
          {RODAPE.antiga}
        </Link>
      </div>
    </section>
  )
}
