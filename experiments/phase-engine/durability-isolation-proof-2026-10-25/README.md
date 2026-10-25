# Real-payload crash isolation, October 25

Recovery remains blocked. These results do not certify offline matches.

The prior failing profile was inspected read-only before this run's changes,
with its service worker bypassed and no rules-engine loading. It contained
revision 216: the previous checkpoint harness had inspected 214 and then
loaded/resumed that record. This is not a reconstruction of acknowledged 301.
The exact exported record was retained locally as `actual-revision-216.json.gz`; it is excluded from the commit after automatic review rejected raw saved-match uploads.
`payload-identity.json` binds the uncompressed bytes and source profile/origin.
It contains simulated account/printing identifiers and a land-heavy control.

`practice-real-payload-crash-baseline.mjs` is the exact initial harness bound by
baseline-partial.json. With unchanged original practice-record.mjs, the window
case preserved revision 399 after SIGKILL. The worker case threw
`NotReadableError: Data lost due to missing file. Affected record should be
considered irrecoverable` on the cold read. Baseline evidence is incomplete,
not passed; the original harness stopped before its third case. There was no
WASM loading or engine gameplay in these storage-only tests. Repeated writes
use the same real journal payload and synthetic revision values, not a fabricated
accepted-action history or a resumable game.

The candidate practice-record.mjs gives each owned transaction a fresh connection,
closes it after transaction completion or failure, and retires a closed record
handle. Caller-injected databases stay caller-owned. Atomic whole records,
strict durability, compare-and-write, receipts, inputs and result semantics stay
unchanged. This is resource-lifetime hardening, NOT the recovery fix.

The updated harness captures read errors per case rather than losing the report.
The candidate worker-long case passed 399, but worker-rotate acknowledged 399
and recovered 368 with a different whole-record hash. Both used the same exact
payload and candidate module. This disproves a reliable connection-close fix.
No new cgroup OOM kill was observed (counter stayed 10). The failure does not
establish a browser, filesystem or runtime root cause, or other-device behavior.

Reproduce using an explicitly supplied exported TEST record and the recorded hashes.
Raw saved-match records are not included in this commit. The local input may not
survive workspace maintenance. No replacement or reconstruction is claimed.
Playwright and explicit local test Chromium are required by the process helper.

    CARDSTASHY_RECORD_PAYLOAD=/absolute/path/to/exported-test-record.json CARDSTASHY_STORAGE_MODES=worker-long,worker-rotate node experiments/phase-engine/practice-real-payload-crash-browser.mjs

The baseline harness needs the original practice-record.mjs from f5186f5a in
an isolated directory; running it against the candidate is not baseline evidence.
No engine binary or paid build is required for this reproduction.

The full real-engine checkpoint harness now captures acknowledged whole records
before termination and validates the cold digest BEFORE loading the engine.
It cannot advance a discrepant record and obscure the first failure. Existing
historical regression evidence is preserved. See final engine log/report and
scheduled-progress for the actual outcome of that separate run.
