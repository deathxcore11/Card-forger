# CPU-005: three-policy beta enablement handoff

Owner CPU. Start `ee77800dc2e19e1e1d39cad387f16e07b44be704` (CPU-004). Branch `codex/cpu-005-beta-ready-20261025`. Integration baseline inspected: `d81a0a14f3f34cf64fc0156abf495fab590263b6`.

The owner has directed us to finish a usable three-level beta so UI can enable the actual policies, with later bug-fix patches allowed. The CPU implementation is marked ready for that **limited-deck, experimental beta** (`CPU_LABELS_READY=true`, `cpu-config-v3`). This does not mean the current site has enabled the tiers, that Hard has a proven higher win rate, or that broader deck support/session work is complete. Final shared-file reconciliation and combined browser acceptance remain integration-owned.

## Fixed tactical error

Medium and Hard previously charged a counterattack penalty for creatures their own combat model predicted would die. In the concrete fixture, CPU has 2 life and Ordinary Bear (4/5); the opponent has 4 life and Bear Cub (2/2). Attacking either deals lethal damage if unblocked or kills the only opposing creature if blocked. The old scores were Easy +4, Medium -4, Hard -21.6, so deeper profiles refused the attack for a phantom threat.

The estimator now reports predicted casualties as indices into the already authorized public battlefield. Counterattack evaluation uses predicted survivors, removes dead vigilant attackers from future defense, includes surviving tapped opponents that may untap, and excludes ordinary Defender creatures. There is no next-turn penalty after a modeled terminal outcome. These remain conditional estimates, including the original unknown-effects/multi-block uncertainty; the engine still determines legality and actual outcomes.

All three policies now score the fixture +4 and choose the accepted attack. A paired position with a separate tapped Bear Cub still makes Medium/Hard decline the attack. The fix is not an unconditional aggression bonus. No hidden cards, library order or draws are inspected; no card-name special case, runtime or shuffle change.

## What the beta tiers actually do

| Tier | Implemented behavior | Search depth / nodes / cooperative time |
| --- | --- | --- |
| Easy | Mana development, direct creature value, shallow combat, shared survival blocks | 1 / 24 / 12 ms |
| Medium | Two-card sequencing, supported deck role hints, combat and future-board resource estimates | 2 / 128 / 30 ms |
| Hard | Three-card sequencing, more public response alternatives, stronger future-threat weighting | 3 / 512 / 60 ms |

All tiers share observation restrictions, authoritative legal-action validation, mandatory-choice handling and survival fixes. Named sequence tests demonstrate different behavior: Medium finds two plays beyond Easy's horizon; Hard finds three plays beyond Medium's horizon. These prove distinct planning behavior, **not reliable overall strength ordering**. No universal combo, removal/protection timing, arbitrary-deck or optimal-play claim is made. Existing deck admission must remain in place for both seats.

## Concrete enablement patch

`docs/evidence/cpu-005-enable-beta.patch` contains a four-file adapter patch prepared against the pinned integration baseline. It is supplied for the owning chats; their working files were not edited here.

1. `match-authority.mjs`: preserves the integration candidate cache/invalidation and adds the CPU-003 difficulty/own-deck-plan/authorized-hand-cost forwarding. Validates the level and sends it to the policy worker.
2. `practice-authority.mjs`: recognizes the three implemented levels through the readiness flag, keeps `admission.admitted`, passes the chosen level and plan, and versions policy records with `cpu-config-v3`.
3. `practice-preflight.mjs`: removes the Medium-only restriction while preserving sign-in, CPU mode, format/deck parsing and both-seat executable-coverage checks. Unknown levels fail explicitly.
4. `play-menu.js`: enables the existing three options when the readiness flag is true and labels Easy/Medium Beta CPU and Hard Experimental beta. No layout redesign or separate UI combat logic.

Integrate CPU-003/004/005 CPU modules first, preserving the newer shared authority/journal implementation. Use `git apply --check docs/evidence/cpu-005-enable-beta.patch` against the appropriate candidate. Reconcile if newer UI/session work has changed those lines; do not overwrite entire files from an older branch. Include all new runtime modules in the integration-owned asset allowlist/service worker. CPU-004's separate cache-mock fixture patch still applies. Roll back a matched module/configuration set; setting readiness false provides a Medium-only gate through these adapters.

The applied patch was tested in an isolated copy using real preflight and authority modules. Two-card/three-card fixtures prove the selected tier reaches and changes the actual policy. Real-engine counterattack fixtures also run through the patched authority and production worker. The menu and practice worker parse successfully; that is not a claim of a signed-in browser match. Integration must run app-entry matches at all three selected levels and verify the shipped worker/config versions before publishing the combined release.

## Evidence and reproduction

- **PASS: 38 CPU/unit/privacy/configuration assertions.** Includes seven new counterattack cases, prior survival/large-board budget checks, hidden-world substitution and sequence-depth tests.
- **PASS: two new engine positions, six production-worker/profile checks.** Real accepted attacker/blocker actions establish the lethal no-block outcome and actual creature deaths/survivors for the blocked branch. Both opponent-response traces are retained.
- **PASS: all 16 existing combat fixtures, 48 profile/worker checks.** Survival, marked damage, trample, first/double strike, deathtouch, legal flying blocks, bad chumps and uncertainty stay covered.
- **PASS: six enablement checks.** Three levels accepted by preflight; invalid level/account/mode/unsupported decks still rejected; two- and three-card policy differences survive the patched authority routing.
- **PASS: six cache/journal regressions** with the previously supplied public-state mock enrichment and exact integration journal. Returned-copy isolation, changed contexts, mutation/rejection invalidation and stale-proposal rejection remain intact.

Node 24.22.1/Linux x64, fixture seed 12345, unchanged hash-verified runtime `a86578b23adcd26c`. Evidence layer: unit, synthetic adapter routing and real engine/worker. Browser/viewport: none in these CPU fixtures. A first combined test invocation used Node `--input-type=module`, which was inherited by the test worker's CommonJS shim and produced a harness `POLICY_FAILED`; it was corrected by running a normal `.mjs` entrypoint. No production workaround was made.

```sh
node --test experiments/phase-engine/test-cpu-*.mjs experiments/phase-engine/test-damage-interaction.mjs
node experiments/phase-engine/cpu-counterattack-engine.mjs
node experiments/phase-engine/cpu-survival-engine.mjs
node experiments/phase-engine/cpu-calibration-engine.mjs
node experiments/phase-engine/cpu-beta-enablement-test.mjs /path/to/isolated/patched/repository
```

The counterattack runner loads the old policy/evaluator with `git show` at CPU-004. `CPU005_BASELINE_DIR` can point to exact copied modules, and `CPU005_AUTHORITY_MODULE` selects the isolated patched authority. Sources and hashes are captured. The readiness flag is a CPU implementation declaration under the owner's beta direction, not a substitute for integration's release gate.

Actual combined/signed-in matches with CPU-005 remain **NOT TESTED** here. Recovery remains **UNSUPPORTED**. The known engine priority-enumeration cost, broader precon coverage, Smart pass/Full Control/stops and engine rejection atomicity are outside this CPU patch. No deployment, paid engine build or APK change.

## Latest paired calibration

**16 complete engine matches, 7215 accepted decisions, zero errors or limit/stall outcomes.** Identical decks within each game, paired policy seats, starter seeds 12345/98765 and separate small/large supported green-creature pools at seed 31415. Four concurrent shards; this direct-policy calibration excludes browser/worker transport. Production-worker paths are separately tested above.

| Pool / comparison | Wins |
| --- | --- |
| starter:Easy/Medium | Medium 3, Easy 1 |
| starter:Hard/Medium | Hard 1, Medium 3 |
| starter:Easy/Hard | Hard 2, Easy 2 |
| small:Hard/Medium | Medium 1, Hard 1 |
| large:Hard/Medium | Medium 2 |

Per-game policy p95 0.28–1.00 ms; worst policy sample 23.85 ms. Collection/expansion max 2083.35 ms; cooperative budget exhaustion 96 times. These loaded-host measurements are not an SLA. The sample still does not establish Easy < Medium < Hard overall. Hard is a deeper-search experimental policy, not a proven strongest opponent; release wording must preserve that limit. The owner’s usable-beta direction is the basis for exposing implemented, tested policy choices while further tuning continues.
