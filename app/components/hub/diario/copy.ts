/**
 * The «Operação» cell's second line, read by lib/hub/registrarParciais.subDaPonte (Phase 3c, board approved 21 Oct, RO
 * js l.2193–2199): «1 parcial, +US$ 40,00 · stop no breakeven», «em 2 saídas». The Diário's other words are
 * copyDia.ts (Phase 4, telas); the Phase 3 bridge that held them was retired.
 */
export const OPERACOES_DIA = {
  /** «1 parcial, +US$ 40,00» / «2 parciais, +US$ 65,00» */
  parciais: (n: number, v: string) => (n === 1 ? `1 parcial, ${v}` : `${n} parciais, ${v}`),
  stopBe: 'stop no breakeven',
  stopMovido: 'stop movido',
  /** A closed trade: «em 2 saídas» */
  emSaidas: (n: number) => `em ${n} saídas`,
}
