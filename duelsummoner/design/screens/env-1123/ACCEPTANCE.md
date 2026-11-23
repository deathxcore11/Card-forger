# Environment bar acceptance, 23 Nov 2026

Seeds 1, 4242, 31337, 48879, stage 1. Scripts: `test/accept-node.mjs` (geometry), `test/accept-browser.mjs` (screenshot measurements), `test/browser-walk60.mjs` (60 s walk), `test/scatter-report.mjs`.
Pass and Fail are only for what was measured. "Not assessed" means no measurement exists.

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Spawn frame | Pass (canopy and trunks), Not assessed (duelist 90% visible) | Green share 3.0 / 4.3 / 8.7 / 13.9% (colour test, 16:9 only). 19.5:9 not run. |
| 2 | Spawn sweep | Not assessed | |
| 3 | Camera framing | Fail against the bar text, matches the later camera numbers | Horizon 45.3% (bar 36-42), feet 64.5%, eye 2.6 m (bar 2.8-3.4). Hero 13.2% on 16:9, 20:9 and 4:3. |
| 4 | Gate seal visible | Pass (approximate) | 99.6 / 99.8 / 98.5 / 98.3% of walkable 2 m cells. Ray against prim boxes of 10 m or more and hero landmarks, axis-aligned, trees ignored. 3 render px by construction (width grows with distance), not measured on a 400 px viewport. |
| 5 | Height ranking | Pass | Seal 90 m. District heroes 24 to 27.6 m (at least 8 m above the tallest tree, 16 m). Mega landmark 64 m (open decision). |
| 6 | Trees | Pass on 3 seeds, Fail on 31337 | Totals 174 / 179 / 189 / 189. Trunks at least 6 m apart. At most 3 per cell. None within 24 m of spawn. Road samples with 6-10 trees within 50 m: 90 / 88 / 78 / 92%. |
| 7 | Gaps between solids | Pass 4/4 | No gap between 0.9 and 3.0 m (scatter solids only). |
| 8 | Forbidden heights | Pass for scatter, Not assessed for kit chunks | No solid 0.4-1.2 m. No solid within 3.75 m of the road line. The Colosseum ring pillars (2.6 and 3.2 m) were not linted. |
| 9 | Colliders match visuals | Fail | One cylinder per rock. The blob mesh is jittered up to 16%, so a hero rock can differ by more than 5 cm. |
| 10 | Rocks | Pass | Hero 33 / 35 / 34 / 32, at least 25 m apart, at least 12 m from the road. Low plus tall 98 / 96 / 97 / 99. Pebbles 0.26 m. |
| 11 | Empty space | Fail | 30-32% of a 4 m raster is more than 12.5 m from a feature of 1.5 m or more. Solid-free district fields not measured. |
| 12 | Screen coverage | Fail on sky, Not assessed otherwise | Sky share at the spawn frame is about 11% (bar 25-40). Only the spawn frame was measured, not 20 road screenshots. |
| 13 | Skyline | Not assessed | |
| 14 | Values | Mixed, mostly Not assessed | Ground at the feet L* 60.0 / 68.1 / 63.9 / 60.0 (bar 62-78). Sky top vs horizon delta E 41-56 (Pass). Horizon L* sampled on trees and rocks, so the horizon-over-ground check is Not assessed. |
| 15 | Enemy contrast | Not assessed | |
| 16 | Reserved colours | Fail | Gold is on the gate pylon bands and gate lintel only. Chest lacquer is not done. |
| 17 | Road | Pass on width and continuity, colour Not measured | 4.5 m wide, reaches the gate on all seeds, 2-3 trails. The 15-25% darker value comes from the bar's computed hex, not from a screenshot. |
| 18 | Grass | Pass | 531-542 clumps, maximum 0.52 m. Nothing within 4 m of the camera by shader (not checked on pixels). |
| 19 | Occlusion | Fail on one run, Pass otherwise | 60 s bot, geometric test of camera-to-duelist against colliders: seed 1 0 hidden frames, 4242 48 (0.3%), 31337 499 (3.5%) on the first run and 0 and 40 on re-runs. The dither check at LOW=2 by eye was not done. |
| 20 | Enemies and props | Partial | Node test: 40 enemies for 6 s against one trunk, closest gap 0.58 m. The 300-enemy 60 s run and the trunk-pass screenshot were not done. |
| 21 | Feature cadence | Not assessed | |
| 22 | Platforming | Fail | Hop chain not built. |
| 23 | Rim | Partial | 56 stacked buttes, 16 to about 45 m, 8 notches of 8-10 m. Air-jump bot on 50 seeds not run. |
| 24 | Minimap at frame 1 | Not assessed | Gate edge-arrow is drawn from the first frame (seen). |
| 25 | Crossing and sweep time | Not assessed | |
| 26 | Interactables | Fail | Chest lacquer and 3 m markers not done. |
| 27 | Budget | Fail on draws, Pass on triangles | Draw calls 40 / 98 / 50 / 49 per frame with the duelist, effects and the seal (10 draws) included. Triangles about 49k. Phone frame time not measured. |

Not built: steps 13 (leaning cards), 18 (terraces), 19 (hop chain), 20 (edge trim), 23 (interactables) and 24 (draw-call cut). Step 22 was skipped as instructed.
