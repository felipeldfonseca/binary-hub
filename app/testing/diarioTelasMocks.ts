/**
 * The Diário page's test mocks (Phase 4, telas B0): factories for jest.mock and the URL store. Lives outside __tests__
 * so Jest does not run it as a suite. jest.mock is hoisted per test file and cannot be applied by a helper at call
 * time, so every suite and visual spec that renders the page declares this fixed top-level block (copied verbatim;
 * `require` inside a factory is allowed by babel-jest's hoisting):
 *
 *   jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
 *   jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
 *   jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
 *   jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
 *   jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
 *   jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
 *   jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())
 *
 * Each data factory keeps the real module (jest.requireActual: errors, parsers, types) and replaces only its reads
 * and writes with jest.fn()s, which testing/diarioTelas' renderDiario answers with a scenario of the boards. This
 * module imports none of the mocked modules at top level. Invented data only.
 */

type Ouvinte = () => void

const INICIO = '/diario'
let atual = INICIO
const ouvintes = new Set<Ouvinte>()

function ir(url: string) {
  atual = url.startsWith('/') ? url : `${INICIO}${url.startsWith('?') ? '' : '?'}${url}`
  ouvintes.forEach((f) => f())
}

const busca = () => {
  const i = atual.indexOf('?')
  return i < 0 ? '' : atual.slice(i + 1)
}
const caminho = () => {
  const i = atual.indexOf('?')
  return i < 0 ? atual : atual.slice(0, i)
}

/**
 * The URL as the mocked next/navigation keeps it. `replace` and `push` are spies that change the URL, so every
 * component reading useSearchParams draws again (the page's provider follows ?dia= and ?op=, contract §4.3).
 */
export const navegacao = {
  /** Puts the app on a URL ('/diario?conta=…&dia=…', or just '?conta=…') and tells every reader */
  definir: (url: string) => ir(url),
  /** The URL now ('/diario?…') */
  url: () => atual,
  /** The query now, as URLSearchParams */
  params: () => new URLSearchParams(busca()),
  replace: jest.fn((url: string, _o?: { scroll?: boolean }) => ir(url)),
  push: jest.fn((url: string, _o?: { scroll?: boolean }) => ir(url)),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
  /** Back to '/diario', the spies cleared (their URL behaviour kept) */
  reiniciar() {
    atual = INICIO
    for (const f of [navegacao.replace, navegacao.push]) {
      f.mockReset()
      f.mockImplementation((url: string) => ir(url))
    }
    for (const f of [navegacao.back, navegacao.forward, navegacao.refresh, navegacao.prefetch]) f.mockReset()
  },
}

/** The router every component gets (one object, as Next's is stable) */
const roteador = {
  replace: (url: string, o?: { scroll?: boolean }) => navegacao.replace(url, o),
  push: (url: string, o?: { scroll?: boolean }) => navegacao.push(url, o),
  back: () => navegacao.back(),
  forward: () => navegacao.forward(),
  refresh: () => navegacao.refresh(),
  prefetch: (url: string) => navegacao.prefetch(url),
}

/** next/navigation over the URL store */
export function mockNavegacao() {
  const { useMemo, useSyncExternalStore } = jest.requireActual('react') as typeof import('react')
  const subscribe = (f: Ouvinte) => {
    ouvintes.add(f)
    return () => {
      ouvintes.delete(f)
    }
  }
  return {
    __diarioTelas: true,
    useSearchParams: () => {
      const s = useSyncExternalStore(subscribe, busca, busca)
      return useMemo(() => new URLSearchParams(s), [s])
    },
    usePathname: () => useSyncExternalStore(subscribe, caminho, caminho),
    useRouter: () => roteador,
    useParams: () => ({}),
    redirect: jest.fn(),
    notFound: jest.fn(),
  }
}

/** The invented user of fixtures/diario-quadro */
export const USUARIO_DO_QUADRO: string = require('./fixtures/diario-quadro/ids.json').user

/** lib/supabase: a data client that is never called (every read and write is mocked) */
export function mockSupabase() {
  return { __diarioTelas: true, createDataClient: jest.fn(() => ({})), createServerClient: jest.fn(() => ({})), supabase: {} }
}

/** hooks/useAuth: the invented user, signed in */
export function mockAuth() {
  const valor = { user: { id: USUARIO_DO_QUADRO }, session: { access_token: 'jwt-de-teste' }, loading: false }
  return { __diarioTelas: true, useAuth: () => valor }
}

/** lib/hub/diarioDb: the three reads, the two writes and the signed URLs */
export function mockDiarioDb() {
  return {
    ...jest.requireActual('@/lib/hub/diarioDb'),
    __diarioTelas: true,
    fetchCalendario: jest.fn(),
    fetchMes: jest.fn(),
    fetchDia: jest.fn(),
    saveDayReview: jest.fn(),
    saveDayNote: jest.fn(),
    signedImageUrls: jest.fn(),
  }
}

/** lib/hub/regrasDb: rules_now, the preferences, the rules' reads and save */
export function mockRegrasDb() {
  return {
    ...jest.requireActual('@/lib/hub/regrasDb'),
    __diarioTelas: true,
    fetchRulesNow: jest.fn(),
    fetchRulesConfig: jest.fn(),
    mergePreferences: jest.fn(),
    saveRules: jest.fn(),
    fetchTradesSince: jest.fn(),
  }
}

/** lib/hub/contasDb: the accounts, the preferences, the formats, the imports and their undo */
export function mockContasDb() {
  return {
    ...jest.requireActual('@/lib/hub/contasDb'),
    __diarioTelas: true,
    fetchAccounts: jest.fn(),
    fetchActivity: jest.fn(),
    fetchImportFormats: jest.fn(),
    fetchBatches: jest.fn(),
    fetchBatchUndo: jest.fn(),
    fetchPreferences: jest.fn(),
    fetchTemplates: jest.fn(),
    fetchTemplateMarkets: jest.fn(),
  }
}

/** lib/hub/registrarDb: the reads of the bridge and the sheet, the marks, the images and the note */
export function mockRegistrarDb() {
  return {
    ...jest.requireActual('@/lib/hub/registrarDb'),
    __diarioTelas: true,
    fetchDayTrades: jest.fn(),
    fetchTradeEvents: jest.fn(),
    fetchOpenTrades: jest.fn(),
    fetchRecentTrades: jest.fn(),
    fetchTradeState: jest.fn(),
    fetchGateAt: jest.fn(),
    addMarks: jest.fn(),
    imageSlots: jest.fn(),
    saveExtras: jest.fn(),
    uploadImage: jest.fn(),
    imageTrashDone: jest.fn(),
    drainImageTrash: jest.fn(),
    signedImageUrl: jest.fn(),
  }
}
