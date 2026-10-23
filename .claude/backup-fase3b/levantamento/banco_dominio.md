# Phase 3b · Database and domain design: the column-mapping import

Scope: how a CSV from any broker or platform, mapped column by column to the hub's fields and saved as a reusable
«modelo», becomes trades in the database, designed against the code as built at `3f439f8` (= `main` =
`feature/rebuild-lean`, migrations live through `20261023000003`). Screens are another spec's job; this one names what the
screens must send and show only where the database or the domain decides it.

Research only. Nothing in the repo was edited, the live Supabase was not called, no `.env` was read. From `docs/csv` only
file names and line counts were looked at: four files, all Ebinex or Top One. No export of a new market or of another
platform exists locally. Web research covers public export formats only (sources at the end).

Read for this spec:
- Repo: `CLAUDE.md`; migrations `20261017000003` (batches, `import_check_platform`), `20261018000002`
  (`import_checked_rows`), `20261020000001` (trade cycle, `trade_match_key`, `trade_instrument`), `20261020000003`
  (`trade_pnl`, option checks), `20261020000004` (links, `import_link_patch`, `import_tz_status`), `20261022000001`
  (`trade_caps_all`, `instrument_specs`), `20261023000001` (`market_caps_all`), `20261023000002` (`trade_exits`, sums,
  guards), `20261023000003` (`import_stage`, `import_exits_link`, `import_preview`, `import_commit`, `import_undo`,
  `import_fix_tz`, the end-of-file proof); `app/lib/domain/import/*`, `app/lib/domain/markets.ts`,
  `app/lib/domain/registro/{match,pnl}.ts` (headers), `app/components/hub/importar/{flow.ts,ImportSheet.tsx}` (the
  `fileTarget` gate), `app/lib/hub/{contas,contasDb}.ts` (platform keys, batch reads), `supabase/tests/run.sh`, the
  `__tests__/domain/cases3c.*` pattern.
- Scratchpad: `fase3/levantamento/importacao_colunas.md` (the 3b scoping, partly STALE), `fase3/levantamento/sintese.md`
  §8, `fase3/decisoes.md`, `fase3c/decisoes.md`, `fase3c/banco.md` §9.11, `fase3c/pr_banco.md` (the paste kit as built),
  `mercados/fatos_mercados.md` §1.3, §2.3, §3.3, §4.2, §5.4, `panel/v31/plano.md`, and the sibling survey
  `fase3b/levantamento/estado_atual.md` (the as-built inventory: this spec does not repeat it; §1 gives only what the
  design leans on).
- The approved board `fase3b/quadro/atual/project/ImportarConta.dc.html` (1 205 lines, sha256 `4894363073c6c66f…`),
  read as markup only. Scenario 8 is unchanged from the 2b board: `mapa` l.490–502, `conferir` l.504–514, logic
  l.1047–1081, footer l.1149–1150, end card l.1117–1118.

Markers: **NEW** = on no board; **ADAPTED** = a board string or behaviour changed (reason given). pt-BR strings are quoted
exactly with their board location; proposed pt-BR copy for NEW codes is marked as a proposal for the screens spec.

**Revision of 21 Oct (review fixes R1–R16, `sintese.md` §8).** Changed here:
- §0: items 6–8;
- §2.1 and §12: `p_format` on `import_preview`/`import_commit` (R3);
- §2.3 and §4.5: one «Conta» value per import, routes in one market, `p_replaces` (R9, R13);
- §3.5 and the NEW §3.6: format-aware overlap count (R3);
- §4.1: `import_batches.header_sig`, and `result_is_net` covering swap (R3, R8);
- §4.4: executed quantity, and unfilled rows skipped (R2);
- §4.6: detection after the account (R5);
- §5.3: decimal mark once per file (R6);
- §6.2–6.6: the end-of-file rule (R1), and the realized result winning with its allocation (R7);
- §7.1–7.3: key times, and identical rows (R12, R14);
- §8: a mapped file never opens `conf` (R4);
- §9.1–9.2: swap (R8);
- §14: codes; §16.1: tests; §18: risks.

The owner questions at the end are superseded by `perguntas.md`. Where a paragraph below still says otherwise, the
revised section wins.

---

## 0. Summary

1. **One path.** Mapped rows enter through the same four RPCs as Ebinex and Top One (`import_preview`, `import_commit`,
   `import_undo`, `import_fix_tz`) with `p_platform = 'modelo'`, the same `ImportRow` payload (widened by five optional
   keys) and the same `import_stage` classification. There is no second commit function, no API route, no CSV on the
   server and no table of fills. One new RPC, `import_template_save`, writes the «modelo» after a commit.
2. **Platform and market.** Every mapped batch, trade and file exit carries `'modelo'`. The file's market is the
   destination account's market. A new `"mapping"` capability in `market_caps_all()` (true for every market but
   binaries) decides where `'modelo'` is accepted (`wrong_market` otherwise).
3. **No legacy `notes` key for mapped trades.** The cross-account check («em outra conta») for `'modelo'` uses real
   broker IDs only, and only against accounts of the same market and the same named platform. Synthetic keys never count
   there, because identical trades in two accounts are copies.
4. **Templates.** `import_templates` holds one row per user and header signature (sha256 of the sorted, normalised header
   names). It stores the choices and never a cell value. Account numbers from a «Conta» column are stored only as hashes.
   Select and delete go through RLS (own rows). Insert and update go only through `import_template_save`, which
   validates the JSON. Built-in readers always win. An exact header set applies the template. A changed set pre-fills
   `mapa`.
5. **Browser vs database.** The browser reads the file: delimiter, header line, decimal mark, dates, sides, symbols, net
   to gross, and pairing of fills. It sends wall clocks and exact decimals, as the readers do. The database stays
   canonical for: the synthetic key, `asset_type`, the P&L from prices (it recomputes and refuses a mismatch), instants
   and trading days, positions, links and de-duplication.
6. **Execution files (one fill per row)** are paired in the browser into **slices**. A slice is one opening fill's
   quantity closed by one closing fill. Pairing is FIFO per symbol as written, each entry fill is its own lot, and a fill
   that passes zero opens the other side. The slices of one lot share symbol, side, entry instant and entry price, so
   3c's `import_stage` folds them into **one trade with one file exit per slice** (`trade_exits`), and links them whole
   to a registered trade. Rows with no executed quantity are skipped (R2). Fills of the same second, side and symbol (or
   of the same order ID) merge first. A lot still open at the end of the file, or a close with no opening in the file,
   is left out and counted. Without an «Abre ou fecha» column, a symbol whose fills do not close by the end is asked
   about, and by default all its fills stay out (R1, §6.4). A mapped realized result wins over prices (R7).
7. **De-duplication without an ID** («mesma hora e preço», board l.429). The database derives
   `'@' + 32 hex + '.' + n` from the row's times (the UTC instant for rows with an offset, the wall clock for the
   others, R12), symbol, side, quantity, prices and option contract. `n` is the occurrence of the same tuple in the file,
   so identical rows keep distinct keys. With an exit time they fold into one trade with one exit each, as 3c folds rows
   of one position (R14). The key does not depend on the zone. A position-level fallback also treats as already
   imported a row whose tuple matches a `'modelo'` trade imported with the other key method.
8. **Zone.** Unchanged per account (`file_tz`, `tz_applied_at`, the `c` step, `import_fix_tz`). A mapped file never opens
   `conf`: for `'modelo'`, `tz_not_confirmed` answers `tz_mismatch` (R4, §8). A header that states the clock («Trade
   Time(UTC+0)») or ISO offsets in the cells make the rows exact. The template keeps a zone hint for accounts that have
   no confirmed zone yet.
9. **Money.** A «Resultado» column wins (decision 2: the file wins on money), with the template's «já desconta a
   comissão?» turning net into gross. Without it, the P&L comes from prices only where `trade_instrument` computes it,
   and is stored with `pnl_basis` `'prices'`/`'estimate'` instead of `'file'`. Commission is a positive cost in the
   account's currency. Crypto pairs not quoted in a dollar coin are refused (they include COIN-M).
10. **`asset_type`** comes from `trade_instrument(market, symbol, option)`, as Registrar stores it. OCC option symbols in
   stocks or options accounts become a listed option (right, strike, expiry, ×100). Futures symbols written another way
   («MES 12-26», «/MESZ26») are normalised to «MESZ26» so they compute and link.
11. **Linking** to registered trades is 3c's, inherited as is. The one addition: candidates must also have the same
   option contract, or no contract on either side.
12. **Build.** Two migrations (`20261024000001`, `20261024000002`), one SQL test file `82_importacao_colunas.test.sql`,
   shared cases `cases3b.json` recorded from the SQL, and a paste kit in the 3c format. No existing row changes. The
   Ebinex and Top One answers stay as they are (golden suites). Database and domain take about 7–8.5 days, executions
   included. Whole phase with screens and board: about 11–13.5 days.

---

## 1. What the design leans on (as built; full inventory in `estado_atual.md` §1–§2)

| Piece | Where | Why 3b cares |
|---|---|---|
| `ImportRow` (keys = `trades` columns, wall clock + optional offset, exact decimal strings, `line`) | `lib/domain/import/types.ts` | the one row shape every reader produces; 3b's mapped reader produces it too |
| `import_checked_rows` (validation, placement `AT TIME ZONE` for offset-less rows, `compute_trading_day`, `duplicate_in_file`) | `20261018000002:167–312` | the per-platform branch, `external_id` required (`bad_id`), `asset_type` checked not derived |
| `import_check_platform` (`ebinex` ↔ binary, `topone` ↔ futures) | `20261017000003:289–304` | hard-coded to two readers |
| `import_batches.platform check in ('ebinex','topone')` | `20261017000003:12` | must take `'modelo'` |
| `import_stage` (`elsewhere` by `notes` and file-exit tickets; `existing_id`; 3c positions `grp`; `path` dup/attach/group/row; one-to-one links) | `20261023000003:1351–1501` | the classification 3b reuses; `elsewhere` must not use `notes` for mapped rows |
| `import_link_patch` (row path; writes `notes`, `pnl_basis 'file'`) | `20261020000004:143–200` | `notes` and basis |
| `import_exits_link` (exits path; writes `notes`; file exits `pnl_basis 'file'`) | `20261023000003:1519–1701` | same |
| `import_preview` / `import_commit` (inserts `notes = platform:id`, `pnl_basis 'file'`) | `20261023000003:1712–2084` | same |
| `import_undo`, `import_fix_tz`, `import_tz_status` (`source = 'import'` only) | `20261023000003:2095–2285`, `20261020000004:121` | reused unchanged |
| `trade_exits` (file rows per batch: ticket `(account_id, source_platform, external_id)` unique where `origin = 'file'`; `pnl_basis ∈ prices, estimate, typed, file`) | `20261023000002:99–150` | slices become file exits |
| `trade_caps_all()`, `instrument_specs()`, `trade_match_key`, `trade_instrument`, `trade_pnl` (+ TS twins `TRADE_CAPS`, `INSTRUMENT_SPEC`, `tradeMatchKey`, `tradeInstrument`, `pnlFromPrices`, Postgres `numeric` in `registro/numeric.ts`) | `20261022000001`, `20261020000001:196–262`, `20261020000003:232` | P&L from prices and `asset_type`, one definition |
| `assignImportLinks` (TS twin of `import_stage`'s links; its header already says it serves the column import) | `lib/domain/registro/match.ts:1–6` | previews of links |
| `MAX_FILE_BYTES` 5 MB, `MAX_RECORDS` 10 000 | `types.ts:244–247` | limits |
| `fileTarget()` refuses a context account whose market has no reader | `ImportSheet.tsx:306–309` | becomes `reader || mapping` (screens) |
| `lib/domain` may not import `lib/hub` (`boundary.test.ts`); the pt-BR number reader is `lib/hub/numero.ts` | — | the mapped reader needs its own locale-aware number parser inside `lib/domain/import` |

---

## 2. One path in

### 2.1 The flow

```
browser                                                   database (SECURITY DEFINER, search_path '')
───────                                                   ───────────────────────────────────────────
bytes → text (UTF-8, else windows-1252)                   (as built)
text → records (delimiter sniffed, NEW)
header → Ebinex? Top One? → their readers (unchanged, always first)
       → template whose signature matches? → mapped reader with it
       → else «mapa» / «conferir» → mapped reader with the choices
mapped reader → ImportRow[] + errors + warnings + notices
   (trade rows: one row per closed trade or per exit;
    fill rows: paired into slices, §6)
                         ── import_preview(acc, 'modelo', …, p_format) ──▶  import_check_platform → import_stage → counts
   step c (zone; never conf for 'modelo'), step d (preview)
                         ── import_commit(acc, 'modelo', …, p_format) ───▶  batch (+ header_sig) + trades + trade_exits + links
                         ── import_template_save(tpl, batch) ──▶  upsert template; batch.template_id/name (NEW)
«Desfazer»               ── import_undo(batch) ────────────────▶  unchanged
«Confirmar fuso»         ── import_fix_tz(acc, tz, dry) ───────▶  unchanged
```

### 2.2 What is not added, and why

- **No second commit function.** Since 3c, `import_stage`/`import_commit` carry about 700 lines of linking, grouping and
  undo rules. A copy would drift from them. `'modelo'` is a third value of a parameter they already take.
- **No server-side CSV parsing.** The file never leaves the browser. Only `ImportRow` keys travel (`toRpcRow`). That is
  what keeps cell values out of server logs and errors today.
- **No table of fills.** Pairing fills against fills imported earlier would have to re-pair old trades whenever an
  earlier file arrives late. That conflicts with «nada que já existe pode mudar», with undo and with links. Pairing stays
  inside one file (§6.4).
- **No API route** (`routesRequireAuth.test.ts` unchanged). Every new call is an RPC under the user's JWT, like the
  import RPCs.

### 2.3 Several accounts in one file («Conta» column)

**Revised (R9): one value per import.** When «Conta» is mapped and the file names two or more values, step `h` (minimal
form: «Importar em {conta}» / «Não importar»; screens spec) lets **one** value go into the destination account; the
other values' rows are left out and counted («não importadas»). Only accounts of the destination's market are offered.
Preview and commit run once, so there is one batch and one «Desfazer». The next value is imported from its own account,
and what already entered never duplicates. The multi-batch commit (several accounts in one sheet, with two previews, two
zone checks and G2 per account) is deferred. The template keeps the routing as `{sha256(value): account_id}` (§4.1), so
a broker account number is never stored in clear.

---

## 3. Platform value, the file's market, cross-account IDs

### 3.1 `'modelo'` everywhere

`import_batches.platform`, `trades.source_platform` and `trade_exits.source_platform` are `'modelo'` for every mapped
row. That fits `^[a-z0-9_]{1,20}$`.

Alternatives considered:
- **The account's platform key** (`tradovate`, `ibkr`, `binance`…, `trading_accounts.platform`, which the API cannot
  change after creation). It would scope keys per broker by itself. Rejected: `'outra'`, `'naosei'`, null and `'mt5'`
  (three markets) need a fallback anyway. `'topone'`/`'ebinex'` must never be written by a mapped file, because the
  bridge trigger and `import_check_platform` treat them specially. The batch check would have to list every key.
- **One value per template.** Rejected: a broker that adds a column produces a new header signature, so a new template,
  so a new platform. Every trade of the next export would then import again.

### 3.2 The file's market = the destination account's market

A mapped file states no market. The destination account decides it: currency, quantity unit, `trade_instrument`, day
clock. `market_caps_all()` gains `"mapping": true` for futures, forex, stocks, crypto, b3 and options (options accounts
exist from the 2b backfill, never offered), and `false` for binary. Binaries need stake, payout and expiry, which the
board's `D.campos` (l.564) does not have, and Ebinex has its reader. `MARKET_SPEC.mapping` mirrors it, and the parity test
`markets.test.ts` reads the newest literal.

```sql
-- import_check_platform (replaced, same signature)
if p_platform is null or p_platform not in ('ebinex', 'topone', 'modelo') then
  raise exception 'unknown_platform' using errcode = '22023';
end if;
if (p_platform = 'ebinex' and p_account.market <> 'binary')
   or (p_platform = 'topone' and p_account.market <> 'futures')
   or (p_platform = 'modelo' and not coalesce((public.market_caps_all() -> p_account.market ->> 'mapping')::boolean, false)) then
  raise exception 'wrong_market' using errcode = '22023';
end if;
```

### 3.3 No legacy `notes` key for `'modelo'`

`notes = platform || ':' || external_id` is unique per user (`trades_user_id_notes_unique`). Two accounts holding the same
synthetic key (copy trading: the same trade in both) would make the second commit fail with `concurrent_import`. Phase 9
drops the key, and no old page reads new-market trades. So `notes` stays null for `'modelo'` in all four places that
write it: `import_commit` steps 1 and 2, `import_link_patch`, `import_exits_link`. The expression becomes
`case when p_platform in ('ebinex', 'topone') then p_platform || ':' || x end`.

### 3.4 «Em outra conta» for mapped rows

As built, `elsewhere` looks up `notes` user-wide plus file-exit tickets of the same platform in other accounts. For
`'modelo'` the same lookup would collide across unrelated brokers (IBKR trade `12345` and a Tradovate order `12345`) and
across copies. The new rule, for `'modelo'` only:

```sql
r.key_kind = 'real' and p_account.platform is not null and p_account.platform not in ('outra', 'naosei')
and (exists (select 1 from public.trades t join public.trading_accounts o on o.id = t.account_id
             where t.user_id = p_account.user_id and t.account_id <> p_account.id
               and t.source_platform = 'modelo' and t.external_id = r.external_id
               and o.market = p_account.market and o.platform = p_account.platform)
     or exists (select 1 from public.trade_exits e join public.trading_accounts o on o.id = e.account_id
                where e.user_id = p_account.user_id and e.account_id <> p_account.id and e.origin = 'file'
                  and e.source_platform = 'modelo' and e.external_id = r.external_id
                  and o.market = p_account.market and o.platform = p_account.platform))
```

Two partial indexes, empty when created: `trades (user_id, external_id) where source_platform = 'modelo'` and
`trade_exits (user_id, external_id) where origin = 'file' and source_platform = 'modelo'`. Ebinex and Top One keep the
as-built expression.

### 3.5 What the screens need from this (pointer only)

`fetchImportFormats` compares `import_batches.platform` to tell «{conta} já recebeu este formato» (step `a`). For mapped
files it must compare the format of §3.6 (`header_sig`, or `template_id`), because every mapped batch is `'modelo'`.
Importações shows `template_name` when there is one. The batch's `platform` is not shown today (`estado_atual.md` §3.5).

### 3.6 The overlap count `other_source` (G1, revised by R3, NEW)

The same trades sent into one account in two formats duplicate, because keys are per `source_platform` and links reach
only registered trades. Every mapped batch is `'modelo'`, so the format must be finer than the platform.

- **`p_format jsonb default null`**, a NEW trailing parameter of `import_preview` and `import_commit` (dropped and
  re-created; PostgREST calls name their arguments, so today's app still resolves them): `{"sig": <64 hex>, "template":
  <uuid> | null}`. It is required for `'modelo'` (`bad_format` otherwise, a bare code) and ignored for the readers.
  `template` is the model the file is read with (exact or changed match), when there is one, and must be the caller's.
- **`import_batches.header_sig`** (NEW column, `^[0-9a-f]{64}$`, null for reader batches) is written by `import_commit`
  from `p_format->>'sig'` on **every** mapped batch, whether or not a model is saved.
- **Same format** as batch `b`: `b.platform = p_platform`, and for `'modelo'` also `(b.header_sig = sig or (template is
  not null and b.template_id = template))`. The model clause keeps the batches of a model the same format after
  «Atualizar o modelo» re-keys it (§4.5).
- **`other_source`** (preview key, present only when > 0) = `count(distinct r.grp)` over rows with `path in ('row',
  'group') and link_id is null` (the `trades_new` unit: trades the file would insert) such that a trade `t` exists with
  `t.account_id = acc.id`, `t.source = 'import'`, `t.trading_day = r.trading_day`, and `t.import_batch_id` pointing at a
  batch of another format. `dup`, linked and `attach` rows never count, so a plain re-import never warns.
- It applies to every platform, in both directions (a Top One file into an account fed by a mapped format too). On
  today's data it is 0 everywhere, so the as-built answers do not change.
- Index: the existing `trades_user_acc_day (user_id, account_id, trading_day)` serves the day lookup, and
  `import_batches` is joined by its primary key. No new index (to confirm in 3b-1 with `explain` on the timing case).

---

## 4. Saved models («modelos»): `import_templates`

Board: `conferir` «Salvar como modelo» (l.510, checked by default), «Nome do modelo» (l.511, default «Minha plataforma»
l.1076), end line «Modelo “{nome}” salvo: os próximos arquivos com estas colunas entram direto.» (l.1118), and the info
text «Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo.» (`D.infoArq`, l.564).

### 4.1 Table

```sql
create table public.import_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- «Nome do modelo»
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- sha256 (hex) of the sorted normalised header names (§4.3)
  header_sig text not null check (header_sig ~ '^[0-9a-f]{64}$'),
  -- the normalised header names in file order (a repeat gets "#2", "#3"…), 2..100, each 0..80 chars
  headers jsonb not null check (jsonb_typeof(headers) = 'array' and jsonb_array_length(headers) between 2 and 100),
  -- records skipped before the header (title lines of a statement)
  header_skip int not null default 0 check (header_skip between 0 and 20),
  delimiter text not null check (delimiter in ('comma', 'semicolon', 'tab')),
  decimal_mark text not null check (decimal_mark in ('point', 'comma')),
  -- null when every date in the files was unambiguous (ISO, epoch, a day > 12…)
  date_order text check (date_order in ('dmy', 'mdy')),
  -- 'trade': one closed trade (or one exit of it) per row; 'fill': one execution per row (§6)
  row_kind text not null check (row_kind in ('trade', 'fill')),
  -- {header name: field key} (§4.4); «Ignorar esta coluna» and «Escolha…» are absent
  columns jsonb not null check (jsonb_typeof(columns) = 'object'),
  -- «O resultado do arquivo já desconta a comissão?» / «… já tem a comissão e o swap?» (R8): true = the file's result
  -- already holds every mapped cost (commission, other fees, swap); null when not asked
  result_is_net boolean,
  -- answers to «O que quer dizer “{valor}”?»: {normalised word: 'buy' | 'sell'}; fills: {word: 'open' | 'close'}
  side_words jsonb not null default '{}' check (jsonb_typeof(side_words) = 'object'),
  open_close_words jsonb not null default '{}' check (jsonb_typeof(open_close_words) = 'object'),
  -- «Conta» routing: {sha256 hex of the cell value: account id} (no account number in clear)
  account_routes jsonb not null default '{}' check (jsonb_typeof(account_routes) = 'object'),
  -- the zone confirmed the last time this model was used (a hint for an account without one)
  tz_hint text check (tz_hint is null or char_length(tz_hint) <= 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  unique (user_id, header_sig),
  unique (id, user_id)
);
alter table public.import_batches
  add column template_id uuid references public.import_templates (id) on delete set null,
  add column template_name text check (template_name is null or char_length(template_name) <= 60),
  -- the file's header signature, on every mapped batch (R3, §3.6); null for Ebinex and Top One
  add column header_sig text check (header_sig is null or header_sig ~ '^[0-9a-f]{64}$');
```

- **Per user, not per account.** One IBKR template serves a stocks account and an options account. Matching is by
  header set. Settled in the scoping, unchanged.
- **Never a cell value.** The «ex.: {amostra}» samples stay in the browser. Header names are the user's own column names
  under RLS. «Conta» values are hashed.
- At most **50 templates per user** (`too_many_templates`), checked in `import_template_save`.
- `template_name` on the batch is a snapshot, so a deleted or renamed template never breaks the Importações list.

### 4.2 RLS and grants

```sql
alter table public.import_templates enable row level security;
create policy "import_templates select own" on public.import_templates for select using ((select auth.uid()) = user_id);
create policy "import_templates delete own" on public.import_templates for delete using ((select auth.uid()) = user_id);
revoke all on public.import_templates from anon, authenticated;
grant select, delete on public.import_templates to authenticated;
-- service_role: no insert/update (as trade_import_links in 20261020000004)
```

There is no insert or update policy, so the JSON is validated in one place (`import_template_save`). Delete is open to
the owner for a later management list (scoping Q8: none in 3b). Deleting a template sets `import_batches.template_id` to
null and keeps `template_name`.

### 4.3 Header normalisation and signature

- **Name.** `normalizeHeader` (as built: NFD without accents, quotes and BOM removed, spaces collapsed, lower case),
  then truncated to 80 characters. An empty header stays `''`. A repeated name gets `#2`, `#3` in file order
  (`preco`, `preco#2`).
- **Signature.** `sha256_hex(join('\n', sort(names)))`, sorted by Unicode code point. The TS comparator must compare code
  points, not UTF-16 units, so it agrees with SQL `collate "C"` over UTF-8 bytes.
- **Who computes it.** The browser, to find the template. `import_template_save` recomputes it from `headers` and
  stores its own value:

```sql
select encode(sha256(convert_to(string_agg(h, E'\n' order by h collate "C"), 'UTF8')), 'hex')
from jsonb_array_elements_text(p->'headers') h
```

  Shared cases (§16.2) pin the equality: accents, repeats, an empty name, a non-BMP character.
- **The header line.** The first record, unless the first up-to-20 records have fewer non-empty cells than the modal
  width of the next 50 records (title lines of a statement). The count of skipped records goes into `header_skip`.

### 4.4 Field vocabulary (database keys ↔ board labels)

Trade rows (`row_kind 'trade'`). The board's `D.campos` (l.564), keys in English per `CLAUDE.md`:

| Key | Board label (l.564) | Required |
|---|---|---|
| `entry_time` | «Entrada (data e hora)» | yes |
| `symbol` | «Ativo» | yes |
| `side` | «Lado» | yes (or a signed `quantity`, NEW) |
| `quantity` | «Quantidade» | yes |
| `pnl` | «Resultado» | yes, or both prices: «Resultado (ou os preços)» (l.1053) |
| `entry_price` / `exit_price` | «Preço de entrada» / «Preço de saída» | with the line above |
| `exit_time` | «Saída (data e hora)» | no |
| `commission` | «Comissão» | no |
| `stop` / `target` | «Stop» / «Alvo» | no |
| `trade_id` | «ID da operação (evita duplicar)» | no |
| `account` | «Conta» | no |

Fill rows (`row_kind 'fill'`). **NEW**, ADAPTED from the same list for execution files (§6.1):
`time` («Data e hora», the **fill** time), `symbol`, `side` («Compra ou venda»), `quantity` (the **executed**
quantity), `price` («Preço», the average fill price for order files), `commission`, `fill_id` («ID da execução (evita
duplicar)»), `order_id` («ID da ordem», only to merge fills), `open_close` («Abre ou fecha»), `realized` («Resultado
realizado»), `account`.

Unfilled and cancelled orders (R2): there is no status field (formatos §6.3's «Situação» is dropped). A fill row whose
`quantity` is 0 or blank is skipped and counted in the notice `unfilled_orders` («{n} ordens sem execução ficaram de
fora.», proposal). It is neither an error nor sent. A cancelled order has executed quantity 0; a partly filled order
counts its executed part. The synonym pre-fill in fill mode prefers, in order:
- quantity: «Filled Qty», «filledQty», «Qty Filled», «Executed», «Quantidade executada» before «Quantity», «Qty»,
  «Quantidade»;
- price: «Avg Fill Price», «avgPrice», «Fill Price», «Preço médio» before «Price», «Preço»; never «Limit Price» or «Stop
  Price»;
- time: «Fill Time», «Update Time», «Exec Time», «Execution Time», «DateTime» before «Timestamp», «Create Time», «Order
  Time», «Date».

Tradovate Orders carries both `filledQty` and `Filled Qty`, and both `avgPrice` and `Avg Fill Price` (TradeZella's list):
one of each is pre-filled and the twin is left at «Ignorar esta coluna». `conferir` says «Confira: a quantidade é a
executada e o horário é o da execução, não o da ordem.» (proposal), because a creation time can sort a bracket's exit
before its entry within one second.

Rules `import_template_save` enforces:
- the keys of `columns` are among `headers`;
- the values are in the row kind's vocabulary, and each field appears at most once (the board's «Cada campo vai em uma
  coluna só.», l.1149);
- the required set is present. Trade: `entry_time`, `symbol`, `side` or a signed quantity, `quantity`, and `pnl` or
  both prices. Fill: `time`, `symbol`, `side` or a signed quantity, `quantity`, `price`.

### 4.5 `import_template_save(p_template jsonb, p_batch uuid default null, p_replaces uuid default null) returns jsonb` (NEW, API)

Revised (R9, R13):
- **`p_replaces`**: the board's «Atualizar o modelo “{nome}”» (quadro sc. 15, checked) re-keys that model instead of
  creating a second one with the same name. When given, it must be the caller's template (`unknown_template`). That row
  is updated in place: `header_sig`, `headers` and every choice are replaced, and its `id` is kept, so its batches stay
  «the same format» (§3.6). If another of the caller's templates already holds the new signature, the call is refused
  (`bad_template`, HINT `header_sig`). The UI cannot reach that case, because an exact match is applied before any
  changed-header match (§4.6). Unchecked, nothing is saved, and the end card says «Colunas usadas só neste arquivo.».
- **`account_routes`**: non-empty routes require `p_batch`, and every routed account must be in the market of that
  batch's account. One import routes one value (§2.3). The browser sends the merged routes (old plus the new one) and
  pre-selects only a route whose account is the destination.

The original text follows; the revision wins where they differ.

- `SECURITY DEFINER`, `search_path ''`, caller from the JWT. Errors are bare codes, with the field in the HINT and never
  a value.
- Payload: JSON v1 (`"v": 1`), unknown keys refused, at most 16 KB. Keys: `name`, `headers`, `header_skip`, `delimiter`,
  `decimal_mark`, `date_order`, `row_kind`, `columns`, `result_is_net`, `side_words`, `open_close_words`,
  `account_routes`, `tz_hint`.
- Checks:
  - every header is already normalised (lower case, no `"`, no leading or trailing or double spaces, ≤ 80 characters,
    unique after the `#n` suffixes);
  - the vocabulary rules of §4.4;
  - `side_words` values in `buy`/`sell` and `open_close_words` values in `open`/`close`, keys ≤ 40 characters, at most
    20 each;
  - `account_routes` keys are 64-hex and values are the caller's own, non-archived accounts of a market with
    `mapping`;
  - `tz_hint` is in `pg_timezone_names`.
- Upsert on `(user_id, header_sig)`. A new row counts against the 50. An existing row takes the new name and choices,
  `updated_at` and `last_used_at`. Saving the same header set again therefore overwrites it, with no duplicates.
- `p_batch`, when given, must be the caller's batch, `status = 'done'`, `platform = 'modelo'`. Its `template_id` and
  `template_name` are then set.
- Answer: `{"template_id", "header_sig", "created": bool}`. Codes: `not_authenticated`, `bad_template`
  (HINT: `name`, `headers`, `columns`, …), `too_many_templates`, `unknown_batch`.
- **When it is called:** after `import_commit` answers with a `batch_id`, when «Salvar como modelo» is checked. A
  template used unchanged is also «touched» (`last_used_at`). This follows the scoping's Q4(b): a template is saved only
  for an import that committed. A failed save leaves the import as it is. The end card then omits the «Modelo … salvo»
  line, and the next file asks again.

### 4.6 Matching (browser)

1. Ebinex and Top One readers first (`detectPlatform`). A file they recognise never reaches a template. **Revised (R5):**
   the routing of a broken match is decided after the destination account is known (with no account in context, «Para
   qual conta?» comes first). `detectPlatform` returns `missing_columns` as soon as half of a reader's names are found
   (`detect.ts:76–81`), so a generic closed-position export (Symbol, Side, SL, TP, Open/Close Time, Open/Close Price: 8
   of Top One's 14) would otherwise stay at «Faltam colunas…» forever, even in a Forex account. The rule:
   - `missing_columns`/`duplicate_columns` stays `erro` only when the account is in the reader's market (binary for
     Ebinex, futures for Top One) **and** the match is near-complete: at most two names missing (Top One 12 of 14, Ebinex
     11 of 13), or every name found with one repeated. Mapped, such a file's tickets would never match the reader's earlier
     imports;
   - every other broken match goes to `mapa` in a mapping market (and is the binaries error in a binary account).
   `detectPlatform` itself is unchanged; the routing is a new pure function beside it.
2. The user's templates (≤ 50, one PostgREST select under RLS, cached for the sheet) are compared by signature. An exact
   match applies the template. Its sniffed facts (delimiter, decimal, header line) must agree with the file, or the file
   goes to `mapa` pre-filled.
3. No exact match, but a template sharing ≥ 60 % of the names: `mapa` is pre-filled for the known names (the scoping's
   «Algumas colunas mudaram desde o modelo “{nome}”.», NEW).
4. Otherwise: `mapa` with the synonym pre-fill (scoping §4.4, NEW).

### 4.7 What a template never decides

The account (except the routing hint of «Conta»), the zone of an account that has a confirmed one, the market, the
instrument table, how links are made.

---

## 5. From a mapped file to `ImportRow`

### 5.1 Who does what

| Step | Where | Why |
|---|---|---|
| Decode, records, delimiter, header line | browser | the file stays in the browser; same as the readers |
| Cells → wall clock (+ offset), exact decimals, side, symbol, option contract | browser | same contract as `ImportRow` today; issues carry line and code only |
| Net → gross (`result_is_net`), commission rounding to cents | browser | a row-local rule. The database receives gross, as from Top One |
| Pairing fills into slices (§6), commission and realized-P&L split | browser | needs the whole file in order. The database sees slices, which are ordinary rows |
| P&L from prices for the preview | browser (twin `pnlFromPrices`, `tradeInstrument`) | `conferir` and step `d` totals |
| P&L from prices, stored | **database** recomputes with `trade_pnl(trade_instrument(…))` and refuses a different client value (`pnl_mismatch`) | one definition. A drifting twin shows as an error, never as wrong money |
| `asset_type` | **database** (`trade_instrument(...)->>'asset_type'`) | as Registrar stores it. The client sends null for `'modelo'` |
| Synthetic key, tuple hash | **database** (§7) | one place, numerics normalised with `trim_scale`, zone-free |
| Instant, trading day, zone status | database (as built) | `AT TIME ZONE` only for offset-less clocks |
| Positions, links, de-dup, «em outra conta», counts | database (`import_stage`) | as built, plus §3.4 and §7.3 |

### 5.2 Domain modules (NEW, `app/lib/domain/import/mapped/`)

Pure. They depend on `../csv`, `../decimal`, `../clock`, `../types`, `../../markets`, `../../registro`
(`tradeInstrument`, `pnlFromPrices`, `tradeMatchKey`, `numeric`). Never `lib/hub` (boundary test). The pt-BR number reader
in `lib/hub/numero.ts` therefore cannot be imported. A locale-aware `parseNumLocale(text, mark)` goes into
`import/decimal.ts`, and `lib/hub/numero.ts` may later call it.

| File | Content |
|---|---|
| `fields.ts` | the vocabulary of §4.4 (keys, board labels, required sets per row kind and per market), the synonym table (scoping §4.4) |
| `sniff.ts` | delimiter (`,` `;` tab: constant cell count > 1 over the first 50 non-blank lines), header line, decimal mark per numeric column, date order over all rows, header clock hints («UTC», «UTC+0», «GMT») |
| `values.ts` | numbers, dates, sides, open/close, symbols (futures normalisation, OCC), IDs (§5.4) |
| `template.ts` | normalised names, signature, `Template` ⇄ JSON, exact / changed / none matching |
| `trades.ts` | trade rows → `PlatformParse` (§5.5) |
| `fills.ts` | fill rows → merged fills → FIFO lots → slices → `PlatformParse` (§6) |
| `index.ts` | `parseMappedRecords(records, template, account) → ParsedFile` |

`readCsv` gains a `delimiter` option, with quoting rules unchanged.

### 5.3 Sniffing (NEW)

- **Delimiter**, as above. A `;` file with no other evidence defaults to decimal comma (Brazilian Excel).
- **Decimal mark, once per file (revised, R6).** The old per-column patterns read «131.250» (quadro sc. 19's WIN price,
  131250 points) as 131.25 through `^-?\d{1,3}(,\d{3})*\.\d+$`, and did not say whether a file majority overrides a
  column. That would store prices 1000× wrong, with only a warning. The rule now, over the numeric cells of every mapped
  number column (after removing currency signs and the sign):
  - **deciding cells:** both marks present → the last one is the decimal («1.234,56», «1,234.56»); one mark followed by
    other than exactly three digits («88,50», «1.5», «1,2345»); the same mark twice or more is thousands
    («1.234.567» → comma file); a lone `0` before the mark («0.250») → that mark is the decimal;
  - **ambiguous cells:** one mark, exactly three digits after it, one to three digits before that do not start with 0
    (`^\d{1,3}[.,]\d{3}$` minus the `0` case: «131.250», «1,234»). They never decide;
  - integers are neutral;
  - deciding cells that agree fix the mark for the whole file; no column-level reading overrides it;
  - an ambiguous cell exists and nothing decides, or deciding cells disagree: `mapa` asks «Como ler os números deste
    arquivo?» (NEW, proposal) with two pills built from one of the file's own ambiguous cells, read only in the browser
    (as the side-word question): «“131.250” é 131250 (ponto separa milhar)» / «“131.250” é 131,25 (ponto é decimal)»
    (proposals). `;` as delimiter pre-selects the thousands reading of «.»; it never decides alone;
  - no ambiguous cell and nothing decides: both readings give the same numbers, and the delimiter rule fills the chip
    «Separador {;|,|tab} · decimal {vírgula|ponto}» (board l.493, without «exemplo»: ADAPTED);
  - the result is saved as `decimal_mark`. A later file under the model whose deciding cells contradict it reopens `mapa`
    with the question.
  - Fixtures (invented): quadro sc. 19's shape («131.250» beside «88,50» → 131250, gross R$ 90,00) and the same file
    with only prices and integers (→ the question).
- **Date order** over all rows: a first part > 12 means day first, a second part > 12 means month first. If neither
  shows, the user is asked «Datas em dia/mês ou mês/dia?» (NEW) and the answer is saved as `date_order`.
- **Header clock.** A header naming `UTC`/`GMT` with an offset («Trade Time(UTC+0)», Bybit's old format per fatos §2.3)
  makes every row carry that offset (`'+00:00'`): the rows are exact and skip step `c`. A bare «UTC» only pre-selects
  UTC in `c`.

### 5.4 Value readers (NEW)

- **Numbers** (`parseNumLocale`):
  - accepted: an optional sign, `$`, `US$`, `R$`, `USD`/`BRL` suffix, the Unicode minus `−`, accounting parentheses
    `(39,98)` as a negative, the chosen decimal mark, thousands grouped by the other mark;
  - refused: percentages, two signs, scientific notation, more than 64 characters;
  - output: the as-built `Num`, then `toDecimal` at the column's scale (prices up to 8 decimals, money rounded half-up to
    2 like Top One).
- **Dates.**
  - accepted: `DD/MM/YYYY HH:MM[:SS]`, `MM/DD/YYYY HH:MM[:SS] [AM|PM]`, two-digit years (→ 20YY), `-` or `.` as
    separators, `T` or space, fractions of a second, ISO with or without `Z`/`±HH:MM` (as `parseIsoDateTime`), IBKR's
    `YYYYMMDD;HHMMSS` and `YYYYMMDD HHMMSS`, English month abbreviations (`01-Oct-2026 09:34:31`, `Oct 1, 2026 9:34:31 AM`);
  - epoch seconds (10 digits) or milliseconds (13 digits) read as UTC: offset `'+00:00'`;
  - output: `FileStamp` (`local`, `offset`), as `clock.ts` does;
  - out of 3b: a date and a time in separate columns (no target needs it; IBKR Flex can export a single `DateTime`).
- **Sides.** Case- and accent-insensitive: «C», «Compra», «Comprado», «Buy», «B», «Bot», «Bought», «Long», «L» → buy;
  «V», «Venda», «Vendido», «Sell», «S», «Sld», «Sold», «Short» → sell. Saved `side_words` add to the list. A signed
  quantity without a side column gives the side (> 0 buy, < 0 sell). For trade rows, buy means `long`. Any other value is
  `bad_direction`.
- **Open/close (fills).** «O», «Open», «Abertura», «Abre», «TO OPEN», «BTO», «STO» → open; «C», «Close», «Fechamento»,
  «Fecha», «TO CLOSE», «BTC», «STC» → close, plus `open_close_words`. IBKR's combined «C;O» (closes, then the rest opens) is a flip; any other code takes its first letter.
- **Symbols.** Trimmed, 1–40 characters, no control characters, stored as written except:
  - **futures and B3 futures** (NEW, Q8): «ROOT MM-YY» (NinjaTrader style), «ROOT MON YY», «/ROOTZ26»
    (thinkorswim) become `ROOT` + month code + year («MES 12-26» → «MESZ26»). Without it, `trade_match_key` cannot drop
    the month («MES1226» is not «MES»), so the row would neither compute nor link;
  - **OCC options** in stocks/options accounts (NEW, Q7): `^([A-Z.]{1,6})\s*(\d{6})([CP])(\d{8})$` → symbol = root,
    `option_right`, `expires_on` (YYMMDD), `strike` = digits ÷ 1000, `multiplier` `'100'`.
- **IDs.** `^\S{1,64}$` (as `isValidExternalId`), and never starting with `@`, which is reserved for synthetic keys
  (`bad_id`). A mapped ID column with an empty cell gives `missing_id`. Repeats in the file give `duplicate_in_file`,
  first wins (as built).

### 5.5 Trade rows → `ImportRow`

| `ImportRow` key | From | Rule |
|---|---|---|
| `line` | the record | physical line (as built) |
| `external_id` | `trade_id` | as §5.4; **null when not mapped** (the database derives a key, §7) |
| `symbol` | `symbol` | §5.4 |
| `asset_type` | — | **null** for `'modelo'`: the database derives it (§10) |
| `direction` | `side` / signed quantity | `long` / `short` |
| `local_entry`, `utc_offset` | `entry_time` (+ header clock) | §5.4; `missing_date` / `bad_date` |
| `local_exit` | `exit_time` | optional; unreadable → warning `bad_exit_time` (exit left null); before entry → warning `exit_before_entry` (exit left null), as Top One |
| `entry_price`, `exit_price` | prices | unsigned, ≤ 10 integer and 8 decimal digits; 0 only on an option exit |
| `quantity` | `quantity` | > 0 after the sign is taken; ≤ 10 + 8 digits |
| `pnl`, `pnl_basis` | `pnl` or prices | §9.1: the file's column (gross after §9.2, basis `'file'`), else `pnlFromPrices` (basis `'prices'` or `'estimate'`), else row error `no_price_result` |
| `result` | sign of gross `pnl` | win / loss / breakeven |
| `commission` | `commission` | absolute value (IBKR writes it negative), cents half-up; null = unknown, never zero |
| `stop_price`, `target_price` | `stop`, `target` | price levels; empty or 0 → null (as Top One) |
| `stake_amount`, `payout_percent`, `duration_seconds`, `timeframe` | — | null |
| `option_right`, `strike`, `expires_on`, `multiplier` | OCC symbol | NEW keys; null otherwise |

Warnings and notices for the preview (NEW codes, §14): `result_net_converted`, `result_differs_from_prices`,
`identical_rows`, `symbol_normalised`, `commission_in_file` (reused).

### 5.6 Type changes (`lib/domain/import/types.ts`)

- `Platform = 'ebinex' | 'topone' | 'modelo'`. `ReaderPlatform = 'ebinex' | 'topone'` keeps `PLATFORM_MARKET` and
  `PLATFORM_FILE_TZ_HINT`.
- `FileVariant` gains `'modelo_trades' | 'modelo_fills'`.
- `ParsedFile.market: AccountMarket` (the destination's for `'modelo'`). It gains `template` (`{ id | null, sig, name }`)
  and `rowKind`.
- `ImportRow`:
  - `external_id: string | null` and `asset_type: AssetType | null` (null only for `'modelo'`);
  - `direction` unchanged;
  - **new keys** `pnl_basis: 'file' | 'prices' | 'estimate'` (Ebinex and Top One send `'file'`) and `option_right`,
    `strike`, `expires_on`, `multiplier`, appended to `IMPORT_ROW_KEYS`.
- `CanonicalColumn` widens to the field keys of §4.4, so issues name a field and never a file header.
- **Compatibility.** `import_checked_rows` reads the payload with `jsonb_to_recordset`, so a missing key is null. The app
  of today (before deploy) sends no new key, gets the as-built answers, and a null `pnl_basis` reads as `'file'`. The
  readers' outputs gain only constant keys (`pnl_basis 'file'`, option keys null), and `parity.test.ts` and
  `rpc.test.ts` extend.

---

## 6. Execution files: fills → trades (PR 3b-4)

Why this is needed: the board itself sends Tradovate users to an order-level file. `COMO.tradovate` (l.1025) says
«Account reports › aba Orders › Download Report. Não use o Performance.csv.». Rithmic R|Trader Pro's export is an
order history (Buy/Sell, Qty Filled, Avg Fill Price, Create/Update Time, one day per export). IBKR Flex «Executions»,
thinkorswim «Account Trade History», Binance Order/Trade History and Profit's «Export order list CSV» are execution or
order lists (fatos §2.3, §3.3, §5.4; web sources). Round-trip files are the minority: Match-Trader «Closed Positions»,
cTrader History, NinjaTrader's Trades grid, Tradovate Performance (fill pairs, inferred from its API's FillPair entity), IBKR Flex «Closed Lots».

### 6.1 Detection and fields

- `mapa` asks first «Cada linha do arquivo é…» «uma operação completa» / «uma execução (compra ou venda)» (NEW;
  board revision). It is pre-answered «execução» when there is no exit-time column and some symbol has both sides in its
  rows. The answer is saved as `row_kind`.
- Fields: §4.4 fill vocabulary. `order_id` only merges. `open_close` and `realized` make the pairing checkable (§6.4).

### 6.2 Algorithm (`fills.ts`, pure, exact decimals)

1. **Read** every fill into `{line, symbol (upper, trimmed, §5.4 normalised), side buy|sell, qty > 0, price, local,
   offset, commission?, fill_id?, order_id?, open_close?, realized?}`. A row whose executed quantity is 0 or blank is
   skipped first (`unfilled_orders`, §4.4, R2). A file mixing rows with and without an offset is a file error
   `mixed_clocks` (NEW), because fills could not be ordered.
2. **Order** by instant key (wall clock, or wall clock − offset), then by line. If the file is globally in descending
   time order, the tie-break is by line descending, so fills of one second keep the broker's sequence.
3. **Merge** consecutive fills with the same symbol, side and `open_close`, and either the same `order_id` (when mapped)
   or the same wall clock to the second. Quantity is summed. Price is `round(Σ q·p / Σ q, 8)` (Postgres `numeric`
   rounding, `registro/numeric.ts`). Commission and realized are summed. The line is the first. A notice says how many
   (`merged_fills`).
4. **FIFO lots per symbol** (the symbol as written after normalisation, so MESZ6 and MESH7 never pair across a roll):
   - a fill on the side of the open lots, or with no lots open, opens a new **lot** (`long` for buy, `short` for sell)
     of its whole quantity: each entry fill is its own lot (Q2);
   - a fill on the other side closes lots oldest first, `take = min(lot.remaining, fill.remaining)`, and each take is a
     **slice** `{lot, closing fill, take}`;
   - a fill left with quantity after every lot closed opens a lot on its own side (a flip).
5. **Leftovers and the end-of-file rule** (§6.4, revised by R1): with «Abre ou fecha» mapped, every lot with quantity
   remaining at the end is dropped **whole**, its opening fill and every slice it already had (`open_at_end`). Without
   it, a symbol whose computed position at the end is not zero is resolved by the `conferir` answer for that symbol: keep
   the pairing and drop the open lots (`open_at_end`), re-pair with a seeded pre-file lot (`opened_before_file`), or drop
   every fill of the symbol (`unbalanced_symbol`, the pre-selected answer).
6. **Emit** one `ImportRow` per slice (§6.3).

### 6.3 A slice as `ImportRow`

| Key | Value |
|---|---|
| `line` | the closing fill's first line (`trade_exits.line` points at the closing fill) |
| `external_id` | `fill_id` mapped: `open_id + '>' + close_id` when ≤ 64 characters, else null. Otherwise null (database key, §7) |
| `symbol`, `direction` | the lot's |
| `local_entry` / `local_exit`, `utc_offset` | opening fill's / closing fill's wall clocks; the file's offset |
| `entry_price` / `exit_price` | opening / closing fill's price (merged average when merged) |
| `quantity` | the take |
| `commission` | `open.commission × take / open.qty + close.commission × take / close.qty`, each fill's share split by largest remainder in cents, so each fill's commission is distributed exactly; null when neither fill has one |
| `pnl`, `pnl_basis` | **Revised (R7): the file wins, as in trade rows (D18, decision 2).** `realized` mapped and present on the closing fill: its gross `R` (net → gross when the template says net: `R = net + the commissions of that fill's slices`) is allocated over the fill's slices, basis `'file'`. Where the instrument computes: slice = its price result + a share, by `take`, of `R − Σ price results`. Where it does not: by `take` alone. Largest remainder, cents, so `Σ slices = R` exactly. Else prices where the instrument computes (`'prices'`/`'estimate'`). Else `no_price_result` |
| `result` | sign of `pnl` |
| option keys | from the OCC symbol |

When `realized` is mapped and the instrument computes too, the two are compared per closing fill: `|R − Σ price
results| > 1 cent × slices` gives the warning `result_differs_from_prices` («… vale o do arquivo.»), and the file's
value is the one stored. It catches a wrong multiplier or a net column read as gross. The old rule (prices override a
mapped realized result) contradicted D18 and this warning's own copy.

Why not split `R` by quantity alone (the original rule): a closing fill that closes two lots of different entry prices
(lots at 100 and 102 closed by one sell at 105: +5 and +3 per unit) would get +4 and +4, moving money between two trades.
The price-led split keeps each trade's own result and puts only the file's difference on top. Where prices do not
compute, quantity is the only basis left (stated, §18).

### 6.4 Open positions left over, and files that start mid-position (revised, R1)

**What the original rule missed.** Pairing assumes each symbol starts flat. Tradovate Orders, the first target, has
neither an open/close column nor a realized column, so no start guard ever runs there. If the true start is long 1, the
first «sell 1» opens a fictitious short; a «buy 2» closes it and opens long 1; a «sell 2» closes that and opens a short…
Every trade of the symbol comes out wrong, not "one false cycle", and the end-of-file rule drops only the last lot. The
old promise that a dropped lot «enters when a newer file shows it closed» was also false: the newer file lacks the
opening, so it starts mid-position itself.

**The fact the rule uses.** With computed end position `N` (signed sum of the file's fills for the symbol) and true
positions `P0` at the start and `PE` at the end, `N = PE − P0`. A file that starts mid-position and ends flat leaves `N =
−P0 ≠ 0`; a file that starts flat and ends open leaves `N = PE ≠ 0`. Without a guard column the two look the same, and
only the trader knows which one happened.

- **Start guards, when a column allows** (unchanged in substance):
  1. `open_close` mapped (IBKR, thinkorswim order history, NinjaTrader `E/X`): a `close` fill with no lot of the other
     side is `opened_before_file`, and so is the rest of a `close` fill larger than the open lots (unless the code is the
     flip «C;O»). An `open` fill meeting lots of the other side marks the symbol inconsistent, so its fills up to the next
     flat point are `opened_before_file`. The start is then proven, so a lot still open at the end is genuinely open:
     dropped whole (`open_at_end`).
  2. `realized` mapped (IBKR, Binance futures, Bybit): a fill that only opens a lot but carries realized ≠ 0 means the
     start was not flat. The symbol's fills from the start of the file to its first flat point are `opened_before_file`,
     and pairing restarts there. Realized alone does not prove the start (a hidden long 1 followed by «buy 1, sell 2»
     escapes it), so the end-of-file rule below still applies.
- **End-of-file rule, whenever «Abre ou fecha» is not mapped** (NEW). After pairing, each symbol with `N ≠ 0` gets one
  question in `conferir`: «No fim do arquivo, {ativo} ficou posicionado?» (proposal from the review), under «Pelas
  execuções do arquivo, sobram {|N|} {unidade} {compradas|vendidas}.» (proposal), with three pills:
  - «Sim, ficou posicionado»: `P0 = 0` is assumed, the pairing stands, and the open lots are dropped whole
    (`open_at_end`);
  - «Não, terminou zerado»: `P0 = −N`. A lot of `|N|` on that side is **seeded** before the first fill (never emitted);
    FIFO closes it first, the slices that close it are dropped (`opened_before_file`), and every later fill pairs from
    the true position;
  - «Não sei» (**pre-selected**, the safe default): every fill of the symbol is dropped (`unbalanced_symbol`): «As {n}
    execuções de {ativo} ficaram de fora: as compras e as vendas do arquivo não fecham.» (proposal).
  - The answer belongs to the file and is not saved in the model. The `conferir` summary and the first trades are
    recomputed when it changes.
- **`N = 0`**: the symbol is taken as flat at both ends. In files without «Abre ou fecha», `conferir` says once
  «Supomos que o arquivo começa sem posição aberta.» (NEW, `flat_start_assumed`).
- **End-of-file copy** (`open_at_end`): «{n} execuções de posições ainda abertas no fim do arquivo ficaram de fora. Elas
  entram quando você importar um arquivo que tenha a abertura e o fechamento.» (proposal). A trade with half its exits
  is never imported, and imported trades are always closed (`trades_open_shape`: only `source = 'live'` may be open).
- **What remains (stated, §18):** a position held across both ends of the file (`P0 = PE ≠ 0`, so `N = 0`) pairs falsely
  and is not detected; a wrong «Sim» or «Não» mis-pairs that symbol; a position spanning two exports enters only through
  one export holding both its opening and its closing, so Rithmic's overnight positions (one day per export) never enter
  by file; registered trades keep the app's values.
- Left-out fills travel as client errors `{line, code}` in `p_errors`. They are listed in «Ver linhas» and count in
  `rows_error`. A fill only partly left out (it closes the seeded lot and opens a lot with the rest) is not an error
  line; the `opened_before_file` notice counts it. Unfilled rows (§4.4) are not sent at all.

### 6.5 Through `import_stage`: 3c does the rest

The slices of one lot share symbol as written, side, entry instant and entry price, and each has an exit and an entry
price. That is exactly 3c's position key (`20261023000003:1385–1392`), so:

- a lot with **one** slice → one imported trade, no `trade_exits` row (3c: exits only for trades with more than one);
- a lot with **several** slices → `path 'group'` → one trade (key = the first exit's key, sums, quantity-weighted exit
  price at 8 decimals) plus one file exit per slice;
- a lot whose earlier slices are already in the account (a longer export) → its known slices are `dup`/`exit_of`, and new
  slices `attach` to that trade (3c);
- a lot matching a **registered** trade (same match key and side, entry −2/+16 min for live or ±16 for «Já fechada»,
  same size first) → linked whole. The exits path writes the file exits; the app's hours are kept where they pair
  (as many file rows as app exits); money comes from the file (decision 2). Undo gives back what was registered, in any
  order.
- two lots opened at the same second and price by different orders → one position (as Top One). Their quantities add up.

**Worked examples** (invented, MES tick 0.25 and ×5; AAPL stock ×1):

| Fills (line: side qty @ price, time) | Lots → slices | Result in the database |
|---|---|---|
| L2 buy 3 @ 6800.00 10:00:05; L3 sell 1 @ 6802.00 10:03:10; L4 sell 2 @ 6795.00 10:07:40 | lot L2 long 3 → (L2→L3, 1) +10.00; (L2→L4, 2) −50.00 | one trade: qty 3, exit 10:07:40, exit price 6797.33333333, pnl −40.00; two file exits |
| L2 buy 1 @ 100 10:00; L3 buy 1 @ 102 10:05; L4 sell 2 @ 105 10:10 | lots L2, L3 → (L2→L4, 1) +5.00; (L3→L4, 1) +3.00 | two trades (Q2(a)), both exiting 10:10 |
| L2 buy 2 @ 50; L3 sell 3 @ 52; L4 buy 1 @ 51 | lot L2 closed by L3 (2) +4.00; L3's rest opens short 1, closed by L4 +1.00 | a long 2 and a short 1 |
| L2 buy 2; L3 sell 1; end (no «Abre ou fecha») | lot L2 still 1 open, `N = +1` | asked: «Sim» → nothing imported, L2 and L3 `open_at_end`; «Não» → a seeded short 1 is closed by L2's first unit, L2's other unit opens a lot closed by L3 (one trade: long 1 from L2 to L3); «Não sei» → L2 and L3 `unbalanced_symbol` |
| Commission: open 2.00 for qty 3; closes 0.70 (qty 1), 1.40 (qty 2) | open's 2.00 → 0.67 / 1.33 | slice commissions 1.37 and 2.73 (total 4.10 = the file's) |

### 6.6 Re-imports and undo

- **Same file:** `already_imported` (sha256), and every slice is `dup` by key.
- **A longer export** that starts at a flat point gives the same lots and slices for the cycles both files contain, so
  the same keys: `dup`, plus `attach` for new exits of a lot that was complete in neither file. That cannot happen with
  rule §6.4, since only whole lots import. New cycles are new.
- **An export starting mid-position** loses the pre-file position (`opened_before_file`) instead of inventing one, when a
  guard column exists or the end-of-file answer is «Não, terminou zerado»; with «Não sei» it loses the whole symbol
  (§6.4). The later fills then pair as a flat-start export of the same days would, so their keys match an earlier
  import of those days.
- **Undo** is as built: the batch's trades and file exits go, linked registered trades get their values back. A template
  is not touched by undo.

### 6.7 Units in the counts

For a fill file the unit sent is the **slice**. `p_rows_total` = slices + left-out fills (client errors). The preview
and batch counts are therefore in slices («operações»/«saídas»), and the screens must not call them «linhas».
`trades_new`, `grouped` and `attached` (3c keys) tell trades from exits. Preview = commit, key by key, as `tests.imp81`
proves for Top One.

---

## 7. De-duplication without an ID («mesma hora e preço»)

Board: «Mesmo ID, ou mesma hora e preço, é reimportação, nunca cópia.» (l.429, info of step `grupo`); the preview's
«{n} já estavam (mesmo ID)».

### 7.1 The synthetic key (database, in `import_checked_rows`, `'modelo'` only)

```sql
tuple_hash := encode(sha256(convert_to(concat_ws('|',
    to_char(ts_entry, 'YYYY-MM-DD"T"HH24:MI:SS.US'), coalesce(utc_offset, ''),
    upper(btrim(symbol)), direction, trim_scale(quantity::numeric)::text,
    coalesce(trim_scale(entry_price::numeric)::text, ''),
    coalesce(to_char(ts_exit, 'YYYY-MM-DD"T"HH24:MI:SS.US'), ''),
    coalesce(trim_scale(exit_price::numeric)::text, ''),
    coalesce(option_right, ''), coalesce(trim_scale(strike::numeric)::text, ''), coalesce(expires_on, '')), 'UTF8')), 'hex');
external_id := coalesce(external_id,
    '@' || left(tuple_hash, 32) || '.' || row_number() over (partition by tuple_hash order by ord));
key_kind := case when <external_id was sent> then 'real' else 'synthetic' end;
```

- **Times (revised, R12).** An offset-less row uses its file wall clock, not the instant, so a zone fix never changes
  keys. A row with an offset uses its **UTC instant** (`(ts_entry - offset)` written as UTC), not the wall clock plus the
  offset text. Each time is tagged, `w:` for a wall clock and `u:` for a UTC instant, so the two kinds never collide.
  The SQL above is therefore read with `to_char(ts_entry, …), coalesce(utc_offset, '')` replaced by `case when
  utc_offset is null then 'w:' || to_char(ts_entry, …) else 'u:' || to_char(ts_entry_utc, …) end`, and the same for the
  exit. This is what lets the `'same'` fallback (§7.3) rebuild the tuple from stored columns: an offset row stores no wall
  clock (`source_local_entry` is null) but stores its instant. It also makes «10:00+00:00» and «07:00-03:00» the same
  key.
- `trim_scale` makes «6801», «6801.0» and «6801,00» the same. The time is written with microseconds, so «09:34:31» and
  «09:34:31.000» are equal.
- **Money is not in the tuple.** Result and commission can arrive later or as net, and must not change the key.
- Computed only after the row's checks pass, inside the same CASE discipline as the casts.
- Length 1 + 32 + 1 + up to 5 = at most 39 characters (`^\S{1,80}$` holds). The `@` prefix is refused in real IDs
  (§5.4), so the two kinds never collide.

### 7.2 Identical rows in one file

`n` makes their keys distinct, so nothing is lost (Q4(a)). **Revised (R14):** they do not import as two trades when
they have an exit time. Identical rows share symbol, side, entry instant and entry price, which is 3c's position key
(`import_stage`'s `grp`, `20261023000003`), so they fold into **one trade with one file exit per row**, the size adding
up, exactly as Top One's rows of one position. Without an exit time, `grp` keeps them apart and they are two trades. The
3c rule is kept on purpose: a second rule for identical rows would split the owner's accepted rule for positions. The
preview says «{n} linhas iguais a outra do arquivo (mesma hora, ativo, lado, quantidade e preços) viraram uma operação
com várias saídas, como nas saídas parciais.» (NEW, proposal; `identical_rows`, counted in the browser). A re-export
with the rows in another order swaps their `n`. Both keys still exist (one as the trade's key, one as a file exit), so
both stay `dup`.

### 7.3 The fallback across key methods (`path 'same'`)

A user who mapped «ID da operação» on one file and not on the next (or the reverse, or a broker that changed its ID
column) would otherwise import everything twice. For `'modelo'` rows whose key matches nothing, `import_stage` also looks
for a `'modelo'` imported trade of the account with the **same tuple hash**. The hash is recomputed from stored columns
with the §7.1 time rule on both sides (R12): `'w:' || source_local_entry` when it is not null, else `'u:' ||` the
entry instant in UTC; the same for the exit (`source_local_exit`, else the exit instant); then `symbol`, `direction`,
`quantity`, `entry_price`, `exit_price`, contract. Before R12 the incoming side hashed the wall clock plus the offset
text, which offset rows never store, so they could never match. For trades with file exits it is computed per exit (`trade_exits`
`source_local_exit`, `quantity`, `exit_price` with the trade's entry). It works **per position, all or nothing**:
- a position is `'same'` only when every row of it matches one trade (its single exit, or its file exits);
- `'same'` rows are never written and count in `duplicate`, with a separate `duplicate_same` key, present only when
  > 0, for the copy «já estavam (mesma hora e preço)» (ADAPTED from l.429 and the «mesmo ID» line);
- a partial match is treated as new. That is a stated limit, and the preview shows the count.

### 7.4 Limits (stated, §18)

Two templates of different time precision for one broker (seconds vs minutes) give different tuples. So do prices
rounded differently, or a futures symbol written as the root in one export and as the contract in another
(normalisation removes the common cases). The fallback cannot see these. Only an ID column is fully robust, so
`conferir` should recommend mapping one when the file has it (screens).

---

## 8. Time zone of the file and «Confirmar fuso»

- **Unchanged per account:** `trading_accounts.file_tz` and `tz_applied_at`; `import_tz_status` (`invalid_tz`,
  `tz_mismatch`, `tz_not_confirmed`, `ok`, `source = 'import'` only); step `c` («Em que fuso estão os horários deste
  arquivo?») with the market's reference clock (New York for futures, forex, stocks, options; Brasília for crypto and
  B3); `conf` (the dry run of `import_fix_tz`); the first file needing a zone confirms it at commit; undo un-confirms it
  when no wall-clock trade remains.
- **A mapped file never opens `conf` (revised, R4).** Legacy batches never set `tz_applied_at` (the backfill,
  `20261017000003:45–57`). In such an account, `import_tz_status` answers `tz_not_confirmed` for a different zone
  (`20261020000004:121–136`), the as-built flow opens `conf`, and `import_fix_tz` re-places **every** imported trade with
  a wall clock, and its day, whatever its `source_platform` (`20261023000003:2204–2285`). A mapped file picked in another
  zone would therefore move another format's real trades: Top One #1, scenario 8's own context, could be such an
  account. The rule: in `import_preview` and `import_commit`, for `p_platform = 'modelo'`, `tz_not_confirmed` is
  answered as `tz_mismatch`. `import_tz_status` itself is unchanged, and so is «Confirmar fuso» from Importações. The
  browser preselects the account's `file_tz` in `c` whenever the account holds imported trades without an offset,
  confirmed or not, and shows the G2 line on a different choice. The commit then confirms `file_tz` as built, and nothing
  moves, because the zone is the one those trades already use.
- **Exact rows skip `c`:** ISO with `Z`/offset, epoch values, a header that states the offset (§5.3). Preview and
  commit already treat «every valid row has its own offset» as `tz_status 'ok'`.
- **Pre-selection in `c`** for an account without a confirmed zone, in this order: the template's `tz_hint`; a header
  saying UTC/GMT; the account's platform when the facts say so (Binance and Bybit: UTC, fatos §2.3); else none.
  `tz_hint` is written by `import_template_save` from the zone the commit used.
- **`import_fix_tz` on mapped trades** works as built: each trade from its `source_local_entry`, each file exit (slice)
  from its own `source_local_exit`, links moved with it. Keys never move (§7.1). FIFO order cannot change with the zone,
  since one file has one zone.
- **DST.** The repeated hour takes the later occurrence and a skipped time takes the offset from before the change
  (Postgres rule, mirrored by `localToUtc`). Pairing orders fills by wall clock, so in the repeated autumn hour two fills
  could swap. CME is closed then (Sunday 01:00–02:00 NY), and crypto exports are UTC. Accepted (§18).

---

## 9. Money

### 9.1 P&L: the file's column, or the prices

| Situation | Stored `pnl` | `pnl_basis` | Check |
|---|---|---|---|
| «Resultado» mapped (or, in fill files, «Resultado realizado», R7) | the file's (gross after §9.2, swap per R8) | `'file'` | if the prices compute too: `result_differs_from_prices` warning above 1 cent, on `pnl − swap` |
| No «Resultado», instrument computes (`trade_instrument(...).pnl` `prices`) | `round(Δ × sgn × mult × qty, 2)` | `'prices'` | the database recomputes. A different client value is `pnl_mismatch` |
| … `prices_div_exit` (USD-base forex) | ÷ exit price | `'estimate'` | same |
| No «Resultado», instrument typed (futures root not in the table, forex crosses, B3 outside the catalogue, DI1, crypto not in dollars) | — | — | row error `no_price_result` |

- Where it computes (`instrument_specs()`): futures ES, MES, NQ, MNQ, GC, MGC, CL, MCL; forex EURUSD, GBPUSD, AUDUSD,
  NZDUSD (exact) and seven USD-base pairs (estimate); stocks ×1; options ×100 with a contract (an adjusted multiplier
  goes back to typed); crypto pairs quoted in USDT, USDC or USD ×1; B3 WIN, IND, WDO, DOL and 56 catalogue stocks/ETFs.
- **The file wins** when both exist. That is decision 2 of Phase 3 («o arquivo vale para o dinheiro»), and Q5 asks it
  again for this case.
- `'prices'`/`'estimate'` instead of `'file'` (Q5) let Análises tell a broker-reported result from one the hub
  computed with its own multiplier. The 3c sums keep their precedence file > typed > estimate > prices
  (`trade_exits_sum`). The link path (`import_link_patch`, `import_exits_link`) writes the row's basis instead of the
  constant.
- **Database side** (`import_checked_rows`, `'modelo'`): `spec := trade_instrument(acc.market, symbol, option)`. With
  `pnl_basis` in (`prices`, `estimate`), the spec's mode must match and both prices must be present (else
  `no_price_result`), and `pnl::numeric = trade_pnl(spec, sgn, quantity, entry, exit)` (else `pnl_mismatch`). With
  `'file'`, the pnl pattern is as built. `result` must agree with the sign (`sign_mismatch`, an existing code).

### 9.2 Net vs gross («O resultado do arquivo já desconta a comissão?»)

- **Revised (R8): one question for every mapped cost, swap included.** «Swap ou funding» (synthesis C3) may be mapped
  only with «Resultado». A net column (cTrader «Net», any net P&L) already holds the swap, so adding the swap column
  would count it twice. And comparing a result that includes the swap with the price result warned on every row with a
  swap. Now:
  - the question is shown when «Resultado» and at least one of «Comissão», «Outra taxa», «Swap ou funding» are mapped.
    It reads «O resultado do arquivo já desconta a comissão?» with no swap; «O resultado do arquivo já tem a comissão e
    o swap?» with both (proposal); «O resultado do arquivo já tem o swap?» with swap only (proposal);
  - `result_is_net = true` means the file's result holds every mapped cost. The stored gross (Registrar's «antes da
    comissão, com swap ou funding, se houver», `registrar/copy.ts:623–628`) is: net → file result + commission and fees
    (the swap is already in); gross → file result + swap;
  - pre-answered from prices when they compute: gross if the result equals the price result on most rows, net if it
    equals the price result − costs + swap;
  - `result_differs_from_prices` compares (stored `pnl` − swap) with the price result;
  - a result holding the commission but not the swap, or the reverse, is not supported; the check then warns.
- Asked only when both «Resultado» and «Comissão» are mapped (scoping Q3(a)); superseded by the first bullet. It is
  pre-answered when the prices compute.
  The board's own sample settles it as net: MESZ6 C 2 6.801,00 → 6.797,25 gives −37,50 gross, and −37,50 − 2,48 =
  −39,98 = «Res. Líq.». MNQZ6 V 1 gives +9,50 − 1,24 = 8,26. MESZ6 C 1 gives +27,50 − 1,24 = 26,26 (l.564 `D.desc`).
- Net: gross = net + commission per row (per slice, its split commission), done in the browser, with the notice
  `result_net_converted` (ADAPTED from the as-built «O arquivo traz comissões: mostramos o resultado líquido.»).
  `trades.pnl` stays gross everywhere; the daily limit counts net (Phase 2 rule).
- IBKR's realized P&L nets commissions (IBKR reporting reference), so for fills `realized` is usually net.

### 9.3 Commissions and fees

- One column, «Comissão» (the board's «Cada campo vai em uma coluna só.»; Q10). The absolute value is rounded half-up to
  cents. Null means unknown, never zero.
- Files that split costs (cTrader commission + swap, Tradovate fees in a separate Cash History file per TradesViz and
  TraderInsight): 3b imports the one mapped column. A later file with a commission column **completes** trades whose
  commission is null (the as-built `on conflict … coalesce`, `completable`), as long as the key is the same.
- Fee in another currency (Binance fee in BNB): not detectable. The user should leave it unmapped. `conferir` shows
  the currency label.
- A link on a registered trade: the file's commission replaces typed «Custos» (as built; counted in `linked_differs`).

### 9.4 Currency and the account's market

- Amounts are taken as the account's currency (`market_caps.currency`): US$ everywhere, R$ for B3. No conversion, and
  accounts in different markets are never summed (`CLAUDE.md`).
- **Crypto pairs not quoted in a dollar coin** (`ETHBTC`, COIN-M `BTCUSD_PERP`, whose key `BTCUSDPERP` does not end in a
  dollar quote): row error `not_dollar_quote` (NEW, Q6), even with a «Resultado» column, because it would be in coin.
  Known gap: an inverse contract written `BTCUSD` (Bybit inverse) looks dollar-quoted and would compute linearly. The
  same gap exists in Registrar (§18).
- B3 files are in R$, and B3 accounts are BRL. A US-stock file mapped into a B3 account would be stored as R$: nothing
  can see that, and `conferir` shows «R$».

---

## 10. `asset_type` and options

- **Derived, not sent:** `asset_type := trade_instrument(acc.market, symbol, option)->>'asset_type'` for `'modelo'`.
  That gives futures `futures`; forex `forex`; stocks `stock` (an OCC row: `option`); options `option`; crypto
  `crypto`; b3 `b3`, except the futures roots WIN, IND, WDO, DOL, DI1 (and their series) → `futures`. The client sends
  null. The preview's label uses the twin `tradeInstrument`.
- **Options.**
  - An OCC symbol (§5.4) carries the contract. `import_checked_rows` checks it as Registrar's payload does: `right` in
    call/put, strike a price > 0, a valid `expires_on`, multiplier ≤ 12 digits and 4 decimals, all four or none, only in
    stocks/options accounts; otherwise `bad_option` (existing code).
  - `import_commit` writes the four columns, which `trades_option_shape` already allows.
  - A non-OCC option row in a **stocks** account cannot be told from a stock. It is stored as a stock and computed ×1:
    wrong by 100×, visible in `conferir` (§18; Q7). In an **options** account, `trade_instrument` without a contract
    uses the market caps (`pnl prices`, `mult 100`), which is right for standard contracts.
- **Linking options.** §11.

---

## 11. Linking to registered trades (the 3c rules)

Inherited as is, for slices, multi-row positions and single rows:
- candidates: the account's trades with a `trade_entry_context`, no broker ID, no file exit yet, same side,
  `trade_match_key` equal, app entry between −2 min (live) or −16 min («Já fechada») and +16 min of the file's;
- order: same size first (a typed «Contratos» typo never duplicates), then the smallest gap, then the stable keys;
- greedy one-to-one; pass 2 for positions the app registered as one trade per exit (before 3c);
- what a link writes: key, every money column the file states otherwise, a close at the file's exit if it already
  happened; never hours, stop/target, marks, context, note, images;
- `trade_import_links` before/after; undo in any order;
- the reverse check `trade_similar` (D30) when registering after an import: platform-agnostic, unchanged.

Changes for 3b:
1. **Same option contract.** The candidate join in `import_stage` adds
   `(t.option_right, t.strike, t.expires_on) is not distinct from (r.option_right, r.strike, r.expires_on)`, so an AAPL
   option never links to an AAPL stock trade. For Ebinex and Top One both sides are null, so nothing changes. The TS
   twin `assignImportLinks` (`MatchRow`/`MatchTrade`) gains the same condition, and shared cases record it.
2. **No `notes`** written by links for `'modelo'` (§3.3).
3. **The row's `pnl_basis`** instead of `'file'` in the link's `set` when the file's money wins (§9.1).

What this means for the owner, in an example: he registers MES long 3 at 10:00 on the phone, takes a partial of 1 at
10:03 and closes 2 at 10:07. Later he imports the platform's execution file (L2 buy 3 10:00:05, L3 sell 1 10:03:10, L4
sell 2 10:07:40). That gives one lot with two slices, one position, linked to his trade (same key, side and size, entry
5 s apart). The file's two exits replace the app's money, the app's three hours stay, and «{n} já registradas por você»
counts 1.

---

## 12. SQL changes, function by function

| Object | Change | Ebinex / Top One |
|---|---|---|
| `import_templates` | NEW table, RLS, grants (§4) | — |
| `import_batches` | + `template_id`, `template_name`, `header_sig` (R3); platform check + `'modelo'` | rows unchanged; check revalidates (all pass) |
| `trades`, `trade_exits` | two partial indexes `where source_platform = 'modelo'` (§3.4); no column | — |
| `market_caps_all()` | + `"mapping"` per market (strict JSON literal, parity-tested) | every other key unchanged; rule answers proved unchanged |
| `import_check_platform` | `'modelo'` where `mapping` (§3.2) | unchanged |
| `import_checked_rows` | **drop + create** (internal; the return type changes). Input keys `pnl_basis`, `option_right`, `strike`, `expires_on`, `multiplier`. Output columns + `pnl_basis`, the four option columns, `tuple_hash`, `key_kind`. A `'modelo'` branch: `external_id` null allowed (synthetic, §7.1; `@` refused in real IDs); direction long/short; `asset_type` derived (§10); stake/payout/duration/timeframe must be null (`bad_number`); P&L checks (§9.1: `no_price_result`, `pnl_mismatch`, `sign_mismatch`); `not_dollar_quote`; `bad_option` | the same codes and outputs (new columns null / `'file'`) |
| `import_link_patch` | `notes` only for legacy platforms; basis from the row | unchanged |
| `import_stage` | `elsewhere` for `'modelo'` (§3.4); the `'same'` path with the R12 time rule (§7.3); option contract in the candidate join (§11); temp table gains the new columns | unchanged classification |
| `import_exits_link` | `notes` only for legacy platforms; file exits take the row's basis | unchanged |
| `import_preview` | **drop + create** with a trailing `p_format jsonb default null` (R3); `'same'` counted in `duplicate`; `duplicate_same` only when > 0; `other_source` only when > 0 (§3.6); for `'modelo'`, `tz_not_confirmed` → `tz_mismatch` (R4, §8); `bad_format` | unchanged keys and values (the new keys are absent while 0) |
| `import_commit` | **drop + create** with `p_format` (R3): `header_sig` written on every `'modelo'` batch; the R4 zone rule; inserts: `notes` conditional, `pnl_basis` from the row (group: by precedence), option columns, `asset_type` from the checked rows (already so); `'same'` never written; batch counts as built | unchanged |
| `import_undo`, `import_fix_tz`, `import_tz_status` | none | — |
| `import_template_save` | NEW API (§4.5), with `p_replaces` (R13) | — |
| `import_template_sig(jsonb)` | NEW internal (sig from `headers`) | — |

Privileges as 3c's proof checks them: anon executes none; authenticated executes the API (`import_preview`,
`import_commit`, `import_undo`, `import_fix_tz`, `import_template_save`); internal functions are revoked; every
`SECURITY DEFINER` function has `search_path ''`. `import_checked_rows` is re-revoked after its re-creation, and so are
`import_preview` and `import_commit` (revoke from public and anon, grant to authenticated), since Supabase grants EXECUTE
on new functions. The undo kit drops the new signatures before restoring the old definitions, and both kits end with
`notify pgrst, 'reload schema'`.

---

## 13. Limits

| Limit | Value | Where | Why |
|---|---|---|---|
| File size | 5 MB | browser (`MAX_FILE_BYTES`, as built) | largest real export ≈ 54 KB |
| Data records | 10 000 | browser (`MAX_RECORDS`, as built) | — |
| Slices sent (fill files) | 10 000 → `too_many_rows` | browser | a fill can close several lots |
| Columns | 100 → `too_many_columns` (NEW) | browser; template `headers` 2..100 | a phone `mapa` of 100 selects is already the edge; IBKR Flex queries can carry dozens of fields |
| Header name | 80 characters (normalised, truncated) | browser; template check | — |
| Title lines skipped | 20 | sniff; `header_skip` | statements |
| ID | 64 characters, no spaces, not starting with `@` | browser (`isValidExternalId`); SQL `^\S{1,80}$` | as built |
| Templates | 50 per user | `import_template_save` | sanity |
| Template payload | 16 KB | `import_template_save` | as 3c payloads (8 KB) with room for 100 names |
| Side / open-close words | 20 each, ≤ 40 characters | template | — |
| **Statement time** | Supabase `authenticated` default **8 s** (Supabase timeouts doc) | `import_preview` / `import_commit` | **not measured at 10 000 rows** since 3c's loops; a timing test is in §16.4. If 10 000 invented rows take > 3 s on PG 17, the limit for mapped files drops to 5 000 |

---

## 14. Error, warning and notice codes

Existing codes are reused with their meaning: file `empty_file`, `too_large`, `too_many_rows`, `malformed_csv`,
`unknown_format`, `missing_columns`, `duplicate_columns`; row `column_count`, `missing_id`, `bad_id`, `duplicate_in_file`,
`missing_date`, `bad_date`, `missing_symbol`, `bad_direction`, `bad_number`, `bad_quantity`, `sign_mismatch`,
`unknown_status`; warnings `bad_exit_time`, `exit_before_entry`, `missing_price`, `missing_exit`; notice
`commission_in_file`; SQL `bad_offset`, `bad_option`; RPC `unknown_platform`, `wrong_market`, `invalid_tz`,
`tz_mismatch`, `tz_not_confirmed`, `concurrent_import`.

NEW (pt-BR copy is a proposal for the screens spec):

| Code | Kind · where | Meaning | Proposed pt-BR |
|---|---|---|---|
| `too_many_columns` | file · browser | > 100 columns | «O arquivo tem mais de 100 colunas.» |
| `header_not_found` | file · browser | no header row in the first 21 records | «Não achamos a linha com os nomes das colunas.» |
| `mixed_clocks` | file · browser (fills) | some rows with an offset, some without | «Horários com e sem fuso no mesmo arquivo de execuções.» |
| `no_price_result` | row · browser and SQL | no «Resultado» and the instrument is not computed | «Sem resultado: este ativo não tem conta pelos preços. Marque uma coluna de resultado.» |
| `not_dollar_quote` | row · browser and SQL | crypto pair not quoted in USDT/USDC/USD | «Par fora do dólar: o resultado não seria em US$.» |
| `pnl_mismatch` | row · SQL | the client's computed P&L ≠ `trade_pnl` (a twin bug) | «Não conseguimos conferir o resultado desta linha.» |
| `open_at_end` | row · browser (fills) | its lot is still open at the end (with «Abre ou fecha», or «Sim» to the end-of-file question, R1) | see §6.4 |
| `opened_before_file` | row · browser (fills) | closes a position opened before the file | «{n} execuções fecham posições abertas antes do começo do arquivo e ficaram de fora.» |
| `result_differs_from_prices` | warning · browser | file result ≠ computed by > 1 cent | «{n} com resultado diferente do calculado pelos preços: vale o do arquivo.» |
| `symbol_normalised` | notice · browser | futures symbols rewritten (§5.4) | «{n} ativos de futuros escritos como «MESZ26».» |
| `result_net_converted` | notice · browser | net → gross applied | ADAPTED from the as-built commission line |
| `identical_rows` | notice · browser | §7.2 | see §7.2 |
| `merged_fills` | notice · browser (fills) | §6.2 step 3 | «{n} execuções do mesmo segundo (ou da mesma ordem) viraram {m}.» |
| `split_entries` | notice · browser (fills) | positions built by several entries became one trade per entry | «{n} posições com mais de uma entrada viraram {m} operações, uma por entrada.» |
| `flat_start_assumed` | notice · browser (fills) | no «Abre ou fecha» column, and the symbol's fills close by the end (R1) | «Supomos que o arquivo começa sem posição aberta.» |
| `duplicate_same` | preview key · SQL | §7.3 | «{n} já estavam (mesma hora e preço)» |
| `unfilled_orders` | notice · browser (fills) | executed quantity 0 or blank: skipped, not sent (R2, §4.4) | «{n} ordens sem execução ficaram de fora.» |
| `unbalanced_symbol` | row · browser (fills) | «Não sei» to the end-of-file question: every fill of the symbol left out (R1, §6.4) | «As {n} execuções de {ativo} ficaram de fora: as compras e as vendas do arquivo não fecham.» |
| `other_source` | preview key · SQL | trades the file would insert on days holding another format's imports (R3, §3.6) | «{n} operações caem em dias em que {conta} já tem operações de outro formato de arquivo. Se forem as mesmas na corretora, elas vão se repetir.» |
| `bad_format` | RPC · `import_preview`/`import_commit` | `p_format` missing or malformed for `'modelo'`, or its `template` is not the caller's (R3) | the screens show the generic import error |
| `unknown_template` | RPC · `import_template_save` | `p_replaces` is not the caller's template (R13) | «Não conseguimos salvar o modelo.» |
| `bad_template` (HINT field), `too_many_templates`, `unknown_batch` | RPC · `import_template_save` | §4.5 | the screens show «Não conseguimos salvar o modelo.» |

Rules kept: issues carry a line and a code (and a field key), never a cell value. Exceptions carry a bare code. The
server's row errors come back in the preview's `errors`.

---

## 15. Migrations and the paste kit

### 15.1 Migrations (after `20261023000003`)

1. **`20261024000001_importacao_colunas.sql`**: storage and descriptor.
   - It opens with fingerprints of `trades`, `trading_accounts`, `account_rule_versions`, `trade_entry_context`,
     `trade_marks`, `trade_import_links`, `import_batches` (minus the two new columns), `profiles`, `trade_exits`,
     `trade_stop_moves`; every trade's `trade_state` minus `server_now`; every account's resolved rules and «Posso operar
     hoje?» now (3c's `tx_gate` pattern).
   - Then: `import_templates` with RLS and grants; the two `import_batches` columns; the platform check swap (a guard
     reads the old definition by name `import_batches_platform_check` and stops if it differs); the two partial
     indexes; `market_caps_all()` with `"mapping"`.
   - The end proves: no row changed, `import_templates` is empty, `market_caps_all()` minus `mapping` equals the old
     literal key by key, no rule resolution or gate answer changed.
2. **`20261024000002_importacao_colunas_api.sql`**: the functions of §12, `import_checked_rows` dropped and re-created,
   `import_template_save`, privileges.
   - The end proves: no row written; every `trade_state` equal; the privilege rules of §12; nothing with
     `source_platform = 'modelo'` and no batch with `platform = 'modelo'`.
   - A **golden replay inside the migration is not possible** (the API needs `auth.uid()`). The equivalence for Ebinex
     and Top One is proved by the unchanged suites `20_phase1`, `50_phase3`, `60_import_counts`, `81_parciais` passing on
     the new functions (§16.5).

The pairing (3b-4) needs **no third migration**. Every code it uses is a client code or already in migration 2. So the
database lands once, before both domain PRs.

### 15.2 The paste kit (`fase3b/aplicar/`, the 3c format)

- `fase3b_aplicar.sql`, built by `montar.py` from the branch tip:
  - a guard that stops at the first line on a second paste (`to_regclass('public.import_templates') is not null`);
  - an in-database backup schema `backup_fase3b` holding `pg_get_functiondef` of every replaced function and the old
    check definition;
  - both migrations, and the conferência;
  - all in one transaction.
- **Live data must not change.** Nothing is backfilled. The new columns are null. The new key in `market_caps_all()`
  is read by nobody but `import_check_platform`. The proof stops the paste otherwise.
- Replay before handing it over, on a cluster shaped like the live database: 3c's replay had 631 trades including 2
  registered in the app, 6 accounts (futures 3, binary 1, forex 1, b3 1) and 9 rule versions. Check that the
  conferência is clean and a second paste stops.
- `desfazer_fase3b.sql`: restores the functions from `backup_fase3b`, drops the table, the columns, the indexes and the
  key, and restores the check. It **refuses** once any `'modelo'` batch, trade or template exists (as 3c's undo refuses
  after a partial).
- **Order:** paste first, then merge and deploy the app (`pr_banco.md`'s rule). The app of today keeps working against
  the new functions (same signatures and answers; §5.6 compatibility), and the new app needs them.

---

## 16. Test plan

### 16.1 SQL: `supabase/tests/82_importacao_colunas.test.sql` (NEW)

The next free number after 81. It runs after `81_parciais` in `run.sh`'s glob order. The sibling survey suggests `90_`
for a new phase. Either works; the synthesis picks one. Two users, invented data, every import through preview then
commit with the counts compared key by key (as `tests.imp81`).

- **Platform and market:** `'modelo'` accepted on futures, forex, stocks, crypto, b3, options; `wrong_market` on binary;
  `archived_account`; `unknown_platform` for other values; Ebinex and Top One rules unchanged.
- **Rows:** direction long/short only; stake, payout, duration or timeframe present → `bad_number`; `asset_type`
  derived per market and symbol (WINZ26 → futures, PETR4 → b3, EURUSD → forex, OCC → option); `@`-prefixed real ID →
  `bad_id`; option contract checks → `bad_option`.
- **Money:** `prices` basis equal to `trade_pnl` → accepted, stored `'prices'`; one cent off → `pnl_mismatch`; prices
  basis on a typed instrument → `no_price_result`; USD-base forex → `'estimate'`; `ETHBTC` and `BTCUSD_PERP` →
  `not_dollar_quote`; `'file'` basis kept; result vs sign → `sign_mismatch`.
- **Keys:**
  - the synthetic key is stable for the same file twice, a reordered file, a longer export, and «6801» vs «6801.00»;
  - identical rows both kept, with distinct keys;
  - a zone fix leaves keys unchanged;
  - real-ID re-import → 0 new;
  - the `'same'` fallback, single-row and whole-position: real-ID import then a no-ID re-import → 0 new, all
    `duplicate`, `duplicate_same` = n; a partial position match → new.
- **Cross-account:** a real ID in another account of the same market and platform → `other_account`; same ID, other
  platform → new; synthetic keys in two accounts (copies) → both new, no `concurrent_import` (no `notes`).
- **`notes`** null for every `'modelo'` trade, including linked ones; Ebinex and Top One still write it.
- **Positions and slices:**
  - two slices of one lot → one trade plus two file exits with the 3c sums;
  - a longer export → `attach`;
  - link to a registered live trade with app partials (app hours kept, file money, `differs`), then undo in either
    order giving back the registered values;
  - option contract mismatch → no link.
- **Templates:**
  - RLS: B cannot select, delete or upsert A's template; there is no insert or update via PostgREST;
  - `import_template_save` validation: unknown key, non-normalised header, field twice, missing required, an
    `account_routes` value that is not the caller's, a bad `tz_hint`, > 50 templates;
  - an upsert on the same signature updates it;
  - `p_batch` rules (`unknown_batch` for another user's, an undone or a non-`'modelo'` batch);
  - the signature equals the SQL recomputation;
  - deleting a template keeps `import_batches.template_name`.
- **Zone:** a mapped account's first file confirms the zone; `tz_mismatch`; `import_fix_tz` moves mapped trades and their
  file exits; exact rows (offset) need no zone.
- **Proof helpers:** after the suite, no Ebinex or Top One trade carries `'modelo'` fields.
- **Review additions (R3, R4, R12, R13):**
  - `other_source`: a mapped file over Top One imports on the same days counts its new trades; the same file again
    counts 0; a second mapped format (another `header_sig`) counts; a file under a model re-keyed by `p_replaces` counts
    0 against that model's earlier batches; a Top One file over mapped imports counts too;
  - `header_sig` is written on every `'modelo'` batch, with and without a saved model; `bad_format` for a missing or
    malformed `p_format`, or another user's `template`;
  - G2: an unconfirmed account holding Top One wall-clock trades refuses a mapped file in another zone with
    `tz_mismatch`, and no trade moves; the same zone imports and confirms it;
  - the `'same'` fallback matches offset rows (UTC instant) and wall-clock rows, never one against the other;
  - `p_replaces` re-keys in place and keeps the `id`; another user's id → `unknown_template`; a signature held by
    another of the caller's templates → `bad_template`;
  - today's calls (no `p_format`) to `import_preview`/`import_commit` give the as-built answers.

### 16.2 Shared cases: `app/__tests__/domain/cases3b.json` + `cases3b.test.ts` (NEW)

Recorded from the SQL by a generator kept outside the repo, as `cases3c.json` was. Every «expected» is computed by the
migrations of §15.1 on a throwaway cluster:

- header signature: `headers` → `header_sig` (accents already removed by TS, repeats, empty name, a non-BMP character);
- `trade_instrument` → `asset_type`, `pnl` mode and multiplier for mapped symbols per market (incl. normalised futures,
  B3 series, crypto quotes, forex `prices_div_exit`, OCC contracts);
- `trade_pnl` for slices (cents rounding at the edges, `estimate`);
- `import_checked_rows` acceptance: the TS mapped reader's output for each fixture is accepted by the SQL with
  `code` null, and the TS-predicted codes (`no_price_result`, `not_dollar_quote`, `bad_option`) equal the SQL's;
- `assignImportLinks` vs `import_stage` with option contracts (extends the 3c group);
- `trade_match_key` of normalised futures symbols.

### 16.3 Jest, domain (invented fixtures only)

- **Sniff:** `,` `;` tab; decimal comma / point / grouped; title lines; date order decided and ambiguous; header clock;
  `too_many_columns`, `header_not_found`.
- **Values:** numbers (parentheses, `−`, `R$`, suffixes, refusals); dates (every format of §5.4, epoch, roll-over
  refused); sides, open/close and saved words; futures normalisation; OCC parse and refusals; IDs (`@` refused).
- **Trade reader:**
  - the board sample reproduces the board's strings («1 out, 09:34», «compra», «2 contratos», «−US$ 39,98»; l.1067–1080
    logic);
  - net → gross gives −37.50 / +9.50 / +27.50;
  - `ImportRow` has exactly `IMPORT_ROW_KEYS`, and no cell value appears in any issue or exception.
- **Fill reader:**
  - the §6.5 examples;
  - merge by second and by order ID;
  - flip;
  - the open-at-end lot dropped whole;
  - `opened_before_file` by `open_close` and by `realized`;
  - commission split, exact per fill;
  - realized split and net → gross;
  - descending files;
  - MESZ6/MESH7 never paired;
  - `mixed_clocks`; slices > 10 000 → `too_many_rows`;
  - keys `open>close` and the fallback to null over 64 characters.
- **Template:** normalise, signature, exact / changed / none, JSON round trip, the 50 limit enforced by the RPC (mocked
  answer).
- **Legacy readers:** `parity.test.ts`, `rpc.test.ts` and the fixtures unchanged, except the constant new keys.

### 16.4 PG-backed Jest (the `hub*.pg.test.ts` pattern)

`hubImportColunas.pg.test.ts` and its recorded answers `hubImportColunas.test.ts` cover:
- mapped trade files and fill files end to end through `import_preview`, `import_commit`, `import_template_save` and
  `import_undo`, with preview = commit key by key;
- a **timing case**: 10 000 invented one-row positions and 10 000 slices, each under 3 s on PG 17 (§13);
- run locally and in the 3b-1 PR notes, not in CI timing.

### 16.5 Regression (must stay green unchanged)

- SQL: `20_phase1`, `30_phase2`, `40_markets` (+ `mapping` in the descriptor checks), `50_phase3`, `60_import_counts`,
  `70_registrar_mercados`, `80_regra_breakeven`, `81_parciais`.
- Jest: `cases3c`, `registro/cases`, `gate/cases`, `markets.test.ts` (parity with `mapping`), `ImportSheet.test.tsx`
  (Ebinex and Top One flows), `legacyImport.golden.test.ts`.
- `tsc`, lint, and the 3c mutation-testing approach for the two migrations: every survivor explained.

---

## 17. Effort

**Revised (21 Oct):** the synthesis (`sintese.md` §2.2) holds the current figures: 3b-1 3–3.5 days and 3b-4 3.5–4
(domain and screen variant), about 13–16 days for the whole phase after the review fixes. The table below is the
original estimate.

| Piece | Content | Days |
|---|---|---|
| **3b-1 Banco** | two migrations (§15.1), `82_` suite, `cases3b` SQL generator, paste kit (aplicar, desfazer, replay on a live-shaped cluster), timing check | 2.5–3 |
| **3b-2 Domínio · operações** | `mapped/` sniff, values, fields, template, `trades.ts`; type widening; `parseNumLocale`; futures and OCC symbols; `MARKET_SPEC.mapping` + parity; `cases3b` TS side; Jest | 2.5–3 |
| **3b-4 Domínio · execuções** | `fills.ts` (merge, FIFO, flips, leftovers, guards, splits, keys, notices); Jest; PG-backed cases with slices | 2–2.5 |
| *Database + domain (this spec)* | | *7–8.5* |
| 3b-3 Telas (other spec) | `mapa`, `conferir`, template chip, flow, per-market copy | 2.5–3 |
| Board revision (other spec) | the NEW bits (row kind, fill fields, date order, side words, notices) | 0.5–1 |
| Telas · execuções (other spec) | the fill variant of `mapa`/`conferir`, leftover lines | about 1 |
| *Whole 3b* | | *about 11–13.5* |

This is more than the scoping's 5–7 days without executions. The reasons: since 3c the import functions to touch are
larger (`elsewhere`, `notes` in four places, the basis), `import_checked_rows` has to be re-created, and the template RPC,
the key fallback, options and futures symbols, and a paste kit with an undo kit are all new.

---

## 18. Risks

- **A wrong mapping imports wrong money silently** (a % column as «Resultado», a net column as gross). Mitigations: the
  value checks, `conferir`, the prices check (`result_differs_from_prices`), the preview totals, «Desfazer».
- **Fill files without «Abre ou fecha» (revised, R1):** a file starting mid-position would mis-pair every later fill of
  the symbol. The end-of-file rule catches it whenever the symbol does not close, and by default drops the symbol.
  Remaining: a position held across both ends (undetected), a wrong «Sim»/«Não» answer, and positions spanning two
  exports (Rithmic's overnight positions never enter by file) (§6.4).
- **Realized result split** by quantity where the instrument does not compute, when one closing fill closes several
  lots (§6.3, R7): the fill's total is exact, the split between trades is not.
- **Commission unknown** for files without it (Tradovate Orders, R15): the daily limit counts those trades gross.
- **Scale-ins become several trades** (Q2(a)). Win rate and trade counts read per entry, and a registered trade typed as
  one averaged entry links to one lot only (its quantity corrected by the file, decision 2), with the other lots
  imported beside it.
- **Synthetic keys drift** with precision or symbol-format changes (§7.4).
- **8 s statement timeout** at 10 000 rows: not measured (§13).
- **Option rows in a stocks account without OCC symbols** are computed ×1 (§10).
- **Inverse crypto** quoted as `BTCUSD` computes linearly (§9.4), the same gap as in Registrar.
- **One IBKR Flex with several asset classes** into one account: futures rows in a stocks account would be stocks ×1.
  There is no «Tipo de ativo» field in 3b. The preview shows the symbols.
- **One «Conta» value per import** (§2.3, R9): a file with several accounts needs one import per account.
- **Client twin drift** (`pnl_mismatch`, `asset_type`) shows as row errors, never as stored wrong values. The shared
  cases keep the twins equal.
- **DST repeated hour** ordering of fills (§8).
- **Public repo**: invented fixtures only; headers from the owner, if he sends one, are reported as names only and never
  committed with rows.

---

## Sources

Repo (read-only, `3f439f8`): the files listed at the top. Scratchpad: the documents listed at the top, especially
`fase3b/levantamento/estado_atual.md`, `fase3/levantamento/importacao_colunas.md`, `fase3c/banco.md` §9.11,
`fase3c/pr_banco.md`, `mercados/fatos_mercados.md`. Board: `fase3b/quadro/atual/project/ImportarConta.dc.html`
(untrusted markup, read as data).

Web (public export formats; paraphrased):
- IBKR Reporting Reference, Trades (Flex): Buy/Sell, Quantity, Trade Price, IB Commission, Realized P&L (commissions
  netted for cost basis and realized P&L), Open/Close Indicator, Notes/Codes, Trade/Order/Execution IDs, levels of detail
  Executions / Orders / Closed Lots: https://ibkrguides.com/reportingreference/reportguide/tradesfq.htm
- Tradovate API, FillPair (positionId, buyFillId, sellFillId, qty, buyPrice, sellPrice) and Fill items:
  https://partner.tradovate.com/api/rest-api-endpoints/positions/fill-pair-item ,
  https://partner.tradovate.com/api/rest-api-endpoints/orders/fill-items
- TradesViz, Tradovate import (use the Orders tab, not Performance; commissions come from Cash History):
  https://www.tradesviz.com/brokers/Tradovate ; TraderInsight, Tradovate import (Orders, Performance, Cash History):
  https://traderinsight.pro/blog/import-tradovate
- TradeZella, Rithmic R|Trader Pro (Order History columns: Account, Status, Buy/Sell, Qty Filled, Avg Fill Price,
  Symbol, Order Number, Create Time, Update Time, Commission; one day per export):
  https://help.tradezella.com/en/articles/6839918-rithmic-r-trader-how-to-import-trades-from-rithmic-r-trader-into-tradezella-using-the-file-upload-method ;
  Tradesyncer, Rithmic manual import:
  https://help.tradesyncer.com/en/articles/11687958-how-to-manually-import-trades-from-rithmic-into-tradesyncer
- NinjaTrader forum, Trade Performance export (Executions/Trades display; date and time in one column):
  https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/97335-export-directly-into-excel ;
  https://www.tradezella.com/integrations/ninjatrader
- Binance exports (separate Order History and Trade History; futures per USDⓈ-M/COIN-M; spot Trade History export
  removed Feb 2022): https://traderssecondbrain.com/guides/how-to-export-binance-trade-history ,
  https://hackage.haskell.org/package/binance-exports
- Supabase timeouts (role defaults: anon 3 s, authenticated 8 s): https://supabase.com/docs/guides/database/postgres/timeouts
- Already cited in `fatos_mercados.md` and relied on here: Bybit export help (Order History; old «Trade Time(UTC+0)» /
  «Closed P&L» discontinued 11 Jul 2024), Match-Trader and cTrader via TradesViz, thinkorswim via TradingDiary Pro,
  Profit via TradesViz.

Not found: the exact Tradovate Performance.csv and Orders.csv headers, Binance USDⓈ-M export headers, Profit's order-list
columns. 3b-4 still needs one real header line (names only) before its fixtures are final.

---

## Open questions for the owner

**Superseded (21 Oct).** The owner questions are now `perguntas.md` (four questions), with the recommendations in
`sintese.md` (Open questions). Q2, Q4–Q10 below became defaults or contradictions there (C2, D23, D18, C11, C8, C10, C5,
C4); Q1 is perguntas 2 and Q3 is perguntas 3, both revised by R1. Kept for the record.

(Em português, como nas outras fases. Cada uma com a recomendação.)

**Q1 · Arquivos de execuções (uma compra ou venda por linha).** Tradovate (aba Orders, como o próprio quadro manda),
Rithmic, IBKR, thinkorswim, Binance e Profit exportam assim. O quadro desenha só «uma operação completa por linha».
- (a) Entram na 3b, numa PR própria (3b-4) depois das operações completas, com uma pergunta nova «Cada linha do arquivo
  é…» no quadro, e com você mandando antes só a linha de títulos (sem dados) do primeiro arquivo real.
- (b) A 3b fica só com operação completa por linha; execuções numa fase futura.
- (c) Tudo de uma vez.
**Recomendo (a):** sem execuções, a importação por colunas não serve para a Tradovate nem para a Rithmic de outras
mesas de futuros. O banco já fica pronto na 3b-1, e o modo de execuções não precisa de outra migração.

**Q2 · Posição montada com mais de uma entrada (aumentar a mão).**
- (a) Cada entrada vira uma operação (FIFO); as saídas são repartidas entre elas.
- (b) Uma operação por ciclo (de zerado a zerado), com preço médio de entrada.
**Recomendo (a):** é o modelo do Registrar (uma entrada, várias saídas; você decidiu sem entradas parciais na 3c), é como
a Top One agrupa, e liga certo com o que você registrou. O custo: duas entradas contam como duas operações.

**Q3 · Posição ainda aberta no fim do arquivo, e arquivo que começa com posição aberta.**
- (a) A posição fica de fora e a prévia diz quantas execuções; reimportar depois resolve. Supomos que o arquivo começa
  zerado, e conferimos quando o arquivo traz «abre/fecha» ou o resultado realizado.
- (b) Importar já a parte fechada; o resto entra depois na mesma operação.
- (c) Recusar o arquivo inteiro.
**Recomendo (a):** nunca entra operação pela metade nem inventada. Day trade quase sempre termina zerado.

**Q4 · Sem coluna de ID, o que é «a mesma operação»** (o quadro: «Mesmo ID, ou mesma hora e preço, é reimportação,
nunca cópia.»).
- (a) Mesma entrada (data e hora), ativo, lado, quantidade, preços e saída. Duas linhas idênticas no mesmo arquivo entram
  as duas, com aviso. Também conferimos contra o que já entrou com ID.
- (b) Igual, mas de linhas idênticas entra só a primeira.
- (c) Exigir coluna de ID.
**Recomendo (a):** reimportar nunca duplica, e duas operações iguais de verdade não somem.

**Q5 · Resultado do arquivo × calculado pelos preços.**
- (a) Vale o do arquivo; o cálculo só confere e responde «já desconta a comissão?». Quando o arquivo não tem resultado,
  calculamos onde a conta é exata e guardamos como «calculado pelos preços» (não como «do arquivo»).
- (b) Vale o calculado sempre que a conta é exata.
**Recomendo (a):** segue a sua decisão da Fase 3 («o arquivo vale para o dinheiro»), e as Análises sabem o que veio da
corretora.

**Q6 · Cripto fora do dólar** (ETH/BTC, contratos COIN-M da Binance).
- (a) Recusar essas linhas: o resultado viria em moeda, não em US$.
- (b) Importar o resultado do arquivo como se fosse US$.
**Recomendo (a)** (contas em US$; nada é convertido).

**Q7 · Opções em arquivos de ações dos EUA.**
- (a) Reconhecer o símbolo padrão OCC (ex.: «AAPL  261120C00150000»): contrato, vencimento, strike, ×100. Outros
  símbolos entram como ação.
- (b) Opções só numa conta de Opções.
- (c) Sem opções na 3b.
**Recomendo (a):** é o formato da IBKR e da maioria das corretoras americanas.

**Q8 · Futuros escritos de outro jeito** («MES 12-26» no NinjaTrader, «/MESZ26» no thinkorswim).
- (a) Guardar como «MESZ26», para calcular o resultado e ligar com o que você registrou.
- (b) Guardar como escrito (resultado digitado, sem ligar).
**Recomendo (a).**

**Q9 · O mesmo ID em outra conta.**
- (a) Só conta como «já está em outra conta» quando as duas contas são do mesmo mercado e da mesma plataforma, e só com
  ID de verdade (nunca com «mesma hora e preço», que numa cópia é esperado).
- (b) Nunca checar outras contas em arquivos por colunas.
- (c) Checar em qualquer conta.
**Recomendo (a):** evita que o número de uma corretora esconda operação de outra, e mantém o cenário 4 do quadro.

**Q10 · Mais de uma coluna de custo** (comissão, taxas, swap).
- (a) Uma coluna só em «Comissão», como o quadro («Cada campo vai em uma coluna só.»); um arquivo posterior com
  comissão completa o que faltou.
- (b) Somar várias colunas em «Comissão».
**Recomendo (a)** para a 3b; (b) cabe depois sem mudar o banco.
