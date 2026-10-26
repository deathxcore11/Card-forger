#!/usr/bin/env bash
# Required real process gate BEFORE any browser install or image build.
set -euo pipefail
: "${FORGE_COMBINED_CANDIDATE_ROOT:?}"
: "${FORGE_COMBINED_WORK:?}"
HERE=$(cd "$(dirname "$0")" && pwd)
python3 "$HERE/cleanup-preflight.py"
