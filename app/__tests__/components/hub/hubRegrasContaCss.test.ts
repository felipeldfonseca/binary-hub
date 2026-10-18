/**
 * hub-regras-conta.css: in step b of a new market's first account, «das [10:00] às [11:00] [Brasília]»
 * fits on one row of the sheet at desktop widths, as on the ImportarConta board (scenario 14); at
 * 375 px only the clock menu goes to the next row, as on the board. jsdom does no layout, so the
 * test adds up the sizes the stylesheets set with the widths Chrome measured for what they leave to
 * the content (the before/after screenshots at 375 and 1280 px show the result).
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

const hub = rules(read('hub.css'))
const conta = rules(read('hub-regras-conta.css'))

/** A rule's declared value, by its exact selector and media query */
function value(sheet: ReturnType<typeof rules>, selector: string, property: string, media = ''): string {
  const found = sheet.find((r) => r.media === media && r.rule.selectorText === selector)
  if (!found) throw new Error(`no rule ${selector} ${media}`)
  return found.rule.style.getPropertyValue(property).trim()
}

const px = (text: string) => {
  if (text === '0') return 0
  const m = text.match(/^(-?\d+(?:\.\d+)?)px$/)
  if (!m) throw new Error(`not px: ${text}`)
  return Number(m[1])
}
/** The left and right of a `padding` shorthand */
const sides = (padding: string) => {
  const p = padding.split(/\s+/).map(px)
  const [, right = p[0], , left = right] = p
  return { left, right }
}
const border = (shorthand: string) => px(shorthand.split(/\s+/)[0])

// Measured in Chrome (the owner's macOS fonts) on the 1280 px sheet: what the stylesheets leave to the content
const DAS = 25 // «das», 13px Comfortaa
const AS = 15.81 // «às»
const CAMPO = 75.69 // a time field's content: «10:00» in 14px ui-monospace and the clock icon
const RELOGIO = 140 // the clock menu («Nova York (ET)», 13px bold Comfortaa, padding 0 12px)

/** The time field's width: as set, or its content with its padding and border */
function campo(): number {
  const width = value(conta, '.hub .hub-rc-hora', 'width')
  const borda = 2 * border(value(conta, '.hub .hub-rc-hora', 'border'))
  if (width !== 'auto') return px(width)
  const { left, right } = sides(value(conta, '.hub .hub-rc-hora', 'padding'))
  return CAMPO + left + right + borda
}

/** The editor's content width on a sheet of `folha` px with `lados` px of padding on each side and `borda` on its left */
function espaco(folha: number, lados: number, borda: number): number {
  const editor = sides(value(conta, '.hub-rc-editor', 'padding'))
  const bordaEditor = border(value(conta, '.hub-rc-editor', 'border'))
  return folha - 2 * lados - borda - 2 * bordaEditor - editor.left - editor.right
}

describe('hub-regras-conta.css: the hours row of step b', () => {
  const gapLinha = px(value(conta, '.hub-rc-horas', 'gap'))
  const gapGrupo = px(value(conta, '.hub-rc-hgrupo', 'gap'))
  const das = DAS + gapGrupo + campo()
  const as = AS + gapGrupo + campo()

  it('fits «das [10:00] às [11:00] [Brasília]» on one row of the 480 px sheet, with room to spare', () => {
    expect(value(hub, '.hub-folha', 'width')).toBe('480px')
    const sala = espaco(px(value(hub, '.hub-folha', 'width')), sides(value(hub, '.hub-folha', 'padding')).left, border(value(hub, '.hub-folha', 'border-left')))
    expect(sala).toBe(401)
    const linha = das + gapLinha + as + gapLinha + RELOGIO
    // A fixed 96px field made the row 404.8px: the menu went to its own row
    expect(linha).toBeLessThanOrEqual(sala - 4)
  })

  it('at 375 px keeps «das [10:00] às [11:00]» together and sends only the clock menu down', () => {
    const lados = sides(value(hub, '.hub-folha', 'padding', '(max-width: 640px)')).left
    expect(value(hub, '.hub-folha', 'border-left', '(max-width: 640px)')).toBe('0')
    const sala = espaco(375, lados, 0)
    expect(sala).toBe(313)
    expect(das + gapLinha + as).toBeLessThanOrEqual(sala)
    expect(das + gapLinha + as + gapLinha + RELOGIO).toBeGreaterThan(sala)
  })

  it('never lets the time field shrink below its content', () => {
    expect(campo()).toBeGreaterThanOrEqual(CAMPO + 2)
    expect(value(conta, '.hub-rc-hgrupo', 'white-space')).toBe('nowrap')
  })
})
