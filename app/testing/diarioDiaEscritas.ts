/**
 * The drill's writes on the boards' scenarios (Fase 4 · telas, lane L2): add_marks and save_extras answered as the
 * database would, on the scenario's answers of testing/diarioTelas (`cru`), so the day read after them shows what was
 * written. A mark's «limpa» is the domain's twin of the server's rule (registro.isClean with the first exit's cut).
 * Lives outside __tests__ so Jest does not run it as a suite; the test file declares the mock block of
 * testing/diarioTelasMocks. Invented data only.
 */
import { firstExitCut, isClean } from '@/lib/domain/registro'
import { parseTradeState } from '@/lib/hub/registrarDb'
import type { DiarioRenderizado } from './diarioTelas'
import { mocks } from './diarioTelas'

type Json = Record<string, any>

/** The raw trade (diario_dia's trades[] object) of a trade id, in any day of any account of the render */
export function tradeCru(r: Pick<DiarioRenderizado, 'cru'>, tradeId: string): Json | null {
  for (const c of Object.values(r.cru)) {
    for (const dia of Object.values(c.dias)) {
      const t = (dia.trades as Json[]).find((x) => x.trade_id === tradeId)
      if (t) return t
    }
  }
  return null
}

let seq = 5000

/** add_marks and save_extras keep what they write; returns the calls' spies */
export function escritasDoDrill(r: Pick<DiarioRenderizado, 'cru'>) {
  mocks.addMarks.mockReset().mockImplementation(async (_db, tradeId, payload) => {
    const raw = tradeCru(r, tradeId)
    if (!raw) throw new Error(`escritasDoDrill: trade ${tradeId} is not in the scenario`)
    const agora = new Date()
    const s = parseTradeState({ ...raw, server_now: agora.toISOString() })
    const limpa = isClean(agora, {
      origin: s.context?.origin ?? null,
      exitTime: s.trade.exitTime,
      expiresAt: s.trade.expiresAt,
      exitRegisteredAt: s.trade.exitRegisteredAt,
      firstExit: firstExitCut(s.exits),
    })
    const marks = ((payload as unknown as { marks?: Record<string, string | null> }).marks ?? {}) as Record<string, string | null>
    for (const [kind, value] of Object.entries(marks)) {
      if (kind === 'v' || kind === 'client_key') continue
      raw.marks = [...(raw.marks ?? []), { id: ++seq, kind, limpa, value, marked_at: agora.toISOString() }]
      const anterior = (raw.marks_now ?? []).find((m: Json) => m.kind === kind) ?? null
      const limpas = (raw.marks as Json[]).filter((m) => m.kind === kind && m.limpa)
      const clean = limpas.length ? limpas[limpas.length - 1] : null
      const novo = {
        kind,
        clean_at: clean?.marked_at ?? null,
        current_at: agora.toISOString(),
        clean_value: clean?.value ?? null,
        changed_after: !!clean && !limpa && clean.value !== value,
        current_limpa: limpa,
        current_value: value,
      }
      raw.marks_now = [...(raw.marks_now ?? []).filter((m: Json) => m !== anterior), novo]
    }
    return parseTradeState({ ...raw, server_now: agora.toISOString() })
  })
  mocks.saveExtras.mockReset().mockImplementation(async (_db, tradeId, payload) => {
    const raw = tradeCru(r, tradeId)
    if (!raw) throw new Error(`escritasDoDrill: trade ${tradeId} is not in the scenario`)
    const agora = new Date().toISOString()
    const p = payload as { note?: string | null; images?: string[] }
    if (p.images) raw.images = (raw.images as Json[]).filter((i) => p.images!.includes(i.id))
    if ('note' in p) {
      raw.trade = { ...raw.trade, note: p.note ?? null, note_saved_at: p.note ? agora : null }
    }
    const state = parseTradeState({ ...raw, server_now: agora })
    return { state, savedAt: new Date(agora), noteSavedAt: p.note ? new Date(agora) : null, trash: [] }
  })
  return { addMarks: mocks.addMarks, saveExtras: mocks.saveExtras }
}
