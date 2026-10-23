# Compact set layout: coordinated Android release

The patch preserves the current 3.92.0 product features, combines set identity and collection progress, puts search above compact controls, and reduces grid frames by 25%. Release the website together with a matching APK built by the existing production Android pipeline.

## Pack artwork and update-check fixes

The shipped 0.4.0 APK's `ImageCache` checks encoded queries against `^[A-Za-z0-9=&._%-]{0,200}$`. Its transport preserves the query. Pack URLs used form-encoded spaces (`Paradox+Rift`), which the cache rejected before downloading. `packArtUrl()` now uses `%20` for spaces and `%2A` for literal asterisks, retaining the exact set name and existing image-cache path. This covers the home pack and pack opener for all three games. Live Paradox Rift and Legend of Blue Eyes White Dragon image endpoints returned JPEGs during investigation.

The installed version label is `3.92.0 · Android app 0.4.0-beta`. The previous parser read `app` as the version, incorrectly offering an update to the same APK. The parser now accepts both `Android app <version>` and `Android <version>` and still prefers actual native build metadata.

The old native transport policy omitted `/api/releases/current`, so update checks failed before fetching. The repository's `native-service-policy.js` now contains the existing native request planner and updated shared route inventory. It retains the request restrictions and exact canonical-path validation.

## Android builder integration

1. Use the current production `com.cardstashy.app` project and existing signing custody that produced 0.4.0. The older `dev.cardstashy.integration` portable source is not a replacement release project.
2. Build the shared app from this PR's final commit and apply the reviewed transforms in `scripts/android-native/bundle.mjs`.
3. Copy the repository-root `native-service-policy.js` **verbatim** into `www/native-service-policy.js`. Do not overwrite it with an older native-shell copy. `native-transport.js` already imports its `resolveServiceURL` and `planServiceRequest` exports. The release gate now checks this native-only asset as well as the shared interface.
4. Increment the production Android version code; coordinate website/interface versions and release notes. Keep the package, origin, storage, and signing certificate unchanged. Fill in artifact checksum/size after signing; do not relabel the old APK.
5. Run `python scripts/verify-android-release.py --source . --apk <signed-apk>` with `apksigner` and `apkanalyzer`. A `--bundle-only` result cannot approve a release.
6. Verify an in-place upgrade on a device: saved collection/decks and login survive; Pokémon Paradox Rift and a multi-word Yu-Gi-Oh! release show pack art on Home and in the opener; update checking reports the installed version correctly. Test portrait/landscape layout and set search, filters, sorts, and all views.

The current workspace has the published APK and reviewed transforms, but not the production Gradle project or signing workflow. No replacement APK has been built, signed, or published here. Hosted browser checks and URL-policy tests do not substitute for the Android update test above.

## Built artifact (0.4.1)

`downloads/cardstashy-android-beta-0.4.1.apk`: com.cardstashy.app 0.4.1-beta, versionCode 6,
25,896,363 bytes, SHA-256 `5bda66162fe5ceeef26af87bef92c3699cea816cdd039c2d4301649f59c2492e`,
signed with the established certificate (E6:E4:01…3F:55), interface 3.92.1 from commit `d9bf1c2`.
Built by the production com.cardstashy.app pipeline (the one that produced 0.4.0) with the
repository's `native-service-policy.js` copied verbatim into the native runtime. Release gate:
241 shared assets (including the native policy), 0 errors, `releaseApproved: true`.
