# GitHub deployment continuation

Current deployment work is on `codex/forge-github-host-prep-20261026`, descended
from `add03f7df680ccd85da8932978f3968abfb39c40`. Preserve the original proof and
account-host branches. The account-host branch still contains the source-only
bootstrap deployment path; production remains `7a91d775`.

The user explicitly authorized continuation and necessary work/spending on
26 October 2026. Do not repeat the old one-attempt approval questions.

## Completed in this continuation

- Recovered all 504 relevant files from the exact published host tree and checked
  their Git blob hashes before editing.
- Preserved the original 25-file unpublished website overlay, baseline-checking
  apply script, 35-file checksum inventory and prior evidence under
  `deploy/website-overlay-20261026/`. Its original handoff is historical; this
  document adds the new build route. Restore that overlay onto production, never
  merge this branch's intentionally invalid root Wrangler configuration.
- Restored every overlay baseline against exact production and reran 53 focused
  Play tests: PASS. This is source/unit evidence, not browser/account acceptance.
- Added `.github/workflows/forge-host-deploy.yml`: Ubuntu 24.04, Node 24, locked
  Wrangler 4.152.0, one image build/probe, digest publication, private host deploy,
  32-minute job bound and 25-minute driver bound. No automatic retries.
- Added read-only credential preflight, with four regressions. All 193 host Node
  checks pass. Missing-secret CLI check fails before image build/deployment.
  YAML/branch/timeout/secret-order validation passes.
- Created only the preparation branch's preview exclusion: Worker `cardforge2`,
  preview `c73870cc386e414b877f63ee89e3f636`, `auto_build: false`. Production
  automation, other previews and the old private-host diagnostic are unchanged.

## Actual remaining access blocker

GitHub repository Actions settings visibly reported no repository or environment
secrets. Add `CLOUDFLARE_API_TOKEN` securely in the repository Actions secrets.
The token must be scoped to account `463cf46936691d9c289153374d04c99e`, with
permissions for the existing `cardstashy-forge-host` Worker deployment and
Workers Containers registry/application writes. The account ID is already fixed
in the workflow; no second account-ID secret is required. Do not put token values
in chat, source, job arguments, artifacts or ordinary logs.

The workflow verifies Worker settings and Containers reads before compiling.
Those checks do not certify write access; the actual publication/deploy must
still succeed. The linked ChatGPT Cloudflare connection does not implicitly
provide a secret to GitHub-hosted runners.

After the secret exists, validate the current preparation branch and start one
deliberate follow-up commit without `[skip ci]` on that branch. Do not advance
the original account-host branch or rerun the old missing-socket diagnostic.
The dedicated branch is outside its trigger, and its website preview is disabled.
Capture the actual image digest and Worker version from the resulting deployment,
then exercise the private host/account path before attaching the website.

## Evidence and outstanding release gates

The earlier proven Docker/browser route is run `40360492632` at `ea5b227`, not a
newly published image. No image or game was built during this continuation.
No Cloudflare container application existed at the latest check. The real host
deployment, signed-in full website acceptance, artwork preparation, durable
results/history and remaining device/format gameplay checks are unfinished.

No starter-only allowlist or deck substitution may be added. Preserve exact saved,
imported and found deck snapshots in Standard, Modern and Commander.

## Approval-review and API events

Automatic approval review rejected a wildcard pause of the old host trigger and
advancing its attached account-host branch. Neither action occurred. A narrower
single-branch exclusion attempt was allowed by review but rejected by Cloudflare
with HTTP 400; subsequent readback confirmed unchanged settings. The supported
alternative is the separate preparation branch with only its own website preview
disabled. No pending broad build-setting change is required for that route.
