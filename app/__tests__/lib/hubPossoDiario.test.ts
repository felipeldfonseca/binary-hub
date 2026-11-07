/**
 * @jest-environment node
 *
 * «Posso operar hoje?» on the Diário (Phase 4, «Muitas contas», owner's request of 25 Oct 2026):
 * only the selected account, with «somando as contas de Futuros» when its limit sums them, and one
 * line for the others counting their answers («liberadas · encerradas por hoje · fora da janela ·
 * sem janela salva»). The worlds of the approved board «Diário · 1º dez», 11:35 ET: the usual 8
 * accounts (scenario 2) and the 35 of scenario 9b. Invented data.
 */
import { EVERY_DAY, MON_TO_FRI } from '@/lib/domain/tempo';
import { dayUsage, evaluateGate, gateTradingDay, MARKET_SPEC, type AccountMarket, type DayTrade, type Rules } from '@/lib/domain/gate';
import { estadoDaConta, outrasTexto, possoNoDiario, possoTexto, type ContaPosso } from '@/lib/hub/posso';
import { ebinexRules, et, NY, SP, topOneRules, trade, version } from '@/testing/gate';

const NOW = et('2026-12-01 11:35');

const futuros = (startMin: number, endMin: number, limitUsd: number | null, mode: 'conta' | 'soma' = 'conta'): Rules => ({
  ...topOneRules(),
  windows: [{ tz: NY, startMin, endMin, weekdays: MON_TO_FRI }],
  limit: limitUsd === null ? null : { cents: limitUsd * 100, mode, atLimit: 'encerrar' },
});
const MANHA = (lim: number) => futuros(570, 720, lim);
const PREGAO = (lim: number) => futuros(570, 960, lim);
const HORA = (lim: number) => futuros(600, 660, lim);
const forex = (): Rules => ({
  market: 'forex',
  windows: [{ tz: NY, startMin: 480, endMin: 600, weekdays: MON_TO_FRI }],
  windowsFrom: 'market',
  windowRule: { on: true, outside: 'fora' },
  block: null,
  limit: { cents: 100000, mode: 'conta', atLimit: 'encerrar' },
  states: null,
  day: { tz: NY, startMin: 1020 },
});
const cripto = (): Rules => ({ ...forex(), market: 'crypto', windows: [{ tz: SP, startMin: 1200, endMin: 1320, weekdays: EVERY_DAY }], limit: null, day: { tz: SP, startMin: 0 } });
const b3 = (): Rules => ({ ...forex(), market: 'b3', windows: [{ tz: SP, startMin: 600, endMin: 660, weekdays: MON_TO_FRI }], limit: { cents: 50000, mode: 'conta', atLimit: 'encerrar' }, day: { tz: SP, startMin: 0 } });

function conta(accountId: string, label: string, market: AccountMarket, rules: Rules | null, trades: DayTrade[] = [], now = NOW): ContaPosso {
  const account = { market, dayClock: MARKET_SPEC[market].day };
  const v = rules ? version(rules) : null;
  const day = dayUsage(trades, { tradingDay: gateTradingDay(now, account, v), until: now, limitCents: rules?.limit?.cents ?? null });
  return { accountId, label, market, gate: evaluateGate(now, account, v, day), rules };
}

/** The three sales the Apex 50k #5 and #6 copied, closing the day at 10:41 */
const apexCopia = () => [trade('2026-12-01 09:41', '2026-12-01 09:49', -57), trade('2026-12-01 10:13', '2026-12-01 10:19', -41.5), trade('2026-12-01 10:28', '2026-12-01 10:41', -404.5)];

/** Scenario 9b: Top One among 35 accounts (30 futures accounts of eight firms and the board's other markets) */
function muitas(): ContaPosso[] {
  return [
    conta('alp1', 'Alpha 50k #1', 'futures', MANHA(500)),
    conta('alp2', 'Alpha 50k #2', 'futures', MANHA(500)),
    conta('alp3', 'Alpha 50k #3', 'futures', MANHA(500)),
    conta('apx1', 'Apex 50k #1', 'futures', MANHA(500), [trade('2026-12-01 09:52', '2026-12-01 10:03', 65)]),
    conta('apx2', 'Apex 50k #2', 'futures', MANHA(500)),
    conta('apx3', 'Apex 50k #3', 'futures', MANHA(500)),
    conta('apx4', 'Apex 50k #4', 'futures', MANHA(500)),
    conta('apx5', 'Apex 50k #5', 'futures', MANHA(500), apexCopia()),
    conta('apx6', 'Apex 50k #6', 'futures', MANHA(500), apexCopia()),
    conta('apxc1', 'Apex 100k #1', 'futures', PREGAO(1000)),
    conta('apxc2', 'Apex 100k #2', 'futures', PREGAO(1000)),
    conta('apxc3', 'Apex 100k #3', 'futures', PREGAO(1000)),
    conta('lucid', 'Lucid 50k', 'futures', futuros(600, 660, 400, 'soma'), [trade('2026-12-01 10:12', '2026-12-01 10:20', -1113.25)]),
    conta('luc2', 'Lucid 50k #2', 'futures', MANHA(400)),
    conta('luc3', 'Lucid 50k #3', 'futures', MANHA(400)),
    conta('luc100', 'Lucid 100k', 'futures', MANHA(800)),
    conta('mff1', 'MFFU 50k #1', 'futures', PREGAO(500)),
    conta('mff2', 'MFFU 50k #2', 'futures', PREGAO(500)),
    conta('mff3', 'MFFU 50k #3', 'futures', PREGAO(500)),
    conta('top', 'Top One', 'futures', HORA(400), [trade('2026-12-01 10:04', '2026-12-01 10:06', -45), trade('2026-12-01 10:33', '2026-12-01 10:49', 47)]),
    conta('tps1', 'Topstep 50k #1', 'futures', HORA(500)),
    conta('tps2', 'Topstep 50k #2', 'futures', HORA(500)),
    conta('tps3', 'Topstep 50k #3', 'futures', HORA(500)),
    conta('tps4', 'Topstep 50k #4', 'futures', HORA(500)),
    conta('tps150', 'Topstep 150k', 'futures', HORA(1500)),
    conta('tfy1', 'Tradeify 50k #1', 'futures', MANHA(600), [trade('2026-12-01 11:02', '2026-12-01 11:10', -23)]),
    conta('tfy2', 'Tradeify 50k #2', 'futures', MANHA(600)),
    conta('tfy3', 'Tradeify 50k #3', 'futures', MANHA(600)),
    conta('tfy4', 'Tradeify 50k #4', 'futures', null),
    conta('ylos', 'Ylos 50k', 'futures', null),
    conta('ebx', 'Ebinex', 'binary', ebinexRules()),
    conta('ftmo', 'FTMO', 'forex', forex()),
    conta('ibkr', 'IBKR', 'stocks', null),
    conta('bin', 'Binance', 'crypto', cripto()),
    conta('clear', 'Clear', 'b3', b3()),
  ];
}

/**
 * The board's usual 8 accounts at 1º dez, 11:35 ET (there the Lucid 50k sums only the Top One:
 * US$ 172,25 of US$ 400 at its worst, not reached)
 */
function oito(): ContaPosso[] {
  const all = muitas();
  const lucid = conta('lucid', 'Lucid 50k', 'futures', futuros(600, 660, 400, 'soma'), [
    trade('2026-12-01 10:12', '2026-12-01 10:20', -96),
    trade('2026-12-01 10:41', '2026-12-01 10:47', -31.25),
  ]);
  return ['top', 'lucid', 'ylos', 'ebx', 'ftmo', 'ibkr', 'bin', 'clear'].map((id) => (id === 'lucid' ? lucid : all.find((a) => a.accountId === id)!));
}

describe('the others line', () => {
  it('scenario 2 (8 accounts, Top One open): «Outras 7 contas: 5 fora da janela · 2 sem janela salva»', () => {
    const p = possoNoDiario(oito(), 'top');
    expect(possoTexto(p.conta!.linha)).toBe('Fora da sua janela · abre amanhã às 10:00 ET');
    expect(p.conta!.somando).toBe(false);
    expect(outrasTexto(p.outras!)).toBe('Outras 7 contas: 5 fora da janela · 2 sem janela salva');
    expect(p.outras!.partes.map((x) => x.tom)).toEqual(['amber', 'muted']);
    expect([p.outras!.verTodas, p.outras!.ocultar]).toEqual(['Ver todas', 'Ocultar']);
  });

  it('scenario 9b (35 accounts): «Outras 34 contas: 19 liberadas · 3 encerradas por hoje · 9 fora da janela · 3 sem janela salva»', () => {
    const p = possoNoDiario(muitas(), 'top');
    expect(outrasTexto(p.outras!)).toBe('Outras 34 contas: 19 liberadas · 3 encerradas por hoje · 9 fora da janela · 3 sem janela salva');
    expect(p.outras!.partes.map((x) => x.tom)).toEqual(['mint', 'red', 'amber', 'muted']);
    expect(p.outras!.contas).toHaveLength(34);
    const apx5 = p.outras!.contas.find((c) => c.accountId === 'apx5')!;
    expect(possoTexto(apx5.linha)).toBe('Encerrado por hoje · limite atingido às 10:41');
  });

  it('choosing «Apex 50k #5»: its card closes the day and the line counts the Top One', () => {
    const p = possoNoDiario(muitas(), 'apx5');
    expect(possoTexto(p.conta!.linha)).toBe('Encerrado por hoje · limite atingido às 10:41');
    expect(outrasTexto(p.outras!)).toBe('Outras 34 contas: 19 liberadas · 2 encerradas por hoje · 10 fora da janela · 3 sem janela salva');
  });

  it('choosing the «Lucid 50k»: «somando as contas de Futuros» only on the open account', () => {
    const p = possoNoDiario(muitas(), 'lucid');
    expect(p.conta!.somando).toBe(true);
    expect(possoTexto(p.conta!.linha)).toBe('Encerrado por hoje · limite atingido às 10:20');
    expect(p.conta!.linha.limite).toMatchObject({ usado: 'US$ 1.113,25', de: 'de US$ 400' });
  });

  it('all in one state: «todas …»; one other account: its state alone and «Ver a outra conta»', () => {
    const tres = oito().filter((a) => ['top', 'lucid', 'ylos'].includes(a.accountId));
    expect(outrasTexto(possoNoDiario(tres, 'ylos').outras!)).toBe('Outras 2 contas: todas fora da janela');
    const duas = oito().filter((a) => ['top', 'ebx'].includes(a.accountId));
    const p = possoNoDiario(duas, 'top');
    expect(outrasTexto(p.outras!)).toBe('Outra conta: fora da janela');
    expect(p.outras!.verTodas).toBe('Ver a outra conta');
    expect(possoNoDiario(oito().slice(0, 1), 'top').outras).toBeNull();
  });

  it('«liberadas com aviso» and «com outra resposta» keep their places', () => {
    const now = et('2026-12-01 09:00');
    const aviso: Rules = { ...MANHA(500), windowRule: { on: true, outside: 'aviso' } };
    const desligada: Rules = { ...MANHA(500), windowRule: { on: false, outside: 'fora' }, limit: null };
    const accounts = [
      conta('a', 'A', 'futures', PREGAO(500), [], et('2026-12-01 10:00')),
      conta('b', 'B', 'futures', aviso, [], now),
      conta('c', 'C', 'futures', desligada, [], now),
      conta('d', 'D', 'futures', MANHA(500), [], now),
      conta('e', 'E', 'futures', null, [], now),
    ];
    expect(accounts.map((a) => estadoDaConta(a.gate))).toEqual(['liberada', 'liberada_com_aviso', 'outra', 'fora_da_janela', 'sem_janela']);
    expect(outrasTexto(possoNoDiario(accounts, 'a').outras!)).toBe('Outras 4 contas: 1 liberada com aviso · 1 fora da janela · 1 sem janela salva · 1 com outra resposta');
  });

  it('«Ver todas» lists the others by market, then in the server\'s order', () => {
    const shuffled = [...oito()].reverse();
    expect(possoNoDiario(shuffled, 'top').outras!.contas.map((c) => c.accountId)).toEqual(['ylos', 'lucid', 'ebx', 'ftmo', 'ibkr', 'bin', 'clear']);
    expect(possoNoDiario(oito(), 'nenhuma').conta).toBeNull();
  });
});
