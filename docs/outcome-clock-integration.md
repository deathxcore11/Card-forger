# Outcome and clock integration

Scope: JavaScript journal/result correctness against the existing runtime. No engine build, deployment, recovery support or final browser acceptance claim.

## Implemented

`status.terminal` now contains the engine winner and a journal-derived `reason`:

- `engine-terminal`: the engine ended after an accepted gameplay action.
- `human-concession`: an accepted human concession ended the game.
- `idle-timeout`: the human inactivity budget submitted an accepted engine concession.
- `turn-timeout`: the human turn budget submitted an accepted engine concession.
- `unknown`: terminal exists without adequate accepted-action evidence, or an unrecognized timeout cause.

No nonterminal status or CPU/transport error becomes a result. Engine winner stays authoritative. Neither this classifier nor the UI invents a win, loss or draw.

The previous durable-record code mislabeled `HumanTimeoutConcede` as `engine-terminal`. Both durable and session-only records now use the same classifier. Results contain match ID, accepted revision, winner, reason, first completion timestamp, format, difficulty and the original snapshot digest. That digest binds the exact frozen player/opponent lists including printings and finishes. Duplicate terminal receipt/status reads preserve the first result. A subsequent nonterminal write or conflicting terminal is rejected.

Session-only `getResult()` exposes a clone of the in-memory record. Closing the record clears it and retires its methods. This is not persisted match history and does not enable resume.

## Verification

Command:

```
node --test experiments/phase-engine/test-match-result.mjs experiments/phase-engine/test-worker-journal.mjs experiments/phase-engine/test-practice-record.mjs experiments/phase-engine/test-practice-session-record.mjs experiments/phase-engine/test-worker-turn-budget.mjs experiments/phase-engine/test-turn-budget.mjs experiments/phase-engine/test-timed-priority-journal.mjs experiments/phase-engine/test-priority-flow.mjs
```

Focused checks cover accepted concession, both clocks, engine win/draw classification, unknown result cause, malformed winner, exact snapshot/revision identity, stable duplicate timestamps, immutable session result copies, conflicting writes, CPU proposal failure without a result, rejected timeout concession without a loss, and preserved automatic-pass/timer safety.

The tests use controlled engines/storage and exercise the actual journal/record modules. They do not establish real signed-in history UI or final all-tier browser matches.

## Still open

- UI result copy now consumes `status.terminal.reason`; it does not infer a cause from errors or the winner alone.
- Persisted account history is implemented by the follow-up below and exposed on the result screen; real-account/browser acceptance remains distinct.
- Existing human clock semantics are unchanged: 90-second inactivity only during human action windows, 300-second own-turn deadline regardless of actor, and separate 30-second legal-priority reaction pass. CPU thinking does not consume human inactivity. A hard turn expiry during CPU work waits for an authoritative human window.
- A separate CPU forfeiture clock is not implemented. CPU worker/transport failure still stops play as an error, not a winner.
- Recovery remains UNSUPPORTED in the beta.

Packaging must include `experiments/phase-engine/match-result.mjs`.

## Completed-result history follow-up

The production session-only flow now writes a **completed result summary** to host localStorage after receiving an engine terminal and verifying that the worker's snapshot digest equals the captured input digest. This does not save any resumable position. Worker storage stays in memory and never opens IndexedDB in session-only mode.

`practice-result-history.mjs` exposes `practiceResultHistory.list(ownerId)` and an injectable `createPracticeResultHistory({storage, now, maxEntries})`. Results use separate account/match keys, retain the first timestamp, reject conflicting identities/outcomes, and retain at most 50 valid results per account. Declared deck lists retain names, quantities, commander declarations and printing/finish fields; the full original-input digest identifies the captured revision. Profiles, credentials, engine saves, hidden game zones and library ordering are never stored. Data is local to this browser, not cloud-synced or tamper-proof match evidence.

`createPracticeFlow` publishes `history.state` as `not-recorded`, `saved` (with result) or `unavailable`. `listHistory()` reads the currently active account. Storage failures do not change an engine winner or convert a finished game into an error. Retired account/session callbacks cannot write history. Detaching does not erase the completed summary and does not create a result for an unfinished match.

Additional verification: `node --test experiments/phase-engine/test-practice-result-history.mjs experiments/phase-engine/test-practice-flow.mjs` — 27 PASS (7 history checks, 20 flow checks), including reopened handles, duplicate writes, original printing snapshots after source edits, account separation, bounded pruning, corrupt rows, storage failure, stale account and failed authority.

The earlier persisted-history gap is now implemented at the host-storage/flow layer. Root integration binds ending text and recent exact deck lists on the result screen; browser acceptance is recorded separately. Add `practice-result-history.mjs` to asset/service-worker packaging along with `match-result.mjs`. The separate CPU forfeiture-clock gap remains unchanged.
