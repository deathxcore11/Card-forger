#!/usr/bin/env bash
# Already-provisioned local or CI tools only. No package installation, paid run,
# remote push, provider allocation or deployment is performed by this script.
set -euo pipefail
: "${FORGE_BROWSER_TOOLS:?Point to an existing pinned Playwright install}"
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT"
OUT=${FORGE_BROWSER_OUT:-$ROOT/test-results/forge-existing-play}
mkdir -p "$OUT"
FORGE_WIDE_ENTRY="$ROOT/takeover/wide-screen-entry.patch" node takeover/forge-play-browser-proof/materialize.mjs > "$OUT/build.json"
node takeover/forge-host-local-fixture/server.mjs \
 --ui-root "$ROOT/takeover/forge-play-browser-proof/runtime" \
 --service-root "$ROOT/takeover/forge-host-service-rematch/composed" \
 --proof-root "$ROOT/takeover/forge-proof" \
 --native-root "$ROOT/takeover/forge-proof/review-candidate-20261026-0146-exact" \
 --gateway "$ROOT/takeover/forge-host-service-overlay/build-context-exact-0146/hosting/gateway.py" \
 --bootstrap "$ROOT/takeover/forge-host-service-overlay/container/bootstrap.py" \
 --lifetime-ms 600000 > "$OUT/private-local-server.log" 2>&1 & PID=$!
cleanup(){ kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; }
trap cleanup EXIT
for i in $(seq 1 120); do
 grep -q 'fixture-ready' "$OUT/private-local-server.log" && break
 kill -0 "$PID" || { echo 'Local fixture server failed'; exit 1; }
 sleep 1
done
export FORGE_UI_ORIGIN=$(python -c "import json; print(next(json.loads(x)['origin'] for x in open('$OUT/private-local-server.log') if 'fixture-ready' in x))")
export FORGE_BROWSER_OUT="$OUT"
node takeover/forge-play-browser-proof/browser-journey.mjs
# Upload only summary.json / known PNG names, not private-local-server.log.
