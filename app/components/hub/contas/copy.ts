/**
 * Every pt-BR string of Suas contas, the account selector and the import sheet, in one place so
 * the owner can review them. Strings come from the approved boards (Personalizar #contas,
 * ImportarConta, DiarioHojeEnxuto) unless marked:
 *   NEW      not on any board (screens or states the boards do not draw)
 *   ADAPTED  a board string changed for Phase 1 (the comment says what changed)
 */
import type { ImportMarket } from '@/lib/domain/import'
import { MARKET_SPEC, currencyOf } from '@/lib/domain/markets'
import type { AccountMarket, AccountPhase, ZoneKey } from '@/lib/hub/contas'
import { ALL_FILE_ZONES, LABEL_MAX, MARKET_ORDER } from '@/lib/hub/contas'
import type { HubErrorCode } from '@/lib/hub/contasDb'
import { SIMBOLO_MOEDA, formatInt } from '@/lib/hub/formato'
import { MERCADO, USDT_COMO_DOLAR, viraODia } from '@/components/hub/copyMercados'

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
  // Fase 3 (D19; 3-4 ended D36): the four markets register, «… e, em breve, também por um CSV…» (ADAPTED)
  info: `${INFO_CONTAS_ANTES} Nas contas de Forex, de Ações, de Cripto e da B3, as operações entram pelo “Registrar operação” e, em breve, também por um CSV em que você diz o que é cada coluna. ${INFO_CONTAS_DEPOIS}`,
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
  // ADAPTED: the board goes on with a prototype-only sentence
  info: 'Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo.',
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
  kinds: 'CSV', // ADAPTED: "CSV, Excel ou HTML" (Excel and HTML are Phase 2)
  choose: 'Escolher arquivo',
  reading: 'Lendo o arquivo…', // NEW
}

export const ERRO = {
  unreadable: 'Não conseguimos ler o arquivo.',
  empty: 'O arquivo não tem operações.',
  again: 'Escolher outro arquivo',
  // ADAPTED from the board's "No protótipo, só lemos o CSV da Ebinex e o Trade History da Top One."
  unknownFormat: 'Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.',
  missingColumns: (cols: string[]) => `Faltam colunas: ${cols.join(', ')}.`, // NEW
  duplicateColumns: 'O cabeçalho tem colunas repetidas.', // NEW
  malformed: (line?: number) => (line ? `A linha ${formatInt(line)} tem aspas sem fechar.` : 'O arquivo tem aspas sem fechar.'), // NEW
  tooLarge: 'O arquivo passa de 5 MB.', // NEW
  tooManyRows: 'O arquivo passa de 10.000 operações.', // NEW
}

export const PASSO_A = {
  title: 'Para qual conta?',
  newAccount: (market: ImportMarket) => (market === 'futures' ? '+ Nova conta de futuros' : '+ Nova conta de binárias'),
  sameFormat: (label: string) => `${label} já recebeu este formato.`,
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

export const PASSO_C = {
  title: 'Em que fuso estão os horários deste arquivo?',
  infoAria: 'Como ler: fuso do arquivo',
  info: 'Cada faixa mostra onde as entradas do arquivo cairiam se os horários estivessem naquele fuso. Escolha o fuso que a plataforma usa. A sua janela não aparece aqui: é ela que depois confere “Fora da sua janela”.',
  inFile: (span: string) => `No arquivo: entradas ${span}, sem fuso.`,
  other: 'Outro',
  whichZone: 'Qual fuso?',
  capFutures: (span: string) => `entradas ${span} ET`,
  capBinary: (span: string) => `entradas ${span} de Brasília`,
  capPending: 'escolha o fuso',
  session: 'pregão regular 09:30–16:00 ET',
  legendFutures: 'Faixas no relógio de Nova York (ET).',
  legendBinary: 'Faixas no relógio de Brasília. Binárias abrem 24 h: sem faixa de pregão.',
  confirm: 'Confirmar fuso',
  needZone: 'Escolha um fuso para continuar.',
  needOther: 'Escolha qual fuso.',
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
  // NEW: the day-change count (not on the board)
  dayChanges: (count: number, market: ImportMarket) =>
    `${count === 1 ? '1 operação fica' : `${formatInt(count)} operações ficam`} em outro dia que o do arquivo: ${
      market === 'futures' ? 'o dia de Futuros vira às 18:00 de Nova York.' : 'o dia de binárias vira à meia-noite de Brasília.'
    }`,
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
}

/** «Linha n: …» reasons, by error code. NEW (suggested in the parsers spec; the board only has "data vazia"). */
export function rowErrorReason(code: string, extra: { column?: string; firstLine?: number } = {}): string {
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
  zonePending: (label: string) => `Fuso do arquivo da ${label}: a confirmar.`,
  zoneKnown: (label: string, zone: string) => `Fuso do arquivo da ${label}: ${zone}.`,
  hidden: (label: string) => `Sem fuso, os horários da ${label} ficam escondidos.`,
  confirm: 'Confirmar fuso',
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
  network: 'Não foi possível falar com o servidor. Confira sua conexão e tente de novo.',
  unknown: 'Algo deu errado. Tente de novo.',
}
