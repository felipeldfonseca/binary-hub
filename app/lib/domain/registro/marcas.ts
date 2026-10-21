/**
 * Marks (setup, execução, emoção, seguiu o texto) and when they are «limpas»: the database's views
 * trade_marks_v and trade_marks_now_v (migration 20261020000001), for previews and the chips
 * («às 10:07 · antes da saída» / «depois do resultado»). The server's answers carry `limpa` for
 * every stored mark; these give the same answer before it arrives.
 *
 * A mark is «limpa» (counts as «antes da saída») when it was made on a trade registered live,
 * strictly before its result could be known (the exit typed, or a binary's expiry) and before the
 * app registered the exit. Every other mark is «depois do resultado»: «Já fechada» trades,
 * imported trades, marks after the exit. What counts in Análises is the last «limpa» one.
 *
 * Phase 3c (20261023000002_trade_exits.sql): the first exit not undone (a partial reveals part of
 * the result) cuts too, at its hour or its registration, whichever is first
 * (parciais.firstExitCut).
 */
import type { MarkKind } from './payload';

/** trade_entry_context.origin: live = registered while open; reconstructed = «Já fechada»; null = none */
export type EntryOrigin = 'live' | 'reconstructed';

/** The checks of «Posso operar hoje?» and the plan (the database's names) */
export type EntryCheck = 'janela' | 'bloqueio' | 'limite' | 'estado';
export type EntryBreak = 'fora_da_janela' | 'no_bloqueio' | 'depois_do_limite' | 'contra_a_regra';

/**
 * trade_entry_plan: the plan of a stored entry context, as evaluatePlan gives it (marks in
 * BREAK_ORDER; «No plano» only when some check ran; a check that did not run is null, never ok)
 */
export function entryPlanOf(ctx: {
  inWindow: boolean | null;
  inBlock: boolean | null;
  afterLimit: boolean | null;
  ruleOk: boolean | null;
  checksEvaluated: readonly EntryCheck[];
}): { breaks: EntryBreak[]; verdict: 'fora_do_plano' | 'no_plano' | 'nao_avaliado'; checksEvaluated: EntryCheck[] } {
  const breaks: EntryBreak[] = [];
  if (ctx.inWindow === false) breaks.push('fora_da_janela');
  if (ctx.inBlock === true) breaks.push('no_bloqueio');
  if (ctx.afterLimit === true) breaks.push('depois_do_limite');
  if (ctx.ruleOk === false) breaks.push('contra_a_regra');
  return {
    breaks,
    verdict: breaks.length > 0 ? 'fora_do_plano' : ctx.checksEvaluated.length > 0 ? 'no_plano' : 'nao_avaliado',
    checksEvaluated: [...ctx.checksEvaluated],
  };
}

/** trade_result_known_at: the exit or the expiry, whichever is first; null while neither is known */
export function resultKnownAt(exitTime: Date | null, expiresAt: Date | null): Date | null {
  if (exitTime === null) return expiresAt;
  if (expiresAt === null) return exitTime;
  return exitTime.getTime() <= expiresAt.getTime() ? exitTime : expiresAt;
}

export interface MarkTiming {
  origin: EntryOrigin | null;
  exitTime: Date | null;
  expiresAt: Date | null;
  exitRegisteredAt: Date | null;
  /** Phase 3c: the earliest exit not undone, least(exit_time, registered_at); absent or null = none */
  firstExit?: Date | null;
}

/**
 * The instant from which a new mark is «depois do resultado»: the earliest of the result being
 * known and the exit being registered; null while a live trade has neither (a mark made now is
 * still «antes da saída»). Not defined for trades that were not registered live (every mark is
 * after): see isClean.
 */
export function cleanUntil(t: MarkTiming): Date | null {
  let best: Date | null = null;
  for (const d of [resultKnownAt(t.exitTime, t.expiresAt), t.exitRegisteredAt, t.firstExit ?? null]) {
    if (d !== null && (best === null || d.getTime() < best.getTime())) best = d;
  }
  return best;
}

/** trade_marks_v.limpa for a mark made at `markedAt` */
export function isClean(markedAt: Date, t: MarkTiming): boolean {
  if (t.origin !== 'live') return false;
  const until = cleanUntil(t);
  return until === null || markedAt.getTime() < until.getTime();
}

/** One stored mark (trade_marks_v) */
export interface MarkEvent {
  id: number;
  kind: MarkKind;
  /** null = «desmarcar» */
  value: string | null;
  markedAt: Date;
  limpa: boolean;
}

/** Per trade and kind (trade_marks_now_v): the current mark and the one that counts in Análises */
export interface MarkNow {
  kind: MarkKind;
  currentValue: string | null;
  currentAt: Date;
  currentLimpa: boolean;
  /** The last «limpa» mark (what Análises counts); null when none was made in time */
  cleanValue: string | null;
  cleanAt: Date | null;
  /** A «limpa» mark exists and the current one, made after, differs («trocada» / «desmarcada») */
  changedAfter: boolean;
}

const latestFirst = (a: MarkEvent, b: MarkEvent) => b.markedAt.getTime() - a.markedAt.getTime() || b.id - a.id;

/** trade_marks_now_v of one trade's marks, ordered by kind as trade_state lists them */
export function marksNow(events: readonly MarkEvent[]): MarkNow[] {
  const kinds = Array.from(new Set(events.map((e) => e.kind))).sort();
  return kinds.map((kind) => {
    const mine = events.filter((e) => e.kind === kind).sort(latestFirst);
    const current = mine[0];
    const clean = mine.find((e) => e.limpa) ?? null;
    return {
      kind,
      currentValue: current.value,
      currentAt: current.markedAt,
      currentLimpa: current.limpa,
      cleanValue: clean ? clean.value : null,
      cleanAt: clean ? clean.markedAt : null,
      changedAfter: clean !== null && !current.limpa && current.value !== clean.value,
    };
  });
}
