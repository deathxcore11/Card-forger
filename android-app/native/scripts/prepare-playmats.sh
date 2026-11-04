#!/usr/bin/env bash
# The table playmats (play-playmats.js): every assets/play/playmat-* file from the website (14 paintings with their
# upright crops, two glow halves, thumbs, sparkle halves, hedron cut-outs, and the shared cloud and mote tiles) into
# app/src/main/assets/play/. Run after scripts/prepare-assets.sh, which clears the assets folder.
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd); REPO=$(cd "$HERE/../.." && pwd)
A="$HERE/app/src/main/assets/play"; mkdir -p "$A"
cp "$REPO"/assets/play/playmat-*.webp "$A/"
echo "playmats ready: $(ls "$A"/playmat-*.webp | wc -l) files, $(du -ch "$A"/playmat-*.webp | tail -1 | cut -f1)"
