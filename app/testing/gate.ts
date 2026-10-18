/**
 * Test helpers for the "Posso operar hoje?" domain. Lives outside __tests__ so Jest does not run
 * it as a suite. Every value here is invented.
 */
import { localToUtc, MON_TO_FRI, tradingDayOn, type DayClock } from '@/lib/domain';
import type { DayTrade, GateAccount, Rules, RuleVersion } from '@/lib/domain/gate';

export const NY = 'America/New_York';
export const SP = 'America/Sao_Paulo';
export const TOP_CLOCK: DayClock = { tz: NY, startMin: 1080 };
export const BIN_CLOCK: DayClock = { tz: SP, startMin: 0 };

function wall(text: string, tz: string): Date {
  const [d, t] = text.split(' ');
  const [year, month, day] = d.split('-').map(Number);
  const [hour, minute, second = 0] = t.split(':').map(Number);
  return localToUtc({ year, month, day, hour, minute, second }, tz);
}
/** '2026-10-19 10:30' on New York's clock */
export const et = (text: string) => wall(text, NY);
/** '2026-10-19 20:30' on Brasília's clock */
export const brt = (text: string) => wall(text, SP);

/** The owner's Top One rules after the Phase 2 save: 10:00–11:00 ET Mon–Fri, US$ 400 per account, closes the day */
export const topOneRules = (): Rules => ({
  market: 'futures',
  windows: [{ tz: NY, startMin: 600, endMin: 660, weekdays: MON_TO_FRI }],
  windowsFrom: 'market',
  windowRule: { on: true, outside: 'fora' },
  block: { on: true, beforeMin: 5, afterMin: 10, calendars: ['us'] },
  limit: { cents: 40000, mode: 'conta', atLimit: 'encerrar' },
  states: { alinhadas: null, so_tecnica: null, so_fundamentos: null, em_conflito: null, sem_direcao: null },
  day: TOP_CLOCK,
});

/** The owner's Ebinex rules: 20:00–21:00 Brasília Mon–Fri, no limit */
export const ebinexRules = (): Rules => ({
  market: 'binary',
  windows: [{ tz: SP, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }],
  windowsFrom: 'market',
  windowRule: { on: true, outside: 'fora' },
  block: null,
  limit: null,
  states: null,
  day: BIN_CLOCK,
});

export const TOP_ONE: GateAccount = { market: 'futures', dayClock: TOP_CLOCK };
export const EBINEX: GateAccount = { market: 'binary', dayClock: BIN_CLOCK };

export const version = (rules: Rules, extra: Partial<RuleVersion> = {}): RuleVersion => ({ rules, ...extra });

let seq = 0;
/** A closed futures trade on the Top One clock: entry and exit in ET, P&L and commission in dollars */
export function trade(entry: string, exit: string | null, usd: number, commissionUsd: number | null = null): DayTrade {
  seq += 1;
  const entryAt = et(entry);
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    tradingDay: tradingDayOn(entryAt, TOP_CLOCK),
    entryAt,
    exitAt: exit === null ? null : et(exit),
    pnlCents: Math.round(usd * 100),
    commissionCents: commissionUsd === null ? null : Math.round(commissionUsd * 100),
    result: usd > 0 ? 'win' : usd < 0 ? 'loss' : 'breakeven',
  };
}
