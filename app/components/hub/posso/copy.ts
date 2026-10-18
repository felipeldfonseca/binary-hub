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
  // ADAPTED (Início board v53 `#info-posso`, gate.md §6): the data block is not checked before
  // Phase 5, and the board's CPI example and «A Ebinex e a IBKR ainda não têm janela nem limite»
  // describe one moment of the prototype
  info:
    'Cada conta responde pelas regras dela: janela e limite do dia. O bloqueio de dados fica ativo na Fase 5 e, por enquanto, vale só em Futuros. ' +
    'Limite do dia: a maior perda do dia, no pior momento, contra o limite da conta, na moeda dela (R$ na B3; US$ nos outros mercados, com USDT e USDC contados como dólar). ' +
    'Contas de mercados diferentes nunca são somadas. Vem das suas regras, nunca da IA.',
  // ADAPTED (gate.md GG9): plain text in Phase 2, no link to the Diário (the card is on it)
  limitLabel: 'Limite do dia',
  separator: '·',
  // NEW: the last read of rules_now failed; older lines are not shown, they may be outdated
  loadError: 'Não foi possível carregar o “Posso operar hoje?”.',
}
