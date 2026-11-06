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
 */

/**
 * R `components/hub/diario/copy.ts` OPERACOES_DIA.offline, copied (not moved) at B0: the Phase 3 bridge keeps using
 * its own until lane L2 retires it (contract §4.7). The band over the page while a Diário read waits for the
 * connection (C5)
 */
export const OFFLINE = 'Sem conexão. Tente de novo quando a conexão voltar.'

/** NEW, B dump hoje 10d: any Diário read failed (also while the Phase 4 SQL is not pasted) — C7 */
export const ERRO_DIARIO = 'Não foi possível carregar o Diário.'
