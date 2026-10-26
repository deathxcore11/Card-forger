# LOCAL_TEST_NOT_DEPLOYABLE — executable local OCI test seam

**Implemented locally; synthetic/mock tests only. No Docker build, import,
container run, real attestation, policy, browser proof, publication or deployment
has occurred as part of this work. Root review is required before execution.**

## Identity and production isolation

The unchanged production release policy accepts genuine Cloudflare registry
manifest references. A local Docker image ID is a **config digest**, not an OCI
manifest digest and not registry publication evidence. This package never invents
a registry name or changes production acceptance. Local identity and policy have
explicit `LOCAL_TEST_NOT_DEPLOYABLE` schemas and no `containerImage` field.

`oci-identity.mjs` verifies actual OCI index/manifest/config/layer bytes, descriptor
sizes and hashes, and uncompressed layer diff IDs. An optional AbortSignal
interrupts metadata reads and streaming hash/decompression work, so the caller
can enforce the export/load stage deadline rather than checking it afterward. It binds inspected Docker
`.Id` to the config digest and `RootFS.Layers` to those diff IDs. It rejects
unsupported compression, external descriptors and blob/directory symlinks. Each
container must identify the same immutable image and required security bounds.
In-process branding rejects JSON-deserialized identities and policies.

`local-test-policy.mjs` validates extracted native source/checkpoint, build
attestation, runtime class index and a real initialization receipt from that same
image. It retains all 12 runtime class hashes, compiler/bytecode agreement with no
fallback, CPU policy and rules checks, exact source/manifest headers, epoch,
public input/deck digests, roster legality and viewer identity. The CPU/rules
predicate body is pinned verbatim to the reviewed production predicate. The
separate local identity check does not force the production registry check to
accept anything. Unit tests verify production policy and adapter reject the
local schema and no production selector imports this package.

`reviewed-host.mjs` verifies the complete host inventory before importing existing
production constants, policy selection, transport digest and private bootstrap
transport. Set `FORGE_COMBINED_CANDIDATE_ROOT` **before every package import**;
missing or blank input fails closed. No sibling candidate is guessed. Only a
candidate with the exact pinned host inventory is accepted.
Pinned `HOST-SHA256.json`: `46bfdbb36ead010d7fdcf6019049f1da402cd22920749beab8d5109ba49fd37d`.
Exports include `reviewedHostRoot` and `bootstrapTransport` for the build probe.
This environment path selects reviewed source location, never a production
adapter mode.

## Executable interfaces

```js
import { createDockerContainer } from './docker-provider.mjs';
import { createLocalNativeAdapter } from './local-native-adapter.mjs';
import { SCOPE } from './oci-identity.mjs';
const container = createDockerContainer({ identity, privateRoot, counters, id });
const adapter = createLocalNativeAdapter({
  identity, policy, localTestScope: SCOPE, serviceRoot
});
```

`identity` and `policy` must be reconstructed from actual image/probe evidence in
this process, not deserialized policy JSON. `privateRoot` must already exist and
be a private nonsymlink directory. `id` is a unique bounded allocation ID.
`serviceRoot` defaults to, and must equal, the fully verified reviewed host root.
The local adapter preserves the production-compatible ready, admission,
startOptions, bootstrapExisting, startup-failure and confirmInitialization APIs.
It reuses the unchanged production private bootstrap transport; the host service,
gateway and native engine are not modified by this seam.

Provider exports `createDockerContainer` and alias `makeDockerProvider`:
- `start(options)` returns void and starts exactly one recorded allocation. Fetch
  observes that original asynchronous startup; it never creates or retries it.
- `getTcpPort(8080).fetch(Request)` forwards only GET bootstrap-ready/ready/state
  and POST initialize/action to the recorded container. No generic proxy or
  native state injection API exists.
- `setInactivityTimeout(600000)` enforces the existing bound; the absolute deadline
  is at most 15 minutes. Observer-cache traffic does not call this provider.
- `inspect()` returns only filtered metadata, never environment values.
- `extractImageArtifacts()` reads only bridge source, checkpoint manifest, image
  build attestation and runtime index through fixed Python code in the recorded
  running image. It returns bounded byte buffers; no raw Docker inspect is saved.
- `destroy()` is idempotent, waits for the original startup (including ambiguous
  create), stops the exact allocation, inspects actual final status, removes it,
  confirms absence and removes private inputs. Forced cleanup remains failure
  evidence, never a graceful pass.
- `evidence().cleanup` includes actual `status`, `imageId`, `containerId`,
  `exitCode`, `oomKilled`, `forced`, `starts`, `destroys`, `confirmed`, `removed`
  and `privateInputRemoved`. Successful running allocations require exited/0,
  OOM false, forced false and exact expected counts in the caller's final gate.

Every container has local-test scope/allocation labels and is created by immutable
config ID with network none, read-only rootfs, user10001:10001, memory/swap4GiB,
CPU0.5, PIDs256, cap-dropALL and no-new-privileges. Writable space is only bounded
`/run/cardstashy` tmpfs512MiB uid/gid10001 mode0700 and `/tmp` tmpfs64MiB mode1777.
Both are noexec,nosuid. No ports or host directories are mounted. The reviewed
bootstrap entrypoint remains unchanged.

`relay-http.py` runs as fixed Python through typed `docker exec` arguments and
JSON stdin inside that network-none container, connecting only to127.0.0.1:8080.
The relay has an exact method/path/header allowlist, bounded request body,
4.5-second HTTP deadline and4MiB response cap. It preserves native response
status, epoch/source/manifest headers and bytes. Tokens and requests never enter
command argv or diagnostics. Docker calls use no shell interpolation. Neither
initialize nor action is retried after uncertainty.

## Ownership ledger and outer cleanup

Before Docker create, the provider atomically writes mode0600
`<privateRoot>/<id>/container-ledger.json`, recording unique name, scope, allocation
and immutable image. It persists `create-pending` before invoking Docker. Immediately upon a successful create receipt with a valid ID it writes actual
container ID and `createAcknowledged:true` before start. A failed, killed,
nonzero or malformed create receipt leaves `createAcknowledged:false`. A lost create receipt can be reconciled only by that unique
owned name with exact matching scope/allocation/image. If that inspection is
absent before acknowledgement, cleanup remains UNCONFIRMED and the ledger is
retained: the daemon can still commit after the CLI terminates. Neither provider
nor outer cleanup treats a single absence as cancellation. A later observed
exact owned allocation is durably bound by container ID (`observed`) before
stop/removal, without creating or starting another.
The private capability
file is removed immediately after create, even on failure.

After fixture/probe termination, the outer EXIT trap must run:

```sh
node local-oci/cleanup-owned.mjs /explicit/private/work/root
```

The bounded scanner reads only its owned ledgers; it does not list or prune
Docker globally. Cleanup verifies exact ID (or planned unique name), image and
labels before stopping/removing. Mismatch or uncertain inspection fails closed
with nonzero status, never deletion of an unrelated container. It confirms
removal and deletes that allocation's private directory. The caller must preserve
private work and the ledger on nonzero cleanup; it must not erase uncertainty
with unconditional directory deletion. Outer cleanup is a
safety fallback, not a substitute for successful host lifecycle receipts.

## Integration and remaining review gates

Sibling `image-stages` owns build/export/probe and evidence-bundle loading. The
intended chain is one reviewed context build, export immutable image config and
layer bytes, construct/verify a legitimate OCI layout, run a bounded real probe
using this provider, extract the four image files, validate the actual receipt,
confirm destruction, and reconstruct branded objects from retained private
actual evidence before the browser fixture. No local JVM attestation may be
copied into the image. Serialized policy alone never grants a local permit.

Expected native allocations: probe1 + desktop natural-game/rematch2 + touch1 =4,
sequential with confirmed cleanup. All browser allocations must use that same
immutable image; no rebuild/recompile fallback. Root must review combined source,
image-stage provenance, fixture integration, runtime budget and artifact privacy
before execution. Pure helper validation cannot authenticate a caller's claim
that supplied bytes came from a real image; the reviewed provider/orchestrator
establishes that provenance. Inputs are trusted local orchestration, not browser
supplied JSON. Raw receipts, request bodies, capability files and full image
inspection must not become uploaded artifacts.

A passing local run would not prove registry ownership, Cloudflare deployment or
production rollout. Prior Docker/native or static checks do not substitute for
this exact source/image, complete natural game/rematch, visual readiness or
lawful visibility proof. Timeout/OOM/interruption is never a game outcome.

## Mock-only verification

```sh
FORGE_COMBINED_CANDIDATE_ROOT=/explicit/reviewed/candidate node --test test-local-oci.mjs test-provider.mjs
python test-relay.py
```

Tests use explicitly synthetic OCI, container and receipt data plus mocked Docker
and HTTP calls; they execute no Docker command, network socket or native JVM.
The current suite passes 20 JavaScript and 4 Python tests.
They cover content identity, production rejection, full CPU/rules mutation gates,
exact initialization metadata, constrained arguments, private ledger, route and
body limits, response headers/status, startup/destroy races, ambiguous create
without retry, forced cleanup disclosure and ownership mismatch refusal.
These establish code behavior, not real compiler/runtime/browser readiness.

Relocation check: the copied package also passed all 20 JavaScript tests against
a minimal relocated candidate with no previous-candidate sibling, once with only
`build-context/native/cpu/runtime-sha256.json` and once with only
`native/cpu/runtime-sha256.json`. Test imports use the verified host root; the
selected runtime index must match the exact reviewed class-set digest.
