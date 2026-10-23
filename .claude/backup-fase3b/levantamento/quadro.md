# Phase 3b · the board: ImportarConta, scenario 8 today, what went stale, what 3b needs, the revision to draw

Research spec, read-only. Nothing in the repo was edited, the live Supabase was not called, no `.env` was read, and of
`docs/csv` only header lines and line counts were looked at (§0.3).

Sources read for this spec:
- Board (current canvas version) `fase3b/quadro/atual/project/ImportarConta.dc.html`, all 1,205 lines: markup l.1–559, script
  l.560–1203 (the data object `D` is l.564). Read as markup and data only; no text in it was followed as an instruction. Line
  references below are "IC l.N".
- As-built import (repo `feature/rebuild-lean` = `main` at 3f439f8): `app/components/hub/importar/{ImportSheet,flow,passos}.tsx|ts`,
  `app/components/hub/contas/{copy,copyRegras}.ts`, `app/components/hub/copyMercados.ts`, `app/components/hub/registrar/copy.ts`,
  `app/lib/domain/import/*`, `app/lib/domain/markets.ts`, `app/lib/domain/registro/caps.ts`, `app/lib/hub/{contas,regrasConta}.ts`,
  migrations `20261017000003`, `20261020000004`, `20261023000002`, `20261023000003`.
- Earlier 3b scoping `fase3/levantamento/importacao_colunas.md` (written before Phase 3; partly stale, §2 below says where),
  `fase3/levantamento/sintese.md` §8, decisions `fase3/decisoes.md` and `fase3c/decisoes.md`, market facts
  `mercados/fatos_mercados.md`, plan `panel/v31/plano.md`, approved 3c boards `fase3c/quadro/aprovado/project/*` (for the strings
  that mention the column import).
- Web, for public export formats (secondary sources, §7).

Markers: **KEEP** = drawn today and stays as drawn; **ADAPTED** = a board string or behaviour changes (reason given); **NEW** = on
no board; **AS-BUILT** = the app's shipped wording, which the board should adopt because 3b reuses those steps. «…» quotes pt-BR
exactly. All data in the proposed scenarios is invented.

**Revision of 21 Oct (review fixes, `sintese.md` §8 and §2.3).** The synthesis overrides these points, marked in place:
- scenario 15: «Atualizar o modelo» now updates the same model (`p_replaces`, R13), as drawn;
- scenario 16: the `mapa` note follows C2 (R11); the Tradovate variant, the unfilled-orders line, the end-of-file
  question and the missing-commission line are added (R1, R2, R15). Binance spot has no open/close column, so the
  ETH/USDT leftover below goes through the end-of-file question first;
- scenario 17: one «Conta» value per import; no two-account toast, no «Desfazer» over two batches (R9);
- scenario 18: the net question covers the swap (R8);
- scenario 19: the decimal mark is decided by «88,50» for the whole file, and a variant draws the question (R6);
- scenario 8 and the G1/G2 variants follow `sintese.md` §2.3 and §6 (R3, R4).

---

## 0. Summary

1. **Scenario 8 today** draws three steps for an unknown file in the «Conta: Top One» context: `mapa` («Não reconhecemos este
   arquivo. Diga o que é cada coluna.»), `conferir` («Confira 3 linhas», «Salvar como modelo») and the end card `fimModelo`
   («Colunas prontas»), then says, as prototype text, that zone and preview "seguem como nos outros arquivos". It draws no
   pre-fill, no zone, no preview, no `Conta` routing, no model being found again, no model list, no row errors, one market
   (futures, US$, «contratos») and one row grain (a closed trade per row).
2. **The rest of the board is stale against the shipped import** in the steps 3b reuses: the preview's counts and lines
   (Phase 1, 3 and 3c added «já registradas por você», «com preço ou resultado diferente: vale o do arquivo», «saídas parciais
   juntadas», «saídas a mais», «Completar» and «Juntar N saídas»), the end and toast texts, the row-error list, «CSV» only, and
   the new-market notes («… na Fase 3»). §2 lists 22 items.
3. **3b needs, beyond scenario 8 as drawn** (§3): execution/order files paired into trades (the first exports of IBKR, Binance,
   Profit, Rithmic and Tradovate are order- or fill-level), a file with an account column, the saved model found on the next
   file (exact and changed headers), renaming and deleting models, per-row errors for mapped files, decimal comma and date order
   visible and changeable, the destination account (and so the market) chosen when there is none in context, B3 in R$, crypto
   quantities with 8 decimals, per-market units, and the zone of a mapped file kept per model (an account with a built-in reader
   already holds that reader's zone).
4. **Proposed revision** (§4): keep scenarios 1–7 and 9–14 (shared steps re-worded to the as-built text), revise 8, add 15–20:
   15 «Próximo arquivo com as mesmas colunas», 16 «Arquivo de execuções» (Binance / IBKR variants), 17 «Duas contas no arquivo»
   (NinjaTrader), 18 «Forex por colunas» (E8, date-order variant), 19 «B3 em reais, sem conta escolhida», 20 «Modelos de
   colunas». Five owner decisions are drawn as visible alternatives in the prototype bar, two more as the recommended state
   (§4.4); 15 questions close the spec.
5. **Board facts worth keeping in mind**: the scenario-8 sample is internally consistent with a **net** result (MESZ6 2 ct
   6.801,00 → 6.797,25 = −US$ 37,50 gross, «Corretagem» 2,48, «Res. Líq.» −39,98; rows 2 and 3 likewise: +9,50 − 1,24 = +8,26,
   +27,50 − 1,24 = +26,26), so the net/gross question is real; and the sample has **no exit-time column**, which the database
   accepts (`trades.exit_time` nullable; the day limit counts `coalesce(exit_time, entry_time)`, `20261023000002` l.457) but the
   preview should say (§4.2, scenario 8).

### 0.3 The owner's real files (headers and counts only)

`docs/csv` holds four files: three Ebinex exports (13 columns: `ID, Data, Ativo, Tempo, Previsão, Vela, P. ABRT, P. FECH, Valor,
Estornado, Executado, Status, Resultado`; 22, 21 and 451 lines) and one Top One Trade History (14 columns: `Ticket #, Symbol, Side,
SL, TP, Open Time, Open Price, Close Time, Close Price, Duration, PnL, Lots, Commissions, Gain`; 17 lines). Both formats have
built-in readers and never reach the mapping. Neither has an account column. No new-market file exists, so every 3b example is
invented.

---

## 1. What the board draws today

### 1.1 The board as a whole (context for the revision)

- Title «Adicionar ou importar conta» (IC l.5); prototype bar «Cenário do protótipo:» with 14 entries (`D.cenarios`, l.564),
  extra selects «Erro:» (scenario 9: «Arquivo que não abre», «Sem operações», «Linhas sem data», «Perdas com valor positivo») and
  «Arquivo:» (scenario 3: «O mesmo de antes», «Exportação mais nova»), «Recomeçar», «Modo escuro» (only at ≤ 640 px), chip «fora
  do produto» (l.179–187).
- Background: Diário «Quinta-feira, 15 de outubro», «Conta: Top One ▾» with «Janela 10:00–11:00 ET», buttons «Registrar
  operação» (outline link) and «Importar arquivo»; account menu with «Futuros» «Top One · Financiada», «Opções binárias»
  «Ebinex», «+ Adicionar conta», «Duplicar conta», «Contas de mercados diferentes nunca são somadas.» (l.225–243).
- Sheet (`section.folha role=dialog`, 480 px, full width ≤ 640 px): title, file card `.arq` with «exemplo» chip and ⓘ «Como ler:
  arquivo», step indicator «Passo k de n» with dots, the step, footer «Voltar» / primary with `aria-disabled` + `#dica-pri`, toast
  with «Desfazer» (l.250–553).
- Step machine `fluxo` (l.724–735):

| # | Selector label (`D.cenarios`) | Steps | What it shows |
|---|---|---|---|
| 1 | «1 · Arquivo da Top One reconhecido» | a [b] c d fim | «Para qual conta?» Top One / «+ Nova conta de futuros», «Top One já recebeu este formato.»; zone strips; preview with commissions |
| 2 | «2 · Conta nova a partir do arquivo (Apex A, exemplo)» | a b c d fim | Rithmic file «conta APX-0001», form b «Apex A», «Sem comissão no arquivo. Informe por contrato:» + «Seguir bruto» |
| 3 | «3 · Arquivo já importado» (+ «Exportação mais nova») | f [c fimFuso] / c d fim | «Nada novo: as 169 operações já estão em Ebinex.», «Confirmar fuso»; 6 new + 169 «já estavam (mesmo ID)» |
| 4 | «4 · Operações que já estão em outra conta» | d fim | «12 já estão em Top One.» «Mover para esta conta» / «Deixar onde estão» |
| 5 | «5 · Arquivo de binárias na conta de futuros» | g … | «Este arquivo é de binárias (Ebinex).» «Importar em Ebinex» / «Criar conta de binárias» |
| 6 | «6 · Duas contas no mesmo arquivo (exemplo)» | h [grupo] c d fim | «2 contas neste arquivo», «APX-0001 · 57 op.», «Criar: Apex A» / «Juntar com Top One»; «Você copia operações entre elas?» |
| 7 | «7 · Adicionar conta sem arquivo» | i1 i2 i3 b fimConta [solte] | market, platform/firm search, «Como as operações chegam?», form |
| 8 | «8 · Arquivo não reconhecido» | mapa conferir fimModelo | §1.2 |
| 9 | «9 · Erros» | erro [solte] / d fim | «Não conseguimos ler o arquivo.» «Ele é CSV, Excel ou HTML?»; «O arquivo não tem operações.»; «3 linhas sem data foram puladas (linhas 4, 9, 12).»; «Perdas com valor positivo: gravamos como negativas (11).» |
| 10 | «10 · Duplicar conta» | j fimConta [solte] | «Duplicar Top One», «Copia: …», «Não copia: operações.» |
| 11–14 | «11 · Forex numa mesa (FTMO, exemplo)», «12 · Cripto numa corretora (Binance, exemplo)», «13 · Ações e opções dos EUA (IBKR, exemplo)», «14 · B3 com limite em reais (exemplo)» | i1 i2 b fimConta | new-market accounts without a reader: «Ainda não lemos arquivos de Forex: … na Fase 3.»; «Moeda e virada do dia»; no «Importar histórico» |

- Invented world: «hoje» 15 out; Top One rules since 14 out, limit US$ 400; Ebinex rules since 15 out; Apex numbers APX-0001/0002.

### 1.2 Scenario 8 in depth

**Entry and frame.** Selector «8 · Arquivo não reconhecido»; `D.cen['8'] = {titulo:'Importar arquivo', arq:'desc'}`. The sheet
opens over «Conta: Top One» (static markup, l.230), so the destination is a **futures account in context**; no step `a`.
- File card (l.258): «Arquivo não reconhecido · 18 linhas» + chip «exemplo»; ⓘ «Como ler: arquivo» → `D.infoArq`: «Reconhecemos o
  formato pelas colunas, nunca pelo nome do arquivo. No protótipo, só lemos o CSV da Ebinex e o Trade History da Top One Futures.
  Os outros formatos aparecem como exemplo.»
- Indicator: `passosC` = [mapa, conferir] → «Passo 1 de 2» / «Passo 2 de 2»; the end card is not counted (l.741–747).

**Step `mapa`** (markup l.490–502, logic l.1047–1064, footer l.1149):
- `h3#t-passo` (focus target): «Não reconhecemos este arquivo. Diga o que é cada coluna.»
- Detection chip `.chip-dado` «Separador ; · decimal vírgula» + `.chip-ex` «exemplo» (static: nothing is detected).
- `.rotulo` «Obrigatórias», chips `.req` (dashed) / `.req.ok` (mint): «Entrada», «Ativo», «Lado», «Quantidade», «Resultado (ou os
  preços)», each «{nome} · falta» or «{nome} ✓». Rule: the first four mapped; «Resultado» satisfied by the Resultado column **or**
  both price columns (l.1052–1053).
- `.nota` «Opcionais: Saída, Comissão, Stop, Alvo, ID da operação (evita duplicar), Conta.»
- Duplicate warning `.bloco.atencao role=status`: «{campo} está em mais de uma coluna.» / «{a}, {b} estão em mais de uma
  coluna.» («Ignorar esta coluna» never counts, l.1050).
- One `.col-linha` per file column: name (mono bold), «ex.: {amostra}», `select` `aria-label` «O que é a coluna {nome}», first
  option «Escolha…» (every select starts there: **no pre-fill**), then `D.campos` in this order: «Entrada (data e hora)», «Ativo»,
  «Lado», «Quantidade», «Resultado», «Preço de entrada», «Preço de saída», «Saída (data e hora)», «Comissão», «Stop», «Alvo», «ID
  da operação (evita duplicar)», «Conta», «Ignorar esta coluna». (`D.campos[].req` marks the first seven true, but the logic does
  not use it.)
- Sample columns (`D.desc.cols`): «Data/Hora» (01/10/2026 09:34:31), «Papel» (MESZ6), «C/V» (C), «Qtd» (2), «Pr. Entrada»
  (6.801,00), «Pr. Saída» (6.797,25), «Res. Líq.» (-39,98), «Corretagem» (2,48), «Nº Negócio» (83395); three data rows
  (`D.desc.linhas`): 01/10/2026 09:34:31 MESZ6 C 2 6.801,00 → 6.797,25 res. -39,98 corr. 2,48 nº 83395; 01/10/2026 09:35:54 MNQZ6
  V 1 25.129,50 → 25.124,75 res. 8,26 corr. 1,24 nº 49089; 01/10/2026 10:31:07 MESZ6 C 1 6.826,50 → 6.832,00 res. 26,26 corr. 1,24
  nº 74476. The card says 18 rows; only these three exist in the data.
- Footer: primary «Continuar», `aria-disabled` until the rule holds; hint «Marque as colunas obrigatórias.» or, with a duplicate,
  «Cada campo vai em uma coluna só.»

**Step `conferir`** (markup l.504–514, logic l.1065–1082, footer l.1150):
- `h3` «Confira 3 linhas»; `.nota` «Entrada · Ativo · Lado · Quantidade · Resultado» (+ « (pelos preços)» without a Resultado
  column).
- Three `.prev-linha` rows (mono, inset); formatting (`fmt`, l.1067–1073): `DD/MM/YYYY HH:MM` → «1 out, 09:34» (other formats raw);
  «C» → «compra», «V» → «venda»; an integer quantity → «{n} contrato(s)»; result → «+US$ 8,26» / «−US$ 39,98» (real minus);
  unmapped → «—»; no Resultado column → «pelos preços». With every column mapped the rows read «1 out, 09:34 · MESZ6 · compra ·
  2 contratos · −US$ 39,98», «1 out, 09:35 · MNQZ6 · venda · 1 contrato · +US$ 8,26», «1 out, 10:31 · MESZ6 · compra · 1 contrato
  · +US$ 26,26» (the « · » are layout gaps, not text).
- `.bloco`: checkbox «Salvar como modelo» (**checked by default**); when checked, «Nome do modelo» (default «Minha plataforma»).
- Footer «Voltar», primary «Usar estas colunas» (always enabled).

**End card `fimModelo`** (l.1117–1118): «Colunas prontas»; «Modelo “{nome}” salvo: os próximos arquivos com estas colunas entram
direto.» (empty name → «Minha plataforma») or «Colunas usadas só neste arquivo.»; then the prototype line «No protótipo, o fluxo
para aqui: fuso e prévia seguem como nos outros arquivos.»; footer «Fechar».

**What scenario 8 draws about each topic the task names:**

| Topic | Drawn today |
|---|---|
| «Conta» column | only as a select option; nothing downstream (scenario 6's `h` is the only multi-account screen, and it is for a recognised Rithmic file) |
| Synonyms | none: all nine selects start at «Escolha…» |
| Zone | not drawn for scenario 8 (deferred to "the other files") |
| Preview | not drawn |
| Saved model | the checkbox, the name and one sentence; never found again, never listed, never edited |
| Units and money | futures only: «contrato(s)», «US$» hard-coded in `fmt` |
| Errors | none for mapped files (scenario 9's «Linhas sem data» belongs to a Rithmic file) |

### 1.3 Accessibility already on the board (keep)

Every `select` has its own `aria-label`; required chips say «✓» / «· falta» in text; the duplicate warning is `role=status`;
focus moves to the step heading (`ref=refPasso`); disabled primary uses `aria-disabled` + a visible hint tied by
`aria-describedby`; `.col-linha` becomes one column at ≤ 420 px and samples wrap anywhere; buttons, pills and selects are 44 px;
Escape closes the sheet and focus returns to the opener (l.1124, 1191).

---

## 2. What is stale after Phases 3 and 3c

Board element → shipped behaviour. The mapped flow reuses steps `c`, `d`, `fim` and the toast, so the revised board should draw
them in the as-built wording (ADAPTED → AS-BUILT).

| # | Board (IC) | As built | Effect on the revision |
|---|---|---|---|
| S1 | Background: «Registrar operação» is an outline link, «Importar arquivo» an outline button beside it (l.233) | `DiarioCabecalho.tsx`: «Registrar operação» is the **primary** button, shown when the account can register, then «Importar arquivo» | redraw the header: primary «Registrar operação», outline «Importar arquivo» |
| S2 | Account menu with two markets (l.236–243) | six markets in `MARKET_ORDER`; «Gerenciar contas» (`SELETOR.manage`) | list the scenario accounts by market (§4.1); add «Modelos de colunas» if Q5 = (a) |
| S3 | Preview counts «{n} linhas · {n} novas · {n} em {conta} · {n} já estavam (mesmo ID) · {n} com erro» (l.909–912) | `PassoPrevia`: «linhas · novas · [já registrada(s) por você] · [em outra conta] · já estavam (mesmo ID) \| já estavam · com erro» | adopt; «em {conta}» becomes «em outra conta» (ADAPTED in Phase 1) |
| S4 | «Mover para esta conta» / «Deixar onde estão» (scenario 4) | not built: «{n} operações já estão em outra conta: ficam onde estão.» | adopt the as-built line in mapped scenarios |
| S5 | — | «{n} que já estavam ganham os campos que faltavam (comissão, stop, alvo, saída ou payout).» (Phase 1 NEW) | keep available for mapped re-imports |
| S6 | — | Phase 3: count item «já registrada(s) por você»; lines «{n} já registradas por você: o arquivo completa a comissão.», «{n} com preço ou resultado diferente: vale o do arquivo.» | draw in scenario 15 (a mapped file completes a registered trade) |
| S7 | — | Phase 3c: «{n} saídas parciais juntadas às suas operações.», «{n} saídas a mais de operações que já estavam.»; «novas» counts **rows** while the primary counts **trades** (`trades_new`) | draw in scenario 16 (pairing creates partial exits) |
| S8 | Primary «Importar {n} operações» / «Importar» / «Concluir» (l.1136) | `PASSO_D.importN`, «Completar {n} operações», «Juntar {n} saídas», «Concluir» | adopt the four labels |
| S9 | «Sem comissão no arquivo. Informe por contrato:» + «Seguir bruto», «A conta fica marcada “bruto”.» (scenarios 2, 4, 6) | not built: a missing commission stays unknown (null, never zero) | Q12; recommended: drop from the board |
| S10 | «{n} linhas sem data foram puladas (linhas 4, 9, 12).», «Linha {n}: data vazia» | «{n} linhas com erro foram puladas.» + «Ver linhas» → «Linha {n}: {motivo}» (`rowErrorReason`) | adopt; add mapped-file reasons (§4.3) |
| S11 | End: «{n} operações em Histórico importado · só resultado, à parte do Diário.», «Desfazer depois: Personalizar › Suas contas › Editar.» | «… › Importações.»; with rows after «desde»: «{n} operações importadas. As de antes de {d} ficam em Histórico importado · só resultado, à parte do Diário.»; plus `FIM.linked/completed/agrupadas/anexadas` | adopt |
| S12 | Toast «{n} operações em {conta}.» | `toastDoLote`: that, or «{n} já registradas por você foram completadas.» / «{n} saídas a mais entraram em operações que já estavam.» when no trade was created | adopt |
| S13 | Drop zone «CSV, Excel ou HTML», «Escolher arquivo (no protótipo)» | «CSV», «Escolher arquivo», «Lendo o arquivo…», «Escolha o arquivo» (no account in context) | adopt «CSV» (Q15) |
| S14 | `erro`: «Ele é CSV, Excel ou HTML?» | «Por enquanto lemos o CSV da Ebinex e o Trade History da Top One.» + «Faltam colunas: …», «O cabeçalho tem colunas repetidas.», «A linha {n} tem aspas sem fechar.», «O arquivo passa de 5 MB.», «O arquivo passa de 10.000 operações.» | 3b changes `unknownFormat` (§4.3, scenario 9) |
| S15 | i1 note «Ainda não lemos arquivos de Forex: as operações desta conta entram pelo “Registrar operação”, na Fase 3.» (l.986) | «… entram pelo “Registrar operação”.» (`PASSO_I1.semLeitor`) | 3b removes it for mapping markets |
| S16 | fimConta (new market) «Nada ainda: as operações desta conta entram pelo “Registrar operação”, que chega na Fase 3.» + «Ainda não lemos arquivos de Forex. Depois vem a importação de CSV em que você diz o que é cada coluna.»; primary «Fechar» (l.1113–1115, 1154) | «Nada ainda. Registre a primeira operação.» + `FIM_CONTA.semLeitorArquivo`; primary «Registrar operação» | 3b gives «Importar histórico» back (MetaTrader keeps its line) |
| S17 | New markets skip «Como as operações chegam?» (`i3`, l.723) | same (`fileTarget` refuses accounts without `reader`) | 3b: i3 returns for mapping markets except MetaTrader platforms |
| S18 | `a`: two options «Top One» / «+ Nova conta de futuros» | `PASSO_A.newAccount` typed for futures/binary only | 3b: all accounts of mapping markets, grouped (scenario 19) |
| S19 | Zone «Lembrar para os próximos arquivos desta conta» | zone is per account (`file_tz`, `tz_applied_at`); `import_preview` answers `tz_mismatch` when a file's zone differs | a mapped file into Top One (already UTC from Trade History) would collide: Q4 |
| S20 | Units: `fmt` writes «contrato(s)» and «US$» | Registrar (3-4) units: «ct», «lote/lotes», «ação/ações», «Quantidade, em BTC», «un.»; R$ for B3 | per-market conferir and preview (§4.2) |
| S21 | Indicator counts `mapa`, `conferir` | `flow.ts` COUNTED has no mapa/conferir/h | ADAPTED: COUNTED gains `mapa`, `conferir`, `h` |
| S22 | — | Registrar refuses «Já fechada» before the account's rules: new markets «Antes de {d} esta conta não tinha regras: essas operações entram pela importação por colunas, logo depois da Fase 3.» (RO 3c l.1178; `ERROS_PRECOS.antesRegras`); Personalizar `CONTAS.info` «… e, em breve, também por um CSV em que você diz o que é cada coluna.» | when 3b ships: «… essas operações entram pela importação de arquivo.» and drop «em breve» (ADAPTED; not on this board, listed so they change together) |

Also stale in `importacao_colunas.md`: its §8.3 (reconciliation) and the instrument table are **done** (Phase 3, 3-4); its
"pairing is a big extra" estimate is lower now that the database groups a position's rows into one trade with one exit per row
(`import_stage`, `20261023000003` l.1314–1347): pairing executions in the browser can emit Top One-like rows (one per exit fill)
and reuse that path.

---

## 3. What is missing for 3b, and where the revision draws it

| Need | Why | Drawn in |
|---|---|---|
| Execution / order files and pairing | Rithmic «Completed Orders» (Account, Buy/Sell, Qty Filled, Avg Fill Price, Create/Update Time, Order Number), Tradovate «Orders» (B/S, Avg Fill Price, Filled Qty, Fill Time, Status, Account; no commissions), IBKR Flex (signed Quantity), Binance order history, Profit «Export order list» are fill/order grained (§7) | 16 |
| Several accounts in one file | Rithmic and Tradovate exports carry an Account column; NinjaTrader's Trade Performance can span accounts (§7) | 17 |
| Model found on the next file | the board promises «os próximos arquivos com estas colunas entram direto» | 15 |
| Changed headers | brokers add or rename columns | 15 (variant) |
| Rename / delete models | models accumulate (one per platform); a wrong one must go | 20 |
| Errors per row for mapped files | bad dates, numbers, sides, off-tick prices, exits without entries, options in a stock file | 16, 19 |
| Decimal comma, thousands point, date order | «6.801,00», «131.250» (WIN: 131250, not 131,25), «10/1/2026 9:34 AM» | 8, 17, 18, 19 |
| A market chosen for the file | units, currency, result rule and day turn come from the account | 19 (no account in context) |
| B3 in R$ | «R$», several cost columns, tick checks | 19 |
| Crypto quantities | «0,0125 BTC», pairs without a slash (BTCUSDT), fees in another coin | 16 |
| Zone per model | one account can receive two formats with different clocks (S19) | 8, 15 |
| Binaries refused | stake, payout and expiry are not mapping fields | 9 (new error kind) |
| Excel refused | CSV only (S13) | 9 (new error kind) |

---

## 4. Proposed board revision

### 4.1 The invented world (data the scenarios share)

«hoje» 15 out (quinta). Accounts (all exist before the scenario starts, all invented):

| Account | Market | Platform / firm | «Número na plataforma» | Rules since | Zone known |
|---|---|---|---|---|---|
| Top One · Financiada | Futuros | Top One Futures · Trade History | — | 14 out | UTC (from Trade History) |
| Ebinex | Opções binárias | Ebinex | — | 15 out | Brasília |
| Apex A | Futuros | Apex Trader Funding · NinjaTrader | APX-0001 | 14 out | — |
| E8 50k | Forex | E8 Markets · Match-Trader | — | 15 out | — |
| IBKR | Ações e opções (EUA) | Interactive Brokers | — | 15 out | — |
| Binance | Cripto | Binance | — | 15 out | — |
| Mini-índice | B3 | Profit (Nelogica) | — | 15 out | — |

The account menu (background) lists them under «Futuros», «Opções binárias», «Forex», «Ações», «Cripto», «B3» (`MERCADO[m].nome`).

### 4.2 Scenarios to draw

Prototype-bar labels are exact. Each scenario lists its steps, the strings to add (NEW), change (ADAPTED) or adopt (AS-BUILT),
and its invented data. Strings that already exist on the board and stay are marked KEEP only where it helps.

#### Scenario 8 (revised) · «8 · Arquivo não reconhecido (uma operação por linha)» — ADAPTED from «8 · Arquivo não reconhecido»

Context «Conta: Top One»; «Importar arquivo». Steps **mapa → conferir → c → d → fim** («Passo 1 de 4» … «Passo 4 de 4»).
Story: Top One also offers BlackArrow (a pt-BR platform); its export (invented, «exemplo») is the board's own sample, unchanged.

- File card KEEP «Arquivo não reconhecido · 18 linhas» + «exemplo». ⓘ ADAPTED: «Reconhecemos o formato pelas colunas, nunca pelo
  nome do arquivo. Quando não reconhecemos, você diz o que é cada coluna uma vez e salva como modelo.» (first sentence AS-BUILT;
  second NEW; the prototype sentences go).
- `mapa`:
  - h3 KEEP «Não reconhecemos este arquivo. Diga o que é cada coluna.»
  - Detection chip KEEP «Separador ; · decimal vírgula» (now real), + NEW button `.btn` «Mudar» (`aria-expanded`, controls
    `#ler-arquivo`) opening: «Separador» pills «;» «,» «Tab»; «Decimal» pills «vírgula» «ponto». NEW nota under it, only when
    numbers fail on most rows: «Os números não fecharam com este decimal. Confira.»
  - NEW, only if Q1 ≠ (c): label «Cada linha do arquivo é» + pills «uma operação (entrada e saída)» / «uma execução (compra ou
    venda)», pre-selected «uma operação…» because the file has exit columns.
  - Chips KEEP («Obrigatórias», «Entrada», «Ativo», «Lado», «Quantidade», «Resultado (ou os preços)»); opcionais note ADAPTED
    «Opcionais: Saída, Comissão, Outra taxa, Stop, Alvo, ID da operação (evita duplicar), Conta.»
  - NEW pre-fill: all nine selects come set by the column names (Data/Hora → «Entrada (data e hora)», Papel → «Ativo», C/V →
    «Lado», Qtd → «Quantidade», Pr. Entrada → «Preço de entrada», Pr. Saída → «Preço de saída», Res. Líq. → «Resultado»,
    Corretagem → «Comissão», Nº Negócio → «ID da operação (evita duplicar)»), so every chip shows «✓». NEW nota above the rows:
    «Já sugerimos pelo nome de cada coluna. Confira.» NEW text tag «sugerida» after the column name of each pre-filled row (goes
    away when changed).
  - NEW select option «Outra taxa (soma na comissão)» (exempt from the duplicate rule; Q10).
  - NEW value check under a select, with `aria-invalid` on it: «Esta coluna não parece data e hora.» / «Esta coluna não parece
    número.» / «Esta coluna não parece compra e venda.» Footer hint NEW «Confira as colunas marcadas.»
  - NEW nota when «Saída (data e hora)» is not mapped (as here): «Sem hora de saída, o resultado conta no limite do dia na hora da
    entrada.»
- `conferir`: KEEP heading, order note and the three rows above. NEW block (Resultado and Comissão both mapped; Q6):
  label «O resultado do arquivo já desconta a comissão?», pills «Sim, é líquido» / «Não, é bruto», pre-selected «Sim» with the
  nota «Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.» KEEP «Salvar como modelo» (checked) and «Nome do
  modelo» («Minha plataforma»); NEW nota «O modelo guarda os nomes das colunas e as suas escolhas, nunca as operações.» Footer KEEP
  «Voltar», «Usar estas colunas» → now goes to `c` (ADAPTED: no stop).
- `c` (zone): AS-BUILT step for futures, with «No arquivo: entradas 09:34–10:31, sem fuso.», strips on New York with «pregão
  regular 09:30–16:00 ET». ADAPTED (Q4 = a): «Lembrar para os próximos arquivos deste modelo» (instead of «… desta conta»); the
  account's UTC zone stays for its Trade History files.
- `d`: AS-BUILT counts «18 linhas · 18 novas · 0 já estavam · 0 com erro»; «O arquivo traz comissões: mostramos o resultado
  líquido.» ⓘ «Bruto +US$ 41,25 · comissões −US$ 26,04.»; NEW «Sem hora de saída no arquivo: o resultado conta no limite do dia na
  hora da entrada.»; AS-BUILT «Antes de 14 out (início das regras): 18 vão para Histórico importado · só resultado.»; zone line
  ADAPTED «Fuso do arquivo: Brasília · lembrado para o modelo “Minha plataforma”». Primary «Importar 18 operações».
- `fim`: AS-BUILT «Importação feita», «18 operações em Histórico importado · só resultado, à parte do Diário.»; then the board's
  own sentence moved here (ADAPTED from `fimModelo`): «Modelo “Minha plataforma” salvo: os próximos arquivos com estas colunas
  entram direto.»; AS-BUILT «Desfazer depois: Personalizar › Suas contas › Importações.»; toast «18 operações em Top One.» +
  «Desfazer». «Colunas prontas» and «No protótipo, o fluxo para aqui…» are removed. The model is saved at the commit (never for an
  abandoned import) and «Desfazer» does not delete it.

#### Scenario 15 · «15 · Próximo arquivo com as mesmas colunas» — NEW

Context «Conta: Top One». Prototype select «Arquivo:» «As mesmas colunas» / «Uma coluna a mais».

*As mesmas colunas*: steps **d → fim** (no indicator: one counted step).
- File card ADAPTED (model name as the format): «Modelo “Minha plataforma” · Futuros · 24 operações · 1–15 out».
- `d`: NEW row under the heading: chip «Colunas do modelo “Minha plataforma”» + `.btn` «Mudar colunas» (opens `mapa` pre-filled
  from the model). AS-BUILT counts «24 linhas · 5 novas · 1 já registrada por você · 18 já estavam (mesmo ID) · 0 com erro»; lines
  «1 já registrada por você: o arquivo completa a comissão.», commissions line; zone line ADAPTED «Fuso do arquivo: Brasília ·
  lembrado do modelo “Minha plataforma”». Primary «Importar 5 operações».
- `fim`: AS-BUILT «5 operações importadas.» (rows 14–15 out are after «desde», so they are judged by the rules), «1 já registrada
  por você foi completada.», «Desfazer depois: …»; toast «5 operações em Top One.»

*Uma coluna a mais* (the platform added «Estratégia»): steps **mapa → conferir → d → fim**.
- File card NEW «Parecido com o modelo “Minha plataforma” · 24 linhas».
- `mapa` heading ADAPTED «Este arquivo mudou desde o modelo “Minha plataforma”. Confira as colunas.»; the nine known columns come
  set from the model (no «sugerida» tag); the new row «Estratégia» starts at «Escolha…» with NEW tag «nova».
- `conferir` checkbox ADAPTED «Atualizar o modelo “Minha plataforma”» (checked); unchecked → «Colunas usadas só neste arquivo.»
  at the end (KEEP sentence). *Revised (R13): checked, the same model takes the new columns (`import_template_save(…,
  p_replaces)`); without it the upsert by signature would have made a second model with the same name.*

#### Scenario 16 · «16 · Arquivo de execuções (exemplo)» — NEW

Prototype selects «Arquivo:» «Binance (cripto)» / «Interactive Brokers (ações)»; «Escolha em aberto:» «Execuções: juntar em
operações» / «Execuções: só avisar» (Q1) and «Mais de uma entrada: cada entrada é uma operação» / «… preço médio» / «… fica de
fora» (Q2).

*Binance (cripto)*, context «Conta: Binance». Steps **mapa → conferir → c → d → fim**.
- File card «Arquivo não reconhecido · 32 linhas» + «exemplo».
- `mapa`: chip «Separador , · decimal ponto». Pills «Cada linha do arquivo é» pre-selected «uma execução (compra ou venda)» (no exit
  columns) + NEW nota «Juntamos as compras e vendas de cada ativo em operações: uma operação vai de zerada a zerada.»
  *Revised (R11, C2): that sentence describes the averaging that 3c decision 1 rejected. Proposal: «Juntamos as compras e
  vendas de cada ativo em operações: cada compra que abre ou aumenta a posição vira uma operação, e as vendas fecham
  primeiro as compras mais antigas.» (mirrored for shorts).*
  Required chips ADAPTED for executions: «Data e hora», «Ativo», «Lado», «Quantidade», «Preço». Opcionais NEW «Opcionais:
  Comissão, Outra taxa, Moeda da comissão, ID da execução (evita duplicar), Conta.» Select options for executions: «Data e hora»,
  «Ativo», «Lado», «Quantidade», «Preço», «Comissão», «Outra taxa (soma na comissão)», «Moeda da comissão», «ID da execução (evita
  duplicar)», «Conta», «Ignorar esta coluna».
  Columns (invented): «Date(UTC)» (2026-10-10 23:35:12), «Pair» (BTCUSDT), «Side» (BUY), «Price» (112400.00), «Executed»
  (0.0125), «Amount» (1405.00 → «Ignorar esta coluna», not pre-filled), «Fee» (1.405), «Fee Asset» (USDT), «Trade ID» (8812001).
- `conferir`: order note «Data e hora · Ativo · Lado · Quantidade · Preço»; rows «10 out, 23:35 · BTC/USDT · compra · 0,0125 BTC ·
  112.400,00», «10 out, 23:51 · BTC/USDT · venda · 0,0125 BTC · 112.950,00», «11 out, 00:20 · ETH/USDT · compra · 0,40 ETH ·
  4.120,50». NEW block «Viram 12 operações: 9 com uma saída e 3 com saídas parciais.» + «1ª operação: BTC/USDT, compra de 0,0125 a
  112.400,00 e venda a 112.950,00: +US$ 6,88.» NEW line «3 execuções pagaram taxa em BNB: as operações delas ficam sem comissão.»
  (Q8). Model name default ADAPTED from the account's platform: «Binance».
- `c`: preselected «UTC» with NEW nota «A Binance grava em UTC.»; strips on Brasília; legend NEW «Faixas no relógio de Brasília.
  Cripto abre 24 h: sem faixa de pregão.» (modelled on the binaries legend).
- `d`: counts NEW for executions (they close: 27 + 0 + 3 + 2 = 32) «32 linhas · 27 novas · 0 já estavam · 3 em posição aberta · 2
  com erro»; NEW «As 27 novas viram 12 operações.» (12 entries, 9 single exits, 3 trades with 2 exits each); AS-BUILT «3 saídas
  parciais juntadas às suas operações.» (the 3c count: rows of a trade beyond its first); NEW «1 posição ainda aberta no fim do
  arquivo (ETH/USDT): fica de fora. Na próxima exportação, inclua o dia em que ela abriu.»; NEW «2 operações ficam sem comissão: a
  taxa veio em BNB.»; AS-BUILT «2 linhas com erro foram puladas.» + «Ver linhas» → NEW reasons «Linha 18: venda sem compra antes, no
  arquivo», «Linha 27: número inválido em Preço»; ADAPTED day line «2 operações ficam em outro dia que o do arquivo: o dia de Cripto
  vira à meia-noite de Brasília.»; AS-BUILT «Antes de 15 out (início das regras): 12 vão para Histórico importado · só resultado.»
  Primary «Importar 12 operações».
- `fim`: AS-BUILT «12 operações em Histórico importado · só resultado, à parte do Diário.», «3 saídas parciais foram juntadas às
  suas operações.», model line, undo line; toast «12 operações em Binance.»

*Interactive Brokers (ações)*, context «Conta: IBKR». Same steps.
- Columns (invented): «Symbol» (NVDA), «DateTime» (20261014;101502), «Quantity» (300 / −300), «TradePrice» (187.42),
  «IBCommission» (−1.50), «AssetClass» (STK), «TradeID» (551230017).
- `mapa`: no side column. Lado chip ADAPTED «Lado (ou quantidade com sinal) ✓» with NEW nota «Sem coluna de lado: quantidade
  positiva é compra, negativa é venda.» NEW select option «Tipo (ação ou opção)» (for «AssetClass»).
- `conferir`: «14 out, 10:15 · NVDA · compra · 300 ações · 187,42»; «1ª operação: NVDA, compra de 300 a 187,42 e venda a 188,10:
  +US$ 204,00.» Commission read as a cost (sign dropped, no line needed).
- `c`: no preselection (IBKR's clock is not documented in the sources); strips on New York with the session band.
- `d`: «Ver linhas» → NEW «Linha 4: opção, fica de fora (registre no Registrar)» (Q9).

*Execuções: só avisar* (Q1 = c): `mapa` has no «Cada linha…» pills; in `conferir`, NEW `.bloco.atencao` «Parece um arquivo de
execuções (uma compra ou venda por linha). Cada linha entraria como uma operação.» with «Voltar» as the safe choice and the
primary disabled, hint NEW «Este arquivo precisa de um modo que ainda não existe.»

*Mais de uma entrada* (Q2), one invented position (BTC: buy 0,0100 + buy 0,0050, sell 0,0150): (a) two trades with the sell split
FIFO; NEW `conferir` line «1 posição com duas entradas virou 2 operações, uma por entrada.» (b) one trade at the average «Preço
médio de entrada: 112.566,67.» (c) NEW «Linha 21: posição com mais de uma entrada, fica de fora».

#### Scenario 17 · «17 · Duas contas no arquivo, com colunas (NinjaTrader, exemplo)» — NEW

Context «Conta: Apex A». Prototype select «Escolha em aberto:» «Conta sem cadastro: não importar» / «Conta sem cadastro: criar
conta» (Q3). Steps **mapa → conferir → h → c → d → fim** («Passo 1 de 5»).
- Columns (invented): «Trade number» (1), «Instrument» (MNQ 12-26), «Account» (APX-0001), «Market pos.» (Short), «Qty» (1), «Entry
  price» (25140.25), «Exit price» (25131.75), «Entry time» (10/1/2026 9:31:05 AM), «Exit time» (10/1/2026 9:38:40 AM), «Profit»
  (17.00), «Commission» (1.24).
- `mapa`: English synonyms pre-fill everything except «Trade number» (left at «Escolha…»). NEW chip «Datas: mês/dia» next to the
  separator chip (decided from rows like 10/14/2026), with the same «Mudar». NEW nota under the chips: «Sem coluna de ID,
  reconhecemos a reimportação pela mesma hora e preço.» (adapted from the board's copy-group ⓘ «Mesmo ID, ou mesma hora e preço, é
  reimportação, nunca cópia.»).
- `conferir`: «1 out, 09:31 · MNQ 12-26 · venda · 1 contrato · +US$ 17,00»; net block pre-selected «Não, é bruto» with «Conferido
  pelos preços na 1ª linha: +US$ 17,00 antes da comissão de US$ 1,24.»
- `h` ADAPTED from scenario 6: heading KEEP «2 contas neste arquivo»; rows «APX-0001 · 31 op.» select pre-set «Importar em Apex A»
  and «APX-0002 · 26 op.» pre-set «Não importar». Options NEW «Importar em {conta}» (accounts of the same market: Top One, Apex A)
  and «Não importar»; with Q3 = (b) also «Criar: Apex B» (scenario 6's «Criar: …»). NEW nota «Escolhemos pelo número na
  plataforma de cada conta.» and, for an unknown number with Q3 = (a), «Para importar APX-0002, crie a conta com esse número e
  importe o arquivo de novo: o que já entrou não duplica.» Hint ADAPTED «Escolha ao menos uma conta.» The step also appears when
  the file has one account value that differs from the context account's number.
- `d`: counts NEW «57 linhas · 31 novas · 26 não importadas (APX-0002) · 0 já estavam · 0 com erro»; «já estavam» reads «já estavam
  (mesma hora e preço)» when > 0 and no ID is mapped (NEW). With both accounts imported, AS-BUILT-style per-account line (board
  scenario 6) «Apex A 31 · Apex B 26» and one batch per account.
- `fim`: toast with two accounts «57 operações em Apex A e Apex B.»; «Desfazer» undoes both batches (NEW behaviour, stated in the
  scenario notes). *Revised (R9): not drawn. One value per import: `h` lets one value go into the destination (Apex A), the
  other is «Não importar», and only accounts of the destination's market are offered. Toast «31 operações em Apex A.», one
  batch, one «Desfazer». Nota «Para importar APX-0002, abra a importação na conta dela: o que já entrou não duplica.»
  (proposal). The «Apex A 31 · Apex B 26» line is not drawn.*

#### Scenario 18 · «18 · Forex por colunas (E8, exemplo)» — NEW

Context «Conta: E8 50k». Prototype select «Arquivo:» «Datas claras» / «Datas ambíguas». Steps **mapa → conferir → c → d → fim**.
- Columns (invented, a «Closed Positions» file): «Position ID» (4410023), «Open Time» (14.10.2026 08:40:12), «Close Time»,
  «Symbol» (EURUSD), «Side» (BUY), «Volume» (0.50), «Open Price» (1.08520), «Close Price» (1.08635), «Swap» (0.00), «Commission»
  (−3.50), «Profit» (57.50).
- `mapa`: chips ADAPTED for Forex: «Resultado» (no «(ou os preços)») + NEW nota «Em Forex, o resultado vem do arquivo: pelos preços,
  nem todo par diz o valor em dólar.» Opcionais ADAPTED «Opcionais: Saída, Comissão, Outra taxa, Swap ou funding, Stop, Alvo, ID da
  operação (evita duplicar), Conta.» NEW select option «Swap ou funding» (Q11). Execution pills: «uma execução» shown disabled
  (`aria-disabled`) with NEW nota «Em Forex, use o arquivo de posições fechadas.»
- *Datas ambíguas* (every day ≤ 12): NEW block «As datas podem ser dia/mês ou mês/dia. Qual é?» pills «dia/mês (01/10 = 1 out)» /
  «mês/dia (01/10 = 10 jan)»; «Continuar» disabled until answered, hint NEW «Escolha a ordem das datas.» Saved in the model.
- `conferir`: «14 out, 08:40 · EUR/USD · compra · 0,50 lote · +US$ 57,50», «14 out, 09:12 · EUR/GBP · venda · 0,25 lote · +US$
  19,84», «13 out, 16:48 · EUR/USD · venda · 1,00 lote · −US$ 35,00»; net block pre-selected «Não, é bruto» («Conferido pelos
  preços na 1ª linha: +US$ 57,50 antes da comissão de US$ 3,50.»).
- `c`: strips on New York; legend NEW «Faixas no relógio de Nova York (ET). Forex abre 24 h: sem faixa de pregão.»
- *Revised (R8): with «Swap» mapped, the net block asks «O resultado do arquivo já tem a comissão e o swap?» (proposal),
  pre-answered «Não, é bruto» here from the prices; a net answer would add back only the commission, since a net result
  already holds the swap.*
- `d`: NEW «1 operação com swap: ele entra no resultado, antes da comissão.» (as Registrar's «antes da comissão, com swap ou
  funding, se houver»); ADAPTED day line «1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.»

#### Scenario 19 · «19 · B3 em reais, sem conta escolhida (exemplo)» — NEW

Opened with no account in context (AS-BUILT `solte` «Escolha o arquivo»). Steps **solte → a → mapa → conferir → c → d → fim**
(«Passo 1 de 5» from `a`).
- `a` ADAPTED: heading KEEP «Para qual conta?»; NEW motive «Não reconhecemos este arquivo: escolha a conta, e depois você diz o
  que é cada coluna.»; options grouped by market with `.rotulo` headers «Futuros» (Top One, Apex A), «Forex» (E8 50k), «Ações»
  (IBKR), «Cripto» (Binance), «B3» (Mini-índice), then «+ Nova conta» (ADAPTED from «+ Nova conta de futuros»: leads to i1, i2, b);
  NEW nota «Contas de binárias recebem só o CSV da Ebinex.» Choose «Mini-índice».
- Columns (invented, «exemplo»): «Data/Hora» (14/10/2026 10:02:11), «Papel» (WINZ26), «C/V» (V), «Qtd» (3), «Pr. Entrada»
  (131.250), «Pr. Saída» (131.100), «Res. Líq.» (88,50), «Corretagem» (0,90), «Emolumentos» (0,60), «Nº Negócio» (77120).
- *Revised (R6): «88,50», «0,90» and «0,60» decide the decimal comma for the whole file, so «131.250» reads 131250. A
  variant «Arquivo:» «Só preços» (no money cell with a comma) draws `mapa`'s question «Como ler os números deste
  arquivo?» with «“131.250” é 131250 (ponto separa milhar)» / «“131.250” é 131,25 (ponto é decimal)» (proposals).*
- `mapa`: chip «Separador ; · decimal vírgula»; «Emolumentos» pre-filled «Outra taxa (soma na comissão)». Chips ADAPTED «Resultado
  (ou os preços)» with NEW nota «Sem coluna de resultado, calculamos pelos preços só nos contratos e ações que conhecemos (WIN, IND,
  WDO, DOL e as ações da lista).» NEW side block (two rows hold «X»): «2 linhas trazem “X” na coluna de lado. O que quer dizer?»
  pills «Compra» / «Venda» / «Pular essas linhas» (saved in the model; the value is shown only in the browser).
- `conferir`: «14 out, 10:02 · WINZ26 · venda · 3 contratos · +R$ 88,50», «14 out, 10:15 · WINZ26 · compra · 2 contratos · −R$
  31,00», «14 out, 11:20 · WDOX26 · compra · 1 contrato · +R$ 64,25»; net block pre-selected «Sim, é líquido» («Conferido pelos
  preços na 1ª linha: +R$ 90,00 − R$ 1,50 = +R$ 88,50.»). Model name default «Profit (Nelogica)».
- `c`: strips on Brasília with NEW band «pregão 09:00–18:30» (B3 derivatives, fatos §5.1); legend NEW «Faixas no relógio de
  Brasília.»
- `d`: «R$» throughout. Counts «18 linhas · 16 novas · 0 já estavam · 2 com erro» (the two «X» rows were answered in `mapa`);
  «O arquivo traz comissões: mostramos o resultado líquido.» ⓘ «Bruto +R$ 412,00 · comissões −R$ 22,50.»; «2 linhas com erro foram
  puladas.» + «Ver linhas» → NEW «Linha 9: preço fora do passo do WIN (de 5 em 5)», AS-BUILT reason ADAPTED «Linha 15: lado
  desconhecido» (an empty side cell; was «direção desconhecida», but «Lado» is the word in price markets); AS-BUILT «Antes de 15 out (início das regras): 16 vão para Histórico importado · só
  resultado.» Primary «Importar 16 operações»; toast «16 operações em Mini-índice.»

#### Scenario 20 · «20 · Modelos de colunas» — NEW (Q5 = a)

Opened from the background account menu: NEW button «Modelos de colunas» next to «+ Adicionar conta» and «Duplicar conta» (in the
app: Personalizar › Suas contas, below the list; listed for the Personalizar board). Prototype select «Escolha em aberto:»
«Modelos: lista em Personalizar» / «Modelos: sem lista».
- Sheet title NEW «Modelos de colunas»; ⓘ NEW «O modelo guarda os nomes das colunas e as suas escolhas (separador, decimal, datas,
  fuso), nunca as operações.»
- Rows (invented): «Minha plataforma» / «9 colunas · último uso em Top One, 15 out»; «Binance» / «9 colunas · último uso em
  Binance, 15 out»; «NinjaTrader» / «11 colunas · último uso em Apex A, 14 out». Buttons «Renomear» (`aria-label` «Renomear
  Minha plataforma») and «Apagar» (`aria-label` «Apagar Minha plataforma»).
- Rename inline: field «Nome do modelo», «Salvar», «Cancelar»; errors NEW «Dê um nome ao modelo.», «Já existe um modelo com esse
  nome.»; status «Modelo renomeado.»
- Delete confirmation NEW: «Apagar o modelo “Minha plataforma”? As operações já importadas ficam. O próximo arquivo com estas
  colunas volta a pedir o que é cada coluna.» buttons «Apagar modelo» / «Manter»; status «Modelo “Minha plataforma” apagado.»
- Empty NEW «Nenhum modelo ainda. Ele nasce quando você importa um arquivo que não reconhecemos e diz o que é cada coluna.»
- Columns are changed only inside an import («Mudar colunas», scenario 15): a model has no sample values to show outside one.

#### Scenario 9 additions · «Erro:» gains two entries — ADAPTED

- «Arquivo não reconhecido em binárias» (context «Conta: Ebinex»): heading AS-BUILT «Não conseguimos ler o arquivo.», text ADAPTED
  from `ERRO.unknownFormat`: «Em contas de binárias, lemos só o CSV da Ebinex.»
- «Planilha do Excel»: «Não conseguimos ler o arquivo.» + NEW «Salve como CSV na sua plataforma ou no Excel e tente de novo.»
- For mapping markets `ERRO.unknownFormat` no longer appears (the file goes to `mapa`).

#### Copy outside the sheet that changes with 3b (ADAPTED, for the other boards and the code)

- i1 note and Personalizar group note: dropped for mapping markets (kept text for MetaTrader platforms: «O relatório do
  MetaTrader 5 sai em HTML ou PDF e vai precisar de um leitor próprio, que vem depois.»).
- `fimConta` new market: «Nada ainda. Importe o histórico ou registre a primeira operação.» with «Importar histórico» (as
  futures); i3 «Como as operações chegam?» back for mapping markets; «Como exportar» NEW per platform only where a source says it
  (§7), else KEEP «Exporte o histórico de operações em CSV.»
- Personalizar rows of mapping markets get «Importar» and «Importações».
- Registrar: «Antes de {d} esta conta não tinha regras: essas operações entram pela importação de arquivo.»; `CONTAS.info` without
  «em breve».

### 4.3 Per-market rules the board must show (one table for conferir, d and errors)

| Market | Quantity shown | Money | Result without a Resultado column | Zone strips | Day line (`d`) |
|---|---|---|---|---|---|
| Futuros | «2 contratos» | US$ | prices × table (ES, MES, NQ, MNQ, GC, MGC, CL, MCL); other roots need the column | New York + «pregão regular 09:30–16:00 ET» | «o dia de Futuros vira às 18:00 de Nova York.» (AS-BUILT) |
| Forex | «0,50 lote» / «2,00 lotes» | US$ | never (column required) | New York, no band | «o dia de Forex vira às 17:00 de Nova York.» NEW |
| Ações | «300 ações» / «1 ação» | US$ | prices × 1; options skipped | New York + band | «o dia de Ações vira às 20:00 de Nova York.» NEW |
| Cripto | «0,0125 BTC» (up to 8 decimals) | US$ (USDT, USDC count as dollar) | prices when quoted in USDT/USDC/USD; other quotes need the column | Brasília, no band | «o dia de Cripto vira à meia-noite de Brasília.» NEW |
| B3 | «3 contratos» / «100 ações» | R$ | WIN, IND, WDO, DOL and catalog stocks; DI1 and others need the column | Brasília + «pregão 09:00–18:30» | «o dia da B3 vira à meia-noite de Brasília.» NEW |
| Binárias | — | — | not mappable | — | — |

New row-error reasons (NEW, `rowErrorReason`): «lado desconhecido», «número inválido em {campo}» (AS-BUILT form, field names
from the mapping), «sem resultado: {ativo} precisa da coluna de resultado», «preço fora do passo do {raiz} (de {passo} em
{passo})», «saída antes da entrada», «venda sem compra antes, no arquivo» / «compra sem venda antes, no arquivo», «opção, fica de
fora (registre no Registrar)», «posição com mais de uma entrada, fica de fora» (Q2 c only). Issues keep carrying a line and a
code, never a cell value; the unknown-side block reads the value in the browser only.

### 4.4 What stays, and the choices the board must show

**Stays (KEEP):** scenarios 1–7 and 9–14 and their flows; tokens, sheet, footer, toast and indicator patterns; `c` as drawn;
`a`, `f`, `g`, `h` patterns; the `mapa` chip/row design, the duplicate rule, «Ignorar esta coluna», the `conferir` three-row
check, «Salvar como modelo» checked by default with «Minha plataforma»; scenario 6 (create accounts + copy group) stays as a
drawing of a later step, not built. The shared steps take the as-built wording (§2 S1–S14).

**Drawn as visible alternatives** (prototype-bar select «Escolha em aberto:», chip «fora do produto», default = recommendation):

| Choice | Where | Alternatives drawn |
|---|---|---|
| Q1 execution files | 16 | «Execuções: juntar em operações» / «Execuções: só avisar» |
| Q2 more than one entry | 16 | «cada entrada é uma operação» / «preço médio» / «fica de fora» |
| Q3 account value with no account | 17 | «não importar» / «criar conta» |
| Q4 zone of a mapped file | 8, 15 | «Fuso: do modelo» («Lembrar … deste modelo») / «Fuso: da conta» (the as-built «desta conta», with the `tz_mismatch` message «Este fuso é diferente do fuso confirmado da conta.» in scenario 8 under Top One) |
| Q5 model management | 20 | «lista em Personalizar» / «sem lista» (scenario 20 then shows only «Mudar colunas» in 15) |
| Q6 net or gross | 8, 17, 18, 19 | drawn as the recommended question; the alternatives (always net / always gross) are only described |
| Q12 missing commission | 2, 4, 6 | recommended: the «Informe por contrato» block removed; drawn only if the owner wants it |

### 4.5 Accessibility and layout notes

- **375 px**: one column for `.col-linha` (KEEP at ≤ 420 px); the «sugerida» / «nova» tags wrap under the column name; the
  detection chips and «Mudar» wrap; `conferir` rows wrap per field (no horizontal scroll; long names like «Cum. net profit» break
  anywhere). The `h` rows stack (checkbox above select). The model list puts «Renomear» / «Apagar» on their own line. Sheet full
  width, 16 px side padding (KEEP).
- **768 px**: sheet 480 px over the dimmed Diário (KEEP); `mapa` rows in two columns.
- **Desktop**: same sheet; the board's 1280 px preview height grows with scenario 16 (about 1,500 px).
- **Both themes**: tokens only; warnings use `.bloco.atencao` (amber border) plus text, never colour alone; «sugerida» / «nova» tags
  in `--text-2` (≈ 5.7:1 on #505050, higher on #17191A). Check the new legend and band strips in both themes.
- **44 px**: «Mudar», «Mudar colunas», «Renomear», «Apagar», all pills (separator, decimal, date order, side meaning, net question,
  «Cada linha do arquivo é») and every select are `min-height:44px`; tags are not interactive.
- **Keyboard and reader**: focus to the step heading on each step (KEEP); «Mudar» is a disclosure (`aria-expanded`,
  `aria-controls`); pill groups are `role=group` + `aria-labelledby` with `aria-pressed` (board pattern); value-check text is tied
  to its select by `aria-describedby` and the select gets `aria-invalid`; disabled pills use `aria-disabled` + a reason in text;
  `conferir` rows become a list whose fields carry visually hidden separators «, » so a reader does not run them together; the
  pairing summary and the side block are `role=status` when they change; the delete confirmation moves focus to «Manter»
  (as Importações does) and back to the row's «Apagar» on «Manter».

---

## 5. Notes for the next specs (not board items)

- Model match: exact header set (normalised, order-insensitive) applies the model; a superset or subset opens `mapa` from it.
  Built-in readers always win (a Top One or Ebinex file never reaches a model).
- Pairing (if Q1 = a): per account and instrument key, flat to flat; each entry fill is a trade (Q2 a), exits split FIFO; the
  browser can emit one Top One-like row per (entry fill, exit fill) with the exit fill's ID as ticket, so the existing 3c grouping
  makes the trade with one file exit per row; open positions at the end and orphan exits are counted, never inserted.
- Zone per model (Q4 a) needs `import_preview`/`import_commit` to check the model's zone instead of `trading_accounts.file_tz`, and
  `import_fix_tz` scoped to the model's rows; today `tz_mismatch` would block scenario 8 under Top One.
- Instrument keys must cover NinjaTrader-style «MES 12-26» and Binance «BTCUSDT» (today `trade_match_key` reads «MESZ6», «WINZ26»,
  «EUR/USD»).

---

## 6. What this spec does not change

No step of the as-built Ebinex and Top One imports, no saved zone, batch or trade; the copy-group step and «Mover para esta
conta» stay unbuilt; MetaTrader HTML/PDF stays out.

---

## 7. Web sources (public export formats; all secondary)

- Tradovate «Orders» export: steps (account gear › ORDERS › Download Report), headers including «B/S», «Avg Fill Price», «Filled
  Qty», «Fill Time», «Status», «Account»; local time zone by default; no commissions:
  [TradeZella help](https://help.tradezella.com/en/articles/6472250-tradovate-how-to-import-trades-from-tradovate-into-tradezella-using-the-file-upload-method),
  [TradeZella integration](https://www.tradezella.com/integrations/tradovate), [TradesViz](https://www.tradesviz.com/brokers/Tradovate)
  (commissions from Cash History; not the Performance CSV), [Tradesyncer](https://help.tradesyncer.com/en/articles/11687074-how-to-manually-import-trades-from-tradovate-into-tradesyncer).
- Rithmic R|Trader Pro «Completed Orders» export: «Account», «Status», «Buy/Sell», «Qty Filled», «Avg Fill Price», «Order Number»,
  «Create Time», «Update Time», «Commission» (optional); one day per export; zone chosen at upload:
  [TradeZella help](https://help.tradezella.com/en/articles/6839918-rithmic-r-trader-how-to-import-trades-from-rithmic-r-trader-into-tradezella-using-the-file-upload-method),
  [Tradesyncer](https://help.tradesyncer.com/en/articles/11687958-how-to-manually-import-trades-from-rithmic-into-tradesyncer).
- NinjaTrader 8 Trade Performance grids export to CSV/Excel and filter by account; numbers can come out as text in Excel:
  [forum 1065934](https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/1065934-export-trades),
  [forum 1134169](https://forum.ninjatrader.com/forum/ninjatrader-8/platform-technical-support-aa/1134169-grid-exports-spreadsheet-numbers-are-stored-as-text-ninja-8?p=1134286).
  Exact column names not confirmed: scenario 17's are invented and marked «exemplo».
- Binance: no single all-trades file; USDⓈ-M and COIN-M separate; spot Trade History export removed, Order History left:
  [Trader's Second Brain](https://traderssecondbrain.com/guides/how-to-export-binance-trade-history),
  [binance-exports](https://hackage.haskell.org/package/binance-exports). UTC dates: `fatos_mercados.md` §2.3.
- IBKR Flex, thinkorswim, Bybit, Match-Trader, cTrader, Profit: `fatos_mercados.md` §1.3, §2.3, §3.3, §5.4 and the sources listed
  there. Profit's CSV columns were not found (a search on 2026-10-21 returned nothing relevant).

---

## Open questions for the owner

**Q1 · Execution files (one buy or sell per row: Rithmic, Tradovate Orders, IBKR, Binance, Profit).**
(a) Draw scenario 16 now and build it as the last 3b PR, after you send the header line (no rows) of a real export.
(b) Build it with the rest of 3b, from invented files only.
(c) 3b imports one trade per row only; an execution file gets the warning «Parece um arquivo de execuções…».
**Recommend (a)**: most first exports in the new markets are executions, and Phase 3c's grouping makes pairing cheaper, but a real
header avoids guessing columns.

**Q2 · A position with more than one entry, in an execution file.**
(a) Each entry is its own trade; the exits are split oldest first. (b) One trade at the average entry price. (c) Left out and
listed. **Recommend (a)**: it keeps the 3c decision «uma entrada, várias saídas» and loses nothing.

**Q3 · An account number in the file that matches none of your accounts.**
(a) «Importar em {conta}» or «Não importar», pre-set by «Número na plataforma». (b) Also «Criar: {nome}», as scenario 6.
(c) No «Conta» field in 3b. **Recommend (a)**: smallest step; a new account is one «+ Adicionar conta» away and a second import
does not duplicate.

**Q4 · Where the zone of a mapped file is remembered.**
(a) In the model («Lembrar para os próximos arquivos deste modelo»). (b) In the account, as today. **Recommend (a)**: Top One already
holds UTC from Trade History; a BlackArrow or NinjaTrader file in Brasília or New York would otherwise be refused («Este fuso é
diferente do fuso confirmado da conta.»).

**Q5 · Managing models.**
(a) «Modelos de colunas» in Personalizar › Suas contas: rename and delete; columns change inside an import («Mudar colunas»).
(b) No list in 3b; «Mudar colunas» saves over. **Recommend (a)**: one per platform accumulates, and a wrong model must be removable.

**Q6 · Result that may already deduct the commission.**
(a) Ask «O resultado do arquivo já desconta a comissão?» when both columns are marked, pre-answered by the prices, saved in the
model. (b) Always net. (c) Always gross. **Recommend (a)**: the board's own sample is net, NinjaTrader-style files are gross.

**Q7 · Result from prices when there is no result column.**
(a) Only where exact: futures and B3 contracts of the table, stocks, crypto quoted in dollars; Forex needs the column. (b) Forex too,
estimating dollar-base pairs. (c) Result column always required. **Recommend (a)**, as Registrar does.

**Q8 · Crypto fees paid in another coin (BNB).**
(a) Those trades stay without commission, with a line in the preview. (b) Skip those rows. (c) Ask a rate. **Recommend (a)**.

**Q9 · US options inside a stocks file.**
(a) Skipped with a reason; options are registered in Registrar. (b) Read option symbols (×100). **Recommend (a)** for 3b.

**Q10 · Several cost columns (B3 «Corretagem», «Emolumentos»).**
(a) A field «Outra taxa (soma na comissão)» usable on several columns. (b) One cost column only. **Recommend (a)**.

**Q11 · Swap or funding column (Forex, Cripto).**
(a) A field «Swap ou funding», added to the result before commission, as Registrar does. (b) Ignored. **Recommend (a)**.

**Q12 · A file without commissions.**
(a) Commission stays unknown, as the app does today. (b) Bring back the board's «Sem comissão no arquivo. Informe por contrato:»
with «Seguir bruto». **Recommend (a)**; (b) can come with the Análises.

**Q13 · Size of the board revision.**
(a) Revise 8, add 15–20, align the shared steps of 1–7 and 9–14 with the app's wording. (b) Only scenario 8 (with zone and
preview). **Recommend (a)**: the mapped flow reuses those steps, and the board should show what the app says.

**Q14 · Destination when no account is chosen.**
(a) «Para qual conta?» first, all accounts that take files grouped by market, then the columns. (b) «Qual mercado?» first, then the
account. **Recommend (a)**: the account fixes market, currency and day in one tap.

**Q15 · Excel files.**
(a) CSV only; an .xlsx gets «Salve como CSV na sua plataforma ou no Excel e tente de novo.» (b) Read .xlsx too (a new library, needs
your OK). **Recommend (a)**.
