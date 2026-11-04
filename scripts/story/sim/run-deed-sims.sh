#!/usr/bin/env bash
# Deed measurement over Story battles: Forge self-play, facts for both seats per game (match-facts.js).
# Usage: run-deed-sims.sh <games> <out.jsonl> <battle ids...>   (deck files from export-decks.mjs in /tmp/story/decks)
# 4 JVMs in parallel. Then: node scripts/story/sim/deed-rates.mjs <out.jsonl>
set -u
GAMES=$1; OUT=$2; shift 2
D=/tmp/story/decks; CP=/tmp/fe/simc:$(ls /tmp/fe/android/libs/*.jar | tr '\n' ':'); HERE=$(cd "$(dirname "$0")" && pwd)
i=0; declare -a GROUP=("" "" "" "")
for id in "$@"; do GROUP[$((i%4))]+="$D/$id-hero.txt $D/$id-villain.txt "; i=$((i+1)); done
for g in 0 1 2 3; do [ -n "${GROUP[$g]}" ] && (java -Xmx2g -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -Dstory.seed=${STORY_SEED:-1} -cp "$CP" DeedSim /tmp/fe/root $GAMES ${GROUP[$g]} 2>/dev/null | node "$HERE/deed-facts.mjs" > "$OUT.$g") & done
wait
cat "$OUT".[0-3] > "$OUT" && rm -f "$OUT".[0-3]
