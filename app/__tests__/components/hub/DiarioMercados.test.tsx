/**
 * Fase 4 · telas, lane L2: the Phase 3 bridge's «new markets (3-4)» block carried to «Operações do dia» and its drill
 * (contract §6.7), on diario_dia answers composed from the Registrar's 3-4 recordings (testing/diarioMercados: real SQL
 * trade states of FTMO, IBKR, Binance and Clear in the recorded day shape, invented data): the rows (lots, the option's
 * contract, shares, crypto on Brasília's clock, R$ only, «2 un.»), every amount with its no-break space, the actions'
 * arias, the plan «—» without a window, and the drill's stops in pips, at a price and in the premium with their R.
 */
import React from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { contaDiarioDe } from '@/lib/hub/diarioPagina'
import { contaReg } from '@/lib/hub/registrarForm'
import type { DayRead } from '@/lib/hub/diarioDb'
import OperacoesTabela from '@/components/hub/diario/OperacoesTabela'
import { renderHub } from '@/testing/hubHarness'
import { diaMercado } from '@/testing/diarioMercados'
import { agoraMercados, contasMercados } from '@/testing/registrarMercados'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const NBSP = ' '
const sem = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

type Conta = 'ftmo' | 'ibkr' | 'binance' | 'clear'
const AGORA: Record<Conta, Parameters<typeof agoraMercados>[0]> = {
  ftmo: 'ftmo-qui-0840',
  ibkr: 'ibkr-qui-0952',
  binance: 'binance-sab-2035',
  clear: 'clear-qui-1020',
}
const DIAS: Record<Conta, [string, string[]]> = {
  ftmo: ['2026-10-15', ['exit-eurusd', 'exit-usdjpy-corrigida', 'entry-eurgbp', 'after-xauusd']],
  ibkr: ['2026-10-15', ['after-spy-call', 'exit-aapl', 'exit-spy-vsv', 'entry-spy-call-aberta']],
  binance: ['2026-10-17', ['exit-btc']],
  clear: ['2026-10-15', ['after-clear-s9a', 'after-clear-s9b', 'after-bgix26', 'entry-win']],
}

function desenhar(c: Conta): { d: DayRead; user: ReturnType<typeof userEvent.setup> } {
  const [dia, gravacoes] = DIAS[c]
  const d = diaMercado(c, dia, gravacoes)
  const a = contasMercados().find((x) => x.id === d.account.id)!
  const rules = agoraMercados(AGORA[c]).accounts.find((x) => x.accountId === a.id)?.rules ?? null
  const cd = contaDiarioDe(a, rules)
  const conta = { market: cd.market, currency: cd.currency, tz: cd.tz, reg: contaReg(a, rules, null) }
  function Tabela() {
    const [aberta, setAberta] = React.useState<string | null>(null)
    return (
      <div className="hub" data-tema="escuro">
        <OperacoesTabela
          d={d}
          conta={conta}
          accountId={a.id}
          hoje={dia}
          aberta={aberta}
          aoAlternar={(tid) => setAberta((x) => (x === tid ? null : tid))}
          aoAcao={() => undefined}
          aoRegistrar={() => undefined}
          aoAbrirDia={() => undefined}
          aoPendente={() => undefined}
          guarda={null}
        />
      </div>
    )
  }
  renderHub(<Tabela />)
  return { d, user: userEvent.setup() }
}

/** [Hora, Operação, Resultado, Plano] of each row */
function linhas(): string[][] {
  const t = screen.getByRole('table', { name: 'Operações do dia' })
  return within(t)
    .getAllByRole('row')
    .filter((r) => r.querySelector(':scope > [role="cell"]'))
    .map((r) => {
      const c = Array.from(r.querySelectorAll(':scope > [role="cell"]'))
      const plano = c[3].querySelector('.hub-dr-plano-marca, [aria-hidden="true"]')
      return [c[0].textContent ?? '', c[1].querySelector(':scope > span')?.textContent ?? '', sem(c[2].textContent), sem(plano?.textContent)]
    })
}

async function fatos(user: ReturnType<typeof userEvent.setup>, rotulo: string): Promise<string[][]> {
  const botao = screen.getByRole('button', { name: rotulo })
  await user.click(botao)
  const drill = await screen.findByText('Sua operação')
  return Array.from(drill.closest('.hub-dr-drill-corpo')!.querySelectorAll('.hub-dr-drill-fato')).map((f) => [sem(f.querySelector('dt')?.textContent), sem(f.querySelector('dd')?.textContent)])
}

describe('FTMO (forex): lots, the corrected USD/JPY, the open EUR/GBP, XAUUSD at a price', () => {
  it('the rows, each lot with its no-break space; the open EUR/GBP asks for its exit', () => {
    desenhar('ftmo')
    expect(linhas()).toEqual([
      ['08:40–09:01', `EUR/USD · Compra · 0,50${NBSP}lote`, '+US$ 57,50', 'No plano'],
      ['08:40–09:01', `USD/JPY · Venda · 0,30${NBSP}lote`, '+US$ 48,00', 'No plano'],
      ['08:40', `EUR/GBP · Venda · 0,50${NBSP}lote`, 'aberta', 'No plano'],
      ['08:45–08:58', `XAUUSD · Venda · 0,20${NBSP}lote`, '+US$ 98,00', 'No plano'],
    ])
    expect(screen.getByRole('button', { name: 'Registrar saída: Venda de EUR/GBP às 08:40' })).toBeInTheDocument()
  })

  it('the drill: a stop in pips with its R, the commission; at a price («stop em …») on XAUUSD', async () => {
    const { user } = desenhar('ftmo')
    expect(await fatos(user, 'Detalhes da operação: Compra de EUR/USD às 08:40')).toEqual([
      ['Hora', '08:40–09:01'],
      ['Entrada → saída', '1,08520 → 1,08635 · +11,5 pips'],
      ['Stop · alvo', 'stop 12 · alvo 24 pips · às 08:40'],
      ['R', '+1 R · com stop de 12 pips'],
      ['Resultado', '+US$ 57,50'],
      ['Comissão', 'ainda não chegou: o resultado está bruto até o arquivo da corretora.'],
      ['Posso operar hoje?', 'Liberado'],
    ])
    await user.click(screen.getByRole('button', { name: 'Detalhes da operação: Compra de EUR/USD às 08:40' }))
    expect(await fatos(user, 'Detalhes da operação: Venda de XAUUSD às 08:45')).toEqual([
      ['Hora', '08:45–08:58'],
      ['Entrada → saída', '4.409,80 → 4.404,55 · +5,25 no preço'],
      ['Stop · alvo', 'stop em 4.413,30 · alvo em 4.400,30 · registrado depois'],
      ['R', '+1,5 R · com stop em 4.413,30'],
      ['Resultado', '+US$ 98,00 · bruto +US$ 105,00'],
      ['Comissão', 'US$ 7,00'],
      ['Posso operar hoje?', 'Liberado'],
    ])
  })
})

describe('IBKR (stocks): the option’s contract, shares, «Venceu sem valor», the plan «—» without a window', () => {
  it('the rows; the open option asks «Registrar saída: Compra de SPY Call 790 às 09:52»', () => {
    desenhar('ibkr')
    expect(linhas()).toEqual([
      ['09:35–09:48', `SPY Call 790 · vence 15 out · Compra · 2${NBSP}ct`, '+US$ 110,00', '—'],
      ['09:52–10:00', `AAPL · Compra · 100${NBSP}ações`, '+US$ 75,00', '—'],
      ['09:52–16:00', `SPY Call 790 · vence 15 out · Compra · 2${NBSP}ct`, '−US$ 370,00', '—'],
      ['09:52', `SPY Call 790 · vence 15 out · Compra · 2${NBSP}ct`, 'aberta', '—'],
    ])
    expect(screen.getAllByText('plano não avaliado')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Registrar saída: Compra de SPY Call 790 às 09:52' })).toBeInTheDocument()
  })

  it('the drill: the premium («stop do prêmio 1,10 · alvo do prêmio 3,20»), its R «com stop do prêmio em 1,10»; shares at a price', async () => {
    const { user } = desenhar('ibkr')
    const f = await fatos(user, 'Detalhes da operação: Compra de SPY Call 790 às 09:35')
    expect(f).toContainEqual(['Stop · alvo', 'stop do prêmio 1,10 · alvo do prêmio 3,20 · registrado depois'])
    expect(f).toContainEqual(['R', '+0,7 R · com stop do prêmio em 1,10'])
    expect(f).toContainEqual(['Entrada → saída', '1,85 → 2,40 · +0,55 no prêmio'])
    await user.click(screen.getByRole('button', { name: 'Detalhes da operação: Compra de SPY Call 790 às 09:35' }))
    const g = await fatos(user, 'Detalhes da operação: Compra de AAPL às 09:52')
    expect(g).toContainEqual(['Entrada → saída', '231,40 → 232,15 · +0,75 por ação'])
    expect(g).toContainEqual(['Stop · alvo', 'stop em 230,90 · alvo em 232,40 · às 09:52'])
  })
})

describe('Binance (crypto) on Brasília’s clock on a Saturday', () => {
  it('«BTC/USDT · Venda · 0,25 BTC», the stop at a price, no «Comissão» row', async () => {
    const { user } = desenhar('binance')
    expect(linhas()).toEqual([['20:35–21:02', `BTC/USDT · Venda · 0,25${NBSP}BTC`, '+US$ 101,26', 'No plano']])
    const f = await fatos(user, 'Detalhes da operação: Venda de BTC/USDT às 20:35')
    expect(f).toContainEqual(['Entrada → saída', '112.400,00 → 111.950,00 · +450 por BTC'])
    expect(f).toContainEqual(['Stop · alvo', 'stop em 112.800,00 · alvo em 111.600,00 · às 20:35'])
    expect(f.map((x) => x[0])).not.toContain('Comissão')
  })
})

describe('Clear (B3): R$ only, contracts, «2 un.», after the limit', () => {
  it('every amount in R$, «● depois do limite» after 10:16, the open WIN asks for its exit', () => {
    desenhar('clear')
    expect(linhas()).toEqual([
      ['10:01–10:05', `WIN · Compra · 3${NBSP}ct`, '−R$ 180,00', 'No plano'],
      ['10:07–10:11', `WIN · Venda · 5${NBSP}ct`, '−R$ 210,00', 'No plano'],
      ['10:17–10:19', `BGIX26 · Compra · 2${NBSP}un.`, '+R$ 146,50', '● depois do limite'],
      ['10:20', `WIN · Venda · 3${NBSP}ct`, 'aberta', '● depois do limite'],
    ])
    expect(screen.getByText('−R$ 180,00')).toHaveClass('hub-tom--red')
    expect(screen.queryByText(/US\$/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Registrar saída: Venda de WIN às 10:20' })).toBeInTheDocument()
  })

  it('the drill: points of the B3 future, «Encerrado por hoje» and its line', async () => {
    const { user } = desenhar('clear')
    const f = await fatos(user, 'Detalhes da operação: Compra de BGIX26 às 10:17')
    expect(f).toContainEqual(['Posso operar hoje?', 'Encerrado por hoje'])
    expect(screen.getByText('Na entrada, o “Posso operar hoje?” dizia “Encerrado por hoje” desde 10:16: as operações anteriores já estavam registradas.')).toBeInTheDocument()
  })
})
