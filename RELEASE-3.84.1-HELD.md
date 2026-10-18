# CardStashy 3.84.1 — combined update, release held

Prepared 2026-10-18 UTC (2026-10-17 evening in America/New_York).

## Source and release status

- Production branch: `claude/edit-publish-github-bpm8zu`, checked at `68d11b59a5a4a255c55c56fefe43d5131896cb76` (package version 3.84.0).
- Integrated test branch: `codex/finish-effects-3841`.
- Tested code commit: `86a4790ace4913db0e68b6a805115d314a362cd8`; tree `fd8458a5a09fb732090fe9eec7b46159c7c0d2a5`.
- Hosted verification: https://github.com/deathxcore11/Card-forger/actions/runs/39093694296
- The other chat's checkout is unchanged at `29e0aa642898c296a7b13aa8eca63101e9836a21`. Its outstanding CI/deck-test edits were included. Its remote branch remains `87cc473c9e9afb7461e32d03f4bc3bb261bf39c3`.
- No production branch update, live deployment or production database write was performed in this continuation. Pages publishing is skipped on the test branch. The user authorized publishing only after successful testing; that condition is not yet satisfied.

## Included work

- Community profiles with separate binders/decks, friend requests/counts, read-only sharing and independent Save to my decks.
- Animated editable deck boxes, printing carousel, set progress, consistent animated AI identity and header motion.
- Username is the displayed player identity. Add friend opens exact email/username search. My profile opens a player popup over the current page.
- Background sync remains active; sync status, manual sync and conflict decisions live in Account settings. An unresolved account conflict stays paused until the user explicitly handles it there.
- Per-game, source-backed finish choices are independent of prices. Pokémon Holo/Reverse Holo and exact supported full-art layouts, Magic traditional/etched foil, and distinct supported Yu-Gi-Oh! rarity treatments use clipped material layers.
- Detail/zoom foil follows the existing soft tilt/gyro spotlight. Visible large gallery cards shimmer automatically without hover. Old blue hover rings are disabled. Compact/symbol layouts, reduced motion, hidden pages, offscreen cards and background galleries under dialogs do not run overlays.
- The scanner camera fills the space between the existing header and navigation. A lower-right count/picture pile opens the existing review popup; its thumbnails switch captures. Finish, printing, condition, language and copies stay in review. Capturing does not automatically add inventory.
- Scan review stays below the game tabs and above navigation. Camera playback, queued original images, explicit review, Undo and game-switch preservation remain intact.
- Scryfall request starts are paced with bounded concurrency and queue-inclusive deadlines, so a slow background sets request cannot serialize every exact-card lookup behind it.
- Condition-price failures retain their provider reason and offer explicit retry. Reference market prices are never substituted for unavailable exact-condition quotes. Verified owner access remains distinct from provider-side limits.

## Verification

- Full local `npm test` completed successfully, with 376 PASS log lines. These are log lines, not a claim of 376 independent tests.
- Hosted code tests and isolated database safety checks passed.
- Hosted finish controls passed for Magic, Pokémon and Yu-Gi-Oh! at 320, 390, 673, 768, 1024 and 1440px, including auto shimmer, emulated orientation/light alignment, off/reduced-motion/hidden/offscreen cleanup, zoom and unchanged ownership.
- Hosted scanner layout/review checks passed at 320, 390, 673, 768, 1024, 1440 and landscape 844px. Screenshots were inspected. The test feed and cards are synthetic; this is not physical-phone camera or sensor testing.
- Mixed-game capture/browser tests passed from 320–2560px, including fold/landscape resizing, preserved captures and the same live MediaStream. Real-reference Pokémon and Yu-Gi-Oh! OCR/review/save/Undo flows also passed, including an active Undo toast at short screen sizes.
- Account, deck-box, responsive card, Sets, Search, pricing and exact-artwork checks passed on the integrated code. The complete preceding run (`39093366328`) passed 15 of 16 job groups, including game navigation, Home and dropdowns; only the live scanner group failed on Magic. The subsequent code change places idle scanner permission guidance in normal layout below Start camera instead of overlaying the button. The linked follow-up run passed the full Node suite, finish checks and scanner lifecycle/review tests, including the 320px start screen and declined-permission layout; corrected screenshots were inspected.

## Open release checks

1. **Magic live scanner lookup fails in the hosted browser.** The actual reference image is recognized as Lightning Bolt, but Scryfall details time out. Exact-card requests start while `/sets` is pending, demonstrating that the queue fix works. An independent blank browser page also times out; a separate HTTP request client returns HTTP 200 and the exact expected card ID. This isolates a browser transport failure in that environment, not its underlying cause. The live gate remains failing; it has not been skipped or replaced with fixture results. Captures remain available for retry and unverified details are not silently saved.
2. **Authenticated owner condition pricing is not live-verified.** The configured owner record was checked read-only and exists as a confirmed, non-anonymous account. Local owner/token forwarding and provider-error/retry regressions pass. The user's JustTCG dashboard showing 6% usage does not establish quota exhaustion or the reason for an unavailable LP quote. Verify the actual authenticated Zarude/selected-printing condition request and provider response; do not infer the cause from an unauthenticated request or replace the LP quote with a market reference.
3. **Community production migration is unapplied:** `supabase/migrations/20261018014537_community_shared_deck_details.sql`. Isolated SQL tests pass. The prior chat reported automatic approval review blocked its production application. This continuation did not retry or bypass that block. Resolve the authorized production migration before enabling the complete shared-deck behavior live.

## Catalogue and visual limits

- Current TCGdex `30th-154` (Gengar ex 154/128) returns a generated Normal-only variant and no pricing, despite the user's screenshot having Holofoil. The exact full-art region is supported when source data supplies Holofoil; the code does not invent finish availability from the screenshot or rarity. Other Gengar printings do not inherit that mask.
- Material effects are simulations. Unknown frames/finishes retain the image and an honest unavailable-preview state. Verified calibration includes Base Set art-window holo, Expedition Alakazam, supported SV reverse/full-art and exact Gengar 154 coverage; it is not a claim that every catalogue printing has been visually calibrated.

## Resume and publish

Check the production and other-chat branch heads again before merging. Resolve the three release checks above, inspect the final hosted run, and verify the actual authenticated production flow. The user's conditional publishing authorization already exists; do not ask for routine permission again. Do not call this update live or ready to publish while a release check remains open.

The combined binary-safe patch is generated from production base `68d11b59a5a4a255c55c56fefe43d5131896cb76`. Apply it to that base or reconcile newer changes explicitly; do not overwrite another chat's work or apply it twice. The local patch is checked by applying it to a temporary Git index and comparing the resulting tree to the intended source tree.
