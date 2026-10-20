/**
 * hub-registrar.css (PR 3-3, lane A): what the phone layout relies on (D13, contract §4.9). jsdom
 * does no layout, so these check the rules themselves (the screenshots at 320–1280 px show the
 * result): the footer sticks to the bottom with the safe area, fields are 16 px on phones (iOS zooms
 * below that), «Stop/Alvo» and «Stake/Payout» keep two columns, the setup pills are 60 × 52, every
 * rule is scoped to .hub.
 */
import fs from 'fs'
import path from 'path'

const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub-registrar.css'), 'utf8')

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
const regra = (selector: string, media = '') => {
  const found = todas.find((r) => r.media === media && r.rule.selectorText.split(',').map((s) => s.trim()).includes(selector))
  if (!found) throw new Error(`no rule ${selector} @ ${media}`)
  return found.rule.style
}

describe('hub-registrar.css', () => {
  it('scopes every rule to .hub', () => {
    for (const { rule } of todas) {
      for (const s of rule.selectorText.split(',')) expect(s.trim()).toMatch(/^\.hub[\s.[]/)
    }
  })

  it('keeps the footer at the bottom on phones, above the safe area, on the sheet’s own background', () => {
    const r = regra('.hub .hub-reg .hub-reg-rodape', '(max-width: 640px)')
    expect(r.getPropertyValue('position')).toBe('sticky')
    expect(r.getPropertyValue('bottom')).toMatch(/^0(px)?$/)
    expect(r.getPropertyValue('padding')).toContain('env(safe-area-inset-bottom)')
    expect(r.getPropertyValue('background')).toBe('var(--bg)')
    expect(regra(".hub[data-tema='escuro'] .hub-reg .hub-reg-rodape", '(max-width: 640px)').getPropertyValue('background')).toBe('#1e2123')
  })

  it('writes fields and the note at 16 px on phones', () => {
    expect(regra('.hub .hub-reg .hub-entrada', '(max-width: 640px)').getPropertyValue('font-size')).toBe('16px')
    expect(regra('.hub .hub-reg .hub-reg-area', '(max-width: 640px)').getPropertyValue('font-size')).toBe('16px')
  })

  it('keeps «Stop/Alvo» and «Stake/Payout» in two columns on narrow phones', () => {
    expect(regra('.hub .hub-reg-sempre', '(max-width: 420px)').getPropertyValue('grid-template-columns')).toBe('repeat(2, minmax(0, 1fr))')
  })

  it('draws the setup pills 60 × 52 at 18 px and every pill at least 44 px wide', () => {
    const abc = regra('.hub .hub-reg-abc .hub-pill')
    expect(abc.getPropertyValue('min-width')).toBe('60px')
    expect(abc.getPropertyValue('min-height')).toBe('52px')
    expect(abc.getPropertyValue('font-size')).toBe('18px')
    expect(regra('.hub .hub-reg .hub-pill').getPropertyValue('min-width')).toBe('44px')
    expect(regra('.hub .hub-reg-pill-q').getPropertyValue('min-width')).toBe('52px')
    expect(regra('.hub .hub-reg-link').getPropertyValue('min-height')).toBe('44px')
    expect(regra('.hub .hub-reg-chip-botao').getPropertyValue('min-height')).toBe('44px')
  })

  it('shows a disabled pill dashed (still focusable), and the errors in the board’s red', () => {
    expect(regra(".hub .hub-reg .hub-pill[aria-disabled='true']").getPropertyValue('border-style')).toBe('dashed')
    expect(regra('.hub .hub-reg-erro').getPropertyValue('color')).toBe('var(--red)')
  })

  it('turns the disclosure’s chevron without motion when asked', () => {
    expect(regra('.hub .hub-reg .hub-seta', '(prefers-reduced-motion: reduce)').getPropertyValue('transition')).toBe('none')
  })
})
