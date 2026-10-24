# Ninjutsu source correction — blocked candidate, not verified runtime

**Open:** no corrected browser package exists. The earlier WASM build was
OOM-killed. The current source candidate also corrects the subsequently found
Satoru granted-keyword regression and has passed independent code review.
Native regression compilation is running; execution results remain pending.
Do not adopt the candidate or remove the original runtime failure assertions.

The [source patch](upstream/ninjutsu-stack-a49b8aa.patch) applies to Phase
`71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234` (0.117.0). It is a local research
correction, not an upstream release or an adopted CardStashy engine.

- Local candidate commit: `a49b8aa7a1fedb9743a2fd1f77b8c39e258ef6db`.
- Source tree: `60fc8715ad91f5c91b81f8a8335e238c623ec957`.
- Patch SHA-256: `b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d`.
- Sixteen changed paths: fifteen Rust source/test files and one supported
  append-only game protocol record. Full protocol 178; wire protocol 160.
- Preserve [Phase's MIT license](upstream/PHASE-LICENSE-MIT) and
  [source notice](upstream/PHASE-NOTICE). No engine binary or card-data bundle
  is distributed by this checkpoint.

## Corrected path and authored regressions

Ninjutsu pays its costs at announcement and creates a typed activated ability
on the actual rules stack. Resolution checks the exact source occurrence and
original defender, uses the existing zone-entry pipeline, and preserves
replacement/copy choices across saved continuations. Ability copies use their
actual controller and retain original source metadata. Copying does not grant
a new announcement reveal. The canonical activation event/journal allows
ordinary activation observers to see ninjutsu and to copy the exact activated
ability after it is countered.

Ten new integration tests are authored for response priority, saved pending
abilities, Stifle without refunded costs, source/defender leave-and-return,
legacy missing defender pins, actual copied abilities/reveal lifetime and
Rings of Brighthearth. Existing Kaito, combat and paused-entry tests now
explicitly resolve the stacked ability. An entry replacement test ensures
combat placement preserves the replacement's untapped result.

Satoru Umezawa's legitimate hand-keyword grant now shares the printed marker
builder, with runtime definitions appended identically to canonical enumeration
and indexed lookup. Existing marker occurrences retain their slots. Costs and
placement facts are bound before payment so returning Satoru as the cost does
not invalidate the announced activation. The new real-fixture regression
includes an actual Bolt response before Bears enters. A supplemental unit test
covers printed markers, distinct granted costs, index equality and expiry.
The printed builder logic/order is retained by extraction; full parser-output
projection has not run and no regenerated card bundle is claimed.

This is a description of the candidate implementation and intended tests,
not a claim those Rust behavioral assertions have passed.

## Evidence at the source checkpoint

- Patch applicability against the clean pinned base: passed `git apply --check`.
- Formatting and diff checks: passed on changed paths. Full workspace formatting
  passed on the first candidate; the following two-file correction passed its
  exact-path formatting check.
- New/changed CR annotations checked against the official September 25, 2026
  rules. Source fixture Oracle text was read; current Scryfall text was also
  checked for the principal Ninja, Yuriko, Stifle and copy cards.
- Independent review of the immutable base-to-candidate diff: no behavioral
  findings. Its completion gate is explicitly deferred to compilation/tests.
- Protocol generation/check and base-relative protocol check: passed.
- The first compile found two missing exhaustive Ninjutsu display matches in
  `derived_views.rs`. The correction adds ordinary/commander labels and an
  explicit empty target list; real activation tests inspect both viewers'
  filtered stack details. The corrected immutable diff was reviewed clean.
- Interaction-binding generation is inapplicable: its unchanged generator
  exports only unchanged `types::interaction` DTOs, excluding these stack and
  pending-completion payloads.
- Native behavioral tests and corrected-WASM mechanics: **pending**.

The updated mechanics harness selects twenty unchanged records from the same
6,137-record pinned fixture. Its fresh run against the original upstream
artifact has six passing cases and two intentionally preserved failures:
printed and Satoru-granted ninjutsu enter immediately without a stack entry.
The Satoru failure positively records that the grant was offered and accepted,
the four lands were paid and Satoru returned; it is not an unsupported-card
failure. See [baseline runtime evidence](mechanics-evidence-2026-10-24-reference20.json).

The original runtime's missing-stack ninjutsu assertion remains intact. Only
an actually rebuilt, newly identified runtime passing that regression can
close the runtime blocker.

## Memory-limited WASM attempt

Two earlier local LLVM builds exhausted the 8 GiB memory ceiling. This attempt
uses one Cargo job, 256 codegen units, no incremental state, opt/debug/LTO off,
and explicitly serializes the LLVM backend:

```text
RUSTFLAGS=-C link-arg=-z -C link-arg=stack-size=16777216
          -Zno-parallel-backend -Zmir-opt-level=0 -Zfewer-names=yes
          -Zthreads=1 -Ztime-passes=yes
cargo build --locked --offline -p engine-wasm
            --target wasm32-unknown-unknown --profile wasm-dev
```

The first source candidate (`c880f8c`) exited 101 for the two exhaustive-match
errors. It completed borrow checking with a reported 6,010 MB RSS and did not
increase the cgroup OOM-kill count. This does not establish LLVM code-generation
feasibility. The corrected candidate is now rebuilding in the same clean
separate completion worktree and target directory, with a twenty-minute bound.
The corrected `d64f609` attempt was killed by signal 9 after monomorphization
and metadata generation; the cgroup OOM-kill count increased from two to four.
Compiler reporting reached 7,751 MB RSS. No corrected WASM package was produced.
Further unchanged LLVM attempts are not justified under the same 8 GiB ceiling.
Native Cranelift remains a separate regression route after the granted-keyword
correction. Never relabel the original upstream artifact as this
build. If compilation succeeds, run wasm-bindgen 0.2.121 to a new package,
record the exact executable hashes, and exercise the mechanics suite using
the explicit receipt option below.

## Explicit local-build verification

`mechanics-inputs.mjs` retains its original pinned-artifact default. A new build
requires `CARDSTASHY_PHASE_BUILD_RECEIPT` naming a JSON file outside the source
checkout with these fields:

```json
{
  "schemaVersion": 1,
  "buildIdentity": "explicit local build label",
  "upstreamCommit": "pinned base SHA",
  "sourceCommit": "exact clean source commit SHA",
  "sourceTree": "exact source tree SHA",
  "sourceDiffSha256": "exact binary diff SHA-256",
  "glueSha256": "actual new glue SHA-256",
  "wasmSha256": "actual new WASM SHA-256",
  "integrationFixtureGzipSha256": "unchanged pinned fixture SHA-256"
}
```

Those are field descriptions, not a usable receipt. The loader checks actual
source ancestry/cleanliness, HEAD/tree, runtime/fixture hashes and the digest of:

```sh
git -c core.quotePath=true diff --binary --full-index --no-color \
  --no-ext-diff --no-textconv BASE_SHA HEAD --
```

Fresh-process restore inherits the explicit receipt and must reproduce the
same verified provenance. The receipt identifies supplied bytes and source;
it is not an authenticated assertion that compilation was correct. A receipt
is created only after a successful build and actual artifact hashing.

## Native regression prerequisite

The installed nightly native Cranelift backend is available as a separate
fallback. Eight missing development dependency archives were acquired from
official static.crates.io at their locked versions and verified against
`Cargo.lock`; offline metadata-only graphs for the integration and library-test
targets now pass. Native compilation is running on clean source `a49b8aa`;
no behavioral result is available yet.

Run sequentially after the WASM build exits, with a separate target directory,
one Cargo job, no incremental state, opt/debug/LTO off and 256 codegen units:

```text
RUSTFLAGS=-Zcodegen-backend=cranelift -Zmir-opt-level=0
          -Zfewer-names=yes -Zthreads=1
cargo test --locked --offline -p phase-engine
  --target x86_64-unknown-linux-gnu --features test-support
  --test integration 'ninjutsu_stack::' -- --test-threads=1
cargo test --locked --offline -p phase-engine
  --target x86_64-unknown-linux-gnu --features test-support
  --lib 'game::keywords::tests::' -- --test-threads=1
```

The selectors cover ten integration and 48 keyword unit tests. The additional
casting index test is a separate library-test selection. Filtering
execution does not shrink the compiled harness. A twenty-minute timeout is
inconclusive, and native success does not certify the WASM artifact.
