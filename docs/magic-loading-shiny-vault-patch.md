# Magic set recovery and Hidden Fates Shiny Vault finishes

This follow-up starts from production `966a57e6172b60931895a58d3b38d220b786df39` (website 3.93.0 / Android 0.5.0-beta, versionCode 9). It is not a coordinated release yet.

## Magic loading

The reported screenshots show SOS stopping at 350/368 cards and DSK failing before showing any cards. Both use `createScryfallClient`, including Android's browser-based external-provider transport. A `TypeError` does not identify whether the original failure was connectivity, CORS, or provider availability; this patch does not claim to have reproduced the phone's network failure.

Retry now retains successful pages and requests the failed page, including a first-page failure after successful metadata loading. Cursor ownership and the existing navigation/generation checks prevent late responses from replacing another set. Only a validated, fully paginated distinct-card count enters the complete-set cache. Missing, foreign, repeating, malformed, or truncated continuations remain incomplete.

Read-only provider checks on 2026-10-23 returned DSK pages 175/175/67 (417 distinct cards) and SOS pages 175/175/18 (368 distinct cards). These are observations from the development environment, not a phone-network test.

## Pokémon finish correction

The retained `tests/fixtures/buzzwole-sma-SV68.json` is the public TCGdex response captured on 2026-10-23. It describes a generated standard Normal placeholder, despite the [official Hidden Fates checklist](https://assets.pokemon.com/assets/cms2/pdf/trading-card-game/checklist/sm115_web_cardlist_en.pdf) identifying Shiny Vault foil printings.

The correction is limited to English `sma-SV1` through `sma-SV94`, matching set/number, and the empty generated Normal record. Source descriptors are retained in provenance. New explicit product/edition/art descriptors cause a correction conflict rather than being overwritten. Primary and fallback Normal/reverse quotes cannot reintroduce a disproven finish or price its Holofoil option.

Hyphenated GX names now reach the full-face layout. Shiny GX gets the existing shiny textured treatment; baby shiny cards retain illustration-window glitter. Other games and old ex-era layout rules are unchanged. Variant schema 14 refreshes cached metadata without migrating saved lots; a previously saved Normal selection remains unresolved rather than silently becoming Holofoil.

The retained image `tests/frame-art/sma-SV68.webp` comes from `https://assets.tcgdex.net/en/sm/sma/SV68/high.webp`. The hosted browser test records its checksum and captures phone, tablet and desktop views. Simulated coverage is not an exact physical-foil reproduction.

## Validation and release gate

- `test-set-context-integration.mjs`: actual loader, stale responses, partial and first-page retry, malformed continuations and false completeness.
- `tests/sets-browser.mjs`: actual app retry keeps earlier tiles visible while the failed page is held; earlier pages are not requested again.
- `test-shiny-vault-finish.mjs`: captured source, availability, full-face versus baby-shiny coverage, source conflicts, cached/saved identity and all three price paths.
- `tests/shiny-vault-browser.mjs`: hosted app, finish choices, overlay alignment and screenshots at 360/768/1440px. Existing other-game/frame tests remain enabled.

Before production, build a matching APK from this patch using the current native wrapper, keep `com.cardstashy.app` and the established signing certificate, use versionCode 10 or higher, and pass `scripts/verify-android-release.py`. The repository currently contains native web transforms, but not the 0.5.0 Android Gradle project, MainActivity or haptics plugin. The older portable project is 0.2.0-integration and cannot establish parity with 0.5.0. Do not ship the existing 0.5.0 APK alongside the changed shared assets. Physical-phone upgrade, Back and haptics checks remain required release work.
