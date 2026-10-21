'use client'

import type { BlocoResultadoModelo } from '@/lib/hub/registrarForm'
import { FUTUROS } from './copy'
import { CampoTexto } from './ui'

/** What «Corrigir» controls (RO l.410: `aria-controls="caixa-res"`) */
export const CAIXA_RES = 'caixa-res'

/** The block's ids: the exit's by default; «Parcial» (3c) passes its own (`f-pres`, `caixa-pres`, `f-pcustos`) */
export interface IdsResultado {
  res: string
  caixa: string
  custos: string
}

export const IDS_RESULTADO: IdsResultado = { res: 'f-res', caixa: CAIXA_RES, custos: 'f-custos' }

/**
 * The result of a price market's exit (RO l.409–414, 471–474, 929–966), in «Já fechada» and on step
 * 2: the line (`role="status"`: «Resultado: +11,5 pips · +US$ 57,50», «Se sair a 1,08635: …»),
 * «Corrigir» ↔ «Usar o calculado» (new markets, a computed result on screen), the estimate note
 * (USD/xxx), the typed result («Resultado, US$», required when the prices cannot tell the money) or
 * the correction («Resultado na sua plataforma, US$»), and «Custos · opcional» (new markets). Futures
 * of the table and Ebinex show the line only, as in 3-3. The model is registrarForm's (blocoResultado).
 *
 * The result field is signed («−57,50»): it keeps the text keyboard (A: the board's inputmode
 * decimal has no minus sign on iOS).
 */
export default function BlocoResultado({
  linha,
  bloco,
  erroRes,
  erroCustos,
  aoCorrigir,
  aoMudarRes,
  aoMudarCustos,
  ids = IDS_RESULTADO,
}: {
  linha: string
  bloco: BlocoResultadoModelo | null
  /** The result's error on screen (after a tap, or the server's refusal) */
  erroRes?: string | null
  /** The costs' error (always on screen, or the server's refusal) */
  erroCustos?: string | null
  aoCorrigir: () => void
  aoMudarRes: (v: string) => void
  aoMudarCustos: (v: string) => void
  /** Phase 3c: «Parcial» renders the block with its own ids; every other render keeps the default */
  ids?: IdsResultado
}) {
  return (
    <>
      <div className="hub-linha-i">
        <span className="hub-num" role="status">
          {linha}
        </span>
        {bloco?.corrigir && (
          <button type="button" className="hub-reg-link" aria-expanded={bloco.corrigir.aberto} aria-controls={ids.caixa} onClick={aoCorrigir}>
            {bloco.corrigir.rotulo}
          </button>
        )}
      </div>
      {bloco?.notaEstimativa && <span className="hub-nota hub-reg-nota-est">{bloco.notaEstimativa}</span>}
      {bloco?.campo && (
        <CampoTexto
          campoId={ids.caixa}
          id={ids.res}
          rotulo={bloco.campo.rotulo}
          valor={bloco.campo.valor}
          classe="hub-reg-curto"
          notaTexto={bloco.campo.nota}
          erro={erroRes}
          aoMudar={aoMudarRes}
        />
      )}
      {bloco?.custos && (
        <CampoTexto
          id={ids.custos}
          rotulo={
            <>
              {bloco.custos.rotulo} <span className="hub-opc">{FUTUROS.opcional}</span>
            </>
          }
          valor={bloco.custos.valor}
          decimal
          classe="hub-reg-curto"
          notaTexto={bloco.custos.nota}
          erro={erroCustos}
          aoMudar={aoMudarCustos}
        />
      )}
    </>
  )
}
