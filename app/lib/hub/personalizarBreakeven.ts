/**
 * Fase 3c · Personalizar › Suas regras › «Durante a operação» › «Mover para o breakeven» (Futuros;
 * Personalizar approved 21 Oct, P l.604–639, js P l.1752–1762, 2289–2338; telas contract §6.5):
 * what the row shows that is not the draft itself. Pure: no React.
 *
 *   RAIZES_BREAKEVEN     the futures table's roots the rule offers («Adicionar ativo»), in its order
 *   linhasBreakeven      the lines' order: the saved assets in the table's order, then the ones added
 *                        in this editing session in the order added (values or pending lines)
 *   raizesMaisOperadas   the first switch-on's lines: the roots most traded in the last trades (≤ 3)
 *   itensBreakeven       a version's rule as the version note lists it (the table's order)
 */
import type { BreakevenRule } from '@/lib/domain/gate';
import { tradeMatchKey } from '@/lib/domain/registro';
import { formatDecimal } from './numero';

/** The futures roots of the rule (board BE_ATIVOS): every root of the table, in its order */
export const RAIZES_BREAKEVEN = ['MES', 'MNQ', 'MGC', 'ES', 'NQ', 'GC', 'MCL', 'CL'] as const;
export type RaizBreakeven = (typeof RAIZES_BREAKEVEN)[number];

/** A key's place: the table's roots first, in its order; any other key after them, alphabetically */
function porTabela(a: string, b: string): number {
  const ia = (RAIZES_BREAKEVEN as readonly string[]).indexOf(a);
  const ib = (RAIZES_BREAKEVEN as readonly string[]).indexOf(b);
  if (ia >= 0 && ib >= 0) return ia - ib;
  if (ia >= 0) return -1;
  if (ib >= 0) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The lines in the order the row shows them: the assets the setting holds that were not added in
 * this editing session, in the table's order (so a reload shows the same order), then `sessao` (the
 * assets added here, in the order added: with a value or still pending)
 */
export function linhasBreakeven(by: Readonly<Record<string, string>>, sessao: readonly string[]): string[] {
  const salvas = Object.keys(by)
    .filter((k) => !sessao.includes(k))
    .sort(porTabela);
  return [...salvas, ...sessao.filter((k, i) => sessao.indexOf(k) === i)];
}

/** The roots «Adicionar ativo» offers: every table root not listed, in the table's order */
export const raizesLivres = (listadas: readonly string[]): RaizBreakeven[] => RAIZES_BREAKEVEN.filter((a) => !listadas.includes(a));

/**
 * The first switch-on's lines (E51): the table roots most traded in `trades` (the entity's futures
 * accounts' last 200 each), up to 3, by count, ties by the most recent trade; none → MES
 */
export function raizesMaisOperadas(trades: readonly { symbol: string; entryTime: Date }[]): RaizBreakeven[] {
  const conta = new Map<RaizBreakeven, { n: number; ultimo: number }>();
  for (const t of trades) {
    const key = tradeMatchKey('futures', t.symbol) as RaizBreakeven;
    if (!(RAIZES_BREAKEVEN as readonly string[]).includes(key)) continue;
    const c = conta.get(key) ?? { n: 0, ultimo: 0 };
    conta.set(key, { n: c.n + 1, ultimo: Math.max(c.ultimo, t.entryTime.getTime()) });
  }
  const top = Array.from(conta.entries())
    .sort((a, b) => b[1].n - a[1].n || b[1].ultimo - a[1].ultimo)
    .slice(0, 3)
    .map(([k]) => k);
  return top.length ? top : ['MES'];
}

/**
 * A version's rule as its note lists it («com +8 pts no MES, +30 no MNQ e +5 no MGC»: copy
 * NOTA.breakeven): the table's order, other keys after them alphabetically, «+N» pt-BR («7,5»)
 */
export function itensBreakeven(rule: BreakevenRule | null | undefined): { ativo: string; n: string }[] {
  if (!rule) return [];
  return Object.keys(rule.by)
    .sort(porTabela)
    .map((k) => ({ ativo: k, n: formatDecimal(rule.by[k].n) }));
}
