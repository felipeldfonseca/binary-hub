/**
 * Every pt-BR string of Suas contas, the account selector and the import sheet, in one place so
 * the owner can review them. Strings come from the approved boards (Personalizar #contas,
 * ImportarConta, DiarioHojeEnxuto) unless marked:
 *   NEW      not on any board (screens or states the boards do not draw)
 *   ADAPTED  a board string changed for Phase 1 (the comment says what changed)
 * Phase 3b additions use the telas contract markers: B (the board ImportarConta, IC l.N), A (adapted), N (new).
 */
import type { FieldKey, ImportMarket } from '@/lib/domain/import'
import { MARKET_SPEC, currencyOf } from '@/lib/domain/markets'
import type { AccountMarket, AccountPhase, ZoneKey } from '@/lib/hub/contas'
import { ALL_FILE_ZONES, LABEL_MAX, MARKET_ORDER } from '@/lib/hub/contas'
import type { HubErrorCode } from '@/lib/hub/contasDb'
import { SIMBOLO_MOEDA, formatInt } from '@/lib/hub/formato'
import { MERCADO, USDT_COMO_DOLAR, viraODia } from '@/components/hub/copyMercados'
import { CAMPO } from '@/components/hub/importar/copyMapa'

// ------------------------------------------------------------------------------------------------
// Shared
// ------------------------------------------------------------------------------------------------

/** Group headers, chips and the selector (Fase 2b: copyMercados MERCADO[m].nome, values unchanged) */
export const MARKET_LABEL: Record<AccountMarket, string> = Object.fromEntries(
  MARKET_ORDER.map((m) => [m, MERCADO[m].nome]),
) as Record<AccountMarket, string>

export const PHASE_LABEL: Record<AccountPhase, string> = {
  avaliacao: 'Avaliação',
  financiada: 'Financiada',
  pessoal: 'Pessoal',
  demo: 'Demo', // NEW (the schema allows it; no board names it)
}

export const PLATFORM_LABEL: Record<string, string> = {
  tradovate: 'Tradovate',
  rithmic: 'Rithmic',
  ninja: 'NinjaTrader',
  topstepx: 'TopstepX',
  quantower: 'Quantower',
  tradingview: 'TradingView',
  blackarrow: 'BlackArrow', // NEW (owner's default, 2026-10-18: Top One Futures and three other firms offer it)
  wealthcharts: 'WealthCharts', // NEW (same decision)
  naosei: 'Não sei',
  ebinex: 'Ebinex',
  pocket: 'Pocket Option',
  iq: 'IQ Option',
  outra: 'Outra',
  topone: 'Top One', // NEW (key the old imports left on the Top One account)
  // Fase 2b (board ImportarConta `X.PLAT`): Forex
  mt5: 'MetaTrader 5',
  mt4: 'MetaTrader 4',
  ctrader: 'cTrader',
  matchtrader: 'Match-Trader',
  tradelocker: 'TradeLocker',
  dxtrade: 'DXtrade',
  // Cripto
  binance: 'Binance',
  bybit: 'Bybit',
  okx: 'OKX',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
  bitget: 'Bitget',
  mercadobitcoin: 'Mercado Bitcoin',
  // Ações e opções (EUA)
  ibkr: 'Interactive Brokers',
  thinkorswim: 'thinkorswim (Schwab)',
  webull: 'Webull',
  tastytrade: 'tastytrade',
  tradier: 'Tradier',
  avenue: 'Avenue',
  nomad: 'Nomad',
  // B3
  profit: 'Profit (Nelogica)',
  tryd: 'Tryd',
}

export const platformLabel = (key: string | null) => (key ? PLATFORM_LABEL[key] ?? key : '')

export const ZONE_LABEL: Record<ZoneKey, string> = {
  ny: 'Nova York (ET)',
  br: 'Brasília',
  utc: 'UTC',
  chi: 'Chicago (CT)',
  lon: 'Londres',
}

/** A zone's name on screen; a zone the import does not offer shows its IANA name. */
export const zoneName = (tz: string) => {
  const key = ALL_FILE_ZONES.find((z) => z.tz === tz)?.key
  return key ? ZONE_LABEL[key] : tz
}

export const NEVER_SUMMED = 'Contas de mercados diferentes nunca são somadas.' // Fase 2b (board ImportarConta l.242, Personalizar l.353)
export const LOADING = 'Carregando…'
export const TRY_AGAIN = 'Tentar de novo'
export const UNDO = 'Desfazer'
export const undoAria = (text: string) => `Desfazer: ${text}`
export const CANCEL = 'Cancelar'
export const CLOSE = 'Fechar'
export const OPTIONAL = '· opcional'
export const CHOOSE = 'Escolha…'
export const IMPORT_FILE = 'Importar arquivo'
export const ADD_ACCOUNT = '+ Adicionar conta'
export const BUSY = 'Um momento…' // NEW (status while a request runs)

export const ops = (n: number) => `${formatInt(n)} ${n === 1 ? 'operação' : 'operações'}`
export const n = formatInt

// ------------------------------------------------------------------------------------------------
// Personalizar · Suas contas
// ------------------------------------------------------------------------------------------------

export const PERSONALIZAR = {
  title: 'Personalizar',
  sub: 'Ajuste o Binary Hub às suas contas e ao que você opera.',
}

const INFO_CONTAS_ANTES =
  'Uma linha por conta. Cada conta é de um mercado só, com janela, limite e regras próprias. Arquivar vale na hora, guarda o histórico e pode ser desfeito. O Binary Hub não se conecta à sua corretora: as operações chegam por arquivo ou à mão. Por enquanto, lemos o CSV da Ebinex e o Trade History da Top One.'
const INFO_CONTAS_DEPOIS =
  'O relatório do MetaTrader sai em HTML ou PDF, não em CSV: vai precisar de um leitor próprio, que vem depois. O resultado fica na moeda da conta: R$ na B3; US$ nos outros mercados, com USDT e USDC contados como dólar.'

export const CONTAS = {
  title: 'Suas contas',
  sub: 'Cada conta é de um mercado só e tem as suas regras.',
  infoAria: 'Como ler: Suas contas',
  // ADAPTED (board Personalizar `D.txt.infoContas`, Fase 2b): "Duplicar e arquivar valem na hora;
  // arquivar guarda…" → archive only (no duplicate yet); the sentences about the Apex examples and
  // copy groups are dropped, as in Phase 1.
  // Fase 3 (D19; 3-4 ended D36): the four markets register. Phase 3b (A, quadro §4.2): the CSV mapping is here,
  // so «… e, em breve, também por um CSV…» drops «em breve»
  info: `${INFO_CONTAS_ANTES} Nas contas de Forex, de Ações, de Cripto e da B3, as operações entram pelo “Registrar operação” e também por um CSV em que você diz o que é cada coluna. ${INFO_CONTAS_DEPOIS}`,
  /**
   * Under the group of a market whose files the app cannot read yet (board Personalizar
   * `g.semLeitorTxt`). Fase 3 (D19; 3-4 ended D36): the interim phase name is gone (ADAPTED)
   */
  semLeitor: (market: AccountMarket) => `Ainda não lemos arquivos ${MERCADO[market].de}: as operações entram pelo “Registrar operação”.`,
  empty: 'Traga o histórico da sua corretora.',
  importShort: 'Importar',
  importAria: (label: string) => `Importar arquivo para ${label}`,
  moreAria: (label: string) => `Mais ações: ${label}`,
  menuAria: (label: string) => `Ações de ${label}`,
  menuImport: IMPORT_FILE,
  menuEdit: 'Editar conta', // NEW
  menuBatches: 'Importações', // NEW
  menuArchive: 'Arquivar',
  onlyImported: 'só histórico importado',
  noTrades: 'sem operações',
  registered: (count: number) => `${formatInt(count)} op. registradas`, // NEW (trades typed on the old pages)
  archived: (label: string) => `${label} arquivada: o histórico fica guardado.`,
  closed: (count: number) => `Encerradas (${formatInt(count)})`,
  closedNone: 'Nenhuma. Arquivar guarda o histórico e pode ser desfeito.',
  archivedOn: (day: string) => `Arquivada em ${day}`,
  historyKept: 'histórico mantido',
  reactivate: 'Reativar',
  reactivateAria: (label: string) => `Reativar ${label}`,
  loadError: 'Não foi possível carregar as contas.', // NEW
}

// ------------------------------------------------------------------------------------------------
// Editar conta (no board: follows the inline form of Suas contas)
// ------------------------------------------------------------------------------------------------

export const EDITAR = {
  title: (label: string) => `Editar ${label}`, // NEW
  label: 'Apelido',
  needLabel: 'Dê um apelido.',
  phase: 'Fase',
  type: 'Tipo',
  personal: 'Pessoal',
  firm: 'Mesa', // NEW (the board only has the chip "Mesa: {x}")
  ref: 'Número na plataforma',
  /** «Tamanho US$», «Tamanho R$» (NEW for R$: Editar conta follows step b) */
  size: (simbolo: string) => `Tamanho ${simbolo}`,
  primary: 'Conta principal', // NEW
  primaryNote: 'Abre primeiro quando nenhuma conta foi escolhida.', // NEW
  zone: 'Fuso do arquivo',
  zoneUnconfirmed: 'A confirmar. Escolha o fuso que a plataforma usa nos arquivos.', // NEW
  save: 'Salvar', // NEW
  saved: (label: string) => `${label} salva.`, // NEW
  zoneConfirmed: (zone: string) => `Fuso confirmado: ${zone}.`,
  confirmZone: 'Confirmar fuso',
  // NEW: an old nickname can be longer than the field allows; a change must fit, never cut silently
  labelTooLong: `Use no máximo ${LABEL_MAX} caracteres.`,
}

/** "N operações mudam de horário (+3 h) e M mudam de dia." The owner's wording. */
export function fixTzLine(changed: number, shifts: string[], dayChanges: number): string {
  if (changed === 0) return 'Nenhuma operação muda de horário.' // NEW
  const shift = shifts.length > 0 ? ` (${shifts.join(' ou ')})` : ''
  const first = changed === 1 ? `1 operação muda de horário${shift}` : `${formatInt(changed)} operações mudam de horário${shift}`
  if (dayChanges === 0) return `${first}.`
  return `${first} e ${formatInt(dayChanges)} ${dayChanges === 1 ? 'muda' : 'mudam'} de dia.`
}

/** NEW: trades whose file stated its own offset are never moved by a zone fix */
export const fixTzUntouched = (count: number) =>
  count === 1 ? '1 operação traz o fuso no arquivo e não muda.' : `${formatInt(count)} operações trazem o fuso no arquivo e não mudam.`

// ------------------------------------------------------------------------------------------------
// Importações of an account (no board)
// ------------------------------------------------------------------------------------------------

export const IMPORTACOES = {
  title: (label: string) => `Importações de ${label}`, // NEW
  empty: 'Nenhuma importação nesta conta.', // NEW
  legacy: 'Histórico anterior', // NEW (owner's name for the batch of the old imports)
  legacyNote: 'não dá para desfazer', // NEW
  noName: 'arquivo sem nome', // NEW
  inserted: (count: number) => `${formatInt(count)} novas`,
  /**
   * NEW (Fase 3, D29): trades registered in the app that the batch completed (import_batches
   * .rows_linked); undoing gives them back
   */
  linked: (count: number) => (count === 1 ? '1 já registrada por você' : `${formatInt(count)} já registradas por você`),
  duplicate: (count: number) => `${formatInt(count)} já estavam`,
  completed: (count: number) => `${formatInt(count)} completadas`, // NEW
  other: (count: number) => `${formatInt(count)} em outra conta`, // NEW
  errors: (count: number) => `${formatInt(count)} com erro`,
  undoneOn: (day: string) => `Desfeita em ${day}`, // NEW
  undo: UNDO,
  undoAria: (when: string) => `Desfazer a importação de ${when}`, // NEW
  /**
   * NEW. Fase 3 (D29): a batch that completed trades registered in the app also says that undoing
   * gives them back (import_undo reverts what it wrote, reopens what it closed, never deletes them)
   */
  confirm: (count: number, linked = 0) => {
    if (linked === 0) {
      return count === 1 ? 'Desfazer apaga a operação desta importação.' : `Desfazer apaga as ${formatInt(count)} operações desta importação.`
    }
    if (count === 0) {
      return linked === 1
        ? 'Desfazer não apaga nada: a operação registrada por você volta a ser como estava antes desta importação.'
        : `Desfazer não apaga nada: as ${formatInt(linked)} operações registradas por você voltam a ser como estavam antes desta importação.`
    }
    const apaga = count === 1 ? 'Desfazer apaga a operação desta importação' : `Desfazer apaga as ${formatInt(count)} operações desta importação`
    return linked === 1
      ? `${apaga}, e a registrada por você volta a ser como estava antes dela.`
      : `${apaga}, e as ${formatInt(linked)} registradas por você voltam a ser como estavam antes dela.`
  },
  /** NEW; «Desfazer» alone when nothing is deleted (a batch that only completed registered trades) */
  confirmYes: (count: number) => (count === 0 ? UNDO : 'Desfazer e apagar'),
  confirmNo: 'Manter', // NEW
  /** NEW; Fase 3 (D29): with the registered trades the batch had completed (`linked`) */
  undone: (deleted: number, linked = 0) => {
    const apagadas = deleted === 1 ? '1 operação apagada' : `${formatInt(deleted)} operações apagadas`
    if (linked === 0) return `Importação desfeita: ${apagadas}.`
    if (deleted === 0) {
      return linked === 1
        ? 'Importação desfeita: a operação registrada por você voltou a ser como estava.'
        : `Importação desfeita: as ${formatInt(linked)} operações registradas por você voltaram a ser como estavam.`
    }
    return linked === 1
      ? `Importação desfeita: ${apagadas}, e a registrada por você voltou a ser como estava.`
      : `Importação desfeita: ${apagadas}, e as ${formatInt(linked)} registradas por você voltaram a ser como estavam.`
  },
}

// ------------------------------------------------------------------------------------------------
// Account selector (Diário version)
// ------------------------------------------------------------------------------------------------

export const SELETOR = {
  prefix: 'Conta: ',
  manage: 'Gerenciar contas',
}

export const DIARIO = {
  title: 'Diário',
  importFile: IMPORT_FILE,
  /** The header's primary action (RegistrarOperacao board RO l.236, `btn pri`), before «Importar arquivo» */
  registrar: 'Registrar operação',
}

// ------------------------------------------------------------------------------------------------
// Import sheet (ImportarConta board)
// ------------------------------------------------------------------------------------------------

export const FOLHA = {
  titleImport: IMPORT_FILE,
  titleAdd: 'Adicionar conta',
  close: CLOSE,
  back: 'Voltar',
  next: 'Continuar',
  done: 'Concluir',
  step: (k: number, total: number) => `Passo ${k} de ${total}`,
  // Closing with unsaved input (NEW: the board closes at once)
  leaveQuestion: 'Fechar sem salvar?', // NEW
  leaveYes: CLOSE,
  leaveNo: 'Continuar aqui', // NEW
}

export const ARQUIVO = {
  infoAria: 'Como ler: arquivo',
  /** B (Phase 3b, IC l.623 `D.infoArq`): both sentences, for every file (readers' too) */
  info: 'Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo. Quando não reconhecemos, você diz o que é cada coluna uma vez e salva como modelo.',
  /** B IC l.1081 «Arquivo não reconhecido · 18 linhas» (N: the singular) */
  naoReconhecido: (count: number) => `Arquivo não reconhecido · ${count === 1 ? '1 linha' : `${formatInt(count)} linhas`}`,
  /** B IC l.1134 «Parecido com o modelo “BlackArrow” · 24 linhas» (N: the singular) */
  parecido: (nome: string, count: number) => `Parecido com o modelo “${nome}” · ${count === 1 ? '1 linha' : `${formatInt(count)} linhas`}`,
  /**
   * B IC l.1085 «Modelo “BlackArrow” · Futuros · 24 operações · 1–15 out»: `quantas` is «{n} operações», or (N) «{n} linhas»
   * for an execution file or a file whose rows are not its trades
   */
  doModelo: (nome: string, mercado: string, quantas: string, dias: string) => [`Modelo “${nome}”`, mercado, quantas, dias].filter(Boolean).join(' · '),
  format: {
    ebinex_br: 'CSV da Ebinex',
    ebinex_mixed: 'CSV da Ebinex',
    ebinex_iso: 'CSV da Ebinex, formato antigo',
    topone: 'Top One Futures · Trade History',
  } as Record<string, string>,
  rows: (count: number) => `${formatInt(count)} linhas`,
  noRows: 'nenhuma linha de operação',
  noAccount: 'o arquivo não diz a conta',
}

export const SOLTE = {
  titleFor: (label: string) => `Importar histórico de ${label}`,
  titleAgain: 'Escolha outro arquivo',
  titleNone: 'Escolha o arquivo', // NEW (opened with no account in context)
  drop: 'Solte para importar',
  kinds: 'CSV', // ADAPTED: the board also lists Excel and HTML, which no reader takes
  choose: 'Escolher arquivo',
  reading: 'Lendo o arquivo…', // NEW
}

export const ERRO = {
  unreadable: 'Não conseguimos ler o arquivo.',
  empty: 'O arquivo não tem operações.',
  again: 'Escolher outro arquivo',
  /**
   * ADAPTED (Phase 3b, IC l.1850 «Arquivo não reconhecido em binárias»): every other market maps an unknown file, so
   * unknown_format reaches this step only in a binaries account
   */
  unknownFormat: 'Em contas de binárias, lemos só o CSV da Ebinex.',
  /** B IC l.1849 «Arquivo que não abre» (the sniff's header_not_found) */
  headerNotFound: 'Não achamos a linha com os nomes das colunas.',
  /** N (Phase 3b): the sniff's too_many_columns */
  tooManyColumns: 'O arquivo passa de 100 colunas.',
  missingColumns: (cols: string[]) => `Faltam colunas: ${cols.join(', ')}.`, // NEW
  duplicateColumns: 'O cabeçalho tem colunas repetidas.', // NEW
  malformed: (line?: number) => (line ? `A linha ${formatInt(line)} tem aspas sem fechar.` : 'O arquivo tem aspas sem fechar.'), // NEW
  tooLarge: 'O arquivo passa de 5 MB.', // NEW
  tooManyRows: 'O arquivo passa de 10.000 operações.', // NEW
  // FROM the approved board of Phase 3b (scenario 9, «Planilha do Excel»)
  spreadsheet: 'Salve como CSV na sua plataforma ou no Excel e tente de novo.',
}

export const PASSO_A = {
  title: 'Para qual conta?',
  newAccount: (market: ImportMarket) => (market === 'futures' ? '+ Nova conta de futuros' : '+ Nova conta de binárias'),
  sameFormat: (label: string) => `${label} já recebeu este formato.`,
}

/** «Para qual conta?» for a file no reader takes (Phase 3b, a2; board IC l.437–447, 1642–1647, 1913–1914) */
export const PASSO_A2 = {
  /** B IC l.439 */ title: 'Para qual conta?',
  /** B IC l.1643 */ nota: 'Não reconhecemos este arquivo: escolha a conta, e depois você diz o que é cada coluna.',
  /** B IC l.444 */ nova: '+ Nova conta',
  /** B IC l.445 */ binarias: 'Contas de binárias recebem só o CSV da Ebinex.',
  /** B IC l.1914 */ hint: 'Escolha a conta.',
}

const eJunto = (items: readonly string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`

/** «N contas neste arquivo» (Phase 3b, hc; board IC l.449–461, 1624–1641, 1912) */
export const PASSO_HC = {
  /** B IC l.451 «2 contas neste arquivo» */ title: (count: number) => `${formatInt(count)} contas neste arquivo`,
  /** B IC l.454 «APX-0001 · 31 op.»: the count part */ ops: (count: number) => `${formatInt(count)} op.`,
  /** N: an execution file counts its executions' lines («LT50K-0193 · 4 linhas») */
  linhas: (count: number) => (count === 1 ? '1 linha' : `${formatInt(count)} linhas`),
  /** B IC l.1633 */ aria: (valor: string) => `O que fazer com ${valor}`,
  /** B IC l.454 */ importarEm: (conta: string) => `Importar em ${conta}`,
  /** B IC l.454 */ naoImportar: 'Não importar',
  /** B IC l.457 */ escolhemos: 'Escolhemos pelo número na plataforma de cada conta.',
  /** B IC l.1638 «O número na plataforma de Apex A é APX-0001.» */
  aviso: (conta: string, numero: string) => `O número na plataforma de ${conta} é ${numero}.`,
  /** B IC l.1639 «Para importar APX-0002, abra a importação na conta dela: …» / «… de cada uma: …» */
  nota: (valores: readonly string[]) =>
    `Para importar ${eJunto(valores)}, abra a importação na conta ${valores.length > 1 ? 'de cada uma' : 'dela'}: o que já entrou não duplica.`,
  /** B IC l.1912 */ hint: (conta: string) => `Escolha qual conta do arquivo vai para ${conta}.`,
  /** B IC l.1636 «APX-0001 passou para “Não importar”.» (N: the plural «passaram») */
  passou: (valores: readonly string[]) =>
    `${eJunto(valores)} ${valores.length > 1 ? 'passaram' : 'passou'} para “Não importar”.`,
}

/**
 * What a market calls the place an account trades on: step b's read-only row (board `X.MK[*].rot`,
 * `formNovo`) and i2's platform group (board `X.MK[*].grupo`; binaries have no group name, the
 * step's heading names it). `options` is never offered: as stocks.
 */
const ONDE: Readonly<Record<AccountMarket, { ro: string; grupo: string }>> = {
  futures: { ro: 'Plataforma', grupo: 'Plataforma' },
  binary: { ro: 'Corretora', grupo: '' },
  forex: { ro: 'Plataforma', grupo: 'Plataforma' },
  stocks: { ro: 'Corretora', grupo: 'Corretora' },
  crypto: { ro: 'Corretora ou plataforma', grupo: 'Corretora ou plataforma' },
  b3: { ro: 'Plataforma', grupo: 'Plataforma' },
  options: { ro: 'Corretora', grupo: 'Corretora' },
}

/** MetaTrader reports (board `FM` relMT): neither the file readers nor the CSV mapping read them */
const RELATORIO_MT: Readonly<Record<string, string>> = {
  mt5: 'O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.',
  mt4: 'O relatório do MetaTrader 4 sai em HTML e vai precisar de um leitor próprio, que vem depois.',
}

export const PASSO_B = {
  title: (market: AccountMarket) => MERCADO[market].titulo,
  label: 'Apelido',
  phase: 'Fase',
  type: 'Tipo',
  personal: 'Pessoal',
  /** «Tamanho US$», «Tamanho R$» (board: `Tamanho {{ B.moeda }}`) */
  size: (simbolo: string) => `Tamanho ${simbolo}`,
  ref: 'Número na plataforma',
  roFile: 'Arquivo',
  /** The read-only row's label: «Plataforma», «Corretora», «Corretora ou plataforma» */
  roLabel: (market: AccountMarket) => ONDE[market].ro,
  roFirmPlatform: 'Mesa e plataforma',
  // Fase 2b: markets without a file reader (board `B.temMoedaDia`, `B.moedaDia`, `B.infoMoeda`)
  moedaDia: 'Moeda e virada do dia',
  moedaDiaAria: 'Como ler: moeda e virada do dia',
  /**
   * ADAPTED (board `X.MK[*].dia`): «US$ · o dia vira às 17:00 ET (18:00 em Brasília hoje)»; the
   * Brasília time is today's (lib/hub/regrasConta viradaEmBrasilia: 19:00 after 1 Nov), and a day
   * that turns on Brasília's clock has none. «R$ · o dia vira à meia-noite de Brasília».
   */
  moedaDiaValor: (market: AccountMarket, emBrasilia: string | null) =>
    `${SIMBOLO_MOEDA[currencyOf(market)]} · o dia vira ${viraODia(MARKET_SPEC[market].day)}${emBrasilia ? ` (${emBrasilia} em Brasília hoje)` : ''}`,
  /** The ⓘ: crypto counts USDT and USDC as dollars; with a firm, the firm's own reset */
  moedaDiaInfo: (market: AccountMarket, comMesa: boolean) =>
    `${market === 'crypto' ? `${USDT_COMO_DOLAR} ` : ''}A moeda e a virada do dia ficam fixas nesta conta.${
      comMesa ? ' O limite do dia é a sua regra: a mesa pode zerar o dela em outro horário.' : ''
    }`,
  roFirmFile: 'Mesa e arquivo', // NEW (a Top One file starts the account with its firm)
  fileTopOne: 'Trade History',
  fileEbinex: 'Ebinex · arquivo CSV',
  platformTbd: 'plataforma a escolher',
  create: (label: string) => `Criar ${label}`,
  createAndGo: (label: string) => `Criar ${label} e continuar`,
  createFallback: 'Criar conta',
  needLabel: 'Dê um apelido à conta.',
  needPhase: 'Escolha a fase.',
  labelTaken: 'Já existe uma conta com esse apelido.',
  badSize: 'Use só números, como 50.000.', // NEW (proposed in the spec, not on the board)
}

export const PASSO_I1 = {
  title: 'Qual mercado?',
  note: 'Cada conta é de um mercado só.',
  hint: 'Escolha o mercado.',
  /**
   * Under the pills, for a market whose files the app cannot read yet (board `I1.nota`). Fase 3 (D19;
   * 3-4 ended D36): the interim phase name is gone (ADAPTED)
   */
  semLeitor: (market: AccountMarket) =>
    `Ainda não lemos arquivos ${MERCADO[market].de}: as operações desta conta entram pelo “Registrar operação”.`,
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** '2026-10-18' → «outubro de 2026» */
const mesDe = (checked: string) => `${MESES[Number(checked.slice(5, 7)) - 1]} de ${checked.slice(0, 4)}`

/**
 * The rule of a market's featured firms (board `X.MK[*].infoMesa`); only futures and forex feature
 * firms. `checked` (lib/hub/mesas PROP_FIRMS_CHECKED, YYYY-MM-DD) gives «vistas em outubro de 2026».
 */
const REGRA_DAS_MESAS: Partial<Record<AccountMarket, (visto: string) => string>> = {
  futures: (visto) =>
    `Mesas de futuros com nota 4 ou mais e pelo menos 50 avaliações verificadas na Prop Firm Match, vistas em ${visto}, mais a Apex Trader Funding, em ordem alfabética.`,
  forex: (visto) =>
    `Mesas de forex com nota 4,4 ou mais e pelo menos 100 avaliações verificadas na Prop Firm Match, vistas em ${visto}, em ordem alfabética.`,
}

/** «Nada com esse nome …» when neither a firm nor a platform answers the search (board `X.MK[*].semAchar`, `I2.vazio`) */
const SEM_ACHAR: Readonly<Record<AccountMarket, string>> = {
  futures: 'Nada com esse nome na lista de mesas e plataformas.',
  binary: 'Nada com esse nome. Escolha “Outra” e siga.',
  forex: 'Nada com esse nome na lista de mesas e plataformas.',
  stocks: 'Nada com esse nome na lista de mesas e corretoras.',
  crypto: 'Nada com esse nome na lista de mesas e corretoras.',
  b3: 'Nada com esse nome na lista de plataformas.',
  options: 'Nada com esse nome na lista de mesas e corretoras.',
}

/** Next to the firm's chip while no platform is chosen (board `X.MK[*].agora`) */
const AGORA: Readonly<Record<AccountMarket, string>> = {
  futures: 'Agora escolha a plataforma.',
  binary: 'Agora escolha a plataforma.',
  forex: 'Agora escolha a plataforma.',
  stocks: 'Agora escolha a corretora.',
  crypto: 'Agora escolha a corretora ou a plataforma.',
  b3: 'Agora escolha a plataforma.',
  options: 'Agora escolha a corretora.',
}

export const PASSO_I2 = {
  title: 'Onde você opera?',
  search: 'Busque mesa, corretora ou plataforma',
  /** Futures and forex ADAPTED from «…na lista de plataformas.» in Phase 2: the search covers the firms too */
  noMatch: (market: AccountMarket) => SEM_ACHAR[market],
  firmFromSearch: (text: string) => `Usar “${text}” como mesa`,
  firmChip: (firm: string) => `Mesa: ${firm}`,
  removeFirm: 'Tirar',
  removeFirmAria: (firm: string) => `Tirar a mesa ${firm}`,
  nowPlatform: (market: AccountMarket) => AGORA[market],
  iqNote: 'IQ Option não exporta histórico: registre à mão.',
  hint: 'Escolha onde você opera.',
  firmsTitle: 'Mesa', // board: `l-mesas` «Mesa · opcional»
  /** The platform group's name; '' for binaries, whose one group the step's heading names */
  platformsTitle: (market: AccountMarket) => ONDE[market].grupo,
  /** A market with firms and none featured (crypto, stocks, B3), before any search (board markup l.453) */
  firmsNote: 'Opera numa mesa? Digite o nome na busca.',
  firmsInfoAria: 'Como ler: lista de mesas',
  /**
   * The ⓘ of the featured firms: the source, when it was read and the rule; never a firm's score.
   * Null for a market with no featured firm. Board `MESAS()` adds the last two sentences.
   */
  firmsInfo: (market: AccountMarket, checked: string): string | null => {
    const regra = REGRA_DAS_MESAS[market]
    return regra ? `${regra(mesDe(checked))} Não é recomendação nem parceria. A sua não está aqui? Digite o nome.` : null
  },
}

/**
 * «Mesa · plataforma» of an account (step b's read-only row). Next to a firm, the key `topone`
 * (the Top One file, «Top One» alone) reads «Trade History», so an account of «Top One Futures»
 * never reads «Top One Futures · Top One». NEW
 */
export function firmAndPlatform(firm: string | null, platform: string | null): string {
  const name = (firm ?? '').trim()
  const where = name && platform === 'topone' ? PASSO_B.fileTopOne : platformLabel(platform)
  return [name, where].filter(Boolean).join(' · ')
}

/** What the zone step counts: a reader's and a trade file's entries, an execution file's executions (Phase 3b, B IC l.1092) */
export type PalavraFuso = 'entradas' | 'execucoes'
const PALAVRA_FUSO: Readonly<Record<PalavraFuso, string>> = { entradas: 'entradas', execucoes: 'execuções' }

export const PASSO_C = {
  title: 'Em que fuso estão os horários deste arquivo?',
  infoAria: 'Como ler: fuso do arquivo',
  info: 'Cada faixa mostra onde as entradas do arquivo cairiam se os horários estivessem naquele fuso. Escolha o fuso que a plataforma usa. A sua janela não aparece aqui: é ela que depois confere “Fora da sua janela”.',
  /** «No arquivo: entradas 09:31–10:58, sem fuso.»; Phase 3b (B IC l.1092): «No arquivo: execuções 10:31–11:48, sem fuso.» */
  inFile: (palavra: PalavraFuso, span: string) => `No arquivo: ${PALAVRA_FUSO[palavra]} ${span}, sem fuso.`,
  other: 'Outro',
  whichZone: 'Qual fuso?',
  /** «entradas 09:31–10:58 ET» · «execuções 10:31–11:31 ET» · «entradas 10:02–16:40 de Brasília» (Phase 3b, B IC l.768–775) */
  cap: (palavra: PalavraFuso, span: string, relogio: 'ny' | 'br') =>
    `${PALAVRA_FUSO[palavra]} ${span}${relogio === 'ny' ? ' ET' : ' de Brasília'}`,
  capPending: 'escolha o fuso',
  session: 'pregão regular 09:30–16:00 ET',
  /** B IC l.1175 (Phase 3b): the B3's session band */
  sessionB3: 'pregão 09:00–18:30',
  legendFutures: 'Faixas no relógio de Nova York (ET).',
  legendBinary: 'Faixas no relógio de Brasília. Binárias abrem 24 h: sem faixa de pregão.',
  /** B IC l.1169 */ legendForex: 'Faixas no relógio de Nova York (ET). Forex abre 24 h: sem faixa de pregão.',
  /** B IC l.1173 */ legendCrypto: 'Faixas no relógio de Brasília. Cripto abre 24 h: sem faixa de pregão.',
  /** B IC l.1175 */ legendBrasilia: 'Faixas no relógio de Brasília.',
  confirm: 'Confirmar fuso',
  needZone: 'Escolha um fuso para continuar.',
  needOther: 'Escolha qual fuso.',
  /** B IC l.357 (Phase 3b, G2): a mapped file in another zone than the account's imports */
  recusaTitulo: 'Este fuso é diferente do fuso das importações desta conta.',
  /** B IC l.1128 */ recusa: (conta: string) => `Este arquivo usa outro relógio que o das importações de ${conta}. Confira o fuso na plataforma.`,
  /** B IC l.1902 */ recusaDica: (zona: string) => `Use o fuso das importações da conta: ${zona}.`,
}

/** NEW step: the dry-run count before a file zone is confirmed (owner's decision, no board) */
export const PASSO_CONF = {
  title: (zone: string) => `Confirmar fuso: ${zone}`, // NEW
  beforeImport: (label: string) => `Antes de importar, confirme o fuso das operações que já estão em ${label}.`, // NEW
  remember: 'Vale também para os próximos arquivos desta conta.',
  confirm: 'Confirmar fuso',
}

export const PASSO_D = {
  title: 'Prévia',
  undone: (label: string) => `Importação desfeita: nada ficou em ${label}.`,
  lines: 'linhas',
  fresh: 'novas',
  otherAccount: 'em outra conta', // ADAPTED: the board names the account ("em Top One"); the preview only counts them
  alreadyId: 'já estavam (mesmo ID)',
  already: 'já estavam',
  errors: 'com erro',
  // NEW: Phase 1 has no "Mover para esta conta" (the import functions leave those trades where they are)
  otherNote: (count: number) =>
    count === 1 ? '1 operação já está em outra conta: fica onde está.' : `${formatInt(count)} operações já estão em outra conta: ficam onde estão.`,
  completable: (count: number) =>
    count === 1
      ? '1 que já estava ganha os campos que faltavam (comissão, stop, alvo, saída ou payout).' // NEW
      : `${formatInt(count)} que já estavam ganham os campos que faltavam (comissão, stop, alvo, saída ou payout).`, // NEW
  // NEW (Fase 3, D29): in the count row, the rows that complete a trade registered in the app (the
  // server counts them neither as «novas» nor as «já estavam»)
  linkedCount: (count: number) => (count === 1 ? 'já registrada por você' : 'já registradas por você'),
  // NEW (Fase 3, D29): rows of the file that complete a trade registered in the app (never inserted again)
  linked: (count: number) =>
    count === 1 ? '1 já registrada por você: o arquivo completa a comissão.' : `${formatInt(count)} já registradas por você: o arquivo completa a comissão.`,
  // NEW (Fase 3, D29 with Q2 a): the file wins on money
  linkedDiffers: (count: number) =>
    count === 1 ? '1 com preço ou resultado diferente: vale o do arquivo.' : `${formatInt(count)} com preço ou resultado diferente: vale o do arquivo.`,
  offsets: (list: string) => `Os horários já trazem o fuso (${list}).`,
  unsignedLosses: (count: number) => `Perdas com valor positivo: gravamos como negativas (${formatInt(count)}).`,
  refunds: (count: number) => `Estornadas entram com resultado zero (${formatInt(count)}).`, // NEW
  commission: 'O arquivo traz comissões: mostramos o resultado líquido.',
  commissionAria: 'Como ler: comissões',
  commissionInfo: (gross: string, commission: string) => `Bruto ${gross} · comissões ${commission}.`,
  slTpEmpty: 'As colunas SL e TP vêm vazias: stop e alvo ficam em branco.',
  // ADAPTED: the board says "{n} linhas sem data foram puladas (linhas 4, 9, 12)." for one kind of error
  skipped: (count: number) => (count === 1 ? '1 linha com erro foi pulada.' : `${formatInt(count)} linhas com erro foram puladas.`),
  seeLines: 'Ver linhas',
  line: (line: number, reason: string) => `Linha ${formatInt(line)}: ${reason}`,
  /**
   * The day-change count: futures and binaries NEW (Phase 1); Phase 3b B for Forex (IC l.1038) and Cripto (IC l.936), A
   * for Ações and the B3 (quadro §4.3)
   */
  dayChanges: (count: number, market: AccountMarket) =>
    `${count === 1 ? '1 operação fica' : `${formatInt(count)} operações ficam`} em outro dia que o do arquivo: ${VIRA_O_DIA[market]}`,
  zoneFrom: (zone: string, label: string) => `Fuso do arquivo: ${zone} · lembrado de ${label}`,
  zoneFor: (zone: string, label: string) => `Fuso do arquivo: ${zone} · lembrado para ${label}`,
  importN: (count: number) => (count === 1 ? 'Importar 1 operação' : `Importar ${formatInt(count)} operações`),
  completeN: (count: number) => (count === 1 ? 'Completar 1 operação' : `Completar ${formatInt(count)} operações`), // NEW
  // NEW (Fase 3c, §5.12: not on the 3c boards): a file with partial exits (rows of one broker
  // position). Rows that are another row's trade's exits, and rows that join a trade already there
  agrupadas: (count: number) =>
    count === 1 ? '1 saída parcial juntada à sua operação.' : `${formatInt(count)} saídas parciais juntadas às suas operações.`,
  anexadas: (count: number) =>
    count === 1 ? '1 saída a mais de uma operação que já estava.' : `${formatInt(count)} saídas a mais de operações que já estavam.`,
  // NEW (Fase 3c): the primary of a file that only adds rows to trades already in the account
  juntarN: (count: number) => (count === 1 ? 'Juntar 1 saída' : `Juntar ${formatInt(count)} saídas`),

  // Phase 3b: a mapped file (board IC l.365–394)
  /** B IC l.367 «9 execuções no arquivo»: the words after the number (N: the singular) */
  execucoes: (count: number) => (count === 1 ? 'execução no arquivo' : 'execuções no arquivo'),
  /** B IC l.794 «6 saídas»: an execution file counts exits, never lines (N: the singular) */
  saidas: (count: number) => (count === 1 ? 'saída' : 'saídas'),
  /** B IC l.1002 «26 não importadas (APX-0002)» */
  naoImportadas: (valores: readonly string[]) => `não importadas (${eJunto(valores)})`,
  /** N (D11): a file without an ID column whose rows were all in the account by the same time and price */
  alreadySame: 'já estavam (mesma hora e preço)',
  /** B IC l.891 «As 6 saídas viram 4 operações.» (N: «A saída vira 1 operação.», «As 2 saídas viram 1 operação.») */
  saidasViram: (saidas: number, operacoes: number) =>
    saidas === 1
      ? 'A saída vira 1 operação.'
      : `As ${formatInt(saidas)} saídas viram ${operacoes === 1 ? '1 operação' : `${formatInt(operacoes)} operações`}.`,
  /** B IC l.891 «2 ordens sem execução ficaram de fora.» (N: the singular) */
  ordensSemExecucao: (count: number) =>
    count === 1 ? '1 ordem sem execução ficou de fora.' : `${formatInt(count)} ordens sem execução ficaram de fora.`,
  /**
   * B IC l.1003 «Ativos escritos como “MNQ 12-26” e “MES 12-26” ficam como “MNQZ26” e “MESZ26”.» (N: one, «O ativo escrito
   * como “…” fica como “…”.», and three or more, «“a”, “b” e “c”»)
   */
  ativosNormalizados: (pares: readonly { escrito: string; como: string }[]) =>
    pares.length === 1
      ? `O ativo escrito como “${pares[0].escrito}” fica como “${pares[0].como}”.`
      : `Ativos escritos como ${eJunto(pares.map((p) => `“${p.escrito}”`))} ficam como ${eJunto(pares.map((p) => `“${p.como}”`))}.`,
  /** N: rows identical to an earlier one, folded into its trade as more exits (R14) */
  linhasIguais: (count: number) =>
    count === 1
      ? '1 linha igual a outra do arquivo (mesma hora, ativo, lado, quantidade e preços) entrou como uma saída a mais da mesma operação.'
      : `${formatInt(count)} linhas iguais a outras do arquivo (mesma hora, ativo, lado, quantidade e preços) entraram como saídas a mais das mesmas operações.`,
  /** B IC l.905 «As 7 execuções de MESZ6 ficaram de fora: …» (N: the singular) */
  sobrasNaoFecham: (count: number, ativo: string) =>
    count === 1
      ? `1 execução de ${ativo} ficou de fora: as compras e as vendas do arquivo não fecham.`
      : `As ${formatInt(count)} execuções de ${ativo} ficaram de fora: as compras e as vendas do arquivo não fecham.`,
  /** B IC l.785–786 (A, D27: the plural) */
  sobrasAbertas: (count: number) =>
    count === 1
      ? '1 execução de posição ainda aberta no fim do arquivo ficou de fora. Ela entra quando você importar um arquivo que tenha a abertura e o fechamento.'
      : `${formatInt(count)} execuções de posições ainda abertas no fim do arquivo ficaram de fora. Elas entram quando você importar um arquivo que tenha a abertura e o fechamento.`,
  /** B IC l.787 (N: the plural) */
  sobrasAntes: (count: number) =>
    count === 1
      ? '1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.'
      : `${formatInt(count)} execuções fecham posições abertas antes do começo do arquivo e ficaram de fora.`,
  /** B IC l.1069 «3 execuções ficaram de fora.» (N: the singular) */
  sobras: (count: number) => (count === 1 ? '1 execução ficou de fora.' : `${formatInt(count)} execuções ficaram de fora.`),
  /** B IC l.783 */ semComissao: 'Sem comissão no arquivo: estas operações ficam sem comissão.',
  /** B IC l.935 «1 operação fica sem comissão: a taxa veio em BNB.» */
  taxaOutroAtivo: (count: number, ativos: readonly string[]) =>
    `${count === 1 ? '1 operação fica' : `${formatInt(count)} operações ficam`} sem comissão: a taxa veio em ${eJunto(ativos)}.`,
  /** B IC l.793 «18 com resultado diferente do calculado pelos preços: vale o do arquivo.» */
  difere: (count: number) => `${formatInt(count)} com resultado diferente do calculado pelos preços: vale o do arquivo.`,
  /** B IC l.1037 «1 operação com swap: …» (N: the plural) */
  comSwap: (count: number) =>
    count === 1
      ? '1 operação com swap: ele entra no resultado, antes da comissão.'
      : `${formatInt(count)} operações com swap: ele entra no resultado, antes da comissão.`,
  /** B IC l.784 */ semSaida: 'Sem hora de saída, o resultado conta no limite do dia na hora da entrada.',
  /** B IC l.816 (G1; N: the singular) */
  g1: (count: number, conta: string) =>
    `${count === 1 ? '1 operação cai' : `${formatInt(count)} operações caem`} em dias em que ${conta} já tem operações de outro formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.`,
}

/** The tail of PASSO_D.dayChanges: where each market's trading day turns */
const VIRA_O_DIA: Readonly<Record<AccountMarket, string>> = {
  futures: 'o dia de Futuros vira às 18:00 de Nova York.', // NEW (Phase 1)
  binary: 'o dia de binárias vira à meia-noite de Brasília.', // NEW (Phase 1)
  forex: 'o dia de Forex vira às 17:00 de Nova York.', // B IC l.1038
  crypto: 'o dia de Cripto vira à meia-noite de Brasília.', // B IC l.936
  stocks: 'o dia de Ações vira às 20:00 de Nova York.', // A (quadro §4.3)
  options: 'o dia de Ações vira às 20:00 de Nova York.', // A (quadro §4.3)
  b3: 'o dia da B3 vira à meia-noite de Brasília.', // A (quadro §4.3)
}

/**
 * «Linha n: …» reasons, by error code. NEW (suggested in the parsers spec; the board only has "data vazia"). Phase 3b: a
 * mapped file (`mapeado`) names a column by its field's label (CAMPO, «número inválido em Preço de entrada»), never its
 * key, and its side is «lado desconhecido» (B IC l.1069); `raiz` and `passo` are the instrument and its tick of an off-tick
 * price (B IC l.1069 «preço fora do passo do WIN (de 5 em 5)»).
 */
export function rowErrorReason(
  code: string,
  extra: { column?: string; firstLine?: number; mapeado?: boolean; raiz?: string; passo?: string } = {},
): string {
  if (extra.mapeado) {
    switch (code) {
      case 'bad_direction':
        return 'lado desconhecido' // B IC l.1069
      case 'bad_number': {
        const campo = extra.column && Object.prototype.hasOwnProperty.call(CAMPO, extra.column) ? CAMPO[extra.column as FieldKey] : null
        return campo ? `número inválido em ${campo}` : 'número inválido'
      }
    }
  }
  switch (code) {
    // Phase 3b: the mapped files' codes (B where the board has them, N for the others)
    case 'no_price_result':
      return 'sem resultado: este ativo não tem conta pelos preços' // N
    case 'not_dollar_quote':
      return 'par fora do dólar (USDT, USDC ou USD)' // N
    case 'bad_option':
      return 'opção, fica de fora (registre no Registrar)' // B IC l.1069
    case 'off_tick':
      // B IC l.1069; N without a known tick
      return extra.raiz && extra.passo ? `preço fora do passo do ${extra.raiz} (de ${extra.passo} em ${extra.passo})` : 'preço fora do passo do ativo'
    case 'missing_price':
      return 'execução sem preço' // N
    case 'open_at_end':
      return 'posição ainda aberta no fim do arquivo' // B IC l.789
    case 'opened_before_file':
      return 'fecha uma posição aberta antes do começo do arquivo' // B IC l.788
    case 'unbalanced_symbol':
      return 'as compras e as vendas do ativo não fecham no arquivo' // B IC l.790
    case 'symbol_has_error':
      return 'outra execução do ativo tem erro' // N
    case 'position_too_large':
      return 'operação grande demais para guardar' // N
    case 'pnl_mismatch':
      return 'resultado diferente do calculado pelos preços' // N
  }
  switch (code) {
    case 'column_count':
      return 'número de colunas diferente do cabeçalho'
    case 'missing_id':
      return 'sem ID'
    case 'bad_id':
      return 'ID inválido'
    case 'duplicate_in_file':
      return extra.firstLine ? `ID repetido (igual à linha ${formatInt(extra.firstLine)})` : 'ID repetido'
    case 'missing_date':
      return 'data vazia'
    case 'bad_date':
      return 'data inválida'
    case 'bad_exit_time':
      return 'hora de saída inválida'
    case 'bad_offset':
      return 'fuso inválido'
    case 'missing_symbol':
      return 'sem ativo'
    case 'bad_direction':
      return 'direção desconhecida'
    case 'unknown_status':
      return 'status desconhecido'
    case 'bad_number':
      return extra.column ? `número inválido em ${extra.column}` : 'número inválido'
    case 'zero_stake':
      return 'valor zero'
    case 'inconsistent_amounts':
      return 'valores não fecham (Valor ≠ Estornado + Executado)'
    case 'sign_mismatch':
      return 'sinal do resultado não bate com o status'
    case 'bad_quantity':
      return 'quantidade inválida'
    default:
      return 'linha inválida'
  }
}

export const FIM = {
  title: 'Importação feita',
  inHistory: (count: number) => `${ops(count)} em Histórico importado · só resultado, à parte do Diário.`,
  completed: (count: number) =>
    count === 1 ? '1 que já estava ganhou os campos que faltavam.' : `${formatInt(count)} que já estavam ganharam os campos que faltavam.`, // NEW
  // NEW (Fase 3, D29): the trades registered in the app that this file completed
  linked: (count: number) =>
    count === 1 ? '1 já registrada por você foi completada.' : `${formatInt(count)} já registradas por você foram completadas.`,
  // NEW (Fase 3c, §5.12): a file with partial exits
  agrupadas: (count: number) =>
    count === 1 ? '1 saída parcial foi juntada à sua operação.' : `${formatInt(count)} saídas parciais foram juntadas às suas operações.`,
  anexadas: (count: number) =>
    count === 1 ? '1 saída a mais entrou numa operação que já estava.' : `${formatInt(count)} saídas a mais entraram em operações que já estavam.`,
  undoLater: 'Desfazer depois: Personalizar › Suas contas › Importações.', // ADAPTED: "› Editar." had no destination
  toast: (count: number, label: string) => `${ops(count)} em ${label}.`,
  created: (label: string) => `${label} criada.`,
  // ADAPTED: the board names the account («…ficaram em {conta}.»); the preview only counts them
  nothingImported: 'Nada importado: as operações ficaram em outra conta.',
}

export const PASSO_F = {
  title: (count: number, label: string) =>
    count === 1 ? `Nada novo: a operação já está em ${label}.` /* NEW (singular) */ : `Nada novo: as ${formatInt(count)} operações já estão em ${label}.`,
  /** N (Phase 3b): an execution file's «Nada novo» counts exits */
  titleSaidas: (count: number, label: string) =>
    count === 1 ? `Nada novo: a saída já está em ${label}.` : `Nada novo: as ${formatInt(count)} saídas já estão em ${label}.`,
  zonePending: (label: string) => `Fuso do arquivo da ${label}: a confirmar.`,
  zoneKnown: (label: string, zone: string) => `Fuso do arquivo da ${label}: ${zone}.`,
  hidden: (label: string) => `Sem fuso, os horários da ${label} ficam escondidos.`,
  confirm: 'Confirmar fuso',
}

/** The end's model line (Phase 3b, E46; board IC l.1619–1620) */
export const FIM_MODELO = {
  /** B IC l.1620 */ salvo: (nome: string) => `Modelo “${nome}” salvo: os próximos arquivos com estas colunas entram direto.`,
  /** B IC l.1619 */ atualizado: (nome: string) => `Modelo “${nome}” atualizado: os próximos arquivos com estas colunas entram direto.`,
  /** B IC l.1620 */ naoSalvo: 'Colunas usadas só neste arquivo.',
  /** N: the save failed after a good import */
  erro: (nome: string) =>
    `O modelo “${nome}” não foi salvo. As operações já entraram; no próximo arquivo, diga de novo o que é cada coluna.`,
  /** N: too_many_templates */
  limite: (nome: string) => `O modelo “${nome}” não foi salvo: já são 50 modelos. As operações já entraram.`,
  /** N (§6.8): no batch, and a model with «Conta» routes the update would erase */
  semLote: (nome: string) => `O modelo “${nome}” não foi atualizado: este arquivo não trouxe operações novas.`,
}

export const FIM_FUSO = {
  title: (zone: string) => `Fuso confirmado: ${zone}`,
  shown: (count: number, label: string) =>
    count === 1 ? `A operação da ${label} passa a mostrar horários.` /* NEW (singular) */ : `As ${formatInt(count)} operações da ${label} passam a mostrar horários.`,
  remember: 'Vale também para os próximos arquivos desta conta.',
}

export const PASSO_G = {
  title: (market: ImportMarket) =>
    market === 'binary' ? 'Este arquivo é de binárias (Ebinex).' : 'Este arquivo é de futuros (Top One).', // the second is NEW (symmetric)
  infoAria: 'Como ler: mercado do arquivo',
  // Fase 2b (board markup l.401)
  info: (label: string) => `Contas de mercados diferentes nunca são somadas: este arquivo não entra em ${label}.`,
  /**
   * Board for futures; binaries NEW in Phase 1 (symmetric); the other markets NEW in Fase 2b («A
   * conta escolhida é de Forex.», «… da B3.»), though the sheet never brings a file to an account
   * without a file reader
   */
  accountIs: (market: AccountMarket) =>
    market === 'futures'
      ? 'A conta escolhida é de Futuros.'
      : market === 'binary'
        ? 'A conta escolhida é de binárias.'
        : `A conta escolhida é ${MERCADO[market].de}.`,
  importInto: (label: string) => `Importar em ${label}`,
  create: (market: ImportMarket) => (market === 'binary' ? 'Criar conta de binárias' : 'Criar conta de futuros'), // the second is NEW
}

export const FIM_CONTA = {
  title: (label: string) => `${label} criada.`,
  // Board ImportarConta 2b `FM` (fimConta): with «Registrar operação» (Fase 3) before «Importar
  // histórico», or as the only action when the platform has no history to export (IQ Option)
  text: 'Nada ainda. Importe o histórico ou registre a primeira operação.',
  textIq: 'Nada ainda. Registre a primeira operação.',
  importHistory: 'Importar histórico',
  /** The end screen's link (board `temLinkAntes`) or primary button (`temLinkDepois`) */
  registrar: 'Registrar operação',
  /**
   * Fase 2b, a market without a file reader (board `FM` linhasNovo): no «Importar histórico». Since
   * 3-4 (the end of D36) the IQ Option wording, with «Registrar operação» as the primary (ADAPTED,
   * D19); the board's interim text (the Registrar «arriving» in Phase 3) is gone
   */
  semLeitor: 'Nada ainda. Registre a primeira operação.',
  /** «Ainda não lemos arquivos de Forex. » and what comes later: MetaTrader's own reader, or the CSV mapping */
  semLeitorArquivo: (market: AccountMarket, platform: string | null) =>
    `Ainda não lemos arquivos ${MERCADO[market].de}. ${
      (platform && RELATORIO_MT[platform]) || 'Depois vem a importação de CSV em que você diz o que é cada coluna.'
    }`,
  /**
   * Phase 3b (E52, board `FM` relMT): a MetaTrader account's end line, after «Nada ainda. Registre a primeira operação.»;
   * null for any other platform. Since 3b every market imports a CSV (`semLeitor*` above are kept, never shown)
   */
  relatorioMT: (platform: string | null): string | null => (platform && RELATORIO_MT[platform]) || null,
}

/** What a failed request says. NEW (the boards draw no error states). Never the database's text. */
export const ERROR_TEXT: Record<HubErrorCode, string> = {
  not_authenticated: 'Sua sessão expirou. Entre de novo para continuar.',
  unknown_account: 'Esta conta não foi encontrada.',
  archived_account: 'Esta conta está arquivada. Reative em Personalizar para importar.',
  unknown_platform: 'Este formato de arquivo não é aceito.',
  wrong_market: 'Este arquivo é de outro mercado.',
  invalid_tz: 'Fuso inválido. Escolha outro.',
  tz_not_confirmed: 'Confirme o fuso da conta antes de importar.',
  tz_mismatch: 'Este fuso é diferente do fuso confirmado da conta.',
  bad_file_name: 'O nome do arquivo é longo demais.',
  bad_sha256: 'Não conseguimos ler o arquivo.',
  concurrent_import: 'Outra importação com estas operações terminou antes. Confira a prévia de novo.',
  unknown_batch: 'Esta importação não foi encontrada.',
  legacy_batch: 'O histórico anterior não pode ser desfeito.',
  already_undone: 'Esta importação já foi desfeita.',
  duplicate_label: 'Já existe uma conta com esse apelido.',
  duplicate_primary: 'Outra conta já é a principal. Tente de novo.',
  invalid_field: 'Confira os campos.',
  // NEW (Phase 3b): a mapped file's format, and the models of «Salvar como modelo» (the end screen says a failed save
  // itself; these reach the sheet's alert only from anywhere else)
  bad_format: 'Não conseguimos ler o formato deste arquivo. Tente de novo.',
  bad_template: 'O modelo de colunas não pôde ser salvo.',
  too_many_templates: 'Você já tem 50 modelos de colunas.',
  unknown_template: 'Este modelo de colunas não foi encontrado.',
  network: 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.',
  unknown: 'Algo deu errado. Tente de novo.',
}
