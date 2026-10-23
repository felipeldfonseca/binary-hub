# Phase 3 survey · «Registrar operação» per market (Forex, Ações e opções, Cripto, B3)

Base: `feature/rebuild-lean` = `main` at `4187a8c` (Phase 2b merged). Static reading of `app/`, `supabase/migrations/`, the approved
boards and the earlier research. Nothing in the repository was changed, the live Supabase was not called, no `.env` file and no
`docs/csv` row was read. Market facts were checked on the web on 2026-10-18 (sources in §11, each marked **official** = exchange,
clearing house, regulator or the platform's own documentation; **secondary** = broker education, press, importer).

Inputs: `panel/v31/plano.md` row 3 and `apendice.md` §B «Fase 3: M6a», §D, §E; `fase2/decisoes.md`; `mercados/decisoes.md`,
`mercados/fatos_mercados.md`, `mercados/proposta.md`, `mercados/impacto.md`, `mercados/quadros/resumo_para_o_dono.md`; boards
`market-hub/project/RegistrarOperacao.dc.html` (generator `registrar_board/tpl.html` + `script.js`, cited below as «Registrar
tpl l.N» / «Registrar script l.N»), `DiarioHojeEnxuto.dc.html`, `mercados/quadros/project/{ImportarConta,Personalizar}.dc.html`
(column-mapping scenario 8 generator `importar_board/gerar.py`); the Personalizar catalog `pers/catalogo.js` and
`pers/catalogo80.json`; memory `market-hub-initiative.md`.

Marks: **NEW** = not on any board; **ADAPTED** = a board string or behaviour changed for a market; «…» = exact pt-BR text.

---

## 0. Summary

1. **The board draws two forms only.** Futures: «Ativo» (MES · MNQ · MGC), «Lado», «Contratos» (1 · 2 · 3), «Preço de entrada»,
   «Preço de saída», «Stop e alvo, em pontos · opcional»; the result is *computed* (points × US$ per point × contracts), never
   typed, and there is no commission field. Ebinex: «Par», «Direção», «Expiração», «Stake, US$», «Payout, %», «Como terminou?».
   Everything else on the board (gate card, Setup A/B/C with mark times, emotion, «Imagens e nota», server time) is
   market-independent and carries over unchanged.
2. **Every amount is in the account's currency, and the daily limit already sums `pnl − commission`** (`limit_usage`,
   `20261018000003_rules_api.sql:598-631`) in US$ or R$ (`market_caps_all()`, `20261019000001_markets.sql`). So the one hard rule
   per market is: *`trades.pnl` must be in the account's currency, before costs; costs go to `commission` (≥ 0, null = unknown)*.
3. **Computing the result from prices is exact in most of the four markets and impossible in some.** Exact: B3 futures (R$ per
   point fixed by B3), US stocks, standard US options (× 100), crypto pairs quoted in USDT/USDC/USD, forex pairs quoted in US$.
   Estimate only: forex pairs with US$ as base (USD/JPY…), converted at the exit price. Not computable: forex crosses (EUR/GBP…),
   every CFD in a «Forex e CFDs» account (contract size is set by each broker), COIN-M crypto, crypto quoted in R$, B3 DI1,
   adjusted options. **Recommendation:** compute when exact or estimable and let the trader correct it; require a typed
   «Resultado» when not computable (Q1).
4. **The approved column-mapping board already assumes the same table.** ImportarConta scenario 8 requires «Entrada», «Ativo»,
   «Lado», «Quantidade» and «Resultado (ou os preços)», with «Comissão», «Stop», «Alvo» optional (`ImportarConta` script, map
   step). «Ou os preços» means the import must also compute results from prices, so one per-instrument spec table (multiplier,
   tick, pip, quantity unit, result mode) should serve Registrar and the 3b import. It is NEW (no code has it today).
5. **Quantity units differ per market and must be explicit in the label:** «Lotes» (forex, decimals, 0,01 step), «Ações»
   (fractional allowed in the US), «Contratos» (US options and B3 futures, integers), coin quantity in Cripto («Quantidade, em
   BTC»). The board's chips «1 · 2 · 3» fit only small futures sizes.
6. **Stop and target need a unit per market:** points (B3 futures, as the futures board), pips (forex currency pairs), price levels
   (stocks, options, crypto, CFDs). All are stored as prices (`stop_price`, `target_price`), as the futures board already converts
   points to prices.
7. **Options need fields the schema does not have.** `trades.direction` allows only `long|short|call|put`, and `call|put` already
   means a binary option's direction. A US option needs its own right (call/put), strike, expiration and multiplier, and the
   trade's side stays `long|short`. NEW columns (for `banco.md`), or the OCC 21-character symbol in `symbol` (§5).
8. **Instruments come from the approved catalog rule** (~80% of each market's volume, «cerca de 790 no total», Personalizar) but
   Registrar must also accept a symbol outside it: the catalog decides what the hub can *read*, not what a trader may *log*. The
   catalog misses what forex prop traders trade most (gold and index CFDs) and includes pairs retail platforms may not carry
   (USD/KRW, USD/INR). Q5, Q8.
9. **In the four new markets there is no «O que a tela diz» line and no data block** (state rule and block are futures only until
   Phase 5, `MARKET_SPEC.rules`). The gate card still works (window + limit). Every new-market account starts without a window
   («Sem janela salva · Definir»), so its first Registrar entries meet the «no version» case (§3.8).
10. **Minimal board change: four new scenarios (6 Forex, 7 Ações e opções, 8 Cripto, 9 B3)**, each reusing an existing flow
    (entry, after, outside window, after limit), plus the 2b note change already approved. About 1–1.5 days of board work; code
    about +1–1.5 days per market on top of Phase 3 (estimate from `mercados/proposta.md` §«3 · Registrar»).

---

## 1. What the approved board draws today (the baseline)

### 1.1 Futures variant (scenarios 1–4, Top One)

| Field | Board text and location | Behaviour |
|---|---|---|
| Asset | «Ativo» (Registrar tpl l.204), chips MES · MNQ · MGC | only the owner's three micros (`gerar.py` `MULT`) |
| Side | «Lado» (tpl l.205): «Compra» · «Venda»; error «Escolha Compra ou Venda.» (script l.169) | required |
| Size | «Contratos» (tpl l.206), chips 1 · 2 · 3 (script l.219) | no free input |
| Entry price | «Preço de entrada» (tpl l.208); note «Sugestão: o último preço na tela. Ajuste ao da sua plataforma.» (tpl l.211) | tick-checked: «O MES anda de 0,25 em 0,25; confira o preço.» (script l.126-130); «Use só números, como 7.896,25.»; «O preço precisa ser maior que zero.» |
| Time | «Hora (ET)» / «Hora da entrada (ET)» (script l.222); error «A entrada não pode ser depois de agora (…).» | clock = account's window clock; the exit label is hard-coded «Hora da saída (ET)» (script l.224, l.319) |
| Exit price | «Preço de saída» (tpl l.214, l.290) | same tick check |
| Stop/target | «Stop e alvo, em pontos · opcional» (tpl l.219); «Use pontos maiores que zero.» | preview «risco US$ … · alvo US$ … · 1 : 2»; none → «Sem stop e alvo, o R não é calculado.» (script l.227) |
| Result | «Resultado: +7,50 pts · US$ 75,00» (script l.202); after exit, «Operação fechada» with R «com stop de 11 pts» | computed `(saída − entrada) × lado × US$/pt × ct` (script l.183); **not editable, no commission field** |

### 1.2 Binary variant (scenario 5, Ebinex)

«Par» (tpl l.229; EUR/USD, BTC/USD, GBP/USD, ETH/USD, USD/JPY with payout), «Direção» «Alta» · «Baixa» (tpl l.230), «Expiração»
1 · 2 · 5 · 15 min (tpl l.231, script l.231), «Stake, US$» (tpl l.233), «Payout, %» (tpl l.234; «O payout vai de 1 a 100%.»),
preview «Se acertar: … · se errar: …» (script l.236), exit «Como terminou?» «Ganho» · «Perda» · «Devolvida» (script l.321).

### 1.3 What is already market-independent

- Gate card «Posso operar hoje?» with ⓘ «Calculado pelas regras desta conta, na hora da entrada: janela, bloqueio de dados e limite
  do dia. Ele nunca impede o registro: fora do plano, a operação só ganha a marca.» (script l.213). In the new markets the data
  block does not exist, so the ⓘ needs ADAPTED text (§3.6).
- Setup A/B/C, «Execução», «Como você está?», mark times «antes da saída» / «depois do resultado», «Imagens e nota» (4 images,
  10 MB, 1.000 characters), «Registrar outra», «Ver no Diário», «O Binary Hub não envia ordens: registrar é anotar.» (tpl l.370).
- Account note «Futuros e binárias nunca são somados.» (tpl l.176) is already replaced, by the approved 2b boards, with «Contas de
  mercados diferentes nunca são somadas.» (`copy.ts` `NEVER_SUMMED`).

### 1.4 How a logged trade shows later (DiarioHojeEnxuto, data of the trade rows)

`opTxt` «MES · Compra · 2 ct», prices «7.896,25 → 7.903,75 · +7,50 pts», result «+US$ 75,00», stop line «stop 11 · alvo 22 pts ·
às 10:05». Each new market needs its own unit in the same three slots (§6).

---

## 2. What the database and domain already fix for every market

| Fact | Where | Consequence for Registrar |
|---|---|---|
| Account market ∈ futures, binary, forex, stocks, crypto, b3, options; `options` not creatable | `trading_accounts.market` check; `MARKET_SPEC` (`lib/domain/markets.ts`) | an «Ações e opções (EUA)» account is `stocks` and holds both stocks and options |
| Currency per market: B3 `BRL`, all others `USD` (USDT/USDC count as US$) | `market_caps_all()`, `MARKET_SPEC.currency`; `trading_accounts.currency` set by insert trigger | every amount typed or shown is «R$» in B3 and «US$» elsewhere |
| Day turns: forex 17:00 NY, stocks 20:00 NY, crypto and B3 midnight Brasília | same | a forex trade at 17:30 ET counts on the next day |
| Window clock: New York or Brasília; defaults forex/stocks NY, crypto/B3 Brasília; crypto window every day | same | the «Hora (…)» labels follow the account's window clock |
| Rules in new markets: window + daily limit only | `MARKET_SPEC.rules` all false outside futures | no «bloqueio», no state rule, no «O que a tela diz» |
| Limit sums `pnl − coalesce(commission,0)` of trades with `pnl` not null and `result ≠ 'pending'`, by exit order | `limit_usage` (`20261018000003_rules_api.sql:598`) | `pnl` must be in the account currency, before costs; typed costs must land in `commission` |
| `trades.pnl numeric(18,2)`, `commission numeric(18,2) ≥ 0` (null = unknown), `quantity numeric(18,8)`, `entry_price/exit_price/stop_price/target_price numeric(18,8)` | initial schema + `20261017000002_trades_accounts.sql:34-51` | crypto prices below 0,00000001 lose digits (§10) |
| `trades.direction in ('long','short','call','put')`; `asset_type text not null`, no check | `20240415000000_initial_schema.sql:138-141` | options cannot use `direction` for call/put; `asset_type` takes a new value per instrument kind |
| App type `TradeAssetType = 'futures' \| 'crypto' \| 'stock' \| 'binary_option'` | `app/types/database.ts:442` | adding `forex`, `cfd`, `option` widens an old type (for `legado.md`) |
| Imported futures store the contract code (`MESM6`), the board stores the root (`MES`) | `__tests__/domain/import/fixtures.test.ts:317`; Registrar script l.216 | same split will appear for B3 (`WINZ26` vs `WIN`); grouping needs a root (§5) |
| Result from imports = sign of the gross `pnl` | `lib/domain/import/topone.ts:191` | Registrar sets `result` the same way |
| Column mapping (3b, approved): required «Entrada (data e hora)», «Ativo», «Lado», «Quantidade», «Resultado (ou os preços)»; optional «Saída (data e hora)», «Comissão», «Stop», «Alvo», «ID da operação (evita duplicar)», «Conta» | `importar_board/gerar.py:246-252`; ImportarConta script `reqs` | no swap field; prices-only files need the same multipliers as Registrar |
| Catalog rule: «Em cada mercado, o catálogo traz os ativos que somam pelo menos 80% do volume negociado: cerca de 790 no total. A lista é revista a cada trimestre.»; outside it «Fora do catálogo. Peça e ele entra na fila da próxima revisão.» «Pedir “…”» | Personalizar board (2b) | Registrar offers the catalog first and accepts other symbols (Q8) |

---

## 3. Rules shared by the four new forms

### 3.1 The result in the account's currency (Q1)

Table of what the app can know from the prices alone (gross, before costs):

| Market | Instrument | Formula | Kind |
|---|---|---|---|
| Forex | pair quoted in US$ (EUR/USD, GBP/USD, AUD/USD, NZD/USD) | (saída − entrada) × lado × 100.000 × lotes | exact (if the broker's contract size is 100.000) |
| Forex | pair with US$ as base (USD/JPY, USD/CAD, USD/CHF, USD/CNH, USD/HKD, USD/SGD, USD/MXN) | (saída − entrada) × lado × 100.000 × lotes ÷ saída | estimate: the broker converts at its own rate at the close |
| Forex | cross (EUR/GBP, EUR/JPY, EUR/CHF) | needs a third rate | typed |
| Forex | CFD (gold, indices, oil, crypto CFDs) | contract size is a per-broker symbol property (MT5 `SYMBOL_TRADE_CONTRACT_SIZE`) | typed |
| Ações (EUA) | stock or ETF | (saída − entrada) × lado × ações | exact |
| Opções (EUA) | standard contract | (prêmio de saída − prêmio de entrada) × lado × 100 × contratos | exact; adjusted contracts (corporate actions, not 100 shares) typed |
| Cripto | pair quoted in USDT, USDC or USD (spot or USDⓈ-M perpetual) | (saída − entrada) × lado × quantidade | exact in the quote coin, counted as US$ by the 2b decision |
| Cripto | COIN-M (inverse) or a pair quoted in R$ | result in the coin or in R$ | typed in US$ |
| B3 | WIN, IND, WDO, DOL | Δ pontos × R$ por ponto × contratos | exact |
| B3 | stock or ETF | (saída − entrada) × lado × quantidade | exact |
| B3 | DI1 | from the PU, rate and business days to expiry | typed |

Recommended behaviour (ADAPTED from the board's futures result line, Registrar script l.202):
- **Exact or estimate:** show the line as the board does, with the market's unit, e.g. «Resultado: +11,5 pips · US$ 57,50». Under
  it a link «Corrigir» opens «Resultado na sua plataforma, US$» (NEW) prefilled with that number. A corrected value is kept and
  flagged (`pnl_basis = 'typed'`, NEW, §5). For an estimate the line says «≈» and the ⓘ says why (NEW: «Em pares com o dólar na
  frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.»).
- **Not computable:** the field «Resultado, US$» (or «Resultado, R$») is required at the exit step, with the note (NEW) «Pelos
  preços não dá para saber o valor em dólar: digite o resultado da sua plataforma, antes da comissão.» The prices stay required
  (they feed the R, the Diário and the 3b import's duplicate checks).
- In every case `result` = sign of `pnl` (`win`/`loss`/`breakeven`), as the importers do.

### 3.2 Costs (Q3) and swap or funding (Q2)

- `commission` is «custos»: broker commission plus exchange/regulatory fees, ≥ 0, null = unknown (Phase 1 convention, kept by the
  limit). The futures board has no such field (Phase 2 decision: a live trade counts gross until an import completes the
  commission). The four new markets have no reader that could complete it, so the recommendation is an optional field at the exit
  step: «Custos, US$ · opcional» / «Custos, R$ · opcional» (NEW), with a market-specific hint:
  - Forex: «Comissão por lote da sua conta, ida e volta.» (NEW)
  - Ações e opções: «Comissão e taxas da corretora (SEC, FINRA).» (NEW) Fact: SEC Section 31 fee is US$ 20,60 per million of
    sales since 2026-04-04 (official).
  - Cripto: «Taxas da corretora, em dólar.» (NEW) Fact: Binance USDⓈ-M regular maker 0,02% / taker 0,05% (official).
  - B3: «Corretagem, emolumentos e registro. O imposto não entra.» (NEW) The 1% IRRF on day-trade profit is a tax withheld, not a
    trading cost (`fatos_mercados.md` §5.3).
- **Swap (forex) and funding (crypto perpetuals) are signed** (they can pay or charge), so they cannot go into `commission`. The
  approved column mapping has no swap field. Recommendation (Q2): include them in «Resultado» when the trader types it, and say so
  in the hint («com swap ou funding, se houver», NEW); no new column in Phase 3. Note why it matters: crypto funding on Binance
  happens at 00:00, 08:00 and 16:00 UTC (official), and 00:00 UTC is 21:00 in Brasília, inside the default crypto window 20:00–22:00
  (`MARKET_SPEC.crypto.window`). Forex rollover is 17:00 ET, outside the default forex window 08:00–10:00 ET.

### 3.3 Stop, target and R (Q9)

| Market | Unit typed | Stored | Risk preview |
|---|---|---|---|
| B3 futures | «Stop e alvo, em pontos · opcional» (board text) | price = entrada ∓ pontos | «risco R$ 60» from R$/ponto |
| Forex pairs | «Stop e alvo, em pips · opcional» (NEW). Pip = 0,01 when the quote currency is JPY, 0,0001 otherwise (secondary; convention, forex is OTC) | price = entrada ∓ pips × pip | US$ for pairs quoted in US$; «≈ US$» for USD/xxx; pips only for crosses |
| Forex CFDs, USD/KRW, USD/INR | «Stop e alvo, em preço · opcional» (NEW) | price | none (R only) |
| Ações, opções, cripto | «Stop e alvo, em preço · opcional» (NEW); for options, the premium («Stop e alvo do prêmio · opcional», NEW) | price | «risco US$ …» = |entrada − stop| × quantidade × multiplicador |

R = (saída − entrada) × lado ÷ |entrada − stop|, from prices only. It needs no currency conversion, so it works for crosses and
CFDs too (the board computes R from points, script l.359; the same ratio).

### 3.4 Instruments: catalog first, any symbol allowed (Q8)

- Chips: the account's last five symbols, falling back to the first ones of the market's catalog (NEW; the board's fixed chips
  MES · MNQ · MGC are the owner's three).
- Search: the market's catalog, accent- and case-insensitive (same behaviour as the Personalizar catalog search).
- Outside the catalog: «Usar “XAUUSD”» (NEW, same pattern as the approved «Usar “x” como mesa» in ImportarConta). The symbol is
  stored upper-case, 1–20 characters `[A-Z0-9./ -]`. An unknown symbol has no spec, so its result is typed (§3.1).
- Never offer «Pedir» inside Registrar: asking for catalog coverage stays in Personalizar.

### 3.5 Size

| Market | Label (NEW unless noted) | Unit stored in `quantity` | Validation |
|---|---|---|---|
| Forex | «Lotes» with chips 0,01 · 0,10 · 0,50 · 1,00 + field | lots (1 lot = 100.000 units of the base currency, secondary) | > 0, at most 2 decimals (MT5 `SYMBOL_VOLUME_STEP` is per broker; 0,01 is the common step) |
| Ações (EUA) | «Ações» | shares | > 0, at most 6 decimals (fractional shares) |
| Opções (EUA) | «Contratos» (board word) | contracts | integer ≥ 1 |
| Cripto | «Quantidade, em BTC» (unit follows the coin) | coins | > 0, at most 8 decimals (schema limit) |
| B3 futures | «Contratos» (board word), chips 1 · 2 · 3 · 5 · 10 + field | contracts | integer ≥ 1 |
| B3 ações | «Ações» | shares | integer ≥ 1; note (not error) when not a multiple of 100: «Fora do lote de 100, a B3 negocia no fracionário (código com F).» (NEW) |

The board's «Contratos» chips 1 · 2 · 3 (script l.219) stay for the owner's futures account.

### 3.6 Clock, weekend, gate

- «Hora (ET)» / «Hora (Brasília)» follow the account's window clock (board already does it for the entry, script l.222). ADAPTED:
  the exit label «Hora da saída (ET)» (script l.224, l.319) must follow the same clock («Hora da saída (Brasília)» in Cripto and B3).
- No weekend or exchange-hours validation: crypto trades every day, forex opens Sunday 17:00 ET, US stocks have extended and
  overnight sessions (`fatos_mercados.md` §1.1, §3.1). The only checks stay the board's: entry not after now, exit not before
  entry, exit not after now.
- Gate ⓘ ADAPTED for markets without the block: «Calculado pelas regras desta conta, na hora da entrada: janela e limite do dia.
  Ele nunca impede o registro: fora do plano, a operação só ganha a marca.»
- «O que a tela diz agora:» / «Na tela, na entrada:» (script l.214) are not shown in the new markets until Phase 5 gives them a
  state (and only for catalog assets with coverage).

### 3.7 One exit per trade

Phase 3 records one entry and one exit per trade. A trader who scales in or out types the average prices (and the platform's
result, which §3.1 lets them correct). Partial exits are not modelled (same as the board).

### 3.8 Accounts with no saved rules

Every new-market account starts without a window (2b: «Janela: sem janela · limite do dia: …»). Registrar in such an account has
no rule version, so the gate card shows «Sem janela salva · Definir» and the trade is not judged. The approved Personalizar text
«Até salvar, as operações ficam em “Histórico importado · só resultado”.» (Personalizar 2b, `versaoSub`) is wrong for a trade
that was registered, not imported; the 2b summary already flagged it («Vale rever na Fase 3»). This belongs to `registrar.md`;
it hits the four new markets first.

---

## 4. Per market

### 4.1 Forex e CFDs (`forex`, US$, day turns 17:00 ET, window clock NY)

**Who and what.** Mostly prop-firm accounts on MetaTrader 5, MetaTrader 4, cTrader, Match-Trader, TradeLocker, DXtrade
(`fatos_mercados.md` §1.3, §1.5; ImportarConta 2b platform list). The account pill says «Forex e CFDs» (`copyMercados.ts`), so
gold, index and oil CFDs are in scope.

**Instruments to offer.** Catalog (BIS Triennial Survey 2025, spot turnover, 16 pairs to 81,01%): EUR/USD 19,56%, USD/JPY 16,15,
USD/CNH 8,86, GBP/USD 6,43, AUD/USD 5,23, USD/CAD 4,75, USD/CHF 4,18, USD/HKD 3,02, USD/SGD 2,43, USD/MXN 1,83, USD/INR 1,73,
EUR/GBP 1,54, NZD/USD 1,46, USD/KRW 1,38, EUR/JPY 1,30, EUR/CHF 1,16 (`pers/catalogo80.json`, research checked against the BIS
annex PDF). Two observations (reading, not verified at each broker): USD/INR and USD/KRW trade mostly as non-deliverable
forwards and are rarely offered on retail platforms; the catalog has no CFD at all, while gold (XAU/USD) and US index CFDs are
standard on prop-firm platforms. Recommendation in Q5.

**Fields.**

| Field | Label | Required | Stored |
|---|---|---|---|
| Instrument | «Par» (board word, Registrar tpl l.229) with chips + search + «Usar “…”» | yes | `symbol` «EUR/USD» or the CFD symbol as typed; `asset_type` `forex` or `cfd` (NEW values) |
| Side | «Lado» «Compra» · «Venda» (board) | yes | `direction` long/short |
| Size | «Lotes» | yes | `quantity` |
| Entry | «Preço de entrada» (board); up to 5 decimals, no tick check (forex is OTC, brokers quote 5 or 3 digits) | yes | `entry_price` |
| Time | «Hora (ET)» (board) | yes | server time when live |
| Stop/target | «Stop e alvo, em pips · opcional» (pairs) or «… em preço · opcional» (CFDs, KRW, INR) | no | `stop_price`, `target_price` |
| Exit | «Preço de saída», «Hora da saída (ET)» | yes at exit | `exit_price`, `exit_time` |
| Result | computed line, or «Resultado, US$» typed (crosses, CFDs) | computed or required | `pnl` |
| Costs | «Custos, US$ · opcional» | no | `commission` |

**Previews (NEW strings, same shape as the board).** Entry with stop: «risco US$ 60 · alvo US$ 120 · 1 : 2» (EUR/USD, 0,50 lote,
stop 12 pips, alvo 24 pips). Exit: «Resultado: +11,5 pips · US$ 57,50» (1,08520 → 1,08635). USD/JPY, Venda 0,30 lote, 151,240 →
150,980: «Resultado: +26,0 pips · ≈ US$ 51,66» (¥ 7.800 ÷ 150,98). EUR/GBP: «Resultado: +9,0 pips · digite o valor em dólar».
**Validation.** Positive prices; lots > 0 with ≤ 2 decimals; pips > 0; times as the board.
**May be left empty.** Stop, target, costs; setup and the other marks; images and note.
**Cannot be known by the app.** The account's real contract size per CFD, swap, the broker's conversion rate.
**Known limit.** The account currency is US$ by the 2b decision; a trader whose broker account is in EUR must convert the result.

### 4.2 Ações e opções (EUA) (`stocks`, US$, day turns 20:00 ET, window clock NY)

One account holds stocks/ETFs and listed options (2b decision; Interactive Brokers, thinkorswim, Webull, tastytrade, Tradier,
Avenue, Nomad). The form starts with a NEW choice «O que você operou?» «Ação ou ETF» · «Opção».

**Instruments to offer.** Stocks and ETFs: the catalog's 670 tickers (Q3 2026 consolidated dollar volume to 80%; SPY 3,46%, MU
3,32, NVDA 2,72, QQQ 2,62 …), by search, with the account's recent tickers as chips. Options: the underlying comes from the same
catalog plus the index roots SPX, XSP, NDX, RUT and VIX (NEW; the stock catalog has no index). Facts: in 2025 US options volume was
15,2 bn contracts; index options averaged 5 M contracts a day, SPX 3,9 M, and 0DTE was 59% of SPX volume (Cboe, official). No
ranking of options volume by underlying was made, so «80% of options volume» is not yet a list (Q4).

**Stocks fields.** «Ativo» (search), «Lado» «Compra» · «Venda» (a short sale is «Venda»), «Ações», «Preço de entrada», «Hora
(ET)», «Stop e alvo, em preço · opcional», exit «Preço de saída», «Hora da saída (ET)», «Custos, US$ · opcional». Result exact:
AAPL, Compra 100 ações, 231,40 → 232,15: «Resultado: +0,75 por ação · US$ 75,00» (NEW wording). Prices up to 4 decimals; no
tick check (sub-penny fills exist and the SEC's half-penny tick rule is deferred to November 2027, official/press, §11).

**Options fields (all NEW).**

| Field | Label | Required | Notes |
|---|---|---|---|
| Underlying | «Ativo-objeto» (search) | yes | catalog + index roots |
| Right | «Tipo» «Call» · «Put» | yes | separate from «Lado» |
| Strike | «Strike, US$» | yes | > 0, up to 3 decimals (the OCC symbol encodes strike × 1000) |
| Expiration | «Vencimento», chips «Hoje» · «Sexta» + date | yes | not before the entry day |
| Side | «Lado» «Compra» · «Venda» | yes | «Venda» = selling to open (writing) |
| Size | «Contratos» | yes | integer ≥ 1 |
| Premium | «Prêmio de entrada, US$ por ação» / «Prêmio de saída, US$ por ação» | yes | ≥ 0 at exit (0 = expired worthless); > 0 at entry; up to 2 decimals |
| Stop/target | «Stop e alvo do prêmio · opcional» | no | premium levels |
| Costs | «Custos, US$ · opcional» | no | per-contract commission + fees |

Preview: «2 contratos × 100 = 200 opções · risco US$ 150» and, at exit, SPY Call 600 hoje, Compra 2 ct, 1,85 → 2,40: «Resultado:
+0,55 no prêmio · US$ 110,00». A NEW exit chip «Venceu sem valor» sets the exit premium to 0 at the expiration time (16:00 ET; 16:15
for some ETF/index classes, `fatos_mercados.md` §4.1). Exercise and assignment turn into a stock position; Phase 3 does not model
it: the trader closes the option at its intrinsic value and logs the stock separately (Q4). Multi-leg spreads: not in Phase 3
(Q4). Facts: a standard US equity option covers 100 shares and adjusted contracts can cover other amounts (OCC, official); SPX
multiplier 100 (Cboe, official); options classes in the Penny Interval Program quote in US$ 0,01 below US$ 3 and US$ 0,05 above,
with SPY, QQQ and IWM in pennies at every price (Cboe C2 rule exhibit, SEC filing). The app validates only 2 decimals, not the
increment.

### 4.3 Cripto (`crypto`, US$ with USDT/USDC as dollar, day turns midnight Brasília, window clock Brasília, every day)

Platforms: Binance, Bybit, OKX, Coinbase, Kraken, Bitget, Mercado Bitcoin, MetaTrader 5 (2b list).

**Instruments to offer.** Catalog of 27 coins (90 days of spot volume on 9 exchanges to 80,02%, stablecoins out): BTC 33,76%,
ETH 17,03, XRP 5,83, SOL 5,30, ZEC, NEAR, DOGE, BNB, HYPE, SUI, UNI, ENA, ADA, LINK, WLD, PUMP, ONDO, TRUMP, PENGU, PEPE, AVAX, XLM,
LTC, AAVE, TAO, plus TRX and ARB in the board list. Shown as «BTC/USDT»; the quote coin is a NEW small choice «USDT» · «USDC» ·
«USD», default USDT (all count as US$).

**Fields.** «Moeda» (chips + search), «Lado» «Compra» · «Venda» (a sale to open is a short on a perpetual or on margin),
«Quantidade, em BTC» (NEW; the unit follows the chosen coin), «Preço de entrada, USDT» (NEW unit suffix), «Hora (Brasília)»,
«Stop e alvo, em preço · opcional», exit «Preço de saída», «Hora da saída (Brasília)», «Custos, US$ · opcional». Preview:
«Posição de US$ 28.100» (NEW, quantity × entry) and, at exit, BTC/USDT, Venda 0,25 BTC, 112.400 → 111.950: «Resultado: +450 por BTC
· US$ 112,50». Facts: USDⓈ-M PnL = contract size × position × direction × (price − entry) and COIN-M BTC contracts are US$ 100 each
with PnL in BTC (Binance, official); realized PnL there excludes fees and funding (they are separate terms of Binance's ROI
formula, official).
**Not asked.** Leverage (it does not change the result of a given quantity; the risk is in the stop) and spot vs perpetual (the
formula is the same for linear contracts). Both are NEW optional ideas left out to keep the form short.
**Validation.** Quantity > 0 with ≤ 8 decimals; price > 0 with ≤ 8 decimals; a price with more digits (memecoins) gets the note
«Preço com mais de 8 casas: digite o resultado da sua plataforma.» (NEW) and the result becomes typed.
**Typed result.** COIN-M, pairs quoted in R$ (Mercado Bitcoin), MetaTrader 5 crypto CFDs (lot size per broker).

### 4.4 B3 (`b3`, R$, day turns midnight Brasília, window clock Brasília)

Platforms: Profit (Nelogica), Tryd, MetaTrader 5 (2b list). The board's futures form fits B3 futures almost unchanged, in R$.

**Instruments to offer.** Catalog futures (2025 contracts, 95% with three roots): WIN 66,5% (full contract IND merged), DI1 15,2,
WDO 13,5 (full DOL merged); stocks and ETFs: 56 by 2025 financial volume (VALE3 6,85%, PETR4 5,90, ITUB4 4,15, BOVA11 3,96 …).
Registrar must separate mini and full contracts because the R$ per point differs (the catalog merges them).

**Contract facts (B3, official product pages).**

| Root | Size | Quote | Tick | R$ per point (derived) | Tick in R$ | Expiry |
|---|---|---|---|---|---|---|
| WIN | Ibovespa × R$ 0,20 per point | index points | 5 points | 0,20 | 1,00 | even months, Wednesday nearest the 15th |
| IND | Ibovespa × R$ 1,00 per point | index points | 5 points | 1,00 | 5,00 | even months, same day |
| WDO | US$ 10.000 | R$ per US$ 1.000 | R$ 0,50 per US$ 1.000 | 10,00 | 5,00 | every month, 1st business day |
| DOL | US$ 50.000 | R$ per US$ 1.000 | R$ 0,5 per US$ 1.000 | 50,00 | 25,00 | every month, 1st business day |
| DI1 | R$ 100.000 at expiry (PU × R$ 1) | annual rate, base 252, up to 3 decimals | 0,001 (≤ 3 months) or 0,005 | from the PU | — | every month |

Standard lot: WIN and WDO 1 contract, IND and DOL 5 (B3). Stocks: standard lot 100, fractional market 1–99 with the «F» code
(B3's own guide, Bora Investir).

**Futures fields.** Same as the board: «Ativo» chips «WIN» · «WDO» · «IND» · «DOL» (DI1 by search, typed result), «Lado»,
«Contratos», «Preço de entrada» (points), «Hora (Brasília)», «Stop e alvo, em pontos · opcional», exit price and time, plus
«Custos, R$ · opcional». Tick error ADAPTED from the board (script l.128): «O WIN anda de 5 em 5; confira o preço.», «O WDO anda de
0,5 em 0,5; confira o preço.» Previews: «risco R$ 60 · alvo R$ 120 · 1 : 2» (WIN, 3 ct, stop 100 pts); WIN, Venda 3 ct, 131.250 →
131.100: «Resultado: +150 pts · R$ 90,00»; WDO, Compra 2 ct, 5.432,0 → 5.437,5: «Resultado: +5,5 pts · R$ 110,00».
**Stocks fields.** As US stocks, in R$, quantity integer (§3.5). Stored root: «PETR4» (the trader may type «PETR4F»; stored as
typed, grouped by the root without «F», §5).
**Series.** The contract series (WINZ26) is not asked: the R$ per point does not change with the series. Stored root «WIN».
**Not validated.** Trading hours (WIN 09:00–18:25, WDO 09:00–18:30, stocks 10:00–16:55 per `fatos_mercados.md` §5.1, all
changing twice a year with US daylight saving).

### 4.5 Adjacent: Futuros (EUA) beyond MES · MNQ · MGC (Q11)

The board offers only the owner's three micros. The futures catalog has 13 entries with micros merged (SR3, ES/MES, ZN, NQ/MNQ,
ZF, ZT, CL/MCL, TN, GC/MGC, NG, ZB, ZQ, ZC; `pers/catalogo.js`). Equity-index and metal/energy contracts have fixed US$ per point
(MES US$ 5 × index, tick 0,25 = US$ 1,25; MNQ US$ 2 × index, tick 0,25 = US$ 0,50; MGC 10 oz, tick US$ 0,10 = US$ 1,00; CME,
official). Treasury futures quote in 32nds and SOFR/Fed Funds in rate terms, so their entry needs a different input. Another
futures trader opening the hub would find only the owner's three.

---

## 5. Storage per market (for `banco.md`)

| Market · instrument | `asset_type` | `direction` | `quantity` unit | Multiplier (account currency per price unit per quantity unit) | `pnl` |
|---|---|---|---|---|---|
| Futuros (EUA) | `futures` | long/short | contracts | MES 5, MNQ 2, MGC 10 (board `MULT`) | prices |
| Binárias | `binary_option` | call/put | 1 | — | stake × payout |
| Forex pair | `forex` (NEW value) | long/short | lots | 100.000 (÷ exit price when US$ is the base) | prices / estimate / typed |
| Forex CFD | `cfd` (NEW value) | long/short | lots | unknown | typed |
| US stock, ETF | `stock` (existing vocabulary) | long/short | shares | 1 | prices |
| US option | `option` (NEW value) | long/short | contracts | 100 (adjusted: typed) | prices |
| Crypto | `crypto` (existing vocabulary) | long/short | coins | 1 (quote coin = US$) | prices / typed |
| B3 future | `futures` | long/short | contracts | WIN 0,20, IND 1, WDO 10, DOL 50 | prices |
| B3 stock, ETF | `stock` | long/short | shares | 1 | prices |

NEW for `banco.md`:
1. Options: `option_right text check (option_right in ('call','put'))`, `strike numeric(18,8)`, `expires_on date`, `multiplier
   numeric(12,4)` (default 100), all null unless `asset_type = 'option'`. Alternative without columns: the OCC 21-character symbol
   (root padded to 6, `YYMMDD`, `C`/`P`, strike × 1000 in 8 digits; IBKR and Fidelity documentation, secondary) in `symbol`; it
   breaks grouping by underlying and makes every query parse it, so columns are recommended.
2. `pnl_basis text check (pnl_basis in ('prices','typed'))` (NEW): whether the result came from the prices or was typed or
   corrected. Lets the Análises and the 3b import trust or re-check a result.
3. Per-instrument spec as data (NEW `instrument_specs()` jsonb in SQL and `INSTRUMENT_SPEC` in TS with a parity test, the pattern
   of `market_caps_all()`/`MARKET_SPEC`): root, market, asset_type, label, multiplier, tick, pip, quantity step, stop unit, result
   mode. `register_exit` recomputes `pnl` in SQL when `pnl_basis = 'prices'` so a client cannot send a result that disagrees with
   its prices; the 3b import uses the same table for «Resultado (ou os preços)».
4. A root for grouping (Análises «por ativo»): `MESM6` and `MES`, `WINZ26` and `WIN`, `PETR4F` and `PETR4` are the same asset.
   Either a stored `symbol_root` or a SQL function; Registrar stores the root already.
5. Nothing above touches the 629 stored trades: the columns are nullable and new `asset_type` values are only written by new
   trades.

---

## 6. How the new trades show in the Diário (ADAPTED from DiarioHojeEnxuto `opTxt`, prices line, stop line)

| Market | `opTxt` | Prices line | Result | Stop line |
|---|---|---|---|---|
| Forex | «EUR/USD · Compra · 0,50 lote» | «1,08520 → 1,08635 · +11,5 pips» | «+US$ 57,50» | «stop 12 · alvo 24 pips · às 08:41» |
| Forex CFD | «XAUUSD · Venda · 0,20 lote» | «2.401,35 → 2.396,10» | «+US$ 105,00» (typed, with «digitado») | «stop 2.405,00 · às 08:12» |
| Ações | «AAPL · Compra · 100 ações» | «231,40 → 232,15 · +0,75» | «+US$ 75,00» | «stop 230,90 · alvo 232,40 · às 09:47» |
| Opções | «SPY Call 600 · hoje · Compra · 2 ct» | «1,85 → 2,40 · +0,55» | «+US$ 110,00» | «stop 1,45 · às 09:51» |
| Cripto | «BTC/USDT · Venda · 0,25 BTC» | «112.400 → 111.950 · +450» | «+US$ 112,50» | «stop 112.800 · às 20:36» |
| B3 | «WIN · Venda · 3 ct» | «131.250 → 131.100 · +150 pts» | «+R$ 90,00» | «stop 100 · alvo 200 pts · às 10:20» |

All NEW wording except the board pattern. Lot singular/plural: «0,50 lote», «2,00 lotes» (pt-BR plural from 2 up).

---

## 7. Minimal board changes (RegistrarOperacao)

Shared, no new scenario: the account note becomes «Contas de mercados diferentes nunca são somadas.» (2b, approved); the exit time
label follows the account clock (§3.6).

Four new scenarios, numbered after the five existing ones, each reusing a flow the owner already approved, with invented example
accounts from the 2b boards (FTMO, IBKR, Binance, Clear):

| # | Scenario label (NEW) | Flow reused | What it lets the owner approve |
|---|---|---|---|
| 6 | «Forex · FTMO, EUR/USD, 15 out 08:40 ET» | 1 · na entrada | «Par», «Lotes», «Stop e alvo, em pips», risk in US$, result in pips and US$; switching to «Usar “XAUUSD”» shows stop in price and the required «Resultado, US$» at exit; the «Corrigir» link |
| 7 | «Ações e opções · IBKR, SPY Call, 15 out 09:52 ET» | 2 · depois, com a operação fechada | «O que você operou?», option fields, «Venceu sem valor», premium × 100; toggle to «Ação ou ETF» (AAPL, 100 ações); the gate «Sem janela salva · Definir» in an account without rules |
| 8 | «Cripto · Binance, BTC/USDT, sábado 18 out 20:35 de Brasília» | 1 · na entrada | coin quantity, USDT suffix, position size, stop in price, «Custos, US$», weekend inside the window, «Hora da saída (Brasília)», funding hint (Q2) |
| 9 | «B3 · Clear, WIN, 15 out 10:20 de Brasília» | 4 · depois do limite | R$ everywhere, limit R$ 500 reached, tick 5 error, «IND»/«DOL» chips, «Custos, R$» |

Scenarios 1–5 stay as approved. A three-scenario cut is possible (drop 9, since B3 futures are the board's futures form in R$),
but B3 is the only market in R$ and the only one where a tick error is in points of 5, so four is recommended (Q10).

Effort (sum of earlier estimates, not new measurements): board about 1–1.5 days; code about +1–1.5 days per market beyond the
Phase 3 budget (`mercados/proposta.md` §«3 · Registrar»), so about 5–7.5 days for the four with their board.

---

## 8. Tests to add (invented data only)

- `domain/instrumentos` (NEW): every row of §3.1 and §4 examples: EUR/USD 57,50; USD/JPY ≈ 51,66; AAPL 75,00; SPY Call 110,00;
  BTC/USDT 112,50; WIN 90,00; WDO 110,00; IND/DOL multipliers; ticks WIN 5, WDO 0,5; pip 0,01 for JPY quote; lots step; integer
  contracts; 8-decimal price limit; crosses, CFDs, COIN-M, DI1, adjusted options → typed.
- TS/SQL parity of `INSTRUMENT_SPEC` and `instrument_specs()` (as `markets.test.ts` does for `MARKET_SPEC`).
- `register_exit` with `pnl_basis = 'prices'` recomputes `pnl` and refuses a mismatch; with `typed` keeps it.
- Limit in R$ (B3) and US$ (others) sums `pnl − commission`; swap/funding typed inside the result counts once.
- Options: `option_right` etc. null for every non-option trade; `direction` stays long/short; expiry before the entry day refused.
- Existing data untouched: count and sum of `pnl` per account equal before and after the migration (629 trades).

---

## 9. What the trader can leave empty, per market

| | Forex | Ações | Opções | Cripto | B3 |
|---|---|---|---|---|---|
| Stop, target | yes | yes | yes | yes | yes |
| Costs | yes (null = unknown) | yes | yes | yes | yes |
| Result | when computed (can correct) | computed | computed | when quoted in a dollar coin | futures and stocks computed; DI1 typed |
| Marks, images, note | yes | yes | yes | yes | yes |
| Exit (live entry) | until «Registrar saída» | same | same, or «Venceu sem valor» | same | same |

Always required: instrument, side, size, entry price, entry time (server time when live), and at the exit, exit price and time.

---

## 10. Risks

- **CFD contract sizes differ by broker.** A computed CFD result would be wrong silently; hence typed (§3.1).
- **USDT is not exactly US$.** Accepted by the 2b decision; the ⓘ of Cripto accounts already says so.
- **Forex account currency fixed at US$.** A EUR or GBP broker account must convert by hand; no field for it.
- **Price precision.** `numeric(18,8)` cuts memecoin prices (PEPE around 0,0000095 keeps 3 significant digits); computed results on
  large quantities could be off, so those trades go typed (§4.3).
- **Swap/funding inside the result** mixes market move and financing in the Análises «bruto» (Q2).
- **Options life cycle.** Expiry, exercise and assignment are simplified (close at 0 or intrinsic); spreads are out.
- **Symbol drift.** Root vs contract code for futures (imported `MESM6`) and B3 (`WINZ26`), and `PETR4F` vs `PETR4`, split the
  same asset in cuts unless grouped by root (§5).
- **Old pages.** `TradeAssetType` (`types/database.ts:442`) lacks `forex`, `cfd`, `option`; old pages filter by `market_type`, set
  to the account's market by `trades_bridge` (for `legado.md`).
- **Catalog facts age.** Catalog shares are from 2025–Q3 2026 and reviewed quarterly; Registrar must not hard-code them.
- **Unverified facts.** B3 stock tick R$ 0,01 (not confirmed in an official page); USD/KRW and USD/INR availability at retail
  brokers; common lot step 0,01 (MT5 makes it per broker). None of them is validated by the proposed forms.

---

## 11. Sources (seen 2026-10-18)

Official:
- B3, Futuro Mini de Ibovespa (WIN): https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/futuro-mini-de-ibovespa.htm
- B3, Futuro de Ibovespa (IND): https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/renda-variavel/futuro-de-ibovespa.htm
- B3, Futuro Mini de Taxa de Câmbio de Reais por Dólar Comercial (WDO): https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/moedas/futuro-mini-de-taxa-de-cambio-de-reais-por-dolar-comercial.htm
- B3, Futuro de Taxa de Câmbio de Reais por Dólar Comercial (DOL): https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/moedas/futuro-de-taxa-de-cambio-de-reais-por-dolar-comercial.htm
- B3, Futuro de DI1: https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/juros/futuro-de-taxa-media-de-depositos-interfinanceiros-de-um-dia.htm
- B3 (Bora Investir), ação fracionada: https://borainvestir.b3.com.br/glossario/acao-fracionada/
- CME Group, Micro E-mini S&P 500 specs: https://www.cmegroup.com/markets/equities/sp/micro-e-mini-sandp-500.contractSpecs.html ; Micro E-mini Nasdaq-100: https://cmegroup.com/trading/equity-index/us-index/micro-e-mini-nasdaq-100_contractSpecs_futures.html ; Micro Gold (SER-9247): https://cmegroup.com/notices/ser/2023/09/SER-9247.pdf
- OCC, equity options specifications (100 shares; adjusted contracts): https://www.theocc.com/clearing/clearing-services/specifications-equity-options.jsp
- Cboe, SPX options specifications (multiplier 100): https://www.cboe.com/tradable_products/sp_500/spx_options/specifications/
- Cboe, The State of the Options Industry 2025: https://www.cboe.com/insights/posts/the-state-of-the-options-industry-2025
- Cboe C2 rule exhibit on minimum increments (Penny Interval Program; SPY, QQQ, IWM): https://www.sec.gov/files/rules/sro/c2/2020/34-89081-ex5.pdf
- SEC, Section 31 fee rate advisory 2026-2: https://www.sec.gov/rules-regulations/fee-rate-advisories/2026-2 ; FINRA Information Notice 3/17/26: https://www.finra.org/rules-guidance/notices/information-notice-20260317
- SEC, Rule 612 exemptive order 34-105058: https://www.sec.gov/files/rules/exorders/2026/34-105058.pdf (extension to November 2027 reported by Traders Magazine/TradeInformer: https://tradeinformer.com/regulations/sec-extends-nms-relief-rule-611-repeal-2027, secondary)
- MetaQuotes, MQL5 `ENUM_SYMBOL_CALC_MODE` profit formulas, contract size, volume step: https://www.mql5.com/en/docs/constants/environment_state/marketinfoconstants
- Binance, futures PnL calculation (USDⓈ-M, COIN-M US$ 100 per BTC contract, ROI with fees and funding): https://www.binance.com/en/support/faq/how-to-calculate-profit-and-loss-for-futures-contracts-3a55a23768cb416fb404f06ffedde4b2 ; fee example (maker 0,02%, taker 0,05%): https://www.binance.com/pt/support/articles/360033544231 ; funding times: https://www.binance.com/en/support/faq/introduction-to-binance-futures-funding-rates-360033525031 (via `fatos_mercados.md` §2.1)
- BIS Triennial Survey 2025 FX annex (catalog research): https://www.bis.org/publications/commentary-otc-derivatives/statistics-rpfx25-fx-annex.pdf

Secondary:
- Babypips Forexpedia, lot sizes: https://www.babypips.com/forexpedia/lot ; pip convention (JPY 0,01): https://tradenation.com/articles/what-is-a-pip-in-forex-trading/
- Options Symbology Initiative format: https://ibkb.interactivebrokers.com/article/972 ; https://www.fidelity.com/research/options/osi.shtml
- Earlier research reused: `mercados/fatos_mercados.md` (hours, platforms, exports, funding, B3 costs), `pers/catalogo80.json`
  (catalog shares and their sources).

---

## Open questions for the owner

1. **How does Registrar get the result in the new markets?**
   - (a) **Recommended.** Computed from the prices where it is exact (B3 futures and stocks, US stocks and options, crypto in
     USDT/USDC, forex pairs quoted in dollar), estimated for pairs like USD/JPY, and typed where the app cannot know it (forex
     crosses, CFDs, COIN-M, DI1). A «Corrigir» link lets you put the number your platform shows.
   - (b) Always typed, with the computed value only as a hint.
   - (c) Always computed; markets or instruments that cannot be computed are not offered.
   - Also say whether «Corrigir» should exist on the futures form too (the approved board has none).
2. **Swap (Forex) and funding (Cripto perpetuals).**
   - (a) **Recommended.** Inside the typed or corrected result, with the hint «com swap ou funding, se houver». No new field; same
     as the approved column mapping, which has no swap column.
   - (b) An optional signed field «Swap ou funding», kept apart and counted in the daily limit.
   - (c) Ignored.
   Note: with the default Cripto window 20:00–22:00 de Brasília, the 21:00 funding (00:00 UTC) falls inside it.
3. **Costs field in the new markets.**
   - (a) **Recommended.** «Custos · opcional» at the exit, in the account's currency (commission and fees; tax never). Empty means
     unknown, and the limit counts the result before costs, as it does today.
   - (b) No field until the column-mapping import (3b) brings the costs.
   - (c) Also add it to the futures form.
4. **Options: how far in Phase 3?**
   - (a) **Recommended.** Single-leg calls and puts on catalog stocks/ETFs plus SPX, XSP, NDX, RUT and VIX; «Venceu sem valor» at
     exit; exercise and assignment registered by hand (close at intrinsic value, stock as a separate trade); spreads not yet.
   - (b) Also spreads, typed as one trade with the net premium and a strategy name.
   - (c) Only stocks and ETFs now; options later.
   - Also: should a proper «80% of options volume by underlying» list be researched (as the other catalogs were), or is the stock
     catalog plus the index roots enough?
5. **Which Forex and CFD instruments to offer?**
   - (a) **Recommended.** The 16 catalog pairs by search, chips with your last five, and «Usar “x”» for any other symbol (gold,
     indices), whose result you type.
   - (b) Add a short CFD list (XAU/USD, US100, US30, US500) as catalog entries, still with a typed result.
   - (c) Only the 16 catalog pairs.
6. **Crypto size and quote.**
   - (a) **Recommended.** Quantity in the coin («0,25 BTC»), prices in USDT/USDC/USD; COIN-M, pairs in R$ and MT5 crypto CFDs
     take a typed result in US$.
   - (b) Size as the position value in US$ (the app derives the coin quantity).
   - (c) Only USDT pairs; nothing else accepted.
7. **B3 instruments.**
   - (a) **Recommended.** WIN, WDO, IND and DOL as chips (computed in R$), the 56 catalog stocks/ETFs by search, DI1 only with a
     typed result.
   - (b) WIN and WDO only, plus stocks.
   - (c) Futures only.
8. **Symbols outside the catalog in Registrar.**
   - (a) **Recommended.** Allowed with «Usar “x”»; the result is typed when the app has no spec for it. The catalog keeps deciding
     what the hub reads (charts, state), and «Pedir» stays in Personalizar.
   - (b) Catalog only; to log another symbol, first «Pedir» it.
9. **Stop and target units.**
   - (a) **Recommended.** Points in B3 futures (as the futures board), pips in forex pairs, price levels in stocks, options
     (premium), crypto and CFDs.
   - (b) Price levels everywhere, with the distance shown under the field.
   - (c) Points or pips everywhere, including stocks and crypto (as a price distance).
10. **Board scenarios for the new markets.**
    - (a) **Recommended.** Four (6 Forex, 7 Ações e opções, 8 Cripto, 9 B3), each reusing an approved flow; scenarios 1–5 unchanged
      except the 2b note.
    - (b) Three (drop B3: its futures form is the futures form in R$).
    - (c) Build straight in the app and review there, as with «Editar conta».
11. **Futuros (EUA) beyond MES, MNQ and MGC.**
    - (a) **Recommended.** In Phase 3, add the equity-index and metal/energy contracts of the catalog with fixed dollar per point
      (ES, NQ, GC, CL, MCL) to the futures chips by search, computed; Treasury, SOFR, Fed Funds, natural gas and corn by search
      with a typed result.
    - (b) Keep only your three until another futures trader needs more.
    - (c) All 13 catalog contracts, each with its own price input (32nds for Treasuries).
