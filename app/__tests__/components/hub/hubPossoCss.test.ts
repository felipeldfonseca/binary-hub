/**
 * hub-posso.css: the « · » of a «Posso operar hoje?» answer never starts a line (Diário board revision of 25 Oct,
 * Phase 4 · telas lane L1): it ends the answer's own piece («Fora da sua janela ·»), so a detail that wraps starts its
 * line without it. jsdom does no layout, so these tests check the rules the browser layout relies on (the screenshots
 * of the card at 375 / 768 / 1280 px show the result), and the board's measures of the Diário's card: the open
 * account, «somando as contas de Futuros», the others line, the wider name column from 10 accounts, the phone layout.
 */
import fs from 'fs'
import path from 'path'

const read = (name: string) => fs.readFileSync(path.join(__dirname, '../../../styles', name), 'utf8')

/** Every style rule of a stylesheet, with the media query it sits in ('' at the top level) */
function rules(css: string): { media: string; rule: CSSStyleRule }[] {
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

const posso = rules(read('hub-posso.css'))

/** A rule's declared value, by one of its selectors (top level, or inside `media`) */
function value(selector: string, property: string, media = ''): string {
  const found = posso.find((r) => r.media === media && r.rule.selectorText.split(',').map((s) => s.trim()).includes(selector))
  if (!found) throw new Error(`no rule ${selector} ${media}`)
  return found.rule.style.getPropertyValue(property).trim()
}

beforeEach(() => {
  // The structure PossoOperarHoje renders for «Fora da sua janela · abre às 10:00 ET» and «Sem janela salva · Definir»
  document.body.innerHTML = `
    <div class="hub">
      <span class="hub-posso__estado" id="sub">
        <strong class="hub-posso__palavra">Fora da sua janela<span class="hub-posso__sep hub-posso__sep--esp" aria-hidden="true">· </span></strong>
        <span class="hub-tom--muted">abre às 10:00 ET</span>
      </span>
      <span class="hub-posso__estado" id="acao">
        <span class="hub-posso__palavra">Sem janela salva<span class="hub-posso__sep" aria-hidden="true">·</span></span>
        <a class="hub-posso__acao" href="/personalizar#janelas">Definir</a>
      </span>
    </div>`
})

describe('hub-posso.css: the separator of an answer', () => {
  it('scopes every rule to .hub', () => {
    for (const { rule } of posso) for (const s of rule.selectorText.split(',')) expect(s.trim()).toMatch(/^\.hub[\s.[]/)
  })

  it('lays the answer and its detail out as wrapping pieces, 6px apart (board `.posso-estado`)', () => {
    expect(value('.hub .hub-posso__estado', 'display')).toBe('flex')
    expect(value('.hub .hub-posso__estado', 'flex-wrap')).toBe('wrap')
    expect(value('.hub .hub-posso__estado', 'gap')).toBe('0 6px')
    // No clipping trick any more: the separator is part of the answer's own piece
    expect(value('.hub .hub-posso__estado', 'clip-path')).toBe('')
    expect(value('.hub .hub-posso__estado', 'margin-left')).toBe('')
  })

  it('ends the answer with « · », 6px after it, regular weight and muted (board `.sep-fim`)', () => {
    const sep = document.querySelector('#acao .hub-posso__sep') as HTMLElement
    expect(sep.parentElement).toHaveClass('hub-posso__palavra')
    expect(sep.parentElement?.lastElementChild).toBe(sep)
    expect(value('.hub .hub-posso__sep', 'margin-left')).toBe('6px')
    expect(value('.hub .hub-posso__sep', 'font-weight')).toBe('400')
    expect(value('.hub .hub-posso__sep', 'color')).toBe('var(--text-2)')
    expect(value('.hub .hub-posso__sep', 'position')).toBe('')
  })

  it('keeps the trailing space before a text detail (board `.sep-fim-esp`), so the gap after «·» is the board’s', () => {
    expect(value('.hub .hub-posso__sep--esp', 'white-space')).toBe('pre')
    expect(value('.hub .hub-posso__sep--esp', 'margin-right')).toBe('-6px')
    expect(document.querySelector('#sub .hub-posso__sep')?.textContent).toBe('· ')
  })

  it('stacks the answer over its detail on phones (≤ 700 px) and hides « · » there, only in the answer', () => {
    const m = '(max-width: 700px)'
    expect(value('.hub .hub-posso__estado', 'flex-direction', m)).toBe('column')
    expect(value('.hub .hub-posso__estado', 'align-items', m)).toBe('flex-start')
    expect(value('.hub .hub-posso__estado .hub-posso__sep', 'display', m)).toBe('none')
    expect(document.querySelector('#sub .hub-posso__sep')?.matches('.hub .hub-posso__estado .hub-posso__sep')).toBe(true)
    // The others line keeps its separators (they are not inside an answer)
    document.body.innerHTML += '<div class="hub"><p class="hub-posso__resumo"><strong class="hub-posso__parte">5 fora da janela<span class="hub-posso__sep" id="parte">·</span></strong></p></div>'
    expect(document.getElementById('parte')?.matches('.hub .hub-posso__estado .hub-posso__sep')).toBe(false)
  })
})

describe('hub-posso.css: the Diário’s card (board DiarioDezEnxuto, «Muitas contas»)', () => {
  it('one account’s row: name 92 px · answer · limit, 44 px tall; 120 px for the name from 10 accounts', () => {
    expect(value('.hub .hub-posso__conta', 'grid-template-columns')).toBe('92px minmax(0, 1fr) auto')
    expect(value('.hub .hub-posso__conta', 'min-height')).toBe('44px')
    expect(value('.hub .hub-posso__corpo--largo .hub-posso__conta', 'grid-template-columns')).toBe('120px minmax(0, 1fr) auto')
    expect(value('.hub .hub-posso__corpo', 'flex')).toBe('1 1 560px')
  })

  it('the open account’s limit in a column with «somando as contas de Futuros» under it, right-aligned; left on phones', () => {
    expect(value('.hub .hub-posso__limite--col', 'flex-direction')).toBe('column')
    expect(value('.hub .hub-posso__limite--col', 'align-items')).toBe('flex-end')
    expect(value('.hub .hub-posso__limite--col', 'align-items', '(max-width: 700px)')).toBe('flex-start')
    expect(value('.hub .hub-posso__limite', 'justify-self')).toBe('end')
    expect(value('.hub .hub-posso__limite', 'justify-self', '(max-width: 700px)')).toBe('start')
  })

  it('the others line: wraps, a 44 px row under a border, «Ver todas» at its end; their lines under another border', () => {
    expect(value('.hub .hub-posso__outras', 'justify-content')).toBe('space-between')
    expect(value('.hub .hub-posso__outras', 'flex-wrap')).toBe('wrap')
    expect(value('.hub .hub-posso__outras', 'min-height')).toBe('44px')
    expect(value('.hub .hub-posso__outras', 'border-top')).toBe('1px solid var(--border)')
    expect(value('.hub .hub-posso__resumo', 'gap')).toBe('0 6px')
    expect(value('.hub .hub-posso__todas', 'border-top')).toBe('1px solid var(--border)')
  })

  it('one column on phones, both widths of the name column; the card’s padding 16 px at ≤ 540 px', () => {
    const m = '(max-width: 700px)'
    expect(value('.hub .hub-posso__conta', 'grid-template-columns', m)).toBe('minmax(0, 1fr)')
    expect(value('.hub .hub-posso__corpo--largo .hub-posso__conta', 'grid-template-columns', m)).toBe('minmax(0, 1fr)')
    expect(value('.hub .hub-posso', 'padding', '(max-width: 540px)')).toBe('8px 16px')
  })

  it('«Definir», «Tentar de novo» in a line keep a 44 px target; the limit itself adds no height (board `.posso-lim`)', () => {
    expect(value('.hub .hub-posso__acao', 'min-height')).toBe('44px')
    expect(value('.hub .hub-posso__limite', 'min-height')).toBe('')
  })
})
