'use client'

import type { ModeloOpcao, Rascunho } from '@/lib/hub/registrarForm'
import { OPCAO } from './copy'
import { CampoTexto, Erro, GrupoPills, descrito, type Pill } from './ui'

/**
 * The option block (Ações e opções, RO l.345–356, 1051–1053, 1126–1127, 1153–1159; copy OPCAO):
 * «Tipo» (Call / Put), «Strike, US$», «Vencimento» («Hoje» or the day, «Sexta, 16 out») and «Outra
 * data» (min = the day). Lane A renders it after the instrument block («Cotada em»/chips), before
 * «Lado», when the model's `opcao` is not null. Changing the expiry turns «Venceu sem valor» off
 * (registrarForm.mudarVencimento, applied by whoever renders it).
 *
 * Ids (the focus order, ORDEM_PRECOS): the first «Tipo» pill `g-opTipo-0`, the strike field
 * `f-strike`, the first «Vencimento» pill `g-venc-0`, the date field `f-venc`; errors `e-opTipo`,
 * `e-strike`, `e-venc` (m.erros: the visible ones, after a «Registrar» tap), each `role="alert"` and
 * named by its group's or field's aria-describedby. «Strike» is at most 200 px wide and «Outra
 * data» 180 px (RO l.347, 352); the pills wrap.
 */
export interface BlocoOpcaoProps {
  m: ModeloOpcao
  aoMudar: (patch: Partial<Pick<Rascunho, 'opTipo' | 'strike' | 'vencimento'>>) => void
}

const TIPOS: readonly Pill<'call' | 'put'>[] = [
  { valor: 'call', rotulo: OPCAO.call },
  { valor: 'put', rotulo: OPCAO.put },
]

export default function BlocoOpcao({ m, aoMudar }: BlocoOpcaoProps): JSX.Element {
  const { opTipo: erroTipo, strike: erroStrike, venc: erroVenc } = m.erros
  return (
    <>
      <GrupoPills
        id="opTipo"
        titulo={OPCAO.tipo}
        opcoes={TIPOS}
        valor={m.tipo}
        aoEscolher={(opTipo) => aoMudar({ opTipo })}
        descricao={descrito(erroTipo && 'e-opTipo')}
        depois={<Erro id="e-opTipo" texto={erroTipo} />}
      />
      <CampoTexto
        id="f-strike"
        rotulo={OPCAO.strike}
        valor={m.strike}
        aoMudar={(strike) => aoMudar({ strike })}
        erro={erroStrike}
        decimal
        estilo={{ maxWidth: 200 }}
      />
      <div className="hub-reg-grupo">
        <span id="l-venc" className="hub-rot-campo">
          {OPCAO.vencimento}
        </span>
        <div className="hub-reg-venc">
          <div role="group" aria-labelledby="l-venc" aria-describedby={descrito(erroVenc && 'e-venc')} className="hub-pills">
            {m.chips.map((c, j) => (
              <button
                key={c.valor}
                id={`g-venc-${j}`}
                type="button"
                className="hub-pill"
                aria-pressed={m.vencimento === c.valor}
                onClick={() => aoMudar({ vencimento: c.valor })}
              >
                {c.rotulo}
              </button>
            ))}
          </div>
          <div className="hub-campo">
            <label htmlFor="f-venc" className="hub-rot-campo">
              {OPCAO.outraData}
            </label>
            <input
              id="f-venc"
              className="hub-entrada hub-entrada--mono hub-reg-entrada hub-reg-venc-data"
              type="date"
              min={m.min}
              aria-invalid={erroVenc ? true : undefined}
              aria-describedby={descrito(erroVenc && 'e-venc')}
              value={m.vencimento ?? ''}
              onChange={(event) => aoMudar({ vencimento: event.target.value || null })}
            />
          </div>
        </div>
        <Erro id="e-venc" texto={erroVenc} />
      </div>
    </>
  )
}
