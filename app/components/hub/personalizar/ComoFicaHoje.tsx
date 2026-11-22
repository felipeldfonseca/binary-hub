import { useState } from 'react'
import { PROXIMOS_VISIVEIS, type ComoFicaHoje as Dados, type LinhaProximo } from '@/lib/hub/comoFicaHoje'
import { HOJE, PROXIMOS } from './copy'

/** «Próximos dados» as Suas regras reads it (E6): loading, failed, or the lines and the closing line */
export type ProximosLidos = { estado: 'carregando' } | { estado: 'erro' } | { estado: 'pronto'; linhas: LinhaProximo[]; depoisDe: string }

/**
 * «Como fica hoje» (board .bloco under the rules): the selected entity's day under the unsaved
 * draft, with the day's releases where the market has «Dados econômicos» (Phase 5-1, c3 §4.2), and
 * «Próximos dados» under the lines of today (c3 §4.3; board Q23). No live region: it changes as you type.
 */
export default function ComoFicaHoje({ dados, proximos = null, onTentar }: { dados: Dados; proximos?: ProximosLidos | null; onTentar?: () => void }) {
  return (
    <div className="hub-pz-quadro">
      <div className="hub-pz-quadro__cab">
        <h3 id="r-hoje">{HOJE.titulo}</h3>
        {dados.sub && <span className="hub-nota">{dados.sub}</span>}
      </div>
      <ul className="hub-pz-hoje" aria-labelledby="r-hoje">
        {dados.linhas.map((l, i) => (
          <li key={i}>
            <span className="hub-pz-hoje__q">
              {l.esquerda.map((t, j) => (
                <span key={j} className={[t.mono ? 'hub-pz-num' : '', t.fraco ? 'hub-tom--muted' : ''].filter(Boolean).join(' ') || undefined}>
                  {t.t}
                </span>
              ))}
            </span>
            {(l.estado || l.sub) && (
              <span className={`hub-pz-hoje__s hub-tom--${l.tom}${l.forte ? '' : ' hub-pz-hoje__s--leve'}`}>
                {l.estado}
                {l.sub && <small>{l.sub}</small>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {dados.aviso && <p className="hub-pz-aviso">{dados.aviso}</p>}
      {proximos && <Proximos proximos={proximos} onTentar={onTentar} />}
    </div>
  )
}

/** «Próximos dados»: 5 lines, «Mostrar mais» opens the rest of the 14 days; the closing grey line */
function Proximos({ proximos, onTentar }: { proximos: ProximosLidos; onTentar?: () => void }) {
  const [todos, setTodos] = useState(false)
  if (proximos.estado === 'carregando') return null
  return (
    <>
      <div className="hub-pz-quadro__cab">
        <h3 id="r-prox">{PROXIMOS.titulo}</h3>
      </div>
      {proximos.estado === 'erro' ? (
        <div className="hub-dd-prox-erro">
          <p className="hub-nota">{PROXIMOS.semAgenda}</p>
          {onTentar && (
            <div>
              <button type="button" className="hub-btn" onClick={onTentar}>
                {PROXIMOS.tentar}
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <ul className="hub-pz-hoje hub-dd-prox" aria-labelledby="r-prox">
            {(todos ? proximos.linhas : proximos.linhas.slice(0, PROXIMOS_VISIVEIS)).map((l, i) => (
              <li key={i}>
                <span className={`hub-pz-hoje__q${l.cinza ? ' hub-tom--muted' : ''}`}>
                  <span className="hub-dd-prox__cab">
                    {l.cabeca}
                    {l.hora && <span className="hub-pz-num">{l.hora}</span>}
                  </span>
                  {(l.comportamento || l.texto) && (
                    <span className="hub-dd-prox__linha">
                      {l.comportamento ?? l.texto}
                      {l.espera && <span className="hub-pz-num">{l.espera}</span>}
                    </span>
                  )}
                  {l.naoToca && <span className="hub-dd-prox__linha hub-tom--muted">{PROXIMOS.naoToca}</span>}
                </span>
              </li>
            ))}
          </ul>
          {proximos.linhas.length > 0 && <p className="hub-nota">{proximos.depoisDe}</p>}
          {!todos && proximos.linhas.length > PROXIMOS_VISIVEIS && (
            <div>
              <button type="button" className="hub-btn" onClick={() => setTodos(true)}>
                {PROXIMOS.mostrarMais}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
