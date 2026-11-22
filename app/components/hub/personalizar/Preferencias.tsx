'use client'

import type { DisplayTz } from '@/lib/hub/regras'
import type { HubTheme } from '@/lib/hub/tema'
import { HORARIOS_OPCOES, PREFERENCIAS } from './copy'
import { EstadoCarga, Pilulas, type Carga } from './ui'

const TEMAS: readonly { valor: HubTheme; texto: string }[] = [
  { valor: 'claro', texto: PREFERENCIAS.claro },
  { valor: 'escuro', texto: PREFERENCIAS.escuro },
]

/** An «Avisar …» switch (80 % of the limit; from Phase 5-1, the 10 minutes before a data wait): what it shows and does */
export interface AvisoPreferencia {
  ligado: boolean
  /** The preferences have not answered yet: the switch waits (aria-disabled) */
  esperando: boolean
  /** The sentence under it («Com os limites atuais: …», «Hoje: às 08:15, antes da espera do CPI.»); null while unknown */
  nota: string | null
  /** The last change could not be saved (the switch went back) */
  erro: boolean
  onAlternar: () => void
}

/** @deprecated name kept for the Phase 3 readers */
export type Aviso80 = AvisoPreferencia

/** One «Avisar …» row: its name, the sentence, the error and the switch */
function LinhaAviso({ id, nome, aviso }: { id: string; nome: string; aviso: AvisoPreferencia }) {
  return (
    <li className="hub-pz-pref">
      <div className="hub-pz-pref__txt">
        <div id={id} className="hub-pz-pref__nome">
          {nome}
        </div>
        {aviso.nota && (
          <p id={`${id}-nota`} className="hub-nota">
            {aviso.nota}
          </p>
        )}
        {aviso.erro && (
          <p role="alert" className="hub-erro">
            {PREFERENCIAS.aviso80Erro}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        className="hub-pz-chave"
        aria-checked={aviso.ligado}
        aria-labelledby={id}
        aria-describedby={aviso.nota ? `${id}-nota` : undefined}
        aria-disabled={aviso.esperando || undefined}
        onClick={() => {
          if (!aviso.esperando) aviso.onAlternar()
        }}
      >
        <span className="hub-pz-chave__tr" aria-hidden="true" />
      </button>
    </li>
  )
}

/**
 * «Preferências» (board #preferencias): Tema (instant, the same value as the header's «Modo
 * escuro»), «Horários na tela» (saved with the save bar) and, from Phase 3, «Avisar ao chegar em
 * 80% do limite do dia» (instant, like Tema; the exit banner of the Registrar reads it). Phase 5-1:
 * «Avisar 10 minutos antes de uma espera de dado econômico» (instant, on unless saved off; before the
 * 80 % one, the approved board's order, Q39). Idioma and «Avisar quando um ativo mudar de estado» come later.
 */
export default function Preferencias({
  tema,
  onTema,
  carga,
  onTentar,
  horarios,
  onHorarios,
  aviso80,
  avisoDado,
}: {
  tema: HubTheme
  onTema: (tema: HubTheme) => void
  carga: Carga
  onTentar: () => void
  horarios: DisplayTz | null
  onHorarios: (valor: DisplayTz) => void
  aviso80: AvisoPreferencia
  /** Phase 5-1; absent: the row is not drawn */
  avisoDado?: AvisoPreferencia
}) {
  return (
    <section id="preferencias" aria-labelledby="t-preferencias" className="hub-card">
      <div className="hub-cab">
        <h2 id="t-preferencias">{PREFERENCIAS.titulo}</h2>
      </div>
      <ul className="hub-pz-prefs">
        <li className="hub-pz-pref">
          <div className="hub-pz-pref__txt">
            <div id="p-tema" className="hub-pz-pref__nome">
              {PREFERENCIAS.tema}
            </div>
            <p className="hub-nota">{PREFERENCIAS.temaNota}</p>
          </div>
          <Pilulas opcoes={TEMAS} valor={tema} onEscolher={onTema} rotuloId="p-tema" className="hub-pz-seg hub-pz-seg--tema" />
        </li>
        <li className="hub-pz-pref">
          <div className="hub-pz-pref__txt">
            <div id="p-horarios" className="hub-pz-pref__nome">
              {PREFERENCIAS.horarios}
            </div>
            <p className="hub-nota">{PREFERENCIAS.horariosNota}</p>
          </div>
          {carga === 'pronto' && horarios ? (
            <Pilulas opcoes={HORARIOS_OPCOES} valor={horarios} onEscolher={onHorarios} rotuloId="p-horarios" className="hub-pz-seg" />
          ) : (
            <EstadoCarga carga={carga === 'erro' ? 'erro' : 'carregando'} onTentar={onTentar} />
          )}
        </li>
        {avisoDado && <LinhaAviso id="p-aviso-dado" nome={PREFERENCIAS.avisoDado} aviso={avisoDado} />}
        <LinhaAviso id="p-aviso-limite" nome={PREFERENCIAS.aviso80} aviso={aviso80} />
      </ul>
    </section>
  )
}
