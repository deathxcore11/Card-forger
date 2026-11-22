#!/usr/bin/env python3
"""Shrinks the Lost Memories art folder to console size and console colour.

    python3 tools/crucible/console-art.py <art dir>

Reads the pictures the playable ships with (<art dir>/*.webp and the card sheets in <art dir>/s/) and writes
<art dir>/c/ : every picture at the size it is drawn in the frame (512 x 240 up to 640 x 480), cut to a palette of 16 or 256 colours
with the console's 4 x 4 dither and 15-bit colour (five bits a channel). Neither folder lives in the repository.

Sizes: rooms 352 x 198 and 440 x 248, the title 720 x 480, the logo 144 wide, portraits 48, 64 and 96, medallions 24, 32 and 64 (and a blank
medallion of each kind for items without a picture), a door 80 x 72, a card picture 40 and 96, the card back 44 x 60;
models' pictures (art/models/, the duel table's top 128 x 128 and stone 64 x 64) at their own size.
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


def blank_coin(kind, s):
    """A struck medallion with an empty face, drawn pixel by pixel, for an item that has no picture yet; the game stamps
    the item's first letter into the face. Gift: gold ring. Charm: copper ring. Masterwork: gold hexagon with studs."""
    gold = [(56, 32, 16), (136, 96, 40), (200, 152, 72), (232, 192, 104), (248, 224, 152)]
    copper = [(48, 24, 16), (120, 64, 32), (176, 104, 56), (216, 144, 88), (240, 184, 128)]
    ramp = copper if kind == 'c' else gold
    field = [(40, 20, 32), (64, 36, 52)]
    a = np.zeros((s, s, 4), dtype=np.uint8)
    c = (s - 1) / 2.0
    ring = max(2.0, s * 0.13)
    for y in range(s):
        for x in range(s):
            dx, dy = x - c, y - c
            if kind == 'm':  # a hexagon standing on a point: distance to its nearest edge, in the same units as a radius
                ax, ay = abs(dx), abs(dy)
                r = max(ax / 0.866, ax * 0.5 / 0.866 + ay)
            else:
                r = (dx * dx + dy * dy) ** 0.5
            R = s / 2.0 - 0.25
            if r > R:
                continue
            b = BAYER[y % 4, x % 4] / 8.0  # -0.5 .. 0.375
            if r > R - 1:
                col = ramp[0]
            elif r > R - ring:
                lit = -(dx + dy) / (max(r, 1e-6) * 1.4142)  # light from the top left
                k = int(np.clip(round(2 + lit * 1.4 + b), 1, 4))
                col = ramp[k]
            elif r > R - ring - 1:
                col = ramp[0]
            else:
                col = field[(x + y) % 2]
            a[y, x] = (*col, 255)
    if kind == 'm':  # four studs on the ring, as on the drawn masterworks
        for ang in (30, 150, 210, 330):
            t = np.radians(ang); px, py = c + np.cos(t) * (s / 2 - ring / 2 - 0.5), c + np.sin(t) * (s / 2 - ring / 2 - 0.5)
            for y in range(int(py - 1), int(py + 2)):
                for x in range(int(px - 1), int(px + 2)):
                    if 0 <= x < s and 0 <= y < s and (s >= 32 or (x == round(px) and y == round(py))):
                        a[y, x] = (*((152, 80, 168) if (x + y) % 2 else (104, 48, 128)), 255)
    a[..., :3] &= 0xF8
    return Image.fromarray(a, 'RGBA')


def save(im, path):
    im.save(path, 'PNG', optimize=True)


# The rooms painted on 22 November came out bright and evenly lit; the halls are dark with torchlight that falls away.
# This tones them to sit together: darker mid-tones, warm light, a fall-off toward the edges. The bare room stays cold.
GRADE = {'room-bare': (.86, .82, .88), 'room-bazaar': (1, .8, .62), 'room-forge': (1, .8, .62), 'room-omen': (1, .84, .7),
         'room-sanctum': (1, .8, .62), 'room-vault': (1, .8, .62)}


def grade(im, warm):
    a = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    h, w = a.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    d = np.sqrt(((x - w / 2) / (w * .62)) ** 2 + ((y - h * .55) / (h * .62)) ** 2)
    fall = np.clip(1.25 - d, .3, 1) ** 1.2
    a = (a ** 1.15) * np.array(warm, np.float32) * fall[..., None]
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


STORY_TOP = {'story-city': 0.04, 'story-oren': 0.45}  # keep the pyramid's top in the city; the man's head and the dropped tablet at the gate

# Randall's materials sheet (ui-materials.png: three by three squares with dark lines between them). Each part of the frame
# takes a square cut from inside one of his squares (clear of its carved edge), made to repeat without a seam, toned to
# the colour that part already had so the words on it read as before, and cut to a 64 x 64 picture of 16 colours (U4).
# name: (his square 1..9 reading across, left, top, side in his pixels inside that square, colour, spread)
MATS = {
    'st': (2, 40, 40, 256, (161, 120, 75), 9),     # the pillars: his carved brown stone, taken wide so its pits are grain
    'dk': (3, 120, 130, 190, (116, 79, 57), 12),     # round the view: his dark stone, toned brown
    'wn': (7, 20, 20, 140, (41, 17, 27), 6),       # every window and the text bar: his woven cloth, dark plum
    'lg': (7, 20, 20, 140, (98, 59, 72), 10),      # the ledge: the same cloth, dusty
    'pq': (9, 40, 40, 200, (161, 120, 75), 7),     # a plaque at rest, and the door's reading: his parchment, toned sandstone
    'lit': (8, 40, 60, 190, (169, 90, 52), 15),    # the lit plaque: his red leather, toned ember, and a brighter turn of it
    'lit2': (8, 40, 60, 190, (184, 104, 60), 15),
    'off': (3, 120, 130, 190, (60, 36, 44), 7),      # a plaque that cannot be used: his dark stone, darker than the ledge
    'on': (5, 40, 40, 200, (76, 138, 124), 12),    # a switch that is on: his verdigris
}
SHEET_AT = (0, 344, 686)  # where his three columns and rows start; each square is 338 wide


def seamless(a):
    """Make a square picture repeat without a seam: across first, then down. Near each edge it is faded into a copy
    moved by half its width, whose edges meet the picture's own middle, so the last column runs on into the first."""
    s = a.shape[0]; c = s // 2
    t = np.abs(np.arange(s) - (s - 1) / 2) / c
    m = np.clip((1 - t) * 3, 0, 1)
    a = a * m[None, :, None] + np.roll(a, c, axis=1) * (1 - m[None, :, None])
    return a * m[:, None, None] + np.roll(a, c, axis=0) * (1 - m[:, None, None])


def materials(src, out, made):
    sheet = Image.open(src).convert('RGB')
    for name, (sq, x, y, side, col, spread) in MATS.items():
        ox, oy = SHEET_AT[(sq - 1) % 3], SHEET_AT[(sq - 1) // 3]
        part = sheet.crop((ox + x, oy + y, ox + x + side, oy + y + side)).resize((64, 64), Image.LANCZOS, reducing_gap=3.0)
        a = seamless(np.asarray(part).astype(np.float32))
        dev = a - a.reshape(-1, 3).mean(0)  # how far each dot is from the square's own colour, kept to the spread asked
        a = np.array(col, np.float32) + dev * (spread / max(1.0, float(np.sqrt((dev ** 2).sum(-1).mean() / 3))))
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), 'RGB')
        save(crunch(im, (64, 64), 16, amp=0.6), os.path.join(out, f'mat-{name}.png')); made.append(f'mat-{name}')


def main():
    art = sys.argv[1]
    out = os.path.join(art, 'c')
    os.makedirs(out, exist_ok=True)
    names = sorted(f[:-5] for f in os.listdir(art) if f.endswith('.webp'))
    made = []
    logo = None
    op = lambda n: Image.open(os.path.join(art, n + '.webp'))

    for n in names:
        im = op(n)
        w, h = im.size
        if n.startswith('hall-'):
            # the whole 16:9 room picture at two sizes: 352 x 198 for the smallest frame, 440 x 248 for a larger one.
            # The game shows the part that fits its window; the doors' niches are at fixed places in it.
            save(crunch(im, (352, 198), 256, amp=0.6), os.path.join(out, n + '.png'))
            save(crunch(im, (440, 248), 256, amp=0.6), os.path.join(out, n + '-l.png'))
            made.append(n + '-l')
        elif n.startswith('room-'):
            # a room of its own (the Forgers' room, the guardian's hall): a 3:2 painting, cut to the halls' 16:9 band
            # (most of the dark ceiling goes) so it stands in for a hall at the same two sizes
            box = (0, round(h * .105), w, round(h * .105) + round(w * 9 / 16))
            if n in GRADE:
                im = grade(im, GRADE[n])
            save(crunch(im, (352, 198), 256, amp=0.6, box=box), os.path.join(out, n + '.png'))
            save(crunch(im, (440, 248), 256, amp=0.6, box=box), os.path.join(out, n + '-l.png'))
            made.append(n + '-l')
            if n == 'room-archive':  # the reading room stands whole behind the books (the Codex, Feats, the Vault), as the title picture did
                save(crunch(im, (720, 480), 256, amp=0.6), os.path.join(out, n + '-book.png')); made.append(n + '-book')
        elif n.startswith('enchant-'):
            # an Enchant's mark: a bronze tablet, 16 x 16 on a card and 32 x 32 on the card page; the sheet's white corners go
            g = im.convert('RGBA'); a = np.asarray(g).copy(); a[..., 3] = np.where(a[..., :3].min(-1) > 215, 0, 255); g = Image.fromarray(a, 'RGBA')
            save(crunch(g, (16, 16), 16, amp=1.0, key=True), os.path.join(out, n + '.png'))
            save(crunch(g, (32, 32), 16, amp=1.0, key=True), os.path.join(out, n + '-32.png')); made.append(n + '-32')
        elif n.startswith('terrain-'):
            # a Field Spell's ground, laid over the table top while its terrain holds: 128 x 64, tiled
            save(crunch(im, (128, 64), 256, amp=0.6), os.path.join(out, n + '.png'))
        elif n.startswith('story-'):
            # a story painting, shown above the words in the few long scenes: 312 x 128 (390 x 160 in a larger frame).
            # Its black bars are cut away first; STORY_TOP says where the band sits in what is left (0 top, 1 bottom).
            a = np.asarray(im.convert('RGB')).astype(int).max(-1)
            ys = np.nonzero(np.percentile(a, 90, axis=1) > 8)[0]; xs = np.nonzero(np.percentile(a, 90, axis=0) > 8)[0]
            cx0, cy0, cx1, cy1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            bw = cx1 - cx0; bh = round(bw * 128 / 312)
            if bh > cy1 - cy0: bh = cy1 - cy0; bw = round(bh * 312 / 128); cx0 += (cx1 - cx0 - bw) // 2
            top = cy0 + round((cy1 - cy0 - bh) * STORY_TOP.get(n, .5))
            box = (cx0, top, cx0 + bw, top + bh)
            save(crunch(im, (312, 128), 256, amp=0.6, box=box), os.path.join(out, n + '.png'))
            save(crunch(im, (390, 160), 256, amp=0.6, box=box), os.path.join(out, n + '-l.png'))
            made.append(n + '-l')
        elif n == 'key-logo':
            # the carved title letters (the one picture with words in it): black becomes see-through, cut to its letters
            g = im.convert('RGBA'); a = np.asarray(g).copy(); dark = a[..., :3].max(-1) < 40; a[..., 3] = np.where(dark, 0, 255)
            ys, xs = np.nonzero(~dark); g = Image.fromarray(a, 'RGBA').crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
            save(crunch(g, (144, round(144 * g.height / g.width)), 16, amp=0.8, key=True), os.path.join(out, n + '.png'))
            logo = [144, round(144 * g.height / g.width)]
        elif n.startswith('door-'):
            save(crunch(im, (80, 72), 256, amp=0.6, key=True), os.path.join(out, n + '.png'))
            # the two carved leaves alone, to stand in a niche of the chamber picture (62 x 68 there, 78 x 85 in the larger one)
            box = (round(w * .236), round(h * .165), round(w * .764), round(h * .79))
            if n == 'door-hidden':  # painted square, the leaves narrower in it than on the other doors
                box = (round(w * .30), round(h * .20), round(w * .70), round(h * .72))
            save(crunch(im, (62, 68), 256, amp=0.6, box=box), os.path.join(out, n + '-leaf.png'))
            save(crunch(im, (78, 85), 256, amp=0.6, box=box), os.path.join(out, n + '-leaf-l.png'))
            made += [n + '-leaf', n + '-leaf-l']
        elif n == 'key-crest':
            # struck gold on black: black becomes the see-through colour
            g = im.convert('RGBA'); a = np.asarray(g).copy(); a[..., 3] = np.where(a[..., :3].max(-1) < 40, 0, 255); g = Image.fromarray(a, 'RGBA')
            for sz in (48, 16, 96):
                save(crunch(g, (sz, sz), 16, amp=0.8, key=True), os.path.join(out, f'{n}-{sz}.png')); made.append(f'{n}-{sz}')
            continue
        elif n == 'key-title':
            # the whole 3:2 picture, 720 x 480: enough to fill any frame the game uses (512 to 640 wide, 240 to 480 tall)
            save(crunch(im, (720, 480), 256, amp=0.6), os.path.join(out, n + '.png'))
        elif n.startswith('face-'):
            save(crunch(im, (64, 64), 256, amp=0.5), os.path.join(out, n + '.png'))
            save(crunch(im, (96, 96), 256, amp=0.5), os.path.join(out, n + '-96.png'))
            save(crunch(im, (48, 48), 256, amp=0.5), os.path.join(out, n + '-48.png'))
            made += [n + '-96', n + '-48']
        elif n.startswith('relic-') or n.startswith('masterwork-'):
            save(crunch(im, (32, 32), 16, amp=1.0, key=True), os.path.join(out, n + '.png'))
            save(crunch(im, (24, 24), 16, amp=1.0, key=True), os.path.join(out, n + '-24.png'))
            save(crunch(im, (64, 64), 16, amp=1.0, key=True), os.path.join(out, n + '-64.png'))  # on a plinth, when it is offered
            made += [n + '-24', n + '-64']
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

    # the frame's materials, from his sheet when the art folder holds it (a .png: the page itself never asks for it)
    if os.path.exists(os.path.join(art, 'ui-materials.png')):
        materials(os.path.join(art, 'ui-materials.png'), out, made)

    # blank medallions for items that have no picture yet: the game stamps the item's letter into the face
    for k in ('g', 'c', 'm'):
        for sz, tail in ((32, ''), (24, '-24'), (64, '-64')):
            save(blank_coin(k, sz), os.path.join(out, f'coin-{k}{tail}.png')); made.append(f'coin-{k}{tail}')

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

    # Models built to console size (tools/crucible/console-model.py writes them from Randall's GLB files): their pictures
    # are already console-sized, so they are only cut to 15-bit colour here; the faces go into index.json as they are.
    models = {}
    mdir = os.path.join(art, 'models')
    if os.path.isdir(mdir):
        for f in sorted(x for x in os.listdir(mdir) if x.endswith('.json')):
            m = json.load(open(os.path.join(mdir, f))); mn = f[:-5]
            for t, (pw, ph) in m['pics'].items():
                save(crunch(Image.open(os.path.join(mdir, f'{mn}-{t}.png')), (pw, ph), 256, amp=0.5), os.path.join(out, f'model-{mn}-{t}.png'))
                made.append(f'model-{mn}-{t}')
            models[mn] = m
    json.dump({'art': sorted(made), 'leaf': leaf, 'sheets': sheets, 'title': 720, 'logo': logo, 'models': models}, open(os.path.join(out, 'index.json'), 'w'))  # title: the title picture's width
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print(f'{len(made)} pictures, {sheets} card sheets, {len(models)} models, door leaves at {leaf}, {total // 1024} KB in {out}')


if __name__ == '__main__':
    main()
