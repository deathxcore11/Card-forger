# Proof branch: deliberate Cloudflare deployment failure

**Never merge this proof branch, its replacement CI workflow, or its root
`wrangler.jsonc` into production.** This is a durable development checkpoint,
not a deployable release. The production branch and its original configuration
remain unchanged at the recorded baseline commit.

The proof workflow triggers one standard Linux job on
`codex/forge-native-browser-proof-20261026`. A Cloudflare Git hook may independently
attempt a build. Root `wrangler.jsonc` intentionally points both `main` and
`assets.directory` at absent `__FORGE_BROWSER_PROOF_DO_NOT_DEPLOY__` paths; its
workers.dev and preview-URL toggles are false. An explicit empty previews block
prevents the current CLI from consulting remote Preview base settings.

## Local guard verification, 2026-10-26

Wrangler was installed locally from the npm registry at exact version **4.152.0**,
with install lifecycle scripts disabled. No Cloudflare account credentials were
used. Production config Git blob at baseline:
`dba3fa0e9a8ee9ce913ddfeb0311ea0cfb5d7f2b`.

| Check | Observed result |
|---|---|
| `wrangler deploy --dry-run --config <proof-config>` | exit 1: intentional entry-point file not found |
| `wrangler versions upload --dry-run --config <proof-config>` | exit 1: same missing entry point |
| `wrangler preview --help` | CLI has no dry-run option; none invented |
| `wrangler preview` with empty HOME/XDG, fake noncredential placeholders and Node network APIs forcibly disabled | exit 1: same missing entry point; network attempt counter 0 |

The preview check was a strictly offline CLI validation: no real credentials,
account, upload or deployment. Inspection of the pinned CLI also confirms entry
resolution/build happens before its Preview deployment function. The same-job
browser script asserts these guard paths remain absent.

## Precise limit

This proves fail-before-upload behavior for the tested normal commands reading
this root config. It does **not** inspect or change Cloudflare account settings,
prove the external hook's exact command, or constrain a custom command that
deliberately selects another config or overrides both guarded entry/assets paths.
Do not represent an expected Cloudflare guard failure as an application failure
or a green release; review actual external checks after the checkpoint push.

GitHub compute is capped by one 20-minute standard Linux job (list-rate $0.12).
Artifacts are allowlisted, <=10 MiB total, retained one day. Root reserves $0.50
per attempt for combined GitHub plus a possible Cloudflare build; that is a
conservative task reservation, not a spending target or an account-wide cap.
Cloudflare's current Workers Builds limit is 20 minutes and paid overage is
$0.005/minute, so one such external build is at most $0.10 before allowances;
the external integration count is not exhaustively verified.

References:
- https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://docs.github.com/en/billing/reference/actions-runner-pricing
- https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
