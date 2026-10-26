# First real-account Forge test

Production base: `7a91d7757ff1ac7e1d83a904a294b48a44ed1f32`. The recovered
25-file website overlay is preserved. Never merge the proof branch's invalid
root Wrangler configuration into production.

## Image and private host: deployed

GitHub Actions run **40377005373**, commit
`7ac2f452a6e79088e8482907683e0687bbdad480`, passed on Ubuntu 24.04 with Docker
28.0.4. Account access, source checks, native image build/probe, registry push,
cleanup, dry run and private host deployment passed. No image rebuild is needed.

- Image: `registry.cloudflare.com/463cf46936691d9c289153374d04c99e/cardstashy-forge@sha256:28ee1b2306e44aa13ab9d3f7263bf87dffff16626ea63b4680d1d7a586e6ef62`
- Image config: `sha256:7d3aa448cca1e42fb7918ffe8dbaac84c4575cf0137328caed28b891734451ed`
- Release policy SHA-256: `819c80cc4d7d5067dc25ee8dbcd56f84ada63db5e07ec8316254f05faacaae47`
- Worker version: `737a8dd0-71c6-4f89-931e-928d5e330dcd`
- Worker deployment: `310a728f-136a-4133-8136-a7c41525ea32`
- Container application: `a03baa00-b3ab-464a-b28f-fba4d8270428`

Cloudflare readback confirms the same digest, authenticated admission, one-hour
match ceiling, 8 reserved runtime-hours / 16 reservations per rolling day and
two containers maximum. These reservation bounds are not actual billing.
The API token stays in the repository Actions secret; never print or copy it.

## Website changes and evidence

Both whole decks get bounded artwork preparation before allocation. Missing art
does not change a list, substitute a printing or block Forge legality checks.
Account changes/cancellation prevent allocation. Artwork is frozen for play,
with no per-hand provider calls. The native asset parent is explicitly unignored.
All **67 focused website tests pass**, including the native app branch and exact
Standard/Modern/Commander transport. This is not live gameplay acceptance.

The acceptance Worker is prepared for only
`cardstashy.com/__forge-acceptance/*`. It binds privately to the Forge host and
uses `cardforge2` for unchanged static assets. It preserves the account origin,
strips credentials from static fallback, blocks unrelated APIs and refuses a
second service worker. It does not change the main website or bypass host auth.
Build with `node deploy/forge-acceptance/build.mjs`; compile its dedicated config
with pinned Wrangler 4.152.0. The dry run passed (776.45 KiB / 229.75 KiB gzip).
Only explicit UI overrides and reachable browser runtime modules are embedded.
Rollback is removal of the exact acceptance path route. The acceptance mount was deployed and verified in the browser (see
`evidence/deployment.json`). Signed-in gameplay remains unverified.

Randall requested the first test without waiting for difficulty calibration.
The policies are distinct: tactical/hold-unused-land chances are 10/0, 50/50
and 100/100 for Easy/Medium/Hard. Keep experimental labels; these are not proven
universal strength rankings. Medium remains the first browser-proven choice.

## Remaining work

The cloud browser currently has no signed-in CardStashy account. Use secure
browser authentication when needed; never request credentials in chat. Verify
an existing saved deck, selected CPU deck, real legal actions and terminal result
through the acceptance mount before replacing the main website. Persistent
account-backed match/deck-version history is unfinished and must remain labelled
unsaved. Broader format, natural touch finish and device recovery checks remain
open. APK work follows the website. Preserve the original successful browser
proof at `ea5b227`, run `40360492632`; do not redo its fixed payment investigation.
