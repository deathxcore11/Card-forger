# Broad deck choice, focused desktop UI

Owner clarification, October 25, 2026: populate a substantial library from good
sources and rotate choices through the meta, but do not overwhelm the player.
Use tabs and CardStashy's existing visual language. The six new screenshots are
inspected and indexed by exact Library IDs/hashes in the reference index.

## Interaction decision

- Four main tabs: **My Decks, Precons, Meta, Build**. Random is an action within
  Build, reusing the existing builder; it is not an additional top-level tab.
- One tab's content at a time. Start with a compact featured selection and an
  explicit Browse all/More action. Do not stack several full catalogs vertically.
- Keep search visible. Put colors, commander/theme and advanced filters in a
  compact disclosure; retain format as the existing top-level match preference.
- Choosing the player or CPU deck reuses this same browser. Clearly identify
  the seat being edited. Cancel cannot change the other seat's deck.
- Keep the persistent right inspector and all four existing deck presentations.
  Put source/date, exact list, strategy summary and linked pilot guide there.
  Tiles primarily show artwork, name and compact format/color identity.
- Keep match controls anchored. Preserve keyboard selection/focus, tab semantics,
  contextual menus, scroll position, printing/finish effects and warm glass/aura.
- Recommendations may rotate on a later visit or explicit refresh. Merely
  inspecting a card, changing deck view or returning from a guide must not reshuffle
  the current shelf. Selected player/CPU decks and saved matches never reroll.

The reference's set catalog is distinct from actual preconstructed decks.
Upcoming sets, custom cards, four-seat tables and provider bracket badges are
not evidence those cards/modes are supported. Initial Play remains Standard/
Commander, 1v1 CPU first. Bracket/power redesign is separate future work.

## Sources and evidence checked October 25

| Source | Useful role | Current evidence and boundary |
| --- | --- | --- |
| [MTGJSON](https://mtgjson.com/api/v5/DeckList.json) / published Wizards lists | Real precons and printing/zone identity | Prior checkpoint parsed the complete index and three exact product lists. Not all catalog rows are full decks. |
| [Official MTGO decklists](https://www.mtgo.com/decklists) | Recent Standard event/league lists | Already parsed by `mtgmeta.js`. This run read the live index and selected the October 24 Standard Challenge. Its event page timed out; no new live lists were imported. |
| [EDHTop16](https://edhtop16.com/about) | Competitive Commander event evidence | Official site describes its API; existing Meta normalizer preserves declared commanders. This run inspected source but did not query a live feed. Label cEDH explicitly; do not mix it into casual recommendations silently. |
| CardStashy saved/imported/builder results | User choice, curated builds and generated opponents | Reuse existing account-scoped flows. Freeze exact chosen result; generation/popularity is not engine admission. |
| [Moxgate Y'shtola guide](https://www.moxgate.com/guides/yshtola-nights-blessed-commander/) | Guide navigation and pilot-context reference | Read strategy/mulligan/sequence/matchup section structure. Link/attribute guides; do not copy an entire guide or execute prose as rules. Its multiplayer advice is not automatically valid for our 1v1 setting. |
| [Moxgate developer documentation](https://www.moxgate.com/developer/) | Integration reference | Describes outbound links that launch Moxgate, not an inbound deck-catalog feed for CardStashy. No engine switch or external match launch. |
| DeckCheck / EDHREC and additional publishers | Reference/candidate sources | DeckCheck restrictions were recorded earlier; [EDHREC terms](https://edhrec.com/terms) were inspected. Do not treat undocumented endpoints as an approved bulk data feed. Additional imports need a supported access path; no new paid services or messages authorized. |

Evaluate added sources by distinct useful lists, provenance, completeness,
freshness and permitted access. More domains do not necessarily provide more
decks. Keep provider/event date separate from fetch time, retain provenance for
duplicates, preserve source statistics and never turn league 5-0 lists or a
publisher ranking into a fabricated win rate. Cached source refresh and visual
rotation are separate operations; visiting a tab must not trigger many crawls.

## Code and executed checks

`experiments/play-precons/deck-shelf.mjs` adds a deterministic presentation
selector and an adapter for the existing normalized Magic Meta feed. It returns
IDs into the caller's catalog, never edits deck rows or starts a game. It limits
shelf size, favors unseen lists and archetype/provider variety, groups equal
named cards/quantities/zones while retaining every source/printing variant ID,
filters stale/future meta entries and requires a recorded first-seen date for
New Additions. A fetch timestamp never automatically becomes first-seen.

The grouping key is not an Oracle-name resolver, match-integrity hash, format
verdict or authenticated engine receipt. True name aliases may still appear as
separate lists until authoritative normalization. Source variants remain in the
catalog. `matchAdmission` is always `unverified`; that value cannot enable Play.

Executed `node --test experiments/play-precons/test-*.mjs`: **20 passed**, zero
failed/skipped/cancelled (10 new shelf cases and the prior 10 precon cases).
Syntax check passed. Cases cover deterministic source order, later-visit variety,
duplicate/printing retention, zone differences, source-date freshness, cEDH scope,
malformed rows, source identity and complete row cloning. These are authored
fixtures, not a live meta ingestion or browser/CPU demonstration.

Live index bytes were hashed and parsed with the unchanged, blob-verified
`mtgmeta.js`. The selected event GET timed out after 25 seconds/zero bytes;
the follow-up parser could not run because its file was absent. Web retrieval
also timed out. Exact outcome, source hashes and test totals are in
`experiments/play-precons/shelf-evidence-2026-10-25.json`. No repeated crawl.

## Remaining integration

The four tabs, CPU picker, source adapters/cache/first-seen persistence and shelf
selector are not mounted together in the app yet. Catalog snapshots/visit keys
need durable ownership; match snapshots need exact-list validation and recovery.
No UI/browser or engine tests are claimed by this slice. Existing product files,
collection, scanner, builder and foil behavior are unchanged. Next core priority
is the active corrected-engine proof, followed by actual human/CPU controls,
board, countdown and recovery. This work must not become repeated menu expansion
while the playable match remains unfinished.
