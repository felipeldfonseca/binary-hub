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
import { MENSAGENS_REGRAS, REGRAS_ERROR_CODES, type RegrasErrorCode } from '@/lib/hub/regrasDb'
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
// The state rule still waits for its phase (Phase 5-1 left it as it was; «Dados econômicos» no longer uses it)
export const ATIVO_NA_FASE_5 = 'ativo na Fase 5' // NEW
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
  // Phase 5-1: lib/hub/regrasDb's own sentences (bad_releases), for every reader of ERRO_REGRAS
  ...MENSAGENS_REGRAS,
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
  // NEW. Phase 5-1 (c3 §9.2 items 3, 4, 21): «Não opero hoje» joins the answers, the data rule's
  // sentence and «nunca impede»; «até a Fase 5» leaves; only the state rule still waits
  // Fase 3c: one sentence after «… uma só para o mercado.» (B, Personalizar approved 21 Oct, P l.758 `infoRegras`)
  info: 'Elas decidem o “Posso operar hoje?” de cada conta: Liberado, Aguardar até HH:MM, Não opero hoje, Fora da sua janela ou Encerrado por hoje. Nunca há uma resposta só para várias contas: cada conta tem a sua linha. Numa espera de dado econômico, a tela mostra “Aguardar até”, mesmo fora da janela; num dia que você marcou como “Não opero no dia”, mostra “Não opero hoje”; no limite, “Encerrado por hoje” vale o resto do dia. “Padrão Futuros” vale para toda conta de Futuros, menos no que for “só nesta conta”. “Dados econômicos” e a regra por estado valem só para Futuros; a regra por estado é uma só para o mercado. “Mover para o breakeven” (Futuros) não muda o “Posso operar hoje?”: o Registrar sugere, sem bloquear, e as Análises conferem depois. Nos outros mercados, as regras são a janela e o limite do dia. Em cada estado, escolha o que você faz: o diário confere a escolha sozinho, operação por operação. “Só a favor” é operar só na direção do estado. O texto é seu, aparece em “Seu plano”, na página do ativo, e o diário não tenta conferi-lo. O limite do dia fica na moeda da conta, R$ na B3 e US$ nos outros mercados, e nunca soma contas de mercados diferentes. Cada operação é conferida pela versão que valia na entrada: salvar uma mudança cria uma versão nova, com a data do dia, e não reescreve o passado. Antes da primeira versão, as operações ficam em “Histórico importado · só resultado”. Operações fora da janela ficam marcadas no diário, para as Análises compararem o plano com o que você fez. O Binary Hub não envia ordens nem se conecta à sua corretora: o app só mostra o aviso na tela e marca no diário; nunca impede. A IA nunca muda uma regra. A regra por estado passa a valer quando o app tiver o estado do mercado; você já pode deixá-la pronta.',
  /**
   * The ⓘ next to the chip of an account in a market opened in Fase 2b (board `infoMk`): `vira`
   * is viraODia of the account's own day clock («à meia-noite de Brasília», «às 17:00 ET»)
   */
  infoMk: (market: AccountMarket, simbolo: string, vira: string) =>
    `${MERCADO[market].nas}, as regras são a janela e o limite do dia, em ${simbolo}.` +
    (market === 'crypto' ? ` ${USDT_COMO_DOLAR}` : '') +
    ` “Dados econômicos” e a regra por estado valem só para Futuros. O limite zera quando o dia vira, ${vira}; numa conta de mesa, a mesa pode zerar o limite dela em outro horário.`,
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

  // Phase 5-1: the rule's row is «Dados econômicos» (its words: DADOS below)
  ligado: 'Ligado',
  desligado: 'Desligado',
  minAntesAria: 'Minutos antes do dado',
  minDepoisAria: 'Minutos depois do dado',
  minAntes: 'min antes',
  minDepois: 'min depois',

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

/**
 * Fase 3c · «Durante a operação» › «Mover para o breakeven» (Futuros; Personalizar approved 21 Oct,
 * P l.604–639 and its script js P l.2289–2338; telas contract §6.6). B = the board's copy.
 * «Ligada» is REGRAS.ligada; the tags are PADRAO_DE_FUTUROS, SO_NESTA_CONTA and NAO_SALVO.
 */
export const REGRAS_BE = {
  grupo: 'Durante a operação', // B P l.607
  grupoNota: 'Não muda o “Posso operar hoje?”: guia a operação aberta, e as Análises conferem depois.', // B P l.608
  nome: 'Mover para o breakeven', // B P l.611
  desligada: 'Desligada: o Registrar não sugere e as Análises não conferem.', // B P js l.2299
  semAtivo: 'Sem ativo: esta regra não age.', // B P l.615
  quantos: 'Com quantos pontos a favor', // B P l.617
  mais: '+', // B P l.621 (aria-hidden)
  pts: 'pts', // B P l.621 (aria-hidden)
  /** «Pontos a favor no MES» */
  valorAria: (ativo: string) => `Pontos a favor no ${ativo}`, // B P js l.2311
  remover: 'Remover', // B P l.622
  /** «Remover o MES desta regra» */
  removerAria: (ativo: string) => `Remover o ${ativo} desta regra`, // B P js l.2311
  erro: 'Digite pontos maiores que zero.', // B P js l.2311
  /** «O MNQ voltou para +30 pts; use pontos maiores que zero.» */
  voltou: (ativo: string, n: string) => `O ${ativo} voltou para +${n} pts; use pontos maiores que zero.`, // B P js l.2332
  adicionar: 'Adicionar ativo', // B P l.629
  nota: 'O Registrar mostra o preço do breakeven na entrada e sugere mover o stop quando uma parcial chegar lá; nunca bloqueia.', // B P l.632
  voltarPadrao: 'Voltar ao padrão', // B P l.634
  /** «Voltar ao padrão de Futuros: Apex B» */
  voltarAria: (conta: string) => `Voltar ao padrão de Futuros: ${conta}`, // B P js l.2337
}

/**
 * Phase 5-1 · «Dados econômicos» (the rule's row in «Suas regras», layout A of SPEC §7.1; c3 §3; the
 * approved boards Q01–Q05 and Q40–Q43, whose roteiro/Qnn.md give every string's source). The tags are
 * PADRAO_DE_FUTUROS, SO_NESTA_CONTA and NAO_SALVO; «Ligado»/«Desligado» are REGRAS'.
 */
export const DADOS = {
  nome: 'Dados econômicos', // SPEC §7.2 l.1189 (was «Bloqueio de dados»)
  infoAria: 'Como ler: Dados econômicos', // boards Q01 (the built «Como ler: Suas regras» mould)
  /** The rule's ⓘ with the account's minutes (c3 §3.10 l.686-698) */
  info: (antes: number, depois: number) =>
    `Um dado econômico é um número ou uma decisão com dia e hora marcados, como o CPI, o Payroll ou a decisão do Fed. Aqui você diz o que faz em cada um. Opero normalmente: o dado não muda nada nesta conta. Aguardo em volta do horário: de ${antes} min antes a ${depois} min depois do dado, o “Posso operar hoje?” mostra “Aguardar até” e a hora em que a espera termina. Só opero depois do dado: do começo do dia da conta até ${depois} min depois do dado, a tela mostra “Aguardar até”. Não opero no dia: no dia do dado, a tela mostra “Não opero hoje” (e, se a espera em volta do dado passar do fim do dia, “Aguardar até” o fim dela). Em Futuros, o dia da conta começa às 18:00 de Nova York da véspera. O app nunca impede uma operação: a que você registrar numa espera ou num dia em que escolheu não operar só ganha a marca “fora do plano”, com o motivo. “Dados fortes” são os da lista padrão do app: CPI, PPI, Payroll, PCE, PIB, vendas no varejo, os dois ISM e a decisão e a entrevista do Fed; para quem segue essas agendas, também a decisão do BCE, a inflação prévia da zona do euro, o IPCA, o PIB do Brasil e a decisão do Copom. A agenda é a mesma para todo mundo; o que muda é o que você faz em cada dado. Esta regra vale só em contas de Futuros.`,
  escolhaRot: 'O que você faz quando sai um dado', // c3 l.341, l.712
  /** The four ready-made choices (SPEC §7.1 l.1104-1105, 1129) */
  atalhos: [
    { valor: 'fortes', texto: 'Aguardo nos dados fortes' },
    { valor: 'depois0830', texto: 'Só opero depois dos dados das 08:30' },
    { valor: 'diaCpiPayrollFed', texto: 'Não opero em dia de CPI, Payroll e Fed' },
    { valor: 'personalizado', texto: 'Personalizado' },
  ] as const,
  /** The two lines under the minutes (SPEC §7.1 l.1106-1108; the numbers are the fields') */
  linhaVolta: (antes: number, depois: number) => `Aguardo em volta do horário: de ${antes} min antes a ${depois} min depois do dado.`,
  linhaDepois: (depois: number) => `Só opero depois do dado: das 18:00 de Nova York da véspera até ${depois} min depois do dado.`,
  /** The four behaviours written in full (the select's options, the summary, «Próximos dados») */
  modo: {
    normal: 'Opero normalmente',
    volta: 'Aguardo em volta do horário',
    depois: 'Só opero depois do dado',
    dia: 'Não opero no dia',
  },
  /** One part of the summary sentence: «Não opero no dia: CPI» (c3 l.477-479) */
  resumoParte: (modo: string, itens: string) => `${modo}: ${itens}`,
  /** «9 dados» (a count when more than 3) */
  contagem: (n: number) => `${formatInt(n)} dados`,
  /** «os 10 dados fortes dos EUA», then «os 2 da zona do euro» (c3 l.353, l.613) */
  fortesPrimeiro: (n: number, de: string) => `os ${formatInt(n)} dados fortes ${de}`,
  fortesOutros: (n: number, de: string) => `os ${formatInt(n)} ${de}`,
  calendarioDe: { us: 'dos EUA', eu: 'da zona do euro', br: 'do Brasil' } as Record<CalendarCode, string>,
  abrir: (n: number) => `Escolher dado por dado (${formatInt(n)})`, // SPEC §7.1 l.1110
  /** The groups of the list (SPEC §7.1 l.1110-1113) */
  grupo: {
    fortesUs: (n: number) => `EUA${SEP}dados fortes (${formatInt(n)})`,
    outrosUs: (n: number) => `EUA${SEP}outros dados (${formatInt(n)})`,
    eu: (n: number) => `Zona do euro (${formatInt(n)})`,
    br: (n: number) => `Brasil (${formatInt(n)})`,
  },
  naoSegue: `${SEP}você não segue esta agenda`, // c3 l.404
  calendarios: 'Calendários', // c3 l.405 «Calendários >», drawn «Calendários ›» (the › is aria-hidden)
  calendariosAria: 'Calendários econômicos',
  /** «{dado}: o que você faz» (c3 l.712-713) */
  selAria: (nome: string) => `${nome}: o que você faz`,
  /** The next date of a release on the account's clock (c3 l.481-483): «hoje · 08:30 ET», «ter 15 dez · 08:30 ET» */
  proxima: (dia: string, hora: string) => `${dia}${SEP}${hora}`,
  hoje: 'hoje',
  amanha: 'amanhã',
  semData: 'próxima data ainda não publicada',
  // c3 §12.5: in place of the next date
  canceladoNoMes: 'cancelado neste mês',
  adiadoSemData: 'adiado, sem data nova',
  voltar: 'Voltar ao padrão de Futuros', // SPEC §7.1 l.1114
  voltarAria: (conta: string) => `Voltar ao padrão de Futuros: ${conta}`, // c3 l.628-629
  /** The status line (c3 §3.10), in its order */
  desligado: 'Desligado: você opera normalmente em todos os dados; eles não mudam o “Posso operar hoje?”.',
  semCalendario: 'Nenhum calendário marcado: a regra não tem dado para olhar.',
  nenhumComEspera: 'Nenhum dado com espera: é o mesmo que desligado.',
  zero: 'Com 0 minuto antes e depois, a regra não cria espera.',
  semAgenda: 'O app ainda não tem a agenda de hoje: a regra não foi conferida.',
  hoje_: (partes: readonly string[]) => `Hoje: ${partes.join('; ')}.`,
  /** «CPI às 08:30 ET», «PPI e vendas no varejo às 08:30 ET» */
  rotulo: (nomes: string, hora: string) => `${nomes} às ${hora}`,
  aguarda: (rotulo: string, de: string, ate: string) => `${rotulo}, você aguarda das ${de} às ${ate}`,
  soOperaDepois: (rotulo: string, ate: string) => `${rotulo}, você só opera depois das ${ate}`,
  naoOpera: (diaDe: string, hora: string) => `${diaDe} (${hora}), você não opera`,
  operaNormal: (rotulo: string) => `${rotulo}, você opera normalmente`,
  // c3 l.679: with 0 and 0 the day's sentence changes its ending (NEW wording of the join: «. »)
  zeroFim: (rotulo: string) => `${rotulo}, com 0 minuto antes e depois, “Aguardo em volta do horário” não cria espera`,
  nenhumHoje: 'Hoje não sai nenhum dado dos calendários que você segue.',
  /** The old account, the first time (c3 §3.9 l.640-650; board Q41), with the account's minutes */
  avisoLigada: (antes: number, depois: number) =>
    `“Bloqueio de dados” agora se chama “Dados econômicos”, e você escolhe o que faz em cada dado. A partir de agora o app confere os dados: nos dados fortes, o “Posso operar hoje?” mostra “Aguardar até” de ${antes} min antes a ${depois} min depois (os minutos que já estavam salvos), e a operação registrada nessa espera ganha a marca “fora do plano”. Mude aqui se quiser outra coisa.`,
  avisoDesligada:
    '“Bloqueio de dados” agora se chama “Dados econômicos”, e você escolhe o que faz em cada dado. A sua regra continua desligada: os dados não mudam o “Posso operar hoje?”.',
  avisoZero:
    '“Bloqueio de dados” agora se chama “Dados econômicos”, e você escolhe o que faz em cada dado. Com 0 minuto antes e depois, a sua regra não cria espera: nada aparece até você mudar os minutos ou a escolha.',
  entendi: 'Entendi',
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

/** Phase 5-1 · «Próximos dados», inside «Como fica hoje» (c3 §4.3; board Q23) */
export const PROXIMOS = {
  titulo: 'Próximos dados',
  /** «Hoje · ISM de serviços · », then the hour (mono) */
  cabeca: (dia: string, nomes: string) => `${dia}${SEP}${nomes}${SEP}`,
  hoje: 'Hoje',
  amanha: 'Amanhã',
  /** «Aguardo em volta do horário · », then the wait (mono) */
  comportamento: (modo: string) => `${modo}${SEP}`,
  semEspera: `Opero normalmente${SEP}sem espera`,
  esperaAte: 'espera até ',
  oDiaInteiro: 'o dia inteiro',
  naoToca: 'não toca a sua janela',
  cancelado: 'cancelado',
  adiadoSemData: 'adiado, sem data nova',
  adiadoPara: (dia: string) => `adiado para ${dia}`,
  /** «Depois de dom 6: datas previstas, podem mudar.» (SPEC §7.3 item 14) */
  depoisDe: (dia: string) => `Depois de ${dia}: datas previstas, podem mudar.`,
  mostrarMais: 'Mostrar mais',
  semAgenda: 'O app ainda não tem a agenda dos próximos dias.',
  tentar: 'Tentar de novo',
}

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
  // Phase 5-1 (c3 §4.2; boards Q19–Q23): the data lines, in time order with the window's
  dadosAs: (nomes: string) => `${nomes} às `,
  operoNormalmente: 'Opero normalmente',
  espera: (doDa: string) => `${SEP}espera ${doDa}`,
  ate: 'Até ',
  soDepois: (doDa: string) => `${SEP}só depois ${doDa}`,
  desdeOntem: 'desde as 18:00 de ontem',
  oDiaInteiro: (diaDe: string) => `O dia inteiro${SEP}${diaDe} (`,
  fechaParen: ')',
  janelaDepoisDaEspera: (hora: string) => `a partir das ${hora}, depois da espera`,
  janelaDeFora: 'a sua janela de hoje fica de fora',
  dadosEconomicos: 'Dados econômicos',
  nenhumDadoHoje: 'nenhum dado hoje',
  naoConferido: 'não conferido: sem a agenda de hoje',
  // c3 §12.5, SPEC §7.2 «Dado de hoje cancelado ou adiado»
  // `cancelado`/`adiado` agree with the release's name (lib/hub/posso.concorda), as the «Posso» card says it
  canceladoHoje: (nome: string, cancelado = 'cancelado') => `${nome} de hoje ${cancelado}: sem espera hoje.`,
  adiadoHoje: (nome: string, para: string, adiado = 'adiado') => `${nome} ${adiado} para ${para}: sem espera hoje.`,
  /** NEW (open point for the owner): c3 §12.5 gives «adiado, sem data nova» and the «: sem espera hoje.» ending, not this join */
  adiadoSemDataHoje: (nome: string, adiado = 'adiado') => `${nome} ${adiado}, sem data nova: sem espera hoje.`,
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
  // Phase 5-1 (c3 §3.10): the data rule's note, by the ready-made choice its map matches
  dadosFortes: (antes: number, depois: number) => `dados: aguardo nos fortes, ${antes} min antes e ${depois} depois`,
  dados0830: (antes: number, depois: number) => `dados: só depois dos das 08:30, ${depois} min depois; nos outros fortes, ${antes} min antes e ${depois} depois`,
  dadosDia: (antes: number, depois: number) => `dados: sem operar em dia de CPI, Payroll e Fed; nos outros, ${antes} min antes e ${depois} depois`,
  dadosPorDado: (antes: number, depois: number) => `dados: escolha por dado, ${antes} min antes e ${depois} depois`,
  dadosDesligados: 'dados econômicos desligados',
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
  /**
   * Fase 3c (B, P js l.1761 `beTexto`): «breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC», the
   * items in the futures table's order (personalizarBreakeven.itensBreakeven), «+N» written pt-BR
   */
  breakeven: (itens: readonly { ativo: string; n: string }[]) =>
    `breakeven ${lista(itens.map((x, k) => (k === 0 ? `com +${x.n} pts no ${x.ativo}` : `+${x.n} no ${x.ativo}`)))}`,
  /** Off, or on without an asset (they say the same: neither makes a version) */
  semBreakeven: 'sem breakeven', // B P js l.1761
}

// ------------------------------------------------------------------------------------------------
// «Calendários econômicos»
// ------------------------------------------------------------------------------------------------

export const CALENDARIOS = {
  titulo: 'Calendários econômicos',
  todas: 'todas as contas',
  // Phase 5-1 (c3 §9.2 item 10)
  nota: 'Valem para a regra “Dados econômicos”.',
  // Phase 5-1 (c3 §9.2 item 7; §3.10)
  nenhum: 'Nenhum calendário marcado: a regra não tem dado para olhar.',
}

export const CALENDARIO_NOME: Record<CalendarCode, string> = {
  us: 'EUA',
  eu: 'Zona do euro',
  br: 'Brasil',
}

// ------------------------------------------------------------------------------------------------
// «Preferências» (#preferencias): Tema and Horários na tela (Phase 2); the 80 % switch (Phase 3, D9);
// the 10-minute notice of «Dados econômicos» (Phase 5-1)
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
  // Phase 5-1 (c3 §8.2; board Q39): the 10-minute notice, on unless saved off
  avisoDado: 'Avisar 10 minutos antes de uma espera de dado econômico',
  avisoDadoSemFuturos: 'Sem conta de Futuros: não há espera.',
  avisoDadoDesligada: 'Sem efeito: “Dados econômicos” está desligado em Suas regras.',
  avisoDadoSemEspera: 'Hoje não há espera nos calendários que você segue.',
  /** «Hoje: às 08:15, antes da espera do CPI.» */
  avisoDadoHoje: (hora: string, doDa: string) => `Hoje: às ${hora}, antes da espera ${doDa}.`,
  avisoDadoSoDiaInteiro: 'Hoje não há espera com hora marcada: a tela já mostra a espera desde o começo do dia.',
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
