#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Compile a reviewed human-only overlay; never rewrite expected hashes.
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
: "${FORGE_SOURCE:?}" "${FORGE_BASE_CP:?}" "${FORGE_JAVA_HOME:?}"
test "$(git -C "$FORGE_SOURCE" rev-parse HEAD)" = e5a0f8156da70ffc7866f923bed371c0111707cd
git -C "$FORGE_SOURCE" diff --quiet
git -C "$FORGE_SOURCE" diff --cached --quiet
python3 - "$HERE" <<'PY'
import pathlib,sys,json,hashlib
root=pathlib.Path(sys.argv[1])/'human'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(root/'source-sha256.json')=='a51adddc0000ee80916fb290bb7e31514181b5373b033866bf43ad49cad64f9c'
assert sha(root/'runtime-sha256.json')=='e22e7d45a8a7f2aee5bedc168d2ca6d500a7e5894797ee7418bfcbdb93e1ab69'
expected=json.loads((root/'source-sha256.json').read_text())
actual={str(p.relative_to(root)):sha(p) for p in (root/'src').rglob('*') if p.is_file()}
assert actual==expected,'Human source differs from reviewed source manifest'
assert not any((root/'runtime-classes').rglob('*.class')),'Use a fresh build directory'
PY
mkdir -p "$HERE/human/runtime-classes"
"$FORGE_JAVA_HOME/bin/javac" -cp "$FORGE_BASE_CP" -d "$HERE/human/runtime-classes" \
  "$HERE/human/src/forge/ai/AvailableActions.java" \
  "$HERE/human/src/forge/ai/HumanActionAffordability.java"
python3 - "$HERE" "$FORGE_JAVA_HOME" <<'PY'
import pathlib,sys,json,hashlib,subprocess,datetime
here,jdk=map(pathlib.Path,sys.argv[1:]);root=here/'human'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected=json.loads((root/'runtime-sha256.json').read_text())
actual={str(p.relative_to(root/'runtime-classes')):sha(p) for p in (root/'runtime-classes').rglob('*.class')}
assert actual==expected,'Human bytecode differs from reviewed classes; no reattestation fallback'
receipt={'schema':'cardstashy.human-affordability-build.v1','forgeRevision':'e5a0f8156da70ffc7866f923bed371c0111707cd','sourceManifestSha256':sha(root/'source-sha256.json'),'classManifestSha256':sha(root/'runtime-sha256.json'),'classes':actual,'actualCompilerBytecodeMatchesReviewed':True,'javacVersion':subprocess.check_output([str(jdk/'bin/javac'),'-version'],text=True).strip(),'compiledAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(root/'build-attestation.json').write_text(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
print('PASS human affordability build reproduces all',len(actual),'reviewed classes')
PY
