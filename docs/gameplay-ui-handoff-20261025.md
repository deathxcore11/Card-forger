# Gameplay → UI handoff

Task: `RULES-MANIFEST-001`. Starting release: `2af11c9a1326e0db75b875d9c122e3dea01055d7` (4.0.0). This is a proposed interface contract and copy guidance, not a claim that manifest is supported. See the [executed rules audit](gameplay-rules-manifest-audit-20261025.md).

Build each decision around **what happened, what I can do now, and what happens next**. Keep the game table visible while the player makes the decision. Show the acting player, the reason for the prompt, and a clear completion condition.

The UI chat is already handling the tabletop and smart-priority presentation. This document supplies rules boundaries for that work; it does not assign this rules branch ownership of the UI implementation. The [smart-priority contract](gameplay-smart-priority-contract-20261025.md) covers auto-pass, Full Control, stops, main-button labels and animation races. Its new scenarios are NOT TESTED; they are not included in the 24 executed manifest cases.

## First bounded UI task

Use a separate branch from the shared release. Start with the decision panel and its feedback for one currently admitted starter-deck spell that requires a target. Use engine-authored choices. Verify pointer and keyboard submission, response priority, cancellation where offered, an illegal/stale selection, and the resulting accepted state. Record the commit, starting position, clicks/keys, expected/actual result, and recording or assertion.

Coordinate ownership before editing shared adapters such as `seat-surface.mjs`, `interaction-surface.mjs`, or `match-session.mjs`. This rules branch changes no production files. Do not enable Manifest Dread or Innocuous Rat in the supported pool to demonstrate the new UI. Those need the fixes and broader evidence below first.

## Decision panel and plain-language copy

| Situation | Presentation | Required behavior |
| --- | --- | --- |
| Priority | “You can act” / “Waiting for opponent”; separate from whose turn it is | Show only currently legal actions. A turn belonging to you does not always mean you have priority. |
| Choose a target | “Choose 1 creature for [spell]”; “0 of 1 selected” | Highlight legal engine-authored candidates. Give a text label/list equivalent to each arrow. Preview the selected target before submitting. |
| Multiple choices or ordering | State the required count and show selected order | Modes, sacrifices, card order and payments need their own clear controls. Do not silently choose for the player. |
| Optional action | “Do you want to [action]?” with explicit accept and decline | Offer a decline path only when the engine allows it. |
| Mandatory action | Explain why a selection is required | Closing a details panel must not abandon the decision. Keep a persistent “Decision needed” route back to it. Never turn Escape into an illegal cancellation. |
| Payment | “Pay [cost]”; show the actual sources an authoritative preview would use | Automatic payment may choose consequential sources. If a trustworthy preview is unavailable, that is a dependency; do not invent one in the UI. Manual payment must use legal engine choices. |
| Rejected/stale command | “That choice is no longer available. Choose from the updated options.” where that is the actual reason | Show the fresh authorized state and available choices. Do not commit preview changes to mana, zones or counters. Preserve useful focus and explain the specific failure. |
| CPU decision | “Opponent is choosing…” | Keep the last accepted state visible. Distinguish a policy failure or unsupported decision from normal thinking; expose a useful diagnostic ID without hidden state. |
| Session recovery | “Practice matches end when this page reloads.” for this release | Do not show “Saved” or promise “Resume” while the product is session only. |

Use short titles, one plain sentence of explanation, a selection count where useful, and a specific button such as “Confirm target.” Keep rules details available on demand. Printed rules text and an explanation should be clearly distinguishable. The explanation must use the current game state and authoritative choices.

The following **future manifest copy** is for after support is admitted:

> **Manifest dread — choose 1 card**  
> Look at these two cards. Put one onto the battlefield face down as a 2/2 creature and the other into your graveyard. Only you can see these choices.  
> **Manifest selected card**

The other card becomes public when it reaches a public graveyard. With one card or no cards, use the actual engine decision/result rather than showing an invented two-card prompt. Do not open this panel when a death trigger merely goes onto the stack: first let players respond, then show a choice only when resolution reaches it.

## Cards, inspection, movement and arrows

- Render current public characteristics, including changes from counters, attachments and effects. A manifest starts as a nameless colorless 2/2 creature with no abilities or mana cost; later modifications can change its displayed power/toughness. Do not label all face-down cards “ward 2.”
- Give each face-down permanent a stable visual marker tied to its instance ID. A marker such as “Face-down creature · A” is an interface label, not a Magic card name. Preserve it through sorting, dragging, animations and turning face up.
- Controller inspection must be private. Opponent DOM, image requests, alt text, tooltips, accessibility labels, logs and animation assets must not contain the hidden face. Inspection is not turning a card face up.
- Present a legal turn-up action as “Turn face up — pay [cost].” The engine completes this special action immediately. Do not animate it as a cast spell, add it to the stack, offer a response before completion, or replay an enters-the-battlefield animation/trigger. Keep the same permanent, counters, tapped state and legal attachments.
- Use arrows to preview selected targets, attackers, blockers and attachments. Distinguish preview arrows from accepted relationships. Show the source, target and text explanation; color alone is insufficient.
- Animate only accepted, authorized events. A preview may move a ghost/highlight, but the actual card changes zones only after acceptance. Use the engine's destination; a replacement effect can send a card to exile instead of the graveyard.
- Respect event ordering and reveal instructions. A returned face-down card needs an authorized reveal before disappearing into a hidden hand. The current runtime fails the tested bounce-reveal case; UI code must not recover the identity by reading privileged state.
- Make animations skippable and support reduced motion. An animation completion callback must never advance rules or submit the next decision. A second click during an animation must not submit the same command twice.

## Shared adapter requirements and current blockers

These are requirements to agree with the integration owner, not existing API promises:

| UI needs | Authority / adapter responsibility | Evidence at the release |
| --- | --- | --- |
| Current visible state keyed by instance | Supply sanitized public characteristics, zone, controller, counters, tapped status, attachments and stack relationships | `projectSeat` drops public face-down stats. The UI must not fill missing current characteristics from printed card data. |
| Private controller inspection | Supply only identities that this viewer may inspect through an explicitly private path | Runtime main-object filtering permits controller inspection; the app projection drops it. Current session inspection accepts known face-up cards only. |
| Decision identity and legal choices | Bind actor, current revision/decision, selection constraints and submissions; reject stale choices | Human manifest choices work through the interaction API in the diagnostic. Rendered controls have not been tested here. |
| Authoritative outcome | Return accepted/rejected status and the new authorized state/events | Illegal turn-up is rejected, but the exported save loses library-knowledge metadata. Resource spending/movement was unchanged in these fixtures. |
| Public reveal event | Supply a safe reveal for a face-down object entering a hidden zone | Unsummon test exposes no identity in the opponent's authorized transition; destruction and face-up exile expose identity in the public destination. |
| CPU completes choices | Policy uses its authorized information and submits a legal choice | Current CPU rejects manifest's SelectCards decision as unsupported. Turning up was not reached in that case. |

**Do not pass raw engine snapshots to components or the CPU.** The raw opponent snapshot contains a manifested card's name in historical metadata even though its main object is redacted. CardStashy's current projection removes those paths. Extend that narrow projection deliberately; do not replace it with a broad state spread to obtain missing fields.

## UI acceptance checks

For each supported flow, test pointer and keyboard operation, focus restoration, tab order, readable labels, narrow/wide layouts, zoom, scrolling and reduced motion. A popup must not obscure the targets needed to complete it. Required decisions must remain discoverable. Unsupported actions should explain what is missing without suggesting they succeeded.

Use the real accepted state to verify card movement, life, mana, stack changes and selection results. A screenshot of a correctly worded popup is presentation evidence only. Record engine assertions, UI recordings, complete matches and recovery checks separately. Manifest remains outside the supported pool until rules, choices, CPU, UI and recovery all pass their required layers.
