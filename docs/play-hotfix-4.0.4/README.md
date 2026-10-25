# Web 4.0.4 Play hotfix

Production base: `a335844f5b1e3cfa90afc2248919251740882254`. The shipped WASM and executable card database are unchanged. This release repairs the UI/session boundary and bounded Smart proofs; it does not certify universal rules support.

## Changes

- Removed public starter launch/recovery shortcuts and implicit starter CPU opponents. Your decks, Precons, Meta, Community and Random remain the sources. Lists, commander designation, construction legality, current catalog legality and unsupported-rule checks remain intact.
- Smart's pinned-runtime proof now understands normal draw counts, mana activation counts, land summoning-status flags, payment facts and last-known-information caches. Tapestry Warden's specific passive combat/Station calculations no longer look like timing permissions. Unknown rule carriers still stop.
- On an empty stack, automatic main-phase completion is restricted to exhausted positions: no usable activated mana source, no floating mana, only ordinary creature/land actions, and explicit reducer rejection of every remaining hand/command action. It does not use incomplete AI recommendations as an empty-action proof. Empty attacker declarations require authorization and reducer preview. Full Control and phase stops override automation.
- Pass opponent's turn is an explicit, cancellable surrender of priority until the turn changes; mandatory choices and phase stops remain. Each dispatch is revision/decision bound, recomputed inside the serialized journal and protected by existing durable duplicate receipts.
- Drag casting uses the exact current automatic-payment interaction. Both your battlefield and stack accept spell drops. Stale, ambiguous, manual-only or off-seat offers do not submit. Spells still pay costs and use the stack.
- Own normal draw counts produce a private history entry and New highlight. No draw action was added to rendering or Continue. Lands have a readable minimum tile size and sit behind their controller's creatures. General instructions moved under Help.
- Compound/face identities require one matching provider identity. A front-name retry must prove the whole requested combined identity. Detect Intrusion maps only to its verified Spider-Sense identity in executable lists; saved source rows are preserved. Missing identity, missing legality metadata and known illegality have distinct messages.

## Evidence

- `focused-tests.txt`: 82 focused checks passed, including stale/duplicate actions, explicit yield, Full Control, unknown coverage, placement, source preservation and identity cases.
- `browser-{drag,click,manual,exhausted}.json`: Chromium 153 against the shipped WASM and real authority, journal, session and table. Automatic draw adds one hand card and removes one library card. Click, actual pointer drag and manual Forest payment each put Virulent Emissary on the stack once and resolve it with one payment. The exhausted case plays a Forest, casts the creature and reaches the requested opponent-upkeep stop without Continue clicks.
- [Opening-turn recording](opening-turn.mp4): engineered fixture, actual browser/session interactions. Card artwork is intentionally unavailable in the offline fixture. CPU responses are deterministic passes. This is not a signed-in production-account recording.
- `tramplesaurus-rex-match.json`: exact real 100-card Commander list and source, list hash, runtime identity, trace hash and result. Both seats are controlled by the production CPU worker through the authority/journal. Completed in 222 accepted commands, turn 10, winner seat 1. This is a full CPU mirror, not a full human browser match or a rules-compliance certification.

## Reproduce

Run `node --test experiments/phase-engine/test-shipped-response-proof.mjs experiments/phase-engine/test-priority-flow.mjs experiments/phase-engine/test-placement-hotfix.mjs experiments/phase-engine/test-seat-surface.mjs test-play-quick-start.mjs test-play-catalog-review.mjs test-play-deck-sources.mjs test-play-turn-controls.mjs test-play-ui-refinement.mjs test-version.mjs`.

Run `node experiments/phase-engine/play-hotfix-browser.mjs` with Playwright available through `CODEX_PRIMARY_RUNTIME_NODE_MODULES` and `CARDSTASHY_CHROMIUM_PATH` pointing to Chromium. Video recording needs Playwright's ffmpeg installation. Run `node experiments/phase-engine/real-deck-hotfix-match.mjs` for the exact Commander CPU mirror. `node experiments/phase-engine/verify-hotfix-response.mjs` checks that Giant Growth remains an offered response with an untapped Forest and creature target.

## Remaining limits

Smart still stops where complete absence of actions is unproved, including many unfamiliar mechanics and targeted-spell/main-phase combinations. A legal tournament list can still require engine mechanics or mandatory-choice UI not implemented here; it must be reported as unsupported, not banned or silently altered. Current format legality still applies to old tournament lists. The explicit opponent-turn yield is optional and can intentionally waive a usable response.

This hotfix does not add Modern, an engine adapter, persistent in-progress matches, or an updated Android APK. Android remains 0.6.0 beta with interface 3.95.1.

## Exact identity references

- Murderous Rider // Swift End: Scryfall's full Adventure record and both faces. Tests include combined names, face names, malformed composites and stale/missing legality. The installed definitions retain both faces.
- Detect Intrusion: [Scryfall OM1/28](https://scryfall.com/card/om1/28/detect-intrusion), canonical Spider-Sense, oracle ID `c4485bf9-e7ff-48b5-a983-02900939ee9d`. Exact named lookup alone fails; the exact printing establishes the alias. No cost, stats or abilities are synthesized.

## Upstream engine direction

[Forge](https://github.com/Card-Forge/forge) and [XMage](https://github.com/magefree/mage) remain candidates for an isolated adapter evaluation. Neither is integrated by this patch. Keep one authoritative engine per match, pin revisions and review their actual licenses/dependencies before reuse. Do not copy card scripts into the current runtime or splice two engines' game states. [Magarena](https://github.com/magarena/magarena) is also useful for CPU research; [Cockatrice](https://github.com/Cockatrice/Cockatrice) is a tabletop/client reference rather than proof of automatic rules coverage.
