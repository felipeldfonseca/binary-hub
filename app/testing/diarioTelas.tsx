/**
 * The Diário page's render harness (Phase 4, telas B0): one of the approved boards' scenarios (testing/diarioQuadro)
 * on the real page, every read and write answered by the mocks of testing/diarioTelasMocks. Lives outside __tests__ so
 * Jest does not run it as a suite. The test file must declare the mock block of diarioTelasMocks (renderDiario says so
 * when it is missing). Invented data only; never the network.
 *
 *   const { user, q } = await renderDiario('2')          // the scenario as the board opens it
 *   await renderDiario('10c', { estado: 'carregando' })   // the calendar read never answers
 *   await renderDiario('10d', { estado: 'erro' })         // every Diário read: PostgREST «function not found»
 *   await renderDiario('10e', { estado: 'offline' })      // loaded online, then the connection drops (board 10e)
 *
 * The clock is the scenario's (jest.useFakeTimers({ now, advanceTimers: true })), the URL '/diario?conta=&dia=' as
 * the scenario opens. The writes keep what they wrote (a review, a note), so a read after them shows it.
 */
import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager } from '@tanstack/react-query'
import * as navigation from 'next/navigation'
import * as diarioDb from '@/lib/hub/diarioDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as contasDb from '@/lib/hub/contasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import { diarioKeys } from '@/hooks/useDiario'
import { addDays } from '@/lib/domain/tempo'
import { monthOf, type Day } from '@/lib/domain/diario'
import { mesTitulo } from '@/lib/hub/diario'
import DiarioPage from '@/app/(hub)/diario/page'
import { renderHub } from './hubHarness'
import { navegacao, USUARIO_DO_QUADRO } from './diarioTelasMocks'
import { nomeDaConta, quadro, quadroJson, type Cenario, type Quadro } from './diarioQuadro'

type Json = Record<string, any>
const m = <T extends (...a: any[]) => any>(f: T) => f as unknown as jest.MockedFunction<T>

/** The mocked functions the harness answers (the test may answer them again) */
export const mocks = {
  fetchCalendario: m(diarioDb.fetchCalendario),
  fetchMes: m(diarioDb.fetchMes),
  fetchDia: m(diarioDb.fetchDia),
  saveDayReview: m(diarioDb.saveDayReview),
  saveDayNote: m(diarioDb.saveDayNote),
  signedImageUrls: m(diarioDb.signedImageUrls),
  fetchRulesNow: m(regrasDb.fetchRulesNow),
  fetchRulesConfig: m(regrasDb.fetchRulesConfig),
  mergePreferences: m(regrasDb.mergePreferences),
  fetchAccounts: m(contasDb.fetchAccounts),
  fetchActivity: m(contasDb.fetchActivity),
  fetchImportFormats: m(contasDb.fetchImportFormats),
  fetchBatches: m(contasDb.fetchBatches),
  fetchBatchUndo: m(contasDb.fetchBatchUndo),
  fetchPreferences: m(contasDb.fetchPreferences),
  fetchTemplates: m(contasDb.fetchTemplates),
  fetchTemplateMarkets: m(contasDb.fetchTemplateMarkets),
  fetchDayTrades: m(registrarDb.fetchDayTrades),
  fetchTradeEvents: m(registrarDb.fetchTradeEvents),
  fetchOpenTrades: m(registrarDb.fetchOpenTrades),
  fetchRecentTrades: m(registrarDb.fetchRecentTrades),
  fetchTradeState: m(registrarDb.fetchTradeState),
  fetchGateAt: m(registrarDb.fetchGateAt),
  addMarks: m(registrarDb.addMarks),
  imageSlots: m(registrarDb.imageSlots),
  saveExtras: m(registrarDb.saveExtras),
}

/** Whether the test file declared the mock block of testing/diarioTelasMocks */
function blocoDeclarado(): string[] {
  const faltam: string[] = []
  const marcados: [string, unknown][] = [
    ['next/navigation', navigation],
    ['@/lib/hub/diarioDb', diarioDb],
    ['@/lib/hub/regrasDb', regrasDb],
    ['@/lib/hub/contasDb', contasDb],
    ['@/lib/hub/registrarDb', registrarDb],
  ]
  for (const [nome, mod] of marcados) if (!(mod as { __diarioTelas?: boolean }).__diarioTelas) faltam.push(nome)
  return faltam
}

/** Three invented charts, as the signed URLs of a trade's images */
const GRAFICOS = [
  ['#e1ffd9', 'M8 70 L40 52 L72 60 L104 30 L136 38 L160 16'],
  ['#ff8a8a', 'M8 20 L40 34 L72 28 L104 58 L136 50 L160 76'],
  ['#ffd27a', 'M8 50 L40 44 L72 56 L104 40 L136 46 L160 36'],
].map(
  ([cor, d]) =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 104"><rect width="168" height="104" fill="#17191a"/><path d="${d}" fill="none" stroke="${cor}" stroke-width="3"/></svg>`,
    )}`,
)

/** The PostgREST error of a function that does not exist yet (the Phase 4 SQL not pasted): C7 */
const SEM_FUNCAO = { code: 'PGRST202', message: 'Could not find the function public.diario_calendario in the schema cache', details: null, hint: null }

export interface OpcoesDoDiario {
  /** Wraps the page in a `.hub[data-tema]` (a jsdom check of a theme; visual specs pass nothing) */
  tema?: 'claro' | 'escuro'
  estado?: 'carregando' | 'erro' | 'offline'
}

/** The answers of one account in the scenario's world, as JSON (the writes change them) */
interface ContaCrua {
  calendario: Json
  meses: Record<string, Json>
  dias: Record<Day, Json>
}

function contaCrua(q: Quadro, accountId: string): ContaCrua | null {
  if (!q.porConta[accountId]) return null
  const nome = nomeDaConta(accountId)
  const ag = q.info.ag
  const meses: Record<string, Json> = {}
  for (const mes of Object.keys(q.porConta[accountId].meses)) meses[mes] = quadroJson(`mes-${nome}-${mes}-${ag}`)
  const dias: Record<Day, Json> = {}
  for (const dia of Object.keys(q.porConta[accountId].dias)) {
    const variante = accountId === q.info.contaId && q.info.variante ? `-${q.info.variante}` : ''
    let raw: Json
    try {
      raw = quadroJson(`dia-${nome}-${dia}-${ag}${variante}`)
    } catch {
      raw = quadroJson(`dia-${nome}-${dia}-${ag}`)
    }
    dias[dia] = raw
  }
  return { calendario: quadroJson(`calendario-${nome}-${ag}`), meses, dias }
}

/** A month with nothing in it, on the head of the account's calendar (a month outside the exported ones) */
function mesVazio(cal: Json, month: string): Json {
  const primeiro = `${month}-01`
  const dow = (d: Day) => (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7
  const de = addDays(primeiro, -dow(primeiro))
  const ultimo = addDays(`${nextMonth(month)}-01`, -1)
  const ate = addDays(ultimo, 6 - dow(ultimo))
  const { days: _d, weeks: _w, first_day: _f, last_day: _l, from: _fr, to: _t, ...head } = cal
  return { ...head, month, from: de, to: ate, days: [], weeks: [], fora_trades: [] }
}

function nextMonth(month: string): string {
  const [y, mo] = month.split('-').map(Number)
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`
}

export interface DiarioRenderizado extends ReturnType<typeof renderHub> {
  q: Quadro
  user: ReturnType<typeof userEvent.setup>
  /** The answers as JSON, by account id (a write changes them; the next read parses them again) */
  cru: Record<string, ContaCrua>
}

/**
 * Renders /diario on a scenario of the boards. Answers every mocked read with the scenario's answers (a day not
 * exported is refused with a clear error, as C7), keeps the writes of a review and a note, and waits for the page
 * in 'offline' before the connection drops.
 */
export async function renderDiario(cen: Cenario, { tema, estado }: OpcoesDoDiario = {}): Promise<DiarioRenderizado> {
  const faltam = blocoDeclarado()
  if (faltam.length) {
    throw new Error(
      `renderDiario: this test file lacks the mock block of testing/diarioTelasMocks (contract §4.5) for ${faltam.join(', ')}; ` +
        'copy the seven jest.mock lines of that file to its top',
    )
  }
  const q = quadro(cen)
  jest.useFakeTimers({ now: q.agora, advanceTimers: true })
  navegacao.reiniciar()
  navegacao.definir(`/diario?conta=${q.info.contaId}&dia=${q.info.dia}`)

  const cru: Record<string, ContaCrua> = {}
  for (const id of Object.keys(q.porConta)) cru[id] = contaCrua(q, id) as ContaCrua
  const conta = (id: string) => {
    const c = cru[id]
    if (!c) throw new diarioDb.DiarioDataError('unknown_account')
    return c
  }
  const chaves = new Set<string>()
  let seq = 900

  // ---- the Diário's reads and writes
  if (estado === 'carregando') mocks.fetchCalendario.mockReset().mockImplementation(() => new Promise(() => {}))
  else if (estado === 'erro') {
    for (const f of [mocks.fetchCalendario, mocks.fetchMes, mocks.fetchDia]) f.mockReset().mockRejectedValue(diarioDb.toDiarioError(SEM_FUNCAO))
  } else {
    mocks.fetchCalendario.mockReset().mockImplementation(async (_db, accountId) => diarioDb.parseCalendar(conta(accountId).calendario))
  }
  if (estado !== 'erro') {
    mocks.fetchMes.mockReset().mockImplementation(async (_db, accountId, month) => {
      const c = conta(accountId)
      return diarioDb.parseMonth(c.meses[month] ?? mesVazio(c.calendario, month))
    })
    mocks.fetchDia.mockReset().mockImplementation(async (_db, accountId, day) => {
      const raw = conta(accountId).dias[day]
      if (!raw) throw new Error(`renderDiario: diario_dia of ${day} is not exported for scenario ${cen} (fixtures/diario-quadro)`)
      return diarioDb.parseDay(raw)
    })
  }
  mocks.saveDayReview.mockReset().mockImplementation(async (_db, accountId, day, payload, o = {}) => {
    const raw = conta(accountId).dias[day]
    const agora = new Date().toISOString()
    const repetida = !!payload.client_key && chaves.has(`r:${payload.client_key}`)
    const atual = raw.review as Json | null
    if (!o.dryRun && !repetida) {
      if (payload.client_key) chaves.add(`r:${payload.client_key}`)
      const versao = {
        id: ++seq,
        worked: payload.worked,
        written: !!(payload.worked || payload.differently || payload.followed || payload.carry_forward),
        followed: payload.followed,
        saved_at: agora,
        differently: payload.differently,
        auto_summary: raw.facts,
        carry_forward: payload.carry_forward,
      }
      if (atual) {
        const { first_saved_at: _f, versions: _v, ...anterior } = atual
        raw.review_history = [anterior, ...(raw.review_history ?? [])]
      }
      raw.review = { ...versao, first_saved_at: atual?.first_saved_at ?? agora, versions: (atual?.versions ?? 0) + 1 }
      const cal = conta(accountId).calendario.days.find((d: Json) => d.day === day)
      if (cal) cal.review = raw.review.written ? { versions: raw.review.versions, saved_at: agora, first_saved_at: raw.review.first_saved_at } : null
    }
    return diarioDb.parseReviewSaved({ v: 1, server_now: agora, dry_run: !!o.dryRun, repeated: repetida, review: raw.review, facts_now: raw.facts })
  })
  mocks.saveDayNote.mockReset().mockImplementation(async (_db, accountId, day, payload, o = {}) => {
    const raw = conta(accountId).dias[day]
    const agora = new Date().toISOString()
    const repetida = !!payload.client_key && chaves.has(`n:${payload.client_key}`)
    if (!o.dryRun && !repetida) {
      if (payload.client_key) chaves.add(`n:${payload.client_key}`)
      const atual = raw.note as Json | null
      raw.note = {
        id: atual?.id ?? ++seq,
        text: payload.text,
        written: payload.text !== null,
        saved_at: agora,
        versions: (atual?.versions ?? 0) + 1,
        first_saved_at: atual?.first_saved_at ?? agora,
      }
    }
    return diarioDb.parseNoteSaved({ v: 1, server_now: agora, dry_run: !!o.dryRun, repeated: repetida, note: raw.note })
  })
  mocks.signedImageUrls.mockReset().mockImplementation(async (_db, paths) => Object.fromEntries(paths.map((p, i) => [p, GRAFICOS[i % GRAFICOS.length]])))

  // ---- rules_now, the accounts, the preferences, the imports
  mocks.fetchRulesNow.mockReset().mockResolvedValue(q.rulesNow)
  mocks.fetchRulesConfig.mockReset().mockRejectedValue(new regrasDb.RegrasDataError('unknown'))
  mocks.mergePreferences.mockReset().mockImplementation(async (_db, patch) => ({ ...patch }) as contasDb.HubPreferences)
  mocks.fetchAccounts.mockReset().mockResolvedValue(q.contas)
  mocks.fetchActivity.mockReset().mockResolvedValue({})
  mocks.fetchImportFormats.mockReset().mockResolvedValue({})
  mocks.fetchPreferences.mockReset().mockResolvedValue({})
  mocks.fetchTemplates.mockReset().mockResolvedValue([])
  mocks.fetchTemplateMarkets.mockReset().mockResolvedValue({})
  mocks.fetchBatches.mockReset().mockImplementation(async (_db, accountId) => (q.lotes && accountId === q.lotes.accountId ? q.lotes.batches : []))
  mocks.fetchBatchUndo.mockReset().mockImplementation(async (_db, batchId) => {
    const u = q.lotes?.undo[batchId]
    if (!u) throw new contasDb.HubDataError('unknown')
    return u
  })

  // ---- the Registrar's reads (the Phase 3 bridge, the sheet) and the drill's writes
  const estadoDa = (tradeId: string) => {
    for (const c of Object.values(cru)) {
      for (const raw of Object.values(c.dias)) {
        const t = (raw.trades as Json[]).find((x) => x.trade_id === tradeId)
        if (t) return registrarDb.parseTradeState({ ...t, server_now: new Date().toISOString() })
      }
    }
    return null
  }
  mocks.fetchDayTrades.mockReset().mockResolvedValue([])
  mocks.fetchTradeEvents.mockReset().mockResolvedValue({})
  mocks.fetchOpenTrades.mockReset().mockResolvedValue([])
  mocks.fetchRecentTrades.mockReset().mockResolvedValue([])
  mocks.fetchTradeState.mockReset().mockImplementation(async (_db, tradeId) => estadoDa(tradeId))
  mocks.fetchGateAt.mockReset().mockRejectedValue(new registrarDb.RegistrarDataError('unknown'))
  mocks.addMarks.mockReset().mockImplementation(async (_db, tradeId) => {
    const s = estadoDa(tradeId)
    if (!s) throw new registrarDb.RegistrarDataError('unknown')
    return s
  })
  mocks.imageSlots.mockReset().mockRejectedValue(new registrarDb.RegistrarDataError('unknown'))
  mocks.saveExtras.mockReset().mockRejectedValue(new registrarDb.RegistrarDataError('unknown'))

  const ui = tema ? (
    <div className="hub" data-tema={tema}>
      <DiarioPage />
    </div>
  ) : (
    <DiarioPage />
  )
  const view = renderHub(ui)
  // As the app's QueryProvider: an answer is fresh for a minute, so a region drawn after the first answers (the
  // regions wait for the calendar) shares them instead of reading again (renderHub's cache has no staleTime)
  view.queryClient.setDefaultOptions({ ...view.queryClient.getDefaultOptions(), queries: { ...view.queryClient.getDefaultOptions().queries, staleTime: 60_000 } })
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
  if (estado === 'offline') {
    await esperar(() => {
      const cal = view.queryClient.getQueryData(diarioKeys.calendario(USUARIO_DO_QUADRO, q.info.contaId))
      const dia = view.queryClient.getQueryData(diarioKeys.dia(USUARIO_DO_QUADRO, q.info.contaId, q.info.dia))
      return !!cal && !!dia
    })
    await ficarOffline(view.queryClient)
  }
  return { ...view, q, user, cru }
}

/** Waits (fake timers advancing with the clock) until `ok()` */
async function esperar(ok: () => boolean, ms = 3000) {
  const fim = Date.now() + ms
  while (!ok()) {
    if (Date.now() > fim) throw new Error('renderDiario: the page did not load')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
}

/** The connection drops: React Query says offline and the Diário's reads are marked stale (they pause) */
export async function ficarOffline(queryClient: ReturnType<typeof renderHub>['queryClient']) {
  await act(async () => {
    onlineManager.setOnline(false)
    await queryClient.invalidateQueries({ queryKey: diarioKeys.all(USUARIO_DO_QUADRO) })
  })
}

/** Opens a trade's drill by its row's ▾ («Detalhes da operação: Venda de MES às 10:03») */
export async function abrirDrill(user: DiarioRenderizado['user'], hora: string) {
  const botao = await screen.findByRole('button', { name: new RegExp(`^Detalhes da operação: .* às ${hora}$`) })
  await user.click(botao)
  return botao
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Shows the month of `day` in the calendar with ‹ and › («Mês anterior», «Próximo mês») */
export async function mostrarMesDe(user: DiarioRenderizado['user'], day: Day) {
  const alvo = monthOf(day)
  const cal = await screen.findByRole('region', { name: 'Calendário' })
  for (let i = 0; i < 36; i++) {
    if (within(cal).queryByRole('heading', { level: 3, name: mesTitulo(alvo) })) return
    const h3 = within(cal).getByRole('heading', { level: 3 })
    const [nome, , ano] = (h3.textContent ?? '').toLowerCase().split(' ')
    const atual = `${ano}-${String(MESES.indexOf(nome) + 1).padStart(2, '0')}`
    await user.click(within(cal).getByRole('button', { name: atual > alvo ? 'Mês anterior' : 'Próximo mês' }))
  }
  throw new Error(`mostrarMesDe: the calendar never showed ${alvo}`)
}

// A test that drops the connection or pins the clock leaves both as they were
afterEach(() => {
  onlineManager.setOnline(true)
  jest.useRealTimers()
})
