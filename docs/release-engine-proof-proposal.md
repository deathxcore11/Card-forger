# One manual release-engine proof: prepared, not executed

This is a concrete proposed build action, not authorization to spend, proof of compilation, adoption of a runtime, or a production deployment. The owner's earlier no-paid-build constraint remains applicable until they approve this specific action.

## Exact action

Run **one** `macos-15-intel` GitHub Actions job through `.github/workflows/play-engine-release-proof.yml`, manually dispatched against the exact reviewed integration commit. The job has a **75-minute maximum** and its build script has a **70-minute overall deadline**. The coordinator selected this larger budget so both the new WASM proof and seven required native Rust assertions fit in one attempt; there is no automatic retry.

The dispatcher supplies the reviewed 40-character commit and `BUILD RELEASE ENGINE ONCE`. Both the workflow and script verify those inputs. The token has `contents: read`; checkout does not persist credentials. The workflow has no push, schedule, deployment or chained trigger. The script does not push, edit a branch, adopt runtime bytes or deploy.

## Source and checks

- Original upstream: `71ccd8fe1715c45fe9e9bd78d391bec5ac8a4234`.
- Original ninjutsu patch SHA-256: `b8a5b0efb91b10d8930252bfe522a07e8ba95030436aa5b5419478a42a2cdb5d`.
- Reconstructed shipped tree: `60fc8715ad91f5c91b81f8a8335e238c623ec957`.
- Combined atomicity and priority-capability patch SHA-256: `a1188d35bfb3905dae06e5fda8b6fa4ed0dbc4cd8d0dbe19ee574ba211afc343`.
- Exact candidate tree: `c8f2db24fd81f34821dddf69e5b7404fcf16412c`.
- Toolchain: `nightly-2026-04-19`; `wasm32-unknown-unknown`; wasm-bindgen CLI `0.2.121`.

The build verifies both patches and both source trees, retains the unchanged compiled-card fixture hash, and follows the historical single-job, low-memory WASM compiler flags. It generates a new WASM/glue package and requires seven real-runtime fixture groups: safe empty-window pass, viewer privacy, land/free-cast stops, Sol Ring/floating-mana stops, face-down/variable-X stops, engineered rejection atomicity, and rejection atomicity after a legal setup history. Every capability query compares the complete live save before and after. Both rejection assertions retain knowledge metadata. Seven native Rust capability tests are also mandatory; an exhausted budget is failure, not a skipped pass.

The artifact contains the compressed generated package, source patch, license notices, build receipt, bounded logs, regression results and SHA-256 inventory. It excludes the card database, Cargo/source caches and complete fixture game saves. Retention is one day; the upload is bounded to 256 MiB. The receipt always reports `releaseReady: false`, `adopted: false` and `deployed: false`: broader rules regressions, session integration, final browser acceptance and runtime packaging remain separate required steps. Rust formatting has not been executed in preparation and is not certified by this job.

## Cost and observed build resources

[GitHub's official runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing), checked October 25, 2026, lists standard Intel/M1 macOS at **$0.062/minute**. Seventy-five fully billable minutes would be **$4.65 in runner usage**, before account allowances and additional artifact storage. This is an estimate, not a guaranteed invoice or account spending cap. No billing balance or allowance has been inspected.

The existing successful historical proof ran on a 14 GiB `macos-15-intel` runner. Its script requires at least 12 GiB. Historical repository evidence records repeated LLVM OOM failures at an 8 GiB ceiling; this environment also has an 8 GiB effective limit. The 12 GiB value is an execution guard backed by those failures, not a universal proven compiler minimum. Details and exact evidence links are in `docs/evidence/engine-build-readiness.json`.

## Registration and approval are still required

As of preparation, this workflow is absent from the repository's default production branch. Adding it only to integration does **not** make it immediately dispatchable. GitHub's [manual-workflow guidance](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow) requires the workflow file to exist on the default branch.

The proposed bootstrap is a separately reviewed workflow-only default-branch registration, followed by manual dispatch selecting the integration ref and its exact reviewed commit. Before registration, the coordinator must account for the production branch's Cloudflare deployment trigger and existing push workflows. A skip-Actions commit marker does not itself prove Cloudflare will stay idle. Do not register if that would silently publish a partial release; use a controlled hosting pause or a separately approved build route. No registration, hosting change, paid job or dispatch occurred during preparation.

Re-running historical run `40153568000` is not a substitute: it uses old source and cannot apply these new patches.

## Preparation validation

`node --check` and the script's inert `--self-check` pass. Forward application of the combined patch against a fresh index of the shipped tree produces the exact candidate tree above. An ordinary script invocation is rejected before any build work. These are static preparation checks only. Native tests, WASM compilation and the generated-runtime assertions remain **NOT RUN**.
