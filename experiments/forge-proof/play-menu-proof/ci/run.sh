#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${RUNNER_TEMP:?}" "${GITHUB_SHA:?}" "${GITHUB_OUTPUT:?}" "${FORGE_BROWSER_TOOLS:?}"
export FORGE_PLAY_REPO="$PWD" FORGE_PLAY_WORK="$RUNNER_TEMP/forge-existing-play-proof"
SOURCE="$PWD/experiments/forge-proof/play-menu-proof"
ARTIFACT="$PWD/test-results/forge-existing-play/artifact"
stage=prepare
mkdir -p "$FORGE_PLAY_WORK" "$ARTIFACT"
finish() {
  status=$?;trap - EXIT TERM INT
  if python3 "$SOURCE/ci/artifacts.py" "$FORGE_PLAY_WORK/raw" "$ARTIFACT" "$status" "$stage"; then
    echo 'upload_ready=true' >> "$GITHUB_OUTPUT"
    python3 - "$ARTIFACT/summary.json" <<'PY' || status=1
import json,sys
assert json.load(open(sys.argv[1]))['result']=='passed'
PY
  else status=1; fi
  exit "$status"
}
trap finish EXIT
trap 'exit 124' TERM INT
python3 - <<'PY'
import json,pathlib
g=json.loads('\n'.join(l for l in pathlib.Path('wrangler.jsonc').read_text().splitlines() if not l.lstrip().startswith('//')))
assert g['main']=='__FORGE_BROWSER_PROOF_DO_NOT_DEPLOY__/intentionally-missing-worker.js'
assert g['assets']['directory']=='__FORGE_BROWSER_PROOF_DO_NOT_DEPLOY__/intentionally-missing-assets'
assert not pathlib.Path(g['main']).exists() and not pathlib.Path(g['assets']['directory']).exists()
assert g['workers_dev'] is False and g['preview_urls'] is False and g['previews']=={}
print('PASS unchanged proof-only deployment guard')
PY
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
BASE="$RUNNER_TEMP/forge-existing-play-app-source"
mkdir "$BASE"
# Archive only tracked app files: never .git credentials or untracked tools,
# caches/logs. Runtime dependencies/CSS remain intact; no duplicate is committed.
git archive --format=tar HEAD -- . ':(exclude)*.zip' ':(exclude)*.apk' ':(exclude)*.log' \
  ':(exclude).github' ':(exclude)node_modules' ':(exclude)test-results' \
  ':(exclude)experiments/forge-proof/play-menu-proof' \
  ':(exclude)experiments/forge-proof/hosting' \
  ':(exclude)experiments/forge-proof/native' \
  ':(exclude)experiments/forge-proof/native-exact-0146' | tar -xf - -C "$BASE"
python3 "$SOURCE/ci/prepare.py" "$PWD" "$FORGE_PLAY_WORK" "$BASE"
T="$FORGE_PLAY_WORK/takeover"
export JAVA_HOME="${JAVA_HOME_21_X64:?Standard Ubuntu image Java21 required}"
export PATH="$JAVA_HOME/bin:$PATH"
export MAVEN_OPTS='-Xmx2g -XX:MaxMetaspaceSize=384m -XX:ActiveProcessorCount=2'
mkdir -p "$T/forge-proof/tools/jdk21/bin"
ln -s "$JAVA_HOME/bin/javac" "$T/forge-proof/tools/jdk21/bin/javac"
# Exact gateway arguments remain unchanged. Apply the address-space bound only
# to its Java child, not to Node/Chromium's larger virtual-memory reservations.
printf '#!/usr/bin/env bash\nexec prlimit --as=5368709120 -- %q "$@"\n' "$JAVA_HOME/bin/java" > "$T/forge-proof/tools/jdk21/bin/java"
chmod 700 "$T/forge-proof/tools/jdk21/bin/java"
stage=forge-build
git init -q "$T/forge-proof/forge"
git -C "$T/forge-proof/forge" -c credential.helper= fetch -q --depth=1 https://github.com/Card-Forge/forge.git e5a0f8156da70ffc7866f923bed371c0111707cd
git -C "$T/forge-proof/forge" checkout -q --detach FETCH_HEAD
test "$(git -C "$T/forge-proof/forge" rev-parse HEAD)" = e5a0f8156da70ffc7866f923bed371c0111707cd
(
 cd "$T/forge-proof/forge"
 timeout --signal=TERM --kill-after=10s 420s mvn -B -ntp \
  -Dmaven.repo.local="$FORGE_PLAY_WORK/m2" -DskipTests -Dmaven.javadoc.skip=true \
  -Dcheckstyle.skip -pl forge-gui-desktop -am compile dependency:build-classpath \
  -Dmdep.outputFile=target/runtime-classpath.txt -DincludeScope=runtime
) > "$FORGE_PLAY_WORK/public-forge-build.log" 2>&1 || { echo 'FAIL pinned public Forge build; no browser journey claimed.'; tail -n 35 "$FORGE_PLAY_WORK/public-forge-build.log"; exit 1; }
stage=host-contracts
(cd "$T/forge-host-service-rematch/composed" && npm run check) > "$FORGE_PLAY_WORK/private-host-checks.log" 2>&1 || { echo 'FAIL composed host contracts'; exit 1; }
stage=desktop
timeout --signal=TERM --kill-after=12s 205s bash "$SOURCE/ci/run-case.sh" desktop
stage=touch750
# A second independent native allocation is allowed only after desktop success
# and confirmed teardown. No simultaneous matches or background retries.
timeout --signal=TERM --kill-after=12s 205s bash "$SOURCE/ci/run-case.sh" touch750
stage=complete
