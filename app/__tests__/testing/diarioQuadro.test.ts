/**
 * @jest-environment node
 *
 * Fase 4 · telas (B0): the boards' scenarios exported for the screens (testing/diarioQuadro, fixtures/diario-quadro)
 * say what the approved boards say. Every scenario is read through the real parsers, then the domain's words
 * (lib/hub/diario, lib/hub/posso, lib/hub/seletorContas: the D producers) and the built modules' words (registrarForm,
 * registrarParciais, registrarImagens: R) on those answers must give the board's strings (esperado-<cen>.json, the board
 * engine's own values). A difference is the exporter's bug, except the domain's new wordings of contract §2.5 (DEV 1–5),
 * which the allowed list below holds and nothing else.
 */
import { MARKET_SPEC } from '@/lib/domain/markets'
import { utcToLocal } from '@/lib/domain/tempo'
import {
  dayChanged,
  dayTiles,
  firstEntryAt,
  heatLevels,
  monthGrid,
  monthOf,
  previousVersions,
  weekCard,
  weekOf,
  type CalendarDay,
  type Day,
} from '@/lib/domain/diario'
import type { GateResult } from '@/lib/domain/gate'
import {
  apagadasTexto,
  avisoDeRevisoes,
  camposDaRevisao,
  celulaDaSemana,
  celulaDoCalendario,
  comoLerOCalendario,
  comoLerOHistorico,
  comoLerOPlano,
  comoLerOsNumeros,
  COLUNAS,
  diaCurto,
  diaLongo,
  diaMudouTexto,
  dinheiro,
  doPregaoAnterior,
  etiquetasDoDia,
  fatosTexto,
  foraDaSemanaItem,
  linhaDaData,
  linhaDaRevisao,
  linhaDoTopo,
  linhasDoPlano,
  listaE,
  mesTitulo,
  notaAntesDeOperar,
  notaDoDia,
  numerosDoDia,
  numerosDoHistorico,
  numerosSemRegras,
  semanaTexto,
  SELETOR_MUITAS,
  tituloDaVersao,
  valoresEm,
  versaoAnterior,
  versoesBotao,
  type ContaDiario,
  type NumerosTexto,
} from '@/lib/hub/diario'
import { janelaLinha, outrasTexto, possoNoDiario, type ContaPosso } from '@/lib/hub/posso'
import { selectorView } from '@/lib/hub/seletorContas'
import { sortAccounts } from '@/lib/hub/contas'
import { IMPORTACOES, MARKET_LABEL } from '@/components/hub/contas/copy'
import { chipMarca, contaReg, marcasDivididas, opTexto, type ContaReg } from '@/lib/hub/registrarForm'
import { linhaDoTempo, subDaPonte } from '@/lib/hub/registrarParciais'
import { formatImageSize } from '@/lib/hub/registrarImagens'
import type { DayRead, DiaryDayTrade } from '@/lib/hub/diarioDb'
import { contaDiarioDe } from '@/lib/hub/diarioPagina'
import { CENARIOS, quadro, type Cenario, type EsperadoDia, type Quadro } from '@/testing/diarioQuadro'

/**
 * Where the domain says something else than the board on purpose (the domain is final). Contract §2.5's DEV 1–5 are
 * not drawn on the exported days (DEV 2 needs two history trades on the misto day, DEV 3 a change outside window, limit
 * and breakeven, DEV 5 a hit that moved; DEV 1 is «Sem mesa», which 9b has none of; DEV 4 is on the boards). What this
 * test found is B0-1, reported to the owner with the PR. Nothing else may differ.
 */
const PERMITIDAS: { onde: RegExp; aceita: (app: string, quadro: string) => boolean; motivo: string }[] = [
  {
    onde: /\.anterior$/,
    aceita: (app, quadro) => quadro === 'Nada trazido do pregão anterior.' && /^“.+” · \d/.test(app),
    motivo:
      'B0-1: «Do pregão anterior» is the newest earlier day whose current review carries a «Levar para o próximo pregão» ' +
      '(diario_dia carry_in; lib/domain/diario carryInOf); the board looks only at the previous trading day and says ' +
      '«Nada trazido do pregão anterior.» when that day has no review',
  },
]

const NBSP = /\u00a0/g
const limpo = (s: string | null | undefined) => (s ?? '').replace(NBSP, ' ')

interface Diferenca {
  onde: string
  app: unknown
  quadro: unknown
}

function comparar(cen: string, out: Diferenca[], onde: string, app: unknown, board: unknown) {
  const a = limpo(typeof app === 'string' ? app : JSON.stringify(app ?? null))
  const b = limpo(typeof board === 'string' ? board : JSON.stringify(board ?? null))
  if (a === b) return
  if (PERMITIDAS.some((p) => p.onde.test(onde) && p.aceita(a, b))) return
  out.push({ onde, app, quadro: board })
}

const TOM: Record<string, string> = { 'tom-mint': 'mint', 'tom-red': 'red', 'tom-amber': 'amber', 'tom-muted': 'muted', 'tom-neutral': 'neutral' }

function contaPosso(q: Quadro): ContaPosso[] {
  return q.rulesNow.accounts.map((a) => ({ accountId: a.accountId, label: a.label, market: a.market, gate: a.gate, rules: a.rules }))
}

function contaDiario(q: Quadro, accountId = q.info.contaId): ContaDiario {
  const a = q.contas.find((x) => x.id === accountId)!
  const r = q.rulesNow.accounts.find((x) => x.accountId === accountId)?.rules ?? null
  return contaDiarioDe(a, r)
}

function contaRegistrar(q: Quadro, d: DayRead): ContaReg {
  const a = q.contas.find((x) => x.id === q.info.contaId)!
  const r = q.rulesNow.accounts.find((x) => x.accountId === q.info.contaId)?.rules ?? null
  return contaReg(a, r, d.desdeDay)
}

/** The board's «Posso operar hoje?» answer at the entry (the drill's facts), from the stored gate */
function palavraDoGate(g: GateResult): string {
  if (g.status === null) return 'Sem janela salva'
  if (g.status === 'encerrado') return 'Encerrado por hoje'
  if (g.status === 'fora_janela') return g.window.evaluated && g.window.position === 'nao_e_dia' ? 'Fora da sua janela · hoje não é dia da janela' : 'Fora da sua janela'
  if (!g.window.evaluated && g.window.reason === 'sem_janela' && g.warnings.length === 0) return 'Sem janela salva'
  return g.warnings.includes('limite') ? 'Liberado · com aviso do limite' : 'Liberado'
}

function numeros(n: NumerosTexto) {
  return { res: n.res, ops: n.ops, opsSub: n.opsSub, lim: n.lim, limSub: n.limSub, fora: n.fora, foraSub: n.foraSub }
}

/** The day's part: heading, tiles, ⓘ, plan, «Antes de operar», trades and drills, the review */
function compararDia(cen: string, out: Diferenca[], q: Quadro, d: DayRead, e: EsperadoDia, onde: string) {
  const conta = contaDiario(q)
  const cal = q.porConta[q.info.contaId].calendario
  const calDay: CalendarDay | null = cal.days.find((x) => x.day === d.day) ?? null
  comparar(cen, out, `${onde}.dia.titulo`, diaLongo(d.day), e.dia.titulo)
  comparar(cen, out, `${onde}.dia.tags`, etiquetasDoDia(calDay, cal.today, conta, d.facts.limit?.hitAt ?? null), e.dia.tags)
  const historia = d.trades.filter((t) => t.history).map((t) => t.trade.entryTime)
  comparar(cen, out, `${onde}.dia.nota`, notaDoDia(d.kind, conta, d.desde, historia), e.dia.nota)
  // tiles and their ⓘ
  let tiles: NumerosTexto
  let info: string
  if (d.kind === 'historico' && calDay?.history) {
    tiles = numerosDoHistorico(calDay.history, conta)
    info = comoLerOHistorico(calDay.history, conta)
  } else if (!d.desde) {
    tiles = numerosSemRegras(conta)
    info = e.infoResumo
  } else {
    const t = dayTiles(d.facts, conta.market)
    tiles = numerosDoDia(t, conta)
    info = comoLerOsNumeros(t, conta, d.facts)
  }
  const rs = e.rs as Record<string, string>
  comparar(cen, out, `${onde}.rs`, numeros(tiles), { res: rs.res, ops: rs.ops, opsSub: rs.opsSub, lim: rs.lim, limSub: rs.limSub, fora: rs.fora, foraSub: rs.foraSub })
  comparar(cen, out, `${onde}.infoResumo`, info, e.infoResumo)
  // the plan
  const temPlano = !!d.plan.rules && d.kind !== 'historico'
  comparar(cen, out, `${onde}.comPlano`, temPlano, e.comPlano)
  if (temPlano && e.plano) {
    const rules = d.plan.rules!
    comparar(cen, out, `${onde}.infoPlano`, comoLerOPlano(conta.market, !!rules.breakeven), e.infoPlano)
    comparar(
      cen,
      out,
      `${onde}.plano`,
      linhasDoPlano(rules, d.facts, conta).map((l) => ({ item: l.item, plano: l.plano, fato: l.fato, marca: l.marca, tipo: l.tipo, link: l.link })),
      e.plano,
    )
    comparar(cen, out, `${onde}.versao`, d.plan.changes.map((c) => versaoAnterior(c, rules, conta)), e.versao)
    if (e.antes?.ver) {
      comparar(cen, out, `${onde}.antes.txt`, d.note?.text ?? null, e.antes.txt)
      comparar(cen, out, `${onde}.antes.nota`, d.note ? notaAntesDeOperar(d.note, firstEntryAt(d.trades.map((t) => ({ entryTime: t.trade.entryTime, history: t.history }))), conta.tz) : null, e.antes.nota)
    } else comparar(cen, out, `${onde}.antes`, d.note, null)
    comparar(cen, out, `${onde}.anterior`, doPregaoAnterior(d.carryIn), e.anterior)
  }
  comparar(cen, out, `${onde}.apagadas`, apagadasTexto(d.deleted, conta.tz), e.apagadas)
  // the trades: each row and drill's parts the built modules word
  const reg = contaRegistrar(q, d)
  comparar(cen, out, `${onde}.trades.n`, d.trades.length, e.trades.length)
  d.trades.forEach((t, i) => compararOperacao(cen, out, q, d, t, e.trades[i], e.drills[i], reg, `${onde}.trades[${i}]`))
  // the review
  const r = d.review
  if (r && e.revisao.linha) {
    comparar(cen, out, `${onde}.revisao.linha`, linhaDaRevisao(r, d.day, conta.tz), e.revisao.linha)
    comparar(cen, out, `${onde}.revisao.mudou`, dayChanged(r.autoSummary, d.facts) ? diaMudouTexto(d.facts, conta) : null, e.revisao.mudou)
    comparar(cen, out, `${onde}.revisao.versoes`, r.previous.length ? versoesBotao(r.previous.length, false) : null, e.revisao.versoes)
    if (e.revisaoAtual) {
      const c = camposDaRevisao(r)
      comparar(
        cen,
        out,
        `${onde}.revisaoAtual`,
        { fatos: fatosTexto(r.autoSummary, conta), funcionou: c.funcionou, diferente: c.diferente, seguiu: c.seguiu, levar: c.levar },
        e.revisaoAtual,
      )
    }
    if (e.versoes) {
      comparar(
        cen,
        out,
        `${onde}.versoes`,
        previousVersions(r).map((v) => {
          const c = camposDaRevisao(v)
          return { titulo: tituloDaVersao(v, d.day, conta.tz), fatos: fatosTexto(v.autoSummary, conta), funcionou: c.funcionou, diferente: c.diferente, seguiu: c.seguiu, levar: c.levar }
        }),
        e.versoes,
      )
    }
  } else comparar(cen, out, `${onde}.revisao.linha`, r && r.written ? 'escrita' : '', e.revisao.linha)
  if (e.formulario) comparar(cen, out, `${onde}.formulario.fatos`, fatosTexto(d.facts, conta), e.formulario.fatos)
}

function compararOperacao(
  cen: string,
  out: Diferenca[],
  q: Quadro,
  d: DayRead,
  t: DiaryDayTrade,
  linha: EsperadoDia['trades'][number],
  drill: EsperadoDia['drills'][number],
  reg: ContaReg,
  onde: string,
) {
  const conta = contaDiario(q)
  const market = conta.market
  const ref = t.trade.entryTime
  const fato = (rot: string) => drill.fatos.find((f) => f[0] === rot)?.[1] ?? null
  // «Operação» (R opTexto) on every market but binárias, whose row the board writes «EUR/USD · Alta · 1 min» as opTexto does
  comparar(cen, out, `${onde}.op`, opTexto(t.trade, market), linha.op)
  // the second line of a price market (R subDaPonte); binárias' «devolvida» / «Vence às …» are L2's words
  if (market !== 'binary') comparar(cen, out, `${onde}.sub`, subDaPonte(market, t.trade, t), linha.sub)
  // «Resultado»: the net, «aberta» while open
  if (t.trade.status === 'closed') comparar(cen, out, `${onde}.res`, dinheiro(t.money.net ?? '0', conta.currency, t.money.net !== null && t.money.net !== '0'), linha.res)
  // the plan cell and the gate word at the entry
  const breaks = (t.plan ?? t.planNow)?.breaks ?? []
  const marca = t.history ? 'hist' : breaks.length ? `● ${breaks.map((b) => ({ fora_da_janela: 'fora da janela', depois_do_limite: 'depois do limite' })[b as 'fora_da_janela']).join(' · ')}` : null
  if (marca) comparar(cen, out, `${onde}.plano`, marca, linha.plano)
  else comparar(cen, out, `${onde}.plano`, (t.plan ?? t.planNow)?.verdict === 'no_plano' ? 'No plano' : '—', linha.plano)
  const g = t.gate ?? t.gateNow
  if (g) comparar(cen, out, `${onde}.posso`, palavraDoGate(g), fato('Posso operar hoje?'))
  // «Resultado» of the drill (with «bruto» when a commission is known)
  const res = fato('Resultado')
  if (res && t.money.net !== null) comparar(cen, out, `${onde}.drill.resultado`, res.startsWith(limpo(dinheiro(t.money.net, conta.currency, t.money.net !== '0'))), true)
  const bruto = res ? /· bruto (.+?)(?: ·|$)/.exec(res)?.[1] ?? null : null
  if (bruto) comparar(cen, out, `${onde}.drill.bruto`, t.money.gross === null ? null : dinheiro(t.money.gross, conta.currency), bruto)
  // «Comissão»
  const com = fato('Comissão')
  if (com && t.money.commission !== null) comparar(cen, out, `${onde}.drill.comissao`, dinheiro(t.money.commission, conta.currency, false), com)
  // the timeline (R linhaDoTempo, relative to the trade's own day)
  if (drill.tempo) {
    comparar(
      cen,
      out,
      `${onde}.tempo`,
      linhaDoTempo(reg, t, ref, { comUndo: false }).map((x) => `${x.hora ?? 'sem hora'} ${x.texto}`),
      drill.tempo.map((x) => `${x.h} ${x.txt}`),
    )
  }
  // the marks' times (R chipMarca, and «antes: … · agora: …» of marcasDivididas)
  if (drill.marcas) {
    const divididas = marcasDivididas(reg, t.marks, ref)
    for (const grupo of drill.marcas) {
      if (!grupo.valor) continue
      const kind = grupo.rot.startsWith('Setup') ? 'setup' : grupo.rot === 'Execução' ? 'execucao' : 'emocao'
      const now = t.marksNow.find((m) => m.kind === kind)
      if (!now) {
        comparar(cen, out, `${onde}.marca.${kind}`, null, grupo.tempo)
        continue
      }
      const trocada = grupo.tempo?.startsWith('antes:')
      const texto = trocada
        ? divididas.depois.find((x) => x.historico)?.historico ?? null
        : chipMarca(reg, now, ref).texto
      comparar(cen, out, `${onde}.marca.${kind}`, texto, grupo.tempo)
      comparar(cen, out, `${onde}.marca.${kind}.valor`, now.currentValue, grupo.valor)
    }
  }
  // images: «nome · tamanho»
  if (drill.ax) comparar(cen, out, `${onde}.imagens`, t.images.map((i) => `${i.name} · ${formatImageSize(i.bytes ?? 0)}`), drill.ax.imgs.map((i) => `${i.nome} · ${i.tam}`))
  if (drill.ax) comparar(cen, out, `${onde}.nota`, t.trade.note ?? '', drill.ax.nota)
  // «Completada pelo arquivo de 11 nov: comissão US$ 2,48.» (a link that brought the commission)
  const completada = drill.linhas.find((l) => l.startsWith('Completada pelo arquivo'))
  const link = t.links.find((l) => l.after.commission !== undefined && l.after.commission !== null)
  if (completada || link) {
    const texto = link
      ? `Completada pelo arquivo de ${diaCurto(utcToLocal(link.linkedAt, conta.tz).date)}: comissão ${dinheiro(String(link.after.commission), conta.currency, false)}.`
      : null
    comparar(cen, out, `${onde}.completada`, texto, completada ?? null)
  }
}

function compararCenario(cen: Cenario): Diferenca[] {
  const out: Diferenca[] = []
  const q = quadro(cen)
  const e = q.esperado
  const conta = contaDiario(q)
  const cal = q.calendario
  // header, the card
  comparar(cen, out, 'dataLinha', linhaDaData(q.agora, conta.tz), e.dataLinha)
  const atual = q.rulesNow.accounts.find((a) => a.accountId === q.info.contaId)!
  comparar(cen, out, 'conta.janela', janelaLinha(atual.rules), e.conta.janela)
  comparar(cen, out, 'conta.valores', valoresEm(conta.market, conta.currency), e.conta.valores)
  const p = possoNoDiario(contaPosso(q), q.info.contaId)
  const sel = p.conta!
  const linhaSel = (l: typeof sel.linha, soma: boolean) => ({
    pal: l.palavra,
    sub: l.sub,
    acao: l.acao?.texto ?? null,
    acaoAria: l.acao?.aria ?? null,
    lim: l.limite ? `${l.limite.usado} ${l.limite.de}` : null,
    soma,
  })
  comparar(cen, out, 'possoSel', linhaSel(sel.linha, sel.somando), (({ pal, sub, acao, acaoAria, lim, soma }) => ({ pal, sub, acao, acaoAria, lim, soma }))(e.possoSel[0]))
  comparar(cen, out, 'outras', p.outras ? { titulo: p.outras.titulo, partes: p.outras.partes } : null, e.outras ? { titulo: e.outras.titulo, partes: e.outras.partes.map((x) => ({ texto: x.texto, tom: TOM[x.tom] })) } : null)
  if (p.outras) comparar(cen, out, 'outrasTexto', outrasTexto(p.outras), `${e.outras!.titulo} ${e.outras!.partes.map((x) => x.texto).join(' · ')}`)
  if (e.outras?.abertas) {
    comparar(
      cen,
      out,
      'possoOutras',
      p.outras!.contas.map((c) => ({ nome: c.label, ...linhaSel(c.linha, false) })),
      e.possoOutras.map(({ nome, pal, sub, acao, acaoAria, lim }) => ({ nome, pal, sub, acao, acaoAria, lim, soma: false })),
    )
  }
  if (!e.flags.pronto) return out
  // the top line and the banner
  comparar(cen, out, 'linhaTopo', linhaDoTopo(cal.desdeDay, cal.days, cal.today), e.linhaTopo)
  comparar(cen, out, 'aviso', avisoDeRevisoes(cal.days, cal.today)?.texto ?? null, e.aviso)
  // the calendar's month
  const mes = q.info.mes ?? monthOf(q.info.dia)
  const mesLido = q.meses[mes]
  const grid = monthGrid({ month: mes, today: cal.today, market: conta.market, days: cal.days, weeks: cal.weeks, mes: mesLido, levels: heatLevels(cal.days) })
  comparar(cen, out, 'mes.titulo', mesTitulo(mes), e.mes!.titulo)
  comparar(cen, out, 'mes.colunas', COLUNAS.slice(0, grid.columns), e.mes!.colunas)
  comparar(cen, out, 'infoCal', comoLerOCalendario(conta.market, cal.account.day), e.infoCal)
  comparar(cen, out, 'semanas.n', grid.weeks.length, e.semanas!.length)
  grid.weeks.forEach((w, i) => {
    const ew = e.semanas![i]
    const s = celulaDaSemana(w, conta)
    comparar(cen, out, `semana[${i}]`, s ? { rotulo: s.rotulo, res: s.res, n: s.n, fora: s.fora, hist: s.historia, aria: s.aria } : null, ew.botao ? { rotulo: ew.rotulo, res: ew.res, n: ew.n, fora: ew.fora, hist: ew.hist, aria: ew.aria } : null)
    w.cells.forEach((cell, j) => {
      const ec = ew.dias[j]
      const mesDay = mesLido?.days.find((x) => x.day === cell.day) ?? null
      const c = celulaDoCalendario(cell, conta, mesDay)
      comparar(cen, out, `celula ${cell.day}`, { res: c.res, curto: c.resCurto, dica: c.dica, aria: c.aria, clicavel: cell.clickable }, { res: ec.res, curto: ec.curto, dica: ec.dica, aria: ec.aria, clicavel: ec.clicavel })
      if (cell.inMonth && !cell.future) {
        const marcas = cell.fora?.n || cell.limitHitAt || cell.reviewed ? { fora: !!cell.fora?.n, limite: !!cell.limitHitAt, revisao: cell.reviewed } : null
        comparar(cen, out, `marcas ${cell.day}`, marcas, ec.marcas)
      }
    })
  })
  // the open day
  const d = q.dias[q.info.dia]
  compararDia(cen, out, q, d, e as EsperadoDia, 'dia')
  for (const [dia, ed] of Object.entries(e.extras ?? {})) {
    const dd = q.dias[dia]
    if (!dd) out.push({ onde: `extras ${dia}`, app: 'not exported', quadro: 'drawn' })
    else compararDia(cen, out, q, dd, ed, `extras ${dia}`)
  }
  // the week
  const semana = q.info.semana ?? weekOf(q.info.dia)
  const mesDaSemana = q.meses[monthOf(semana)] && monthOf(semana) !== mes ? q.meses[monthOf(semana)] : mesLido
  const card = weekCard({ day: semana, today: cal.today, market: conta.market, days: cal.days, weeks: cal.weeks, mesWeeks: mesDaSemana?.weeks })
  const regras = atual.rules
  const st = semanaTexto(card, conta, { temLimite: !!regras?.limit, temJanela: !!regras?.windows.length })
  comparar(cen, out, 'semana.titulo', st.titulo, e.semana!.titulo)
  comparar(cen, out, 'semana.info', st.info, e.semana!.info)
  comparar(cen, out, 'semana.numeros', st.vazia ? null : st.numeros.map((x) => [x.rot, x.val]), e.semana!.vazia ? null : e.semana!.numeros)
  comparar(cen, out, 'semana.vazia', st.vazia, e.semana!.vazia)
  comparar(cen, out, 'semana.barras', st.barras.map((b) => [b.rot, b.val, b.valCurto]), e.semana!.barras)
  comparar(cen, out, 'semana.leitor', st.leitor, e.semana!.leitor)
  const fim = card.lastShown
  // the week's month read covers the whole ISO week (a straddling week is whole in both months)
  const fora = (mesDaSemana?.foraTrades ?? [])
    .filter((t) => t.day >= semana && t.day <= fim)
    .sort((a, b) => a.entryTime.getTime() - b.entryTime.getTime())
  comparar(cen, out, 'semana.fora', fora.map((t) => foraDaSemanaItem(t, conta)), e.semana!.fora)
  return out
}

describe('the boards’ scenarios, through the real parsers', () => {
  it.each(CENARIOS)('%s reads: accounts, rules_now, the calendar, every month, the open day', (cen) => {
    const q = quadro(cen)
    expect(q.contas.length).toBeGreaterThan(0)
    expect(q.rulesNow.accounts.map((a) => a.accountId)).toContain(q.info.contaId)
    expect(q.calendario.account.id).toBe(q.info.contaId)
    expect(q.dias[q.info.dia]?.day).toBe(q.info.dia)
    expect(MARKET_SPEC[q.calendario.account.market]).toBeDefined()
    for (const m of Object.values(q.meses)) expect(m.account.id).toBe(q.info.contaId)
  })
})

describe('the D and R producers on the exported answers say what the boards say', () => {
  it.each(CENARIOS)('scenario %s', (cen) => {
    expect(compararCenario(cen)).toEqual([])
  })
})

describe('13 · Importações of Top One: the batches and what undoing each does', () => {
  it('the board’s three newest batches: their parts, the built confirmation, and the counts «Saem junto» names', () => {
    const q = quadro('13')
    const lotes = q.lotes!
    const e = q.esperado.lotes!
    const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
    e.forEach((esperado, i) => {
      const b = lotes.batches[i]
      const u = lotes.undo[b.id]
      expect(esperado.titulo.endsWith(` · ${b.file_name}`)).toBe(true)
      expect([IMPORTACOES.inserted(b.rows_inserted), IMPORTACOES.linked(b.rows_linked ?? 0), IMPORTACOES.duplicate(b.rows_duplicate), IMPORTACOES.errors(b.rows_error)]).toEqual(esperado.partes)
      expect(limpo(IMPORTACOES.confirm(u))).toBe(esperado.confirma)
      const itens = [
        u.diario.marks ? pl(u.diario.marks, 'marca', 'marcas') : '',
        u.diario.images ? pl(u.diario.images, 'imagem', 'imagens') : '',
        u.diario.notes ? pl(u.diario.notes, 'nota', 'notas') : '',
      ].filter(Boolean)
      expect(itens.length ? `Saem junto: ${listaE(itens)} que você pôs no Diário.` : null).toBe(esperado.saem)
    })
  })
})

describe('9b · the selector of many accounts', () => {
  it('«apex», «funded», «zzz», «lúcid» and no query: the status and the groups', () => {
    const q = quadro('9b')
    const e = q.esperado.busca!
    const ativos = sortAccounts(q.contas)
    for (const [termo, esperado] of Object.entries(e)) {
      const v = selectorView(ativos, termo)
      const status = termo.trim() ? SELETOR_MUITAS.achadas(v.found) : null
      expect({ termo, status }).toEqual({ termo, status: esperado.status })
      if (esperado.nenhuma) expect(v.found).toBe(0)
      if (esperado.nenhuma) expect(SELETOR_MUITAS.nenhuma(termo)).toBe(esperado.nenhuma)
      const grupos = v.blocks.map((b) => ({
        mercado: b.firstOfMarket ? SELETOR_MUITAS.grupo(MARKET_LABEL[b.market], b.marketCount) : null,
        mesa: b.byFirm ? SELETOR_MUITAS.grupo(b.firm ?? SELETOR_MUITAS.semMesa, b.accounts.length) : null,
        contas: b.accounts.map((a) => a.label),
      }))
      expect({ termo, grupos }).toEqual({ termo, grupos: esperado.grupos.filter((g) => g.contas.length) })
    }
  })

  it('choosing «Apex 50k #5» and «Lucid 50k»: the card’s line and the others', () => {
    const q = quadro('9b')
    for (const [nome, id] of Object.entries(q.info.escolhas!)) {
      const e = q.esperado.escolhas![nome]
      const p = possoNoDiario(contaPosso(q), id)
      expect(p.conta!.linha.palavra).toBe(e.possoSel[0].pal)
      expect(p.conta!.linha.sub).toBe(e.possoSel[0].sub)
      expect(`${p.conta!.linha.limite!.usado} ${p.conta!.linha.limite!.de}`.replace(NBSP, ' ')).toBe(e.possoSel[0].lim)
      expect(p.conta!.somando).toBe(e.possoSel[0].soma)
      expect(outrasTexto(p.outras!)).toBe(`${e.outras.titulo} ${e.outras.partes.map((x) => x.texto).join(' · ')}`)
      const dia = q.porConta[id].dias[q.info.dia]
      expect(diaLongo(dia.day)).toBe(e.dia)
      expect(limpo(numerosDoDia(dayTiles(dia.facts, dia.account.market), contaDiario(q, id)).res)).toBe(e.res)
    }
  })
})
