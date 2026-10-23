# Phase 3b scoping spec: the column-mapping import (ImportarConta, scenario 8)

Scope of this document: what the approved board draws for an unrecognised file, how that maps onto the Phase 1 import
pipeline that is live today, what a saved mapping («modelo») is, which broker exports it must handle first, what it shares
with Phase 3's «Registrar operação» data model, and a proposed cut and PR split for a "Fase 3b". It is a scoping spec, not a
full design: screens are described to the level needed to estimate and to spot what the board does not cover.

Sources, all read for this spec (read-only; nothing in the repo was changed, the live DB was not called, no `.env` and no
`docs/csv` row was read):
- Board `mercados/quadros/project/ImportarConta.dc.html` (2b, approved 18 Oct, 14 scenarios) and the original
  `market-hub/project/ImportarConta.dc.html` (10 scenarios). **Scenario 8 is identical in both** (diffed: markup lines
  490–514 of the 2b file, logic 1047–1081, footer 1149–1150, end screen 1117–1119; the `campos`, `desc` and `infoArq` data are
  equal). Line numbers below refer to the 2b file.
- 2b boards `Personalizar.dc.html` and `Inicio.dc.html` (2b), `RegistrarOperacao.dc.html`, `DiarioHojeEnxuto.dc.html`.
- Plan `panel/v31/plano.md` (row 3) and appendix `panel/v31/apendice.md` §A (table rules), §B M3 (import RPCs) and M6a
  (trade cycle, marks, images, context), §D (tests), §E (order).
- Decisions `fase2/decisoes.md` («Operações (inclusive importadas) depois do "desde" são julgadas pela versão em vigor na
  entrada»), `mercados/decisoes.md` item 3 (new-market accounts: «Registrar operação» in Phase 3 and, right after, the
  column-mapping import), `mercados/proposta.md` D8 and §2.4 ("platform `'modelo'`", `import_templates`, de-duplication
  without an external id, 4–6 days), `mercados/impacto.md` §1.6.
- Facts `mercados/fatos_mercados.md` §1.3, §2.3, §3.3, §4.2, §5.4 (exports), §0 point 3 (MT server clock).
- Phase 1 spec `fase1/levantamento/importar.md` (§4.mapa/§4.conferir, gaps 8 and 11).
- Repo at `4187a8c` (= main): `supabase/migrations/20261017000001..3`, `20261018000002` (redefines `import_checked_rows` and
  `import_fix_tz` with `compute_trading_day`), `20261019000001_markets.sql`; `app/lib/domain/import/*`,
  `app/lib/domain/markets.ts`, `app/lib/hub/{contas,regrasConta}.ts`, `app/components/hub/importar/*`,
  `app/components/hub/contas/{copy,copyRegras}.ts`.
- Owner decisions in project memory: imports go straight in (no review queue); undoing an import also deletes that batch's
  marks.

Markers: **NEW** = not on any board; **ADAPTED** = a board string or behaviour changed (reason given). Board mock values
(«Minha plataforma», MESZ6, «18 linhas») appear only as examples.

---

## 0. Summary

1. The board draws three steps for an unrecognised file: **`mapa`** («Não reconhecemos este arquivo. Diga o que é cada
   coluna.»), **`conferir`** («Confira 3 linhas», with «Salvar como modelo») and an end card **`fimModelo`** («Colunas
   prontas»). It then says, prototype-only, that zone and preview "seguem como nos outros arquivos". Everything after the
   mapping is the Phase 1 flow (`c` zone, `d` preview, `fim`) that already exists in code.
2. The board's model is **one row = one closed trade** (entry, exit, prices, result per row). The first exports named in
   the facts file (IBKR Flex, thinkorswim, Binance, Bybit Order History, Profit order list) are, by the columns the facts
   file lists, **execution- or order-level**, not round trips. As drawn, the mapping fits closed-position exports
   (Match-Trader «Closed Positions», cTrader History, NinjaTrader trade lists, Tradovate Performance) and the board's own
   example. This is the main scoping question (Q2).
3. The board's own sample is internally consistent with a **net** result: MESZ6 bought 2 at 6.801,00, sold at 6.797,25 is
   −3,75 pt × US$ 5 × 2 = −37,50 gross; minus «Corretagem» 2,48 = «Res. Líq.» −39,98. `trades.pnl` holds **gross** (Top One
   convention, `topone.ts`), so the mapping must know whether «Resultado» already deducts the commission (Q3).
4. The Phase 1 RPCs (`import_preview`, `import_commit`, `import_undo`, `import_fix_tz`) can take mapped rows with a small,
   additive database change: a platform value **`'modelo'`**, market-based checks instead of the two hard-coded readers,
   a de-duplication key for files without an ID column («mesma hora e preço», which the board itself states), and no
   legacy `notes` key. Batches, undo, the file zone, «Confirmar fuso» and the "antes de / depois do desde" split are reused
   as they are.
5. Saved mappings are a new table **`import_templates`** (per user, matched by the file's set of header names, never by file
   name), checked after the two built-in readers and before the `mapa` step.
6. **Shared with Phase 3 (must be settled there, not in 3b):** a trade registered live and later found in an imported file
   is today a duplicate (the live row has no `external_id`). This already hits the Top One reader the day Registrar ships.
   Reconciliation belongs in Phase 3's database PR (Q1). Also shared: `asset_type` and direction per market, gross `pnl`,
   "P&L from prices" multipliers, `rule_version_id` on imported trades, `registered_at`.
7. Proposed cut: **3b-1 database, 3b-2 domain, 3b-3 screens** (round-trip files, CSV only, markets other than binaries),
   about 5–6.5 days plus a small board revision for the NEW bits; **3b-4 execution files** (pairing fills into round trips)
   only after a board and a real header sample, about +2–3 days.

---

## 1. What the board draws (scenario 8)

### 1.1 How the scenario starts, and the frame

- Prototype selector entry «8 · Arquivo não reconhecido» (`D.cenarios`). The sheet opens over the Diário background, whose
  account selector reads «Conta: Top One» with «Janela 10:00–11:00 ET» (l.230–231), from «Importar arquivo» (l.233). So the
  board's mapping runs **with an account in context, a futures account**: the preview speaks of «contratos» and «US$».
- Sheet title (`h2#t-folha`, `C.titulo`): «Importar arquivo».
- File card (`.arq`, l.258): «Arquivo não reconhecido · 18 linhas» + chip `.chip-ex` «exemplo»; info button
  `aria-label` «Como ler: arquivo» → panel `D.infoArq`: «Reconhecemos o formato pelas colunas, nunca pelo nome do arquivo.
  No protótipo, só lemos o CSV da Ebinex e o Trade History da Top One Futures. Os outros formatos aparecem como exemplo.»
  (only the first sentence is product text; Phase 1 already ships it as `ARQUIVO.info`).
- Step indicator (`.ind`, logic l.744–753): `fluxo['8'] = ['mapa', 'conferir', 'fimModelo']` (l.732); the end card is not
  counted, so the sheet shows «Passo 1 de 2» on `mapa` and «Passo 2 de 2» on `conferir`, with two dots (`.pontos i`,
  `.feito` in mint).
- Footer (`.rodape`, l.539ff.): «Voltar» on `conferir`; primary button per step (§1.2–1.4). Disabled primary uses
  `aria-disabled="true"` and a hint line `#dica-pri` tied by `aria-describedby`.

### 1.2 Step `mapa` (l.490–502, logic l.1047–1063)

- Heading `h3#t-passo` (focus target): «Não reconhecemos este arquivo. Diga o que é cada coluna.»
- A detection chip `.chip-dado`: «Separador ; · decimal vírgula», followed by `.chip-ex` «exemplo» (the example marks that
  detection is not real in the prototype).
- `.rotulo` «Obrigatórias», then chips `.req` (dashed `--text-2` border; `.req.ok` solid mint):
  «Entrada», «Ativo», «Lado», «Quantidade», «Resultado (ou os preços)»; each reads «{nome} · falta» or «{nome} ✓».
  Rule (l.1052–1055): Entrada, Ativo, Lado and Quantidade must be mapped; «Resultado» is satisfied by the Resultado column
  **or** by both «Preço de entrada» and «Preço de saída».
- `.nota`: «Opcionais: Saída, Comissão, Stop, Alvo, ID da operação (evita duplicar), Conta.»
- Duplicate warning (`.bloco.atencao`, `role="status"`, l.495): «{campo} está em mais de uma coluna.» /
  «{campo}, {campo} estão em mais de uma coluna.» (field labels from `D.campos`). «Ignorar esta coluna» never counts.
- One row per file column (`.col-linha`, grid `1fr / 1.15fr`, a single column at ≤ 420 px, l.146–150, 173):
  column name in mono bold, «ex.: {amostra}» under it (first data row's value), and a `select` with
  `aria-label` «O que é a coluna {nome}». Options: «Escolha…» (empty, the start value of every select: **the board does
  not pre-fill anything**), then `D.campos`:
  «Entrada (data e hora)», «Ativo», «Lado», «Quantidade», «Resultado», «Preço de entrada», «Preço de saída»,
  «Saída (data e hora)», «Comissão», «Stop», «Alvo», «ID da operação (evita duplicar)», «Conta», «Ignorar esta coluna».
- Board example columns (`D.desc.cols`, invented): «Data/Hora» (ex.: 01/10/2026 09:34:31), «Papel» (MESZ6), «C/V» (C),
  «Qtd» (2), «Pr. Entrada» (6.801,00), «Pr. Saída» (6.797,25), «Res. Líq.» (-39,98), «Corretagem» (2,48),
  «Nº Negócio» (83395); three data rows (`D.desc.linhas`).
- Footer: primary «Continuar», disabled until the rule holds, with the hint «Marque as colunas obrigatórias.» or, when a
  field is in two columns, «Cada campo vai em uma coluna só.» (l.1149).

### 1.3 Step `conferir` (l.504–514, logic l.1065–1081)

- Heading: «Confira 3 linhas».
- `.nota` with the field order: «Entrada · Ativo · Lado · Quantidade · Resultado», plus « (pelos preços)» when no column is
  mapped to Resultado.
- Three `.prev-linha` rows (mono, inset background), built from the first three data rows:
  - Entrada/Saída: `DD/MM/YYYY HH:MM…` → «{d} {mês abreviado}, HH:MM» (e.g. «1 out, 09:34»); other formats are shown raw;
  - Lado: «C» → «compra», «V» → «venda», anything else raw;
  - Quantidade: an integer → «{n} contrato» / «{n} contratos»;
  - Resultado: Brazilian number → «+US$ 8,26» / «−US$ 39,98» (sign as a real minus); without a Resultado column the cell
    reads «pelos preços»;
  - an unmapped field reads «—».
  Board output for its sample: «1 out, 09:34 · MESZ6 · compra · 2 contratos · −US$ 39,98» (separators are layout gaps, not
  text).
- `.bloco`: checkbox «Salvar como modelo» (**checked by default**); when checked, field «Nome do modelo» (default
  «Minha plataforma»).
- Footer: «Voltar» and primary «Usar estas colunas» (always enabled).

### 1.4 End card `fimModelo` (l.1117–1119)

- Title «Colunas prontas»; line 1: «Modelo “{nome}” salvo: os próximos arquivos com estas colunas entram direto.» (empty
  name falls back to «Minha plataforma») or, unchecked, «Colunas usadas só neste arquivo.»; line 2 (prototype only): «No
  protótipo, o fluxo para aqui: fuso e prévia seguem como nos outros arquivos.»
- Footer: «Fechar».

### 1.5 What the board leaves to "the other files"

Not drawn for scenario 8 but implied by «fuso e prévia seguem como nos outros arquivos»:
- `c` «Em que fuso estão os horários deste arquivo?» with the 24 h strips, «Outro» → «Qual fuso?» (Chicago, Londres) and
  «Lembrar para os próximos arquivos desta conta»;
- `d` «Prévia» with counts «{n} linhas · {n} novas · {n} já estavam (mesmo ID) · {n} com erro», «Ver linhas», the
  commission lines, «Antes de {d} (início das regras): {n} vão para Histórico importado · só resultado.»;
- `fim` «Importação feita», toast «{n} operações em {conta}.» with «Desfazer».
- No «Para qual conta?» (`a`) in scenario 8: the account in context is the destination.

### 1.6 Related strings on the 2b boards (they change when 3b ships)

- `i1` note for a market without a reader (l.986): «Ainda não lemos arquivos {de Forex}: as operações desta conta entram
  pelo “Registrar operação”, na Fase 3.»
- `fimConta` for a new market (l.1113–1115): «Nada ainda: as operações desta conta entram pelo “Registrar operação”, que
  chega na Fase 3.» and «Ainda não lemos arquivos {de Forex}. Depois vem a importação de CSV em que você diz o que é cada
  coluna.» (MetaTrader instead: «O relatório do MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que
  vem depois.»).
- Personalizar 2b, under a market group without a reader: «Ainda não lemos arquivos {de Forex}: as operações entram pelo
  “Registrar operação”, na Fase 3.»; such accounts have no «Importar» button (`c.temLeitor`).
- Drop zone `solte` (l.524–530): «Solte para importar», «CSV, Excel ou HTML» (Phase 1 ships «CSV», ADAPTED).
- `erro` (l.516–522): «Não conseguimos ler o arquivo.» + «Ele é CSV, Excel ou HTML?»; prototype note «No protótipo, só
  lemos o CSV da Ebinex e o Trade History da Top One.»
- Copy-group info (l.429): «Mesmo ID, ou mesma hora e preço, é reimportação, nunca cópia.» This is the board's
  de-duplication rule for files with no ID column (§5.4).
- Scenario 6 step `h` «2 contas neste arquivo» (l.409ff.): one row per account found in the file («APX-0001 · 57 op.»),
  destination select «Criar: Apex A» / «Juntar com Top One». This is what the optional «Conta» column leads to (§3.6).

### 1.7 Accessibility and layout already on the board (keep)

- Every select has its own `aria-label` naming the file column; the required chips are text (not colour only: «· falta» /
  «✓»); the duplicate warning is `role="status"`; focus moves to the step heading on each step (`ref="{{ refPasso }}"`).
- `.col-linha` turns into one column at ≤ 420 px; sample text wraps anywhere (`overflow-wrap:anywhere`).
- Targets: `.sel` and buttons follow the sheet's 44 px rules (same CSS as the other steps).

---

## 2. What exists today (Phase 1 / 2 / 2b pipeline the mapping plugs into)

- **Reading.** `readImportFile` → `decodeCsvBytes` (UTF-8 strict, then windows-1252) → `readCsv` (RFC 4180, **comma only**,
  header = first non-blank record, 5 MB, 10 000 data records) → `detectPlatform` (header names, any order; Ebinex 13
  columns, Top One 14) → reader. An unknown header returns `unknown_format`; at least half of a reader's columns returns
  `missing_columns` / `duplicate_columns`. `parseNum` accepts a point decimal only (Brazilian «6.801,00» is rejected);
  dates are `DD/MM/YYYY HH:MM:SS` or ISO with an optional offset.
- **Rows.** `ImportRow` (`types.ts`): keys are `trades` columns; times travel as the file's wall clock (`local_entry`,
  `local_exit`) plus `utc_offset` only when the file states one; amounts are exact decimal strings; issues carry a line and a
  code, never a cell value.
- **RPCs** (`20261017000003`, `import_checked_rows`/`import_fix_tz` redefined in `20261018000002`):
  - `import_preview(p_account, p_platform, p_sha256, p_file_tz, p_rows, p_errors, p_rows_total)`: counts `new`,
    `duplicate`, `completable`, `other_account`, `day_changes`, first/last day, errors, `already_imported` (same SHA-256 in a
    `done` batch), `tz_status` (`ok` / `invalid_tz` / `tz_mismatch` / `tz_not_confirmed`).
  - `import_commit(... p_file_name ...)`: one batch per call; inserts with `entry_time = local AT TIME ZONE p_file_tz` (or
    the row's own offset), `on conflict (account_id, source_platform, external_id) do update` filling only missing fields
    (commission, stop, target, exit, payout, duration); writes the legacy key `notes = platform || ':' || external_id`
    (unique per user, `trades_user_id_notes_unique`); a row whose `notes` key exists in another account is counted
    `other_account` and left there; a batch with nothing inserted is deleted; the first file that needed a zone fixes the
    account's `file_tz` and `tz_applied_at`.
  - `import_undo(p_batch)`: deletes the batch's trades, marks it `undone`, un-confirms the zone when no wall-clock trade is
    left. Phase 3 extends it (marks and images, appendix M6a).
  - `import_fix_tz(p_account, p_new_tz, p_dry_run)`: re-places every trade of the account with `source_local_entry` from the
    file's wall clock (the «Confirmar fuso» path and the `conf` step with the dry-run count).
  - Hard-coded to two readers: `import_batches.platform check in ('ebinex','topone')`, `import_check_platform` (ebinex ↔
    binary, topone ↔ futures), `import_checked_rows` (`asset_type`/`direction` per platform).
  - `trading_day` = `compute_trading_day(account, entry)` (version-aware since Phase 2).
- **Screens.** `ImportSheet.tsx` + `flow.ts` + `passos.tsx`: steps `solte, erro, a, b, i1, i2, c, conf, d, f, g, fim,
  fimFuso, fimConta`. An unknown file goes to `erro` with «Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.»
  (`ERRO.unknownFormat`, ADAPTED in Phase 1). `fileTarget()` ignores an account in context whose market has no reader
  (`MARKET_SPEC[m].reader`, mirrored in SQL `market_caps_all()` and compared by a Jest test). The "antes / depois do desde"
  split in `d` and `fim` exists (`regrasConta.linhaAntesDasRegras`, `linhaImportadas`). Steps `h` and `grupo` (scenario 6)
  were not built.
- **Not built anywhere:** templates, delimiter/decimal detection, mapping, synthetic keys, Excel/HTML.

---

## 3. Proposed product flow (3b)

### 3.1 Detection order (NEW, implied by «os próximos arquivos com estas colunas entram direto»)

1. Built-in readers (Ebinex, Top One): unchanged, always first. A file they recognise never reaches the mapping.
2. `missing_columns` / `duplicate_columns` of a built-in format: stay `erro` (a broken Ebinex file must not be "mapped"
   into a binaries account, whose fields the mapping does not have).
3. A saved template whose header set equals the file's (§6.2): skip `mapa` and `conferir`; the next step shows a chip
   «Modelo “{nome}”» with a «Mudar colunas» link back to `mapa` (both NEW).
4. Otherwise `unknown_format` → `mapa` when the destination account accepts mapped files (§3.2); `erro` when it does not.

### 3.2 Which accounts take mapped files

Recommendation (Q6): every market except binaries: `futures` (Rithmic, Tradovate, NinjaTrader exports of other prop firms),
`forex`, `stocks`, `crypto`, `b3` (`options` stays valid, never offered). Binaries need stake, payout and expiry, which
`D.campos` does not have; IQ Option has no export, Ebinex has its reader.

Implementation: a new capability **`mapping`** in `market_caps_all()` and `MARKET_SPEC` (parity test extended) instead of
reinterpreting `reader` (which keeps meaning "a dedicated reader"). Screens then use `reader || mapping` for «Importar»
in Personalizar and `fileTarget()`; `reader` alone still decides `g` («Este arquivo é de …») for recognised files.

### 3.3 Step order (ADAPTED, Q4)

The board runs `mapa → conferir → fimModelo` with the account already known. In the product:
- **Account in context** (the Diário selector, a Personalizar row, `fimConta` «Importar histórico»): as drawn,
  `mapa → conferir`, then `c` (zone, when needed) → `d` → `fim`.
- **No account in context** («Escolha o arquivo»): the market is not in the file, and `conferir` needs it (currency, quantity
  unit). Ask «Para qual conta?» (`a`) **first**, listing accounts that accept mapped files grouped by market, plus
  «+ Nova conta» → `i1 → i2 → b` (the 2b creation steps); then `mapa → conferir → c → d → fim`. ADAPTED: `a`'s options
  today are same-market only (`PASSO_A.newAccount` is typed for two markets).
- **`fimModelo` is not a stop** (ADAPTED): «Usar estas colunas» goes on to `c`/`d`. The template is saved when the import
  commits (never for an abandoned or failed import), and «Importação feita» gains the board's line «Modelo “{nome}” salvo:
  os próximos arquivos com estas colunas entram direto.» The «Colunas prontas» title is dropped. The step indicator then
  counts `mapa, conferir, c, d` as one sequence («Passo k de n», `flow.ts` COUNTED).

### 3.4 Step `mapa` in the product

As drawn (§1.2), plus:
- The detection chip shows what was really detected: «Separador {; | , | tab} · decimal {vírgula | ponto}» (no «exemplo»).
  NEW: when parsing fails for most rows, the chip becomes a control to switch the decimal mark (Q5).
- NEW (Q5): pre-fill selects from header names (synonyms table, §4.4), every pre-filled value visible and changeable; the
  board starts all at «Escolha…», which means nine selects to set on a phone.
- NEW: a value check per mapped column against the samples: a column mapped to «Entrada (data e hora)» whose values do not
  parse as dates shows «Esta coluna não parece data e hora.» under its select (and blocks «Continuar»); likewise numbers for
  prices, quantity, result, commission.
- ADAPTED per market (Q9): when prices cannot give the result for this market (forex; futures and B3 symbols outside the
  multiplier table), the chip reads «Resultado · falta» until a Resultado column is mapped, and the note under the chips
  says «Sem coluna de resultado, calculamos pelos preços só para ações, opções, cripto e os contratos conhecidos.» (NEW).
- «Conta» and «ID da operação (evita duplicar)» as drawn; «Ignorar esta coluna» and «Escolha…» both mean "not imported".

### 3.5 Step `conferir` in the product

As drawn (§1.3), plus, ADAPTED per market: quantity unit («contrato(s)» futures and B3, «ação/ações» stocks, «contrato(s)»
options, «lote(s)» forex, the number alone for crypto), currency «US$» or «R$» (B3), date format from the detected order.
NEW (Q3), shown only when both Resultado and Comissão are mapped: «O resultado do arquivo já desconta a comissão?»
«Sim» / «Não», pre-answered when prices and a known multiplier settle it, and saved in the template. Line 5 of each preview
row then shows the net result (as the board does) while `pnl` stores gross.
NEW: when the rows look like executions rather than closed trades (no exit column, same symbol alternating sides), a
`.bloco.atencao`: «Parece um arquivo de execuções (uma compra ou venda por linha). Cada linha entraria como uma operação.»
with «Voltar» as the safe choice (until 3b-4 exists).

### 3.6 «Conta» column (Q7)

When «Conta» is mapped and the file has two or more distinct values, a minimal step `h` (ADAPTED from scenario 6): one row
per value with its count («{valor} · {n} op.») and a select «Juntar com {conta}» (accounts of the same market) /
«Não importar». No «Criar» and no «Você copia operações entre elas?» (copy groups are "Para depois" in the plan). The browser
splits rows and calls `import_commit` once per destination account: one batch per account (appendix M3). One distinct value:
the column is ignored.

### 3.7 Zone, preview and end (reused, with per-market ADAPTED copy)

- `c`: same options and «Lembrar…»; the zone stays per account (`file_tz`, `tz_applied_at`). Strips drawn on the market's
  reference clock (`REFERENCE_TZ`, today typed for futures/binary only): New York for futures, forex, stocks, options;
  Brasília for crypto and B3. Session band: «pregão regular 09:30–16:00 ET» for futures/stocks/options (as today); none for
  forex and crypto («Forex abre 24 h: sem faixa de pregão.» / «Cripto abre 24 h: sem faixa de pregão.», NEW, modelled on the
  binaries legend); B3 «pregão 09:00–18:30» (NEW; derivatives grid, fatos §5.1; the US-DST grid change is unverified for
  2026). Preselected zone: from the account's platform when the facts say it (Binance, Bybit: UTC), else none.
- `d`: counts as today; «já estavam (mesmo ID)» when the ID column is mapped, «já estavam (mesma hora e preço)» (NEW) when
  not; `PASSO_D.dayChanges` today names only the futures and binaries day turns: ADAPTED from `MARKET_SPEC[m].day`
  («o dia de Forex vira às 17:00 de Nova York.», «o dia de Ações vira às 20:00 de Nova York.», «o dia de Cripto vira à
  meia-noite de Brasília.», «o dia da B3 vira à meia-noite de Brasília.»).
- `fim`, toast, «Desfazer», Importações list, `conf`/«Confirmar fuso», `fix_tz`: unchanged.
- Files whose times carry an offset (ISO `Z` / `±HH:MM`) skip `c`, as Phase 1 does for the old Ebinex format.

### 3.8 Copy that goes stale (flag for Phase 3 and 3b)

- When Phase 3 ships, «… na Fase 3.» / «… que chega na Fase 3.» (i1 note, Personalizar group note, `fimConta`) become
  wrong. ADAPTED for Phase 3: «Ainda não lemos arquivos {de Forex}: as operações desta conta entram pelo “Registrar
  operação”.» and «Nada ainda. Registre a primeira operação.» (the IQ Option wording, already approved).
- When 3b ships: drop the "ainda não lemos" notes for mapping markets; `fimConta` gets «Importar histórico» back (as for
  futures); Personalizar rows get «Importar»; `ERRO.unknownFormat` stays only for binaries.

---

## 4. Reading a mapped file (domain, browser)

New module `app/lib/domain/import/mapped/` (pure, depends on `../tempo`, `../markets`, the shared P&L module of §8.4).
Same rules as the readers: never throws on file content; issues hold a line and a code, never a value.

### 4.1 Sniffing (NEW)

- **Delimiter**: try `,` `;` and tab on the first 50 non-blank lines; choose the one with a constant cell count > 1
  (`readCsv` gains a `delimiter` option; quoting rules unchanged).
- **Header row**: the first non-blank record by default; NEW: skip leading title lines that have fewer cells than the modal
  count (common in statements). Multi-section statements (thinkorswim «Account Statement», IBKR Flex files with
  `HEADER`/`DATA` prefixes) are out of 3b (§7).
- **Decimal mark**: a numeric column whose samples match `^-?\d{1,3}(\.\d{3})*,\d+$` or `^-?\d+,\d+$` → comma; `,`-grouped
  thousands with a `.` decimal → point; `;` separator with no evidence → comma (Brazilian Excel default). `parseNum` gains a
  locale parameter.
- **Date order**: accept `DD/MM/YYYY HH:MM[:SS]`, `MM/DD/YYYY HH:MM[:SS] [AM|PM]`, two-digit years, ISO with or without
  offset, and `YYYYMMDD;HHMMSS` / `YYYYMMDD HHMMSS` (IBKR). Day/month order decided over all rows (a first part > 12 →
  day first; a second part > 12 → month first); ambiguous over the whole file → ask «Datas em dia/mês ou mês/dia?» (NEW,
  Q5) and save the answer in the template. Separate date and time columns are not on the board; out of 3b unless a first
  target needs them (none of the named ones does).
- **Encoding**: as today (UTF-8, then windows-1252). UTF-16 (Excel "Unicode text") is out.

### 4.2 Field rules (canonical field → `ImportRow`)

| Board field | `ImportRow` / `trades` | Rule |
|---|---|---|
| Entrada (data e hora) | `local_entry` (+ `utc_offset`) | required; parsed per §4.1; `missing_date` / `bad_date` |
| Ativo | `symbol` | required; trimmed, 1–40 chars; upper-cased for futures/B3 roots (not stored changed otherwise) |
| Lado | `direction` | required; vocabulary §4.3 → `long` / `short`; `bad_direction` |
| Quantidade | `quantity` | required; > 0 after the sign is taken (a signed quantity can also give the side, §4.3); ≤ 10 integer and 8 decimal digits |
| Resultado | `pnl` (gross), `result` | required unless prices give it (§8.4); stored gross = net + commission when the template says net; `result` from the gross sign (win > 0, loss < 0, breakeven 0), as Top One |
| Preço de entrada / de saída | `entry_price` / `exit_price` | optional unless used for the result |
| Saída (data e hora) | `local_exit` | optional; `bad_exit_time`, warning `exit_before_entry` |
| Comissão | `commission` | optional; stored as a positive cost (absolute value; IBKR writes it negative); null = unknown, never zero |
| Stop / Alvo | `stop_price` / `target_price` | optional |
| ID da operação | `external_id` | optional; `^\S{1,80}$`; repeated ID in the file → `duplicate_in_file` (first wins) |
| Conta | — (routing only) | optional; splits rows by value (§3.6); never stored |
| — | `asset_type` | from the account's market (§8.2) |
| — | `stake_amount`, `payout_percent`, `duration_seconds`, `timeframe` | null |

Row error codes reuse `ROW_ERROR_CODES`; NEW codes: `no_price_result` (no result column and no multiplier for that row's
market/symbol) and `bad_number` with the canonical field name in `column` (the type `CanonicalColumn` widens to the mapping
field keys). Notices reuse `commission_in_file`; NEW `result_net_converted` (rows whose net result was turned into gross).

### 4.3 Side vocabulary (NEW)

Case- and accent-insensitive: «C», «Compra», «Comprado», «Buy», «B», «Bot», «Long», «L» → long; «V», «Venda», «Vendido»,
«Sell», «S», «Sld», «Short» → short. An unknown value is a row error (`bad_direction`); NEW (Q5, optional): when 1–4
distinct unknown values cover most rows, ask once «O que quer dizer “{valor}”?» Compra / Venda and save the answer in the
template. A signed quantity column (IBKR `Quantity`) can stand for «Lado» when no side column exists (positive = long);
NEW, only in 3b-4 (it is an execution-file trait).

### 4.4 Pre-fill synonyms (NEW, Q5)

Normalised with `normalizeHeader`: Entrada ← «data/hora», «data», «abertura», «open time», «entry time», «date/time»,
«datetime», «time»; Saída ← «fechamento», «close time», «exit time»; Ativo ← «ativo», «papel», «symbol», «instrument»,
«contract», «par»; Lado ← «lado», «c/v», «side», «direction», «type», «buy/sell»; Quantidade ← «qtd», «quantidade»,
«quantity», «qty», «lots», «volume», «size»; Resultado ← «resultado», «res. liq.», «p&l», «pnl», «profit», «net p&l»,
«realized pnl», «closed p&l»; Preço de entrada ← «pr. entrada», «entry price», «open price», «avg entry»; Preço de saída ←
«pr. saida», «exit price», «close price»; Comissão ← «corretagem», «comissao», «commission», «fee», «fees»; ID ← «id»,
«nº negocio», «ticket», «trade id», «order id», «position id»; Conta ← «conta», «account». A synonym fills a select only
when exactly one column matches.

### 4.5 Output

`ParsedFile` gains `platform: 'modelo'`, `variant: 'modelo'`, `market` = the destination account's market, `needsFileTz`,
`fileTzHint` (§3.7), and the mapping used (template id or inline mapping) for the batch record. `buildImportArgs` keeps
its checks (`platform` equals the file's, SHA-256, zone name).

---

## 5. Mapping onto the Phase 1 pipeline (database)

All additive. No existing trade, batch, version or day changes (the migration ends with the same kind of proof as
`20261019000001`: counts and hashes before and after, stop otherwise). Migration name: after Phase 3's, e.g.
`<date>_import_mapping.sql` ("M6c").

### 5.1 Platform value and checks

- `import_batches.platform` check → `in ('ebinex','topone','modelo')`; new nullable `template_id uuid` and
  `template_name text` (a snapshot; a deleted template must not break the batch list).
- `trades.source_platform = 'modelo'` for mapped rows (fits `^[a-z0-9_]{1,20}$`). Alternative considered: the account's
  platform key (`ibkr`, `binance`…), which would let a future dedicated reader de-duplicate against mapped rows; rejected for
  3b because the ID column a user picks need not be the one a reader would use, and `outra`/null platforms need a fallback
  anyway. A later reader can map `'modelo'` rows of its accounts in its own migration.
- `import_check_platform`: `'modelo'` is accepted when `market_caps_all()->market->>'mapping'` is true; `wrong_market`
  otherwise. Ebinex/Top One rules unchanged.
- `import_checked_rows`: for `'modelo'`, `direction in ('long','short')`, `asset_type` = the market's asset type (§8.2),
  `stake_amount`/`payout_percent`/`duration_seconds` must be null; `external_id` may be null (§5.4). Everything else
  (number patterns, offsets, `AT TIME ZONE` only for offset-less clocks, `compute_trading_day`) unchanged.

### 5.2 Legacy `notes` key

Mapped rows **do not write `notes`** (null). Reasons: `trades_user_id_notes_unique (user_id, notes)` would make two
accounts with identical synthetic keys (copy trading) fail the whole commit with `concurrent_import`; Phase 9 drops the key
anyway; no old page reads new-market trades. Consequence: «já estão em outra conta» (`other_account`) for mapped rows is
computed from `(user_id, source_platform, external_id)` in other accounts, **only for real IDs** (an ID column was mapped);
with synthetic keys there is no cross-account check (identical time and price in two accounts is a copy, not a re-import,
when the user imports into each account). Needs an index `(user_id, source_platform, external_id)`.

### 5.3 Batches, undo, zone

Unchanged: one batch per commit and per account; `already_imported` by SHA-256; empty batches deleted; `import_undo` (with
Phase 3's cascade of marks and images: decided by the owner, "desfazer apaga as marcas do lote"); `tz_status`,
«Confirmar fuso», `conf` dry run, `import_fix_tz` from `source_local_entry`. **Guard to add (Phase 3 or 3b-1):**
`import_fix_tz` and `import_tz_status` must only consider `source = 'import'` rows, so that a live trade never moves if a
reconciliation (Q1) ever stores a file clock on it.

### 5.4 De-duplication without an ID column («mesma hora e preço»)

The board's rule (l.429): same ID, or same time and price, is a re-import. Proposal:
- With an ID column: as today, `(account_id, 'modelo', external_id)`.
- Without one: `import_checked_rows` computes `external_id = 'k:' || left(sha256 hex, 32) || ':' || n` from the **file's wall
  clock** (`local_entry`, or local + offset), upper(symbol), direction, normalised quantity and entry price, where `n` is the
  occurrence of that tuple in the file (identical trades in one file stay distinct). Computed in SQL, one place, like the
  time conversion; independent of the zone, so a zone fix never changes keys.
- In both cases the preview and commit also treat as duplicate a row whose tuple matches an existing `source='import'` trade
  of the account with a different key (an earlier import done with the other method), counted in «já estavam».
- Known limit (risk §11): two templates of different time precision (seconds vs minutes) give different tuples.

### 5.5 Templates table (§6) and capability

- `import_templates` (new, §6.1), RLS select/insert/update/delete own; no server-time facts in it, so plain PostgREST is
  enough (no RPC, no API route; `routesRequireAuth` unaffected).
- `market_caps_all()` gains `"mapping"` per market (true except binary); `MARKET_SPEC` mirrors it; the Jest parity test and
  `40_markets.test.sql` extend.

### 5.6 Judging imported trades (decision already taken)

Rows before the account's v1 «desde» go to «Histórico importado · só resultado»; rows at or after it are judged by the
version in force at entry (`fase2/decisoes.md`). The preview and end lines exist (`linhaAntesDasRegras`,
`linhaImportadas`). For new-market accounts created in 2b, v1 is the creation date, so a history file is mostly «antes».

---

## 6. Saved mappings («modelos»)

### 6.1 Data

```
import_templates (
  id uuid pk, user_id uuid not null references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),        -- «Nome do modelo»
  header_sig text not null,          -- sha256 of the sorted, normalised header names (normalizeHeader + occurrence index for repeats)
  headers jsonb not null,            -- the normalised header names, in file order (≤ 60)
  columns jsonb not null,            -- {header name → field key of D.campos}; ignored columns absent
  delimiter text not null check (delimiter in (',', ';', 'tab')),
  decimal text not null check (decimal in ('point', 'comma')),
  date_order text check (date_order in ('dmy', 'mdy')),                 -- null when unambiguous formats only
  result_is_net boolean,            -- null when Comissão is not mapped
  side_values jsonb not null default '{}',                              -- extra «O que quer dizer…» answers
  platform text,                     -- the account's platform key when saved (label default, zone hint)
  created_at timestamptz not null default now(), last_used_at timestamptz,
  unique (user_id, header_sig), unique (id, user_id)
)
```

- Per **user**, not per account: one IBKR template serves a stocks and an options account; matching is by header set.
- Stores header names and choices only, **never sample values** (the «ex.:» samples live only in the browser). Header names
  come from the user's own file and are visible only to the user (RLS).
- Default name ADAPTED: the account's platform label («Interactive Brokers», «Profit (Nelogica)») when it has one, else
  «Minha plataforma».
- Saving the same header set again updates that template (and its name); no duplicates.

### 6.2 Matching

- Exact header set (order-insensitive, normalised) → template applies; the file's columns are bound by name.
- Superset/subset (the broker added or removed a column) → NEW: open `mapa` pre-filled from the template for the columns it
  knows, with a note «Algumas colunas mudaram desde o modelo “{nome}”.»
- Built-in formats are never shadowed (§3.1).

### 6.3 Management (Q8)

Recommendation for 3b: no management screen. «Mudar colunas» (from the template chip) re-opens `mapa` and the save
overwrites. Rename/delete later, in Personalizar › Suas contas › Importações (which has no board either).

---

## 7. Which exports to handle first

From `fatos_mercados.md` (sources and verification marks there); "row grain" is read off the columns the facts list.

| Export (market) | Format and columns named in the facts | Row grain | Clock | Fits the board's mapping? |
|---|---|---|---|---|
| IBKR Flex Query (stocks, options) | CSV or XML; Symbol, AssetClass, CurrencyPrimary, TradeDate, DateTime, Quantity (signed), TradePrice, IBCommission (negative), FifoPnlRealized, Buy/Sell, TradeID; ≤ 365 days per query | execution (signed quantity, one price, realised P&L only on closing fills) | not documented in the sources | **No** as drawn (needs pairing, 3b-4); options need multiplier 100 and legs |
| thinkorswim Account Statement (stocks, options) | CSV with sections; «Account Trade History»: Exec Time, Spread, Side, Qty, Symbol, Exp, Strike, Type, Price, Order ID (Pos Effect only in Order History) | execution, inside a multi-section file | not in the sources | **No** (section picking + pairing): later, or a dedicated reader |
| Binance (crypto) | Futures: USDⓈ-M / COIN-M history export; spot: «Order History» (time, base/quote, type, price, quantity, total, fee, fee coin, ID) | order/fill | UTC | **No** as drawn; COIN-M results are in coin, not US$ (currency is fixed USD, D6) |
| Bybit (crypto) | Order History (direction, quantity, fees, entry/exec price, P&L); old «Closed P&L» with «Trade Time(UTC+0)» discontinued 11 Jul 2024; Brazilian derivatives possibly cut in May 2026 (single source) | order (P&L column present) | UTC | Partly: rows with P&L could import as result-only trades, but entries/exits are orders; low priority |
| Profit / Nelogica (B3) | «List of Orders» → «Executed» → «Export order list CSV»; columns not listed in the source | order | Brasília (assumed; unverified) | **No** as drawn; the board's own example (Data/Hora, Papel, C/V, Pr. Entrada, Pr. Saída, Res. Líq., Corretagem, Nº Negócio) is an invented round-trip report in this style |
| Match-Trader (forex) | «Closed Positions» → CSV | closed position | not in the sources | **Yes** |
| cTrader (forex) | History tab; Excel/CSV (TradesViz) or HTML (TradeZella); open/close, prices, symbol, ID, quantity, commission, swap, gross and net P&L | closed position | not in the sources | **Yes** (CSV only; swap is a NEW optional field question, folded into commission or ignored) |
| MetaTrader 4/5 (forex, crypto, B3) | HTML (and PDF for MT5); server clock GMT+2/+3 | report | broker server time, no IANA zone | **No**: needs its own reader and a "MT server (NY + 7 h)" clock; the board already says so |
| Rithmic / Tradovate / NinjaTrader (futures, other prop firms) | not in the facts file; the board's scenarios 2, 4, 6, 9 use «Arquivo Rithmic» examples, and `COMO.tradovate` says «Account reports › aba Orders › Download Report. Não use o Performance.csv.» | orders (Rithmic, Tradovate Orders) or round trips (NinjaTrader trades grid, Tradovate Performance) | varies | Round-trip ones **yes**; order ones need 3b-4 |

Reading of the table:
- As drawn, 3b imports **closed-position** files. That covers forex closed-position exports (Match-Trader, cTrader), the
  round-trip futures exports, and any broker report with one row per closed trade. It does **not** cover the five exports the
  facts file names first for stocks, options, crypto and B3, which are execution/order lists.
- Covering them needs either a pairing mode (3b-4: FIFO per symbol and account, partial closes split, scale-ins averaged,
  `external_id` = opening fill ID + closing fill ID, result = sum of realised P&L or prices × multiplier) or dedicated
  readers per broker. Both need a board (a NEW question «Cada linha do arquivo é…» «uma operação completa» / «uma execução
  (compra ou venda)») and, before writing code, the header line of a real export (headers only, never rows; repo is public).
- The owner trades futures (Top One) and binaries (Ebinex) today; his 629 trades are in those two accounts. No new-market
  file exists in `docs/csv` (file names only: three Ebinex exports and one Top One Trade History). Q10 asks which real file, if any, should drive
  the first target.

---

## 8. What 3b shares with Phase 3's «Registrar operação» data model

### 8.1 The same trade record

| Concept | Registrar (Phase 3, appendix M6a, board RegistrarOperacao) | Mapped import (3b) |
|---|---|---|
| Row in `trades` | `register_entry` / `register_exit` / `register_after` | `import_commit` |
| `source` | `'live'` (at entry), `'after'` («Depois») | `'import'` |
| `status` | `'open'` then `'closed'` | `'closed'` |
| `entry_time` / `exit_time` | server `now()` (live) | file clock + zone, or the row's offset |
| `registered_at` | forced `now()` by trigger on insert | the same trigger: the import time. This is what Padrões needs ("importação tardia com `entry_time` antigo não conta como dado posterior") |
| `rule_version_id` | the version in force, frozen | **recommend** filled by `import_commit` with the version in force at `entry_time` (null before «desde»); never back-filled on the 629 existing trades (all «Histórico importado», null is already right) |
| Symbol, direction, quantity, prices, stop, target | form fields (futures: MES/MNQ/MGC, contracts, points) | mapped columns |
| `pnl` | futures: points × multiplier (board `D.mult` MES 5, MNQ 2, MGC 10; `D.tick`); typed for markets without a table | Resultado column, or prices × multiplier |
| `commission` | unknown at entry; filled later by an import | column, positive cost |
| Marks (`trade_marks`), «limpa» | live only, before `exit_registered_at` | none (imports never get clean marks) |
| `trade_entry_context` | `origin 'live'` / `'reconstructed'` | none |
| Images, note | up to 4 images and one note | none at import; can be added later from the Diário (Phase 4) |
| `trading_day` | `compute_trading_day` | the same function |

### 8.2 Per-market vocabulary both must use (recommend one table in `MARKET_SPEC`, Phase 3)

- `asset_type` (free text column, legacy comment "futures, crypto, stock, binary_option"): one value per market —
  futures `futures`, binary `binary_option`, forex `forex`, stocks `stock`, options `option`, crypto `crypto`, b3 `b3`
  (B3 accounts hold mini-index futures and shares; no per-instrument classification). The `trades_bridge` trigger maps
  `asset_type → market_type` only for futures and binaries; with an `account_id` it is not used.
- Direction: `long`/`short` for every market but binaries (`call`/`put`); labels «compra»/«venda».
- Quantity unit and currency labels (§3.5): the same helper in Registrar's form and in `conferir`.

### 8.3 Live trade, then the same trade in a file (Q1, shared, NEW)

Today `import_commit` de-duplicates only by `(account_id, source_platform, external_id)`. A live trade has no
`external_id`, so importing the broker file afterwards inserts a second row for the same trade. This happens with the
**Top One reader** the first time the owner registers on the phone and later imports Trade History to get commissions, so it
is a Phase 3 problem, not only a 3b one. Proposal (Phase 3 database PR, reused by 3b):
- `import_preview`/`import_commit` match each new row against the account's `source in ('live','after')` trades without
  `external_id`: same symbol, direction and quantity, entry within ±2 min of the file's instant (tolerance to confirm; the
  live time is the tap, not the fill), one-to-one, nearest first;
- a match **completes** the live trade instead of inserting: `external_id`, `source_platform`, `commission`, and exit
  price/`pnl` only when missing; **never** `entry_time`, `exit_time`, `registered_at`, `exit_registered_at`,
  `rule_version_id`, `source` (M6a freezes them) and never `source_local_*` (§5.3 guard);
- the preview counts them (NEW): «{n} já registradas por você: ganham comissão e ID do arquivo.»; the batch does not own
  them, so «Desfazer» leaves them (the filled fields stay, as Phase 1's "completed" rows do).

### 8.4 P&L from prices (one module for both)

`pnlFromPrices(market, symbol, direction, quantity, entry, exit)` → gross Decimal or null. Multipliers: futures by root
(MES 5, MNQ 2, MGC 10 from the Registrar board; ES, NQ, GC and others to add from exchange specs), stocks 1, options 100,
crypto linear 1 (quantity in coin), B3 WIN R$ 0,20/pt and WDO R$ 10/pt (fatos §5.3, "conferir na especificação da B3"),
forex null (pip value needs the quote currency and a rate). Registrar uses it to show the result; 3b uses it for «pelos
preços» and to pre-answer «já desconta a comissão?».

---

## 9. Scope and PR split ("Fase 3b")

### 9.1 In

- `mapa` and `conferir` as drawn, with the ADAPTED order and end (§3.3), per-market labels, value checks.
- Sniffing: delimiter, decimal mark, date order, title lines; CSV only.
- Round-trip rows only; markets futures, forex, stocks, crypto, B3.
- Templates: save on commit, exact header-set match, «Mudar colunas», changed-columns pre-fill.
- `'modelo'` platform in the RPCs, synthetic keys, no `notes` key, real-ID cross-account check, `mapping` capability.
- Reuse of `c`, `conf`, `d`, `fim`, toast, undo, Importações, the «desde» split.
- Copy updates of §3.8; «Importar» on new-market account rows.
- Minimal `h` for the «Conta» column (if Q7 = recommended).

### 9.2 Out (later or never)

- Execution/order files and pairing (3b-4, Q2); thinkorswim/IBKR multi-section statements; dedicated broker readers.
- Excel (.xlsx) and HTML (MetaTrader); UTF-16; separate date and time columns.
- «Criar» accounts from a «Conta» value and copy groups («Você copia operações entre elas?»).
- Template management screen; sharing templates between users.
- Binaries in the mapping; COIN-M (coin-denominated) results; non-USD forex accounts (D6).

### 9.3 PRs (each into `feature/rebuild-lean`, after Phase 3 is approved)

| PR | Content | Days |
|---|---|---|
| **3b-1 · Banco** | Migration M6c: `import_templates` + RLS; `'modelo'` in `import_batches.platform`, `template_id`/`template_name`; `import_check_platform`, `import_checked_rows` market-based; synthetic key and «mesma hora e preço» duplicate; real-ID `other_account` without `notes`; index; `market_caps_all()` `mapping`; the `source='import'` guard in `import_fix_tz`/`import_tz_status` if Phase 3 did not add it; end-of-file proof (no row changed); `supabase/tests/50_mapping.test.sql`; paste kit in the 2b format | 1–1.5 |
| **3b-2 · Domínio** | `lib/domain/import/mapped/` (sniff, fields, sides, synonyms, net→gross, template signature, `ImportRow` output), `readCsv` delimiter option, `parseNum` locale, `pnlFromPrices` if Phase 3 did not land it; `MARKET_SPEC.mapping` + parity test; Jest with invented fixtures shaped like the §7 "yes" rows and the board sample | 1.5–2 |
| **3b-3 · Telas** | `PassoMapa`, `PassoConferir`, template chip, flow changes (`flow.ts` steps, `fileTarget`, `a` for all markets, minimal `h`), per-market `c`/`d` copy, Personalizar «Importar», copy of §3.8; tests; 375 / 768 / desktop, both themes, 44 px, keyboard | 2–2.5 |
| Board revision (before 3b-3) | NEW bits of §3.4–3.6 and §6.2 on the ImportarConta board (canvas), for approval | 0.5–1 |
| **3b-4 · Execuções** (optional) | After its own board and a real header: «uma execução por linha», FIFO pairing, signed quantity as side, partial closes | 2–3 |

Total without 3b-4: about 5–7 days (the 2b proposal estimated 4–6 for the drawn screens; the difference is sniffing,
per-market labels and the NEW checks). Reconciliation (§8.3) is counted in Phase 3 (about 1–1.5 days there).

### 9.4 Owner test (proposal, pt-BR, for the plan table)

«Numa conta de Forex (ou Ações), importar um CSV inventado de outra corretora dizendo o que é cada coluna. Reimportar o
mesmo arquivo: 0 novas. Um segundo arquivo com as mesmas colunas entra direto pelo modelo. Desfazer o lote.»

---

## 10. Tests (appendix §D style)

**Unit (Jest, invented data only)**
- Sniff: `,` `;` tab; decimal comma vs point vs grouped thousands; title lines skipped; date order decided, ambiguous
  flagged; ISO with `Z` and `±HH:MM` keeps the offset; AM/PM; two-digit years; IBKR `YYYYMMDD;HHMMSS`.
- Mapping rules: the five required chips, «Resultado (ou os preços)» satisfied by both prices, duplicates (ignoring
  «Ignorar»), per-market result requirement.
- The board's sample reproduces the board's strings: «1 out, 09:34», «compra», «2 contratos», «−US$ 39,98»; net → gross
  gives −37,50 / +9,50 / +27,50 with commissions 2,48 / 1,24 / 1,24.
- Sides vocabulary; unknown side → `bad_direction`; no cell value in any issue or exception message.
- `pnlFromPrices` per market (null for forex and unknown roots).
- Template signature: order-insensitive, accent/case-insensitive, repeated header names; superset/subset detection.
- `ImportRow` output has exactly `IMPORT_ROW_KEYS`.

**Database (`supabase/tests`, PG17 in CI, two users)**
- `'modelo'` accepted for futures/forex/stocks/crypto/B3, refused for binary (`wrong_market`) and for an archived account.
- Direction/asset type per market; stake/payout refused for `'modelo'`.
- Real ID: re-import → 0 inserted; same ID in another account → `other_account`, left there.
- No ID: synthetic key stable across the same file twice, a reordered file and a longer export; identical rows in one file
  both kept; «mesma hora e preço» against an earlier import with real IDs.
- `notes` stays null for mapped rows; legacy readers unchanged (golden: an Ebinex and a Top One commit give the same rows
  as before).
- Templates RLS: A cannot read, update or delete B's; unique header signature per user.
- Undo of a mapped batch; zone confirm/fix on a mapped account; `import_fix_tz` never touches `source <> 'import'`.
- Migration proof: no trade, batch, version or account row changed; `market_caps_all()` parity.

**Screens (Testing Library)**
- `mapa`: chips update, `role=status` warning, disabled «Continuar» with the right hint, value-check errors, focus on the
  heading; `conferir`: three rows, «pelos preços», net question only with Comissão mapped; template chip skips both steps;
  «Mudar colunas»; minimal `h`.
- No new API route (templates via PostgREST with RLS), so `routesRequireAuth.test.ts` is unchanged.

---

## 11. Risks

- **A wrong mapping imports wrong data silently** (e.g. a % column as Resultado). Mitigations: value checks, `conferir`,
  the net/gross check against prices where a multiplier is known, the preview totals, and «Desfazer».
- **Execution files mapped as trades** (every fill becomes a "trade", results wrong). Mitigation: the «Parece um arquivo de
  execuções» warning (§3.5) until 3b-4.
- **Duplicates between live and imported trades** (§8.3): affects Phase 3 already.
- **Synthetic keys drift** when a broker changes time precision or column set; the «mesma hora e preço» cross-check covers
  the common case only.
- **Zone**: unknown clocks for IBKR and thinkorswim; MetaTrader's server clock has no IANA zone. The strips and «Confirmar
  fuso» + `import_fix_tz` remain the safety net (per account).
- **Currency**: COIN-M results and non-USD forex accounts would be stored as US$. 3b refuses neither automatically; the
  `conferir` currency label makes it visible. A NEW warning is possible later.
- **Public repo**: fixtures invented; real exports never committed; header samples from the owner reported as headers only.

---

## Open questions for the owner

**Q1 · Operação registrada ao vivo e depois o arquivo da corretora (vale já para a Top One na Fase 3).**
Hoje o arquivo importado depois cria uma segunda operação igual à registrada.
- (a) Na importação, reconhecer a operação já registrada (mesmo ativo, lado e quantidade, entrada até 2 min de diferença) e
  só completar comissão e ID; horários do registro nunca mudam. A prévia diz «{n} já registradas por você…».
- (b) Mostrar as prováveis duplicadas na prévia e você escolhe «Pular» ou «Importar todas».
- (c) Não tratar: você desfaz o lote se duplicar.
**Recomendo (a)**, na PR de banco da Fase 3 (cerca de 1–1,5 dia), e a 3b reaproveita.

**Q2 · Arquivos com uma linha por execução (compra ou venda), como IBKR, thinkorswim, Binance e Profit.**
O quadro mapeia uma operação completa por linha.
- (a) 3b só com uma operação por linha (como desenhado); execuções numa 3b-4, com quadro próprio, quando houver um arquivo
  real.
- (b) Incluir já na 3b o modo «uma execução por linha», que junta compras e vendas em operações (+2–3 dias e um quadro).
- (c) Leitores próprios por corretora (IBKR, thinkorswim…) em vez do modo genérico.
**Recomendo (a)**: hoje você não opera esses mercados, e o modo de execuções precisa de um cabeçalho real para não errar.

**Q3 · «Resultado» já descontando a comissão.** O exemplo do quadro traz «Res. Líq.» e «Corretagem».
- (a) Perguntar «O resultado do arquivo já desconta a comissão?» só quando as duas colunas estão marcadas, já respondido
  quando os preços permitem conferir, e guardar no modelo.
- (b) Supor sempre líquido quando há coluna de comissão.
- (c) Supor sempre bruto.
**Recomendo (a)**; o app guarda o bruto e mostra o líquido, como na Top One.

**Q4 · Ordem dos passos e o fim «Colunas prontas».**
- (a) Como o quadro: mapear, conferir, parar em «Colunas prontas», depois fuso e prévia.
- (b) Sem parada: «Usar estas colunas» segue para o fuso e a prévia; o modelo é salvo quando a importação é feita e
  aparece em «Importação feita». Sem conta escolhida, «Para qual conta?» vem antes do mapeamento.
**Recomendo (b)**: um toque a menos no celular e nenhum modelo salvo de importação abandonada.

**Q5 · Comportamentos novos, fora do quadro.** Colunas já sugeridas pelo nome; aviso «Esta coluna não parece data e hora.»;
«Datas em dia/mês ou mês/dia?» quando o arquivo não deixa claro; «O que quer dizer “X”?» para lados desconhecidos; chip
«Modelo “X”» com «Mudar colunas»; aviso de arquivo de execuções.
- (a) Revisão pequena do quadro ImportarConta no canvas antes da PR de telas.
- (b) Construir e você revê no app.
**Recomendo (a)**, como combinado na 2b («telas novas passam antes pelo protótipo»).

**Q6 · Mercados que aceitam o mapeamento.**
- (a) Todos menos binárias (Futuros de outras mesas, Forex, Ações e opções, Cripto, B3).
- (b) Só os mercados novos.
- (c) Todos, inclusive binárias (exigiria campos de stake, payout e expiração).
**Recomendo (a)**: serve também para Rithmic, Tradovate e NinjaTrader de outras mesas de futuros.

**Q7 · Coluna «Conta» com várias contas no arquivo.**
- (a) Passo mínimo: para cada conta do arquivo, «Juntar com {conta}» ou «Não importar»; sem criar conta nem grupo de cópia.
- (b) O cenário 6 inteiro (criar contas e grupo de cópia).
- (c) Tirar «Conta» das opções na 3b.
**Recomendo (a)**.

**Q8 · Gerenciar modelos.**
- (a) Nenhuma tela na 3b: «Mudar colunas» refaz e salva por cima.
- (b) Lista de modelos (renomear, apagar) em Personalizar.
**Recomendo (a)**; a lista pode vir com as Importações mais tarde.

**Q9 · Resultado calculado pelos preços.**
- (a) Só onde o cálculo é seguro: ações, opções (×100), cripto e os contratos de futuros e da B3 da tabela; Forex exige
  coluna de resultado.
- (b) Em todos, pedindo o valor do ponto quando não souber.
- (c) Nunca: coluna de resultado sempre obrigatória.
**Recomendo (a)**.

**Q10 · Qual arquivo real primeiro, e quando.**
- (a) Manter a 3b logo depois da Fase 3, com dados inventados no formato de uma operação por linha, e você manda só o
  cabeçalho (sem linhas) do primeiro arquivo real que pretende importar.
- (b) Adiar a 3b até você ter uma conta ativa num mercado novo.
- (c) Fazer a 3b junto com a Fase 3.
**Recomendo (a)**, que segue a decisão já tomada (Registrar na Fase 3 e, logo depois, a importação por colunas).

**Q11 · Excel e HTML.** O quadro diz «CSV, Excel ou HTML»; a Fase 1 ficou só com CSV.
- (a) Só CSV na 3b.
- (b) Excel (.xlsx) também, com uma biblioteca nova (precisa do seu OK).
**Recomendo (a)**: quase toda corretora exporta CSV, e o MetaTrader (HTML/PDF) precisa de leitor próprio de qualquer jeito.
