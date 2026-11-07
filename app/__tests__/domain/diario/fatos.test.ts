/**
 * @jest-environment node
 *
 * The open day's numbers (Phase 4): the tiles from diario_dia's facts (net, gross and commissions
 * for the ⓘ, the limit's worst moment, «fora do plano» and the others), and «Antes de operar»
 * against the day's first entry. Invented data from the approved boards.
 */
import { dayTiles, firstEntryAt, historyTiles, limitPercent, noteTimes, tilesFromCalendar, toneOf } from '@/lib/domain/diario';
import { et } from '@/testing/gate';
import { f19, facts, limitOf, topOneDays } from '@/testing/diario';

describe('the tiles', () => {
  it('19 nov: net −US$ 465,40, the limit reached (100 %), one trade after it, the other four apart', () => {
    const t = dayTiles(f19(), 'futures');
    expect(t.result).toEqual({ net: '-465.4', tone: 'loss' });
    expect(t.operations).toEqual({ n: 5, open: 0, closed: 5, wins: 0, losses: 5, even: 0 });
    expect(t.limit).toEqual({ amount: '400', loss: '465.4', hitAt: et('2026-11-19 10:38'), percent: 100, somando: false, atLimit: 'encerrar' });
    expect(t.fora).toEqual({ n: 1, net: '-38.74', open: 0, allOpen: false });
    expect(t.others).toEqual({ n: 4, net: '-426.66' });
    expect(t.money).toEqual({ gross: '-453', commission: '12.4', pending: false });
    expect(t.history).toBeNull();
  });

  it('1º dez: US$ 45 of US$ 400 at the worst moment (11 %), net +US$ 2,00', () => {
    const t = dayTiles(
      facts({ trades: 4, closed: 4, wins: 2, losses: 2, net: '2', gross: '2', limit: limitOf({ worst: '-45' }) }),
      'futures',
    );
    expect([t.limit?.loss, t.limit?.percent, t.result.tone]).toEqual(['45', 11, 'gain']);
  });

  it('12 nov at 10:42 (board «Hoje»): an open trade with its partial counts; the commission is still to come', () => {
    const t = dayTiles(facts({ trades: 2, closed: 1, open: 1, wins: 1, net: '85', gross: '85', commission: null, commissionUnknown: 1 }), 'futures');
    expect(t.operations).toEqual({ n: 2, open: 1, closed: 1, wins: 1, losses: 0, even: 0 });
    expect(t.money.pending).toBe(true);
    expect(t.limit?.loss).toBe('0');
    expect(t.fora).toBeNull();
  });

  it('no commission is pending where the files bring none (binárias), nor before any result', () => {
    expect(dayTiles(facts({ trades: 3, closed: 3, wins: 2, losses: 1, net: '10.7', gross: '10.7', commissionUnknown: 3, limit: null }), 'binary').money.pending).toBe(false);
    expect(dayTiles(facts({ trades: 1, open: 1 }), 'futures').money.pending).toBe(false);
  });

  it('a known commission on one trade does not make the day net while another still waits for it (review, 9 Oct)', () => {
    // The file's trade came with US$ 2,49; two «Já fechada» still have none (the SQL's commission_unknown)
    const f = facts({ trades: 4, closed: 3, open: 1, net: '54.51', gross: '57', commission: '2.49', commissionUnknown: 2 });
    expect(dayTiles(f, 'futures').money).toEqual({ gross: '57', commission: '2.49', pending: true });
    expect(dayTiles({ ...f, commissionUnknown: 0 }, 'futures').money.pending).toBe(false);
    // Forex and Ações wait for the broker too; Cripto and B3 take «Custos» at the exit
    expect([dayTiles(f, 'forex').money.pending, dayTiles(f, 'stocks').money.pending, dayTiles(f, 'crypto').money.pending, dayTiles(f, 'b3').money.pending]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it('«As outras N» counts the closed trades that kept the plan, the same ones others_net sums (an open trade\'s partial apart)', () => {
    // 30 Oct (review, seed 25): 08:04 outside the window +15, a «Já fechada» +26.25 in the plan, an open trade with a −33.75 partial
    const t = dayTiles(facts({ trades: 3, closed: 2, open: 1, net: '7.5', fora: { n: 1, net: '15', open: 0 }, othersNet: '26.25' }), 'futures');
    expect([t.fora, t.others]).toEqual([{ n: 1, net: '15', open: 0, allOpen: false }, { n: 1, net: '26.25' }]);
    // 21 Oct (seed 10): both «fora» closed, the only trade in the plan still open: no «As outras»
    expect(dayTiles(facts({ trades: 3, closed: 2, open: 1, fora: { n: 2, net: '-20.99', open: 0 }, othersNet: '0' }), 'futures').others).toBeNull();
  });

  it('Lucid 50k on 1º dez: «somando as contas de Futuros», 43 %', () => {
    const t = dayTiles(
      facts({ trades: 2, closed: 2, losses: 2, net: '-127.25', gross: '-127.25', limit: limitOf({ scope: 'soma', worst: '-172.25' }) }),
      'futures',
    );
    expect([t.limit?.somando, t.limit?.loss, t.limit?.percent]).toEqual([true, '172.25', 43]);
  });

  it('every «fora do plano» trade still open: «aberta»', () => {
    const t = dayTiles(facts({ trades: 4, closed: 3, open: 1, fora: { n: 1, net: '0', open: 1 } }), 'binary');
    expect(t.fora).toEqual({ n: 1, net: '0', open: 1, allOpen: true });
    expect(t.others).toEqual({ n: 3, net: '0' });
    // One open, one closed: the closed one's money shows
    expect(dayTiles(facts({ trades: 2, closed: 1, open: 1, fora: { n: 2, net: '-12', open: 1 } }), 'futures').fora?.allOpen).toBe(false);
  });

  it('the misto day keeps its history apart', () => {
    const t = dayTiles(facts({ kind: 'misto', trades: 3, closed: 3, net: '83.14', history: { n: 1, net: '20.01', gross: '21.25' } }), 'futures');
    expect(t.history).toEqual({ n: 1, net: '20.01' });
  });

  it('a history day: only what the file brought; a calendar row gives the same numbers', () => {
    const d8 = topOneDays().find((d) => d.day === '2026-10-08')!;
    expect(historyTiles(d8.history!)).toEqual({
      result: { net: '-458.16', tone: 'loss' },
      operations: { n: 5, open: 0, closed: 5, wins: 0, losses: 5, even: 0 },
      money: { gross: '-447', net: '-458.16' },
    });
    expect(tilesFromCalendar(d8).result.net).toBe('-458.16');
    const d10 = topOneDays().find((d) => d.day === '2026-11-10')!;
    expect(tilesFromCalendar(d10)).toEqual({ result: { net: '267.93', tone: 'gain' }, operations: { n: 5, open: 0, closed: 5, wins: 3, losses: 2, even: 0 } });
  });

  it('tone and percent', () => {
    expect([toneOf('0'), toneOf('-0.01'), toneOf('0.00')]).toEqual(['zero', 'loss', 'zero']);
    expect([limitPercent('0', '400'), limitPercent('172.25', '400'), limitPercent('800', '400'), limitPercent('5', '0')]).toEqual([0, 43, 100, 0]);
  });
});

describe('«Antes de operar»', () => {
  const entries = [
    { entryTime: et('2026-11-12 10:18'), history: false },
    { entryTime: et('2026-11-12 10:04'), history: false },
    { entryTime: et('2026-11-12 08:50'), history: true },
  ];

  it('the first entry ignores history trades', () => {
    expect(firstEntryAt(entries)).toEqual(et('2026-11-12 10:04'));
    expect(firstEntryAt([])).toBeNull();
  });

  it('12 nov: «anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada»', () => {
    const t = noteTimes({ firstSavedAt: et('2026-11-12 09:40'), savedAt: et('2026-11-12 10:42'), versions: 2 }, firstEntryAt(entries));
    expect(t).toEqual({ saved: { at: et('2026-11-12 09:40'), beforeFirstEntry: true }, edited: { at: et('2026-11-12 10:42'), beforeFirstEntry: false } });
  });

  it('before any entry, and an entry in the note\'s own minute', () => {
    expect(noteTimes({ firstSavedAt: et('2026-11-12 09:40'), savedAt: et('2026-11-12 09:40'), versions: 1 }, null)).toEqual({
      saved: { at: et('2026-11-12 09:40'), beforeFirstEntry: true },
      edited: null,
    });
    const sameMinute = noteTimes({ firstSavedAt: new Date(et('2026-11-12 10:04').getTime() + 20_000), savedAt: et('2026-11-12 10:04'), versions: 1 }, et('2026-11-12 10:04'));
    expect(sameMinute.saved.beforeFirstEntry).toBe(false);
  });
});
