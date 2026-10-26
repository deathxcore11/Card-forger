#!/usr/bin/env bash
# LOCAL executable proposal. Root review/approval is required before invoking.
set -euo pipefail
umask 077
[[ "${FORGE_COMBINED_REVIEWED_MANIFEST_SHA256:-}" =~ ^[a-f0-9]{64}$ ]] || { echo 'Reviewed combined manifest gate required.' >&2; exit 64; }
[[ $# -ge 2 && $# -le 3 ]] || { echo 'Usage: build-and-probe.sh CANDIDATE_ROOT PRIVATE_WORK [PUBLIC_FIXTURE_DECKS]' >&2; exit 64; }
HERE=$(cd "$(dirname "$0")" && pwd)
export FORGE_COMBINED_CANDIDATE_ROOT=$(realpath "$1")
exec node "$HERE/build-and-probe.mjs" "$1" "$2" "${3:-$1/ui/fixture-decks.json}"
