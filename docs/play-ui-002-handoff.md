# UI-002 — Setup and return journey

Branch: `codex/play-ui-journey-20261025`. Builds on UI-001 `4dfd7830ad3d5cc95dc5f9b138f45d05f5845938`, originally based on 4.0.0 `2af11c9`. Integration owns publication. No deployment, engine build, admission-policy change or expanded card pool.

## What changed

- `index.html`: a second Play entry in the bottom navigation, controlled by the existing desktop eligibility function. It is visible when the top navigation is hidden at 1180×757. The existing admission policy is unchanged.
- `play-menu.js` / `play-menu.css`: primary start controls and prerequisites precede deck browsing in both DOM and visual order; adequate bottom-nav clearance; both deck identities/art and list counts together; shared deck inspector retained; Commander-to-Standard starter switching disclosed on the button and in adjacent copy; Friends copy/controls change together; deck browsing explicitly does not certify card execution. Fixes selected-player deck marking while inspecting the CPU deck. Guest sign-in action is prominent.
- `play-pregame.js`: both selected decks use shared artwork; clear Setup → Starting player → Opening hand stages. Existing random seed/starting-seat resolution remains once-only and unchanged. No fabricated coin or replayable outcome animation. Session-only and timing disclosures are visible before Begin Practice.
- `play-player-mat.js`: shared animated logo and truthful loading stages; cancellation to setup; readable failure copy; dedicated final screen with final-board review, Rematch setup, Play setup and Home. Engine/session errors remain separate from terminal results. The release only exposes a winner, so the final screen explicitly says the ending reason cannot yet distinguish a timeout, concession or other ending. No false saved-result/recovery claim.
- Narrow `app.js` wiring: shared matchup artwork, consistent inspected seat, pregame artwork callback, focus restoration on close, real Home navigation, rematch through the retained setup, and explicit unsupported-device return actions.

## Evidence

- PASS: 75 focused local checks across menu/setup, seed selection, Back/active-match guard, artwork preservation, preparation, preflight and practice flow. Four new checks in `test-play-journey-ui.mjs` cover explicit format switching, Friends copy/controls, correct selected-player deck while inspecting CPU and guest readiness/sign-in. These four are reproducible from the commit with `node --test test-play-journey-ui.mjs`.
- PASS: 56 synthetic screen-layout cases: guest, Home fixture, ready setup, Friends, pregame, final result and session error at the eight UI-001 CSS viewport sizes. `docs/play-ui-002-layout-report.json` records the checks. The fixture uses the release shell navigation and the real UI modules, with mocked routing/account/engine data.
- PASS: synthetic Home → Play → cancel pregame → Play → Begin once → Keep → cancel Exit → Play Forest → Continue → result → Home; setup retained. Actual table/pregame/player-mat rendering and callbacks are exercised with a simulated session. `docs/play-ui-002-interaction-report.json` records 11 assertions and the three fixture commands. This is **not an engine match**.
- PASS: module syntax and whitespace checks. Visual review at 1180×757 is recorded in the setup/pregame JPEGs.
- NOT TESTED: uninterrupted supported engine match with these combined patches; owner's signed-in account; actual 200% browser zoom (590×378 tests equivalent reflow only); live auth/provider behavior; real touch/APK; human novice/no-coaching observation. These cannot be marked complete from the synthetic journey.
- UNSUPPORTED: session recovery and rematch restoration after refresh. Rematch setup retains in-memory deck choices and asks who goes first again; it does not replay or resume the prior match.

## Reproduce

Serve the repository with its existing static development workflow. Open `/experiments/phase-engine/ui-journey-index.html`. Run **Run layout matrix**. To run the interaction sequence, choose **home** or **ready**, wait for Ready, and click **Run synthetic journey** once on a fresh fixture. Choose **pregame**, **result**, or **error** to inspect those screens directly. These review-only files are not production asset allowlist additions.

The fixture's complete local import closure was compared with release hashes. Older `extras.js` and `desktop-play.js` preview copies were pinned before final QA; they are not production modifications in this patch. Synthetic navigation, fixture account and fixed starting choice are explicit test seams, not evidence of real authentication or a completed rules-engine match.

## Integration dependencies

SESSION-001 owns authoritative Smart/Full Control/stops. UI awaits the exact `turnFlow` schema before wiring the declared session methods. Accurate terminal reason and structured rejected-action explanations must come from that contract; the UI must not infer either from the last click, elapsed timer or hand contents. UI-001's changed pass labels and this new result screen need corresponding updates to full-match browser locators. Run the combined implementation from Home through result and back Home before publication.

The owner's whole-journey acceptance contract remains open for a real uninterrupted recording and new-player observation. Causal CPU spell/target animation also needs accepted-event details; a decorative turn banner alone does not fulfill that contract.
