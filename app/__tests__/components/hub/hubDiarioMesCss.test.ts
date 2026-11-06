/**
 * Fase 4 · telas, lane L1: hub-diario-mes.css (the top of the Diário, the calendar, the week, the footer, the account
 * selector's additions) and hub-posso.css (the card on the Diário). jsdom does no layout, so these check the rules
 * themselves (the screenshots at 375 / 768 / 1280 show the result): every rule under .hub, only this lane's prefixes,
 * the 44 px targets, the board's breakpoints, the 375 px arithmetic of a seven-column month (contract §5.8), reduced
 * motion, and the contrast of every pair of contract §5.9 in both themes (alpha composited over the card over --bg).
 */
import fs from 'fs'
import path from 'path'

const raiz = path.join(__dirname, '../../..')
const lerCss = (nome: string) => fs.readFileSync(path.join(raiz, 'styles', nome), 'utf8')

function rules(text: string): { media: string; rule: CSSStyleRule }[] {
  const style = document.createElement('style')
  style.textContent = text
  document.head.appendChild(style)
  const out: { media: string; rule: CSSStyleRule }[] = []
  for (const r of Array.from((style.sheet as CSSStyleSheet).cssRules)) {
    if (r instanceof CSSMediaRule) {
      for (const inner of Array.from(r.cssRules)) if ('selectorText' in inner) out.push({ media: r.conditionText, rule: inner as CSSStyleRule })
    } else if ('selectorText' in r) out.push({ media: '', rule: r as CSSStyleRule })
  }
  style.remove()
  return out
}

const mes = rules(lerCss('hub-diario-mes.css'))
const posso = rules(lerCss('hub-posso.css'))
const hub = rules(lerCss('hub.css'))
const diario = rules(lerCss('hub-diario.css'))

/** A rule's declaration, by one of its selectors, top level or inside `media` (the last rule that sets it: the cascade's winner) */
function decl(lista: typeof mes, selector: string, prop: string, media = ''): string {
  const r = [...lista].reverse().find((x) => x.media === media && x.rule.selectorText.split(',').map((s) => s.trim()).includes(selector) && x.rule.style.getPropertyValue(prop) !== '')
  if (!r) throw new Error(`no rule ${selector} (${media})`)
  return r.rule.style.getPropertyValue(prop).trim()
}
const px = (v: string) => {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v)
  if (!m) throw new Error(`not px: ${v}`)
  return Number(m[1])
}

describe('scope and prefixes', () => {
  it('every rule of both files sits under .hub', () => {
    expect(mes.length).toBeGreaterThan(60)
    for (const { rule } of [...mes, ...posso]) for (const s of rule.selectorText.split(',')) expect(s.trim()).toMatch(/^\.hub[\s.[]/)
  })

  it('hub-diario-mes.css: only lane L1’s prefixes (hub-dr-cal-, hub-dr-sem-, hub-dr-topo-, hub-dr-rod-, hub-seletor__)', () => {
    for (const { rule } of mes) {
      for (const s of rule.selectorText.split(',')) {
        const primeira = /\.(hub-[A-Za-z0-9_-]+)/.exec(s.trim().replace(/^\.hub(\[[^\]]*\])?/, ''))?.[1]
        expect(primeira).toMatch(/^(hub-dr-(cal|sem|topo|rod)(-|$)|hub-seletor__)/)
      }
    }
  })

  it('hub-posso.css: only the card’s and the selector’s classes', () => {
    for (const { rule } of posso) {
      for (const s of rule.selectorText.split(',')) {
        const primeira = /\.(hub-[A-Za-z0-9_-]+)/.exec(s.trim().replace(/^\.hub(\[[^\]]*\])?/, ''))?.[1]
        expect(primeira).toMatch(/^(hub-posso(__|$)|hub-seletor__)/)
      }
    }
  })

  it('is imported by the hub’s layout after hub-diario.css and before lane L2’s', () => {
    const layout = fs.readFileSync(path.join(raiz, 'app/(hub)/layout.tsx'), 'utf8')
    const a = layout.indexOf("import '@/styles/hub-diario.css'")
    const b = layout.indexOf("import '@/styles/hub-diario-mes.css'")
    const c = layout.indexOf("import '@/styles/hub-diario-dia.css'")
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })
})

describe('44 px targets (contract §5.9)', () => {
  it('the section links, the footer’s link, the calendar’s cells (72 / 58 px) and the «Semana» row on phones', () => {
    expect(px(decl(mes, '.hub .hub-dr-topo-secoes a', 'min-height'))).toBe(44)
    expect(px(decl(mes, '.hub .hub-dr-topo-secoes a', 'min-width'))).toBe(44)
    expect(px(decl(mes, '.hub .hub-dr-rod-link', 'min-height'))).toBe(44)
    expect(px(decl(mes, '.hub .hub-dr-cal-cel', 'min-height'))).toBe(72)
    expect(px(decl(mes, '.hub .hub-dr-cal-cel', 'min-height', '(max-width: 700px)'))).toBe(58)
    expect(px(decl(mes, '.hub .hub-dr-cal-sem', 'min-height', '(max-width: 700px)'))).toBe(44)
    expect(decl(mes, '.hub .hub-dr-cal-sem', 'grid-column', '(max-width: 700px)')).toBe('1 / -1')
  })

  it('the buttons the lane uses are hub.css’s 44 px ones (‹ › × «Hoje» «Ver todas» «Ver no calendário» «Tentar de novo»), the options and the search too', () => {
    expect(px(decl(hub, '.hub .hub-btn', 'min-height'))).toBe(44)
    expect(px(decl(hub, '.hub .hub-btn--icone', 'width'))).toBe(44)
    expect(px(decl(hub, '.hub .hub-seletor__op', 'min-height'))).toBe(44)
    expect(px(decl(hub, '.hub .hub-entrada', 'min-height'))).toBe(44)
  })

  it('the ⓘ: 26 px with a 44 px hit area (hub.css)', () => {
    expect(px(decl(hub, '.hub .hub-info', 'width'))).toBe(26)
    expect(decl(hub, '.hub .hub-info::after', 'inset')).toBe('-9px')
  })
})

describe('the calendar’s layout', () => {
  it('desktop: 5 or 7 columns and «Semana» 1.15 fr; ≤ 700 px no «Semana» column, the week a row under its days', () => {
    expect(decl(mes, '.hub .hub-dr-cal-grade', 'grid-template-columns')).toBe('repeat(5, minmax(0, 1fr)) minmax(0, 1.15fr)')
    expect(decl(mes, '.hub .hub-dr-cal-grade--sete', 'grid-template-columns')).toBe('repeat(7, minmax(0, 1fr)) minmax(0, 1.15fr)')
    expect(decl(mes, '.hub .hub-dr-cal-grade--sete', 'grid-template-columns', '(max-width: 700px)')).toBe('repeat(7, minmax(0, 1fr))')
    expect(decl(mes, '.hub .hub-dr-cal-col--sem', 'display', '(max-width: 700px)')).toBe('none')
    expect(decl(mes, '.hub .hub-dr-cal-res--longo', 'display', '(max-width: 700px)')).toBe('none')
    expect(decl(mes, '.hub .hub-dr-cal-res--curto', 'display', '(max-width: 700px)')).toBe('inline')
    expect(decl(mes, '.hub .hub-dr-cal-dica', 'display', '(max-width: 700px)')).toBe('none')
    expect(decl(mes, '.hub .hub-dr-cal-dica', 'display', '(hover: none)')).toBe('none')
  })

  it('the board’s type: a day that opens keeps the font’s own line height (as the board’s buttons); the H1 40 px on phones too', () => {
    expect(decl(mes, '.hub button.hub-dr-cal-cel', 'line-height')).toBe('normal')
    expect(decl(mes, '.hub .hub-dr-topo-cab h1', 'font-size')).toBe('40px')
    // hub.css makes a page's H1 34 px at ≤ 640 px with a less specific rule
    expect(decl(hub, '.hub-pg-topo h1', 'font-size', '(max-width: 640px)')).toBe('34px')
  })

  it('375 px with 7 columns: every column at least 44 px wide (§5.8, from the rules)', () => {
    const largura = 375
    const gutter = px(decl(hub, '.hub-container', 'padding', '(max-width: 640px)').split(' ')[1])
    const cartao = px(decl(diario, '.hub .hub-dr-cartao', 'padding', '(max-width: 540px)').split(' ')[1])
    const margem = px(decl(mes, '.hub .hub-dr-cal-grade--sete', 'margin', '(max-width: 540px)').split(' ')[1])
    const padding = px(decl(mes, '.hub .hub-dr-cal-grade', 'padding'))
    const gap = px(decl(mes, '.hub .hub-dr-cal-grade--sete', 'gap', '(max-width: 540px)'))
    expect([gutter, cartao, margem, padding, gap]).toEqual([16, 16, -14, 2, 3])
    const grade = largura - 2 * gutter - 2 * cartao - 2 * margem - 2 * padding
    const coluna = (grade - 6 * gap) / 7
    expect(coluna).toBeCloseTo(45.29, 1)
    expect(coluna).toBeGreaterThanOrEqual(44)
  })

  it('the selector’s popover never wider than the screen; the blocks scroll inside 372 px without cutting a focus ring', () => {
    expect(decl(mes, '.hub .hub-seletor__lista', 'max-width')).toBe('calc(100vw - 32px)')
    expect(decl(mes, '.hub .hub-seletor__lista', 'width')).toBe('300px')
    expect(decl(mes, '.hub .hub-seletor__rolagem', 'max-height')).toBe('372px')
    expect(decl(mes, '.hub .hub-seletor__rolagem', 'overflow-y')).toBe('auto')
    expect(decl(mes, '.hub .hub-seletor__rolagem', 'scroll-padding-block')).toBe('8px')
    expect(decl(mes, ".hub[data-tema='escuro'] .hub-seletor__rolagem", '--fim')).toBe('rgba(255, 255, 255, 0.12)')
  })

  it('the list’s viewport is the board’s 380 px (content-box: 372 px inside its 4 px padding), so the 7th account is cut in half', () => {
    // Under the app's preflight every box is border-box: without this the viewport is 372 px in all (review: a sliver)
    expect(decl(mes, '.hub .hub-seletor__rolagem', 'box-sizing')).toBe('content-box')
    const [vertical] = decl(mes, '.hub .hub-seletor__rolagem', 'padding').split(' ')
    expect(px(decl(mes, '.hub .hub-seletor__rolagem', 'max-height')) + 2 * px(vertical)).toBe(380)
  })
})

describe('the states’ card (C6, C6b, C7)', () => {
  it('240 px inside the card’s padding and border, as the board’s content-box `.cartao` (286 px desktop, 278 px phones)', () => {
    expect(decl(mes, '.hub .hub-dr-topo-estado', 'box-sizing')).toBe('content-box')
    expect(decl(mes, '.hub .hub-dr-topo-estado', 'min-height')).toBe('240px')
    const total = (padding: string) => 240 + 2 * px(padding.split(' ')[0]) + 2
    expect(total(decl(diario, '.hub .hub-dr-cartao', 'padding'))).toBe(286)
    expect(total(decl(diario, '.hub .hub-dr-cartao', 'padding', '(max-width: 540px)'))).toBe(278)
  })
})

describe('motion', () => {
  it('the cells’ entrance and hover scale: none under prefers-reduced-motion', () => {
    const m = '(prefers-reduced-motion: reduce)'
    expect(decl(mes, '.hub .hub-dr-cal-cel', 'animation')).toMatch(/^hub-dr-cal-entra 0\.42s/)
    expect(decl(mes, '.hub .hub-dr-cal-cel', 'animation', m)).toBe('none')
    expect(decl(mes, '.hub .hub-dr-cal-cel', 'transition', m)).toBe('none')
    expect(decl(mes, '.hub button.hub-dr-cal-cel:hover', 'transform', m)).toBe('none')
    expect(decl(mes, '.hub .hub-dr-cal-dica', 'transition', m)).toBe('none')
  })
})

// ------------------------------------------------------------------------------------------------
// Contrast (4.5:1 for text, 3:1 for the marks' glyphs), from hub.css's tokens in both themes
// ------------------------------------------------------------------------------------------------

type Rgba = [number, number, number, number]
const hubCss = lerCss('hub.css')

function tokens(tema: 'claro' | 'escuro'): Record<string, string> {
  const m = new RegExp(`\\.hub\\[data-tema='${tema}'\\] \\{([^}]*)\\}`).exec(hubCss)
  if (!m) throw new Error(tema)
  const out: Record<string, string> = {}
  for (const d of m[1].split(';')) {
    const kv = /^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/.exec(d.replace(/\/\*[^*]*\*\//g, ''))
    if (kv) out[kv[1]] = kv[2]
  }
  return out
}

function cor(texto: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(texto)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(texto)
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), rgba[4] === undefined ? 1 : Number(rgba[4])]
  throw new Error(`cor ${texto}`)
}
const sobre = (top: Rgba, bottom: Rgba): Rgba => {
  const a = top[3]
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1]
}
const lum = (c: Rgba) => {
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])
}
const razao = (a: Rgba, b: Rgba) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** A colour of this lane's stylesheet (a token, or a literal of the rule) in a theme */
function resolver(valor: string, tk: Record<string, string>): string {
  const v = /^var\((--[a-z0-9-]+)\)$/.exec(valor)
  return v ? tk[v[1]] : valor
}
/** The background of a cell class, in a theme (the escuro override where there is one) */
function fundoDaCelula(classe: string, tema: 'claro' | 'escuro'): string {
  if (tema === 'escuro') {
    const e = mes.find((r) => !r.media && r.rule.selectorText === `.hub[data-tema='escuro'] .${classe}`)
    if (e) return e.rule.style.getPropertyValue('background-color').trim()
  }
  return decl(mes, `.hub .${classe}`, 'background-color')
}
/** The text colour of a cell class: its own, else the cell's (--text) */
function corDaCelula(classe: string): string {
  const propria = mes.find((r) => !r.media && r.rule.selectorText === `.hub .${classe}`)?.rule.style.getPropertyValue('color').trim()
  return propria || decl(mes, '.hub .hub-dr-cal-cel', 'color')
}

describe.each(['claro', 'escuro'] as const)('contrast in %s', (tema) => {
  const tk = tokens(tema)
  const bg = cor(tk['--bg'])
  const card = sobre(cor(tk['--surface']), bg)
  const inset = sobre(cor(tk['--inset']), card)

  it.each(['g1', 'g2', 'g3', 'g4', 'p1', 'p2', 'p3', 'p4'])('a day of level %s: its number and result against its fill (≥ 4.5)', (nivel) => {
    const classe = `hub-dr-cal-cel--${nivel}`
    const fundo = sobre(cor(fundoDaCelula(classe, tema)), card)
    const texto = cor(resolver(corDaCelula(classe), tk))
    expect(razao(texto, fundo)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['g1', 'g2', 'g3', 'g4', 'p1', 'p2', 'p3', 'p4'])('a history day of level %s: the hatch’s stripes keep its text ≥ 4.5', (nivel) => {
    const classe = `hub-dr-cal-cel--${nivel}`
    const listra = Number(nivel.slice(1)) >= 3 ? 'hub-dr-cal-cel--hist-forte' : 'hub-dr-cal-cel--hist'
    const gradiente = decl(mes, `.hub .${listra}`, 'background-image')
    const tinta = cor(/(rgba\([^)]*\)) 6px 9px/.exec(gradiente)![1])
    const fundo = sobre(cor(fundoDaCelula(classe, tema)), card)
    const texto = cor(resolver(corDaCelula(classe), tk))
    expect(razao(texto, fundo)).toBeGreaterThanOrEqual(4.5)
    expect(razao(texto, sobre(tinta, fundo))).toBeGreaterThanOrEqual(4.5)
  })

  it('a day without colour (inset), the «Semana» cell (no fill) and the muted «sem op.»: text and text-2', () => {
    expect(razao(cor(tk['--text']), inset)).toBeGreaterThanOrEqual(4.5)
    expect(razao(sobre(cor(tk['--text-2']), inset), inset)).toBeGreaterThanOrEqual(4.5)
    expect(razao(sobre(cor(tk['--text-2']), card), card)).toBeGreaterThanOrEqual(4.5)
  })

  it('the marks ● ■ ✓ on their chip (the page’s colour): ≥ 3, non-text', () => {
    for (const t of ['--amber', '--red', '--mint']) expect(razao(cor(tk[t]), bg)).toBeGreaterThanOrEqual(3)
  })

  it('the hover’s tip (text on --bg), the week’s tiles (mint, red, amber, text on inset), the list and the footer', () => {
    expect(razao(cor(tk['--text']), bg)).toBeGreaterThanOrEqual(4.5)
    for (const t of ['--mint', '--red', '--amber', '--text']) expect(razao(cor(tk[t]), inset)).toBeGreaterThanOrEqual(4.5)
    expect(razao(sobre(cor(tk['--text-2']), bg), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('the amber banners: their text on --amber-bg, the amber buttons’ dark text, the section links (mint on --bg)', () => {
    const faixa = sobre(cor(tk['--amber-bg']), bg)
    expect(razao(cor(tk['--text']), faixa)).toBeGreaterThanOrEqual(4.5)
    expect(razao(sobre(cor(tk['--text-2']), faixa), faixa)).toBeGreaterThanOrEqual(4.5)
    expect(razao(cor(tk['--amber']), faixa)).toBeGreaterThanOrEqual(4.5)
    expect(razao(cor(decl(mes, '.hub .hub-dr-topo-botao', 'color')), cor(tk['--amber']))).toBeGreaterThanOrEqual(4.5)
    expect(razao(cor(tk['--mint']), bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('the selector: the firm headers and «Nenhuma conta com …» (text-2 on --bg), the search’s placeholder on --surface', () => {
    expect(razao(sobre(cor(tk['--text-2']), bg), bg)).toBeGreaterThanOrEqual(4.5)
    const campo = sobre(cor(tk['--surface']), bg)
    expect(razao(sobre(cor(tk['--text-2']), campo), campo)).toBeGreaterThanOrEqual(4.5)
    // The current account: dark text on mint (hub.css)
    expect(razao(cor('#26301f'), cor(tk['--mint']))).toBeGreaterThanOrEqual(4.5)
  })
})
