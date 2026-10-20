/**
 * Ações e opções (3-4 lane B; scenario 7 of RegistrarOperacao.dc.html v57): «O que você operou?»,
 * the option block («Tipo», «Strike, US$», «Vencimento», «Outra data») and «Venceu sem valor», on
 * their own, with the models of the form engine (lib/hub/registrarForm) for the recorded IBKR
 * account at Thu 15 Oct 2026, 09:52 ET (testing/registrarMercados; invented data). The sheet that
 * places them is lane A's (RegistrarAcoes.test.tsx renders them in it).
 */
import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import fs from 'fs'
import path from 'path'
import BlocoOpcao from '@/components/hub/registrar/BlocoOpcao'
import OQueOperou from '@/components/hub/registrar/OQueOperou'
import VenceuSemValor from '@/components/hub/registrar/VenceuSemValor'
import { padroesDoRegistrar } from '@/lib/hub/registrar'
import {
  alternarVsv,
  contaReg,
  estadoVsv,
  modeloEntrada,
  mudarVencimento,
  rascunhoInicial,
  type ContaReg,
  type EstadoVsv,
  type Rascunho,
  type TipoEua,
} from '@/lib/hub/registrarForm'
import { agoraMercados, contasMercados, idsMercados } from '@/testing/registrarMercados'

const ids = idsMercados()
const KEY = '7d3f0a52-9c1e-4b8a-a6d2-0f1e2d3c4b5a'
const agora = agoraMercados('ibkr-qui-0952').accounts.find((a) => a.accountId === ids.accounts.ibkr)!
const ibkr: ContaReg = contaReg(contasMercados().find((c) => c.id === ids.accounts.ibkr)!, agora.rules, agora.desdeDay)
const binance: ContaReg = contaReg(contasMercados().find((c) => c.id === ids.accounts.binance)!, null, null)
/** Thu 15 Oct 2026, 09:52 ET */
const AGORA = new Date('2026-10-15T13:52:00Z')
const HOJE = '2026-10-15'

function rascunho(patch: Partial<Rascunho> = {}): Rascunho {
  return { ...rascunhoInicial(ibkr, padroesDoRegistrar('stocks', []), KEY), tipoEua: 'opcao', ativo: 'SPY', ...patch }
}

/**
 * The option block and «Venceu sem valor» on a draft, as the sheet wires them: the engine's model,
 * mudarVencimento for an expiry (it turns «Venceu sem valor» off), alternarVsv for the pill
 */
function Bloco({ inicial, tentou = false, now = AGORA, conta = ibkr }: { inicial: Rascunho; tentou?: boolean; now?: Date; conta?: ContaReg }) {
  const [r, setR] = useState(inicial)
  const m = modeloEntrada({ conta, r, now, hoje: HOJE, tentou, padroes: null })
  return (
    <div className="hub">
      <section className="hub-reg">
        <BlocoOpcao
          m={m.opcao!}
          aoMudar={(patch) => setR((x) => ('vencimento' in patch ? { ...mudarVencimento(x, patch.vencimento ?? null), ...patch } : { ...x, ...patch }))}
        />
        {m.vsv && <VenceuSemValor estado={m.vsv} aoAlternar={() => setR((x) => alternarVsv(x))} />}
        <output data-testid="rascunho">{JSON.stringify({ opTipo: r.opTipo, strike: r.strike, vencimento: r.vencimento, vsv: r.vsv, precoSaida: r.precoSaida })}</output>
      </section>
    </div>
  )
}
const estado = () => JSON.parse(screen.getByTestId('rascunho').textContent ?? '{}')

describe('«O que você operou?» (OQueOperou; RO l.335, 1146)', () => {
  function Pergunta({ inicial = 'acao' as TipoEua, aoMudar = jest.fn() }) {
    const [v, setV] = useState<TipoEua>(inicial)
    return (
      <div className="hub">
        <OQueOperou
          valor={v}
          aoMudar={(x) => {
            aoMudar(x)
            setV(x)
          }}
        />
      </div>
    )
  }

  it('two pills in a labelled group, «Ação ou ETF» pressed, «Opção» chosen by a tap', async () => {
    const aoMudar = jest.fn()
    render(<Pergunta aoMudar={aoMudar} />)

    const group = screen.getByRole('group', { name: 'O que você operou?' })
    const [acao, opcao] = within(group).getAllByRole('button')
    expect([acao.textContent, opcao.textContent]).toEqual(['Ação ou ETF', 'Opção'])
    expect(acao).toHaveAttribute('id', 'g-tipoEua-0')
    expect(acao).toHaveAttribute('aria-pressed', 'true')
    expect(opcao).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(opcao)
    expect(aoMudar).toHaveBeenLastCalledWith('opcao')
    expect(opcao).toHaveAttribute('aria-pressed', 'true')
    expect(acao).toHaveAttribute('aria-pressed', 'false')
  })

  it('works from the keyboard: Tab to a pill, Space or Enter to choose', async () => {
    const aoMudar = jest.fn()
    render(<Pergunta aoMudar={aoMudar} />)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Ação ou ETF' })).toHaveFocus()
    await userEvent.tab()
    await userEvent.keyboard(' ')
    expect(aoMudar).toHaveBeenLastCalledWith('opcao')
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Enter}')
    expect(aoMudar).toHaveBeenLastCalledWith('acao')
  })
})

describe('the option block (BlocoOpcao; RO l.345–356, 1051–1053, 1126–1127)', () => {
  it('«Tipo», «Strike, US$», «Vencimento» with «Hoje» and «Sexta, 16 out», and «Outra data» from the day, with the focus ids', () => {
    render(<Bloco inicial={rascunho()} />)

    const tipo = screen.getByRole('group', { name: 'Tipo' })
    expect(within(tipo).getAllByRole('button').map((b) => [b.id, b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['g-opTipo-0', 'Call', 'false'],
      ['g-opTipo-1', 'Put', 'false'],
    ])
    const strike = screen.getByLabelText('Strike, US$')
    expect(strike).toHaveAttribute('id', 'f-strike')
    expect(strike).toHaveAttribute('inputmode', 'decimal')
    expect(strike).toHaveAttribute('autocomplete', 'off')
    expect(strike).toHaveStyle({ maxWidth: '200px' })
    const venc = screen.getByRole('group', { name: 'Vencimento' })
    expect(within(venc).getAllByRole('button').map((b) => [b.id, b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['g-venc-0', 'Hoje', 'false'],
      ['g-venc-1', 'Sexta, 16 out', 'false'],
    ])
    const outra = screen.getByLabelText('Outra data')
    expect(outra).toHaveAttribute('id', 'f-venc')
    expect(outra).toHaveAttribute('type', 'date')
    expect(outra).toHaveAttribute('min', HOJE)
    expect(outra).toHaveValue('')
    expect(outra).toHaveClass('hub-reg-venc-data')
    // No error before «Registrar»
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('«Já fechada» on another day: the day as its date («14 out») and that week’s Friday; none on a Friday', () => {
    const { unmount } = render(<Bloco inicial={rascunho({ modo: 'fechada', dia: '2026-10-14' })} />)
    expect(within(screen.getByRole('group', { name: 'Vencimento' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['14 out', 'Sexta, 16 out'])
    expect(screen.getByLabelText('Outra data')).toHaveAttribute('min', '2026-10-14')
    unmount()

    render(<Bloco inicial={rascunho({ modo: 'fechada', dia: '2026-10-09' })} />)
    expect(within(screen.getByRole('group', { name: 'Vencimento' })).getAllByRole('button').map((b) => b.textContent)).toEqual(['9 out'])
  })

  it('a tap or a typed value goes to the draft: Call, the strike as typed, a chip’s date, another date', async () => {
    render(<Bloco inicial={rascunho()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Call' }))
    expect(screen.getByRole('button', { name: 'Call' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.type(screen.getByLabelText('Strike, US$'), '790')
    await userEvent.click(screen.getByRole('button', { name: 'Sexta, 16 out' }))
    expect(screen.getByRole('button', { name: 'Sexta, 16 out' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Outra data')).toHaveValue('2026-10-16')
    expect(estado()).toMatchObject({ opTipo: 'call', strike: '790', vencimento: '2026-10-16' })

    await userEvent.click(screen.getByRole('button', { name: 'Put' }))
    const outra = screen.getByLabelText('Outra data')
    await userEvent.clear(outra)
    await userEvent.type(outra, '2026-11-20')
    expect(estado()).toMatchObject({ opTipo: 'put', vencimento: '2026-11-20' })
    // A date of no chip: no chip pressed
    for (const b of within(screen.getByRole('group', { name: 'Vencimento' })).getAllByRole('button')) expect(b).toHaveAttribute('aria-pressed', 'false')
    // Emptied: no expiry
    await userEvent.clear(outra)
    expect(estado().vencimento).toBeNull()
  })

  it('after «Registrar», each missing answer: «Escolha Call ou Put.», «Informe o strike.», «Escolha o vencimento.» (alerts, described, invalid)', () => {
    render(<Bloco inicial={rascunho()} tentou />)

    const alertas = screen.getAllByRole('alert').map((a) => [a.id, a.textContent])
    expect(alertas).toEqual([
      ['e-opTipo', 'Escolha Call ou Put.'],
      ['e-strike', 'Informe o strike.'],
      ['e-venc', 'Escolha o vencimento.'],
    ])
    expect(screen.getByRole('group', { name: 'Tipo' })).toHaveAccessibleDescription('Escolha Call ou Put.')
    expect(screen.getByLabelText('Strike, US$')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Strike, US$')).toHaveAccessibleDescription('Informe o strike.')
    expect(screen.getByRole('group', { name: 'Vencimento' })).toHaveAccessibleDescription('Escolha o vencimento.')
    expect(screen.getByLabelText('Outra data')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Outra data')).toHaveAccessibleDescription('Escolha o vencimento.')
  })

  it.each([
    ['abc', 'Use só números, como 790.'],
    ['0', 'Use um strike maior que zero.'],
    ['790,1234', 'Use até 3 casas decimais.'],
  ])('the strike «%s»: «%s»', (strike, erro) => {
    render(<Bloco inicial={rascunho({ opTipo: 'call', strike, vencimento: HOJE })} tentou />)
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([erro])
    expect(screen.getByLabelText('Strike, US$')).toHaveAccessibleDescription(erro)
  })

  it('reads the strike with a point as the decimal mark (Ações e opções): «790.5» and «790,125» pass', () => {
    const { unmount } = render(<Bloco inicial={rascunho({ opTipo: 'call', strike: '790.5', vencimento: HOJE })} tentou />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    unmount()
    render(<Bloco inicial={rascunho({ opTipo: 'call', strike: '790,125', vencimento: HOJE })} tentou />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('an expiry before the day of the entry: «O vencimento não pode ser antes do dia da entrada.»', () => {
    render(<Bloco inicial={rascunho({ opTipo: 'call', strike: '790', vencimento: '2026-10-14' })} tentou />)
    expect(screen.getByRole('alert')).toHaveTextContent('O vencimento não pode ser antes do dia da entrada.')
    expect(screen.getByLabelText('Outra data')).toHaveValue('2026-10-14')
    expect(screen.getByRole('group', { name: 'Vencimento' })).toHaveAccessibleDescription('O vencimento não pode ser antes do dia da entrada.')
  })
})

describe('«Venceu sem valor» (VenceuSemValor; RO l.372, 968–973, board choice 21)', () => {
  const tela = (e: EstadoVsv, aoAlternar = jest.fn()) => {
    render(
      <div className="hub">
        <VenceuSemValor estado={e} aoAlternar={aoAlternar} />
      </div>,
    )
    return { pill: screen.getByRole('button', { name: 'Venceu sem valor' }), aoAlternar }
  }

  it('no expiry yet: aria-disabled (still focusable), «Escolha o vencimento primeiro.», a press does nothing', async () => {
    const { pill, aoAlternar } = tela(estadoVsv(ibkr, null, HOJE, HOJE, false, AGORA))
    expect(pill).toHaveAttribute('aria-disabled', 'true')
    expect(pill).not.toBeDisabled()
    expect(pill).toHaveAttribute('aria-pressed', 'false')
    expect(pill).toHaveAccessibleDescription('Escolha o vencimento primeiro.')
    await userEvent.click(pill)
    expect(aoAlternar).not.toHaveBeenCalled()
    pill.focus()
    expect(pill).toHaveFocus()
  })

  it('it expires today, before 16:00 ET: «Vence hoje às 16:00 ET.»', () => {
    const { pill } = tela(estadoVsv(ibkr, HOJE, HOJE, HOJE, false, AGORA))
    expect(pill).toHaveAttribute('aria-disabled', 'true')
    expect(pill).toHaveAccessibleDescription('Vence hoje às 16:00 ET.')
  })

  it('an expiry that is not the entry’s day: «Vence em 14 out, às 16:00 ET.»', () => {
    const { pill } = tela(estadoVsv(ibkr, '2026-10-14', HOJE, HOJE, false, AGORA))
    expect(pill).toHaveAttribute('aria-disabled', 'true')
    expect(pill).toHaveAccessibleDescription('Vence em 14 out, às 16:00 ET.')
  })

  it('available (the expiry is the day, its 16:00 ET passed): no note, a press toggles it', async () => {
    const e = estadoVsv(ibkr, '2026-10-14', '2026-10-14', HOJE, false, AGORA)
    expect(e).toEqual({ ligado: false, disponivel: true, nota: '', hora: '16:00' })
    const { pill, aoAlternar } = tela(e)
    expect(pill).not.toHaveAttribute('aria-disabled')
    expect(pill).not.toHaveAttribute('aria-describedby')
    expect(document.getElementById('n-vsv')).toBeNull()
    await userEvent.click(pill)
    expect(aoAlternar).toHaveBeenCalledTimes(1)
  })

  it('today after 16:00 ET is available too; on a Brasília clock its exit hour is 17:00 (October)', () => {
    expect(estadoVsv(ibkr, HOJE, HOJE, HOJE, true, new Date('2026-10-15T20:05:00Z'))).toEqual({ ligado: true, disponivel: true, nota: '', hora: '16:00' })
    expect(estadoVsv(binance, HOJE, HOJE, HOJE, false, new Date('2026-10-15T20:05:00Z')).hora).toBe('17:00')
  })

  it('in the block: «Ontem» and expiry 14 out → available and pressed by a tap; changing the expiry turns it off', async () => {
    render(<Bloco inicial={rascunho({ modo: 'fechada', dia: '2026-10-14', opTipo: 'call', strike: '790', vencimento: '2026-10-14' })} />)
    const pill = screen.getByRole('button', { name: 'Venceu sem valor' })
    expect(pill).not.toHaveAttribute('aria-disabled')
    expect(screen.getByRole('button', { name: '14 out' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(pill)
    expect(pill).toHaveAttribute('aria-pressed', 'true')
    expect(estado()).toMatchObject({ vsv: true })

    await userEvent.click(screen.getByRole('button', { name: 'Sexta, 16 out' }))
    expect(estado()).toMatchObject({ vsv: false, vencimento: '2026-10-16' })
    expect(screen.getByRole('button', { name: 'Venceu sem valor' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Venceu sem valor' })).toHaveAccessibleDescription('Vence em 16 out, às 16:00 ET.')
  })
})

describe('hub-registrar-opcao.css', () => {
  const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub-registrar-opcao.css'), 'utf8')
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const regras = Array.from((style.sheet as CSSStyleSheet).cssRules).filter((r): r is CSSStyleRule => 'selectorText' in r)
  style.remove()
  const regra = (sel: string) => regras.find((r) => r.selectorText === sel)!.style

  it('scopes every rule to .hub', () => {
    expect(regras.length).toBeGreaterThan(0)
    for (const r of regras) for (const s of r.selectorText.split(',')) expect(s.trim()).toMatch(/^\.hub[\s.[]/)
  })

  it('«Vencimento» wraps its pills and «Outra data»; «Outra data» is 180 px, never wider than the sheet', () => {
    expect(regra('.hub .hub-reg-venc').getPropertyValue('flex-wrap')).toBe('wrap')
    expect(regra('.hub .hub-reg-venc-data').getPropertyValue('width')).toBe('180px')
    expect(regra('.hub .hub-reg-venc-data').getPropertyValue('max-width')).toBe('100%')
    expect(regra('.hub .hub-reg-vsv').getPropertyValue('flex-wrap')).toBe('wrap')
  })

  it('is imported by the hub layout', () => {
    const layout = fs.readFileSync(path.join(__dirname, '../../../app/(hub)/layout.tsx'), 'utf8')
    expect(layout).toContain("import '@/styles/hub-registrar-opcao.css'")
  })
})
