#!/usr/bin/env python3
"""Scanner test rig: harder, real-style photos from the same source pictures as make_set.py.

What the first set lacked and real phone photos have: a sleeve around the card (its rim and its
shine), a busy playmat behind it (large artwork and printed zone lines), the card small or off
centre in the frame, a soft focus, and a strong angle. Still simulated: it compares scanner
versions and guards against wrong answers; only real photos prove the scanner.

  python3 scripts/scan-rig/make_real_style.py --src /tmp/scan-set --out /tmp/scan-set2
"""
import argparse, json, random
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

W, H = 1080, 1440
KINDS = ["mat", "matdim", "matglare", "small", "angle"]

def coeffs(dst, src):
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(m, float), np.array(src, float).reshape(8)).tolist()

def playmat(other, rng):
    # Another card's artwork blown up across the frame, darkened, with printed zone lines and a word.
    w, h = other.size
    art = other.crop((int(w * .12), int(h * .2), int(w * .88), int(h * .6)))
    k = rng.uniform(2.2, 3.4); big = art.resize((int(W * k), int(H * k)), Image.BICUBIC)
    x, y = rng.randint(0, big.width - W), rng.randint(0, big.height - H)
    bg = big.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(rng.uniform(1.5, 4)))
    bg = ImageEnhance.Brightness(bg).enhance(rng.uniform(.45, .9))
    d = ImageDraw.Draw(bg)
    for _ in range(rng.randint(2, 4)):
        zx, zy = rng.randint(-100, W - 300), rng.randint(-100, H - 400); zw = rng.randint(300, 520)
        d.rectangle((zx, zy, zx + zw, zy + int(zw * 1.42)), outline=tuple(rng.randint(120, 220) for _ in range(3)), width=rng.randint(2, 5))
    return bg

def sleeved(card, rng):
    # The card inside a sleeve: a rim wider at the sides and top, in the sleeve's colour, with a soft shine.
    cw, ch = card.size
    mx, mt, mb = int(cw * rng.uniform(.035, .075)), int(ch * rng.uniform(.03, .07)), int(ch * rng.uniform(.01, .03))
    rim = rng.choice([(245, 245, 245), (20, 20, 24), (30, 50, 120), (200, 200, 205), (120, 20, 30)])
    sw, sh = cw + 2 * mx, ch + mt + mb
    s = Image.new("RGB", (sw, sh), rim); s.paste(card.convert("RGB"), (mx, mt))
    shine = Image.new("L", (sw, sh), 0); d = ImageDraw.Draw(shine)
    x0 = rng.randint(-sw // 3, sw // 2); wid = rng.randint(sw // 10, sw // 4)
    d.polygon([(x0, 0), (x0 + wid, 0), (x0 + wid + sw // 3, sh), (x0 + sw // 3, sh)], fill=rng.randint(40, 95))
    shine = shine.filter(ImageFilter.GaussianBlur(sw * .03))
    s = Image.composite(Image.new("RGB", (sw, sh), (255, 255, 255)), s, shine)
    return s, (mx, mt, cw, ch)

def place(sleeve, inner, rng, kind):
    sw, sh = sleeve.size
    frac = rng.uniform(.4, .48) if kind == "small" else rng.uniform(.52, .74)
    hgt = H * frac; wid = hgt * sw / sh
    cx, cy = W / 2 + rng.uniform(-110, 110), H / 2 + rng.uniform(-140, 140)
    a = np.deg2rad(rng.uniform(-14, 14) if kind != "angle" else rng.uniform(-8, 8))
    quad = np.array([[-wid / 2, -hgt / 2], [wid / 2, -hgt / 2], [wid / 2, hgt / 2], [-wid / 2, hgt / 2]])
    k = rng.uniform(.7, .8) if kind == "angle" else rng.uniform(.86, .98)
    quad[0, 0] *= k; quad[1, 0] *= k
    if kind == "angle": quad[:2, 1] *= .84
    rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]); quad = quad @ rot.T + [cx, cy]
    c = coeffs([tuple(p) for p in quad], [(0, 0), (sw, 0), (sw, sh), (0, sh)])
    layer = sleeve.transform((W, H), Image.PERSPECTIVE, c, Image.BICUBIC)
    mask = Image.new("L", sleeve.size, 255).transform((W, H), Image.PERSPECTIVE, c, Image.BILINEAR)
    # The card's own corners inside the sleeve, in frame coordinates (inverse of the PIL mapping).
    M = np.array([[c[0], c[1], c[2]], [c[3], c[4], c[5]], [c[6], c[7], 1]]); Mi = np.linalg.inv(M)
    mx, mt, cw, ch = inner; pts = []
    for u, v in [(mx, mt), (mx + cw, mt), (mx + cw, mt + ch), (mx, mt + ch)]:
        p = Mi @ np.array([u, v, 1.0]); pts.append([p[0] / p[2], p[1] / p[2]])
    return layer, mask, pts

def camera(img, kind, rng):
    img = img.filter(ImageFilter.GaussianBlur(rng.uniform(.9, 1.9)))
    a = np.asarray(img, float)
    if kind == "matdim": a = a * rng.uniform(.3, .45) * np.array([1.0, .92, .8])
    if kind == "matglare":
        yy, xx = np.mgrid[0:H, 0:W]; gx, gy = rng.uniform(.3, .7) * W, rng.uniform(.25, .6) * H
        al = np.clip(1.1 * np.exp(-(((xx - gx) / (W * .16)) ** 2 + ((yy - gy) / (H * .07)) ** 2)), 0, .95)[:, :, None]
        a = a * (1 - al) + 255 * al
    a += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 4, a.shape)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--src", default="/tmp/scan-set"); ap.add_argument("--out", default="/tmp/scan-set2"); a = ap.parse_args()
    src, out = Path(a.src), Path(a.out); rng = random.Random(20261114)
    for g in ["mtg", "ptcg", "ygo"]:
        labels = json.loads((src / g / "labels.json").read_text()); cards = {}
        for L in labels: cards.setdefault(str(L["id"]), L)
        files = {i: next(iter(sorted((src / ".originals" / g).glob(f"{i}.*"))), None) for i in cards}
        ids = [i for i in cards if files[i]]; (out / g).mkdir(parents=True, exist_ok=True); res = []
        for i in ids:
            card = Image.open(files[i]).convert("RGB"); other = Image.open(files[rng.choice([x for x in ids if x != i])]).convert("RGB")
            for kind in KINDS:
                sleeve, inner = sleeved(card, rng); layer, mask, quad = place(sleeve, inner, rng, kind)
                bg = playmat(other, rng); bg.paste(layer, (0, 0), mask)
                name = f"{i}__{kind}.jpg"; camera(bg, kind, rng).save(out / g / name, quality=72)
                res.append({**{k: v for k, v in cards[i].items() if k not in ("file", "light", "quad", "w", "h")}, "file": name, "light": kind, "quad": quad})
        (out / g / "labels.json").write_text(json.dumps(res, indent=1)); print(g, len(res))

if __name__ == "__main__":
    main()
