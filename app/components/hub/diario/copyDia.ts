/**
 * The pt-BR strings of the Diário page's lane L2 «o dia» (Phase 4, telas): the open day, its plan and «Antes de
 * operar», «Operações do dia», the drill, the images and the marks, the review. Every string is marked (contract §0):
 *   D    produced by the domain's words (lib/hub/diario.ts): imported, never written here
 *   R    produced by a module already built (Registrar, posso, contas): imported, never copied
 *   NEW  on the approved boards (DiarioDezEnxuto / DiarioHojeEnxuto, canvas version 84) and produced by nothing;
 *        written here verbatim with its source «B dump <board> <scenario>» (.claude/backup-fase4/telas/inventario)
 *   NEW (not drawn)  on no board either: the state and the reason are given
 *   DEV  a wording the board does not have (contract §2.5, §11)
 * No prototype label of the boards is a string of the product (DiarioDrill.test checks this file).
 *
 * Moved here from the Phase 3 bridge's diario/copy.ts (contract §4.7): the block's title, «Nenhuma operação registrada
 * hoje.», the column names, «aberta», «plano não avaliado», the paperclip's labels, the row's actions and their aria.
 * diario/copy.ts keeps only the four words of the «Operação» cell's second line (registrarParciais.subDaPonte reads
 * them).
 */
import { CANCEL } from '@/components/hub/contas/copy'

// ---------------------------------------------------------------------------------------------
// The day's heading and tiles (E)
// ---------------------------------------------------------------------------------------------

export const NUMEROS = {
  /** NEW (B dump dez 2) */
  resultado: 'Resultado',
  operacoes: 'Operações',
  limite: 'Limite do dia',
  fora: 'Fora do plano',
  /** NEW (B dump dez 2): the visible line next to the ⓘ, and the ⓘ's name */
  comoLer: 'Como ler os números do dia',
  comoLerAria: 'Como ler: os números do dia',
}

// ---------------------------------------------------------------------------------------------
// «O plano do dia», «Antes de operar», «Do pregão anterior», the timeline's place (F)
// ---------------------------------------------------------------------------------------------

export const PLANO = {
  /** NEW (B dump dez 2) */
  titulo: 'O plano do dia',
  infoAria: 'Como ler: O plano do dia',
  /** NEW (B dump dez 2): the board's link, to Personalizar's windows */
  definirHref: '/personalizar#janelas',
}

export const ANTES = {
  /** NEW (B dump hoje 1) */
  rotulo: 'Antes de operar',
  placeholder: 'Ex.: esperar o rompimento da máxima de ontem.',
  salvar: 'Salvar',
  dica: 'Guardado com a hora do servidor.',
  editar: 'Editar',
  editarAria: 'Editar a nota de antes de operar',
  cancelar: CANCEL,
  /** NEW (B dump dez 3: a past day without a note) */
  nada: 'Nada anotado antes de operar.',
  /** NEW (not drawn; ADAPTED from the review's «Sem conexão. A revisão não foi salva.»): a save offline */
  offline: 'Sem conexão. A nota não foi salva.',
  /** NEW (not drawn): any other refusal (not_today when the day turned, …) */
  erro: 'Não foi possível salvar a nota.',
}

/**
 * DEV B0-1 (for the owner, with the PR): the value under «Do pregão anterior» is the database's carry_in (diario_dia,
 * lib/domain/diario carryInOf, final): the newest earlier day whose current review carries a «Levar para o próximo
 * pregão», with its date («“Uma operação por vez.” · 27 nov»). The boards look only at the previous Diário day and say
 * «Nada trazido do pregão anterior.» when that day has no review: 9 board states differ (dez 3/3b 19 nov, dez 4 → 21
 * out, dez 9 Lucid 1º dez, dez 9b/11b/13 Top One 1º dez, hoje 7, hoje 8).
 */
export const ANTERIOR = {
  /** NEW (B dump dez 2) */
  rotulo: 'Do pregão anterior',
}

export const TIMELINE = {
  /** NEW (B dump dez 2) */
  titulo: 'Linha do tempo',
  chip: 'chega na Fase 5',
  texto: 'Chega na Fase 5, com o estado do mercado ao longo do dia.',
}

// ---------------------------------------------------------------------------------------------
// «Operações do dia» (G)
// ---------------------------------------------------------------------------------------------

export const OPERACOES = {
  /** R (moved from diario/copy.ts OPERACOES_DIA.title; RO l.268): the H3, «Ver no Diário» and a row gone focus it */
  titulo: 'Operações do dia',
  /** NEW (B dump dez 2) */
  infoAria: 'Como ler: Operações do dia',
  info: 'Abra ▾ para ver as saídas, os preços e os pontos, o stop e o alvo, os movimentos do stop, a hora de cada marca (antes da saída ou depois do resultado), as suas imagens e nota (clipe na linha) e o “Posso operar hoje?” na entrada. Plano: “No plano” ou ● com o motivo (fora da janela ou depois do limite).',
  /** R (moved: OPERACOES_DIA.empty; RO l.270): today without trades, with «Registrar operação» */
  vazioHoje: 'Nenhuma operação registrada hoje.',
  /** NEW (B dump dez: a past day without trades) */
  vazio: 'Nenhuma operação neste dia.',
  /** R (moved: OPERACOES_DIA.colHora …; RO l.273) */
  colHora: 'Hora',
  colOperacao: 'Operação',
  colResultado: 'Resultado',
  colPlano: 'Plano',
  /** NEW (B dump dez 2): the ▾ column, for a screen reader only */
  colDetalhes: 'Detalhes',
  /** R (moved: OPERACOES_DIA.aberta; RO l.278) */
  aberta: 'aberta',
  /** NEW (B dump dez 2) */
  noPlano: 'No plano',
  /** NEW (B dump dez 2): «● fora da janela» says it to a screen reader as «fora do plano: fora da janela» */
  foraAria: (motivos: string) => `fora do plano: ${motivos}`,
  /** R (moved: OPERACOES_DIA.planoNaoAvaliado) */
  planoNaoAvaliado: 'plano não avaliado',
  /** NEW (B dump dez 4, 5): a trade before the rules */
  historico: 'Histórico importado · só resultado',
  /** R (moved: OPERACOES_DIA.clip*; RO l.277) */
  clipImagensENota: 'tem imagens e nota',
  clipImagens: 'tem imagens',
  clipNota: 'tem nota',
  /** NEW (B dump dez 2, 4): where a trade came from */
  chipDepois: 'Registrada depois',
  chipArquivo: 'Do arquivo',
  chipAntiga: 'Página antiga',
  /** NEW (B dump hoje 6): a binary closed at zero, on the row's second line */
  devolvida: 'devolvida',
  /** R (moved: OPERACOES_DIA.registrarSaida/registrarResultado; RO l.1653) */
  registrarSaida: 'Registrar saída',
  registrarResultado: 'Registrar resultado',
  /** NEW (B dump dez 2): the ▾ («Detalhes da operação: Venda de MES às 10:03») */
  detalhes: (lado: string, ativo: string, hora: string) => `Detalhes da operação: ${lado} de ${ativo} às ${hora}`,
  /** «Compra», «Venda», «Alta», «Baixa» in the arias (R registrar's words, read through lado()) */
}

/**
 * R (moved from diario/copy.ts; RO l.1661): «Registrar saída: Compra de MES às 10:12». The Diário's rows are on the
 * open day: the day part is always empty (contract G11)
 */
export function acaoAria(acao: string, lado: string, ativo: string, hora: string): string {
  return `${acao}: ${lado} de ${ativo} às ${hora}`
}

export const ABERTAS_OUTROS = {
  /**
   * NEW (B dump dez 9: «1 operação aberta de ontem: MNQ · Compra · 1 ct.»); NEW (not drawn): another day «de 27 nov»
   * and the plural «2 operações abertas de ontem: … e …»
   */
  linha: (n: number, quando: string, quais: string) =>
    `${n === 1 ? '1 operação aberta' : `${n} operações abertas`} de ${quando}: ${quais}.`,
  ontem: 'ontem',
  /** NEW (B dump dez 9): «Abrir 30 nov» */
  abrir: (dia: string) => `Abrir ${dia}`,
}

// ---------------------------------------------------------------------------------------------
// The drill (H)
// ---------------------------------------------------------------------------------------------

export const DRILL = {
  /** NEW (B dump dez 2) */
  titulo: 'Sua operação',
  hora: 'Hora',
  entradaSaida: 'Entrada → saída',
  entrada: 'Entrada',
  saidaMedia: 'Saída média',
  emAberto: 'Em aberto',
  stopAlvo: 'Stop · alvo',
  r: 'R',
  resultado: 'Resultado',
  comissao: 'Comissão',
  posso: 'Posso operar hoje?',
  /** NEW (B dump dez 5): a history trade's average points per contract */
  pontos: 'Pontos',
  /** NEW (B dump hoje 6) */
  stakePayout: 'Stake · payout',
  comoTerminou: 'Como terminou?',
  /** NEW (B dump dez 2): «10:03–10:09 · registrada às 10:06» */
  registradaAs: (hora: string) => `registrada às ${hora}`,
  /** NEW (B dump hoje 1): «10:18 · aberta» */
  aberta: 'aberta',
  /** NEW (B dump dez 2): «7.866,00 · em 2 saídas» */
  emSaidas: (n: number) => `em ${n} saídas`,
  /** NEW (B dump hoje 1): «+US$ 40,00 · até aqui» */
  ateAqui: 'até aqui',
  /** NEW (B dump dez 2): «+US$ 80,02 · bruto +US$ 82,50» */
  bruto: (v: string) => `bruto ${v}`,
  /** NEW (B dump dez 2) */
  naoAnotados: 'não anotados',
  /** NEW (B dump dez 2): «stop 6 · alvo 10 pts · às 10:06»; «Já fechada»: «· registrado depois» */
  asHora: (hora: string) => `às ${hora}`,
  registradoDepois: 'registrado depois',
  /**
   * NEW (B dump dez 2) for points; NEW (not drawn) for pips, a price and a premium («stop 15 · alvo 30 pips»,
   * «stop em 97.900,00 · alvo em 99.500,00», «stop do prêmio 1,10 · alvo do prêmio 2,40»)
   */
  stop: { pts: (v: string) => `stop ${v}`, pips: (v: string) => `stop ${v}`, preco: (v: string) => `stop em ${v}`, premio: (v: string) => `stop do prêmio ${v}` },
  alvo: { pts: (v: string) => `alvo ${v}`, pips: (v: string) => `alvo ${v}`, preco: (v: string) => `alvo em ${v}`, premio: (v: string) => `alvo do prêmio ${v}` },
  unidade: { pts: ' pts', pips: ' pips', preco: '', premio: '' },
  /** NEW (B dump dez 2): «+1,4 R» (one decimal, «,0» dropped) */
  rValor: (v: string) => `${v} R`,
  /** NEW (B dump dez 2) */
  comissaoPendente: 'ainda não chegou: o resultado está bruto até o arquivo da corretora.',
  /** NEW (B dump hoje 6): «20:10 · vela 20:11–20:12 de Brasília» */
  vela: (ini: string, fim: string, sufixo: string) => `vela ${ini}–${fim}${sufixo}`,
  /** NEW (B dump hoje 6): «US$ 20 · payout 88%» */
  payout: (stake: string, payout: string) => `${stake} · payout ${payout}%`,
  /** NEW (B dump hoje 6): an open binary */
  naoVenceu: 'ainda não venceu',
}

/** H6: the drill's lines, in the order they show */
export const LINHAS = {
  /** NEW (B dump dez 2) */
  registradaDepois: (hora: string) => `Registrada às ${hora}, depois do resultado: as marcas contam como depois do resultado.`,
  doArquivo: 'Sem registro no app: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.',
  /** NEW (B dump dez 4: 21 out) */
  paginaAntiga: 'Lançada na página antiga: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.',
  /** NEW (B dump dez 5) */
  historico: 'Antes das suas regras: só o que o arquivo trouxe, sem plano, marcas, imagens nem nota.',
  /** NEW (B dump dez 2) */
  completada: (dia: string, comissao: string) => `Completada pelo arquivo de ${dia}: comissão ${comissao}.`,
  /** NEW (not drawn): a file that closed a trade registered in the app */
  fechadaPeloArquivo: (dia: string) => `Fechada pelo arquivo de ${dia}.`,
  /** NEW (B dump dez 2: «saída»; «entrada» not drawn) */
  corrigiu: (qual: 'entrada' | 'saída', antes: string, depois: string) => `O arquivo corrigiu o preço de ${qual}: ${antes} → ${depois}.`,
  /** NEW (B dump dez 2; the rule «a whole minute or more» is NEW) */
  naCorretora: (de: string, ate: string | null) => `Na corretora: ${de}${ate ? `–${ate}` : ''}.`,
  /** NEW (B dump dez 3) */
  encerrado: (hora: string) => `Na entrada, o “Posso operar hoje?” dizia “Encerrado por hoje” desde ${hora}: as operações anteriores já estavam registradas.`,
  /** NEW (B dump dez 3b) */
  avisava: (hora: string) => `Na entrada, o “Posso operar hoje?” avisava do limite desde ${hora}: pelas suas regras, é só um aviso.`,
}

export const TEMPO_OP = {
  /** NEW (B dump dez 2) */
  titulo: 'Linha do tempo da operação',
  /** R TEMPO's told move: «—» on the hour column (registrarParciais.linhaDoTempo gives no hour) */
  semHora: 'sem hora',
}

export const IMAGENS = {
  /** R ANEXOS.imagens's word, as the thumbnails' list name (B dump dez 2: aria «Imagens») */
  lista: 'Imagens',
  /** NEW (B dump dez 2): «Abrir MES_10-03_entrada.png, imagem 1 de 2» */
  abrirAria: (nome: string, k: number, n: number) => `Abrir ${nome}, imagem ${k} de ${n}`,
  /** NEW (B dump dez 2, interacoes): the dialog */
  dialogo: (k: number, n: number) => `Imagem ${k} de ${n}`,
  anterior: 'Anterior',
  proxima: 'Próxima',
  fechar: 'Fechar',
  /** NEW (B dump dez 2, interacoes): «salvas às 10:12 · depois do resultado», «salva em 11 nov, às 19:21 · …» */
  quando: (verbo: 'salva' | 'salvas', quando: string, fase: string) => `${verbo} ${quando} · ${fase}`,
  /** NEW (B dump dez 2) */
  adicionar: 'Adicionar imagens ou nota',
  /** NEW (interacoes): «3 imagens e nota salvas em 12 nov, às 10:42.» (ANEXOS.quem + the time; no «Aparecem …») */
  salvo: (quem: string, quando: string) => `${quem} ${quando}.`,
  /** NEW (engine `salvarAx`): «Imagens e nota removidas às 10:42.» / «… em 1º dez, às 11:35.» */
  removido: (quando: string) => `Imagens e nota removidas ${quando}.`,
  /** «às 10:42» / «em 12 nov, às 10:42» */
  as: (hora: string) => `às ${hora}`,
  em: (dia: string, hora: string) => `em ${dia}, às ${hora}`,
}

export const MARCAS_DIA = {
  /** NEW (B dump dez 2): the setup group's label in the Diário */
  setup: 'Setup · sua nota, de A a C',
}

// ---------------------------------------------------------------------------------------------
// «Revisão do dia» (I)
// ---------------------------------------------------------------------------------------------

export const REVISAO = {
  /** NEW (B dump hoje 1) */
  titulo: 'Revisão do dia',
  sub: '2 minutos · tudo opcional',
  escrever: 'Escrever revisão',
  registrou: 'O diário registrou:',
  funcionou: 'O que funcionou?',
  funcionouPh: 'Ex.: esperei o rompimento confirmar.',
  diferente: 'O que você faria diferente?',
  diferentePh: 'Ex.: não entraria depois das 11:00.',
  seguiu: 'Seguiu o plano?',
  seguiuDescricao: 'Pela sua resposta, depois do resultado. O diário conta à parte.',
  levar: 'Levar para o próximo pregão',
  levarPh: 'Aparece no plano do próximo pregão',
  salvar: 'Salvar revisão',
  cancelar: CANCEL,
  /** NEW (B dump dez 2) */
  ver: 'Ver revisão',
  esconder: 'Esconder revisão',
  editar: 'Editar',
  /** NEW (B dump hoje 10e) */
  offline: 'Sem conexão. A revisão não foi salva.',
  /** NEW (not drawn): any other refusal */
  erro: 'Não foi possível salvar a revisão.',
}
