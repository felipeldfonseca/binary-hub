/**
 * Phase 5-1 · telas-posso: «Posso operar hoje?» of the Diário's open account with «Dados econômicos» (boards Q06–Q18,
 * Q37; contract §5), on the SQL's recorded answers of the boards' world (testing/agenda). The card is mounted alone,
 * with the Diário page's provider replaced by the open account. Invented data.
 */
import React from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as agendaDb from '@/lib/hub/agendaDb'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import { parseRulesNow } from '@/lib/hub/regras'
import { entendiKey, entendiLido } from '@/lib/hub/avisoDados'
import PossoOperarHojeDiario from '@/components/hub/posso/PossoOperarHojeDiario'
import { renderHub } from '@/testing/hubHarness'
import { agoraDoEstado, ESTADOS_DADOS, leituraDoDia, type EstadoDados } from '@/testing/agenda'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => '/diario',
}))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn() }))
jest.mock('@/lib/hub/agendaDb', () => ({ ...jest.requireActual('@/lib/hub/agendaDb'), fetchAgendaDoDia: jest.fn() }))
let contaAberta = ''
jest.mock('@/components/hub/diario/useDiarioPagina', () => ({ useDiarioPaginaOpcional: () => ({ conta: { id: contaAberta } }) }))

const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const fetchAgendaDoDia = agendaDb.fetchAgendaDoDia as jest.MockedFunction<typeof agendaDb.fetchAgendaDoDia>

type Json = Record<string, any>

/** The state's rules_now, answered at the device's (fake) now each time it is read */
function responder(e: EstadoDados, edit: (j: Json) => void = () => {}) {
  fetchRulesNow.mockImplementation(async () => {
    const j = agoraDoEstado(e) as Json
    j.server_now = new Date().toISOString()
    edit(j)
    return parseRulesNow(j)
  })
}

type LeituraDoDia = (o: { at: Date }) => ReturnType<typeof leituraDoDia>

async function montar(
  e: EstadoDados,
  { em, edit, prefs = {}, agenda }: { em?: Date; edit?: (j: Json) => void; prefs?: Json; agenda?: LeituraDoDia } = {},
) {
  jest.useFakeTimers({ now: em ?? ESTADOS_DADOS[e].agora, advanceTimers: true })
  contaAberta = (agoraDoEstado(e) as Json).accounts[0].account_id
  responder(e, edit)
  fetchPreferences.mockResolvedValue(prefs as contasDb.HubPreferences)
  fetchAgendaDoDia.mockImplementation(async (_db, o) => (agenda ? agenda(o) : leituraDoDia(o.at, { semAgenda: ESTADOS_DADOS[e].semAgenda })))
  const view = renderHub(<PossoOperarHojeDiario />)
  const card = await screen.findByRole('region', { name: 'Posso operar hoje?' })
  await within(card).findByText('Top One')
  await act(async () => {
    await Promise.resolve()
  })
  return { ...view, card }
}

/** The card's texts below the line (the notes), in order */
const notas = (card: HTMLElement) => Array.from(card.querySelectorAll('.hub-posso__corpo > p, .hub-posso__corpo > div > p')).map((p) => p.textContent)

beforeEach(() => {
  window.localStorage.clear()
  fetchRulesNow.mockReset()
  fetchPreferences.mockReset()
  fetchAgendaDoDia.mockReset()
})
afterEach(() => jest.useRealTimers())

describe('«Posso operar hoje?» with «Dados econômicos» (the boards, recorded answers)', () => {
  it('Q06: «Aguardar até 10:10 · ISM de serviços às 10:00» in amber and «Conferidos: janela, dados econômicos e limite.»', async () => {
    window.localStorage.setItem(entendiKey((agoraDoEstado('q06-posso-espera-ism') as Json).accounts[0].account_id), '1')
    const { card } = await montar('q06-posso-espera-ism')
    const palavra = card.querySelector('.hub-posso__palavra') as HTMLElement
    expect(palavra).toHaveTextContent('Aguardar até 10:10')
    expect(palavra).toHaveClass('hub-tom--amber')
    expect(within(card).getByText('ISM de serviços às 10:00')).toBeInTheDocument()
    expect(notas(card)).toEqual(['Conferidos: janela, dados econômicos e limite.'])
  })

  it('Q11: the grey «Mais tarde: …» after the line, before «Conferidos»', async () => {
    const { card } = await montar('q11-posso-mais-tarde')
    expect(notas(card)).toEqual(['Mais tarde: ISM de serviços às 10:00, espera das 09:55 às 10:10.', 'Conferidos: janela, dados econômicos e limite.'])
  })

  it('Q12: «Liberado» in the text colour (never green) with «Tentar de novo», which reads rules_now and the agenda again', async () => {
    const { card } = await montar('q12-posso-sem-agenda')
    const palavra = card.querySelector('.hub-posso__palavra') as HTMLElement
    expect(palavra.tagName).toBe('STRONG')
    expect(palavra).toHaveClass('hub-tom--neutral')
    expect(palavra).not.toHaveClass('hub-tom--mint')
    expect(notas(card)).toEqual(['Conferidos: janela e limite. Não conferido: dados econômicos (o app está sem a agenda de hoje).'])
    const lidas = [fetchRulesNow.mock.calls.length, fetchAgendaDoDia.mock.calls.length]
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(within(card).getByRole('button', { name: 'Tentar de novo' }))
    expect(fetchRulesNow.mock.calls.length).toBe(lidas[0] + 1)
    expect(fetchAgendaDoDia.mock.calls.length).toBe(lidas[1] + 1)
  })

  it('Q16: «Fora da sua janela» keeps its word and colour; the absence only in the sentence; no «Tentar de novo» (as drawn)', async () => {
    const { card } = await montar('q16-posso-sem-agenda-fora')
    expect(card.querySelector('.hub-posso__palavra')).toHaveClass('hub-tom--amber')
    expect(within(card).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
    expect(notas(card)).toEqual(['Conferidos: janela e limite. Não conferido: dados econômicos (o app está sem a agenda de hoje).'])
  })

  it('Q17: «Encerrado por hoje · limite atingido às 10:38» first, no release words', async () => {
    const { card } = await montar('q17-posso-encerrado-na-espera')
    expect(card.querySelector('.hub-posso__estado')).toHaveTextContent('Encerrado por hoje· limite atingido às 10:38')
    expect(card).not.toHaveTextContent(/Fed|Aguardar|Mais tarde/)
  })

  it('Q18: the first-wait notice with «Entendi»; «Entendi» keeps the shared key (marcarEntendi) and the notice leaves, focus on the title', async () => {
    const { card } = await montar('q18-posso-primeira-espera')
    const aviso = within(card).getByRole('status')
    expect(aviso).toHaveTextContent(
      'Esta espera vem da regra “Dados econômicos” desta conta (5 min antes e 10 depois dos dados fortes). O app passou a conferi-la; você muda em Personalizar.',
    )
    expect(notas(card)).toEqual([aviso.textContent, 'Conferidos: janela, dados econômicos e limite.'])
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    await user.click(within(card).getByRole('button', { name: 'Entendi' }))
    expect(entendiLido(contaAberta)).toBe(true)
    expect(within(card).queryByRole('status')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Posso operar hoje?' })).toHaveFocus()
  })

  it('Q18 after an «Entendi» given in Personalizar (the same key): no notice', async () => {
    window.localStorage.setItem(entendiKey((agoraDoEstado('q18-posso-primeira-espera') as Json).accounts[0].account_id), '1')
    const { card } = await montar('q18-posso-primeira-espera')
    expect(within(card).queryByRole('button', { name: 'Entendi' })).toBeNull()
  })

  it('the same wait on an account created after the delivery (Q06: the world\'s 30 Nov, ENTREGA_DADOS_ECONOMICOS): no notice', async () => {
    const { card } = await montar('q06-posso-espera-ism')
    expect(within(card).getByText('Aguardar até 10:10')).toBeInTheDocument()
    expect(within(card).queryByText(/^Esta espera vem da regra/)).toBeNull()
    expect(within(card).queryByRole('button', { name: 'Entendi' })).toBeNull()
  })

  it('a cancelled release of today: the grey «CPI de hoje cancelado: sem espera hoje.» (NEW, not drawn)', async () => {
    // Q15's morning (CPI in «Só opero depois do dado») with the CPI cancelled: in the day's read, and gone from rules_now's
    // block.today as the gate would answer it (SPEC 5.9: the gate never receives a cancelled release)
    const { card } = await montar('q15-posso-espera-acabou', {
      edit: (j) => {
        const b = j.accounts[0].block
        b.today = b.today.filter((i: Json) => !i.releases.some((r: Json) => r.code === 'cpi'))
      },
      agenda: (o) => {
        const r = leituraDoDia(o.at)
        return { ...r, rows: r.rows.map((x) => (x.code === 'cpi' ? { ...x, status: 'cancelado' as const } : x)) }
      },
    })
    expect(await within(card).findByText('CPI de hoje cancelado: sem espera hoje.')).toBeInTheDocument()
    expect(notas(card)).toEqual(['CPI de hoje cancelado: sem espera hoje.', 'Conferidos: janela, dados econômicos e limite.'])
  })

  it('the window clock\'s midnight redraws the words without a new answer: «amanhã às 08:40» becomes «08:40»', async () => {
    // Q07's CPI «Só opero depois do dado» (the wait from 18:00 to 08:40), answered on the eve at 23:50 ET
    const { card } = await montar('q07-posso-depois-cpi', {
      em: new Date('2026-12-10T04:50:00Z'),
      edit: (j) => {
        j.accounts[0].at = new Date().toISOString()
      },
    })
    expect(card).toHaveTextContent('Aguardar até amanhã às 08:40')
    expect(card).toHaveTextContent('CPI amanhã às 08:30')
    const lidas = fetchRulesNow.mock.calls.length
    await act(async () => {
      jest.advanceTimersByTime(11 * 60_000)
    })
    expect(card).toHaveTextContent('Aguardar até 08:40')
    expect(card).not.toHaveTextContent('amanhã')
    expect(fetchRulesNow.mock.calls.length).toBe(lidas)
  })

  it('without a cancellation in the read, no such line', async () => {
    const { card } = await montar('q15-posso-espera-acabou')
    expect(notas(card)).toEqual(['Conferidos: janela, dados econômicos e limite.'])
  })
})
