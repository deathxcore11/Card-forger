# Duel Summoner environment bar

Our Stage 1 map is not too small. It is a 390 m disc, but it reads small and messy because nothing sits in the 5-15 m scale band, the lighting washes every colour to the same value, and the edge is one ring of plain boxes. This document sets the bar for scale, density, colour, guidance and cost, then lists a dressing pass for the current map and the kit pieces the generator needs.

The numbers come from our code (the build as of 23 Nov 00:30 UTC, before the camera change in 2840d49), the generator spec and three reviews (art, performance, play). GUESS marks anything not yet measured. Performance is Not assessed until it runs on a phone.

## How to read the numbers

- The renderer is three.js r128 with no colour management. Light colours multiply the hex values per channel. Every "lit" value below uses that maths for an up-facing surface (sun NdotL 0.80). These are computed values, not screenshots.
- Pixel sizes assume a phone held landscape at about 400 CSS px tall. LOW=2 renders about 200 px of height, so 1 render px is about 0.31 deg. GUESS on the phone height.
- Base run is 9 m/s (src/data/config.js:5). Item builds reach about 18 m/s. GUESS, taken from the camera pull-back at src/view/camera.js:26.
- Player radius is 0.6 m and enemy radius 0.7 m. Jump apex is 2.2 m. At +1.2 m rise the G1 gap limit is about 4.15 m (spec section 4 table, interpolated).
- Binding spec rules used here: section 4 (forbidden rise 1.8-2.6 m, 3x3 m pads, edge colour language), 18.1 (minimap fog of war), 18.3 (collider within 5 cm of the visual, enemies path everywhere the player can stand), 18.5 (Stage 1 rises 1.2 m or less, gaps 60-75% of base reach) and 18.6 (nothing solid 0.4-1.2 m in a lane, cliffs 8 m or more).

## Gap table

| Area | Reference | Ours now | Target |
|---|---|---|---|
| Map size | About 250 m square (GUESS). The start shows about 1/3 of the map. | 390 m disc, about 119,000 m2 (src/data/map.js:10). | Keep 390 m. Speed builds need the room. Fix the empty mid band, not the size. |
| Trees | 9-11 m typical, range 4-13 m. Clusters of 3-5. | 9.5-16 m. Trunks 1.2-2.0 m wide. About 60 trees, 1 per 1,700 m2. Canopy at 4.1-7 m. | Two species: parasol 9-11 m tall, 8-10 m wide (the Stage 1 majority) and blob 13-16 m. Trunks 1.0-1.6 m wide and upright. Trunks 6-9 m apart, centre to centre. 6-10 trees within 50 m in 80% of road samples. |
| Rocks | Hero boulder 4.5-5.5 m, 1 per screen. Medium 1.8-2.7 m. Small 0.5-1 m. | 28 rocks, mostly 1.2-1.7 m tall. No hero rock. Collider top 1.25 x scale. | Hero 4.5-6 m tall, 30-40 per map. Low 1.2-1.5 m. Tall 3.0-3.5 m. Pebbles 0.35 m or less. No standable top in 1.8-2.6 m. |
| Ruins and the "brown boxes" | Low walls 1-2 m. Towers 10-12 m. Ruin zones 20-30 m across, about 60 m apart. | 8 bare tan cylinders 1.8 m wide, 2.2-3.6 m tall (src/gen/kits.js:43). Colonnade the same (kits.js:109). | Built columns: stone shaft 4.5-7 m with a bone capital. 25-40% toppled. One 10-14 m landmark per ruin zone, built from our card kit. |
| Boundary rim | Cliffs over 15 m. Fogged walls 40-80 m behind (GUESS). | 56 plain boxes, 17.6-26.4 m, flat tops (src/view/mapMesh.js:89-93). | Stacked buttes 14-45 m with strata. 8 visual notches at 8-10 m. A backdrop ring of mesas at r 270-330 m. |
| Goal | Arch about 4 m. Invisible from range. | 24 m gold pylons. Gold L* 76.5 against a sky and fog of L* 83, so it fades. | A gate seal: a dark violet column 90 m tall with turning sigil rings. At least 3 render px wide at any range. |
| District and mega landmarks | Towers 10-12 m are the real landmarks. | No district heroes. No mega landmark. | District heroes 22-30 m, each a different silhouette. One mega landmark of 60 m or more. |
| Interactables | Chest is the most saturated warm colour on the ground. | Chest gold hue 40 on sand hue 36. Shrine basin only 0.5 m tall. Chests and vases solid at 1.0-1.3 m. | Chest reads by value: black lacquer body with gold chains. Shrines use the spec V12 light column. Chests and urns do not block movement. |
| Grass | Tufts 0.3-0.45 m. Tufts in the ground hue add noise, not shape. | 2,600 green tufts up to 1.2 m. They hid the legs in the recording. | About 600 darker clumps, 0.52 m or lower, only at the bases of trees, rocks and ruins. |
| Density and empty space | 6-10 trees and 2-4 rock groups on screen. | Outside spawn, vegetation is 0-3% of a frame. Plain and sky are 60-70%. | No point more than 12.5 m from a feature 1.5 m or taller (non-solid features count). Each district keeps one solid-free kiting field 40-60 m across. |
| Spawn | Start area shows a third of the map. | Scenery only 9 m clear. The camera started inside a canopy. | Trees and rocks 24 m or more from spawn. Ring of solids at 32 m or more, with at least 4 openings 12 m wide. |
| Skyline | 8-10 silhouettes in 3-4 shape types. | 2-8 silhouettes, all flat rim steps or hedge rows. | 8-12 silhouettes from any point, in at least 5 shape types, plus the gate seal. |
| Ground and paths | Gentle hills. Paths only 5-10% darker. | Flat y=0. Random 16 m quads with 10% jitter that read as facets. No paths. | 8 m cells coloured by noise, jitter 3%. One worn dirt road along the spine, 15-25% darker. Low terraces until the heightfield lands. |
| Water | One pond anchors memory. | None. | 2 summoning pools per map in our own ink blue, not a copy of the reference pond. |
| Lighting | Sky equals fog, so depth is flat. | Up-face light about x1.55 R, x1.45 G, x1.25 B (src/main.js:45-47). Sand clips to #fdee89, brighter than the sky. | Up-face light about x1.0 R, x0.97 G, x0.90 B. Lit sand L* 65-70. Horizon L* 86. |
| Palette | Strong canopy and trunk contrast. | Canopy L* 75.5 equals sand L* 74.2. Bark close to sand. | Blue-green canopy, lit L* 56-64. Dark bark L* 34. Grey-violet landmark stone L* 28. |
| Fog and draw distance | Crisp to 30-40 m. Gone by 80-120 m (GUESS). | Fog 110-330 m in the sky colour. Far plane 520 m, near plane 0.1 m. | Scenery fog 80-300 m in the horizon colour. Far pieces capped at 55% fog. Far plane 600 m, near plane 0.5 m. |
| Camera | Measured in his 23 Nov scale video: hero 11-14% of screen height, feet 64-66% down, horizon about 45%, wide lens (FOV setting 108). | Since 2840d49: horizontal FOV setting (default 100), arm back 10, up 1.2. Measured on 16:9: hero 13.2%, feet 64.5%, horizon 45.3%. 20:9 and 4:3 still uneven. | Hero 12.5-14% of screen height on 16:9, 20:9 and 4:3 alike (vertical FOV clamped 64-88, arm scaled by aspect). Feet about 65%, horizon 42-46%. This row replaces the older back 9 / up 1.45 target. |
| Guidance | HUD text, a rotating minimap, thin wind streaks. | Gate only in HUD text. Minimap shows the gate once seen. | Gate seal visible from 95% of walkable cells. Minimap gate edge-arrow from the start. Roads and icons reveal with fog of war. |
| Occlusion | Canopy fills 35-50% of the frame. | Player fully hidden behind a trunk. Fade drops to 10% visible. Rocks never fade. | Fade to 30% visible after a browser test. Fade also covers rocks of scale 2 or more. |
| Enemies and props | n/a | Enemies walk through every tree and rock. Only the player collides (src/sim/player.js:72). | Every solid prop blocks enemies too. |
| Platforming | Ramps and 4-5 m earth ledges. | Nothing near the player invites a jump. | One optional hop chain within 40 m of spawn, built to the Stage 1 rules. |
| Edge colour | n/a | The spec section 4 trim language is not used. | Gold trim on jump lips. Lighter top tone only on player-only surfaces. |
| Stage 2 and Stage 3 | n/a | Trees are 0 (src/gen/scatter.js:20-21). No targets yet. | Own targets needed. See open decisions. |
| Render budget | 60 fps with a horde on a phone. | About 82 world draws, 35-37k world triangles. | 40 world draws or fewer (estimate 31-33). 60k world triangles or fewer (GUESS, estimate 55-60k). |

## Palette (all hex values are ours)

Lit values are computed for an up-face under the new lights. Confirm them on a screenshot.

| Use | Hex | Albedo L* | Lit L* |
|---|---|---|---|
| Sand, 3 tones | 0xc8a46c, 0xcaa978, 0xc09c66 | 66-71 | 65-70 |
| Dirt road | 0xb09470 | 63 | 62 |
| Canopy, 3 tones | 0x5a9a66, 0x66a46e, 0x74ae72 | 58-66 | 56-64 |
| Bark | 0x5e5048 | 35 | 34 |
| Rock, 2 tones | 0xbdb8ae, 0xb0aa9e | 70-75 | 66-73 |
| Rim base and bands | 0xbca494, 0xd0bcaa | 69-77 | 68-76 |
| Backdrop mesas | 0xd4c4ac | 80 | n/a (fogged) |
| Landmark stone | 0x4a4250 | 29 | 28 |
| Bone caps and capitals | 0xe6dcc0 | 88 | 86 |
| Grass clumps | 0x8a7a48 | 52 | 51 |
| Pool water | 0x2e3f66 | 27 | n/a |
| Chest body (lacquer) | 0x2a2026 | 14 | 13 |
| Chest chains (reserved gold) | 0xe0b765 | 77 | 75 |
| Gate seal core and edge | 0x2e1a52, 0xf4ecff | 15, 95 | unlit |
| Sky top, horizon and fog | 0x8fb2cc, 0xe8d6b0 | 71, 86 | unlit |

Reserved colours:
- Gold 0xe0b765 appears only on interactables, the goal and jump-lip trim.
- The violet seal colours appear only on the gate.
- The Trophy Chest cyan appears only on chests.
- The Tomb Scarab (0xd8b24a, src/data/enemies.js:15) is exempt from the gold rule. It moves, flies at 1.2 m and has its own shape. It still has to pass the enemy contrast check below.

Enemy contrast. All 7 enemy colours from src/data/enemies.js are listed: Dust Husk 0x5a6b4a, Husk Runner 0xa8683a, Glass Seer 0x7aa8c8, Ram Golem 0x8a8278, Sand Bloat 0xd88a3a, Overtime Hunter 0xb03060, Tomb Scarab 0xd8b24a. With the palette above, the closest computed pairs are:
- Ram Golem vs rim: delta E 16, delta L* 14.
- Dust Husk vs bark: delta E 21.
- Husk Runner vs dark sand: delta E 21.
- Tomb Scarab vs sand: delta E 21.
- Sand Bloat vs dark sand: delta E 25.

The Glass Seer is only delta E 8 from the sky top. Enemies stand below the horizon, so the check uses the sky band near the horizon instead (delta E 42).

## Dressing pass for the current Stage 1 map

1. **Enemies respect props** (src/sim/flow.js, src/sim/colliders.js, src/sim/steer.js). Stamp every solid scatter collider into the 2 m flow grid as WALL. A cell is blocked if the collider, inflated by the 0.7 m enemy radius, covers its centre. Run the same push-out from resolveColliders on enemies in steer.js. Do this before any other prop is added.
2. **Lighting** (src/main.js:45-47). HemisphereLight(0xdfe6f0, 0x6a5038, 0.6). Remove the AmbientLight. Sun stays 0xffe2b0 at position (60,90,30), with intensity 0.6 to 0.6. Up-face light becomes about x1.0 R, x0.97 G, x0.90 B (r128 maths). Only the sun is warm now.
3. **Sky, fog and clip planes** (src/main.js:42-44). Add a sky dome: sphere with 16x8 segments, vertex colours top 0x8fb2cc, horizon 0xe8d6b0, below the horizon 0xd9c29a. Use MeshBasicMaterial with fog false and depthWrite false. Draw it last and push it to the far plane with "gl_Position.z = gl_Position.w;" in onBeforeCompile. Copy the camera position to it every frame. Set scene.background and Fog to 0xe8d6b0, range 80 to 300 m. Set the near plane from 0.1 to 0.5 and the far plane from 520 to 600. Cost: 1 draw, about 256 triangles.
4. **Far material** (src/view/mapMesh.js). Move the rim, the backdrop and every prim tagged landmark:true into a second mesh. Its Lambert material caps the fog factor at 0.55 in onBeforeCompile. Write 0.55 as a literal in the shader source, not a captured variable. Cost: 1 draw.
5. **Ground** (src/view/mapMesh.js:17, 82-86). Cell size 16 to 8 m (54x54 cells, 5,832 triangles). Pick the colour by 2-octave value noise (periods 60 m and 18 m) across the three sand tones. Triangle jitter 0.9-1.1 to 0.97-1.03.
6. **Road** (src/view/mapMesh.js, with routes from src/gen/generate.js). One worn dirt road along the spine from map.spawn to map.gate, 4-5 m wide, bent up to 6 m every 30 m. Narrower 3 m trails branch to each district centre. Colour 0xb09470 (21-25% lower luminance than the sand, computed). No kerb boxes. Broken kerb pieces only near ruins, as a top-face strip. Lift the strip to y 0.05 and keep it inside the main merged map mesh. About 2.5k triangles (GUESS).
7. **Gate seal** (src/gen/kits.js:31, new piece in src/view/props.js). Pylons recoloured to landmark stone 0x4a4250, with a 2 m gold band at 22-24 m (the goal may use gold). Over the gate: a column 4-5 m wide and 90 m tall with a core of 0x2e1a52 and a 0.4 m edge of 0xf4ecff. Use normal alpha blending at about 0.85, not additive. Add 5 sigil rings 8 m across, stacked every 12 m, turning slowly. Scale the column width with distance so it never drops below 3 render px. Merge column and rings into one mesh (1 draw). Visible from the start of the stage.
8. **Spawn clearing** (src/gen/scatter.js:25). Trees and rocks keep 24 m clear of spawn. Bushes and flowers keep 10 m. Ring solids (hero rocks, ruins) sit at 32 m or more. Leave at least 4 openings 12 m wide, and the road exit is one of them.
9. **Trees** (src/gen/scatter.js:37-38, src/view/scenery.js:33, 58, 72, 83, src/sim/colliders.js:5, 9). Add the parasol species (9-11 m tall, 8-10 m flat canopy) at about 60% of trees (GUESS on the split). Keep the blob tree at 13-16 m. Trunk radius 0.7 to 0.55 at scale 1, in both scenery.js and TRUNK_R in colliders.js. Trunks stay upright. Lean only the canopy, 0-12 deg, above 4 m. Groves of 3-5 with trunks 6-9 m apart centre to centre. At most 3 trees in any 10x10 m cell. Total 170-240. Bias groves toward the road and open land in view. Leaf colours 0x9dc76a, 0xb7d884, 0x86b85a to 0x5a9a66, 0x66a46e, 0x74ae72. Bark 0xc79a6b to 0x5e5048. Merge trunk and canopy into one geometry per variant, with a per-vertex part attribute and a vec2 aFade. Drop the small top blob (y 9.4) on 2 of the 3 blob variants.
10. **Grass, flowers and bushes** (src/gen/scatter.js:43-45, src/view/scenery.js:42-45, 58, 67). Tufts 2,600 to about 600 clumps. 4 blades per clump, not 7. Blade length 0.25-0.4 m, scale 0.8-1.3, so the maximum is 0.52 m. Colour 0x8a7a48. Place them only within 3 m of tree, rock and ruin bases. Bushes 66 to 50, 1-1.8 m, at grove edges and pool shores, still not solid. In the vertex shader of the scatter material, collapse any grass or flower instance within 4 m of the camera. Also collapse grass beyond 70 m, flowers beyond 50 m and pebbles beyond 80 m. Nothing is uploaded from the CPU.
11. **Rocks in tiers** (src/gen/scatter.js:41, src/view/scenery.js:40, 81, src/sim/colliders.js:5, 10). Use one blob geometry with per-instance non-uniform scale (s.set(sx, sy, sz) at scenery.js:81, within 30% squash). Hero rocks: 4.5-6 m tall, 5-7 m wide, 30-40 per map, at least 25 m apart and at least 10 m from roads and kiting fields. Each gets 2-3 cylinder colliders matching its footprint, with the top at the visual height. Low rocks 1.2-1.5 m and tall rocks 3.0-3.5 m with rounded tops, 80-110 in total, in groups. Inside a group, rocks either touch (gap 0.9 m or less) or stand 3.0 m or more apart. Pebbles 0.35 m or less, no collider, baked into the rock-cluster instance set. Colours 0xbdb8ae and 0xb0aa9e. Each tier gets its own collider radius and top.
12. **Columns replace the brown boxes** (src/gen/kits.js:43 plaza, kits.js:109 colonnade, src/data/map.js:39-43). Each cylinder becomes a shaft 4.5-7 m tall in stone 0xa89578, with a capital 0.3 m wider and 0.5 m tall in bone 0xe6dcc0. A seeded 25-40% are toppled, and no two neighbours are both toppled. A toppled column leaves a stump 1.2-1.5 m or 3.0 m and up, plus 3 lying drums 1.2-1.5 m in diameter and 2.8 m long. The plaza ring keeps 8 columns at r 27-29 and the 1.8 m width.
13. **Leaning and standing cards** (src/data/map.js:100-107, src/gen/kits.js:118). Turn 3-4 of the 12 face-down cards into leaning cards at 15-35 deg. Build them as rotated deco boxes 3x4.5x0.4 m with a box collider that rises straight from the ground. Never use a walkable ramp steeper than 26.6 deg. Add 1 standing card 3x0.4x4.5 m in every ruinfield and graveyard.
14. **District heroes** (src/gen/kits.js market :48, temple :61, spine :72, pyramid :85, and the classic copies in src/data/map.js). Market: twin standing cards 22 m and 18 m on a 1.5 m pedestal. Temple: a stepped obelisk of 3 boxes, 4, 2.5 and 1.2 m wide, up to 26 m. Spine: a 24 m horn pair on the skull. Pyramid: a 6 m capstone in bone, not gold (34.8 m in total). All in landmark stone 0x4a4250 with bone caps, tagged landmark:true. Tops cannot be reached.
15. **Mega landmark, stopgap** (src/view/mapMesh.js). One colossal buried card at r 240-260 on the far side from spawn. Deco slab 24 m wide, 3 m thick, 64 m tall, tilted 15-25 deg, with a 2 m bone border. Far material, no collider. The generator version follows the spec (see kit additions).
16. **Rim rebuild** (src/view/mapMesh.js:89-93). For each of the 56 segments: a base box 10-16 m, a mid box 8-20 m higher and inset 2-4 m, and a cap 10-15 m higher on about 1 in 3. Heights 14-45 m. No 3 neighbours within 2 m of each other in height. Rotation jitter of 8 deg. 8 seeded notch segments at 8-10 m. Each notch stays at least 6 m above the highest walkable surface within 12 m. The boundary WALL collider stays at full rim height through the notch. Colours: base 0xbca494, bands 0xd0bcaa. Backdrop: 12 mesas at r 270-330, 30-60 m wide, 40-90 m tall, in 0xd4c4ac. About 3k triangles.
17. **Summoning pools** (src/view/mapMesh.js, positions from filler pockets in src/gen/generate.js). 2 per map, at least 30 m from encounters. Disc 10-16 m in 0x2e3f66 at y 0.05, with a 1.5 m flat bone rim 0xe6dcc0 and a ring of carved glyph tiles in 0x4a4250. Opaque, walkable, no lip over 0.35 m, no gameplay effect. Scatter places 3-5 trees within 12 m of each pool. Merged into the map mesh.
18. **Low terraces** (map prims from src/gen/generate.js). Until the heightfield lands, add 2-4 raised terraces per ruin zone or grove edge, 1.2 m tall, with ramps of 26.6 deg or less. Keep them off the road and out of kiting fields.
19. **Spawn hop chain** (src/gen/generate.js, and the hopyard at src/gen/kits.js:126). One optional chain within 40 m of spawn, visible from the spawn frame. Build it as stacked tiers: a 1.2 m base terrace, then pads rising 1.2 m each. Each pad is inset at least 3 m from the edge of the tier below, so every rise next to a walkable cell is 1.2 m. Pads at least 3x3 m, take-off lips at least 3 m deep. Gaps 2.5-3.1 m edge to edge (60-75% of the 4.15 m G1 value at +1.2 m). Landing margin 0.5 m or more, landing in camera view, and a failed jump lands on the tier below. Check the hopyard rises (1.4-4.2 m) against the same Stage 1 rules.
20. **Edge colour language** (vertex colours in src/view/mapMesh.js). Jump lips get a gold trim strip 0.15-0.3 m wide. Player-only surfaces keep the lighter top tone. Other walkable tops read through lighting: tops at least 8 L* above their side faces, with no trim.
21. **Occluder fade** (src/view/scenery.js:85-95). Prototype the hit target 0.9 to 0.7 (30% visible) in the browser and check the trunk-pass case from burst.jpg before locking it. Fix the comment at :85. Add aFade to the rock instances and test rocks of scale 2 or more and all hero rocks with the trunk capsule. Offset the canopy fade centre by each tree's canopy lean. The canopy fade also tests the camera position itself, not only the camera-to-player capsule.
22. **Camera** (src/data/config.js:16, src/view/camera.js:49). back 7 to 9, up 3 to 1.45. The eye height is headY 1.55 plus up, so 3.0 m (camera.js:33-36). Change the look-at from (6 m ahead, pivot +0.2) to (6 m ahead, feet +1.0). That gives about 7.6 deg of pitch, the horizon about 39% from the top and the feet about 66% down (computed). Keep vFOV 62. Clamp slope pitch to 8 deg. With the +25% speed pull-back the eye is about 3.4 m, still under the 4.1 m canopy. Update the spec V11 and V19 camera point (3 m up, 7 m back) to eye 3.0 m, 9 m back.
23. **Interactables** (src/view/props.js:21-69). Chests use the sealed look: lacquer body 0x2a2026 with gold chains 0xe0b765. Chests and urns are not solid. They open or break on hit, with no push-out. Shrines and Witness Stones get the spec V12 light column, not a 4 m card. Urns are exempt from the 3 m marker rule. Vases go to 1.0-1.3 m in clusters of 5-8, off roads by 3 m or more. Make the shrine water opaque (props.js:48). Fix the shrine charge ring at props.js:86: build the 48-segment ring once and use setDrawRange(0, round(p x 48) x 6) instead of rebuilding it every frame.
24. **Draw-call cut** (src/view/props.js). Chests 24 meshes to 3 InstancedMeshes with per-instance colour. Put Trophy chests in the same set. Witness stones 12 to 3. Shrines 12 to 4. Broker and altar 19 to 2 merged meshes. About 69 to about 14.
25. **Minimap** (src/view/minimap.js:60-65). North-up, with only the player arrow rotating. Show the gate edge-arrow from the start of the stage. Draw the road, trails and district icons only on texels the player has seen (spec 18.1).
26. **Shader warm-up and frame cap** (src/main.js). Call renderer.compile(scene, camera) behind the stage card with every prop InstancedMesh present (count 0 is fine). Cap rendering at 60 fps: skip a requestAnimationFrame tick when the interval is under 12 ms.

## Generator kit additions

- **District hero landmark.** Amend spec 645-649 from 4x4 m and 9 m to 22-30 m tall, so it stands 6 m or more above the tallest tree. Four silhouettes: twin standing cards, stepped obelisk, chain winch tower, stacked-card spire. Landmark stone with a bone cap. 600 triangles or fewer. No impostor. It lives in the fog-capped far mesh.
- **Mega landmark.** A colossal buried card, half sunk and tilted 15-25 deg, on the keystone region and off centre, with the spine winding round it (spec 7 and 11). Visible from 75% or more of walkable samples (V12). The height waits on the spec decision below.
- **Gate seal.** The violet column and sigil rings from dressing step 7, for every sealed gate arch size. Minimum 3 render px on screen.
- **Hero boulder set.** 3 variants, 4.5-6 m tall and 5-7 m wide, about 120 triangles each, from the shared blob with non-uniform scale. Multi-cylinder colliders that match the visual to 5 cm.
- **Rock cluster chunk.** 1 hero, 2 low or tall rocks, 4 pebbles, as one instance set. Touching or 3 m apart, nothing between.
- **Tree grove chunk.** 3-5 trees, trunks 6-9 m apart, 2 bushes at the edge and a 10 m darker soil patch (0xc09c66). Parasol and blob species. Trunks 1.0-1.6 m wide and upright. Canopy lean only above 4 m.
- **Column family.** Drum column 4.5-7 m with a bone capital. Stump 1.2-1.5 m or 3.0 m and up. Toppled column of 3 lying drums, 1.2-1.5 m in diameter. Amend spec 18.6 "stumps 1.5 to 3 m" to match the forbidden band.
- **Ruin zone landmark.** One per ruin zone (20-30 m across, about 60 m apart), 10-14 m tall, from our spec 11 card and ritual kit, not a brick tower. Either no top can be reached within jump reach, or it is a planned perch with flyer retargeting after the 4 s dwell and a reward.
- **Leaning and standing stone cards.** At least 1 leaning card at 15-35 deg per ruin zone. Flat face-down cards at most 30% of card uses. Box colliders rising from the ground.
- **Road kit.** Worn dirt strip 4-5 m wide, 15-25% darker than the sand, routed along the spine. Trails 3 m wide to districts. Pieces: straight 8 m, curves of 15 and 30 deg, a T junction and a plaza apron. The road plus 1.5 m each side stays free of solids. On tiered ground the road goes through ramps, never a step over 0.35 m.
- **Summoning pool kit.** 10-16 m ink-blue disc, bone rim, glyph ring, a 3-5 tree ring. 2 per Stage 1 map.
- **Rim cliff set.** Butte segments of 14, 28 and 45 m with strata bands. A notch segment of 8-10 m that is visual only. Backdrop mesa pieces 40-90 m tall for r 270-330.
- **Edge trim.** Gold jump-lip strips and the player-only top tone from spec section 4, applied by the generator.
- **Spawn hop chain chunk.** The tiered chain from dressing step 19. Stage 2 and 3 versions follow the 85% and 92% rules.
- **Kiting field.** One per district, 40-60 m across, decor only, no solids.
- **Interactable markers.** A vertical read of 3 m or more for every encounter type, using the V12 light columns where the spec defines them. Urns exempt.
- **Scatter rules in the kit spec.** Spawn clearance 24 m for trees and rocks. Spawn ring solids at 32 m or more with 4 openings of 12 m. At most 3 trees per 10x10 m. Gaps between solids 0.9 m or less, or 3.0 m or more. No standable top in 1.8-2.6 m. Grass 0.52 m or lower. Bushes and grass never solid. A CI lint runs over scatter output as well as authored chunks.
- **Batching rule.** Amend spec section 12. Each scatter kind stays one map-wide InstancedMesh. If culling is needed later, do it on the CPU every 4th frame: test instance positions against the frustum with a 15 deg margin, compact them and set mesh.count. Only static merged geometry (ground, prims, roads, rim) is split, into at most 4 quadrant meshes. Drop "landmarks beyond it use impostor quads". The fog-capped far mesh replaces impostors.

## Acceptance checks

Run every scripted check on seeds 1, 4242, 31337 and 48879.

1. **Spawn frame** (first gameplay frame, default camera, 16:9 and 19.5:9). Canopy and trunk pixels are 20% of the frame or less. At least 90% of the duelist's silhouette is visible.
2. **Spawn sweep** (8 yaw steps of 45 deg). At least 3 landmarks 20 m or taller in total, and at least 1 in the default view.
3. **Camera framing** (flat ground, screenshot). Horizon 36-42% from the top. Feet 64-68% down. Eye 2.8-3.4 m above the feet.
4. **Gate seal visibility** (2 m grid over walkable cells, rays against colliders and map boxes). Visible from at least 95% of cells. At least 3 render px wide at the farthest cell on a 400 px viewport at LOW=2.
5. **Height ranking.** Gate seal 90 m or more. Every district hero 22 m or more and at least 6 m above the tallest tree. Mega landmark at the agreed height. No tree above 16.5 m.
6. **Trees.** Total 170-240. Grove size 3-5. Trunks 6 m or more apart centre to centre. At most 3 per 10x10 m cell. None within 24 m of spawn. Along the road, 80% of samples show 6-10 trees within 50 m in view.
7. **Gaps between solids** (1 cm raster of collider footprints). No edge-to-edge gap between 0.9 m and 3.0 m between any two solids.
8. **Forbidden heights** (lint on scatter output and chunks). No standable top next to a walkable cell with a rise of 1.8-2.6 m. Nothing solid between 0.4 and 1.2 m tall in a lane or within 3 m of the road.
9. **Colliders match visuals.** Every solid collider is within 5 cm of its mesh, including hero rocks and leaning cards.
10. **Rocks.** Hero rocks (4.5 m or taller) 30-40, at least 25 m apart and at least 10 m from roads. Low plus tall rocks 80-110. Pebbles 0.35 m or lower.
11. **Empty space** (1 m raster). No point is more than 12.5 m from a feature 1.5 m or taller (non-solid features count). Each district has a solid-free field at least 40 m across.
12. **Screen coverage** (20 screenshots along the road, colour classes). Sky 25-40%. Vegetation 12-30%. Ground 30-50%. Rocks 3-8%. No frame over 45% vegetation unless the duelist is inside a grove.
13. **Skyline** (10 random walkable points). At least 8 silhouettes above the horizon, in at least 5 tagged shape classes, plus the gate seal.
14. **Values** (screenshot, 5x5 pixel averages). Ground at the feet L* 62-78. Horizon at least 12 L* above the ground. Sky top vs horizon delta E 15 or more. Neighbouring ground cells within 6 L*. Walkable tops at least 8 L* above their sides.
15. **Enemy contrast** (screenshot). Each of the 7 enemy colours, as rendered, differs from every environment class covering more than 5% of the screen (sky measured near the horizon) by delta E 20 or more, or by 12 L* or more.
16. **Reserved colours** (palette tables and screenshot). Gold only on interactables, the goal and jump lips. Violet seal colours only on the gate. Chest body L* 20 or below.
17. **Road.** Road pixels 15-25% lower luminance than sand 1 m off the edge. Width 4-5 m. The road is continuous from spawn to the gate, and the trails reach every district (no gaps).
18. **Grass.** Maximum instance height 0.55 m or lower. Zero grass or flower fragments within 4 m of the camera.
19. **Occlusion** (60 s autorun on 3 seeds, sampled at 10 Hz). The duelist is at least 60% visible in at least 97% of samples. Re-run the burst.jpg trunk-pass case. Check the dither at LOW=2 by eye before locking 30%.
20. **Enemies and props** (300 enemies, 60 s). No enemy overlaps a solid collider by more than 0.1 m in 95% of frames. No visible clipping through trunks in the trunk-pass case.
21. **Feature cadence.** Walking the road, a named feature lies within 15 m of the road at least every 30 m.
22. **Platforming.** One hop chain within 40 m of spawn, visible from the spawn frame. Rises 1.2 m. Gaps 2.5-3.1 m. Pads 3x3 m or more. The reach validator and tools/physcheck.mjs pass.
23. **Rim.** Segment heights span 14-45 m. 8 notches at 8-10 m. No 3 neighbours within 2 m of each other. A bot with air jumps cannot leave r 201 on 50 seeds.
24. **Minimap.** At frame 1, only spawn, the current district name and the gate edge-arrow are drawn.
25. **Crossing and sweep time** (base-kit bot, no items). Spawn to gate by road in 45 s or less. 90% fog reveal in 5 min or less. With an 18 m/s preset, full reveal in 3 min or less. If the base sweep goes over 5 min, cut solid clutter before shrinking the map.
26. **Interactables.** Every encounter prop is 3 m tall or carries a marker (urns exempt). At 40 m on a 400 px viewport at LOW=2 it covers at least 12 render px vertically.
27. **Budget.** See the guardrails below.

## Performance guardrails

- **World draw calls: 40 or fewer.** Estimate after this pass: about 31-33. Scenery 12-14 (merged trees, shared rock blob, rock-cluster set, bush, grass, flower). Map, far mesh, sky and gate seal 4. Props about 14 plus vases and markers.
- **World triangles: 60k or fewer (GUESS for a phone with 300 enemies).** Estimate: about 55-60k. Trees about 20-24k. Rocks about 11.6k. Grass about 2.4k. Ground 5.8k. Road about 2.5k. Bushes and flowers 4.5k. Prims, columns, heroes, mega landmark and rim about 8k. Seal about 1k.
- **No tree LODs and no impostors.** A second mesh per kind costs more draws than it saves at these counts.
- **No per-frame instance uploads.** Near and far culling of small scatter happens in the vertex shader.
- **No new transparent surfaces** except the gate seal. Pools and shrine water are opaque. Grass and flowers stay opaque double-sided triangles.
- **Depth precision.** Near plane 0.5 m. Ground decals at y 0.05 or higher, inside the map mesh.
- **No hitch over 50 ms (spec 18.3).** Warm all shaders behind the stage card. Trophy chests share the chest material.
- **60 fps cap on 120 Hz panels.** Aim for about 60% of the frame budget, because an 8-minute stage throttles.
- **Future heightfield.** Budget it at about 15-20k triangles. 4 m cells on flat ground, 2 m only along tier edges and ramps. It replaces the 5.8k flat ground, it is not added on top.
- **Native renderer later.** Render into a fixed low-resolution target (about 640x360) and scale up with nearest filtering. Split each fading kind into a solid mesh with no discard and a small fading mesh, because discard turns off early depth on Adreno.
- **Measure it.** Read renderer.info.render.calls and .triangles with actors hidden (world), then in a full 300-enemy frame. Record frame time over a 60 s autorun on a phone. Until then, performance is Not assessed.

## Open questions for the next reference recording

Yes, a new reference run will help. Please send one continuous take per shot, at 1080p and 60 fps, with the HUD on and no edits. Say which character and items you have. Film:

1. **Spawn sweep.** Stand still at the start and turn slowly through 360 deg with the camera level. This confirms the map shows about 1/3 of its width from spawn and the 8-10 silhouette count.
2. **Map size and base speed.** With no speed items, run in a straight line across the map from edge to edge, with the timer visible. This confirms the 250 m map (GUESS) and the run speed.
3. **Top speed.** The same straight run late in a run with speed items. This confirms the 18 m/s figure (GUESS).
4. **Tree and rock scale.** Walk up to a big tree, a hero boulder and a rock group. Stand next to each, then jump beside it. This confirms the 9-11 m tree ratio and the rock tiers.
5. **The edge.** Walk to the boundary and run along it for 20 s. This confirms the cliff heights and the 40-80 m fogged walls (GUESS).
6. **Fog distance.** Pick a landmark and walk straight away from it, with the camera on it, until it disappears. This confirms the 30-40 m crisp and 80-120 m gone figures (GUESS).
7. **Camera.** Stand on flat ground for 5 s, then walk up and down a slope. This confirms the camera height and pitch (GUESS, derived) and how much it tilts on slopes.
8. **Horde and props.** At peak horde, run through a grove and round some rocks. Do enemies path around trees or walk through them? This informs dressing step 1.
9. **Pickups at range.** Look at a chest, a shrine and a pot from about 40 m, then walk up to each. This confirms the readability numbers.
10. **Later stages.** 30 s of free running on stages 2 and 3. What fills the space where there are no trees? This feeds the Stage 2 and 3 targets.

Also confirm on our side: the CSS height of the phone used for play (GUESS 400 px), and a screenshot of our Stage 1 after dressing steps 2-5 to check the computed L* values.

## Decisions still open (not for the recording)

- **Mega landmark height.** Spec section 11 says the colossal card is 18-24 m. Section 18.6 says the mega landmark is 60 m or more. This document assumes 60 m or more. Which wins?
- **Base reach for Stage 1 chains.** This document reads "base reach" in spec 18.5 as the G1 column, which gives 2.5-3.1 m gaps at +1.2 m. If it means the raw jump column, the gaps would be 3.6-4.5 m, which is over the G1 limit. GUESS until the spec says.
- **Tomb Scarab.** It is exempt from the gold rule here. The other choice is to recolour it.
- **Stage 2 and Stage 3.** They have no trees, so they need their own targets for skyline, the 5-15 m band and empty space (rock tiers, card groves, ruin landmarks).
- **Triangle budget.** The 60k limit is a GUESS until the phone run.
