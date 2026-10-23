# Phase 3 synthesis · Registrar operação: cut, order, contradictions resolved, defaults

Read-only synthesis of the five Phase 3 specs in this folder: `registrar.md` (the sheet), `banco.md` (M6a database),
`mercados.md` (Forex, Ações e opções, Cripto, B3), `legado.md` (what exists today) and `importacao_colunas.md` (Phase 3b).
Checked against the plan (`panel/v31/plano.md` row 3), the appendix (`panel/v31/apendice.md` §A, §B «Fase 3: M6a», §D,
§E), the decisions (`fase2/decisoes.md`, `mercados/decisoes.md`), the approved boards and the project memory
(`market-hub-initiative.md`). Spot checks in the repo at `4187a8c` (`feature/rebuild-lean` = `main`) and on the boards; nothing
was edited, the live Supabase was not called, no `.env` and no `docs/csv` row was read.

Markers: «…» = exact pt-BR; **NEW** = on no board; **ADAPTED** = a board or appendix element changed (reason given);
"RO l.N" = line of `market-hub/project/RegistrarOperacao.dc.html`. The owner-facing version of the questions is
`perguntas.md` (pt-BR).

---

## 0. Summary

1. **Core of Phase 3 = plan row 3, unchanged**: «Setup A/B/C, operação aberta, saída, marcas com horário do servidor. Avisos
   de janela e de limite. Variante Ebinex. 4 imagens e uma nota.» for the owner's Top One (futures) and Ebinex (binary)
   accounts, tested with «Registrar pelo celular. Às 11:05 aparece "Fora da sua janela". A 5ª imagem é recusada.»
2. **One gap the plan missed, and all five specs agree it belongs in Phase 3's database PR:** a trade registered in the app
   has no broker ID, so the next Top One or Ebinex file would insert it again and double the day in the US$ 400 limit. The
   import must recognise app trades and complete them (commission, ID) instead. The earlier answer «conta bruto até uma
   importação completar a comissão» already assumes this.
3. **New-market Registrar is already decided for Phase 3** (`mercados/decisoes.md` item 3) and **needs a board first** (item
   2). It becomes the last Phase 3 PR, after a canvas revision. How deep it goes is owner question 4.
4. **Order:** canvas revision ‖ 3-1 Banco ‖ 3-2 Domínio → 3-3 Telas (owner test) → 3-4 Mercados novos; then 3b (column
   import). Core 9–12 days (plan: 8–9; the difference is the reconciliation and the review additions D9, D34, D35); new
   markets +2.5 to +7.5 days depending on Q4 (review: aligned with `mercados.md` §7).
5. **37 contradictions resolved** (§3). **Four need the owner** (see "Open questions for the owner" at the end):
   typed entry time, file vs registered values, deleting a wrong registration, depth of the new-market forms. The
   Ebinex-expiry question raised by two specs is **closed by evidence for M1**: the Phase 1 survey found `Tempo` = M1 and
   `Vela` = entry minute + 1 in all 494 rows (`fase1/levantamento/parsers.md` l.21–23, 90–93), and the owner confirmed
   «Vela» = opening of the traded candle (memory, Phase 1). Two parts stay open as defaults: longer candles (C30) and the
   minute in which the app registers an order placed at seconds 50–59 (D35).

---

## 1. Recommended cut

### 1.1 In Phase 3, core (PRs 3-1 to 3-3)

| Element | Source | Note |
|---|---|---|
| Sheet «Registrar operação», 480 px on desktop, full screen on phones; live flow «Passo 1 de 3 · Entrada» → «Aberta» (binary «Vencida») → «Fechada»; «Passo 1 de 2 · Entrada e saída» → «Fechada» | RO l.247–248, l.1030–1032 | registrar.md §3–§9 |
| Mode choice «Como está a operação?» «Aberta» / «Já fechada» | **NEW** (registrar.md §4.1, Q2) | the board switches only in the prototype bar |
| Futures variant: «Ativo», «Lado», «Contratos», «Preço de entrada», «Hora (ET)», «Stop e alvo, em pontos · opcional» | RO l.263–284 | assets: §5 D5 |
| Ebinex variant: «Par», «Direção», «Expiração», «Stake, US$», «Payout, %», «Como terminou?» | RO l.287–297, l.354 | expiry by the Ebinex candle rule (§3 C30) |
| Gate at entry (window + limit, Phase 2 SQL), plan line «● fora da janela · depois do limite» + «Fora do plano, conferido pelo hub. Você pode registrar.», frozen in `trade_entry_context` | RO l.299, l.500–507 | «Ele nunca impede o registro: fora do plano, a operação só ganha a marca.» (RO l.651) |
| Marks setup / execução / emoção, one tap = one server-timed row; «antes da saída» / «depois do resultado» | RO l.302–319, l.529–549 | limpa rule §3 C2 |
| Warnings: limit-use line and exit banner | **NEW** (registrar.md §5.1 item 3, §11.4) | plan row 3 «Avisos de janela e de limite» |
| Switch «Avisar ao chegar em 80% do limite do dia» + «Com os limites atuais: {Top One US$ 320} de perda.» / «Nenhuma conta tem limite do dia.» in Personalizar › Preferências | approved 2b board `mercados/quadros/project/Personalizar.dc.html` l.690 and script l.2350; not built in Phase 2 (`fase2/levantamento/personalizar.md` l.66, l.869: «o do limite chega com o Registrar na Fase 3») | added in review: without it the 80 % banner of D9 can never be turned on (no screen writes `alerts.limit_80` today) |
| «Já fechada» for an earlier day («Dia») | **NEW** (D34) | added in review: no spec gave «Já fechada» a day, yet C29's copy sends older entries there |
| «Imagens e nota»: 4 PNG/JPG/WebP ≤ 10 MB, note ≤ 1.000, «Salvar imagens e nota» | RO l.390–417, l.812–1023 | private bucket, browser upload (§3 C6) |
| Import reconciliation (link, complete, undo-safe) and two NEW preview lines | banco.md §10, legado.md §3.3 | Q2 decides which values win |
| «Operações do dia» bridge on `/diario` + resume from the button | ADAPTED subset of `DiarioDezEnxuto` l.543–595 | until Phase 4 |
| Entry points: Diário header (primary), end of account creation, `/diario?registrar=1` (**NEW**), old dashboard CTA | RO l.226; ImportarConta 2b `fimConta`; `HeroSectionPT.tsx:44` | |
| Copy that says «… chega na Fase 3» / «… na Fase 3» | `components/hub/contas/copy.ts:124, 126-127, 361-362, 601` (legado.md §4) | D19 |
| API hardening on `trades`: no UPDATE, INSERT by column, live/server columns only through RPCs | legado.md §2.3, banco.md §11–§12 | |

### 1.2 In Phase 3, last PR (3-4), after the board revision is approved

New-market variants (Forex, Ações e opções, Cripto, B3) at the depth chosen in Q4; their rows in the shared instrument table;
`pnl_basis` and, with Q4 (a), the option columns (`option_right`, `strike`, `expires_on`, `multiplier`). Also the test the 2b
contract deferred to Phase 3 (`mercados/contrato_2b.md` l.409: «the test that the old dashboard and `/trades` survive them
belongs there»): the old dashboard and `/trades` render with a `stocks` and a `b3` row (3-4; 3b-1 under Q4 c). Until 3-4
ships, those accounts follow D36.

### 1.3 Not in Phase 3

- **Phase 5 (hidden, not shown as "off")**: «O que a tela diz agora:» / «Na tela, na entrada:», the state chip, «sua regra:
  …» (RO l.259, l.509–518), «Aguardar até 10:10 · bloqueio: ISM industrial» (RO l.504), plan marks «no bloqueio» and
  «contra a regra». The gate ⓘ is ADAPTED (D10).
- **Market data (Phase 5/8)**: «Sugestão: o último preço na tela. Ajuste ao da sua plataforma.» (RO l.270) and the prefilled
  prices: hidden, fields empty.
- **Phase 4**: the Diário day, calendar, mark editor in the drill, «Adicionar imagens ou nota» (DiarioDez l.583), «Você seguiu
  o seu texto?» (the table accepts `seguiu_texto`; no screen yet), the undo-import confirmation with counts.
- **Never (prototype only)**: «Cenário do protótipo:», «Recomeçar», «Simular 2 imagens», «Agora: 10:07 ET», «Avançar o relógio
  para 10:21», «só no protótipo», «exemplo» (registrar.md §22.10).
- **3b / 3b-4**: the column-mapping import (ImportarConta scenario 8); execution files.
- **Not modelled**: partial exits and scale-ins (one entry, one exit per trade; average prices), option spreads,
  exercise/assignment.

---

## 2. Order, PR split and effort

| Step | Content | Days | Depends on |
|---|---|---|---|
| A · Answers | `perguntas.md` | — | — |
| B · Canvas revision (update the existing canvas artifact, memory: «Update that canvas; do not create a new one») | Registrar scenarios for the new markets per Q4 (6 Forex, 7 Ações e opções, 8 Cripto, 9 B3 with (a); one generic + B3 with (b)); the visible NEW core bits: mode pills, limit line, exit banner, a scenario «operação aberta de antes» with the open-trade chooser, «Nova entrada» and «Desfazer entrada» (if Q3 a), «Outro» contracts, «Outro par»; account note «Contas de mercados diferentes nunca são somadas.»; exit-hour suffix by the account clock; added in review: the «Dia» control of «Já fechada» (D34), the Ebinex «Vence às …» line on step 1 (D35) and the «Operações do dia» bridge block on `/diario` (D16, D20) | 0.5–1 core + 1–1.5 (a) / 0.5–1 (b) | A |
| 3-1 · Banco | `20261020000001_trade_cycle.sql`, `…02_trade_images.sql`, `…03_trade_api.sql`, `…04_imports_and_live.sql` (banco.md §3–§12); `instrument_specs()` and `trade_caps_all()`; option columns and `pnl_basis` (nullable, so the owner pastes once); `supabase/tests/50_phase3.test.sql` (15 groups) + storage stub in `00_supabase_stub.sql`; paste kit `fase3/aplicar/` with pre-flight, backup schema, one transaction, conferência, undo, `testar.sh` scenarios | 3–4 | A (Q1–Q4: Q4 decides the option columns) |
| 3-2 · Domínio | `lib/domain/registro/` (Zod payloads from shared fixtures, `TRADE_CAPS`/`INSTRUMENT_SPEC` parity, `pnlFor`, `stopLevels`, `resultKnownAt`, `isClean`, `tradeMatchKey`, Ebinex expiry parity with `ebinexExit`), `tempo.ts` `localHmBefore` parity, `lib/hub/registrarDb.ts` + error codes in `RPC_ERROR_CODES`, the pt-BR number parser | 1.5–2 | A; parallel to 3-1 (as #18 ‖ #19 in Phase 2) |
| 3-3 · Telas (Futuros + Ebinex) | the sheet, marks, images and note, resume, bridge, header button, `fimConta` link, import preview lines, copy updates, old dashboard CTA; added in review: the 80 % switch in Personalizar › Preferências (D9), «Dia» in «Já fechada» (D34), the Ebinex expiry line (D35), the interim state of new-market accounts (D36), a `/trades` + dashboard render test with an open (`pending`) row; 375 / 768 / desktop, both themes, 44 px, keyboard | 4–5 | 3-1 pasted on the live DB, 3-2, B (core bits) |
| Owner test (Phase 3 core) | §6 | — | 3-3 |
| 3-4 · Mercados novos | variants of the approved board; rows of the instrument table; Diário-ready storage of units; the deferred 2b old-pages test (§1.2) | 4–6 (a) / 2–3 (b) / 0 (c) | B approved, 3-1 |
| 3b · Importação por colunas | importacao_colunas.md §9.3 (3b-1 Banco, 3b-2 Domínio, 3b-3 Telas, board revision) | 5–7 | Phase 3 approved |

- **Totals for Phase 3**: core (B core bits + 3-1 + 3-2 + 3-3) **9–12 days**; with new markets **14–19.5** (Q4 a),
  **11.5–16** (Q4 b), **9–12** (Q4 c, the new markets move to 3b). 3-1, 3-2 and B run in parallel, so calendar time is
  shorter than the sum.
- **Why more than the plan's 8–9**: the reconciliation with imports (+1–1.5, not in the plan or the appendix), the review
  additions (80 % switch, «Dia», Ebinex expiry line, about +0.5) and the new markets (decided in 2b, after the plan).
  Storage without a service key and a cron costs nothing extra (fewer pieces than the appendix's route + cron).
- **New-market figures (review)**: Q4 (a) = board 1–1.5 + code 4–6 = **+5–7.5**, the sum `mercados.md` §7 gives for these
  four forms (the first synthesis said +4–6 without a reason). Q4 (b) = board 0.5–1 + code 2–3 = **+2.5–4**: one shared
  typed-result form plus B3, below the 2b proposal's «+1–1.5 days per market» for four separate typed forms
  (`mercados/proposta.md` l.451).
- **Merges**: each PR into `feature/rebuild-lean`, merge order 3-1 → 3-2 → 3-3 → 3-4, only at the owner's request
  (memory); promoting to `main` only on request.
- **Rollout**: the owner pastes `fase3_aplicar.sql` after 3-1's review (as in Phases 1, 2, 2b), then a separate one-line
  paste adds to `hub_members` the same logins `HUB_USERS` holds (today his two: the trading user with the 629 trades and his
  personal login; D37), from the scratchpad only, never the repo. The pre-flight's rolled-back trial decides whether the
  three Storage policies go in the SQL file or through the Dashboard (banco.md §14.1).

---

## 3. Contradictions between the specs, resolved

| # | Topic | What the sources say | Resolution | Why |
|---|---|---|---|---|
| C1 | Entry time | Appendix §B: `entry_time = registered_at = now()`, frozen. Board: editable «Hora (ET)», ≤ now («A entrada não pode ser depois de agora (10:07 ET).», RO l.602), label «Posso operar hoje? Na entrada:» (RO l.650). registrar Q1 (a): any time today; banco Q4 (a): ≤ 15 min back; legado G5: typed only in «Já fechada» | **Owner Q1.** Default: typed, ≤ 15 min back; `registered_at` always the server's; the gate is evaluated at the typed instant | two approved artefacts disagree; the import match window (C12) depends on it; on Ebinex the typed minute also fixes the expiry (D35), so (b) would make it a minute late whenever the registration crosses the minute |
| C2 | When a mark is «limpa» | Appendix: `source = 'live' and marked_at < exit_registered_at`. Board `antesDe` (RO l.541–544): made while open and before the typed exit or the binary expiry. registrar: `least(exit_registered_at, exit_time)`; legado: expiry for binaries, else `exit_registered_at`; banco: context `origin = 'live'` and `marked_at < least(exit_time, expires_at, exit_registered_at)` | **banco.md §3.3** | it is exactly the board rule; "live" read from the context row, which the API cannot create |
| C3 | Where the binary expiry lives | registrar: in `exit_time` at entry; banco: new `expires_at`, `exit_time` set at «Registrar resultado» | **`expires_at`** (NEW column); `exit_time = expires_at` when the result is registered | an open trade keeps `exit_time` null (banco's open-shape check); one rule for all markets |
| C4 | `result` while open | registrar §18: null, «never `pending`»; legado §1.2 and banco `trades_open_shape`: `'pending'` | **`result = 'pending'`, `pnl` null** | the old pages map a null result to a loss (`TradesV1Professional.tsx:27`, `AnalyticsV1Professional.tsx:35`); `limit_usage` skips `pending` |
| C5 | Time of stop and target | legado G10: new `levels_at`; banco: `registered_at` | **no new column** | stop/target are written only at registration and frozen; the Diário's «stop 11 · alvo 22 pts · às 10:05» reads `registered_at` |
| C6 | Image upload path | Appendix + registrar §12.5: `POST /api/trades/[id]/anexos`, signed URL, Saturday cron. banco §9 + legado §5: browser upload with the user's JWT under a Storage policy tied to a reservation; trash queue drained by the browser | **banco.md §9** | no service-role key exists (`.env.example`), no cron exists (`vercel.json` removed in Phase 0), no Vercel 4.5 MB limit, no new route in `routesRequireAuth.test.ts` |
| C7 | Who may upload | registrar: the route's `denyHubAccess` (`HUB_USERS`); banco Q6 (a): `hub_members` table + 500 MB per user | **`hub_members` + 500 MB** (default) | sign-up is open and the free project has 1 GB; no new secret. Drift risk: the list is kept by hand next to `HUB_USERS`. This departs from the letter of `CLAUDE.md` («Anything that costs money … goes through API routes that also check HUB_USERS»), so 3-1 also updates `CLAUDE.md` › Auth and access to name `hub_members` as the database-side list for Storage (D37) |
| C8 | Saving the note | registrar: `save_trade_note`; banco: `save_extras` (note + images) | **`save_extras`** | the board saves both with one button and one time: «2 imagens e nota salvas às 10:21.» (RO l.905–912) |
| C9 | Attachment name length | registrar `file_name ≤ 200`; banco `name ≤ 120` | **120**, shortened in the browser in the middle, keeping the extension (NEW behaviour) | names are display-only |
| C10 | Stale reservations | Appendix: Saturday cron; banco: swept on reserve, save and load | **banco** | no cron infrastructure |
| C11 | Image paths on import undo | legado G12: `import_undo` returns `{"deleted", "paths"}` (changes the pinned `20_phase1.test.sql:272`); banco: answer unchanged, a delete trigger queues paths in `trade_image_trash` | **banco** | keeps the pinned answer; one deletion path for every cause |
| C12 | Import match window | importacao §8.3 and registrar Q3: ±2 min; legado L5: a few minutes before `registered_at`; banco §10.2: app `entry_time ∈ [file − 2 min, file + 16 min]` | **banco** | covers a live entry left at "now" and registered up to 15 min after the fill (C1) |
| C13 | Ambiguous match | banco Q3: left out with line code `ambiguous_registered`; legado Q1 note: imported as new and said so | **REVISED in review: one-to-one assignment, no row left out.** Candidate pairs as C12 (same account, symbol root, direction, quantity or stake, entry window); ordered by: binary `expires_at` equal to the file's exit first, then the smallest entry gap, then entry time and id; assigned greedily, each app trade and each file row at most once. Unassigned rows are inserted; unassigned app trades stay as registered. No `rows_ambiguous` counter and no `ambiguous_registered` code; the preview counts `linked` | banco's rule (link only a mutual single candidate, else leave the row out) fails the owner's Ebinex sessions: 612 Ebinex trades over about 3–4 months (memory), all M1, inside a one-hour window, is several a day on average, so trades of the same pair, direction and stake within minutes of each other are to be expected, and many rows would be left out, including trades he never registered, and with no review queue (Phase 1: «imports go straight in») nothing brings them back. A one-to-one match never duplicates (each app trade absorbs at most one row) and never drops a row; the worst case, two look-alike trades swapped, keeps both trades and the day's count; the expiry key makes binaries exact when D35 holds |
| C14 | File vs registered values | banco Q2 (a): the file corrects prices, quantity, result; legado Q1 (a), registrar Q3 (a), importacao §8.3: the file only completes what is missing | **Owner Q2.** Default: the file corrects money; times, marks, stop/target and the gate at entry never change | a product choice about which numbers the Análises count |
| C15 | Undo of a batch that linked app trades | banco §10.4: reverts exactly what the batch wrote (reopens a trade the file closed), never deletes the app trade; legado Q2 (a) and importacao §8.3: filled fields stay | **banco** | with Q2 (a) a wrong file would otherwise change registered trades for good; with Q2 (b) the same mechanism reverts only commission and ID |
| C16 | Broker's own times on a linked trade | legado L1: store them in new columns (never `source_local_*`); banco: times never written on an app trade | **`entry_time` stays frozen; the link row records the file's instants** (`trade_import_links.file_entry_at`, `file_exit_at`, NEW) | Phase 4/7 can show a gap between the typed and the broker's time; `import_fix_tz` can never move an app trade |
| C17 | `rule_version_id` on imported trades | importacao §8.1: `import_commit` stores it; banco §7: not stored, computed on read | **not stored** | an imported `entry_time` can move with `import_fix_tz`; versions are append-only, so `rule_version_at()` on read is stable; gate.md GG13 «recalculado» |
| C18 | Account without rules | registrar Q11 and banco Q5: refuse (`no_rules`); legado Q4: allow, label «Sem regras na entrada»; personalizar.md P12: "refuses nothing but shows 'Salve as regras desta conta'"; mercados §3.8: every new-market account has no version | **Refuse only when no version exists**; a v1 without a window registers, with the window «não avaliado», «Sem janela salva» + «Definir» (`possoLinha`) and plan «—» | as built, account creation saves v1 whenever the rules form loaded (`ImportSheet.tsx` `saveFirstVersion`, l.361–376, l.409–417), new markets included, so mercados §3.8's case is only a failed save; appendix §E «para que a primeira operação ao vivo já tenha versão de regra e "desde"»; a live trade never lands in «Histórico importado · só resultado» |
| C19 | Instrument table | banco: `instrument_specs()` with tick and point for six futures roots; mercados §5: full per-instrument spec; importacao §8.4: `pnlFromPrices` | **one table**, `instrument_specs()` in SQL + `INSTRUMENT_SPEC` in TS with a parity test (the `market_caps_all()`/`MARKET_SPEC` pattern), shipped in 3-1, reused by 3b | Registrar and «Resultado (ou os preços)» must agree |
| C20 | `asset_type` | banco: market default (B3 → `b3`) unless catalogued; mercados: per instrument (WIN `futures`, PETR4 `stock`, `forex`/`cfd`, `option`); importacao: one per market | **instrument's value when the table knows the root, else the market default**, same function for Registrar and 3b | one vocabulary for the Análises |
| C21 | Symbol root | legado: store a root; banco: `trade_match_key()` function; mercados: either | **function**; Registrar stores the root it offers (MES), files keep their contract code (MESM6) | no stored column to keep in sync |
| C22 | Futures offered | registrar Q4: MES, MNQ, MGC + ES, NQ, GC; mercados Q11: + CL, MCL computed, the rest typed by search; banco: six | **six in 3-3**; CL/MCL and search come with 3-4 under Q4 (a) | the owner trades micros; adding a root is one row |
| C23 | Idempotency key | registrar: the client sends the trade id (`p_client_id`); banco: `client_key` column, unique per user | **`client_key`**, generated with `crypto.getRandomValues` | `crypto.randomUUID` needs a secure context, and a phone test over LAN http is not one |
| C24 | Source of the entry preview | registrar §5.1: `rules_now` for now, `gate_at` debounced for a typed hour; banco: `register_entry(…, dry_run)` | **`rules_now` for the "now" line** (the cached query the card uses; one read is pinned by `PossoOperarHoje.test.tsx:754`); **`register_entry` dry run** for a typed hour and before submit | the dry run also returns the plan, `similar` and field codes |
| C25 | Sheet provider | registrar: generalise `ImportSheetProvider`; legado: a sibling provider | **one hub sheet provider with two modes** | one sheet at a time; the import's end screen hands over to Registrar |
| C26 | Reaching an open trade before Phase 4 | registrar Q10 (a): «Operações do dia» block (open + registered today); legado Q3 (c): the button resumes + «Abertas agora» | **both**: the button resumes (one open) or lists (several), and registrar's block | the block is a superset of «Abertas agora» |
| C27 | Old page deleting app trades | banco Q1 (a): allowed and logged; legado Q5 (a): refused | **Owner Q3** | evidence vs cleaning test trades |
| C28 | «Desfazer entrada» vs append-only marks | registrar Q9 vs banco §4.2 | **compatible**: deleting the trade cascades its marks and context (the guard allows a delete once the parent is gone, verified on banco's throwaway cluster) and logs `trade_deletions` | — |
| C29 | Lower-bound error copy | registrar `too_old` «A entrada precisa ser de hoje. Para uma operação antiga, use “Já fechada”.»; banco `entry_too_old` (15 min) | **copy follows Q1**; default «A entrada ao vivo pode ser de até 15 minutos atrás. Para uma mais antiga, use “Já fechada”.» (NEW) | — |
| C30 | Ebinex expiry formula | Board: entry + minutes (RO l.761 «Vence às 20:12 de Brasília.»). registrar Q6 / banco Q8: the next candle. banco §3.6: `date_trunc('minute', entry) + 1 min + duration`; `ebinexExit` (`lib/domain/import/ebinex.ts:59`): candle opening = first «Vela» minute after the entry minute, within one candle | **Ebinex = next candle** (closed by evidence, §0 item 5). M1: next minute + 1 min (proven on 494/494 rows); longer candles: next opening on the candle's own grid, marked unverified and checked the first time he uses one; SQL ↔ `ebinexExit` parity test | banco's formula equals `ebinexExit` only for M1; other binary platforms keep entry + duration |
| C31 | DB test file numbers | banco `50_phase3.test.sql`; importacao `50_mapping.test.sql` | **3b uses `60_mapping.test.sql`** | `run.sh` runs files in order |
| C32 | Where new-market columns go | banco §3.8: in `20261020000001` if Phase 3 ships those forms; mercados §5: new columns | **in 3-1** (nullable, unused until 3-4) | one paste for the owner |
| C33 | Commission field | mercados Q3 (c) offers one on the futures form; board: none | **none on futures** (board kept); optional «Custos · opcional» on the new markets with Q4 (a) | the owner decided a live trade counts gross until an import completes the commission |
| C34 | «Corrigir» link on computed results | mercados Q1 (a): on the new markets, and asks about futures | **new markets only** (with Q4 a); futures are corrected by the file (Q2 a) | the futures board has no such control |
| C35 | Account note | RO l.235 «Futuros e binárias nunca são somados.»; 2b «Contas de mercados diferentes nunca são somadas.» | **2b string** (approved) | superseded |
| C36 | Header button style | RO l.226 `btn pri`; DiarioDezEnxuto l.223 `btn` | **primary** (ADAPTED) | the live path on the phone |
| C37 | Exit-hour label | RO l.662, l.757 hard-code «Hora da saída (ET)» | **suffix by the account's window clock** (ADAPTED): «Hora da saída (Brasília)» on Ebinex, Cripto, B3 | — |

---

## 4. Decisions already covered by earlier answers

| Topic | Earlier answer (exact where quoted) | Source | What it settles in Phase 3 |
|---|---|---|---|
| New-market trades | «Operações nas contas novas: «Registrar operação» na Fase 3 e, logo depois, a importação por colunas (cenário 8 do protótipo).» | `mercados/decisoes.md` item 3 | 3-4 is in Phase 3; 3b comes right after |
| Boards first | «Telas novas passam ANTES pelo protótipo (canvas) para aprovação.» | `mercados/decisoes.md` item 2 | step B before 3-4 |
| Version at entry | «Operações (inclusive importadas) depois do "desde" são julgadas pela versão em vigor na entrada.» | `fase2/decisoes.md`, defaults | `rule_version_id = rule_version_at(account, entry_time)`, frozen; imports computed on read (C17) |
| Not evaluated ≠ ok | «"Não avaliado" ≠ "ok": verificação não feita nunca vira false.» | `fase2/decisoes.md`, defaults | null columns in `trade_entry_context`; plan «—», never «No plano» |
| Warning modes | «"Só avisar" (limite) / "Liberado, com aviso" (janela): a operação continua marcada fora do plano; o modo muda só o que a tela diz.» | `fase2/decisoes.md`, defaults | the break is stored; `warnings` records the mode |
| Net limit, worst point, commission | «resultado LÍQUIDO (pnl − comissão quando a comissão é conhecida; operação sem comissão conta bruto até uma importação completar a comissão)» | `fase2/decisoes.md`, owner 2 | live futures `commission` null; reconciliation completes it; `day_worst_at_entry` stored |
| Limit scope | «Limite US$ 400 só na Top One, por conta … Ebinex sem limite por enquanto.» | `fase2/decisoes.md`, owner 3 | no limit line on Ebinex |
| Where «Posso operar hoje?» lives | card at the top of `/diario` | `fase2/decisoes.md`, owner 5 | the bridge block goes under the card and shares its `rules_now` read |
| 80 % warning | «Avisos (80% do limite, 10 min antes do bloqueio): só a preferência na Fase 2.» + plan row 3 «Avisos de janela e de limite» | `fase2/decisoes.md`; `plano.md` | Phase 3 shows the 80 % exit warning when that preference is on, and builds the approved switch that turns it on (no screen writes `alerts.limit_80` today; D9); the 10-minute block and state-change warnings wait for Phase 5 |
| Rules in new markets | «regras novas = janela + limite (bloqueio e regra por estado só Futuros até a Fase 5)» | `mercados/decisoes.md`, defaults | no block or state line in the new-market forms; gate ⓘ without the block |
| Currency and day turns | «moeda B3 em reais, demais em dólar (USDT = dólar); dia vira Forex 17:00 NY, Ações/opções EUA 20:00 NY, B3 meia-noite Brasília»; «Cripto: o dia vira à meia-noite de Brasília.» | `mercados/decisoes.md` | `pnl` gross in the account currency; labels «US$» / «R$» |
| Ebinex candle | «Ebinex "Vela" = opening of the traded candle (exit = Vela + Tempo)»; all 494 rows M1 with Vela = entry minute + 1 | memory (Phase 1); `fase1/levantamento/parsers.md` | registrar Q6 / banco Q8 closed (C30) |
| Undo an import | «undoing an import also deletes that batch's marks» | memory (Phase 1) | applies to the batch's own trades; an app trade is never deleted by an undo |
| No review queue | «imports go straight in (no review queue)» | memory (Phase 1) | every file row goes in, either linked to one app trade or inserted; none is left out or queued (C13, revised in review) |
| Marks and «limpa» | the app records every mark's time; marks before the exit are «limpas», after the result capped at «Pouco fundamentada»; quick Setup A/B/C at entry | memory (2026-10-15) | the limpa rule and append-only marks |
| Images and note | up to 4 PNG/JPG/WebP of 10 MB, note 1.000, never in calculations, Padrões or the AI | memory (2026-10-16); RO l.392 | storage limits and isolation |
| Registrar board approved | «pode seguir para a próxima etapa» after testing images and note | memory (2026-10-16) | the five scenarios are the spec; departures are marked ADAPTED/NEW |
| Times from the database | «Os horários vêm do banco e não podem ser editados.» | `plano.md` §6 Riscos | forced `registered_at`, `exit_registered_at`, `marked_at`; the freeze |
| SQL pasted by the owner | he prefers pasting SQL in the SQL Editor over linking the CLI | memory (Phase 1) | the paste kit format of Phases 1–2b |
| Stop/target in the data | the Top One reader stores `SL`/`TP` as prices | as built (`lib/domain/import/topone.ts`) | Registrar converts points to prices (legado Q7 closed) |
| No «A revisar» account | the live DB has no trade without `market_type` | memory (Phase 1) | nothing to build |
| Playwright | «Usa Playwright, só com o seu OK» | `apendice.md` §D | end-to-end stays optional |
| Paid / third-party calls | `HUB_USERS` on API routes that cost money or reach a third party | `CLAUDE.md` | Phase 3 adds no API route; Storage access is limited by `hub_members`, a documented departure from the rule's wording that 3-1 writes into `CLAUDE.md` (C7, D37) |

---

## 5. Accepted defaults (proposed)

### 5.1 Screens (3-3)

- **D1 Entry points.** «Registrar operação» primary in the Diário header, before «Importar arquivo» (C36); opens on the selector's
  current account; hidden while accounts load and in the empty state. End of account creation: the board's link (primary
  when the platform has no history, e.g. IQ Option, or the market has no reader). The 2b board's «Como as operações
  chegam?» «Enviar arquivo» / «Registrar à mão» / «Conectar · Em breve» step (ImportarConta 2b l.467–471, `maoPrimeiro`
  l.1091) was not built in 2b (no match in `app/`) and stays out: the end screen's link covers it (review correction: the
  first draft cited it as if it existed). `/diario?registrar=1` (NEW), same pattern as
  `?importar=1`, so the owner can save a phone home-screen shortcut. The old dashboard's «Adicionar novas operações»
  (`HeroSectionPT.tsx:44`) points there (legado Q6 a; update `HeroSection.test.tsx:102-109`).
- **D2 Mode.** «Como está a operação?» «Aberta» / «Já fechada» (NEW) at the top of step 1, default «Aberta».
- **D3 Open trades.** Several per account allowed (registrar Q15 a). One open → the sheet opens on it with «Nova entrada»
  (NEW); several → chooser «Operações abertas» (NEW) with rows «MES · Compra · 2 ct · desde 10:07 ET» (NEW «desde …»).
  Closed elsewhere → «Esta operação já foi fechada em outro lugar.» (NEW).
- **D4 Account inside the sheet.** The account chip opens the selector list when there is more than one active account (NEW;
  step 1 only).
- **D5 Futures fields.** MES, MNQ, MGC, ES, NQ, GC; last used preselected; «Contratos» «1» «2» «3» + «Outro» (NEW field);
  price empty (no suggestion); stop/target typed in points, stored as prices, NEW error «Use pontos de 0,25 em 0,25 no MES.»
- **D6 Ebinex fields.** Board pills «1 min» «2 min» «5 min» «15 min» kept; expiry by the next-candle rule, shown by the board's
  «Vence às 20:12 de Brasília.» (also on step 1, D35); payout prefilled with the last one used for that pair in the account
  (registrar Q7 a); pairs from the account's history in the file's spelling + «Outro par» (NEW).
- **D7 Results.** Computed by the server (futures: points × point value × contracts; Ebinex: «Ganho» stake × payout, «Perda»
  −stake, «Devolvida» 0); the browser shows the same preview with the board strings.
- **D8 Gate line.** As the board (RO l.500–507), with the Phase 2 words for warnings and «Sem regra ativa» (ADAPTED from
  `possoLinha`); «Posso operar hoje? Não foi possível conferir agora.» (NEW) if `rules_now` fails, never «Liberado».
- **D9 Limit and exit warnings.** «Limite do dia US$ 320 de US$ 400» (NEW, from `possoLinha().limite`) on accounts with a
  limit; after an exit: «Limite do dia atingido às 10:38: −US$ 415,50 de US$ 400. Pelas suas regras, o dia está
  encerrado.» / «… Pelas suas regras, é só um aviso.» (always) and «Você chegou a 80% do limite do dia: −US$ 320 de US$
  400.» (only with the Phase 2 preference on) (NEW, registrar §11.4). The preference has no screen today (Phase 2 built
  only Tema and Horários; `alerts.limit_80` is accepted by `merge_preferences` but nothing writes it), so 3-3 builds the
  approved switch in Personalizar › Preferências: «Avisar ao chegar em 80% do limite do dia», sub «Com os limites atuais:
  {Top One US$ 320} de perda.» / «Nenhuma conta tem limite do dia.» (2b Personalizar board l.690, script l.2350), default
  off (`fase2/levantamento/personalizar.md` l.531). Its two Phase 5 siblings («Avisar quando um ativo mudar de estado»,
  «Avisar 10 minutos antes de um bloqueio») stay out.
- **D10 Gate ⓘ.** ADAPTED: «Calculado pelas regras desta conta, na hora da entrada: janela e limite do dia (o bloqueio de dados
  fica ativo na Fase 5). Ele nunca impede o registro: fora do plano, a operação só ganha a marca.»; new markets without the
  parenthesis.
- **D11 «Conferidos».** «Conferidos: janela e limite.» / «Conferidos: janela.» under the plan pill (NEW, `conferidos()`).
- **D12 Closing.** «Fechar sem salvar?» / «Fechar» / «Continuar aqui» on steps 1 and 3 with unsaved input (NEW, Phase 1
  strings); step 2 closes at once (the trade stays open on the server).
- **D13 Phones.** Sticky footer ≤ 640 px with the safe-area inset (NEW); inputs and textarea at 16 px (ADAPTED: iOS zooms
  below that); 44 px targets; checks at 320, 375, 768, 1280 in both themes.
- **D14 Offline and retries.** Nothing is queued: «Sem conexão. Nada foi registrado: o horário vem do servidor. Tente de novo
  quando a conexão voltar.» (NEW); typed data kept in memory and `sessionStorage` per account; idempotent retries (C23).
- **D15 Clock.** Everything shown or prefilled uses the server clock (`server_now` + elapsed), never `useAgora` or
  `formatWhen` (device clock, legado §4).
- **D16 Bridge on `/diario`.** «Operações do dia» (ADAPTED, board name) between the card and the placeholder: open rows «10:07 ·
  MES · Compra · 2 ct · aberta» (NEW «aberta») + «Registrar saída»; closed rows with result, clip and plan pill; empty
  «Nenhuma operação registrada hoje.» (NEW). Built directly (a subset of the approved table), replaced in Phase 4.
- **D17 Images UI.** Picker without `capture`; HEIC from «Arquivos» refused with «Só imagens PNG, JPG ou WebP.»; per-image
  progress «Enviando 1 de 2…» and «Não foi possível enviar {nome}.» (NEW).
- **D18 Account with no version.** «Esta conta ainda não tem regras salvas. Defina a janela antes de registrar.» + «Definir em
  Personalizar» (NEW), C18. Personalizar's «Até salvar, as operações ficam em “Histórico importado · só resultado”.»
  (`components/hub/personalizar/copy.ts:365`, flagged in the 2b summary «Vale rever na Fase 3») becomes «Até salvar, as
  operações importadas ficam em “Histórico importado · só resultado”, e o “Registrar operação” pede as regras antes.»
  (ADAPTED).
- **D19 Copy that changes.** «Ainda não lemos arquivos {de}: as operações (desta conta) entram pelo “Registrar operação”, na
  Fase 3.» → drop «, na Fase 3» once the market has its variant; `FIM_CONTA.semLeitor` → «Nada ainda. Registre a primeira
  operação.» (the approved IQ Option wording); `CONTAS.info` → «… entram pelo “Registrar operação” e, em breve, também por um
  CSV em que você diz o que é cada coluna. …» (all ADAPTED; legado §4, registrar §19).
- **D20 Board touch.** The visible NEW bits of D2, D3, D5, D6, D9, D34, D35 (and Q3's «Desfazer entrada») and the D16
  bridge block are drawn in step B with the new-market scenarios, for one approval (review: the bridge is a new block on
  `/diario`, so «Telas novas passam ANTES pelo protótipo» applies; it costs little to draw); errors, loading and offline
  are built directly (Phase 1 precedent: «Editar conta» and «Importações» built and reviewed in the app).

### 5.2 Database (3-1)

- **D21 `trades`.** New columns `status`, `registered_at`, `exit_registered_at`, `rule_version_id`, `client_key`,
  `expires_at`, `pnl_basis`, and the option columns if Q4 (a); existing rows read `closed` and nulls; nothing backfilled.
- **D22 "Registered in the app"** = has a `trade_entry_context` row (only the register RPCs create one).
- **D23 Server time and freeze** as banco.md §4: forced times on every insert; identity, account, source, version, entry time,
  symbol, direction, stop/target frozen; exit frozen once the app registered it; money writable only by server functions.
- **D24 API privileges.** `authenticated`: SELECT, DELETE, INSERT on the old writers' columns (banco.md §11); no UPDATE,
  TRUNCATE, REFERENCES, TRIGGER; `anon` nothing; a privilege conference block in the migration.
- **D25 RPCs.** `register_entry`, `register_exit`, `register_after`, `add_marks`, `image_slots`, `save_extras`,
  `image_trash_done`; `SECURITY DEFINER`, codes only, never values (a CHECK failure prints the row, verified by banco).
- **D26 `trade_entry_context`** as banco.md §3.2 (frozen `gate` jsonb, `warnings`, `day_worst_at_entry`); Phase 5 fields
  later by a nullable ALTER.
- **D27 Marks.** Append-only; null = «desmarcar»; values stored as ASCII codes; `seguiu_texto` accepted; ≤ 100 per trade.
- **D28 Commission.** Futures null (unknown), Ebinex `0.00` (as the reader).
- **D29 Imports.** Classification of banco.md §10.1 with its rows 4–5 replaced by the one-to-one assignment of C13 (revised
  in review); link and complete (C12–C16); `import_fix_tz` and `import_tz_status` only touch `source = 'import'`; a batch
  with only links is kept so it can be undone. NEW preview lines: «{n} já registradas por você: o arquivo completa a
  comissão.» and, with Q2 (a), «{n} com preço ou resultado diferente: vale o do arquivo.» (with Q2 b: «{n} com preço ou
  resultado diferente do registrado.») (built directly, reviewed in the app). The first draft's «{n} parecem com operações
  registradas e ficaram de fora.» is dropped (no row is left out). banco.md §13 group 13 changes accordingly: two live trades
  in the window and one row → linked to the nearest, the other stays; plus an Ebinex-like burst (5 rows of one pair,
  direction and stake within 10 min, 3 of them registered) → 3 linked, 2 inserted, 0 left out.
- **D30 «Já fechada» of a trade already imported.** «Esta operação parece já ter vindo do arquivo» (NEW) and a confirmation
  (banco Q7 a).
- **D31 Deletion log.** Deleting an app-registered trade anywhere writes `trade_deletions` (times only) and queues its images.
- **D32 Migration proof and kit.** No existing trade, version, day, account, batch or profile changes (the migration's last
  statement stops it otherwise); kit as banco.md §14, including `desfazer_fase3.sql` that refuses once real data exists.

### 5.3 Images (3-1, 3-3)

- **D33** Private bucket `trade-images`, path `{user}/{trade}/{attachment}.{ext}`, 10 MiB, PNG/JPEG/WebP; four per trade enforced
  at reservation, by the Storage policy and at commit; browser re-encodes to WebP (JPEG where WebP encoding is missing,
  original if smaller); signed read URLs for thumbnails; `hub_members` + 500 MB. Review corrections: (1) the "original if
  smaller" exception applies only to PNG and WebP; a JPEG is never uploaded as chosen: it is re-encoded, or, when that
  fails or grows the file, its APP1/APP13 metadata segments (EXIF, GPS) are stripped from the bytes; otherwise the promise
  that the photo's location is dropped (`perguntas.md`) would not hold for camera photos. (2) Signed read URLs are created
  when a thumbnail is shown and live 10 minutes, not banco's 3 600 s: anyone holding the link can open the image, and the
  board's own tip says broker screenshots may show the account number. (3) The 500 MB quota counts what the browser
  declares at reservation, so it is a guard against mistakes; `hub_members` is the real gate.

### 5.4 New markets (3-4), if Q4 = (a)

mercados.md recommendations taken as defaults: result computed when exact, typed when not, «Corrigir» on computed results
(Q1 a); swap and funding inside the typed or corrected result, hint «com swap ou funding, se houver» (Q2 a); «Custos, US$ ·
opcional» / «Custos, R$ · opcional» (Q3 a); single-leg options on catalog stocks/ETFs + SPX, XSP, NDX, RUT, VIX, «Venceu sem
valor» (Q4 a); the 16 catalog pairs + «Usar “x”» with a typed result (Q5 a); coin quantity, USDT/USDC/USD (Q6 a); WIN, WDO,
IND, DOL chips computed in R$, the 56 stocks/ETFs by search, DI1 typed (Q7 a); symbols outside the catalog allowed (Q8 a);
stop units: points (B3 futures), pips (forex pairs), prices elsewhere (Q9 a); four scenarios (Q10 a); futures add CL and MCL
computed, the rest typed by search (Q11 a). With Q4 (b): one generic form, result always typed with the price calculation
as a hint, options by name, two scenarios.

### 5.5 Added in review (D34–D38)

- **D34 «Já fechada» on an earlier day.** No spec gave «Já fechada» a day: registrar §6 has only hours, banco's
  `register_after` takes `day`, and C29's copy sends anything older than 15 minutes to «Já fechada». Default: a «Dia» control
  (NEW) at the top of «Entrada e saída», pills «Hoje» / «Ontem» + a date field, prefilled «Hoje»; any trading day from the
  account's «desde» (v1) to today. A day before «desde» is refused (`before_rules`, banco §6.2 step 4) with NEW copy «Antes
  de {14 out} esta conta não tinha regras: essas operações entram pelo arquivo da corretora.» (for new-market accounts
  before 3b, the end of the sentence is «… entram pela importação por colunas, logo depois da Fase 3.»). The `similar` check
  (D30) covers the day chosen. Drawn in step B.
- **D35 Ebinex: the minute the order was placed.** The Phase 1 survey shows his orders placed at seconds 50–59 of the minute
  (`parsers.md`: «never `:00` (494/494), … the most in 50–59»), so a registration a few seconds later often lands in the next
  minute. With «Hora (Brasília)» following the clock, the next-candle rule would then give an expiry one minute late:
  «Ainda não venceu» holds the result a minute too long and marks made in that minute count as «limpa» although the result
  was known. Default: on the Ebinex variant, step 1 shows the board's «Vence às {20:12} de Brasília.» under «Expiração»,
  computed live from the hour field, so he sees it before «Registrar entrada» and can set the hour back one minute (allowed
  by Q1 a); the owner test checks it against Ebinex on the first registrations. Under Q1 (b) (no hour field) this check is
  impossible, which `perguntas.md` Q1 now says.
- **D36 New-market accounts while 3-4 is not merged.** 3-3 ships first and is tested alone: on Forex, Ações e opções, Cripto
  and B3 accounts «Registrar operação» is not shown (the sheet has no variant for them yet), and the four «… na Fase 3» strings
  (`contas/copy.ts:124, 127, 362, 601`) stay until 3-4 merges. With Q4 (c) they change in 3-3 to name the column import
  instead (ADAPTED, wording reviewed in the app).
- **D37 `hub_members` mirrors `HUB_USERS`.** Both logins in `HUB_USERS` today (the trading user and his personal login) get a
  row, so an image upload never fails for a user the hub lets in; 3-1 adds one line to `CLAUDE.md` › Auth and access:
  Storage uploads are limited by the `hub_members` table, kept equal to `HUB_USERS` by hand.
- **D38 Old pages with Phase 3 rows.** 3-3 adds a render test of `/trades` and the old dashboard with an open (`pending`)
  live trade; 3-4 (or 3b-1 under Q4 c) adds the 2b-deferred one with `stocks` and `b3` rows (§1.2).

---

## 6. The owner test, run without polluting the journal

- **«Registrar pelo celular»**: register real trades in the real windows (Top One 10:00–11:00 ET, Ebinex 20:00–21:00
  Brasília). They are real data and stay. The phone reaches the app over the LAN dev server, as in Phase 0, or through a
  production deploy if he asks to promote; over LAN http, C23 matters. Production answers 404 on every page until PR #26
  (`fix/vercel-nextjs`, commit `2139118`, not on `main` at review time) is merged and promoted (memory, 2026-10-18), so
  today the phone test needs the LAN, at home, with the Mac serving. On Ebinex, the first registrations also check «Vence
  às …» against the platform (D35).
- **«Às 11:05 aparece "Fora da sua janela"»**: open the sheet at 11:05 ET on Top One: «Posso operar hoje? Fora da sua janela ·
  10:00–11:00 ET» and the plan line show **before** registering (the dry run). No trade is needed. If he registers anyway,
  Q3 decides how it goes away.
- **«A 5ª imagem é recusada»**: on any closed trade, choose a fifth image: «Até 4 imagens por operação.» (RO l.815); also
  checked by the database tests.
- **Added (NEW, proposed for the plan row)**: after a day with registered trades, import that day's Top One file: the preview
  says «{n} já registradas por você…», nothing is duplicated, the limit does not double; undo the batch: the registered trades
  stay.
- A test account (e.g. «Apex #1», created in the Phase 2 test) is an alternative for throwaway trades, if its window is also
  10:00–11:00 ET.

---

## 7. Risks and checks carried into the build

- **Storage policies from the SQL Editor** may be refused on the hosted project, and `postgres` may not read
  `storage.objects` (needed by `save_extras`): both are in the pre-flight; if the read is refused, stop and redesign the
  commit check before 3-3.
- **Postgres version**: banco's prototype ran on PG 15; CI runs `postgres:17` and the live project is 17.6. `50_phase3` must
  pass in CI before the paste.
- **Secure context**: `crypto.randomUUID` is unavailable over LAN http (C23).
- **iPhone**: WebP encoding may be missing (check the blob type, fall back to JPEG); HEIC through «Arquivos».
- **DST edge**: on the March change, a typed 02:00–02:59 ET entry resolves to the previous day (banco §6.7); documented.
- **Free plan storage**: 1 GB for the project (D33 quota).
- **Old pages**: open trades count in their win rate; `AccountBalanceDisplay` sums by market across accounts; the 1 000-row cut
  (known since Phase 2). Accepted until Phase 4/9. Review precision on C4: `result = 'pending'` keeps `/analytics` from
  counting an open trade as a loss, but `/trades` still labels it «LOSE», because `adaptTrade` sets `status: result ===
  'win' ? 'WIN' : 'LOSE'` (`TradesV1Professional.tsx:27, 45`). Accepted; D38's test pins what the page shows.
- **Ebinex registration minute** (D35): if he does not look at «Vence às …», an expiry one minute late keeps a mark made in
  that minute «limpa». The link row's `file_exit_at` (C16) lets Phase 4/7 spot the gap afterwards.
- **Look-alike trades in one import** (C13): the one-to-one match may swap two trades with the same root, side and size a
  few minutes apart. Counts and the day's sum stay right; with Q2 (a) the money of the two may be exchanged. Accepted.
- **Ebinex candles longer than M1** (C30): the grid rule is unverified (every row of his files is M1); the first registration
  with «2 min», «5 min» or «15 min» is checked against the platform.
- **Production deploy** returns 404 until PR #26 is merged and promoted (§6).
- **Side finding, outside Phase 3**: `app/app/api/market/quote/route.ts` calls only `requireUser` (l.44), not `denyHubAccess`,
  although it reaches a third party (`CLAUDE.md`: «Anything that costs money or reaches a third party … also check
  HUB_USERS»; legado G4). A separate small fix.

---

## 8. Phase 3b questions deferred

importacao_colunas.md Q1 (live trade, then the file) is decided here (C12–C16, Q2). Q2–Q11 (execution files, net results,
step order, NEW mapping behaviours, markets, «Conta» column, template management, results from prices, first real file, Excel)
are asked when 3b starts, with that spec's recommendations as defaults. Phase 3 already lands what 3b reuses: the instrument
table, the `asset_type` vocabulary, `registered_at` on every insert, and the `source = 'import'` guard in `import_fix_tz`.

---

## Open questions for the owner

(pt-BR version with plain wording: `perguntas.md`.)

1. **Can the live entry time be corrected?** The board lets him type «Hora (ET)»; the appendix stores the server time. Either
   way `registered_at` is the server's, marks are judged by the server's clock, and the typed hour decides the stored «Posso
   operar hoje?».
   - (a) Typed, up to 15 minutes before now; older entries use «Já fechada». **Recommended**: covers a few minutes of delay on
     the phone, keeps an hours-old entry from looking live, fits the import match window, and lets him set the Ebinex order
     minute when the registration crosses into the next minute (D35). Cost: the typed hour decides «Posso operar hoje?», so
     an entry just after the window could be typed inside it; the gap to `registered_at` stays stored.
   - (b) Always the server time, no hour field. On Ebinex the expiry would then be a minute late whenever the registration
     falls in the minute after the order (D35).
   - (c) Any time of the same trading day.
2. **When the broker file disagrees with a registered trade, which values count?** The match itself is settled (C12–C13).
   - (a) The file corrects money (prices, quantity, result); times, marks, stop/target and the gate at entry stay; undo
     restores the registered values. **Recommended**: the file is the broker's statement and the Análises count money; the
     journal's evidence does not change.
   - (b) The registered values stay; the file only completes commission and ID, and the preview counts the differences.
3. **How does a wrong (or test) registration go away?**
   - (a) «Desfazer entrada» in Registrar while open and within 15 minutes, and the old `/trades` page keeps deleting; both
     log the deletion (times only) and remove its images. **Recommended**: fixes a mistake on the phone at once, nothing
     vanishes without a trace.
   - (b) Only the old page, as today, with the same log.
   - (c) Nothing is deleted in Phase 3; «Descartar» comes with the Diário (Phase 4).
4. **How complete should Registrar be in the Forex, Ações e opções, Cripto and B3 accounts?**
   - (a) Four new board scenarios; result computed when exact and typed when not; optional costs; single-leg options;
     +5–7.5 days (`mercados.md` §7). **Recommended**: the same instrument table serves 3b's «Resultado (ou os preços)», and
     traders of those markets do not do arithmetic.
   - (b) Lean: one generic scenario + B3; result always typed, price calculation as a hint; options by name; +2.5–4 days.
   - (c) Move the new markets to 3b, right after Phase 3 (changes the 2b decision).
