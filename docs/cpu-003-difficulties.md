# CPU-003 difficulty candidates and calibration

Starting commit: CPU-002 `9fb96527b1375243c21e85da977200cd6a8a4353`, after CPU-001 `fe17d371` and release `2af11c9`. Owner: CPU. Status: **implemented candidates; release acceptance incomplete**. Easy and Hard remain unavailable in the app. Live push owns reconciliation and deployment. Nothing here changes the shipped engine, shuffle, draws, mana rules or card legality.

## Behavior implemented

All profiles use the same authorized observation, legal candidate set, engine validation and survival ordering. They pass the obvious Ghalta survival fixture without inspecting its name. Actual public attackers/destinations, effective characteristics, legal block relationships and marked damage come from the engine. No inference from tapped creatures. Supported no-response combat predictions remain conditional; uncertain effects are not labeled guaranteed.

The worker receives public battlefield facts and sanitized own-hand characteristics, never opponent hand identities, libraries, private saves or game RNG. Private-world substitution and poisoned-getter tests cover that boundary. CPU RNG is separate; the new policy does not inject random bad moves. A tested information boundary is evidence for these paths, not a universal proof about every future card or application path.

| Profile | Own-hand sequence depth | Search nodes | Public reply candidates | Cooperative search time |
| --- | ---: | ---: | ---: | ---: |
| Easy | 1 | 24 | 4 | 12 ms |
| Medium | 2 | 128 | 24 | 30 ms |
| Hard | 3 | 512 | 128 | 60 ms |

Mana development and engine-authorized affordable plays remain available. Medium searches short creature sequences and uses supported deck role hints. Hard searches deeper, samples more plausible public blocks and estimates exposure to a counterattack. A known own-power cost reduction is recognized structurally, with the colored-cost floor preserved. Hypothetical responses are estimates, never engine-authorized opponent actions. Search uses a node and time budget, retains the best evaluated candidate, and falls back to an offered legal candidate. The time limit is cooperative, not a hard end-to-end deadline; measured overruns are reported below.

`green-creatures-v1` binds a playbook to the exact normalized own deck, including zones and multiplicities. Optional builder proposals must match that version, deck key and present dependencies. The current implementation supplies conservative role hints; it does not execute arbitrary builder advice. There is no universal combo solver. Current sequencing covers the supported green creature pool and conservatively counts Forests plus unrestricted floating green mana. Other legal plays can use the existing fallback. Precise removal/protection timing, broader interaction sequences, disruption recovery and diverse deck archetypes remain **UNSUPPORTED by this planner**.

Calibration uncovered a real mandatory `DiscardToHandSize` stall. The policy now selects engine-authored own-hand `SelectCards` candidates for that exact decision, preserving valuable creatures over excess lands in the tested position. This does not claim support for every other `SelectCards`/manifest decision; unsupported decisions still stop explicitly instead of inventing actions.

## Reproducible evidence

Run from the repository root with Node 24 and the existing shipped runtime. Runtime/WASM/glue/card hashes are verified by the engine harness; no build or network is used.

```sh
node --test experiments/phase-engine/test-cpu-difficulties.mjs experiments/phase-engine/test-cpu-public-observation.mjs experiments/phase-engine/test-damage-interaction.mjs
node experiments/phase-engine/cpu-baseline-engine.mjs
node experiments/phase-engine/cpu-survival-engine.mjs
node experiments/phase-engine/cpu-discard-engine.mjs
node experiments/phase-engine/cpu-calibration-engine.mjs
```

| Layer | Result | Scope |
| --- | --- | --- |
| Unit/privacy/configuration | **19 PASS** | Hidden substitutions across all profiles; unread hidden getters; legal candidates; sequence depth; discounts; budget/fallback; playbook binding; labels gated; damage interface |
| Permanent CPU-001 baseline | **7 PASS, 1 NOT TESTED** | Includes Ghalta regression; preserves the original audit's historical failure evidence |
| Real-engine combat | **16 PASS**, each with all three workers (**48 profile checks**) | Multi-attacker/joint blocks, trample, first/double strike, deathtouch, marked damage, bad chumps, flying, toughness damage, vigilance, indestructible, confidence downgrades |
| Real-engine mandatory discard | **6 PASS** | One/two discards across all profiles; production worker and authority; seven cards remain |
| Full engine matches | **16 COMPLETE**, 6,842 applied decisions, **0 errors, 0 limits/stalls** | Identical decks and seeds, policies swap seats; varied supported creature pools separately |
| Difficulty strength ordering | **NOT ESTABLISHED** | Samples are small and mixed |
| End-to-end responsiveness | **FAIL release readiness** | Outliers and legal-action collection pauses remain |
| Signed-in full app match; browser/mobile; reload/crash recovery | **NOT TESTED** | Engine matches do not prove these layers |

Combat fixtures compare supported-model life and nonterminal creature casualties with real engine resolution, and assert candidate previews do not mutate the engine. Conditional/uncertain predictions remain labeled. Production workers are exercised through `createMatchAuthority`; full-match calibration calls the same policy directly, so its timing excludes worker round trips, rendering and app journal work.

Evidence: `docs/evidence/cpu-003-{units,baseline,survival,discard,calibration}.json`. The survival report retains its CPU-002 scenario task identifier and now records all three profile checks. Calibration records deck/source/trace hashes, final results, recent applied actions, decision kinds and latency. Execution used five sequential games followed by three shards of the remaining eleven; production-source hashes match across all batches. The only calibration-driver change between batches added offset/shard arguments. Test-only assertion changes are separately hashed. The default command reproduces the full sixteen-game plan. Wall-clock stopping can change choices on a differently loaded machine; equal seeds alone do not eliminate that variation.

## Calibration results

The starter comparisons use seeds 12345 and 98765, with policy seats swapped for each. The first player stays seat 0. Small/large variants use seed 31415 and swap seats. Each game's two decks are identical. Variants are still the supported green creature pool, not broad metagame coverage.

| Deck | Pair | Results |
| --- | --- | --- |
| Starter | Easy / Medium | Easy 3, Medium 1 |
| Starter | Medium / Hard | Medium 2, Hard 2 |
| Starter | Easy / Hard | Easy 2, Hard 2 |
| Small-creature variant | Medium / Hard | Medium 0, Hard 2 |
| Large-creature variant | Medium / Hard | Medium 2, Hard 0 |

These samples do **not** validate Easy < Medium < Hard. No win-rate strength claim is made. Deeper sequence fixtures prove different search behavior, not superior overall play.

Per-game policy p95 ranged 0.38–1.53 ms; worst policy decision was **113.73 ms**. Cooperative budget exhaustion occurred 108 times. Engine legal-action collection plus block expansion peaked at **5,461.63 ms**. These are host wall times, with some games running concurrently; the harness does not isolate legal generation from preview validation or attribute each outlier to a specific function. Neither the 60 ms Hard budget nor a low p95 proves bounded total response time. Profiling and a responsive collection/worker strategy are required before release acceptance.

## Ownership and integration contract

`seat-surface.mjs` and `visible-cpu-policy.mjs` remain byte-identical to release. No UI, engine, asset manifest or service-worker edits are included. CPU owns the new modules and tests; Live push must reconcile the two small shared adapters rather than overwrite concurrent changes:

- `match-authority.mjs`: optional difficulty, exact own-deck playbook, authorized own hand/cost input to worker. Existing engine revalidation remains authoritative.
- `practice-authority.mjs`: forwards difficulty and optional `practiceCpuPlan` proposals; bumps journal policy version to reject stale policy records. Keeps the existing Medium-only admission gate. Recovery itself remains untested.
- Add CPU-002 runtime modules plus `cpu-difficulty-config.mjs`, `cpu-hand-observation.mjs`, `cpu-playbook.mjs`, and `cpu-tactical-planning.mjs` to asset allowlist/service-worker packaging. Test harness modules are not runtime assets.
- UI owns thinking/choice presentation and eventual labels. It must consume the authority and must not implement another combat evaluator. Player assistance remains separate.

| ID | Owner / starting point | Acceptance and next dependency | Status |
| --- | --- | --- | --- |
| CPU-002 | CPU / CPU-001 | Survival regression and combat evidence; shared adapter reconciliation by Live push | **PASS in tested engine paths; integration pending** |
| CPU-003 | CPU / CPU-002 | Three bounded candidate policies, fair observation, tactical evidence and paired measurements | **Candidate implementation PASS; release gate CLOSED** |
| CPU-003-LATENCY | CPU + rules/Live push | Isolate engine enumeration/preview cost; bound responsive end-to-end decisions without skipping necessary survival lines | **FAIL readiness; open dependency** |
| CPU-003-STRENGTH | CPU | Improve/calibrate across more paired seeds and supported plans before asserting ordered strength | **NOT ESTABLISHED** |
| CPU-003-APP | Live push + UI | Reconcile shared adapters, package assets, complete signed-in match and recovery checks | **NOT TESTED** |

The intended follow-up must preserve all survival/fairness fixtures. Do not enable Easy/Hard merely because configuration names exist. Do not deploy this CPU branch directly.
