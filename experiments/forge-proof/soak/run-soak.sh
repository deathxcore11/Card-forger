#!/usr/bin/env bash
# Engine soak gate: plays every free precon against a random same-format precon on the real
# engine bundle (desktop JVM, no UI) and fails if any match stalls. Run before every engine release.
#
#   run-soak.sh <engine tgz> <repo checkout with forge-rules/current and data/play-starters/precons.json> <seeds...>
#
# Each seed plays all 15 decks (15 matches, about 30 s each). The 10 Nov 2026 gate: 14 seeds, 210 matches, 0 stalls.
set -euo pipefail
TGZ=$(realpath "$1"); REPO=$(realpath "$2"); shift 2
HERE=$(cd "$(dirname "$0")" && pwd); W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
tar -xzf "$TGZ" -C "$W"; mkdir -p "$W/root"; (cd "$W/root" && unzip -q ../android/assets/forge-engine/pack.zip)
# The bundled rules data expires after 7 days; use the repo's current bundle.
rm -rf "$W/root/rules-data/current"; cp -r "$REPO/forge-rules/current" "$W/root/rules-data/current"
JAVA_TOOL_OPTIONS= javac -nowarn -d "$W" -cp "$W/android/libs/*" "$HERE/Soak.java"
N=$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['decks']))" "$REPO/data/play-starters/precons.json")
rc=0
for seed in "$@"; do
  (cd "$W" && JAVA_TOOL_OPTIONS= java -Xmx2g -cp "$W/android/libs/*:$W" Soak "$W/root" "$REPO/data/play-starters/precons.json" 0 "$N" "$seed" 240000) | grep -E '^(RESULT|SOAK_SUMMARY)' || rc=1
  cp "$W"/stall-*.txt . 2>/dev/null || true
done
exit $rc
