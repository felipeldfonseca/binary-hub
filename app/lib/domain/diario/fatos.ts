/**
 * The open day's numbers (Phase 4): the four tiles («Resultado», «Operações», «Limite do dia»,
 * «Fora do plano») and what «Como ler os números do dia» says, from diario_dia's facts; and the
 * times of «Antes de operar» against the day's first entry. Pure: every amount is a SQL sum; this
 * module compares, never adds money.
 *
 * Owner's decision (23 Oct 2026): the result is NET everywhere in the Diário (day, calendar, week,
 * each trade), the same number the limit counts; the gross and the commissions go to the ⓘ. A
 * day whose app trades still lack the broker's commission shows gross, and the ⓘ says so.
 */
import type { AccountMarket } from '../markets';
import { abs, numeric, sign } from '../registro/numeric';
import type { CalendarDay, DayFacts, DayLimit, DayNote, ForaSum, HistoryPart, Money } from './tipos';

export type Tone = 'gain' | 'loss' | 'zero';

/** Mint, red or neutral */
export function toneOf(m: Money): Tone {
  const s = sign(numeric(m));
  return s > 0 ? 'gain' : s < 0 ? 'loss' : 'zero';
}

/**
 * Markets whose broker files bring a commission the app does not know at registration (Futuros,
 * Forex, Ações): their trades show gross until the file arrives. Binaries have none; Cripto and
 * B3 take the costs typed at the exit.
 */
export const COMMISSION_FROM_FILE: readonly AccountMarket[] = ['futures', 'forex', 'stocks', 'options'];

export interface LimitTile {
  /** The limit of the version in force at the day's end */
  amount: Money;
  /** The worst moment as a loss: |worst| ('0' when the day never went below zero) */
  loss: Money;
  hitAt: Date | null;
  /** Bar fill, 0–100: the loss against the limit */
  percent: number;
  somando: boolean;
  atLimit: DayLimit['atLimit'];
}

export interface DayTiles {
  result: { net: Money; tone: Tone };
  operations: { n: number; open: number; closed: number; wins: number; losses: number; even: number };
  /** null when the version has no limit («sem limite · nas suas regras») */
  limit: LimitTile | null;
  /** null when no diário trade broke the plan («nenhuma») */
  fora: (ForaSum & { allOpen: boolean }) | null;
  /** The closed diário trades that kept the plan («As outras 4 somaram −US$ 426,66») */
  others: { n: number; net: Money } | null;
  /** For the ⓘ: the gross, the known commission, and whether the commission is still to come */
  money: { gross: Money; commission: Money | null; pending: boolean };
  /** On the misto day: the history trades of the day, apart («+ 1 operação do histórico, à parte») */
  history: { n: number; net: Money } | null;
}

/** min(100, round(loss × 100 / limit)) */
export function limitPercent(loss: Money, amount: Money): number {
  const a = Number(numeric(amount).units) / 10 ** numeric(amount).scale;
  const l = Number(abs(numeric(loss)).units) / 10 ** numeric(loss).scale;
  if (!(a > 0)) return 0;
  return Math.min(100, Math.round((l * 100) / a));
}

/**
 * The tiles of a diário or misto day from its facts. `market` decides whether a missing
 * commission is «still to come» (COMMISSION_FROM_FILE). A history day has its own tiles
 * (historyTiles).
 */
export function dayTiles(f: DayFacts, market: AccountMarket): DayTiles {
  const foraOpen = f.fora.open;
  const foraClosed = f.fora.n - foraOpen;
  const othersN = Math.max(0, f.closed - foraClosed);
  let limit: LimitTile | null = null;
  if (f.limit) {
    const loss = abs(numeric(f.limit.worst));
    const lossText = sign(loss) === 0 ? '0' : f.limit.worst.replace(/^-/, '');
    limit = {
      amount: f.limit.amount,
      loss: lossText,
      hitAt: f.limit.hitAt,
      percent: limitPercent(lossText, f.limit.amount),
      somando: f.limit.scope === 'soma',
      atLimit: f.limit.atLimit,
    };
  }
  return {
    result: { net: f.net, tone: toneOf(f.net) },
    operations: { n: f.trades, open: f.open, closed: f.closed, wins: f.wins, losses: f.losses, even: f.even },
    limit,
    fora: f.fora.n > 0 ? { ...f.fora, allOpen: foraOpen >= f.fora.n } : null,
    others: f.fora.n > 0 && othersN > 0 ? { n: othersN, net: f.othersNet } : null,
    money: {
      gross: f.gross,
      commission: f.commission,
      pending: f.commission === null && COMMISSION_FROM_FILE.includes(market) && hasRealized(f),
    },
    history: f.kind === 'misto' && f.history.n > 0 ? { n: f.history.n, net: f.history.net } : null,
  };
}

/** Some money was realized on the day (a closed trade, or a partial of an open one) */
function hasRealized(f: DayFacts): boolean {
  return f.closed > 0 || sign(numeric(f.gross)) !== 0;
}

/** A history day's tiles: only what the file brought («—», «o limite ainda não existia», «sem plano») */
export function historyTiles(h: HistoryPart): Pick<DayTiles, 'result' | 'operations'> & { money: { gross: Money; net: Money } } {
  return {
    result: { net: h.net, tone: toneOf(h.net) },
    operations: { n: h.n, open: 0, closed: h.n, wins: h.wins, losses: h.losses, even: h.even },
    money: { gross: h.gross, net: h.net },
  };
}

/** The calendar row's money as tiles, for a day whose facts are not loaded (same numbers, SQL sums) */
export function tilesFromCalendar(d: CalendarDay): Pick<DayTiles, 'result' | 'operations'> {
  if (d.kind === 'historico' && d.history) return historyTiles(d.history);
  return {
    result: { net: d.net, tone: toneOf(d.net) },
    operations: { n: d.n, open: d.open, closed: d.n - d.open, wins: d.wins, losses: d.losses, even: d.even },
  };
}

// ---------------------------------------------------------------------------------------------
// «Antes de operar»
// ---------------------------------------------------------------------------------------------

/** The day's first entry among its diário trades (history trades never count) */
export function firstEntryAt(trades: readonly { entryTime: Date; history?: boolean }[]): Date | null {
  let first: Date | null = null;
  for (const t of trades) {
    if (t.history) continue;
    if (first === null || t.entryTime.getTime() < first.getTime()) first = t.entryTime;
  }
  return first;
}

export interface NoteTime {
  at: Date;
  /** «antes da 1ª entrada» (no entry yet, or the first entry came later); otherwise «depois» */
  beforeFirstEntry: boolean;
}

/**
 * «anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada»: the first
 * save and, after an edit, the newest, each against the day's first entry as it stands now (an
 * entry registered later with an earlier hour moves it). Compared by the minute, as the screen
 * writes them: an entry in the note's own minute makes it «depois da 1ª entrada».
 */
export function noteTimes(note: Pick<DayNote, 'firstSavedAt' | 'savedAt' | 'versions'>, firstEntry: Date | null): {
  saved: NoteTime;
  edited: NoteTime | null;
} {
  const minute = (d: Date) => Math.floor(d.getTime() / 60_000);
  const at = (d: Date): NoteTime => ({ at: d, beforeFirstEntry: firstEntry === null || minute(firstEntry) > minute(d) });
  return { saved: at(note.firstSavedAt), edited: note.versions > 1 ? at(note.savedAt) : null };
}
