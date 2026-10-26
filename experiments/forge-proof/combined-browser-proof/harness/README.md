# Payment-rejection continuation: source candidate awaiting browser proof

LOCAL_TEST_NOT_DEPLOYABLE. This is an isolated proof package, not a complete app
or production release. Production rollback and the deliberately broken deployment
paths in the proof branch must remain intact. Never merge that branch wholesale.

This continuation starts from the exact unpublished f81df780 commit, retaining
the integrated hosting alarm patch and native payment correction. Last published
proof: f17bbe49, run 40324277781. That run passed desktop and failed touch payment;
it does not validate this descendant. See PAYMENT-REJECTION-REVIEW.md for current
scope, evidence, source identities and remaining proof. No paid run or deployment
is authorized here. Historical run evidence is retained byte-for-byte.

This descendant adds a bounded human payment assessment, separate from CPU
strategy: AVAILABLE, PROVEN_UNAVAILABLE or UNKNOWN. UNKNOWN preserves priority;
timeout cannot mean empty. Native casting remains authoritative. It covers life
payment (including exact life), basic mana, fixed taxes/reductions and simple
mana sources. Unrelated battlefield-entry replacements do not create uncertainty.

Source/class manifests bind the human overlay. The build refuses a mismatch;
startup hashes the actually loaded classes. The same-image probe and each
allocation require the human receipt, unchanged CPU/rules and exact-deck receipts.
The separate four-file terminal-viewer overlay is integrated. Missing trusted
viewer identity remains unclassified. No persistent history is added.

fixtures/ContextualSmartChecks.java is local native fixture source. It covers
Gut Shot, insufficient/wrong-color mana, legal targets, alternative payments,
taxes/reductions, mandatory choices, Full Control, timeout and resource-state
preservation. It is not an injection endpoint or evidence of a browser game.

## Limits

This predictor is not a proof of every legal Magic action. Filter chains,
resource-consuming mana sources, dynamic costs and other unmodelled resource
interactions conservatively retain a window. Native enumeration/targeting also
have limits. Explicit phase-stop controls are absent from the current bridge
action contract and remain NOT TESTED. Full Control is tested separately.

The UI folder is a runtime subset, not a full app. The parent subset omitted
deck-viewer.css and value-page.css; both have now been restored byte-for-byte
from verified production 7a91d775 (also matching proof base c4981097). Provenance
is in evidence/recovered-css-provenance.json. No stubs or weakened request,
geometry or artwork gates are used.

The browser fixture uses existing Play handlers with synthetic account/storage
and the exact Calling All Angels and Keen Engineering saved inputs. It cycles
Easy/Hard/Medium menus, but only Medium native gameplay is exercised. Desktop
1440x1000 must finish naturally and create a new rematch allocation before
conceding game two. Touch 750x832 uses the shorter native flow. No whole-app boot,
real account, physical-device, imported/Meta match, Standard/Modern browser game
or Easy/Hard gameplay claim follows.

## Execution boundary

Use a dedicated disposable Linux amd64 CI runner and its exclusive Docker daemon.
Set FORGE_COMBINED_REVIEWED_MANIFEST_SHA256 to the exact harness/MANIFEST.json hash,
then run bash harness/run-combined.sh. The default candidate is the sibling
candidate directory. FORGE_COMBINED_CANDIDATE_ROOT permits verified relocation.

The job cap is 40 minutes; the proof-step cap is 38 minutes. A fixed absolute
cutoff reserves cleanup/upload time. Stages compete within that deadline. A case
that cannot fit is NOT TESTED, cleanup runs and the gate fails. Timeout, forced
termination or cleanup failure is never a game result. No automatic retry.

Build one immutable image and verify actual OCI config/layer bytes against Docker.
Use that same image for the Medium probe, desktop and touch. Local OCI test
identity is deliberately rejected by production policy; it is not registry
publication or deployment. Actual image compilation must reproduce the reviewed
class hashes. Never regenerate expectations after an unexplained mismatch.

Match containers are sequential, network-disabled, non-root, read-only, limited
to 0.5 CPU, 4 GiB memory/swap and 256 PIDs with bounded temporary filesystems.
Every allocation needs exact image identity, one start/destroy, graceful exit 0,
no OOM/forced stop, removal and confirmed private-input cleanup. Ambiguous
creation records survive until resolved. Only run-owned resources may be removed.

Browser requests allow fixture loopback and credential-free public card images.
Visible hand/HUDs, reachable 44px controls, compact dock geometry and loaded
artwork are gates. Privacy checks use the exact viewer body delivered to the UI.
Never inspect hidden hands/libraries to drive play.

Only publish-artifacts.py exposes an atomically validated sanitized directory:
allowlisted JSON and known PNGs, at most 10 MiB, retained one day. No tokens,
credentials, raw snapshots, private logs, source/OCI archives, environment files
or private policies belong in CI artifacts.

Authenticated registry/Cloudflare publication, live acceptance, three format and
difficulty pools, real accounts and history remain later gates.
See CONTROLLER-REFERENCE.md for the read-only Neo Forge comparison.
See CLEANUP-REVIEW.md for the three original cleanup failures, the defensive
correction, runtime-root repair and the mandatory pre-build process gate.
