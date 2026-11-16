#!/usr/bin/env python3
"""Fetch every card's picture once, shrunk to 64x88 RGB, for building and testing picture indexes.

  python3 scripts/scan-rig/fetch_pictures.py mtg /tmp/cardpix [--limit N] [--workers 24]

Writes <dir>/<game>.u8 (N x 88 x 64 x 3 bytes, memory-mapped), <dir>/<game>-ids.txt (one id per
row, same order) and <dir>/<game>-done.txt (rows fetched, so a stopped run resumes).
Magic: every English paper printing (Scryfall default_cards). Pokemon: every card with a picture
(TCGdex). Yu-Gi-Oh!: every artwork (YGOPRODeck), id "imageId:cardId".
"""
import gzip, io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
import numpy as np
from PIL import Image

UA = {"User-Agent": "card-scan-rig/1.0", "Accept": "*/*"}
PW, PH = 64, 88

def get(url, timeout=60, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception:
            if i == tries - 1: raise
            time.sleep(2 * (i + 1))

def list_mtg():
    bulk = json.loads(get("https://api.scryfall.com/bulk-data"))
    uri = next(d for d in bulk["data"] if d["type"] == "default_cards")["jsonl_download_uri"]
    raw = get(uri, timeout=900)
    if raw[:2] == b"\x1f\x8b": raw = gzip.decompress(raw)
    out = []
    for line in raw.splitlines():
        if not line.strip(): continue
        c = json.loads(line)
        if c.get("lang") != "en" or "paper" not in c.get("games", []) or c.get("layout") in ("art_series", "token", "double_faced_token", "emblem") or c.get("set_type") in ("memorabilia", "token"):
            continue
        img = (c.get("image_uris") or (c.get("card_faces") or [{}])[0].get("image_uris") or {}).get("small")
        if img and c.get("image_status") != "placeholder": out.append((c["id"], img))
    return out

def list_ptcg():
    cards = json.loads(get("https://api.tcgdex.net/v2/en/cards", timeout=180))
    return [(c["id"], c["image"] + "/low.webp") for c in cards if c.get("image") and "/tcgp/" not in c["image"].lower() and not c["id"].startswith(("A", "P-A"))]

def list_ygo():
    out = []
    for c in json.loads(get("https://db.ygoprodeck.com/api/v7/cardinfo.php", timeout=300))["data"]:
        for im in c.get("card_images", []):
            out.append((f'{im["id"]}:{c["id"]}', f'https://images.ygoprodeck.com/images/cards_small/{im["id"]}.jpg'))
    return out

def main():
    g, d = sys.argv[1], sys.argv[2]
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else 0
    workers = int(sys.argv[sys.argv.index("--workers") + 1]) if "--workers" in sys.argv else 24
    os.makedirs(d, exist_ok=True)
    ids_path = os.path.join(d, f"{g}-ids.txt")
    if os.path.exists(ids_path):
        items = [tuple(l.rstrip("\n").split("\t")) for l in open(ids_path)]
    else:
        items = {"mtg": list_mtg, "ptcg": list_ptcg, "ygo": list_ygo}[g]()
        if limit: items = items[:limit]
        open(ids_path, "w").write("".join(f"{i}\t{u}\n" for i, u in items))
    n = len(items)
    path = os.path.join(d, f"{g}.u8")
    mm = np.memmap(path, dtype=np.uint8, mode="r+" if os.path.exists(path) else "w+", shape=(n, PH, PW, 3))
    done_path = os.path.join(d, f"{g}-done.txt")
    done = set(int(x) for x in open(done_path).read().split()) if os.path.exists(done_path) else set()
    todo = [k for k in range(n) if k not in done]
    print(f"{g}: {n} pictures, {len(todo)} to fetch", flush=True)
    def work(k):
        im = Image.open(io.BytesIO(get(items[k][1]))).convert("RGB").resize((PW, PH), Image.BOX)
        return k, np.asarray(im)
    t0, c, failed = time.time(), 0, 0
    with open(done_path, "a") as log, ThreadPoolExecutor(workers) as ex:
        for f in as_completed([ex.submit(work, k) for k in todo]):
            try:
                k, a = f.result(); mm[k] = a; log.write(f"{k}\n")
            except Exception:
                failed += 1
            c += 1
            if c % 2000 == 0:
                log.flush(); print(f"  {c}/{len(todo)} ({c / (time.time() - t0):.0f}/s, {failed} failed)", flush=True)
    mm.flush(); print(f"{g}: done, {failed} failed, {time.time() - t0:.0f}s", flush=True)

if __name__ == "__main__":
    main()
