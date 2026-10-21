/**
 * Phase 3c screenshot harness: what a Testing Library render shows, written as an HTML page that
 * headless Chrome shoots at 375, 768 and 1280 px in both themes (the harness script and its rules:
 * scratchpad fase3c/telas/shots.md). Lives outside __tests__ so Jest does not run it as a suite.
 *
 * Only the visual specs import it: the harness script copies them into __tests__/__visual__ for one
 * run, with BH_SHOTS_DIR set, and deletes them. Without BH_SHOTS_DIR, fotografar writes nothing, so
 * a spec that runs by mistake in plain Jest leaves no file. Shared by both lanes of the telas
 * contract; neither edits it (§7.3, §9). Invented data only: the page holds what the render shows.
 *
 * For each state: <BH_SHOTS_DIR>/html/<nome>-claro.html and -escuro.html (the markup inside
 * `<div class="hub" data-tema>`, linking ../shots.css, which the script builds from the worktree's
 * stylesheets) and <nome>.json (the board reference for the index). The script names the shots
 * <nome>-<largura>-<tema>.png.
 */
import fs from 'fs'
import path from 'path'

export const TEMAS_FOTO = ['claro', 'escuro'] as const
export const LARGURAS_FOTO = [375, 768, 1280] as const

/**
 * - 'folha' (default): a sheet as RegistrarSheet and ImportSheet render it (.hub-veu + .hub-folha);
 *   the shot unrolls it to its whole height (shot.css), so a long step is one image
 * - 'pagina': inside the hub's page column, as AppShell renders a page (.hub-container > main)
 * - 'solta': the markup as rendered, nothing around it
 */
export type MolduraFoto = 'folha' | 'pagina' | 'solta'

export interface OpcoesFoto {
  moldura?: MolduraFoto
  /** What to write (default: document.body, so a sheet and anything beside it come along) */
  raiz?: Element
  /**
   * One element drawn as keyboard-focused (the :focus-visible ring of hub.css, which a written page
   * cannot have): an element, a CSS selector inside `raiz`, or true for document.activeElement
   */
  foco?: Element | string | true
  /**
   * The approved board's state this shot stands beside: board, scenario and the clicks that
   * reproduce it on the canvas («RO 14 · Parciais e breakeven: Parcial → 1 → 7920,50 → Registrar
   * parcial»). Shown in the index; never on the page.
   */
  quadro?: string
}

/** A state's name: lower-case words and numbers joined by «-» («14-parcial-registrada») */
const NOME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Whether this run writes shots (BH_SHOTS_DIR set by the harness script) */
export const fotosAtivas = (): boolean => !!process.env.BH_SHOTS_DIR

/**
 * Writes the current render as one page per theme and returns the files written ([] without
 * BH_SHOTS_DIR). Each name once per run: a second state with a name already written throws.
 */
export function fotografar(nome: string, o: OpcoesFoto = {}): string[] {
  const dir = process.env.BH_SHOTS_DIR
  if (!dir) return []
  if (!NOME.test(nome)) throw new Error(`fotografar: «${nome}» is not a state name (lower-case words and numbers joined by «-»)`)
  const raiz = o.raiz ?? document.body
  const moldura = o.moldura ?? 'folha'
  const pasta = path.join(dir, 'html')
  fs.mkdirSync(pasta, { recursive: true })
  const meta = path.join(pasta, `${nome}.json`)
  if (fs.existsSync(meta)) throw new Error(`fotografar: «${nome}» was already written in this run`)
  const corpo = moldurar(moldura, marcacao(raiz, alvoDoFoco(raiz, o.foco)))
  const escritos: string[] = []
  for (const tema of TEMAS_FOTO) {
    const arquivo = path.join(pasta, `${nome}-${tema}.html`)
    fs.writeFileSync(arquivo, pagina(nome, tema, moldura, corpo))
    escritos.push(arquivo)
  }
  fs.writeFileSync(meta, JSON.stringify({ nome, moldura, quadro: o.quadro ?? null }, null, 2))
  escritos.push(meta)
  return escritos
}

function alvoDoFoco(raiz: Element, foco: OpcoesFoto['foco']): Element | null {
  if (foco === undefined) return null
  const el = foco === true ? document.activeElement : typeof foco === 'string' ? raiz.querySelector(foco) : foco
  if (!el || el === document.body || !(el === raiz || raiz.contains(el))) throw new Error('fotografar: the focused element is not inside the shot')
  return el
}

/**
 * The markup of `raiz` with what the DOM holds outside its attributes written into them (typed
 * values, checked boxes, chosen options), the focused element marked and scripts left out
 */
export function marcacao(raiz: Element, foco: Element | null = null): string {
  const copia = raiz.cloneNode(true) as Element
  const campos = Array.from(raiz.querySelectorAll('input, textarea, select'))
  const camposCopia = Array.from(copia.querySelectorAll('input, textarea, select'))
  campos.forEach((el, i) => {
    const c = camposCopia[i]
    if (el instanceof HTMLInputElement && c instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) c.setAttribute('checked', '')
        else c.removeAttribute('checked')
      } else if (el.type !== 'file' && el.type !== 'password') c.setAttribute('value', el.value)
    } else if (el instanceof HTMLTextAreaElement && c instanceof HTMLTextAreaElement) {
      c.textContent = el.value
    } else if (el instanceof HTMLSelectElement && c instanceof HTMLSelectElement) {
      Array.from(c.options).forEach((opt, j) => {
        if (el.options[j]?.selected) opt.setAttribute('selected', '')
        else opt.removeAttribute('selected')
      })
    }
  })
  if (foco) {
    if (foco === raiz) copia.classList.add('shot-foco')
    else {
      const i = Array.from(raiz.querySelectorAll('*')).indexOf(foco)
      Array.from(copia.querySelectorAll('*'))[i]?.classList.add('shot-foco')
    }
  }
  copia.querySelectorAll('script').forEach((s) => s.remove())
  return raiz === document.body ? copia.innerHTML : copia.outerHTML
}

function moldurar(moldura: MolduraFoto, markup: string): string {
  if (moldura === 'pagina') return `<div class="hub-container"><main id="conteudo">${markup}</main></div>`
  return markup
}

function pagina(nome: string, tema: (typeof TEMAS_FOTO)[number], moldura: MolduraFoto, corpo: string): string {
  return [
    '<!doctype html>',
    `<html lang="pt-BR" class="shot shot-${moldura}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${nome} · ${tema}</title>`,
    '<link rel="stylesheet" href="../shots.css">',
    '</head>',
    `<body><div class="hub" data-tema="${tema}">${corpo}</div></body>`,
    '</html>',
    '',
  ].join('\n')
}
