/**
 * Windows as «Quando você opera» shows and edits them: the time range, the days summary, the
 * caption on the other clock (with the new time in the 14 days before a clock change), the
 * suggested windows, and switching a market's clock. Pure: time is an input, the words come from
 * components/hub/personalizar/copy.ts.
 *
 * Window minutes always live on the window's own clock (by default America/New_York for futures,
 * Forex and Ações, America/Sao_Paulo for binaries, Cripto and B3: MARKET_SPEC[m].windowTz);
 * «today's offsets» are the two zones' UTC offsets at `now`, as on the board (`OFF.agora`).
 */
import { formatHhMm, nextOffsetChange, utcOffsetMinutes, utcToLocal } from '@/lib/domain/tempo';
import { ACCOUNT_MARKETS, MARKET_SPEC, type AccountMarket, type WindowTz } from '@/lib/domain/gate';
import { DIAS_CURTOS, DIAS_NENHUM, DIAS_TODOS, LEGENDA, RELOGIO, SEP } from '@/components/hub/personalizar/copy';
import { formatDiaMes } from './formato';
import type { RulesSettings, WindowSetting } from './regras';

export const NY: WindowTz = 'America/New_York';
export const BR: WindowTz = 'America/Sao_Paulo';
export const WINDOW_CLOCKS: readonly WindowTz[] = [NY, BR];

const byMarket = <T>(f: (m: AccountMarket) => T) => Object.fromEntries(ACCOUNT_MARKETS.map((m) => [m, f(m)])) as Record<AccountMarket, T>;

/** The clock a market's window starts on (board `relPadrao`; MARKET_SPEC[m].windowTz) */
export const RELOGIO_PADRAO: Record<AccountMarket, WindowTz> = byMarket((m) => MARKET_SPEC[m].windowTz);

/**
 * «+ Definir janela» (board `janSugestao`, ImportarConta `X.MK[*].sug`; MARKET_SPEC[m].window):
 * the owner's windows, seg–sex (Futuros 10:00–11:00 ET, Binárias 20:00–21:00 de Brasília); Forex
 * 08:00–10:00 ET, Ações 09:30–10:30 ET, B3 10:00–11:00 de Brasília, seg–sex; Cripto 20:00–22:00 de
 * Brasília, every day
 */
export const JANELA_SUGERIDA: Record<AccountMarket, WindowSetting> = byMarket((m) => {
  const s = MARKET_SPEC[m];
  return { tz: s.windowTz, startMin: s.window.startMin, endMin: s.window.endMin, weekdays: s.window.weekdays };
});

/**
 * «+ Segunda janela» (board `SEG`; MARKET_SPEC[m].secondWindow), on the market's clock: Futuros
 * 14:00–15:00, Binárias 09:00–10:00, Forex 03:00–05:00, Ações 15:00–16:00, Cripto 09:00–11:00, B3
 * 14:00–15:00
 */
export const SEGUNDA_SUGERIDA: Record<AccountMarket, { startMin: number; endMin: number }> = byMarket((m) => ({
  startMin: MARKET_SPEC[m].secondWindow.startMin,
  endMin: MARKET_SPEC[m].secondWindow.endMin,
}));

const DAY = 1440;
const norm = (m: number) => ((m % DAY) + DAY) % DAY;
const hm = (m: number) => formatHhMm(norm(m));
const otherClock = (tz: WindowTz): WindowTz => (tz === NY ? BR : NY);

/** 600, 660 → '10:00–11:00' */
export function faixaJanela(startMin: number, endMin: number): string {
  return `${hm(startMin)}–${hm(endMin)}`;
}

/** The window ends the next day («do dia seguinte») */
export const viraODia = (w: Pick<WindowSetting, 'startMin' | 'endMin'>) => w.endMin < w.startMin;

/** «seg–sex» (3+ consecutive days), «seg, qua», «todos os dias», «nenhum dia marcado» (board `resumoDias`) */
export function resumoDias(weekdays: number): string {
  const on: number[] = [];
  for (let i = 0; i < 7; i++) if (weekdays & (1 << i)) on.push(i);
  if (!on.length) return DIAS_NENHUM;
  if (on.length === 7) return DIAS_TODOS;
  if (on.length >= 3 && on[on.length - 1] - on[0] + 1 === on.length) return `${DIAS_CURTOS[on[0]]}–${DIAS_CURTOS[on[on.length - 1]]}`;
  return on.map((i) => DIAS_CURTOS[i]).join(', ');
}

type Offsets = Record<WindowTz, number>;

function offsetsAt(at: Date): Offsets {
  return { [NY]: utcOffsetMinutes(at, NY), [BR]: utcOffsetMinutes(at, BR) } as Offsets;
}

/** The window on the other clock with the given offsets (board `legenda`) */
function legendaCom(w: WindowSetting, offs: Offsets): string {
  const o = otherClock(w.tz);
  const a = w.startMin + (offs[o] - offs[w.tz]);
  const b = a + norm(w.endMin - w.startMin);
  let t = `${hm(a)}–${hm(b)} ${RELOGIO[o].em}`;
  if (a >= DAY) t += LEGENDA.jaNoDiaSeguinte;
  else if (a < 0) t += LEGENDA.aindaNoDiaAnterior;
  else if (b > DAY) t += LEGENDA.ateODiaSeguinte;
  return t;
}

/** The first change of either clock's offset in the next `withinDays` days, with its date on that clock */
export function proximaMudancaDeHorario(now: Date, withinDays: number): { at: Date; day: string } | null {
  let best: { at: Date; day: string } | null = null;
  for (const tz of WINDOW_CLOCKS) {
    const c = nextOffsetChange(now, tz, withinDays);
    if (c && (!best || c.at.getTime() < best.at.getTime())) best = { at: c.at, day: utcToLocal(c.at, tz).date };
  }
  return best;
}

/**
 * The caption without the days: the window on the other clock at today's offsets, «11:00–12:00 em
 * Brasília», «19:00–20:00 ET, já no dia seguinte»; in the 14 days before either clock changes, also
 * «; a partir de 1º nov: 12:00–13:00 em Brasília». Empty when start = end (an error).
 */
export function legendaJanela(w: WindowSetting, now: Date): string {
  if (w.startMin === w.endMin) return '';
  let t = legendaCom(w, offsetsAt(now));
  const change = proximaMudancaDeHorario(now, 14);
  if (change) {
    const t2 = legendaCom(w, offsetsAt(change.at));
    if (t2 !== t) t += LEGENDA.aPartirDe(formatDiaMes(change.day), t2);
  }
  return t;
}

/**
 * The whole caption under a window line: «11:00–12:00 em Brasília · seg–sex» (no-break spaces
 * around the « · »: SEP); start = end: the days only
 */
export function captionJanela(w: WindowSetting, now: Date): string {
  const l = legendaJanela(w, now);
  const d = resumoDias(w.weekdays);
  return l ? `${l}${SEP}${d}` : d;
}

/** «a próxima é {d}» in the info panel: New York's next change, on its own calendar ('1º nov') */
export function proximaMudancaNY(now: Date): string | null {
  const c = nextOffsetChange(now, NY, 400);
  return c ? formatDiaMes(utcToLocal(c.at, NY).date) : null;
}

function rotateWeekdays(mask: number, shift: number): number {
  if (!shift) return mask;
  let out = 0;
  for (let i = 0; i < 7; i++) if (mask & (1 << i)) out |= 1 << ((i + shift + 7) % 7);
  return out;
}

/**
 * The same window on another clock, keeping its instants at today's offsets: 10:00–11:00 ET →
 * 11:00–12:00 Brasília in October. A start that moves across midnight moves its days with it
 * (00:30 Brasília on segunda = 23:30 ET on domingo), so the instants stay the same.
 */
export function converterJanela(w: WindowSetting, tz: WindowTz, now: Date): WindowSetting {
  if (w.tz === tz) return w;
  const d = utcOffsetMinutes(now, tz) - utcOffsetMinutes(now, w.tz);
  const s = w.startMin + d;
  const shift = s < 0 ? -1 : s >= DAY ? 1 : 0;
  return { tz, startMin: norm(s), endMin: norm(w.endMin + d), weekdays: rotateWeekdays(w.weekdays, shift) };
}

/**
 * «Relógio da janela»: every window of the market and the own windows of `accountIds` (its active
 * accounts) go to `tz`, keeping their instants at today's offsets.
 */
export function trocarRelogio(
  s: RulesSettings,
  market: AccountMarket,
  tz: WindowTz,
  now: Date,
  accountIds: readonly string[],
): RulesSettings {
  const m = s.markets[market];
  const accounts = { ...s.accounts };
  for (const id of accountIds) {
    const a = accounts[id];
    if (a?.window) accounts[id] = { ...a, window: converterJanela(a.window, tz, now) };
  }
  return {
    ...s,
    markets: { ...s.markets, [market]: { ...m, windows: m.windows.map((w) => converterJanela(w, tz, now)) } },
    accounts,
  };
}

/** The clock a market's windows are on (its first window's), or the market's default */
export function relogioDoMercado(s: RulesSettings, market: AccountMarket): WindowTz {
  return s.markets[market].windows[0]?.tz ?? RELOGIO_PADRAO[market];
}
