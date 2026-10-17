#!/usr/bin/env python3
"""Build the instant-scan artwork index for one game: a small perceptual fingerprint of every card's
picture, so the phone can recognise a card from the camera in milliseconds (scanart.js does the
same maths on the camera frame).

  python3 scripts/build-scan-index.py mtg|ptcg|ygo [--limit N] [--workers 16]

Writes scanidx/<game>.bin (19 bytes per picture: art pHash 8, whole-card pHash 8, art mean RGB 3)
and scanidx/<game>-ids.txt (one id per line, same order). Progress is cached in
scanidx/.cache-<game>.jsonl, so an interrupted run picks up where it stopped and a re-run only
fetches new cards.
"""
import gzip, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
from PIL import Image

UA = {"User-Agent": "CardStashy-scan-index/1.0 (+https://cardforge2.deathxcore11.workers.dev)", "Accept": "*/*"}
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "scanidx")
# Keep in step with ART in scanart.js.
ART = {"mtg": (0.08, 0.11, 0.84, 0.44), "ptcg": (0.08, 0.1, 0.84, 0.4), "ygo": (0.12, 0.18, 0.76, 0.52)}
W, H = 192, 268


def get(url, timeout=40, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(1.5 * (i + 1))


# ---------- fingerprints (mirror of scanart.js) ----------
def grid(a, region, gw, gh):
    fx, fy, fw, fh = region
    hh, ww = a.shape[:2]
    x0, y0, cw, ch = fx * ww, fy * hh, fw * ww / gw, fh * hh / gh
    out = np.zeros((gh, gw) + a.shape[2:])
    for gy in range(gh):
        ya = int(np.floor(y0 + gy * ch)); yb = max(ya + 1, int(np.floor(y0 + (gy + 1) * ch)))
        for gx in range(gw):
            xa = int(np.floor(x0 + gx * cw)); xb = max(xa + 1, int(np.floor(x0 + (gx + 1) * cw)))
            out[gy, gx] = a[ya:min(yb, hh), xa:min(xb, ww)].reshape(-1, *a.shape[2:]).mean(axis=0)
    return out


N = 32
_C = np.array([[np.cos(np.pi * (2 * x + 1) * u / (2 * N)) for x in range(N)] for u in range(N)])


def phash(m):
    d = (_C @ m @ _C.T)[:8, :8].flatten()[1:]  # 63 low frequencies, DC left out
    bits = d > np.median(d)
    v = 0
    for b in bits:
        v = (v << 1) | int(b)
    return (v << 1).to_bytes(8, "big")  # 63 bits + a zero pad bit


def fingerprint(img, g):
    rgb = np.asarray(img.convert("RGB").resize((W, H), Image.BOX), dtype=np.float64)
    gray = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    art = ART[g]
    mean = grid(rgb, art, 1, 1)[0, 0]
    return phash(grid(gray, art, N, N)) + phash(grid(gray, (0, 0, 1, 1), N, N)) + bytes(int(round(v)) for v in mean)


# ---------- card lists ----------
def list_mtg():
    bulk = json.loads(get("https://api.scryfall.com/bulk-data"))
    uri = next(d for d in bulk["data"] if d["type"] == "unique_artwork")["jsonl_download_uri"]
    raw = gzip.decompress(get(uri, timeout=300))
    out = []
    for line in raw.splitlines():
        c = json.loads(line)
        if "paper" not in c.get("games", []) or c.get("layout") in ("art_series", "token", "double_faced_token", "emblem") or c.get("set_type") in ("memorabilia", "token"):
            continue
        img = (c.get("image_uris") or (c.get("card_faces") or [{}])[0].get("image_uris") or {}).get("small")
        if img:
            out.append((c["id"], img))
    return out


def list_ptcg():
    cards = json.loads(get("https://api.tcgdex.net/v2/en/cards", timeout=120))
    return [(c["id"], c["image"] + "/low.webp") for c in cards if c.get("image") and "/tcgp/" not in c["image"].lower() and not c["id"].startswith(("A", "P-A"))]


def list_ygo():
    data = json.loads(get("https://db.ygoprodeck.com/api/v7/cardinfo.php", timeout=180))["data"]
    out = []
    for c in data:
        for im in c.get("card_images", []):
            out.append((f'{im["id"]}:{c["id"]}', f'https://images.ygoprodeck.com/images/cards_small/{im["id"]}.jpg'))
    return out


def main():
    g = sys.argv[1]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 0
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 16
    os.makedirs(ROOT, exist_ok=True)
    items = {"mtg": list_mtg, "ptcg": list_ptcg, "ygo": list_ygo}[g]()
    if limit:
        items = items[:limit]
    cache_path = os.path.join(ROOT, f".cache-{g}.jsonl")
    done = {}
    if os.path.exists(cache_path):
        for line in open(cache_path):
            r = json.loads(line)
            done[r["id"]] = r["fp"]
    todo = [(i, u) for i, u in items if i not in done]
    print(f"{g}: {len(items)} pictures, {len(todo)} to fetch", flush=True)

    def work(item):
        i, u = item
        return i, fingerprint(Image.open(io.BytesIO(get(u))), g).hex()

    t0, n, failed = time.time(), 0, 0
    with open(cache_path, "a") as cache, ThreadPoolExecutor(workers) as ex:
        for f in as_completed([ex.submit(work, it) for it in todo]):
            try:
                i, fp = f.result()
                done[i] = fp
                cache.write(json.dumps({"id": i, "fp": fp}) + "\n")
            except Exception:
                failed += 1
            n += 1
            if n % 500 == 0:
                cache.flush()
                print(f"  {n}/{len(todo)} ({n / (time.time() - t0):.0f}/s, {failed} failed)", flush=True)
    kept = [(i, u) for i, u in items if i in done]
    with open(os.path.join(ROOT, f"{g}.bin"), "wb") as b:
        for i, _ in kept:
            b.write(bytes.fromhex(done[i]))
    # Pokémon picture paths can't be worked out from the id, so they ride along: "id<TAB>path".
    line = (lambda i, u: f"{i}\t{u.replace('https://assets.tcgdex.net/en/', '').replace('/low.webp', '')}") if g == "ptcg" else (lambda i, u: i)
    with open(os.path.join(ROOT, f"{g}-ids.txt"), "w") as t:
        t.write("\n".join(line(i, u) for i, u in kept) + "\n")
    ids = kept
    print(f"{g}: wrote {len(ids)} fingerprints ({failed} failed) in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
