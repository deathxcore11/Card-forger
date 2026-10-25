# SESSION-001: conservative session implementation

Owner: integration / Live Push. Starting integration commit: d81a0a14f3f34cf64fc0156abf495fab590263b6. This checkpoint combines CPU-003/004/005/006 through 6cbb7e7600f6a703b7c5457cd2f5e2e5e065083a and UI-004 e4086bc6f73c44a19895074e22314f803e7f596d. It is an integration dependency, not a release approval or deployment receipt.

## Player behavior and contract

`createMatchSession()` now exposes `snapshot().turnFlow`, `setControlMode`, `yieldUntilAction`, `cancelYield` and `setPhaseStop` according to turnFlow v1. Preferences last only for this match. The UI can bind actual methods and authoritative turn/priority/decision facts rather than inventing legality.

The delivered engine's action coverage is **unknown**. RULES-004 disproved treating either legacy recommendation flag as a completeness certificate. The authority therefore reports unknown coverage and refuses automatic passing. This is a functioning conservative state machine, **not completed smooth Smart passing**. Full Control and stop preferences are implemented, but complete safe empty-window detection remains a release dependency. Capability flags describe implemented methods; `coverage` and `reason` describe whether a particular decision can proceed. Do not tell players that Smart mode currently eliminates empty-window clicks.

Pending local drafts, mana windows, meaningful actions, mandatory decisions, unknown phases/coverage, configured stops and errors all stop voluntary automation. Full Control invalidates queued work. Cancel suppresses the current decision; cancellation during an in-flight pass suppresses the next automatic pass after its receipt. Closing/account retirement invalidates unsent work. New matches reset preferences, with no match IndexedDB or preference persistence.

The new `autoPass` journal operation carries a revision and decision ID. Authority recomputes capability under the existing serialized mutation queue and requires an exact current engine pass. Duplicate IDs replay receipts; stale revisions and different decisions cannot execute. Automatic passes do not replenish human inactivity time. The client classifies an interrupted automatic pass as an unknown mutation outcome and never retries it. Unknown coverage is rejected before touching engine state. This does not repair the separately reported engine rejection-metadata mutation for other actions.

Normal status projection reuses the viewer interaction snapshot already needed by the table instead of adding another viewer enumeration for turnFlow. The submission gate recomputes its facts; no cached UI claim authorizes a pass. CPU candidate caching and fresh final legal-action validation remain in place.

## CPU and UI intake

The reconciled CPU adapter preserves the newer integration cache/journal, forwards the selected difficulty and authorized own-deck plan, and enables Easy/Medium Beta CPU and Hard Experimental beta through preflight and the practice worker. The five new CPU runtime modules and priority-flow module are in both asset packaging lists. Both-seat executable-deck admission remains unchanged. Difficulty strength ordering is not established.

The four UI-004 production files are preserved exactly from the handed-off commit. UI-003 deck browsing/save/Quick Play and its turn-control adapter are still owned by UI and are not part of this intake. The small CPU label change in play-menu.js must be retained when UI-003 is reconciled.

## Verification

- PASS: 396 focused Node checks over `experiments/phase-engine/test-*.mjs` and `test-play-*.mjs`, including 14 new priority-flow cases and the additional interrupted-client-operation case. These include stale callbacks, same-decision cancellation, cancellation after receipt, both-seat stops, Full Control, mandatory/mana/draft/unknown guards, duplicate serialization, fresh authority rejection and synchronous subscriber cancellation. Synthetic complete-coverage fixtures exercise the future positive path; they are not engine completeness evidence.
- PASS: two real delivered-WASM/journal fixtures, starting player 0 and 1, seed 12345. Engine facts reach the contract. Both attempted automatic passes return AUTO_PASS_UNAVAILABLE with identical exported engine state and unchanged journal revision/record. Small Vintage fixture; not a complete match. Actual snapshots and source hashes are in `evidence/session001-flow-engine.json`.
- PASS: independently reran all 16 CPU survival positions, each across the three production-worker policies (48 profile checks), and six difficulty/preflight routing checks.
- PASS: independently reran five real-engine block-search boards, including 13 and 20 blockers. Extra preview calls are capped at four and repeat collection reuses the candidate cache; life-saving actions are engine accepted. These runs preceded the session additions and have their own source hashes.
- The cache unit fixture now uses a deterministic clock because parallel process contention could exhaust the deliberately short search budget before its first preview. All six cache assertions remain; separate budget-expiry tests remain unchanged. The preflight/menu expectations now assert enabled beta tiers while retaining guest, unsupported-deck, unknown-tier and unavailable-mode rejection.
- PASS: a combined starter browser match on gameplay commit `353420fb07fc09d3cf4d1eae25437c470a7476b9`: 237 accepted actions, 118 human commands, CPU winner on turn 12. Chromium 153.0.8010.0, 1920×1080, fixture account/backend and captured catalog, Medium CPU. All 238 requested underlying source/runtime files match the commit; the explicit test-only IndexedDB guard is separately hashed. This is not owner sign-in, broad-deck, final UI-003, navigation/result-history or actual-zoom acceptance. See `evidence/integration353-browser.json` and `evidence/integration353-source-lock.json`.
- Two earlier harness failures are retained in `evidence/integration353-browser-driver-failures.json`: clicking a covered fanned-card center; then using the obsolete Confirm blockers label instead of Confirm blocks. The corrected driver chooses an actually exposed pointer target and normal hover/click, without force or DOM-dispatched clicks. No production UI workaround was needed. A superseded run with the obsolete label was interrupted. The seed was not separately recorded by this app-entry harness; do not claim the deterministic engine-fixture seed applies to this browser match.

Reproduce focused checks with `node --test --test-reporter=tap experiments/phase-engine/test-*.mjs test-play-*.mjs`; real conservative boundary with `node experiments/phase-engine/priority-flow-engine.mjs`. No engine rebuild is required. Runtime identity remains a86578b23adcd26c.

## Remaining combined-release blockers

UI-003 completion/integration; complete safe human action coverage; authoritative Commander tax/damage/designation and other requested public projection fields; DECK-003 Surrak target-selection CPU failure and remaining exact-deck mechanics/admission; engine rejection atomicity; CPU clock/error classification; outcome/exact-revision history; final combined full-app match, actual zoom/accessibility and signed-in validation. The combined release requirement remains intact. Recovery is UNSUPPORTED. No production deployment, paid engine build, APK change, or workflow dispatch is part of this checkpoint. The service-worker release version is intentionally unchanged until final release packaging.

Rollback: retain d81a0a14 or omit this integration checkpoint as a unit. Do not mix older CPU adapters with the newer cache or deploy these dependency changes as the completed release.
