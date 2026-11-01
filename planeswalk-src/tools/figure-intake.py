#!/usr/bin/env python3
"""Add (or replace) one painted figure set in planeswalk-cast: atlas/<file>.webp, mask/<file>.webp and its cast.json row.
Usage: python3 -I planeswalk-src/tools/figure-intake.py <aligned set dir> <set name> '<json row fields>'
  The set dir holds <set>-<frame>.webp (one shared canvas per set, feet aligned) and manifest.json (size, foot, states).
  Row fields: key, act, game, name, rank, body, glow, acts, moves, defeat, cloth, head, note, and for an ally `scale`
  (= the hero's face size / this painting's face size), for a foe `k` (same rule). Anything else is copied as is.
Same packing as the roster build (frames 400 px tall, 4 px gutters, up to 3900 px a row) and the same motion mask
(R glow, G thin parts, B head). Run planeswalk-src/tools/cast-anchors.py afterwards (this script calls it)."""
import json, math, os, sys, subprocess
import numpy as np, cv2
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'planeswalk-cast')
FH = 400
ORDER = ['idle-1', 'cast-prep', 'attack', 'attack-follow', 'recover', 'hit', 'hit-recover', 'defeat-start', 'defeat-1', 'defeat-2',
         'phase2', 'phase3', 'rally', 'blink', 'pull', 'uncrewed']

def blur(x, r): return np.asarray(Image.fromarray((np.clip(x, 0, 1) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
def mm(x, k, f): return np.asarray(Image.fromarray((np.clip(x, 0, 1) * 255).astype('uint8')).filter(f(k))).astype(np.float32) / 255

def glowmask(a, kind):
    r, g, b = [a[..., i].astype(np.float32) for i in range(3)]; al = a[..., 3] / 255.; lum = (r * .3 + g * .59 + b * .11) / 255
    if kind in ('warm', 'holy'):
        mx = np.maximum(np.maximum(r, g), b); sat = (mx - np.minimum(np.minimum(r, g), b)) / np.maximum(mx, 1)
        m = (mx > 228) & (sat > .38) & (r >= g) & (g > b) & (al > .2)
        n, lab, st, _ = cv2.connectedComponentsWithStats(m.astype('uint8'), 8); fig = (al > .3).sum()
        m = m & ~np.isin(lab, [k for k in range(1, n) if st[k, 4] >= fig * .03 or st[k, 4] < 3])
    elif kind == 'green': m = (g > 165) & (g > r * 1.15) & (g > b * 1.2) & (lum > .45)
    elif kind == 'cool': m = (b > 175) & (b > r * 1.2) & (lum > .48)
    elif kind == 'violet': m = (b > 140) & (r > 110) & (g < r * .8) & (g < b * .75) & (lum > .38)
    else: return np.zeros_like(al)
    return blur(mm((m & (al > .2)).astype(np.float32), 9, ImageFilter.MaxFilter), 6)

def main(D, name, row):
    man = json.load(open(os.path.join(D, 'manifest.json')))[name]
    W, H = man['size']; fx, fy = man['foot']; st = man['states']
    names = [f for f in ORDER if f in st and os.path.exists(os.path.join(D, f'{name}-{f}.webp'))]
    if 'idle-1' not in names: names = ['idle'] + names
    fw = round(W * FH / H); cw, ch = fw + 4, FH + 4; cols = max(1, min(len(names), 3900 // cw)); rows = math.ceil(len(names) / cols)
    atlas = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 0)); fr = {}
    imgs = {f: Image.open(os.path.join(D, f'{name}-{f}.webp')).convert('RGBA').resize((fw, FH), Image.LANCZOS) for f in names}
    for i, f in enumerate(names):
        x, y = (i % cols) * cw + 2, (i // cols) * ch + 2; atlas.alpha_composite(imgs[f], (x, y)); fr[f] = [x, y]
    file = row.pop('file', None) or name
    atlas.save(os.path.join(ROOT, 'atlas', f'{file}.webp'), quality=80)
    idle = names[0]; a = np.asarray(imgs[idle]); al = a[..., 3] / 255.; Hh, Ww = al.shape
    ys, xs = np.nonzero(al > .3); top, bot, lf, rt = ys.min(), ys.max(), xs.min(), xs.max()
    yy = np.arange(Hh)[:, None] * np.ones((1, Ww)); xx = np.arange(Ww)[None, :] * np.ones((Hh, 1))
    hover = row.get('body') in ('flyer', 'wisp')
    pin = np.clip((bot - (bot - top) * (.04 if hover else .16) - yy) / ((bot - top) * .1), 0, 1)
    core = mm(mm(al, 21, ImageFilter.MinFilter), 21, ImageFilter.MaxFilter); thin = blur(np.clip(al - core, 0, 1), 8)
    G = np.clip(thin * 1.5, 0, 1) * pin
    R = glowmask(a, row.get('glow', 'none')) * np.clip(pin + .3, 0, 1)
    if row.get('head') == 'front':
        fxp = lf + (rt - lf) * .4; B = np.clip((fxp - xx) / ((rt - lf) * .15), 0, 1) * np.clip((top + (bot - top) * .6 - yy) / ((bot - top) * .15), 0, 1)
    else: B = np.clip(1 - (yy - top) / ((bot - top) * .2), 0, 1)
    B = blur(B * (al > .05), 10)
    Image.fromarray((np.stack([R, G, B], -1) * 255).astype('uint8')).resize((fw // 2, FH // 2), Image.LANCZOS).save(os.path.join(ROOT, 'mask', f'{file}.webp'), quality=85)
    e = dict(row); e.update(fw=fw, fh=FH, aw=atlas.width, ah=atlas.height, frames=fr, idle=idle,
                            foot=[round(fx / W, 3), round(fy / H, 3)], top=round(top / FH, 3), glowArea=round(float((R > .3).mean()), 4))
    if file != e['key']: e['file'] = file
    p = os.path.join(ROOT, 'cast.json'); d = json.load(open(p))
    d = [x for x in d if x['key'] != e['key']] + [e]
    json.dump(d, open(p, 'w'), separators=(',', ':'))
    print(e['key'], names, atlas.size, os.path.getsize(os.path.join(ROOT, 'atlas', f'{file}.webp')) // 1024, 'KB')
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cast-anchors.py'), ROOT], check=False)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], json.loads(sys.argv[3]))
