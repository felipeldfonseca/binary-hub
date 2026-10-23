# Builds one day record of the boards' data from invented trade specs (every figure computed)
from modelo import *

COM_PEND = 'ainda não chegou: o resultado está bruto até o arquivo da corretora.'


def gate_txt(c, dia, t, hit, modo):
    if c.lim and hit and hm_min(t['e']) > hm_min(hit):
        if modo == 'encerra':
            return 'Encerrado por hoje'
        if na_janela(c, dia, t['e']):
            return 'Liberado · com aviso do limite'
    jan = na_janela(c, dia, t['e'])
    if jan is None:
        return 'Sem janela salva'
    if not jan:
        if c.diasJan == 'util' and D(dia).weekday() >= 5:
            return 'Fora da sua janela · hoje não é dia da janela'
        return 'Fora da sua janela'
    return 'Liberado'


def marcas_de(t, conta=None):
    """Marks editor: {kind: {v, t}} with the built words («às 10:04 · antes da saída», «antes: B às 10:04 · agora: C às 11:20»)"""
    if t['src'] == 'hist':
        return None
    out = {}
    lim = t.get('primeira_saida')
    for k in ('setup', 'execucao', 'emocao'):
        m = (t.get('mk') or {}).get(k)
        if not m:
            out[k] = {'v': '', 't': ''}
            continue
        v, hm = m[0], m[1]
        chg = m[2] if len(m) > 2 else None
        outro_dia = m[3] if len(m) > 3 else None
        quando = outro_dia if outro_dia else f'às {hm}'
        antes = t['src'] == 'app' and not outro_dia and (lim is None or hm_min(hm) < hm_min(lim))
        fase = 'antes da saída' if antes else 'depois do resultado'
        if chg:
            out[k] = {'v': chg[0], 't': f'antes: {v} {quando} · agora: {chg[0]} às {chg[1]}'}
        else:
            out[k] = {'v': v, 't': f'{quando} · {fase}'}
    return out


def monta_dia(c, dia, specs, ctx):
    """ctx: arq (file date covering the day, or None), versao (lines), be (rule active), ext (other accounts' events,
    for «somando»), modo (limit action), antes, revs, apag, abOntem, hoje (bool), nota"""
    modo = ctx.get('modo', c.limModo)
    trs = []
    for i, s in enumerate(specs):
        s = dict(s)
        s['id'] = f'{c.id}-{dia}-{i}'
        if c.desde is None or dia < c.desde or (dia == c.desde and hm_min(s['e']) < hm_min(c.desdeHM)):
            s['src'] = 'hist'
        conhecida = s['src'] == 'hist' or ctx.get('arq') is not None or s.get('arqProprio') is not None
        t = calc_trade(c, s, conhecida)
        if 'x' in t and t['x']:
            t['primeira_saida'] = t['x'][0][2]
        elif 'bin' in t:
            t['primeira_saida'] = t['vela'][1] if not t['aberta'] else None
        trs.append(t)
    hist = [t for t in trs if t['src'] == 'hist']
    diario = [t for t in trs if t['src'] != 'hist']
    k = 'h' if not diario else ('m' if hist else 'd')
    eventos = [ev for t in trs for ev in t['eventos']]
    if c.soma:
        eventos += ctx.get('ext', [])
    pior, hit = limite_do_dia(eventos, c.lim) if (c.lim and k != 'h') else (0, None)
    perda_hit = None
    if hit:
        cum = 0
        for hm, v, _ in sorted(eventos, key=lambda x: (hm_min(x[0]), x[2])):
            cum += v
            if hm == hit and -cum >= c.lim:
                perda_hit = -cum
                break
    for t in diario:
        q = []
        jan = na_janela(c, dia, t['e'])
        if jan is False:
            q.append('fora da janela')
        if c.lim and hit and hm_min(t['e']) > hm_min(hit):
            q.append('depois do limite')
        t['quebras'] = q
        t['gate'] = gate_txt(c, dia, t, hit, modo)
    for t in hist:
        t['quebras'] = []
    fech = [t for t in diario if not t['aberta']]
    net = sum(t['net'] for t in fech)
    bruto = sum(t['bruto'] for t in fech)
    com = sum(t['com'] for t in fech) + sum(t['com'] for t in diario if t['aberta'])
    net += sum(t['net'] for t in diario if t['aberta'] and t['net'] is not None)
    bruto += sum(t['bruto'] for t in diario if t['aberta'] and t['bruto'] is not None)
    g = sum(1 for t in fech if t['net'] > 0)
    p = sum(1 for t in fech if t['net'] < 0)
    z = sum(1 for t in fech if t['net'] == 0)
    ab = sum(1 for t in diario if t['aberta'])
    fora = [t for t in diario if t['quebras']]
    fora_net = sum(t['net'] for t in fora if not t['aberta'])
    app = any(t['src'] in ('app', 'fechada') for t in diario)
    sem_com = c.comissao and any(t['src'] in ('app', 'fechada') and t['com'] == 0 and t.get('q_saida') for t in diario) and ctx.get('arq') is None
    hist_net = sum(t['net'] for t in hist)
    hist_bruto = sum(t['bruto'] for t in hist)
    hist_com = sum(t['com'] for t in hist)
    m = c.moeda
    R = {'t': longo(dia), 'c': curto(dia), 'k': k, 'id': dia}

    # ---------------------------------------------------------------- tiles
    if k == 'h':
        R['rs'] = {
            'res': money(hist_net, m, True), 'resCor': cor(hist_net),
            'ops': str(len(hist)), 'opsSub': ops_sub(hist, c),
            'lim': '—', 'limSub': 'o limite ainda não existia', 'temBarra': False, 'bar': '0%', 'barCor': 'var(--amber)',
            'fora': '—', 'foraSub': 'sem plano', 'foraCor': 'var(--text-2)'}
        R.update(net=hist_net, n=len(hist), g=sum(1 for t in hist if t['net'] > 0), p=sum(1 for t in hist if t['net'] < 0),
                 z=sum(1 for t in hist if t['net'] == 0), ab=0, fora=0, hit=None, app=False)
    else:
        if c.lim:
            frac = min(100, round(pior * 100 / c.lim))
            lim_val = f'{money(pior, m)} de {compacto(c.lim, m)}' if pior else 'nenhuma perda acumulada'
            sub = 'pior momento' + (f' · atingido às {hit}' if hit else '') + (' · somando as contas de Futuros' if c.soma else '')
            R_lim = dict(lim=lim_val, limSub=sub, temBarra=pior > 0, bar=f'{frac}%', barCor='var(--red-fill)' if hit else 'var(--amber)')
        else:
            R_lim = dict(lim='sem limite', limSub='nas suas regras', temBarra=False, bar='0%', barCor='var(--amber)')
        if fora:
            fo_ab = [t for t in fora if t['aberta']]
            fora_val = plural(len(fora), 'operação', 'operações') + (f' · {money(fora_net, m, True)}' if len(fo_ab) < len(fora) else ' · aberta')
            fora_cor = 'var(--amber)'
        else:
            fora_val, fora_cor = 'nenhuma', 'var(--text)'
        ops_val = str(len(diario)) + (f' · {ab} aberta' if ab == 1 else f' · {ab} abertas' if ab else '')
        R['rs'] = dict(res=money(net, m, True), resCor=cor(net), ops=ops_val, opsSub=ops_sub(fech, c), fora=fora_val, foraSub='', foraCor=fora_cor, **R_lim)
        R.update(net=net, n=len(diario), g=g, p=p, z=z, ab=ab, fora=len(fora), hit=hit, app=app, foraNet=fora_net)
        if k == 'm':
            R['hist'] = {'n': len(hist), 'net': hist_net}

    # ---------------------------------------------------------------- «Como ler os números do dia»
    info = []
    if k == 'h':
        info.append('Antes da primeira versão das suas regras não há janela, limite nem plano: só o que o arquivo da corretora trouxe.')
        if c.comissao and hist_com:
            info.append(f'Resultado líquido. Bruto {money(hist_bruto, m, True)} · comissões {money(-hist_com, m)}.')
    else:
        if c.comissao and diario:
            if sem_com:
                info.append('A comissão ainda não chegou: o resultado está bruto até o arquivo da corretora.')
            elif com:
                info.append(f'Resultado líquido. Bruto {money(bruto, m, True)} · comissões {money(-com, m)}.')
        if c.lim:
            s = (f'Limite do dia: a maior perda acumulada no pregão, no pior momento' + (', já com a comissão quando o arquivo a trouxe' if c.comissao else '') +
                 f', contra o seu limite de {compacto(c.lim, m)}' + (', somando as contas de Futuros' if c.soma else '') + '. ' +
                 ('Pelas suas regras, ao atingir o limite o app encerra o dia.' if modo == 'encerra' else 'Pelas suas regras, ao atingir o limite o app só avisa.'))
            if c.soma:
                s += ' Com “somando as contas de Futuros”, o pior momento inclui as operações deste dia nas suas outras contas de Futuros que não estão arquivadas. Se você arquivar uma delas, ela sai da soma, também nos dias passados.'
            info.append(s)
        else:
            info.append('Limite do dia: esta conta não tem limite nas suas regras.')
        if c.jan or c.lim:
            s = 'Fora do plano: operações fora da janela ou depois do limite.' if c.lim else 'Fora do plano: operações fora da janela.'
            outras = [t for t in fech if not t['quebras']]
            if fora and outras:
                s += f' As outras {len(outras)} somaram {money(sum(t["net"] for t in outras), m, True)}: conta simples, não é o que teria acontecido.'
            info.append(s)
        if k == 'm':
            info.append(f'+ {plural(len(hist), "operação", "operações")} do histórico, à parte: {money(hist_net, m, True)}; o limite do dia contou essa também.')
    R['info'] = ' '.join(info)

    # ---------------------------------------------------------------- «O plano do dia»
    if k != 'h':
        rows = []
        if c.jan:
            dentro = sum(1 for t in diario if na_janela(c, dia, t['e']))
            rows.append(dict(item='Janela', plano=c.janPlano, fato=f'{dentro} de {len(diario)} dentro' if diario else 'nenhuma operação ainda',
                             marca=('No plano' if dentro == len(diario) else 'Fora do plano') if diario else '', tipo='ok' if dentro == len(diario) else 'fora'))
        else:
            rows.append(dict(item='Janela', plano='Sem janela salva', fato='', marca='Sem regra', tipo='neutro', link='Definir em Personalizar'))
        if c.lim:
            plano_lim = f'{compacto(c.lim, m)} · {"encerra o dia" if modo == "encerra" else "só avisa"}' + (' · somando as contas de Futuros' if c.soma else '')
            depois = [t for t in diario if 'depois do limite' in t['quebras']]
            if hit:
                fato = f'atingido às {hit}, com {money(perda_hit, m)} de perda'
                if depois:
                    d0 = [t for t in depois if not t['aberta']]
                    fato += f' · {len(depois)} depois, às {lista_e([t["e"] for t in depois])}' + (f': {money(sum(t["net"] for t in d0), m, True)}' if d0 else '')
            else:
                fato = f'pior momento: {compacto(pior, m)}' if pior else ('nenhuma perda acumulada' if diario else 'nenhuma operação ainda')
            rows.append(dict(item='Limite', plano=plano_lim, fato=fato, marca=('Fora do plano' if depois else 'No plano') if diario else '', tipo='fora' if depois else 'ok'))
        else:
            rows.append(dict(item='Limite', plano='sem limite', fato='', marca='Sem regra', tipo='neutro'))
        if ctx.get('be') and c.beN:
            mm, kk = 0, 0
            for t in diario:
                n_be = c.beN.get(t.get('a'))
                if not n_be or not t.get('stop'):
                    continue
                fav = max([(Dec(px) - Dec(t['pe'])) * SGN[t['l']] for (_q, px, _h, _k) in t['x']] + [Dec(mv[3]) for mv in t.get('movs', [])] + [Dec(-999)])
                if fav >= n_be:
                    mm += 1
                    if any(mv[1] == 'be' for mv in t.get('movs', [])):
                        kk += 1
            rows.append(dict(item='Breakeven', plano=c.be, fato=f'moveu em {kk} de {mm}' if mm else 'nenhuma chegou ao ponto da regra', marca='Registrado', tipo='neutro'))
        R['plano'] = rows
        R['versao'] = ctx.get('versao', [])
    else:
        R['plano'] = None
        R['versao'] = []

    # ---------------------------------------------------------------- trades
    R['trades'] = [linha(c, dia, t, hit, modo, ctx) for t in trs]
    R['apag'] = ctx.get('apag')
    R['abOntem'] = ctx.get('abOntem')
    R['pe'] = min([t['e'] for t in diario], key=hm_min) if diario else None
    lst = []
    for t in fora:
        lst.append(f'{WD3[D(dia).weekday()]} {D(dia).day} · {t["e"]} · {LADO[t["l"]] if "bin" not in t else LADO[t["bin"]["dir"]]} {t.get("a") or t["bin"]["par"]} · {" · ".join(t["quebras"])}' +
                   (f' · {money(t["net"], m, True)}' if not t['aberta'] else ' · aberta'))
    R['foraLista'] = lst

    # ---------------------------------------------------------------- calendar cell
    nn = R['n']
    rv = R['net']
    pl_v = 'reais' if m == 'R$' else 'dólares'
    R['res'] = numtxt(rv)
    R['resCurto'] = numcurto(rv)
    base_op = f'{nn} op.'
    gg, pp, zz = R['g'], R['p'], R['z']
    if 'bin' in (trs[0] if trs else {}):
        dv = sum(1 for t in fech if t['net'] == 0)
        det = ', '.join([plural(gg, 'ganho', 'ganhos'), plural(pp, 'perda', 'perdas')] + ([plural(dv, 'devolvida', 'devolvidas')] if dv else []))
    else:
        det = ', '.join([plural(gg, 'ganho', 'ganhos'), plural(pp, 'perda', 'perdas')] + ([f'{zz} no zero a zero'] if zz else []))
    if k == 'h':
        R['dica'] = f'{curto(dia)} · {money(rv, m, True)} · {base_op}: {det} · Histórico importado · só resultado'
        R['aria'] = f'{curto(dia)}, {numtxt(rv)} {pl_v}, {base_op}, Histórico importado'
    else:
        ex = []
        if ab:
            ex.append(f'{ab} aberta' if ab == 1 else f'{ab} abertas')
        if fora:
            ex.append(f'{len(fora)} fora do plano')
        if hit:
            ex.append(f'limite atingido às {hit}')
        if k == 'm':
            ex.append(f'+ {len(hist)} do histórico, à parte')
        R['dica'] = f'{curto(dia)} · {money(rv, m, True)} · {base_op}: {det}' + ''.join(' · ' + x for x in ex)
        R['aria'] = f'{curto(dia)}, {numtxt(rv)} {pl_v}, {base_op}' + (', com operação fora do plano' if fora else '') + (', limite atingido' if hit else '') + (', com histórico importado à parte' if k == 'm' else '')

    # ---------------------------------------------------------------- notes, tags, plan notes, reviews
    tags = []
    if hit:
        tags.append(f'Limite atingido às {hit}')
    if k == 'h':
        tags.append(f'Histórico importado · {curto(ctx["impHist"])}')
    R['tags'] = tags
    if k == 'h':
        R['nota'] = 'Antes das suas regras: sem plano, só o que o arquivo trouxe.'
    elif k == 'm':
        R['nota'] = f'Suas regras começaram às {c.desdeHM}: {"a operação das " + hist[0]["e"] + " fica" if len(hist) == 1 else "as operações de antes ficam"} em Histórico importado · só resultado, à parte do dia.'
    else:
        R['nota'] = ''
    R['antes'] = ctx.get('antes')
    R['fatos'] = fatos_txt(c, diario, net, pior, hit) if k != 'h' else ''
    R['mudou'] = f'Depois da revisão, o dia mudou: agora {plural(len(diario), "operação", "operações")}, {money(net, m, True)}.' if k != 'h' else ''
    R['rev'] = ctx.get('revs', [])
    R['_trs'] = trs
    R['_pior'] = pior
    return R


def cor(v):
    return 'var(--mint)' if v > 0 else 'var(--red)' if v < 0 else 'var(--text)'


def ops_sub(fech, c):
    fech = [t for t in fech if not t['aberta']]
    g = sum(1 for t in fech if t['net'] > 0)
    p = sum(1 for t in fech if t['net'] < 0)
    z = sum(1 for t in fech if t['net'] == 0)
    if c.mk == 'bin':
        return ', '.join([plural(g, 'ganho', 'ganhos'), plural(p, 'perda', 'perdas')] + ([plural(z, 'devolvida', 'devolvidas')] if z else [])) if fech else ''
    if not fech:
        return ''
    return ', '.join([plural(g, 'ganho', 'ganhos'), plural(p, 'perda', 'perdas')] + ([f'{z} no zero a zero'] if z else []))


def linha(c, dia, t, hit, modo, ctx):
    m = c.moeda
    o = {'id': t['id'], 'he': t['e']}
    binario = 'bin' in t
    if binario:
        b = t['bin']
        ini, fim = t['vela']
        o['h'] = t['e'] if t['aberta'] else f'{t["e"]}–{fim}'
        o['op'] = f'{b["par"]} · {LADO[b["dir"]]} · {b["exp"]} min'
        lado, ativo = LADO[b['dir']], b['par']
    else:
        o['h'] = t['e'] if t['aberta'] else f'{t["e"]}–{t["saida_hm"]}'
        o['op'] = f'{t["a"]} · {LADO[t["l"]]} · {qtd_txt(t["a"], t["q"])}'
        lado, ativo = LADO[t['l']], t['a']
    sub = None
    if binario:
        if t['aberta']:
            sub = f'Vence às {t["vela"][1]} de Brasília.'
        elif t['net'] == 0:
            sub = 'devolvida'
    else:
        parc = [x for x in t['x'] if x[3] == 'parcial']
        if t['aberta'] and parc:
            pg = sum(cents((Dec(px) - Dec(t['pe'])) * SGN[t['l']] * Dec(q) * SPEC[t['a']]['mult']) for (q, px, _h, _k) in parc)
            sub = f'{plural(len(parc), "parcial", "parciais").replace("1 parcial", "1 parcial")}, {money(pg, m, True)}'
            if any(mv[1] == 'be' for mv in t.get('movs', [])):
                sub += ' · stop no breakeven'
            elif t.get('movs'):
                sub += ' · stop movido'
        elif not t['aberta'] and len(t['x']) > 1:
            sub = f'em {len(t["x"])} saídas'
    o['sub'] = sub
    o['chip'] = {'fechada': 'Registrada depois', 'arq': 'Do arquivo', 'antiga': 'Página antiga'}.get(t['src'])
    o['ab'] = t['aberta']
    o['res'] = None if t['aberta'] else money(t['net'], m, True if t['net'] else False)
    o['cor'] = 'var(--text-2)' if t['aberta'] else cor(t['net'])
    if t['src'] == 'hist':
        o['pl'], o['plTxt'], o['plAria'] = 'hist', 'Histórico importado · só resultado', 'Histórico importado, só resultado'
    elif t['quebras']:
        o['pl'], o['plTxt'], o['plAria'] = 'fora', '● ' + ' · '.join(t['quebras']), 'fora do plano: ' + ' e '.join(t['quebras'])
    elif c.jan or c.lim:
        o['pl'], o['plTxt'], o['plAria'] = 'ok', 'No plano', 'no plano'
    else:
        o['pl'], o['plTxt'], o['plAria'] = 'nada', '—', 'plano não avaliado'
    if t['aberta'] and t['src'] in ('app', 'fechada'):
        o['acao'] = 'Registrar resultado' if binario else 'Registrar saída'
        o['acaoAria'] = f'{o["acao"]}: {lado} de {ativo} às {t["e"]}'
    else:
        o['acao'] = None
        o['acaoAria'] = ''
    o['rot'] = f'Detalhes da operação: {lado} de {ativo} às {t["e"]}'
    ax = t.get('ax')
    if ax:
        n_img = len(ax.get('imgs', []))
        nota = bool(ax.get('nota'))
        o['clip'] = 'tem imagens e nota' if n_img and nota else 'tem imagens' if n_img else 'tem nota'
        quem = (f'{plural(n_img, "imagem", "imagens")} e nota salvas' if n_img and nota else plural(n_img, 'imagem salva', 'imagens salvas') if n_img else 'Nota salva')
        verbo = 'salvas' if (n_img and nota) or n_img > 1 else 'salva'
        o['ax'] = {'imgs': [{'nome': a, 'tam': b, 'f': k} for (a, b, k) in ax.get('imgs', [])], 'nota': ax.get('nota', ''),
                   'quando': f'{verbo} {ax["quando"]} · {ax.get("fase", "depois do resultado")}' if n_img or nota else '', 'quem': quem}
    else:
        o['clip'] = None
        o['ax'] = None
    o['axOk'] = t['src'] != 'hist'

    # facts
    F = []
    L = []
    if binario:
        b = t['bin']
        ini, fim = t['vela']
        F.append(['Hora', f'{t["e"]} · vela {ini}–{fim} de Brasília'])
        F.append(['Stake · payout', f'{compacto(cents(b["stake"]), m)} · payout {b["payout"]}%'])
        F.append(['Como terminou?', {'ganho': 'Ganho', 'perda': 'Perda', 'devolvida': 'Devolvida', None: 'ainda não venceu'}[b['res']]])
        if not t['aberta']:
            F.append(['Resultado', money(t['net'], m, bool(t['net']))])
        if t['aberta']:
            L.append(f'Vence às {fim} de Brasília.')
    else:
        s = SPEC[t['a']]
        reg = t.get('regTipo')
        hora = o['h'] + (' · aberta' if t['aberta'] else '')
        if t.get('regEm') and t['src'] == 'app' and abs(hm_min(t['regEm']) - hm_min(t['e'])) >= 1:
            hora += f' · registrada às {t["regEm"]}'
        F.append(['Hora', hora])
        if t['src'] == 'hist':
            pts = sum((Dec(px) - Dec(t['pe'])) * SGN[t['l']] * Dec(q) for (q, px, _h, _k) in t['x']) / Dec(t['q'])
            F.append(['Pontos', dif_txt(t['a'], pts)])
        elif len(t['x']) > 1 or t['aberta']:
            F.append(['Entrada', f'{preco(t["a"], t["pe"])} · {qtd_txt(t["a"], t["q"])}'])
            if t['x']:
                qs = sum(Dec(q) for (q, _p, _h, _k) in t['x'])
                med = sum(Dec(q) * Dec(px) for (q, px, _h, _k) in t['x']) / qs
                if t['aberta']:
                    resto = Dec(t['q']) - qs
                    F.append(['Em aberto', qtd_txt(t['a'], str(int(resto)) if s['tipo'] != 'cri' else str(resto))])
                else:
                    F.append(['Saída média', f'{preco(t["a"], med)} · em {len(t["x"])} saídas'])
            else:
                F.append(['Em aberto', qtd_txt(t['a'], t['q'])])
        else:
            q, px, _h, _k = t['x'][0]
            F.append(['Entrada → saída', f'{preco(t["a"], t["pe"])} → {preco(t["a"], px)} · {dif_txt(t["a"], (Dec(px) - Dec(t["pe"])) * SGN[t["l"]])}'])
        if t['src'] != 'hist':
            if t.get('stop'):
                st = f'stop {dec_curto(t["stop"])}' + (f' · alvo {dec_curto(t["alvo"])}' if t.get('alvo') else '') + f' pts · às {t.get("stopEm", t["e"])}'
                if t['src'] == 'fechada':
                    st = f'stop {dec_curto(t["stop"])}' + (f' · alvo {dec_curto(t["alvo"])}' if t.get('alvo') else '') + ' pts · registrado depois'
            else:
                st = 'não anotados'
            F.append(['Stop · alvo', st])
            if t.get('stop') and t['x'] and not t['aberta']:
                rr = sum(Dec(q) * (Dec(px) - Dec(t['pe'])) * SGN[t['l']] for (q, px, _h, _k) in t['x']) / (Dec(t['q']) * Dec(t['stop']))
                F.append(['R', f'{dec_curto(rr.quantize(Dec("0.1"), ROUND_HALF_UP), True)} R · com stop de {dec_curto(t["stop"])} pts'])
        if t['x']:
            if t['com']:
                F.append(['Resultado', money(t['net'], m, True) + f' · bruto {money(t["bruto"], m, True)}' + (' · até aqui' if t['aberta'] else '')])
            else:
                F.append(['Resultado', money(t['net'], m, True) + (' · até aqui' if t['aberta'] else '')])
        if c.comissao and t['x']:
            F.append(['Comissão', money(t['com'], m) if t['com'] else COM_PEND])
    if t['src'] != 'hist':
        F.append(['Posso operar hoje?', t['gate']])
    # lines
    if t['src'] == 'fechada':
        L.append(f'Registrada às {t["regEm"]}, depois do resultado: as marcas contam como depois do resultado.')
    if t['src'] == 'arq':
        L.append('Sem registro no app: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.')
    if t['src'] == 'antiga':
        L.append('Lançada na página antiga: o “Posso operar hoje?” desta operação foi recalculado pelas regras do dia.')
    if t['src'] == 'hist':
        L.append('Antes das suas regras: só o que o arquivo trouxe, sem plano, marcas, imagens nem nota.')
    if t['src'] in ('app', 'fechada') and t['com'] and ctx.get('arq'):
        L.append(f'Completada pelo arquivo de {curto(ctx["arq"])}: comissão {money(t["com"], m)}.')
    if t.get('corr'):
        L.append(f'O arquivo corrigiu o preço de {t["corr"][0]}: {t["corr"][1]} → {t["corr"][2]}.')
    if t.get('corretora'):
        L.append(f'Na corretora: {t["corretora"]}.')
    if t['src'] != 'hist' and 'depois do limite' in t['quebras']:
        if modo == 'encerra':
            L.append(f'Na entrada, o “Posso operar hoje?” dizia “Encerrado por hoje” desde {hit}: as operações anteriores já estavam registradas.')
        else:
            L.append(f'Na entrada, o “Posso operar hoje?” avisava do limite desde {hit}: pelas suas regras, é só um aviso.')
    o['fatos'] = F
    o['linhas'] = L
    # «Linha do tempo da operação»
    tempo = None
    be = None
    if not binario and t['src'] != 'hist' and (len(t['x']) > 1 or t.get('movs') or (t['aberta'] and t['x'])):
        s = SPEC[t['a']]
        itens = [(hm_min(t['e']), 0, t['e'], f'Entrada · {qtd_txt(t["a"], t["q"])} a {preco(t["a"], t["pe"])}' + (f' · stop {dec_curto(t["stop"])} pts' if t.get('stop') else ''), '')]
        fech_n = len(t['x'])
        for j, (q, px, hm, kind) in enumerate(t['x']):
            d = (Dec(px) - Dec(t['pe'])) * SGN[t['l']]
            din = money(cents(d * Dec(q) * s['mult']), m, True)
            if t['src'] == 'fechada' and fech_n > 1:
                txt = f'{j + 1}ª saída · {qtd_txt(t["a"], q)} a {preco(t["a"], px)} · {dif_txt(t["a"], d)} · {din}'
            else:
                txt = f'{"Parcial" if kind == "parcial" else "Saída"} · {qtd_txt(t["a"], q)} a {preco(t["a"], px)} · {dif_txt(t["a"], d)} · {din}'
            itens.append((hm_min(hm), 1, hm, txt, t.get('parcRegs', {}).get(j, '')))
        for mv in t.get('movs', []):
            hm, kind, px, fav = mv
            favt = f'com {dec(fav, 2, True)} pts a favor'
            if t['src'] == 'fechada':
                txt = f'Stop no breakeven · {favt} · registrado depois' if kind == 'be' else f'Stop movido · {favt} · registrado depois'
            else:
                txt = f'Stop no breakeven · {preco(t["a"], px)} · {favt}' if kind == 'be' else f'Stop movido · {preco(t["a"], px)} · {favt}'
            itens.append((hm_min(hm), 2, hm, txt, ''))
        itens.sort(key=lambda x: (x[0], x[1]))
        tempo = [{'h': x[2] if t['src'] != 'fechada' or x[1] != 2 else 'sem hora', 'txt': x[3], 'sub': x[4]} for x in itens]
        n_be = (c.beN or {}).get(t['a']) if ctx.get('be') else None
        if n_be and t.get('stop'):
            bes = [mv for mv in t.get('movs', []) if mv[1] == 'be']
            if bes:
                mv = bes[0]
                if t['src'] == 'fechada':
                    be = f'Breakeven com {dec(mv[3], 2, True)} pts a favor, registrado depois · sua regra: +{n_be} pts.'
                else:
                    be = f'Breakeven às {mv[0]}, com {dec(mv[3], 2, True)} pts a favor · sua regra: +{n_be} pts.'
            else:
                be = f'Breakeven: o stop não foi movido · sua regra: +{n_be} pts.'
    elif not binario and t['src'] in ('app', 'fechada') and ctx.get('be') and (c.beN or {}).get(t.get('a')) and t.get('stop') and not t['aberta']:
        be = f'Breakeven: o stop não foi movido · sua regra: +{c.beN[t["a"]]} pts.'
    o['tempo'] = tempo
    o['be'] = be
    if t['src'] == 'app' and t.get('x') and len(t['x']) > 1:
        o['linhas'].append(f'Marcas feitas a partir das {t["x"][0][2]} (sua primeira parcial) contam como depois do resultado.')
    o['mk'] = marcas_de(t, c)
    return o
