/**
 * Phase 3b · telas: the pt-BR strings of the column-mapping steps («mapa», «conferir», the model chip),
 * from the approved board ImportarConta (canvas version 67). Each string carries its marker:
 *   B  the board's exact copy (IC l.N = a line of ImportarConta.dc.html)
 *   A  adapted from the board (the comment says why)
 *   N  new: on no board (the comment says why)
 * B0 holds the keys both lanes use; lane L1 adds the rest (LER, REQ, NOTA_MAPA, CHECAGEM, PERGUNTA,
 * FIM_ARQUIVO, PAREAMENTO, LIQUIDO) and never renames a key or a CAMPO label (lane L2 imports them).
 */
import type { FieldKey } from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'

export const MAPA = {
  /** B IC l.1485 */ titulo: 'Não reconhecemos este arquivo. Diga o que é cada coluna.',
  /** B IC l.1484 */ tituloMudou: (nome: string) => `Este arquivo mudou desde o modelo “${nome}”. Confira as colunas.`,
  /** B IC l.1485 */ tituloMudar: (nome: string) => `Mude as colunas do modelo “${nome}”.`,
  /** B IC l.540 */ modo: 'Cada linha do arquivo é',
  /** B IC l.540 */ modoOperacao: 'uma operação (entrada e saída)',
  /** B IC l.540 */ modoExecucao: 'uma execução (compra ou venda)',
}

export const CONFERIR = {
  /** B IC l.555 */ titulo: 'Confira 3 linhas',
  /** N: a file of two records (E21) */ tituloDuas: 'Confira 2 linhas',
  /** N: a file of one record (E21) */ tituloUma: 'Confira a linha',
  /** B IC l.1921 */ usar: 'Usar estas colunas',
  /** B IC l.1606 */ ordemOperacao: 'Entrada · Ativo · Lado · Quantidade · Resultado',
  /** B IC l.1606: the order line without a result column */ ordemPelosPrecos: 'Entrada · Ativo · Lado · Quantidade · Resultado (pelos preços)',
  /** B IC l.1606 */ ordemExecucao: 'Data e hora · Ativo · Lado · Quantidade · Preço',
  /** B IC l.1555 */ compra: 'compra',
  /** B IC l.1555 */ venda: 'venda',
  /** B IC l.1573 */ contrato: (q: string) => `${q} contrato`,
  /** B IC l.1573 */ contratos: (q: string) => `${q} contratos`,
  /** B IC l.1570 */ lote: (q: string) => `${q} lote`,
  /** B IC l.1570 */ lotes: (q: string) => `${q} lotes`,
  /** B IC l.1571 */ acao: (q: string) => `${q} ação`,
  /** B IC l.1571 */ acoes: (q: string) => `${q} ações`,
  /** B IC l.1572: a crypto quantity, «0,0125 BTC» */ moeda: (q: string, ativo: string) => `${q} ${ativo}`,
  /** B IC l.1583 */ pelosPrecos: 'pelos preços',
  /** B IC l.1583 */ comPelosPrecos: (valor: string) => `${valor} pelos preços`,
  /** B IC l.1587: a value the mapping cannot read */ vazio: '—',
  /** B IC l.779 */ executada: 'Confira: a quantidade é a executada e o horário é o da execução, não o da ordem.',
  /** B IC l.780 */ semPosicao: 'Supomos que o arquivo começa sem posição aberta.',
  /** B IC l.781 */ semPosicaoEm: (simbolos: string) => `Em ${simbolos}, supomos que o arquivo começa sem posição aberta.`,
  /**
   * B IC l.1132 for «A 1ª e a 2ª linhas … com 2 saídas»; N for the other rows of the three («A 1ª, a 2ª e a 3ª …»)
   */
  mesmaEntrada: (linhas: string, saidas: number) => `${linhas} linhas têm a mesma entrada: viram uma operação com ${saidas} saídas.`,
  /** N (E29): the mapping cannot make the file */
  falha: (code: string): string =>
    code === 'mixed_clocks'
      ? 'Este arquivo mistura horários com e sem fuso: não dá para pôr as execuções em ordem.'
      : code === 'too_many_rows'
        ? 'O arquivo passa de 5.000 saídas.'
        : 'Não conseguimos ler o arquivo com estas colunas.',
  /** N (E28): the net question with no answer */ responda: 'Responda a pergunta sobre o resultado do arquivo.',
}

export const DICA_MAPA = {
  /** B IC l.1477 */ ler: 'Confira como ler o arquivo.',
  /** B IC l.1478 */ datas: 'Escolha a ordem das datas.',
  /** N: a decimal question with nothing pressed (a «,» file) */ numeros: 'Escolha como ler os números.',
  /** B IC l.1479 */ obrigatorias: 'Marque as colunas obrigatórias.',
  /** B IC l.1480 */ umaColuna: 'Cada campo vai em uma coluna só.',
  /** B IC l.1481 */ marcadas: 'Confira as colunas marcadas.',
  /** B IC l.1482 */ lado: (valor: string) => `Diga o que quer dizer “${valor}”.`,
}

export const MODELO = {
  /** A (D1): the default name when the account's platform says nothing about the file */ nomePadrao: 'Minha plataforma',
  /** B IC l.1614 */ salvar: 'Salvar como modelo',
  /** B IC l.1614 */ atualizar: (nome: string) => `Atualizar o modelo “${nome}”`,
  /** B IC l.570 */ nome: 'Nome do modelo',
  /** B IC l.571 */ nota: 'O modelo guarda os nomes das colunas e as suas escolhas, nunca as operações.',
  /**
   * N (owner decision, 23 Oct): a model of another market whose columns changed, under «Atualizar o modelo “{nome}”»
   * (unchecked: a new model is saved under «Nome do modelo»)
   */
  outroMercado: (nome: string, mercados: string) =>
    `O modelo “${nome}” é de ${mercados}. Sem atualizá-lo, estas colunas viram um modelo novo.`,
  /** N (owner decision, 23 Oct): a model of another market with the file's very columns: never written, no checkbox */
  outroMercadoExato: (nome: string, mercados: string) =>
    `O modelo “${nome}” é de ${mercados} e fica como está: as mudanças valem só para este arquivo.`,
  /** N: the model's markets could not be read */
  outroMercadoDesconhecido: 'outro mercado',
}

export const CHIP_MODELO = {
  /** B IC l.1705 */ texto: (nome: string) => `Colunas do modelo “${nome}”`,
  /** B IC l.366 */ mudar: 'Mudar colunas',
}

/** B IC l.1155–1164 (`NV.CAMPOS`): the select's labels; also L2's «número inválido em {CAMPO[campo]}» (§3.3) */
export const CAMPO: Record<FieldKey, string> = {
  entry_time: 'Entrada (data e hora)',
  symbol: 'Ativo',
  side: 'Lado',
  quantity: 'Quantidade',
  pnl: 'Resultado',
  entry_price: 'Preço de entrada',
  exit_price: 'Preço de saída',
  exit_time: 'Saída (data e hora)',
  buy_time: 'Compra (data e hora)',
  sell_time: 'Venda (data e hora)',
  buy_price: 'Preço de compra',
  sell_price: 'Preço de venda',
  commission: 'Comissão',
  fee: 'Outra taxa (soma na comissão)',
  swap: 'Swap ou funding',
  stop: 'Stop',
  target: 'Alvo',
  trade_id: 'ID da operação (evita duplicar)',
  account: 'Conta',
  time: 'Data e hora',
  price: 'Preço',
  fill_id: 'ID da execução (evita duplicar)',
  order_id: 'ID da ordem',
  open_close: 'Abre ou fecha',
  realized: 'Resultado realizado',
}

/** «Separador: … · decimal …», «Datas: …», «Mudar» and its panel (E8–E10) */
export const LER = {
  /** B IC l.1488 */ separador: (nome: string) => `Separador: ${nome}`,
  /** B IC l.1488 */ comDecimal: (separador: string, decimal: string) => `${separador} · decimal ${decimal}`,
  /** B IC l.1439 (the aria label in lower case) */ nomePontoEVirgula: 'ponto e vírgula',
  /** B IC l.1439 */ nomeVirgula: 'vírgula',
  /** B IC l.1439 */ nomeTabulacao: 'tabulação',
  /** B IC l.1488 */ decimalVirgula: 'vírgula',
  /** B IC l.1488 */ decimalPonto: 'ponto',
  /** B IC l.1489 */ datas: (ordem: string) => `Datas: ${ordem}`,
  /** B IC l.1489, 1493 */ diaMes: 'dia/mês',
  /** B IC l.1489, 1493 */ mesDia: 'mês/dia',
  /** B IC l.530 */ mudar: 'Mudar',
  /** B IC l.533 */ rotSeparador: 'Separador',
  /** B IC l.534 */ rotDecimal: 'Decimal',
  /** B IC l.535 */ rotDatas: 'Datas',
  /** B IC l.1439 */ pillPontoEVirgula: ';',
  /** B IC l.1439 */ pillVirgula: ',',
  /** B IC l.1439 */ pillTab: 'Tab',
  /** B IC l.1439 */ ariaPontoEVirgula: 'Ponto e vírgula',
  /** B IC l.1439 */ ariaVirgula: 'Vírgula',
  /** B IC l.1439 */ ariaTabulacao: 'Tabulação',
  /** B IC l.1445 */ notaSeparador: 'Com este separador, as linhas não têm o mesmo número de colunas do cabeçalho.',
  /** B IC l.1446 */ notaDecimal: 'Os números não fecharam com este decimal. Confira.',
  /** B IC l.1446 */ notaDatas: 'Com esta ordem, há datas que não existem. Confira.',
}

/** «Obrigatórias» and the optional fields (E14) */
export const REQ = {
  /** B IC l.541 */ titulo: 'Obrigatórias',
  /** B IC l.1416 */ entrada: 'Entrada',
  /** B IC l.1416 */ entradaPar: 'Entrada (pela compra e venda)',
  /** B IC l.1416 */ ativo: 'Ativo',
  /** B IC l.1414 */ lado: 'Lado',
  /** B IC l.1414 */ ladoPar: 'Lado (pela compra e venda)',
  /** B IC l.1414 */ ladoSinal: 'Lado (ou quantidade com sinal)',
  /** B IC l.1416 */ quantidade: 'Quantidade',
  /** B IC l.1417 */ resultado: 'Resultado (ou os preços)',
  /** B IC l.1418 */ dataHora: 'Data e hora',
  /** B IC l.1418 */ preco: 'Preço',
  /** B IC l.1499 */ ok: (rotulo: string) => `${rotulo} ✓`,
  /** B IC l.1499 */ falta: (rotulo: string) => `${rotulo} · falta`,
  /** B IC l.1500 («, Swap ou funding» only where the market has it) */
  opcionaisOperacao: (swap: boolean) =>
    `Opcionais: Saída, Comissão, Outra taxa${swap ? ', Swap ou funding' : ''}, Stop, Alvo, ID da operação (evita duplicar), Conta. Sem coluna de lado, marque Compra e Venda (data e hora) e o preço de cada uma.`,
  /** B IC l.1501 */
  opcionaisExecucao: 'Opcionais: Comissão, Outra taxa, ID da execução (evita duplicar), ID da ordem, Abre ou fecha, Resultado realizado, Conta.',
}

/** The notes of «mapa» (E15), in the board's order */
export const NOTA_MAPA = {
  /** B IC l.1465 */
  execucao:
    'Juntamos as compras e vendas de cada ativo em operações: cada compra que abre ou aumenta a posição vira uma operação, e as vendas fecham primeiro as compras mais antigas. Na venda a descoberto, é o mesmo, ao contrário.',
  /** B IC l.1466 */ semLado: 'Sem coluna de lado: quantidade positiva é compra, negativa é venda.',
  /** B IC l.1467 */
  compraVenda: 'Com a compra e a venda em colunas, a entrada é a que veio primeiro: comprou primeiro, é compra; vendeu primeiro, é venda.',
  /** B IC l.1168–1176 (`MERC.resNota`); binárias never map a file (the futures text stands in) */
  semResultado: {
    futures: 'Sem coluna de resultado, calculamos pelos preços só nos contratos que conhecemos: ES, MES, NQ, MNQ, GC, MGC, CL e MCL.',
    binary: 'Sem coluna de resultado, calculamos pelos preços só nos contratos que conhecemos: ES, MES, NQ, MNQ, GC, MGC, CL e MCL.',
    forex:
      'Sem coluna de resultado, calculamos pelos preços: exato em EURUSD, GBPUSD, AUDUSD e NZDUSD; estimado pela cotação de saída nos pares que começam com USD. Nos outros pares, marque uma coluna de resultado.',
    stocks: 'Sem coluna de resultado, calculamos pelos preços. Opções ficam de fora: registre no Registrar.',
    options: 'Sem coluna de resultado, calculamos pelos preços. Opções ficam de fora: registre no Registrar.',
    crypto: 'Sem coluna de resultado, calculamos pelos preços só nos pares em dólar (USDT, USDC ou USD).',
    b3: 'Sem coluna de resultado, calculamos pelos preços só nos contratos e ações que conhecemos (WIN, IND, WDO, DOL e as ações da lista).',
  } as Record<AccountMarket, string>,
  /** B IC l.1469 */ semSaida: 'Sem hora de saída, o resultado conta no limite do dia na hora da entrada.',
  /** B IC l.1470 */ semId: 'Sem coluna de ID, reconhecemos a reimportação pela mesma hora e preço.',
  /** B IC l.1094 for «UTC»; N for another offset («UTC+1», «UTC−3», «UTC+5:30») */
  fusoDaColuna: (coluna: string, fuso: string) => `A coluna ${coluna} já diz o fuso: os horários entram em ${fuso}.`,
  /** B IC l.1123 */
  decimalPelos: (marca: string, decide: string, ambigua: string, valor: string) =>
    `Decimal ${marca} pelos valores como “${decide}”: “${ambigua}” é ${valor}.`,
  /** B IC l.1131 */ perda: (celula: string, valor: string) => `“${celula}” é perda: lemos como ${valor}.`,
  /** B IC l.1131 for two columns; N for one («não serve de ID») and for three or more («nenhuma delas») */
  idsRepetem: (nomes: string[]): string =>
    nomes.length === 1
      ? `${nomes[0]} se repete de uma linha para outra: não serve de ID.`
      : nomes.length === 2
        ? `${nomes[0]} e ${nomes[1]} se repetem de uma linha para outra: nenhuma das duas serve de ID sozinha.`
        : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} se repetem de uma linha para outra: nenhuma delas serve de ID sozinha.`,
  /** B IC l.1472 */ sugerimos: 'Já sugerimos pelo nome de cada coluna. Confira.',
}

/** One row per column (E16, E17) */
export const CHECAGEM = {
  /** B IC l.546 */ escolha: 'Escolha…',
  /** B IC l.1160, 1164 */ ignorar: 'Ignorar esta coluna',
  /** B IC l.546 */ amostra: (celula: string) => `ex.: ${celula}`,
  /** B IC l.546: every cell of the column empty */ vazia: '—',
  /** B IC l.1508 */ sugerida: 'sugerida',
  /** B IC l.1508 */ nova: 'nova',
  /** B IC l.1507 */ aria: (nome: string) => `O que é a coluna ${nome}`,
  /** B IC l.1421 */ naoData: 'Esta coluna não parece data e hora.',
  /** B IC l.1421 */ naoNumero: 'Esta coluna não parece número.',
  /** B IC l.1421 */ naoLado: 'Esta coluna não parece compra e venda.',
  /** B IC l.1427 */ swap: 'Swap ou funding vai junto com a coluna de resultado.',
  /** B IC l.1428 */ repete: 'Esta coluna repete valores: não serve de ID.',
  /** B IC l.1474 («Quantidade, Ativo estão …») */
  duplicadas: (rotulos: string[]) => `${rotulos.join(', ')} ${rotulos.length === 1 ? 'está' : 'estão'} em mais de uma coluna.`,
}

/** The questions of «mapa» (E11, E12, E18) */
export const PERGUNTA = {
  /** B IC l.1454 */ datas: 'As datas podem ser dia/mês ou mês/dia. Qual é?',
  /** B IC l.1454 («dia/mês (09.10 = 9 out)») */ dataDiaMes: (trecho: string, data: string) => `dia/mês (${trecho} = ${data})`,
  /** B IC l.1454 («mês/dia (09.10 = 10 set)») */ dataMesDia: (trecho: string, data: string) => `mês/dia (${trecho} = ${data})`,
  /** B IC l.1458 */ decimal: 'Como ler os números deste arquivo?',
  /** B IC l.1458 («“131.250” é 131250 (ponto separa milhar)») */
  leitura: (amostra: string, valor: string, parenteses: string) => `“${amostra}” é ${valor} (${parenteses})`,
  /** N: a reading that is not a number (a sample the other mark cannot read) */ leituraSo: (amostra: string, parenteses: string) => `“${amostra}”: ${parenteses}`,
  /** B IC l.1458 */ pontoMilhar: 'ponto separa milhar',
  /** B IC l.1458 */ pontoDecimal: 'ponto é decimal',
  /** N: a «,» sample */ virgulaDecimal: 'vírgula é decimal',
  /** N: a «,» sample */ virgulaMilhar: 'vírgula separa milhar',
  /** B IC l.1447 («o WIN fica fora do passo (de 5 em 5)») */
  decimalPasso: (raiz: string, passo: string) => `Com este decimal, o ${raiz} fica fora do passo (de ${passo} em ${passo}). Confira.`,
  /** B IC l.1461 for «2 linhas trazem …»; N for one row («1 linha traz …») */
  lado: (linhas: number, valor: string) =>
    linhas === 1
      ? `1 linha traz “${valor}” na coluna de lado. O que quer dizer?`
      : `${linhas} linhas trazem “${valor}” na coluna de lado. O que quer dizer?`,
  /** B IC l.1462 */ compra: 'Compra',
  /** B IC l.1462 */ venda: 'Venda',
  /** B IC l.1462 */ pular: 'Pular essas linhas',
}

/** The quantity left at the end of the file, by market (E24's sub and notes) */
export interface SobraTexto {
  /** «1 contrato vendido», «0,1 ETH comprados» */
  texto: string
  /** «sobra» (one) or «sobram» (several) */
  plural: boolean
  /** The noun's gender, for «a venda que o|a|os|as fecha» */
  feminino: boolean
}

/** «No fim do arquivo, {ativo} ficou posicionado?» (E24) */
export const FIM_ARQUIVO = {
  /** B IC l.1593 */ titulo: (simbolo: string) => `No fim do arquivo, ${simbolo} ficou posicionado?`,
  /** N: the question of one «Conta» value among several */
  tituloConta: (simbolo: string, conta: string) => `No fim do arquivo, ${simbolo} (${conta}) ficou posicionado?`,
  /** B IC l.1137 («sobra 1 contrato vendido»), l.1096 («sobram 0,1 ETH comprados»); N for the other markets and counts */
  sub: (s: SobraTexto) => `Pelas execuções do arquivo, ${s.plural ? 'sobram' : 'sobra'} ${s.texto}.`,
  /** B IC l.1594 */ sim: 'Sim, ficou posicionado',
  /** B IC l.1594 */ nao: 'Não, terminou zerado',
  /** B IC l.1594 */ naoSei: 'Não sei',
  /** B IC l.1097, 1138 for several; N for one («1 execução de {ativo} ficou de fora: …») */
  notaNaoSei: (execucoes: number, simbolo: string) =>
    execucoes === 1
      ? `1 execução de ${simbolo} ficou de fora: as compras e as vendas do arquivo não fecham.`
      : `As ${execucoes} execuções de ${simbolo} ficaram de fora: as compras e as vendas do arquivo não fecham.`,
  /** B IC l.782 for one execution; N for several */
  notaSim: (execucoes: number) =>
    `A posição ainda aberta fica de fora (${execucoes} ${execucoes === 1 ? 'execução' : 'execuções'}) e entra quando você importar um arquivo que tenha a abertura e o fechamento.`,
  /** N: only part of an execution stays open (the domain counts no line for it) */
  notaSimParte: (sobra: string) =>
    `A parte ainda aberta da posição (${sobra}) fica de fora e entra quando você importar um arquivo que tenha a abertura e o fechamento.`,
  /** B IC l.1098 («0,1 ETH vendidos»): the file began sold; the purchase that closes it stays out */
  notaNaoVendido: (inicio: string) => `O arquivo começou com ${inicio}, de antes dele: a compra que fecha essa venda fica de fora.`,
  /**
   * B IC l.1139 («1 contrato comprado … a venda que o fecha»): the file began bought; N for the plural («que os fecha»)
   * and the feminine («1 ação comprada … que a fecha»)
   */
  notaNaoComprado: (s: SobraTexto) =>
    `O arquivo começou com ${s.texto}, de antes dele: a venda que ${s.feminino ? (s.plural ? 'as' : 'a') : s.plural ? 'os' : 'o'} fecha fica de fora.`,
  /** N: the file began sold and only part of a purchase closes it (the rest of that purchase opens a position, kept) */
  notaNaoVendidoParte: (inicio: string) => `O arquivo começou com ${inicio}, de antes dele: a parte da compra que fecha essa venda fica de fora.`,
  /** N: the file began bought and only part of a sale closes it (the rest of that sale opens a position, kept) */
  notaNaoCompradoParte: (s: SobraTexto) =>
    `O arquivo começou com ${s.texto}, de antes dele: a parte da venda que ${s.feminino ? (s.plural ? 'as' : 'a') : s.plural ? 'os' : 'o'} fecha fica de fora.`,
}

/** The pairing summary of an execution file (E25) */
export const PAREAMENTO = {
  /** B IC l.887 («Viram 4 operações: 2 com uma saída e 2 com saídas parciais.»); a zero part is dropped (B IC l.1142) */
  resumo: (n: number, uma: number, parciais: number): string => {
    if (n === 0) return 'Nenhuma operação: todas as execuções ficaram de fora.' // N
    if (n === 1) return uma === 1 ? 'Vira 1 operação, com uma saída.' : 'Vira 1 operação, com saídas parciais.' // N
    const partes = [uma > 0 ? `${uma} com uma saída` : '', parciais > 0 ? `${parciais} com saídas parciais` : ''].filter(Boolean)
    return `Viram ${n} operações: ${partes.join(' e ')}.`
  },
  /** B IC l.888 («1ª operação: MESZ6, compra de 2 a 6.812,25; saídas de 1 a 6.816,00 e de 1 a 6.819,50: +US$ 55,00.») */
  primeira: (simbolo: string, abertura: string, saidas: string, resultado: string) => `1ª operação: ${simbolo}, ${abertura}; ${saidas}: ${resultado}.`,
  /** B IC l.878 («compra de 2 a 6.812,25») */ abertura: (lado: string, q: string, preco: string) => `${lado} de ${q} a ${preco}`,
  /** B IC l.879 («saída de 1 a 25.244,50») */ saida: (q: string, preco: string) => `saída de ${q} a ${preco}`,
  /** B IC l.878 («saídas de 1 a 6.816,00 e de 1 a 6.819,50»); three or more «…, de … e de …» */
  saidas: (partes: string[]) => `saídas ${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`,
  /** B IC l.878 («de 1 a 6.816,00») */ deA: (q: string, preco: string) => `de ${q} a ${preco}`,
  /** B IC l.886 for one position; N for several («2 posições … viraram …») */
  entradas: (posicoes: number, operacoes: number) =>
    posicoes === 1
      ? `1 posição com mais de uma entrada virou ${operacoes} operações, uma por entrada.`
      : `${posicoes} posições com mais de uma entrada viraram ${operacoes} operações, uma por entrada.`,
  /** B IC l.1612 */ ver: (n: number) => (n === 1 ? 'Ver a operação' : `Ver as ${n} operações`),
  /** B IC l.878 («13 out, 10:31 · MESZ6 · compra de 2 a 6.812,25 · saídas … · +US$ 55,00») */
  item: (quando: string, simbolo: string, abertura: string, saidas: string, resultado: string) =>
    `${quando} · ${simbolo} · ${abertura} · ${saidas} · ${resultado}`,
}

/** «O resultado do arquivo já desconta a comissão?» (E26) */
export const LIQUIDO = {
  /** B IC l.1601 */ comissao: 'O resultado do arquivo já desconta a comissão?',
  /** B IC l.1600 */ comissaoSwap: 'O resultado do arquivo já tem a comissão e o swap?',
  /** B IC l.1600 */ swap: 'O resultado do arquivo já tem o swap?',
  /** B IC l.1601 */ sim: 'Sim, é líquido',
  /** B IC l.1601 */ nao: 'Não, é bruto',
  /** B IC l.1083 («−US$ 37,50 − US$ 2,48 = −US$ 39,98») */
  conferidoLiquido: (linha: number, precos: string, custos: string, arquivo: string) =>
    `Conferido pelos preços na ${linha}ª linha: ${precos} − ${custos} = ${arquivo}.`,
  /** N: a net result with a swap («P − C + S = F», a negative swap written «− US$ 1,00») */
  conferidoLiquidoSwap: (linha: number, precos: string, custos: string, swapNegativo: boolean, swap: string, arquivo: string) =>
    `Conferido pelos preços na ${linha}ª linha: ${precos} − ${custos} ${swapNegativo ? '−' : '+'} ${swap} = ${arquivo}.`,
  /** B IC l.1114 («+US$ 17,00 antes da comissão de US$ 1,24») */
  conferidoBruto: (linha: number, arquivo: string, custos: string) => `Conferido pelos preços na ${linha}ª linha: ${arquivo} antes da comissão de ${custos}.`,
  /** N: a gross result whose only cost is the swap */
  conferidoBrutoSwap: (linha: number, arquivo: string) => `Conferido pelos preços na ${linha}ª linha: ${arquivo} antes do swap.`,
}
