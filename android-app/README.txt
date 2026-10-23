CARDSTASHY ANDROID — PORTABLE ENGINEERING SOURCE HANDOFF
Prepared 22 October 2026. This is source code, NOT an installable APK or a finished beta.

PURPOSE
This package makes the native Android integration transferable to another developer or
chatbot without access to the original working machine. It contains the full shared
frontend dependency graph and optional artwork inputs, the Capacitor Android project,
native adapters, build scripts, and synthetic regression tests. No backend deployment,
release signing identity, account credentials, or live user data is included.

CURRENT SAFETY STATUS
The exact Supabase callback https://cardstashy.com/auth/android/callback has already
been saved and verified; the two original allowlist entries remain unchanged.
Backend PR #31 exists. This does NOT establish deployment or native App Links/signing.
All online features remain deliberately gated OFF in runtime/native-entry.js,
CardStashyAuth.java, AndroidManifest.xml and the generated Content Security Policy.
Do not flip these flags merely to make the application appear online. Coordinated
backend deployment, approved signing/App Links configuration and actual device testing
must be completed before delivering an online full-feature beta. The full application
frontend is retained; this package is not evidence that every native feature works.

WHAT IS INCLUDED
- android/: Android source, resources, Gradle wrapper/build files and native unit tests.
- runtime/: native auth, browser networking/image transport, documents, artwork and UI.
- scripts/: guarded frontend transformations, build/integrity checks and focused tests.
- tests/: synthetic JS tests and a browser DOM fixture (not a physical-device test).
- shared-source/: explicit reviewed frontend source snapshot and optional artwork files.
- shared-source-manifest.json: SHA-256 and byte count for every snapshot file.
- source-baseline.json: reviewed version/commit provenance.
- offline-art-sources.json: exact identity/checksum mapping of optional artwork inputs.
- staging/: preparatory backend contract and UNINSTALLED App Links filter example.
- package-lock.json: exact JavaScript dependency resolution.

WHAT IS INTENTIONALLY EXCLUDED
node_modules, Gradle caches, build outputs, APKs, generated www/assets, local.properties,
Git metadata/history, internal working reports, local toolchains, account sessions,
keystores, release signing configuration, credentials and private operational notes.
The .jar in android/gradle/wrapper is the REQUIRED Gradle wrapper, not an app build.
Supabase URL and sb_publishable_ key in shared config are public application configuration,
not service-role credentials. Do not replace them with a private/service-role key.

SOURCE PROVENANCE / NO LOCAL-COMMIT DEPENDENCY
Reviewed shared version: 3.91.8
Pinned website commit: dfb1e8003025d9f50b5701b0f7ff3ac325949319 (re-pin with scripts/rebaseline-source.mjs)
Original source tree: 5542193fd5f4c84bf05b873f5baf4b349c41afaa
Upstream repository: https://github.com/deathxcore11/Card-forger
Equivalent public source commit: e569944d0a92e9942d3ac35114ca3164f4fa4105
Latest coordinated candidate: db767176 (changes only scripts/verify-deployed-assets.py
relative to that frontend tree; no frontend runtime changes). See the accompanying
handoff TXT for the current PR/deployment status, which can change after this export.

The original commit came from a local coordinated worktree; do not assume it can be
fetched from GitHub. This export deliberately includes a checksummed source SNAPSHOT.
The export build verifies every listed file against shared-source-manifest.json instead
of requiring that unavailable Git commit. No network checkout or hash substitution is
needed. This is a subset sufficient for the native build, NOT a complete backend repo.
The build still checks version/provenance, rejects source hash mismatches and uses exact
transformation anchors. Editing shared-source requires a deliberate reviewed rebaseline;
never bypass integrity checks by deleting them.

NEW-MACHINE SETUP (Linux/macOS shell; Windows can use WSL or equivalent commands)
1. Extract this ZIP, then change into cardstashy-android-portable.
2. Install Node.js 24 LTS, npm, JDK 21, Android SDK command-line tools, Android platform
   36 and build-tools 35.0.0. Accept Android SDK licenses through the normal SDK tooling.
   Tooling used: Android Gradle Plugin 8.13.0 and Gradle wrapper 8.14.3.
   Example SDK installation: sdkmanager "platforms;android-36" "build-tools;35.0.0" "platform-tools"
   Set JAVA_HOME and ANDROID_HOME to those local installations; add their tools to PATH.
   No original-machine paths or secret environment files are required.
3. Run:

   npm ci
   npm test
   npm run build:web
   npx cap copy android
   node scripts/verify-native-bundle.mjs
   node scripts/test-native-external-java.mjs
   ./android/gradlew -p android --no-daemon :app:compileDebugJavaWithJavac :app:testDebugUnitTest
   node scripts/check-release-readiness.mjs

   On Windows use android\gradlew.bat and the appropriate shell environment variables.
   The first npm/Gradle execution needs internet to download standard dependencies.
   Do not disable TLS validation or add unknown trust roots if a download fails.
   The release-readiness command is EXPECTED TO EXIT 2: no release evidence is bundled.

Alternatively, after npm ci and environment setup, scripts/build-android-local.sh runs
build/copy, Java compilation/unit tests and bundle verification. It does NOT assemble,
sign, publish or install an APK. Developer debug assembly can generate a local debug
keystore automatically; this handoff does not authorize creating release credentials.

Default builds use shared-source/ and do not require CARDSTASHY_SOURCE. If the variable
is set, it must point to an identical checked snapshot; files are still hash-verified.
Optional starter artwork is NOT bundled by default. All referenced originals are
included so the explicit opt-in build flag remains reproducible; do not interpret that
option as a completed downloadable/removable artwork experience.

IMPORTANT IMPLEMENTATION DETAILS
1. One full shared frontend, not a reduced rewrite. Guarded build transforms preserve
   accounts/cloud, decks, prices, AI, scanner, effects and export/import code paths.
2. Native services use ordinary browser fetch with exact origin/route/method/header
   policy. No native HTTP workaround, forged Origin, wildcard CORS or credential injection.
3. Auth uses system-browser PKCE and exact callback:
   https://cardstashy.com/auth/android/callback
   The expected native origin is https://android-integration.cardstashy.invalid.
4. Pending auth flows have ownership/expiry checks, one-shot completion and serialization
   across initiation, resend, password operations, signout and deletion. Cancellation is
   rejected while the SDK is writing a verifier; it must not clobber a newer operation.
5. Callback exchange runs in isolated SDK memory. A supported primary storage adapter
   synchronously rechecks account owner/epoch immediately before committing a session.
   This prevents stale adoption after SDK lock/network waits without erasing a newer
   account session. Recovery UI is restored after successful admission.
6. Native navigation blocks remote WebView reloads. External links use a system browser;
   credential-bearing query/fragment parameters are rejected in JS and Java.
7. Existing native file adapter waits for a real save receipt, preserving cancel/error.
   Artwork is app-private storage, not the phone gallery; uninstall removes it.
8. Website service-worker takeover is suppressed; no code OTA/remote app reload is used.

VALIDATION AND LIMITS
The final staged synthetic suite passed 100/100 before export. Android Java
compilation and native unit tests passed after Java URL hardening. Export validation
results are summarized separately in PORTABILITY-VALIDATION.txt. These are not physical
Android, live account, camera, browser-email callback or full parity results.
The browser DOM fixture has not been run in the available test environment (browser startup was
unavailable). Run it in a controlled local test browser without making live account calls.
No APK is included and no release readiness is claimed.

NEXT WORK FOR A COLLABORATING CHATBOT/DEVELOPER
- Read this file, run the exact checks, and inspect failed evidence before proposing fixes.
- Coordinate with the owner of the backend deployment; do not publish a second competing
  Worker deployment or silently change origins/callbacks.
- Obtain/confirm explicit signing identity and domain App Links authorization. The example
  filter is not installed and no association file or key is supplied here.
- Prepare a truthful full-feature beta for the user's phone once the safety/deployment
  dependencies are met. Test real account recovery/switching/cloud and interrupted callbacks,
  AI/scanner, deck/price/effect views, files, external links and offline behavior. Report
  failures honestly. Do not turn optional polish into unrelated blockers to user testing.
- Do not claim synthetic tests establish feature parity or a speed improvement.
- Never generate credentials, use service-role keys in frontend code, bypass server controls,
  or publish/sign/release without the required user authorization.
