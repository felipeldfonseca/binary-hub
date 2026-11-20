/**
 * @jest-environment node
 *
 * answerOf = SPEC §5.4's table, one case per cell, on hand-built GateResults (the status and the
 * checks as gate_eval computes them). The SQL-computed cells go to cases5.json (group `gate`, the
 * domain lane). Also: «Não opero hoje» from a whole day or a wait with no way back (R13b), and
 * `liberado.until` = the start of a wait still to come inside the window (SPEC §7.2 l.1164).
 */
import {
  answerOf,
  type BlockCheck,
  type BlockInterval,
  type CheckKey,
  type GateResult,
  type GateStatus,
  type GateWarning,
  type LimitCheck,
  type WindowCheck,
} from '@/lib/domain/gate';

const T = (hhmm: string) => new Date(`2026-12-03T${hhmm}:00-05:00`); // Thu 3 Dec 2026, ET
const AT = T('10:05');

const nao = <R extends string>(reason: R) => ({ evaluated: false as const, state: 'nao_avaliado' as const, reason });

type Janela = 'dentro' | 'fora' | 'sem_janela' | 'desligada' | 'sem_versao';
type Limite = 'ok' | 'avisa' | 'encerra' | 'sem_dados' | 'sem_limite' | 'sem_versao';
type Bloco = 'espera' | 'livre' | 'sem_agenda' | 'sem_calendario' | 'desligado' | 'so_futuros' | 'sem_versao';

const ISM: BlockInterval = {
  kind: 'espera',
  start: T('09:55'),
  end: T('10:10'),
  releases: [{ code: 'ism_serv', at: T('10:00'), mode: 'volta' }],
};

function window(j: Janela): WindowCheck {
  if (j === 'sem_versao') return nao('sem_versao');
  if (j === 'desligada') return nao('regra_desligada');
  if (j === 'sem_janela') return nao('sem_janela');
  const occ = { start: T('10:00'), end: T('11:00') };
  return j === 'dentro'
    ? { evaluated: true, state: 'dentro', position: 'dentro', current: occ, next: null }
    : { evaluated: true, state: 'fora', position: 'antes', current: null, next: { start: T('14:00'), end: T('15:00'), tradingDay: '2026-12-03' } };
}

function limit(l: Limite): LimitCheck {
  if (l === 'sem_versao') return nao('sem_versao');
  if (l === 'sem_dados') return nao('sem_dados');
  if (l === 'sem_limite') return nao('sem_limite');
  const hit = l !== 'ok';
  return {
    evaluated: true,
    state: hit ? 'atingido' : 'ok',
    cents: 40000,
    mode: 'conta',
    atLimit: l === 'avisa' ? 'avisar' : 'encerrar',
    trades: 2,
    netCents: hit ? -41000 : -5000,
    worstCents: hit ? -41000 : -5000,
    hitAt: hit ? T('09:40') : null,
    used: hit ? 1.025 : 0.125,
    near: hit,
  };
}

function block(b: Bloco, active: BlockInterval = ISM, freeAt: Date | null = T('10:10')): BlockCheck {
  if (b === 'espera') return { evaluated: true, state: 'no_bloqueio', active, today: [active], freeAt };
  if (b === 'livre') return { evaluated: true, state: 'ok', active: null, today: [], freeAt: null };
  return nao(b === 'desligado' ? 'regra_desligada' : b);
}

/** gate_eval's status, checks and warnings for these three checks (outside = «fora», as Top One) */
function gate(j: Janela, l: Limite, b: Bloco | BlockCheck): GateResult {
  const w = window(j);
  const lim = limit(l);
  const blk = typeof b === 'string' ? block(b) : b;
  const checksEvaluated: CheckKey[] = [];
  if (w.evaluated) checksEvaluated.push('janela');
  if (blk.evaluated) checksEvaluated.push('bloqueio');
  if (lim.evaluated) checksEvaluated.push('limite');
  const closed = lim.evaluated && lim.state === 'atingido' && lim.atLimit === 'encerrar';
  const status: GateStatus | null =
    checksEvaluated.length === 0
      ? null
      : closed
        ? 'encerrado'
        : blk.evaluated && blk.active
          ? 'aguardar'
          : w.evaluated && w.state === 'fora'
            ? 'fora_janela'
            : 'liberado';
  const warnings: GateWarning[] = lim.evaluated && lim.state === 'atingido' && lim.atLimit === 'avisar' ? ['limite'] : [];
  return {
    at: AT,
    tradingDay: '2026-12-03',
    status,
    warnings,
    checksEvaluated,
    window: w,
    limit: lim,
    block: blk,
    stateRule: nao('fase5'),
    changesAt: null,
  };
}

const AG = { kind: 'aguardar', until: T('10:10'), releases: ISM.releases, warnings: [] };
const JA = { kind: 'liberado', position: 'dentro', until: T('11:00'), next: null, warnings: [], semAgenda: false };
const JA_ = { ...JA, semAgenda: true };
const LV = { kind: 'liberado', position: null, until: null, next: null, warnings: [], semAgenda: false };
const LV_ = { ...LV, semAgenda: true };
const SJ = { kind: 'sem_janela', reason: 'sem_janela' };
const ID = { kind: 'indisponivel', reason: 'sem_dados' };
const IA = { kind: 'indisponivel', reason: 'sem_agenda' };
const SR = { kind: 'sem_janela', reason: 'regra_desligada' };

describe('SPEC §5.4: window × limit × block, one case per cell', () => {
  // Columns: com espera · sem espera · sem_agenda · sem_calendario · desligado (regra_desligada; so_futuros alike)
  const COLS: Bloco[] = ['espera', 'livre', 'sem_agenda', 'sem_calendario', 'desligado'];
  const ROWS: [string, Janela, Limite, object[]][] = [
    ['avaliada (dentro), limite qualquer', 'dentro', 'ok', [AG, JA, JA_, JA, JA]],
    ['avaliada (dentro), sem limite', 'dentro', 'sem_limite', [AG, JA, JA_, JA, JA]],
    ['avaliada (dentro), limite sem_dados (Phase 2: the window answers, green included)', 'dentro', 'sem_dados', [AG, JA, JA_, JA, JA]],
    ['sem_janela, limite avaliado', 'sem_janela', 'ok', [AG, SJ, SJ, SJ, SJ]],
    ['sem_janela, sem limite (status null except with the block)', 'sem_janela', 'sem_limite', [AG, SJ, SJ, SJ, SJ]],
    ['desligada, limite avaliado', 'desligada', 'ok', [AG, LV, LV_, LV, LV]],
    ['desligada, limite sem_dados', 'desligada', 'sem_dados', [AG, ID, ID, ID, ID]],
    ['desligada, sem limite', 'desligada', 'sem_limite', [AG, LV, IA, SR, SR]],
  ];
  for (const [name, j, l, want] of ROWS) {
    describe(name, () => {
      it.each(COLS.map((c, i) => [c, want[i]] as const))('%s', (c, expected) => {
        expect(answerOf(gate(j, l, c))).toEqual(expected);
      });
    });
  }

  it('sem versão: «Sem janela salva» with the reason sem_versao, status null', () => {
    const g = gate('sem_versao', 'sem_versao', 'sem_versao');
    expect(g.status).toBeNull();
    expect(answerOf(g)).toEqual({ kind: 'sem_janela', reason: 'sem_versao' });
  });

  it('so_futuros is «Bloco desligado»', () => {
    expect(answerOf(gate('dentro', 'ok', 'so_futuros'))).toEqual(JA);
    expect(answerOf(gate('desligada', 'sem_limite', 'so_futuros'))).toEqual(SR);
  });

  it('the status-null cells are status null, and ID with the block evaluated is status liberado (rule 4)', () => {
    expect(gate('desligada', 'sem_dados', 'sem_agenda').status).toBeNull();
    expect(gate('desligada', 'sem_limite', 'sem_agenda').status).toBeNull();
    expect(gate('desligada', 'sem_dados', 'livre').status).toBe('liberado');
    expect(gate('sem_janela', 'ok', 'livre').status).toBe('liberado');
  });

  it('JA* outside the window: «Fora da sua janela» (the missing agenda goes in the line below)', () => {
    expect(answerOf(gate('fora', 'ok', 'sem_agenda'))).toMatchObject({ kind: 'fora_janela', position: 'antes' });
  });

  it('SJ with the limit warning: «Liberado, com aviso», as today', () => {
    expect(answerOf(gate('sem_janela', 'avisa', 'livre'))).toMatchObject({ kind: 'liberado', warnings: ['limite'], semAgenda: false });
    expect(answerOf(gate('sem_janela', 'avisa', 'sem_agenda'))).toMatchObject({ kind: 'liberado', warnings: ['limite'], semAgenda: true });
  });

  it('«Encerrado por hoje» wins over everything, a wait included', () => {
    expect(answerOf(gate('dentro', 'encerra', 'espera'))).toMatchObject({ kind: 'encerrado', limitCents: 40000 });
    expect(answerOf(gate('desligada', 'encerra', 'sem_agenda'))).toMatchObject({ kind: 'encerrado' });
  });

  it('a wait answers outside the window too, and with the limit warning', () => {
    expect(answerOf(gate('fora', 'avisa', 'espera'))).toEqual({ ...AG, warnings: ['limite'] });
  });
});

describe('«Não opero hoje»: the whole day, and the wait with no way back (SPEC §5.5, §5.6)', () => {
  const CPI_DIA: BlockInterval = {
    kind: 'dia',
    start: new Date('2026-12-09T18:00:00-05:00'),
    end: new Date('2026-12-10T18:00:00-05:00'),
    releases: [{ code: 'cpi', at: new Date('2026-12-10T08:30:00-05:00'), mode: 'dia' }],
  };

  it('active `dia`: kind dia, source dia, never an hour (free_at is not used)', () => {
    const g = gate('dentro', 'ok', block('espera', CPI_DIA, CPI_DIA.end));
    expect(answerOf(g)).toEqual({ kind: 'dia', releases: CPI_DIA.releases, source: 'dia', warnings: [] });
  });

  it('active `espera` with free_at null (R13b): kind dia, source espera_sem_volta, with the wait\'s releases', () => {
    const g = gate('desligada', 'sem_dados', block('espera', ISM, null));
    expect(answerOf(g)).toEqual({ kind: 'dia', releases: ISM.releases, source: 'espera_sem_volta', warnings: [] });
  });

  it('«Aguardar até» names free_at, never the end of the interval (R12)', () => {
    const g = gate('dentro', 'ok', block('espera', ISM, T('10:40')));
    expect(answerOf(g)).toMatchObject({ kind: 'aguardar', until: T('10:40') });
  });
});

describe('liberado.until: the window\'s close or the next wait of the day, whichever comes first', () => {
  const later = (start: string, end: string): BlockInterval => ({
    kind: 'espera',
    start: T(start),
    end: T(end),
    releases: [{ code: 'jolts', at: T(start), mode: 'volta' }],
  });
  const free = (today: BlockInterval[]): BlockCheck => ({ evaluated: true, state: 'ok', active: null, today, freeAt: null });

  it('NEW (not drawn): a wait still to come inside the window → «Liberado · até 10:25» (its start)', () => {
    expect(answerOf(gate('dentro', 'ok', free([later('10:25', '10:40')])))).toMatchObject({ kind: 'liberado', until: T('10:25') });
  });

  it('a wait after the window closes: the window\'s close', () => {
    expect(answerOf(gate('dentro', 'ok', free([later('13:55', '14:10')])))).toMatchObject({ kind: 'liberado', until: T('11:00') });
  });

  it('a wait already over does not count', () => {
    expect(answerOf(gate('dentro', 'ok', free([later('08:25', '08:40'), later('10:25', '10:40')])))).toMatchObject({ until: T('10:25') });
    expect(answerOf(gate('dentro', 'ok', free([later('08:25', '08:40')])))).toMatchObject({ until: T('11:00') });
  });

  it('the window off: «Liberado» without an hour, a wait later today included (SPEC §7.2 LV: «sem hora»)', () => {
    expect(answerOf(gate('desligada', 'ok', free([later('13:55', '14:10')])))).toMatchObject({ kind: 'liberado', until: null });
    expect(answerOf(gate('desligada', 'ok', free([])))).toMatchObject({ kind: 'liberado', until: null });
  });
});
