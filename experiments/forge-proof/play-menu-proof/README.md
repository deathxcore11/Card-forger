# Existing Play-menu hosted browser proof — isolated branch only

This bundle is an orchestration layer, not a deployable release. Never merge the
proof workflow or root deployment guard. Production feature flags, original app
files, the frozen native 0146 checkpoint, and the prior container proof stay intact.

## What the one job exercises

Node 22 and Playwright 1.62.1 use the same pinned headless Chromium as the earlier
proof. Installation does not run apt upgrades; shared-library and real Chromium
launch/click/render checks must pass. One anonymous checkout of official Forge
`e5a0f8156da70ffc7866f923bed371c0111707cd` is compiled once. The frozen 0146
adapter is compiled by the unchanged fixture against that shared build.

The existing Play menu and mechanically extracted real app handlers select saved
Calling All Angels versus Keen Engineering, start the actual host/Forge match,
keep seven cards, play lands, cast Metallic Mimic through native payment and
choices, toggle Smart/Full, cancel exit, explicitly concede, await the native
result, clean up and navigate back to Play/Home. A separate 750×832 touch context
then repeats the same case **only after desktop and cleanup pass**. Touch uses
actual browser input, not force clicks or DOM-dispatched substitutes.

Concession is intentional lifecycle coverage, **not a natural full-game result**.
Synthetic account/auth/storage/provider boundaries and the isolated page shell
remain explicit. This is not full app boot, real Supabase login/cloud persistence,
real provider isolation, deployment, all difficulty levels, or physical-device
acceptance. Native legality/results are not mocked. Natural-terminal/rematch mode
is not enabled in this bounded run.

## Reproducible composition

`SOURCE-SHA256.json` binds the 17 unmodified owner-source inputs. `ci/prepare.py`
recreates the original sibling layout beneath `RUNNER_TEMP`; no 65 MB runtime is
committed. The tracked app archive excludes Git internals, untracked files,
tools/caches, logs, historical ZIP/APK bundles and backend proof directories.
Actual CSS/import dependencies remain included. Inspector/integration/fan/wide
and host-rematch patches apply with zero fuzz and verified input/output hashes.
Original source owners' browser/materializer/fixture logic is unchanged.

The original source/provenance and GPL license remain in `../native-exact-0146/`;
the inherited host package remains under `../hosting/cloudflare/`. No downloaded
browser, Maven dependency, JAR, source archive or credential is published here.

## Bounds and evidence

Exactly one Ubuntu 24.04 job, no matrix/PR/deployment, 20-minute job deadline,
4-minute browser setup,14-minute build/journeys step. Each case has 205 seconds,
browser 165 seconds, local host 190 seconds and native match 180 seconds. Cases run
sequentially; no automatic retry. Native Java retains 2 GiB heap and bounded pools,
plus a 5 GiB virtual-address-space cap (not an RSS/cgroup isolation claim).

Upload only `summary.json`, per-case sanitized summaries and the explicit
setup/opening/resolved/terminal/complete/failure PNG allowlist. Combined size is
at most 10 MiB; retention is one day. Raw exceptions, server/browser logs, auth
headers, connection files, internal capability inputs, source trees and traces
are excluded. Failure summaries drop arbitrary exception messages. The known
synthetic bearer and `Bearer ` marker must not occur in any uploaded bytes.
Cleanup must produce confirmed native termination/private-input removal.

Standard Linux 20-minute ceiling is approximately $0.12 before allowances; the
root reserves at most $0.50 for an authorized combined Actions/Cloudflare attempt.
The unchanged branch-only Wrangler fail-fast guard is not a deployment success
and cannot constrain an unknown external command that overrides its config.
