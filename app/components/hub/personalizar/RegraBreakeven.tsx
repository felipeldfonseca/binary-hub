'use client'

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { QueryClientContext, useQuery } from '@tanstack/react-query'
import { useHubDb } from '@/hooks/useContas'
import { breakevenJson, readBreakevenN, type AccountConfig, type RulesSettings } from '@/lib/hub/regras'
import { PADRAO_FUTUROS, breakevenEfetivo, breakevenMudou, comBreakeven, comBreakevenAtivo, comBreakevenLigado, type Entidade } from '@/lib/hub/rascunho'
import { formatDecimal } from '@/lib/hub/numero'
import { fetchRecentTrades } from '@/lib/hub/registrarDb'
import { RAIZES_BREAKEVEN, linhasBreakeven, raizesLivres, raizesMaisOperadas, type RaizBreakeven } from '@/lib/hub/personalizarBreakeven'
import { PADRAO_DE_FUTUROS, REGRAS, REGRAS_BE, SO_NESTA_CONTA } from './copy'
import { TagNaoSalvo, useFocoPendente } from './ui'

type Editar = (fn: (draft: RulesSettings) => RulesSettings) => void

export interface RegraBreakevenProps {
  /** «Padrão Futuros» or a futures account */
  entidade: Entidade
  draft: RulesSettings
  /** The saved settings («não salvo» compares with them) */
  salvo: RulesSettings
  onEditar: Editar
  /** The active futures accounts («Padrão Futuros» reads their last trades for the first switch-on) */
  futuros: readonly AccountConfig[]
}

/** What the row holds beside the draft (contract §12.5): the draft's `by` holds valid values only */
interface Local {
  /** Assets added in this editing session, in the order added: with a value, or pending (no value yet) */
  sessao: string[]
  /** The fields' texts as typed; absent = the draft's value */
  textos: Record<string, string>
  /** On blur: the value came back (`volta`), or the error stays (`volta` null) */
  msg: { key: string; volta: string | null } | null
}

const VAZIO: Local = { sessao: [], textos: {}, msg: null }

/** The setting as the database compares it, and whether it is the account's own */
const canonDe = (s: RulesSettings, e: Entidade) => {
  const { setting, propria } = breakevenEfetivo(s, e)
  return `${propria ? 'p' : 'h'}:${JSON.stringify(breakevenJson(setting))}`
}

/**
 * The first switch-on's roots (E51): the entity's futures accounts' last 200 trades each, read only
 * while the rule has no asset (lazy; 5 min fresh). Mounted only under a QueryClient (a section
 * rendered alone, as in its tests, has none: «MES»).
 */
function LerRaizes({ ids, aoLer }: { ids: readonly string[]; aoLer: (r: RaizBreakeven[] | null) => void }) {
  const { db, userId } = useHubDb()
  const q = useQuery({
    queryKey: ['hub', userId, 'personalizar', 'raizes', ids],
    queryFn: async () => raizesMaisOperadas((await Promise.all(ids.map((id) => fetchRecentTrades(db, id, 200)))).flat()),
    enabled: !!userId && ids.length > 0,
    staleTime: 5 * 60_000,
  })
  useEffect(() => {
    aoLer(q.data ?? null)
  }, [q.data, aoLer])
  return null
}

/**
 * Fase 3c · Suas regras › «Durante a operação» › «Mover para o breakeven» (Personalizar approved 21
 * Oct, P l.604–639, js P l.2289–2338; telas contract §6.5, E40–E51), for «Padrão Futuros» and futures
 * accounts: the group (h4 + note), the rule's row (name, «padrão de Futuros» / «só nesta conta»,
 * «não salvo»), the switch and its state; while on: «Sem ativo» or the lines (asset, «+», a 76 px
 * field, «pts», «Remover»; the error at once while the text is refused; on blur a refused text goes
 * back to the value it had when focused, with a note), «Adicionar ativo» (the table's roots not
 * listed) and the note; «Voltar ao padrão» on an account with its own copy. Valid values go to the
 * draft at once (rascunho.comBreakevenAtivo); pending lines and refused text live here and count as
 * «não salvo», as on the board (the save bar follows the draft only: contract §12.8).
 */
export default function RegraBreakeven({ entidade, draft, salvo, onEditar, futuros }: RegraBreakevenProps) {
  const id = entidade.tipo === 'padrao' ? PADRAO_FUTUROS : entidade.conta.id
  const [porEntidade, setPorEntidade] = useState<Record<string, Local>>({})
  const local = porEntidade[id] ?? VAZIO
  const setLocal = useCallback((fn: (l: Local) => Local) => setPorEntidade((p) => ({ ...p, [id]: fn(p[id] ?? VAZIO) })), [id])
  const pedirFoco = useFocoPendente()
  /** The field focused and its text then (the value a refused text goes back to) */
  const focoRef = useRef<{ key: string; texto: string } | null>(null)
  const raizesRef = useRef<RaizBreakeven[] | null>(null)
  const aoLer = useCallback((r: RaizBreakeven[] | null) => {
    raizesRef.current = r
  }, [])
  const cliente = useContext(QueryClientContext)

  // A save landed: the pending lines and refused texts go (the board's save drops them)
  const salvoRef = useRef(salvo)
  useEffect(() => {
    if (salvoRef.current !== salvo) {
      salvoRef.current = salvo
      setPorEntidade({})
    }
  }, [salvo])

  // The setting changed from outside this row («Descartar», another tab's rules): start over too
  const canon = canonDe(draft, entidade)
  const vistoRef = useRef({ id, canon })
  const esperadoRef = useRef<string | null>(null)
  useEffect(() => {
    const visto = vistoRef.current
    if (visto.id === id && visto.canon !== canon && esperadoRef.current !== canon) setLocal(() => VAZIO)
    vistoRef.current = { id, canon }
    esperadoRef.current = null
  }, [id, canon, setLocal])

  const editar = (fn: (d: RulesSettings) => RulesSettings) => {
    esperadoRef.current = canonDe(fn(draft), entidade)
    onEditar(fn)
  }

  const { setting, propria } = breakevenEfetivo(draft, entidade)
  const on = setting.on
  const linhas = linhasBreakeven(setting.by, local.sessao)
  const texto = (k: string) => local.textos[k] ?? (setting.by[k] !== undefined ? formatDecimal(setting.by[k]) : '')
  const valida = (t: string) => readBreakevenN(t).ok
  const naoSalvo = breakevenMudou(salvo, draft, entidade) || linhas.some((k) => !valida(texto(k)))
  const livres = raizesLivres(linhas)
  const conta = entidade.tipo === 'conta' ? entidade.conta : null
  const ids = conta ? [conta.id] : futuros.map((a) => a.id)

  const alternar = () => {
    if (!on && linhas.length === 0) {
      // The first time: one line for each root the entity traded most (≤ 3); none → MES
      const raizes = raizesRef.current?.length ? raizesRef.current : (['MES'] as RaizBreakeven[])
      setLocal((l) => ({ ...l, sessao: [...raizes], msg: null }))
      editar((d) => comBreakevenLigado(d, entidade, true))
      pedirFoco(`be-${raizes[0]}`)
    } else editar((d) => comBreakevenLigado(d, entidade, !on))
  }

  const mudar = (k: string, v: string) => {
    setLocal((l) => ({ ...l, textos: { ...l.textos, [k]: v }, msg: null }))
    const n = readBreakevenN(v)
    if (n.ok) editar((d) => comBreakevenAtivo(d, entidade, k, n.n))
    else if (setting.by[k] !== undefined && !(focoRef.current?.key === k && valida(focoRef.current.texto))) {
      // A line that had no valid value when focused goes back to pending (the board saves nothing for it)
      if (!local.sessao.includes(k)) setLocal((l) => ({ ...l, sessao: [...l.sessao, k] }))
      editar((d) => comBreakevenAtivo(d, entidade, k, null))
    }
  }

  const sair = (k: string) => {
    if (valida(texto(k))) return
    const ant = focoRef.current?.key === k ? focoRef.current.texto : ''
    const n = readBreakevenN(ant)
    if (n.ok) {
      const volta = formatDecimal(n.n)
      setLocal((l) => ({ ...l, textos: { ...l.textos, [k]: volta }, msg: { key: k, volta } }))
      editar((d) => comBreakevenAtivo(d, entidade, k, n.n))
    } else setLocal((l) => ({ ...l, msg: { key: k, volta: null } }))
  }

  const remover = (k: string, i: number) => {
    const resto = linhas.filter((x) => x !== k)
    const prox = resto[i] ?? resto[i - 1]
    const livre = RAIZES_BREAKEVEN.find((a) => !resto.includes(a))
    pedirFoco(prox ? `be-${prox}` : livre ? `be-add-${livre}` : 'be-sw')
    setLocal((l) => {
      const textos = { ...l.textos }
      delete textos[k]
      return { sessao: l.sessao.filter((x) => x !== k), textos, msg: null }
    })
    if (setting.by[k] !== undefined) editar((d) => comBreakevenAtivo(d, entidade, k, null))
  }

  const adicionar = (a: string) => {
    setLocal((l) => ({ ...l, sessao: [...l.sessao.filter((x) => x !== a), a], msg: null }))
    pedirFoco(`be-${a}`)
  }

  const voltar = () => {
    setLocal(() => VAZIO)
    editar((d) => comBreakeven(d, entidade, null))
    pedirFoco('be-sw')
  }

  const msg = local.msg
  const volta = msg?.volta && linhas.includes(msg.key) ? REGRAS_BE.voltou(msg.key, msg.volta) : ''

  return (
    <div className="hub-pz-grupo-op" role="group" aria-labelledby="r-durante">
      {cliente && linhas.length === 0 && ids.length > 0 && <LerRaizes ids={ids} aoLer={aoLer} />}
      <h4 id="r-durante">{REGRAS_BE.grupo}</h4>
      <p className="hub-nota">{REGRAS_BE.grupoNota}</p>
      <ul className="hub-pz-regras">
        <li className="hub-pz-regra">
          <div className="hub-pz-regra__nome">
            <span id="r-be">{REGRAS_BE.nome}</span>
            {conta &&
              (propria ? (
                <span className="hub-tag hub-tag--propria">{SO_NESTA_CONTA}</span>
              ) : (
                <span className="hub-tag hub-tag--padrao">{PADRAO_DE_FUTUROS}</span>
              ))}
            {naoSalvo && <TagNaoSalvo />}
          </div>
          <div className="hub-pz-regra__val">
            <div className="hub-pz-sw-linha">
              <button id="be-sw" type="button" role="switch" className="hub-pz-interruptor" aria-checked={on} aria-labelledby="r-be" onClick={alternar}>
                <span className="hub-pz-interruptor__tr" aria-hidden="true" />
              </button>
              <span className="hub-pz-fraco">{on ? REGRAS.ligada : REGRAS_BE.desligada}</span>
            </div>
            {on && (
              <>
                {linhas.length === 0 && <p className="hub-pz-aviso">{REGRAS_BE.semAtivo}</p>}
                {linhas.length > 0 && (
                  <>
                    <span id="r-be-q" className="hub-pz-sub-rot">
                      {REGRAS_BE.quantos}
                    </span>
                    <ul className="hub-pz-be-lista" aria-labelledby="r-be-q">
                      {linhas.map((k, i) => {
                        const t = texto(k)
                        const erro = (t !== '' && !valida(t)) || (msg?.key === k && msg.volta === null)
                        return (
                          <li key={k} className="hub-pz-be-item">
                            <strong className="hub-pz-be-ativo">{k}</strong>
                            <span className="hub-pz-num-grupo">
                              <span aria-hidden="true">{REGRAS_BE.mais}</span>
                              <input
                                id={`be-${k}`}
                                className="hub-pz-campo-num"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                aria-label={REGRAS_BE.valorAria(k)}
                                aria-invalid={erro}
                                aria-describedby={erro ? `e-be-${k}` : undefined}
                                value={t}
                                onFocus={() => {
                                  focoRef.current = { key: k, texto: t }
                                }}
                                onChange={(event) => mudar(k, event.target.value)}
                                onBlur={() => sair(k)}
                              />
                              <span aria-hidden="true">{REGRAS_BE.pts}</span>
                            </span>
                            <button id={`rm-be-${k}`} type="button" className="hub-btn" aria-label={REGRAS_BE.removerAria(k)} onClick={() => remover(k, i)}>
                              {REGRAS_BE.remover}
                            </button>
                            {erro && (
                              <span id={`e-be-${k}`} className="hub-erro" role="alert">
                                {REGRAS_BE.erro}
                              </span>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    <div role="status" className={volta ? 'hub-nota' : 'sr-only'}>
                      {volta}
                    </div>
                  </>
                )}
                {livres.length > 0 && (
                  <>
                    <span id="r-be-add" className="hub-pz-sub-rot">
                      {REGRAS_BE.adicionar}
                    </span>
                    <div role="group" aria-labelledby="r-be-add" className="hub-pills">
                      {livres.map((a) => (
                        <button key={a} id={`be-add-${a}`} type="button" className="hub-pill" onClick={() => adicionar(a)}>
                          {a}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="hub-nota">{REGRAS_BE.nota}</p>
              </>
            )}
            {conta && propria && (
              <div>
                <button type="button" className="hub-btn" aria-label={REGRAS_BE.voltarAria(conta.label)} onClick={voltar}>
                  {REGRAS_BE.voltarPadrao}
                </button>
              </div>
            )}
          </div>
        </li>
      </ul>
    </div>
  )
}
