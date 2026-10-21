/**
 * testing/telasShots (the Phase 3c screenshot harness's page writer): nothing without BH_SHOTS_DIR;
 * with it, one page per theme with what the DOM holds outside the attributes (typed values, boxes,
 * options), the focus mark, the frame and the board reference.
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fotografar, fotosAtivas, marcacao } from '@/testing/telasShots'

let dir = ''
const antes = process.env.BH_SHOTS_DIR

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telas-shots-'))
})

afterEach(() => {
  if (antes === undefined) delete process.env.BH_SHOTS_DIR
  else process.env.BH_SHOTS_DIR = antes
  fs.rmSync(dir, { recursive: true, force: true })
})

function Formulario() {
  const [preco, setPreco] = React.useState('')
  return (
    <section className="hub-folha hub-reg" role="dialog" aria-label="Registrar operação">
      <label htmlFor="f-preco">Preço da parcial</label>
      <input id="f-preco" className="hub-entrada" value={preco} onChange={(e) => setPreco(e.target.value)} />
      <input id="f-be" type="checkbox" aria-label="Movi o stop" defaultChecked={false} />
      <textarea aria-label="Nota" defaultValue="" />
      <select aria-label="Dia" defaultValue="hoje">
        <option value="hoje">Hoje</option>
        <option value="ontem">Ontem</option>
      </select>
      <button type="button">Registrar parcial</button>
      <script>{'window.x = 1'}</script>
    </section>
  )
}

describe('fotografar', () => {
  it('writes nothing without BH_SHOTS_DIR', () => {
    delete process.env.BH_SHOTS_DIR
    render(<Formulario />)
    expect(fotosAtivas()).toBe(false)
    expect(fotografar('14-parcial')).toEqual([])
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('writes one page per theme with the typed values, the focus mark and the board reference', async () => {
    process.env.BH_SHOTS_DIR = dir
    render(<Formulario />)
    await userEvent.type(screen.getByLabelText('Preço da parcial'), '7.920,50')
    await userEvent.click(screen.getByLabelText('Movi o stop'))
    await userEvent.type(screen.getByLabelText('Nota'), 'parcial no alvo 1')
    await userEvent.selectOptions(screen.getByLabelText('Dia'), 'ontem')
    screen.getByRole('button', { name: 'Registrar parcial' }).focus()
    expect(fotosAtivas()).toBe(true)
    const escritos = fotografar('14-parcial-preenchida', { foco: true, quadro: 'RO 14 · Parciais e breakeven: Parcial → 7920,50' })
    expect(escritos.map((f) => path.basename(f))).toEqual(['14-parcial-preenchida-claro.html', '14-parcial-preenchida-escuro.html', '14-parcial-preenchida.json'])
    const claro = fs.readFileSync(path.join(dir, 'html', '14-parcial-preenchida-claro.html'), 'utf8')
    const escuro = fs.readFileSync(path.join(dir, 'html', '14-parcial-preenchida-escuro.html'), 'utf8')
    expect(claro).toContain('<html lang="pt-BR" class="shot shot-folha">')
    expect(claro).toContain('<link rel="stylesheet" href="../shots.css">')
    expect(claro).toContain('<div class="hub" data-tema="claro">')
    expect(escuro).toContain('<div class="hub" data-tema="escuro">')
    expect(claro).toContain('value="7.920,50"')
    expect(claro).toMatch(/<input id="f-be" type="checkbox" aria-label="Movi o stop" checked="">/)
    expect(claro).toContain('>parcial no alvo 1</textarea>')
    expect(claro).toContain('<option value="ontem" selected="">Ontem</option>')
    expect(claro).not.toContain('<option value="hoje" selected')
    expect(claro).toMatch(/<button type="button" class="shot-foco">Registrar parcial<\/button>/)
    expect(claro).not.toContain('<script')
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'html', '14-parcial-preenchida.json'), 'utf8'))).toEqual({
      nome: '14-parcial-preenchida',
      moldura: 'folha',
      quadro: 'RO 14 · Parciais e breakeven: Parcial → 7920,50',
    })
    // The live DOM is untouched
    expect(screen.getByRole('button', { name: 'Registrar parcial' })).not.toHaveClass('shot-foco')
  })

  it('puts a page inside the hub’s page column and takes a selector for the focus', () => {
    process.env.BH_SHOTS_DIR = dir
    const { container } = render(<Formulario />)
    fotografar('11-ponte', { moldura: 'pagina', raiz: container, foco: '#f-preco' })
    const html = fs.readFileSync(path.join(dir, 'html', '11-ponte-escuro.html'), 'utf8')
    expect(html).toContain('class="shot shot-pagina"')
    expect(html).toContain('<div class="hub" data-tema="escuro"><div class="hub-container"><main id="conteudo"><div><section')
    expect(html).toMatch(/<input id="f-preco" class="hub-entrada shot-foco" value="">/)
  })

  it('refuses a name that is not a state name, a name written twice and a focus outside the shot', () => {
    process.env.BH_SHOTS_DIR = dir
    const { container } = render(<Formulario />)
    expect(() => fotografar('14 Parcial')).toThrow('is not a state name')
    expect(() => fotografar('14-parcial-')).toThrow('is not a state name')
    fotografar('14-parcial')
    expect(() => fotografar('14-parcial')).toThrow('was already written')
    expect(() => fotografar('14-foco', { raiz: container, foco: '#nada' })).toThrow('not inside the shot')
    expect(() => fotografar('14-foco-corpo', { foco: true })).toThrow('not inside the shot')
  })
})

describe('marcacao', () => {
  it('serializes an element whole, or the body’s children', () => {
    const { container } = render(<Formulario />)
    expect(marcacao(container)).toMatch(/^<div><section class="hub-folha hub-reg"/)
    expect(marcacao(document.body)).toMatch(/^<div><section/)
  })
})
