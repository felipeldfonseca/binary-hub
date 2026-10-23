/**
 * Phase 3b · telas, lane L2: hub-importar.css (contract §6.12). jsdom does no layout, so these check the rules themselves
 * (the screenshots at 375 / 768 / 1280 show the result): every rule scoped to .hub; no rule on a class another stylesheet
 * defines unless scoped under one of this file's new classes (§5.9: `.hub .hub-tag {…}` would beat hub.css's modifiers);
 * the a2 groups, the hc rows (text 150 px, select 170 px, wrapping at 375), the B3's session band; the 44 px targets the
 * new steps reuse; the stylesheet imported by the hub's layout; and the contrast of the pairs the new steps put on screen,
 * from hub.css's tokens in both themes (4.5:1 for text).
 */
import fs from 'fs'
import path from 'path'

const raiz = path.join(__dirname, '../../..')
const lerCss = (nome: string) => fs.readFileSync(path.join(raiz, 'styles', nome), 'utf8')
const css = lerCss('hub-importar.css')

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
const regra = (selector: string, lista = todas) => {
  const found = lista.find((r) => r.rule.selectorText.split(',').map((s) => s.trim()).includes(selector))
  if (!found) throw new Error(`no rule ${selector}`)
  return found.rule.style
}
/** The classes a stylesheet's selectors name */
const classes = (text: string) => new Set(Array.from(text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/\.(hub-[a-z0-9_-]+)/g)).map((m) => m[1]))

describe('hub-importar.css', () => {
  it('scopes every rule to .hub', () => {
    expect(todas.length).toBeGreaterThan(4)
    for (const { rule } of todas) for (const s of rule.selectorText.split(',')) expect(s.trim()).toMatch(/^\.hub[\s.[]/)
  })

  it('never restyles a class another stylesheet defines, unless under one of its own new classes (§5.9)', () => {
    const outras = new Set<string>()
    for (const f of fs.readdirSync(path.join(raiz, 'styles'))) {
      if (f.endsWith('.css') && f !== 'hub-importar.css') classes(lerCss(f)).forEach((c) => outras.add(c))
    }
    const novas = Array.from(classes(css)).filter((c) => !outras.has(c))
    expect(novas.sort()).toEqual(['hub-conta-linha', 'hub-conta-linha__txt', 'hub-contas-arquivo', 'hub-faixa24__banda--b3', 'hub-grupo-a', 'hub-lista-linhas--pontos'])
    expect(css).not.toMatch(/\.hub-tag\b/)
    for (const { rule } of todas) {
      for (const s of rule.selectorText.split(',')) {
        // The last class of the selector is the one it styles: a new class, or an existing one under a new class
        const nomes = Array.from(s.matchAll(/\.(hub-[a-z0-9_-]+)/g)).map((m) => m[1])
        const alvo = nomes[nomes.length - 1]
        expect([s.trim(), novas.includes(alvo) || nomes.slice(0, -1).some((n) => novas.includes(n))]).toEqual([s.trim(), true])
      }
    }
  })

  it('is imported by the hub’s layout after hub-registrar-parciais.css, before L1’s hub-importar-mapa.css', () => {
    const layout = fs.readFileSync(path.join(raiz, 'app/(hub)/layout.tsx'), 'utf8')
    const a = layout.indexOf("import '@/styles/hub-registrar-parciais.css'")
    const b = layout.indexOf("import '@/styles/hub-importar.css'")
    const c = layout.indexOf("import '@/styles/hub-importar-mapa.css'")
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  it('a2: each group a column, its name over its pills (6 px)', () => {
    const g = regra('.hub .hub-grupo-a')
    expect([g.getPropertyValue('display'), g.getPropertyValue('flex-direction'), g.getPropertyValue('gap')]).toEqual(['flex', 'column', '6px'])
  })

  it('hc: rows wrap (text from 150 px, select from 170 px, one under the other below 330 px), the board’s padding and top border', () => {
    const linha = regra('.hub .hub-conta-linha')
    expect([linha.getPropertyValue('display'), linha.getPropertyValue('flex-wrap'), linha.getPropertyValue('gap'), linha.getPropertyValue('padding')]).toEqual([
      'flex',
      'wrap',
      '4px 10px',
      '6px 0',
    ])
    expect(linha.getPropertyValue('border-top')).toBe('1px solid var(--border)')
    const txt = regra('.hub .hub-conta-linha__txt')
    expect([txt.getPropertyValue('flex'), txt.getPropertyValue('min-width'), txt.getPropertyValue('font-size')]).toEqual(['1 1 150px', '0', '13px'])
    const sel = regra('.hub .hub-conta-linha .hub-sel')
    expect([sel.getPropertyValue('flex'), sel.getPropertyValue('min-width')]).toEqual(['1 1 170px', '0'])
  })

  it('c: the B3’s band, 09:00–18:30 of the 24 hours (board IC l.167), a modifier of hub.css’s band', () => {
    const b = regra('.hub .hub-faixa24__banda--b3')
    expect([b.getPropertyValue('left'), b.getPropertyValue('width')]).toEqual(['37.5%', '39.583%'])
    expect((9 * 60) / (24 * 60)).toBeCloseTo(0.375, 5)
    expect((18.5 * 60 - 9 * 60) / (24 * 60)).toBeCloseTo(0.39583, 4)
    // Wins over hub.css's .hub-faixa24__banda (0,1,0) by specificity (0,2,0)
    expect(regra('.hub-faixa24__banda', rules(lerCss('hub.css'))).getPropertyValue('left')).toBe('39.583%')
  })

  it('d: «Ver linhas» lists each line with a bullet, as the board', () => {
    expect(regra('.hub .hub-lista-linhas--pontos').getPropertyValue('list-style')).toBe('disc')
  })

  it('the new steps reuse the 44 px targets of the sheet (pills, selects, buttons, radios, the disclosure)', () => {
    const hub = rules(lerCss('hub.css'))
    expect(regra('.hub .hub-pill', hub).getPropertyValue('min-height')).toBe('44px')
    expect(regra('.hub .hub-sel', hub).getPropertyValue('min-height')).toBe('44px')
    expect(regra('.hub-opcao__rot', hub).getPropertyValue('min-height')).toBe('44px')
  })
})

// ------------------------------------------------------------------------------------------------
// Contrast (WCAG 2.x) of the pairs the new steps show, from hub.css's tokens
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

/** [what, text token, the layers under it from the top; the sheet's own background last: --bg in claro, #1e2123 in escuro] */
const PARES: [string, string, string[]][] = [
  ['a2’s group names (.hub-rotulo), the notes of a2, hc and the zone step', '--text-2', ['folha']],
  ['hc’s rows and the account pills', '--text', ['folha']],
  ['hc’s warning, the zone refusal and G1 (amber blocks: text on the block)', '--text', ['--surface', 'folha']],
  ['the zone captions (on the option)', '--text-2', ['--surface', 'folha']],
  ['the preview’s info lines and the leftovers block', '--text', ['--surface', 'folha']],
]

describe.each(['claro', 'escuro'] as const)('contrast in %s', (tema) => {
  const t = tokens(tema)
  const folha = tema === 'escuro' ? cor('#1e2123') : cor(t['--bg'])
  it.each(PARES)('%s', (_nome, texto, camadas) => {
    let fundo: Rgba = camadas[camadas.length - 1] === 'folha' ? folha : cor(t[camadas[camadas.length - 1]])
    for (const c of camadas.slice(0, -1).reverse()) fundo = sobre(cor(t[c]), fundo)
    const frente = sobre(cor(t[texto]), fundo)
    expect(razao(frente, fundo)).toBeGreaterThanOrEqual(4.5)
  })
})
