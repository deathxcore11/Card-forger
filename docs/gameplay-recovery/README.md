# CardStashy gameplay recovery: current handoff

This is a development checkpoint, not a release announcement. The user's finish line is: choose an unchanged saved/imported/found deck, choose Quick Play or a specific CPU deck, select a genuinely tested difficulty, play a smooth rules-enforced match through CardStashy, and receive a correct result. Desktop and unfolded/tablet Chrome are the first web surfaces. APK and narrow-phone gameplay are later work.

## Baseline and branch purpose

- Production baseline inspected: web 4.0.5, commit `7a91d7757ff1ac7e1d83a904a294b48a44ed1f32`, branch `claude/edit-publish-github-bpm8zu`. Recheck the live ref before integrating; this document is not a moving-source guarantee.
- This isolated proof branch is intended to run one bounded Forge/Chromium test without firing the repository's unrelated CI matrix. Its replacement `.github/workflows/ci.yml` MUST NOT be merged to production. It is not a substitute for the eventual release checks.
- Official Forge pin: `e5a0f8156da70ffc7866f923bed371c0111707cd`. The upstream engine is not modified by this proof. Retain its license/notices and review distribution requirements before production adoption.
- The prior Phase runtime remains available as a comparison. Do not splice its rules with Forge in one match. Existing uncompiled Phase assessment patches are not approved runtime fixes.

## What exists, and what it proves

- Native Forge Commander simulations completed with the original published Calling All Angels, Keen Engineering and Reign of Dragons lists. This establishes bounded backend feasibility, not human browser integration or every card's behavior.
- The local HTTP adapter executes real Forge human prompts and returns a viewer-specific snapshot. Local tests exercised opening decisions, land play, casting, payment, stack resolution and a natural terminal result. They do not establish production hosting or full UI coverage.
- The isolated frontend reuses CardStashy's actual table, inspector, art hooks and styling. Unit/DOM checks are separate from real Chromium acceptance. Read the CI result for the exact commit; do not infer PASS from this document.
- Full/manual priority is the first browser proof mode. Smart defaults and Easy/Medium/Hard remain separate implementation and acceptance gates.

## Verified checkpoint: 2026-10-26 01:49 UTC

- Actual Chromium proof **PASS** at `00ad011381246b962898df91a3e270b070917489`, [run 40255449488](https://github.com/deathxcore11/Card-forger/actions/runs/40255449488). Unchanged Keen Engineering human seat against Reign of Dragons native Default CPU, Full Control: 184 rendered-control actions, native CPU win on turn 16, no concession, zero browser errors or unexpected credential/service requests. Land hit-target geometry and terminal-aware test synchronization repaired. This is not the production setup flow, Smart acceptance, arbitrary-deck support, three difficulties, or live deployment.
- Separate reviewed Smart0058 native human-HTTP fixtures complete Calling All Angels versus Reign of Dragons. Angels versus Keen completion is pinned to preceding0050; do not silently relabel that evidence.
- Exact saved/imported snapshot Commander candidate0146 now starts a real Forge JVM and checks registered and instantiated card rosters; independent bounded review passed, and the exact saved/imported HTTP match completed naturally on turn30. The complete existing-app browser journey is still pending. The app already has the deck builder and setup picker. Reuse its structured snapshots; commander designations identify copies already in cards[], not extra cards.
- HOST-001 frozen archive `HOST-001-existing-snapshot-01` SHA256 `2d062b582f1779e56d538e59e25774ac19388d013564c56a4f30b3c4be40d467` was verified. Local integration adds bounded lifecycle/deadline/cleanup protections and one-JVM provisional initialization. Provisional capacity is NOT deck legality: native validation and exact receipt are mandatory before playable status. No separate always-running validator service.
- Provider wrapper has local workerd/SQLite and boundary tests; real Docker image/resource and Cloudflare deployment remain unverified. Existing Workers Paid plan confirmed by owner screenshot; no upgrade purchased. Cloud browser currently redirects to Cloudflare sign-in.
- Latest requested release formats are Standard, Modern and Commander. Modern transport syntax is not gameplay support. Four Star Trek Commander products are official, but Wizards' decklist page still marks all full contents unrevealed as checked October26; never fabricate those lists.
- CPU Default is not three difficulties. Isolated CPU work has reproduced a native hidden-library naming leak and is testing a repair. Wider search fairness and difficulty strength are unproven.

## Ownership and boundaries

1. Engine/adapter owner: `experiments/forge-proof/native/adapter/`. Forge owns game rules and CPU decisions. Translate canonical prompts without guessing option meanings or inventing defaults. Unknown prompt families fail visibly.
2. UI owner: `experiments/forge-proof/`. `forge-session.mjs` owns presentation/transport state; `forge-table.mjs` and `native-panel.mjs` connect actual native decisions to the existing table. Do not put a second legality engine in JavaScript.
3. Verification owner: `experiments/forge-proof/ci/`. Browser controls submit state-changing actions; snapshots are assertions only. Do not manufacture a winner, concede to make a test finish, or classify a timeout as a rules draw.
4. Integration owner: reconcile exact reviewed revisions, preserve existing collection/scanner/value/deck features, perform the final release checks, and publish one compatible engine/data/adapter/UI set. Only this owner changes production.

Agree on one owner before two contributors edit the same file. A handoff must give its base revision, changed files, tests actually run, unresolved issues and next concrete action. Mark replaced plans superseded rather than leaving contradictory instructions active.

## Nonnegotiable contracts

- Preserve exact deck quantities, faces and commander designations. Card identity, paper legality and executable engine support are different checks.
- Private hands, library order and unrevealed identities never enter the opponent's browser or an unauthorized CPU observation.
- Bind commands to the current native decision and revision. Reject stale/duplicate/invalid input without paying or mutating twice.
- An empty instant list, failed payment search or unknown assessment is not proof that no legal action exists. Respect zones, timing permissions, alternate costs, special actions and mana abilities.
- Smart yielding is a policy over native rules information. Mandatory decisions stop. Full Control and phase stops work. Own main-phase initiative stays with the player.
- Human-readable choice labels describe canonical native options. Never make an unsupported ability a silent no-op to enable Play.
- Basic land and automatic-payment conveniences must use the same casting process as manual input. Cancellation must resume cleanly without admitting input while a deferred confirmation is pending.

## Regression witnesses and known limits

- Existing shipped failure: Daydream, Hallowed Fountain, Abandoned Air Temple, Springleaf Drum, Sage of the Skies, Steamcore Scholar and Starfield Shepherd in an engineered empty-board opponent-upkeep position produce unknown Smart coverage. This was not a recovered original user save; preserve complete state when reproducing it.
- Target Commander pairings: Calling All Angels against Keen Engineering and against Reign of Dragons. Keep every card intact. Test Misleading Signpost and Leyline Tyrant branches separately; a match ending does not prove those abilities occurred.
- Adapter review found and required repairs for source/destination ordering, stale-input races, reveal acknowledgment, strict scalar validation, native display labels and cancellation deadlocks. Consult the exact candidate tests rather than assuming a prior review applies to a later edit.
- Native AI profiles are not automatically equivalent to three measured difficulty levels. Current proof pins Default and disables optional search/cheat settings. Hidden-information behavior requires its own tests before broader fairness claims.
- The local bearer/loopback adapter is NOT production session authorization. Production hosting, account/seat binding, isolation, resource limits and interruption handling remain to be implemented and verified.

## Next implementation gates

1. Pass a real Chromium human-control match through the existing table, including cancel/retry and representative unfolded viewport checks.
2. Implement and verify native Smart/Full Control, automatic-payment flow and remaining decision families.
3. Connect exact app deck inputs, Quick Play/opponent selection and tested difficulty policies to the adopted backend.
4. Verify the requested actual matchups, privacy and repeated/stale inputs. Keep coverage claims bounded and make remaining errors actionable.
5. Establish and test production hosting without bypassing access controls or silently introducing a new subscription.
6. Integrate desktop and wide-screen Chrome. Keep desktop Play placement unchanged; mobile Home art and Decks entries lead to the same Play menu. Do not advertise unfinished friend play as working.
7. Run applicable release checks, deploy, verify actual public assets/runtime and repeat critical gameplay checks. Only then report live completion.

## Continuity

Commit small coherent source changes. Attach focused test outcomes to the exact commit, and distinguish written / locally tested / browser tested / live verified. Preserve a known-good production rollback point. Never commit credentials, local capability files, private game saves or bulk investigation archives. This checkpoint's source and controlled public-deck tests are the reusable handoff; do not rely on a previous chat's temporary workspace.

## Exact container proof checkpoint

Current exact adapter source is frozen at `experiments/forge-proof/native-exact-0146/`; original `native/` remains the original browser-proof reference. The image context under `hosting/cloudflare/build-context-exact-0146/` copies hash-identical0146 source. One match container validates an unchanged existing app snapshot before admission. This checkpoint replaces only the isolated proof CI with a bounded offline Docker build/run, not a production deployment. No image is pushed, trial remains disabled, and full Standard/Modern/three-difficulty browser acceptance remains open.
