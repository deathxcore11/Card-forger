#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/adapter/classpath.sh"
"${FORGE_JAVA_HOME:-${JAVA_HOME:-$ROOT/tools/jdk21}}/bin/javac" -cp "$CP" -d "$ROOT/adapter/classes" "$ROOT/adapter/src/cardstashy/forge/NativeSmoke.java"
D1="${3:-keen-engineering}"; D2="${4:-reign-of-dragons}"
for deck in "$D1" "$D2"; do case "$deck" in calling-all-angels|keen-engineering|reign-of-dragons) ;; *) echo "Unknown deck alias" >&2; exit 2;; esac; done
exec "${FORGE_JAVA_HOME:-${JAVA_HOME:-$ROOT/tools/jdk21}}/bin/java" -Xmx2g -Djava.awt.headless=true -Dsentry.enabled=false -Duser.home="$ROOT/home" -Dforge.assets="$ROOT/forge/forge-gui/" -cp "$CP" cardstashy.forge.NativeSmoke sim -D "$ROOT/decks" -d "$D1.dck" "$D2.dck" -f Commander -a Default Default -s "${1:-20261025}" -n "${2:-1}" -c 300
