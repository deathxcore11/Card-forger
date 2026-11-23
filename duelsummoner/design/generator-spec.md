# Duel Summoner: Seeded Stage Generator ("Dealer" engine), spec v2

The base is the Dealer engine: socket-matched authored chunks, integer reach tables, a strict integer validator and merged-section rendering. The macro layer on top comes from Seal-and-Socket: named districts, archetype regions on a coarse grid, a readable spine, a repair loop and the risk score. Several Sealstone rules are grafted in: the ledge-band snap, the rhythm chains, elevation-scaled flyer pressure and pre-generation. The goal is a map you almost never see twice, whose platforming still feels designed, and whose bosses, gates and encounters sit where they make sense.

Never describe any of this in the UI by comparing it to another game. Stages, timers, gate bosses, chests and shrines are genre conventions. Every name, kit, map and layout here is our own.

---

## 0. What changed in v2 (verifier fixes)

Two verifiers ran the v1 prototype over 300 maps and failed it. Every fix below is applied in the Node prototype (`duelsummoner/design/generator-prototype`) and written into the sections that follow.

| Problem found | Fix in v2 | Where |
|---|---|---|
| 223 of 1.16 M G1 links could not physically be made (the clearance test ignored the arc and measured from the wrong take-off height) | Jump links are tested against the real ballistic arc from the real lip, with a 30 cm capsule margin. An independent float physics oracle (`tools/physcheck.mjs`) checks the links | §4, G12 |
| The terrace_ring ramp kerb (+1.0 m) created impossible G1 jumps | The kerb is now +0.6 m (rule: ≤ 0.7 m). A test flies a synthetic kerb case and rescans the v1 failure seeds | G6 |
| Every map was the same jagged disc, with spawn and gate on opposite rims, a nearly straight spine and the mega landmark at dead centre | 4 silhouettes; spawn inland; a keystone region that the spine must wind around; the mega landmark sits on the keystone, off centre; new batch gates on silhouette IoU and spine ratio | G1-G3, §7 |
| Large flat plains (p50 48%, max 70%) | Archetype swells, per-region height bias, a 44% cap on any one tier's area, plus plain ≤ 40% and top tier ≤ 55% gates | G4, G7, V19 |
| Economy rule 2 could be bypassed with dash or AIR links, and passive danger discs counted as gates | Rule 2 uses ANY movement, with no danger exemptions | §8 |
| Stages 2 and 3 had no waves and no overtime husk ring | Full wave timelines for both | run structure §2 |
| Stage 2 pits were 1 m dips | Pit floors are 5 m or more below the surrounding ground | G7 |
| CLI crashes and silent wrap-arounds | Seeds, seals and stages are validated, with a usage message | §2 |
| `localeCompare` in a sort | Plain `<` comparison, and lint bans it | §3 |
| Encounters piled into one corner (up to 15 of 27 in one region) | Caps per region and per district, a spread term, district coverage, a lower path-distance weight | §8 |
| A flat, straight spine with nothing happening on it | 1 to 40% RAMP2 tier changes on the spine, a winding route, a gate approach set piece | G3, G4, G8 |
| V12 never gated, and lures[] was empty | V12 gates per encounter, with a plinth repair; lures[] is emitted | §7, §8 |
| 4-8 chunks from about 6 types, and both chains the same type | New chunk types (card_grove, pillar_ring, roof_terrace, ledge_pillars, pillar_steps) and bigger budgets (p50 13-15 chunks per map); the two required chains must be of different types | G5, G6, V16 |
| No district identity | One hero landmark per district, plus kiting groves in open ground | G8, §11 |
| 8-9 boss rings, and the spec had been quietly loosened | 5-7 rings. The 70 m rule is stated honestly: 95% of ground within 70 m, all ground within 100 m, and the gate arena counts as a ring until the gate wakes | G8, V8 |
| Tier-2 ground overlooked nothing; Stage 3 lacked tier 3 and the sand sea | Vantage regions next to the spine or the keystone; Stage 3 must reach tier 3 and contain a Shoal; Stage 2 needs 2 trenches | G4 |
| Dangers sat in loot corners | Danger encounters get a bonus at ramp feet, bridge heads and hop-stair tops | §8 |
| The first timed boss at 3:45 conflicted with "earliest Fusion at 4:00" | The spec now says 3:45, matching the run structure | §8 |
| Generation time about 8x budget | Profiled and stated honestly; not yet fixed | §12, §17 |

---

## 1. Goals, in priority order

1. **Same seed, same map, on every device.** A seed plus the engine version plus the chunk-library hash must give byte-identical output on Node, Chrome and the Android build.
2. **Every map is fair.** Every required thing can be reached with run and jump only. There are no soft-locks, enemies can always reach you, and there is always room to spawn around you.
3. **Every map is fun.** Platforming comes from hand-authored chunks. Parkour routes beside the safe path save time. Rewards sit off the safe route, and you can see them from it.
4. **Every map is different.** The district draw, region graph, tiers, chunk choice and encounter slots all come from the seed. Repeats are measured in CI.
5. **Every map is cheap.** It runs at 60-120 fps on Android handhelds, generates in 150 ms or less on PC, and is hidden behind transitions.
6. **It always terminates.** There are bounded repairs and attempts, then an authored fallback layout.

---

## 2. Seed format

- **Seal Code:** 8 Crockford base32 characters (0-9 and A-Z without I, L, O, U), encoding 40 bits as `runSeed40`. The UI calls it "Seal Code". It is shown on the Descent interlude card and on the results screen, and you can type it in for shared or daily runs. A new run draws its seed from `crypto.getRandomValues`.
- **Derivation, all in 32-bit integers** (`Math.imul`, `>>> 0`):
  - `lo = runSeed40 & 0xFFFFFFFF`, `hi = runSeed40 >>> 32` (8 bits)
  - `stageSeed = splitmix32(lo ^ imul(hi + 1, 0x85EBCA6B) ^ imul(stageIndex + 1, 0x9E3779B9) ^ GEN_VERSION)`
  - `attemptSeed = splitmix32(stageSeed + imul(attempt, 0x632BE5AB))`
  - `rng(step) = xoshiro128**` seeded by four `splitmix32` outputs from `attemptSeed ^ fnv1a32(stepName)`
- **Step streams:** `districts`, `regions`, `graph`, `tiers`, `terrain`, `chunks`, `scatter`, `encounters`, `events`, `repair`. Tuning one step never shifts another.
- **Input validation (CLI and debug entry):** a typed seed must be an integer in 0 to 2^40-1, a Seal Code must be exactly 8 valid Crockford characters, and a stage must be 1-3. Anything else is rejected with a usage message and exit code 1. Values are never wrapped or coerced.
- **Map hash:** xxHash32 over the canonical bytes of h0, h1, flags, nav, instances, slots, encounters and anchors, plus `GEN_VERSION` and `libHash` (the xxHash32 of the sorted, canonicalised chunk JSON). The hash appears in the F3 debug overlay and in golden tests.

---

## 3. Determinism rules (enforced by lint in `src/gen`)

- **Banned in `src/gen`:** `Math.random`, `Math.sin`, `cos`, `tan`, `atan2`, `pow`, `exp`, `log`, `sqrt`, `hypot`, and any float arithmetic that feeds a stored value. Use `isqrt32` (integer Newton) and Q16.16 helpers. Angles are 90-degree steps for pieces. Scatter yaw is a 16-step lookup table and only affects visual instances.
- **Units:** positions are integer centimetres, and heights are int16 centimetres.
- **Sorting:** every array is sorted by an explicit integer key with an `id` tiebreak before any random pick. Iteration over `Map` or `Set` is forbidden unless it goes through sorted keys. String keys compare with plain `<` / `>` on ASCII ids. `localeCompare` and `Intl` are banned, because their results depend on ICU and locale data (Android and Hermes ship different tables). The test lint enforces this.
- **Piece transforms:** pieces rotate in 90-degree steps plus mirror (8 variants, precomputed at load). There are no free rotations.
- **Dynamic platforms (stage 3):** their phase comes from the 60 Hz sim tick count, never from wall-clock time.

---

## 4. Movement numbers and the reach table

The reach table is generated by `tools/gen-reach.mjs` from movement constants in `src/data/movement.json` (run 9 m/s, jump apex 2.2 m, gravity 28 m/s², dash 26 m/s for 0.16 s, dash cooldown 1.1 s). It is checked in as `src/data/reach.json`, the only place gen code reads these numbers. The build script may use floats; gen code reads only the integer cm results.

**Derived values**

- Take-off speed v0 = 11.10 m/s. Time to apex 0.396 s. Flat airtime 0.793 s.
- Airtime landing at height change dh (up is positive): `T(dh) = 0.396 + sqrt(2(2.2 - dh)/28)`.
- Raw jump reach = 9 x T(dh).
- Dash = 4.16 m. It replaces 1.44 m of running, so it adds 2.72 m. The validator assumes gravity keeps acting during a dash, which is conservative.
- Flat jump + dash raw reach = 9.86 m.
- **Safety factor is 0.70 for all link classes.** Coyote time (0.10 s) and jump buffer (0.10 s) are player margin only and are never counted.

| dh | Raw jump | Required max gap (G1) | Dash gap max (G2, optional only) |
|---|---|---|---|
| +1.5 m | 5.58 m | 3.9 m | 5.8 m |
| +1.4 m | 5.72 m | 4.0 m | 5.9 m |
| +1.0 m | 6.20 m | 4.3 m | 6.2 m |
| 0 | 7.14 m | 5.0 m (authored ≤ 4.5 m on required paths) | 6.9 m (authored 5.5-6.5 m) |
| -1.5 m | 8.19 m | 5.7 m | 7.6 m |
| -3.0 m | 9.05 m | 6.3 m | 8.2 m |
| -6.0 m | 10.46 m | 7.3 m | 9.1 m |

Gap is measured edge to edge. Intermediate dh values interpolate linearly between rows, rounded down to the cm.

**Arc test for every sampled jump link (v2).** The reach table gives the longest gap. On top of that, every terrain-sampled HOP, G1 or G2 ray is checked against the real arc, in integers:

- Arc constants: horizontal speed `V = 900` cm/s, take-off speed `V0 = 1110` cm/s, `G = 2800` cm/s². Height above take-off after `d` cm of horizontal travel: `arcY(d) = trunc((1110 x 900 x d - 1400 x d²) / 810000)` cm.
- **Take-off point** is the last cell of the jumper's own surface before the ray leaves it (the real lip), not the start cell. This matters when the ray first walks down a slope. `dh = landingHeight - takeoffHeight`.
- Each sample uses the lower of the arc heights 25 cm before and 25 cm after it (`yLo`), which accounts for cell size.
- **Obstacle rule:** for every cell the arc passes over, `groundHeight + 30 cm (capsule margin) - takeoffHeight <= yLo`. If not, the ray stops.
- **Landing rule:** the landing height must be at or below the arc (`yLo >= dh`) at the landing sample.
- The 0.70 safety factor on gap length still applies on top of this.

`tools/physcheck.mjs` is an independent float-physics oracle that is allowed to use floats, because it never feeds generated data. It re-flies every HOP, G1 and DROP link reachable from spawn, with ±7° heading spread, and fails any link a capsule cannot make.

**Step and slope rules.** These are the single source of truth, on the 1 m height grid. They replace the conflicting "0.45 m per cell" and "35/40 degree" rules from the earlier designs.

- **Player walk:** rise of 0.70 m or less between adjacent 1 m cells (35 degrees).
- **Enemy walk:** rise of 0.60 m or less per 1 m (31 degrees). An enemy nav edge at 2 m resolution is passable only if every 1 m sub-step along it passes.
- **Ramps** are carved at 1:2 (0.5 m per m, 26.6 degrees) and are 8-12 m wide.
- A discontinuity over 0.75 m across one cell is a **ledge**.
- **Hop ledge (required-safe):** 1.2-1.5 m. The authored standard is 1.4 m.
- **Optional skill ledges:** 1.6-1.8 m. They lead only to coins or vases.
- **Forbidden band:** any walkable-adjacent rise in 1.8-2.6 m is illegal. The terrain pass snaps it to 1.4 m or 3.0 m, and CI lints authored chunks for it.
- **Tier step = 3.0 m.** That is a wall for everyone unless there is a ramp, a hop staircase (2 x 1.4 m plus a 0.2 m step) or a portal.

**Link classes**

| Class | Rule | Counts for guarantees |
|---|---|---|
| WALK / RAMP | step rules above | yes |
| HOP | ledge 1.2-1.5 m, take-off depth ≥ 3 m | yes |
| G1 jump gap | within the G1 column | yes |
| DROP | any height, landing pad ≥ 4 x 4 m, one-way | yes, if the landing rejoins spawn's strongly connected component (SCC) |
| G2 dash gap | 5.5-6.5 m flat (per table), runway ≥ 4 m | no; optional shortcuts or coin lines only, and a jump-only route to the same place must exist |
| AIRJUMP | ledges 2.6-3.6 m or gaps ≤ 8 m, needs the unlock | no; coins only |
| DYNAMIC | a flipping or drifting platform edge (stage 3) | no; the validator runs with all dynamics "off" |

**Geometry rules**

- Under-deck clearance is at least 4.5 m.
- Landing pads are at least 3 x 3 m, and at least 4 x 4 m after a drop.
- Take-off lips are at least 3 m deep.
- Downhill slide runs (8-25 degrees, at least 12 m long) feed into G1 gaps.
- **Edge colour language** (vertex-colour trim strips 0.15-0.3 m):
  - gold: jump lip
  - blue rune: dash gap
  - red: drop edge
  - a lighter top tone: player-only surfaces

---

## 5. Stage sizes and structure (from StageSpec)

| | Stage 1 Surface Ruins | Stage 2 Sealed Catacombs | Stage 3 Vault of the Last Duel |
|---|---|---|---|
| Grid | 15 x 15 cells of 24 m = 360 m (≈312 m playable inside the border ring) | 14 x 14 = 336 m (≈288 m) | 15 x 15 = 360 m (≈312 m) |
| Named districts | 4 drawn from 5 (Colosseum always) | 4 drawn from 5 | 4 drawn from 5 (Duel Table always) |
| Regions | 12-15, scaled down by silhouette area (minimum 10) | 11-14, scaled by area | 12-15, scaled by area |
| Silhouettes | round, lobed, crescent, twin-basin (seeded) | same 4 | same 4 |
| Tiers used | 0-2 (0/3/6 m); tier weights 40/35/25 | 0-2, plus at least 2 sunken trench regions at tier -1 (-3 m) | 0-3 (up to 9 m); tier 3 is required; at least 1 Shoal region holds the sand sea |
| Falls | no pits: gullies 3 m deep with exits every 20 m or less | pits are real chasms (floor 5 m or more below the trench floor): -10 LP and respawn on last safe ground | sand sea: -15 LP and respawn |
| Layers | ground plus sparse deck layer | ground plus deck (the "floors" are trenches with bridges, not stacked floors) | ground plus deck, plus optional dynamic platforms |
| Gate set piece | Colosseum floor (Stone Arbiter) | Seventh Door vault (Seal Weaver) | Duel Table (Hollow King) |
| Spine length | 190-290 m, path/straight ≥ 1.15 | 175-270 m, ≥ 1.15 | 200-300 m, ≥ 1.15 |
| Opening radius (economy) | 90 m | 80 m | 90 m |

**v1 scope.** All three stages are built from the Surface Ruins kit:

- Stage 2 uses a cool palette swap, trench archetypes and chain-bridge decks.
- Stage 3 uses a gold-and-black swap, the sand sea and card platforms.
- Each later stage adds 6-10 unique set-piece chunks.

Full Catacombs and Vault kits come after Stage 1 ships on the generator.

**Named districts.** Each district is a pool of region archetype weights plus a landmark family and an encounter bias.

- **Stage 1 pool:**
  - Sunken Colosseum: holds the gate set piece; Plaza and Terraces.
  - Market of Tablets: Necropolis rooftops.
  - Hall of Sealed Cards: Card Graveyard plus a deck gallery.
  - Dragon's Spine: Canyon, bone bridges, Mesa.
  - King's Stair: Terraces and Mesa.
- **Dunes** is the filler archetype in every district.
- **Stage 2 pool:** Ossuary Galleries, Sarcophagus Halls, Chain Bridges, Niche Walls, the Seventh Door Vault (gate).
- **Stage 3 pool:** Duel Table (gate), Treasury Terrace, Fallen Kings, Card Shoals, Throne Stair.

**Region archetypes** (7): Plaza, Dunes, Necropolis, Card Graveyard, Canyon, Mesa, Terraces. Stages 2 and 3 add Trench and Shoal.

- The spawn region is always a Plaza.
- One region per map is the **keystone**: the region nearest the midpoint of the spawn-to-gate line. The spine never passes through it, it is raised to vantage height, and it carries the mega landmark.
- The gate region is always the set-piece arena.
- Two Canyon or Trench regions are never adjacent.

---

## 6. Pipeline

Every step is a pure function over typed arrays. The step list runs in this order and writes a `GenContext`.

### G0. Seed and spec
Decode the Seal Code, derive `stageSeed` and `attemptSeed`, and load `StageSpec[stageIndex]`, the chunk library (with precomputed variants) and `reach.json`.

### G1. Districts (coarse grid, 8 m cells)

1. Build the playable mask from one of **4 silhouettes**, chosen by the `districts` stream: `round` (superellipse, exponent 3), `lobed` (3-5 integer lobes), `crescent` (a disc with an offset bite), `twin` (two basins joined by a waist). Each is rotated by a seeded direction.
   - Its edge is pushed in and out by ±1 coarse cell with 1D integer value noise.
   - Only the largest 4-connected component is kept.
   - Outside the mask is cosmetic dune or cliff rim with an invisible collider.
   - Fallback layouts always use `round`.
2. Draw 4 districts from the pool of 5, weighted. The gate district is mandatory.
3. Place district seeds:
   - **gate district seed:** 5-7 coarse cells (40-56 m) inside the rim, so the 72 m footprint fits;
   - **spawn district seed (inland):** at least 4 coarse cells (32 m) from the rim, and at 0.50-0.85 x the playable diameter from the gate. With 50% chance it is drawn from the inner pool (within 0.55 x the radius of the centre). The spawn-to-gate angle about the centre therefore varies (measured 81-180°, p50 about 150°);
   - the other two seeds are farthest-point sampled.
4. Grow districts with multi-source BFS on the coarse grid. Ties break by `hash32(cell, districtId)`, which gives Voronoi-like regions with jittered borders without float Voronoi.

### G2. Regions

1. Inside each district, Poisson-sample region seeds on the coarse grid:
   - minimum spacing 7 coarse cells (56 m), or 6 when the playable area is under 1,000 coarse cells;
   - best of 20 candidates;
   - total region count per the StageSpec range, scaled by playable area (minimum 10).
2. Grow regions with the same jittered BFS, constrained to stay inside their district.
3. Assign archetypes from the district weights, applying the archetype rules (§5). `requireArche` in the StageSpec forces minimum counts (Stage 2: 2 Trench; Stage 3: 1 Shoal).
4. Fix the spawn region: a Plaza disc of 34 m.
5. Fix the gate region: the set-piece footprint, 3 x 3 cells = 72 m, which includes the arena, the stands or ramps and 2-3 entrances.

### G3. Region graph and spine

1. Build the adjacency graph: two regions are adjacent if they share 3 or more coarse border cells.
2. Take a minimum spanning tree weighted by `centreDist x (1000 + jitter0..300)/1000`, then add back about 30% of the non-tree edges as loops (see §6 constraint 4).
3. **Keystone and winding spine.** Pick the keystone region (nearest the midpoint of the spawn-gate line). The spine is the shortest region path spawn → waypoint → gate that never enters the keystone and never revisits a region. The waypoint is a seeded shuffle of the remaining regions. The first route whose length estimate fits the range wins.
   - **Early reject** (`spine_straight_est`): if the estimate is below `(spineRatioMin - 5)%` of the straight spawn-gate distance, redraw.
   - After terrain, the real spine is measured. `ratio100 = path / straight x 100` must be at least `spineRatioMin` (115). The batch gate requires a p50 of 130 or more; measured p50 is 139-151.
   - Layout rejects like this cost 10-120 ms, so up to 16 layout redraws happen inside one attempt before attempt+1.
4. Tag regions:
   - **Spine:** wide and readable; walk or ramp transitions only.
   - **Branch:** rewards and platforming.
   - **Pocket:** a single-edge cul-de-sac with a strong reward plus a loop-back drop.

**Constraints**

1. At least 2 independent cycles.
2. The spawn region has degree 3 or more.
3. No dead end longer than 45 m without a reward or a loop-back drop.
4. At least one cycle of 80 m or more passes within 40 m of spawn, for kiting. A Husk Runner at 7 m/s is slower than the player at 9 m/s.

### G4. Tiers

Assign region tiers by a constrained seeded walk over the graph.

- Neighbouring regions differ by at most 1 tier.
- On the spine, **at least 1** and at most ceil(40%) of edges change tier (RAMP2). If the walk gives none, a middle spine region is lifted.
- The spawn region is tier 0.
- The gate region uses its set-piece tier (stage 1: tier 0).
- The keystone is raised first, then **vantage regions adjacent to the spine, the keystone or the gate**. At least 2 regions sit at tier 2 or higher, and they must border the spine or the gate.
- Stage 3 (`needTopTier`): tier 3 must appear. The walk climbs step by step through tier 2 to reach it.
- No single tier may cover more than 44% of the playable area (`maxTierAreaPct`).
- About 40% of branch regions sit above their neighbours.

Each graph edge then gets a transition type:

| Type | Rule |
|---|---|
| OPEN | same tier |
| RAMP2 | enemy-walkable tier change. **Two** ramps, each 8-12 m wide at 1:2, so the swarm has 2 approaches. Required on every spine edge and on at least 60% of the others |
| HOPSTAIR | a player-only cliff crossed by a hop-staircase chunk |
| DROP | one-way, used to loop back out of Pockets |

Non-adjacent region borders become 3 m cliffs.

### G5. Cell roles (24 m chunk grid overlay)

1. A cell becomes **STRUCT** (it gets an authored chunk) if 7 or more of its 9 coarse cells belong to one region and that region's archetype feature budget wants a chunk there. Budgets per region:
   - Plaza: 1 hub chunk plus a card grove or a pillar ring (kiting obstacle);
   - Necropolis: 2 roof terraces (with a 1:2 enemy ramp and a player-only step) plus 1-2 roof runs;
   - Card Graveyard: 2 plus a card grove;
   - Canyon and Trench: 1-2 bridge chunks along the channel;
   - Shoal: bridges and card platforms over the sand sea;
   - Mesa: 1 climb chunk plus a pillar ring;
   - Terraces: 1-2 plus a card grove;
   - Dunes: a slide ramp plus 1-2 groves or pillar rings.
   - **Spanning chunks** (card_grove, pillar_ring, hub_plaza, card_field) may straddle a border between two regions of the same tier.
   - Target: 12-20 STRUCT chunks per map. Measured p50 is 13-15 (range 7-26) on 150 maps. The low end comes from small silhouettes.
2. Every RAMP2 and HOPSTAIR border picks a **CONNECTOR** cell or a carved terrain ramp.
3. Everything else is **TERRAIN**.
4. STRUCT footprints are 1x1, 2x1 or 2x2 cells. Variety penalty:
   - the same chunk id may not repeat within 3 cells;
   - each chunk has its own `maxUses`.

### G6. Chunk solve

**Sockets.** Each 24 m cell edge is 3 segments of 8 m. Each segment socket is `{kind, tier}`:

| Kind | Meaning |
|---|---|
| W | wall |
| F | floor |
| D | deck (layer 1) |
| H | hop lip (1.4 m) |
| G | gap edge that continues into the neighbour |
| **T** | terrain apron: floor at that tier with a 4 m blend skirt, which the terrain pass must match |

Neighbouring STRUCT edges must match exactly after rotation and mirror. STRUCT edges that face TERRAIN must be T or W.

**Candidates.** Chunks are filtered by role, footprint, archetype, stage range and the required sockets, across all 8 variants. A candidate's score is `weight x varietyPenalty x rhythmBonus`:

- **rhythmBonus = 1.5** if the candidate completes a parkour chain: 3-6 linked moves (ramp, hop, gap, slab, drop) covering 25-60 m, running parallel to a spine edge within 8-30 m and saving 10-35% travel time over the walk route (widened from 30% in v2; a 33% saving is still an optional shortcut);
- target at least 2 chains per stage, and **the two required chains must be different chunk types**. Chain types: `slab_climb`, `pillar_steps` (tier-border climbs with different rise patterns), and the self-contained fallbacks `ledge_climb` and `ledge_pillars` (33 x 22 m, compact enough for small regions). If the first chain is a `ledge_climb`, the fallback uses `ledge_pillars`.
- **Kerb rule:** no SOLID kerb, rail or lip within 2 m of a jump line may stand more than 0.7 m above the take-off surface. The terrace_ring kerb is +0.6 m.

**Backtracking:**

1. Backtrack locally within a radius of 2 cells.
2. On failure, demote the cell to TERRAIN if the region budget allows.
3. Otherwise return to G5 with sub-attempt+1 (at most 3 times).
4. Then attempt+1.

### G7. Terrain sculpt (TERRAIN cells; 1 m heightfield, int16 cm)

This is what makes the map read as non-grid.

1. **Base height** is the region tier. Region borders are hard cliffs at the jittered 8 m boundary, refined to 2 m with a hash-noise wobble of ±1 cell.
2. **Archetype detail** uses 2-octave integer value noise, plus **swells** (amplitude in cm, wavelength in m) that break up plains:
   - Plaza: swell 100 cm / 48 m, fine detail ±0.15 m;
   - Dunes: swell 90 cm / 48 m, plus ±1.0 m at 24 m, giving slide lines;
   - Necropolis: 80 / 40; Card Graveyard: 90 / 40; Terraces: 55 / 40; Mesa: 40 / 40; Trench: 40 / 40.
   - **Per-region bias:** each region gets a seeded offset of -90 to +90 cm, faded to 0 over 6 m at its borders, so neighbouring same-tier regions sit at visibly different heights.
   - Canyon or Trench: a carved channel 5-7 m deep and 14-24 m wide along an integer Catmull-Rom path on the coarse grid, with exit ramps every 20 m or less in stage 1.
   - **Stage 2 pits:** pit floors sit at `trenchTop - depth - 500 cm`, so a pit is a chasm of 5 m or more, never a 1 m dip.
   - Border distances use a lookup table instead of a per-cell search (profiling fix).
3. **Undulation** never applies within 3 m of a lane, a jump lip or a T apron.
4. **Ramps** for RAMP2 edges are carved along an integer spline: 1:2 rise, 8-12 m wide, 1 m shoulders.
5. **Aprons:** flatten every T apron to the socket tier.
6. **Snap pass:**
   - any walkable-adjacent rise of 1.8-2.6 m snaps to 1.4 m or 3.0 m, whichever is nearer;
   - any rise of 0.75-1.2 m that is not authored becomes a slope (relaxed) or a 1.4 m lip.
7. **Slope clamp:** 3 relax passes on non-cliff cells.
8. **Flags:** the cliff wall bits per side are written here.

### G8. Arenas and reservations

These are reserved before scatter, and no kit may touch them.

- **Gate set piece:** the authored 3 x 3-cell chunk, already placed.
- **Timed-boss rings:** 5-7 discs.
  - Each has radius 14 m or more, slope 15 degrees or less and no cliff inside.
  - Each is enemy-reachable and player-reachable.
  - **The gate arena floor counts as a ring** until the gate wakes (both timed bosses come before the wake).
  - **Coverage rule (honest form):** 95% of enemy-reachable ground within 70 m path distance of a ring or the arena, and all of it within 100 m. With 7 rings on a 312 m map, "every cell within 70 m" is not reachable on winding silhouettes (the worst cell was 90-120 m), so v2 states the real target. The director adds a sky beam when the chosen ring is more than 70 m away (§9).
  - The placer works to a 10 m tighter target (60 m / 90 m), because chunks placed later add detours. Greedy farthest-point placement is followed by up to 40 local-search moves (120 evaluations).
  - Use authored `ring_open_r14` slots first, then flatten terrain.
- **Gate approach set piece:** along the arena's main entrance direction, obelisk pairs at 32, 40 and 48 m out (±9 m off the axis), then a sealed arch at 56 m. They frame the gate from a distance, and every piece keeps 7 m clear of the spine.
- **Mega landmark:** placed on the keystone region's centre (or a seeded point in the centre third), clear of the spine corridor and reserved discs. Measured offset from the map centre: p50 36-43 m, max 94 m.
- **District heroes:** one 4 x 4 m SOLID hero landmark, 9 m tall, per district, near the district seed: market awnings, hall-of-cards facade, fossil spine ribs, King's Stair facade, and Stage 2/3 equivalents. The gate district's hero is the arena stands.
- **Elite ambush pockets:** 3-5, with R 1.5 or more.
- **Spawn basin:** a 34 m disc with no encounter inside 20 m and no tall kit inside 30 m on the camera side.

### G9. Stamp

Write each chunk into:

- h0 (ground), and h1 (decks, only as sparse rects);
- flags: `walk | field | lane | hazard | spawnBlock | occluder | playerOnly | slide | safeGround | pit`;
- colliders, kit instances, nav portals, authored jump links, tagged slots and landmarks.

Seams are exact because the sockets match.

### G10. Scatter

Integer Poisson-disk placement, on field and terrain cells only:

- debris, broken pillars, small stone cards, bone piles;
- never in 3 m lanes, landing zones, the spine corridor or arenas;
- anything under 0.45 m has no collision.

**Vases** use these slots in order:

1. jump-line breadcrumbs: on gap lips, stair tops and slide lanes, so they teach routes;
2. `vase` slots;
3. field scatter.

### G11. Nav bake

**Flow graph**

- Resolution 2 m. Nodes are `(cell, layer)` with `id = cell * 2 + layer`.
- Layer 0 covers every cell. Layer 1 exists only under deck rects, typically 4,000 cells or fewer.
- An edge is passable if every 1 m sub-step passes the enemy step rule and clearance is 2.2 m or more.
- Lips, gaps and hop ledges have no enemy edges.
- Layer changes happen only at authored portals.
- Costs: flat 10, ramp 14, deck 10, hazard 30.

**Precomputed lists**

- Spawn candidates per 8 m macro cell: layer-0 cells in the main enemy component, not in a pocket, plaza wall or spawnBlock, sorted by id.
- Boss rings.
- Glass Seer perches: enemy-reachable cells that sit higher than the lanes they look at, with line of sight to those lanes.
- Ram Golem charge lanes: straight runs of 15 m or more.
- Player-only foot rings: walkable enemy cells within 3 m of each player-only footprint.
- Stage 3: Gilded Hound jump links. These are a subset of the authored G1 links tagged `houndOK`.

### G12. Player traversal graph and validation

Build the graph over 1 m support cells:

- walk edges;
- HOP, G1 and DROP links from authored jump lists plus sampled terrain lips (sample every 2 m along cliff and gully edges, 16 directions, out to 8 m, checked against the table);
- G2 and AIRJUMP links tagged;
- dynamic links tagged.

Then run every metric in §7, cheapest first.

### G13. Repair loop (stream `repair`, at most 4 passes)

Each failure kind has a targeted, deterministic fix. **After every fix, all earlier metrics are re-run.** A fix that breaks a previously passing metric is reverted, and the next fix option is tried.

| Failure | Fixes, in order |
|---|---|
| Unreachable reward slot | move it to the best reachable slot within 30 m; swap the blocking chunk for a lower-gap variant; stamp a hop staircase |
| Soft-lock region | add a hop staircase on the lowest cliff; add a ramp (if enemies also lack access); delete the structure |
| Spawn ring fails at P | open a ramp on the nearest cliff in the annulus; carve a spawn alcove; demote an enclosing STRUCT to TERRAIN |
| Island too large or uncovered | add an enemy ramp; split it with a gap; add a Seer perch |
| Economy | push the reward 40 m or more further down its branch; add a guard (an elite pocket or Duel Statue adjacency) |
| Lure or visibility | raise the landmark on a plinth (+3 m), which placement already does when that makes it visible; swap in the larger landmark variant |
| Boss-ring coverage | add a ring near the worst cell (if under 7); move the nearest ring towards it |
| Perf | drop scatter, then downgrade feature chunks to low-detail variants |

If it still fails after 4 passes, attempt+1 (back to G1). After 8 attempts, the generator tries up to 6 **authored fallback layouts** for that stage. These are hand-made region graphs, still chunk-filled and terrain-sculpted from the live library, and validated in CI. They are not frozen maps.

### G14. Encounters, events, emit

- **Encounter placement** runs as described in §8, then the economy check.
- **Event anchors** (§9).
- **Minimap:**
  - 256 x 256, tier tones (darker = higher), cliff lines, ramp chevrons, deck outlines;
  - an icon list that is revealed on line of sight to the landmark or within 60 m;
  - shrines, statues and gates stay marked once seen.
- **Hash** the canonical bytes.
- **Emit** the StageMap.

**View build** happens outside `src/gen`:

- merge static geometry per 96 m super-section;
- build InstancedMesh buckets;
- start the stage-intro animation.

---

## 7. Validation metrics and thresholds

All checks are per seed unless marked CI.

| # | Metric | Threshold |
|---|---|---|
| V1 | Determinism (CI) | golden seeds identical on Node, Chrome and Android; 500 seeds per stage |
| V2 | Required reachability (jump-only: WALK, RAMP, HOP, G1, DROP) | 100% of encounter slots, chest pedestals, boss rings, elite pockets, the gate entrances and the gate interior |
| V3 | No soft-locks | every cell reachable by any link (including G2, AIRJUMP and dynamic) lies in spawn's SCC using base links only (Tarjan) |
| V4 | Fall recovery | Stage 1: gully exit ramp within 20 m everywhere and zero `pit` cells. Stages 2-3: every pit-edge cell within 12 m of a `safeGround` respawn cell of 3 x 3 m or more that lies in the spawn SCC |
| V5 | Enemy coverage | ≥ 95% of walkable layer-0 cells are in the main enemy component, and all enemy-unreachable walkable area is ≤ 8% |
| V6 | Player-only islands | each single perch ≤ 64 m²; each connected island ≤ 120 m²; 4-8 islands per stage; each within 25 m of a Seer perch and 18 m of open flyer approach |
| V7 | Spawn ring | at samples every 8 m along the spine, plus a 16 m lattice: ≥ 40% of the **ground** in the 22-30 m annulus is valid spawn cells (chasm and sand-sea cells are excluded, since flyers cover them) and at least 150 m² is valid; ≥ 3 of 8 compass sectors reach the sample by an enemy path ≤ 1.8 x straight-line distance (up to 8 targets per sector, spread over the sector). At most 3% of samples may have fewer sectors, never 0. On islands, measure from the foot ring |
| V8 | Boss rings | 5-7 rings (the arena also serves until the gate wakes); 95% of enemy-reachable ground within 70 m path distance, all within 100 m |
| V9 | Spine | length within spec; path/straight ≥ 1.15 (fallback exempt); width ≥ 12 m; nothing taller than 1.2 m inside except landmarks; walk or ramp only; at least 1 and at most ceil(40%) of edges change tier |
| V10 | Readability | lanes ≥ 6 m; deck clearance ≥ 4.5 m; no unflagged occluder within 4 m of a lane on the camera side; at most 3 feature chunks per 32 m |
| V11 | Lure | along the spine, every 40 m there is line of sight (heightfield ray from the 1.7 m eye and from the camera point 3 m up and 7 m back) to an off-route encounter landmark within 35 m |
| V12 | Landmark visibility (**gating** in v2) | each encounter landmark is visible from ≥ 1 spine sample within its tell range (column tells such as Witness Stones, Shrines and the sealed fragment: top 25 m, 120 m range; others 60 m). For rewards on non-spine branches, an approach point (ramp end, hop-stair top or region centre) also counts. Shrines, Broker and Duel Statues need ≥ 3 spine samples. Golden statues and the hidden Stage 1 Echo Forge are exempt, because they are secrets. The mega landmark must be seen from ≥ 75% of walkable samples. Every district needs its hero landmark |
| V13 | Economy | see §8; zero violations |
| V14 | Branch value | every Branch and Pocket region holds ≥ 1 reward of R ≥ 1; no empty branches |
| V15 | Jump lint | no rise in 1.8-2.6 m next to walkable cells; every required link within G1; every G2 has a jump-only alternative to the same SCC node within 1.6 x path |
| V16 | Rhythm | ≥ 2 parkour chains per stage (3-6 moves, 25-60 m, saving 10-35%) of **≥ 2 different chunk types** |
| V17 | Perf budget | ≤ 250k static tris per map; ≤ 90k visible from any spine sample; world draw calls ≤ 40, counting only kits with 2 or more instances as instanced buckets (single kits merge into sections); prop instances ≤ 2,000 |
| V18 | Generation time (CI) | ≤ 150 ms median on PC (Worker); ≤ 400 ms p95 on the reference handheld |
| V19 | Variety and flatness | collisions on graph topology plus tier signature < 0.1% (CI, 10k seeds per stage); per seed: the largest connected plain (cells within ±1 m of the flood start) ≤ 40% of walkable area, the top tier ≤ 55%, ledge count ≥ 25 |
| V20 | Robustness (CI) | target: ≥ 95% of seeds pass at attempt 0-1, fallback rate < 0.5%; socket coverage report shows ≥ 2 chunks per used socket combination. **Prototype gate today:** 100% final pass, first try ≥ 50%, attempt 0-1 ≥ 70%, fallback ≤ 5% |
| B1 | Macro variety (batch) | silhouette IoU mean ≤ 0.85 across a stage's maps; spine ratio p50 ≥ 1.30; largest plain max ≤ 40%; 0 signature or hash collisions. The batch also reports spawn and gate polar positions, the spawn-gate angle, mega offset, chunk and hero counts, the busiest district and region, and the shortest free item + free level route over ANY links |
| B2 | Physical links (CI sample) | `tools/physcheck.mjs --edgesOnly` finds 0 HOP, G1 or DROP links reachable from spawn that a capsule cannot fly |

---

## 8. Encounter placement

### Slot tags (authored in chunks, plus terrain-generated)

`ring_open_r10`, `ring_open_r14`, `high_perch`, `pocket_end`, `hub_edge`, `pedestal`, `vase`, `landmark_big`, `reward_port` (roof end, pillar top, bridge middle), `gate`, `second_seal_door`.

### Risk score

`R = offSpine/40 m + gate + exposure + guard`

- **offSpine:** path distance from the spine, in metres.
- **gate:** walk 0, HOP or G1 0.5, island 1.0. Dash never counts, because required content is jump-only.
- **exposure:** 0-1, the enemy-walkable open fraction of the 12 m radius around the slot.
- **guard:** Duel Statue 1.5, Shrine hold 1.0, adjacent elite pocket 2.0.

Each type has a minimum R and spacing rules. Placement order is rarest first: gate, Second Seal, Witness Stones, Echo Forge, Broker, Duel Statues, Shrines, Anvils, Altar, Scales, Covenant, Bone Oaths, Magnet Tablets, golden statues, sealed fragment, Card Chests, vases.

Each slot is scored as `score = 0.25 x norm(pathDist) + 0.30 x norm(R) + 0.20 x norm(detourCost x (0.5 + exposure)) + 0.10 x spreadFromSameType + 0.15 x spreadFromAnyEncounter`. Placement is greedy, highest score first.

**Spread caps (v2).**

- At most **3 encounters per region** and at most **35% of the planned encounters per district** (vases excluded). If a type cannot be placed under the caps, the caps relax for that type only. Measured busiest region: p50 3-4, max 5. Busiest district: p50 32-33%, max 39%.
- **District coverage:** after the greedy pass, each of the 4 districts must hold at least one DANGER encounter and at least one free or paid reward. A missing one is moved in from the district that holds the most of that class (and at least 2): any danger type, or a Card Chest for rewards.
- **Contested crossings:** danger encounters (Shrine, Duel Statue, Bone Oath) get +0.25 for slots within 12 m of a ramp foot, a bridge head or a hop-stair top. This puts the risk on the choke instead of in the loot corner.
- **Visibility at placement:** a slot whose landmark is not visible from the spine (V12 rule) is skipped. If no visible slot is left, the landmark goes on a +3 m plinth if that makes it visible.
- **Wrapped Mimics** (Stage 2: 2) are placed on chest slots by the generator, class MIMIC.
- **lures[]:** for any 40 m stretch of spine that still sees no off-route landmark, the generator carves a 6 m lure obelisk on an off-route cell 10-30 m away. `lureLinks[]` records, for every spine sample, which landmark it sees. The run can use it for tutorial callouts.

### Economy classes (reconciled with the bible)

- **FREE_ITEM:** Witness Stone (1 item from 3), Echo Forge (a chance to copy an item).
- **FREE_LEVEL:** Deck Anvil (+1 level on one monster), Magnet Tablet (pulls every crystal on the map).
- **FUSION_SRC:** Sealed Chest only. It is never placed by the generator. It drops from the two timed bosses and the gate boss of each stage, so the earliest Fusion always costs a timed-boss kill (Stage 1, 3:45, the Sealed Warden; this matches the run structure).
- **DANGER gates:** Shrine hold, Duel Statue, Bone Oath pile, elite pocket, Golem charge lane, an exposure ≥ 0.6 crossing.
- **Paid:** Card Chest, Relic Broker.
- **Utility or risk:** Altar of Tribute, Scales, Broken Covenant, Second Seal.

### Economy rules

1. **Opening region** = path distance from spawn at or below `spec.openingM` (90 m in stage 1). It holds at most **one** free-class reward. No Witness Stone and no Anvil may be there.
2. **Item + level distance (v2):** the shortest route from spawn that collects one FREE_ITEM and one FREE_LEVEL, in either order, using **ANY** links (walk, hop, G1, drop, dash G2, AIR), must be over 180 m. No danger disc is exempted. At 9 m/s that is at least 20 s of pure running before both are in hand; in practice the elite (1:45) and the first waves come first. Measured minimum over 150 maps: 179 m (one map at the boundary, from rounding to 10 cm); p50 211-229 m.
3. Witness Stones and Deck Anvils sit in **opposite halves** by spawn-path distance rank, and on **different tiers** where both exist.
4. The Echo Forge sits at least 200 m from spawn, in a Pocket or behind a breakable wall (stage 2).
5. Card Chests: at most 2 within 60 m of spawn.
6. A violation swaps the offending encounter to its next-best slot, preferring slots far from the other free class. After 16 swaps, the repair loop runs.

### Per-stage counts

| Encounter | S1 | S2 | S3 | Rules | Landmark and tell |
|---|---|---|---|---|---|
| Card Chest | 8 | 7, plus 2 Wrapped Mimics on chest slots (generator-placed) | 6 | `pedestal` or `reward_port`; ≥ 25 m apart; ≥ 30% on high routes or pockets; price rises per chest and is shown | card pedestal with a hovering face-down card; gold glint every 2 s |
| Witness Stones | 2 | 1 | 1 | R ≥ 2, ≥ 110 m from spawn, ≥ 1 on a high perch or reward port | ring of four tall slabs round a pedestal, eye glyph; white light column |
| Relic Broker | 1 | 1 (prices x1.4) | 1 (x1.8, always holds one Epic) | 80-160 m path distance, 15-40 m off the spine, enemy-reachable | lantern and folded canopy under a leaning stone card, three plinths |
| Shrine of Tribute | 3 | 3 | 2 | `ring_open_r10`, exposure ≥ 0.6, ≥ 70 m apart, one on or next to the spine; must pass V7 at 25 m around it | low basin summoning circle; runes fill during the 5 s hold; pale column |
| Duel Statue | 2 | 2 | 2 | 16 m clear ring, ≥ 120 m from spawn; on a mesa or plaza with an enemy ramp | armed duelist statue on a plinth, red eye glow, red banner |
| Deck Anvil | 2 | 1 | 1 | ≥ 120 m from spawn, on a branch, the climb counts as the cost; rule 3 above | anvil and hammer on a card pedestal, spark bursts |
| Altar of Tribute | 1 | 1 | 1 | inside a Pocket or on a hall side | stepped altar with two bowls of blue flame |
| Magnet Tablet | 2 | 1 | 1 | one in the near half, one in the far half (S1); rooftops preferred | standing tablet showing waiting XP, orbiting coin ring |
| Bone Oath | 2 | 2 | 1 | exposure ≥ 0.6, dark corners or plazas | rattling rust-red clay bone pile, dripping sand |
| Scales of the Court | 1 | 1 | 1 | `high_perch` or the stands | hanging balance that tilts slowly |
| Broken Covenant | 1 | 2 | 1 | rooftops or `pocket_end` | cracked tablet in chains, falling dust |
| Echo Forge | 0-1 (40%, hidden) | 1 (behind breakable card-niche wall) | 1 | ≥ 200 m from spawn | twin-mouthed furnace with ghost flames |
| Oath of the Second Seal | 0 | 0 | 1 | `second_seal_door` beside the Throne Gate | sealed door with a slow pulse |
| Golden relic statues | 2 | 2 | 3 (7 per run) | hidden: G1 chains or pockets, R ≥ 1.5 | small gold statue with a glint |
| Sealed fragment | 1 | 1 | 1 (3 per run) | deepest pocket by path distance | violet shard on a seal plinth |
| Clay Offering Vases (clusters of 2-5) | 40 | 35 | 30 | breadcrumbs along jump lines first | pot clusters; brass-banded rare ones |
| Gate | 1 | 1 | 1 | `gate` slot of the set piece | see the run structure |

**Used-state read.** Each encounter carries a small face-down stone card marker that flips face-up when used. This is an instance-transform tween. It reads from 60 m and on the minimap.

Tell colours: white = free, gold = coin, red = danger, violet = Fusion or seal.

---

## 9. Event anchors (emitted per stage)

- `bossRings[]`: centre, radius, layer group.
- `elitePockets[]`.
- `gateArena`: the set-piece definition (sigils, pillar sockets, perches, charge lanes, Toll Bell pull-in point).
- `spawnMouths[]`: 6-10 surge points at ramp feet and gully or trench mouths.
- `bossEntry[]`: 4 per ring, 30-40 m out and hidden from the ring centre.
- `safeGround`: a bitset for pit respawn.
- `dynamic[]` (stage 3): platform id, cells, type (flip or drift), period in ticks, phase.
- `gateApproach`: obelisk pairs and the sealed arch (positions), for the gate build-up and the wake effects.
- `heroes[]`: one hero landmark per district, used for the minimap compass and district name callouts.
- `lures[]` and `lureLinks[]`: the lure obelisks, and for each spine sample the landmark it sees.

**Runtime director rule for timed bosses**

1. Choose the nearest ring that is 25-40 m from the player by path, on the player's layer group and outside the camera frustum. Until the gate wakes, the gate arena floor is also a candidate ring.
2. At T-5 s, sound the horn and ping the minimap **on that ring**.
3. At T-1.5 s, the sigil scorches into the ground.
4. The boss appears.

If no ring qualifies, use the nearest ring. If that ring is more than 70 m away by path (up to 5% of the ground, never more than 100 m), add a sky beam over it and lengthen the warning from 5 s to 8 s.

---

## 10. Enemy pathing fit

- **Layered heightfield:**
  - layer 0 is ground everywhere;
  - layer 1 decks are sparse (bridges, galleries, arch tops);
  - at most 2 layers per column;
  - deck clearance 4.5 m or more.
- **Flow field:**
  - integer Dijkstra with a bucket queue, run from the player's `(cell, layer)` over about 37-49k nodes;
  - recomputed when the player changes 2 m cell or layer;
  - amortised at 8k nodes per tick (2-3 ticks, about 1-2 ms in JS).
  - Stores a 3-bit direction plus a portal-follow bit.
- **Entity layers:**
  - entities store their layer, and ground snap uses that layer;
  - a falling entity picks the highest surface at or below foot height + 0.3 m;
  - melee ignores targets more than 2.5 m apart vertically;
  - the spatial grid stays 2D, with a layer filter.
- **Player on a player-only surface:**
  - the field becomes multi-source from that surface's foot ring, so the swarm crowds the base;
  - **flyer weight** = base x (1 + 0.5 x elevationAboveLocalEnemyGround/3 m), capped at x2.5;
  - after a **4 s dwell**, Glass Seers retarget to precomputed perches;
  - Sand Bloat blasts (3.5 m) catch roofs of 2.4 m or less;
  - Ram Golems charge along lanes, stop at wall bits and never fall.
- **Tomb Scarabs** (and Seal Moths, Coin Thief Scarabs) ignore the field and height, flying at 4-10 m altitude.
- **Gilded Hound** (stage 3): the flow field, plus a sparse jump-link graph (`houndOK` links), crouch-glows 0.5 s before a leap.
- **Spawning:** candidates come from the per-macro-cell lists, filtered at runtime by the 22-30 m annulus, the frustum and heightfield occlusion, then picked with the run RNG. Enemies more than 60 m away are relocated, per the bible.
- **Spawn grace:** no spawns within 30 m for the first 10 s of a stage.

---

## 11. Landmark and kit list (Surface Ruins; about 40 meshes, ≤ 600 tris each, one 512 px palette atlas, vertex colour plus baked vertex AO)

**Structural kit**

- 4 m wall, wall corner
- floor 4 m, 1:2 ramp 4 m
- stair (1.4 m hop step)
- pillar (short and tall), arch
- roof slab with parapet
- bridge span 8 m (stone, and bone variant)
- gully wall, rim cliff segment
- rubble set (3)

**Card family**

- giant face-down stone card, 3 x 4.5 x 0.4 m: standing landmark, leaning ledge, toppled bridge or ramp, stacked staircase
- colossal card (18-24 m) for the mega landmark
- small marker card (flips when used)
- card pedestal

**Ritual family**

- summoning circle dais (with emissive glyph quad)
- summoning-circle terrace ring
- obelisk
- sealed gate arch with seal sockets (3 sizes)
- chain segment

**Encounter silhouettes**

- Witness slab ring
- Broker canopy and lantern
- duelist statue
- anvil
- altar with bowls
- magnet tablet
- bone pile
- hanging scales
- cracked chained tablet
- twin furnace
- golden statue
- vase (plain and brass)

**District heroes** (one per district, 4 x 4 m footprint, 9 m tall; a unique back pattern acts as a compass)

- Stage 1: colosseum stands, market awnings, hall of cards facade, fossil spine ribs, King's Stair facade
- Stage 2: seventh door frame, ossuary arch, sarcophagus colonnade, chain winch tower, niche wall shrine
- Stage 3: duel table rim, treasury stack, fallen king statue, card shoal spire, throne stair steps

**Kiting and set-piece chunks added in v2**

- `card_grove` (18 x 18 m, standing stone cards 4.5 m tall), `pillar_ring` (18 x 18 m, an obelisk plus 4 pillars): obstacles to circle in open ground
- `roof_terrace` (20 x 12 m, a 1:2 enemy ramp plus a player-only step), `ledge_pillars` (a second self-contained chain type)
- gate approach: obelisk pairs and the sealed arch

**Gate set pieces**

- the colosseum floor arena with stands
- (stage 2) the Seventh Door vault
- (stage 3) the duel table

**Mega landmark:** one per stage, on the keystone region (seeded, off centre, off the spine). It is fog-exempt beyond 90 m via a silhouette impostor.

**Animation hooks stored per landmark** (instance or uniform tweens only; no skinned scenery)

- `idle`: spin, bob, sway, glint, pulse
- `tell`: column, sparks, glow
- `activate`: card flip, shrine rune fill, Witness Stones lift, chest lid fly, anvil strike, altar bowls flare, tablet crystal stream, Scales tip, gate seam pulse then open, gate chains break, pedestal card rise, vase shatter, bridge dust on landing, boss-ring sigil stamp-in

---

## 12. Performance budget and native path

- **Terrain:** 2 m heightfield mesh, decimated to 4 m on field cells, flat-shaded, vertex-coloured by tier, noise and trims. Cliff faces are extruded quads.
- **Static geometry:** merged per 96 m super-section (at most 16 meshes) with one material plus one emissive variant.
- **Props:** repeated props are InstancedMesh buckets sorted by section.
- **Draw budgets:**
  - world ≤ 40 draw calls;
  - effects ≤ 15;
  - enemies use one draw per type (vertex-animation textures).
- **Lighting:** no realtime shadows; instanced blob shadows.
- **Fog:** at 90 m. Landmarks beyond it use impostor quads.
- **Occluders:** flagged occluders dither to 30% when they sit between the camera and the player.
- **Memory:** StageMap about 1-2 MB in memory. It is never saved; it is regenerated from the seed.
- **Measured generation time (prototype, Node 22, this container, 4 workers):** p50 about 1.0-1.3 s per stage, p95 2.6-4.1 s, max 9.9 s. A typical first-try Stage 1 map: macro 9 ms, terrain 240 ms, chunks 140 ms, validation 660 ms. **This is about 7-9 times the 150 ms target.** Validation (V7 spawn-ring searches, V12 line of sight) and terrain are the costs to cut: a coarser V7 lattice, incremental SCC, typed-array BFS throughout, and skipping already-passed metrics in repair re-runs. Until that work is done, pre-generation must hide the time: Stage 1 during the intro and a loading card, Stages 2-3 during the previous gate fight (1.5-2.5 min, plenty even at the p95 max).
- **When generation runs:**
  - in a Worker on PC, and on the sim thread or a native thread on Android;
  - the next stage is pre-generated during the current gate-boss fight;
  - the 6 s Descent never waits;
  - Stage 1 generates during the stage-intro animation.
- **Native:** `src/gen` has no Three.js, DOM or float transcendentals. It runs as-is in an embedded JS engine, or can be ported to Kotlin or C++ with the golden-hash suite as the parity contract.

---

## 13. Data formats

**`src/data/movement.json`**

`{run:9, jumpH:2.2, g:28, dash:{v:26,t:0.16,cd:1.1}, airJumps:0}`

**`src/data/reach.json`** (generated)

```json
{"safety":0.70,"rows":[{"dh_cm":150,"g1_cm":390,"g2_cm":580},{"dh_cm":140,"g1_cm":400,"g2_cm":590},{"dh_cm":100,"g1_cm":430,"g2_cm":620},{"dh_cm":0,"g1_cm":500,"g1Authored_cm":450,"g2_cm":690},{"dh_cm":-150,"g1_cm":570,"g2_cm":760},{"dh_cm":-300,"g1_cm":630,"g2_cm":820},{"dh_cm":-600,"g1_cm":730,"g2_cm":910}],
 "hopReq_cm":[120,150],"hopOpt_cm":[160,180],"forbidden_cm":[180,260],"tier_cm":300,
 "walkPlayer_cmPerM":70,"walkEnemy_cmPerM":60,"ramp_cmPerM":50,"deckClear_cm":450,"padMin_cm":300,"dropPad_cm":400,"lipDepth_cm":300}
```

**`src/data/stages/stage{1,2,3}.json`** (StageSpec)

```json
{"stage":1,"name":"Surface Ruins","grid":15,"cell_m":24,"coarse_m":8,"palette":"ruins_day",
 "districtPool":[{"id":"sunken_colosseum","required":true,"gate":true,"arche":{"plaza":3,"terraces":1}},{"id":"market_tablets","arche":{"necropolis":3,"dunes":1}},{"id":"hall_sealed_cards","arche":{"graveyard":3,"plaza":1}},{"id":"dragons_spine","arche":{"canyon":2,"mesa":2}},{"id":"kings_stair","arche":{"terraces":3,"mesa":1}}],
 "districts":4,"regions":[12,15],"regionSpacing_m":56,"loopRatio":0.30,
 "masks":["round","lobed","crescent","twin"],
 "tiers":{"weights":[40,35,25],"maxSpineChangeFrac":40,"minSpineChanges":1,"maxTierAreaPct":44,"maxTopTierPct":55,"needTopTier":false},
 "spineLen_m":[190,290],"spineRatioMin":115,"spineWidth_m":12,"maxPlainPct":40,"requireArche":{},
 "falls":"gully","openingM":90,"econGraphM":180,"econLinks":"ANY","bossRings":[5,7],"bossRingCover_m":70,"bossRingCoverPct":95,"bossRingCoverMax_m":100,
 "encounterCaps":{"perRegion":3,"perDistrictPct":35},
 "islands":{"perchMax_m2":64,"islandMax_m2":120,"count":[4,8],"maxFrac":8},
 "spawnRing":{"inner_m":22,"outer_m":30,"minFrac":40,"minCells_m2":150,"minSectors":3,"pathRatio":1.8,"tolPct":3},
 "rhythmChains":{"min":2,"distinctTypes":2,"moves":[3,6],"len_m":[25,60],"save":[10,35]},
 "budgets":{"tris":250000,"visTris":90000,"draws":40,"instances":2000},
 "clock_s":420,"timeline":[{"t":0,"ev":"wave","what":"husks"},"... waves at 40/80/140/260 s ...",{"t":105,"ev":"elite","what":"Grave Herald"},{"t":225,"ev":"timed_boss","what":"Sealed Warden","drop":"sealed_chest"},{"t":330,"ev":"timed_boss","what":"Twin Jackal Idols","drop":"sealed_chest"},{"t":360,"ev":"gate_wake"},{"t":360,"ev":"husk_ring_every_30s"},{"t":420,"ev":"toll_bell"}],
 "heroes":{"market_tablets":"market_awnings","hall_sealed_cards":"hall_of_cards_facade","dragons_spine":"fossil_spine_ribs","kings_stair":"kings_stair_facade","sunken_colosseum":"colosseum_stands"},
 "encounters":{"card_chest":8,"witness_stone":2,"relic_broker":1,"shrine_tribute":3,"duel_statue":2,"deck_anvil":2,"altar_tribute":1,"magnet_tablet":2,"bone_oath":2,"scales_court":1,"broken_covenant":1,"echo_forge":{"n":1,"chance":40},"golden_statue":2,"sealed_fragment":1,"vases":40,"wrapped_mimic":0},
 "encounterRules":{"witness_stone":{"minR":2.0,"minSpawn_m":110,"class":"FREE_ITEM"},"deck_anvil":{"minR":1.0,"minSpawn_m":120,"class":"FREE_LEVEL"}}}
```

**Chunk** (`src/data/chunks/ruins/*.json`)

```json
{"id":"roof_run_a","role":"STRUCT","arche":["necropolis"],"size":[2,1],"stages":[1,3],"weight":1.0,"maxUses":2,"tiers":[0,1],
 "sockets":{"N":[["T",0],["T",0],["W",1],["W",1],["T",0],["T",0]],"E":[["T",0],["H",0],["T",0]],"S":[...],"W":[...]},
 "height0":"<b64 int16 cm, 48x24>","height1":{"rect":[x,z,w,h],"data":"<b64>"},
 "flags":"<b64 u16>","pieces":[[kitId,x_cm,y_cm,z_cm,rot4,mirror]],"colliders":[[x,y,z,sx,sy,sz]],
 "portals":[{"from":[x,z,0],"to":[x,z,1]}],
 "jumps":[{"a":[x,y,z],"b":[x,y,z],"class":"G1|G2|HOP|DROP|AIR","houndOK":false}],
 "slots":[{"tag":"reward_port","x":4200,"z":800,"layer":1}],
 "chain":{"entry":[x,z],"exit":[x,z],"moves":4},"landmark":null,"tris":3200}
```

Sockets list 3 segments per 24 m of edge, clockwise. Variants are precomputed with remapped sockets.

Stage 2 differs: `"requireArche":{"trench":2}`, tier weights over tiers -1..2, `"wrapped_mimic":2`. Stage 3: `"needTopTier":true`, `"requireArche":{"shoal":1}`, tier weights 35/30/22/13, clock 480. Both carry full wave timelines (see the run structure).

**StageMap** (sim-owned; binary sections plus a JSON header)

- **Header:** `{magic:"DSM1", genVer, libHash, sealCode, stage, attempt, hash, grid, cell_m, spawn, gate, shape, keystone}`. `GEN_VERSION` is 2: every v1 Seal Code now gives a different map, which is expected after a generator change.
- **Sections:**
  - `h0` Int16[N×N] in 1 m cells, cm
  - `h1` sparse rects
  - `flags` Uint16[N×N]
  - `region` Uint8[(N/8)²] plus `regionInfo` [id, district, archetype, tier, role]
  - `spine` Uint32 cell list
  - `nav` cost Uint8 over 2 m nodes plus `portals`
  - `spawnCells` bucketed per 8 m
  - `bossRings`, `seerPerches`, `chargeLanes`, `footRings`, `houndLinks`
  - `instances` Int32 [kitId, x, y, z, rot8]
  - `encounters` [type, slotId, x, y, z, layer, R×10, class, landmarkId, price]
  - `events` (anchors, per §9, including `gateApproach`, `heroes`, `lures`)
  - `dynamic`
  - `safeGround` bitset
  - `minimap` Uint8[256²] plus icons

**Validation report** (debug JSON, F3 overlay)

`{sealCode, stage, attempt, hash, ms, metrics:{V2:{value,min,pass},...}, repairs:[{pass,kind,at,result}]}`

---

## 14. Module layout (`src/gen`: pure, integer, no Three.js, no DOM)

```
src/gen/
  index.js            generateStage(sealCode|runSeed40, stageIndex, {spec, lib, reach}) -> StageMap
  seed.js             sealCode encode/decode, splitmix32, xoshiro128**, fnv1a32, rngFor(step)
  imath.js            isqrt32, clamp, Q16.16 helpers, integer value noise, int Catmull-Rom
  spec.js             load/validate StageSpec, reach.json
  macro/mask.js       superellipse playable mask
  macro/districts.js  district draw, seed placement, jittered BFS growth
  macro/regions.js    region seeds, growth, archetypes
  macro/graph.js      adjacency, MST + loops, roles, spine
  tiers.js            constrained tier walk, edge transitions
  cells.js            STRUCT/CONNECTOR/TERRAIN roles, feature budgets
  chunks/library.js   load, variants (rot x mirror), socket index, libHash
  chunks/solve.js     constraint fill, backtracking, rhythm scorer
  terrain/sculpt.js   tier base, noise, canyon carve, aprons, snap pass, slope clamp
  terrain/ramps.js    RAMP2 spline carving
  arenas.js           set piece, boss rings, elite pockets, spawn basin
  stamp.js            write chunks into h0/h1/flags/instances/slots
  scatter.js          Poisson props, vase breadcrumbs
  nav/bake.js         2 m enemy graph, portals, spawn lists, perches, lanes, foot rings
  reach/links.js      lip sampling, link classification from reach.json
  reach/graph.js      player traversal graph, BFS, Tarjan SCC
  validate/*.js       one file per metric group (reach, spawnRing, islands, readability, lure, economy, perf, rhythm)
  repair.js           targeted fixes + re-check
  encounters/place.js R score, slot scoring, quotas
  encounters/economy.js POI graph, opening region checks
  events.js           anchors, dynamic platforms
  minimap.js
  emit.js             canonical serialisation, xxHash32
src/sim/nav/flow.js   runtime flow field (bucket Dijkstra, amortised), uses StageMap
src/view/stage/       section merge, instancing, landmark tweens, minimap texture
tools/gen-reach.mjs   movement.json -> reach.json
tools/gen-sweep.mjs   N-seed sweep: pass rates, fallback rate, variety, timings
tools/gen-render.mjs  top-down PNG debug render
tools/chunk-lint.mjs  socket coverage, forbidden band, reach of authored jumps, kerb height near jump lines
tools/physcheck.mjs   independent float-physics oracle for jump links (CI sample; floats allowed, output never feeds gen)
test/gen/golden.json  seeds -> hashes (Node, Chrome, Android)
```

---

## 15. Build order

1. `seed`, `imath`, `reach`, `macro`, `tiers` and `terrain` (with a few proto-chunks), plus the validator and the PNG render. This is the Node prototype (see the brief).
2. The chunk library format, an in-browser chunk editor, and the solver. Author the first 40 Surface Ruins chunks.
3. Nav bake plus runtime flow on decks, spawn lists, island pressure.
4. Encounters, economy, events, minimap.
5. View: sections, instancing, landmark animations. Then the perf pass on the handheld.
6. Golden-hash CI on Chrome and Android. The 10k sweep.
7. Grow the library to about 95 chunks for Stage 1. Then add the Stage 2 and 3 palette swaps and set pieces.

---

## 16. Risks

- **Chunk-library breadth decides freshness.** Track the CI socket coverage and the per-chunk use histogram, and add chunks where seeds repeat.
- **Repair fixes can undo each other.** Mitigation: re-check after every fix, revert on regression, and cap passes.
- **Handheld flow-field cost with decks plus 300 enemies.** Mitigation: amortise, keep decks sparse, and use a 4 m far field if needed.
- **Camera readability on roofs and under bridges at 9 m/s.** Mitigation: occluder dither, spine rules, playtest.
- **Island pressure tuning.** Too weak becomes camping; too strong feels unfair. Tune the elevation curve and dwell timer from telemetry.
- **Bible numbers may change.** Counts, classes and radii live in StageSpec JSON, not in code.
- **Generation time** is 7-9x the budget in the prototype (§12). If profiling cannot close the gap, generation stays behind pre-generation, and the handheld budget must be measured on a device before the port is committed.
- **Determinism is verified only on Node 22 in this container.** It has not been run on Node 26 (Randall's PC), Chrome or Android. The golden-hash child-process test must run on all three before any "same seed on every device" claim.

---

## 17. Prototype status (v2, `duelsummoner/design/generator-prototype`)

- **Tests:** `node test.mjs`: 13/13 pass. New tests cover the arc check (a synthetic kerb, plus seeds that failed in v1), economy rule 2 with a near pair, CLI rejection of bad seeds, seals and stages, and the lint against `localeCompare` and float transcendentals.
- **Batch:** `node batch.mjs --count 50 --start 5000 --workers 4` (150 maps): **BATCH PASS**. Final pass is 100% on every stage, the fallback rate is 0 / 0 / 2%, and there are 0 signature or hash collisions. Full numbers are in the metrics report.
- **Physics oracle:** 18 maps (6 seeds x 3 stages), 63,846 HOP/G1/DROP links reachable from spawn. 2 G1 links fail the strict float check (0.003%), both in seed 5013 Stage 2. v1 had 0.019% (223 of 1.16 M). The two remaining cases are tracked and not yet fixed.
- **Known gaps:**
  - Stage 2 draws `round` for 68% of maps (silhouette IoU mean 0.77), probably because the two-trench rule rejects narrow shapes more often (not yet investigated). Stages 1 and 3 are 0.62-0.64.
  - Encounter caps relax on small maps: the busiest region holds up to 5 and the busiest district up to 39%.
  - Every map keeps a few cells between 70 and 100 m from a ring (the worst cell has p50 79-82 m, max 99 m), which the 95% rule allows. The sky-beam rule in §9 covers them.
  - The V7 tolerance (3% of samples may have fewer than 3 sectors) remains.

---

## 18. Randall's bar (22 Nov 2026, 7:01 PM ET): fog of war, side quests, no jank

His words: maps have fog of war, cannot be janky, must be challenging and fun to get through, with platforming that leads to cool side quests and rewards. Seeded, never random. It may seem infinite, but it is smart and made with love. These rules are binding on the port.

### 18.1 Fog of war (new)

- The map screen and minimap start black. A `explored` Uint8[256²] mask (run state, not generator output; saved in the run and in the replay hash) is lit in a 28 m disc round the player each tick, plus a 60 m line-of-sight cone from any `high_perch` or deck cell. Climbing is how you scout.
- Three states per texel: unseen (black), seen-before (dim, terrain only), in sight (full, with live icons).
- Icons appear only once their texel is seen. Exceptions that show from the start: the spawn, the district name the player stands in, and the direction (not the position) of the gate, given by the Ley Thread.
- Tells still work through the fog: light columns, the mega landmark and hero landmarks are visible in the 3D world from their tell range. The fog hides the *map*, never the world's signposts. That is what makes exploring a choice instead of a guess.
- Witness Stones reveal their whole district on use. One Lost Relic per stage reveals all side-quest pockets.
- End-of-stage card shows "Explored 74%". 100% in a stage feeds an Adventures achievement.
- Fog is view and run state. It must not change sim outcomes other than the Witness Stone reveal, and it must be deterministic from the input tape.

### 18.2 Side quests reached by platforming (tightened)

- Every stage holds **3 to 5 side-quest pockets**. Each is a Branch or Pocket region whose only way in is a parkour chain of 3 to 6 moves (G1 jumps, slabs, a slide gap, a drop). The safe spine never passes through one.
- Each pocket has one authored quest from a seeded table, never a bare chest: a Lost Relic on a pillar top, a timed coin line across decks, a caged summon to free, a sealed urn puzzle (break in the order the glyphs light), an Ace elite den, a Duel Statue challenge with no summons.
- Reward scales with the chain's difficulty score (sum of gap/reach ratios). Hard climb, better prize. Validator metric **V18**: every pocket's reward class is at least its chain tier; no pocket repeats a quest type inside one stage; no two stages of a run share their first pocket quest.
- You can always see a pocket's tell from the spine before you can reach it (V12 already gates this). See it, want it, work out the route.
- Every pocket has a loop-back drop, so a side trip never costs a walk back.
- **V19 fairness:** each chain has a landing margin of 0.5 m or more on every move, no blind jumps (the landing is in camera view from the take-off), and a failed jump drops to walkable ground within 6 s of the chain start, never into a pit that kills.

### 18.3 No jank (gating checks, measured in the browser)

- No seam, gap or z-fight between chunks: sockets share exact integer heights, and the stamp welds edge vertices. Test: walk the bot along every chunk border on 20 seeds with zero stuck frames and zero falls through.
- No invisible snag: collider and visual differ by 5 cm at most; every kerb at or under 0.35 m auto-steps.
- No stuck spots: after any 2 s with input held and under 0.5 m moved, the run report logs the cell. Target is zero across a 50-seed bot batch.
- Camera never clips through a wall in a lane (V10 occluder rule), and occluders on the camera side fade.
- Enemies path everywhere the player can stand, or get a flyer/leaper tag for that region. No safe perch that farms forever: a perch held over 12 s draws flyers (§10).
- Generation happens behind the stage card with the map already built before the fade ends. No hitch on stage entry over 50 ms.

### 18.4 Seems infinite, is authored

- Variety budget: 4 silhouettes x district orders x keystone positions x about 60 chunks with variants x quest table. The 300-map batch must show no two maps with the same (silhouette, district order, keystone cell, first three spine chunks).
- Every seal is fully reproducible: same seal, same map, same quests, same fog result for the same inputs. Daily seal and friend challenges depend on it.
- Each stage gets one "postcard" moment by rule: a spine sample where the mega landmark, one pocket tell and the gate district are all in view at once.

### 18.5 Built for the base kit, not the broken build (Randall 22 Nov 2026, 7:03 PM ET)

His words: early on you may have no double jump and no way to get very high, so you platform to reach things and to explore the whole map, but moving through must be easy and never feel bad.

- **Everything is reachable with the starting kit.** 100% of the map, every pocket, every reward and 100% fog reveal must be reachable with one jump, slide and dash at base move speed and base jump height, with zero items and zero upgrades. This extends V3/V15 from "required links" to **every reward and every explorable cell** (new gating check **V20**). Air jumps, extra height and speed are only ever shortcuts, never keys.
- **The spine is a walk.** Spawn to gate needs no jump harder than a 0.35 m auto-step kerb. Nobody is ever blocked from finishing a stage by platforming.
- **Difficulty by stage, on base kit:** Stage 1 pocket chains use gaps at 60 to 75% of base reach and rises at or under 1.2 m; Stage 2 goes to 85%; Stage 3 to 92%. Nothing is ever placed above 92% of base reach, so a clean jump always has slack.
- **Late-game builds skip, they do not unlock.** Height and air-jump builds get roof lines and coin lines that save time (G2/AIR links). Each one must have a base-kit route to the same place within 1.6 x the path length.
- **Flow rules:** ledges within 0.4 m of the jump apex are grabbed by an auto-mantle (no pixel-perfect lips); 0.1 s coyote time and 0.12 s jump buffer always on; run speed is kept through hops, slides and drops in a chain; no move in a chain needs a full stop or a camera turn over 90 degrees; ramps and hop stairs give a slower no-skill way up to every tier, so a parkour chain is always the fast way, never the only way to change tier (pockets excepted, and their fail drop returns you to the chain start within 6 s).
- **Bot proof:** a base-kit bot with no upgrades must reach every pocket and reveal 100% of the fog on 50 seeds per stage. Any cell it cannot reach fails the map.
