# CPU-003-LATENCY-A: repeated block previews dominate tested pauses

Owner: CPU. Starting commit: `142e21de8071a38a52fd5d6444ed47c33a2d05c7`. Scope registered in [issue #50](https://github.com/deathxcore11/Card-forger/issues/50#issuecomment-6399914869) before edits. **Diagnostic implementation PASS; responsiveness remains FAIL readiness.** No production code changed.

The new handoff was reconciled against issue #50. CPU-002 is pushed and acknowledged by integration but is not integrated at the checked branch head `1de3a610848e0c676cfda85d4000f34b93554cf8`. CPU-003 is a separate candidate branch with Easy/Hard disabled. Recovery is **UNSUPPORTED**, superseding any ambiguous CPU report wording of NOT TESTED. Actual browser/signed-in checks remain NOT TESTED.

## Reproduction and evidence

```sh
node experiments/phase-engine/cpu-latency-engine.mjs
```

Run against the existing runtime, Node 24.22.1, Linux x64. Device/browser/viewport: none; this is Node engine/worker evidence. Seed 12345, unchanged runtime `a86578b23adcd26c`; the runtime helper verifies the full WASM/glue/card-database hashes. Exact board specifications, deck card inputs, setup/decision hashes, source hashes and raw timings are in `docs/evidence/cpu-003-latency.json`.

Five engineered positions pass: Ghalta survival; four attackers/four blockers; three/eight; four/twelve; four/twenty. These are creature-board diagnostics, not token-grouping or full-game tests. Input decks obey copy limits; larger blocker pools use several supported creature names. Each case takes three isolated stage samples and nine direct policy samples (three per profile), then exercises the warmed production policy worker through the real authority, revalidates against fresh candidates and submits an accepted action. The Ghalta sample chooses the surviving block. Every pre-submit profiling pass is asserted not to mutate the engine. This is not a browser recovery test.

All numbers below are milliseconds. The last column is the sum of initial legal collection, worker-choice path, fresh legal collection and accepted submit. The evidence's `totalMs` also includes harness state-export/assertion overhead; it is not presented as pure production latency.

| Position | Active-seat engine legal generation | CPU expansion | Previews per authority decision / total time | Max direct policy, all profiles | Summed authority stages |
| --- | ---: | ---: | ---: | ---: | ---: |
| ghalta-survival | 9.7–13.1 | 25.2–38.4 | 0 / 0.0 | 2.42 | 150.8 |
| four-by-four | 12.2–14.2 | 1192.1–1572.0 | 228 / 2190.3 | 15.02 | 2385.8 |
| three-by-eight | 14.7–25.3 | 1032.8–1111.6 | 234 / 1961.5 | 13.27 | 2148.7 |
| four-by-twelve | 23.0–24.8 | 939.2–1005.2 | 228 / 1822.4 | 9.09 | 2030.2 |
| four-by-twenty | 45.7–61.7 | 20.3–22.3 | 0 / 0.0 | 2.87 | 365.0 |

## Finding and limits

1. **Measured bottleneck:** in the four-by-four case, CPU expansion adds 114 candidates after calling the full engine preview for each. The authority/journal pattern collects legal candidates once before choice and again before submission, producing 228 previews in one tested decision. Preview calls account for 2,190.3 ms of the measured production-stage work. Ordinary active-seat legal generation took 12.2–14.2 ms in the separate samples. Larger covered boards show the same repeated-preview pattern. This isolates a cause; it does not prove every historical 5.46-second pause had the same cause.
2. **The worker is not the whole decision:** authority choice also retrieves a new filtered state and legal costs before posting to the policy worker. Changing only policy search depth cannot remove this collection/validation cost. Initial collection and fresh validation are outside the configured planning budgets.
3. **Budget coverage gap, confirmed by code:** `analyzeCpu` ranks all block candidates before using the budgeted hand/attack search. The direct Easy block sample peaked at 15.02 ms despite its configured 12 ms search budget; node accounting for this path is zero. Larger candidate arrays or slow devices require explicit coverage, not a claim that the existing profile limit already bounds all work. The synchronous preview loop cannot be interrupted by a same-thread timer mid-call.
4. **Faster twenty-blocker result is not a success in search coverage:** expansion declines to enumerate when there are more than twelve eligible blockers. It returns the engine's existing suggestions and `truncated: true`; the tested four-by-twenty choice contains one block. It is legal, but these measurements do not establish sufficient survival/search coverage on that board. The 128-combination traversal also truncates smaller large spaces and its enumeration order can omit useful joint blocks.
5. **Diagnostics are still incomplete:** source inspection shows the policy worker folds exceptions into `CPU_DECISION_UNSUPPORTED`, and the authority folds a worker error into `POLICY_FAILED`. Distinct unsupported/technical/budget outcomes and clock charging require the agreed session contract. This task does not change formal timeout outcomes or result records.

The five fixture PASS results mean the instrumentation ran, preserved state before submit and returned accepted actions. They do not close responsiveness, strength ordering, arbitrary-deck support, token equivalence, complete browser matches or recovery. Small-sample wall times are descriptive, not reliable population percentiles. No strength recalibration is claimed because the policy is unchanged.

## Focused follow-up and ownership dependency

Do not remove fresh-state validation or reduce candidates blindly. That could reintroduce the survival bug.

- CPU can own survival-aware candidate ordering, bounded enumeration/scoring, explicit interruption checkpoints and regressions for useful joint blocks appearing beyond the current traversal prefix. Test the twelve-to-thirteen blocker boundary and states requiring several different blocks.
- Integration/SESSION-001 owns the shared authority/journal. Agree a revision-scoped immutable candidate snapshot or equivalent mechanism to avoid rebuilding identical preview results twice. A cache must bind engine instance, epoch, revision, actor and decision; invalidate on every accepted mutation/start/restore, and keep final engine submit validation and stale-command rejection. A board-art or card-name cache key is insufficient. This is a proposal, **not implemented**.
- Rules can advise whether an existing authoritative legality-only or batched validation path is available. The inspected JS runtime exports previews and legal generation; no suitable batch legality-only export was identified. No paid engine rebuild is requested or authorized.
- Session owner must count actual CPU work against the CPU's budget, preserve human-clock ownership, and distinguish unsupported choices, technical failures and timeout outcomes. UI receives truthful busy/accepted state only.

Allowed/changed files are exactly `experiments/phase-engine/cpu-latency-engine.mjs`, this report, and `docs/evidence/cpu-003-latency.json`. No edits to `match-authority.mjs`, journal/session, CPU production policy, UI, projection, asset packaging, runtime, APK or uploaded handoffs. Rollback is dropping this diagnostic commit; it has no production behavior. Deployment/build actions: **NONE**.
