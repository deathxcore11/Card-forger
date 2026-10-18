# CardStashy 3.84.1 — combined release record

Prepared 2026-10-18 UTC (2026-10-17 evening in America/New_York).

## Source and release status

- Production branch: `claude/edit-publish-github-bpm8zu`, checked at `68d11b59a5a4a255c55c56fefe43d5131896cb76` (package version 3.84.0).
- Integrated test branch: `codex/finish-effects-3841`.
- Served application code matches the tested `86a4790ace4913db0e68b6a805115d314a362cd8` batch. Latest hosted verification commit: `92084df22e952cb32ed563063351ef65a7ccdfe8`; its additions are test diagnostics only. The final release also expands the static deployment verifier to check the new finish, Community, deck and scanner modules.
- Latest hosted verification: https://github.com/deathxcore11/Card-forger/actions/runs/39094798545
- Independent native browser transport diagnosis and a second complete live scanner run: https://github.com/deathxcore11/Card-forger/actions/runs/39094798596 (passed).
- Prior held run, retained as failure evidence: https://github.com/deathxcore11/Card-forger/actions/runs/39093694296
- The other chat's checkout is unchanged at `29e0aa642898c296a7b13aa8eca63101e9836a21`. Its outstanding CI/deck-test edits were included. Its remote branch remains `87cc473c9e9afb7461e32d03f4bc3bb261bf39c3`.
- The user subsequently instructed “Ok continue and push.” The release is being published after the live scanner gate passed in the normal browser configuration; deployment must still be confirmed by exact served-file checks. The Community migration was applied successfully as `20261018034423_community_shared_deck_details` on 2026-10-18 UTC; it is backward compatible with the existing client. The production SQL regression suite passed in a rolled-back transaction using only temporary synthetic accounts. No test account or workspace was retained.

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
- The earlier held run completed with **15 of 16 job groups passed**. Account, deck boxes, responsive cards, Sets, Search, pricing, exact artwork, Home, dropdowns and game navigation all passed. Its only failing group was the live scanner test on Magic; the subsequent passing live test is documented below. The 320px idle/permission correction, final full Node suite and final scanner lifecycle/review checks passed; corrected screenshots were inspected.

## Release checks and remaining provider limitation

1. **Magic live scanner gate now passes.** Run `39094798545` passed real Lightning Bolt photo OCR, exact printing lookup, explicit review, finish/condition/language/copy edits, saving exactly once, camera continuity, responsive controls and Undo. Pokémon and Yu-Gi-Oh! passed the same flows. This normal scanner job uses Chromium's default transport; no fixture or HTTP response substitution was introduced. Independent probes returned the correct card over default phone/desktop HTTP/2 and phone HTTP/1.1. A second complete scanner run over HTTP/1.1 also passed. The earlier timeouts are retained as evidence of intermittent external/browser transport failure; their underlying cause is not claimed fixed.
2. **Provider restriction confirmed; authenticated owner condition pricing is not live-verified.** The configured owner record was checked read-only and exists as a confirmed, non-anonymous account. Local owner/token forwarding and provider-error/retry regressions pass. The live Zarude normal-printing endpoint returned `provider_shared_limit` / `EXCESSIVE_FREE_TIER_USAGE` on 2026-10-18 UTC. That response confirms the shared provider restriction, not a failed owner identity check: this probe was unauthenticated (`ownerVerified:false`). JustTCG documents this separate shared-hosting Free-tier restriction at https://justtcg.com/docs/rate-limits, including when individual quota remains. Owner access intentionally respects provider backoff. No provider plan was changed, limit bypassed, or LP price replaced with a market reference. A fresh signed-in owner request has not been exercised.
3. **Community production migration resolved:** `supabase/migrations/20261018014537_community_shared_deck_details.sql` was applied through the native migration tool after the user explicitly authorized continuing and pushing. Production migration history records `20261018034423`. The full rolled-back `supabase/tests/community_access.sql` suite passed against the deployed function, including preserved deck format/section/reference price, private-field stripping, consent/block access, and account RLS. Security advisors were unchanged from the pre-migration state; private Community tables intentionally deny direct access and use the guarded RPC.

## Catalogue and visual limits

- Current TCGdex `30th-154` (Gengar ex 154/128) returns a generated Normal-only variant and no pricing, despite the user's screenshot having Holofoil. The exact full-art region is supported when source data supplies Holofoil; the code does not invent finish availability from the screenshot or rarity. Other Gengar printings do not inherit that mask.
- Material effects are simulations. Unknown frames/finishes retain the image and an honest unavailable-preview state. Verified calibration includes Base Set art-window holo, Expedition Alakazam, supported SV reverse/full-art and exact Gengar 154 coverage; it is not a claim that every catalogue printing has been visually calibrated.

## Publication verification

The production and other-chat heads were checked before publishing and remain unchanged from the recorded base. GitHub comparison confirms the integrated branch is ahead of production with no divergent production commits. Publish with an expected-head lease, retain both histories, then check the actual served bytes on `https://cardstashy.com/` and `https://cardforge2.deathxcore11.workers.dev/`. Do not claim verified deployment until both hosts serve this exact version and its required modules. The provider restriction above is independent of deployment and remains unresolved; no paid subscription change or authenticated owner impersonation was attempted.

The combined binary-safe patch is generated from production base `68d11b59a5a4a255c55c56fefe43d5131896cb76`. Apply it to that base or reconcile newer changes explicitly; do not overwrite another chat's work or apply it twice. The local patch is checked by applying it to a temporary Git index and comparing the resulting tree to the intended source tree.
