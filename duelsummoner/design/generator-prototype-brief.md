# Prototype brief: Node reference implementation of the stage generator (macro layout, heightfield, platform placement, reachability validation)

## Goal

Build a **dependency-free Node script** (Node 20 or later; Randall's PC runs Node 26) that runs the core of the Duel Summoner stage generator. For each seed it must write:

- a JSON file with the layout and its validation metrics;
- a top-down PNG showing height shading, routes and encounter markers.

The prototype exists to prove four things before chunk authoring starts:

1. The macro layout reads as districts, not as a grid.
2. Platform placement respects the reach numbers.
3. The validator catches soft-locks, unreachable rewards and bad spawn rings.
4. Results are deterministic.

**Scope limits:**

- No Three.js, no DOM and no npm packages. Use only `node:fs`, `node:path`, `node:zlib` and `node:perf_hooks`.
- No real chunk library. Platform placement uses about 10 parametric **proto-chunks** defined in code (see step 6).
- Encounters use simplified placement (see step 9).
- Enemy nav is a single layer, plus deck rects marked as layer 1 for bridges only.

## Files

Put everything under `duelsummoner/tools/genproto/`. Every module is a pure ES module (`.mjs`). Code written here should port into `src/gen` later with almost no change.

```
tools/genproto/
  main.mjs          CLI
  seed.mjs          Seal Code, splitmix32, xoshiro128**, fnv1a32, rngFor(step)
  imath.mjs         isqrt32, clamp, lerpInt, valueNoise2(x,z,seed,wavelen) integer, catmullRomInt
  reach.mjs         builds reach table from movement constants (the only file allowed floats; outputs integer cm)
  spec.mjs          STAGE_SPECS[1..3] (numbers below)
  macro.mjs         mask, districts, regions, graph, spine, tiers
  terrain.mjs       heightfield sculpt, ramps, snap pass, flags
  protochunks.mjs   parametric structures + placement + rhythm scorer
  links.mjs         lip sampling and link classification
  validate.mjs      reachability, SCC, spawn ring, islands, boss rings, lure, economy, jump lint
  repair.mjs        targeted fixes with re-check
  encounters.mjs    slots, R score, quotas, economy
  png.mjs           minimal PNG encoder (RGBA8, zlib.deflateSync, own CRC32 table)
  render.mjs        top-down image
  emit.mjs          JSON writer + xxHash32 over canonical bytes
  test.mjs          self-tests (node test.mjs)
```

## CLI

- `node tools/genproto/main.mjs --seal 7KQ2M9XA --stage 1 --out out/`
  Writes `out/7KQ2M9XA_s1.json` and `out/7KQ2M9XA_s1.png`.
- `--seed <uint>` is accepted as an alternative to `--seal`.
- `--all-stages` generates stages 1, 2 and 3 for the seed.
- `--sweep 1000 --stage 1 --out out/sweep/` runs seeds 1..N. It writes only `summary.json` plus PNGs for the 10 worst-scoring seeds and the first 10 seeds. It also prints:
  - pass rate at attempt 0, at attempt ≤ 1, and the fallback count;
  - median and p95 ms;
  - the histogram of failure kinds;
  - the variety collision rate.
- `--scale 2` sets pixels per metre (default 2).
- `--debug` adds layers: the region-id tint and the link overlay.

## Determinism rules (must follow)

- All generation code uses 32-bit integer math only (`Math.imul`, `|0`, `>>>0`).
  - Positions and heights are integer **centimetres** in Int16Array or Int32Array.
  - No `Math.random`, `sin`, `cos`, `atan2`, `pow`, `exp`, `log`, `sqrt` or `hypot` outside `reach.mjs` and `render.mjs`.
  - Distances use `isqrt32` (integer Newton).
- Every random choice draws from `rngFor(stepName)`. Step names: `districts`, `regions`, `graph`, `tiers`, `terrain`, `chunks`, `encounters`, `repair`.
- Before any random pick, sort the candidate list by an integer key, with an id tiebreak.
- Never iterate a `Set` or `Map` without sorting first.
- Add a self-test that runs seed 12345, stage 1, twice in one process and once in a child process. All three hashes must be identical.

## Seeds (`seed.mjs`)

**Seal Code**

- 8 Crockford base32 characters: alphabet `0123456789ABCDEFGHJKMNPQRSTVWXYZ`.
- Decoding gives 40 bits: `lo` (32 bits) and `hi` (8 bits).
- Decoding is case-insensitive and treats I and L as 1 and O as 0.
- `encode(decode(x)) === x` for valid codes.

**splitmix32(x)**

```
x = (x + 0x9E3779B9) >>> 0
z = x
z = Math.imul(z ^ (z >>> 16), 0x85EBCA6B)
z = Math.imul(z ^ (z >>> 13), 0xC2B2AE35)
return (z ^ (z >>> 16)) >>> 0
```

Keep the incremented state when generating a stream.

**Derivation**

```
stageSeed   = splitmix32(lo ^ imul(hi+1, 0x85EBCA6B) ^ imul(stage+1, 0x9E3779B9) ^ GEN_VERSION)
attemptSeed = splitmix32(stageSeed + imul(attempt, 0x632BE5AB))
```

with `GEN_VERSION = 1`.

**Streams.** `rngFor(name)` seeds xoshiro128** with 4 successive splitmix32 outputs, starting from `attemptSeed ^ fnv1a32(name)`. Expose:

- `next()`: u32
- `int(n)`: unbiased, using the rejection method
- `range(a, b)`
- `chance(pct)`
- `pickWeighted(items, weightKey)`: integer weights

## Reach table (`reach.mjs`)

Inputs: run 9, jumpH 2.2, g 28, dash v 26 for t 0.16, safety 0.70.

**Formulas**

- `v0 = sqrt(2*g*jumpH)`
- `tUp = v0/g`
- `T(dh) = tUp + sqrt(2*(jumpH-dh)/g)`
- `jump(dh) = 9*T(dh)`
- `dash(dh) = jump(dh) + 2.72`
- `g1(dh) = floor(0.70*jump(dh)*100)` (in cm)
- `g2(dh) = floor(0.70*dash(dh)*100)` (in cm)

Build rows for dh (cm) of +150, +140, +100, 0, −150, −300 and −600. Interpolate linearly between rows. A dh outside the range: above +150 is not jumpable; below −600 uses the −600 row.

**Expected values** (assert in tests, ±2 cm):

| dh (cm) | g1 (cm) | g2 (cm) |
|---|---|---|
| 0 | 499 | 690 |
| +140 | 400 | 591 |
| +100 | 434 | 625 |
| −150 | 573 | 764 |
| −300 | 633 | 824 |

**Other constants**

| Constant | Value (cm) |
|---|---|
| Authored required gap at dh 0 | 450 max |
| hopReq | 120-150 |
| hopOpt | 160-180 |
| forbidden rise band | 181-259 |
| tier | 300 |
| walkPlayer | ≤ 70 per 1 m cell |
| walkEnemy | ≤ 60 per 1 m cell |
| ramp | 50 per m |
| deck clearance | ≥ 450 |
| pad min | 300 x 300 |
| drop pad | 400 x 400 |
| take-off lip depth | ≥ 300 |

## Stage specs (`spec.mjs`)

**Stage 1**

| Parameter | Value |
|---|---|
| grid | 15 cells of 24 m = 360 m |
| coarse cell | 8 m (45 x 45 coarse) |
| heightfield | 1 m (360 x 360) |
| districts | 4 from pool [colosseum (required, gate), market, hall, spine, stair] |
| regions | 12-15, spacing 7 coarse cells |
| loopRatio | 30% |
| tier weights | [55, 30, 15] for tiers 0/1/2 |
| spine | 220-290 m, width 12 m |
| falls | gully |
| openingM | 90; econGraphM 180 |
| bossRings | 5-7, coverage 70 m |
| islands | perch ≤ 64 m², island ≤ 120 m², 4-8, total ≤ 8% |
| spawnRing | 22-30 m, ≥ 40%, ≥ 3 sectors |
| rhythm chains | ≥ 2 |

District archetype weights:

| District | Weights |
|---|---|
| colosseum | plaza 3, terraces 1 |
| market | necropolis 3, dunes 1 |
| hall | graveyard 3, plaza 1 |
| spine | canyon 2, mesa 2 |
| stair | terraces 3, mesa 1 |

Dunes is added with weight 1 to every district.

**Stage 2:** grid 14, regions 11-14, spine 200-270 m, falls `pit`, openingM 80, tier set {−1, 0, 1, 2} with trench archetype weight 2.

**Stage 3:** grid 15, tiers 0-3 with weights [40, 30, 20, 10], falls `pit` (sand), spine 230-300 m.

Stages 2 and 3 only need to run. Tuning focuses on stage 1.

## Pipeline to implement

### 1. Mask

1. Compute a superellipse with exponent 3 in integer form: `|x|^3 + |z|^3 <= R^3` in coarse cells, using 64-bit-safe math (values stay under 2^31 when coarse units are used).
2. Use R = (grid*3)/2 − 2 coarse cells.
3. Perturb the edge by ±1 coarse cell using 1D integer value noise on the angle bucket. The angle bucket is the octant plus the ratio from integer division; no trig.
4. The outer 2 coarse cells inside the mask are the rim: unwalkable and cosmetic.

### 2. Districts

1. Choose 4 districts with `pickWeighted` from the pool. Colosseum is forced.
2. Place the gate seed: a random rim-band coarse cell 4-7 cells inside the rim.
3. Place the spawn seed: the coarse cell that maximises straight-line distance from the gate, among cells 9-14 coarse cells from the centre. The spawn-to-gate distance must be at least 0.62 x the playable diameter, otherwise re-pick (at most 20 tries).
4. Place the other 2 seeds by farthest-point sampling.
5. Grow districts with multi-source BFS over mask cells. The frontier order is `(dist, hash32(cell ^ districtId*0x9E37))`. That hash tie-break produces the jittered borders.

### 3. Regions

1. Inside each district, Poisson-sample region seeds (best of 20 candidates, minimum spacing 7 coarse cells) until the stage total falls within range. The spawn region seed is the spawn point.
2. Grow regions with the same BFS, constrained to their district.
3. Assign archetypes by district weights, with these rules:
   - spawn region = plaza;
   - gate region = `setpiece`, a forced 9 x 9 coarse footprint (72 m) with a flat disc of 44 m at tier 0 and 3 entrances;
   - no two adjacent canyon regions (re-pick on conflict).

### 4. Graph, spine and roles

1. Two regions are adjacent if they share 3 or more border coarse-cell pairs. Edge weight = `isqrt(dx²+dz²) * (1000 + rng.int(301)) / 1000`, in cm.
2. Build a Kruskal minimum spanning tree (sorted by weight, then by edge id).
3. Add 30% of the remaining edges in shuffled order. Skip an edge that would raise any region's degree above 5.
4. Spine = Dijkstra from spawn to the gate. Estimate its length as the sum of centre distances. If it falls outside the spec range, re-place the gate seed (at most 3 tries), then attempt+1.
5. Assign roles:
   - regions on the spine = `spine`;
   - degree-1 regions off the spine = `pocket`;
   - all others = `branch`.
6. Check the constraints: at least 2 independent cycles (edges − nodes + 1 ≥ 2), and spawn degree ≥ 3 (add the shortest available edge if not).

### 5. Tiers and transitions

1. BFS from spawn (tier 0). Each region picks a tier from the weights, constrained to within ±1 of every already-assigned neighbour.
2. Spine rule: at most 40% of spine edges may change tier. If over, flatten the later ones.
3. The gate is tier 0. Require at least 2 regions at tier ≥ 2 (for stage 1, max tier 2); if short, promote the highest branch regions.
4. Classify each graph edge:

| Edge | Transition |
|---|---|
| same tier | `open` |
| tier change on the spine | `ramp2` (always) |
| tier change, other edges | `ramp2` for 60% or more, else `hopstair` |
| pocket edge going downward | add a `drop` as well |

5. Region borders without a graph edge become cliffs.

### 6. Heightfield (`terrain.mjs`, 1 m cells, Int16 cm)

1. Base height = tier × 300 for the cell's region (the region comes from the coarse cell).
2. **Wobble the borders** at 1 m resolution: each 1 m cell inside a coarse border cell takes the region of the nearest coarse centre, with distance perturbed by `valueNoise2(x, z, seed, 6 m) ±150 cm`. That breaks the 8 m stair-step.
3. **Archetype detail** (integer value noise, 2 octaves):
   - dunes: ±100 cm at a 24 m wavelength;
   - plaza: ±15 cm;
   - mesa: ±20 cm;
   - canyon: carve a channel 500-700 cm deep and 14-24 m wide along a Catmull-Rom path through 3-5 jittered coarse points across the region, with exit ramps every ≤ 20 m (stage 1). Mark the channel cells `gully`.
   - No detail within 3 m of a ramp, lane or proto-chunk footprint.
4. **ramp2 edges.** Find the shared border segment and carve 2 ramps 8-12 m wide, rising at 50 cm per m, at the 1/3 and 2/3 points of the border, perpendicular to the border, each with 1 m shoulders. Mark them `ramp`.
5. **hopstair edges.** Stamp a hop staircase at the border midpoint: 2 steps of 140 cm plus 20 cm, each step 4 m deep and 6 m wide, flagged `playerOnly`.
6. **Snap pass.** For every 4-neighbour pair of walkable cells, let `d = |h1 − h2|`:
   - 181-259 cm: snap to 140 or 300, whichever is nearer, by moving the lower cell;
   - 76-119 cm and not flagged: relax both toward each other in 3 passes.
7. **Flags** (u16 per cell): `walk, rim, cliffN/E/S/W, ramp, gully, playerOnly, deck, lane, spine, arena, spawnBasin, safeGround, pit, slot`.

### 7. Proto-chunks (`protochunks.mjs`)

Each proto-chunk is a function `(rng, anchor, rot4, mirror, tier) → {cells:[{x,z,h,layer,flags}], jumps:[{a,b,class}], slots:[{tag,x,z,layer}], footprint}`.

**The 10 proto-chunks:**

1. **hub_plaza (24 m):** a flat disc at the tier with 4 pillars. Slots: `ring_open_r14`, `hub_edge` ×2.
2. **roof_run (48 x 24 m):** 3-5 roofs 240-360 cm high. A 120 cm step crate leads up. Gaps of 300-450 cm (G1), with one optional 550-650 cm gap (G2) that also has a G1 route around it. Slots: `reward_port` on the last roof. Flags: `playerOnly`. Each roof is ≤ 64 m², or the roofs are linked by gaps into an island ≤ 120 m².
3. **pillar_hop (24 m):** 4-6 pillars 3 x 3 m on a 3 m grid of gaps. Heights step +120 / −120 cm. Ends with a `reward_port`.
4. **card_bridge:** a deck (layer 1) 4 m wide across a gully or a ≥ 300 cm drop between two same-tier rims. Deck height = rim height, clearance ≥ 450 above the gully floor. Portals at both ends. Slot `reward_port` at mid-span.
5. **card_slab_run:** 4-6 slabs 3 x 4.5 m, each 140 cm above the previous one or level, with gaps per the G1 table. The top slab has a `high_perch`. Ends with a drop back to the ground.
6. **terrace_ring:** concentric rings with 140 cm rises, an enemy ramp on one side, slot `ring_open_r10` at the centre.
7. **mesa_climb:** a 300 cm plateau edge with a hop staircase plus a 1:2 ramp on the opposite side. Slot `high_perch`.
8. **card_field:** leaning cards forming 100 cm and 140 cm ledges. Vase slots.
9. **pocket_end:** a cul-de-sac platform. Slot `pocket_end`. A loop-back drop pad 4 x 4 m.
10. **slide_ramp:** a downhill run ≥ 12 m at 8-25° that feeds a G1 gap.

**Placement:**

- Each region gets a feature budget by archetype:

| Archetype | Proto-chunks |
|---|---|
| plaza | 1 (hub_plaza) |
| necropolis | 2-3 (roof_run) |
| graveyard | 2 (card_field or card_slab_run) |
| canyon | 1-2 (card_bridge over its gully) |
| mesa | 1 (mesa_climb) |
| terraces | 1-2 (terrace_ring) |
| dunes | 0-1 (slide_ramp) |
| pocket regions | +1 (pocket_end) |

- Candidate anchors come from a 4 m lattice inside the region.
- **Reject** a candidate if any of these hold:
  - it overlaps another footprint, an arena, the spawn basin or the spine corridor (except low items ≤ 120 cm);
  - it narrows any ramp below 6 m.
- **Score** = route adjacency (+ if 8-30 m from the spine polyline) + height delta bridged + **rhythmBonus**.
  - The rhythm bonus is +50% when the proto-chunk's entry and exit, plus its neighbours, form a chain of 3-6 links, 25-60 m long, whose path is 10-30% shorter than the spine segment it parallels.
  - Compute that with Dijkstra on the current player graph (step 8) before and after.
- Take the top candidate per budget slot, in order of region id.

### 8. Links and traversal graph (`links.mjs`, `validate.mjs`)

**Nodes** are walkable support cells `(x, z, layer)`, indexed as `idx = (z*N + x)*2 + layer`.

**Edges:**

- **WALK:** 4-neighbour with rise ≤ 70 cm and no cliff bit, plus 8-neighbour diagonals where both orthogonals pass.
- **HOP:** rise of 120-150 cm, where the take-off cell has ≥ 3 m of walkable depth behind it.
- **DROP:** fall of any height onto a landing with ≥ 4 x 4 m walkable at that layer. One-way.
- **G1, G2, AIR:**
  - from every lip cell (a walkable cell with a cliff or gully neighbour), cast in 16 integer directions, given as unit vectors × 1000 from a fixed table (no trig);
  - step 50 cm out to 800 cm;
  - the first walkable landing cell gives `gap = distance to landing edge` and `dh`;
  - classify against the reach table: G1 if gap ≤ g1(dh), G2 if ≤ g2(dh) and ≥ 550 at dh 0 (scaled for other dh), AIR otherwise if gap ≤ 800 and dh ≤ 360 cm;
  - require that the straight path does not pass through a cell higher than `min(start, landing) + 220 cm` (an apex check).
- **Authored** proto-chunk jumps are added as explicit links and verified against the table. A mismatch is a lint error.
- **Base links** = WALK, RAMP, HOP, G1 and DROP.

**Enemy graph:** a 2 m grid where an edge passes if both 1 m sub-steps pass the 60 cm rule. Decks join only through portals. `playerOnly` cells are excluded.

### 9. Encounters (`encounters.mjs`, simplified)

1. Collect slots from proto-chunks, plus terrain slots: `ring_open_r10/r14` on flat discs, `hub_edge` on plaza edges.
2. Compute per slot:
   - `pathDist` (base links from spawn);
   - `offSpine` (path distance to the nearest spine cell);
   - `gate` (0, or 0.5 if reaching it needs HOP or G1, or 1.0 if it is on a player-only island);
   - `exposure` (the fraction of a 12 m radius that is enemy-walkable and open);
   - `R = offSpine/40 + gate + exposure + guard`, kept in ×100 integer form.
3. Place quotas for stage 1 with the minimum R and spacing rules below. Stages 2 and 3 use the quotas from the run structure.

| Encounter | Count | Minimum R | Other rules |
|---|---|---|---|
| Card Chests | 8 | — | ≥ 25 m apart |
| Witness Stones | 2 | 2.0 | ≥ 110 m from spawn |
| Relic Broker | 1 | — | 80-160 m from spawn |
| Shrines | 3 | — | exposure ≥ 0.6, ≥ 70 m apart |
| Duel Statues | 2 | — | ≥ 120 m from spawn |
| Deck Anvils | 2 | 1.0 | ≥ 120 m from spawn; opposite path-rank half from the Witness Stones |
| Altar | 1 | — | in a pocket if one exists |
| Magnet Tablets | 2 | — | near half and far half |
| Bone Oaths | 2 | — | exposure ≥ 0.6 |
| Scales | 1 | — | |
| Broken Covenant | 1 | — | |
| Echo Forge | 1 (40% chance) | — | ≥ 200 m from spawn |
| Golden statues | 2 | 1.5 | |
| Sealed fragment | 1 | — | the deepest pocket |
| Vases | 40 clusters | — | gap lips first |

4. **Score each slot:** `0.4*norm(pathDist) + 0.3*norm(R) + 0.2*norm(detour*(0.5+exposure)) + 0.1*spread`, in integer ×1000. Place greedily, rarest type first.
5. **Economy.** Classes: FREE_ITEM = Witness Stone and Echo Forge; FREE_LEVEL = Anvil and Magnet Tablet; DANGER = Shrine, Duel Statue, Bone Oath and exposure ≥ 0.6.
   - Rule 1: within `openingM` path distance, at most 1 free-class reward, and no Witness Stone or Anvil.
   - Rule 2: build a POI graph from base-link path distances. No path of `econGraphM` or less from spawn may collect FREE_ITEM + FREE_LEVEL without visiting a DANGER node. Search with Dijkstra over states (node, collected-mask).
   - On a violation, swap the offender to its next-best slot, at most 16 times.
6. **Boss rings.** Choose 5-7 flat discs (radius ≥ 14 m, slope ≤ 15°, enemy-reachable) by greedy coverage until every reachable cell lies within 70 m path distance of a ring.

### 10. Validation metrics (`validate.mjs`)

Record each metric in the JSON as `{value, threshold, pass}`.

| Metric | Check |
|---|---|
| V2 | 100% of slots, boss rings and gate entrances reachable by base links from spawn |
| V3 | every node reachable by any link (base + G2 + AIR) can reach spawn by base links (reverse BFS on the base graph); also run Tarjan SCC and report the SCC count |
| V4 | stage 1: zero `pit` cells, and every gully cell within 20 m path distance of an exit back to the spawn SCC. Stages 2-3: every pit-edge cell within 12 m of a 3 x 3 `safeGround` patch in the spawn SCC |
| V5 | enemy main component ≥ 95% of walkable layer-0 cells; enemy-unreachable walkable area ≤ 8% |
| V6 | island sizes and counts as in the spec |
| V7 | spawn ring: at samples every 8 m along the spine polyline and on a 16 m lattice of walkable cells, valid cells in the 22-30 m annulus ≥ 40% and populated sectors ≥ 3 of 8 (sector from integer octant math); enemy path back ≤ 1.8 x straight-line distance (sampled on 8 annulus points per sample to save time) |
| V8 | boss rings: 5-7, coverage 70 m |
| V9 | spine: Dijkstra length in range; corridor width ≥ 12 m (distance transform from walls ≥ 6 m along the path); walk or ramp edges only |
| V11 | lure: every 40 m of spine, a heightfield ray (integer DDA) from eye height 170 cm to the top of some off-route encounter's landmark (assume 600 cm tall) within 35 m must be clear |
| V15 | jump lint: no forbidden-band rise next to walkable cells; every authored required jump within G1; every G2 has a G1-only alternative |
| V16 | rhythm: ≥ 2 chains |
| Economy | rule violations = 0 |
| Variety signature | `fnv1a32` over the sorted region adjacency list plus the tier list. The sweep counts collisions; the target is < 0.1% over 10k |

### 11. Repair (`repair.mjs`)

Use the `repair` stream. Each fix is followed by a re-run of all metrics; revert the fix if any previously passing metric fails. At most 4 passes, then attempt+1 (back to step 2), at most 8 attempts, then `fallback: true`. The prototype's fallback is simply a fixed hand-written region graph in `spec.mjs`, run through the rest of the pipeline.

| Failure | Fixes, in order |
|---|---|
| Unreachable slot | move the encounter to the best reachable slot within 30 m; or lower the blocking gap by 50 cm (shift the landing platform); or stamp a hop staircase at the nearest cliff |
| Soft-lock | stamp a hop staircase on the lowest cliff of the stuck component; else carve a ramp |
| Spawn ring | carve a ramp on the nearest cliff in the annulus, or remove the enclosing proto-chunk |
| Island too large | carve an enemy ramp into it |
| Economy | push the offender ≥ 40 m further down its branch |

## Output JSON (`<seal>_s<stage>.json`)

```json
{
  "sealCode":"7KQ2M9XA","stage":1,"genVersion":1,"attempt":0,"fallback":false,"hash":"9f3a12c4","ms":{"total":118,"macro":6,"terrain":31,"chunks":22,"validate":49},
  "size":{"grid":15,"cell_m":24,"hf":360},
  "spawn":[x_cm,z_cm],"gate":{"x":..,"z":..,"r_cm":2200,"entrances":[[x,z],...]},
  "districts":[{"id":"market","seed":[cx,cz],"cells":N}],
  "regions":[{"id":0,"district":"colosseum","archetype":"plaza","tier":0,"role":"spine","centre":[x,z]}],
  "edges":[{"a":0,"b":3,"type":"ramp2","spine":true}],
  "spine":{"len_m":256,"path":[[x,z],...]},
  "chunks":[{"type":"roof_run","anchor":[x,z],"rot":1,"mirror":0,"tier":0,"chain":true}],
  "links":{"WALK":n,"HOP":n,"G1":n,"G2":n,"DROP":n,"AIR":n},
  "islands":[{"area_m2":58,"seerPerchDist_m":14}],
  "bossRings":[{"x":..,"z":..,"r_cm":1400}],
  "encounters":[{"type":"witness_stone","x":..,"z":..,"layer":0,"R":2.35,"pathDist_m":164,"class":"FREE_ITEM"}],
  "metrics":{"V2":{"value":1.0,"threshold":1.0,"pass":true}, "...":{}},
  "repairs":[{"pass":1,"kind":"unreachable_slot","fix":"move","ok":true}],
  "signature":"a1b2c3d4"
}
```

**Hash.** xxHash32 (seed 0) over, in this order:

1. the Int16 heightfield bytes;
2. the u16 flags;
3. the chunk list;
4. the encounter list;
5. the boss rings.

Serialise the lists as little-endian Int32 tuples in sorted order.

## PNG (`render.mjs` + `png.mjs`)

**Size.** At `scale` px per metre (default 2), the image is `360*2 = 720` px square for stage 1. Origin is top-left = (0, 0) m. North is up.

**Encoder.** RGBA8, filter type 0 per row, `zlib.deflateSync`. Chunks: IHDR, IDAT, IEND, each with a CRC32 from a 256-entry table. Verify that the PNG opens in Chrome and Windows Photos.

**Layers, in draw order:**

1. **Height shading:**
   - a base colour per tier: tier 0 sand `#D8C08A`, tier 1 `#C4A46A`, tier 2 `#A9884F`, tier 3 `#8C6E3E`, tier −1 `#9C8A66`;
   - plus an intra-tier tint of ±12% by height inside the tier;
   - plus a hillshade from an integer gradient (NW light): `shade = clamp(128 + (h[x-1][z-1] - h[x+1][z+1]) / 4, 64, 192)`.
   - The rim is `#6B5A44`. Outside the mask is `#3A3026`.
2. **Cliff edges** are 1 px dark lines `#2A2018`. **Ramps** are light chevrons `#F2E3B8` every 4 m, pointing uphill.
3. **Player-only surfaces** get diagonal hatching `#FFFFFF` at 35% alpha.
4. **Decks** get an outline `#5AA0C8` (layer 1).
5. **Gullies** are tinted `#7A6040`. Pits, in stages 2-3, are `#201810`.
6. **Districts** have 2 px borders `#00000055`, and a district name label is optional (skip text if that is complex: draw a 6 px colored dot at the district seed instead).
7. **Spine route:** a 3 px cyan line `#22D3EE`. **Greed routes** (paths from the spine to each encounter): 1 px dashed white.
8. **Links:**
   - G1 = gold `#F5B301` 1 px line from take-off to landing;
   - G2 = blue `#3B82F6`;
   - DROP = red `#EF4444` with a dot on the landing;
   - HOP = short gold tick.
   - With `--debug` all links are drawn; otherwise only authored links and rhythm chains (rhythm chains drawn 2 px orange `#FB923C`).
9. **Boss rings:** a magenta circle outline `#D946EF` at true radius. **Gate:** a 44 m disc outline, white 3 px, with entrance ticks. **Spawn:** a green filled circle `#22C55E`, radius 4 m, plus a 30 m grace ring dotted.
10. **Encounter markers** are 7 px squares with a 1 px black border, coloured by class:
    - FREE_ITEM white `#FFFFFF`
    - FREE_LEVEL light green `#86EFAC`
    - paid gold `#FACC15`
    - danger red `#DC2626`
    - utility or risk violet `#8B5CF6`
    - collectible (golden statue, fragment) orange `#F97316`
    - Vases are 2 px brown dots `#8B5A2B`.
11. **Failures:**
    - unreachable cells that should be reachable: solid magenta `#FF00FF`;
    - soft-lock cells: blinking is not possible, so a black/yellow checker;
    - failing spawn-ring sample points: red X.
12. **Legend strip.** Add a 120 px band at the bottom. Text is optional; colour swatches in a fixed order are enough.
13. **The opening radius** (90 m path distance) is drawn as a contour: cells where pathDist crosses 90 m, white dotted.

## Self-tests (`node tools/genproto/test.mjs`)

1. `reach` expected values (±2 cm).
2. Seal Code round-trip for 1,000 random codes. `decode("7kq2m9xa") == decode("7KQ2M9XA")`.
3. Determinism: three runs of seed 12345 stage 1 give the same hash, including one run in a `child_process` fork.
4. xoshiro128** first 4 outputs for a fixed seed match the checked-in constants. Compute them once and freeze them.
5. A synthetic heightfield with a hand-built pit (a walled 10 x 10 m hole, 600 cm deep, with no ramp). V3 must fail, and repair must fix it with a staircase.
6. A synthetic 460 cm flat gap is classified G1; 600 cm is G2; 180-259 cm rises are snapped.
7. A synthetic economy case: a Witness Stone and an Anvil 40 m from spawn on open ground. Rule 1 must flag it, and swaps must resolve it.

## Acceptance criteria

- `--sweep 1000 --stage 1`:
  - ≥ 95% of seeds pass every metric at attempt ≤ 1;
  - fallback ≤ 0.5%;
  - median time ≤ 300 ms and p95 ≤ 800 ms on Randall's PC. The prototype is not optimised; the 150 ms target is for `src/gen`.
- **Variety:** zero signature collisions in 1,000 seeds, and a < 0.1% collision rate in a 10k sweep (run once and record it).
- **Visual check of 10 random seeds** (Randall or a reviewer):
  - districts read as irregular areas, not squares;
  - the spine is clear;
  - every encounter sits off the spine with a visible route;
  - at least 2 orange rhythm chains;
  - no magenta cells.
- **Per stage-1 seed:**
  - V2, V3, V5, V7 and V8 pass with the thresholds above;
  - every G2 has a G1 alternative;
  - zero forbidden-band rises.
- **Code hygiene:** `grep -nE "Math\.(random|sin|cos|tan|atan2|pow|exp|log|sqrt|hypot)" tools/genproto/*.mjs` hits only `reach.mjs` and `render.mjs`.
- Running `main.mjs --seal X --stage 1` twice gives byte-identical JSON (exclude the `ms` field, or write it to a separate `.timing.json`) and an identical PNG.

## Hand-off

When the prototype passes:

1. Port the modules into `src/gen` with the layout in the generator spec §14.
2. Replace the proto-chunks with the authored chunk library and socket solver.
3. Keep `render.mjs` as `tools/gen-render.mjs` and `--sweep` as `tools/gen-sweep.mjs`.

The checked-in golden hashes from the prototype are **not** carried over: `GEN_VERSION` becomes 2 when chunks arrive.
