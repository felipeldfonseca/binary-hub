# The Diário boards' trade and day model: every number is computed here from invented trades
from decimal import Decimal as Dec, ROUND_HALF_UP
from fmt import *

SPEC = {
    'MES': dict(mult=Dec('5'), dp=2, com=124, tipo='fut'),
    'MNQ': dict(mult=Dec('2'), dp=2, com=124, tipo='fut'),
    'MGC': dict(mult=Dec('10'), dp=1, com=164, tipo='fut'),
    'WIN': dict(mult=Dec('0.2'), dp=0, com=0, tipo='b3'),
    'BTC/USDT': dict(mult=Dec('1'), dp=2, com=0, tipo='cri', base='BTC'),
    'ETH/USDT': dict(mult=Dec('1'), dp=2, com=0, tipo='cri', base='ETH'),
    'SOL/USDT': dict(mult=Dec('1'), dp=2, com=0, tipo='cri', base='SOL'),
}


def cents(x):
    return int((Dec(x) * 100).quantize(Dec('1'), ROUND_HALF_UP))


class Conta:
    def __init__(self, **k):
        self.__dict__.update(k)


def preco(ativo, p):
    return dec(p, SPEC[ativo]['dp'])


def qtd_txt(ativo, q):
    t = SPEC[ativo]['tipo']
    if t == 'cri':
        return f'{dec_curto(q)} {SPEC[ativo]["base"]}'
    return f'{q} ct'


def dif_txt(ativo, d):
    t = SPEC[ativo]['tipo']
    if t == 'fut':
        return f'{dec(d, 2, True)} pts'
    if t == 'b3':
        return f'{dec_curto(d, True)} pts'
    return f'{dec_curto(d, True)} por {SPEC[ativo]["base"]}'


LADO = {'C': 'Compra', 'V': 'Venda', 'A': 'Alta', 'B': 'Baixa'}
SGN = {'C': 1, 'V': -1}


def vela(e, exp):
    """Ebinex: the operation runs the next candle of its timeframe (1, 5 or 15 min)"""
    m = hm_min(e)
    ini = (m // exp + 1) * exp
    return f'{ini // 60:02d}:{ini % 60:02d}', f'{(ini + exp) // 60:02d}:{(ini + exp) % 60:02d}'


def calc_trade(c, t, com_conhecida):
    """Money of one trade: gross, commission, net (cents), exits as limit events"""
    t = dict(t)
    if 'bin' in t:
        b = t['bin']
        ini, fim = vela(t['e'], b['exp'])
        t['vela'] = (ini, fim)
        if b['res'] is None:
            t.update(bruto=None, com=0, net=None, eventos=[], aberta=True, saida_hm=None, q_saida=0)
        else:
            g = cents(Dec(b['stake']) * Dec(b['payout']) / 100) if b['res'] == 'ganho' else -cents(b['stake']) if b['res'] == 'perda' else 0
            t.update(bruto=g, com=0, net=g, eventos=[(fim, g, t['id'])], aberta=False, saida_hm=fim, q_saida=1)
        return t
    s = SPEC[t['a']]
    sg = SGN[t['l']]
    pe = Dec(t['pe'])
    eventos, g_tot, c_tot, q_out = [], 0, 0, Dec(0)
    for (q, px, hm, _k) in t['x']:
        g = cents((Dec(px) - pe) * sg * Dec(q) * s['mult'])
        cm = s['com'] * int(Dec(q)) if (com_conhecida and s['com']) else 0
        eventos.append((hm, g - cm, t['id']))
        g_tot += g
        c_tot += cm
        q_out += Dec(q)
    aberta = q_out < Dec(t['q'])
    t.update(bruto=g_tot, com=c_tot, net=g_tot - c_tot, eventos=eventos, aberta=aberta,
             saida_hm=None if aberta else t['x'][-1][2], q_saida=q_out)
    return t


def limite_do_dia(eventos, lim):
    """limit_usage: cumulative realized net, worst point, the instant the limit was reached"""
    cum, pior, hit = 0, 0, None
    for hm, v, _ in sorted(eventos, key=lambda x: (hm_min(x[0]), x[2])):
        cum += v
        if -cum > pior:
            pior = -cum
        if lim and hit is None and -cum >= lim:
            hit = hm
    return pior, hit


def na_janela(c, dia, hm):
    if not c.jan:
        return None
    wd = D(dia).weekday()
    if c.diasJan == 'util' and wd >= 5:
        return False
    m = hm_min(hm)
    return c.jan[0] <= m < c.jan[1]


def fatos_txt(c, trs, net, lim_pior, lim_hit):
    """«O diário registrou: …» (Phase 4 facts only)"""
    n = len(trs)
    partes = [plural(n, 'operação', 'operações')]
    if trs:
        partes.append(money(net, c.moeda, True))
    if lim_hit:
        partes.append(f'limite atingido às {lim_hit}')
    fj = [t['e'] for t in trs if 'fora da janela' in t['quebras']]
    dl = [t['e'] for t in trs if 'depois do limite' in t['quebras']]
    if fj:
        partes.append(f'{len(fj)} fora da janela, {"às " + lista_e(fj)}')
    if dl:
        partes.append(f'{len(dl)} depois do limite, {"às " + lista_e(dl)}')
    if not fj and not dl and c.jan:
        partes.append('todas no plano' if n > 1 else 'no plano')
    if c.lim:
        partes.append(f'limite: {compacto(lim_pior, c.moeda)} de {compacto(c.lim, c.moeda)} no pior momento')
    return ' · '.join(partes)

