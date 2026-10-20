'use client'

import type { DisplayTz } from '@/lib/hub/regras'
import type { HubTheme } from '@/lib/hub/tema'
import { HORARIOS_OPCOES, PREFERENCIAS } from './copy'
import { EstadoCarga, Pilulas, type Carga } from './ui'

const TEMAS: readonly { valor: HubTheme; texto: string }[] = [
  { valor: 'claro', texto: PREFERENCIAS.claro },
  { valor: 'escuro', texto: PREFERENCIAS.escuro },
]

/** «Avisar ao chegar em 80% do limite do dia»: what the switch shows and does */
export interface Aviso80 {
  ligado: boolean
  /** The preferences have not answered yet: the switch waits (aria-disabled) */
  esperando: boolean
  /** «Com os limites atuais: …» / «Nenhuma conta tem limite do dia.»; null while the rules load */
  nota: string | null
  /** The last change could not be saved (the switch went back) */
  erro: boolean
  onAlternar: () => void
}

/**
 * «Preferências» (board #preferencias): Tema (instant, the same value as the header's «Modo
 * escuro»), «Horários na tela» (saved with the save bar) and, from Phase 3, «Avisar ao chegar em
 * 80% do limite do dia» (instant, like Tema; the exit banner of the Registrar reads it). Idioma and
 * the two other «Avisar …» switches come later.
 */
export default function Preferencias({
  tema,
  onTema,
  carga,
  onTentar,
  horarios,
  onHorarios,
  aviso80,
}: {
  tema: HubTheme
  onTema: (tema: HubTheme) => void
  carga: Carga
  onTentar: () => void
  horarios: DisplayTz | null
  onHorarios: (valor: DisplayTz) => void
  aviso80: Aviso80
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
        <li className="hub-pz-pref">
          <div className="hub-pz-pref__txt">
            <div id="p-aviso-limite" className="hub-pz-pref__nome">
              {PREFERENCIAS.aviso80}
            </div>
            {aviso80.nota && (
              <p id="p-aviso-limite-nota" className="hub-nota">
                {aviso80.nota}
              </p>
            )}
            {aviso80.erro && (
              <p role="alert" className="hub-erro">
                {PREFERENCIAS.aviso80Erro}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            className="hub-pz-chave"
            aria-checked={aviso80.ligado}
            aria-labelledby="p-aviso-limite"
            aria-describedby={aviso80.nota ? 'p-aviso-limite-nota' : undefined}
            aria-disabled={aviso80.esperando || undefined}
            onClick={() => {
              if (!aviso80.esperando) aviso80.onAlternar()
            }}
          >
            <span className="hub-pz-chave__tr" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
  )
}
