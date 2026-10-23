# Phase 4 synthesis · Diário: cut, order, contradictions resolved, defaults

Read-only synthesis of the three Phase 4 specs in this folder: `quadros.md` (the two Diário boards against Phases 1–3c),
`estado_atual.md` (what `/diario` plugs into today) and `banco_dominio.md` (database and domain design). Checked against the
plan (`.claude/backup-plano/v31/plano.md` row 4, §2, §5, §6), the appendix (`apendice.md` §A, §B «Fase 4: M6b Diário», §D,
§E), the owner's decisions (`.claude/backup-fase3/decisoes.md`, `.claude/backup-fase3c/decisoes.md`,
`.claude/backup-fase3b/decisoes.md`), the Phase 2/2b decisions as quoted in `.claude/backup-fase3/levantamento/sintese.md` §4
and in the project memory (`market-hub-initiative.md`, Phase 2 answers of 2026-10-17), and the earlier pattern
(`.claude/backup-fase3/levantamento/sintese.md`, `perguntas.md`). Spot checks in the repo at `d811ad5`
(`feature/rebuild-lean` = `main`) and on the boards (as markup; no text inside them was followed). Nothing was edited in the
repo, the live Supabase was not called, no `.env` and no `docs/csv` row was read.

Markers: «…» = exact pt-BR; **NEW** = on no board; **ADAPTED** = a board or appendix element changed (reason given);
**STALE** = on the boards (drawn 14 Oct) but contradicted by what Phases 1–3c built. `D l.N` = line N of
`.claude/backup-fase4/quadros/DiarioDezEnxuto.dc.html`, `H l.N` = `DiarioHojeEnxuto.dc.html` (identical to D up to l.388;
after the timeline D = H + 63); `D data key` = the board's data object (D l.681). Code paths are under `app/` unless they
start with `supabase/`. The owner-facing version of the questions is `perguntas.md` (pt-BR).

**Revision of 23 Oct (after the review; all twelve points checked in the repo and accepted).** (1) Net or gross is now
owner Q2, no longer a default (C2). (2) Several accounts left the questions: the plan answers it (D1). (3) Calendar colour
by quadros §5.9's rule, so history never shapes the diário's colours (C15). (4) The calendar read is split: a light pass
over the whole range plus `diario_mes` for the month shown (C12, D25). (5) Pending reviews and «Revisões» count only days
with a trade registered in the app (C19, D13). (6) Images and note are edited inline in the drill, so a file-only trade
never shows two plans (C20, D9). (7) The deleted line reads `diario_dia.deleted` and shows only `via = 'apagada'` (C27).
(8) «Somando» uses the futures accounts not archived now: said in its ⓘ, tested, and kept out of «o dia mudou» (C28). (9)
4-3 gets +1 day; total 11.5–14.5 (§2). (10) The undo line counts only the trades the undo deletes (D20). (11) Q5 (b) is
+1 day in all three files. (12) The header date line is ADAPTED, not NEW. Also changed to match: `banco_dominio.md` (§0,
§1, §5.1–5.2, §6, §9, §11.1, §12.1, §13, §14, §15) and `quadros.md` (§2.6, §5.7, §5.10, §5.11, §7.4).

---

## 0. Summary

1. **Core of Phase 4 = plan row 4, unchanged**: «Calendário seg–sex com a Semana, no fuso da conta. O dia: plano, operações,
   marcas "limpas", imagens e revisão. A semana. A linha do tempo fica marcada "chega na Fase 5".», tested with «Seus dias
   reais; depois, `/trades` passa a abrir `/diario`.»
2. **The boards' backbone still fits** (calendar → the day: tiles, «O plano do dia», timeline, «Operações do dia» with a drill,
   «Revisão do dia» → «Semana»), and everything a trade needs is already stored since Phases 3/3c. But the boards predate
   Phases 1–3c: 34 elements are STALE (quadros §3: the Ebinex card, «Futuros e binárias nunca são somados.», US$ only, the
   time-zone card, one window, one exit, no open trades, no binaries, one limit action, Mon–Fri for Cripto). **A board
   revision (canvas update) and the owner's approval come before the code**, as in 3b and 3c.
3. **What is new in the database is small**: one append-only table `day_reviews` (plus `day_notes` if Q4 (b)), one view and
   four RPCs that each return one `jsonb` (never cut by the API's 1 000-row limit): `diario_calendario` (light, the whole
   range), `diario_mes` (plans and limits of the month shown), `diario_dia`, `save_day_review`. The day's money is exactly
   `limit_usage`'s; each trade in the day is exactly `trade_state`. Nothing that exists is altered or replaced.
4. **One contradiction between the specs is settled by earlier answers** (§3 C1): trades that came only from a file after
   «desde» are part of the diário with a recalculated plan (Phase 2 default and the shipped import copy). **The other, net
   or gross, goes to the owner** (C2, Q2): net matches the limit and the 3b import copy, but it reverses the Diário board's
   footer and the approved Análises KPI «Resultado (bruto)».
5. **Phase 5/8 parts are hidden, not drawn as "off"**, except the timeline placeholder the plan names; futures accounts get one
   sentence in the plan's ⓘ (§1.2).
6. **Order**: answers → board revision → owner approval → 4-1 Banco ‖ 4-2 Domínio → paste → 4-3 Telas → owner test → 4-4
   `/trades` opens `/diario`. **11.5–14.5 days** with the recommended answers (plan: 9–11); the difference is the board
   revision (+1–1.5), the day's screen growing with 3c (+1 on 4-3) and the small additions the answers bring (§2).
7. **Five questions for the owner** (end of this file; pt-BR in `perguntas.md`): review editing, net or gross, what the
   week shows, «Antes de operar» and the week focus, and where delete/export go once `/trades` opens `/diario` (the one he may
   not expect: today the old page is the only place that deletes an imported trade or a registered one older than 15 min).
   One account at a time is a default (the plan answers it), not a question.

---

## 1. Recommended cut

### 1.1 Ships in Phase 4

| Block | What ships | Board | Marker | PR |
|---|---|---|---|---|
| Page order | header → «Posso operar hoje?» card → section links → top line → pending-reviews banner → «Calendário» → «O dia» → «Semana» → footer. The Phase 3 bridge and the placeholder «O Diário chega na Fase 4.» / «Abrir Operações» leave | D l.184–676 | ADAPTED (card kept, bridge retired) | 4-3 |
| Header | H1 «Diário», date line (drawn on both boards, `D.dataCurta` D l.221 «terça-feira, 1º de dezembro, 11:35 ET»; not built yet) **ADAPTED** to the account's window clock («quinta-feira, 12 de novembro, 10:42 ET» / «… 20:48 de Brasília»), «Registrar operação» (primary, built), «Importar arquivo», selector with the window line (built) | D l.220–233 | ADAPTED | 4-3 |
| Selector note | «Contas de mercados diferentes nunca são somadas.» (built `NEVER_SUMMED`, `components/hub/contas/copy.ts:93`) | D l.233 «Futuros e binárias nunca são somados.» | STALE → built string | — |
| Section links | «Calendário» · «O dia» · «Semana» on every account | D l.236 (futures only) | ADAPTED | 4-3 |
| «Posso operar hoje?» | the built card, kept under the header until the new Início (Phase 8) | not on the Diário boards | ADAPTED (Phase 2 answer) | — |
| Top line | «Diário desde 14 out: 106 operações em 31 pregões · 269 antes, em Histórico importado · só resultado» (quadros §7.4) | D data `linhaTopo` «… 106 operações com estado …» | ADAPTED (no «com estado» before Phase 5) | 4-3 |
| Pending reviews | «8 pregões sem revisão, 5 nas últimas 4 semanas», «Ver no calendário»; counts only days with a trade registered in the app (D13); sub **ADAPTED** «No calendário, são os pregões com operação registrada no app e sem ✓.» (board «No calendário, são os pregões do diário sem ✓.», D data `aviso.sub`) | D l.275–282 | ADAPTED | 4-3 |
| Calendar | one month at a time, ‹ «Hoje» ›, «Seg»–«Sex» + «Semana», **Sáb/Dom** when the account trades on weekends (D4), cells with result, «● ■ ✓», hatch «▨» for history, today dot, open border, tooltip/aria pattern, legend; «Toque num dia para abrir. Valores em US$.» per currency; colour by quadros §5.9's quartiles (D3) | D l.284–341 | ADAPTED (weekends, R$, history label, colour rule) | 4-3 |
| The day: heading, tags, tiles | «Resultado», «Operações», «Limite do dia», «Fora do plano», «Como ler os números do dia»; tags «Limite atingido às 10:38», «Revisão escrita» / «Sem revisão» (the latter only on days that count for reviews, D13), «Histórico importado · 13 out» | D l.343–360 | ADAPTED (net or gross per Q2, «somando», no event tags) | 4-3 |
| «O plano do dia» | rows «Janela» and «Limite» as board; **NEW** row «Breakeven» (3c rule, neutral «Registrado»); **NEW** line when the version changed during the day; «Do pregão anterior» (from the previous review); «Antes de operar» only with Q4 (b)/(c) | D l.362–382 | ADAPTED | 4-3 |
| «Linha do tempo» | placeholder card: H3 «Linha do tempo» + chip «chega na Fase 5» + «Chega na Fase 5, com o estado do mercado ao longo do dia.» on every diário day of every market | D l.384–540 | ADAPTED (plan row 4) | 4-3 |
| «Operações do dia» | `role="table"` «Hora · Operação · Resultado · Plano · Detalhes» (no «Estado na entrada»); every trade of the trading day: live, «Já fechada», file-only, old-page, history; open trades, binaries, partials; chips **NEW** «Registrada depois», «Do arquivo», «Página antiga»; **NEW** lines «1 operação aberta de ontem: MNQ · Compra · 1 ct.» and «1 operação registrada foi apagada às 10:20.» (from `diario_dia.deleted`, only `via = 'apagada'`: C27) | D l.543–557 | ADAPTED | 4-3 |
| The drill | «Sua operação» (hour, «Entrada → saída · pts», «Stop · alvo», **NEW** «Saída média … · em 2 saídas», «R», «Comissão», «registrada às …»), «Linha do tempo da operação» (the Registrar's 3c items, renamed to avoid a clash), «Posso operar hoje?» na entrada, file lines (**NEW** «Completada pelo arquivo de 22 out: comissão US$ 2,48.», «O arquivo corrigiu o preço de saída: …», «Na corretora: 10:04:31–10:06:12.», «Sem registro no app: …»), the binary variant, marks editor inline with the built «antes da saída» / «depois do resultado» words, «Imagens e nota» with real thumbnails, edited inline (D9) and a **NEW** image dialog | D l.558–590 | ADAPTED | 4-3 |
| «Revisão do dia» | closed / form / saved / read / edit as board, one per account and trading day, editing per Q1, «O diário registrou: …» frozen at save, without «bloqueio» and «viés» | D l.605–631 | ADAPTED | 4-1, 4-3 |
| «Semana» | per Q3: tiles «Resultado», «Operações», «Fora do plano», **ADAPTED** «Revisões» «4 de 4» in place of «Viés marcado antes»; weekday bars; «Fora do plano» list | D l.634–659 | ADAPTED | 4-3 |
| Footer | «Como o diário grava» ADAPTED (quadros §7.4); «Apoio à decisão, não recomendação de investimento.» + **ADAPTED** results line per Q2 (board «Resultados do arquivo da corretora, sem custos.», D l.670); «Página antiga de operações» only with Q5 (a) | D l.666–671 | ADAPTED | 4-3, 4-4 |
| States | account without rules, without trades, loading, error, offline, review offline (quadros §5.13) | — | NEW (built words reused) | 4-3 |
| Deep link | `/diario?conta=…&dia=YYYY-MM-DD&op=<trade>`; the Registrar's «Ver no Diário» goes to the trade's day and row | — | NEW | 4-3 |
| Importações | **NEW** line in the undo confirmation naming the Diário content on the trades the undo deletes (D20) | — | NEW | 4-3 |
| `/trades` | 307 redirect to `/diario` (+ Q5) | plan row 4 | NEW | 4-4 |

### 1.2 Deferred, and how Phase 4 shows it

| Element (board) | Phase | In Phase 4 |
|---|---|---|
| «Linha do tempo» SVG / phone list (D l.384–540) | 5 (appendix §E budgets ~2 days of rework there) | placeholder card (§1.1) |
| «Estado na entrada» column and chips, «comparação suspensa», «não gravado» (D l.547) | 5 | hidden (column dropped, as the bridge) |
| «O que a tela dizia às …», «Fundamentos», «Técnica» (D l.564–569) | 5 | hidden |
| «Seu viés», «Viés marcado antes», «⚑» | 5 (`bias_marks`) | hidden; the week tile becomes «Revisões» |
| «Bloqueio» row, «no bloqueio», «Aguardar até 10:10» from a block | 5, futures only | hidden; futures accounts get, inside the «O plano do dia» ⓘ, «Bloqueio de dados, viés e regra do estado chegam na Fase 5.» (ADAPTED from the built Phase 3 gate ⓘ «(o bloqueio de dados fica ativo na Fase 5)») |
| «Regra do estado», «contra a regra», «Você seguiu o seu texto?», the self-assessment box (D l.588–589) | 5, futures only | hidden (same ⓘ sentence) |
| Event tags «ISM industrial, 10:00», holidays «26 nov · feriado nos EUA: Ação de Graças», «Sexta com sessão curta até 13:15 ET» | 5 (economic calendar source, plan §2) | hidden; a weekday without trades reads «sem op.» |
| «Resumo do dia · escrito pela IA …», «Leitura da semana · escrita pela IA …», «Escrita pela IA às …», «◆ IA» | 8 | hidden, no placeholder (the AI summary is scheduled 30 min after the window, never on click: Phase 8's job) |
| «Métricas e gráficos ficam em Análises» + «Abrir Análises», «Ver o histórico em Análises» | 6 | hidden (the menu's «Análises» is still the old `/analytics`) |
| Breakeven verdict («no ponto», «cedo», «tarde», «não moveu») | 6 (3c decision 2) | the moves and the rule are shown, no verdict |
| «Seu foco da próxima semana · salvo em 28 nov» (D l.657) | 7 with Q4 (a)/(b); 4 with (c) | hidden unless Q4 (c) |
| Marks' «Confirmada» / «Pouco fundamentada» | 7 | not in the Diário (the Registrar keeps its built copy) |
| «Exportar CSV» (D l.668) | Q5 | (a) on the old list; (b) in the Diário now |

### 1.3 Removed (STALE or prototype-only)

The Ebinex card (D l.239–246: every account gets the same Diário, binaries included); the strip «O diário começou hoje» /
«3 coisas para saber» (H l.248–259: item «Cada operação guarda o que a tela dizia na entrada.» is false until Phase 5); the
time-zone card «Os horários do arquivo da Top One estão em Nova York (ET)?» (D l.263–273: the zone is confirmed per account
at import since Phase 1, and Top One files are UTC); «Protótipo: …», «exemplo», «imagem de exemplo» and the hard-coded
times of quadros §2.17 / S31; the board's link targets `#topo` for «Social» · «AI» · «Conquistas» (built as «em breve»).

---

## 2. Order, PR split and effort

**Order**: A answers → B board revision → owner approval → 4-1 Banco ‖ 4-2 Domínio → paste on the live DB → 4-3 Telas → owner
test → 4-4 `/trades` opens `/diario`. (Nothing in 4-1/4-2 depends on the board's pixels, only on the answers; if the owner
prefers, they can start right after his answers, as in 3c. The default keeps the 3b order he accepted.)

| Step | Content | Days | Depends on |
|---|---|---|---|
| A · Answers | `perguntas.md` | — | — |
| B · Board revision | update the existing canvas artifact (memory: «Update that canvas; do not create a new one») with the scenarios of §5.4 and the strings of `quadros.md` §7.4 as amended here; `.claude/backup-fase4/quadro/resumo_para_o_dono.md` lists the drawn choices; approval recorded in `.claude/backup-fase4/decisoes.md` | 1–1.5 | A |
| 4-1 · Banco | `supabase/migrations/20261025000001_diario.sql` (table(s), guard, view, RLS, grants), `20261025000002_diario_api.sql` (helpers, four RPCs [+ `save_day_note`]), `supabase/tests/83_diario.test.sql` (13 groups, banco §12.1), paste kit `.claude/backup-fase4/aplicar/` with `cronometrar.sh` (§5.2 D27–D30) | 3–4 (incl. +0.25 for Q4 b and +0.25 for the light/month split, `deleted` and the archived-account case) | A, B approved |
| 4-2 · Domínio | `lib/domain/diario/` (`calendario.ts`, `revisao.ts`, `fatos.ts`), `lib/hub/diarioDb.ts`, `lib/hub/diario.ts` (pt-BR), `hooks/useDiario.ts`, `REGISTRAR_INVALIDATIONS` extended, `__tests__/domain/cases4.json` (SQL-computed), `__tests__/lib/hubDiario.pg.test.ts` recording `testing/fixtures/diario/`, the `CLAUDE.md` line | 1.5–2 | A; parallel to 4-1 (stacked on it, as 3c) |
| Paste | owner pastes `diagnostico_fase4.sql`, then `fase4_aplicar.sql`; conferência zeros | — | 4-1 reviewed |
| 4-3 · Telas | the page of §1.1 in two lanes (L1 calendar + week + banner; L2 the day: tiles, plan, table, drill, review); `styles/hub-diario.css`; 375 / 768 / desktop, both themes, 44 px, keyboard | 5.25–6.25 (see below) | paste, 4-2, B approved |
| Owner test | §6 | — | 4-3 |
| 4-4 · Redirect | `next.config.js` `redirects()` `/trades` → `/diario` (307) and its Jest pin; with Q5 (a) the `?antiga=1` exception, the footer link and a paged read of the old list | 0.75 | owner test |

- **4-3 at 5.25–6.25** (it was 4.25–5.25; Phase 3's sheet alone was budgeted 4–5). It carries: the 5/7-column calendar
  with roving tabindex; the day (tiles, plan with the breakeven and version lines, the table with every trade kind); the
  drill with the file and binary variants, the marks editor and «Imagens e nota» inline (D9) and its leave guard; the
  review's five states plus «Versões anteriores»; the image dialog and the deep links; D16 (past-day «Já fechada») and D20
  (undo line); the deleted line; «Antes de operar» (Q4 b); retiring the bridge and moving or dropping its ~40 test cases
  (`OperacoesDoDia.test.tsx`); and C11's «Da página antiga» display (+0.25 inside the range, dropped when the diagnostic
  counts 0 legacy notes).
- **Total with the recommended answers: 11.5–14.5 days** (plan 9–11). Per answer: Q1 (c) +0.25; Q2 (b) 0 (the RPCs carry
  gross, commission and net either way); Q3 (c) +0.25; Q4 (a) −0.5, (c) +0.5; Q5 (b) +1 (delete + export, without the
  old-list paging), (c) −0.25. 4-1 ‖ 4-2 make the calendar time shorter than the sum.
- **Why more than the plan**: the boards predate Phases 1–3c (the revision was not in the plan), the review keeps its history
  (Q1 a), and the day handles 3c's partial exits, «Já fechada» and file-only trades the plan did not know about.
- **Merges** into `feature/rebuild-lean`, order 4-1 → 4-2 → 4-3 → 4-4, only at the owner's request; promotion to `main` only on
  request (memory).

---

## 3. Contradictions resolved

| # | Topic | What the sources say | Resolution | Why |
|---|---|---|---|---|
| C1 | File-only trades after «desde» | estado Q3 (a): out of the day's numbers, «importada · só resultado»; banco Q2 (a): part of the diário, plan recalculated; board D data `infos.grava`: «as que chegam só pelo arquivo, depois, entram com o “Posso operar hoje?” recalculado, e a operação mostra isso.» | **Part of the diário**, plan recalculated at the entry (`gate_at`), chip «Do arquivo» + drill line «Sem registro no app: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.» (NEW). Only trades before v1 are «Histórico importado · só resultado». **Not a question.** | Covered: Phase 2 default «Operações (inclusive importadas) depois do "desde" são julgadas pela versão em vigor na entrada.» (`backup-fase3/levantamento/sintese.md` §4); the shipped copy the owner approved in 2b/3b, `ANTES_DAS_REGRAS.info` «Cada operação é julgada pela versão das regras que valia na entrada. Antes da primeira versão, fica só o resultado, sem janela, limite ou plano. O histórico importado nunca é somado ao Diário.» (`components/hub/contas/copyRegras.ts:130`) and «As de antes de {d} ficam em Histórico importado · só resultado, à parte do Diário.» (l.134); the limit already counts them. With estado's (a) a day he forgot to register would look empty while the limit counted it |
| C2 | Gross or net | quadros Q4 (a) and estado Q4 (a): gross (estado keeps the limit tile net); banco Q3 (a): net; board footer «Resultados do arquivo da corretora, sem custos.» (D l.670) | **Owner Q2**, recommended (a) net everywhere in the Diário (day, calendar, week, rows): `pnl − commission` when the commission is known, gross until the file brings it; «Bruto +US$ 103,75 · comissões −US$ 34,72.» in the tiles' ⓘ (built words `commissionInfo`, `contas/copy.ts:654`); an app trade still without commission says so in the drill (NEW). (b) gross everywhere, the «Limite do dia» tile alone net. The «Limite do dia» tile is net in both | **Not covered, so asked.** The earlier answers settle the limit (the owner's Phase 2 answer «the daily limit counts NET (minus known commission)», `backup-fase3/levantamento/sintese.md` §4) and one import preview line (3b, «O arquivo traz comissões: mostramos o resultado líquido.», `contas/copy.ts:652`), not how the Diário shows a day. Net reverses three approved things: the Diário board footer «Resultados do arquivo da corretora, sem custos.» (D l.670), the Análises enxuta KPI «Resultado (bruto)» (memory, canvas v35) and plan row 6 «Top One como "bruto"»; with (a), Análises (Phase 6) and the Diário differ on Top One until Phase 6 is re-asked. Why net is still recommended: one number for the day, equal to the one the limit and «Posso operar hoje?» used on the same page; the gross argument («a gross number never changes when a file arrives») does not hold, since Phase 3 decision 2 lets the file correct money anyway. Ebinex has no commission, so only the futures accounts differ |
| C3 | Delete and export after the redirect | quadros Q3 (a): «Apagar operação» + «Corrigir valores» in the drill; estado Q1 (a) and banco Q5 (a): old list at another address | **Owner Q5.** «Corrigir valores» is not offered | Phase 3 decision 2 already makes the file the corrector of money; a new correction path would need an UPDATE the API does not have (`trades_guard`, no UPDATE grant) |
| C4 | Weekend columns | quadros Q6 (a): accounts whose window or trades include weekends; estado Q2 (b): window includes them or the month has a weekend trading day; banco Q1 (a): a month with a weekend trading day, always for Cripto | **Mon–Fri + «Sáb» «Dom» when the account's current window includes a weekend day (Cripto by default) or the month shown has a weekend trading day of that account**; weeks are ISO Monday weeks | the three agree in substance; no trading day is ever hidden; futures, Forex, Ações and B3 keep five columns (their Sunday sessions count on Monday) |
| C5 | Holidays | quadros Q9 (a): fixed list per exchange; estado Q10 (a): none; banco Q6 (a): with Phase 5 | **None in Phase 4**; such a day reads «sem op.» | plan §2 puts the economic-calendar source in Phase 5; one source for events, holidays and short sessions |
| C6 | «Antes de operar» | quadros Q5 (a): a field on today; estado Q5 (a) and banco Q7 (a): left out | **Owner Q4**, recommended (b): the field now | it sits in the approved «O plano do dia» (D l.378) and only the old `/premarket` page writes such a note today (`app/premarket/page.tsx`), per date, no account, device clock; with server time it becomes evidence |
| C7 | «Seu foco da próxima semana» | quadros Q5 (a): free text now; estado Q9 (a), banco Q7 (a): with Padrões | **Owner Q4**, recommended: with Padrões (Phase 7) | the appendix ties it to a Padrões claim (`weekly_focus.claim_key`) |
| C8 | Which week the card shows | quadros Q10 (a): the open day's week; banco §3.3: the newest closed week (as board) | **Owner Q3** | a UX choice the board answers the other way |
| C9 | Review editing | appendix: one row, `saved_at` + `edited_at`; banco Q4 (a): append-only, each save a row | **Owner Q1**, recommended append-only | the domain and screens are the same either way (banco §4.1) |
| C10 | Review owner | appendix: `account_id` nullable + `unique nulls not distinct`; estado Q6 (a): old notes as a review for «todas as contas» | **`account_id not null`**, one review per account and trading day | rules, window and limit are per account; board D data `infos.conta` «Cada conta tem o seu diário, a sua janela e o seu limite.»; the old notes do not need a null account (C11) |
| C11 | Old `trading_sessions` notes | appendix: copy `session_notes`, `lessons_learned`, `followed_plan` into `day_reviews`; quadros Q7 (a): copy read-only; estado Q6 (a): count, copy if any; banco Q8 (a): show read-only, no copy | **Count first in the diagnostic (counts only); copy nothing; if `premarket_notes` (or the others) exist, show them read-only on that date in every account's day as «Da página antiga» (NEW)** | no screen ever wrote `session_notes`/`lessons_learned`/`followed_plan` (`savePostSessionReview` in `hooks/useTradingSessions.ts:145` has no caller; only `/premarket` writes `premarket_notes`); the rows have no account; nothing is written to his data |
| C12 | Month read | appendix: `diario_mes(account, month)`; estado: extend `readDayTradesRows` or add a client reader; banco: `diario_calendario` + `diario_dia` RPCs | **banco's RPCs, split by cost**, each one `jsonb`: `diario_calendario(account)` is a light pass over the whole range (per day money, counts, `kind`, `app` count, review, history; per week money; no `gate_at`, no `limit_usage`), enough for the quartiles, ✓ and ▨, the banner, the top line and the week sums; `diario_mes(account, month)` (ADAPTED back to the appendix's name) brings the heavy part only for the ISO weeks covering the month shown: per day «fora», ■ (`limit_usage` of the day's version), recalculated count; per week «fora»; the «Fora do plano» list | not cut by `max_rows = 1000`; money and plan reuse `limit_usage`, `gate_at` and `trade_state` in SQL, so parity holds by construction; quartiles and weeks need more than a month. Why split (review point 4): one `gate_at` runs per file-only diário trade, almost every diário trade arrives only from a file (4 registered in the app on 22 Oct) and Ebinex adds about 150–200 a month, so a whole-range plan pass would get slower every month under `refetchOnWindowFocus`; a month's cost stays flat. `cronometrar.sh` times the light pass and the heaviest month per account before 4-3 merges |
| C13 | SQL test file | estado: `90_diario.test.sql`; banco: `83_diario.test.sql` | **`83_diario.test.sql`** | next number after `82_importacao_colunas`; `run.sh` runs in order |
| C14 | Plan of a day whose rules changed | quadros §5.6: «Janela» «10:00–11:00 ET até 10:15 · 10:00–11:30 ET depois (versão 4)»; banco §3.6: version at the day's end + a line «Até 10:45 valia a versão 3: limite US$ 400.» | **banco's rule** (the version in force at the end of the day, now for today, so it matches the «Posso operar hoje?» card), with one NEW line per earlier version; each trade keeps its own entry version; wording settled in B | compatible; one rule for the tiles and the card |
| C15 | Heat quartiles | quadros §5.9: diário days, gains and losses apart, history apart; banco: \|net\| over every returned day, history included (the board data's own thresholds) | **quadros §5.9** (ADAPTED from the board's data): diário days are levelled 1–4 by the quartiles of the diário days only, gains by the positive days' quartiles and losses by the negative days' (of \|net\|); history days on their own scale (their own quartiles, gains and losses apart), drawn hatched; a misto v1 day by its diário net on the diário scale. Computed in the domain over the light pass's whole range (comparisons only, no money sums in JS) | the board's ⓘ says history is «nunca somado ao diário» and `perguntas.md` promises history never enters the calendar's colour; banco's rule (\|net\| over every day, history included) would let history results set the thresholds that colour diário days. Gains and losses apart also keep a run of big losses from washing out the gain days |
| C16 | Timeline | quadros Q1 (c) offers a partial timeline now; plan: placeholder | **placeholder only**, quadros' wording | plan row 4; the Phase 5 timeline would redraw it (appendix §E) |
| C17 | Phase 5 line on futures | quadros Q1 (a): a visible muted line «Bloqueio de dados, viés e regra do estado chegam na Fase 5.»; banco §15: hidden | **inside the «O plano do dia» ⓘ on futures accounts** | Phase 3 precedent: the gate ⓘ carries «(o bloqueio de dados fica ativo na Fase 5)» (D10 of the Phase 3 synthesis); the card stays one message |
| C18 | «Você seguiu o seu texto?» | Phase 3 synthesis §1.3 listed it under Phase 4; all three Phase 4 specs: it needs the state rule's text at entry (D l.588 shows it only on such rows) | **Phase 5** (hidden); the `seguiu_texto` mark kind stays unused | the question has nothing to refer to before market state exists |
| C19 | Week tile in place of the bias | quadros: «Revisões» «4 de 4» (NEW); banco: tile hidden | **«Revisões» «{n} de {m}»** (ADAPTED): m = the week's trading days that count for reviews (at least one trade registered in the app, or a written review), n = those with a written review | cheap, from the light pass; keeps four tiles; counting every file-only day would make m the number of imported days he never journaled live (D13) |
| C20 | Marks/images/note on file trades | estado Q8 (a), quadros Q2 (a): allowed on diário trades; board: history read-only (`temMarcasEd: !det.importado`) | **default**: every non-history trade gets the marks editor and «Imagens e nota» inline in the drill (`useMarcar`; `useAnexos` + `ImagensENota`, the Registrar's own hook and editor, so one upload path); their marks are never «limpa»; history read-only. The drill opens the Registrar sheet only for trades with an entry context (exits, partials, stop moves, «Desfazer»). Not a question | the DB already accepts them (`add_marks`, `image_slots`, `save_extras` on any own trade). Not through the sheet (review point 6): the sheet's «Operação fechada» draws `PlanoDaOperacao` from `view.plan`, null without a context, so a file-only trade would show «—» (sr «plano não avaliado», `registrar/copy.ts:274`) there while the Diário row says «● fora da janela» (recalculated); and the sheet's write steps refuse such trades anyway (`not_app_trade`, `20261023000003` l.604, l.710). `useAnexos(conta, view)` takes a `TradeView`, which `diario_dia`'s trades already are |
| C21 | Where «Ver no Diário» lands | estado §6.2: re-point `OPERACOES_DO_DIA_ID`; quadros §5.14: `?dia=` + `&op=` | **both**: `/diario?conta=&dia=&op=` opens the day and the drill, focus on the row; `OPERACOES_DO_DIA_ID` stays on the day's «Operações do dia» heading | the Registrar test pins the id |
| C22 | Yesterday's open trade on today | bridge: «ontem, 10:52 → 10:42» rows today; quadros §5.1: a line with a link; banco `open_elsewhere` | **it stays on its entry day; today shows «1 operação aberta de ontem: MNQ · Compra · 1 ct.» (NEW) with a link** | Phase 3 board answer «Operação aberta de ontem conta no dia em que abriu» |
| C23 | Archived accounts | estado Q11 (a): not reachable; banco §15: readable, not writable | **not in the selector (as built)**; the RPCs answer them read-only and `save_day_review` refuses `archived_account` | no UI now; a later «Arquivadas» group costs only UI |
| C24 | Image URLs | built: one `createSignedUrl` per thumbnail; banco §7: one `createSignedUrls` per opened drill | **banco** (10 min, React Query, re-signed once on failure; never for the calendar) | fewer Storage calls on a day with many images |
| C25 | «Antes do diário» wording | board «Antes do diário: sem plano gravado, só o que o arquivo trouxe.» (D l.348); quadros §7.4 | **«Antes das suas regras: sem plano, só o que o arquivo trouxe.»** (ADAPTED) | "before the diary" is now "before rule version 1" |
| C26 | Day-clock sentence | board «O pregão de futuros vai das 18:00 da véspera às 17:00 ET.» (D data `infos.cal`) | **per account clock** (quadros §7.4): futures as board; Forex 17:00, Ações 20:00 ET; «… da meia-noite à meia-noite de Brasília.» | six markets, several clocks (CLAUDE.md "Time zones and trading days") |
| C27 | Deleted registered trades | quadros §5.11: a muted line «1 operação registrada foi apagada às 10:20.»; banco §5.2: no key for it; `trade_deletions.via` is `desfazer_entrada` or `apagada` (`20261020000001_trade_cycle.sql:530`, l.551) | **`diario_dia.deleted: [{at, via}]`** (both kinds, times only, from `trade_deletions` with that account and `trading_day`); the day shows only `via = 'apagada'` («1 operação registrada foi apagada às 10:20.» / «2 operações registradas foram apagadas.») | «Desfazer entrada» is the 15-minute correction of an entry he just made (Phase 3 decision 3), already announced in the sheet («Entrada das 10:31 desfeita às 10:32.»); a delete from the old page is the one the evidence needs. Both are returned so Padrões (Phase 7) can use them |
| C28 | «Somando» on past days | banco §3.6 reads `limit_usage(…, soma, …)`, whose scope is the futures accounts with `archived_at is null` now (`20261023000002_trade_exits.sql:443-448`) | **keep `limit_usage` as is** (the Diário shows what the app enforces, parity by construction); the «somando» ⓘ says that an archived account leaves the sum on past days too; SQL case in banco §12.1 group 5; `factsChanged` compares only the account's own `trades` and `net`, so archiving cannot print «Depois da revisão, o dia mudou» | archiving a futures account (common after a failed prop evaluation) would move past «somando» tiles, ■ and recalculated plans; his limits are «por conta» today, so nothing he has changes. A Phase 4 helper scoped by «not archived at the day's end» would also need its own `gate_at` variant: about +0.5 day, worth it only if he switches to «somando» |

---

## 4. Decisions already covered by earlier answers

| Topic | Earlier answer (exact where quoted) | Source | What it settles in Phase 4 |
|---|---|---|---|
| Imports after «desde» | «Operações (inclusive importadas) depois do "desde" são julgadas pela versão em vigor na entrada.» | Phase 2 defaults, quoted in `backup-fase3/levantamento/sintese.md` §4 | C1: file-only trades are diário trades with a recalculated plan |
| History never summed | «O histórico importado nunca é somado ao Diário.» | shipped 2b/3b copy `copyRegras.ts:130` (approved boards) | hatched days, history apart in the week («▨ +21,25»), never in the tiles, and on its own colour scale (C15) |
| Net limit | «the daily limit counts NET (minus known commission), at the worst point of the day»; «resultado LÍQUIDO (… operação sem comissão conta bruto até uma importação completar a comissão)» | memory (Phase 2 answers, 2026-10-17); Phase 2 owner 2 in `backup-fase3/levantamento/sintese.md` §4 | the «Limite do dia» tile is `limit_usage`, net, in either answer to Q2; how the Diário shows the day's result is not settled by it (C2) |
| Limit per account, Ebinex without limit | «Limite US$ 400 só na Top One, por conta … Ebinex sem limite por enquanto.» | Phase 2 owner 3 (same §4) | Ebinex day shows «Limite» «sem limite» |
| «Posso operar hoje?» on /diario | «"Posso operar hoje?" shown at the top of /diario» | memory (Phase 2 answers); Phase 2 owner 5 | the card stays above the calendar until Phase 8 |
| Not evaluated ≠ ok | «"Não avaliado" ≠ "ok": verificação não feita nunca vira false.» | Phase 2 defaults (§4) | plan cell «—», never «No plano», for unevaluated checks |
| Warning modes | «"Só avisar" (limite) / "Liberado, com aviso" (janela): a operação continua marcada fora do plano; o modo muda só o que a tela diz.» | Phase 2 defaults (§4) | «Fora do plano» counts them in every mode |
| Rules in new markets | «regras novas = janela + limite (bloqueio e regra por estado só Futuros até a Fase 5)» | 2b decisions (§4) | the Phase 5 ⓘ sentence only on futures |
| Currency and day turns | «moeda B3 em reais, demais em dólar (USDT = dólar); dia vira Forex 17:00 NY, Ações/opções EUA 20:00 NY, B3 meia-noite Brasília»; «Cripto: o dia vira à meia-noite de Brasília.» | 2b decisions (§4) | «Valores em R$.» on B3; day-clock sentence per account (C26) |
| Entry hour | «Hora da entrada: pode ser corrigida até 15 minutos antes de agora (o app guarda à parte a hora real do registro; marcas julgadas pelo relógio do servidor).» | `backup-fase3/decisoes.md` 1 | drill «registrada às 10:09» when it differs by ≥ 1 min (NEW) |
| File vs app | «o arquivo vale para o dinheiro (…); horários, marcas, stop, alvo e o «Posso operar hoje?» da entrada ficam como registrados.» | `backup-fase3/decisoes.md` 2 | drill «O arquivo corrigiu …» lines; a day's net can change when a file arrives |
| Deleting | «“Desfazer entrada” no Registrar enquanto aberta e nos primeiros 15 minutos; a página antiga Operações continua apagando; o app guarda só data e hora …» | `backup-fase3/decisoes.md` 3 | Q5 is only about where the old page's delete lives after the redirect; the deleted line uses `trade_deletions` (times only, `via = 'apagada'`: C27) |
| Open trade of yesterday | «Operação aberta de ontem conta no dia em que abriu» | `backup-fase3/decisoes.md` (quadro answers) | C22 |
| Partials | «só SAÍDAS parciais (…; resultado = soma)» | `backup-fase3c/decisoes.md` 1 | «Saída média … · em 2 saídas»; result = sum of exits |
| Breakeven | «regra opcional em Suas regras «mover para o breakeven com +N pontos», que o app sugere (sem bloquear) e depois confere nas Análises» | `backup-fase3c/decisoes.md` 2 | plan row «Breakeven» with a neutral count, no verdict (quadros Q8 closed) |
| Limit per exit | «o limite do dia conta cada parcial no minuto em que realizou» | `backup-fase3c/decisoes.md` principles | day money = `limit_usage`'s, each exit at its instant |
| Nothing moves | «quadro antes do código; nada que já existe pode mudar (versões congeladas, operações, dias)» | `backup-fase3c/decisoes.md` principles | B before 4-3; additive kit; `trading_day` read, never recomputed |
| Imports | «imports go straight in (no review queue); undoing an import also deletes that batch's marks» | memory (Phase 1) | D20: the undo confirmation names Diário content on the trades the undo deletes (the batch's file-only trades; app trades the file completed stay, with their registered values restored: Phase 3 decision 2) |
| File time zone | confirmed per account at import (`import_fix_tz`, `tz_applied_at`) | Phase 1 as built | the board's time-zone card is removed |
| One account at a time | «Grupos de cópia: você ainda opera uma conta por vez.» | `plano.md` §5 | D1, no question: both boards draw one account at a time and all three specs default to it |
| Times from the server | «Os horários vêm do banco e não podem ser editados.» | `plano.md` §6 | `day_reviews.saved_at` (and `day_notes.saved_at`) forced |
| Evidence | «Importadas e dias reconstruídos ficam fora da pergunta e dos Padrões.» | `plano.md` §6 | not Phase 4; `day_reviews` of history days are refused (`before_rules`) |
| Canvas | «Update that canvas; do not create a new one» | memory | step B updates artifact `Q3CThVmn9Mms7Bdi94MBg8` |
| SQL by paste | he pastes SQL in the SQL Editor | memory (Phase 1) | kit `.claude/backup-fase4/aplicar/` |
| Kit names | live `backup_fase1`, `backup_fase2`, `backup_fase2b`, `backup_fase3`, `backup_fase34`, `backup_fase3b`, `backup_fase3c`, `backup_fase3b_colunas` | memory `paste-kit-backup-schema-names.md` | `backup_fase4_diario`, guard `f4_ja_aplicado` |
| Durable copies | specs and kits in `.claude/backup-<phase>/` | memory `scratchpad-can-vanish.md` | every Phase 4 artefact lives under `.claude/backup-fase4/` |

---

## 5. Accepted defaults (proposed)

### 5.1 Screens (4-3)

- **D1 One account at a time** (plan §5 «Grupos de cópia: você ainda opera uma conta por vez.»; both boards; all three specs):
  the selector's account drives calendar, day and week; the «Posso operar hoje?» card above shows every account; markets are never
  summed. A «Todas as contas de Futuros» view (about +1 day) waits for copy groups.
- **D2 Open day**: today's trading day (`rules_now().today`, the card's own read) unless `?dia=`; a past cell opens its day and
  announces «Aberto abaixo: Terça-feira, 1º de dezembro.» (board); cells without trades are not buttons, today always is.
- **D3 Month range and colour**: from the first month with any trade of the account (history included) to the current month;
  «Hoje» = the account's trading day now. Cell colour by C15 (quadros §5.9): diário days by the diário days' quartiles, gains and
  losses apart; history days on their own scale, hatched; so history never shapes a diário day's colour.
- **D4 Weekends** (C4), with the phone fix of quadros §7.5 (drop the card's side padding around a 7-column grid at 375 px so a
  cell stays ≥ 44 px).
- **D5 Holidays**: none (C5).
- **D6 Rows**: live (no chip), «Já fechada» chip «Registrada depois» + «Registrada às 18:02, depois do resultado: as marcas contam
  como depois do resultado.», file-only chip «Do arquivo», old-page insert after «desde» chip «Página antiga» (both with the
  recalculated-plan line), history Plano cell «Histórico importado · só resultado» (built `marcaDoPlano`, `lib/hub/posso.ts:184`);
  open rows «aberta» + «Registrar saída» / «Registrar resultado» (built), opening the Registrar sheet on the trade, only for
  trades with an entry context (the sheet's writes refuse others: `not_app_trade`); an open trade without one (old page only;
  the diagnostic counts them) shows «aberta» without the button.
- **D7 Money** per Q2 (C2): with (a) tiles, cells, week and rows net, footer **ADAPTED** «Resultados líquidos: a comissão sai
  quando o arquivo da corretora a traz.»; with (b) gross, footer quadros §7.4 «Resultados brutos: registrados por você ou do
  arquivo da corretora; a comissão aparece quando o arquivo a traz.»; the other figure in the tiles' ⓘ («Bruto … · comissões
  ….», built `commissionInfo`). «Resultado» counts realized money only (open trades' partials included); «Operações» «3 · 1
  aberta»; «Limite do dia» = `limit_usage` of the version at the day's end, always net, «pior momento · somando as contas de
  Futuros» when the scope is «somando» (NEW) and its ⓘ (C28) **ADAPTED** from quadros §5.7: «Com “somando as contas de
  Futuros”, o pior momento inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você
  arquivar uma delas, ela sai da soma, também nos dias passados.»; on the day v1 took effect (misto) the ⓘ adds «+ {n} do
  histórico, à parte: {net}» (NEW) and says the limit counted them.
- **D8 Plan of the day** (C14): «Janela» («10:00–11:00 e 14:00–15:00 ET», «Sem janela salva», NEW «Sem janela neste dia»),
  «Limite» («US$ 400 · encerra o dia» / «US$ 400 · só avisa» / «sem limite»), NEW «Breakeven» («MES +8 pts · MNQ +30 pts» · «moveu
  em 1 de 2» · «Registrado»), NEW version-change line, «Do pregão anterior» / «Nada trazido do pregão anterior.» (D l.844);
  ADAPTED ⓘ text of quadros §7.4 + the futures sentence (C17).
- **D9 Drill**: built pieces of the Registrar's «Operação fechada» from the day's `trade_state` (`cartaoComParciais`,
  `linhaDoTempo` titled «Linha do tempo da operação», `PlanoDaOperacao`, `marcasDivididas`, `possoLinha` on the stored gate);
  marks editor inline (`useMarcar`) with the built «antes: B às 10:04 · agora: C às 11:20» words and `MARCAS.anuncio`; «Imagens e
  nota» with thumbnails (C24) and a NEW dialog «Imagem 1 de 2» «Anterior» «Próxima» «Fechar»; «Editar imagens e nota» (built
  aria) / «Adicionar imagens ou nota» (D l.583) open the editor **inline in the drill** (C20: the Registrar's `useAnexos` +
  `ImagensENota`, so one upload path, already tested on phones; neither reads the sheet's context), with the Diário's own
  leave guard on `anexos.pendente` when the drill closes or the day changes (the sheet's `useMexido` needs `useFolha`, so it
  cannot be reused outside the sheet). `PlanoDaOperacao` takes `Pick<TradeView, 'plan'>`, so the drill passes
  `{ plan: plan ?? plan_now }` and always shows the row's plan, frozen or recalculated. The sheet opens from the drill only
  for trades with an entry context (exits, partials, stop moves, «Desfazer», 15 min). Test (4-3): a
  file-only trade's drill shows «● fora da janela» from `plan_now` and saves an image and a note without opening the sheet;
  no control opens the sheet on a trade without a context.
- **D10 Binary day**: «20:10–20:12 · EUR/USD · Alta · 1 min · +US$ 17,60 · No plano», drill «Stake · payout» «US$ 20 · payout
  88%», «Hora» «20:10 · vela 20:11–20:12 de Brasília», «Como terminou?» with the Registrar's words; no stop, partial or breakeven.
- **D11 Commission line**: «Comissão» «US$ 4,96»; an app futures trade without it: «Comissão · ainda não chegou: o resultado
  está bruto até o arquivo da corretora.» (NEW).
- **D12 Review** per Q1; «Seguiu o plano?» «Sim» / «Em parte» / «Não» stored as `sim` / `em_parte` / `nao`; «Pela sua resposta,
  depois do resultado. O diário conta à parte.» (D l.625); one label «O que você faria diferente?» (the read view's «O que faria
  diferente?» is STALE, D l.615); the read view shows «O diário registrou: …» frozen and, when the live facts differ, «Depois da
  revisão, o dia mudou: agora {n} operações, {net}.» (NEW, banco §6); reviews allowed on any diário day up to today, the block
  shown on days with diário trades and on today; none on history days; with Q1 (a) a collapsed «Versões anteriores» list (NEW).
- **D13 Pending reviews**: diário days before today with **at least one trade registered in the app** (`trade_entry_context`,
  D26) and no written review; days that came only from a file are not pending (he can still review them: the block stays, and a
  written review gives ✓); «nas últimas 4 semanas» = the last 28 days; the banner closes for the session. The same predicate
  drives the «Sem revisão» tag, the cell's «, sem revisão» aria and the week's «Revisões» «{n} de {m}» (C19). On the live data
  (4 trades registered in the app on 22 Oct) the banner starts small instead of listing every imported Ebinex and Top One day.
- **D14 Week** per Q3; «Fora do plano» list «ter 24 · 11:05 · Compra MES · fora da janela · −US$ 40,00» (D data `foraCurto`); bars
  with a visually hidden list for screen readers.
- **D15 «Antes de operar»** per Q4: with (b) a short field on today's day only, saved with server time, shown «anotado às 09:40,
  antes da 1ª entrada» / «… depois da 1ª entrada» (NEW); past days read-only; old Pré-mercado notes per C11.
- **D16 «Registrar operação» on a past day**: when the open day is a past diário day, the sheet opens in «Já fechada» with «Dia»
  set to it (NEW `day` option of `OpenRegistrarOptions`).
- **D17 Deep link and focus** (C21); Escape closes the selector and the image dialog, focus returns to the opener.
- **D18 Keyboard**: one tab stop per month (roving tabindex), arrows by day, Home/End, PageUp/PageDown by month, Enter opens;
  week cells are buttons with Q3 (a)/(c).
- **D19 States** of quadros §5.13 with the built words («Carregando…», `TRY_AGAIN`, the bridge's offline line) and NEW «Não foi
  possível carregar o Diário.», «Sem conexão. A revisão não foi salva.», «Nenhuma operação neste dia.», the no-rules card.
- **D20 Undo of an import**: the confirmation in Personalizar › Suas contas › «Importações» adds, when the trades the undo
  deletes carry Diário content, «Saem junto: {n} marcas, {m} imagens e {k} notas que você pôs no Diário.» (NEW), counted by client
  reads under RLS **only on the batch's own trades** (`trades.import_batch_id = batch`, the ones `import_undo` deletes,
  `20261023000003` l.2186). App trades the file completed stay, with their registered values restored (Phase 3 decision 2), and
  keep their marks, images and note, so they are not counted.
- **D21 Clocks**: every hour on the account's window clock (as the bridge); days always from `trading_day`; never the device
  clock.
- **D22 Checks**: 375 / 768 / desktop, both themes (the calendar's level 3–4 dark text on `#17191A`, amber on `--amber-bg` in
  claro), 44 px targets (ⓘ keeps its 44 px hit area), reduced motion off for entrance and hover zoom.

### 5.2 Database (4-1)

- **D23 `day_reviews`** as banco §4.1: append-only (Q1 a; with (b) one row + `edited_at`, same answers), `account_id not null`,
  composite FK to `trading_accounts (id, user_id)`, texts trimmed (1 000 / 200 chars), `auto_summary` = `diario_fatos` at save,
  `saved_at` forced, `client_key` idempotency, ≤ 50 rows per account and day; view `day_reviews_now_v` (`first_saved_at`,
  `versions`, `written`); RLS select-own; no write policy.
- **D24 `day_notes`** (only with Q4 b/c): same pattern, `text` 1–500, `save_day_note(p_account, p_day, p_payload)` accepted only
  for `p_day = today` (NEW code `not_today`).
- **D25 RPCs** as banco §5: `diario_calendario(account, from, to)` (light, whole range: per day money, counts, `kind`, `app`,
  review, history; per week money; no plan or limit), `diario_mes(account, month)` (the ISO weeks covering the month: per day
  `fora`, `recalculated`, `limit`; per week `fora`; `fora_trades`), `diario_dia(account, day)` (each trade = `trade_state −
  server_now` + `history`, `plan_kind`, `plan_now`, `clock_guessed`, `imported_at`; `open_elsewhere`, `deleted` [{at, via}]
  (C27), `review` [+ `history` of versions], `carry_in`), `save_day_review(account, day, review, dry_run)`; internal
  `diario_money`, `diario_trade_plan`, `diario_day_end`, `diario_fatos`; `SECURITY DEFINER`, `search_path = ''`, codes only; NEW codes `day_in_future`, `too_many_versions`, `bad_text`,
  `bad_followed`, `bad_range` (+ `not_today`) added to `RPC_ERROR_CODES`.
- **D26 Journal predicate**: "registered in the app" = has a `trade_entry_context` row; history = entry before v1's
  `effective_from`; never `source` alone (estado §2.2).
- **D27 Diagnostic** `diagnostico_fase4.sql` (counts only, never text): 3b applied, `backup_fase*` present, per account market,
  versions, `desde_day`, trades by kind (history / app / file-only / old-page), the most file-only diário trades in one month
  (sizes `diario_mes`), weekend trading days, open trades (and how many lack a context), guessed-clock trades (expected 0),
  `trade_deletions` by `via`, `trading_sessions` rows with non-null text per column (C11).
- **D28 `fase4_aplicar.sql`**: one block; guard `f4_ja_aplicado`; backup schema `backup_fase4_diario` with fingerprints; the two
  migrations; conferência JSON with every `*_mudaram` 0, `calendario_difere_do_limite` 0, `revisoes` 0, new functions for
  `authenticated` true and for `anon` false, per account days returned and the milliseconds of `diario_calendario` and of the
  heaviest month's `diario_mes` (`cronometrar.sh` repeats both warm and cold; 4-3 merges only after he sends them).
- **D29 `desfazer_fase4.sql`** drops only while no review (or note) exists (`f4_tem_revisoes`).
- **D30 `testar.sh`**: live-shaped seed recreating the eight `backup_fase*` schemas, paste twice, undo with and without reviews,
  injected failure, `run.sh` after the kit, the `.pg` suite; `mensagem_para_o_dono.txt` in pt-BR.

### 5.3 Domain and data layer (4-2)

- **D31** `lib/domain/diario/calendario.ts` (`monthGrid` with 5 or 7 columns, `heatLevel` by C15, `isClosedWeek` per market,
  `pendingReviews` by D13), `revisao.ts` (payload checks with the SQL's codes and order), `fatos.ts` (`factsChanged` on the
  account's own `trades` and `net` only: C28); no money summed in JavaScript (weeks come from SQL).
- **D32** `lib/hub/diarioDb.ts` (`fetchCalendario`, `fetchMes`, `fetchDia` reusing `parseTradeState`, `saveDayReview`, `signedImageUrls`
  batch, `bad_answer` on any other shape) and `lib/hub/diario.ts` (every pt-BR word of §1.1 and D6–D15).
- **D33** `hooks/useDiario.ts`: keys `['hub', uid, 'diario', accountId, …]` (calendar, month, day, images); every write stales
  the account's prefix and only the queries on screen refetch: `REGISTRAR_INVALIDATIONS` (`marcas` included, today `[]`),
  `save_day_review`, import commit/undo and `save_rules` (through `useRefreshAfterWrite` / `['hub', uid]`).
  `refetchOnWindowFocus: 'always'` only for the light calendar, the current month and today's day; past months refetch only
  when a write stales them.
- **D34** Type name `DiaryDayTrade` (two `DayTrade` types already exist: `lib/hub/registrarDb.ts` and `lib/domain/gate/usage.ts`).
- **D35** `cases4.json` with SQL-computed expectations (review checks, `kind` at the v1 boundary, `week_of` and closed weeks per
  market, carry-over); `hubDiario.pg.test.ts` records fixtures (a Top One week with a limit day, an Ebinex weekend, a misto v1
  day, partials + breakeven, a reviewed day and the next). `CLAUDE.md` gains the usual "change the SQL and the TypeScript
  together, then re-record" line for `lib/domain/diario/`.
- **D36** Tests that change: `__tests__/lib/hubRegistrar.test.ts:50` (placeholder string), `__tests__/components/hub/PossoOperarHoje.test.tsx:742-767`
  (page order, still one `fetchRulesNow`), `__tests__/components/hub/OperacoesDoDia.test.tsx` (retired with the bridge; its owner-test
  cases 11:05 and 10:42 move to the day's suite), the Registrar suites if `OPERACOES_DO_DIA_ID` moves, `__tests__/hooks/useRegistrar.test.tsx`
  (invalidation table), the lane CSS test. New: the drill test of D9 (file-only trade, inline images and note, no sheet), the
  pending-reviews predicate (D13) and the colour rule (C15). `routesRequireAuth.test.ts` unchanged (no route handler).

### 5.4 Board revision (B): scenarios to draw (invented data)

Accounts as quadros §7.3 (Top One, Lucid 50k, Ebinex, FTMO, IBKR, Binance, Clear). Every number invented.

1. **Hoje, no meio da janela** (Top One): open trade with a partial, the timeline placeholder, the card's place; «Antes de operar»
   with Q4 (b)/(c).
2. **Um dia completo**: live trade with images, note and a mark changed after the result; partials + breakeven + R; «Já fechada»;
   file-only «Do arquivo»; app trade completed and corrected by the file, commission shown; saved review (edited, with the
   versions list under Q1 a) and «Do pregão anterior»; the deleted-trade line.
3. **Limite atingido** (19 nov without Phase 5) + the «Só avisar» variant.
4. **Calendário**: history hatched on its own colour scale, the misto v1 day, week with «▨», pending-reviews banner (only app
   days), a file-only day with no review and no «sem revisão», «sem op.» days; phone frame.
5. **Um dia do histórico** (read-only).
6. **Ebinex** (binary day, Brasília, «sem limite», open row «Vence às 21:30.»).
7. **Cripto com fim de semana** (7 columns, «Valores em US$ (USDT e USDC contam como dólar).»).
8. **B3 em reais**.
9. **Somando as contas de Futuros** + its ⓘ (C28) and the selector with two futures accounts.
10. **Estados sem dados** (no rules, no trades, loading, error/offline).
11. **Semana** per Q3 («Semana em andamento» with (a)/(c), «Revisões» tile).
12. **Celular 375 px, claro e escuro**: the day of 2 with a drill open, the image dialog, the review form, the month.
13. **Rodapé e a página antiga** per Q5: «Página antiga de operações» (a) or «Apagar operação» + «Exportar CSV» (b); the results
    line per Q2; the Importações undo line (D20).

---

## 6. The owner test

«Seus dias reais; depois, `/trades` passa a abrir `/diario`.» On the live data after the paste (conferência clean):

1. **Top One**: the months before his rules began are hatched «Histórico importado · só resultado»; the day v1 took effect shows
   history apart; the days since show his registered trades (the live DB had 4 registered in the app, 3 exits and 1 stop move on
   22 Oct), with marks at their times, images opening in the dialog, «Linha do tempo da operação» for the partials; the
   pending-reviews banner lists only days with a trade he registered in the app.
2. **Ebinex**: history hatched on the Brasília clock; any diário day since its v1; a weekend column appears only if a month has a
   weekend trading day.
3. **Open a past day** from the calendar and from a deep link; «Ver no Diário» from the Registrar lands on the trade's row.
4. **Write today's review**; on the next trading day «Do pregão anterior» shows its «Levar para o próximo pregão»; edit it once
   (Q1). A review is real data: with Q1 (a) it stays (saving empty fields clears it, the history remains).
5. **The week** (Q3), both themes, and the phone at 375 px (production over https, or the LAN dev server).
6. **Then 4-4**: `/trades` opens `/diario`; with Q5 (a) the old list opens from the footer and still deletes and exports.

---

## 7. Risks: existing data must not change, and other checks

- **Nothing existing changes.** The kit adds one table (two with Q4 b/c), one view and new functions; no column is added to an
  existing table, no function is replaced, no row is written. The conferência proves it: fingerprints of every row of the tables
  3b's kit listed, every `limit_usage` and `gate_eval` answer, every `trade_marks_v.limpa` and every `trade_state` unchanged
  (`*_mudaram` 0), plus `calendario_difere_do_limite` 0.
- **Trading days are read, never recomputed** (`trades.trading_day`, written by `compute_trading_day`); no backfill; the drift
  proof of earlier phases is re-asserted in `83_diario.test.sql` group 13.
- **Two scopes of money on one page, by design**: the result is the account's diário money (net or gross per Q2); the limit
  tile is what the app enforced, net (all trades of the trading day, «somando» across futures accounts when so set, and on the v1
  day also the trades before v1). The ⓘ says so; SQL group 2 proves diário + history = `limit_usage` per account and day.
- **«Somando» follows the accounts active now** (C28): archiving a futures account moves past «somando» days' limit tile, ■ and
  recalculated plans, as `limit_usage` does today; frozen app plans never move. Not his setup («por conta»); said in the ⓘ,
  pinned by SQL group 5, kept out of «o dia mudou».
- **Undoing an import deletes owner content** added in the Diário to the batch's own trades (marks, accepted in Phase 1, and now
  images and notes); app trades the file completed stay with theirs. D20 names what goes in the confirmation before he
  confirms.
- **Row limit**: the RPCs return one value (group 12 with 1 200 days). The old `/trades` list reads `select *` unpaged and stops at
  the newest 1 000 rows (633 trades on 22 Oct, Ebinex adds roughly 150–200 a month): with Q5 (a), 4-4 pages that read
  (`readAll` pattern, `lib/hub/contasDb.ts:292-306`) without changing its look.
- **Images**: signed read URLs are bearer links for 10 minutes; created in the browser, one batch per opened drill, never in our
  URLs or logs; no Storage policy changes; no signed upload URL (`storageUploads.test.ts`).
- **Append-only reviews** cannot be deleted from the app (Q1 a); `desfazer_fase4.sql` refuses once one exists.
- **Kit name collision**: `backup_fase4_diario` is new against the eight live names; `testar.sh` seeds them all.
- **Performance**: `gate_at` runs per file-only diário trade, and almost every diário trade arrives only from a file (Ebinex adds
  about 150–200 a month). The whole-range calendar is therefore a light pass without `gate_at` or `limit_usage`; plans and
  limits come per month (`diario_mes`), so a month's cost stays flat as history grows (C12). `trade_state` runs per trade of
  the open day only. `cronometrar.sh` prints the light pass's and the heaviest month's milliseconds and counts per account on
  the live data before the screens merge; only the light calendar, the current month and today's day refetch on window focus.
- **Invalidations**: `REGISTRAR_INVALIDATIONS.marcas` is `[]` today; without D33 a mark saved in the Diário would not refresh the
  day.
- **Old pages disagree with the Diário on days** (they group by UTC date) until Phase 9, as `plano.md` §6 accepts; `/trades` behind
  the redirect lands inside `HubGate` (both of his logins are hub members).
- **Phase 5 rework** stays inside Phase 5's budget: `diario_dia` reserves no key, `diario_fatos` carries `"v": 1` so frozen
  summaries keep rendering when Phase 5 adds block, bias and state.
- **Public repo**: fixtures and board data invented; `docs/csv` only headers and counts; scan commits before pushing.

---

## Open questions for the owner

(pt-BR version in plain words: `perguntas.md`.)

1. **The day's review: can it change later?** Content as drawn (D l.605–631): «O que funcionou?», «O que você faria diferente?»,
   «Seguiu o plano?», «Levar para o próximo pregão», plus «O diário registrou: …» frozen at save; one per account and trading day.
   - (a) Editable any time; each «Salvar revisão» is kept with its server time; the Diário shows the latest («Salva às 11:33 ·
     editada às 18:02») and a collapsed read-only list of earlier versions. **Recommended**: like marks and rule versions, what
     he wrote at the time stays, even if he rewrites it after seeing the week; same cost as (b).
   - (b) Editable; the new text replaces the old; only the first save time and the last edit time are kept.
   - (c) Editable until the end of the next trading day, then read-only (+0.25 day).
2. **The day's result: net or gross of commissions?** (C2.) Only futures accounts differ (Ebinex has no commission). The limit
   already counts net (his Phase 2 answer) and the 3b import preview says «O arquivo traz comissões: mostramos o resultado
   líquido.»; but the Diário board's footer says «Resultados do arquivo da corretora, sem custos.» (D l.670) and the approved
   Análises enxuta shows «Resultado (bruto)» (canvas v35; plan row 6 «Top One como "bruto"»). Either way the «Limite do dia» tile
   stays net and the other figure sits in the ⓘ («Bruto … · comissões …»); the cost is the same.
   - (a) Net everywhere in the Diário (day, calendar, week, rows); an app trade without commission yet stays gross until the
     file brings it, and its details say so. **Recommended**: one number for the day, equal to the one the limit and «Posso
     operar hoje?» used on the same page. What it reverses: the board footer (rewritten) and, until Phase 6 is re-asked, the
     Análises board: Análises would show gross and the Diário net for Top One.
   - (b) Gross everywhere, as the boards and Análises; only the «Limite do dia» tile is net. The two pages agree; on a day with
     commissions the result and the limit tile differ by the commission.
3. **What does the «Semana» card show?**
   - (a) The week of the open day; the current week reads «Semana em andamento»; a tap on a week cell opens it; tiles «Resultado»,
     «Operações», «Fora do plano», «Revisões»; bars and the «Fora do plano» list. **Recommended**: the card follows what he is
     looking at, and mid-week he sees how the week is going.
   - (b) Always the newest closed week, as drawn, with «Revisões» in place of the bias.
   - (c) Both: the week in progress and, below, the newest closed one (+0.25 day).
4. **«Antes de operar» and «Seu foco da próxima semana»: where are they written?** The boards show both (D l.378, D l.657) but no
   place to write them; only the old Pré-mercado page keeps a pre-session note (per date, no account).
   - (a) Neither now; «Do pregão anterior» stays.
   - (b) «Antes de operar» now, a short field on today's day with server time («anotado às 09:40, antes da 1ª entrada»); the focus
     comes with Padrões (Phase 7) (+0.5 day). **Recommended**: the note is part of the approved plan of the day and becomes evidence
     with the server time; the focus belongs to the Padrões claims (`weekly_focus.claim_key`).
   - (c) Both now as free text (+1 day).
5. **When `/trades` opens `/diario`, where do delete and export go?** Today the old page is the only place that deletes an imported
   trade or a registered one older than 15 minutes (Phase 3 decision 3) and the only CSV export; nothing corrects values except
   the broker file (decision 2).
   - (a) `/trades` opens the Diário; the old list stays at `/trades?antiga=1`, linked from the Diário's footer («Página antiga de
     operações»), until Phase 9; delete and export stay there, and its read is paged past 1 000 rows. **Recommended**: meets the
     plan's test with no new destructive control now, and decision 3 stays true.
   - (b) The Diário gets «Apagar operação» in each trade's details (confirmation; only date and time kept, as today) and the board's
     «Exportar CSV» (+1 day; `delete_trade` and `diario_exportar` as banco §5.6).
   - (c) No delete (except «Desfazer entrada» and undoing an import) and no export until Phase 9.
