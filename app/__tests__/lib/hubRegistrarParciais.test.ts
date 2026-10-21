/**
 * Phase 3c · lane C1: lib/hub/registrarParciais against the approved board's strings
 * (RegistrarOperacao.dc.html, 21 Oct 2026). The states are the domain's recordings
 * (testing/fixtures/parciais) or, where a recording differs from the board, the composed states of
 * testing/parciaisTelas (contract §8 table): scenario 14's exit with only the 10:19 breakeven, its
 * 10:30 variant, scenario 16 moved by −28 min, scenario 6's 0,50 / 0,25 lot; the recorded values are
 * checked too, each from its own fixture. The 3-4 markets compose partials and moves with the
 * domain's own functions on their recorded entries.
 */
import { MAX_STOP_MOVES, movePayload, partialPayload, validateMove, validatePartial, type MovePayload } from '@/lib/domain/registro'
import { parseRulesNow, type AccountNow } from '@/lib/hub/regras'
import { contaReg, modeloSaida, type ContaReg } from '@/lib/hub/registrarForm'
import {
  CAMPOS_PARCIAL,
  CAMPOS_STOP,
  cartaoComParciais,
  desfazerEvento,
  lerDinheiroSinal,
  lerPreco,
  lerQuantidadeTexto,
  linhaDepoisComParciais,
  linhaDoTempo,
  linhaEscolhaComParciais,
  modeloAgora,
  modeloMoverStop,
  modeloParcial,
  modosDaAberta,
  notaPrimeiraParcial,
  perguntaDesfazerEntrada,
  regraNoResumo,
  saidaComParciais,
  subDaPonte,
  sugestaoBreakeven,
  textoDepoisDoUndo,
  textoParcialRegistrada,
  textoStopRegistrado,
  type CamposParcial,
  type CamposStop,
} from '@/lib/hub/registrarParciais'
import { formaDoAtivo } from '@/lib/hub/registrarAtivos'
import type { TradeState, TradeView } from '@/lib/hub/registrarDb'
import { idsParciais } from '@/testing/parciais'
import {
  agoraParciais,
  comMovimento,
  comParcial,
  contasParciais,
  desfeitaMnq,
  desfeitaParciais,
  entradaMercado,
  entradaMercadoJson,
  eurAntesDaParcial,
  estadoJson,
  etEm,
  fechadaParciais,
  mesAntesDaParcial,
  mesBeUmaSaida,
  mgcUmaSaida,
  mnqAntesDaParcial,
  mnqFechadaS14,
  parcialEur,
  parcialMnq,
  parcialParciais,
  saidaMesComBe,
  saidaMesPassou,
  saidaParciais,
  stopMesPassou,
  stopParciais,
  vistaDe,
  vistaRowsParciais,
} from '@/testing/parciaisTelas'
import { agoraMercados, contasMercados, idsMercados, type MercadosAgora } from '@/testing/registrarMercados'

const ids = idsParciais()
const agora0900 = parseRulesNow(estadoJson('agora-sex-0900'))
const contaDe = (id: string, agora = agora0900): ContaReg => {
  const a = agora.accounts.find((x) => x.accountId === id)!
  const row = contasParciais().find((c) => c.id === id)!
  return contaReg(row, a.rules, a.desdeDay)
}
const top = contaDe(ids.accounts.topOne)
const apex = contaDe(ids.accounts.apex)
const ftmo = contaDe(ids.accounts.ftmo)
const at = (hm: string, s = 0) => new Date(etEm(hm, s))
const v = (s: TradeState): TradeView => vistaDe(s)
const CP = (patch: Partial<CamposParcial> = {}): CamposParcial => ({ ...CAMPOS_PARCIAL, ...patch })
/** The money as formatMoney writes it: a no-break space after «US$» / «R$» (the board's `NB`) */
const nb = (x: string) => x.replace(/(US\$|R\$) /g, '$1\u00a0')
const CS = (patch: Partial<CamposStop> = {}): CamposStop => ({ ...CAMPOS_STOP, ...patch })

const idsM = idsMercados()
function contaMercado(n: MercadosAgora, id: string): { conta: ContaReg; agora: AccountNow } {
  const agora = agoraMercados(n).accounts.find((a) => a.accountId === id)!
  const row = contasMercados().find((c) => c.id === id)!
  return { conta: contaReg(row, agora.rules, agora.desdeDay), agora }
}
const fx = contaMercado('ftmo-qui-0840', idsM.accounts.ftmo).conta
const ibkr = contaMercado('ibkr-qui-0952', idsM.accounts.ibkr).conta
const binance = contaMercado('binance-sab-2035', idsM.accounts.binance).conta
const clear = contaMercado('clear-qui-1020', idsM.accounts.clear).conta

// ------------------------------------------------------------------------------------------------
// Scenario 14 · MES Compra 3 ct a 7.912,50 às 10:12, stop 10, alvo 20; rule MES +8
// ------------------------------------------------------------------------------------------------

describe('scenario 14 · step 2 before and after «Parcial»', () => {
  const antes = v(mesAntesDaParcial())
  const depois = parcialParciais('partial-mes')

  it('offers Saída · Parcial · Mover stop, and the rule line while the stop is behind the entry', () => {
    expect(modosDaAberta(top, antes)).toEqual(['saida', 'parcial', 'stop'])
    expect(regraNoResumo(top, antes)).toBe('Sua regra: breakeven com +8 pts, em 7.920,50.')
    expect(modeloAgora(top, antes)).toBeNull()
    expect(notaPrimeiraParcial(top, antes)).toBeNull()
  })

  it('«Parcial»: chips 1 2 (3 open), the first pressed, the preview, «Ficam 2 ct em aberto.», the payload', () => {
    const now = at('10:18')
    const vazio = modeloParcial(top, antes, CP(), now, false)!
    expect(vazio.chips).toMatchObject({ valores: ['1', '2'], outro: false, escolhido: '1', outroAberto: false })
    expect(vazio.rotuloQtd).toBe('Contratos')
    expect(vazio.metade).toBeNull()
    expect(vazio.ficam).toBe('Ficam 2 ct em aberto.')
    expect(vazio.bloco.linha).toBe('Resultado: informe o preço da parcial.')
    expect(vazio.rotulos).toEqual({ preco: 'Preço da parcial', hora: 'Hora da parcial (ET)' })
    expect(vazio.horaCampo).toBe('10:18')
    const m = modeloParcial(top, antes, CP({ preco: '7920,50' }), now, false)!
    expect(m.bloco.linha).toBe(nb('Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00'))
    expect(m.bloco.corrigir).toBeNull()
    expect(m.erros).toEqual({})
    expect(m.campos).toEqual({ quantity: '1', exitPrice: '7920.5', exit: undefined, clock: 'America/New_York', pnl: undefined })
    const p = partialPayload({ clientKey: '00000000-0000-4000-8000-000000000001', ...m.campos! })
    const domain = validatePartial(
      { market: 'futures', symbol: 'MES', direction: 'long', quantity: '3', entryPrice: '7912.5', entryTime: antes.trade.entryTime, status: 'open', option: null, registeredInApp: true },
      [],
      p,
      { now },
    )
    expect(domain.ok && domain.exit.pnl).toBe('40')
    expect(modeloParcial(top, antes, CP({ chip: '2', preco: '7920,50' }), now, false)!.ficam).toBe('Fica 1 ct em aberto.')
  })

  it('«Parcial»: the errors in the board’s order and texts', () => {
    const now = at('10:18')
    const m = modeloParcial(top, antes, CP({ preco: '', hora: '10:30' }), now, true)!
    expect(m.erros).toEqual({ ppreco: 'Informe o preço da parcial.', phora: 'A parcial não pode ser depois de agora (10:18 ET).' })
    expect(m.campos).toBeNull()
    expect(modeloParcial(top, antes, CP({ preco: '7920,3' }), now, false)!.bloco.linha).toBe('Resultado: confira o preço da parcial (o MES anda de 0,25 em 0,25).')
    expect(modeloParcial(top, antes, CP({ preco: '7920,3' }), now, true)!.bloco.linha).toBe('Resultado: confira o preço da parcial.')
    expect(modeloParcial(top, antes, CP({ preco: '7920,3' }), now, true)!.erros.ppreco).toBe('O MES anda de 0,25 em 0,25; confira o preço.')
    expect(modeloParcial(top, antes, CP({ preco: 'abc' }), now, true)!.erros.ppreco).toBe('Use só números, como 7.896,25.')
    expect(modeloParcial(top, antes, CP({ preco: '0' }), now, true)!.erros.ppreco).toBe('O preço precisa ser maior que zero.')
    expect(modeloParcial(top, antes, CP({ preco: '7920,5', hora: '10:05' }), now, true)!.erros.phora).toBe('A parcial não pode ser antes da entrada (10:12).')
    expect(modeloParcial(top, antes, CP({ preco: '7920,5', hora: '' }), now, true)!.erros.phora).toBe('Informe a hora.')
  })

  it('the action status, the suggestion and the timeline after the partial', () => {
    expect(textoParcialRegistrada(top, depois.state, depois.exitId)).toBe('Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.')
    expect(sugestaoBreakeven(top, depois.state, '7920.5')).toBe('Esta parcial saiu com +8,00 pts. Pela sua regra, com +8 pts o stop vai para o breakeven.')
    expect(sugestaoBreakeven(top, depois.state, '7918')).toBeNull()
    const view = v(depois.state)
    const ag = modeloAgora(top, view)!
    expect(ag.linhas.map((l) => [l.rotulo, l.valor, l.sub, l.tom])).toEqual([
      ['Em aberto', '2 ct', 'de 3', 'neutral'],
      ['Stop', '7.902,50', '· o da entrada', 'neutral'],
      ['Realizado', nb('+US$ 40,00'), 'em 1 parcial', 'mint'],
    ])
    expect(ag.seStop).toBe(nb('Se o stop for atingido: −US$ 60,00 no total.'))
    expect(linhaDoTempo(top, view, at('10:18')).map((x) => [x.hora, x.texto, x.sub, x.evento])).toEqual([
      ['10:12', 'Entrada · 3 ct a 7.912,50 · stop 10 pts', null, null],
      ['10:18', nb('Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00'), null, { kind: 'parcial', id: depois.exitId }],
    ])
    const u = desfazerEvento(top, view, at('10:18', 30))!
    expect(u).toMatchObject({ kind: 'parcial', aria: 'Desfazer a parcial das 10:18', ate: 'Até 10:33, 15 minutos depois do registro.' })
    expect(u.pergunta).toBe(
      'Desfazer a parcial das 10:18 (1 ct a 7.920,50)? Ela sai do resultado e do limite do dia, e os 3 ct voltam a ficar em aberto. O app guarda só que uma parcial foi desfeita, com a data e a hora.',
    )
    // The link goes at the deadline (on the server's clock)
    expect(desfazerEvento(top, view, at('10:33', 6))).toBeNull()
    expect(notaPrimeiraParcial(top, view)).toBe('Marcas feitas a partir da sua primeira parcial (10:18) contam como depois do resultado.')
    expect(regraNoResumo(top, view)).toBe('Sua regra: breakeven com +8 pts, em 7.920,50.')
    expect(perguntaDesfazerEntrada(top, view)).toBe(
      'Desfazer a entrada das 10:12 (MES · Compra · 3 ct)? A operação, as parciais e as marcas dela saem do diário. O app guarda só que uma operação registrada foi apagada, com a data e a hora.',
    )
  })

  it('a repeated answer (the same client_key) reads as the first one', () => {
    const r = parcialParciais('partial-mes-repetida')
    expect(r.repeated).toBe(true)
    expect(textoParcialRegistrada(top, r.state, r.exitId)).toBe('Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.')
  })
})

describe('scenario 14 · «Mover stop»', () => {
  const view = v(parcialParciais('partial-mes').state)
  const agora = agoraParciais('dia-top-1018').accounts.find((a) => a.accountId === ids.accounts.topOne)!

  it('Breakeven pressed by default, «Preço agora» required, the status and «Se o novo stop for atingido…»', () => {
    const m = modeloMoverStop(top, view, CS(), agora, false)!
    expect(m.modo).toBe('be')
    expect(m.opcoes.map((o) => o.rotulo)).toEqual(['Breakeven · 7.912,50', 'Outro preço'])
    expect(m.rotulos).toEqual({ novo: 'Novo stop', agora: 'Preço agora' })
    expect(m.agoraOpcional).toBe(false)
    expect(m.erros).toEqual({ sAgora: 'Informe o preço de agora.' })
    expect(m.status).toBe('Sua regra: breakeven com +8 pts.')
    expect(m.seAtingido).toBe(nb('Se o novo stop for atingido: +US$ 40,00 no total.'))
    const ok = modeloMoverStop(top, view, CS({ agora: '7.920,50' }), agora, true)!
    expect(ok.status).toBe('Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.')
    expect(ok.erros).toEqual({})
    expect(ok.campos).toEqual({ kind: 'breakeven', priceNow: '7920.5' })
    expect(ok.avisoLimite).toBeNull()
  })

  it('the side, the same stop, the tick and the empty «Novo stop» (validateMove agrees on each)', () => {
    const contra = modeloMoverStop(top, view, CS({ agora: '7.909,50' }), null, true)!
    expect(contra.status).toBe('Com 3,00 pts contra. Sua regra: breakeven com +8 pts.')
    expect(contra.erros).toEqual({ sAgora: 'Numa compra, o stop fica abaixo do preço de agora.' })
    const na = modeloMoverStop(top, view, CS({ agora: '7.912,50' }), null, true)!
    expect(na.status).toBe('Com o preço na entrada. Sua regra: breakeven com +8 pts.')
    expect(modeloMoverStop(top, view, CS({ modo: 'outro' }), null, true)!.erros).toEqual({ sNovo: 'Informe o novo stop.' })
    expect(modeloMoverStop(top, view, CS({ modo: 'outro', novo: '7.902,50' }), null, true)!.erros).toEqual({ sNovo: 'O stop já está em 7.902,50.' })
    expect(modeloMoverStop(top, view, CS({ modo: 'outro', novo: '7915,3' }), null, true)!.erros).toEqual({ sNovo: 'O MES anda de 0,25 em 0,25; confira o preço.' })
    expect(modeloMoverStop(top, view, CS({ modo: 'outro', novo: 'x' }), null, true)!.erros).toEqual({ sNovo: 'Use só números, como 7.912,50.' })
    expect(modeloMoverStop(top, view, CS({ modo: 'outro', novo: '0' }), null, true)!.erros).toEqual({ sNovo: 'O stop precisa ser maior que zero.' })
    expect(modeloMoverStop(top, view, CS({ modo: 'outro', novo: '7925', agora: '7920,5' }), null, true)!.erros).toEqual({ sNovo: 'Numa compra, o stop fica abaixo do preço de agora.' })
    const t = view.trade
    const trade = { market: 'futures', symbol: 'MES', direction: t.direction, entryPrice: t.entryPrice, stopPrice: t.stopPrice, status: 'open' as const, option: null, origin: 'live' as const }
    const key = '00000000-0000-4000-8000-000000000002'
    const code = (p: MovePayload) => {
      const r = validateMove(trade, view.stopMoves, p)
      return r.ok ? 'ok' : `${r.code} ${r.field}`
    }
    expect(code(movePayload({ clientKey: key, kind: 'breakeven', priceNow: '7909.5' }))).toBe('bad_stop price_now')
    expect(code(movePayload({ clientKey: key, kind: 'ajuste', stopPrice: '7902.5' }))).toBe('same_stop stop_price')
    expect(code(movePayload({ clientKey: key, kind: 'ajuste', stopPrice: '7915.3' }))).toBe('off_tick stop_price')
    expect(code(movePayload({ clientKey: key, kind: 'ajuste', stopPrice: '7925', priceNow: '7920.5' }))).toBe('bad_stop stop_price')
    expect(code(movePayload({ clientKey: key, kind: 'breakeven' }))).toBe('bad_price price_now')
    const ok = modeloMoverStop(top, view, CS({ modo: 'outro', novo: '7.915,00', agora: '7.923,50' }), null, true)!
    expect(ok.status).toBe('Com +11,00 pts a favor. Sua regra: breakeven com +8 pts.')
    expect(code(movePayload({ clientKey: key, ...ok.campos! }))).toBe('ok')
  })

  it('«Outro preço» exactly at the entry needs no «Preço agora» (P1: stored as an «ajuste» with no points)', () => {
    const m = modeloMoverStop(top, view, CS({ modo: 'outro', novo: '7.912,50' }), null, true)!
    expect(m.erros).toEqual({})
    expect(m.agoraOpcional).toBe(true)
    expect(m.campos).toEqual({ kind: 'ajuste', stopPrice: '7912.5', priceNow: undefined })
  })

  it('after the move: the status, «Agora» «· no breakeven, desde 10:19», the timeline, «Desfazer» on the move', () => {
    const s = stopParciais('stop-mes-breakeven')
    expect(textoStopRegistrado(top, s.state, s.moveId)).toBe('Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.')
    const vw = v(s.state)
    expect(modeloAgora(top, vw)!.linhas[1]).toMatchObject({ valor: '7.912,50', sub: '· no breakeven, desde 10:19' })
    expect(modeloAgora(top, vw)!.seStop).toBe(nb('Se o stop for atingido: +US$ 40,00 no total.'))
    expect(regraNoResumo(top, vw)).toBeNull()
    expect(linhaDoTempo(top, vw, at('10:19')).map((x) => x.texto)).toEqual([
      'Entrada · 3 ct a 7.912,50 · stop 10 pts',
      nb('Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00'),
      'Stop no breakeven · 7.912,50 · com +8,00 pts a favor',
    ])
    const u = desfazerEvento(top, vw, at('10:19', 30))!
    expect(u.aria).toBe('Desfazer o movimento do stop das 10:19')
    expect(u.pergunta).toBe(
      'Desfazer o movimento do stop das 10:19 (para 7.912,50)? O stop volta a 7.902,50. O app guarda só que um movimento foi desfeito, com a data e a hora.',
    )
    expect(perguntaDesfazerEntrada(top, vw)).toContain('A operação, as parciais, os movimentos do stop e as marcas dela')
    // Already at the entry: «Outro preço» pressed, and «Breakeven» says so
    expect(modeloMoverStop(top, vw, CS(), null, false)!.modo).toBe('outro')
    expect(modeloMoverStop(top, vw, CS({ modo: 'be', agora: '7.925' }), null, true)!.erros.sModo).toBe('O stop já está em 7.912,50.')
  })

  it('the variant: «Stop movido para 7.915,00 às 10:30 ET, com +11,00 pts a favor.», «garante», «arrisca»', () => {
    const s = stopMesPassou()
    expect(textoStopRegistrado(top, s.state, s.moveId)).toBe('Stop movido para 7.915,00 às 10:30 ET, com +11,00 pts a favor.')
    expect(modeloAgora(top, v(s.state))!.linhas[1].sub).toBe('· garante +2,50 pts, desde 10:30')
    const atras = comMovimento(estadoJson('partial-mes'), 'futures', { id: 8, at: etEm('10:30', 4), payload: { v: 1, client_key: '00000000-0000-4000-8000-000000000003', kind: 'ajuste', stop_price: '7908.5' } })
    expect(modeloAgora(top, v(atras.state))!.linhas[1].sub).toBe('· arrisca 4,00 pts, desde 10:30')
    expect(textoStopRegistrado(top, atras.state, 8)).toBe('Stop movido para 7.908,50 às 10:30 ET.')
  })

  it('undo of a move: «Movimento do stop das 10:19 desfeito às 10:20.»; of a partial with the limit back', () => {
    const d = desfeitaParciais('stop-mes-desfeito')
    expect(textoDepoisDoUndo(top, { kind: 'stop', hora: '10:19' }, d.state.serverNow, { market: 'futures', tradeDay: '2026-10-23', before: null, after: null, pref80: false })).toBe(
      'Movimento do stop das 10:19 desfeito às 10:20.',
    )
  })
})

describe('scenario 14 · the exit after the partial and step 3', () => {
  it(nb('«Sai com os 2 ct em aberto.», « · no total +US$ 175,00», the hour not before the last partial'), () => {
    const view = v(stopParciais('stop-mes-breakeven').state)
    const now = at('10:31')
    const m = saidaComParciais(top, view, { preco: '7.926,00', hora: null }, now, false)
    expect(m.nota).toBe('Sai com os 2 ct em aberto.')
    expect(m.previa).toBe(nb('Se sair a 7.926,00: +13,50 pts · +US$ 135,00 · no total +US$ 175,00'))
    expect(m.payload).toEqual({ v: 1, exit_price: '7926', clock: 'America/New_York' })
    const cedo = saidaComParciais(top, view, { preco: '7.926,00', hora: '10:15' }, now, true)
    expect(cedo.erros.shora).toBe('A saída não pode ser antes da última parcial (10:18).')
    expect(cedo.payload).toBeNull()
    // Without partials: the as-built exit
    const antes = v(mesAntesDaParcial('2026-10-23T14:31:00.000Z'))
    expect(saidaComParciais(top, antes, { preco: '7.926,00', hora: null }, now, false)).toEqual({ ...modeloSaida(top, antes.trade, { preco: '7.926,00', hora: null }, now, false), nota: null })
    // One open: «Sai com o 1 ct em aberto.»
    const um = comParcial(estadoJson('partial-mes'), 'futures', { id: 2, quantity: '1', exitPrice: '7922', at: etEm('10:20', 4) })
    expect(saidaComParciais(top, v(um.state), { preco: '', hora: null }, at('10:21'), false).nota).toBe('Sai com o 1 ct em aberto.')
  })

  it('step 3 (composed: the 10:19 breakeven only): the average, R on the initial stop, the timeline, the breakeven line, the marks', () => {
    const s = saidaMesComBe().state
    const c = cartaoComParciais(top, v(s), at('10:31'))
    expect(c.valor).toBe(nb('+US$ 175,00'))
    expect(c.linha).toBe('MES · Compra · 3 ct · 7.912,50 → 7.924,17 em média · +11,67 pts · 10:12–10:31 ET')
    expect(c.r).toEqual({ valor: '+1,17 R', sub: 'com o stop inicial de 10 pts' })
    expect(c.tempo!.map((x) => [x.hora, x.texto])).toEqual([
      ['10:12', 'Entrada · 3 ct a 7.912,50 · stop 10 pts'],
      ['10:18', nb('Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00')],
      ['10:19', 'Stop no breakeven · 7.912,50 · com +8,00 pts a favor'],
      ['10:31', nb('Saída · 2 ct a 7.926,00 · +13,50 pts · +US$ 135,00')],
    ])
    expect(c.breakeven).toBe('Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.')
  })

  it('step 3 on the recording (move 1 undone, move 2 at 10:21): «Breakeven às 10:21, …»; the marks line names the first partial', () => {
    const s = saidaParciais().state
    expect(cartaoComParciais(top, v(s), at('10:31')).breakeven).toBe('Breakeven às 10:21, com +8,00 pts a favor · sua regra: +8 pts.')
    expect(linhaDepoisComParciais(top, v(s))).toBe('Marcas feitas a partir das 10:18 (sua primeira parcial) contam como depois do resultado.')
    expect(cartaoComParciais(top, vistaRowsParciais('rows-exit-mes'), at('10:31')).breakeven).toBe('Breakeven às 10:21, com +8,00 pts a favor · sua regra: +8 pts.')
  })

  it('the variant: «Breakeven: o stop passou da entrada às 10:30, com +11,00 pts a favor · sua regra: +8 pts.»', () => {
    expect(cartaoComParciais(top, v(saidaMesPassou().state), at('10:31')).breakeven).toBe('Breakeven: o stop passou da entrada às 10:30, com +11,00 pts a favor · sua regra: +8 pts.')
  })

  it('the earlier MNQ (composed): «em 2 saídas» on the bridge, «Breakeven às 10:04, com +20,00 pts a favor · sua regra: +30 pts.»', () => {
    const s = mnqFechadaS14()
    const c = cartaoComParciais(top, v(s), at('10:18'))
    expect(c.valor).toBe(nb('+US$ 40,00'))
    expect(c.linha).toBe('MNQ · Venda · 2 ct · 30.950,00 → 30.940,00 em média · +10,00 pts · 10:01–10:07 ET')
    expect(c.breakeven).toBe('Breakeven às 10:04, com +20,00 pts a favor · sua regra: +30 pts.')
    expect(subDaPonte('futures', s.trade, s)).toBe('em 2 saídas')
  })

  it('a live trade moved then closed in one «Saída» (no exit rows): one «Saída» item from its columns', () => {
    const s = mesBeUmaSaida()
    const c = cartaoComParciais(top, v(s), at('10:31'))
    expect(c.tempo!.map((x) => x.texto)).toEqual([
      'Entrada · 3 ct a 7.912,50 · stop 10 pts',
      'Stop no breakeven · 7.912,50 · com +8,00 pts a favor',
      nb('Saída · 3 ct a 7.926,00 · +13,50 pts · +US$ 202,50'),
    ])
    expect(c.r?.sub).toBe('com o stop inicial de 10 pts')
    expect(c.breakeven).toBe('Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.')
  })

  it('a live trade never moved: «Breakeven: o stop não foi movido · sua regra: +8 pts.»; no timeline with one exit and no move', () => {
    const json = estadoJson('exit-mes')
    json.stop_moves = []
    delete json.position
    const c = cartaoComParciais(top, v(saidaComMoves(json)), at('10:31'))
    expect(c.breakeven).toBe('Breakeven: o stop não foi movido · sua regra: +8 pts.')
    expect(c.r).toEqual({ valor: '+1,17 R', sub: 'com stop de 10 pts' })
    expect(c.tempo).not.toBeNull()
  })

  it('a partial typed earlier than it was registered: the sub-line «registrada às 10:20»; another day: «ontem, 10:18»', () => {
    const json = estadoJson('partial-mes')
    json.exits[0].exit_time = etEm('10:18')
    json.exits[0].registered_at = etEm('10:20', 3)
    const s = saidaComMoves({ ...estadoJson('exit-mes'), exits: [json.exits[0], estadoJson('exit-mes').exits[1]], stop_moves: [], position: undefined })
    const itens = cartaoComParciais(top, v(s), at('10:31')).tempo!
    expect(itens[1]).toMatchObject({ hora: '10:18', texto: nb('Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00'), sub: 'registrada às 10:20' })
    const amanha = new Date(at('10:31').getTime() + 24 * 3600 * 1000)
    expect(linhaDoTempo(top, v(s), amanha).map((x) => x.hora)).toEqual(['ontem, 10:12', 'ontem, 10:18', 'ontem, 10:31'])
    const depois = new Date(at('10:31').getTime() + 3 * 24 * 3600 * 1000)
    expect(linhaDoTempo(top, v(s), depois)[0].hora).toBe('23 out, 10:12')
  })
})

/** exit-mes with its stop moves replaced (the parser derives the position) */
function saidaComMoves(json: Record<string, any>): TradeState {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseExitRegistered } = require('@/lib/hub/registrarDb')
  return parseExitRegistered(json).state
}

// ------------------------------------------------------------------------------------------------
// Scenario 15 · «Já fechada» MGC Venda 2 ct, two exits, the breakeven told
// ------------------------------------------------------------------------------------------------

describe('scenario 15 · step 3 of «Já fechada» in two exits (recorded after-mgc)', () => {
  it('the average, R, the timeline with «Nª saída» and the told breakeven, the line', () => {
    const s = fechadaParciais().state
    const c = cartaoComParciais(top, v(s), at('10:45'))
    expect(c.valor).toBe(nb('+US$ 120,00'))
    expect(c.linha).toBe('MGC · Venda · 2 ct · 4.421,30 → 4.415,30 em média · +6,00 pts · 10:24–10:38 ET')
    expect(c.r).toEqual({ valor: '+0,40 R', sub: 'com o stop inicial de 15 pts' })
    expect(c.tempo!.map((x) => [x.hora, x.texto])).toEqual([
      ['10:24', 'Entrada · 2 ct a 4.421,30 · stop 15 pts'],
      ['10:31', nb('1ª saída · 1 ct a 4.409,30 · +12,00 pts · +US$ 120,00')],
      [null, 'Stop no breakeven · com +12,00 pts a favor · registrado depois'],
      ['10:38', nb('2ª saída · 1 ct a 4.421,30 · 0,00 pts · US$ 0,00')],
    ])
    expect(c.breakeven).toBe('Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.')
    expect(linhaDepoisComParciais(top, v(s))).toBe('Marcas feitas a partir de agora contam como depois do resultado.')
  })

  it('«Já fechada» in one exit with the pill: «Saída · …» right after the told breakeven, never «1ª saída»', () => {
    const c = cartaoComParciais(top, v(mgcUmaSaida()), at('10:45'))
    expect(c.tempo!.map((x) => [x.hora, x.texto])).toEqual([
      ['10:24', 'Entrada · 2 ct a 4.421,30 · stop 15 pts'],
      [null, 'Stop no breakeven · com +12,00 pts a favor · registrado depois'],
      ['10:31', nb('Saída · 2 ct a 4.409,30 · +12,00 pts · +US$ 240,00')],
    ])
  })
})

// ------------------------------------------------------------------------------------------------
// Scenario 16 · Apex MNQ Compra 3 ct a 30.880,00, stop 40; ES −US$ 300 before
// ------------------------------------------------------------------------------------------------

describe('scenario 16 · the partial that reaches the limit', () => {
  it(nb('composed (−28 min): «Parcial de 2 ct a 30.855,00: −25,00 pts · −US$ 100,00», «Agora», no suggestion, «Até 10:40»'), () => {
    const antes = v(mnqAntesDaParcial())
    const m = modeloParcial(apex, antes, CP({ chip: '2', preco: '30.855,00' }), at('10:25'), false)!
    expect(m.bloco.linha).toBe(nb('Parcial de 2 ct a 30.855,00: −25,00 pts · −US$ 100,00'))
    expect(m.ficam).toBe('Fica 1 ct em aberto.')
    const p = parcialMnq()
    expect(textoParcialRegistrada(apex, p.state, p.exitId)).toBe('Parcial registrada: 2 ct a 30.855,00 às 10:25 ET. Fica 1 ct em aberto.')
    expect(sugestaoBreakeven(apex, p.state, '30855')).toBeNull()
    const ag = modeloAgora(apex, v(p.state))!
    expect(ag.linhas.map((l) => `${l.rotulo} ${l.valor} ${l.sub}`)).toEqual(['Em aberto 1 ct de 3', 'Stop 30.840,00 · o da entrada', nb('Realizado −US$ 100,00 em 1 parcial')])
    expect(ag.linhas[2].tom).toBe('red')
    expect(ag.seStop).toBe(nb('Se o stop for atingido: −US$ 180,00 no total.'))
    expect(desfazerEvento(apex, v(p.state), at('10:25', 30))!.ate).toBe('Até 10:40, 15 minutos depois do registro.')
  })

  it('the recorded times: 10:53 and «Até 11:08»', () => {
    const p = parcialParciais('partial-mnq-limite')
    expect(textoParcialRegistrada(apex, p.state, p.exitId)).toBe('Parcial registrada: 2 ct a 30.855,00 às 10:53 ET. Fica 1 ct em aberto.')
    expect(desfazerEvento(apex, v(p.state), at('10:53', 30))!.ate).toBe('Até 11:08, 15 minutos depois do registro.')
  })

  it(nb('the undo: «Parcial das 10:25 desfeita às 10:27. Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.» only when it had reached it'), () => {
    const p = parcialMnq()
    const d = desfeitaMnq()
    const before = { tradingDay: '2026-10-23', limit: p.gateNow!.limit }
    const after1055 = agoraParciais('dia-apex-1055', { min: -28 }).accounts.find((a) => a.accountId === ids.accounts.apex)!
    const after = { tradingDay: after1055.gate.tradingDay, limit: after1055.gate.limit }
    const voided = d.state.exits.find((x) => x.id === d.undone.id)!.voidedAt!
    expect(textoDepoisDoUndo(apex, { kind: 'parcial', hora: '10:25' }, voided, { market: 'futures', tradeDay: '2026-10-23', before, after, pref80: false })).toBe(
      nb('Parcial das 10:25 desfeita às 10:27. Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.'),
    )
    // Not reached before (or another trading day): no second sentence
    expect(textoDepoisDoUndo(apex, { kind: 'parcial', hora: '10:25' }, voided, { market: 'futures', tradeDay: '2026-10-23', before: after, after, pref80: false })).toBe('Parcial das 10:25 desfeita às 10:27.')
    expect(textoDepoisDoUndo(apex, { kind: 'parcial', hora: '10:25' }, voided, { market: 'futures', tradeDay: '2026-10-22', before, after, pref80: false })).toBe('Parcial das 10:25 desfeita às 10:27.')
    // The recorded one: 10:53 → 10:55
    const r = desfeitaParciais('partial-mnq-desfeita')
    expect(textoDepoisDoUndo(apex, { kind: 'parcial', hora: '10:53' }, r.state.exits[0].voidedAt!, { market: 'futures', tradeDay: '2026-10-23', before: null, after: null, pref80: false })).toBe(
      'Parcial das 10:53 desfeita às 10:55.',
    )
  })

  it('«Mover stop» «Outro preço» 30.860,00 with «Preço agora» 30.870,00, and a level past what is left of the limit', () => {
    const p = parcialMnq()
    const view = v(p.state)
    const agoraApex = parseRulesNow({ ...estadoJson('dia-apex-1053').agora }).accounts.find((a) => a.accountId === ids.accounts.apex)!
    const m = modeloMoverStop(apex, view, CS({ modo: 'outro', novo: '30.860,00', agora: '30.870,00' }), null, true)!
    expect(m.status).toBe('Com 10,00 pts contra. Sua regra: breakeven com +30 pts.')
    expect(m.seAtingido).toBe(nb('Se o novo stop for atingido: −US$ 140,00 no total.'))
    expect(m.erros).toEqual({})
    // The limit already reached: no warning (the gate says «encerrado»)
    expect(modeloMoverStop(apex, view, CS({ modo: 'outro', novo: '30.800,00' }), agoraApex, true)!.avisoLimite).toBeNull()
    // Before the partial (−US$ 300, US$ 100 left): a stop that risks more warns
    const antes = v(mnqAntesDaParcial())
    const agora1055 = agoraParciais('dia-apex-1055', { min: -28 }).accounts.find((a) => a.accountId === ids.accounts.apex)!
    expect(modeloMoverStop(apex, antes, CS({ modo: 'outro', novo: '30.820,00' }), agora1055, true)!.avisoLimite).toBe(
      nb('Se o novo stop for atingido, o dia passa do limite: faltam US$ 100 e o stop arrisca US$ 360.'),
    )
    expect(modeloMoverStop(apex, antes, CS({ modo: 'outro', novo: '30.865,00' }), agora1055, true)!.avisoLimite).toBeNull()
  })

  it('step 3 «Breakeven: o stop foi movido, sem chegar à entrada · sua regra: +30 pts.»', () => {
    const p = parcialMnq()
    const mv = comMovimento(estadoJson('partial-mnq-limite'), 'futures', {
      id: 7,
      at: etEm('10:54'),
      payload: { v: 1, client_key: '00000000-0000-4000-8000-000000000004', kind: 'ajuste', stop_price: '30860', price_now: '30870' },
    })
    const s = mv.state
    const closed = { ...s, trade: { ...s.trade, status: 'closed' as const, exitPrice: '30870', exitTime: at('10:56'), pnl: '-120' } }
    expect(cartaoComParciais(apex, v(closed), at('10:56')).breakeven).toBe('Breakeven: o stop foi movido, sem chegar à entrada · sua regra: +30 pts.')
    expect(p.repeated).toBe(false)
  })
})

// ------------------------------------------------------------------------------------------------
// P1 · «Outro preço» exactly at the entry (recorded stop-mes-entrada-ajuste / -breakeven)
// ------------------------------------------------------------------------------------------------

describe('P1 · a stop at the entry reads «breakeven» whatever kind was stored', () => {
  it('without «Preço agora» (ajuste, no points) and with it (breakeven, +4,25)', () => {
    const a = stopParciais('stop-mes-entrada-ajuste')
    expect(a.state.stopMoves[0].kind).toBe('ajuste')
    expect(textoStopRegistrado(top, a.state, a.moveId)).toBe('Stop no breakeven (7.930,00) às 11:31 ET.')
    expect(linhaDoTempo(top, v(a.state), at('11:31')).map((x) => x.texto)).toContain('Stop no breakeven · 7.930,00')
    expect(modeloAgora(top, v(a.state))!.linhas[1].sub).toBe('· no breakeven, desde 11:31')
    expect(subDaPonte('futures', a.state.trade, a.state)).toBe('stop no breakeven')
    expect(desfazerEvento(top, v(a.state), at('11:31', 30))!.pergunta).toBe(
      'Desfazer o movimento do stop das 11:31 (para 7.930,00)? O stop volta a 7.920,00. O app guarda só que um movimento foi desfeito, com a data e a hora.',
    )
    const b = stopParciais('stop-mes-entrada-breakeven')
    expect(b.state.stopMoves.find((m) => m.id === b.moveId)!.kind).toBe('breakeven')
    expect(textoStopRegistrado(top, b.state, b.moveId)).toBe('Stop no breakeven (7.930,00) às 11:32 ET, com +4,25 pts a favor.')
    expect(linhaDoTempo(top, v(b.state), at('11:32')).map((x) => x.texto)).toContain('Stop no breakeven · 7.930,00 · com +4,25 pts a favor')
    expect(subDaPonte('futures', b.state.trade, b.state)).toBe('stop no breakeven')
  })

  it('step 3 of a live move at the entry without a price: «Breakeven às 11:31 · sua regra: +8 pts.»', () => {
    const a = stopParciais('stop-mes-entrada-ajuste').state
    const closed = { ...a, trade: { ...a.trade, status: 'closed' as const, exitPrice: '7940', exitTime: at('11:40'), pnl: '100' } }
    expect(cartaoComParciais(top, v(closed), at('11:40')).breakeven).toBe('Breakeven às 11:31 · sua regra: +8 pts.')
  })
})

// ------------------------------------------------------------------------------------------------
// The six markets (scenarios 6–9)
// ------------------------------------------------------------------------------------------------

describe('scenario 6 · FTMO forex: lots, «Metade», pips, the estimate and the typed result', () => {
  it(nb('EUR/USD composed 0,50 / 0,25: «Parcial de 0,25 lote a 1,08650: +13,0 pips · +US$ 32,50», «Ficam 0,25 lote em aberto.»'), () => {
    const antes = v(eurAntesDaParcial())
    const vazio = modeloParcial(ftmo, antes, CP(), at('11:17'), false)!
    expect(vazio.chips).toBeNull()
    expect(vazio.rotuloQtd).toBe('Lotes')
    expect(vazio.metade).toBe('0,25')
    expect(vazio.ficam).toBe('Em aberto: 0,50 lote.')
    const m = modeloParcial(ftmo, antes, CP({ qtd: '0,25', preco: '1,08650' }), at('11:17'), false)!
    expect(m.bloco.linha).toBe(nb('Parcial de 0,25 lote a 1,08650: +13,0 pips · +US$ 32,50'))
    expect(m.ficam).toBe('Ficam 0,25 lote em aberto.')
    expect(m.bloco.corrigir).toEqual({ rotulo: 'Corrigir', aberto: false })
    const p = parcialEur()
    expect(textoParcialRegistrada(ftmo, p.state, p.exitId)).toBe('Parcial registrada: 0,25 lote a 1,08650 às 11:17 ET. Ficam 0,25 lote em aberto.')
    expect(sugestaoBreakeven(ftmo, p.state, '1.0865')).toBe('Esta parcial saiu com +13,0 pips. Pela sua regra, com +7,5 pips o stop vai para o breakeven.')
  })

  it(nb('EUR/USD recorded 1,00 / 0,50: «+13,0 pips · +US$ 65,00», «Ficam 0,50 lote em aberto.»'), () => {
    const p = parcialParciais('partial-eurusd')
    expect(textoParcialRegistrada(ftmo, p.state, p.exitId)).toBe('Parcial registrada: 0,50 lote a 1,08650 às 11:17 ET. Ficam 0,50 lote em aberto.')
    expect(linhaDoTempo(ftmo, v(p.state), at('11:17'))[1].texto).toBe(nb('Parcial · 0,50 lote a 1,08650 · +13,0 pips · +US$ 65,00'))
    const s = stopParciais('stop-eurusd-ajuste')
    expect(modeloAgora(ftmo, v(s.state))!.linhas[1].sub).toBe('· garante +4,0 pips, desde 11:17')
  })

  it('«Confira o preço de agora.» for a pips price whose points do not fit (validateMove: bad_price)', () => {
    const view = v(parcialParciais('partial-eurusd').state)
    const m = modeloMoverStop(ftmo, view, CS({ agora: '2.000.000' }), null, true)!
    expect(m.erros.sAgora).toBe('Confira o preço de agora.')
    const t = view.trade
    const r = validateMove(
      { market: 'forex', symbol: 'EUR/USD', direction: 'long', entryPrice: t.entryPrice, stopPrice: t.stopPrice, status: 'open', option: null, origin: 'live' },
      view.stopMoves,
      movePayload({ clientKey: '00000000-0000-4000-8000-000000000005', kind: 'breakeven', priceNow: '2000000' }),
    )
    expect(r.ok ? 'ok' : `${r.code} ${r.field}`).toBe('bad_price price_now')
    expect(modeloMoverStop(ftmo, view, CS({ agora: '1,08650' }), null, true)!.status).toBe('Com +13,0 pips a favor. Sua regra: breakeven com +7,5 pips.')
    expect(modeloMoverStop(ftmo, view, CS({ agora: '1,08650' }), null, true)!.rotulos).toEqual({ novo: 'Novo stop', agora: 'Preço agora' })
  })

  it(nb('USD/JPY: the estimate «≈ +US$ 21,85»; EUR/GBP: «digite o valor em dólar» and «Resultado desta parcial, US$»'), () => {
    const jpy = v(entradaMercado('usdjpy'))
    const now = new Date('2026-10-15T13:01:00Z')
    const m = modeloParcial(fx, jpy, CP({ qtd: '0,15', preco: '151,020' }), now, false)!
    expect(m.metade).toBe('0,15')
    expect(m.bloco.linha).toBe(nb('Parcial de 0,15 lote a 151,020: +22,0 pips · ≈ +US$ 21,85'))
    expect(m.bloco.notaEstimativa).toBe('Em pares com o dólar na frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.')
    const gbp = v(entradaMercado('eurgbp'))
    const t = modeloParcial(fx, gbp, CP({ qtd: '0,25', preco: '0,87070' }), now, true)!
    expect(t.bloco.linha).toBe('Parcial de 0,25 lote a 0,87070: +5,0 pips · digite o valor em dólar')
    expect(t.bloco.campo).toMatchObject({
      rotulo: 'Resultado desta parcial, US$',
      nota: 'Pelos preços não dá para saber o valor em dólar: digite o resultado desta parcial na sua plataforma, antes da comissão, com swap ou funding, se houver.',
    })
    expect(t.erros.pres).toBe('Informe o resultado.')
    const ok = modeloParcial(fx, gbp, CP({ qtd: '0,25', preco: '0,87070', resultado: '16,28' }), now, true)!
    expect(ok.campos?.pnl).toBe('16.28')
    const p = comParcial(entradaMercadoJson('eurgbp'), 'forex', { id: 1, quantity: '0.25', exitPrice: '0.8707', at: '2026-10-15T13:01:00.000Z', pnl: '16.28' })
    expect(linhaDoTempo(fx, v(p.state), now)[1].texto).toBe(nb('Parcial · 0,25 lote a 0,87070 · +5,0 pips · +US$ 16,28, digitado'))
    expect(modeloMoverStop(fx, v(p.state), CS({ modo: 'outro', novo: '0,87150' }), null, true)!.seAtingido).toBeNull()
  })

  it('«Parcial» hidden at 0,01 lote; field errors as the as-built readers', () => {
    const p = comParcial(entradaMercadoJson('usdjpy'), 'forex', { id: 1, quantity: '0.29', exitPrice: '151.02', at: '2026-10-15T13:01:00.000Z' })
    expect(modosDaAberta(fx, v(p.state))).toEqual(['saida', 'stop'])
    const jpy = v(entradaMercado('usdjpy'))
    const now = new Date('2026-10-15T13:01:00Z')
    expect(modeloParcial(fx, jpy, CP({ qtd: '0,3' }), now, true)!.erros.pq).toBe('Use menos que os 0,30 lote em aberto; para sair com tudo, use “Saída”.')
    expect(modeloParcial(fx, jpy, CP({ qtd: '0,155' }), now, true)!.erros.pq).toBe('Use até 2 casas decimais.')
    expect(modeloParcial(fx, jpy, CP({ qtd: '' }), now, true)!.erros.pq).toBe('Informe a quantidade.')
    expect(modeloParcial(fx, jpy, CP({ qtd: 'x' }), now, true)!.erros.pq).toBe('Use só números, como 0,25.')
    expect(modeloParcial(fx, jpy, CP({ qtd: '0' }), now, true)!.erros.pq).toBe('Use uma quantidade maior que zero.')
  })
})

describe('scenario 7 · IBKR: the SPY call (premium) and AAPL (shares, «Metade»)', () => {
  const now = new Date('2026-10-15T13:58:00Z')
  it(nb('SPY Call 790: chip 1, «Parcial de 1 ct a 2,40: +0,55 no prêmio · +US$ 55,00», the premium labels'), () => {
    const spy = v(entradaMercado('spy-call-aberta'))
    const m = modeloParcial(ibkr, spy, CP({ preco: '2,40' }), now, false)!
    expect(m.chips?.valores).toEqual(['1'])
    expect(m.rotulos.preco).toBe('Prêmio da parcial, US$ por ação')
    expect(m.bloco.linha).toBe(nb('Parcial de 1 ct a 2,40: +0,55 no prêmio · +US$ 55,00'))
    expect(modeloParcial(ibkr, spy, CP(), now, false)!.bloco.linha).toBe('Resultado: informe o prêmio da parcial.')
    expect(modeloParcial(ibkr, spy, CP(), now, true)!.erros.ppreco).toBe('Informe o prêmio da parcial.')
    const st = modeloMoverStop(ibkr, spy, CS({ modo: 'outro' }), null, true)!
    expect(st.opcoes[0].rotulo).toBe('Breakeven · 1,85')
    expect(st.rotulos).toEqual({ novo: 'Novo stop do prêmio', agora: 'Prêmio agora, US$ por ação' })
    expect(modeloMoverStop(ibkr, spy, CS(), null, true)!.erros.sAgora).toBe('Informe o prêmio de agora.')
    expect(linhaDoTempo(ibkr, v(comParcial(entradaMercadoJson('spy-call-aberta'), 'stocks', { id: 1, quantity: '1', exitPrice: '2.4', at: '2026-10-15T13:58:00.000Z' }).state), now)[0].texto).toBe(
      'Entrada · 2 ct a 1,85 · stop do prêmio 1,10',
    )
  })

  it(nb('AAPL 100 ações: «Metade» = 50, «+0,75 por ação · +US$ 37,50»'), () => {
    const aapl = v(entradaMercado('aapl'))
    const m = modeloParcial(ibkr, aapl, CP({ qtd: '50', preco: '232,15' }), now, false)!
    expect(modeloParcial(ibkr, aapl, CP(), now, false)!.metade).toBe('50')
    expect(m.rotuloQtd).toBe('Ações')
    expect(m.bloco.linha).toBe(nb('Parcial de 50 ações a 232,15: +0,75 por ação · +US$ 37,50'))
    expect(m.ficam).toBe('Ficam 50 ações em aberto.')
    expect(linhaDoTempo(ibkr, aapl, now)[0].texto).toBe('Entrada · 100 ações a 231,40 · stop 230,90')
  })
})

describe('scenario 8 · Binance BTC/USDT', () => {
  it(nb('«Parcial de 0,1 BTC a 111.950: +450 por BTC · +US$ 45,00», «Ficam 0,15 BTC em aberto.», the USDT labels'), () => {
    const btc = v(entradaMercado('btc'))
    const now = new Date('2026-10-18T00:02:00Z')
    const m = modeloParcial(binance, btc, CP({ qtd: '0,1', preco: '111.950' }), now, false)!
    expect(m.rotuloQtd).toBe('Quantidade, em BTC')
    expect(m.rotulos.preco).toBe('Preço da parcial, USDT')
    expect(m.rotulos.hora).toBe('Hora da parcial (Brasília)')
    expect(m.bloco.linha).toBe(nb('Parcial de 0,1 BTC a 111.950: +450 por BTC · +US$ 45,00'))
    expect(m.ficam).toBe('Ficam 0,15 BTC em aberto.')
    expect(modeloParcial(binance, btc, CP(), now, false)!.metade).toBe('0,125')
    expect(modeloMoverStop(binance, btc, CS({ modo: 'outro' }), null, false)!.rotulos).toEqual({ novo: 'Novo stop, USDT', agora: 'Preço agora, USDT' })
  })
})

describe('scenario 9 · Clear B3', () => {
  const now = new Date('2026-10-15T13:31:00Z')
  it(nb('WIN Venda 3 ct: chips 1 2, «Parcial de 2 ct a 131.100: +150 pts · +R$ 60,00»'), () => {
    const win = v(entradaMercado('win'))
    const m = modeloParcial(clear, win, CP({ chip: '2', preco: '131.100' }), now, false)!
    expect(m.chips?.valores).toEqual(['1', '2'])
    expect(m.bloco.linha).toBe(nb('Parcial de 2 ct a 131.100: +150 pts · +R$ 60,00'))
  })

  it('PETR4 300 ações: «Metade» 150 → the lot note; 100 (rest 200) → no note', () => {
    const petr = v(entradaMercado('petr4'))
    expect(modeloParcial(clear, petr, CP(), now, false)!.metade).toBe('150')
    expect(modeloParcial(clear, petr, CP({ qtd: '150', preco: '38,71' }), now, false)!.lote).toBe('Fora do lote de 100, a B3 negocia no fracionário (código com F).')
    const cem = modeloParcial(clear, petr, CP({ qtd: '100', preco: '38,71' }), now, false)!
    expect(cem.lote).toBeNull()
    expect(cem.bloco.linha).toBe(nb('Parcial de 100 ações a 38,71: +0,29 por ação · +R$ 29,00'))
    expect(modeloParcial(clear, petr, CP({ qtd: '10,5' }), now, true)!.erros.pq).toBe('Use um número inteiro de ações.')
  })
})

describe('the chips: 1 … open−1, or 1 2 3 and «Outro» above 5', () => {
  it('a 1-contract trade never offers «Parcial»; 6 open: «Outro» → «Quantos contratos?»', () => {
    const json = estadoJson('entry-mes')
    json.trade.quantity = 1
    const um = v(parseTrade(json))
    expect(modosDaAberta(top, um)).toEqual(['saida', 'stop'])
    json.trade.quantity = 6
    const seis = v(parseTrade(json))
    const m = modeloParcial(top, seis, CP({ outro: true, qtd: '4', preco: '7920,5' }), at('10:18'), false)!
    expect(m.chips).toMatchObject({ valores: ['1', '2', '3'], outro: true, outroAberto: true, escolhido: null, outroRotulo: 'Quantos contratos?' })
    expect(m.bloco.linha).toBe(nb('Parcial de 4 ct a 7.920,50: +8,00 pts · +US$ 160,00'))
    expect(modeloParcial(top, seis, CP({ outro: true, qtd: '6' }), at('10:18'), true)!.erros.pq).toBe('Use menos que os 6 ct em aberto; para sair com tudo, use “Saída”.')
    expect(modeloParcial(top, seis, CP({ outro: true, qtd: '2,5' }), at('10:18'), true)!.erros.pq).toBe('Use um número inteiro de contratos.')
  })
})

function parseTrade(json: Record<string, any>): TradeState {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parseRegistered } = require('@/lib/hub/registrarDb')
  // The position is derived from the rows (positionOf) once the recorded one is dropped
  return parseRegistered({ ...json, position: undefined }).state
}

// ------------------------------------------------------------------------------------------------
// The readers, pinned to the as-built ones (registrarForm's private lerPrecoDe / lerQuantidade / lerDinheiro)
// ------------------------------------------------------------------------------------------------

describe('the readers give the as-built texts on shared inputs', () => {
  it('a price: as «Preço de saída» (modeloSaida) for every non-empty text', () => {
    const view = v(mesAntesDaParcial('2026-10-23T14:31:00.000Z'))
    const forma = formaDoAtivo('futures', 'MES')!
    for (const text of ['abc', '0', '7920,3', '7.920,50', '12345678901', '-5']) {
      const asBuilt = modeloSaida(top, view.trade, { preco: text, hora: null }, at('10:31'), true).erros.spreco
      const mine = lerPreco(forma, text, { vazio: 'x', zero: 'O preço precisa ser maior que zero.', exemplo: forma.exemplo }).erro
      expect([text, mine]).toEqual([text, asBuilt])
    }
    const fxForma = formaDoAtivo('forex', 'EUR/USD')!
    const eur = v(entradaMercado('usdjpy'))
    void eur
    expect(lerPreco(fxForma, '1,085201', { vazio: 'x', zero: 'z', exemplo: fxForma.exemplo }).erro).toBe('Use até 5 casas decimais.')
  })

  it('a quantity and a typed result', () => {
    const lotes = formaDoAtivo('forex', 'EUR/USD')!
    expect(lerQuantidadeTexto(lotes, '0,25')).toEqual({ value: '0.25' })
    expect(lerQuantidadeTexto(lotes, '0,251').erro).toBe('Use até 2 casas decimais.')
    expect(lerDinheiroSinal('−57,50')).toEqual({ value: '-57.5', vazio: false })
    expect(lerDinheiroSinal('').vazio).toBe(true)
    expect(lerDinheiroSinal('1,234').erro).toBe('Use até 2 casas decimais.')
    expect(lerDinheiroSinal('abc').erro).toBe('Use só números, como −57,50.')
  })
})

// ------------------------------------------------------------------------------------------------
// The lists
// ------------------------------------------------------------------------------------------------

describe('the chooser and the bridge', () => {
  it('«MES · Compra · 3 ct · 2 ct em aberto · desde 10:12 ET» after a partial; as built without', () => {
    const s = parcialParciais('partial-mes').state
    expect(linhaEscolhaComParciais(top, s.trade, s, at('10:20'))).toBe('MES · Compra · 3 ct · 2 ct em aberto · desde 10:12 ET')
    expect(linhaEscolhaComParciais(top, s.trade, null, at('10:20'))).toBe('MES · Compra · 3 ct · desde 10:12 ET')
    expect(linhaEscolhaComParciais(top, s.trade, { exits: [], stopMoves: [] }, at('10:20'))).toBe('MES · Compra · 3 ct · desde 10:12 ET')
  })

  it('the bridge: partials and the current move only (a breakeven then 7.915,00 → «stop movido»; undone → none)', () => {
    const p = parcialParciais('partial-mes').state
    expect(subDaPonte('futures', p.trade, p)).toBe(nb('1 parcial, +US$ 40,00'))
    const be = stopParciais('stop-mes-breakeven').state
    expect(subDaPonte('futures', be.trade, be)).toBe(nb('1 parcial, +US$ 40,00 · stop no breakeven'))
    const json = estadoJson('stop-mes-breakeven')
    const depois = comMovimento(json, 'futures', { id: 9, at: etEm('10:30', 4), payload: { v: 1, client_key: '00000000-0000-4000-8000-000000000006', kind: 'ajuste', stop_price: '7915', price_now: '7923.5' } })
    expect(subDaPonte('futures', depois.state.trade, depois.state)).toBe(nb('1 parcial, +US$ 40,00 · stop movido'))
    const desfeito = desfeitaParciais('stop-mes-desfeito').state
    expect(subDaPonte('futures', desfeito.trade, desfeito)).toBe(nb('1 parcial, +US$ 40,00'))
    // A told move never counts; a closed trade in one exit says nothing; binaries nothing
    const mgc = fechadaParciais().state
    expect(subDaPonte('futures', mgc.trade, mgc)).toBe('em 2 saídas')
    expect(subDaPonte('futures', mgcUmaSaida().trade, mgcUmaSaida())).toBeNull()
    expect(subDaPonte('binary', p.trade, p)).toBeNull()
    expect(subDaPonte('futures', p.trade, null)).toBeNull()
    const dois = comParcial(estadoJson('partial-mes'), 'futures', { id: 2, quantity: '1', exitPrice: '7917.5', at: etEm('10:22') })
    expect(subDaPonte('futures', dois.state.trade, dois.state)).toBe(nb('2 parciais, +US$ 65,00'))
  })
})

describe('E28 caps', () => {
  it('a 21st move is refused by the domain (too_many_moves): the sheet alert says «Até 20 movimentos de stop por operação.»', () => {
    expect(MAX_STOP_MOVES).toBe(20)
  })
})
