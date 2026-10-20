/**
 * @jest-environment node
 *
 * The Phase 3 screens' fixtures (testing/fixtures/registrar-telas, recorded from the real SQL by
 * hubRegistrarTelas.pg.test.ts) read with the strict parsers of lib/hub/registrarDb, and the facts
 * the screens are built on: the approved board's scenario 10 as the database answered it.
 */
import { possoLinha } from '@/lib/hub/posso';
import { avisoDoLimite, padroesDoRegistrar } from '@/lib/hub/registrar';
import { formatHhMm, utcToLocal } from '@/lib/domain';
import {
  abertasTelas,
  agoraTelas,
  contasTelas,
  diaTelas,
  entradaTelas,
  estadoTelas,
  fechadaPreviaTelas,
  fechadaTelas,
  idsTelas,
  operacaoTelas,
  previaTelas,
  recentesTelas,
  saidaTelas,
  telasJson,
} from '@/testing/registrarTelas';

const et = (d: Date | null | undefined) => (d ? formatHhMm(utcToLocal(d, 'America/New_York').minuteOfDay) : null);
const brt = (d: Date | null | undefined) => (d ? formatHhMm(utcToLocal(d, 'America/Sao_Paulo').minuteOfDay) : null);

describe('the recorded accounts', () => {
  it('are the owner’s two and one new-market account, with ids the other fixtures use', () => {
    const ids = idsTelas();
    expect(contasTelas().map((a) => [a.id, a.label, a.market, a.platform, a.phase, a.is_primary])).toEqual([
      [ids.accounts.topOne, 'Top One #1', 'futures', 'topone', 'financiada', true],
      [ids.accounts.ebinex, 'Ebinex', 'binary', 'ebinex', 'pessoal', false],
      [ids.accounts.ftmo, 'FTMO', 'forex', 'mt5', 'avaliacao', false],
    ]);
  });
});

describe('rules_now at the board’s moments', () => {
  it('Wed 11:05 ET: «Fora da sua janela» on Top One', () => {
    const [top] = agoraTelas('agora-qua-1105-et').accounts;
    expect(possoLinha(top.label, top.gate, top.rules)).toMatchObject({ palavra: 'Fora da sua janela' });
    expect(top.desdeDay).toBe('2026-10-14');
  });

  it('Thu 10:31 ET: «Liberado · até 11:00 ET», «Limite do dia US$ 245 de US$ 400»', () => {
    const [top, ebx, ftmo] = agoraTelas('agora-qui-1031-et').accounts;
    const linha = possoLinha(top.label, top.gate, top.rules);
    expect(linha).toMatchObject({ palavra: 'Liberado', sub: 'até 11:00 ET' });
    expect(linha.limite).toMatchObject({ usado: 'US$\u00a0245', de: 'de US$\u00a0400' });
    expect(ebx.gate.limit.evaluated).toBe(false);
    expect(ftmo.market).toBe('forex');
  });

  it('Thu 10:42 ET: «Encerrado por hoje»; 20:24 de Brasília: Ebinex «Liberado · até 21:00 de Brasília»', () => {
    const [top] = agoraTelas('agora-qui-1042-et').accounts;
    expect(possoLinha(top.label, top.gate, top.rules).palavra).toBe('Encerrado por hoje');
    const ebx = agoraTelas('agora-qui-2024-brt').accounts[1];
    expect(possoLinha(ebx.label, ebx.gate, ebx.rules)).toMatchObject({ palavra: 'Liberado', sub: 'até 21:00 de Brasília' });
  });
});

describe('the futures day (scenario 10)', () => {
  it('entries: levels from points, marks on the server clock, the plan «No plano»', () => {
    const mes = entradaTelas('entry-mes').state;
    expect(mes.trade).toMatchObject({ symbol: 'MES', direction: 'long', quantity: '2', entryPrice: '7912.5', stopPrice: '7902.5', targetPrice: '7932.5', status: 'open', result: 'pending' });
    expect(et(mes.trade.entryTime)).toBe('10:12');
    expect(mes.plan).toEqual({ breaks: [], verdict: 'no_plano', checksEvaluated: ['janela', 'limite'] });
    expect(mes.marks.map((m) => [m.kind, m.value, m.limpa, m.markedAt.getTime() === mes.trade.registeredAt?.getTime()])).toEqual([
      ['setup', 'A', true, true],
      ['execucao', 'no_ponto', true, true],
    ]);
    expect(entradaTelas('entry-mnq-qua').state.trade.tradingDay).toBe('2026-10-21');
  });

  it('the dry runs: outside the window, a typed hour, the stop above what is left of the limit', () => {
    const fora = previaTelas('entry-dry-fora-janela');
    expect(fora.gate.status).toBe('fora_janela');
    expect(fora.plan.breaks).toEqual(['fora_da_janela']);
    expect(previaTelas('entry-dry-mes-digitada')).toMatchObject({ limitRoom: { left: '155', risk: '100', above: false } });
    expect(et(previaTelas('entry-dry-mes-digitada').entryAt)).toBe('10:20');
    expect(previaTelas('entry-dry-es-acima').limitRoom).toEqual({ limit: '400', net: '-245', reached: false, left: '155', risk: '200', above: true });
  });

  it('the open trades and the bridge at 10:31', () => {
    expect(abertasTelas().map((t) => [t.symbol, t.tradingDay, et(t.entryTime)])).toEqual([
      ['MNQ', '2026-10-21', '10:52'],
      ['MES', '2026-10-22', '10:12'],
      ['MGC', '2026-10-22', '10:24'],
    ]);
    expect(diaTelas('dia-qui-1031').map((d) => [d.trade.symbol, d.trade.status, d.origin, d.plan?.verdict, d.images, d.trade.note !== null])).toEqual([
      ['MNQ', 'open', 'live', 'no_plano', 0, false],
      ['MNQ', 'closed', 'live', 'no_plano', 0, true],
      ['MES', 'open', 'live', 'no_plano', 0, false],
      ['MGC', 'open', 'live', 'no_plano', 0, false],
    ]);
    const mes = operacaoTelas('operacao-mes-aberta');
    expect(mes.marksNow.map((n) => [n.kind, n.currentValue, n.currentLimpa])).toEqual([
      ['emocao', 'calmo', true],
      ['execucao', 'no_ponto', true],
      ['setup', 'A', true],
    ]);
    expect(estadoTelas('marks-mes-aberta').marks).toHaveLength(3);
  });

  it('the exits: −US$ 100 (80 %), −US$ 160 (the limit at 10:40), yesterday’s MNQ on its own day', () => {
    const before = agoraTelas('agora-qui-1031-et').accounts[0].gate;
    const mes = saidaTelas('exit-mes-oitenta');
    expect(mes.exit).toMatchObject({ pnl: '-100', result: 'loss', r: '-1', points: '-10' });
    expect(avisoDoLimite({ market: 'futures', tradeDay: mes.state.trade.tradingDay, before, after: mes.gateNow, exitAt: mes.exit!.exitAt, pref80: true })).toMatchObject({
      tipo: 'oitenta',
      worstCents: -34500,
    });
    expect(avisoDoLimite({ market: 'futures', tradeDay: mes.state.trade.tradingDay, before, after: mes.gateNow, exitAt: mes.exit!.exitAt, pref80: false })).toBeNull();
    const mgc = saidaTelas('exit-mgc-atingido');
    const aviso = avisoDoLimite({ market: 'futures', tradeDay: mgc.state.trade.tradingDay, before: mes.gateNow, after: mgc.gateNow, exitAt: mgc.exit!.exitAt, pref80: false });
    expect(aviso).toMatchObject({ tipo: 'atingido', worstCents: -50500, limitCents: 40000, atLimit: 'encerrar' });
    expect(aviso && aviso.tipo === 'atingido' ? et(aviso.hitAt) : null).toBe('10:40');
    const mnq = saidaTelas('exit-mnq-ontem');
    expect(mnq.exit?.pnl).toBe('64.5');
    expect(avisoDoLimite({ market: 'futures', tradeDay: mnq.state.trade.tradingDay, before: mgc.gateNow, after: mnq.gateNow, exitAt: mnq.exit!.exitAt, pref80: true })).toBeNull();
  });

  it('the bridge at 10:42: four closed, the MES with two images and a note; yesterday’s exit today', () => {
    const dia = diaTelas('dia-qui-1042');
    expect(dia.map((d) => [d.trade.symbol, d.trade.pnl, d.images, d.trade.note !== null, d.trade.tradingDay])).toEqual([
      ['MNQ', '64.5', 0, false, '2026-10-21'],
      ['MNQ', '-245', 0, true, '2026-10-22'],
      ['MES', '-100', 2, true, '2026-10-22'],
      ['MGC', '-160', 0, false, '2026-10-22'],
    ]);
    expect(et(dia[0].trade.exitTime)).toBe('10:42');
    const mes = operacaoTelas('operacao-mes-fechada');
    expect(mes.images.map((i) => [i.name, i.mime, i.position])).toEqual([
      ['MES_10-12_entrada.webp', 'image/webp', 1],
      ['MES_10-38_saida.webp', 'image/webp', 2],
    ]);
    expect(estadoTelas('extras-mes').trade.note).toBe('Saí no stop: o rompimento não confirmou.');
    expect(estadoTelas('extras-nota').trade.note).toBe('Entrei contra a abertura e saí no stop.');
  });

  it('«Desfazer entrada» and «Já fechada» on «Ontem»', () => {
    expect(telasJson('undo-es')).toMatchObject({ deleted: true, trash: [] });
    const ontem = fechadaPreviaTelas('after-dry-ontem');
    expect(ontem.tradingDay).toBe('2026-10-21');
    expect(ontem.exit).toMatchObject({ pnl: '95', points: '9.5', result: 'win' });
    expect(ontem.plan.verdict).toBe('no_plano');
  });
});

describe('the Ebinex day', () => {
  it('a put on the next candle: 20:10 → vence às 20:12; 5 min → 20:20; 15 min → 20:30', () => {
    const put = entradaTelas('entry-ebinex-put').state.trade;
    expect([brt(put.entryTime), brt(put.expiresAt), put.direction, put.durationSeconds]).toEqual(['20:10', '20:12', 'put', 60]);
    expect(brt(previaTelas('entry-dry-ebinex-m5').expiresAt)).toBe('20:20');
    expect(brt(previaTelas('entry-dry-ebinex-m15').expiresAt)).toBe('20:30');
    expect(previaTelas('entry-dry-ebinex-m5').preview).toEqual({ kind: 'outcome', risk: '20', ifWin: '17.6', ifLoss: '-20' });
    expect(previaTelas('entry-dry-ebinex-m5').limitRoom).toBeNull();
  });

  it('its loss, a mark after the expiry, a «Já fechada» win, the bridge', () => {
    expect(saidaTelas('exit-ebinex-perda').exit).toMatchObject({ pnl: '-20', result: 'loss', pnlBasis: 'outcome', exitPrice: null });
    expect(estadoTelas('marks-ebinex-depois').marks.map((m) => [m.value, m.limpa])).toEqual([
      ['B', true],
      ['C', false],
    ]);
    expect(brt(fechadaPreviaTelas('after-dry-ebinex').expiresAt)).toBe('20:20');
    expect(fechadaTelas().state.trade).toMatchObject({ source: 'after', pnl: '17.4', result: 'win', commission: '0' });
    expect(diaTelas('dia-ebinex').map((d) => [d.trade.symbol, d.origin, d.trade.pnl])).toEqual([
      ['EUR/USD', 'live', '-20'],
      ['GBP/USD', 'reconstructed', '17.4'],
    ]);
  });
});

describe('the form’s starting values from the recorded history', () => {
  it('Top One: the last root registered in the app and its contracts', () => {
    expect(padroesDoRegistrar('futures', recentesTelas('recentes-top-one'))).toMatchObject({ symbol: 'MGC', quantity: '1' });
  });

  it('Ebinex: the pairs by use, the last payout of each, the last stake', () => {
    expect(padroesDoRegistrar('binary', recentesTelas('recentes-ebinex'))).toEqual({
      symbol: 'EUR/USD',
      quantity: '1',
      pairs: ['EUR/USD', 'BTC/USDT'],
      payoutBySymbol: { 'EUR/USD': '87', 'BTC/USDT': '85' },
      stake: '20',
    });
  });
});
