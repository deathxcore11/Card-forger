#!/usr/bin/env bash
# Read-only base source; patched GPL source + attested classes stay under this candidate.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
: "${FORGE_SOURCE:?}" "${FORGE_BASE_CP:?}" "${FORGE_JAVA_HOME:?}"
[[ "$(git -C "$FORGE_SOURCE" rev-parse HEAD)" == e5a0f8156da70ffc7866f923bed371c0111707cd ]]
git -C "$FORGE_SOURCE" diff --quiet
git -C "$FORGE_SOURCE" diff --cached --quiet
[[ "$(sha256sum "$HERE/cpu/combined-native-ai.patch" | cut -d' ' -f1)" == cd14c95185c4bfd44e90a809a6095f2027f23d102c1cf04464533ca545a0a4b1 ]]
mkdir -p "$HERE/cpu/native-source" "$HERE/cpu/runtime-classes" "$HERE/cpu/check-classes"
python3 - "$HERE" "$FORGE_SOURCE" <<'PY'
import pathlib,sys,shutil,subprocess
here,base=map(pathlib.Path,sys.argv[1:]);out=here/'cpu/native-source';patch=here/'cpu/combined-native-ai.patch'
if any(out.rglob('*.java')):raise RuntimeError('refuse to overwrite prior patched source; use a fresh build directory')
paths=[line[6:]for line in patch.read_text().splitlines()if line.startswith('+++ b/')]
for p in paths:
 rel=pathlib.PurePosixPath(p)
 assert p.startswith('forge-ai/src/main/java/forge/ai/')and'..'not in rel.parts and p.endswith('.java'),p
 src=base/p;dest=out/p;dest.parent.mkdir(parents=True,exist_ok=True)
 if src.exists():shutil.copyfile(src,dest)
subprocess.run(['git','-C',str(out),'apply','--check',str(patch)],check=True)
subprocess.run(['git','-C',str(out),'apply',str(patch)],check=True)
PY
mapfile -t SOURCES < <(find "$HERE/cpu/native-source" -name '*.java' -print | sort)
"$FORGE_JAVA_HOME/bin/javac" -cp "$FORGE_BASE_CP" -d "$HERE/cpu/runtime-classes" "${SOURCES[@]}"
"$FORGE_JAVA_HOME/bin/javac" -cp "$FORGE_BASE_CP" -d "$HERE/cpu/check-classes" "$HERE/adapter/src/cardstashy/forge/NativePatchsetProof.java"
"$FORGE_JAVA_HOME/bin/java" -cp "$HERE/cpu/check-classes:$HERE/cpu/runtime-classes:$FORGE_BASE_CP" cardstashy.forge.NativePatchsetProof
python3 - "$HERE" "$FORGE_JAVA_HOME" <<'PY'
import pathlib,json,hashlib,sys,subprocess,datetime
here,jdk=map(pathlib.Path,sys.argv[1:]);expected=json.loads((here/'cpu/runtime-sha256.json').read_text());actual={str(p.relative_to(here/'cpu/runtime-classes')):hashlib.sha256(p.read_bytes()).hexdigest()for p in (here/'cpu/runtime-classes').rglob('*.class')}
assert actual==expected,'Actual compiler artifacts differ from independently reviewed exact class set; no reattestation fallback permitted'
receipt={'schema':'cardstashy.native-ai-build-attestation.v1','forgeRevision':'e5a0f8156da70ffc7866f923bed371c0111707cd','compiledAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'javacVersion':subprocess.check_output([str(jdk/'bin/javac'),'-version'],stderr=subprocess.STDOUT,text=True).strip(),'javaVersion':subprocess.check_output([str(jdk/'bin/java'),'-version'],stderr=subprocess.STDOUT,text=True).strip(),'compilerOptions':['-cp','<pinned-native-engine-and-runtime-dependencies>','-d','<isolated-overlay>'],'classSetSha256':hashlib.sha256((here/'cpu/runtime-sha256.json').read_bytes()).hexdigest(),'classCount':len(actual),'classes':actual,'actualCompilerBytecodeMatchesReviewed':True,'differentCompilerHashFallbackAllowed':False}
(here/'cpu/build-attestation.json').write_text(json.dumps(receipt,indent=2)+'\n');print('PASS actual build JDK bytecode matches all',len(actual),'reviewed native classes')
PY
