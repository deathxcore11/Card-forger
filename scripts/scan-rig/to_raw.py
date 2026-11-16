#!/usr/bin/env python3
"""Turn a photo set's JPEGs into raw RGBA files (<name>.rgba, width x height from labels) so the
Node benches can read pixels without an image library.  python3 scripts/scan-rig/to_raw.py /tmp/scan-set2"""
import json, sys
from pathlib import Path
from PIL import Image
root = Path(sys.argv[1])
for d in sorted(p for p in root.iterdir() if p.is_dir() and not p.name.startswith(".")):
    labels = json.loads((d / "labels.json").read_text())
    for L in labels:
        im = Image.open(d / L["file"]).convert("RGBA"); L["w"], L["h"] = im.size
        (d / (L["file"] + ".rgba")).write_bytes(im.tobytes())
    (d / "labels.json").write_text(json.dumps(labels, indent=1)); print(d.name, len(labels))
