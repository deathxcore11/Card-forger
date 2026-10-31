#!/usr/bin/env python3
"""Measure where each figure really stands, from its idle frame's pixels, and write it into cast.json.
cx = centre of the lower body (feet, legs, robe hem, tail): life bar, block chip, aim ring and lethal skull centre here.
hx = centre of the head (top band of the silhouette): the intent chip sits here.
cw = width of the body (8th-92nd percentile of painted columns), so the life bar matches the figure, not its frame.
bx = [left, right] of the painting (1st-99th percentile), so the whole line keeps its paint on screen.
All three are fractions of the frame width (fw). Run after any atlas or cast.json change; content-check fails when they are stale."""
import json, os, sys
import numpy as np
from PIL import Image

def measure(path, e):
    im = Image.open(path).convert('RGBA')
    x0, y0 = e['frames'][e['idle']]
    a = np.array(im.crop((x0, y0, x0 + e['fw'], y0 + e['fh'])))[:, :, 3] > 60
    ys = np.where(a.any(1))[0]
    top, bot = int(ys.min()), int(ys.max())
    h = bot - top + 1
    low = a[bot - int(.35 * h):bot + 1]
    cx = np.nonzero(low)[1].mean() / e['fw']
    head = a[top:top + max(4, int(.12 * h))]
    hx = np.nonzero(head)[1].mean() / e['fw']
    cols = np.nonzero(a)[1]
    lo, hi = np.percentile(cols, [8, 92])
    cw = (hi - lo) / e['fw']
    b0, b1 = np.percentile(cols, [1, 99])
    return round(float(cx), 3), round(float(hx), 3), round(float(cw), 3), [round(float(b0) / e['fw'], 3), round(float(b1) / e['fw'], 3)]

def main(root):
    p = os.path.join(root, 'cast.json')
    d = json.load(open(p))
    miss = []
    for e in d:
        src = next((os.path.join(root, 'atlas', f"{e.get('file') or e['key']}.{x}") for x in ('webp', 'png') if os.path.exists(os.path.join(root, 'atlas', f"{e.get('file') or e['key']}.{x}"))), None)
        if not src:
            miss.append(e['key']); continue
        e['cx'], e['hx'], e['cw'], e['bx'] = measure(src, e)
    json.dump(d, open(p, 'w'), separators=(',', ':'))
    print(f'anchors: {len(d) - len(miss)} figures measured' + (f', no atlas: {miss}' if miss else ''))
    return 1 if miss else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else 'planeswalk-cast'))
