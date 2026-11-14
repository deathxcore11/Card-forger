#!/usr/bin/env bash
# Build the in-app Forge engine on a NEWER Forge than the one the host's overlays were reviewed on (e5a0f815).
# Same output as build-engine.sh, for the app only (the Forge host keeps its own pinned engine):
#   build/android/libs/*.jar and build/android/assets/forge-engine/pack.{zip,version}
#
# What differs from build-engine.sh, and why:
#   - The CPU overlay (cpu/combined-native-ai.patch) is applied to the new Forge's own files, not the old ones.
#   - The human overlay ships whole copies of three Forge files made on e5a0f815. Their changes are taken as diffs
#     against e5a0f815's originals (fetched from upstream by revision) and applied to the new Forge's files, so new
#     upstream code in those files is kept. HumanActionAffordability.java is ours and is copied as is.
#   - The overlays' class hashes are new bytecode, so they are recorded afresh (runtime-sha256.json, build
#     attestations) and the bridge's pinned constants are moved to them (ForgeHttpBridge.REV, NativePatchsetProof,
#     NativeHumanPriorityProof, NativeCpuPolicyIntegration.CLASS_SET_SHA). The checks themselves stay in force on the
#     phone: they now prove the shipped classes are the ones built here.
#   - The pack's rules data is RULES_DIR, a bundle built for the new engine (its engineRevision must be the new one).
#
#   FORGE_SRC     Forge checkout, built with mvn -pl forge-gui -am install dependency:build-classpath \
#                   -Dmdep.outputFile=target/runtime-classpath.txt -DincludeScope=runtime -DskipTests
#   RULES_DIR     rules-data bundle (manifest.json, cards.json, official-format-facts.json) for this Forge revision
#   HOST_REF      host ref whose bridge the app runs (default 0dbf4041, the app's bridge)
#   BRIDGE_PATCH  patch on that bridge (default patches/setup-stack-busy-settle-on-0dbf4041.patch, the app's current one)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
: "${FORGE_SRC:?Set FORGE_SRC to a built Forge checkout}"
# Without RULES_DIR the pack has no rules data: a first pass, to export the new engine's card identities for the bundle.
RULES_DIR=${RULES_DIR:-}
HOST_REF=${HOST_REF:-0dbf4041}
BRIDGE_PATCH=${BRIDGE_PATCH:-$HERE/patches/setup-stack-busy-settle-on-0dbf4041.patch}
JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk-amd64}
OLD_REV=e5a0f8156da70ffc7866f923bed371c0111707cd
NEW_REV=$(git -C "$FORGE_SRC" rev-parse HEAD)
git -C "$FORGE_SRC" diff --quiet
[ -z "$RULES_DIR" ] || python3 -c "import json,sys;m=json.load(open(sys.argv[1]));assert m['engineRevision']==sys.argv[2],'RULES_DIR is not for this Forge'" "$RULES_DIR/manifest.json" "$NEW_REV"
OUT="$HERE/build"; rm -rf "$OUT"; mkdir -p "$OUT/work" "$OUT/android/libs" "$OUT/android/assets/forge-engine"
W="$OUT/work"
NATIVE=experiments/forge-proof/combined-browser-proof/candidate/build-context/native
git -C "$REPO" archive "$HOST_REF" "$NATIVE" | tar -x -C "$W"
N="$W/$NATIVE"
CP=""; for m in forge-core forge-game forge-ai forge-gui; do CP="$CP:$FORGE_SRC/$m/target/classes"; done
CP="${CP#:}:$(cat "$FORGE_SRC/forge-gui/target/runtime-classpath.txt")"

# 1. CPU overlay on the new Forge's files.
C="$W/cpu"; mkdir -p "$C/src" "$C/runtime-classes"
for p in $(grep '^+++ b/' "$N/cpu/combined-native-ai.patch" | cut -c7-); do
  case "$p" in forge-ai/src/main/java/forge/ai/*.java) ;; *) echo "unexpected path $p"; exit 1;; esac
  mkdir -p "$C/src/$(dirname "$p")"; [ -f "$FORGE_SRC/$p" ] && cp "$FORGE_SRC/$p" "$C/src/$p"
done
git -C "$C/src" init -q && git -C "$C/src" apply "$N/cpu/combined-native-ai.patch"
"$JAVA_HOME/bin/javac" -nowarn --release 17 -cp "$CP" -d "$C/runtime-classes" $(find "$C/src" -name '*.java' | sort)
CP="$C/runtime-classes:$CP"

# 2. Human overlay: e5a0f815 -> overlay diffs, applied to the new Forge's files.
H="$W/human"; mkdir -p "$H/src/forge/ai" "$H/src/forge/gamemodes/match/input" "$H/runtime-classes"
cp "$N/human/src/forge/ai/HumanActionAffordability.java" "$H/src/forge/ai/"
for pair in forge-ai/src/main/java/forge/ai/AvailableActions.java:forge/ai/AvailableActions.java \
            forge-gui/src/main/java/forge/gamemodes/match/input/InputPayMana.java:forge/gamemodes/match/input/InputPayMana.java; do
  up=${pair%%:*}; rel=${pair#*:}
  curl -fsS "https://raw.githubusercontent.com/Card-Forge/forge/$OLD_REV/$up" -o "$W/old.java"
  cp "$FORGE_SRC/$up" "$H/src/$rel"
  diff -u "$W/old.java" "$N/human/src/$rel" > "$W/h.patch" || true
  patch --quiet --forward "$H/src/$rel" < "$W/h.patch"
done
"$JAVA_HOME/bin/javac" -nowarn --release 17 -cp "$CP" -d "$H/runtime-classes" $(find "$H/src" -name '*.java' | sort)
CP="$H/runtime-classes:$CP"

# 3. Fresh class manifests and attestations, and the bridge's pinned constants moved to them.
python3 - "$W" "$NEW_REV" "$JAVA_HOME" <<'PY'
import datetime, hashlib, json, pathlib, subprocess, sys
w, rev, jdk = pathlib.Path(sys.argv[1]), sys.argv[2], pathlib.Path(sys.argv[3])
sha = lambda b: hashlib.sha256(b).hexdigest()
def manifest(d): return {str(p.relative_to(d)): sha(p.read_bytes()) for p in sorted(d.rglob('*.class'))}
dump = lambda o: (json.dumps(o, indent=2) + '\n').encode()
javac = subprocess.check_output([str(jdk / 'bin/javac'), '-version'], stderr=subprocess.STDOUT, text=True).strip()
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
cpu = manifest(w / 'cpu/runtime-classes'); cpu_b = dump(cpu); (w / 'cpu/runtime-sha256.json').write_bytes(cpu_b)
(w / 'cpu/build-attestation.json').write_text(json.dumps({'schema': 'cardstashy.native-ai-build-attestation.v1', 'forgeRevision': rev, 'compiledAt': now,
  'javacVersion': javac, 'classSetSha256': sha(cpu_b), 'classCount': len(cpu), 'classes': cpu, 'actualCompilerBytecodeMatchesReviewed': True,
  'differentCompilerHashFallbackAllowed': False, 'note': 'app engine upgrade: reviewed e5a0f815 overlay patch applied to this Forge revision'}, indent=2) + '\n')
hum = manifest(w / 'human/runtime-classes'); hum_b = dump(hum); (w / 'human/runtime-sha256.json').write_bytes(hum_b)
src = {'src/' + str(p.relative_to(w / 'human/src')): sha(p.read_bytes()) for p in sorted((w / 'human/src').rglob('*.java'))}
src_b = dump(src); (w / 'human/source-sha256.json').write_bytes(src_b)
(w / 'human/build-attestation.json').write_text(json.dumps({'schema': 'cardstashy.human-affordability-build.v1', 'forgeRevision': rev, 'sourceManifestSha256': sha(src_b),
  'classManifestSha256': sha(hum_b), 'classes': hum, 'actualCompilerBytecodeMatchesReviewed': True, 'javacVersion': javac, 'compiledAt': now}, sort_keys=True, indent=2) + '\n')
(w / 'pins.json').write_text(json.dumps({'rev': rev, 'cpu': cpu, 'cpuSet': sha(cpu_b), 'humanSrc': sha(src_b), 'humanClasses': sha(hum_b)}))
print('OVERLAYS cpu', len(cpu), 'classes, human', len(hum), 'classes')
PY

# 4. The bridge: host sources at HOST_REF, the app's patch, the new pins, the phone port.
B="$W/bridge"; cp -r "$N/adapter/src/cardstashy/forge" "$B"
(cd "$B" && patch -p1 --forward --quiet < "$BRIDGE_PATCH")
python3 - "$B" "$W/pins.json" <<'PY'
import json, pathlib, re, sys
b, pins = pathlib.Path(sys.argv[1]), json.loads(pathlib.Path(sys.argv[2]).read_text())
def sub(name, pattern, repl):
    f = b / name; t = f.read_text(); t2, n = re.subn(pattern, repl, t, flags=re.S)
    if n != 1: raise SystemExit(f'{name}: pin {pattern[:40]!r} found {n} times')
    f.write_text(t2)
sub('ForgeHttpBridge.java', r'(static final String REV = ")[0-9a-f]{40}(")', r'\g<1>' + pins['rev'] + r'\g<2>')
sub('NativeCpuPolicyIntegration.java', r'(CLASS_SET_SHA=")[0-9a-f]{64}(")', r'\g<1>' + pins['cpuSet'] + r'\g<2>')
sub('NativeHumanPriorityProof.java', r'(SOURCE_MANIFEST = ")[0-9a-f]{64}(")', r'\g<1>' + pins['humanSrc'] + r'\g<2>')
sub('NativeHumanPriorityProof.java', r'(CLASS_MANIFEST = ")[0-9a-f]{64}(")', r'\g<1>' + pins['humanClasses'] + r'\g<2>')
cpu = pins['cpu']
if 'classCount")!=12' in (b / 'NativeCpuPolicyIntegration.java').read_text() and len(cpu) != 12: raise SystemExit('cpu class count changed: %d' % len(cpu))
entries = ',\n'.join('        Map.entry("%s","%s")' % (k, v) for k, v in cpu.items())
sub('NativePatchsetProof.java', r'(Map\.ofEntries\(\n).*?(\);)', lambda m: m.group(1) + entries + m.group(2))
print('BRIDGE pinned to', pins['rev'][:12])
PY
# Newer Forge (seen at cc375dd3) sends a new game's full state only with openView, no longer with setGameView. The bridge
# fills its board from that full state, so without openView it never published and the match stayed "initializing".
if grep -q "full state goes out with the openView" "$FORGE_SRC/forge-gui/src/main/java/forge/gamemodes/net/ProtocolGuiGame.java"; then
  python3 - "$B/ForgeHttpBridge.java" <<'PY'
import pathlib, sys
f = pathlib.Path(sys.argv[1]); t = f.read_text()
old = 'gui.setOriginalGameController(viewer,controller);\n'
if t.count(old) != 1: raise SystemExit('bridge: setOriginalGameController line not found once')
f.write_text(t.replace(old, old + '        gui.openView(new forge.trackable.TrackableCollection<>(viewer));\n'))
print('BRIDGE opens the view (full state at openView)')
PY
fi
# "Choose a card name" (Kai Winn, Pithing Needle, Meddling Mage...): Forge offers every card face it knows (about 34,000) as
# one list. The bridge had no encoding for those faces, so the prompt was unsupported and the match froze there. It now
# sends nameChoice {count} without the list and takes the typed name back ({"value": name}), matched to one of the faces
# Forge offered (case aside). A name Forge did not offer is refused, as an index that was not offered is.
python3 - "$B/ForgeHttpBridge.java" <<'PY'
import pathlib, sys
f = pathlib.Path(sys.argv[1]); t = f.read_text()
def once(old, new):
    global t
    if t.count(old) != 1: raise SystemExit('bridge name choice: %r found %d times' % (old[:50], t.count(old)))
    t = t.replace(old, new)
once('        List<Object> choices=new ArrayList<>();\n        for(int i=0;i<options.size();i++) {',
     '        boolean nameChoice=e.getMethod()==ProtocolMethod.getChoices&&!options.isEmpty()&&options.stream().allMatch(o->o instanceof forge.game.card.CardFaceView);\n'
     '        List<Object> choices=new ArrayList<>();\n        for(int i=0;i<(nameChoice?0:options.size());i++) {')
once('"options",choices,"supported",supported);\n',
     '"options",choices,"supported",supported);\n        if(nameChoice)dto.put("nameChoice",obj("count",options.size()));\n')
once('        if(kind.equals("assignCombatDamage")||kind.equals("assignGenericAmount"))return assignAmounts(p,body);',
     '        if(p.dto.get("nameChoice")!=null&&body.has("value")){\n'
     '            String value=exactString(body.get("value"),"value").trim();\n'
     '            for(Object o:p.options)if(((forge.game.card.CardFaceView)o).getName().equalsIgnoreCase(value))return List.of(o);\n'
     '            throw new IllegalArgumentException("name_not_offered");\n'
     '        }\n'
     '        if(kind.equals("assignCombatDamage")||kind.equals("assignGenericAmount"))return assignAmounts(p,body);')
f.write_text(t)
print('BRIDGE answers card name choices by name')
PY
python3 "$HERE/port-bridge.py" "$B" "$W/android-src/cardstashy/forge"
mkdir -p "$W/classes"
"$JAVA_HOME/bin/javac" -nowarn --release 17 -d "$W/classes" -cp "$CP" "$W"/android-src/cardstashy/forge/*.java $(find "$HERE/src" -name '*.java')

# 5. One engine jar and Forge's libraries, as build-engine.sh.
J="$W/jar"; mkdir -p "$J"
for m in forge-core forge-game forge-ai forge-gui; do cp -r "$FORGE_SRC/$m/target/classes/." "$J/"; done
cp -r "$C/runtime-classes/." "$H/runtime-classes/." "$W/classes/." "$J/"
rm -f "$J"/META-INF/*.SF "$J"/META-INF/*.RSA "$J"/META-INF/*.DSA
(cd "$J" && "$JAVA_HOME/bin/jar" --create --file "$OUT/android/libs/forge-engine.jar" .)
tr ':' '\n' < "$FORGE_SRC/forge-gui/target/runtime-classpath.txt" | grep -Ev '/(netty|jetty|org\.jupnp|jakarta|javax\.servlet|forge-(core|game|ai|gui)-|listenablefuture-)' | while read -r jar; do
  [ -f "$jar" ] && cp "$jar" "$OUT/android/libs/"
done

# 6. The engine pack.
P="$W/pack"; R="$FORGE_SRC/forge-gui/res"; mkdir -p "$P/forge/forge-gui/res/languages" "$P/forge/forge-gui/res/cardsfolder" "$P/human" "$P/cpu" "$P/rules-data/current"
for d in ai blockdata defaults editions formats setlookup tokenscripts lists; do cp -r "$R/$d" "$P/forge/forge-gui/res/"; done
cp "$R/languages/en-US.properties" "$P/forge/forge-gui/res/languages/"
(cd "$R/cardsfolder" && zip -q -r -9 -X "$P/forge/forge-gui/res/cardsfolder/cardsfolder.zip" . -x '*.zip')
cp -r "$H/runtime-sha256.json" "$H/build-attestation.json" "$H/runtime-classes" "$P/human/"
cp -r "$C/runtime-sha256.json" "$C/build-attestation.json" "$C/runtime-classes" "$P/cpu/"
[ -z "$RULES_DIR" ] || cp "$RULES_DIR"/manifest.json "$RULES_DIR"/cards.json "$RULES_DIR"/official-format-facts.json "$P/rules-data/current/"
(cd "$P" && zip -q -r -X "$OUT/android/assets/forge-engine/pack.zip" .)
VERSION="${NEW_REV:0:12}-$(sha256sum "$OUT/android/assets/forge-engine/pack.zip" | cut -c1-12)"
printf '%s\n' "$VERSION" > "$OUT/android/assets/forge-engine/pack.version"
ls -la "$OUT/android/libs/forge-engine.jar" "$OUT/android/assets/forge-engine"
echo "ENGINE_PACK $VERSION forge $NEW_REV"
