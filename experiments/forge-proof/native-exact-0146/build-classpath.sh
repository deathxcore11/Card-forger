#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$ROOT/tools"
cd "$ROOT/forge"
python - <<'PY'
import os, urllib.parse
p=urllib.parse.urlparse(os.environ.get('HTTPS_PROXY',''))
proxies=f'<proxies><proxy><id>workspace-proxy</id><active>true</active><protocol>http</protocol><host>{p.hostname}</host><port>{p.port}</port><nonProxyHosts>localhost|127.0.0.1</nonProxyHosts></proxy></proxies>' if p.hostname else ''
open('../tools/maven-settings.xml','w').write(f'<settings xmlns="http://maven.apache.org/SETTINGS/1.2.0">{proxies}</settings>')
PY
export JAVA_HOME="${FORGE_JAVA_HOME:-${JAVA_HOME:-$ROOT/tools/jdk21}}"
MVN="${FORGE_MVN:-$(command -v mvn || printf '%s' "$ROOT/tools/apache-maven-3.9.11/bin/mvn")}"
if [[ -f /etc/ssl/certs/java/cacerts ]]; then
  export MAVEN_OPTS="${MAVEN_OPTS:-} -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts"
fi
exec "$MVN" -s "$ROOT/tools/maven-settings.xml" -U -B -ntp -Dmaven.repo.local="$ROOT/tools/m2" -DskipTests -Dmaven.javadoc.skip=true -Dcheckstyle.skip -pl forge-gui-desktop -am compile dependency:build-classpath -Dmdep.outputFile=target/runtime-classpath.txt -DincludeScope=runtime
