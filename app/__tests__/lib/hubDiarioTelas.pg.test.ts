/**
 * @jest-environment node
 *
 * Fase 4 · telas, lane L2: the open day's screens against the real SQL (contract §8.2), on a throwaway local Postgres
 * whose clock the suite moves between steps (the PG runner of .claude/ferramentas/pg). Skipped unless both are set
 * (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   BH_PG_SHIFT_FILE=/path/shift
 *
 * Every read and write goes through lib/hub/diarioDb and lib/hub/registrarDb (the stand-in client of testing/pg runs
 * them as the user), and every answer is worded by the Diário's producers (lib/hub/diario, lib/hub/diarioOperacao).
 * Invented user and data, October 2026, Top One (Futuros, ET; rules from Wed 14 Oct 09:12):
 *
 *   Thu 15 Oct 11:30  a «Já fechada» for yesterday built by the sheet's own form helper (M1's path): 14 Oct shows it
 *                     with «Registrada depois» and the calendar counts it
 *   Thu 15 Oct        a live MES (10:05–10:20), the review at 16:00, edited at 16:30 (I3, I4, I6)
 *   Fri 16 Oct 17:00  the broker's file completes the live MES with its commission and brings a trade of its own:
 *                     «Depois da revisão, o dia mudou: …», «Completada pelo arquivo de 16 out: …»; marks and a note on
 *                     the file's trade without the sheet (the drill's words, «depois do resultado»)
 *   Mon 19 Oct        «Antes de operar» today, then not_today on another day; a «Já fechada» deleted on the old page (G13)
 */
import { createHash, randomUUID } from 'crypto'
import fs from 'fs'
import { notePayload, reviewPayload } from '@/lib/domain/diario'
import { buildImportArgs, parseImportText, previewArgs, type ImportFile, type ParsedFile } from '@/lib/domain/import'
import { afterPayload, entryPayload, exitPayload, extrasPayload, marksPayload } from '@/lib/domain/registro'
import { MON_TO_FRI } from '@/lib/domain/tempo'
import { importCommit, importPreview } from '@/lib/hub/contasDb'
import { apagadasTexto, diaMudouTexto, linhaDaRevisao, notaAntesDeOperar, tituloDaVersao, versoesBotao, type ContaDiario } from '@/lib/hub/diario'
import { fetchCalendario, fetchDia, saveDayNote, saveDayReview } from '@/lib/hub/diarioDb'
import { fatosDaOperacao, linhasDaOperacao, marcasDaOperacao, origemDaOperacao, quandoAnexos } from '@/lib/hub/diarioOperacao'
import { addMarks, newClientKey, registerAfter, registerEntry, registerExit, saveExtras } from '@/lib/hub/registrarDb'
import { contaReg } from '@/lib/hub/registrarForm'
import { dayChanged, firstEntryAt, previousVersions } from '@/lib/domain/diario'
import { PG_URL, asUser, asUserExec, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg'

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE
const NY = 'America/New_York' as const
const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip

function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000)
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`)
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string)
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`)
}

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const sp = <T,>(x: T): T => JSON.parse(JSON.stringify(x).replace(/ /g, ' '))

/** A Top One Trade History (UTC): [ticket, side, open, open price, close, close price, PnL, commission] */
const topOneCsv = (rows: [string, 'BUY' | 'SELL', string, string, string, string, string, string][]) =>
  [
    'Ticket #,Symbol,Side,SL,TP,Open Time,Open Price,Close Time,Close Price,Duration,PnL,Lots,Commissions,Gain',
    ...rows.map(([t, side, o, op, c, cp, pnl, comm]) => `MESZ6/${t},MESZ6,${side},0,0,${o},${op},${c},${cp},10m 0s,${pnl},1,${comm},0.02%`),
  ].join('\n')

describePg('Fase 4 · telas × the real SQL: the open day’s words', () => {
  const uid = randomUUID()
  const db = pgClient(uid)
  let top = ''
  const trades: Record<string, string> = {}
  const TOP: ContaDiario = { currency: 'USD', market: 'futures', tz: NY }
  const conta = () => ({ market: 'futures' as const, currency: 'USD' as const, tz: NY, reg: contaReg({ id: top, label: 'Top One #1', market: 'futures', platform: 'topone' }, null, '2026-10-14') })

  async function importar(text: string, name: string) {
    const parsed = parseImportText(text)
    if (!parsed.ok || parsed.platform !== 'topone') throw new Error('not a Top One file')
    const args = buildImportArgs({ accountId: top, platform: 'topone', fileName: name, sha256: sha(text), fileTz: 'UTC', outcome: parsed as ParsedFile as ImportFile })
    const preview = await importPreview(db, previewArgs(args))
    const commit = await importCommit(db, args)
    expect(preview.new).toBe(commit.inserted)
    return commit
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return
    fs.writeFileSync(SHIFT_FILE, '0\n')
    psql(`delete from public.trades where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`)
  })

  it('Wed 14 Oct 09:12 ET: the account and its rules', async () => {
    setClock('2026-10-14T13:00:05Z')
    psql(`insert into auth.users (id, email) values ('${uid}', 'telas-${uid.slice(0, 8)}@example.test');
insert into public.hub_members (user_id) values ('${uid}');`)
    top = await createAccountAsUser(uid, { market: 'futures', label: 'Top One #1', platform: 'topone', firm: null, external_ref: null, phase: 'financiada', size: null, is_primary: true })
    setClock('2026-10-14T13:12:05Z')
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        accounts: {
          [top]: {
            rules: { v: 1, window_rule: { on: true, outside: 'fora' }, limit: { usd: 400, mode: 'conta', at_limit: 'encerrar' }, breakeven: { on: true, by: { MES: 8 } } },
            window: { tz: NY, start_min: 600, end_min: 660, weekdays: MON_TO_FRI },
            version: 'force',
          },
        },
      })})`,
    )
  })

  it('Thu 15 Oct 11:30: a «Já fechada» for yesterday (M1’s path): 14 Oct shows it, «Registrada depois», and the calendar counts it', async () => {
    setClock('2026-10-15T15:30:05Z')
    const r = await registerAfter(
      db,
      top,
      afterPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7000.00', stop: '10', clock: NY, day: '2026-10-14', entry: '10:15', exit: '10:40', exitPrice: '7006.00', allowSimilar: true }),
    )
    trades.ontem = r.state.trade.id
    const d = await fetchDia(db, top, '2026-10-14')
    const t = d.trades.find((x) => x.trade.id === trades.ontem)!
    expect(origemDaOperacao(t)).toBe('Registrada depois')
    expect(linhasDaOperacao(t, conta())[0]).toBe('Registrada às 11:30, depois do resultado: as marcas contam como depois do resultado.')
    expect(sp(fatosDaOperacao(t, conta()))).toEqual([
      ['Hora', '10:15–10:40'],
      ['Entrada → saída', '7.000,00 → 7.006,00 · +6,00 pts'],
      ['Stop · alvo', 'stop 10 pts · registrado depois'],
      ['R', '+0,6 R · com stop de 10 pts'],
      ['Resultado', '+US$ 30,00'],
      ['Comissão', 'ainda não chegou: o resultado está bruto até o arquivo da corretora.'],
      ['Posso operar hoje?', 'Liberado'],
    ])
    const c = await fetchCalendario(db, top)
    expect(c.days.find((x) => x.day === '2026-10-14')).toMatchObject({ n: 1, app: 1 })
  })

  it('Thu 15 Oct: a live MES, the review at 16:00 edited at 16:30: the line, the frozen facts, «Versões anteriores (1)»', async () => {
    setClock('2026-10-15T14:05:05Z')
    const e = await registerEntry(db, top, entryPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7000.00', stop: '10', target: '20', clock: NY, marks: { setup: 'A' } }))
    trades.live = e.state.trade.id
    setClock('2026-10-15T14:20:05Z')
    await registerExit(db, trades.live, exitPayload('futures', { exitPrice: '7010.00', exit: '10:20', clock: NY }))
    setClock('2026-10-15T20:00:05Z')
    await saveDayReview(db, top, '2026-10-15', reviewPayload({ worked: 'Esperei o reteste.', differently: '', followed: 'sim', carryForward: 'Uma por vez.' }, newClientKey()))
    setClock('2026-10-15T20:30:05Z')
    await saveDayReview(db, top, '2026-10-15', reviewPayload({ worked: 'Esperei o reteste.', differently: 'Nada.', followed: 'em_parte', carryForward: 'Uma por vez.' }, newClientKey()))
    const d = await fetchDia(db, top, '2026-10-15')
    const r = d.review!
    expect(linhaDaRevisao(r, d.day, NY)).toBe('Salva às 16:00 · editada às 16:30 · Seguiu o plano? Em parte · pela sua resposta, depois do resultado')
    expect(versoesBotao(r.previous.length, false)).toBe('Versões anteriores (1)')
    expect(previousVersions(r).map((v) => tituloDaVersao(v, d.day, NY))).toEqual(['Salva às 16:00'])
    expect(dayChanged(r.autoSummary, d.facts)).toBe(false)
  })

  it('Fri 16 Oct 17:00: the file completes the live MES and brings its own trade: «o dia mudou», «Completada pelo arquivo de 16 out: …»; marks and a note on the file’s trade', async () => {
    setClock('2026-10-16T21:00:05Z')
    await importar(
      topOneCsv([
        ['910000000001', 'BUY', '15/10/2026 14:05:00', '7000', '15/10/2026 14:20:00', '7010', '$50', '1.24'],
        ['910000000002', 'SELL', '15/10/2026 15:30:00', '7012', '15/10/2026 15:36:00', '7015', '-$15', '1.24'],
      ]),
      'top_1015.csv',
    )
    const d = await fetchDia(db, top, '2026-10-15')
    expect(dayChanged(d.review!.autoSummary, d.facts)).toBe(true)
    expect(sp(diaMudouTexto(d.facts, TOP))).toBe('Depois da revisão, o dia mudou: agora 2 operações, +US$ 32,52.')
    const live = d.trades.find((t) => t.trade.id === trades.live)!
    expect(sp(linhasDaOperacao(live, conta()))).toContain('Completada pelo arquivo de 16 out: comissão US$ 1,24.')
    expect(sp(fatosDaOperacao(live, conta()))).toContainEqual(['Resultado', '+US$ 48,76 · bruto +US$ 50,00'])
    const arquivo = d.trades.find((t) => t.trade.id !== trades.live)!
    expect(origemDaOperacao(arquivo)).toBe('Do arquivo')
    expect(linhasDaOperacao(arquivo, conta())).toEqual(['Sem registro no app: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.'])

    setClock('2026-10-16T21:05:05Z')
    await addMarks(db, arquivo.trade.id, marksPayload({ setup: 'C' }))
    await saveExtras(db, arquivo.trade.id, extrasPayload({ note: 'Entrei fora da janela.' }))
    const d2 = await fetchDia(db, top, '2026-10-15')
    const a2 = d2.trades.find((t) => t.trade.id === arquivo.trade.id)!
    expect(marcasDaOperacao(a2, conta().reg)[0]).toMatchObject({ valor: 'C', tempo: '16 out às 17:05 · depois do resultado' })
    expect(quandoAnexos(a2, NY)).toBe('salva em 16 out, às 17:05 · depois do resultado')
    // the live trade's own mark, made at its entry, before the exit
    const l2 = d2.trades.find((t) => t.trade.id === trades.live)!
    expect(marcasDaOperacao(l2, conta().reg)[0]).toMatchObject({ valor: 'A', tempo: 'às 10:05 · antes da saída' })
  })

  it('Mon 19 Oct: «Antes de operar» today (then not_today on another day); a «Já fechada» deleted on the old page', async () => {
    setClock('2026-10-19T13:30:05Z')
    const n = await saveDayNote(db, top, '2026-10-19', notePayload('Só compro acima da VWAP.', newClientKey()))
    expect(n.note?.text).toBe('Só compro acima da VWAP.')
    await expect(saveDayNote(db, top, '2026-10-16', notePayload('x', newClientKey()))).rejects.toMatchObject({ code: 'not_today' })
    setClock('2026-10-19T15:40:05Z')
    const v = await registerAfter(
      db,
      top,
      afterPayload('futures', { clientKey: newClientKey(), symbol: 'MES', direction: 'long', quantity: '1', entryPrice: '7000.00', clock: NY, day: '2026-10-19', entry: '10:10', exit: '10:20', exitPrice: '7002.00', allowSimilar: true }),
    )
    setClock('2026-10-19T15:45:05Z')
    asUserExec(uid, `delete from public.trades where id = '${v.state.trade.id}';`)
    const d = await fetchDia(db, top, '2026-10-19')
    expect(d.trades).toHaveLength(0)
    expect(apagadasTexto(d.deleted, NY)).toBe('1 operação registrada foi apagada às 11:45.')
    expect(notaAntesDeOperar(d.note!, firstEntryAt([]), NY)).toBe('anotado às 09:30, antes da 1ª entrada')
  })
})
