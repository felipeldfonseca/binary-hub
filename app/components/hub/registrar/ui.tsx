'use client'

import { createContext, useContext, useEffect, useRef } from 'react'
import { BUSY, FOLHA, FOLHA_REG } from './copy'

/**
 * Presentational pieces of «Registrar operação» (the board's classes, scoped in
 * styles/hub-registrar.css): pill groups, text fields, the mark-time chips, the plan pill and the
 * footer. They take props; the steps' containers own the state and the calls.
 */

// ------------------------------------------------------------------------------------------------
// The frame's context: closing with unsaved input, busy
// ------------------------------------------------------------------------------------------------

export interface FolhaValue {
  /** «Fechar sem salvar?» is on screen instead of the footer */
  saindo: boolean
  confirmarSaida: () => void
  ficar: () => void
  /** The step has something typed or unsaved (D12): closing asks first */
  marcarMexido: (mexido: boolean) => void
}

export const FolhaContext = createContext<FolhaValue>({
  saindo: false,
  confirmarSaida: () => undefined,
  ficar: () => undefined,
  marcarMexido: () => undefined,
})

export const useFolha = () => useContext(FolhaContext)

/** Tells the frame whether this step has unsaved input */
export function useMexido(mexido: boolean) {
  const { marcarMexido } = useFolha()
  useEffect(() => {
    marcarMexido(mexido)
  }, [mexido, marcarMexido])
  useEffect(() => () => marcarMexido(false), [marcarMexido])
}

// ------------------------------------------------------------------------------------------------
// Pills
// ------------------------------------------------------------------------------------------------

export interface Pill<T extends string | number> {
  valor: T
  rotulo: string
  aria?: string
  /** aria-disabled (focusable, says why on press) */
  desligada?: boolean
}

/**
 * A group of pill buttons (RO `.pills`): `role="group"` labelled by its title, each option a
 * `<button aria-pressed>`. Each pill has `id="g-{id}-{j}"` (where the focus goes on an error).
 */
export function GrupoPills<T extends string | number>({
  id,
  titulo,
  tituloClasse = 'hub-rot-campo',
  opcoes,
  valor,
  aoEscolher,
  descricao,
  classe = 'hub-pills',
  pillClasse,
  depois,
  extra,
  painel,
}: {
  id: string
  titulo: React.ReactNode
  tituloClasse?: string
  opcoes: readonly Pill<T>[]
  valor: T | null | undefined
  aoEscolher: (v: T) => void
  descricao?: string
  classe?: string
  pillClasse?: string
  /** Rendered after the pills (a field, a note, an error) */
  depois?: React.ReactNode
  /** Rendered next to the title (an info button) */
  extra?: React.ReactNode
  /** Rendered between the title and the pills (the info button's panel) */
  painel?: React.ReactNode
}) {
  return (
    <div className="hub-reg-grupo">
      {extra ? (
        <div className="hub-reg-cab hub-reg-cab--inicio">
          <span id={`l-${id}`} className={tituloClasse}>
            {titulo}
          </span>
          {extra}
        </div>
      ) : (
        <span id={`l-${id}`} className={tituloClasse}>
          {titulo}
        </span>
      )}
      {painel}
      <div role="group" aria-labelledby={`l-${id}`} aria-describedby={descricao || undefined} className={classe}>
        {opcoes.map((o, j) => (
          <button
            key={String(o.valor)}
            id={`g-${id}-${j}`}
            type="button"
            className={pillClasse ? `hub-pill ${pillClasse}` : 'hub-pill'}
            aria-pressed={valor === o.valor}
            aria-disabled={o.desligada || undefined}
            aria-label={o.aria}
            onClick={() => aoEscolher(o.valor)}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
      {depois}
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// Fields
// ------------------------------------------------------------------------------------------------

export function Erro({ id, texto }: { id: string; texto: string | null | undefined }) {
  if (!texto) return null
  return (
    <span id={id} className="hub-erro hub-reg-erro" role="alert">
      {texto}
    </span>
  )
}

/** aria-describedby of a field: its note and its error, when shown */
export const descrito = (...ids: (string | false | null | undefined)[]) => ids.filter(Boolean).join(' ') || undefined

export function CampoTexto({
  id,
  rotulo,
  valor,
  aoMudar,
  erro,
  nota,
  notaTexto,
  mono = true,
  tipo = 'text',
  decimal = false,
  estilo,
  classe,
  campoId,
  placeholder,
  max,
  aoSair,
}: {
  id: string
  rotulo: React.ReactNode
  valor: string
  aoMudar: (v: string) => void
  erro?: string | null
  /** The ids of notes that describe it (the risk line, the warning) */
  nota?: string
  /** 3-4: a note of its own under the field (`n-{campo}`), before its error: the result's, the costs', the lot note */
  notaTexto?: string | null
  mono?: boolean
  tipo?: 'text' | 'time' | 'date' | 'search'
  decimal?: boolean
  estilo?: React.CSSProperties
  /** 3-4: the field's width class (hub-reg-curto: 200 px; hub-reg-busca: 280 px) */
  classe?: string
  /** 3-4: the wrapper's id («caixa-res», what «Corrigir» controls) */
  campoId?: string
  placeholder?: string
  max?: string
  aoSair?: () => void
}) {
  const nome = id.replace(/^f-/, '')
  const erroId = `e-${nome}`
  const notaId = notaTexto ? `n-${nome}` : null
  const base = mono ? 'hub-entrada hub-entrada--mono hub-reg-entrada' : 'hub-entrada hub-reg-entrada'
  return (
    <div id={campoId} className="hub-campo">
      <label htmlFor={id} className="hub-rot-campo">
        {rotulo}
      </label>
      <input
        id={id}
        className={classe ? `${base} ${classe}` : base}
        type={tipo}
        inputMode={decimal ? 'decimal' : undefined}
        autoComplete="off"
        step={tipo === 'time' ? 60 : undefined}
        max={max}
        placeholder={placeholder}
        aria-invalid={erro ? true : undefined}
        aria-describedby={descrito(nota, notaId, erro && erroId)}
        value={valor}
        onChange={(event) => aoMudar(event.target.value)}
        onBlur={aoSair}
        style={estilo}
      />
      {notaId && (
        <span id={notaId} className="hub-nota">
          {notaTexto}
        </span>
      )}
      <Erro id={erroId} texto={erro} />
    </div>
  )
}

// ------------------------------------------------------------------------------------------------
// Chips and pills
// ------------------------------------------------------------------------------------------------

/** The time of a mark: «às 10:12 · antes da saída» (mint), «… · depois do resultado», dashed «agora conta…» */
export function Tempo({ id, texto, tipo }: { id?: string; texto: string; tipo: 'antes' | 'depois' | 'fraco' }) {
  return (
    <span id={id} className={`hub-reg-tempo hub-reg-tempo--${tipo}`}>
      {texto}
    </span>
  )
}

/** The plan pill: «No plano» / «● fora da janela» / «—» (sr «plano não avaliado») */
export function PlanoPill({ fora, noPlano, semPlano }: { fora: string | null; noPlano: string; semPlano: string }) {
  if (fora) {
    return (
      <span className="hub-reg-marca hub-reg-marca--fora">
        <span aria-hidden="true">●&nbsp;</span>
        {fora}
      </span>
    )
  }
  if (noPlano) return <span className="hub-reg-marca hub-reg-marca--ok">{noPlano}</span>
  return (
    <span className="hub-reg-marca hub-reg-marca--nada">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{semPlano}</span>
    </span>
  )
}

// ------------------------------------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------------------------------------

export interface Acao {
  rotulo: string
  aoClicar: () => void
  /** aria-disabled (busy) */
  ocupado?: boolean
  /** Where the focus goes back to (D30's «Não») */
  id?: string
}

/** Step 1's primary button («Registrar entrada» / «Registrar operação») */
export const PRIMARIA_ID = 'reg-primaria'

/**
 * Keeps the footer's height in the sheet's `--reg-rodape-h`: on phones the footer sticks to the bottom
 * and the sheet's scroll-padding-bottom uses it, so a focused field (Tab, the first refused field, D30's
 * question) is scrolled above the footer instead of under it (WCAG 2.4.11).
 */
function useAlturaRodape(ref: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current
    const folha = el?.closest<HTMLElement>('.hub-folha')
    if (!el || !folha || typeof ResizeObserver === 'undefined') return
    const medir = () => folha.style.setProperty('--reg-rodape-h', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    medir()
    const observer = new ResizeObserver(medir)
    observer.observe(el)
    return () => {
      observer.disconnect()
      folha.style.removeProperty('--reg-rodape-h')
    }
  }, [ref])
}

/**
 * The footer (RO l.1641–1645): a left button, the primary on the right, «Um momento…» while a call
 * runs, and «O Binary Hub não envia ordens…» under it. While «Fechar sem salvar?» is asked, the
 * question takes its place.
 */
export function Rodape({ esquerda, primaria, ocupado }: { esquerda?: Acao | null; primaria?: Acao | null; ocupado?: boolean }) {
  const { saindo, confirmarSaida, ficar } = useFolha()
  const simRef = useRef<HTMLButtonElement>(null)
  const rodapeRef = useRef<HTMLDivElement>(null)
  useAlturaRodape(rodapeRef)
  useEffect(() => {
    if (saindo) simRef.current?.focus()
  }, [saindo])
  return (
    <>
      {/* Sticky at the bottom on phones (D13); the note under it scrolls with the step */}
      <div ref={rodapeRef} className="hub-reg-rodape">
        {saindo ? (
          <div className="hub-bloco hub-bloco--atencao" role="group" aria-labelledby="t-sair">
            <span id="t-sair" style={{ fontWeight: 700 }}>
              {FOLHA.leaveQuestion}
            </span>
            <div className="hub-acoes">
              <button ref={simRef} type="button" className="hub-btn hub-btn--pri" onClick={confirmarSaida}>
                {FOLHA.leaveYes}
              </button>
              <button type="button" className="hub-btn" onClick={ficar}>
                {FOLHA.leaveNo}
              </button>
            </div>
          </div>
        ) : (
          (esquerda || primaria) && (
            <div className="hub-rodape">
              {esquerda && (
                <button type="button" className="hub-btn" aria-disabled={esquerda.ocupado || undefined} onClick={esquerda.aoClicar}>
                  {esquerda.rotulo}
                </button>
              )}
              {primaria && (
                <div className="hub-rodape__dir">
                  <button
                    id={primaria.id}
                    type="button"
                    className="hub-btn hub-btn--pri"
                    aria-disabled={primaria.ocupado || undefined}
                    aria-describedby={ocupado ? 'reg-ocupado' : undefined}
                    onClick={primaria.aoClicar}
                  >
                    {primaria.rotulo}
                  </button>
                </div>
              )}
            </div>
          )
        )}
        <p id="reg-ocupado" role="status" className={ocupado ? 'hub-nota' : 'sr-only'}>
          {ocupado ? BUSY : ''}
        </p>
      </div>
      <span className="hub-nota hub-reg-naoenvia">{FOLHA_REG.naoEnvia}</span>
    </>
  )
}

/** A region a screen reader always has (empty until there is something to say) */
export function Anuncio({ texto, id }: { texto: string; id?: string }) {
  return (
    <div id={id} role="status" className="sr-only">
      {texto}
    </div>
  )
}
