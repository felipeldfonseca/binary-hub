import json, sys
d = json.load(open(sys.argv[1]))
for g in ['dist', 'setting', 'resolved', 'resolve', 'qty', 'favor', 'rOf', 'breakeven']:
    print('==', g)
    for c in d[g]['cases']:
        k = {x: c[x] for x in c if x not in ('expected', 'json', 'p', 'breakeven', 'exits', 'market_setting', 'own_setting')}
        print('  ', json.dumps(k)[:110], '=>', json.dumps(c['expected']))
print('== shape')
for c in d['shape']['cases']:
    print('  ', c['mode'], c['market'], c['label'], '=>', json.dumps(c['expected']))
