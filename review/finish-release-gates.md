# Finish coverage release gate — 2026-10-20

Scope correction from the owner, 2026-10-20: **work in small batches first**. Complete coverage of every physical printing across all three games is a longer-term goal, not a prerequisite for reviewing a tested batch. Candidate test-branch publication is allowed. The owner subsequently authorized the tested batch for production on 2026-10-20 at 14:28 EDT: "Push patch now and I'll run my own test and have you correct them." This authorization does not turn the catalogue backlog into verified coverage.

## Current batch review

Celebi follow-up (sm11-4): the ordinary holo path still used the generic rectangle, starting below the artwork top and extending across its caption. The candidate now uses an exact-card illustration mask derived from the retained 600x825 source image. The existing reverse mask, normal choice and product identities are retained. Added checks cover holo/reverse at five widths, normal without foil, zoom handoff, and an old-mask negative control. Hosted run [39469515702](https://github.com/deathxcore11/Card-forger/actions/runs/39469515702) passed and its retained screenshots and pixel report were reviewed: 25 card/finish/width cases, Celebi zoom, and three touch viewport scenarios. The maximum image/overlay box difference was 0.40625 CSS pixels. Celebi holo left the caption, area below the illustration, and rules field unchanged at all five widths; restoring the old mask reproduced the reported caption spill and missed artwork top. These checks validate this bounded rendering repair. The source's generated Normal metadata conflicts with its Holofoil/Reverse Holofoil pricing buckets; the rendering repair does not certify or change that availability metadata.

The current candidate contains targeted Rabsca, Oddish and Butterfree finish/selection repairs, Aquapolis identity and product-binding repairs, and Sun & Moon frame alignment plus modal gesture repairs. Review each claim against its actual evidence; this is not a claim that every card in these sets has an accurate foil preview.

- Define each batch by exact card/printing IDs and the behavior being repaired. Check every item and supported finish in that batch, including nonfoil, rather than promoting a few examples to whole-set completion.
- Verify finish choices, visible effects and boundaries, exact product/price identity, and saved collection selections for the affected paths. Preserve explicit unknowns; do not invent variants, materials or prices to close the batch.
- Keep regression checks across all three games and affected screen sizes because shared rendering and modal code can affect cards outside the batch. Passing tests are bounded evidence, not a guarantee that no regression can exist.
- Separate source-backed physical printing checks from synthetic geometry tests. The Sun & Moon source limitation below remains visible in review.
- Record unresolved issues within the batch before release review. Unfinished unrelated catalogue coverage stays in the backlog and does not by itself block a completed batch.

Evidence currently available: 233 local checks passed; all 33 general CI jobs passed on candidate a9cccb16335cbb7ea5d58acdc7a5cb860187852b in run 39461648495. Targeted same-head runs 39461648339 (15 artwork/viewport geometry cases and three touch viewport scenarios), 39461648491 (Oddish/Butterfree), and 39461648269 (Aquapolis/Rabsca) passed. Physical Samsung hardware behavior remains unverified. These results do not authorize or prove a production deployment.

## Celebi follow-up validation review

Application assets are unchanged from commit `389c0dc54e344f9354ab8a5d67af8fbbad0b5c4e` (tree `0884f2e55c8788b7370d669fffb4bcefa5bfcf36`, shell v256). Test-only descendant `00b14213a82adf6b294dd0e6a98d4d0e66cc1aa1` (tree `f361a0f1879e96f0975d9d65dea87049e19d5576`) corrects the synthetic AI preview catalogue's tracked-price snapshot.

The original general run `39469515755` finished with 32 passing jobs and one failure. The failed AI recovery fixture introduced `ask-sai` without the already-tracked marker supplied for the shared fixture cards. Opening its detail correctly scheduled a price-history registration, which the fixture's network-write guard rejected. The production `watchCards` function reproduced this with in-memory storage, a captured timer callback and a fake fetch; supplying the missing marker suppressed that request. The correction adds only synthetic fixture state. The production request path and deny-write assertions are unchanged.

Validation of test candidate `00b14213a82adf6b294dd0e6a98d4d0e66cc1aa1` is complete:

| Check | Result | Evidence |
| --- | --- | --- |
| General CI | All 33 jobs passed, including AI request recovery | [39474614199](https://github.com/deathxcore11/Card-forger/actions/runs/39474614199) |
| Foil/fold/Celebi | Passed: 25 geometry cases, zoom, three touch viewport scenarios | [39474614037](https://github.com/deathxcore11/Card-forger/actions/runs/39474614037) |
| Oddish/Butterfree | Passed: reverse effect, glass selection, reduced motion, unchanged holdings | [39474614231](https://github.com/deathxcore11/Card-forger/actions/runs/39474614231) |
| Aquapolis/Rabsca | Passed: 186-card/348-selection navigation and identity; distinct Rabsca finishes | [39474613985](https://github.com/deathxcore11/Card-forger/actions/runs/39474613985) |

The bounded batch review is complete. Following the owner's explicit approval, the production branch was fast-forwarded from `e0f00c6acf5e2bf51e9f6ce2a6a6dfc45c4558d1` to the exact tested candidate `00b14213a82adf6b294dd0e6a98d4d0e66cc1aa1`; no production-only code was introduced. Cloudflare's production build [118810157666](https://github.com/deathxcore11/Card-forger/runs/118810157666) succeeded at 18:31:20 UTC (14:31:20 EDT), build `cd7764f2-ff5f-4eee-b38a-d87ee45776d7`, deployed Worker version `54b5cc7f-8138-4803-8432-16ef974a18ef`.

Live verification at 18:35:50 UTC established exact bytes for all 196 application modules on each host, all six entry/config/service-worker checks on the Workers host, and all 36 ordinary/cache-busted repair-asset URLs across both hosts. The main domain serves shell v256 and the repaired modules. Its raw HTML has 367 extra bytes and does not match the repository HTML; the strict deployment verifier remains UNVERIFIED (hosted run 39475379012 failed that check). The HTML difference has not been conclusively isolated and the verifier was not relaxed. This is evidence of the specific repaired application assets plus a successful production build, not a claim that every served byte matches. The live-status watch was disabled after confirmation.

## Collection price-border follow-up

The owner's 14:35 screenshot shows six Base Set LP/MP copies with unpriced dashes and no price-tier border. Collection rendering derives those borders from each saved copy's usable value; missing condition values produce the neutral `tn` tier. The production foil CSS retains the decorative price-frame background animations. A still screenshot does not establish whether a priced frame animates.

A focused server-to-client regression reproduced a separate outage-recovery defect: the condition route returned cached quotes without its already-verified product ID when the provider reported an error. The client correctly rejected those unbound quotes. The follow-up preserves the verified product ID in that response. The regression fails before the fix and passes after it; it covers fresh and stale MP quotes, a conflicting saved product, unchanged holdings, and the resulting price tier. Only current exact quotes restore collection value and price frames; historical quotes remain explicitly last known and excluded from current totals. No reference-price substitution, estimate, or rarity-based price tier was added.

The controlled public lookup for `base1-10` returned HTTP 403 from this environment. No challenge bypass or alternate identity was attempted. Therefore this check does not establish the user's current provider status, exact saved product/finish, or the cause of all six missing prices. Existing provider availability and account-linkage limitations remain unresolved. The app uses network-first assets, but an already-open page can keep loaded JavaScript; close and reopen the app to load the release without clearing saved data.

### Follow-up release result (condition recovery, 3.86.4)

Fresh results on candidate `4154de10c161148e0b6429a83db84166f1dc3f9b`: general run 39477844515 finished with all 33 jobs passing (including `dropdown-browser` and `game-switch-browser`); focused runs 39477844640, 39477844568 and 39477844728 passed. Locally, `test-condition-recovery.mjs` failed without the one-line route change ("Outage response retains the verified product proof") and passed with it. Production was fast-forwarded `00b1421` → `4154de1` with a lease. Cloudflare check 118826148025 for that commit stayed "in_progress" without a result; it is not claimed as deployed on its own. On the production push of `4154de1`, `home-browser` failed once on a detached node (`scrollIntoViewIfNeeded`, tests/home-browser.mjs:711); `deploy` (GitHub Pages not enabled) and the strict `verify` job (known HTML difference) also failed, as before.

The recovery fix shipped inside 3.86.4 (`8e1883e8e223f08fc70988da507226a4b7e5d8d0`): all 36 candidate checks passed, production was fast-forwarded `4154de1` → `8e1883e` with a lease, Cloudflare Workers Builds check 118853282546 (build `bb1fc9a8-763b-4d93-8260-960be31e7ba0`) completed successfully at 19:58:20 UTC, both hosts served shell v257, and `finish-effects.js`/`config.js` matched repository bytes on both hosts. The server route is not a public asset; its deployment evidence is the Cloudflare record for the containing commit.

Controlled public condition lookups at 19:50 UTC (Unlimited products, no auth): Pidgeotto 42363, Electrode 42362, Mewtwo 42347, Electabuzz 42361 and Dugtrio 42359 returned current TCGplayer condition quotes including LP and MP. Machamp `base1-8` returned `unpriced`: TCGdex binds TCGplayer product 42425 to its Unlimited holo record, but TCGplayer lists 42425 under Deck Exclusives with only a 1st Edition Holofoil price. This is a confirmed product/printing mismatch; the binding was not changed because existing saved copies may reference it (pending owner review). The owner's saved printing identities were not available, so the six dashes are not claimed fixed.

### Pokémon frame geometry (3.86.4–3.86.5)

Holo and reverse windows are traced from mean Sobel edge maps of regular TCGdex fronts per era and layout (`tests/fixtures/pokemon-frame-geometry.json`): Basic, evolved and Trainer for WotC, Rocket/Gym, Neo, Legendary Collection, e-Card, EX (two frames), DP/Pt, HGSS, BW/XY, SM, SWSH and SV/ME. Reverse surrounds run from the measured inner border edge to the exact illustration window; Sun & Moon keeps its reviewed hole. Mega Evolution sets previously fell outside the era list, so their reverse holos rendered nothing (reproduced on me01–me05). Hosted pixel check `tests/pokemon-frame-browser.mjs` (dp5-33, dp1-31, hgss3-15, me01-016; holo selections synthetic) verifies foil beside the stage banner and none on the banner, badge or Pokédex strip. Unmeasured: Base Set 2, EX Pokémon-ex/Gold Star, Energy, BREAK, Restored, promo Trainers. Physical foil and phone hardware remain unverified.

## Catalogue backlog

Comprehensive all-card finish coverage remains **UNVERIFIED**. The audit's `allCardsAllGamesReleaseGate: BLOCKED` field describes that comprehensive claim; it is not a veto on the owner's smaller-batch release scope. Do not relabel missing coverage as passing.

Run `node scripts/finish-coverage-audit.mjs <report.json>` to reproduce the offline evidence inventory. It processes every row of the checked-in recognition snapshots, not the entire current live market. Resolver support does not certify visual or physical accuracy. No card, price, lot or provider data is modified.

| Evidence | Coverage and limit |
| --- | --- |
| Aquapolis retained full records | 186 cards; 348 selections: 157 plain, 191 unsupported previews. The browser navigation/identity pass is **not** a foil-rendering pass. |
| Yu-Gi-Oh! recognition snapshot | 45,176 printing rows: 18,117 plain, 18,949 approximate, 7,601 unsupported, 509 without printing metadata. Unknowns include Quarter Century, Ultimate, Collector's and Ghost treatments, special frames, and malformed rarity labels. |
| Magic recognition snapshot | 100,457 printing IDs, with 87,328 nonfoil, 62,296 foil and 1,205 etched declarations. Rows omit the layout/face/treatment information needed to validate exact rendering. Overlapping finish counts are not separate cards. |
| Pokémon recognition snapshot | 21,388 indexed physical card IDs out of 22,055 rows; 667 Pocket rows are excluded. Recognition metadata omits physical variant inventory and foil geometry. |

Required before claiming comprehensive coverage:

- Reconcile physical printing/finish availability and exact product identities for each game. Missing source records and malformed labels remain unresolved.
- Map reviewed artwork frames and materials for each finish family, including alternate illustrations, stamps, textures and special layouts. Do not fill unknowns with an arbitrary rainbow.
- Verify each printing's selected geometry, plus rendered representatives of every layout/material combination in collection, detail and zoom. Nonfoil must stay nonfoil, and preview switching must preserve saved holdings and prices.
- Test phones, folded/unfolded screens, tablets and desktop, including gesture cancellation, nested modals, reduced motion and background scroll containment. Hosted touch emulation does not prove actual Samsung hardware behavior.
- Obtain separate release review and verify the real production deployment and served asset bytes.

The Sun & Moon witness uses unchanged public source artwork for Sewaddle 6, Sewaddle 7 and Leavanny 9. The current TCGdex Sewaddle 6 record lacks reverse availability; the test explicitly supplies a synthetic reverse choice to reproduce the user's displayed selection. This patch does not add a production variant or fabricate a price.
