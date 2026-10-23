# Fase 3c · Telas · parciais e movimentos do stop no Registrar, e a regra do breakeven

Screen design for the owner's request of 21 Oct («faltou na hora de registrar a operação a realização de parciais, e indicar
com quantos pontos você move ou não a operação pra breakeven»). Research and design only: nothing here was built, rendered
or written to the repo or the live database. UI copy pt-BR; everything else English, as the earlier specs.

Precedence where this file is silent: `fase3c/decisoes.md` (FINAL) → `fase3/decisoes.md` → as-built code at `4c02dac`
(`components/hub/registrar/*`, `lib/hub/registrarForm.ts`, `lib/hub/registrarAtivos.ts`, `components/hub/diario/linhas.ts`,
`components/hub/personalizar/*`) → `fase3/telas/contrato.md` (3-3, rules C1–C13) and `fase3/mercados34/contrato.md` (3-4) →
the approved boards (`fase3c/quadro/project/RegistrarOperacao.dc.html`, v57, 13 scenarios; `Personalizar.dc.html`).

String markers, as in 3-3/3-4: **B** = exact board copy (`RO l.N` = line of `RegistrarOperacao.dc.html`, `P l.N` = line of
`Personalizar.dc.html`), **A** = ADAPTED from a board or as-built string (source named), **N** = NEW. Every N/A string below is
a proposal for the board revision; the board is drawn and approved before any code (decisoes: «quadro antes do código»).

---

## 0. The design in twelve lines

1. **Exits only** (decisão 1): one entry, then any number of **parciais** (quantity, price, typed hour) and one final
   **Saída** that always closes **everything still open**. No adding to a position, no average entry price.
2. Step 2 («Operação aberta») gains a pill group **«O que registrar agora?»** · «Saída» / «Parcial» / «Mover stop». The
   footer's primary follows it: «Registrar saída» / «Registrar parcial» / «Mover stop». «Saída» is the default, so the 3-3
   flow (open → exit) costs no extra tap.
3. **Mover stop** (decisões 2–3): any new level, with the shortcut pill **«Breakeven · {preço de entrada}»**; the move is
   stamped with the **server's time** (no hour field, like a mark) and the **price at that moment** («Preço agora»), from which
   the app shows and stores the **points in favour** («com +8,00 pts a favor»).
4. After the first partial or move, step 2 shows a block **«Agora»** (em aberto, stop atual, realizado, «Se o stop for
   atingido: … no total») and a **«Linha do tempo»** (entrada, parciais, movimentos, saída) with each time.
5. **«Desfazer»** on the newest partial or move only, within 15 minutes of registering it, while the trade is open; the
   same confirmation pattern as «Desfazer entrada». The final exit is never undone (as today).
6. **Step 3** shows the **sum** (big number), the **average exit** («7.912,50 → 7.924,17 em média»), the **R on the initial
   stop** («+1,17 R com o stop inicial de 10 pts»), the timeline, and a neutral **breakeven line** when the account has the rule.
7. **«Já fechada»** accepts **several exits** («+ Outra saída»: rows with quantity, price, hour; they must add up to the
   entry) and an optional **«Moveu o stop para o breakeven?»** (Sim / Não + «Preço quando moveu»), stored as *registrado
   depois*.
8. **The daily limit counts each partial at its own minute** (decisoes, princípios): the limit banners («atingido», «80%»)
   can now appear **after a partial**, in step 2, with the trade still open; «Mover stop» to a looser level gets the entry's
   «passa do limite» warning.
9. **«Operações do dia»** rows get a second, muted line in «Operação»: «1 parcial, +US$ 40,00 · stop no breakeven» (open) or
   «em 2 saídas» (closed). «Operações abertas» rows say «2 ct em aberto».
10. **New markets** use their own units everywhere (contratos, lotes, ações, BTC, un.; pts, pips, «por ação», «no prêmio»,
    «por BTC», «no preço»); typed-result instruments ask the result **per partial**; Ebinex/binárias get nothing new.
11. **Personalizar › Suas regras** gains the row **«Mover para o breakeven»** (Futuros: «Padrão Futuros» with «só nesta conta»
    overrides, like the window rule): a switch and **one value per asset** («MES +8 pts · MNQ +30 pts · MGC +5 pts»). It never
    changes «Posso operar hoje?» and never blocks; the Registrar shows the breakeven price at entry, suggests the move after a
    partial that reached it, and Análises check later.
12. Three new board scenarios (14–16) plus the step-2 actions inside the existing 6–9; one new row on the Personalizar board.

Open choices that need the owner's word are in §13 (Q1–Q6), each with the recommendation the board draws.

---

## 1. The model as the screens see it

| Term | Meaning on screen | Notes for the domain/DB spec (§11) |
|---|---|---|
| Quantidade da entrada | what «Registrar entrada» sent (`quantity`); never changes | the summary keeps «MES · Compra · 3 ct» |
| Parcial | part of the open quantity leaves at a price and a **typed hour** (prefilled with the server's minute, as the exit); its registration time (server) is kept apart | quantity > 0 and **less than** what is open (equal = use «Saída») |
| Saída | the final fill: the **whole open remainder**, same fields as 3-3/3-4 (price, hour, «Corrigir», typed result, «Custos», «Venceu sem valor») | closes the trade; `exit_time` = the latest fill, `exit_price` = the weighted average, `pnl` = the sum (legacy pages read these) |
| Em aberto | entry quantity − Σ partials | «2 ct de 3» |
| Resultado | Σ of every fill's own result (each computed, estimated or typed by the instrument's rule, rounded to cents per fill) | the limit sees each fill at its minute |
| Média de saída | Σ(qtyᵢ × priceᵢ) / quantity, shown with the instrument's display decimals | only with ≥ 2 fills; «em média» |
| Diferença da operação | média de saída − entrada, by side («+11,67 pts», «+15,5 pips») | = the weighted mean of the fills' differences |
| R | difference of the operation ÷ **the initial stop's distance** (stop moves never change R) | «com o stop inicial de 10 pts» when there were moves |
| Movimento do stop | new stop level + price at that moment, stamped with the **server's time** at the tap | «Já fechada»: only «breakeven, sim/não» + price, no time, flagged *registrado depois* |
| Breakeven | the new stop **equals the entry price** (premium for options) | anything else is «Stop movido» |
| Pontos a favor | (preço agora − entrada) × side, in the instrument's difference unit | stored with the move (the rule check needs it) |
| Regra do breakeven | per asset (root), «+N pts» in force **at the entry** (the trade's rule version) | §8, §11.5 |

Rules the screens follow:
- **Which trading day.** A trade counts on the day it opened (3-3 decision); a partial of yesterday's open trade counts on
  yesterday's day at its own minute, so it never moves today's limit and never shows a banner (as C13).
- **Marks.** Recommended (Q3): the cut between «antes da saída» and «depois do resultado» becomes the **first fill** (the
  first partial's typed hour, or the exit when there is none): after a partial, part of the result is known.
- **Hours.** Partial and exit hours follow the 3-3 exit rule (current minute = now to the second; not before the entry; not
  after now; an open trade from yesterday reads the hour as the exit does). New: the final exit cannot be before the latest
  partial. Stop moves have no hour field.
- **Order.** The timeline sorts by the event's time (typed hour for fills, server time for moves); «Desfazer» follows
  **registration** order (the newest thing the owner did).
- **Limits.** At most 10 fills per trade (partials + exit; «Já fechada» rows) and 20 stop moves (N; the DB names the code).
- **Idempotency.** Each partial, move and undo is a write with its own `client_key` (kept across a retry, new after a
  success), exactly as the entry (C5, C6). A lost answer of a partial comes back `repeated` = success.

---

## 2. Step 1 · Entrada («Aberta»): the rule's line

Only change: under the risk line, when the account's current rule version has a breakeven value for the chosen asset.

| Where | String | Marker |
|---|---|---|
| RO l.384, a new `span.nota` after `#n-risco` (inside the stop `campo`) | «Sua regra: breakeven com +8 pts, em 7.920,50.» (side and entry price known; long = entry + N, short = entry − N, in the instrument's display decimals) | N |
| same | «Sua regra: breakeven com +8 pts.» (side or price not yet typed) | N |

Not shown in «Já fechada» (that mode has its own question, §3.3), never for Ebinex, never for an asset without a value.
Stop and target are not required for the line (a trade without a stop can still move one to the entry).

---

## 3. Step 1 · «Já fechada»: several exits and the breakeven question

### 3.1 Layout (RO l.371–377 today: VSV pill, then `campos2` «Preço de saída» | «Hora da saída»)

```
(«Venceu sem valor», options only: applies to the LAST exit row)
┌ single exit (default, as today) ───────────────────────────────┐
│ Preço de saída          Hora da saída (ET)                     │
└────────────────────────────────────────────────────────────────┘
+ Outra saída                                   ← link button (only when the quantity can be split)

after «+ Outra saída» (each row a dashed `.editor` card):
┌ 1ª saída                                     Remover ┐
│ Contratos [  1 ]                                      │
│ Preço de saída [ 4.409,30 ]   Hora da saída (ET) [10:31]│
│ (Resultado desta saída, US$ — typed instruments only)  │
└───────────────────────────────────────────────────────┘
┌ 2ª saída                                     Remover ┐ …
+ Outra saída
Saídas: 2 de 2 ct.                                      ← role=status, polite
```

- The first «+ Outra saída» turns the single exit into rows 1 and 2; row 1 keeps what was typed (price, hour) and gains an
  empty quantity field; row 2 starts empty (hour prefilled with now, as the exit). «Remover» on the second-to-last row goes
  back to the single exit (the remaining row loses its quantity field).
- «+ Outra saída» is hidden while the entry quantity cannot be split (1 contract, 1 un., 0,01 lote, an empty quantity) and
  `aria-disabled` at 10 rows with its note.
- Quantity field per row: `inputmode=decimal`, 120 px, the unit's label and checks (§7). No chips here (rows are typed after
  the fact).
- Rows are shown in the order they were added; on save they are sorted by hour. Hours: each between the entry's hour and now
  (today), as the single exit.
- Typed-result instruments (ZN, EUR/GBP, XAUUSD, DI1, BGIX26, BTC/BRL): each row gets its own «Resultado desta saída, US$»
  (the limit needs each exit's money at its minute). Estimate instruments (USD/JPY…): each row estimated by its own price.
  «Corrigir» (new markets) applies to the **total**: it opens one «Resultado na sua plataforma, US$» field for the whole
  trade (Q5); the difference to the computed total goes to the **last** exit (earlier exits keep their computed values, so
  the limit sees the correction at the last exit's minute).
- «Custos» (new markets) stays **one** field, for the whole trade.
- Focus order on «Registrar operação» (board order, RO l.1064 extended): `dia, opTipo, strike, venc, lado, q, preco, hora,
  s1q, s1preco, s1hora, s1res, s2q, …, soma, stop, alvo, be, bePreco, res, custos`.

### 3.2 Strings («Já fechada», exits)

| Key (copy section `SAIDAS`) | String | Marker | Board placement |
|---|---|---|---|
| `outra` | «+ Outra saída» (`button.link`) | N | after the exit `campos2` (RO l.376) |
| `rotulo(k)` | «1ª saída», «2ª saída», … «10ª saída» | N | row header |
| `remover` / `removerAria(k)` | «Remover» / «Remover a 2ª saída» | B (`ANEXOS.remover`) / N | row header, right |
| quantity label | «Contratos» · «Lotes» · «Ações» · «Quantidade, em BTC» · «Quantidade» | B (RO l.743–749) | row, first field |
| price / hour | «Preço de saída» (option «Prêmio de saída, US$ por ação»; crypto «Preço de saída, USDT») · «Hora da saída (ET)» | B | row, `campos2` |
| `resultadoSaida(moeda)` | «Resultado desta saída, US$» / «…, R$» | A (B «Resultado, US$», RO l.961) | row, under the prices |
| its note | «Pelos preços não dá para saber o valor em dólar: digite o resultado desta saída na sua plataforma, antes da comissão{, com swap ou funding, se houver}.» | A (RO l.962) | row |
| `soma(n, total)` | «Saídas: 2 de 3 ct.» (units by §7: «0,50 de 1,00 lote», «200 de 300 ações», «0,10 de 0,25 BTC») | N | under the rows, `role=status` |
| `somaErro(soma, total)` | «As saídas somam 2 ct; a entrada tem 3 ct.» | N | same place, `role=alert`, on submit |
| `maximo` | «Até 10 saídas por operação.» | N | note beside the disabled «+ Outra saída» |
| `saidaAntes(hora)` (row) | «A saída não pode ser antes da entrada (10:24).» | B (`ERROS.saidaAntes`) | row error |
| result line, ≥ 2 rows | «Resultado: +6,00 pts em média · +US$ 120,00» | A (RO l.940 «Resultado: {dif} · {valor}») | RO l.410 |
| … typed, ≥ 2 rows | «Resultado: +6,00 pts em média · {soma digitada}» / «Resultado: +6,00 pts em média · digite o resultado de cada saída» | A | RO l.410 |
| … quantities wrong | «Resultado: confira as quantidades das saídas.» | N | RO l.410 |
| «Custos» note with ≥ 2 exits | «{nota do mercado} Da operação toda.» (e.g. «Comissão por lote da sua conta, ida e volta. Da operação toda.») | A (RO l.925) | RO l.413 |
| VSV note with rows | «Vale para a última saída.» (appended to the VSV note when rows exist) | N | RO l.372 |

Row field errors reuse 3-3/3-4 texts verbatim: «Informe a quantidade.» · «Use só números, como 4.» · «Use uma quantidade maior
que zero.» · «Use um número inteiro de contratos.» · «Use um número inteiro de ações.» · «Use um número inteiro.» · «Use até 2
casas decimais.» · «Informe o preço de saída.» · «Use só números, como 7.896,25.» · «O preço precisa ser maior que zero.» · «O
MES anda de 0,25 em 0,25; confira o preço.» · «Informe a hora.» · «A saída não pode ser depois de agora (10:45 ET).» (B,
RO l.1017–1046, 3-4 `ERROS_PRECOS`).

### 3.3 «Moveu o stop para o breakeven?» (optional)

Shown in «Já fechada» for price markets **when a stop was typed** (moving to the entry presupposes a stop). Placed after the
limit-warning region (RO l.386), before the plan line (RO l.408).

```
Moveu o stop para o breakeven? · opcional
[ Sim ] [ Não ]                         ← none pressed by default; tap again clears
  (Sim) Preço quando moveu [ 4.409,30 ]
        com +12,00 pts a favor · Sua regra: com +5 pts.     ← role=status
```

| Key (`BREAKEVEN`) | String | Marker |
|---|---|---|
| `pergunta` | «Moveu o stop para o breakeven?» + «· opcional» | N (the owner's words: «move ou não») |
| `sim` / `nao` | «Sim» / «Não» | N |
| `precoQuando` | «Preço quando moveu» (option «Prêmio quando moveu, US$ por ação»; crypto «Preço quando moveu, USDT») | N |
| `aFavor(dif)` | «com +12,00 pts a favor» | N |
| `regraRef(n)` | «Sua regra: com +5 pts.» | N |
| `erroPreco` | «Informe o preço quando moveu.» | N |
| `erroLado` | «Para o breakeven, o preço precisava estar a favor.» (price at or against the entry: a stop at the entry would already have been hit) | N |
| price format errors | the 3-3 price texts («Use só números, como …», tick, decimals) | B |

«Não» is stored as an explicit *não moveu* (Análises can tell «não moveu» from «não respondeu»). Only breakeven is asked here:
reconstructing a trailing stop after the fact is not worth the fields (decisão 3 is about the live «Mover stop»).

---

## 4. Step 2 · «Operação aberta» (price markets)

### 4.1 Order of the step (RO l.437–482 extended)

1. H3 «Operação aberta» / «Opção vencida» (B), sr status (B).
2. `.resumo-op` (RO l.441): **«MES · Compra · 3 ct»**, «7.912,50 às 10:12 ET», «stop 10 · alvo 20 pts · risco US$ 150,00» (the
   **initial** stop, B) + new last line «Sua regra: breakeven com +8 pts, em 7.920,50.» (N, §2) while the current stop is
   not yet at or beyond breakeven.
3. **«Agora»** block (new `.bloco`, §4.6) — only after a partial or a move.
4. **«Linha do tempo»** (new `.bloco`, §4.7) — only after a partial or a move.
5. Plan pill (RO l.442, B).
6. «Suas marcas», «Como você está?», «Setup e execução» (RO l.444–460, B). With a partial registered, the line at RO l.448
   reads «Marcas feitas a partir da sua primeira parcial (10:18) contam como depois do resultado.» (N, Q3).
7. **«O que registrar agora?»** pills (§4.2) — price markets only.
8. **Action status region** (`p.anx-st role=status tabIndex=-1`, always in the DOM, visually hidden when empty): the last
   action's confirmation (§4.3/§4.4), the breakeven suggestion (§4.5) and the limit banner (`.aviso-lim`, §4.8).
9. The chosen mode's fields: «Saída» (RO l.461–474, as today) / «Parcial» (§4.3) / «Mover stop» (§4.4).
10. «Desfazer entrada» (RO l.475–480, B; confirmation text adapted, §4.7).
11. Footer: «Nova entrada» + primary by mode.

Ebinex (binary) step 2 is unchanged: no pills, no blocks.

### 4.2 «O que registrar agora?»

| Element | String | Marker | Placement |
|---|---|---|---|
| group label (`span.rot-campo`, `role=group aria-labelledby`) | «O que registrar agora?» | N | before RO l.461 |
| pills (`aria-pressed`) | «Saída» · «Parcial» · «Mover stop» | N («Mover stop»: decisão 3) | same |
| footer primary | «Registrar saída» (B, RO l.1644) · «Registrar parcial» (N) · «Mover stop» (N) | | RO l.552 |
| «Saída» note when a partial exists | «Sai com os 2 ct em aberto.» | N | under the pills, before the exit fields |
| exit preview with partials | «Se sair a 7.926,00: +13,50 pts · +US$ 135,00 · no total +US$ 175,00» | A (B «Se sair a …», RO l.943) | RO l.471 |
| exit hour before the last partial | «A saída não pode ser antes da última parcial (10:18).» | N | under «Hora da saída» |

- «Saída» is pressed on every arrival at step 2 and after every successful partial or move.
- «Parcial» is **not rendered** while the open quantity cannot be split (1 ct, 1 un., 0,01 lote; option with 1 contract):
  a pill that is always dead would sit on most 1-contract trades. Q6 offers the alternative.
- Switching mode keeps what was typed in each mode while the step lives; it never sends anything.
- Keyboard: Tab reaches the pills, Space/Enter presses; focus stays on the pill; the mode's first field is next in Tab order.

### 4.3 «Parcial»

```
Contratos  [1] [2]            ← chips 1 … open−1 (≤ 4 chips; more: 1 2 3 + «Outro» → «Quantos contratos?»)
Ficam 2 ct em aberto.          ← nota, live
Preço da parcial [        ]   Hora da parcial (ET) [10:18]
Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00            ← role=status (+ «Corrigir», new markets)
(Resultado desta parcial, US$ — typed instruments)
```

- Contracts: the first chip («1») pressed on opening (the common scale-out); fields (lots, shares, coins, un.) start
  **empty** with a pill **«Metade»** that fills half of what is open, rounded down to the unit's step (lots 2 dp, US shares
  6 dp, B3 shares whole, coins 8 dp); hidden when half is below the step.
- Price starts empty (3-3 rule: «preços começam vazios»); hour prefilled with the server's minute and ticking while untouched.
- No «Custos» on a partial (one «Custos» for the whole trade, on the final exit). No «Venceu sem valor» (final exit only).
- After «Registrar parcial»: the mode returns to «Saída», the action status says what was saved and takes the focus; the
  «Agora» block and the timeline appear/update; the limit banner shows if this partial crossed (§4.8).

| Key (`PARCIAL`) | String | Marker | Placement |
|---|---|---|---|
| quantity label | «Contratos» (chips) · «Quantos contratos?» (Outro) · «Lotes» · «Ações» · «Quantidade, em BTC» · «Quantidade» | B (RO l.743–749) | first field |
| `metade` | «Metade» | N | pill beside a quantity field |
| `ficam(q)` | «Ficam 2 ct em aberto.» (before a quantity: «Em aberto: 3 ct.») | N | `span.nota` under the quantity |
| price labels | «Preço da parcial» · «Prêmio da parcial, US$ por ação» · «Preço da parcial, USDT» (R$, USDC, USD) | A (B «Preço de saída», RO l.1267) | `campos2` left |
| hour label | «Hora da parcial (ET)» / «(Brasília)» | A (B «Hora da saída (ET)») | `campos2` right |
| preview | «Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00» (estimate «≈ +US$ 21,85»; typed «… · digite o valor em dólar») | A (RO l.943) | `div.linha-i` status |
| preview, missing / tick | «Resultado: informe o preço da parcial.» · «Resultado: confira o preço da parcial (o MES anda de 0,25 em 0,25).» / «Resultado: confira o preço da parcial.» (after submit) | A (RO l.935–936) | same |
| typed field | «Resultado desta parcial, US$» / «…, R$» + note «Pelos preços não dá para saber o valor em dólar: digite o resultado desta parcial na sua plataforma, antes da comissão{, com swap ou funding, se houver}.» | A (RO l.961–962) | under the preview |
| correction | «Corrigir» / «Usar o calculado» · «Resultado na sua plataforma, US$» · «Antes da comissão{…}.» | B (RO l.956–962) | same (new markets) |
| estimate note | «Em pares com o dólar na frente, o valor em dólar depende da cotação de fechamento da sua corretora. Confira e corrija se for diferente.» | B (RO l.959) | same |
| `qtdDemais(aberto)` | «Use menos que os 3 ct em aberto; para sair com tudo, use “Saída”.» | N | quantity error |
| quantity errors | «Informe a quantidade.» · «Use só números, como 4.» · «Use uma quantidade maior que zero.» · «Use um número inteiro de contratos.» / «… de ações.» / «Use um número inteiro.» · «Use até 2 casas decimais.» | B (RO l.1040–1046) | |
| price errors | «Informe o preço da parcial.» / «Informe o prêmio da parcial.» (A) · «Use só números, como 7.896,25.» · «O preço precisa ser maior que zero.» · «O MES anda de 0,25 em 0,25; confira o preço.» · «Use até 5 casas decimais.» (B) | | |
| hour errors | «Informe a hora.» (B) · «A parcial não pode ser antes da entrada (10:12).» · «A parcial não pode ser depois de agora (10:20 ET).» | A (`ERROS.saidaAntes/saidaFutura`) | |
| `maximo` | «Até 10 saídas por operação.» | N | sheet alert (server refusal) |
| `registrada(q, preco, hora, ficam)` | «Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.» | N | action status |

Focus order on «Registrar parcial»: `pq, ppreco, phora, pres`.

### 4.4 «Mover stop»

```
Para onde?
[ Breakeven · 7.912,50 ] [ Outro preço ]
  (Outro preço) Novo stop [          ]
Preço agora [ 7.920,50 ]
Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.          ← role=status
Se o novo stop for atingido: +US$ 40,00 no total.                ← nota num (when computable)
(limit warning region, §4.8)
```

- «Breakeven» is pressed on opening while the current stop is not at the entry; otherwise «Outro preço» (with the field
  focused). «Breakeven» fills the new stop with the entry price (premium for options).
- «Preço agora» is **required**: it is what makes «pontos a favor naquele momento» (decisão 2) knowable without market data.
  Prefilled only by the breakeven suggestion (§4.5), with the price of the partial that triggered it; otherwise empty.
- The new stop must be on the safe side of «Preço agora» (long: below; short: above): otherwise it would already have been
  hit, which is an exit. A long's stop **above** the entry is allowed (a trailing stop in profit).
- No hour field: the move is stamped with the server's time at the tap (like a mark); the confirmation names that time.
- A trade registered without a stop: the same form («Novo stop»); R stays not computed (R uses the initial stop only), said
  in the timeline's ⓘ.

| Key (`STOP`) | String | Marker | Placement |
|---|---|---|---|
| `paraOnde` | «Para onde?» | N | group label |
| `breakeven(preco)` | «Breakeven · 7.912,50» | N | pill |
| `outro` | «Outro preço» | N | pill |
| `novo` | «Novo stop» · «Novo stop do prêmio» · «Novo stop, USDT» | N | field (180 px) |
| `agora` | «Preço agora» · «Prêmio agora, US$ por ação» · «Preço agora, USDT» | N | field (180 px) |
| `aFavor(dif)` / `contra(dif)` / `naEntrada` | «Com +8,00 pts a favor.» · «Com 3,00 pts contra.» · «Com o preço na entrada.» | N | status |
| `regra(n)` | «Sua regra: breakeven com +8 pts.» | N | same status, appended |
| `seAtingido(valor)` | «Se o novo stop for atingido: +US$ 40,00 no total.» (≈ for estimates; absent for typed instruments) | N | `span.nota.num` |
| `avisoLimite(falta, risco)` | «Se o novo stop for atingido, o dia passa do limite: faltam US$ 80 e o stop arrisca US$ 120.» | A (B v55 `FUTUROS.avisoLimite`) | `#a-lim`-like region in the form |
| errors | «Escolha para onde vai o stop.» · «Informe o novo stop.» · «Use só números, como 7.912,50.» · «O stop precisa ser maior que zero.» · «O MES anda de 0,25 em 0,25; confira o preço.» (B) · «O stop já está em 7.912,50.» · «Informe o preço de agora.» · «Numa compra, o stop fica abaixo do preço de agora.» / «Numa venda, o stop fica acima do preço de agora.» | N except the tick text (B) | under their fields |
| `movidoBe(preco, hora, dif)` | «Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.» | N | action status |
| `movido(preco, hora, dif)` | «Stop movido para 7.915,00 às 10:30 ET, com +11,00 pts a favor.» | N | action status |

Focus order on «Mover stop»: `g-stop` (pills), `f-novoStop`, `f-precoAgora`.

### 4.5 The breakeven suggestion (never a block)

Shown in the action status region right after a partial when **all** hold: the trade's rule version has a value for the
asset; the partial's points in favour ≥ N; the current stop is below breakeven (long) / above (short) or absent.

| String | Marker |
|---|---|
| «Esta parcial saiu com +8,00 pts. Pela sua regra, com +8 pts o stop vai para o breakeven.» | N |
| button «Mover para o breakeven» (`hub-btn`) | N |

The button switches the mode to «Mover stop» with «Breakeven» pressed and «Preço agora» = the partial's price, and focuses
the footer's «Mover stop» (one more tap saves). Dismissed by any other action; it never comes back for the same partial.
No suggestion from the exit preview or from typing (the app only knows a price when the owner registers one).

### 4.6 «Agora»

| Row (`div.ctx-linha`: `span.rot` + `b.num` + `span`) | String | Marker |
|---|---|---|
| block label | «Agora» (`span.rotulo`) | N |
| open | «Em aberto» **«2 ct»** «de 3» · lots «0,50 lote» «de 1,00» · shares «150 ações» «de 300» · coins «0,15 BTC» «de 0,25» | N |
| stop | «Stop» **«7.912,50»** «· no breakeven, desde 10:19» / «· garante +2,50 pts, desde 10:30» (beyond the entry) / «· arrisca 4,00 pts, desde 10:30» (tightened, still behind the entry) / «· o da entrada»; without stop «sem stop» | N |
| realized | «Realizado» **«+US$ 40,00»** «em 1 parcial» / «em 2 parciais» | N |
| what the stop locks | «Se o stop for atingido: +US$ 40,00 no total.» (≈ on estimates; absent on typed instruments or without a stop) | N |

The money is in the account's currency, signed («−US$ 60,00»), coloured like the step-3 number (mint/red/text).

### 4.7 «Linha do tempo» and «Desfazer»

`ol` `aria-labelledby` the label; each `li` = `time.num` (account clock; another day «ontem, 10:52» / «21 out, 10:52») + text.

| Key (`TEMPO`) | String | Marker |
|---|---|---|
| label + ⓘ | «Linha do tempo» + `aria-label` «Como ler: linha do tempo» | N |
| ⓘ text | «As parciais e a saída ficam na hora que você digitou; o app guarda à parte a hora em que você registrou. Os movimentos do stop ficam na hora do servidor, no toque em “Mover stop”. O R é sempre medido pelo stop da entrada.» | N |
| entry | «Entrada · 3 ct a 7.912,50 · stop 10 pts» (no stop: «Entrada · 3 ct a 7.912,50») | N (pieces B) |
| partial | «Parcial · 1 ct a 7.920,50 · +8,00 pts · +US$ 40,00» (typed «· +US$ 105,00, digitado»; estimate «· ≈ +US$ 21,85») | N |
| registration apart | sub-line «registrada às 10:20» (only when it differs from the typed minute) | N (pattern B «Entrada das … registrada às …», RO l.1254) |
| breakeven | «Stop no breakeven · 7.912,50 · com +8,00 pts a favor» | N |
| other move | «Stop movido · 7.915,00 · com +11,00 pts a favor» | N |
| exit (step 3) | «Saída · 2 ct a 7.926,00 · +13,50 pts · +US$ 135,00» | N |
| «Já fechada» breakeven | «Stop no breakeven · com +12,00 pts a favor · registrado depois» (no time) | N |
| undo link (newest item only) | «Desfazer» (`button.link.perigo`), `aria-label` «Desfazer a parcial das 10:18» / «Desfazer o movimento do stop das 10:19» + `span.nota` «Até 10:34, 15 minutos depois do registro.» | N / B (`ABERTA.desfazerAte`) |
| confirm, partial | «Desfazer a parcial das 10:18 (1 ct a 7.920,50)? Ela sai do resultado e do limite do dia, e os 3 ct voltam a ficar em aberto. O app guarda só que uma parcial foi desfeita, com a data e a hora.» | A (B RO l.1276) |
| confirm, move | «Desfazer o movimento do stop das 10:19 (para 7.912,50)? O stop volta a 7.902,50. O app guarda só que um movimento foi desfeito, com a data e a hora.» | A (B RO l.1276) |
| buttons | «Sim, desfazer» / «Manter» | B |
| after | «Parcial das 10:18 desfeita às 10:22.» / «Movimento do stop das 10:19 desfeito às 10:22.» (action status) | A (B RO l.1279) |
| after, limit back | «Com a parcial desfeita, o limite do dia volta a −US$ 300 de US$ 400.» (only when that partial had reached the limit or 80 %) | N |
| refusals | «Passaram 15 minutos: não dá mais para desfazer.» · «Só o último registro pode ser desfeito.» | A (`undo_too_late`) / N |

- The undo link exists only for the **newest registered** partial or move, while the trade is open and within 15 minutes of
  that registration on the server clock (timer, as «Desfazer entrada»). The confirmation group behaves as RO l.478 (focus on
  «Sim, desfazer»; «Manter» returns focus to the link).
- «Desfazer entrada» with partials or moves (A, RO l.1276): «Desfazer a entrada das 10:12 (MES · Compra · 3 ct)? A operação{,
  as parciais}{, os movimentos do stop} e as marcas dela saem do diário. O app guarda só que uma operação registrada foi
  apagada, com a data e a hora.»

### 4.8 The limit with partials

| Moment | What shows | Copy |
|---|---|---|
| A partial crosses the limit (before not reached → after reached, same trading day as today) | `.aviso-lim.atingido` in the action status region, under the confirmation | «Limite do dia atingido às 10:25: −US$ 400 de US$ 400. Pelas suas regras, o dia está encerrado.» / «… é só um aviso.» (B v57, RO l.1327) |
| A partial crosses 80 % (preference on, limit not reached) | `.aviso-lim` (amber) | «Você chegou a 80% do limite do dia: −US$ 345 de US$ 400.» (B, RO l.1328) |
| The final exit | unchanged (step 3, RO l.494): before/after of **that** write, so a limit already crossed by a partial shows nothing again | B |
| «Mover stop» to a level whose loss on the open quantity is above what is left (limit + realized net of the day now, this trade's partials included) | form warning | §4.4 `avisoLimite` (A) |
| Undoing the partial that crossed | status line | §4.7 «Com a parcial desfeita, …» (N) |
| Partials of yesterday's open trade | nothing (C13) | — |

The gate line of the next «Nova entrada» and the «Limite do dia US$ 400 de US$ 400» line read the server, which counts each
partial at its minute: nothing to draw.

### 4.9 Errors, offline, retries

Partial, move and undo use the 3-3 machinery: `offline` → «Sem conexão. Nada foi registrado: o horário vem do servidor. Tente
de novo quando a conexão voltar.» (B as-built); `network` → its text, the same tap resends the same `client_key`; a
`repeated` answer is success; `not_open` → «Esta operação já foi fechada em outro lugar.» and step 3 (as the exit, C3/C5); a
busy button is `aria-disabled` with a ref guard (C11). The forms of «Parcial» and «Mover stop» are not drafted to
`sessionStorage` (they live seconds); the «Já fechada» rows are (Rascunho v3: `saidas[]`, `be`).

---

## 5. Step 3 · «Operação fechada»

| Element | String | Marker | Placement |
|---|---|---|---|
| big number | the **sum** of the fills: «+US$ 175,00» | B (look) | RO l.488 |
| line, ≥ 2 fills | «MES · Compra · 3 ct · 7.912,50 → 7.924,17 em média · +11,67 pts · 10:12–10:31 ET» | A (B `Z.conta`, RO l.1332) | RO l.489 |
| R, with moves | «**+1,17 R** com o stop inicial de 10 pts» · «… de 12 pips» · «… com o stop inicial em 38,20» · «… do prêmio em 1,10» | A (B RO l.1337) | RO l.492 |
| R, no moves | as today («com stop de 10 pts») | B | |
| costs (new markets) | «Custos US$ 7,00 · líquido +US$ 148,00» (one, for the whole trade; §7's FTMO example) | B | RO l.491 |
| timeline | §4.7 list, all items, no undo | N | new `.bloco` after `.resultado` (RO l.493) |
| breakeven line (only when the trade's rule version has a value for the asset) | «Breakeven às 10:19, com +8,00 pts a favor · sua regra: +8 pts.» / «Breakeven: o stop não foi movido · sua regra: +8 pts.» / «Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.» / «Já fechada» without an answer: none | N | under the timeline, `p` 13 px, neutral colour |
| marks line | «Marcas feitas a partir das 10:18 (sua primeira parcial) contam como depois do resultado.» | A (B RO l.1313) | RO l.506 |
| banner | unchanged (this write only) | B | RO l.494 |

No verdict colour on the breakeven line: decisão 2 leaves the check to Análises; the line states facts and the rule.

---

## 6. «Operações abertas» and «Operações do dia»

| Where | String | Marker |
|---|---|---|
| chooser row (RO l.1600) | «MES · Compra · 3 ct · 2 ct em aberto · desde 10:12 ET» (only after a partial) | A (B `linhaEscolha`) |
| bridge, «Operação» cell, new second line (`span.nota`, 12 px, under the op text; RO l.277) | open: «1 parcial, +US$ 40,00» / «2 parciais, +US$ 65,00» · «stop no breakeven» / «stop movido», joined by « · »; closed: «em 2 saídas» | N |
| bridge, «Resultado» cell | open stays «aberta»; closed = the sum | B |
| bridge, action and its aria | unchanged («Registrar saída: Compra de MES às 10:12») | B |

The second line uses the trade's fills and moves from `fetchDayTrades` (§11.3). On the ≤ 860 px layout it stays inside the
«Operação» cell (row 2, column 1), so the grid does not change. A partial (or move) does not change which rows appear.

---

## 7. New markets: units and words

| Instrument kind (3-4 `TipoAtivo`) | Partial quantity | «Metade» | Price labels (partial / stop / agora) | Difference («a favor», timeline) | Result per partial |
|---|---|---|---|---|---|
| `fut` (MES, MNQ, MGC, ES, NQ, GC, CL, MCL) | «Contratos» chips | no | «Preço da parcial» / «Novo stop» / «Preço agora» | «+8,00 pts» | computed |
| `futx` (ZN, SR3, NG…) | «Contratos» chips | no | same | «+0,50 no preço» | typed («Resultado desta parcial, US$»; no «Corrigir») |
| `fx` catalog pairs | «Lotes» field | yes | same | «+13,0 pips» | computed / estimate (≈) / typed (EUR/GBP, EUR/JPY, EUR/CHF) |
| `fx` price-unit (USD/INR, USD/KRW, XAUUSD…) | «Lotes» field | yes | same | «+5,25 no preço» | typed |
| `acao` (US) | «Ações» field (6 dp) | yes | same | «+0,75 por ação» | computed |
| `opcao` | «Contratos» chips | no | «Prêmio da parcial, US$ por ação» / «Novo stop do prêmio» / «Prêmio agora, US$ por ação» | «+0,55 no prêmio» | computed ×100 |
| `cri` | «Quantidade, em BTC» field (8 dp) | yes | «Preço da parcial, USDT» / «Novo stop, USDT» / «Preço agora, USDT» | «+450 por BTC» | computed; «R$» quote typed |
| `b3f` (WIN, IND, WDO, DOL; series codes as their root) | «Contratos» chips | no | «Preço da parcial» … | «+150 pts» | computed (R$) |
| `di` (DI1) | «Contratos» chips | no | same | «+0,05 no preço» | typed (R$) |
| `b3a` (catalog stocks/ETFs) | «Ações» field (whole) + the lot note «Fora do lote de 100, a B3 negocia no fracionário (código com F).» (B) when the partial or the rest is off-lot | yes | same | «+0,29 por ação» | computed (R$) |
| `b3x` (outside the catalog) | «Quantidade» field (whole, «un.») | yes | same | «+5,00 no preço» | typed (R$) |
| binary (Ebinex) | — | — | — | — | nothing new |

Invented examples for the board (each a partial on the scenario's existing trade, numbers checked):

| Scenario | Trade | Partial | Then |
|---|---|---|---|
| 6 · FTMO | EUR/USD Compra 1,00 lote a 1,08520, stop 12 pips | 0,50 lote a 1,08650: «+13,0 pips · +US$ 65,00»; «Ficam 0,50 lote em aberto.»; «Se o stop for atingido: +US$ 5,00 no total.» | «Saída» 0,50 a 1,08700 (+18,0 pips, +US$ 90,00): total +US$ 155,00, «1,08520 → 1,08675 em média · +15,5 pips», «+1,29 R com stop de 12 pips» |
| 6 · USD/JPY | Venda 0,30 lote a 151,240 | 0,15 a 151,020: «+22,0 pips · ≈ +US$ 21,85» | |
| 6 · EUR/GBP | Venda 0,50 lote a 0,87120 | 0,25 a 0,87070: «+5,0 pips · digite o valor em dólar» + «Resultado desta parcial, US$» | |
| 7 · IBKR | SPY Call 790 Compra 2 ct, prêmio 1,85 | 1 ct a 2,40: «+0,55 no prêmio · +US$ 55,00»; «Breakeven · 1,85» | |
| 7 · AAPL | Compra 100 ações a 231,40 | «Metade» = 50 a 232,15: «+0,75 por ação · +US$ 37,50» | |
| 8 · Binance | BTC/USDT Venda 0,25 a 112.400 | 0,10 BTC a 111.950: «+450 por BTC · +US$ 45,00»; «Ficam 0,15 BTC em aberto.» | |
| 9 · Clear | WIN Venda 3 ct a 131.250 | 2 ct a 131.100: «+150 pts · +R$ 60,00» | |
| 9 · PETR4 | Compra 300 ações a 38,42 | «Metade» = 150 (lot note) / 100 a 38,71: «+0,29 por ação · +R$ 29,00» | |

The breakeven **rule** is Futuros-only in this phase (§8); on the other markets the Registrar still records moves, «Preço
agora» and the points in favour, so Análises can use them once those markets get the rule (Q2).

---

## 8. Personalizar › «Suas regras» · «Mover para o breakeven»

### 8.1 Where and when

- A new `li.regra` **after «Limite do dia» (P l.550–573) and before «Regra por estado» (P l.575)**, rendered when `R.ehFut`
  (on «Padrão Futuros» and on every Futuros account), like «Bloqueio de dados».
- Inheritance as «Só operar dentro da sua janela» / «Bloqueio de dados»: «Padrão Futuros» holds the market's rule; a Futuros
  account shows it with the tag «padrão de Futuros» and, once edited there, «só nesta conta» (the **whole** rule — switch and
  values — is the account's own). «não salvo» while changed. Saved by the page's «Salvar alterações» (no instant save).
- It does not appear in «Como fica hoje» (it never changes «Posso operar hoje?»).

### 8.2 Layout

```
Mover para o breakeven   [padrão de Futuros] [não salvo]
(•—) Ligada                                         ← role=switch, aria-labelledby the name
Com quantos pontos a favor
  MES   [ 8  ] pts   Remover
  MNQ   [ 30 ] pts   Remover
  MGC   [ 5  ] pts   Remover
Adicionar ativo
  [ES] [NQ] [GC] [MCL] [CL]                          ← pills of the futures table not yet listed
O Registrar mostra o preço do breakeven na entrada e sugere mover o stop quando uma parcial chegar lá; nunca bloqueia
nem muda o “Posso operar hoje?”. As Análises conferem depois, operação por operação.
```

- Off → only the switch and «Desligada: o app não sugere o breakeven.»
- First switch-on: one empty line per table root the account (on «Padrão Futuros»: the Futuros accounts) traded most in its
  last 200 trades, up to 3, in that order; with no history, MES. Focus goes to the first value.
- Values: `inputmode=decimal`, 72 px `campo-num`, the asset's tick (MES/MNQ/ES/NQ 0,25; MGC/GC 0,1; CL/MCL 0,01), > 0.
- «Adicionar ativo» pill adds a line at the end and focuses its value; «Remover» focuses the next line's value, else the
  first «Adicionar ativo» pill, else the switch.

### 8.3 Strings

| Key (`REGRAS.be*`) | String | Marker |
|---|---|---|
| `be` | «Mover para o breakeven» | N (decisão 2: «mover para o breakeven com +N pontos») |
| state on / off | «Ligada» / «Desligada: o app não sugere o breakeven.» | B (`REGRAS.ligada`) / N |
| `beQuantos` | «Com quantos pontos a favor» (`span.sub-rot`) | N |
| line | «MES» (bold) + field + «pts» | N |
| `beValorAria(ativo)` | «Pontos a favor no MES» | N |
| `beRemover` / aria | «Remover» / «Tirar o MES desta regra» | N |
| `beAdicionar` | «Adicionar ativo» | N |
| errors (`role=alert`, under the line) | «Digite pontos maiores que zero.» · «Use pontos de 0,25 em 0,25 no MES.» · «Adicione pelo menos um ativo.» (switch on, no line, on save) | A (`REGRAS.limiteErro.empty`) / B (`ERROS.pontosPasso`) / N |
| `beNota` | «O Registrar mostra o preço do breakeven na entrada e sugere mover o stop quando uma parcial chegar lá; nunca bloqueia nem muda o “Posso operar hoje?”. As Análises conferem depois, operação por operação.» | N |
| version text (the «Versões» list, «Ao salvar» diff; board `partesSig`) | «breakeven com +8 pts no MES, +30 no MNQ e +5 no MGC» | N |
| `REGRAS.info`, one sentence appended | «“Mover para o breakeven” (Futuros) não muda o “Posso operar hoje?”: o Registrar sugere, sem bloquear, e as Análises conferem depois.» | A (P l.715 `txt.infoRegras`) |
| tags | «padrão de Futuros» / «só nesta conta» / «não salvo» | B |

### 8.4 Versions (the Resolved trap)

- **Off = absent.** An account whose rule is off (every account today) must resolve to **exactly today's Resolved JSON**, so
  the next save of anything creates no version in accounts that did not touch the rule (`partesSig` adds no `be` part when
  off). Turning it on, changing a value, adding or removing an asset → a new version in that account (or, from «Padrão
  Futuros», in every Futuros account that inherits it: «Ao salvar: versão nova desde 21 out em Top One, Apex A e Apex B.», B).
- A trade is judged by the version in force **at its entry** (Phase 2 rule): step 1's line, step 2's suggestion and step 3's
  line all read the trade's version, never today's.

---

## 9. Board work

### 9.1 `RegistrarOperacao.dc.html` (title → «Registrar operação · aberta ou já fechada, parciais e stop, seis mercados e as
operações do dia · 16 cenários»)

| Change | Where |
|---|---|
| Account data: `D.contas.top.be = { MES: 8, MNQ: 30, MGC: 5 }` | RO l.588 |
| Scenarios (prototype-only labels): «14 · Parciais e breakeven · MES 3 ct, 23 out 10:18 ET» · «15 · Já fechada em duas saídas · MGC, 23 out 10:45 ET» · «16 · Parcial que chega ao limite · MNQ 3 ct, US$ 300 perdidos de US$ 400, 23 out 10:25 ET» | RO l.572–586 |
| `reg` gains `fills[]`, `moves[]`; `sai` becomes the last fill; `resultadoDe`, `limiteEm`/`plDe` iterate fills by their minute; `opTxt` unchanged | RO l.804–815, 821–835, 861–867 |
| Step 1: «Sua regra» line; «Já fechada» rows and «+ Outra saída»; BE question | RO l.371–387 |
| Step 2: summary line, «Agora», «Linha do tempo» with «Desfazer», pills, action status, «Parcial» and «Mover stop» forms, marks line | RO l.437–481 |
| Step 3: average line, R «stop inicial», timeline, breakeven line, marks line | RO l.487–506 |
| Footer primary by mode | RO l.1641–1645 |
| Bridge second line | RO l.277, 1650–1663 |
| Prototype controls only: «Preencher exemplo» fills the open mode's fields (the examples of §7 and §9.2); «Avançar o relógio» as today | RO l.1605–1635 |

### 9.2 The three scenarios (invented data; Top One: limit US$ 400 «encerrar», window 10:00–11:00 ET, rule MES +8, MNQ +30,
MGC +5; Friday 23 Oct 2026)

**14 · Parciais e breakeven** (opens on step 2, clock 10:18)
- Earlier today, closed: MNQ Venda 2 ct a 30.950,00 às 10:01, stop 40, setup A; stop to breakeven at 10:04 with +20,00 pts;
  exits 1 ct a 30.930,00 às 10:04 (+US$ 40,00) and 1 ct a 30.950,00 às 10:07 (US$ 0,00) → +US$ 40,00; bridge «10:01–10:07 ·
  MNQ · Venda · 2 ct / em 2 saídas · +US$ 40,00»; its step 3 shows «Breakeven às 10:04, com +20,00 pts a favor · sua regra:
  +30 pts.».
- Open: MES Compra 3 ct a 7.912,50 às 10:12, stop 10, alvo 20 (risco US$ 150,00), setup A. Summary line «Sua regra: breakeven
  com +8 pts, em 7.920,50.».
- Flow: «Parcial» 1 ct a 7.920,50 às 10:18 → «Parcial de 1 ct a 7.920,50: +8,00 pts · +US$ 40,00» → «Registrar parcial» →
  «Parcial registrada: 1 ct a 7.920,50 às 10:18 ET. Ficam 2 ct em aberto.» + suggestion «Esta parcial saiu com +8,00 pts. Pela
  sua regra, com +8 pts o stop vai para o breakeven.» [Mover para o breakeven]; «Agora»: «Em aberto 2 ct de 3 · Stop 7.902,50 ·
  o da entrada · Realizado +US$ 40,00 em 1 parcial · Se o stop for atingido: −US$ 60,00 no total.» → «Mover stop» (Breakeven ·
  7.912,50, Preço agora 7.920,50, «Com +8,00 pts a favor. Sua regra: breakeven com +8 pts.», «Se o novo stop for atingido:
  +US$ 40,00 no total.») at 10:19 → «Stop no breakeven (7.912,50) às 10:19 ET, com +8,00 pts a favor.»; bridge second line «1
  parcial, +US$ 40,00 · stop no breakeven» → clock to 10:31 → «Saída» 7.926,00 → «Se sair a 7.926,00: +13,50 pts · +US$ 135,00
  · no total +US$ 175,00» → step 3 «+US$ 175,00», «MES · Compra · 3 ct · 7.912,50 → 7.924,17 em média · +11,67 pts ·
  10:12–10:31 ET», «+1,17 R com o stop inicial de 10 pts», timeline of four items, «Breakeven às 10:19, com +8,00 pts a favor ·
  sua regra: +8 pts.».

**15 · Já fechada em duas saídas** (step 1, clock 10:45)
- «Já fechada», «Hoje», MGC Venda 2 ct, entrada 4.421,30 às 10:24, stop 15, alvo 30; «+ Outra saída»: 1ª 1 ct a 4.409,30 às
  10:31, 2ª 1 ct a 4.421,30 às 10:38; «Saídas: 2 de 2 ct.»; «Moveu o stop para o breakeven?» Sim, «Preço quando moveu»
  4.409,30 → «com +12,00 pts a favor · Sua regra: com +5 pts.»; «Resultado: +6,00 pts em média · +US$ 120,00».
- Step 3: «+US$ 120,00», «MGC · Venda · 2 ct · 4.421,30 → 4.415,30 em média · +6,00 pts · 10:24–10:38 ET», «+0,40 R com o stop
  inicial de 15 pts», timeline (entrada, 1ª saída +US$ 120,00, «Stop no breakeven · com +12,00 pts a favor · registrado
  depois», 2ª saída US$ 0,00), «Breakeven com +12,00 pts a favor, registrado depois · sua regra: +5 pts.».
- Also drawn: the error «As saídas somam 1 ct; a entrada tem 2 ct.» when the 2ª row's quantity is empty on submit.

**16 · Parcial que chega ao limite** (step 2, clock 10:25)
- Earlier: ES Compra 1 ct 7.921,50 → 7.915,50, 10:03–10:11, −US$ 300,00. Open: MNQ Compra 3 ct a 30.880,00 às 10:18, stop 40
  (risco US$ 240; its entry showed «faltam US$ 100 e o stop arrisca US$ 240»).
- «Parcial» 2 ct a 30.855,00 às 10:25 → «Parcial de 2 ct a 30.855,00: −25,00 pts · −US$ 100,00» → registered → «Limite do dia
  atingido às 10:25: −US$ 400 de US$ 400. Pelas suas regras, o dia está encerrado.» (red); «Agora»: «Em aberto 1 ct de 3 · Stop
  30.840,00 · o da entrada · Realizado −US$ 100,00 em 1 parcial · Se o stop for atingido: −US$ 180,00 no total.»; no breakeven
  suggestion (the partial is against); «Desfazer» until 10:40; undo → «Parcial das 10:25 desfeita às 10:27.» + «Com a parcial
  desfeita, o limite do dia volta a −US$ 300 de US$ 400.».

Existing scenarios 6–9 need no new scenario: once their entry is registered, step 2 offers «Parcial»/«Mover stop» in their
units, with «Preencher exemplo» filling §7's examples. Scenarios 1–13 otherwise unchanged (their trades have no partials).

### 9.3 `Personalizar.dc.html`

| Change | Where |
|---|---|
| New `li.regra` «Mover para o breakeven» (§8.2) | after P l.573 |
| `cfg0.rg.padraoFut.be = { MES: 8, MNQ: 30, MGC: 5 }`; Top One inherits (tag «padrão de Futuros»); Apex A/B (exemplo) inherit | P l.715 `cfg0` |
| `R.be` model (switch, lines, add pills, errors), `partesSig` adds `o.be` only when on | P l.2089–2098, 2257–2264 |
| `vers0` unchanged: the rule is drawn **not yet saved** («não salvo» on the row; «Ao salvar: versão nova desde 14 out em Top One, Apex A e Apex B.» on «Padrão Futuros»; «Ao salvar: Regras v2 desde 14 out.» on Top One), so the board shows the version effect. The Registrar scenarios (23 Oct) assume it was saved since. | P l.715 `vers0` |
| `txt.infoRegras` sentence (§8.3) | P l.715 |

Visual check before handing the board to the owner (when disk ≥ 1,2 GB): 375, 768, 1280; claro and escuro; keyboard only
through step 2's pills, forms, undo confirmation and the Personalizar row (tools: `scratchpad/lay-render/`,
`scratchpad/refute_lay/`, `scratchpad/mercados/final_tools/`; Chrome profiles deleted after).

---

## 10. Accessibility and layout

- Pill groups `role=group` + `aria-labelledby`; pills `button[aria-pressed]`; disabled = `aria-disabled` (focusable), never
  `disabled`. 44 px targets; 16 px inputs on phones; the undo link and «+ Outra saída» are `.link` buttons (44 px tall).
- One live region per purpose: the action status (`role=status`, focused with `tabIndex=-1` after a write), each form's
  preview (`role=status`), «Saídas: n de m» (`role=status`), errors `role=alert` under their field with `aria-invalid` and
  `aria-describedby`.
- Timeline: `ol` with `<time>`; the newest item's undo button names the event in its `aria-label`.
- ≤ 640 px: whole-screen sheet, sticky footer (3-3); the three mode pills fit one row at 320 px («Saída», «Parcial», «Mover
  stop» ≈ 260 px with gaps). «Agora» rows wrap (`ctx-linha`). «Já fechada» rows: quantity full width, then `campos2`
  price | hour (one column ≤ 420 px).
- Contrast: new text uses `--text`/`--text-2` on `--bg`/`--inset`; the neutral breakeven line never uses amber/red.

---

## 11. What the screens need from the domain and the database (interface only; the banco spec designs it)

1. **Trade state** (`TradeView`/`TradeState`/`RegisteredTrade`): `openQuantity`; `fills[]` (`id`, `kind` partial|exit,
   `quantity`, `price`, `at` = typed instant, `registeredAt` server|null, `pnl`, `pnlBasis`); `moves[]` (`id`, `at` server|null,
   `stopLevel`, `priceThen`, `favor` difference, `reconstructed`); `initialStop` (= today's `stopPrice` at entry) and
   `currentStop`; the «Já fechada» breakeven answer (sim + price / não / none); undo eligibility of the newest event
   (`undoUntil`). Legacy columns keep meaning: `exit_price` = weighted average, `exit_time` = latest fill, `pnl` = sum, set when
   the trade closes (an open trade with partials keeps `pnl` null for the old pages; the screens read realized from `fills`).
2. **Writes** (each with `client_key`, `repeated` on a lost answer, answers with `state` + `serverNow`): register a partial
   (`quantity`, `exit_price`, `exit` hour, `clock`, `pnl`/`correct` as the exit rules) → also `gateNow` + the hooks'
   `limitBefore` for the banners; move the stop (`stop_price`, `price_now`); undo the newest partial/move; «Já fechada» with
   `exits[]` and `breakeven`; the final exit closes `openQuantity`.
3. **Reads**: `fetchDayTrades` and `fetchOpenTrades` carry the fill count, realized sum, current-stop kind (breakeven/moved) for
   the bridge and the chooser; `fetchTradeState` the full lists.
4. **Limit**: every fill counts at its own instant on the **trade's** trading day (net of costs at the final exit);
   `rules_now`/`gate_at`/`limit_room` already follow once fills are the unit.
5. **Rules**: Futuros `breakeven` = `{ root: points }`, per asset, tick multiples, > 0, absent when off (§8.4); market default
   + account override like the window rule; exposed in `rules_config` (Personalizar) and in the trade's version (Registrar).
6. **Marks cut** (Q3): «antes da saída» = before the first fill's instant.
7. **Error codes** the copy needs (names are the banco spec's): partial ≥ open quantity, too many fills/moves, exits not
   adding up, exit before the last partial, stop on the wrong side of `price_now`, stop equal to the current one, undo too late,
   undo of a non-newest event, breakeven price not in favour («Já fechada»), bad breakeven rule value.
8. **Import** (3b and the Top One reader): the Top One file writes **one row per partial exit with the same open time and
   symbol** and never the stop. The screens assume the linking of D29 matches those rows to the fills of one app trade (the
   file wins for money per fill, the app keeps hours, moves and marks) and that imported row groups become one trade with
   fills, so the bridge, step 3 and Análises count one trade, not two.

---

## 12. Out of this cut

Adding to a position / average entry; partial or move on Ebinex/binárias; moving the **target**; trailing stops in «Já
fechada»; undoing a final exit; the breakeven rule outside Futuros (Q2); any market data («Preço agora» stays typed); the
Diário's trade details (Phase 4) and the Análises check itself (Phases 6–7).

---

## 13. Choices for the owner (each drawn as recommended)

- **Q1 · Rule per asset or one N per account.** Recommended **per asset**: 8 points on MES and on MNQ are very different
  moves, and Top One trades both; one N would misjudge every trade of the other asset. Alternative: one N per account.
- **Q2 · Which markets get the rule.** Recommended **Futuros only now** (Padrão Futuros + override, like «Bloqueio de
  dados»); Forex (pips) and B3 futures (pts) later with the same row. Moves and points in favour are recorded on every price
  market anyway.
- **Q3 · Marks after a partial.** Recommended: marks made after the **first partial** count as «depois do resultado» (part of
  the result is known). Alternative: keep the cut at the final exit.
- **Q4 · «Preço agora» required on «Mover stop».** Recommended **required** (it is the only way to know the points in favour
  without market data; the breakeven suggestion prefills it). Alternative: optional, and a move without it is not checked.
- **Q5 · «Corrigir» with several exits** (new markets, «Já fechada»). Recommended: one correction for the **total**, the
  difference booked on the last exit. Alternative: a correction per exit row.
- **Q6 · «Parcial» on a 1-contract trade.** Recommended **hidden**. Alternative: `aria-disabled` with «Com 1 ct em aberto, não
  há como sair em parte.» (N).
