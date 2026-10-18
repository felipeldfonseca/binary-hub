import type { ComoFicaHoje as Dados } from '@/lib/hub/comoFicaHoje'
import { HOJE } from './copy'

/**
 * «Como fica hoje» (board .bloco under the rules): the selected entity's day under the unsaved
 * draft. No live region: it changes as you type.
 */
export default function ComoFicaHoje({ dados }: { dados: Dados }) {
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
            <span className={`hub-pz-hoje__s hub-tom--${l.tom}${l.forte ? '' : ' hub-pz-hoje__s--leve'}`}>
              {l.estado}
              {l.sub && <small>{l.sub}</small>}
            </span>
          </li>
        ))}
      </ul>
      {dados.aviso && <p className="hub-pz-aviso">{dados.aviso}</p>}
    </div>
  )
}
