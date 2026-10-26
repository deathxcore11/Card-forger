#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/adapter/classpath.sh"
"${FORGE_JAVA_HOME:-${JAVA_HOME:-$ROOT/tools/jdk21}}/bin/javac" -cp "$CP" -d "$ROOT/adapter/classes" "$ROOT/adapter/src/cardstashy/forge/ForgeHttpBridge.java" "$ROOT/adapter/src/cardstashy/forge/NativeDeckInput.java" "$ROOT/adapter/src/cardstashy/forge/NativeDeckAdmission.java"
exec "${FORGE_JAVA_HOME:-${JAVA_HOME:-$ROOT/tools/jdk21}}/bin/java" -Xmx2g -Djava.awt.headless=true -Dsentry.enabled=false -Duser.home="$ROOT/home" -Dproof.root="$ROOT" -Dproof.port="${1:-8765}" -Dproof.seed="${2:-20261025}" -Dproof.controlMode="${5:-full}" -Dproof.humanDeck="${3:-calling-all-angels}" -Dproof.aiDeck="${4:-keen-engineering}" -cp "$CP" cardstashy.forge.ForgeHttpBridge
