/**
 * Personalizar › Preferências: the 80 % switch's rules in styles/hub-operacoes-dia.css (moved from the retired
 * OperacoesDoDia.test in Phase 4, telas lane L2): scoped to .hub, the 2b board's 56 × 44 hit area, no motion when asked.
 */
import fs from 'fs'
import path from 'path'

const css = fs.readFileSync(path.join(__dirname, '../../../styles/hub-operacoes-dia.css'), 'utf8')

function rules(): { media: string; rule: CSSStyleRule }[] {
  const style = document.createElement('style')
  style.textContent = css
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
const value = (media: string, selector: string, property: string) =>
  rules()
    .find((r) => r.media === media && r.rule.selectorText === selector)
    ?.rule.style.getPropertyValue(property)
    .trim()

describe('hub-operacoes-dia.css · the 80 % switch', () => {
  it('scopes every rule to .hub', () => {
    for (const { rule } of rules()) for (const sel of rule.selectorText.split(',')) expect(sel.trim()).toMatch(/^\.hub /)
  })

  it('gives the switch the board’s 56 × 44 hit area, and drops its motion when asked', () => {
    expect(value('', '.hub .hub-pz-chave', 'width')).toBe('56px')
    expect(value('', '.hub .hub-pz-chave', 'min-height')).toBe('44px')
    expect(value('(prefers-reduced-motion: reduce)', '.hub .hub-pz-chave__tr::after', 'transition')).toBe('none')
  })
})
