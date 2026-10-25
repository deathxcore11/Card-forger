# DECK-003: executable-data candidate and a real CPU decision blocker

**All 44 missing Tramplesaurus Rex definitions are now available as a reproducible candidate for the existing WASM. One imported definition needed a tested correction. The whole deck remains UNSUPPORTED because the exact-deck CPU trial stops on Surrak's required target choice.** No production database, deck admission, UI, CPU module or engine executable was changed.

Owner: Rules / Game Machinery Lord. Parent `d7a1a91b8a9a4f36b57076ab539ef102248379f7`; integration inspected `d81a0a14f3f34cf64fc0156abf495fab590263b6`. This is the selected complete-deck milestone from DECK-002, with the exact 100-card list preserved. Calling All Angels is not expanded by this task. The combined-release requirement is unchanged.

## What was added

The shipped 6,137-record database is an upstream integration-test subset, not the upstream full export. A pinned full export contains **36,037 records**, including every missing name in Tramplesaurus Rex:

- URL: `https://data.phase-rs.dev/card-data-84d5fd2af84e2f12.json`.
- SHA-256: `84d5fd2af84e2f125b740eeb05637785b2e8df26d34e41a2cd628697dae30513`; 100,070,783 bytes.
- Export metadata: source `09c286c0ff45011bcbeb9742848a95dac92b5466`, generated 2026-10-24 14:06:33 UTC, MTGJSON `5.3.0+20261023`.
- This source is **21 commits behind** the shipped upstream base `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`. It is not presented as the same build. Compatibility was tested against the delivered executable.

Only the 44 absent records are extracted. The deck's **25 already-shipped records remain unchanged**. The full upstream export is not bundled or substituted wholesale. Both the unmodified extraction and the corrected candidate are retained, with per-record/source hashes and the correction recipe.

All 44 records deserialize individually into the existing WASM. The exact 69-name deck dataset also loads; the mechanic harness adds four unchanged control-card definitions. Absence of parser warnings or an explicit Unimplemented marker is not used as a mechanics certificate.

Candidate artifacts:

- [Original 44 definitions](../experiments/phase-engine/fixtures/deck-003/tramplesaurus-additions.json).
- [Corrected 44 definitions](../experiments/phase-engine/fixtures/deck-003/tramplesaurus-additions.corrected.json).
- [Source receipt and per-card inventory](../experiments/phase-engine/fixtures/deck-003/source-receipt.json).
- [Exact Loot correction](../experiments/phase-engine/fixtures/deck-003/loot-correction.json).

Corrected candidate SHA-256: `6c834c2633755e0034be2300f61408c4967bac65a8ed46d4702b496bd29f1138`. It differs from the extraction only in two fields of Loot's activated Dig effect. The runner asserts that exact difference before executing anything.

## Loot: before and after

The unmodified import sets `abilities[0].effect.reveal=true` and omits `rest_order`, whose runtime default is preserve. During the actual selection, the opponent's engine snapshot therefore exposes all six card identities. After choosing or declining, the remainder retains its order without consuming RNG; unselected identities are still visible in the captured opponent snapshot. This demonstrates a wrong engine-facing data definition. It does not establish that the current production UI or CPU leaked these cards: the candidate is not admitted there.

The [Foundations release notes](https://magic.wizards.com/en/news/feature/foundations-release-notes) distinguish the private inspection from the selected card's reveal and require random remainder ordering. The official [current rules page](https://magic.wizards.com/en/rules) linked the [September 25, 2026 rules](https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.txt) when checked.

The delivered engine already supports `reveal=false` and `rest_order="random"`; see its [Dig implementation](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/game/effects/dig.rs) and [serialized fields](https://github.com/phase-rs/phase/blob/71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234/crates/engine/src/types/ability.rs#L18724). The candidate changes exactly those fields, with a precondition on the original record hash. No engine rebuild or runtime JavaScript workaround is needed for this correction.

Both selection paths now verify:

- The opponent cannot inspect the six private identities.
- A creature within the land-based mana-value limit is selectable; Ghalta's casting discount does not change its mana value for this choice.
- Choosing the creature or declining completes through the human interaction API.
- The selected creature becomes public on the battlefield; unselected cards remain private.
- Exactly the remainder reaches the bottom, seeded RNG advances, and no manual ordering prompt appears.

## Named mechanic results

Node 24.22.1 / Linux x64; unchanged WASM SHA-256 `a86578b23adcd26c38a68871e745305f3acb249158e1b424065cc6e6b6c3bfee`, runtime source `5169f7fe03f93a6afe36fec767c3cda10120dcdd`. Engineered mechanic positions use seed 12345; the real Commander initialization uses seed 7331. The full evidence records each starting state, command, expected/actual result and assertion.

| Case | Original data | Corrected data | Verified scope |
| --- | --- | --- | --- |
| `exact-commander-initialization` | PASS | PASS | Exact list passes the engine's construction gate, initializes 100 real cards per seat including command-zone Ghalta, 40 life and both opening keeps. Existing admission still rejects unverified coverage. |
| `five-green-cost` | PASS | PASS | Four Forests plus Mountain cannot cast Gigantosaurus; five Forests cast the actual 10/10. |
| `beast-within-opponent-land` | PASS | PASS | Real opposing land is destroyed; its controller gets one 3/3 Beast. |
| `beast-within-indestructible` | PASS | PASS | Rhonas survives destruction and its controller still gets the Beast. |
| `garruks-uprising-draws` | PASS | PASS | Qualifying own entry and later creature entry draw twice; current creatures receive trample. |
| `ordinary-land-limit-reset` | PASS | PASS | One land allowance, no further offered play, reset next own turn. |
| `loot-extra-land-reset` | PASS | PASS | Two-land allowance with Loot, no third offered play, reset next own turn. |
| `loot-look-six-choose` | **FAIL** | PASS | Private inspection, valid selection, public chosen creature and random private remainder. |
| `loot-look-six-decline` | **FAIL** | PASS | Legal decline, all six randomly returned to bottom without leaking identities. |
| `commanders-sphere-sacrifice` | PASS | PASS | Offered sacrifice activation moves the real artifact to the graveyard and draws one. |

Original: **8 PASS / 2 FAIL**. Corrected: **10 PASS / 0 FAIL**, with **96 accepted commands** in each run. The 44 individual load checks are separate schema evidence. These bounded cases do not certify every ability of their cards or the unexercised cards in the deck. Construction compatibility is the recorded engine result, not a new independent live-banlist audit.

Early harness assumptions about Keep and attacker action field names were corrected before the recorded runs. Original-data failures above are retained engine-visible defects, not those harness errors.

## Exact-deck CPU trial: FAIL, not a loss

The corrected candidate was tested with the exact Tramplesaurus list in **both seats**, Commander format, seed **7331**, Medium versus Medium. CPU sources are pinned to CPU-005 `97fc5705ccea76a51a9132ffcac189b2f1747878` (`cpu-config-v3`). Eighteen imported module hashes are verified before loading; they are copied into an isolated source directory and none are edited. This is a **direct production-policy trial**, not a worker/browser/integrated-session test.

After **100 accepted commands**, on **turn 6**, seat 1's Surrak, the Hunt Caller (object **135**) produces `TriggerTargetSelection`. The engine offers four `ChooseTarget` actions for objects **168, 138, 135 and 108**. CPU's permitted observation maps all four to `kind: "unsupported"`; `chooseVisible` throws `CPU_DECISION_UNSUPPORTED`. Easy, Medium and Hard each fail when separately evaluated on this same captured decision. Those are same-position checks, not three full matches.

No winner, loss, concession or timeout is invented. The fixture records FAIL with its offered actions, policy input, final engine state and complete accepted trace. Earlier steps completing do not establish that the CPU handles all meaningful optional activations; for example the existing policy's treatment of unsupported choices in a passable priority window still needs broader coverage.

**CPU dependency:** add supported target-decision handling to the CPU-owned observation/policy path, with accepted engine execution and privacy tests. This exact natural history is the first fixture. Do not resolve it by removing Surrak, changing its rules, silently passing the required prompt or calling this a completed match. This report does not make an overlapping edit to CPU-owned files.

## Human continuation isolates the layer

The companion probe initializes a fresh game and replays all 100 accepted commands. All saved gameplay fields match the failing position. A fresh initialization necessarily gets a fresh interaction session: only that ID and its exact prefix in active interaction handles are rebound for comparison; every other state field is checked. The evidence retains the two session IDs. There is no restore or direct state edit in this replay.

Three checks PASS:

1. `100-command-gameplay-replay`: reaches the same gameplay state.
2. `human-trigger-target-grants-haste`: seat 1 selects Surrak through the real interaction API, the trigger resolves and Surrak has haste.
3. `temporary-haste-expires`: accepted continuation reaches the next turn and haste has expired.

The probe makes 12 further accepted commands. It proves this human API path works and narrows the observed stop to CPU decision handling. It is not a rendered popup test or a complete match, and it does not turn the CPU FAIL into a PASS.

## Reproduce

The extraction is already checked in. To independently regenerate it, download the pinned export above and run:

```sh
node experiments/phase-engine/deck-data-candidate.mjs /path/to/card-data-84d5fd2af84e2f12.json
```

Run the before/after regressions from the repository root:

```sh
CARDSTASHY_DECK_DATA_VARIANT=upstream CARDSTASHY_DECK_DATA_ENGINE_OUTPUT=test-results/deck-003-before node experiments/phase-engine/deck-data-engine.mjs
CARDSTASHY_DECK_DATA_ENGINE_OUTPUT=test-results/deck-003-after node experiments/phase-engine/deck-data-engine.mjs
```

The first command deliberately exits 1 for the two retained failures; the second exits 0. Optional `CARDSTASHY_DECK_DATA_CASES` selects comma-separated case IDs and marks the run partial. No network is used by the engine runner.

For the CPU trial, provide a separate checkout or exact copied modules from CPU-005. Hashes must match [the module receipt](../experiments/phase-engine/fixtures/deck-003/cpu-005-source-receipt.json):

```sh
node experiments/phase-engine/deck-data-cpu.mjs /CPU005/experiments/phase-engine 7331 Medium Medium
node experiments/phase-engine/deck-data-decision-probe.mjs test-results/deck-003-cpu-7331
```

The CPU command exits 1 at the recorded unsupported decision. The continuation exits 0. The CPU harness has explicit 1,800-command and 240-second cooperative bounds; a bound produces NOT TESTED, never a match loss. A supervising process used a 300-second hard bound in this run; it did not fire. These timings are harness safeguards, not the product's clock policy.

## Integration and remaining work

- Keep the corrected data as a review candidate. Do not package the original Loot record. Any eventual database expansion must preserve the existing records, update the owned database/hash manifests deliberately and rerun admission/runtime packaging checks.
- Missing definitions are resolved **in this candidate** for this exact deck. Full mechanic coverage, production CPU choice completion and a combined browser match remain open. Production still uses its old database and admission guards.
- Current exact-deck admission continues to return false in the tests. Do not replace the coverage allowlist with all 69 names to force a pass. Data loading, construction legality, mechanics and CPU competence remain separate results.
- SESSION-001, the unbuilt rejection-atomicity candidate, the other precon, UI/Commander projection and final combined release validation remain separate dependencies. Recovery is UNSUPPORTED. Nothing here changes that status.

[Summary and hashes](evidence/deck-003-data-expansion.json) · [Compressed complete engine captures, CPU trial and human continuation](evidence/deck-003-data-expansion-full.json.xz).

Rollback: omit this candidate's new diagnostic/fixture files. It has no effect on shipped behavior until the integration owner explicitly adopts tested data and updates packaging/admission. No deployment, engine rebuild, paid build, APK or shared production-file change was performed.
