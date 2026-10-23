/**
 * Phase 3b · telas, lane L1: «mapa» (PassoMapa) alone, in a host that keeps the Mapeamento in useState as the sheet does
 * (no sheet, no database), on the board's files (testing/mapeadoTelas): «Mudar» and the separator's note with the live
 * region's text, a column changed and its check, the mode switch keeping each kind's edits, the question pills by keyboard,
 * the tab order of contract §5.7 and the execution variant.
 */
import React, { useRef, useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountMarket } from '@/lib/domain/markets'
import { bloqueioDoMapa, iniciarMapeamento, nomePadraoDoModelo, type ArquivoMapeavel, type Mapeamento } from '@/lib/hub/importMapeado'
import PassoMapa from '@/components/hub/importar/PassoMapa'
import { ARQUIVOS_QUADRO, CONTAS_QUADRO, CONTA_DO_ARQUIVO, type ArquivoQuadroKey } from '@/testing/mapeadoTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))

const conta = (k: ArquivoQuadroKey) => CONTAS_QUADRO[CONTA_DO_ARQUIVO[k]]
const arquivo = (k: ArquivoQuadroKey): ArquivoMapeavel => ({
  fileName: ARQUIVOS_QUADRO[k].nome,
  size: ARQUIVOS_QUADRO[k].texto.length,
  sha256: 'ab'.repeat(32),
  text: ARQUIVOS_QUADRO[k].texto,
})
function mapear(k: ArquivoQuadroKey): Mapeamento {
  const r = iniciarMapeamento(arquivo(k), { market: conta(k).market, templates: [], nomePadrao: nomePadraoDoModelo(conta(k).platform) })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}

/** The sheet's part: the state, the footer's hint (bloqueioDoMapa) and a stand-in «Continuar» after the step */
function Host({ k, onAnuncio, onMapa }: { k: ArquivoQuadroKey; onAnuncio: (t: string) => void; onMapa?: (m: Mapeamento) => void }) {
  const market: AccountMarket = conta(k).market
  const [m, setM] = useState(() => mapear(k))
  const ref = useRef<HTMLHeadingElement>(null)
  const dica = bloqueioDoMapa(m, market)
  return (
    <div className="hub" data-tema="claro">
      <PassoMapa
        headingRef={ref}
        arquivo={arquivo(k)}
        mapeamento={m}
        market={market}
        onChange={(n) => {
          setM(n)
          onMapa?.(n)
        }}
        onAnuncio={onAnuncio}
      />
      <button type="button" aria-disabled={dica ? true : undefined} aria-describedby={dica ? 'dica-pri' : undefined}>
        Continuar
      </button>
      {dica && <p id="dica-pri">{dica}</p>}
    </div>
  )
}

const montar = (k: ArquivoQuadroKey) => {
  const onAnuncio = jest.fn()
  const onMapa = jest.fn()
  const user = userEvent.setup()
  render(<Host k={k} onAnuncio={onAnuncio} onMapa={onMapa} />)
  return { onAnuncio, onMapa, user }
}

/** The row of a column (name and select) */
const linhaDa = (nome: string) => screen.getByRole('combobox', { name: `O que é a coluna ${nome}` }).closest('.hub-col-linha') as HTMLElement

describe('«mapa» · 8 (BlackArrow)', () => {
  it('the title takes the heading ref; the chips; «Mudar» opens the panel and keeps the focus', async () => {
    const { user } = montar('f8')
    expect(screen.getByRole('heading', { level: 3, name: 'Não reconhecemos este arquivo. Diga o que é cada coluna.' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByText('Separador: ponto e vírgula · decimal vírgula')).toHaveClass('hub-chip-dado')
    expect(screen.getByText('Datas: dia/mês')).toHaveClass('hub-chip-dado')
    const mudar = screen.getByRole('button', { name: 'Mudar' })
    expect(mudar).toHaveAttribute('aria-expanded', 'false')
    expect(mudar).toHaveAttribute('aria-controls', 'ler-arquivo')
    expect(document.getElementById('ler-arquivo')).toBeNull()
    await user.click(mudar)
    expect(mudar).toHaveAttribute('aria-expanded', 'true')
    expect(mudar).toHaveFocus()
    const painel = document.getElementById('ler-arquivo') as HTMLElement
    expect(within(painel).getByRole('group', { name: 'Separador' })).toBeInTheDocument()
    expect(within(painel).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-label'), b.getAttribute('aria-pressed')])).toEqual([
      [';', 'Ponto e vírgula', 'true'],
      [',', 'Vírgula', 'false'],
      ['Tab', 'Tabulação', 'false'],
      ['vírgula', null, 'true'],
      ['ponto', null, 'false'],
      ['dia/mês', null, 'true'],
      ['mês/dia', null, 'false'],
    ])
    expect(within(painel).getByRole('group', { name: 'Decimal' })).toBeInTheDocument()
    expect(within(painel).getByRole('group', { name: 'Datas' })).toBeInTheDocument()
    expect(screen.getByText('Continuar')).not.toHaveAttribute('aria-disabled')
  })

  it('«,»: the note under the chips, the hint, the live region’s text; the focus stays on the pill', async () => {
    const { user, onAnuncio } = montar('f8')
    await user.click(screen.getByRole('button', { name: 'Mudar' }))
    const virgula = screen.getByRole('button', { name: 'Vírgula' })
    await user.click(virgula)
    expect(virgula).toHaveAttribute('aria-pressed', 'true')
    expect(virgula).toHaveFocus()
    const nota = 'Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.'
    expect(screen.getByText(nota)).toHaveClass('hub-nota')
    expect(onAnuncio).toHaveBeenLastCalledWith(nota)
    expect(screen.getByText('Confira como ler o arquivo.')).toHaveAttribute('id', 'dica-pri')
    expect(screen.getByText('Separador: vírgula · decimal vírgula')).toBeInTheDocument()
    // The columns are the file's (never a data row as names)
    expect(screen.getByRole('combobox', { name: 'O que é a coluna Data/Hora' })).toBeInTheDocument()
    // Back to «;»: clean; the live region empties
    await user.click(screen.getByRole('button', { name: 'Ponto e vírgula' }))
    expect(screen.queryByText(nota)).toBeNull()
    expect(onAnuncio).toHaveBeenLastCalledWith('')
    expect(screen.queryByText('Confira como ler o arquivo.')).toBeNull()
  })

  it('every column «sugerida», its sample; Papel → «Quantidade»: the check, the duplicate block, «Ativo · falta», «sugerida» gone', async () => {
    const { user, onAnuncio } = montar('f8')
    const papel = linhaDa('Papel')
    expect(within(papel).getByText('sugerida')).toHaveClass('hub-tag', 'hub-tag--padrao')
    expect(within(papel).getByText('ex.: MESZ6')).toBeInTheDocument()
    expect(screen.getAllByText('sugerida')).toHaveLength(9)
    const select = screen.getByRole('combobox', { name: 'O que é a coluna Papel' })
    expect(select).toHaveAttribute('aria-invalid', 'false')
    expect(select).not.toHaveAttribute('aria-describedby')
    await user.selectOptions(select, 'Quantidade')
    expect(select).toHaveValue('quantity')
    expect(select).toHaveAttribute('aria-invalid', 'true')
    expect(select).toHaveAttribute('aria-describedby', 'chk-1')
    expect(document.getElementById('chk-1')).toHaveTextContent('Esta coluna não parece número.')
    expect(document.getElementById('chk-1')).toHaveClass('hub-chk')
    expect(within(linhaDa('Papel')).queryByText('sugerida')).toBeNull()
    expect(within(linhaDa('Qtd')).getByText('sugerida')).toBeInTheDocument()
    expect(screen.getByText('Quantidade está em mais de uma coluna.')).toHaveClass('hub-bloco', 'hub-bloco--atencao')
    expect(screen.getByText('Ativo · falta')).toHaveClass('hub-req')
    expect(screen.getByText('Ativo · falta')).not.toHaveClass('hub-req--ok')
    expect(screen.getByText('Entrada ✓')).toHaveClass('hub-req', 'hub-req--ok')
    expect(screen.getByText('Marque as colunas obrigatórias.')).toBeInTheDocument()
    expect(onAnuncio).toHaveBeenLastCalledWith('Quantidade está em mais de uma coluna.')
    expect(select).toHaveFocus()
  })

  it('the mode switch and back keeps each kind’s edits', async () => {
    const { user } = montar('f8')
    await user.selectOptions(screen.getByRole('combobox', { name: 'O que é a coluna Nº Negócio' }), 'Ignorar esta coluna')
    await user.click(screen.getByRole('button', { name: 'uma execução (compra ou venda)' }))
    expect(screen.getByRole('button', { name: 'uma execução (compra ou venda)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox', { name: 'O que é a coluna Nº Negócio' })).toHaveValue('fill_id')
    expect(screen.getByRole('combobox', { name: 'O que é a coluna Pr. Entrada' })).toHaveValue('')
    expect(screen.getByText('Preço · falta')).toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'O que é a coluna Pr. Entrada' }), 'Preço')
    await user.click(screen.getByRole('button', { name: 'uma operação (entrada e saída)' }))
    expect(screen.getByRole('combobox', { name: 'O que é a coluna Nº Negócio' })).toHaveValue('ignorar')
    expect(screen.getByRole('combobox', { name: 'O que é a coluna Pr. Entrada' })).toHaveValue('entry_price')
    await user.click(screen.getByRole('button', { name: 'uma execução (compra ou venda)' }))
    expect(screen.getByRole('combobox', { name: 'O que é a coluna Pr. Entrada' })).toHaveValue('price')
  })
})

describe('«mapa» · 8 · Performance.csv and 16 · Tradovate', () => {
  it('buyFillId → «ID da operação»: «Esta coluna repete valores: …», the hint', async () => {
    const { user } = montar('f8p')
    expect(within(linhaDa('buyFillId')).getByText('sugerida')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'O que é a coluna buyFillId' })).toHaveValue('ignorar')
    await user.selectOptions(screen.getByRole('combobox', { name: 'O que é a coluna buyFillId' }), 'ID da operação (evita duplicar)')
    expect(screen.getByText('Esta coluna repete valores: não serve de ID.')).toBeInTheDocument()
    expect(screen.getByText('Confira as colunas marcadas.')).toBeInTheDocument()
    expect(screen.queryByText('Sem coluna de ID, reconhecemos a reimportação pela mesma hora e preço.')).toBeNull()
  })

  it('the execution variant: «uma execução» pressed, its chips and notes, «Ignorar esta coluna» on the twins', () => {
    montar('f16t')
    expect(screen.getByRole('button', { name: 'uma execução (compra ou venda)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Cada linha do arquivo é' })).toBeInTheDocument()
    expect(screen.getAllByText(/✓$/).map((e) => e.textContent)).toEqual(['Data e hora ✓', 'Ativo ✓', 'Lado ✓', 'Quantidade ✓', 'Preço ✓'])
    expect(screen.getByText(/^Juntamos as compras e vendas de cada ativo em operações/)).toHaveClass('hub-nota')
    for (const nome of ['avgPrice', 'filledQty', 'Status', 'Timestamp', 'Quantity', 'Limit Price']) {
      expect(screen.getByRole('combobox', { name: `O que é a coluna ${nome}` })).toHaveValue('ignorar')
    }
    expect(within(linhaDa('Timestamp')).getByText('ex.: 10/13/2026 10:31:04')).toBeInTheDocument()
    expect(within(linhaDa('Limit Price')).getByText('ex.: 6816.00')).toBeInTheDocument()
    expect(within(screen.getByRole('combobox', { name: 'O que é a coluna orderId' })).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Escolha…',
      'Data e hora',
      'Ativo',
      'Lado',
      'Quantidade',
      'Preço',
      'Comissão',
      'Outra taxa (soma na comissão)',
      'ID da execução (evita duplicar)',
      'ID da ordem',
      'Abre ou fecha',
      'Resultado realizado',
      'Conta',
      'Ignorar esta coluna',
    ])
  })
})

describe('«mapa» · the questions', () => {
  it('18 · «Datas ambíguas»: the date question by keyboard (Tab, Space); the chip appears, the hint goes', async () => {
    const { user, onMapa } = montar('f18a')
    const grupo = screen.getByRole('group', { name: 'As datas podem ser dia/mês ou mês/dia. Qual é?' })
    expect(grupo.closest('.hub-bloco')).toHaveClass('hub-bloco--atencao', 'hub-pergunta')
    expect(screen.getByText('Escolha a ordem das datas.')).toBeInTheDocument()
    expect(screen.queryByText(/^Datas: /)).toBeNull()
    // Mudar → the question's first pill
    await user.tab()
    expect(screen.getByRole('button', { name: 'Mudar' })).toHaveFocus()
    await user.tab()
    const dm = within(grupo).getByRole('button', { name: 'dia/mês (09.10 = 9 out)' })
    expect(dm).toHaveFocus()
    await user.keyboard(' ')
    expect(dm).toHaveAttribute('aria-pressed', 'true')
    expect(dm).toHaveFocus()
    expect(screen.getByText('Datas: dia/mês')).toBeInTheDocument()
    expect(screen.queryByText('Escolha a ordem das datas.')).toBeNull()
    expect(onMapa).toHaveBeenLastCalledWith(expect.objectContaining({ dateOrder: 'dmy', resultIsNet: false }))
  })

  it('19 · the «X» question by keyboard; «Venda» answers it', async () => {
    const { user } = montar('f19')
    const grupo = screen.getByRole('group', { name: '2 linhas trazem “X” na coluna de lado. O que quer dizer?' })
    expect(screen.getByText('Diga o que quer dizer “X”.')).toBeInTheDocument()
    within(grupo).getByRole('button', { name: 'Compra' }).focus()
    await user.tab()
    expect(within(grupo).getByRole('button', { name: 'Venda' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(within(grupo).getByRole('button', { name: 'Venda' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Diga o que quer dizer “X”.')).toBeNull()
  })

  it('19 · «Só preços»: «ponto é decimal» → the tick nota (and the live region), the hint', async () => {
    const { user, onAnuncio } = montar('f19p')
    const grupo = screen.getByRole('group', { name: 'Como ler os números deste arquivo?' })
    expect(within(grupo).getByRole('button', { name: '“131.250” é 131250 (ponto separa milhar)' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(grupo).getByRole('button', { name: '“131.250” é 131,25 (ponto é decimal)' }))
    const nota = 'Com este decimal, o WIN fica fora do passo (de 5 em 5). Confira.'
    expect(within(grupo.closest('.hub-bloco') as HTMLElement).getByText(nota)).toHaveClass('hub-nota')
    expect(onAnuncio).toHaveBeenLastCalledWith(nota)
    expect(screen.getByText('Confira como ler o arquivo.')).toBeInTheDocument()
  })

  it('the tab order (§5.7): «Mudar», the panel, the questions, the row kind, each select, the side word, the footer', async () => {
    const { user } = montar('f19p')
    await user.click(screen.getByRole('button', { name: 'Mudar' }))
    const ordem: string[] = []
    for (let i = 0; i < 25; i++) {
      await user.tab()
      const el = document.activeElement as HTMLElement
      ordem.push(el.getAttribute('aria-label') ?? el.textContent ?? '')
      if (el.textContent === 'Continuar') break
    }
    expect(ordem).toEqual([
      'Ponto e vírgula',
      'Vírgula',
      'Tabulação',
      'dia/mês',
      'mês/dia',
      '“131.250” é 131250 (ponto separa milhar)',
      '“131.250” é 131,25 (ponto é decimal)',
      'uma operação (entrada e saída)',
      'uma execução (compra ou venda)',
      'O que é a coluna Data/Hora',
      'O que é a coluna Papel',
      'O que é a coluna C/V',
      'O que é a coluna Qtd',
      'O que é a coluna Pr. Entrada',
      'O que é a coluna Pr. Saída',
      'O que é a coluna Nº Negócio',
      'Compra',
      'Venda',
      'Pular essas linhas',
      'Continuar',
    ])
  })
})
