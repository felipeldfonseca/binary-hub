/**
 * The payloads the Registrar sends, built from the form's values (already read as decimal text by
 * the pt-BR number reader): only the keys the market's form has, the stop and target under the
 * instrument's unit (stop_pts, stop_pips or stop_price), numbers as strings. Whatever these build,
 * checkPayload and the database read the same way.
 */
import type { AccountMarket } from '../markets';
import { tradeInstrument, type Direction, type OptionContract } from './caps';
import {
  MAX_IMAGE_NAME,
  type AfterPayload,
  type Clock,
  type EntryPayload,
  type ExitPayload,
  type ExtrasPayload,
  type ImageMime,
  type ImageSlotsRequest,
  type Marks,
  type MarksPayload,
  type Outcome,
} from './payload';

export interface EntryFields {
  /** Required unless a dry run: one per form, kept across retries (C23) */
  clientKey?: string;
  symbol: string;
  direction: Direction;
  /** Price markets, decimal text */
  quantity?: string;
  entryPrice?: string;
  /** In the instrument's unit (InstrumentSpec.stops) */
  stop?: string;
  target?: string;
  /** Ações e opções */
  option?: OptionContract;
  /** Binaries */
  stake?: string;
  payout?: string;
  durationS?: number;
  /** The account's window clock */
  clock: Clock;
  /** "HH:MM"; left out = now */
  entry?: string;
  marks?: Marks;
  allowSimilar?: boolean;
}

function put<T extends object, K extends string>(o: T, k: K, v: unknown): void {
  if (v !== undefined) (o as Record<string, unknown>)[k] = v;
}

/** register_entry's payload («Registrar entrada»; a dry run may leave clientKey out) */
export function entryPayload(market: AccountMarket, f: EntryFields): EntryPayload {
  const p = { v: 1, symbol: f.symbol, direction: f.direction } as EntryPayload;
  put(p, 'client_key', f.clientKey);
  if (market === 'binary') {
    put(p, 'stake', f.stake);
    put(p, 'payout', f.payout);
    put(p, 'duration_s', f.durationS);
  } else {
    put(p, 'quantity', f.quantity);
    put(p, 'entry_price', f.entryPrice);
    const unit = tradeInstrument(market, f.symbol, f.option ?? null)?.stops ?? 'price';
    put(p, `stop_${unit}`, f.stop);
    put(p, `target_${unit}`, f.target);
    put(p, 'option', f.option);
  }
  p.clock = f.clock;
  put(p, 'entry', f.entry);
  put(p, 'marks', f.marks && Object.keys(f.marks).length > 0 ? f.marks : undefined);
  put(p, 'allow_similar', f.allowSimilar);
  return p;
}

export interface AfterFields extends Omit<EntryFields, 'entry'> {
  /** The trading day («Dia»), YYYY-MM-DD */
  day: string;
  entry: string;
  /** Price markets */
  exit?: string;
  exitPrice?: string;
  /** A typed result (signed decimal text) where the result is typed, or a correction */
  pnl?: string;
  costs?: string;
  /** Binaries */
  outcome?: Outcome;
}

/** register_after's payload («Já fechada») */
export function afterPayload(market: AccountMarket, f: AfterFields): AfterPayload {
  const p = { ...entryPayload(market, f), day: f.day, entry: f.entry } as AfterPayload;
  if (market === 'binary') put(p, 'outcome', f.outcome);
  else {
    put(p, 'exit', f.exit);
    put(p, 'exit_price', f.exitPrice);
    put(p, 'pnl', f.pnl);
    put(p, 'costs', f.costs);
  }
  return p;
}

export interface ExitFields {
  /** Price markets */
  exitPrice?: string;
  /** "HH:MM"; left out = now */
  exit?: string;
  clock?: Clock;
  pnl?: string;
  costs?: string;
  /** Binaries */
  outcome?: Outcome;
}

/** register_exit's payload («Registrar saída» / «Registrar resultado») */
export function exitPayload(market: AccountMarket, f: ExitFields): ExitPayload {
  const p: ExitPayload = { v: 1 };
  if (market === 'binary') {
    put(p, 'outcome', f.outcome);
    return p;
  }
  put(p, 'exit_price', f.exitPrice);
  put(p, 'exit', f.exit);
  put(p, 'clock', f.clock);
  put(p, 'pnl', f.pnl);
  put(p, 'costs', f.costs);
  return p;
}

/** add_marks' payload: one tap = one mark (null = «desmarcar») */
export const marksPayload = (marks: Marks): MarksPayload => ({ v: 1, marks });

/** image_slots' request: the saved images kept and the new files to reserve */
export function imageSlotsRequest(keep: readonly string[], files: readonly { mime: ImageMime; bytes: number; name: string }[]): ImageSlotsRequest {
  return { v: 1, keep: [...keep], new: files.map((f) => ({ mime: f.mime, bytes: f.bytes, name: f.name })) };
}

/** save_extras' payload: `images` is the final ordered list; leave a key out to keep it as is */
export function extrasPayload(x: { note?: string | null; images?: readonly string[] }): ExtrasPayload {
  const p: ExtrasPayload = { v: 1 };
  put(p, 'note', x.note);
  put(p, 'images', x.images ? [...x.images] : undefined);
  return p;
}

/** Control characters the database's [[:cntrl:]] may refuse (C0, DEL, C1, line and paragraph separators) */
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

/**
 * A file's name as the image keeps it (display only, at most MAX_IMAGE_NAME characters, no control
 * characters; C9): a long name is shortened in the middle and keeps its extension
 * («MES_10-04_entr…ada.png»); an empty one becomes «imagem».
 */
export function imageName(name: string, max = MAX_IMAGE_NAME): string {
  const chars = Array.from(String(name ?? '').replace(CONTROL, '').trim());
  if (chars.length === 0) return 'imagem';
  if (chars.length <= max) return chars.join('');
  const dot = chars.lastIndexOf('.');
  const ext = dot > 0 && chars.length - dot <= 10 ? chars.slice(dot) : [];
  const room = max - ext.length - 1;
  const head = Math.ceil(room / 2);
  const stem = chars.slice(0, chars.length - ext.length);
  return [...stem.slice(0, head), '…', ...stem.slice(stem.length - (room - head)), ...ext].join('');
}
