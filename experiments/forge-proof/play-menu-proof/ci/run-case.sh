#!/usr/bin/env bash
# One ordinary browser journey, synthetic account only; all native moves use UI.
set -euo pipefail
umask 077
case_name=$1
case "$case_name" in desktop|touch750) ;; *) exit 2;; esac
: "${FORGE_PLAY_WORK:?}" "${FORGE_PLAY_REPO:?}" "${FORGE_BROWSER_TOOLS:?}"
T="$FORGE_PLAY_WORK/takeover"
OUT="$FORGE_PLAY_WORK/raw/$case_name"
mkdir -p "$OUT"
HOST="$FORGE_PLAY_REPO/experiments/forge-proof/hosting/cloudflare"
server_pid=''
cleanup() {
  status=$?; trap - EXIT TERM INT
  if [[ -n "$server_pid" ]]; then
    kill -TERM "$server_pid" 2>/dev/null || true
    for _ in $(seq 1 40); do kill -0 "$server_pid" 2>/dev/null || break; sleep .25; done
    if kill -0 "$server_pid" 2>/dev/null; then kill -KILL -- "-$server_pid" 2>/dev/null || true; status=1; fi
    wait "$server_pid" 2>/dev/null || true
  fi
  python3 - "$OUT/private-server.log" "$OUT/lifecycle.json" <<'PY' || status=1
import json,sys,pathlib
records=[]
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
 try: records.append(json.loads(line))
 except ValueError: pass
stopped=[r for r in records if r.get('event')=='fixture-stopped']
assert len(stopped)==1 and stopped[0]['confirmed'] is True and stopped[0]['privateInputRemoved'] is True
r=stopped[0]
pathlib.Path(sys.argv[2]).write_text(json.dumps({'confirmed':True,'privateInputRemoved':True,'starts':r['starts'],'destroys':r['destroys']})+'\n')
PY
  exit "$status"
}
trap cleanup EXIT
trap 'exit 124' TERM INT
setsid node "$T/forge-host-local-fixture/server.mjs" \
  --ui-root "$T/forge-play-browser-proof/runtime" \
  --service-root "$T/forge-host-service-rematch/composed" \
  --proof-root "$T/forge-proof" \
  --native-root "$FORGE_PLAY_REPO/experiments/forge-proof/native-exact-0146" \
  --gateway "$HOST/build-context-exact-0146/hosting/gateway.py" \
  --bootstrap "$HOST/container/bootstrap.py" \
  --lifetime-ms 190000 > "$OUT/private-server.log" 2>&1 &
server_pid=$!
ready=false
for _ in $(seq 1 120); do
  if grep -q '"event":"fixture-ready"' "$OUT/private-server.log"; then ready=true; break; fi
  kill -0 "$server_pid" 2>/dev/null || break
  sleep .25
done
if [[ "$ready" != true ]]; then echo 'FAIL fixture startup; no browser game claimed.'; exit 1; fi
export FORGE_UI_ORIGIN=$(python3 - "$OUT/private-server.log" <<'PY'
import json,sys
for line in open(sys.argv[1]):
 try:r=json.loads(line)
 except ValueError:continue
 if r.get('event')=='fixture-ready':print(r['origin']);break
PY
)
export FORGE_BROWSER_OUT="$OUT" FORGE_BROWSER_CASE=saved-keen FORGE_TEST_CAST=true FORGE_FULL_JOURNEY=false
export FORGE_TOUCH=false FORGE_WIDTH=1440 FORGE_HEIGHT=1000
if [[ "$case_name" == touch750 ]]; then export FORGE_TOUCH=true FORGE_WIDTH=750 FORGE_HEIGHT=832; fi
set +e
timeout --signal=TERM --kill-after=5s 165s node "$T/forge-play-browser-proof/browser-journey.mjs" > "$OUT/private-browser.log" 2>&1
result=$?
set -e
grep '^PASS ' "$OUT/private-browser.log" || true
exit "$result"
