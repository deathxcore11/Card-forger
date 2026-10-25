# Desktop Play setup — October 25, 2026

Owner clarification: first scope is **Standard and Commander**, with 1v1 Practice
against a CPU (Easy / Medium / Hard) and private Friends. Complete playable CPU
first, then Friends. Draft remains planned but is deferred until this works.
This explicit scope replaces the older requirement to ship Draft together with
the initial Practice review milestone. No release is authorized.

## Implemented in this checkpoint

- Play takes the desktop content width. Saved deck browsing and import occupy
  the left pane; a persistent selected-deck artwork/card inspector occupies the
  right. Each pane scrolls independently, with match controls below both.
- Standard/Commander switches filter by the deck's recorded format. A format
  change clears an incompatible selection and cancels pending import results;
  it never rewrites a saved list. A saved deck whose format changes elsewhere
  also loses its selection. This is not authoritative construction validation.
- Search by deck name or commander; collapsible pasted-list review. Original
  import rows, unknown cards and sideboards remain preserved. Editing retires
  stale results and keeps text focus/caret. Account changes reset preferences.
- Clicking the shared artwork tile selects it for Play. Other callers retain
  their original deck-opening action. The inspector reuses the existing four
  card presentations, selected-deck artwork resolver and read-only inspection.
- Practice/CPU and Friends are setup preferences, with Easy/Medium/Hard offered
  only for CPU. Both start buttons remain disabled. No room, opponent-strength,
  supported-pool or gameplay capability is fabricated by those choices.
- Colors, glass, artwork sources, card/finish renderer and other routes remain
  shared. The new owner screenshots are indexed by exact Library IDs and hashes;
  neither uploaded screenshot is included as a product asset.

## Executed checks

`node --test test-play-setup.mjs test-play-menu.mjs test-play-deck-import.mjs test-deck-viewer.mjs test-home-overview.mjs test-product-parity.mjs test-shared-deck-flow.mjs test-preload.mjs test-deck-art-ui.mjs test-game-navigation.mjs test-deck-box-polish.mjs`

Final result: **43 Node tests pass, zero failures**. The import file groups its
16 authored checks as one Node test. The first focused run had one test failure:
an old text-wide assertion matched the explanatory phrase “Use this list.” It
now asserts absence of the actual stale action, retaining the original intent.
The subsequent focused and final expanded runs pass. No full aggregate rerun
or fresh engine/mechanics run is claimed for this layout checkpoint.

`node scripts/play-menu-browser.mjs` with the documented local Playwright and
Chromium overrides passes in Chromium 153.0.8010.0, light/dark, at 1280×800,
1440×900, 1920×1080 and 2560×1440, plus a 900×650 reflow check. It checks pane
geometry, full content width, footer visibility, independent scrolling,
format/search/preferences, unchanged selected rows, all four views, import
review/focus and account clearing. Actual app handlers and refresh logic are
extracted from app.js; data is a synthetic account with 24 Commander lists and
one Standard list, mocked name lookup, and clearly labeled abstract SVG art.
A 76px fixture header reserves the desktop shell height; it does not test the
actual navigation header or live authenticated app boot. No console errors.

Evidence: [browser report](play-desktop-layout-browser-evidence.json), including
SHA-256 of each source used. Existing exact-printing/finish resolution limits
remain; these screenshots are layout evidence, not an artwork identity gate.

## Next required work

The number-one deliverable is still one complete human-playable 1v1 CPU match
in the private branch preview, with supported eligible decks, real human
choices/payments/cancellation, correct pregame/mulligans, a fair bounded CPU,
real stack responses, visible 30-second response policy, recovery and actual
terminal results. General human selections need authoritative validation,
not membership in generated AI candidate lists.

The corrected ninjutsu browser WASM is still unbuilt/unverified. Prior native
success does not change that fact. Both existing runtime regressions remain
untouched and blocking. The prepared larger-memory build is unrun and has no
spending approval; do not trigger it or repeat unchanged local OOM attempts.
Continue useful gameplay/control work within this boundary, then validate it
against the corrected provenance-verified runtime. UI setup preferences are
not the requested playable match. Nothing was published or deployed.
