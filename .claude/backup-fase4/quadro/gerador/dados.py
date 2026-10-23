# The Diário boards' invented accounts, trades and scenarios (never the owner's data)
import datetime as dt
import random
from dia import *

CONTAS = {
    'top': Conta(id='top', nome='Top One', mk='fut', grupo='Futuros', fase='Financiada', rel='ET', suf=' ET', moeda='US$',
                 jan=(600, 660), diasJan='util', janPlano='10:00–11:00 ET', janLinha='Janela 10:00–11:00 ET',
                 lim=40000, limModo='encerra', soma=False, be='MES +8 pts · MNQ +30 pts', beN={'MES': 8, 'MNQ': 30},
                 desde='2026-10-14', desdeHM='09:12', comissao=True, cols=5, giro=18 * 60,
                 relogioDia='O pregão de futuros vai das 18:00 da véspera às 17:00 ET.'),
    'lucid': Conta(id='lucid', nome='Lucid 50k', mk='fut', grupo='Futuros', fase='Avaliação', rel='ET', suf=' ET', moeda='US$',
                   jan=(600, 660), diasJan='util', janPlano='10:00–11:00 ET', janLinha='Janela 10:00–11:00 ET',
                   lim=40000, limModo='encerra', soma=True, be=None, beN=None, desde='2026-11-02', desdeHM='09:05', comissao=True, cols=5,
                   giro=18 * 60, relogioDia='O pregão de futuros vai das 18:00 da véspera às 17:00 ET.'),
    'ylos': Conta(id='ylos', nome='Ylos 50k', mk='fut', grupo='Futuros', fase='Avaliação', rel='ET', suf=' ET', moeda='US$',
                  jan=None, diasJan='util', janPlano='', janLinha='Sem janela salva', lim=None, limModo='encerra', soma=False,
                  be=None, beN=None, desde=None, desdeHM=None, comissao=True, cols=5, giro=18 * 60,
                  relogioDia='O pregão de futuros vai das 18:00 da véspera às 17:00 ET.'),
    'ebx': Conta(id='ebx', nome='Ebinex', mk='bin', grupo='Opções binárias', fase='Pessoal', rel='Brasília', suf=' de Brasília', moeda='US$',
                 jan=(1200, 1260), diasJan='util', janPlano='20:00–21:00 · Brasília', janLinha='Janela 20:00–21:00 · Brasília',
                 lim=None, limModo='encerra', soma=False, be=None, beN=None, desde='2026-10-14', desdeHM='19:40', comissao=False, cols=5,
                 giro=0, relogioDia='O pregão desta conta vai da meia-noite à meia-noite de Brasília.'),
    'ftmo': Conta(id='ftmo', nome='FTMO', mk='fx', grupo='Forex', fase='Avaliação', rel='ET', suf=' ET', moeda='US$',
                  jan=(480, 600), diasJan='util', janPlano='08:00–10:00 ET', janLinha='Janela 08:00–10:00 ET', lim=100000, limModo='encerra',
                  soma=False, be=None, beN=None, desde='2026-10-13', desdeHM='07:30', comissao=True, cols=5, giro=17 * 60,
                  relogioDia='O pregão desta conta vai das 17:00 da véspera às 17:00 ET.'),
    'ibkr': Conta(id='ibkr', nome='IBKR', mk='eua', grupo='Ações', fase='Pessoal', rel='ET', suf=' ET', moeda='US$',
                  jan=None, diasJan='util', janPlano='', janLinha='Sem janela salva', lim=None, limModo='encerra', soma=False,
                  be=None, beN=None, desde='2026-10-13', desdeHM='08:00', comissao=True, cols=5, giro=20 * 60,
                  relogioDia='O pregão desta conta vai das 20:00 da véspera às 20:00 ET.'),
    'bin': Conta(id='bin', nome='Binance', mk='cri', grupo='Cripto', fase='Pessoal', rel='Brasília', suf=' de Brasília', moeda='US$',
                 jan=(1200, 1320), diasJan='todos', janPlano='20:00–22:00 · Brasília, todos os dias', janLinha='Janela 20:00–22:00 · Brasília',
                 lim=None, limModo='encerra', soma=False, be=None, beN=None, desde='2026-10-13', desdeHM='12:00', comissao=False, cols=7,
                 giro=0, relogioDia='O pregão desta conta vai da meia-noite à meia-noite de Brasília.'),
    'clear': Conta(id='clear', nome='Clear', mk='b3', grupo='B3', fase='Pessoal', rel='Brasília', suf=' de Brasília', moeda='R$',
                   jan=(600, 660), diasJan='util', janPlano='10:00–11:00 · Brasília', janLinha='Janela 10:00–11:00 · Brasília',
                   lim=50000, limModo='encerra', soma=False, be=None, beN=None, desde='2026-10-13', desdeHM='09:30', comissao=False, cols=5,
                   giro=0, relogioDia='O pregão desta conta vai da meia-noite à meia-noite de Brasília.'),
}
ORDEM = ['top', 'lucid', 'ylos', 'ebx', 'ftmo', 'ibkr', 'bin', 'clear']
# the firm («mesa») of each account: the selector groups by it when there are many accounts
for _k, _mesa in {'top': 'Top One', 'lucid': 'Lucid', 'ylos': 'Ylos', 'ebx': 'Ebinex', 'ftmo': 'FTMO', 'ibkr': 'Interactive Brokers',
                  'bin': 'Binance', 'clear': 'Clear'}.items():
    CONTAS[_k].mesa = _mesa

TXT_FUNC = ['Esperei o rompimento confirmar antes de entrar.', 'Respeitei o stop na primeira perda.', 'Fiz a parcial no +8 e deixei o resto correr.',
            'Parei depois de duas operações boas.', 'Entrei só dentro da janela.', 'Esperei o reteste da VWAP.']
TXT_DIF = ['Não entraria depois das 11:00.', 'Teria saído no alvo, sem esperar mais.', 'Esperaria o primeiro recuo.',
           'Não aumentaria a mão depois de uma perda.', 'Menos operações na MNQ.', '']
TXT_LEVAR = ['Uma operação por vez.', 'Fechar a plataforma às 11:00.', 'Esperar a primeira meia hora.', 'Só a favor da VWAP.', 'Stop anotado antes de entrar.']
TXT_ANTES = ['Esperar a primeira meia hora.', 'Só compro acima da VWAP.', 'No máximo três operações.', 'Vender só abaixo da mínima de ontem.', 'Parcial no +8.']
TXT_BIN_FUNC = ['Esperei a vela de 5 minutos fechar.', 'Operei só a favor da tendência.', 'Parei depois de duas perdas.']
TXT_BIN_LEVAR = ['Só a favor da tendência de 15 min.', 'Nada depois das 21:00.', 'Stake fixo de US$ 20.']


def dias_uteis(a, b, todos=False):
    d = D(a)
    out = []
    while d <= D(b):
        if todos or d.weekday() < 5:
            out.append(d.isoformat())
        d += dt.timedelta(days=1)
    return out


def tick(x, t):
    return (Dec(x) / Dec(t)).quantize(Dec('1'), ROUND_HALF_UP) * Dec(t)


BASE = {'MES': Dec('7980'), 'MNQ': Dec('25400'), 'MGC': Dec('4080')}
TICK = {'MES': '0.25', 'MNQ': '0.25', 'MGC': '0.1'}


def gera_fut(rng, dia, n, src, be_ativo, fora_ok=True, marcar=True):
    specs = []
    t = rng.choice([600, 601, 603, 605, 608, 612, 615])
    if fora_ok and rng.random() < 0.12:
        t = rng.choice([584, 588, 592])
    drift = Dec(rng.randint(-60, 60))
    for i in range(n):
        a = rng.choices(['MES', 'MNQ', 'MGC'], [70, 20, 10])[0]
        l = rng.choice(['C', 'V'])
        q = rng.choices([1, 2, 3], [40, 45, 15])[0] if a == 'MES' else rng.choice([1, 2]) if a == 'MNQ' else 1
        dur = rng.randint(4, 17)
        ganho = rng.random() < 0.57
        if a == 'MES':
            mag = Dec(rng.randint(8, 52)) * Dec('0.25') if ganho else Dec(rng.randint(8, 40)) * Dec('0.25')
            stop = Dec(rng.choice([6, 8, 10, 12]))
        elif a == 'MNQ':
            mag = Dec(rng.randint(32, 170)) * Dec('0.25') if ganho else Dec(rng.randint(32, 140)) * Dec('0.25')
            stop = Dec(rng.choice([20, 25, 30, 40]))
        else:
            mag = Dec(rng.randint(10, 70)) * Dec('0.1') if ganho else Dec(rng.randint(10, 55)) * Dec('0.1')
            stop = Dec(rng.choice([3, 4, 5]))
        com_stop = src == 'app' and rng.random() < 0.6
        if com_stop and not ganho and mag > stop:
            mag = stop
        pts = mag if ganho else -mag
        base = BASE[a] + (drift if a == 'MES' else drift * 3 if a == 'MNQ' else drift / 4)
        pe = tick(base + Dec(rng.randint(-40, 40)) * Dec(TICK[a]), TICK[a])
        px = pe + pts * SGN[l]
        e = f'{t // 60:02d}:{t % 60:02d}'
        s_ = f'{(t + dur) // 60:02d}:{(t + dur) % 60:02d}'
        sp = {'e': e, 'a': a, 'l': l, 'q': q, 'pe': str(pe), 'x': [(q, str(px), s_, 'final')], 'src': src}
        if src == 'app' and rng.random() < 0.08:
            sp['src'] = 'fechada'
            sp['regEm'] = f'17:{rng.randint(10, 55):02d}'
        if com_stop and sp['src'] == 'app':
            sp['stop'] = str(stop)
            sp['alvo'] = str(stop * 2)
            sp['stopEm'] = e
            n_be = {'MES': 8, 'MNQ': 30}.get(a)
            if be_ativo and n_be and ganho and pts >= n_be and dur > 5 and rng.random() < 0.55:
                sp['movs'] = [(f'{(t + 3) // 60:02d}:{(t + 3) % 60:02d}', 'be', str(pe), str(n_be))]
        if marcar and sp['src'] == 'app':
            mk = {}
            if rng.random() < 0.8:
                mk['setup'] = (rng.choices(['A', 'B', 'C'], [35, 45, 20])[0], e)
            if rng.random() < 0.6:
                hm = f'{(t + dur - 1) // 60:02d}:{(t + dur - 1) % 60:02d}' if rng.random() < 0.6 else f'{(t + dur + 9) // 60:02d}:{(t + dur + 9) % 60:02d}'
                mk['execucao'] = (rng.choice(['cedo', 'no ponto', 'no ponto', 'tarde']), hm)
            if rng.random() < 0.5:
                mk['emocao'] = (rng.choice(['Calmo', 'Confiante', 'Ansioso', 'Neutro']), f'{(t + 1) // 60:02d}:{(t + 1) % 60:02d}')
            sp['mk'] = mk
        elif sp['src'] == 'fechada':
            sp['mk'] = {'setup': (rng.choice(['A', 'B', 'C']), sp['regEm'])}
        specs.append(sp)
        t += dur + rng.randint(3, 14)
    return specs


def gera_bin(rng, dia, n, src):
    specs = []
    t = rng.choice([1200, 1202, 1205, 1209])
    for i in range(n):
        exp = rng.choice([1, 5, 5, 15])
        res = rng.choices(['ganho', 'perda', 'devolvida'], [55, 40, 5])[0]
        e = f'{t // 60:02d}:{t % 60:02d}'
        sp = {'e': e, 'bin': {'par': rng.choice(['EUR/USD', 'EUR/USD', 'GBP/USD', 'USD/JPY']), 'dir': rng.choice(['A', 'B']), 'exp': exp,
                              'stake': str(rng.choice([10, 15, 20, 20, 25])), 'payout': rng.choice([85, 86, 88, 90]), 'res': res}, 'src': src}
        if src == 'app':
            sp['mk'] = {'setup': (rng.choice(['A', 'B', 'C']), e)} if rng.random() < 0.7 else {}
        specs.append(sp)
        t += exp + rng.randint(4, 14)
    return specs


def gera_cri(rng, dia, n):
    specs = []
    t = rng.choice([1202, 1208, 1215, 1230])
    for i in range(n):
        a, q, base, step = rng.choice([('BTC/USDT', '0.25', 98000, 50), ('BTC/USDT', '0.1', 98000, 50), ('ETH/USDT', '1.5', 3600, 1),
                                       ('SOL/USDT', '20', 210, Dec('0.05'))])
        l = rng.choice(['C', 'V'])
        ganho = rng.random() < 0.55
        if a.startswith('BTC'):
            mag = Dec(rng.randint(4, 18)) * 50
        elif a.startswith('ETH'):
            mag = Dec(rng.randint(8, 45))
        else:
            mag = Dec(rng.randint(20, 120)) * Dec('0.05')
        pe = Dec(base) + Dec(rng.randint(-30, 30)) * Dec(step)
        px = pe + (mag if ganho else -mag) * SGN[l]
        dur = rng.randint(10, 45)
        e = f'{t // 60:02d}:{t % 60:02d}'
        s_ = f'{(t + dur) // 60:02d}:{(t + dur) % 60:02d}'
        specs.append({'e': e, 'a': a, 'l': l, 'q': q, 'pe': str(pe), 'x': [(q, str(px), s_, 'final')], 'src': 'app',
                      'mk': {'setup': (rng.choice(['A', 'B', 'C']), e)}})
        t += dur + rng.randint(5, 30)
    return specs


def gera_b3(rng, dia, n):
    specs = []
    t = rng.choice([600, 602, 605, 610])
    for i in range(n):
        q = rng.choice([1, 2, 3])
        l = rng.choice(['C', 'V'])
        ganho = rng.random() < 0.56
        mag = Dec(rng.randint(10, 70) * 5)
        pe = Dec(127800 + rng.randint(-120, 160) * 5)
        px = pe + (mag if ganho else -mag) * SGN[l]
        dur = rng.randint(5, 16)
        e = f'{t // 60:02d}:{t % 60:02d}'
        s_ = f'{(t + dur) // 60:02d}:{(t + dur) % 60:02d}'
        specs.append({'e': e, 'a': 'WIN', 'l': l, 'q': q, 'pe': str(pe), 'x': [(q, str(px), s_, 'final')], 'src': 'app',
                      'mk': {'setup': (rng.choice(['A', 'B', 'C']), e)}})
        t += dur + rng.randint(4, 15)
    return specs


def registrados_ate(specs, hm):
    """The trades the app held at hm: registered by then (live entries at their registration, «Já fechada» at its
    registration, old-page entries at their entry), with the prices as registered (before any file corrected them)"""
    ate = []
    for s in specs:
        if s['src'] in ('app', 'antiga') and hm_min(s.get('regEm') or s['e']) <= hm_min(hm):
            ate.append(dict(s, x=s['xReg']) if s.get('xReg') else s)
        elif s['src'] == 'fechada' and s.get('regEm') and hm_min(s['regEm']) <= hm_min(hm):
            ate.append(dict(s, x=s['xReg']) if s.get('xReg') else s)
    return ate


def eventos_ate(c, dia, specs, hm):
    """Another account's realized results as the app had them at hm (for a frozen «somando»): gross, exits by hm"""
    r = monta_dia(c, dia, registrados_ate(specs, hm), {'arq': None, 'revs': []})
    return [ev for ev in evs(r) if hm_min(ev[0]) <= hm_min(hm)]


def revisao(c, dia, specs, hm, func, dif, seguiu, levar, ctx, em_dia=None, ext_ate=None):
    """One review version: frozen facts of what the app knew at save time (trades registered by then, before any file;
    with «somando», the other futures accounts as they stood then)"""
    ctx = dict(ctx, arq=None, revs=[])
    if ext_ate is not None:
        ctx['ext'] = ext_ate(hm)
    r = monta_dia(c, dia, registrados_ate(specs, hm), ctx)
    em = em_dia or dia
    return {'em': f'{em}T{hm}', 'dia': em, 'hm': hm, 'reg': r['fatos'], 'n': r['n'], 'net': r['net'],
            'func': func, 'dif': dif, 'seguiu': seguiu, 'levar': levar}


ARQ_TOP = [('2026-10-22', '2026-10-21'), ('2026-10-28', '2026-10-27'), ('2026-11-04', '2026-11-03'), ('2026-11-11', '2026-11-10'),
           ('2026-11-18', '2026-11-17'), ('2026-11-25', '2026-11-24')]


def arquivo_de(dia, arqs):
    ant = '0000'
    for f, ate in arqs:
        if ant < dia <= ate:
            return f
        ant = ate
    return None


def evs(rec):
    return [ev for t in rec['_trs'] for ev in t['eventos']]


# ------------------------------------------------------------------------------------------------ Top One
def top_one():
    c = CONTAS['top']
    rng = random.Random(4410)
    dias = {}
    specs_de = {}
    # history 1 set – 13 out (file of 13 out)
    for d in dias_uteis('2026-09-01', '2026-10-13'):
        if d == '2026-10-08':
            sp = [
                {'e': '09:55', 'a': 'MES', 'l': 'C', 'q': 2, 'pe': '8021.50', 'x': [(2, '8018.00', '10:02', 'final')], 'src': 'hist'},
                {'e': '10:08', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '8016.25', 'x': [(1, '8022.75', '10:15', 'final')], 'src': 'hist'},
                {'e': '11:20', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '8027.00', 'x': [(2, '8032.00', '11:26', 'final')], 'src': 'hist'},
                {'e': '11:23', 'a': 'MNQ', 'l': 'C', 'q': 1, 'pe': '25488.25', 'x': [(1, '25413.50', '11:34', 'final')], 'src': 'hist'},
                {'e': '11:41', 'a': 'MES', 'l': 'C', 'q': 3, 'pe': '8030.75', 'x': [(3, '8018.75', '11:52', 'final')], 'src': 'hist'},
            ]
        elif rng.random() < 0.25:
            continue
        else:
            sp = gera_fut(rng, d, rng.choice([2, 3, 3, 4, 5]), 'hist', False, marcar=False)
        specs_de[d] = sp
        dias[d] = monta_dia(c, d, sp, {'impHist': '2026-10-13'})
    # the journal
    pendentes = {'2026-10-20', '2026-10-27', '2026-11-13', '2026-11-18', '2026-11-30'}
    so_arquivo = {'2026-10-28', '2026-11-05', '2026-11-17'}
    sem_op = {'2026-10-30', '2026-11-11', '2026-11-26'}
    for d in dias_uteis('2026-10-14', '2026-12-01'):
        if d in sem_op:
            continue
        arq = arquivo_de(d, ARQ_TOP)
        be = d >= '2026-10-23'
        ctx = {'arq': arq, 'be': be, 'impHist': '2026-10-13'}
        revs = []
        antes = None
        if d == '2026-10-14':
            sp = [
                {'e': '08:50', 'a': 'MES', 'l': 'C', 'q': 1, 'pe': '8012.25', 'x': [(1, '8016.50', '08:58', 'final')], 'src': 'arq'},
                {'e': '10:07', 'a': 'MES', 'l': 'C', 'q': 2, 'pe': '8024.50', 'x': [(2, '8031.75', '10:16', 'final')], 'src': 'app', 'stop': '8', 'alvo': '16', 'stopEm': '10:07',
                 'mk': {'setup': ('A', '10:07'), 'execucao': ('no ponto', '10:15'), 'emocao': ('Calmo', '10:08')}},
                {'e': '10:41', 'a': 'MNQ', 'l': 'V', 'q': 1, 'pe': '25512.50', 'x': [(1, '25488.00', '10:52', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:41')}},
                {'e': '11:12', 'a': 'MGC', 'l': 'C', 'q': 1, 'pe': '4051.2', 'x': [(1, '4047.9', '11:20', 'final')], 'src': 'app', 'mk': {'setup': ('C', '11:25')}},
            ]
            antes = {'txt': 'Primeiro dia com regras: só dentro da janela.', 'nota': 'anotado às 09:30, antes da 1ª entrada'}
            revs = [revisao(c, d, sp, '11:41', 'Esperei o rompimento confirmar na MES.', 'Não entraria no ouro depois das 11:00.', 'Em parte', 'Fechar a plataforma às 11:00.', ctx)]
        elif d == '2026-10-21':
            sp = gera_fut(rng, d, 3, 'app', be)
            sp.append({'e': '10:58', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '7962.00', 'x': [(1, '7957.25', '11:06', 'final')], 'src': 'antiga'})
            sp.sort(key=lambda s: hm_min(s['e']))
            revs = [revisao(c, d, sp, '11:40', 'Esperei o rompimento confirmar antes de entrar.', 'Lancei uma venda na página antiga em vez do Registrar.', 'Em parte', 'Registrar tudo no app.', ctx)]
        elif d == '2026-11-10':
            sp = [
                {'e': '10:03', 'regEm': '10:06', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '7862.25', 'x': [(2, '7854.00', '10:09', 'final')], 'stop': '6', 'alvo': '10',
                 'stopEm': '10:06', 'src': 'app',
                 'mk': {'setup': ('B', '10:06', ('C', '11:20')), 'execucao': ('no ponto', '10:07'), 'emocao': ('Calmo', '10:06')},
                 'ax': {'imgs': [('MES_10-03_entrada.png', '612 KB', 1), ('MES_10-09_saida.png', '540 KB', 2)],
                        'nota': 'Vendi o reteste da mínima da abertura e saí antes da VWAP.', 'quando': 'às 10:12'},
                 'corretora': '10:03:18–10:10:28'},
                {'e': '10:14', 'a': 'MES', 'l': 'C', 'q': 3, 'pe': '7851.00', 'x': [(1, '7859.00', '10:22', 'parcial'), (2, '7869.50', '10:41', 'final')],
                 'stop': '10', 'alvo': '20', 'stopEm': '10:14', 'src': 'app', 'movs': [('10:22', 'be', '7851.00', '8')],
                 'mk': {'setup': ('A', '10:14'), 'execucao': ('no ponto', '10:21'), 'emocao': ('Confiante', '10:16')}},
                {'e': '10:22', 'a': 'MNQ', 'l': 'V', 'q': 1, 'pe': '25410.50', 'x': [(1, '25441.00', '10:30', 'final')], 'src': 'fechada', 'regEm': '17:48',
                 'mk': {'setup': ('C', '17:48'), 'emocao': ('Ansioso', '17:48')}},
                {'e': '10:47', 'a': 'MGC', 'l': 'C', 'q': 1, 'pe': '4112.3', 'x': [(1, '4118.6', '10:55', 'final')], 'xReg': [(1, '4118.4', '10:55', 'final')], 'src': 'app', 'stop': '4', 'alvo': '8',
                 'stopEm': '10:47', 'corr': ('saída', '4.118,4', '4.118,6'), 'mk': {'setup': ('B', '10:47'), 'execucao': ('cedo', '11:02')}},
                {'e': '11:20', 'a': 'MES', 'l': 'C', 'q': 1, 'pe': '7868.25', 'x': [(1, '7862.00', '11:26', 'final')], 'src': 'arq',
                 'mk': {'setup': ('C', '19:20', None, '11 nov às 19:20'), 'execucao': ('tarde', '19:20', None, '11 nov às 19:20')},
                 'ax': {'imgs': [], 'nota': 'Entrei fora da janela para recuperar a MNQ.', 'quando': 'em 11 nov, às 19:21'}},
            ]
            antes = {'txt': 'Esperar a primeira meia hora. Vender só abaixo da mínima de ontem.', 'nota': 'anotado às 09:41, antes da 1ª entrada'}
            revs = [
                revisao(c, d, sp, '11:33', 'Esperei o reteste da mínima para vender.', '', 'Sim', 'Uma operação por vez.', ctx),
                revisao(c, d, sp, '18:05', 'Esperei o reteste da mínima para vender e realizei a parcial no +8.',
                        'A MNQ das 10:22 foi uma entrada sem setup, com a MES ainda aberta.', 'Em parte', 'Uma operação por vez.', ctx),
            ]
            ctx['apag'] = '1 operação registrada foi apagada às 10:20.'
        elif d == '2026-11-12':
            sp = [
                {'e': '10:04', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '7880.00', 'x': [(2, '7875.50', '10:11', 'final')], 'src': 'app', 'stop': '8', 'alvo': '16', 'stopEm': '10:04',
                 'mk': {'setup': ('A', '10:04'), 'execucao': ('no ponto', '10:10')}},
                {'e': '10:18', 'a': 'MES', 'l': 'C', 'q': 3, 'pe': '7871.25', 'x': [(1, '7879.25', '10:31', 'parcial'), (2, '7871.25', '10:52', 'final')],
                 'stop': '10', 'alvo': '20', 'stopEm': '10:18', 'movs': [('10:31', 'be', '7871.25', '8')], 'src': 'app',
                 'mk': {'setup': ('A', '10:18'), 'emocao': ('Calmo', '10:20')}},
            ]
            antes = {'txt': 'Só compro acima da VWAP; parcial no +8.', 'nota': 'anotado às 09:40, antes da 1ª entrada'}
            revs = [revisao(c, d, sp, '11:48', 'Fiz a parcial no +8 e deixei o stop na entrada.', 'Nada: o stop na entrada me tirou no zero a zero.', 'Sim',
                            'Parcial no +8, stop na entrada.', ctx)]
        elif d == '2026-11-19':
            sp = [
                {'e': '10:03', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '8040.25', 'x': [(2, '8048.50', '10:09', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:03'), 'emocao': ('Ansioso', '10:04')}},
                {'e': '10:14', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '8046.00', 'x': [(2, '8056.25', '10:20', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:14')}},
                {'e': '10:24', 'a': 'MNQ', 'l': 'V', 'q': 2, 'pe': '25520.00', 'x': [(2, '25545.75', '10:31', 'final')], 'src': 'app', 'mk': {'setup': ('C', '10:24'), 'emocao': ('Frustrado', '10:25')}},
                {'e': '10:33', 'a': 'MES', 'l': 'V', 'q': 3, 'pe': '8051.75', 'x': [(3, '8060.25', '10:38', 'final')], 'src': 'app', 'mk': {'setup': ('C', '10:33')}},
                {'e': '10:52', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '8063.00', 'x': [(1, '8070.50', '10:57', 'final')], 'src': 'app',
                 'mk': {'setup': ('C', '10:52'), 'execucao': ('tarde', '11:05'), 'emocao': ('Frustrado', '10:52')}},
            ]
            revs = [revisao(c, d, sp, '11:42', 'Nada. Parei tarde.', 'Depois da segunda perda, parar. A última foi depois do limite.', 'Não',
                            'Duas perdas seguidas: acabou o dia.', ctx)]
        elif d == '2026-11-24':
            sp = [
                {'e': '10:02', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '8012.50', 'x': [(2, '8004.75', '10:12', 'final')], 'src': 'app', 'stop': '8', 'alvo': '16', 'stopEm': '10:02',
                 'mk': {'setup': ('A', '10:02')}},
                {'e': '10:31', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '8009.00', 'x': [(1, '8003.50', '10:44', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:31')}},
                {'e': '11:05', 'a': 'MES', 'l': 'C', 'q': 2, 'pe': '8001.25', 'x': [(2, '7997.25', '11:12', 'final')], 'src': 'app', 'mk': {'setup': ('C', '11:05')}},
                {'e': '11:20', 'a': 'MES', 'l': 'C', 'q': 2, 'pe': '7999.00', 'x': [(2, '7996.00', '11:27', 'final')], 'src': 'app', 'mk': {'setup': ('C', '11:20')}},
            ]
            revs = [revisao(c, d, sp, '11:44', 'As duas vendas dentro da janela.', 'Não compraria depois das 11:00 para recuperar.', 'Em parte', 'Fechar a plataforma às 11:00.', ctx)]
        elif d == '2026-11-27':
            sp = [
                {'e': '09:52', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '7990.00', 'x': [(1, '7996.50', '09:58', 'final')], 'src': 'app', 'mk': {'setup': ('C', '09:52')}},
                {'e': '10:15', 'a': 'MES', 'l': 'C', 'q': 2, 'pe': '7992.25', 'x': [(2, '8001.00', '10:29', 'final')], 'src': 'app', 'stop': '8', 'alvo': '16', 'stopEm': '10:15',
                 'mk': {'setup': ('A', '10:15')}},
                {'e': '10:40', 'a': 'MNQ', 'l': 'C', 'q': 1, 'pe': '25790.00', 'x': [(1, '25812.50', '10:51', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:40')}},
            ]
            revs = [revisao(c, d, sp, '11:15', 'Esperei a janela abrir para a compra boa.', 'A venda das 09:52 foi antes da janela.', 'Em parte', 'Esperar as 10:00.', ctx)]
        elif d == '2026-12-01':
            sp = [
                {'e': '10:04', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '7951.25', 'x': [(2, '7955.75', '10:06', 'final')], 'src': 'app',
                 'mk': {'setup': ('C', '10:04'), 'execucao': ('cedo', '10:05'), 'emocao': ('Ansioso', '10:05')}},
                {'e': '10:33', 'a': 'MES', 'l': 'V', 'q': 2, 'pe': '7938.50', 'x': [(2, '7929.00', '10:49', 'final')], 'stop': '12', 'alvo': '24', 'stopEm': '10:33', 'src': 'app',
                 'mk': {'setup': ('A', '10:33'), 'execucao': ('no ponto', '10:48')}},
                {'e': '10:52', 'a': 'MNQ', 'l': 'V', 'q': 1, 'pe': '25684.00', 'x': [(1, '25651.75', '10:58', 'final')], 'stop': '30', 'alvo': '60', 'stopEm': '10:52',
                 'movs': [('10:56', 'be', '25684.00', '30')], 'src': 'app', 'mk': {'setup': ('B', '10:52')}},
                {'e': '11:09', 'a': 'MES', 'l': 'C', 'q': 3, 'pe': '7931.25', 'x': [(3, '7923.75', '11:16', 'final')], 'src': 'app',
                 'mk': {'setup': ('C', '11:09'), 'execucao': ('tarde', '11:28')}},
            ]
            antes = {'txt': 'Esperar Nova York assentar. Vender só abaixo da VWAP.', 'nota': 'anotado às 09:38, antes da 1ª entrada'}
        else:
            src = 'arq' if d in so_arquivo else 'app'
            for tent in range(40):
                sp = gera_fut(rng, d, rng.choice([2, 3, 3, 4, 4, 5]), src, be)
                r = monta_dia(c, d, sp, dict(ctx, revs=[]))
                if r['_pior'] < 26000 and not r['hit']:
                    break
            if src == 'app' and d not in pendentes:
                ult = max(hm_min(s['x'][-1][2]) for s in sp)
                hm = f'{(ult + 20) // 60:02d}:{(ult + 20) % 60:02d}'
                r0 = monta_dia(c, d, sp, dict(ctx, revs=[]))
                seg = 'Sim' if r0['fora'] == 0 else 'Em parte'
                levar = 'Parcial no +8, stop na entrada.' if d == '2026-11-09' else rng.choice(TXT_LEVAR)
                revs = [revisao(c, d, sp, hm, rng.choice(TXT_FUNC), rng.choice(TXT_DIF), seg, levar, ctx)]
            if src == 'app' and rng.random() < 0.5:
                pe = min(hm_min(s['e']) for s in sp)
                hm = pe - rng.randint(15, 35)
                antes = {'txt': rng.choice(TXT_ANTES), 'nota': f'anotado às {hm // 60:02d}:{hm % 60:02d}, antes da 1ª entrada'}
        if d == '2026-10-23':
            ctx['versao'] = ['Até 09:40 valia a versão 1: sem regra de breakeven.']
        ctx['revs'] = revs
        ctx['antes'] = antes
        specs_de[d] = sp
        dias[d] = monta_dia(c, d, sp, ctx)
    # «Hoje» at 12 nov 10:42 ET: the second trade still open, after its partial
    sp12 = [dict(s) for s in specs_de['2026-11-12']]
    sp12[1] = dict(sp12[1], x=[sp12[1]['x'][0]])
    hoje12 = monta_dia(c, '2026-11-12', sp12, {'arq': None, 'be': True, 'antes': {'txt': 'Só compro acima da VWAP; parcial no +8.', 'nota': 'anotado às 09:40, antes da 1ª entrada'}, 'revs': []})
    variante = monta_dia(c, '2026-11-19', specs_de['2026-11-19'], {'arq': '2026-11-25', 'be': True, 'modo': 'avisa', 'revs': dias['2026-11-19']['rev']})
    return dias, specs_de, hoje12, variante


LUCID_1DEZ = [{'e': '10:12', 'a': 'MNQ', 'l': 'V', 'q': 2, 'pe': '25668.00', 'x': [(2, '25692.00', '10:20', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:12')}},
              {'e': '10:41', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '7934.00', 'x': [(1, '7940.25', '10:47', 'final')], 'src': 'app', 'mk': {'setup': ('C', '10:41')}}]
LUCID_ABONTEM = {'txt': '1 operação aberta de ontem: MNQ · Compra · 1 ct.', 'dia': '2026-11-30', 'link': 'Abrir 30 nov'}


def lucid(top_dias, top_specs):
    c = CONTAS['lucid']
    rng = random.Random(77)
    dias = {}
    for d in dias_uteis('2026-11-02', '2026-12-01'):
        if d in ('2026-11-11', '2026-11-26'):
            continue
        arq = arquivo_de(d, ARQ_TOP[3:])
        ext = evs(top_dias[d]) if d in top_dias else []
        ctx = {'arq': arq, 'be': False, 'ext': ext}
        revs = []
        if d == '2026-11-30':
            sp = [{'e': '10:21', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '7968.50', 'x': [(1, '7962.75', '10:33', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:21')}},
                  {'e': '10:52', 'a': 'MNQ', 'l': 'C', 'q': 1, 'pe': '25702.00', 'x': [], 'src': 'app', 'stop': '40', 'alvo': '80', 'stopEm': '10:52', 'mk': {'setup': ('A', '10:52')}}]
        elif d == '2026-12-01':
            sp = LUCID_1DEZ
            ctx['abOntem'] = LUCID_ABONTEM
        else:
            if rng.random() < 0.35:
                continue
            for tent in range(40):
                sp = gera_fut(rng, d, rng.choice([1, 2, 2, 3]), 'app', False)
                r = monta_dia(c, d, sp, dict(ctx, revs=[]))
                if r['_pior'] < 24000 and not r['hit']:
                    break
            if rng.random() < 0.7:
                ult = max(hm_min(s['x'][-1][2]) for s in sp)
                hm = f'{(ult + 25) // 60:02d}:{(ult + 25) % 60:02d}'
                top_sp = top_specs.get(d, [])
                revs = [revisao(c, d, sp, hm, rng.choice(TXT_FUNC), rng.choice(TXT_DIF), 'Sim', rng.choice(TXT_LEVAR), ctx,
                                ext_ate=lambda h, d=d, top_sp=top_sp: eventos_ate(CONTAS['top'], d, top_sp, h))]
        ctx['revs'] = revs
        dias[d] = monta_dia(c, d, sp, ctx)
    return dias


def ylos():
    c = CONTAS['ylos']
    rng = random.Random(9)
    dias = {}
    for d in dias_uteis('2026-09-15', '2026-10-30'):
        if rng.random() < 0.45:
            continue
        sp = gera_fut(rng, d, rng.choice([1, 2, 3]), 'hist', False, marcar=False)
        dias[d] = monta_dia(c, d, sp, {'impHist': '2026-10-31'})
    return dias


def ebinex():
    c = CONTAS['ebx']
    rng = random.Random(1500)
    dias = {}
    arqs = [('2026-10-27', '2026-10-26'), ('2026-11-10', '2026-11-09')]
    for d in dias_uteis('2026-09-08', '2026-11-11', todos=True):
        wd = D(d).weekday()
        if d < '2026-10-14':
            if wd >= 5 or rng.random() < 0.3:
                continue
            sp = gera_bin(rng, d, rng.choice([2, 3, 4]), 'hist')
            dias[d] = monta_dia(c, d, sp, {'impHist': '2026-10-13'})
            continue
        ctx = {'arq': arquivo_de(d, arqs), 'be': False}
        revs, antes = [], None
        if d == '2026-10-17':
            sp = [{'e': '20:14', 'bin': {'par': 'EUR/USD', 'dir': 'A', 'exp': 5, 'stake': '20', 'payout': 88, 'res': 'perda'}, 'src': 'app', 'mk': {'setup': ('C', '20:14')}}]
        elif wd >= 5:
            continue
        elif d == '2026-11-11':
            sp = [
                {'e': '20:10', 'bin': {'par': 'EUR/USD', 'dir': 'A', 'exp': 1, 'stake': '20', 'payout': 88, 'res': 'ganho'}, 'src': 'app',
                 'mk': {'setup': ('A', '20:10'), 'emocao': ('Calmo', '20:10')}},
                {'e': '20:31', 'bin': {'par': 'GBP/USD', 'dir': 'B', 'exp': 5, 'stake': '20', 'payout': 86, 'res': 'devolvida'}, 'src': 'app', 'mk': {'setup': ('B', '20:31')}},
                {'e': '20:44', 'bin': {'par': 'EUR/USD', 'dir': 'B', 'exp': 15, 'stake': '25', 'payout': 85, 'res': 'perda'}, 'src': 'app',
                 'mk': {'setup': ('B', '20:44'), 'execucao': ('tarde', '21:05')}},
                {'e': '21:12', 'bin': {'par': 'EUR/USD', 'dir': 'B', 'exp': 15, 'stake': '25', 'payout': 85, 'res': None}, 'src': 'app', 'mk': {'setup': ('C', '21:12')}},
            ]
            antes = {'txt': 'Só a favor da tendência de 15 min.', 'nota': 'anotado às 19:52, antes da 1ª entrada'}
        else:
            if rng.random() < 0.3:
                continue
            src = 'arq' if d in ('2026-10-21', '2026-11-04') else 'app'
            sp = gera_bin(rng, d, rng.choice([2, 3, 4, 5]), src)
            if src == 'app' and rng.random() < 0.65:
                ult = max(hm_min(vela(s['e'], s['bin']['exp'])[1]) for s in sp)
                hm = f'{(ult + 12) // 60:02d}:{(ult + 12) % 60:02d}'
                revs = [revisao(c, d, sp, hm, rng.choice(TXT_BIN_FUNC), rng.choice(TXT_DIF[:3] + ['']), rng.choice(['Sim', 'Em parte']), rng.choice(TXT_BIN_LEVAR), ctx)]
        ctx['revs'] = revs
        ctx['antes'] = antes
        dias[d] = monta_dia(c, d, sp, ctx)
    return dias


def binance():
    c = CONTAS['bin']
    rng = random.Random(321)
    dias = {}
    for d in dias_uteis('2026-10-13', '2026-11-14', todos=True):
        ctx = {'arq': None, 'be': False}
        revs, antes = [], None
        if d == '2026-11-14':
            sp = [{'e': '20:35', 'a': 'BTC/USDT', 'l': 'V', 'q': '0.25', 'pe': '98450.00', 'x': [('0.25', '97600.00', '21:02', 'final')], 'src': 'app',
                   'mk': {'setup': ('A', '20:35'), 'emocao': ('Confiante', '20:36')}},
                  {'e': '21:15', 'a': 'ETH/USDT', 'l': 'C', 'q': '1.5', 'pe': '3612.40', 'x': [], 'src': 'app', 'mk': {'setup': ('B', '21:15')}}]
            antes = {'txt': 'Só vender BTC abaixo da mínima de sexta.', 'nota': 'anotado às 19:48, antes da 1ª entrada'}
        else:
            if rng.random() < 0.45:
                continue
            sp = gera_cri(rng, d, rng.choice([1, 1, 2]))
            if rng.random() < 0.6:
                ult = max(hm_min(s['x'][-1][2]) for s in sp)
                hm = f'{min(ult + 15, 23 * 60 + 50) // 60:02d}:{min(ult + 15, 23 * 60 + 50) % 60:02d}'
                revs = [revisao(c, d, sp, hm, 'Esperei o rompimento da faixa da tarde.', rng.choice(['', 'Não operaria depois das 22:00.']), 'Sim', 'Nada depois das 22:00.', ctx)]
        ctx['revs'] = revs
        ctx['antes'] = antes
        dias[d] = monta_dia(c, d, sp, ctx)
    return dias


def clear():
    c = CONTAS['clear']
    rng = random.Random(55)
    dias = {}
    for d in dias_uteis('2026-10-13', '2026-11-12'):
        ctx = {'arq': None, 'be': False}
        revs, antes = [], None
        if d == '2026-11-12':
            sp = [{'e': '10:05', 'a': 'WIN', 'l': 'V', 'q': 3, 'pe': '128450', 'x': [(3, '128750', '10:14', 'final')], 'src': 'app', 'mk': {'setup': ('B', '10:05')}},
                  {'e': '10:32', 'a': 'WIN', 'l': 'C', 'q': 2, 'pe': '128600', 'x': [(2, '128825', '10:40', 'final')], 'src': 'app', 'mk': {'setup': ('A', '10:32')}}]
            antes = {'txt': 'WIN só a favor do primeiro rompimento.', 'nota': 'anotado às 09:51, antes da 1ª entrada'}
        else:
            if rng.random() < 0.4:
                continue
            for tent in range(40):
                sp = gera_b3(rng, d, rng.choice([1, 2, 3]))
                r = monta_dia(c, d, sp, dict(ctx, revs=[]))
                if r['_pior'] < 40000 and not r['hit']:
                    break
            if rng.random() < 0.6:
                ult = max(hm_min(s['x'][-1][2]) for s in sp)
                hm = f'{(ult + 20) // 60:02d}:{(ult + 20) % 60:02d}'
                revs = [revisao(c, d, sp, hm, 'Esperei o primeiro recuo no WIN.', '', 'Sim', 'Só a favor do primeiro rompimento.', ctx)]
        ctx['revs'] = revs
        ctx['antes'] = antes
        dias[d] = monta_dia(c, d, sp, ctx)
    return dias


# ------------------------------------------------------------------------------------------------ Muitas contas (scenario 9b)
# A trader with 30 futures prop accounts (Top One, Lucid 50k and Ylos 50k among them) plus the board's other markets, on
# 1º dez at 11:35 ET. The invented accounts were added on 16 nov and only a few traded today; Apex 50k #5 and #6 copied the
# same three MNQ trades and reached their limit. Lucid 50k sums every active futures account, so these trades enter its
# limit too (gate.md §4.3: «somando» is all of the owner's active futures accounts).
JAN_MESA = {'manha': ((570, 720), '09:30–12:00 ET'), 'pregao': ((570, 960), '09:30–16:00 ET'), 'hora': ((600, 660), '10:00–11:00 ET')}
RELOGIO_FUT = 'O pregão de futuros vai das 18:00 da véspera às 17:00 ET.'


def conta_mesa(id, nome, mesa, fase, jan, lim):
    base = dict(id=id, nome=nome, mesa=mesa, mk='fut', grupo='Futuros', fase=fase, rel='ET', suf=' ET', moeda='US$', diasJan='util',
                limModo='encerra', soma=False, be=None, beN=None, comissao=True, cols=5, giro=18 * 60, relogioDia=RELOGIO_FUT)
    if jan is None:
        return Conta(jan=None, janPlano='', janLinha='Sem janela salva', lim=None, desde=None, desdeHM=None, **base)
    j, txt = JAN_MESA[jan]
    return Conta(jan=j, janPlano=txt, janLinha='Janela ' + txt, lim=lim, desde='2026-11-16', desdeHM='08:30', **base)


MESAS = [
    ('alp1', 'Alpha 50k #1', 'Alpha Futures', 'Avaliação', 'manha', 50000),
    ('alp2', 'Alpha 50k #2', 'Alpha Futures', 'Avaliação', 'manha', 50000),
    ('alp3', 'Alpha 50k #3', 'Alpha Futures', 'Avaliação', 'manha', 50000),
    ('apx1', 'Apex 50k #1', 'Apex', 'Financiada', 'manha', 50000),
    ('apx2', 'Apex 50k #2', 'Apex', 'Financiada', 'manha', 50000),
    ('apx3', 'Apex 50k #3', 'Apex', 'Financiada', 'manha', 50000),
    ('apx4', 'Apex 50k #4', 'Apex', 'Financiada', 'manha', 50000),
    ('apx5', 'Apex 50k #5', 'Apex', 'Avaliação', 'manha', 50000),
    ('apx6', 'Apex 50k #6', 'Apex', 'Avaliação', 'manha', 50000),
    ('apxc1', 'Apex 100k #1', 'Apex', 'Avaliação', 'pregao', 100000),
    ('apxc2', 'Apex 100k #2', 'Apex', 'Avaliação', 'pregao', 100000),
    ('apxc3', 'Apex 100k #3', 'Apex', 'Avaliação', 'pregao', 100000),
    ('lucid', None, 'Lucid', None, None, None),
    ('luc2', 'Lucid 50k #2', 'Lucid', 'Avaliação', 'manha', 40000),
    ('luc3', 'Lucid 50k #3', 'Lucid', 'Avaliação', 'manha', 40000),
    ('luc100', 'Lucid 100k', 'Lucid', 'Avaliação', 'manha', 80000),
    ('mff1', 'MFFU 50k #1', 'My Funded Futures', 'Financiada', 'pregao', 50000),
    ('mff2', 'MFFU 50k #2', 'My Funded Futures', 'Financiada', 'pregao', 50000),
    ('mff3', 'MFFU 50k #3', 'My Funded Futures', 'Financiada', 'pregao', 50000),
    ('top', None, 'Top One', None, None, None),
    ('tps1', 'Topstep 50k #1', 'Topstep', 'Financiada', 'hora', 50000),
    ('tps2', 'Topstep 50k #2', 'Topstep', 'Financiada', 'hora', 50000),
    ('tps3', 'Topstep 50k #3', 'Topstep', 'Avaliação', 'hora', 50000),
    ('tps4', 'Topstep 50k #4', 'Topstep', 'Avaliação', 'hora', 50000),
    ('tps150', 'Topstep 150k', 'Topstep', 'Financiada', 'hora', 150000),
    ('tfy1', 'Tradeify 50k #1', 'Tradeify', 'Avaliação', 'manha', 60000),
    ('tfy2', 'Tradeify 50k #2', 'Tradeify', 'Avaliação', 'manha', 60000),
    ('tfy3', 'Tradeify 50k #3', 'Tradeify', 'Avaliação', 'manha', 60000),
    ('tfy4', 'Tradeify 50k #4', 'Tradeify', 'Avaliação', None, None),
    ('ylos', None, 'Ylos', None, None, None),
]
for (_id, _nome, _mesa, _fase, _jan, _lim) in MESAS:
    if _id not in CONTAS:
        CONTAS[_id] = conta_mesa(_id, _nome, _mesa, _fase, _jan, _lim)
# the world of scenario 9b: futures by firm (alphabetical), then the board's other markets
MERCADOS_MUITAS = [['Futuros', [x[0] for x in MESAS]], ['Opções binárias', ['ebx']], ['Forex', ['ftmo']], ['Ações', ['ibkr']],
                   ['Cripto', ['bin']], ['B3', ['clear']]]
ORDEM_MUITAS = [k for _m, ks in MERCADOS_MUITAS for k in ks]
NOVAS = [x[0] for x in MESAS if x[1]]

_APEX_COPIA = [
    {'e': '09:41', 'a': 'MNQ', 'l': 'V', 'q': 2, 'pe': '25690.00', 'x': [(2, '25718.50', '09:49', 'final')], 'src': 'app', 'stop': '30', 'alvo': '60', 'stopEm': '09:41',
     'mk': {'setup': ('B', '09:41')}},
    {'e': '10:13', 'a': 'MNQ', 'l': 'V', 'q': 2, 'pe': '25670.00', 'x': [(2, '25690.75', '10:19', 'final')], 'src': 'app', 'mk': {'setup': ('C', '10:13'), 'emocao': ('Ansioso', '10:14')}},
    {'e': '10:28', 'a': 'MNQ', 'l': 'C', 'q': 4, 'pe': '25705.50', 'x': [(4, '25667.25', '10:41', 'final')], 'src': 'app', 'mk': {'setup': ('C', '10:28'), 'emocao': ('Frustrado', '10:29')}},
]
HOJE_MESAS = {
    'apx1': [{'e': '09:52', 'a': 'MES', 'l': 'C', 'q': 2, 'pe': '7940.25', 'x': [(2, '7946.75', '10:03', 'final')], 'src': 'app', 'mk': {'setup': ('A', '09:52')}}],
    'apx5': _APEX_COPIA,
    'apx6': _APEX_COPIA,
    'luc2': [{'e': '10:33', 'a': 'MES', 'l': 'V', 'q': 1, 'pe': '7938.50', 'x': [(1, '7929.00', '10:49', 'final')], 'src': 'app', 'stop': '12', 'alvo': '24', 'stopEm': '10:33',
              'mk': {'setup': ('A', '10:33')}}],
    'tfy1': [{'e': '11:02', 'a': 'MNQ', 'l': 'V', 'q': 1, 'pe': '25660.00', 'x': [(1, '25671.50', '11:10', 'final')], 'src': 'app', 'mk': {'setup': ('B', '11:02')}}],
    'mff1': [{'e': '11:18', 'a': 'MES', 'l': 'C', 'q': 1, 'pe': '7926.00', 'x': [(1, '7933.25', '11:29', 'final')], 'src': 'app', 'mk': {'setup': ('B', '11:18')}}],
}


def mesas(top_dias):
    """The invented accounts' days (only 1º dez) and Lucid 50k's 1º dez summing all 30 futures accounts"""
    dias = {k: {} for k in NOVAS}
    for k, sp in HOJE_MESAS.items():
        dias[k]['2026-12-01'] = monta_dia(CONTAS[k], '2026-12-01', sp, {'arq': None, 'be': False, 'revs': []})
    ext = evs(top_dias['2026-12-01']) + [ev for k in HOJE_MESAS for ev in evs(dias[k]['2026-12-01'])]
    lucid_hoje = monta_dia(CONTAS['lucid'], '2026-12-01', LUCID_1DEZ,
                           {'arq': arquivo_de('2026-12-01', ARQ_TOP[3:]), 'be': False, 'ext': ext, 'abOntem': LUCID_ABONTEM, 'revs': []})
    return dias, lucid_hoje
