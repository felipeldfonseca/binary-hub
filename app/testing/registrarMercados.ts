/**
 * Test helpers for the new markets of «Registrar operação» (Phase 3 · 3-4). Lives outside __tests__
 * so Jest does not run it as a suite.
 *
 * The JSON in fixtures/registrar-mercados is what the real functions of migrations
 * 20261020000001..4 (with the descriptors of 20261022000001) answered, and what the API's table
 * reads returned, on a throwaway local Postgres whose clock the recorder moved between steps
 * (__tests__/lib/hubRegistrarMercados.pg.test.ts, with BH_PG_RECORD; an interposed clock read the
 * shift from a file). Invented user and data, random ids (ids.json). The approved board's
 * scenarios 6–9 and the futures «Buscar ativo»:
 *
 *   Accounts (contas: trading_accounts rows as fetchAccounts reads them), v1 saved Tue 13 Oct 2026
 *   09:00 ET («desde 13 out»): «Top One #1» (futures, topone, Financiada; 10:00–11:00 ET seg–sex,
 *   US$ 400), «FTMO» (forex, mt5, Avaliação; 08:00–10:00 ET seg–sex, US$ 1.000), «IBKR» (stocks,
 *   ibkr, Pessoal; no window, no limit: «Sem janela salva»), «Binance» (crypto, binance, Pessoal;
 *   20:00–22:00 de Brasília todos os dias, no limit), «Clear» (b3, profit, Pessoal; 10:00–11:00 de
 *   Brasília seg–sex, R$ 500).
 *
 *   Thu 15 Oct, FTMO (ET)
 *     agora-ftmo-qui-0840        08:40 rules_now(): «Liberado», «US$ 0 de US$ 1.000»
 *     entry-dry-eurusd           EUR/USD long 0,50 @ 1.08520, stop 12 / alvo 24 pips: risk 60, reward 120
 *     entry-dry-eurusd-acima     the same, stop 300 pips: risk 1.500 > 1.000 left (the warning)
 *     entry-dry-usdjpy           USD/JPY short 0,30 @ 151.240, 20 / 40 pips: estimate, risk 39,62
 *     entry-dry-eurgbp           EUR/GBP short 0,50 @ 0.87120, 10 / 20 pips: typed (risk null)
 *     entry-dry-xauusd           XAUUSD short 0,20 @ 4409.80, price stops 4413.30 / 4400.30: typed
 *     entry-eurusd, entry-usdjpy, entry-usdjpy-corrigida, entry-eurgbp   08:40 live entries (EUR/GBP left open)
 *     exit-eurusd                09:01 @ 1.08635: +57,50 (prices), R 0,9583
 *     exit-usdjpy                09:01 @ 150.980: 51,66 (estimate)
 *     exit-usdjpy-corrigida      09:01 @ 150.980, corrected to 50,10, costs 2,10 (typed)
 *     after-dry-xauusd / after-xauusd   «Já fechada» 08:45–08:58 @ 4404.55, typed +105, costs 7
 *     abertas-ftmo, dia-ftmo     the open EUR/GBP; «Operações do dia» of 15 Oct
 *   Thu 15 Oct, Clear (de Brasília)
 *     after-dry-clear-s9a, after-clear-s9a/s9b/s9c   10:18 «Já fechada»: WIN −180 (10:01–10:05),
 *                                WIN −210 (10:07–10:11), WDO −150 (10:13–10:16): the limit at 10:16
 *     agora-clear-qui-1020       10:20 rules_now(): «Encerrado por hoje», limite R$ 500 às 10:16, pior −R$ 540
 *     entry-dry-win              WIN short 3 @ 131250, 100 / 200 pts: risk 60 (limit reached, «depois do limite»)
 *     entry-dry-win-1006         «Hora» 10:06, stop 600: risk 360, left 320, above
 *     entry-dry-winz26           WINZ26 as WIN
 *     entry-dry-petr4            PETR4 300 @ 38.42, 38.20 / 38.90: risk 66
 *     entry-dry-petr4-4dp        PETR4 300 @ 38.4250, stop 38.20: risk 67,50
 *     entry-dry-di1f27           DI1F27: typed, 3 decimals
 *     entry-dry-bgix26           BGIX26 (outside the catalog): typed, 8 decimals
 *     entry-win                  10:20 live WIN short 3 (left open until 10:31)
 *     after-dry-bgix26 / after-bgix26   «Já fechada» 10:17–10:19 @ 310.55 → 311.30, typed +150, costs 3,50
 *     abertas-clear              the open WIN
 *     exit-win                   10:31 @ 131100, costs 3,50: +90
 *     dia-clear                  «Operações do dia» of 15 Oct (R$)
 *   Thu 15 Oct, IBKR (ET)
 *     agora-ibkr-qui-0952        09:52 rules_now(): «Sem janela salva» (nothing evaluated)
 *     entry-dry-aapl             AAPL long 100 @ 231.40, 230.90 / 232.40: risk 50
 *     entry-dry-spy-call         SPY Call 790 vence 15 out, 2 ct @ 1.85, 1.10 / 3.20: risk 150, reward 270
 *     after-dry-spy-call / after-spy-call   «Já fechada» 09:35–09:48, 1.85 → 2.40: +110
 *     after-dry-spy-vsv-ontem / after-spy-vsv-ontem   day 14 Oct, vence 14 out, exit 0 at 16:00 ET: −370
 *     entry-aapl, entry-spy-call-aberta   09:52 live entries
 *     abertas-ibkr, operacao-spy-aberta   the open AAPL and SPY call; the call's rows (readTradeViewRows)
 *     exit-aapl                  10:00 @ 232.15: +75
 *     exit-spy-vsv               16:05 «Venceu sem valor»: premium 0 at 16:00 ET, −370
 *     dia-ibkr                   «Operações do dia» of 15 Oct
 *   Thu 15 Oct, Top One (ET)
 *     agora-top-qui-1005         10:05 rules_now()
 *     entry-dry-cl               CL long 1 @ 70.45, 0.50 / 1.00 pts: risk 500 > 400 left
 *     entry-dry-zn               ZNZ6 long 1 @ 112.5, price stop 112 / alvo 113.25: typed
 *     entry-dry-mesz6            MESZ6 as MES: risk 100
 *     entry-zn                   10:05 live ZNZ6; exit-zn 10:20 @ 112.75, typed +250, R 0,5
 *     dia-top-one                «Operações do dia» of 15 Oct
 *   Sat 17 Oct, Binance (de Brasília)
 *     agora-binance-sab-2035     20:35 rules_now(): «Liberado · até 22:00»
 *     entry-dry-btc              BTC/USDT short 0,25 @ 112400, 112800 / 111600: risk 100, reward 200
 *     entry-dry-btc-brl          BTC/BRL: typed
 *     entry-btc, abertas-binance 20:35 live entry
 *     exit-btc                   21:02 @ 111950, costs 11,24: +112,50
 *     operacao-btc-fechada, dia-binance
 *   recentes-{top-one,ftmo,ibkr,binance,clear}   each account's recent trades (RECENT_COLUMNS, with asset_type)
 *   refusals                   { code, field } of: eurgbp-sem-pnl, xauusd-sem-pnl (pnl_required), petr4-5dp
 *                              (bad_price), bgix26-sem-pnl (pnl_required), aapl-stop-acima (bad_stop),
 *                              spy-vencida (bad_option option.expires_on), zn-pontos (bad_stop), zn-sem-pnl
 *                              (pnl_required), zn-custos (not_for_market costs)
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
  type TradeView,
  type TradeViewRows,
} from '@/lib/hub/registrarDb';
import type { RecentTrade } from '@/lib/hub/registrar';

const DIR = path.join(__dirname, 'fixtures/registrar-mercados');

export type MercadosAgora = 'ftmo-qui-0840' | 'ibkr-qui-0952' | 'binance-sab-2035' | 'clear-qui-1020' | 'top-qui-1005';
export type MercadosPrevia =
  | 'eurusd'
  | 'eurusd-acima'
  | 'usdjpy'
  | 'eurgbp'
  | 'xauusd'
  | 'win'
  | 'win-1006'
  | 'winz26'
  | 'petr4'
  | 'petr4-4dp'
  | 'di1f27'
  | 'bgix26'
  | 'aapl'
  | 'spy-call'
  | 'cl'
  | 'zn'
  | 'mesz6'
  | 'btc'
  | 'btc-brl';
export type MercadosEntrada = 'eurusd' | 'usdjpy' | 'usdjpy-corrigida' | 'eurgbp' | 'win' | 'aapl' | 'spy-call-aberta' | 'zn' | 'btc';
export type MercadosSaida = 'eurusd' | 'usdjpy' | 'usdjpy-corrigida' | 'win' | 'aapl' | 'zn' | 'spy-vsv' | 'btc';
export type MercadosFechada = 'xauusd' | 'clear-s9a' | 'clear-s9b' | 'clear-s9c' | 'bgix26' | 'spy-call' | 'spy-vsv-ontem';
export type MercadosFechadaPrevia = 'xauusd' | 'clear-s9a' | 'bgix26' | 'spy-call' | 'spy-vsv-ontem';
export type MercadosConta = 'ftmo' | 'ibkr' | 'binance' | 'clear';
export type MercadosDia = MercadosConta | 'top-one';
export type MercadosOperacao = 'spy-aberta' | 'btc-fechada';
export type MercadosRecentes = 'top-one' | 'ftmo' | 'ibkr' | 'binance' | 'clear';
export type MercadosRecusa =
  | 'eurgbp-sem-pnl'
  | 'xauusd-sem-pnl'
  | 'petr4-5dp'
  | 'bgix26-sem-pnl'
  | 'aapl-stop-acima'
  | 'spy-vencida'
  | 'zn-pontos'
  | 'zn-sem-pnl'
  | 'zn-custos';

/** The recorded JSON (a fresh copy each call), by file name without «.json» */
export function mercadosJson(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

/** The random ids of the recording */
export function idsMercados(): {
  user: string;
  accounts: { topOne: string; ftmo: string; ibkr: string; binance: string; clear: string };
  trades: { eurusd: string; usdjpy: string; usdjpyCorrigida: string; eurgbp: string; win: string; aapl: string; spyCall: string; zn: string; btc: string };
} {
  return mercadosJson('ids') as ReturnType<typeof idsMercados>;
}

/** trading_accounts rows as fetchAccounts reads them: Top One #1, FTMO, IBKR, Binance, Clear */
export const contasMercados = (): TradingAccount[] => mercadosJson('contas') as TradingAccount[];

export const agoraMercados = (name: MercadosAgora): RulesNow => parseRulesNow(mercadosJson(`agora-${name}`));
export const previaMercados = (name: MercadosPrevia): EntryDryRun => parseEntryDryRun(mercadosJson(`entry-dry-${name}`));
export const entradaMercados = (name: MercadosEntrada): Registered => parseRegistered(mercadosJson(`entry-${name}`));
export const saidaMercados = (name: MercadosSaida): ExitRegistered => parseExitRegistered(mercadosJson(`exit-${name}`));
export const fechadaMercados = (name: MercadosFechada): AfterRegistered => parseAfterRegistered(mercadosJson(`after-${name}`));
export const fechadaPreviaMercados = (name: MercadosFechadaPrevia): AfterDryRun => parseAfterDryRun(mercadosJson(`after-dry-${name}`));
export const abertasMercados = (name: MercadosConta): RegisteredTrade[] => openTradesOfRows(mercadosJson(`abertas-${name}`));
export const diaRowsMercados = (name: MercadosDia): DayTradesRows => mercadosJson(`dia-${name}`) as DayTradesRows;
export const diaMercados = (name: MercadosDia): DayTrade[] => dayTradesOfRows(diaRowsMercados(name));
export const operacaoRowsMercados = (name: MercadosOperacao): TradeViewRows => mercadosJson(`operacao-${name}`) as TradeViewRows;
export const operacaoMercados = (name: MercadosOperacao): TradeView => tradeViewOfRows(operacaoRowsMercados(name));
export const recentesMercados = (name: MercadosRecentes): RecentTrade[] => recentTradesOfRows(mercadosJson(`recentes-${name}`));
/** What the server refused, { code, field }, by case */
export const refusalsMercados = (): Record<MercadosRecusa, { code: string; field: string | null }> =>
  mercadosJson('refusals') as Record<MercadosRecusa, { code: string; field: string | null }>;
