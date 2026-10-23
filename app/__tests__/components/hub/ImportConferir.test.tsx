/**
 * Phase 3b · telas, lane L1: «conferir» (PassoConferir) alone, in a host that keeps the Mapeamento in useState as the
 * sheet does (no sheet, no database), on the board's files (testing/mapeadoTelas): the rows as a list with hidden
 * separators, the net pills, «Salvar como modelo» and «Nome do modelo», the end-of-file answers changing the pairing
 * summary (a status) and the live region, «Ver as N operações», «Atualizar o modelo “…”», the mapping that cannot make
 * the file, the model chip in place of the model block, the per-account questions and the tab order of contract §5.7.
 */
import React, { useRef, useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { endOfFileKey, type Template } from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'
import {
  bloqueioDoConferir,
  iniciarMapeamento,
  modeloASalvar,
  nomePadraoDoModelo,
  type ArquivoMapeavel,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import PassoConferir from '@/components/hub/importar/PassoConferir'
import { ARQUIVOS_QUADRO, CONTAS_QUADRO, CONTA_DO_ARQUIVO, modeloBlackArrow, modeloTradovate, type ArquivoQuadroKey } from '@/testing/mapeadoTelas'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))

const conta = (k: ArquivoQuadroKey) => CONTAS_QUADRO[CONTA_DO_ARQUIVO[k]]
const arquivo = (k: ArquivoQuadroKey): ArquivoMapeavel => ({
  fileName: ARQUIVOS_QUADRO[k].nome,
  size: ARQUIVOS_QUADRO[k].texto.length,
  sha256: 'ab'.repeat(32),
  text: ARQUIVOS_QUADRO[k].texto,
})
function mapear(k: ArquivoQuadroKey, templates: readonly Template[] = []): Mapeamento {
  const r = iniciarMapeamento(arquivo(k), { market: conta(k).market, templates, nomePadrao: nomePadraoDoModelo(conta(k).platform) })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}

/** The sheet's part: the state, the footer «Usar estas colunas» with its hint (bloqueioDoConferir) */
function Host({
  inicial,
  market,
  onAnuncio,
  onMapa,
  onMudarColunas = null,
}: {
  inicial: Mapeamento
  market: AccountMarket
  onAnuncio: (t: string) => void
  onMapa: (m: Mapeamento) => void
  onMudarColunas?: (() => void) | null
}) {
  const [m, setM] = useState(inicial)
  const ref = useRef<HTMLHeadingElement>(null)
  const dica = bloqueioDoConferir(m, market)
  return (
    <div className="hub" data-tema="claro">
      <PassoConferir
        headingRef={ref}
        mapeamento={m}
        market={market}
        onChange={(n) => {
          setM(n)
          onMapa(n)
        }}
        onAnuncio={onAnuncio}
        onMudarColunas={onMudarColunas}
      />
      <button type="button" aria-disabled={dica ? true : undefined}>
        Usar estas colunas
      </button>
      {dica && <p id="dica-pri">{dica}</p>}
    </div>
  )
}

function montar(inicial: Mapeamento, market: AccountMarket, onMudarColunas: (() => void) | null = null) {
  const onAnuncio = jest.fn()
  const onMapa = jest.fn()
  const user = userEvent.setup()
  render(<Host inicial={inicial} market={market} onAnuncio={onAnuncio} onMapa={onMapa} onMudarColunas={onMudarColunas} />)
  return { onAnuncio, onMapa, user, ultimo: () => onMapa.mock.calls[onMapa.mock.calls.length - 1][0] as Mapeamento }
}

const nbsp = (s: string | null) => (s ?? '').replace(/ /g, ' ')

describe('«conferir» · 8 (BlackArrow)', () => {
  it('the heading, the order line, the rows as a list (a screen reader hears «, » between the items)', () => {
    montar(mapear('f8'), 'futures')
    expect(screen.getByRole('heading', { level: 3, name: 'Confira 3 linhas' })).toHaveAttribute('id', 't-passo')
    expect(screen.getByText('Entrada · Ativo · Lado · Quantidade · Resultado')).toHaveClass('hub-nota')
    const itens = screen.getAllByRole('listitem')
    expect(itens.map((li) => nbsp(li.textContent))).toEqual([
      '1 out, 09:34, MESZ6, compra, 2 contratos, −US$ 39,98',
      '1 out, 09:35, MNQZ6, venda, 1 contrato, +US$ 8,26',
      '1 out, 10:31, MESZ6, compra, 1 contrato, +US$ 26,26',
    ])
    expect(itens[0]).toHaveClass('hub-prev-linha')
    expect(itens[0].closest('ul')).toHaveClass('hub-prev-lista')
    const separadores = itens[0].querySelectorAll('.sr-only')
    expect(separadores).toHaveLength(4)
    expect(Array.from(separadores).every((s) => s.textContent === ', ')).toBe(true)
  })

  it('the net question: «Sim, é líquido» pressed with its evidence; «Não, é bruto» by a click', async () => {
    const { user, ultimo } = montar(mapear('f8'), 'futures')
    const grupo = screen.getByRole('group', { name: 'O resultado do arquivo já desconta a comissão?' })
    expect(grupo.closest('.hub-bloco')).not.toHaveClass('hub-bloco--atencao')
    expect(within(grupo).getByRole('button', { name: 'Sim, é líquido' })).toHaveAttribute('aria-pressed', 'true')
    expect(nbsp(screen.getByText(/^Conferido pelos preços/).textContent)).toBe('Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.')
    await user.click(within(grupo).getByRole('button', { name: 'Não, é bruto' }))
    expect(within(grupo).getByRole('button', { name: 'Não, é bruto' })).toHaveAttribute('aria-pressed', 'true')
    expect(ultimo().resultIsNet).toBe(false)
  })

  it('«Salvar como modelo» checked with «Nome do modelo» «BlackArrow» (at most 60); emptied, the default is saved; unchecked, no name', async () => {
    const { user, ultimo } = montar(mapear('f8'), 'futures')
    const caixa = screen.getByRole('checkbox', { name: 'Salvar como modelo' })
    expect(caixa).toBeChecked()
    expect(caixa.closest('label')).toHaveClass('hub-check')
    const nome = screen.getByRole('textbox', { name: 'Nome do modelo' })
    expect(nome).toHaveValue('BlackArrow')
    expect(nome).toHaveAttribute('maxLength', '60')
    expect(screen.getByText('O modelo guarda os nomes das colunas e as suas escolhas, nunca as operações.')).toBeInTheDocument()
    await user.clear(nome)
    expect(ultimo().nome).toBe('')
    expect(modeloASalvar(ultimo(), { tzHint: null, rota: null })?.nome).toBe('BlackArrow')
    await user.type(nome, 'Minha BlackArrow')
    expect(modeloASalvar(ultimo(), { tzHint: null, rota: null })?.nome).toBe('Minha BlackArrow')
    await user.click(caixa)
    expect(caixa).not.toBeChecked()
    expect(screen.queryByRole('textbox', { name: 'Nome do modelo' })).toBeNull()
    expect(modeloASalvar(ultimo(), { tzHint: null, rota: null })).toBeNull()
  })
})

describe('«conferir» · 15b, 17', () => {
  it('15 · «Uma coluna a mais»: «Atualizar o modelo “BlackArrow”», no name field', () => {
    montar(mapear('f15b', [modeloBlackArrow()]), 'futures')
    expect(screen.getByRole('checkbox', { name: 'Atualizar o modelo “BlackArrow”' })).toBeChecked()
    expect(screen.queryByRole('textbox', { name: 'Nome do modelo' })).toBeNull()
  })

  it('17 · NinjaTrader: «Não, é bruto» pre-answered, «… antes da comissão de US$ 1,24.»', () => {
    montar(mapear('f17'), 'futures')
    const grupo = screen.getByRole('group', { name: 'O resultado do arquivo já desconta a comissão?' })
    expect(within(grupo).getByRole('button', { name: 'Não, é bruto' })).toHaveAttribute('aria-pressed', 'true')
    expect(nbsp(screen.getByText(/^Conferido pelos preços/).textContent)).toBe('Conferido pelos preços na 1ª linha: +US$ 17,00 antes da comissão de US$ 1,24.')
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('MNQ 12-26')
  })
})

describe('«conferir» · 16 (executions)', () => {
  it('«termina posicionado»: «Não sei» pressed; «Sim» changes the summary (a status) and tells the live region', async () => {
    const { user, onAnuncio, ultimo } = montar(mapear('f16ta'), 'futures')
    expect(screen.getByText('Confira: a quantidade é a executada e o horário é o da execução, não o da ordem.')).toBeInTheDocument()
    expect(screen.getByText('Em MNQZ6, supomos que o arquivo começa sem posição aberta.')).toBeInTheDocument()
    const grupo = screen.getByRole('group', { name: 'No fim do arquivo, MESZ6 ficou posicionado?' })
    const bloco = grupo.closest('.hub-bloco') as HTMLElement
    expect(bloco).toHaveClass('hub-bloco--atencao', 'hub-pergunta')
    expect(within(bloco).getByText('Pelas execuções do arquivo, sobra 1 contrato vendido.')).toBeInTheDocument()
    expect(within(grupo).getByRole('button', { name: 'Não sei' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(bloco).getByText('As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.')).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Viram 2 operações: 2 com uma saída.')
    expect(screen.getByRole('button', { name: 'Ver as 2 operações' })).toBeInTheDocument()

    await user.click(within(grupo).getByRole('button', { name: 'Sim, ficou posicionado' }))
    const sim = 'A posição ainda aberta fica de fora (1 execução) e entra quando você importar um arquivo que tenha a abertura e o fechamento.'
    expect(within(grupo).getByRole('button', { name: 'Sim, ficou posicionado' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(bloco).getByText(sim)).toBeInTheDocument()
    expect(onAnuncio).toHaveBeenLastCalledWith(sim)
    expect(ultimo().endOfFile).toEqual({ MESZ6: 'yes' })
    expect(status).toHaveTextContent('Viram 4 operações: 2 com uma saída e 2 com saídas parciais.')
    expect(nbsp(status.textContent)).toContain('1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.816,00 e de 1 a 6.819,50: +US$ 55,00.')
    expect(status).toHaveTextContent('1 posição com mais de uma entrada virou 2 operações, uma por entrada.')

    await user.click(within(grupo).getByRole('button', { name: 'Não, terminou zerado' }))
    expect(onAnuncio).toHaveBeenLastCalledWith('O arquivo começou com 1 contrato comprado, de antes dele: a venda que o fecha fica de fora.')
    expect(status).toHaveTextContent('Viram 5 operações: 4 com uma saída e 1 com saídas parciais.')
  })

  it('«Ver as 4 operações»: the disclosure and its list', async () => {
    const { user } = montar(mapear('f16t'), 'futures')
    const ver = screen.getByRole('button', { name: 'Ver as 4 operações' })
    expect(ver).toHaveClass('hub-abre')
    expect(ver).toHaveAttribute('aria-expanded', 'false')
    expect(ver).toHaveAttribute('aria-controls', 'ops-formadas')
    expect(document.getElementById('ops-formadas')).toBeNull()
    await user.click(ver)
    expect(ver).toHaveAttribute('aria-expanded', 'true')
    expect(ver).toHaveFocus()
    const lista = document.getElementById('ops-formadas') as HTMLElement
    expect(lista).toHaveClass('hub-ops-lista')
    expect(within(lista).getAllByRole('listitem').map((li) => nbsp(li.textContent))).toEqual([
      '13 out, 10:31 · MESZ6 · compra de 2 a 6.812,25 · saídas de 1 a 6.816,00 e de 1 a 6.819,50 · +US$ 55,00',
      '13 out, 11:02 · MNQZ6 · compra de 1 a 25.240,75 · saída de 1 a 25.244,50 · +US$ 7,50',
      '13 out, 11:05 · MNQZ6 · compra de 1 a 25.236,00 · saída de 1 a 25.244,50 · +US$ 17,00',
      '13 out, 11:20 · MESZ6 · venda de 3 a 6.821,00 · saídas de 2 a 6.817,25 e de 1 a 6.823,75 · +US$ 23,75',
    ])
    expect(screen.queryByRole('group', { name: /ficou posicionado/ })).toBeNull()
    expect(screen.getByText('Supomos que o arquivo começa sem posição aberta.')).toBeInTheDocument()
  })

  it('Binance: «Não» → «O arquivo começou com 0,1 ETH vendidos, …»', async () => {
    const { user, onAnuncio } = montar(mapear('f16b'), 'crypto')
    const grupo = screen.getByRole('group', { name: 'No fim do arquivo, ETHUSDT ficou posicionado?' })
    expect(screen.getByText('Pelas execuções do arquivo, sobram 0,1 ETH comprados.')).toBeInTheDocument()
    await user.click(within(grupo).getByRole('button', { name: 'Não, terminou zerado' }))
    expect(onAnuncio).toHaveBeenLastCalledWith('O arquivo começou com 0,1 ETH vendidos, de antes dele: a compra que fecha essa venda fica de fora.')
    expect(screen.getByRole('status')).toHaveTextContent('Viram 3 operações: 2 com uma saída e 1 com saídas parciais.')
  })

  it('two «Conta» values: one question per account, the answer under the composite key', async () => {
    const { user, ultimo } = montar(mapear('f16c'), 'futures')
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma operação: todas as execuções ficaram de fora.')
    expect(screen.queryByRole('button', { name: /^Ver / })).toBeNull()
    const grupo = screen.getByRole('group', { name: 'No fim do arquivo, MESZ6 (LT50K-0193) ficou posicionado?' })
    expect(screen.getByRole('group', { name: 'No fim do arquivo, MESZ6 (LT50K-0194) ficou posicionado?' })).toBeInTheDocument()
    await user.click(within(grupo).getByRole('button', { name: 'Sim, ficou posicionado' }))
    expect(ultimo().endOfFile).toEqual({ [endOfFileKey('MESZ6', 'LT50K-0193')]: 'yes' })
    expect(screen.getByRole('status')).toHaveTextContent('Vira 1 operação, com uma saída.')
  })

  it('a model taken as is that starts here: the chip after the order line, no model block; «Mudar colunas» calls the sheet', async () => {
    const mudar = jest.fn()
    const { user } = montar(mapear('f16ta', [modeloTradovate()]), 'futures', mudar)
    const chip = screen.getByText('Colunas do modelo “Tradovate”')
    expect(chip).toHaveClass('hub-chip-dado')
    const linha = chip.closest('.hub-ler') as HTMLElement
    expect(linha.previousElementSibling).toHaveTextContent('Data e hora · Ativo · Lado · Quantidade · Preço')
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('O modelo guarda os nomes das colunas e as suas escolhas, nunca as operações.')).toBeNull()
    expect(screen.getByRole('group', { name: 'No fim do arquivo, MESZ6 ficou posicionado?' })).toBeInTheDocument()
    await user.click(within(linha).getByRole('button', { name: 'Mudar colunas' }))
    expect(mudar).toHaveBeenCalledTimes(1)
  })

  it('the tab order (§5.7): «Mudar colunas», the end-of-file pills, «Ver …», the footer', async () => {
    const { user } = montar(mapear('f16ta', [modeloTradovate()]), 'futures', () => {})
    const ordem: string[] = []
    for (let i = 0; i < 12; i++) {
      await user.tab()
      ordem.push((document.activeElement as HTMLElement).textContent ?? '')
      if (ordem[ordem.length - 1] === 'Usar estas colunas') break
    }
    expect(ordem).toEqual(['Mudar colunas', 'Sim, ficou posicionado', 'Não, terminou zerado', 'Não sei', '▸Ver as 2 operações', 'Usar estas colunas'])
  })
})

describe('«conferir» · the net question, the model block and the footer', () => {
  it('the tab order (§5.7) of a trade file: the net pills, the checkbox, «Nome do modelo», the footer', async () => {
    const { user } = montar(mapear('f8'), 'futures')
    const ordem: string[] = []
    for (let i = 0; i < 8; i++) {
      await user.tab()
      const el = document.activeElement as HTMLElement
      ordem.push(el instanceof HTMLInputElement ? (el.type === 'checkbox' ? 'checkbox' : `#${el.id}`) : el.textContent ?? '')
      if (el.textContent === 'Usar estas colunas') break
    }
    expect(ordem).toEqual(['Sim, é líquido', 'Não, é bruto', 'checkbox', '#m-nome', 'Usar estas colunas'])
  })

  it('18 · «Datas ambíguas» before the answer: no evidence, the footer blocked with «Responda a pergunta …»; a pill unblocks it', async () => {
    const { user } = montar(mapear('f18a'), 'forex')
    expect(screen.getByText('Responda a pergunta sobre o resultado do arquivo.')).toHaveAttribute('id', 'dica-pri')
    const grupo = screen.getByRole('group', { name: 'O resultado do arquivo já tem a comissão e o swap?' })
    expect(within(grupo).getAllByRole('button').map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false'])
    expect(screen.queryByText(/^Conferido pelos preços/)).toBeNull()
    await user.click(within(grupo).getByRole('button', { name: 'Sim, é líquido' }))
    expect(screen.queryByText('Responda a pergunta sobre o resultado do arquivo.')).toBeNull()
  })

  it('E29: a file the mapping cannot make: the alert in place of the rows, the footer blocked with it', () => {
    const texto = ['Time,Symbol,Side,Qty,Price', '2026-10-11T00:05:12Z,BTCUSDT,BUY,0.01,112400.00', '2026-10-11 00:21:40,BTCUSDT,SELL,0.01,112952.00'].join('\n')
    const r = iniciarMapeamento({ fileName: 'x.csv', size: texto.length, sha256: '', text: texto }, { market: 'crypto', templates: [], nomePadrao: 'Binance' })
    if (!r.ok) throw new Error(r.error)
    montar(r.mapeamento, 'crypto')
    const falha = 'Este arquivo mistura horários com e sem fuso: não dá para pôr as execuções em ordem.'
    expect(screen.getAllByText(falha).map((e) => e.className)).toEqual(['hub-alerta', ''])
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.getByText('Usar estas colunas')).toHaveAttribute('aria-disabled', 'true')
  })
})
