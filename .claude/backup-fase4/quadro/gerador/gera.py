# Assembles the boards' data object (accounts, days, clocks, scenarios) and writes the two boards
import json
import sys
from dados import *

UTC = dt.timezone.utc


def ag_utc(clock, s):
    d = dt.datetime.fromisoformat(s)
    off = 5 if clock == 'ET' else 3
    return (d + dt.timedelta(hours=off)).replace(tzinfo=UTC)


def local(c, u):
    off = 5 if c.rel == 'ET' else 3
    return (u - dt.timedelta(hours=off)).replace(tzinfo=None)


def dia_pregao(c, u):
    l = local(c, u)
    d = l.date()
    if c.giro and l.hour * 60 + l.minute >= c.giro:
        d += dt.timedelta(days=1)
    return d.isoformat()


def hhmm(m):
    return f'{m // 60:02d}:{m % 60:02d}'


def posso(c, u, rec):
    l = local(c, u)
    m_ = l.hour * 60 + l.minute
    if c.desde is None:
        return {'id': c.id, 'nome': c.nome, 'pal': 'Sem janela salva', 'tom': 'muted', 'sub': None, 'acao': 'Definir', 'acaoAria': f'Definir a janela da {c.nome} em Personalizar', 'lim': None}
    lim = None
    pior, hit = (rec['_pior'], rec['hit']) if rec else (0, None)
    if c.lim:
        lim = {'usado': compacto(pior, c.moeda), 'de': f'de {compacto(c.lim, c.moeda)}'}
    base = {'id': c.id, 'nome': c.nome, 'lim': lim, 'acao': None, 'acaoAria': ''}
    if hit and c.limModo == 'encerra':
        return dict(base, pal='Encerrado por hoje', tom='red', sub=f'limite atingido às {hit}')
    if not c.jan:
        return dict(base, pal='Sem janela salva', tom='muted', sub=None, acao='Definir', acaoAria=f'Definir a janela da {c.nome} em Personalizar')
    wd = l.weekday()
    ok = c.diasJan == 'todos' or wd < 5
    if ok and c.jan[0] <= m_ < c.jan[1]:
        return dict(base, pal='Liberado', tom='mint', sub=f'até {hhmm(c.jan[1])}{c.suf}')
    if ok and m_ < c.jan[0]:
        return dict(base, pal='Fora da sua janela', tom='amber', sub=f'abre às {hhmm(c.jan[0])}{c.suf}')
    k = 1
    while True:
        nd = (l.date() + dt.timedelta(days=k))
        if c.diasJan == 'todos' or nd.weekday() < 5:
            break
        k += 1
    quando = 'amanhã ' if k == 1 else f'{WD3[nd.weekday()]} '
    return dict(base, pal='Fora da sua janela', tom='amber', sub=f'abre {quando}às {hhmm(c.jan[0])}{c.suf}')


def quartis(arr):
    arr = sorted(arr)
    if not arr:
        return None
    n = len(arr)
    return [arr[int(round(k * (n - 1) / 4))] for k in (1, 2, 3)]


def niveis(recs):
    out = {}
    for grupo in (['d', 'm'], ['h']):
        g = [r for r in recs if r['k'] in grupo]
        pos = quartis([r['net'] for r in g if r['net'] > 0])
        neg = quartis([-r['net'] for r in g if r['net'] < 0])
        for r in g:
            v = r['net']
            if v == 0:
                out[r['id']] = 0
                continue
            q = pos if v > 0 else neg
            a = abs(v)
            out[r['id']] = 1 if a <= q[0] else 2 if a <= q[1] else 3 if a <= q[2] else 4
    return out


KEEP = ('h', 'op', 'sub', 'chip', 'ab', 'res', 'pl', 'q', 'acao', 'acaoAria', 'clip', 'ax', 'fatos', 'linhas', 'tempo', 'be', 'mk')


def limpa_trade(t):
    t = dict(t)
    t['q'] = t['plTxt'][2:].split(' · ') if t['pl'] == 'fora' else []
    if t.get('mk'):
        t['mk'] = {k: v for k, v in t['mk'].items() if v.get('v')}
    out = {}
    for k in KEEP:
        v = t.get(k)
        if v in (None, '', [], False) and k not in ('pl', 'mk'):
            continue
        out[k] = v
    return out


def limpa(rec):
    r = {k: v for k, v in rec.items() if not k.startswith('_') and k not in ('id', 'c')}
    r['trades'] = [limpa_trade(t) for t in rec['trades']]
    return r


def monta():
    top, specs_top, hoje12, var19 = top_one()
    datasets = {'top': top, 'lucid': lucid(top, specs_top), 'ylos': ylos(), 'ebx': ebinex(), 'ftmo': {}, 'ibkr': {}, 'bin': binance(), 'clear': clear()}
    # scenario 9b: the invented prop accounts (only 1º dez) and Lucid 50k's 1º dez summing all 30 futures accounts
    dias_mesas, lucid_muitas = mesas(top)
    datasets.update(dias_mesas)
    # previous journal day (for «Do pregão anterior»)
    for k, dias in datasets.items():
        ant = None
        for d in sorted(dias):
            r = dias[d]
            if r['k'] != 'h':
                r['ant'] = ant
                ant = d
            else:
                r['ant'] = None
    hoje12['ant'] = top['2026-11-12']['ant']
    lucid_muitas['ant'] = datasets['lucid']['2026-12-01']['ant']
    var19['ant'] = top['2026-11-19']['ant']
    AGS = {
        'a1dez': ag_utc('ET', '2026-12-01T11:35'),
        'a12nov': ag_utc('ET', '2026-11-12T10:42'),
        'a11nov': ag_utc('BRT', '2026-11-11T21:20'),
        'a14nov': ag_utc('BRT', '2026-11-14T21:40'),
        'a12b3': ag_utc('BRT', '2026-11-12T11:20'),
        'a1dezM': ag_utc('ET', '2026-12-01T11:35'),
    }
    OVER = {'a12nov': {'top': hoje12}, 'a1dezM': {'lucid': lucid_muitas}}
    ags = {}
    for a, u in AGS.items():
        A = {'contas': {}, 'posso': [], 'nv': {}, 'over': {}}
        muitas = a == 'a1dezM'
        if muitas:
            A['muitas'] = True
            A['mercados'] = MERCADOS_MUITAS
        for k in (ORDEM_MUITAS if muitas else ORDEM):
            c = CONTAS[k]
            l = local(c, u)
            hoje = dia_pregao(c, u)
            ov = OVER.get(a, {}).get(k)
            rec = ov or datasets[k].get(hoje)
            A['contas'][k] = {
                'hoje': hoje, 'ontem': (D(hoje) - dt.timedelta(days=1)).isoformat(), 'hm': l.strftime('%H:%M'),
                'iso': l.strftime('%Y-%m-%dT%H:%M'), 'linha': f'{longo(l.date(), False)}, {l.strftime("%H:%M")}{c.suf}',
                'hojeCurto': curto(hoje)}
            A['posso'].append(posso(c, u, rec))
            recs = [r for d, r in datasets[k].items() if d < hoje] + ([rec] if rec else [])
            A['nv'][k] = niveis(recs)
            if ov:
                A['over'][k] = limpa(ov)
        ags[a] = A
    dias_json = {k: {d: limpa(r) for d, r in v.items()} for k, v in datasets.items()}
    meses = {}
    for k, v in datasets.items():
        if not v:
            meses[k] = []
            continue
        ini, fim = min(v)[:7], max(v)[:7]
        ms = []
        y, m = map(int, ini.split('-'))
        while f'{y:04d}-{m:02d}' <= fim:
            ms.append(f'{y:04d}-{m:02d}')
            m += 1
            if m == 13:
                y, m = y + 1, 1
        meses[k] = ms
    # Importações of Top One (scenario 13): the three newest batches
    lotes = []
    for f, ate in reversed(ARQ_TOP[-3:]):
        ini = [x for x in ARQ_TOP if x[0] == f][0]
        idx = ARQ_TOP.index(ini)
        de = ARQ_TOP[idx - 1][1] if idx else '2026-10-13'
        novas = reg = marcas = imgs = notas = 0
        for d, sp in specs_top.items():
            if de < d <= ate and d >= '2026-10-14':
                for s in sp:
                    if s['src'] == 'arq' and not (d == '2026-10-14' and hm_min(s['e']) < hm_min('09:12')):
                        novas += 1
                        marcas += len([1 for kk in ('setup', 'execucao', 'emocao') if (s.get('mk') or {}).get(kk)])
                        imgs += len((s.get('ax') or {}).get('imgs', []))
                        notas += 1 if (s.get('ax') or {}).get('nota') else 0
                    elif s['src'] in ('app', 'fechada'):
                        reg += 1
        lotes.append({'id': f, 'quando': f'{curto(f)}, 19:{12 if f == "2026-11-11" else "05" if f == "2026-11-18" else "08"}',
                      'nome': f'TopOne_{D(ate).strftime("%m%d")}.csv', 'novas': novas, 'reg': reg, 'marcas': marcas, 'imgs': imgs, 'notas': notas})
    return dias_json, ags, meses, lotes, limpa(var19), datasets


CEN = [
    # board 'dez' (main): a full journal on 1º dez
    ('2', 'dez', '2 · Um dia completo · Top One, terça 10 nov (aberto no calendário em 1º dez)',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-11-10', 'aberta': 'top-2026-11-10-0', 'rev': 'ver'}),
    ('3', 'dez', '3 · Limite atingido · Top One, quinta 19 nov',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-11-19', 'aberta': 'top-2026-11-19-4', 'rev': 'ver'}),
    ('3b', 'dez', '3 · Limite atingido com “Só avisar” · a mesma quinta 19 nov, se as regras só avisassem',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-11-19', 'aberta': 'top-2026-11-19-4', 'variante': 'avisar'}),
    ('4', 'dez', '4 · Calendário · Top One em outubro: histórico, o dia em que as regras começaram e revisões pendentes',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-10-14', 'mes': '2026-10', 'infos': {'cal': True}}),
    ('5', 'dez', '5 · Um dia do histórico · Top One, quinta 8 out (só para ler)',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-10-08', 'mes': '2026-10', 'aberta': 'top-2026-10-08-3'}),
    ('9', 'dez', '9 · Somando as contas de Futuros · Lucid 50k, hoje 1º dez',
     {'conta': 'lucid', 'ag': 'a1dez', 'dia': '2026-12-01', 'contaAberta': True, 'infos': {'resumo': True}}),
    ('9b', 'dez', '9b · Muitas contas · Top One entre 35 contas, hoje 1º dez: a linha das outras, “Ver todas” e a busca do seletor',
     {'conta': 'top', 'ag': 'a1dezM', 'dia': '2026-12-01', 'outras': True}),
    ('11a', 'dez', '11 · Semana fechada · Top One, 23 a 27 nov (aberta pelo calendário)',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-11-24', 'sem': '2026-11-23', 'mes': '2026-11', 'rolar': 'semana'}),
    ('11b', 'dez', '11 · Semana em andamento · Top One, hoje 1º dez',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-12-01', 'rolar': 'semana'}),
    ('13', 'dez', '13 · Rodapé, página antiga e o desfazer de Importações · Top One, 1º dez',
     {'conta': 'top', 'ag': 'a1dez', 'dia': '2026-12-01', 'infos': {'grava': True}, 'importacoes': True, 'lotes': {'2026-11-11': 'confirmando'}, 'rolar': 'rodape'}),
    # board 'hoje': today, other markets, states and phones
    ('1', 'hoje', '1 · Hoje, no meio da janela · Top One, quinta 12 nov, 10:42 ET',
     {'conta': 'top', 'ag': 'a12nov', 'dia': '2026-11-12', 'aberta': 'top-2026-11-12-1'}),
    ('6', 'hoje', '6 · Binárias · Ebinex, quarta 11 nov, 21:20 de Brasília',
     {'conta': 'ebx', 'ag': 'a11nov', 'dia': '2026-11-11', 'aberta': 'ebx-2026-11-11-0'}),
    ('7', 'hoje', '7 · Cripto com fim de semana · Binance, sábado 14 nov, 21:40 de Brasília',
     {'conta': 'bin', 'ag': 'a14nov', 'dia': '2026-11-14', 'aberta': 'bin-2026-11-14-0'}),
    ('8', 'hoje', '8 · B3 em reais · Clear, quinta 12 nov, 11:20 de Brasília',
     {'conta': 'clear', 'ag': 'a12b3', 'dia': '2026-11-12', 'aberta': 'clear-2026-11-12-0'}),
    ('10a', 'hoje', '10 · Conta sem regras · Ylos 50k, 12 nov',
     {'conta': 'ylos', 'ag': 'a12nov', 'dia': '2026-11-12', 'mes': '2026-10'}),
    ('10b', 'hoje', '10 · Conta sem operações · IBKR, 12 nov',
     {'conta': 'ibkr', 'ag': 'a12nov', 'dia': '2026-11-12'}),
    ('10c', 'hoje', '10 · Carregando · Top One, 12 nov', {'conta': 'top', 'ag': 'a12nov', 'dia': '2026-11-12', 'estado': 'carregando'}),
    ('10d', 'hoje', '10 · Não foi possível carregar · Top One, 12 nov', {'conta': 'top', 'ag': 'a12nov', 'dia': '2026-11-12', 'estado': 'erro'}),
    ('10e', 'hoje', '10 · Sem conexão · Top One, 12 nov: a revisão de hoje não é salva',
     {'conta': 'top', 'ag': 'a12nov', 'dia': '2026-11-12', 'estado': 'offline', 'rev': 'form',
      'rascunho': {'func': 'Fiz a parcial no +8.', 'dif': '', 'seguiu': 'Sim', 'levar': ''}}),
    ('12a', 'hoje', '12 · Celular 375 px, claro · 10 nov com a operação em 2 saídas, a revisão e o mês',
     {'conta': 'top', 'ag': 'a12nov', 'dia': '2026-11-10', 'aberta': 'top-2026-11-10-1', 'rev': 'editar', 'celular': True, 'tema': 'claro'}),
    ('12b', 'hoje', '12 · Celular 375 px, escuro · 10 nov com a imagem aberta',
     {'conta': 'top', 'ag': 'a12nov', 'dia': '2026-11-10', 'aberta': 'top-2026-11-10-0', 'dlg': ['top-2026-11-10-0', 0], 'celular': True, 'tema': 'escuro'}),
]


def dados_do_quadro(board, base):
    dias_json, ags, meses, lotes, var19, _ = base
    home_top = '2' if board == 'dez' else '1'
    contas = {}
    for k in ORDEM_MUITAS:
        c = CONTAS[k]
        home = {'top': home_top, 'lucid': '9', 'ylos': '10a', 'ebx': '6', 'ftmo': None, 'ibkr': '10b', 'bin': '7', 'clear': '8'}.get(k)
        contas[k] = {'nome': c.nome, 'mesa': c.mesa, 'grupo': c.grupo, 'fase': c.fase, 'janela': c.janLinha, 'moeda': c.moeda,
                     'pal': 'reais' if c.moeda == 'R$' else 'dólares', 'rel': c.rel, 'suf': c.suf, 'cols': c.cols, 'regras': c.desde is not None,
                     'desde': c.desde, 'desdeC': curto(c.desde) if c.desde else '', 'relogio': c.relogioDia, 'mk': c.mk, 'comissao': c.comissao,
                     'lim': c.lim, 'limTxt': (f'{compacto(c.lim, c.moeda)} · encerra o dia' + (' · somando as contas de Futuros' if c.soma else '')) if c.lim else 'sem limite',
                     'janPlano': c.janPlano, 'temJan': bool(c.jan), 'soma': c.soma, 'home': home,
                     'valores': 'Valores em R$.' if c.moeda == 'R$' else 'Valores em US$ (USDT e USDC contam como dólar).' if c.mk == 'cri' else 'Valores em US$.',
                     'futuros': c.mk == 'fut'}
    proprios = [x for x in CEN if x[1] == board]
    outros = [x for x in CEN if x[1] != board]
    D_ = {
        'board': board,
        'grupos': [{'rot': 'Neste quadro', 'itens': [{'v': v, 'rot': r} for (v, b, r, _x) in proprios]},
                   {'rot': 'No outro quadro do Diário', 'itens': [{'v': v, 'rot': r} for (v, b, r, _x) in outros]}],
        'cen': {v: x for (v, b, r, x) in CEN},
        'cenPadrao': proprios[0][0],
        'contas': contas, 'ordem': ORDEM,
        'mercados': [['Futuros', ['top', 'lucid', 'ylos']], ['Opções binárias', ['ebx']], ['Forex', ['ftmo']], ['Ações', ['ibkr']], ['Cripto', ['bin']], ['B3', ['clear']]],
        'ags': ags, 'dias': dias_json, 'meses': meses, 'lotes': lotes, 'var19': var19,
    }
    return D_


if __name__ == '__main__':
    base = monta()
    for b in ('dez', 'hoje'):
        D_ = dados_do_quadro(b, base)
        s = json.dumps(D_, ensure_ascii=False, separators=(',', ':'))
        open(f'data_{b}.json', 'w', encoding='utf-8').write(s)
        print(b, len(s.encode('utf-8')))
