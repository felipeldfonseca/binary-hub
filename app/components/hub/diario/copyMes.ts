/**
 * The pt-BR strings of the Diário page's lane L1 «mês e semana» (Phase 4, telas): the top of the page and its
 * states, the calendar, the week, the footer. Every string is marked (contract §0):
 *   D    produced by the domain's words (lib/hub/diario.ts, lib/hub/posso.ts, lib/hub/seletorContas.ts): imported,
 *        never written here
 *   R    produced by a module already built: imported, never copied (except where noted)
 *   NEW  on the approved boards (DiarioDezEnxuto / DiarioHojeEnxuto, canvas version 84) and produced by nothing;
 *        written here verbatim with its source «B dump <board> <scenario>» (.claude/backup-fase4/telas/inventario)
 *   NEW (not drawn)  on no board either: the state and the reason are given
 * No prototype label of the boards («Cenário do protótipo», «Recomeçar», «fora do produto», «No protótipo») is a
 * string of the product.
 *
 * The D words this lane renders, never written here: linhaDaData (A2), linhaDoTopo (C2), avisoDeRevisoes (C4),
 * comoLerOCalendario (D2), valoresEm (D4), mesTitulo and diaLongo (D5, D6), COLUNAS (D7), celulaDoCalendario (D8–D15),
 * celulaDaSemana (D18), intervaloLongo (D20, J3), semanaTexto (J1, J2, J4–J6), foraDaSemanaItem (J7), SELETOR_MUITAS
 * (A8–A12), possoNoDiario / outrasTexto / POSSO_NO_DIARIO_INFO (B2, B3, B6, B7). R: contas/copy (LOADING, TRY_AGAIN,
 * DIARIO, SELETOR, MARKET_LABEL, PHASE_LABEL, IMPORTACOES), posso/copy (POSSO).
 */

/**
 * R `components/hub/diario/copy.ts` OPERACOES_DIA.offline, copied (not moved) at B0: the Phase 3 bridge keeps using
 * its own until lane L2 retires it (contract §4.7). The band over the page while a Diário read waits for the
 * connection (C5)
 */
export const OFFLINE = 'Sem conexão. Tente de novo quando a conexão voltar.'

/** NEW, B dump hoje 10d: any Diário read failed (also while the Phase 4 SQL is not pasted) — C7 */
export const ERRO_DIARIO = 'Não foi possível carregar o Diário.'

/** The top of the page (C1, A15) */
export const TOPO = {
  /** NEW, B dump dez 2 (template `nav aria-label`): the section links' landmark */
  secoes: 'Seções da página',
  /** NEW, B dump dez 2: the three links */
  calendario: 'Calendário',
  dia: 'O dia',
  semana: 'Semana',
  /** NEW, B dump dez 9b (engine `contaStatus`): the screen reader hears the account chosen in the selector — A15 */
  contaStatus: (label: string) => `Conta ${label}.`,
}

/** The banner of an account without rules (C3) */
export const SEM_REGRAS = {
  /** NEW, B dump hoje 10a */
  titulo: 'Esta conta ainda não tem regras.',
  /** NEW, B dump hoje 10a */
  texto: 'Até você salvar as regras em Personalizar, as operações importadas ficam em Histórico importado · só resultado.',
  /** NEW, B dump hoje 10a: → /personalizar#regras */
  definir: 'Definir as regras',
}

/** The pending-reviews banner (C4); its count is D avisoDeRevisoes */
export const PENDENTES = {
  /** NEW, B dump dez 2 (template `role="region" aria-label`) */
  regiao: 'Revisões pendentes',
  /** NEW, B dump dez 2 */
  sub: 'No calendário, são os pregões com operação registrada no app e sem ✓.',
  /** NEW, B dump dez 2: shows the newest pending day's month and focuses «Calendário» */
  ver: 'Ver no calendário',
  /** NEW, B dump dez 2: × (closed for the session) */
  fechar: 'Fechar o aviso de revisões',
}

/** The calendar (D) */
export const CAL = {
  /** NEW, B dump dez 2 */
  titulo: 'Calendário',
  /** NEW, B dump dez 4 (ⓘ open) */
  info: 'Como ler: Calendário',
  /** NEW, B dump dez 2 (template): the month navigation */
  navegar: 'Navegar pelos meses',
  anterior: 'Mês anterior',
  hoje: 'Hoje',
  proximo: 'Próximo mês',
  /** NEW, B dump dez 2: before D valoresEm («Valores em US$.») */
  toque: 'Toque num dia para abrir.',
  /** NEW, B dump dez 2 (engine `mesStatus`): D mesTitulo inside */
  mesStatus: (mesTitulo: string) => `Mês: ${mesTitulo}.`,
  /** NEW, B dump dez 2 (engine `diaStatus`): D diaLongo inside, after a day opened from the calendar */
  abertoAbaixo: (diaLongo: string) => `Aberto abaixo: ${diaLongo}.`,
  /** NEW, B dump dez 2: the last column's header */
  semana: 'Semana',
}

/** The calendar's legend (D22) */
export const LEGENDA = {
  /** NEW, B dump dez 2 (template `role="group" aria-label`) */
  grupo: 'Legenda',
  /** NEW ×6, B dump dez 2 (■ only when the account's rules have a limit) */
  ganho: 'Ganho',
  perda: 'Perda',
  fora: 'fora do plano',
  limite: 'limite atingido',
  revisao: 'revisão',
  historico: 'histórico importado',
}

/** The «Semana» card (J); its title, tiles, bars and list are D semanaTexto / foraDaSemanaItem */
export const SEMANA = {
  /** NEW, B dump dez 11a */
  titulo: 'Semana',
  /** NEW, B dump dez 11a */
  info: 'Como ler: Semana',
  /** NEW, B dump dez 4 (engine `semStatus`): D intervaloLongo inside, after a week opened from the calendar — J3 */
  abertaAbaixo: (intervalo: string) => `Semana aberta abaixo: ${intervalo}.`,
  /** NEW, B dump dez 11a: the list's heading */
  fora: 'Fora do plano',
  /** NEW, B dump dez 11b */
  semFora: 'Nenhuma operação fora do plano nesta semana.',
  /**
   * NEW (not drawn): the week lies outside the month shown and its own month's read failed (the boards always have
   * the week's numbers); «Tentar de novo» (R) reads it again — J4
   */
  erro: 'Não foi possível carregar a semana.',
}

/** The footer (K) */
export const RODAPE = {
  /** NEW, B dump dez 13 (template `section aria-label`) */
  regiao: 'Sobre os dados',
  /** NEW, B dump dez 13 */
  grava: 'Como o diário grava',
  /** NEW, B dump dez 13 («Como o diário grava» open) */
  gravaTexto:
    'Um pregão de cada vez: o que você planejou, o que você fez e a sua revisão. Cada operação registrada guarda o “Posso operar hoje?” da entrada, com a hora do servidor; as que chegam só pelo arquivo têm o “Posso operar hoje?” recalculado, e a operação mostra isso. As marcas guardam a hora: as de antes da saída contam como limpas. Cada revisão salva fica guardada com a hora; as anteriores ficam para ler.',
  /** NEW, B dump dez 13 */
  linha: 'Apoio à decisão, não recomendação de investimento. Resultados líquidos: a comissão sai quando o arquivo da corretora a traz.',
  /** NEW, B dump dez 13: → /trades?antiga=1 (contract §7.5) */
  antiga: 'Página antiga de operações',
}

/** Where the footer's link goes: the old list, before and after step 4-4's redirect (contract §7.5) */
export const PAGINA_ANTIGA = '/trades?antiga=1'
