#!/usr/bin/env bash
# Source/unit boundary only; no image/native/browser acceptance claimed here.
set -euo pipefail
export PYTHONDONTWRITEBYTECODE=1
HERE=$(cd "$(dirname "$0")" && pwd)
: "${FORGE_COMBINED_WORK:?}" "${FORGE_COMBINED_CANDIDATE_ROOT:?}"
node --test "$HERE"/test-*.mjs "$HERE"/local-oci/test-*.mjs "$HERE"/image-stages/test-*.mjs
python3 "$HERE/test-artifacts.py"
python3 "$HERE/test-collector.py"
python3 "$HERE/test-publisher.py"
python3 "$HERE/test-verify-inputs.py"
python3 "$HERE/local-oci/test-relay.py"
python3 "$HERE/image-stages/test-export.py"
cp -a "$FORGE_COMBINED_CANDIDATE_ROOT/host" "$FORGE_COMBINED_WORK/static-host"
(cd "$FORGE_COMBINED_WORK/static-host" && npm run check && python3 -m unittest discover -s tests -p 'test_*.py' && python3 -m unittest discover -s container/tests -p 'test_*.py')
