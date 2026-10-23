const fs = require('fs');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const m = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/);
global.window = { innerHeight: 900 };
class DCLogic { constructor() { this.state = null; this.props = {}; } setState(p) { this.state = Object.assign({}, this.state || {}, p); } }
global.DCLogic = DCLogic;
const Component = new Function('DCLogic', 'setTimeout', m[1] + '\nreturn Component;')(DCLogic, () => {});
// template holes
const tpl = html.split('<script type="text/x-dc"')[0];
const holes = new Set();
for (const h of tpl.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) holes.add(h[1]);
const loopVars = new Set();
for (const f of tpl.matchAll(/as="([^"]+)"/g)) loopVars.add(f[1]);
const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
let fails = 0;
function check(c, label) {
  let v;
  try { v = c.renderVals(); } catch (err) { console.log('EXC', label, err.stack.split('\n').slice(0,3).join(' | ')); fails++; return null; }
  for (const h of holes) {
    const root = h.split('.')[0];
    if (loopVars.has(root) || root === 'true' || root === 'false' || root === '$index') continue;
    if (get(v, h) === undefined) { console.log('MISSING', label, h); fails++; }
  }
  // loop item fields
  const loops = [['trades','t'],['semanasCal','w'],['posso','p'],['planoDia','k'],['gruposConta','g'],['lotes','l']];
  return v;
}
const c = new Component();
const v0 = c.renderVals();
const cens = v0.grupos.flatMap((g) => g.itens.map((i) => i.v));
for (const cen of cens) {
  c.state = { cen };
  const v = check(c, cen);
  if (!v) continue;
  // check loop items
  for (const t of v.trades) for (const k of ['h','op','resTxt','cor','rot','fechado','plTxt']) if (t[k] === undefined) { console.log('TRADE MISSING', cen, k); fails++; }
  // interactions: open each trade, toggle marks, open editor, save, open review form, save
  for (const t of v.trades) { t.alternar(); const v2 = check(c, cen + ' open ' + t.id); if (v2) { const tt = v2.trades.find((x) => x.id === t.id); if (tt && tt.grupos.length) { tt.grupos[0].opcoes[1].escolher(); check(c, cen + ' mark'); } if (tt) { tt.axEditar(); const v3 = check(c, cen + ' axed'); const t3 = v3 && v3.trades.find((x) => x.id === t.id); if (t3) { t3.axEscolher(); check(c, cen+' axadd'); const v4 = c.renderVals(); const t4 = v4.trades.find((x)=>x.id===t.id); t4.axSalvar(); check(c, cen + ' axsave'); const v5 = c.renderVals(); const t5 = v5.trades.find((x)=>x.id===t.id); if (t5.imgs.length) { t5.imgs[0].abrir(); const v6 = check(c, cen+' dlg'); const t6 = v6.trades.find((x)=>x.id===t.id); t6.dlg.proxima(); check(c, cen+' dlg2'); t6.dlg.fechar(); } } } } }
  c.state = { cen };
  let v7 = c.renderVals();
  if (v7.revFechada) { v7.abrirRev(); v7 = check(c, cen + ' revform'); v7.seguiuOpcoes[1].escolher(); v7 = c.renderVals(); v7.salvarRev(); v7 = check(c, cen + ' revsaved'); if (v7 && v7.revSalva) { v7.editarRev(); v7 = check(c, cen+' reved'); v7.salvarRev(); v7 = check(c, cen+' rev2'); if (v7.temVersoes) { v7.alternarVersoes(); check(c, cen+' versoes'); } } }
  else if (v7.revSalva) { v7.alternarRev(); check(c, cen + ' revver'); }
  // calendar: click every clickable day and every week
  c.state = { cen };
  let vc = c.renderVals();
  const nMes = 6;
  for (let k = 0; k < nMes && !vc.semAnterior; k++) { vc.mesAnterior(); vc = check(c, cen + ' mes-'); }
  for (let k = 0; k < 8; k++) {
    for (const w of vc.semanasCal) { for (const d of w.dias) if (d.clicavel) { d.abrir(); const vd = check(c, cen + ' dia ' + d.id); if (vd && vd.antesCampo) { vd.antesMudar({target:{value:'x'}}); c.renderVals().antesSalvar(); check(c, cen+' antes'); } } if (w.botao) { w.abrir(); check(c, cen + ' sem ' + w.rotulo); } }
    vc = c.renderVals();
    if (vc.semProximo) break;
    vc.mesProximo(); vc = check(c, cen + ' mes+');
  }
  // accounts
  c.state = { cen };
  const va = c.renderVals();
  for (const g of va.gruposConta) for (const cc of g.contas) { c.state = { cen }; c.renderVals().gruposConta.forEach((gg) => gg.contas.forEach((x) => { if (x.nome === cc.nome) x.escolher(); })); check(c, cen + ' conta ' + cc.nome); }
  // «Posso operar hoje?»: the others' line and «Ver todas»; the selector's search (scenario 9b) and its choices
  c.state = { cen };
  let vp = c.renderVals();
  console.log(cen, '|', vp.possoSel.map((x) => x.nome + ': ' + x.pal + (x.sub ? ' · ' + x.sub : '') + (x.temLim ? ' · Limite do dia ' + x.limUsado + ' ' + x.limDe : '') + (x.temSoma ? ' · somando as contas de Futuros' : '')).join(''), '|', vp.outrasTit, vp.outrasPartes.map((o) => o.txt).join(' · '), '[' + vp.outrasBotao + ']');
  if (vp.possoSel.length !== 1) { console.log('POSSO SEL', cen, vp.possoSel.length); fails++; }
  // «Ver todas» lists the others as published: «somando» only on the selected account; the «·» ends every part but the last
  if (vp.possoOutras.some((x) => x.temSoma)) { console.log('SOMA NAS OUTRAS', cen); fails++; }
  if (vp.outrasPartes.some((o, j) => o.temSep !== (j < vp.outrasPartes.length - 1))) { console.log('SEP OUTRAS', cen); fails++; }
  // the selector's groups are named by headers that exist in the list
  { const ids = new Set(); vp.gruposConta.forEach((g) => { if (g.temMercado) ids.add(g.idMercado); if (g.temMesa) ids.add(g.idMesa); });
    vp.gruposConta.forEach((g) => g.rotulos.split(' ').forEach((id) => { if (!ids.has(id)) { console.log('ROTULO', cen, id); fails++; } })); }
  if (vp.temOutras) { const antes = vp.outrasAbertas; vp.alternarOutras(); vp = check(c, cen + ' outras'); if (vp.outrasAbertas === antes || vp.outrasBotao !== (antes ? 'Ver todas' : 'Ocultar')) { console.log('OUTRAS', cen); fails++; } vp.alternarOutras(); check(c, cen + ' outras2'); }
  c.state = { cen, contaAberta: true };
  vp = c.renderVals();
  if (vp.temBusca) {
    for (const termo of ['apex', 'funded', 'zzz', 'lúcid', '']) {
      vp.mudarBusca({ target: { value: termo } }); vp = check(c, cen + ' busca ' + termo);
      console.log('  busca', JSON.stringify(termo), '->', vp.buscaStatus || '(sem status)', vp.semAchados ? '| ' + vp.semAchadosTxt : '', '|', vp.gruposConta.map((g) => (g.temMercado ? g.mercado + ' > ' : '') + (g.temMesa ? g.mesa : '')).join(' ; ').slice(0, 160));
    }
    vp.mudarBusca({ target: { value: 'apex 50k #5' } }); vp = c.renderVals();
    vp.gruposConta[0].contas[0].escolher(); vp = check(c, cen + ' escolheu apex5');
    console.log('  escolheu', vp.contaNome, '|', vp.possoSel[0].pal, vp.possoSel[0].sub, '|', vp.outrasTit, vp.outrasPartes.map((o) => o.txt).join(' · '), '|', vp.diaTitulo, vp.rs.res);
    c.state = { cen, contaAberta: true }; vp = c.renderVals(); vp.mudarBusca({ target: { value: 'lucid 50k' } }); vp = c.renderVals();
    vp.gruposConta[0].contas[0].escolher(); vp = check(c, cen + ' escolheu lucid');
    console.log('  escolheu', vp.contaNome, '|', vp.possoSel[0].pal, vp.possoSel[0].sub, vp.possoSel[0].temSoma ? '| somando as contas de Futuros' : '', '|', vp.outrasTit, vp.outrasPartes.map((o) => o.txt).join(' · '));
    if (vp.contaNome !== 'Lucid 50k' || !vp.possoSel[0].temSoma) { console.log('SOMA LUCID', cen); fails++; }
  }
  c.state = { cen }; vp = c.renderVals();
  if (vp.contaNome === 'Lucid 50k' && vp.possoSel[0].temLim && !vp.possoSel[0].temSoma) { console.log('SOMA SEL', cen); fails++; }
}
console.log('scenarios', cens.length, 'fails', fails);
