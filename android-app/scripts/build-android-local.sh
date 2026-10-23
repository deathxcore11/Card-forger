#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${JAVA_HOME:?Set JAVA_HOME to JDK 21}"
: "${ANDROID_HOME:?Set ANDROID_HOME to your Android SDK}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npm run build:web
./node_modules/.bin/cap copy android
./android/gradlew -p android --no-daemon :app:compileDebugJavaWithJavac :app:testDebugUnitTest
node scripts/verify-native-bundle.mjs
# No APK assembly/signing/publication is performed by this helper.
