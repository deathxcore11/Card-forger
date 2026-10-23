# Pack details, Pokémon Meta, shared finish controls

## Pack detail effects

The pack and the standard card sheet are separate native dialogs, but both entry points already use the same card renderer and exact pulled finish. The effect controller and phone motion controller chose the last open dialog in DOM order. The pack is appended after `#sheet`, so they selected the covered pack while the card sheet was on top. `foregroundDialog()` now respects the focused dialog and excludes a suspended `pack-under` dialog, with a conservative fallback that still blocks the page behind any open modal. Foil and motion share this selection. The pack's pulls and reveal state remain intact on return.

## Pokémon tournament data

The Android CSP intentionally does not admit direct Limitless connections. Pokémon Meta previously fetched that host directly. It now uses three read-only same-origin service routes for tournaments, standings and pairings. These are included in both copies of the native transport policy. The Worker constructs fixed Limitless URLs, accepts known formats/IDs only, caps response size and time, rejects redirects/malformed JSON, omits credentials and caches public arrays for six hours.

The source's games metadata was checked at https://play.limitlesstcg.com/api/games and its official API documentation at https://docs.limitlesstcg.com/developer/games and https://docs.limitlesstcg.com/developer/tournaments. Supported app formats are Standard, Expanded and Gym Leader Challenge. Unlimited has no corresponding format in that source, so the UI keeps an explicit coverage message and never substitutes Standard results.

Each format has its own cache, loading/error state and exact tournament snapshot. Standard remains the input to Home and existing Standard Deck Power; selecting another format in the Meta browser does not replace it. Matching, Save, diagnostics and budget-build handoff retain the source format. Standard uses recent events with at least 24 players; Expanded/GLC use at least eight, with the same 21-day window. Empty coverage is stated rather than manufactured.

## Finish UI

All three games use one bounded, horizontally scrollable native button rail. Magic and Pokémon receive material swatches consistent with Yu-Gi-Oh!'s existing controls. Yu-Gi-Oh!'s rarity choices, exact printing identity, title foil and material recipes remain unchanged. Its rail scrolls instead of wrapping into many rows. The shared selected-chip reveal, overflow hint, 44px targets, keyboard buttons and manual swipe preservation stay in use. Swatches never create finish availability or change saved copies.

## Verification

Focused unit/integration checks cover foreground ownership, actual motion control, finish material/availability, isolated tournament formats, strict proxy/native routes, cached failure recovery, source-format Save, price/ownership accounting and existing Home snapshots. Hosted browser checks compare the same Magic foil model through set and pack entries at phone/tablet/desktop widths; exercise sensor and pointer motion, reduced motion, pack resume and inventory preservation; and load format-isolated Pokémon Meta through the actual app. Existing finish browser checks require a single row and a swatch for every choice across all games. Intentional rail clipping is audited with the existing strict card-detail rail validator.

The final Android APK must supersede versionCode 10, keep com.cardstashy.app and the established signing certificate, and pass scripts/verify-android-release.py against the final shared source. No production release is approved merely by this source document or by a branch push.
