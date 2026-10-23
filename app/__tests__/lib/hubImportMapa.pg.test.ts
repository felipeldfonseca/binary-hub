/**
 * @jest-environment node
 *
 * Phase 3b · telas, lane L1, against the real SQL of migrations 20261024000001..2 on a throwaway local Postgres (never the
 * hosted project; skipped unless BH_PG_URL and BH_PG_SHIFT_FILE are set, as hubImportColunas.pg.test.ts). Every board file
 * (testing/mapeadoTelas, invented) as lane L1 leaves it, the pre-fill of «mapa» and the board's answers:
 *   - the model «conferir» saves (modeloASalvar) is accepted by import_template_save (created), and read back
 *     (templateFromRow) it takes the same file as is: an exact match, porModelo, the same choices (escolhasDe);
 *   - an execution file, per end-of-file answer: import_preview counts E25's operations (trades_new), the partial exits
 *     (grouped = Σ (exits − 1)) and refuses exactly the lines «conferir» left out, as many as E24's nota says;
 *   - a trade file: the trades the commit stores carry the file's gross under the net answer «conferir» pre-answered.
 */
import { randomUUID } from 'crypto'
import fs from 'fs'
import { buildImportArgs, previewArgs, templateFromRow, type EndOfFileAnswer, type ImportFile, type MappedFile, type Template } from '@/lib/domain/import'
import type { AccountMarket } from '@/lib/domain/markets'
import { importCommit, importPreview, importUndo, type ImportPreviewResult } from '@/lib/hub/contasDb'
import {
  arquivoDoMapeamento,
  bloqueioDoConferir,
  bloqueioDoMapa,
  comDatas,
  comFimDoArquivo,
  comPalavraDeLado,
  comSeparador,
  escolhasDe,
  iniciarMapeamento,
  modeloASalvar,
  nomePadraoDoModelo,
  type ArquivoMapeavel,
  type Mapeamento,
} from '@/lib/hub/importMapeado'
import { vistaConferir } from '@/lib/hub/importMapaVista'
import { ARQUIVOS_QUADRO, CONTAS_QUADRO, CONTA_DO_ARQUIVO, type ArquivoQuadroKey } from '@/testing/mapeadoTelas'
import { PG_URL, createAccountAsUser, pgClient, psql } from '@/testing/pg'

jest.mock('@/lib/supabase', () => ({ createDataClient: jest.fn(() => ({})) }))
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, session: null }) }))

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE
const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip
const NY = 'America/New_York'

function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000)
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`)
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string)
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`)
}

type Arquivo = Exclude<ArquivoQuadroKey, 'f9ilegivel'>
const conta = (k: ArquivoQuadroKey) => CONTAS_QUADRO[CONTA_DO_ARQUIVO[k]]
const mercado = (k: ArquivoQuadroKey): AccountMarket => conta(k).market
const arquivo = (k: ArquivoQuadroKey): ArquivoMapeavel => ({
  fileName: ARQUIVOS_QUADRO[k].nome,
  size: ARQUIVOS_QUADRO[k].texto.length,
  sha256: 'ab'.repeat(32),
  text: ARQUIVOS_QUADRO[k].texto,
})

function mapear(k: ArquivoQuadroKey, templates: readonly Template[] = []): Mapeamento {
  const r = iniciarMapeamento(arquivo(k), { market: mercado(k), templates, nomePadrao: nomePadraoDoModelo(conta(k).platform) })
  if (!r.ok) throw new Error(r.error)
  return r.mapeamento
}

/** The board's answers on «mapa» (the date order of «Datas ambíguas», «Venda» for «X») */
function comoOQuadro(k: Arquivo): Mapeamento {
  const m = mapear(k)
  if (k === 'f18a') return comDatas(m, 'dmy', 'forex')
  if (k === 'f19' || k === 'f19p') return comPalavraDeLado(m, 'x', 'sell', 'b3')
  return m
}

const ARQUIVOS: Arquivo[] = ['f8', 'f8p', 'f15', 'f15b', 'f16t', 'f16ta', 'f16b', 'f16i', 'f16c', 'f17', 'f18', 'f18a', 'f19', 'f19p']

describePg('Phase 3b · telas L1 × the real SQL: the models «conferir» saves and the counts it shows', () => {
  const uid = randomUUID()
  const db = pgClient(uid)
  const acc: Partial<Record<AccountMarket, string>> = {}
  const sha = (k: string) => k.padEnd(64, '0').slice(0, 64).replace(/[^0-9a-f]/g, 'a')

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return
    fs.writeFileSync(SHIFT_FILE, '0\n')
    psql(`delete from public.trades where user_id = '${uid}';
delete from public.import_templates where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`)
  })

  async function saveTemplate(payload: unknown) {
    return (await (db.rpc('import_template_save', { p_template: payload, p_batch: null, p_replaces: null }) as unknown as PromiseLike<{
      data: { template_id: string; header_sig: string; created: boolean } | null
      error: { message: string; hint: string | null } | null
    }>)) as { data: { template_id: string; header_sig: string; created: boolean } | null; error: { message: string; hint: string | null } | null }
  }

  async function templateRow(id: string): Promise<Template> {
    const r = await (db.from('import_templates').select('*').eq('id', id) as unknown as PromiseLike<{ data: unknown[]; error: unknown }>)
    if (r.error) throw new Error(JSON.stringify(r.error))
    const t = templateFromRow(r.data[0])
    if (!t) throw new Error('model row not usable')
    return t
  }

  const preview = async (accountId: string, k: Arquivo, file: ImportFile, tz: string) =>
    (await importPreview(
      db,
      previewArgs(buildImportArgs({ accountId, platform: 'modelo', fileName: ARQUIVOS_QUADRO[k].nome, sha256: sha(k), fileTz: tz, outcome: file })),
    )) as ImportPreviewResult

  it('Thu 15 Oct 11:00 ET: the user and one account per market', async () => {
    setClock('2026-10-15T15:00:00Z')
    psql(`insert into auth.users (id, email) values ('${uid}', 'mapa-${uid.slice(0, 8)}@example.test');`)
    const mk = (market: AccountMarket, label: string, platform: string, primary = false) =>
      createAccountAsUser(uid, { market, label, platform, firm: null, external_ref: null, phase: 'pessoal', size: null, is_primary: primary })
    acc.futures = await mk('futures', 'Ylos 50k', 'blackarrow', true)
    acc.forex = await mk('forex', 'E8 50k', 'matchtrader')
    acc.stocks = await mk('stocks', 'IBKR', 'ibkr')
    acc.crypto = await mk('crypto', 'Binance', 'binance')
    acc.b3 = await mk('b3', 'Mini-índice', 'profit')
    expect(Object.keys(acc)).toHaveLength(5)
  })

  it.each(ARQUIVOS)('%s: the model «conferir» saves is accepted, and read back it takes the file as is', async (k) => {
    const m = comoOQuadro(k)
    expect([bloqueioDoMapa(m, mercado(k)), bloqueioDoConferir(m, mercado(k))]).toEqual([null, null])
    const s = modeloASalvar(m, { tzHint: conta(k).file_tz, rota: null })
    if (!s) throw new Error('nothing to save')
    expect(s.tipo).toBe('salvo')
    const saved = await saveTemplate(s.payload)
    expect(saved.error).toBeNull()
    expect(saved.data).toMatchObject({ header_sig: m.lido.sig, created: true })
    const modelo = await templateRow(saved.data!.template_id)
    expect(modelo.name).toBe(s.nome)
    const r = mapear(k, [modelo])
    expect([r.match.kind, r.porModelo, r.origem]).toEqual(['exact', true, 'modelo'])
    expect(r.inicio).toBe(['f16ta', 'f16b', 'f16c'].indexOf(k) >= 0 ? 'conferir' : 'previa')
    expect(escolhasDe(r)).toEqual(escolhasDe(m))
    psql(`delete from public.import_templates where id = '${saved.data!.template_id}';`)
  })

  const FIM: [Arquivo, string, EndOfFileAnswer[]][] = [
    ['f16t', '', ['unknown']],
    ['f16ta', 'MESZ6', ['unknown', 'yes', 'no']],
    ['f16b', 'ETHUSDT', ['unknown', 'yes', 'no']],
    ['f16i', '', ['unknown']],
  ]
  it.each(FIM)('%s: per end-of-file answer, the preview counts what «conferir» shows', async (k, chave, respostas) => {
    const market = mercado(k)
    const accountId = acc[market] as string
    for (const resposta of respostas) {
      const m = chave ? comFimDoArquivo(comoOQuadro(k), chave, resposta) : comoOQuadro(k)
      const v = vistaConferir(m, market)
      const tz = k === 'f16b' ? 'UTC' : NY
      const f = arquivoDoMapeamento(m, market, tz) as MappedFile
      expect(f.ok).toBe(true)
      const p = await preview(accountId, k, f, tz)
      const n = f.positions.length
      expect(v.pareamento?.resumo).toMatch(new RegExp(`^Vira(m)? ${n} operaç`))
      expect(p.trades_new ?? p.new).toBe(n)
      expect(p.grouped ?? 0).toBe(f.positions.reduce((s, x) => s + x.exits.length - 1, 0))
      expect(p.errors).toEqual(f.errors.map((e) => ({ line: e.line, code: e.code })))
      // E24's nota counts the lines the database refuses for the symbol
      const q = v.perguntasFim[0]
      if (q && resposta === 'unknown') {
        expect(q.nota).toContain(`As ${p.errors.filter((e) => e.code === 'unbalanced_symbol').length} execuções de ${chave}`)
      }
      if (q && resposta === 'yes') {
        expect(q.nota).toContain(`(${p.errors.filter((e) => e.code === 'open_at_end').length} execução)`)
      }
      if (q && resposta === 'no') expect(p.errors.filter((e) => e.code === 'opened_before_file')).toHaveLength(1)
    }
  })

  // ------------------------------------------------------------------------------------------------
  // Reviews 1 and 2 of lane L1, on the real SQL
  // ------------------------------------------------------------------------------------------------

  /** An invented file mapped from the names, in the futures account */
  function mapearTexto(texto: string): { m: Mapeamento; a: ArquivoMapeavel } {
    const a: ArquivoMapeavel = { fileName: 'inventado.csv', size: texto.length, sha256: 'cd'.repeat(32), text: texto }
    const r = iniciarMapeamento(a, { market: 'futures', templates: [], nomePadrao: 'Minha plataforma' })
    if (!r.ok) throw new Error(r.error)
    return { m: r.mapeamento, a }
  }
  const previewTexto = async (file: ImportFile) =>
    (await importPreview(
      db,
      previewArgs(buildImportArgs({ accountId: acc.futures as string, platform: 'modelo', fileName: 'inventado.csv', sha256: 'cd'.repeat(32), fileTz: NY, outcome: file })),
    )) as ImportPreviewResult

  it('review 2 · 1: a «;» file first read with «,» from its first trade: after «;» every trade reaches the preview', async () => {
    const linhas = [
      '13/10/2026 09:30:00;MESZ6;C;1;6801,25;6802,50;6,25;',
      '13/10/2026 09:41:12;MESZ6;V;2;6803,00;6801,75;2,50;',
      '13/10/2026 10:02:45;MNQZ6;C;1;25140,25;25146,50;12,50;',
      '14/10/2026 09:35:10;MESZ6;C;1;6810,00;6808,75;-6,25;',
      '14/10/2026 10:11:30;MNQZ6;V;1;25160,00;25151,25;17,50;',
      '15/10/2026 09:48:02;MESZ6;V;3;6799,50;6797,00;37,50;',
      '15/10/2026 11:20:40;MNQZ6;C;2;25101,75;25099,00;-11,00;',
      '16/10/2026 09:31:05;MESZ6;C;1;6820,25;6825,00;23,75;',
    ]
    const { m, a } = mapearTexto(['Data;Ativo;Lado;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.', ...linhas].join('\n'))
    expect([m.lido.delimiter, m.lido.records.length]).toEqual([',', 7])
    const n = comSeparador(m, a, ';', 'futures')
    expect([bloqueioDoMapa(n, 'futures'), bloqueioDoConferir(n, 'futures')]).toEqual([null, null])
    const f = arquivoDoMapeamento(n, 'futures', NY) as MappedFile
    const p = await previewTexto(f)
    expect([p.trades_new ?? p.new, p.errors]).toEqual([8, []])
    // The model it saves keeps the file's real names
    const s = modeloASalvar(n, { tzHint: NY, rota: null })
    const saved = await saveTemplate(s?.payload)
    expect(saved.error).toBeNull()
    expect((await templateRow(saved.data!.template_id)).headers).toEqual(['data', 'ativo', 'lado', 'qtd', 'pr. entrada', 'pr. saida', 'res. liq.'])
    psql(`delete from public.import_templates where id = '${saved.data!.template_id}';`)
  })

  /** [case, executions, answer, E24's nota, E25's resumo] */
  const SOBRA: [string, string[], EndOfFileAnswer, string, string][] = [
    [
      'Buy 3, Sell 2, «Sim»',
      ['2026-10-13 10:31:05,MESZ6,Buy,3,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,2,6815.25'],
      'yes',
      'A posição ainda aberta fica de fora (2 execuções) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
      'Nenhuma operação: todas as execuções ficaram de fora.',
    ],
    [
      'Buy 2, Sell 1, Buy 1, «Sim»',
      ['2026-10-13 10:31:05,MESZ6,Buy,2,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,1,6815.25', '2026-10-13 10:51:05,MESZ6,Buy,1,6816.25'],
      'yes',
      'A posição ainda aberta fica de fora (3 execuções) e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
      'Nenhuma operação: todas as execuções ficaram de fora.',
    ],
    [
      'Buy 1, Sell 2, «Sim»',
      ['2026-10-13 10:31:05,MESZ6,Buy,1,6812.25', '2026-10-13 10:41:05,MESZ6,Sell,2,6815.25'],
      'yes',
      'A parte ainda aberta da posição (1 contrato) fica de fora e entra quando você importar um arquivo que tenha a abertura e o fechamento.',
      'Vira 1 operação, com uma saída.',
    ],
    [
      'Sell 2, Buy 1, «Não»',
      ['2026-10-13 10:31:05,MESZ6,Sell,2,6812.25', '2026-10-13 10:41:05,MESZ6,Buy,1,6810.25'],
      'no',
      'O arquivo começou com 1 contrato comprado, de antes dele: a parte da venda que o fecha fica de fora.',
      'Vira 1 operação, com uma saída.',
    ],
    [
      'Sell 1, Buy 1, Sell 1, «Não»',
      ['2026-10-13 10:31:05,MESZ6,Sell,1,6812.25', '2026-10-13 10:41:05,MESZ6,Buy,1,6810.25', '2026-10-13 10:51:05,MESZ6,Sell,1,6811.25'],
      'no',
      'O arquivo começou com 1 contrato comprado, de antes dele: a venda que o fecha fica de fora.',
      'Vira 1 operação, com uma saída.',
    ],
  ]
  it.each(SOBRA)('review 2 · 2: %s: E24’s nota says what the database leaves out; E25 counts what it takes', async (_caso, linhas, resposta, nota, resumo) => {
    const { m: m0 } = mapearTexto(['Fill Time,Contract,B/S,Filled Qty,Avg Fill Price', ...linhas].join('\n'))
    const m = comFimDoArquivo(m0, 'MESZ6', resposta)
    expect(m.rowKind).toBe('fill')
    const v = vistaConferir(m, 'futures')
    expect([v.perguntasFim[0].nota, v.pareamento?.resumo]).toEqual([nota, resumo])
    const f = arquivoDoMapeamento(m, 'futures', NY) as MappedFile
    const p = await previewTexto(f)
    expect(p.trades_new ?? p.new).toBe(f.positions.length)
    expect(p.errors).toEqual(f.errors.map((e) => ({ line: e.line, code: e.code })))
    const code = resposta === 'yes' ? 'open_at_end' : 'opened_before_file'
    const recusadas = p.errors.filter((e) => e.code === code).length
    if (recusadas === 0) expect(nota).toContain('parte')
    else expect(nota).toMatch(resposta === 'yes' ? new RegExp(`\\(${recusadas} execuç`) : /a venda que o fecha/)
  })

  it('review 2 · 3: a model of 21 answered side words, or one of 41 characters, is accepted (the rest stay this file’s)', async () => {
    const palavras = Array.from({ length: 21 }, (_, i) => `w${String(i).padStart(2, '0')}`)
    const longa = 'compra a mercado com stop e alvo definidos'
    const linhas = Array.from({ length: 61 }, (_, i) => {
      const lado = i < 39 ? (i % 2 === 0 ? 'Buy' : 'Sell') : i < 60 ? palavras[i - 39] : longa
      const min = String(i % 60).padStart(2, '0')
      return `2026-10-13 ${i < 60 ? '10' : '11'}:${min}:05,2026-10-13 ${i < 60 ? '10' : '11'}:${min}:45,MESZ6,${lado},1,5.00`
    })
    let { m } = mapearTexto(['Entry Time,Exit Time,Symbol,Side,Qty,Profit', ...linhas].join('\n'))
    for (const w of [...palavras, longa]) m = comPalavraDeLado(m, w, 'buy', 'futures')
    expect([bloqueioDoMapa(m, 'futures'), bloqueioDoConferir(m, 'futures')]).toEqual([null, null])
    const s = modeloASalvar(m, { tzHint: NY, rota: null })
    expect(Object.keys(s?.payload.side_words ?? {})).toHaveLength(20)
    const saved = await saveTemplate(s?.payload)
    expect(saved.error).toBeNull()
    expect(saved.data?.created).toBe(true)
    psql(`delete from public.import_templates where id = '${saved.data!.template_id}';`)
    const p = await previewTexto(arquivoDoMapeamento(m, 'futures', NY) as MappedFile)
    expect([p.trades_new ?? p.new, p.errors]).toEqual([61, []])
  })

  const BRUTO: [Arquivo, string, string][] = [
    ['f8', '41.25', '26.04'],
    ['f17', '327.75', '81.84'],
    ['f18', '212.40', '40.25'],
    ['f19', '412.00', '22.50'],
  ]
  it.each(BRUTO)('%s: the trades the commit stores carry the file’s gross under the pre-answered net question', async (k, bruto, custos) => {
    const market = mercado(k)
    const m = comoOQuadro(k)
    const f = arquivoDoMapeamento(m, market, conta(k).file_tz) as MappedFile
    expect(f.notices).toContainEqual({ code: 'commission_in_file', gross: bruto, commission: custos })
    const args = buildImportArgs({ accountId: acc[market] as string, platform: 'modelo', fileName: ARQUIVOS_QUADRO[k].nome, sha256: sha(k), fileTz: conta(k).file_tz, outcome: f })
    const commit = await importCommit(db, args)
    expect(commit.batch_id).not.toBeNull()
    const soma = psql(`select coalesce(sum(pnl), 0)::numeric(18,2)::text || ' ' || coalesce(sum(commission), 0)::numeric(18,2)::text from public.trades where import_batch_id = '${commit.batch_id}';`).trim()
    expect(soma).toBe(`${bruto} ${custos}`)
    await importUndo(db, commit.batch_id as string)
  })
})
