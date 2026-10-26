# Existing Play → real hosted Forge browser proof

Local-only test preparation. No deployment, account change, provider allocation,
remote write, paid CI invocation, fake rules, native response interception, or
force click is performed by these files.

## Composition and boundaries

`materialize.mjs` builds `runtime/` from the existing CardStashy source plus:

1. the immutable integration checkpoint (`forge-play-integration-overlay/SHA256SUMS.json`);
2. effective-inspector and verified 60% fan fixes;
3. the reviewed wide-entry patch, with original-base and merged zero-fuzz checks.

Only the overlapping import context is reconciled explicitly. The actual Play
handlers are mechanically extracted from the **composed** `app.js` with recorded
source hashes. `playMenuMarkup`, `createPlaySetup`, import parser, host client,
player mat, table, native decisions and actual device admission run unchanged.
The fixture uses the actual menu's fallback deck tiles, not a new picker.

The deliberate test boundaries are a synthetic account/auth provider, public
saved deck/cache seeds, and an isolated Play page shell. This is **not full app
boot, real Supabase login, cloud deck persistence, real provider/container
isolation, published deployment or physical foldable-hardware acceptance**.
Home's shell is a fixture destination; mat cleanup and actual callback routing
are checked, not the full Home renderer. The production feature flag stays off.

The local service fixture belongs to the host owner at
`forge-host-local-fixture/server.mjs`. It runs the actual AdmissionService,
MatchService, bootstrap, gateway and frozen0146 Forge JVM. Native legal actions,
choices, mana, AI and terminal results are not mocked. Its config endpoint emits
only a synthetic local account/token. No bearer is pasted into the UI or saved.

## First bounded run

Use an already provisioned pinned Playwright/Chromium environment:

```sh
FORGE_BROWSER_TOOLS=/path/to/pinned-tools \
FORGE_BROWSER_CASE=saved-keen \
  bash takeover/forge-play-browser-proof/run-local-journey.sh
```

This opens existing Play, selects exact saved Angels + Keen, starts Default CPU
(test policy) in real Smart mode, acknowledges actual native opening choices,
keeps seven, plays a land, checks actual Smart/Full acknowledgements, cancels an
exit, then explicitly concedes and waits for the native terminal result before
returning to Play and navigating Home. It asserts exact selected deck transport,
private-zone visibility, no duplicate action IDs, and no external credentials.

Set `FORGE_TEST_CAST=true` to add the recorded exact opening line: second Plains,
Metallic Mimic, native payment/creature-type choice/resolution. No card ID is
hard-coded. Set `FORGE_BROWSER_CASE=import-reign` for the actual import form and
concrete Reign CPU snapshot. All mutations come from ordinary rendered controls.

Set `FORGE_FULL_JOURNEY=true` to continue passive **actual native** required
choices to a natural terminal result, inspect result navigation and explicitly
Rematch with a new allocation before concession/cleanup. This is bounded by
12 minutes/1200 actions **and the host's shorter absolute match expiry**; expiry
is a failure/interruption, never a loss. This long mode is not yet a passed gate.

## Actual touch contexts

```sh
FORGE_BROWSER_TOOLS=/path/to/pinned-tools FORGE_TOUCH=true \
FORGE_WIDTH=750 FORGE_HEIGHT=832 FORGE_TEST_CAST=true \
  bash takeover/forge-play-browser-proof/run-local-journey.sh
# Repeat separately at 960 × 1024.
```

Uses `hasTouch: true`, mobile Chrome UA and real capability admission. CDP sends
browser touchstart/move/end input across card artwork, not DOM dispatch or scroll
assignment. It verifies no native action during pan, horizontal reachability of
the rightmost card, ordinary native land/creature taps and no forced gestures.
If there is no overflow, it records that instead of inventing a pan result.
These runs do not claim real hardware testing.

## Evidence

Upload only `summary.json` and explicit known PNG paths (setup/opening/resolved/
terminal/complete/failure). Do **not** upload server logs, runtime inputs, auth
headers, connection files, raw network traces, or arbitrary directory archives.
The summary excludes credentials and private source lists.

`test-local-dom-chain.mjs` is a cheaper local real-service smoke. Its Node fetch
shim explicitly provides browser Origin and its DOM capability fixture is
explicit; neither proves Chromium, geometry or touch. It is not a replacement
for the browser run.
