# pt-BR formatting helpers for the Diário boards' invented data
import datetime as dt
from decimal import Decimal as Dec, ROUND_HALF_UP

MINUS = '−'
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
M3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
WD = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']
WD3 = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']


def D(s):
    return dt.date.fromisoformat(s)


def dnum(d):
    return '1º' if d.day == 1 else str(d.day)


def curto(d):
    if isinstance(d, str):
        d = D(d)
    return f'{dnum(d)} {M3[d.month - 1]}'


def longo(d, cap=True):
    if isinstance(d, str):
        d = D(d)
    s = f'{WD[d.weekday()]}, {dnum(d)} de {MESES[d.month - 1]}'
    return s[0].upper() + s[1:] if cap else s


def grp(n):
    return f'{n:,}'.replace(',', '.')


def money(c, m='US$', signed=False):
    a = abs(c)
    s = f'{grp(a // 100)},{a % 100:02d}'
    sign = MINUS if c < 0 else ('+' if signed and c > 0 else '')
    return f'{sign}{m} {s}'


def compacto(c, m='US$'):
    s = money(abs(c), m)
    return s[:-3] if s.endswith(',00') else s


def numtxt(c):
    a = abs(c)
    s = f'{grp(a // 100)},{a % 100:02d}'
    return (MINUS if c < 0 else '+' if c > 0 else '') + s


def numcurto(c):
    v = int((Dec(abs(c)) / 100).quantize(Dec('1'), ROUND_HALF_UP))
    return (MINUS if c < 0 and v else '+' if c > 0 and v else '') + grp(v)


def dec(x, dp, signed=False):
    x = Dec(x)
    q = Dec(1).scaleb(-dp) if dp else Dec(1)
    v = x.quantize(q, ROUND_HALF_UP)
    a = abs(v)
    ip = int(a)
    s = grp(ip)
    if dp:
        frac = str(a - ip)[2:].ljust(dp, '0')[:dp]
        s += ',' + frac
    sign = MINUS if v < 0 else ('+' if signed and v > 0 else '')
    return sign + s


def dec_curto(x, signed=False):
    """Up to two decimals, without trailing zeros («150», «5,5»)"""
    v = Dec(x).quantize(Dec('0.01'), ROUND_HALF_UP).normalize()
    if v == v.to_integral():
        v = v.quantize(Dec('1'))
        return dec(v, 0, signed)
    dp = -v.as_tuple().exponent
    return dec(v, dp, signed)


def hm_add(hm, minutes):
    h, m = map(int, hm.split(':'))
    t = h * 60 + m + minutes
    return f'{t // 60:02d}:{t % 60:02d}'


def hm_min(hm):
    h, m = map(int, hm.split(':'))
    return h * 60 + m


def plural(n, s, p):
    return f'{n} {s if n == 1 else p}'


def lista_e(itens):
    itens = [i for i in itens if i]
    if len(itens) <= 1:
        return ''.join(itens)
    return ', '.join(itens[:-1]) + ' e ' + itens[-1]
