# Coordinated Play release candidate

> **Superseded release decision, 2026-10-25:** the owner explicitly directed publishing the tested candidate as-is, documenting known defects and following with a combined hotfix and APK alignment. See `release-4.0.1.md`. The candidate facts and former gates below are retained as historical evidence; they no longer prohibit this scoped publication. The prepared engine build is not needed for this release and has not been dispatched.

This candidate combines integration parent `3110e75` with UI-003 `616911a` and UI-005 `26da16e`, plus the bounded integration fixes below. It is **not a production release**. Runtime `a86578b23adcd26c` is unchanged. Production remains v4.0.0 until the remaining gates pass.

## Implemented and tested

- Deck browsing/save, temporary selections, Quick Play, Easy/Medium/Hard controls, portrait HUD, hand-card cues and keyboard focus from both UI handoffs. Four new root modules and three new engine-side modules are packaged in the asset allowlist/service worker.
- CPU required target selection and offered trigger ordering. Surrak's exact failed position now succeeds on all three policy workers. Three exact Tramplesaurus direct-policy matches reach GameOver with corrected candidate data. This does not admit that data into production or establish all-card mechanics.
- Public Commander designation ledger, actual tax/cast count and damage, including historical public damage while the object is hidden. Current hidden location/controller/tax are not exposed. Real cast, combat, Command return and recast establish tax 0→2→4.
- Authoritative ending reasons for engine ending, concession, inactivity timeout, turn timeout and unknown. CPU errors do not invent a winner. Results bind the frozen deck digest/revision and persist at most 50 local summaries per account, including original deck/printing fields. No resumable engine state is saved.
- Result screen shows reason/history and explicit Save deck. Expanded history scrolling is fixed and verified.
- Actual engine-offered single-color mana choices reach the table through revision-bound action tokens. This fixes the newly reproduced starter Ghalta payment blocker; no UI legality inference or constructed mana action.
- Optional versioned safe-pass certificate consumption is wired, but the shipped engine lacks the export. Unknown coverage still stops. The combined Rust capability/atomicity patch is prepared, not compiled.

## Evidence boundaries

- **442 focused Node checks PASS**: `release-combined-node.tap`.
- **Complete combined Medium starter browser match PASS**: 282 accepted actions, 142 human commands, CPU win turn 14; seed 691087302, human first; Chromium 153.0.8010.0, 1920×1080. Actual setup/start handler, pregame, table, session, authority and CPU worker. Ending reason, local history and explicit post-match save pass. Account/backend/catalog are fixtures; this is not a real owner sign-in/provider-write claim.
- All **243 requested underlying source/runtime files** match the current frozen files. The documented test-only IndexedDB denial prefix is accounted for separately. See `release-browser-source-lock.json` and `release-combined-browser.json`.
- Controlled UI: 34 deck checks, 9 actual session-control checks, 40 focus/HUD assertions, 42 decision assertions, 96 layout cases; 19 additional Commander/history/scroll checks. Actual keyboard inputs pass. CSS reflow does not establish actual browser zoom.
- CPU: 42 targeted/regression Node checks; six production-worker replay cases; complete direct-policy Tramplesaurus mirrors Easy 222 actions, Medium 222, Hard 217. These are separate evidence from the combined browser match.
- Earlier failures are retained: omitted Save callback in the extracted test harness, then the genuine unsupported ChooseManaColor at revision 209. The harness dependency and actual seat adapter were corrected separately. The successful match is a fresh run.

## Release gates still open

1. Build and execute the pinned new engine. Current WASM still fails rejection atomicity and cannot certify empty priority windows. Prepared combined source tree: `c8f2db24fd81f34821dddf69e5b7404fcf16412c`; patch SHA-256: `a1188d35bfb3905dae06e5fda8b6fa4ed0dbc4cd8d0dbe19ee574ba211afc343`. Seven Rust tests and seven new-WASM groups remain NOT RUN. See `release-engine-proof-proposal.md`.
2. Adopt only a passing new runtime with exact glue/rules/chunk hashes, then repeat the relevant regressions and final combined all-tier app journey.
3. Broader executable card-data packaging/admission and untested mechanics remain open. The corrected 44-record precon candidate is retained as diagnostic data. No blanket card-name whitelist or arbitrary-deck unlock is made. Calling All Angels remains outside that expansion.
4. Real owner sign-in/provider save, actual 200% browser zoom and physical-touch acceptance remain NOT TESTED. A distinct CPU forfeiture clock remains unimplemented; existing human clocks and CPU-error behavior are explicit in the outcome report.
5. Final release version/cache update, deployment, served-byte verification and rollback check still follow acceptance. No APK change is included.

Recovery is **UNSUPPORTED**. Rat/manifest work stays separate. No paid build, workflow dispatch or production deployment was performed while preparing this candidate. One complete release remains the goal; this checkpoint is not approval to publish a smaller partial release.
