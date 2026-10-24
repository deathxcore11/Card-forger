# Deck requests and shared results

The October 23 feedback exposed two separate failures in the website: natural “only Goblins” wording was treated as a soft theme, and the conversational builder deliberately put its full result inside Ask rather than the shared deck sheet. A legal 100-card list is insufficient evidence that either the requested composition or its strategic plan was fulfilled.

## Request fidelity

- Keep format, colors, spending cap and basis, required/excluded cards, creature-card restrictions, subjective goal, and requested loop output as separate fields.
- “Only Goblins” restricts creature cards, including the commander. It permits lands and noncreature support. It does not promise that every token those cards can produce is a Goblin.
- “Only red cards” is a color instruction. A resource request such as unlimited mana does not remove a monetary cap.
- Follow-ups retain the captured request; explicit revisions can replace a restriction. A new deck request starts a new contract. Model suggestions cannot silently relax a hard requirement.
- Unknown card types fail a hard creature restriction. Card names, mentions of a creature type, and effects granting another creature a type do not establish that the card itself has that type.
- Intentionally weak, fun, and chaos are selection preferences. They do not authorize an illegal list, missing required pieces, or an unsupported claim about competitive strength.

## Construction and evidence

The existing format-aware builder remains the selector. Bounded discovery collects creature members, tribal payoffs, and production/resource candidates separately. Every candidate still goes through exact card resolution, format legality, identity, copy limits, available ownership, and price coverage checks.

The tribal package policy reports actual creature membership, recognized provider/payoff relationships, and natural access to physical library cards. The coverage targets are an explicit builder policy, not a universal rule for good Magic decks. Commanders are excluded from library-draw probabilities; token output is not counted as cards drawn. Thin or unmodeled plans remain partial or unverified and do not receive a supported-theme verdict. They can remain reviewable legal drafts.

Positive infinite-mana requests use a finite reviewed package catalogue. Each package identifies exact cards and current Oracle features, prerequisites, casting versus startup costs, ordered steps, a productive repeating resource ledger, and limitations. Requested output matters: infinite colorless mana does not establish infinite red mana, tokens, damage, or a win. The final exact-list check must retain a compatible complete package after construction, swaps, rebuilding, and saving. Unrecognized outcomes and unprovable negative guarantees require clarification or an explicit unverified path.

Keyword recognition alone is not prerequisite coverage. Bloodthirst, for example, needs opponent damage earlier in the same turn before the payoff enters; loss of life without damage and that creature’s own later enters trigger do not establish its entry condition. A named Blood Lust card is a separate exact-card request. Mechanic-specific support must expose its timing and evidence limits.

These checks are conditional rules evidence. They do not simulate a whole game, establish access to every piece, account for every possible battlefield modifier, guarantee an uninterrupted combo, supply a winning outlet, or prove tournament strength.

## Presentation and lifetime

A completed Ask build opens the existing deck sheet with the same artwork header, compact card rows, review, budget rebuild, export, and explicit Save behavior used by the shared deck experience. Ask keeps a compact receipt, not another full deck interface.

The app stores that receipt and finishes the Ask turn before closing the conversation. Each receipt references its original scoped result. Later questions cannot redirect it to another build; canceled or stale work cannot open over the current screen. Account and collection guards remain active. A saved result retains its saved state when reopened.

Request restrictions, partial strategy evidence, and mana-loop steps use the existing deck styling. The interface separates structure checks, prices, theme evidence, and conditional loop evidence. It does not present an AI-written list or a model-authored success claim as an app-checked result.

## Regression coverage

Focused tests exercise natural and adversarial request wording, real card rules snapshots with labeled synthetic filler/prices, pure or honestly incomplete construction, independent final-list rejection, loop startup/output/missing-piece cases, and result lifetime. Actual-app browser suites cover the separate sheet, card-detail Back, receipt reopening, progress visibility, cancellation, and phone/tablet/desktop layouts.

Mocked provider responses establish app orchestration and guard behavior; they do not establish live model interpretation quality. Real-world deck quality still requires live requests and playtesting.

This is a website change. Preserve the scanner patch and the published Android package, native baseline, and downloads. A later Android batch must use the final selected website commit and the existing strict release verification.

## Per-game online references

The shared Wiki page uses fixed providers: MTG Wiki for Magic, Bulbapedia for Pokémon, and Yu-Gi-Oh! Wiki for Yu-Gi-Oh!. Each game has isolated search, response and daily-topic caches. Only public topic names go to the reference reader; no profile token, collection, deck or chat history is forwarded. Native service admission explicitly inventories the two public reference POST routes.

The online reader uses normal documented MediaWiki queries, bounded plaintext quotations, attribution and source/license metadata. Unavailable upstream access, missing extracts or unverified image rights remain explicit. Background, video-game, anime and TCG Pocket content cannot establish paper card-game rules. The original local concept notes and safe reading links remain useful when an online article is unavailable; they do not claim that the whole wiki was retrieved.

Production baseline for this change is PR #42 merge `aaf7e365e87a5caf7d749fb9a70126a0c711f148`, deployed as Cloudflare version `5e548640-556d-4aa6-bb59-2a65932f29b9`. The final Android source selection must include that ancestry and all subsequently verified website changes.
