'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import { buildImportArgs, previewArgs, readImportFile, type ReadImportFileResult } from '@/lib/domain/import'
import { LABEL_MAX, PLATFORM_UNKNOWN, labelTaken, parseSize, zoneKeyOf, type TradingAccount } from '@/lib/hub/contas'
import {
  HubDataError,
  createAccount,
  importCommit,
  importFixTz,
  importPreview,
  importUndo,
  toHubError,
  type FixTzResult,
  type HubErrorCode,
  type ImportCommitResult,
  type ImportPreviewResult,
} from '@/lib/hub/contasDb'
import { useAccounts, useHubDb, useImportFormats, useRefreshAfterWrite } from '@/hooks/useContas'
import { useAgora } from '@/hooks/useAgora'
import { useRulesConfig, useSaveRules } from '@/hooks/useRegras'
import { buildNewAccountPayload, type NewAccountRules, type RulesConfig } from '@/lib/hub/regras'
import { toRegrasError } from '@/lib/hub/regrasDb'
import {
  desdeDaNovaConta,
  linhaAntesDasRegras,
  linhaImportadas,
  novaContaNaConfig,
  regrasDaNovaConta,
  regrasEditadas,
} from '@/lib/hub/regrasConta'
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
  PASSO_B,
  PASSO_C,
  PASSO_CONF,
  PASSO_D,
  PASSO_F,
  PASSO_I1,
  PASSO_I2,
  SOLTE,
  UNDO,
  platformLabel,
  undoAria,
  zoneName,
} from '@/components/hub/contas/copy'
import { REGRAS_CONTA } from '@/components/hub/contas/copyRegras'
import { InfoButton, InfoPanel, useToggle } from '@/components/hub/contas/ui'
import { ERRO_JANELA, REGRAS } from '@/components/hub/personalizar/copy'
import { END_STEPS, emptyFileSummary, fileSummary, needsZoneStep, parsedOf, stepIndicator, type Passo } from './flow'
import RegrasDaConta from './RegrasDaConta'
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
})

interface Primary {
  label: string
  run: () => void
  /** Blocks the action; the hint explains why */
  blocked?: string
  /** Blocks the action; a field's own error explains why */
  blockedBy?: string
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
  const refresh = useRefreshAfterWrite()
  // The saved rules: step b's copy sources and market windows, v1's base_rev, step d's «desde»
  const rulesConfig = useRulesConfig()
  const saveRules = useSaveRules()
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

  /** Moves to a step; `push` keeps the current one for "Voltar". */
  const move = useCallback((passo: Passo, patch: Partial<Flow> = {}, push = true) => {
    if (!alive.current) return
    setError(null)
    setFlow((f) => ({ ...f, ...patch, passo, history: push ? [...f.history, f.passo] : f.history }))
    setFocusTick((t) => t + 1)
  }, [])

  const fail = useCallback((e: unknown, patch: Partial<Flow> = {}) => {
    if (!alive.current) return
    setError(toHubError(e).code)
    if (Object.keys(patch).length > 0) setFlow((f) => ({ ...f, ...patch }))
  }, [])

  const runPreview = useCallback(
    async (target: TradingAccount, tz: string, file: ReadImportFileResult, patch: Partial<Flow> = {}, push = true) => {
      const p = parsedOf(file)
      if (!p) return
      setBusy(true)
      setError(null)
      try {
        const args = buildImportArgs({ accountId: target.id, platform: p.platform, fileName: file.fileName, sha256: file.sha256, fileTz: tz, outcome: p })
        const result = await importPreview(db, previewArgs(args))
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
        const nothing = result.new === 0 && result.completable === 0 && result.other_account === 0
        move(nothing ? 'f' : 'd', { ...patch, accountId: target.id, preview: result, zoneUsed: tz }, push)
      } catch (e) {
        fail(e, { ...patch, accountId: target.id })
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [db, move, fail, setBusy],
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
      await runPreview(target, target.file_tz, file, { ...patch, file, zoneChosen: false })
    },
    [move, runPreview],
  )

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
    const p = parsedOf(result)
    if (!p) {
      move('erro', { file: result })
      return
    }
    const context = view(flow.accountId)
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
      return
    }
    setBusy(true)
    setError(null)
    try {
      const futures = formMarket === 'futures'
      const created = await createAccount(db, userId, {
        market: formMarket,
        label: form.label.trim().slice(0, LABEL_MAX),
        platform: parsed ? parsed.platform : form.platform === PLATFORM_UNKNOWN ? null : form.platform,
        firm: parsed || !futures ? null : form.firm.trim() || null,
        external_ref: form.ref.trim() || null,
        phase: futures ? form.phase : 'pessoal',
        size: futures && sizeValue !== 'invalid' ? sizeValue : null,
        is_primary: active.length === 0,
      })
      refresh()
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
      await runPreview({ ...account, file_tz: tz, tz_applied_at: new Date().toISOString() }, tz, flow.file, { zoneChosen: true })
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const commit = async () => {
    const preview = flow.preview
    if (!preview || !account || !flow.file || !parsed || !flow.zoneUsed) return
    if (preview.new === 0 && preview.completable === 0) {
      // Everything is already in another account: nothing to write
      if (flow.created) move('fim', { nothingImported: true })
      else onClose()
      return
    }
    setBusy(true)
    setError(null)
    try {
      const args = buildImportArgs({
        accountId: account.id,
        platform: parsed.platform,
        fileName: flow.file.fileName,
        sha256: flow.file.sha256,
        fileTz: flow.zoneUsed,
        outcome: parsed,
      })
      const result = await importCommit(db, args)
      refresh()
      move('fim', { commit: result, undone: false, nothingImported: false })
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  const undo = async () => {
    const batch = flow.commit?.batch_id
    if (busyRef.current || !batch || !account || !flow.file || !flow.zoneUsed) return
    setBusy(true)
    setError(null)
    try {
      await importUndo(db, batch)
      refresh()
      if (!alive.current) return
      // Back to the preview it came from, with «Importação desfeita» and fresh counts
      setFlow((f) => ({ ...f, passo: 'd', history: f.history[f.history.length - 1] === 'd' ? f.history.slice(0, -1) : f.history, commit: null }))
      setBusy(false)
      await runPreview(account, flow.zoneUsed, flow.file, { undone: true, commit: null }, false)
    } catch (e) {
      fail(e)
    } finally {
      if (alive.current) setBusy(false)
    }
  }

  // --------------------------------------------------------------------------------------------
  // Back and close
  // --------------------------------------------------------------------------------------------

  /** Steps "Voltar" skips: the form of an account already created, and a zone already applied. */
  const skipOnBack = (p: Passo, f: Flow) => (p === 'b' && !!f.created) || ((p === 'conf' || p === 'c') && f.fixApplied)

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
      // "Continuar" never opens a second "Nova conta"
      const choice = passo === 'a' && f.created && f.createdFromForm && skipped.includes('b') ? f.created.id : f.choice
      return { ...f, passo, history: f.history.slice(0, backIndex), undone: false, choice }
    })
    setFocusTick((t) => t + 1)
  }

  const typed =
    !!(form.label.trim() || form.size.trim() || form.ref.trim() || form.firm.trim() || form.search.trim() || form.phase || form.platform) ||
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

  // --------------------------------------------------------------------------------------------
  // The current step: body and footer
  // --------------------------------------------------------------------------------------------

  let body: React.ReactNode = null
  let primary: Primary | null = null
  const closeAction: Primary = { label: FOLHA.close, run: onClose }

  switch (flow.passo) {
    case 'solte': {
      const title = flow.fileAgain ? SOLTE.titleAgain : account ? SOLTE.titleFor(account.label) : SOLTE.titleNone
      body = <PassoSolte headingRef={headingRef} title={title} reading={reading} onFile={(file) => void onFile(file)} />
      break
    }
    case 'erro': {
      const failed = flow.file && !flow.file.outcome.ok ? flow.file.outcome : null
      body = <PassoErro headingRef={headingRef} failed={failed} parsed={flow.file?.outcome.ok ? flow.file.outcome : null} />
      primary = { label: ERRO.again, run: () => move('solte', { fileAgain: true, file: null }) }
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
          if (flow.choice === 'nova') move('b', { form: { ...EMPTY_FORM, market: parsed.market }, createdFromForm: false })
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
        />
      )
      primary = { label: FOLHA.next, run: () => move('i2'), blocked: form.market ? undefined : PASSO_I1.hint }
      break
    case 'i2':
      body = <PassoPlataforma headingRef={headingRef} form={form} onChange={setForm} />
      primary = { label: FOLHA.next, run: () => move('b'), blocked: form.platform ? undefined : PASSO_I2.hint }
      break
    case 'b': {
      const futures = formMarket === 'futures'
      let roLabel: string = futures ? PASSO_B.roPlatform : PASSO_B.roBroker
      let roValue = ''
      if (parsed) {
        roLabel = parsed.platform === 'topone' ? PASSO_B.roFile : PASSO_B.roBroker
        roValue = parsed.platform === 'topone' ? PASSO_B.fileTopOne : PASSO_B.fileEbinex
      } else {
        if (futures && form.firm.trim()) roLabel = PASSO_B.roFirmPlatform
        const platform = form.platform ? platformLabel(form.platform) : PASSO_B.platformTbd
        roValue = [futures ? form.firm.trim() : '', platform].filter(Boolean).join(' · ')
      }
      const sizeInvalid = futures && sizeValue === 'invalid'
      const locked = flow.createdFromForm && !!flow.created
      const name = form.label.trim()
      // What «Criar» waits for first: a nickname and, for futures, the phase
      const basics = !name ? PASSO_B.needLabel : futures && !form.phase ? PASSO_B.needPhase : undefined
      // Then the rules block: the saved rules, and a limit or a window that can be saved
      let rulesBlocked: string | undefined
      let rulesBlockedBy: string | undefined
      if (rulesLoad === 'carregando') rulesBlockedBy = 'regras-carga'
      else if (rules?.limiteErro) rulesBlocked = REGRAS.limiteErro[rules.limiteErro]
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
          regras={
            <RegrasDaConta
              carga={rulesLoad}
              regras={rules}
              form={form.rules}
              onForm={(next) => setForm({ rules: next })}
              label={form.label}
              now={now}
              desde={config && rules ? desdeDaNovaConta(config, rules, now) : null}
              locked={locked}
              // The hint under «Criar» says the limit's error once nothing comes before it
              limiteErroId={basics ? undefined : 'dica-pri'}
            />
          }
        />
      )
      primary = locked
        ? // The account exists; what followed it failed and is tried again
          { label: FOLHA.next, run: () => void createFromForm() }
        : {
            label: name ? (parsed ? PASSO_B.createAndGo(name) : PASSO_B.create(name)) : PASSO_B.createFallback,
            run: () => void createFromForm(),
            blocked: basics ?? rulesBlocked,
            blockedBy: taken ? 'f-apelido-erro' : sizeInvalid ? 'f-tam-erro' : rulesBlockedBy,
          }
      break
    }
    case 'c': {
      if (!parsed) break
      const tz = chosenTz(flow.zone)
      body = <PassoFuso headingRef={headingRef} parsed={parsed} zone={flow.zone} onChange={(zone) => setFlow((f) => ({ ...f, zone }))} />
      primary = {
        label: flow.fixOnly ? PASSO_C.confirm : FOLHA.next,
        run: () => {
          if (!tz || !account) return
          if (flow.fixOnly) void zoneDryRun(tz)
          else if (flow.file) void runPreview(account, tz, flow.file, { zoneChosen: true })
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
      if (!preview || !parsed || !flow.zoneUsed) break
      body = (
        <PassoPrevia
          headingRef={headingRef}
          preview={preview}
          parsed={parsed}
          label={label}
          zoneUsed={flow.zoneUsed}
          zoneChosen={flow.zoneChosen}
          undone={flow.undone}
          antesDasRegras={account ? linhaAntesDasRegras(config, account.id, parsed.rows, flow.zoneUsed, preview.new) : null}
        />
      )
      primary = {
        label: preview.new > 0 ? PASSO_D.importN(preview.new) : preview.completable > 0 ? PASSO_D.completeN(preview.completable) : FOLHA.done,
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
          account={{ label: from.label, market: from.market === 'futures' ? 'futures' : 'binary' }}
          targets={targets}
          busy={busy}
          onImportInto={(id) => {
            if (busyRef.current) return
            const target = view(id)
            if (target && flow.file) void afterAccount(target, flow.file, { accountId: id })
          }}
          onCreate={() => {
            if (!busyRef.current) move('b', { form: { ...EMPTY_FORM, market: parsed.market }, createdFromForm: false })
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
      } else if (result && (result.inserted > 0 || result.completed > 0)) {
        if (result.inserted > 0) {
          // After the account's rules started, imported rows are judged by them (decisoes)
          const judged =
            account && parsed && flow.zoneUsed ? linhaImportadas(config, account.id, parsed.rows, flow.zoneUsed, result.inserted) : null
          lines.push(judged ?? FIM.inHistory(result.inserted))
        }
        if (result.completed > 0) lines.push(FIM.completed(result.completed))
        if (result.batch_id) lines.push(FIM.undoLater)
      } else if (result) {
        title = PASSO_F.title(result.duplicate, label)
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
      const iq = created?.platform === 'iq'
      body = <PassoFim headingRef={headingRef} title={FIM_CONTA.title(created?.label ?? label)} lines={[iq ? FIM_CONTA.textIq : FIM_CONTA.text]} />
      primary = iq ? closeAction : { label: FIM_CONTA.importHistory, run: () => move('solte', { accountId: created?.id ?? flow.accountId }) }
      break
    }
  }

  const title = mode === 'adicionar' && !flow.file && flow.passo !== 'solte' ? FOLHA.titleAdd : FOLHA.titleImport
  // The file card: a read file, or on the error step a known format with no trade line
  const fileLine =
    flow.passo === 'solte'
      ? null
      : parsed
        ? fileSummary(parsed, new Date().getFullYear())
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
  })
  const showBack = !END_STEPS.includes(flow.passo) && flow.passo !== 'g' && backIndex >= 0
  const blocked = !!primary && (!!primary.blocked || !!primary.blockedBy)
  const toastText = flow.passo === 'fim' && flow.commit?.batch_id ? FIM.toast(flow.commit.inserted, label) : ''
  // What the one live region says: the running request, else the latest result
  const rulesNotice = flow.rulesNotSaved ? REGRAS_CONTA.naoSalvas(flow.rulesNotSaved) : ''
  const statusText =
    busy ? BUSY : reading ? SOLTE.reading : toastText || (flow.passo === 'd' && flow.undone ? PASSO_D.undone(label) : '') || rulesNotice

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
                  <button
                    type="button"
                    className="hub-btn hub-btn--pri"
                    aria-disabled={blocked || busy || undefined}
                    aria-describedby={primary.blocked ? 'dica-pri' : primary.blockedBy}
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
