#!/usr/bin/env bash
# Build the in-app Forge engine for the Android app: jars for app/libs and the engine pack
# (card scripts, rules data, the reviewed CPU/human overlay receipts) for the app's assets.
#
#   FORGE_SRC   Forge checkout at e5a0f8156d, already built with
#               mvn -pl forge-gui -am install dependency:build-classpath \
#                   -Dmdep.outputFile=target/runtime-classpath.txt -DincludeScope=runtime -DskipTests
#   HOST_REF    git ref of the Forge host branch in this repo (default origin/codex/forge-github-host-prep-20261026)
#
# Output: build/android/libs/*.jar and build/android/assets/forge-engine/pack.{zip,version}
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
: "${FORGE_SRC:?Set FORGE_SRC to a built Forge checkout}"
HOST_REF=${HOST_REF:-origin/codex/forge-github-host-prep-20261026}
JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}
test "$(git -C "$FORGE_SRC" rev-parse HEAD)" = e5a0f8156da70ffc7866f923bed371c0111707cd
OUT="$HERE/build"; rm -rf "$OUT"; mkdir -p "$OUT/work" "$OUT/android/libs" "$OUT/android/assets/forge-engine"
W="$OUT/work"

# 1. The host's native sources, as the server builds them.
git -C "$REPO" archive "$HOST_REF" experiments/forge-proof/combined-browser-proof/candidate/build-context/native | tar -x -C "$W"
N="$W/experiments/forge-proof/combined-browser-proof/candidate/build-context/native"
mkdir -p "$W/fp/cpu"
cp -r "$N/adapter" "$N/human" "$W/fp/"
mkdir -p "$W/fp/rules-data" && cp -r "$N/rules-data/current" "$W/fp/rules-data/"
cp "$N/cpu/combined-native-ai.patch" "$N/cpu/runtime-sha256.json" "$W/fp/cpu/"
cp "$N/build-ai-overlay.sh" "$N/build-human-overlay.sh" "$W/fp/"

# 2. The reviewed CPU and human overlays: the scripts refuse any bytecode that differs from review.
CP=""; for m in forge-core forge-game forge-ai forge-gui; do CP="$CP:$FORGE_SRC/$m/target/classes"; done
CP="${CP#:}:$(cat "$FORGE_SRC/forge-gui/target/runtime-classpath.txt")"
FORGE_SOURCE="$FORGE_SRC" FORGE_BASE_CP="$CP" FORGE_JAVA_HOME="$JAVA_HOME" bash "$W/fp/build-ai-overlay.sh"
CP="$W/fp/cpu/runtime-classes:$CP"
FORGE_SOURCE="$FORGE_SRC" FORGE_BASE_CP="$CP" FORGE_JAVA_HOME="$JAVA_HOME" bash "$W/fp/build-human-overlay.sh"
CP="$W/fp/human/runtime-classes:$CP"

# 3. The bridge with its phone changes, plus the in-app pieces.
python3 "$HERE/port-bridge.py" "$W/fp/adapter/src/cardstashy/forge" "$W/android-src/cardstashy/forge"
mkdir -p "$W/classes"
"$JAVA_HOME/bin/javac" -nowarn --release 17 -d "$W/classes" -cp "$CP" \
  "$W"/android-src/cardstashy/forge/*.java $(find "$HERE/src" -name '*.java')

# 4. One engine jar: Forge's classes and resources, the overlays on top, then the bridge.
J="$W/jar"; mkdir -p "$J"
for m in forge-core forge-game forge-ai forge-gui; do cp -r "$FORGE_SRC/$m/target/classes/." "$J/"; done
cp -r "$W/fp/cpu/runtime-classes/." "$W/fp/human/runtime-classes/." "$W/classes/." "$J/"
rm -f "$J"/META-INF/*.SF "$J"/META-INF/*.RSA "$J"/META-INF/*.DSA
(cd "$J" && "$JAVA_HOME/bin/jar" --create --file "$OUT/android/libs/forge-engine.jar" .)
# Forge's libraries, minus network play (netty, jetty, UPnP) which the app never starts.
tr ':' '\n' < "$FORGE_SRC/forge-gui/target/runtime-classpath.txt" | grep -Ev '/(netty|jetty|org\.jupnp|jakarta|javax\.servlet|forge-(core|game|ai|gui)-|listenablefuture-)' | while read -r jar; do
  [ -f "$jar" ] && cp "$jar" "$OUT/android/libs/"
done

# 5. The engine pack, unpacked on the phone once per version.
P="$W/pack"; R="$FORGE_SRC/forge-gui/res"; mkdir -p "$P/forge/forge-gui/res/languages" "$P/forge/forge-gui/res/cardsfolder" "$P/human" "$P/cpu" "$P/rules-data"
for d in ai blockdata defaults editions formats setlookup tokenscripts lists; do cp -r "$R/$d" "$P/forge/forge-gui/res/"; done
cp "$R/languages/en-US.properties" "$P/forge/forge-gui/res/languages/"
(cd "$R/cardsfolder" && zip -q -r -9 -X "$P/forge/forge-gui/res/cardsfolder/cardsfolder.zip" . -x '*.zip')
cp -r "$W/fp/human/runtime-sha256.json" "$W/fp/human/build-attestation.json" "$W/fp/human/runtime-classes" "$P/human/"
cp -r "$W/fp/cpu/runtime-sha256.json" "$W/fp/cpu/build-attestation.json" "$W/fp/cpu/runtime-classes" "$P/cpu/"
cp -r "$W/fp/rules-data/current" "$P/rules-data/"
(cd "$P" && zip -q -r -X "$OUT/android/assets/forge-engine/pack.zip" .)
VERSION="$(git -C "$REPO" rev-parse --short=12 "$HOST_REF")-$(sha256sum "$OUT/android/assets/forge-engine/pack.zip" | cut -c1-12)"
printf '%s\n' "$VERSION" > "$OUT/android/assets/forge-engine/pack.version"
ls -la "$OUT/android/libs" "$OUT/android/assets/forge-engine"
echo "ENGINE_PACK $VERSION"
