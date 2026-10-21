'use client'

import type { ModeloEntrada } from '@/lib/hub/registrarForm'
import type { ModeloSaidas } from '@/lib/hub/registrarSaidas'
import { SAIDAS } from './copy'
import { CampoTexto, Erro } from './ui'

export interface SaidasJaFechadaProps {
  /** registrarSaidas.comSaidas's model: `outra`, `saidas` */
  m: Pick<ModeloSaidas, 'outra' | 'saidas'>
  /** The exit fields' labels («Preço de saída», «Hora da saída (ET)»; modeloEntrada.rotulos) */
  rotulos: ModeloEntrada['rotulos']
  aoOutra: () => void
  aoRemover: (id: number) => void
  aoMudar: (id: number, campo: 'qtd' | 'preco' | 'hora' | 'res', valor: string) => void
}

/**
 * Phase 3c · «Já fechada» in several exits (RO l.384–398, js l.1353–1382; contract §6.3, E2–E6): each
 * row a dashed card (`role=group` named by «1ª saída») with «Remover», its quantity (120 px), price
 * | hour and, where the result is typed, «Resultado desta saída»; then «+ Outra saída» (44 px; at 20
 * rows `aria-disabled` with «Até 20 saídas por operação.»), the sum (`role=status`) and its error
 * (`#e-soma`, `role=alert`, after a tap). With one exit only «+ Outra saída» shows here (the
 * single exit's fields stay CamposPrecos'). Where the focus goes is the caller's (the transitions
 * of registrarSaidas name it).
 */
export default function SaidasJaFechada({ m, rotulos, aoOutra, aoRemover, aoMudar }: SaidasJaFechadaProps) {
  const s = m.saidas
  const cheio = !!m.outra?.desabilitada
  return (
    <>
      {s &&
        s.linhas.map((l) => (
          <div key={l.id} className="hub-reg-editor hub-rs-saida" role="group" aria-labelledby={`l-s${l.id}`}>
            <div className="hub-reg-cab">
              <span id={`l-s${l.id}`} className="hub-rs-rot">
                {l.rotulo}
              </span>
              <button type="button" id={`rm-s${l.id}`} className="hub-reg-link" aria-label={l.removerAria} onClick={() => aoRemover(l.id)}>
                {SAIDAS.remover}
              </button>
            </div>
            <CampoTexto
              id={`f-s${l.id}q`}
              rotulo={s.qRotulo}
              valor={l.qtd}
              decimal
              classe="hub-rs-qtd"
              erro={l.erros.q}
              aoMudar={(v) => aoMudar(l.id, 'qtd', v)}
            />
            <div className="hub-campos2">
              <CampoTexto id={`f-s${l.id}p`} rotulo={rotulos?.precoSaida} valor={l.preco} decimal erro={l.erros.p} aoMudar={(v) => aoMudar(l.id, 'preco', v)} />
              <CampoTexto id={`f-s${l.id}h`} rotulo={rotulos?.horaSaida} valor={l.hora} tipo="time" erro={l.erros.h} aoMudar={(v) => aoMudar(l.id, 'hora', v)} />
            </div>
            {s.res && (
              <CampoTexto
                id={`f-s${l.id}r`}
                rotulo={s.res.rotulo}
                valor={l.res}
                classe="hub-reg-curto"
                notaTexto={s.res.nota}
                erro={l.erros.r}
                aoMudar={(v) => aoMudar(l.id, 'res', v)}
              />
            )}
          </div>
        ))}
      {m.outra && (
        <div className="hub-reg-cab hub-reg-cab--inicio">
          <button
            type="button"
            id="b-outra"
            className="hub-reg-link"
            aria-disabled={cheio || undefined}
            aria-describedby={cheio ? 'n-max' : undefined}
            onClick={() => {
              if (!cheio) aoOutra()
            }}
          >
            {SAIDAS.outra}
          </button>
          {cheio && (
            <span id="n-max" className="hub-nota">
              {SAIDAS.maximo}
            </span>
          )}
        </div>
      )}
      {s && (
        <>
          <span className="hub-nota hub-num hub-rs-soma" role="status">
            {s.soma}
          </span>
          <Erro id="e-soma" texto={s.somaErro} />
        </>
      )}
    </>
  )
}
