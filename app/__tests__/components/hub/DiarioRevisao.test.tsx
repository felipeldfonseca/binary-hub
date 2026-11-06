/**
 * Fase 4 · telas, lane L2: «Revisão do dia» (contract I1–I8) on the approved boards' scenarios (testing/diarioTelas,
 * invented data): closed, the form, the saved review collapsed and open, «o dia mudou», the older versions, the save
 * (status, focus, a second version), offline at once with the text kept and the same client_key on the retry, a
 * refusal, a repeated answer.
 */
import { act, screen, waitFor, within } from '@testing-library/react'
import { onlineManager } from '@tanstack/react-query'
import { mocks, renderDiario } from '@/testing/diarioTelas'
import type { EsperadoDia } from '@/testing/diarioQuadro'

jest.mock('next/navigation', () => require('@/testing/diarioTelasMocks').mockNavegacao())
jest.mock('@/lib/supabase', () => require('@/testing/diarioTelasMocks').mockSupabase())
jest.mock('@/hooks/useAuth', () => require('@/testing/diarioTelasMocks').mockAuth())
jest.mock('@/lib/hub/diarioDb', () => require('@/testing/diarioTelasMocks').mockDiarioDb())
jest.mock('@/lib/hub/regrasDb', () => require('@/testing/diarioTelasMocks').mockRegrasDb())
jest.mock('@/lib/hub/contasDb', () => require('@/testing/diarioTelasMocks').mockContasDb())
jest.mock('@/lib/hub/registrarDb', () => require('@/testing/diarioTelasMocks').mockRegistrarDb())

const sem = (s: string | null | undefined) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

async function revisao(): Promise<HTMLElement> {
  const h3 = await screen.findByRole('heading', { level: 3, name: 'Revisão do dia' })
  return h3.closest('.hub-dr-rev-bloco') as HTMLElement
}

const status = (el: HTMLElement) => Array.from(el.querySelectorAll('[role="status"]')).map((s) => s.textContent)

describe('I1–I2 · closed and the form', () => {
  it('1: «2 minutos · tudo opcional», «Escrever revisão» → the form with the live facts, the fields and «Seguiu o plano?»; «Cancelar» → «Escrever revisão»', async () => {
    const { q, user } = await renderDiario('1')
    const rev = await revisao()
    expect(within(rev).getByText('2 minutos · tudo opcional')).toBeInTheDocument()
    const escrever = within(rev).getByRole('button', { name: 'Escrever revisão' })
    expect(escrever).toHaveAttribute('aria-expanded', 'false')
    expect(escrever).toHaveAttribute('aria-controls', 'rev-form')
    await user.click(escrever)
    const form = document.getElementById('rev-form') as HTMLElement
    expect(sem(form.querySelector('.hub-dr-rev-registrou')?.textContent)).toBe(`O diário registrou: ${q.esperado.cliques?.revform ?? '2 operações · +US$ 85,00 · todas no plano · limite: US$ 0 de US$ 400 no pior momento'}`)
    const func = within(form).getByLabelText('O que funcionou?')
    await waitFor(() => expect(func).toHaveFocus())
    expect(func).toHaveAttribute('placeholder', 'Ex.: esperei o rompimento confirmar.')
    expect(func).toHaveAttribute('maxlength', '1000')
    expect(within(form).getByLabelText('O que você faria diferente?')).toHaveAttribute('placeholder', 'Ex.: não entraria depois das 11:00.')
    expect(within(form).getByLabelText('Levar para o próximo pregão')).toHaveAttribute('maxlength', '200')
    expect(within(form).getByLabelText('Levar para o próximo pregão')).toHaveAttribute('placeholder', 'Aparece no plano do próximo pregão')
    const seguiu = within(form).getByRole('group', { name: 'Seguiu o plano?' })
    expect(seguiu).toHaveAccessibleDescription('Pela sua resposta, depois do resultado. O diário conta à parte.')
    const sim = within(seguiu).getByRole('button', { name: 'Sim' })
    await user.click(sim)
    expect(sim).toHaveAttribute('aria-pressed', 'true')
    await user.click(sim)
    expect(sim).toHaveAttribute('aria-pressed', 'false')
    expect(within(form).getByRole('button', { name: 'Salvar revisão' })).toHaveClass('hub-btn--pri')
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(within(rev).getByRole('button', { name: 'Escrever revisão' })).toHaveFocus())
    expect(mocks.saveDayReview).not.toHaveBeenCalled()
  })
})

describe('I3–I7 · saving, the saved review, a second version', () => {
  it('1: «Salvar revisão» → the saved view open, focus «Editar», «Revisão salva às 10:42 ET.»; «Editar» prefills; a second save → «Versões anteriores (1)»', async () => {
    const { user } = await renderDiario('1')
    const rev = await revisao()
    await user.click(within(rev).getByRole('button', { name: 'Escrever revisão' }))
    await user.type(within(rev).getByLabelText('O que funcionou?'), 'Esperei o rompimento.')
    await user.click(within(rev).getByRole('button', { name: 'Sim' }))
    await user.type(within(rev).getByLabelText('Levar para o próximo pregão'), 'Uma por vez.')
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    await waitFor(() => expect(within(rev).getByRole('button', { name: 'Editar' })).toHaveFocus())
    expect(status(rev)).toContain('Revisão salva às 10:42 ET.')
    expect(within(rev).getByText('Salva às 10:42 · Seguiu o plano? Sim · pela sua resposta, depois do resultado')).toBeInTheDocument()
    const ver = within(rev).getByRole('button', { name: 'Esconder revisão' })
    expect(ver).toHaveAttribute('aria-expanded', 'true')
    const texto = document.getElementById('rev-texto') as HTMLElement
    expect(within(texto).getByText('Esperei o rompimento.')).toBeInTheDocument()
    expect(within(texto).getAllByText('Não preenchido')).toHaveLength(1)
    expect(mocks.saveDayReview.mock.calls[0][3]).toMatchObject({ v: 1, worked: 'Esperei o rompimento.', followed: 'sim', carry_forward: 'Uma por vez.' })

    await user.click(within(rev).getByRole('button', { name: 'Editar' }))
    await waitFor(() => expect(within(rev).getByLabelText('O que funcionou?')).toHaveValue('Esperei o rompimento.'))
    await user.type(within(rev).getByLabelText('O que você faria diferente?'), 'Nada.')
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    await waitFor(() => expect(within(rev).getByRole('button', { name: 'Versões anteriores (1)' })).toBeInTheDocument())
    expect(within(rev).getByText('Salva às 10:42 · editada às 10:42 · Seguiu o plano? Sim · pela sua resposta, depois do resultado')).toBeInTheDocument()
    expect(mocks.saveDayReview.mock.calls[1][3].client_key).not.toBe(mocks.saveDayReview.mock.calls[0][3].client_key)
  })

  it.each(['2', '3'] as const)('%s: «Ver revisão» → the frozen facts, «Depois da revisão, o dia mudou: …», the fields; «Versões anteriores (1)» lists the older one', async (cen) => {
    const { q, user } = await renderDiario(cen)
    const e = q.esperado as EsperadoDia
    const rev = await revisao()
    expect(within(rev).getByText(String(e.revisao.linha))).toBeInTheDocument()
    const ver = within(rev).getByRole('button', { name: 'Ver revisão' })
    expect(ver).toHaveAttribute('aria-expanded', 'false')
    expect(ver).toHaveAttribute('aria-controls', 'rev-texto')
    await user.click(ver)
    const texto = document.getElementById('rev-texto') as HTMLElement
    expect(sem(texto.querySelector('.hub-dr-rev-registrou')?.textContent)).toBe(`O diário registrou: ${e.revisaoAtual!.fatos}`)
    expect(sem(texto.querySelector('.hub-dr-rev-mudou')?.textContent)).toBe(e.revisao.mudou)
    const campos = Array.from(texto.querySelector('.hub-dr-rev-campos')!.querySelectorAll('dd')).map((d) => sem(d.textContent))
    expect(campos).toEqual([e.revisaoAtual!.funcionou, e.revisaoAtual!.diferente, e.revisaoAtual!.seguiu, e.revisaoAtual!.levar])
    if (e.versoes?.length) {
      const botao = within(rev).getByRole('button', { name: `Versões anteriores (${e.versoes.length})` })
      await user.click(botao)
      expect(within(rev).getByRole('button', { name: `Esconder versões anteriores (${e.versoes.length})` })).toHaveAttribute('aria-expanded', 'true')
      const lista = document.getElementById('rev-versoes') as HTMLElement
      const v = e.versoes[0]
      expect(within(lista).getByText(v.titulo)).toBeInTheDocument()
      expect(sem(lista.querySelector('.hub-dr-rev-registrou')?.textContent)).toBe(`O diário registrou: ${v.fatos}`)
    }
  })
})

describe('I8 · offline, a refusal, a repeated answer, one client_key', () => {
  it('10e: offline, «Salvar revisão» says «Sem conexão. A revisão não foi salva.» at once, sends nothing, keeps the text; online again, the same tap saves', async () => {
    const { user } = await renderDiario('10e', { estado: 'offline' })
    const rev = await revisao()
    await user.click(within(rev).getByRole('button', { name: 'Escrever revisão' }))
    await user.type(within(rev).getByLabelText('O que funcionou?'), 'Respeitei a janela.')
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    const alerta = await within(rev).findByRole('alert')
    expect(alerta).toHaveTextContent('Sem conexão. A revisão não foi salva.')
    expect(alerta).toHaveClass('hub-dr-rev-erro')
    expect(mocks.saveDayReview).not.toHaveBeenCalled()
    expect(within(rev).getByLabelText('O que funcionou?')).toHaveValue('Respeitei a janela.')
    act(() => onlineManager.setOnline(true))
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    await waitFor(() => expect(mocks.saveDayReview).toHaveBeenCalledTimes(1))
  })

  it('a refusal (too_many_versions): «Não foi possível salvar a revisão.», the form stays; the retry keeps the client_key', async () => {
    const { user } = await renderDiario('1')
    const DiarioDataError = jest.requireActual('@/lib/hub/diarioDb').DiarioDataError
    const original = mocks.saveDayReview.getMockImplementation()!
    mocks.saveDayReview.mockImplementationOnce(async () => {
      throw new DiarioDataError('too_many_versions')
    })
    const rev = await revisao()
    await user.click(within(rev).getByRole('button', { name: 'Escrever revisão' }))
    await user.type(within(rev).getByLabelText('O que funcionou?'), 'Paciência.')
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    expect(await within(rev).findByRole('alert')).toHaveTextContent('Não foi possível salvar a revisão.')
    expect(within(rev).getByLabelText('O que funcionou?')).toHaveValue('Paciência.')
    mocks.saveDayReview.mockImplementation(original)
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    await waitFor(() => expect(mocks.saveDayReview).toHaveBeenCalledTimes(2))
    expect(mocks.saveDayReview.mock.calls[1][3].client_key).toBe(mocks.saveDayReview.mock.calls[0][3].client_key)
  })

  it('a repeated answer is a success: the saved view, the status', async () => {
    const { user } = await renderDiario('1')
    const rev = await revisao()
    await user.click(within(rev).getByRole('button', { name: 'Escrever revisão' }))
    await user.type(within(rev).getByLabelText('O que funcionou?'), 'Paciência.')
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    await waitFor(() => expect(within(rev).getByRole('button', { name: 'Editar' })).toHaveFocus())
    const anterior = mocks.saveDayReview.mock.results[0].value
    mocks.saveDayReview.mockImplementationOnce(async () => ({ ...(await anterior), repeated: true }))
    await user.click(within(rev).getByRole('button', { name: 'Editar' }))
    await user.click(within(rev).getByRole('button', { name: 'Salvar revisão' }))
    await waitFor(() => expect(within(rev).getByRole('button', { name: 'Editar' })).toHaveFocus())
    expect(within(rev).queryByRole('alert')).toBeNull()
  })

  it('10a (no rules) and 5 (history): no review', async () => {
    for (const cen of ['10a', '5'] as const) {
      const { unmount } = await renderDiario(cen)
      await screen.findByRole('heading', { level: 3, name: 'Operações do dia' })
      expect(screen.queryByRole('heading', { level: 3, name: 'Revisão do dia' })).toBeNull()
      unmount()
    }
  })
})
