# CardStashy 4.0: desktop website release

Status: development scope and implementation sequence, not a release receipt.
Product direction updated October 24, 2026.

## Platform decision

The owner's latest instruction takes precedence over the older native-first
practice blueprint:

| Surface | 4.0 scope |
| --- | --- |
| Desktop website | UI redesign and the supported Magic Play experience |
| Phone/mobile website | Existing collecting and deck tools remain usable; new Play is unavailable |
| Tablet/foldable browsers | Do not treat a wide viewport as desktop eligibility; Play remains unavailable until explicitly included and tested |
| Published Android APK | Defer changes while website 4.0 is developed and debugged |
| Later APK update | Port the selected accumulated fixes and redesign after website stabilization; exclude Play |
| APK gameplay | Separate future release decision; 4.1, 4.5 and 5.0 are possibilities, not commitments |

Play availability must be enforced at the route/session boundary as well as in
navigation. A hidden button, desktop-site toggle or widened phone viewport is
not an eligibility check. Do not introduce Play dependencies into the current
native bundle, rebaseline Android, change its release record or replace its APK.

This platform change does not silently remove the blueprint's desktop offline
goal. Prove an actual browser-local engine/runtime and cold-start offline path,
or resolve that requirement explicitly before claiming the full Play scope.

## Release baseline and recovered work

At takeover, the inspected GitHub default branch was
`096e21e5cb70427f2dcfc83a0c8f90973368ac52` (website 3.95.3).
[PR #47](https://github.com/deathxcore11/Card-forger/pull/47) was open and draft
at `1b8678d5b1830aa61f0be889a78400b7f1a3d0ab`, with tree
`ab08a8eaaa34b2186b80915e5637a03ddc3abfb8`. This is repository evidence;
direct production-asset requests returned HTTP 403, so deployment was not
independently verified.

The supplied preserved patch was applied only after checking the exact tree and
`git apply --check`. Its SHA-256 is
`369dc11453f2f9e246e37450ac8853f30e349bac5ce891a35e30421a6b226a95`.
All nine resulting files matched the supplied size and SHA-256 manifest.
Keep this recovery separate from the redesign. Restoring work is not evidence
that its remaining release gates have passed.

## Product invariants

- Preserve the existing card popup and printing-specific foil/name treatments.
- Saved lists, source lists, CPU decks, virtual packs and draft pools never add
  owned inventory automatically.
- Keep rules legality, executable engine support, strategic judgment, price
  coverage, ownership and reference provenance distinct.
- Back/Close restores the originating deck, search or AI conversation and its
  useful selection, filters and scroll position.
- Retain CardStashy's artwork, soft glass, aura and rounded controls. Borrow
  interaction principles from references without copying their branding or code.
- Initial Play modes are Practice, Casual and Draft. Ranked and public
  matchmaking remain later work.

## Implementation sequence and exit evidence

| Stage | Concrete result | Evidence required before advancing |
| --- | --- | --- |
| 0. Recover baseline | Preserve and review the unfinished deck repair, parser optimization and DFC identity guards | Exact revision, focused and aggregate results, reference replay, relevant browser checks, latency measurements and unresolved failures |
| 1. Shared deck viewer | Detailed list, overlapping card stacks, full-art grid and names-only presentations of one exact list | Same identities/quantities/zones across layouts; retained filters, selection, grouping and return context; read-only permissions; keyboard and pointer QA |
| 2. Website cohesion | Confirmed home order, search/AI placement, softer shared tabs and consistent deck entrypoints | Before/after review and loading, empty, error, unavailable, stale and recovery states; regression checks on existing mobile tools |
| 3. Engine proof | An authoritative engine adapter executes supported interactions and complete CPU games | Runtime/license/dependency fit; two frozen executable decks; seeded games in both seats; legality, privacy, cancellation and terminal traces |
| 4. Desktop Practice | Lobby, full-window table, legal choices, payment preview/manual selection, local teaching, recovery and history | Real engine state drives UI; supported deck preflight; measured CPU budgets; exact deck versions; offline/resume proof |
| 5. Draft | Validated products/cubes, bounded draft bots, pool-to-deck review and Practice handoff | Pack/pick integrity, basics policy, construction rules, save/resume and strict separation from owned inventory |
| 6. Private Casual/friend sessions | Explicit invitations/codes, accepted seats, authorized commands and reconnect | Defined rules/manual-mode boundary, per-seat privacy, stale/duplicate command rejection, disconnect policy and hidden-data tests |
| 7. Stabilize and release | Reviewable website 4.0 candidate, measured behavior and a rollback record | Exact final revision and passing required checks; supported-browser evidence; known coverage limits; production verification after deployment |
| 8. Later APK batch | Bring selected non-Play website improvements into Android | Separate source selection, existing signing/release checks and explicit exclusion of Play |

The stages are dependency order, not release dates or permission to ship an
incomplete engine behind finished-looking screens. UI work can progress while
the engine feasibility spike runs, but visual readiness must not be presented
as game readiness.

## Initial UI audit and reuse map

Inspected implementation: plain JavaScript modules and static CSS/HTML, not a
React or Tailwind project. Preserve existing routing, account boundaries and
state contracts.

| Area | Existing implementation | Target change |
| --- | --- | --- |
| Saved Magic deck | `views.js` (`deckCards`, `deckList`, `deckRow`) | Reuse exact rows, counts, grouping, filters and existing card-detail actions in the shared viewer |
| Saved Pokemon/Yu-Gi-Oh! deck | `tcg.js` (`deckCardsTab`) | Keep game-specific zones, identities, selected printings and edit permissions while sharing presentation |
| Generated/AI result | `deck-experience.js` (`deckResultMarkup`, `createDeckExperience`) | Retain scoped receipt, explicit save, budget rebuild and warnings; use the same four presentations |
| Shared/Wiki source deck | `shared-deck-view.js` | Retain source attribution, zone boundaries and independent-copy behavior; share the viewer without granting edit access |
| Current layout controls | `workbench-ui.js` | Existing gallery/compact/symbols settings are not yet the specified four-layout deck viewer; preserve unrelated collection controls |
| Card popup and effects | `views.js`, `tcg.js`, finish modules | Reuse with minimal polish; do not replace or flatten the finish system |
| Home | `home-search.js`, `home-today.js`, `views.js`, `tcg.js` | Art header; single search pill with adjacent AI; combined featured panel; collection value; meta samples; one News block |
| Glossary | Existing local terms, Oracle/card references and inline help | Add contextual discoverability around inspection; do not invent a disconnected dictionary or model-authored rules |
| Play | Existing draw/goldfish/tabletop utilities | Useful presentation patterns only; they are not an authoritative Magic engine |

Live reference inspection used the public Moxgate Commander lobby and its Deck
Preview on October 24. The lobby keeps deck selection, a prominent selected-deck
preview, seats and primary actions together. The preview groups overlapping
cards by curve/type and keeps deck counts and confirmation visible. These
observations inform spatial hierarchy only. CardStashy must apply its own
format/zone rules rather than inheriting the reference's generic bench or
Commander sideboard controls.

The supplied screenshots and the public lobby/preview are sufficient for the
first viewer/lobby design pass. Further reference requests should identify a
specific missing interaction such as targeting, stack responses or payment.

## Gameplay requirements retained from the handoff

- Engine-owned legal actions, current-revision validation, stack, priority,
  targeting, costs, combat, triggers and terminal outcomes for supported cards.
- Fair Easy/Medium/Hard policies use permitted observations, never the other
  player's hidden hand or future library order.
- Full browser-content play surface without the ordinary header/search or
  app-added financial frames. Do not force OS/browser fullscreen.
- Inspection is separate from playing. Keyboard/tap controls complement drag.
- Payment has a legal preview, manual override, cancellation before commit and
  stale-state rejection. Do not automatically sacrifice/discard/pay life.
- Actual format-correct mulligans and first-turn draws; no generic free redraw
  or cosmetic four-player switch presented as rules support.
- Confirmed Exit/Concede from a started CPU match records exactly one loss.
  Cancel changes nothing. Crashes and suspension take a recovery path.
- History freezes both deck versions, rules/CPU versions, difficulty,
  assistance settings and result. Copying an available CPU list saves a deck
  without changing owned inventory.
- Future friend sessions transmit only the authorized view for each seat.

## Decisions still requiring evidence

The platform is now decided. The first supported format/card pool, actual engine
and browser-local runtime, offline package size, tested CPU budgets, multiplayer
recovery policy and first draft products are still unproven. Do not assign a
cost, schedule, coverage percentage or ready label without measurements.

An external Moxgate Challenge Link is not the requested integrated Play engine,
and an online engine service is not cold-start offline support. Choose the
integration deliberately after the engine/runtime proof.

Current primary references:

- [Moxgate FAQ](https://www.moxgate.com/faq/): describes its rules-enforced Forge
  mode separately from its manual Casual mode.
- [Moxgate Developer API](https://www.moxgate.com/developer/): documents external
  Challenge Links; that handoff is not an embedded CardStashy engine.
- [Forge README](https://github.com/Card-Forge/forge/blob/master/README.md):
  describes Java implementation and Java 17+ for the desktop package.
- [Forge license](https://github.com/Card-Forge/forge/blob/master/LICENSE):
  GPL version 3. No Forge code or dependency has been added here. Its desktop
  package documentation does not establish a browser-local runtime fit.

## Recovery and rollback

Keep baseline recovery and 4.0 work in separate commits/branches. Do not change
the production branch until a concrete tested candidate is reviewed for release.
Rollback should select the last verified website revision without deleting user
collections, decks, match history or recovery saves. Version new match schemas;
an incompatible save must remain identifiable rather than being silently
reinterpreted. APK artifacts stay outside this release.
