# SESSION-001 turnFlow v1 contract

Owner: integration/Live Push. Integration implementation base: be5ed9490e6df986e55e8088712694da6bc5386b (UI-001, UI-002, CPU-002 combined).

**Contract frozen for implementation; runtime implementation is NOT complete.** This document and its synthetic snapshots do not enable controls or prove engine capability. UI must require the actual runtime field and corresponding capability flag. No UI fallback based on hand contents, mana estimates, visible buttons or filtered choices.

## Wire shape

All fields below are required when turnFlow is present. Missing turnFlow is an unsupported older implementation.

```ts
type Seat = 0 | 1;
type Phase = 'Untap' | 'Upkeep' | 'Draw' | 'PreCombatMain' |
  'BeginCombat' | 'DeclareAttackers' | 'DeclareBlockers' |
  'CombatDamage' | 'EndCombat' | 'PostCombatMain' | 'End' | 'Cleanup';
type FlowReason = 'not-ready' | 'not-human-priority' | 'mandatory-choice' |
  'coverage-unknown' | 'meaningful-action' | 'mana-window' | 'phase-stop' |
  'full-control' | 'pending-draft' | 'busy' | 'cancelled' |
  'auto-pass-ready' | 'terminal' | 'error';
interface TurnFlowV1 {
  version: 1;
  supported: boolean;
  capabilities: {
    smartPass: boolean; fullControl: boolean;
    temporaryYield: boolean; phaseStops: boolean;
  };
  epoch: string | null;
  revision: number | null;
  decisionId: string | null;
  actorSeat: Seat | null;
  activeSeat: Seat | null;
  prioritySeat: Seat | null;
  phase: Phase | null;
  mandatoryChoice: boolean;
  coverage: 'complete' | 'unknown';
  controlMode: 'smart' | 'full';
  temporaryYield: boolean;
  passState: 'idle' | 'queued' | 'submitting';
  stops: Array<{activeSeat: Seat; phase: Phase}>;
  stopActive: boolean;
  reason: FlowReason;
}
```

Phase values must be mapped from the delivered engine deliberately. An unmapped phase becomes null and stops automation; it must not silently map to another step. First/double-strike damage remains an engine decision, not a UI extra phase. UI may display readable labels for enum values.

actorSeat is the currently required actor, including mandatory decisions. prioritySeat is null outside a Priority decision. activeSeat is the turn owner, which may differ from actorSeat. revision and decisionId come from authority. supported means this contract is implemented, not that the current decision has complete legal-action coverage. Capabilities mean the method is implemented; the UI must not set them itself.

No raw actions, opponent private cards, engine saves, policy search, or local draft details occur in turnFlow. The human's ordinary authorized interaction surface remains the route for choices.

## Session methods and lifetime

- setControlMode('smart' | 'full'): changes this match's control mode; switching to full invalidates queued automatic passes and clears temporaryYield.
- yieldUntilAction(): sets temporaryYield true for the current match. It stops/clears on a meaningful legal action, mandatory prompt, configured phase stop, uncertainty, cancellation, terminal state or error. It never overrides Full Control, configured stops or a pending local draft. In Full Control it returns an explicit FULL_CONTROL conflict rather than silently changing modes.
- cancelYield(): clears temporaryYield and invalidates the queued pass generation. Cancelling an in-flight accepted pass cannot undo it; automation must not send the next pass. It also suppresses Smart requeue at the current decision so cancellation remains useful; a manual action or subsequent fresh decision may resume Smart.
- setPhaseStop(activeSeat, phase, enabled): idempotently sets/removes one stop; invalid values reject without mutation. Adding a stop invalidates a conflicting queued pass.

Implementation default: preferences last for **this match only**. A new match resets to Smart, temporaryYield false, and no user stops. This is explicitly an implementation choice, not a previously verified user preference. Do not persist to localStorage/account settings or carry a yield into a rematch. No match IndexedDB, save/resume or result-history implementation is included.

Methods reject when the contract/capability is unsupported; they do not submit game actions themselves. Method calls during a closed/account-retired session reject. UI controls use these methods only; it never sends an automatic pass directly.

## Authority gate and sequencing

A pass requires human Priority, current epoch/revision/decision, a permitted exact engine pass, complete coverage, no meaningful legal action, no pending mandatory choice/draft, no enabled stop, and no error or command in flight. Full Control stops voluntary automation. Mana-only windows remain a stop until separately proved safe; floating mana must be preserved.

Coverage must include casts/abilities/special actions in all permitted zones, full costs, alternate/free costs, targets and timing. A nonempty list proves those offered actions exist; an empty filtered list does not prove completeness. The delivered engine may expose suggestions rather than an exhaustive list. Unknown, truncated or unsupported capability data must fail closed.

The session and authority both guard revision changes. Authority recomputes immediately before mutation under the same serialized journal as manual actions and ticks. Stable command IDs deduplicate retries; unknown transport outcomes are not automatically resent. Cancellation retires unsent queued passes. No artificial animation delay determines priority or consumes another player's response clock.

## Synthetic fixture snapshots

These are UI-development fixtures only, not runtime evidence. The actual old runtime currently has no turnFlow field.

```json
{
  "version": 1,
  "supported": true,
  "capabilities": {"smartPass": true, "fullControl": true, "temporaryYield": true, "phaseStops": true},
  "epoch": "fixture-session",
  "revision": 7,
  "decisionId": "fixture-priority-r7",
  "actorSeat": 0,
  "activeSeat": 1,
  "prioritySeat": 0,
  "phase": "PreCombatMain",
  "mandatoryChoice": false,
  "coverage": "unknown",
  "controlMode": "smart",
  "temporaryYield": false,
  "passState": "idle",
  "stops": [],
  "stopActive": false,
  "reason": "coverage-unknown"
}
```

Variant fixtures: full control changes controlMode to full and reason to full-control. A human blocker prompt sets mandatoryChoice true, prioritySeat null, phase DeclareBlockers, coverage unknown and reason mandatory-choice. An established empty window sets coverage complete and reason auto-pass-ready only after authority evidence supports it; UI must never produce this variant itself.

## Terminal reason and errors

Proposed additive authority field: status.terminal.reason is one of engine-terminal, human-concession, idle-timeout, turn-timeout, unknown. Winner retains its existing semantics. A reason is derived from accepted engine/journal events only. Until implementation lands, an absent reason is unknown.

Technical interruption and unsupported choice are nonterminal error states, never manufactured wins/losses. Restart is not represented as a normal win/loss; unknown restart capability stays unsupported. No user-result persistence, opponent-deck disclosure or duplicate-deck statistics policy is established by this schema.

## Required proof before supported becomes true

Actual engine coverage assessment; false-negative action controls (free/alternate costs, other zones, activated/special actions); mandatory prompts; both-seat phase stops; Full Control/floating mana/own-spell timing; stale queue invalidation; cancel-before-dispatch and cancel-after-accept; duplicate input; same-revision stop latch; session/account retirement. UI fixtures are additional evidence, not substitutes.

Release must test the final combined source, supported full match, result paths and actual zoom. Recovery is UNSUPPORTED; owner sign-in remains a separate verification layer.
