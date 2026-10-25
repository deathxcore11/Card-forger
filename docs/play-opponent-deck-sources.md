# Practice opponent decks

Owner clarification, October 25, 2026: the CPU can use precons, decks already
shown in CardStashy's Meta tab, online meta lists and the existing app's Random
Deck builder. The player can choose the CPU's exact deck in Practice or request
a random build. Use CardStashy's existing artwork-led shelf, shared four deck
views, context menus and persistent right inspector. Difficulty is an independent
choice; selecting Hard must not replace cards or widen information rights.

This extends the previously approved Precons / Meta / Random / My decks shelf;
it does not replace saved/imported decks or narrow the later history/opponent-copy
scope. Standard and Commander remain the initial formats. CPU gameplay stays
the first milestone; this clarification does not authorize more paid builds.

## Required source behavior

| Choice | Required behavior before a match |
| --- | --- |
| Precons | Load the actual product list and preserve all commanders, zones, printings and finishes. Distinguish a complete deck from a bundle, token pack or partial product. |
| Meta tab | Reuse the existing selected list and its source/version, not a generated approximation of the archetype. |
| Online meta | Use a permitted data source or explicit list import; show source and date. A list's popularity or historical format label is not a current legality result. |
| Random build | Reuse the existing app builder and selected format/constraints. Freeze the completed result before start; retry/reroll is explicit. Do not substitute a random precon for a requested generated build. |
| My decks / import | Preserve exact selected rows and source identity, separately for player and CPU. No inventory or account-deck save occurs merely by selecting an opponent. |

The selected CPU list is previewable before start. Freeze the full result,
source/version, selection/build inputs and RNG state in the match manifest.
Refresh/recovery must not fetch a replacement list, rebuild or reroll. A later
source update does not mutate an existing match. An unavailable source or failed
build retains a recoverable error; no fabricated deck or silent substitutions.

Both exact decks need authoritative format/construction validation, supported
card/rules coverage and the relevant CPU-choice coverage before match admission.
An imported product, generated suggestion or AI candidate list is not that
validation. Retain all declared commanders; partner/background and alternative
commander choices require explicit validation. CPU deck knowledge does not
permit access to the human's hidden hand, library order or future random values.

## DeckCheck reference and independent source

The owner supplied [DeckCheck precons](https://deckcheck.co/app/precons) as a
reference. Its [API documentation](https://deckcheck.co/docs/api), inspected
October 25, requires permission for data reuse in competing deck databases and
restricts bulk collection. No DeckCheck catalog was scraped or imported.

This slice instead reads [MTGJSON DeckList](https://mtgjson.com/api/v5/DeckList.json)
and individual [deck objects](https://mtgjson.com/data-models/deck/), keeping their
published source links. See [MTGJSON license](https://mtgjson.com/license/).
This is not a new license conclusion about card artwork or rules text.

## Implemented and executed

`experiments/play-precons/mtgjson-precons.mjs` is an isolated pure normalizer.
It retains commander, main board, sideboard, tokens, planes, schemes and display
commander separately, exact printing identifiers and actual finish flags. Unknown
finish remains unknown. Catalog and deck versions/products must match. Plain
source notes stay notes; international product filenames are retained and safely
URL-encoded. Future/undated products and unfamiliar product types remain explicit.

Ten authored parser regressions passed. The recorded external snapshot is
MTGJSON `5.3.0+20261024`: 3,131 product rows, including 198 `Commander Deck` rows.
These are product counts, **not** 3,131 playable precons or verified CPU decks.
Three complete source samples were actually loaded:

- Upgrades Unleashed: Chishiro plus 99 main; display commander stays separate.
- Turtle Power!: its published default Heroes in a Half Shell plus 99 main.
- Counter Surge: 60 main and 15 side; not labeled currently Standard-legal.

Reproduce with the exact externally retrieved bytes:

```sh
node --test experiments/play-precons/test-mtgjson-precons.mjs
node experiments/play-precons/verify-precon-sources.mjs \
  DeckList.json UpgradesUnleashed_NEC.json TurtlePower_TMC.json \
  CounterSurge_Q01.json evidence.json
```

The verifier pins SHA-256 for all four inputs, fails if unavailable/changed and
records source-code hashes. URLs and exact hashes are in
`experiments/play-precons/source-evidence-2026-10-25.json`. Downloading newer data
requires a separately recorded validation, not silently replacing these inputs.
Raw external card data is not committed. Initial live-data checks exposed plain
source notes and Unicode filenames; both were fixed with regression coverage
before the final complete catalog check passed.

## Still unfinished

This parser is not mounted in the product shelf, CPU picker or match authority.
Existing Meta/online-list/Random adapters, exact match-manifest persistence,
engine preflight and CPU piloting remain to connect and test. No product UI or
full match was exercised by these parser fixtures. The approved corrected-engine
build and preserved ninjutsu response regressions remain the immediate priority.

## Follow-up: rotating choices without overwhelming the UI

The owner supplied six more screenshots and a Moxgate pilot-guide link, then
explicitly requested tabs and a focused interface. See
[Play library rotation](play-library-rotation.md) for the four-tab decision,
source review, reference identities, implemented selector and exact test limits.
The full source catalog belongs behind focused browsing, not several stacked
feeds. No screen polish or source count substitutes for a working CPU match.
