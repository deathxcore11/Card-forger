#!/usr/bin/env bash
# Fill the native test app's generated inputs (all gitignored):
#   engine-libs/                     Forge engine jar + its runtime jars, exactly as the beta APK ships them
#   app/src/main/assets/forge-engine pack.zip + pack.version from the same engine build
#   app/src/main/assets/forge-rules-seed  the website's current weekly rules bundle (forge-rules/current), installed
#                                    on first launch where CardStashyForge.updateRules would put a download
#   app/src/main/assets/cards/       Scryfall images for the two demo decks (normal + art_crop) and the Home tiles
#   app/src/main/assets/{play,sfx}/  the existing playmat, banners and table sounds from the website
#
#   ENGINE_TGZ  engine build (default: the shared pods build the beta APK uses)
set -euo pipefail
HERE=$(cd "$(dirname "$0")/.." && pwd); REPO=$(cd "$HERE/../.." && pwd)
ENGINE_TGZ=${ENGINE_TGZ:-/mnt/project-files/android/forge-engine-build/forge-engine-android-e5a0f81-pods.tgz}
A="$HERE/app/src/main/assets"; T=$(mktemp -d)
rm -rf "$HERE/engine-libs" "$A"; mkdir -p "$HERE/engine-libs" "$A/forge-engine" "$A/forge-rules-seed" "$A/cards" "$A/play" "$A/sfx"
tar -xzf "$ENGINE_TGZ" -C "$T"
cp "$T"/android/libs/*.jar "$HERE/engine-libs/"
cp "$T"/android/assets/forge-engine/pack.zip "$T"/android/assets/forge-engine/pack.version "$A/forge-engine/"
cp "$REPO"/forge-rules/current/{manifest.json,cards.json,official-format-facts.json} "$A/forge-rules-seed/"
for f in playmat-charcoal-table.webp playmat-charcoal-table-glow.webp turn-you.webp turn-cpu.webp result-win.webp result-loss.webp result-draw.webp; do cp "$REPO/assets/play/$f" "$A/play/"; done
cp "$REPO/art-packs/planeswalk-codex/Existing_Project_Art/chandra.jpg" "$A/play/planeswalk-tile.jpg" 2>/dev/null || cp "$REPO/assets/planeswalk-tile.jpg" "$A/play/planeswalk-tile.jpg"
# The sound ids play-table-audio.js uses at the table.
for id in CARD-001 CARD-002 CARD-005 CARD-006 CARD-008 CARD-010 CARD-014 CARD-018 CARD-019 CARD-020 CARD-025 CARD-027 CMB-002 CMB-003 CMB-004 CMB-005 CMB-007 CMB-009 CMB-018 CMB-019 TT-001 TT-002 TT-003 QP-012 QP-017 QP-018 QP-019 PACK-003 PACK-004 PACK-005 PACK-006 PACK-014 PACK-015 PACK-016 PACK-017 PACK-018 PACK-019 PACK-020 RWD-001 RWD-006; do
  cp "$REPO/assets/audio/sfx/$id.ogg" "$A/sfx/"
done
python3 "$HERE/scripts/fetch-art.py" "$HERE/decks/demo-decks.json" "$A/cards"
cp "$HERE/decks/demo-decks.json" "$A/"
# The web's Play rule data (achievements, quests, Story acts, CPU levels, playmats), from its own modules.
node "$HERE/scripts/export-play-rules.mjs" "$REPO" "$A/play-rules.json"
node "$HERE/scripts/export-board-icons.mjs" "$REPO" "$A/board-icons.json"
node "$HERE/scripts/export-story-deeds.mjs" "$REPO" "$A/story-deeds.json"
# The card pop-up's rule words and foil recipes, from the web's own modules.
node "$HERE/scripts/export-card-data.mjs" "$REPO" "$A/card-data.json"
# Randall's painted art pieces (each replaces its code-drawn version; a missing piece keeps the code one).
for f in "$HERE"/art/*.webp; do [ -e "$f" ] && cp "$f" "$A/play/"; done
# The table playmats (all 128 files): without them the table is a flat black card, so this script now does it too.
cp "$REPO"/assets/play/playmat-*.webp "$A/play/"
cp "$HERE/deck-engine/deck-engine.js" "$A/deck-engine.js"  # the web's Deck Forge for QuickJS (scripts/export-deck-engine.mjs)
rm -rf "$T"
echo "assets ready: $(du -sh "$A" | cut -f1), libs $(ls "$HERE/engine-libs" | wc -l) jars, pack $(cat "$A/forge-engine/pack.version")"
