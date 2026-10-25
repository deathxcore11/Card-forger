# Play integration checkpoint — 2026-10-25

Status: integration branch prepared; no new production release published.

Production baseline: `2af11c9a1326e0db75b875d9c122e3dea01055d7` (4.0.0).
Integration branch: `codex/play-integration-20261025`.
Shared task list: https://github.com/deathxcore11/Card-forger/issues/50

## Accepted handoff

CPU-001 commit `fe17d371051b07ea49caab60ea95e6e2a1c2844b` was reviewed and fast-forwarded into the integration branch after verifying that it is exactly one commit ahead of the release and changes only its harness, evidence and handoff document. It does not change production code or fix the CPU.

The coordinator independently reran the exact published harness (Git blob `4a02990963183d17ae31d37ef8495722f54da554`) against unchanged release implementation. Result: **6 PASS, 1 FAIL, 1 NOT TESTED**. The failing case is the lethal Ghalta block at 12 life. The harness correctly exits 1. The CPU chat separately reports four passing existing damage tests; those four were not independently rerun in this checkpoint.

## Baseline verification performed by the coordinator

| Check | Result | Scope |
| --- | --- | --- |
| Baseline files against prior deployed-file receipt | PASS, 59 matches, no mismatches | Local source identity against the historical release receipt; not a fresh fetch of all live bytes |
| Focused Phase/Play tests | PASS, 322; no skips or failures | `node --test experiments/phase-engine/test-*.mjs test-play-*.mjs` |
| Delivered-runtime starter mechanics | PASS, 16 | `experiments/phase-engine/starter-pool-engine.mjs`, unchanged compiled runtime and card data |
| Fresh complete starter match | PASS | Turn 17; winner seat 0; 376 accepted actions; 187 human commands |
| CPU tactical/fairness audit | 6 PASS / 1 FAIL / 1 NOT TESTED | Exact CPU-001 harness against unchanged release |
| Owner's signed-in complete match | NOT TESTED | Fixture account evidence does not satisfy this |
| Reload/crash recovery | UNSUPPORTED in current beta | Session-only authority; match IndexedDB use forbidden |
| New combined release | NOT READY | Pending implementation handoffs |

The fresh complete match ran `experiments/phase-engine/starter-app-browser.mjs` through the actual application entry handler, setup/import, pregame, preparation, catalog review, shared artwork dependencies, table controls and delivered runtime. No activation override and no stubbed shared modules. Account/backend data and catalog responses were fixtures. The captured catalog responses are the existing release inputs, not a new live legality check. The browser log included missing-resource/network messages; the application/engine assertions completed successfully. This proves bounded fixture-account match completion, not every card, arbitrary decks, visual perfection, CPU tactical correctness, recovery, or the owner's signed-in experience.

## Ownership and remaining inputs

- UI-001: UI chat owns `match-table.mjs`, `match-table.css`, and dedicated UI fixtures/tests/evidence. Its current checkpoint reports 67 focused checks and synthetic mounted-UI checks passing; responsive review and a pushed implementation commit are pending. Do not integrate its uncommitted workspace.
- RULES-001: Rules chat owns dedicated Rat/manifest fixtures and evidence. Preserve the 15-case acceptance contract and four status categories. No complete pushed handoff has been accepted here.
- CPU-002: CPU chat owns `visible-cpu-policy.mjs`, dedicated CPU tests/evidence, and the public combat projection additions needed in `seat-surface.mjs`. The rules workspace had no tracked production-file modifications when this reservation was recorded. Face-down/projection dependencies must be reported before overlapping edits.
- SESSION-001: Smart pass, Full Control and phase stops still lack a verified implementation owner/contract. UI must not guess legality or expose nonfunctional controls.
- Integration: owns sequential reconciliation, final release metadata, regression checks and publication. Keep the existing APK and immutable engine unchanged; no paid engine build.

CPU-002 must fix the demonstrated surviving block while retaining audit cases B–G, verify worker/authority acceptance and hidden-information exclusion, and add edge-case evidence for any broader combat scoring claims. Do not infer attackers from tapped creatures or use a universal block bonus.

## Reproduction inputs and receipts

Use the existing runtime package `experiments/phase-engine/runtime/a86578b23adcd26c`; follow the harness environment inputs and the baseline release verification document for the unpacked runtime and captured starter catalog/images. No engine rebuild is needed.

SHA-256 of coordinator outputs:

```json
{
  "focused": {
    "sha256": "40232bb32dd23bdd27768cddb29ec01e96e536fe12f73d2f3b1faabffbebefe4"
  },
  "mechanics": {
    "sha256": "31fc12ccbdea3e2da3c942d69aa58b133581492f5682820b4864de7831dc59d4"
  },
  "fullMatch": {
    "sha256": "210fe449fc2a2b9f19ec136cc781255e2028f5ddd85e11f266539476dd8a3e7e",
    "passed": true,
    "terminal": {
      "revision": 376,
      "winner": 0,
      "turn": 17,
      "humanCommands": 187
    },
    "limits": "Real app start handler/resolver, setup/import, pregame, preparation, current catalog review, real shared artwork/foil/Power/wiki dependencies, production coverage, delivered engine and table. Account/deck backend and card API served from fixture account and captured current public responses; not an actual signed-in owner session or arbitrary-deck support. Match IndexedDB access forbidden.",
    "activationOverride": false,
    "stubbedModules": []
  },
  "cpu": {
    "sha256": "0c6ad76c52e325d5c24402fd662c429122c1bd1a06895af84ec29975fc249291"
  }
}
```

The production ref and live `config.js` were checked and still reported 4.0.0 / `2af11c9`. GitHub returned no Actions runs for the baseline or accepted CPU audit commit at this checkpoint. No production ref update, engine build, Android release, or deployment was performed.
