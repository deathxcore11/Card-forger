# CPU target and trigger-order integration fix

The exact Tramplesaurus mirror that failed at Surrak now reaches an actual engine result: **222 accepted commands, turn 10, winner seat 1**, Medium versus Medium, seed 7331. This is a direct production-policy match with the corrected DECK-003 candidate, not a browser match or production deck admission.

The baseline reproduced `CPU_DECISION_UNSUPPORTED` after 100 accepted commands at Surrak's `TriggerTargetSelection`. Target handling exposed another required decision after 144 accepted commands: ordering Surrak and Unnatural Growth triggers. Both failures are retained in the evidence.

## Implementation

Only `cpu-public-observation.mjs` and `cpu-public-policy.mjs` change production behavior. Exact offered `ChooseTarget` actions are mapped to positional public summaries, with no object handles, names, source descriptions, private cards or random state sent to policy. The observation verifies the acting seat and current target membership. Invalid mandatory declines are excluded.

A structurally identified public stack effect that only grants haste until end of turn prioritizes an untapped summoning-sick creature. This recognizes effect data, not Surrak's name. Simple harmful/helpful effect kinds use public target heuristics. Unmodeled effects use stable offered order: this is explicit legality-preserving fallback, **not strategic competence certification**. Trigger ordering similarly chooses an offered complete permutation without copying trigger descriptions to the policy worker. Final authority still owns stale-action checks and accepted execution.

## Evidence

- 42 Node checks PASS across target choices, public observation/privacy, difficulty, survival counterattack and block search; 8 are new target/order checks.
- Six natural-history production-worker replay cases PASS: all three difficulties select Surrak from the exact 100-command position, the engine accepts the action and gives actual haste after resolution; all three also complete the exact 144-command trigger ordering.
- Three complete direct-policy mirrors PASS: Easy 222 accepted commands, Medium 222, Hard 217; all seed 7331, turn 10, winner seat 1. Exact starting/final state hashes, accepted traces and module hashes are retained. Medium preceded a helper-only observation refactor; Easy/Hard and the six worker replays used final production bytes. These are three bounded matches, not a proof of difficulty ordering.

Reproduce from repo root:

```sh
node --test experiments/phase-engine/test-cpu-target-choices.mjs experiments/phase-engine/test-cpu-public-observation.mjs experiments/phase-engine/test-cpu-difficulties.mjs experiments/phase-engine/test-cpu-counterattack.mjs experiments/phase-engine/test-cpu-block-search.mjs
node experiments/phase-engine/cpu-target-engine.mjs
CARDSTASHY_DECK_CPU_OUTPUT=test-results/cpu-target-medium node experiments/phase-engine/cpu-target-deck-engine.mjs experiments/phase-engine 7331 Medium Medium
```

The two replay fixtures contain only previously accepted natural command histories. The worker runner initializes and replays those commands; temporary save/restore isolates tier comparisons at the same resulting decision. No engineered history or restored state is used in the complete-match trial.

## Remaining scope

Corrected 44-card data is still a test candidate; original shipped records and runtime are unchanged. No production database/admission allowlist, all-card mechanics claim, UI/session/browser complete-match claim, recovery, deployment or paid build is added. Broader optional ability policy and other unobserved decision families remain unproven. Calling All Angels remains outside this expansion. Integration must rerun final combined acceptance after all changes are frozen.

[evidence](evidence/cpu-target-001.json)
