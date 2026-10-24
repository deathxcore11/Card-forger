# Four deck views — development review

This checkpoint adds one presentation component to the existing website. It is
not a 4.0 release, a gameplay proof or completion of the release entrypoint matrix.
Before captures use commit `349d873`; after captures use this commit's source.
Cards, prices, quantities and artwork in these captures are synthetic fixtures.
They demonstrate layout and identity retention, not live provider availability,
physical finish fidelity, supported gameplay or deck strength.

## Before and after

| Surface | Before | After |
| --- | --- | --- |
| Saved list, 390 px | [Prior list](before-390.jpg) | [Portrait list](after-list-390.jpg) |
| Saved list, 1440 px | [Prior list](before-1440.jpg) | [Portrait list](after-list-1440.jpg) |
| Overlapping cards | No shared stack view | [390 px](after-stacks-390.jpg) · [1440 px](after-stacks-1440.jpg) |
| Card art grid | Existing saved-only view | [Shared grid](after-grid-1440.jpg) |
| Names only | Existing saved-only view | [Shared names view](after-names-1440.jpg) |
| Light mode | Existing theme | [Art grid, 390 px](after-light-grid-390.jpg) |
| Source and selection | Separate row renderers | [Tournament](after-source-grid-390.jpg) · [Selected proposal](after-selection-grid-390.jpg) |

The [capture manifest](captures.json) records dimensions and SHA256 hashes.
JPEGs are review copies; the browser jobs retain their original PNG evidence.

## Implemented behavior

- Detailed list, overlapping stacks, art grid and names only reuse the original
  card nodes, actions and game-specific zone boundaries. A view change does not
  regenerate, reorder, save or import a deck, or mutate owned inventory.
- Saved Magic/Pokémon/Yu-Gi-Oh! decks, shared construction/AI results,
  tournament/adapted lists, shared/Wiki snapshots and the older selection
  proposal use the same per-game deck preference. Collection/search views keep
  their existing independent three-mode controls.
- Stacks group up to six rows per column, scroll within their group, and raise a
  card on hover or keyboard focus so its existing actions remain reachable.
  Quantity badges and full portrait images remain visible in art presentations.
- The controls have one tab stop and Left/Right/Home/End keyboard navigation.
  Switching views keeps checkboxes, disclosures and the active source context.
  Back restores the current saved presentation of the exact original deck.
- The original printing/finish models and finish renderer are reused on large
  card surfaces. No card lighting material, name-foil implementation, pack
  sampler, APK/native implementation or card-detail design is replaced.
- Preference saves keep a generated result valid. Inventory, deck, pricing,
  game, account and workspace changes still have validity guards.

## Bugs found during the work

1. Magic's whole-list purchase comparison aggregates main deck and sideboard.
   The editable main list reused that comparison, so a card in both zones could
   display their combined quantity and the page could count sideboard cards
   toward the constructed size. Main rows and size now use main quantities;
   shopping retains both zones and sideboard ownership deducts main allocation.
2. A generated result's guard compared the saved state object's identity.
   Saving only a layout preference replaces that object, incorrectly blocking
   card inspection, export, save or budget rebuild. The guard now compares the
   relevant build inputs while retaining account/workspace epoch checks.

## Validation receipt

- Saved/source browser: **PASS**, 17 scenario records.
- Generated/Ask browser: **PASS**, six viewport/surface cases plus the real
  mocked-Ask receipt/return/cancel flow. All six generated results also retain
  exact export and card/Back after preference writes.
- Deployment-verifier tests: **PASS**, all 10 tests. New CSS/JS have explicit
  entries in the fixed public-asset inventory.
- Module graph/offline inventory: **PASS**, 230 preloads; shell cache v316.
- Full JavaScript aggregate: **PASS**, all 312 commands, exit 0. The final
  run used the complete source in this checkpoint and ran without concurrent
  browser QA.

The browser suites use the real application and controlled provider responses.
`tests/deck-viewer-browser.mjs` covers all three saved-deck games at
320/390/768/1440 px, all four layouts, exact ordered cards/actions/finishes,
main/extra/side quantities, keyboard reach inside stacks, unchanged ownership,
filter retention and reload persistence. It also exercises Light mode, the
actual Magic tournament opening/card/Back path, and renderer-only shared and
selection-proposal layouts. Renderer-only coverage does not certify community
networking or a complete source entrypoint.

`tests/deck-build-presentation-browser.mjs` additionally exercises actual
construction at 320/390/1440 px on solid and glass surfaces, all four result
views, exact export and card/Back after preference writes, budget rebuild,
animated progress, cancellation, errors and no autosave. Its mocked Ask call
uses the real separate-sheet/receipt path and checks the same four views.

Local browser configuration: Playwright 1.62.1 with Chromium 153.0.8010.0,
`--no-sandbox --disable-dev-shm-usage --disable-gpu`. Physical Android,
real-provider latency and card artwork fidelity are not tested by this receipt.

Earlier attempts remain part of the record: browser screenshots timed out
under concurrent load; the initial generated-result pass exposed the preference
invalidation bug above. A reload assertion in the new harness also needed to
rebind its test-only state reference after the browser created a new document.
The initial full aggregate run stopped at the existing 145 ms Scryfall queue
wall-clock assertion while browser QA was also running. The unchanged isolated
queue test passed. No deadlines, screenshot assertions or functional guards
were weakened.

The next aggregate passed that queue check and reached the printing-popup VM
lifecycle harness, which had not provided the newly imported viewer-sync
dependency. The harness now binds the actual exported function; its printing,
queued-close, account and focus assertions are retained and pass. The final
aggregate passed with that explicit dependency included.

The added generated-card inspection correctly reached the existing public
price-watch registration. The strict search fixture initially rejected this
POST. That one exact local endpoint is now intercepted using the existing
detail fixture's public-ID classifier, with no credentials/private fields and
no forwarding. Synthetic IDs retain its 400 response. Other network writes
remain forbidden; this does not relax the application's mutation boundaries.

Hosted baseline `349d873` finished with 68 successful checks, one skipped
production deployment and one failed scanner-adversarial job. The failed job
stopped on an HTTP 503 fetching its public TCGdex reference image
`assets.tcgdex.net/en/swsh/cel25/3/high.webp`, before scanner browser assertions.
The AI recovery and remaining jobs passed. This is not an all-green CI claim;
hosted results for this new checkpoint are separate evidence.

## Still required

The release matrix remains open for a complete Random entrypoint, imported
lists as a separate entrypoint, all game/source combinations, post-draft and
Practice selection. Post-draft and Practice gameplay are not implemented.
The first format/card pool, fair CPU, complete seeded games, cold offline
save/restart/resume, history/opponent saving, private Casual and Draft remain
unproved. Random speed/quality provider replays and physical-device latency
remain separate work. Production and the published APK are unchanged.
