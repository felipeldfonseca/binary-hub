/**
 * The jest.mock factories of testing/registrarDados (Phase 5-1, lane telas-posso). Apart from the render helper, which
 * imports the sheet (and so the mocked modules): a factory that required it would run while that module loads. This
 * module imports nothing at top level. Invented data only.
 */
export const mockContasDb = () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() })
export const mockRegrasDb = () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() })
export const mockRegistrarDb = () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchGateAt: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewEntry: jest.fn(),
  previewAfter: jest.fn(),
  registerEntry: jest.fn(),
  drainImageTrash: jest.fn(),
})
export const mockNavegacao = () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/diario',
})

