Third PR of Phase 3c, stacked on the domain PR (`fase-3c/dominio`, #34), which is stacked on the database PR (`fase-3c/banco`, #33). It adds the screens for partial exits, stop moves («Registrar stop» / «Breakeven») and the rule «mover para o breakeven com +N pontos», built from the boards the owner approved on 21 Oct (RegistrarOperacao, 16 scenarios, and Personalizar). The paste (`fase3c_aplicar.sql`) is already on the live database (21 Oct); merge #33 → #34 → this PR, in that order, after the owner tests it.

## What changes
- **Step 1, «Aberta»:** the rule line «Sua regra: breakeven com +8 pts, em 7.920,50.», or «Sua regra: breakeven com +8 pts.» before a side and a price are chosen.
- **Step 1, «Já fechada»:**
  - «+ Outra saída» splits an exit into 2 to 20 rows that must add up to the entry. Each row gets its own errors.
  - New lines: the sum «Saídas: 2 de 2 ct.», the result «Resultado: +6,00 pts em média · +US$ 120,00», «Corrigir» on the total, «Custos» for the whole trade, and «Venceu sem valor» on the last row.
  - The pill «Movi o stop para o breakeven» with «Preço quando moveu» and its status «com +12,00 pts a favor · Sua regra: com +5 pts.». The rule shown is the version in force at the typed entry.
  - The draft moves to v3. Drafts saved as v1 and v2 still load.
- **Step 2, «Operação aberta»** (price markets only; Ebinex is unchanged):
  - «O que registrar agora?» offers Saída · Parcial · Mover stop.
  - «Parcial» uses chips, a field, or «Metade», depending on the market.
  - «Mover stop» offers «Breakeven» or «Outro preço», with «Preço agora».
  - The «Agora» block and the «Linha do tempo».
  - «Desfazer» undoes the newest partial or stop move for 15 minutes, after a confirmation.
  - The breakeven suggestion after a partial that reaches the rule.
  - The limit banners after a partial, and the line that brings the limit back after an undo.
  - The exit after partials («Sai com os 2 ct…», «· no total …»).
  - «Desfazer entrada» names the partials and moves the trade has.
- **Step 3, «Operação fechada»:**
  - The average exit («→ 7.924,17 em média»).
  - The R line «com o stop inicial de 10 pts».
  - The timeline, with «Nª saída» numbering on «Já fechada» trades and file exits.
  - The breakeven line, in five forms, shown only when the rule covers the asset.
- **Lists:**
  - «Operações abertas» shows «· 2 ct em aberto».
  - «Operações do dia» gets a second line: «1 parcial, +US$ 40,00 · stop no breakeven» on an open trade, «em 2 saídas» on a closed one.
- **Import:**
  - New lines for the rows of a Top One position: grouped into one trade, or attached to a trade already there.
  - Trade counts read the import's new trade keys.
  - The primary button reads «Juntar N saídas» for a file that only adds exits.
- **Personalizar › Suas regras:**
  - The new group «Durante a operação» › «Mover para o breakeven», on «Padrão Futuros» and on each futures account.
  - Per-asset lines, «Adicionar ativo», «Remover», «Voltar ao padrão», the tags and «não salvo».
  - The version note «breakeven com +8 pts no MES …».
- **New code:** `lib/hub/registrarParciais.ts`, `registrarSaidas.ts` and `personalizarBreakeven.ts` (pure models); the components `AcoesAberta`, `FormParcial`, `FormMoverStop`, `BlocoAgora`, `LinhaDoTempo`, `SugestaoBreakeven`, `SaidasJaFechada`, `MoviBreakeven` and `RegraBreakeven`; a trade-events read (`useTradeEvents`); the stylesheet `hub-registrar-parciais.css`.
- **Data:** every read and write goes through the domain PR's data layer, in the browser, with the user's session. Nothing private is rendered on the server.

## Where the app differs from the approved boards (for the owner)
1. **Save bar in Personalizar.** On the board, «Adicionar ativo» with no value yet, or invalid text in a field, also brings up the bar «Alterações não salvas». Here the row shows «não salvo», but the bar follows only what can actually be saved, so it does not appear in that state. Nothing saved is different. Changing this needs a later change to the page's provider.
2. **A typo in «Preço agora» or «Preço quando moveu» on Forex.** A price 10^10 pips or more from the entry (for example 2.000.000 on EUR/USD) is refused with «Confira o preço de agora.» or «Confira o preço quando moveu.», because the database refuses it. The board's prototype would accept it and show its points. Realistic prices behave as on the board.
3. **Import file card.** When two or more rows of a file belong to one position, the file card reads «N linhas» instead of «N operações». The board does not cover this; please confirm.
4. **Focus after a refused undo.** After a refused «Sim, desfazer», the focus returns to the «Desfazer» link if it is still there (offline or network error). Otherwise it goes to the sheet's alert. «Desfazer entrada» now does the same; before, the focus was lost.
5. **First switch-on in Personalizar.** The first asset lines come from each futures account's last 200 trades: up to 3 roots, MES when there is no history. The board always shows MES, MNQ and MGC.
6. **Smaller points:**
   - The note «voltou ao valor anterior» shows the value formatted.
   - An asset added on «Padrão Futuros» but not filled in yet shows only on «Padrão Futuros». The board also shows it on the accounts that inherit.
   - In a single exit (no rows), «Venceu sem valor» still refills «0» after you clear it, as before 3c. The rows keep a cleared field empty, as on the board.
7. **Words the boards do not draw:**
   - the import lines and counts (examples below);
   - «Nª saída» for file exits on app trades;
   - «Confira o preço…» (item 2);
   - «Só o último registro pode ser desfeito.»
8. **The import's trade counts follow the import's new keys.**
   - For a file with partial exits, «Importar {n} operações», the end screen and the toast count trades, not rows. For example, 17 rows that make 16 trades read «Importar 16 operações» and «1 saída parcial juntada à sua operação.».
   - A file that only adds exits to trades already in the account reads «Juntar 2 saídas» and «2 saídas a mais entraram em operações que já estavam.». It is never «Nada novo».
   - Files with one row per trade (every file before 3c) read exactly as before.

## Tests
- **Jest:** 114 suites pass and 8 are skipped; 4,234 tests pass and 118 are skipped. That is 13 suites and 263 tests more than the domain PR.
  - Step 2 and step 3: `hubRegistrarParciais` (the models against the board's strings in all six markets), `RegistrarParciais` (scenario 14 end to end), `RegistrarMoverStop`, `RegistrarLimiteParcial` (scenario 16), `hubRegistrarEventos`, and `RegistrarParciaisCss` (scoping, 44 px targets, contrast in both themes).
  - Step 1 and Personalizar: `hubRegistrarSaidas`, `RegistrarJaFechadaSaidas` (scenarios 15 and 12), `RegistrarRegraEntrada`, `PersonalizarBreakeven` and `hubPersonalizarBreakeven`.
  - Additions to `useRegistrar`, `RegistrarFechada`, `ImportSheet`, `OperacoesDoDia`, `hubRegistrarForm` (draft v3) and `hubComoFicaHoje`.
  - Fixtures are the domain PR's recorded answers from the real SQL. Data is invented.
- **Type check and lint:** `tsc --noEmit` is clean. `next lint` shows no errors; its 9 warnings are all in files this PR does not touch.
- **Database-backed suites:** all 8 pass against a local throwaway cluster with every migration (hubMercados 4, hubParciais 12, hubRegistrar 36, hubRegistrarFluxos 8, hubRegistrarMercados 15, hubRegistrarTelas 9, hubRegras 24 + 2 skipped, hubRegrasBreakeven 8).
- **End-to-end flow on that cluster, through the real UI code:**
  - Personalizar turns on the rule and saves it through `save_rules`.
  - Register the entry, see the rule line.
  - «Parcial», then the suggestion.
  - «Mover para o breakeven» → «Registrar stop».
  - «Desfazer» the move.
  - «Saída» → step 3.
  - «Já fechada» with two exits and the pill → step 3.
  - «Operações do dia» updates after each write.
  - Every write was checked in the tables.
- **Reviews:** each lane was reviewed twice, against the boards and against the real SQL (mutation testing included), and fixed. The two lanes merged without conflicts.
- **Screenshots:** every board scenario (1–16) and the Personalizar row, at 375, 768 and 1280 px, in claro and escuro: 83 states, 498 shots. They are rebuilt from invented data next to each board state. A sheet is shown unrolled, the whole step in one image with the footer at its end, so compare content and layout, not scrolling. Dates come from the recordings (for example 23 Oct where the board has 16 Oct).

## How to test
1. The owner pasted `fase3c_aplicar.sql` on the live database on 21 Oct (conferência clean). Before any merge, run this branch locally over the LAN (`next dev -H 0.0.0.0 -p 3001`, launch config `binary-hub-fase3c`, with `app/.env.local` linked into the worktree) and open it on the phone. Merge #33, #34 and this PR only after this test, in that order.
2. **Personalizar:** go to Suas regras › Padrão Futuros › «Durante a operação» and turn on «Mover para o breakeven». Set MES to 8, add MGC with 5, and press «Salvar alterações». You should see «Salvo. Regras novas desde …».
3. **Step 1, «Aberta»:** in Diário › «Registrar operação», choose MES, Compra, 3 ct, a price and stop 10. You should see «Sua regra: breakeven com +8 pts, em …». Press «Registrar entrada».
4. **«Parcial»:** register 1 ct at entry + 8 pts. You should see the status, the suggestion, «Agora» and «Linha do tempo».
5. **Breakeven:** press «Mover para o breakeven», then «Registrar stop». You should see «Stop no breakeven (…) às …». «Operações do dia» should read «1 parcial, +US$ 40,00 · stop no breakeven».
6. **Undo:** press «Desfazer» on the move, then «Sim, desfazer». The stop goes back. The undo is available for 15 minutes.
7. **Exit:** register a «Saída» for the rest. Step 3 should show «… em média», «R com o stop inicial de 10 pts», the timeline and «Breakeven: o stop não foi movido · sua regra: +8 pts.». The bridge should read «em 2 saídas».
8. **«Já fechada»:** register MGC 2 ct with «+ Outra saída» (two rows of 1 ct) and «Movi o stop para o breakeven». Step 3 should show «1ª saída», «2ª saída» and «Breakeven com …, registrado depois · sua regra: +5 pts.».
9. **Clean up:** a test trade can be removed with «Desfazer entrada» only while it is open and within 15 minutes; closed test trades stay in the journal, as in Phase 3. Saving the rule creates a rule version (append-only); turning it off later creates another.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
