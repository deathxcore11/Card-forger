# Environment bar acceptance, 23 Nov 2026 (second run, after the ground and draw-call pass)

Seeds 1, 4242, 31337, 48879, stage 1. Scripts: `test/accept-node.mjs` (geometry), `test/accept-browser.mjs` (screenshot measurements, draws, triangles), `test/browser-walk60.mjs` (60 s walk), `test/scatter-report.mjs`.
Pass and Fail are only for what was measured. "Not assessed" means no measurement exists. Screenshots: 00_before ... 09_final, four yaws each (gate, east, west, back), same spawn frame on seed 1.

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Spawn frame | Pass (canopy and trunks), Not assessed (duelist 90% visible) | Green share 3.9 / 7.1 / 3.8 / 6.0% by a colour test, 16:9 only. |
| 2 | Spawn sweep | Not assessed | |
| 3 | Camera framing | Fail against the bar text, matches the later camera numbers | Horizon 45.3% (bar 36-42), feet 64.5%, eye 2.6 m (bar 2.8-3.4), hero 13.2%. |
| 4 | Gate seal visible | Pass (approximate) | 99.5 / 99.8 / 98.4 / 98.3% of walkable 2 m cells, ray against prim boxes of 10 m or more and hero landmarks, trees ignored. |
| 5 | Height ranking | Pass | Seal 90 m, district heroes 24 to 27.6 m, tallest tree 16 m, mega landmark 64 m (decided). |
| 6 | Trees | Pass 4/4 | 168 / 203 / 184 / 180 trees, trunks at least 6 m apart, at most 3 per cell, none within 24 m of spawn, 93 / 91 / 93 / 87% of road samples see 6-10 trees within 50 m. |
| 7 | Gaps between solids | Pass 4/4 | No gap of 0.9-3.0 m between scatter solids. |
| 8 | Forbidden heights | Pass for scatter, Not assessed for kit chunks | No solid 0.4-1.2 m. Colosseum ring pillars (2.6 and 3.2 m) not linted. |
| 9 | Colliders match visuals | Fail | One cylinder per rock; the blob mesh is jittered up to 16%. |
| 10 | Rocks | Pass on 3 seeds, Fail on 31337 | Hero 35 / 35 / 29 / 32 (bar 30-40), at least 25 m apart, 15 m or more from the road. Low plus tall 96 / 96 / 102 / 99. Pebbles 0.26 m. |
| 11 | Empty space | Fail, much improved | 5.1 / 3.0 / 5.1 / 5.5% of a 4 m raster is still more than 12.5 m from a 1.5 m feature (was 30-32%). Fill clumps are non-solid bushes of 1.7-2.2 m. Solid-free district fields not measured. |
| 12 | Screen coverage | Fail on sky, Not assessed otherwise | Sky about 11% at the spawn frame. |
| 13 | Skyline | Not assessed | |
| 14 | Values | Pass on ground L* for 3 seeds, rest Not assessed | Ground L* 69.4 / 69.5 / 59.8 / 69.4 (bar 62-78). Sky top vs horizon delta E 37-58. Horizon-over-ground not measurable on this sampling. |
| 15 | Enemy contrast | Not assessed | |
| 16 | Reserved colours | Partial | Gold only on the gate bands, lintel, chest chains and trim, jump-lip trim. Chest body is lacquer 0x2a2026 (L* 14). Not checked by screenshot classes. |
| 17 | Road | Pass on width and continuity, colour not measured | 4.5 m, reaches the gate, 2-3 trails. |
| 18 | Grass | Pass | 518-537 clumps, max 0.52 m, nothing within 4 m of the camera by shader (not checked on pixels). |
| 19 | Occlusion | Pass (geometric test) | 60 s bot after widening the camera clearance: 12 hidden frames of 14,396 on 4242, 0 on 31337, 0 on seed 1. The dither check at LOW=2 by eye was not done. |
| 20 | Enemies and props | Partial | Node test with 40 enemies for 6 s against a trunk. The 300-enemy 60 s run was not done. |
| 21 | Feature cadence | Not assessed | |
| 22 | Platforming | Built, not validated | Hop chain 38 m from spawn on every seed tried: 1.2 m base tier, 2.4 m tier inset 3 m, three 4 x 3.5 m pads at 3.6 m, 2.8 m gaps, gold lip trim. The reach validator and tools/physcheck.mjs were not run. |
| 23 | Rim | Partial | 56 stacked buttes 16 to about 45 m, 8 notches of 8-10 m. Air-jump bot on 50 seeds not run. |
| 24 | Minimap at frame 1 | Not assessed | Gate edge-arrow is drawn from the first frame (seen). |
| 25 | Crossing and sweep time | Not assessed | |
| 26 | Interactables | Partial | Chests are black lacquer with gold chains. The 3 m markers and the shrine light column are not done. Chests solid or not: not checked. |
| 27 | Budget | Pass on 3 seeds, Fail on 4242 | Draw calls 27 / 41 / 28 / 28 per frame (bar 40 or fewer). Triangles 58.3k / 62.2k / 59.4k / 59.2k (bar 60k). Counts include the duelist and effects. Phone frame time not measured. |

Built this round: gate seal in 2 draws, terraces (1-5 per map) with 3 m ramps, the hop chain, gold lip trim, a tiling ground detail texture, fill clumps, leaning cards in the Card Graveyard, chest lacquer, props baked into merged meshes with instanced gems, trees merged to one mesh per variant, one shared boulder shape, camera clearance 0.85 m.
Not built: gentle rolling relief (needs the heightfield), the 3 m interactable markers and shrine light columns.
