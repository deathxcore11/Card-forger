# CardStashy Forge private host service — local implementation candidate

This is an **isolated overlay**, not a deployment and not a second account or
deck system. The original app Worker and original HOST packages were not edited.
It reuses the app's actual `createSupabaseBearerVerifier`, existing public account
configuration and snapshot-aware HOST001 modules. There is no new persistent
secret, service-role key, account table or deck store.

## Executable path

1. Existing app `worker.js` forwards only the gameplay inventory through private
   `FORGE_HOST` service binding, preserving the real account bearer and origin.
   `src/app-route.mjs` is the integration helper; unrelated routes return `null`.
2. Host authenticates every operation with the existing Supabase `/auth/v1/user`
   verifier. Global `ForgeAdmission` authenticates create again, checks explicit
   trial allowlist/window/attempt limits, and atomically reserves provisional
   capacity **and** cumulative runtime allowance. Two global/one-per-user limits.
3. `ProvisionalAdmissionLedger` reuses HOST snapshot transport validation and
   canonical digests, keeping `cards`, `qty`, commander designations, printing,
   finish and import metadata unchanged. A provisional lease asserts **no**
   legality or executable support. Native authority decides those in step 5.
4. A random, never-reused `ForgeMatchContainer` DO persists startup before calling
   direct `ctx.container.start()` exactly once, with egress disabled and a fixed
   absolute deadline. Startup RPC loss is reconciled against that same ID; never
   restarted. `Container.fetch`/auto-start helpers are never used.
5. `container/bootstrap.py` listens privately on 8080, authenticates a generated
   per-allocation internal capability, accepts one bounded `POST /initialize`,
   writes byte-preserved `{input}` to fixed private
   `/run/cardstashy/match-input.json`, then execs the existing gateway. The exact
   gateway **must** reject an old alias-only image using its reviewed immutable
   manifest capability/source hash gate and `-Dproof.requireExact=true`.
6. The **same JVM** resolves and validates the actual snapshots, verifies the
   registered/instantiated roster and starts the native match. Only a complete
   `/state.initialization` receipt with matching source/request digests, engine,
   policy, verified flags and human viewer identity makes the match playable.
   No extra validator service or second JVM is required. Invalid decks close the
   allocation; their bounded native error findings remain owner-only.
7. State/action use only `getTcpPort(8080)` on an existing running instance,
   epoch-fenced by HOST's gateway/driver. Initialization rosters are removed
   before returning the native viewer projection to the browser. Command receipts
   precede dispatch; ambiguous commands stay pending and are never retried.
8. Close/expiry first persist tombstones, then await direct provider destruction.
   Global release independently requests the recorded DO's confirmed destruction
   proof. Failed destruction retains capacity and alarms retry cleanup—not start.
   Rules-provided terminal summaries remain owner-readable for 24 hours; no full
   board is retained. After pruning, only an irreversible opaque ID/generation
   tombstone remains, with no owner ID, token, deck or command payload.

## Required integration (not configured here)

- Apply HOST hardening, then the separate exact-launcher patch supplied by the
  hosting owner. Neither the frozen Java checkpoint nor an env flag alone is
  enough. Approve/pin the newly tested adapter and image manifest deliberately.
- Include `container/bootstrap.py` at `/opt/host-service/bootstrap.py` in that
  exact-capable image. `container/Dockerfile.extend` can layer it over an explicitly
  supplied digest-pinned base image. No image was built or registry-pushed here.
- Replace `REQUIRED_ACCOUNT`/zero image digest in `wrangler.jsonc` with the actual
  reviewed image. Keep `scheduling_policy: default`, not `durable_object`; the
  latter does not support `max_instances`. Do not add a public host route,
  workers.dev URL, preview URL or public container URL.
- Existing app Wrangler adds
  `{"services":[{"binding":"FORGE_HOST","service":"cardstashy-forge-host"}]}`
  and calls `proxyForgePlayRequest(request, env)` before its native AI inventory
  gate. Do not replace existing bindings, asset settings, auth or routes.
- The source currently accepts Commander/Standard/Modern **transport**; that is
  not a claim of native support. Real initialization currently requires the exact
  Java `forge-default-smart-v1`, Default AI/smart initial control policy. The reviewed
  native `controlMode` action accepts only `value: smart|full`, with revision,
  generation and epoch fences; native idle/Input checks remain authoritative. Native rejects
  unsupported formats/policies; no relabeling or starter/precon substitution.

### Trial controls

All values are non-secret configuration. Trial is **disabled** in the delivered
config. Do not guess an owner UUID; use the owner's verified existing account.

| Setting | Meaning |
| --- | --- |
| `FORGE_TRIAL_ENABLED` | Must be exactly `true` after review. |
| `FORGE_TRIAL_OWNER_IDS` | Explicit comma-separated verified account UUID allowlist, 1–10. |
| `FORGE_TRIAL_EXPIRES_AT` | Fixed ISO timestamp, future and at most seven days out. |
| `FORGE_TRIAL_MATCH_MS` | Maximum allocation lifetime; default 900000, reviewed upper bound 7200000. |
| `FORGE_TRIAL_RUNTIME_BUDGET_MS` | Cumulative prepaid allocation runtime; default 3600000, upper bound 28800000. |
| `FORGE_TRIAL_MAX_RESERVATIONS` | Cumulative startup cap, default/maximum four. |

Each new provisional reservation charges its entire maximum lifetime **plus
7000 ms cleanup headroom** in the same transaction as the lease. Invalid decks,
interrupted startups and closed matches do not refund it. Replay does not charge
again. Counters survive deploy/reconstruction; changing expiry cannot reset them.
The runtime budget can limit starts below four (e.g. four 15-minute allocations
plus cleanup exceed the default one-hour budget). One match can never outlive the
trial expiry; gateway independently enforces the absolute deadline. Expiry is
**interruption**, never a game loss or player turn timer.

These are conservative resource controls, **not a dollar invoice ceiling**.
Provider teardown/placement overhead, account plan fees, other Cloudflare usage
and GitHub builds are outside this ledger. The approved combined $20/seven-day
trial still requires account usage/resource measurement and remaining-budget
review before enabling any run. No billing configuration or paid run happened.

## Local verification

Node 24.22.1; Wrangler **4.152.0** pinned with lockfile. No runtime SDK dependency
is needed: current Cloudflare direct Durable Object Container API is used.

```
npm ci --ignore-scripts
npm run check
npm run test:bootstrap
npm run dry-run
npm run test:runtime
npm run deployment-ready   # intentionally fails until reviewed config/image
```

`test:runtime` needs the dry-run bundle. It runs actual local workerd/SQLite DOs,
replacing only Supabase HTTP with a fixture. It proves auth routing/private
unknown-match/disabled-trial behavior, **not** live identity, Containers or Forge.
The Node lifecycle tests (including the vendored HOST suites) use explicit in-memory/provider transport fixtures, not
replacement card rules. Python tests exercise actual localhost bootstrap HTTP
and fixed-file behavior. See `evidence/` for exact outputs.

A network-denied Wrangler dry-run succeeds with zero network connection attempts;
that validates bundling and provider schema, not the placeholder image or account
eligibility. Docker is unavailable here. No live Worker, namespace, credentials,
registry, repository or billing state was changed.

## Sources / provenance

- Existing app auth and service policy fetched from `deathxcore11/Card-forger`
  commit `7a91d7757ff1ac7e1d83a904a294b48a44ed1f32`.
  Auth blob `0fab55e2c439219148268071f33e11bf2ac49b52`; verifier unchanged.
- HOST001 frozen/v3 snapshot-aware admission plus reviewed lifecycle hardening.
  Reviewed admission transport includes Modern syntax without claiming native format support.
  `src/provisional-ledger.mjs` makes the superseding one-JVM provisional-resource
  distinction explicit; it does not pretend the old `admitExact` was satisfied.
- [Direct Durable Object Container API](https://developers.cloudflare.com/containers/api/durable-object-container/)
- [Cloudflare Containers configuration](https://developers.cloudflare.com/workers/wrangler/configuration/#containers)
- [Supabase authoritative getUser](https://supabase.com/docs/reference/javascript/auth-getuser)

## Full local chain and prepared exact build context

`evidence/full-local-chain.log` now records an actual, non-simulated JVM chain:
bootstrap HTTP -> exact private file -> frozen0146 Java -> exact-gated Python
`gateway.main` -> host `nativeAdapter`/`GatewayDriver` over HTTP. Source digests
and both roster flags passed; an engine-offered startup reply returned202 and its
duplicate409. JVM termination was confirmed. Only immutable deployment paths and
ports were substituted for the local test; no Docker/Cloudflare claim is made.
The first test exposed a missing LOCAL path substitution for Java's fixed input
property; the harness was corrected, with no accepted production code changed.

The repeatable `scripts/local-chain.py` takes existing Forge proof assets, the
frozen exact candidate, the exact gateway path and existing snapshot envelope.
It compiles into a fresh private directory, never mutates those source inputs,
and deletes its input/capability/runtime on completion.

`scripts/compose-exact-context.py` verifies explicit native-manifest and gateway
SHA256 pins, copies only allowed inputs, includes all three required Java source
files, compiles them together, and composes bootstrap at the exact provider
entrypoint. `build-context-exact-0146/` is prepared with verified hashes, not built.
Its `BUILD_IMAGE` and `RUNTIME_IMAGE` Docker ARGs deliberately have no defaults;
reviewed digest-pinned bases are still required for the later image build.

## Remaining release proof

Reviewed image build and digest,
resource/cold-start measurements, provider runtime/alarms/teardown, account/plan
access, signed-in browser ownership/hidden-information acceptance, app route/UI
integration and explicitly configured bounded trial are still required. A local
bundle or transport fixture is never evidence those checks passed.

### Proposed bounded Docker proof (not run or published)

`scripts/docker-proof.sh` contains one build and one offline container run. It
requires explicit `FORGE_PROOF_REVIEWED_NATIVE_SHA256` matching the reviewed0146
source before even checking Docker. Build timeout is1200 seconds, runtime
absolute deadline180 seconds, runtime client timeout150 seconds; cleanup always
removes the container and private request/capability directory. Runtime limits
are4GiB RAM with4GiB total RAM+swap,0.5CPU,256PIDs, read-only root, bounded tmpfs, dropped capabilities,
no-new-privileges and `--network none`. Localhost HTTP runs inside that already
allocated container; there is no validator JVM, image push or deployment.

Pinned linux/amd64 inputs supplied by the integration owner's official Docker
Hub tag audit (actual image build must still resolve/verify these):

- `maven:3.9.11-eclipse-temurin-21@sha256:463a1849665463254b2dd56e3a5b316f1596bc93d0571065c06ea05bb48ab8f4`
- `eclipse-temurin:21-jre-jammy@sha256:8ecbec1f32912979c15b86aaf98f7082a77d318a7f92af3d9fe2c0fd2723df10`

The proposed `.github/workflows/forge-host-docker-proof.yml` is manual-only,
read-only GitHub permissions, immutable action pins, one25-minute job and one
concurrency group. It has not been published/dispatched. The integration owner
may instead transplant its single step into the already isolated proof branch
CI, retaining that branch's existing deployment guard. Normal application/default
branch workflows are not changed by this overlay.

Only sanitized build-summary/hash/image-size/resource/result/stop evidence is uploaded; raw build logs stay in the private temporary directory and are removed. Graceful proof requires exact exit0 and OOMKilled=false after a10second stop allowance. Never upload
a capability file, environment dump, raw snapshot, runtime directory or connection
record. No Docker proof success is asserted until the actual run exits successfully.
