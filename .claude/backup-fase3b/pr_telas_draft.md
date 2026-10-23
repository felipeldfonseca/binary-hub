## Fase 3b · telas: importação por colunas, incl. arquivos de execuções

Stacked on #38 (domínio) on #37 (banco). The owner has already pasted `fase3b_aplicar.sql`. Merge after #37 and #38, in that order, and only after his test. Nothing here calls the live Supabase. A file from a supported reader (Ebinex, Top One) calls exactly the as-built RPCs and never reads `import_templates` or the models' markets.

### What changes
- **«mapa»:** «Diga o que é cada coluna», for trade files and execution files.
  - «Separador / decimal / Datas», with «Mudar».
  - The decimal and date questions, «Cada linha do arquivo é», «Obrigatórias» and the notes.
  - One select per column, tagged «sugerida» or «nova», with its check. Also the side-word question.
- **«conferir»:** «Confira 3 linhas».
  - The end-of-file question per symbol, and per «Conta» value too.
  - The pairing summary with «Ver as N operações», and the net/swap question.
  - «Salvar como modelo» / «Atualizar o modelo “…”», with «Nome do modelo».
  - The model chip with «Mudar colunas».
- **The sheet around them:**
  - Routing an unrecognised file, and «Para qual conta?» for every market, with «+ Nova conta».
  - «N contas neste arquivo», and the step indicator.
  - The zone step for every market, with the G2 rule.
  - «Prévia»: counts in «saídas», leftover executions under «Ver linhas», and the G1 warning.
  - The model saved after the commit (`import_template_save` with the batch), and «Nada novo» for a mapped file.
  - Scenario 9's errors.
- **Models across markets** (owner decision, 23 Oct; no database change). The app works out each model's markets in the browser, from its batches: `import_batches.template_id` → the batch's account → `trading_accounts.market`. It reads them with the user's session.
- **Outside the sheet:**
  - «Importar» and «Importações» for Forex, Ações, Cripto and B3.
  - «Fuso do arquivo» in Editar conta, and `CONTAS.info`.
  - Registrar's «Antes de {d}… pela importação de arquivo.»
- **Importações › «Desfazer» counts trades** (a Phase 3c bug found in the owner's test; no database change). The confirmation counted the batch's file lines (`rows_inserted`, `rows_linked`), never trades:
  - A Tradovate file whose 6 exits made 4 trades said «Desfazer apaga as 6 operações desta importação.», then «Importação desfeita: 4 operações apagadas.». A Top One position in two rows did the same.
  - When the confirmation opens, the app now reads, with the user's session, what `import_undo` works on: the trades with the batch's `import_batch_id` (what it deletes, a head count), the batch's file exits and its `trade_import_links` (read whole, page by page). The import's own words follow: «Desfazer apaga as 4 operações desta importação, em 6 saídas.»
  - One registered trade completed by a position in two rows is «a registrada por você», not «as 2».
  - A row that joined a trade already there deletes nothing: «Desfazer não apaga nada: a operação que já estava volta a ser como era antes desta importação.», with «Desfazer» alone.
  - While the counts load, only «Manter» shows; if they fail, «Não foi possível ver o que esta importação apagaria.» with «Tentar de novo».
  - The batch's own parts («6 novas · 0 já estavam · 0 com erro») still count the file's lines. Importações has no board, so these words are new.

### Where the app differs from the approved board
1. **Interactive Brokers (16):** «comissões −US$ 5,00», not 6,00. Only the imported executions' costs count. Proved on the real SQL.
2. **Forex with the Chicago zone (18):** «1 operação fica em outro dia…», not 2. The day turns at 17:00 New York, so only the 13 out 17:48 entry changes day. Proved on the real SQL.
3. **Scenario 15** (the owner's answer (a)). The database does not say which rows of the file are new, so the screen counts the whole file:
   - «Prévia» adds «Antes de 14 out (início das regras): até 5 vão para Histórico importado · só resultado.»
   - The ⓘ sums the whole file: «Bruto +US$ 103,75 · comissões −US$ 34,72.»
   - The end reads «5 operações importadas. As de antes de 14 out ficam em Histórico importado · só resultado, à parte do Diário.»
4. **A model saved in another market** (owner decision, 23 Oct). It is still offered, as «Parecido com o modelo “…”» or as an exact match. It is never overwritten:
   - **Columns changed:** «Atualizar o modelo “BlackArrow”» starts unchecked, with a new line: «O modelo “BlackArrow” é de Futuros. Sem atualizá-lo, estas colunas viram um modelo novo.»
     - «Nome do modelo» then shows «BlackArrow · B3», meaning «{modelo} · {mercado}». The name is cut to 60 characters, and a market suffix the name already has is replaced.
     - Left unchecked, the import saves that new model. Checked, it updates the other market's model under its own name.
     - Neither way keeps that market's «Conta» routes.
   - **The very same columns:** there can be only one model per header set (`unique (user_id, header_sig)`), so a «new» model would overwrite the existing one. The model is only read:
     - It is taken as is (the chip), and never touched or updated.
     - Nothing is saved, and the end shows no model line.
     - If the file goes through «mapa» (or «Mudar colunas»), there is no checkbox. A new line takes its place: «O modelo “…” é de {mercado} e fica como está: as mudanças valem só para este arquivo.»
     - After «Mudar colunas», the «mapa» title is «Mude as colunas deste arquivo. O modelo “…” fica como está.», not «Mude as colunas do modelo “…”.»
   - **Another market's zone gives no hint:** it neither skips the zone step nor pre-selects a zone.
   - **Which models count as another market's:**
     - A model with no batch yet fits every market.
     - An undone batch still counts.
     - If the markets cannot be read, every model counts as another market's («é de outro mercado»).
   - In the model's own market, everything is as on the board.
   - **A new model never overwrites another one.** `import_template_save` saves a new model without `p_replaces`, so it updates any model that has the same header set. Two cases are guarded:
     - «Separador» matches the re-read file against every model, not only the one matched before. Example: a «;» file whose data lines end in «;» is first read with «,». After «;», it has «BlackArrow»'s exact columns, so it is that model's file: only read in another market, «Atualizar o modelo “BlackArrow”» in its own.
     - If the models cannot be read, the sheet reads them again when it saves. If they still cannot be read, or if a model already has these columns, the new model is not saved. The end shows «O modelo “…” não foi salvo. As operações já entraram; …».
5. **Zone bars no file can draw as the board does:** 16 Interactive Brokers, 17, 18 and 19. The captions, bands and legends are the board's.
6. **«Ignorar esta coluna» pre-set** for:
   - a column that repeats another column's field;
   - a known non-field (Status, duration, Limit/Stop Price);
   - an ID that repeats.
   Any other unknown name starts at «Escolha…».
7. **Words the board does not draw**, among them:
   - «já estavam (mesma hora e preço)» for rows without an ID;
   - «1 não importada (…)»;
   - «A posição ainda aberta fica de fora (N execuções)…», which counts the executions refused whole; «A parte ainda aberta da posição (…)…» appears only when no execution is refused whole;
   - «… a parte da venda / compra que … fecha fica de fora.»;
   - «Nada novo: as N saídas já estão em …», «Escolha como ler os números.», and the model-save failure lines;
   - the two lines about another market's model, and the «Mudar colunas» title of a model that is only read (#4).
8. **«Nada novo» of a mapped file** has no «Confirmar fuso».
9. **Small layout differences:**
   - 15's direct «Prévia» has «Voltar».
   - 15's file card breaks before «1–15 out»; the board breaks inside it.
   - The ▸ of «Ver as N operações» sits 4 px to the left.
   - «Ver linhas» has a bullet per line for every file, Top One and Ebinex included.
   - «+ Nova conta» from «Para qual conta?» counts its own steps in «Passo k de n».
   - At 375 px, «APX-0001» wraps at its hyphen (the board's CSS does the same).
   - 19's «Decimal vírgula…» note is absent in the execution reading.
   - The side-word question also shows on execution files.
10. **Screenshots** show the sheet unrolled with invented data and no Diário behind it.

### Tests
- **Jest:** 137 suites and 5,433 tests (the 13 database suites are skipped without a cluster).
  - New: `hubImportMapaVista`, `ImportMapa`, `ImportConferir`, `ImportMapaCss`, `ImportColunas` (the sheet through every board state, on the real steps), `hubImportPrevia`, `ImportFluxoCss`.
  - Extended: `hubImportMapeado` and `hubContasDb`.
  - Models across markets: unit tests, plus Testing Library tests for:
    - unchecked → a new model;
    - checked → an update;
    - markets that cannot be read;
    - markets past the API's row limit: a model whose only batch is on the second page stays of its market (unchecked), and a page that fails counts as unreadable (`hubContasDb` pages both reads, a lowered page size included);
    - the model's own market;
    - the very same columns, taken as is or through «Mudar colunas»;
    - «Separador» onto another market's model, and onto one of the file's own market;
    - models that cannot be read: not saved, or saved after a second read that finds no model with those columns.
  - «Desfazer» in trades: `SuasContas` (an execution file's 4 trades in 6 exits, a registered trade completed by two rows, a row that joined a trade already there, the counts loading and failing, every wording) and the new `hubDesfazerLote` (the reads past the API's row limit, the trades asked 100 ids at a time).
- **Database suites:** all 13 pass on a throwaway cluster.
  - `hubImportMapa.pg` and `hubImportTelas.pg` prove every composed answer equal to the real SQL.
  - The new `hubImportMercados.pg` runs the decision on the real SQL:
    - `blackarrow.csv` in a futures account saves «BlackArrow».
    - `b3.csv` in a B3 account saves a new «BlackArrow · B3»; «BlackArrow»'s row stays the same, byte for byte.
    - `b3.csv` again matches the new model in its own market.
    - The B3 model's columns in Futuros: only read, and the batch keeps no model.
    - «Desfazer» keeps every model's market.
    - «Separador» in B3 onto «BlackArrow»'s columns: the model is only read and its row stays the same.
    - With the models unread, the guard stops the new model. The suite then sends it anyway, to show the overwrite the guard prevents.
  - The new `hubImportDesfazer.pg` reads each batch as Importações does, and undoes it. In each case `import_undo` deletes exactly the confirmation's count:
    - A Top One position in two rows and a trade of one: «as 2 operações …, em 3 saídas». The lines said «as 3».
    - A later Top One file whose rows join both trades: «Desfazer não apaga nada: as 2 operações que já estavam …». The lines said «Desfazer apaga as 2 operações». The first batch keeps its own counts.
    - The position in two rows onto a registered trade: «a operação …, e a registrada por você». The lines said «as 2 registradas».
    - Tradovate Orders: «as 4 operações …, em 6 saídas». The lines said «as 6». Onto the registered MES long: «as 3 operações …, em 4 saídas, e a registrada por você». The lines said «as 4», «as 2».
- `tsc` is clean, and lint shows no errors.
- **End-to-end:** the real sheet on all migrations.
  - The board's world: 8, 8 again, 15, 16 Tradovate with every end-of-file answer, 17, 19 (B3 after «BlackArrow» now starts unchecked) and 19 without a model. Every batch is undone.
  - The owner's test below, run step by step with the files in `.claude/teste-3b/`. Every line quoted below is what the sheet showed, step 7 with this fix.
- **Screenshots:** 102 states, 612 shots, placed next to the board.

### Como testar
**Onde.** No navegador do Mac, em http://localhost:3001, com esta branch rodando no Mac. Não teste pelo celular: a importação calcula o hash do arquivo no navegador, e isso só funciona em contexto seguro. Pela rede (http://IP-do-Mac:3001) o arquivo não é lido.

**Arquivos.** Ficam em `/Users/felipefonseca/Dev/binary-hub/.claude/teste-3b/`. São todos inventados, e `LEIA.txt` diz a conta e o passo de cada um. As datas são 19 a 22 out, depois do início das regras da Apex #1.

**Contas.**
- Apex #1, a sua conta de teste de Futuros.
- Duas contas descartáveis, criadas em Personalizar › Suas contas › + Nova conta:
  - «Teste 3b Forex»: Forex, plataforma Match-Trader;
  - «Teste 3b B3»: B3, plataforma Profit.
- As duas nascem com regras «desde hoje». Por isso as operações dos arquivos delas vão para «Histórico importado · só resultado», e isso é o esperado.
- Top One e Ebinex não são tocadas.

1. **Personalizar › Suas contas › Apex #1 › «Importar» › `blackarrow.csv`.**
   - Aparece «Não reconhecemos este arquivo. Diga o que é cada coluna.», com o cartão «Arquivo não reconhecido · 18 linhas» e «Passo 1 de 4». As 9 colunas já vêm sugeridas. Toque em «Continuar».
   - Em «Confira 3 linhas»:
     - A 1ª linha é «19 out, 09:34, MESZ6, compra, 2 contratos, −US$ 39,98».
     - «O resultado do arquivo já desconta a comissão?» vem com «Conferido pelos preços na 1ª linha: −US$ 37,50 − US$ 2,48 = −US$ 39,98.»
     - Em «Nome do modelo», escreva «BlackArrow»: o nome sugerido é o da plataforma da conta.
     - Toque em «Usar estas colunas».
   - Em «Em que fuso estão os horários deste arquivo?», nada vem marcado. Marque Nova York («entradas 09:31–10:58 ET») e toque em «Continuar». Se a Apex #1 já tiver um fuso confirmado, ele vem marcado e é o único aceito; use esse.
   - Em «Prévia» aparecem:
     - «18 linhas · 18 novas · 0 já estavam · 0 com erro»;
     - «O arquivo traz comissões: mostramos o resultado líquido.»;
     - «Fuso do arquivo: Nova York (ET) · lembrado para Apex #1».
   - Toque em «Importar 18 operações». O fim mostra «18 operações importadas.» e «Modelo “BlackArrow” salvo: os próximos arquivos com estas colunas entram direto.»
2. **`blackarrow.csv` de novo.**
   - Aparece «Nada novo: as 18 operações já estão em Apex #1.», com «18 linhas · 0 novas · 18 já estavam (mesmo ID)».
   - Não há aviso de outro formato.
3. **`blackarrow-2.csv`.**
   - O arquivo vai direto à «Prévia», sem passos. O chip diz «Colunas do modelo “BlackArrow”», com «Mudar colunas», e o cartão diz «Modelo “BlackArrow” · Futuros · 24 operações · 19–20 out».
   - A prévia mostra «24 linhas · 6 novas · 18 já estavam (mesmo ID) · 0 com erro».
   - Toque em «Importar 6 operações». O fim mostra «6 operações importadas.», sem linha de modelo, porque o modelo só foi usado.
4. **`tradovate-ordens.csv`.**
   - Aparece «Não reconhecemos…», com «uma execução (compra ou venda)» marcado. Toque em «Continuar».
   - Em «Confira 3 linhas»:
     - Aparece «Viram 4 operações: 2 com uma saída e 2 com saídas parciais.»
     - «Ver as 4 operações» abre a lista. A 1ª é «21 out, 10:31 · MESZ6 · compra de 2 a 6.812,25 · saídas de 1 a 6.816,00 e de 1 a 6.819,50 · +US$ 55,00».
     - Em «Nome do modelo», escreva «Tradovate».
     - Toque em «Usar estas colunas».
   - No fuso, Nova York já vem marcado. Toque em «Continuar».
   - A «Prévia» mostra:
     - «9 execuções no arquivo»;
     - «6 saídas · 6 novas · 0 já estavam»;
     - «As 6 saídas viram 4 operações.»;
     - «2 ordens sem execução ficaram de fora.»
   - Toque em «Importar 4 operações». O fim mostra «Modelo “Tradovate” salvo: …»

   **Depois, `tradovate-posicionado.csv`** (outro dia, outras ordens).
   - O arquivo abre em «Confira 3 linhas», com «Passo 1 de 2». O cartão diz «Modelo “Tradovate” · Futuros · 13 linhas · 22 out», e o chip diz «Colunas do modelo “Tradovate”».
   - Aparece a pergunta «No fim do arquivo, MESZ6 ficou posicionado?», com «Pelas execuções do arquivo, sobra 1 contrato vendido.» e «Não sei» marcado.
   - Veja a prévia de cada resposta: toque em «Usar estas colunas» e depois em «Voltar».
     - **«Não sei»:** «2 saídas · 2 novas», «As 7 execuções de MESZ6 ficaram de fora: as compras e as vendas do arquivo não fecham.» e «Importar 2 operações».
     - **«Sim, ficou posicionado»:** «6 saídas · 6 novas», «As 6 saídas viram 4 operações.», «1 execução de posição ainda aberta no fim do arquivo ficou de fora. …» e «Importar 4 operações».
     - **«Não, terminou zerado»:** «As 6 saídas viram 5 operações.», «1 execução fecha uma posição aberta antes do começo do arquivo e ficou de fora.» e «Importar 5 operações».
   - Importe com «Sim». O fim mostra «4 operações importadas.»
5. **«Teste 3b Forex» › «Importar» › `forex.csv`.**
   - As colunas vêm sugeridas; Swap vira «Swap ou funding».
   - Em «Confira 3 linhas»:
     - «O resultado do arquivo já tem a comissão e o swap?» vem com «Conferido pelos preços na 1ª linha: +US$ 57,50 antes da comissão de US$ 3,50.»
     - O nome sugerido é «Match-Trader».
   - Marque Nova York no fuso.
   - A «Prévia» mostra:
     - «14 linhas · 14 novas · 0 já estavam · 0 com erro»;
     - «1 operação com swap: ele entra no resultado, antes da comissão.»;
     - «1 operação fica em outro dia que o do arquivo: o dia de Forex vira às 17:00 de Nova York.»;
     - «Antes de [hoje] (início das regras): 14 vão para Histórico importado · só resultado.»
   - Toque em «Importar 14 operações». O fim mostra «Modelo “Match-Trader” salvo: …»
6. **«Teste 3b B3» › «Importar» › `b3.csv`** (as colunas do BlackArrow mais «Emolumentos»). Este passo mostra a decisão de 23 out.
   - Aparece «Este arquivo mudou desde o modelo “BlackArrow”. Confira as colunas.», com o cartão «Parecido com o modelo “BlackArrow” · 18 linhas».
   - Em «2 linhas trazem “X” na coluna de lado. O que quer dizer?», escolha «Venda».
   - «Emolumentos» vem como «nova», com «Escolha…». Escolha «Outra taxa (soma na comissão)». Sem isso, a prévia avisa «16 com resultado diferente do calculado pelos preços: vale o do arquivo.»
   - Toque em «Continuar».
   - Em «Confira 3 linhas»:
     - «Atualizar o modelo “BlackArrow”» vem **desmarcado**, com «O modelo “BlackArrow” é de Futuros. Sem atualizá-lo, estas colunas viram um modelo novo.»
     - «Nome do modelo» diz «BlackArrow · B3».
     - Deixe como está e toque em «Usar estas colunas».
   - No fuso, nada vem marcado, porque o fuso do modelo de Futuros não vale aqui. Marque Brasília.
   - A «Prévia» mostra «18 linhas · 16 novas · 0 já estavam · 2 com erro» e «Antes de [hoje] (início das regras): 16 vão para Histórico importado · só resultado.»
   - Toque em «Importar 16 operações». O fim mostra «Modelo “BlackArrow · B3” salvo: os próximos arquivos com estas colunas entram direto.» O «BlackArrow» de Futuros fica como estava.
   - Importe **`b3.csv` de novo:** aparece «Nada novo: as 16 operações já estão em Teste 3b B3.», com o cartão «Modelo “BlackArrow · B3” · B3 · 18 linhas · 21 out». O modelo novo é reconhecido no mercado dele.
7. **Personalizar › Suas contas › «Importações» de cada conta: «Desfazer» em cada lote.**
   - São 4 lotes na Apex #1, 1 no Forex e 1 na B3.
   - Nos dois lotes da Tradovate, a confirmação diz «Desfazer apaga as 4 operações desta importação, em 6 saídas.», e depois aparece «Importação desfeita: 4 operações apagadas.»
   - Depois arquive «Teste 3b Forex» e «Teste 3b B3».
   - Os modelos ficam salvos: BlackArrow, BlackArrow · B3, Match-Trader e Tradovate. A 3b não tem uma lista de modelos. Se quiser apagá-los, é um delete de uma linha que você mesmo cola.

«Para qual conta?» (um arquivo sem conta escolhida) só aparece quando não há nenhuma conta ativa, então não entra neste teste. Os testes cobrem essa tela.

Se algo diferente aparecer, pode ser por estes motivos:
- Uma operação que você registrou na Apex #1 nesses dias aparece como «já registrada por você».
- Um fuso já confirmado na Apex #1 vem marcado.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
