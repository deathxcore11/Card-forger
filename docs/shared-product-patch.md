# Coordinated web and Android patch — draft

This branch is a release candidate, not a published release. Production
base: `79b43e2a9d9c27add971db5ce3b47f79c009768b` (published website 3.91.10,
Android 0.3.3-beta). Candidate: website 3.92.0 and Android 0.4.0-beta
(versionCode 5, bundled interface 3.92.0), built from commit `08301ce`. Nothing
is deployed or promoted until the owner approves the release.

## Shared behavior implemented

- Four Settings destinations, account access first for guests, visible password
  controls, plain account messages, distinct backup/app installation groups.
- Friends/Requests/Add hub, real pending-request badge on Community, explicit
  login mode, loading/error states, account-scoped refresh and profile return.
- Per-release unread dots, acknowledgment only when viewing release details,
  truthful installed/bundled version labels, current release endpoint and a
  download page that checks the delivered APK's byte count and SHA-256.
- Home pack opening awaits the actual set load, retains navigation/account
  cancellation, and has a clickable named pack-art fallback.
- Manual and conversational building use the same construction pipeline and
  result. Existing builders, deterministic validation, optimizer, Power, engine
  analysis and existing AI coach are connected. AI swaps are resolved and
  rechecked; failed coaching leaves the deterministic result available.
- Compact card-centered setup; typed optional budget; contextual game choices;
  separate ownership/budget basis preferences; one result and explicit Save.
- Soft target policy: 10% over, maximum $5; larger deviations remain clearly
  flagged. Missing prices remain unknown. Incomplete or unverified required
  plans cannot enter the successful result/Save path. Legacy saved-deck
  optimization retains its strict-budget behavior.
- Pokémon evolution/Energy and conservative Yu-Gi-Oh! material checks operate
  on the actual candidate. Unsupported summon patterns fail honestly; these
  checks are not a complete rules simulator or matchup engine.
- Exact selected Pokémon printing and variant metadata is retained in shared
  candidates and saved rows. Logical owned inventory is allocated once across
  reprints, using existing deckStats accounting.

## Review and verification

Five explicitly requested perspectives were simulated by AI reviewers: beginner,
experienced player, designer, Pokémon enthusiast and child-friendly usability.
They were source reviews, not recruited human participants or physical-device
usability tests. Concrete findings addressed include Save invalidating its own
result actions, double-counted Pokémon inventory, stale attacker metadata,
hidden multi-card anchors after changing the featured card, missing-art row
alignment, touch target size and consistent purple deck actions.

Local synthetic regressions exercise real builders/validators and mocked card
providers. No customer collection, account, purchase or paid AI request is used.
New tests: `test-shared-deck-flow.mjs`, `test-product-parity.mjs`,
`test-home-pack-await.mjs`, extended `test-tcg-builder-accounting.mjs`, and
`tests/test_verify_android_release.py`.

Hosted browser coverage is configured in Settings release verification and the
existing Tests workflow. It must run on this branch; local CI guards are retained.
Screenshots and results must be inspected before claiming responsive layout,
visual polish or foil compatibility verified.

## Follow-up after the first hosted run

The first candidate (07cddba) passed hosted foil compatibility, finish effects,
scanner, recovery and multiple card-view checks. Its Settings matrix failed on a
pane-measurement race; other failures included old builder/Friends selectors and
missing new modules in the deployed-byte verifier. The follow-up awaits the
visible pane and measures both rectangles atomically, keeps the assertions,
updates tests for inline results and Community requests, and extends the fixed
asset verification list. Hosted reruns remain required; these edits alone are not
passing browser evidence.

The run also exposed a real handoff regression: a tournament source snapshot was
not forwarded into the compact builder. The request and detached construction now
retain that exact snapshot. Shared results participate in card-view Back history;
cross-game result cards open in their own game. Serialized Pokémon finish prices
now agree in generated and reopened saved decks. Budget basis/overage is visible
next to the field, native update availability has a direct action, and Settings
primary actions use the existing purple brand token.

Cloudflare marked the draft-branch preview failed. Its GitHub check supplies no
error text, and the detailed dashboard log requires authentication. No queue-reset
cause has been established and no production setting was changed.

## Mega-patch additions (3.92.0 candidate)

- Packs: Magic packs follow MTGJSON booster sheets for 174 sets
  (`data/mtg-boosters/`); Scarlet & Violet and Mega Evolution packs use measured
  per-set pull rates. Other sets keep the era table.
- Pokémon holo redesign: the 39 patterns of the brief as shader branches, a
  top-side coat for Poké Ball / Master Ball stamps, an ACE SPEC magenta tint, and a
  router by TCGdex set id and special rarity. `pokemon-holo-lab.html` shows all 39
  with tilt. Deliberate deviations pending scans: WotC main sets keep Starlight and
  the Scarlet & Violet reverse keeps its measured sheen. Light Pokémon in holo
  windows (N's Reshiram) stay ink.
- Scryfall busy/429 (no CORS headers, so "Failed to fetch"): requests back off
  and retry, the meta-deck import retries a failed batch once, and the card sheet
  offers Try again instead of a spelling hint.
- Pack reveals name the finish beside the rarity (Reverse Holo, Holo, Foil,
  Etched foil), in the same rarity pill.
- Home retries the Card of the Day (15 s, 1 min, after the 5-minute server
  cooldown) instead of leaving Magic's hero blank for the day.

## Android artifact

`downloads/cardstashy-android-beta-0.4.0.apk`: com.cardstashy.app 0.4.0-beta,
versionCode 5, 25,895,363 bytes, SHA-256
`8bafa78810002b1a9388725f5636f18ee5bbc48de76f3d983d7b1b5bc8afe317`, signed with the
established certificate (E6:E4:01…3F:55). Built from the current
com.cardstashy.app Capacitor source (the pipeline that produced 0.3.0–0.3.3; the
earlier note calling it the old dev.cardstashy.integration project was wrong),
pinned to `08301ce` with every shared file taken from the commit by `git show`.

The app adapts ten shared files (exports, auth exchange, scanner and foil
lifecycle, offline art, image URL mapping, settings storage, safe-area insets).
Those transforms now live in `scripts/android-native/` (verbatim copies of the
Android build's) and `scripts/verify-android-release.py` requires each APK file
to equal the source after exactly those transforms; every other shared file must
match byte for byte. Result: 240 shared assets checked, 0 errors, signature,
package, versionCode/name and checksum matched, `releaseApproved: true`,
`physicalDeviceTested: false`.

## Cloudflare preview failures

The draft-branch preview builds fail with Cloudflare error 10067: the account has
reached the Workers Free limit of 100 Durable Object namespaces. Each preview
upload of a Worker with Durable Object classes needs namespaces, so the failure
was account quota, not this code. The owner has since moved the account to a paid
plan; nothing was deleted.

## Release blockers / remaining evidence

1. Done: signed 0.4.0-beta (versionCode 5) from the current native source with
   interface 3.92.0; release-record.js populated from the verified artifact.
2. Done: `python scripts/verify-android-release.py --source . --apk
   downloads/cardstashy-android-beta-0.4.0.apk` passes (see Android artifact).
3. Done by the owner: paid Cloudflare plan; confirm the next preview build passes.
4. Test the actual installed APK: cold/slow Home pack opening, exact single/multi
   printing foil, card art, scanner/collection/save, Android Back, native update
   manifest transport, download/install update, and account callback after cold
   app start. No physical-device testing has been performed for this candidate.
5. Complete disposable-account email signup/confirmation, expired/used links,
   external mail-browser return, login/logout and password recovery. Source and
   fixture tests are not an end-to-end account confirmation test. No auth server
   configuration or security protections were changed.
6. Investigate old direct APK URLs and cached checksum instructions together.
   The new verified-download surface is consistent, but the pre-existing Worker
   redirect from an old APK filename to a new binary still permits old external
   checksum text to disagree. Do not describe this historical case as solved.
7. Finish auditing all legacy generation entry points, including the existing
   Ideas inspector and tournament adaptation. The new shared flow blocks partial
   success, but old editor/inspection paths still have their own draft controls.
   Do not claim every historical path has been replaced.
8. Broaden realistic provider fixtures across every offered format and inspect
   generated plans before release. Conservative summon support can reject viable
   strategies; no assertion that a rejected deck is impossible or unaffordable is
   made. No new all-game matchup coverage or win rates are claimed.
9. Verify latest website and workers.dev deployed asset bytes only AFTER review,
   coordinated artifact publication and explicit release readiness. Keep this PR
   draft; do not merge it while these blockers remain.

No production deploy, version promotion or automated release
notification is part of this draft publication.
