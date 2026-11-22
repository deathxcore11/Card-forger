#!/usr/bin/env python3
"""Shrinks the Lost Memories art folder to console size and console colour.

    python3 tools/crucible/console-art.py <art dir>

Reads the pictures the playable ships with (<art dir>/*.webp and the card sheets in <art dir>/s/) and writes
<art dir>/c/ : every picture at the size it is drawn in the 512 x 240 frame, cut to a palette of 16 or 256 colours
with the console's 4 x 4 dither and 15-bit colour (five bits a channel). Neither folder lives in the repository.

Sizes are the ones in the asset book: rooms 352 x 144, portraits 64 and 96, medallions 32 and 24, a door 80 x 72,
a card picture 40 and 96, the card back 44 x 60, the table top 128 x 128.
"""
import os, sys, json
import numpy as np
from PIL import Image

BAYER = np.array([[-4, 0, -3, 1], [2, -2, 3, -1], [-3, 1, -4, 0], [3, -1, 2, -2]], dtype=np.float32)  # the console's own table


def crunch(im, size, colors, amp=1.0, key=False, box=None):
    """Resize, dither with the 4 x 4 table, cut to `colors` colours, snap to five bits a channel."""
    im = im.convert('RGBA')
    if box:
        im = im.crop(box)
    im = im.resize(size, Image.LANCZOS, reducing_gap=3.0)
    a = np.asarray(im).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3]
    h, w = alpha.shape
    solid = alpha >= 128
    # the palette is chosen from the undithered picture, as an artist would pick it
    flat = Image.fromarray(np.where(solid[..., None], rgb, 0).astype(np.uint8), 'RGB')
    pal_img = flat.quantize(colors=colors - (1 if key else 0), method=Image.FASTOCTREE, dither=Image.NONE)
    pal = np.array(pal_img.getpalette()[:3 * colors], dtype=np.float32).reshape(-1, 3)
    pal = np.unique((np.clip(pal, 0, 255).astype(np.uint8) & 0xF8), axis=0).astype(np.float32)
    tile = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w] * (8.0 * amp)
    d = np.clip(rgb + tile[..., None], 0, 255)
    # nearest palette colour for every pixel
    idx = np.argmin(((d[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1), axis=2)
    out = pal[idx].astype(np.uint8)
    res = np.dstack([out, np.where(solid, 255, 0).astype(np.uint8)])
    if not key:
        res[..., 3] = 255
    return Image.fromarray(res, 'RGBA')


def save(im, path):
    im.save(path, 'PNG', optimize=True)


def main():
    art = sys.argv[1]
    out = os.path.join(art, 'c')
    os.makedirs(out, exist_ok=True)
    names = sorted(f[:-5] for f in os.listdir(art) if f.endswith('.webp'))
    made = []
    op = lambda n: Image.open(os.path.join(art, n + '.webp'))

    for n in names:
        im = op(n)
        w, h = im.size
        if n.startswith('hall-'):
            # the middle band of a 16:9 room picture, 352 x 144. Chambers keep the lintel and the steps; duel halls keep the far wall.
            bh = round(w * 144 / 352)
            top = round(h * (0.08 if n.startswith('hall-doors') else 0.0))
            save(crunch(im, (352, 144), 256, amp=0.6, box=(0, top, w, top + bh)), os.path.join(out, n + '.png'))
        elif n.startswith('door-'):
            save(crunch(im, (80, 72), 256, amp=0.6, key=True), os.path.join(out, n + '.png'))
            # the two carved leaves alone, to stand in a niche of the chamber picture (62 x 68 there)
            save(crunch(im, (62, 68), 256, amp=0.6, box=(round(w * .236), round(h * .165), round(w * .764), round(h * .79))), os.path.join(out, n + '-leaf.png'))
            made.append(n + '-leaf')
        elif n == 'key-crest':
            # struck gold on black: black becomes the see-through colour
            g = im.convert('RGBA'); a = np.asarray(g).copy(); a[..., 3] = np.where(a[..., :3].max(-1) < 40, 0, 255); g = Image.fromarray(a, 'RGBA')
            for sz in (48, 16, 96):
                save(crunch(g, (sz, sz), 16, amp=0.8, key=True), os.path.join(out, f'{n}-{sz}.png')); made.append(f'{n}-{sz}')
            continue
        elif n == 'key-title':
            bh = round(w * 240 / 512); top = max(0, round((h - bh) / 2))
            save(crunch(im, (512, 240), 256, amp=0.6, box=(0, top, w, top + bh)), os.path.join(out, n + '.png'))
        elif n.startswith('face-'):
            save(crunch(im, (64, 64), 256, amp=0.5), os.path.join(out, n + '.png'))
            save(crunch(im, (96, 96), 256, amp=0.5), os.path.join(out, n + '-96.png'))
            made.append(n + '-96')
        elif n.startswith('relic-') or n.startswith('masterwork-'):
            save(crunch(im, (32, 32), 16, amp=1.0, key=True), os.path.join(out, n + '.png'))
            save(crunch(im, (24, 24), 16, amp=1.0, key=True), os.path.join(out, n + '-24.png'))
            made.append(n + '-24')
        elif n == 'cardback':
            save(crunch(im, (44, 60), 16, amp=1.0), os.path.join(out, n + '.png'))
        elif n == 'sand':
            save(crunch(im, (128, 128), 16, amp=1.5), os.path.join(out, 'table.png'))
            made.append('table')
            continue
        elif n in ('zone-m', 'zone-st', 'chain'):
            continue
        else:
            continue
        made.append(n)

    # where the two leaves of a door are, measured on the picture of the open door
    if 'door-duel-open' in names:
        a = np.asarray(crunch(op('door-duel-open'), (80, 72), 256, key=True)).astype(int)
        dark = (a[..., :3].sum(-1) < 60) & (a[..., 3] > 0)
        ys, xs = np.nonzero(dark[8:64, 16:64])
        leaf = [int(xs.min()) + 16, int(ys.min()) + 8, int(xs.max()) + 17, int(ys.max()) + 9] if len(xs) else [28, 18, 52, 54]
    else:
        leaf = [28, 18, 52, 54]

    # card pictures: sheets of 100, ten by ten, in pool order, at 40 and at 96
    sdir = os.path.join(art, 's')
    sheets = 0
    if os.path.isdir(sdir) and os.environ.get('CARD_SHEETS'):
        files = sorted((f for f in os.listdir(sdir) if f.endswith('.webp')), key=lambda f: int(f[:-5]))
        for f in files:
            sh = Image.open(os.path.join(sdir, f)).convert('RGB')
            cw, ch = sh.size[0] // 10, sh.size[1] // 10
            for size, tag in ((40, 's40'), (96, 's96')):
                big = Image.new('RGB', (size * 10, size * 10))
                for k in range(100):
                    cell = sh.crop(((k % 10) * cw, (k // 10) * ch, (k % 10 + 1) * cw, (k // 10 + 1) * ch))
                    if not cell.getbbox():
                        continue
                    big.paste(crunch(cell, (size, size), 256, amp=0.5).convert('RGB'), ((k % 10) * size, (k // 10) * size))
                big.save(os.path.join(out, f'{tag}-{f[:-5]}.png'), 'PNG', optimize=True)
            sheets += 1

    json.dump({'art': sorted(made), 'leaf': leaf, 'sheets': sheets}, open(os.path.join(out, 'index.json'), 'w'))
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print(f'{len(made)} pictures, {sheets} card sheets, door leaves at {leaf}, {total // 1024} KB in {out}')


if __name__ == '__main__':
    main()
