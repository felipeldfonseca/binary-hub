/**
 * hub-posso.css: the « · » of a «Posso operar hoje?» answer never ends or starts a line. jsdom does
 * no layout, so these tests check the rules the browser layout relies on (the screenshots of the
 * long states at 320–1280 px show the result): the separator travels with the detail, sits in the
 * room every piece keeps on its left, and the line box clips its left edge between the separator
 * and a focus ring.
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

/** A top-level rule's declared value, by its exact selector */
function value(selector: string, property: string): string {
  const found = posso.find((r) => !r.media && r.rule.selectorText === selector)
  if (!found) throw new Error(`no rule ${selector}`)
  return found.rule.style.getPropertyValue(property).trim()
}

const px = (text: string) => {
  const m = text.match(/^(-?\d+(?:\.\d+)?)px$/)
  if (!m) throw new Error(`not px: ${text}`)
  return Number(m[1])
}

beforeEach(() => {
  // The structure PossoOperarHoje renders for «Fora da sua janela · abre às 10:00 ET» and
  // «Sem janela salva · Definir»
  document.body.innerHTML = `
    <div class="hub">
      <span class="hub-posso__estado hub-posso__estado--empilha" id="sub">
        <strong class="hub-posso__palavra">Fora da sua janela</strong>
        <span class="hub-posso__mais"><span class="hub-posso__sep" aria-hidden="true">·</span><span>abre às 10:00 ET</span></span>
      </span>
      <span class="hub-posso__estado" id="acao">
        <span class="hub-posso__palavra">Sem janela salva</span>
        <span class="hub-posso__mais"><span class="hub-posso__sep" aria-hidden="true">·</span><a class="hub-posso__acao" href="/personalizar#janelas">Definir</a></span>
      </span>
    </div>`
})

describe('hub-posso.css: the separator of an answer', () => {
  it('gives every piece of the line the same room on its left, and starts the line box that far to the left', () => {
    expect(value('.hub-posso__estado', '--posso-sep')).toBe('calc(12px + 0.196em)')
    expect(value('.hub-posso__estado', 'margin-left')).toBe('calc(-1 * var(--posso-sep))')
    expect(value('.hub-posso__estado > *', 'margin-left')).toBe('var(--posso-sep)')
    expect(value('.hub-posso__estado', 'gap')).toBe('0')
    // Both pieces get the room: the answer and the detail with its separator
    const pieces = Array.from(document.querySelectorAll('#acao > *'))
    expect(pieces.map((el) => el.className)).toEqual(['hub-posso__palavra', 'hub-posso__mais'])
    expect(pieces.every((el) => el.matches('.hub-posso__estado > *'))).toBe(true)
  })

  it('puts « · » in that room, right before the detail, 6px from it as on the board', () => {
    const sep = document.querySelector('#acao .hub-posso__sep') as HTMLElement
    expect(sep.parentElement).toHaveClass('hub-posso__mais')
    expect(sep.nextElementSibling).toHaveTextContent('Definir')
    expect(value('.hub-posso__mais', 'position')).toBe('relative')
    expect(value('.hub-posso__sep', 'position')).toBe('absolute')
    expect(value('.hub-posso__sep', 'right')).toBe('100%')
    expect(value('.hub-posso__sep', 'padding-right')).toBe('6px')
  })

  it('clips the line box between the separator of a piece that starts a line and a focus ring', () => {
    const clip = value('.hub-posso__estado', 'clip-path')
    const m = clip.match(/^inset\((\S+) (\S+) (\S+) calc\(var\(--posso-sep\) - (\d+(?:\.\d+)?)px\)\)$/)
    expect(m).not.toBeNull()
    const [, top, right, bottom, left] = m as RegExpMatchArray
    // Only the left edge is clipped
    expect([top, right, bottom]).toEqual(['-100vmax', '-100vmax', '-100vmax'])
    // A piece that starts a line starts at the line's own left edge (x = 0); the clip runs `cut` px
    // to its left, the separator ends `gap` px to its left, a focus ring reaches `ring` px
    const cut = Number(left)
    const gap = px(value('.hub-posso__sep', 'padding-right'))
    const hub = rules(read('hub.css')).find((r) => !r.media && r.rule.selectorText === '.hub :focus-visible') as { rule: CSSStyleRule }
    const [, width] = hub.rule.style.getPropertyValue('outline').trim().match(/^(\d+)px/) as RegExpMatchArray
    const ring = Number(width) + px(hub.rule.style.getPropertyValue('outline-offset').trim())
    expect(ring).toBe(4)
    expect(ring).toBeLessThan(cut)
    expect(cut).toBeLessThan(gap)
  })

  it('hides « · » where the board stacks the answer and its sub (.empilha), with the separator inside the detail', () => {
    const empilha = posso.filter((r) => r.media && r.rule.style.getPropertyValue('display').trim() === 'none')
    expect(empilha.map((r) => [r.media, r.rule.selectorText])).toEqual([
      ['(max-width: 359px), (min-width: 641px) and (max-width: 1000px)', '.hub-posso__estado--empilha .hub-posso__sep'],
    ])
    expect(document.querySelector('#sub .hub-posso__sep')?.matches(empilha[0].rule.selectorText)).toBe(true)
    expect(document.querySelector('#acao .hub-posso__sep')?.matches(empilha[0].rule.selectorText)).toBe(false)
  })
})
