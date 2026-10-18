import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegrasDaConta from '@/components/hub/importar/RegrasDaConta'
import type { RulesConfig } from '@/lib/hub/regras'
import { NAO_COPIAR, REGRAS_FORM_VAZIO, desdeDaNovaConta, regrasDaNovaConta, type RegrasForm } from '@/lib/hub/regrasConta'
import type { AccountMarket } from '@/lib/domain/markets'
import { configAntes, configDepois, configMercados } from '@/testing/regras'
import { brt, et } from '@/testing/gate'

/** « · » with a no-break space on each side (personalizar/copy.ts SEP): it never starts or ends a line */
const SEP = '\u00a0·\u00a0'

const NBSP = ' '

/** The sheet's side of the block: it holds the form and resolves it against the saved rules */
function Bloco({
  config,
  market = 'futures',
  now = et('2026-10-17 12:00'),
  label = 'Apex B',
  inicial = REGRAS_FORM_VAZIO,
  locked = false,
  onForm,
  limiteErroId = 'dica',
  outras = null,
}: {
  config: RulesConfig
  market?: AccountMarket
  now?: Date
  label?: string
  inicial?: RegrasForm
  locked?: boolean
  onForm?: (f: RegrasForm) => void
  /** null: the sheet's hint says something else first (no nickname or phase yet) */
  limiteErroId?: string | null
  outras?: string | null
}) {
  const [form, setForm] = useState(inicial)
  const r = regrasDaNovaConta(config, market, form)
  return (
    <div className="hub">
      <RegrasDaConta
        carga="pronto"
        regras={r}
        form={form}
        onForm={(f) => {
          setForm(f)
          onForm?.(f)
        }}
        label={label}
        now={now}
        desde={desdeDaNovaConta(config, r, now)}
        locked={locked}
        limiteErroId={limiteErroId ?? undefined}
        outras={outras}
      />
      <p id="dica">dica</p>
    </div>
  )
}

const linha = () => document.querySelector('.hub-rc-linha > span') as HTMLElement
const mudar = () => screen.getByRole('button', { name: 'Mudar' })

describe('RegrasDaConta · loading', () => {
  it('says the rules are loading, then that the account is created without them when they fail', () => {
    const props = { regras: null, form: REGRAS_FORM_VAZIO, onForm: jest.fn(), label: '', now: new Date(), desde: null }
    const { rerender } = render(<RegrasDaConta carga="carregando" {...props} />)
    expect(screen.getByText('Carregando…')).toHaveAttribute('id', 'regras-carga')
    // Not a second live region in the sheet
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<RegrasDaConta carga="erro" {...props} />)
    expect(
      screen.getByText('Não foi possível carregar as regras. A conta é criada sem regras; salve em Personalizar › Suas regras.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Copiar regras de')).not.toBeInTheDocument()
  })
})

describe('RegrasDaConta · «Copiar regras de»', () => {
  it('starts on the first account of the market, with its note, and «Não copiar» changes both', async () => {
    render(<Bloco config={configDepois()} />)
    const select = screen.getByLabelText('Copiar regras de') as HTMLSelectElement
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Top One #1', 'Não copiar'])
    expect(select).toHaveDisplayValue('Top One #1')
    expect(select).toHaveAccessibleDescription('Copia janela, limite do dia, bloqueio de dados e regra do estado.')
    expect(linha().textContent).toBe(`Janela 10:00–11:00 (Nova York)${SEP}padrão de Futuros${SEP}limite do dia: US$${NBSP}400 por conta`)

    await userEvent.selectOptions(select, 'Não copiar')

    expect(select).toHaveValue(NAO_COPIAR)
    expect(select).toHaveAccessibleDescription('Começa com o padrão do mercado.')
    expect(linha()).toHaveTextContent('Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: definir')
  })

  it('binaries copy the window and the limit; without an account of the market there is only the note', () => {
    const { unmount } = render(<Bloco config={configDepois()} market="binary" />)
    expect(screen.getByLabelText('Copiar regras de')).toHaveAccessibleDescription('Copia janela e limite do dia.')
    expect(linha()).toHaveTextContent('Janela 20:00–21:00 (Brasília) · padrão de Binárias · limite do dia: sem limite')
    unmount()

    const semBinarias = { ...configDepois(), accounts: configDepois().accounts.filter((a) => a.market !== 'binary') }
    render(<Bloco config={semBinarias} market="binary" />)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByText('Começa com o padrão do mercado.')).toHaveAttribute('id', 'nota-copiar')
  })
})

describe('RegrasDaConta · «Mudar»', () => {
  it('opens the editor: the market’s window («Sim») or an own one («Outra»), the limit and its mode', async () => {
    render(<Bloco config={configDepois()} />)
    expect(mudar()).toHaveAttribute('aria-expanded', 'false')
    expect(mudar()).toHaveAttribute('aria-controls', 'ed-regras')
    expect(document.getElementById('ed-regras')).toBeNull()

    await userEvent.click(mudar())

    expect(mudar()).toHaveAttribute('aria-expanded', 'true')
    const editor = document.getElementById('ed-regras') as HTMLElement
    const usar = within(editor).getByRole('group', { name: 'Usar a janela de Futuros (10:00–11:00 ET)?' })
    expect(within(usar).getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(editor).queryByLabelText(/^Início da janela/)).not.toBeInTheDocument()

    await userEvent.click(within(usar).getByRole('button', { name: 'Outra' }))

    const inicio = within(editor).getByLabelText('Início da janela só de Apex B, horário de Nova York')
    expect(inicio).toHaveValue('10:00')
    expect(within(editor).getByLabelText('Fim da janela só de Apex B, horário de Nova York')).toHaveValue('11:00')
    expect(inicio).toHaveAttribute('step', '900')
    // An account window is on the market's clock: the clock is text, not a choice
    expect(within(editor).queryByLabelText('Relógio da janela')).not.toBeInTheDocument()
    expect(within(editor).getByText('ET')).toBeInTheDocument()
    expect(inicio).toHaveAccessibleDescription(`11:00–12:00 em Brasília${SEP}seg–sex`)
    const dias = within(editor).getByRole('group', { name: 'Dias da janela' })
    expect(within(dias).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'segunda',
      'terça',
      'quarta',
      'quinta',
      'sexta',
      'sábado',
      'domingo',
    ])
    expect(linha().textContent).toBe(`Janela 10:00–11:00 (Nova York)${SEP}só nesta conta${SEP}limite do dia: US$${NBSP}400 por conta`)

    fireEvent.change(inicio, { target: { value: '09:30' } })
    expect(linha()).toHaveTextContent(/^Janela 09:30–11:00 \(Nova York\) · só nesta conta/)
    // An unparsable value is ignored
    fireEvent.change(inicio, { target: { value: '' } })
    expect(inicio).toHaveValue('09:30')

    const limite = within(editor).getByLabelText('Limite do dia, US$')
    expect(limite).toHaveValue('400')
    expect(limite).toHaveAttribute('inputmode', 'decimal')
    const modo = within(editor).getByRole('group', { name: 'Como o limite conta' })
    expect(within(modo).getByRole('button', { name: 'por conta' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(within(modo).getByRole('button', { name: 'somando as contas de Futuros' }))
    expect(linha().textContent).toMatch(new RegExp(`limite do dia: US\\$${NBSP}400 somando as contas de Futuros$`))
    // «Ao chegar no limite» is not in the form (Personalizar edits it)
    expect(screen.queryByText('Ao chegar no limite')).not.toBeInTheDocument()

    await userEvent.click(mudar())
    expect(document.getElementById('ed-regras')).toBeNull()
    // Closing keeps what was set
    expect(linha()).toHaveTextContent(/^Janela 09:30–11:00 \(Nova York\) · só nesta conta/)
  })

  it('shows Personalizar’s window errors, on the fields and on the days', async () => {
    render(<Bloco config={configDepois()} inicial={{ aberto: true, janela: 'propria' }} />)
    const inicio = screen.getByLabelText('Início da janela só de Apex B, horário de Nova York')
    fireEvent.change(screen.getByLabelText('Fim da janela só de Apex B, horário de Nova York'), { target: { value: '10:00' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Início e fim iguais: mude um dos dois.')
    expect(inicio).toHaveAttribute('aria-invalid', 'true')
    expect(inicio).toHaveAccessibleDescription('seg–sex Início e fim iguais: mude um dos dois.')
    expect(linha()).toHaveTextContent(/^Janela a definir \(Nova York\)/)

    fireEvent.change(inicio, { target: { value: '09:00' } })
    const dias = screen.getByRole('group', { name: 'Dias da janela' })
    for (const d of ['segunda', 'terça', 'quarta', 'quinta', 'sexta']) await userEvent.click(within(dias).getByRole('button', { name: d }))

    expect(screen.getByRole('alert')).toHaveTextContent('Marque pelo menos um dia.')
    expect(dias).toHaveAccessibleDescription('Marque pelo menos um dia.')
  })

  it('a limit that cannot be saved points to the creation button’s hint', async () => {
    render(<Bloco config={configDepois()} inicial={{ aberto: true }} />)
    const limite = screen.getByLabelText('Limite do dia, US$')
    await userEvent.clear(limite)
    await userEvent.type(limite, 'abc')
    expect(limite).toHaveAttribute('aria-invalid', 'true')
    expect(limite).toHaveAccessibleDescription('dica')
    await userEvent.clear(limite)
    // Empty is no limit, not an error
    expect(limite).not.toHaveAttribute('aria-invalid')
    expect(linha()).toHaveTextContent('limite do dia: definir')
  })

  it('a limit that cannot be saved while the hint asks for the nickname first: its error shows under the field', async () => {
    render(<Bloco config={configDepois()} inicial={{ aberto: true }} limiteErroId={null} />)
    const limite = screen.getByLabelText('Limite do dia, US$')
    expect(document.getElementById('f-lim-erro')).toBeNull()
    await userEvent.clear(limite)
    await userEvent.type(limite, 'abc')

    expect(screen.getByText('Use só números, como 400 ou 400,50.', { selector: '#f-lim-erro' })).toHaveClass('hub-erro')
    expect(limite).toHaveAccessibleDescription('Use só números, como 400 ou 400,50.')
    await userEvent.clear(limite)
    expect(document.getElementById('f-lim-erro')).toBeNull()
  })

  it('a limit that can be saved is described by nothing (never by the hint’s other errors)', () => {
    render(<Bloco config={configDepois()} inicial={{ aberto: true }} />)
    const limite = screen.getByLabelText('Limite do dia, US$')
    expect(limite).toHaveValue('400')
    expect(limite).not.toHaveAttribute('aria-describedby')
    expect(limite).toHaveAccessibleDescription('')
  })

  it('binaries have no mode: their limit is always per account', () => {
    render(<Bloco config={configDepois()} market="binary" inicial={{ aberto: true, limite: '50' }} />)
    expect(screen.getByLabelText('Limite do dia, US$')).toHaveValue('50')
    expect(screen.queryByRole('group', { name: 'Como o limite conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'somando as contas de Futuros' })).not.toBeInTheDocument()
  })

  it('names the market’s other accounts that get a version, until the account exists', () => {
    const text = 'Ao criar, esta janela passa a ser a de Futuros: Top One #1 também ganha versão nova das regras desde 19 out.'
    const { unmount } = render(<Bloco config={configAntes()} inicial={{ aberto: false, definir: true }} outras={text} />)
    expect(screen.getByText(text)).toHaveAttribute('id', 'rc-outras')
    unmount()
    render(<Bloco config={configAntes()} inicial={{ aberto: false, definir: true }} outras={text} locked />)
    expect(screen.queryByText(text)).not.toBeInTheDocument()
  })

  it('changing the source starts the window choice and the limit again', async () => {
    const forms: RegrasForm[] = []
    render(<Bloco config={configDepois()} inicial={{ aberto: true }} onForm={(f) => forms.push(f)} />)
    await userEvent.click(screen.getByRole('button', { name: 'Outra' }))
    await userEvent.clear(screen.getByLabelText('Limite do dia, US$'))
    await userEvent.type(screen.getByLabelText('Limite do dia, US$'), '900')

    await userEvent.selectOptions(screen.getByLabelText('Copiar regras de'), 'Não copiar')

    expect(forms[forms.length - 1]).toEqual({ aberto: true, copiar: NAO_COPIAR })
    expect(screen.getByRole('button', { name: 'Sim' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Limite do dia, US$')).toHaveValue('')
  })

  it('without a market window: no question; «+ Definir janela» gives the market its window, «Cancelar esta janela» takes it back', async () => {
    render(<Bloco config={configAntes()} inicial={{ aberto: true, copiar: NAO_COPIAR }} />)
    expect(linha()).toHaveTextContent('Janela: sem janela · limite do dia: definir')
    expect(screen.queryByRole('group', { name: /^Usar a janela/ })).not.toBeInTheDocument()
    // One futures account already: the mode can sum them
    expect(screen.getByRole('group', { name: 'Como o limite conta' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Definir janela' }))

    const inicio = screen.getByLabelText('Início da janela de Futuros, horário de Nova York')
    await waitFor(() => expect(inicio).toHaveFocus())
    expect(inicio).toHaveValue('10:00')
    expect(linha()).toHaveTextContent('Janela 10:00–11:00 (Nova York) · padrão de Futuros · limite do dia: definir')
    // The market's first window: its clock can be chosen
    const relogio = screen.getByLabelText('Relógio da janela')
    expect(within(relogio).getAllByRole('option').map((o) => o.textContent)).toEqual(['Nova York (ET)', 'Brasília'])
    await userEvent.selectOptions(relogio, 'Brasília')
    expect(screen.getByLabelText('Início da janela de Futuros, horário de Brasília')).toHaveValue('10:00')
    expect(linha()).toHaveTextContent(/^Janela 10:00–11:00 \(Brasília\) · padrão de Futuros/)

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar a janela nova de Futuros' }))

    expect(linha()).toHaveTextContent('Janela: sem janela · limite do dia: definir')
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Definir janela' })).toHaveFocus())
  })

  it('writes «do dia seguinte» for a window that ends the next day', () => {
    render(<Bloco config={configDepois()} market="binary" inicial={{ aberto: true, janela: 'propria', propria: { tz: 'America/Sao_Paulo', startMin: 1320, endMin: 120, weekdays: 31 } }} />)
    expect(screen.getByText('do dia seguinte')).toBeInTheDocument()
    expect(linha()).toHaveTextContent('Janela 22:00 → 02:00 do dia seguinte (Brasília) · só nesta conta · limite do dia: sem limite')
  })
})

describe('RegrasDaConta · «Regras valem desde hoje»', () => {
  it('names the day v1 will get, with its info', async () => {
    render(<Bloco config={configDepois()} now={et('2026-10-19 12:00')} />)
    expect(screen.getByText('Regras valem desde hoje, 19 out')).toHaveClass('hub-chip-dado')
    const info = screen.getByRole('button', { name: 'Como ler: Regras valem desde hoje' })
    await userEvent.click(info)
    expect(info).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('info-desde')).toHaveTextContent(
      'As comparações desta conta contam a partir desta data. Mudou uma regra? A versão anterior continua valendo para o passado.',
    )
  })

  it('futures after 18:00 ET: the next day; binaries inside an overnight window: the day it opened', () => {
    const { unmount } = render(<Bloco config={configDepois()} now={et('2026-10-19 18:05')} />)
    expect(screen.getByText('Regras valem desde hoje, 20 out')).toBeInTheDocument()
    unmount()
    render(
      <Bloco
        config={configDepois()}
        market="binary"
        now={brt('2026-10-20 01:00')}
        inicial={{ aberto: false, janela: 'propria', propria: { tz: 'America/Sao_Paulo', startMin: 1320, endMin: 120, weekdays: 127 } }}
      />,
    )
    expect(screen.getByText('Regras valem desde hoje, 19 out')).toBeInTheDocument()
  })
})

describe('RegrasDaConta · an account already created', () => {
  it('cannot change: the select is disabled and there is no «Mudar»', () => {
    render(<Bloco config={configDepois()} inicial={{ aberto: true }} locked />)
    expect(screen.getByLabelText('Copiar regras de')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Mudar' })).not.toBeInTheDocument()
    expect(document.getElementById('ed-regras')).toBeNull()
  })
})

// Fase 2b: the limit in the market's money and the crypto days (board ImportarConta scenarios 12 and 14)
describe('RegrasDaConta · the Fase 2b markets', () => {
  it('B3: «Limite do dia, R$», the summary in R$ and the errors in R$', async () => {
    render(<Bloco config={configAntes()} market="b3" inicial={{ aberto: true }} limiteErroId={null} />)
    const limite = screen.getByLabelText('Limite do dia, R$')
    expect(screen.queryByLabelText('Limite do dia, US$')).not.toBeInTheDocument()
    await userEvent.type(limite, '400')
    expect(linha().textContent).toBe(`Janela: sem janela${SEP}limite do dia: R$${NBSP}400`)

    await userEvent.clear(limite)
    await userEvent.type(limite, '2.000.000')
    expect(limite).toHaveAccessibleDescription(`Use um valor até R$${NBSP}1.000.000.`)
    expect(screen.getByText('Use um valor até R$ 1.000.000.', { selector: '#f-lim-erro' })).toBeInTheDocument()
    await userEvent.clear(limite)
    await userEvent.type(limite, '0')
    expect(limite).toHaveAccessibleDescription('Digite um valor maior que zero.')
  })

  it('the other currency’s symbol is an error under the field: «US$ 400» on B3, «R$ 400» on Forex', async () => {
    for (const [market, rotulo, outro, proprio] of [
      ['b3', 'Limite do dia, R$', 'US$ 400', 'R$ 400'],
      ['forex', 'Limite do dia, US$', 'R$ 400', 'US$ 400'],
    ] as const) {
      const { unmount } = render(<Bloco config={configAntes()} market={market} inicial={{ aberto: true }} limiteErroId={null} />)
      const limite = screen.getByLabelText(rotulo)
      await userEvent.type(limite, outro)
      expect(limite).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText('Use só números, como 400 ou 400,50.', { selector: '#f-lim-erro' })).toHaveClass('hub-erro')
      expect(limite).toHaveAccessibleDescription('Use só números, como 400 ou 400,50.')
      await userEvent.clear(limite)
      await userEvent.type(limite, proprio)
      expect(limite).not.toHaveAttribute('aria-invalid')
      expect(document.getElementById('f-lim-erro')).toBeNull()
      await userEvent.clear(limite)
      await userEvent.type(limite, '400')
      expect(document.getElementById('f-lim-erro')).toBeNull()
      unmount()
    }
  })

  it('the dollar markets keep «Limite do dia, US$» and say US$ in their errors', async () => {
    for (const market of ['forex', 'stocks', 'crypto'] as const) {
      const { unmount } = render(<Bloco config={configAntes()} market={market} inicial={{ aberto: true }} limiteErroId={null} />)
      await userEvent.type(screen.getByLabelText('Limite do dia, US$'), '1.000.001')
      expect(screen.getByLabelText('Limite do dia, US$')).toHaveAccessibleDescription(`Use um valor até US$${NBSP}1.000.000.`)
      unmount()
    }
  })

  it('no mode and no block or state rows outside Futuros, even with another account of the market', () => {
    for (const market of ['forex', 'stocks', 'crypto', 'b3'] as const) {
      const { unmount } = render(<Bloco config={configMercados()} market={market} inicial={{ aberto: true }} />)
      expect(screen.queryByRole('group', { name: 'Como o limite conta' })).not.toBeInTheDocument()
      expect(screen.queryByText(/bloqueio de dados|regra do estado/)).not.toBeInTheDocument()
      unmount()
    }
  })

  it('crypto: «+ Definir janela» marks every day and says so under the days', async () => {
    render(<Bloco config={configAntes()} market="crypto" inicial={{ aberto: true }} />)
    expect(screen.queryByText('Cripto abre todos os dias: sábado e domingo já vêm marcados.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Definir janela' }))

    const dias = screen.getByRole('group', { name: 'Dias da janela' })
    expect(within(dias).getAllByRole('button').map((b) => [b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual([
      ['segunda', 'true'],
      ['terça', 'true'],
      ['quarta', 'true'],
      ['quinta', 'true'],
      ['sexta', 'true'],
      ['sábado', 'true'],
      ['domingo', 'true'],
    ])
    expect(screen.getByText('Cripto abre todos os dias: sábado e domingo já vêm marcados.')).toHaveAttribute('id', 'j-dias-nota')
    expect(dias).toHaveAccessibleDescription('Cripto abre todos os dias: sábado e domingo já vêm marcados.')
    // With no day left the error describes the days too
    for (const d of within(dias).getAllByRole('button')) await userEvent.click(d)
    expect(dias).toHaveAttribute('aria-describedby', 'j-dias-nota j-erro')

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar a janela nova de Cripto' }))
    expect(screen.queryByText('Cripto abre todos os dias: sábado e domingo já vêm marcados.')).not.toBeInTheDocument()
  })

  it('a second crypto account: the question and its own window, with no days note (it is no suggested window)', async () => {
    // config-mercados: Binance already gave Cripto its window (20:00–22:00 de Brasília, every day)
    render(<Bloco config={configMercados()} market="crypto" label="Bybit" inicial={{ aberto: true, copiar: NAO_COPIAR }} />)
    const nota = 'Cripto abre todos os dias: sábado e domingo já vêm marcados.'
    const pergunta = screen.getByRole('group', { name: /^Usar a janela de Cripto/ })
    expect(screen.queryByText(nota)).not.toBeInTheDocument()

    await userEvent.click(within(pergunta).getByRole('button', { name: 'Outra' }))

    // The account's own window is open to edit, every day still marked, and nothing says why
    const dias = screen.getByRole('group', { name: 'Dias da janela' })
    expect(within(dias).getAllByRole('button').every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)
    expect(screen.getByLabelText(/^Início da janela só de Bybit/)).toBeInTheDocument()
    expect(screen.queryByText(nota)).not.toBeInTheDocument()
    expect(document.getElementById('j-dias-nota')).toBeNull()
    expect(dias).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('button', { name: '+ Definir janela' })).not.toBeInTheDocument()
  })

  it('the other markets’ suggested windows have no days note', async () => {
    for (const market of ['forex', 'stocks', 'b3'] as const) {
      const { unmount } = render(<Bloco config={configAntes()} market={market} inicial={{ aberto: true }} />)
      await userEvent.click(screen.getByRole('button', { name: '+ Definir janela' }))
      expect(screen.getByRole('group', { name: 'Dias da janela' })).not.toHaveAttribute('aria-describedby')
      expect(document.getElementById('j-dias-nota')).toBeNull()
      unmount()
    }
  })
})
