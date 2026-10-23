import subprocess, sys, os, re, shutil, json
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
BASE = os.path.dirname(os.path.abspath(__file__))
R = os.path.join(BASE, 'r')
FONTS = ("@font-face{font-family:'Comfortaa';src:url('Comfortaa-VariableFont_wght.ttf') format('truetype');font-weight:300 700}"
         "@font-face{font-family:'Poly';src:url('Poly-Regular.ttf') format('truetype')}")
def copia(board_file, cen, tema, nome, medir):
    s = open(board_file, encoding='utf-8').read()
    s = re.sub(r'<link href="https://fonts.googleapis.com[^>]*>', '', s)
    s = s.replace('<style>\nbody{margin:0', '<style>\n' + FONTS + '\nbody{margin:0', 1)
    s = re.sub(r'"cenPadrao":"[^"]+"', '"cenPadrao":"%s"' % cen, s)
    s = re.sub(r',"rolar":"[a-z]+"', '', s)
    if tema and tema.startswith('cel'):
        s = s.replace("classeCasca: C.celular ? 'celular' : ''", "classeCasca: 'celular'")
        tema = tema[4:] or None
    if tema:
        s = s.replace("tema: C.tema || 'claro'", "tema: '%s'" % tema)
    if medir:
        s = s.replace('</body>', '<script>setTimeout(function(){document.title="H="+document.documentElement.scrollHeight;},2500)</script></body>')
    p = os.path.join(R, nome)
    open(p, 'w', encoding='utf-8').write(s)
    return p
def chrome(args):
    ud = os.path.join(R, 'ud')
    shutil.rmtree(ud, ignore_errors=True)
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
           '--host-resolver-rules=MAP * ~NOTFOUND', '--user-data-dir=' + ud, '--allow-file-access-from-files', '--virtual-time-budget=6000'] + args
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    shutil.rmtree(ud, ignore_errors=True)
    return out.stdout
def render(board_file, cen, w, tema=None, out=None, h=None, y=0):
    p = copia(board_file, cen, tema, f'm_{cen}.html', True)
    dom = chrome(['--window-size=%d,700' % w, '--dump-dom', 'file://' + p])
    mm = re.search(r'<title>H=(\d+)</title>', dom)
    hh = int(mm.group(1)) if mm else 4000
    os.remove(p)
    if out:
        p = copia(board_file, cen, tema, f's_{cen}.html', False)
        if y:
            s = open(p, encoding='utf-8').read().replace('</head>', '<style>html body{margin-top:-%dpx !important}</style></head>' % y)
            open(p, 'w', encoding='utf-8').write(s)
        chrome(['--window-size=%d,%d' % (w, h or hh), '--screenshot=' + out, 'file://' + p])
        os.remove(p)
    return hh, dom
def render375(board_file, cen, tema, out, h, y=0):
    """A true 375 px layout: headless Chrome will not lay out a window narrower than ~500 px (a 375 window is cropped,
    not reflowed), so the copy is zoomed 2x in a 750 px window and the screenshot is scaled back to 375 px with sips"""
    p = copia(board_file, cen, tema, f'z_{cen}.html', False)
    s = open(p, encoding='utf-8').read()
    extra = '<style>html{zoom:2}' + ('html body{margin-top:-%dpx !important}' % y if y else '') + '</style></head>'
    open(p, 'w', encoding='utf-8').write(s.replace('</head>', extra))
    big = out + '.2x.png'
    chrome(['--window-size=750,%d' % (2 * h), '--screenshot=' + big, 'file://' + p])
    os.remove(p)
    subprocess.run(['sips', '--resampleWidth', '375', big, '--out', out], capture_output=True)
    os.remove(big)
if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '375':
        # python3 render.py 375 <board> <cen> <tema|-> <out.png> <h> [y]
        render375(sys.argv[2], sys.argv[3], None if sys.argv[4] == '-' else sys.argv[4], sys.argv[5], int(sys.argv[6]), int(sys.argv[7]) if len(sys.argv) > 7 else 0)
        sys.exit(0)
    bf, cen, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
    tema = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != '-' else None
    out = sys.argv[5] if len(sys.argv) > 5 else None
    hmax = int(sys.argv[6]) if len(sys.argv) > 6 else None
    y = int(sys.argv[7]) if len(sys.argv) > 7 else 0
    hh, dom = render(bf, cen, w, tema, out, hmax, y)
    print('height', hh)
    open(os.path.join(R, 'dom.html'), 'w').write(dom)
