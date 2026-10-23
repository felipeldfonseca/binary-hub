/**
 * Phase 3b · telas (B0, frozen for both lanes): the approved board's world and its files for the column-mapping
 * import (ImportarConta, canvas version 67, 19 scenarios; contract §4.3). Lives outside __tests__ so Jest does not run
 * it as a suite. Every account, row, number and ID is invented; rows 1–3 of each file are the board's own (IC l.623
 * `desc`, l.841–1065; Tradovate's `LIN_TV`, IC l.870–873), so every «ex.:» sample and «Confira 3 linhas» row is the
 * board's. Each file is composed to the board's numbers; __tests__/testing/mapeadoTelas.test.ts pins them through the
 * domain and lib/hub/importMapeado only.
 *
 *   HOJE_QUADRO                Thursday 15 Oct 2026, 11:00 ET: «hoje» of the board
 *   CONTAS_QUADRO              the board's accounts (IC l.1180–1186), via makeAccount; contasQuadro() the list
 *   DESDE_QUADRO               each account's first rule version (L2's rules fixture builds on it)
 *   ARQUIVOS_QUADRO            { nome, texto } per key; arquivoQuadro(key) a File, lidoQuadro(key) readImportFile's answer
 *   CONTA_DO_ARQUIVO           the account each file is imported into on the board
 *   MODELO_*_LINHA / modelo*() the saved models «BlackArrow» and «Tradovate» (an import_templates row, and its Template)
 *
 * jsdom has no TextDecoder: decodeCsvBytes would fall back to windows-1252 and garble «Líq.» or «Nº». Importing this
 * module gives jsdom Node's TextDecoder, so lerArquivoMapeavel reads arquivoQuadro(key) as a browser does.
 */
import { TextDecoder as NodeTextDecoder } from 'util'
import {
  headerSignature,
  normaliseHeaders,
  parseImportText,
  templateFromRow,
  utf8Bytes,
  type FieldKey,
  type ReadImportFileResult,
  type Template,
} from '@/lib/domain/import'
import type { TradingAccount } from '@/lib/hub/contas'
import { makeAccount } from '@/testing/hubHarness'
import { BINANCE, BLACKARROW, BLACKARROW_FIELDS, IBKR, PERFORMANCE, TRADOVATE, TRADOVATE_OPEN, TV_FIELDS, TV_HEADER } from '@/testing/mappedFiles'

if (typeof globalThis.TextDecoder === 'undefined') {
  Object.defineProperty(globalThis, 'TextDecoder', { value: NodeTextDecoder, configurable: true, writable: true })
}

/** Thursday 15 Oct 2026, 11:00 ET */
export const HOJE_QUADRO = new Date('2026-10-15T15:00:00Z')

// ------------------------------------------------------------------------------------------------
// The accounts
// ------------------------------------------------------------------------------------------------

const id = (n: number) => `3b0c0a00-0000-4000-8000-${String(n).padStart(12, '0')}`
const CONFIRMADO = '2026-10-01T12:00:00Z'

/**
 * The board's accounts (IC l.1180–1186). The app sorts by market, then sort_order, then created_at (makeAccount gives
 * one date): topOne 0, apexA 1, ylos 2, lucid 3 give the board's menu «Top One, Apex A, Ylos 50k, Lucid 50k»
 * (IC l.1181); every other account 0. `ylosDepois` is Ylos 50k after scenario 8's import (its zone confirmed).
 */
export const CONTAS_QUADRO = {
  topOne: makeAccount({
    id: id(1),
    market: 'futures',
    label: 'Top One',
    platform: 'topone',
    phase: 'financiada',
    file_tz: 'UTC',
    tz_applied_at: CONFIRMADO,
    is_primary: true,
    sort_order: 0,
  }),
  ylos: makeAccount({
    id: id(2),
    market: 'futures',
    label: 'Ylos 50k',
    platform: 'blackarrow',
    firm: 'Ylos Trading',
    phase: 'avaliacao',
    file_tz: 'America/New_York',
    sort_order: 2,
  }),
  ylosDepois: makeAccount({
    id: id(2),
    market: 'futures',
    label: 'Ylos 50k',
    platform: 'blackarrow',
    firm: 'Ylos Trading',
    phase: 'avaliacao',
    file_tz: 'America/New_York',
    tz_applied_at: '2026-10-15T14:30:00Z',
    sort_order: 2,
  }),
  lucid: makeAccount({
    id: id(3),
    market: 'futures',
    label: 'Lucid 50k',
    platform: 'tradovate',
    firm: 'Lucid Trading',
    phase: 'avaliacao',
    file_tz: 'America/New_York',
    sort_order: 3,
  }),
  apexA: makeAccount({
    id: id(4),
    market: 'futures',
    label: 'Apex A',
    platform: 'ninja',
    firm: 'Apex Trader Funding',
    external_ref: 'APX-0001',
    phase: 'avaliacao',
    file_tz: 'America/New_York',
    sort_order: 1,
  }),
  e8: makeAccount({
    id: id(5),
    market: 'forex',
    label: 'E8 50k',
    platform: 'matchtrader',
    firm: 'E8 Markets',
    phase: 'avaliacao',
    file_tz: 'America/New_York',
  }),
  ibkr: makeAccount({ id: id(6), market: 'stocks', label: 'IBKR', platform: 'ibkr', phase: 'pessoal', file_tz: 'America/New_York' }),
  binance: makeAccount({ id: id(7), market: 'crypto', label: 'Binance', platform: 'binance', phase: 'pessoal', file_tz: 'UTC' }),
  mini: makeAccount({ id: id(8), market: 'b3', label: 'Mini-índice', platform: 'profit', phase: 'pessoal', file_tz: 'America/Sao_Paulo' }),
  ebinex: makeAccount({ id: id(9), market: 'binary', label: 'Ebinex', platform: 'ebinex', phase: 'pessoal', file_tz: 'America/Sao_Paulo' }),
} satisfies Record<string, TradingAccount>

export type ContaQuadro = keyof typeof CONTAS_QUADRO

/** The world's accounts as fetchAccounts reads them: Ylos 50k before scenario 8's import, or after it (`depois`) */
export function contasQuadro(depois = false): TradingAccount[] {
  const c = CONTAS_QUADRO
  return [c.topOne, depois ? c.ylosDepois : c.ylos, c.lucid, c.apexA, c.e8, c.ibkr, c.binance, c.mini, c.ebinex]
}

/** Each account's rules «desde» (its first rule version): 14 out for Top One, Ylos 50k and Apex A; 15 out for the others */
export const DESDE_QUADRO: Readonly<Record<ContaQuadro, string>> = {
  topOne: '2026-10-14',
  ylos: '2026-10-14',
  ylosDepois: '2026-10-14',
  apexA: '2026-10-14',
  lucid: '2026-10-15',
  e8: '2026-10-15',
  ibkr: '2026-10-15',
  binance: '2026-10-15',
  mini: '2026-10-15',
  ebinex: '2026-10-15',
}

// ------------------------------------------------------------------------------------------------
// The files
// ------------------------------------------------------------------------------------------------

/**
 * 8 · BlackArrow (Ylos 50k), 18 rows: BLACKARROW's header and three rows, then 15 more on 1–13 Oct (weekdays). Entries
 * 09:31–10:58 on the wall clock: 8 in 09:30–09:59, 6 in 10:00–10:29, 4 in 10:30–10:59 (IC l.1084); MESZ6 and MNQZ6
 * only; 21 contracts; each «Res. Líq.» = the price result − 1,24 × Qtd and «Corretagem» = 1,24 × Qtd, so Σ «Res. Líq.»
 * 15,21, Σ «Corretagem» 26,04 and the gross 41,25; every money and price cell has a comma part.
 */
const F8_MAIS = [
  '02/10/2026 09:31:12;MNQZ6;C;1;25.180,25;25.191,75;21,76;1,24;83401',
  '02/10/2026 09:48:30;MESZ6;V;1;6.812,50;6.809,00;16,26;1,24;83412',
  '02/10/2026 10:12:05;MESZ6;C;2;6.815,25;6.811,75;-37,48;2,48;83420',
  '05/10/2026 09:37:44;MNQZ6;V;1;25.240,00;25.236,50;5,76;1,24;83433',
  '05/10/2026 10:05:19;MESZ6;C;1;6.820,00;6.824,25;20,01;1,24;83447',
  '06/10/2026 09:42:08;MESZ6;V;1;6.830,75;6.834,00;-17,49;1,24;83458',
  '06/10/2026 10:18:51;MNQZ6;C;1;25.310,50;25.302,25;-17,74;1,24;83466',
  '07/10/2026 09:55:02;MESZ6;C;1;6.841,00;6.845,50;21,26;1,24;83479',
  '07/10/2026 10:44:36;MNQZ6;V;1;25.355,75;25.349,25;11,76;1,24;83485',
  '08/10/2026 09:39:27;MESZ6;V;2;6.838,25;6.836,00;20,02;2,48;83492',
  '08/10/2026 10:22:14;MESZ6;C;1;6.829,50;6.826,25;-17,49;1,24;83503',
  '09/10/2026 10:26:40;MNQZ6;C;1;25.402,00;25.396,75;-11,74;1,24;83517',
  '12/10/2026 10:09:33;MESZ6;V;1;6.851,25;6.848,75;11,26;1,24;83524',
  '12/10/2026 10:36:58;MNQZ6;C;1;25.420,25;25.418,25;-5,24;1,24;83536',
  '13/10/2026 10:58:21;MNQZ6;C;1;25.440,00;25.440,50;-0,24;1,24;83541',
]

/**
 * 15 · the same BlackArrow export two days later: f8's 18 rows (already imported) + 6 rows on 14–15 Oct, 7 contracts,
 * Σ «Res. Líq.» 53,82, Σ «Corretagem» 8,68 (gross 62,50), new IDs; the whole file: gross 103,75, commissions 34,72
 */
const F15_MAIS = [
  '14/10/2026 09:36:10;MESZ6;C;1;6.872,00;6.877,50;26,26;1,24;83552',
  '14/10/2026 10:04:45;MNQZ6;V;1;25.480,50;25.474,00;11,76;1,24;83560',
  '14/10/2026 10:41:20;MESZ6;V;2;6.880,25;6.882,00;-19,98;2,48;83571',
  '15/10/2026 09:33:05;MNQZ6;C;1;25.501,25;25.509,75;15,76;1,24;83585',
  '15/10/2026 09:58:42;MESZ6;C;1;6.890,50;6.894,00;16,26;1,24;83592',
  '15/10/2026 10:20:17;MNQZ6;V;1;25.522,00;25.519,50;3,76;1,24;83604',
]
/** 15 · «Uma coluna a mais»: the board's first three «Estratégia» values (IC l.809), then the same words in turn */
const ESTRATEGIAS = ['Rompimento', 'Pullback', 'Rompimento', 'Reversão', 'Pullback', 'Rompimento']

const F8 = [BLACKARROW, ...F8_MAIS].join('\r\n')
const F15 = [BLACKARROW, ...F8_MAIS, ...F15_MAIS].join('\r\n')
const F15B = F15.split('\r\n')
  .map((l, i) => `${l};${i === 0 ? 'Estratégia' : ESTRATEGIAS[(i - 1) % ESTRATEGIAS.length]}`)
  .join('\r\n')

/**
 * 8 · Performance.csv of Tradovate (Lucid 50k), 6 rows: PERFORMANCE's four, then one buy of 2 MESZ6 at 6812.25 (10:31:05)
 * sold 1 at 6816.00 (10:38:40) and 1 at 6819.50 (10:44:12), the same buyFillId. 4 positions: +23,75 (37.50, −13.75),
 * +7,50, +17,00, +55,00 (18.75, 36.25); entries 10:31, 11:02, 11:05, 11:20 (IC l.1133: 1 and 3 per half hour)
 */
const F8P = [
  PERFORMANCE,
  'MESZ6,1,6812.25,6816.00,$18.75,10/13/2026 10:31:05,10/13/2026 10:38:40,7min 35sec,9912001,9912003',
  'MESZ6,1,6812.25,6819.50,$36.25,10/13/2026 10:31:05,10/13/2026 10:44:12,13min 7sec,9912001,9912004',
].join('\n')

/**
 * 16 · Tradovate Orders: TRADOVATE / TRADOVATE_OPEN with physical lines 2, 4 and 5 as the board's LIN_TV (IC l.870–873):
 * only the ignored «Timestamp» (10:31:04, 10:31:05, 10:43:58) and «Limit Price» (empty, 6816.00, 6819.50) change, so the
 * samples read «ex.: 10/13/2026 10:31:04» and «ex.: 6816.00» as the board
 */
const LIN_TV = [
  '8801201,LT50K-0193,Buy,MESZ6,6812.25,2,10/13/2026 10:31:05,Filled,10/13/2026 10:31:04,2,,2,6812.25',
  '8801203,LT50K-0193,Sell,MESZ6,6816.00,1,10/13/2026 10:38:40,Filled,10/13/2026 10:31:05,1,6816.00,1,6816.00',
  '8801204,LT50K-0193,Sell,MESZ6,6819.50,1,10/13/2026 10:44:12,Filled,10/13/2026 10:43:58,1,6819.50,1,6819.50',
]
function comLinhasDoQuadro(texto: string): string {
  const linhas = texto.split('\n')
  linhas[1] = LIN_TV[0]
  linhas[3] = LIN_TV[1]
  linhas[4] = LIN_TV[2]
  return linhas.join('\n')
}

/** 16 (N, no board): Tradovate Orders of two accounts, each with a closed round trip and a last buy left open */
const tvConta = (orderId: string, conta: string, lado: string, qtd: string, executada: string, preco: string, hora: string, status: string) =>
  [orderId, conta, lado, 'MESZ6', preco, executada, hora, status, hora, qtd, preco, executada, preco].join(',')
const F16C = [
  TV_HEADER,
  tvConta('8802101', 'LT50K-0193', 'Buy', '1', '1', '6830.25', '10/14/2026 09:41:10', 'Filled'),
  tvConta('8802102', 'LT50K-0194', 'Buy', '1', '1', '6831.00', '10/14/2026 09:43:20', 'Filled'),
  tvConta('8802103', 'LT50K-0193', 'Sell', '1', '1', '6834.50', '10/14/2026 09:52:05', 'Filled'),
  tvConta('8802104', 'LT50K-0193', 'Sell', '1', '0', '', '', 'Canceled'),
  tvConta('8802105', 'LT50K-0194', 'Sell', '1', '1', '6829.75', '10/14/2026 09:58:40', 'Filled'),
  tvConta('8802106', 'LT50K-0193', 'Buy', '1', '1', '6836.00', '10/14/2026 10:12:30', 'Filled'),
  tvConta('8802107', 'LT50K-0194', 'Buy', '1', '1', '6833.25', '10/14/2026 10:20:15', 'Filled'),
].join('\n')

/**
 * 17 · NinjaTrader's Trades grid (Apex A), 57 rows: NINJA's header and first three rows, then 54 more on 2–13 Oct
 * (weekdays, every entry before 14 Oct in New York). APX-0001 31 trades (MNQ 12-26 and MES 12-26), 36 contracts, Σ Profit
 * 186,50, Σ Commission 44,64; per half hour 10, 8, 6, 4, 3 from 09:30 (the board's 5:4:3:2:1 cannot be met by 31, §11.1
 * #6); APX-0002 26 trades, 30 contracts, 141,25 / 37,20. For each value the first entry 09:31 and the last 11:58; each
 * «Profit» the price result (gross), each «Commission» 1,24 × Qty.
 */
const F17 = [
  'Trade number,Instrument,Account,Market pos.,Qty,Entry price,Exit price,Entry time,Exit time,Profit,Commission',
  '1,MNQ 12-26,APX-0001,Short,1,25140.25,25131.75,10/1/2026 9:31:05 AM,10/1/2026 9:38:40 AM,17.00,1.24',
  '2,MES 12-26,APX-0002,Long,2,6803.50,6809.75,10/1/2026 9:52:10 AM,10/1/2026 10:04:33 AM,62.50,2.48',
  '3,MNQ 12-26,APX-0001,Long,1,25160.00,25151.25,10/1/2026 10:15:02 AM,10/1/2026 10:21:47 AM,-17.50,1.24',
  '4,MES 12-26,APX-0001,Long,1,6791.75,6790.00,10/2/2026 9:36:45 AM,10/2/2026 9:49:16 AM,-8.75,1.24',
  '5,MNQ 12-26,APX-0001,Long,1,25143.50,25146.50,10/2/2026 10:02:29 AM,10/2/2026 10:07:00 AM,6.00,1.24',
  '6,MES 12-26,APX-0002,Long,1,6795.25,6798.75,10/2/2026 10:06:55 AM,10/2/2026 10:09:26 AM,17.50,1.24',
  '7,MNQ 12-26,APX-0001,Long,1,25147.00,25149.75,10/2/2026 10:35:13 AM,10/2/2026 10:44:44 AM,5.50,1.24',
  '8,MNQ 12-26,APX-0002,Long,1,25148.75,25153.25,10/2/2026 10:52:39 AM,10/2/2026 10:59:10 AM,9.00,1.24',
  '9,MES 12-26,APX-0001,Long,1,6800.50,6804.50,10/2/2026 11:27:57 AM,10/2/2026 11:40:28 AM,20.00,1.24',
  '10,MNQ 12-26,APX-0002,Long,1,25152.25,25157.00,10/2/2026 11:44:23 AM,10/2/2026 11:55:54 AM,9.50,1.24',
  '11,MNQ 12-26,APX-0002,Short,1,25154.00,25152.50,10/5/2026 9:35:50 AM,10/5/2026 9:49:21 AM,3.00,1.24',
  '12,MES 12-26,APX-0001,Short,1,6805.75,6807.00,10/5/2026 9:44:24 AM,10/5/2026 9:48:55 AM,-6.25,1.24',
  '13,MNQ 12-26,APX-0001,Short,1,25157.50,25151.00,10/5/2026 10:12:08 AM,10/5/2026 10:20:39 AM,13.00,1.24',
  '14,MES 12-26,APX-0002,Short,1,6809.25,6806.50,10/5/2026 10:26:34 AM,10/5/2026 10:32:05 AM,13.75,1.24',
  '15,MNQ 12-26,APX-0001,Short,2,25161.00,25156.75,10/5/2026 10:49:52 AM,10/5/2026 11:01:23 AM,17.00,2.48',
  '16,MNQ 12-26,APX-0002,Short,1,25162.75,25158.75,10/5/2026 11:10:18 AM,10/5/2026 11:20:49 AM,8.00,1.24',
  '17,MNQ 12-26,APX-0001,Short,1,25164.50,25156.25,10/5/2026 11:58:36 AM,10/5/2026 12:02:07 PM,16.50,1.24',
  '18,MES 12-26,APX-0001,Long,1,6816.25,6820.75,10/6/2026 9:53:03 AM,10/6/2026 10:00:34 AM,22.50,1.24',
  '19,MNQ 12-26,APX-0002,Long,1,25168.00,25174.25,10/6/2026 9:55:29 AM,10/6/2026 10:00:00 AM,12.50,1.24',
  '20,MNQ 12-26,APX-0001,Long,1,25169.75,25175.25,10/6/2026 10:27:47 AM,10/6/2026 10:38:18 AM,11.00,1.24',
  '21,MES 12-26,APX-0002,Long,1,6821.50,6822.75,10/6/2026 10:42:13 AM,10/6/2026 10:51:44 AM,6.25,1.24',
  '22,MNQ 12-26,APX-0001,Long,1,25173.25,25179.00,10/6/2026 11:12:31 AM,10/6/2026 11:15:02 AM,11.50,1.24',
  '23,MNQ 12-26,APX-0002,Long,1,25175.00,25173.75,10/6/2026 11:31:57 AM,10/6/2026 11:44:28 AM,-2.50,1.24',
  '24,MNQ 12-26,APX-0001,Short,2,25176.75,25174.25,10/7/2026 9:38:58 AM,10/7/2026 9:44:29 AM,10.00,2.48',
  '25,MES 12-26,APX-0001,Short,1,6828.50,6824.75,10/7/2026 10:05:42 AM,10/7/2026 10:15:13 AM,18.75,1.24',
  '26,MNQ 12-26,APX-0002,Short,1,25140.25,25145.25,10/7/2026 10:11:08 AM,10/7/2026 10:19:39 AM,-10.00,1.24',
  '27,MNQ 12-26,APX-0001,Short,1,25142.00,25137.00,10/7/2026 10:40:26 AM,10/7/2026 10:54:57 AM,10.00,1.24',
  '28,MES 12-26,APX-0002,Short,1,6793.75,6796.25,10/7/2026 10:58:52 AM,10/7/2026 11:10:23 AM,-12.50,1.24',
  '29,MNQ 12-26,APX-0001,Short,2,25145.50,25146.25,10/7/2026 11:34:10 AM,10/7/2026 11:40:41 AM,-3.00,2.48',
  '30,MNQ 12-26,APX-0002,Short,1,25147.25,25150.25,10/7/2026 11:51:36 AM,10/7/2026 11:55:07 AM,-6.00,1.24',
  '31,MNQ 12-26,APX-0002,Long,1,25149.00,25153.25,10/8/2026 9:40:03 AM,10/8/2026 9:47:34 AM,8.50,1.24',
  '32,MNQ 12-26,APX-0001,Long,1,25150.75,25158.00,10/8/2026 9:47:37 AM,10/8/2026 9:56:08 AM,14.50,1.24',
  '33,MES 12-26,APX-0001,Long,1,6802.50,6804.75,10/8/2026 10:18:21 AM,10/8/2026 10:31:52 AM,11.25,1.24',
  '34,MNQ 12-26,APX-0002,Long,1,25154.25,25151.00,10/8/2026 10:33:47 AM,10/8/2026 10:44:18 AM,-6.50,1.24',
  '35,MNQ 12-26,APX-0001,Long,1,25156.00,25155.75,10/8/2026 10:55:05 AM,10/8/2026 11:00:36 AM,-0.50,1.24',
  '36,MES 12-26,APX-0002,Long,1,6807.75,6805.75,10/8/2026 11:16:31 AM,10/8/2026 11:19:02 AM,-10.00,1.24',
  '37,MNQ 12-26,APX-0001,Short,1,25159.50,25151.00,10/9/2026 9:33:32 AM,10/9/2026 9:41:03 AM,17.00,1.24',
  '38,MNQ 12-26,APX-0001,Short,2,25161.25,25165.25,10/9/2026 9:57:16 AM,10/9/2026 10:09:47 AM,-16.00,2.48',
  '39,MNQ 12-26,APX-0002,Short,1,25163.00,25164.00,10/9/2026 10:01:42 AM,10/9/2026 10:11:13 AM,-2.00,1.24',
  '40,MES 12-26,APX-0001,Short,1,6814.75,6816.25,10/9/2026 10:31:00 AM,10/9/2026 10:35:31 AM,-7.50,1.24',
  '41,MNQ 12-26,APX-0002,Short,1,25166.50,25168.00,10/9/2026 10:47:26 AM,10/9/2026 11:01:57 AM,-3.00,1.24',
  '42,MNQ 12-26,APX-0001,Short,1,25168.25,25170.25,10/9/2026 11:21:44 AM,10/9/2026 11:29:15 AM,-4.00,1.24',
  '43,MES 12-26,APX-0002,Short,1,6820.00,6817.50,10/9/2026 11:37:10 AM,10/9/2026 11:43:41 AM,12.50,1.24',
  '44,MES 12-26,APX-0002,Long,1,6821.75,6819.00,10/12/2026 9:31:37 AM,10/12/2026 9:40:08 AM,-13.75,1.24',
  '45,MNQ 12-26,APX-0001,Long,1,25173.50,25178.75,10/12/2026 9:41:11 AM,10/12/2026 9:52:42 AM,10.50,1.24',
  '46,MNQ 12-26,APX-0001,Long,1,25175.25,25173.00,10/12/2026 10:09:55 AM,10/12/2026 10:12:26 AM,-4.50,1.24',
  '47,MNQ 12-26,APX-0002,Long,1,25177.00,25179.00,10/12/2026 10:20:21 AM,10/12/2026 10:33:52 AM,4.00,1.24',
  '48,MES 12-26,APX-0001,Long,1,6828.75,6827.75,10/12/2026 10:44:39 AM,10/12/2026 10:51:10 AM,-5.00,1.24',
  '49,MNQ 12-26,APX-0002,Long,1,25140.50,25142.25,10/12/2026 11:05:05 AM,10/12/2026 11:10:36 AM,3.50,1.24',
  '50,MNQ 12-26,APX-0001,Long,1,25142.25,25148.25,10/12/2026 11:46:23 AM,10/12/2026 11:57:54 AM,12.00,1.24',
  '51,MNQ 12-26,APX-0002,Long,1,25144.00,25156.25,10/12/2026 11:58:49 AM,10/12/2026 12:07:20 PM,24.50,1.24',
  '52,MES 12-26,APX-0002,Short,2,6795.75,6798.00,10/13/2026 9:45:16 AM,10/13/2026 9:57:47 AM,-22.50,2.48',
  '53,MNQ 12-26,APX-0001,Short,1,25147.50,25147.50,10/13/2026 9:50:50 AM,10/13/2026 10:04:21 AM,0.00,1.24',
  '54,MNQ 12-26,APX-0001,Short,2,25149.25,25149.75,10/13/2026 10:23:34 AM,10/13/2026 10:29:05 AM,-2.00,2.48',
  '55,MNQ 12-26,APX-0002,Short,2,25151.00,25145.50,10/13/2026 10:38:00 AM,10/13/2026 10:42:31 AM,22.00,2.48',
  '56,MES 12-26,APX-0001,Short,1,6802.75,6799.25,10/13/2026 11:03:18 AM,10/13/2026 11:13:49 AM,17.50,1.24',
  '57,MNQ 12-26,APX-0002,Short,2,25154.50,25151.25,10/13/2026 11:24:44 AM,10/13/2026 11:32:15 AM,13.00,2.48',
].join('\n')

/**
 * 18 · Forex closed positions (E8 50k), 14 rows: FOREX's header and three rows, then 11 more on 13–14 Oct: 2 EURGBP rows,
 * 12 of EURUSD, GBPUSD, AUDUSD, NZDUSD (each «Profit» = the price result); Σ Profit 218,60, Σ Swap −6,20 (row 3 only),
 * Σ |Commission| 40,25 (7,00 per lot). Entries 06:05–15:59 but row 3 (13 Oct 17:48:55, the last): New York and Chicago
 * move exactly one trade to another day, UTC none (§11.1 #2). Per half hour (IC l.1119) 06:00 ×1, 08:30 ×2, 09:00 ×2,
 * 09:30, 10:00, 10:30, 12:00, 13:00, 14:30, 15:00, 15:30 ×1 each (the board's 16:00 trade sits at 15:30), 17:30 ×1.
 */
const F18_LINHAS = [
  'Position ID,Open Time,Close Time,Symbol,Side,Volume,Open Price,Close Price,Swap,Commission,Profit',
  '4410023,14.10.2026 08:40:12,14.10.2026 10:05:47,EURUSD,BUY,0.50,1.08520,1.08635,0.00,-3.50,57.50',
  '4410031,14.10.2026 09:12:30,14.10.2026 09:58:02,EURGBP,SELL,0.25,0.86410,0.86350,0.00,-1.75,19.84',
  '4409988,13.10.2026 17:48:55,14.10.2026 17:20:10,EURUSD,SELL,1.00,1.08710,1.08745,-6.20,-7.00,-35.00',
  '4410002,14.10.2026 06:05:33,14.10.2026 06:48:10,EURUSD,BUY,0.50,1.08410,1.08490,0.00,-3.50,40.00',
  '4409971,13.10.2026 08:52:18,13.10.2026 09:30:44,GBPUSD,SELL,0.30,1.33250,1.33190,0.00,-2.10,18.00',
  '4409975,13.10.2026 09:21:05,13.10.2026 09:47:39,EURUSD,BUY,0.25,1.08455,1.08503,0.00,-1.75,12.00',
  '4409979,13.10.2026 09:41:27,13.10.2026 10:15:02,AUDUSD,BUY,0.20,0.65820,0.65771,0.00,-1.40,-9.80',
  '4410040,14.10.2026 10:07:51,14.10.2026 10:52:16,NZDUSD,SELL,0.40,0.59410,0.59362,0.00,-2.80,19.20',
  '4409983,13.10.2026 10:33:40,13.10.2026 11:20:05,EURGBP,BUY,0.25,0.86280,0.86331,0.00,-1.75,16.86',
  '4410052,14.10.2026 12:14:09,14.10.2026 12:58:31,EURUSD,SELL,0.50,1.08602,1.08655,0.00,-3.50,-26.50',
  '4409990,13.10.2026 13:09:22,13.10.2026 14:02:48,GBPUSD,BUY,0.35,1.33105,1.33221,0.00,-2.45,40.60',
  '4410061,14.10.2026 14:38:55,14.10.2026 15:20:13,EURUSD,BUY,0.40,1.08540,1.08597,0.00,-2.80,22.80',
  '4409994,13.10.2026 15:12:30,13.10.2026 15:58:07,AUDUSD,SELL,0.30,0.65905,0.65842,0.00,-2.10,18.90',
  '4410070,14.10.2026 15:44:16,14.10.2026 16:30:42,NZDUSD,BUY,0.55,0.59330,0.59374,0.00,-3.85,24.20',
]
const F18 = F18_LINHAS.join('\n')
/** 18 · «Datas ambíguas»: the same rows on 8–9 Oct (every day ≤ 12, the board's LIN_FXA) */
const F18A = F18.replace(/14\.10\.2026/g, '09.10.2026').replace(/13\.10\.2026/g, '08.10.2026')

/**
 * 19 · B3 (Mini-índice, Profit), 18 rows on 14 Oct: B3's header and first three rows, then 15 more. «X» sides on physical
 * lines 6 and 11, an empty side on line 15, line 9 a WIN price off its 5 tick; every other WIN price on the tick and
 * written «131.250»-like, WDO «5.412,5»-like; money with a comma part. Entries 10:02–16:40 (Brasília), per half hour
 * 10:00 ×4, 10:30 ×3, 11:00 ×3, 13:00 ×2, 14:00 ×2, 14:30 ×2, 16:30 ×2 (IC l.1125), line 9 at 11:00 and line 15 at 14:00.
 * Each «Res. Líq.» = the price result − «Corretagem» − «Emolumentos»: over the 16 rows that import (X = Venda) Σ 389,50
 * and the costs 22,50 (gross 412,00); lines 6 and 11 together −1,90 and 0,90 (gross −1,00).
 */
const F19 = [
  'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Res. Líq.;Corretagem;Emolumentos;Nº Negócio',
  '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;88,50;0,90;0,60;77120',
  '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;-31,00;0,60;0,40;77134',
  '14/10/2026 11:20:05;WDOX26;C;1;5.412,5;5.419,0;64,25;0,50;0,25;77152',
  '14/10/2026 10:08:30;WINZ26;C;3;131.180;131.260;46,50;0,90;0,60;77158',
  '14/10/2026 10:21:15;WINZ26;X;1;131.300;131.290;1,50;0,30;0,20;77163',
  '14/10/2026 10:34:02;WINZ26;V;2;131.350;131.275;29,00;0,60;0,40;77171',
  '14/10/2026 10:41:48;WDOX26;V;2;5.421,0;5.415,5;108,50;1,00;0,50;77176',
  '14/10/2026 11:05:12;WINZ26;C;1;131.002;131.100;19,00;0,30;0,20;77181',
  '14/10/2026 10:52:30;WINZ26;C;4;131.220;131.190;-26,00;1,20;0,80;77188',
  '14/10/2026 11:12:40;WINZ26;X;1;131.150;131.165;-3,40;0,25;0,15;77194',
  '14/10/2026 13:04:25;WDOX26;C;2;5.408,0;5.411,5;68,50;1,00;0,50;77203',
  '14/10/2026 13:27:10;WINZ26;V;3;131.050;131.120;-43,50;0,90;0,60;77209',
  '14/10/2026 14:09:55;WINZ26;C;5;131.000;131.085;82,50;1,50;1,00;77215',
  '14/10/2026 14:21:33;WINZ26;;2;131.150;131.200;19,00;0,60;0,40;77222',
  '14/10/2026 14:33:18;WDOX26;V;1;5.405,5;5.409,0;-35,75;0,50;0,25;77230',
  '14/10/2026 14:52:06;WINZ26;C;3;131.105;131.170;37,50;0,90;0,60;77237',
  '14/10/2026 16:31:44;WINZ26;V;5;131.400;131.345;52,50;1,50;1,00;77245',
  '14/10/2026 16:40:20;WINZ26;C;4;131.240;131.180;-50,10;1,20;0,90;77251',
].join('\n')

/**
 * 19 · «Só preços»: no result and no costs, 18 WIN rows (the board's LIN_B3P first), the same side and tick lines; no
 * number cell decides the mark (every price reads «131.250»-like): the decimal question, with the comma pre-selected; read
 * with the point, every WIN price is off its tick
 */
const F19P = [
  'Data/Hora;Papel;C/V;Qtd;Pr. Entrada;Pr. Saída;Nº Negócio',
  '14/10/2026 10:02:11;WINZ26;V;3;131.250;131.100;77120',
  '14/10/2026 10:15:40;WINZ26;C;2;131.400;131.325;77134',
  '14/10/2026 10:48:22;WINZ26;V;1;131.180;131.055;77141',
  '14/10/2026 10:08:30;WINZ26;C;3;131.180;131.260;77158',
  '14/10/2026 10:21:15;WINZ26;X;1;131.300;131.290;77163',
  '14/10/2026 10:34:02;WINZ26;V;2;131.350;131.275;77171',
  '14/10/2026 10:41:48;WINZ26;V;2;131.210;131.135;77176',
  '14/10/2026 11:05:12;WINZ26;C;1;131.002;131.100;77181',
  '14/10/2026 10:52:30;WINZ26;C;4;131.220;131.190;77188',
  '14/10/2026 11:12:40;WINZ26;X;1;131.150;131.165;77194',
  '14/10/2026 13:04:25;WINZ26;C;2;131.040;131.115;77203',
  '14/10/2026 13:27:10;WINZ26;V;3;131.050;131.120;77209',
  '14/10/2026 14:09:55;WINZ26;C;5;131.000;131.085;77215',
  '14/10/2026 14:21:33;WINZ26;;2;131.150;131.200;77222',
  '14/10/2026 14:33:18;WINZ26;V;1;131.085;131.110;77230',
  '14/10/2026 14:52:06;WINZ26;C;3;131.105;131.170;77237',
  '14/10/2026 16:31:44;WINZ26;V;5;131.400;131.345;77245',
  '14/10/2026 16:40:20;WINZ26;C;4;131.240;131.180;77251',
].join('\n')

/** 9 · «Arquivo que não abre»: no line of two cells or more (sniffFile: header_not_found) */
const F9_ILEGIVEL = ['Relatório de operações', 'Período: 01/10/2026 a 15/10/2026', 'Nenhuma operação encontrada.'].join('\n')

export type ArquivoQuadroKey =
  | 'f8'
  | 'f8p'
  | 'f15'
  | 'f15b'
  | 'f16t'
  | 'f16ta'
  | 'f16b'
  | 'f16i'
  | 'f16c'
  | 'f17'
  | 'f18'
  | 'f18a'
  | 'f19'
  | 'f19p'
  | 'f9ilegivel'

/** The board's files (IC scenario · variant in the comment), each { file name, text } */
export const ARQUIVOS_QUADRO: Readonly<Record<ArquivoQuadroKey, { nome: string; texto: string }>> = {
  /** 8 · «Conta sem outro formato» / «Conta que já recebe outro formato» (BlackArrow, 18 linhas) */
  f8: { nome: 'blackarrow.csv', texto: F8 },
  /** 8 · «Performance.csv da Tradovate» (6 linhas) */
  f8p: { nome: 'Performance.csv', texto: F8P },
  /** 15 · «As mesmas colunas» (24 linhas) */
  f15: { nome: 'blackarrow-2.csv', texto: F15 },
  /** 15 · «Uma coluna a mais» (24 linhas + Estratégia) */
  f15b: { nome: 'blackarrow-estrategia.csv', texto: F15B },
  /** 16 · «Tradovate (futuros)» (Orders, 11 linhas) */
  f16t: { nome: 'tradovate-ordens.csv', texto: comLinhasDoQuadro(TRADOVATE) },
  /** 16 · «Tradovate, termina posicionado» (13 linhas) */
  f16ta: { nome: 'tradovate-posicionado.csv', texto: comLinhasDoQuadro(TRADOVATE_OPEN) },
  /** 16 · «Binance (cripto)» (8 linhas) */
  f16b: { nome: 'binance.csv', texto: BINANCE },
  /** 16 · «Interactive Brokers (ações)» (8 linhas) */
  f16i: { nome: 'ibkr.csv', texto: IBKR },
  /** N (no board): Tradovate Orders with two «Account» values (§6.7's end-of-file answers across hc) */
  f16c: { nome: 'tradovate-duas-contas.csv', texto: F16C },
  /** 17 · «Duas contas no arquivo» (NinjaTrader, 57 linhas) */
  f17: { nome: 'ninjatrader.csv', texto: F17 },
  /** 18 · «Datas claras» (14 linhas) */
  f18: { nome: 'forex.csv', texto: F18 },
  /** 18 · «Datas ambíguas» */
  f18a: { nome: 'forex-datas.csv', texto: F18A },
  /** 19 · «Com resultado e custos» (18 linhas) */
  f19: { nome: 'b3.csv', texto: F19 },
  /** 19 · «Só preços» */
  f19p: { nome: 'b3-precos.csv', texto: F19P },
  /** 9 · «Arquivo que não abre» */
  f9ilegivel: { nome: 'relatorio.csv', texto: F9_ILEGIVEL },
}

/** The account each file goes to on the board (8 · «Conta que já recebe outro formato» is Top One's: 8g) */
export const CONTA_DO_ARQUIVO: Readonly<Record<ArquivoQuadroKey, ContaQuadro>> = {
  f8: 'ylos',
  f8p: 'lucid',
  f15: 'ylosDepois',
  f15b: 'ylosDepois',
  f16t: 'lucid',
  f16ta: 'lucid',
  f16b: 'binance',
  f16i: 'ibkr',
  f16c: 'lucid',
  f17: 'apexA',
  f18: 'e8',
  f18a: 'e8',
  f19: 'mini',
  f19p: 'mini',
  f9ilegivel: 'ylos',
}

/** The file as the input or a drop gives it */
export function arquivoQuadro(key: ArquivoQuadroKey): File {
  const a = ARQUIVOS_QUADRO[key]
  return new File([a.texto], a.nome, { type: 'text/csv' })
}

/** What the sheet's mocked readImportFile answers for the file */
export function lidoQuadro(key: ArquivoQuadroKey): ReadImportFileResult {
  const a = ARQUIVOS_QUADRO[key]
  return { fileName: a.nome, size: utf8Bytes(a.texto).length, sha256: 'ab'.repeat(32), outcome: parseImportText(a.texto) }
}

// ------------------------------------------------------------------------------------------------
// The saved models
// ------------------------------------------------------------------------------------------------

const cabecalho = (texto: string, separador: string) => normaliseHeaders(texto.split(/\r?\n/)[0].split(separador))
const colunasPorNome = (headers: readonly string[], campos: Record<string, FieldKey>) => {
  const out: Record<string, FieldKey> = {}
  for (const h of headers) if (campos[h]) out[h] = campos[h]
  return out
}

const BA_HEADERS = cabecalho(BLACKARROW, ';')
/** «BlackArrow» as import_templates holds it after scenario 8 (an import_templates row as PostgREST returns it) */
export const MODELO_BLACKARROW_LINHA = {
  id: '3b0c0a00-0000-4000-8000-0000000000b1',
  name: 'BlackArrow',
  header_sig: headerSignature(BA_HEADERS),
  headers: BA_HEADERS,
  header_skip: 0,
  delimiter: 'semicolon',
  decimal_mark: 'comma',
  date_order: 'dmy',
  row_kind: 'trade',
  columns: colunasPorNome(BA_HEADERS, BLACKARROW_FIELDS),
  result_is_net: true,
  side_words: {},
  open_close_words: {},
  account_routes: {},
  tz_hint: 'America/New_York',
  last_used_at: '2026-10-15T14:30:00Z',
} as const

const TV_HEADERS = cabecalho(TV_HEADER, ',')
/** «Tradovate» (the Orders file, one execution per row) as import_templates holds it after scenario 16 */
export const MODELO_TRADOVATE_LINHA = {
  id: '3b0c0a00-0000-4000-8000-0000000000b2',
  name: 'Tradovate',
  header_sig: headerSignature(TV_HEADERS),
  headers: TV_HEADERS,
  header_skip: 0,
  delimiter: 'comma',
  decimal_mark: 'point',
  date_order: 'mdy',
  row_kind: 'fill',
  columns: colunasPorNome(TV_HEADERS, TV_FIELDS),
  result_is_net: null,
  side_words: {},
  open_close_words: {},
  account_routes: {},
  tz_hint: 'America/New_York',
  last_used_at: '2026-10-15T14:45:00Z',
} as const

function modelo(linha: unknown): Template {
  const t = templateFromRow(linha)
  if (!t) throw new Error('model row not usable')
  return t
}

/** templateFromRow of MODELO_BLACKARROW_LINHA */
export const modeloBlackArrow = (): Template => modelo(MODELO_BLACKARROW_LINHA)
/** templateFromRow of MODELO_TRADOVATE_LINHA */
export const modeloTradovate = (): Template => modelo(MODELO_TRADOVATE_LINHA)
