'use client'

import { useRef, useState } from 'react'
import { useAddMarks } from '@/hooks/useRegistrar'
import type { Marks } from '@/lib/domain/registro'
import type { TradeView } from '@/lib/hub/registrarDb'
import { MARCA_VALORES, anuncioMarca, marcasAtuais, valorMarca, type ContaReg, type MarcaKind } from '@/lib/hub/registrarForm'
import { MARCAS } from './copy'
import { GrupoPills, Tempo } from './ui'

const TITULO: Record<MarcaKind, string> = { setup: MARCAS.setup, execucao: MARCAS.execucao, emocao: MARCAS.emocao }

/** The pills of one kind of mark (Setup A B C; Execução cedo, no ponto, tarde; the five emotions) */
export function PillsMarca({
  id,
  kind,
  valor,
  aoEscolher,
  titulo,
  tituloClasse,
  chip,
  descricao,
  extra,
  painel,
}: {
  id: string
  kind: MarcaKind
  valor: string | null
  aoEscolher: (v: string) => void
  titulo?: string
  tituloClasse?: string
  chip?: { texto: string; tipo: 'antes' | 'depois' | 'fraco' } | null
  descricao?: string
  /** Next to the title (an info button) */
  extra?: React.ReactNode
  /** Under the title (its info panel) */
  painel?: React.ReactNode
}) {
  return (
    <GrupoPills
      id={id}
      titulo={titulo ?? TITULO[kind]}
      tituloClasse={tituloClasse}
      opcoes={MARCA_VALORES[kind].map((v) => ({
        valor: v,
        rotulo: valorMarca(kind, v),
        aria: kind === 'setup' ? MARCAS.setupAria(v) : undefined,
      }))}
      valor={valor}
      aoEscolher={aoEscolher}
      descricao={descricao}
      extra={extra}
      painel={painel}
      classe={kind === 'setup' ? 'hub-pills hub-reg-abc' : 'hub-pills'}
      depois={chip ? <Tempo id={descricao} texto={chip.texto} tipo={chip.tipo} /> : null}
    />
  )
}

/**
 * Marks on a registered trade (steps 2 and 3): one tap = one add_marks call on the server's clock
 * (registrar.md §8). The pill shows the tap at once, its chip says «salvando…» until the answer; a
 * failure puts the pill back and says so. A tap on the selected value is «desmarcar» (null). Taps
 * wait for the one before (C11): a mark is not idempotent, so a double tap must not send twice.
 */
export function useMarcar(conta: ContaReg, view: TradeView | null) {
  const add = useAddMarks()
  const [pendente, setPendente] = useState<{ kind: MarcaKind; valor: string | null } | null>(null)
  const [erro, setErro] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const ocupado = useRef(false)
  const atuais = marcasAtuais(view?.marksNow ?? [])

  const valor = (kind: MarcaKind): string | null => (pendente && pendente.kind === kind ? pendente.valor : atuais[kind]?.currentValue ?? null)

  const marcar = async (kind: MarcaKind, v: string) => {
    if (!view || ocupado.current) return
    const novo = valor(kind) === v ? null : v
    ocupado.current = true
    setErro(false)
    setPendente({ kind, valor: novo })
    try {
      const state = await add.mutateAsync({ tradeId: view.trade.id, marks: { [kind]: novo } as Marks })
      setAnuncio(anuncioMarca(conta, kind, marcasAtuais(state.marksNow)[kind], state.serverNow))
    } catch {
      setErro(true)
    } finally {
      ocupado.current = false
      setPendente(null)
    }
  }

  return { valor, marcar, pendente, erro, anuncio, atuais }
}

export type Marcar = ReturnType<typeof useMarcar>

/** «A marca não foi salva. Tente de novo.» and the screen reader's announcement of a saved mark */
export function AvisosMarca({ m }: { m: Marcar }) {
  return (
    <>
      {m.erro && (
        <p className="hub-erro hub-reg-erro" role="alert">
          {MARCAS.falhou}
        </p>
      )}
      <div role="status" className="sr-only">
        {m.anuncio}
      </div>
    </>
  )
}
