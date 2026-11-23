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


def crunch(im, size, colors, amp=1.0, key=False, box=None, info=None):
    """Resize, dither with the 4 x 4 table, cut to `colors` colours, snap to five bits a channel.
    info: a dict that is given the palette chosen."""
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
    if info is not None:
        info['pal'] = pal
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


# The title's torches burn. Each painted flame is lifted off its wall (the wall behind it filled in from round it),
# swayed through twelve frames, and laid back where it was; each frame is cut with the title's own colours and its
# own place in the dither table, and only the pixels that ever differ from the still picture are kept, so a frame's
# edge is the picture itself and no seam can show. The game steps through the frames at the place each patch was cut
# from (index.json 'torches': x, y, w, h in the 720 x 480 cut, and the frame count).
TORCH_FLAMES = [(298, 342, 392, 453), (994, 1040, 390, 453)]  # each painted flame in the painting: x0, x1, top, foot
TORCH_N = 12
LIGHT, LIGHT_R = .07, 56  # how far the torchlight on the wall lifts and falls, and how far it reaches (painting pixels)


def lum(a):
    return a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11


def fill(a, mask, iters=800):
    """The masked pixels filled from the pixels round them by repeated averaging: the wall behind a flame."""
    b = a.copy()
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min() - 1, ys.max() + 2, xs.min() - 1, xs.max() + 2
    sub, m = b[y0:y1, x0:x1], mask[y0:y1, x0:x1]
    sub[m] = sub[~m].mean(0)
    for _ in range(iters):
        sub[m] = ((np.roll(sub, 1, 0) + np.roll(sub, -1, 0) + np.roll(sub, 1, 1) + np.roll(sub, -1, 1)) / 4)[m]
    return b


def sample(a, xs, ys):
    """Bilinear samples of a at the float places xs, ys (clamped to the picture)."""
    h, w = a.shape[:2]
    xs, ys = np.clip(xs, 0, w - 1.001), np.clip(ys, 0, h - 1.001)
    x0, y0 = xs.astype(int), ys.astype(int)
    fx, fy = (xs - x0)[..., None], (ys - y0)[..., None]
    a3 = a if a.ndim == 3 else a[..., None]
    v = (a3[y0, x0] * (1 - fx) * (1 - fy) + a3[y0, x0 + 1] * fx * (1 - fy) + a3[y0 + 1, x0] * (1 - fx) * fy + a3[y0 + 1, x0 + 1] * fx * fy)
    return v if a.ndim == 3 else v[..., 0]


def quant(rgb, pal, amp, x0, y0):
    """Cut a part of a picture to a palette with the dither table at the part's own place in the whole picture."""
    h, w = rgb.shape[:2]
    tile = np.tile(BAYER, (h // 4 + 2, w // 4 + 2))[y0 % 4:y0 % 4 + h, x0 % 4:x0 % 4 + w] * (8.0 * amp)
    d = np.clip(rgb + tile[..., None], 0, 255)
    return pal[np.argmin(((d[:, :, None, :] - pal[None, None, :, :]) ** 2).sum(-1), axis=2)].astype(np.uint8)


def torch_frames(im, size, pal, still, out, amp=0.6):
    P = np.asarray(im.convert('RGB')).astype(np.float32)
    H, W = P.shape[:2]
    sx, sy = size[0] / W, size[1] / H
    frames = [P.copy() for _ in range(TORCH_N)]
    for (fx0, fx1, top, foot) in TORCH_FLAMES:
        # the flame: brighter than the wall filled in behind it
        box = np.zeros((H, W), bool); box[top - 4:foot, fx0 - 4:fx1 + 4] = True
        B = fill(P, box)
        a = np.clip((lum(P) - lum(B) - 8) / 46, 0, 1) * box
        a[foot - 2:foot] *= 1  # the foot stays on the bowl
        mask = a > .02
        B = fill(P, mask | (box & (np.roll(mask, 1, 0) | np.roll(mask, -1, 0) | np.roll(mask, 1, 1) | np.roll(mask, -1, 1))))
        a = np.clip((lum(P) - lum(B) - 8) / 46, 0, 1) * box
        Bt = P * (1 - a[..., None]) + B * a[..., None]  # the picture with the flame taken off
        cx, hf = (fx0 + fx1) / 2, foot - top
        gy, gx = np.mgrid[top - 22:foot, fx0 - 16:fx1 + 16].astype(np.float32)
        # the light it throws on the wall round it lifts and falls with it, fading to nothing at LIGHT_R
        ly0, ly1, lx0, lx1 = int(foot - hf * .45 - LIGHT_R), int(foot - hf * .45 + LIGHT_R), int(cx - LIGHT_R), int(cx + LIGHT_R)
        ry, rx = np.mgrid[ly0:ly1, lx0:lx1].astype(np.float32)
        fall = np.clip(1 - np.hypot(rx - cx, (ry - (foot - hf * .45)) * 1.15) / LIGHT_R, 0, 1) ** 2
        for f in range(TORCH_N):
            t = f / TORCH_N
            h = np.clip((foot - gy) / hf, 0, 1.5)
            st = 1 + .1 * np.sin(2 * np.pi * t) + .05 * np.sin(2 * np.pi * 3 * t + 1.3)  # the flame's height
            frames[f][ly0:ly1, lx0:lx1] *= (1 + LIGHT * (st - 1) / .15 * fall)[..., None]
            dx = 5.5 * h ** 1.5 * np.sin(2 * np.pi * t - 3.4 * h) + 2.4 * h ** 2 * np.sin(4 * np.pi * t - 5.5 * h + .7)  # its sway
            wv = 1 + .06 * np.sin(4 * np.pi * t + .4)
            xs, ys = cx + (gx - dx - cx) / wv, foot - (foot - gy) / st
            af = sample(a, xs, ys) * (ys <= foot)
            col = sample(P, xs, ys) * (1 + .05 * np.sin(6 * np.pi * t + .9))
            y0, x0 = top - 22, fx0 - 16
            bt = Bt[y0:foot, x0:fx1 + 16] * (frames[f][y0:foot, x0:fx1 + 16] / np.maximum(P[y0:foot, x0:fx1 + 16], 1))  # lit as the wall now is
            frames[f][y0:foot, x0:fx1 + 16] = np.clip(bt * (1 - af[..., None]) + col * af[..., None], 0, 255)
    # cut every frame like the still picture, and keep the patch of each flame that ever differs from it
    cuts = []
    for fr in frames:
        r = np.asarray(Image.fromarray(np.round(fr).astype(np.uint8), 'RGB').convert('RGBA').resize(size, Image.LANCZOS, reducing_gap=3.0)).astype(np.float32)[..., :3]
        cuts.append(r)
    torches = []
    for (fx0, fx1, top, foot) in TORCH_FLAMES:
        bx0, bx1 = int((fx0 - LIGHT_R - 24) * sx), int((fx1 + LIGHT_R + 24) * sx) + 1
        by0, by1 = int((top - LIGHT_R - 24) * sy), min(size[1], int((foot + LIGHT_R) * sy) + 1)
        q = [quant(c[by0:by1, bx0:bx1], pal, amp, bx0, by0) for c in cuts]
        base = still[by0:by1, bx0:bx1, :3]
        diff = np.zeros(base.shape[:2], bool)
        for x in q:
            diff |= (x != base).any(-1)
        ys, xs = np.nonzero(diff)
        if not len(xs):
            continue
        py0, py1, px0, px1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        strip = np.concatenate([x[py0:py1, px0:px1] for x in q], axis=1)
        k = len(torches) + 1
        save(Image.fromarray(strip, 'RGB'), os.path.join(out, f'torch-{k}.png'))
        torches.append([int(bx0 + px0), int(by0 + py0), int(px1 - px0), int(py1 - py0), TORCH_N])
        edge = int(diff[py0, px0:px1].sum() + diff[py1 - 1, px0:px1].sum() + diff[py0:py1, px0].sum() + diff[py0:py1, px1 - 1].sum())
        print(f'torch {k}: {torches[-1]}, {edge} edge pixels differ (a patch is cut to what differs)')
    return torches


def save(im, path):
    im.save(path, 'PNG', optimize=True)


def save_pal(a, path):
    """An RGBA picture of few colours (alpha 0 or 255) kept as a paletted PNG, its own colours exactly: half the bytes."""
    cols, ind = np.unique(a.reshape(-1, 4), axis=0, return_inverse=True)
    p = Image.fromarray(ind.reshape(a.shape[:2]).astype(np.uint8), 'P')
    p.putpalette(cols[:, :3].ravel().tolist())
    p.save(path, 'PNG', optimize=True, transparency=bytes(int(c[3]) for c in cols))


# The chamber of doors: three empty doorways stand in each hall picture, and a door's two carved leaves are laid into
# them. The doorways are measured here from each hall's own pixels at both sizes, and each door's leaves are cut to fit
# each doorway exactly, with the stepped corners of its frame left showing, toned to that hall's stone and lit the way
# the painted doorway is lit, then cut with the dither at the doorway's own place in the picture. index.json 'niches'
# keeps each doorway: x, y, w, h, and the stepped corners (width and depth, left then right).
NICHE_GUESS, NICHE_GUESS_Y = (62, 145, 230), 60  # roughly where the doorways are in the 352 x 198 picture: the search starts here


def edge(p, lo, hi, dark_after):
    """Where a profile turns from light to dark within lo..hi (dark_after: the dark side lies after the place, and the
    place is its first dark pixel; otherwise its last): the place with the greatest step from the two light pixels
    beside it to the brightest of the four dark ones, so a groove in the stone does not pass for the doorway's edge."""
    def sc(x):
        return p[x - 2:x].mean() - p[x:x + 4].max() if dark_after else p[x + 1:x + 3].mean() - p[x - 3:x + 1].max()
    return max(range(lo, hi + 1), key=sc)


def niches(rgb, s):
    """The three doorways of a hall picture (rgb: the picture at this size before it is dithered; s: 1 or 1.25)."""
    a = lum(rgb)
    out = []
    for nx in NICHE_GUESS:
        x0, y0, w, h = nx * s, NICHE_GUESS_Y * s, 62 * s, 68 * s
        pc = a[int(y0 + h * .3):int(y0 + h * .85)].mean(0)  # across the doorway's middle rows
        L = edge(pc, round(x0) - 4, round(x0) + 4, True)
        R = edge(pc, round(x0 + w) - 5, round(x0 + w) + 3, False)
        pr = a[:, int(L + w * .25):int(R - w * .25)].mean(1)  # down its middle columns, clear of the corners
        T = edge(pr, round(y0) - 4, round(y0) + 4, True)
        B = edge(pr, round(y0 + h) - 5, round(y0 + h) + 3, False)
        band = a[T:T + 2].mean(0)  # the frame's stepped corners: light in the top rows beside each side
        eL = edge(band, L + 1, L + round(9 * s), True) - L
        eR = R - edge(band, R - round(9 * s), R - 1, False)
        dL = edge(a[:, L:L + eL].mean(1), T + 1, T + round(9 * s), True) - T
        dR = edge(a[:, R - eR + 1:R + 1].mean(1), T + 1, T + round(9 * s), True) - T
        out.append([int(L), int(T), int(R - L + 1), int(B - T + 1), int(eL), int(dL), int(eR), int(dR)])
    return out


def box_blur(a, r):
    """A plain box blur of radius r over the first two axes (edges held)."""
    for ax in (0, 1):
        p = np.pad(a, [(r, r) if i == ax else (0, 0) for i in range(a.ndim)], mode='edge')
        c = np.cumsum(p, axis=ax, dtype=np.float64)
        c = np.concatenate([np.zeros_like(np.take(c, [0], axis=ax)), c], axis=ax)
        n = a.shape[ax]
        a = (np.take(c, range(2 * r + 1, 2 * r + 1 + n), axis=ax) - np.take(c, range(0, n), axis=ax)) / (2 * r + 1)
    return a


LEAF_HUE, LEAF_KEY = .6, .9  # how far a leaf is toned toward its hall's stone, and how bright against it (as on floor 1)

# Where Randall's models stand in the room paintings: a spot on each painted floor in the 440 x 248 picture (the game
# takes 4/5 of it for the 352 x 198 one): the model, its middle x, the y its foot rests on, its height, its turn in
# degrees. Each spot lies inside the part of the picture that every screen shape shows (x 64 to 376 of the larger
# picture, y 31 to 189 where the view is shortest), so the view crops a model with its painting and no shape loses it.
# The forge's anvil gets the height of its hammer's whole swing. The keepers' spots come from the doorways (niches).
SPOTS = {
    'room-sanctum': [['shrine', 220, 190, 46, 0]],   # on the pool's rim under the lit niche, between the two choices
    'room-omen': [['bowl', 220, 181, 34, 0]],        # in the circle of light under the beam
    'room-vault': [['chest', 96, 188, 30, -30]],     # on the floor before the shelves, left of the ladder
    'room-bazaar': [['stall', 220, 188, 74, 15]],    # the trader's stall before the hearth
    'room-forge': [['anvil', 220, 204, 128, 0]],     # before the furnace mouth, the hammer swinging in its light
}


def light_tint(c, ref):
    """What a model's own colours are multiplied by to stand in a place whose stone is c: toned toward its colour and
    darkened as it is darker than ref (the first hall's stone, where the models look right as they are)."""
    tone = np.ones(3) * (1 - LEAF_HUE) + (c / lum(c)) * LEAF_HUE
    return tone * min(1.0, lum(c) / lum(ref)) * LEAF_KEY


def spot_tints(op, ref):
    """For each room with models, the light at each model's spot: the painting's colour round its foot."""
    tints = {}
    for room, items in SPOTS.items():
        try:
            rgb = np.asarray(op(room).convert('RGB')).astype(np.float32)
        except FileNotFoundError:
            continue
        h, w = rgb.shape[:2]
        box = (0, round(h * .105), w, round(h * .105) + round(w * 9 / 16))  # the band the room is cut to (see main)
        if room in GRADE:
            rgb = np.asarray(grade(Image.fromarray(rgb.astype(np.uint8)), GRADE[room])).astype(np.float32)
        band = np.asarray(Image.fromarray(rgb.astype(np.uint8)).crop(box).resize((440, 248), Image.LANCZOS)).astype(np.float32)
        out = []
        for (_m, x, foot, ht, _yaw) in items:
            c = band[max(0, foot - ht):min(248, foot + 6), max(0, x - ht // 2):x + ht // 2].reshape(-1, 3).mean(0)
            out.append([round(float(v), 3) for v in light_tint(c, ref)])
        tints[room] = out
    return tints


def leaves(op, halls, doors, out, made):
    """Every door's leaves cut for every doorway of every chamber hall, at both sizes."""
    places = {}
    stone1 = None
    for hall in halls:
        src = op(hall).convert('RGB')
        places[hall] = {}
        for size, tag in (((352, 198), ''), ((440, 248), '-l')):
            s = size[0] / 352
            rgb = np.asarray(src.resize(size, Image.LANCZOS, reducing_gap=3.0)).astype(np.float32)
            ns = niches(rgb, s)
            places[hall]['l' if tag else 's'] = ns
            # the hall's stone: the frame round its doorways
            ring = np.zeros(rgb.shape[:2], bool)
            for (x, y, w, h, *_e) in ns:
                ring[y - 6:y + h, x - 6:x + w + 6] = True
                ring[y:y + h, x:x + w] = False
            stone = rgb[ring].mean(0)
            if stone1 is None:
                stone1 = stone
            if tag:  # the light a model in this hall is lit by, and the hall's stone: toned as the leaves are
                places[hall]['tint'] = [round(float(v), 3) for v in light_tint(stone, stone1)]
                places[hall]['stone'] = [int(v) for v in stone]
            for i, (x, y, w, h, eLw, eLd, eRw, eRd) in enumerate(ns):
                light = box_blur(lum(rgb[y:y + h, x:x + w]), max(2, round(4 * s)))
                light = np.clip(light / light.mean(), .55, 1.35) ** .5  # the doorway's own light, softened
                for d in doors:
                    im = op(d)
                    W, H = im.size
                    box = (round(W * .236), round(H * .165), round(W * .764), round(H * .79))
                    if d == 'door-hidden':  # painted square, the leaves narrower in it than on the other doors
                        box = (round(W * .30), round(H * .20), round(W * .70), round(H * .72))
                    lf = np.asarray(im.convert('RGB').crop(box).resize((w, h), Image.LANCZOS, reducing_gap=3.0)).astype(np.float32)
                    m = lf.reshape(-1, 3).mean(0)
                    tone = (m / lum(m)) * (1 - LEAF_HUE) + (stone / lum(stone)) * LEAF_HUE
                    target = tone * lum(m) * (lum(stone) / lum(stone1)) * LEAF_KEY
                    g = np.clip(lf * (target / m) * light[..., None], 0, 255)
                    pal = np.asarray(Image.fromarray(g.astype(np.uint8), 'RGB').quantize(colors=64, method=Image.FASTOCTREE, dither=Image.NONE).convert('RGB')).reshape(-1, 3)
                    pal = np.unique(pal & 0xF8, axis=0).astype(np.float32)
                    q = quant(g, pal, .6, x, y)
                    alpha = np.full((h, w), 255, np.uint8)
                    alpha[:eLd, :eLw] = 0
                    alpha[:eRd, w - eRw:] = 0
                    n = f'leaf-{d[5:]}-{hall}-{i}{tag}'
                    save_pal(np.dstack([q, alpha]), os.path.join(out, n + '.png'))
                    made.append(n)
    return places


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
    torches = []
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
            # the door whole; its leaves are cut for each doorway of each hall below (leaves)
            save(crunch(im, (80, 72), 256, amp=0.6, key=True), os.path.join(out, n + '.png'))
        elif n == 'key-crest':
            # struck gold on black: black becomes the see-through colour
            g = im.convert('RGBA'); a = np.asarray(g).copy(); a[..., 3] = np.where(a[..., :3].max(-1) < 40, 0, 255); g = Image.fromarray(a, 'RGBA')
            for sz in (48, 16, 96):
                save(crunch(g, (sz, sz), 16, amp=0.8, key=True), os.path.join(out, f'{n}-{sz}.png')); made.append(f'{n}-{sz}')
            continue
        elif n == 'key-title':
            # the whole 3:2 picture, 720 x 480: enough to fill any frame the game uses (512 to 640 wide, 240 to 480 tall)
            info = {}
            still = crunch(im, (720, 480), 256, amp=0.6, info=info)
            save(still, os.path.join(out, n + '.png'))
            torches = torch_frames(im, (720, 480), info['pal'], np.asarray(still), out)
            made += [f'torch-{k + 1}' for k in range(len(torches))]
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

    # the doors' leaves, cut for each doorway of each hall of doors (the leaves cut once for all halls are gone)
    for f in os.listdir(out):
        if f.startswith('door-') and '-leaf' in f or f.startswith('leaf-'):
            os.remove(os.path.join(out, f))
    halls = [n for n in names if n == 'hall-doors' or n.startswith('hall-doors-')]
    door_arts = [n for n in names if n.startswith('door-')]
    places = leaves(op, halls, door_arts, out, made) if halls else {}
    for hall, p in places.items():
        print(f'{hall}: doorways {p["s"]} and {p["l"]}, models lit {p["tint"]}')
    # the models' spots in the rooms, each with the light it stands in
    ref = np.array(places[halls[0]]['stone'], np.float32) if places else np.array([150, 110, 70], np.float32)
    tints = spot_tints(op, ref)
    spots = {room: [it + [tints[room][i]] for i, it in enumerate(items)] for room, items in SPOTS.items() if room in tints}
    print('spots', spots)

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
    json.dump({'art': sorted(made), 'leaf': leaf, 'sheets': sheets, 'title': 720, 'torches': torches, 'logo': logo, 'models': models, 'niches': places, 'spots': spots}, open(os.path.join(out, 'index.json'), 'w'))  # title: the title picture's width
    total = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
    print(f'{len(made)} pictures, {sheets} card sheets, {len(models)} models, door leaves at {leaf}, {total // 1024} KB in {out}')


if __name__ == '__main__':
    main()
