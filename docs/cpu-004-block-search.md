# CPU-004: bounded joint-block search and scoring

Owner: CPU. Starting full commit: `3c7a1860a314d9e56d056b017fb82781c4ca6dfc`. Branch: `codex/cpu-004-block-search-20261025`. Scope reserved before edits in [issue #50](https://github.com/deathxcore11/Card-forger/issues/50#issuecomment-6400468068), after checking integration `d81a0a14f3f34cf64fc0156abf495fab590263b6` and its candidate-cache implementation `4bd9801c0b5593288c9c29b76cc447ce47781f75`.

## Before and after

Previously CPU candidate expansion enumerated a depth-first prefix and previewed as many as 114–117 additions, then abandoned extra search entirely above twelve eligible blockers. Blocking policy evaluated every offered assignment before checking its configured planning budget. Integration has separately fixed duplicate expansion through its revision-bound candidate cache; this patch preserves that ownership and does not edit its authority or journal.

The new public-state planner constructs broad joint-block candidates first. Augmenting paths preserve scarce legal relationships, so a flexible blocker can be reassigned to leave the only flying blocker available. Several deterministic blocker preferences cover different trade/trample shapes; local pruning removes unnecessary sacrifices. Small graphs also get bounded alternative enumeration. Candidates are ranked by the existing conditional survival/outcome model before expensive previews. There is no Ghalta name check, unconditional block reward, extra draw, mana alteration or hidden-card lookahead.

Only up to four added candidates are engine-previewed, and only accepted previews enter the offered action set. Original engine suggestions remain available. Final engine submission and integration's fresh-state membership checks remain intact. Preview results other than acceptance are discarded. Supported no-response predictions retain their conditional meaning; unknown effects and multi-block allocation remain estimates.

The planner no longer has a twelve-blocker cutoff. Explicit graph limits are 512 public objects, 64 attackers and 4,096 legal block edges; beyond those, it retains authoritative suggestions and reports truncation. Within those limits, search stops at 2,048 work nodes, 96 model evaluations, a cooperative 20 ms search budget, or a supplied cancellation callback. Session cancellation wiring remains an integration dependency. Candidate collection checks a cooperative 120 ms total budget before each preview. A synchronous engine call cannot be interrupted halfway; its time can overrun that threshold. Complex multi-block capacities continue to rely on original engine suggestions, not invented permissions.

Blocking policy now counts each evaluated candidate against the same node/time/cancellation budget used by the chosen difficulty. It examines broad assignments and the empty block early, keeps the best evaluated legal candidate, and returns an offered deterministic fallback if interrupted before evaluation. It does not label that fallback a proven survival line. Candidate ordering and one evaluator call are indivisible operations, so these limits are not a hard browser responsiveness SLA. `CPU_CONFIGURATION_VERSION` is now `cpu-config-v2`; Easy/Hard remain gated.

## Verification

- **PASS: 31 unit/privacy/configuration checks.** Includes twelve new block-search tests: 12/13/20 blockers, scarce legal edges, safe nonblock, uncertain effects, node/time/cancellation stops, rejected previews, slow synchronous preview cutoff, survival beyond hundreds of single-block suggestions, expired-budget legal fallback and invalid input. Existing hidden-world substitutions, Ghalta, damage and difficulty-depth fixtures remain passing.
- **PASS: 16 existing real-engine combat scenarios across all three profiles (48 worker checks).** Includes first/double strike, trample, deathtouch, marked damage, vigilance, flying, bad chumps and uncertainty cases. Unchanged compiled runtime, actual accepted actions.
- **PASS: five new real-engine positions, each across all three production workers (15 profile checks).** Four-by-four; 12 eligible blockers; 13 eligible blockers; 20 eligible blockers; twenty creatures with only four legal flying blockers. All preserve the tested CPU life through combat. The 13/20 boundaries assert the number of *eligible blockers*, not just creatures displayed on the board.
- **PASS: exact integration-cache compatibility in those five positions.** The isolated authority file is byte-identical to integration `4bd9801`; SHA-256 `e4b9de791e74b0cab1d606c68579d31373f6799519e6dc311e06b6cf38a2b5f5`. Repeated collection with the same epoch/revision does not repeat previews; selected actions remain present and engine-accepted. This validates the block path, not a completed merge of all CPU-003 adapter changes.
- **PASS: permanent CPU-001 baseline, 7 PASS / 1 NOT TESTED.** Original failing audit remains historical evidence.

Real-engine comparison, one before/after sample per position on this host:

| Position | Before previews | After previews | Before expansion | After expansion |
| --- | ---: | ---: | ---: | ---: |
| Four attackers / four eligible blockers | 114 | 4 | 2,073 ms | 132 ms |
| Twelve eligible blockers | 114 | 4 | 1,791 ms | 108 ms |
| Thirteen eligible blockers | 0; extra search skipped | 4 | 21 ms | 60 ms |
| Twenty eligible blockers | 0; extra search skipped | 4 | 23 ms | 89 ms |
| Twenty creatures / four flying blockers | 114 | 4 | 1,067 ms | 52 ms |

The zero-preview baseline on larger boards is a coverage failure, not a desirable speed target. The 132 ms sample demonstrates the synchronous-call overrun caveat. Exact authority stages including the production worker and accepted submit took approximately 186–434 ms in these samples. Timings are host observations under variable load, not guaranteed population percentiles. The reliable result is the reduced preview count plus tested surviving joint blocks.

## Full-match regression and cache-unit compatibility

**PASS: 16 complete engine matches, 7,047 accepted decisions, zero errors or decision-limit stalls.** Identical decks, paired seeds with policy seats swapped; starter seeds 12345/98765 and separate small/large supported creature pools at seed 31415. Four concurrent shards were used. Policy source hashes match the final files. This is direct-policy/real-engine match evidence; worker and cache paths are separately exercised by the tactical fixtures.

| Pool | Pair | Wins |
| --- | --- | --- |
| Starter | Easy / Medium | 2 / 2 |
| Starter | Medium / Hard | 3 / 1 |
| Starter | Easy / Hard | 2 / 2 |
| Small creature pool | Medium / Hard | 0 / 2 |
| Large creature pool | Medium / Hard | 2 / 0 |

Strength ordering remains **NOT ESTABLISHED**. These samples cannot justify enabling Easy/Hard. No automatic rating or builder-weight changes follow from them.

Per-game policy p95 ranged 0.26–1.22 ms; maximum policy wall time was 67.19 ms. Cooperative search budgets were exhausted 107 times without a stalled decision. Combined legal-action collection/expansion peaked at 2,892.54 ms under concurrent load. This remains an end-to-end responsiveness concern; targeted preview-count reductions do not certify a latency SLA. Source-identical seeded choices can still vary if wall-time budgets stop at different points on a loaded host.

**PASS: isolated stage-profile match**, same starter seed 12345 and Medium/Easy seat assignment as the largest concurrent outlier: turn 12, 239 decisions, no error/stall. Maximum policy time 6.79 ms; maximum collection 663.22 ms. The slowest recorded collection was turn 5 Priority: 630.17 ms inside `get_legal_actions_for_viewer_js`, followed by 32.27 ms in the non-block CPU path, with **zero previews**. This isolates the remaining dominant cost in that run to the engine legal-action call. It does not prove the earlier concurrent 2.89-second event had precisely the same cause or that this host was otherwise idle. Rules/integration must investigate that engine path without weakening capability checks or triggering an unapproved runtime build. Reproduce with `node experiments/phase-engine/cpu-stage-match-engine.mjs 1 0 16`; raw per-decision stages are in `docs/evidence/cpu-004-stage.json`.

**PASS: six integration cache/journal assertions** in an isolated directory using integration's exact authority and journal. The original mock exposes only waiting-for data, so it must be enriched with public players/battlefield/actual attackers for survival-aware generation. `docs/evidence/cpu-004-cache-fixture.patch` supplies that fixture-only change for the owning integration chat; it leaves every assertion intact. The production files are not modified by this patch. Checks cover cloned results, revision/epoch changes, actor/decision/base changes, all accepted/rejected/thrown mutation routes, authority isolation and stale worker proposals. The original minimal mock is incompatible with the new observation requirements; apply the supplied fixture patch when integrating.

## Reproduction

```sh
node --test experiments/phase-engine/test-cpu-block-search.mjs experiments/phase-engine/test-cpu-difficulties.mjs experiments/phase-engine/test-cpu-public-observation.mjs experiments/phase-engine/test-damage-interaction.mjs
node experiments/phase-engine/cpu-survival-engine.mjs
node experiments/phase-engine/cpu-baseline-engine.mjs
node experiments/phase-engine/cpu-block-search-engine.mjs
node experiments/phase-engine/cpu-calibration-engine.mjs
```

The block harness reads the old candidate source from the pinned baseline using `git show`. `CPU_BASELINE_CANDIDATES` optionally supplies an exact local copy; the captured hash is verified against CPU-003 evidence. `CPU_AUTHORITY_MODULE` optionally selects an isolated integration authority module with its normal dependencies available. Set `CPU_REQUIRE_CANDIDATE_CACHE=1` to assert same-revision reuse. The recorded run used the exact integration authority above; a default run on this CPU-only branch retains the older uncached authority and does not certify cache reuse.

Node 24.22.1, Linux x64; engineered fixture seed 12345; hash-verified shipped runtime `a86578b23adcd26c`. Browser/device viewport: none. Evidence is in `docs/evidence/cpu-004-{units,survival,engine,baseline,calibration}.json`. Engine snapshots are test setup only, never worker observations. The production worker receives the same authorized public/own-hand packet as before.

## Integration, limits and rollback

Changed production files: `cpu-legal-candidates.mjs`, new `cpu-block-search.mjs`, `cpu-public-policy.mjs`, `cpu-tactical-planning.mjs`, `cpu-difficulty-config.mjs`. New dedicated tests/harness and this report/evidence are CPU-owned. No edits to seat-surface, legacy policy, shared authority/journal/session, UI, runtime, APK or release metadata.

This branch is stacked on CPU-003. Integration must reconcile CPU-003's optional difficulty/own-hand/playbook adapter wiring with its newer authority cache; do not overwrite `match-authority.mjs` from the older CPU branch. Keep the integration-owned `worker-journal.mjs` revision context and invalidation tests. Add `cpu-block-search.mjs` plus the pending CPU-003 runtime modules to asset/cache packaging. Configuration-version change must accompany the policy modules. A production rollback should revert the matched policy/configuration/modules together, not retain a mismatched cached module graph.

No claim of optimal combat, exhaustive assignment coverage, reliable difficulty strength ordering, arbitrary-deck support or full browser responsiveness. Technical/unsupported error classification, formal CPU clock charging and richer session outcomes remain separate session/CPU dependencies. Actual signed-in combined match with this patch is **NOT TESTED**; recovery is **UNSUPPORTED**. Existing integration browser evidence predates this patch and is not reused as its acceptance result. No deployment, paid engine build or APK change.
