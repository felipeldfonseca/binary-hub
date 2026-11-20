/**
 * @jest-environment node
 *
 * The words of «Dados econômicos» (Phase 5 · base, C8): the 20 names, the labels of a wait and of a
 * whole day, and the hour «Aguardar até» names, with the date rule of SPEC §7.2 (invented instants).
 */
import { AGENDA_RELEASES, LISTA_A_V1, isReleaseCode, type BlockRelease, type ReleaseCode } from '@/lib/domain/gate';
import { HORA_HABITUAL, NOMES_DADOS, horaDeVolta, marcaDados, rotuloDados, rotuloDia } from '@/lib/hub/dadosEconomicos';
import { et } from '@/testing/gate';

const NY = 'America/New_York';
const rel = (code: ReleaseCode, at: string, mode: BlockRelease['mode'] = 'volta'): BlockRelease => ({ code, at: et(at), mode });

describe('the agenda list (agenda_releases twin, data only)', () => {
  it('has the 20 codes in ord order, 14 us, 3 eu, 3 br, and the frozen list A of 15', () => {
    expect(AGENDA_RELEASES.map((r) => r.ord)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(AGENDA_RELEASES.filter((r) => r.calendar === 'us')).toHaveLength(14);
    expect(AGENDA_RELEASES.filter((r) => r.calendar === 'eu').map((r) => r.code)).toEqual(['bce_decisao', 'bce_entrevista', 'hicp_eu']);
    expect(AGENDA_RELEASES.filter((r) => r.calendar === 'br').map((r) => r.code)).toEqual(['ipca', 'pib_br', 'copom']);
    expect(LISTA_A_V1).toHaveLength(15);
    expect(LISTA_A_V1).not.toContain('bce_entrevista');
    expect(LISTA_A_V1).not.toContain('jolts');
    expect(Object.isFrozen(LISTA_A_V1)).toBe(true);
  });

  it('isReleaseCode knows only the 20 codes', () => {
    expect(isReleaseCode('ism_serv')).toBe(true);
    expect(isReleaseCode('fed')).toBe(false);
    expect(isReleaseCode('hicp_previa')).toBe(false);
    expect(isReleaseCode(1)).toBe(false);
  });
});

describe('NOMES_DADOS: the four forms of c3 §2.2 and the short name of c3 §6.2', () => {
  it('names every code, and only those', () => {
    expect(Object.keys(NOMES_DADOS).sort()).toEqual(AGENDA_RELEASES.map((r) => r.code).sort());
    expect(Object.keys(HORA_HABITUAL).sort()).toEqual(AGENDA_RELEASES.map((r) => r.code).sort());
  });

  it.each([
    ['cpi', 'CPI', 'do CPI', 'dia de CPI', 'CPI'],
    ['ppi', 'PPI', 'do PPI', 'dia de PPI', 'PPI'],
    ['payroll', 'Payroll', 'do Payroll', 'dia de Payroll', 'Payroll'],
    ['pce', 'PCE', 'do PCE', 'dia de PCE', 'PCE'],
    ['pib_us', 'PIB dos EUA', 'do PIB dos EUA', 'dia de PIB dos EUA', 'PIB'],
    ['varejo_us', 'Vendas no varejo', 'das vendas no varejo', 'dia de vendas no varejo', 'varejo'],
    ['ism_ind', 'ISM da indústria', 'do ISM da indústria', 'dia de ISM', 'ISM'],
    ['ism_serv', 'ISM de serviços', 'do ISM de serviços', 'dia de ISM', 'ISM'],
    ['fomc_decisao', 'Decisão do Fed', 'da decisão do Fed', 'dia de Fed', 'Fed'],
    ['fomc_entrevista', 'Entrevista do Fed', 'da entrevista do Fed', 'dia de Fed', 'Fed'],
    ['jolts', 'JOLTS', 'do JOLTS', 'dia de JOLTS', 'JOLTS'],
    ['confianca_us', 'Confiança do consumidor', 'da confiança do consumidor', 'dia de confiança do consumidor', 'confiança'],
    ['casas_novas', 'Vendas de casas novas', 'das vendas de casas novas', 'dia de vendas de casas novas', 'casas'],
    ['casas_usadas', 'Vendas de casas usadas', 'das vendas de casas usadas', 'dia de vendas de casas usadas', 'casas'],
    ['bce_decisao', 'Decisão do BCE', 'da decisão do BCE', 'dia de BCE', 'BCE'],
    ['bce_entrevista', 'Entrevista do BCE', 'da entrevista do BCE', 'dia de BCE', 'BCE'],
    ['hicp_eu', 'Inflação prévia da zona do euro', 'da inflação prévia da zona do euro', 'dia de inflação prévia', 'inflação do euro'],
    ['ipca', 'IPCA', 'do IPCA', 'dia de IPCA', 'IPCA'],
    ['pib_br', 'PIB do Brasil', 'do PIB do Brasil', 'dia de PIB do Brasil', 'PIB'],
    ['copom', 'Decisão do Copom', 'da decisão do Copom', 'dia de Copom', 'Copom'],
  ] as const)('%s', (code, nome, doDa, diaDe, curto) => {
    const w = NOMES_DADOS[code];
    expect([w.nome, w.doDa, w.diaDe, w.curto]).toEqual([nome, doDa, diaDe, curto]);
    // In a sentence the name is the «do/da» form without its article
    expect(w.frase).toBe(doDa.replace(/^d(o|a|os|as) /, ''));
    expect(w.curtoDoDa.endsWith(` ${curto}`)).toBe(true);
  });

  it('usual hours on the publisher clock (SPEC §2.1)', () => {
    expect(HORA_HABITUAL.cpi).toEqual({ hora: '08:30', tz: NY });
    expect(HORA_HABITUAL.fomc_entrevista).toEqual({ hora: '14:30', tz: NY });
    expect(HORA_HABITUAL.bce_decisao).toEqual({ hora: '14:15', tz: 'Europe/Berlin' });
    expect(HORA_HABITUAL.hicp_eu).toEqual({ hora: '11:00', tz: 'Europe/Luxembourg' });
    expect(HORA_HABITUAL.copom).toEqual({ hora: '18:30', tz: 'America/Sao_Paulo' });
  });
});

describe('rotuloDados (SPEC §5.6)', () => {
  const now = et('2026-12-03 09:57');

  it('one release: «ISM de serviços às 10:00»', () => {
    expect(rotuloDados([rel('ism_serv', '2026-12-03 10:00')], now, NY)).toBe('ISM de serviços às 10:00');
  });

  it('two releases: «decisão do BCE às 08:15 e CPI às 08:30»', () => {
    expect(rotuloDados([rel('bce_decisao', '2026-12-03 08:15'), rel('cpi', '2026-12-03 08:30')], et('2026-12-03 08:20'), NY)).toBe(
      'decisão do BCE às 08:15 e CPI às 08:30',
    );
  });

  it('two at the same instant, in ord order: «PCE e PIB dos EUA às 08:30»', () => {
    expect(rotuloDados([rel('pce', '2026-12-23 08:30'), rel('pib_us', '2026-12-23 08:30')], et('2026-12-23 08:27'), NY)).toBe(
      'PCE e PIB dos EUA às 08:30',
    );
  });

  it('three or more: «decisão do BCE às 08:15 e mais 2 dados»', () => {
    const rs = [rel('bce_decisao', '2026-12-17 08:15'), rel('cpi', '2026-12-17 08:30'), rel('varejo_us', '2026-12-17 08:30')];
    expect(rotuloDados(rs, et('2026-12-17 08:20'), NY)).toBe('decisão do BCE às 08:15 e mais 2 dados');
  });

  it('the eve: «CPI amanhã às 08:30» before midnight, «CPI às 08:30» after it', () => {
    const cpi = [rel('cpi', '2026-12-10 08:30', 'depois')];
    expect(rotuloDados(cpi, et('2026-12-09 19:00'), NY)).toBe('CPI amanhã às 08:30');
    expect(rotuloDados(cpi, et('2026-12-09 23:59'), NY)).toBe('CPI amanhã às 08:30');
    expect(rotuloDados(cpi, et('2026-12-10 00:00'), NY)).toBe('CPI às 08:30');
  });

  it('later than tomorrow, the weekday; with outraData never «amanhã»', () => {
    const cpi = [rel('cpi', '2026-12-10 08:30')];
    expect(rotuloDados(cpi, et('2026-12-08 12:00'), NY)).toBe('CPI qui às 08:30');
    expect(rotuloDados(cpi, et('2026-12-09 19:00'), NY, { outraData: true })).toBe('CPI qui às 08:30');
    expect(rotuloDados(cpi, et('2026-12-10 08:27'), NY, { outraData: true })).toBe('CPI às 08:30');
  });

  it('hours on the given clock (Brasília: the window clock of a São Paulo window)', () => {
    expect(rotuloDados([rel('ism_serv', '2026-12-03 10:00')], now, 'America/Sao_Paulo')).toBe('ISM de serviços às 12:00');
  });
});

describe('rotuloDia (SPEC §7.2, the whole day)', () => {
  it('«dia de CPI, às 08:30», and the eve «dia de CPI, amanhã às 08:30» before midnight', () => {
    const cpi = [rel('cpi', '2026-12-10 08:30', 'dia')];
    expect(rotuloDia(cpi, et('2026-12-10 10:05'), NY)).toBe('dia de CPI, às 08:30');
    expect(rotuloDia(cpi, et('2026-12-09 18:00'), NY)).toBe('dia de CPI, amanhã às 08:30');
    expect(rotuloDia(cpi, et('2026-12-09 23:59'), NY)).toBe('dia de CPI, amanhã às 08:30');
    expect(rotuloDia(cpi, et('2026-12-10 00:00'), NY)).toBe('dia de CPI, às 08:30');
  });

  it('an entry of another date: no «amanhã»', () => {
    expect(rotuloDia([rel('cpi', '2026-12-10 08:30', 'dia')], et('2026-12-09 18:30'), NY, { outraData: true })).toBe('dia de CPI, qui às 08:30');
  });

  it('the two Fed codes are one day name; two day names: «e mais 1 dado»', () => {
    expect(rotuloDia([rel('fomc_decisao', '2026-12-16 14:00', 'dia'), rel('fomc_entrevista', '2026-12-16 14:30', 'dia')], et('2026-12-16 10:00'), NY)).toBe(
      'dia de Fed, às 14:00',
    );
    expect(rotuloDia([rel('cpi', '2026-12-10 08:30', 'dia'), rel('payroll', '2026-12-10 08:30', 'dia')], et('2026-12-10 10:00'), NY)).toBe(
      'dia de CPI, às 08:30, e mais 1 dado',
    );
  });
});

describe('horaDeVolta (SPEC §5.6)', () => {
  it('same day «08:40»; next day «amanhã às 08:40» until midnight, then «08:40»', () => {
    const free = et('2026-12-10 08:40');
    expect(horaDeVolta(free, et('2026-12-10 08:27'), NY)).toBe('08:40');
    expect(horaDeVolta(free, et('2026-12-09 19:00'), NY)).toBe('amanhã às 08:40');
    expect(horaDeVolta(free, et('2026-12-09 23:59'), NY)).toBe('amanhã às 08:40');
    expect(horaDeVolta(free, et('2026-12-10 00:00'), NY)).toBe('08:40');
  });

  it('later, the weekday: «qui 09:15»; outraData: «qui 08:40», never «amanhã»', () => {
    expect(horaDeVolta(et('2026-12-17 09:15'), et('2026-12-15 19:00'), NY)).toBe('qui 09:15');
    expect(horaDeVolta(et('2026-12-10 08:40'), et('2026-12-09 19:00'), NY, { outraData: true })).toBe('qui 08:40');
    expect(horaDeVolta(et('2026-12-10 08:40'), et('2026-12-10 08:30'), NY, { outraData: true })).toBe('08:40');
  });

  it('on the window clock of Brasília', () => {
    expect(horaDeVolta(et('2026-12-03 10:10'), et('2026-12-03 10:05'), 'America/Sao_Paulo')).toBe('12:10');
  });
});

describe('marcaDados (c3 §6.2)', () => {
  it('«na espera do ISM», «em dia de CPI», the leftover of a day «na espera do Copom»', () => {
    expect(marcaDados({ kind: 'espera', releases: [rel('ism_serv', '2026-12-03 10:00')] })).toBe('na espera do ISM');
    expect(marcaDados({ kind: 'dia', releases: [rel('cpi', '2026-12-10 08:30', 'dia')] })).toBe('em dia de CPI');
    expect(marcaDados({ kind: 'espera', releases: [rel('copom', '2026-12-09 16:30', 'dia')] })).toBe('na espera do Copom');
  });

  it('two «na espera do PCE e PIB», three «na espera de 3 dados», a shared short name once', () => {
    expect(marcaDados({ kind: 'espera', releases: [rel('pce', '2026-12-23 08:30'), rel('pib_us', '2026-12-23 08:30')] })).toBe('na espera do PCE e PIB');
    expect(
      marcaDados({ kind: 'espera', releases: [rel('bce_decisao', '2026-12-17 08:15'), rel('cpi', '2026-12-17 08:30'), rel('varejo_us', '2026-12-17 08:30')] }),
    ).toBe('na espera de 3 dados');
    expect(marcaDados({ kind: 'espera', releases: [rel('ism_ind', '2026-12-01 10:00'), rel('ism_serv', '2026-12-01 10:00')] })).toBe('na espera do ISM');
    expect(marcaDados({ kind: 'espera', releases: [rel('confianca_us', '2026-12-22 10:00')] })).toBe('na espera da confiança');
  });

  it('without the interval: «na espera de dado»', () => {
    expect(marcaDados(null)).toBe('na espera de dado');
  });
});
