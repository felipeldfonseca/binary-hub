class Component extends DCLogic {
  renderVals() {
    const D = this._D || (this._D = /*__DATA__*/null);
    const CHAVES = ['conta', 'dia', 'mes', 'sem', 'aberta', 'dlg', 'contaAberta', 'infos', 'revForm', 'revVer', 'revVers', 'rasc', 'revErro', 'revs', 'revStatus',
      'mks', 'mkStatus', 'axs', 'axEd', 'axRasc', 'axStatus', 'antes', 'antesEd', 'antesRasc', 'antesStatus', 'estado', 'avisoFechado', 'focoCal', 'semStatus',
      'lotes', 'impFeito', 'contaStatus', 'diaAnunciado', 'outras', 'busca'];
    const s0 = this.state || {};
    const cenId = D.cen[s0.cen] ? s0.cen : D.cenPadrao;
    const C = D.cen[cenId];
    const kIni = C.conta + '|' + C.dia;
    const ini = {
      dia: C.dia, mes: C.mes || null, sem: C.sem || null, aberta: C.aberta || null, dlg: C.dlg || null, contaAberta: !!C.contaAberta,
      infos: C.infos || {}, revForm: C.rev === 'form' || C.rev === 'editar' ? kIni : null, revVer: C.rev === 'ver' ? kIni : null,
      rasc: C.rascunho || null, estado: C.estado || 'pronto', tema: C.tema || 'claro', lotes: C.lotes || {}, outras: !!C.outras
    };
    const e = Object.assign({}, ini);
    Object.keys(s0).forEach((k) => { if (s0[k] !== undefined) e[k] = s0[k]; });
    const set = (p) => this.setState(p);
    const A = D.ags[C.ag];
    const contaId = e.conta && D.contas[e.conta] ? e.conta : C.conta;
    const K = D.contas[contaId];
    const AC = A.contas[contaId];
    const hoje = AC.hoje;
    const m = K.moeda;
    const tema = e.tema;
    const escuro = tema === 'escuro';
    const foco = (id) => (el) => { if (el && this._foco === id) { this._foco = null; el.focus(); } };
    const pl = (n, s, p) => n + ' ' + (n === 1 ? s : p);
    const listaE = (xs) => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];
    const MIN = '−';
    const grp = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const num = (c) => { const a = Math.abs(c); return grp(Math.floor(a / 100)) + ',' + String(a % 100).padStart(2, '0'); };
    const din = (c, sinal) => (c < 0 ? MIN : sinal && c > 0 ? '+' : '') + m + ' ' + num(c);
    const numS = (c) => (c < 0 ? MIN : c > 0 ? '+' : '') + num(c);
    const numC = (c) => { const v = Math.round(Math.abs(c) / 100); return (c < 0 && v ? MIN : c > 0 && v ? '+' : '') + grp(v); };
    const corDe = (c) => c > 0 ? 'var(--mint)' : c < 0 ? 'var(--red)' : 'var(--text)';
    const MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const M3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const WD = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    const WD3 = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
    const CAB = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const dt = (id) => new Date(id + 'T00:00:00Z');
    const idDe = (d) => d.toISOString().slice(0, 10);
    const add = (id, n) => { const d = dt(id); d.setUTCDate(d.getUTCDate() + n); return idDe(d); };
    const wd = (id) => (dt(id).getUTCDay() + 6) % 7;
    const dn = (id) => { const x = +id.slice(8, 10); return x === 1 ? '1º' : String(x); };
    const curto = (id) => dn(id) + ' ' + M3[+id.slice(5, 7) - 1];
    const longo = (id) => WD[wd(id)] + ', ' + dn(id) + ' de ' + MES[+id.slice(5, 7) - 1];
    const segDe = (id) => add(id, -wd(id));
    const hm = (s) => { const p = s.split(':'); return +p[0] * 60 + +p[1]; };
    const nada = 'Não preenchido';

    // ------------------------------------------------------------------ the account's days, at this scenario's clock
    const dias = D.dias[contaId] || {};
    const over = (A.over || {})[contaId] || null;
    const variante = C.variante === 'avisar' && contaId === 'top';
    const rec = (id) => {
      if (!id || id > hoje) return null;
      if (id === hoje && over) return over;
      if (variante && id === '2026-11-19') return D.var19;
      return dias[id] || null;
    };
    const ids = Object.keys(dias).filter((id) => id <= hoje).sort();
    if (over && ids.indexOf(hoje) < 0) ids.push(hoje);
    const sessRevs = e.revs || {};
    const revsDe = (id) => {
      const r = rec(id);
      const base = r && r.rev ? r.rev.filter((v) => v.em <= AC.iso) : [];
      return base.concat(sessRevs[contaId + '|' + id] || []);
    };
    const contaRev = (r) => !!(r && r.k !== 'h' && r.app);
    const ehDiario = (r) => !!(r && r.k !== 'h');
    const quandoV = (v, dia) => v.dia === dia ? 'às ' + v.hm : 'em ' + curto(v.dia) + ', às ' + v.hm;

    // ------------------------------------------------------------------ open day, month, week
    let dia = e.dia || hoje;
    if (dia > hoje) dia = hoje;
    const mesesConta = (D.meses[contaId] || []).filter((x) => x <= hoje.slice(0, 7));
    if (mesesConta.indexOf(hoje.slice(0, 7)) < 0) mesesConta.push(hoje.slice(0, 7));
    let mes = e.mes || dia.slice(0, 7);
    if (mesesConta.indexOf(mes) < 0) mes = mesesConta[mesesConta.length - 1];
    const iMes = mesesConta.indexOf(mes);
    const sem = e.sem || segDe(dia);

    // ------------------------------------------------------------------ calendar
    const nvs = A.nv[contaId] || {};
    const fundoDe = (nv, neg) => {
      const c = neg ? '255,138,138' : '225,255,217';
      if (nv === 1) return ['rgba(' + c + ',0.07)', 'var(--text)', 'inset 0 -4px 0 rgba(' + c + ',0.95)'];
      if (nv === 2) return ['rgba(' + c + ',0.15)', 'var(--text)', 'inset 0 -4px 0 rgba(' + c + ',0.95)'];
      if (nv === 3) return ['rgba(' + c + ',' + (neg && escuro ? '0.82' : '0.72') + ')', neg ? '#3A0F0F' : '#26301F', 'none'];
      if (nv === 4) return ['rgba(' + c + ',0.90)', neg ? '#3A0F0F' : '#26301F', '0 8px 22px rgba(' + c + ',0.28)'];
      return ['var(--inset)', 'var(--text)', 'none'];
    };
    const yy = +mes.slice(0, 4);
    const mm = +mes.slice(5, 7);
    const primeiro = mes + '-01';
    const ultimo = idDe(new Date(Date.UTC(yy, mm, 0)));
    const sete = K.cols === 7 || ids.some((id) => id.slice(0, 7) === mes && wd(id) >= 5 && rec(id) && rec(id).n > 0);
    const cols = sete ? 7 : 5;
    const clicaveis = [];
    const semanaStats = (s) => {
      let net = 0, n = 0, fora = 0, foraNet = 0, hist = 0, histN = 0, temD = false, temH = false;
      const idsS = [];
      for (let i = 0; i < 7; i++) {
        const id = add(s, i);
        const r = rec(id);
        if (!r) continue;
        idsS.push(id);
        if (r.k === 'h') { hist += r.net; histN += r.n; temH = true; } else {
          temD = true; net += r.net; n += r.n; fora += r.fora; foraNet += r.foraNet || 0;
          if (r.hist) { hist += r.hist.net; histN += r.hist.n; temH = true; }
        }
      }
      return { net, n, fora, foraNet, hist, histN, temD, temH, ids: idsS };
    };
    const rotSem = (s, c) => {
      const f = add(s, c - 1);
      return s.slice(5, 7) === f.slice(5, 7) ? dn(s) + '–' + dn(f) + ' ' + M3[+f.slice(5, 7) - 1] : curto(s) + '–' + curto(f);
    };
    const semanasCal = [];
    let wi = 0;
    for (let s = segDe(primeiro); s <= ultimo; s = add(s, 7)) {
      const diasW = [];
      for (let i = 0; i < cols; i++) {
        const id = add(s, i);
        const foraMes = id.slice(0, 7) !== mes;
        const r = foraMes ? null : rec(id);
        const futuro = id > hoje;
        const ehHoje = id === hoje;
        const temOps = !!(r && r.n > 0);
        const clicavel = !foraMes && !futuro && (temOps || ehHoje);
        const nv = r ? nvs[id] || 0 : 0;
        const neg = !!(r && r.net < 0);
        const f3 = temOps ? fundoDe(nv, neg) : ['var(--inset)', 'var(--text)', 'none'];
        const vs = r && ehDiario(r) ? revsDe(id) : [];
        const marcaRev = vs.length > 0;
        const hist = !!(r && r.k === 'h');
        const semOp = !foraMes && !futuro && !temOps && !ehHoje;
        const fimDeSemana = wd(id) >= 5 && K.cols !== 7;
        let dica = '';
        let aria = '';
        if (temOps) {
          const pendente = contaRev(r) && id < hoje;
          dica = r.dica + (ehDiario(r) ? (marcaRev ? ' · revisão escrita' : pendente ? ' · sem revisão' : '') : '');
          aria = r.aria + (marcaRev ? ', revisão escrita' : pendente ? ', sem revisão' : '') + (ehHoje ? ', hoje' : '');
        } else if (ehHoje && !foraMes) {
          dica = curto(id) + ' · hoje, sem operações ainda';
          aria = curto(id) + ', hoje, sem operações ainda';
        } else if (ehHoje) {
          aria = curto(id) + ', hoje';
        } else if (semOp) {
          dica = curto(id) + ' · sem operações';
          aria = curto(id) + ', sem operações';
        } else if (futuro && !foraMes) {
          aria = curto(id) + ', ainda não aconteceu';
        }
        if (clicavel) clicaveis.push(id);
        const classe = [hist ? (nv >= 3 ? 'cal-imp-forte' : 'cal-imp') : '', ehHoje ? 'cal-hoje' : '', foraMes ? 'cal-fora' : '', i === 0 ? 'dica-e' : i >= cols - 2 ? 'dica-d' : ''].join(' ').trim();
        diasW.push({
          id, num: String(+id.slice(8, 10)), clicavel, fixa: !clicavel, classe, aria, dica, temDica: !!dica,
          sel: id === dia, fundo: f3[0], corTexto: f3[1], brilho: f3[2], atraso: (wi * (cols + 1) + i) * 14 + 'ms',
          temMarcas: !!(r && (r.fora || r.hit || marcaRev)), marcaFora: !!(r && r.fora), marcaLimite: !!(r && r.hit), marcaRev,
          res: temOps ? r.res : semOp ? (fimDeSemana ? '' : 'sem op.') : ehHoje && !foraMes ? '—' : '', resCurto: temOps ? r.resCurto : semOp ? (fimDeSemana ? '' : '—') : ehHoje && !foraMes ? '—' : '',
          fonte: temOps ? 'var(--mono)' : 'inherit', tam: temOps ? '13px' : '12px',
          abrir: () => { this._rolar = true; set({ dia: id, sem: null, aberta: null, dlg: null, diaAnunciado: id, axEd: null }); },
          ref: (el) => { if (el && this._focoCal === id) { this._focoCal = null; el.focus(); } }
        });
      }
      const st = semanaStats(s);
      const temAlgo = st.temD || st.temH;
      const rot = rotSem(s, cols);
      const rotLongo = rangeTxt(s, add(s, cols - 1));
      semanasCal.push({
        dias: diasW, rotulo: rot, botao: temAlgo, vazia: !temAlgo, traco: s <= hoje ? '—' : '', sel: sem === s, atraso: (wi * (cols + 1) + cols) * 14 + 'ms',
        classe: !st.temD && st.temH ? 'cal-imp' : '',
        res: st.temD ? numS(st.net) : numS(st.hist), cor: st.temD ? corDe(st.net) : 'var(--text-2)',
        n: (st.temD ? st.n : st.histN) + ' op.', temFora: !!st.fora, foraN: String(st.fora), temHist: st.temD && st.temH, hist: numS(st.hist),
        aria: ariaSem(rotLongo, st),
        abrir: () => { this._rolarSem = true; set({ sem: s, semStatus: 'Semana aberta abaixo: ' + rotLongo + '.' }); }
      });
      wi++;
    }
    function ariaSem(rotLongo, st) {
      const corpo = st.temD ? numS(st.net) + ' ' + K.pal + ', ' + st.n + ' op.' + (st.fora ? ', ' + st.fora + ' fora do plano' : '') + (st.temH ? ', histórico importado à parte: ' + numS(st.hist) : '') : 'histórico importado, ' + numS(st.hist) + ' ' + K.pal;
      return 'Semana de ' + rotLongo + ': ' + corpo + (corpo.slice(-1) === '.' ? '' : '.') + ' Abrir a semana.';
    }
    function rangeTxt(a, b) {
      const ma = +a.slice(5, 7) - 1, mb = +b.slice(5, 7) - 1;
      const da = +a.slice(8, 10) === 1 ? '1º' : String(+a.slice(8, 10));
      const db = +b.slice(8, 10) === 1 ? '1º' : String(+b.slice(8, 10));
      const ms = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      return ma === mb ? da + ' a ' + db + ' de ' + ms[mb] : da + ' de ' + ms[ma] + ' a ' + db + ' de ' + ms[mb];
    }
    const focoCalId = e.focoCal && clicaveis.indexOf(e.focoCal) >= 0 ? e.focoCal : clicaveis.indexOf(dia) >= 0 ? dia : clicaveis[0];
    semanasCal.forEach((w) => w.dias.forEach((c) => { c.tab = c.id === focoCalId ? '0' : '-1'; }));
    const moverFoco = (id) => { this._focoCal = id; set({ focoCal: id }); };
    const teclaCal = (ev) => {
      const alvo = ev && ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-dia') : null;
      if (!alvo) return;
      const i = clicaveis.indexOf(alvo);
      let novo = null;
      if (ev.key === 'ArrowRight') novo = clicaveis[Math.min(i + 1, clicaveis.length - 1)];
      else if (ev.key === 'ArrowLeft') novo = clicaveis[Math.max(i - 1, 0)];
      else if (ev.key === 'ArrowDown') novo = clicaveis.find((x) => x >= add(alvo, 7)) || clicaveis[clicaveis.length - 1];
      else if (ev.key === 'ArrowUp') novo = clicaveis.slice().reverse().find((x) => x <= add(alvo, -7)) || clicaveis[0];
      else if (ev.key === 'Home') novo = clicaveis[0];
      else if (ev.key === 'End') novo = clicaveis[clicaveis.length - 1];
      else if (ev.key === 'PageUp' || ev.key === 'PageDown') {
        ev.preventDefault();
        const j = iMes + (ev.key === 'PageUp' ? -1 : 1);
        if (j >= 0 && j < mesesConta.length) { this._focoCalPrimeiro = true; set({ mes: mesesConta[j], focoCal: null }); }
        return;
      } else return;
      ev.preventDefault();
      if (novo && novo !== alvo) moverFoco(novo);
    };
    if (this._focoCalPrimeiro && clicaveis.length) { this._focoCalPrimeiro = false; this._focoCal = clicaveis[0]; }

    // ------------------------------------------------------------------ pending reviews, top line
    const pend = ids.filter((id) => id < hoje && contaRev(rec(id)) && !revsDe(id).length);
    const desde28 = add(hoje, -28);
    const pendRec = pend.filter((id) => id >= desde28);
    const avisoTexto = pl(pend.length, 'pregão sem revisão', 'pregões sem revisão') + (pendRec.length && pendRec.length < pend.length ? ', ' + pendRec.length + ' nas últimas 4 semanas' : '');
    let nDiario = 0, nDias = 0, nHist = 0;
    ids.forEach((id) => {
      const r = rec(id);
      if (!r) return;
      if (r.k === 'h') nHist += r.n; else { nDiario += r.n; nDias += 1; if (r.hist) nHist += r.hist.n; }
    });
    const linhaTopo = !K.regras ? '' : nDiario
      ? 'Diário desde ' + K.desdeC + ': ' + pl(nDiario, 'operação', 'operações') + ' em ' + pl(nDias, 'pregão', 'pregões') + (nHist ? ' · ' + nHist + ' antes, em Histórico importado · só resultado' : '')
      : 'Diário desde ' + K.desdeC + ': nenhuma operação ainda.';

    // ------------------------------------------------------------------ the day
    const Rd = rec(dia);
    const antDe = (id) => { const xs = ids.filter((x) => x < id && ehDiario(rec(x))); return xs.length ? xs[xs.length - 1] : null; };
    const R = Rd || {
      t: longo(dia), k: K.regras ? 'd' : 'h', n: 0, net: 0, fora: 0, app: false, trades: [], tags: [], nota: '', versao: [], antes: null, rev: [],
      fatos: K.regras ? '0 operações' + (K.lim ? ' · limite: ' + din(0).replace(',00', '') + ' de ' + K.limTxt.split(' · ')[0] + ' no pior momento' : '') : '',
      mudou: '', ant: antDe(dia), foraLista: [], pe: null, vazio: true,
      rs: { res: din(0), resCor: 'var(--text)', ops: '0', opsSub: '', lim: !K.regras ? '—' : K.lim ? 'nenhuma perda acumulada' : 'sem limite', limSub: !K.regras ? 'sem regras salvas' : K.lim ? 'pior momento' : 'nas suas regras', temBarra: false, bar: '0%', barCor: 'var(--amber)', fora: K.regras ? 'nenhuma' : '—', foraSub: '', foraCor: 'var(--text)' },
      info: K.lim ? 'Limite do dia: a maior perda acumulada no pregão, no pior momento, contra o seu limite de ' + K.limTxt.split(' · ')[0] + '. Pelas suas regras, ao atingir o limite o app encerra o dia.' : 'Limite do dia: esta conta não tem limite nas suas regras.',
      plano: K.regras ? [
        K.temJan ? { item: 'Janela', plano: K.janPlano, fato: 'nenhuma operação ainda', marca: '', tipo: 'neutro' } : { item: 'Janela', plano: 'Sem janela salva', fato: '', marca: 'Sem regra', tipo: 'neutro', link: 'Definir em Personalizar' },
        K.lim ? { item: 'Limite', plano: K.limTxt, fato: 'nenhuma operação ainda', marca: '', tipo: 'neutro' } : { item: 'Limite', plano: 'sem limite', fato: '', marca: 'Sem regra', tipo: 'neutro' }
      ] : null
    };
    const keyD = contaId + '|' + dia;
    const ehHojeDia = dia === hoje;
    const diario = R.k !== 'h';
    const planoDia = (R.plano || []).map((k) => Object.assign({}, k, { temFato: !!k.fato, temLink: !!k.link, temMarca: !!k.marca }));
    const temBe = planoDia.some((k) => k.item === 'Breakeven');
    const infoPlano = 'Cada linha compara as regras que valiam neste dia, em Personalizar, com o que o diário registrou: janela e limite. Uma operação fora da janela ou depois do limite fica fora do plano, mesmo quando a tela só avisava.'
      + (temBe ? ' Breakeven: a sua regra e em quantas operações que chegaram ao ponto dela o stop foi para a entrada; quem confere é Análises.' : '')
      + (K.futuros ? ' Bloqueio de dados, viés e regra do estado chegam na Fase 5.' : '');
    const tags = (R.tags || []).slice();
    const vsDia = diario ? revsDe(dia) : [];
    if (diario && Rd && vsDia.length) tags.push('Revisão escrita');
    else if (diario && Rd && R.app && dia < hoje) tags.push('Sem revisão');

    // «Antes de operar»
    const antesSess = (e.antes || {})[keyD];
    const antesV = antesSess || R.antes || null;
    const antesEd = e.antesEd === keyD;
    const antesCampo = ehHojeDia && K.regras && (!antesV || antesEd);
    const antesSalvar = () => {
      const txt = ((e.antesRasc != null ? e.antesRasc : antesV ? antesV.txt : '') || '').trim();
      if (!txt) return;
      const depois = R.pe && hm(R.pe) <= hm(AC.hm);
      const quando = (depois ? 'depois' : 'antes') + ' da 1ª entrada';
      const nota = antesV ? antesV.nota.split(' · ')[0] + ' · editado às ' + AC.hm + ', ' + quando : 'anotado às ' + AC.hm + ', ' + quando;
      this._foco = 'antesEditar';
      set({ antes: Object.assign({}, e.antes || {}, { [keyD]: { txt, nota } }), antesEd: null, antesRasc: null, antesStatus: 'Anotado às ' + AC.hm + K.suf + '.' });
    };
    // «Do pregão anterior»
    const ant = R.ant !== undefined ? R.ant : antDe(dia);
    const antVs = ant ? revsDe(ant) : [];
    const antLevar = antVs.length ? antVs[antVs.length - 1].levar : '';
    const anteriorTxt = antLevar ? '“' + antLevar + '” · ' + curto(ant) : 'Nada trazido do pregão anterior.';

    // ------------------------------------------------------------------ trades
    const GRUPOS = [['setup', 'Setup', ['A', 'B', 'C']], ['execucao', 'Execução', ['cedo', 'no ponto', 'tarde']], ['emocao', 'Emoção', ['Calmo', 'Confiante', 'Ansioso', 'Frustrado', 'Neutro']]];
    const quandoAgora = ehHojeDia ? 'às ' + AC.hm : dia === AC.ontem ? 'ontem às ' + AC.hm : AC.hojeCurto + ' às ' + AC.hm;
    const sessMk = e.mks || {};
    const sessAx = e.axs || {};
    const trades = (R.trades || []).map((t, i) => {
      const tid = contaId + '-' + dia + '-' + i;
      const ab = e.aberta === tid;
      const partes = t.op.split(' · ');
      const lado = partes[1];
      const ativo = partes[0];
      const he = t.h.split('–')[0];
      const hist = t.pl === 'hist';
      const fora = t.pl === 'fora';
      const q = t.q || [];
      const mk = t.mk || null;
      const mkS = sessMk[tid] || {};
      const grupos = mk ? GRUPOS.map((g) => {
        const base = mk[g[0]] || { v: '', t: '' };
        const cur = mkS[g[0]] || base;
        return {
          id: 'mk-' + g[0] + '-' + tid, rot: g[0] === 'setup' ? 'Setup · sua nota, de A a C' : g[1], temTempo: !!cur.t, tempo: cur.t,
          opcoes: g[2].map((o) => ({
            rot: o, sel: cur.v === o,
            escolher: () => {
              const novo = cur.v === o ? '' : o;
              const fase = t.ab ? 'antes da saída' : 'depois do resultado';
              let tt;
              if (base.v) {
                const antes = base.t.indexOf('antes: ') === 0 ? base.t.split(' · agora: ')[0] : 'antes: ' + base.v + ' ' + base.t.split(' · ')[0];
                tt = antes + ' · agora: ' + (novo || 'sem marca') + ' ' + quandoAgora;
              } else tt = novo ? quandoAgora + ' · ' + fase : '';
              const rotM = g[0] === 'setup' ? 'Setup ' + novo : g[1] + ': ' + novo;
              const anuncio = novo ? rotM + ', ' + quandoAgora + ', ' + fase + '.' : g[1] + ' desmarcado, ' + quandoAgora + '.';
              set({ mks: Object.assign({}, sessMk, { [tid]: Object.assign({}, mkS, { [g[0]]: { v: novo, t: tt } }) }), mkStatus: anuncio });
            }
          }))
        };
      }) : [];
      // images and note
      const ax = sessAx[tid] || t.ax || null;
      const temAxConteudo = !!(ax && ((ax.imgs && ax.imgs.length) || ax.nota));
      const axEd = e.axEd === tid;
      const rascAx = e.axRasc || { imgs: [], nota: '' };
      const imgsVis = temAxConteudo ? ax.imgs || [] : [];
      const dlgOn = !!(e.dlg && e.dlg[0] === tid && imgsVis.length);
      const di = dlgOn ? Math.min(e.dlg[1], imgsVis.length - 1) : 0;
      const fecharDlg = () => { this._foco = 'mini-' + tid + '-' + di; set({ dlg: null }); };
      const irDlg = (k) => { if (k >= 0 && k < imgsVis.length) set({ dlg: [tid, k] }); };
      const abrirEditor = () => { this._foco = 'nota-' + tid; set({ axEd: tid, dlg: null, axRasc: { imgs: (ax && ax.imgs ? ax.imgs : []).slice(), nota: ax ? ax.nota || '' : '' } }); };
      const salvarAx = () => {
        const n = rascAx.imgs.length;
        const notaOk = !!(rascAx.nota || '').trim();
        const fase = t.ab ? 'antes da saída' : 'depois do resultado';
        const verbo = (n && notaOk) || n > 1 ? 'salvas' : 'salva';
        const quem = n && notaOk ? pl(n, 'imagem', 'imagens') + ' e nota salvas' : n ? (n === 1 ? '1 imagem salva' : n + ' imagens salvas') : 'Nota salva';
        const quandoA = ehHojeDia ? 'às ' + AC.hm : 'em ' + AC.hojeCurto + ', às ' + AC.hm;
        const novo = { imgs: rascAx.imgs, nota: (rascAx.nota || '').trim(), quando: n || notaOk ? verbo + ' ' + quandoA + ' · ' + fase : '' };
        const status = n || notaOk ? quem + ' ' + quandoA + '.' : 'Imagens e nota removidas ' + quandoA + '.';
        this._foco = 'axEditar-' + tid;
        set({ axs: Object.assign({}, sessAx, { [tid]: novo }), axEd: null, axRasc: null, axStatus: status });
      };
      const fatos = (t.fatos || []).map((f) => ({ rot: f[0], val: f[1] }));
      const tempo = (t.tempo || []).map((it) => Object.assign({}, it, { temSub: !!it.sub }));
      return {
        id: tid, h: t.h, op: t.op, temClip: !!(temAxConteudo || (!sessAx[tid] && t.clip)), clip: temAxConteudo ? (imgsVis.length && ax.nota ? 'tem imagens e nota' : imgsVis.length ? 'tem imagens' : 'tem nota') : t.clip || '',
        temChip: !!t.chip, chip: t.chip || '', temSub: !!t.sub, sub: t.sub || '',
        resTxt: t.ab ? 'aberta' : t.res, cor: t.ab ? 'var(--text-2)' : (t.res || '').charAt(0) === '+' ? 'var(--mint)' : (t.res || '').charAt(0) === MIN ? 'var(--red)' : 'var(--text)',
        planoOk: t.pl === 'ok', planoFora: fora, planoHist: hist, planoNada: t.pl === 'nada',
        plTxt: '● ' + q.join(' · '), plAria: 'fora do plano: ' + q.join(' e '),
        temAcao: !!t.acao, acao: t.acao || '', acaoAria: t.acaoAria || '',
        borda: fora ? 'var(--amber-border)' : 'transparent', aberto: ab, drillId: 'drill-' + tid, tempoId: 'tempo-' + tid,
        rot: 'Detalhes da operação: ' + lado + ' de ' + ativo + ' às ' + he,
        fechado: !ab,
        alternar: () => set({ aberta: ab ? null : tid, dlg: null, axEd: null }),
        fatos, linhas: (t.linhas || []).concat(t.be && !tempo.length ? [t.be] : []), temTempo: !!tempo.length, tempo, temBe: !!t.be && !!tempo.length, semTempoBe: false, be: t.be || '',
        temAx: temAxConteudo && !axEd, axQuando: ax ? ax.quando || '' : '', podeEditarAx: !hist, refAxEditar: foco('axEditar-' + tid),
        axEditar: abrirEditor, temMinis: !!imgsVis.length && !dlgOn, temNota: !!(ax && ax.nota), nota: ax ? ax.nota : '',
        imgs: imgsVis.map((im, k) => ({ nome: im.nome, tam: im.tam, f1: im.f === 1, f2: im.f === 2, f3: im.f === 3, aria: 'Abrir ' + im.nome + ', imagem ' + (k + 1) + ' de ' + imgsVis.length, ref: foco('mini-' + tid + '-' + k), abrir: () => { this._foco = 'dlg-' + tid; set({ dlg: [tid, k] }); } })),
        temDlg: dlgOn, dlgId: 'dlg-t-' + tid,
        dlg: dlgOn ? { titulo: 'Imagem ' + (di + 1) + ' de ' + imgsVis.length, nome: imgsVis[di].nome, tam: imgsVis[di].tam, f1: imgsVis[di].f === 1, f2: imgsVis[di].f === 2, f3: imgsVis[di].f === 3, semAnt: di === 0, semProx: di >= imgsVis.length - 1,
          anterior: () => irDlg(di - 1), proxima: () => irDlg(di + 1), fechar: fecharDlg, refFechar: foco('dlg-' + tid) } : {},
        dlgTecla: (ev) => { if (!ev) return; if (ev.key === 'Escape') { ev.preventDefault(); fecharDlg(); } else if (ev.key === 'ArrowLeft') irDlg(di - 1); else if (ev.key === 'ArrowRight') irDlg(di + 1); },
        axEd, temRascImgs: !!(axEd && rascAx.imgs.length),
        rascImgs: axEd ? rascAx.imgs.map((im, k) => ({ nome: im.nome, tam: im.tam, aria: 'Remover imagem ' + im.nome, remover: () => set({ axRasc: Object.assign({}, rascAx, { imgs: rascAx.imgs.filter((_x, j) => j !== k) }), axStatus: im.nome + ' removida. ' + (rascAx.imgs.length - 1) + ' de 4.' }) })) : [],
        axCheio: axEd && rascAx.imgs.length >= 4,
        axEscolher: () => {
          if (rascAx.imgs.length >= 4) return;
          const k = rascAx.imgs.length + 1;
          const nome = ativo.replace('/', '') + '_' + he.replace(':', '-') + '_' + k + '.png';
          const novas = rascAx.imgs.concat([{ nome, tam: (380 + 70 * k) + ' KB', f: (k % 3) + 1 }]);
          set({ axRasc: Object.assign({}, rascAx, { imgs: novas }), axStatus: '1 imagem adicionada. ' + novas.length + ' de 4.' });
        },
        notaId: 'nota-campo-' + tid, refNota: foco('nota-' + tid), rascNota: rascAx.nota || '', contador: (rascAx.nota || '').length + ' de 1000',
        axMudarNota: (ev) => set({ axRasc: Object.assign({}, rascAx, { nota: ev.target.value }) }),
        axSalvar: salvarAx, axCancelar: () => { this._foco = temAxConteudo ? 'axEditar-' + tid : 'axAdd-' + tid; set({ axEd: null, axRasc: null }); },
        podeAdicionarAx: !hist && !temAxConteudo && !axEd, refAxAdd: foco('axAdd-' + tid), axStatus: ab ? e.axStatus || '' : '',
        temMarcas: !!mk && !hist, grupos, mkStatus: ab ? e.mkStatus || '' : '', marcasInfoId: 'info-marcas-' + tid
      };
    });
    const semOps = !trades.length;

    // ------------------------------------------------------------------ the review
    const temRevisao = diario && K.regras;
    const rvUlt0 = vsDia.length ? vsDia[vsDia.length - 1] : null;
    const comV = (v) => Object.assign({}, v, { funcV: v.func || nada, difV: v.dif || nada, seguiuV: v.seguiu || nada, levarV: v.levar || nada });
    const formOn = e.revForm === keyD;
    const verOn = e.revVer === keyD;
    const rasc = e.rasc || (C.rev === 'editar' && keyD === kIni && rvUlt0 ? { func: rvUlt0.func, dif: rvUlt0.dif, seguiu: rvUlt0.seguiu, levar: rvUlt0.levar } : { func: '', dif: '', seguiu: '', levar: '' });
    const setRasc = (p) => set({ rasc: Object.assign({}, rasc, p) });
    const revLinha = rvUlt0 ? 'Salva ' + quandoV(vsDia[0], dia) + (vsDia.length > 1 ? ' · editada ' + quandoV(rvUlt0, dia) : '') + ' · Seguiu o plano? ' + (rvUlt0.seguiu || nada) + ' · pela sua resposta, depois do resultado' : '';
    const salvarRev = () => {
      if (e.estado === 'offline') { set({ revErro: 'Sem conexão. A revisão não foi salva.' }); return; }
      const v = { em: AC.iso, dia: AC.iso.slice(0, 10), hm: AC.hm, reg: R.fatos, n: R.n, net: R.net, func: (rasc.func || '').trim(), dif: (rasc.dif || '').trim(), seguiu: rasc.seguiu || '', levar: (rasc.levar || '').trim() };
      this._foco = 'editar';
      set({ revs: Object.assign({}, sessRevs, { [keyD]: (sessRevs[keyD] || []).concat([v]) }), revForm: null, revVer: keyD, rasc: null, revErro: null, revStatus: 'Revisão salva às ' + AC.hm + K.suf + '.' });
    };

    // ------------------------------------------------------------------ the week
    const colsSem = K.cols === 7 || semanaStats(sem).ids.some((id) => wd(id) >= 5 && rec(id) && rec(id).k !== 'h') ? 7 : 5;
    const fimSem = add(sem, colsSem - 1);
    const stS = semanaStats(sem);
    const emAndamento = sem <= hoje && hoje <= add(sem, 6);
    const pregoesAte = Math.min(wd(hoje) + 1, colsSem);
    const comOps = stS.ids.filter((id) => ehDiario(rec(id)) && rec(id).n > 0).length;
    const contaS = stS.ids.filter((id) => (contaRev(rec(id)) && id < hoje) || (ehDiario(rec(id)) && revsDe(id).length));
    const comRev = contaS.filter((id) => revsDe(id).length).length;
    const barras = [];
    let maxAbs = 1;
    for (let i = 0; i < colsSem; i++) { const r = rec(add(sem, i)); if (ehDiario(r)) maxAbs = Math.max(maxAbs, Math.abs(r.net)); }
    const leitor = [];
    for (let i = 0; i < colsSem; i++) {
      const id = add(sem, i);
      const r = rec(id);
      const ok = ehDiario(r) && r.n > 0;
      const h = ok && r.net ? Math.max(3, Math.round(56 * Math.abs(r.net) / maxAbs)) + 'px' : '0px';
      barras.push({ rot: WD3[i], val: ok ? numS(r.net) : id > hoje ? '' : '—', valCurto: ok ? numC(r.net) : id > hoje ? '' : '—', hPos: ok && r.net > 0 ? h : '0px', hNeg: ok && r.net < 0 ? h : '0px', cor: ok && r.net < 0 ? 'var(--red-fill)' : 'var(--mint)' });
      leitor.push(WD3[i] + ', ' + (ok ? numS(r.net) : id > hoje ? 'ainda não aconteceu' : 'sem operações'));
    }
    const foraSem = [];
    stS.ids.forEach((id) => { const r = rec(id); if (ehDiario(r)) (r.foraLista || []).forEach((f) => foraSem.push(f)); });
    const rangeSem = rangeTxt(sem, fimSem);
    const sm = {
      titulo: emAndamento ? 'Semana em andamento · ' + pregoesAte + ' de ' + colsSem + ' pregões' : comOps ? rangeSem + ' · ' + pl(comOps, 'pregão com operações', 'pregões com operações') : rangeSem,
      info: 'Pregões de ' + rangeSem + '. ' + (K.lim ? 'Fora do plano: fora da janela ou depois do limite. ' : K.temJan ? 'Fora do plano: fora da janela. ' : '') + 'Revisões: dos pregões com operação registrada no app ou com revisão, quantos têm revisão; hoje só entra depois que você escrever a revisão dele. A coluna Semana do calendário traz os mesmos números.',
      cheia: stS.temD, vazia: !stS.temD,
      vaziaTxt: stS.temH ? 'Só Histórico importado nesta semana: ' + din(stS.hist, true) + ', à parte do diário.' : 'Nenhuma operação nesta semana.',
      numeros: [
        { rot: 'Resultado', val: din(stS.net, true), cor: corDe(stS.net) },
        { rot: 'Operações', val: String(stS.n), cor: 'var(--text)' },
        { rot: 'Fora do plano', val: stS.fora ? stS.fora + ' · ' + din(stS.foraNet, true) : 'nenhuma', cor: stS.fora ? 'var(--amber)' : 'var(--text)' },
        { rot: 'Revisões', val: contaS.length ? comRev + ' de ' + contaS.length : '—', cor: 'var(--text)' }
      ],
      barras, leitor: 'Resultado por dia: ' + leitor.join(' · ') + '.', fora: foraSem, temFora: !!foraSem.length, semFora: !foraSem.length
    };

    // ------------------------------------------------------------------ accounts, «Posso operar hoje?», infos
    const infAb = e.infos || {};
    const I = {};
    ['posso', 'cal', 'resumo', 'plano', 'ops', 'semana', 'grava', 'marcas'].forEach((k) => {
      I[k] = { aberto: !!infAb[k], alternar: () => set({ infos: Object.assign({}, infAb, { [k]: !infAb[k] }) }) };
    });
    const novoCenario = (v, manter) => {
      const vazio = {};
      CHAVES.forEach((k) => { vazio[k] = undefined; });
      this._rolarPara = D.cen[v].rolar || null;
      this._foco = manter ? 'conta' : null;
      set(Object.assign(vazio, { cen: v, tema: manter ? tema : undefined }));
    };
    if (this._cenVisto !== cenId) { this._cenVisto = cenId; if (this._rolarPara === undefined) this._rolarPara = C.rolar || null; }
    const rolarRef = (alvo) => (el) => { if (el && this._rolarPara === alvo) { this._rolarPara = null; setTimeout(() => el.scrollIntoView({ block: 'start' }), 0); } };
    // The accounts of this scenario's world (scenario 9b has 35); from 10 accounts the selector gets a search field and,
    // inside a market with more than one account, groups by firm («mesa»). The board's usual 8 accounts stay as before.
    const MERC = A.mercados || D.mercados;
    const nMundo = MERC.reduce((n, g) => n + g[1].length, 0);
    const muitas = nMundo >= 10;
    const norm = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const busca = muitas && e.contaAberta ? e.busca || '' : '';
    const q = norm(busca);
    const acha = (k) => !q || norm(D.contas[k].nome).indexOf(q) >= 0 || norm(D.contas[k].mesa).indexOf(q) >= 0;
    const opConta = (k) => ({
      nome: D.contas[k].nome, fase: D.contas[k].fase, sel: k === contaId,
      escolher: () => {
        if (k === contaId) { this._foco = 'conta'; set({ contaAberta: false, busca: null }); return; }
        const home = D.contas[k].home;
        // in the world of many accounts every choice stays in it (its «Posso operar hoje?» and sums are its own)
        if (home && !A.muitas) { novoCenario(home, true); return; }
        this._foco = 'conta';
        set({ conta: k, dia: A.contas[k].hoje, mes: null, sem: null, aberta: null, dlg: null, contaAberta: false, busca: null, revForm: null, revVer: null, antesEd: null, contaStatus: 'Conta ' + D.contas[k].nome + '.' });
      }
    });
    // each block is a group named by its headers (market, and firm when there is one), so a screen reader moving by Tab
    // hears «Futuros · 30 Apex · 9» on entering it; the headers keep their ids across the blocks of one market
    const gruposConta = [];
    let achadas = 0;
    MERC.forEach((g, i) => {
      const ks = g[1].filter(acha);
      if (!ks.length) return;
      achadas += ks.length;
      const rotMercado = muitas ? g[0] + ' · ' + ks.length : g[0];
      const idMercado = 'conta-g' + i;
      if (!muitas || g[1].length < 2) { gruposConta.push({ temMercado: true, mercado: rotMercado, idMercado, temMesa: false, mesa: '', idMesa: '', rotulos: idMercado, contas: ks.map(opConta) }); return; }
      const porMesa = [];
      ks.forEach((k) => { const nm = D.contas[k].mesa; let b = porMesa.find((x) => x.nm === nm); if (!b) { b = { nm, ks: [] }; porMesa.push(b); } b.ks.push(k); });
      porMesa.forEach((b, j) => {
        const idMesa = idMercado + '-m' + j;
        gruposConta.push({ temMercado: j === 0, mercado: rotMercado, idMercado, temMesa: true, mesa: b.nm + ' · ' + b.ks.length, idMesa, rotulos: idMercado + ' ' + idMesa, contas: b.ks.map(opConta) });
      });
    });
    // «Posso operar hoje?»: only the selected account, then ONE line for the others, with «Ver todas» opening their lines
    // exactly as the published list had them («somando as contas de Futuros» only on the selected account)
    const linhaPosso = (p, sel) => ({
      id: p.id, nome: p.nome, pal: p.pal, cls: 'tom-' + p.tom, temSub: !!p.sub, sub: p.sub || '', temAcao: !!p.acao, acao: p.acao || '', acaoAria: p.acaoAria || '',
      temLim: !!p.lim, limUsado: p.lim ? p.lim.usado : '', limDe: p.lim ? p.lim.de : '', temSoma: !!(sel && p.lim && D.contas[p.id] && D.contas[p.id].soma)
    });
    const possoSel = A.posso.filter((p) => p.id === contaId).map((p) => linhaPosso(p, true));
    const possoOutras = A.posso.filter((p) => p.id !== contaId).map((p) => linhaPosso(p, false));
    const ESTADOS = [
      [(p) => p.pal === 'Liberado' && p.cls === 'tom-mint', 'liberada', 'liberadas', 'tom-mint'],
      [(p) => p.pal === 'Liberado', 'liberada com aviso', 'liberadas com aviso', 'tom-neutral'],
      [(p) => p.pal === 'Encerrado por hoje', 'encerrada por hoje', 'encerradas por hoje', 'tom-red'],
      [(p) => p.pal === 'Fora da sua janela', 'fora da janela', 'fora da janela', 'tom-amber'],
      [(p) => p.pal === 'Sem janela salva', 'sem janela salva', 'sem janela salva', 'tom-muted'],
      [() => true, 'com outra resposta', 'com outra resposta', 'tom-muted']
    ];
    const nOutras = possoOutras.length;
    const contagem = ESTADOS.map((st) => ({ st, n: 0 }));
    possoOutras.forEach((p) => { contagem.find((c) => c.st[0](p)).n += 1; });
    const comEstado = contagem.filter((c) => c.n);
    // the «·» ends the part before it, so a wrapped line never starts with it
    const outrasPartes = comEstado.map((c, j) => ({
      temSep: j < comEstado.length - 1, cls: c.st[3],
      txt: nOutras === 1 ? c.st[1] : comEstado.length === 1 ? 'todas ' + c.st[2] : c.n + ' ' + (c.n === 1 ? c.st[1] : c.st[2])
    }));
    const outrasAbertas = !!e.outras && nOutras > 0;
    const infoCal = 'Cada pregão é pintado pelo resultado: verde ganho, vermelho perda, mais forte quanto maior (quartis do resultado diário, ganhos e perdas à parte). '
      + K.relogio + ' Traço (—): dia sem operações. Hachurado: Histórico importado, antes das suas regras, só com resultado, nunca somado ao diário e com uma escala de cor própria. Ponto verde: hoje. Borda branca: dia aberto. Tracejado: dia do mês vizinho. A coluna Semana soma só o diário; o histórico aparece à parte, com ▨. Toque numa semana para abri-la. Passe o mouse num dia para ver operações, ganhos e perdas. Pregões sem revisão de meses anteriores ficam no mês deles: use ‹.';

    // ------------------------------------------------------------------ Importações (scenario 13)
    const lotesS = e.lotes || {};
    const lotes = (D.lotes || []).map((l) => {
      const st = lotesS[l.id] || '';
      const partes = [l.novas + (l.novas === 1 ? ' nova' : ' novas')];
      if (l.reg) partes.push(l.reg === 1 ? '1 já registrada por você' : l.reg + ' já registradas por você');
      partes.push('0 já estavam', '0 com erro');
      // the built IMPORTACOES.confirm / undone / confirmYes (components/hub/contas/copy.ts), with no trade «que já estava»
      const apaga = (l.novas === 1 ? 'Desfazer apaga a operação desta importação' : 'Desfazer apaga as ' + l.novas + ' operações desta importação');
      const confirma = !l.novas
        ? (!l.reg ? 'Desfazer não apaga nada: as operações desta importação já foram apagadas.'
          : l.reg === 1 ? 'Desfazer não apaga nada: a operação registrada por você volta a ser como estava antes desta importação.'
            : 'Desfazer não apaga nada: as ' + l.reg + ' operações registradas por você voltam a ser como estavam antes desta importação.')
        : !l.reg ? apaga + '.' : l.reg === 1 ? apaga + ', e a registrada por você volta a ser como estava antes dela.' : apaga + ', e as ' + l.reg + ' registradas por você voltam a ser como estavam antes dela.';
      const apagadas = l.novas === 1 ? '1 operação apagada' : l.novas + ' operações apagadas';
      const desfeita = !l.reg ? (!l.novas ? 'Importação desfeita: nenhuma operação apagada.' : 'Importação desfeita: ' + apagadas + '.')
        : !l.novas ? (l.reg === 1 ? 'Importação desfeita: a operação registrada por você voltou a ser como estava.' : 'Importação desfeita: as ' + l.reg + ' operações registradas por você voltaram a ser como estavam.')
          : l.reg === 1 ? 'Importação desfeita: ' + apagadas + ', e a registrada por você voltou a ser como estava.' : 'Importação desfeita: ' + apagadas + ', e as ' + l.reg + ' registradas por você voltaram a ser como estavam.';
      const itens = [];
      if (l.marcas) itens.push(pl(l.marcas, 'marca', 'marcas'));
      if (l.imgs) itens.push(pl(l.imgs, 'imagem', 'imagens'));
      if (l.notas) itens.push(pl(l.notas, 'nota', 'notas'));
      return {
        quando: l.quando, nome: l.nome, partes, podeDesfazer: !st, confirmando: st === 'confirmando', desfeita: st === 'desfeita', desfeitaTxt: 'Desfeita em 1º dez',
        confId: 'desfazer-' + l.id, confirma, simRot: l.novas ? 'Desfazer e apagar' : 'Desfazer', temSaem: !!itens.length, saem: 'Saem junto: ' + listaE(itens) + ' que você pôs no Diário.',
        aria: 'Desfazer a importação de ' + l.quando, refDesfazer: foco('lote-' + l.id), refManter: foco('manter-' + l.id),
        desfazer: () => { this._foco = 'manter-' + l.id; set({ lotes: Object.assign({}, lotesS, { [l.id]: 'confirmando' }) }); },
        manter: () => { this._foco = 'lote-' + l.id; set({ lotes: Object.assign({}, lotesS, { [l.id]: '' }) }); },
        sim: () => set({ lotes: Object.assign({}, lotesS, { [l.id]: 'desfeita' }), impFeito: desfeita + ' (No protótipo, o Diário acima não muda.)' })
      };
    });

    const estado = e.estado;
    return {
      tema, claro: !escuro, escuro, alternarTema: () => set({ tema: escuro ? 'claro' : 'escuro' }),
      grupos: D.grupos, cenario: cenId, mudarCenario: (ev) => { const v = ev && ev.target ? ev.target.value : ''; if (D.cen[v]) novoCenario(v, false); },
      recomecar: () => novoCenario(cenId, false), classeCasca: C.celular ? 'celular' : '',
      linkAnalises: D.board === 'dez' ? 'AnalisesDezEnxuto.dc.html' : 'AnalisesHojeEnxuto.dc.html',
      dataLinha: AC.linha, contaNome: K.nome, contaJanela: K.janela, contaValores: K.valores, contaStatus: e.contaStatus || '',
      contaAberta: !!e.contaAberta, refConta: foco('conta'),
      alternarConta: () => { if (!e.contaAberta && muitas) this._foco = 'busca'; set({ contaAberta: !e.contaAberta, busca: null }); },
      fecharConta: () => { this._foco = 'conta'; set({ contaAberta: false, busca: null }); },
      teclaConta: (ev) => { if (e.contaAberta && ev && ev.key === 'Escape') { ev.preventDefault(); this._foco = 'conta'; set({ contaAberta: false, busca: null }); } },
      temBusca: muitas, busca, refBusca: foco('busca'), mudarBusca: (ev) => set({ busca: ev && ev.target ? ev.target.value : '' }),
      buscaStatus: q ? (achadas ? pl(achadas, 'conta encontrada', 'contas encontradas') + '.' : 'Nenhuma conta encontrada.') : '',
      semAchados: !!q && !achadas, semAchadosTxt: 'Nenhuma conta com “' + busca.trim() + '”.', classeBlocos: muitas ? 'conta-blocos conta-rolagem' : 'conta-blocos',
      saiuConta: (ev) => {
        const novo = ev && ev.relatedTarget;
        if (!e.contaAberta || !novo || (ev.currentTarget && ev.currentTarget.contains(novo))) return;
        set({ contaAberta: false, busca: null });
      },
      gruposConta, i: I,
      possoSel, possoOutras, temOutras: nOutras > 0, outrasTit: nOutras === 1 ? 'Outra conta:' : 'Outras ' + nOutras + ' contas:', outrasPartes,
      outrasAbertas, outrasBotao: outrasAbertas ? 'Ocultar' : nOutras === 1 ? 'Ver a outra conta' : 'Ver todas', alternarOutras: () => set({ outras: !outrasAbertas }),
      classePosso: muitas ? 'posso-corpo posso-largo' : 'posso-corpo',
      temLinhaTopo: !!linhaTopo && (estado === 'pronto' || estado === 'offline'), linhaTopo, semRegras: !K.regras,
      temAviso: estado !== 'carregando' && estado !== 'erro' && !e.avisoFechado && pend.length > 0, avisoTexto,
      verPendentes: () => { this._foco = 'cal'; set({ mes: pend[pend.length - 1].slice(0, 7) }); },
      fecharAviso: () => { this._foco = 'cal'; set({ avisoFechado: true }); },
      offline: estado === 'offline', carregando: estado === 'carregando', erro: estado === 'erro', pronto: estado === 'pronto' || estado === 'offline',
      tentarDeNovo: () => { this._foco = 'cal'; set({ estado: 'pronto' }); },
      refCal: foco('cal'), infoCal, mesTitulo: MES[mm - 1].charAt(0).toUpperCase() + MES[mm - 1].slice(1) + ' de ' + yy,
      mesStatus: 'Mês: ' + MES[mm - 1].charAt(0).toUpperCase() + MES[mm - 1].slice(1) + ' de ' + yy + '.',
      diaStatus: e.diaAnunciado === dia ? 'Aberto abaixo: ' + longo(dia) + '.' : '',
      semAnterior: iMes <= 0, semProximo: iMes >= mesesConta.length - 1, jaHoje: mes === hoje.slice(0, 7),
      mesAnterior: () => { if (iMes > 0) set({ mes: mesesConta[iMes - 1], focoCal: null }); },
      mesProximo: () => { if (iMes < mesesConta.length - 1) set({ mes: mesesConta[iMes + 1], focoCal: null }); },
      mesHoje: () => set({ mes: hoje.slice(0, 7), focoCal: null }),
      gradeClasse: sete ? 'sete' : '', cabCal: CAB.slice(0, cols), semanasCal, teclaCal, temLimiteConta: !!K.lim,
      refSecDia: rolarRef('dia'),
      refDia: (el) => { if (el && this._rolar) { this._rolar = false; if (el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ block: 'start' }); } },
      diaTitulo: R.t, diaTags: tags, temNotaDia: !!R.nota, notaDia: R.nota || '', rs: R.rs, infoResumo: R.info,
      diaComPlano: diario && K.regras, infoPlano, planoDia, versaoDia: R.versao || [],
      antesVer: !!antesV && !antesEd, antesTxt: antesV ? antesV.txt : '', antesNota: antesV ? antesV.nota : '', antesPodeEditar: ehHojeDia && !!antesV,
      antesNada: !antesV && !ehHojeDia, antesCampo, antesCancelavel: !!antesV,
      antesRasc: e.antesRasc != null ? e.antesRasc : antesV && antesEd ? antesV.txt : '', antesMudar: (ev) => set({ antesRasc: ev.target.value }),
      antesSalvar, antesEditar: () => { this._foco = 'antesCampo'; set({ antesEd: keyD, antesRasc: antesV ? antesV.txt : '' }); },
      antesCancelar: () => { this._foco = 'antesEditar'; set({ antesEd: null, antesRasc: null }); },
      refAntesEditar: foco('antesEditar'), refAntesCampo: foco('antesCampo'), antesStatus: e.antesStatus || '',
      anteriorTxt,
      trades, temOps: !semOps, semOps, semOpsHoje: semOps && ehHojeDia, semOpsTxt: ehHojeDia ? 'Nenhuma operação registrada hoje.' : 'Nenhuma operação neste dia.',
      temApag: !!R.apag, apagTxt: R.apag || '', temAbOntem: !!R.abOntem, abOntem: R.abOntem || { txt: '', link: '', dia: '' },
      abrirOntem: () => { if (R.abOntem) { const ro = rec(R.abOntem.dia); const ix = ro ? ro.trades.findIndex((x) => x.ab) : -1; this._rolar = true; set({ dia: R.abOntem.dia, mes: R.abOntem.dia.slice(0, 7), sem: null, aberta: ix >= 0 ? contaId + '-' + R.abOntem.dia + '-' + ix : null, diaAnunciado: R.abOntem.dia }); } },
      temRevisao, revFechada: temRevisao && !rvUlt0 && !formOn, revSalva: temRevisao && !!rvUlt0 && !formOn, revLinha,
      revVer: verOn, revTexto: !!rvUlt0 && verOn && !formOn, revBotao: verOn ? 'Esconder revisão' : 'Ver revisão', rvUlt: rvUlt0 ? comV(rvUlt0) : { reg: '', funcV: '', difV: '', seguiuV: '', levarV: '' },
      revMudou: !!(rvUlt0 && Rd && (rvUlt0.n !== R.n || rvUlt0.net !== R.net)), revMudouTxt: R.mudou || '',
      temVersoes: vsDia.length > 1, versoesAbertas: e.revVers === keyD, versoesBotao: (e.revVers === keyD ? 'Esconder versões anteriores' : 'Versões anteriores') + ' (' + (vsDia.length - 1) + ')',
      alternarVersoes: () => set({ revVers: e.revVers === keyD ? null : keyD }),
      versoes: vsDia.slice(0, -1).reverse().map((v) => Object.assign(comV(v), { titulo: 'Salva ' + quandoV(v, dia) })),
      alternarRev: () => set({ revVer: verOn ? null : keyD }),
      abrirRev: () => { this._foco = 'func'; set({ revForm: keyD, rasc: { func: '', dif: '', seguiu: '', levar: '' }, revErro: null }); },
      editarRev: () => { this._foco = 'func'; set({ revForm: keyD, rasc: { func: rvUlt0.func, dif: rvUlt0.dif, seguiu: rvUlt0.seguiu, levar: rvUlt0.levar }, revErro: null }); },
      cancelarRev: () => { this._foco = rvUlt0 ? 'editar' : 'escrever'; set({ revForm: null, rasc: null, revErro: null }); },
      salvarRev, revForm: temRevisao && formOn, rasc, fatosAgora: R.fatos || '',
      mudarFunc: (ev) => setRasc({ func: ev.target.value }), mudarDif: (ev) => setRasc({ dif: ev.target.value }), mudarLevar: (ev) => setRasc({ levar: ev.target.value }),
      seguiuOpcoes: ['Sim', 'Em parte', 'Não'].map((o) => ({ rot: o, sel: rasc.seguiu === o, escolher: () => setRasc({ seguiu: rasc.seguiu === o ? '' : o }) })),
      temRevErro: !!e.revErro, revErro: e.revErro || '', revStatus: e.revStatus || '',
      refEditar: foco('editar'), refRevFunc: foco('func'), refEscrever: foco('escrever'),
      sm, semStatus: e.semStatus || '',
      refSemana: (el) => {
        if (!el) return;
        if (this._rolarPara === 'semana') { this._rolarPara = null; setTimeout(() => el.scrollIntoView({ block: 'start' }), 0); return; }
        if (this._rolarSem) { this._rolarSem = false; if (el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ block: 'start' }); }
      },
      refRodape: rolarRef('rodape'),
      temImportacoes: !!C.importacoes, lotes, temImpFeito: !!e.impFeito, impFeito: e.impFeito || '', impStatus: e.impFeito || ''
    };
  }
}
