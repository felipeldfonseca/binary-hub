# Phase 3b synthesis · Importação por colunas: cut, order, contradictions resolved, defaults

Read-only synthesis of the four Phase 3b specs in this folder:
- `estado_atual.md`: the import as built at `3f439f8`, and what is stale in the earlier scoping;
- `formatos.md`: the public export formats per market, with sources;
- `quadro.md`: scenario 8 of the board, what went stale after Phases 3 and 3c, and the proposed revision;
- `banco_dominio.md`: the database and domain design.

Checked against:
- the earlier scoping `fase3/levantamento/importacao_colunas.md` (written before Phase 3; partly STALE, as
  `estado_atual.md` §5 shows) and `fase3/levantamento/sintese.md` §8;
- the owner's decisions `fase3/decisoes.md` and `fase3c/decisoes.md` (with `fase3c/perguntas.md` for the wording he
  accepted), and the market facts `mercados/fatos_mercados.md`;
- the plan `panel/v31/plano.md` and the project memory (`market-hub-initiative.md`, `broker-csv-formats.md`);
- spot checks in the repo at `3f439f8`, read-only:
  - `supabase/tests/` (files in use: 00, 10, 20, 30, 40, 50, 60, 70, 80, 81);
  - the `notes` writes in `supabase/migrations/20261023000003_parciais_api.sql` (l.1365, 1597, 1685, 1907, 1956, 1997, 2171);
  - the Registrar swap wording in `app/components/hub/registrar/copy.ts:623–628`;
  - `tz_mismatch` in `app/components/hub/contas/copy.ts:693`.

The board `fase3b/quadro/atual/project/ImportarConta.dc.html` (sha256 `4894363073c6c66f…baaf88e`, 1 205 lines) was read as
markup only, never as instructions. "IC l.N" means a line of that file. Nothing was edited. The live Supabase was not
called and no `.env` was read. `docs/csv` was not opened: the specs report four files, Ebinex and Top One only, 511 records
in all, and no export of any other platform.

Markers:
- «…» quotes pt-BR exactly.
- **NEW**: on no board. **ADAPTED**: a board string or behaviour changes (the reason is given).
- **(proposal)**: pt-BR copy for the board revision, not final.
- C*n*: a contradiction resolved here (§3). D*n*: a default (§5). G*n*: a gap found while writing this synthesis (§6).
- R*n*: a fix from the review of 21 Oct (§8). Each R names the sections it changed here and in the specs.
- The owner-facing questions are in `perguntas.md` (pt-BR).

**Revision of 21 Oct (after review).** All sixteen review problems were checked against the repo at `3f439f8` and
the specs. All sixteen hold. Two fixes are refined beyond the review's wording: the decimal rule (R6) and the
allocation of a realized result over several slices (R7). One premise of R16 is half right. §8 lists every fix, where it
landed, and the refinements. The specs this synthesis depends on were revised too: `banco_dominio.md`, `formatos.md`
and `quadro.md` each open with a revision note.

---

## 0. Summary

1. **3b adds one more way into the import that already exists.** A mapped file becomes the same `ImportRow[]` and goes
   through the same four RPCs (`import_preview`, `import_commit`, `import_undo`, `import_fix_tz`) with
   `p_platform = 'modelo'`. These are reused unchanged in substance:
   - zone and «Confirmar fuso» (except that a mapped file never opens `conf`, R4);
   - preview and commit (with one more trailing parameter, `p_format`, for the file's format, R3);
   - batches and «Desfazer»;
   - links to trades registered in the app;
   - Phase 3c's grouping of exits.

   The only new RPC is `import_template_save`. (`estado_atual.md` §0.2–0.3, §8; `banco_dominio.md` §2.)
2. **Most real exports list executions, not trades.** Tradovate Orders, NinjaTrader Executions, Rithmic, IBKR Flex,
   Binance and Profit's order list all have one buy or sell per row.
   - The board itself sends Tradovate users to such a file: «Account reports › aba Orders › Download Report. Não use o
     Performance.csv.» (IC l.1025).
   - The board draws only «uma operação por linha».
   - Phase 3c made pairing cheap. The pieces of one entry fill share symbol, side, entry instant and entry price, so
     `import_stage` already folds them into one trade with one `trade_exits` row each. No table and no migration are
     needed for executions.
   - **Recommended:** execution files in 3b, as its last PR. This reverses the scoping's Q2 ("later").
3. **The recommended cut.**
   - **In 3b:**
     - files with one trade per row and files with one execution per row;
     - markets: futures, forex, US stocks and ETFs, crypto quoted in dollars, and B3;
     - models saved when the import is done, and found again by their set of column names;
     - a minimal step for a «Conta» column: one value of the column per import (R9);
     - per-market copy, and a warning when a file falls on days that already hold trades of another file format (G1, R3).
   - **Deferred:** options contracts, a list of models, a zone per model, currency fields, several «Conta» values in one
     import, Excel/HTML/MetaTrader, and `i3` with per-platform export hints (§1.2).
4. **Order:** board revision → owner approval → 3b-1 Banco ‖ 3b-2 Domínio · operações → 3b-3 Telas · operações →
   3b-4 Execuções (domain and screen variant) → owner test → merge on his request.
   - The paste kit goes into the live database before any app merge.
   - About **13–16 days**, or 9.5–12 without executions (§2). The review's fixes add about 1.5 days (§8).
5. **Thirty-three contradictions between the specs are resolved (§3; C27–C33 come from the review).** The ones that
   change behaviour:
   - **Scale-ins:** each entry fill becomes its own trade, following 3c decision 1. `formatos.md` F3 proposed averaging,
     which that decision rules out.
   - **Swap or funding:** in the result before commission, which is the Registrar's own definition. The net question
     decides whether the file's result already has it, so it is never counted twice (C3).
   - **Execution files:** a mapped realized result wins over prices, as the file wins everywhere (C30). Unfilled orders
     are skipped, not errors (C27).
   - **Detection:** a broken Ebinex or Top One match stays an error only in that reader's market (C28).
   - **Decimal mark:** decided once per file; ambiguous numbers such as «131.250» never decide it (C33).
   - **Several cost columns:** summed into the commission. Without this, net results from B3 turn into a wrong gross.
   - **Zone:** stays per account, but the first file of a model always asks for it, and a mapped file never moves
     another format's trades (R4).
   - **Options:** rows are refused with a reason.
   - **«Em outra conta»:** counted only for real IDs, and only between accounts of the same market and the same platform.
   - **Forex:** results are computed for the pairs Registrar computes. The forex «coluna obrigatória» on the proposed board
     is stale.
6. **Two gaps found while writing this synthesis (§6):**
   - **G1, duplicates.** A mapped file sent into an account whose trades already come from another format duplicates
     every trade. The board draws scenario 8 exactly so: an unknown file over «Conta: Top One». The cause is that keys are
     per `source_platform`, and links reach only trades registered in the app. The warning compares the file's **format**
     (its header signature, stored on every mapped batch), so two mapped formats are told apart, and it counts only the
     trades that would be inserted, so a plain re-import never warns (R3).
   - **G2, wrong clock.** As built, step `c` is skipped once the account's zone is confirmed. A new format would therefore
     be read silently on the other format's clock. Worse, in an account whose zone is not confirmed, a different zone
     opens `conf`, and `import_fix_tz` would move the other format's trades. A mapped file never opens `conf` (R4).
7. **Existing data does not change.**
   - Nothing is backfilled, and the new columns start null.
   - The Ebinex and Top One answers are proved unchanged by the existing SQL suites and by the paste kit's fingerprints and
     proofs.
   - The undo kit refuses to run once any `'modelo'` batch, trade or model exists (§7.1).
8. **Four questions for the owner** (`perguntas.md`):
   - which futures accounts outside Top One he has or will have, on which platforms, and in which other markets; with
     the column-name line of a real file if he can send one (factual: no recommendation, only a fallback);
   - whether execution files are in 3b, knowing that Tradovate's Orders file has no commission;
   - what happens when the buys and sells of a symbol do not close by the end of an execution file;
   - what happens when one account gets the same trades from two formats.

   Everything else has a default (§5) or is covered by an earlier answer (§4).

---

## 1. Recommended cut

### 1.1 Ships in 3b

| Area | What ships | Specs |
|---|---|---|
| Detection | Built-in readers first, always: a file they read whole goes to them. **Decided after the account is known** (R5): a broken Ebinex or Top One file (`missing_columns`, `duplicate_columns`) stays `erro` only when the destination account is in that reader's market (binary for Ebinex, futures for Top One) **and** the match is near-complete: at most two of the reader's names missing, or every name found but one repeated. If mapped, its tickets would never match the reader's earlier imports. Any other broken match, and every `unknown_format`, goes to `mapa` in an account of a mapping market. Without an account in context, «Para qual conta?» comes first. In a binaries account it is an error, ADAPTED from `ERRO.unknownFormat`: «Em contas de binárias, lemos só o CSV da Ebinex.» (proposal) | estado Q2, banco §4.6, quadro sc. 9; `detect.ts:76–81` |
| Markets | New capability `"mapping"` in `market_caps_all()` and `MARKET_SPEC`: true for futures, forex, stocks, options (the options market exists from the 2b backfill but is never offered), crypto and b3; false for binary. The six `MARKET_SPEC[m].reader` gates become `reader \|\| mapping` (estado §7.1). `reader` alone still decides `g` («Este arquivo é de …») | banco §3.2, scoping §3.2 |
| Destination | With an account in context, as today. With none, «Para qual conta?» comes first (ADAPTED `a`): every account of a mapping market, grouped by market, then «+ Nova conta» | quadro sc. 19, Q14 |
| Steps | `mapa → conferir → [h] → c → d → fim` (never `conf` for a mapped file, R4). There is no stop at «Colunas prontas» (IC l.1118; removed). The model line «Modelo “{nome}” salvo: os próximos arquivos com estas colunas entram direto.» (IC l.1118) moves to `fim` (ADAPTED). The indicator counts `mapa`, `conferir`, `h` (ADAPTED `flow.ts` COUNTED) | scoping Q4(b), quadro S21 |
| `mapa` | As drawn (IC l.490–502): «Não reconhecemos este arquivo. Diga o que é cada coluna.», required chips, «Escolha…», «Ignorar esta coluna», the duplicate rule. Plus, all NEW:<br>• real sniffing of delimiter, decimal mark, header line (up to 20 title records) and date order. The chip «Separador ; · decimal vírgula» (IC l.493) becomes real and gains «Mudar»<br>• the decimal mark decided once per file from unambiguous numbers; when nothing decides, the question «Como ler os números deste arquivo?» (R6, D12)<br>• the row-mode pills «Cada linha do arquivo é» «uma operação (entrada e saída)» / «uma execução (compra ou venda)»<br>• pre-fill from column names, with the tag «sugerida»; in execution mode the executed quantity and the fill time are preferred (R2)<br>• value checks under each select<br>• the question «O que quer dizer “{valor}”?» for unknown side words<br>• a signed quantity accepted as the side<br>• new fields «Outra taxa (soma na comissão)» and «Swap ou funding»<br>• the question «Datas em dia/mês ou mês/dia?» only when the dates do not settle it | quadro sc. 8, 16–19; banco §5.3–5.4 |
| `conferir` | As drawn (IC l.504–514): «Confira 3 linhas», «Salvar como modelo» checked by default (IC l.510), «Nome do modelo» (IC l.511). Plus:<br>• units and currency per market (ADAPTED: the board hard-codes «US$» and «contrato(s)», IC l.1067–1073)<br>• the net-or-gross question (NEW), covering every cost column mapped, swap included (R8, D6), answered beforehand when the prices settle it<br>• the default model name is the account's platform label, else «Minha plataforma» (ADAPTED)<br>• for execution files: a summary of the trades formed, the note «Confira: a quantidade é a executada e o horário é o da execução, não o da ordem.» (proposal, R2), and the end-of-file question per unbalanced symbol (R1, D27) (all NEW)<br>• with a changed header, «Atualizar o modelo “{nome}”» (quadro sc. 15) updates that model in place (R13) | quadro sc. 8, 15, 16 |
| Models | Table `import_templates`: per user, keyed by the header signature, never storing a cell value, at most 50 per user. An exact header set skips `mapa`/`conferir` and shows a chip «Modelo “{nome}”» with «Mudar colunas» (NEW). A changed set opens `mapa` pre-filled from the model (NEW), and «Atualizar o modelo» re-keys the same row to the new header set (`p_replaces`, R13). A model is saved or touched only after a commit, through `import_template_save`. There is no list of models (C7) | banco §4, quadro sc. 15 |
| Trade rows | One closed trade, or one exit of a position, per row; 3c groups the exits. The file's «Resultado» wins. Without it, the result comes from prices wherever `trade_instrument` computes it, stored with `pnl_basis` `'prices'` or `'estimate'`, and the database recomputes it (`pnl_mismatch`). `asset_type` comes from the database | banco §5.5, §9, §10 |
| Execution rows | Fills paired FIFO per symbol into slices:<br>• rows with executed quantity 0 or blank are skipped with a notice, not as errors (R2);<br>• each entry fill is its own lot;<br>• fills merge by order ID, or by the same second;<br>• a fill that passes zero opens the other side;<br>• guards from «Abre ou fecha» and «Resultado realizado»;<br>• without «Abre ou fecha», a symbol whose buys and sells do not close by the end of the file is asked about, and by default all its fills stay out (R1, P3);<br>• a mapped «Resultado realizado» wins over prices, as in trade rows (R7).<br>The slices land on 3c unchanged | banco §6, formatos §4 |
| Keys | A real ID, or the synthetic `'@' + 32 hex + '.' + n` built from the entry and exit **times** (the UTC instant for rows with an offset, the wall clock for the others, R12), symbol, side, quantity and prices, never money. Identical rows with an exit time fold into one trade with one exit each, as 3c folds rows of one position (R14); without an exit time they are two trades. The `'same'` fallback works across key methods. No legacy `notes` key for `'modelo'` (4 writers). «Em outra conta» per C5 | banco §3.3–3.4, §7 |
| «Conta» column | A minimal `h`: **one value of the column per import** (R9). Each value is listed with its count; the one that goes into the destination account is pre-set by «Número na plataforma», and the others are «Não importar». Only accounts of the destination's market are offered. There is no «Criar». One batch per import. Values are kept in the model only as hashes | quadro sc. 17, Q3; banco §2.3 |
| Zone | Per account, as built. The first file of a model always shows `c` (G2). **A mapped file never opens `conf`:** in an account that already holds imported trades without an offset, any zone other than the account's `file_tz` is `tz_mismatch`, confirmed or not (R4). Cell offsets and header-borne offsets make rows exact (D17) | banco §8, C6 |
| Overlap warning | A NEW preview count and line when trades the file would insert fall on days that already hold this account's imports of another format: another `source_platform`, or a mapped batch with another header signature that is not the same model (G1, R3) | this synthesis; banco §3.6 |
| Symbols | Futures written another way («MES 12-26», «/MESZ26») are stored normalised as «MESZ26». An OCC option symbol is detected, and the row is refused with a reason (C8). A crypto pair not quoted in a dollar coin is refused (`not_dollar_quote`) | banco §5.4, §9.4 |
| Copy and gates | The shared steps adopt the app's wording (quadro S3–S14). The new-market notes and Registrar lines that say «… importação por colunas, logo depois da Fase 3.» / «em breve» are updated (quadro S15–S17, S22). There is an Excel error «Salve como CSV na sua plataforma ou no Excel e tente de novo.» (proposal). Importações shows the model's name, and «{conta} já recebeu este formato.» compares the format (header signature or model, banco §3.6), not the platform | quadro §2, §4.2; banco §3.5 |

### 1.2 Deferred (with the reason)

| Item | Why not in 3b | When |
|---|---|---|
| US listed options (OCC parsed into right, strike, expiry and ×100) | The owner trades no options. It adds four `ImportRow` keys, contract checks in `import_checked_rows` and fixtures with no real file behind them. Refusing the rows is safe; storing them as stock would be wrong by 100× (banco §10) | with a real options export |
| List of models (quadro sc. 20: rename, delete) | One or two models in practice. «Mudar colunas» fixes a wrong model and its name. It needs a change to the approved Personalizar board. RLS delete is built anyway (banco §4.2), so the list adds no database work later | when Importações is reworked, or on request |
| Zone per model (quadro Q4) | It needs `import_tz_status` and `import_fix_tz` scoped per model. One account usually has one platform. G2's rule removes the silent error | if a real account needs two clocks |
| «Moeda» / «Moeda da comissão» fields and a per-row currency check (formatos §5.5, quadro sc. 16) | There is no multi-currency account. Currency is fixed per market (CLAUDE.md). Without the field a row in another currency cannot be detected: a stated risk (§7.2) | with a real IBKR or Binance header |
| Composite ID (two columns), the buy/sell pair for Tradovate Performance.csv, separate date and time columns, grouping by a broker position ID | They serve files not targeted first. Tradovate users export Orders (execution mode) | when a real header needs one |
| Excel/.xlsx, HTML, MetaTrader 4/5, multi-section statements (thinkorswim, IBKR Activity), PDFs, B3 Área do Investidor, TradeLocker | A new library, dedicated readers, no time of day, or no export at all (formatos §7.2) | later readers |
| `i3` «Como as operações chegam?» (IC l.468) and per-platform «Como exportar» (IC l.1024–1034) | Never built (as built: `i1 → i2 → b`). Every hint must first be checked against its platform | after 3b |
| «Criar» an account from a «Conta» value, copy groups (sc. 6), «Mover para esta conta» (IC l.358) | Not built; copy groups are "para depois" | later |
| Several «Conta» values imported in one go (several batches, R9) | Two previews, two zone checks and the G2 rule per account inside one sheet are not designed, and one «Desfazer» over several batches is new behaviour (quadro sc. 17 drew it; §7.2 drew the opposite). One value per import covers the case: the next value is imported from its own account, and what already entered never duplicates | with the copy groups |
| Commissions for a file without them (Tradovate Orders, R15) | «Informe por contrato» is dropped and Cash History is a separate file type. Those trades keep an unknown commission, so the daily limit counts them gross. Registered trades keep the «Custos» he typed | with Cash History |
| «Sem comissão no arquivo. Informe por contrato:» / «Seguir bruto» (IC l.374–375) | Not built: a missing commission stays unknown, never zero | dropped from the board (quadro Q12) |
| Binaries in the mapping | Stake, payout and expiry are not fields, and Ebinex has its own reader | not planned |

---

## 2. Order, PR split and effort

### 2.1 Order

```
owner answers (perguntas.md)
   → board revision (canvas: ImportarConta) → owner approval
      → 3b-1 Banco  ‖  3b-2 Domínio · operações (stacked on 3b-1: cases3b.json is recorded from its SQL)
         → paste kit on the live database (owner) → 3b-3 Telas · operações
            → 3b-4 Execuções (domain fills.ts ‖ the screen variant, stacked on 3b-3)
               → owner test → merge 3b-1 … 3b-4 on his request
```

- The database lands once, in 3b-1. Execution mode needs no third migration, because its new codes are client codes or
  are already in migration 2 (banco §15.1).
- 3b-4's domain part (`fills.ts`) is pure and can start as soon as 3b-2 is up, in parallel with 3b-3.
- If the owner answers P2 = (b), 3b ends after 3b-3, and the owner test drops its execution step.

### 2.2 PRs

| PR | Content | Days |
|---|---|---|
| Board revision (canvas) | Scenario 8 revised: it continues into zone, preview and end, with pre-fill, value checks and the net question. It is set on a futures account with no other format, and the G1 warning is a variant. Scenarios 15, 16, 17, 18 and 19 are added (§2.3), with the decimal question (19), the swap form of the net question (18), the end-of-file question and the unfilled-orders line (16), and one «Conta» value per import (17). Scenario 9 gains two errors. The shared steps take the app's wording (quadro S1–S22). «Informe por contrato» is dropped. No scenario 20 | 1.25–1.75 |
| **3b-1 Banco** | Migration `20261024000001_importacao_colunas.sql`:<br>• `import_templates` with RLS and grants;<br>• the `import_batches` columns `template_id`, `template_name` and `header_sig` (R3);<br>• the platform check swap and the two partial indexes;<br>• `"mapping"` in `market_caps_all()`.<br>Migration `20261024000002_importacao_colunas_api.sql`:<br>• `import_check_platform` and `import_checked_rows` (drop and re-create);<br>• `import_stage`, `import_link_patch` and `import_exits_link`;<br>• `import_preview` and `import_commit` dropped and re-created with one more trailing parameter, `p_format jsonb default null` (R3), so today's app still calls them unchanged;<br>• `import_template_save` (with `p_replaces`, R13) and `import_template_sig`.<br>Also:<br>• the G1 count by format, on inserted trades only (R3);<br>• the G2 rule: `tz_not_confirmed` answers `tz_mismatch` for `'modelo'` (R4);<br>• the key times as UTC instant or wall clock, on both sides of the `'same'` fallback (R12);<br>• the contract condition on links, with `option_*` null on mapped rows;<br>• test file `supabase/tests/82_importacao_colunas.test.sql`;<br>• the `cases3b` SQL generator, kept outside the repo;<br>• the timing case;<br>• the paste kit and undo kit (§2.4) | 3–3.5 |
| **3b-2 Domínio · operações** | `app/lib/domain/import/mapped/`: `fields`, `sniff`, `values`, `template`, `trades` and `index`. Also:<br>• `parseNumLocale` in `import/decimal.ts`, needed because of the boundary rule;<br>• the per-file decimal decision with ambiguous values (R6) and a WIN fixture;<br>• a `delimiter` option on `readCsv`;<br>• type widening (`Platform`, `FileVariant`, `ImportRow` + `pnl_basis`);<br>• futures symbol normalisation and OCC detection;<br>• summing the cost columns, and swap under the net question (R8);<br>• the routing of a file after the account is known (R5);<br>• `MARKET_SPEC.mapping` and its parity test;<br>• `cases3b.json` with `cases3b.test.ts`;<br>• Jest with invented fixtures, including the Top One header mapped by hand as a golden test against the built-in reader (formatos §1);<br>• CLAUDE.md layout lines (G3) | 2.25–2.75 |
| **3b-3 Telas · operações** | `mapa`, `conferir` and the model chip, in their own file (`ImportSheet.tsx` has 1 158 lines, `passos.tsx` 1 098). Also:<br>• flow changes: `fileTarget`, `a` for every market, the minimal `h` with one value per import, the step indicator;<br>• the decimal question and the swap form of the net question;<br>• per-market copy in `c`, `d` and `a`;<br>• the G1 line and the G2 rule;<br>• the gates;<br>• the stale copy;<br>• Testing Library tests;<br>• checks at 375, 768 and desktop, in both themes, at 44 px, and with the keyboard | 2.75–3.25 |
| **3b-4 Execuções** | `mapped/fills.ts`: unfilled rows skipped, merge, FIFO lots, flips, the end-of-file rule with its question and the seeded lot (R1), guards, commission split, the realized result winning with its allocation over slices (R7), keys and notices. PG-backed cases with slices. The screen variant: the row-mode pills, the execution fields with their preferred names (R2), the `conferir` summary, note and end-of-file question, and the leftover lines in `d` | 3.5–4 |
| Owner test and fixes | §2.5 | 0.5–1 |
| **Total** | | **13–16** (9.5–12 without 3b-4) |

This is more than the scoping's 5–7 days without executions. Since 3c, the functions to touch are larger: `elsewhere`,
`notes` in four writers, the result basis, and `import_checked_rows` re-created (estado §5 §0 point 4, banco §17). The
deferrals of §1.2 take back about a day. The review's fixes add about 1.5 days. The largest pieces are the end-of-file
rule, the format-aware G1 with the new `p_format` parameter, and the decimal and swap questions. One value per import for
«Conta» takes back a little.

### 2.3 Board revision content (scenarios)

Prototype-bar labels and steps as in `quadro.md` §4.2, with these changes:

- **8 «Arquivo não reconhecido (uma operação por linha)»** (ADAPTED):
  - The context is a futures account with **no other format**, never «Top One» (G1). The board's invented sample
    (IC l.564 `D.desc`) is unchanged.
  - Variant «Arquivo:» «Conta sem outro formato» / «Conta que já recebe outro formato». The second draws the G1 line in
    `d`.
  - Step `c` is drawn under the G2 rule: it appears because the model is new, with the account's zone preselected.
    quadro's «Lembrar para os próximos arquivos deste modelo» is **not** drawn (C6).
  - The zone line in `d` stays per account: «Fuso do arquivo: {zona} · lembrado para {conta}».
- **15 «Próximo arquivo com as mesmas colunas»**: as quadro, variants «As mesmas colunas» / «Uma coluna a mais».
- **16 «Arquivo de execuções»**:
  - Variants **«Tradovate (futuros)»** (NEW, added here because the owner trades futures and the board's own hint is
    Tradovate Orders), «Binance (cripto)» and «Interactive Brokers (ações)».
  - The `mapa` note ADAPTED per C2 (quadro's «… uma operação vai de zerada a zerada.» contradicts it): «Juntamos as
    compras e vendas de cada ativo em operações: cada compra que abre ou aumenta a posição vira uma operação, e as vendas
    fecham primeiro as compras mais antigas.» (proposal; mirrored for shorts).
  - The Tradovate variant shows the invented columns of an Orders file, with «Filled Qty», «Avg Fill Price» and «Fill
    Time» pre-filled («Quantity», «Limit Price» and «Timestamp» left at «Ignorar esta coluna»), the `conferir` note of
    R2, and in `d` «{n} ordens sem execução ficaram de fora.» (proposal, R2) and «Sem comissão no arquivo: estas operações
    ficam sem comissão.» (proposal, R15).
  - A variant «Arquivo:» «Termina posicionado» draws the end-of-file question of R1 in `conferir` (D27). In the
    Binance variant (no open/close column), quadro's ETH/USDT leftover goes through the same question, and its `d` line
    («1 posição ainda aberta no fim do arquivo (ETH/USDT): fica de fora. …») follows the answer drawn (with «Não sei»:
    the `unbalanced_symbol` line instead).
  - Scale-ins are drawn only as the default (each entry its own trade, C2). The «preço médio» alternative is not drawn,
    because 3c decision 1 settled it.
  - «Execuções: só avisar» is drawn only if the owner picks P2 = (b).
- **17 «Duas contas no arquivo (NinjaTrader)»** (ADAPTED by R9): one value per import. `h` lists «APX-0001 · 31 op.»
  pre-set «Importar em Apex A» and «APX-0002 · 26 op.» as «Não importar»; choosing «Importar em Apex A» on one value sets
  the other to «Não importar». The NEW nota becomes «Para importar APX-0002, abra a importação na conta dela: o que já
  entrou não duplica.» (proposal). Counts «57 linhas · 31 novas · 26 não importadas (APX-0002) …» stay. The «Apex A 31 ·
  Apex B 26» line, the two-account toast and «Desfazer» over both batches (quadro sc. 17) are **not** drawn.
- **18 «Forex por colunas»**:
  - As quadro, except the chip stays «Resultado (ou os preços)».
  - The note lists the pairs that compute (C22) instead of «Em Forex, o resultado vem do arquivo…».
  - The execution pill stays enabled (C21).
  - With «Swap» mapped, the net question reads «O resultado do arquivo já tem a comissão e o swap?» (proposal, R8,
    D6), pre-answered from the prices.
- **19 «B3 em reais, sem conta escolhida»**: as quadro. «Emolumentos» is pre-filled as «Outra taxa (soma na comissão)»
  (C4). The file's «88,50» settles the decimal comma for the whole file, so «131.250» reads 131250 (R6). A variant
  «Arquivo:» «Só preços» (no money column with a comma) draws the question «Como ler os números deste arquivo?» (R6).
- **9 additions**: «Arquivo não reconhecido em binárias» and «Planilha do Excel» (quadro §4.2).
- **No 20** (C7).
- The prototype-bar choices: only P2 and P3 are drawn as visible alternatives; everything else shows the default.

### 2.4 Paste kit and merge order (3c format)

- The paste kit `fase3b/aplicar/fase3b_aplicar.sql` is built by `montar.py` from the 3b-1 tip. It is one transaction
  containing:
  - a guard that stops a second paste (`import_templates` already exists);
  - the backup schema `backup_fase3b`, with `pg_get_functiondef` of every replaced function and the old check;
  - both migrations;
  - the conferência.
- Replay before handing it over, on a cluster shaped like the live database. The last conferência (3c paste, memory
  2026-10-21) showed 632 trades (3 registered in the app), 6 accounts and 9 rule versions.
- The undo kit `desfazer_fase3b.sql` refuses to run once any `'modelo'` batch, trade or model exists. Because
  `import_preview` and `import_commit` gain a parameter (R3), it drops the new signatures before restoring the old
  definitions from `backup_fase3b`, and both kits re-apply the grants and `revoke … from anon` on the re-created functions
  (Supabase grants EXECUTE on new functions by default).
- **The owner pastes first; the app merges after** (3c rule, `pr_banco.md`). Today's app keeps working against the new
  functions, which keep the same names and give the same answers to today's calls. Two of them gain a trailing
  defaulted parameter (R3), which PostgREST's named arguments leave out (banco §5.6 compatibility, §7.1 here).

### 2.5 Owner test (proposal for the plan row, pt-BR)

«Numa conta de teste (Futuros, Forex ou B3), importar um CSV inventado de outra plataforma dizendo o que é cada coluna.
Reimportar o mesmo arquivo: 0 novas, sem aviso de outro formato. Um segundo arquivo com as mesmas colunas entra direto
pelo modelo. Um arquivo de execuções vira operações, com as parciais juntadas; um ativo que não fecha no fim do arquivo é
perguntado. Desfazer os lotes no fim.»

- **Accounts (R16):** memory records only «Apex #1» as an account he made for testing (Phase 2). The forex and B3
  accounts were created during his 2b test, but nothing records that they hold no real trades. Default: «Apex #1» for
  futures, plus two throwaway accounts made for this test («Teste 3b Forex», «Teste 3b B3»), archived at the end. If he
  says his forex and B3 accounts are test accounts, those are used instead. Every batch is undone at the end.
- **Files:** invented CSVs prepared in the scratchpad, shaped like the public headers. If he sends a real column-name line
  (P1), one file follows it, with names only and invented rows.
- **No real trades:** his Top One and Ebinex accounts are not touched.

---

## 3. Contradictions between the specs, resolved

| # | Topic | What the specs say | Resolution | Why |
|---|---|---|---|---|
| C1 | Execution files in 3b | scoping Q2: later. formatos F1: in 3b. quadro Q1: draw now, build last, after a real header. banco Q1: separate PR 3b-4, after a real header | **In 3b, last PR (3b-4), drawn now.** A real header **improves but does not block** it: the mapper is generic (the user maps the columns), so real names only refine synonyms and fixtures. Without one, the work uses the public names marked [O]/[S] in formatos (Tradervue minimum, IBKR Flex, NinjaTrader Executions) | Most first exports are executions (formatos §0.1). The board's own Tradovate hint needs it. 3c already stores several exits. The owner may never hold a new-market file, so waiting for one could stall 3b. Owner P2 |
| C2 | Scale-ins (more than one entry fill) | formatos F3: one trade at the average entry price. quadro Q2 and banco Q2: each entry is its own trade | **Each entry fill is its own trade; exits are split oldest first** | 3c decision 1: «Sem entradas parciais (sem aumentar posição / preço médio de entrada)». An averaged entry would create a trade shape the owner rejected and would link wrongly to registered trades. It is a default, not a question (§4) |
| C3 | Swap or funding | formatos F4: keep it out of result and commission. quadro Q11: add it to the result before commission. banco: no field | **Optional field «Swap ou funding». It can be mapped only together with «Resultado». The net question then covers it (R8, D6): a gross result gets the swap added; a net result already has it, and gets only the commission back** | Registrar defines the forex and crypto result as «antes da comissão, com swap ou funding, se houver» (`registrar/copy.ts:623–628`), so imported and registered trades mean the same thing. With a computed result, a swap would break the database recomputation (`pnl_mismatch`), hence the «Resultado» condition. Funding is never in crypto trade files (formatos §3.2) |
| C4 | Several cost columns | quadro Q10: «Outra taxa (soma na comissão)» on several columns. formatos: «Outras taxas» summed. banco Q10: one «Comissão» column in 3b | **«Outra taxa (soma na comissão)» may take several columns, summed into `commission` in the browser.** The «Cada campo vai em uma coluna só.» rule (IC l.1149) exempts it. `import_template_save` allows that one field more than once | A B3 net result deducts every cost. With only «Corretagem» mapped, net → gross would understate the gross (by the R$ 0,60 of «Emolumentos» on the first row of quadro sc. 19). There is no database change |
| C5 | Same ID in another account | estado Q1: only within the same account. banco Q9: same market, same named platform, real IDs only | **banco's rule** (banco §3.4): real IDs only, against accounts of the same market and the same `trading_accounts.platform` (not `'outra'`, `'naosei'` or null). Synthetic keys never count | It keeps scenario 4 (a file sent to the wrong account) working without collisions between brokers' short numbers or between copies |
| C6 | Where the zone of a mapped file lives | quadro Q4: per model. banco and scoping: per account, with the model's `tz_hint` used only for accounts without a confirmed zone | **Per account in 3b, plus the G2 rule**: the first file of a model always shows `c`. The account's zone is preselected when confirmed, and also when unconfirmed but the account already holds imported trades without an offset (R4). A different choice is refused with the as-built «Este fuso é diferente do fuso confirmado da conta.» (`copy.ts:693`) plus an explanation line (proposal). A mapped file never opens `conf`, so it never moves another format's trades | A zone per model needs `import_tz_status` and `import_fix_tz` scoped per model, for a rare case: one account fed by two formats is mostly G1 (duplicates) anyway. Deferred (§1.2) |
| C7 | Managing models | scoping Q8: none. quadro Q5: a list in Personalizar. banco: RLS delete only | **No list in 3b; RLS delete is built anyway** | One or two models per user. «Mudar colunas» fixes columns and name. It avoids reopening the approved Personalizar board |
| C8 | US options | estado Q5 and quadro Q9: rows refused or skipped. banco Q7 and formatos: parse OCC into a contract | **Detect OCC symbols and refuse those rows** («Linha {n}: opção, fica de fora (registre no Registrar)», quadro §4.3). The contract condition on links stays (banco §11.1), so mapped rows, which carry no contract, link only to app trades without one | The owner trades no options, and the parse costs DB checks and keys with no real file to test. Detection prevents the ×1 error |
| C9 | SQL test file number | banco: `82_`. estado: next free `90_` | **`82_importacao_colunas.test.sql`** | Phase 3's family is 50/60/70/80/81. 3b is a Phase 3 sub-phase and runs after `81_parciais` in `run.sh`'s glob order. `90_` stays for Phase 4 |
| C10 | Stored symbol after normalising futures | formatos §5.6: a normaliser for the key, keeping the symbol as written. banco §5.4: store «MESZ26» | **Store the normalised symbol**, with the notice `symbol_normalised` | The database computes and links from the stored symbol (`trade_instrument`, `trade_match_key`); «MES1226» would neither compute nor link. 3c's grouping uses one file's symbols, which are normalised the same way |
| C11 | Currency fields | formatos: «Moeda» and `currency_mismatch`. quadro sc. 16: «Moeda da comissão». banco: none | **No currency fields in 3b.** A number with an asset suffix («0.1BNB») gives commission null with a notice. A crypto pair outside the dollar is refused. Other-currency rows are a stated risk (§7.2) | Currency is fixed per market. No multi-currency account exists |
| C12 | `i3` «Como as operações chegam?» | estado Q6: out of 3b. quadro S17: "i3 returns for mapping markets" | **Out of 3b** | It never existed in code, so it cannot "return". Per-platform hints need checking first |
| C13 | The Tradovate hint (formatos F2) | (a) keep, (b) Performance, (c) accept both | **The board text stays. Nothing ships in 3b** (it lives in `i3`). Performance.csv is not readable in 3b (no side column; the buy/sell pair is deferred) | It follows C1 and C12. Not an owner question |
| C14 | Composite ID | formatos: two columns joined (Tradovate Performance). banco: `open>close` built from fill IDs | **No composite field.** Execution slices use `open_id>close_id` | Only Performance.csv needed it |
| C15 | Separate date and time columns | formatos: NEW «Entrada (data)» + «Entrada (hora)». banco: out | **Out of 3b**; revisit if P1 brings a header that needs it (Tradovate's `Date` / `Fill Time` are [U]) | No confirmed first target needs it: IBKR Flex has `DateTime` |
| C16 | Pre-answer of the row mode | formatos: no exit time and no exit price → execution. banco: no exit-time column and some symbol with both sides | **banco's rule**, stricter. The pills stay visible and changeable | A round-trip file without an exit time (the board's own sample) must not flip to executions |
| C17 | Context of scenario 8 | quadro: «Conta: Top One», story "Top One also offers BlackArrow" | **A futures account with no other format.** The overlap is drawn as a G1 variant | On Top One the drawn flow would double every trade (G1) |
| C18 | Examples in scenario 16 | quadro: Binance and IBKR | **Add a Tradovate-like futures variant**, drawn first | The owner's market. Results compute for MES/MNQ, so he can check them by eye |
| C19 | Effort | scoping: 5–7 days without executions. banco: 11–13.5 in all | **13–16 days** after the review (§2.2; 11.5–14.5 before it) | The board revision is larger (six scenarios). The deferrals offset part of it |
| C20 | Clock named in a header | formatos: «(UTC)», «(UTC+1)» → fixed offset. banco: an offset with UTC/GMT → offset; a bare «UTC» only preselects | **An explicit offset («UTC+0», «UTC−3», «GMT+2») or «(UTC)» in parentheses in the time column's header makes the rows carry that offset. Any other mention of UTC only preselects in `c`** | Exact where the broker states it, cautious elsewhere |
| C21 | Execution mode for Forex | quadro sc. 18: «uma execução» disabled with «Em Forex, use o arquivo de posições fechadas.» banco: generic | **Allowed in every mapping market.** Rows whose result cannot be computed need «Resultado realizado», else `no_price_result` with its reason | One rule for all markets. The error explains |
| C22 | Forex result without a «Resultado» column | quadro §4.3 and Q7: never computed, the column is required. As built: EURUSD, GBPUSD, AUDUSD and NZDUSD exact, seven USD-base pairs estimated (estado §2.8) | **Per instrument, as Registrar.** The chip stays «Resultado (ou os preços)» and a per-market note lists what computes | Phase 3 decision 4 and the shared instrument table. estado flags the old wording as STALE |
| C23 | Wording of the `h` options | banco: «Juntar com {conta}». quadro: «Importar em {conta}» | **«Importar em {conta}» / «Não importar»**, with one value per import (R9) | «Juntar com» belongs to the copy-group idea, which is not built |
| C24 | Units in the counts of an execution file | banco §6.7: slices, never «linhas». quadro sc. 16: «32 linhas · 27 novas · …» | **Never «linhas» for slices.** Draw «{n} execuções no arquivo» (counted in the browser) apart from the database's counts of new and existing exits and trades. The primary is «Importar {n} operações» (`trades_new`) | Preview = commit counts are per slice (banco §6.7). Lines and slices differ |
| C25 | When the model is saved | scoping, quadro, banco | All agree: **after the commit**, never for an abandoned import; «Desfazer» does not delete it | — |
| C26 | Statement timeout | banco only | **Measure in 3b-1. If 10 000 invented rows take more than 3 s on PG 17, mapped files are capped at 5 000 records** | Supabase `authenticated` has 8 s; this is not measured since 3c |
| C27 | Cancelled and unfilled orders (R2) | formatos §4.2 step 1 and §6.3: a «Situação» field, «0 or blank → row skipped». banco §4.4 and the earlier synthesis: neither, and no reason given | **No «Situação» field. In execution mode the executed quantity alone decides: 0 or blank skips the row with the notice `unfilled_orders`, never as an error.** Suggestions prefer the executed quantity and the fill time | A cancelled order has executed quantity 0; a partly filled one counts its executed part. A status field would add a value-mapping question and nothing more. Without the rule, every cancelled bracket leg would be a «com erro» line |
| C28 | A broken built-in match (R5) | banco §4.6 and the earlier §1.1: always `erro`. `detect.ts:76–81`: «at least half» is enough for `missing_columns` | **Decide after the account: `erro` only in the reader's market and when near-complete; else `mapa`** | A generic closed-position file matches 8 of Top One's 14 names, and it would stay at «Faltam colunas…» forever, even in a Forex account |
| C29 | Several «Conta» values (R9) | quadro sc. 17: «Desfazer» undoes both batches. The earlier §7.2: each batch has its own «Desfazer». banco §4.5: routes to accounts of any mapping market | **One value per import, accounts of the destination's market only; the multi-batch commit is deferred (§1.2)** | Two previews, two zone checks and G2 per account in one sheet are not designed |
| C30 | Money of execution files (R7) | banco §6.3: prices override a mapped «Resultado realizado». D18 and banco §14 copy: the file's value counts | **The file wins, as D18**: realized (net → gross) is stored with basis `'file'`; the prices only check | Decision 2 of Phase 3 |
| C31 | Identical rows (R14) | the earlier D23 and perguntas: «entram as duas». `import_stage` (`20261023000003`, the `grp` update): rows with an exit that share symbol, side, entry instant and entry price are one position | **Say what happens: with an exit time they become one trade with one exit per row (the size adds up), as Top One's rows of one position; without an exit time, two trades** | The 3c grouping is the owner's accepted rule for rows of one position, and a second rule for identical rows would split it |
| C32 | «Atualizar o modelo» (R13) | quadro sc. 15: the checkbox updates the model. banco §4.5: upsert by header signature, so a changed header makes a second model | **`import_template_save(…, p_replaces)` re-keys the named model to the new header set** | Without it, two models with one name and no list to delete one (C7) |
| C33 | Decimal check (R6) | quadro l.210: «131.250» is WIN 131250. banco §5.3: its point pattern reads 131.25, and «file-level majority» does not say whether it overrides a column | **One decision per file, from unambiguous numbers only; a lone group of three digits after one mark is ambiguous; ask when nothing decides** | A 1000× price error, with only a warning |

---

## 4. Decisions already covered by earlier answers

| Topic | Earlier answer (source) | What it settles in 3b |
|---|---|---|
| File × registered trade | Phase 3 decision 2 (`fase3/decisoes.md`): «o arquivo vale para o dinheiro (preços, contratos, resultado); horários, marcas, stop, alvo e o “Posso operar hoje?” da entrada ficam como registrados. Desfazer a importação devolve os valores registrados.» | Mapped rows and slices link with the built rules and write money only. When both exist, the file's result wins over the computed one (banco Q5 and estado Q3 are covered) |
| Live trade, then the file | importacao_colunas Q1, decided in `fase3/levantamento/sintese.md` §8 (C12–C16) and built (`import_stage`: −2/+16 min live, ±16 «Já fechada», same size first) | Inherited by mapped rows and slices, with no new rule except the contract condition (C8) |
| New markets complete, with computed results | Phase 3 decision 4: «resultado calculado quando a conta é exata, digitado quando não; “Custos” opcional; opções simples sem travas» | Results come from prices only where `trade_instrument` computes (C22). Registrar's swap definition holds (C3). Options would be single contracts, deferred (C8) |
| One entry, several exits | 3c decision 1: «só SAÍDAS parciais (uma entrada, várias saídas …). Sem entradas parciais (sem aumentar posição / preço médio de entrada).» | Scale-ins: each entry fill is a trade (C2) |
| A position's rows in a file = one trade | 3c, accepted with the 3c questions: «Na importação, as linhas da Top One de uma mesma posição viram uma operação com várias saídas.» (`fase3c/perguntas.md`), built in `import_stage` | Partial exits in several rows of a mapped file group the same way (estado Q4 is covered); slices reuse it |
| Nothing that exists may change | 3c principles: «nada que já existe pode mudar (versões congeladas, operações, dias)» | No pairing against earlier imports (banco §2.2), no backfill, fingerprints and proofs in the paste kit |
| Board before code | 3c: «quadro antes do código»; 2b practice (scoping Q5) | Board revision and approval before 3b-3 (D1) |
| 3b before Phase 4 | Memory, 2026-10-21: he asked for 3b first, then the Diário; and `fase3/decisoes.md` order «… → 3-4 Mercados novos → 3b importação por colunas» | — |
| New-market trades, currency, day clocks | 2b (CLAUDE.md and memory): trades come from Registrar and then the column import; money in the market's currency (B3 R$, others US$, USDT/USDC as dollars); accounts in different markets never summed; day clocks per market | Per-market copy in `c`/`d`, no conversion (C11), `not_dollar_quote` |
| B3 series as roots | Phase 3 answers 2026-10-20: «reconhecer o código de série como a raiz (WINZ26 → WIN, calculado)» | Mapped B3 symbols compute and link with no new rule |
| One live database, no test project | Owner, 2026-10-16 (memory) | Paste kit with proofs, undo kit, replay on a live-shaped cluster (§2.4) |
| Imports go straight in | Phase 1 (project memory, cited by the scoping header): no review queue; undo also deletes the batch's marks | Preview → commit, no queue; undo as built |
| CSV only | Phase 1 as built: drop zone «CSV» (ADAPTED from «CSV, Excel ou HTML», estado §3.2) | Excel is refused with a message (scoping Q11 is covered; a new library would need his OK) |
| Commission unknown ≠ zero | Phase 1/2 rule, as built (estado §2.9): null = unknown; the limit counts net when known | «Informe por contrato» is dropped (quadro Q12) |

---

## 5. Accepted defaults (proposed)

### 5.1 Flow and screens (3b-3)
- **D1** The board revision comes before the screens, with scenarios 8, 15–19 and 9 (§2.3) (scoping Q5, quadro Q13 (a)).
- **D2** No stop at «Colunas prontas». The model is saved when the import commits (scoping Q4 (b)).
- **D3** Without an account in context, «Para qual conta?» comes first, grouped by market (quadro Q14 (a)).
- **D4** Columns are pre-filled from their names. The tag «sugerida» shows on pre-filled rows, and «Já sugerimos pelo nome
  de cada coluna. Confira.» (proposal) shows once (quadro sc. 8).
- **D5** Value checks under a select: «Esta coluna não parece data e hora.» / «… número.» / «… compra e venda.»
  (proposals). «Continuar» stays disabled with «Confira as colunas marcadas.» (proposal).
- **D6** The net question is shown when «Resultado» and at least one cost column («Comissão», «Outra taxa», «Swap ou
  funding») are mapped (R8):
  - commission and fees only: «O resultado do arquivo já desconta a comissão?» (as the scoping);
  - swap too: «O resultado do arquivo já tem a comissão e o swap?» (proposal); swap only: «O resultado do arquivo já tem
    o swap?» (proposal);
  - pills «Sim, é líquido» / «Não, é bruto» (quadro sc. 17–19);
  - one answer `result_is_net` for every mapped cost. Stored `pnl` (Registrar's «antes da comissão, com swap») = the
    file's result + swap when gross; = the file's result + commission and fees when net (the swap is already in);
  - answered beforehand when the prices settle it (gross: result = prices; net: result = prices − costs + swap on most
    rows), and saved in the model (scoping Q3 (a), quadro Q6 (a)). A file whose result has the commission but not the
    swap, or the reverse, is not supported; D22 then warns.
- **D7** Without an exit time: «Sem hora de saída, o resultado conta no limite do dia na hora da entrada.» (proposal,
  quadro sc. 8; the database accepts a null exit).
- **D8** The minimal `h` for «Conta» (C23, R9): one value per import. The value whose number equals the destination's
  «Número na plataforma» is pre-set «Importar em {conta}», every other value «Não importar», and setting one value to
  import sets the others to «Não importar». Only accounts of the destination's market are offered. An unknown account
  number gets only «Importar em {conta}» or «Não importar» (quadro Q3 (a)), with «Para importar {valor}, abra a
  importação na conta dela: o que já entrou não duplica.» (proposal).
- **D9** Units and currency per market in `conferir` and `d`, from `registrarAtivos` labels and `currencyOf`. Per-market day
  lines come from `viraODia` (estado §6), e.g. «o dia de Forex vira às 17:00 de Nova York.».
- **D10** Execution files never call slices «linhas» (C24).
- **D11** Copy outside the sheet:
  - the «Ainda não lemos arquivos…» notes are dropped for mapping markets; MetaTrader keeps «O relatório do MetaTrader 5
    sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.»;
  - `fimConta` gets «Importar histórico» back;
  - Personalizar rows get «Importar» and «Importações»;
  - Registrar's «… essas operações entram pela importação por colunas, logo depois da Fase 3.» becomes «… essas
    operações entram pela importação de arquivo.» (ADAPTED);
  - `CONTAS.info` loses «em breve» (quadro S15–S17, S22).

### 5.2 Reading (3b-2)
- **D12** Sniffing:
  - delimiter `,` `;` tab;
  - decimal mark **once per file** (R6, C33), from the numeric cells of every mapped number column:
    - a cell with both marks decides by the last one («1.234,56» comma, «1,234.56» point);
    - a mark followed by other than exactly three digits decides («88,50» comma, «1.5» point);
    - the same mark twice or more is a thousands mark («1.234.567» → comma file);
    - **one mark followed by exactly three digits, with one to three digits before that do not start with 0
      («131.250», «1,234») is ambiguous** and never decides («0.250» decides point); integers are neutral;
    - deciding cells that agree settle the file; the column-level reading never overrides it;
    - nothing decides, or deciding cells disagree, while an ambiguous cell exists: ask «Como ler os números deste
      arquivo?» (proposal) with pills built from one of its own cells, read only in the browser: «“131.250” é 131250
      (ponto separa milhar)» / «“131.250” é 131,25 (ponto é decimal)» (proposal). The `;` delimiter only pre-selects the
      first pill. The answer is saved as `decimal_mark`;
    - no ambiguous cell and nothing decides (integers only): either mark reads the same, so the delimiter rule fills the
      chip;
  - title lines (up to 20 records);
  - date order over all rows. If still ambiguous, ask «Datas em dia/mês ou mês/dia?» (proposal), saved as `date_order`.
  - A later file under a model whose deciding cells contradict the saved `decimal_mark` reopens `mapa` with the question.
- **D13** Numbers (`parseNumLocale` inside `lib/domain`):
  - accepted: `$`, `US$`, `R$`, a currency suffix, the Unicode minus, `(39,98)` as negative, thousands grouping;
  - refused: `%` (never money), scientific notation, two signs.
- **D14** Dates: the formats of banco §5.4 (DMY, MDY with AM/PM, two-digit years, `.`/`-` separators, ISO with or without
  offset, IBKR `YYYYMMDD;HHMMSS`, English month names, epoch seconds or milliseconds as UTC). Separate date and time
  columns stay out (C15).
- **D15** Sides:
  - the vocabulary of banco §5.4 plus `BOT`/`SLD`;
  - unknown words asked once and saved;
  - a signed quantity counts as the side;
  - a header naming the *closing* side is caught by the sign check `sign((exit − entry) × side) ≠ sign(result)` on most
    rows → «O lado parece ser o da saída. Inverter?» (proposal, formatos §5.3).
- **D16** Symbols: futures normalised and stored (C10); OCC detected and refused (C8); crypto outside the dollar refused.
- **D17** Header-borne clocks per C20. A file mixing rows with and without an offset is refused only in execution mode
  (`mixed_clocks`).
- **D37** Detection after the account (R5, C28): near-complete means at most two of the reader's names missing (Top
  One: 12 of 14; Ebinex: 11 of 13), or all found with one repeated.

### 5.3 Money
- **D18** The file's «Resultado» wins (stored `'file'`). In execution files, a mapped «Resultado realizado» wins the same
  way (R7, C30). Without it, the result comes from prices where the instrument table computes (`'prices'`, or `'estimate'`
  for USD-base forex), recomputed by the database. Otherwise the row errors with «Sem resultado: este ativo não tem conta
  pelos preços. Marque uma coluna de resultado.» (proposal, `no_price_result`).
- **D19** `trades.pnl` stays gross. A net column is converted with the row's (or slice's) commission. The daily limit keeps
  counting net (Phase 2 rule).
- **D20** Commission is the absolute value, in cents, summed over «Comissão» and every «Outra taxa» column (C4). Null means
  unknown, never zero.
- **D21** «Swap ou funding» per C3 and D6.
- **D22** When the stored result minus the swap (R8) and the computed prices disagree by more than one cent: the warning
  `result_differs_from_prices` «{n} com resultado diferente do calculado pelos preços: vale o do arquivo.» (proposal). In
  execution files the check runs per closing fill (R7).

### 5.4 Keys and duplicates (3b-1)
- **D23** The synthetic key and the `'same'` fallback, per banco §7. Times in the tuple are the UTC instant for rows
  with an offset and the wall clock for the others, tagged so the two never collide, on both sides of the fallback (R12).
  Identical rows in one file keep distinct keys (`.n`), so nothing is lost and a re-import is `dup`. **With an exit
  time they fold into one trade with one exit per row, the size adding up, as 3c folds Top One's rows of one position
  (R14, C31); without an exit time they stay two trades.** Notice (proposal): «{n} linhas iguais a outra do arquivo
  (mesma hora, ativo, lado, quantidade e preços) viraram uma operação com várias saídas, como nas saídas parciais.» The
  count reads «já estavam (mesma hora e preço)» when no ID is mapped (ADAPTED from IC l.429 «Mesmo ID, ou mesma hora e
  preço, é reimportação, nunca cópia.»).
- **D24** No `notes` for `'modelo'` in the four writers. Ebinex and Top One are unchanged.
- **D25** «Em outra conta» per C5.

### 5.5 Execution files (3b-4)
- **D26** FIFO per symbol as written (after normalisation), so MESZ6 and MESH7 never pair. Each entry fill is a lot (C2).
  Fills of one order ID, or of the same second, side and symbol, merge first. A fill passing zero opens the other side.
- **D27** Leftovers and files that start mid-position (R1, P3 (a)):
  - **With «Abre ou fecha» mapped** the start of the file is checked (banco §6.4): a closing fill with nothing to close is
    `opened_before_file`, and a lot still open at the end stays out **whole** (`open_at_end`) with «{n} execuções de
    posições ainda abertas no fim do arquivo ficaram de fora. Elas entram quando você importar um arquivo que tenha a
    abertura e o fechamento.» (proposal).
  - **Without it** (Tradovate Orders, Rithmic, Binance spot…) the file cannot tell a position still open at the end from
    one opened before its start. If the true start was long 1, every later fill of that symbol pairs one contract off,
    and only the last lot shows it. So, after pairing and after the «Resultado realizado» guard when it is mapped, each
    symbol whose computed position at the end is not zero (N) gets one NEW question in `conferir`: «No fim do arquivo,
    {ativo} ficou posicionado?» (proposal from the review), with «Pelas execuções do arquivo, sobram {|N|} {unidade}
    {compradas|vendidas}.» (proposal) and the pills:
    - «Sim, ficou posicionado»: the file is taken to start flat. The pairing stands, and the open lots stay out
      (`open_at_end`);
    - «Não, terminou zerado»: the file began with {|N|} on the other side, opened before it. That lot is seeded first,
      the fills that close it stay out (`opened_before_file`), and the rest pairs from there;
    - «Não sei» (**pre-selected**): every execution of {ativo} in the file stays out (`unbalanced_symbol`): «As {n}
      execuções de {ativo} ficaram de fora: as compras e as vendas do arquivo não fecham.» (proposal).
  - The answer belongs to this file and is never saved in the model.
  - A symbol whose computed position ends at zero is taken as flat at both ends. In files without «Abre ou fecha»
    `conferir` says once «Supomos que o arquivo começa sem posição aberta.» (proposal, `flat_start_assumed`).
  - Remaining risk (§7.2): a position held across both ends of the file pairs falsely, undetected; a wrong «Sim» or
    «Não» mis-pairs that symbol; and a position that spans two exports enters only through an export holding both its
    opening and its closing. Rithmic exports one day per file, so its overnight positions never enter by file.
- **D28** Slice commission is pro rata, split exactly per fill by largest remainder. The realized result of a closing
  fill (gross after D19, with its slices' commissions) is allocated over its slices (R7): where the instrument computes,
  each slice gets its price result plus a share, by quantity, of the difference between the file's total and the
  computed total; where it does not compute, by quantity alone. That is a stated limit: two lots of different entry
  prices closed by one fill then share the result evenly per contract. Either way, the closing fill's total is exact
  (largest remainder, cents).
- **D29** Slice keys are `fill_open>fill_close` when it fits in 64 characters, else the synthetic key.
- **D36** Unfilled orders (R2, C27): in execution mode, a row whose executed quantity is 0 or blank is skipped and
  counted in the notice «{n} ordens sem execução ficaram de fora.» (proposal, `unfilled_orders`). It is not an error and
  is not sent. A row with an executed quantity and no price is `missing_price`. Name suggestions in execution mode prefer
  «Filled Qty», «filledQty», «Qty Filled», «Executed», «Quantidade executada» over «Quantity»/«Qty»; «Avg Fill Price»,
  «avgPrice», «Fill Price», «Preço médio» over «Limit Price»/«Stop Price»; «Fill Time», «Update Time», «Exec Time»,
  «DateTime» over «Timestamp», «Create Time», «Order Time», «Date». `conferir` adds the R2 note on fill time and
  executed quantity.

### 5.6 Models, zone and limits
- **D30** Models: one per user and header set, at most 50. They hold choices and header names, never a cell value. A
  «Conta» value is stored hashed, and every route of a model points to accounts of one market (R9). An exact set applies
  the model; a set with at least 60 % of the names in common pre-fills `mapa` with «Este arquivo mudou desde o modelo
  “{nome}”. Confira as colunas.» (proposal). «Atualizar o modelo “{nome}”» (quadro sc. 15, checked) re-keys that model
  to the new header set through `p_replaces` (R13, C32); unchecked, the old model stays and the new set is not saved
  («Colunas usadas só neste arquivo.»). No list (C7).
- **D31** Zone per C6 and G2 (R4): a mapped file never opens `conf`.
- **D32** Limits: 5 MB, 10 000 records (5 000 if C26 trips), 100 columns, 64-character IDs not starting with `@`, 50
  models, a 16 KB model payload.
- **D33** Errors keep the as-built privacy rule: a line, a code and our field name, never a cell value. The side-word
  question reads the value in the browser only.

### 5.7 Tests and docs
- **D34** SQL `82_` (C9). Shared `cases3b.json` is recorded from the SQL. Jest uses invented fixtures, including the Top
  One header mapped by hand as a golden test against the built-in reader. The review adds (all invented): a WIN file
  with «131.250» beside «88,50» and one with prices only (R6); a generic closed-position header in a Forex account (R5);
  a Tradovate-shaped Orders file with cancelled bracket legs and a partly filled order (R2); a file starting long 1 with
  no guard columns, answered each of the three ways (R1); a realized column against prices on a two-lot close (R7);
  cTrader-shaped Gross/Net with Swap (R8); and in SQL: G1 by format, a plain re-import with no G1 count, two mapped
  formats in one account, the G2 refusal on an unconfirmed account holding Top One wall-clock trades, the `'same'`
  fallback for offset rows, and `p_replaces` (R3, R4, R12, R13). Regression stays green unchanged: `20`, `30`,
  `40` (+ `mapping`), `50`, `60`, `70`, `80`, `81`, `cases3c`, `registro/cases`, `gate/cases`, `ImportSheet.test.tsx`,
  `legacyImport.golden.test.ts`. No new API route, so `routesRequireAuth.test.ts` is unchanged.
- **D35** CLAUDE.md layout (G3) is corrected in 3b-2.

---

## 6. Gaps found during the synthesis

- **G1 · The same trades from two formats in one account duplicate (NEW).**
  - **Mechanism:**
    - keys are `(account_id, source_platform, external_id)`;
    - links reach only trades with a `trade_entry_context` and no broker ID (estado §2.5);
    - the `'same'` fallback compares only against `'modelo'` trades (banco §7.3).

    So a Tradovate or BlackArrow file of the Top One account, sent into the account that already holds the Top One Trade
    History imports, inserts every trade a second time. The board draws scenario 8 exactly so (C17).
  - **Default (revised by R3):**
    - **The file's format.** For a mapped file it is its header signature, sent as `p_format = {"sig": …, "template":
      id | null}` (NEW trailing parameter of `import_preview` and `import_commit`). `import_commit` stores the
      signature on **every** mapped batch (`import_batches.header_sig`, NEW), with or without a saved model. For a reader
      file it is the platform.
    - **Same format** as a batch `b`: `b.platform = p_platform`, and for `'modelo'` also `b.header_sig = sig` or
      `b.template_id = template`. The model clause keeps a file under an updated model («Atualizar o modelo», R13) the
      same format as the batches the model made before.
    - A NEW preview key `other_source`, present only when greater than 0: the trades the file **would insert** (positions
      on the path `row`/`group` with no link: the `trades_new` unit) whose trading day already holds a `source =
      'import'` trade of this account whose batch (`trades.import_batch_id`) is of another format. Rows already in the
      account, linked rows and attached exits never count, so a plain re-import of the same file never warns.
    - The line «{n} operações caem em dias em que {conta} já tem operações de outro formato de arquivo. Se forem as
      mesmas na corretora, elas vão se repetir.» (proposal) above the primary, which does not change. The line shows
      for reader files too, in either direction.
    - Nothing is skipped automatically.
  - **Limit:** a broker that renames columns without a model update («Atualizar o modelo» unchecked) counts as another
    format, so the warning may show for new trades of that export. It is a warning, never a block.
  - **Owner question P4** (automatic skip vs warning vs one format per account).
- **G2 · A new format read silently on the account's clock (NEW).** As built, `needsZoneStep` is true only when the
  account's zone is unconfirmed (estado §3.3). A mapped file into an account already confirmed by another format would
  therefore skip `c`, and the hours would be placed on the other format's clock.
  - **The second hole (R4).** Legacy batches never set `tz_applied_at` (the backfill, `20261017000003:45–57`). In such an
    account, `import_tz_status` answers `tz_not_confirmed` for a different zone (`20261020000004:121–136`). The as-built
    flow then opens `conf`, whose `import_fix_tz` re-places **every** imported trade with a wall clock and its day
    (`20261023000003:2204–2285`), whatever its `source_platform`. A mapped file picked in another zone would move the
    Top One trades of the account. Scenario 8's own context (Top One #1) could be such an account.
  - **Default:**
    - show `c` when the file has offset-less rows and the model is new or has no `tz_hint`. Preselect the account's
      zone when it is confirmed, **or** when the account already holds imported trades without an offset;
    - for `p_platform = 'modelo'`, `import_preview` and `import_commit` turn `tz_not_confirmed` into `tz_mismatch`. In
      such an account, any zone other than `file_tz` is refused, and a mapped file never opens `conf`. A plain
      «Confirmar fuso» from Importações stays as built;
    - a different choice gets `tz_mismatch` («Este fuso é diferente do fuso confirmado da conta.») plus «Este arquivo usa
      outro relógio que o das importações de {conta}. Confira o fuso na plataforma.» (proposal). In an unconfirmed
      account the first sentence is ADAPTED to «Este fuso é diferente do fuso das importações desta conta.» (proposal);
    - the commit then confirms `file_tz` as built. Nothing moves, because the zone is the one the account's trades
      already use.
  - Later files of the model skip `c` when its `tz_hint` equals the account's zone.
- **G3 · CLAUDE.md is stale on the import path.** It says the import path lives in `app/lib/utils/`. The live path is
  `app/lib/domain/import` (estado §1.1). `lib/utils` holds only the frozen legacy readers used by the parity tests. Fixed in
  3b-2, which also adds `lib/domain/import/mapped/` to the layout.

---

## 7. Risks

### 7.1 Existing data must not change
- **Replaced functions** (`import_checked_rows`, `import_preview` and `import_commit` dropped and re-created, the last
  two with `p_format`; `import_stage`, `import_link_patch`, `import_exits_link`, `import_check_platform`):
  - the Ebinex and Top One outputs must stay identical: same codes, same counts, `notes` still written, `pnl_basis
    'file'`;
  - proved by the unchanged suites `20_phase1`, `50_phase3`, `60_import_counts` and `81_parciais` on the new functions;
  - a golden replay inside the migration is impossible (it needs `auth.uid()`; banco §15.1);
  - the paste kit's replay on a live-shaped cluster.
- **Proofs in the migrations:**
  - fingerprints of `trades`, `trading_accounts`, `account_rule_versions`, `trade_entry_context`, `trade_marks`,
    `trade_import_links`, `import_batches` (minus the new columns), `profiles`, `trade_exits` and `trade_stop_moves`;
  - every `trade_state`;
  - every account's resolved rules and «Posso operar hoje?» (3c's `tx_gate`);
  - `market_caps_all()` minus `mapping` equal to the old literal key by key;
  - nothing with `'modelo'` and an empty `import_templates` after the paste.
- **The platform check swap** reads the old definition by name and stops if it differs. The existing batches revalidate
  (all are `ebinex`/`topone`).
- **Old app against new functions:** the payload is read with `jsonb_to_recordset`, so missing keys are null and a null
  `pnl_basis` reads as `'file'`. `import_preview` and `import_commit` are dropped and re-created with a trailing
  `p_format jsonb default null` (R3): PostgREST calls name their arguments, so today's calls without it resolve to the one
  function and get the as-built answers (`other_source` is absent while it is 0, and it is 0 until a second format
  exists). `p_format` is required only for `'modelo'` (`bad_format` otherwise). The paste kit reloads the PostgREST schema
  cache. Deploy order: paste, then app (§2.4).
- **Undo:** `import_undo` is unchanged for every platform. The undo kit restores from `backup_fase3b` and refuses to run
  once `'modelo'` data exists.
- **Nothing reaches back:** no pairing against earlier imports and no backfill. The four `notes` writers are conditional
  only for `'modelo'`.

### 7.2 Product risks
- **A wrong mapping imports wrong money silently** (a `%` column, a net column read as gross, a lot-versus-units column in
  forex, 100 000×). Mitigations: value checks (D5); the net question pre-answered from prices (D6);
  `result_differs_from_prices` (D22); the `conferir` units; the preview totals; «Desfazer».
- **G1 duplicates** if the owner imports after the warning. Undo removes them.
- **Execution files without «Abre ou fecha» (R1).** A file that starts mid-position would pair every later fill of that
  symbol wrongly, not just one cycle. The end-of-file rule (D27) catches it whenever the symbol's buys and sells do not
  close, and by default leaves the whole symbol out. What remains:
  - a position held across both ends of the file (it starts and ends at the same non-zero level) pairs falsely,
    undetected;
  - a wrong «Sim» or «Não» to the end-of-file question mis-pairs that symbol;
  - a position that spans two exports enters only through one export holding both its opening and its closing, so
    Rithmic's overnight positions (one day per export) never enter by file.

  `conferir`'s first trades and «Desfazer» are the last line of defence.
- **Commission unknown for Tradovate Orders (R15).** The file has none, so its trades keep a null commission and the
  daily limit counts them gross. Registered trades keep the «Custos» he typed (a link writes only the money the file
  states).
- **Scale-ins count as several trades** (C2): win rate and trade counts read per entry.
- **Synthetic keys drift** with time precision, rounding or symbol-format changes between exports. Only an ID column is
  fully robust, so `conferir` recommends mapping one when the file has it.
- **Other-currency rows** (no «Moeda» field, C11) are stored as the account's currency. An inverse crypto contract written
  `BTCUSD` computes linearly, the same gap as in Registrar.
- **Option rows without OCC symbols** in a stocks file are stored as stock ×1. `conferir` shows the symbols.
- **A «Conta» file needs one import per account (R9).** One value goes in per import; the others wait for their own
  import. Nothing is lost, and what already entered never duplicates.
- **The realized result of a closing fill that closes several lots** is shared by quantity where the instrument does not
  compute (D28). The fill's total is exact; the split between the trades is not.
- **The 8 s statement timeout** at 10 000 rows is unmeasured (C26).
- **The DST repeated hour** can order fills of the same hour wrongly. CME is closed then, and crypto files are UTC.
- **Public repository:** fixtures are invented. A header line from the owner is used as names only, and no row is ever
  committed.

---

## 8. Review of 21 Oct: fixes

Each problem was checked against the repo at `3f439f8` (read-only) and the specs. All sixteen hold. "Refined" means the fix
goes beyond the review's wording, for the reason given.

| R | Problem (review) | Verdict | Fix | Where |
|---|---|---|---|---|
| R1 | A file starting mid-position mis-pairs every later fill of the symbol (HIGH) | Holds. With no «Abre ou fecha» and no realized column, a true start of long 1 shifts every pairing by one contract, and only the last lot is dropped. The old P3 (a) promise («entra inteira quando um arquivo mais novo mostrar a posição fechada») is false: a newer file that lacks the opening starts mid-position itself | The end-of-file rule: without «Abre ou fecha», a symbol whose buys and sells do not close is asked about. «Não sei» is pre-selected and leaves out all its fills; «Sim» keeps the pairing; «Não» seeds the pre-file lot. The P3 wording becomes «entra quando você importar um arquivo que tenha a abertura e o fechamento», and the remaining risk is stated | D27, §7.2, P3; banco §6.2, §6.4, §14, §18; quadro sc. 16; perguntas 3 |
| R2 | Cancelled and unfilled orders dropped without a reason (HIGH) | Holds: formatos had «Situação» and the skip rule; banco and the synthesis lost both | Rows with executed quantity 0 or blank are skipped with «{n} ordens sem execução ficaram de fora.», never as errors. Suggestions prefer the executed quantity, the average fill price and the fill time. `conferir` notes that the time must be the fill time. «Situação» is dropped with its reason (C27) | C27, D36, §1.1; banco §4.4, §6.2, §14; formatos §4.2, §6.3; quadro sc. 16 |
| R3 | G1 blind between mapped formats; fires on re-imports (MEDIUM) | Holds: every mapped batch is `'modelo'`, and the count took every valid row | The format is the header signature, stored on every mapped batch (`import_batches.header_sig`) and passed as the new `p_format`. A batch of the same model counts as the same format. Only trades that would be inserted count | G1, §1.1, §2.2, §7.1; banco §3.6, §4.1, §12 |
| R4 | G2 misses an unconfirmed zone; `conf` would move his real trades (MEDIUM) | Holds: legacy batches never set `tz_applied_at`, `import_tz_status` then answers `tz_not_confirmed`, and `import_fix_tz` moves every wall-clock import of the account | For `'modelo'`, `tz_not_confirmed` answers `tz_mismatch`: a mapped file never opens `conf`, and `c` preselects the account's zone | G2, C6, D31; banco §8 |
| R5 | Built-in detection blocks whole families of files (MEDIUM) | Holds: 8 of 14 Top One names give `missing_columns` (`detect.ts:76–81`) | Decide after the account: `erro` only in the reader's market and near-complete (at most two names missing); otherwise `mapa` | §1.1, C28, D37; banco §4.6 |
| R6 | The decimal check misreads «131.250» (MEDIUM) | Holds: banco's point pattern reads 131.25, and the column-versus-file rule was unclear | Refined: one decision per file from deciding cells only. A lone group of three digits after one mark is ambiguous. Repeated groups («1.234.567») and «0.250» do decide (the review's `\d{1,3}([.,]\d{3})+` would have called the repeated case ambiguous). Ask when nothing decides; add WIN fixtures | D12, C33, D34; banco §5.3; quadro sc. 19 |
| R7 | Execution files contradict "the file wins" (MEDIUM) | Holds (banco §6.3 against D18 and banco §14's copy) | A mapped «Resultado realizado» wins (net → gross, basis `'file'`); the prices only check. Refined: a closing fill that closes several lots shares its result by price result plus a quantity share of the difference, not by quantity alone, which would move money between trades whenever the lots' entry prices differ | D18, D22, D28, C30; banco §6.3, §9.1 |
| R8 | Swap counted twice, and false warnings (MEDIUM) | Holds: a net result already holds the swap, and D22 compared the result with the swap against the prices | The net question covers every mapped cost, swap included («O resultado do arquivo já tem a comissão e o swap?»). Gross gets the swap added; net gets only the commission back. D22 compares the result minus swap | C3, D6, D21, D22; banco §4.1, §9.1–9.2; quadro sc. 18 |
| R9 | The «Conta» split is under-scoped and contradicts the board spec (MEDIUM) | Holds | One value per import, accounts of the destination's market only. The multi-batch commit is deferred. Model routes point to one market | §1.1, §1.2, C29, D8, D30, §2.3; banco §2.3, §4.5; quadro sc. 17 |
| R10 | P1's reason is unsourced (MEDIUM) | Holds: LuxAlgo lists ProjectX and Quantower for Top One Futures; the board (IC l.635) lists Tradovate, NinjaTrader, TradingView, BlackArrow and WealthCharts. The sources disagree | P1 asks which futures accounts outside Top One he has or will have, with ProjectX and Quantower among the examples. The claim is dropped; P1 is factual, with a fallback instead of a recommendation | P1; perguntas 1 |
| R11 | P2 explains pairing the wrong way (LOW) | Holds: «de zerado a zerado» is the averaging that C2 rejected. quadro sc. 16 has the same note | Rewritten per C2 in perguntas 2 and in quadro sc. 16's note | perguntas 2; §2.3; quadro sc. 16 |
| R12 | The `'same'` fallback cannot match rows with an offset (LOW) | Holds: offset rows store no wall clock, while the key hashed wall clock plus offset text | Times in the tuple: the UTC instant for offset rows, the wall clock for the others, tagged, on both sides | D23; banco §7.1, §7.3 |
| R13 | «Atualizar o modelo» creates a second model (LOW) | Holds | `import_template_save(…, p_replaces)` re-keys the named model | D30, C32; banco §4.5; quadro sc. 15 |
| R14 | «Duas linhas idênticas … entram as duas» is inaccurate (LOW) | Holds: 3c's `grp` folds them into one trade with two exits | The copy says so; the 3c rule is kept on purpose | D23, C31; banco §7.2; perguntas defaults |
| R15 | Commission quietly lost for the first target (LOW) | Holds | Said plainly in perguntas 2 and in §1.2 and §7.2 | perguntas 2 |
| R16 | The test plan assumes his Forex and B3 accounts are test accounts (LOW) | Half right: memory says those accounts were made during his 2b test, but not that they hold no real trades | Default: «Apex #1» plus two throwaway accounts, archived at the end, unless he says the 2b accounts are test accounts | §2.5; perguntas defaults |

Effort: +1.5 days (§2.2). The largest items are R1, R3 and the questions of R6 and R8. R9 takes back a little.

---

## Open questions for the owner

The pt-BR version, in plain words, is `perguntas.md`. Each question is listed here with the recommendation.

**P1 · Which futures accounts outside Top One does he have or plan, on which platforms, and in which other markets?**
Factual (R10), so there is no recommendation, only a fallback.
- (a) He names them: futures platforms (Tradovate, NinjaTrader, Rithmic, ProjectX/TopstepX, Quantower, BlackArrow,
  WealthCharts…) and the brokers of other markets. The first file named becomes the first fixture and the drawn variant.
- (b) None for now. **Fallback:** public formats and invented files, with Tradovate Orders first, because it is the
  board's own hint (IC l.1025). MES and MNQ results compute from prices, so the test can be checked by eye.

Either way: if possible, the first line only of one export (column names, no trades). A second format into Top One #1 is
exactly the P4 case.

**P2 · Execution files (one buy or sell per row) in 3b?** Pairing per C2: each buy that opens or adds to the position is
its own trade, and sells close the oldest buys first. Tradovate's Orders file has no commission: those trades keep an
unknown commission, so the daily limit counts them gross (R15).
- (a) Yes, as the last part of 3b, +3.5–4 days. **Recommended:** without it, the mapping cannot read Tradovate or Rithmic.
- (b) Only one trade per row in 3b; executions later.
- (c) Dedicated readers per platform instead of the generic mode.

**P3 · An execution file whose buys and sells of a symbol do not close by its end** (R1). Without an open/close column,
a position still open at the end and one opened before the start look the same.
- (a) Ask once per such symbol, «No fim do arquivo, {ativo} ficou posicionado?». «Sim» keeps the pairing and leaves the
  open part out. «Não» treats the start as opened before the file and leaves out its closing fills. «Não sei»,
  pre-selected, leaves out every fill of that symbol. **Recommended:** nothing half-made or invented enters, and the
  common cases are recovered with one click.
- (b) Never ask: every such symbol stays out whole.
- (c) Refuse the whole file.

The earlier option "import the closed part now, complete it later" is dropped, because a later file without the
opening starts mid-position itself (R1). In every option a position enters when one file holds both its opening and
its closing.

**P4 · The same trades from two formats in one account** (G1, R3).
- (a) The preview warns how many trades it would insert on days that already hold trades of another file format, and he
  decides. A re-import of the same file never warns. **Recommended.**
- (b) The app skips look-alikes by itself: same asset, side, quantity and price, entry within 1 minute.
- (c) One format per account: a second format is refused.
