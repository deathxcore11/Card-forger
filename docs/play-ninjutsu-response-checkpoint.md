# Ninjutsu response proof checkpoint

October 25, 2026 UTC. Started from verified Play head
`d52fdcb0912ef320e6c6ccdd736cf891cc590055`; the complete tree contains no
AGENTS.md. All 29 experiment modules were retrieved at that exact commit and
verified against their Git blob identities in a new isolated directory.

## Implemented and executed

Added `ninjutsu-response-engine.mjs`, an optional actual-WASM proof using 21
unchanged integration-fixture records, including Stifle. The input loader can
now take an explicit, unique, bounded research subset; the default 20-card
subset and all source/receipt/runtime/fixture checks remain unchanged.

The positive control pays for Basalt Monolith's untap ability using three real
Islands. The opponent gets priority and casts Stifle with its own Island,
targeting the ability's stack-entry ID. It counters the untap without refunding
costs. A fresh Node process restores the saved two-entry stack and reproduces
both the accepted response suffix and final signature with zero fetches.

Printed ninjutsu and Satoru-granted ninjutsu have separate required checks for
Stifle responses, retained paid costs, no creature entry or combat damage,
retirement of the temporary reveal, and fresh-process recovery. On the original
runtime, both stop at the missing stack window. Their later assertions have
**not executed successfully** and are not certified.

Executed against the original hash-verified upstream runtime:

- 86 Node guards pass, zero failed/skipped/cancelled.
- Existing mechanics suite: six passes, two preserved ninjutsu failures; exit 1.
  `mechanics-smoke.mjs` and `mechanics-fixtures.mjs` were not edited.
- New response suite: Stifle/Basalt control including fresh-process restoration
  passes; printed and granted ninjutsu fail the required stack assertion;
  exit 1. The initial version verified the control before its fresh-process
  extension; the final captured run includes that extension.
- Both changed/new modules pass `node --check`. Captured report source hashes
  match the final local files exactly.

Evidence:

- [Preserved original mechanics](../experiments/phase-engine/mechanics-baseline-evidence-2026-10-25.json)
- [New response checks on original runtime](../experiments/phase-engine/ninjutsu-response-evidence-2026-10-25-original.json)

These are engineered initial positions, not complete legal game histories.
Node restart is not browser cold-offline evidence or journal idempotency.
No card data, runtime binary, or raw game save is committed.

## Approved remote attempt

After the owner showed an Actions budget of $5 and instructed continuation,
retried only the failed proof job in run
[40150756588](https://github.com/deathxcore11/Card-forger/actions/runs/40150756588).
Attempt 2, job `121043947174`, started 2026-10-25T01:40:24Z on
`macos-15-intel`. Checkout and Node setup passed; the proof stage was still
running at this checkpoint. This clears the prior runner-allocation block;
it is not a successful compile or test result. No other failed workflows were
re-run and no billing settings were changed by the assistant.

That job builds the exact approved `f1021d3` snapshot and runs its existing
86 guards/eight mechanics cases. It does not contain this new response driver.
If it produces a valid runtime, independently verify the downloaded artifact,
reconstruct its exact source commit, and run the new response driver against
its receipt before making a new claim. Do not launch a competing paid build.

Reproduction uses the existing input environment from the experiment README:

```sh
node --test --test-reporter=tap experiments/phase-engine/test-*.mjs
node experiments/phase-engine/mechanics-smoke.mjs
node experiments/phase-engine/ninjutsu-response-engine.mjs
```

Set `CARDSTASHY_PHASE_PKG` and `CARDSTASHY_PHASE_SOURCE` to exact verified
inputs. For a corrected runtime also set `CARDSTASHY_PHASE_BUILD_RECEIPT`;
there is no hash-bypass flag. `CARDSTASHY_PHASE_RESPONSE_OUTPUT` controls the
ignored report/snapshot directory. Both runtime suites intentionally exit
nonzero on the original binary.

The candidate engine is still unadopted. The next product gate remains a
complete private human-versus-CPU match with legal choices, bounded fair CPU,
board/inspector/countdown and recovery/results. Setup aesthetics do not close
those gates. Nothing is published, deployed, merged into the website release,
or added to the APK.
