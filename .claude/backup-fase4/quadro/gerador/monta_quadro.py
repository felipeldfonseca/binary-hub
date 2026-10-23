import json, sys, subprocess
TIT = {'dez': 'Diário enxuto · 1º de dezembro', 'hoje': 'Diário enxuto · hoje e os outros mercados'}
ARQ = {'dez': 'DiarioDezEnxuto.dc.html', 'hoje': 'DiarioHojeEnxuto.dc.html'}
def monta(board, h, destino):
    tpl = open('template.html', encoding='utf-8').read()
    eng = open('engine.js', encoding='utf-8').read()
    data = open(f'data_{board}.json', encoding='utf-8').read()
    assert '</script' not in data
    eng = eng.replace('/*__DATA__*/null', data)
    out = tpl.replace('__TITLE__', TIT[board]).replace('__PREVIEW_H__', str(h)).replace('/*__ENGINE__*/', eng)
    open(destino, 'w', encoding='utf-8').write(out)
    return len(out.encode('utf-8'))
if __name__ == '__main__':
    import os
    hs = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {'dez': 4200, 'hoje': 3700}
    dest = sys.argv[2] if len(sys.argv) > 2 else '.'
    for b in ('dez', 'hoje'):
        print(b, monta(b, hs[b], os.path.join(dest, ARQ[b])))
