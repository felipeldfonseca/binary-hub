/**
 * Every pt-BR string of Personalizar beyond Suas contas (Phase 2, lane A1): the save bar, the
 * section index, «Quando você opera», «Suas regras» («Como fica hoje», versions, «Calendários
 * econômicos») and «Preferências», in one place so the owner can review them. Strings come from
 * the approved board Personalizar.dc.html (markup and its script `renderVals`/`D.txt`) unless
 * marked:
 *   NEW      not on any board (a state the board does not draw, or a Phase 2 limit)
 *   ADAPTED  a board string changed for Phase 2 (the comment says what changed)
 *
 * Lane A2 reuses the window strings, the day names and ERRO_REGRAS (read-only).
 *
 * Fase 2b (lane B): the boards of version 53 (Personalizar with six markets). The new markets have
 * the window and the daily limit only; their money is the market's (R$ on B3, US$ elsewhere).
 */
import { ACCOUNT_MARKETS, type AccountMarket, type CalendarCode, type Currency, type StateChoice, type StateName, type WindowTz } from '@/lib/domain/gate'
import { REGRAS_ERROR_CODES, type RegrasErrorCode } from '@/lib/hub/regrasDb'
import type { DisplayTz, UsdTextResult, WindowError } from '@/lib/hub/regras'
import { SIMBOLO_MOEDA, formatInt } from '@/lib/hub/formato'
import { MERCADO, USDT_COMO_DOLAR } from '@/components/hub/copyMercados'

/** «a, b e c» (board `lista`) */
export const lista = (xs: readonly string[]): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`

/**
 * « · » between two parts of a text: a no-break space on each side, so the separator never starts
 * or ends a line; the line breaks at another space instead
 */
export const SEP = '\u00a0·\u00a0'

export const NAO_SALVO = 'não salvo'
export const SO_NESTA_CONTA = 'só nesta conta'
export const PADRAO_DE_FUTUROS = 'padrão de Futuros'
export const ATIVO_NA_FASE_5 = 'ativo na Fase 5' // NEW (plan: "O bloqueio aparece como 'ativo na Fase 5'")
export const CARREGAR_ERRO = 'Não foi possível carregar as regras.' // NEW

/** The market as the boards name it in these sections (Fase 2b: copyMercados MERCADO[m].nome) */
export const MERCADO_NOME: Record<AccountMarket, string> = Object.fromEntries(
  ACCOUNT_MARKETS.map((m) => [m, MERCADO[m].nome]),
) as Record<AccountMarket, string>

// ------------------------------------------------------------------------------------------------
// Clocks and days (the board's TZ table, DN and DL)
// ------------------------------------------------------------------------------------------------

export interface RelogioCopy {
  /** After a time: «10:00 ET», «20:00 Brasília» (window lines, «Como fica hoje») */
  curto: string
  /** In a summary: «10:00–11:00 ET», «20:00–21:00 de Brasília» */
  de: string
  /** In a caption on the other clock: «19:00–20:00 ET», «11:00–12:00 em Brasília» */
  em: string
  /** In a field's label: «…, horário de Nova York» */
  nome: string
  /** The card chip and «Como fica hoje»: «relógio de Nova York» */
  relogio: string
  /** «Relógio da janela» and «Horários na tela» pills */
  pill: string
}

export const RELOGIO: Record<WindowTz, RelogioCopy> = {
  'America/New_York': {
    curto: 'ET',
    de: 'ET',
    em: 'ET',
    nome: 'horário de Nova York',
    relogio: 'relógio de Nova York',
    pill: 'Nova York (ET)',
  },
  'America/Sao_Paulo': {
    curto: 'Brasília',
    de: 'de Brasília',
    em: 'em Brasília',
    nome: 'horário de Brasília',
    relogio: 'relógio de Brasília',
    pill: 'Brasília',
  },
}

/** Day pills, segunda first (bit 0 of the weekday mask) */
export const DIAS_CURTOS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'] as const
/** The pills' aria-label */
export const DIAS_LONGOS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const
export const DIAS_NENHUM = 'nenhum dia marcado'
export const DIAS_TODOS = 'todos os dias'

/** Window captions on the other clock (board `legenda`, `capJanela`) */
export const LEGENDA = {
  jaNoDiaSeguinte: ', já no dia seguinte',
  aindaNoDiaAnterior: ', ainda no dia anterior',
  ateODiaSeguinte: ', até o dia seguinte',
  aPartirDe: (d: string, faixa: string) => `; a partir de ${d}: ${faixa}`,
}

export const ERRO_JANELA: Record<WindowError, string> = {
  same_start_end: 'Início e fim iguais: mude um dos dois.',
  no_days: 'Marque pelo menos um dia.',
}

// ------------------------------------------------------------------------------------------------
// Page header, status and the save bar (board .pg-topo, .barra)
// ------------------------------------------------------------------------------------------------

export const SALVAR = {
  tudoSalvo: 'Tudo salvo',
  naoSalvas: 'Alterações não salvas',
  corrija: 'Corrija a janela marcada para salvar.',
  salvando: 'Salvando…', // NEW (a request is running)
  salvo: 'Salvo.',
  salvoDesde: (d: string, itens: readonly string[]) => `Salvo. Regras novas desde ${d}: ${lista(itens)}.`,
  // NEW: versions on different days (a futures save after 18:00 ET lands on the next day)
  salvoVarios: (itens: readonly string[]) => `Salvo. Regras novas: ${lista(itens)}.`,
  versaoDe: (label: string, n: number) => `${label} v${n}`,
  versaoDeDesde: (label: string, n: number, d: string) => `${label} v${n} desde ${d}`, // NEW
  descartadas: 'Alterações descartadas.',
  descartar: 'Descartar',
  salvar: 'Salvar alterações',
}

const SALVAR_GENERICO = 'Não foi possível salvar. Nada foi alterado.' // NEW

/** NEW: what a failed save says (codes of lib/hub/regrasDb); the database's text is never shown */
export const ERRO_REGRAS: Record<RegrasErrorCode, string> = {
  ...(Object.fromEntries(REGRAS_ERROR_CODES.map((code) => [code, SALVAR_GENERICO])) as Record<RegrasErrorCode, string>),
  rules_changed: 'As regras foram salvas em outra aba. Recarregue para ver a versão salva.',
  not_authenticated: 'Sua sessão expirou. Entre de novo para continuar.',
  network: 'Não foi possível falar com o servidor. Nada foi alterado.',
  concurrent_save: 'Outro salvamento terminou antes. Nada foi alterado. Tente de novo.',
  archived_account: 'Uma conta mudou em outra aba. Nada foi alterado; confira e salve de novo.',
  unknown_account: 'Uma conta mudou em outra aba. Nada foi alterado; confira e salve de novo.',
}

// ------------------------------------------------------------------------------------------------
// Section index (board nav.indice)
// ------------------------------------------------------------------------------------------------

export const INDICE = {
  aria: 'Seções do Personalizar',
  // board order; Seus ativos, Seu Início and Leituras da IA come in later phases
  links: [
    { href: '#contas', texto: 'Suas contas' },
    { href: '#janelas', texto: 'Quando você opera' },
    { href: '#regras', texto: 'Suas regras' },
    { href: '#preferencias', texto: 'Preferências' },
  ],
  nota: 'As mudanças valem depois de salvar. O tema e as ações em Suas contas valem na hora.',
}

// ------------------------------------------------------------------------------------------------
// «Quando você opera» (#janelas)
// ------------------------------------------------------------------------------------------------

export const JANELAS = {
  titulo: 'Quando você opera',
  infoAria: 'Como ler: Quando você opera',
  sub: 'Cada mercado tem a sua janela padrão; uma conta pode ter a própria.',
  // ADAPTED (board v53 `txt.infoJanelas`): drops «e para as Leituras da IA» (Phase 8); the next
  // clock change is computed
  info: (proximaMudanca: string) =>
    `Elas valem para “Só operar dentro da sua janela”, em Suas regras. Futuros, Forex e Ações seguem o horário de Nova York: a janela fica no relógio de Nova York (ET) e, em Brasília, anda 1 hora quando os EUA mudam o horário. Binárias, Cripto e a B3 ficam no relógio de Brasília, que não muda. Em cinza, a mesma janela no outro relógio; nos 14 dias antes de uma mudança (a próxima é ${proximaMudanca}), aparece também a hora nova. Fim antes do início: a janela termina no dia seguinte, e as operações contam no dia em que ela abre. O dia começa às 18:00 ET em Futuros, às 17:00 ET em Forex, às 20:00 ET em Ações e à meia-noite de Brasília em binárias, em Cripto e na B3. Cripto abre todos os dias, 24 h: a janela pode incluir sábado e domingo. Os campos de hora usam sempre o relógio da janela, qualquer que seja “Horários na tela”. Com uma segunda conta no mercado, dá para ajustar a janela só nela. Ao salvar, cada conta cuja janela mudou ganha uma versão nova das regras, com a data do dia.`,
  // Fase 2b: the market's «de» form («Janela de Futuros», «Janela da B3»)
  grupoAria: (market: AccountMarket) => `Janela ${MERCADO[market].de}`,
  semJanelaChip: 'sem janela',
  // ADAPTED: drops «e nenhum dado gera leitura» (Phase 8)
  semJanelaUma: (label: string) => `Sem janela: na ${label}, a regra da janela não age.`,
  semJanelaVarias: 'Sem janela: nestas contas, a regra da janela não age.',
  semJanela: 'Sem janela.',
  definir: '+ Definir janela',
  cancelar: 'Cancelar esta janela',
  cancelarAria: (market: AccountMarket) => `Cancelar a janela nova ${MERCADO[market].de}`,
  das: 'das',
  eDas: 'e das',
  as: 'às',
  doDiaSeguinte: 'do dia seguinte',
  inicioAria: (market: AccountMarket, segunda: boolean, relogio: string) =>
    `Início da ${segunda ? 'segunda janela' : 'janela'} ${MERCADO[market].de}, ${relogio}`,
  fimAria: (market: AccountMarket, segunda: boolean, relogio: string) =>
    `Fim da ${segunda ? 'segunda janela' : 'janela'} ${MERCADO[market].de}, ${relogio}`,
  inicioContaAria: (label: string, relogio: string) => `Início da janela só de ${label}, ${relogio}`,
  fimContaAria: (label: string, relogio: string) => `Fim da janela só de ${label}, ${relogio}`,
  mais: 'Relógio, dias e segunda janela',
  maisAria: (market: AccountMarket) => `Relógio, dias e segunda janela ${MERCADO[market].de}`,
  relogioRotulo: 'Relógio da janela',
  dias: 'Dias',
  diasPrimeira: 'Dias da primeira janela',
  diasSegunda: 'Dias da segunda janela',
  segunda: '+ Segunda janela',
  segundaAria: (market: AccountMarket) => `Segunda janela ${MERCADO[market].de}`,
  remover: 'Remover a segunda janela',
  removerAria: (market: AccountMarket) => `Remover a segunda janela ${MERCADO[market].de}`,
  maximo: 'Máximo de 2 janelas por mercado.',
  usadaPor: (label: string) => `Usada por ${label}.`,
  contasAria: (market: AccountMarket) => `Contas ${MERCADO[market].de}`,
  usaEsta: 'usa esta janela',
  ajustar: 'Ajustar só nesta conta',
  ajustarAria: (label: string) => `Ajustar só nesta conta: ${label}`,
  voltar: 'Voltar ao padrão',
  voltarAria: (label: string) => `Voltar ao padrão: ${label}`,
  semContas: 'Sem contas ativas: as janelas aparecem com a primeira.',
  // Fase 2b (board `faltaMk`): while one of the six creatable markets has no active account
  outrosMercados: 'Outros mercados aparecem aqui quando você tiver uma conta neles.',
}

// ------------------------------------------------------------------------------------------------
// «Suas regras» (#regras)
// ------------------------------------------------------------------------------------------------

export const REGRAS = {
  titulo: 'Suas regras',
  infoAria: 'Como ler: Suas regras',
  sub: 'Cada conta tem as suas; elas decidem o “Posso operar hoje?” dela.',
  // ADAPTED (board v53 `txt.infoRegras`): drops the example-accounts sentence; the last sentence is
  // NEW (Phase 5)
  info: 'Elas decidem o “Posso operar hoje?” de cada conta: Liberado, Aguardar até HH:MM, Fora da sua janela ou Encerrado por hoje. Nunca há uma resposta só para várias contas: cada conta tem a sua linha. Durante um bloqueio de dados, a tela mostra “Aguardar até”, mesmo fora da janela; no limite, “Encerrado por hoje” vale o resto do dia. “Padrão Futuros” vale para toda conta de Futuros, menos no que for “só nesta conta”. Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5; a regra por estado é uma só para o mercado. Nos outros mercados, as regras são a janela e o limite do dia. Em cada estado, escolha o que você faz: o diário confere a escolha sozinho, operação por operação. “Só a favor” é operar só na direção do estado. O texto é seu, aparece em “Seu plano”, na página do ativo, e o diário não tenta conferi-lo. O limite do dia fica na moeda da conta, R$ na B3 e US$ nos outros mercados, e nunca soma contas de mercados diferentes. Cada operação é conferida pela versão que valia na entrada: salvar uma mudança cria uma versão nova, com a data do dia, e não reescreve o passado. Antes da primeira versão, as operações ficam em “Histórico importado · só resultado”. Operações fora da janela ficam marcadas no diário, para as Análises compararem o plano com o que você fez. O Binary Hub não envia ordens nem se conecta à sua corretora: bloquear é mostrar o aviso na tela e marcar no diário. A IA nunca muda uma regra. O bloqueio de dados e a regra por estado passam a valer na Fase 5, quando o app tiver a agenda econômica e o estado do mercado; você já pode deixá-los prontos.',
  /**
   * The ⓘ next to the chip of an account in a market opened in Fase 2b (board `infoMk`): `vira`
   * is viraODia of the account's own day clock («à meia-noite de Brasília», «às 17:00 ET»)
   */
  infoMk: (market: AccountMarket, simbolo: string, vira: string) =>
    `${MERCADO[market].nas}, as regras são a janela e o limite do dia, em ${simbolo}.` +
    (market === 'crypto' ? ` ${USDT_COMO_DOLAR}` : '') +
    ` Bloqueio de dados e regra por estado valem só para Futuros até a Fase 5. O limite zera quando o dia vira, ${vira}; numa conta de mesa, a mesa pode zerar o limite dela em outro horário.`,
  infoMkAria: (market: AccountMarket) => `Como ler: regras ${MERCADO[market].de}`,
  semConta: 'As regras aparecem quando você tiver uma conta.',
  regrasDe: 'Regras de',
  padraoFuturos: 'Padrão Futuros',
  valePara: (n: number) => `vale para ${formatInt(n)} ${n === 1 ? 'conta' : 'contas'}`,
  chipConta: (mercado: string, fase: string | null) => (fase ? `${mercado} · ${fase}` : mercado),

  janela: 'Janela',
  semJanela: 'Sem janela',
  ajustar: 'Ajustar',
  definir: 'Definir',
  ajustarAria: 'Ajustar a janela em Quando você opera',
  definirAria: 'Definir a janela em Quando você opera',

  soDentro: 'Só operar dentro da sua janela',
  ligada: 'Ligada',
  // ADAPTED: board «Desligada: a janela vale só para as leituras da IA.» (Phase 8)
  desligada: 'Desligada: a janela não muda o “Posso operar hoje?”.',
  semJanelaAviso: 'Sem janela: esta regra não age.',
  semJanelaLink: 'Definir em Quando você opera',
  janelaComErro: 'A janela tem erro: esta regra não age até você corrigir.',
  janelaComErroLink: 'Corrigir em Quando você opera',
  foraMostrar: 'Fora da janela, mostrar',
  foraOpcoes: [
    { valor: 'fora', texto: '“Fora da sua janela”' },
    { valor: 'aviso', texto: '“Liberado”, com aviso' },
  ] as const,

  bloqueio: 'Bloqueio de dados',
  ligado: 'Ligado',
  desligado: 'Desligado',
  minAntesAria: 'Minutos antes do dado',
  minDepoisAria: 'Minutos depois do dado',
  minAntes: 'min antes',
  minDepois: 'min depois',
  bloqDesligado: 'Desligado: dados não mudam o “Posso operar hoje?”.',
  bloqZero: 'Com 0 minuto, não há bloqueio.',
  // ADAPTED: board «… nada bloqueia o dia.» (the block acts from Phase 5)
  bloqSemCalendario: 'Nenhum calendário marcado: nada vai bloquear o dia.',
  bloqFase5: 'Os dados econômicos chegam na Fase 5. Até lá, o bloqueio não muda o “Posso operar hoje?”.', // NEW

  limite: 'Limite do dia',
  limitePorConta: 'Vale por conta: escolha uma conta acima.',
  semLimite: 'Sem limite',
  definirLimite: 'Definir',
  mudarLimite: 'Mudar',
  definirLimiteAria: (label: string) => `Definir o limite do dia de ${label}`,
  mudarLimiteAria: (label: string) => `Mudar o limite do dia de ${label}`,
  // Fase 2b (board `campoRot`): the account's currency, «US$» or «R$»
  limiteCampo: (simbolo: string) => `Limite do dia, em ${simbolo}`,
  ok: 'OK',
  cancelar: 'Cancelar',
  ficarSemLimite: 'Ficar sem limite',
  // Fase 2b: a function of the account's currency (too_large names US$ or R$)
  limiteErro: (reason: Extract<UsdTextResult, { ok: false }>['reason'], currency: Currency): string =>
    ({
      empty: 'Digite um valor maior que zero.',
      not_positive: 'Digite um valor maior que zero.',
      too_large: `Use um valor até ${SIMBOLO_MOEDA[currency]}\u00a01.000.000.`, // NEW (the database's maximum; the symbol stays with the amount)
      invalid: 'Use só números, como 400 ou 400,50.', // NEW (the board's number field could not get letters)
    })[reason],
  modoAria: (label: string) => `Como o limite de ${label} conta`,
  modos: [
    { valor: 'conta', texto: 'por conta' },
    { valor: 'soma', texto: 'somando as contas de Futuros' },
  ] as const,
  // Fase 2b (board `somaTxt`): «Contas de outros mercados nunca entram»
  soma: (contas: readonly string[]) => `Soma ${lista(contas)}. Contas de outros mercados nunca entram.`,
  somaUma: 'Hoje só há uma conta de Futuros. Contas de outros mercados nunca entram.',
  aoChegar: 'Ao chegar no limite',
  aoChegarOpcoes: [
    { valor: 'encerrar', texto: 'Encerrar o dia no app' },
    { valor: 'avisar', texto: 'Só avisar' },
  ] as const,

  estado: 'Regra por estado',
  todasFuturos: 'todas as contas de Futuros',
  nenhumaEscolha: 'Nenhuma escolha ainda.',
  escolher: 'Escolher o que você faz em cada estado',
  fechar: 'Fechar',
  estadoGrupoAria: (estado: string) => `Em “${estado}”, você`,
  estadoPlaceholderAlinhadas: 'O que você faz neste estado: se opera, com que tamanho, onde sai.',
  estadoPlaceholder: 'O que você faz neste estado.',
}

export const ESTADO_NOME: Record<StateName, string> = {
  alinhadas: 'Alinhadas',
  so_tecnica: 'Só a técnica',
  so_fundamentos: 'Só os fundamentos',
  em_conflito: 'Em conflito',
  sem_direcao: 'Sem direção',
}

export const ESCOLHA_NOME: Record<StateChoice, string> = {
  opero: 'Opero',
  so_a_favor: 'Só a favor',
  nao_opero: 'Não opero',
}

// ------------------------------------------------------------------------------------------------
// «Como fica hoje» (board .bloco under the rules; gate.md §6)
// ------------------------------------------------------------------------------------------------

export const HOJE = {
  titulo: 'Como fica hoje',
  noRelogio: (relogio: string) => `no ${relogio}`,
  suaJanela: `${SEP}sua janela`,
  umaDasJanelas: `${SEP}uma das suas janelas`,
  liberado: 'Liberado',
  foraDaJanela: 'Fora da sua janela',
  encerrado: 'Encerrado por hoje',
  noRestoDoDia: 'No resto do dia',
  oDiaTodo: 'O dia todo',
  comAvisoFora: 'com aviso: fora da janela',
  naoEDia: 'hoje não é dia da janela',
  comAvisoNaoEDia: 'com aviso: hoje não é dia da janela',
  comAvisoLimite: 'com aviso do limite',
  // NEW: nothing checked is never «Liberado» (decisoes «Defaults aceitos»; the card's words)
  semJanelaSalva: 'Sem janela salva',
  semRegraAtiva: 'Sem regra ativa',
  sePerda: 'Se a perda do dia chegar a ',
  somandoFuturos: ' (somando Futuros)',
  bloqueio: 'Bloqueio de dados', // NEW (in place of the block lines, Phase 5)
  avisoSemJanela: 'Sem janela: a regra da janela não age. Defina em Quando você opera.',
  avisoCorrija: 'Corrija a janela em Quando você opera.',
}

// ------------------------------------------------------------------------------------------------
// Version block (board .versao) and version notes (board partesSig)
// ------------------------------------------------------------------------------------------------

export const VERSAO = {
  padrao: 'Padrão de Futuros',
  usadoPor: (contas: readonly string[]) => `Usado por ${lista(contas)}, menos no que for “só nesta conta”.`,
  aoSalvarPadrao: (d: string, contas: readonly string[]) => `Ao salvar: versão nova desde ${d} em ${lista(contas)}.`,
  regrasDesde: (n: number, d: string) => `Regras v${n} desde ${d}`,
  operacoesDesde: (n: number, d: string) => `${formatInt(n)} ${n === 1 ? 'operação' : 'operações'} do diário desde ${d}.`,
  aoSalvar: (n: number, d: string) => `Ao salvar: Regras v${n} desde ${d}.`,
  versoes: (n: number) => `Versões (${formatInt(n)})`,
  antes: (d: string) => `Antes de ${d}: Histórico importado${SEP}só resultado.`,
  analises: 'As Análises contam a partir daqui.',
  nenhuma: 'Nenhuma versão salva',
  // ADAPTED (Fase 3, D18): the Registrar asks for the rules before registering on an account without a version
  ateSalvar: `Até salvar, as operações importadas ficam em “Histórico importado${SEP}só resultado”, e o “Registrar operação” pede as regras antes.`,
  comecar: 'Começar as regras hoje', // NEW (personalizar.md P12)
  desde: (d: string) => `desde ${d}`,
  hoje: ' (hoje)',
  trocadaNoMesmoDia: (d: string) => `${d}, trocada no mesmo dia`,
  intervalo: (de: string, ate: string) => `${de} a ${ate}`,
}

/** The parts of a version note, as the board writes them (partesSig) */
export const NOTA = {
  janela: (descricao: string) => `janela ${descricao}`,
  soNestaConta: ' (só nesta conta)',
  semJanela: 'sem janela',
  soDentro: 'só dentro da janela',
  podeFora: 'pode operar fora da janela',
  foraFora: 'fora da janela: “Fora da sua janela”',
  foraAviso: 'fora da janela: “Liberado”, com aviso',
  bloqueio: (antes: number, depois: number) => `bloqueio ${antes} min antes e ${depois} depois`,
  semBloqueio: 'sem bloqueio',
  limite: (valor: string) => `limite ${valor}`,
  porConta: ' por conta',
  somando: ' somando as contas de Futuros',
  soAvisa: ', só avisa',
  semLimite: 'sem limite',
  estado: (resumo: string) => `regra por estado: ${resumo}`,
  nenhumaEscolha: 'nenhuma escolha',
  // NEW: calendars are copied into every futures version (they version since Phase 2)
  calendarios: (nomes: readonly string[]) => `calendários: ${nomes.length ? lista(nomes) : 'nenhum'}`,
  copiadas: (label: string) => `copiadas de ${label}`,
}

// ------------------------------------------------------------------------------------------------
// «Calendários econômicos»
// ------------------------------------------------------------------------------------------------

export const CALENDARIOS = {
  titulo: 'Calendários econômicos',
  todas: 'todas as contas',
  // ADAPTED: board «Valem para o bloqueio, os Próximos eventos e as leituras depois de dados.» (Phase 8)
  nota: 'Valem para o bloqueio de dados, a partir da Fase 5.',
  // ADAPTED: drops «e nenhum dado gera leitura» (Phase 8); «bloqueia» → «vai bloquear» (Phase 5)
  nenhum: 'Nenhum calendário marcado: nada vai bloquear o dia.',
}

export const CALENDARIO_NOME: Record<CalendarCode, string> = {
  us: 'EUA',
  eu: 'Zona do euro',
  br: 'Brasil',
}

// ------------------------------------------------------------------------------------------------
// «Preferências» (#preferencias): Tema and Horários na tela (Phase 2); the 80 % switch (Phase 3, D9)
// ------------------------------------------------------------------------------------------------

export const PREFERENCIAS = {
  titulo: 'Preferências',
  tema: 'Tema',
  temaNota: 'Muda na hora, sem precisar salvar.',
  claro: 'Claro',
  escuro: 'Escuro',
  horarios: 'Horários na tela',
  horariosNota: 'Agenda, sessões e registros. Janelas e leituras usam o relógio da janela.',
  // Phase 3 (D9; board Personalizar l.690, script `avisoLimiteTexto` l.2351). The two other «Avisar …»
  // switches of the board wait for Phase 5.
  aviso80: 'Avisar ao chegar em 80% do limite do dia',
  /** «Com os limites atuais: Top One #1 US$ 320, FTMO US$ 800 e Clear R$ 400 de perda.» (each item «{conta} {80 %}») */
  aviso80Limites: (itens: readonly string[]) => `Com os limites atuais: ${lista(itens)} de perda.`,
  aviso80SemLimite: 'Nenhuma conta tem limite do dia.',
  aviso80Erro: 'Não foi possível salvar. Tente de novo.', // NEW (the switch went back)
}

export const HORARIOS_OPCOES: readonly { valor: DisplayTz; texto: string }[] = [
  { valor: 'et', texto: 'Nova York (ET)' },
  { valor: 'br', texto: 'Brasília' },
  { valor: 'both', texto: 'Os dois' },
]
