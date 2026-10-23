# Fase 3c · the optional rule «mover para o breakeven com +N pontos»

Spec only (research/design). Read from the repo at `feature/rebuild-lean` 4c02dac: migrations 20261018000001..3,
20261019000001, 20261020000001/3, 20261022000001; `app/lib/domain/gate/rules.ts`, `app/lib/hub/regras.ts`,
`app/lib/domain/registro/*`, `app/components/hub/personalizar/*`; boards `fase3c/quadro/project/Personalizar.dc.html`
(Suas regras) and `RegistrarOperacao.dc.html` (open trade view). Owner decisions: `fase3c/decisoes.md` (FINAL).
Nothing here touches the repo or the live DB. Verified on a throwaway Postgres (deleted): jsonb compares numbers by value
(`'10'::jsonb = '10.0'::jsonb`) and objects regardless of key order, but keeps the written scale as text (`10.0`), so
the resolver normalises with `trim_scale`.

---------------------------------------------------------------------------------------------------------------------
## 0. In one paragraph

A management rule, not a gate rule: it never changes «Posso operar hoje?». It is stored inside the existing versioned
rules (market default + «só nesta conta», like the window; Futures shows «Padrão Futuros», the other markets edit it per
account), as a new **optional** key `breakeven`. **An absent key means no rule.** Every stored row and version lacks
the key, `rules_resolve` adds it only when the rule is on with at least one asset, and so every existing account
resolves to byte-for-byte the same jsonb. No save creates a version that was not already due. N is **per asset**
(MES and MNQ points differ about 4×), in the asset's own stop unit: points (futures, B3 mini/full contracts), pips
(forex pairs with a pip), price units (stocks, crypto, B3 stocks, forex/futures outside the tables). It never applies to
binaries or to option contracts. The Registrar has no live price, so it does not "detect +N". It (1) shows the plan
line «Breakeven pela sua regra: +10 pts, em 7922,50», (2) compares every stop move with the rule («Stop no breakeven às
10:21, com +11 pts · No ponto»), (3) nudges after a partial exit that proves the price passed +N while the stop is
still the initial one, and (4) optionally asks «chegou a +N?» at an exit that cannot tell. Análises later classifies
every closed live trade as no ponto / cedo / tarde / não moveu, plus three non-judged classes, and shows what happened
after (zero, profit, initial stop), in R.

---------------------------------------------------------------------------------------------------------------------
## 1. What the rule means

### 1.1 The sentence
«Quando a operação estiver **+N** a favor, mover o stop para o preço de entrada.» A suggestion, never a block (decision
2). Judged per trade by the rule of **the version in force at the entry** (`trades.rule_version_id`), like the window
and the limit: changing N later never rewrites a past trade.

### 1.2 Per asset (recommended; Q1)
A single N per account is wrong for the owner's own futures: the board's MES stops are 9–12 pts and MNQ's 40–60 pts,
MGC's 7–16. «+10» is about 1R on MES and ¼R on MNQ. A single number would silently misjudge every other instrument,
and Análises would report "cedo" for all MNQ moves. So the rule is a short list «ativo → N». For a one-asset trader it
reads as one sentence («MNQ: +40 pts»). An asset without a row has **no rule**: never a silent fallback.

The asset key is `trade_match_key(market, symbol)` (MESZ5 → MES, EUR/USD → EURUSD, WINZ26 → WIN, PETR4F → PETR4, BTC/USDT
→ BTCUSDT). MES and ES are two keys, even though their points are the same index points. The owner adds both if he
trades both (§9).

### 1.3 Units (the asset's stop unit, `trade_instrument(market, key, null).stops`)

| Unit | Who | N means | Δ price for N |
|---|---|---|---|
| `pts` | futures in `instrument_specs` (ES MES NQ MNQ GC MGC CL MCL), B3 WIN IND WDO DOL | points | N |
| `pips` | forex pairs with a `pip` (EURUSD … USDMXN, EURGBP, EURJPY, EURCHF) | pips | N × pip (0.0001; 0.01 on JPY pairs) |
| `price` | stocks, crypto, B3 stocks and DI1, forex/futures outside the tables (XAUUSD, USDINR, ZN, NG…) | price units of the quote | N |
| — | binary (no stops), option contracts (premium) | never | — |

"Points" and "price units" are the same Δ price; only pips convert. The unit is **frozen into the version** (§2.3) so a
later spec change (a pair gaining a pip) cannot change the meaning of an old version.

### 1.4 What counts as "moved to breakeven"
A stop move (Fase 3c «Mover stop») whose new stop is at the entry or beyond it in the trade's favour, within one step:
long `new_stop ≥ entry − step`, short `new_stop ≤ entry + step`. The step is one tick for an asset with a tick, one pip
for pips, 0 otherwise. The «Breakeven» shortcut sets exactly the entry price. A move that tightens the stop but stays
below the entry (long) is an «ajuste», not breakeven. The **first** qualifying move is the breakeven move; later
trailing moves do not change the class.

---------------------------------------------------------------------------------------------------------------------
## 2. Storage in the versioned rules

### 2.1 Shapes (rules JSON stays `"v": 1`; no new version of the format)

```
MarketRules  (market_rule_defaults.rules)   + optional  "breakeven": BreakevenSetting
AccountRules (account_rule_settings.rules)  + optional  "breakeven": BreakevenSetting
                                              absent = inherit the market's; present = «só nesta conta», whole
BreakevenSetting  {"on": bool,
                   "by": {KEY: N, ...}}      0..20 keys; KEY = trade_match_key(market, KEY) ~ ^[A-Z0-9]{1,20}$;
                                             N a JSON number > 0, ≤ 1 000 000, at most 8 decimals
Resolved (account_rule_versions.resolved)   + optional  "breakeven": {"by": {KEY: {"n": N, "un": "pts"|"pips"|"price"}, ...}}
                                              present only when the effective setting is on with ≥ 1 key (1..20 keys);
                                              absent = no rule
```

* `on: false` keeps the values in the settings, so turning it off and on loses nothing. It resolves exactly like
  "never set", so toggling never creates a version by itself. Only the effective rule does.
* Inheritance replaces the whole object, with no per-asset merge, like the account's own window replacing the
  market's windows. The resolver takes `o.breakeven` if the account has the key, else `m.breakeven`, else none. Simple
  to read: «só nesta conta» means the whole list is this account's.
* `rules_builtin` does **not** gain the key: absent ≡ off, and `rules_config().builtin` stays identical.
* Resolved wraps the map in `{"by": …}` so a later variant (a unit in R, BE + ticks) can be another optional key inside
  it without touching `by`.
* `n` in Resolved is `trim_scale(N)` (10.50 → 10.5): the jsonb equality would already treat 10.5 and 10.50 as equal,
  but the TS `canon` compares text.

### 2.2 Why no spurious versions (the proof the migration runs)
`save_rules` versions an account when `rules_current(a) <> last version` (jsonb). Before the owner sets a rule:
no stored MarketRules/AccountRules has `breakeven` → `rules_resolve` emits the same 9 keys with the same values → the
jsonb is identical to every stored version → no version. After he sets one: exactly the accounts whose effective rule
changed get a version (the Padrão Futuros change versions every inheriting futures account, archived ones included,
as any default change already does; the board's «Ao salvar: versão nova desde … em …» line covers it). The TS side is
the same: `toResolvedJson` omits the key when `breakeven` is null, so `sameRules`/`pendingVersions` see no change.

### 2.3 Database changes (one new migration, e.g. `20261023000001_regra_breakeven.sql`, before the 3c trades migration)

1. **`market_caps_all()`**: every market's `rules` gains `"breakeven"`: `true` for futures, forex, stocks, crypto,
   b3, options; `false` for binary. This keeps "never binary" in the one descriptor. The Jest parity test reads the
   literal from the newest migration that defines it, and `MARKET_SPEC` gets the twin field.
2. **New validators** (pure, never raise, internal, revoked from public/anon/authenticated like the others):
   * `rules_is_dist(p jsonb) → boolean`: a JSON number, > 0, ≤ 1 000 000, `p::numeric = round(p::numeric, 8)`.
   * `rules_check_breakeven(p_market text, p jsonb) → text`, in this order: caps `breakeven` false → `not_for_market`;
     not an object → `bad_breakeven`; keys ⊄ {on, by} → `unknown_key`; either missing, or `on` not boolean, or `by` not
     an object → `bad_breakeven`; more than 20 keys → `bad_breakeven`; a key not `^[A-Z0-9]{1,20}$` or ≠
     `trade_match_key(p_market, key)` → `bad_breakeven`; a value failing `rules_is_dist` → `bad_breakeven`.
   * New bare code **`bad_breakeven`** (errcode 22023 through save_rules, like the others).
3. **`rules_check_market`**: allowed keys += `breakeven`; when present → `rules_check_breakeven(market, …)`.
4. **`rules_check_account`**: allowed keys += `breakeven`; same check. It goes before the limit check, so the limit
   stays the last return, as now.
5. **`rules_check_resolved`**: the key count becomes `9 + (p ? 'breakeven')::int`, with `breakeven` in the allowed
   list. When present: caps false → `not_for_market`; else it must be `{"by": {...}}` with only `by`, holding 1..20
   canonical keys, each `{"n": rules_is_dist, "un": 'pts'|'pips'|'price'}` with exactly those keys, else
   `bad_breakeven`. `un` is **not** rechecked against today's spec (old versions stay valid forever).
6. **`rules_resolve`** (same signature, still `immutable`): after building today's object,
   ```
   s := case when o ? 'breakeven' then o->'breakeven' else m->'breakeven' end;
   if caps.rules.breakeven and jsonb_typeof(s) = 'object' and (s->>'on')::boolean
      and exists (select 1 from jsonb_object_keys(s->'by')) then
     result := result || jsonb_build_object('breakeven', jsonb_build_object('by',
       (select jsonb_object_agg(k, jsonb_build_object('n', trim_scale((v #>> '{}')::numeric),
                                                      'un', public.trade_instrument(p_market, k, null)->>'stops'))
        from jsonb_each(s->'by') e(k, v))));
   ```
   `trade_instrument` is immutable and already granted to authenticated (rules_resolve runs as the invoker inside
   rules_config/gate_at). A key whose spec gives no `stops` (cannot happen outside binary) is left out of `by`, and an
   empty `by` drops the key.
7. **Unchanged**: `rules_builtin`, `rules_current`, `rules_check_payload` (it calls the validators), `save_rules`,
   `rules_rev`, `gate_eval`, `gate_at`, `rules_now`, `rules_config` (it already returns settings and versions raw, so
   the new key flows through), `limit_usage`, triggers, tables, policies.
8. **Trade side** (in the 3c trades migration, the one that replaces `trade_state` for moves and partials, so it is
   replaced once):
   * `trade_breakeven(p_resolved jsonb, p_market text, p_symbol text, p_option boolean, p_direction text,
     p_entry numeric) → jsonb`: internal, immutable. Null when there is no rule, binary, an option contract, an
     unknown direction, a null entry, or the key is not in `by`. Otherwise `{"key", "n", "un", "level"}`, with
     `level = entry + sgn × n × (un = 'pips' ? pip : 1)`. For `pips` without a pip in today's spec, level is null.
     The level is not snapped to the tick (it is a threshold), and the screen formats it with the asset's price_dp.
   * `trade_state` gains `"breakeven": trade_breakeven(v.resolved, account.market, t.symbol, option present,
     t.direction, t.entry_price)`, the rule of the trade's own version. The Registrar never recomputes which version
     applied.
9. **Proof at the end** (as m5d / m34, codes with counts, never values). Section 0 saves, per account, `rules_current`,
   the gate at one instant, the md5 of the account row and versions, plus `rules_builtin` of every market and
   `market_caps_all()`. Then it asserts: every stored default/setting/version passes the new validators; every
   `rules_current(a)` is unchanged (**the no-spurious-versions check**); every gate answer at the same instant is
   unchanged; no row or version changed; builtin unchanged; `market_caps_all()` equals the old one after removing each
   `rules.breakeven`; no stored jsonb has the key; privileges as before (new functions not executable by anon, and the
   validators not by authenticated).
10. **Deploy order**: migration first. It accepts the key but nothing writes it, so the deployed app keeps working.
    Then the app that reads and writes it. An old open tab parses a version with `breakeven` through the strict
    `parseRules` (10 keys) and shows «Não foi possível carregar as regras.» until reloaded. That is acceptable: only
    the new app can save the key.

### 2.4 TS domain and app (twins, with parity)

| Where | Change |
|---|---|
| `lib/domain/markets.ts` | `MarketSpec.rules.breakeven: boolean`; `marketCapsJson` emits it (parity with the SQL literal) |
| `lib/domain/gate/rules.ts` | `Rules.breakeven: BreakevenRule \| null` with `BreakevenRule = { by: Record<string, { n: string /* decimal text, decimalFromJson(x, 8) */; un: StopUnit }> }`; `checkRules` = §2.3.5 (optional 10th key, same codes, new `'bad_breakeven'` in `RulesErrorCode`); `parseRules`; `toResolvedJson` omits the key when null and writes `n` as `Number(text)` |
| `lib/hub/regras.ts` | `BreakevenSetting { on: boolean; by: Record<string, string> }` (decimal text). `MarketSettings.breakeven: BreakevenSetting \| null` (null where caps false or nothing saved). `AccountSettings.breakeven?: BreakevenSetting` (undefined = inherit). `Market/AccountRulesJson` + `fromJson`/`toJson` (key written only when set). `resolveRules` = §2.3.6 using `tradeInstrument(market, key, null).stops` and trim-scaled text. `withAccountRule` removes the account's own value when it is `canon`-equal to the market's (board `setR`). `copyAccountSettings` already deep-copies the key. `settingsIssues` unchanged (the row validates before writing the draft, §3.4) |
| `lib/hub/regrasDb.ts` | `bad_breakeven` in `RULES_RPC_ERROR_CODES`/`REGRAS_ERROR_CODES` (generic «Não foi possível salvar…» message) |
| `lib/hub/rascunho.ts` | `comBreakeven(draft, entidade, setting \| undefined)`, `comBreakevenLigado`, `comBreakevenAtivo(key, n \| null)` |
| `lib/domain/registro/breakeven.ts` (new) | `breakevenOf(rules, market, symbol, option, direction, entry)` = SQL `trade_breakeven`; `isBreakevenMove(side, entry, newStop, step)`; `checkMove(rule, favorX, earlier)` → `'no_ponto' \| 'cedo' \| 'tarde' \| 'sem_pontos'` (§4.2) |
| `lib/domain/analises/breakeven.ts` (Fase 6) | `classifyBreakeven(trade)` and `aggregateBreakeven(trades)` (§5) |
| `lib/hub/registrarDb.ts` | `parseTradeState` reads `breakeven` (`{key, n, un, level}` \| null) |

**Parity tests**: market caps literal; `checkRules` against `rules_check_resolved` over recorded fixtures (absent, on,
off, empty, 20/21 keys, non-canonical key, 0, negative, 9 decimals, binary); `resolveRules` = `rules_resolve`
(`hubRegras.pg.test.ts`: add steps "turn on Padrão Futuros MES +10 MNQ +40", "account own MNQ +30", "own off",
"back to the default", "an unrelated window edit creates no version for an account with the rule"); `breakevenOf` =
`trade_breakeven` (MES long and short, MNQ, EURUSD and USDJPY pips, PETR4 price, BTCUSDT, an option → null, binary →
null, key absent → null). SQL suite `supabase/tests/80_regra_breakeven.test.sql`: validators, codes, resolve,
versions, privileges.

---------------------------------------------------------------------------------------------------------------------
## 3. Suas regras (Personalizar)

### 3.1 Where
Inside «Suas regras», after «Limite do dia» and «Regra por estado», a second group with its own small heading. The
rows above decide «Posso operar hoje?»; this one does not, and the heading says so:

* h4 **«Durante a operação»**, with the nota «Não muda o “Posso operar hoje?”: guia a operação aberta, e as Análises
  conferem depois.»
* Hidden for binary accounts. For a «Regras de» selection that is an Ebinex account, the group does not render.

### 3.2 Per account and market default (like the window)
* **«Padrão Futuros»** pill: the row edits `MarketRules.breakeven` for futures. Every futures account without its own
  uses it.
* **A futures account**: same row, with tag «padrão de Futuros» (inherited) or «só nesta conta» (own), plus «não salvo»
  when changed. Any edit creates the account's own copy (board `setR`). An own copy that becomes equal to the
  default is dropped. With an own copy, a **«Voltar ao padrão»** button (44 px; aria «Voltar ao padrão de Futuros:
  {conta}») removes it, the window override's pattern (board line 488).
* **Forex, Ações, Cripto, B3 accounts**: per account only, no tag (as their other rules; caps.padrao false). The
  hidden market default is never edited.

### 3.3 The row (copy, pt-BR)

```
Mover para o breakeven                         [padrão de Futuros | só nesta conta] [não salvo]
[switch] Ligada | Desligada: o Registrar não sugere e as Análises não conferem.
  Com quanto a favor, por ativo
  MES   + [ 10  ] pts                    Tirar
  MNQ   + [ 40  ] pts                    Tirar
  [+ Ativo]
  Quando a operação estiver com esse tanto a favor, o Registrar mostra o preço do breakeven; se você mover
  antes, depois ou não mover, as Análises contam. Nunca bloqueia.
  [Voltar ao padrão]                      (account with its own, futures only)
```

* Switch: `role="switch"`, `aria-labelledby` the row name. States «Ligada» / «Desligada: o Registrar não sugere e as
  Análises não conferem.»
* With the switch on and no asset: aviso «Sem ativo: esta regra não age.» (the «Sem janela: esta regra não age.»
  pattern). Saving is allowed; it resolves to no rule.
* Unit suffix per asset (§1.3): `pts` → «pts», `pips` → «pips», `price` → «no preço». Numbers are pt-BR («7,5»).
  Input `inputmode="decimal"`. aria-label: «Pontos a favor para mover o stop do MES» / «Pips a favor para mover o stop
  do EUR/USD» / «Quanto a favor, no preço, para mover o stop do PETR4». The visible asset name uses the market's display
  form (EUR/USD, BTC/USDT), while the key stays canonical.
* «Tirar»: 44 px; aria «Tirar o MES da regra».
* Edit in place, like «Bloqueio de dados»' minute fields: a valid value goes to the draft on change; on blur, an empty
  or invalid value goes back to the last valid one, with «Digite um número maior que zero, como 10 ou 7,5.» (role
  alert, `aria-invalid`).
* **«+ Ativo»** (aria «Adicionar um ativo à regra de breakeven») opens an inline form, the «Limite do dia» Definir
  pattern:
  * «Ativo»: chips of the account's recent assets (`padroesDoRegistrar(...).simbolos`, futures `FUTURES_CHIPS`), minus
    those already listed, plus «Outro» with a field «Código do ativo». Placeholders by market: Futuros «Ex.: CL», Forex
    «Ex.: EUR/USD», Ações «Ex.: AAPL», Cripto «Ex.: BTC/USDT», B3 «Ex.: WIN ou PETR4». The code is canonicalised with
    `tradeMatchKey`. On Cripto the pair matters: BTCUSDT ≠ BTCUSDC.
  * «Pontos a favor» / «Pips a favor» / «A favor, no preço», after the asset's unit.
  * «Adicionar» / «Cancelar». Errors: «Escolha um ativo.», «Use só letras e números, como MES ou EUR/USD.», «Este
    ativo já está na regra.», «Use até 20 ativos.», «Digite um número maior que zero, como 10 ou 7,5.»
* Ações e opções accounts, an extra nota: «Vale para ações; opções ficam fora.»
* Layout: at 375 px each asset line wraps as `name | + [field] unit | Tirar`, with fields ≥ 44 px high. Contrast via
  hub tokens in both themes.

### 3.4 Other texts that change
* **Version note** (`NOTA`, board `partesSig`, the «Ao salvar» summary and the history): `breakeven: (itens) =>
  \`breakeven ${lista(itens)}\`` with items like «MES +10 pts», «EUR/USD +7,5 pips», «PETR4 +0,50 no preço»; `semBreakeven:
  'sem breakeven'`. These appear only for markets with the cap, and an account with the rule off and one never set
  both read «sem breakeven», so neither counts as a change.
* **ⓘ Suas regras** (`REGRAS.info`), add: «“Mover para o breakeven” não muda o “Posso operar hoje?”: o Registrar mostra
  onde mover o stop, e as Análises conferem se você moveu no ponto, cedo, tarde ou não moveu, pela versão que valia na
  entrada.»
* **ⓘ new markets** (`REGRAS.infoMk`): «as regras são a janela, o limite do dia e o breakeven, …».
* **New account** (`regrasConta.ts` `linhaResumo`): copying from another account carries the rule. The summary adds
  «· breakeven MES +10 pts» when present.
* «Como fica hoje»: unchanged (it is about the gate).

---------------------------------------------------------------------------------------------------------------------
## 4. Registrar (suggest, never block)

There is no live price. The app knows only what the owner types: the entry, the initial stop, each stop move with the
**points in favour at that moment** (decision 2) and its server time, and each partial or final exit price. The
suggestion is built on those facts.

### 4.1 What this rule needs from the 3c trade model (the sibling bank/registrar specs own the names)
* Stop moves: append-only, `moved_at` = server time, `stop_price` (new level), the favour at that moment (preferably
  stored as the **price at that moment**, a level like stop/target, so Análises derives points in any unit; or as
  points in the asset's unit), and whether it came from the «Breakeven» shortcut. Live app trades only.
* Partial exits: time (server registration + typed hour), price, quantity. The final exit is the last one.
* `trades.stop_price` stays the **initial** stop, frozen (R is measured by it; decision principle).
* `trade_state` returns moves, exits and `breakeven` (§2.3.8).
* Optional mark kind `alcance_be` (§4.5).

### 4.2 The check of one move (`checkMove`, used live and in Análises)
`N` = the rule for the trade's asset; `X` = favour at the move, in the unit; `tol = max(N × 10 %, step)` with step =
one tick (pts and price with a tick), 1 pip, or 0 (Q3).
1. Some earlier fact (a partial exit, or an earlier non-BE move) showed favour ≥ N + tol → **tarde** («a parcial das
   10:14 já tinha +15»).
2. Else, X unknown → **sem os pontos** (moved, not judged).
3. Else X < N − tol → **cedo**; X > N + tol → **tarde**; else **no ponto**.

### 4.3 Open trade view (board «Operação aberta», under the `resumo-op` stop line)
* Rule for this asset, stop not yet at BE: «**Breakeven pela sua regra:** +10 pts, em 7922,50.» (pips: «+7,5 pips, em
  1,08595»; price: «+0,50 no preço, em 38,92»). This is the plan line the trader acts on, since the app cannot see
  the price.
* After a BE move: «Stop no breakeven às 10:21, com +11 pts.» plus a marca: **«No ponto»** (`marca-ok`) | **«Cedo ·
  regra +10»** | **«Tarde · regra +10»** (`marca-fora`, amber) | «sem os pontos» (`marca-nada`). Without a rule for
  the asset, the line stays and has no marca: the move is recorded, not judged.
* **Nudge after a partial**: a partial exit registered with favour ≥ N while no BE move exists and the position is
  still open: «A parcial das 10:14 saiu com +12 pts e o stop segue no inicial. Sua regra: breakeven com +10.» +
  button **«Mover para o breakeven»**, which opens «Mover stop» with the shortcut chosen. It is a line, not a modal,
  and it goes away once moved or closed.
* No rule for this asset while the account has the rule for others: nothing (no nagging). The «Mover stop» sheet shows
  a quiet «Sem regra de breakeven para MGC.» with the link «Definir em Suas regras».

### 4.4 «Mover stop» sheet (fields designed by the 3c registrar spec; what this rule adds)
* Under the «Breakeven» shortcut chip: «Preço de entrada: 7912,50 · sua regra: com +10 pts (7922,50).»
* As the owner types «A favor agora»: live preview, `role="status"`: «+8 pts: 2 antes da sua regra.» / «+10 pts: no
  ponto da sua regra.» / «+14 pts: 4 depois da sua regra.» It never disables the button.
* Recommendation for that spec: «A favor agora» is required with the shortcut (one number; decision 2 asks for it) and
  optional for any other adjustment.

### 4.5 At the exit that closes the trade (optional question; Q2)
Asked only when the rule applies, no BE move exists, and nothing so far shows favour ≥ N. Typically the trade went
back to the initial stop with no partial. Without the answer, "não moveu" and "não chegou" cannot be told apart.
* «Antes de sair, chegou a +10 pts a favor?» chips **«Chegou»** / **«Não chegou»**, nota «Opcional. Só para as Análises
  conferirem o breakeven.» No answer = sem dado.
* Stored as a mark (append-only, server time, `null` = desmarcar): `trade_marks.kind` += `'alcance_be'`, values
  `'chegou' | 'nao_chegou'`. Made after the result, so `limpa = false`, like any mark made after the exit, and
  Análises shows when a class rests only on it (§5.4). The «Registrar saída» payload `marks` accepts the kind.
* Also in «Já fechada»? No: those trades have no live moves and are not evaluated (§5.1).

### 4.6 Day list (the Registrar's «Operações do dia», later the Diário)
A second small marca next to «No plano» for closed live trades with the rule: «BE no ponto» (ok) / «BE cedo» / «BE
tarde» / «Não moveu» (amber). Nothing for the non-judged classes. It is computed from `classifyBreakeven`, never
stored.

---------------------------------------------------------------------------------------------------------------------
## 5. Análises (Fase 6 KPIs, Fase 7 Padrões)

### 5.1 Which trades
Live app trades (`trade_entry_context.origin = 'live'`) of price markets whose entry version has `breakeven.by[key]`,
excluding option contracts. Not evaluated, with the reason kept for the counts: imported only (no stop in the files,
which never carry SL), «Já fechada» (no live moves), no rule for the asset, still open. When the import links a file
row group to an app trade, the file's exit prices (money) apply and the app's moves stay (decision 2 of Fase 3: the
file wins on money).

### 5.2 Classes (`classifyBreakeven`)
Facts: side s, entry E, initial stop S0 (may be null), N and unit from the version, moves (time, new stop, X), exits
(time, price, qty), mark `alcance_be`. A fact's favour = s·(price − E) in the unit.

| Class | When | Counts in the adherence rate |
|---|---|---|
| **no ponto** | BE move judged no ponto (§4.2) | yes, followed |
| **cedo** | BE move with X < N − tol | yes |
| **tarde** | BE move with X > N + tol, or after a fact ≥ N + tol | yes |
| **não moveu** | no BE move, and a fact before the final exit shows favour ≥ N (a partial, a non-BE move with X ≥ N) or the mark says «Chegou» | yes |
| saiu sem mover | no BE move, and the only fact ≥ N is the final exit itself (closed everything with ≥ +N) | no: the rule became moot, listed apart |
| moveu sem os pontos | BE move without X (and no earlier fact ≥ N + tol) | no |
| não chegou | no BE move, the mark says «Não chegou» | no |
| sem dado | no BE move, nothing either way | no |

Adherence = no ponto ÷ (no ponto + cedo + tarde + não moveu).

### 5.3 What happened after (the remaining position's last exit, in R by the initial stop when S0 exists)
* `R` of the trade = Σ (qty_i / qty_total) × s·(P_i − E) / |E − S0| (units, so it works for typed-result instruments;
  `rMultiple` per exit, weighted). Without S0: points/money only.
* Final leg: **no zero** (within ±step of the entry), **no lucro** (> step), **no stop inicial** (at or beyond S0 −
  step), **no prejuízo** (between).
* Per class: count, average R, how many ended no zero / no lucro / no stop inicial.
* Headlines (copy):
  * «Não moveu e a operação voltou ao stop inicial: 3 · −3,0R. Com a regra, teriam saído perto de zero.» This is the
    estimated cost of not following; "perto de" because a BE stop also slips.
  * «Moveu cedo e saiu no zero: 2 de 3.» No counterfactual claim: the app cannot know whether the target would have
    come.
  * «No ponto: 7 · 4 saíram no zero, 3 seguiram no lucro (média +1,8R).»
  * Card: title «Breakeven», sub «Cada operação pela regra da versão que valia na entrada.», «12 com a regra: 7 no ponto
    · 2 cedo · 1 tarde · 2 não moveu», then «Fora da conta: 3 saíram sem mover · 2 não chegaram · 1 sem dado.»

### 5.4 Evidence (Fase 7 Padrões)
Stop moves are made live, with server time, before the result: clean evidence, which can reach «Confirmada». A class
that rests only on the `alcance_be` mark, made after the exit, stops at «Pouco fundamentada», as marks made after the
result already do. Patterns to offer: «Quando você move cedo, 2 de 3 saem no zero», «Não mover custou −3,0R no mês».
Later (Fase 5/8 market data with 1-minute candles) the high/low after the entry can replace the question and judge
"tarde" exactly. Until then, typed facts only.

---------------------------------------------------------------------------------------------------------------------
## 6. Boards to draw (before code; extend the approved v57 boards, invented data)

**Personalizar.dc.html, Suas regras**: the group «Durante a operação» with:
* «Padrão Futuros», rule on, MES +10 pts, MNQ +40 pts;
* Top One inheriting it (tag «padrão de Futuros»);
* a second futures account with its own MNQ +30 (tag «só nesta conta», «Voltar ao padrão»);
* FTMO EUR/USD +7,5 pips (no tag);
* Ebinex without the group;
* states: off, on with no asset (aviso), the «+ Ativo» form open with an error, «não salvo», and the «Ao salvar:
  versão nova desde … em …» line naming the inheriting accounts.

**RegistrarOperacao.dc.html**, inside the 3c scenarios:
* the plan line on scenario 10's open MES (2 ct @ 7912,50, stop 10, rule +10 → «em 7922,50»);
* the «Mover stop» sheet with the shortcut hint and the live «+8 pts: 2 antes da sua regra.»;
* after-move lines for no ponto, cedo and tarde;
* the partial nudge (parcial 1 ct @ +12, stop still the initial);
* the exit question on a trade stopped without a partial;
* the day-list marcas.

Check text contrast in both themes, 44 px targets, and 375/768/desktop.

---------------------------------------------------------------------------------------------------------------------
## 7. Perguntas para o dono (with the default if he says nothing)

1. **Por ativo?** «A regra guarda um N por ativo (MES +10, MNQ +40), porque 10 pontos no MES e no MNQ são distâncias
   bem diferentes. Ativo sem N fica sem regra.» Alternativa: um número só por conta. Padrão: **por ativo**.
2. **«Chegou a +N?» na saída**: uma pergunta opcional, só quando o app não consegue saber (saiu sem parcial e sem mover)
   para separar "não moveu" de "não chegou". Padrão: **sim, opcional**.
3. **Folga do "no ponto"**: 10 % de N, no mínimo 1 tick (1 pip). Padrão: **assim**.

---------------------------------------------------------------------------------------------------------------------
## 8. Invariants (what tests must hold)
* No stored row, version, trade or day changes; every account's `rules_current` and gate answer are identical before
  and after the migration; no save creates a version for an account whose effective rule did not change.
* Binary: the key is refused everywhere (`not_for_market`). Option contracts are never judged.
* The rule a trade is judged by is its entry version's, frozen with its unit.
* The rule never blocks, never changes «Posso operar hoje?», `gate_eval` or the limit.
* Classes are derived, never stored. The only new stored facts are the 3c moves/exits and the optional `alcance_be`
  mark.

## 9. Out of scope (noted)
* BE + N ticks (covering costs) and N in R: possible later as optional keys inside `breakeven`.
* MES/ES and MNQ/NQ sharing one row (same index points): a later convenience. Today, two rows.
* Options (premium) and binaries.
* Judging from market data (Fase 5/8).
* A per-asset rule in «Padrão» for the other markets (their defaults stay hidden, as today).
