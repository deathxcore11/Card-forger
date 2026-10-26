#!/usr/bin/env bash
# Source/unit boundary only; no image/native/browser acceptance claimed here.
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
HERE=$(cd "$(dirname "$0")" && pwd)
: "${FORGE_COMBINED_WORK:?}" "${FORGE_COMBINED_CANDIDATE_ROOT:?}"
check(){ local name=$1;shift;printf '%s\n' "$name" > "$FORGE_COMBINED_WORK/static-check-stage";"$@"; }
check harness-node node --test "$HERE"/test-*.mjs "$HERE"/local-oci/test-*.mjs "$HERE"/image-stages/test-*.mjs
check artifact-python python3 "$HERE/test-artifacts.py"
check collector-python python3 "$HERE/test-collector.py"
check publisher-python python3 "$HERE/test-publisher.py"
check source-verification-python python3 "$HERE/test-verify-inputs.py"
check relay-python python3 "$HERE/local-oci/test-relay.py"
check export-python python3 "$HERE/image-stages/test-export.py"
printf 'host-copy\n' > "$FORGE_COMBINED_WORK/static-check-stage"
cp -a "$FORGE_COMBINED_CANDIDATE_ROOT/host" "$FORGE_COMBINED_WORK/static-host"
cd "$FORGE_COMBINED_WORK/static-host"
check host-node npm run check
check host-python python3 -m unittest discover -s tests -p 'test_*.py'
check container-python python3 -m unittest discover -s container/tests -p 'test_*.py'
printf 'complete\n' > "$FORGE_COMBINED_WORK/static-check-stage"
