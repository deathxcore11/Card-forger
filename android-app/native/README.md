# CardStashy Native (test app)

Kotlin + Jetpack Compose test app: Home → Quick Play → one of two demo decks → landscape table → a real CPU
match on the Forge engine inside the app → result. Package `com.cardstashy.app.nativetest`, so it installs
beside the live app and shares nothing with it. Plan: `/mnt/project-files/design/native/BUILD-PLAN.md`.

Build (JDK 21, Android SDK 36, build-tools 35):

```sh
scripts/prepare-assets.sh          # engine jars + pack, current rules bundle, demo-deck art, mats, sounds
echo sdk.dir=$ANDROID_HOME > local.properties
gradle :app:assembleRelease        # unsigned; Maven Central 429s → --max-workers=1
```

The release APK is zipaligned and unsigned; the APK thread signs it with the CardStashy release key, which
never enters this repository.

- `engine/ForgeService.kt` — CardStashyForge without Capacitor: pack unpack, weekly rules update, LocalEngine start.
- `engine/MatchState.kt` — the bridge snapshot fields the table reads.
- `match/MatchController.kt` — polling, the keep gate and the CPU pacing tiers (0.9 / 2.4 / 3.6 s).
- `ui/` — Home, deck pick, versus beat, table, sidebar, overlays.
