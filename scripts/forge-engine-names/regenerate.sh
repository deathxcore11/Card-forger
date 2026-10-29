#!/usr/bin/env bash
# Rebuild forge-card-names-<rev>.txt from a Forge engine build, by asking the engine itself.
# Run whenever the engine changes (new Forge revision or new card scripts), then update
# ENGINE_CARD_NAMES_FILE in play-engine-names.js and the APK extras in android-app/scripts/build-web.mjs.
# Usage: scripts/forge-engine-names/regenerate.sh <forge-engine-android-*.tgz> <8-char forge revision>
# Needs a JDK 17+. Takes about 10 seconds.
set -euo pipefail
tgz=$1 rev=$2 here=$(cd "$(dirname "$0")" && pwd) repo=$(cd "$here/../.." && pwd) work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
tar xzf "$tgz" -C "$work" android/libs android/assets/forge-engine/pack.zip
unzip -q "$work/android/assets/forge-engine/pack.zip" -d "$work/root"
cp=$(ls "$work"/android/libs/*.jar | tr '\n' ':')
javac -cp "$cp" -d "$work/out" "$here/cardstashy/forge/EngineCardNames.java"
java -cp "$work/out:$cp" cardstashy.forge.EngineCardNames "$work/root" "$repo/forge-card-names-$rev.txt" 2> >(grep -v '^left out' | tail -1 >&2) >/dev/null
wc -l "$repo/forge-card-names-$rev.txt"
