/**
 * @jest-environment node
 *
 * The Diário's pt-BR words (Phase 4) reproduce the approved boards (DiarioDezEnxuto «1º dez» and
 * DiarioHojeEnxuto «hoje», approved 5 Nov 2026) from their invented days: the calendar's cells and
 * weeks, the pending-reviews banner, the top line, the open day's tiles, ⓘ, plan and facts, the
 * review and «Antes de operar», and the «Semana» card.
 */
import { MON_TO_FRI } from '@/lib/domain/tempo';
import {
  dayTiles,
  monthGrid,
  monthRange,
  weekCard,
  type DayNote,
  type DayReview,
  type GridCell,
} from '@/lib/domain/diario';
import type { Rules } from '@/lib/domain/gate';
import {
  apagadasTexto,
  avisoDeRevisoes,
  breakevenDoPlano,
  camposDaRevisao,
  celulaDaSemana,
  celulaDoCalendario,
  comoLerOCalendario,
  comoLerOHistorico,
  comoLerOPlano,
  comoLerOsNumeros,
  diaCurto,
  diaLongo,
  diaMudouTexto,
  doPregaoAnterior,
  etiquetasDoDia,
  fatosTexto,
  foraDaSemanaItem,
  intervaloLongo,
  janelaDoPlano,
  limiteDoPlano,
  linhaDaData,
  linhaDaRevisao,
  linhaDoTopo,
  linhasDoPlano,
  mesTitulo,
  notaAntesDeOperar,
  notaDoDia,
  numeroCurto,
  numeroDoDia,
  numerosDoDia,
  numerosDoHistorico,
  numerosSemRegras,
  rotuloSemana,
  semanaTexto,
  SELETOR_MUITAS,
  valoresEm,
  versaoAnterior,
  versoesBotao,
  type ContaDiario,
} from '@/lib/hub/diario';
import { brt, et, NY, SP, topOneRules } from '@/testing/gate';
import {
  binanceDays,
  calendarWeeks,
  ebinexDays,
  EBINEX_ROWS,
  f10,
  f19,
  facts,
  limitOf,
  monthMarks,
  TOP_ONE_ROWS,
  topOneDays,
  topOneRulesBE,
} from '@/testing/diario';

/** formatMoney writes a no-break space after the symbol; the boards a plain one */
const sp = <T>(x: T): T => JSON.parse(JSON.stringify(x).replace(/ /g, ' '));

const TOP: ContaDiario = { currency: 'USD', market: 'futures', tz: NY };
const EBX: ContaDiario = { currency: 'USD', market: 'binary', tz: SP };
const BIN: ContaDiario = { currency: 'USD', market: 'crypto', tz: SP };
const CLEAR: ContaDiario = { currency: 'BRL', market: 'b3', tz: SP };

describe('dates and numbers', () => {
  it('as the boards write them', () => {
    expect([diaCurto('2026-12-01'), diaCurto('2026-11-19')]).toEqual(['1º dez', '19 nov']);
    expect([diaLongo('2026-11-10'), diaLongo('2026-12-01')]).toEqual(['Terça-feira, 10 de novembro', 'Terça-feira, 1º de dezembro']);
    expect(linhaDaData(et('2026-12-01 11:35'), NY)).toBe('terça-feira, 1º de dezembro, 11:35 ET');
    expect(linhaDaData(brt('2026-11-11 21:20'), SP)).toBe('quarta-feira, 11 de novembro, 21:20 de Brasília');
    expect(mesTitulo('2026-10')).toBe('Outubro de 2026');
    expect([intervaloLongo('2026-11-23', '2026-11-27'), intervaloLongo('2026-09-28', '2026-10-02')]).toEqual([
      '23 a 27 de novembro',
      '28 de setembro a 2 de outubro',
    ]);
    expect([rotuloSemana('2026-10-12', '2026-10-16'), rotuloSemana('2026-09-28', '2026-10-02'), rotuloSemana('2026-11-30', '2026-12-04')]).toEqual([
      '12–16 out',
      '28 set–2 out',
      '30 nov–4 dez',
    ]);
    expect([numeroDoDia('267.93'), numeroDoDia('-465.4'), numeroDoDia('0'), numeroDoDia('1234.5')]).toEqual(['+267,93', '−465,40', '0,00', '+1.234,50']);
    expect([numeroCurto('267.93'), numeroCurto('-7.4'), numeroCurto('212.5'), numeroCurto('0.4'), numeroCurto('-0.4')]).toEqual(['+268', '−7', '+213', '0', '0']);
  });

  it('«Toque num dia para abrir. Valores em …»', () => {
    expect([valoresEm('futures', 'USD'), valoresEm('crypto', 'USD'), valoresEm('b3', 'BRL')]).toEqual([
      'Valores em US$.',
      'Valores em US$ (USDT e USDC contam como dólar).',
      'Valores em R$.',
    ]);
  });
});

describe('the calendar (board «Diário · 1º dez», Top One, today 1º dez)', () => {
  const days = topOneDays();
  const weeks = calendarWeeks(days);
  const grid = (month: string, today = '2026-12-01') => {
    const r = monthRange(month);
    return monthGrid({ month, today, market: 'futures', days, weeks, mes: monthMarks(TOP_ONE_ROWS, et, r.from, r.to) });
  };
  const mesDe = (month: string) => {
    const r = monthRange(month);
    return monthMarks(TOP_ONE_ROWS, et, r.from, r.to);
  };
  const celula = (month: string, day: string) => {
    const c = grid(month).weeks.flatMap((w) => w.cells).find((x) => x.day === day) as GridCell;
    return sp(celulaDoCalendario(c, TOP, mesDe(month).days.find((d) => d.day === day)));
  };

  it('a full day, the limit day, the misto day, history, a day due a review, today', () => {
    expect(celula('2026-11', '2026-11-10')).toEqual({
      res: '+267,93',
      resCurto: '+268',
      dica: '10 nov · +US$ 267,93 · 5 op.: 3 ganhos, 2 perdas · 1 fora do plano · revisão escrita',
      aria: '10 nov, +267,93 dólares, 5 op., com operação fora do plano, revisão escrita',
    });
    expect(celula('2026-11', '2026-11-19').dica).toBe('19 nov · −US$ 465,40 · 5 op.: 0 ganhos, 5 perdas · 1 fora do plano · limite atingido às 10:38 · revisão escrita');
    expect(celula('2026-11', '2026-11-19').aria).toBe('19 nov, −465,40 dólares, 5 op., com operação fora do plano, limite atingido, revisão escrita');
    expect(celula('2026-10', '2026-10-14')).toEqual({
      res: '+83,14',
      resCurto: '+83',
      dica: '14 out · +US$ 83,14 · 3 op.: 2 ganhos, 1 perda · 1 fora do plano · + 1 do histórico, à parte · revisão escrita',
      aria: '14 out, +83,14 dólares, 3 op., com operação fora do plano, com histórico importado à parte, revisão escrita',
    });
    expect(celula('2026-10', '2026-10-13')).toEqual({
      res: '+143,28',
      resCurto: '+143',
      dica: '13 out · +US$ 143,28 · 3 op.: 3 ganhos, 0 perdas · Histórico importado · só resultado',
      aria: '13 out, +143,28 dólares, 3 op., Histórico importado',
    });
    expect(celula('2026-10', '2026-10-20').dica).toBe('20 out · −US$ 72,46 · 2 op.: 1 ganho, 1 perda · sem revisão');
    expect(celula('2026-10', '2026-10-20').aria).toBe('20 out, −72,46 dólares, 2 op., sem revisão');
    // only from the file: neither ✓ nor «sem revisão»
    expect(celula('2026-10', '2026-10-28').dica).toBe('28 out · +US$ 106,08 · 5 op.: 3 ganhos, 2 perdas · 1 fora do plano');
    expect(celula('2026-12', '2026-12-01')).toEqual({
      res: '+2,00',
      resCurto: '+2',
      dica: '1º dez · +US$ 2,00 · 4 op.: 2 ganhos, 2 perdas · 1 fora do plano',
      aria: '1º dez, +2,00 dólares, 4 op., com operação fora do plano, hoje',
    });
  });

  it('days without trades, the future, the neighbouring month', () => {
    expect(celula('2026-10', '2026-10-30')).toEqual({ res: 'sem op.', resCurto: '—', dica: '30 out · sem operações', aria: '30 out, sem operações' });
    expect(celula('2026-12', '2026-12-02')).toEqual({ res: '', resCurto: '', dica: '', aria: '2 dez, ainda não aconteceu' });
    expect(celula('2026-12', '2026-11-30')).toEqual({ res: '', resCurto: '', dica: '', aria: '' });
    const hoje = monthGrid({ month: '2026-11', today: '2026-11-11', market: 'futures', days: days.filter((d) => d.day < '2026-11-11'), weeks });
    const c11 = hoje.weeks.flatMap((w) => w.cells).find((x) => x.day === '2026-11-11') as GridCell;
    expect(celulaDoCalendario(c11, TOP)).toEqual({ res: '—', resCurto: '—', dica: '11 nov · hoje, sem operações ainda', aria: '11 nov, hoje, sem operações ainda' });
  });

  it('the «Semana» column: 12–16 out with the history apart, 23–27 nov with ●', () => {
    const out = grid('2026-10');
    expect(sp(celulaDaSemana(out.weeks[2], TOP))).toEqual({
      rotulo: '12–16 out',
      res: '−42,68',
      n: '8 op.',
      fora: '1',
      historia: '+163,29',
      aria: 'Semana de 12 a 16 de outubro: −42,68 dólares, 8 op., 1 fora do plano, histórico importado à parte: +163,29. Abrir a semana.',
    });
    expect(celulaDaSemana(out.weeks[0], TOP)).toEqual({
      rotulo: '28 set–2 out',
      res: '−18,26',
      n: '11 op.',
      fora: null,
      historia: null,
      aria: 'Semana de 28 de setembro a 2 de outubro: histórico importado, −18,26 dólares. Abrir a semana.',
    });
    const nov = grid('2026-11');
    expect(sp(celulaDaSemana(nov.weeks[4], TOP))).toMatchObject({
      rotulo: '23–27 nov',
      res: '+99,14',
      n: '14 op.',
      fora: '5',
      aria: 'Semana de 23 a 27 de novembro: +99,14 dólares, 14 op., 5 fora do plano. Abrir a semana.',
    });
    expect(celulaDaSemana(grid('2026-12').weeks[1], TOP)).toBeNull();
  });

  it('binárias and Cripto: «devolvida», «aberta», a Saturday', () => {
    const ebx = ebinexDays();
    const r = monthRange('2026-11');
    const g = monthGrid({ month: '2026-11', today: '2026-11-11', market: 'binary', days: ebx });
    const c = g.weeks.flatMap((w) => w.cells).find((x) => x.day === '2026-11-11') as GridCell;
    const mes = monthMarks(EBINEX_ROWS, brt, r.from, r.to).days.find((d) => d.day === '2026-11-11');
    expect(sp(celulaDoCalendario(c, EBX, mes))).toEqual({
      res: '−7,40',
      resCurto: '−7',
      dica: '11 nov · −US$ 7,40 · 4 op.: 1 ganho, 1 perda, 1 devolvida · 1 aberta · 1 fora do plano',
      aria: '11 nov, −7,40 dólares, 4 op., com operação fora do plano, hoje',
    });
    const bin = binanceDays();
    const gb = monthGrid({ month: '2026-11', today: '2026-11-14', market: 'crypto', days: bin });
    const sab = gb.weeks.flatMap((w) => w.cells).find((x) => x.day === '2026-11-14') as GridCell;
    expect(sp(celulaDoCalendario(sab, BIN)).dica).toBe('14 nov · +US$ 212,50 · 2 op.: 1 ganho, 0 perdas · 1 aberta');
    // Cripto shows «sem op.» on a weekend without trades
    const dom = gb.weeks.flatMap((w) => w.cells).find((x) => x.day === '2026-11-08') as GridCell;
    expect(celulaDoCalendario(dom, BIN).res).toBe('sem op.');
  });

  it('the pending-reviews banner and the top line', () => {
    expect(avisoDeRevisoes(days, '2026-12-01')).toEqual({ texto: '5 pregões sem revisão, 3 nas últimas 4 semanas', mes: '2026-11' });
    expect(avisoDeRevisoes(days.filter((d) => d.day >= '2026-11-20'), '2026-12-01')).toEqual({ texto: '1 pregão sem revisão', mes: '2026-11' });
    expect(avisoDeRevisoes(days.filter((d) => d.day <= '2026-10-19'), '2026-12-01')).toBeNull();
    expect(linhaDoTopo('2026-10-14', days, '2026-12-01')).toBe('Diário desde 14 out: 110 operações em 32 pregões · 85 antes, em Histórico importado · só resultado');
    expect(linhaDoTopo('2026-10-14', days.filter((d) => d.kind === 'historico'), '2026-12-01')).toBe('Diário desde 14 out: nenhuma operação ainda.');
    // A day with only a written review (vazio) is no «pregão»
    const vazio = { ...days[days.length - 1], day: '2026-11-11', kind: 'vazio' as const, n: 0, app: 0, open: 0, wins: 0, losses: 0, even: 0, net: '0', gross: '0', commission: null };
    expect(linhaDoTopo('2026-10-14', [...days.filter((d) => d.day !== '2026-11-11'), vazio], '2026-12-01')).toBe(
      linhaDoTopo('2026-10-14', days.filter((d) => d.day !== '2026-11-11'), '2026-12-01'),
    );
    expect(linhaDoTopo(null, days, '2026-12-01')).toBeNull();
  });

  it('«Como ler: Calendário» per market clock', () => {
    expect(comoLerOCalendario('futures', { tz: NY, startMin: 1080 })).toContain(
      'mais forte quanto maior (quartis do resultado diário, ganhos e perdas à parte). O pregão de futuros vai das 18:00 da véspera às 17:00 ET. Traço (—)',
    );
    expect(comoLerOCalendario('binary', { tz: SP, startMin: 0 })).toContain('O pregão desta conta vai da meia-noite à meia-noite de Brasília.');
    expect(comoLerOCalendario('forex', { tz: NY, startMin: 1020 })).toContain('O pregão desta conta vai das 17:00 da véspera às 17:00 ET.');
  });
});

describe('the open day', () => {
  const days = topOneDays();
  const day = (d: string) => days.find((x) => x.day === d)!;

  it('tags: «Limite atingido às 10:38», «Histórico importado · 13 out», «Revisão escrita», «Sem revisão»', () => {
    expect(etiquetasDoDia(day('2026-11-19'), '2026-12-01', TOP, et('2026-11-19 10:38'))).toEqual(['Limite atingido às 10:38', 'Revisão escrita']);
    expect(etiquetasDoDia(day('2026-10-08'), '2026-12-01', TOP, null)).toEqual(['Histórico importado · 13 out']);
    expect(etiquetasDoDia(day('2026-11-30'), '2026-12-01', TOP, null)).toEqual(['Sem revisão']);
    expect(etiquetasDoDia(day('2026-12-01'), '2026-12-01', TOP, null)).toEqual([]);
    expect(etiquetasDoDia(day('2026-11-17'), '2026-12-01', TOP, null)).toEqual([]);
  });

  it('the notes of a history day and of the day the rules began', () => {
    expect(notaDoDia('historico', TOP, null, [])).toBe('Antes das suas regras: sem plano, só o que o arquivo trouxe.');
    expect(notaDoDia('misto', TOP, et('2026-10-14 09:12'), [et('2026-10-14 08:50')])).toBe(
      'Suas regras começaram às 09:12: a operação das 08:50 fica em Histórico importado · só resultado, à parte do dia.',
    );
    expect(notaDoDia('misto', TOP, et('2026-10-14 09:12'), [et('2026-10-14 08:50'), et('2026-10-14 08:55')])).toBe(
      'Suas regras começaram às 09:12: as operações de antes ficam em Histórico importado · só resultado, à parte do dia.',
    );
    expect(notaDoDia('diario', TOP, null, [])).toBeNull();
  });

  it('19 nov (scenario 3): tiles, ⓘ, plan and «O diário registrou»', () => {
    const f = f19();
    const t = dayTiles(f, 'futures');
    expect(sp(numerosDoDia(t, TOP))).toEqual({
      res: '−US$ 465,40',
      resTom: 'red',
      ops: '5',
      opsSub: '0 ganhos, 5 perdas',
      lim: 'US$ 465,40 de US$ 400',
      limSub: 'pior momento · atingido às 10:38',
      barra: 100,
      barraTom: 'red',
      fora: '1 operação · −US$ 38,74',
      foraSub: '',
      foraTom: 'amber',
    });
    expect(sp(comoLerOsNumeros(t, TOP, f))).toBe(
      'Resultado líquido. Bruto −US$ 453,00 · comissões −US$ 12,40. Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia. Fora do plano: operações fora da janela ou depois do limite. As outras 4 somaram −US$ 426,66: conta simples, não é o que teria acontecido.',
    );
    expect(sp(linhasDoPlano(topOneRulesBE(), f, TOP))).toEqual([
      { item: 'Janela', plano: '10:00–11:00 ET', fato: '5 de 5 dentro', marca: 'No plano', tipo: 'ok', link: null },
      {
        item: 'Limite',
        plano: 'US$ 400 · encerra o dia',
        fato: 'atingido às 10:38, com US$ 426,66 de perda · 1 depois, às 10:52: −US$ 38,74',
        marca: 'Fora do plano',
        tipo: 'fora',
        link: null,
      },
      { item: 'Breakeven', plano: 'MES +8 pts · MNQ +30 pts', fato: 'nenhuma chegou ao ponto da regra', marca: 'Registrado', tipo: 'neutro', link: null },
    ]);
    expect(sp(fatosTexto(f, TOP))).toBe(
      '5 operações · −US$ 465,40 · limite atingido às 10:38 · 1 depois do limite, às 10:52 · limite: US$ 465,40 de US$ 400 no pior momento',
    );
    // the review was saved at 11:42 before the file brought the commissions
    const frozen = { ...f, net: '-453', gross: '-453', commission: null, limit: { ...f.limit!, worst: '-453' } };
    expect(sp(fatosTexto(frozen, TOP))).toBe(
      '5 operações · −US$ 453,00 · limite atingido às 10:38 · 1 depois do limite, às 10:52 · limite: US$ 453 de US$ 400 no pior momento',
    );
    expect(sp(diaMudouTexto(f, TOP))).toBe('Depois da revisão, o dia mudou: agora 5 operações, −US$ 465,40.');
  });

  it('19 nov with «Só avisar» (scenario 3b): the plan says «só avisa»', () => {
    const r = topOneRules();
    const f = f19();
    const avisa: Rules = { ...r, limit: { ...r.limit!, atLimit: 'avisar' } };
    expect(sp(linhasDoPlano(avisa, { ...f, limit: { ...f.limit!, atLimit: 'avisar' } }, TOP)[1].plano)).toBe('US$ 400 · só avisa');
    expect(sp(comoLerOsNumeros(dayTiles({ ...f, limit: { ...f.limit!, atLimit: 'avisar' } }, 'futures'), TOP, f))).toContain(
      'Pelas suas regras, ao atingir o limite o app só avisa.',
    );
  });

  it('10 nov (scenario 2): one trade from the file outside the window, the breakeven moved in 1 of 2', () => {
    const f = f10();
    const t = dayTiles(f, 'futures');
    expect(sp(numerosDoDia(t, TOP))).toMatchObject({
      res: '+US$ 267,93',
      ops: '5',
      opsSub: '3 ganhos, 2 perdas',
      lim: 'nenhuma perda acumulada',
      limSub: 'pior momento',
      barra: null,
      fora: '1 operação · −US$ 32,49',
    });
    expect(sp(comoLerOsNumeros(t, TOP, f))).toBe(
      'Resultado líquido. Bruto +US$ 278,25 · comissões −US$ 10,32. Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia. Fora do plano: operações fora da janela ou depois do limite. As outras 4 somaram +US$ 300,42: conta simples, não é o que teria acontecido.',
    );
    expect(sp(linhasDoPlano(topOneRulesBE(), f, TOP)).map((l) => [l.item, l.fato, l.marca])).toEqual([
      ['Janela', '4 de 5 dentro', 'Fora do plano'],
      ['Limite', 'nenhuma perda acumulada', 'No plano'],
      ['Breakeven', 'moveu em 1 de 2', 'Registrado'],
    ]);
    expect(sp(fatosTexto(f, TOP))).toBe('5 operações · +US$ 267,93 · 1 fora da janela, às 11:20 · limite: US$ 0 de US$ 400 no pior momento');
    expect(apagadasTexto([{ at: et('2026-11-10 10:20'), via: 'apagada' }, { at: et('2026-11-10 10:31'), via: 'desfazer_entrada' }], NY)).toBe(
      '1 operação registrada foi apagada às 10:20.',
    );
    expect(apagadasTexto([{ at: et('2026-11-10 10:31'), via: 'desfazer_entrada' }], NY)).toBeNull();
  });

  it('14 out, the misto day: «+ 1 operação do histórico, à parte»', () => {
    const f = facts({
      day: '2026-10-14',
      kind: 'misto',
      trades: 3,
      closed: 3,
      wins: 2,
      losses: 1,
      net: '83.14',
      gross: '88.5',
      commission: '5.36',
      window: { rule: true, evaluated: 3, inside: 2, outside: [{ tradeId: 't3', at: et('2026-10-14 11:12') }] },
      fora: { n: 1, net: '-34.64', open: 0 },
      othersNet: '117.78',
      history: { n: 1, net: '20.01', gross: '21.25' },
    });
    expect(sp(comoLerOsNumeros(dayTiles(f, 'futures'), TOP, f))).toBe(
      'Resultado líquido. Bruto +US$ 88,50 · comissões −US$ 5,36. Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia. Fora do plano: operações fora da janela ou depois do limite. As outras 2 somaram +US$ 117,78: conta simples, não é o que teria acontecido. + 1 operação do histórico, à parte: +US$ 20,01; o limite do dia contou essa também.',
    );
    expect(sp(linhasDoPlano(topOneRules(), f, TOP)).map((l) => [l.item, l.fato])).toEqual([
      ['Janela', '2 de 3 dentro'],
      ['Limite', 'nenhuma perda acumulada'],
    ]);
    expect(sp(fatosTexto(f, TOP))).toBe('3 operações · +US$ 83,14 · 1 fora da janela, às 11:12 · limite: US$ 0 de US$ 400 no pior momento');
  });

  it('1º dez: US$ 45,00 of US$ 400, the commission still to come, «pior momento: US$ 45»', () => {
    const f = facts({
      day: '2026-12-01',
      trades: 4,
      closed: 4,
      wins: 2,
      losses: 2,
      net: '2',
      gross: '2',
      window: { rule: true, evaluated: 4, inside: 3, outside: [{ tradeId: 't4', at: et('2026-12-01 11:09') }] },
      limit: limitOf({ worst: '-45' }),
      fora: { n: 1, net: '-112.5', open: 0 },
      othersNet: '114.5',
      breakeven: { by: { MES: { n: '8', un: 'pts' }, MNQ: { n: '30', un: 'pts' } }, trades: 2, moved: 1 },
    });
    const t = dayTiles(f, 'futures');
    expect(sp(numerosDoDia(t, TOP))).toMatchObject({ lim: 'US$ 45,00 de US$ 400', limSub: 'pior momento', barra: 11, barraTom: 'amber' });
    expect(sp(comoLerOsNumeros(t, TOP, f))).toBe(
      'A comissão ainda não chegou: o resultado está bruto até o arquivo da corretora. Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia. Fora do plano: operações fora da janela ou depois do limite. As outras 3 somaram +US$ 114,50: conta simples, não é o que teria acontecido.',
    );
    expect(sp(linhasDoPlano(topOneRulesBE(), f, TOP))[1]).toMatchObject({ fato: 'pior momento: US$ 45', marca: 'No plano' });
    expect(sp(fatosTexto(f, TOP))).toBe('4 operações · +US$ 2,00 · 1 fora da janela, às 11:09 · limite: US$ 45 de US$ 400 no pior momento');
  });

  it('12 nov at 10:42 (board «hoje», scenario 1): «2 · 1 aberta», still gross, «todas no plano»', () => {
    const f = facts({ day: '2026-11-12', trades: 2, closed: 1, open: 1, wins: 1, net: '85', gross: '85', window: { rule: true, evaluated: 2, inside: 2, outside: [] } });
    const t = dayTiles(f, 'futures');
    expect(sp(numerosDoDia(t, TOP))).toMatchObject({ res: '+US$ 85,00', ops: '2 · 1 aberta', opsSub: '1 ganho, 0 perdas', lim: 'nenhuma perda acumulada', fora: 'nenhuma' });
    expect(sp(comoLerOsNumeros(t, TOP, f))).toBe(
      'A comissão ainda não chegou: o resultado está bruto até o arquivo da corretora. Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia. Fora do plano: operações fora da janela ou depois do limite.',
    );
    expect(sp(fatosTexto(f, TOP))).toBe('2 operações · +US$ 85,00 · todas no plano · limite: US$ 0 de US$ 400 no pior momento');
    expect(fatosTexto(facts({ trades: 1, closed: 1, net: '45', gross: '45', window: { rule: true, evaluated: 1, inside: 1, outside: [] } }), TOP)).toContain(' · no plano · ');
  });

  it('Lucid 50k on 1º dez (scenario 9): «somando as contas de Futuros»', () => {
    const f = facts({
      day: '2026-12-01',
      trades: 2,
      closed: 2,
      losses: 2,
      net: '-127.25',
      gross: '-127.25',
      window: { rule: true, evaluated: 2, inside: 2, outside: [] },
      limit: limitOf({ scope: 'soma', worst: '-172.25' }),
    });
    const t = dayTiles(f, 'futures');
    expect(sp(numerosDoDia(t, TOP))).toMatchObject({ res: '−US$ 127,25', lim: 'US$ 172,25 de US$ 400', limSub: 'pior momento · somando as contas de Futuros', barra: 43 });
    expect(sp(comoLerOsNumeros(t, TOP, f))).toBe(
      'A comissão ainda não chegou: o resultado está bruto até o arquivo da corretora. Limite do dia: a maior perda acumulada no pregão, no pior momento, já com a comissão quando o arquivo a trouxe, contra o seu limite de US$ 400, somando as contas de Futuros. Pelas suas regras, ao atingir o limite o app encerra o dia. Com “somando as contas de Futuros”, o pior momento inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você arquivar uma delas, ela sai da soma, também nos dias passados. Fora do plano: operações fora da janela ou depois do limite.',
    );
    const r = topOneRules();
    expect(sp(linhasDoPlano({ ...r, limit: { ...r.limit!, mode: 'soma' } }, f, TOP)[1])).toMatchObject({
      plano: 'US$ 400 · encerra o dia · somando as contas de Futuros',
      fato: 'pior momento: US$ 172,25',
    });
    expect(sp(fatosTexto(f, TOP))).toBe('2 operações · −US$ 127,25 · todas no plano · limite: US$ 172,25 de US$ 400 no pior momento');
  });

  it('today before any trade, and an account without rules (scenario 10)', () => {
    const f = facts({ day: '2026-11-12' });
    const t = dayTiles(f, 'futures');
    expect(sp(numerosDoDia(t, TOP))).toMatchObject({ res: 'US$ 0,00', ops: '0', opsSub: '', lim: 'nenhuma perda acumulada', limSub: 'pior momento', barra: null, fora: 'nenhuma' });
    expect(sp(comoLerOsNumeros(t, TOP, f))).toBe(
      'Limite do dia: a maior perda acumulada no pregão, no pior momento, contra o seu limite de US$ 400. Pelas suas regras, ao atingir o limite o app encerra o dia.',
    );
    expect(sp(fatosTexto(f, TOP))).toBe('0 operações · limite: US$ 0 de US$ 400 no pior momento');
    expect(sp(numerosSemRegras(TOP))).toMatchObject({ res: 'US$ 0,00', ops: '0', lim: '—', limSub: 'sem regras salvas', fora: '—' });
  });

  it('a history day (scenario 5, 8 out)', () => {
    const h = day('2026-10-08').history!;
    expect(sp(numerosDoHistorico(h, TOP))).toEqual({
      res: '−US$ 458,16',
      resTom: 'red',
      ops: '5',
      opsSub: '0 ganhos, 5 perdas',
      lim: '—',
      limSub: 'o limite ainda não existia',
      barra: null,
      barraTom: 'amber',
      fora: '—',
      foraSub: 'sem plano',
      foraTom: 'muted',
    });
    expect(sp(comoLerOHistorico(h, TOP))).toBe(
      'Antes da primeira versão das suas regras não há janela, limite nem plano: só o que o arquivo da corretora trouxe. Resultado líquido. Bruto −US$ 447,00 · comissões −US$ 11,16.',
    );
    expect(comoLerOHistorico({ n: 2, wins: 0, losses: 2, even: 0, net: '-45', gross: '-45' }, EBX)).toBe(
      'Antes da primeira versão das suas regras não há janela, limite nem plano: só o que o arquivo da corretora trouxe.',
    );
  });

  it('binárias without a limit, B3 in reais', () => {
    const f = facts({ day: '2026-11-11', trades: 4, closed: 3, open: 1, wins: 1, losses: 1, even: 1, net: '-7.4', gross: '-7.4', limit: null, fora: { n: 1, net: '0', open: 1 } });
    const t = dayTiles(f, 'binary');
    expect(sp(numerosDoDia(t, EBX))).toMatchObject({
      ops: '4 · 1 aberta',
      opsSub: '1 ganho, 1 perda, 1 devolvida',
      lim: 'sem limite',
      limSub: 'nas suas regras',
      fora: '1 operação · aberta',
    });
    expect(sp(comoLerOsNumeros(t, EBX, f))).toBe(
      'Limite do dia: esta conta não tem limite nas suas regras. Fora do plano: operações fora da janela. As outras 3 somaram US$ 0,00: conta simples, não é o que teria acontecido.',
    );
    const b3 = facts({ day: '2026-11-12', trades: 1, closed: 1, losses: 1, net: '-180', gross: '-180', limit: limitOf({ amount: '500', worst: '-180' }) });
    expect(sp(numerosDoDia(dayTiles(b3, 'b3'), CLEAR))).toMatchObject({ res: '−R$ 180,00', lim: 'R$ 180,00 de R$ 500', barra: 36 });
  });
});

describe('«O plano do dia»', () => {
  it('window and limit wording, per clock and market', () => {
    expect(janelaDoPlano(topOneRules())).toBe('10:00–11:00 ET');
    expect(janelaDoPlano({ windows: [{ tz: SP, startMin: 1200, endMin: 1260, weekdays: MON_TO_FRI }] })).toBe('20:00–21:00 · Brasília');
    expect(janelaDoPlano({ windows: [{ tz: SP, startMin: 1200, endMin: 1320, weekdays: 127 }] })).toBe('20:00–22:00 · Brasília, todos os dias');
    expect(
      janelaDoPlano({
        windows: [
          { tz: NY, startMin: 600, endMin: 660, weekdays: MON_TO_FRI },
          { tz: NY, startMin: 840, endMin: 900, weekdays: MON_TO_FRI },
        ],
      }),
    ).toBe('10:00–11:00 e 14:00–15:00 ET');
    expect(janelaDoPlano({ windows: [] })).toBeNull();
    expect(sp(limiteDoPlano({ cents: 50000, mode: 'conta', atLimit: 'encerrar' }, 'BRL'))).toBe('R$ 500 · encerra o dia');
    expect(breakevenDoPlano({ by: { MNQ: { n: '30', un: 'pts' }, MES: { n: '7.5', un: 'pts' } } })).toBe('MES +7,5 pts · MNQ +30 pts');
  });

  it('without a window or a limit', () => {
    const r: Rules = { ...topOneRules(), windows: [], limit: null };
    expect(linhasDoPlano(r, facts({ window: null, limit: null }), TOP)).toEqual([
      { item: 'Janela', plano: 'Sem janela salva', fato: '', marca: 'Sem regra', tipo: 'neutro', link: 'Definir em Personalizar' },
      { item: 'Limite', plano: 'sem limite', fato: '', marca: 'Sem regra', tipo: 'neutro', link: null },
    ]);
  });

  it('before any trade', () => {
    expect(sp(linhasDoPlano(topOneRules(), facts({}), TOP)).map((l) => [l.fato, l.marca])).toEqual([
      ['nenhuma operação ainda', ''],
      ['nenhuma operação ainda', ''],
    ]);
  });

  it('23 out: «Até 09:40 valia a versão 1: sem regra de breakeven.»', () => {
    expect(versaoAnterior({ versionNo: 1, until: et('2026-10-23 09:40'), rules: topOneRules() }, topOneRulesBE(), TOP)).toBe(
      'Até 09:40 valia a versão 1: sem regra de breakeven.',
    );
    const r = topOneRules();
    expect(sp(versaoAnterior({ versionNo: 3, until: et('2026-11-02 10:45'), rules: r }, { ...r, limit: { ...r.limit!, cents: 50000 } }, TOP))).toBe(
      'Até 10:45 valia a versão 3: limite US$ 400 · encerra o dia.',
    );
    expect(versaoAnterior({ versionNo: 2, until: et('2026-11-02 10:45'), rules: r }, r, TOP)).toBe('Até 10:45 valia a versão 2.');
  });

  it('the plan\'s ⓘ (Futuros mention Phase 5)', () => {
    expect(comoLerOPlano('futures', true)).toContain('quem confere é Análises. Bloqueio de dados, viés e regra do estado chegam na Fase 5.');
    expect(comoLerOPlano('binary', false)).not.toContain('Fase 5');
  });
});

describe('the review, «Antes de operar», the carry-over', () => {
  const version = (id: number, at: string, over: Partial<DayReview> = {}) => ({
    id,
    savedAt: et(at),
    written: true,
    worked: 'Esperei o reteste da mínima para vender.',
    differently: null,
    followed: 'sim' as const,
    carryForward: 'Uma operação por vez.',
    autoSummary: facts({ trades: 3, net: '368.5' }),
    ...over,
  });

  it('10 nov: «Salva às 11:33 · editada às 18:05 · Seguiu o plano? Em parte …», «Versões anteriores (1)»', () => {
    const r: DayReview = {
      ...version(12, '2026-11-10 18:05', { followed: 'em_parte' }),
      firstSavedAt: et('2026-11-10 11:33'),
      versions: 2,
      written: true,
      previous: [version(11, '2026-11-10 11:33')],
    };
    expect(linhaDaRevisao(r, '2026-11-10', NY)).toBe('Salva às 11:33 · editada às 18:05 · Seguiu o plano? Em parte · pela sua resposta, depois do resultado');
    expect([versoesBotao(1, false), versoesBotao(1, true)]).toEqual(['Versões anteriores (1)', 'Esconder versões anteriores (1)']);
    expect(camposDaRevisao(version(11, '2026-11-10 11:33'))).toEqual({
      funcionou: 'Esperei o reteste da mínima para vender.',
      diferente: 'Não preenchido',
      seguiu: 'Sim',
      levar: 'Uma operação por vez.',
    });
  });

  it('a review saved on another date, and «Não preenchido»', () => {
    const r: DayReview = { ...version(3, '2026-11-11 09:10', { followed: null }), firstSavedAt: et('2026-11-11 09:10'), versions: 1, written: true, previous: [] };
    expect(linhaDaRevisao(r, '2026-11-10', NY)).toBe('Salva em 11 nov, às 09:10 · Seguiu o plano? Não preenchido · pela sua resposta, depois do resultado');
  });

  it('«Antes de operar» (choice 5): both times, each against the first entry', () => {
    const note: DayNote = { id: 7, text: 'Só compro acima da VWAP; parcial no +8.', firstSavedAt: et('2026-11-12 09:40'), savedAt: et('2026-11-12 10:42'), versions: 2, written: true };
    expect(notaAntesDeOperar(note, et('2026-11-12 10:04'), NY)).toBe('anotado às 09:40, antes da 1ª entrada · editado às 10:42, depois da 1ª entrada');
    expect(notaAntesDeOperar({ ...note, savedAt: note.firstSavedAt, versions: 1 }, et('2026-11-12 10:04'), NY)).toBe('anotado às 09:40, antes da 1ª entrada');
    expect(notaAntesDeOperar({ ...note, savedAt: note.firstSavedAt, versions: 1 }, null, NY)).toBe('anotado às 09:40, antes da 1ª entrada');
  });

  it('«Do pregão anterior»', () => {
    expect(doPregaoAnterior({ day: '2026-11-27', text: 'Esperar o recuo até a VWAP antes de comprar.', savedAt: et('2026-11-27 11:15') })).toBe(
      '“Esperar o recuo até a VWAP antes de comprar.” · 27 nov',
    );
    expect(doPregaoAnterior(null)).toBe('Nada trazido do pregão anterior.');
  });
});

describe('«Semana»', () => {
  const days = topOneDays();
  const weeks = calendarWeeks(days);
  const regras = { temLimite: true, temJanela: true };

  it('closed week 23–27 nov (scenario 11)', () => {
    const r = monthRange('2026-11');
    const mes = monthMarks(TOP_ONE_ROWS, et, r.from, r.to);
    const w = weekCard({ day: '2026-11-24', today: '2026-12-01', market: 'futures', days, weeks, mesWeeks: mes.weeks });
    const s = sp(semanaTexto(w, TOP, regras));
    expect(s.titulo).toBe('23 a 27 de novembro · 4 pregões com operações');
    expect(s.numeros).toEqual([
      { rot: 'Resultado', val: '+US$ 99,14', tom: 'mint' },
      { rot: 'Operações', val: '14', tom: 'neutral' },
      { rot: 'Fora do plano', val: '5 · −US$ 153,68', tom: 'amber' },
      { rot: 'Revisões', val: '4 de 4', tom: 'neutral' },
    ]);
    expect(s.barras).toEqual([
      { rot: 'seg', val: '−204,93', valCurto: '−205' },
      { rot: 'ter', val: '+26,32', valCurto: '+26' },
      { rot: 'qua', val: '+177,75', valCurto: '+178' },
      { rot: 'qui', val: '—', valCurto: '—' },
      { rot: 'sex', val: '+100,00', valCurto: '+100' },
    ]);
    expect(s.leitor).toBe('Resultado por dia: seg, −204,93 · ter, +26,32 · qua, +177,75 · qui, sem operações · sex, +100,00.');
    expect(s.vazia).toBeNull();
    expect(s.info).toBe(
      'Pregões de 23 a 27 de novembro. Fora do plano: fora da janela ou depois do limite. Revisões: dos pregões com operação registrada no app ou com revisão, quantos têm revisão; hoje só entra depois que você escrever a revisão dele. A coluna Semana do calendário traz os mesmos números.',
    );
  });

  it('the week in progress (1º dez): «Semana em andamento · 2 de 5 pregões», «Revisões 0 de 1»', () => {
    const w = weekCard({ day: '2026-12-01', today: '2026-12-01', market: 'futures', days, weeks });
    const s = sp(semanaTexto(w, TOP, regras));
    expect(s.titulo).toBe('Semana em andamento · 2 de 5 pregões');
    expect(s.numeros[3]).toEqual({ rot: 'Revisões', val: '0 de 1', tom: 'neutral' });
    expect(s.barras.map((b) => b.val)).toEqual(['−100,75', '+2,00', '', '', '']);
  });

  it('Cripto: «6 de 7 pregões»; a history week; an empty week', () => {
    const bin = binanceDays();
    expect(semanaTexto(weekCard({ day: '2026-11-14', today: '2026-11-14', market: 'crypto', days: bin, weeks: calendarWeeks(bin) }), BIN, { temLimite: false, temJanela: true }).titulo).toBe(
      'Semana em andamento · 6 de 7 pregões',
    );
    const h = sp(semanaTexto(weekCard({ day: '2026-10-08', today: '2026-12-01', market: 'futures', days, weeks }), TOP, regras));
    expect([h.titulo, h.vazia, h.numeros[3].val]).toEqual(['5 a 9 de outubro', 'Só Histórico importado nesta semana: −US$ 280,42, à parte do diário.', '—']);
    const vazia = semanaTexto(weekCard({ day: '2026-08-05', today: '2026-12-01', market: 'futures', days, weeks }), TOP, regras);
    expect(vazia.vazia).toBe('Nenhuma operação nesta semana.');
  });

  it('the week\'s «Fora do plano» list', () => {
    const closedFile = { quantity: '1', assetType: 'futures', status: 'closed' as const, open: false, realized: true };
    expect(
      sp(
        foraDaSemanaItem(
          { tradeId: 't', day: '2026-11-24', entryTime: et('2026-11-24 11:05'), symbol: 'MES', direction: 'long', ...closedFile, breaks: ['fora_da_janela'], net: '-42.48', planKind: 'congelado' },
          TOP,
        ),
      ),
    ).toBe('ter 24 · 11:05 · Compra MES · fora da janela · −US$ 42,48');
    expect(
      sp(
        foraDaSemanaItem(
          { tradeId: 't', day: '2026-11-19', entryTime: et('2026-11-19 10:52'), symbol: 'MES', direction: 'short', ...closedFile, breaks: ['depois_do_limite'], net: '-38.74', planKind: 'congelado' },
          TOP,
        ),
      ),
    ).toBe('qui 19 · 10:52 · Venda MES · depois do limite · −US$ 38,74');
    expect(
      foraDaSemanaItem(
        { tradeId: 't', day: '2026-11-11', entryTime: brt('2026-11-11 21:25'), symbol: 'EUR/USD', direction: 'put', quantity: null, assetType: 'binary', status: 'open', realized: false, breaks: ['fora_da_janela'], net: null, open: true, planKind: 'congelado' },
        EBX,
      ),
    ).toBe('qua 11 · 21:25 · Baixa EUR/USD · fora da janela · aberta');
  });
});

describe('the selector\'s words with many accounts', () => {
  it('as on scenario 9b', () => {
    expect(SELETOR_MUITAS.grupo('Futuros', 30)).toBe('Futuros · 30');
    expect(SELETOR_MUITAS.grupo('Apex', 9)).toBe('Apex · 9');
    expect([SELETOR_MUITAS.achadas(9), SELETOR_MUITAS.achadas(1), SELETOR_MUITAS.achadas(0)]).toEqual([
      '9 contas encontradas.',
      '1 conta encontrada.',
      'Nenhuma conta encontrada.',
    ]);
    expect(SELETOR_MUITAS.nenhuma(' xyz ')).toBe('Nenhuma conta com “xyz”.');
  });
});
