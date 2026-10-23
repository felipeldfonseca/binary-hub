# Phase 3b research: the export formats the column-mapping import must read

Scope: which broker and platform exports the 3b mapper («Não reconhecemos este arquivo. Diga o que é cada coluna.»,
ImportarConta scenario 8) will meet, per market; for each one, the columns, the row grain (one row per fill/order or one
row per round-trip trade), clock and time format, number format, sides and signs, costs, IDs for de-duplication, partial
fills, options symbology and currency. Then a classification ((a) round trip, (b) executions that need pairing, (c) not
usable), a pairing design that lands on Phase 3c's `trade_exits`, the canonical fields the mapper needs, and a
recommendation of what to support first.

Researched 2026-10-21. Read-only: the repo at `3f439f8` (CLAUDE.md, `app/lib/domain/import/*`,
`app/lib/domain/registro/caps.ts`, migrations through `20261023000003`), the board `fase3b/quadro/atual/project/
ImportarConta.dc.html` (sha256 `48943630…baaf88e`, read as markup only), the scoping spec `fase3/levantamento/
importacao_colunas.md`, `fase3/levantamento/sintese.md` §8, `fase3/decisoes.md`, `fase3c/decisoes.md`,
`mercados/fatos_mercados.md`. `docs/csv`: header lines, record counts and masked value shapes only (no cell value was
printed). No `.env` read, no live database call, nothing in the repo changed.

Marks:
- **[O]** official page of the exchange, platform or broker; **[S]** secondary (journal vendor, tax tool, forum, code);
  **[U]** unverified: not found in any source I could open, written from general knowledge or inferred. Do not code an
  [U] header name without a real header line.
- **NEW** = not on any board; **ADAPTED** = a board string or behaviour changes (reason given). Board strings are quoted
  with their location in `ImportarConta.dc.html` (line numbers of the current canvas copy).

**Revision of 21 Oct (review fixes, `sintese.md` §8).** The synthesis overrides these points, marked in place:
- §4.2 step 1: no «Situação» field; the executed quantity alone decides (R2, C27);
- §4.2 step 4: scale-ins are one trade per entry fill (C2), not averaged;
- §4.2 step 6: the end-of-file rule replaces "the case is invisible" (R1);
- §6.2: swap is in the result per C3 and the net question (R8); there are no split date/time columns in 3b (C15) and
  no composite ID (C14);
- §6.3: the row «Situação» is dropped.

Also, the Top One platform list (§2, from the board's l.635) disagrees with public sources: LuxAlgo lists ProjectX and
Quantower for Top One Futures (https://www.luxalgo.com/prop-firms/top-one-futures/, seen 2026-10-21). Treat it as
unverified (R10).

---

## 0. Summary

1. **Most real exports are execution files, not round trips.** Of the ~30 exports found, the ones journals actually ask
   for are mostly one row per order or fill: Tradovate Orders, NinjaTrader Executions, Rithmic Completed Orders,
   Quantower Trades, WealthCharts History, BlackArrow orders, IBKR Flex (Executions), thinkorswim Account Trade History,
   Binance and Bybit trade history, Webull, Profit's order list. Round-trip files exist but are fewer: Tradovate
   Performance.csv, NinjaTrader's Trades grid, cTrader History, MT4/MT5 closed positions, Match-Trader Closed Positions,
   Profit's Relatório de Performance › Operações, TopstepX Trades, IBKR Flex at «Closed Lots» detail.
2. **The board already points at an execution file.** For Tradovate it says «Account reports › aba Orders › Download
   Report. Não use o Performance.csv.» (`COMO.tradovate`, l.1025). Orders.csv is one row per order (filled quantity,
   average price, status); the round-trip mapper as drawn cannot read it. Either 3b pairs executions, or that hint becomes
   ADAPTED to Performance.csv (§7, F1–F2).
3. **Phase 3c makes pairing cheap on the database side.** Since `20261023000003`, rows that share "symbol as written,
   side, open instant and open price" and have an exit are already one trade with one `trade_exits` row (origin `file`)
   per row, attached or linked to app trades as a whole. A pairer that emits one row per exit with the position's entry
   repeated feeds that path unchanged (§4). Only scale-ins (more than one entry fill) have no 3c shape: they must be
   averaged or split.
4. **Round-trip "lot pair" files already produce 3c groups.** Tradovate Performance.csv (one row per buy/sell fill pair)
   and NinjaTrader's Trades grid (a 2-lot entry with two targets is two 1-lot trades) give rows with the same entry time
   and price, which 3c folds into one trade with exits. Their IDs need care: Performance needs `buyFillId + sellFillId`;
   NinjaTrader's «Trade number» restarts per report and cannot be a key.
5. **Clocks are rarely stated.** Only crypto files say UTC in the header («Date(UTC)», old Bybit «Trade Time(UTC+0)»),
   and cTrader writes the platform's offset in the header («Closing Time (UTC+1)»). MetaTrader writes broker server time
   (no IANA zone). Tradovate, NinjaTrader, Rithmic, Quantower write the user's or the PC's zone. The «Em que fuso…» step
   stays essential; header-borne offsets are a NEW, cheap win.
6. **Number formats vary more than the scoping assumed**: `$(12.50)` negatives (Tradovate Performance), `-$9.99`
   (Top One), `+$9.99` (Ebinex), `$ 1,234.56` (Ebinex prices), decimal comma and `;` separators from a pt-BR Windows
   (NinjaTrader exports follow the Windows locale; Profit), signed quantities and negative commissions (IBKR), fees with
   the asset in the cell (Binance, [U]).
7. **Several formats are out of reach for a CSV mapper**: MetaTrader 4/5 (HTML report; MT5 also PDF and possibly xlsx),
   thinkorswim and IBKR Activity statements (multi-section CSV), every PDF (notas de corretagem, Bybit statement), B3's
   Área do Investidor (trade date, no time of day [U]), TradeLocker (no export at all [O]), Binance Transaction History
   (ledger rows without prices), COIN-M futures (P&L in coin).
8. **Recommendation** (§7): 3b with two row modes, «uma operação completa» (as drawn) and «uma execução» (NEW, FIFO
   flat-to-flat pairing onto 3c's exits); first fixtures shaped like Tradovate Orders and Performance, NinjaTrader
   Executions, cTrader History, Binance USDⓈ-M trade history, IBKR Flex Executions and Profit (once the owner sends a
   header line). MetaTrader stays a dedicated reader for later, as the board already says.
9. This reverses `importacao_colunas.md` Q2's recommendation ("execution files later"); the reason is points 1–3.

---

## 1. The real files in `docs/csv` (headers, counts and shapes only)

Read with a CSV parser; only header lines, record counts and value *shapes* (digits → `9`, letters → `A`) were printed.

| File | Records | Encoding / separator | Header line (verbatim) |
|---|---|---|---|
| `August_25.csv` (old Ebinex) | 22 | UTF-8 with BOM, `,`, unquoted header | `ID,Data,Ativo,Tempo,Previsão,Vela,P. ABRT,P. FECH,Valor,Estornado,Executado,Status,Resultado` |
| `operacoes_2026-05-10_03-31-55.csv` (Ebinex) | 21 | same | same 13 columns |
| `operacoes_2026-05-13_01-29-38.csv` (Ebinex) | 451 | same | same 13 columns |
| `Trade-History-2026-05-10.csv` (Top One) | 17 | UTF-8 with BOM, `,`, every header quoted | `"Ticket #","Symbol","Side","SL","TP","Open Time","Open Price","Close Time","Close Price","Duration","PnL","Lots","Commissions","Gain"` |

Total 511 records. Shapes observed (no values):
- Ebinex old: `Data` = ISO with fraction and offset (`9-9-9A9:9:9.9+9:9`) on all 22 rows; `Resultado` a bare point
  decimal without sign or `$` (the unsigned-loss trait CLAUDE.md describes); prices `$ 9,9.9` (dollar sign, space,
  comma thousands, point decimal); `Valor`/`Estornado`/`Executado` `$ 9`.
- Ebinex current: `Data` = `DD/MM/YYYY HH:MM:SS` on all rows (Brasília wall clock per CLAUDE.md); `Resultado` `+$9.9`,
  `-$9.9` or `$9.9`; `Ativo` mostly `A/A` (pair with slash); 5 rows of the 451-row file have an empty `P. FECH`.
- Top One: `Open Time`/`Close Time` `D/M/Y H:M:S` (UTC wall clock per CLAUDE.md); `PnL` `-$9.9`, `$9`, `-$9`, `$9.9`
  (sign before the dollar, no thousands seen); `Commissions` plain positive point decimal; `Lots` integer; `Gain`
  `-9.9%`; `SL` and `TP` zero or empty in all 17 (the file never shows a stop, as `fase3c/decisoes.md` says); `Duration`
  `9A 9A`; `Ticket #` `A9/9` (letters and digits, a slash, a digit).

How they compare with the exports below:
- Both are **class (a)**: one row per closed trade (Ebinex: one binary option; Top One: one exit, with 3c grouping the
  rows of a position). Neither needs pairing, a decimal comma, a `;` separator or a section picker. Both put a currency
  sign inside money cells, which the mapper must also strip (§5.1).
- The Top One header maps fully onto the board's fields: `Open Time` → «Entrada (data e hora)», `Symbol` → «Ativo»,
  `Side` → «Lado», `Lots` → «Quantidade», `PnL` → «Resultado», `Open Price`/`Close Price` → «Preço de entrada»/«Preço de
  saída», `Close Time` → «Saída (data e hora)», `Commissions` → «Comissão», `SL`/`TP` → «Stop»/«Alvo», `Ticket #` → «ID da
  operação (evita duplicar)», `Duration`/`Gain` → «Ignorar esta coluna» (`D.campos`, l.564). That makes its *header* a
  good invented-data fixture for the mapper (a golden test: mapping that header must give the same `ImportRow`s as the
  built-in reader), while the built-in reader keeps winning on detection.
- Ebinex maps poorly (stake, payout, expiry are not in `D.campos`), which supports keeping binaries out of the mapper
  (`importacao_colunas.md` Q6).
- No file of a new market exists in `docs/csv` (Ebinex and Top One only), so every other header in this document comes
  from public sources.

---

## 2. Futures platforms used by prop firms (besides Top One)

The board's futures platforms are Tradovate, Rithmic, NinjaTrader, TopstepX, Quantower, TradingView, BlackArrow,
WealthCharts (`D.plataformas.fut`, l.564); Top One Futures offers Tradovate, NinjaTrader, TradingView, BlackArrow and
WealthCharts (l.635). All are USD, CME contracts; times below are the file's, the trading day stays
`compute_trading_day` (18:00 New York).

### 2.1 Tradovate

Three account reports (desktop: account › gear › «Account reports»; tabs Orders, Performance, Cash History, Fills…)
[S: TradesViz, TradeZella, Tradervue].

**Orders.csv** — the file every journal asks for; TradesViz writes «DO NOT IMPORT Performance.csv» [S].
- Columns (TradeZella's expected list, 26) [S]: `orderId, Account, Order ID, B/S, Contract, Product, Product
  Description, avgPrice, filledQty, Fill Time, lastCommandId, Status, _priceFormat, _priceFormatType, _tickSize,
  spreadDefinitionId, Version ID, Timestamp, Date, Quantity, Text, Type, Limit Price, Stop Price, Filled Qty, Avg Fill
  Price`.
- Grain: **one row per order**, with the order's filled quantity and average fill price (partial fills already
  aggregated). Cancelled and working orders are rows too (`Status`); only filled quantity counts.
- Side: `B/S` (Buy/Sell [U] for the exact spelling). Contract: `Contract` = `MESZ6` style, `Product` = root `MES`.
- Clock: the user's local zone by default [S: TradeZella]; TradesViz notes Tradovate rolls the CME day at 18:00 ET [S].
  Format [U] (`MM/DD/YYYY HH:MM:SS` per community code for the Performance file).
- Costs: **none**; commissions and fees are only in Cash History, which journals paste under the Orders rows [S].
- IDs: `Order ID`/`orderId` (stable per order).
- Class **(b)**.

**Performance.csv** — round trips, FIFO-paired by Tradovate.
- Columns [S, two open-source parsers; list truncated there]: `symbol, qty, buyPrice, sellPrice, pnl, boughtTimestamp,
  soldTimestamp, duration, …`; the pair's fill IDs `buyFillId`/`sellFillId` exist on Tradovate's FillPair entity [O: API
  mirror at docs.ninjatrader.com] and, by memory, in the CSV together with `_priceFormat, _priceFormatType, _tickSize`
  [U].
- Grain: **one row per (buy fill, sell fill) pair** with the paired quantity. A 2-lot entry closed in two exits gives two
  rows with the same buy fill (same `boughtTimestamp` and `buyPrice`), which 3c folds into one trade with two exits. A
  scale-in (two buy fills) closed by one sell gives two rows sharing the sell fill.
- Side: **no side column**; it follows from which timestamp is earlier (bought first = long) [S]. The board's required
  «Lado» cannot be satisfied (§6, NEW «Compra/Venda» pair).
- Money: `pnl` gross, losses as `$(12.50)` [S]. No commissions.
- IDs: `buyFillId + sellFillId` (neither alone is unique). Without them: synthetic key.
- Class **(a)**; TradesViz/PickMyTrade reject it because their importers expect sides and fills, not because the data is
  wrong [S].

**Cash History (Cash.csv)**: cash movements, trade-paired closes, commissions and fees [S]. A companion file for costs,
not a trade file: class **(c)** alone (a later "commissions from Cash History" step is possible; not in 3b).

### 2.2 NinjaTrader 8

**Executions** (Control Center › Trade Performance › Display «Executions» › Generate › right-click › Export, CSV; or the
Executions tab) [S: TradeZella, TradesViz, Tradervue; O: NinjaTrader forum staff].
- Columns [S: TradeZella's expected list; a user's header on the NinjaTrader forum had the same minus «Commission»]:
  `Instrument, Action, Quantity, Price, Time, ID, E/X, Position, Order ID, Name, Commission, Rate, Account, Connection`.
- Grain: **one row per execution**; partial fills of one order share `Order ID`. `E/X` = entry or exit; NinjaTrader
  pairs FIFO when it builds trades [O: forum staff].
- Locale: the export follows the Windows regional settings: a forum user's file used `;` separators, and a German date
  format lost its separators [O: forum]. On a pt-BR Windows expect `;`, `DD/MM/YYYY` and a **decimal comma** [U].
- Clock: the PC's local zone [U]. `Instrument` like `MES 12-26` (NinjaTrader's naming [U]); `tradeMatchKey('futures',
  'MES 12-26')` gives `MES1226`, not `MES` (§5.6).
- IDs: `ID` (execution) and `Order ID`. Account per row (`Account`): one account per file is advised [S: TradesViz].
- Class **(b)**.

**Trades grid** (same window, Display «Trades») [U for the exact export header]: `Trade number, Instrument, Account,
Strategy, Market pos., Qty, Entry price, Exit price, Entry time, Exit time, Entry name, Exit name, Profit, Cum. net
profit, Commission, …, MAE, MFE, ETD, Bars`. Grain: one row per FIFO entry/exit pairing; a 2-contract order with two
targets is reported as two 1-contract trades [O: forum staff]. `Trade number` restarts with each report: **not a key**.
Class **(a)**; journals do not use it.

### 2.3 Rithmic R | Trader Pro

- Path: File › Orders History › account and date › Completed Orders › right-click headings › «Add/Remove columns» ›
  export CSV [S: TradeZella].
- Columns are **chosen by the user**; TradeZella asks for `Account | Status | Remarks | Buy/Sell | Qty To Fill | Symbol |
  Qty Filled | Avg Fill Price | Limit price | Order Number | Create Time | Update Time | Commission` [S]. A template matched
  by header set breaks whenever the user changes the visible columns (the superset/subset rule of
  `importacao_colunas.md` §6.2 matters here).
- Grain: **one row per order** (filled quantity, average fill price; cancelled orders have a status).
- Limit: **one day per export** [S]: a month of trading is ~20 files, each its own batch.
- Clock: chosen at import by journals [S]; Rithmic's own setting [U]. IDs: `Order Number`.
- The board already says «Rithmic: por enquanto, só por arquivo.» (I3 note, l.1032).
- Class **(b)**.

### 2.4 Quantower

- Path: menu «TRADES» › date range › right-click › «Export data» › all columns, comma-separated [S: TradeZella].
- Columns [S]: `Account, Date/Time, Symbol, Description, Symbol type, Expiration date, Strike price, Side, Order Type,
  Quantity, Price, Gross P/L, Fee, Net P/L, Trade Value, Trade ID, Order ID, Position ID, Connection, Comment, Exchange`.
- Grain: **one row per fill**, with per-fill gross/net P/L (on closing fills [U]) and a **`Position ID`** that groups the
  fills of one position: pairing can group by it instead of FIFO (§4.6).
- Clock: Quantower's own time-zone setting [U]. Costs: `Fee`. IDs: `Trade ID` (fill), `Order ID`, `Position ID`.
- Class **(b)** (grouping by position ID makes it reliable).

### 2.5 WealthCharts, BlackArrow, TopstepX/ProjectX, TradingView

- **WealthCharts** (Apex layout › History › gear › «export to csv», or Orders › «All orders») [S: TradesViz]: machine-style
  names; TradesViz needs symbol `chartSymbol`/`symbol`/`trading_symbol`, price `price_done`, quantity `qty_done`/
  `exec_qty`, time `last_time`/`mov_time`. Order/fill level: class **(b)**. Synonyms for these names are worth adding.
- **BlackArrow** (orders list › right-click › Export › all statuses, «Format data») [S: TradesViz]: CSV of orders; columns
  not published. Class **(b)** [U].
- **TopstepX / ProjectX** (Topstep, Alpha Futures, Bulenox, TradeDay…): TradeZella asks for the **Trades** tab export
  (not Orders) [S]; TradesViz uses Orders [S]. Columns not published [U]. Trades tab: class **(a)** [U].
- **TradingView** (broker panel › «Export data…» per tab) [O: TradingView blog 2022]: columns and grain not documented.
  Users of Tradovate through TradingView can export from Tradovate itself. Class **[U]**.

---

## 3. Forex, crypto, US stocks and options, B3

### 3.1 Forex

| Export | File and path | Grain | Columns | Clock | Class |
|---|---|---|---|---|---|
| **MetaTrader 4** | Account History › «Save as Report» / «Save as Detailed Report»: **HTML only** [O] | one closed ticket per row (+ balance rows) | `Order, Time, Type, Size, Symbol, Price, S/L, T/P, Time, Price, Commission, Taxes, Swap, Profit, Comments` (the two Time/Price pairs are open and close) [O]; times `yyyy.mm.dd hh:mm` [O] | broker **server** time (often GMT+2/+3, `fatos` §0.3) | **(c)** for the CSV mapper |
| **MetaTrader 5** | History › Report: HTML or PDF [O]; HTML or «Open XML (MS Office Excel 2007)» per broker guides [S] | report with sections Orders, Deals, Positions, Summary [O] | Positions ≈ `Time, Position, Symbol, Type, Volume, Price, S / L, T / P, Time, Price, Commission, Swap, Profit`; Deals ≈ `Time, Deal, Symbol, Type, Direction (in/out), Volume, Price, Order, Commission, Fee, Swap, Profit, Balance, Comment` [U]; hedging and netting accounts differ [S] | server time | **(c)**; dedicated reader later |
| **cTrader** | History › «Statement» › HTML or .xlsx [O]; Excel or CSV per TradesViz [S]; must be in English [S]; only visible columns export [O forum] | **one closed position (closing deal) per row** [O] | `ID, Order ID, Symbol, Opening direction, Closing direction, Opening time, Closing time, Entry price, Closing price, Closing quantity, Closing volume (currency), Requested quantity, Swap, Commissions, Pips, Gross (ccy), Net (ccy), Gross (USD), Net (USD), Label, Comment, Balance (ccy), Channel` [O help]; headers carry the account currency («Net GBP») and the offset («Closing Time (UTC+1)») [O forum post] | the platform's UTC offset, **named in the header** | **(a)** (CSV after «Salvar como» if the statement is xlsx) |
| **Match-Trader** | «Closed Positions» › download icon › CSV [S: TradesViz]; HTML per a 2023 platform note [S] | closed position | not published; a close-reason column exists [S] | [U] | **(a)** [U] |
| **TradeLocker** | none: «CSV downloads, PDF reports, and direct printing of trading history are not supported» [O support] | — | — | — | **(c)** |
| **DXtrade** | Trading Journal › Order History [S] | orders [U] | [U] | [U] | **(b)** [U] |

Forex specifics:
- Quantity in **lots** (MT «Size»/«Volume», cTrader «Closing quantity»); cTrader also gives «Closing volume» in units. The
  instrument table's forex `mult` is per lot (100 000), so mapping the units column by mistake inflates P&L 100 000×;
  `conferir`'s «lote(s)» label is the guard.
- P&L in the **account currency**, gross and net separate (cTrader), or gross `Profit` with `Commission` and `Swap` apart
  (MT). Swap is a credit or a cost (§5.4).
- cTrader partial closes: each closing deal is its own row with the same opening time and entry price [U for the exact
  rendering; cTrader's mobile help defines Entry price as the VWAP of the closed opening deals O], which 3c groups.
- MT4 partial close: the original ticket closes for part of the volume and the rest continues under a new ticket with a
  «from #…» comment [U]. Not relevant to the CSV mapper (HTML).

### 3.2 Crypto

| Export | Path, limits | Grain | Columns | Clock | Class |
|---|---|---|---|---|---|
| **Binance spot «Trade History»** | Orders › Spot Order › Trade History › Export; ≤ 12 months per file, 5 statements a month, link kept 7 days [S: CoinLedger, Navexa] (a 2022 note says the page was removed; current guides describe it again [S]) | **one fill per row** | commonly `Date(UTC), Pair, Side, Price, Executed, Amount, Fee`, quantities and fees with the asset written in the cell [U] | **UTC** (in the header) | **(b)** |
| **Binance USDⓈ-M futures «Trade History»** | Orders › Futures › USDⓈ-M › export, CSV, ≤ 3 months per request [S] | one fill per row; realized P&L on closing fills | fields Time (UTC), Symbol, Side, Price, Quantity, Fee, Realized PnL [S]; exact headers commonly `Date(UTC), Symbol, Side, Price, Quantity, Amount, Fee, Realized Profit` [U]; hedge-mode position side [U] | UTC | **(b)** |
| **Binance futures «Transaction History»** | ledger | one money movement per row: `Date(UTC), Type, Amount, Asset, Symbol`, types `REALIZED_PNL`, `FUNDING_FEE`, `COMMISSION` [S: Koinly forum] | no prices, no quantities | UTC | **(c)** |
| **Binance COIN-M** | as USDⓈ-M | fills | P&L in the coin (BTC, ETH) [S] | UTC | **(c)** for USD accounts |
| **Bybit, old «Closed P&L»** | discontinued 11 Jul 2024 [S: Cryptact, CoinLedger via `fatos`] | one close per row | `Contracts, Closing Direction, Qty, Entry Price, Exit Price, Closed P&L, Exit Type, Trade Time(UTC+0)` [S] | UTC (in the header) | **(a)** but only the close time (no entry instant) and the side is the *closing* side |
| **Bybit, current** | Orders › Unified Trading Order › Spot/Derivatives › Trade History or Order History › export; spot ≤ 6 months, 10 000 records, 5 a day, links 7 days [S: CoinLedger]; derivatives ≤ 3 months [S] | fills or orders | not published; a parser keys on `Create Time`, `Contracts`, `Closed P&L` [S] | UTC [U] | **(b)** [U]; Bybit derivatives may be closed to Brazilian accounts since May 2026 (single source, `fatos` §2.3) |

Crypto specifics:
- Quantities in coin with up to 8 decimals (`TRADE_CAPS.crypto.qtyDp = 8`); `trades.quantity numeric(18,8)` leaves 10
  integer digits (very large meme-coin quantities could overflow [U]).
- Fees may be paid in another asset (BNB on Binance): such a fee is not in the account's currency → commission unknown
  (null), never a wrong number (§5.5).
- Funding is a separate ledger, never in the trade file (§5.4).
- `dollarQuotes: ['USDT', 'USDC', 'USD']` (`caps.ts`): pairs quoted in anything else (BTC, BRL, FDUSD…) cannot give a
  US$ result.

### 3.3 US stocks and options

| Export | Path, limits | Grain | Columns | Clock | Class |
|---|---|---|---|---|---|
| **IBKR Flex Query, Trades** | Client Portal › Flex Queries; CSV or XML; ≤ 365 days per query (`fatos` §3.3); «Level of Detail» choices: Symbol Summary, Executions, Orders, Asset Class, Closed Lots, Wash Sales [O] | depends on the level: **Executions** = one fill per row; **Orders** = one order; **Closed Lots** = one closed lot with its open date-time | display names [O]: Account ID, Currency, Asset Class, FX Rate to Base, Symbol, Description, Conid, Underlying Symbol, Trade ID, Trade Date, Trade Time, Quantity, Trade Price, Multiplier, Proceeds, IB Commission, IB Commission Currency, Open/Close Indicator, Notes/Codes, Cost Basis, Realized PNL, Strike, Expiry, Put/Call, Buy/Sell, IB Order ID, IB Execution ID, Order Time, Open Date Time, Level of Detail, Net Cash…; CSV headers are the attribute names (`CurrencyPrimary, AssetClass, Symbol, DateTime, TradeDate, Quantity, TradePrice, IBCommission, FifoPnlRealized, Buy/Sell, TradeID…`) [S] | New York per a secondary source (RealTest) [S]; date format configurable (`yyyyMMdd` default), date/time joined by `;` [U for the default] | Executions/Orders **(b)**; Closed Lots **(a)** |
| **IBKR Activity Statement (CSV)** | Statements › Activity › CSV [S: Macroption] | multi-section file: first column is the section name, each section has its own header row [S] | `Trades` section has its own header [U] | [U] | **(c)** (section picking) |
| **thinkorswim (Schwab)** | Monitor › Account Statement › export CSV [S]; only visible columns export [S] | multi-section file (Cash Balance, Account Order History, Account Trade History, Equities, Options…) [S] | Account Trade History: `Exec Time, Spread, Side, Qty, Symbol, Exp, Strike, Type, Price, Order ID`; `Pos Effect` only in Account Order History; commissions only in Cash Balance («Commissions & Fees», «Misc Fees») [S] | [U] | **(c)** as a file; (b) if the section were cut out |
| **Webull** | app › History › filter «Fully Filled» › export, CSV by e-mail, once a day, US accounts only; no fees in the file [S: TradeZella, TradesViz] | one filled order per row [U] | not published [U] | [U] (zone abbreviation in the cell is common [U]) | **(b)** |
| Tradier, tastytrade, Avenue, Nomad, Inter | Avenue: notas de corretagem in PDF (`fatos` §3.3) | — | — | — | (c)/[U] |

US specifics:
- Signed quantities (IBKR `Quantity`: + buy, − sell) and **negative commissions** (`IBCommission`) [S]; `Buy/Sell`
  also present.
- IBKR's realized P&L is **net**: computed from proceeds plus commissions plus the opening basis [O], so gross =
  realized + |opening and closing commissions|.
- Each partial fill has its own execution ID; a correction keeps the ID and changes only the digits after the last
  period [O: TWS API, The Execution Object]. Key on the ID minus that suffix, newest wins.
- Options: IBKR gives `Strike`, `Expiry`, `Put/Call`, `Multiplier`, `UnderlyingSymbol` and an OCC-style `Symbol`
  (`AAPL  240119C00190000`: root padded to 6, `YYMMDD`, `C`/`P`, strike × 1000 in 8 digits) [U for the padding];
  thinkorswim `Exp` + `Strike` + `Type` columns and a `Spread` column (SINGLE, VERTICAL…) [S]; Tradervue's own convention
  is `JAN 12 125 CALL` with the underlying in Symbol [O]. `trades` holds `option_right`, `strike`, `expires_on`,
  `multiplier` (all four or none, `trades_option_shape`). Multi-leg spreads: 3-4 decided «opções simples sem travas», so
  legs can only come in as separate single-option trades.
- Multi-currency per row (`CurrencyPrimary`): rows not in USD are not a US$ stocks/options account's money.
- Reference format: Tradervue's generic import is execution-level: `Date, Time, Symbol, Quantity, Price, Side` (+
  `Commission`, `TransFee`, `ECNFee`, `Option`); dates month-first only; Side must start with B or S; without Side a
  negative quantity is a sell [O]. This is the de-facto minimum of an execution file.

### 3.4 B3

| Export | Path | Grain | Columns | Clock | Class |
|---|---|---|---|---|---|
| **Profit (Nelogica), order list** | Trading › «List of Orders» › «Executed» › dates › right-click › «Export order list CSV» [S: TradesViz] | orders [S] | not published [U] | Brasília [U] | **(b)** |
| **Profit, Relatório de Performance › aba Operações** | CSV from the Operações tab; the Resumo tab exports PDF [O: Nelogica help, via search summary]; columns chosen in «Propriedades» (e.g. Ativo, Abertura, Fechamento) [S: CM Capital help, via search summary] | **one operation (round trip) per row** [S] | not published [U]; the help defines «Resultado Liq Total» (with configured costs) vs «Resultado Total» (gross) [O, via search summary] | Brasília [U] | **(a)** |
| **B3 Área do Investidor** | Extratos › Negociação › Excel or PDF [O: B3] | one trade per row [U] | trade *date*, side, market, maturity, broker, code, quantity, price, value [U]; no time of day [U] | — | **(c)** (no entry instant) |
| Notas de corretagem (SINACOR), every broker | PDF [S] | — | — | — | **(c)** |
| MetaTrader 5 via broker (Rico, Clear, Modal) | as §3.1 | — | — | — | **(c)** |
| Tryd | [U] | — | — | — | [U] |

B3 specifics: decimal comma and `;` are the norm in Brazilian CSV [U for Profit]; contracts may be written as the series
(`WINZ26`, handled by `tradeMatchKey`) or as Profit's continuous code (`WINFUT`, `WDOFUT` [U]), which `tradeMatchKey`
does not reduce to `WIN`; result in BRL; «Resultado Liq» versus gross is the net/gross question of
`importacao_colunas.md` Q3. The owner already has a B3 account (`fase3/decisoes.md`: «contas b3 1»), so a real Profit
header line is the cheapest way to settle these [U]s.

---

## 4. Class (b): pairing executions into trades, onto Phase 3c

### 4.1 What 3c already does with file rows (`20261023000003_parciais_api.sql` §9)

- `import_stage` groups rows of a price market that have an exit (not before the entry) and an entry price and share
  **the symbol as written, the side, the open instant and the open price** (`grp`). Paths: `dup` (ticket already in the
  account as a trade key or a file exit), `attach` (new rows of a position whose other rows are in one trade), `group`
  (two or more new rows: one trade, key = the first exit's ticket, sums in `trades`, one `trade_exits` row per file row,
  `pnl_basis 'file'`), `row` (alone).
- Linking to app trades and «Desfazer» work per position. No 20-exit cap on the file path (the cap is in the app path).
- Not representable: **more than one entry** (3c decision 1: «Sem entradas parciais»).

So a pairer only has to emit, per closed position, one `ImportRow` per exit with the position's entry fields repeated
verbatim. The database stays as 3c left it, except for the `'modelo'` platform work of `importacao_colunas.md` §5.

### 4.2 Algorithm (browser, pure, in `lib/domain/import/mapped/`)

Input: execution records `{line, time, symbol, side ±1, qty > 0, price, commission?, execId?, orderId?, realized?,
openClose?, positionId?, account?, currency?}`.

1. **Filter**: rows with filled quantity 0 or a non-filled status are dropped (counted, NEW notice); «Conta» routing
   first (`importacao_colunas.md` §3.6); rows in another currency are errors (§5.5). *Revised (R2): no status field;
   the executed quantity alone decides (0 or blank → skipped, «{n} ordens sem execução ficaram de fora.»). The currency
   field is deferred (C11).*
2. **Merge fills of one order** when «ID da ordem» is mapped: same order, symbol and side → quantity sum, price =
   quantity-weighted average (exact decimal), time = last fill, commission sum, key = order ID. Fewer, stable exits
   (an order ID survives re-exports; fill IDs of corrections may not).
3. **Sort** per symbol by time, ties by file order; when the file is newest-first (most consecutive times decrease), tie
   order is reversed.
4. **Walk** each symbol (exact upper-cased symbol: `MESZ6` and `MESH7` are different positions; hedge-mode crypto per
   symbol and position side; when «Posição» is mapped, group by position ID instead of walking, §4.6) with signed
   position `p`:
   - `p = 0`: a fill opens a position: side, entry time = this fill, entry quantity and cost.
   - same sign: **scale-in**: entry price becomes the quantity-weighted average of all entry fills; entry time stays the
     first fill (F3). *Superseded (C2, 3c decision 1): each entry fill is its own lot and trade; exits close the oldest
     lots first.*
   - opposite sign: closes `c = min(q, |p|)`: one **exit** `{time, qty c, price, commission share c/q, key}`; if
     `p` reaches 0 the position is complete; a remainder `q − c > 0` **opens the opposite position** (a flip), with the
     remaining commission share.
5. **End of file**: positions still open are left out and counted (NEW: «{n} execuções de posições ainda abertas ficaram
   de fora.»). `trades_open_shape` only allows open trades registered live.
6. **Start of file**: when «Abre/fecha» is mapped (IBKR `Open/CloseIndicator`, NinjaTrader `E/X`, thinkorswim
   `Pos Effect`), a closing fill at `p = 0` belongs to a position opened before the file: left out and counted (NEW:
   «{n} execuções fecham posições abertas antes do início do arquivo.»). Without that column the case is invisible
   (it would look like a new position on the other side); the preview's open-at-end count and the NEW P&L sign check
   (§5.3) are the only hints. Advice in the hint text: export from a day you started flat. *Superseded (R1): without
   the column, every later fill of the symbol would pair wrongly. A symbol whose fills do not close by the end is asked
   about («No fim do arquivo, {ativo} ficou posicionado?»), and by default all its fills stay out (`banco_dominio.md`
   §6.4).*

### 4.3 Output rows (what reaches `import_preview`/`import_commit`)

For a position with exits `e1…ek`:
- `symbol`, `direction` (`long`/`short`), `local_entry` (first entry fill), `entry_price` (average, rounded to 8 places,
  `numeric(18,8)`; **the same string on every row**, so 3c's `grp` holds), `quantity` = the exit's quantity,
  `local_exit`, `exit_price`, `external_id` = the exit's key.
- `pnl` (gross): the file's realized P&L of that closing fill when mapped (pro rata when a fill was split; IBKR's net
  realized turned gross by adding the commissions, §3.3); else `(exit − entry) × qty × mult × side` with `mult` from the
  instrument table (`pnlFromPrices`); else row error `no_price_result` (forex and roots outside `INSTRUMENT_SPEC`).
  Exactness: the position total `Σ exit value − Σ entry value` is exact whatever the matching; per-exit values are
  rounded to cents and the residue goes to the last exit, so `Σ trade_exits.pnl` = the exact total rounded.
- `commission`: the exit's own share plus the entry commissions pro rata to the exit's quantity; null when no
  commission column (unknown, not zero).
- `stop_price`, `target_price`: null (orders files do carry stop orders, but the initial stop of a position cannot be
  told from a moved one: out of 3b).
- A position with one exit is a plain `row`; with several, 3c's `group`.

### 4.4 Keys and re-imports

- Exit key: the closing order ID (merged) or execution ID; a flip's opening remainder is not an exit, so no key repeats.
- No ID column: the synthetic key of `importacao_colunas.md` §5.4 computed per exit from the *exit* tuple (time, symbol,
  side, quantity, price, occurrence).
- A later file overlapping the same days produces the same exits → `dup`; a file that now also holds the rest of a
  position whose first exits were imported → 3c's `attach` (same symbol, side, open instant, open price). A file whose
  window cuts a position differently (started mid-position) changes the entry average and is not recognised: the risk
  of §4.2 point 6.

### 4.5 How round-trip "lot pair" files land on 3c

- Tradovate Performance.csv, NinjaTrader Trades: each row is a lot pair. Rows sharing the entry fill share time and
  price → 3c groups them into one trade with exits; a scale-in gives rows with different entry fills → two trades
  (the same outcome as F3 option b). Keys: `buyFillId + sellFillId` (Tradovate), synthetic (NinjaTrader).
- cTrader, Match-Trader, Profit Operações, IBKR Closed Lots: one row per closing deal/lot; partial closes share the
  opening time and entry price → 3c groups.
- Bybit old Closed P&L: no entry time; an entry instant cannot be invented (it decides the trading day and the rule
  version): **not importable** as it is.

### 4.6 Grouping by a position ID (NEW, optional)

Quantower (`Position ID`), MT5 deals (`Position`), cTrader (`ID` per position) carry the broker's own position number.
When «Posição» is mapped, executions group by it (sum in, sum out, the same exit rows as §4.3), with no FIFO guess;
the start-of-file and flip problems disappear.

### 4.7 Tests to add (Jest, invented data)

Flat-to-flat long and short; two exits → one group of two rows with identical entry strings; scale-in average (exact
decimal, 8-place rounding, residue on the last exit); flip in one fill; open at end; closing fill before any opening with
`E/X` mapped; fills merged by order ID; newest-first file with equal timestamps; two symbols interleaved; `MESZ6`
vs `MESH7`; realized P&L column versus computed (IBKR net → gross); commission pro rata; no ID → synthetic keys stable
under the same file twice and a longer file; output rows pass the 3c grouping key unchanged.

---

## 5. Cross-format rules the reader needs

### 5.1 Numbers (ADAPTED `parseNum`, today point-decimal only)

| Seen in | Example shape | Rule |
|---|---|---|
| Ebinex, Top One | `-$9.99`, `+$9.99`, `$ 1,234.56` | strip a leading/trailing currency sign (`$`, `US$`, `R$`, `€`, `£`) and spaces; sign may come before the symbol |
| Tradovate Performance | `$(12.50)` | parentheses = negative [S] |
| pt-BR Windows (NinjaTrader), Profit, the board's example | `6.801,00`, `-39,98` | decimal comma; dot thousands; decided per file (the board's chip «Separador ; · decimal vírgula», l.493) |
| en-US | `1,234.50` | comma thousands |
| IBKR | `-1.0035` commission, `-100` quantity | signed values carry meaning (side, cost) |
| Binance [U] | `0.0012BTC`, `0.1BNB` | number followed by an asset code: split, the code is the cell's currency |
| Top One `Gain`, Ebinex | `-9.9%` | a percentage is never money: refuse a `%` column as «Resultado» (NEW value check) |

### 5.2 Dates and clocks

- Shapes to accept: `DD/MM/YYYY HH:MM:SS` (Top One, Ebinex, Profit [U]); `MM/DD/YYYY HH:MM:SS` (Tradovate [S]) and
  `M/D/YYYY h:mm:ss AM` (en-US NinjaTrader [U]); `MM/DD/YY` (thinkorswim [U]); `yyyy.mm.dd hh:mm[:ss]` (MetaTrader [O]);
  `YYYYMMDD;HHMMSS` / `YYYYMMDD` + time (IBKR [U]); `YYYY-MM-DD HH:MM:SS` (Binance [U]); ISO with offset (old Ebinex);
  a zone abbreviation suffix (`EST`/`EDT`, Webull [U]). Day/month order decided over the whole file
  (`importacao_colunas.md` §4.1).
- **Separate date and time columns** exist (IBKR Trade Date + Trade Time; Tradovate `Date` + `Fill Time` [U]); the
  scoping left them out; §6 adds them.
- **Header-borne zones (NEW)**: `(UTC)`, `(UTC+0)`, `(UTC+1)`, `(UTC-3)` in a mapped time column's header become that
  fixed offset on every row (stored like the old Ebinex offsets: `utc_offset`, no zone step, never re-zoned). Fixed is
  right here: cTrader's setting is a fixed UTC offset [U] and crypto files are UTC.
- Zone hints for «Em que fuso…» (preselect only, never silent): Binance/Bybit UTC; Tradovate, NinjaTrader, Rithmic,
  Quantower «o fuso do seu computador ou da plataforma» → the user's; Profit and B3 Brasília; IBKR New York [S];
  MetaTrader needs «Horário do servidor MT (NY + 7 h)» (`fatos` §0.3), not an IANA zone (dedicated reader).

### 5.3 Sides and signs

- Vocabulary to add to `importacao_colunas.md` §4.3: `BOT`, `SLD` (Tradervue [O]), `Buy to cover`, `Sell short`
  (NinjaTrader [U]), `BUY`/`SELL` any case, `B`/`S`, `Compra`/`Venda`, `C`/`V`; a signed quantity as the side (IBKR,
  Tradervue's rule [O]).
- **Closing side**: Bybit's «Closing Direction» and cTrader's «Closing direction» name the side of the *exit*, the
  opposite of the position. Mapping it as «Lado» silently inverts every trade.
- NEW check (round-trip mode, rows with prices and result): `sign((exit − entry) × side)` must equal the sign of the
  gross result; when most rows disagree, `conferir` says «O lado parece ser o da saída. Inverter?» (NEW) and the choice
  is saved in the template. The same check catches a net column mapped as gross only in edge cases; it is mainly a side
  check.
- Commission sign: stored as a positive cost (`abs`), as the scoping says; a negative **fee** can be a rebate (Tradervue:
  negative ECN fee is a credit [O]); rebates are rare for this owner, accept the `abs` loss of information [U].

### 5.4 Costs: commission, fees, swap, funding

| Cost | Where it appears | Into `commission`? |
|---|---|---|
| Commission | Top One `Commissions`, NinjaTrader `Commission`, Rithmic `Commission`, IBKR `IBCommission` (negative), MT `Commission` (negative [U]), cTrader `Commissions`, Quantower `Fee` | yes (positive) |
| Exchange/clearing/NFA fees | NinjaTrader Trades grid fee columns [U], Tradervue `TransFee`/`ECNFee` [O], B3 emolumentos | yes, summed (NEW «Outras taxas» field, §6) |
| Swap (forex overnight) | MT `Swap`, cTrader `Swap` | no: can be a credit; F4 |
| Funding (crypto perps) | Binance Transaction History, not in the trade file | no: other file; F4 |
| Tradovate, Webull | no costs in the trade file [S] | null (unknown) |

### 5.5 Currency

Accounts have one currency (`market_caps`: `brl` for B3, `usd` otherwise; USDT and USDC count as dollars; accounts in
different markets are never summed). Files that state a currency per row or per header (IBKR `CurrencyPrimary`,
cTrader «Net EUR», Binance fee asset, COIN-M settlement coin) → NEW «Moeda» field: a row whose money is in another
currency is a row error (`currency_mismatch`, NEW); a fee in another asset makes the commission null with a notice;
nothing is converted (F6).

### 5.6 Symbols

- Futures: `tradeMatchKey` reduces `MESZ6`/`MESZ26` to `MES` (`caps.ts` `MONTH_AND_YEAR`) but not NinjaTrader's
  `MES 12-26` (→ `MES1226`) nor a ProjectX contract id like `CON.F.US.MES.Z26` [U] (→ `CONFUSMES`), nor Profit's
  `WINFUT` [U]. Without the root the instrument table gives no multiplier, so the result must be typed (or the pairer
  fails with `no_price_result`). NEW: an import-side normaliser for `ROOT MM-YY`, `ROOT MMMYY`, dotted ids and the B3
  `…FUT` continuous codes, keeping the stored symbol as written.
- Options: parse OCC (`ROOT[ ]YYMMDD[C|P]########`, with or without padding or a leading dot) into
  `option_right/strike/expires_on`, multiplier 100 unless a «Multiplicador» column says otherwise; or map the separate
  columns (§6).
- Crypto: split the quote currency from the pair (`BTCUSDT` → USDT, `BTC/USDT`) for the US$ check.

---

## 6. Canonical fields the mapper needs

Board fields (`D.campos`, l.564; chips «Obrigatórias» l.494; note «Opcionais: Saída, Comissão, Stop, Alvo, ID da
operação (evita duplicar), Conta.» l.494; rule «Resultado (ou os preços)» l.1053): «Entrada (data e hora)», «Ativo»,
«Lado», «Quantidade», «Resultado», «Preço de entrada», «Preço de saída», «Saída (data e hora)», «Comissão», «Stop»,
«Alvo», «ID da operação (evita duplicar)», «Conta», «Ignorar esta coluna».

### 6.1 Row mode (NEW, F1)

A question before the columns: «Cada linha do arquivo é…» «uma operação completa (entrada e saída)» / «uma execução (uma
compra ou uma venda)» (NEW; pre-answered from the header: no exit time and no exit price → execução). The field list
below depends on it.

### 6.2 «Uma operação completa» (round-trip mode, the board's)

| Field | pt-BR label | Status | Needed by | Rule |
|---|---|---|---|---|
| entry | «Entrada (data e hora)» | board, required | all | or the split pair below |
| entryDate + entryTime | «Entrada (data)» + «Entrada (hora)» | **NEW** | IBKR Closed Lots, statements with split columns | together they satisfy «Entrada» |
| symbol | «Ativo» | board, required | all | §5.6 normaliser for the instrument key |
| side | «Lado» | board, required → **ADAPTED** | all but Tradovate Performance | satisfied also by the buy/sell pair below; inverted on the §5.3 check |
| buyTime / sellTime + buyPrice / sellPrice | «Compra (data e hora)», «Venda (data e hora)», «Preço de compra», «Preço de venda» | **NEW** | Tradovate Performance | side = whichever came first; entry/exit fields derived |
| qty | «Quantidade» | board, required | all | unit label per market in `conferir` |
| result | «Resultado» | board | all | gross or net (Q3 of the scoping); `%` refused |
| entryPrice / exitPrice | «Preço de entrada» / «Preço de saída» | board | all | prices give the result where the instrument table allows |
| exit | «Saída (data e hora)» | board, optional | all | (+ «Saída (data)»/«Saída (hora)», NEW) |
| commission | «Comissão» | board | most | absolute value |
| fees | «Outras taxas» | **NEW** | NinjaTrader fees, Tradervue-style files, B3 | summed into `commission` (keeps the board rule «Cada campo vai em uma coluna só.», l.1149) |
| swap | «Swap / funding» | **NEW** | MT-like, cTrader | not stored (F4); a preview total. *Superseded (C3, R8): «Swap ou funding» is added to a gross result; a net result already has it* |
| stop / target | «Stop» / «Alvo» | board | Top One-like | as today |
| id | «ID da operação (evita duplicar)» | board | most | composite allowed: two columns joined (Tradovate `buyFillId`+`sellFillId`) — **ADAPTED** (one more select) |
| account | «Conta» | board | NinjaTrader, Rithmic, IBKR, Quantower | routing (scoping §3.6) |
| currency | «Moeda» | **NEW** | IBKR, cTrader (header), crypto | §5.5 |
| option contract | «Vencimento», «Strike», «Tipo de opção (call/put)», «Multiplicador» | **NEW** | options and stocks accounts | or parsed from «Ativo» (OCC) |
| ignore | «Ignorar esta coluna» | board | all | — |

### 6.3 «Uma execução» (execution mode, NEW)

| Field | pt-BR label (NEW) | Required | Notes |
|---|---|---|---|
| time | «Data e hora» (or «Data» + «Hora») | yes | the fill or order time. *Revised (R2): the fill time («Fill Time», «Update Time»), never the order's creation time, which can sort a bracket's exit before its entry* |
| symbol | «Ativo» | yes | per-symbol walk |
| side | «Lado (compra ou venda)» | yes, or a signed quantity | — |
| qty | «Quantidade executada» | yes | 0 or blank → row skipped with a notice, never an error (R2) |
| price | «Preço» | yes | average fill price for order files |
| commission, fees | «Comissão», «Outras taxas» | no | pro rata to exits (§4.3) |
| execId | «ID da execução» | no (recommended) | exit keys |
| orderId | «ID da ordem» | no | merges fills (§4.2 step 2) |
| status | «Situação» + which values mean executed | no | Tradovate/Rithmic order files hold cancelled rows. *Dropped (R2, C27): a cancelled order has executed quantity 0, so the quantity rule covers it* |
| openClose | «Abre ou fecha» | no | detects positions opened before the file |
| realized | «Resultado realizado» | no | money of closing fills (IBKR, Binance, Quantower) |
| position | «Posição (número)» | no | §4.6 |
| account, currency, option contract | as §6.2 | no | — |

Minimum for an execution file (the Tradervue rule [O]): time, symbol, side (or signed quantity), quantity, price.

---

## 7. Recommendation

### 7.1 Support first (fixtures shaped like these headers, invented rows)

| # | Market | Export | Class | Why first |
|---|---|---|---|---|
| 1 | Futures | **Tradovate Orders.csv** | (b) | the board's own hint; offered by most prop firms on the board (`FIRMAS.fut`, l.629–654) including Top One (l.635) |
| 2 | Futures | **Tradovate Performance.csv** | (a) | same users, round trip; tests the NEW buy/sell pair and `$(x)` |
| 3 | Futures | **NinjaTrader Executions** | (b) | every journal's choice for NinjaTrader; tests `;` and decimal comma from a pt-BR Windows |
| 4 | Forex | **cTrader History** (CSV, or re-saved from xlsx) | (a) | the forex platform with a real per-position file; header-borne offset and currency |
| 5 | B3 | **Profit Relatório de Performance › Operações** (and the order list) | (a)/(b) | the owner has a B3 account; needs his header line first (F7) |
| 6 | Crypto | **Binance USDⓈ-M Trade History** | (b) | UTC, realized P&L per fill; fees in another asset |
| 7 | US | **IBKR Flex Trades, Executions** (Closed Lots as a round-trip alternative) | (b)/(a) | the main US broker for non-residents; signed quantity, negative commission, options columns |

Then, without code of their own if the mapper is generic: Quantower (with «Posição»), Rithmic, WealthCharts,
BlackArrow, TopstepX, Match-Trader, Bybit current, Webull.

### 7.2 Out of 3b

MetaTrader 4/5 (HTML/PDF report, server clock: a dedicated reader, as the board says «O relatório do MetaTrader 5 sai em
HTML ou PDF e vai precisar de um leitor próprio, que vem depois.», fimConta l.1114); thinkorswim and IBKR Activity
statements (multi-section; IBKR users can use Flex); PDFs; B3 Área do Investidor; TradeLocker; Binance Transaction
History and COIN-M; Bybit old Closed P&L (no entry time); Tradovate Cash History (a later companion for commissions);
TradingView exports (unknown).

### 7.3 What changes against `importacao_colunas.md` (stale points)

- Q2's recommendation (execution files in a later 3b-4) is reversed by §0 points 1–3: pairing now lands on 3c's exits
  with no new table, and the board's Tradovate hint needs it. Effort stays the scoping's +2–3 days for pairing, plus
  the NEW mode question on the board.
- §7's table: Tradovate, NinjaTrader, Rithmic are now researched (§2); Bybit Closed P&L is not importable (no entry time).
- §4.1 sniffing: add `$(x)`, currency signs, asset-suffixed numbers, header-borne offsets, zone suffixes, split date/time.
- §4.3 sides: add `BOT`/`SLD`, closing-side detection.
- §5.2 (no `notes` key for mapped rows): 3c's `group` insert still writes `notes = platform || ':' || external_id`
  (l.1959 of `20261023000003`); the `'modelo'` migration must change that path too.
- `pnl_basis`: 3c writes `'file'` for every file row; a pairer's computed result is `'prices'` in substance. Either the
  row carries its basis or mapped rows keep `'file'` (decide in 3b-1; not an owner question).

### 7.4 Board impact (for the canvas revision before the screens PR)

- NEW: the row-mode question (§6.1), the execution field list (§6.3), the buy/sell pair, «Outras taxas», «Swap /
  funding», «Moeda», option fields, «O lado parece ser o da saída. Inverter?», the open-at-end and opened-before-file
  notices.
- ADAPTED: «Lado» required unless the buy/sell pair or a signed quantity is mapped; «ID da operação (evita duplicar)»
  may take two columns; `COMO.tradovate` (l.1025) per F2; per-platform hints for NinjaTrader («Trade Performance ›
  Display: Executions › Generate › botão direito › Export»), Rithmic («Orders History › Completed Orders › Export; um dia
  por arquivo»), Quantower («Trades › botão direito › Export data»), replacing the generic «Exporte o histórico de
  operações em CSV. No protótipo, só lemos o CSV da Ebinex e o Trade History da Top One.» (l.1028) for those platforms.

---

## Open questions for the owner

**F1 · Arquivos com uma compra ou venda por linha (execuções) já na 3b?**
A maioria das plataformas exporta assim: Tradovate (Orders), NinjaTrader, Rithmic, Quantower, IBKR, Binance, Profit
(lista de ordens). O quadro só desenha «uma operação por linha».
- (a) Sim: a 3b pergunta «Cada linha do arquivo é…» e, em execuções, junta compras e vendas em operações (a operação
  termina quando a posição zera; cada saída vira uma parcial, como na 3c). +2–3 dias e uma revisão do quadro.
- (b) Não: a 3b só lê uma operação completa por linha; execuções depois.
- (c) Leitores próprios por plataforma em vez do modo genérico.
**Recomendo (a)**: a 3c já guarda várias saídas por operação, e o próprio quadro manda exportar o Orders da Tradovate,
que é um arquivo de execuções. (Muda a recomendação anterior, Q2 do levantamento da 3b.)

**F2 · A dica da Tradovate no quadro: «Account reports › aba Orders › Download Report. Não use o Performance.csv.»**
- (a) Manter (vale se F1 = a).
- (b) Trocar para o Performance.csv (uma operação por linha; sem coluna de lado nem comissão).
- (c) Aceitar os dois e manter a dica do Orders, que tem mais detalhe.
**Recomendo (c)** com F1 = (a); com F1 = (b), só (b) funciona.

**F3 · Entrada em partes (aumentar a posição) num arquivo de execuções.** A 3c só tem saídas parciais.
- (a) Uma operação, com o preço médio das entradas e a hora da primeira; a prévia avisa quantas foram assim.
- (b) Cada entrada vira uma operação separada (como o Performance da Tradovate e o NinjaTrader fazem).
- (c) Deixar essas posições de fora.
**Recomendo (a)**: o resultado total fica exato e a posição continua sendo uma operação, como você opera.

**F4 · Swap (Forex) e funding (Cripto).**
- (a) Fora do resultado e da comissão; a prévia mostra o total «Swap/funding fora do resultado: …».
- (b) Somar aos custos quando for custo (e ignorar quando for crédito).
- (c) Guardar à parte num campo novo.
**Recomendo (a)**: no day trade quase não aparece, e a comissão não aceita valor negativo.

**F5 · Excel (.xlsx).** O cTrader exporta o extrato em HTML ou .xlsx; o MetaTrader 5 em HTML, PDF (e .xlsx segundo
guias de corretoras).
- (a) Só CSV na 3b; para cTrader, a dica diz «abra no Excel e salve como CSV».
- (b) Ler .xlsx também (biblioteca nova, precisa do seu OK).
**Recomendo (a)**: o MetaTrader precisa de leitor próprio de qualquer jeito; (b) vale depois, se a sua conta de Forex
for de cTrader.

**F6 · Moeda diferente da conta** (IBKR com linhas em EUR, taxa da Binance em BNB, conta cTrader em EUR).
- (a) Linha em outra moeda vira erro; taxa em outra moeda fica «comissão desconhecida»; nada é convertido.
- (b) Converter pelo câmbio do dia.
**Recomendo (a)**: contas em moedas diferentes nunca se somam, e câmbio é outra fonte de dados.

**F7 · Cabeçalhos reais.** Vários nomes de colunas aqui não foram confirmados em fonte aberta (Profit, Tradovate
Performance, Binance, Bybit, Webull, NinjaTrader Trades).
- (a) Você manda só a primeira linha (cabeçalho, sem nenhuma operação) dos arquivos que pretende importar: Profit da sua
  conta B3, a plataforma da sua conta de Forex e, se usar, Tradovate ou NinjaTrader.
- (b) Seguir só com o que é público e ajustar quando aparecer um arquivo real.
**Recomendo (a)**: um cabeçalho real evita errar nomes de colunas, e o repositório público só recebe dados inventados.

---

## Sources (seen 2026-10-21 unless noted)

Futures platforms
- Tradovate Orders headers, steps, local time zone, no commissions: https://help.tradezella.com/en/articles/6472250-tradovate-how-to-import-trades-from-tradovate-into-tradezella-using-the-file-upload-method [S]
- Tradovate «DO NOT IMPORT Performance.csv», Cash History for commissions, 18:00 ET session: https://www.tradesviz.com/brokers/Tradovate [S]
- Tradovate Orders path and zone choice: https://www.tradervue.com/site/platforms/tradovate [S]
- Tradovate exports overview: https://pickmytrade.trade/how-to/tradovate-export-journal-csv/ , https://www.traderinsight.pro/blog/import-tradovate [S]
- Tradovate Performance columns, `$(x)` losses, side from timestamps: https://github.com/ssap-pa/tilt-check/pull/4 , https://github.com/giovanij933/JOURNAL/pull/1 , https://github.com/KyleShabaga/FundedFlow [S]
- Tradovate FillPair (buyFillId/sellFillId): https://docs.ninjatrader.com/api/rest-api-endpoints/positions/fill-pair-item.md , https://partner.tradovate.com/api/rest-api-endpoints/orders/fill-item [O]
- NinjaTrader Executions headers and steps: https://help.tradezella.com/en/articles/6499264-ninjatrader-how-to-import-trades-from-ninjatrader-into-tradezella-using-the-file-upload-method [S]; https://www.tradesviz.com/brokers/NinjaTrader [S]; https://www.tradervue.com/site/platforms/ninjatrader [S]
- NinjaTrader semicolons, locale date bug, FIFO, one-lot trades: https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/100325-executions-tab-export-date-format-not-as-expected , https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/1278640-how-to-match-a-trade-s-entry-exit-rows-in-the-exported-trade-execution-csv-file , https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/105546-mae [O forum]
- Rithmic R | Trader Pro: https://help.tradezella.com/en/articles/6839918-rithmic-r-trader-how-to-import-trades-from-rithmic-r-trader-into-tradezella-using-the-file-upload-method [S]; https://help.tradesyncer.com/en/articles/11687958-how-to-import-trades-from-rithmic-into-tradesyncer [S]
- Quantower: https://www.tradezella.com/integrations/quantower [S]
- WealthCharts: https://www.tradesviz.com/brokers/WealthCharts [S]
- BlackArrow: https://www.tradesviz.com/brokers/BlackArrow [S]
- TopstepX/ProjectX: https://help.tradezella.com/en/articles/9557681-topstepx-how-to-import-trades-from-topstepx-into-tradezella-using-the-file-upload-method [S]; https://www.tradesviz.com/brokers/ProjectX [S]
- TradingView export: https://www.tradingview.com/blog/en/export-trading-data-into-a-csv-file-30748 [O]

Forex
- MT5 report formats and sections: https://www.metatrader5.com/en/terminal/help/trading/report , https://www.metatrader5.com/en/terminal/help/trading_advanced/history_report [O]; Open XML option: https://quantalphaalgorithms.odoo.com/blog/algoblogs-1/how-to-download-mt5-trading-history-report-23 , https://www.oanda.com/sg-en/skills-and-insights/education/platforms-and-tools/metatrader5/downloading-trade-history-on-mt5/ [S]; English HTML for import: https://help.tradezella.com/en/articles/7205059-mt5-how-to-upload-trades-from-metatrader5-mt5-into-tradezella-using-the-file-upload-method [S]
- MT4 Account History columns and HTML reports: https://www.metatrader4.com/en/trading-platform/help/overview/terminal/terminal_account_history [O]
- cTrader History columns and Statement: https://help.ctrader.com/ctrader/trading/history , https://help.ctrader.com/ctrader-web/trading/history , https://help.ctrader.com/ctrader-mobile-ios/trade/history [O]; header with offset and currency: https://community.ctrader.com/forum/ctrader-support/42155/ [O forum]; https://www.tradesviz.com/brokers/RSG [S]
- Match-Trader: https://www.tradesviz.com/brokers/MatchTrader [S]; https://fxnewsgroup.com/forex-news/platforms/match-trader-platform-updates-position-close-reason-crm-data-ib-system-functionality/ [S]
- TradeLocker: https://support.tradelocker.com/en/articles/13752344-journaling-and-history-download [O]

Crypto
- Binance exports: https://traderssecondbrain.com/guides/how-to-export-binance-trade-history [S]; https://help.navexa.com/en/articles/16211267-import-binance-spot-trades-into-navexa-using-csv [S]; https://help.coinledger.io/en/articles/5042261-binance-com-file-import-guide [S]; https://bc-binance.com/en/posts/binance-futures-export/ [S]; https://hackage.haskell.org/package/binance-exports [S]; Transaction History rows: https://discuss.koinly.io/t/missing-futures-trades/6023 [S]
- Bybit: https://help.coinledger.io/en/articles/6601040-bybit-file-import-guide [S]; old Closed P&L header and July 2024 change: https://support.cryptact.com/hc/en-us/articles/4416536949273-How-to-get-trade-history-from-Bybit [S, read through search; page refused direct access]; https://huggingface.co/spaces/BreadBytes1/CT-Dashboard/blob/main/app.py [S]; official export article (timed out here, cited in `fatos`): https://www.bybit.com/en/help-center/article/How-to-export-my-account-data-Order-History-Trade-History-Assets-History-Closed-P-L [O]

US stocks and options
- IBKR Flex Trades fields and levels of detail: https://ibkrguides.com/reportingreference/reportguide/tradesfq.htm [O]; realized P&L definition and Open/Close: https://www.ibkrguides.com/reportingreference/reportguide/financialinformation_fq.htm [O]; execution IDs and corrections: https://www.interactivebrokers.com/docs/tws-api/doc/order-management/execution-details/the-execution-object [O]; Flex CSV attribute names: https://tapeboard.com/manual/import-ibkr-flex-csv [S]; New York time in Flex output: https://mhptrading.com/docs/topics/idh-topic12353.htm [S]; Activity Statement CSV structure: https://www.macroption.com/interactive-brokers-statements-database/ [S]
- thinkorswim: https://webhelp.tradingdiarypro.com/tos_import.htm [S]
- Webull: https://help.tradezella.com/en/articles/6045032-webull-how-to-import-trades-from-webull-into-tradezella-using-the-file-upload-method [S]; https://www.tradesviz.com/brokers/Webull [S]
- Tradervue generic format: https://www.tradervue.com/help/generic [O]

B3
- Profit order list: https://www.tradesviz.com/brokers/Nelogica [S]
- Profit Relatório de Performance (CSV from Operações, PDF from Resumo, net vs gross): https://ajuda.nelogica.com.br/hc/pt-br/articles/360049221391-Relat%C3%B3rio-de-Performance [O, read through search; page refused direct access]; https://ajuda.cmcapital.com.br/hc/pt-br/articles/29872873295895-PROFIT-PRO-Como-visualizar-o-Relat%C3%B3rio-de-Performance [S, same]
- B3 Área do Investidor exports: https://b3.com.br/pt_br/produtos-e-servicos/central-depositaria/canal-com-investidores/area-do-investidor/ , https://b3.com.br/pt_br/noticias/b3-lanca-nova-area-logada-do-investidor.htm [O]
- Market facts already gathered (MT server clock, B3 contracts, crypto currencies): `scratchpad/mercados/fatos_mercados.md`
