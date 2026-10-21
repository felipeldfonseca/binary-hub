/**
 * Phase 3c · step 1 «Já fechada» in several exits («+ Outra saída») and «Movi o stop para o
 * breakeven» (telas contract §6.3–6.4; RegistrarOperacao approved 21 Oct, scenarios 7, 12 and 15,
 * RO l.384–416, js l.1222–1286, 1353–1382, 1433–1437). Pure: no React; time is an input.
 *
 * Layer 3 (contract §6.1): it reads registrarForm.modeloEntrada's answer (`m0`, which leaves the
 * rows, their sum, the result line, «Corrigir» on the total, the pill and the payload's exits and
 * breakeven price to this module while the draft has rows) and returns the same model with them:
 *
 *   comSaidas        the rows and their errors, «Saídas: 2 de 2 ct.», «As saídas somam …», the
 *                    result line «… em média», «Corrigir» on the total, «Custos» for the whole
 *                    trade, «Venceu sem valor» on the last row, the pill and «Preço quando moveu»
 *                    with its status («com +12,00 pts a favor · Sua regra: com +5 pts.»), the merged
 *                    errors in the board's order (the rows' fields before the sum) and
 *                    register_after's payload (the rows by hour, the last one with the corrected
 *                    total's difference and «Custos»; `breakeven.price_then` only while the pill is
 *                    effectively on: rendered and pressed)
 *   outraSaida, removerSaida, mudarSaida   the draft transitions of the rows (and where the focus goes)
 *   textoRecusaBreakeven, saidaDoLimite    a server refusal of «Preço quando moveu»; the exit instant
 *                    the step-3 banner compares with the limit's hitAt
 *
 * Every rule is the database's (lib/domain/registro mirrors it: sortExitsByHour, lastExitPnl,
 * afterBreakeven's order); the words are components/hub/registrar/copy's (SAIDAS, BE_FECHADA).
 */
import { firstLocalHmAtOrAfter, formatHhMm, hmOn, parseHhMm } from '@/lib/domain/tempo';
import type { GateResult, Rules } from '@/lib/domain/gate';
import { afterPayload, averageExit, canSplit, favorOf, lastExitPnl, pnlFromPrices, sortExitsByHour, type TradeExit } from '@/lib/domain/registro';
import { abs, add, cmp, fromInt, mul, numeric, numericText, plainText, round, sub } from '@/lib/domain/registro/numeric';
import { BE_FECHADA, ERRO_REGISTRAR, ERROS, ERROS_PRECOS, RESULTADO, SAIDAS } from '@/components/hub/registrar/copy';
import { formatMoney } from './formato';
import { formatDecimal, lerNumero } from './numero';
import type { FormaAtivo } from './registrarAtivos';
import {
  MAX_SAIDAS,
  ORDEM_EBINEX,
  ORDEM_PRECOS,
  casasDe,
  diferencaTexto,
  horaRel,
  inteirosDe,
  lerDinheiro,
  lerPrecoDe,
  lerQuantidade,
  mercadoNovo,
  moedaPal,
  naoMultiplo,
  type BlocoResultadoModelo,
  type CampoEntrada,
  type ContaReg,
  type Lido,
  type ModeloEntrada,
  type Rascunho,
  type SaidaRascunho,
} from './registrarForm';
import { regraDoAtivo, textoAFavor, textoN } from './registrarRegra';

// ---------------------------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------------------------

/** One row on screen (RO l.384–396) */
export interface LinhaSaida {
  id: number;
  /** «1ª saída» */
  rotulo: string;
  /** «Remover a 1ª saída» */
  removerAria: string;
  qtd: string;
  /** What the price field shows: as typed (the last row: «0» while «Venceu sem valor» is on and nothing was typed) */
  preco: string;
  /** "HH:MM": as typed, else the server's minute (the last row: 16:00 ET while «Venceu sem valor» is on) */
  hora: string;
  res: string;
  /** The errors on screen (after a «Registrar operação» tap) */
  erros: { q?: string; p?: string; h?: string; r?: string };
}

export interface ModeloLinhas {
  linhas: LinhaSaida[];
  /** The row's quantity label: «Contratos» · «Lotes» · «Ações» · «Quantidade, em BTC» · «Quantidade» */
  qRotulo: string;
  /** Typed instruments: «Resultado desta saída, US$» and its note; null when the prices give the money */
  res: { rotulo: string; nota: string } | null;
  /** `role="status"`: «Saídas: 2 de 2 ct.» */
  soma: string;
  /** `role="alert"` after a tap: «As saídas somam 1 ct; a entrada tem 2 ct.» */
  somaErro: string | null;
}

/** «Movi o stop para o breakeven» (only while rendered: «Já fechada», a price market, a valid stop) */
export interface ModeloBe {
  /** As pressed (aria-pressed) */
  ligado: boolean;
  /** «Preço quando moveu» · «Prêmio quando moveu, US$ por ação» · «Preço quando moveu, USDT» */
  rotulo: string;
  valor: string;
  /** `role="status"`: «com +12,00 pts a favor · Sua regra: com +5 pts.»; '' when nothing to say */
  status: string;
  /** On screen as soon as something is typed, else after a tap */
  erro: string | null;
}

export interface ModeloSaidas extends ModeloEntrada {
  /** «+ Outra saída» (`aria-disabled` at 20 rows, with «Até 20 saídas por operação.»); null when hidden */
  outra: { desabilitada: boolean } | null;
  /** The rows; null with one exit */
  saidas: ModeloLinhas | null;
  /** The pill; null when not rendered (which counts as off for everything) */
  be: ModeloBe | null;
  /** The order the errors and the focus follow, with the rows' fields */
  ordem: CampoEntrada[];
}

export interface SaidasInput {
  conta: ContaReg;
  /** The server's clock */
  now: Date;
  /** «Registrar operação» was tapped */
  tentou: boolean;
  /**
   * The rules in force at the typed entry instant (PassoEntrada's rulesDoGate: gate_at's answer, or
   * rules_now's at the current minute): the version the trade will carry. null while unknown: the
   * status then leaves «Sua regra» out.
   */
  rules: Rules | null;
}

// ---------------------------------------------------------------------------------------------
// Numbers and words
// ---------------------------------------------------------------------------------------------

/** «+US$ 120,00» / «−R$ 60,00» */
const dinheiro = (decimal: string, conta: Pick<ContaReg, 'currency'>) => formatMoney(decimal, { signed: true, currency: conta.currency });
/** 'US$' / 'R$' */
const simbolo = (conta: Pick<ContaReg, 'currency'>) => (conta.currency === 'BRL' ? 'R$' : 'US$');
/** «, com swap ou funding, se houver» (Forex and Cripto) */
const swapDe = (conta: Pick<ContaReg, 'market'>) => (conta.market === 'forex' || conta.market === 'crypto' ? RESULTADO.swap : '');
/** «2 ct» · «0,50 lote» · «0,15 BTC» (RO `qTxt`) */
const qtdTexto = (forma: FormaAtivo, q: string) => forma.quantidade.sufixo(q);
/** «2» · «0,50» · «0,1»: the quantity as qtdTexto writes it, without its unit (RO `fmtQ`) */
const qtdNumero = (forma: FormaAtivo, q: string) => qtdTexto(forma, q).split(' ')[0];
/** The hour field's text as "HH:MM", or null */
const hhmm = (text: string) => {
  const m = parseHhMm(text);
  return m === null ? null : formatHhMm(m);
};

/** 10^10: what a stop move's points in favour must stay below (trade_stop_moves.favor, numeric(18, 8)) */
const MAX_FAVOR = numeric('10000000000');

/**
 * «Preço quando moveu» in afterBreakeven's order (register_after's "breakeven"): the format
 * (empty, numbers, above zero, digits), points in favour that do not fit (pips: a typo far from
 * the entry, c7d38cd), the tick, the decimals, then the side (a stop at the entry would already
 * have been hit). The side and the points need the side and the entry price.
 */
export function lerPrecoQuando(forma: FormaAtivo, text: string, lado: 'long' | 'short' | null, entrada: string | null): Lido {
  const premio = forma.unidadeStop === 'premio';
  const oque = premio ? 'prêmio' : 'preço';
  const n = lerNumero(text, { ponto: forma.pontoDecimal });
  if (!n.ok) return { value: null, erro: n.reason === 'empty' ? (premio ? BE_FECHADA.vazioPremio : BE_FECHADA.vazio) : ERROS_PRECOS.numero(forma.exemplo) };
  if (cmp(numeric(n.value), fromInt(0)) <= 0) return { value: null, erro: ERROS_PRECOS.zero(oque) };
  if (inteirosDe(n.value) > 10) return { value: null, erro: ERROS_PRECOS.numero(forma.exemplo) };
  const sgn: 1 | -1 = lado === 'short' ? -1 : 1;
  if (lado && entrada && cmp(abs(numeric(favorOf(forma.spec, sgn, entrada, n.value))), MAX_FAVOR) >= 0) return { value: null, erro: BE_FECHADA.longe };
  if (naoMultiplo(n.value, forma.spec.tick)) return { value: null, erro: ERROS.precoPasso(forma.nomePasso, forma.tickTexto ?? '') };
  if (forma.casasMax !== null && casasDe(n.value) > forma.casasMax) return { value: null, erro: ERROS_PRECOS.casas(forma.casasMax) };
  if (lado && entrada && cmp(mul(sub(numeric(n.value), numeric(entrada)), fromInt(sgn)), fromInt(0)) <= 0) return { value: null, erro: BE_FECHADA.lado };
  return { value: n.value };
}

/** The pill's field label by kind (RO js l.1435) */
function rotuloBe(forma: FormaAtivo): string {
  if (forma.tipo === 'opcao') return BE_FECHADA.premio;
  if (forma.tipo === 'cri') return BE_FECHADA.precoEm(forma.moedaCotacao ?? 'USDT');
  return BE_FECHADA.preco;
}

/** The focus order with the rows' fields right before the sum (RO js l.1278) */
export function ordemComSaidas(saidas: readonly Pick<SaidaRascunho, 'id'>[] | null): CampoEntrada[] {
  const i = ORDEM_PRECOS.indexOf('soma');
  const linhas = (saidas ?? []).flatMap((s) => (['q', 'p', 'h', 'r'] as const).map((c) => `s${s.id}${c}` as CampoEntrada));
  return [...ORDEM_PRECOS.slice(0, i), ...linhas, ...ORDEM_PRECOS.slice(i)];
}

/** Shown before a tap (as registrarForm's SEMPRE_VISIVEIS) */
const SEMPRE: readonly CampoEntrada[] = ['dia', 'stop', 'alvo', 'custos'];

// ---------------------------------------------------------------------------------------------
// comSaidas
// ---------------------------------------------------------------------------------------------

/**
 * Step 1 with «Já fechada»'s rows and pill (contract §6.1: PassoEntrada calls it on
 * modeloEntrada's answer). «Aberta», binaries and a form without an instrument come back as they
 * were, with no rows, no «+ Outra saída» and no pill.
 */
export function comSaidas(m0: ModeloEntrada, r: Rascunho, { conta, now, tentou, rules }: SaidasInput): ModeloSaidas {
  const forma = m0.forma;
  const lidos = m0.lidos;
  const semNada: ModeloSaidas = { ...m0, outra: null, saidas: null, be: null, ordem: [...(conta.market === 'binary' ? ORDEM_EBINEX : ORDEM_PRECOS)] };
  if (conta.market === 'binary' || r.modo !== 'fechada' || !forma || !lidos) return semNada;

  const erros: Partial<Record<CampoEntrada, string>> = { ...m0.erros };
  const out: ModeloSaidas = { ...semNada, erros };
  const rows = r.saidas && r.saidas.length >= 2 ? r.saidas : null;
  const qN = lidos.qtd;
  const entrada = lidos.preco;
  const sgn: 1 | -1 = r.lado === 'short' ? -1 : 1;

  // «+ Outra saída»: when the entry quantity can be split, or the rows exist (RO js l.1359)
  out.outra = rows || (qN !== null && canSplit(forma.spec, qN)) ? { desabilitada: !!rows && rows.length >= MAX_SAIDAS } : null;

  // The rows
  let somaOk = false;
  /** The rows as the payload sends them, in the order they happened; null until every row reads */
  let porHora: { quantity: string; exitPrice: string; exit: string; pnl?: string }[] | null = null;
  /** «Custos» (for the whole trade: sent on the last row) */
  let custosLinhas: string | null = null;
  if (rows) {
    const vsvLigado = !!m0.vsv?.ligado;
    const atual = hmOn(now, conta.clock);
    const precisa = forma.modo === 'digitado';
    const opcao = forma.tipo === 'opcao';
    const lidas = rows.map((s, k) => {
      const ult = k === rows.length - 1;
      const preco = s.preco !== '' ? s.preco : ult && vsvLigado ? '0' : '';
      const hora = s.hora ?? (ult && vsvLigado && m0.vsv?.hora ? m0.vsv.hora : atual);
      const q = lerQuantidade(forma, { qtd: s.qtd, qtdOutro: true });
      const p = lerPrecoDe(forma, preco, 'saída', opcao);
      const shm = hhmm(hora);
      let eH: string | undefined;
      if (shm === null) eH = ERROS.hora;
      else if (lidos.hm !== null && (parseHhMm(shm) as number) < (parseHhMm(lidos.hm) as number)) eH = ERROS.saidaAntes(lidos.hm);
      else if (m0.entradaEm && firstLocalHmAtOrAfter(m0.entradaEm, shm, conta.clock).getTime() > now.getTime()) eH = ERROS.saidaFutura(horaRel(conta, now));
      let res: Lido = { value: null };
      if (precisa) {
        const d = lerDinheiro(s.res, true);
        res = d.vazio ? { value: null, erro: ERROS_PRECOS.resVazio } : d;
      }
      return { s, preco, hora, shm, q, p, eH, res };
    });
    for (const l of lidas) {
      const id = l.s.id;
      if (l.q.erro) erros[`s${id}q`] = l.q.erro;
      if (l.p.erro) erros[`s${id}p`] = l.p.erro;
      if (l.eH) erros[`s${id}h`] = l.eH;
      if (l.res.erro) erros[`s${id}r`] = l.res.erro;
    }

    // The sum: an empty quantity counts as zero; a quantity written wrong keeps only its row's error
    let somaQ = fromInt(0);
    for (const l of lidas) if (l.q.value !== null) somaQ = add(somaQ, numeric(l.q.value));
    const somaTxt = plainText(somaQ);
    const qsOk = lidas.every((l) => l.q.value !== null);
    somaOk = qsOk && qN !== null && cmp(somaQ, numeric(qN)) === 0;
    const somaveis = lidas.some((l) => l.q.value !== null) && lidas.every((l) => l.q.value !== null || l.s.qtd.trim() === '');
    if (somaveis && qN !== null && !somaOk) erros.soma = SAIDAS.somaErro(qtdTexto(forma, somaTxt), qtdTexto(forma, qN));

    // The result line («… em média»), the rows' money
    const precosOk = !!entrada && lidas.every((l) => l.p.value !== null);
    let linha: string;
    let total: string | null = null;
    const calcs = lidas.map((l) =>
      entrada && l.p.value !== null && l.q.value !== null ? pnlFromPrices(forma.spec, sgn, l.q.value, entrada, l.p.value) : null,
    );
    if (!r.lado) linha = RESULTADO.escolhaLado;
    else if (!precosOk) linha = SAIDAS.precos;
    else if (!somaOk) linha = SAIDAS.quantidades;
    else {
      const media = averageExit(lidas.map((l) => ({ quantity: l.q.value as string, exitPrice: l.p.value as string }))) as string;
      let dif = mul(sub(numeric(media), numeric(entrada as string)), fromInt(sgn));
      if (forma.diferenca === 'ptsFut') dif = round(dif, 2);
      let valor: string;
      if (precisa) {
        const tipados = lidas.every((l) => l.res.value !== null)
          ? lidas.reduce((t, l) => add(t, numeric(l.res.value as string)), fromInt(0))
          : null;
        valor = tipados ? dinheiro(numericText(round(tipados, 2)), conta) : SAIDAS.digiteCada;
      } else if (calcs.some((c) => c === null)) valor = RESULTADO.digite(moedaPal(conta.currency));
      else {
        total = numericText(round(calcs.reduce((t, c) => add(t, numeric(c as string)), fromInt(0)), 2));
        valor = `${forma.modo === 'estimativa' ? RESULTADO.estimativa : ''}${dinheiro(total, conta)}`;
      }
      linha = SAIDAS.linha(diferencaTexto(forma, numericText(dif)), valor);
    }

    // «Corrigir» on the total (the new markets, a computed result), «Custos» for the whole trade
    const novo = mercadoNovo(conta.market);
    const podeC = novo && !precisa;
    const corrAb = podeC && r.corrigir;
    let corrigido: string | null = null;
    delete erros.res;
    delete erros.custos;
    if (corrAb) {
      const d = lerDinheiro(r.res, true);
      if (d.vazio) erros.res = ERROS_PRECOS.resVazio;
      else if (d.erro) erros.res = d.erro;
      else corrigido = d.value;
    }
    if (novo) {
      const c = lerDinheiro(r.custos, false);
      if (c.erro) erros.custos = c.erro;
      else if (!c.vazio) custosLinhas = c.value;
    }
    const swap = swapDe(conta);
    const M = simbolo(conta);
    const bloco: BlocoResultadoModelo = {
      linha,
      corrigir: podeC && (total !== null || corrAb) ? { rotulo: corrAb ? RESULTADO.usarCalculado : RESULTADO.corrigir, aberto: corrAb } : null,
      calculado: total === null ? null : formatDecimal(total, { minDecimals: 2 }),
      notaEstimativa: forma.modo === 'estimativa' && !corrAb ? RESULTADO.notaEstimativa : null,
      campo: corrAb ? { rotulo: RESULTADO.campoCorrigido(M), nota: RESULTADO.notaCorrigido(swap), valor: r.res, erro: tentou ? erros.res ?? null : null } : null,
      custos: novo
        ? { rotulo: RESULTADO.custos(M), nota: `${RESULTADO.notaCustos[conta.market] ?? ''}${SAIDAS.daOperacao}`, valor: r.custos, erro: erros.custos ?? null }
        : null,
    };
    out.resultado = bloco;
    out.linhaResultado = linha;

    // «Venceu sem valor» applies to the last row (RO js l.1256)
    if (m0.vsv) out.vsv = { ...m0.vsv, nota: m0.vsv.nota ? `${m0.vsv.nota} ${SAIDAS.vsvUltima}` : SAIDAS.vsvUltima };

    out.saidas = {
      linhas: lidas.map((l, k) => ({
        id: l.s.id,
        rotulo: SAIDAS.rotulo(k + 1),
        removerAria: SAIDAS.removerAria(k + 1),
        qtd: l.s.qtd,
        preco: l.preco,
        hora: l.hora,
        res: l.s.res,
        erros: {},
      })),
      qRotulo: m0.quantidade?.rotulo ?? forma.quantidade.rotulo,
      res: precisa ? { rotulo: SAIDAS.resultado(M), nota: SAIDAS.notaResultado(moedaPal(conta.currency), swap) } : null,
      soma: SAIDAS.soma(qtdNumero(forma, somaTxt), qtdTexto(forma, qN ?? '0')),
      somaErro: null,
    };

    // The payload's rows, in the order they happened (ties keep the rows' order): «Corrigir» on the
    // total leaves the earlier rows their computed results and gives the last one the difference
    // (C13: the limit sees the correction at the last exit's minute); «Custos» go on the last row
    const legiveis = lidas.every((l) => l.q.value !== null && l.p.value !== null && l.shm !== null && !l.eH && !l.res.erro);
    if (legiveis && somaOk && m0.entradaEm) {
      const ordenadas = sortExitsByHour(
        lidas.map((l, k) => ({
          quantity: l.q.value as string,
          exitPrice: l.p.value as string,
          exit: l.shm as string,
          pnl: precisa ? (l.res.value as string) : undefined,
          calc: calcs[k],
        })),
        m0.entradaEm,
        conta.clock,
      );
      const ultima = ordenadas.length - 1;
      porHora = ordenadas.map(({ calc: _calc, pnl, ...x }, k) => {
        const p = k === ultima && corrigido !== null ? lastExitPnl(corrigido, ordenadas.slice(0, -1).map((y) => y.calc ?? '0')) : pnl;
        return { ...x, ...(p !== undefined ? { pnl: p } : {}), ...(k === ultima && custosLinhas !== null ? { costs: custosLinhas } : {}) };
      });
    }
  }

  // «Movi o stop para o breakeven»: rendered with a valid stop; counts only while rendered and pressed
  const rendered = lidos.stop !== null && !erros.stop;
  const efetivo = rendered && r.be;
  let bePreco: string | null = null;
  if (rendered) {
    let status = '';
    if (efetivo) {
      const lido = lerPrecoQuando(forma, r.bePreco, r.lado, entrada);
      if (lido.erro) erros.bePreco = lido.erro;
      else {
        bePreco = lido.value;
        if (r.lado && entrada) {
          const regra = regraDoAtivo(rules, forma.simbolo, { option: forma.tipo === 'opcao', direction: r.lado, entryPrice: entrada });
          status = BE_FECHADA.status(textoAFavor(forma, entrada, lido.value as string, r.lado, false), regra ? textoN(regra) : null);
        }
      }
    }
    out.be = {
      ligado: r.be,
      rotulo: rotuloBe(forma),
      valor: r.bePreco,
      status,
      erro: efetivo && (tentou || r.bePreco !== '') ? erros.bePreco ?? null : null,
    };
  }

  // The errors in the board's order, with the rows; the visible ones
  const ordem = ordemComSaidas(rows);
  out.ordem = ordem;
  out.primeiro = ordem.find((k) => erros[k]) ?? null;
  const visiveis: Partial<Record<CampoEntrada, string>> = {};
  for (const k of ordem) {
    if (!erros[k]) continue;
    if (tentou || SEMPRE.includes(k) || (k === 'bePreco' && r.bePreco !== '')) visiveis[k] = erros[k];
  }
  out.visiveis = visiveis;
  if (out.saidas) {
    for (const l of out.saidas.linhas) {
      for (const c of ['q', 'p', 'h', 'r'] as const) {
        const e = visiveis[`s${l.id}${c}`];
        if (e) l.erros[c] = e;
      }
    }
    out.saidas.somaErro = visiveis.soma ?? null;
  }
  if (out.resultado && rows && out.resultado.campo) out.resultado = { ...out.resultado, campo: { ...out.resultado.campo, erro: visiveis.res ?? null } };

  // register_after's payload (and its dry run): only a complete form
  const semErro = !ordem.some((k) => erros[k]);
  const breakeven = efetivo && bePreco ? { breakevenPriceThen: bePreco } : {};
  if (!m0.afterInput || !semErro) out.payloadFechada = null;
  else if (rows) out.payloadFechada = porHora ? afterPayload(conta.market, { ...m0.afterInput, exits: porHora, ...breakeven }) : null;
  else if (efetivo && bePreco) out.payloadFechada = afterPayload(conta.market, { ...m0.afterInput, ...breakeven });
  return out;
}

// ---------------------------------------------------------------------------------------------
// The rows' transitions (RO js l.1361–1382)
// ---------------------------------------------------------------------------------------------

/**
 * «+ Outra saída»: the first press turns the single exit into rows 1 and 2 (row 1 takes the single
 * exit's price and hour and an empty quantity; row 2 starts empty, its hour following the clock),
 * focus on row 1's quantity; later presses add a row at the end, focus on its quantity. At 20 rows
 * nothing happens (null).
 */
export function outraSaida(r: Rascunho): { r: Rascunho; foco: string } | null {
  const vazia = (id: number): SaidaRascunho => ({ id, qtd: '', preco: '', hora: null, res: '' });
  if (!r.saidas) {
    return { r: { ...r, saidas: [{ id: 1, qtd: '', preco: r.precoSaida, hora: r.horaSaida, res: '' }, vazia(2)] }, foco: 'f-s1q' };
  }
  if (r.saidas.length >= MAX_SAIDAS) return null;
  const id = Math.max(...r.saidas.map((s) => s.id)) + 1;
  return { r: { ...r, saidas: [...r.saidas, vazia(id)] }, foco: `f-s${id}q` };
}

/**
 * «Remover»: with two rows, back to one exit (the remaining row's price and hour go to the single
 * fields; focus «Preço de saída»); else the row goes and the focus moves to the next row's
 * quantity, or the previous one's when it was the last.
 */
export function removerSaida(r: Rascunho, id: number): { r: Rascunho; foco: string } {
  const rows = r.saidas ?? [];
  const k = rows.findIndex((s) => s.id === id);
  if (rows.length <= 2) {
    const fica = rows.find((s) => s.id !== id);
    return { r: { ...r, saidas: null, precoSaida: fica?.preco ?? '', horaSaida: fica?.hora ?? null }, foco: 'f-spreco' };
  }
  const nova = rows.filter((s) => s.id !== id);
  const prox = nova[k] ?? nova[k - 1];
  return { r: { ...r, saidas: nova }, foco: `f-s${prox.id}q` };
}

/** A row's field as typed */
export function mudarSaida(r: Rascunho, id: number, campo: 'qtd' | 'preco' | 'hora' | 'res', valor: string): Rascunho {
  return { ...r, saidas: (r.saidas ?? []).map((s) => (s.id === id ? { ...s, [campo]: valor } : s)) };
}

// ---------------------------------------------------------------------------------------------
// The server's answers
// ---------------------------------------------------------------------------------------------

/**
 * register_after refused «Preço quando moveu» (field "breakeven"): the E11 text under the field
 * (the local check gives it first; the server's refusal is rare). null = not this field's code.
 */
export function textoRecusaBreakeven(code: string, forma: FormaAtivo | null): string | null {
  switch (code) {
    case 'bad_price':
      return BE_FECHADA.longe;
    case 'off_tick':
      return forma?.tickTexto ? ERROS.precoPasso(forma.nomePasso, forma.tickTexto) : ERRO_REGISTRAR.off_tick;
    case 'bad_stop':
      return BE_FECHADA.lado;
    default:
      return null;
  }
}

/**
 * The exit instant step 3's banner compares with the limit's hitAt (contract §6.3 «Banner»): with
 * several exits, the trade's exit time is the last one, while the limit may have been hit at an
 * earlier row (scenario 12: 10:12, not 10:20). The counting exit at hitAt when there is one, else
 * the trade's exit (one exit: as built).
 */
export function saidaDoLimite(
  state: { trade: { exitTime: Date | null }; exits: readonly Pick<TradeExit, 'exitTime' | 'counts'>[] },
  gateNow: Pick<GateResult, 'limit'> | null,
): Date | null {
  const lim = gateNow?.limit;
  const hit = lim && lim.evaluated ? lim.hitAt : null;
  if (hit) {
    const e = state.exits.find((x) => x.counts && x.exitTime.getTime() === hit.getTime());
    if (e) return e.exitTime;
  }
  return state.trade.exitTime;
}
