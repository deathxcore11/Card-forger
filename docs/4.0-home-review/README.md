# 4.0 Home foundation review

October 24, 2026. Development checkpoint, not a 4.0 release receipt.

The before images serve the application at
`256b9e8b47cdb49fba8d5208aefa560dd7d4f2ab`. The after images serve the Home
implementation in the commit containing this review. Both use the same
synthetic artwork, prices and three saved decks. These are actual app captures,
not concept renders or real-provider/artwork approval.

| Width | Before | After |
| --- | --- | --- |
| Phone, 390 px | [Before](before-390.jpg) | [After](after-390.jpg) |
| Tablet, 768 px | [Before](before-768.jpg) | [After](after-768.jpg) |
| Desktop, 1440 px | [Before](before-1440.jpg) | [After](after-1440.jpg) |
| Desktop Light mode, 1440 px | — | [After](after-light-1440.jpg) |

The daily artwork is rendered once and bleeds into the personal overview. Card
of the Day precedes collection value, then up to three actual saved decks,
Community Meta decks and News. The first deck retains the existing truthful
last-worked/resume behavior. Desktop controls share one compact header surface.

The fixture does not provide an eligible daily pack, so these images do not
establish pack-art appearance. The existing collectible-pack handler is retained
and its await/cancellation/finish behavior passed focused tests. Play and Draft
entries are disabled development controls, available only to conservative Magic
desktop candidates. No match or Draft can be started.

## Validation

| Check | Actual result |
| --- | --- |
| `npm test` | PASS, exit 0; all 311 commands, including the new Home/device-admission check |
| `node tests/home-browser.mjs --local` | PASS, exit 0; all three games at 13 widths from 320–2560 px, navigation/focus, daily rollover, missing/unsafe art, source refresh, real Random Deck handoff, cancellation, saved-deck resume and reduced motion |
| `node tests/deck-build-presentation-browser.mjs` with explicit local browser settings | PASS, exit 0; 320/390/1440 px × solid/glass, animated progress, reduced motion, cancel/late response, automatic completed deck, budget/error recovery, no autosave, and the separate AI build/return/cancel flow |
| Before/after captures | PASS, 390/768/1440 px, matching synthetic data; final Light-mode capture reviewed separately |
| `git diff --check` | PASS |
| `python3 -m unittest discover -s tests -p 'test_verify_deployed_assets.py' -v` after inventory repair | PASS, all 10 tests; no production requests |

The local browser used runtime Playwright 1.62.1 and Chromium 153.0.8010.0.
The browser suites used isolated synthetic provider/account data, not live
model calls, live collection writes, real prices or physical device testing.
Explicit local execution does not impersonate a GitHub Actions run.

Common local browser settings:

```sh
CARDSTASHY_LOCAL_BROWSER=1
CARDSTASHY_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
CARDSTASHY_CHROMIUM_PATH=/path/to/chromium
```

The build-presentation run additionally used
`CARDSTASHY_CHROMIUM_DISABLE_GPU=1`. This opts the custom local executable out of
ANGLE/SwiftShader; default hosted browser configuration is unchanged. The final
suite retains the original animated element screenshots and all interaction
assertions.

The first local build-presentation attempt failed while capturing an animated
element under the ANGLE configuration, after three layout cases completed.
A diagnostic page-region capture also timed out under that configuration after
one case. A focused animated glass capture succeeded with hardware graphics
disabled; the full original capture path then passed all six cases with that
setting. Both failures remain part of this record. They do not establish a
universal graphics-driver diagnosis or physical-device performance.

The full interaction runs preceded the last Light-only contrast adjustment;
the final Light capture exercised that adjustment. No application JavaScript
changed after those passing runs. The screenshots and source in this commit
are the final Home checkpoint.

The first hosted `deployment-verifier` run for UI commit `23284e8` failed:
the new `home-overview.css` was absent from its fixed public-asset inventory.
The follow-up registers both that stylesheet and `desktop-play.js` without
loosening URL restrictions or exact-byte checks. All ten verifier tests then
passed locally. Hosted results for the follow-up revision are separate evidence;
a local pass does not relabel the original failed job.

The later hosted AI browser job reached `ai-request-recovery-browser.mjs` and
timed out clicking the Home AI button behind an already-open Ask modal. Its
renderer-only fixtures had restored the conversation before the theme loop.
The repair uses the existing `newChat` helper, which opens Ask only when closed
and otherwise uses its visible New chat control. It does not force clicks,
change app dialog behavior or remove card/build/privacy assertions. The complete
recovery browser suite passed locally at 320/390/768/1440 px with both card-row
themes and the two sparse-provider cases. The test now supports explicit local
fixture execution and a custom Chromium executable. Hosted follow-up `349d873`
passed the AI recovery job. Its overall result was 68 success, one skipped
production deployment and one scanner-adversarial failure caused by an HTTP 503
from the public TCGdex reference-image source, before browser assertions.

## Scope still open

The recovered Random Deck parser optimization remains in the branch ancestry
and passed its focused and aggregate regressions. This checkpoint does not
close the real-provider R01 replay, frozen 26-case benchmark, end-to-end device
latency, crew balance, theme density or win-condition quality findings.

The shared four-view implementation now has a separate [development review](../4.0-deck-viewer-review/README.md);
its complete entrypoint matrix remains open. The [engine evaluation](../4.0-engine-evaluation.md) is source inspection,
not a passed runtime proof. Supported format/card pool, complete CPU games,
offline restart/resume, private Casual and Draft remain release blockers.
Production and the published APK have not been changed.
