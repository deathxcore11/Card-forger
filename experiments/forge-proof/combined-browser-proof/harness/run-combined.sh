#!/usr/bin/env bash
# LOCAL_TEST_NOT_DEPLOYABLE. Executable proposal; root review/approval required.
set -euo pipefail
umask 077
export PYTHONDONTWRITEBYTECODE=1
HERE=$(cd "$(dirname "$0")" && pwd)
: "${FORGE_COMBINED_REVIEWED_MANIFEST_SHA256:?Exact reviewed package manifest required}"
[[ "$FORGE_COMBINED_REVIEWED_MANIFEST_SHA256" =~ ^[a-f0-9]{64}$ ]] || exit 64
if [[ "${FORGE_COMBINED_WALLCLOCK_GUARD:-}" != active ]];then
 # 37min active work + at most60s cleanup =38min proof-step ceiling;
 # the40min CI job reserves2min for checkout/setup/source preparation/upload.
 read -r deadline active_seconds < <(node - <<'JS'
const now=Date.now(),cutoff=Number(process.env.FORGE_COMBINED_JOB_CUTOFF_MS||now+2280000);
if(!Number.isSafeInteger(cutoff)||cutoff<=now+60000||cutoff>now+2340000)process.exit(64);
const deadline=Math.min(now+2220000,cutoff-60000);
process.stdout.write(deadline+' '+Math.floor((deadline-now)/1000)+'\n');
JS
 )
 [[ "$active_seconds" =~ ^[0-9]+$ ]] && (( active_seconds>0 && active_seconds<=2220 )) || exit 64
 exec timeout --signal=TERM --kill-after=60s "${active_seconds}s" env FORGE_COMBINED_WALLCLOCK_GUARD=active FORGE_COMBINED_ACTIVE_DEADLINE_MS="$deadline" bash "$0" "$@"
fi
[[ $(sha256sum "$HERE/MANIFEST.json" | cut -d' ' -f1) == "$FORGE_COMBINED_REVIEWED_MANIFEST_SHA256" ]] || { echo 'Combined package differs from reviewed manifest';exit 64; }
python3 "$HERE/verify-inputs.py"
export FORGE_COMBINED_CANDIDATE_ROOT=$(python3 - "$HERE/composition-contract.json" <<'PY'
import json,os,sys,pathlib
p=pathlib.Path(sys.argv[1])
print(os.environ.get('FORGE_COMBINED_CANDIDATE_ROOT') or (p.parent/json.loads(p.read_text())['candidateRoot']).resolve())
PY
)
export FORGE_COMBINED_WORK=$(mktemp -d "${RUNNER_TEMP:-/tmp}/forge-combined-XXXXXXXX")
export FORGE_BROWSER_TOOLS="$FORGE_COMBINED_WORK/browser-tools" PLAYWRIGHT_BROWSERS_PATH="$FORGE_COMBINED_WORK/browser-binaries"
ARTIFACT="$PWD/test-results/forge-combined/artifact"
mkdir -p "$ARTIFACT"
[[ -z "$(find "$ARTIFACT" -mindepth 1 -maxdepth 1 -print -quit)" ]] || { echo 'Artifact directory must be empty';exit 64; }
stage=setup
: "${FORGE_COMBINED_ACTIVE_DEADLINE_MS:?Absolute active-work budget required}"
require_budget(){
 if ! node - "$FORGE_COMBINED_ACTIVE_DEADLINE_MS" "$1" <<'JS'
const deadline=Number(process.argv[2]),seconds=Number(process.argv[3]);
if(!Number.isSafeInteger(deadline)||deadline-Date.now()<seconds*1000||deadline>Date.now()+2220000)process.exit(1);
JS
 then echo 'NOT TESTED: insufficient bounded stage time; cleanup required';exit 124;fi
}
finish(){
 code=$?;trap - EXIT TERM INT
 cleanup_ok=true;container_cleanup_ok=true;image_cleanup_ok=true
 if ! timeout --signal=TERM --kill-after=3s 25s node "$HERE/local-oci/cleanup-owned.mjs" "$FORGE_COMBINED_WORK" > "$FORGE_COMBINED_WORK/private-cleanup.log" 2>&1;then cleanup_ok=false;container_cleanup_ok=false;code=1;fi
 if ! timeout --signal=TERM --kill-after=3s 15s node "$HERE/cleanup-image.mjs" "$FORGE_COMBINED_WORK/image" > "$FORGE_COMBINED_WORK/private-image-cleanup.log" 2>&1;then cleanup_ok=false;image_cleanup_ok=false;code=1;fi
 printf '{"containersConfirmed":%s,"imageConfirmed":%s}\n' "$container_cleanup_ok" "$image_cleanup_ok" > "$FORGE_COMBINED_WORK/cleanup-outcomes.json"
 # Explicit bounded collector is the ONLY upload boundary. Never copy workroot,
 # OCI image layers/source, input/env files, runtime logs or cached response bodies.
 if ! timeout --signal=TERM --kill-after=2s 12s python3 "$HERE/publish-artifacts.py" "$FORGE_COMBINED_WORK" "$ARTIFACT" "$code" "$stage" "$cleanup_ok";then code=1;fi
 if [[ -n "${GITHUB_OUTPUT:-}" ]] && [[ -f "$ARTIFACT/verified-artifact.json" ]];then printf 'upload_ready=true\n' >> "$GITHUB_OUTPUT";fi
 if [[ "$cleanup_ok" == true ]];then rm -rf "$FORGE_COMBINED_WORK";fi
 exit "$code"
}
trap finish EXIT
trap 'exit 124' TERM INT
for tool in docker node python3 timeout;do command -v "$tool" >/dev/null || { echo "Required local tool unavailable: $tool";exit 69; };done
# A coherent procfs is a measured prerequisite, never inferred from CI branding.
require_budget 22
timeout --signal=TERM --kill-after=2s 20s bash "$HERE/run-cleanup-preflight.sh" > "$FORGE_COMBINED_WORK/private-cleanup-preflight.log" 2>&1
stage=source-contracts
require_budget 60
timeout --signal=TERM --kill-after=5s 55s bash "$HERE/run-static-checks.sh" > "$FORGE_COMBINED_WORK/private-static-checks.log" 2>&1
stage=setup
# No system upgrades. Same pinned browser version as the successful existing proof.
timeout --signal=TERM --kill-after=5s 45s npm install --prefix "$FORGE_BROWSER_TOOLS" --no-save --package-lock=false --ignore-scripts --no-audit --no-fund playwright@1.62.1 > "$FORGE_COMBINED_WORK/private-browser-install.log" 2>&1
timeout --signal=TERM --kill-after=5s 115s node "$FORGE_BROWSER_TOOLS/node_modules/playwright/cli.js" install --only-shell chromium >> "$FORGE_COMBINED_WORK/private-browser-install.log" 2>&1
mapfile -t shells < <(find "$PLAYWRIGHT_BROWSERS_PATH" -type f -name chrome-headless-shell)
[[ ${#shells[@]} == 1 ]]
timeout --signal=TERM --kill-after=1s 5s ldd "${shells[0]}" > "$FORGE_COMBINED_WORK/private-browser-libraries.log"
! grep -q 'not found' "$FORGE_COMBINED_WORK/private-browser-libraries.log"
stage=image-build-export-probe
require_budget 900
bash "$HERE/image-stages/build-and-probe.sh" "$FORGE_COMBINED_CANDIDATE_ROOT" "$FORGE_COMBINED_WORK/image" > "$FORGE_COMBINED_WORK/private-image-stages.log" 2>&1
stage=desktop
require_budget 900
timeout --signal=TERM --kill-after=35s 865s bash "$HERE/run-case.sh" desktop
stage=touch750
require_budget 205
timeout --signal=TERM --kill-after=35s 170s bash "$HERE/run-case.sh" touch750
stage=complete
