#!/usr/bin/env bash
set -euo pipefail
umask 077
REPO="$(pwd)"
python3 - <<'PY'
import json,pathlib
p=pathlib.Path('wrangler.jsonc')
guard=json.loads('\n'.join(l for l in p.read_text().splitlines() if not l.lstrip().startswith('//')))
assert guard['main']=='__FORGE_BROWSER_PROOF_DO_NOT_DEPLOY__/intentionally-missing-worker.js'
assert guard['assets']['directory']=='__FORGE_BROWSER_PROOF_DO_NOT_DEPLOY__/intentionally-missing-assets'
assert not pathlib.Path(guard['main']).exists() and not pathlib.Path(guard['assets']['directory']).exists()
assert guard['workers_dev'] is False and guard['preview_urls'] is False and guard['previews']=={}
print('PASS proof-branch deployment guard retained; this is not a deployable release')
PY
: "${RUNNER_TEMP:?GitHub runner temporary directory required}"
: "${FORGE_PROOF_ROOT:?}"
: "${FORGE_BROWSER_TOOLS:?}"
test "$FORGE_REV" = e5a0f8156da70ffc7866f923bed371c0111707cd
export JAVA_HOME="${JAVA_HOME_21_X64:?The standard Linux image must provide Java 21}"
export PATH="$JAVA_HOME/bin:$PATH"
export MAVEN_OPTS='-Xmx2g -XX:MaxMetaspaceSize=384m -XX:ActiveProcessorCount=2'
mkdir -p "$FORGE_PROOF_ROOT" "$REPO/test-results/forge-browser-proof/artifact"
cp -R experiments/forge-proof/native/adapter "$FORGE_PROOF_ROOT/adapter"
cp -R experiments/forge-proof/native/decks "$FORGE_PROOF_ROOT/decks"
mkdir -p "$FORGE_PROOF_ROOT/adapter/classes" "$FORGE_PROOF_ROOT/home"
# No account token, custom credentials, Actions cache, or custom remote is used.
git init -q "$FORGE_PROOF_ROOT/forge"
git -C "$FORGE_PROOF_ROOT/forge" -c credential.helper= fetch -q --depth=1 https://github.com/Card-Forge/forge.git "$FORGE_REV"
git -C "$FORGE_PROOF_ROOT/forge" checkout -q --detach FETCH_HEAD
test "$(git -C "$FORGE_PROOF_ROOT/forge" rev-parse HEAD)" = "$FORGE_REV"
(
  cd "$FORGE_PROOF_ROOT/forge"
  timeout --signal=TERM --kill-after=15s 480s mvn -B -ntp \
    -Dmaven.repo.local="$FORGE_PROOF_ROOT/m2" -DskipTests -Dmaven.javadoc.skip=true \
    -Dcheckstyle.skip -pl forge-gui-desktop -am compile dependency:build-classpath \
  -Dmdep.outputFile=target/runtime-classpath.txt -DincludeScope=runtime
) >"$RUNNER_TEMP/forge-build.log" 2>&1 || { echo 'Pinned public Forge build failed or reached its 8-minute bound; no browser proof claimed.'; tail -n 60 "$RUNNER_TEMP/forge-build.log"; exit 1; }
CP="$FORGE_PROOF_ROOT/adapter/classes"
for module in forge-core forge-game forge-ai forge-gui forge-gui-desktop; do CP="$CP:$FORGE_PROOF_ROOT/forge/$module/target/classes"; done
CP="$CP:$(cat "$FORGE_PROOF_ROOT/forge/forge-gui-desktop/target/runtime-classpath.txt")"
javac -cp "$CP" -d "$FORGE_PROOF_ROOT/adapter/classes" "$FORGE_PROOF_ROOT/adapter/src/cardstashy/forge/ForgeHttpBridge.java"
node experiments/forge-proof/test-forge-session.mjs
bridge_pid='' ; static_pid=''
cleanup() {
  for pid in "$bridge_pid" "$static_pid"; do if [[ -n "$pid" ]]; then kill -- "-$pid" 2>/dev/null || true; fi; done
  rm -f "$FORGE_PROOF_ROOT/adapter/connection.json"
}
trap cleanup EXIT INT TERM
# One native match, one JVM. 5 GiB hard virtual address-space bound, 2 GiB heap,
# bounded other JVM pools, and a 6-minute native process wall-clock watchdog.
setsid timeout --signal=TERM --kill-after=5s 360s prlimit --as=5368709120 -- java \
  -Xms256m -Xmx2g -Xss512k -XX:MaxMetaspaceSize=384m \
  -XX:CompressedClassSpaceSize=128m -XX:ReservedCodeCacheSize=128m \
  -XX:MaxDirectMemorySize=256m -XX:ActiveProcessorCount=2 \
  -Djava.awt.headless=true -Dsentry.enabled=false -Duser.home="$FORGE_PROOF_ROOT/home" \
  -Dproof.root="$FORGE_PROOF_ROOT" -Dproof.port=8765 -Dproof.seed=20261025 \
  -Dproof.humanDeck=keen-engineering -Dproof.aiDeck=reign-of-dragons -Dproof.controlMode=full \
  -cp "$CP" cardstashy.forge.ForgeHttpBridge >"$RUNNER_TEMP/forge-runtime.log" 2>&1 &
bridge_pid=$!
setsid node experiments/forge-proof/serve.mjs 8766 >"$RUNNER_TEMP/forge-static.log" 2>&1 &
static_pid=$!
set +e
timeout --signal=TERM --kill-after=5s 330s node experiments/forge-proof/ci/browser-proof.mjs
result=$?
set -e
# Strict allowlist; never upload connection.json, source trees, JVM logs, private
# state snapshots, browser traces, HAR, videos, headers, cookies, or credentials.
python3 - <<'PY'
import os,pathlib,json
p=pathlib.Path('test-results/forge-browser-proof/artifact')
allowed={'summary.json','opening.png','unfolded.png','resolved.png','terminal.png','failure.png'}
files=list(p.iterdir())
assert files and all(f.is_file() and not f.is_symlink() and f.name in allowed for f in files)
assert sum(f.stat().st_size for f in files)<=10*1024*1024
assert (p/'summary.json').is_file()
token=json.loads((pathlib.Path(os.environ['FORGE_PROOF_ROOT'])/'adapter/connection.json').read_text())['token'].encode()
assert all(token not in f.read_bytes() for f in files)
with open(os.environ['GITHUB_OUTPUT'],'a') as f:f.write('upload_ready=true\n')
PY
exit "$result"
