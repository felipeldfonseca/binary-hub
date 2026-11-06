/**
 * @jest-environment node
 *
 * Fase 4 · telas, lane L2: lib/hub/diarioOperacao (the words of «Operações do dia» and of the drill) on every trade of
 * every exported day of the approved boards' scenarios (testing/diarioQuadro) says what the boards say
 * (esperado-<cen>.json: the board engine's own strings). Plus the recorded answers the boards do not draw (a file that
 * closed a trade, a corrected price, the old page, «Na corretora» only a whole minute apart) and the open trades of
 * other days of a binary and an option (G14).
 */
import fs from 'fs'
import path from 'path'
import { parseDay, type DayRead, type DiaryDayTrade, type OpenElsewhere } from '@/lib/hub/diarioDb'
import { contaDiarioDe } from '@/lib/hub/diarioPagina'
import { contaReg } from '@/lib/hub/registrarForm'
import { formatImageSize } from '@/lib/hub/registrarImagens'
import {
  abertasDeOutrosDias,
  acaoDaLinha,
  clipDaLinha,
  detalhesAria,
  fatosDaOperacao,
  horaDaLinha,
  linhasDaOperacao,
  marcasDaOperacao,
  operacaoDaLinha,
  operacaoDeOutroDia,
  origemDaOperacao,
  planoDaLinha,
  possoNaEntrada,
  quandoAnexos,
  quandoNoDia,
  resultadoDaLinha,
  subDaLinha,
  tempoDaOperacao,
  type ContaDaOperacao,
} from '@/lib/hub/diarioOperacao'
import { CENARIOS, quadro, type Cenario, type EsperadoDia, type Quadro } from '@/testing/diarioQuadro'

const NBSP = / /g
const limpo = (s: unknown): any => (typeof s === 'string' ? s.replace(NBSP, ' ') : Array.isArray(s) ? s.map(limpo) : s)
/** The same value with every no-break space as a space (the board writes some, the app others) */
const sem = (x: unknown): any => JSON.parse(JSON.stringify(x ?? null).replace(/\\u00a0|\u00a0/g, ' '))

function contaDa(q: Quadro, d: DayRead): ContaDaOperacao {
  const a = q.contas.find((x) => x.id === q.info.contaId)!
  const rules = q.rulesNow.accounts.find((x) => x.accountId === q.info.contaId)?.rules ?? null
  const c = contaDiarioDe(a, rules)
  return { market: c.market, currency: c.currency, tz: c.tz, reg: contaReg(a, rules, d.desdeDay) }
}

/** The row as the board's esperado writes it */
function linhaDoApp(t: DiaryDayTrade, conta: ContaDaOperacao) {
  const p = planoDaLinha(t)
  const res = resultadoDaLinha(t, conta.currency)
  const acao = acaoDaLinha(t, conta.market, conta.tz)
  return {
    h: horaDaLinha(t, conta.tz),
    op: limpo(operacaoDaLinha(t, conta.market)),
    chip: origemDaOperacao(t),
    sub: subDaLinha(t, conta.market, conta.tz),
    res: res ? res.texto : 'aberta',
    plano: p.tipo === 'ok' ? 'No plano' : p.tipo === 'fora' ? `● ${p.texto}` : p.tipo === 'historico' ? 'hist' : '—',
    planoAria: p.tipo === 'fora' ? p.aria : null,
    acao: acao?.texto ?? null,
    acaoAria: acao?.aria ?? null,
    clip: clipDaLinha(t),
    rot: detalhesAria(t, conta.market, conta.tz),
  }
}

function drillDoApp(t: DiaryDayTrade, conta: ContaDaOperacao, d: DayRead) {
  const tempo = tempoDaOperacao(t, conta)
  const temAx = t.images.length > 0 || !!t.trade.note
  return {
    fatos: limpo(fatosDaOperacao(t, conta)),
    linhas: limpo(linhasDaOperacao(t, conta, { limiteAtingidoAs: d.facts.limit?.hitAt ?? null })),
    tempo: tempo ? tempo.itens.map((x) => ({ h: x.hora, txt: limpo(x.texto), sub: x.sub })) : null,
    be: tempo?.breakeven ?? null,
    ax: temAx
      ? {
          quando: quandoAnexos(t, conta.tz),
          imgs: t.images.map((i, k) => ({ nome: i.name, tam: limpo(formatImageSize(i.bytes ?? 0)), aria: `Abrir ${i.name}, imagem ${k + 1} de ${t.images.length}` })),
          nota: t.trade.note ?? '',
        }
      : null,
    adicionar: !t.history && !temAx,
    marcas: t.history ? null : marcasDaOperacao(t, conta.reg).map((g) => ({ rot: g.rotulo, valor: g.valor, tempo: g.tempo })),
  }
}

/** Every exported day of a scenario the board draws: the open one and its extras */
function diasDo(cen: Cenario): { q: Quadro; d: DayRead; e: EsperadoDia; onde: string }[] {
  const q = quadro(cen)
  const out: { q: Quadro; d: DayRead; e: EsperadoDia; onde: string }[] = []
  if (q.esperado.trades) out.push({ q, d: q.dias[q.info.dia], e: q.esperado as EsperadoDia, onde: `${cen} ${q.info.dia}` })
  for (const [dia, e] of Object.entries(q.esperado.extras ?? {})) out.push({ q, d: q.dias[dia], e, onde: `${cen} ${dia}` })
  return out
}

describe('every trade of every scenario day: the row and the drill say what the board says', () => {
  const casos = CENARIOS.flatMap((cen) => diasDo(cen).map((x) => [x.onde, x] as const))
  it.each(casos)('%s', (_onde, { q, d, e }) => {
    const conta = contaDa(q, d)
    expect(d.trades.length).toBe(e.trades.length)
    d.trades.forEach((t, i) => {
      const er = e.trades[i]
      expect(sem({ i, ...linhaDoApp(t, conta) })).toEqual(sem({
        i,
        h: er.h,
        op: er.op,
        chip: er.chip,
        sub: er.sub,
        res: er.res,
        plano: er.plano,
        planoAria: er.planoAria,
        acao: er.acao,
        acaoAria: er.acaoAria,
        clip: er.clip,
        rot: er.rot,
      }))
      const ed = e.drills[i]
      const app = drillDoApp(t, conta, d)
      expect(sem({ i, fatos: app.fatos })).toEqual(sem({ i, fatos: ed.fatos }))
      expect(sem({ i, linhas: app.linhas })).toEqual(sem({ i, linhas: ed.linhas }))
      expect(sem({ i, tempo: app.tempo, be: app.be })).toEqual(sem({ i, tempo: ed.tempo, be: ed.be }))
      expect(sem({ i, ax: app.ax })).toEqual(sem({ i, ax: ed.ax ? { quando: ed.ax.quando, imgs: ed.ax.imgs, nota: ed.ax.nota } : null }))
      expect(sem({ i, adicionar: app.adicionar })).toEqual(sem({ i, adicionar: ed.adicionar }))
      expect(sem({ i, marcas: app.marcas })).toEqual(sem({ i, marcas: ed.marcas }))
    })
  })

  it('the breakeven line never shows on a drill without a stop (dez 3/3b 19 nov, 11a 24 nov, 1º dez 10:04 and 11:09, 23 out 10:45)', () => {
    const semStop: [Cenario, string, string[]][] = [
      ['3', '2026-11-19', ['10:03', '10:14', '10:24', '10:33', '10:52']],
      ['3b', '2026-11-19', ['10:03', '10:14', '10:24', '10:33', '10:52']],
      ['11a', '2026-11-24', ['10:31', '11:05', '11:20']],
      ['11b', '2026-12-01', ['10:04', '11:09']],
      ['4', '2026-10-23', ['10:45']],
    ]
    for (const [cen, dia, horas] of semStop) {
      const q = quadro(cen)
      const d = q.dias[dia]
      const conta = contaDa(q, d)
      for (const t of d.trades.filter((x) => horas.includes(horaDaLinha(x, conta.tz).slice(0, 5)))) {
        expect(t.trade.stopPrice).toBeNull()
        expect(linhasDaOperacao(t, conta).some((l) => l.startsWith('Breakeven'))).toBe(false)
      }
    }
  })

  it('the drawn breakeven lines: hoje 1 10:04, dez 2 10:03, 1º dez 10:33, 24 nov 10:02', () => {
    const com: [Cenario, string, string][] = [
      ['1', '2026-11-12', '10:04'],
      ['2', '2026-11-10', '10:03'],
      ['11b', '2026-12-01', '10:33'],
      ['11a', '2026-11-24', '10:02'],
    ]
    for (const [cen, dia, h] of com) {
      const q = quadro(cen)
      const d = q.dias[dia]
      const conta = contaDa(q, d)
      const t = d.trades.find((x) => horaDaLinha(x, conta.tz).startsWith(h))!
      expect(linhasDaOperacao(t, conta)).toContain('Breakeven: o stop não foi movido · sua regra: +8 pts.')
    }
  })

  it('the timeline is written on the trade’s own day: bare hours whatever today is (dez 2 on 1º dez, hoje 12a on 12 nov)', () => {
    for (const cen of ['2', '12a'] as Cenario[]) {
      const q = quadro(cen)
      const d = q.dias['2026-11-10']
      const conta = contaDa(q, d)
      const t = d.trades.find((x) => horaDaLinha(x, conta.tz) === '10:14–10:41')!
      expect(tempoDaOperacao(t, conta)!.itens.map((x) => x.hora)).toEqual(['10:14', '10:22', '10:22', '10:41'])
    }
  })

  it('an open trade without exits has no «Resultado» nor «Comissão» (Lucid 30 nov 10:52)', () => {
    const q = quadro('9')
    const d = q.dias['2026-11-30']
    const conta = contaDa(q, d)
    const t = d.trades.find((x) => x.trade.status === 'open')!
    expect(fatosDaOperacao(t, conta).map((f) => f[0])).toEqual(['Hora', 'Entrada', 'Em aberto', 'Stop · alvo', 'Posso operar hoje?'])
  })
})

describe('images «quando»: «salva»/«salvas», «às» vs «em D, às», and the marks’ cut (DEV-C4)', () => {
  const q = quadro('1')
  const d = q.dias['2026-11-12']
  const conta = contaDa(q, d)
  const aberta = d.trades.find((t) => t.trade.status === 'open')!

  it('a note saved at 10:42 on the open MES with a partial at 10:31 reads «depois do resultado»', () => {
    const t = { ...aberta, trade: { ...aberta.trade, note: 'Parcial no +8.', noteSavedAt: new Date('2026-11-12T15:42:00Z') } }
    expect(quandoAnexos(t, conta.tz)).toBe('salva às 10:42 · depois do resultado')
  })

  it('one image alone is «salva», two «salvas»; another date «em 13 nov, às 09:00»', () => {
    const img = (id: string, at: string) => ({ id, path: `u/${id}.png`, mime: 'image/png' as const, bytes: 1000, name: `${id}.png`, position: 1, savedAt: new Date(at) })
    const um = { ...aberta, images: [img('a', '2026-11-13T14:00:00Z')] }
    expect(quandoAnexos(um, conta.tz)).toBe('salva em 13 nov, às 09:00 · depois do resultado')
    const dois = { ...aberta, images: [img('a', '2026-11-12T15:20:00Z'), img('b', '2026-11-12T15:21:00Z')] }
    expect(quandoAnexos(dois, conta.tz)).toBe('salvas às 10:21 · antes da saída')
  })

  it('quandoNoDia: «às 10:42» on the trade’s day, «em 1º dez, às 11:35» on another', () => {
    const ref = aberta.trade.entryTime
    expect(quandoNoDia(new Date('2026-11-12T15:42:00Z'), ref, conta.tz)).toBe('às 10:42')
    expect(quandoNoDia(new Date('2026-12-01T16:35:00Z'), ref, conta.tz)).toBe('em 1º dez, às 11:35')
  })
})

describe('possoNaEntrada: the answer only, a warning or «hoje não é dia da janela» as its sub', () => {
  const g = quadro('2').dias['2026-11-10'].trades[0].gate!
  it('«Liberado», «Liberado · com aviso do limite», «Encerrado por hoje», «Fora da sua janela · hoje não é dia da janela»', () => {
    expect(possoNaEntrada(g)).toBe('Liberado')
    expect(possoNaEntrada({ ...g, warnings: ['limite'] })).toBe('Liberado · com aviso do limite')
    expect(possoNaEntrada({ ...g, status: 'encerrado' })).toBe('Encerrado por hoje')
    expect(possoNaEntrada({ ...g, status: 'fora_janela', window: { ...(g.window as object), evaluated: true, position: 'nao_e_dia' } as never })).toBe(
      'Fora da sua janela · hoje não é dia da janela',
    )
    expect(possoNaEntrada({ ...g, status: null })).toBe('Sem janela salva')
  })
})

describe('the recorded answers the boards do not draw', () => {
  const ler = (nome: string): DayRead => {
    const p = path.join(__dirname, '../../testing/fixtures/diario', `${nome}.json`)
    return parseDay(JSON.parse(fs.readFileSync(p, 'utf8')))
  }
  const top = { id: 'conta', label: 'Top One', market: 'futures' as const, platform: 'topone' }
  const contaTop = (d: DayRead): ContaDaOperacao => ({ market: 'futures', currency: 'USD', tz: 'America/New_York', reg: contaReg(top, null, d.desdeDay) })

  it('dia-top-1027: «Fechada pelo arquivo de …», a corrected price, a commission-only link, «Na corretora» only a whole minute apart', () => {
    const d = ler('dia-top-1027')
    const conta = contaTop(d)
    const todas = d.trades.flatMap((t) => linhasDaOperacao(t, conta))
    const comLinks = d.trades.filter((t) => t.links.length > 0)
    expect(comLinks.length).toBeGreaterThan(0)
    for (const t of comLinks) {
      const ls = linhasDaOperacao(t, conta)
      for (const l of t.links) {
        if (l.closed) expect(ls.some((x) => /^Fechada pelo arquivo de \d+º? \w{3}\.$/.test(x))).toBe(true)
        const longe = [
          [l.fileEntryAt, t.trade.entryTime],
          [l.fileExitAt, t.trade.exitTime],
        ].some(([a, b]) => !!a && !!b && Math.abs(a.getTime() - b.getTime()) >= 60_000)
        expect(ls.some((x) => x.startsWith('Na corretora:'))).toBe(longe)
        for (const col of l.differs.filter((c) => c === 'entry_price' || c === 'exit_price')) {
          expect(ls.some((x) => x.startsWith(`O arquivo corrigiu o preço de ${col === 'entry_price' ? 'entrada' : 'saída'}:`))).toBe(true)
        }
      }
    }
    expect(todas.every((x) => !x.includes('undefined') && !x.includes('null'))).toBe(true)
  })

  it('dia-top-1027-aberta: the old page’s trade is «Página antiga» with its line', () => {
    const d = ler('dia-top-1027-aberta')
    const conta = contaTop(d)
    const antigas = d.trades.filter((t) => t.planKind === 'recalculado' && t.import === null)
    expect(antigas.length).toBeGreaterThan(0)
    for (const t of antigas) {
      expect(origemDaOperacao(t)).toBe('Página antiga')
      expect(linhasDaOperacao(t, conta)).toContain('Lançada na página antiga: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.')
    }
  })
})

describe('G14: open trades of other days', () => {
  const base: OpenElsewhere = {
    tradeId: 't1',
    tradingDay: '2026-11-30',
    entryTime: new Date('2026-11-30T15:52:00Z'),
    symbol: 'MNQ',
    direction: 'long',
    quantity: '1',
    assetType: 'futures',
    expiresAt: null,
    app: true,
  }
  it('«1 operação aberta de ontem: MNQ · Compra · 1 ct.» + «Abrir 30 nov»', () => {
    const [l] = abertasDeOutrosDias([base], '2026-12-01', 'futures')
    expect(limpo(l.texto)).toBe('1 operação aberta de ontem: MNQ · Compra · 1 ct.')
    expect(l.link).toBe('Abrir 30 nov')
    expect(l.tradeId).toBe('t1')
  })
  it('another day and the plural, one line per day, newest first', () => {
    const xs = [
      { ...base, tradeId: 'a', tradingDay: '2026-11-27' },
      { ...base, tradeId: 'b' },
      { ...base, tradeId: 'c', symbol: 'MES', direction: 'short' as const, quantity: '2', entryTime: new Date('2026-11-30T16:10:00Z') },
    ]
    const ls = abertasDeOutrosDias(xs, '2026-12-01', 'futures')
    expect(ls.map((l) => limpo(l.texto))).toEqual(['2 operações abertas de ontem: MNQ · Compra · 1 ct e MES · Venda · 2 ct.', '1 operação aberta de 27 nov: MNQ · Compra · 1 ct.'])
    expect(ls.map((l) => l.link)).toEqual(['Abrir 30 nov', 'Abrir 27 nov'])
  })
  it('a binary «EUR/USD · Alta» and an option «{symbol} · Compra · 2 ct» (no duration, no contract words)', () => {
    expect(operacaoDeOutroDia({ ...base, symbol: 'EUR/USD', direction: 'call', quantity: null, assetType: 'binary_option' }, 'binary')).toBe('EUR/USD · Alta')
    expect(limpo(operacaoDeOutroDia({ ...base, symbol: 'SPY', direction: 'long', quantity: '2', assetType: 'option' }, 'options'))).toBe('SPY · Compra · 2 ct')
  })
})
