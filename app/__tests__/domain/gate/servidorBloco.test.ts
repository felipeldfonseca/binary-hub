/**
 * @jest-environment node
 *
 * parseServerGate reads the gate's final block (contract §3.5, SPEC §5.1–5.3) strictly, before the
 * database sends it (Phase 5 · base): every reason of SPEC §5.1, the evaluated block with `kind`,
 * `releases` codes and `free_at`, and `fase5` forever (frozen entries). Invented answers.
 */
import { answerOf, parseServerGate, ServerGateError } from '@/lib/domain/gate';

type J = Record<string, any>;

/** A Top One answer at Thu 3 Dec 2026 10:05 ET (invented), inside the window */
const sample = (block: J, extra: Partial<J> = {}): J =>
  JSON.parse(
    JSON.stringify({
      at: '2026-12-03T15:05:00+00:00',
      trading_day: '2026-12-03',
      status: 'liberado',
      warnings: [],
      checks_evaluated: block.state === 'nao_avaliado' ? ['janela', 'limite'] : ['janela', 'bloqueio', 'limite'],
      window: {
        state: 'dentro',
        reason: null,
        position: 'dentro',
        current: { opens_at: '2026-12-03T15:00:00+00:00', closes_at: '2026-12-03T16:00:00+00:00' },
        next: null,
      },
      limit: { state: 'ok', reason: null, usd: 400, mode: 'conta', at_limit: 'encerrar', trades: 0, net_usd: 0, worst_usd: 0, hit_at: null, used: 0, near: false },
      block,
      state_rule: { state: 'nao_avaliado', reason: 'fase5' },
      changes_at: '2026-12-03T16:00:00+00:00',
      ...extra,
    }),
  );

/** ISM de serviços at 10:00 ET in «volta» 5/10: the wait 09:55–10:10 */
const ism = (mode = 'volta') => ({
  kind: 'espera',
  start: '2026-12-03T14:55:00+00:00',
  end: '2026-12-03T15:10:00+00:00',
  releases: [{ code: 'ism_serv', at: '2026-12-03T15:00:00+00:00', mode }],
});
/** CPI at 08:30 ET on Thu 10 Dec in «dia»: the account clock's whole day (18:00 to 18:00 ET) */
const cpiDia = () => ({
  kind: 'dia',
  start: '2026-12-09T23:00:00+00:00',
  end: '2026-12-10T23:00:00+00:00',
  releases: [{ code: 'cpi', at: '2026-12-10T13:30:00+00:00', mode: 'dia' }],
});

describe('the block not evaluated: every reason of SPEC §5.1', () => {
  it.each(['sem_versao', 'so_futuros', 'regra_desligada', 'sem_calendario', 'sem_agenda', 'fase5'])('%s', (reason) => {
    const g = parseServerGate(sample({ state: 'nao_avaliado', reason }));
    expect(g.block).toEqual({ evaluated: false, state: 'nao_avaliado', reason });
  });

  it('a frozen Phase 3 entry (block and state rule `fase5`) is still read', () => {
    const g = parseServerGate(sample({ state: 'nao_avaliado', reason: 'fase5' }));
    expect([g.status, g.checksEvaluated, g.stateRule]).toEqual([
      'liberado',
      ['janela', 'limite'],
      { evaluated: false, state: 'nao_avaliado', reason: 'fase5' },
    ]);
  });

  it('an unknown reason is refused', () => {
    expect(() => parseServerGate(sample({ state: 'nao_avaliado', reason: 'sem_dados' }))).toThrow(ServerGateError);
  });
});

describe('the block evaluated', () => {
  it('ok: no active interval, today\'s waits, no free_at', () => {
    const g = parseServerGate(sample({ state: 'ok', active: null, today: [ism()], free_at: null }, { at: '2026-12-03T14:30:00+00:00' }));
    expect(g.block).toEqual({
      evaluated: true,
      state: 'ok',
      active: null,
      today: [
        {
          kind: 'espera',
          start: new Date('2026-12-03T14:55:00Z'),
          end: new Date('2026-12-03T15:10:00Z'),
          releases: [{ code: 'ism_serv', at: new Date('2026-12-03T15:00:00Z'), mode: 'volta' }],
        },
      ],
      freeAt: null,
    });
  });

  it('no_bloqueio in a wait, with free_at: «Aguardar até» names free_at, never the interval\'s end', () => {
    const g = parseServerGate(
      sample(
        { state: 'no_bloqueio', active: ism('depois'), today: [ism('depois')], free_at: '2026-12-03T15:20:00+00:00' },
        { status: 'aguardar', changes_at: '2026-12-03T15:10:00+00:00' },
      ),
    );
    expect(g.block).toMatchObject({ evaluated: true, state: 'no_bloqueio', active: { kind: 'espera' }, freeAt: new Date('2026-12-03T15:20:00Z') });
    expect(answerOf(g)).toEqual({
      kind: 'aguardar',
      until: new Date('2026-12-03T15:20:00Z'),
      releases: [{ code: 'ism_serv', at: new Date('2026-12-03T15:00:00Z'), mode: 'depois' }],
      warnings: [],
    });
  });

  it('no_bloqueio in a wait without free_at (R13b): «Não opero hoje» from the wait', () => {
    const g = parseServerGate(sample({ state: 'no_bloqueio', active: ism(), today: [ism()], free_at: null }, { status: 'aguardar' }));
    expect(g.block).toMatchObject({ state: 'no_bloqueio', freeAt: null });
    expect(answerOf(g)).toMatchObject({ kind: 'dia', source: 'espera_sem_volta' });
  });

  it('no_bloqueio in a whole day', () => {
    const g = parseServerGate(
      sample(
        { state: 'no_bloqueio', active: cpiDia(), today: [cpiDia()], free_at: '2026-12-10T23:00:00+00:00' },
        { at: '2026-12-10T15:05:00+00:00', trading_day: '2026-12-10', status: 'aguardar' },
      ),
    );
    expect(g.block).toMatchObject({ active: { kind: 'dia', releases: [{ code: 'cpi', mode: 'dia' }] } });
    expect(answerOf(g)).toMatchObject({ kind: 'dia', source: 'dia', releases: [{ code: 'cpi' }] });
  });

  it('several releases in one interval keep their order', () => {
    const merged = {
      kind: 'espera',
      start: '2026-12-23T13:25:00+00:00',
      end: '2026-12-23T13:40:00+00:00',
      releases: [
        { code: 'pce', at: '2026-12-23T13:30:00+00:00', mode: 'volta' },
        { code: 'pib_us', at: '2026-12-23T13:30:00+00:00', mode: 'volta' },
      ],
    };
    const g = parseServerGate(sample({ state: 'ok', active: null, today: [merged], free_at: null }));
    expect(g.block.evaluated && g.block.today[0].releases.map((r) => r.code)).toEqual(['pce', 'pib_us']);
  });
});

describe('every other shape is refused (ServerGateError), never read as «no rule»', () => {
  const ok = () => ({ state: 'ok', active: null, today: [ism()], free_at: null });
  const busy = () => ({ state: 'no_bloqueio', active: ism(), today: [ism()], free_at: '2026-12-03T15:10:00+00:00' });
  it.each<[string, () => J, J]>([
    ['a missing key (free_at)', () => { const b: J = ok(); delete b.free_at; return b; }, {}],
    ['a missing key (today)', () => { const b: J = ok(); delete b.today; return b; }, {}],
    ['a missing key (active)', () => { const b: J = ok(); delete b.active; return b; }, {}],
    ['an unknown key', () => ({ ...ok(), label: 'ISM' }), {}],
    ['an unknown state', () => ({ ...ok(), state: 'livre' }), {}],
    ['an unknown kind', () => ({ ...ok(), today: [{ ...ism(), kind: 'pausa' }] }), {}],
    ['an unknown mode', () => ({ ...ok(), today: [{ ...ism(), releases: [{ code: 'ism_serv', at: '2026-12-03T15:00:00+00:00', mode: 'normal' }] }] }), {}],
    ['an unknown code', () => ({ ...ok(), today: [{ ...ism(), releases: [{ code: 'ism', at: '2026-12-03T15:00:00+00:00', mode: 'volta' }] }] }), {}],
    ['a name instead of a code', () => ({ ...ok(), today: [{ ...ism(), releases: [{ code: 'ism_serv', at: '2026-12-03T15:00:00+00:00', mode: 'volta', label: 'ISM' }] }] }), {}],
    ['empty releases', () => ({ ...ok(), today: [{ ...ism(), releases: [] }] }), {}],
    ['an interval with a label', () => ({ ...ok(), today: [{ ...ism(), label: 'ISM' }] }), {}],
    ['a bad instant', () => ({ ...ok(), today: [{ ...ism(), start: '09:55' }] }), {}],
    ['a bad free_at', () => ({ ...busy(), free_at: 'amanhã' }), {}],
    ['today not a list', () => ({ ...ok(), today: null }), {}],
    ['ok with an active interval', () => ({ ...busy(), state: 'ok' }), {}],
    ['no_bloqueio without one', () => ({ ...ok(), state: 'no_bloqueio' }), {}],
    ['ok with a free_at', () => ({ ...ok(), free_at: '2026-12-03T15:10:00+00:00' }), {}],
    ['evaluated without «bloqueio» among the checks', ok, { checks_evaluated: ['janela', 'limite'] }],
    ['not evaluated with «bloqueio» among the checks', () => ({ state: 'nao_avaliado', reason: 'sem_agenda' }), { checks_evaluated: ['janela', 'bloqueio', 'limite'] }],
  ])('%s', (_label, block, extra) => {
    expect(() => parseServerGate(sample(block(), extra))).toThrow(ServerGateError);
  });
});
