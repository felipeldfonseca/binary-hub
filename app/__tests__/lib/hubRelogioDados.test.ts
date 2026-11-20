/**
 * E2 (SPEC §5.6, §5.7; c3 §8.2): the 10-minute notice and the window clock's midnight, armed by the
 * screen on the server clock. The boards' world: Thu 3 Dec 2026, ISM de serviços at 10:00 ET, 5 min
 * before and 10 after → the wait 09:55–10:10, the notice 09:45–09:55.
 */
import { act, renderHook } from '@testing-library/react';
import type { BlockInterval } from '@/lib/domain/gate';
import { relogioDados, useRelogioDados, type RelogioDadosEntrada } from '@/hooks/useRegras';
import { serverClockOf } from '@/lib/hub/relogio';
import { NY, et } from '@/testing/gate';

const ism: BlockInterval = {
  kind: 'espera',
  start: et('2026-12-03 09:55'),
  end: et('2026-12-03 10:10'),
  releases: [{ code: 'ism_serv', at: et('2026-12-03 10:00'), mode: 'volta' }],
};
const diaCpi: BlockInterval = {
  kind: 'dia',
  start: et('2026-12-09 18:00'),
  end: et('2026-12-10 18:00'),
  releases: [{ code: 'cpi', at: et('2026-12-10 08:30'), mode: 'dia' }],
};
const entrada = (over: Partial<RelogioDadosEntrada> = {}): RelogioDadosEntrada => ({ today: [ism], tz: NY, ...over });

describe('relogioDados (pure)', () => {
  it('the notice from start − 10 min until start, then gone', () => {
    expect(relogioDados(et('2026-12-03 09:44:59'), entrada()).avisoDezMin).toBeNull();
    expect(relogioDados(et('2026-12-03 09:45'), entrada()).avisoDezMin).toEqual({ start: ism.start, end: ism.end, releases: ism.releases });
    expect(relogioDados(et('2026-12-03 09:54:59'), entrada()).avisoDezMin).not.toBeNull();
    expect(relogioDados(et('2026-12-03 09:55'), entrada()).avisoDezMin).toBeNull();
  });

  it('the next redraw: start − 10 min, then start, then the window clock\'s midnight', () => {
    expect(relogioDados(et('2026-12-03 09:00'), entrada()).proximo).toEqual(et('2026-12-03 09:45'));
    expect(relogioDados(et('2026-12-03 09:50'), entrada()).proximo).toEqual(et('2026-12-03 09:55'));
    const after = relogioDados(et('2026-12-03 09:55'), entrada());
    expect(after.proximo).toEqual(et('2026-12-04 00:00'));
    expect(after.meiaNoite).toEqual(et('2026-12-04 00:00'));
  });

  it('midnight on the window clock, not the device\'s: 19:00 ET on Wed → Thu 00:00 ET', () => {
    expect(relogioDados(et('2026-12-02 19:00'), entrada({ today: [] })).meiaNoite.toISOString()).toBe('2026-12-03T05:00:00.000Z');
    expect(relogioDados(et('2026-12-02 19:00'), entrada({ today: [], tz: 'America/Sao_Paulo' })).meiaNoite.toISOString()).toBe('2026-12-03T03:00:00.000Z');
  });

  it('a whole day never gives the notice (it starts at the day\'s start)', () => {
    expect(relogioDados(et('2026-12-09 17:55'), entrada({ today: [diaCpi] })).avisoDezMin).toBeNull();
  });

  it('on with alerts absent, or before_block null or true; off only with before_block false', () => {
    const at = et('2026-12-03 09:50');
    expect(relogioDados(at, entrada({ preferences: null })).avisoDezMin).not.toBeNull();
    expect(relogioDados(at, entrada({ preferences: {} })).avisoDezMin).not.toBeNull();
    expect(relogioDados(at, entrada({ preferences: { alerts: { before_block: null as unknown as boolean } } })).avisoDezMin).not.toBeNull();
    expect(relogioDados(at, entrada({ preferences: { alerts: { before_block: true } } })).avisoDezMin).not.toBeNull();
    expect(relogioDados(at, entrada({ preferences: { alerts: { before_block: false } } })).avisoDezMin).toBeNull();
    // the switch turns off the reminder, not the clock: midnight is still armed
    expect(relogioDados(at, entrada({ preferences: { alerts: { before_block: false } } })).proximo).toEqual(et('2026-12-03 09:55'));
  });
});

describe('useRelogioDados (the screen redraws by itself)', () => {
  afterEach(() => jest.useRealTimers());

  it('appears at 09:45 and goes at 09:55 without a new answer; midnight redraws', () => {
    jest.useFakeTimers();
    jest.setSystemTime(et('2026-12-03 09:40'));
    const input = entrada();
    const { result } = renderHook(() => useRelogioDados(null, input));
    expect(result.current.avisoDezMin).toBeNull();
    act(() => void jest.advanceTimersByTime(5 * 60_000 + 100));
    expect(result.current.avisoDezMin?.start).toEqual(ism.start);
    act(() => void jest.advanceTimersByTime(10 * 60_000));
    expect(result.current.avisoDezMin).toBeNull();
    expect(result.current.meiaNoite).toEqual(et('2026-12-04 00:00'));
    act(() => void jest.advanceTimersByTime(et('2026-12-04 00:00').getTime() - et('2026-12-03 09:55').getTime()));
    expect(result.current.meiaNoite).toEqual(et('2026-12-05 00:00'));
  });

  it('counts on the server clock: a device one hour behind still shows the notice at the server\'s 09:45', () => {
    jest.useFakeTimers();
    const device = et('2026-12-03 08:40').getTime();
    jest.setSystemTime(device);
    const clock = serverClockOf(et('2026-12-03 09:40'), device);
    const input = entrada();
    const { result } = renderHook(() => useRelogioDados(clock, input));
    expect(result.current.agora).toEqual(et('2026-12-03 09:40'));
    expect(result.current.avisoDezMin).toBeNull();
    act(() => void jest.advanceTimersByTime(5 * 60_000 + 100));
    expect(result.current.avisoDezMin).not.toBeNull();
  });
});
