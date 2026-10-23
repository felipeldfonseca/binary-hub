'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  PLATFORM_MARKET,
  buildImportArgs,
  checkTemplate,
  previewArgs,
  readImportFile,
  routeFile,
  type FileErrorCode,
  type ImportFile,
  type MappedFile,
  type ParsedFile,
  type ReadImportFileResult,
  type ReaderPlatform,
  type Template,
} from '@/lib/domain/import'
import { CREATABLE_MARKETS, MARKET_SPEC, currencyOf, type AccountMarket } from '@/lib/domain/markets'
import { FIRM_MAX, LABEL_MAX, PLATFORM_UNKNOWN, labelTaken, parseSize, zoneKeyOf, type TradingAccount } from '@/lib/hub/contas'
import {
  HubDataError,
  createAccount,
  importCommit,
  importFixTz,
  importPreview,
  importUndo,
  saveTemplate,
  toHubError,
  type FixTzResult,
  type HubErrorCode,
  type ImportCommitResult,
  type ImportPreviewResult,
} from '@/lib/hub/contasDb'
import { useAccounts, useHubDb, useImportFormats, useImportTemplates, useRefreshAfterWrite, useTemplateMarkets } from '@/hooks/useContas'
import { useAgora } from '@/hooks/useAgora'
import { useRulesConfig, useSaveRules } from '@/hooks/useRegras'
import { buildNewAccountPayload, type NewAccountRules, type RulesConfig } from '@/lib/hub/regras'
import { toRegrasError } from '@/lib/hub/regrasDb'
import {
  desdeDaNovaConta,
  linhaAntesDasRegras,
  linhaImportadas,
  moedaEViradaDoDia,
  novaContaNaConfig,
  outrasContasComVersao,
  regrasDaNovaConta,
  regrasEditadas,
  type RegrasDaNovaConta,
} from '@/lib/hub/regrasConta'
import { formatDiaMes } from '@/lib/hub/formato'
import { firmOfFile, hasFirms } from '@/lib/hub/mesas'
import { podeRegistrar } from '@/lib/hub/registrar'
import {
  arquivoDoMapeamento,
  bloqueioDoConferir,
  bloqueioDoMapa,
  cabecalhoDoLeitor,
  iniciarMapeamento,
  lerArquivoMapeavel,
  modeloASalvar,
  mudarColunas,
  nomePadraoDoModelo,
  type ArquivoMapeavel,
  type Mapeamento,
  type MercadosDosModelos,
} from '@/lib/hub/importMapeado'
import {
  chaveDasLinhas,
  contasDoArquivo,
  escolhaDaZona,
  fusoPreSelecionado,
  linhaDoArquivoMapeado,
  linhaDoModelo,
  linhasDaPrevia,
  linhasDoFuso,
  mostrarFuso,
  palavraDoFuso,
  planoMapeado,
  recusaLocal,
  valorImportado,
  valorPreSelecionado,
  zonaDaConta,
  type ModeloDoFim,
} from '@/lib/hub/importPrevia'
import {
  ARQUIVO,
  BUSY,
  ERRO,
  ERROR_TEXT,
  FIM,
  FIM_CONTA,
  FIM_FUSO,
  FOLHA,
  PASSO_A,
  PASSO_A2,
  PASSO_B,
  PASSO_C,
  PASSO_CONF,
  PASSO_D,
  PASSO_F,
  PASSO_HC,
  PASSO_I1,
  PASSO_I2,
  SOLTE,
  UNDO,
  firmAndPlatform,
  ops as operacoesTexto,
  undoAria,
  zoneName,
} from '@/components/hub/contas/copy'
import { REGRAS_CONTA } from '@/components/hub/contas/copyRegras'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { ERRO_JANELA, REGRAS } from '@/components/hub/personalizar/copy'
import { useRegistrarSheet } from '@/components/hub/registrar/abrir'
import { END_STEPS, emptyFileSummary, fileSummary, needsZoneStep, parsedOf, stepIndicator, type Passo } from './flow'
import RegrasDaConta from './RegrasDaConta'
import ChipModelo from './ChipModelo'
import PassoConferir from './PassoConferir'
import PassoContaArquivo from './PassoContaArquivo'
import PassoContasDoArquivo from './PassoContasDoArquivo'
import PassoMapa from './PassoMapa'
import { CONFERIR } from './copyMapa'
import {
  EMPTY_FORM,
  PassoConfirmarFuso,
  PassoConta,
  PassoErro,
  PassoFim,
  PassoFuso,
  PassoMercado,
  PassoMercadoErrado,
  PassoNadaNovo,
  PassoNovaConta,
  PassoPlataforma,
  PassoPrevia,
  PassoSolte,
  chosenTz,
  fimFusoLines,
  type AccountForm,
  type ZoneChoice,
} from './passos'
import type { SheetMode } from './ImportSheetProvider'

interface Flow {
  passo: Passo
  /** Steps behind the current one, for "Voltar" */
  history: Passo[]
  /** Destination account */
  accountId: string | null
  file: ReadImportFileResult | null
  /** The drop step after an error reads «Escolha outro arquivo» */
  fileAgain: boolean
  /** Step a: an account id or 'nova' */
  choice: string | null
  zone: ZoneChoice
  /** Zone the last preview used (the commit uses the same) */
  zoneUsed: string | null
  /** The zone was chosen in this sheet (step c), not taken from the account */
  zoneChosen: boolean
  /** c → conf only confirm the zone (from «Nada novo»), nothing is imported */
  fixOnly: boolean
  fixApplied: boolean
  dry: FixTzResult | null
  dryTz: string | null
  preview: ImportPreviewResult | null
  commit: ImportCommitResult | null
  nothingImported: boolean
  undone: boolean
  /** The account this sheet created, until the account list has it */
  created: TradingAccount | null
  /** Step b's form already created `created`: the form can only retry what follows */
  createdFromForm: boolean
  /** Step g: the account in context, whose market the file is not */
  wrongFrom: string | null
  /** Zones confirmed in this sheet, until the account list has them */
  confirmedTz: Record<string, string>
  form: AccountForm
  /** The account this sheet created could not get its rules (v1): its nickname, for the notice */
  rulesNotSaved: string | null
  /**
   * Step b's rules block as it was when «Criar» created the account (null: the rules had not
   * loaded). The locked form shows this, not the rules read since, which list the new account.
   */
  rulesAtCreation: { regras: RegrasDaNovaConta; desde: string } | null
  /**
   * Phase 3b: a file no reader took, read again as text; its mapping (null until the account is known: a2, the binaries
   * error) and its card (E1: constant for the file, never changed by «Mudar colunas»). Null for a reader's file.
   */
  mapeado: { arquivo: ArquivoMapeavel; mapeamento: Mapeamento | null; cartao: string | null } | null
  /** Zones the preview refused for this mapped file (G2: an unconfirmed account that already holds imports) */
  recusados: string[]
  /** What the live region says on mapa, conferir and hc (the steps' onAnuncio); cleared on every step change */
  anuncio: string
  /** What became of the model after the commit (E46) */
  modelo: ModeloDoFim | null
  /** i1's markets when a2's «+ Nova conta» opened it (the ones that import by columns); null: every creatable market */
  mercadosPermitidos: AccountMarket[] | null
  /** Why the error step shows, when readImportFile's answer does not say it (a sniff failure, a binaries account) */
  motivoErro: { error: FileErrorCode; line?: number } | null
}

/** What a preview or a commit reads: a reader's file, or a mapped file with its mapping (read on the zone given) */
type Fonte = { tipo: 'leitor'; lido: ReadImportFileResult } | { tipo: 'mapa'; arquivo: ArquivoMapeavel; m: Mapeamento }

/** The ImportFile a source makes on the zone `tz`, with its name and hash; null when it makes none */
function arquivoDaFonte(fonte: Fonte, market: AccountMarket, tz: string): { file: ImportFile; fileName: string; sha256: string } | null {
  if (fonte.tipo === 'leitor') {
    const p = parsedOf(fonte.lido)
    return p ? { file: p, fileName: fonte.lido.fileName, sha256: fonte.lido.sha256 } : null
  }
  const f = arquivoDoMapeamento(fonte.m, market, tz)
  return f.ok ? { file: f, fileName: fonte.arquivo.fileName, sha256: fonte.arquivo.sha256 } : null
}

/** The markets a2's «+ Nova conta» offers: every creatable one that imports by columns (no binaries), in the boards' order */
const MERCADOS_DO_MAPEAMENTO: AccountMarket[] = CREATABLE_MARKETS.filter((m) => MARKET_SPEC[m].mapping)

/** Phase 3c: trades the file creates — trades_new when the file has partial exits, else new (one row = one trade) */
export const operacoesDoArquivo = (p: Pick<ImportPreviewResult, 'new' | 'trades_new'>): number => p.trades_new ?? p.new

/** Phase 3c: trades the batch created — trades when the file had partial exits, else inserted */
export const operacoesDoLote = (c: Pick<ImportCommitResult, 'inserted' | 'trades'>): number => c.trades ?? c.inserted

/**
 * The end's toast, next to «Desfazer»: «{n} operações em {conta}.» for a batch that created trades.
 * Phase 3 (D29): a batch kept only for what it completed on trades registered in the app (new
 * links, or a trade an earlier file linked) says that instead of «0 operações em …»; Phase 3c: and
 * one that only added exits to trades already there says «{n} saídas a mais entraram …».
 */
export function toastDoLote(commit: Pick<ImportCommitResult, 'inserted' | 'completed' | 'linked' | 'trades' | 'attached'>, label: string): string {
  const ops = operacoesDoLote(commit)
  if (ops > 0) return FIM.toast(ops, label)
  const linked = commit.linked ?? 0
  const attached = commit.attached ?? 0
  const parts = [
    linked > 0 ? FIM.linked(linked) : '',
    commit.completed > 0 ? FIM.completed(commit.completed) : '',
    attached > 0 ? FIM.anexadas(attached) : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : FIM.toast(0, label)
}

/** A decimal without its trailing zeros («21510.50» = «21510.5»), to compare prices as the database does */
const semZeros = (x: string) => (x.includes('.') ? x.replace(/0+$/, '').replace(/\.$/, '') : x)

/**
 * Phase 3c (§5.12): a price-market file with partial exits, two or more rows of one broker position
 * on the database's key (import_stage: the symbol as written, the side, the open instant and the
 * open price, each row with an exit not before its entry). Its rows are no longer its trades.
 */
export function arquivoComParciais(parsed: Pick<ParsedFile, 'market' | 'rows'>): boolean {
  if (parsed.market === 'binary') return false
  const vistos = new Set<string>()
  for (const r of parsed.rows) {
    if (r.local_exit === null || r.entry_price === null || r.local_exit < r.local_entry) continue
    const chave = [r.symbol, r.direction, r.local_entry, r.utc_offset ?? '', semZeros(r.entry_price)].join('\u0000')
    if (vistos.has(chave)) return true
    vistos.add(chave)
  }
  return false
}

/**
 * The file's card (flow's fileSummary). Phase 3c: a file with partial exits counts «{n} linhas», the
 * card's own words for a file with errors, never «{n} operações» (the preview and the end count its
 * trades: «Importar 16 operações» for 17 rows)
 */
export function linhaDoArquivo(parsed: ParsedFile, currentYear: number): string {
  const linha = fileSummary(parsed, currentYear)
  if (parsed.errors.length > 0 || !arquivoComParciais(parsed)) return linha
  const comoOperacoes = operacoesTexto(parsed.rows.length)
  return linha
    .split(' · ')
    .map((parte) => (parte === comoOperacoes ? ARQUIVO.rows(parsed.records) : parte))
    .join(' · ')
}

const initialFlow = (mode: SheetMode, accountId: string | null): Flow => ({
  passo: mode === 'adicionar' ? 'i1' : 'solte',
  history: [],
  accountId,
  file: null,
  fileAgain: false,
  choice: null,
  zone: { key: null, other: null },
  zoneUsed: null,
  zoneChosen: false,
  fixOnly: false,
  fixApplied: false,
  dry: null,
  dryTz: null,
  preview: null,
  commit: null,
  nothingImported: false,
  undone: false,
  created: null,
  createdFromForm: false,
  wrongFrom: null,
  confirmedTz: {},
  form: EMPTY_FORM,
  rulesNotSaved: null,
  rulesAtCreation: null,
  mapeado: null,
  recusados: [],
  anuncio: '',
  modelo: null,
  mercadosPermitidos: null,
  motivoErro: null,
})

interface Primary {
  label: string
  run: () => void
  /** Blocks the action; the hint explains why */
  blocked?: string
  /** Blocks the action; a field's own error explains why */
  blockedBy?: string
  /** Does not block; an element says something about the action (the rules that failed to load) */
  describedBy?: string
}

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The ImportarConta side sheet: read a broker file, pick or create its account, confirm the
 * file's time zone, preview, import, undo; or add an account without a file.
 */
export default function ImportSheet({ mode, accountId, onClose }: { mode: SheetMode; accountId: string | null; onClose: () => void }) {
  const { db, userId } = useHubDb()
  const { active, all } = useAccounts()
  const formats = useImportFormats()
  // Phase 3b: the column-mapping models, read only when a file needs the mapping (never for a reader's file)
  const templatesQuery = useImportTemplates(false)
  // …and each model's markets (owner decision, 23 Oct: another market's model is offered, never overwritten)
  const mercadosQuery = useTemplateMarkets(false)
  const refresh = useRefreshAfterWrite()
  // The saved rules: step b's copy sources and market windows, v1's base_rev, step d's «desde»
  const rulesConfig = useRulesConfig()
  const saveRules = useSaveRules()
  const registrar = useRegistrarSheet()
  const now = useAgora()
  const [flow, setFlow] = useState<Flow>(() => initialFlow(mode, accountId))
  const [busy, setBusyState] = useState(false)
  // Read by the click handlers: a second click can arrive before the re-render that shows busy
  const busyRef = useRef(false)
  const setBusy = useCallback((value: boolean) => {
    busyRef.current = value
    setBusyState(value)
  }, [])
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<HubErrorCode | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const [infoArq, toggleInfoArq] = useToggle()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const leaveRef = useRef<HTMLButtonElement>(null)
  // A request that ends after the sheet closed must not touch its state. Set on every mount:
  // React's strict mode mounts, unmounts and mounts again in development.
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    headingRef.current?.focus()
  }, [focusTick])

  useEffect(() => {
    if (leaving) leaveRef.current?.focus()
  }, [leaving])

  const accounts = useMemo(() => {
    const list = active.slice()
    if (flow.created && !list.some((a) => a.id === flow.created?.id)) list.push(flow.created)
    return list
  }, [active, flow.created])

  const view = useCallback(
    (id: string | null): TradingAccount | null => {
      const account = id ? accounts.find((a) => a.id === id) ?? null : null
      if (!account) return null
      const tz = flow.confirmedTz[account.id]
      return tz ? { ...account, file_tz: tz, tz_applied_at: account.tz_applied_at ?? new Date().toISOString() } : account
    },
    [accounts, flow.confirmedTz],
  )

  const parsed = parsedOf(flow.file)
  const account = view(flow.accountId)
  const label = account?.label ?? ''
  /**
   * The account a file goes to: the one in context. Phase 3b: every market takes a file (a reader's,
   * or the column mapping), so every active account is one
   */
  const fileTarget = (id: string | null): TradingAccount | null => view(id)

  // Phase 3b: the mapped file on wall clocks (the zone step, the indicator) and on the zone the preview used
  const mapeamento = flow.mapeado?.mapeamento ?? null
  const mercado = account?.market ?? null
  const mapeadoNaParede = useMemo((): MappedFile | null => {
    if (!mapeamento || !mercado) return null
    const f = arquivoDoMapeamento(mapeamento, mercado, null)
    return f.ok ? f : null
  }, [mapeamento, mercado])
  const mapeadoNoFuso = useMemo((): MappedFile | null => {
    if (!mapeamento || !mercado || !flow.zoneUsed) return null
    const f = arquivoDoMapeamento(mapeamento, mercado, flow.zoneUsed)
    return f.ok ? f : null
  }, [mapeamento, mercado, flow.zoneUsed])
  const linhasDoFusoMapeado = useMemo(() => (mapeadoNaParede ? linhasDoFuso(mapeadoNaParede) : []), [mapeadoNaParede])

  /** Moves to a step; `push` keeps the current one for "Voltar" (a `history` in the patch replaces it). */
  const move = useCallback((passo: Passo, patch: Partial<Flow> = {}, push = true) => {
    if (!alive.current) return
    setError(null)
    setFlow((f) => ({
      ...f,
      ...patch,
      passo,
      history: patch.history ?? (push ? [...f.history, f.passo] : f.history),
      anuncio: patch.anuncio ?? '',
    }))
    setFocusTick((t) => t + 1)
  }, [])

  const fail = useCallback((e: unknown, patch: Partial<Flow> = {}) => {
    if (!alive.current) return
    setError(toHubError(e).code)
    if (Object.keys(patch).length > 0) setFlow((f) => ({ ...f, ...patch }))
  }, [])

  /**
   * G2 (Phase 3b): a zone the database refused for a mapped file goes back to the zone step (or stays there) with that
   * zone refused (E33), never the sheet's alert
   */
  const refuseZone = useCallback(
    (target: TradingAccount, tz: string, patch: Partial<Flow>, push: boolean) => {
      if (!alive.current) return
      setFlow((f) => {
        const recusados = f.recusados.includes(tz) ? f.recusados : [...f.recusados, tz]
        if (f.passo === 'c') return { ...f, ...patch, accountId: target.id, recusados }
        return {
          ...f,
          ...patch,
          accountId: target.id,
          recusados,
          zone: escolhaDaZona(zoneKeyOf(tz)),
          fixOnly: false,
          passo: 'c',
          history: push ? [...f.history, f.passo] : f.history,
          anuncio: '',
        }
      })
      setFocusTick((t) => t + 1)
    },
    [],
  )

  const runPreview = useCallback(
    async (target: TradingAccount, tz: string, fonte: Fonte, patch: Partial<Flow> = {}, push = true) => {
      const built = arquivoDaFonte(fonte, target.market, tz)
      if (!built) return
      setBusy(true)
      setError(null)
      try {
        const args = buildImportArgs({
          accountId: target.id,
          platform: built.file.platform,
          fileName: built.fileName,
          sha256: built.sha256,
          fileTz: tz,
          outcome: built.file,
        })
        const result = await importPreview(db, previewArgs(args))
        if (fonte.tipo === 'mapa' && (result.tz_status === 'tz_mismatch' || result.tz_status === 'tz_not_confirmed')) {
          // A mapped file never confirms nor moves the account's zone (G2)
          refuseZone(target, tz, patch, push)
          return
        }
        if (result.tz_status === 'tz_not_confirmed') {
          // The account already has trades on another guess of the zone: count what moves first
          const dry = await importFixTz(db, target.id, tz, true)
          move('conf', { ...patch, accountId: target.id, dry, dryTz: tz, fixOnly: false }, push)
          return
        }
        if (result.tz_status !== 'ok') {
          // import_preview answers a zone problem in tz_status (it raises nothing for it): no preview, no import
          fail(new HubDataError(result.tz_status === 'tz_mismatch' ? 'tz_mismatch' : 'invalid_tz'), { ...patch, accountId: target.id })
          return
        }
        // Phase 3: rows that only complete trades registered in the app (linked) are not «Nada novo»;
        // Phase 3c: nor rows that only join trades already there (attached)
        const nothing =
          result.new === 0 && result.completable === 0 && result.other_account === 0 && (result.linked ?? 0) === 0 && (result.attached ?? 0) === 0
        move(nothing ? 'f' : 'd', { ...patch, accountId: target.id, preview: result, zoneUsed: tz }, push)
      } catch (e) {
        fail(e, { ...patch, accountId: target.id })
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [db, move, fail, setBusy, refuseZone],
  )

  /** With the destination known: ask the zone, or go straight to the preview. */
  const afterAccount = useCallback(
    async (target: TradingAccount, file: ReadImportFileResult, patch: Partial<Flow> = {}) => {
      const p = parsedOf(file)
      if (!p) return
      if (needsZoneStep(p, target)) {
        const hint = zoneKeyOf(p.fileTzHint)
        move('c', { ...patch, file, accountId: target.id, zone: { key: hint, other: null }, fixOnly: false })
        return
      }
      await runPreview(target, target.file_tz, { tipo: 'leitor', lido: file }, { ...patch, file, zoneChosen: false })
    },
    [move, runPreview],
  )

  // --------------------------------------------------------------------------------------------
  // Phase 3b: a file the column mapping reads (§6.2)
  // --------------------------------------------------------------------------------------------

  /** After «conferir» (or a model taken as is): «N contas neste arquivo» when the file holds two «Conta» values or more */
  const depoisDasContas = async (target: TradingAccount, m: Mapeamento, mapeado: NonNullable<Flow['mapeado']>, patch: Partial<Flow> = {}) => {
    const f = arquivoDoMapeamento(m, target.market, null)
    if (!f.ok) return
    const comMapa = { ...patch, accountId: target.id, mapeado: { ...mapeado, mapeamento: m } }
    if (mostrarFuso(f, m, target, formats.data)) {
      move('c', { ...comMapa, zone: escolhaDaZona(fusoPreSelecionado(f, target, formats.data)), fixOnly: false })
      return
    }
    await runPreview(target, zonaDaConta(target, formats.data) ?? target.file_tz, { tipo: 'mapa', arquivo: mapeado.arquivo, m }, { ...comMapa, zoneChosen: false })
  }

  const depoisDoConferir = async (target: TradingAccount, m: Mapeamento, mapeado: NonNullable<Flow['mapeado']>, patch: Partial<Flow> = {}) => {
    if (contasDoArquivo(m, target.market).length >= 2) {
      // The value chosen before (Voltar and back) stays while the «Conta» column still holds it; else the account's
      // number, or the model's route
      const accountValue = valorImportado(m, target.market) ?? valorPreSelecionado(m, target)
      move('hc', { ...patch, accountId: target.id, mapeado: { ...mapeado, mapeamento: { ...m, accountValue } } })
      return
    }
    // One «Conta» value or none: no hc, every row is imported (a value chosen before «Voltar» no longer applies)
    await depoisDasContas(target, m.accountValue === null ? m : { ...m, accountValue: null }, mapeado, patch)
  }

  /** The mapping of a file once its account is known: the user's models first (none when they cannot be read) */
  const comecarMapeamento = async (target: TradingAccount, arquivo: ArquivoMapeavel, patch: Partial<Flow> = {}) => {
    setBusy(true)
    let templates: Template[] = []
    // A failed read of the markets is «unknown»: every model then counts as another market's (never written over)
    let mercados: MercadosDosModelos | null = null
    try {
      const [r, rm] = await Promise.all([templatesQuery.refetch(), mercadosQuery.refetch()])
      templates = r.status === 'success' && r.data ? r.data : []
      mercados = rm.status === 'success' && rm.data ? rm.data : null
    } catch {
      templates = []
    }
    if (!alive.current) return
    setBusy(false)
    const base: Partial<Flow> = { ...patch, accountId: target.id, recusados: [], modelo: null, motivoErro: null }
    const r = iniciarMapeamento(arquivo, { market: target.market, templates, nomePadrao: nomePadraoDoModelo(target.platform), mercados })
    if (!r.ok) {
      move('erro', { ...base, mapeado: { arquivo, mapeamento: null, cartao: null }, motivoErro: { error: r.error, line: r.line } })
      return
    }
    const m = r.mapeamento
    const mapeado = { arquivo, mapeamento: m, cartao: linhaDoArquivoMapeado(arquivo, m, target.market) }
    if (m.inicio === 'previa') await depoisDoConferir(target, m, mapeado, { ...base, mapeado })
    else move(m.inicio, { ...base, mapeado })
  }

  /** «Mudar colunas» (E34, on «Prévia» or «conferir»): «mapa» starts a new sequence (IC l.1706): no «Voltar» there */
  const mudar = () => {
    const atual = flow.mapeado
    if (!atual || !atual.mapeamento || busyRef.current) return
    move('mapa', { mapeado: { ...atual, mapeamento: mudarColunas(atual.mapeamento) }, history: [], undone: false }, false)
  }

  const setMapeamento = useCallback((m: Mapeamento) => {
    setFlow((f) => (f.mapeado ? { ...f, mapeado: { ...f.mapeado, mapeamento: m } } : f))
  }, [])
  const setAnuncio = useCallback((texto: string) => setFlow((f) => ({ ...f, anuncio: texto })), [])

  /** The text of a file no reader took, then where it goes (§6.2 step 2) */
  const onMappedFile = async (file: File, lido: ReadImportFileResult, platform: ReaderPlatform | undefined) => {
    let arquivo: ArquivoMapeavel
    try {
      arquivo = await lerArquivoMapeavel(file, lido)
    } catch {
      if (alive.current) move('erro', { file: lido })
      return
    }
    if (!alive.current) return
    const header = cabecalhoDoLeitor(arquivo)
    const context = fileTarget(flow.accountId)
    if (context) {
      const route = routeFile(header, context.market)
      if (route === 'reader_error') {
        move('erro', { file: lido })
        return
      }
      if (route === 'binary_error') {
        move('erro', { file: lido, mapeado: { arquivo, mapeamento: null, cartao: linhaDoArquivoMapeado(arquivo, null, null) }, motivoErro: { error: 'unknown_format' } })
        return
      }
      await comecarMapeamento(context, arquivo, { file: lido })
      return
    }
    // No account in context: a broken match of a reader stays that reader's error; else «Para qual conta?»
    if (platform && routeFile(header, PLATFORM_MARKET[platform]) === 'reader_error') {
      move('erro', { file: lido })
      return
    }
    move('a2', { file: lido, mapeado: { arquivo, mapeamento: null, cartao: linhaDoArquivoMapeado(arquivo, null, null) }, choice: null })
  }

  const onFile = async (file: File) => {
    setReading(true)
    setError(null)
    let result: ReadImportFileResult
    try {
      result = await readImportFile(file)
    } catch {
      result = { fileName: file.name, size: file.size, sha256: '', outcome: { ok: false, error: 'malformed_csv' } }
    }
    if (!alive.current) return
    setReading(false)
    // A new file: nothing of the last one's mapping stays
    setFlow((f) => ({ ...f, mapeado: null, recusados: [], modelo: null, motivoErro: null, mercadosPermitidos: null }))
    const p = parsedOf(result)
    if (!p) {
      const o = result.outcome
      if (!o.ok && (o.error === 'unknown_format' || o.error === 'missing_columns' || o.error === 'duplicate_columns')) {
        // Phase 3b: no reader takes it, so the column mapping may
        await onMappedFile(file, result, o.platform)
        return
      }
      move('erro', { file: result })
      return
    }
    const context = fileTarget(flow.accountId)
    if (context && context.market === p.market) {
      await afterAccount(context, result, { file: result })
      return
    }
    if (context) {
      move('g', { file: result, wrongFrom: context.id })
      return
    }
    const sameMarket = accounts.filter((a) => a.market === p.market)
    const known = sameMarket.find((a) => (formats.data?.[a.id] ?? []).includes(p.platform))
    move('a', { file: result, choice: (known ?? sameMarket[0])?.id ?? 'nova' })
  }

  // --------------------------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------------------------

  const form = flow.form
  const setForm = (patch: Partial<AccountForm>) => setFlow((f) => ({ ...f, form: { ...f.form, ...patch } }))
  const formMarket = parsed?.market ?? form.market ?? 'futures'
  // A file's own firm (Top One file → «Top One Futures»): step b starts with it, removable, since
  // the file's format is not proof of the firm (lib/hub/mesas firmOfFile)
  const firmFromFile = parsed && hasFirms(parsed.market) ? firmOfFile(parsed.platform) ?? '' : ''
  /** Step b's empty form for the file's market */
  const newFormForFile = (market: AccountForm['market']): AccountForm => ({ ...EMPTY_FORM, market, firm: firmFromFile })
  const sizeValue = parseSize(form.size)
  // Once the form created its account, that account's nickname is not "taken"
  const taken = labelTaken(form.label, all, flow.createdFromForm ? flow.created?.id : undefined)
  // Step b's rules block: loading, failed (the account is then created without v1), or the form resolved
  const config = rulesConfig.data
  const rulesLoad: 'carregando' | 'erro' | 'pronto' = config ? 'pronto' : rulesConfig.isError ? 'erro' : 'carregando'
  const rules = flow.passo === 'b' && config ? regrasDaNovaConta(config, formMarket, form.rules) : null

  /**
   * v1 of the account the form just created («Regras valem desde hoje»), through useSaveRules so
   * the save counts as this tab's and refreshes the rules. Another tab saved meanwhile
   * (rules_changed): rebuilt once on the fresh rules. False when the rules could not be saved.
   */
  const saveFirstVersion = async (cfg: RulesConfig, input: NewAccountRules): Promise<boolean> => {
    try {
      await saveRules.mutateAsync({ payload: buildNewAccountPayload(cfg, input) })
      return true
    } catch (e) {
      if (toRegrasError(e).code !== 'rules_changed') return false
    }
    try {
      const fresh = await rulesConfig.refetch()
      if (fresh.status !== 'success' || !fresh.data) return false
      await saveRules.mutateAsync({ payload: buildNewAccountPayload(fresh.data, novaContaNaConfig(fresh.data, input)) })
      return true
    } catch {
      return false
    }
  }

  const createFromForm = async () => {
    if (!userId) return
    if (flow.createdFromForm && flow.created) {
      // The account exists and only what followed failed (the preview): try that again, never a second account
      if (flow.file && parsed) await afterAccount(flow.created, flow.file, { accountId: flow.created.id })
      else if (flow.mapeado) await comecarMapeamento(flow.created, flow.mapeado.arquivo, { accountId: flow.created.id })
      return
    }
    setBusy(true)
    setError(null)
    // What the rules block shows as «Criar» is pressed: the locked form keeps showing it
    const rulesAtCreation = config && rules ? { regras: rules, desde: desdeDaNovaConta(config, rules, now) } : null
    try {
      // Fase, Mesa and Tamanho wherever the market has firms; binaries are «Pessoal»
      const firms = hasFirms(formMarket)
      const created = await createAccount(db, userId, {
        market: formMarket,
        label: form.label.trim().slice(0, LABEL_MAX),
        platform: parsed ? parsed.platform : form.platform === PLATFORM_UNKNOWN ? null : form.platform,
        // Chosen in i2, or the file's firm unless the owner took it out in step b
        firm: firms ? form.firm.trim().slice(0, FIRM_MAX) || null : null,
        external_ref: form.ref.trim() || null,
        phase: firms ? form.phase : 'pessoal',
        size: firms && sizeValue !== 'invalid' ? sizeValue : null,
        is_primary: active.length === 0,
      })
      refresh()
      // The account exists from here on, also while its rules save: the form is locked and its own
      // nickname, now in the refreshed list, is not «taken»
      if (alive.current) setFlow((f) => ({ ...f, created, createdFromForm: true, accountId: created.id, rulesAtCreation }))
      // Its rules (v1) before the preview, so the preview already counts from «desde»
      let rulesSaved = true
      if (config && rules) {
        rulesSaved = await saveFirstVersion(config, {
          accountId: created.id,
          market: formMarket,
          settings: rules.settings,
          copiedFrom: rules.copiar,
          marketWindows: rules.marketWindows,
        })
      }
      if (!alive.current) return
      const patch: Partial<Flow> = { created, createdFromForm: true, accountId: created.id, rulesNotSaved: rulesSaved ? null : created.label }
      if (flow.file && parsed) {
        setBusy(false)
        // The patch is kept even when the preview fails, so the sheet knows the account exists
        await afterAccount(created, flow.file, patch)
      } else if (flow.mapeado) {
        // Phase 3b: a2's «+ Nova conta» → the new account's mapping
        setBusy(false)
        await comecarMapeamento(created, flow.mapeado.arquivo, patch)
      } else {
        move('fimConta', patch)
      }
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const zoneDryRun = async (tz: string) => {
    if (!account) return
    setBusy(true)
    setError(null)
    try {
      const dry = await importFixTz(db, account.id, tz, true)
      move('conf', { dry, dryTz: tz })
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const applyZone = async () => {
    if (!account || !flow.dryTz) return
    const tz = flow.dryTz
    setBusy(true)
    setError(null)
    try {
      await importFixTz(db, account.id, tz, false)
      refresh()
      const confirmedTz = { ...flow.confirmedTz, [account.id]: tz }
      if (flow.fixOnly || !flow.file) {
        move('fimFuso', { fixApplied: true, confirmedTz })
        return
      }
      setFlow((f) => ({ ...f, fixApplied: true, confirmedTz }))
      setBusy(false)
      await runPreview({ ...account, file_tz: tz, tz_applied_at: new Date().toISOString() }, tz, { tipo: 'leitor', lido: flow.file }, { zoneChosen: true })
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  /** What the preview and the commit read now: the mapped file with its mapping, or the reader's file */
  const fonteAtual = (): Fonte | null =>
    flow.mapeado && flow.mapeado.mapeamento
      ? { tipo: 'mapa', arquivo: flow.mapeado.arquivo, m: flow.mapeado.mapeamento }
      : flow.file && parsed
        ? { tipo: 'leitor', lido: flow.file }
        : null

  /**
   * The model after a good commit (§6.8): saved, updated or touched through import_template_save, with the commit's
   * batch; without a batch, a touch makes no call, a new model goes without routes, and a model with routes is left as it
   * is. A failure is the end's line, never the sheet's alert.
   */
  const salvarModelo = async (m: Mapeamento, file: MappedFile, target: TradingAccount, zoneUsed: string, result: ImportCommitResult): Promise<ModeloDoFim> => {
    const modelo = m.match.kind !== 'none' ? m.match.template : null
    // Another market's model saved anew keeps no zone of its own (that market's); updated, it keeps its hint
    const novoNoMercado = !!m.outroMercado && !m.salvar
    const s = modeloASalvar(m, {
      tzHint: file.needsFileTz ? zoneUsed : modelo && !novoNoMercado ? modelo.tzHint : null,
      rota: m.accountValue ? { valor: m.accountValue, contaId: target.id } : null,
    })
    // Nothing to save: «Colunas usadas só neste arquivo.»; another market's model taken as is is only read (no touch, no line)
    if (s === null) return { tipo: m.porModelo ? 'tocado' : 'naoSalvo', nome: m.nome.trim() || m.nomePadrao }
    let payload = s.payload
    if (result.batch_id === null) {
      if (s.tipo === 'tocado') return { tipo: 'tocado', nome: s.nome }
      // import_template_save checks a route only against the batch's account, and its update replaces the routes
      if (s.tipo === 'atualizado' && modelo && Object.keys(modelo.accountRoutes).length > 0) return { tipo: 'semLote', nome: s.nome }
      payload = { ...payload, account_routes: {} }
    }
    // The database's own check (its routes against the batch's account and the user's open accounts of its market)
    const problema = checkTemplate(payload, {
      batch: result.batch_id ? { sig: file.format.sig, market: target.market } : null,
      accounts: accounts.map((a) => ({ id: a.id, market: a.market, archived: !!a.archived_at })),
    })
    if (problema !== null) return { tipo: 'erro', nome: s.nome }
    try {
      await saveTemplate(db, payload, result.batch_id, s.replaces)
      refresh()
      return { tipo: s.tipo, nome: s.nome }
    } catch (e) {
      return { tipo: toHubError(e).code === 'too_many_templates' ? 'limite' : 'erro', nome: s.nome }
    }
  }

  const commit = async () => {
    const preview = flow.preview
    const fonte = fonteAtual()
    if (!preview || !account || !fonte || !flow.zoneUsed) return
    if (preview.new === 0 && preview.completable === 0 && (preview.linked ?? 0) === 0 && (preview.attached ?? 0) === 0) {
      // Everything is already in another account: nothing to write
      if (flow.created) move('fim', { nothingImported: true })
      else onClose()
      return
    }
    const built = arquivoDaFonte(fonte, account.market, flow.zoneUsed)
    if (!built) return
    const zoneUsed = flow.zoneUsed
    setBusy(true)
    setError(null)
    try {
      const args = buildImportArgs({
        accountId: account.id,
        platform: built.file.platform,
        fileName: built.fileName,
        sha256: built.sha256,
        fileTz: zoneUsed,
        outcome: built.file,
      })
      const result = await importCommit(db, args)
      refresh()
      // One busy state covers the commit and the model's save
      const modelo = fonte.tipo === 'mapa' && built.file.platform === 'modelo' ? await salvarModelo(fonte.m, built.file, account, zoneUsed, result) : null
      move('fim', { commit: result, undone: false, nothingImported: false, modelo })
    } catch (e) {
      if (fonte.tipo === 'mapa' && toHubError(e).code === 'tz_mismatch') refuseZone(account, zoneUsed, {}, true)
      else fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const undo = async () => {
    const batch = flow.commit?.batch_id
    const fonte = fonteAtual()
    if (busyRef.current || !batch || !account || !fonte || !flow.zoneUsed) return
    setBusy(true)
    setError(null)
    try {
      await importUndo(db, batch)
      refresh()
      if (!alive.current) return
      // Back to the preview it came from, with «Importação desfeita» and fresh counts
      setFlow((f) => ({ ...f, passo: 'd', history: f.history[f.history.length - 1] === 'd' ? f.history.slice(0, -1) : f.history, commit: null }))
      setBusy(false)
      // The model stays (C25)
      await runPreview(account, flow.zoneUsed, fonte, { undone: true, commit: null }, false)
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  // --------------------------------------------------------------------------------------------
  // Back and close
  // --------------------------------------------------------------------------------------------

  /**
   * Steps "Voltar" skips: the form of an account already created (Phase 3b: and, from a2's «+ Nova conta», its market and
   * platform: that account exists in them), and a zone already applied.
   */
  const skipOnBack = (p: Passo, f: Flow) =>
    (p === 'b' && !!f.created) || ((p === 'i1' || p === 'i2') && !!f.created && f.createdFromForm) || ((p === 'conf' || p === 'c') && f.fixApplied)

  const backIndex = (() => {
    for (let i = flow.history.length - 1; i >= 0; i--) {
      const p = flow.history[i]
      // An end screen is as far back as Voltar goes: what came before it is done ("{conta} criada.")
      if (END_STEPS.includes(p)) return i
      if (!skipOnBack(p, flow)) return i
    }
    return -1
  })()

  const back = () => {
    if (busyRef.current || backIndex < 0) return
    setError(null)
    setFlow((f) => {
      const passo = f.history[backIndex]
      const skipped = [...f.history.slice(backIndex + 1), f.passo]
      // Back past the form that created an account: that account is now the one chosen, so
      // "Continuar" never opens a second "Nova conta" (Phase 3b: on a2 too, for a file no reader takes)
      const choice = (passo === 'a' || passo === 'a2') && f.created && f.createdFromForm && skipped.includes('b') ? f.created.id : f.choice
      return { ...f, passo, history: f.history.slice(0, backIndex), undone: false, choice }
    })
    setFocusTick((t) => t + 1)
  }

  const typed =
    // The file's firm, left as it came, is not something the owner typed
    form.firm.trim() !== firmFromFile ||
    !!(form.label.trim() || form.size.trim() || form.ref.trim() || form.search.trim() || form.phase || form.platform) ||
    regrasEditadas(form.rules) ||
    (mode === 'adicionar' && !!form.market)
  const dirty = !flow.createdFromForm && ['i1', 'i2', 'b'].includes(flow.passo) && typed

  const requestClose = () => {
    if (busy || reading) return
    if (dirty) setLeaving(true)
    else onClose()
  }

  const stayHere = () => {
    setLeaving(false)
    headingRef.current?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (leaving) stayHere()
      else requestClose()
      return
    }
    if (event.key !== 'Tab' || !sectionRef.current) return
    // Keep Tab inside the dialog
    const nodes = Array.from(sectionRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => !el.hasAttribute('disabled') && el.tabIndex >= 0 && el.getAttribute('aria-hidden') !== 'true',
    )
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const current = document.activeElement
    // The dialog itself has focus after a click on its text
    if (event.shiftKey && (current === first || current === headingRef.current || current === sectionRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Phase 3b: the steps still to come of a mapped file (the indicator), memoised on the mapping
  const formatsData = formats.data
  const planoAdiante = useMemo((): Passo[] | null => {
    if (!flow.mapeado) return null
    if (flow.passo === 'a2' || flow.passo === 'i1' || flow.passo === 'i2' || flow.passo === 'b') return planoMapeado('a2', null, null, undefined)
    if (flow.passo === 'mapa' || flow.passo === 'conferir' || flow.passo === 'hc') return planoMapeado(flow.passo, mapeamento, account, formatsData)
    return null
    // `account` is a fresh object each render (view): its id and zone are what the plan reads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.mapeado, flow.passo, mapeamento, account?.id, account?.file_tz, account?.tz_applied_at, formatsData])

  // --------------------------------------------------------------------------------------------
  // The current step: body and footer
  // --------------------------------------------------------------------------------------------

  let body: React.ReactNode = null
  let primary: Primary | null = null
  /** A secondary action right before the primary one (the end of account creation's «Registrar operação») */
  let secondary: Primary | null = null
  const closeAction: Primary = { label: FOLHA.close, run: onClose }

  switch (flow.passo) {
    case 'solte': {
      const target = fileTarget(flow.accountId)
      const title = flow.fileAgain ? SOLTE.titleAgain : target ? SOLTE.titleFor(target.label) : SOLTE.titleNone
      body = <PassoSolte headingRef={headingRef} title={title} reading={reading} onFile={(file) => void onFile(file)} />
      break
    }
    case 'erro': {
      const failed = flow.file && !flow.file.outcome.ok ? flow.file.outcome : null
      body = (
        <PassoErro headingRef={headingRef} failed={failed} parsed={flow.file?.outcome.ok ? flow.file.outcome : null} motivo={flow.motivoErro} />
      )
      primary = { label: ERRO.again, run: () => move('solte', { fileAgain: true, file: null, mapeado: null, motivoErro: null }) }
      break
    }
    case 'a2': {
      // Phase 3b: «Para qual conta?» for a file no reader takes
      const mapeado = flow.mapeado
      if (!mapeado) break
      body = <PassoContaArquivo headingRef={headingRef} accounts={accounts} choice={flow.choice} onChoose={(choice) => setFlow((f) => ({ ...f, choice }))} />
      const chosen = flow.choice && flow.choice !== 'nova' ? view(flow.choice) : null
      primary = {
        label: FOLHA.next,
        run: () => {
          if (flow.choice === 'nova') move('i1', { form: EMPTY_FORM, createdFromForm: false, mercadosPermitidos: MERCADOS_DO_MAPEAMENTO })
          else if (chosen) void comecarMapeamento(chosen, mapeado.arquivo, { accountId: chosen.id })
        },
        blocked: flow.choice ? undefined : PASSO_A2.hint,
      }
      break
    }
    case 'mapa': {
      const mapeado = flow.mapeado
      if (!mapeado || !mapeado.mapeamento || !account) break
      const m = mapeado.mapeamento
      body = (
        <PassoMapa
          headingRef={headingRef}
          arquivo={mapeado.arquivo}
          mapeamento={m}
          market={account.market}
          onChange={setMapeamento}
          onAnuncio={setAnuncio}
        />
      )
      primary = { label: FOLHA.next, run: () => move('conferir'), blocked: bloqueioDoMapa(m, account.market) ?? undefined }
      break
    }
    case 'conferir': {
      const mapeado = flow.mapeado
      if (!mapeado || !mapeado.mapeamento || !account) break
      const m = mapeado.mapeamento
      body = (
        <PassoConferir
          headingRef={headingRef}
          mapeamento={m}
          market={account.market}
          onChange={setMapeamento}
          onAnuncio={setAnuncio}
          onMudarColunas={m.porModelo ? mudar : null}
        />
      )
      primary = {
        label: CONFERIR.usar,
        run: () => void depoisDoConferir(account, m, mapeado),
        blocked: bloqueioDoConferir(m, account.market) ?? undefined,
      }
      break
    }
    case 'hc': {
      const mapeado = flow.mapeado
      if (!mapeado || !mapeado.mapeamento || !account) break
      const m = mapeado.mapeamento
      body = <PassoContasDoArquivo headingRef={headingRef} mapeamento={m} conta={account} onChange={setMapeamento} onAnuncio={setAnuncio} />
      primary = {
        label: FOLHA.next,
        run: () => void depoisDasContas(account, m, mapeado),
        // No value of the «Conta» column goes to the account
        blocked: valorImportado(m, account.market) === null ? PASSO_HC.hint(account.label) : undefined,
      }
      break
    }
    case 'a': {
      if (!parsed) break
      const options = accounts.filter((a) => a.market === parsed.market).map((a) => ({ id: a.id, label: a.label }))
      const chosen = flow.choice && flow.choice !== 'nova' ? view(flow.choice) : null
      const reason = chosen && (formats.data?.[chosen.id] ?? []).includes(parsed.platform) ? PASSO_A.sameFormat(chosen.label) : ''
      body = (
        <PassoConta
          headingRef={headingRef}
          market={parsed.market}
          options={options}
          choice={flow.choice}
          reason={reason}
          onChoose={(choice) => setFlow((f) => ({ ...f, choice }))}
        />
      )
      primary = {
        label: FOLHA.next,
        run: () => {
          if (flow.choice === 'nova') move('b', { form: newFormForFile(parsed.market), createdFromForm: false })
          else if (chosen && flow.file) void afterAccount(chosen, flow.file, { accountId: chosen.id })
        },
      }
      break
    }
    case 'i1':
      body = (
        <PassoMercado
          headingRef={headingRef}
          market={form.market}
          // Changing the market starts the form again: nothing carries over to the other market
          onChoose={(market) => setForm(market === form.market ? {} : { ...EMPTY_FORM, market })}
          mercados={flow.mercadosPermitidos ?? undefined}
        />
      )
      primary = { label: FOLHA.next, run: () => move('i2'), blocked: form.market ? undefined : PASSO_I1.hint }
      break
    case 'i2':
      body = <PassoPlataforma headingRef={headingRef} form={form} onChange={setForm} />
      primary = { label: FOLHA.next, run: () => move('b'), blocked: form.platform ? undefined : PASSO_I2.hint }
      break
    case 'b': {
      // Fase (required), Mesa and Tamanho wherever the market has firms (lib/hub/mesas)
      const firms = hasFirms(formMarket)
      const firm = firms ? form.firm.trim() : ''
      let roLabel: string = PASSO_B.roLabel(formMarket)
      let roValue = ''
      if (parsed) {
        if (parsed.platform === 'topone') {
          roLabel = firm ? PASSO_B.roFirmFile : PASSO_B.roFile
          roValue = firm ? firmAndPlatform(firm, 'topone') : PASSO_B.fileTopOne
        } else {
          roLabel = PASSO_B.roLabel(parsed.market)
          roValue = PASSO_B.fileEbinex
        }
      } else {
        if (firm) roLabel = PASSO_B.roFirmPlatform
        roValue = form.platform ? firmAndPlatform(firm, form.platform) : [firm, PASSO_B.platformTbd].filter(Boolean).join(' · ')
      }
      // A market without a file reader shows its money and day turn, fixed in the account (Fase 2b; Phase 3b: with or
      // without a file, since a mapped file brings an account of any market here)
      const moedaDia = !MARKET_SPEC[formMarket].reader
        ? { valor: moedaEViradaDoDia(formMarket, now), info: PASSO_B.moedaDiaInfo(formMarket, !!firm) }
        : null
      const sizeInvalid = firms && sizeValue === 'invalid'
      const locked = flow.createdFromForm && !!flow.created
      // Locked, the block shows what it showed at creation; «desde» is v1's own day once saved (none
      // when it could not be saved), and the prediction while it saves
      const snapshot = locked ? flow.rulesAtCreation : null
      const blockLoad = locked ? (snapshot ? 'pronto' : 'erro') : rulesLoad
      const blockRules = locked ? (snapshot?.regras ?? null) : rules
      const v1 = locked ? config?.accounts.find((a) => a.id === flow.created?.id)?.versions[0] : undefined
      const desde = locked
        ? flow.rulesNotSaved || !snapshot
          ? null
          : v1
            ? formatDiaMes(v1.effectiveDay)
            : snapshot.desde
        : config && rules
          ? desdeDaNovaConta(config, rules, now)
          : null
      const outras = !locked && config && rules ? outrasContasComVersao(config, rules, now) : null
      const name = form.label.trim()
      // What «Criar» waits for first: a nickname and, wherever the market has firms, the phase
      const basics = !name ? PASSO_B.needLabel : firms && !form.phase ? PASSO_B.needPhase : undefined
      // Then the rules block: the saved rules, and a limit or a window that can be saved
      let rulesBlocked: string | undefined
      let rulesBlockedBy: string | undefined
      if (rulesLoad === 'carregando') rulesBlockedBy = 'regras-carga'
      else if (rules?.limiteErro) rulesBlocked = REGRAS.limiteErro(rules.limiteErro, currencyOf(formMarket))
      else if (rules?.janelaErro) {
        if (form.rules.aberto) rulesBlockedBy = 'j-erro'
        else rulesBlocked = ERRO_JANELA[rules.janelaErro]
      }
      body = (
        <PassoNovaConta
          headingRef={headingRef}
          market={formMarket}
          form={form}
          onChange={setForm}
          roLabel={roLabel}
          roValue={roValue}
          labelTaken={taken}
          sizeInvalid={sizeInvalid}
          locked={locked}
          firmRemovable={!!parsed}
          moedaDia={moedaDia}
          regras={
            <RegrasDaConta
              carga={blockLoad}
              regras={blockRules}
              form={form.rules}
              onForm={(next) => setForm({ rules: next })}
              label={form.label}
              now={now}
              desde={desde}
              locked={locked}
              // The hint under «Criar» says the limit's error once nothing comes before it; until
              // then the block says it under the field
              limiteErroId={basics ? undefined : 'dica-pri'}
              outras={outras}
            />
          }
        />
      )
      primary = locked
        ? // The account exists; what followed it failed and is tried again
          { label: FOLHA.next, run: () => void createFromForm() }
        : {
            label: name ? (parsed || flow.mapeado ? PASSO_B.createAndGo(name) : PASSO_B.create(name)) : PASSO_B.createFallback,
            run: () => void createFromForm(),
            blocked: basics ?? rulesBlocked,
            blockedBy: taken ? 'f-apelido-erro' : sizeInvalid ? 'f-tam-erro' : rulesBlockedBy,
            // Created without rules when they failed to load; the market's other accounts get a version
            describedBy: rulesLoad === 'erro' ? 'regras-carga' : outras ? 'rc-outras' : undefined,
          }
      break
    }
    case 'c': {
      const mapeado = flow.mapeado
      if (mapeado && mapeado.mapeamento) {
        // Phase 3b: a mapped file's zone step, every market, with G2's refusal (§6.5)
        if (!account || !mapeadoNaParede) break
        const m = mapeado.mapeamento
        const target = account
        const tz = chosenTz(flow.zone)
        const recusado = tz !== null && (recusaLocal(target, tz) || flow.recusados.includes(tz))
        body = (
          <PassoFuso
            headingRef={headingRef}
            market={target.market}
            linhas={linhasDoFusoMapeado}
            toda
            palavra={palavraDoFuso(mapeadoNaParede)}
            zone={flow.zone}
            onChange={(zone) => setFlow((f) => ({ ...f, zone }))}
            recusa={recusado ? { conta: target.label, zona: zoneName(target.file_tz) } : null}
          />
        )
        primary = {
          label: FOLHA.next,
          run: () => {
            if (tz && !recusado) void runPreview(target, tz, { tipo: 'mapa', arquivo: mapeado.arquivo, m }, { zoneChosen: true })
          },
          blocked: !tz
            ? flow.zone.key === 'outro'
              ? PASSO_C.needOther
              : PASSO_C.needZone
            : recusado
              ? PASSO_C.recusaDica(zoneName(target.file_tz))
              : undefined,
        }
        break
      }
      if (!parsed) break
      const tz = chosenTz(flow.zone)
      body = (
        <PassoFuso
          headingRef={headingRef}
          market={parsed.market}
          linhas={parsed.rows}
          toda={false}
          palavra="entradas"
          zone={flow.zone}
          onChange={(zone) => setFlow((f) => ({ ...f, zone }))}
          recusa={null}
        />
      )
      primary = {
        label: flow.fixOnly ? PASSO_C.confirm : FOLHA.next,
        run: () => {
          if (!tz || !account) return
          if (flow.fixOnly) void zoneDryRun(tz)
          else if (flow.file) void runPreview(account, tz, { tipo: 'leitor', lido: flow.file }, { zoneChosen: true })
        },
        blocked: tz ? undefined : flow.zone.key === 'outro' ? PASSO_C.needOther : PASSO_C.needZone,
      }
      break
    }
    case 'conf':
      if (!flow.dry || !flow.dryTz) break
      body = <PassoConfirmarFuso headingRef={headingRef} tz={flow.dryTz} dry={flow.dry} label={label} beforeImport={!flow.fixOnly} />
      primary = { label: PASSO_CONF.confirm, run: () => void applyZone() }
      break
    case 'd': {
      const preview = flow.preview
      const file: ImportFile | null = mapeamento ? mapeadoNoFuso : parsed
      if (!preview || !file || !flow.zoneUsed || !account) break
      body = (
        <PassoPrevia
          headingRef={headingRef}
          preview={preview}
          linhas={linhasDaPrevia(file, preview, mapeamento, account)}
          label={label}
          zoneUsed={flow.zoneUsed}
          zoneChosen={flow.zoneChosen}
          needsFileTz={file.needsFileTz}
          undone={flow.undone}
          antesDasRegras={linhaAntesDasRegras(config, account.id, file.rows, flow.zoneUsed, operacoesDoArquivo(preview))}
          chip={mapeamento?.porModelo && mapeamento.match.kind !== 'none' ? <ChipModelo nome={mapeamento.match.template.name} onMudar={mudar} /> : null}
        />
      )
      const opsArquivo = operacoesDoArquivo(preview)
      primary = {
        label:
          opsArquivo > 0
            ? PASSO_D.importN(opsArquivo)
            : preview.completable + (preview.linked ?? 0) > 0
              ? PASSO_D.completeN(preview.completable + (preview.linked ?? 0))
              : (preview.attached ?? 0) > 0
                ? PASSO_D.juntarN(preview.attached ?? 0)
                : FOLHA.done,
        run: () => void commit(),
      }
      break
    }
    case 'f': {
      const preview = flow.preview
      if (!preview) break
      const confirmedZone = account && account.tz_applied_at ? account.file_tz : preview.tz_confirmed ? preview.account_tz : null
      body = (
        <PassoNadaNovo
          headingRef={headingRef}
          preview={preview}
          label={label}
          confirmedZone={confirmedZone}
          onConfirmZone={() => move('c', { fixOnly: true, zone: { key: parsed ? zoneKeyOf(parsed.fileTzHint) : null, other: null } })}
          mapeado={!!mapeamento}
          unidade={mapeadoNoFuso?.rowKind === 'fill' ? 'saida' : 'linha'}
          chave={mapeadoNoFuso ? chaveDasLinhas(mapeadoNoFuso) : 'id'}
        />
      )
      primary = closeAction
      break
    }
    case 'g': {
      // The account in context, also when Voltar comes back here after another account was chosen
      const from = view(flow.wrongFrom)
      if (!parsed || !from) break
      const targets = accounts.filter((a) => a.market === parsed.market).map((a) => ({ id: a.id, label: a.label }))
      body = (
        <PassoMercadoErrado
          headingRef={headingRef}
          fileMarket={parsed.market}
          account={{ label: from.label, market: from.market }}
          targets={targets}
          busy={busy}
          onImportInto={(id) => {
            if (busyRef.current) return
            const target = view(id)
            if (target && flow.file) void afterAccount(target, flow.file, { accountId: id })
          }}
          onCreate={() => {
            if (!busyRef.current) move('b', { form: newFormForFile(parsed.market), createdFromForm: false })
          }}
        />
      )
      break
    }
    case 'fim': {
      const result = flow.commit
      let title: string = FIM.title
      let lines: string[] = []
      if (flow.nothingImported) {
        title = FIM.created(label)
        lines = [FIM.nothingImported]
      } else if (result && (result.inserted > 0 || result.completed > 0 || (result.linked ?? 0) > 0 || (result.attached ?? 0) > 0)) {
        const opsLote = operacoesDoLote(result)
        const rows = mapeamento ? mapeadoNoFuso?.rows ?? null : parsed?.rows ?? null
        if (opsLote > 0) {
          // After the account's rules started, imported rows are judged by them (decisoes)
          const judged = account && rows && flow.zoneUsed ? linhaImportadas(config, account.id, rows, flow.zoneUsed, opsLote) : null
          lines.push(judged ?? FIM.inHistory(opsLote))
        }
        if (result.completed > 0) lines.push(FIM.completed(result.completed))
        // Phase 3: a batch that only completed app trades is kept, and can be undone
        if ((result.linked ?? 0) > 0) lines.push(FIM.linked(result.linked ?? 0))
        // Phase 3c (§5.12): exits grouped into a trade, and exits added to trades already there
        if ((result.grouped ?? 0) > 0) lines.push(FIM.agrupadas(result.grouped ?? 0))
        if ((result.attached ?? 0) > 0) lines.push(FIM.anexadas(result.attached ?? 0))
        // Phase 3b (E46): what became of the model
        const modelo = linhaDoModelo(flow.modelo)
        if (modelo) lines.push(modelo)
        if (result.batch_id) lines.push(FIM.undoLater)
      } else if (result) {
        title = mapeadoNoFuso?.rowKind === 'fill' ? PASSO_F.titleSaidas(result.duplicate, label) : PASSO_F.title(result.duplicate, label)
        const modelo = linhaDoModelo(flow.modelo)
        if (modelo) lines.push(modelo)
      }
      body = <PassoFim headingRef={headingRef} title={title} lines={lines} />
      primary = closeAction
      break
    }
    case 'fimFuso':
      body = (
        <PassoFim
          headingRef={headingRef}
          title={FIM_FUSO.title(zoneName(flow.dryTz ?? ''))}
          lines={fimFusoLines(flow.dry?.rows ?? 0, label)}
        />
      )
      primary = closeAction
      break
    case 'fimConta': {
      const created = flow.created
      const title = FIM_CONTA.title(created?.label ?? label)
      // Phase 3: «Registrar operação» on the new account (it replaces this sheet; focus goes back to
      // what opened it); every market registers since 3-4 (the end of D36)
      const registrarNa = created && podeRegistrar(created.market) ? created : null
      const registrarAction: Primary | null = registrarNa
        ? { label: FIM_CONTA.registrar, run: () => registrar.open({ accountId: registrarNa.id }) }
        : null
      // Phase 3b (E52): every market imports a file. A MetaTrader report is neither CSV nor read yet: no «Importar
      // histórico», the line saying so, «Registrar operação» as the primary
      const relatorioMT = FIM_CONTA.relatorioMT(created?.platform ?? null)
      const iq = created?.platform === 'iq'
      body = (
        <PassoFim
          headingRef={headingRef}
          title={title}
          lines={iq || relatorioMT ? [FIM_CONTA.textIq, ...(relatorioMT ? [relatorioMT] : [])] : [FIM_CONTA.text]}
        />
      )
      if (iq || relatorioMT) {
        // IQ Option exports no history: «Registrar operação» is the only action (board `temLinkDepois`)
        primary = registrarAction ?? closeAction
      } else {
        // Board `temLinkAntes`: «Registrar operação» (secondary) before «Importar histórico»
        secondary = registrarAction
        primary = { label: FIM_CONTA.importHistory, run: () => move('solte', { accountId: created?.id ?? flow.accountId }) }
      }
      break
    }
  }

  const title = mode === 'adicionar' && !flow.file && flow.passo !== 'solte' ? FOLHA.titleAdd : FOLHA.titleImport
  // The file card: a read file, or on the error step a known format with no trade line; Phase 3b: a mapped file's own
  // (E1), kept for the file
  const fileLine =
    flow.passo === 'solte'
      ? null
      : flow.mapeado
        ? flow.mapeado.cartao
        : parsed
          ? linhaDoArquivo(parsed, new Date().getFullYear())
          : flow.passo === 'erro'
            ? emptyFileSummary(flow.file)
            : null
  const indicator = stepIndicator({
    passo: flow.passo,
    history: flow.history,
    mode,
    parsed,
    choice: flow.choice,
    choiceAccount: flow.choice && flow.choice !== 'nova' ? view(flow.choice) : null,
    fixOnly: flow.fixOnly,
    mapeado: planoAdiante,
  })
  const showBack = !END_STEPS.includes(flow.passo) && flow.passo !== 'g' && backIndex >= 0
  const blocked = !!primary && (!!primary.blocked || !!primary.blockedBy)
  const toastText = flow.passo === 'fim' && flow.commit?.batch_id ? toastDoLote(flow.commit, label) : ''
  // What the one live region says: the running request, else the latest result
  const rulesNotice = flow.rulesNotSaved ? REGRAS_CONTA.naoSalvas(flow.rulesNotSaved) : ''
  // Step b before the account exists: the rules could not be read, so it will be created without them
  const rulesLoadNotice = flow.passo === 'b' && !flow.createdFromForm && rulesLoad === 'erro' ? REGRAS_CONTA.carregarErro : ''
  // Phase 3b: the mapping steps' own lines, and G2's refusal on the zone step
  const mappedNotice = ['mapa', 'conferir', 'hc'].includes(flow.passo) ? flow.anuncio : ''
  const zoneRefusal =
    flow.passo === 'c' && mapeamento && account && (() => {
      const tz = chosenTz(flow.zone)
      return tz !== null && (recusaLocal(account, tz) || flow.recusados.includes(tz))
    })()
      ? `${PASSO_C.recusaTitulo} ${PASSO_C.recusa(account.label)}`
      : ''
  const statusText =
    busy
      ? BUSY
      : reading
        ? SOLTE.reading
        : toastText ||
          (flow.passo === 'd' && flow.undone ? PASSO_D.undone(label) : '') ||
          mappedNotice ||
          zoneRefusal ||
          rulesNotice ||
          rulesLoadNotice

  // A file dropped outside the drop zone must not open in the browser and lose the sheet
  const holdDrop = (event: React.DragEvent) => event.preventDefault()

  return (
    <>
      <div className="hub-veu" aria-hidden="true" onClick={requestClose} onDragOver={holdDrop} onDrop={holdDrop} />
      <section
        ref={sectionRef}
        className="hub-folha"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-folha"
        // A click on text inside keeps focus in the dialog, so Escape and the Tab trap still work
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onDragOver={holdDrop}
        onDrop={holdDrop}
      >
        <div className="hub-folha__cab">
          <h2 id="t-folha">{title}</h2>
          <button
            type="button"
            className="hub-fechar"
            aria-label={FOLHA.close}
            aria-disabled={busy || reading || undefined}
            onClick={requestClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {fileLine && (
          <div className="hub-arq">
            <div className="hub-arq__linha">
              <FileText size={18} strokeWidth={2} aria-hidden="true" />
              <span className="hub-arq__txt">{fileLine}</span>
              <InfoButton panelId="info-arq" label={ARQUIVO.infoAria} open={infoArq} onToggle={toggleInfoArq} />
            </div>
            {infoArq && <InfoPanel id="info-arq">{ARQUIVO.info}</InfoPanel>}
          </div>
        )}

        {indicator && (
          <div className="hub-ind">
            <span>{FOLHA.step(indicator.k, indicator.total)}</span>
            <span className="hub-ind__pontos" aria-hidden="true">
              {Array.from({ length: indicator.total }, (_, i) => (
                <i key={i} className={i < indicator.k ? 'hub-feito' : undefined} />
              ))}
            </span>
          </div>
        )}

        {body}

        {/* Announced by the status region below */}
        {rulesNotice && <p className="hub-alerta">{rulesNotice}</p>}
        {error && (
          <div role="alert" className="hub-alerta">
            {ERROR_TEXT[error]}
          </div>
        )}
        {/* Announced by the status region below */}
        {busy && <p className="hub-nota">{BUSY}</p>}

        {leaving ? (
          <div className="hub-bloco hub-bloco--atencao" role="group" aria-labelledby="t-sair">
            <span id="t-sair" style={{ fontWeight: 700 }}>
              {FOLHA.leaveQuestion}
            </span>
            <div className="hub-acoes">
              <button ref={leaveRef} type="button" className="hub-btn hub-btn--pri" onClick={onClose}>
                {FOLHA.leaveYes}
              </button>
              <button type="button" className="hub-btn" onClick={stayHere}>
                {FOLHA.leaveNo}
              </button>
            </div>
          </div>
        ) : (
          (showBack || primary) && (
            <div className="hub-rodape">
              {showBack && (
                <button type="button" className="hub-btn" onClick={back}>
                  {FOLHA.back}
                </button>
              )}
              {primary && (
                <div className="hub-rodape__dir">
                  {secondary && (
                    <button
                      type="button"
                      className="hub-btn"
                      aria-disabled={busy || undefined}
                      onClick={() => {
                        if (!busyRef.current) secondary?.run()
                      }}
                    >
                      {secondary.label}
                    </button>
                  )}
                  <button
                    type="button"
                    className="hub-btn hub-btn--pri"
                    aria-disabled={blocked || busy || undefined}
                    aria-describedby={primary.blocked ? 'dica-pri' : (primary.blockedBy ?? primary.describedBy)}
                    onClick={() => {
                      if (!blocked && !busyRef.current) primary?.run()
                    }}
                  >
                    {primary.label}
                  </button>
                </div>
              )}
            </div>
          )
        )}
        {!leaving && primary?.blocked && (
          <p id="dica-pri" className="hub-nota hub-dica">
            {primary.blocked}
          </p>
        )}

        {toastText && (
          <div className="hub-toast">
            <span>{toastText}</span>
            <button type="button" aria-label={undoAria(toastText)} aria-disabled={busy || undefined} onClick={() => void undo()}>
              {UNDO}
            </button>
          </div>
        )}

        {/* The sheet's one live region: always mounted, so a change of its text is announced */}
        <p role="status" className="sr-only">
          {statusText}
        </p>
      </section>
    </>
  )
}
