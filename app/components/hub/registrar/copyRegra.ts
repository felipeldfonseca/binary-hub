/**
 * Phase 3c: the breakeven rule's words shared by step 1 (lane C2) and steps 2–3 (lane C1).
 * Board: RegistrarOperacao.dc.html approved 21 Oct (16 scenarios). B = board copy, N = new.
 */
export const REGRA_BE = {
  /** «+8 pts» (B, RO js l.1432) · «+7,5 pips» · «+0,50 no preço» (N: the board draws futures only) */
  n: (valor: string, un: 'pts' | 'pips' | 'price') => (un === 'pts' ? `+${valor} pts` : un === 'pips' ? `+${valor} pips` : `+${valor} no preço`),
  /** «Sua regra: breakeven com +8 pts, em 7.920,50.» / «Sua regra: breakeven com +8 pts.» (B, RO js l.1432, 1650, 1746) */
  linha: (n: string, nivel: string | null) => (nivel ? `Sua regra: breakeven com ${n}, em ${nivel}.` : `Sua regra: breakeven com ${n}.`),
  /** «Com +8,00 pts a favor» / «com +12,00 pts a favor» (B, RO js l.1497) */
  aFavor: (dif: string, maiuscula: boolean) => `${maiuscula ? 'Com' : 'com'} ${dif} a favor`,
  /** «Com 3,00 pts contra» (B; `dif` without its sign) */
  contra: (dif: string, maiuscula: boolean) => `${maiuscula ? 'Com' : 'com'} ${dif} contra`,
  /** «Com o preço na entrada» (B) */
  naEntrada: (maiuscula: boolean) => `${maiuscula ? 'Com' : 'com'} o preço na entrada`,
}
