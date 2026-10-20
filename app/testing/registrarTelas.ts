/**
 * Test helpers for the Phase 3 screens (PR 3-3). Lives outside __tests__ so Jest does not run it
 * as a suite.
 *
 * The JSON in fixtures/registrar-telas is what the real functions of migrations 20261020000001..4
 * answered, and what the API's table reads returned, on a throwaway local Postgres whose clock the
 * recorder moved between steps (__tests__/lib/hubRegistrarTelas.pg.test.ts, with BH_PG_RECORD; an
 * interposed clock read the shift from a file). Invented user and data, random ids (ids.json):
 *
 *   Accounts (contas: trading_accounts rows as fetchAccounts reads them): «Top One #1» (futures,
 *   topone, Financiada, primary; window 10:00–11:00 ET seg–sex, limit US$ 400 por conta,
 *   encerrar), «Ebinex» (binary, ebinex, Pessoal; 20:00–21:00 de Brasília seg–sex, no limit),
 *   «FTMO» (forex, mt5, Avaliação; 08:00–10:00 ET seg–sex, US$ 1.000): v1 saved Wed 14 Oct 2026
 *   09:00 ET («desde 14 out»). Thu 15 Oct: an invented import (Ebinex EUR/USD ×3, BTC/USDT; Top
 *   One MESZ6, MNQZ6). Then the approved board's scenario 10:
 *
 *   Wed 21 Oct
 *     entry-mnq-qua            10:52 ET register_entry MNQ long 1 @ 30880.50, stop 40, alvo 80, setup A
 *                              (left open overnight)
 *     entry-dry-fora-janela    11:05 ET register_entry dry run MES long 1 @ 7900: «Fora da sua janela»
 *                              (the owner's test), plan «● fora da janela»
 *     agora-qua-1105-et        11:05 ET rules_now()
 *   Thu 22 Oct (Top One)
 *     entry-mnq-qui            10:01 ET MNQ short 2 @ 30950, stop 60, alvo 120, setup B
 *     exit-mnq-perda           10:08 ET its exit @ 31011.25: −US$ 245
 *     extras-nota              its note «Entrei contra a abertura e saí no stop.» (save_extras)
 *     entry-mes                10:12 ET MES long 2 @ 7912.50, stop 10, alvo 20, setup A, execução no ponto
 *     entry-mgc                10:24 ET MGC short 1 @ 4421.30, stop 16, alvo 24, setup B
 *     marks-mes-aberta         10:31 ET add_marks «Calmo» on the open MES
 *     entry-dry-mes-digitada   10:31 ET dry run with «Hora» 10:20 («Na entrada:»): limit_room left 155,
 *                              risk 100
 *     entry-dry-es-acima       10:31 ET dry run ES long 1, stop 4: risk US$ 200 > US$ 155 left (the warning)
 *     undo-es                  10:31 ET undo_entry of a mistaken ES entry
 *     after-dry-ontem          10:31 ET register_after dry run, «Ontem» (21 Oct) MES short 2 10:33–10:49
 *                              @ 7938.50 → 7929.00: +US$ 95
 *     agora-qui-1031-et        10:31 ET rules_now(): Top One «Liberado · até 11:00 ET», US$ 245 de US$ 400
 *     abertas-qui-1031         the open trades' rows (fetchOpenTrades): MNQ (21 Oct), MES, MGC
 *     dia-qui-1031             «Operações do dia» rows (readDayTradesRows, day 2026-10-22)
 *     operacao-mes-aberta      the MES trade's rows (readTradeViewRows) while open
 *     recentes-top-one         the account's recent trades (RECENT_COLUMNS), newest first
 *     recentes-ebinex          the same for Ebinex
 *     exit-mes-oitenta         10:38 ET MES exit @ 7902.50: −US$ 100, the day at −US$ 345 (80 % crossed)
 *     slots-mes / extras-mes   image_slots for two WebP images and save_extras with them and a note
 *     exit-mgc-atingido        10:40 ET MGC exit @ 4437.30: −US$ 160, limit reached (−US$ 505), «Encerrado»
 *     exit-mnq-ontem           10:42 ET exit of yesterday's MNQ @ 30912.75: +US$ 64,50 (counts on 21 Oct)
 *     agora-qui-1042-et        10:42 ET rules_now(): Top One «Encerrado por hoje»
 *     dia-qui-1042             «Operações do dia» rows: the four closed, MES with 2 images and a note
 *     operacao-mes-fechada     the MES trade's rows, closed, with images and note
 *   Thu 22 Oct (Ebinex, de Brasília)
 *     entry-ebinex-put         20:10:20 EUR/USD Baixa US$ 20, 88 %, 1 min, setup B: vence às 20:12
 *     entry-dry-ebinex-m5      20:10 dry run, 5 min: vence às 20:20
 *     entry-dry-ebinex-m15     20:10 dry run, 15 min: vence às 20:30
 *     exit-ebinex-perda        20:12:30 «Perda»: −US$ 20
 *     marks-ebinex-depois      setup C after the expiry («depois do resultado»)
 *     after-dry-ebinex / after-ebinex  20:24 «Já fechada» GBP/USD Alta US$ 20, 87 %, 5 min at 20:13,
 *                              «Ganho»: +US$ 17,40
 *     agora-qui-2024-brt       20:24 rules_now(): Ebinex «Liberado · até 21:00 de Brasília»
 *     dia-ebinex               «Operações do dia» rows of Ebinex on 2026-10-22
 *
 * Never hand-write these shapes in tests: load them here (re-record with the suite above).
 */
import fs from 'fs';
import path from 'path';
import type { TradingAccount } from '@/lib/hub/contas';
import { parseRulesNow, type RulesNow } from '@/lib/hub/regras';
import {
  dayTradesOfRows,
  openTradesOfRows,
  parseAfterDryRun,
  parseAfterRegistered,
  parseEntryDryRun,
  parseExitRegistered,
  parseRegistered,
  parseTradeState,
  recentTradesOfRows,
  tradeViewOfRows,
  type AfterDryRun,
  type AfterRegistered,
  type DayTrade,
  type DayTradesRows,
  type EntryDryRun,
  type ExitRegistered,
  type Registered,
  type RegisteredTrade,
  type TradeState,
  type TradeView,
  type TradeViewRows,
} from '@/lib/hub/registrarDb';
import type { RecentTrade } from '@/lib/hub/registrar';

const DIR = path.join(__dirname, 'fixtures/registrar-telas');

export type TelasEntry = 'entry-mnq-qua' | 'entry-mnq-qui' | 'entry-mes' | 'entry-mgc' | 'entry-ebinex-put';
export type TelasEntryDry =
  | 'entry-dry-fora-janela'
  | 'entry-dry-mes-digitada'
  | 'entry-dry-es-acima'
  | 'entry-dry-ebinex-m5'
  | 'entry-dry-ebinex-m15';
export type TelasExit = 'exit-mnq-perda' | 'exit-mes-oitenta' | 'exit-mgc-atingido' | 'exit-mnq-ontem' | 'exit-ebinex-perda';
export type TelasState = 'marks-mes-aberta' | 'marks-ebinex-depois';
export type TelasExtras = 'extras-nota' | 'extras-mes';
export type TelasAgora = 'agora-qua-1105-et' | 'agora-qui-1031-et' | 'agora-qui-1042-et' | 'agora-qui-2024-brt';
export type TelasDia = 'dia-qui-1031' | 'dia-qui-1042' | 'dia-ebinex';
export type TelasOperacao = 'operacao-mes-aberta' | 'operacao-mes-fechada';
export type TelasRecentes = 'recentes-top-one' | 'recentes-ebinex';
export type TelasFixture =
  | TelasEntry
  | TelasEntryDry
  | TelasExit
  | TelasState
  | TelasExtras
  | TelasAgora
  | TelasDia
  | TelasOperacao
  | TelasRecentes
  | 'undo-es'
  | 'after-dry-ontem'
  | 'after-dry-ebinex'
  | 'after-ebinex'
  | 'slots-mes'
  | 'abertas-qui-1031'
  | 'contas'
  | 'ids';

/** The recorded JSON, as the database (or the API's read) answered it (a fresh copy each call) */
export function telasJson(name: TelasFixture): unknown {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

/** The random ids of the recording */
export function idsTelas(): {
  user: string;
  accounts: { topOne: string; ebinex: string; ftmo: string };
  trades: { mnqQua: string; mnqQui: string; mes: string; mgc: string; ebx: string };
} {
  return telasJson('ids') as ReturnType<typeof idsTelas>;
}

/** trading_accounts rows as fetchAccounts reads them: Top One #1, Ebinex, FTMO */
export const contasTelas = (): TradingAccount[] => telasJson('contas') as TradingAccount[];

export const agoraTelas = (name: TelasAgora): RulesNow => parseRulesNow(telasJson(name));
export const entradaTelas = (name: TelasEntry): Registered => parseRegistered(telasJson(name));
export const previaTelas = (name: TelasEntryDry): EntryDryRun => parseEntryDryRun(telasJson(name));
export const saidaTelas = (name: TelasExit): ExitRegistered => parseExitRegistered(telasJson(name));
export const estadoTelas = (name: TelasState | TelasExtras): TradeState => parseTradeState(telasJson(name));
export const fechadaPreviaTelas = (name: 'after-dry-ontem' | 'after-dry-ebinex'): AfterDryRun => parseAfterDryRun(telasJson(name));
export const fechadaTelas = (): AfterRegistered => parseAfterRegistered(telasJson('after-ebinex'));
export const abertasTelas = (): RegisteredTrade[] => openTradesOfRows(telasJson('abertas-qui-1031'));
export const diaRowsTelas = (name: TelasDia): DayTradesRows => telasJson(name) as DayTradesRows;
export const diaTelas = (name: TelasDia): DayTrade[] => dayTradesOfRows(diaRowsTelas(name));
export const operacaoRowsTelas = (name: TelasOperacao): TradeViewRows => telasJson(name) as TradeViewRows;
export const operacaoTelas = (name: TelasOperacao): TradeView => tradeViewOfRows(operacaoRowsTelas(name));
export const recentesTelas = (name: TelasRecentes): RecentTrade[] => recentTradesOfRows(telasJson(name));
