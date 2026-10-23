# Building and releasing the CardStashy Android app

This folder is the Android (Capacitor) project for `com.cardstashy.app`: the native Java
(`android/app/src/main/java/dev/cardstashy/integration/`, including the Back button bridge in
`MainActivity.java` and pack haptics in `CardStashyHaptics.java`), the native runtime that wraps the
website (`runtime/`), and the build scripts. The README.txt beside this file is the original
hand-off and describes the design; this file is the current release procedure.

It never contains signing material. The release key, its passwords and `signing.properties` stay
with the owner, outside the repository. Every update must be signed with that same key, or
Android will refuse to install it over the existing app.

Not committed, because each is regenerated: `node_modules/`, `www/`, `shared-source/` (a
checksummed copy of the website files, rebuilt from this repo), `staging/`, Gradle caches and
build outputs, and the Capacitor-generated `android/app/src/main/assets/public`,
`android/capacitor-cordova-android-plugins/` and `res/xml/config.xml`.
`.assetsignore` keeps this folder off cardstashy.com.

## Toolchain

Node.js 22+, JDK 21, Android SDK platform 36 and build-tools 35.0.0 (Gradle wrapper 8.14.3, AGP 8.13.0).

## One release (website version X, app versionCode N)

Work on a copy of this folder, so generated files stay out of the repo:

```sh
cp -r android-app /tmp/cardstashy-android && cd /tmp/cardstashy-android
npm ci
# Pin the website files to the commit being released. List any website file added since the last
# release as an extra argument (new files are not in the previous manifest).
node scripts/rebaseline-source.mjs /path/to/Card-forger <commit> [new-file.js ...]
# In android/app/build.gradle raise versionCode (must be higher than the published one) and versionName.
npm run build:web
npx cap sync android
# Backend contract tests exercise the server-only module at this same commit.
mkdir -p staging
git -C /path/to/Card-forger show <commit>:native-backend-contract.js > staging/native-backend-contract.js
git -C /path/to/Card-forger show <commit>:native-service-policy.js > staging/native-service-policy.js
npm test
cd android
CARDSTASHY_SIGNING=/secure/path/signing.properties ./gradlew :app:testDebugUnitTest :app:assembleRelease
```

`signing.properties` holds `storeFile`, `storePassword`, `keyAlias` and `keyPassword`. Without it the
release build is unsigned and must not be published.

Then, in the website repo:

1. Copy `android/app/build/outputs/apk/release/app-release.apk` to
   `downloads/cardstashy-android-beta-<version>.apk` (remove the previous APK; older download links
   redirect to the current one).
2. Update `downloads/cardstashy-android-beta-<version>.apk.sha256`, `downloads/cardstashy-android-beta-<version>.json`
   (versionName, versionCode, bytes, sha256, appSource commit) and the `android` entry in `release-record.js`
   (version, versionCode, interfaceVersion = website version, href, bytes, sha256).
3. Verify. This checks the signing certificate, package, version and that the app's built-in website files
   match this release, byte for byte:

   ```sh
   python3 scripts/verify-android-release.py --source . --apk downloads/cardstashy-android-beta-<version>.apk
   ```

   It must print `"releaseApproved": true`. Run `npm test` too.
4. Ship the website and the APK in the same merge.

Keep the copy of this folder in the repo in step with what was built: copy back any changed
native source or `android/app/build.gradle` version.
