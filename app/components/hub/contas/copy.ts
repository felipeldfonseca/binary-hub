/**
 * Every pt-BR string of Suas contas, the account selector and the import sheet, in one place so
 * the owner can review them. Strings come from the approved boards (Personalizar #contas,
 * ImportarConta, DiarioHojeEnxuto) unless marked:
 *   NEW      not on any board (screens or states the boards do not draw)
 *   ADAPTED  a board string changed for Phase 1 (the comment says what changed)
 */
import type { AccountMarket, AccountPhase, ZoneKey } from '@/lib/hub/contas'
import { ALL_FILE_ZONES } from '@/lib/hub/contas'
import type { HubErrorCode } from '@/lib/hub/contasDb'
import { formatInt } from '@/lib/hub/formato'

// ------------------------------------------------------------------------------------------------
// Shared
// ------------------------------------------------------------------------------------------------

export const MARKET_LABEL: Record<AccountMarket, string> = {
  futures: 'Futuros',
  binary: 'Opções binárias',
  forex: 'Forex', // NEW (no board shows other markets; only old data can have them)
  stocks: 'Ações', // NEW
  crypto: 'Cripto', // NEW
  b3: 'B3', // NEW
  options: 'Opções', // NEW
}

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
  naosei: 'Não sei',
  ebinex: 'Ebinex',
  pocket: 'Pocket Option',
  iq: 'IQ Option',
  outra: 'Outra',
  topone: 'Top One', // NEW (key the old imports left on the Top One account)
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

export const NEVER_SUMMED = 'Futuros e binárias nunca são somados.'
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
  phase2: 'O resto do Personalizar chega na Fase 2.', // NEW
}

export const CONTAS = {
  title: 'Suas contas',
  sub: 'Cada conta é de um mercado só e tem as suas regras.',
  infoAria: 'Como ler: Suas contas',
  // ADAPTED: "Duplicar e arquivar valem na hora; arquivar guarda…" → archive only (no duplicate in
  // Phase 1); the sentences about the Apex examples and copy groups are dropped
  info:
    'Uma linha por conta. Cada conta é de um mercado só, com janela, limite e regras próprias. Arquivar vale na hora, guarda o histórico e pode ser desfeito. O Binary Hub não se conecta à sua corretora: as operações chegam por arquivo ou à mão.',
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
  size: 'Tamanho US$',
  primary: 'Conta principal', // NEW
  primaryNote: 'Abre primeiro quando nenhuma conta foi escolhida.', // NEW
  zone: 'Fuso do arquivo',
  zoneUnconfirmed: 'A confirmar. Escolha o fuso que a plataforma usa nos arquivos.', // NEW
  save: 'Salvar', // NEW
  saved: (label: string) => `${label} salva.`, // NEW
  zoneConfirmed: (zone: string) => `Fuso confirmado: ${zone}.`,
  confirmZone: 'Confirmar fuso',
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
  duplicate: (count: number) => `${formatInt(count)} já estavam`,
  completed: (count: number) => `${formatInt(count)} completadas`, // NEW
  other: (count: number) => `${formatInt(count)} em outra conta`, // NEW
  errors: (count: number) => `${formatInt(count)} com erro`,
  undoneOn: (day: string) => `Desfeita em ${day}`, // NEW
  undo: UNDO,
  undoAria: (when: string) => `Desfazer a importação de ${when}`, // NEW
  confirm: (count: number) =>
    count === 1
      ? 'Desfazer apaga a operação desta importação.' // NEW
      : `Desfazer apaga as ${formatInt(count)} operações desta importação.`, // NEW
  confirmYes: 'Desfazer e apagar', // NEW
  confirmNo: 'Manter', // NEW
  undone: (deleted: number) =>
    deleted === 1 ? 'Importação desfeita: 1 operação apagada.' : `Importação desfeita: ${formatInt(deleted)} operações apagadas.`, // NEW
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
  newAccount: (market: 'futures' | 'binary') => (market === 'futures' ? '+ Nova conta de futuros' : '+ Nova conta de binárias'),
  sameFormat: (label: string) => `${label} já recebeu este formato.`,
}

export const PASSO_B = {
  title: (market: 'futures' | 'binary') => (market === 'futures' ? 'Nova conta de futuros' : 'Nova conta de binárias'),
  label: 'Apelido',
  phase: 'Fase',
  type: 'Tipo',
  personal: 'Pessoal',
  size: 'Tamanho US$',
  ref: 'Número na plataforma',
  roFile: 'Arquivo',
  roBroker: 'Corretora',
  roPlatform: 'Plataforma',
  roFirmPlatform: 'Mesa e plataforma',
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
}

export const PASSO_I2 = {
  title: 'Onde você opera?',
  search: 'Busque mesa, corretora ou plataforma',
  noMatchFutures: 'Nada com esse nome na lista de plataformas.',
  noMatchBinary: 'Nada com esse nome. Escolha “Outra” e siga.',
  firmFromSearch: (text: string) => `Usar “${text}” como mesa`,
  firmChip: (firm: string) => `Mesa: ${firm}`,
  removeFirm: 'Tirar',
  removeFirmAria: (firm: string) => `Tirar a mesa ${firm}`,
  nowPlatform: 'Agora escolha a plataforma.',
  iqNote: 'IQ Option não exporta histórico: registre à mão.',
  hint: 'Escolha onde você opera.',
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
  dayChanges: (count: number, market: 'futures' | 'binary') =>
    `${count === 1 ? '1 operação fica' : `${formatInt(count)} operações ficam`} em outro dia que o do arquivo: ${
      market === 'futures' ? 'o dia de Futuros vira às 18:00 de Nova York.' : 'o dia de binárias vira à meia-noite de Brasília.'
    }`,
  zoneFrom: (zone: string, label: string) => `Fuso do arquivo: ${zone} · lembrado de ${label}`,
  zoneFor: (zone: string, label: string) => `Fuso do arquivo: ${zone} · lembrado para ${label}`,
  importN: (count: number) => (count === 1 ? 'Importar 1 operação' : `Importar ${formatInt(count)} operações`),
  completeN: (count: number) => (count === 1 ? 'Completar 1 operação' : `Completar ${formatInt(count)} operações`), // NEW
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
  undoLater: 'Desfazer depois: Personalizar › Suas contas › Importações.', // ADAPTED: "› Editar." had no destination
  toast: (count: number, label: string) => `${ops(count)} em ${label}.`,
  created: (label: string) => `${label} criada.`,
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
  title: (market: 'futures' | 'binary') =>
    market === 'binary' ? 'Este arquivo é de binárias (Ebinex).' : 'Este arquivo é de futuros (Top One).', // the second is NEW (symmetric)
  infoAria: 'Como ler: mercado do arquivo',
  info: (label: string) => `Futuros e binárias nunca são somados: este arquivo não entra em ${label}.`,
  accountIs: (market: 'futures' | 'binary') =>
    market === 'futures' ? 'A conta escolhida é de Futuros.' : 'A conta escolhida é de binárias.', // the second is NEW (symmetric)
  importInto: (label: string) => `Importar em ${label}`,
  create: (market: 'futures' | 'binary') => (market === 'binary' ? 'Criar conta de binárias' : 'Criar conta de futuros'), // the second is NEW
}

export const FIM_CONTA = {
  title: (label: string) => `${label} criada.`,
  // ADAPTED: Registrar operação arrives in Phase 3, so "Importar histórico" is the only action
  text: 'Nada ainda. Importe o histórico ou registre a primeira operação.',
  textIq: 'Nada ainda. Registre a primeira operação.',
  importHistory: 'Importar histórico',
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
