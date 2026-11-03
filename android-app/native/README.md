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

Checks: `ENGINE_ROOT=<unpacked pack.zip> gradle :app:testDebugUnitTest --rerun` plays a full CPU match on the real
engine (desktop JVM) through `MatchState.parse` and `Pacing`, as either deck (`SWAP=1`), and fails if the CPU
acts before the keep.

Next patch (architect review, 3 Nov):
- A snapshot that carries several CPU actions is drawn whole before its beats play; the spec wants board and feed
  to advance per action.
- The Assign button splits combat damage lethal-first automatically; let the player adjust the split by hand
  before confirming.

## Open items (0.2.0)

- Collection mode is a WebView of cardstashy.com with its own session: you sign in there separately until a token hand-off exists. It also lacks the beta's native parts (scanner camera, haptics, file store) until step 3.
- Tokens are in app-private SharedPreferences; move to EncryptedSharedPreferences later.
- Pass-bar timings (sign-in to decks, known deck under 3 s, new deck under 6 s) come from a phone; the Quick Play screen shows the last of each.

## Open items (0.1.3)
- Frame time: the p99 < 8 ms check during a 7-card swipe needs a real phone (Randall's Fold); there is no emulator in the cloud.
