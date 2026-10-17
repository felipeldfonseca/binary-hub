import { INDICE } from './copy'

/** The section index (board nav.indice): beside the cards on wide screens, above them on narrow ones */
export default function IndiceSecoes() {
  return (
    <nav className="hub-pz-indice" aria-label={INDICE.aria}>
      {INDICE.links.map((l) => (
        <a key={l.href} href={l.href} className="hub-pz-indice__link">
          {l.texto}
        </a>
      ))}
      <p className="hub-pz-indice__nota">{INDICE.nota}</p>
    </nav>
  )
}
