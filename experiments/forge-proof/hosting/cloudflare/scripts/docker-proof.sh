#!/usr/bin/env bash
# One bounded LOCAL/CI image build+offline container proof. NO push or deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
EXPECTED_NATIVE=586511f3e9bf28a6918ef696ce614e50b5dbdf55c0b14d9a54f1fd89967aeddd
[[ "${FORGE_PROOF_REVIEWED_NATIVE_SHA256:-}" == "$EXPECTED_NATIVE" ]] || { echo 'Exact0146 source review must be explicitly confirmed before Docker proof.' >&2; exit 64; }
command -v docker >/dev/null || { echo 'Docker is required for the bounded container proof.' >&2; exit 69; }
BUILD_IMAGE='maven:3.9.11-eclipse-temurin-21@sha256:463a1849665463254b2dd56e3a5b316f1596bc93d0571065c06ea05bb48ab8f4'
RUNTIME_IMAGE='eclipse-temurin:21-jre-jammy@sha256:8ecbec1f32912979c15b86aaf98f7082a77d318a7f92af3d9fe2c0fd2723df10'
CONTEXT=build-context-exact-0146
python3 - "$CONTEXT" "$EXPECTED_NATIVE" <<'PY'
import hashlib,json,pathlib,sys
p=pathlib.Path(sys.argv[1]); manifest=json.loads((p/'CONTEXT-SHA256.json').read_text())
for name,expected in manifest.items():
 f=p/name
 assert f.is_file() and not f.is_symlink() and hashlib.sha256(f.read_bytes()).hexdigest()==expected,name
source=p/'native/adapter/src/cardstashy/forge/ForgeHttpBridge.java'
assert hashlib.sha256(source.read_bytes()).hexdigest()==sys.argv[2]
PY
mkdir -p evidence/docker-proof
umask 077
private=$(mktemp -d); container=''; image='cardstashy-forge-proof:exact0146-local'
cleanup() {
  if [[ -n "$container" ]]; then timeout --signal=TERM --kill-after=5s 30s docker rm -f "$container" >/dev/null 2>&1 || true; fi
  rm -rf "$private"
}
trap cleanup EXIT INT TERM
# Build time bounded externally and by HOST's900s Maven deadline. No retry loop.
build_started=$SECONDS
set +e
timeout --signal=TERM --kill-after=30s 1200s docker build --platform linux/amd64 \
  --build-arg "BUILD_IMAGE=$BUILD_IMAGE" --build-arg "RUNTIME_IMAGE=$RUNTIME_IMAGE" \
  --tag "$image" "$CONTEXT" > "$private/build.log" 2>&1
build_exit=$?
set -e
printf '{"exitCode":%s,"seconds":%s,"rawLogUploaded":false}\n' "$build_exit" "$((SECONDS-build_started))" > evidence/docker-proof/build-summary.json
if [[ "$build_exit" != 0 ]]; then echo "Bounded Docker build failed (exit$build_exit); raw build log remains private and is removed by cleanup." >&2; exit "$build_exit"; fi
# Verify resolved immutable bases and final architecture, without dumping env.
docker image inspect "$image" --format '{"architecture":"{{.Architecture}}","id":"{{.Id}}","sizeBytes":{{.Size}}}' > evidence/docker-proof/image.json
python3 -c 'import json; assert json.load(open("evidence/docker-proof/image.json"))["architecture"] == "amd64"'
node --input-type=module - "$private" <<'JS'
import {readFileSync,writeFileSync} from 'node:fs';
import {digest} from './src/policy.mjs';
const directory=process.argv[2], input=JSON.parse(readFileSync('fixtures/bootstrap-existing.json','utf8')).input;
const internalToken=crypto.randomUUID()+crypto.randomUUID();
const expected={requestDigest:await digest(input),humanDigest:await digest(input.humanDeck),opponentDigest:await digest(input.opponentDeck)};
writeFileSync(directory+'/request.json',JSON.stringify({input,expected,internalToken}),{mode:0o600});
writeFileSync(directory+'/runtime.env','HOST_INTERNAL_TOKEN='+internalToken+'\nHOST_ABSOLUTE_DEADLINE_MS='+(Date.now()+180000)+'\n',{mode:0o600});
JS
container=$(docker run --detach --platform linux/amd64 --network none --memory 4g --memory-swap 4g --cpus .5 --pids-limit 256 \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /run/cardstashy:rw,noexec,nosuid,size=512m,uid=10001,gid=10001,mode=0700 \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m,mode=1777 --env-file "$private/runtime.env" "$image")
# Run localhost-only HTTP client within the already-running offline container.
timeout --signal=TERM --kill-after=10s 150s docker exec -i "$container" python3 -c "$(cat scripts/docker-proof-client.py)" \
  < "$private/request.json" > evidence/docker-proof/native.json
# Redacted aggregate measurements only; never dockerinspect Config.Env or logs.
docker stats --no-stream --format '{{json .}}' "$container" > evidence/docker-proof/resources.json
# Ask graceful shutdown, then bounded Docker enforcement. No accepted process is
# left running after success/failure; trap removes its private ephemeral files.
timeout --signal=TERM --kill-after=5s 20s docker stop --time 10 "$container" >/dev/null
docker inspect "$container" --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}' > evidence/docker-proof/stopped.txt
grep -qx 'exited 0 false' evidence/docker-proof/stopped.txt
printf '%s\n' "BUILD_IMAGE=$BUILD_IMAGE" "RUNTIME_IMAGE=$RUNTIME_IMAGE" "NATIVE_SOURCE_SHA256=$EXPECTED_NATIVE" 'memory=4GiB memorySwapTotal=4GiB cpu=0.5 pids=256 internet=disabled maxRuntime=180s noPush=true noDeploy=true' > evidence/docker-proof/inputs.txt
cat evidence/docker-proof/native.json
