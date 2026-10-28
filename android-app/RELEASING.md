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

The APK bundles the website's `release-record.js`, and the release gate compares it byte for byte,
ignoring only the `android` entry's `bytes` and `sha256`. So first commit, in the website repo, the
release itself: website version X (`package.json`, `config.js`) and its final `release-record.js`
(id, date, changes, `webVersion` X and the `android` entry's version, versionName, versionCode N,
interfaceVersion X, package and the new APK's href), leaving the previous `bytes` and `sha256` in place.
That commit is the `<commit>` pinned below. Changing anything else in the record after the build
means rebuilding and re-signing.

Work on a copy of this folder, so generated files stay out of the repo:

```sh
cp -r android-app /tmp/cardstashy-android && cd /tmp/cardstashy-android
npm ci
# Pin the website files to the commit being released. List any website file added since the last
# release as an extra argument (new files are not in the previous manifest).
node scripts/rebaseline-source.mjs /path/to/Card-forger <commit> [new-file.js ...]
# To find new files: with Card-forger checked out at <commit>, CARDSTASHY_SOURCE=/path/to/Card-forger
# npm run build:web lists every file the app needs in bundle-manifest.json sourceFiles; rebaseline
# again with the ones missing from shared-source-manifest.json.
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

If `app-release.apk` is 25 MiB or larger, Cloudflare will not serve it. Repack it smaller with the
same contents, then re-sign it with the same key:

```sh
python3 scripts/zopfli-repack.py app/build/outputs/apk/release/app-release.apk /tmp/z.apk
zipalign -f -p 4 /tmp/z.apk /tmp/za.apk
apksigner sign --ks <storeFile> --ks-key-alias <keyAlias> --min-sdk-version 24 \
  --v1-signing-enabled false --v3-signing-enabled false --out app-release.apk /tmp/za.apk
```

Then, in the website repo:

1. Copy `android/app/build/outputs/apk/release/app-release.apk` to
   `downloads/cardstashy-android-beta-<version>.apk` (remove the previous APK; older download links
   redirect to the current one).
2. Update `downloads/cardstashy-android-beta-<version>.apk.sha256`, `downloads/cardstashy-android-beta-<version>.json`
   (versionName, versionCode, bytes, sha256, appSource commit) and only `bytes` and `sha256` of the `android`
   entry in `release-record.js` (everything else in it was committed before the build).
3. Verify. This checks the signing certificate, package, version and that the app's built-in website files
   match this release, byte for byte:

   ```sh
   python3 scripts/verify-android-release.py --source . --apk downloads/cardstashy-android-beta-<version>.apk
   ```

   It must print `"releaseApproved": true`. Run `npm test` too.
4. Ship the website and the APK in the same merge.

Keep the copy of this folder in the repo in step with what was built: copy back any changed
native source or `android/app/build.gradle` version.
