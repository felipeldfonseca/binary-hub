'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAgora } from '@/hooks/useAgora'
import { useAccounts, useHubDb } from '@/hooks/useContas'
import { changedOnlyHere, regrasKeys, useRulesConfig, useSaveRules, useTradesSinceRules } from '@/hooks/useRegras'
import { PHASE_LABEL } from '@/components/hub/contas/copy'
import {
  activeAccounts,
  buildSavePayload,
  pendingVersions,
  type AccountConfig,
  type PendingVersion,
  type RulesConfig,
  type RulesSettings,
  type SettingsIssue,
  type UsdTextResult,
} from '@/lib/hub/regras'
import { toRegrasError } from '@/lib/hub/regrasDb'
import {
  PADRAO_FUTUROS,
  problemasDoRascunho,
  rascunhoSujo,
  receberConfig,
  statusSalvar,
  textoSalvo,
  type MensagemSalvar,
  type Rascunho,
  type StatusSalvar,
} from '@/lib/hub/rascunho'
import type { Carga } from './ui'

export type Secao = 'contas' | 'janelas' | 'regras' | 'preferencias'
export const SECOES: readonly Secao[] = ['contas', 'janelas', 'regras', 'preferencias']

/** The open «Limite do dia» form: which account, what is typed, and the error shown after «OK» */
export interface FormLimite {
  id: string
  texto: string
  erro: Extract<UsdTextResult, { ok: false }>['reason'] | null
}

export interface PersonalizarValue {
  carga: Carga
  tentarDeNovo: () => void
  /** The rules_config the draft was made against (contrato §4.2) */
  base: RulesConfig | null
  draft: RulesSettings | null
  force: readonly string[]
  /** Not archived and not example, in list order */
  ativas: AccountConfig[]
  /** The phase label of each account («Financiada»), from the accounts list */
  fases: Record<string, string | null>
  /** The versions a save would append */
  pendentes: PendingVersion[]
  /** Trades since v1, per account with versions (undefined while loading or on error) */
  tradesDesde: Record<string, number> | undefined
  /** The device clock (previews of unsaved rules) */
  now: Date
  sujo: boolean
  problemas: SettingsIssue[]
  status: StatusSalvar
  podeDescartar: boolean
  podeSalvar: boolean
  barra: { visivel: boolean; sujo: boolean }
  salvar: (naBarra: boolean) => void
  descartar: (naBarra: boolean) => void
  /** Focus left the bar after a save or discard made from it */
  soltarBarra: () => void
  editar: (fn: (draft: RulesSettings) => RulesSettings) => void
  /** «Começar as regras hoje» */
  comecarHoje: (accountId: string) => void
  /** «Regras de»: PADRAO_FUTUROS or an active account; null with no active account */
  selecionado: string | null
  selecionar: (id: string) => void
  formLimite: FormLimite | null
  setFormLimite: (f: FormLimite | null) => void
  /** Scrolls a section into view and focuses its heading (H2s with tabIndex -1) */
  irPara: (secao: Secao) => void
}

const PersonalizarContext = createContext<PersonalizarValue | null>(null)
const EditarRegrasContext = createContext<((accountId: string) => void) | null>(null)

export function usePersonalizar(): PersonalizarValue {
  const value = useContext(PersonalizarContext)
  if (!value) throw new Error('usePersonalizar must be used inside PersonalizarProvider')
  return value
}

/**
 * For Suas contas' «Editar regras» (lane A2): selects the account in «Regras de», scrolls to
 * «Suas regras» and focuses its heading. Null outside /personalizar.
 */
export function useEditarRegras(): ((accountId: string) => void) | null {
  return useContext(EditarRegrasContext)
}

/** «Regras de» pills: «Padrão Futuros» (with an active futures account), futures accounts, binary accounts */
export function entidadesRegrasDe(ativas: readonly AccountConfig[]): string[] {
  const fut = ativas.filter((a) => a.market === 'futures').map((a) => a.id)
  const bin = ativas.filter((a) => a.market === 'binary').map((a) => a.id)
  return [...(fut.length ? [PADRAO_FUTUROS] : []), ...fut, ...bin]
}

function focarSecao(secao: Secao) {
  const section = document.getElementById(secao)
  if (section && typeof section.scrollIntoView === 'function') section.scrollIntoView({ block: 'start' })
  const heading = document.getElementById(`t-${secao}`)
  if (heading && heading.getAttribute('tabindex') === '-1') heading.focus({ preventScroll: true })
}

/**
 * Personalizar's data: rules_config, the page-wide draft against the answer it was made from,
 * the save (save_rules through useSaveRules), the status of the save bar, «Regras de» and the
 * clock for previews. The sections are presentational and get slices of this.
 */
export default function PersonalizarProvider({ children }: { children: React.ReactNode }) {
  const query = useRulesConfig()
  const contas = useAccounts()
  const save = useSaveRules()
  const queryClient = useQueryClient()
  const { userId } = useHubDb()
  const now = useAgora()

  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [mensagem, setMensagem] = useState<MensagemSalvar>(null)
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)
  /** After a save whose rules_config refetch failed: the rev the page waits for */
  const [aguardando, setAguardando] = useState<string | null>(null)
  const [barraFixa, setBarraFixa] = useState(false)
  const [selecionadoPedido, setSelecionadoPedido] = useState<string | null>(null)
  const [formLimite, setFormLimite] = useState<FormLimite | null>(null)
  const [irParaPedido, setIrParaPedido] = useState<{ secao: Secao; n: number } | null>(null)
  const leuEndereco = useRef(false)

  // A new answer: the first one (read after this mount, never an older cached one), a refetch after
  // an import, an archive or a save (this tab's, or another's)
  const config = query.data
  const fresco = query.isFetchedAfterMount && query.isSuccess
  useEffect(() => {
    if (!config || !fresco) return
    setRascunho((r) => receberConfig(r, config, r ? changedOnlyHere(queryClient, r.base.rev, config.rev) : true))
    setAguardando((rev) => (rev && rev === config.rev ? null : rev))
  }, [config, fresco, queryClient])

  const base = rascunho?.base ?? null
  const draft = rascunho?.draft ?? null
  const force = useMemo(() => rascunho?.force ?? [], [rascunho])
  const ativas = useMemo(() => (base ? activeAccounts(base) : []), [base])
  const trades = useTradesSinceRules(base ? ativas : undefined)
  const sujoReal = useMemo(() => (rascunho ? rascunhoSujo(rascunho) : false), [rascunho])
  const problemas = useMemo(() => (rascunho ? problemasDoRascunho(rascunho) : []), [rascunho])
  const pendentes = useMemo(() => (rascunho ? pendingVersions(rascunho.base, rascunho.draft, { force: rascunho.force }) : []), [rascunho])
  // While a saved change waits for its rules to come back, the draft (already saved) is not «unsaved»
  const sujo = sujoReal && !(aguardando && mensagem?.tipo === 'salvo')

  const carga: Carga = query.isError ? 'erro' : rascunho ? 'pronto' : 'carregando'
  const pronto = carga === 'pronto' && !aguardando && !salvando
  const podeSalvar = pronto && sujo && problemas.length === 0
  const podeDescartar = pronto && sujo

  const fases = useMemo(
    () => Object.fromEntries(contas.all.map((a) => [a.id, a.phase ? PHASE_LABEL[a.phase] : null])) as Record<string, string | null>,
    [contas.all],
  )

  const opcoes = useMemo(() => entidadesRegrasDe(ativas), [ativas])
  const contaAtual = base?.preferences.conta_atual
  const selecionado =
    selecionadoPedido && opcoes.includes(selecionadoPedido)
      ? selecionadoPedido
      : contaAtual && opcoes.includes(contaAtual)
        ? contaAtual
        : (opcoes[0] ?? null)

  const refetchConfig = query.refetch
  const refetchContas = contas.refetch
  const tentarDeNovo = useCallback(() => {
    void refetchConfig()
  }, [refetchConfig])

  const editar = useCallback((fn: (d: RulesSettings) => RulesSettings) => {
    setRascunho((r) => (r ? { ...r, draft: fn(r.draft) } : r))
    setMensagem(null)
    setBarraFixa(false)
  }, [])

  const comecarHoje = useCallback((accountId: string) => {
    setRascunho((r) => (r && !r.force.includes(accountId) ? { ...r, force: [...r.force, accountId] } : r))
    setMensagem(null)
    setBarraFixa(false)
  }, [])

  const mutateAsync = save.mutateAsync
  const salvar = useCallback(
    async (naBarra: boolean) => {
      if (!rascunho || !podeSalvar || salvandoRef.current) return
      let payload
      try {
        payload = buildSavePayload(rascunho.base, rascunho.draft, { force: rascunho.force })
      } catch {
        return
      }
      if (!payload) return
      const feitoSobre = rascunho.base
      salvandoRef.current = true
      setSalvando(true)
      setMensagem(null)
      try {
        const result = await mutateAsync({ payload })
        setRascunho((r) => (r ? { ...r, force: [] } : r))
        setMensagem({ tipo: 'salvo', texto: textoSalvo(result, feitoSobre) })
        const cached = queryClient.getQueryData<RulesConfig>(regrasKeys.config(userId))
        if (!cached || cached.rev !== result.rev) setAguardando(result.rev)
        setBarraFixa(naBarra)
      } catch (e) {
        const code = toRegrasError(e).code
        setMensagem({ tipo: 'erro', code })
        if (code === 'archived_account' || code === 'unknown_account') {
          // An account was archived or removed in another tab: the rebase reverts its entries
          void refetchConfig()
          void refetchContas()
        }
      } finally {
        salvandoRef.current = false
        setSalvando(false)
      }
    },
    [rascunho, podeSalvar, mutateAsync, queryClient, userId, refetchConfig, refetchContas],
  )

  const descartar = useCallback(
    (naBarra: boolean) => {
      if (!podeDescartar) return
      setRascunho((r) => (r ? { ...r, draft: r.base.settings, force: [] } : r))
      setFormLimite(null)
      setMensagem({ tipo: 'descartado' })
      setBarraFixa(naBarra)
    },
    [podeDescartar],
  )

  const soltarBarra = useCallback(() => setBarraFixa(false), [])

  const selecionar = useCallback((id: string) => {
    setSelecionadoPedido(id)
    setFormLimite(null)
  }, [])

  const irPara = useCallback((secao: Secao) => setIrParaPedido((p) => ({ secao, n: (p?.n ?? 0) + 1 })), [])

  const editarRegras = useCallback(
    (accountId: string) => {
      selecionar(accountId)
      irPara('regras')
    },
    [selecionar, irPara],
  )

  useEffect(() => {
    if (!irParaPedido) return
    focarSecao(irParaPedido.secao)
    setIrParaPedido(null)
  }, [irParaPedido])

  // ?regras={id} and #section, read once the rules are on the page (no useSearchParams: contrato §4.1)
  useEffect(() => {
    if (!rascunho || leuEndereco.current) return
    leuEndereco.current = true
    const pedido = new URLSearchParams(window.location.search).get('regras')
    if (pedido) setSelecionadoPedido(pedido)
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    if ((SECOES as readonly string[]).includes(hash)) irPara(hash as Secao)
  }, [rascunho, irPara])

  // Leaving with unsaved changes: the browser's own prompt (in-app links are not intercepted)
  useEffect(() => {
    if (!sujo) return
    const aviso = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  const status = statusSalvar({ salvando, aguardando: !!aguardando, sujo, temProblema: problemas.length > 0, mensagem })

  const value: PersonalizarValue = {
    carga,
    tentarDeNovo,
    base,
    draft,
    force,
    ativas,
    fases,
    pendentes,
    tradesDesde: trades.isSuccess ? trades.data : undefined,
    now,
    sujo,
    problemas,
    status,
    podeDescartar,
    podeSalvar,
    barra: { visivel: sujo || barraFixa, sujo },
    salvar: (naBarra) => void salvar(naBarra),
    descartar,
    soltarBarra,
    editar,
    comecarHoje,
    selecionado,
    selecionar,
    formLimite: formLimite && formLimite.id === selecionado ? formLimite : null,
    setFormLimite,
    irPara,
  }

  return (
    <EditarRegrasContext.Provider value={editarRegras}>
      <PersonalizarContext.Provider value={value}>{children}</PersonalizarContext.Provider>
    </EditarRegrasContext.Provider>
  )
}
