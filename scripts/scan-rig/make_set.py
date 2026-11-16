#!/usr/bin/env python3
"""Scanner test rig, step 1: a fixed, labelled set of card photos in different light.

Picks the same cards every time (seeded) from scanidx catalogues, downloads each card's picture
from the game's public source, and renders it as a phone photo: on a table, slightly turned and
tilted, then in five lights (good, dim, glare over the name, warm and soft, steep tilt).
These are simulated photos, not real camera shots: they compare scanner versions against each
other. Real device photos go in the same folder layout (<out>/<game>/<id>__<light>.jpg + labels.json).
Each label keeps the card's true corners (quad: top-left, top-right, bottom-right, bottom-left) so the
card finder can be scored on its own.

  python3 scripts/scan-rig/make_set.py --out /tmp/scan-set --per-game 24
"""
import argparse, gzip, io, json, random, sys, time, urllib.request
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
UA = {"User-Agent": "card-scan-rig/1.0", "Accept": "*/*"}
W, H = 1080, 1440

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(1.5 * (i + 1))
    raise last

def rows(g):
    return json.load(gzip.open(ROOT / f"scanidx/{g}-catalog-v1.json.gz", "rt"))["rows"]

def pick(g, n, rng):
    rs = rows(g)
    if g == "mtg":
        rs = [r for r in rs if r[7] == "en" and "nonfoil" in r[5]]
        # A third of the set are cards printed many times, where the printing is the hard part.
        by = {}
        for r in rs: by.setdefault(r[1], []).append(r)
        many = [v for v in by.values() if len(v) >= 6]
        out = [rng.choice(rng.choice(many)) for _ in range(n // 3)]
        out += rng.sample(rs, n - len(out))
        return [dict(id=r[0], name=r[1], set=r[2], number=r[3], setName=r[4]) for r in out]
    if g == "ptcg":
        rs = [r for r in rs if r[6]]
        return [dict(id=r[0], name=r[1], set=r[2], number=r[3], total=r[4], setName=r[5], img=r[6]) for r in rng.sample(rs, n)]
    seen, out = set(), []
    for r in rng.sample(rs, len(rs)):
        if r[0] in seen or not r[2]: continue
        seen.add(r[0]); out.append(dict(id=r[0], name=r[1], code=r[2], rarity=r[3], setName=r[4], type=r[5]))
        if len(out) == n: break
    return out

def picture(g, c):
    if g == "mtg":
        j = json.loads(get(f"https://api.scryfall.com/cards/{c['id']}")); time.sleep(0.12)
        u = (j.get("image_uris") or j["card_faces"][0]["image_uris"])["large"]
        return get(u)
    if g == "ptcg":
        return get(f"https://assets.tcgdex.net/en/{c['img']}/high.webp")
    return get(f"https://images.ygoprodeck.com/images/cards/{c['id']}.jpg")

def coeffs(dst, src):
    # PIL perspective: maps output (dst) points to input (src) points.
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    return np.linalg.solve(np.array(m, float), np.array(src, float).reshape(8)).tolist()

def table(rng):
    # A wood-like table: low-frequency bands plus grain.
    y = np.linspace(0, 1, H)[:, None]; x = np.linspace(0, 1, W)[None, :]
    base = np.array([rng.randint(70, 150), rng.randint(55, 120), rng.randint(40, 100)], float)
    band = 14 * np.sin(2 * np.pi * (x * rng.uniform(3, 9) + y * rng.uniform(0.2, 1.5)))
    grain = np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 5, (H, W))
    return np.clip(base[None, None, :] + (band + grain)[:, :, None], 0, 255)

def place(card, rng, steep=False):
    cw, ch = card.size
    hgt = H * (0.60 if steep else rng.uniform(0.66, 0.76)); wid = hgt * 63 / 88
    cx, cy = W / 2 + rng.uniform(-40, 40), H / 2 + rng.uniform(-50, 50)
    a = np.deg2rad(rng.uniform(-9, 9))
    quad = np.array([[-wid / 2, -hgt / 2], [wid / 2, -hgt / 2], [wid / 2, hgt / 2], [-wid / 2, hgt / 2]])
    # Tilt: the far (top) edge shrinks, as when the phone is held at an angle.
    k = rng.uniform(0.74, 0.80) if steep else rng.uniform(0.93, 0.99)
    quad[0, 0] *= k; quad[1, 0] *= k
    if steep: quad[:2, 1] *= 0.86
    rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
    quad = quad @ rot.T + [cx, cy]
    src = [(0, 0), (cw, 0), (cw, ch), (0, ch)]
    c = coeffs([tuple(p) for p in quad], src)
    layer = card.convert("RGBA").transform((W, H), Image.PERSPECTIVE, c, Image.BICUBIC)
    # Real cards have rounded corners; source scans fill them with white or black.
    shape = Image.new("L", card.size, 0)
    ImageDraw.Draw(shape).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=round(cw * 0.047), fill=255)
    mask = shape.transform((W, H), Image.PERSPECTIVE, c, Image.BILINEAR)
    # Soft shadow under the card, falling down and to the right.
    sh = mask.transform((W, H), Image.AFFINE, (1, 0, -7, 0, 1, -10)).filter(ImageFilter.GaussianBlur(16)).point(lambda v: int(v * 0.4))
    bg = Image.fromarray(table(rng).astype(np.uint8)).convert("RGB")
    bg = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), bg, sh)
    bg.paste(layer.convert("RGB"), (0, 0), mask)
    return bg, quad

def glare(img, quad, rng):
    # A lamp's reflection across the name strip (top 13% of the card).
    a = np.asarray(img, float)
    top = quad[0] + (quad[3] - quad[0]) * 0.065; right = quad[1] + (quad[2] - quad[1]) * 0.065
    c = top + (right - top) * rng.uniform(0.35, 0.6)
    yy, xx = np.mgrid[0:H, 0:W]
    rx, ry = np.linalg.norm(right - top) * 0.42, np.linalg.norm(quad[3] - quad[0]) * 0.085
    d = ((xx - c[0]) / rx) ** 2 + ((yy - c[1]) / ry) ** 2
    alpha = np.clip(1.25 * np.exp(-d * 1.1), 0, 0.97)[:, :, None]
    return Image.fromarray(np.clip(a * (1 - alpha) + 255 * alpha, 0, 255).astype(np.uint8))

def light(img, kind, quad, rng):
    if kind in ("good", "tilt"):
        return img.filter(ImageFilter.GaussianBlur(0.6))
    if kind == "dim":
        a = np.asarray(img.filter(ImageFilter.GaussianBlur(0.9)), float) * 0.2
        a += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 5, a.shape)
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    if kind == "glare":
        return glare(img.filter(ImageFilter.GaussianBlur(0.6)), quad, rng)
    if kind == "warm":
        a = np.asarray(img.filter(ImageFilter.GaussianBlur(1.5)), float) * 0.62
        a[:, :, 0] *= 1.18; a[:, :, 2] *= 0.68
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    raise ValueError(kind)

LIGHTS = ["good", "dim", "glare", "warm", "tilt"]

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("--per-game", type=int, default=24)
    ap.add_argument("--games", default="mtg,ptcg,ygo"); ap.add_argument("--seed", type=int, default=20261113)
    a = ap.parse_args(); out = Path(a.out)
    for g in a.games.split(","):
        rng = random.Random(f"{a.seed}-{g}"); d = out / g; d.mkdir(parents=True, exist_ok=True); labels = []
        for c in pick(g, a.per_game, rng):
            try:
                keep = out / ".originals" / g / ("".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in str(c["id"])) + ".img")
                if not keep.exists():
                    keep.parent.mkdir(parents=True, exist_ok=True); keep.write_bytes(picture(g, c))
                card = Image.open(io.BytesIO(keep.read_bytes())).convert("RGB")
            except Exception as e:
                print(f"skip {g} {c['id']} {c['name']}: {e}", file=sys.stderr); continue
            safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in str(c["id"]))
            for kind in LIGHTS:
                photo, quad = place(card, rng, steep=kind == "tilt")
                f = f"{safe}__{kind}.jpg"; light(photo, kind, quad, rng).save(d / f, quality=90)
                labels.append(dict(file=f, game=g, light=kind, quad=[[round(float(x), 1), round(float(y), 1)] for x, y in quad], **{k: v for k, v in c.items() if k != "img"}))
            print(g, c["id"], c["name"], flush=True)
        (d / "labels.json").write_text(json.dumps(labels, indent=1))
        print(f"{g}: {len(labels)} photos")

if __name__ == "__main__":
    main()
