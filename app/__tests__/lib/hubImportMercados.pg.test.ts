/**
 * @jest-environment node
 *
 * Phase 3b · telas, the owner's decision of 23 Oct against the real SQL of migrations 20261024000001..2, on a throwaway
 * local Postgres (never the hosted project). Skipped unless both are set:
 *
 *   BH_PG_URL=postgres://postgres@127.0.0.1:PORT/postgres   a cluster as supabase/tests/run.sh builds it,
 *   BH_PG_SHIFT_FILE=/path/shift                             whose server reads its clock shift (seconds) from it
 *
 * Models apply in every market, but a model saved in another market than the file's account (its batches' accounts:
 * import_batches.template_id → trading_accounts.market, read by fetchTemplateMarkets with the user's session) is offered
 * with «Atualizar o modelo» unchecked, so the import saves a NEW model and never overwrites the other market's; a model
 * with the file's very columns in another market is only read. The flow, as the sheet runs it (lib/hub/importMapeado,
 * buildImportArgs, contasDb), on the board's invented files (testing/mapeadoTelas):
 *
 *   1. blackarrow.csv (f8) in Ylos 50k (Futuros): «BlackArrow» saved; its market is Futuros;
 *   2. b3.csv (f19: BlackArrow's columns + «Emolumentos») in Mini-índice (B3): «Parecido com o modelo “BlackArrow”»,
 *      «Atualizar» unchecked → a new model «BlackArrow · B3»; «BlackArrow»'s row unchanged, byte for byte;
 *   3. b3.csv again: the new model matched exactly in its own market, taken as is; «Nada novo»;
 *   4. blackarrow-2.csv with «Emolumentos» (the B3 model's very columns) in Ylos 50k: taken as is, never touched (the
 *      batch keeps no model), «BlackArrow · B3» unchanged; «Desfazer» keeps every model's market;
 *   5. (review) b3.csv without «Emolumentos» (BlackArrow's very columns), each data line ending in «;», in Mini-índice:
 *      read first with «,» («Não reconhecemos»); «Separador» «;» matches it against every model: Futuros' «BlackArrow»,
 *      only read; nothing saved, «BlackArrow» unchanged;
 *   6. (review) the same columns with the models unread: the «new» model has BlackArrow's header set, so the sheet does
 *      not send it (sobrescreveModelo); sent, import_template_save would update «BlackArrow»'s row (renamed, re-zoned).
 */
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import { buildImportArgs, checkTemplate, headerSignature, normaliseHeaders, previewArgs, type MappedFile, type Template } from '@/lib/domain/import';
import type { AccountMarket } from '@/lib/domain/markets';
import { fetchTemplateMarkets, fetchTemplates, importCommit, importPreview, importUndo, saveTemplate } from '@/lib/hub/contasDb';
import {
  arquivoDoMapeamento,
  bloqueioDoConferir,
  bloqueioDoMapa,
  comColuna,
  comLiquido,
  comPalavraDeLado,
  comSeparador,
  iniciarMapeamento,
  modeloASalvar,
  modeloSoParaLer,
  nomePadraoDoModelo,
  sobrescreveModelo,
  type ArquivoMapeavel,
  type Mapeamento,
} from '@/lib/hub/importMapeado';
import { mostrarFuso } from '@/lib/hub/importPrevia';
import { ARQUIVOS_QUADRO, CONTAS_QUADRO } from '@/testing/mapeadoTelas';
import { PG_URL, createAccountAsUser, pgClient, psql } from '@/testing/pg';

const SHIFT_FILE = process.env.BH_PG_SHIFT_FILE;
const describePg = PG_URL && SHIFT_FILE ? describe : describe.skip;
const NY = 'America/New_York';
const SP = 'America/Sao_Paulo';

function setClock(iso: string): void {
  const shift = Math.round((Date.parse(iso) - Date.now()) / 1000);
  fs.writeFileSync(SHIFT_FILE as string, `${shift}\n`);
  const now = Date.parse(JSON.parse(psql(`select to_jsonb(now())::text;`).trim()) as string);
  if (Math.abs(now - Date.parse(iso)) > 5000) throw new Error(`clock at ${new Date(now).toISOString()}, wanted ${iso}`);
}

const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const arquivo = (nome: string, text: string): ArquivoMapeavel => ({ fileName: nome, size: text.length, sha256: sha(text), text });

/** blackarrow-2.csv (f15) with a last column «Emolumentos» of 0,00: the very columns of b3.csv, in another order */
const F15_EMOLUMENTOS = ARQUIVOS_QUADRO.f15.texto
  .split('\r\n')
  .map((l, i) => `${l};${i === 0 ? 'Emolumentos' : '0,00'}`)
  .join('\r\n');

/** b3.csv (f19) without «Emolumentos»: BlackArrow's very columns, B3 rows */
const COLUNAS_BA = ARQUIVOS_QUADRO.f19.texto.split(/\r?\n/).map((l) => l.split(';').filter((_, j) => j !== 8).join(';'));
const B3_BA = COLUNAS_BA.join('\r\n');
/** …each data line ending in «;», the header without it: the domain's sniff reads it with «,» first */
const B3_BA_PV = COLUNAS_BA.map((l, i) => (i === 0 || l === '' ? l : `${l};`)).join('\r\n');
/** BlackArrow's header set as the browser signs it (the database's import_template_sig) */
const SIG_BA = headerSignature(normaliseHeaders(COLUNAS_BA[0].split(';')));

describePg('Phase 3b · a model saved in another market (owner decision, 23 Oct) on the real SQL', () => {
  const uid = randomUUID();
  const db = pgClient(uid);
  let ylos = '';
  let mini = '';
  let blackArrow = '';
  let blackArrowB3 = '';
  let loteB3 = '';

  /** A model's whole row (every column), to prove it unchanged */
  const linhaDoModelo = (id: string) => psql(`select md5(to_jsonb(t)::text) from public.import_templates t where id = '${id}';`).trim();
  const lote = (id: string) =>
    psql(`select coalesce(template_id::text, '-') || '|' || coalesce(template_name, '-') from public.import_batches where id = '${id}';`).trim();

  /** The mapping the sheet starts with: the user's models and their markets as the data layer reads them */
  async function iniciar(conta: 'ylos' | 'mini', nome: string, text: string): Promise<Mapeamento> {
    const c = CONTAS_QUADRO[conta];
    const [templates, mercados] = await Promise.all([fetchTemplates(db), fetchTemplateMarkets(db)]);
    const r = iniciarMapeamento(arquivo(nome, text), { market: c.market, templates, nomePadrao: nomePadraoDoModelo(c.platform), mercados });
    if (!r.ok) throw new Error(r.error);
    return r.mapeamento;
  }

  /** The file on its zone, as the sheet sends it: the preview, then (unless «Nada novo») the commit */
  async function importar(contaId: string, market: AccountMarket, m: Mapeamento, nome: string, text: string, tz: string) {
    const f = arquivoDoMapeamento(m, market, tz);
    if (!f.ok) throw new Error(f.error);
    const args = buildImportArgs({ accountId: contaId, platform: 'modelo', fileName: nome, sha256: sha(text), fileTz: tz, outcome: f });
    const previa = await importPreview(db, previewArgs(args));
    const commit = previa.new > 0 ? await importCommit(db, args) : null;
    return { f: f as MappedFile, previa, commit };
  }

  afterAll(() => {
    if (!PG_URL || !SHIFT_FILE) return;
    fs.writeFileSync(SHIFT_FILE, '0\n');
    psql(`delete from public.trades where user_id = '${uid}';
delete from public.import_batches where user_id = '${uid}';
delete from public.import_templates where user_id = '${uid}';
delete from public.trading_accounts where user_id = '${uid}';
delete from public.profiles where id = '${uid}';
delete from auth.users where id = '${uid}';`);
  });

  it('the accounts: Ylos 50k (Futuros, New York) and Mini-índice (B3, Brasília), no model yet', async () => {
    setClock('2026-10-15T15:00:00Z');
    psql(`insert into auth.users (id, email) values ('${uid}', 'mercados3b-${uid.slice(0, 8)}@example.test');`);
    for (const c of ['ylos', 'mini'] as const) {
      const a = CONTAS_QUADRO[c];
      const id = await createAccountAsUser(uid, {
        market: a.market,
        label: a.label,
        platform: a.platform,
        firm: a.firm,
        external_ref: a.external_ref,
        phase: a.phase,
        size: null,
        is_primary: c === 'ylos',
      });
      psql(`update public.trading_accounts set file_tz = '${a.file_tz}', tz_applied_at = null where id = '${id}';`);
      if (c === 'ylos') ylos = id;
      else mini = id;
    }
    await expect(fetchTemplates(db)).resolves.toEqual([]);
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({});
  });

  it('1 · blackarrow.csv in Ylos 50k: «Salvar como modelo» → «BlackArrow»; its market, from its batch, is Futuros', async () => {
    const { nome, texto } = ARQUIVOS_QUADRO.f8;
    const m = await iniciar('ylos', nome, texto);
    expect([m.match.kind, m.salvar, m.nome, m.outroMercado]).toEqual(['none', true, 'BlackArrow', undefined]);
    const { commit } = await importar(ylos, 'futures', m, nome, texto, NY);
    expect(commit?.inserted).toBe(18);
    const s = modeloASalvar(m, { tzHint: NY, rota: null });
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null });
    const salvo = await saveTemplate(db, s!.payload, commit!.batch_id, s!.replaces);
    expect(salvo.created).toBe(true);
    blackArrow = salvo.template_id;
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ [blackArrow]: ['futures'] });
  });

  it('2 · b3.csv in Mini-índice: «Parecido com o modelo “BlackArrow”», «Atualizar» unchecked → a NEW model «BlackArrow · B3»; «BlackArrow» unchanged', async () => {
    const antes = linhaDoModelo(blackArrow);
    const { nome, texto } = ARQUIVOS_QUADRO.f19;
    let m = await iniciar('mini', nome, texto);
    expect(m.match).toMatchObject({ kind: 'changed', template: { id: blackArrow, name: 'BlackArrow' } });
    expect([m.origem, m.inicio, m.salvar, m.nome, m.outroMercado]).toEqual(['modelo', 'mapa', false, 'BlackArrow · B3', ['futures']]);
    // The owner's answers on «mapa»: «X» = Venda, «Emolumentos» (nova) → «Outra taxa (soma na comissão)»
    m = comPalavraDeLado(m, 'x', 'sell', 'b3');
    expect(m.novas[m.lido.headers.indexOf('emolumentos')]).toBe(true);
    m = comColuna(m, m.lido.headers.indexOf('emolumentos'), 'fee', 'b3');
    expect([bloqueioDoMapa(m, 'b3'), bloqueioDoConferir(m, 'b3')]).toEqual([null, null]);
    // The futures model's New York is no hint for this file: the zone is asked, nothing pre-selected by the model
    const naParede = arquivoDoMapeamento(m, 'b3', null);
    if (!naParede.ok) throw new Error(naParede.error);
    expect(naParede.fileTzHint).toBeNull();
    expect(mostrarFuso(naParede, m, { id: mini, file_tz: SP, tz_applied_at: null }, {})).toBe(true);

    const { previa, commit } = await importar(mini, 'b3', m, nome, texto, SP);
    expect([previa.new, previa.errors.map((e) => `${e.line} ${e.code}`)]).toEqual([16, ['9 off_tick', '15 bad_direction']]);
    expect(commit?.inserted).toBe(16);
    loteB3 = commit!.batch_id as string;

    const s = modeloASalvar(m, { tzHint: SP, rota: null });
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null, nome: 'BlackArrow · B3' });
    expect(checkTemplate(s!.payload, { batch: { sig: naParede.format.sig, market: 'b3' }, accounts: [] })).toBeNull();
    const salvo = await saveTemplate(db, s!.payload, loteB3, s!.replaces);
    expect(salvo.created).toBe(true);
    expect(salvo.template_id).not.toBe(blackArrow);
    blackArrowB3 = salvo.template_id;

    // The futures model: every column as it was (name, columns, zone, last use)
    expect(linhaDoModelo(blackArrow)).toBe(antes);
    expect(lote(loteB3)).toBe(`${blackArrowB3}|BlackArrow · B3`);
    const modelos = await fetchTemplates(db);
    const porNome = (a: Template, b: Template) => a.name.localeCompare(b.name);
    expect(modelos.sort(porNome).map((t) => [t.name, t.tzHint, t.headers.includes('emolumentos')])).toEqual([
      ['BlackArrow', NY, false],
      ['BlackArrow · B3', SP, true],
    ]);
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ [blackArrow]: ['futures'], [blackArrowB3]: ['b3'] });
  });

  it('3 · b3.csv again in Mini-índice: the new model matched exactly in its own market, taken as is; «Nada novo»', async () => {
    const { nome, texto } = ARQUIVOS_QUADRO.f19;
    const m = await iniciar('mini', nome, texto);
    expect(m.match).toMatchObject({ kind: 'exact', template: { id: blackArrowB3, name: 'BlackArrow · B3' } });
    expect([m.porModelo, m.inicio, m.outroMercado, m.salvar, modeloSoParaLer(m)]).toEqual([true, 'previa', undefined, true, false]);
    const { previa, commit } = await importar(mini, 'b3', m, nome, texto, SP);
    expect([previa.new, previa.duplicate, commit]).toEqual([0, 16, null]);
  });

  it('4 · the B3 model’s very columns in Ylos 50k (Futuros): taken as is and only read; no touch; «Desfazer» keeps the markets', async () => {
    const antes = linhaDoModelo(blackArrowB3);
    const antesBa = linhaDoModelo(blackArrow);
    const nome = 'blackarrow-emolumentos.csv';
    const m = await iniciar('ylos', nome, F15_EMOLUMENTOS);
    expect(m.match).toMatchObject({ kind: 'exact', template: { id: blackArrowB3 } });
    expect([m.porModelo, m.inicio, m.outroMercado, modeloSoParaLer(m)]).toEqual([true, 'previa', ['b3'], true]);
    const { previa, commit } = await importar(ylos, 'futures', m, nome, F15_EMOLUMENTOS, NY);
    expect([previa.new, previa.duplicate, previa.errors]).toEqual([6, 18, []]);
    expect(commit?.inserted).toBe(6);
    // The sheet saves nothing (modeloASalvar null) and shows no model line
    expect(modeloASalvar(m, { tzHint: NY, rota: null })).toBeNull();
    expect(lote(commit!.batch_id as string)).toBe('-|-');
    expect([linhaDoModelo(blackArrowB3), linhaDoModelo(blackArrow)]).toEqual([antes, antesBa]);
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ [blackArrow]: ['futures'], [blackArrowB3]: ['b3'] });

    // «Desfazer» marks the batches undone and keeps their model: the markets stay
    await importUndo(db, commit!.batch_id as string);
    await importUndo(db, loteB3);
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ [blackArrow]: ['futures'], [blackArrowB3]: ['b3'] });
  });

  it('5 · review: BlackArrow’s very columns in Mini-índice, read first with «,»; «Separador» «;» finds Futuros’ «BlackArrow», only read; nothing written', async () => {
    const antes = linhaDoModelo(blackArrow);
    const nome = 'b3-ba.csv';
    const m0 = await iniciar('mini', nome, B3_BA_PV);
    expect([m0.lido.delimiter, m0.match.kind, m0.origem, m0.salvar, m0.nome]).toEqual([',', 'none', 'nomes', true, 'Profit (Nelogica)']);
    let m = comSeparador(m0, arquivo(nome, B3_BA_PV), ';', 'b3');
    expect(m.match).toMatchObject({ kind: 'exact', template: { id: blackArrow, name: 'BlackArrow' } });
    expect([m.lido.delimiter, m.outroMercado, m.salvar, modeloSoParaLer(m)]).toEqual([';', ['futures'], false, true]);
    m = comPalavraDeLado(m, 'x', 'sell', 'b3');
    expect([bloqueioDoMapa(m, 'b3'), bloqueioDoConferir(m, 'b3')]).toEqual([null, null]);
    const { f, previa, commit } = await importar(mini, 'b3', m, nome, B3_BA_PV, SP);
    expect(f.format).toEqual({ sig: SIG_BA, template: blackArrow });
    expect([previa.new, previa.errors.map((e) => `${e.line} ${e.code}`)]).toEqual([16, ['9 off_tick', '15 bad_direction']]);
    expect(commit?.inserted).toBe(16);
    // The sheet saves nothing and touches nothing: the batch keeps no model, «BlackArrow» stays Futuros' only
    expect(modeloASalvar(m, { tzHint: SP, rota: null })).toBeNull();
    expect(lote(commit!.batch_id as string)).toBe('-|-');
    expect(linhaDoModelo(blackArrow)).toBe(antes);
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ [blackArrow]: ['futures'], [blackArrowB3]: ['b3'] });
    await importUndo(db, commit!.batch_id as string);
  });

  it('6 · review: the models unread, the «new» model of the same columns is BlackArrow’s header set: not sent; sent, the SQL writes over «BlackArrow»', async () => {
    const antes = linhaDoModelo(blackArrow);
    const nome = 'b3-ba.csv';
    const c = CONTAS_QUADRO.mini;
    const r = iniciarMapeamento(arquivo(nome, B3_BA), { market: 'b3', templates: null, nomePadrao: nomePadraoDoModelo(c.platform), mercados: await fetchTemplateMarkets(db) });
    if (!r.ok) throw new Error(r.error);
    const m = comLiquido(comPalavraDeLado(r.mapeamento, 'x', 'sell', 'b3'), true);
    expect([m.match.kind, m.origem, m.salvar, m.nome, m.modelos]).toEqual(['none', 'nomes', true, 'Profit (Nelogica)', null]);
    expect([bloqueioDoMapa(m, 'b3'), bloqueioDoConferir(m, 'b3')]).toEqual([null, null]);
    const { commit } = await importar(mini, 'b3', m, nome, B3_BA, SP);
    expect(commit?.inserted).toBe(16);
    const s = modeloASalvar(m, { tzHint: SP, rota: null });
    expect(s).toMatchObject({ tipo: 'salvo', replaces: null, nome: 'Profit (Nelogica)' });
    // The sheet's guard: the models unknown → not sent; read again (the real rows) → «BlackArrow» has these very columns
    expect(sobrescreveModelo(s!, null)).toBe(true);
    expect(sobrescreveModelo(s!, await fetchTemplates(db))).toBe(true);
    expect(linhaDoModelo(blackArrow)).toBe(antes);
    // What it keeps from happening, on the real SQL: no new row; «BlackArrow»'s row renamed, re-zoned, now B3's too
    const salvo = await saveTemplate(db, s!.payload, commit!.batch_id, s!.replaces);
    expect([salvo.created, salvo.template_id]).toEqual([false, blackArrow]);
    expect(linhaDoModelo(blackArrow)).not.toBe(antes);
    const ba = (await fetchTemplates(db)).find((t) => t.id === blackArrow);
    expect([ba?.name, ba?.tzHint]).toEqual(['Profit (Nelogica)', SP]);
    await expect(fetchTemplateMarkets(db)).resolves.toEqual({ [blackArrow]: ['futures', 'b3'], [blackArrowB3]: ['b3'] });
  });
});
