'use client'

import { CALENDAR_CODES, type CalendarCode } from '@/lib/domain/gate'
import { CALENDARIO_NOME, CALENDARIOS } from './copy'

/** «Calendários econômicos» (board .bloco under the rules): one choice for all accounts, saved with the bar */
export default function Calendarios({ marcados, onMarcar }: { marcados: readonly CalendarCode[]; onMarcar: (code: CalendarCode, on: boolean) => void }) {
  return (
    <div className="hub-pz-quadro">
      <div className="hub-pz-quadro__cab">
        <h3 id="r-calendarios">{CALENDARIOS.titulo}</h3>
        <span className="hub-tag hub-tag--todas">{CALENDARIOS.todas}</span>
      </div>
      <p className="hub-nota hub-pz-quadro__nota">{CALENDARIOS.nota}</p>
      <div role="group" aria-labelledby="r-calendarios" className="hub-pz-cals">
        {CALENDAR_CODES.map((c) => (
          <label key={c} className="hub-check">
            <input type="checkbox" checked={marcados.includes(c)} onChange={(event) => onMarcar(c, event.target.checked)} />
            {CALENDARIO_NOME[c]}
          </label>
        ))}
      </div>
      <p role="status" className="hub-nota">
        {marcados.length === 0 ? CALENDARIOS.nenhum : ''}
      </p>
    </div>
  )
}
