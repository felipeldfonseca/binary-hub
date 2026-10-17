/**
 * hub.css cascade checks. jsdom's getComputedStyle ignores selector specificity (the later rule
 * always wins), so these tests take the stylesheet's top-level rules and resolve the cascade
 * themselves: highest specificity first, then the later rule.
 */
import fs from 'fs'
import path from 'path'

const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub.css'), 'utf8')

type Specificity = [number, number, number]

/** [ids, classes + attributes + pseudo-classes, types] of one selector (no :is/:not/:where in these rules) */
function specificity(selector: string): Specificity {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0
  const classes = selector.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g)?.length ?? 0
  const rest = selector.replace(/#[\w-]+|\.[\w-]+|\[[^\]]*\]|::?[\w-]+(\([^)]*\))?/g, ' ')
  const types = rest.match(/[a-z][\w-]*/gi)?.length ?? 0
  return [ids, classes, types]
}

const compare = (a: Specificity, b: Specificity) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

function topLevelRules(): CSSStyleRule[] {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const rules = Array.from((style.sheet as CSSStyleSheet).cssRules).filter((r): r is CSSStyleRule => 'selectorText' in r)
  style.remove()
  return rules
}

/** A rule's value for a property, reading `margin: a b c d` for margin-top (jsdom keeps the shorthand) */
function declared(rule: CSSStyleRule, property: string): string {
  const own = rule.style.getPropertyValue(property)
  if (own || property !== 'margin-top') return own
  return rule.style.getPropertyValue('margin').trim().split(/\s+/)[0] ?? ''
}

/** The value of `property` the cascade gives `element`, from the hub.css rules outside media queries */
function cascaded(element: Element, property: string): string | null {
  let best: { spec: Specificity; value: string } | null = null
  for (const rule of topLevelRules()) {
    const value = declared(rule, property)
    if (!value) continue
    for (const selector of rule.selectorText.split(',').map((s) => s.trim())) {
      if (!element.matches(selector)) continue
      const spec = specificity(selector)
      // Same specificity: the later rule wins, and rules come in source order
      if (!best || compare(spec, best.spec) >= 0) best = { spec, value }
    }
  }
  return best?.value ?? null
}

beforeEach(() => {
  document.body.innerHTML = `
    <div class="hub">
      <section class="hub-card"><p class="hub-nota hub-card__sub" id="sub">Cada conta…</p></section>
      <section class="hub-folha"><p class="hub-nota hub-dica" id="dica">Escolha o mercado.</p></section>
    </div>`
})

describe('hub.css', () => {
  it('reads specificity the way browsers do', () => {
    expect(specificity('.hub .hub-nota')).toEqual([0, 2, 0])
    expect(specificity('.hub-card h2:focus')).toEqual([0, 2, 1])
    expect(specificity(".hub .hub-btn[aria-disabled='true']:focus-visible")).toEqual([0, 4, 0])
  })

  it('pulls the "Suas contas" note up under its heading, over the general note margin', () => {
    expect(cascaded(document.getElementById('sub') as HTMLElement, 'margin-top')).toBe('-8px')
  })

  it('pulls the disabled-button hint up under the sheet footer, over the general note margin', () => {
    const hint = document.getElementById('dica') as HTMLElement
    expect(cascaded(hint, 'margin-top')).toBe('-10px')
    expect(cascaded(hint, 'text-align')).toBe('right')
  })
})
