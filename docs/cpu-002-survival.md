# CPU-002 survival repair

Based on CPU-001 (`fe17d371`) and release `2af11c9`. CPU owns the new policy modules and fixtures. `seat-surface.mjs` and `visible-cpu-policy.mjs` remain byte-identical to the release to avoid overlapping edits with Game machinery lord. The small `match-authority.mjs` adapter change requires Live push's shared-file reconciliation.

## Behavior

The Ghalta fixture now selects the surviving trade. Combat uses actual attackers, attack destinations, effective characteristics, marked damage, damage-from-toughness flags and authoritative legal block relationships from the seat-filtered engine envelope. Tapped creatures are never treated as evidence of attacking. Names, oracle IDs, hidden hands/libraries, private saves and game RNG are not sent to the policy worker.

The engine's generated block suggestions omitted joint blocks in a two-attacker fixture. `cpu-legal-candidates.mjs` constructs a bounded set from the authoritative public block graph and retains an added action only if `preview_action_js` returns `status: applied`. Preview deltas are discarded. The existing journal revalidates the current candidate and the engine validates again on submit. No rules runtime is changed or rebuilt. Complex block capacities retain the engine's original suggestions; enumeration is bounded and not claimed exhaustive.

Within the supported no-response combat model, survival/win outcomes are ranked before material value. A healthy player may decline a costly chump block. All predictions remain conditional: no intervening spells or abilities. Unknown keywords, face-down objects, public triggers/replacements, unsupported static effects, and multiple blockers downgrade prediction confidence. This is not a guarantee of a future game outcome. Effects outside the represented public object/stack model and broader card interactions require additional coverage.

## Verification

- Permanent CPU-001 regression: **7 PASS, 0 FAIL, 1 NOT TESTED**. The original captured failing audit remains preserved.
- `node experiments/phase-engine/cpu-survival-engine.mjs`: **16 PASS**. Each case also exercises the production policy worker through `createMatchAuthority`. Every tested candidate is engine-preview validated and submitted to the real shipped runtime; supported-model life totals are compared with actual resolution.
- Cases include two attackers/joint blocks, trample, first/double strike, deathtouch, lifelink, marked damage, toughness-based damage, vigilance with a tapped bystander, indestructible, flying, bad chumps, and confidence downgrades for multi-block/public triggers.
- `node --test experiments/phase-engine/test-cpu-public-observation.mjs experiments/phase-engine/test-damage-interaction.mjs`: **11 PASS**. Private identity getters throw if touched; they remain unread. Foreign views are rejected. No card-name survival special case.
- Shipped WASM/glue/card database/chunk hashes verified before engine tests. No network or engine build.
- Signed-in complete match, crash/reload recovery and difficulty calibration are **NOT TESTED** in CPU-002.

Evidence is in `docs/evidence/cpu-002-{baseline,survival}.json`. Runtime predictions, real accepted traces, expanded-candidate validation, worker-path checks and source hashes are recorded separately. Run with Node 24 from a checkout containing the shipped runtime.

## Integration and release dependencies

1. Reconcile `match-authority.mjs` (new observation/worker imports and validated CPU block candidates). Preserve any concurrent rules/UI fixes. Neither shared projection nor legacy policy was edited.
2. Add these runtime modules to the asset allowlist and service-worker release list: `cpu-public-observation.mjs`, `cpu-combat-evaluation.mjs`, `cpu-public-policy.mjs`, `cpu-public-worker.mjs`, `cpu-legal-candidates.mjs` under `experiments/phase-engine/`.
3. Run the combined app-entry complete-match checks and the owner's signed-in check. Keep recovery limitations explicit.
4. CPU-003 follows as a separate configuration/measurement commit. Easy/Hard remain disabled here. UI difficulty controls and assistance remain separate.

Rules reference used for allocation semantics: [Wizards Foundations update bulletin](https://magic.wizards.com/en/news/announcements/foundations-update-bulletin). The CPU estimator does not decide legality; the shipped engine remains authoritative.
