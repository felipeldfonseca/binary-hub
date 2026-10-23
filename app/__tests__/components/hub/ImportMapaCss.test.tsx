/**
 * Phase 3b · telas, lane L1: hub-importar-mapa.css («mapa», «conferir», the model chip's row). jsdom does no layout, so
 * these check the rules themselves (the screenshots at 375 / 768 / 1280 show the result): every rule scoped to .hub, no
 * rule on a class another stylesheet defines unless it sits under one of this file's new classes (`.hub .hub-tag` would
 * grey every rule tag of Personalizar), the board's measures, one column per row at ≤ 480 px, the 44 px targets the steps
 * reuse, the stylesheet imported by the hub's layout, and the contrast (4.5:1) of every text colour the steps put on
 * screen, from hub.css's tokens in both themes, over the sheet (claro --bg, escuro #1e2123).
 */
import fs from 'fs'
import path from 'path'

const raiz = path.join(__dirname, '../../..')
const lerCss = (nome: string) => fs.readFileSync(path.join(raiz, 'styles', nome), 'utf8')
const css = lerCss('hub-importar-mapa.css')

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

const todas = rules(css)
const regra = (selector: string, lista = todas, media = '') => {
  const found = lista.find((r) => r.media === media && r.rule.selectorText.split(',').map((s) => s.trim()).includes(selector))
  if (!found) throw new Error(`no rule ${selector}`)
  return found.rule.style
}

/** Every class the other stylesheets of app/styles define */
const deOutros = new Set<string>()
for (const nome of fs.readdirSync(path.join(raiz, 'styles'))) {
  if (!nome.endsWith('.css') || nome === 'hub-importar-mapa.css') continue
  for (const m of Array.from(lerCss(nome).matchAll(/\.(hub-[A-Za-z0-9_-]+)/g))) deOutros.add(m[1])
}

describe('hub-importar-mapa.css', () => {
  it('scopes every rule to .hub', () => {
    expect(todas.length).toBeGreaterThan(15)
    for (const { rule } of todas) {
      for (const s of rule.selectorText.split(',')) expect(s.trim()).toMatch(/^\.hub[\s.[]/)
    }
  })

  it('defines no .hub-tag rule and no rule on another stylesheet’s class, unless under one of its own new classes', () => {
    expect(todas.some(({ rule }) => /\.hub-tag\b/.test(rule.selectorText))).toBe(false)
    for (const { rule } of todas) {
      for (const s of rule.selectorText.split(',')) {
        const classes = Array.from(s.trim().matchAll(/\.(hub-[A-Za-z0-9_-]+)/g)).map((m) => m[1])
        // The first hub-* class of the selector is this file's own: anything after it is scoped under it
        expect(classes.length).toBeGreaterThan(0)
        expect(deOutros.has(classes[0])).toBe(false)
      }
    }
    // The classes it reuses from hub.css are only ever scoped under its own
    expect(['hub-chip-dado', 'hub-pill', 'hub-sel'].every((c) => deOutros.has(c))).toBe(true)
  })

  it('is imported by the hub’s layout, after hub-importar.css', () => {
    const layout = fs.readFileSync(path.join(raiz, 'app/(hub)/layout.tsx'), 'utf8')
    const a = layout.indexOf("import '@/styles/hub-importar.css'")
    const b = layout.indexOf("import '@/styles/hub-importar-mapa.css'")
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })

  it('the board’s measures: the reading row, «Mudar»’s panel, the chips, the rows, the check, the questions, the lists', () => {
    const ler = regra('.hub .hub-ler')
    expect([ler.getPropertyValue('display'), ler.getPropertyValue('flex-wrap'), ler.getPropertyValue('gap')]).toEqual(['flex', 'wrap', '6px'])
    const painel = regra('.hub .hub-ler-painel')
    expect([painel.getPropertyValue('border'), painel.getPropertyValue('border-radius'), painel.getPropertyValue('padding'), painel.getPropertyValue('gap')]).toEqual([
      '1px dashed var(--neutral-border)',
      '14px',
      '12px 14px 14px',
      '12px',
    ])
    const req = regra('.hub .hub-req')
    expect([req.getPropertyValue('border'), req.getPropertyValue('color'), req.getPropertyValue('font-size'), req.getPropertyValue('font-weight')]).toEqual([
      '1px dashed var(--text-2)',
      'var(--text-2)',
      '12px',
      '700',
    ])
    const ok = regra('.hub .hub-req--ok')
    expect([ok.getPropertyValue('border'), ok.getPropertyValue('color')]).toEqual(['1px solid var(--mint-border)', 'var(--mint)'])
    const linha = regra('.hub .hub-col-linha')
    expect([linha.getPropertyValue('display'), linha.getPropertyValue('grid-template-columns'), linha.getPropertyValue('gap'), linha.getPropertyValue('padding'), linha.getPropertyValue('border-top')]).toEqual([
      'grid',
      'minmax(0, 1fr) minmax(0, 1.6fr)',
      '4px 12px',
      '8px 0',
      '1px solid var(--border)',
    ])
    // The name and the tag's word as the approved renders draw them (the board's `.col-nome span` reaches both): mono 12 px
    // bold grey, and a 12 px word inside hub.css's neutral tag (never a .hub-tag rule here)
    const tit = regra('.hub .hub-col-tit b')
    expect([tit.getPropertyValue('font-family'), tit.getPropertyValue('font-size'), tit.getPropertyValue('font-weight'), tit.getPropertyValue('color')]).toEqual([
      'var(--mono)',
      '12px',
      '700',
      'var(--text-2)',
    ])
    const tag = regra('.hub .hub-col-tag')
    expect([tag.getPropertyValue('font-size'), tag.getPropertyValue('margin')]).toEqual(['12px', '-1px'])
    expect(regra('.hub .hub-col-tit').getPropertyValue('overflow-wrap')).toBe('anywhere')
    expect(regra('.hub .hub-col-ex').getPropertyValue('overflow-wrap')).toBe('anywhere')
    const chk = regra('.hub .hub-chk')
    expect([chk.getPropertyValue('color'), chk.getPropertyValue('font-size'), chk.getPropertyValue('font-weight')]).toEqual(['var(--amber)', '12px', '700'])
    const pill = regra('.hub .hub-pergunta .hub-pill')
    expect([pill.getPropertyValue('padding'), pill.getPropertyValue('line-height'), pill.getPropertyValue('text-align')]).toEqual(['8px 14px', '1.35', 'left'])
    const prev = regra('.hub .hub-prev-linha')
    expect([prev.getPropertyValue('background'), prev.getPropertyValue('border-radius'), prev.getPropertyValue('font-family'), prev.getPropertyValue('font-size'), prev.getPropertyValue('flex-wrap')]).toEqual([
      'var(--inset)',
      '12px',
      'var(--mono)',
      '12px',
      'wrap',
    ])
    expect(regra('.hub .hub-prev-lista').getPropertyValue('list-style')).toBe('none')
    const ops = regra('.hub .hub-ops-lista')
    expect([ops.getPropertyValue('padding-left'), ops.getPropertyValue('font-size'), ops.getPropertyValue('list-style')]).toEqual(['18px', '13px', 'disc'])
  })

  it('a phone: one column per row at ≤ 480 px; the selects take the row’s width', () => {
    expect(regra('.hub .hub-col-linha', todas, '(max-width: 480px)').getPropertyValue('grid-template-columns')).toBe('minmax(0, 1fr)')
    const sel = regra('.hub .hub-col-sel .hub-sel')
    expect([sel.getPropertyValue('width'), sel.getPropertyValue('min-width')]).toEqual(['100%', '0'])
    expect(regra('.hub .hub-col-nome').getPropertyValue('min-width')).toBe('0')
  })

  it('44 px targets: the separator pills; the pills, «Mudar», «Mudar colunas», «Ver …», the selects, the checkbox row and the name field from hub.css', () => {
    const sep = regra('.hub .hub-ler-painel .hub-pill')
    expect([sep.getPropertyValue('min-width'), sep.getPropertyValue('text-align')]).toEqual(['44px', 'center'])
    const hub = rules(lerCss('hub.css'))
    for (const s of ['.hub .hub-pill', '.hub .hub-btn', '.hub .hub-sel', '.hub-check', '.hub .hub-entrada', '.hub .hub-abre']) {
      expect(regra(s, hub).getPropertyValue('min-height')).toBe('44px')
    }
  })
})

// ------------------------------------------------------------------------------------------------
// Contrast (WCAG 2.x) of the text colours the steps show, from hub.css's tokens
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
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(texto)
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])]
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

/** [what, text token, the layers under it from the top, the sheet's own background last] */
const PARES: [string, string, string[]][] = [
  ['«Obrigatórias» missing, a column’s name, the samples «ex.: …», the tags, the notes', '--text-2', ['folha']],
  ['«Obrigatórias» marked', '--mint', ['folha']],
  ['the check under a select', '--amber', ['folha']],
  ['the order line’s items', '--text', ['folha']],
  ['«Confira 3 linhas»’s rows', '--text', ['--inset', 'folha']],
  ['the reading chips and the model chip', '--text', ['--inset', 'folha']],
  ['a question, the pairing summary, the model block', '--text', ['--surface', 'folha']],
  ['a question’s nota, the entries note', '--text-2', ['--surface', 'folha']],
  ['a select’s value', '--text', ['--surface', 'folha']],
]

describe.each(['claro', 'escuro'] as const)('contrast in %s', (tema) => {
  const tk = tokens(tema)
  const folha = tema === 'escuro' ? cor('#1e2123') : cor(tk['--bg'])
  it.each(PARES)('%s', (_nome, texto, camadas) => {
    let fundo: Rgba = folha
    for (const c of camadas.slice(0, -1).reverse()) fundo = sobre(cor(tk[c]), fundo)
    const frente = sobre(cor(tk[texto]), fundo)
    expect(razao(frente, fundo)).toBeGreaterThanOrEqual(4.5)
  })
})
