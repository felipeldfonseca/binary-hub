/**
 * @jest-environment node
 *
 * Phase 3b · telas (lane L2) against the real SQL of migrations 20261024000001..2, on a throwaway local Postgres whose
 * clock the suite moves. Skipped unless both are set (never the hosted project):
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds) from it
 *
 * The approved board's world (app/testing/mapeadoTelas, invented): its accounts and zones, the rules «desde» 14 out
 * (Top One, Ylos 50k, Apex A) and 15 out (the others), a Top One Trade History in UTC on 1–13 out (G1), a trade registered
 * in the app on Ylos 50k at 15 out 09:58:42 ET (15's «1 já registrada por você»). Each board state's file goes the way the
 * sheet sends it (B0's mapping + the board's answers, buildImportArgs, p_platform 'modelo' with p_format), and:
 *
 *   - every composed answer of testing/mapeadoRespostas (previaQuadro, commitQuadro) is the real one (contract §6.10);
 *   - the data layer (fetchTemplates, saveTemplate): «Salvar como modelo» after the commit, the touch of a model taken as
 *     is, «Atualizar o modelo» (p_replaces), a «Conta» route saved and pre-selected next time; with no batch, a new model
 *     without routes, and why a route never goes without one;
 *   - G2: Top One's zone is UTC, so Brasília is refused on the preview and the commit (recusaLocal agrees); G1: «18
 *     operações caem em dias …», none on a re-import; «Nada novo» on a re-import; «Desfazer» keeps the model; a Top One
 *     file answers exactly as before (no p_format, no 3b key).
 *
 * BH_PG_RECORD=<file> writes the real answers there instead of comparing them (to compose the fixture again).
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import {
  accountRouteHash,
  buildImportArgs,
  checkTemplate,
  parseImportText,
  previewArgs,
  type ImportFile,
  type MappedFile,
  type ParsedFile,
  type Template,
} from '@/lib/domain/import';
import { entryPayload } from '@/lib/domain/registro';
import {
  fetchTemplates,
  importCommit,
  importPreview,
  importUndo,
  saveTemplate,
  type ImportCommitResult,
  type ImportPreviewResult,
} from '@/lib/hub/contasDb';
import { recusaLocal, valorPreSelecionado } from '@/lib/hub/importPrevia';
import { arquivoDoMapeamento, iniciarMapeamento, modeloASalvar, type Mapeamento } from '@/lib/hub/importMapeado';
import { newClientKey, registerEntry } from '@/lib/hub/registrarDb';
import { ARQUIVOS_QUADRO, CONTAS_QUADRO, type ContaQuadro } from '@/testing/mapeadoTelas';
import {
  ESTADOS_QUADRO,
  arquivoDoEstado,
  arquivoMapeavelQuadro,
  commitQuadro,
  mapeamentoDoEstado,
  previaQuadro,
  type EstadoQuadro,
} from '@/testing/mapeadoRespostas';
import { PG_URL, asUser, createAccountAsUser, lit, pgClient, psql } from '@/testing/pg';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const RECORD = process.env.BH_PG_RECORD;
const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;

/** Moves the server's clock to `iso` */
function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000);
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`);
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string);
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`);
}

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

/** An answer without what only the server knows (the batch's id), for the comparison */
const semLote = <T extends { batch_id?: string | null }>(c: T) => ({ ...c, batch_id: c.batch_id ? 'lote' : null });

describePg('Phase 3b · telas × the real SQL: the board world’s answers, the models, G1 and G2', () => {
  const uid = randomUUID();
  const db = pgClient(uid);
  const id: Partial<Record<ContaQuadro, string>> = {};
  const reais: Record<string, { previa: ImportPreviewResult; commit: ImportCommitResult | null }> = {};
  let topOneHistory = '';

  /** The account's id in this database */
  const conta = (c: ContaQuadro) => {
    const v = id[c === 'ylosDepois' ? 'ylos' : c];
    if (!v) throw new Error(c);
    return v;
  };

  /** The account's zone as the board world has it (the fixture's file_tz; confirmed when the fixture says so) */
  function zonaDoQuadro(c: ContaQuadro) {
    const a = CONTAS_QUADRO[c];
    psql(`update public.trading_accounts set file_tz = '${a.file_tz}', tz_applied_at = ${a.tz_applied_at ? `'${a.tz_applied_at}'` : 'null'} where id = '${conta(c)}';`);
  }

  async function templatesDb(): Promise<Template[]> {
    return fetchTemplates(db);
  }

  /** The state's file as the sheet sends it, its args, and the preview and (unless `soPrevia`) the commit */
  async function importar(e: EstadoQuadro, opts: { templates?: Template[]; soPrevia?: boolean; tz?: string } = {}) {
    const d = ESTADOS_QUADRO[e];
    const file = arquivoDoEstado(e, opts.templates ?? []);
    const text = ARQUIVOS_QUADRO[d.arquivo].texto;
    const args = buildImportArgs({
      accountId: conta(d.conta),
      platform: 'modelo',
      fileName: ARQUIVOS_QUADRO[d.arquivo].nome,
      sha256: sha(text),
      fileTz: opts.tz ?? d.tz,
      outcome: file,
    });
    const previa = await importPreview(db, previewArgs(args));
    const commit = opts.soPrevia ? null : await importCommit(db, args);
    if (!opts.tz) reais[e] = { previa, commit };
    if (!RECORD && !opts.tz) {
      expect([e, previa]).toEqual([e, previaQuadro(e)]);
      if (commit) expect([e, semLote(commit)]).toEqual([e, semLote(commitQuadro(e))]);
    }
    return { file, args, previa, commit };
  }

  /** «Desfazer», and the account's zone back to the board's (a commit confirms it) */
  async function desfazer(c: ContaQuadro, commit: ImportCommitResult | null) {
    if (commit?.batch_id) await importUndo(db, commit.batch_id);
    zonaDoQuadro(c);
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    if (RECORD) fs.writeFileSync(RECORD, JSON.stringify(reais, null, 2));
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from public.import_templates where user_id = '${uid}';
delete from auth.users where id = '${uid}';
delete from public.profiles where id = '${uid}';`);
  });

  it('Tue 13 Oct 23:00Z: the board’s accounts, their zones, the futures rules (14 out) and Top One’s Trade History in UTC', async () => {
    setClock('2026-10-13T23:00:00Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'telas3b-${uid.slice(0, 8)}@example.test');`);
    const contas: ContaQuadro[] = ['topOne', 'ylos', 'lucid', 'apexA', 'e8', 'ibkr', 'binance', 'mini', 'ebinex'];
    for (const c of contas) {
      const a = CONTAS_QUADRO[c];
      id[c] = await createAccountAsUser(uid, {
        market: a.market,
        label: a.label,
        platform: a.platform,
        firm: a.firm,
        external_ref: a.external_ref,
        phase: a.phase,
        size: null,
        is_primary: a.is_primary,
      });
      zonaDoQuadro(c);
    }
    const salvar = (cs: ContaQuadro[]) =>
      asUser(
        uid,
        `public.save_rules(${lit({
          v: 1,
          base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
          accounts: Object.fromEntries(cs.map((c) => [conta(c), { rules: { v: 1 }, window: null, version: 'force' }])),
        })})`,
      );
    salvar(['topOne', 'ylos', 'apexA']);
    const v1 = (c: ContaQuadro) => psql(`select public.compute_trading_day(account_id, effective_from)::text from public.account_rule_versions where account_id = '${conta(c)}' order by version_no limit 1;`).trim();
    expect(['topOne', 'ylos', 'apexA'].map((c) => v1(c as ContaQuadro))).toEqual(['2026-10-14', '2026-10-14', '2026-10-14']);

    // Top One's Trade History in UTC, one trade on each day of 8's file (G1), imported as before: no p_format
    const dias = ['01', '02', '05', '06', '07', '08', '09', '12', '13'];
    topOneHistory = [
      'Ticket #,Symbol,Side,SL,TP,Open Time,Open Price,Close Time,Close Price,Duration,PnL,Lots,Commissions,Gain',
      ...dias.map((d, i) => `MESZ6/9000000006${String(i).padStart(2, '0')},MESZ6,BUY,0,0,${d}/10/2026 14:30:00,6801,${d}/10/2026 14:40:00,6803,10m 0s,$10,1,1.24,0.02%`),
    ].join('\n');
    const parsed = parseImportText(topOneHistory) as ParsedFile;
    expect(parsed.ok && parsed.platform).toBe('topone');
    const args = buildImportArgs({ accountId: conta('topOne'), platform: 'topone', fileName: 'Trade-History.csv', sha256: sha(topOneHistory), fileTz: 'UTC', outcome: parsed });
    expect(args.p_format).toBeUndefined();
    const previa = await importPreview(db, previewArgs(args));
    // A reader's file: exactly the as-built keys (no 3b key)
    expect(previa).not.toHaveProperty('other_source');
    expect(previa).not.toHaveProperty('duplicate_same');
    expect(previa).toMatchObject({ new: 9, duplicate: 0, tz_status: 'ok' });
    expect((await importCommit(db, args)).inserted).toBe(9);
  });

  it('Thu 15 Oct: the other accounts’ rules (15 out) and a MES long registered in the app on Ylos 50k at 09:58:42 ET', async () => {
    setClock('2026-10-15T04:00:00Z');
    asUser(
      uid,
      `public.save_rules(${lit({
        v: 1,
        base_rev: (asUser(uid, 'public.rules_config()') as { rev: string }).rev,
        accounts: Object.fromEntries(
          (['lucid', 'e8', 'ibkr', 'binance', 'mini', 'ebinex'] as ContaQuadro[]).map((c) => [conta(c), { rules: { v: 1 }, window: null, version: 'force' }]),
        ),
      })})`,
    );
    setClock('2026-10-15T13:58:42Z');
    const r = await registerEntry(db, conta('ylos'), entryPayload('futures', { clientKey: newClientKey(), symbol: 'MESZ6', direction: 'long', quantity: '1', entryPrice: '6890.50', clock: 'America/New_York' }));
    expect(r.state.trade).toMatchObject({ status: 'open', quantity: '1' });
    setClock('2026-10-15T15:00:00Z');
  });

  it('8 · Ylos 50k: imported, «Salvar como modelo» after the commit; again «Nada novo»; 15 by the model (a touch), 15b «Atualizar o modelo»; «Desfazer» keeps it', async () => {
    const { commit, file } = await importar('8');
    expect(commit?.batch_id).toBeTruthy();
    // «Salvar como modelo» «BlackArrow» (D1: the platform's label), with the batch, no route
    const m8 = mapeamentoDoEstado('8');
    const s8 = modeloASalvar({ ...m8, nome: 'BlackArrow' }, { tzHint: 'America/New_York', rota: null });
    expect(s8?.tipo).toBe('salvo');
    expect(checkTemplate(s8!.payload, { batch: { sig: file.format.sig, market: 'futures' } })).toBeNull();
    const saved = await saveTemplate(db, s8!.payload, commit!.batch_id, s8!.replaces);
    expect(saved).toMatchObject({ header_sig: file.format.sig, created: true });
    const [modelo] = await templatesDb();
    expect(modelo).toMatchObject({ id: saved.template_id, name: 'BlackArrow', tzHint: 'America/New_York', resultIsNet: true });

    // The same file again: «Nada novo», and no other-format warning
    const again = await importar('8-de-novo', { soPrevia: true });
    expect(again.previa.other_source).toBeUndefined();

    // 15 · the model's file in its own account: exact, taken as is, straight to «Prévia» (no zone step: the model's zone)
    const templates = await templatesDb();
    const r15 = iniciarMapeamento(arquivoMapeavelQuadro('f15'), { market: 'futures', templates, nomePadrao: 'BlackArrow' });
    expect(r15.ok && [r15.mapeamento.match.kind, r15.mapeamento.porModelo, r15.mapeamento.inicio]).toEqual(['exact', true, 'previa']);
    const i15 = await importar('15', { templates });
    expect(i15.args.p_format).toEqual({ sig: saved.header_sig, template: saved.template_id });
    // The touch: the same model, its id and signature
    const s15 = modeloASalvar(mapeamentoDoEstado('15', templates), { tzHint: 'America/New_York', rota: null });
    expect([s15?.tipo, s15?.replaces]).toEqual(['tocado', null]);
    expect(await saveTemplate(db, s15!.payload, i15.commit!.batch_id, null)).toEqual({ template_id: saved.template_id, header_sig: saved.header_sig, created: false });
    // «Desfazer» the batch: the model stays (C25)
    await importUndo(db, i15.commit!.batch_id!);
    expect((await templatesDb()).map((t) => t.id)).toEqual([saved.template_id]);

    // 15 · «Uma coluna a mais»: changed, «Atualizar o modelo “BlackArrow”» keeps its id, takes the new signature
    const i15b = await importar('15b', { templates });
    const m15b = mapeamentoDoEstado('15b', templates);
    expect([m15b.match.kind, m15b.origem, m15b.inicio]).toEqual(['changed', 'modelo', 'mapa']);
    const s15b = modeloASalvar(m15b, { tzHint: 'America/New_York', rota: null });
    expect([s15b?.tipo, s15b?.replaces]).toEqual(['atualizado', saved.template_id]);
    const upd = await saveTemplate(db, s15b!.payload, i15b.commit!.batch_id, s15b!.replaces);
    expect(upd).toMatchObject({ template_id: saved.template_id, created: false, header_sig: i15b.file.format.sig });
    await importUndo(db, i15b.commit!.batch_id!);
  });

  it('8 · «Conta que já recebe outro formato» (Top One): Brasília refused on the preview and the commit (G2); in UTC, G1 «18 operações …»', async () => {
    // G2: the account's zone is UTC (its Top One imports); recusaLocal says so before any call
    expect(recusaLocal(CONTAS_QUADRO.topOne, 'America/Sao_Paulo')).toBe(true);
    expect(recusaLocal(CONTAS_QUADRO.topOne, 'UTC')).toBe(false);
    const refused = await importar('8g', { soPrevia: true, tz: 'America/Sao_Paulo' });
    expect(refused.previa).toMatchObject({ tz_status: 'tz_mismatch' });
    await expect(importCommit(db, refused.args)).rejects.toMatchObject({ code: 'tz_mismatch' });

    const { commit } = await importar('8g');
    // Again: nothing would be inserted, so no warning
    const again = await importar('8g', { soPrevia: true, tz: 'UTC' });
    expect(again.previa.other_source).toBeUndefined();
    expect(again.previa.new).toBe(0);
    await desfazer('topOne', commit);
  });

  it('8 · Performance.csv and 16 · Tradovate Orders (Lucid 50k): the saídas, the partial exits, the model «Tradovate», «Nada novo» in saídas', async () => {
    const p = await importar('8p');
    // Again: found by the times and prices (no ID column), so duplicate without duplicate_same («mesma hora e preço»)
    const p2 = await importar('8p-de-novo', { soPrevia: true });
    expect(p2.previa).toMatchObject({ new: 0, duplicate: 6 });
    expect(p2.previa).not.toHaveProperty('duplicate_same');
    await desfazer('lucid', p.commit);

    const t = await importar('16t');
    const again = await importar('16t-de-novo', { soPrevia: true });
    expect(again.previa).toMatchObject({ new: 0 });
    const m = mapeamentoDoEstado('16t');
    const s = modeloASalvar({ ...m, nome: 'Tradovate' }, { tzHint: 'America/New_York', rota: null });
    expect((await saveTemplate(db, s!.payload, t.commit!.batch_id, null)).created).toBe(true);
    await desfazer('lucid', t.commit);

    // 16 · ending positioned, by every answer; read by the saved model it starts on «conferir» (the question, D20)
    const templates = (await templatesDb()).filter((x) => x.name === 'Tradovate');
    const r = iniciarMapeamento(arquivoMapeavelQuadro('f16ta'), { market: 'futures', templates, nomePadrao: 'Tradovate' });
    expect(r.ok && [r.mapeamento.match.kind, r.mapeamento.porModelo, r.mapeamento.inicio]).toEqual(['exact', true, 'conferir']);
    for (const e of ['16ta-naosei', '16ta-sim', '16ta-nao'] as EstadoQuadro[]) {
      const x = await importar(e);
      await desfazer('lucid', x.commit);
    }
    // Two «Conta» values: «Sim» given for LT50K-0193 on «conferir» reaches the rows after hc (open_at_end, not unbalanced)
    const c = await importar('16c-sim');
    expect(c.file.errors.map((e) => e.code)).toEqual(['open_at_end']);
    await desfazer('lucid', c.commit);
  });

  it('16 · Binance (every answer) and Interactive Brokers: the executions left out, the BNB fee, the day turn', async () => {
    for (const e of ['16b-naosei', '16b-sim', '16b-nao'] as EstadoQuadro[]) {
      const x = await importar(e);
      await desfazer('binance', x.commit);
    }
    const i = await importar('16i');
    await desfazer('ibkr', i.commit);
  });

  it('17 · NinjaTrader with two accounts: APX-0001, then APX-0002; the route saved is pre-selected next time', async () => {
    const a = await importar('17');
    const m = mapeamentoDoEstado('17');
    const s = modeloASalvar({ ...m, nome: 'NinjaTrader' }, { tzHint: 'America/New_York', rota: { valor: 'APX-0001', contaId: conta('apexA') } });
    expect(s!.payload.account_routes).toEqual({ [accountRouteHash('APX-0001')]: conta('apexA') });
    expect((await saveTemplate(db, s!.payload, a.commit!.batch_id, null)).created).toBe(true);
    await desfazer('apexA', a.commit);
    // Next time: the model routes APX-0001 here, even for an account without the number
    const templates = (await templatesDb()).filter((x) => x.name === 'NinjaTrader');
    const r = iniciarMapeamento(arquivoMapeavelQuadro('f17'), { market: 'futures', templates, nomePadrao: 'NinjaTrader' });
    if (!r.ok) throw new Error('f17');
    expect(valorPreSelecionado(r.mapeamento, { id: conta('apexA'), external_ref: null, market: 'futures' })).toBe('APX-0001');

    const b = await importar('17-apx2');
    await desfazer('apexA', b.commit);
  });

  it('18 · Forex (E8 50k) in New York, Chicago and UTC: one trade on another day in New York and in Chicago, none in UTC', async () => {
    for (const e of ['18', '18-chicago', '18-utc'] as EstadoQuadro[]) {
      const x = await importar(e);
      await desfazer('e8', x.commit);
    }
    expect(reais['18'].previa.day_changes).toBe(1);
    expect(reais['18-chicago'].previa.day_changes).toBe(1);
    expect(reais['18-utc'].previa.day_changes).toBe(0);
  });

  it('19 · B3 (Mini-índice): «X» as Venda, «Pular essas linhas», and the prices only', async () => {
    for (const e of ['19', '19-pular', '19p'] as EstadoQuadro[]) {
      const x = await importar(e);
      await desfazer('mini', x.commit);
    }
  });

  it('with no batch (a re-import that only completes): a new model goes without routes; a route never goes without a batch', async () => {
    // 8's file without its commission column, then the whole file: the second only completes the commissions
    const m = mapeamentoDoEstado('8');
    const sem: Mapeamento = { ...m, colunas: { ...m.colunas, trade: m.colunas.trade.map((c) => (c === 'commission' ? 'ignorar' : c)) } };
    const fileSem = arquivoDoMapeamento({ ...sem, resultIsNet: null }, 'futures', 'America/New_York');
    if (!fileSem.ok) throw new Error('f8');
    const text = ARQUIVOS_QUADRO.f8.texto;
    const argsSem = buildImportArgs({ accountId: conta('lucid'), platform: 'modelo', fileName: 'a.csv', sha256: sha(`${text}a`), fileTz: 'America/New_York', outcome: fileSem as ImportFile });
    const first = await importCommit(db, argsSem);
    expect(first.inserted).toBe(18);
    const full = arquivoDoMapeamento(m, 'futures', 'America/New_York') as MappedFile;
    const argsFull = buildImportArgs({ accountId: conta('lucid'), platform: 'modelo', fileName: 'b.csv', sha256: sha(text), fileTz: 'America/New_York', outcome: full });
    const completes = await importCommit(db, argsFull);
    expect(completes).toMatchObject({ batch_id: null, inserted: 0, completed: 18 });
    // A new model saves without routes and without a batch
    const novo = modeloASalvar({ ...m, nome: 'Sem lote' }, { tzHint: 'America/New_York', rota: null });
    expect((await saveTemplate(db, { ...novo!.payload, account_routes: {} }, null, null)).created).toBe(true);
    // Routes are checked against the batch's account: without one, any route is refused
    const comRota = { ...novo!.payload, name: 'Com rota', account_routes: { [accountRouteHash('X')]: conta('lucid') } };
    await expect(saveTemplate(db, comRota, null, null)).rejects.toMatchObject({ code: 'bad_template' });
    await importUndo(db, first.batch_id as string);
    zonaDoQuadro('lucid');
  });
});
