/**
 * Every pt-BR string of the «Posso operar hoje?» card on /diario (Phase 2, lane B; Fase 2b: one line
 * per account of every market, money in the account's currency), in one place so the owner can
 * review them. The answer's words (state, sub, «Definir», the limit amounts) and the
 * window line under the account selector come from lib/hub/posso.ts. Strings come from the Início
 * board (`section[aria-labelledby=t-posso]`) unless marked:
 *   NEW      not on any board (states the boards do not draw)
 *   ADAPTED  a board string changed for Phase 2 (the comment says what changed)
 */
export { LOADING, TRY_AGAIN } from '@/components/hub/contas/copy'

export const POSSO = {
  title: 'Posso operar hoje?',
  infoLabel: 'Como ler: Posso operar hoje?',
  // ADAPTED (Início board v53 `#info-posso`, gate.md §6; Phase 5-1, C3: the start is c3 §5.5 l.1030-1035, word for
  // word; the rest, limit and currencies, stays)
  info:
    'Cada conta responde pelas regras dela: janela, dados econômicos e limite do dia. Dados econômicos: numa espera, a tela diz “Aguardar até” e a hora em que ela termina; ' +
    'num dia que você marcou como “Não opero no dia”, diz “Não opero hoje”. Por enquanto, essa regra vale só em Futuros. O app nunca impede uma operação. ' +
    'Limite do dia: a maior perda do dia, no pior momento, contra o limite da conta, na moeda dela (R$ na B3; US$ nos outros mercados, com USDT e USDC contados como dólar). ' +
    'Contas de mercados diferentes nunca são somadas. Vem das suas regras, nunca da IA.',
  // ADAPTED (gate.md GG9): plain text in Phase 2, no link to the Diário (the card is on it)
  limitLabel: 'Limite do dia',
  separator: '·',
  // NEW: the last read of rules_now failed; older lines are not shown, they may be outdated
  loadError: 'Não foi possível carregar o “Posso operar hoje?”.',
}

/**
 * Phase 5-1 (lane telas-posso): the card's own words around lib/hub/posso's sentences (notasDaConta). Board Q18: the
 * first-wait notice's button (c3 §3.9 l.654; SPEC §7.2 l.1191).
 */
export const POSSO_DADOS = {
  entendi: 'Entendi',
}

/**
 * Phase 4 · telas, lane L1: the card on the Diário (board DiarioDezEnxuto, revision of 25 Oct, «Muitas contas»). The
 * others line, «Ver todas», «Ocultar» and the ⓘ sentence are lib/hub/posso's (possoNoDiario, POSSO_NO_DIARIO_INFO).
 * Markers of the telas contract (§0): NEW = on the board, produced by nothing.
 */
export const POSSO_DIARIO = {
  /** NEW, B dump dez 9 (engine `temSoma`, driven by D possoNoDiario().conta.somando): under the open account's limit */
  somando: 'somando as contas de Futuros',
  /** NEW, B dump dez 9b (template `ul#posso-outras-lista aria-label`): the others' lines after «Ver todas» */
  outrasLista: 'Outras contas',
}
