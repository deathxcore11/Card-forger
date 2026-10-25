# CPU-006: browser practice-worker acceptance

Owner: CPU. Starting commit: `97fc5705ccea76a51a9132ffcac189b2f1747878` (CPU-005). Branch: `codex/cpu-006-practice-worker-20261025`.

This task closes a route-level evidence gap in the existing CPU-005 handoff. It does not change CPU strategy, shared production files, deck admission, the runtime or the combined-release scope. Final integration and deployment remain with Live Push.

## Candidate and evidence boundary

The isolated candidate combines integration `d81a0a14f3f34cf64fc0156abf495fab590263b6`, the CPU-003/004/005 modules and the four-file CPU-005 enablement patch. All 34 source files in the exercised dependency graph were checked: 30 against exact Git blob identities and four against the published adapter patch receipts. The supplied source provenance records those checks.

The test uses real Chromium, the production difficulty-menu markup, preflight, practice flow, client, session, authority, journal, runtime loader and nested CPU worker. The actual selector is changed before launch. A synthetic account supplies the setup; a deterministic human driver uses the public session API to keep, play lands, cast offered spells, attack, assign damage and answer mandatory selections. It does not inspect authority saves, hidden CPU cards or the CPU's private proposals.

The runtime loader verifies and loads the unchanged shipped WASM and full 6,137-record database. The exact 60-card starter list is 24 Forest and four each of Llanowar Elves, Bear Cub, Ordinary Bear, Ghalta, Primal Hunger, Lashwhip Predator, Tarmogoyf, Tapestry Warden, Virulent Emissary and Scarecrow Guide. Both seats receive the same list, seed 12345; each difficulty is exercised with player first and CPU first. This fixture supplies raw deck snapshots without a catalog-review field: engine construction and tested-pool admission execute, while the full app's catalog/printing preparation is outside this test.

Only two test-only source decorations are served: console telemetry appended to the policy worker records selected difficulty, decision kind, candidate count and handler duration; an IndexedDB getter in the authority throws if session-only execution attempts durable storage. Neither changes policy inputs, returned choices, RNG, legal actions or runtime bytes. Their served hashes are recorded separately from the production-source hashes.

## Acceptance assertions

- The actual menu offers all three implemented levels, with Hard explicitly labeled Experimental beta.
- The selected level passes preflight and is present in the admitted practice binding and every observed CPU policy packet.
- Both exact decks pass the existing authority admission; session-only mode remains active.
- Every accepted revision is observed in order, from zero through the real engine terminal outcome.
- Terminal revision equals human commands plus CPU commands; policy-worker invocations equal accepted CPU commands.
- The scripted human casts spells and completes the match without a session error, browser error, missing module or command-limit outcome.
- CPU decision kinds and measured policy-handler latency are retained, with per-command reproduction traces. These games are route acceptance, not policy-strength calibration: the scripted human uses a deliberately simple attack/no-block strategy.

## Reproduction

Prepare a separate checkout with the CPU-005 module set, the newer integration cache/journal and its reconciled enablement patch. Do not overwrite newer authority files with older CPU branch copies.

```sh
CARDSTASHY_CHROMIUM_PATH=/path/to/chromium \
CPU006_RUNTIME_DIR=/path/to/shipped/runtime/a86578b23adcd26c \
node experiments/phase-engine/cpu-practice-worker-browser.mjs /path/to/reconciled/candidate
```

The runner uses Playwright from `CODEX_PRIMARY_RUNTIME_NODE_MODULES` when supplied, otherwise the installed `playwright` package. `CPU006_GAME_INDEX=0` through `5` selects one game in Easy/Medium/Hard, player-first/CPU-first order. `CPU006_OUTPUT` selects an isolated evidence directory. Browser execution needs no external card service and blocks external page requests. It does not run an engine build.

## Limits and integration dependencies

**NOT TESTED:** real owner authentication, full app Home/Play/pregame navigation, final UI composition and interaction quality, packaged service-worker/asset allowlists, live deployment, all supported nonstarter mechanics, broad precons or stronger overall Hard performance. No passing starter match promotes a newly loaded card definition or a whole precon to CPU-supported status. Additional targeting, alternate-cost or other mandatory decision paths need their own CPU acceptance before broader decks are admitted.

**UNSUPPORTED:** recovery after refresh, as already agreed. The fixture uses session-only records. CPU clock/error classification and SESSION-001 behavior remain integration dependencies; this task does not claim a new timeout policy or complete responsiveness from policy-handler timing alone.

The CPU-005 handoff and four-file adapter patch remain the implementation deliverable. This commit adds only the CPU browser harness, this report and evidence. Rollback consists of omitting these diagnostics; no production rollback is required. No deployment, engine rebuild, paid build, APK change or shared-owner edit.

## Results

**PASS: six complete Chromium practice-worker matches, 1,736 accepted actions, 884 CPU decisions and 852 scripted human commands. Zero session/browser errors, missing modules, skipped revisions or command-limit outcomes.**

| CPU level | First player | Winner | Turn | Accepted actions | CPU decisions | Worker p95 | Worker max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | Human | CPU | 12 | 251 | 129 | 2.10 ms | 6.70 ms |
| Easy | CPU | CPU | 13 | 262 | 134 | 3.40 ms | 31.50 ms |
| Medium | Human | CPU | 12 | 251 | 129 | 2.10 ms | 11.50 ms |
| Medium | CPU | CPU | 15 | 313 | 159 | 2.40 ms | 13.00 ms |
| Hard | Human | Human | 21 | 426 | 214 | 1.70 ms | 53.90 ms |
| Hard | CPU | CPU | 11 | 233 | 119 | 2.40 ms | 6.10 ms |

Browser: 153.0.8010.0, Linux x64, 1440 × 900. Runs overlapped by up to three games. These worker-handler durations exclude engine enumeration, journal persistence/copying, transport, browser startup and runtime loading. They are not complete decision-latency measurements or a real-device responsiveness guarantee. Cooperative policy budgets can be exceeded by scheduling or work already in progress.

Observed CPU decisions: DeclareAttackers (36), DeclareBlockers (19), MulliganDecision (6), Priority (823). Other mandatory decision kinds remain covered only where separately named in prior fixtures, not by these matches.

The real selector and actual policy packet agree for every observed CPU decision. The candidate is ready for Live Push to reconcile and perform final full-app acceptance. It has not been deployed. Existing mixed paired-policy samples still do not prove Hard is the strongest tier.

Full traces and source identities: `docs/evidence/cpu-006-practice-worker.json`.
