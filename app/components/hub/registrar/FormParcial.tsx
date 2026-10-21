'use client'

import type { CampoParcial, CamposParcial, ModeloParcial } from '@/lib/hub/registrarParciais'
import BlocoResultado from './BlocoResultado'
import { FUTUROS } from './copy'
import { PARCIAL } from './copyParciais'
import { CampoTexto, Erro, descrito } from './ui'

/** The result block's ids on «Parcial» (BlocoResultado's default ids are the exit's) */
export const IDS_PARCIAL = { res: 'f-pres', caixa: 'caixa-pres', custos: 'f-pcustos' }

/**
 * «Parcial» (Phase 3c, E24; RO l.526–544): the quantity (contracts: chips 1…open−1, or 1 2 3 and
 * «Outro» → «Quantos contratos?»; other units: the field and «Metade»), «Ficam … em aberto.», the
 * B3 lot note, the price and hour, the preview, «Corrigir» / the typed result. No «Custos» and no
 * «Venceu sem valor» on a partial. The model is registrarParciais' (modeloParcial).
 */
export default function FormParcial({
  modelo: m,
  campos: c,
  tentou,
  erroServidor,
  aoMudar,
}: {
  modelo: ModeloParcial
  campos: CamposParcial
  tentou: boolean
  /** A server refusal under its field (the local check let it through) */
  erroServidor: Partial<Record<CampoParcial, string>>
  aoMudar: (patch: Partial<CamposParcial>) => void
}) {
  const erro = (k: CampoParcial) => erroServidor[k] ?? (tentou ? m.erros[k] ?? null : null)
  const erroQtd = erro('pq')
  const focar = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())
  const campoQtd = (rotulo: string) => (
    <div className="hub-campo">
      <label htmlFor="f-pq" className="hub-rot-campo">
        {rotulo}
      </label>
      {m.chips ? (
        <input
          id="f-pq"
          className="hub-entrada hub-entrada--mono hub-reg-entrada hub-reg-curto"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={erroQtd ? true : undefined}
          aria-describedby={descrito('n-pq', erroQtd && 'e-pq')}
          value={c.qtd}
          onChange={(e) => aoMudar({ qtd: e.target.value })}
        />
      ) : (
        <div className="hub-rp-qtd">
          <input
            id="f-pq"
            className="hub-entrada hub-entrada--mono hub-reg-entrada hub-reg-curto"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={erroQtd ? true : undefined}
            aria-describedby={descrito('n-pq', erroQtd && 'e-pq')}
            value={c.qtd}
            onChange={(e) => aoMudar({ qtd: e.target.value })}
          />
          {m.metade && (
            <button
              type="button"
              className="hub-pill"
              onClick={() => {
                aoMudar({ qtd: m.metade as string })
                // The field is on screen already: the focus moves at once (RO js l.1588: «Metade» → f-pq)
                document.getElementById('f-pq')?.focus()
              }}
            >
              {PARCIAL.metade}
            </button>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {m.chips ? (
        <div className="hub-reg-grupo">
          <span id="l-pq" className="hub-rot-campo">
            {m.rotuloQtd}
          </span>
          <div role="group" aria-labelledby="l-pq" aria-describedby={descrito('n-pq', erroQtd && 'e-pq')} className="hub-pills">
            {m.chips.valores.map((v, j) => (
              <button
                key={v}
                id={`g-pq-${j}`}
                type="button"
                className="hub-pill hub-reg-pill-q"
                aria-pressed={!m.chips?.outroAberto && m.chips?.escolhido === v}
                onClick={() => aoMudar({ chip: v, outro: false })}
              >
                {v}
              </button>
            ))}
            {m.chips.outro && (
              <button
                id={`g-pq-${m.chips.valores.length}`}
                type="button"
                className="hub-pill hub-reg-pill-q"
                aria-pressed={m.chips.outroAberto}
                onClick={() => {
                  aoMudar({ outro: true })
                  focar('f-pq')
                }}
              >
                {FUTUROS.outro}
              </button>
            )}
          </div>
          {m.chips.outroAberto && campoQtd(m.chips.outroRotulo)}
          <Erro id="e-pq" texto={erroQtd} />
          <span id="n-pq" className="hub-nota" role="status">
            {m.ficam}
          </span>
        </div>
      ) : (
        <div className="hub-reg-grupo">
          {campoQtd(m.rotuloQtd)}
          <Erro id="e-pq" texto={erroQtd} />
          <span id="n-pq" className="hub-nota" role="status">
            {m.ficam}
          </span>
          {m.lote && <span className="hub-nota">{m.lote}</span>}
        </div>
      )}
      <div className="hub-campos2">
        <CampoTexto id="f-ppreco" rotulo={m.rotulos.preco} valor={c.preco} decimal aoMudar={(v) => aoMudar({ preco: v })} erro={erro('ppreco')} />
        <CampoTexto id="f-phora" rotulo={m.rotulos.hora} valor={m.horaCampo} tipo="time" aoMudar={(v) => aoMudar({ hora: v })} erro={erro('phora')} />
      </div>
      <BlocoResultado
        linha={m.bloco.linha}
        bloco={m.bloco}
        erroRes={erro('pres')}
        ids={IDS_PARCIAL}
        aoCorrigir={() => {
          const abrir = !c.corrigir
          aoMudar(abrir ? { corrigir: true, resultado: m.bloco.calculado ?? '' } : { corrigir: false, resultado: '' })
          if (abrir) focar(IDS_PARCIAL.res)
        }}
        aoMudarRes={(v) => aoMudar({ resultado: v })}
        aoMudarCustos={() => undefined}
      />
    </>
  )
}
