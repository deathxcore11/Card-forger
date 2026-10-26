#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
set -euo pipefail
cd /opt/forge-proof/forge
timeout --signal=TERM --kill-after=15s 900s mvn -B -ntp \
  -Dmaven.repo.local=/opt/m2 -DskipTests -Dmaven.javadoc.skip=true \
  -Dcheckstyle.skip -pl forge-gui-desktop -am compile dependency:build-classpath \
  -Dmdep.outputFile=target/runtime-classpath.txt -DincludeScope=runtime
CP=/opt/forge-proof/adapter/classes
for module in forge-core forge-game forge-ai forge-gui forge-gui-desktop; do
  CP="$CP:/opt/forge-proof/forge/$module/target/classes"
done
CP="$CP:$(cat forge-gui-desktop/target/runtime-classpath.txt)"
mkdir -p /opt/forge-proof/adapter/classes
# Actual pinned BUILD_IMAGE compiler must reproduce all12 reviewed AI classes.
# No local attestation is copied and no expected hashes are regenerated.
FORGE_SOURCE=/opt/forge-proof/forge FORGE_BASE_CP="$CP" FORGE_JAVA_HOME="$JAVA_HOME" \
  bash /opt/forge-proof/build-ai-overlay.sh
CP="/opt/forge-proof/cpu/runtime-classes:$CP"
FORGE_SOURCE=/opt/forge-proof/forge FORGE_BASE_CP="$CP" FORGE_JAVA_HOME="$JAVA_HOME" \
  bash /opt/forge-proof/build-human-overlay.sh
CP="/opt/forge-proof/human/runtime-classes:$CP"
javac -cp "$CP" -d /opt/forge-proof/adapter/classes \
  /opt/forge-proof/adapter/src/cardstashy/forge/*.java
java -cp "$CP" cardstashy.forge.NativeHumanPriorityProof /opt/forge-proof
# Exercise asynchronous native Auto/manual payment on the actual build-image
# bytecode. This fixture is not a browser or full-match acceptance result.
mkdir -p /tmp/native-payment-home
timeout --signal=TERM --kill-after=5s 90s java -Xmx1g -XX:ActiveProcessorCount=2 \
  -Djava.awt.headless=true -Dsentry.enabled=false -Duser.home=/tmp/native-payment-home \
  -Dproof.root=/opt/forge-proof -cp "$CP" cardstashy.forge.NativePaymentTransitionChecks \
  /opt/forge-proof/human/payment-transition-checks.json
rm -rf /tmp/native-payment-home
printf '%s' "$CP" > /opt/forge-proof/runtime-classpath.txt
test -z "$(git status --short --untracked-files=no)"
git rev-parse HEAD > /opt/forge-proof/notices/forge-revision.txt
# Retain the actual source tree, embedded jar notices and upstream license files.
# No source pruning: distribution review can inspect the exact source shipped.
rm -rf .git
