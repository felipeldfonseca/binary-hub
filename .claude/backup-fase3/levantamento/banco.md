# Phase 3 · M6a database design: the trade cycle, marks on the server clock, entry context, images and notes

Base: `feature/rebuild-lean` at 4187a8c (= `main` 0239448 after PR #25). Applied on the live project: `20240415000000..2`,
`20260510000001..2`, `20260511000001`, `20261017000001..3` (Phase 1), `20261018000001..3` (Phase 2), `20261019000001`
(Phase 2b). Read-only survey: nothing in the repo was edited, the live Supabase was not called, no `.env` and no
`docs/csv` row was read.

Sources: `panel/v31/plano.md` (row 3: «Setup A/B/C, operação aberta, saída, marcas com horário do servidor. Avisos de
janela e de limite. Variante Ebinex. 4 imagens e uma nota.»; owner test «Registrar pelo celular. Às 11:05 aparece "Fora
da sua janela". A 5ª imagem é recusada.»), `panel/v31/apendice.md` §A, §B «Fase 3: M6a», §D, §E; `fase2/decisoes.md`;
`mercados/decisoes.md`; `fase2/levantamento/{banco,gate,personalizar,legado}.md`; `mercados/impacto.md`; boards
`market-hub/project/RegistrarOperacao.dc.html` (5 scenarios, main source), `DiarioHojeEnxuto`/`DiarioDezEnxuto.dc.html`,
`Inicio.dc.html`, `mercados/quadros/project/ImportarConta.dc.html` (scenario 8 and the «Mercado novo» endings); memory
`market-hub-initiative.md`; as-built SQL in `supabase/migrations/` and app code in `app/`.

Verified on a throwaway Postgres 15 cluster (Supabase stub + every repo migration + the legacy seed; scripts in
`fase3/levantamento/_work/banco/proto/`): server times forced on insert, the freeze of an app-registered trade, append-only
marks and context that still let cascades through (trade deleted by an old page, auth user deleted), a delete log written
by a `SECURITY DEFINER` trigger from the `authenticated` role, the `security_invoker` marks view, column-level INSERT and
revoked UPDATE on `trades`, storage RLS with a reservation helper, `ON CONFLICT … DO UPDATE … WHERE` skipping app rows,
`local_hm_before` across both New York DST changes and midnight in Brasília, the symbol match key, and that a CHECK
violation's DETAIL carries the row's values. The prototype is a reference, not the migration.

Copy in «…» is exact pt-BR from the named board. **NEW** = on no board; **ADAPTED** = on a board or in the appendix, changed
here (reason given).

---

## 0. Decisions at a glance

1. **One trades table, a few new columns.** `trades` gains `status` (`open`/`closed`, default `closed`),
   `registered_at`, `exit_registered_at`, `rule_version_id` (appendix) and `client_key` (**NEW**, idempotency for the
   phone). Every pre-existing row reads `status = 'closed'` and nulls; no existing value is written.
2. **"App-registered" = has a `trade_entry_context` row.** Only the register RPCs create one, in the same transaction as
   the trade. That row is the marker the freeze, the clean-mark rule, the import matching and the delete log use. No extra
   flag column, and the API cannot fake it (no insert grant on the context table).
3. **Server time, always.** A trigger forces `registered_at = now()` on **every** insert into `trades` (all writers, as
   the appendix says), `exit_registered_at = now()` whenever it is set, `marked_at`, `captured_at`, `reserved_at`,
   `saved_at` and `note_saved_at` the same way. The client never sends a time that is stored as a server time.
4. **What the trader types is a claim; when he typed it is a fact.** ADAPTED: the board lets him type «Hora (ET)» for the
   entry and the exit (≤ now). `entry_time`/`exit_time` hold those instants (converted in Postgres); `registered_at` /
   `exit_registered_at` hold when the app learned them. Live entries may be at most 15 minutes before `now()` (Q4).
5. **Frozen once registered.** For an app-registered trade: identity, account, source, version, `entry_time`, symbol,
   direction, stop and target, and, once the app registered the exit, `exit_time`, `exit_registered_at` and `status`. Money
   fields stay correctable by server functions only (an import that corrects the broker's numbers, Q2).
6. **Writes only through `SECURITY DEFINER` RPCs**, same rules as Phases 1–2 (`set search_path = ''`, `auth.uid()` first,
   own-account check, errors are bare codes, never values): `register_entry`, `register_exit`, `register_after`,
   `add_marks`, `image_slots`, `save_extras`, `image_trash_done`. The API keeps SELECT on everything it owns; UPDATE on
   `trades` is revoked (no UI calls the old `updateTrade`); INSERT on `trades` is limited to the old writers' columns.
7. **The gate at entry is computed by the server** with Phase 2's `gate_at(account, entry_time)` and frozen in
   `trade_entry_context` (typed columns + the whole answer as `gate jsonb`). «Não avaliado» is `null`, never `false`.
   A register RPC never refuses because of the gate: «Ele nunca impede o registro» (Registrar, ⓘ of the gate line).
8. **Marks are append-only events** (`trade_marks`: `setup`, `execucao`, `emocao`, `seguiu_texto`; a `null` value is
   «desmarcar»). «Limpa» = made on a **live** app-registered trade before the result was known:
   `marked_at < least(result_known_at, exit_registered_at)`, where `result_known_at` is the exit instant (futures and the
   rest) or the expiry (binaries). Views `trade_marks_v` (per mark) and `trade_marks_now_v` (current and «vale em
   Análises» per kind).
9. **Pnl by the server when it can.** Futures with a known instrument (catalog `instrument_specs()`, **NEW**: MES, MNQ,
   MGC from the board plus ES, NQ, GC) and binaries (stake × payout) are computed in SQL; other markets send the result
   (`mercados/impacto.md`: «o mais barato é o trader digitar o resultado»). Stop and target arrive «em pontos» and are
   stored as price levels in the Phase 1 columns.
10. **Images in a private bucket `trade-images`**, path `{user_id}/{trade_id}/{attachment_id}.{ext}`, 10 MiB and
    PNG/JPEG/WebP enforced by the bucket. Max 4 per trade enforced three times: the reservation RPC (row lock), the
    storage INSERT policy (only a reserved path can be uploaded) and the commit RPC. The browser uploads directly with its
    own JWT (no service key, no Vercel 4.5 MB limit); removed and expired files go to a trash queue the browser drains
    through the Storage API (SQL never deletes storage objects).
11. **Imports never duplicate and never delete what the app registered.** A file row is first matched to an
    app-registered trade of the same account (same key, then content: symbol root, direction, entry within −2/+16 min,
    quantity or stake). A match **links** the trade (`source_platform`, `external_id`, `notes` key) and completes it
    (commission; the exit when it is still open) with a per-batch record in `trade_import_links`; undoing the batch
    reverts exactly that and never deletes the trade or its marks. An ambiguous row stays out with a line code (Q3).
12. **The old pages keep working.** They read every trade (open ones show `result = 'pending'`), cannot update any, can
    still insert through the bridge with their own columns, and can still delete (Q1: deleting an app-registered trade is
    logged in `trade_deletions` and its images are queued for removal).
13. **One transaction, proven harmless.** The paste kit backs up into `backup_fase3`, applies four migration files in one
    transaction whose last statement stops everything if any pre-existing trade (over its old columns), trading day,
    account, version, batch, policy or privilege differs, and prints a JSON conferência.

---

## 1. What the boards ask the database to hold

### 1.1 Registrar operação (`RegistrarOperacao.dc.html`)

Five scenarios: «1 · Na entrada · MES, 14 out 10:07 ET», «2 · Depois, com a operação já fechada · MES, 1º dez 11:01
ET», «3 · Fora da janela · MGC, 14 out 11:12 ET», «4 · Depois do limite · MES, 19 nov 10:52 ET», «5 · Binárias · Ebinex,
15 out 20:10 de Brasília». Steps: live «Passo 1 de 3 · Entrada» → «Aberta» (binary: «Vencida» once expired) →
«Fechada»; after-the-fact «Entrada e saída» → «Fechada». Footer: «Registrar entrada», «Registrar saída» / «Registrar
resultado» (binary), «Registrar operação» (scenario 2), then «Registrar outra» and «Ver no Diário». Bottom line: «O Binary
Hub não envia ordens: registrar é anotar.»

**Fields and what the database stores**

| Board (variant) | Values on the board | DB |
|---|---|---|
| «Ativo» (futures) | chips MES, MNQ, MGC | `symbol`; tick and point value from `instrument_specs()` (board `tick` 0,25/0,25/0,10, `mult` 5/2/10) |
| «Lado» | «Compra» / «Venda» | `direction` `long`/`short` |
| «Contratos» | 1, 2, 3 | `quantity` (integer for futures) |
| «Preço de entrada» + «Sugestão: o último preço na tela. Ajuste ao da sua plataforma.» | decimal, on the tick | `entry_price` |
| «Hora (ET)» / «Hora (Brasília)»; scenario 2: «Hora da entrada (ET)» | `HH:MM`, prefilled with now | `entry_time` (§6.7) |
| «Preço de saída», «Hora da saída (ET)» | | `exit_price`, `exit_time` |
| «Stop e alvo, em pontos · opcional» | «Stop», «Alvo» (points) | `stop_price`, `target_price` as levels: entry ∓ points (§6.2) |
| «Par» (binary) | EUR/USD, BTC/USD, GBP/USD, ETH/USD, USD/JPY with suggested payout | `symbol` |
| «Direção» | «Alta» / «Baixa» | `direction` `call`/`put` |
| «Expiração» | 1, 2, 5, 15 min | `duration_seconds` 60/120/300/900, `timeframe` `M1`…`M15` |
| «Stake, US$», «Payout, %» | stake > 0; payout 1–100 | `stake_amount`, `payout_percent` |
| «Como terminou?» (binary, after expiry) | «Ganho» / «Perda» / «Devolvida» | `result` win/loss/breakeven; `pnl` = stake × payout/100, −stake, 0 |
| «Como está o setup?» / «Como estava o setup?» | A, B, C (tap again = «desmarca») | `trade_marks` kind `setup` |
| «Execução da entrada» / «Execução e emoção» | «cedo», «no ponto», «tarde» | kind `execucao` (`cedo`, `no_ponto`, `tarde`) |
| «Como você está?» (open step) | «Calmo», «Confiante», «Ansioso», «Frustrado», «Neutro» | kind `emocao` (lower-case ids) |
| «Imagens e nota» | up to 4 PNG/JPG/WebP ≤ 10 MB; note ≤ 1 000 chars | `trade_attachments` + Storage; `trades.note`, `note_saved_at` |

Validation copy that the server mirrors with codes (the screen keeps the words):

| Board copy | DB code |
|---|---|
| «Escolha Compra ou Venda.» / «Escolha Alta ou Baixa.» | `bad_direction` |
| «Informe o preço de entrada.», «Use só números, como 7.896,25.», «O preço precisa ser maior que zero.» | `bad_price` |
| «O MES anda de 0,25 em 0,25; confira o preço.» | `off_tick` |
| «Use pontos maiores que zero.» (stop, alvo) | `bad_stop`, `bad_target` |
| «Informe a hora.» | `bad_time` |
| «A entrada não pode ser depois de agora (10:07 ET).» | `entry_in_future` |
| «A saída não pode ser antes da entrada (10:07).» | `exit_before_entry` |
| «A saída não pode ser depois de agora (…).» | `exit_in_future` |
| «Escolha a expiração.» | `bad_duration` |
| «Informe o stake.», «Use um valor maior que zero.» | `bad_stake` |
| «Informe o payout.», «O payout vai de 1 a 100%.» | `bad_payout` |
| «Ainda não venceu.» | `not_expired` |
| «Escolha como terminou.» | `bad_outcome` |
| «Só imagens PNG, JPG ou WebP.» | `bad_mime` |
| «Até 4 imagens por operação.» | `too_many_images` |
| «Esta imagem passa de 10 MB.» | `image_too_large` |

**The gate and the plan at entry.** «Posso operar hoje?» when the hour is now, «Posso operar hoje? Na entrada:» when the
typed hour is earlier; ⓘ: «Calculado pelas regras desta conta, na hora da entrada: janela, bloqueio de dados e limite do
dia. Ele nunca impede o registro: fora do plano, a operação só ganha a marca.» Plan line: «● fora da janela · depois do
limite» + «Fora do plano, conferido pelo hub. Você pode registrar.»; open step «No plano» or «● …»; closed step «… conferido
pelo hub». Board order of marks: fora da janela · no bloqueio · depois do limite · contra a regra (`tagsEm`), the same as
Phase 2's `BREAK_ORDER`. Board limit (`limiteEm`): realized trades in exit order, worst point, hit at `run <= −lim` — Phase
2's `limit_usage`. «Registrar outra»: «a que acabou de fechar entra no limite do dia» (board code comment).

**Marks and time** (the core of Phase 3):
- Setup ⓘ: «Marcar depois de ver o resultado puxa a nota para o resultado: a perda vira “Setup C”, e “Setup A rende mais”
  passa a se provar sozinho. Por isso o app grava a hora de cada marca: só as feitas antes da saída podem chegar a
  Confirmada nos Padrões de Análises; as de depois param em Pouco fundamentada.»
- Chips: «às 10:05 · antes da saída», «às 11:01 · depois do resultado», «agora conta como antes da saída»; scenario 2:
  «Marcas feitas agora contam como depois do resultado; para passar de Pouco fundamentada em Análises, marque o setup na
  entrada.»
- Closed step, «Suas marcas» ⓘ: «Nos Padrões de Análises, só as marcas feitas antes da saída podem chegar a Confirmada;
  as feitas depois do resultado aparecem, mas param em Pouco fundamentada. Mudou uma marca depois? Em Análises vale a de
  antes da saída, e a troca fica guardada.» Lists «antes da saída» / «depois do resultado», «(trocada às 11:01)»,
  «(desmarcada às …)», history «antes: A às 10:05 · agora: B às 11:01».
- The cut is the **typed exit** (futures) or the **expiry** (binary), not the click: «Marcas feitas a partir das 10:21
  (sua saída) contam como depois do resultado.» / «… (o vencimento) …». Board code: `antesDe(m) = m.fase === 'aberta' &&
  (fimSabido() === null || m.em < fimSabido())`, `fimSabido` = registered exit time, binary expiry, or null for an open
  futures trade.

**Images and note** (last step of every scenario): ⓘ «Ficam guardadas com a operação e aparecem nos detalhes dela, no
Diário. Não entram nas contas, nos Padrões nem na leitura da IA. Dica: recorte o número da conta antes de enviar.» Hint
«Arraste para cá, cole com ⌘V ou escolha. Até 4 imagens PNG, JPG ou WebP, de até 10 MB cada.», full: «Limite de 4
imagens. Remova uma para trocar.», counter «{n} de 1000», button «Salvar imagens e nota», status «1 imagem e nota salvas
às 11:30. Aparecem nos detalhes da operação, no Diário.», «Nota removida às …», and on «Registrar outra» an unsaved draft
is saved with the trade that closed: «Operação anterior: 2 imagens e nota salvas às 11:32.» Images are chosen locally
(previews via `createObjectURL`) and saved together on «Salvar imagens e nota» (board `salvar`).

### 1.2 Diário (`DiarioHojeEnxuto`, `DiarioDezEnxuto`): what is read back later (Phase 4)

- Per trade: «Setup · sua nota, de A a C», «Execução», «Emoção», each with «às 10:05 · antes da saída» or «às 11:30 ·
  depois do resultado» (`mkTempo`); changed in the Diário: «agora, 11:35 ET · depois do resultado».
- «Stop · alvo»: «stop 60 · alvo 60 pts · às 10:50» or «não anotados» → the stop's time is the registration time.
- «Imagens e nota» with «salvos às 11:30 · depois do resultado», file «MES_10-04_entrada.png · 840 KB», paperclip aria
  «tem imagens e nota», button «Adicionar imagens ou nota».
- «Você seguiu o seu texto?» «Sim» / «Em parte» / «Não»: «Pela sua resposta, depois do resultado. O diário conta à
  parte.» → mark kind `seguiu_texto` (accepted now, used from Phase 4/5).
- Imported days have no marks row (`temLinhaMarcas: !det.importado`).

### 1.3 ImportarConta (2b boards)

- Column mapping (scenario 8): «ID da operação (evita duplicar)» is optional → a file without IDs must still not
  duplicate what the app registered (§10.6).
- Scenario 4: «Mesmo ID da plataforma, em outra conta. Não são duplicadas desta conta: escolha se mudam para cá ou ficam
  onde estão.» (moving is not built; an app-registered trade never moves, §4).
- New markets: «Nada ainda: as operações desta conta entram pelo “Registrar operação”, que chega na Fase 3.»

### 1.4 The owner's test

| Test | What the database does |
|---|---|
| «Registrar pelo celular» | server clock for every time; `client_key` makes a double tap or a retried request idempotent; RPC answers carry `server_now` (gate.md: «Phase 3 should correct for server skew») |
| «Às 11:05 aparece "Fora da sua janela"» | `register_entry(…, dry_run)` at 11:05 ET on Top One (window 10:00–11:00 ET) returns `gate.status = 'fora_janela'`, plan `["fora_da_janela"]`; the stored context has `in_window = false` |
| «A 5ª imagem é recusada» | `image_slots` refuses `too_many_images`; the storage policy refuses an unreserved path; `save_extras` refuses a list of 5 |

---

## 2. As built today (what Phase 3 builds on)

### 2.1 `trades` columns after Phase 2b

| Group | Columns | Notes |
|---|---|---|
| Initial schema | `id`, `user_id → profiles(id)`, `session_id`, `symbol`, `asset_type` (free text, NOT NULL), `direction` (long/short/call/put), `entry_price`, `exit_price`, `quantity` (default 1), `stake_amount`, `payout_percent`, `duration_seconds`, `result` (win/loss/breakeven/pending), `pnl`, `pnl_percent`, `strategy`, `setup_type`, `timeframe`, `entry_reason`, `exit_reason`, `notes` (old import key `platform:id`), `screenshot_entry`, `screenshot_exit`, `entry_time` NOT NULL, `exit_time`, `created_at`, `updated_at` | `setup_type`, `strategy`, `screenshot_*`, `*_reason` are unused by any screen; Phase 3 leaves them null |
| 2026-05 | `market_type` | the old pages filter on it |
| Phase 1 (M2) | `account_id` (FK `(account_id, user_id)`), `import_batch_id`, `source` (live/after/import), `source_platform`, `external_id`, `source_local_entry`, `source_local_exit`, `trading_day`, `commission` (null = unknown), `stop_price`, `target_price`, `note` (≤ 1 000), `note_saved_at` | unique `(id, user_id)`, unique `(account_id, source_platform, external_id)`, unique `(user_id, notes)` |

Triggers: `trades_bridge` (BEFORE INSERT OR UPDATE OF account_id, market_type, entry_time, user_id; picks the account for
old writers, fills `market_type`, `source`, the import key, and `trading_day = compute_trading_day(account, entry_time)`),
`update_trades_updated_at`, `update_session_stats_on_*` (only with `session_id`). Policy: one `FOR ALL USING (auth.uid() =
user_id)` from the initial schema. Grants: Supabase defaults (ALL, TRUNCATE included, to `anon` and `authenticated`).

Phase 1–2b functions Phase 3 reuses unchanged: `compute_trading_day`, `trading_day_for`, `window_occurrences`,
`rule_version_at`, `gate_at`, `gate_eval`, `limit_usage` (skips `pnl is null` and `result = 'pending'`, so open trades
never count), `rules_limit_amount`, `market_caps`. Replaced in Phase 3: `import_commit`, `import_preview`, `import_undo`,
`import_fix_tz` (§10), `trades` grants and nothing else.

### 2.2 Every writer of `trades` today

| Writer | File | Used by a screen? | Phase 3 effect |
|---|---|---|---|
| `createTrade` (insert) | `app/hooks/useTradesSupabase.ts:107` | no caller | would still work for the old columns (INSERT grant, §11) |
| `updateTrade` (update any column) | `app/hooks/useTradesSupabase.ts:131` | no caller | refused (UPDATE revoked); nothing uses it |
| `deleteTrade` | `app/hooks/useTradesSupabase.ts:157` | yes: `/trades`, `components/trades/versions/TradesV1Professional.tsx:87,128` (bulk delete) | keeps working; an app-registered trade is logged and its images queued (Q1) |
| `quickAddBinaryTrade` (insert) | `app/hooks/useTradesSupabase.ts:171` | no caller | as `createTrade` |
| `quickAddFuturesTrade` (insert) | `app/hooks/useTradesSupabase.ts:222` | no caller | as `createTrade` |
| `importTrades` (REST upsert `on_conflict=user_id,notes`, ignore duplicates) | `app/lib/utils/importTrades.ts:18` | only tests (`__tests__/lib/importTrades.test.ts`, the golden body test); the old buttons link to `/diario?importar=1` | its body's keys are all in the INSERT grant; unchanged |
| `import_commit`, `import_fix_tz`, `import_undo` | `20261017000003`, `20261018000002` | ImportarConta, Importações | replaced (§10) |
| `save_rules` (`update trades set trading_day` for trades at/after a new version) | `20261019000001` | Personalizar | unchanged; never touches frozen columns (`trading_day` is not frozen by value, see §4) |
| Seed/tests as owner | `supabase/tests/*.sql` | — | unchanged |

`useAccountTransactions.ts:60/83` writes `account_transactions` only; `useTradingSessions.ts` writes `trading_sessions`
only (its stats trigger reads trades with a `session_id`, which app trades never have).

---

## 3. Schema

Four migration files (names follow the repo's dated pattern):
`20261020000001_trade_cycle.sql` (§3.1–3.3, §4), `20261020000002_trade_images.sql` (§3.4, §9),
`20261020000003_trade_api.sql` (§6), `20261020000004_imports_and_live.sql` (§3.5, §10). They run in that order in one
transaction (§14).

### 3.1 `trades`: new columns

```sql
alter table public.trades
  add column status text not null default 'closed' check (status in ('open', 'closed')),
  add column registered_at timestamptz,        -- when the database received the row (every insert from M6a on)
  add column exit_registered_at timestamptz,   -- when the app registered the exit (register_exit / register_after)
  add column rule_version_id uuid,             -- the version in force at entry_time; app-registered trades only
  add column client_key uuid;                  -- NEW: the form's idempotency key; app-registered trades only

alter table public.trades
  add constraint trades_rulever_fk foreign key (rule_version_id, user_id)
    references public.account_rule_versions (id, user_id),
  -- an open trade has no result yet (every existing row is closed, so validation passes)
  add constraint trades_open_shape
    check (status = 'closed' or (exit_time is null and exit_price is null and pnl is null and result = 'pending'));

create unique index trades_client_key on public.trades (user_id, client_key) where client_key is not null;
create index trades_open on public.trades (user_id, account_id) where status = 'open';
```

- `status` with a constant default is a catalog-only change in PG ≥ 11: no rewrite, existing rows read `closed`.
- The old 629 rows keep `registered_at` null (when the database first saw them is `created_at`; Phase 7 reads
  `coalesce(registered_at, created_at)`). Nothing is backfilled.
- No `stop_noted_at`: the Diário's «stop … · às 10:50» is `registered_at`, because stop and target are written only at
  registration and are frozen afterwards (§4).
- Indexes for matching and day reads already exist (`trades_user_acc_day`, `trades_user_sym_entry`,
  `idx_trades_user_entry_time`).

**How each writer fills a row**

| Column | `register_entry` (live) | `register_exit` | `register_after` | `import_commit` insert | old page insert |
|---|---|---|---|---|---|
| `source` | `live` | — | `after` | `import` | bridge: `after` or `import` (notes key) |
| `status` | `open` | → `closed` | `closed` | `closed` | `closed` (default; not insertable) |
| `entry_time` | typed `HH:MM` → instant, or `now()` | frozen | typed day + `HH:MM` | file clock at `file_tz` | client value |
| `registered_at` | `now()` (trigger) | frozen | `now()` | `now()` | `now()` |
| `exit_time` | null | typed or `now()`; binary: expiry | typed; binary: expiry | file | client |
| `exit_registered_at` | null | `now()` | `now()` | null | null (not insertable) |
| `rule_version_id` | `rule_version_at(account, entry_time)` | frozen | same | null | null (not insertable) |
| `trading_day` | bridge (`compute_trading_day`) | unchanged | bridge | bridge | bridge |
| `account_id`, `market_type` | payload account; bridge copies the market | frozen | as entry | batch account | bridge |
| `entry_price` | payload (not binary) | — | payload | file | client |
| `exit_price` | null | payload (not binary) | payload | file | client |
| `quantity` | payload; binary `1` | — | payload | file | client |
| `stake_amount`, `payout_percent`, `duration_seconds`, `timeframe` | binary only | — | binary only | file | client |
| `stop_price`, `target_price` | entry ∓ points | frozen | entry ∓ points | file (Top One SL/TP) | client |
| `pnl`, `result` | null, `pending` | server-computed or typed | server-computed or typed | file | client |
| `commission` | binary `0` (as the Ebinex reader: «a known fact»); else null (unknown) | — | as entry | file | client |
| `note`, `note_saved_at` | null | — | null | null | not insertable |
| `client_key` | payload | — | payload | null | not insertable |
| `source_platform`, `external_id`, `notes` | null until an import links it (§10) | — | null | file | bridge from `notes` |

`asset_type` by market (from `trade_caps_all()`, §3.6): futures `futures`, binary `binary_option`, forex `forex`, stocks
`stock`, crypto `crypto`, b3 `b3`, options `option` (`mercados/impacto.md` names forex, crypto, stock, option).

### 3.2 `trade_entry_context`

```sql
create table public.trade_entry_context (
  trade_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  origin text not null check (origin in ('live', 'reconstructed')),   -- register_entry / register_after
  captured_at timestamptz not null default now(),                      -- forced now()
  evaluated_at timestamptz not null,                                   -- = trades.entry_time, the instant judged
  -- «Posso operar hoje? Na entrada:» (gate_at at evaluated_at); null = nothing was evaluated
  gate_status text check (gate_status in ('liberado', 'aguardar', 'fora_janela', 'encerrado')),
  warnings text[] not null default '{}' check (warnings <@ array['fora_janela', 'limite']),
  checks_evaluated text[] not null default '{}' check (checks_evaluated <@ array['janela', 'bloqueio', 'limite', 'estado']),
  in_window boolean,          -- null = window not evaluated (no version, rule off, no window)
  in_block boolean,           -- Phase 5; null now
  after_limit boolean,        -- limit reached by trades realized at or before the entry
  day_pnl_at_entry numeric(18, 2),     -- net realized by the entry, account currency; null when the limit was not evaluated
  day_worst_at_entry numeric(18, 2),   -- worst point by the entry (what the limit compares)
  state_choice text check (state_choice in ('opero', 'so_a_favor', 'nao_opero')),   -- Phase 5; null now
  rule_ok boolean,                                                                  -- Phase 5; null now
  gate jsonb not null,        -- gate_at()'s whole answer minus `rules` (the version is trades.rule_version_id)
  check ((in_window is null) = not ('janela' = any (checks_evaluated))),
  check ((in_block is null) = not ('bloqueio' = any (checks_evaluated))),
  check ((after_limit is null) = not ('limite' = any (checks_evaluated))),
  check ((rule_ok is null) = not ('estado' = any (checks_evaluated))),
  check ((day_pnl_at_entry is null) = (after_limit is null) and (day_worst_at_entry is null) = (after_limit is null)),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);
```

ADAPTED from the appendix: `screen`, `market_as_of`, `bias`, `bias_marked_at` wait for Phase 5 (a nullable ALTER then);
added `evaluated_at`, `warnings`, `day_worst_at_entry` (gate.md GG4) and the frozen `gate` answer. The columns are exactly
`toEntryContext()` in `app/lib/domain/gate/plan.ts` (cents there, numeric here), so the TS preview and the stored row
come from one truth table (§7). Append-only (§4.2).

### 3.3 `trade_marks` and its views

```sql
create table public.trade_marks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  kind text not null check (kind in ('setup', 'execucao', 'emocao', 'seguiu_texto')),
  value text check (value is null or case kind              -- null = «desmarcar»
    when 'setup' then value in ('A', 'B', 'C')
    when 'execucao' then value in ('cedo', 'no_ponto', 'tarde')
    when 'emocao' then value in ('calmo', 'confiante', 'ansioso', 'frustrado', 'neutro')
    when 'seguiu_texto' then value in ('sim', 'em_parte', 'nao') end),
  marked_at timestamptz not null default now(),            -- forced now()
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);
create index trade_marks_trade on public.trade_marks (trade_id, kind, marked_at desc, id desc);
```

- ADAPTED: values from the boards; `seguiu_texto` (Diário «Você seguiu o seu texto?») accepted now so Phase 4 needs no
  ALTER. No `phase` column: «made while open» is `marked_at < exit_registered_at`.
- Marks are allowed on any trade of the owner (the Diário will mark imported trades too); only live app-registered
  trades can produce clean ones.

```sql
-- When the result became knowable: the exit (futures and the rest), or the expiry (binaries)
create or replace function public.trade_result_known_at(p_asset text, p_entry timestamptz, p_duration int, p_exit timestamptz)
returns timestamptz language sql immutable set search_path = '' as $$
  select case when p_asset = 'binary_option' and p_duration is not null
              then least(coalesce(p_exit, 'infinity'), p_entry + make_interval(secs => p_duration))
              else p_exit end
$$;

create view public.trade_marks_v with (security_invoker = true) as
select m.id, m.user_id, m.trade_id, m.kind, m.value, m.marked_at,
       public.trade_result_known_at(t.asset_type, t.entry_time, t.duration_seconds, t.exit_time) as result_known_at,
       (c.origin = 'live'
        and m.marked_at < least(coalesce(public.trade_result_known_at(t.asset_type, t.entry_time, t.duration_seconds, t.exit_time), 'infinity'),
                                coalesce(t.exit_registered_at, 'infinity'))) is true as limpa
from public.trade_marks m
join public.trades t on t.id = m.trade_id and t.user_id = m.user_id
left join public.trade_entry_context c on c.trade_id = m.trade_id;

-- Per trade and kind: the current mark and the one that counts in Análises (the last clean one)
create view public.trade_marks_now_v with (security_invoker = true) as
select distinct on (m.trade_id, m.kind)
       m.user_id, m.trade_id, m.kind,
       m.value as current_value, m.marked_at as current_at, m.limpa as current_limpa,
       k.value as clean_value, k.marked_at as clean_at,
       (not m.limpa and m.value is distinct from k.value) as changed_after   -- «trocada» / «desmarcada»
from public.trade_marks_v m
left join lateral (select x.value, x.marked_at from public.trade_marks_v x
                   where x.trade_id = m.trade_id and x.kind = m.kind and x.limpa
                   order by x.marked_at desc, x.id desc limit 1) k on true
order by m.trade_id, m.kind, m.marked_at desc, m.id desc;
```

ADAPTED from the appendix's `limpa = source = 'live' and marked_at < exit_registered_at`: the board cuts at the typed exit
or the expiry, and «live» is read from the context row (the API cannot make one), not from `source`.

### 3.4 `trade_attachments` and `trade_image_trash`

```sql
create table public.trade_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trade_id uuid not null,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp)$'),
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  name text not null check (char_length(name) between 1 and 120 and name !~ '[[:cntrl:]]'),  -- «MES_10-04_entrada.png»
  claimed_bytes int not null check (claimed_bytes between 1 and 10485760),   -- what the browser said (quota, early refusal)
  bytes int check (bytes between 1 and 10485760),                            -- from storage.objects at commit
  status text not null default 'pendente' check (status in ('pendente', 'ok')),
  position smallint check (position between 1 and 4),
  reserved_at timestamptz not null default now(),   -- forced
  saved_at timestamptz,                             -- forced now() when it becomes ok («salvos às 11:30»)
  unique (id, user_id),
  check (status = 'pendente' or (bytes is not null and saved_at is not null and position is not null)),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade
);
create index trade_attachments_trade on public.trade_attachments (trade_id, status, position);
create unique index trade_attachments_position on public.trade_attachments (trade_id, position) where status = 'ok';

-- Files to remove from Storage (SQL never deletes storage objects; the browser does, through the Storage API)
create table public.trade_image_trash (
  path text primary key,
  user_id uuid not null,              -- no FK: rows are written while a user's trades cascade
  reason text not null check (reason in ('removida', 'reserva_vencida', 'operacao_apagada', 'substituida')),
  queued_at timestamptz not null default now()
);
```

An AFTER DELETE trigger on `trade_attachments` (SECURITY DEFINER, verified necessary: the old page deletes as
`authenticated`) inserts the path into the trash unless the user no longer exists (a deleted account's files are left to
the dashboard; verified the user cascade then completes). The original file name is metadata only, never part of the
path (it is user text).

### 3.5 Imports: `trade_import_links` and two batch counters

```sql
create table public.trade_import_links (
  trade_id uuid not null,
  batch_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  line int not null,                         -- the file line (no values)
  set_key boolean not null,                  -- this batch wrote source_platform / external_id / notes
  closed boolean not null,                   -- this batch closed an open trade (exit from the file)
  before jsonb not null,                     -- {column: value before} for every column this batch wrote
  after jsonb not null,                      -- {column: value written}
  differs text[] not null default '{}',      -- columns where the file disagreed and the app value was kept (Q2 b)
  linked_at timestamptz not null default now(),
  primary key (trade_id, batch_id),
  foreign key (trade_id, user_id) references public.trades (id, user_id) on delete cascade,
  foreign key (batch_id, user_id) references public.import_batches (id, user_id)
);
create index trade_import_links_batch on public.trade_import_links (batch_id);

alter table public.import_batches
  add column rows_linked int not null default 0,      -- file rows that matched an app-registered trade
  add column rows_ambiguous int not null default 0;   -- rows left out (Q3)
```

### 3.6 Descriptors (NEW), immutable literals with a Jest parity test, like `market_caps_all()`

```sql
-- What the Registrar form of each market takes (the boards draw futures and binary; mercados.md refines the rest)
create or replace function public.trade_caps_all() returns jsonb language sql immutable set search_path = '' as $$ select $c${
  "futures": {"asset_type": "futures", "directions": ["long", "short"], "qty": "int", "price": true, "stops": "pts", "pnl": "calc"},
  "binary":  {"asset_type": "binary_option", "directions": ["call", "put"], "qty": "one", "price": false, "stops": null,
              "pnl": "outcome", "durations": [60, 120, 300, 900], "expiry": "entry"},
  "forex":   {"asset_type": "forex", "directions": ["long", "short"], "qty": "dec", "price": true, "stops": "pts", "pnl": "typed"},
  "stocks":  {"asset_type": "stock", "directions": ["long", "short"], "qty": "dec", "price": true, "stops": "pts", "pnl": "typed"},
  "crypto":  {"asset_type": "crypto", "directions": ["long", "short"], "qty": "dec", "price": true, "stops": "pts", "pnl": "typed"},
  "b3":      {"asset_type": "b3", "directions": ["long", "short"], "qty": "dec", "price": true, "stops": "pts", "pnl": "typed"},
  "options": {"asset_type": "option", "directions": ["long", "short"], "qty": "dec", "price": true, "stops": "pts", "pnl": "typed"}
}$c$::jsonb $$;

-- Futures contracts the server can price: tick and value of one point, in the account currency (USD)
create or replace function public.instrument_specs() returns jsonb language sql immutable set search_path = '' as $$ select $i${
  "futures": {"ES":  {"tick": "0.25", "point": "50"},  "MES": {"tick": "0.25", "point": "5"},
              "NQ":  {"tick": "0.25", "point": "20"},  "MNQ": {"tick": "0.25", "point": "2"},
              "GC":  {"tick": "0.10", "point": "100"}, "MGC": {"tick": "0.10", "point": "10"}}
}$i$::jsonb $$;
```

`pnl: "calc"` falls back to `typed` for a futures symbol not in the catalog (no tick check either). `expiry: "entry"` is
the board's rule (expiry = entry + duration); Q8 asks whether Ebinex should use its candle rule.

### 3.7 `trade_deletions` (Q1, recommended) and `hub_members` (Q6, recommended)

```sql
create table public.trade_deletions (          -- NEW: an app-registered trade that was deleted (evidence honesty)
  id bigint generated always as identity primary key,
  user_id uuid not null,                         -- no FK (written during cascades)
  trade_id uuid not null, account_id uuid, origin text, source text,
  registered_at timestamptz, entry_time timestamptz, trading_day date,
  deleted_at timestamptz not null default now()
);
create table public.hub_members (               -- NEW: who may upload images (mirrors HUB_USERS, kept by hand)
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
```

`trade_deletions` is written by a BEFORE DELETE trigger on `trades` (SECURITY DEFINER; it reads the context before the
cascade removes it; verified). `hub_members` has RLS on and no API grants; the paste kit inserts the owner's row (his uid
by email, in the scratchpad kit only, never in the repo).

---

## 4. Server time and freezing

### 4.1 `trades_guard` (BEFORE INSERT OR UPDATE, every role, owner included)

Name sorts after `trades_bridge` and before `update_trades_updated_at`, so it sees the bridge's final row.

| Event | Rule | Code |
|---|---|---|
| INSERT | `registered_at := now()`; `exit_registered_at := now()` if not null | — |
| UPDATE, any trade | `registered_at` once set never changes | `frozen` |
| UPDATE, app-registered (context exists) | `id`, `user_id`, `account_id`, `source`, `registered_at`, `rule_version_id`, `client_key`, `entry_time`, `symbol`, `direction`, `asset_type`, `duration_seconds`, `stop_price`, `target_price` never change | `frozen` |
| same | `rule_version_id` must belong to `account_id` (checked on insert by the RPC; kept by the freeze) | — |
| same, `old.exit_registered_at` not null | `exit_registered_at`, `exit_time`, `status` never change | `frozen` |
| same, `old.exit_registered_at` null and new not null | only with `status` open → closed; value forced to `now()` | `frozen` |
| same, `status` closed → open | only when `exit_registered_at` is null (a file closed it and its import is undone) | `frozen` |
| any, `note` changes | `note_saved_at := now()` (null when the note is removed) | — |

Money and price fields (`entry_price`, `exit_price`, `quantity`, `stake_amount`, `payout_percent`, `pnl`, `result`,
`commission`) and the import key stay writable by server functions (the API has no UPDATE at all). `trading_day` is not
frozen by value: it follows `entry_time`, which is frozen, so it can only change through `save_rules`' re-derivation of
trades at or after a new version (never true for an app trade, whose version is fixed at its entry; the invariant test
§13 group 4 checks it).

### 4.2 Children (`trade_marks`, `trade_entry_context`)

One guard (verified): UPDATE → `append_only`; DELETE → `append_only` unless the parent trade is already gone **or** the
owner's auth user is gone (the auth cascade reaches the children before the trade); INSERT forces `marked_at` /
`captured_at = now()`. `trade_attachments` needs no guard: only definer RPCs and cascades write it; `reserved_at` and
`saved_at` are forced by its own small trigger.

### 4.3 What freezes, by kind of trade

| | live, open | live, closed in the app | live, closed by a file | after | import | old page |
|---|---|---|---|---|---|---|
| times (`entry_time`, `registered_at`) | frozen | frozen | frozen | frozen | `registered_at` frozen; `entry_time` moves with `import_fix_tz` | `registered_at` frozen |
| exit (`exit_time`, `exit_registered_at`, `status`) | set once by `register_exit` | frozen | file values, revertible by undo | frozen | file | client |
| stop, target, symbol, direction, account, version | frozen | frozen | frozen | frozen | file / fix | — |
| money | server only | server only | server only | server only | server only | — |
| marks | append | append (now «depois») | append | append, never clean | append, never clean | append, never clean |

---

## 5. Payloads (JSON v1)

Same conventions as Phase 1 rows and Phase 2's `save_rules`: every object carries `"v": 1`, unknown keys are refused
(`unknown_key`, never naming the key), numbers travel as **strings** checked by pattern before any cast (no float,
`"7.896,25"` is `bad_price`), ≤ 8 KB (`payload_too_large`). TS Zod schemas in `app/lib/domain/registro/` are generated from
the same fixtures.

```jsonc
// register_entry(p_account, p_entry, p_dry_run)
{"v": 1,
 "client_key": "9b2…-uuid",            // required when not a dry run
 "symbol": "MES",                       // 1–40 chars, no control characters
 "direction": "long",                   // one of trade_caps(market).directions
 "quantity": "2",                       // qty "int": 1–9999; "dec": > 0, ≤ 10 int and 8 decimal digits; binary: absent
 "entry_price": "7896.25",              // price markets; > 0, ≤ 10 int and 8 decimal digits; on the tick when known
 "stake": "20.00", "payout": "88", "duration_s": 60,   // binary only (stake money; payout 1–100, ≤ 2 decimals)
 "stop_pts": "11", "target_pts": "22",  // optional, stops markets; > 0
 "clock": "America/New_York",           // the clock the screen shows: America/New_York | America/Sao_Paulo
 "entry": "10:07",                      // optional HH:MM on `clock`; absent or the current minute = now()
 "marks": {"setup": "A", "execucao": "no_ponto"},       // optional
 "allow_similar": false}                // see §10.7

// register_exit(p_trade, p_exit, p_dry_run)
{"v": 1, "exit_price": "7903.75", "exit": "10:21", "clock": "America/New_York"}   // price markets
{"v": 1, "exit_price": "1.0832", "pnl": "-37.50", "exit": "10:21", "clock": "…"}   // pnl "typed" markets: pnl required
{"v": 1, "outcome": "ganho"}                                                       // binary: ganho | perda | devolvida

// register_after(p_account, p_trade, p_dry_run): the entry fields plus
{"…": "…", "day": "2026-12-01", "entry": "10:33", "exit": "10:49", "exit_price": "7929.00"}  // or "outcome" / "pnl"

// add_marks(p_trade, p_marks)
{"v": 1, "marks": {"setup": "B", "emocao": null}}       // each key present appends one mark; null = «desmarcar»

// image_slots(p_trade, p_req)
{"v": 1, "keep": ["<ok attachment id>", "…"], "new": [{"mime": "image/webp", "bytes": 860160, "name": "MES_10-04_entrada.png"}]}

// save_extras(p_trade, p_extras)
{"v": 1, "note": "Entrei no bloqueio…",                  // absent = unchanged; null or "" = remove
 "images": ["<id>", "<id>"]}                             // absent = unchanged; else the final ordered list (≤ 4)
```

---

## 6. RPCs

### 6.1 Conventions (as Phases 1–2)

`SECURITY DEFINER`, owner `postgres`, `set search_path = ''`; first statement `auth.uid()` or `not_authenticated`
(28000); account or trade looked up with `user_id = auth.uid()` (`unknown_account` / `unknown_trade`, 42501, also for a
malformed id); errors `raise exception '<code>' using errcode = …` with **no value, no key name**; optional HINT with a
fixed field path (`entry_price`, `marks.setup`) so the screen can focus the field; `revoke all … from public, anon;
grant execute … to authenticated`. Writers of the day take `pg_advisory_xact_lock(hashtextextended('trade_reg:' || uid,
0))` so two registrations of one user never interleave (the context of the second sees the first). Trade-level writers
take `select … for update` on the trade row. Every answer carries `server_now`. `insert into profiles (id) … on conflict
do nothing` before inserting a trade (appendix §A: `trades.user_id` still references `profiles`).

### 6.2 `register_entry(p_account uuid, p_entry jsonb, p_dry_run boolean default false) returns jsonb`

1. Account own (`unknown_account`), not archived (`archived_account`), market has a form (`not_for_market`).
2. `trade_check_entry(market, p)` (pure, returns a code or null, never raises; Phase 2 style).
3. `entry_at`: absent, or equal to the current minute on `clock` → `now()`; else `local_hm_before(entry, clock,
   now())` (§6.7). `now() − entry_at > 15 min` → `entry_too_old` (Q4).
4. `ver := rule_version_at(account, entry_at)`; none → `no_rules` if the account has no version at all, else
   `before_rules` (Q5; appendix §E «para que a primeira operação ao vivo já tenha versão de regra e "desde"»).
5. Instrument (`instrument_specs()->market->match_key`): tick check of `entry_price` (`off_tick`); stops →
   `stop_price = entry_price − dir × stop_pts`, `target_price = entry_price + dir × target_pts` (dir +1 long, −1
   short), each > 0 (`bad_stop`/`bad_target`).
6. `gate := gate_at(account, entry_at) - 'rules'`; plan from it (§7).
7. `similar`: app or imported trades of the account that would match this one (§10.7).
8. Dry run → return the preview (no write). This is what the Registrar shows while the form is filled: «Posso operar
   hoje? Na entrada:», the plan line, the result preview.
9. `client_key` already used by this user → return that trade's state (`"repeated": true`), nothing written.
10. `similar` non-empty and not `allow_similar` → `similar_trade`.
11. Insert the trade (§3.1), the context (`origin = 'live'`), the marks.

Returns `{"dry_run", "server_now", "trade_id", "registered_at", "entry_at", "trading_day", "version": {"id", "version_no"},
"gate": {…}, "plan": {"breaks": […], "verdict", "checks_evaluated": […]}, "similar": [ids], "marks": [{"kind", "value",
"marked_at", "limpa"}], "repeated"}`.

### 6.3 `register_exit(p_trade uuid, p_exit jsonb, p_dry_run boolean default false) returns jsonb`

1. Trade own (`unknown_trade`), app-registered (`not_app_trade`), lock.
2. Already closed by the app (`exit_registered_at` not null) → return its state with `"repeated": true` (a retried tap is
   harmless); closed by a file → `not_open`.
3. Price markets: `exit_price` (tick), `exit_at` from `exit` like the entry (absent or current minute = `now()`); `exit_at
   < entry_time` → `exit_before_entry`; pnl `calc` = `round((exit − entry) × dir × point × quantity, 2)`, else `pnl`
   required (`pnl_required`, `bad_pnl`). Result: `win`/`loss`/`breakeven` by the sign.
4. Binary: `now() < expiry` → `not_expired` (expiry = `entry_time + duration`, Q8); `outcome` → `win` +stake × payout /
   100, `loss` −stake, `breakeven` 0; `exit_at = expiry`; `exit_price` null.
5. Update: `exit_time`, `exit_price`, `pnl`, `result`, `status = 'closed'`, `exit_registered_at` (forced `now()`).

Returns `{"server_now", "exit_registered_at", "exit_at", "pnl", "result", "points", "r" (points / stop points, null
without a stop), "marks": [… with limpa], "repeated"}`; the screen builds «Operação fechada», «+US$ 75,00», «+1,50 R · com
stop de 5 pts» and the two mark lists.

### 6.4 `register_after(p_account uuid, p_trade jsonb, p_dry_run boolean default false) returns jsonb`

Scenario 2. Entry and exit in one call: `entry_at = local_in_trading_day(account, day, entry, clock)`; `exit_at` = the
first instant ≥ `entry_at` with the `exit` wall clock (within 24 h); `exit_at > now()` → `exit_in_future`; binary: expiry
≤ `now()` (`not_expired`). Version, instrument, pnl as above; `source = 'after'`, `status = 'closed'`, `registered_at =
exit_registered_at = now()`; context `origin = 'reconstructed'` with the gate at `entry_at` (counting only trades realized
by then). Marks given here are never clean (they are made after the result).

### 6.5 `add_marks(p_trade uuid, p_marks jsonb) returns jsonb`

Any trade of the owner (the Diário marks imported trades too). Validates kinds and values (`bad_mark`), refuses more than
100 marks per trade (`too_many_marks`, NEW: a runaway client), inserts one row per key, returns `trade_marks_now_v` rows of
the trade. No INSERT grant on the table (verified: a direct insert's CHECK error has no value, but a later column could
leak one, and every other write goes through RPCs).

### 6.6 Images and note: `image_slots`, `save_extras`, `image_trash_done`

`image_slots(p_trade uuid, p_req jsonb) returns jsonb`: trade own, lock; (Q6) caller in `hub_members` (`not_hub_member`);
moves this trade's pendentes to the trash (`substituida`: a new save supersedes an unfinished one) and the user's
pendentes older than 30 min (`reserva_vencida`); checks every `keep` id is an `ok` image of the trade (`unknown_image`);
`count(keep) + count(new) ≤ 4` (`too_many_images`); each new: mime in the three (`bad_mime`), `1 ≤ bytes ≤ 10 485 760`
(`image_too_large`), name (`bad_image_name`); quota (Q6: sum of `bytes`/`claimed_bytes` ≤ 500 MB per user,
`storage_quota`); inserts `pendente` rows with `path = uid/trade/id.ext` (`png`, `jpg`, `webp` from the mime). Returns
`[{"id", "path"}]` for the browser's `storage.from('trade-images').upload(path, file, {contentType, upsert: false})`.

`save_extras(p_trade uuid, p_extras jsonb) returns jsonb`: trade own, lock. `images` present: ≤ 4 (`too_many_images`);
every id is an `ok` image of the trade or a `pendente` one reserved for it (`unknown_image`); each pendente must have its
object: `storage.objects` row in bucket `trade-images` with that name, `owner_id = uid`, `metadata->>'size'` ≤ 10 MiB and
`metadata->>'mimetype'` = the reserved mime (`upload_missing`, `upload_mismatch`); then those become `ok` with `bytes` from
the metadata, `position` = list order, `saved_at = now()`; `ok` images not in the list and leftover pendentes of the trade
are deleted (→ trash, `removida`). `note` present: `char_length ≤ 1000` (`note_too_long`), empty → null; the guard sets
`note_saved_at`. Returns `{"server_now", "saved_at", "note_saved_at", "images": [{"id", "path", "mime", "bytes", "name",
"position", "saved_at"}], "trash": [paths]}`; the screen removes the trash paths through the Storage API, then calls
`image_trash_done`.

`image_trash_done(p_paths text[]) returns jsonb`: deletes the caller's trash rows whose object no longer exists; returns
`{"cleared", "remaining"}`. The Registrar and (Phase 4) the Diário also drain the trash on load (`select path from
trade_image_trash` under RLS), so a closed tab or a cascade never leaves files behind for long.

### 6.7 Internal helpers (revoked from `authenticated` unless a policy or a trigger needs them)

| Function | Body | Notes |
|---|---|---|
| `local_hm_before(hm text, tz text, at timestamptz)` | today's `hm` on `tz`'s calendar if ≤ `at`, else yesterday's (`(date + hm::time) at time zone tz`) | verified: Brasília 23:58 at 00:03 → yesterday; New York 01:30 on 1 Nov → the later (EST) occurrence; 02:30 on 8 Mar (skipped) resolves after `at` and falls to the previous day → `entry_too_old` (documented edge, 02:00–03:00 ET on one night a year) |
| `local_in_trading_day(account, day, hm, tz)` | candidates on `day − 1`, `day`, `day + 1`; keep those whose `compute_trading_day` is `day`; the latest wins; none → `not_in_day` | futures: 18:00–23:59 ET belong to the next day; overnight windows follow Phase 2's rule |
| `trade_match_key(market, symbol)` | upper-case alphanumerics; futures also drop a trailing month + year (`MESM6` → `MES`, `MNQZ25` → `MNQ`) | verified; Ebinex `BTC/USDT` → `BTCUSDT`, so the Registrar's pair list must use the file's spelling (board shows «BTC/USD») |
| `trade_check_entry/exit/after(market, p)`, `trade_check_marks(p)`, `trade_check_extras(p)` | pure validators returning a code, `exception when others then return 'bad_payload'` | Phase 2 pattern; patterns from Phase 1 (`^\d{1,10}(\.\d{1,8})?$` prices, `^\d{1,16}(\.\d{1,2})?$` money) |
| `trade_pnl(market, symbol, dir, qty, entry, exit)` | catalog point value; null when unknown | numeric, rounded to cents |
| `entry_plan(ctx trade_entry_context)` | `breaks` in BREAK_ORDER from the booleans; `verdict` `fora_do_plano` / `no_plano` / `nao_avaliado` | mirrors `evaluatePlan` |
| `trade_result_known_at(…)` | §3.3 | used by the views; executable by `authenticated` |
| `trade_image_upload_ok(name)`, `trade_image_delete_ok(name)` | §9 | stable, definer, boolean only; executable by `authenticated` (storage policies run as the caller) |

### 6.8 Error codes (add to `RPC_ERROR_CODES` in `app/lib/hub/contasDb.ts`; the screens map them to the board copy)

`not_authenticated`, `unknown_account`, `archived_account`, `unknown_trade`, `not_app_trade`, `not_for_market`,
`bad_payload`, `payload_too_large`, `unknown_key`, `bad_rules_version` (`v`), `bad_symbol`, `bad_direction`,
`bad_quantity`, `bad_price`, `off_tick`, `bad_stop`, `bad_target`, `bad_stake`, `bad_payout`, `bad_duration`,
`bad_clock`, `bad_time`, `bad_day`, `not_in_day`, `entry_in_future`, `entry_too_old`, `exit_before_entry`,
`exit_in_future`, `not_expired`, `bad_outcome`, `pnl_required`, `bad_pnl`, `no_rules`, `before_rules`, `similar_trade`,
`not_open`, `bad_mark`, `too_many_marks`, `too_many_images`, `bad_mime`, `image_too_large`, `bad_image_name`,
`unknown_image`, `upload_missing`, `upload_mismatch`, `note_too_long`, `storage_quota`, `not_hub_member`; from triggers
`frozen`, `append_only`; import line code `ambiguous_registered`.

---

## 7. `trade_entry_context`: what is stored and why

| Column | From `gate_at(account, entry_at)` | «Não avaliado» |
|---|---|---|
| `gate_status` | `status` | null (no check ran: no version, window rule off and no limit) |
| `warnings` | `warnings` (`fora_janela` with «“Liberado”, com aviso»; `limite` with «Só avisar») | `{}` |
| `checks_evaluated` | `checks_evaluated` (Phase 3: ⊆ `janela`, `limite`) | `{}` |
| `in_window` | `window.state = 'dentro'` | null |
| `in_block` | Phase 5 | null |
| `after_limit` | `limit.state = 'atingido'` (the trade itself is never in the sum: it is inserted after the gate is computed) | null |
| `day_pnl_at_entry`, `day_worst_at_entry` | `limit.net_usd`, `limit.worst_usd` (account currency, B3 in reais) | null |
| `state_choice`, `rule_ok` | Phase 5 | null |
| `gate` | the whole answer minus `rules` | — |
| `evaluated_at` | `entry_at` | — |

- The version in force is `trades.rule_version_id` (appendix: on the trade). A trade judged by v1 keeps v1 even when v2
  is saved a second later (`fase2/decisoes.md`: «julgadas pela versão em vigor na entrada»).
- `live` vs `reconstructed`: the board's «Na entrada» is exactly what the screen showed at registration; `after` trades
  get a reconstruction at their entry instant. Both are frozen. Imported trades get **no** stored context: their plan is
  computed on read in Phase 4 (`gate.md` GG13 «recalculado»), because a later import of the same day can legitimately
  change it, while an app context is "what the screen said".
- Parity: a shared fixture (`testing/fixtures/registro/plano.json`) of (versions, day trades, entry instant, direction)
  → expected context row is run by Jest through `evaluatePlan` + `toEntryContext` and by SQL through `register_entry(…,
  dry_run)`; the appendix's «a mesma tabela-verdade testa os dois lados». `plan.ts`'s comment «Entry instant
  (registered_at for a live trade)» changes to `entry_time` (ADAPTED, §0.4).

---

## 8. Marks: clean, after, and what counts

| Board situation | `marked_at` vs cut | `limpa` |
|---|---|---|
| Scenario 1, setup A tapped at 10:07 with the entry | 10:07 < exit 10:21 (typed) and < exit registered 10:21:30 | true |
| Same trade, emotion «Ansioso» at 10:15 while open | 10:15 < both | true |
| Same, setup changed to C at 10:25 after «Registrar saída» | 10:25 ≥ exit_registered_at | false; `trade_marks_now_v`: current C, clean A, `changed_after` («trocada às 10:25») |
| Exit registered at 10:30 with typed exit 10:21; emotion marked at 10:24 while the app still showed «Aberta» | 10:24 ≥ typed exit 10:21 | false («Marcas feitas a partir das 10:21 (sua saída) contam como depois do resultado.») |
| Scenario 2 (after), setup at registration | context `reconstructed` | false («Marcas feitas agora contam como depois do resultado…») |
| Scenario 5 (Ebinex 1 min), setup at 20:10:05, expiry 20:11:05 | before expiry | true |
| Ebinex, setup tapped at 20:12 before «Registrar resultado» | ≥ expiry | false (board: «Vencida») |
| Live trade later closed by a file whose exit is 10:18; mark at 10:20 | ≥ file exit | false (the result existed) |
| Imported trade marked in the Diário (Phase 4) | no live context | false |

«Vale em Análises» = `clean_value`; «a troca fica guardada» = the full event list in `trade_marks`. Phase 7 caps marks
with `limpa = false` at «Pouco fundamentada».

---

## 9. Images in Supabase Storage

**Bucket** (in the migration; there is no bucket today):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-images', 'trade-images', false, 10485760, array['image/png', 'image/jpeg', 'image/webp']);
```

**Policies on `storage.objects`** (verified on the stub):

```sql
create policy "trade-images insert reserved" on storage.objects for insert to authenticated
  with check (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.trade_image_upload_ok(name));      -- a pendente row with this path, by this user, < 30 min old
create policy "trade-images select own" on storage.objects for select to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "trade-images delete trashed" on storage.objects for delete to authenticated
  using (bucket_id = 'trade-images' and (storage.foldername(name))[1] = (select auth.uid())::text
         and public.trade_image_delete_ok(name));           -- the path is in the user's trash or still pendente
-- no UPDATE policy: no overwrite, no upsert, no move
```

**Flow** (board: chosen locally, saved on «Salvar imagens e nota»):

1. `image_slots(trade, {keep, new})` → ids and paths (refuses the 5th: `too_many_images`).
2. For each new file: `upload(path, file, {contentType, upsert: false})` with the user's JWT, straight to Storage (the
   Vercel 4.5 MB body limit never applies; no service key in the app). The bucket refuses > 10 MiB and other types; the
   policy refuses any unreserved path or another user's folder.
3. `save_extras(trade, {note, images})` verifies each object and commits, one `saved_at` for the batch.
4. The browser removes the returned trash paths (`remove(paths)`), then `image_trash_done(paths)`.
5. Display: `createSignedUrls(paths, 3600)` (private bucket, select-own policy).

**Max 4, three layers**: reservation (`count(keep) + count(new) ≤ 4` under the trade lock), storage policy (only reserved
paths), commit (list ≤ 4, unique positions 1–4).

**What the database cannot check**: Storage compares the declared Content-Type, not the bytes; a renamed file passes
the bucket. Acceptable in a private, per-user bucket. The appendix asks the browser to re-encode to WebP: that also drops
camera metadata (location) from phone photos; the board's tip («recorte o número da conta») stays the user's job.

**Deletion** goes only through the Storage API: from a trade deletion (cascade → trash), a removal in `save_extras`,
a superseded or expired reservation, an import undo of imported trades with images (Phase 4+). Recent Supabase versions
refuse SQL deletes on storage tables; the design never needs one (pre-flight checks the trigger, §14.1).

**Quota** (Q6): free plan storage is 1 GB for the whole project and sign-up is open; `hub_members` + 500 MB per user.

**Notes** live in `trades.note` (Phase 1 column, ≤ 1 000 code points; the board counts UTF-16 units, so the board is the
stricter one). Neither notes nor images reach any AI route or the Padrões (board ⓘ); no view used by those phases selects
them.

---

## 10. Imports and app-registered trades

### 10.1 Classification of each valid file row (shared by `import_preview`, `import_commit` and, later, the column import)

| # | Situation | Action | Counted as |
|---|---|---|---|
| 1 | `(account, platform, external_id)` exists on an **imported** trade | as built: fill missing fields (`on conflict … do update … where t.source = 'import'`) | `duplicate` / `completed` |
| 2 | that key exists on an **app-registered** trade (linked earlier) | link path (10.3) for this batch if something is still missing; else nothing | `duplicate` / `completed` |
| 3 | key in another account of the user (`notes`) | as built: left out | `other_account` |
| 4 | no key; exactly one unlinked app-registered trade matches (10.2) and it matches no other row | **link** (10.3) | `linked` (NEW) |
| 5 | more than one candidate either way | left out, line code `ambiguous_registered` (Q3) | `ambiguous` (NEW) |
| 6 | otherwise | insert as built | `new` / `inserted` |

### 10.2 Matching rule

Candidates: trades of the **same account** with a context row (app-registered), `external_id is null`,
`trade_match_key(market, t.symbol) = trade_match_key(market, row.symbol)`, same `direction`, and
`t.entry_time ∈ [row_entry − 2 min, row_entry + 16 min]` (live entries are typed to the minute and may be registered up to
15 min late, Q4). A row with one candidate links if that trade has one candidate row. With several, the ones with the
same quantity (futures and the rest) or stake (binary) are kept; if exactly one pair remains mutual, it links; else
ambiguous. Deterministic (order by gap, then id) and tested.

### 10.3 Linking and completing

On the app trade: `source_platform`, `external_id`, `notes = platform || ':' || id` (so the old `(user_id, notes)` key and
the «other account» check keep working); `commission` when null; if `status = 'open'` and the file has an exit at or after
`entry_time`: `exit_time`, `exit_price`, `pnl`, `result`, `status = 'closed'` (`exit_registered_at` stays null: the app
did not register it, and the clean cut becomes the file's exit). Money fields that differ (`entry_price`, `exit_price`,
`quantity`/`stake_amount`, `payout_percent`, `pnl`, `result`): Q2 (recommended: the file corrects them; the old values go
into `before`). Never written on an app trade: `entry_time`, `registered_at`, `source`, `account_id`, `rule_version_id`,
stop/target, `source_local_*` (so `import_fix_tz` can never move it), marks, context, note, images. Each written column
goes into `trade_import_links.before/after`; `differs` lists what was kept (Q2 b).

### 10.4 Undo (`import_undo`, same signature)

Unchanged for the batch's inserted trades (deleted; their marks, links and attachments cascade; images to the trash).
New: for each link of the batch, every column whose current value still equals `after` gets `before` back; `closed`
reopens (`status = 'open'`, exit fields null; allowed by the guard because `exit_registered_at` is null); `set_key`
clears `source_platform`, `external_id`, `notes`; the link row is deleted. The app trade, its marks, its context and its
images stay. A batch with 0 inserted but some links is kept (today's `import_commit` deletes a batch with 0 inserted; it
now keeps it when `rows_linked > 0`, so it can be undone). The owner's Phase 1 decision («desfazer importação apaga as
marcas do lote») applies to the batch's own trades only. A confirmation with counts (`import_undo_preview`, NEW) is left to
Phase 4, when the Diário can mark imported trades.

### 10.5 `import_fix_tz` and `import_tz_status`

Add `and t.source = 'import'` to the moved set (defensive: app trades never carry `source_local_entry`, and the freeze
would refuse the update and abort the whole fix). Nothing else changes.

### 10.6 `import_preview` and the column import

`import_preview` gains `linked` and `ambiguous` (backward compatible keys) so the sheet can say, NEW copy for the screens
spec: «{n} já estavam registradas no app: o arquivo completa a comissão e a saída.» and «{n} parecem com operações
registradas e ficaram de fora.» The column-mapping import (scenario 8, Phase 3b) must call the same classification; for a
file without «ID da operação» it needs a synthetic stable id (content hash) to stay idempotent on re-import, which is its
spec's job.

### 10.7 The other direction: registering what the file already brought

`register_after` (and a live entry typed in the past) checks the same window for an **imported** trade of the account
(`similar`). The dry run lists them; the real call refuses `similar_trade` unless `allow_similar` (Q7), so a «Depois» for
a trade already imported does not create a duplicate silently.

---

## 11. The old pages' bridge

- **Reads**: `useTradesSupabase` selects `*` by user and `market_type`. App trades carry `market_type` (bridge), so they
  appear in `/dashboard`, `/trades`, `/analytics`. Open trades show `result = 'pending'` and `pnl` null (the old stats
  treat null as 0 and count them in the total). Accepted: `/trades` opens `/diario` in Phase 4 and the old pages go in
  Phase 9.
- **Insert**: `revoke insert on trades from anon, authenticated; grant insert (<columns>) to authenticated`, with every
  column the old writers and the tests use: `id, user_id, session_id, symbol, asset_type, direction, entry_price,
  exit_price, quantity, stake_amount, payout_percent, duration_seconds, result, pnl, pnl_percent, strategy, setup_type,
  timeframe, entry_reason, exit_reason, notes, screenshot_entry, screenshot_exit, entry_time, exit_time, market_type,
  account_id, commission, stop_price, target_price`. Not insertable: `source`, `source_platform`, `external_id`,
  `import_batch_id`, `source_local_*`, `trading_day`, `note`, `note_saved_at`, `created_at`, `updated_at` and every Phase 3
  column. Verified: an old-page insert still lands (`source = 'after'`, `registered_at` forced, `status = 'closed'`);
  one naming `source` gets «permission denied for table trades», no values. The legacy `importTrades` body
  (`legacyImport.golden.test.ts`) only uses granted keys; `ignore-duplicates` is `ON CONFLICT DO NOTHING` (no UPDATE
  needed).
- **Update**: revoked from `anon` and `authenticated` (no caller: `updateTrade` is unused). Also TRUNCATE, REFERENCES,
  TRIGGER (Phase 2's follow-up: TRUNCATE bypasses RLS).
- **Delete**: unchanged policy; for an app-registered trade the BEFORE DELETE log and the attachment trash run (Q1).
- **Bridge function**: unchanged. App RPCs insert with `account_id` and `source`, so it only copies `market_type` and
  computes `trading_day`.
- `account_transactions`, `trading_sessions`, `profiles.market_accounts`: untouched.

---

## 12. RLS, grants, indexes

| Object | RLS / policies | Grants |
|---|---|---|
| `trades` | existing `FOR ALL` policy kept | `anon`: SELECT only (RLS → nothing); `authenticated`: SELECT, DELETE, INSERT on §11's columns; no UPDATE/TRUNCATE/REFERENCES/TRIGGER |
| `trade_entry_context`, `trade_marks`, `trade_attachments`, `trade_image_trash`, `trade_import_links` | enabled; one `for select using ((select auth.uid()) = user_id)` each | `revoke all from anon, authenticated; grant select to authenticated`; identity sequence revoked |
| `trade_deletions` | enabled; select own | select to `authenticated` |
| `hub_members` | enabled; no policy | none |
| `trade_marks_v`, `trade_marks_now_v` | `security_invoker = true` | select to `authenticated`, none to `anon` |
| `storage.objects` | the three policies of §9 | Supabase's |
| `register_entry`, `register_exit`, `register_after`, `add_marks`, `image_slots`, `save_extras`, `image_trash_done` | definer | `revoke all from public, anon; grant execute to authenticated` |
| `trade_result_known_at`, `trade_match_key`, `trade_caps_all`, `instrument_specs`, `trade_image_upload_ok`, `trade_image_delete_ok` | invoker (the two image helpers definer) | `authenticated` only (views, policies) |
| validators, `local_*`, `trade_pnl`, `entry_plan`, trigger functions | | `revoke all from public, anon, authenticated` |
| `service_role` | — | `revoke insert, update, delete, truncate` on the new tables (appendix §A: it writes only global tables) |

Indexes: `trades_client_key`, `trades_open`, `trade_marks_trade`, `trade_attachments_trade`, `trade_attachments_position`,
`trade_import_links_batch`; PKs. Nothing else on `trades`.

---

## 13. Tests

`supabase/tests/50_phase3.test.sql` (runs after `40_markets.test.sql`, invented data only) plus a storage stub in
`00_supabase_stub.sql` (`storage.buckets`, `storage.objects` with RLS, `storage.foldername`, grants as Supabase). Instants
after "desde" are built relative to `now()` (Phase 2 lesson); `now()` is fixed per transaction, so steps that need later
server times use separate `begin … commit` blocks.

1. **Migration harmless** (appendix §D «Migração»): every pre-existing trade's `to_jsonb(t) − new columns` unchanged;
   `status = 'closed'`, `registered_at` null on all; trading-day drift 0; versions, accounts, batches unchanged; the four
   earlier test files still pass with M6a applied.
2. **Server times** (§D «Horários forçados»): insert with `registered_at`, `exit_registered_at`, `marked_at`,
   `captured_at`, `reserved_at`, `saved_at`, `note_saved_at` set to 2000-01-01 → stored as `now()`; a later transaction's
   registration has a strictly later `registered_at`.
3. **Freeze**: as owner role, change `entry_time`, `registered_at`, `rule_version_id`, `account_id`, `source`, `symbol`,
   `stop_price` of a live trade → `frozen`; reopen a trade closed by the app → `frozen`; `exit_registered_at` set
   without closing → `frozen`; money update allowed; `registered_at` of an imported row frozen; `import_fix_tz` still
   moves imported rows and never an app row.
4. **Append-only** (§D «Tabelas só de acréscimo»): `trade_marks`, `trade_entry_context` refuse UPDATE/DELETE (owner and
   `authenticated`); deleting the trade cascades them; deleting the auth user cascades everything (verified); `save_rules`
   after a live trade leaves its `trading_day` and version unchanged.
5. **API privileges** (§D «UPDATE de colunas do servidor é recusado»): `authenticated` UPDATE on trades → permission
   denied; INSERT naming `source`/`registered_at`/`status`/`client_key`/`note` → permission denied; old-page insert path
   (Phase 1 test rows) still works; direct INSERT into marks, context, attachments, trash, links → permission denied; anon
   cannot call any new function; `has_*_privilege` matrix of §12.
6. **Two users** (§D «Políticas entre dois usuários»): B reads 0 rows of A in every new table and view; B's
   `register_exit`, `add_marks`, `image_slots`, `save_extras` on A's trade → `unknown_trade`; `register_entry` on A's
   account → `unknown_account`; owner-role insert of a mark with A's trade and B's user → FK violation.
7. **register_entry** (owner test): Top One v1 10:00–11:00 ET, US$ 400 → dry run at 10:07 `liberado`, `in_window`; at
   11:05 ET `fora_janela`, plan `["fora_da_janela"]`, still registers; after −410 realized → `encerrado`, `after_limit`,
   `depois_do_limite`, still registers; `liberado, com aviso` stores warning `fora_janela`; no version → `no_rules`;
   entry before v1 → `before_rules`; archived → `archived_account`; `client_key` repeated → same trade, `repeated`;
   15 min 1 s back → `entry_too_old`; `HH:MM` in the future → `entry_in_future`; dry run writes nothing.
8. **Validation without values** (code only and `position(value in message) = 0`): `"7.896,25"` → `bad_price`; MES
   7896.30 → `off_tick`; stop `"0"` → `bad_stop`; stop beyond zero → `bad_stop`; payout 101 → `bad_payout`; duration 90
   → `bad_duration`; quantity 1.5 on futures → `bad_quantity`; direction `call` on futures → `bad_direction`; unknown key
   → `unknown_key`; clock `"Brasilia"` → `bad_clock`; payload > 8 KB → `payload_too_large`; mark `setup: "D"` →
   `bad_mark`; 101st mark → `too_many_marks`; note 1 001 chars → `note_too_long`.
9. **register_exit / binary**: futures pnl = points × point × contracts, rounded; typed-pnl market without `pnl` →
   `pnl_required`; exit before entry → `exit_before_entry`; repeat → `repeated`; Ebinex before expiry → `not_expired`;
   «Ganho» 20 × 88 % = 17.60, «Perda» −20, «Devolvida» 0 breakeven; `commission` 0 on binaries, null on futures; the
   closed trade now counts in `limit_usage` and `rules_now()`.
10. **register_after**: day + HH:MM on futures at 18:30 ET belongs to the next day; `not_in_day`; exit in the future;
    context `reconstructed`; marks never clean; `similar_trade` against an imported trade and `allow_similar`.
11. **Clean marks** (§8 table, every row) through `trade_marks_v` and `trade_marks_now_v` (`changed_after`, desmarcar).
12. **Images** (§D «Imagens»): 4 reserved and committed; the 5th `image_slots` → `too_many_images`; `save_extras` with 5
    ids → `too_many_images`; stub insert into `storage.objects` of an unreserved path, another user's folder, an expired
    reservation → RLS refusal; commit without the object → `upload_missing`; object with another mime or 11 MiB in
    metadata → `upload_mismatch`; removal queues the trash; `delete` policy allows only trashed/pendente paths;
    `image_trash_done` clears only absent objects; deleting the trade queues its paths; quota; `not_hub_member`. Bucket
    row has `public = false`, 10 485 760, the three mimes. (The real 11 MB and GIF refusals are Storage's: manual check,
    §14.4.)
13. **Imports with app trades** (§D «Importação»): live MES trade, then a Top One file with the same trade (symbol
    `MESM6`, entry 40 s earlier) → `linked`, commission filled, key set, 0 inserted, batch kept; re-import → duplicate,
    0 changes; the same file into another account → `other_account`; open live trade + file with the exit → closed by
    the file, `exit_registered_at` null, mark after the file exit not clean; two live trades within the window and one
    row → `ambiguous` (line code only); undo → the trade, its marks and context remain, completion reverted, key cleared,
    reopened if the file had closed it; undo of an ordinary batch still deletes its trades (Phase 1 test unchanged);
    `import_fix_tz` dry run counts no app trade; Ebinex live trade (stake 20, `EUR/USD`) matched by `EURUSD` file row.
14. **Delete log** (Q1): old-page delete of a live trade as `authenticated` → one `trade_deletions` row, children gone,
    image paths in the trash (verified); deleting an imported trade logs nothing.
15. **Gate parity**: the Phase 2 fixtures (`cases.json`) through `register_entry` dry run produce the same
    status/warnings/checks as `gate_at`; `toEntryContext` ↔ stored row on the plan fixture.

Jest: Zod schemas accept/refuse the payload fixtures; `TRADE_CAPS`/`INSTRUMENTS` parity with the SQL literals (as
`markets.test.ts` does for `market_caps_all`); `localHmBefore` and `tradeMatchKey` parity fixtures; pnl calculator;
`hubRegistrar.pg.test.ts` (BH_PG_URL, throwaway cluster only) for the TS payload builder → RPC dry run → same plan as
`evaluatePlan`; every new route (none planned) in `routesRequireAuth.test.ts`.

End to end (appendix: Playwright only with the owner's OK): register with an image at 375 px in both themes.

---

## 14. Rollout on the real project (paste-ready kit, scratchpad `fase3/aplicar/`)

### 14.1 Pre-flight (read-only; he pastes it and sends back the JSON)

- `trades`: count, by `source`, `result` null or `pending`, `exit_time < entry_time` (the open-shape CHECK only constrains
  `status = 'open'`, so old rows pass regardless), rows with `notes` key and null `external_id`.
- Privileges and policies on `trades` today (`information_schema.role_table_grants`, `column_privileges`, `pg_policies`).
- Storage: `select count(*) from storage.buckets` (memory: 0), `storage.objects` count, policies on `storage.objects`,
  triggers on `storage.objects` (a protect-delete trigger), owner of `storage.objects`,
  `has_table_privilege('storage.objects', 'select')`, `rolbypassrls` of `postgres` (`save_extras` reads
  `storage.objects` as the function owner).
- An **ensaio** in its own transaction: `begin; create policy bh_probe on storage.objects for select to authenticated
  using (false); insert into storage.buckets (id, name) values ('bh-probe', 'bh-probe'); rollback;`. If `create policy` is
  refused («must be owner»), §9's three policies are created in the Dashboard (Storage › Policies) with the same
  definitions, and the bucket and policies leave the transactional file.
- `md5(pg_get_functiondef(…))` of `import_commit`, `import_preview`, `import_undo`, `import_fix_tz`, `trades_bridge`
  (must equal the repo's text, as Phase 2b checked).

### 14.2 `fase3_aplicar.sql` (one block; any failure applies nothing)

1. `begin;` schema `backup_fase3` (revoked from the API, RLS on): `trades`, `import_batches`, `trading_accounts`,
   `account_rule_versions`, `profiles`, a `privileges` snapshot of `trades`, the four replaced function definitions, and
   `respostas_em_vigor` (`gate_at` composition per account at `now()`, as 2b).
2. The four migration files, verbatim.
3. The migration's own last statement (also run in CI): a `do` block that raises `m6a_*: <count>` (counts only) if any
   pre-existing trade differs over its old columns, any `trading_day` drifts, any account/version/batch row changed (old
   columns), any new table is non-empty, the bucket is not exactly as specified, `authenticated` still has UPDATE/TRUNCATE
   on `trades` or INSERT on a non-listed column, any new function is executable by `anon`, or a policy is missing.
4. Conferência JSON (only counts and names): `operacoes` = `operacoes_no_backup`; `operacoes_mudaram` (compare
   `to_jsonb(t) - array['status','registered_at','exit_registered_at','rule_version_id','client_key']` with the backup), `dia_do_pregao_mudou`,
   `contas_mudaram`, `versoes_mudaram`, `lotes_mudaram`, `perfis_mudaram`, `respostas_mudaram` = 0; `operacoes_abertas` = 0;
   `contextos`, `marcas`, `anexos`, `lixeira`, `vinculos`, `apagadas` = 0; `bucket` = «trade-images | privado | 10 MB |
   png, jpeg, webp»; `politicas_storage` = the three names; `colunas_inseriveis_pela_api` = the list of §11;
   `funcoes_para_anonimos` = []; `backup_fase3_rls` all true. `commit;`
5. A second paste fails at once (`backup_fase3` exists) and changes nothing.

### 14.3 `desfazer_fase3.sql`

Refuses (and changes nothing) if any trade has a context, a mark, an attachment or a link, or the bucket holds objects
(then the data is real and the owner decides). Otherwise drops the views, the new tables, functions, triggers and
storage policies, the bucket row (or tells him to delete it in the Dashboard if SQL is refused), the five columns and two
batch counters; restores the four functions from `backup_fase3` and the `trades` privileges from the snapshot. `testar.sh
desfazer` proves every public function text, setting and privilege equals the pre-paste state.

### 14.4 `testar.sh` scenarios (throwaway PG15 shaped like Supabase: `service_role`, default EXECUTE to the API roles,
storage stub)

`normal` (legacy seed → paste → conferência; 20/30/40/50 tests pass), `estado_vivo` (owner-like: 629-shaped invented
trades, the owner's v1 versions, two batches → paste → `rules_now` and `gate_at` answers identical), `duas_vezes`,
`dia_divergente` (a tampered trading day stops the paste), `mutacao` (a guard that lets `entry_time` change → paste passes
but 50 fails), `desfazer`, `desfazer_com_dados` (refuses).

After the paste: (Q6) `insert into public.hub_members (user_id) select id from auth.users where email = '<the
owner's trading account email>'` as a separate one-line paste (scratchpad only); the owner test; then two manual Storage
checks in the app: an 11 MB image and a GIF are refused («Esta imagem passa de 10 MB.», «Só imagens PNG, JPG ou WebP.»
come from the screen first; the bucket refuses them even if the screen is bypassed). Test trades registered during the
owner test are real rows that count in the day's limit: register them on a test account or delete them afterwards (Q1).

---

## 15. TypeScript surface (for the screens agent)

- `app/lib/domain/registro/`: Zod payload schemas (§5), `TRADE_CAPS` and `INSTRUMENTS` (parity with the SQL literals),
  `tradeMatchKey`, `pnlFor`, `stopLevels`, `resultKnownAt`, `isClean` (same rule as the view, for previews), shared
  fixtures in `testing/fixtures/registro/`.
- `app/lib/domain/tempo.ts`: `localHmBefore(hm, tz, now)` with a parity fixture against `local_hm_before`.
- `app/lib/hub/registrarDb.ts`: `registerEntry`, `registerExit`, `registerAfter`, `addMarks`, `imageSlots`,
  `saveExtras`, `imageTrashDone`, `drainImageTrash` through the existing `rpc()` helper and Storage client; codes §6.8.
- `app/types/database.ts`: the new columns and tables.
- No new API route (Q6 a): every call is the user's own session under RLS or a definer RPC, like Phases 1–2.

---

## 16. Gaps: boards vs appendix vs as-built

| # | Gap | Resolution here |
|---|---|---|
| G1 | Appendix `entry_time = registered_at = now()`; board lets the trader type «Hora (ET)» (≤ now) | ADAPTED: typed instant in `entry_time`, server `registered_at`, ≤ 15 min back (Q4); gate at `entry_time` («Na entrada:») |
| G2 | Appendix `register_exit(trade, price, pnl, result)` with a client pnl; board computes «Resultado: +7,50 pts · +US$ 75,00» from prices × multiplier | Server computes for catalogued futures and binaries; typed for other markets |
| G3 | Appendix `limpa = source live and marked_at < exit_registered_at`; board cuts at the typed exit or the expiry | `least(result_known_at, exit_registered_at)`, live read from the context |
| G4 | Appendix image route `POST /api/trades/[id]/anexos` with a signed upload URL and a Saturday cron; the app has no service key and no cron | Reservation RPC + storage policy + browser upload with its JWT; sweep on save and on load; trash drained by the browser |
| G5 | Appendix stores Phase 5 fields in `trade_entry_context` | Deferred to Phase 5; added `evaluated_at`, `warnings`, `day_worst_at_entry`, frozen `gate` (GG4) |
| G6 | Appendix `import_undo(batch, confirmar_cascata)`; as-built `import_undo(p_batch)`; owner decided undo deletes the batch's marks | Signature kept; app trades are never in a batch; `import_undo_preview` (counts) in Phase 4 |
| G7 | Appendix UPDATE column grant from `useTradesSupabase.ts:141`; no screen calls `updateTrade` | UPDATE revoked entirely |
| G8 | Appendix «Ao inserir: força registered_at» for every insert | Kept for every writer from M6a on; the 629 rows stay null (no backfill) |
| G9 | Board stop/alvo «em pontos»; as-built `stop_price`/`target_price` are levels (Top One SL/TP) | Converted server-side; the Diário's «às» = `registered_at` |
| G10 | Board «Hora» is `HH:MM` without a date | `local_hm_before` (live) and trading day + `HH:MM` (after), in Postgres (appendix §A: one conversion place) |
| G11 | Board expiry = entry + expiração; Ebinex runs on the next candle («Vela», owner-confirmed in Phase 1) | Q8 |
| G12 | Diário: file-only trades «entram com o “Posso operar hoje?” recalculado» | No stored context for imports; plan computed on read in Phase 4 |
| G13 | No board covers a double tap, a lost response on the phone, or registering what the file already brought | NEW `client_key`, `repeated`, `similar_trade` (Q7) |
| G14 | No board deletes a registration | Q1 |
| G15 | Phase 2 `personalizar.md` P12 «Registrar refuses nothing» vs `banco.md` §7 and appendix §E (a version before the first live trade) | Q5 (recommend refusing) |
| G16 | ImportarConta scenario 4 «escolha se mudam para cá» (move between accounts) is not built | App trades never move (`account_id` frozen); a future move feature must skip them |
| G17 | Column import (scenario 8) without IDs | Same classification; synthetic id is that spec's job (§10.6) |
| G18 | Registrar pair list «BTC/USD» vs Ebinex file `BTC/USDT` | Match key compares alphanumerics only; the screen should offer the file's spellings |
| G19 | Creating storage policies from the SQL Editor may be refused on newer projects | Pre-flight ensaio; Dashboard fallback (§14.1) |
| G20 | Board «Imagens e nota» is per trade, saved at once; the appendix uploads one by one with `pendente → ok` | One reservation call and one commit per «Salvar», one `saved_at` |

---

## 17. Open questions for the owner

**Q1. Como apagar uma operação registrada errada (ou as do teste)?** Nenhuma prancha tem «apagar». As do teste da Fase 3
entram no seu limite do dia.
- (a) A página antiga `/trades` continua apagando; o banco guarda que uma operação do app foi apagada (data e hora,
  nunca os valores) e as imagens saem do armazenamento.
- (b) Bloquear isso na página antiga e criar «Apagar registro» no Registrar (texto novo, precisa do seu OK).
- (c) Nunca apagar: «Descartar» deixa a operação guardada e fora das contas (Fase 4).

*Recomendo (a) agora e (c) no Diário da Fase 4:* você consegue limpar o teste hoje, e nada some sem rastro.

**Q2. O arquivo da corretora chega e a operação já foi registrada no app com valores diferentes (preço, contratos,
resultado). Qual vale?**
- (a) O arquivo corrige preços, quantidade e resultado; o horário, as marcas, o stop/alvo e o «Posso operar hoje?» da
  entrada ficam como você registrou. Desfazer a importação devolve os valores do app.
- (b) Vale o que você registrou; o arquivo só completa o que faltava (comissão, saída) e a importação mostra quantas
  diferem.

*Recomendo (a):* o arquivo é o extrato da corretora (as Análises da Fase 6 contam dinheiro), e a prova do diário (hora e
marcas) não muda.

**Q3. Uma linha do arquivo parece com duas operações registradas no app (mesmo ativo e lado, minutos de diferença).**
- (a) Fica de fora, com o número da linha na lista da importação, para você conferir.
- (b) Entra como operação nova (pode duplicar).

*Recomendo (a):* nunca duplicar; isso só acontece com entradas muito próximas no mesmo ativo.

**Q4. Ao vivo, até quanto tempo antes de agora a hora da entrada pode ser?** A prancha só proíbe «depois de agora».
- (a) Até 15 minutos; para mais, use «Registrar depois» (as marcas passam a contar como depois do resultado).
- (b) Sem limite, como na prancha.
- (c) Só agora, sem campo de hora.

*Recomendo (a):* cobre o registro atrasado de quem está operando e impede que uma entrada de horas atrás pareça ao vivo.

**Q5. Conta sem regras salvas: registrar mesmo assim?**
- (a) Não: «Salve as regras desta conta antes de registrar.» (texto novo) com o link para Personalizar.
- (b) Sim, como «não avaliado»; a operação fica antes do «desde», junto do histórico.

*Recomendo (a):* é o que o plano aprovado pede (toda operação ao vivo com versão de regras e «desde»). Hoje todas as
suas contas já têm regras.

**Q6. Quem pode enviar imagens?** O cadastro do app é aberto, e o armazenamento grátis do projeto é 1 GB no total.
- (a) Só quem estiver numa lista no banco (hoje só você), com teto de 500 MB por pessoa.
- (b) Qualquer conta, só com o teto de 500 MB.
- (c) Uma rota no servidor que confere a `HUB_USERS`; pede a chave de serviço do Supabase na Vercel, que o plano reserva
  para tarefas agendadas.

*Recomendo (a):* nenhum segredo novo, e ninguém de fora enche o seu armazenamento.

**Q7. «Registrar depois» uma operação que já veio do arquivo.**
- (a) Avisar «Esta operação parece já ter vindo do arquivo» (texto novo) e só registrar se você confirmar.
- (b) Recusar sempre.
- (c) Registrar sem avisar (vira duplicada).

*Recomendo (a):* evita a duplicada sem impedir um caso legítimo (duas operações iguais no mesmo minuto).

**Q8. Quando vence uma opção da Ebinex registrada no app?** A prancha usa «entrada + expiração» (20:10 + 1 min = 20:11).
No arquivo da Ebinex, a opção roda na vela seguinte à ordem (você confirmou na Fase 1: saída = Vela + Tempo, 20:12).
- (a) Como a Ebinex: «Ainda não venceu» até o fim da vela seguinte, e a hora de saída é essa.
- (b) Como a prancha: entrada + expiração.

*Recomendo (a):* a hora de saída bate com o arquivo, e a marca feita na vela em andamento ainda conta como antes do
resultado.
