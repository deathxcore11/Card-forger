#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
REV=e5a0f8156da70ffc7866f923bed371c0111707cd
if [[ ! -d "$ROOT/forge/.git" ]]; then
  git clone --no-checkout --filter=blob:none https://github.com/Card-Forge/forge.git "$ROOT/forge"
  git -C "$ROOT/forge" checkout --detach "$REV"
fi
[[ "$(git -C "$ROOT/forge" rev-parse HEAD)" == "$REV" ]] || { echo 'Existing Forge checkout is not the pinned proof revision; refusing to reset it.' >&2; exit 2; }
