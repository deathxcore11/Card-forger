# Regression log: bugs that reached the owner

Every bug the owner hits on a released build gets a row here and a test that uses the
exact input that broke. "Test" is the file name; "owed" means it has not been written
and the bug is not closed.

| Date | Released in | What broke (as the owner saw it) | Why the tests missed it | Test |
|---|---|---|---|---|
| 2026-11-13 | version to confirm | The scanner failed on real photos of cards. | Checked on clean inputs, not camera photos. | owed (smoke C1) |
| 2026-11-13 | version to confirm | Matches never started. | Nothing started a match on the shipped build. | owed (smoke B1) |
| 2026-11-13 | version to confirm | Search gave wrong answers. | Expected answers were not written from the cards beforehand. | owed (smoke D1) |
| 2026-11-14 | app 0.4.78 | Avatar of Burgeoning Echoes (FRA 122) set to Nonfoil leaned with the phone and caught light like a foil, and a pink strip covered its security stamp. | Tilt and the stamp were only checked on foils; no test opened a plain card. | test-plain-card-stays-plain.mjs |
| 2026-11-14 | web 4.3.197 and before | Magic foils looked like a filter: "super rainbow hdr", "distracting", "doesn't look real". The whole card was repainted darker and harder wherever the light was. | Foil tests read the router and the shader text; none drew a real card and compared it with the printed picture. | test-mtg-foil-real-browser.mjs (web only; the app is the next row) |
| 2026-11-14 | app, version to confirm | Magic foils looked like a filter (same report as the row above). | Same as the row above: the app's shader was a port of the old site shader. | android-app/native/scripts/check-foil-port.mjs on branch claude/foil-real-native: the app's shader must draw what the approved first foil draws (fails on the old app shader: traditional off by 144/255) |
| 2026-11-14 | preview only (mock-up v8; branch claude/project-thread-k8jcla commit 7e8a346, not released) | After the first new foil was approved, five retuning passes made it look "fake now and bad" ("the first foil you sent was good why make worse?"). | Each pass was scored against photos and judges, never against the look the owner had already approved; no test pinned the approved shader. | test-mtg-foil-real-browser.mjs: every foil type's shader must draw what test-fixtures/finish-effects/mtg-foil-first-approved.glsl draws (fails on 7e8a346, traditional off by 11/255); test-mtg-foil.mjs: every recipe's numbers must match mtg-foil-first-approved-recipes.json |
| 2026-11-15 | web 4.3.200 and app 0.4.82 | On his phone the foil's round spotlight followed the tilt and left a white haze over the art (Don & Leo, Problem Solvers, TMT 143, traditional foil, screen recording): "way too distracting", and the foil was "a little too subtle". | The look was approved on a desktop mock-up; the browser test checked that light brightened the card where it landed, which is what the spotlight did, and nothing measured haze over the art or colour on the frame. | test-mtg-foil-real-browser.mjs (Don & Leo TMT 143 and Avatar FRA 122: haze over the art, colour on frame and text box; fails on the 0.4.82 shader) |

The three rows dated 2026-11-13 were written from the project's report of that night, not from
a re-run. The thread that owns each area confirms the cause when it writes the test.
