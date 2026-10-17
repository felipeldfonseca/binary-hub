'use client'

import type { DisplayTz } from '@/lib/hub/regras'
import type { HubTheme } from '@/lib/hub/tema'
import { HORARIOS_OPCOES, PREFERENCIAS } from './copy'
import { EstadoCarga, Pilulas, type Carga } from './ui'

const TEMAS: readonly { valor: HubTheme; texto: string }[] = [
  { valor: 'claro', texto: PREFERENCIAS.claro },
  { valor: 'escuro', texto: PREFERENCIAS.escuro },
]

/**
 * «Preferências» (board #preferencias), Phase 2 rows only: Tema (instant, the same value as the
 * header's «Modo escuro») and «Horários na tela» (saved with the save bar). Idioma and the
 * «Avisar …» switches come later.
 */
export default function Preferencias({
  tema,
  onTema,
  carga,
  onTentar,
  horarios,
  onHorarios,
}: {
  tema: HubTheme
  onTema: (tema: HubTheme) => void
  carga: Carga
  onTentar: () => void
  horarios: DisplayTz | null
  onHorarios: (valor: DisplayTz) => void
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
      </ul>
    </section>
  )
}
