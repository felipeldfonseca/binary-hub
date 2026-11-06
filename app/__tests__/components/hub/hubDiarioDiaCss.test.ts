/**
 * Fase 4 · telas, lane L2: styles/hub-diario-dia.css. jsdom does no layout, so these check the rules themselves (the
 * screenshots at 375 / 768 / 1280 show the result): every rule scoped to .hub with lane L2's prefixes only, the 44 px
 * targets, the row's grid from 980 px down with the ▾ in the bottom-right cell (owner choice 3) and the DOM order kept,
 * the drill's columns, the row's second line (12 px regular `--text-2`, the assertion moved from RegistrarParciaisCss),
 * and the contrast of every new pair (contract §6.10) in both themes. hub-operacoes-dia.css keeps no bridge rule.
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

const todas = rules(lerCss('hub-diario-dia.css'))
const regra = (selector: string, media = '') => {
  const found = todas.find((r) => r.media === media && r.rule.selectorText.split(',').map((s) => s.trim()).includes(selector))
  if (!found) throw new Error(`no rule ${selector} ${media}`)
  return found.rule.style
}
const valor = (selector: string, prop: string, media = '') => regra(selector, media).getPropertyValue(prop).trim()

describe('hub-diario-dia.css', () => {
  it('scopes every rule to .hub and uses only lane L2’s prefixes', () => {
    expect(todas.length).toBeGreaterThan(40)
    for (const { rule } of todas) {
      for (const s of rule.selectorText.split(',')) {
        expect(s.trim()).toMatch(/^\.hub /)
        const classes = s.match(/\.hub-[a-z0-9-]+/g)?.filter((c) => c !== '.hub') ?? []
        expect(classes.length).toBeGreaterThan(0)
        for (const c of classes) expect(c).toMatch(/^\.hub-dr-(dia|plano|op|drill|img|rev)-/)
      }
    }
  })

  it('is imported by the hub’s layout after the shared and the month sheets', () => {
    const layout = fs.readFileSync(path.join(raiz, 'app/(hub)/layout.tsx'), 'utf8')
    const a = layout.indexOf("import '@/styles/hub-diario.css'")
    const b = layout.indexOf("import '@/styles/hub-diario-dia.css'")
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })

  it('44 px targets: the plan’s link, «Abrir 30 nov» and «Adicionar imagens ou nota», the mark pills, the fields', () => {
    expect(valor('.hub .hub-dr-plano-link', 'min-height')).toBe('44px')
    expect(valor('.hub .hub-dr-op-link', 'min-height')).toBe('44px')
    expect(valor('.hub .hub-dr-img-add', 'min-height')).toBe('44px')
    expect(valor('.hub .hub-dr-drill-pill', 'min-width')).toBe('44px')
    expect(valor('.hub .hub-dr-plano-input', 'min-height')).toBe('44px')
    expect(valor('.hub .hub-dr-rev-input', 'min-height')).toBe('44px')
    // ▾ is the built 44 × 44 icon button, the review's toggles and the pills the built 44 px ones (hub.css)
    const hub = rules(lerCss('hub.css'))
    const h = (sel: string, prop: string) => hub.find((r) => r.rule.selectorText.split(',').map((s) => s.trim()).includes(sel))!.rule.style.getPropertyValue(prop).trim()
    expect(h('.hub .hub-btn', 'min-height')).toBe('44px')
    expect(h('.hub .hub-btn--icone', 'width')).toBe('44px')
    expect(h('.hub .hub-pill', 'min-height')).toBe('44px')
  })

  it('the row: five columns on a computer; from 980 px the header row is only read and the ▾ takes the bottom-right cell (DOM order kept)', () => {
    expect(valor('.hub .hub-dr-op-linha', 'grid-template-columns')).toBe('104px minmax(170px, 1.5fr) 128px minmax(170px, 1.2fr) 44px')
    const m = '(max-width: 980px)'
    expect(valor('.hub .hub-dr-op-cab', 'position', m)).toBe('absolute')
    expect(valor('.hub .hub-dr-op-cab', 'clip', m)).toBe('rect(0 0 0 0)')
    expect(valor('.hub .hub-dr-op-linha', 'grid-template-columns', m)).toBe('minmax(0, 1fr) auto 44px')
    expect([valor('.hub .hub-dr-op-linha > :nth-child(1)', 'grid-row', m), valor('.hub .hub-dr-op-linha > :nth-child(2)', 'grid-row', m)]).toEqual(['1', '2'])
    expect(valor('.hub .hub-dr-op-linha > :nth-child(3)', 'grid-row', m)).toBe('1 / 3')
    expect(valor('.hub .hub-dr-op-linha > :nth-child(3)', 'text-align', m)).toBe('right')
    expect(valor('.hub .hub-dr-op-linha > :nth-child(4)', 'grid-column', m)).toBe('1 / 3')
    expect(valor('.hub .hub-dr-op-linha > :nth-child(4)', 'grid-row', m)).toBe('3')
    expect(valor('.hub .hub-dr-op-linha > :nth-child(5)', 'grid-column', m)).toBe('3')
    expect(valor('.hub .hub-dr-op-linha > :nth-child(5)', 'grid-row', m)).toBe('1 / 4')
    expect(valor('.hub .hub-dr-op-linha > :nth-child(5)', 'align-self', m)).toBe('end')
  })

  it('the drill: two columns, one from 980 px; margins 6 px and padding 12 px at 540 px; the timeline stacks at 540 px', () => {
    expect(valor('.hub .hub-dr-drill-corpo', 'grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))')
    expect(valor('.hub .hub-dr-drill-corpo', 'grid-template-columns', '(max-width: 980px)')).toBe('minmax(0, 1fr)')
    expect(valor('.hub .hub-dr-drill-corpo', 'margin', '(max-width: 540px)')).toBe('0 6px 8px')
    expect(valor('.hub .hub-dr-drill-corpo', 'padding', '(max-width: 540px)')).toBe('12px')
    expect(valor('.hub .hub-dr-drill-tempo li', 'grid-template-columns')).toBe('72px minmax(0, 1fr)')
    expect(valor('.hub .hub-dr-drill-tempo li', 'grid-template-columns', '(max-width: 540px)')).toBe('minmax(0, 1fr)')
    expect(valor('.hub .hub-dr-plano-linha', 'grid-template-columns')).toBe('150px minmax(0, 1fr) auto')
    expect(valor('.hub .hub-dr-plano-linha > .hub-dr-plano-meio', 'grid-row', '(max-width: 980px)')).toBe('2')
    expect(valor('.hub .hub-dr-img-mini', 'width')).toBe('168px')
    expect(valor('.hub .hub-dr-img-previa', 'height')).toBe('104px')
  })

  it('the row’s second line (moved from RegistrarParciaisCss): a block of 12 px, regular weight, the secondary text colour', () => {
    expect(['display', 'font-size', 'font-weight', 'color'].map((p) => valor('.hub .hub-dr-op-sub', p))).toEqual(['block', '12px', '400', 'var(--text-2)'])
  })

  it('hub-operacoes-dia.css keeps no rule of the retired bridge', () => {
    const resto = rules(lerCss('hub-operacoes-dia.css'))
    expect(resto.length).toBeGreaterThan(0)
    for (const { rule } of resto) expect(rule.selectorText).not.toMatch(/hub-ops-dia/)
  })
})

// ------------------------------------------------------------------------------------------------
// Contrast (WCAG 2.x) of the new pairs, from hub.css's tokens (contract §6.10)
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

/** [what, text token, the layers under it from the top, the page's --bg last] */
const PARES: [string, string, string[]][] = [
  ['«● fora da janela» on a row', '--amber', ['--inset', '--surface', '--bg']],
  ['Hora, the second line, the plan’s cells on a row', '--text-2', ['--inset', '--surface', '--bg']],
  ['«No plano» on a row', '--mint', ['--inset', '--surface', '--bg']],
  ['a loss on a row', '--red', ['--inset', '--surface', '--bg']],
  ['a gain on a row', '--mint', ['--inset', '--surface', '--bg']],
  ['«Fora do plano» pill on the plan', '--amber', ['--amber-bg', '--inset', '--surface', '--bg']],
  ['«chega na Fase 5» and the muted lines on the card', '--text-2', ['--surface', '--bg']],
  ['the drill’s labels and lines', '--text-2', ['--surface', '--inset', '--surface', '--bg']],
  ['the review’s alert', '--amber', ['--inset', '--surface', '--bg']],
  ['the leave guard', '--text', ['--amber-bg', '--surface', '--inset', '--surface', '--bg']],
  ['the image dialog’s caption', '--text-2', ['--bg', '--surface', '--inset', '--surface', '--bg']],
]

describe.each(['claro', 'escuro'] as const)('contrast in %s', (tema) => {
  const t = tokens(tema)
  it.each(PARES)('%s ≥ 4.5', (_nome, texto, camadas) => {
    let fundo: Rgba = cor(t[camadas[camadas.length - 1]])
    for (const c of camadas.slice(0, -1).reverse()) fundo = sobre(cor(t[c]), fundo)
    const frente = sobre(cor(t[texto]), fundo)
    expect(razao(frente, fundo)).toBeGreaterThanOrEqual(4.5)
  })
})
