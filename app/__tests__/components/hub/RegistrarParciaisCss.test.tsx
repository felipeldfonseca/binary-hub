/**
 * Phase 3c · lane C1: hub-registrar-parciais.css and the bridge's second line in
 * hub-operacoes-dia.css. jsdom does no layout, so these check the rules themselves (the screenshots
 * at 375 / 768 / 1280 show the result): every rule scoped to .hub, the timeline's wrapping (time
 * 44 px, item `flex: 1 1 200px`), the sub-lines at 12 px regular weight, the touch targets the new
 * controls reuse (44 px), the stylesheet imported by the hub's layout, and the contrast of every
 * colour pair the new elements put on screen, from the token values of hub.css in both themes
 * (4.5:1 for text).
 */
import fs from 'fs'
import path from 'path'

const raiz = path.join(__dirname, '../../..')
const lerCss = (nome: string) => fs.readFileSync(path.join(raiz, 'styles', nome), 'utf8')
const css = lerCss('hub-registrar-parciais.css')

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

describe('hub-registrar-parciais.css', () => {
  it('scopes every rule to .hub and prefixes its classes hub-rp-', () => {
    expect(todas.length).toBeGreaterThan(5)
    for (const { rule } of todas) {
      for (const s of rule.selectorText.split(',')) {
        expect(s.trim()).toMatch(/^\.hub[\s.[]/)
        expect(s).toMatch(/\.hub-rp-/)
      }
    }
  })

  it('is imported by the hub’s layout, after the option block', () => {
    const layout = fs.readFileSync(path.join(raiz, 'app/(hub)/layout.tsx'), 'utf8')
    const a = layout.indexOf("import '@/styles/hub-registrar-opcao.css'")
    const b = layout.indexOf("import '@/styles/hub-registrar-parciais.css'")
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(a)
  })

  it('wraps the timeline: rows wrap, the time keeps 44 px, the item grows from 200 px, the sub-line is a block of 12 px regular', () => {
    const li = regra('.hub .hub-rp-tempo li')
    expect(li.getPropertyValue('display')).toBe('flex')
    expect(li.getPropertyValue('flex-wrap')).toBe('wrap')
    expect(li.getPropertyValue('min-width')).toBe('0')
    const time = regra('.hub .hub-rp-tempo time')
    expect(time.getPropertyValue('min-width')).toBe('44px')
    expect(time.getPropertyValue('flex')).toBe('none')
    expect(regra('.hub .hub-rp-tempo .hub-rp-sem-hora').getPropertyValue('min-width')).toBe('44px')
    const item = regra('.hub .hub-rp-item')
    expect(item.getPropertyValue('flex')).toBe('1 1 200px')
    expect(item.getPropertyValue('min-width')).toBe('0')
    const sub = regra('.hub .hub-rp-sub')
    expect([sub.getPropertyValue('display'), sub.getPropertyValue('font-size'), sub.getPropertyValue('font-weight'), sub.getPropertyValue('color')]).toEqual([
      'block',
      '12px',
      '400',
      'var(--text-2)',
    ])
    expect(regra('.hub .hub-rp-undo').getPropertyValue('flex-wrap')).toBe('wrap')
    expect(regra('.hub .hub-rp-qtd').getPropertyValue('flex-wrap')).toBe('wrap')
  })

  it('draws step 3’s breakeven line at 13 px in the text colour, close to the timeline (RO l.581)', () => {
    const be = regra('.hub .hub-rp-be')
    expect([be.getPropertyValue('font-size'), be.getPropertyValue('color'), be.getPropertyValue('margin')]).toEqual(['13px', 'var(--text)', '-6px 0 0'])
  })

  it('the new controls reuse the 44 px targets of the sheet (pills, links, buttons, chips)', () => {
    const reg = rules(lerCss('hub-registrar.css'))
    const hub = rules(lerCss('hub.css'))
    expect(regra('.hub .hub-reg-link', reg).getPropertyValue('min-height')).toBe('44px')
    expect(regra('.hub .hub-reg .hub-pill', reg).getPropertyValue('min-width')).toBe('44px')
    expect(regra('.hub .hub-reg .hub-reg-pill-q', reg).getPropertyValue('min-width')).toBe('52px')
    expect(regra('.hub .hub-pill', hub).getPropertyValue('min-height')).toBe('44px')
  })
})

describe('hub-operacoes-dia.css · the bridge’s second line', () => {
  it('is a block of 12 px, regular weight, the secondary text colour, scoped to .hub', () => {
    const r = regra('.hub .hub-ops-dia__sub', rules(lerCss('hub-operacoes-dia.css')))
    expect([r.getPropertyValue('display'), r.getPropertyValue('font-size'), r.getPropertyValue('font-weight'), r.getPropertyValue('color')]).toEqual([
      'block',
      '12px',
      '400',
      'var(--text-2)',
    ])
  })
})

// ------------------------------------------------------------------------------------------------
// Contrast (WCAG 2.x) of the pairs the new elements show, from hub.css's tokens
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

/** `top` over an opaque `bottom` */
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

/**
 * Every new pair: [what, text token, the layers under it from the top (the sheet's own background
 * last: --bg in claro, #1e2123 in escuro; the bridge sits on the page's --bg)]
 */
const PARES: [string, string, string[]][] = [
  ['timeline time, sub-line, «Até …», «Agora»’s labels', '--text-2', ['--surface', 'folha']],
  ['timeline item, the suggestion, «Agora»’s values', '--text', ['--surface', 'folha']],
  ['«Realizado» in gain', '--mint', ['--surface', 'folha']],
  ['«Realizado» in loss, «Desfazer»', '--red', ['--surface', 'folha']],
  ['the undo confirmation', '--text', ['--red-bg', '--surface', 'folha']],
  ['the action status, step 3’s breakeven line, «Sai com …»', '--text', ['folha']],
  ['notes on the sheet («Ficam …», «Em aberto: …»)', '--text-2', ['folha']],
  ['the limit warning of «Mover stop» and the 80 % banner', '--amber', ['--amber-bg', 'folha']],
  ['the limit reached banner', '--red', ['--red-bg', 'folha']],
  ['the bridge’s second line', '--text-2', ['--inset', '--bg']],
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
