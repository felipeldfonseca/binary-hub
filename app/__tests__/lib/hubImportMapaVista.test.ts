/**
 * Phase 3b · telas, lane L1: «mapa» and «conferir» as data (lib/hub/importMapaVista), every string of elements E7–E29 in
 * every state of the approved board ImportarConta (contract §2.2) on the board's files (testing/mapeadoTelas), and the
 * forms the board does not draw (N) on small invented files. Money is written with a no-break space after the currency
 * (formatMoney); the board's text has a plain one, so the comparisons read both as a space.
 */
import fs from 'fs'
import path from 'path'
import { endOfFileKey, type RowKind, type Template } from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'
import {
  comColuna,
  comDatas,
  comDecimal,
  comFimDoArquivo,
  comLiquido,
  comModo,
  comPalavraDeLado,
  comSalvar,
  comSeparador,
  iniciarMapeamento,
  mudarColunas,
  nomePadraoDoModelo,
  type ArquivoMapeavel,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import { anuncioDoMapa, vistaConferir, vistaMapa, type VistaConferir, type VistaMapa } from '@/lib/hub/importMapaVista'
import { CONFERIR } from '@/components/hub/importar/copyMapa'
import { ARQUIVOS_QUADRO, CONTAS_QUADRO, CONTA_DO_ARQUIVO, modeloBlackArrow, modeloTradovate, type ArquivoQuadroKey } from '@/testing/mapeadoTelas'

const conta = (k: ArquivoQuadroKey) => CONTAS_QUADRO[CONTA_DO_ARQUIVO[k]]
const mercado = (k: ArquivoQuadroKey): AccountMarket => conta(k).market
const arquivo = (k: ArquivoQuadroKey): ArquivoMapeavel => ({
  fileName: ARQUIVOS_QUADRO[k].nome,
  size: ARQUIVOS_QUADRO[k].texto.length,
  sha256: 'ab'.repeat(32),
  text: ARQUIVOS_QUADRO[k].texto,
})

function mapear(k: ArquivoQuadroKey, templates: readonly Template[] = []): Mapeamento {
  const c = conta(k)
  const r = iniciarMapeamento(arquivo(k), { market: c.market, templates, nomePadrao: nomePadraoDoModelo(c.platform) })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}

/** An invented file mapped from the names */
function mapearTexto(texto: string, market: AccountMarket, nomePadrao = 'Minha plataforma'): Mapeamento {
  const r = iniciarMapeamento({ fileName: 'x.csv', size: texto.length, sha256: 'ab'.repeat(32), text: texto }, { market, templates: [], nomePadrao })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}

/** The no-break space formatMoney writes, read as a space */
const t = (s: string | null | undefined) => (s === null || s === undefined ? s : s.replace(/ /g, ' '))
const ts = (xs: readonly string[]) => xs.map((x) => t(x) as string)
const mapa = (m: Mapeamento, k: ArquivoQuadroKey): VistaMapa => vistaMapa(m, arquivo(k), mercado(k))
const conferir = (m: Mapeamento, k: ArquivoQuadroKey): VistaConferir => vistaConferir(m, mercado(k))
const linhas = (v: VistaConferir) => v.linhas.map((l) => t(l.join(' · ')))
const pills = (opcoes: { rotulo: string; pressionada: boolean }[]) => opcoes.map((o) => `${o.rotulo}${o.pressionada ? ' *' : ''}`)
const SUGERIMOS = 'Já sugerimos pelo nome de cada coluna. Confira.'
const SEM_SAIDA = 'Sem hora de saída, o resultado conta no limite do dia na hora da entrada.'
const SEM_ID = 'Sem coluna de ID, reconhecemos a reimportação pela mesma hora e preço.'
const EXECUCAO =
  'Juntamos as compras e vendas de cada ativo em operações: cada compra que abre ou aumenta a posição vira uma operação, e as vendas fecham primeiro as compras mais antigas. Na venda a descoberto, é o mesmo, ao contrário.'
const R2 = 'Confira: a quantidade é a executada e o horário é o da execução, não o da ordem.'
const OPC_OP = 'Opcionais: Saída, Comissão, Outra taxa, Stop, Alvo, ID da operação (evita duplicar), Conta. Sem coluna de lado, marque Compra e Venda (data e hora) e o preço de cada uma.'
const OPC_EX = 'Opcionais: Comissão, Outra taxa, ID da execução (evita duplicar), ID da ordem, Abre ou fecha, Resultado realizado, Conta.'

// ------------------------------------------------------------------------------------------------
// «mapa»
// ------------------------------------------------------------------------------------------------

describe('«mapa» · 8 · «Conta sem outro formato» (BlackArrow)', () => {
  const v = mapa(mapear('f8'), 'f8')

  it('the title, the reading chips, «Mudar»’s panel, «Cada linha do arquivo é», «Obrigatórias», the notes', () => {
    expect(v.titulo).toBe('Não reconhecemos este arquivo. Diga o que é cada coluna.')
    expect([v.lerTexto, v.datasTexto]).toEqual(['Separador: ponto e vírgula · decimal vírgula', 'Datas: dia/mês'])
    expect(v.separadores.map((s) => [s.rotulo, s.aria, s.pressionada])).toEqual([
      [';', 'Ponto e vírgula', true],
      [',', 'Vírgula', false],
      ['Tab', 'Tabulação', false],
    ])
    expect(pills(v.decimais ?? [])).toEqual(['vírgula *', 'ponto'])
    expect(pills(v.ordens ?? [])).toEqual(['dia/mês *', 'mês/dia'])
    expect([v.notaLer, v.perguntaDatas, v.perguntaDecimal, v.duplicadas, v.bloqueio, v.anuncio]).toEqual([null, null, null, null, null, ''])
    expect(pills(v.modos)).toEqual(['uma operação (entrada e saída) *', 'uma execução (compra ou venda)'])
    expect(v.obrigatorias).toEqual([
      { texto: 'Entrada ✓', ok: true },
      { texto: 'Ativo ✓', ok: true },
      { texto: 'Lado ✓', ok: true },
      { texto: 'Quantidade ✓', ok: true },
      { texto: 'Resultado (ou os preços) ✓', ok: true },
    ])
    expect(v.opcionais).toBe(OPC_OP)
    expect(v.notas).toEqual([SEM_SAIDA, SUGERIMOS])
    expect(v.perguntasLado).toEqual([])
  })

  it('one row per column: the name as written, «sugerida», «ex.: …», the select', () => {
    expect(v.colunas.map((c) => [c.nome, c.tag, c.amostra, c.valor, c.aria, c.checagem])).toEqual([
      ['Data/Hora', 'sugerida', 'ex.: 01/10/2026 09:34:31', 'entry_time', 'O que é a coluna Data/Hora', null],
      ['Papel', 'sugerida', 'ex.: MESZ6', 'symbol', 'O que é a coluna Papel', null],
      ['C/V', 'sugerida', 'ex.: C', 'side', 'O que é a coluna C/V', null],
      ['Qtd', 'sugerida', 'ex.: 2', 'quantity', 'O que é a coluna Qtd', null],
      ['Pr. Entrada', 'sugerida', 'ex.: 6.801,00', 'entry_price', 'O que é a coluna Pr. Entrada', null],
      ['Pr. Saída', 'sugerida', 'ex.: 6.797,25', 'exit_price', 'O que é a coluna Pr. Saída', null],
      ['Res. Líq.', 'sugerida', 'ex.: -39,98', 'pnl', 'O que é a coluna Res. Líq.', null],
      ['Corretagem', 'sugerida', 'ex.: 2,48', 'commission', 'O que é a coluna Corretagem', null],
      ['Nº Negócio', 'sugerida', 'ex.: 83395', 'trade_id', 'O que é a coluna Nº Negócio', null],
    ])
    expect(v.colunas[0].opcoes.map((o) => o.rotulo)).toEqual([
      'Escolha…',
      'Entrada (data e hora)',
      'Ativo',
      'Lado',
      'Quantidade',
      'Resultado',
      'Preço de entrada',
      'Preço de saída',
      'Saída (data e hora)',
      'Compra (data e hora)',
      'Venda (data e hora)',
      'Preço de compra',
      'Preço de venda',
      'Comissão',
      'Outra taxa (soma na comissão)',
      'Stop',
      'Alvo',
      'ID da operação (evita duplicar)',
      'Conta',
      'Ignorar esta coluna',
    ])
    expect(v.colunas.map((c) => c.checagemId)).toEqual(v.colunas.map((_, i) => `chk-${i}`))
  })

  it('«Mudar» → «,»: «Com este separador, …» (also the live region), «Confira como ler o arquivo.»', () => {
    const n = comSeparador(mapear('f8'), arquivo('f8'), ',', 'futures')
    const w = mapa(n, 'f8')
    expect([w.lerTexto, w.notaLer, w.bloqueio, w.anuncio]).toEqual([
      'Separador: vírgula · decimal vírgula',
      'Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.',
      'Confira como ler o arquivo.',
      'Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.',
    ])
    expect(pills(w.separadores)).toEqual([';', ', *', 'Tab'])
    expect(w.colunas.map((c) => c.nome)).toEqual(v.colunas.map((c) => c.nome))
  })

  it('Papel → «Quantidade»: the check under Papel, «Quantidade está em mais de uma coluna.», «Ativo · falta», the hint', () => {
    const w = mapa(comColuna(mapear('f8'), 1, 'quantity', 'futures'), 'f8')
    expect(w.colunas[1]).toMatchObject({ tag: null, valor: 'quantity', checagem: 'Esta coluna não parece número.' })
    expect(w.colunas[3].tag).toBe('sugerida')
    expect(w.duplicadas).toBe('Quantidade está em mais de uma coluna.')
    expect(w.obrigatorias.map((r) => r.texto)).toEqual(['Entrada ✓', 'Ativo · falta', 'Lado ✓', 'Quantidade ✓', 'Resultado (ou os preços) ✓'])
    expect(w.obrigatorias[1].ok).toBe(false)
    expect([w.bloqueio, w.anuncio]).toEqual(['Marque as colunas obrigatórias.', 'Quantidade está em mais de uma coluna.'])
    // Two fields twice, in field order
    const dois = comColuna(comColuna(mapear('f8'), 1, 'quantity', 'futures'), 2, 'quantity', 'futures')
    expect(mapa(comColuna(dois, 8, 'symbol', 'futures'), 'f8').duplicadas).toBe('Quantidade está em mais de uma coluna.')
    const ambos = comColuna(comColuna(comColuna(mapear('f8'), 0, 'symbol', 'futures'), 4, 'quantity', 'futures'), 8, 'entry_time', 'futures')
    expect(mapa(ambos, 'f8').duplicadas).toBe('Ativo, Quantidade estão em mais de uma coluna.')
  })

  it('8 · «Conta que já recebe outro formato» (Top One): the same, «Minha plataforma»', () => {
    const r = iniciarMapeamento(arquivo('f8'), { market: 'futures', templates: [], nomePadrao: nomePadraoDoModelo('topone') })
    if (!r.ok) throw new Error(r.error)
    expect(vistaConferir(r.mapeamento, 'futures').modelo).toMatchObject({ rotulo: 'Salvar como modelo', comNome: true, nome: 'Minha plataforma' })
  })
})

describe('«mapa» · 8 · «Performance.csv da Tradovate»', () => {
  it('the pair chips, the notes, «Ignorar esta coluna» «sugerida»', () => {
    const v = mapa(mapear('f8p'), 'f8p')
    expect([v.lerTexto, v.datasTexto]).toEqual(['Separador: vírgula · decimal ponto', 'Datas: mês/dia'])
    expect(v.obrigatorias.map((r) => r.texto)).toEqual([
      'Entrada (pela compra e venda) ✓',
      'Ativo ✓',
      'Lado (pela compra e venda) ✓',
      'Quantidade ✓',
      'Resultado (ou os preços) ✓',
    ])
    expect(v.notas).toEqual([
      'Com a compra e a venda em colunas, a entrada é a que veio primeiro: comprou primeiro, é compra; vendeu primeiro, é venda.',
      SEM_ID,
      '“$(13.75)” é perda: lemos como −13,75.',
      'buyFillId e sellFillId se repetem de uma linha para outra: nenhuma das duas serve de ID sozinha.',
      SUGERIMOS,
    ])
    expect(v.colunas.map((c) => [c.nome, c.tag, c.valor])).toEqual([
      ['symbol', 'sugerida', 'symbol'],
      ['qty', 'sugerida', 'quantity'],
      ['buyPrice', 'sugerida', 'buy_price'],
      ['sellPrice', 'sugerida', 'sell_price'],
      ['pnl', 'sugerida', 'pnl'],
      ['boughtTimestamp', 'sugerida', 'buy_time'],
      ['soldTimestamp', 'sugerida', 'sell_time'],
      ['duration', 'sugerida', 'ignorar'],
      ['buyFillId', 'sugerida', 'ignorar'],
      ['sellFillId', 'sugerida', 'ignorar'],
    ])
  })

  it('buyFillId → «ID da operação»: «Esta coluna repete valores: …»; the no-ID note goes, the repeating-IDs note stays', () => {
    const v = mapa(comColuna(mapear('f8p'), 8, 'trade_id', 'futures'), 'f8p')
    expect(v.colunas[8]).toMatchObject({ tag: null, checagem: 'Esta coluna repete valores: não serve de ID.' })
    expect(v.notas).not.toContain(SEM_ID)
    expect(v.notas).toContain('buyFillId e sellFillId se repetem de uma linha para outra: nenhuma das duas serve de ID sozinha.')
    expect(v.bloqueio).toBe('Confira as colunas marcadas.')
  })
})

describe('«mapa» · 15 (the saved «BlackArrow»)', () => {
  it('«Mudar colunas»: «Mude as colunas do modelo “BlackArrow”.», the model’s fields without tags, no «Já sugerimos …»', () => {
    const v = mapa(mudarColunas(mapear('f15', [modeloBlackArrow()])), 'f15')
    expect(v.titulo).toBe('Mude as colunas do modelo “BlackArrow”.')
    expect(v.colunas.every((c) => c.tag === null)).toBe(true)
    expect(v.notas).toEqual([SEM_SAIDA])
  })

  it('«Uma coluna a mais»: «Este arquivo mudou desde o modelo “BlackArrow”. Confira as colunas.»; «Estratégia» «Escolha…» «nova»', () => {
    const v = mapa(mapear('f15b', [modeloBlackArrow()]), 'f15b')
    expect(v.titulo).toBe('Este arquivo mudou desde o modelo “BlackArrow”. Confira as colunas.')
    expect(v.colunas.map((c) => c.tag)).toEqual([null, null, null, null, null, null, null, null, null, 'nova'])
    expect(v.colunas[9]).toMatchObject({ nome: 'Estratégia', amostra: 'ex.: Rompimento', valor: '' })
    expect(v.notas).toEqual([SEM_SAIDA])
    // «nova» stays whatever the select holds
    expect(mapa(comColuna(mapear('f15b', [modeloBlackArrow()]), 9, 'ignorar', 'futures'), 'f15b').colunas[9].tag).toBe('nova')
  })

  it('an exact model the file contradicts (another decimal mark) is «mudou», never «Mude as colunas …»', () => {
    const v = mapa(mapear('f15', [{ ...modeloBlackArrow(), decimalMark: 'point' }]), 'f15')
    expect(v.titulo).toBe('Este arquivo mudou desde o modelo “BlackArrow”. Confira as colunas.')
  })
})

describe('«mapa» · 16 (one execution per row)', () => {
  it('Tradovate: «uma execução» pressed, the execution chips and notes, the twins «Ignorar» «sugerida», the board’s samples', () => {
    const v = mapa(mapear('f16t'), 'f16t')
    expect(pills(v.modos)).toEqual(['uma operação (entrada e saída)', 'uma execução (compra ou venda) *'])
    expect([v.lerTexto, v.datasTexto]).toEqual(['Separador: vírgula · decimal ponto', 'Datas: mês/dia'])
    expect(v.obrigatorias.map((r) => r.texto)).toEqual(['Data e hora ✓', 'Ativo ✓', 'Lado ✓', 'Quantidade ✓', 'Preço ✓'])
    expect(v.opcionais).toBe(OPC_EX)
    expect(v.notas).toEqual([
      EXECUCAO,
      'Sem coluna de resultado, calculamos pelos preços só nos contratos que conhecemos: ES, MES, NQ, MNQ, GC, MGC, CL e MCL.',
      SUGERIMOS,
    ])
    expect(v.colunas.map((c) => [c.nome, c.valor, c.tag])).toEqual([
      ['orderId', 'fill_id', 'sugerida'],
      ['Account', 'account', 'sugerida'],
      ['B/S', 'side', 'sugerida'],
      ['Contract', 'symbol', 'sugerida'],
      ['avgPrice', 'ignorar', 'sugerida'],
      ['filledQty', 'ignorar', 'sugerida'],
      ['Fill Time', 'time', 'sugerida'],
      ['Status', 'ignorar', 'sugerida'],
      ['Timestamp', 'ignorar', 'sugerida'],
      ['Quantity', 'ignorar', 'sugerida'],
      ['Limit Price', 'ignorar', 'sugerida'],
      ['Filled Qty', 'quantity', 'sugerida'],
      ['Avg Fill Price', 'price', 'sugerida'],
    ])
    expect(v.colunas[8].amostra).toBe('ex.: 10/13/2026 10:31:04')
    expect(v.colunas[10].amostra).toBe('ex.: 6816.00')
    expect(v.colunas[0].opcoes.map((o) => o.rotulo)).toEqual([
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

  it('Binance: no «Datas» chip; «A coluna Date(UTC) já diz o fuso: …»; «Amount» «Escolha…»', () => {
    const v = mapa(mapear('f16b'), 'f16b')
    expect([v.lerTexto, v.datasTexto, v.ordens]).toEqual(['Separador: vírgula · decimal ponto', null, null])
    expect(v.notas).toEqual([
      EXECUCAO,
      'Sem coluna de resultado, calculamos pelos preços só nos pares em dólar (USDT, USDC ou USD).',
      'A coluna Date(UTC) já diz o fuso: os horários entram em UTC.',
      SUGERIMOS,
    ])
    expect(v.colunas.map((c) => [c.nome, c.valor, c.tag])).toEqual([
      ['Date(UTC)', 'time', 'sugerida'],
      ['Pair', 'symbol', 'sugerida'],
      ['Side', 'side', 'sugerida'],
      ['Price', 'price', 'sugerida'],
      ['Executed', 'quantity', 'sugerida'],
      ['Amount', '', null],
      ['Fee', 'commission', 'sugerida'],
      ['Trade ID', 'fill_id', 'sugerida'],
    ])
  })

  it('Interactive Brokers: «Lado (ou quantidade com sinal) ✓», «Sem coluna de lado: …»; «Quantity» on «Escolha…»: both «· falta»', () => {
    const v = mapa(mapear('f16i'), 'f16i')
    expect(v.obrigatorias.map((r) => r.texto)).toEqual(['Data e hora ✓', 'Ativo ✓', 'Lado (ou quantidade com sinal) ✓', 'Quantidade ✓', 'Preço ✓'])
    expect(v.notas).toEqual([
      EXECUCAO,
      'Sem coluna de lado: quantidade positiva é compra, negativa é venda.',
      'Sem coluna de resultado, calculamos pelos preços. Opções ficam de fora: registre no Registrar.',
      SUGERIMOS,
    ])
    expect(v.colunas.map((c) => [c.nome, c.valor])).toEqual([
      ['Symbol', 'symbol'],
      ['DateTime', 'time'],
      ['Quantity', 'quantity'],
      ['TradePrice', 'price'],
      ['IBCommission', 'commission'],
      ['AssetClass', ''],
      ['Open/CloseIndicator', 'open_close'],
      ['TradeID', 'fill_id'],
    ])
    const w = mapa(comColuna(mapear('f16i'), 2, null, 'stocks'), 'f16i')
    expect(w.obrigatorias.map((r) => r.texto)).toEqual(['Data e hora ✓', 'Ativo ✓', 'Lado (ou quantidade com sinal) · falta', 'Quantidade · falta', 'Preço ✓'])
    expect(w.notas).not.toContain('Sem coluna de lado: quantidade positiva é compra, negativa é venda.')
  })
})

describe('«mapa» · 17, 18, 19', () => {
  it('17 · NinjaTrader: «Trade number» «Escolha…», the notes', () => {
    const v = mapa(mapear('f17'), 'f17')
    expect([v.lerTexto, v.datasTexto]).toEqual(['Separador: vírgula · decimal ponto', 'Datas: mês/dia'])
    expect(v.notas).toEqual([SEM_ID, SUGERIMOS])
    expect(v.colunas.map((c) => [c.nome, c.valor, c.tag])).toEqual([
      ['Trade number', '', null],
      ['Instrument', 'symbol', 'sugerida'],
      ['Account', 'account', 'sugerida'],
      ['Market pos.', 'side', 'sugerida'],
      ['Qty', 'quantity', 'sugerida'],
      ['Entry price', 'entry_price', 'sugerida'],
      ['Exit price', 'exit_price', 'sugerida'],
      ['Entry time', 'entry_time', 'sugerida'],
      ['Exit time', 'exit_time', 'sugerida'],
      ['Profit', 'pnl', 'sugerida'],
      ['Commission', 'commission', 'sugerida'],
    ])
  })

  it('18 · «Datas claras»: «Datas: dia/mês», «Swap ou funding» offered, «Lado ✓», only «Já sugerimos …»', () => {
    const v = mapa(mapear('f18'), 'f18')
    expect(v.datasTexto).toBe('Datas: dia/mês')
    expect(v.opcionais).toBe(
      'Opcionais: Saída, Comissão, Outra taxa, Swap ou funding, Stop, Alvo, ID da operação (evita duplicar), Conta. Sem coluna de lado, marque Compra e Venda (data e hora) e o preço de cada uma.',
    )
    expect(v.obrigatorias[2].texto).toBe('Lado ✓')
    expect(v.notas).toEqual([SUGERIMOS])
    expect(v.colunas.map((c) => c.valor)).toEqual([
      'trade_id',
      'entry_time',
      'exit_time',
      'symbol',
      'side',
      'quantity',
      'entry_price',
      'exit_price',
      'swap',
      'commission',
      'pnl',
    ])
    expect(v.colunas[0].opcoes.map((o) => o.rotulo)).toContain('Swap ou funding')
    // «Swap ou funding» without «Resultado»: the check under the swap column
    const w = mapa(comColuna(mapear('f18'), 10, 'ignorar', 'forex'), 'f18')
    expect([w.colunas[8].checagem, w.bloqueio]).toEqual(['Swap ou funding vai junto com a coluna de resultado.', 'Confira as colunas marcadas.'])
  })

  it('18 · «Datas ambíguas»: the question («09.10»), no «Datas» chip, the hint; after «dia/mês» the chip and no hint', () => {
    const v = mapa(mapear('f18a'), 'f18a')
    expect(v.perguntaDatas).toMatchObject({ id: 'q-datas', texto: 'As datas podem ser dia/mês ou mês/dia. Qual é?', atencao: true })
    expect(pills(v.perguntaDatas?.opcoes ?? [])).toEqual(['dia/mês (09.10 = 9 out)', 'mês/dia (09.10 = 10 set)'])
    expect([v.datasTexto, v.ordens, v.bloqueio]).toEqual([null, null, 'Escolha a ordem das datas.'])
    const w = mapa(comDatas(mapear('f18a'), 'dmy', 'forex'), 'f18a')
    expect([w.datasTexto, w.bloqueio]).toEqual(['Datas: dia/mês', null])
    expect(pills(w.perguntaDatas?.opcoes ?? [])).toEqual(['dia/mês (09.10 = 9 out) *', 'mês/dia (09.10 = 10 set)'])
  })

  it('19 · «Com resultado e custos»: «Emolumentos» → «Outra taxa», the decimal note, the «X» question and its hint', () => {
    const v = mapa(mapear('f19'), 'f19')
    expect([v.lerTexto, v.datasTexto]).toEqual(['Separador: ponto e vírgula · decimal vírgula', 'Datas: dia/mês'])
    expect(v.colunas[8]).toMatchObject({ nome: 'Emolumentos', valor: 'fee', tag: 'sugerida' })
    expect(v.notas).toEqual([SEM_SAIDA, 'Decimal vírgula pelos valores como “88,50”: “131.250” é 131250.', SUGERIMOS])
    expect(v.perguntasLado).toHaveLength(1)
    expect(v.perguntasLado[0]).toMatchObject({ id: 'q-lado-0', chave: 'x', texto: '2 linhas trazem “X” na coluna de lado. O que quer dizer?', atencao: true })
    expect(pills(v.perguntasLado[0].opcoes)).toEqual(['Compra', 'Venda', 'Pular essas linhas'])
    expect(v.bloqueio).toBe('Diga o que quer dizer “X”.')
    const w = mapa(comPalavraDeLado(mapear('f19'), 'x', 'sell', 'b3'), 'f19')
    expect(pills(w.perguntasLado[0].opcoes)).toEqual(['Compra', 'Venda *', 'Pular essas linhas'])
    expect(w.bloqueio).toBeNull()
  })

  it('19 · «Só preços»: no decimal in the chip; the decimal question; «ponto é decimal» → the tick nota and the hint', () => {
    const m = comPalavraDeLado(mapear('f19p'), 'x', 'sell', 'b3')
    const v = mapa(m, 'f19p')
    expect([v.lerTexto, v.datasTexto, v.decimais]).toEqual(['Separador: ponto e vírgula', 'Datas: dia/mês', null])
    expect(v.perguntaDecimal).toMatchObject({ id: 'q-dec', texto: 'Como ler os números deste arquivo?', atencao: true, nota: null })
    expect(pills(v.perguntaDecimal?.opcoes ?? [])).toEqual(['“131.250” é 131250 (ponto separa milhar) *', '“131.250” é 131,25 (ponto é decimal)'])
    expect(v.notas).toEqual([
      'Sem coluna de resultado, calculamos pelos preços só nos contratos e ações que conhecemos (WIN, IND, WDO, DOL e as ações da lista).',
      SEM_SAIDA,
      SUGERIMOS,
    ])
    expect(v.bloqueio).toBeNull()
    const ponto = comDecimal(m, 'point', 'b3')
    const w = mapa(ponto, 'f19p')
    expect(w.perguntaDecimal?.nota).toBe('Com este decimal, o WIN fica fora do passo (de 5 em 5). Confira.')
    expect([w.bloqueio, w.anuncio, anuncioDoMapa(ponto, 'b3')]).toEqual([
      'Confira como ler o arquivo.',
      'Com este decimal, o WIN fica fora do passo (de 5 em 5). Confira.',
      'Com este decimal, o WIN fica fora do passo (de 5 em 5). Confira.',
    ])
    // Nothing pressed (N): «Escolha como ler os números.»
    expect(mapa({ ...m, decimalMark: null }, 'f19p').bloqueio).toBe('Escolha como ler os números.')
  })
})

describe('«mapa» · the forms the board does not draw (N)', () => {
  it('«1 linha traz “X” …» (one row)', () => {
    const texto = ARQUIVOS_QUADRO.f19.texto.replace('14/10/2026 11:12:40;WINZ26;X;', '14/10/2026 11:12:40;WINZ26;C;')
    const v = vistaMapa(mapearTexto(texto, 'b3'), null, 'b3')
    expect(v.perguntasLado.map((q) => q.texto)).toEqual(['1 linha traz “X” na coluna de lado. O que quer dizer?'])
  })

  it('a «,» sample: «vírgula é decimal» / «vírgula separa milhar»', () => {
    const texto = ['Data;Ativo;Lado;Qtd;Pr. Entrada;Pr. Saída', '14/10/2026 10:02:11;AAPL;C;10;1,234;1,240', '14/10/2026 11:02:11;AAPL;V;10;1,250;1,245'].join('\n')
    const v = vistaMapa(mapearTexto(texto, 'stocks'), null, 'stocks')
    expect(pills(v.perguntaDecimal?.opcoes ?? [])).toEqual(['“1,234” é 1,234 (vírgula é decimal) *', '“1,234” é 1234 (vírgula separa milhar)'])
  })

  it('one ID that repeats; three; a header that states another clock (UTC+1, UTC−3, UTC+5:30)', () => {
    const um = ['symbol,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,buyFillId', ...ARQUIVOS_QUADRO.f8p.texto.split('\n').slice(1).map((l) => l.split(',').slice(0, 7).concat(['77']).join(','))].join('\n')
    expect(vistaMapa(mapearTexto(um, 'futures'), null, 'futures').notas).toContain('buyFillId se repete de uma linha para outra: não serve de ID.')
    const tres = ['symbol,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,aId,bId,cId', ...ARQUIVOS_QUADRO.f8p.texto.split('\n').slice(1).map((l) => l.split(',').slice(0, 7).concat(['7', '8', '9']).join(','))].join('\n')
    expect(vistaMapa(mapearTexto(tres, 'futures'), null, 'futures').notas).toContain(
      'aId, bId e cId se repetem de uma linha para outra: nenhuma delas serve de ID sozinha.',
    )
    const fuso = (cab: string) => vistaMapa(mapearTexto([`${cab},Pair,Side,Price,Executed`, '2026-10-11 00:05:12,BTCUSDT,BUY,112400.00,0.01', '2026-10-11 00:21:40,BTCUSDT,SELL,112952.00,0.01'].join('\n'), 'crypto'), null, 'crypto').notas
    expect(fuso('Time (UTC+1)')).toContain('A coluna Time (UTC+1) já diz o fuso: os horários entram em UTC+1.')
    expect(fuso('Time (UTC-3)')).toContain('A coluna Time (UTC-3) já diz o fuso: os horários entram em UTC−3.')
    expect(fuso('Time (UTC+05:30)')).toContain('A coluna Time (UTC+05:30) já diz o fuso: os horários entram em UTC+5:30.')
  })

  it('the side words in an execution file too (A: the board draws them on trade files)', () => {
    const texto = ['Time,Symbol,Side,Qty,Price', '2026-10-11 00:05:12,BTCUSDT,X,0.01,112400.00', '2026-10-11 00:21:40,BTCUSDT,SELL,0.01,112952.00', '2026-10-11 00:31:40,BTCUSDT,BUY,0.01,112952.00'].join('\n')
    const m = mapearTexto(texto, 'crypto')
    expect(m.rowKind).toBe('fill')
    expect(vistaMapa(m, null, 'crypto').perguntasLado.map((q) => q.texto)).toEqual(['1 linha traz “X” na coluna de lado. O que quer dizer?'])
  })

  it('a field the row kind does not offer (a model’s swap in a futures account) still shows, and blocks', () => {
    const m = comColuna(mapear('f8'), 8, 'swap', 'futures')
    const v = mapa(m, 'f8')
    expect(v.colunas[8].opcoes.map((o) => o.rotulo)).toContain('Swap ou funding')
    expect(v.bloqueio).toBe('Confira as colunas marcadas.')
  })
})

// ------------------------------------------------------------------------------------------------
// «conferir»
// ------------------------------------------------------------------------------------------------

describe('«conferir» · trade files', () => {
  it('8: the rows, the net question pre-answered «Sim» with its evidence, «Salvar como modelo» with «BlackArrow»', () => {
    const v = conferir(mapear('f8'), 'f8')
    expect([v.titulo, v.ordem, v.falha, v.bloqueio, v.chipModelo]).toEqual(['Confira 3 linhas', 'Entrada · Ativo · Lado · Quantidade · Resultado', null, null, null])
    expect(linhas(v)).toEqual([
      '1 out, 09:34 · MESZ6 · compra · 2 contratos · −US$ 39,98',
      '1 out, 09:35 · MNQZ6 · venda · 1 contrato · +US$ 8,26',
      '1 out, 10:31 · MESZ6 · compra · 1 contrato · +US$ 26,26',
    ])
    expect(v.notas).toEqual([])
    expect(v.perguntasFim).toEqual([])
    expect(v.pareamento).toBeNull()
    expect(v.liquido).toMatchObject({ id: 'q-liq', texto: 'O resultado do arquivo já desconta a comissão?', atencao: false })
    expect(pills(v.liquido?.opcoes ?? [])).toEqual(['Sim, é líquido *', 'Não, é bruto'])
    expect(t(v.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.')
    expect(v.modelo).toEqual({
      rotulo: 'Salvar como modelo',
      salvar: true,
      comNome: true,
      nome: 'BlackArrow',
      nota: 'O modelo guarda os nomes das colunas e as suas escolhas, nunca as operações.',
    })
    // «Não, é bruto» pressed: the evidence stays; unchecked: no name field
    const b = conferir(comLiquido(mapear('f8'), false), 'f8')
    expect(pills(b.liquido?.opcoes ?? [])).toEqual(['Sim, é líquido', 'Não, é bruto *'])
    expect(t(b.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.')
    expect(conferir(comSalvar(mapear('f8'), false), 'f8').modelo).toMatchObject({ salvar: false, comNome: false })
  })

  it('8 · Performance: the rows by the first time, the same-entry note, no net question, «Tradovate»', () => {
    const v = conferir(mapear('f8p'), 'f8p')
    expect(linhas(v)).toEqual([
      '13 out, 11:20 · MESZ6 · venda · 2 contratos · +US$ 37,50',
      '13 out, 11:20 · MESZ6 · venda · 1 contrato · −US$ 13,75',
      '13 out, 11:02 · MNQZ6 · compra · 1 contrato · +US$ 7,50',
    ])
    expect(v.notas).toEqual(['A 1ª e a 2ª linhas têm a mesma entrada: viram uma operação com 2 saídas.'])
    expect(v.liquido).toBeNull()
    expect(v.modelo?.nome).toBe('Tradovate')
  })

  it('15: «Atualizar o modelo “BlackArrow”» (no name field), for a changed model and after «Mudar colunas»', () => {
    for (const m of [mapear('f15b', [modeloBlackArrow()]), mudarColunas(mapear('f15', [modeloBlackArrow()]))]) {
      expect(vistaConferir(m, 'futures').modelo).toMatchObject({ rotulo: 'Atualizar o modelo “BlackArrow”', salvar: true, comNome: false })
    }
  })

  it('17: the symbols as written, «Não, é bruto» with «… antes da comissão de US$ 1,24.», «NinjaTrader»', () => {
    const v = conferir(mapear('f17'), 'f17')
    expect(linhas(v)).toEqual([
      '1 out, 09:31 · MNQ 12-26 · venda · 1 contrato · +US$ 17,00',
      '1 out, 09:52 · MES 12-26 · compra · 2 contratos · +US$ 62,50',
      '1 out, 10:15 · MNQ 12-26 · compra · 1 contrato · −US$ 17,50',
    ])
    expect(pills(v.liquido?.opcoes ?? [])).toEqual(['Sim, é líquido', 'Não, é bruto *'])
    expect(t(v.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: +US$ 17,00 antes da comissão de US$ 1,24.')
    expect(v.modelo?.nome).toBe('NinjaTrader')
  })

  it('18: lots, «… já tem a comissão e o swap?» «Não, é bruto», «Match-Trader»; 18a before the answer: «—» for the time', () => {
    const v = conferir(mapear('f18'), 'f18')
    expect(linhas(v)).toEqual([
      '14 out, 08:40 · EURUSD · compra · 0,50 lote · +US$ 57,50',
      '14 out, 09:12 · EURGBP · venda · 0,25 lote · +US$ 19,84',
      '13 out, 17:48 · EURUSD · venda · 1,00 lote · −US$ 35,00',
    ])
    expect(v.liquido?.texto).toBe('O resultado do arquivo já tem a comissão e o swap?')
    expect(t(v.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: +US$ 57,50 antes da comissão de US$ 3,50.')
    expect(v.modelo?.nome).toBe('Match-Trader')
    const a = conferir(mapear('f18a'), 'f18a')
    expect(linhas(a)[0]).toBe('— · EURUSD · compra · 0,50 lote · +US$ 57,50')
    expect([a.liquido?.nota, a.bloqueio]).toEqual([null, 'Responda a pergunta sobre o resultado do arquivo.'])
  })

  it('19: reais, «Sim, é líquido» with «+R$ 90,00 − R$ 1,50 = +R$ 88,50.», «Profit (Nelogica)»', () => {
    const v = conferir(comPalavraDeLado(mapear('f19'), 'x', 'sell', 'b3'), 'f19')
    expect(linhas(v)).toEqual([
      '14 out, 10:02 · WINZ26 · venda · 3 contratos · +R$ 88,50',
      '14 out, 10:15 · WINZ26 · compra · 2 contratos · −R$ 31,00',
      '14 out, 11:20 · WDOX26 · compra · 1 contrato · +R$ 64,25',
    ])
    expect(t(v.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: +R$ 90,00 − R$ 1,50 = +R$ 88,50.')
    expect(v.modelo?.nome).toBe('Profit (Nelogica)')
  })

  it('19 · «Só preços»: «Resultado (pelos preços)», «… pelos preços», no net question; with the point: «pelos preços» alone', () => {
    const m = comPalavraDeLado(mapear('f19p'), 'x', 'sell', 'b3')
    const v = conferir(m, 'f19p')
    expect(v.ordem).toBe('Entrada · Ativo · Lado · Quantidade · Resultado (pelos preços)')
    expect(linhas(v)).toEqual([
      '14 out, 10:02 · WINZ26 · venda · 3 contratos · +R$ 90,00 pelos preços',
      '14 out, 10:15 · WINZ26 · compra · 2 contratos · −R$ 30,00 pelos preços',
      '14 out, 10:48 · WINZ26 · venda · 1 contrato · +R$ 25,00 pelos preços',
    ])
    expect(v.liquido).toBeNull()
    expect(linhas(conferir(comDecimal(m, 'point', 'b3'), 'f19p'))[0]).toBe('14 out, 10:02 · WINZ26 · venda · 3 contratos · pelos preços')
  })

  it('a side word nobody answered shows as written; an empty cell «—»', () => {
    const texto = ARQUIVOS_QUADRO.f19.texto.split('\n')
    const v = vistaConferir(mapearTexto([texto[0], texto[5], texto[14], texto[1]].join('\n'), 'b3'), 'b3')
    expect(linhas(v).map((l) => (l as string).split(' · ')[2])).toEqual(['X', '—', 'venda'])
  })
})

describe('«conferir» · execution files', () => {
  it('16 · Tradovate: the executions (the cancelled line skipped), R2, «Supomos …», the pairing and its four operations', () => {
    const v = conferir(mapear('f16t'), 'f16t')
    expect(v.ordem).toBe('Data e hora · Ativo · Lado · Quantidade · Preço')
    expect(linhas(v)).toEqual([
      '13 out, 10:31 · MESZ6 · compra · 2 contratos · 6.812,25',
      '13 out, 10:38 · MESZ6 · venda · 1 contrato · 6.816,00',
      '13 out, 10:44 · MESZ6 · venda · 1 contrato · 6.819,50',
    ])
    expect(v.notas).toEqual([R2, 'Supomos que o arquivo começa sem posição aberta.'])
    expect(v.liquido).toBeNull()
    expect(v.pareamento).toEqual({
      resumo: 'Viram 4 operações: 2 com uma saída e 2 com saídas parciais.',
      primeira: expect.any(String),
      entradas: '1 posição com mais de uma entrada virou 2 operações, uma por entrada.',
      ver: 'Ver as 4 operações',
      operacoes: expect.any(Array),
    })
    expect(t(v.pareamento?.primeira)).toBe('1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.816,00 e de 1 a 6.819,50: +US$ 55,00.')
    expect(ts(v.pareamento?.operacoes ?? [])).toEqual([
      '13 out, 10:31 · MESZ6 · compra de 2 a 6.812,25 · saídas de 1 a 6.816,00 e de 1 a 6.819,50 · +US$ 55,00',
      '13 out, 11:02 · MNQZ6 · compra de 1 a 25.240,75 · saída de 1 a 25.244,50 · +US$ 7,50',
      '13 out, 11:05 · MNQZ6 · compra de 1 a 25.236,00 · saída de 1 a 25.244,50 · +US$ 17,00',
      '13 out, 11:20 · MESZ6 · venda de 3 a 6.821,00 · saídas de 2 a 6.817,25 e de 1 a 6.823,75 · +US$ 23,75',
    ])
    expect(v.modelo?.nome).toBe('Tradovate')
  })

  it('16 · «termina posicionado»: «Em MNQZ6, supomos …»; the question and the pairing per answer', () => {
    const m = mapear('f16ta')
    const naoSei = conferir(m, 'f16ta')
    expect(naoSei.notas).toEqual([R2, 'Em MNQZ6, supomos que o arquivo começa sem posição aberta.'])
    expect(naoSei.perguntasFim).toHaveLength(1)
    expect(naoSei.perguntasFim[0]).toMatchObject({
      id: 'q-fim-0',
      chave: 'MESZ6',
      texto: 'No fim do arquivo, MESZ6 ficou posicionado?',
      sub: 'Pelas execuções do arquivo, sobra 1 contrato vendido.',
      atencao: true,
      nota: 'As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.',
    })
    expect(pills(naoSei.perguntasFim[0].opcoes)).toEqual(['Sim, ficou posicionado', 'Não, terminou zerado', 'Não sei *'])
    expect(naoSei.pareamento?.resumo).toBe('Viram 2 operações: 2 com uma saída.')
    expect(t(naoSei.pareamento?.primeira)).toBe('1ª operação: MNQZ6, compra de 1 a 25.240,75; saída de 1 a 25.244,50: +US$ 7,50.')
    expect(naoSei.pareamento?.entradas).toBe('1 posição com mais de uma entrada virou 2 operações, uma por entrada.')
    expect(naoSei.pareamento?.ver).toBe('Ver as 2 operações')

    const sim = conferir(comFimDoArquivo(m, 'MESZ6', 'yes'), 'f16ta')
    expect(pills(sim.perguntasFim[0].opcoes)).toEqual(['Sim, ficou posicionado *', 'Não, terminou zerado', 'Não sei'])
    expect(sim.perguntasFim[0].nota).toBe(
      'A posição ainda aberta fica de fora (1 execução) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
    )
    expect(sim.pareamento?.resumo).toBe('Viram 4 operações: 2 com uma saída e 2 com saídas parciais.')
    expect(ts(sim.pareamento?.operacoes ?? [])).toEqual(ts(conferir(mapear('f16t'), 'f16t').pareamento?.operacoes ?? []))

    const nao = conferir(comFimDoArquivo(m, 'MESZ6', 'no'), 'f16ta')
    expect(nao.perguntasFim[0].nota).toBe('O arquivo começou com 1 contrato comprado, de antes dele: a venda que o fecha fica de fora.')
    expect(nao.pareamento?.resumo).toBe('Viram 5 operações: 4 com uma saída e 1 com saídas parciais.')
    expect(t(nao.pareamento?.primeira)).toBe('1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.819,50 e de 1 a 6.821,00: +US$ 80,00.')
    expect(ts(nao.pareamento?.operacoes ?? [])).toEqual([
      '13 out, 10:31 · MESZ6 · compra de 2 a 6.812,25 · saídas de 1 a 6.819,50 e de 1 a 6.821,00 · +US$ 80,00',
      '13 out, 11:02 · MNQZ6 · compra de 1 a 25.240,75 · saída de 1 a 25.244,50 · +US$ 7,50',
      '13 out, 11:05 · MNQZ6 · compra de 1 a 25.236,00 · saída de 1 a 25.244,50 · +US$ 17,00',
      '13 out, 11:20 · MESZ6 · venda de 2 a 6.821,00 · saída de 2 a 6.817,25 · +US$ 37,50',
      '13 out, 11:31 · MESZ6 · compra de 1 a 6.823,75 · saída de 1 a 6.824,50 · +US$ 3,75',
    ])
  })

  it('16 · Binance: crypto units, «Em BTCUSDT, supomos …»; the question and the pairing per answer', () => {
    const m = mapear('f16b')
    const naoSei = conferir(m, 'f16b')
    expect(linhas(naoSei)).toEqual([
      '11 out, 00:05 · BTCUSDT · compra · 0,0125 BTC · 112.400,00',
      '11 out, 00:20 · ETHUSDT · compra · 0,1000 ETH · 4.120,50',
      '11 out, 00:21 · BTCUSDT · venda · 0,0125 BTC · 112.952,00',
    ])
    expect(naoSei.notas).toEqual([R2, 'Em BTCUSDT, supomos que o arquivo começa sem posição aberta.'])
    expect(naoSei.perguntasFim[0]).toMatchObject({
      texto: 'No fim do arquivo, ETHUSDT ficou posicionado?',
      sub: 'Pelas execuções do arquivo, sobram 0,1 ETH comprados.',
      nota: 'As 3 execuções de ETHUSDT ficaram de fora: as compras e as vendas do arquivo não fecham.',
    })
    const B1 = '11 out, 00:05 · BTCUSDT · compra de 0,0125 a 112.400,00 · saída de 0,0125 a 112.952,00 · +US$ 6,90'
    const B2 = '12 out, 14:05 · BTCUSDT · compra de 0,0200 a 113.180,00 · saídas de 0,0100 a 113.420,00 e de 0,0100 a 113.005,00 · +US$ 0,65'
    const PRIMEIRA = '1ª operação: BTCUSDT, compra de 0,0125 a 112.400,00; saída de 0,0125 a 112.952,00: +US$ 6,90.'
    expect([naoSei.pareamento?.resumo, t(naoSei.pareamento?.primeira), naoSei.pareamento?.entradas]).toEqual([
      'Viram 2 operações: 1 com uma saída e 1 com saídas parciais.',
      PRIMEIRA,
      null,
    ])
    expect(ts(naoSei.pareamento?.operacoes ?? [])).toEqual([B1, B2])

    const sim = conferir(comFimDoArquivo(m, 'ETHUSDT', 'yes'), 'f16b')
    expect(sim.perguntasFim[0].nota).toBe(
      'A posição ainda aberta fica de fora (1 execução) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
    )
    expect([sim.pareamento?.resumo, t(sim.pareamento?.primeira)]).toEqual(['Viram 3 operações: 2 com uma saída e 1 com saídas parciais.', PRIMEIRA])
    expect(ts(sim.pareamento?.operacoes ?? [])).toEqual([B1, '11 out, 00:20 · ETHUSDT · compra de 0,1000 a 4.120,50 · saída de 0,1000 a 4.135,00 · +US$ 1,45', B2])

    const nao = conferir(comFimDoArquivo(m, 'ETHUSDT', 'no'), 'f16b')
    expect(nao.perguntasFim[0].nota).toBe('O arquivo começou com 0,1 ETH vendidos, de antes dele: a compra que fecha essa venda fica de fora.')
    expect([nao.pareamento?.resumo, t(nao.pareamento?.primeira)]).toEqual(['Viram 3 operações: 2 com uma saída e 1 com saídas parciais.', PRIMEIRA])
    expect(ts(nao.pareamento?.operacoes ?? [])).toEqual([B1, '11 out, 01:02 · ETHUSDT · venda de 0,1000 a 4.135,00 · saída de 0,1000 a 4.108,00 · +US$ 2,70', B2])
    expect(nao.modelo?.nome).toBe('Binance')
  })

  it('16 · Interactive Brokers: shares, the sign gives the side, only R2 («Abre ou fecha»), «Ver as 2 operações»', () => {
    const v = conferir(mapear('f16i'), 'f16i')
    expect(linhas(v)).toEqual([
      '14 out, 09:45 · MSFT · venda · 50 ações · 512,30',
      '14 out, 10:15 · NVDA · compra · 300 ações · 187,42',
      '14 out, 10:33 · NVDA · venda · 300 ações · 188,10',
    ])
    expect(v.notas).toEqual([R2])
    expect(v.perguntasFim).toEqual([])
    expect([v.pareamento?.resumo, t(v.pareamento?.primeira), v.pareamento?.ver]).toEqual([
      'Viram 2 operações: 1 com uma saída e 1 com saídas parciais.',
      '1ª operação: NVDA, compra de 300 a 187,42; saída de 300 a 188,10: +US$ 204,00.',
      'Ver as 2 operações',
    ])
    expect(ts(v.pareamento?.operacoes ?? [])).toEqual([
      '14 out, 10:15 · NVDA · compra de 300 a 187,42 · saída de 300 a 188,10 · +US$ 204,00',
      '14 out, 11:12 · AAPL · venda de 100 a 247,80 · saídas de 60 a 246,95 e de 40 a 247,10 · +US$ 79,00',
    ])
    expect(v.modelo?.nome).toBe('Interactive Brokers')
  })

  it('two «Conta» values read together: one question per account («MESZ6 (LT50K-0193)»), the answer under the composite key', () => {
    const m = mapear('f16c')
    const v = conferir(m, 'f16c')
    expect(v.perguntasFim.map((q) => [q.texto, q.chave, q.sub])).toEqual([
      ['No fim do arquivo, MESZ6 (LT50K-0193) ficou posicionado?', endOfFileKey('MESZ6', 'LT50K-0193'), 'Pelas execuções do arquivo, sobra 1 contrato comprado.'],
      ['No fim do arquivo, MESZ6 (LT50K-0194) ficou posicionado?', endOfFileKey('MESZ6', 'LT50K-0194'), 'Pelas execuções do arquivo, sobra 1 contrato comprado.'],
    ])
    expect(v.pareamento).toEqual({ resumo: 'Nenhuma operação: todas as execuções ficaram de fora.', primeira: null, entradas: null, ver: null, operacoes: [] })
    // «Sim» for LT50K-0193: its open buy stays out (1 execution of that account)
    const sim = conferir(comFimDoArquivo(m, endOfFileKey('MESZ6', 'LT50K-0193'), 'yes'), 'f16c')
    expect(sim.perguntasFim[0].nota).toBe(
      'A posição ainda aberta fica de fora (1 execução) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
    )
    expect(sim.pareamento?.resumo).toBe('Vira 1 operação, com uma saída.')
    // «conferir» reads every account even with a value chosen (§6.7)
    expect(conferir({ ...comFimDoArquivo(m, endOfFileKey('MESZ6', 'LT50K-0193'), 'yes'), accountValue: 'LT50K-0194' }, 'f16c').perguntasFim).toHaveLength(2)
  })

  it('E29: a file the mapping cannot make (mixed clocks) shows the alert in place of the rows, and blocks', () => {
    const texto = ['Time,Symbol,Side,Qty,Price', '2026-10-11T00:05:12Z,BTCUSDT,BUY,0.01,112400.00', '2026-10-11 00:21:40,BTCUSDT,SELL,0.01,112952.00'].join('\n')
    const v = vistaConferir(mapearTexto(texto, 'crypto'), 'crypto')
    const texto29 = 'Este arquivo mistura horários com e sem fuso: não dá para pôr as execuções em ordem.'
    expect([v.falha, v.linhas, v.bloqueio, v.pareamento]).toEqual([texto29, [], texto29, null])
    expect(CONFERIR.falha('too_many_rows')).toBe('O arquivo passa de 5.000 saídas.')
  })

  it('a model taken as is that starts here (16 ending positioned + «Tradovate»): the chip, no model block', () => {
    const v = conferir(mapear('f16ta', [modeloTradovate()]), 'f16ta')
    expect([v.chipModelo, v.modelo]).toEqual(['Tradovate', null])
    expect(v.perguntasFim).toHaveLength(1)
  })
})

describe('«conferir» · the forms the board does not draw (N)', () => {
  /** An invented execution file, read as one execution per row */
  const exec = (market: AccountMarket, linhasTexto: string[], cab = 'Time,Symbol,Side,Qty,Price') =>
    comModo(mapearTexto([cab, ...linhasTexto].join('\n'), market), 'fill', market)

  it('«Confira 2 linhas», «Confira a linha»', () => {
    const f8 = ARQUIVOS_QUADRO.f8.texto.split('\r\n')
    expect(vistaConferir(mapearTexto(f8.slice(0, 3).join('\n'), 'futures'), 'futures').titulo).toBe('Confira 2 linhas')
    expect(vistaConferir(mapearTexto(f8.slice(0, 2).join('\n'), 'futures'), 'futures').titulo).toBe('Confira a linha')
  })

  it('three rows of one position: «A 1ª, a 2ª e a 3ª linhas …»', () => {
    const p = ARQUIVOS_QUADRO.f8p.texto.split('\n')
    const terceira = 'MESZ6,1,6820.00,6821.00,$5.00,10/13/2026 11:33:02,10/13/2026 11:20:14,12min,9912013,9912010'
    const v = vistaConferir(mapearTexto([p[0], p[1], p[2], terceira].join('\n'), 'futures', 'Tradovate'), 'futures')
    expect(v.notas).toEqual(['A 1ª, a 2ª e a 3ª linhas têm a mesma entrada: viram uma operação com 3 saídas.'])
  })

  it('one operation; several positions with several entries', () => {
    const uma = exec('futures', ['2026-10-13 10:31:05,MESZ6,Buy,1,6812.25', '2026-10-13 10:38:40,MESZ6,Sell,1,6816.00'])
    expect(vistaConferir(uma, 'futures').pareamento).toMatchObject({ resumo: 'Vira 1 operação, com uma saída.', ver: 'Ver a operação' })
    const parcial = exec('futures', ['2026-10-13 10:31:05,MESZ6,Buy,2,6812.25', '2026-10-13 10:38:40,MESZ6,Sell,1,6816.00', '2026-10-13 10:44:12,MESZ6,Sell,1,6819.50'])
    expect(vistaConferir(parcial, 'futures').pareamento?.resumo).toBe('Vira 1 operação, com saídas parciais.')
    const duas = exec('futures', [
      '2026-10-13 10:31:05,MESZ6,Buy,1,6812.25',
      '2026-10-13 10:32:05,MESZ6,Buy,1,6813.25',
      '2026-10-13 10:38:40,MESZ6,Sell,2,6816.00',
      '2026-10-13 11:31:05,MNQZ6,Buy,1,25240.75',
      '2026-10-13 11:32:05,MNQZ6,Buy,1,25241.75',
      '2026-10-13 11:38:40,MNQZ6,Sell,2,25250.00',
    ])
    expect(vistaConferir(duas, 'futures').pareamento?.entradas).toBe('2 posições com mais de uma entrada viraram 4 operações, uma por entrada.')
  })

  it('E24 by market and count: one execution left out; several open; part of an execution open; «que os fecha»; shares; lots', () => {
    // One execution of the symbol
    const so = exec('futures', ['2026-10-13 10:31:05,MESZ6,Buy,1,6812.25'])
    expect(vistaConferir(so, 'futures').perguntasFim[0].nota).toBe('1 execução de MESZ6 ficou de fora: as compras e as vendas do arquivo não fecham.')
    // Two open at the end, «Sim»: both executions, exactly the leftover
    const duas = exec('futures', ['2026-10-13 10:31:05,MESZ6,Buy,1,6812.25', '2026-10-13 10:41:05,MESZ6,Buy,1,6813.25'])
    const v2 = vistaConferir(comFimDoArquivo(duas, 'MESZ6', 'yes'), 'futures')
    expect(v2.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobram 2 contratos comprados.')
    expect(v2.perguntasFim[0].nota).toBe(
      'A posição ainda aberta fica de fora (2 execuções) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
    )
    // Buy 3, sell 2, «Sim»: the lot still open stays out whole with the exit it had, so both executions (review 2 · 2)
    const parte = exec('futures', ['2026-10-13 10:31:05,MESZ6,Buy,3,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,2,6815.25'])
    const vp = vistaConferir(comFimDoArquivo(parte, 'MESZ6', 'yes'), 'futures')
    expect(vp.perguntasFim[0].nota).toBe(
      'A posição ainda aberta fica de fora (2 execuções) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
    )
    expect(vp.pareamento?.resumo).toBe('Nenhuma operação: todas as execuções ficaram de fora.')
    // Sold 2 left over, «Não»: the file began with 2 bought
    const vendeu = exec('futures', ['2026-10-13 10:31:05,MESZ6,Sell,2,6812.25'])
    const vv = vistaConferir(comFimDoArquivo(vendeu, 'MESZ6', 'no'), 'futures')
    expect(vv.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobram 2 contratos vendidos.')
    expect(vv.perguntasFim[0].nota).toBe('O arquivo começou com 2 contratos comprados, de antes dele: a venda que os fecha fica de fora.')
    // Shares
    const acoes = exec('stocks', ['2026-10-14 10:31:05,AAPL,Buy,2,247.80', '2026-10-14 10:41:05,AAPL,Sell,1,248.00', '2026-10-14 10:51:05,AAPL,Sell,2,248.10'])
    const va = vistaConferir(comFimDoArquivo(acoes, 'AAPL', 'no'), 'stocks')
    expect(va.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobra 1 ação vendida.')
    expect(va.perguntasFim[0].nota).toBe('O arquivo começou com 1 ação comprada, de antes dele: a venda que a fecha fica de fora.')
    expect(linhas(va)[0]).toBe('14 out, 10:31 · AAPL · compra · 2 ações · 247,80')
    const muitas = exec('stocks', ['2026-10-14 10:31:05,AAPL,Buy,5,247.80'])
    expect(vistaConferir(comFimDoArquivo(muitas, 'AAPL', 'no'), 'stocks').perguntasFim[0]).toMatchObject({
      sub: 'Pelas execuções do arquivo, sobram 5 ações compradas.',
      nota: 'O arquivo começou com 5 ações vendidas, de antes dele: a compra que fecha essa venda fica de fora.',
    })
    // Lots
    const lotes = exec('forex', ['2026-10-14 10:31:05,EURUSD,Buy,0.50,1.08520', '2026-10-14 10:41:05,EURUSD,Sell,0.25,1.08600'])
    const vl = vistaConferir(lotes, 'forex')
    expect(vl.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobra 0,25 lote comprado.')
    expect(linhas(vl)[0]).toBe('14 out, 10:31 · EURUSD · compra · 0,50 lote · 1,08520')
    const muitosLotes = exec('forex', ['2026-10-14 10:31:05,EURUSD,Sell,2.5,1.08520'])
    expect(vistaConferir(comFimDoArquivo(muitosLotes, 'EURUSD', 'no'), 'forex').perguntasFim[0]).toMatchObject({
      sub: 'Pelas execuções do arquivo, sobram 2,50 lotes vendidos.',
      nota: 'O arquivo começou com 2,50 lotes comprados, de antes dele: a venda que os fecha fica de fora.',
    })
  })

  it('the net evidence with a swap: «P − C − S = F» (net), «F antes do swap.» (gross, swap only)', () => {
    const cab = 'Position ID,Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Swap,Commission,Profit'
    const liquido = mapearTexto([cab, '1,14.10.2026 08:40:12,14.10.2026 10:05:47,EURUSD,BUY,0.50,1.08520,1.08635,-1.00,-3.50,53.00'].join('\n'), 'forex')
    expect(t(vistaConferir(liquido, 'forex').liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: +US$ 57,50 − US$ 3,50 − US$ 1,00 = +US$ 53,00.')
    const cabS = 'Position ID,Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Swap,Profit'
    const bruto = mapearTexto([cabS, '1,14.10.2026 08:40:12,14.10.2026 10:05:47,EURUSD,BUY,0.50,1.08520,1.08635,-1.00,57.50'].join('\n'), 'forex')
    const v = vistaConferir(bruto, 'forex')
    expect(v.liquido?.texto).toBe('O resultado do arquivo já tem o swap?')
    expect(t(v.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: +US$ 57,50 antes do swap.')
  })
})

describe('the mode switch on «conferir»: Tradovate read as one trade per row', () => {
  it('the trade order line', () => {
    const m = comModo(mapear('f16t'), 'trade' as RowKind, 'futures')
    expect(vistaConferir(m, 'futures').ordem).toBe('Entrada · Ativo · Lado · Quantidade · Resultado (pelos preços)')
  })
})

describe('copyMapa.ts', () => {
  const fonte = fs.readFileSync(path.join(__dirname, '../../components/hub/importar/copyMapa.ts'), 'utf8')

  it('no prototype label, no «exemplo», no stale board copy (E58)', () => {
    for (const s of [
      'Cenário do protótipo',
      'Erro:',
      'Arquivo:',
      'Recomeçar',
      'Modo escuro',
      'fora do produto',
      'exemplo',
      'No protótipo',
      '(no protótipo)',
      'Informe por contrato',
      'Seguir bruto',
      'A conta fica marcada “bruto”',
      'CSV, Excel ou HTML',
      'Lembrar para os próximos arquivos deste modelo',
      'Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.',
    ]) {
      expect(fonte).not.toContain(s)
    }
  })

  it('every key carries its marker (B, A or N) in a comment', () => {
    const blocos = fonte.split(/\nexport /).slice(1)
    let chaves = 0
    for (const b of blocos) {
      const m = /^(?:const|interface) (\w+)/.exec(b)
      if (!m || m[1] === 'SobraTexto') continue
      // A record with one marker over the whole of it (CAMPO, NOTA_MAPA.semResultado)
      const corpo = b.replace(/semResultado: \{[\s\S]*?\} as Record<AccountMarket, string>,/, 'semResultado: 0,')
      const marcadoNoTopo = /^\s*$/.test('') && m[1] === 'CAMPO'
      if (marcadoNoTopo) {
        expect(fonte).toMatch(/\/\*\* B IC l\.1155–1164[^\n]*\*\/\nexport const CAMPO/)
        continue
      }
      const keys = Array.from(corpo.matchAll(/^ {2}(?:\/\*\*[\s\S]*?\*\/\s*)?(\w+):/gm)).map((x) => x[1])
      for (const k of keys) {
        chaves++
        expect(corpo).toMatch(new RegExp(`/\\*\\*\\s*(?:\\*\\s*)?[BAN]\\b(?:(?!\\*/)[\\s\\S])*\\*/\\s*${k}:`))
      }
    }
    expect(chaves).toBeGreaterThan(150)
  })
})

// ------------------------------------------------------------------------------------------------
// Reviews 1 and 2 of lane L1: each fix, and the forms the mutation review found untested
// ------------------------------------------------------------------------------------------------

/** An invented execution file, read as one execution per row */
const execucoes = (market: AccountMarket, linhasTexto: string[], cab = 'Time,Symbol,Side,Qty,Price') =>
  comModo(mapearTexto([cab, ...linhasTexto].join('\n'), market), 'fill', market)

describe('review 1 · 1: «Lado» on a column that is no side column shows its check, never a question per value', () => {
  const NAO_LADO = 'Esta coluna não parece compra e venda.'

  it('8 · Data/Hora → «Lado»: the check alone (the board, IC l.1440)', () => {
    const m = comColuna(mapear('f8'), 0, 'side', 'futures')
    const v = mapa(m, 'f8')
    expect(v.colunas[0].checagem).toBe(NAO_LADO)
    expect(v.perguntasLado).toEqual([])
    expect(v.duplicadas).toBe('Lado está em mais de uma coluna.')
  })

  it('8 · Papel → «Lado» (C/V ignored): the check alone, no «10 linhas trazem “MESZ6” …»', () => {
    const m = comColuna(comColuna(mapear('f8'), 2, 'ignorar', 'futures'), 1, 'side', 'futures')
    const v = mapa(m, 'f8')
    expect(v.colunas[1].checagem).toBe(NAO_LADO)
    expect(v.perguntasLado).toEqual([])
    expect(v.bloqueio).toBe('Marque as colunas obrigatórias.')
  })

  it('19 · the file’s own C/V still asks about «X»; a side column of unknown words is asked about too', () => {
    expect(mapa(mapear('f19'), 'f19').perguntasLado.map((q) => q.texto)).toEqual(['2 linhas trazem “X” na coluna de lado. O que quer dizer?'])
    const texto = ['Entry Time,Exit Time,Symbol,Side,Qty,Profit', '2026-10-13 10:31:05,2026-10-13 10:32:05,MESZ6,Kauf,1,5.00', '2026-10-13 10:41:05,2026-10-13 10:42:05,MESZ6,Verkauf,1,-2.50'].join('\n')
    const m = comColuna(mapearTexto(texto, 'futures'), 3, 'side', 'futures')
    const v = vistaMapa(m, null, 'futures')
    expect(v.colunas[3].checagem).toBe(NAO_LADO)
    expect(v.perguntasLado.map((q) => q.texto)).toEqual([
      '1 linha traz “Kauf” na coluna de lado. O que quer dizer?',
      '1 linha traz “Verkauf” na coluna de lado. O que quer dizer?',
    ])
  })
})

describe('review 1 · 2: «Mudar» → a decimal the file contradicts gives the note only', () => {
  it.each([
    ['f8', 'futures'],
    ['f19', 'b3'],
  ] as const)('%s · «ponto»: the chip, the note, the hint; no check under the number columns; every requirement still ✓', (k, mk) => {
    const v = mapa(comDecimal(mapear(k), 'point', mk), k)
    expect(v.lerTexto).toBe('Separador: ponto e vírgula · decimal ponto')
    expect(v.notaLer).toBe('Os números não fecharam com este decimal. Confira.')
    expect(v.colunas.map((c) => c.checagem)).toEqual(v.colunas.map(() => null))
    expect(v.obrigatorias.every((r) => r.ok)).toBe(true)
    expect(v.bloqueio).toBe('Confira como ler o arquivo.')
  })
})

describe('review 2 · 2: E24’s nota counts what the domain refuses', () => {
  const SIM = (n: string) => `A posição ainda aberta fica de fora (${n}) e entra quando você importar um arquivo que tenha a abertura e o fechamento.`

  it('«Sim» with partial exits or several entries: every execution of the open position, as the domain refuses them', () => {
    // Buy 2, Sell 1, Buy 1: both lots still open stay out whole, with the sale that took part of the first
    const m = execucoes('futures', ['2026-10-13 10:31:05,MESZ6,Buy,2,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,1,6815.25', '2026-10-13 10:51:05,MESZ6,Buy,1,6816.25'])
    const v = vistaConferir(comFimDoArquivo(m, 'MESZ6', 'yes'), 'futures')
    expect(v.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobram 2 contratos comprados.')
    expect(v.perguntasFim[0].nota).toBe(SIM('3 execuções'))
    expect(v.pareamento?.resumo).toBe('Nenhuma operação: todas as execuções ficaram de fora.')
  })

  it('«Sim» where only part of an execution stays open (a sale that closes and opens): «A parte ainda aberta …»', () => {
    const m = execucoes('futures', ['2026-10-13 10:31:05,MESZ6,Buy,1,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,2,6815.25'])
    const v = vistaConferir(comFimDoArquivo(m, 'MESZ6', 'yes'), 'futures')
    expect(v.perguntasFim[0].nota).toBe(
      'A parte ainda aberta da posição (1 contrato) fica de fora e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
    )
    expect(v.pareamento?.resumo).toBe('Vira 1 operação, com uma saída.')
  })

  it('«Não» where only part of the closing execution stays out: «a parte da venda …», «a parte da compra …»', () => {
    // Sell 2, Buy 1: the sale closes the 1 bought before the file and opens 1 sold, which the purchase closes
    const vendeu = execucoes('futures', ['2026-10-13 10:31:05,MESZ6,Sell,2,6812.25', '2026-10-13 10:41:05,MESZ6,Buy,1,6810.25'])
    const v = vistaConferir(comFimDoArquivo(vendeu, 'MESZ6', 'no'), 'futures')
    expect(v.perguntasFim[0].nota).toBe('O arquivo começou com 1 contrato comprado, de antes dele: a parte da venda que o fecha fica de fora.')
    expect(t(v.pareamento?.primeira)).toBe('1ª operação: MESZ6, venda de 1 a 6.812,25; saída de 1 a 6.810,25: +US$ 10,00.')
    // Buy 2, Sell 1: the file began with 1 sold
    const comprou = execucoes('futures', ['2026-10-13 10:31:05,MESZ6,Buy,2,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,1,6815.25'])
    expect(vistaConferir(comFimDoArquivo(comprou, 'MESZ6', 'no'), 'futures').perguntasFim[0].nota).toBe(
      'O arquivo começou com 1 contrato vendido, de antes dele: a parte da compra que fecha essa venda fica de fora.',
    )
    // Shares, feminine
    const acoes = execucoes('stocks', ['2026-10-14 10:31:05,AAPL,Sell,2,247.80', '2026-10-14 10:41:05,AAPL,Buy,1,247.50'])
    expect(vistaConferir(comFimDoArquivo(acoes, 'AAPL', 'no'), 'stocks').perguntasFim[0].nota).toBe(
      'O arquivo começou com 1 ação comprada, de antes dele: a parte da venda que a fecha fica de fora.',
    )
  })

  it('two «Conta» values both «Sim»: each nota counts its own account’s executions', () => {
    const m = comFimDoArquivo(comFimDoArquivo(mapear('f16c'), endOfFileKey('MESZ6', 'LT50K-0193'), 'yes'), endOfFileKey('MESZ6', 'LT50K-0194'), 'yes')
    expect(conferir(m, 'f16c').perguntasFim.map((q) => q.nota)).toEqual([SIM('1 execução'), SIM('1 execução')])
  })
})

describe('review 2 · 4: the forms the mutation review found untested', () => {
  it('a loss in parentheses without a currency: «“(13.75)” é perda: lemos como −13,75.»', () => {
    const texto = ['Entry Time,Exit Time,Symbol,Side,Qty,Profit', '2026-10-13 10:31:05,2026-10-13 10:32:05,MESZ6,Buy,1,5.00', '2026-10-13 10:41:05,2026-10-13 10:42:05,MESZ6,Sell,1,(13.75)'].join('\n')
    expect(vistaMapa(mapearTexto(texto, 'futures'), null, 'futures').notas).toContain('“(13.75)” é perda: lemos como −13,75.')
  })

  it('Forex: «lote» below 2, «lotes» from 2, in the rows and in the sub', () => {
    const rows = execucoes('forex', ['2026-10-14 10:31:05,EURUSD,Buy,1.99,1.08520', '2026-10-14 10:41:05,EURUSD,Buy,2.00,1.08600'])
    const v = vistaConferir(rows, 'forex')
    expect(linhas(v).map((l) => (l as string).split(' · ')[3])).toEqual(['1,99 lote', '2,00 lotes'])
    expect(v.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobram 3,99 lotes comprados.')
    const dois = vistaConferir(execucoes('forex', ['2026-10-14 10:31:05,EURUSD,Sell,2,1.08520']), 'forex')
    expect(dois.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobram 2,00 lotes vendidos.')
    const menos = vistaConferir(execucoes('forex', ['2026-10-14 10:31:05,EURUSD,Buy,1.5,1.08520']), 'forex')
    expect(menos.perguntasFim[0].sub).toBe('Pelas execuções do arquivo, sobra 1,50 lote comprado.')
  })

  it('«Sem coluna de lado: …» only while no column is «Lado» (IBKR with AssetClass set to «Lado»)', () => {
    const SEM_LADO = 'Sem coluna de lado: quantidade positiva é compra, negativa é venda.'
    const m = mapear('f16i')
    expect(mapa(m, 'f16i').notas).toContain(SEM_LADO)
    expect(mapa(comColuna(m, 5, 'side', 'stocks'), 'f16i').notas).not.toContain(SEM_LADO)
  })

  it('the evidence’s line counts from the header (a title line above it): «na 1ª linha»', () => {
    const f8 = ARQUIVOS_QUADRO.f8.texto.split('\r\n')
    const m = mapearTexto(['Relatório de operações BlackArrow', ...f8].join('\n'), 'futures', 'BlackArrow')
    expect([m.lido.headerSkip, m.lido.headerLine]).toEqual([1, 2])
    const v = vistaConferir(m, 'futures')
    expect(t(v.liquido?.nota)).toBe('Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.')
  })

  it('a merged execution’s average price shows with the column’s decimals («6.812,50», not its 8)', () => {
    const m = execucoes('futures', ['2026-10-13 10:31:05,MESZ6,Buy,1,6812.25', '2026-10-13 10:31:05,MESZ6,Buy,1,6812.75', '2026-10-13 10:41:05,MESZ6,Sell,2,6815.00'])
    const v = vistaConferir(m, 'futures')
    expect(t(v.pareamento?.primeira)).toBe('1ª operação: MESZ6, compra de 2 a 6.812,50; saída de 2 a 6.815,00: +US$ 25,00.')
  })

  it('quantities: an execution of 0 is no execution (skipped), one the mapping cannot read is shown; a signed 0 has no side', () => {
    const m = execucoes('futures', ['2026-10-13 10:31:05,MESZ6,Buy,0,6812.25', '2026-10-13 10:41:05,MESZ6,Buy,abc,6812.50', '2026-10-13 10:51:05,MESZ6,Sell,1,6815.00'])
    expect(linhas(vistaConferir(m, 'futures')).map((l) => (l as string).split(' · ')[3])).toEqual(['abc', '1 contrato'])
    const texto = ['Entry Time,Exit Time,Symbol,Qty,Profit', '2026-10-13 10:31:05,2026-10-13 10:32:05,MESZ6,-1,5.00', '2026-10-13 10:41:05,2026-10-13 10:42:05,MESZ6,0,0.00', '2026-10-13 10:51:05,2026-10-13 10:52:05,MESZ6,2,2.50'].join('\n')
    expect(linhas(vistaConferir(mapearTexto(texto, 'futures'), 'futures')).map((l) => (l as string).split(' · ')[2])).toEqual(['venda', '—', 'compra'])
  })
})
