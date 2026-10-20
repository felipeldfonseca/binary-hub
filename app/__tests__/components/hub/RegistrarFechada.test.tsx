/**
 * «Registrar operação» step 3 (PR 3-3, lane A): «Operação fechada» with the recorded answers of the
 * owner's day (testing/registrarTelas; invented data, invented image files): the result, the marks
 * before the exit and after the result, «Imagens e nota» (the 5th image refused, sizes, types,
 * pasted names, progress, failures, saved and removed lines) and what «Registrar outra» / «Ver no
 * Diário» do with what is pending.
 */
import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as contasDb from '@/lib/hub/contasDb'
import * as regrasDb from '@/lib/hub/regrasDb'
import * as registrarDb from '@/lib/hub/registrarDb'
import * as imagens from '@/lib/hub/registrarImagens'
import RegistrarSheet from '@/components/hub/registrar/RegistrarSheet'
import { agoraTelas, contasTelas, estadoTelas, idsTelas, operacaoTelas, recentesTelas, saidaTelas } from '@/testing/registrarTelas'

const mockRouter = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }
let mockPathname = '/diario'
let mockParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => mockParams,
}))
jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({ storage: { from: () => ({}) } })) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'user-1' }, session: { access_token: 'user-jwt' } }) }))
jest.mock('@/lib/hub/contasDb', () => ({ ...jest.requireActual('@/lib/hub/contasDb'), fetchAccounts: jest.fn(), fetchPreferences: jest.fn() }))
jest.mock('@/lib/hub/regrasDb', () => ({ ...jest.requireActual('@/lib/hub/regrasDb'), fetchRulesNow: jest.fn(), mergePreferences: jest.fn() }))
jest.mock('@/lib/hub/registrarImagens', () => ({ ...jest.requireActual('@/lib/hub/registrarImagens'), saveImagesAndNote: jest.fn() }))
jest.mock('@/lib/hub/registrarDb', () => ({
  ...jest.requireActual('@/lib/hub/registrarDb'),
  fetchOpenTrades: jest.fn(),
  fetchTradeState: jest.fn(),
  fetchGateAt: jest.fn(),
  fetchRecentTrades: jest.fn(),
  previewEntry: jest.fn(),
  previewExit: jest.fn(),
  previewAfter: jest.fn(),
  registerEntry: jest.fn(),
  registerExit: jest.fn(),
  registerAfter: jest.fn(),
  addMarks: jest.fn(),
  undoEntry: jest.fn(),
  drainImageTrash: jest.fn(),
  signedImageUrl: jest.fn(),
}))

const db = registrarDb as jest.Mocked<typeof registrarDb>
const save = imagens.saveImagesAndNote as jest.MockedFunction<typeof imagens.saveImagesAndNote>
const fetchRulesNow = regrasDb.fetchRulesNow as jest.MockedFunction<typeof regrasDb.fetchRulesNow>
const fetchAccounts = contasDb.fetchAccounts as jest.MockedFunction<typeof contasDb.fetchAccounts>
const fetchPreferences = contasDb.fetchPreferences as jest.MockedFunction<typeof contasDb.fetchPreferences>
const ids = idsTelas()

/** An invented image file of `bytes` bytes */
function imagem(name: string, bytes = 840 * 1024, type = 'image/png'): File {
  const f = new File(['x'], name, { type })
  Object.defineProperty(f, 'size', { value: bytes })
  return f
}

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  mockPathname = '/diario'
  mockParams = new URLSearchParams()
  fetchAccounts.mockResolvedValue(contasTelas())
  fetchPreferences.mockResolvedValue({})
  fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-1042-et'))
  db.fetchOpenTrades.mockResolvedValue([])
  db.fetchRecentTrades.mockImplementation(async (_db, id) => recentesTelas(id === ids.accounts.ebinex ? 'recentes-ebinex' : 'recentes-top-one'))
  db.drainImageTrash.mockResolvedValue({ cleared: 0, remaining: 0 })
  db.signedImageUrl.mockImplementation(async (_db, path) => `https://storage.invalid/${path}?token=t`)
  db.previewEntry.mockRejectedValue(new registrarDb.RegistrarDataError('network'))
  db.fetchGateAt.mockImplementation(async (_db, id) => agoraTelas('agora-qui-1042-et').accounts.find((a) => a.accountId === id)!)
})

function abrir(tradeId: string, accountId: string = ids.accounts.topOne) {
  const onClose = jest.fn()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RegistrarSheet accountId={accountId} tradeId={tradeId} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { ...view, onClose, queryClient }
}

/** The closed MES without images or note (right after its exit) */
const mesFechadaSemAnexos = () => saidaTelas('exit-mes-oitenta').state

const blocoAnexos = () => screen.getByRole('group', { name: 'Imagens e nota' })
const escolher = (files: File[]) => fireEvent.change(document.getElementById('f-img') as HTMLInputElement, { target: { files } })

describe('the closed trade', () => {
  it('shows the result, the plan and the marks before the exit', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir(ids.trades.mes)
    expect(await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(screen.getByText('−US$ 100,00')).toBeInTheDocument()
    expect(screen.getByText('MES · Compra · 2 ct · 7.912,50 → 7.902,50 · −10,00 pts · 10:12–10:38 ET')).toBeInTheDocument()
    expect(screen.getByText('No plano')).toBeInTheDocument()
    expect(screen.queryByText('conferido pelo hub')).not.toBeInTheDocument()
    const marcas = screen.getByRole('button', { name: 'Como ler: suas marcas' }).closest('.hub-bloco') as HTMLElement
    const listas = within(marcas).getAllByRole('list')
    expect(within(listas[0]).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Setup A às 10:12',
      'Execução: no ponto às 10:12',
      'Emoção: Calmo às 10:31',
    ])
    expect(within(marcas).getByText('Nenhuma.')).toBeInTheDocument()
    expect(screen.getByText('Marcas feitas a partir de agora contam como depois do resultado.')).toBeInTheDocument()
    // No banner on a later visit
    expect(screen.queryByText(/Você chegou a 80%|Limite do dia atingido/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar outra' })).toBeInTheDocument()
  })

  it('a mark changed after the result: «(trocada às 20:12)» and the history line', async () => {
    fetchRulesNow.mockResolvedValue(agoraTelas('agora-qui-2024-brt'))
    db.fetchTradeState.mockResolvedValue(estadoTelas('marks-ebinex-depois'))
    abrir(ids.trades.ebx, ids.accounts.ebinex)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    const marcas = screen.getByRole('button', { name: 'Como ler: suas marcas' }).closest('.hub-bloco') as HTMLElement
    const [antes, depois] = within(marcas).getAllByRole('list')
    expect(antes).toHaveTextContent('Setup B às 20:10 (trocada às 20:12)')
    expect(depois).toHaveTextContent('Setup C às 20:12antes: B às 20:10 · agora: C às 20:12')
    expect(screen.getByText('EUR/USD · Baixa · 1 min · perda · 20:10–20:12 de Brasília')).toBeInTheDocument()
  })

  it('a mark made after the exit time but before it was registered: «a partir das 10:38 (sua saída)»', async () => {
    const v = operacaoTelas('operacao-mes-fechada')
    v.trade.exitRegisteredAt = new Date('2026-10-22T14:41:00Z')
    v.marks = [...v.marks, { id: 30, kind: 'execucao', value: 'tarde', markedAt: new Date('2026-10-22T14:39:30Z'), limpa: false }]
    db.fetchTradeState.mockResolvedValue(v)
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByText('Marcas feitas a partir das 10:38 (sua saída) contam como depois do resultado.')).toBeInTheDocument()
  })

  it('«Marcar ou mudar»: each tap is a mark', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    db.addMarks.mockResolvedValue(estadoTelas('extras-mes'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Marcar ou mudar' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Setup' })).getByRole('button', { name: 'Setup B' }))
    await waitFor(() => expect(db.addMarks).toHaveBeenCalledWith(expect.anything(), ids.trades.mes, { v: 1, marks: { setup: 'B' } }))
  })
})

describe('«Imagens e nota»', () => {
  it('the saved summary: «2 imagens e nota salvas às 10:38», signed thumbnails, the note, «Editar»', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(within(blocoAnexos()).getByText('2 imagens e nota salvas às 10:38. Aparecem nos detalhes da operação, no Diário.')).toBeInTheDocument()
    const minis = within(blocoAnexos()).getByRole('list', { name: 'Imagens salvas' })
    expect(await within(minis).findByAltText('MES_10-12_entrada.webp')).toHaveAttribute('src', expect.stringContaining('https://storage.invalid/'))
    expect(screen.getByText('Saí no stop: o rompimento não confirmou.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Editar imagens e nota' }))
    expect(screen.getByRole('button', { name: 'Escolher imagens' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Remover imagem MES_10-12_entrada.webp' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nota (opcional)')).toHaveValue('Saí no stop: o rompimento não confirmou.')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('adds the chosen files; the 5th is refused by the button, by a multiple choice and by the server', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByRole('button', { name: 'Salvar imagens e nota' })).toHaveAttribute('aria-disabled', 'true')
    escolher([imagem('a.png'), imagem('b.png', 1.2 * 1024 * 1024)])
    expect(await screen.findByText('2 imagens adicionadas. 2 de 4.')).toBeInTheDocument()
    const lista = screen.getByRole('list', { name: 'Imagens anexadas' })
    expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['sem préviaa.png840\u00a0KBRemover', 'sem préviab.png1,2\u00a0MBRemover'])
    // A multiple choice that passes four: the one left out is named
    escolher([imagem('c.png'), imagem('d.png'), imagem('e.png')])
    expect(await screen.findByRole('alert')).toHaveTextContent('Até 4 imagens por operação; não entrou: e.png.')
    // Full: the button says why
    const botao = screen.getByRole('button', { name: 'Escolher imagens' })
    expect(botao).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Limite de 4 imagens. Remova uma para trocar.')).toBeInTheDocument()
    await userEvent.click(botao)
    expect(screen.getByRole('alert')).toHaveTextContent('Até 4 imagens por operação.')
    // The server refusing a fifth (another device added one): its code's text
    save.mockRejectedValueOnce(new registrarDb.RegistrarDataError('too_many_images', 'images'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar imagens e nota' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Até 4 imagens por operação.'))
  })

  it('refuses a file over 10 MB, HEIC and GIF', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    escolher([imagem('grande.png', 11 * 1024 * 1024)])
    expect(await screen.findByRole('alert')).toHaveTextContent('Esta imagem passa de 10 MB.')
    escolher([imagem('foto.heic', 1000, 'image/heic')])
    expect(await screen.findByRole('alert')).toHaveTextContent('Só imagens PNG, JPG ou WebP.')
    escolher([imagem('x.gif', 1000, 'image/gif'), imagem('y.heic', 1000, 'image/heic'), imagem('ok.png')])
    expect(await screen.findByRole('alert')).toHaveTextContent('Só imagens PNG, JPG ou WebP; não entraram: x.gif, y.heic.')
    expect(screen.getByText('1 imagem adicionada. 1 de 4.')).toBeInTheDocument()
  })

  it('pasted screenshots get «image (2).png»; removing moves the focus to the next «Remover», then to «Escolher imagens»', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    const zona = screen.getByRole('group', { name: 'Imagens (opcional)' })
    fireEvent.paste(zona, { clipboardData: { files: [imagem('image.png')], items: [] } })
    fireEvent.paste(zona, { clipboardData: { files: [imagem('image.png')], items: [] } })
    expect(await screen.findByRole('button', { name: 'Remover imagem image (2).png' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remover imagem image.png' }))
    expect(screen.getByText('image.png removida. 1 de 4.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remover imagem image (2).png' })).toHaveFocus())
    await userEvent.click(screen.getByRole('button', { name: 'Remover imagem image (2).png' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Escolher imagens' })).toHaveFocus())
  })

  it('on a touch screen the hint does not offer dragging or pasting', async () => {
    const original = window.matchMedia
    window.matchMedia = ((q: string) => ({ matches: q === '(pointer: coarse)', media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    try {
      db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
      abrir(ids.trades.mes)
      await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
      expect(within(blocoAnexos()).getByText('Até 4 imagens PNG, JPG ou WebP, de até 10 MB cada.')).toBeInTheDocument()
      expect(within(blocoAnexos()).queryByText(/Arraste para cá/)).not.toBeInTheDocument()
    } finally {
      window.matchMedia = original
    }
  })

  it('saving: «Enviando 1 de 2…», a failed upload stays with «Não foi possível enviar b.png.»', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    let finish: () => void = () => undefined
    const extras = estadoTelas('extras-mes')
    save.mockImplementationOnce(async (_db, _id, input, options) => {
      options?.onProgress?.({ sending: 1, total: 2 })
      await new Promise<void>((resolve) => (finish = resolve))
      const novo = input.items.filter((i): i is Extract<imagens.ImageItem, { kind: 'new' }> => i.kind === 'new')
      return {
        state: { ...extras, images: extras.images.slice(0, 1) },
        savedAt: extras.images[0].savedAt as Date,
        noteSavedAt: extras.trade.noteSavedAt,
        failed: [{ key: novo[1].key, name: novo[1].name, reason: 'upload' }],
        savedIds: { [novo[0].key]: extras.images[0].id },
      }
    })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    escolher([imagem('a.png'), imagem('b.png')])
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'Saí no stop.')
    expect(screen.getByText('12 de 1000')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Salvar imagens e nota' }))
    expect(await screen.findByText('Enviando 1 de 2…')).toBeInTheDocument()
    const call = save.mock.calls[0]
    expect(call[1]).toBe(ids.trades.mes)
    expect(call[2].note).toBe('Saí no stop.')
    expect(call[2].items.map((i) => i.kind)).toEqual(['new', 'new'])
    await act(async () => finish())
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar b.png.')
    expect(screen.getByRole('button', { name: 'Remover imagem b.png' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover imagem MES_10-12_entrada.webp' })).toBeInTheDocument()
  })

  it('saving everything: the summary with the save’s time; emptying it: «Imagens e nota removidas às …»', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    const extras = estadoTelas('extras-mes')
    const savedAt = extras.images[0].savedAt as Date
    save.mockResolvedValueOnce({ state: extras, savedAt, noteSavedAt: extras.trade.noteSavedAt, failed: [], savedIds: {} })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    escolher([imagem('MES_10-12_entrada.png'), imagem('MES_10-38_saida.png')])
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'Saí no stop: o rompimento não confirmou.')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar imagens e nota' }))
    expect(await within(blocoAnexos()).findByText('2 imagens e nota salvas às 10:38. Aparecem nos detalhes da operação, no Diário.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar imagens e nota' })).toHaveFocus())
    // Edit, remove everything, save: removed
    const vazio = { ...extras, images: [], trade: { ...extras.trade, note: null, noteSavedAt: null } }
    save.mockResolvedValueOnce({ state: vazio, savedAt: new Date('2026-10-22T14:41:00Z'), noteSavedAt: null, failed: [], savedIds: {} })
    await userEvent.click(screen.getByRole('button', { name: 'Editar imagens e nota' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover imagem MES_10-12_entrada.webp' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover imagem MES_10-38_saida.webp' }))
    await userEvent.clear(screen.getByLabelText('Nota (opcional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar imagens e nota' }))
    expect(await screen.findByText('Imagens e nota removidas às 10:41.')).toBeInTheDocument()
    expect(save.mock.calls[1][2]).toEqual({ items: [], note: null })
  })

  it('offline: «Sem conexão. As imagens e a nota não foram salvas.»', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    save.mockRejectedValueOnce(new registrarDb.RegistrarDataError('offline'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar imagens e nota' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sem conexão. As imagens e a nota não foram salvas.')
  })
})

describe('leaving step 3', () => {
  it('«Registrar outra» saves what is pending first and says it on step 1', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    const extras = estadoTelas('extras-mes')
    save.mockResolvedValueOnce({ state: extras, savedAt: extras.images[0].savedAt as Date, noteSavedAt: extras.trade.noteSavedAt, failed: [], savedIds: {} })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    escolher([imagem('a.png'), imagem('b.png')])
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'nota')
    // Pending: closing asks first
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.getByText('Fechar sem salvar?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Continuar aqui' }))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar outra' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(save).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Operação anterior: 2 imagens e nota salvas às 10:38.')).toBeInTheDocument()
  })

  it('an emptied editor is never pending: «Registrar outra» does not remove saved data (C12)', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Editar imagens e nota' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover imagem MES_10-12_entrada.webp' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remover imagem MES_10-38_saida.webp' }))
    await userEvent.clear(screen.getByLabelText('Nota (opcional)'))
    await userEvent.click(screen.getByRole('button', { name: 'Registrar outra' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('a failed save keeps step 3', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    save.mockRejectedValueOnce(new registrarDb.RegistrarDataError('network'))
    const { onClose } = abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), 'nota')
    await userEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.')
    expect(screen.getByRole('heading', { level: 3, name: 'Operação fechada' })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('«Ver no Diário» from another page goes to /diario on the sheet’s account first (C7)', async () => {
    mockPathname = '/trades'
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    const { onClose } = abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ focusId: 'operacoes-do-dia' }))
    expect(mockRouter.push).toHaveBeenCalledWith(`/diario?conta=${ids.accounts.topOne}`)
  })

  it('«Ver no Diário» on /diario with the same account only closes', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    const { onClose } = abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Ver no Diário' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith({ focusId: 'operacoes-do-dia' }))
    expect(mockRouter.push).not.toHaveBeenCalled()
  })
})

describe('«Imagens e nota»: what counts as pending, the note sent, a double tap (review gaps)', () => {
  it('the saved summary is not pending: «Registrar outra» saves nothing and closing asks nothing', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    const { onClose } = abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    expect(screen.getByRole('button', { name: 'Editar imagens e nota' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Fechar sem salvar?')).not.toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('«Registrar outra» from the summary saves nothing', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Registrar outra' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    expect(screen.queryByText(/Operação anterior/)).not.toBeInTheDocument()
  })

  it('an editor equal to the saved data is not pending', async () => {
    db.fetchTradeState.mockResolvedValue(operacaoTelas('operacao-mes-fechada'))
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.click(screen.getByRole('button', { name: 'Editar imagens e nota' }))
    expect(screen.getByRole('button', { name: 'Remover imagem MES_10-12_entrada.webp' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Registrar outra' }))
    expect(await screen.findByRole('heading', { level: 3, name: 'Entrada' })).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })

  it('the note goes trimmed; a double tap on «Salvar imagens e nota» saves once (C11)', async () => {
    db.fetchTradeState.mockResolvedValue(mesFechadaSemAnexos())
    const extras = estadoTelas('extras-mes')
    let finish: () => void = () => undefined
    save.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => (finish = resolve))
      return { state: extras, savedAt: extras.images[0].savedAt as Date, noteSavedAt: extras.trade.noteSavedAt, failed: [], savedIds: {} }
    })
    abrir(ids.trades.mes)
    await screen.findByRole('heading', { level: 3, name: 'Operação fechada' })
    await userEvent.type(screen.getByLabelText('Nota (opcional)'), '  Saí no stop.  ')
    await userEvent.dblClick(screen.getByRole('button', { name: 'Salvar imagens e nota' }))
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][2].note).toBe('Saí no stop.')
    await act(async () => finish())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar imagens e nota' })).toBeInTheDocument())
    expect(save).toHaveBeenCalledTimes(1)
  })
})
