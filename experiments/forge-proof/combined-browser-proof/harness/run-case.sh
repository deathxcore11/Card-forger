#!/usr/bin/env bash
# LOCAL_TEST_NOT_DEPLOYABLE. One real browser case and same-image providers.
set -euo pipefail
umask 077
HERE=$(cd "$(dirname "$0")" && pwd)
name=${1:?desktop or touch750 required}
case "$name" in desktop) lifetime=875000; allocations=2; full=true; driver_deadline=815000;; touch750) lifetime=190000; allocations=1; full=false; driver_deadline=140000;; *) exit 64;; esac
: "${FORGE_COMBINED_WORK:?}" "${FORGE_COMBINED_CANDIDATE_ROOT:?}" "${FORGE_BROWSER_TOOLS:?}" "${FORGE_COMBINED_REVIEWED_MANIFEST_SHA256:?}"
export FORGE_BROWSER_ABSOLUTE_DEADLINE_MS=$(node -e "process.stdout.write(String(Date.now()+$driver_deadline))")
OUT="$FORGE_COMBINED_WORK/raw/$name";mkdir -p "$OUT/private-runtime"
server_pid=''
cleanup(){
 code=$?;trap - EXIT TERM INT
 if [[ -n "$server_pid" ]];then
  kill -TERM "$server_pid" 2>/dev/null || true
  for _ in $(seq 1 80);do kill -0 "$server_pid" 2>/dev/null || break;sleep .25;done
  if kill -0 "$server_pid" 2>/dev/null;then kill -KILL -- "-$server_pid" 2>/dev/null || true;code=1;fi
  wait "$server_pid" 2>/dev/null || true
 fi
 # Provider owner supplies exact-ID/ownership-checked fallback cleanup. It is
 # required even when the fixture died before writing a lifecycle receipt.
 if ! timeout --signal=TERM --kill-after=3s 20s node "$HERE/local-oci/cleanup-owned.mjs" "$OUT/private-runtime";then code=1;fi
 python3 - "$OUT/private-server.log" "$OUT/lifecycle.json" "$allocations" <<'PY' || code=1
import json,pathlib,sys
p=pathlib.Path(sys.argv[1]);records=[]
for line in p.read_text().splitlines() if p.exists() else []:
 try:records.append(json.loads(line))
 except ValueError:pass
stop=[r for r in records if r.get('event')=='fixture-stopped']
assert len(stop)==1
r=stop[0];expected=int(sys.argv[3]);clean={k:r.get(k) for k in ['confirmed','privateInputRemoved','starts','destroys','lifecycle']}
pathlib.Path(sys.argv[2]).write_text(json.dumps(clean)+'\n')
assert clean['lifecycle']['confirmed'] is True and len(clean['lifecycle']['allocations'])==expected
assert clean['confirmed'] is True and clean['privateInputRemoved'] is True and clean['starts']==expected and clean['destroys']==expected
PY
 exit "$code"
}
trap cleanup EXIT
trap 'exit 124' TERM INT
setsid node "$HERE/fixture-server.mjs" --ui-root "$FORGE_COMBINED_CANDIDATE_ROOT/ui" --service-root "$FORGE_COMBINED_CANDIDATE_ROOT/host" \
 --host-inventory "$FORGE_COMBINED_CANDIDATE_ROOT/HOST-SHA256.json" --evidence-bundle "$FORGE_COMBINED_WORK/image/evidence-bundle.json" \
 --allocations "$allocations" --lifetime-ms "$lifetime" --private-parent "$OUT/private-runtime" > "$OUT/private-server.log" 2>&1 &
server_pid=$!
ready=false
for _ in $(seq 1 120);do
 if grep -q '"event":"fixture-ready"' "$OUT/private-server.log";then ready=true;break;fi
 kill -0 "$server_pid" 2>/dev/null || break;sleep .25
done
[[ "$ready" == true ]] || { echo 'FAIL same-image fixture startup; no browser gameplay claimed';exit 1; }
export FORGE_UI_ORIGIN=$(python3 - "$OUT/private-server.log" <<'PY'
import json,sys
for line in open(sys.argv[1]):
 try:r=json.loads(line)
 except ValueError:continue
 if r.get('event')=='fixture-ready':print(r['origin']);break
PY
)
export FORGE_BROWSER_OUT="$OUT" FORGE_BROWSER_CASE=saved-keen FORGE_TEST_CAST=true FORGE_FULL_JOURNEY="$full"
export FORGE_TOUCH=false FORGE_WIDTH=1440 FORGE_HEIGHT=1000
export FORGE_EXPECTED_POLICY_VERSION=forge-heuristic-medium-beta-v1
export FORGE_EXPECTED_SOURCE_SHA256=1213d8acfa1d65f39d8184365ebca2815b9b41776e8f8847abf1517bf5464e84
if [[ "$name" == touch750 ]];then export FORGE_TOUCH=true FORGE_WIDTH=750 FORGE_HEIGHT=832;fi
set +e
node "$HERE/browser-journey.mjs" > "$OUT/private-browser.log" 2>&1
result=$?
set -e
grep '^PASS ' "$OUT/private-browser.log" || true
exit "$result"
