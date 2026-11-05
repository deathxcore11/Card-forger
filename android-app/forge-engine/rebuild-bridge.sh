#!/usr/bin/env bash
# Rebuild only the bridge classes inside an existing app engine build, without Maven or a Forge checkout.
# Forge, the reviewed CPU/human overlays and the engine pack stay byte for byte as they are; only cardstashy/forge/*
# classes from the host's adapter sources (plus patches/) are recompiled and swapped into forge-engine.jar.
#
#   rebuild-bridge.sh <host ref> <patch or -> <engine tgz in> <engine tgz out>
#
# The app engine (forge-engine-android-e5a0f81-pods.tgz) is the host's bridge at 0dbf4041: compiling that ref with no
# patch reproduces its bridge classes byte for byte. The lesson setup build (setup.stack + noMulligan, host PR #121):
#   rebuild-bridge.sh 0dbf4041 patches/setup-stack-on-0dbf4041.patch \
#     /mnt/project-files/android/forge-engine-build/forge-engine-android-e5a0f81-pods.tgz \
#     /mnt/project-files/android/forge-engine-build/forge-engine-android-e5a0f81-pods-setup.tgz
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd); REPO=$(cd "$HERE/../.." && pwd)
REF=$1; PATCH=$2; IN=$3; OUT=$4
[ "$PATCH" = "-" ] || PATCH=$(realpath "$PATCH")
JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}
W=$(mktemp -d); trap 'rm -rf "$W"' EXIT
A=experiments/forge-proof/combined-browser-proof/candidate/build-context/native/adapter/src/cardstashy/forge
git -C "$REPO" archive "$REF" "$A" | tar -x -C "$W"
SRC="$W/$A"
if [ "$PATCH" != "-" ]; then (cd "$SRC" && patch -p1 --forward --quiet < "$PATCH"); fi
python3 "$HERE/port-bridge.py" "$SRC" "$W/ported"
mkdir -p "$W/engine" "$W/classes"; tar -xzf "$IN" -C "$W/engine"
CP=$(ls "$W"/engine/android/libs/*.jar | tr '\n' ':')
# The phone's own pieces (LocalEngine, HeadlessGui, the http shim) come from the jar as they are.
"$JAVA_HOME/bin/javac" -nowarn --release 17 -d "$W/classes" -cp "$CP" "$W"/ported/*.java
(cd "$W/classes" && "$JAVA_HOME/bin/jar" --update --file "$W/engine/android/libs/forge-engine.jar" cardstashy/forge/*.class)
tar -czf "$OUT" -C "$W/engine" .
echo "ENGINE $(basename "$OUT") jar $(sha256sum "$W/engine/android/libs/forge-engine.jar" | cut -c1-16) pack $(cat "$W/engine/android/assets/forge-engine/pack.version")"
