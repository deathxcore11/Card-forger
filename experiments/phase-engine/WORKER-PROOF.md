# Browser authority experiment

Development on the dedicated Play branch, starting at `875e3fc7e9f41f53f37520a974010ae2d0885b04`.
This is the next engine-proof slice, before the integrated Play interface.

`browser-authority.mjs` owns the pinned Phase WASM instance, legal actions,
raw events and engine save. It loads the same checksummed external fixture and
unequal Forest/Bears lists as the original Node diagnostic. The main thread
receives a narrow status packet: revision, turn, pending-choice type and terminal
winner. It never receives the engine save or raw legal-action/event stream.
This is a diagnostic interface, not the future seat-scoped board observation.

A separate policy worker receives only action type, keep flag and attack/block
counts, plus an independent policy RNG. It reproduces the original ungraded
smoke policy. Object handles, card identities, hidden hands, library order,
engine RNG and raw saves are absent from its packet. This deliberate limited
input does not provide contextual strategy, difficulty levels or general
hidden-world equivalence proof for the engine's legal-action generator.

## Commit and recovery contract

- Each worker binds once to a match and fresh session epoch. Commands serialize.
- Step requests carry a stable ID and expected revision. The authority checks
  current actor and exact legal membership again before submitting.
- A successful move's engine save, policy RNG, accepted trace, revision and
  request receipt commit together in one IndexedDB transaction before reply.
- Duplicate IDs return their original receipt. An ID with different content,
  stale revision or old session epoch rejects without applying a move.
- The transaction compares the durable revision, preventing two workers/tabs
  from overwriting a match based on the same saved position.
- Failed application/persistence restores the last acknowledged in-memory save
  and marks the worker for recovery. Recovery reloads the durable record.
- A timeout terminates the worker and reports an unknown outcome. It never
  claims rollback or automatically retries. A new worker can resume and resend
  the **same** command ID to discover the durable result.
- No posted cancellation can interrupt synchronous WASM. Termination discards
  the worker; the last transaction determines the recoverable position.

The record is research schema 1, with an explicit adapter/policy version. This
slice stores one complete record per accepted action and keeps receipts for the
20,000-action diagnostic ceiling. Storage throughput and space need further
measurement/design for real supported decks and longer sessions. IndexedDB is
origin storage, not an isolation boundary against other same-origin JavaScript.
No private multiplayer security or production account separation is claimed.

## Run

External inputs and their hashes are listed in [README.md](README.md). Nothing
in this experiment downloads, commits or distributes the engine binary/data.

```sh
node --test experiments/phase-engine/test-worker-*.mjs

CARDSTASHY_PHASE_PKG=/absolute/path/to/pkg \
CARDSTASHY_PHASE_SOURCE=/absolute/path/to/phase \
CARDSTASHY_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
CARDSTASHY_CHROMIUM_PATH=/absolute/path/to/chromium \
node experiments/phase-engine/browser-smoke.mjs
```

The optional browser runner serves an allowlisted diagnostic origin on
localhost. It creates a unique browser profile under ignored
`test-results/phase-browser/`, installs an experiment-only service worker and
caches the exact fixture/runtime and test modules. It uses no app routes,
account, real collection, production service worker or external game service.
The optional executable override may be omitted with a normal Playwright
Chromium installation. `CODEX_PRIMARY_RUNTIME_NODE_MODULES` is an alternative
for locating the installed Playwright module.

Browser checks compare all six complete accepted traces/terminal outcomes to
the recorded Node baseline. The first case also checks duplicate, stale,
colliding and concurrent requests. The runner saves a Priority checkpoint at
revision 80, finishes the baseline, closes the entire browser, stops the server,
starts a fresh browser process with networking disabled and resumes the saved
match. It checks the exact complete trace/outcome and a repeated saved receipt,
and creates a new match using the offline package. Privileged test code reads
IndexedDB to compare traces; the application-facing client has no save export.

The output `browser-report.json` records exact module hashes, actual browser
version, per-case results and local timings. Timing is diagnostic-container
wall time including per-move durable writes; it is not user-device latency or
CPU playing-strength evidence. The committed captured report applies only to
its listed bytes.

## Next gates

This remains a Forest/Bears investigation, not an adopted runtime, shipping
format/pool, board, player-control path, match history or release. Priority is
the only cold-browser pending-choice restore covered here. Mandatory targets,
payment previews, stack automation, mulligan/bottom decisions, coins and the
known pregame Play/Draw gap need separate fixtures. This adapter intentionally
does not invoke a generic post-restore automation entry point without proving
its semantics for those pending states.

Still required: independent rules/tactical fixtures, actual supported lists,
full permitted-observation/reveal-history audit, fair contextual difficulties,
resource budgets, production package/update/eviction handling, idempotent
results, browser/device support and all visual/interaction requirements.
No lobby or board is enabled by this checkpoint. The website release and APK
remain separate work.

## Captured October 24 result

Passed with Chromium 153.0.8010.0: all six full matches matched the original
Node accepted-action hashes and terminal outcomes. A fresh browser process
resumed the revision-80 Priority checkpoint with the origin server stopped and
networking disabled; the full trace and outcome matched, the old receipt replayed
without a second move, and a new offline match reached its first accepted action.
See [the captured report](browser-evidence-2026-10-24.json) for module hashes.

Thirteen focused journal/client tests also passed, including failure rollback,
receipt recovery, concurrent writers, invalid proposals, old epochs, version
mismatch and timeout handling. The original six-case Node diagnostic was
reproduced successfully in this checkout. No whole-application regression run
is claimed for these isolated, unimported experiment additions.

The owner's new required mechanic coverage and inspected upstream sources are
tracked in [Play mechanics acceptance](../../docs/play-mechanics-acceptance.md).
Those source inspections are not runtime pass results for the named mechanics.
