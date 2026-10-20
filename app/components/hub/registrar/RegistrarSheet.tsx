'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useIsMutating, useQuery } from '@tanstack/react-query'
import { hubKeys, useContaAtual, useHubDb, usePreferences } from '@/hooks/useContas'
import { useRulesNow } from '@/hooks/useRegras'
import { useImageTrashSweep, useOpenTrades, useRegistrarDefaults, useServerNow, useTradeView } from '@/hooks/useRegistrar'
import { visibleAccounts, type TradingAccount } from '@/lib/hub/contas'
import { fetchAccounts } from '@/lib/hub/contasDb'
import { diaDeHoje, padroesDoRegistrar, podeRegistrar } from '@/lib/hub/registrar'
import { newClientKey, type TradeView } from '@/lib/hub/registrarDb'
import { chaveRascunho, contaReg, indicador, lerRascunho, rascunhoInicial, textoAviso, type Rascunho } from '@/lib/hub/registrarForm'
import { CLOSE, FOLHA_REG, LOADING, TRY_AGAIN } from './copy'
import { OPERACOES_DO_DIA_ID, type CloseRegistrarOptions } from './abrir'
import Escolha from './Escolha'
import PassoAberta from './PassoAberta'
import PassoEntrada from './PassoEntrada'
import PassoFechada from './PassoFechada'
import { FolhaContext, type FolhaValue } from './ui'

/**
 * The «Registrar operação» sheet (PR 3-3, lane A; approved board RegistrarOperacao.dc.html v57) for
 * Futures and Ebinex accounts. Its props are the contract with ImportSheetProvider (§2.5); keep
 * them.
 */
export interface RegistrarSheetProps {
  /** The account the sheet opens on; null when the hub has no account it can register on */
  accountId: string | null
  /** A trade to open on (open → its «Operação aberta», closed → its «Operação fechada») */
  tradeId: string | null
  /** Closes the sheet (the provider returns focus to the opener, or to `focusId`) */
  onClose: (options?: CloseRegistrarOptions) => void
}

type Vista =
  | { passo: 'escolha' }
  | { passo: 'entrada'; aviso: string | null }
  | { passo: 'aberta'; tradeId: string }
  | { passo: 'fechada'; tradeId: string; aviso: { texto: string; atingido: boolean } | null; fora: boolean }
  | { passo: 'semRegras' }
  | { passo: 'semConta' }

const FOCAVEIS = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** The accounts the sheet registers on, the primary first (contract §4.2) */
function registraveis(active: readonly TradingAccount[]): TradingAccount[] {
  const list = active.filter((a) => podeRegistrar(a.market))
  return list.filter((a) => a.is_primary).concat(list.filter((a) => !a.is_primary))
}

function lerSessao(accountId: string): Rascunho | null {
  try {
    const text = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(chaveRascunho(accountId)) : null
    return text ? lerRascunho(JSON.parse(text), accountId) : null
  } catch {
    return null
  }
}

function gravarSessao(r: Rascunho | null, accountId: string) {
  try {
    if (typeof sessionStorage === 'undefined') return
    if (r) sessionStorage.setItem(chaveRascunho(accountId), JSON.stringify(r))
    else sessionStorage.removeItem(chaveRascunho(accountId))
  } catch {
    // Kept in memory only
  }
}

/**
 * Where it starts (§4.2): on `tradeId` (open → step 2, closed → step 3, gone → step 1 with «Esta
 * operação não foi encontrada.»); else on the account's open trades (none → step 1, one → its step
 * 2, several → «Operações abertas»). An account without rules gets D18's text instead of the form.
 */
/**
 * The accounts as useAccounts reads them (the same cache entry), with the query's own state: a read
 * paused offline is neither loading nor empty (C10)
 */
function useContasRegistrar() {
  const { db, userId } = useHubDb()
  const q = useQuery({ queryKey: hubKeys.contas(userId), queryFn: () => fetchAccounts(db), enabled: !!userId })
  const active = useMemo(() => visibleAccounts(q.data ?? []).active, [q.data])
  return { active, isLoading: q.isPending, isError: q.isError, pausada: q.isPending && q.fetchStatus === 'paused', refetch: q.refetch }
}

export default function RegistrarSheet({ accountId, tradeId, onClose }: RegistrarSheetProps) {
  const contas = useContasRegistrar()
  const rulesNow = useRulesNow()
  const prefs = usePreferences()
  const contaAtual = useContaAtual()
  const router = useRouter()
  const pathname = usePathname()
  const now = useServerNow(1000)
  const ocupado = useIsMutating() > 0
  useImageTrashSweep()

  const lista = useMemo(() => registraveis(contas.active), [contas.active])
  const [contaEscolhida, setContaEscolhida] = useState<string | null>(null)
  const inicialId = contas.isLoading ? undefined : (accountId && lista.some((a) => a.id === accountId) ? accountId : lista[0]?.id) ?? null
  const contaId = contaEscolhida ?? inicialId ?? null
  const account = lista.find((a) => a.id === contaId) ?? null
  const agora = (contaId && rulesNow.data?.accounts.find((a) => a.accountId === contaId)) || null
  const conta = useMemo(() => (account ? contaReg(account, agora?.rules ?? null, agora?.desdeDay ?? null) : null), [account, agora])

  const [vista, setVista] = useState<Vista | null>(null)
  const [focoN, setFocoN] = useState(0)
  const ir = useCallback((v: Vista) => {
    setVista(v)
    setFocoN((n) => n + 1)
  }, [])

  const abertas = useOpenTrades(contaId, { enabled: !!contaId && !tradeId })
  const alvo = vista && (vista.passo === 'aberta' || vista.passo === 'fechada') ? vista.tradeId : vista ? null : tradeId
  const trade = useTradeView(alvo, { enabled: !!alvo })
  const defaults = useRegistrarDefaults(account ? { id: account.id, market: account.market } : null)
  const pref80 = prefs.data?.alerts?.limit_80 === true

  // The last view of each trade (an undo empties its cache entry before the sheet moves on)
  const ultimaVista = useRef<Record<string, TradeView>>({})
  if (trade.data) ultimaVista.current[trade.data.trade.id] = trade.data
  const vistaDe = (id: string): TradeView | null => (trade.data && trade.data.trade.id === id ? trade.data : ultimaVista.current[id] ?? null)

  // Where the sheet starts
  const rulesNowPronto = !rulesNow.isPending || rulesNow.fetchStatus === 'paused'
  useEffect(() => {
    if (vista || contas.isLoading || contas.isError) return
    if (!account) {
      ir({ passo: 'semConta' })
      return
    }
    if (!rulesNowPronto) return
    if (agora && agora.version === null) {
      ir({ passo: 'semRegras' })
      return
    }
    if (tradeId) {
      if (trade.isPending || trade.isError) return
      const v = trade.data
      if (!v) ir({ passo: 'entrada', aviso: FOLHA_REG.naoEncontrada })
      else {
        if (v.trade.accountId && v.trade.accountId !== account.id && lista.some((a) => a.id === v.trade.accountId)) setContaEscolhida(v.trade.accountId)
        ir(v.trade.status === 'open' ? { passo: 'aberta', tradeId } : { passo: 'fechada', tradeId, aviso: null, fora: false })
      }
      return
    }
    if (abertas.isPending || abertas.isError) return
    const open = abertas.data
    if (open.length === 0) ir({ passo: 'entrada', aviso: null })
    else if (open.length === 1) ir({ passo: 'aberta', tradeId: open[0].id })
    else ir({ passo: 'escolha' })
  }, [vista, contas.isLoading, contas.isError, account, rulesNowPronto, agora, tradeId, trade.isPending, trade.isError, trade.data, abertas.isPending, abertas.isError, abertas.data, lista, ir])

  // Step 1's draft per account: memory and sessionStorage (D14, C6)
  const [rascunhos, setRascunhos] = useState<Record<string, { r: Rascunho; inicial: Rascunho }>>({})
  const defaultsProntos = !!account && (defaults.isSuccess || defaults.isError || defaults.fetchStatus === 'paused')
  const padroes = useMemo(() => (account ? defaults.data ?? padroesDoRegistrar(account.market, []) : null), [account, defaults.data])
  useEffect(() => {
    if (!conta || !defaultsProntos || !padroes || rascunhos[conta.id]) return
    const inicial = rascunhoInicial(conta, padroes, newClientKey())
    setRascunhos((x) => ({ ...x, [conta.id]: { r: lerSessao(conta.id) ?? inicial, inicial } }))
  }, [conta, defaultsProntos, padroes, rascunhos])
  const setR = useCallback(
    (fn: (r: Rascunho) => Rascunho) => {
      if (!contaId) return
      setRascunhos((x) => {
        const cur = x[contaId]
        if (!cur) return x
        const r = fn(cur.r)
        gravarSessao(r, contaId)
        return { ...x, [contaId]: { ...cur, r } }
      })
    },
    [contaId],
  )
  /** A new form on the account (after a success, «Registrar outra», an undo): a new client_key */
  const limparRascunho = useCallback(() => {
    if (!conta || !padroes) return
    gravarSessao(null, conta.id)
    const inicial = rascunhoInicial(conta, padroes, newClientKey())
    setRascunhos((x) => ({ ...x, [conta.id]: { r: inicial, inicial } }))
  }, [conta, padroes])

  // The frame: closing with unsaved input, Escape, the Tab trap
  const [mexido, setMexido] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const pedirFechar = () => {
    if (ocupado) return
    if (mexido) setSaindo(true)
    else onClose()
  }
  const ficar = useCallback(() => {
    setSaindo(false)
    headingRef.current?.focus()
  }, [])
  const folha = useMemo<FolhaValue>(() => ({ saindo, confirmarSaida: () => onClose(), ficar, marcarMexido: setMexido }), [saindo, onClose, ficar])
  useEffect(() => {
    if (!mexido) setSaindo(false)
  }, [mexido])

  useEffect(() => {
    sectionRef.current?.focus()
  }, [])
  const pronto = vista !== null
  useEffect(() => {
    if (pronto) headingRef.current?.focus()
  }, [focoN, pronto])

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (saindo) ficar()
      else pedirFechar()
      return
    }
    if (event.key !== 'Tab' || !sectionRef.current) return
    const nodes = Array.from(sectionRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getAttribute('aria-hidden') !== 'true',
    )
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const current = document.activeElement
    if (event.shiftKey && (current === first || current === headingRef.current || current === sectionRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // «Ver no Diário»: the bridge shows the Diário's current account; another page or account goes there first (C7)
  const irDiario = () => {
    if (contaId && (pathname !== '/diario' || contaAtual.current?.id !== contaId)) router.push(`/diario?conta=${encodeURIComponent(contaId)}`)
    onClose({ focusId: OPERACOES_DO_DIA_ID })
  }

  // ----------------------------------------------------------------------------------------------
  // The body
  // ----------------------------------------------------------------------------------------------

  const leituraPausada = (q: { fetchStatus: string; isPending: boolean }) => q.fetchStatus === 'paused' && q.isPending
  let corpo: React.ReactNode
  let ind: ReturnType<typeof indicador> | null = null

  const erroLeitura = (pausada: boolean, refetch: () => void) => (
    <div className="hub-passo">
      <p role="alert" className="hub-alerta">
        {pausada ? FOLHA_REG.semConexaoLeitura : FOLHA_REG.erroCarregar}
      </p>
      <div className="hub-acoes">
        <button type="button" className="hub-btn" onClick={refetch}>
          {TRY_AGAIN}
        </button>
      </div>
    </div>
  )
  const carregando = (
    <p className="hub-nota" role="status">
      {LOADING}
    </p>
  )

  if (!vista) {
    if (contas.pausada) corpo = erroLeitura(true, () => void contas.refetch())
    else if (contas.isError) corpo = erroLeitura(false, () => void contas.refetch())
    else if (leituraPausada(abertas) && !tradeId) corpo = erroLeitura(true, () => void abertas.refetch())
    else if (leituraPausada(trade) && tradeId) corpo = erroLeitura(true, () => void trade.refetch())
    else if (abertas.isError && !tradeId) corpo = erroLeitura(false, () => void abertas.refetch())
    else if (trade.isError && tradeId) corpo = erroLeitura(false, () => void trade.refetch())
    else corpo = carregando
  } else if (vista.passo === 'semConta') {
    corpo = (
      <div className="hub-passo">
        <p>{FOLHA_REG.semConta}</p>
        <div className="hub-acoes">
          <button type="button" className="hub-btn" onClick={() => onClose()}>
            {CLOSE}
          </button>
        </div>
      </div>
    )
  } else if (!conta) corpo = carregando
  else if (vista.passo === 'semRegras') {
    corpo = (
      <div className="hub-passo">
        <h3 ref={headingRef} tabIndex={-1}>
          {conta.label}
        </h3>
        <p>{FOLHA_REG.semRegras}</p>
        <div className="hub-acoes">
          <Link href={FOLHA_REG.semRegrasHref} className="hub-btn hub-btn--pri" onClick={() => onClose()}>
            {FOLHA_REG.semRegrasLink}
          </Link>
        </div>
      </div>
    )
  } else if (vista.passo === 'escolha') {
    corpo = abertas.data ? (
      <Escolha
        conta={conta}
        abertas={abertas.data}
        now={now}
        headingRef={headingRef}
        aoAbrir={(id) => ir({ passo: 'aberta', tradeId: id })}
        aoNovaEntrada={() => ir({ passo: 'entrada', aviso: null })}
      />
    ) : (
      carregando
    )
  } else if (vista.passo === 'entrada') {
    const d = rascunhos[conta.id]
    ind = indicador('entrada', { fechadaDireto: d?.r.modo === 'fechada', vencida: false })
    corpo =
      d && padroes ? (
        <PassoEntrada
          key={`${conta.id}-${focoN}`}
          conta={conta}
          contas={lista}
          aoTrocarConta={(id) => {
            setContaEscolhida(id)
            ir({ passo: 'entrada', aviso: null })
          }}
          agora={agora}
          rulesNowFalhou={rulesNow.isError}
          hoje={diaDeHoje(rulesNow.data, { id: conta.id, market: conta.market }, now)}
          rules={agora?.rules ?? null}
          defaults={padroes}
          r={d.r}
          inicial={d.inicial}
          setR={setR}
          aviso={vista.aviso}
          pref80={pref80}
          headingRef={headingRef}
          aoSemRegras={() => ir({ passo: 'semRegras' })}
          aoRegistrar={(x) => {
            limparRascunho()
            if (x.tipo === 'aberta') ir({ passo: 'aberta', tradeId: x.tradeId })
            else ir({ passo: 'fechada', tradeId: x.tradeId, aviso: x.aviso ? textoAviso(conta, x.aviso, x.exitAt) : null, fora: false })
          }}
        />
      ) : (
        carregando
      )
  } else if (vista.passo === 'aberta') {
    const v = vistaDe(vista.tradeId)
    if (v) {
      const vencida = conta.market === 'binary' && !!v.trade.expiresAt && now.getTime() >= v.trade.expiresAt.getTime()
      ind = indicador('aberta', { fechadaDireto: false, vencida })
      corpo = (
        <PassoAberta
          key={`${vista.tradeId}-${focoN}`}
          conta={conta}
          view={v}
          pref80={pref80}
          headingRef={headingRef}
          aoNovaEntrada={() => ir({ passo: 'entrada', aviso: null })}
          aoFechar={(s) => ir({ passo: 'fechada', tradeId: vista.tradeId, aviso: s.aviso ? textoAviso(conta, s.aviso, s.exitAt) : null, fora: false })}
          aoFechadaFora={() => ir({ passo: 'fechada', tradeId: vista.tradeId, aviso: null, fora: true })}
          aoDesfeita={(aviso) => {
            limparRascunho()
            ir({ passo: 'entrada', aviso })
          }}
          aoSumiu={() => ir({ passo: 'entrada', aviso: FOLHA_REG.naoEncontrada })}
        />
      )
    } else corpo = trade.isError ? erroLeitura(leituraPausada(trade), () => void trade.refetch()) : carregando
  } else {
    const v = vistaDe(vista.tradeId)
    if (v && v.trade.status === 'closed') {
      ind = indicador('fechada', { fechadaDireto: v.trade.source === 'after' || v.context?.origin === 'reconstructed', vencida: false })
      corpo = (
        <PassoFechada
          key={`${vista.tradeId}-${focoN}`}
          conta={conta}
          view={v}
          aviso={vista.aviso}
          fora={vista.fora}
          headingRef={headingRef}
          aoRegistrarOutra={(anterior) => {
            limparRascunho()
            ir({ passo: 'entrada', aviso: anterior })
          }}
          aoVerNoDiario={irDiario}
        />
      )
    } else corpo = trade.isError ? erroLeitura(leituraPausada(trade), () => void trade.refetch()) : carregando
  }

  return (
    <FolhaContext.Provider value={folha}>
      <div className="hub-veu" aria-hidden="true" onClick={pedirFechar} onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} />
      <section
        ref={sectionRef}
        className="hub-folha hub-reg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-registrar"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        // A file dropped outside «Imagens e nota» must not open in the browser and lose the sheet
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => e.preventDefault()}
      >
        <div className="hub-folha__cab">
          <h2 id="t-registrar">{FOLHA_REG.titulo}</h2>
          <button type="button" className="hub-fechar" aria-label={CLOSE} aria-disabled={ocupado || undefined} onClick={pedirFechar}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {ind && (
          <div className="hub-ind">
            <span>{FOLHA_REG.passo(ind.k, ind.n, FOLHA_REG.passos[ind.nome as keyof typeof FOLHA_REG.passos])}</span>
            <span className="hub-ind__pontos" aria-hidden="true">
              {Array.from({ length: ind.n }, (_, i) => (
                <i key={i} className={i < ind!.k ? 'hub-feito' : undefined} />
              ))}
            </span>
          </div>
        )}
        {corpo}
      </section>
    </FolhaContext.Provider>
  )
}
