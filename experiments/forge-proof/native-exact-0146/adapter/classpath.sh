#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CP="$ROOT/adapter/classes"
for module in forge-core forge-game forge-ai forge-gui forge-gui-desktop; do CP="$CP:$ROOT/forge/$module/target/classes"; done
CP="$CP:$(cat "$ROOT/forge/forge-gui-desktop/target/runtime-classpath.txt")"
export ROOT CP
