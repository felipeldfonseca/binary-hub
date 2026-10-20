/**
 * hub-registrar.css (PR 3-3, lane A): what the phone layout relies on (D13, contract §4.9). jsdom
 * does no layout, so these check the rules themselves (the screenshots at 320–1280 px show the
 * result): the footer sticks to the bottom with the safe area, fields are 16 px on phones (iOS zooms
 * below that), «Stop/Alvo» and «Stake/Payout» keep two columns, the setup pills are 60 × 52, every
 * rule is scoped to .hub.
 */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { render } from '@testing-library/react'
import { GrupoPills } from '@/components/hub/registrar/ui'

const lerCss = (nome: string) => fs.readFileSync(path.join(__dirname, '../../../styles', nome), 'utf8')
const css = lerCss('hub-registrar.css')

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
    expect(r.getPropertyValue('bottom')).toBe('-28px')
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
    expect(regra('.hub .hub-reg-link').getPropertyValue('min-height')).toBe('44px')
    expect(regra('.hub .hub-reg-chip-botao').getPropertyValue('min-height')).toBe('44px')
  })

  it('shows a disabled pill dashed (still focusable), and the errors in the board’s red', () => {
    expect(regra(".hub .hub-reg .hub-pill[aria-disabled='true']").getPropertyValue('border-style')).toBe('dashed')
    expect(regra('.hub .hub-reg-erro').getPropertyValue('color')).toBe('var(--red)')
  })

  it('keeps what the focus shows above the sticky footer on phones: scroll-padding from the footer’s own height (WCAG 2.4.11)', () => {
    const r = regra('.hub .hub-folha.hub-reg', '(max-width: 640px)')
    expect(r.getPropertyValue('scroll-padding-bottom')).toBe('calc(var(--reg-rodape-h, 128px) + 12px)')
    // Not on wider screens, where the footer is in the flow
    expect(todas.some((x) => x.media === '' && x.rule.selectorText.includes('.hub-folha.hub-reg'))).toBe(false)
  })

  it('draws a pressed pill that is also disabled as pressed (#26301F on mint), not the disabled grey (RO: pressed wins)', () => {
    const pressedDisabled = ".hub .hub-reg .hub-pill[aria-pressed='true'][aria-disabled='true']"
    const r = regra(pressedDisabled)
    expect(r.getPropertyValue('color')).toBe('#26301f')
    expect(r.getPropertyValue('border-color')).toBe('var(--mint)')
    expect(regra(`${pressedDisabled}:focus-visible`).getPropertyValue('color')).toBe('#26301f')
    // It comes after the disabled rule and is more specific: [aria-pressed] adds one attribute
    const idx = (sel: string) => todas.findIndex((x) => x.media === '' && x.rule.selectorText.split(',').map((t) => t.trim()).includes(sel))
    expect(idx(pressedDisabled)).toBeGreaterThan(idx(".hub .hub-reg .hub-pill[aria-disabled='true']"))
  })

  it('turns the disclosure’s chevron without motion when asked', () => {
    expect(regra('.hub .hub-reg .hub-seta', '(prefers-reduced-motion: reduce)').getPropertyValue('transition')).toBe('none')
  })
})

// ------------------------------------------------------------------------------------------------
// The cascade: which rule wins on the sheet's real markup. jsdom's getComputedStyle orders the
// matching rules by source only (no specificity), so a rule that loses in a browser can win there;
// the winner is computed here: !important, then specificity, then source order.
// ------------------------------------------------------------------------------------------------

/** Every hub stylesheet, in the order app/(hub)/layout.tsx imports them */
const HUB_CSS = ['hub.css', 'hub-personalizar.css', 'hub-posso.css', 'hub-regras-conta.css', 'hub-registrar.css', 'hub-operacoes-dia.css']
const cascata = HUB_CSS.flatMap((nome) => rules(lerCss(nome)))

type Especificidade = [number, number, number]
const comparar = (a: Especificidade, b: Especificidade) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/** The selectors of a list, split on its top-level commas */
function dividir(lista: string): string[] {
  const out: string[] = []
  let nivel = 0
  let atual = ''
  for (const ch of lista) {
    if (ch === '(') nivel++
    if (ch === ')') nivel--
    if (ch === ',' && nivel === 0) {
      out.push(atual.trim())
      atual = ''
    } else atual += ch
  }
  return out.concat(atual.trim()).filter(Boolean)
}

/** [ids, classes + attributes + pseudo-classes, types + pseudo-elements] of one selector */
function especificidade(seletor: string): Especificidade {
  const out: Especificidade = [0, 0, 0]
  // :is(), :not(), :has() count as their most specific argument; :where() counts nothing
  let s = seletor.replace(/:(is|not|has|where)\(((?:[^()]|\([^()]*\))*)\)/g, (_m, fn: string, args: string) => {
    if (fn !== 'where') {
      const maior = dividir(args).map(especificidade).sort(comparar).pop() ?? [0, 0, 0]
      out[0] += maior[0]
      out[1] += maior[1]
      out[2] += maior[2]
    }
    return ''
  })
  s = s.replace(/\[[^\]]*\]/g, () => (out[1]++, ''))
  s = s.replace(/::[\w-]+(\([^)]*\))?/g, () => (out[2]++, ''))
  s = s.replace(/:[\w-]+(\([^)]*\))?/g, () => (out[1]++, ''))
  s = s.replace(/#[\w-]+/g, () => (out[0]++, ''))
  s = s.replace(/\.[\w-]+/g, () => (out[1]++, ''))
  out[2] += (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length
  return out
}

const casa = (el: Element, seletor: string) => {
  try {
    return el.matches(seletor)
  } catch {
    return false // a pseudo-element: never the element itself
  }
}

/** !important, then specificity, then source order */
type Chave = [number, Especificidade, number]
const antes = (a: Chave, b: Chave) => a[0] - b[0] || comparar(a[1], b[1]) || a[2] - b[2]

/** The declaration of `prop` that wins on `el` (rules outside media queries, and those of `medias`) */
function vencedora(el: Element, prop: string, medias: readonly string[] = []): { valor: string; seletor: string } | null {
  let melhor: { valor: string; seletor: string; chave: Chave } | null = null
  for (let ordem = 0; ordem < cascata.length; ordem++) {
    const { media, rule } = cascata[ordem]
    const valor = rule.style.getPropertyValue(prop)
    if ((media !== '' && !medias.includes(media)) || !valor) continue
    const importante = rule.style.getPropertyPriority(prop) === 'important' ? 1 : 0
    for (const seletor of dividir(rule.selectorText)) {
      const chave: Chave = [importante, especificidade(seletor), ordem]
      if (casa(el, seletor) && (!melhor || antes(chave, melhor.chave) > 0)) melhor = { valor, seletor, chave }
    }
  }
  return melhor
}

describe('the cascade on the sheet’s pills', () => {
  it('computes specificity as browsers do', () => {
    expect(especificidade('.hub .hub-reg .hub-pill')).toEqual([0, 3, 0])
    expect(especificidade(".hub .hub-reg .hub-pill[aria-pressed='true']:focus-visible")).toEqual([0, 5, 0])
    expect(especificidade('.hub .hub-reg-abc .hub-pill::after')).toEqual([0, 3, 1])
    expect(especificidade(".hub:has(.hub[data-tema='escuro']) section:not(#x)")).toEqual([1, 3, 1])
    expect(especificidade(':where(.hub) button')).toEqual([0, 0, 1])
  })

  it('«Contratos» pills are at least 52 px wide, setup pills 60 × 52, any other pill 44 (the board’s «Contratos» min-width 52 and `.abc .pill`)', () => {
    const noop = () => undefined
    const { container } = render(
      <div className="hub" data-tema="escuro">
        <section className="hub-folha hub-reg">
          <GrupoPills id="q" titulo="Contratos" opcoes={[{ valor: '1', rotulo: '1' }]} valor="1" aoEscolher={noop} pillClasse="hub-reg-pill-q" />
          <GrupoPills id="setup" titulo="Setup" opcoes={[{ valor: 'A', rotulo: 'A' }]} valor={null} aoEscolher={noop} classe="hub-pills hub-reg-abc" />
          <GrupoPills id="lado" titulo="Lado" opcoes={[{ valor: 'long', rotulo: 'Compra' }]} valor={null} aoEscolher={noop} />
        </section>
      </div>,
    )
    const [contratos, setup, lado] = Array.from(container.querySelectorAll('button.hub-pill'))
    expect(contratos).toHaveClass('hub-reg-pill-q')
    for (const medias of [[], ['(max-width: 640px)', '(max-width: 420px)']]) {
      expect(vencedora(contratos, 'min-width', medias)?.valor).toBe('52px')
      expect(vencedora(setup, 'min-width', medias)?.valor).toBe('60px')
      expect(vencedora(setup, 'min-height', medias)?.valor).toBe('52px')
      expect(vencedora(lado, 'min-width', medias)?.valor).toBe('44px')
      expect(vencedora(lado, 'min-height', medias)?.valor).toBe('44px')
    }
  })
})
