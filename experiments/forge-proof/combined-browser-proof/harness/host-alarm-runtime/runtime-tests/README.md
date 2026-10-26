# Local workerd / SQLite alarm regression proof

Run from the support-work directory:

```sh
timeout 30s node runtime-tests/run-alarms.mjs
```

The runner resolves `miniflare`, `workerd`, and `esbuild` from the sibling
`runtime-tools/node_modules` installation created from the candidate's pinned
`wrangler@4.152.0`. It bundles `alarm-worker.mjs` with the unchanged adjacent
`host/src/service-core.mjs` in memory and executes an actual SQLite-backed
Durable Object in local workerd. It never deploys the Worker or runs a container.

For delivery beside a differently located source/dependency tree, set absolute
paths explicitly. The host tree must include `src/service-core.mjs` and its
imports; the tools tree must contain the installed pinned Node dependencies.

```sh
HOST_SOURCE_ROOT=/absolute/candidate/host RUNTIME_TOOLS_ROOT=/absolute/runtime-tools timeout 30s node runtime-tests/run-alarms.mjs
```

The defaults are `../host` and `../runtime-tools`, relative to this runner's
directory. The optional host path changes both esbuild's exact service import
and the production-source hash recorded in the evidence. Keep the external
30-second timeout so an unexpected regression cannot leave this runner waiting
indefinitely for the controlled interleaving.

Six cases exercise the actual `AdmissionService` scheduling code:

- Invalid input preserves an earlier cleanup alarm.
- A first valid synthetic admission creates its wakeup.
- Admission advances a later housekeeping alarm.
- Admission preserves an equal alarm.
- Failure after transactional alarm and sibling data writes rolls both back in
  actual SQLite, with no lease, budget reservation, or synthetic begin.
- A maintenance pass paused before its final receipt read allows a separate DO
  fetch event to admit a lease; hourly housekeeping then preserves that earlier
  admission wakeup. The pause controls timing, while storage transactions and
  the distinct event handling run in real workerd.

Authentication and match operations are local synthetic bindings. Outbound
network calls are forbidden and counted. Future alarms are deliberately placed
ten minutes ahead so this test does not wait for wall-clock scheduling. These
checks prove storage/API compatibility and the named scheduling behaviors, not
live Cloudflare alarm delivery, provider cleanup, gameplay, account persistence,
or remote RPC cancellation.

`RESULTS.json` records the tested production source SHA-256, exact tool versions,
the six outcomes, and those limits. The separate Node tests cover five-second
remote-wait deadlines and late outcomes; this runner does not duplicate them.
