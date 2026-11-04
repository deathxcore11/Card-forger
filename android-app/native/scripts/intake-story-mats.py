#!/usr/bin/env python3
"""Story playmat intake (MOTION-SPEC.md): every master story-a<act>-<slug>.png (1672 x 941) in the given folder is cut into
the shipped files, named like the fourteen existing mats: playmat-<id>.webp (1280 x 720), -tall (the middle 529 px, 540 x 960),
-fold (a new middle crop about 1:1.25 for an open foldable, 753 x 941 -> 720 x 900), -thumb (320 x 180). Output goes to art/,
which prepare-assets.sh copies into the app. The light map (mats/story-light.json) is written by hand per mat.
Usage: python3 scripts/intake-story-mats.py <masters folder> [art folder]"""
import sys, pathlib, re
from PIL import Image
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else pathlib.Path(__file__).resolve().parent.parent / 'art')
W, H = 1672, 941
TALL = (571, 529)   # x, width: the same upright crop as the existing mats
FOLD = (460, 753)   # x, width: 753 / 941 = 0.8, centred
done = 0
for f in sorted(src.glob('story-a*-*.png')):
    if not re.fullmatch(r'story-a\d+-[a-z0-9-]+\.png', f.name): continue
    mid = f.stem
    im = Image.open(f).convert('RGB')
    # A work-in-progress master in another shape (3:2) waits for its 16:9 re-export; stretching it would distort the painting.
    if im.size != (W, H): print('skipped (not 1672x941, WIP)', mid); continue
    im.resize((1280, 720), Image.LANCZOS).save(out / f'playmat-{mid}.webp', quality=86, method=6)
    im.crop((TALL[0], 0, TALL[0] + TALL[1], H)).resize((540, 960), Image.LANCZOS).save(out / f'playmat-{mid}-tall.webp', quality=86, method=6)
    im.crop((FOLD[0], 0, FOLD[0] + FOLD[1], H)).resize((720, 900), Image.LANCZOS).save(out / f'playmat-{mid}-fold.webp', quality=86, method=6)
    im.resize((320, 180), Image.LANCZOS).save(out / f'playmat-{mid}-thumb.webp', quality=82, method=6)
    done += 1; print('mat', mid)
print(f'story mats: {done}')
