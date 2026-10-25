# Real-deck hotfix audit, 2026-10-25

Reviewed production commit: `e4e938bb93b8257590ab7e54dde81bd9684b281a` (4.0.2).
This branch adds diagnostics and evidence only. It changes no production module, data manifest, runtime, account record, deployment or APK.

## Findings

1. **Executable data is still a subset.** The shipped database contains 6,137 records. The pinned full export contains 36,037. Calling All Angels and Tramplesaurus Rex each lack 44 shipped definitions. All 44 absent angel records exist in the pinned export, without explicit `Unimplemented` markers. This is availability evidence, not behavior certification.
2. **The new coverage comparison rejects a valid composite card name.** With the installed database, the engine format gate accepts `The Arkenstone // Seek the Heart`. `evaluateCardCoverage` rejects it because `compiledCardSupport` exposes individual face names. `The Arkenstone` passes. Both face records are already installed. Resolve identity through the engine, check all required faces and preserve source snapshots; do not split arbitrary slashes or equate unknown names with illegality.
3. **A candidate angel expansion gets past loading, then exposes a CPU blocker.** All 44 absent angel records deserialize individually into the shipped WASM. A local expansion to 6,181 records admits and initializes the exact unchanged list: 200 real objects, 40 life and 92 library cards per seat after dealing. The bounded Medium mirror reaches 109 accepted commands, turn 6, then fails at Destroy Evil's required `ModeChoice` with `CPU_DECISION_UNSUPPORTED`. More data alone is insufficient. See evidence for source hashes, exact decision and accepted trace. This is direct policy execution, not a worker, rendered human match or broad mechanics certificate.
4. **Some definitions explicitly lack mechanics.** Seasoned Cryomancer is `Unimplemented` in both the shipped and fuller datasets. Missing data and unsupported behavior require different remedies.
5. **Safe in-match passing remains unavailable on the delivered engine.** The shipped WASM lacks `get_priority_capability_v1_js`. `priority-flow.mjs` therefore reports unknown coverage and stops. Removing setup confirmations does not repair in-match priority. The approved build failed at the 10-minute wasm-bindgen CLI installation timeout; new-WASM and native checks did not run. No paid retry was started here.

## Catalog and battlefield limits

The catalog reviewer passes the Arkenstone composite name when supplied the actual card's name/face/oracle/legalities metadata. The owner's lookup response was not captured, so the separate `unknown in Standard` provider/identity failure is still unproven. The included reproduction uses a minimal fixture and cannot establish the provider's current response.

132 relevant local source files matched the release contents. Final checking used e4e938b's actual Git tree (`5c5d951f36dcb4509abd797136bbae8a4c71b9e0`) and its `.assetsignore`, rather than a stale tree recorded in the earlier hotfix receipt. The attempted public Play browser entry failed with `net::ERR_FAILED`; subsequent observation was blocked by browser URL policy. No bypass was attempted. The actually mounted live battlefield remains **NOT TESTED** by this audit; do not infer a cache cause or deployed renderer from source review alone.

## Reproduce

Use this branch's exact source and the pinned full export:

```sh
node experiments/phase-engine/real-deck-hotfix-audit.mjs /path/to/card-data-84d5fd2af84e2f12.json test-results/real-deck-hotfix-audit
```

The runner verifies source export SHA-256 `84d5fd2af84e2f125b740eeb05637785b2e8df26d34e41a2cd628697dae30513` and the shipped runtime/data through `bootAcceptance`. It performs no network fetches. It records admission, schema loading, initialization and a bounded direct-policy trial separately. The natural trial is capped at 1,000 commands and 120 seconds; a supervising 160-second process bound was used. A bound is **NOT TESTED**, never a game loss. The retained CPU failure deliberately exits 1. Do not call the audit a passing full-match suite.

The installed database is passed to the engine with its original numeric tokens preserved. Parsing and stringifying the complete JSON through ordinary JavaScript Numbers corrupts u64 values; an initial harness attempt exposed that and was corrected. Candidate additions are checked for safe integer representation. No live application failure is attributed to that discarded harness attempt.

## Owned follow-up

- Integration: preserve one owner for production data/admission/priority; package reviewed definitions under immutable hashes and verify deployed assets.
- CPU: handle the required modal decision using engine-offered legal choices; add replay/privacy regression and rerun the exact angel mirror through completion.
- UI: early support checks and honest badges; visible tested starter match; compact deduplicated recovery with reachable actions; explicit Standard/Commander empty-state navigation. The owner's full specification is in issue #50.
- Rules: [LOST-WOODS-001](https://github.com/deathxcore11/Card-forger/issues/56). The shipped database has no Lost in the Woods record; its shipped behavior cases are UNSUPPORTED. Candidate loading and actual behavior must be tested independently.

No result here certifies every card, a full owner-account journey, the live battlefield, recovery, Friends, or APK alignment.
