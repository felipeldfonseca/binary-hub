# Phase 3b survey · estado atual: what the column-mapping import plugs into today

Scope: the import path as built and live on `feature/rebuild-lean` = `main` at `3f439f8` (migrations live through
`20261023000003`), read end to end; then the Phase 3b scoping spec (`fase3/levantamento/importacao_colunas.md`, written
before Phase 3 was built) checked section by section against it; then the exact seams where a mapped file would enter.
This is a survey, not a design: it says what exists, what is stale, and what 3b can reuse.

How it was read: the repository read-only (nothing edited, no `.env` read, the live Supabase never called). `docs/csv`:
file names, header lines and record counts only (§1.12). The approved board
`fase3b/quadro/atual/project/ImportarConta.dc.html` (sha256 `48943630…f88e`, 1205 lines) read as markup.

Markers: **STALE** = a statement of the scoping spec that the build contradicts (the as-built fact follows);
**DELIVERED** = something the scoping spec planned for 3b (or for Phase 3 on 3b's behalf) that is already in the code;
**NEW** / **ADAPTED** as in the other specs (not on any board / a board string or behaviour changed). pt-BR strings are
quoted exactly, with the file and line (code) or board line.

---

## 0. Summary

1. **The pipeline is generic below the reader and two-format above it.** Everything after a file becomes `ImportRow[]`
   (preview, zone, commit, batches, undo, links to app trades, partial-exit grouping, Importações) knows nothing of Ebinex
   or Top One except through the `platform` string. The two-format assumptions sit in a short, listable set of places:
   `Platform`/`ImportMarket`/`FileVariant`/`ImportRow.asset_type` types, `detectPlatform`, `PLATFORM_MARKET`,
   `import_check_platform`, the `import_batches.platform` check, the per-platform branch of `import_checked_rows`, the
   `MARKET_SPEC[m].reader` gates (6 places) and the copy typed on `ImportMarket` (§7).
2. **A mapped file can enter at one browser seam**: `ImportSheet.onFile` (`ImportSheet.tsx:374–402`) sends every
   unreadable file to `erro` at line 387. If 3b produces a `ReadImportFileResult` whose `outcome` is a `ParsedFile`
   (widened), the rest of the sheet (`afterAccount → c/conf → runPreview → d → commit → fim → undo`) takes it as is, and
   the payload to `import_preview` / `import_commit` is unchanged in shape (§8.2).
3. **The database already does for any platform what 3b needs most**: one-to-one linking of file rows to trades
   registered in the app (Phase 3, D29/C13), partial exits of one position folded into one trade with one file exit per
   row (Phase 3c), preview counts equal to commit counts, undo that gives back what was registered, the zone guard
   (`source = 'import'` only). All keyed by `(account_id, source_platform, external_id)` and `trade_match_key()`, so a
   third platform value inherits them (§2.5, §2.6).
4. **What is missing for 3b is exactly what the scoping listed, plus four things the build made concrete**: (a) every
   row must carry an `external_id` (`^\S{1,80}$`, else `bad_id`), so a file without an ID column needs a synthetic key
   somewhere; (b) the cross-account check («em outra conta») is built on the legacy `notes` key `platform:id` and on
   file-exit tickets (`import_stage`), so the scoping's "no `notes` for mapped rows" now means changing `import_stage`
   too; (c) `import_commit` writes `pnl_basis = 'file'` for every new row, so a result computed from prices would be
   labelled "from the file" unless the payload carries the basis; (d) pt-BR numbers: the reader that accepts
   «6.801,00» exists (`lib/hub/numero.ts lerNumero`) but `lib/domain` may not import `lib/hub` (ESLint override pinned
   by `__tests__/domain/boundary.test.ts`), and the import's `parseNum` rejects Brazilian notation.
5. **Phase 3 and 3c delivered several 3b prerequisites** (§6): the instrument table (`INSTRUMENT_SPEC` /
   `instrument_specs()`) with the per-market `asset_type`, `tradeInstrument`, `pnlFromPrices` (SQL twin `trade_pnl`),
   `tradeMatchKey`, the `assignImportLinks` TS twin of `import_stage` (its header says "for previews and for the column
   import of Phase 3b"), per-market quantity labels, `viraODia()` for per-market day-turn sentences, the
   `source = 'import'` guard, and the reconciliation the scoping's Q1 asked for (decided, built differently: the file wins
   on money).
6. **Scoping statements that are now wrong** (details in §5): the RPC description of §2; §0.6/§8.3 (reconciliation is
   built, with a −2/+16 min window, any size, money from the file); §8.2/§8.4 (vocabulary lives in `TRADE_CAPS`, not
   `MARKET_SPEC`; forex majors ARE computed); §3.4's "pelos preços" coverage note; §3.7's «Lembrar…» control (never built);
   §3.8's Phase 3 half (done); §5.3's guard (done); the DB test file number (`60_` is taken); §8.1's
   `rule_version_id` on imports (not done: imports keep it null).

---

## 1. The reading path (browser)

### 1.1 Module map

| File | Role | Key exports |
|---|---|---|
| `app/lib/domain/import/index.ts` | barrel; "depends only on ../tempo, a type from ../markets and the standard library" | everything below |
| `types.ts` | shapes, codes, limits | `ImportRow`, `IMPORT_ROW_KEYS`, `EBINEX_COLUMNS`, `TOPONE_COLUMNS`, `CanonicalColumn`, `ROW_ERROR_CODES`, `ROW_WARNING_CODES`, `FILE_ERROR_CODES`, `Notice`, `ParsedFile`, `FailedFile`, `PLATFORM_MARKET`, `PLATFORM_FILE_TZ_HINT`, `MAX_FILE_BYTES` (5 MB), `MAX_RECORDS` (10 000) |
| `text.ts` | bytes → text, header normalisation | `decodeCsvBytes`, `normalizeHeader` |
| `csv.ts` | RFC 4180 records with physical line numbers | `readCsv`, `CsvError` |
| `detect.ts` | header → format | `detectPlatform` |
| `decimal.ts` | exact decimals (BigInt) | `parseNum`, `toDecimal`, `toUnits`, `percent`, `sum`, `PRICE_DIGITS`/`MONEY_DIGITS`/`PAYOUT_DIGITS` |
| `clock.ts` | wall-clock stamps, no zones | `parseBrDateTime`, `parseIsoDateTime`, `addSeconds`, `floorMinute`, `secondsBetween`, `candleSeconds` |
| `collect.ts` | per-file accumulator | `RowCollector`, `isValidExternalId`, `isValidSymbol`, `issue` |
| `ebinex.ts`, `topone.ts` | the two readers | `parseEbinexRecords`, `ebinexExit`, `parseTopOneRecords` |
| `parseFile.ts` | whole file | `parseImportText`, `readImportFile`, `sha256Hex` |
| `preview.ts` | browser preview helpers | `previewInstant`, `entrySpan`, `entryHistogram`, `totals` |
| `rpc.ts` | RPC argument builders | `buildImportArgs`, `previewArgs`, `toRpcRow`, `toRpcErrors` |
| `app/lib/hub/contas.ts` | zone strips and the card's dates, over `ImportRow` | `displaySpan`, `zoneBars`, `fileDays`, `FILE_ZONES`, `OTHER_FILE_ZONES`, `REFERENCE_TZ`, `zoneKeyOf` |
| `app/lib/hub/contasDb.ts` | the RPC calls and their answer types | `importPreview`, `importCommit`, `importUndo`, `importFixTz`, `ImportPreviewResult`, `ImportCommitResult`, `FixTzResult`, `fetchImportFormats`, `fetchBatches` |
| `app/lib/utils/{ebinexParser,topOneParser,csvBrokerDetect,importTrades}.ts` | **legacy** readers and the old PostgREST upsert | referenced only by tests (`parity.test.ts`, `legacyImport.golden.test.ts`, `importTrades.test.ts`, `boundary.test.ts`) and `.eslintrc.json`; no app code imports them |

Note for the owner's docs: `CLAUDE.md` says `app/lib/utils/` holds "CSV parsers for Ebinex and Top One, and the import
path". The live path is `app/lib/domain/import`; `lib/utils` holds only the frozen legacy readers kept for the parity
tests. (Observation only; not edited.)

### 1.2 Bytes → text
`readImportFile(file)` (`parseFile.ts:89–97`): size over 5 MB → `{ok:false, error:'too_large'}` without reading; else
SHA-256 over the raw bytes (`sha256Hex`), `decodeCsvBytes` (strict UTF-8, then a hand-made windows-1252 table because
Node 22–24 read that label as ISO-8859-1; UTF-8 BOM dropped), `parseImportText`. Returns
`{fileName, size, sha256, outcome}`. **The decoded text and the records are not kept**: a `FailedFile` holds only a code,
a line, the best platform and our names of missing columns.

### 1.3 Text → records
`readCsv(text, {maxRecords})` (`csv.ts:43–107`): comma only (no delimiter option); a quote opens a quoted cell only at the
start of a cell; `""` inside; CRLF/LF/CR mixed; blank lines skipped (a line of commas is a record); every record keeps the
physical line where it starts (header = 1). Errors: `malformed_csv` (line of the opening quote), `too_many_rows` (over
10 000 data records). No title-line skipping: the header is the first non-blank record.

### 1.4 Header → format
`detectPlatform(header)` (`detect.ts:69–85`): names compared after `normalizeHeader` (NFD accents dropped, quotes and BOM
removed, spaces collapsed, lower case) plus one alias (`ticket#` → `ticket #`); order free; extra columns ignored; **every**
canonical column required (Ebinex 13, Top One 14, including `Gain` and `Duration`, which are not stored). Best match by
share of columns found: below half → `unknown_format`; at least half with a repeated name → `duplicate_columns`; at least
half with gaps → `missing_columns` + our names of the missing ones. Files are never recognised by name or by data.

### 1.5 Records → `ImportRow`
`ImportRow` (`types.ts:38–62`), keys = `trades` column names, sent in `IMPORT_ROW_KEYS` order:

| key | Ebinex (`ebinex.ts:94–309`) | Top One (`topone.ts:54–217`) |
|---|---|---|
| `line` | physical line | same |
| `external_id` | `ID` | `Ticket #` |
| `symbol` | `Ativo` | `Symbol` |
| `asset_type` | `'binary_option'` | `'futures'` |
| `direction` | `Previsão` bull/bear → `call`/`put` | `Side` BUY/SELL → `long`/`short` |
| `local_entry` / `utc_offset` | `Data`: `DD/MM/YYYY HH:MM:SS` (no offset) or ISO with offset | `Open Time` (no offset, UTC clock) |
| `local_exit` | computed: `Vela` + `Tempo` (next candle), null for a cancelled refund | `Close Time` |
| `entry_price` / `exit_price` | `P. ABRT` / `P. FECH` | `Open Price` / `Close Price` (0 or '' → null) |
| `quantity` | `'1'` | `Lots` |
| `stake_amount`, `payout_percent`, `duration_seconds`, `timeframe` | from `Executado`/`Valor`, `Resultado ÷ Executado`, `Tempo` | null |
| `result`, `pnl` | from `Status` (sign of `Resultado` only checked) | sign of gross `PnL` |
| `commission` | `'0.00'` (a known zero: the cut is in the payout) | `Commissions` (positive cost), null when empty |
| `stop_price` / `target_price` | null | `SL` / `TP` (0 or '' → null) |

Shared row rules (`collect.ts`): ID ≤ 64 characters, no space or control character (`isValidExternalId`); symbol 1–40, no
control character; the first occurrence of an ID wins, later ones become `duplicate_in_file` with `firstLine`. Notices
(`Notice`): `file_has_offset`, `unsigned_losses_negated`, `refunds_as_breakeven`, `commission_in_file`, `sl_tp_empty`.

Privacy rule, enforced by the types: issues carry `line`, `code` and optionally `column: CanonicalColumn` (our own header
names, never the file's text) and `firstLine`; no cell value ever reaches an issue, a notice or an exception message
(`types.ts:9`, `123`).

### 1.6 Numbers and dates
- `parseNum` (`decimal.ts:30–54`): `[sign][$][sign]digits[.digits]`, thousands grouped by commas in threes; **Brazilian
  notation (`9,00`, `1.234,56`) is rejected**, so is a Unicode minus and two signs; ≤ 64 characters. Bounds from the
  column types: price/quantity 10+8 digits, money 16+2, payout 4+4.
- The pt-BR reader exists outside the domain: `lib/hub/numero.ts lerNumero(text, {ponto, sinal})` («7.896,25», «7896,25»,
  «7896.25»; refuses «7,896.25»), used by «Registrar operação». `lib/domain` may not import `lib/hub` (ESLint
  `no-restricted-imports` override; `__tests__/domain/boundary.test.ts`).
- Dates (`clock.ts:18–71`): `DD/MM/YYYY HH:MM:SS` only (seconds required, day first), or ISO
  `YYYY-MM-DD[T ]HH:MM:SS[.ffffff][Z|±HH:MM]` (offset ≤ ±14:00; `Z` → `+00:00`); years 1900–2999; real calendar dates only.
  No `MM/DD`, no AM/PM, no two-digit years, no `YYYYMMDD`.

### 1.7 `ParsedFile`
`{ok:true, platform, variant, market, records, rows, errors, warnings, notices, needsFileTz, fileTzHint}`
(`types.ts:205–220`). `variant ∈ ebinex_br | ebinex_iso | ebinex_mixed | topone`; `market: ImportMarket =
Extract<AccountMarket, 'binary' | 'futures'>`; `needsFileTz` = some row has no offset; `fileTzHint` from
`PLATFORM_FILE_TZ_HINT` (Ebinex Brasília, Top One UTC). `records` = non-blank data records = rows + errors.

### 1.8 Browser previews over `ImportRow` (format-agnostic)
`previewInstant` (same rules as Postgres: skipped times take the offset before the change, repeated take the later),
`entrySpan` («No arquivo: entradas HH:MM–HH:MM, sem fuso.», p10–p90 cut at the largest gap), `entryHistogram`, `totals`;
`lib/hub/contas` `displaySpan`, `zoneBars`, `fileDays`; `lib/hub/regrasConta` `linhaAntesDasRegras` / `linhaImportadas`
(rows before/after v1 «desde»). All take `ImportRow` fields only (`local_entry`, `utc_offset`, `pnl`, `commission`).

### 1.9 RPC arguments
`buildImportArgs({accountId, platform, fileName, sha256, fileTz, outcome})` (`rpc.ts:61–83`) throws `RangeError` (no file
content) when the account is missing, `platform !== outcome.platform`, the hash is not 64 hex, or the zone is not `UTC`
/ Area/Location. `toRpcRow` copies exactly `IMPORT_ROW_KEYS` (nothing else reaches the server); `toRpcErrors` keeps
`{line, code}`; `previewArgs` drops `p_file_name` (PostgREST matches functions by argument names). Shapes in §8.2.

### 1.10 Calls
`contasDb.ts:379–386`: `importPreview(db, ImportPreviewArgs)`, `importCommit(db, ImportCommitArgs)`,
`importUndo(db, batchId)` → `{deleted}`, `importFixTz(db, accountId, tz, dryRun)` → `FixTzResult`; 30 s client timeout;
errors mapped to `HubErrorCode` (never the database's text). `fetchImportFormats` reads
`import_batches(account_id, platform)` where `status = 'done'` → «{conta} já recebeu este formato.» in step `a`.

### 1.11 Legacy path (frozen)
`lib/utils/importTrades.ts` posted to `/rest/v1/trades?on_conflict=user_id,notes`; the `trades_bridge` trigger still turns
such an insert (notes `ebinex:`/`topone:`) into `source = 'import'`. No screen uses it; `parity.test.ts` compares the new
readers with the legacy ones on the fixtures.

### 1.12 The owner's real files (`docs/csv`, headers and counts only)
Four files, all of the two built-in formats: `August_25.csv` (Ebinex header; 22 records),
`operacoes_2026-05-10_03-31-55.csv` (Ebinex, 21), `operacoes_2026-05-13_01-29-38.csv` (Ebinex, 451),
`Trade-History-2026-05-10.csv` (Top One, 17 records, 14 columns, header quoted). Ebinex header:
`ID,Data,Ativo,Tempo,Previsão,Vela,P. ABRT,P. FECH,Valor,Estornado,Executado,Status,Resultado`. Top One header:
`"Ticket #","Symbol","Side","SL","TP","Open Time","Open Price","Close Time","Close Price","Duration","PnL","Lots","Commissions","Gain"`.
No new-market or other-platform export exists locally (as the scoping said).

---

## 2. The database path

Latest definitions (later migrations replace earlier ones with the same signatures):

| Object | Defined in (latest) |
|---|---|
| `import_batches` (+ `rows_linked`) | `20261017000003:8–39`, `20261020000004:74` |
| `trades` import columns, `trades_account_ext_uq unique (account_id, source_platform, external_id)` | `20261017000002:36–57` |
| `trades_user_id_notes_unique unique (user_id, notes)` | `20260510000001` |
| `trade_import_links` | `20261020000004:76–113` |
| `trade_exits` (file rows), `trade_exits_ticket` unique `(account_id, source_platform, external_id) where origin = 'file'` | `20261023000002:99–148` |
| `import_own_account`, `import_try_timestamp`, `import_clean_errors`, `import_check_platform` | `20261017000003:64, 89, 259, 289` |
| `import_checked_rows` | `20261018000002:167–312` |
| `import_tz_status`, `import_link_patch` | `20261020000004:121, 143` |
| `import_col_equal`, `import_stage`, `import_exits_link` | `20261023000003:1318, 1351–1501, 1519–1701` |
| `import_preview`, `import_commit`, `import_undo`, `import_fix_tz` | `20261023000003:1712–1811, 1819–2084, 2095–2198, 2204–2285` |
| `trade_caps_all()`, `instrument_specs()` | `20261022000001:48, 77` |
| `trade_match_key`, `trade_instrument` | `20261020000001:196, 224` |
| `trade_pnl` | `20261020000003:232` |
| `trade_similar` (D30) | `20261020000003:728` |
| `market_caps_all()` (with `reader`) | `20261023000001:90` |

### 2.1 Tables
- **`import_batches`**: `platform text not null check (platform in ('ebinex', 'topone'))`, `file_name ≤ 255`,
  `file_sha256 ~ '^[0-9a-f]{64}$'`, `file_tz not null`, counts `rows_total / inserted / duplicate / completed /
  other_account / error / linked` (disjoint parts of the file since `20261021000001`), `error_rows jsonb` (line + code
  only), `is_legacy` (one per account, never undone), `status done|undone`. RLS select own; no write policy (functions
  only).
- **`trades`** (import-relevant): `source live|after|import`, `source_platform ~ '^[a-z0-9_]{1,20}$'`,
  `external_id` 1–200 chars, `notes` (= `platform:id`, the legacy key, unique per user), `source_local_entry` /
  `source_local_exit` (the file's wall clock, null when the file stated an offset), `trading_day`, `commission ≥ 0` (null
  = unknown), `stop_price`, `target_price`, `pnl_basis ∈ prices|estimate|typed|outcome|file`, `status open|closed`,
  `asset_type` free text (no check), `direction ∈ long|short|call|put`, option contract all-or-none (only on
  `asset_type = 'option'`). Direct API: select, delete, insert of the old writers' columns only
  (`20261020000003:1613–1619`).
- **`trade_import_links`** (per trade × batch): `line`, `set_key`, `closed`, `before`/`after` of every column the batch
  wrote, `differs` (money the file disagreed on), `file_entry_at`, `file_exit_at`. Select own; no writes from the API.
- **`trade_exits`** origin `file`: one row per file line of a multi-row position: `batch_id`, `line`, `source_platform`,
  `external_id` (the line's ticket), `file_exit_at`, `source_local_exit`, `quantity`, `exit_price`, `pnl`,
  `pnl_basis 'file'`, `commission`. A ticket is one exit of one trade per account (unique index).

### 2.2 `import_checked_rows(account, platform, file_tz, rows)` — validation and placement
Every row comes back with `code` null or an error code. In order: `bad_line` (`^\d{1,7}$`), `bad_id`
(`^\S{1,80}$`, **required**), `missing_symbol` (1–40 after trim), `bad_direction` (**per platform**: `ebinex` needs
`asset_type = 'binary_option'` and `call|put`; `topone` needs `'futures'` and `long|short`; any other platform value has
no branch), `bad_date` (`YYYY-MM-DDTHH:MM:SS[.f{1,6}]`, no roll-over), `bad_exit_time`, `bad_offset`
(`^[+-](0\d|1[0-4]):[0-5]\d$`), `unknown_status` (`win|loss|breakeven`), `bad_number` (`pnl` `^-?\d{1,16}(\.\d{1,2})?$`
required; prices `^\d{1,10}(\.\d{1,8})?$`), `bad_quantity` (required, > 0), then stake, payout, commission (unsigned money),
stop/target (unsigned price), `duration_seconds` (`^\d{1,6}$`), `timeframe` (`^[A-Za-z0-9]{1,8}$`); finally
`duplicate_in_file` (first occurrence of an ID wins). Placement: offset-less rows `local AT TIME ZONE p_file_tz`; rows with
an offset `(local || offset)::timestamptz` (never `AT TIME ZONE`, which reads `-03:00` POSIX-style); `trading_day =
compute_trading_day(account, entry)` (version-aware); `file_day` = the wall-clock date (for `day_changes`).

### 2.3 Platform checks (the three hard-coded places)
1. `import_batches.platform check in ('ebinex', 'topone')`.
2. `import_check_platform(acc, platform)` (`20261017000003:289–304`, never replaced): not `ebinex|topone` →
   `unknown_platform`; `ebinex` on a non-binary account or `topone` on a non-futures account → `wrong_market`. Called first
   by `import_preview` and `import_commit`.
3. `import_checked_rows`' per-platform `bad_direction` branch.

Not hard-coded: `trades.source_platform` (pattern only), `trade_exits.source_platform` (free), and everything in
`import_stage`, `import_exits_link`, `import_link_patch`, `import_undo`, `import_fix_tz` (they use `p_platform` as a key).
`market_caps_all()` carries `"reader": true` for futures and binary only; SQL never reads it (the app does).

### 2.4 `import_stage` — classification (the heart of preview and commit)
Builds `pg_temp.import_rows` from `import_checked_rows` plus, per row (`20261023000003:1351–1501`):
- `elsewhere`: a trade of the same user in **another** account with `notes = platform || ':' || external_id`, **or** a
  file exit of the same user, origin `file`, same `source_platform` and `external_id`, in another account → left out,
  counted `other_account`.
- `existing_id`: the trade of this account with the same `(source_platform, external_id)`; `existing_app`: that trade has
  a `trade_entry_context` (registered in the app); `exit_of`: the trade whose file exit has this ticket.
- `grp` (3c positions, never on a binary account): rows with an exit not before the entry and an entry price that share
  **symbol as written, side, entry instant and entry price** form one position (`dense_rank`); any other row is its own
  (`-rn`).
- `path`: `dup` (ticket already in the account as a trade key or a file exit), `attach` (new, and the position's other
  rows are all in one trade of the account), `group` (two or more new rows of a position not in the account), `row`.
- `link_id`: one-to-one matching of new positions/rows to app trades (§2.5); `attach_id`; `patch` (the row path's
  `import_link_patch`).

### 2.5 Linking to trades registered in the app (Phase 3 D29/C13, extended in 3c)
- Candidates: same account and user, `external_id is null`, same direction, has a `trade_entry_context`, no file exit yet,
  `trade_match_key(market, t.symbol) = trade_match_key(market, r.symbol)`, app entry between file entry − 2 min (live) or
  − 16 min (`reconstructed`, «Já fechada») and file entry + 16 min; binaries of another stake only when `expires_at` =
  the file's exit.
- Order: expiry = exit first, then same size (binary: stake; else quantity = the position's whole size), then smallest
  gap, then file entry, trade entry, trade id, line, rn. Greedy, each trade and position once. Pass 2: a position whose
  trade is not its size while another app trade of the same entry is free goes back to rows (the app registered it as
  one trade per exit before 3c).
- What a link writes (decision 2, «o arquivo vale para o dinheiro»): the row path (`import_link_patch`) sets the key
  (`source_platform`, `external_id`, `notes`) when missing, every money column the file states otherwise (entry price,
  quantity, stake, payout, commission; on a closed trade exit price, pnl, result → `pnl_basis 'file'`), and closes an open
  trade when the file's exit has already happened. The exits path (`import_exits_link`) writes one file exit per row and
  the sums on the trade (app hours kept where they pair). Never written on an app trade: `entry_time`, `registered_at`,
  `source`, account, rule version, stop/target, `source_local_*`, marks, entry context, note, images.
  `trade_import_links` keeps before/after, so `import_undo` gives back the registered values in any order.
- The reverse check (D30, `trade_similar`): registering a trade looks for `source = 'import'` trades of the account with
  the same match key and side near the entry («Esta operação parece já ter vindo do arquivo»). Platform-agnostic.

### 2.6 `import_preview` and `import_commit`
- `import_preview(p_account, p_platform, p_sha256, p_file_tz, p_rows, p_errors, p_rows_total)` → jsonb, writes nothing:
  `new`, `duplicate`, `completable`, `other_account`, `linked` (a position counts once), `linked_differs`, `day_changes`,
  `first_day`, `last_day`, `errors` (browser's + server's, `{line, code}`), `already_imported` (same SHA-256 in a `done`
  batch), `tz_status` (`ok | invalid_tz | tz_mismatch | tz_not_confirmed`; `ok` when every valid row has its own offset),
  `account_tz`, `tz_confirmed`, `rows_total`; and only when the file has partial exits: `trades_new`, `grouped`,
  `attached`. It runs `import_exits_link(..., p_dry := true)` so every key counts as the commit counts it.
- `import_commit(... p_file_name ...)`: account check, platform check, zone and name and hash checks, an advisory lock
  shared with the register functions (`trade_reg:<user>`), `import_stage`, zone status (raised only when some row uses the
  zone), batch insert, then (1) `row` paths and `dup` rows of imported trades without exits: insert with
  `source 'import'`, `notes = platform:id`, `market_type = acc.market`, **`pnl_basis 'file'`**, no `rule_version_id`;
  `on conflict (account_id, source_platform, external_id)` fills only missing fields and only `where t.source =
  'import'`; (2) new multi-row positions: one trade (first exit's ticket as key, sums, average exit price) + one file exit
  per row; (3) the row path on app trades; (4) the exits path. `unique_violation` → `concurrent_import`. A batch with no
  insert and no link is deleted. The first file needing a zone confirms the account's `file_tz`. Answer: `batch_id`,
  `inserted`, `duplicate`, `completed`, `other_account`, `linked`, `errors`, plus `trades`, `grouped`, `attached` when the
  file had partial exits.
- `import_undo(p_batch)`: deletes the batch's trades (exits, marks, images with them), removes its file exits from linked
  trades, reverts every column still as the batch left it, reopens what it closed, clears the key it set; legacy batch
  refused; un-confirms the zone when no imported wall-clock trade remains. Answer `{deleted}`.
- `import_fix_tz(p_account, p_new_tz, p_dry_run)`: re-places imported trades (and their file exits and later links) from
  `source_local_*`; only `source = 'import'` with a wall clock; rows with an offset never move.

### 2.7 Dedupe keys and «mesmo ID» (all levels)
| Level | Where | Key | Outcome |
|---|---|---|---|
| Within the file | browser `RowCollector.accept`; SQL `id_rank` | `external_id` | later lines `duplicate_in_file` (error) |
| In the account | `import_stage` `existing_id` / `exit_of`; `trades_account_ext_uq`; `trade_exits_ticket` | `(account_id, source_platform, external_id)` | `dup` → «já estavam (mesmo ID)»; imported trades get missing fields (`completable`); app trades linked earlier get the link patch |
| In another account | `import_stage` `elsewhere` | `trades.notes = platform:id` (user-wide) or file exit `(user, 'file', platform, id)` | left out, «em outra conta» |
| Same file again | `import_preview.already_imported` | `(account_id, file_sha256)` of a `done` batch | returned, **not used by any screen** |
| App trades | `import_stage` matching | match key, side, time window, size | linked («já registradas por você») |

There is no time-and-price dedupe; a row without `external_id` is `bad_id`.

### 2.8 Instruments, `pnl_basis`, `asset_type`
- `trade_caps_all()` (per market) and `instrument_specs()` (per instrument, keyed by `trade_match_key`) — app twins
  `TRADE_CAPS` / `INSTRUMENT_SPEC` (`lib/domain/registro/caps.ts`), parity tested. Per-market `asset_type`: futures
  `futures`, binary `binary_option`, forex `forex`, stocks `stock`, options `option`, crypto `crypto`, b3 `b3`; the B3
  futures rows override it (`WIN`, `IND`, `WDO`, `DOL`, `DI1` → `futures`). `pnl` mode: futures typed except
  ES/MES/NQ/MNQ/GC/MGC/CL/MCL (prices); forex typed except EURUSD/GBPUSD/AUDUSD/NZDUSD (prices, mult 100 000) and seven
  USD-base pairs (`prices_div_exit`, stored as `estimate`); stocks prices (mult 1); options prices ×100 (only with a
  contract; an adjusted multiplier → typed); crypto prices only for pairs quoted in USDT/USDC/USD; b3 typed except
  WIN/IND/WDO/DOL and 56 stocks/ETFs (prices), DI1 typed. `trade_match_key`: futures drop a contract month+year
  (MESZ6 → MES), B3 only for its futures roots (WINZ26 → WIN) and a fractional «F» (PETR4F → PETR4), everything
  upper-cased letters and digits (EUR/USD → EURUSD, BTC/USDT → BTCUSDT).
- **The import uses only `trade_match_key` (for linking).** It never calls `trade_instrument` or `trade_pnl`: `asset_type`
  comes from the row (checked per platform), `pnl` comes from the row, `pnl_basis` is hard-coded `'file'`.

### 2.9 Commission and costs
`ImportRow.commission`: unsigned money or null (null = unknown). Ebinex writes `'0.00'` (a known zero); Top One writes
`Commissions` (a positive cost; `PnL` is gross). `trades.pnl` is gross everywhere; the daily limit counts net
(`pnl − commission` when known, Phase 2 decision). The link path writes the file's commission on app trades; multi-row
positions sum the rows' commissions (null if none known). «Registrar operação» in the new markets types «Custos ·
opcional» into the same `commission` column (`trade_caps.costs: true` for forex, stocks, options, crypto, b3). The
preview's commission line («O arquivo traz comissões: mostramos o resultado líquido.», `copy.ts`) shows only when the
notice `commission_in_file` is present, or (fallback) for Top One files (`passos.tsx:910`).

### 2.10 Time zone
Per account: `file_tz` (a guess until `tz_applied_at` is set) and the day clock (`day_tz`, `day_start_min`, fixed by
market at creation). `import_tz_status`: `invalid_tz`; `tz_mismatch` (confirmed and different); `tz_not_confirmed`
(unconfirmed, different, and the account already has imported wall-clock trades) → the sheet's `conf` dry run; else `ok`.

---

## 3. The screens

### 3.1 Entry points (all gated on `MARKET_SPEC[m].reader`)
| Where | Gate |
|---|---|
| Diário header «Importar arquivo» / `?importar=1` (`DiarioCabecalho.tsx:68`) | opens on the current account only when its market has a reader; else «Escolha o arquivo» with no account |
| Suas contas row «Importar» (`SuasContas.tsx:217, 256, 293`) and the group note `CONTAS.semLeitor` «Ainda não lemos arquivos {de X}: as operações entram pelo “Registrar operação”.» (`copy.ts:134`) | reader only; «Importações» shown when reader or the account has imported trades |
| Editar conta «Fuso do arquivo» (`EditarConta.tsx:46`) | reader only |
| `i1` note `PASSO_I1.semLeitor` «Ainda não lemos arquivos {de X}: as operações desta conta entram pelo “Registrar operação”.» (`copy.ts:404`, `passos.tsx:498`) | non-reader markets |
| `fimConta` (`ImportSheet.tsx:960`): «Nada ainda. Registre a primeira operação.» + `FIM_CONTA.semLeitorArquivo` «Ainda não lemos arquivos {de X}. Depois vem a importação de CSV em que você diz o que é cada coluna.» (MT4/MT5: «O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.») (`copy.ts:676–681`) | non-reader markets: no «Importar histórico» |
| `fileTarget()` (`ImportSheet.tsx:306–309`) | the account in context is a file's destination only when its market has a reader |

`ImportSheetProvider` holds one sheet at a time (import or Registrar), inert page behind, focus return.

### 3.2 Steps (`flow.ts` `Passo`)
| Key | Heading / content (pt-BR, `components/hub/contas/copy.ts`) | When |
|---|---|---|
| `solte` | «Importar histórico de {conta}» / «Escolha o arquivo» / «Escolha outro arquivo»; «Solte para importar», «CSV» (ADAPTED from «CSV, Excel ou HTML»), «Escolher arquivo», «Lendo o arquivo…» | start of «Importar arquivo» |
| `erro` | «Não conseguimos ler o arquivo.» + «Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.» (`copy.ts:320`) / «Faltam colunas: {…}.» / «O cabeçalho tem colunas repetidas.» / quotes / size / rows; or «O arquivo não tem operações.»; primary «Escolher outro arquivo» | `parsedOf(result)` is null (`ImportSheet.tsx:385–389`) |
| `a` | «Para qual conta?», accounts **of the file's market only**, «+ Nova conta de futuros» / «+ Nova conta de binárias» (`PASSO_A.newAccount(market: ImportMarket)`), «{conta} já recebeu este formato.» | no account in context |
| `g` | «Este arquivo é de binárias (Ebinex).» / «Este arquivo é de futuros (Top One).», «Importar em {conta}», «Criar conta de …» | file of another market than the account in context |
| `i1`, `i2`, `b` | «Qual mercado?», «Onde você opera?», «Nova conta de …» (with the rules block) | «+ Adicionar conta», or «+ Nova conta» from `a`/`g` |
| `c` | «Em que fuso estão os horários deste arquivo?», «No arquivo: entradas {span}, sem fuso.», options Nova York (ET) · Brasília · UTC · Outro (Chicago, Londres), strips on `REFERENCE_TZ[market]` (futures NY, binary SP), «pregão regular 09:30–16:00 ET» band for futures only; primary «Continuar» / «Confirmar fuso» | `needsZoneStep`: some row has no offset and the account's zone is not confirmed |
| `conf` | «Confirmar fuso: {zona}», «Antes de importar, confirme o fuso das operações que já estão em {conta}.», the dry-run line, «Vale também para os próximos arquivos desta conta.» | `tz_status = 'tz_not_confirmed'`, or from `f` |
| `d` | «Prévia», counts and lines (§3.4) | preview not empty |
| `f` | «Nada novo: as {n} operações já estão em {conta}.», zone known/pending, «Confirmar fuso» | `new`, `completable`, `other_account`, `linked`, `attached` all 0 (`ImportSheet.tsx:347–349`) |
| `fim`, `fimFuso`, `fimConta` | «Importação feita» + lines; toast «{n} operações em {conta}.» + «Desfazer» | end screens |

`stepIndicator`: COUNTED `a, b, i1, i2, c, conf, d`; BREAKS `solte, erro, f, g, fim*` (`flow.ts:28–31`). There is **no**
«Lembrar para os próximos arquivos desta conta» control: the zone is always the account's («Fuso do arquivo: {zona} ·
lembrado para {conta}» / «… lembrado de {conta}», `copy.ts:551–552`).

### 3.3 Flow logic (where decisions are made)
- `onFile` (`ImportSheet.tsx:374–402`): read → `parsedOf` null → `erro`; account in context of the file's market →
  `afterAccount`; of another market → `g`; none → `a`, preselecting the account that already received this platform
  (`useImportFormats`) or the first of the market, else «nova».
- `afterAccount` (`360`): `needsZoneStep` → `c` (preselect `zoneKeyOf(fileTzHint)`), else `runPreview` with the account's
  `file_tz`.
- `runPreview` (`325–358`): `buildImportArgs` → `importPreview(previewArgs)`; `tz_not_confirmed` → dry run →
  `conf`; other non-ok → error; empty → `f`; else `d`.
- `commit` (`539`): nothing to write (all in other accounts) → close, or «Nada importado: as operações ficaram em outra
  conta.» for a new account; else `importCommit(buildImportArgs(...))` with the zone the preview used → `fim`.
- `undo` (`569`): `importUndo(batch)` → back to `d` with «Importação desfeita: nada ficou em {conta}.» and a fresh preview.

### 3.4 Preview lines and primary label (`passos.tsx:863–981`, `copy.ts:510–563`)
Count row: «{n} linhas · {n} novas · {n} já registradas por você · {n} em outra conta · {n} já estavam (mesmo ID) · {n}
com erro» («já estavam» without «(mesmo ID)» when the count is 0; the linked and other-account parts only when > 0). Lines: «{n} operações já estão em outra conta: ficam onde estão.»; «{n} que já estavam ganham os campos que
faltavam (comissão, stop, alvo, saída ou payout).»; «{n} já registradas por você: o arquivo completa a comissão.»; «{n}
com preço ou resultado diferente: vale o do arquivo.»; «{n} saídas parciais juntadas às suas operações.»; «{n} saídas a
mais de operações que já estavam.»; notices («Os horários já trazem o fuso ({lista}).», «Perdas com valor positivo:
gravamos como negativas ({n}).», «Estornadas entram com resultado zero ({n}).»); «{n} linhas com erro foram puladas.» +
«Ver linhas» + «Linha {n}: {motivo}» (`rowErrorReason`, «número inválido em {coluna}» with our column name); the
commission line + ⓘ «Bruto {x} · comissões {y}.»; «As colunas SL e TP vêm vazias: stop e alvo ficam em branco.»;
`dayChanges` «… em outro dia que o do arquivo: o dia de Futuros vira às 18:00 de Nova York.» / «… o dia de binárias
vira à meia-noite de Brasília.» (two markets only, `copy.ts:547`); «Antes de {d} (início das regras): {n} vão para
Histórico importado · só resultado.»; the zone line. Primary: «Importar {n} operações» (`trades_new ?? new`), else
«Completar {n} operações», else «Juntar {n} saídas», else «Concluir». The file card counts «{n} linhas» instead of «{n}
operações» when the file has partial exits (`arquivoComParciais`, the database's position key, `ImportSheet.tsx:167`).

### 3.5 End and Importações
`fim`: «{n} operações em Histórico importado · só resultado, à parte do Diário.» or the rules split
(`linhaImportadas`), «{n} que já estavam ganharam os campos que faltavam.», «{n} já registradas por você foram
completadas.», «{n} saídas parciais foram juntadas às suas operações.», «{n} saídas a mais entraram em operações que já
estavam.», «Desfazer depois: Personalizar › Suas contas › Importações.». Toast via `toastDoLote`. Importações
(`Importacoes.tsx`): per batch «{data} · {arquivo}» and «{n} novas · {n} já registradas por você · {n} já estavam · {n}
completadas · {n} em outra conta · {n} com erro»; the batch's `platform` is not shown.

### 3.6 Copy and types tied to the two formats
`ImportMarket` types `PASSO_A.newAccount`, `PASSO_D.dayChanges`, `PASSO_G.title/create`, `REFERENCE_TZ`, `PassoFuso`
(`futures` → ET caps and session band, anything else → Brasília captions and «Binárias abrem 24 h: sem faixa de
pregão.»), `PassoConta`. `ARQUIVO.format` has four variants («CSV da Ebinex», «CSV da Ebinex, formato antigo», «Top One
Futures · Trade History»). `emptyFileSummary` and `fileSummary` branch on `topone`. `firmOfFile('topone')` →
«Top One Futures». `PLATFORM_MARKET`, `PLATFORM_FILE_TZ_HINT`. Step `b` read-only row «Arquivo · Trade History» /
«Ebinex · arquivo CSV».

---

## 4. Tests that pin the path (3b must keep them green and extend them)

| Test | Pins |
|---|---|
| `__tests__/domain/import/{csv,decimal,clock,detect,ebinex,topone,preview,rpc,fixtures,parity}.test.ts` + 13 invented fixtures | every reader rule; `rpc.test.ts` checks that rows pass the server's own patterns (`import_checked_rows`, `import_clean_errors`) and that only `IMPORT_ROW_KEYS` travel; `parity.test.ts` new vs legacy readers |
| `__tests__/domain/boundary.test.ts` | `lib/domain` imports neither `lib/hub`, Supabase, React nor the legacy readers |
| `__tests__/domain/markets.test.ts` | `MARKET_SPEC` = the newest migration's `market_caps_all()` (a new capability flag fits this pattern) |
| `__tests__/domain/registro/{caps,cases}.test.ts`, `__tests__/domain/cases3c.test.ts` (+ `cases3c.json`) | `TRADE_CAPS`/`INSTRUMENT_SPEC` = SQL; `assignImportLinks` (TS) = `import_stage` (SQL) on SQL-computed cases |
| `__tests__/components/hub/ImportSheet.test.tsx` (3013 lines) | every step, counts and line above, including D29 and 3c keys, the 2b «sem leitor» gates (`'«Importar» with a Forex account in context opens as «Escolha o arquivo»…'`) |
| `__tests__/lib/hubContasDb.test.ts`, `DiarioCabecalho.test.tsx`, `SuasContas.test.tsx` | RPC wrappers and errors; entry points |
| `supabase/tests/20_phase1`, `50_phase3`, `60_import_counts`, `81_parciais` (`tests.imp81`: preview counts = commit counts, key by key) | the SQL classification, links, groups, undo in any order, zone guard |
| `__tests__/api/routesRequireAuth.test.ts` | unaffected unless 3b adds a route handler (none needed) |

DB test files in use: `00, 10, 20, 30, 40, 50, 60, 70, 80, 81` — the next free number after the last is `90`.

---

## 5. `importacao_colunas.md`, section by section

### Header and sources
- **STALE**: "Repo at `4187a8c` (= main)" and the migration list end at `20261019000001`. As built: `3f439f8`, migrations
  through `20261023000003` (§2 table). The board is now `fase3b/quadro/atual/project/ImportarConta.dc.html`; scenario 8's
  line numbers re-checked and **unchanged** (markup `mapa` 490–502, `conferir` 504–514; logic 1047–1081; `fimModelo`
  1117–1118; footer 1149–1150; the copy-group info at 429; scenario 6 `h` 407–424, `grupo` 426ff.).

### §0 Summary
| Point | Status |
|---|---|
| 1 (three steps, then Phase 1 flow) | still right |
| 2 (one row = one closed trade; first-named exports are execution lists) | still right; refine: since 3c the pipeline reads "one row = one closed exit", rows sharing symbol, side, entry instant and entry price being one position. A closed-position export with partial closes as separate rows already imports as one trade |
| 3 (board sample is net; `trades.pnl` gross) | still right (gross everywhere, net only for the limit) |
| 4 ("small, additive database change") | **STALE in size**: besides `import_check_platform`, the batch check and `import_checked_rows`, `import_stage`'s `elsewhere` (built on `notes`) and the hard-coded `pnl_basis 'file'` are now in the way (§7) |
| 5 (templates table) | still right (nothing built) |
| 6 (live trade then file is a duplicate; Q1) | **STALE / DELIVERED** differently (§2.5) |
| 7 (cut and estimates) | **STALE**: the P&L module and the zone guard are delivered; the DB file number is taken |

### §1 What the board draws
- §1.1–1.4 still right. Note the board's `D.campos` also flags «Resultado», «Preço de entrada», «Preço de saída»
  `req: true` (data only; the rule is the `reqs` array at l.1052–1053: Entrada, Ativo, Lado, Quantidade, and «Resultado
  (ou os preços)»). The board's `fmt` hard-codes «US$» and «contrato(s)» (l.1067–1073).
- §1.5 mostly right; **STALE**: «Lembrar para os próximos arquivos desta conta» does not exist as a control; the as-built
  `d` also has the D29 and 3c lines and labels (§3.4).
- §1.6 **STALE** for the Phase 3 strings (all ADAPTED in 3-4/D36, see §3.1): «… na Fase 3.» and «… que chega na Fase 3.»
  are gone. Still right: «CSV» ADAPTED, `ERRO.unknownFormat`, l.429 «Mesmo ID, ou mesma hora e preço, é reimportação,
  nunca cópia.», scenario 6 `h`/`grupo` not built.
- §1.7 still right.
- Not in the scoping, on the current board: step `i3` «Como as operações chegam?» («Enviar arquivo» · «Registrar à mão» ·
  «Conectar · Em breve», and «Como exportar» per platform, e.g. Tradovate «Account reports › aba Orders › Download Report.
  Não use o Performance.csv.»; board l.466–480, 1024–1034), drawn only for futures/binary "Adicionar conta". **Not built**
  (as-built `i1 → i2 → b`); no decision about it was found in the files read (Q6 below).

### §2 What exists today — **STALE** (the as-built list is §1–§3 of this file). Specifically:
- RPCs: now `import_stage`, `import_link_patch`, `import_exits_link`, `import_col_equal` internally; new keys `linked`,
  `linked_differs`, `trades_new`, `grouped`, `attached` (preview) and `linked`, `trades`, `grouped`, `attached` (commit);
  `rows_linked`; the advisory lock; a batch that only linked is kept.
- "fills only missing fields": now only `where t.source = 'import'`; app trades take the link path.
- `elsewhere` also checks file exits in other accounts; `notes` is also written on app trades by a link.
- `import_undo`: also reverts links and file exits; `import_fix_tz` / `import_tz_status`: `source = 'import'` only.
- Still right: comma-only `readCsv`, point-decimal `parseNum`, the two date formats, the hard-coded checks, `h`/`grupo`
  not built, templates/sniffing/mapping/synthetic keys/Excel/HTML not built anywhere.

### §3 Proposed product flow
- §3.1 still right. Supporting fact (NEW): a Top One file mapped as a template would get `source_platform` ≠ `'topone'`
  and none of its tickets would dedupe with the reader's imports (keys are per platform), so known formats with
  `missing_columns`/`duplicate_columns` must stay `erro` (Q2).
- §3.2 still right as a proposal (`mapping` capability); as built, `reader` gates six places (§3.1) and SQL has no
  capability check at all for imports (only `import_check_platform`).
- §3.3 still right; `a` is same-market only and typed on `ImportMarket` (as the scoping said).
- §3.4 right, except **STALE** the coverage note «Sem coluna de resultado, calculamos pelos preços só para ações, opções,
  cripto e os contratos conhecidos.»: as built, prices give the result for the 8 futures roots, the 4 forex majors
  (exact) and 7 USD-base pairs (estimate), all US stocks, options only with a contract, crypto only for USDT/USDC/USD
  pairs, and B3 WIN/IND/WDO/DOL plus 56 stocks/ETFs (§2.8). The per-row check is `tradeInstrument(market, symbol).pnl`.
- §3.5 right; the per-market quantity labels exist («Contratos» · «Lotes» · «Ações» · «Quantidade, em BTC» ·
  «Quantidade», `lib/hub/registrarAtivos.ts:56`), and currency via `currencyOf` / `SIMBOLO_MOEDA` / `formatMoney`.
- §3.6 right (not built).
- §3.7 right, except **STALE** «Lembrar…» (never built). The per-market day-turn sentence can be built with the delivered
  `viraODia(MARKET_SPEC[m].day)` (`components/hub/copyMercados.ts:100`), e.g. «à meia-noite de Brasília», «às 17:00 ET».
- §3.8 **STALE** for its Phase 3 half (DELIVERED, §3.1 quotes); the 3b half (drop «Ainda não lemos…» for mapping markets,
  «Importar histórico» in `fimConta`, «Importar» on rows, `ERRO.unknownFormat` for binaries only) is still to do.

### §4 Reading a mapped file
- §4.1 right (nothing built). Add: `readCsv` needs a delimiter option; the pt-BR number rules live in `lib/hub/numero.ts`
  and must be moved into (or re-implemented in) `lib/domain` because of the boundary rule; `ReadImportFileResult` keeps
  no text or records, so the mapping steps need them kept (§8.1).
- §4.2 mostly right. **STALE**: "`asset_type` from the account's market" → as built (C20) the instrument's value when
  `INSTRUMENT_SPEC` knows the root, else the market's (`tradeInstrument(...).asset_type`: WINZ26 → `futures` in a B3
  account, PETR4 → `b3`). Add: `pnl_basis` (as built always `'file'` on import); ID limits are three (browser ≤ 64, SQL
  `^\S{1,80}$`, column ≤ 200); «Stop»/«Alvo» are stored as **price levels** (a points column needs
  `lib/domain/registro/stops.ts stopLevel`); a row without `pnl` is refused (`bad_number`), so an open position cannot be
  imported.
- §4.3, §4.4 right.
- §4.5 right; the types to widen are listed in §7.1.

### §5 Mapping onto the pipeline
- Intro: "M6c", "after Phase 3's" — naming **STALE** (the next migration follows `20261023000003`); test file: the
  synthesis C31 chose `60_mapping.test.sql`, **taken** by `60_import_counts`; next free `90_`.
- §5.1 right in substance. Add as-built facts: `trade_exits.source_platform` takes `p_platform` too (multi-row positions);
  the batch check, `import_check_platform` and the `import_checked_rows` branch are the three places (§2.3).
- §5.2 right as a goal, **STALE** as a cost: `import_stage.elsewhere` (trades by `notes`, file exits by ticket) and
  `import_link_patch`/`import_exits_link` (`notes` on app trades) all assume the `platform:id` key; no index
  `(user_id, source_platform, external_id)` exists (only the per-account unique one).
- §5.3 **STALE / DELIVERED**: the `source = 'import'` guard is in `20261020000004` (`import_tz_status`) and
  `20261023000003` (`import_fix_tz`); undo also restores links.
- §5.4 right as a proposal; interplay to add: each row of a multi-row position needs its own key (file exits are unique
  per ticket), and a linked app trade takes the first row's key (`set_key`).
- §5.5 right; the parity test reads the newest `market_caps_all()` (`20261023000001`), so a new flag fits.
- §5.6 right (lines exist). **STALE** expectation in §8.1: imported trades keep `rule_version_id` null (`import_commit`
  never sets it); judging is by the version in force at read time.

### §6 Saved mappings — right (nothing built). Templates via PostgREST with RLS leave `routesRequireAuth` unchanged.

### §7 Which exports first — right (facts unchanged; no new-market file in `docs/csv`).

### §8 Shared with Phase 3
- §8.1 **STALE** in parts: `registered_at` forced on every insert (DELIVERED); `rule_version_id` not set on imports;
  `pnl` for futures is `INSTRUMENT_SPEC`-driven (DELIVERED); commission is also typed at the exit («Custos · opcional») in
  the new markets.
- §8.2 **DELIVERED** in another place: `TRADE_CAPS` / `INSTRUMENT_SPEC` (not `MARKET_SPEC`), with per-instrument
  `asset_type`; labels in `lib/hub/registrarAtivos.ts`.
- §8.3 **STALE / DELIVERED** with other rules: window −2/+16 min (live) or ±16 (reconstructed), any size (same size
  first), one-to-one, the file wins on money (prices, quantity, stake, payout, pnl, result, commission), an open trade
  is closed by the file, undo restores; preview «{n} já registradas por você: o arquivo completa a comissão.» and «{n}
  com preço ou resultado diferente: vale o do arquivo.».
- §8.4 **STALE / DELIVERED**: `pnlFromPrices(spec, sgn, quantity, entryPrice, exitPrice)` (`lib/domain/registro/pnl.ts`)
  with `spec = tradeInstrument(market, symbol, option)`; SQL twin `trade_pnl`; forex majors are computed, not null.

### §9 Scope and PRs
- §9.1–9.2 still right in content. §9.3 **STALE**: 3b-2 no longer writes `pnlFromPrices`; 3b-1 no longer adds the zone
  guard but must touch `import_stage` (cross-account key) and the `pnl_basis` write; DB test number `90_`.

### §10 Tests — right; add: keep `tests.imp81` (preview = commit) and run it on mapped rows; extend `cases3c.json` only if
`import_stage` changes; keep `rpc.test.ts`'s "rows pass the server's patterns" for mapped rows.

### §11 Risks — right, except "Duplicates between live and imported trades" (resolved by Phase 3). New risk: a template
over a built-in format duplicates trades across `source_platform` values (§5 §3.1).

### Open questions Q1–Q11
Q1 decided (sintese §8, C12–C16) and built (§2.5). Q2–Q8, Q10, Q11 still open as written. Q9's option (a) wording is
**STALE** («Forex exige coluna de resultado»): as built, the forex majors are computed.

---

## 6. What Phase 3 / 3c delivered that 3b can reuse

| Need | Delivered piece |
|---|---|
| Result from prices («Resultado (ou os preços)») | `tradeInstrument`, `pnlFromPrices`, `resultOf` (`lib/domain/registro`); SQL `trade_instrument`, `trade_pnl` |
| `asset_type` per row | `tradeInstrument(market, symbol).asset_type` (C20) |
| Symbol normalisation | `tradeMatchKey` (TS) = `trade_match_key` (SQL) |
| Stop/target in points → levels | `lib/domain/registro/stops.ts` (`stopLevel`, `stopLevels`) |
| Exact decimals with Postgres rounding | `lib/domain/registro/numeric.ts`; `lib/domain/import/decimal.ts` |
| pt-BR numbers | `lib/hub/numero.ts lerNumero` (rules to move into `lib/domain`) |
| Live trade + later file | `import_stage` / `import_link_patch` / `import_exits_link` / `trade_import_links`, D30 `trade_similar` |
| Partial exits in several rows | 3c grouping in `import_stage`; `assignImportLinks` TS twin for previews |
| Preview = commit | `import_preview` runs the commit's functions dry |
| Undo in any order | `import_undo` (3c) |
| Zone guard | `import_tz_status`, `import_fix_tz` on `source = 'import'` only |
| Per-market words | `MERCADO[m]` (`.de`, `.nome`), `viraODia`, `currencyOf`, `SIMBOLO_MOEDA`, `formatMoney`, quantity labels in `registrarAtivos` |
| Rules split of imported rows | `linhaAntesDasRegras`, `linhaImportadas` |
| Market descriptor + parity | `MARKET_SPEC` / `market_caps_all()` / `markets.test.ts` |

---

## 7. Two-format assumptions to widen (inventory)

### 7.1 TypeScript
`types.ts`: `Platform = 'ebinex' | 'topone'`; `ImportMarket`; `FileVariant`; `ImportRow.asset_type: 'binary_option' |
'futures'`; `CanonicalColumn = EbinexColumn | TopOneColumn`; `PLATFORM_MARKET`; `PLATFORM_FILE_TZ_HINT`.
`detect.ts` `Detection`. `parseFile.ts` variant logic. `rpc.ts` `ImportPreviewArgs.p_platform: Platform`.
`lib/hub/contas.ts` `REFERENCE_TZ: Record<ImportMarket, string>`. `flow.ts` `fileSummary`, `emptyFileSummary`.
`copy.ts` `ARQUIVO.format`, `PASSO_A.newAccount`, `PASSO_D.dayChanges`, `PASSO_G`. `passos.tsx` `PassoFuso`
(`futures` vs the rest), `PassoConta(market: ImportMarket)`, the Top One commission fallback (`:910`).
`lib/hub/mesas.ts firmOfFile(platform: Platform)`. `MARKET_SPEC[m].reader` in `ImportSheet.tsx:308, 747, 960`,
`passos.tsx:498`, `DiarioCabecalho.tsx:68`, `SuasContas.tsx:217`, `EditarConta.tsx:46`.

### 7.2 SQL
`import_batches.platform` check; `import_check_platform`; `import_checked_rows` direction/asset-type branch (no branch =
no check for an unknown platform); `import_stage.elsewhere` via `notes`; `import_commit` `notes =
platform:id` and `pnl_basis 'file'`; `import_link_patch` / `import_exits_link` `notes` on app trades.

---

## 8. The seams: where a mapped file enters

### 8.1 Browser
1. **Read**: `readImportFile(file: Blob): Promise<ReadImportFileResult>` → `parseImportText(text): ParseOutcome`. On
   `detectPlatform(header) → {platform: null, error: 'unknown_format'}` it returns `{ok: false, error:
   'unknown_format'}` and drops the text. A mapped path needs either a new outcome variant carrying the decoded text (or
   `CsvRecord[]`) and the header, or a second read of the `File` the sheet still holds (`onFile(file: File)`). Records
   come from `readCsv(text, {maxRecords})` (add `delimiter`).
2. **Branch**: `ImportSheet.onFile` (`ImportSheet.tsx:385–389`):
   ```ts
   const p = parsedOf(result)
   if (!p) { move('erro', { file: result }); return }
   ```
   A file with `outcome.error === 'unknown_format'` (and only that code, §5 §3.1) is where `mapa` (or a saved template)
   would branch, after the destination account is known (the market decides fields, labels and currency).
3. **Produce a `ParsedFile`**: once mapped, a reader in `lib/domain/import` (pure) turns records into
   `PlatformParse {rows: ImportRow[], errors, warnings, notices}` using `RowCollector`, `issue`, `isValidExternalId`,
   `isValidSymbol`, `parseIsoDateTime`/new date readers, a locale-aware `parseNum`, `tradeInstrument`/`pnlFromPrices`.
   Wrap as `ReadImportFileResult {fileName, size, sha256, outcome: ParsedFile}` with `platform`, `variant`, `market`
   (the account's), `records`, `needsFileTz`, `fileTzHint`.
4. **From here nothing changes**: `afterAccount(target, file)` → `needsZoneStep(parsed, target)` → `c`/`conf` →
   `runPreview(target, tz, file)` → `buildImportArgs({accountId, platform, fileName, sha256, fileTz, outcome})` →
   `importPreview(db, previewArgs(args))` → `d`/`f` → `commit()` → `importCommit(db, args)` → `fim` → `undo()` →
   `importUndo`. The preview lines, the rules split, the strips and the card dates already work on any `ImportRow[]`.
5. **Gates to open**: `fileTarget()` and the six `reader` checks (§7.1); `stepIndicator` COUNTED/BREAKS gain the new
   steps; `PASSO_A.sameFormat` (based on `import_batches.platform`) would say «já recebeu este formato» for any mapped
   file once one exists, so it needs the template's identity.

### 8.2 Payloads (unchanged in shape)
```jsonc
// import_preview (POST /rest/v1/rpc/import_preview, user JWT)
{
  "p_account": "<uuid>",
  "p_platform": "ebinex" | "topone",          // a third value needs §8.3
  "p_sha256": "<64 lower-case hex, raw bytes>",
  "p_file_tz": "UTC" | "<Area/Location>",
  "p_rows": [ /* ImportRow, keys in IMPORT_ROW_KEYS order */ ],
  "p_errors": [ { "line": 7, "code": "bad_date" } ],
  "p_rows_total": 18                           // non-blank data records = rows + errors
}
// import_commit: the same plus "p_file_name": "<≤ 255 chars>"

// One ImportRow as the server accepts it (invented values; the board's first sample row read as a gross loss)
{ "line": 2, "external_id": "83395", "symbol": "MESZ6", "asset_type": "futures", "direction": "long",
  "local_entry": "2026-10-01T09:34:31", "local_exit": null, "utc_offset": null,
  "entry_price": "6801.00", "exit_price": "6797.25", "quantity": "2",
  "stake_amount": null, "payout_percent": null, "duration_seconds": null, "timeframe": null,
  "result": "loss", "pnl": "-37.50", "commission": "2.48", "stop_price": null, "target_price": null }
```
Server patterns per field: §2.2. Answers: `ImportPreviewResult`, `ImportCommitResult`, `FixTzResult` (`contasDb.ts:290–357`).

### 8.3 Database
1. `import_batches.platform` check (a third value, or a pattern).
2. `import_check_platform(p_account, p_platform)`: accept the mapped value per market (the scoping's `mapping` flag in
   `market_caps_all()`), keep `wrong_market` otherwise.
3. `import_checked_rows`: a branch for the mapped value (`long|short`; `asset_type` = the instrument's or the market's;
   stake/payout/duration null); the `bad_id` rule if a synthetic key is computed server-side (`external_id` null → key).
4. `import_stage`: the `elsewhere` rule for mapped rows (the `notes` key, or none); grouping and linking need no change.
5. `import_commit` step 1 and 2 inserts: `notes` (write or not) and `pnl_basis` (`'file'` today; a computed result would
   need the basis in the row or a server-side `trade_pnl`).
6. `import_link_patch` / `import_exits_link`: `notes` on app trades (same decision as 5).
7. Unchanged: `import_preview` / `import_commit` signatures and answers, `import_undo`, `import_fix_tz`,
   `import_tz_status`, `trade_import_links`, `trade_exits`, `trade_similar`, `limit_usage`, `compute_trading_day`.
8. New: the templates table (RLS own), and the capability flag in the newest `market_caps_all()` + `MARKET_SPEC`.

### 8.4 Screens
New steps between `onFile` and `afterAccount` (`mapa`, `conferir`, possibly `h` for the «Conta» column) in the `Passo`
union and `flow.ts`; per-market copy for `c`, `d` (`dayChanges`), `a` (all markets with mapping), `g`; the card line for an
unrecognised or templated file («Arquivo não reconhecido · {n} linhas» on the board, l.564 `D.arqs.desc`, NEW in code);
the end line of a saved template. `ImportSheet.tsx` is 1158 lines and `passos.tsx` 1098: new steps belong in their own
file.

---

## Open questions for the owner

(Q2–Q11 of `importacao_colunas.md` are still open and are not repeated here; these come from the as-built facts.)

**Q1 · Mesmo ID em outra conta sua, num arquivo mapeado.** Hoje, para Ebinex e Top One, uma linha cujo ID já está em
outra conta sua fica de fora («em outra conta»). Num arquivo de corretora qualquer, IDs de corretoras diferentes podem
coincidir (números curtos), e duas contas na mesma corretora podem numerar do 1.
- (a) No mapeamento, o ID só evita duplicar dentro da mesma conta; em outra conta, importa.
- (b) Como hoje: ID igual em qualquer conta sua fica de fora.
- (c) Fica de fora só se a outra conta for da mesma plataforma.
**Recomendo (a)**: evita perder operações por coincidência de número; reimportar na mesma conta continua dando 0 novas.

**Q2 · Arquivo da Top One ou da Ebinex com coluna faltando ou repetida.** Hoje: «Faltam colunas: …» ou «O cabeçalho tem
colunas repetidas.».
- (a) Continua erro; o mapeamento só abre para arquivos que não lembram nenhum formato conhecido.
- (b) Oferecer o mapeamento também nesses casos.
**Recomendo (a)**: mapeado, o mesmo Ticket da Top One não reconheceria as operações já importadas pelo leitor e
duplicaria tudo.

**Q3 · Resultado calculado pelos preços num arquivo mapeado (sem coluna de resultado).** Hoje toda operação importada é
marcada como «resultado do arquivo».
- (a) Marcar como calculado, como no Registrar (exato, ou estimado nos pares de Forex com o dólar na frente), para as
  Análises saberem de onde veio.
- (b) Marcar como «do arquivo», como hoje.
**Recomendo (a)**.

**Q4 · Saídas parciais em várias linhas num arquivo mapeado** (mesmo ativo, lado, hora e preço de entrada, uma linha por
saída).
- (a) Uma operação com várias saídas, como a Top One desde a Fase 3c (já funciona no banco, sem custo extra).
- (b) Uma operação por linha.
**Recomendo (a)**: é a regra que você aprovou na 3c.

**Q5 · Opções listadas (EUA) na 3b.** A importação de hoje não leva o contrato da opção (tipo, strike, vencimento,
multiplicador); o Registrar exige o contrato numa conta de opções.
- (a) Fora da 3b: numa conta de Ações e opções, entram ações e ETFs; linha de opção dá erro com motivo.
- (b) Entram só com coluna de resultado, sem contrato.
- (c) Mapear também Tipo, Strike e Vencimento (mais campos e revisão do quadro).
**Recomendo (a)**: você não opera opções hoje, e (c) pode vir com um arquivo real.

**Q6 · Passo «Como as operações chegam?» do quadro** («Enviar arquivo», «Registrar à mão», «Conectar · Em breve», com
«Como exportar» por plataforma), desenhado e não construído.
- (a) Fora da 3b.
- (b) Trazer na 3b só o «Como exportar» por plataforma, numa linha do passo de soltar o arquivo.
**Recomendo (a)**: a 3b já é grande; o texto por plataforma pede verificar cada corretora antes.
