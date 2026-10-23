# Phase 3 spec: Registrar operação (the sheet, its five scenarios, marks with server time, warnings, Ebinex, images and note)

Sources of truth, all read for this spec (read-only; nothing in the repo or the live database was touched):
- Board `market-hub/project/RegistrarOperacao.dc.html` (16 Oct, canvas v44+): markup (l.170–436), CSS (l.12–167) and the
  whole `renderVals` script (l.438–1078): data `D` (l.442: 5 scenarios, `mult`, `tick`, `ativoBase`, `contas`, binary pairs),
  formats (l.459–476), gate (`gateEm`, `limiteEm`, `regraEm`, `tagsEm`, l.489–527), marks (`marcar`, `antesDe`, `tempoDe`,
  l.529–549), fields and errors (l.551–622), the three steps (`F` l.624–689, `A` l.727–764, `Z` l.773–810), images and note
  (`X`, l.812–1023), prototype clock (l.1025–1027), step indicator and footer (l.1029–1046), background Diário (l.1050–1056).
  "RO l.N" below = a line of this file.
- Boards `DiarioHojeEnxuto.dc.html` / `DiarioDezEnxuto.dc.html` (how a registered trade, its marks, images and note show later:
  «Operações do dia» l.543–595 of DiarioDez, data `D.dias[*].trades`, `D.infos.ops`, `D.infos.grava`), `Inicio.dc.html`,
  and the 2b boards `mercados/quadros/project/{ImportarConta,Personalizar,Inicio}.dc.html` (account creation end step
  `fimConta`, «Registrar à mão», the «chega na Fase 3» texts).
- Plan `panel/v31/plano.md` row 3; appendix `panel/v31/apendice.md` §A, §B «Fase 3: M6a» (l.220–297), §D, §E.
- Decisions `fase2/decisoes.md`, `mercados/decisoes.md`; earlier specs `fase2/levantamento/{gate,banco,personalizar,legado}.md`.
- Repo at `4187a8c` (= main): `app/lib/domain/gate/{evaluate,plan,usage,rules}.ts` (`evaluatePlan`, `toEntryContext`,
  `answerOf`, `parseServerGate`), `app/lib/domain/markets.ts` (`MARKET_SPEC`), `app/lib/hub/posso.ts` (`possoLinha`,
  `marcaDoPlano`, `conferidos`), `app/components/hub/importar/*` (the sheet frame to reuse), `app/components/hub/contas/*`
  (`DiarioCabecalho`, `SeletorConta`, `copy.ts`), `app/hooks/{useRegras,useAgora}.ts`, migrations `20261017000002`
  (trades columns `stop_price`, `target_price`, `note`, `note_saved_at`, `commission`, `source`), `20261017000003`
  (import upsert and «completable»), `20261018000003` (`gate_at`, `rules_now`, `limit_usage`), `20261019000001`.
- Project memory `market-hub-initiative.md` (owner decisions of 15–16 Oct on marks, «limpa», images and note).

Owner facts used: accounts «Top One #1» (futures, window 10:00–11:00 ET Mon–Fri, limit US$ 400 net, worst point, «Encerrar o
dia no app») and «Ebinex» (binary, window 20:00–21:00 Brasília Mon–Fri, no limit); 629 imported trades and saved rule
versions that Phase 3 must not change. Board mock values (MES 7.896,25, «14 out», EUR/USD 88 %) appear only in examples.
Nothing here comes from `docs/csv/`.

Markers: **NEW** = not on any board; **ADAPTED** = a board element or string changed for Phase 3 (reason given);
**PROTO** = prototype-only control on the board, never built. «…» = exact pt-BR copy.

---

## 1. What the board decides (summary)

1. **A side sheet over the Diário**, titled «Registrar operação», 480 px on desktop and the whole screen on phones
   (RO l.73, l.158–166). Three steps for a live trade: **Entrada → Operação aberta → Operação fechada** («Passo 1 de 3 ·
   Entrada», «Passo 2 de 3 · Aberta», «Passo 3 de 3 · Fechada»); two for a trade already closed: **Entrada e saída →
   Fechada** («Passo 1 de 2 · Entrada e saída»). Binary options turn «Aberta» into «Vencida» once the option expires.
2. **Registering never refuses a trade.** The gate is shown and recorded, never enforced: «Ele nunca impede o registro: fora
   do plano, a operação só ganha a marca.» (`F.gate.info`); «Fora do plano, conferido pelo hub. Você pode registrar.»;
   footer note on every step: «O Binary Hub não envia ordens: registrar é anotar.»
3. **«Posso operar hoje?» is evaluated at the entry**, by the account's rules: «Calculado pelas regras desta conta, na hora da
   entrada: janela, bloqueio de dados e limite do dia.» When the typed entry time is not "now", the label becomes «Posso
   operar hoje? Na entrada:». The plan marks are «● fora da janela · no bloqueio · depois do limite · contra a regra», in
   that order, or «No plano».
4. **Setup A/B/C is one tap at entry**, big pills (52 px high), with the time it was made: «agora conta como antes da
   saída» → «às 10:07 · antes da saída». Execution (cedo / no ponto / tarde) and emotion (Calmo / Confiante / Ansioso /
   Frustrado / Neutro) are the other two mark groups. Tapping a selected pill again clears it.
5. **Every mark keeps its time; only marks made before the result are «limpas».** «só as feitas antes da saída podem
   chegar a Confirmada nos Padrões de Análises; as de depois param em Pouco fundamentada.» After the exit, a mark can still
   be changed, and the change is kept: «Mudou uma marca depois? Em Análises vale a de antes da saída, e a troca fica
   guardada.» For binaries the result is known at expiry, so marks after the expiry are «depois do resultado» even before
   the result is registered.
6. **Futures variant**: Ativo (MES/MNQ/MGC), Lado (Compra/Venda), Contratos (1/2/3), Preço de entrada (tick-checked,
   never rounded), Hora (ET), «Stop e alvo, em pontos · opcional» with the risk in US$ and R:R; exit by price and time;
   result in points and US$, and R when a stop was set.
7. **Binary (Ebinex) variant**: Par, Direção (Alta/Baixa), Expiração (1/2/5/15 min), Stake US$, Payout %, Hora (Brasília);
   «Se acertar: +US$ 17,60 · se errar: −US$ 20,00»; after expiry «Como terminou?» Ganho / Perda / Devolvida.
8. **Images and note on the last step**: up to 4 PNG/JPG/WebP images of up to 10 MB each (button, drag or paste), a note
   of up to 1.000 characters, «Salvar imagens e nota» records the time; they show in the trade's details in the Diário,
   with a paperclip on its row, and never enter calculations, Padrões or the AI.
9. **After closing**: «Registrar outra» (starts a new entry at the current time; the trade just closed counts in the day's
   limit) and «Ver no Diário».

---

## 2. Phase 3 cut (recommendation)

Plan row 3: «Setup A/B/C, operação aberta, saída, marcas com horário do servidor. Avisos de janela e de limite. Variante
Ebinex. 4 imagens e uma nota.» Owner test: «Registrar pelo celular. Às 11:05 aparece "Fora da sua janela". A 5ª imagem é
recusada.»

| Board element | Phase 3 | Why / instead |
|---|---|---|
| Sheet, 3-step live flow, «Entrada e saída» flow, Registrar outra, footer note | **build** | core of the phase |
| «Posso operar hoje?» line at entry (window + limit), plan marks «fora da janela», «depois do limite» | **build** | Phase 2 gate, recorded in `trade_entry_context` |
| Plan marks «no bloqueio», «contra a regra»; «Aguardar até HH:MM» | not evaluated («ativo na Fase 5») | need the economic calendar and the market state (Phase 5) |
| «O que a tela diz agora:» / «Na tela, na entrada:» + state chip + «sua regra: …» (RO l.259) | **hidden** | market state is Phase 5 (appendix: «"O que a tela dizia" gravado na entrada» is Phase 5) |
| «Sugestão: o último preço na tela. Ajuste ao da sua plataforma.» and the prefilled entry/exit price | **hidden, field empty** (ADAPTED, Q8) | no market data before Phase 5/8 |
| Marks setup / execução / emoção with server time and the before/after split | **build** | plan row 3 |
| Futures variant (MES/MNQ/MGC) | **build** (asset list: Q4, contracts: Q5) | owner's Top One |
| Binary variant | **build** (expiry rule: Q6) | «Variante Ebinex» |
| «Imagens e nota» block, 4 × 10 MB, note 1.000 | **build** | plan row 3 |
| Prototype controls: «Cenário do protótipo:», «Recomeçar», «Simular 2 imagens», «Modo escuro» (demo bar), «fora do produto», «Agora: 10:07 ET» + «Avançar o relógio para 10:21» + «só no protótipo», «exemplo» chips | **never** (PROTO) | the clock is the server's |
| Variants for Forex, Ações, Cripto, B3 accounts | **NEW, needs a board first** (§13, Q14) | owner: «Operações nas contas novas: «Registrar operação» na Fase 3»; and «Telas novas passam ANTES pelo protótipo» |
| The Diário day (table «Operações do dia», drill, calendar) | Phase 4; a minimal bridge on `/diario` in Phase 3 (§17.2, Q10) | the Diário is a placeholder today («O Diário chega na Fase 4.») |

---

## 3. Where it opens, the frame, and which account

### 3.1 Entry points

| Where | Board | Phase 3 |
|---|---|---|
| Diário header, next to «Importar arquivo» | Registrar board background: `<button class="btn pri">Registrar operação</button>` before `<a class="btn">Importar arquivo</a>` (RO l.226). Diário boards: both secondary `class="btn"` (DiarioDez l.223). | **Primary button** «Registrar operação» first, «Importar arquivo» secondary (ADAPTED from the Diário boards: the Registrar board makes it primary; it is the live path). Opens on the current account of the selector (`useContaAtual`). Hidden while the accounts load and in the empty state («Traga o histórico da sua corretora.» + «Importar arquivo» / «+ Adicionar conta»): there is no account to register on. |
| End of account creation (ImportarConta `fimConta`, 2b board) | «Registrar operação» link: secondary before «Importar histórico» when the market has a reader; primary when the platform has no history (IQ Option) or the owner chose «Registrar à mão»; the new markets show «Fechar» and «Nada ainda: as operações desta conta entram pelo “Registrar operação”, que chega na Fase 3.» | **build as drawn** for futures/binary; for new markets ADAPTED: primary «Registrar operação» once their variant exists (§13), text «Nada ainda. Registre a primeira operação.» (board's IQ Option wording). Opening it closes the import sheet and opens Registrar on the new account (one sheet at a time). |
| Diário trade drill «Adicionar imagens ou nota» (DiarioDez l.583) | link to Registrar | Phase 4 (opens Registrar on that trade's «Operação fechada» step). |
| `/diario?registrar=1` | — | **NEW**: same pattern as `?importar=1` in `DiarioCabecalho` (open once, then `router.replace` without it), so the owner can save a phone home-screen shortcut straight to the entry form. |
| Phase 3 bridge list on `/diario` (§17.2) | — | **NEW**: «Registrar saída» on an open trade opens its step 2; a closed trade opens its step 3 (marks, images, note). |
| Início | not on the board | Phase 8 (Início is built there). |

### 3.2 Frame (reuse the import sheet)

- One sheet at a time for the hub: generalise `ImportSheetProvider` into a hub sheet provider with a third mode
  (`'registrar'`), or a sibling provider that shares its logic: page behind made `inert` + `aria-hidden`, page scroll
  locked, focus back to the opener on close (or the page H1 when the opener is gone). (ADAPTED: the board has no
  `aria-modal`; the app's sheet does.)
- `section.hub-folha` `role="dialog"` `aria-modal="true"` `aria-labelledby="t-folha"`; H2 «Registrar operação»; close
  button `aria-label` «Fechar» with «×» (RO l.247). Escape closes; Tab is trapped (as `ImportSheet.onKeyDown`).
- Step indicator `div.ind` (RO l.248): «Passo {k} de {n} · {nome}» and dots (aria-hidden). Names: «Entrada», «Aberta»,
  «Vencida», «Fechada», «Entrada e saída».
- Footer `div.rodape` (RO l.422–428) + note «O Binary Hub não envia ordens: registrar é anotar.» under it (RO l.429).
- Closing (NEW, the board closes at once and keeps the state in memory):
  - Step 1 with anything typed or tapped → the import sheet's question «Fechar sem salvar?» with «Fechar» /
    «Continuar aqui» (`FOLHA.leaveQuestion/leaveYes/leaveNo`, already NEW in Phase 1).
  - Step 2 (open trade): closes at once; the trade stays open on the server (marks are saved on each tap), and comes back
    from «Registrar operação» or the bridge list.
  - Step 3 with unsaved images or note → same question; «Fechar» drops the unsaved draft (ADAPTED: on the board the
    draft survives because the sheet only hides).

### 3.3 Which account

- The sheet registers on **one account**, the current one of the Diário selector. The context block shows it read-only:
  «Conta» + chip with the label + the window line («Janela 10:00–11:00 ET», «Janela 20:00–21:00 · Brasília», from
  `janelaLinha`, already built) (RO l.256).
- **NEW (recommended, no question needed):** when the owner has more than one active account, the chip is a button that
  opens the same list as `SeletorConta` inside the sheet (on phones the page behind is hidden, so closing the sheet to
  switch costs four taps). Switching resets step 1. Not offered on steps 2–3 (the trade belongs to its account).
- Archived accounts never appear. An account with no rule version: Q11 (recommended: the form is replaced by «Esta conta
  ainda não tem regras salvas. Defina a janela antes de registrar.» + link «Definir em Personalizar» → `/personalizar#janelas`;
  NEW copy). The owner's two accounts and every account created by the sheet already have version 1.
- The variant follows `account.market`: `futures` → §5–7; `binary` → §8; `forex`, `stocks`, `crypto`, `b3`, `options` → §13.

---

## 4. Step model

### 4.1 Modes and steps

| Mode | Steps | `trades.source` | `trade_entry_context.origin` | Board |
|---|---|---|---|---|
| **Ao vivo** (default) | Entrada → Operação aberta (binary: → Opção vencida) → Operação fechada | `live` | `live` | scenarios 1, 3, 4, 5 |
| **Já fechada** | Entrada e saída → Operação fechada | `after` | `reconstructed` | scenario 2 |

- The board has **no product control to choose the mode**: scenario 2 is picked in the prototype bar. NEW control needed
  (Q2). Recommended: a pill pair at the top of step 1, «Como está a operação?» «Aberta» / «Já fechada» (NEW), default
  «Aberta»; switching keeps the common fields.
- Step 1 → 2 by «Registrar entrada» (`register_entry`); 2 → 3 by «Registrar saída» (futures) / «Registrar resultado»
  (binary) (`register_exit`); «Já fechada» step 1 → 3 by «Registrar operação» (`register_after`).
- Focus moves to the step's H3 (`#t-passo`, `tabindex="-1"`) on every step change (RO l.252, `this._foco = 'passo'`).

### 4.2 Resuming an open trade (NEW; the board keeps one trade in memory)

- On open, the sheet reads the current account's open trades (`status = 'open'`, live).
  - None → step 1.
  - One → its «Operação aberta» step directly, with a secondary footer button «Nova entrada» (NEW) that goes to step 1.
  - Several (Q15, recommended allowed) → a short chooser before step 1, H3 «Operações abertas» (NEW), one row per trade
    «MES · Compra · 2 ct · desde 10:07 ET» (board `opTxt` + NEW «desde …») with «Registrar saída», and «Nova entrada».
- A trade opened on a previous trading day shows «desde ontem, 10:07 ET» / «desde 14 out, 10:07 ET» (NEW).
- The open step re-reads the trade on focus/visibility (another device may have closed it); if it is closed, the sheet moves
  to step 3 with the stored result and the status «Esta operação já foi fechada em outro lugar.» (NEW).

### 4.3 «Registrar outra» (RO l.1040–1044)

- Starts a new step 1 on the same account at the current time; everything typed is cleared; the trade just closed now
  counts in the day's limit (the server's sum includes it, so the next gate line can read «Encerrado por hoje»).
- Images or note chosen but not saved go with the trade that closed, and step 1 says so:
  «Operação anterior: 2 imagens e nota salvas às 10:21.» (`msgAnterior`, RO l.913; `role="status"`, RO l.253). ADAPTED: in the
  app this means uploading them first; the button shows «Um momento…» (`BUSY`) and, if an upload fails, stays on step 3
  with the error (§12.6).
- «Ver no Diário» does the same pending save, then goes to `/diario` (Phase 3: the bridge list; Phase 4: the day).

---

## 5. Step 1 · Entrada (futures)

Board: scenario 1 (14 out 10:07 ET, MES), 3 (14 out 11:12 ET, MGC, outside the window), 4 (19 nov 10:52 ET, after the
limit). H3 «Entrada» (RO l.646).

### 5.1 Context block (`div.contexto`, RO l.255–260)

1. «Conta» + chip «Top One» + «Janela 10:00–11:00 ET» (§3.3).
2. Gate line: coloured dot + label + **state** (bold) + sub + info button.
   - Label «Posso operar hoje?» when the typed time is the current minute, else «Posso operar hoje? Na entrada:».
   - State and sub (board `gateEm`, RO l.500–507):

     | Status | State | Sub (board) | Dot |
     |---|---|---|---|
     | `liberado`, now | «Liberado» | «até 11:00 ET» (present only) | `--mint` |
     | `liberado`, typed time | «Liberado» | (none) | `--mint` |
     | `fora_janela` | «Fora da sua janela» | «· 10:00–11:00 ET» | `--amber` |
     | `aguardar` (Phase 5) | «Aguardar até 10:10» | «· bloqueio: ISM industrial» | `--amber` |
     | `encerrado` | «Encerrado por hoje» | «· limite de US$ 400 atingido às 10:38 (pior momento −US$ 415,50)» | `--red-fill` (board); text `--red` per gate.md GG8 |
     | `liberado` + warning (Phase 2 «“Liberado”, com aviso» / «Só avisar») | «Liberado» | ADAPTED from `possoLinha`: «com aviso: fora da janela», «com aviso: hoje não é dia da janela», «com aviso do limite» | `--text` |
     | `fora_janela`, not a window day | «Fora da sua janela» | ADAPTED from `possoLinha`: «· hoje não é dia da janela» | `--amber` |
     | nothing evaluated (window rule off, no limit) | «Sem regra ativa» + «Ajustar» (from `possoLinha`) | — | `--text-2` |

     The Phase 2 Diário card uses «abre às 10:00 ET» after the window; Registrar keeps its board sub, the window range,
     because the question here is "was this entry inside?" (board, kept).
   - Info button `aria-label` «Como ler: Posso operar hoje?» → panel `#info-gate`: «Calculado pelas regras desta conta, na
     hora da entrada: janela, bloqueio de dados e limite do dia. Ele nunca impede o registro: fora do plano, a operação só
     ganha a marca.» ADAPTED for Phase 3 (the block is not checked): «Calculado pelas regras desta conta, na hora da entrada:
     janela e limite do dia (o bloqueio de dados fica ativo na Fase 5). Ele nunca impede o registro: fora do plano, a
     operação só ganha a marca.»
3. **NEW (recommended, Q13):** when the account has a daily limit, a third line with the day's use, from `possoLinha().limite`
   (already built for the Diário card): «Limite do dia US$ 320 de US$ 400», `aria-label` «Top One, limite do dia: US$ 320 de
   US$ 400.»; «—» + «Limite do dia indisponível» when it was not evaluated (never «US$ 0»).
4. «O que a tela diz agora:» line: hidden until Phase 5 (§2).

Source of the line (NEW, the board computes it in the browser): while the time field holds the current minute, the
`rules_now()` answer for this account (already cached by the Diário card); when the owner types another time, `gate_at(account,
typed instant)` (exists, `invoker`, granted to `authenticated`; debounced 300 ms). Both are the server's truth, the same
SQL `register_entry` will run (`gate_eval` + `limit_usage`), so the preview and the recorded mark agree except when
something changes in between (a trade closes on another device, the minute turns 11:00). `evaluatePlan` in the browser
is not needed for the preview; it stays the TS mirror for tests and the Phase 4 Diário.

### 5.2 Fields (board order) and validation

| Field | Control (board) | Default | Validation (exact board errors, shown after the first «Registrar entrada» unless noted) |
|---|---|---|---|
| «Ativo» | pills `role="group"` `aria-labelledby="l-ativo"`: «MES», «MNQ», «MGC» (RO l.263) | board: the scenario's asset. App: the asset of this account's last live trade, else the first (NEW) | always one selected. Changing it clears price, stop and target (RO l.654). List: Q4. |
| «Lado» | pills «Compra» / «Venda» (RO l.264) | none | «Escolha Compra ou Venda.» |
| «Contratos» | pills «1», «2», «3», min-width 52 (RO l.265) | board: scenario value; app: last used in this account, else 1 (NEW) | Q5 for more than 3. |
| «Preço de entrada» | text, `inputmode="decimal"`, mono (RO l.267) | board: last price on screen; Phase 3: empty (Q8) | «Informe o preço de entrada.» · «Use só números, como 7.896,25.» · «O preço precisa ser maior que zero.» · «O MES anda de 0,25 em 0,25; confira o preço.» (never rounded silently, RO l.564) |
| «Hora (ET)» | `type="time"` `step="60"`, mono (RO l.268) | current minute on the account's window clock, from the **server** clock (`rules_now.server_now` + elapsed; NEW, gate.md §9 skew note) | «Informe a hora.» · «A entrada não pode ser depois de agora (10:07 ET).» · NEW lower bound (Q1): «A entrada precisa ser de hoje. Para uma operação antiga, use “Já fechada”.» |
| «Stop e alvo, em pontos · opcional» → «Stop», «Alvo» | two text fields, `inputmode="decimal"`, always two columns (`campos2 sempre`, RO l.277–284) | board: the scenario's; app: empty | «Use pontos maiores que zero.» shown **as you type** (board passes `mostrar = true`). |

Parsing (board `num`, RO l.468–474): accepts «7.896,25», «7896,25», «7896.25»; spaces ignored; anything else is `NaN` →
the "only numbers" error. Same parser for every numeric field; keep it in `lib/hub` with tests (thousands dot vs decimal dot
rule: a dot followed by exactly three digits groups thousands).

Under the stop/target fields, the risk line (`n-risco`, bold mono, RO l.283, l.629–632):
«risco US$ 110,00 · alvo US$ 220,00 · 1 : 2» (stop 11, target 22, MES, 2 contracts); partial forms «risco US$ 110,00» or
«alvo US$ 220,00»; empty: «Sem stop e alvo, o R não é calculado.» Points × point value × contracts; point values from the
instrument table (MES US$ 5, MNQ US$ 2, MGC US$ 10; ticks 0,25 / 0,25 / 0,10, RO l.442).

Storage (ADAPTED): the board asks stop and target **in points**; `trades.stop_price` / `target_price` (Phase 1, filled by the
Top One import) are **prices**. Store `stop_price = entry − side × stop_pts`, `target_price = entry + side × target_pts`;
show points everywhere (the Diário drill writes «stop 12 · alvo 24 pts · às 10:30»). A stop or target off the tick grid
after conversion cannot happen when the entry price is on the grid and the points are multiples of the tick; points that
are not (e.g. «7,3» on MES) → NEW error «Use pontos de 0,25 em 0,25 no MES.»

### 5.3 Plan line (RO l.299)

Only when at least one break applies: amber pill «● fora da janela» (or «● depois do limite», «● fora da janela · depois do
limite») + «Fora do plano, conferido pelo hub. Você pode registrar.» Computed from the same server answer as the gate line
(window `fora` → «fora da janela»; limit `atingido` → «depois do limite»; block/state not in Phase 3). Uses
`marcaDoPlano`/`PlanBreak` words (`lib/hub/posso.ts`). Nothing is shown when no break applies (the board shows «No plano»
only after registering).

### 5.4 Setup block (`div.toque`, RO l.302–308)

- Title «Como está o setup?» (live, before the result) / «Como estava o setup?» (result already known: «Já fechada», or a
  binary whose expiry already passed). Mint-tinted card; neutral card when the result is known (`toqueCls 'depois'`).
- Info `aria-label` «Como ler: por que marcar agora» → «Marcar depois de ver o resultado puxa a nota para o resultado: a
  perda vira “Setup C”, e “Setup A rende mais” passa a se provar sozinho. Por isso o app grava a hora de cada marca: só as
  feitas antes da saída podem chegar a Confirmada nos Padrões de Análises; as de depois param em Pouco fundamentada.»
- Pills «A», «B», «C» (`aria-label` «Setup A» …), 60 × 52 px, font 18 (RO l.114–115). Tap again clears.
- Time chip under the pills (`#c-setup`, `aria-describedby` of the group): before any tap «agora conta como antes da saída»
  (dashed, «fraco») or «depois do resultado» when the result is known; after a tap «às 10:07 · antes da saída» /
  «às 11:01 · depois do resultado».
- When the result is known, a paragraph: «Marcas feitas agora contam como depois do resultado; para passar de Pouco
  fundamentada em Análises, marque o setup na entrada.»
- **What a setup is** (from the boards, for the code and the help text): the trader's own grade of the setup he is taking,
  A best, C worst («Setup · sua nota, de A a C», Diário drill; «Nota que você deu ao setup no Diário.», Análises). It is a
  mark (`trade_marks.kind = 'setup'`), not a strategy name: the old `trades.setup_type` / `strategy` columns are not used.
- App timing (ADAPTED): before «Registrar entrada» the trade does not exist, so taps on step 1 are held in the form and
  sent with `register_entry`; the server stamps them with the same `now()` as `registered_at`, and the chip then shows that
  time. Before registering, the chip keeps «agora conta como antes da saída».

### 5.5 More marks (RO l.310–319)

Collapsible button (`aria-expanded`, chevron ▸ rotating) «Execução da entrada» (live) / «Execução e emoção» (Já fechada),
opening `#mais-marcas` with «Execução» «cedo» / «no ponto» / «tarde» (and «Emoção» «Calmo» / «Confiante» / «Ansioso» /
«Frustrado» / «Neutro» in Já fechada), each with its time chip. Sent with the entry like the setup.

### 5.6 Footer

Primary «Registrar entrada» (RO l.1034). On click with errors: the first invalid field in board order (lado, preço, hora,
saída, stop, alvo; RO l.614) gets focus and all errors show (`tentou.form`). Busy: «Um momento…» in the button's place
status region; the button `aria-disabled` while the request runs (double tap protected, §16.3).

---

## 6. Step 1 · Entrada e saída (futures, «Já fechada»)

Board scenario 2 (1º dez, registered 11:01 ET for a 10:33–10:49 trade). H3 «Entrada e saída». Same context block with the
label «Posso operar hoje? Na entrada:» and no sub for «Liberado».

- Fields as §5.2, with «Hora da entrada (ET)» and two more after the entry price (RO l.271–276): «Preço de saída»
  (same price errors with «saída»: «Informe o preço de saída.») and «Hora da saída (ET)» (errors «Informe a hora.» · «A
  saída não pode ser antes da entrada (10:33).» · «A saída não pode ser depois de agora (11:01 ET).»).
  ADAPTED: the clock suffix follows the account (the board hard-codes «(ET)» on exit hours, RO l.662/757).
- No price hint. Result preview (`role="status"`, RO l.300): «Resultado: +9,50 pts · +US$ 95,00»; incomplete:
  «Resultado: escolha o lado.» · «Resultado: preencha os dois preços.» · «Resultado: confira os preços (o MES anda de 0,25
  em 0,25).» (before submit) / «Resultado: confira os preços.» (after).
- Setup block with «Como estava o setup?», chip «depois do resultado», the paragraph of §5.4, and «Execução e emoção».
- Footer «Registrar operação» → step «Fechada» (2 of 2). Every mark made here is «depois do resultado».
- Exit hour after midnight / next trading day: an «Entrada e saída» spanning two days is NEW (the board has one day); the
  exit time is resolved to the first instant after the entry with that wall-clock time (≤ now).

---

## 7. Step 2 · Operação aberta and the exit (futures)

Board scenario 1 after «Registrar entrada». H3 «Operação aberta» (RO l.741).

1. Screen-reader status (`.so-leitor` `role="status"`): «Entrada registrada às 10:07 ET.»
2. Summary (`div.resumo-op`): «MES · Compra · 2 ct» (bold) / «7.896,25 às 10:07 ET» / «stop 11 · alvo 22 pts · risco US$
   110,00» (only with stop or target).
3. Plan pill: «No plano» (mint outline) or «● fora da janela» (amber). In the app it comes from the stored
   `trade_entry_context` (server), not from the step-1 preview. «—» when nothing was evaluated (never «No plano», §11.3).
4. PROTO: «Agora: 10:07 ET» + «Avançar o relógio para 10:21» + «só no protótipo» (RO l.329). Not built.
5. «Suas marcas» block: list of current setup/execution marks, each «Setup A» + chip «às 10:07 · antes da saída»; empty
   «Nenhuma ainda.»
6. «Como você está?» (title style) + emotion pills with their time chip.
7. Collapsible «Setup e execução» → groups «Setup» A/B/C and «Execução» cedo/no ponto/tarde (change or clear).
8. Exit fields (two columns): «Preço de saída» (board: prefilled with the moving screen price; Phase 3: empty, Q8) and
   «Hora da saída (ET)» prefilled with the current minute (server clock). Errors as §6.
9. Preview (`role="status"`): «Se sair a 7.903,75: +7,50 pts · +US$ 75,00»; incomplete «Resultado: informe o preço de
   saída.» / «Resultado: confira o preço de saída (o MES anda de 0,25 em 0,25).» / «… saída.»
10. Footer primary «Registrar saída» → `register_exit`. Secondary «Nova entrada» (NEW, §4.2). NEW (Q9): «Desfazer entrada»
    link while open and within 15 min of `registered_at`.

Marks in this step are written **one tap = one row** (`add_mark`), stamped by the server. The pill turns pressed at once and
its chip reads «salvando…» (NEW) until the answer brings the time; on failure the pill reverts and the group shows
«A marca não foi salva. Tente de novo.» (NEW, `role="alert"`).

---

## 8. Binary variant (Ebinex)

Board scenario 5 (Ebinex, 15 out 20:10 de Brasília). Every clock is Brasília: hour labels «Hora (Brasília)», times
«20:10 de Brasília» (board `relH`).

### 8.1 Step 1 · Entrada (RO l.287–297)

| Field | Control | Default | Errors |
|---|---|---|---|
| «Par» | pills «EUR/USD», «BTC/USD», «GBP/USD», «ETH/USD», «USD/JPY» | first | — |
| «Direção» | pills «Alta» / «Baixa» | none | «Escolha Alta ou Baixa.» |
| «Expiração» | pills «1 min», «2 min», «5 min», «15 min» | none | «Escolha a expiração.» (Q6: ADAPTED to candles) |
| «Stake, US$» | text decimal (two columns with payout, always) | board 20; app: last stake in this account (NEW) | «Informe o stake.» · «Use um valor maior que zero.» |
| «Payout, %» | text decimal | board: per pair (88/85/87/85/86); app: Q7 | «Informe o payout.» · «O payout vai de 1 a 100%.» |
| «Hora (Brasília)» | `type="time"`, max-width 200 | current minute (server clock) | as §5.2 |

- Line under it (`n-payout`): «Se acertar: +US$ 17,60 · se errar: −US$ 20,00» (stake × payout / 100; −stake); incomplete
  «Preencha stake e payout.»
- Gate line as §5.1 («Liberado até 21:00 de Brasília»). No limit line for Ebinex (no limit saved), plan breaks: window only.
- Setup block as §5.4; «Execução da entrada» as §5.5. If the expiry has already passed for the typed time, the result is
  known: title «Como estava o setup?» and the «depois do resultado» texts (RO l.644 `jaFoi`).
- Pairs (NEW for the app): the board's five are mock; recommended list = pairs this account already traded (from its
  trades, most frequent first) + a text field «Outro par» (NEW). No catalog exists for binaries.
- Footer «Registrar entrada».

### 8.2 Step 2 · Operação aberta → Opção vencida (RO l.727–764)

- H3 «Operação aberta» until the expiry, «Opção vencida» after (indicator «Passo 2 de 3 · Vencida»).
- Summary: «EUR/USD · Baixa · 2 min» / «US$ 20 · payout 88% · 20:10–20:12 de Brasília».
- «Suas marcas», «Como você está?», «Setup e execução» as §7. After the expiry, under the marks: «Marcas feitas agora contam
  como depois do resultado.»
- «Como terminou?» pills «Ganho» / «Perda» / «Devolvida», `aria-disabled="true"` until the expiry (pressing does nothing),
  with the note «Vence às 20:12 de Brasília.» → «Venceu às 20:12 de Brasília.» Errors on «Registrar resultado»: «Ainda não
  venceu.» · «Escolha como terminou.»
- Preview: «Se acertar: +US$ 17,60 · se errar: −US$ 20,00» → after choosing: «Resultado: −US$ 20,00».
- The switch to «Opção vencida» happens on a timer at the expiry instant measured on the server clock (NEW: the board moves
  its fake clock), and on focus/visibility.
- Footer «Registrar resultado».

### 8.3 Data (ADAPTED from the board, consistent with the Phase 1 Ebinex reader)

- `direction` `call` (Alta) / `put` (Baixa); `asset_type 'binary_option'`; `quantity 1`; `stake_amount`; `payout_percent`
  stored even on a loss (the import stores it only on wins, because the file shows it only there); `duration_seconds`;
  `timeframe` (e.g. «M1») when the candle form is used (Q6).
- Expiry: board = entry minute + minutes. The Ebinex reader (`ebinexExit`) and the owner's confirmation say an Ebinex option
  runs on **the candle after the order**: exit = that candle's opening («Vela») + its length («Tempo»). Recommended (Q6):
  for `platform = 'ebinex'` the expiry follows that rule, computed by the server at entry and stored as `exit_time`
  (known at entry, as in the import); other binary platforms (Pocket Option, IQ Option, Outra) use entry + duration.
- Result: «Ganho» → `win`, `pnl = stake × payout / 100`; «Perda» → `loss`, `pnl = −stake`; «Devolvida» → `breakeven`,
  `pnl = 0`. `commission = 0.00` (as the import: the broker's cut is inside the payout). Exact decimal arithmetic in cents.
- No entry or exit price (the board asks none; the import has the candle's open and close).

---

## 9. Step 3 · Operação fechada

Board RO l.360–420 (`Z`). H3 «Operação fechada». Indicator «Passo 3 de 3 · Fechada» / «Passo 2 de 2 · Fechada».

1. Result card (`div.resultado`): big mono «+US$ 75,00» (mint > 0, red < 0, text = 0); line «MES · Compra · 2 ct · 7.896,25 →
   7.903,75 · +7,50 pts · 10:07–10:21 ET»; binary «EUR/USD · Baixa · 2 min · perda · 20:10–20:12 de Brasília»; with a stop:
   «+0,68 R» (bold mono) «com stop de 11 pts». B3 and other currencies: the account's (§13).
2. Plan: «No plano» / «● fora da janela» + «conferido pelo hub» (only when outside the plan).
3. «Suas marcas» block (info `aria-label` «Como ler: suas marcas» → «Nos Padrões de Análises, só as marcas feitas antes da
   saída podem chegar a Confirmada; as feitas depois do resultado aparecem, mas param em Pouco fundamentada. Mudou uma
   marca depois? Em Análises vale a de antes da saída, e a troca fica guardada.»):
   - sub-label chip «antes da saída» → list «Setup A às 10:07», «Emoção: Calmo às 10:07»; a mark changed later stays here as
     «Setup A às 10:07 (trocada às 10:31)» / «(desmarcada às 10:31)»; empty «Nenhuma.»
   - sub-label chip «depois do resultado» → «Setup B às 10:31» + history «antes: A às 10:07 · agora: B às 10:31»; cleared:
     «Setup: sem marca às 10:31» + «antes: A às 10:07 · agora: sem marca às 10:31»; empty «Nenhuma.»
   - Labels: setup «Setup A»; others «Execução: cedo», «Emoção: Calmo» (`rotMarca`).
4. Line under the block: «Marcas feitas a partir de agora contam como depois do resultado.» — or, when some marks made with
   the trade open fall at or after the exit time: «Marcas feitas a partir das 10:21 (sua saída) contam como depois do
   resultado.» / «… (o vencimento) …» (binary).
5. Collapsible «Marcar ou mudar» → «Setup», «Execução», «Emoção» pills (each tap = a new mark, «depois do resultado»).
6. «Imagens e nota» block (§12).
7. PROTO clock (RO l.418): not built.
8. Footer: left «Registrar outra»; right primary link «Ver no Diário» (§4.3).
9. NEW (§11.4): the limit warning after an exit that reached 80 % or the limit.

---

## 10. Marks with server time («limpa»)

### 10.1 What a mark is

A row per tap: (`trade_id`, `kind`, `value`, `marked_at`), append-only, `marked_at` forced to the server's `now()` by a
trigger (appendix §B). Kinds and values (store ASCII codes, show the board words):

| kind | values (stored → shown) | Board group | Where it can be made in Phase 3 |
|---|---|---|---|
| `setup` | `A`, `B`, `C` → «A», «B», «C» («Setup A») | «Setup» | step 1, step 2 («Setup e execução»), step 3 («Marcar ou mudar») |
| `execucao` | `cedo`, `no_ponto`, `tarde` → «cedo», «no ponto», «tarde» | «Execução» | step 1 («Execução da entrada» / «Execução e emoção»), 2, 3 |
| `emocao` | `calmo`, `confiante`, `ansioso`, `frustrado`, `neutro` → «Calmo» … «Neutro» | «Emoção» | step 1 in «Já fechada», 2 («Como você está?»), 3 |
| `seguiu_texto` | (Phase 5, «Você seguiu o seu texto?» in the Diário) | — | not in Phase 3 |

- Clearing (tap the selected pill again) writes a row with **no value** (ADAPTED: the appendix has `value text not null`;
  allow null = «sem marca»). The current mark of a kind is the latest row.
- Several marks of a kind are normal (the history is the point); nothing is ever updated or deleted except by «Desfazer
  entrada» (Q9) and by undoing an import (Phase 1 decision: undo also deletes that batch's marks).

### 10.2 When a mark is «limpa» (antes da saída)

Board rule (`antesDe`, `fimSabido`, RO l.541–544), which is stricter than the appendix view:

- the trade is `source = 'live'`, **and**
- the mark was made with the trade open (not in «Já fechada», not after `register_exit`), **and**
- `marked_at` is strictly before the moment the result is known:
  - futures: the earlier of `exit_registered_at` and the exit time the owner typed (`exit_time`): a mark tapped at 10:40
    for an exit registered with «10:21» is «depois» («Marcas feitas a partir das 10:21 (sua saída) …»);
  - binary: the expiry (known at entry) — a mark after it is «depois» even before «Registrar resultado».
  - A mark at or after the exit instant counts as «depois» (strict `<`; the board compares minutes, and its script comment
    at RO l.542 says a mark in the exit's own minute is already «depois» because the result is on the screen).

So `trade_marks_v.limpa` should be (ADAPTED from appendix l.241):
`t.source = 'live' and m.marked_at < least(coalesce(t.exit_registered_at, 'infinity'), coalesce(t.exit_time, 'infinity'))`
— with the binary expiry stored in `exit_time` at entry (§8.3), the same expression covers both. An import that later fills
an exact exit time (§21 G11) can only make marks stricter, never cleaner.

### 10.3 What «vale em Análises»

- Unfiltered views use the latest mark of each kind.
- «Só marcadas antes da saída» uses the latest **limpa** mark of each kind (board: «Em Análises vale a de antes da saída, e a
  troca fica guardada»).
- Marks on imported trades (Phase 4 Diário) are never limpas.

---

## 11. Window and limit warnings, at entry and at exit (Phase 2 gate)

### 11.1 At entry (recorded)

- `register_entry` evaluates, in the same transaction, `gate_at(account, entry instant)` (window + limit, Phase 2 SQL), and
  writes `trade_entry_context` with `toEntryContext` semantics (`lib/domain/gate/plan.ts`):
  `gate` = status or **null when nothing was evaluated**; `in_window`, `after_limit` = booleans **only when evaluated**, else
  null; `in_block`, `rule_ok`, `state_choice` = null in Phase 3 (reason `fase5`); `day_pnl_at_entry` and (NEW column,
  gate.md GG4) `day_worst_at_entry` = the scope's net and worst point realized at or before the entry, the trade itself left
  out; `checks_evaluated` ⊆ {`janela`, `limite`} in CHECK_ORDER.
- The trade's `rule_version_id` = version in force at the entry instant (decision: «Operações depois do "desde" são julgadas
  pela versão em vigor na entrada»); `trading_day` by `compute_trading_day` (existing trigger).
- Limit scope: the account, or with «somando as contas de Futuros» every active non-example futures account (Phase 2).
  Open trades (pnl null) never count; a trade counts at its exit (`limit_usage`).
- «Só avisar» / «“Liberado”, com aviso» change only what the screen says; the break is still recorded (decision 2/3).

### 11.2 The owner test «Às 11:05 aparece "Fora da sua janela"»

Top One, any weekday, opening the sheet at 11:05 ET with «Hora (ET)» = 11:05: gate line «Posso operar hoje? Fora da sua
janela · 10:00–11:00 ET» (amber), plan line «● fora da janela» + «Fora do plano, conferido pelo hub. Você pode registrar.»;
after «Registrar entrada», step 2 shows «● fora da janela» and `trade_entry_context` has `gate = 'fora_janela'`,
`in_window = false`, `checks_evaluated = {janela, limite}`. At 10:59 the same screen reads «Liberado até 11:00 ET»; the window
end is exclusive (11:00:00 is outside). The line re-evaluates when the minute passes 11:00 while the form is open (NEW:
`rules_now` refetch at `changes_at`, already in `useRulesNow`).

### 11.3 «Não avaliado» never false

- A check that did not run is never shown as passed: plan verdict `nao_avaliado` → «—» (muted), never «No plano»
  (`marcaDoPlano`). Examples: window rule off and no limit; account without a window.
- **NEW (recommended):** under the plan pill in steps 2–3, the small note from `conferidos()`: «Conferidos: janela e limite.»
  / «Conferidos: janela.» — so «No plano» never hides what was not checked. Nothing when no check ran.
- In the gate line, «Limite do dia indisponível» (never «US$ 0») when the limit could not be read (only possible in the
  preview; the server always has the day's trades).

### 11.4 At exit (NEW; the board shows only the effect on the next entry)

- After `register_exit`, `rules_now` is refetched (invalidate `regrasKeys.agora`), so the Diário card and the next «Registrar
  outra» show «Encerrado por hoje · limite de US$ 400 atingido às 10:38 (pior momento −US$ 415,50)» when this exit reached it.
- Step 3 shows a banner when this exit made the day reach the limit (always) or 80 % of it (only with the Phase 2 preference
  «Avisar ao chegar em 80% do limite do dia» on; decision: Phase 2 stored only the preference). Proposed copy (NEW, Q13):
  - reached: «Limite do dia atingido às 10:38: −US$ 415,50 de US$ 400. Pelas suas regras, o dia está encerrado.» («Só
    avisar»: «… Pelas suas regras, é só um aviso.»)
  - 80 %: «Você chegou a 80% do limite do dia: −US$ 320 de US$ 400.»
  - `role="status"`; amber for 80 %, red text for reached.
- The window closing while a trade is open is not a break and shows nothing (the plan judges the entry).

---

## 12. Imagens e nota

Board RO l.390–417 and l.812–1011; Diário drill DiarioDez l.571–583.

### 12.1 Where and when

- Only on step 3 («último passo»), for live and «Já fechada» trades. Images and note are optional.
- Block `div.bloco` `role="group"` `aria-labelledby="l-anx"`, title (rotulo) «Imagens e nota», info `aria-label` «Como ler:
  imagens e nota» → «Ficam guardadas com a operação e aparecem nos detalhes dela, no Diário. Não entram nas contas, nos
  Padrões nem na leitura da IA. Dica: recorte o número da conta antes de enviar.»

### 12.2 Limits

| Rule | Value | Where enforced |
|---|---|---|
| Images per trade | **4** | UI (button `aria-disabled`, «Limite de 4 imagens. Remova uma para trocar.»), API route (count before issuing an upload), DB trigger (count with a row lock on the trade, appendix) |
| Size per image | **10 MB** (10.485.760 bytes) of the chosen file | UI, route, bucket `file_size_limit` |
| Types | PNG, JPG, WebP (`image/png`, `image/jpeg`, `image/webp`; a file with no type passes by extension `.png/.jpg/.jpeg/.webp`) | UI (`accept`), route, bucket `allowed_mime_types`, table check |
| Note | **1.000** characters (`maxlength`, counter «0 de 1000») | UI, `trades.note` check (exists, Phase 1) |

Owner test «A 5ª imagem é recusada»: with 4 listed, «Escolher imagens» is `aria-disabled` and pressing it shows «Até 4
imagens por operação.»; choosing 5 at once from 0 adds 4 and says «Até 4 imagens por operação; não entrou: {nome}.»; a 5th
sent by another tab is refused by the route/trigger and shows «Até 4 imagens por operação.»

### 12.3 Editor (no saved data yet, or «Editar»)

- Drop zone `div.zona` `tabindex="0"` `role="group"` `aria-labelledby="l-img"`, receives paste: label «Imagens (opcional)»;
  hint `#n-img`:
  - pointer devices: «Arraste para cá, cole com ⌘V ou escolha. Até 4 imagens PNG, JPG ou WebP, de até 10 MB cada.» (Ctrl+V
    off Apple);
  - touch-only devices (`(pointer: coarse)` and not `(pointer: fine)`): «Até 4 imagens PNG, JPG ou WebP, de até 10 MB cada.»;
  - full: «Limite de 4 imagens. Remova uma para trocar.»
- «Escolher imagens» button opens a hidden `<input type="file" accept="image/png,image/jpeg,image/webp" multiple>`
  (`tabindex="-1"`, `aria-hidden`). The whole block (zone, thumbnails, note) accepts a drop; a drop elsewhere on the sheet is
  swallowed so the file never replaces the page (RO l.1017–1023; the import sheet does the same).
- Errors (`role="alert"`, the node alternates so a repeated error is announced again, RO l.883–884): «Só imagens PNG, JPG ou
  WebP.» · «Até 4 imagens por operação.» · «Esta imagem passa de 10 MB.»; several files at once: «Estas imagens passam de 10
  MB: a.png, b.png.» · «Só imagens PNG, JPG ou WebP; não entrou: x.gif.» / «…; não entraram: x.gif, y.heic.» · «Até 4 imagens
  por operação; não entrou: e.png.» (several errors joined with a space, in arrival order).
- Live region (`aria-live="polite"`): «1 imagem adicionada. 1 de 4.» / «2 imagens adicionadas. 3 de 4.» / «MES_10-07_entrada.png
  removida. 2 de 4.»
- List `ul.minis` `aria-label` «Imagens anexadas»: thumbnail 120 × 80 (`alt` = file name; «sem prévia» when no preview),
  name (breaks after «_»), size «840 KB» / «1,2 MB», «Remover» (`aria-label` «Remover imagem {nome}»; focus moves to the next
  «Remover», else «Escolher imagens»). Pasted screenshots all named «image.png» become «image (2).png», «image (3).png».
- «Nota (opcional)» textarea, 3 rows, placeholder «Ex.: entrei antes do rompimento confirmar; o alvo estava perto da máxima
  do dia.», counter «{n} de 1000» (`aria-live="polite"`).
- Buttons: «Salvar imagens e nota» (`aria-disabled` when nothing to save) and, while editing saved data, «Cancelar».

### 12.4 Saved summary

- Status (`role="status"`): «2 imagens e nota salvas às 10:21. Aparecem nos detalhes da operação, no Diário.» / «1 imagem salva
  às 10:21. Aparece nos detalhes da operação, no Diário.» / «Nota salva às 10:21. Aparece …» (time = server time of the save).
- Thumbnails 72 × 48 in `ul.minis-res` `aria-label` «Imagens salvas», note clamped to 3 lines, «Editar» (`aria-label`
  «Editar imagens e nota»). Dropping a file on the summary reopens the editor with the saved items.
- Saving an empty editor over saved data removes them: «Imagens e nota removidas às 10:31.» / «Imagem removida às 10:31.» /
  «Imagens removidas às …» / «Nota removida às …» (removed images are deleted from storage: the owner's own action).

### 12.5 Upload pipeline (appendix §B, ADAPTED)

1. On «Salvar imagens e nota»: for each new image, `POST /api/trades/[id]/anexos` (requireUser + denyHubAccess; checks the
   trade is the caller's, `< 4` attachments, type and size) creates a `pendente` row and returns a signed upload URL for
   `trade-images/{uid}/{trade_id}/{uuid}`. The browser uploads straight to Storage (never through Vercel: 4,5 MB body
   limit). A second call marks it `ok`. The Saturday cron deletes `pendente` rows older than 1 h through the Storage API.
2. Conversion before upload (Q12, recommended): re-encode in the browser to WebP, longest side ≤ 4096 px, which also drops
   camera metadata (location). Check the blob's type: a browser that cannot encode WebP (Safari has been one of them) hands
   back PNG, so fall back to JPEG there; keep the original if the conversion is larger or fails. The 10 MB rule applies to
   the chosen file (board). Verify on the owner's phone in the Phase 3 test.
3. The original file name and the stored size are kept for display (NEW column `trade_attachments.file_name`, ≤ 200 chars;
   the appendix table has no name). The Diário shows «MES_10-04_entrada.png · 840 KB».
4. The note saves with the same button through an RPC that sets `trades.note` and `note_saved_at = now()` (the column exists;
   the live-trade freeze trigger must leave `note` writable).
5. Thumbnails of saved images come from short signed read URLs (private bucket); right after choosing, from `blob:` URLs
   (revoked on leave, RO l.927–929).
6. Per-image progress (NEW): «Enviando 1 de 2…» in the status region; a failed image stays in the list with «Não foi
   possível enviar {nome}.» and the button still offers «Salvar imagens e nota» (retry only the failed ones).

### 12.6 Phone camera and files

- The picker offers camera, photo library and files on iOS and Android because `accept` lists image types; do **not** set
  `capture` (it would force the camera; most attachments are broker screenshots).
- iPhone photos (HEIC) arrive as JPEG through the picker when `accept` does not list HEIC (to verify on the owner's phone in
  the Phase 3 test); a HEIC from «Arquivos» is refused with «Só imagens PNG, JPG ou WebP.»
- Drag and paste are hidden from the hint on touch devices (board).

---

## 13. Accounts in the new markets (Forex, Ações, Cripto, B3) — NEW, needs a board

The owner decided their trades come from «Registrar operação» in Phase 3 and then the column-mapping import (ImportarConta
scenario 8). No board draws these variants, and the 2b rule is «Telas novas passam ANTES pelo protótipo (canvas) para
aprovação» → a board update first (Q14). Proposal for that board (one generic variant, not five):

- Same sheet, steps, context block, gate (window + limit in the account's currency: R$ on B3), setup and marks, images and note.
- Fields: «Ativo» (text, uppercase, with the account's recent symbols as pills), «Lado» Compra / Venda, «Quantidade» (lots,
  shares, coins or contracts; decimal for crypto/forex), «Preço de entrada», «Hora (ET)» / «Hora (Brasília)» by the account's
  window clock, «Stop e alvo, em preço · opcional».
- Exit: «Preço de saída», «Hora da saída», and **«Resultado, US$» / «Resultado, R$» typed** (required), because point and pip
  values per instrument are unknown; for stocks and spot crypto the field is prefilled with (saída − entrada) × quantidade ×
  lado, editable. R:R from prices when both stop and target exist.
- `asset_type` per market (`forex`, `stock`, `crypto`, `b3`), `commission` null (unknown).
- Details per market are in `mercados.md` of this survey.

---

## 14. Mobile-first layout

- ≤ 640 px: the sheet is the whole screen, the page and the hub header behind it are not rendered
  (`.hub-fundo-pagina--coberto { display: none }`, already in `hub.css`), padding 18/16/28 (RO l.158–166).
- **NEW (recommended): sticky footer on phones.** The board's footer sits at the end of the content; at 375 px the sheet is
  about 1.400–2.200 px tall depending on the step (board battery `registrar_board/bateria_claro_375.txt`), so «Registrar
  entrada» needs scrolling. Keep
  the footer fixed at the bottom of the sheet on ≤ 640 px with `padding-bottom: env(safe-area-inset-bottom)`, and keep the
  «O Binary Hub não envia ordens…» note inside the scroll.
- Field order is the tap order of a live entry: Ativo (preselected) → Lado → Contratos (preselected) → Preço → Setup →
  «Registrar entrada»: 3 taps + the price on a typical entry.
- Inputs: `inputmode="decimal"` for prices and amounts (board); `type="time"` gives the native wheel; **font-size 16 px on
  phones** for inputs and the textarea (ADAPTED: the board's 14 px makes iOS zoom the page on focus).
- Two-column field pairs collapse to one column ≤ 420 px, except stop/alvo and stake/payout (`campos2 sempre`, RO l.167).
- Touch targets ≥ 44 px (pills, buttons, info buttons with a 9 px invisible halo, RO l.48–49); setup pills 60 × 52.
- Thumbnails 120 × 80 in the editor; names wrap (`overflow-wrap: anywhere`).
- Check at 320, 375, 768 and 1280 px in both themes (the board's battery used 320/375/1280: no overflow, no low contrast).

---

## 15. Accessibility (from the board; keep all of it)

- Dialog semantics and focus as §3.2; each step's H3 receives focus (dashed focus ring only for keyboard, RO l.84–85).
- Pill groups: `role="group"` + `aria-labelledby` the visible label; options are `<button aria-pressed>`; disabled options use
  `aria-disabled="true"` (stay focusable), never `disabled`.
- Errors: `aria-invalid="true"` on the field, `aria-describedby` = its note + its error id, error `role="alert"`; on submit,
  focus goes to the first invalid field in board order (group errors focus the group's first pill).
- Info buttons: `aria-expanded`, `aria-controls`, `aria-label` «Como ler: …»; panels are plain text.
- Status messages in `role="status"` regions: «Entrada registrada às 10:07 ET.», NEW «Saída registrada às 10:21 ET.», NEW
  «Resultado registrado às 20:12 de Brasília.», NEW mark announcement «Setup A, às 10:07, antes da saída.»
- Live region for image add/remove (polite); the counter is polite.
- `prefers-reduced-motion`: no chevron/switch transitions.
- Contrast 4.5:1 in both themes (board tokens; the amber plan pill and the dashed «fraco» chip were checked on the board).
- The step dots are `aria-hidden`; the indicator text carries the step.

---

## 16. Loading, errors, offline, double submits (all NEW: the board draws none)

### 16.1 Loading

- Opening the sheet needs: the account (cached), `rules_now` (cached by the Diário card), the account's open trades. While
  any is missing: «Carregando…» (`LOADING`) in the body, the footer hidden. On failure: «Não foi possível carregar o
  Registrar.» (NEW) + «Tentar de novo» (`TRY_AGAIN`).
- If only `rules_now` fails, the form still works; the gate line reads «Posso operar hoje? Não foi possível conferir agora.»
  (NEW, muted) — never «Liberado». The server still evaluates at «Registrar entrada».

### 16.2 Request errors (codes → copy; never the database's text)

| Code | Copy | Where |
|---|---|---|
| `not_authenticated` | «Sua sessão expirou. Entre de novo para continuar.» (existing) | alert under the body |
| `unknown_account` | «Esta conta não foi encontrada.» (existing) | alert |
| `archived_account` | «Esta conta está arquivada. Reative em Personalizar para registrar.» (ADAPTED from «… para importar.») | alert |
| `no_rules` | «Esta conta ainda não tem regras salvas. Defina a janela antes de registrar.» + «Definir em Personalizar» (NEW, Q11) | replaces the form |
| `bad_*` field codes (price, tick, time, quantity, stake, payout, side) | the field's own board error; else «Confira os campos.» (existing `invalid_field`) | field / alert |
| `future_time` | «A entrada não pode ser depois de agora (10:07 ET).» (board) | Hora field |
| `too_old` | «A entrada precisa ser de hoje. Para uma operação antiga, use “Já fechada”.» (NEW, Q1) | Hora field |
| `exit_before_entry` | «A saída não pode ser antes da entrada (10:33).» (board) | exit hour |
| `not_expired` | «Ainda não venceu.» (board) | «Como terminou?» |
| `unknown_trade` | «Esta operação não foi encontrada.» (NEW) | alert, back to step 1 |
| `already_closed` | «Esta operação já foi fechada em outro lugar.» (NEW) | status, move to step 3 |
| `too_many_images` | «Até 4 imagens por operação.» (board) | image error |
| `image_too_large` / `bad_image_type` | «Esta imagem passa de 10 MB.» / «Só imagens PNG, JPG ou WebP.» (board) | image error |
| `network` | «Não foi possível falar com o servidor. Confira sua conexão e tente de novo.» (existing) | alert |
| `unknown` | «Algo deu errado. Tente de novo.» (existing) | alert |

### 16.3 Double submits and retries

- «Registrar entrada/saída/resultado/operação» are `aria-disabled` while their request runs, guarded by a ref (as
  `ImportSheet.busyRef`).
- **Idempotency (NEW, important on mobile networks):** the browser generates the trade's UUID before the first attempt and
  sends it (`p_client_id`); `register_entry` inserts with that id and returns the existing row when it already exists for the
  same user, so a retry after a timeout never creates a second trade. Same for `register_exit` (no-op when already closed
  with the same values) and per-mark client ids.

### 16.4 Offline

- Registering needs the server's clock, so nothing is queued: with `navigator.onLine === false` or a request paused by React
  Query, the primary button shows the alert «Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando
  a conexão voltar.» (NEW) and the form keeps everything typed (in memory; also `sessionStorage` per account as a per-device
  convenience, cleared on success, so a reload on the phone does not lose the entry).
- Mutations use `networkMode: 'always'` so they fail fast instead of waiting silently.
- Mark taps offline revert with «A marca não foi salva. Tente de novo.»

### 16.5 Device clock

All times shown and prefilled come from the server clock (`server_now` + elapsed since the answer), not the phone's; the
stored times come from `now()` in SQL. The binary expiry timer and the 11:00 window edge use the same offset.

---

## 17. What the Diário shows for a registered trade

### 17.1 The approved Diário boards (Phase 4 builds this; Phase 3 must store everything it needs)

From `DiarioDezEnxuto` «Operações do dia» (l.543–595) and its data:
- Table `role="table"` with columns «Hora», «Operação», «Resultado», «Estado na entrada», «Plano», and a details button
  (`aria-label` «Detalhes da operação: Venda de MES às 10:04»). Row: «10:04» (entry) · «MES · Venda · 2 ct» + paperclip icon
  (`role="img"` `aria-label` «tem imagens e nota») · «−US$ 45,00» (red/mint) · state chip (Phase 5) · «No plano» / «● no
  bloqueio» (`aria-label` «fora do plano: no bloqueio») / «—». Rows outside the plan get an amber border.
- Drill «Sua operação»: «Hora» «10:04–10:06»; «Entrada → saída» «7.951,25 → 7.955,75 · −4,50 pts»; «Stop · alvo» «stop 12 ·
  alvo 24 pts · às 10:30» or «não anotados»; «Posso operar hoje?» «Aguardar até 10:10» (the stored gate at entry); «Seu viés»
  and «Regra» (Phase 5); gate note when relevant («A tela mostrava “Encerrado por hoje” desde 10:38. As vendas anteriores
  foram registradas durante o pregão, então o limite já estava na conta.»).
- «Imagens e nota» + «salvos às 11:30 · depois do resultado»; thumbnails 168 × 104 with caption «MES_10-04_entrada.png · 840
  KB»; the note. Without attachments: link «Adicionar imagens ou nota» (opens Registrar step 3).
- Mark editor «Setup · sua nota, de A a C», «Execução», «Emoção», each with its time «às 10:05 · antes da saída» or, when
  changed in the Diário, «agora, 11:35 · depois do resultado».
- `D.infos.ops`: «Abra ▾ para ver saída, preços e pontos, o stop e o alvo anotados, a hora de cada marca (antes da saída ou
  depois do resultado), as suas imagens e nota (clipe na linha), o “Posso operar hoje?” na entrada, o seu viés, a regra do
  estado, o que a tela dizia e as suas marcas. …»
- `D.infos.grava`: «O limite só encerra o dia na tela quando as operações são registradas durante o pregão; as que chegam só
  pelo arquivo, depois, entram com o “Posso operar hoje?” recalculado, e a operação mostra isso.»

Implications for Phase 3 storage: entry/exit instants and prices, contracts, stop/target (with the time they were noted =
`registered_at`), the gate at entry, the plan breaks, every mark with time and limpa, attachment names/sizes/save time,
note + `note_saved_at`, `source` and `origin` (live vs reconstructed), and whether the trade was registered during the
session. The boards show **no open trade and no binary trade**: both are NEW for Phase 4 (an open row «aberta» without a
result; binary rows «EUR/USD · Baixa · 2 min»).

### 17.2 Phase 3 bridge on `/diario` (NEW, Q10)

Between the «Posso operar hoje?» card and the placeholder, a compact block for the current account:
- H2 «Operações do dia» (board name), rows in the board's row format (subset): «10:07» · «MES · Compra · 2 ct» · «aberta»
  (muted, NEW) + «Registrar saída» button; closed rows «10:07–10:21» · «MES · Compra · 2 ct» + clip · «+US$ 75,00» · plan
  pill. Tapping a row opens Registrar on that trade (step 2 or 3).
- Empty: «Nenhuma operação registrada hoje.» (NEW). Only `source in ('live','after')` trades of the current trading day;
  imported trades stay out (Phase 4 shows the day).
- Replaced by the full day in Phase 4. The placeholder text «O Diário chega na Fase 4.» stays below.

---

## 18. Data the screen writes and reads (contract for `banco.md`)

All writes through `SECURITY DEFINER` RPCs that take the caller from the JWT (appendix §A); errors are bare codes.

| Call | Input (from the sheet) | Output (what the sheet shows) |
|---|---|---|
| `gate_at(account, at)` (exists) | typed instant | gate line + plan preview |
| `rules_now()` (exists) | — | gate line for "now", limit line, `server_now` |
| `register_entry(p jsonb)` | `client_id`, `account_id`, market fields (futures: `symbol`, `side`, `quantity`, `entry_price`, `stop_pts`, `target_pts`; binary: `symbol`, `direction`, `stake`, `payout`, `expiry` spec), `entry_local` (`HH:MM` or null = now), `marks` [{kind, value}] | trade id, `registered_at`, `entry_time`, `trading_day`, `exit_time` (binary expiry), stored context (`gate`, breaks, `checks_evaluated`), marks with `marked_at` and `limpa` |
| `register_after(p jsonb)` | as above + `exit_price` / `exit_local` (futures) | as above + `pnl`, `result`; `origin = 'reconstructed'` |
| `register_exit(trade, p jsonb)` | futures `exit_price`, `exit_local`; binary `outcome` (`ganho`/`perda`/`devolvida`) | `exit_registered_at`, `exit_time`, `pnl` (computed by the server), `result`, marks with updated `limpa`, the day's limit after the exit (for §11.4) |
| `add_mark(trade, kind, value, client_id)` | one tap | `marked_at`, `limpa` |
| `save_trade_note(trade, note)` | note ≤ 1.000 | `note_saved_at` |
| `undo_entry(trade)` (Q9) | — | deletes trade, context and marks while open and < 15 min |
| `POST/PATCH/DELETE /api/trades/[id]/anexos[/aid]` | image meta | signed upload URL; `ok`; deletion via Storage API |
| reads | open trades of the account; a trade with `trade_marks_v`, `trade_entry_context`, attachments | resume, step 3 |

- **P&L is computed by the server** for futures (price diff × point value × contracts, from an instrument table mirrored in TS
  with a parity test, like `MARKET_SPEC`) and binary (stake/payout/outcome); the browser computes the same preview. ADAPTED
  from the appendix, whose `register_exit(trade, price, pnl, result)` trusts a client P&L. New markets: typed result (§13).
- `commission`: null for live futures (unknown; the limit counts gross until an import completes it — decision 2); `0.00` for
  binaries.
- Futures `direction` `long`/`short`; `quantity` = contracts; `asset_type 'futures'`; `status 'open'` → `'closed'`;
  `result` and `pnl` null while open (never `'pending'`, which `limit_usage` also skips).
- Existing rows: `status` defaults to `'closed'`, `registered_at` null, `source` unchanged: no existing trade, version or day
  changes (Phase 3 rule).

---

## 19. Other screens and strings that change when Registrar ships

| Where | Today | Phase 3 |
|---|---|---|
| `DiarioCabecalho` | «Importar arquivo» only | + primary «Registrar operação» (§3.1) |
| `CONTAS.info` (`contas/copy.ts:124`) | «… Nas contas de Forex, de Ações, de Cripto e da B3, as operações entram pelo “Registrar operação”, que chega na Fase 3, e logo depois também por um CSV …» | ADAPTED: «… entram pelo “Registrar operação” e, em breve, também por um CSV em que você diz o que é cada coluna. …» |
| `CONTAS.semLeitor(m)` / `PASSO_I1.semLeitor(m)` | «Ainda não lemos arquivos {de}: as operações (desta conta) entram pelo “Registrar operação”, na Fase 3.» | drop «, na Fase 3» once the variant of §13 exists |
| `FIM_CONTA.text` / `.semLeitor` | «Nada ainda. Importe o histórico ou registre a primeira operação.» (only «Importar histórico») / «Nada ainda: as operações desta conta entram pelo “Registrar operação”, que chega na Fase 3.» | add the board's «Registrar operação» link (§3.1); new markets: «Nada ainda. Registre a primeira operação.» |
| `/diario` | card + placeholder | + bridge block (§17.2) |
| `NEVER_SUMMED` | «Contas de mercados diferentes nunca são somadas.» | unchanged (the Registrar board's background still says «Futuros e binárias nunca são somados.», superseded in 2b) |

---

## 20. Tests (this screen)

Jest + Testing Library (`__tests__/components/hub/registrar/*`, `__tests__/lib/hub/registrar*.test.ts`):
- Parser and formats: «7.896,25» / «7896,25» / «7896.25» / «7.896» / «1.234.567,8»; tick check per asset (MES 0,25, MGC 0,10;
  never rounded); risk line and R:R strings; P&L preview strings for both variants; binary expiry (Q6 rule) at 20:10:25 M1 →
  20:12, across midnight.
- Gate line copy for every status/warning (reuses `possoLinha` fixtures) and the plan line; «Não avaliado» → «—», never «No
  plano»; «Conferidos: janela e limite.»
- Steps: live futures 1→2→3; «Já fechada» 1→2; binary open → vencida (fake timers on the server-offset clock) → result;
  «Registrar outra» with pending images (announces «Operação anterior: …»); resume with one / several open trades; closing
  with typed data asks «Fechar sem salvar?».
- Validation focus order and messages (every board error string).
- Marks: chip texts before/after; toggle-off writes a null mark; step 3 split (antes / depois, «trocada», «desmarcada»,
  history line, «a partir das 10:21 (sua saída)»).
- Images: 5th refused (button, multi-select, server code); 11 MB refused; GIF/HEIC refused; duplicate «image.png» names;
  remove focus order; touch hint without drag/paste; save/remove status strings.
- Offline: `onLine=false` → the offline alert, nothing sent; idempotent retry sends the same `client_id`.
- Mobile: sticky footer present ≤ 640 px; inputs 16 px.
- Domain parity: the gate fixtures (`cases.json`) drive both `evaluatePlan` and the SQL of `register_entry`
  (appendix «a mesma tabela-verdade testa os dois lados»).

Database (pgTAP, `supabase/tests`, details in `banco.md`): forced and frozen `registered_at`, `exit_registered_at`,
`marked_at`; marks append-only; `limpa` cases (typed exit earlier than the registration, binary expiry, `after` source);
4-image trigger with concurrent inserts; bucket refuses 11 MB and GIF and another user's folder; two-user RLS; idempotent
`client_id`; existing 629-trade-like fixture unchanged.

Owner test mapping: «Registrar pelo celular» → §14 at 375 px on his phone over Vercel (or LAN), live Top One entry and exit,
an Ebinex entry and result; «Às 11:05 aparece "Fora da sua janela"» → §11.2; «A 5ª imagem é recusada» → §12.2.

End-to-end (Playwright) only with the owner's OK (new dependency, appendix §D).

---

## 21. Gaps between the board, the appendix and Phases 1–2b

| # | Gap | Recommendation |
|---|---|---|
| G1 | Entry time. Appendix: `entry_time = registered_at = now()` and frozen. Board: an editable «Hora» prefilled with now; a typed time ≠ now flips the label to «Na entrada:». | Q1: entry_time = typed time (same trading day, ≤ now), `registered_at = now()`, both stored; marks judged by server time. |
| G2 | «limpa». Appendix view: `marked_at < exit_registered_at`. Board: before the typed exit and, for binaries, before the expiry. | §10.2 expression with `least(exit_registered_at, exit_time)` and the binary expiry stored in `exit_time` at entry. |
| G3 | Clearing a mark: board writes an empty value; appendix `value text not null`. | Allow null = «sem marca». |
| G4 | `register_entry(…, setup)` takes only the setup; the board also sends execution (and emotion in «Já fechada»). | `marks` array in the payload. |
| G5 | Stop/target in points (board) vs prices (Phase 1 columns, Top One file). | Convert on write; show points (§5.2). |
| G6 | `trade_entry_context` has `day_pnl_at_entry` but the limit compares the worst point (`EntryContext.day_worst_at_entry_cents`). | Add `day_worst_at_entry` (gate.md GG4). |
| G7 | Binary expiry: board = entry minute + minutes; Ebinex = next candle + candle length (Phase 1 reader, owner). | Q6. |
| G8 | Price prefill «o último preço na tela» needs market data (Phase 5/8). | Q8: empty field, note hidden. |
| G9 | «O que a tela diz agora» and «sua regra: …» need market states (Phase 5). | Hidden in Phase 3. |
| G10 | «Ver no Diário» and «Adicionar imagens ou nota» point to a Diário that is a placeholder until Phase 4. | Q10 bridge. |
| G11 | A trade registered live has no `external_id`; importing the broker file later inserts it again (`on conflict (account_id, source_platform, external_id)` cannot match). No board covers this. | Q3: the import recognises live trades and completes them. |
| G12 | The board draws no loading, error, offline or resume state. | §4.2, §16 (NEW). |
| G13 | Board sheet closes without asking and keeps its state; the app persists the open trade server-side and loses typed drafts. | «Fechar sem salvar?» on steps 1 and 3 (§3.2). |
| G14 | Appendix converts images to WebP; Safari cannot encode WebP; the board shows original names and sizes. | Q12; keep `file_name` (new column). |
| G15 | «Contratos» 1–3 only. | Q5. |
| G16 | «Registrar outra» / «Ver no Diário» save pending images on the board instantly; in the app that is an upload that can fail. | Upload first, stay on error (§4.3). |
| G17 | Hour labels hard-code «(ET)» on exit fields. | Use the account's window clock. |
| G18 | «Registrar operação» is primary on the Registrar board and secondary on the Diário boards. | Primary. |
| G19 | The board's background note «Futuros e binárias nunca são somados.» | Superseded by `NEVER_SUMMED` (2b). |
| G20 | New-market variants have no board. | Q14. |
| G21 | Appendix `register_exit(trade, price, pnl, result)` trusts a client P&L. | Server computes P&L for futures and binary (§18). |
| G22 | No way out of a mistaken registration on the board; marks and live trades are frozen. | Q9. |
| G23 | Several open trades at once are not drawn. | Q15. |
| G24 | The board shows no limit use while registering, and no warning at exit; the 80 % preference was stored in Phase 2 «só a preferência». | Q13. |
| G25 | Retries on a flaky phone network could create two trades. | Client-generated id, idempotent RPCs (§16.3). |
| G26 | Phase 2 preview used the device clock; Registrar records with the server's. | Prefill and timers from `server_now` (§16.5). |

---

## 22. Every pt-BR string, with its location

Status: **B** = on the board as is; **A** = ADAPTED (reason in the section cited); **N** = NEW; **P** = prototype-only, not
built; **5** = board string kept for Phase 5 (not shown in Phase 3). «{…}» = variable. RO = RegistrarOperacao.dc.html line.

### 22.1 Frame, entry points, footer

| String | Location | Status |
|---|---|---|
| «Registrar operação» | sheet H2 `#t-folha` (RO l.247); Diário header button (RO l.226; DiarioDez l.223); ImportarConta 2b `fimConta` link; footer primary of «Já fechada» step 1 (RO l.1034) | B |
| «Importar arquivo» | Diário header (RO l.226) | B (exists) |
| «Fechar» | close button `aria-label` (RO l.247) | B |
| «×» | close glyph | B |
| «Passo {k} de {n} · {Entrada \| Aberta \| Vencida \| Fechada \| Entrada e saída}» | `div.ind` (RO l.1030–1032) | B |
| «O Binary Hub não envia ordens: registrar é anotar.» | under the footer (RO l.429) | B |
| «Registrar entrada» | footer, live step 1 (RO l.1034) | B |
| «Registrar saída» / «Registrar resultado» | footer, step 2 futures / binary (RO l.1035) | B |
| «Registrar outra» | footer left, step 3 (RO l.423) | B |
| «Ver no Diário» | footer primary link, step 3 (RO l.426) | B |
| «Fechar sem salvar?» / «Fechar» / «Continuar aqui» | leave question | N (exists as `FOLHA.*`) |
| «Nova entrada» | footer secondary on step 2 / open chooser | N |
| «Operações abertas» | chooser H3 | N |
| «desde {10:07 ET}» / «desde ontem, {10:07 ET}» / «desde {14 out}, {10:07 ET}» | chooser rows, resumed summary | N |
| «Desfazer entrada» | step 2 link (Q9) | N |
| «Como está a operação?» / «Aberta» / «Já fechada» | step-1 mode pills (Q2) | N |
| «Esta operação já foi fechada em outro lugar.» | status on resume | N |
| «Carregando…» / «Tentar de novo» / «Um momento…» | loading / retry / busy | N (exist) |
| «Não foi possível carregar o Registrar.» | load failure | N |
| «Futuros e binárias nunca são somados.» | background menu note (RO l.235) | B, superseded by «Contas de mercados diferentes nunca são somadas.» |
| «Conta: {Top One}» ▾, «Gerenciar contas», «Top One · Financiada», «Ebinex · Pessoal», «Futuros», «Opções binárias», «Diário», «Calendário», «O dia», «Operações do dia» | board background (RO l.218–239) | B (Diário header already built; skeleton labels are prototype scenery) |

### 22.2 Context block and gate

| String | Location | Status |
|---|---|---|
| «Conta» | context label (RO l.256) | B |
| «{Top One}» chip; «Janela 10:00–11:00 ET» / «Janela 20:00–21:00 · Brasília» | context (RO l.256; `D.contas`) | B (`janelaLinha` exists) |
| «Posso operar hoje?» / «Posso operar hoje? Na entrada:» | gate label (RO l.650) | B |
| «Liberado» + «até 11:00 ET» / «até 21:00 de Brasília» | gate (RO l.506) | B |
| «Fora da sua janela» + «· 10:00–11:00 ET» | gate (RO l.505) | B |
| «Aguardar até {10:10}» + «· bloqueio: {ISM industrial}» | gate (RO l.504) | 5 |
| «Encerrado por hoje» + «· limite de US$ 400 atingido às 10:38 (pior momento −US$ 415,50)» | gate (RO l.502) | B |
| «com aviso: fora da janela» / «com aviso: hoje não é dia da janela» / «com aviso do limite» / «· hoje não é dia da janela» | gate sub | A (from `possoLinha`) |
| «Sem regra ativa» + «Ajustar» | gate, nothing evaluated | A (from `possoLinha`) |
| «Posso operar hoje? Não foi possível conferir agora.» | gate, `rules_now` failed | N |
| «Como ler: Posso operar hoje?» | info `aria-label` (RO l.257) | B |
| «Calculado pelas regras desta conta, na hora da entrada: janela, bloqueio de dados e limite do dia. Ele nunca impede o registro: fora do plano, a operação só ganha a marca.» | `#info-gate` (RO l.651) | A → «… na hora da entrada: janela e limite do dia (o bloqueio de dados fica ativo na Fase 5). Ele nunca impede o registro: fora do plano, a operação só ganha a marca.» |
| «Limite do dia» «US$ 320» «de US$ 400» (aria «{Top One}, limite do dia: US$ 320 de US$ 400.»); «—» / «Limite do dia indisponível» | context, limit line (Q13) | N (copy from `possoLinha`) |
| «O que a tela diz agora:» / «Na tela, na entrada:» / «ES · MES» / «Alinhadas · alta» / «sua regra: só a favor» / «sua regra: opero» / «sua regra: não opero» / «sua regra: não conferida, comparação suspensa» | state line (RO l.259, l.653, l.509–518) | 5 |
| «Esta conta ainda não tem regras salvas. Defina a janela antes de registrar.» + «Definir em Personalizar» | no version (Q11) | N |

### 22.3 Futures fields

| String | Location | Status |
|---|---|---|
| «Entrada» / «Entrada e saída» | step-1 H3 (RO l.646) | B |
| «Ativo» · «MES» «MNQ» «MGC» | RO l.263 | B (list: Q4) |
| «Lado» · «Compra» «Venda» | RO l.264 | B |
| «Contratos» · «1» «2» «3» | RO l.265 | B (Q5) |
| «Preço de entrada» / «Preço de saída» | RO l.267, l.273, l.349 | B |
| «Hora (ET)» / «Hora da entrada (ET)» / «Hora da saída (ET)» | RO l.660, l.662, l.757 | B; A: suffix by account clock |
| «Sugestão: o último preço na tela. Ajuste ao da sua plataforma.» | RO l.270 | 5 (hidden, Q8) |
| «Stop e alvo, em pontos» «· opcional» · «Stop» «Alvo» | RO l.278–281 | B |
| «risco US$ 110,00 · alvo US$ 220,00 · 1 : 2» / «Sem stop e alvo, o R não é calculado.» | RO l.283, l.629–632, l.665 | B |
| «Escolha Compra ou Venda.» | RO l.606 | B |
| «Informe o preço de entrada.» / «Informe o preço de saída.» | RO l.567 | B |
| «Use só números, como 7.896,25.» | RO l.567 | B |
| «O preço precisa ser maior que zero.» | RO l.567 | B |
| «O {MES} anda de {0,25} em {0,25}; confira o preço.» | RO l.566–568 | B |
| «Use pontos maiores que zero.» | RO l.569 | B |
| «Use pontos de 0,25 em 0,25 no MES.» | stop/target off the tick | N |
| «Informe a hora.» | RO l.602 | B |
| «A entrada não pode ser depois de agora ({10:07 ET}).» | RO l.602 | B |
| «A entrada precisa ser de hoje. Para uma operação antiga, use “Já fechada”.» | Hora lower bound (Q1) | N |
| «A saída não pode ser antes da entrada ({10:33}).» / «A saída não pode ser depois de agora ({11:01 ET}).» | RO l.604, l.721 | B |
| «Resultado: escolha o lado.» / «Resultado: preencha os dois preços.» / «Resultado: confira os preços (o MES anda de 0,25 em 0,25).» / «Resultado: confira os preços.» / «Resultado: {+9,50} pts · {+US$ 95,00}» | «Já fechada» preview (RO l.633–641) | B |
| «● {fora da janela · depois do limite}» + «Fora do plano, conferido pelo hub. Você pode registrar.» | plan line (RO l.299, l.675) | B («no bloqueio», «contra a regra»: 5) |

### 22.4 Setup and other marks

| String | Location | Status |
|---|---|---|
| «Como está o setup?» / «Como estava o setup?» | RO l.677 | B |
| «Como ler: por que marcar agora» | info `aria-label` (RO l.303) | B |
| «Marcar depois de ver o resultado puxa a nota para o resultado: a perda vira “Setup C”, e “Setup A rende mais” passa a se provar sozinho. Por isso o app grava a hora de cada marca: só as feitas antes da saída podem chegar a Confirmada nos Padrões de Análises; as de depois param em Pouco fundamentada.» | `#info-setup` (RO l.304) | B |
| «A» «B» «C» (aria «Setup A», «Setup B», «Setup C») | RO l.305, l.679 | B |
| «agora conta como antes da saída» / «depois do resultado» / «às {10:07} · antes da saída» / «às {11:01} · depois do resultado» | time chip (RO l.548, l.680) | B |
| «salvando…» | time chip while the tap is sent | N |
| «Marcas feitas agora contam como depois do resultado; para passar de Pouco fundamentada em Análises, marque o setup na entrada.» | RO l.307 | B |
| «Execução da entrada» / «Execução e emoção» | collapsible (RO l.682) | B |
| «Execução» · «cedo» «no ponto» «tarde» | `GRUPOS` (RO l.530) | B |
| «Emoção» · «Calmo» «Confiante» «Ansioso» «Frustrado» «Neutro» | `GRUPOS` (RO l.530) | B |
| «Setup» | group label in editors (RO l.530) | B |
| «Setup {A}» / «Execução: {cedo}» / «Emoção: {Calmo}» | mark labels (`rotMarca`, RO l.539) | B |
| «A marca não foi salva. Tente de novo.» | mark failure | N |
| «Setup A, às 10:07, antes da saída.» | sr announcement after a mark | N |

### 22.5 Step 2 (open) and the exit

| String | Location | Status |
|---|---|---|
| «Operação aberta» / «Opção vencida» | H3 (RO l.741) | B |
| «Entrada registrada às {10:07 ET}.» | sr status (RO l.743) | B |
| «MES · Compra · 2 ct» / «EUR/USD · Baixa · 2 min» | summary (`opTxt`, RO l.725) | B |
| «{7.896,25} às {10:07 ET}» / «US$ {20} · payout {88}% · {20:10}–{20:12 de Brasília}» | summary (RO l.745) | B |
| «stop {11} · alvo {22} pts · risco US$ {110,00}» | summary (RO l.747–748) | B |
| «No plano» / «● fora da janela» | plan pill (RO l.726) | B |
| «Conferidos: janela e limite.» / «Conferidos: janela.» | under the plan pill | N (helper exists) |
| «—» | plan pill, nothing evaluated | A (`marcaDoPlano`) |
| «Agora:» «{10:07 ET}» «Avançar o relógio para {10:21}» «só no protótipo» | RO l.329, l.1027 | P |
| «Suas marcas» / «Nenhuma ainda.» | RO l.331–333 | B |
| «Marcas feitas agora contam como depois do resultado.» | after expiry (RO l.334) | B |
| «Como você está?» | emotion title (RO l.336) | B |
| «Setup e execução» | collapsible (RO l.338) | B |
| «Se sair a {7.903,75}: {+7,50} pts · {+US$ 75,00}» / «Resultado: informe o preço de saída.» / «Resultado: confira o preço de saída (o MES anda de 0,25 em 0,25).» / «Resultado: confira o preço de saída.» | preview (RO l.731–736) | B |
| «Saída registrada às {10:21 ET}.» / «Resultado registrado às {20:12 de Brasília}.» | sr status after the exit | N |

### 22.6 Binary

| String | Location | Status |
|---|---|---|
| «Par» · «EUR/USD» «BTC/USD» «GBP/USD» «ETH/USD» «USD/JPY» | RO l.288, `D.cen['5'].pares` | B (list: §8.1) |
| «Outro par» | pair text field | N |
| «Direção» · «Alta» «Baixa» | RO l.289 | B |
| «Expiração» · «1 min» «2 min» «5 min» «15 min» | RO l.290, l.670 | B (Q6 may change to candles) |
| «Stake, US$» / «Payout, %» | RO l.292–293 | B |
| «Hora (Brasília)» | RO l.660 | B |
| «Se acertar: {+US$ 17,60} · se errar: {−US$ 20,00}» / «Preencha stake e payout.» | RO l.673–674, l.737 | B |
| «Escolha Alta ou Baixa.» / «Escolha a expiração.» / «Informe o stake.» / «Use um valor maior que zero.» / «Informe o payout.» / «O payout vai de 1 a 100%.» | RO l.610–612 | B |
| «Como terminou?» · «Ganho» «Perda» «Devolvida» | RO l.354, l.759 | B |
| «Vence às {20:12 de Brasília}.» / «Venceu às {20:12 de Brasília}.» | RO l.761 | B |
| «Ainda não venceu.» / «Escolha como terminou.» | RO l.723 | B |
| «Resultado: {−US$ 20,00}» | RO l.738 | B |

### 22.7 Step 3 (closed)

| String | Location | Status |
|---|---|---|
| «Operação fechada» | H3 (RO l.362) | B |
| «{+US$ 75,00}» | result (RO l.364) | B |
| «MES · Compra · 2 ct · 7.896,25 → 7.903,75 · +7,50 pts · 10:07–10:21 ET» / «EUR/USD · Baixa · 2 min · perda · 20:10–20:12 de Brasília» (outcomes «ganho», «perda», «devolvida») | RO l.800–801 | B |
| «{+0,68} R» «com stop de {11} pts» | RO l.802 | B |
| «conferido pelo hub» | RO l.368 | B |
| «Suas marcas» + «Como ler: suas marcas» | RO l.370 | B |
| «Nos Padrões de Análises, só as marcas feitas antes da saída podem chegar a Confirmada; as feitas depois do resultado aparecem, mas param em Pouco fundamentada. Mudou uma marca depois? Em Análises vale a de antes da saída, e a troca fica guardada.» | `#info-marcas` (RO l.371) | B |
| «antes da saída» / «depois do resultado» | sub-label chips (RO l.372, l.375) | B |
| «{Setup A} às {10:07}» / «… às 10:07 (trocada às 10:31)» / «… (desmarcada às 10:31)» / «Nenhuma.» | RO l.782–786 | B |
| «{Setup}: sem marca» / «antes: {A} às {10:07} · agora: {B} às {10:31}» / «… · agora: sem marca às 10:31» | RO l.788–789 | B |
| «Marcas feitas a partir de agora contam como depois do resultado.» / «Marcas feitas a partir das {10:21} (sua saída) contam como depois do resultado.» / «… (o vencimento) …» | RO l.793–795 | B |
| «Marcar ou mudar» | collapsible (RO l.381) | B |
| «Limite do dia atingido às {10:38}: {−US$ 415,50} de {US$ 400}. Pelas suas regras, o dia está encerrado.» / «… Pelas suas regras, é só um aviso.» / «Você chegou a 80% do limite do dia: {−US$ 320} de {US$ 400}.» | exit banner (Q13) | N |

### 22.8 Images and note

| String | Location | Status |
|---|---|---|
| «Imagens e nota» | block title (RO l.391) | B |
| «Como ler: imagens e nota» | info `aria-label` | B |
| «Ficam guardadas com a operação e aparecem nos detalhes dela, no Diário. Não entram nas contas, nos Padrões nem na leitura da IA. Dica: recorte o número da conta antes de enviar.» | `#info-anx` (RO l.392) | B |
| «Imagens» «(opcional)» | zone label (RO l.402) | B |
| «Arraste para cá, cole com ⌘V ou escolha. Até 4 imagens PNG, JPG ou WebP, de até 10 MB cada.» (Ctrl+V off Apple) / «Até 4 imagens PNG, JPG ou WebP, de até 10 MB cada.» (touch) / «Limite de 4 imagens. Remova uma para trocar.» | hint `#n-img` (RO l.957–958) | B |
| «Escolher imagens» | button and input `aria-label` (RO l.404–405) | B |
| «Só imagens PNG, JPG ou WebP.» / «Até 4 imagens por operação.» / «Esta imagem passa de 10 MB.» | RO l.815 | B |
| «Estas imagens passam de 10 MB: {a.png, b.png}.» / «Só imagens PNG, JPG ou WebP; não entrou: {x}.» / «…; não entraram: {x, y}.» / «Até 4 imagens por operação; não entrou: {e.png}.» | RO l.877–882 | B |
| «1 imagem adicionada. 1 de 4.» / «{2} imagens adicionadas. {3} de 4.» / «{nome} removida. {2} de 4.» | live region (RO l.899, l.997) | B |
| «Imagens anexadas» / «Imagens salvas» | list `aria-label`s (RO l.408, l.396) | B |
| «Remover» / «Remover imagem {nome}» | RO l.412, l.994 | B |
| «sem prévia» | thumbnail fallback (RO l.409) | B |
| «{840} KB» / «{1,2} MB» | size (RO l.819) | B |
| «image (2).png» | duplicate pasted names (RO l.893–894) | B |
| «Nota» «(opcional)» | label (RO l.414) | B |
| «Ex.: entrei antes do rompimento confirmar; o alvo estava perto da máxima do dia.» | placeholder (RO l.414) | B |
| «{0} de 1000» | counter (RO l.1001) | B |
| «Salvar imagens e nota» / «Cancelar» / «Editar» («Editar imagens e nota») | RO l.415, l.398 | B |
| «{2 imagens e nota salvas} às {10:21}. {Aparecem} nos detalhes da operação, no Diário.» (variants «1 imagem salva», «2 imagens salvas», «Nota salva»; «Aparece» for one item) | RO l.905–912 | B |
| «Imagens e nota removidas às {10:31}.» / «Imagem e nota removidas …» / «Imagem removida …» / «Imagens removidas …» / «Nota removida …» | RO l.922–926 | B |
| «Operação anterior: {2 imagens e nota salvas} às {10:21}.» | next step-1 status (RO l.913) | B |
| «Enviando {1} de {2}…» / «Não foi possível enviar {nome}.» | upload progress / failure | N |
| «exemplo» / «Simular 2 imagens» | demo | P |

### 22.9 Errors, offline, bridge

| String | Location | Status |
|---|---|---|
| «Sua sessão expirou. Entre de novo para continuar.» / «Esta conta não foi encontrada.» / «Confira os campos.» / «Não foi possível falar com o servidor. Confira sua conexão e tente de novo.» / «Algo deu errado. Tente de novo.» | `ERROR_TEXT` | N (exist) |
| «Esta conta está arquivada. Reative em Personalizar para registrar.» | archived account | A (from «… para importar.») |
| «Esta operação não foi encontrada.» | unknown trade | N |
| «Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo quando a conexão voltar.» | offline alert | N |
| «Operações do dia» | bridge H2 on `/diario` (board name, DiarioDez l.544) | A (Phase 3 subset) |
| «aberta» | bridge row state | N |
| «Nenhuma operação registrada hoje.» | bridge empty | N |
| «Detalhes da operação: {Venda} de {MES} às {10:04}» / «tem imagens e nota» / «fora do plano: {no bloqueio}» / «Adicionar imagens ou nota» / «salvos às {11:30} · depois do resultado» / «Setup · sua nota, de A a C» / «agora, {11:35} · depois do resultado» / «não anotados» / «stop {12} · alvo {24} pts · às {10:30}» | Diário boards (Phase 4) | B (Phase 4) |

### 22.10 Prototype-only (never built)

«Controles do protótipo» (aria), «Cenário do protótipo:», the five scenario labels («1 · Na entrada · MES, 14 out 10:07 ET»,
«2 · Depois, com a operação já fechada · MES, 1º dez 11:01 ET», «3 · Fora da janela · MGC, 14 out 11:12 ET», «4 · Depois do
limite · MES, 19 nov 10:52 ET», «5 · Binárias · Ebinex, 15 out 20:10 de Brasília»), «Recomeçar», «Simular 2 imagens», «Modo
escuro» (demo copy of the theme switch), «fora do produto», «só no protótipo», «Agora:», «Avançar o relógio para {HH:MM}»,
«exemplo».

---

## 23. Open questions for the owner

1. **A hora da entrada pode ser digitada, ou é sempre a hora do servidor?** O protótipo deixa você corrigir a hora (por
   exemplo, registrar às 10:12 uma entrada das 10:07); o apêndice grava a entrada na hora do servidor e congela.
   (a) A hora digitada vira a hora da entrada, sempre de hoje e nunca depois de agora; o servidor grava à parte quando você
   registrou, e as marcas continuam julgadas pelo relógio do servidor. (b) A entrada é sempre a hora do servidor; quem
   registra atrasado usa «Já fechada». (c) Como (a), mas no máximo 15 minutos antes de agora.
   *Recomendo (a):* é o que o protótipo mostra, o «Posso operar hoje? Na entrada:» passa a valer para a hora certa, e a
   honestidade das marcas não depende dessa hora.
2. **Como escolher entre registrar ao vivo e registrar uma operação já fechada?** O protótipo só troca pelo seletor de
   cenário. (a) Dois botões no topo do passo 1: «Aberta» e «Já fechada». (b) Um link «Já saiu? Registrar entrada e saída».
   *Recomendo (a):* fica visível no celular e não esconde o caminho mais usado.
3. **O que acontece quando você importa o arquivo da Top One ou da Ebinex com operações que já registrou no app?** Hoje
   elas entrariam de novo (duplicadas). (a) A importação reconhece a operação já registrada (mesma conta, ativo, lado e
   quantidade, entrada a até 2 minutos) e só completa o que falta, como a comissão; a prévia diz quantas já estavam
   registradas. (b) A importação pula os dias que já têm operações registradas. (c) Importa tudo.
   *Recomendo (a):* mantém as marcas e o «Posso operar hoje?» gravados ao vivo e traz a comissão para o limite líquido.
4. **Quais ativos de Futuros aparecem no Registrar?** (a) MES, MNQ e MGC, como no protótipo. (b) Também ES, NQ e GC.
   (c) Os 14 de futuros do catálogo. *Recomendo (b),* com o último que você usou já selecionado.
5. **Mais de 3 contratos?** O protótipo só tem 1, 2 e 3. (a) 1, 2, 3 e «Outro» com campo numérico. (b) Só campo numérico.
   *Recomendo (a).*
6. **Vencimento da Ebinex.** O protótipo conta os minutos a partir da entrada (1, 2, 5, 15 min). Na Ebinex a opção roda na
   vela seguinte: vence na abertura dessa vela mais a duração dela (como na importação). (a) Botões por vela («M1», «M5»,
   «M15») e vencimento pela regra da Ebinex. (b) Manter os minutos do protótipo. Quais velas você usa?
   *Recomendo (a)* na conta Ebinex; as outras corretoras de binárias ficam com os minutos.
7. **Payout já preenchido?** (a) O último payout que você usou nesse par, nesta conta. (b) Fixo por par, como no protótipo.
   (c) Vazio. *Recomendo (a),* vazio quando não houver.
8. **Preço de entrada sugerido.** O protótipo sugere «o último preço na tela», mas não há dado de mercado até a Fase 5.
   (a) Campo vazio até lá, sem a frase de sugestão. (b) Sugerir o preço da sua última operação nesse ativo.
   *Recomendo (a):* uma sugestão errada é pior que um campo vazio.
9. **Errei ao registrar: como corrigir?** As marcas e a entrada ao vivo ficam congeladas. (a) «Desfazer entrada» enquanto a
   operação está aberta e nos primeiros 15 minutos (apaga a operação e as marcas); depois disso, correções só no Diário
   (Fase 4), com histórico. (b) Nenhuma correção na Fase 3. (c) Anular a qualquer momento, com rastro.
   *Recomendo (a).*
10. **Onde ver as operações registradas antes do Diário (Fase 4)?** (a) Um bloco «Operações do dia» no `/diario`, com as
    abertas e as fechadas de hoje da conta, o plano e o clipe, que abre o Registrar. (b) Só dentro do Registrar (a lista de
    abertas). (c) A página antiga Operações. *Recomendo (a):* é por onde você volta para registrar a saída pelo celular.
11. **Conta sem regras salvas pode registrar?** (a) Não: o Registrar pede para definir a janela antes, com link para
    Personalizar (o «desde» precisa existir antes do primeiro registro ao vivo). (b) Sim, com o plano «—» (não avaliado).
    *Recomendo (a).* As suas duas contas e toda conta criada pelo app já têm regras.
12. **Imagens: converter no celular ou enviar como estão?** (a) Converter para WebP (ou JPEG, no navegador que não gera
    WebP), o que também apaga dados da foto como a localização, e enviar o original só se a conversão ficar maior.
    (b) Enviar o original. *Recomendo (a).* O limite de 10 MB vale para o arquivo que você escolhe, como no protótipo.
13. **Avisos de limite no Registrar.** O protótipo só mostra o limite quando ele já foi atingido. (a) Mostrar «Limite do dia
    US$ 320 de US$ 400» no topo do Registrar e, ao fechar uma operação, avisar quando o dia chegar ao limite (sempre) ou a 80%
    (se «Avisar ao chegar em 80% do limite do dia» estiver ligado). (b) Só o que o protótipo mostra.
    *Recomendo (a):* é a primeira fase em que o aviso dos 80% tem onde aparecer.
14. **Registrar nas contas de Forex, Ações, Cripto e B3.** Nenhum quadro desenha essas variantes, e telas novas passam antes
    pelo protótipo. (a) Desenhar uma variante única (Ativo, Quantidade, preços e o resultado digitado na moeda da conta),
    aprovar no canvas e construir na Fase 3. (b) Fase 3 só com Futuros e binárias; os mercados novos entram junto com a
    importação por colunas, logo depois. *Recomendo (a),* como você decidiu para a Fase 3, com o quadro aprovado antes do
    código.
15. **Mais de uma operação aberta ao mesmo tempo na mesma conta?** (a) Sim: o Registrar mostra a lista das abertas e
    deixa abrir outra. (b) Uma por conta. *Recomendo (a);* com uma só aberta, o Registrar já abre nela.
