# CardStashy 4.0 — target release notes

**DRAFT · NOT RELEASED · NOT A TEST-PASS REPORT**

This is the intended release coverage. Final notes must be reconciled with the
actual shipping commit, supported-card manifest and completed validation. A
planned bullet below does not mean the feature is implemented or working today.

## A more cohesive website

- A compact, blended header groups the CardStashy identity, game selector,
  search, AI action, navigation and profile controls without a large separate
  masthead. Desktop Play has a clear entry when available.
- One continuous daily artwork background flows into Home. The duplicate daily
  art panel is removed.
- Card of the Day and its collectible pack appear above collection value,
  followed by a few personal saved decks, Community Meta decks and one News
  area. Preserve honest unpriced coverage and existing account/game boundaries.
- Keep CardStashy's soft glass, aura, artwork, rounded controls and existing
  printing-specific foil/name effects. The card popup receives minimal polish.

## One deck viewer, four presentations

- Detailed list, overlapping card stacks, full-art grid and names-only layouts
  present the same exact deck.
- AI, meta/source, random, saved/imported, post-draft and Practice-selection
  entrypoints share that viewer and its basic navigation.
- Switching views preserves quantities, zones, sorting, filters, selections,
  selected tab and useful scroll context. It does not regenerate the list.
- Back from a card restores the deck; Back/Close from a deck restores its
  source, including an originating AI conversation.
- Source/shared lists remain read-only until explicitly copied. Saving a list
  never adds its cards to owned inventory.

## Deck-building repair and performance

- Carry the recovered fixed-pattern parser optimization into Random Deck and
  the other shared builder entrypoints. Measure actual end-to-end behavior
  rather than promising a universal build time.
- Retain the animated deck-building indicator, progress updates, cancellation
  and automatic opening of the completed result.
- Preserve exact double-faced-card identity and printing/quote/ownership
  accounting, honest unverified drafts, explicit saving and budget rebuilds.
- Review Vehicle crew support, theme/Aura density and actual closing routes
  separately from speed. A fast full list or high Power score is not proof of
  deck quality or a win condition.

## Magic Play on desktop

- The target modes are Practice against a local CPU, rules-enforced private
  Casual with friends, and a supported Draft-to-deck-to-play flow.
- Preflight checks both format legality and executable support for the exact
  deck and mode. Unsupported cards are identified before play; there is no
  silent manual fallback.
- The match fills the browser content area with a readable battlefield, bottom
  hand, player status, phase/priority, stack and optional action log.
- Selecting or dragging a card highlights legal actions, targets and
  destinations. Keyboard and tap alternatives use the same command path.
- Opening hands, starting player, mulligans, costs, targets, responses, combat,
  triggers and terminal outcomes follow the authoritative rules engine.

## Readable cards and automatic game state

- Track life, marked damage, counters, attachments, deaths, zone changes and
  wins/losses automatically as the engine resolves the supported interactions.
- Board cards show current power/toughness, counters and relevant granted
  abilities/status while preserving the printed card image and finish.
- A desktop inspector shows the selected card, exact rules text, current
  characteristics, attachments, and supported effect-source/expiry information.
- Contextual glossary help works by selection, focus, hover or tap and keeps
  rules terms distinct from strategic deck-role labels.
- Actual decisions still pause for the player. Automation does not skip legal
  responses, targets, blockers or meaningful optional choices.

## Mana assistance with manual control

- Preview an engine-legal automatic payment and retain useful resources where
  possible. Manual tapping/source selection remains available.
- Respect supported colored, generic, colorless, hybrid, X and alternative or
  additional costs and spending restrictions.
- Prompt before strategic sacrifices, discards or life payments. Uncommitted
  previews can be canceled; stale previews are recalculated before committing.

## A CPU that follows the deck's plan

- Combine engine-legal moves, permitted observations, versioned deck playbooks
  and bounded tactical evaluation/planning.
- Evaluate development, attacks, blocks, removal, responses, protection,
  immediate wins/losses and required synergy/combo resources.
- Easy, Medium and Hard vary tested decision behavior and planning budgets.
  They do not gain access to the opponent's hidden hand or future draws.
- Keep CPU skill separate from opponent deck strength. Do not promise mastery
  of every generated deck or untested mechanic.

## Offline play, recovery and useful match history

- Prove actual cold-start offline supported Practice, including local CPU,
  rules, coaching, saving, restart and resume after the required package is
  installed. A cached screen or online solo match is not offline support.
- Preserve pending choices and exact engine/deck/CPU versions on recovery,
  without duplicate moves or results.
- A completed game opens the player's deck under Matchups → Practice history.
  Retain the exact lists played, difficulty, assistance, result and terminal
  reason, independently of later deck edits.
- Inspect and explicitly save a completed CPU opponent's actual deck,
  including a randomly generated opponent. This creates an independent saved
  list and does not add owned cards.
- Confirmed Exit/Concede during a started CPU game records one loss. Cancel
  continues unchanged; crashes and engine failures follow recovery.
- Keep CPU Practice results separate from human competition, simulations,
  published source records and heuristic Power scores.

## Packs, Draft and friends

- Preserve the existing tactile collectible pack-opening feature and its
  explicit collection actions.
- Put the supported desktop Draft action beside relevant pack actions. Draft
  uses validated products/cubes, collation, picks, pools, basics and limited
  deck construction; its virtual cards do not become owned inventory.
- Private friend sessions use explicit invitations/codes, authorized seats,
  rules-enforced actions, per-seat hidden-information filtering and tested
  reconnect/duplicate-action handling.

## Platform scope and later work

- Play in 4.0 targets supported desktop website environments. Phone, tablet,
  foldable and uncertain-device Play remains unavailable; width alone does not
  establish desktop support. Existing mobile collection/deck tools remain.
- No APK update is part of this release. A later APK batch will bring over
  selected accumulated fixes and redesign without Play.
- RPG/roguelike Journey builds on this foundation later, reusing rules,
  coaching, immutable run-deck history and opponent inspection/copying. Virtual
  rewards remain separate from owned cards.
- Ranked, public matchmaking and APK gameplay are separate future decisions.

## Required before replacing this draft with final release notes

Freeze the supported constructed format/card pool and first Draft product.
Prove the engine early through complete seeded CPU games and offline resume.
Complete the six-entrypoint/four-view matrix and reference-based visual and
interaction checks. Retain the actual source revision, focused/full/browser
results, device measurements, known limitations, deployment verification and
rollback record. Remove or explicitly defer any bullet not actually shipped.

Current implementation and acceptance details live in
[the 4.0 release plan](cardstashy-4.0-desktop-release-plan.md).
