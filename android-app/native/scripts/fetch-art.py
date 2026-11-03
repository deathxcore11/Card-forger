#!/usr/bin/env python3
"""Download the Scryfall images for the demo decks and Home tiles into the app's assets.
cards/<slug>.jpg is the full card (normal), cards/<slug>.art.jpg the art crop; art.json maps names to slugs."""
import json, re, sys, time, urllib.request, urllib.parse, os
decks, out = json.load(open(sys.argv[1])), sys.argv[2]
names = []
for d in decks["decks"]:
    for c in d["cards"]:
        if c["name"] not in names: names.append(c["name"])
for n in decks.get("homeArt", []):
    if n not in names: names.append(n)
H = {"User-Agent": "CardStashyNativeBuild/0.1", "Accept": "application/json"}
def get(url, accept=None):
    req = urllib.request.Request(url, headers={**H, **({"Accept": accept} if accept else {})})
    for i in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r: return r.read()
        except Exception as e:
            if i == 3: raise
            time.sleep(1 + i)
slug = lambda n: re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-")
index = {}
for n in names:
    card = json.loads(get("https://api.scryfall.com/cards/named?exact=" + urllib.parse.quote(n)))
    uris = card.get("image_uris") or card["card_faces"][0]["image_uris"]
    s = slug(n); index[n] = s
    for kind, suffix in (("normal", ".jpg"), ("art_crop", ".art.jpg")):
        path = os.path.join(out, s + suffix)
        if not os.path.exists(path): open(path, "wb").write(get(uris[kind], "image/*"))
    time.sleep(0.12)
json.dump(index, open(os.path.join(out, "art.json"), "w"), indent=1)
print("art:", len(index), "cards")
