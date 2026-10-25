# Smart priority: engine and UI agreement

Requested by the user while the UI chat builds the tabletop. Based on release `2af11c9a1326e0db75b875d9c122e3dea01055d7`. **Design contract; NOT IMPLEMENTED or TESTED by this branch.** It complements the [UI handoff](gameplay-ui-handoff-20261025.md) and [executed manifest audit](gameplay-rules-manifest-audit-20261025.md). Do not count these proposed cases in that audit's 14 PASS / 10 FAIL.

Aim: routine priority passes should take no clicks, while every decision the player wants or must make remains reachable. The UI may be fast and attractive; accepted game state remains authoritative.

## Corrections needed before implementing the proposal

1. **Do not sum “maximum possible mana” in the UI.** Costs depend on colors, restrictions, mutually exclusive source uses, sacrifices, life, alternate/additional costs, timing, targets and other resources. Tapped out does not prove there is no legal action. Ask an authoritative, side-effect-free availability check; never tap sources as part of checking.
2. **Do not equate “no instant” with “nothing to do.”** Consider permitted actions from every zone and special actions, including turning a manifested creature face up. Not every playable spell needs a target; target validity comes from the engine. Required choices can arise during the opponent's turn even with no blockers or mana.
3. **Do not discard mana abilities indiscriminately.** A player may deliberately want to float mana, sacrifice a resource or use an ability with another consequence. A convenience policy may suppress certified routine mana-only pauses under an explicit user preference; Full Control and stops must retain them. Unclassified actions pause.
4. **Do not hard-code “11 priority steps.”** Use the actual turn/step and priority state from the engine. Untap and ordinary cleanup do not offer normal priority; special cleanup circumstances and additional steps can create different windows. A stop requests the next applicable priority window, not a pause inside the resolution of a spell.
5. **Passing after your own spell is a convenience setting.** The player normally regains priority after casting/activating with priority. “Yield after my own action” must be an explicit policy with a Hold priority override before committing that action. A 400 ms animation is not a reliable time window for changing that choice.
6. **Do not identify legal blocks from “untapped creature” alone.** Use engine-authored legal assignments and requirements. Combat choices and resolution choices are not generic PassPriority actions.

This document describes a CardStashy design. The user's Arena comparison is inspiration; internal Arena algorithm, timing and exact current shortcuts have not been verified here.

## Authority → controller → presentation

The shared-adapter owner should agree a sanitized decision descriptor with the UI owner. These are proposed semantics, not fields already available in 4.0.0:

- Current match/epoch, accepted revision, acting seat, decision identity, phase/step and priority holder.
- The exact engine-authorized pass choice/token, when one exists.
- Non-pass availability as **available / none / unknown**, including whether the candidate space is complete for the supported mechanics. A truncated or unsupported choice list is unknown, never none.
- A required-decision descriptor for targets, payments, modes, ordering, optional decisions, blockers, replacement choices and other prompts. Include selection constraints and authorized display information.
- A safe category for actions whose routine mana-only pause may be suppressed. This needs evidence; unknown activations remain available actions.
- An availability explanation suitable for the current viewer. No opponent hidden cards, ordered libraries or raw engine metadata.

Keep user preferences separate: Full Control, phase/step stops (including whose turn), yield-after-own-action, and a clearly scoped pass-until option. Share preference changes with the authority/command coordinator using a generation counter so a delayed auto-pass cannot override a newly set stop.

Initial conservative decision logic:

```text
If not this player's Priority decision: do not auto-submit PassPriority.
If a required decision, unresolved error, unknown mutation outcome,
unsupported availability or in-flight command exists: pause.
If Full Control, Hold priority, or a matching stop applies: pause.
If no current legal PassPriority choice exists: pause.
If a validated explicit yield policy applies: propose that current pass.
Otherwise, auto-pass only when authoritative availability is complete
and there are no retained non-pass actions under the user's policy.
Before committing, recheck actor, decision, revision, preferences and legality.
Submit once through the ordinary journal; process the accepted result.
```

“Unknown” must be visible as an unsupported/required decision when appropriate; it must not silently spin. Do not bypass a required choice because a CPU or UI adapter cannot represent it. No-auto-action is the fallback until the supported case is proven.

The first implementation should preserve a player's own main-phase decision point. “No spells” does not authorize skipping land plays, attackers, activations, or other actions. Highlighting a context button is separate from automatically ending a turn. A pass-until option is a series of revalidated passes, not a jump to a future phase; stop for the scope's interrupt conditions and all required choices. Define “until next response,” “until end of turn” and “yield this stack” separately if they are offered.

## Existing integration points and ownership

- `match-session.mjs` serializes commands and drives CPU steps. Its clock callback and any new smart-pass coordinator must share one command gate. Do not add an independent animation callback that submits passes.
- `priority-scheduler.mjs` / `priority-clock.mjs` implement a timed response policy. Smart auto-pass is a separate convenience policy; do not simulate it by forcing the timeout deadline to expire. Full Control and stops override convenience passing; any actual match clock follows its separately stated timeout policy.
- `worker-journal.mjs` already checks revisions and keeps command receipts. Reuse its command/revalidation model and preserve duplicate handling. It does not currently promise the proposed preference-generation or availability descriptor.
- Current human steps use the authorized choice-token / interaction routes. `COMMIT_ACTION(PASS_PRIORITY, revision)` is conceptual notation, not a drop-in existing message: the current protocol rejects unknown operations/fields.
- `get_legal_actions_for_viewer_js` supplies candidates, but this audit does not establish exhaustive affordability coverage for all mechanics. Unknown completeness cannot authorize auto-pass.
- Keep `projectSeat` / `projectInteraction` as explicit authorization boundaries. The manifest audit found a hidden-identity leak in raw snapshot history; do not forward raw snapshots to obtain extra UI fields.

Integration assigns shared adapter/session/journal ownership before edits. UI owns rendering and local drafts; rules owns legality and authoritative availability; CPU owns choices for its seat. No paid engine build, deployment or production implementation is part of this contract branch.

## Visual and input behavior

| UI element | Correct meaning |
| --- | --- |
| Glowing playable card | Current authorized action is available; refresh on every relevant accepted revision. A spell announcement that still needs targets/payment should lead into those decisions. Do not imply that it has already been fully paid or resolved. |
| Priority button | “Pass priority” or “Continue,” with “To combat” only as the intended destination. Other players may respond before reaching it. |
| Stack button | “Pass — allow resolution,” or “Resolve” with a clear passing sublabel. One player's click does not force the whole stack to resolve. Use the actual stack count. |
| Combat button | Confirm legal selected attackers/blockers. Offer “All attack” only if the resulting assignment is legal. “No blocks” cannot bypass a blocking requirement. |
| Mana/target prompt | Labels reflect the specific decision. Show AUTO only for an available engine payment path. CANCEL only when the engine supports that cancellation; clearing a draft is different. |
| Full Control | Visible persistent state plus an accessible toggle. If a keyboard shortcut is added, handle focus and key release/blur without a stuck mode. Offer Hold priority before sending your own action. |
| Phase stop | Clearly show whose turn, which actual priority window, and whether it is one-shot or persistent. A stop cannot interrupt a resolving spell or create priority during untap. |
| CPU spotlight | Replay only authorized accepted events, with source/target arrows and current destinations. 400 ms is an adjustable presentation target, not a rules guarantee. |
| Turn banner | Non-blocking, readable, with reduced-motion behavior. It never submits an action or consumes a player's response window. |
| Event log | Causal accepted outcomes, including rejection/error feedback separately. Hidden choices never appear in names, tooltips, artwork URLs, alt text or log payloads. |

Keep one ordered presentation queue keyed by accepted revision/event identity. A current human decision takes precedence over cosmetic playback. Never show actionable stale targets while the authority has already advanced. Freeze/cancel any uncommitted pass proposal when a stop or Full Control arrives; an already committed pass cannot be undone by an animation. Avoid tying interaction deadlines or command completion to animation end. Bound automatic command bursts and yield to the event loop; report a stalled/unsupported state rather than looping forever.

## Proposed acceptance tasks — all NOT TESTED

Each task must record commit, fixture/starting state, exact controls/actions, expected/actual result and assertion or recording. Integration should allocate one bounded implementation task before broadening scope.

| ID | Fixture / action | Expected |
| --- | --- | --- |
| PRIORITY-001 | Opponent turn, no retained legal action; repeatedly advance accepted revisions | Zero convenience prompts; every pass uses current actor/revision and obeys ordinary priority. |
| PRIORITY-002 | Untapped mana supports an instant; repeat with wrong colors and restricted mana | Pause exactly when availability is proven; no source is consumed while checking. |
| PRIORITY-003 | No floating mana; test an alternate/free cost, legal ability from another zone, and legal manifest turn-up | Do not skip a retained legal action. Unsupported mechanics report unknown and remain outside the admitted pool. |
| PRIORITY-004 | Mana ability with deliberate/consequential use; set Full Control or a stop | Preserve access to the action; do not classify by “produces mana” text alone. |
| PRIORITY-005 | Set upkeep/end-step stop; repeat across extra steps and exceptional cleanup priority | Pause at the actual applicable window, preserving documented one-shot/persistent semantics. |
| PRIORITY-006 | Cast a spell with Hold priority enabled, then with yield-after-own-action enabled | Hold preserves a chance to act; yield submits a legal pass without skipping the opponent's opportunity. |
| PRIORITY-007 | During opponent turn, create target, modal, sacrifice, ordering and private selection decisions | Each required decision remains reachable; no generic pass or invented default selection. |
| PRIORITY-008 | Legal, prohibited and required block assignments | Correct choices and primary labels; no illegal automatic “no blocks.” |
| PRIORITY-009 | Add a stop/toggle Full Control while an animation and auto-pass proposal are pending | Proposal invalidates before commit; no duplicate command or late stale pass. |
| PRIORITY-010 | Duplicate submission, out-of-order status, lost response and terminal state | Exactly-once accepted transition; stale data never rewinds the view or manufactures a result. |
| PRIORITY-011 | Reduced motion, fast repeated clicks, keyboard-only operation and narrow viewport | Same legal outcomes; readable choices and arrows with text equivalents; no animation-driven rules. |
| PRIORITY-012 | Save/reload with a pending proposal and stop preferences | Same decision and preferences with no replayed pass; currently blocked by session-only product recovery. |
| PRIORITY-013 | Modify only opponent hidden cards under the same public state and seed | Availability/auto-pass decisions for this player do not inspect hidden identities; packet/log audit accompanies the behavioral assertion. |
| PRIORITY-014 | Player's main phase with a land play, attacker, or activation available | No automatic end-turn based merely on an empty castable-spell list. |
| PRIORITY-015 | Long automatic sequence or repeated triggers | Bounded work, responsive UI, documented unsupported/loop outcome; no hang or fabricated rules resolution. |

Rules basis: Wizards' [Comprehensive Rules effective September 25, 2026](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt), especially 116–117, 500–514, 601–605 and 701.40. See the [current rules landing page](https://magic.wizards.com/en/rules) for subsequent updates. The performance target (“sub-millisecond”) needs measurement on the supported card pool and devices; no benchmark is claimed here.
