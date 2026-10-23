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
