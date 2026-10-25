# Play deck setup checkpoint — October 24, 2026

This branch now has desktop Magic `#play` deck setup, with the existing profile
avatar/name/username renderer, saved account deck tiles and shared deck viewer.
The first owner review target is a complete **1v1 human-versus-CPU match** using
an eligible saved or imported list in the private branch preview. Friend invites
and shared links follow reliable 1v1; three/four-player Commander is a later
feasibility decision. Draft remains recorded future work. This checkpoint only
implements deck setup; the CPU start button is visibly unavailable.

## Implemented

- Saved Magic decks are read from the current account workspace. Selection
  re-reads by ID; account generation/switching clears selections, draft text,
  pending results and profile details. Late card-name responses cannot write
  caches after an account switch.
- Clipboard import handles common section headings, quantity syntax, Arena
  printing suffixes, CSV, commanders, sideboard, maybeboard and split-card names.
  Original rows/printing hints and excluded entries remain in the review record.
  Unknown names and rejected rows stay explicit; quantities are not clamped.
- Imported candidates require explicit selection. Selection removes the duplicate
  preview and focuses its heading. Editing retires the stale preview immediately
  while keeping focus/caret in the exact field. Prior selected lists survive
  failed/new imports. No account deck or collection writes occur during setup.
- Preview uses the original detailed list, stack, art-grid and names-only controls.
  It ignores unrelated deck filters and keeps main/side counts separate. Absent
  declared commanders are not fabricated into the list.
- Desktop route/nav eligibility is checked again at rendering. Non-Magic routes
  return to Home when changing games. Draft and CPU match creation stay disabled.

The shared `deck-viewer.js` and CSS were compared byte-for-byte with the current
repository default branch during this check. Both match exactly. Those
components and their category-metadata caller changes in Magic, other-game,
generated and shared decks were carried across; no whole
website branch was merged. Existing card-detail/foil implementations are reused.

## Checks and evidence

- 16 import cases; 19 setup unit cases; seven menu/renderer cases pass.
  Node reports 27 tests because the import file groups its 16 checks as one test.
- Existing deck-viewer, game-navigation, home-overview/device admission and
  module-preload/service-worker coverage checks pass.
- 69 isolated engine/CPU/clock contract tests pass. These do not prove a CPU
  playing strength or a complete match UI.
- `scripts/play-menu-browser.mjs` passes in light/dark themes at widths 1280,
  1440 and 1920. It uses real shared renderers and extracts the actual Play
  handlers from app.js. It exercises saved selection, pasted import review,
  all four views, stale-preview removal, focus preservation and account switch.
  Account/deck/name lookup data is synthetic; no live sign-in or match is tested.
- The first browser script used the label `names` instead of the existing internal
  view key `symbols`; it timed out. The corrected driver passes all four views.
- The first broader npm run stopped at a missing unchanged native-transport test
  dependency in the partial checkout. Baseline files were restored only when
  their Git blob hashes matched the current Play tree. No APK was rebuilt. The existing APK was later restored byte-for-byte against
  its Git blob hash solely for the existing installer-integrity test.

Run `node --test test-play-deck-import.mjs test-play-setup.mjs test-play-menu.mjs`.
For the optional browser check, supply CARDSTASHY_PLAYWRIGHT_MODULE and
CARDSTASHY_CHROMIUM_PATH when the environment does not have default Playwright
Chromium. Reports/screenshots go to `test-results/play-menu-browser/`.

The aggregate test script's 313 commands completed across resumed runs: the
first 72 passed before a missing test file, the next 71 passed before the missing
existing APK fixture, and the remaining 170 passed after exact-byte restoration.
After the final shared-renderer caller sync, product parity, shared deck flow,
AI deck handoff, deck viewer, preload and Play browser checks were rerun and pass.
This is not a claim that one uninterrupted npm invocation ran against every final
byte. Full source hashes and the browser report are retained alongside this file.

## Still required

The corrected ninjutsu browser runtime remains unbuilt/unverified. Both preserved
browser-runtime failures still block engine adoption. The optional paid build
has not been authorized or launched. Native success is recorded separately.

Printing hints are retained in imported `rows`, but the existing name-based deck
renderer/resolver does not yet prove exact alternate-printing artwork/finish in
Play. Add exact row/printing resolution and action identity before claiming that
presentation gate. Named commander/partner declarations also require authoritative
format validation. Import readability is not construction legality or executable
card/CPU support. Unmatched lists may be reviewed but cannot start matches.

Remaining gameplay work includes supported-pool/deck preflight, authoritative
human targets/payments/cancellation/mulligans, fair bounded CPU, board/inspector,
visible response timer and complete mandatory-choice timeout policy, browser
recovery/results/history, and then the later social/Draft scope. This setup page
is not the requested playable beta. No deployment or production merge occurred.
