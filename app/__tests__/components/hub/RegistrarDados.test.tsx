/**
 * Phase 5-1 · telas-posso: the Registrar on the «Dados econômicos» boards (Q33–Q38; c3 §7.2, §8.2): the answer for the
 * entry, the amber mark beside one plan sentence that always ends «Você pode registrar.», the button never off, the risk
 * notice where the app already puts it (Q36, under the stop, before the plan line), and the 10-minute notice under the
 * answer only for an entry «now» and with the preference on. The SQL's recorded answers (testing/agenda). Invented data.
 */
import { act, screen, within } from '@testing-library/react'
import { renderRegistrarDados } from '@/testing/registrarDados'
import { et } from '@/testing/agenda'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => require('@/testing/registrarDadosMocks').mockContasDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/registrarDadosMocks').mockRegrasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/registrarDadosMocks').mockRegistrarDb())
jest.mock('next/navigation', () => require('@/testing/registrarDadosMocks').mockNavegacao())

// The sheet keeps a draft per account in sessionStorage (a typed hour would outlive its test)
beforeEach(() => sessionStorage.clear())
afterEach(() => jest.useRealTimers())

const linhaDoGate = () => screen.getByRole('button', { name: 'Como ler: Posso operar hoje?' }).parentElement as HTMLElement
const linhaDoPlano = () => document.querySelector('.hub-reg-plano-linha') as HTMLElement
const AVISO = 'Às 09:55 começa a espera do ISM de serviços (10:00), até 10:10.'

async function aberto() {
  await screen.findByRole('heading', { level: 3, name: 'Entrada' })
  await act(async () => {
    jest.advanceTimersByTime(20)
  })
}

describe('the Registrar with «Dados econômicos» (boards Q33–Q38)', () => {
  it.each([
    ['q33-registrar-espera', 'Aguardar até 10:10· ISM de serviços às 10:00', 'na espera do ISM', 'Na espera do ISM de serviços (09:55 às 10:10): fora do plano. Você pode registrar.'],
    ['q34-registrar-depois', 'Aguardar até 10:10· ISM de serviços às 10:00 · só opero depois do dado', 'na espera do ISM', 'ISM de serviços às 10:00: pelo seu plano, você só opera a partir das 10:10. Você pode registrar.'],
    ['q35-registrar-dia', 'Não opero hoje· dia de CPI, às 08:30', 'em dia de CPI', 'Dia de CPI: pelo seu plano, você não opera neste dia. Você pode registrar.'],
  ] as const)('%s: the answer, the amber mark and the sentence in the text colour; «Registrar entrada» on', async (e, resposta, marca, frase) => {
    renderRegistrarDados(e)
    await aberto()
    expect(linhaDoGate()).toHaveTextContent(`Posso operar hoje?${resposta}`)
    const plano = linhaDoPlano()
    expect(within(plano).getByText(marca)).toBeInTheDocument()
    expect(within(plano).getByText(frase)).toBeInTheDocument()
    expect(within(plano).getByText(frase)).not.toHaveClass('hub-tom--amber')
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeEnabled()
  })

  it('Q36: the risk notice stays under the stop (as built), then the mark and sentence 1', async () => {
    const { user } = renderRegistrarDados('q36-registrar-dois-avisos')
    await aberto()
    expect(linhaDoGate()).toHaveTextContent('Posso operar hoje?Aguardar até 10:10· ISM de serviços às 10:00')
    await user.click(within(screen.getByRole('group', { name: 'Ativo' })).getByRole('button', { name: 'ES' }))
    await user.type(screen.getByLabelText('Preço de entrada'), '7.912,25')
    await user.type(screen.getByLabelText('Stop'), '4')
    const risco = await screen.findByText(/^Se o stop for atingido, o dia passa do limite: faltam US\$.155 e o stop arrisca US\$.200\.$/)
    const plano = linhaDoPlano()
    expect(within(plano).getByText('Na espera do ISM de serviços (09:55 às 10:10): fora do plano. Você pode registrar.')).toBeInTheDocument()
    expect(risco.compareDocumentPosition(plano) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Registrar entrada' })).toBeEnabled()
  })

  it('Q38: the 10-minute notice under the answer (role="status", amber with its clock), before «Limite do dia»; the plan says the window only', async () => {
    renderRegistrarDados('q38-aviso-10min-registrar')
    await aberto()
    const aviso = await screen.findByText(AVISO)
    const linha = aviso.closest('.hub-reg-ctx-linha') as HTMLElement
    expect(linha).toHaveAttribute('role', 'status')
    expect(linha.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(linha.previousElementSibling).toBe(linhaDoGate())
    expect(linha.nextElementSibling).toHaveTextContent('Limite do dia')
    expect(within(linhaDoPlano()).getByText('Fora do plano, conferido pelo hub. Você pode registrar.')).toBeInTheDocument()
  })

  it('the notice only for an entry «now»: a typed hour takes it away', async () => {
    const { user } = renderRegistrarDados('q38-aviso-10min-registrar')
    await aberto()
    expect(await screen.findByText(AVISO)).toBeInTheDocument()
    const hora = screen.getByLabelText('Hora (ET)')
    await user.clear(hora)
    await user.type(hora, '09:40')
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('the notice off with the preference (alerts.before_block = false)', async () => {
    renderRegistrarDados('q38-aviso-10min-registrar', { prefs: { alerts: { before_block: false } } })
    await aberto()
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('the notice held back while the preferences are being read (a switched-off notice must not flash), as the Diário card', async () => {
    renderRegistrarDados('q38-aviso-10min-registrar', { prefsPendentes: true })
    await aberto()
    expect(linhaDoGate()).toHaveTextContent('Fora da sua janela')
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('never under «Encerrado por hoje» (c3 §5.2, SPEC §7.2 «nada sobre dados»): the limit hit at 09:30, ISM at 10:00', async () => {
    renderRegistrarDados('q38-aviso-10min-registrar', {
      mudaAgora: (j) => {
        const a = j.accounts[0]
        a.limit = { ...a.limit, state: 'atingido', hit_at: '2026-12-03T14:30:00+00:00', used: 500, net_usd: -500, worst_usd: -500, trades: 1 }
        a.today = { trades: 1, net_usd: -500, worst_usd: -500 }
        a.status = 'encerrado'
        return j
      },
    })
    await aberto()
    expect(linhaDoGate()).toHaveTextContent('Encerrado por hoje')
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('from 09:45 to 09:55 on the server clock, without a new answer', async () => {
    renderRegistrarDados('q38-aviso-10min-registrar', { em: et('2026-12-03 09:44:50') })
    await aberto()
    expect(screen.queryByText(AVISO)).toBeNull()
    await act(async () => {
      jest.advanceTimersByTime(15_000)
    })
    expect(await screen.findByText(AVISO)).toBeInTheDocument()
    await act(async () => {
      jest.advanceTimersByTime(10 * 60_000)
    })
    expect(screen.queryByText(AVISO)).toBeNull()
  })
})
