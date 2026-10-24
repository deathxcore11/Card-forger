# Human command route and mechanic follow-up

October 24, 2026. Development from Play checkpoint `10a8b927`. This is not a
mounted Play interface, an adopted engine or a release receipt.

## Implemented

The optional worker accepts a `human` diagnostic mode bound to seat zero. A
whitelisted seat projection supplies own-hand/public instances, public life and
zone counts, current stats/counters/damage, and bounded choice labels. Unknown
hands, future library order, raw abilities/events/saves/RNG and debug projections
are not sent to that client. An explicitly selected opaque epoch/revision-bound
choice goes through the same durable journal as automated actions. The human
seat cannot be advanced by silently calling the automatic policy.

Only the original Forest/Bears proof's basic actions are represented. Searches,
mulligan bottoming, arbitrary targeting, manual/strategic payments, abilities
and other unsupported choices stay unavailable in this narrow surface. AI
candidate generation is nonexhaustive, as the actual Head Games case proves;
this surface must not be generalized into an all-card selector. A general human
choice path needs engine-authoritative constraint/interaction submission.

The journal/client also reject malformed saves, invalid response envelopes,
failed message transmission, stale sessions and changed request contents.
Worker failure during a mutation reports an unknown outcome; recovery uses its
stable request ID rather than a new automatic move.

## Actual checks

- 42 focused tests pass: journal/client failure paths, human-seat projection and
  selection guards, and response-clock contracts.
- The real-browser suite passes the original six complete games with identical
  trace hashes and outcomes, plus a complete scripted human-route game:
  384 accepted actions, terminal turn 22, winner seat 1. That driver's human
  choices include keep, land, cast, attack and priority pass. It does not prove
  a real human could use a UI or cover every choice/control.
- The fresh-process browser test again restores revision 80 Priority with the
  origin server stopped/networking disabled, preserves its receipt and exact
  remaining game, and creates a new offline match.
- The optional actual-WASM mechanic suite reports six passes and one failure.
  Positive checks cover Head Games/search restoration, two/four Soldier tokens,
  Bolt damage, Counterspell response, and finite mana-loop cycles.
- Ninjutsu FAILS the required stack-response assertion. The command deliberately
  exits1 and the failure is retained as an adoption blocker.
- The separate actual-engine clock check retains a 30-second deadline across
  restore, rejects a wrong actor and applies one legal priority pass at expiry.
  Its visible countdown, scheduler, atomic journal integration and complete
  mandatory-choice timeout policy remain unimplemented.

Captured, byte-scoped results:

- [Browser](browser-evidence-2026-10-24-human.json)
- [Mechanics, including failing ninjutsu](mechanics-evidence-2026-10-24.json)
- [Clock/engine](clock-evidence-2026-10-24.json)

The earlier captured report remains historical. New source hashes are recorded
in each follow-up. Local Chromium is 153.0.8010.0, Node 24.22.1. No physical-device,
networked multiplayer, CPU strength, independent rules-oracle or production
package claim follows from these tests. No external runtime/card fixture is
copied into the product.

## Reproduce

Use the exact external inputs described in README and the original/browser
proof. The integration fixture is verified by compressed SHA-256 before an
18-record subset is selected unchanged in memory.

```sh
node --test experiments/phase-engine/test-*.mjs

CARDSTASHY_PHASE_PKG=/absolute/path/to/pkg \
CARDSTASHY_PHASE_SOURCE=/absolute/path/to/phase \
node experiments/phase-engine/mechanics-smoke.mjs

CARDSTASHY_PHASE_PKG=/absolute/path/to/pkg \
CARDSTASHY_PHASE_SOURCE=/absolute/path/to/phase \
node experiments/phase-engine/priority-clock-engine.mjs
```

The mechanics command is currently expected to exit 1 for the documented
ninjutsu response failure. An exit 0 without that requirement passing would not
be a valid improvement. `browser-smoke.mjs` additionally needs Playwright and
Chromium as documented in WORKER-PROOF; it now covers the human mode as well.

## Failures retained

An initial scripted human driver chose repeated Mulligan by a label-length tie
break, eventually attempting a redraw during required bottoming. The driver
now explicitly keeps for its baseline, and a separate regression ensures the
unfinished bottoming decision is unavailable instead of offering a false
redraw. This does not implement the mulligan/bottom UI.

The first clock/engine probe compared complete internal save bytes. The legal
choice getter maintains interaction-slot cache metadata, so byte equality was
inappropriate for that read check. It now compares a hash of game position,
waiting/phase, objects, zones, mana and game RNG; accepted-state mutation
assertions remain. This does not certify every upstream getter as read-only.

No ninjutsu assertion was removed or converted into a pass. Fixing its missing
response window requires an engine correction and a rebuilt/reverified runtime;
a cosmetic delay is insufficient.
