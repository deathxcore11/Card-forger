# CPU-001: released CPU acceptance baseline

Owner: CPU logic. Starting release: `2af11c9a1326e0db75b875d9c122e3dea01055d7` (4.0.0).

Status: baseline audit complete; one reproduced tactical failure needs a coordinated fix. No production implementation, legality, UI, runtime, deployment or workflow changes.

## Task boundary and file ownership

This branch adds only:

- `experiments/phase-engine/cpu-baseline-engine.mjs`: reproducible CPU acceptance diagnostic.
- `docs/evidence/cpu-001-release-audit.json`: captured baseline results and engine-accepted traces.
- `docs/cpu-001-release-audit.md`: this handoff.

The rules workspace was observed with uncommitted changes to `visible-cpu-policy.mjs` and `seat-surface.mjs` for face-down/manifest work. This task therefore leaves both files unchanged. Integration must reconcile ownership before assigning the policy fix. No claim is made that those other changes are merged or verified here.

## Result

| Case | Layer | Result |
| --- | --- | --- |
| A: block a lethal Ghalta attack | CPU proposal + real engine application + alternative branch | FAIL |
| B: attack with unopposed Tapestry Warden | CPU proposal + real engine application | PASS |
| C: cast and resolve Bear Cub | CPU proposal + real engine application | PASS |
| D: attack with unopposed Bear Cub | CPU proposal + real engine application | PASS |
| E: vary hidden opponent hand and both private library orders | real restored positions + projection + CPU proposal | PASS |
| F: resolve forced Ghalta legend choice | CPU proposal + real engine application | PASS |
| G: unsupported choice stops explicitly | synthetic policy contract | PASS |
| H: signed-in full match and recovery | browser | NOT TESTED |

Six passed, one failed, one not tested. The script intentionally exits 1 while any acceptance case fails. Do not relabel this as a green test suite. Case G proves an explicit refusal, not support for the unknown action or user-facing recovery.

The diagnostic verifies the shipped WASM, glue, card database and compressed chunk hashes before execution. No engine rebuild is required. All compiled card definitions are unchanged. Network calls during execution: zero. Initial positions are engineered through the existing saved-state fixture seam; subsequent actions are generated candidates and accepted by the engine. This is not a complete legal-game-history or browser test.

## Reproduce

From a checkout containing the release runtime files, with Node 24:

```sh
CARDSTASHY_CPU_COMMIT=2af11c9a1326e0db75b875d9c122e3dea01055d7 node experiments/phase-engine/cpu-baseline-engine.mjs
```

Output: `test-results/cpu-baseline/report.json`. Optional `CARDSTASHY_CPU_OUTPUT` changes that directory. `CARDSTASHY_CPU_COMMIT` labels the tested implementation; set it to the actual implementation commit for later runs. The report separately captures policy, projection, harness and runtime hashes. This branch's captured report tests unchanged release code. Successive diagnostic runs reproduced case A; the other six executed cases passed. The existing `node --test experiments/phase-engine/test-damage-interaction.mjs` regression also passed all four checks.

## Issue CPU-001-A: declines the only surviving block

- Build: 4.0.0 / `2af11c9a1326e0db75b875d9c122e3dea01055d7`; policy `visible-tactics-v2`.
- Environment: local Node engine diagnostic, no browser or account.
- Cards: attacking Ghalta, Primal Hunger (12/12 trample); CPU controls another untapped Ghalta. CPU life 12; opponent life 20.
- Setup: seed 12345, turn 2, CPU seat 1; fixture decks are 59 Forest plus one Ghalta per seat. Move each Ghalta onto its battlefield through the existing fixture setup and set CPU life to 12.
- Steps: pass to declare attackers; declare seat 0's Ghalta attacking seat 1; pass to declare blockers; offer the engine-generated actions to the released CPU policy; submit its selection; resolve combat.
- Expected: block with Ghalta, trade both creatures, survive at 12 life.
- Actual: CPU selects `DeclareBlockers` with an empty assignment list. The engine accepts it, applies 12 damage, and declares seat 0 the winner.
- Alternative witness: restore the identical blocker decision; submit the engine-generated Ghalta block. Both creatures enter graveyards and CPU remains at 12 life. Every submitted action is recorded as engine accepted.
- Repeated: yes, twice with the same deterministic setup.
- Evidence: case A in the captured JSON includes the initial-state hash, restricted policy packet, selection index, actual terminal state, primary accepted trace and alternative accepted trace. No screenshot: this is engine/policy evidence.

### Cause and fix dependency

The empty block receives score 0. The Ghalta trade receives `12 + 4 - (12 + 12) = -8`, so saving the creature is preferred even though declining the trade loses immediately. `ownLife` is present in the packet but unused by the scoring logic.

A safe fix needs sufficient public combat context to compare damage after candidate blocks. The current packet has battlefield summaries and candidate block pairs, but no complete current-attacker list or attack destinations. Do not infer attackers from tapped creatures: that misses vigilance and includes creatures tapped for other reasons. Do not treat every opposing permanent as attacking or solve this with a universal block bonus.

Integration dependency: establish one owner for `seat-surface.mjs` (public combat projection) and `visible-cpu-policy.mjs` (packet/scoring). Reconcile the rules chat's manifest changes first. Then add a scoped survival-first evaluation using authorized public combat facts; keep the engine as the legality authority and choose only from its candidates. Follow-up fixtures should cover multiple attackers, trample, deathtouch, first/double strike, marked damage and toughness-based damage before claiming broader tactical coverage.

Acceptance for the next CPU task: case A passes without breaking B–G; the worker/authority path also accepts the proposal; integration runs a signed-in complete starter match. Browser behavior and recovery remain separately untested here.

## Privacy and coverage limits

Case E changes the opposing hidden hand from Bear Cub to Ordinary Bear and reverses both private libraries. At the same real blocker decision with at least two candidate actions, the restricted packet, chosen action and policy RNG remain identical. Names, oracle metadata, action object handles and game RNG fields do not occur in that packet. This is a bounded hidden-world equivalence test, not a proof for every game state, revealed-card history, logs or face-down mechanic.

Rat/manifest, arbitrary decks, calibrated difficulty, multiplayer and additional games are outside this task. No changes were made to support them.
