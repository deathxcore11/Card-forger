# Actual local-image build/export/probe stages — not yet executed

`build-and-probe.sh CANDIDATE_ROOT PRIVATE_WORK [PUBLIC_FIXTURE_DECKS]` is an
executable proposal for parent source review. It requires the outer reviewed
package-manifest environment gate. It has **not** built/run Docker, published,
deployed, contacted an account, or minted real runtime evidence in this task.

## Stage boundaries and outputs

1. Verify exact frozen final native inventory/source, entire host inventory and
   image context, rejecting extra files and every symlink recursively. Build exactly once from the pinned Maven/Temurin base digests.
   Docker returns an immutable local **config** digest, not a registry digest.
   Build cap600s; raw build output is capped50MiB in a private runner directory.
2. Within90s total, save that exact local image ID, convert its actual config and
   uncompressed Docker-save layer bytes to a standards-shaped OCI layout, hash
   every blob and diff ID, and compare with current Docker image inspect. The
   manifest is an actual locally constructed OCI content object; it is explicitly
   NOT a Cloudflare registry manifest or an assertion of registry publication.
   Conversion never calls `tar.extract`; all referenced members must be regular,
   relative, bounded, unique and content-matching. Save archive limit8GiB; image
   limit6GiB; free-space gate accounts for both export copies. Private export is
   never an upload artifact. The temporary Docker-save archive is removed.
3. A separate non-browser probe container starts from that same immutable config
   ID with network disabled, read-only root,0.5CPU,4GiB memory/swap,256PIDs and
   explicit bounded writable tmpfs. It uses actual Medium-beta and exact public
   Angels/Keen input, the existing bootstrap transport and actual fresh native
   source/CPU/rules/roster/epoch headers. It does NOT call the old Default-only
   initialization validator. Work budget120s plus up to60s cleanup reserve inside
   the180s stage; actual provider calls also have per-call deadlines.
4. Extract source/checkpoint/build-attestation/runtime-index bytes only from the
   recorded container using the fixed provider allowlist. Strictly validate those
   actual bytes and native receipt with the local OCI test-policy validator.
   Stop and remove that exact container, requiring graceful exit0, no OOM, no
   forced kill, one start/one destroy and confirmed private-input removal.
5. Write `evidence-bundle.json` only after successful proof/cleanup. Private
   capsule fields contain only native schema/revision/status/viewer and exact
   initialization metadata; there is no board/hand snapshot, token or environment.
   The public fixture input is reconstructed from its hash-bound source reference,
   rather than retaining the ephemeral initialization POST/capability file.

Parent artifact collector may retain ONLY `image-summary.json` and
`probe-summary.json`. The bundle, OCI layout, source/build metadata, exact probe
capsule, Docker-save archive and logs remain runner-private, then are deleted.
No image/source archive is uploaded. Failure summaries do not print raw exception
messages or stdout/stderr. Local image removal after browser cases is the parent
cleanup's responsibility; failed preparation attempts remove their image best-effort.

## Fixture loader contract

`loadEvidenceBundle(bundlePath,{serviceRoot})` returns
`{identity,policy,sourceIdentity}`. It rehashes the public/native/host/private
metadata and entire OCI layout, performs a fresh Docker image inspect, verifies
actual historical probe/container cleanup and reconstructs in-process branded
local policy. A serialized policy is never accepted. Both separate desktop and
Touch fixture processes may load the SAME job's actual bundle without another
runtime probe; each new browser allocation still performs fresh exact native
initialization/CPU/rules checks in the same image.

The loader is a local trusted-fixture boundary, not a signature that authenticates
arbitrary caller-created files. Bundle paths must come from this same reviewed
job/workspace. Root source review and exact source hashes remain required.

## Ownership and cleanup

Before any build subprocess, this stage writes a new mode0600 immutable
`image-ownership.json` (`cardstashy.local-image-ownership.v1`) with a random
256-bit `jobNonce`, exact source/context hashes and
`labelKey=io.cardstashy.local-test.job-nonce`. The build adds that exact nonce
using `--label`, so an otherwise identical source-cache image is not mistaken
for a job-owned output. Fresh build inspection, every bundle loader and failed
stage image-removal attempt require the actual config label to match the private
ledger. This extra local label changes the actual config/image/OCI identity; it
changes no source, CPU policy or production image acceptance semantics.

Outer final cleanup must call `readImageOwnershipLedger(work)` then
`assertImageOwnership(ledger,inspect,imageId)`, with `inspect.JobNonce` taken
from that exact label, in addition to its exact source/native-manifest label
checks. Missing ledger cannot authorize removal. Ledger present but missing
`image.id` means **uncertain build outcome**, never “no image created”: killing
a Docker CLI does not prove that its daemon-side build stopped. Retain that
private ledger until cleanup/failure accounting is complete. A failed stage
retains `imageRemovalConfirmed:false`; outer cleanup must independently confirm
absence by exact ID rather than treating an inspect failure as absence.

Execution prerequisite: a dedicated disposable CI runner Docker daemon, whose
teardown disposes residual builds/cache after the job. This proposal does not
certify daemon-side build cancellation or build-cache removal after CLI timeout.
Do not run against a shared/persistent daemon without a separately reviewed
bounded build-cancellation and daemon-cleanup design.

The sibling local-OCI provider records each owned container before starting it.
Parent EXIT/TERM cleanup must run its `cleanup-owned.mjs` against the whole
private work root even if this subprocess times out. Provider identity/labels
are checked before destructive cleanup; no unrelated Docker object is removed.
This stage does not use registry pushes, mutable tags, Docker login or remote
image names for generated output. Containers are reachable only via the bounded
in-container loopback HTTP relay; runtime internet remains disabled.

## Remaining verification

Five safe-archive tests and ten local source/input/capsule/cleanup/mock-failure/
command/integration test groups pass. The synthetic integration group verifies
probe → minimal private receipt → freshly branded loader and rejects a forced
cleanup while preserving a failed sanitized summary. Those are synthetic/static unit evidence, NOT an actual OCI
image build or native runtime proof. The composed executable still requires an
independent review, parent approval, runner Docker/BuildKit compatibility, actual
strict JDK bytecode match, same-image probe, and final browser acceptance. Missing
or invalid evidence must stop; it cannot generate a placeholder policy.

## Portable local test input

The Node tests require explicit `FORGE_COMBINED_CANDIDATE_ROOT`; they use the
hash-verifying reviewed-host relocation helper, not an old sibling checkout.
The synthetic runtime class index is read from exact
`build-context/native/cpu/runtime-sha256.json` first; a native-only fixture may
supply `native/cpu/runtime-sha256.json`. Both must match the reviewed class-set
hash. Relocation was verified with only the exact 0640 host inventory/context,
native SHA256SUMS + bridge and public UI fixture-decks JSON—no 0620 sibling.
