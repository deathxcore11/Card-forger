# Duel Summoner: handoff brief for another assistant

What it is: a browser action game (Three.js r128, WebGL2, plain ES modules, no build step). Run it with `node serve.mjs`, open http://localhost:8765/ (or `?fxlab` for the effects lab, `?debug` for hooks). Tests: `node --test "test/*.test.js"` (266 pass). Browser tests: `node test/browser-*.mjs <outdir>` (headless Chrome).

Layers (keep them apart):
- src/sim: pure simulation, no platform maths (lint-enforced), fixed 60 Hz step, replay hash must not change from view work.
- src/data: tuning and content tables (do not edit tuning.js numbers or design/stat-engine/SPEC.md without the owner).
- src/gen: stage generator. src/gen/v2 is the designed generator (districts, tiers, spine route, landmarks); src/gen/generate.js falls back to the old simple one.
- src/view: rendering only (never feeds the sim). src/core: input, touch, host.

Rules from the owner: view-only changes must keep the replay hash identical; test first and say what was only seen in a picture; no other game's name anywhere; commit messages end with the session line; the repo is public so no secrets.

Where things are: design/ holds the specs (generator-spec.md, spectacle-spec.md, menus-spec.md, maps.md) and the proof pictures in design/screens. tools/ has the bots (walkspine.mjs, walkboss.mjs) and checks (landmarkview.mjs).

Open audit items (from a recording of an older build; most already fixed, see the thread): coin economy and chest price (balance change, needs owner approval), the XP curve (locked), a 300 ms level-up input lock, a per-monster damage-share bar on the run-end screen, a window.onDuelSummonerRunEnd bridge for CardStashy.

Not done: area attacks that grow with Reach (waiting on rule numbers), the tier ramp, the menus rebuild, pools/quest layer of the generator, 500 ms generation target.
