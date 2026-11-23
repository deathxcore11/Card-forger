# DUEL SUMMONER: Spectacle spec

Date: 23 Nov 2026. Status: final after four reviews, for the PC builder. View only unless a line says OWNER DECISION.

Paths are relative to the game repo root (`duelsummoner/`). `H` means screen height. `W` means screen width. "Art pixel" means one pixel of the small internal picture (today half size, 960 x 540 at 1080p, `src/main.js:47, 68-70`). A number marked (guess) has not been measured. Section 11 lists every guess. Nothing in this file has been run.

**A frame in this spec means 16.7 ms.** At 120 Hz it is 2 display frames. Every rate limit is in real time or in sim ticks (60 a second), never in display frames.

This spec amends four older lines. Each is flagged where it happens:
- `design/feedback-feel.md:165` (no full-screen pass on handheld, at most 6 glows). See OWNER DECISION 1.
- `design/menus-spec.md:952` row "Spell effects" (Full / Soft becomes Auto / Full / Soft). See section 5.
- `design/environment-bar.md:38` (occluders fade to 30%). It becomes 25%, the nearest step of the new pattern.
- `design/art-book/look.mjs:14` ("The size chart is law"). Overtime swell grows own Fusions past the chart in Overtime only. See OWNER DECISION 5.

Everything in `design/stat-engine/SPEC.md` stays as written. Reach stays an area stat, as that spec and its probed sim say.

---

## 0. The owner's words and the promise

Randall, 23 Nov: "We must have awe sticking effects what makes these games cool is the craving screen breaking effects. In magabong you can get a size thomb and weapons get the seize of the screen damn bear and the know how to handle the camera and the view buy making it transparent in a way same with camera clipping with trees or whatever be a pro" and "Lighting and glowing and toxic and posing and ice and fire all that really cool shit".

This quote stays in design files only. No shipped string, code comment, lab label or commit text names another game.

1. Attacks, auras, explosions and monsters grow all run. At the top they fill the screen.
2. The duelist is visible on every frame, through anything.
3. Enemy attack warnings, pickups and the exit always read. Your own effects never hide, dim, shift or recolour them.
4. Nothing pops, flickers, strobes or puts the camera inside rock.
5. All 8 elements have their own shape, motion, status look, ground mark, death look and one big signature moment.
6. It holds 60 fps on the phone and 120 fps on the handheld, under 150 draw calls and 250,000 triangles, with no painted effect sheets.

"Posing" is read both ways. Poison gets a full element (3.4). Poses get hold poses on the big moments (4.1). Both ship.

---

## 1. GROWTH TO SCREEN SIZE

### 1.1 The one law: rules cap the footprint, looks own the sky

Facts from the audit:
- No stat makes anything bigger today. REACH and VOLLEY are in the stat spec only (`design/stat-engine/SPEC.md:72-73, 143, 187`. Unused constants in `src/data/tuning.js:21, 38`).
- A flat ground disc stops growing on screen at about 8 m radius. It is then 97% of W and 45% of H, and it can never pass the horizon at about 50% of H.
- So screen-breaking size must come from height, volume, count, light, the ground itself, the sky and the screen. Wider ground decals do nothing after 8 m.

The law:
- **L1. The ground footprint is the rule.** The rim of every own attack is drawn at exactly the rule radius, length and arc from the sim. It never lies.
- **L2. Everything above the ground is look.** Height, wall thickness, particle count, trails, glow, ground marks, screen-edge effect, camera move and sky grow with the tier and with the Reach stat. The sim never reads them.
- **L3. The view never feeds the sim.** No look value is written to game state. `test/purity.test.js` already guards this. The replay hash of a run must be the same with every effect on, off, Soft or Low.

Pass (L1): in the FX lab, the measured rim radius of every area attack is within 5% of the sim radius at Reach radius factor x1.0, x1.32 and x1.58.
Pass (L3): one seed, played from one replay with Detail High and with Detail Low plus Spell effects Soft plus Reduce flashing, gives the same final replay hash.

### 1.2 What drives size

| Driver | Kind | Range | Source | Status |
|---|---|---|---|---|
| Reach (REACH) | rule | area x1.0 to x2.5, so radius and length x1.0 to x1.58 | `SPEC.md:72, 187`, `tuning.js:21` | spec only. Wire it as area. See 1.3 |
| Volley (VOLLEY) | rule | +0 to +6 projectiles and chain jumps | `SPEC.md:143`, `tuning.js:38` | spec only. Wire it |
| Card level extras | rule | fixed per card at levels 3, 6, 10 | `src/sim/field.js:33-37`, `src/data/cards.js:21` (the comment at `field.js:32` says 3/6/8 and is stale) | live |
| Monster form | rule plus look | 0.9 m, 1.8 m, 3.6 m. Fusions 3.6 m, 4.5 m, 5.4 m. God Fusion 7.2 m | `src/data/scale.js:15-17` | live |
| Tier look scale | look | see 1.4 | this spec | new |
| Reach wall height | look | rim wall height follows the Reach stat, see 1.4 | this spec | new |
| Overtime swell | look | own Fusions and God Fusions grow +12.5% at each full Overtime minute, up to +100% at Overtime +8:00 (guess) | this spec, OWNER DECISION 5 | new |

Largest rule shapes at the Reach cap (area x2.5, radius x1.58): Twinflare Tyrant cone 19 m becomes 30.0 m. Cinder Hatchling splash 4.7 m becomes 7.43 m. Astral Magus blast 5 m becomes 7.9 m. Gust Ward 6 m becomes 9.5 m. Every one of these already fills the ground half of the screen.

**Overtime swell** is look only. Each step is one visible 0.4 s pulse: squash to 90%, overshoot to 115% of the new size, settle. A 5.4 m Fusion ends at 10.8 m. A God Fusion ends at 14.4 m. That stays under the 18 m gate boss, so bosses stay the biggest thing. Orbit, hit shapes and damage do not change. The ghost rule in 2.6 keeps a swollen monster from hiding the duelist.

Pass: at Overtime +2:00 the drawn height of a God Fusion is 9.0 m plus or minus 0.1 m, and the replay hash is unchanged.

### 1.3 How size meets the stat caps and the verified leaderboards

In force today, unchanged by this spec:
- Reach caps at +150% area. Volley caps at 6. Explosions cap at 32 per tick. New effects and numbers cap at 64 per tick. Chain jumps cap at 6 per hit and 400 per tick (`SPEC.md:236-246`, `tuning.js:69-72`).
- Verified leaderboards replay sim ticks. Looks cannot change a tick. So every look in this spec is leaderboard-safe by L3.

Reach, stated plainly so nobody wires it wrong:
- **R-a. Reach scales AREA.** `SPEC.md:72` says "area size", `SPEC.md:187` says "Reach area", and the probed stat engine applies it to area kinds only (`design/stat-engine/src/loadout.js:152, 161`). Radius and length scale by the square root of the Reach factor: x1.58 at the +150% cap. Arc angle does not change. Size on screen comes from L2 looks, not from this number.
- **R-b. The per-card area roll stays as the probed sim has it** (`loadout.js:161` multiplies it separately). This spec does not change it. If the stat owner wants it to share the Reach cap, that is a balance change and needs the probe re-run. It is not needed for anything here.
- **R-c. One Secret Fusion trait may lift the Reach cap**, as `SPEC.md:28, 271` already allow. Proposal: a trait named Boundless Hand lifts Reach from +150% to +300% area (radius x2.0). A Secret Fusion is an Overtime reward only. The boundedness probe must be re-run with it before it ships. This is OWNER DECISION 2.
- Linear Reach (radius x2.5) is not proposed. It would be area x6.25, which is 2.5 times past the envelope the probe validated.

Shots:
- Shot hit radius stays `CFG.card.hitRadius`, 0.95 m (`src/data/config.js:27`, read at `src/sim/weapons.js:79`), for every shot at every Reach. Reach does not touch shots. Shots get Volley.
- Shot draw size is look only and follows the tier table in 1.4.
- The shot pool stays 112 (`src/sim/game.js:38`). With Volley 6 the pool is the cap. Shots are already 1 instanced draw per type, so nothing is merged.

Pass: with REACH forced to +150% in the lab, a Hatchling splash rim reads 7.43 m (plus or minus 5%).
Pass: with REACH forced to +150%, the replay hash of a shots-only build is the same as at +0%.
Pass: with 112 live shots, shot draw calls are the same as with 1 live shot.

### 1.4 The five tiers

A tier is worked out in the view, per attack source, from values the sim already holds. The **screen tier** is the highest tier on the field. It gates the full-screen effects. It never drops inside a stage.

Times assume the approved pace: about 5 picks a minute, first Fusion at 5:30 to 7:00, Overtime after 8:00. All times are guesses until a played run.

"Claimed share" below means every pixel that shows an own effect: fills, rims, particles, marks, bolts, stained ground and the sky flame band. It is the awe measure. "Painted share" is the part drawn over the world (everything except stained ground and sky). Painted share has a hard upper limit in 2.5. Claimed share does not, because a recoloured floor hides nothing.

| Tier | Name | Condition (any one) | Entry event (4.1) | Typical time | Claimed share (guess) |
|---|---|---|---|---|---|
| 1 | Opening Hand | A monster in form 1 | Summon Call on every summon | 0:00 to 1:30 | under 2% |
| 2 | Full Field | A monster in form 2 (level 5). Any Spell or Trap at level 3 or more | Field Set | 1:00 to 3:00 | 2% to 8% |
| 3 | Ascendant | A monster in form 3 (level 10). Reach at +50% or more | Ascension | 3:00 to 5:30 | 8% to 20% |
| 4 | Cataclysm | Any Fusion on the field. Reach at +100% or more | Fusion Landing | 5:30 to 8:00 | 20% to 45% |
| 5 | Tablebreak | Overtime is running, and the field holds a Fusion in form 3, a God Fusion or a Secret Fusion, or one of these stat ceilings is reached: Reach +150%, Volley 6, crit multiplier x6.0, Affinity x3.0, Resonance +150% | Tablebreak | 8:00 onward | 45% or more |

Per-minute cap pips (`SPEC.md:268`, for BELL, HEAL_ONHIT, KILL_STACK) trigger nothing here. They clip in normal play.

What the player sees at each tier:

**Tier 1, Opening Hand.** Small, crisp, 2 tones. Shots are 0.3 m with a 1 art pixel core-tone centre and 1 speck trail. The newest 4 shots carry a dusk halo 0.6 m wide (6.8). A hit gives 3 specks and an enemy rim flash in the element colour. No ground mark. No screen effect. Each summon call slams its floor card down with a 6 m column for 0.3 s, so minute 0 already has a clip.

**Tier 2, Full Field.** Shots drawn up to 1.5 m with trails and afterimages. A hit ring on impact. Ground marks up to 1.5 m that last 6 s. Status looks on enemies (flame band, frost, bands). Lightning draws a real arc between chained enemies.

**Tier 3, Ascendant.** Attacks up to 4 m, and up to 6 m tall. Halos. Ground marks up to 4 m. A local light disc under big hits. Small heat haze. Forks on bolts. Fills start to thin by the ink rule (2.5). The camera starts to pull back on the Ascension beat.

**Tier 4, Cataclysm.** Attacks up to 10 m wide. Rim walls of flame, ice or stone 3 m tall at Reach +0%, rising with the Reach stat to 12 m at +150%. Shockwave distortion. Stepped glow. The screen edge takes the lead element at up to 50% strength. Hit-stop on elite kills. Ground marks up to 8 m. Signature moments unlock (section 3). The Fusion Landing is the entry event.

**Tier 5, Tablebreak. The screen-breaking tier.** This is the "size of the screen" state.
- **The ground is the attack.** The whole rule footprint of every large own attack is stamped into the stain map, and the ground shader recolours the floor in the element (lava, frost sheet, acid lake, cracked earth, ink). This costs 0 extra layers (6.7). The rim is drawn on top at the true rule radius.
- **The far side carries the awe.** Every large own attack is a hollow giant: a bright rim wall at the true rule radius, 16 m tall at Reach +0% and 40 m at +150% (60 m with Boundless Hand). The wall top rises and falls slowly at 0.5 Hz. On the camera side the wall is cut to 1.5 m (2.5), so the player gets a wall of fire behind the horde and a clear view in front. Nothing has an inside volume above 1 m.
- **Sky columns.** Every signature and every Fusion attack may throw a column 40 m to 60 m tall. Height is what breaks the horizon line. Every element has a tall Tier 5 piece (section 3).
- **The sky joins in.** The sky dome tints 20% toward the lead element, and the lowest 25% of the dome runs the stepped flame shader in the lead element's row at 8 pictures a second. The sky is drawn last, so this shades only pixels nothing else covers (about 0.5 screens of cheap fill at most).
- **Grand Card.** Every 8th thrown card also draws a ghost card 12 m tall standing on edge, rim only, riding above the true shot. The true shot core at the 0.95 m hit radius stays solid inside it. Look only (L2). 1 instanced draw, at most 14 instances. This is the direct answer to "weapons get the size of the screen".
- **Quiet eye.** Inside 3 m of the duelist the stain is drawn 30% toward the plain ground and own particles are culled. A calm disc in the middle makes the chaos look larger and keeps the duelist, near tells and near pickups easy to find.
- The screen edge runs at amount 0.6 for the lead element (6.8). Amount 1.0 is for moments only, at most 1.0 s.
- Impact frames are allowed (section 4).
- Stain marks last 30 s, so the ground behind the duelist records the run.
- The camera is at its pull-back cap. Past that, the ground, the rims and the sky carry the size.
- The game answers with more targets. That is pacing work and is outside this spec, but Tablebreak looks assume the Overtime spawn curve stays hungry.

Pass: an autorun logs the screen tier. It never drops within a stage.
Pass: screenshots of one focused run at 1:00, 3:00, 5:00, 7:30 and Overtime +2:00 show claimed share rising in order, inside the bands in the table (plus or minus 5 points).
Pass (screen-breaking): in one Tier 5 screenshot at Standard camera, 16:9, own-effect pixels touch all 4 screen edges, cross the horizon line in at least 3 places, and claimed share is 45% or more. The same screenshot at Tier 3 fails at least 2 of those 3 tests. (Needs eyes as well: does it read as huge.)

### 1.5 Giant monsters

- Own summons at 3.6 m cover 22% to 37% of H depending on where they orbit. A 5.4 m Fusion reaches the top edge on the camera side. Today they are switched off when they cross the sight line (`src/view/actors.js:311`). That is a pop every 7 s.
- New rule: own monsters are never switched off. They ghost (2.6).
- Orbit bias, look only: an own summon of 3.6 m or more leans its drawn position up to 1.5 m away from the camera side of its orbit (guess). Its sim position does not change. Its shots, cones and bolts start from the drawn position. Their end points and footprints stay at sim positions.
- Landing, look only: the landing shockwave and column start within 2 frames of the panel closing. The Fusion's first real attack fires when the sim says. If the owner wants a guaranteed first attack inside 12 ticks, that is a sim rule and goes to the pacing retune as its own line.

Pass: over 60 s with a 5.4 m Fusion orbiting, `mesh.visible` for that summon is true on every frame after its birth, and the duelist pixel test (section 7, check 3) passes.

---

## 2. THE SEE-THROUGH CAMERA

One system. One priority order. When two things want the same pixels, the higher one wins.

1. The duelist.
2. Enemy attack warnings (red tells).
3. Pickups, chests and the exit.
4. Enemies, elites and bosses.
5. Own summons.
6. Own effects.
7. Scenery and props.

### 2.1 The one dither

Every fade in the game uses one pattern: a 4 x 4 Bayer matrix, locked to buffer pixels, never animated. It replaces the noise in `src/view/scenery.js:78` and `src/view/mapMesh.js:30`.

```glsl
// shared chunk "dsDither". GLSL ES 3.00. No array, no table read. Gives 0,8,2,10 / 12,4,14,6 / 3,11,1,9 / 15,7,13,5
float bayer4(highp vec2 fc, ivec2 off) {
  highp ivec2 p = (ivec2(fc) + off) & 3;
  int v = (((p.y ^ p.x) & 1) << 3) | ((p.y & 1) << 2) | ((p.y ^ p.x) & 2) | ((p.y >> 1) & 1);
  return (float(v) + 0.5) / 16.0;
}
// keep: 1.0 solid, 0.0 gone
#define DS_FADE(keep, off) if ((keep) < 1.0 && bayer4(gl_FragCoord.xy, (off)) >= (keep)) discard;
```

Rules:
- The argument is `highp`. With a 16 bit `mediump` float, whole numbers stop at 1024, and the phone picture is 1200 pixels wide. Without `highp` the right 15% of the screen gets a broken pattern.
- The dither is locked to buffer pixels. Every dithered draw happens in the internal-size scene pass, so a buffer pixel is an art pixel.
- Occluders use 9 keep levels: 0% to 100% in steps of 12.5%. Own-effect fills may use all 16 levels.
- **Scenery, map, enemies, bosses and own summons all use offset (0,0).** Stacked occluders then open the same pixels. Two walls in a row, or a monster under a tree beside a cliff, still show 75% of the duelist.
- **All own-effect fills use offset (1,1). No per-element term.** Overlapping fills then share pixels, so 8 screen-sized fills at one keep cover no more of the screen than 1.
- Anything under 4 art pixels wide never goes below 50% keep (thin trunks vanish in stripes at 25%).
- In three.js r128 on a WebGL 2 context the chunk goes in as written. On a WebGL 1 context (no bit operations) use a 4 x 4 `DataTexture` with nearest filtering. Which path the builder's browser takes is checked in build step 1.

Pass: a screenshot of a faded pylon at 4x zoom shows a regular checker, not grain. (Needs eyes: confirm Bayer reads better than the old noise. It is a taste call.)
Pass: a 240 frame capture standing still shows 0 changed pixels inside a faded wall.
Pass: on a device with 16 bit `mediump`, a faded wall at buffer x = 1100 shows the same 4 x 4 pattern as at x = 100.

### 2.2 The porthole, for merged architecture

Covers: pylons, walls, pillars, columns, ruins, rim, landmarks, cliffs. These are one merged mesh, so an object cannot be picked. The hole is cut in screen space.

Replaces the 2.2 m world capsule at `src/view/mapMesh.js:27-31`.

```glsl
uniform highp vec3 uHole;   // x, y: duelist chest in buffer pixels. z: duelist view depth in m
uniform highp vec2 uHoleR;  // x = 0.9 * duelist height on screen in pixels. y = 1.3 * the same
uniform highp float uFeetY; // duelist feet height in world m
in highp float vViewZ;      // fragment view depth in m, positive
in highp float vWY;         // fragment world height in m (one float, not the whole position)
float holeKeep() {
  highp vec2 q = (gl_FragCoord.xy - uHole.xy) / uHoleR;
  float d = dot(q, q);
  float front = step(vViewZ, uHole.z - 0.8) * step(uFeetY + 0.4, vWY);
  float k = d < 0.55 ? 0.25 : (d < 1.0 ? 0.5 : 1.0);    // two hard bands
  return mix(1.0, k, front);
}
// in main(): DS_FADE(min(holeKeep(), nearKeep()), ivec2(0))
```

Numbers:
- Hole half-width 0.9 times the duelist's on-screen height. Half-height 1.3 times (guess). At the default camera that is 12% of H by 17% of H.
- Inner band (d under 0.55): keep 25%. Outer band (d 0.55 to 1.0): keep 50%. Outside: solid.
- A fragment qualifies only if it is at least 0.8 m nearer the camera than the duelist, and at least 0.4 m above the duelist's feet. So the ground under the feet never gets a hole.
- The hole size follows the duelist on screen, so it does not grow huge when the wall is near the lens (the old world capsule did).
- The uniforms are set once a frame at `src/main.js:426`, where the map fade uniforms are set today. They use the unshaken camera and the smoothed duelist position, so shake cannot make the hole jitter.

Pass: see check 1 in section 7 (pylon circle, pixel count).

### 2.3 Whole-object fade, for separate things, with no per-frame upload

Covers: trees (trunk and canopy as two parts), boulders, bushes over 1.5 m, crystals and mushrooms, Witness Stone slabs, Broker canopy, shrines, altar, statues, chests, vases, swarm enemies, elites.

The test runs in the vertex shader from uniforms. One value per instance. Nothing is uploaded per frame. Non-instanced props use the same chunk with the instance matrix left out.

```glsl
// shared chunk "dsCorridor" in the vertex shader
uniform highp vec3 uCam, uDuelist;    // UNSHAKEN camera eye, SMOOTHED duelist chest
uniform vec3 uBoundC;                 // bound centre in model space
uniform float uBoundR;                // bound radius in model space, m
uniform float uKeep0;                 // keep when the bound sits on the line, e.g. 0.25
flat out float vKeep;
float dsKeep(float gap) {             // a ramp over 3 m, rounded to 1/8 steps
  return floor((uKeep0 + (1.0 - uKeep0) * clamp(gap / 3.0, 0.0, 1.0)) * 8.0 + 0.5) / 8.0;
}
void dsCorridor(mat4 inst) {
  highp vec3 c = (modelMatrix * (inst * vec4(uBoundC, 1.0))).xyz;
  float s = length(inst[0].xyz);
  highp vec3 d = uDuelist - uCam;
  float t = clamp(dot(c - uCam, d) / dot(d, d), 0.0, 0.92);   // stop short of the duelist
  float gap = length(c - (uCam + d * t)) - uBoundR * s;       // m outside the bound. Negative = on the line
  vKeep = dsKeep(gap);
}
```

Keep per kind:

| Kind | Keep on the line (`uKeep0`) | Bound |
|---|---|---|
| Tree canopy | 25% | sphere at 7.5 m x scale, radius 4.8 m (variants 0, 1) or 3.7 m (variants 2, 3) x scale, the values the CPU loop uses today (`scenery.js:101`) |
| Tree trunk | 50% | capsule tested in XZ only, see the tree code below |
| Boulders, crystals, mushrooms, bushes over 1.5 m | 25% | sphere, radius from the geometry |
| Props (slabs, canopy, shrine, altar, statue) | 25% | sphere from the mesh bound |
| Chests, vases | 50% | they are priority 3 and are never thinner than 50%. The silhouette (2.8) covers the rest |
| Pickups | 100% | pickups never fade. They are smaller than the duelist |
| Swarm enemies, elites | 50%, edge solid | sphere, radius 0.6 x enemy size |
| Own summons | see 2.6 | |
| Bosses | see 2.7 | |

Every kind reaches 100% keep when its bound is 3 m or more off the line.

**Trees.** The trunk and canopy share one mesh with `aPart` (`scenery.js:77`), and all 4 variants share one material today (`scenery.js:76, 80`). Clone the material once per variant (4 materials, still 4 draws) so each has its own canopy radius. The tree vertex shader runs both tests and `aPart` picks:

```glsl
uniform vec3 uBoundC2; uniform float uBoundR2;       // canopy: centre (0, 7.5, 0), radius 4.8 or 3.7
uniform float uTrunkTop;                             // 6.4 or 5.6, m in model space
// canopy: dsCorridor with uBoundC2, uBoundR2, uKeep0 0.25  -> kCanopy
// trunk, XZ only:
highp vec3 c = (modelMatrix * (inst * vec4(0.0, 0.0, 0.0, 1.0))).xyz;      // tree base
highp vec3 d = uDuelist - uCam;
float tt = clamp(dot(c.xz - uCam.xz, d.xz) / max(dot(d.xz, d.xz), 0.0001), 0.0, 0.92);
float gapT = length(c.xz - (uCam.xz + d.xz * tt)) - (0.55 * s + 0.35);
float lineY = uCam.y + d.y * tt;                     // height of the sight line at that point
bool inSpan = lineY > c.y - 0.5 && lineY < c.y + uTrunkTop * s;
float kTrunk = inSpan ? floor((0.5 + 0.5 * clamp(gapT / 3.0, 0.0, 1.0)) * 8.0 + 0.5) / 8.0 : 1.0;
vKeep = aPart > 0.5 ? kCanopy : kTrunk;
```

The CPU loop and the two dynamic attributes at `scenery.js:92, 95-107` are deleted. This removes a per-frame loop over every tree and an upload.

There is no time easing, because there is no memory. The ramp replaces it. Because the test reads the unshaken camera, shake cannot flip a canopy between steps.

**Enemy edge.** Enemies in the corridor keep a solid edge, so an enemy that can hit you is never unreadable.
- Today's stand-in bodies are flat-shaded octahedra, boxes and icosahedra (`src/view/actors.js:99-100`). A fresnel test on flat face normals keeps whole faces or none, so it is not a rim. For stand-ins: body keep 50%, the eye quad never fades, and a 1 art pixel ink inverted hull is drawn per enemy kind (at most 7 extra draws in the browser).
- Real models carry smooth normals as a second attribute. For them the edge is in the body shader at 0 extra draws: `float rim = 1.0 - abs(dot(normalize(vSmoothN), normalize(vV))); if (rim < 0.6) DS_FADE(vKeep, ivec2(0))`.

Enemies are never switched off. Delete the hide at `src/view/actors.js:350` and the 3 m hide inside `blocked` (`actors.js:243`). The near-camera fade (2.4) takes over.

Pass: with the lab's "walk the line" tool at run speed with Shake 100, no canopy, trunk, boulder or prop keep changes by more than 12.5 points between two frames.
Pass: a test that wraps `gl.bufferData` and `gl.bufferSubData` counts 0 calls from scenery buffers in a 60 s walk.

### 2.4 Near-camera fade, on everything except the ground

One line in every object shader. It is the catch-all for an elite on the lens, grass, a prop the spring missed.

```glsl
float nearKeep() { return floor(clamp((vViewZ - uNear.x) / (uNear.y - uNear.x), 0.0, 1.0) * 4.0 + 0.5) / 4.0; }
```

| What | Gone under | Solid from |
|---|---|---|
| Scenery, props, map solids, enemies | 0.8 m | 2.4 m |
| Own effects, own summons | 2.0 m | 5.0 m |
| Bosses | never under 50% keep | 2.4 m |
| Duelist | never fades out. Under 1.4 m of camera distance the body keeps 50% and the outline stays | |
| Ground, enemy warnings, pickups, exit | never fade | |

Grass and flowers keep their 4 m collapse (`scenery.js:82, 85-86`).

Pass: in a 60 s run with 300 enemies, no frame has one non-ground object that is nearer than the duelist covering more than 30% of the screen at more than 50% keep.

### 2.5 Own effects: the ink rule, the rim, the keyhole

Principle: as a thing grows, the fill thins and the edge stays. Size is shown by the rim, the ground and the sky, not by paint over the play field.

**Ink rule.** Each own effect may paint at most `uInk` of the screen in fill, however big it is.

```glsl
// vertex shader, once per effect instance
float rN = aRadius * uProjY / max(viewZ, 0.5);                 // radius in half-screen-heights
float cover = clamp(3.1416 * rN * rN / (4.0 * uAspect), 0.0, 1.0);
vFillKeep = min(clamp(uInk / max(cover, 0.001), 0.125, 1.0), uGovernor);   // the governor may go below the 12.5% floor
```

| Share of screen covered | Fill keep (Auto, `uInk` 0.05) | Geometry |
|---|---|---|
| under 5% | 100% | solid |
| 10% | 50% | rim solid, fill dithered |
| 20% | 25% | rim solid, fill dithered |
| over 25%, ground area | no mesh fill on native Detail Medium and High: the fill is the stain map (6.7). On Detail Low and in the browser: hatch at 12.5% | rim mesh only. Inside volume at most 1 m tall |
| over 25%, volume | 12.5% | rim wall, sparse particles. No inside volume above 1 m |

**The rim is always solid**, in the element's bright tone with a 1 art pixel ink edge.
- Volumes (domes, walls, giant shapes): `float rim = step(0.6, 1.0 - abs(dot(normalize(vN), normalize(vV))));`
- Flat discs, rings, fans: `float w = fwidth(vR) * uRimPx; float rim = step(1.0 - w, vR);` with `uRimPx` 2.0. `vR` is a `highp` varying and `fwidth` is taken in the first line of `main()`, before any branch or discard. The rim is never under 1 art pixel.
- Thrown weapons: inverted hull, 1 art pixel. All shot types share one outline program and one instance buffer: 1 extra draw.

**Camera-side cap.** The tall wall is a far-side thing.
- Any own wall, column or volume fragment that is nearer the camera than the duelist (`vViewZ < uHole.z`) is drawn only up to 1.5 m above the ground. Above 1.5 m its keep is 0%, rim included.
- Any own fragment within 8 m of the camera has keep 0% above 1.5 m.
- At the Reach cap a rule radius (7.4 m to 9.5 m, up to 12 m with Boundless Hand) is close to the camera distance (10 m to 18 m). Without this cap the near arc of a 40 m wall would sit on the lens.

**Fill style.** Volumes use the Bayer stipple. Mesh ground fills (Detail Low and browser only, above) use a world-anchored hatch so the pattern sticks to the floor:

```glsl
highp float h = (wp.x + wp.z) * 1.0;         // 1.0 m period. wp is a highp varying. One angle for every element
float fw = fwidth(h);                         // first line of main()
bool stripe = fract(h) < min(vFillKeep, 0.25);
bool on = fw > 0.167 ? (bayer4(gl_FragCoord.xy, ivec2(1)) < min(vFillKeep, 0.25)) : stripe;   // under 6 art pixels a pair: stipple
```

- Stripe duty equals the fill keep, at most 25%.
- Hatch tone differs from the ground under it by at most 20 L* points. The hatch never animates.

**Keyhole.** Inside a screen circle round the duelist's chest, own-effect fills are 0% and rims are 50%. Radius = max(12% of H, 0.9 x the duelist's on-screen height), the same measure the porthole uses. On top of that, own-effect fill is drawn with the stencil test of 2.8, so it never paints over the duelist's own pixels.

**Blend.** Fills, rims, bolts, particles and marks draw with blending off. Halos are the only blended own-effect draw (state in 6.8). Own-effect draws test depth and never write it. `DS_FADE` is the first statement of `main()` in every own-effect fragment shader, before any texture read.

**The governor.** Two sums, both worked out on the CPU each frame from the effect records.
- **Rasterised sum** = the sum of screen cover over all own fills, volumes, marks and halos, dithered or not. A discarded pixel is still rasterised, so this is the true fill cost. Limit 5.0 screens: own fills and volumes 3.0, marks 1.0, halos 1.0. Over a limit, the smallest of that kind is dropped first. Rims stay.
- **Kept sum** = the sum of cover x keep over own fills and volumes. If it passes the limit below, `uGovernor` drops so that every fill keep is capped, smoothed over 0.3 s.

| Spell effects setting | `uInk` | Kept-sum limit (guess) | Painted share limit (guess) | Own particles |
|---|---|---|---|---|
| Auto (default) | 0.05 | 0.35 screens | 55% of the screen | 100% |
| Full | 0.08 | 0.50 screens | 65% | 100% |
| Soft | 0.025 | 0.20 screens | 35% | 50% |

At every setting, painted share inside the centre 40% by 40% box of the screen is at most 35%.

**Owner tag.** Every effect record carries `owner`: 0 player, 1 enemy, 2 world. Only owner 0 is touched by the ink rule, the governor, the keyhole, Spell effects and the drop ladder. A build test fails if any effect spawn has no owner.

**Colour law.**
- No own effect uses hue 345 to 25 degrees (`design/reference-run-1123.md:306`). For ground fills and stains the banned band widens to 340 to 35 degrees.
- No own effect uses #ffffff. Pure white is only the duelist outline, silhouette and marker.
- Enemy warnings are the only solid ground shapes in the game. A recoloured (stained) floor is not a solid fill: the ground's own pixel pattern stays visible under it (6.7).
- Every enemy warning has a 1 art pixel ink edge (#1e1e2a) and inside it a 1 art pixel pale edge (#ffd9d4), and its fill sweeps inward as the attack winds up. Shape and motion carry the warning, not only the red.
- No own ground tone may be within 25 L* points of the tell fill (#ff3b30, about L* 56) where they can overlap. So fire and poison ground fills and stains use their shade or bright tone, never the body tone.

Pass: see checks 2, 5 and 6 in section 7.
Pass: on the Tier 5 stress replay the lab readout shows rasterised sum 5.0 screens or less and painted share inside the table limit on every frame.
Pass: under deuteranopia and protanopia simulation, a tell on each of the 8 element grounds is found in under 0.5 s (needs eyes), and tell edge to ground contrast is 3:1 or more.
Pass: a 10 s camera pan over a hatched 30 m fan on Detail Low shows no stripe pair under 6 art pixels and no shimmer in a 10 fps strip (needs eyes).

### 2.6 Own monsters ghost, they do not vanish

Replaces `mesh.visible = ... !blocked(...)` at `src/view/actors.js:311`.

| State of an own summon | Body keep | Outline |
|---|---|---|
| Clear of the corridor, covers under 25% of the screen | 100% | none |
| Covers 25% of the screen or more (guess) | 50% | 1 art pixel, #b26bff (violet means summons, `look.mjs:31`) |
| In the corridor, nearer than the duelist | 25% | same |
| Under 5 m from the camera | near fade (2.4) on top | same |

- Summons are few, so their state is worked out on the CPU. Steps change at most once per 0.35 s. The 25% screen share has 10% hysteresis. Corridor entry has 0.5 m hysteresis. No flicker at the edge.
- The outline is an inverted hull, 1 draw per summon mesh (4 to 6 draws at most).
- Enemy warnings under a summon are drawn a second time through it, by the stencil rule of 2.8, at 50% keep. So a red tell under a giant summon still shows.
- If the violet outline is lost on Stage 3 or against a Dark build (check by eye), it becomes a 2-ring outline: ink outside, #b26bff inside.

Pass: a 5.4 m Fusion orbiting for 60 s is never invisible, and the duelist pixel test reads 60% or more on 97% of samples.
Pass: a red tell placed fully behind a 7.2 m summon keeps 45% or more of its pixels.

### 2.7 Bosses never fully fade

A boss is a threat. It must always be seen. So it is handled by the camera first, and by a small window second.

1. Camera pull-back and raise (2.9) fits the boss. This exists (`src/main.js:420-423`).
2. If the boss body still crosses the sight line, only the inner porthole band applies, at 50% keep. Never 25%. Never whole-body.
3. The duelist silhouette (2.8) shows through the boss.
4. The boss's own attack warnings are drawn through its body by the same second draw as 2.6.
5. Near the lens a boss never goes under 50% keep.
6. Elites and Toll Shades follow the enemy row in 2.3 (50%, edge solid).

Pass: with the 18 m gate boss placed between camera and duelist, boss pixels kept are 85% or more of its unfaded pixels, and the duelist body-or-silhouette share is 70% or more. (The silhouette is a 50% checker, so 100% is not reachable. The outline is the rest of the answer.)

### 2.8 The duelist through anything solid

Needs a depth plus stencil buffer (DEPTH24_STENCIL8, core in ES 3.0). The canvas in three.js r128 has stencil by default. A render target does not: the scene target is made with `depthBuffer: true, stencilBuffer: true` (step 10).

Stencil plan, with masks so the two writers never collide:
- **Duelist, normal draw**: write mask 0x01, func ALWAYS, ref 1, op REPLACE on depth pass.
- **Own summons**: write mask 0x02, func ALWAYS, ref 2, op REPLACE on depth pass.
- **Own-effect fill, and the silhouette**: func NOTEQUAL, ref 1, read mask 0x01.
- **Warnings through summons**: func EQUAL, ref 2, read mask 0x02, depth func GREATER.

The duelist's extra draws, all in the priority pass (2.12):
- **Silhouette**: the duelist again. Depth func GREATER, depth write off, stencil as above. Flat #ffffff at a 50% checker. The checker says "behind something". (`look.mjs:31` reserves white for the player outline.)
- **Outline, 2 tones**: one inverted hull #ffffff, 1 art pixel, and a second hull of ink #1e1e2a, 1 art pixel outside it. Always on. The ink ring is what keeps the duelist findable inside pale bolts and rays.
- **Marker**: a white chevron 0.5 m tall above the head. On Auto it shows when a cheap bounds test says the duelist has been under 40% visible for more than 0.5 s, and whenever boss zoom takes the duelist under the size floor of 2.9. On Always it shows on every frame. This is the Access row "Duelist marker" (5.1).
- Duelist only. Summons behind walls get no silhouette, or the screen fills with ghosts.

Cost: the rig builds 1 skinned mesh per model part (`src/view/rig.js:95`), so this is 3 extra draws per rig mesh. With a 2 mesh rig: 6 draws, under 7,800 triangles. The builder counts the rig meshes in step 2 and reports the true number.

Pass: behind a pylon with the porthole switched off by a debug flag, silhouette pixels are 45% to 55% of the duelist's unoccluded pixels, and the white outline is unbroken on 100% of its length.
Pass: with the duelist standing inside a Tier 5 light or lightning build during an impact frame, the ink edge is unbroken round 90% or more of the outline.

### 2.9 Camera pull-back with build size

Today the camera zooms for bosses only, and Reduce motion turns that off (`src/main.js:420-423`). The boss zoom and the speed zoom (`src/view/camera.js:26-29`) multiply to as much as x2.44.

How the camera is built today matters here: the stored FOV is horizontal, the vertical FOV is clamped to 64 to 88 degrees, and the arm is scaled by `fovK` so the duelist is about the same share of H at every aspect (`src/main.js:59-62`). At zoom 1.0 the duelist is about 13.3% of H.

New:
- R = the largest radius in metres of a persistent own effect or own summon body (aura, orbit, rim wall, summon half-height). Effects that live under 1.0 s do not count. The peak is held for 2.0 s so a pulsing effect does not pump the camera.
- `ownZoom = clamp(R / 5.4, 1.0, cap)`. The 5.4 m is a fit factor of 0.8 at the 16:9 base camera (arm 10.07 m, vertical FOV 67.7 degrees). R 6 m gives 1.11. R 8 m gives 1.48.
- **The cap is a size floor, not a factor.** `cap = 0.1333 / minShare`. `minShare` is 0.075 of H on PC and on screens of 7 inches or more, which is 40 art pixels on the 540 pixel picture, the art book's own silhouette size (`look.mjs:7`). It is 0.085 on screens under 7 inches (guess). So cap is 1.78 or 1.57. In code: `dMax = 1.8 m / (2 * minShare * tan(fovV / 2))` and `cap = dMax / (arm * fovK)`.
- `total = max(bossZoom * speedZoom, min(cap, ownZoom * speedZoom))`. Max, not product, for boss and own. Own-size pull-back never takes the duelist under the size floor.
- Boss zoom keeps today's values, up to x2.44 with speed zoom. That is under the floor (about 5.5% of H), as it is today. The duelist marker (2.8) shows while it is. This spec does not pull the gate boss camera in. Run `test/browser-camera.mjs` before merging step 4 to prove boss framing is unchanged.
- Smoothing: out at 1.6 per second (as now, `camera.js:26`). In at 0.7 per second. Changes under 5% are ignored. Camera distance changes at most 12 m a second.
- Height: the arm angle rises by up to 0.2 rad as total goes 1.0 to cap. Looking down more is what lets you see over big things.
- Past the cap the camera stops. The ground, the rims and the sky carry the rest. That is the Tablebreak state.
- Pickups never draw under 6 art pixels wide. Chests never under 14.
- Camera distance setting (Near, Standard, Far, `menus-spec.md:866`) scales the arm by 0.85, 1.0, 1.15 before all of this (guess). Not built yet.

FOV rule: FOV is never used to fit effects. The stored setting stays horizontal 80 to 115 degrees, default 100. FOV kicks for own effects are at most 5%, for at most 0.5 s. The boss intro push (24%, 2 s, `main.js:431`) stays.

Reduce motion: pull-back stays on, at 0.5 per second both ways. It is readability, not decoration. This is part of OWNER DECISION 4.

Pass: at 4:3, 16:9 and 20:9 with R forced to 8 m, within 2.0 s the far arc and both side arcs of the rim are on screen, the near arc is on screen or under the hotbar only, and the duelist is at least `minShare` of H.
Pass: with no boss alive, the duelist is never shorter than `minShare` of H in a 10 min Overtime run.

### 2.10 Collision: what never happens

Never: the camera inside rock. Never: a black or inside-out region. Never: a pop. Never: sorting flicker. Never: a screen that is all rock.

- **Near plane 0.15 m** (now 0.5 m at `src/main.js:57`). The probe sphere is 0.3 m (`src/view/camera.js:12`). At 0.5 m the near-plane corner is about 0.85 m from the eye at 16:9 and can poke through a wall the probe cleared. At 0.15 m the corner is about 0.27 m away, inside the probe. With the nearer plane the depth buffer must be 24 bit: at 16 bit, depth error is about 1 m at 100 m.
- **Pass behind thin things.** If the wanted camera position is free and the blocked span along the arm is 8 m or less (guess), the camera does not pull in. It stays at full distance and the porthole (2.2) opens the blocker. This uses the 40 samples the march already takes (`camera.js:38-43`): count blocked samples and test the last one.
- **Pass-behind needs a view.** It is allowed only if at least 3 of 4 extra rays from the camera to points 4 m left, right, in front of and behind the duelist are clear. Otherwise a cliff or long wall would fill the screen and the player would see only the porthole. If the test fails: swing up, then pull in.
- **Hysteresis.** Enter pass-behind at a blocked span of 8 m or less. Leave it above 10 m. Hold either choice at least 0.5 s.
- **Pull in only when the wanted position itself is solid, or pass-behind is refused.** Then, before the distance drops under 4.0 m (guess), swing the arm up by as much as 0.5 rad first, at most 1.0 rad a second, eased. The floor stays 2.2 m (`src/data/config.js:18`) as a last resort.
- **Smooth rise.** Replace the 1.0 m jumps at `camera.js:49` with a rise of at most 6 m per second (0.10 m per frame).
- **Trunks and small rocks are fade-only.** In `hitProp` (`camera.js:13-18`) skip every collider with `c.r < 2.0` m. That covers every trunk (r 0.7 m to 1.2 m) and every rock under scale 2 (`src/sim/colliders.js:5, 9-10`). No sim file changes. Today trunks both collide and fade, which snaps the camera in groves.
- **No sorting flicker**: all fades are opaque dither. Nothing new is alpha sorted.
- **No pops**: every fade is a ramp (2.3). Nothing sets `visible = false` for line-of-sight reasons.
- Ceilings do not exist yet. When they do: a ceiling over walkable ground is at least 18 m up, or is tagged roof and dithers to 0% while the duelist is under it.

Pass: see checks 4 and 7 in section 7.

### 2.11 How this closes the pylon failure

The failure today: a gate pylon (10 m by 7 m, 24 m tall) hides the duelist. The old test found the sight line through it on 16 to 30 of 240 frames.

Three causes, three fixes:
1. The hole was a 2.2 m world capsule with one hard edge. It is now a screen-space porthole sized to the duelist (2.2). Built in step 1.
2. The camera pulled in to 2.2 m at the pylon corner, where the duelist fills 35% of H. It now passes behind when only a corner is in the way (2.10). Built in step 4.
3. The test (`test/browser-pylon.mjs:6`) checks geometry at 3 points, so it reports "hidden" even where the dither has opened the pylon. It is replaced by a pixel count (check 1). The silhouette (2.8, step 2) is the second net.

Pass after step 1: check 1 reads 120 of 120 steps. (Estimate, not a run: the inner band at 25% keep leaves about 75% of the body visible on the test circle.) Cause 2 is closed in step 4, not step 1.

### 2.12 Draw order

1. **Scene pass**, in this order:
   a. Opaque draws with no discard, front to back: duelist (stencil 0x01), own summons (stencil 0x02), enemies, props.
   b. The ground.
   c. Every draw on a discard program: faded scenery, the map with the porthole, ghosted summons, corridor enemies. Putting these after the ground keeps hidden surface removal working for everything before them.
   d. The sky, last, with depth func LEQUAL (the sky is drawn first today, `src/main.js:52-56`. Drawing it last saves up to 1 full-screen layer).
2. Ground marks (own, then world).
3. Own-effect fills and rims. Blending off, depth test on, depth write off, stencil NOTEQUAL 1.
4. Halos (the one blended draw).
5. Offset pass, glow passes, composite (6.8).
6. **Priority pass, drawn after the composite**, into the composite target, which shares the scene's depth-stencil attachment: enemy warnings. Then warnings through own summons (2.6). Then enemy warnings within 8 m of the duelist a second time through any scenery, depth GREATER, at 50% keep. Then pickups, chests and the exit. Then the duelist silhouette and outline. Then the marker.
7. Nearest blit to the screen.
8. HUD and damage numbers.

Because the priority pass comes after the composite, no distortion, dim, colour drain, impact frame, flash or screen edge can touch a warning, a pickup or the exit. Because own effects never write depth, nothing of the player's can hide them either.

**Pickups and the exit.**
- Pickups always carry a 2-ring edge in their own shader: 1 art pixel ink outside, 1 art pixel of the pickup's bright tone inside. They always bob. An ink ring alone is invisible on dark Stage 2 and 3 ground.
- The exit (portal or Descent Circle) draws in the priority pass with a beacon line at least 2 art pixels wide and 20 m tall, and a HUD edge arrow when it is off screen.

On Detail Low there is no composite. The priority pass is drawn straight after step 4.

In the browser, if r128 cannot share one depth-stencil texture between two targets (not verified), draw the priority pass at the end of the scene pass and let those pixels carry the protected alpha value of 6.2. Check this in step 10.

Pass: a frame capture at a pylon shows the discard draws after the ground draw.
Pass: with a Tier 5 Dark build, a shockwave and an impact frame all live, every red tell pixel has the same position and the same colour within 2% as with all effects off.

---

## 3. THE EIGHT ELEMENTS

### 3.0 Shared rules

- **Shape before colour.** Fire: upward tongues and triangles. Ice: straight facets and hexagons. Lightning: zigzags. Poison: round bubbles and drips. Wind: long curved streaks. Earth: squares, chunks, cracks. Light: straight rays and card rectangles. Dark: holes, and wisps that move inward.
- **One ramp.** An 8 x 8 RGBA8 texture made in code. One row per element. Columns: 0 core, 1 bright, 2 body, 3 shade, 4 ink. Colour assist swaps rows.
- **The art book is the colour law.** Core, bright and body come from the book's effect palette (`design/art-book/make.mjs:59`, named at `design/art-book/look.mjs:33`). Shade and ink are proposals (guess). The book is explicit on three points that the code and the first draft of this spec had wrong: lightning is blue-white, not gold (gold means "use me"). Ice is milky, not XP cyan. Dark is black with a moon-white edge, not violet (violet means summons).
- **Fix the code colours.** `src/view/fx.js:6` has lightning #8fe8ff and ice #9fd8ff, almost the same blue, and `src/view/hud.js:22` knows only fire and lightning. Both read the ramp table after step 6.
- **Lightning and ice are both blue in the book.** They are split by saturation (lightning body #7fb8ff is electric, ice body #8ab8e0 is grey-milky), by the indigo shade on lightning, by shape (zigzag against facet) and by motion (20 pictures a second against still). Check 23 tests this by eye.
- **No pure white.** No own effect uses #ffffff. The book's white-hot light core becomes #fffbe8. Pure white is the duelist's.
- **Ink, not added light, on bright ground.** Stage 1 ground is L* 62 to 78. Added light turns to white there. Fire, ice, lightning, poison and earth carry a 1 texel ink edge. Glow is made by darkening the ground round the effect first (the dusk halo, 6.8), on every Detail level.
- **Stage contrast edge.** If an element fails the contrast Pass below on a stage, on that stage it gains a 2 art pixel edge: ink #18161c where the ground is light, its own core tone where the ground is dark. Likely cases (guess): poison on Stage 1 meadow (#8fa860) and beside Stage 2 ghost-light (#8fbf8a). Ice, lightning and dark beside Stage 3 moon-white crystal (#d8e4f4) and basalt (#1e1e2a). Light on Stage 1 sand.
- **Stepped time.** Effects animate on slow clocks: fire 12 pictures a second, lightning 20, gas and dark 8, ice sparkle 6. Motion of the object itself stays smooth. A stepped clock never blinks a large area: see the flash rules in 4.2.
- **Danger wins.** Red tells draw in the priority pass, after everything, and are never dithered.
- **Nothing that looks like loot.** No own particle in the ice, lightning or light row rests on the ground or stands still for more than 0.2 s. Frost sheet and Seal print sparkles use the core tone only and live 2 frames. A still pale speck on the ground reads as a pickup.
- **The seal disc is ours and is fixed.** One ring, and inside it 4 card rectangles (ratio 5:7) set as a cross, one per Monster Zone, with a small square at the centre. No runes, no letters, no star, no eye, no triangle. It is drawn in code from 5 rectangles and 1 ring.
- **Signature trigger** (a look choice, not a rule, counted in sim ticks from sim kill events): one element lands K kills inside 60 ticks, where K = max(25, 2.0 x that element's average kills per second over the last 600 ticks). At most once per 1,200 ticks per element. Never while an offer or reveal is open. Only at screen tier 4 or 5. So it fires on a spike, not on the steady state. The 25 and the 2.0 are guesses.
- **Death looks.** An enemy killed by an element dies in that element, using the ghost corpse pool of 48 at 0 extra draws. Fire: a 6 frame bottom-up ash screen-door. Ice: a 0.12 m grid shatter. Poison: the corpse squashes to the ground over 0.25 s and becomes its own acid pool. Dark: an inward collapse to one pinpoint. Lightning: a 2 frame ink silhouette. Wind: thrown 2 m along the push. Earth: drops into a crack. Light: breaks into 4 card-corner glints.
- **Sound hooks** are names only. Audio is a separate job.
- Only fire (Burn) and lightning (chain) are wired in the sim (`src/data/elements.js:4-11`). The other 6 are proven in the FX lab (step 13 of the build order) until the sim wires them.

Weapon look columns below use the tiers of 1.4. "Hollow" means the Tier 5 hollow giant of 1.4 and 2.5: stained ground, far-side rim wall, camera-side cap. "Hit" flashes follow the enemy hit flash rule in 4.2.

Pass for every element: the lab shows all 5 tiers, the hit, the status on 300 enemies, the ground mark, the death look and the signature as 10 fps strips.
Pass (height): at Tier 5 at Standard camera, each element's own pixels reach the top 10% of the screen in a still screenshot.
Pass (needs eyes): 0.5 s greyscale clips of the 8 elements are named correctly by 4 of 5 people who have played for 10 minutes.
Pass (palette): every own-effect pixel is one of the 40 ramp colours, #b26bff, or a ground tone of the current stage (dust and stained ground only), by a palette count on lab screenshots taken with bloom off. A single-element effect uses its own row only, plus dust.
Pass (contrast): each element's Tier 2 shot rim differs by 20 delta E or more from the 2 most common ground colours and the brightest emissive colour of each of the 3 stages (24 element-stage pairs), with the stage contrast edge applied where needed.
Pass (signature pacing): in a 5 min Tier 5 stress replay with flat spawn rate, each element fires its signature at most 3 times. With a scripted spawn burst of 3 times the rate, it fires within 60 ticks of the burst.

### 3.1 Fire

| | |
|---|---|
| Colours | core #fff4c8, bright #ffc24a, body #ff8a1f, shade #8a5012, ink #3a2a18. Every tone is hue 29 degrees or more. A unit test over the ramp table fails if any tone in the fire, earth or light rows has hue under 28 or over 345 |
| Tier 1 | 0.3 m ember, 2 tones, 1 speck every 40 ms |
| Tier 2 | 1 m fireball: a 20 triangle blob with the flame shader, plus 3 afterimages, each 25% smaller. The afterimages are free: the shot instance data has an attribute divisor of 4, and copy `k = gl_InstanceID & 3` draws at position minus velocity x k x 2 ticks. No history, no extra upload, 1 draw |
| Tier 3 | Tongues 2 m tall (top vertices stretched by noise), 1 halo, 1 small haze source |
| Tier 4 | Cone or dome with a rim wall of flame 3 m to 12 m tall, inside at ink-rule dither, heat haze on top (2 pixels at most) |
| Tier 5 | Hollow. Far-side rim wall 16 m to 40 m tall. The stained ground breathes at 0.5 Hz with under 8% luminance change. Inside flame under 1 m. Ember specks on the screen edge. The sky flame band is fire's own |
| Hit | Rim flash in #ffc24a. 4 ember specks rise 1 m in 300 ms. Tier 2 adds a 0.6 m pop ring. Tier 3 adds a 2 frame soot puff |
| Status: Burn (3 s, longer with burn duration bonuses) | An ember band climbs from the feet to 45% of body height and sinks as the timer runs out. The band reads the live burn timer over its starting value, not a fixed 3 s (`src/sim/combat.js:42`). The band's top edge wobbles by noise at 8 pictures a second. The band never blinks: its luminance changes under 10% between pictures. One 0.5 m flame tongue in the overlay quad |
| Ground mark: Scorch | Ragged soot blob the size of the hit. The rim glows #ffc24a and cools to soot in 2 s. Stays 12 s. Leaves as a screen-door over 3 s |
| Signature: Cinder Card | A card-shaped scorch 12 m by 17 m is stamped on the ground at the centre of the kills in 2 frames. The whole card outline then erupts as a wall of flame 40 m tall, so a burning card stands in the sky. Its face is rim only by the ink rule, and the camera-side cap applies. Over 0.8 s it burns away from the bottom up as a screen-door, leaving the frame for 6 more frames. Embers fall for 2 s. Hit-stop 80 ms |
| Sound hooks | `fire.cast`, `fire.hit`, `fire.burn_loop`, `fire.sig_cinder_card` |
| Guesses | Shade and ink tones. Wall heights. Card size. Timings. That an amber fire reads as fire without red (check by eye on Stage 1) |

### 3.2 Ice

| | |
|---|---|
| Colours | core #f0fbff, bright #cfeefc, body #8ab8e0, shade #4f7396, ink #23384d |
| Tier 1 | 0.3 m shard, 3 flat tones by facet |
| Tier 2 | 1 m spike with stepped fresnel and 1 sparkle. Snow specks fall behind it |
| Tier 3 | Cluster of 3 to 5 spikes. A 1 m wide frost trail under its path |
| Tier 4 | Spikes 2 m tall rise from the ground in a wave, 30 ms apart |
| Tier 5 | Hollow. A ring of spikes 8 m tall at the rim, and every 6th spike is a glacier tooth 24 m to 40 m tall, rim only above 8 m. The ground is one frost sheet. The inside has only sparkles (1 per 4 square metres a second, 2 frames each). Frost creeps in at the screen edge |
| Hit | Rim flash in #cfeefc. 5 shards fly 0.8 m. A six-point flare 0.5 m wide for 2 frames |
| Status: Chill (2 s, 30% slow) | Frost climbs from the feet to 50% of height. The walk bob halves |
| Status: frozen (Whiteout, 1 s) | The whole body takes the ice ramp with a 3 step fresnel rim. Vertices push out 0.06 m and snap to a 0.12 m grid, so the body reads as a block. Bob is 0. Pale crack lines for 2 frames at 0.85 s, then 6 shards |
| Ground mark: Frost sheet | Pale patch with a crystal edge, stays 10 s. On Stage 2 (already blue) it uses the core tone |
| Signature: Glass Garden | The enemies killed in the trigger window stay as ice statues for 300 ms (view-only ghosts, up to 48, one shared low mesh, 1 draw). If slow motion is allowed in this run (OWNER DECISION 3), time runs at 0.3x for 0.4 s. Then they shatter in a ring that moves out at 30 m/s. The frost on the screen edge cracks and falls away |
| Sound hooks | `ice.cast`, `ice.hit`, `ice.freeze`, `ice.shatter`, `ice.sig_glass_garden` |
| Guesses | Shade and ink tones. Grid snap size. Tooth heights. That "frozen" reads inside 1 s (the rule gives only 1 s) |

### 3.3 Lightning

| | |
|---|---|
| Colours | core #f4f9ff, bright #bfdcff, body #7fb8ff, shade #3a4ad0 (indigo), ink #141a40 |
| Tier 1 | 0.25 m spark with 2 one-segment arcs |
| Tier 2 | Ribbon bolt 0.08 m wide from monster to target |
| Tier 3 | 0.2 m wide with 2 forks and an ink edge. A 4 m ground light disc for 2 frames. On any chain of 6 jumps, all link arcs hold for 12 ticks, coloured from core to body along the chain order, so the whole horde lights up in sequence. This is lightning's first screen-scale beat |
| Tier 4 | 0.6 m trunk with 6 forks. Each chain jump is drawn 30 ms after the one before, so the eye follows the chain (view only. Damage timing is unchanged). A killed enemy's ghost corpse stays until its arc lands, at most 180 ms |
| Tier 5 | Sky strike. A 1.5 m trunk from 60 m up, forks to as many as 12 enemies, 1 gated screen flash. Plus a standing cage of 8 thin bolts 40 m tall on the far rim, 0.2 m wide, re-shaped at 20 Hz (0 Hz with Reduce flashing) |
| Bolt safety | Bolts 0.2 m wide or less re-shape at 20 Hz. Bolts wider than 0.2 m keep one shape for their whole life and live at most 150 ms. Sideways jag = min(length x 0.16, 1.2 m). At most 2 bolts wider than 0.2 m may start with a core and glow mask in any rolling 1.0 s, and each counts as a flash in the gate (4.2). Extra wide bolts in that window draw in the body tone with ink edge and no core. Link arcs are re-drawn at most 3 times a second |
| Hit | Rim flash, core tone then body tone over 2 frames. One 3 segment zigzag spark, 0.5 m, 1 frame. 3 specks at 8 m/s that live 120 ms |
| Status: Arc | Each chained enemy gets a crawling blue-white outline for 300 ms. Up to 24 link arcs between chained pairs stay alive for 300 ms. No whole-body blinking |
| Ground mark: Fulgurite | Dark star mark with 8 branches. Glows blue-white for 0.5 s. Stays 8 s |
| Signature: Sky Seal | 6 bolts draw the ring and the 4 cards of the seal disc (3.0) in the sky in 200 ms. One trunk comes down through it. An impact frame (4.2). A 10 m star mark stays on the ground. Hit-stop 100 ms |
| Sound hooks | `lightning.cast`, `lightning.hit`, `lightning.chain` (pitch up per jump), `lightning.sig_sky_seal` |
| Guesses | Shade and ink tones. Bolt widths. The 30 ms chain stagger. The wide-bolt limits |
| Sim note | The chain effect record must carry the source point. Today it sends only the target (`src/sim/combat.js:62`) |

### 3.4 Poison (toxic)

| | |
|---|---|
| Colours | core #e8ff9a, bright #8fd14f, body #4f8a2a, shade #2a5a3a, ink #18161c. Ground fills and stains use shade or bright, never body (2.5) |
| Tier 1 | 0.3 m glob that wobbles at 4 Hz and drips 1 speck every 80 ms |
| Tier 2 | 1 m glob with a drip line |
| Tier 3 | Gas puff: round blobs from the flame shader with the poison row, 8 pictures a second, rising 0.5 m/s |
| Tier 4 | Cloud bank 2 m tall, inside dithered. Pools join on the ground |
| Tier 5 | Hollow. A rolling gas rim 4 m tall, plus 5 bubble stacks: chains of round rim-only bubbles 3 m to 6 m wide rising to 30 m at 6 m/s and popping at the top. One lake on the ground with 1 bubble per 3 square metres a second. Inside gas under 1 m. A green bubbling edge on the screen |
| Hit | Rim flash in #8fd14f. 5 specks that arc under 14 m/s2 gravity. A ragged 0.5 m splat |
| Status: Venom (5 s) | 3 green bands slide down the body from the head. One bubble pops in the overlay quad every 0.6 s. The lower body darkens |
| Ground mark: Acid pool | Bright tone with a 1 texel ink rim. 2 bubbles. Shrinks from 100% to 60% radius over 8 s |
| Signature: The Great Bubble | Every pool within 20 m runs together into one lake in 0.3 s. The lake swells into a single bubble dome 20 m wide and 14 m tall, rim only, with a lime highlight arc and 2 slow wobbles. At 0.8 s it pops: the rim breaks into 12 globs that arc out under 14 m/s2 and land as new pools on a 20 m ring. The screen edge pulses once, through the flash gate |
| Sound hooks | `poison.cast`, `poison.hit`, `poison.bubble_loop`, `poison.sig_great_bubble` |
| Guesses | Shade tone. Bubble and dome sizes. That the ink edge is enough against Stage 1 meadow. Check by eye |

### 3.5 Wind

| | |
|---|---|
| Colours | core #f4fff9, bright #d9fff0, body #9ad8c0, shade #6e8aa0, no ink |
| Tier 1 | 3 curling streak ribbons 0.6 m long |
| Tier 2 | 1.5 m crescent of ribbons with dust specks in the ground colour |
| Tier 3 | Twister 3 m tall, 6 ribbons spiralling round a column |
| Tier 4 | A 10 m wall of streaks. If the engine plan has a wind uniform, pulse it at the hit point so grass bends |
| Tier 5 | No inside at all. Wind is shown by what it carries: dust sweeps on the ground, a far-side twister rim 30 m tall, speed lines at the screen edge |
| Hit | The enemy leans back along the push for 150 ms (a vertex shear). 4 streak specks. A ragged dust ring |
| Status: Gust (1.5 m push) | The lean plus 2 streaks behind the enemy. Nothing lasting. No lean on specials: Gust does nothing to them |
| Ground mark: Swept ground | Pale streak arcs that show the direction. Stays 3 s, the shortest of all |
| Signature: The Great Shuffle | A column of ribbons and 120 spinning card quads lifts the ghost corpses in a spiral for 0.9 s, then throws them outward. FOV widens 4 degrees and returns over 0.5 s |
| Sound hooks | `wind.cast`, `wind.hit`, `wind.gust`, `wind.sig_great_shuffle` |
| Guesses | Shade tone. That wind reads with no ink on bright sand. If it fails, give it the #6e8aa0 shade as a 1 texel edge |

### 3.6 Earth

| | |
|---|---|
| Colours | core #e8c890, bright #c08a3e, body #7a5428, shade #4a3a24, ink #1e1e2a |
| Tier 1 | 0.3 m pebble cube that tumbles in 90 degree steps |
| Tier 2 | 1 m boulder, 3 flat tones, dust trail |
| Tier 3 | A row of 5 stone slabs rising 40 ms apart |
| Tier 4 | A 10 m fissure: crack marks and tilted slabs |
| Tier 5 | The ground is the weapon. A crack network across the screen, a rim of rising slabs 6 m tall, plus 12 card-shaped monoliths 30 m tall (1 per 30 degrees of rim) that rise in 0.4 s and sink in 2.0 s, rim only above 6 m. A dust wall at the rim |
| Hit | The enemy squashes 15% for 2 frames. 4 cube chunks. A dust puff |
| Status: Stagger (0.2 s) | The enemy drops 0.1 m and tilts 10 degrees for 12 ticks, with a dust ring at the feet. No drop on specials: Stagger does not affect them |
| Ground mark: Cracked earth | Dark crack lines and 2 lifted pale flakes. Stays 20 s, the longest of all |
| Signature: The Table Flips | 24 card-shaped slabs along a 30 m line tilt up 20 degrees and slam down. Dust wall. Shake at 0.7 trauma, scaled by the Shake setting and held by the shake budget in 4.2 |
| Sound hooks | `earth.cast`, `earth.hit`, `earth.slab`, `earth.sig_table_flips` |
| Guesses | Shade tone. Monolith count and height. Earth #c08a3e is close to Stage 1 sandstone, so the ink lines carry it. Check by eye |

### 3.7 Light

| | |
|---|---|
| Colours | core #fffbe8, bright #fff2c4, body #ffe9a8, shade #d8c48a, no ink. The body is close to the reserved gold light (#fff0b8), so the "nothing that looks like loot" rule in 3.0 matters most here |
| Tier 1 | 0.3 m glowing card-shaped mote |
| Tier 2 | Ray lance: a thin beam 0.1 m by 6 m with stepped falloff |
| Tier 3 | 0.5 m beam with a halo and 3 card-corner glints |
| Tier 4 | A pillar from the sky 2 m wide. While any light source of Tier 4 is alive the world is held 15% dimmer |
| Tier 5 | Hollow. A far-side curtain of rays 40 m tall at the rim. World dim is a held state while a light source is alive: it ramps in over 0.5 s and out over 0.5 s, at most 20%, inside the per-stage dim caps of 4.2, never per attack. No flash |
| Hit | Rim flash in #fff2c4. One L-shaped card-corner glint for 2 frames. 4 specks drifting up |
| Status: Reveal (3 s) | A 1 pixel pale outline and 4 card-corner brackets round the enemy in the overlay quad. It differs from the violet mark crystal (`src/view/actors.js:110, 365`) |
| Ground mark: Seal print | A pale card-shaped rectangle of light with the seal disc (3.0). It brightens the ground. Fades in 4 s |
| Signature: Daybreak Hand | 5 pillars of light land in a fan like a dealt hand, 60 ms apart. The world dims by the stage's dim cap for 1.0 s, so the light looks blinding with no flash. 12 dithered ray wedges fan out on screen from the middle pillar |
| Sound hooks | `light.cast`, `light.hit`, `light.reveal`, `light.sig_daybreak_hand` |
| Guesses | Bright and shade tones. Dim amounts. That light reads on Stage 1 by world dim and dusk halo alone |

### 3.8 Dark

Dark is the only element that darkens. It draws opaque black with a moon-white rim, as the art book says. Never additive. Never violet.

| | |
|---|---|
| Colours | core #0d0b12 (the core is the black one), rim #d8e4f4 (moon-white, the bright column), body #2a2632, shade #46445a, pinpoint #f4f8ff (the ink column) |
| Tier 1 | 0.3 m black orb, 1 pixel moon-white rim, 1 pinpoint |
| Tier 2 | 1 m orb with wisps flowing into it |
| Tier 3 | 2.5 m void. Its inside shows fixed pinpoints in screen space, so it reads as a hole. Slight inward distortion |
| Tier 4 | An 8 m card-shaped tear |
| Tier 5 | Hollow. A far-side rim curtain 40 m tall made of wisps that fall upward, and the sky inside the ring (a cone above the rim) shows the fixed pinpoint field, so the hole is in the sky too. The ground inside turns to ink with pinpoints. Colour drains 20% from the world (never from protected pixels, 6.8). Pinpoints stream inward at the screen edge. No dark vignette: the dark edge belongs to low LP (`reference-run-1123.md:307`) |
| Hit | The enemy becomes a black shape with a moon-white rim for 2 frames. Flash-safe, because nothing gets brighter. 4 wisps are pulled toward the duelist |
| Status: Drain (heal 1% of the hit) | One moon-white wisp flies from the enemy to the duelist in 350 ms. At most 6 wisps live. When the heal cap is reached (`SPEC.md:263`) wisps turn grey and fall short, which shows the cap |
| Ground mark: Ink puddle | Black with a moon-white rim and 3 pinpoints. Drains to its centre over 6 s |
| Signature: Null Card | A black card 8 m by 11 m falls face-down on the horde. The kills vanish under it. It flips, shows pinpoints for 200 ms, and breaks into shards |
| Sound hooks | `dark.cast`, `dark.hit`, `dark.drain`, `dark.sig_null_card` |
| Guesses | Shade tone. The 20% colour drain. That black with a moon-white rim reads on Stage 3, whose scenery is basalt and moon-white crystal. Dark moves and crystals do not, and the 2 art pixel stage contrast edge applies. Check by eye |

### 3.9 Reaction looks

Rules and numbers are from `SPEC.md:383-411` and `src/data/tuning.js:86-91`. Nothing here changes them. Every ring is drawn at the true rule radius. Every lasting mark lasts exactly as long as the rule's effect. The look teaches the rule.

Reaction numbers: the top half of each digit takes element A's body colour and the bottom half takes element B's (`SPEC.md:413` asks for "their own colour and font").

| # | Reaction | Rule | Look |
|---|---|---|---|
| 1 | Thermal Shock (fire + ice) | x1.8 | The frost shell pops off as 6 shards. A pale dithered steam ring rises 1.5 m in 300 ms. Frost on the ground under the enemy turns to a dark wet patch |
| 2 | Toxic Flare (fire + poison) | x1.2, 40% splash to 2 targets in 2.5 m | A green fireball: the flame shader with the poison row, lime core, ink edge. The ring is exactly 2.5 m. 2 splash ribbons run to the 2 enemies hit, inside the ring. An acid pool in range flashes once and burns off in 1 s |
| 3 | Wildfire (fire + wind) | x1.3, Burn spreads to 3 | 3 flame ribbons leap from the target to the 3 enemies in 150 ms (the bolt strip with jag 0 and the fire row) |
| 4 | Shatterbolt (lightning + ice) | x1.5, 0.4 s stun | Pale crack lines cover the frosted body and stay for the 0.4 s. Shards fly along the bolt's direction |
| 5 | Tempest (lightning + wind) | x1.2, +2 jumps | The chain ribbons bow like blown rope. The 2 bonus jumps are drawn in the wind row, so the player can count them |
| 6 | Sandblast (earth + wind) | x1.1, +20% shred for 3 s | A cone of sand grains. The enemy's body carries a sand-tone speckle for the 3 s. No dither holes: dither already means "see-through for the camera" |
| 7 | Mire (poison + earth) | x1.2, 40% slow for 3 s | A mud pool under the enemy. It sinks 0.2 m and its lower third takes the mud tone for 3 s |
| 8 | Whiteout (ice + wind) | x1.3, 1 s freeze, 6 s lockout | A pale streak burst wraps the enemy and it becomes the ice block for exactly 1 s. Then a pale ring at its feet drains clockwise over the 6 s |
| 9 | Eclipse (light + dark) | x2.5, 4 s lockout | A black disc with a pale corona in the light core tone snaps from 0.8 m to 2.5 m in 80 ms. 8 pale rays. A crescent ring drains over the 4 s. On an elite or boss: 50 ms hit-stop. No screen flash |

On specials (elites and bosses), the looks follow the rule's own exceptions: Shatterbolt cracks last 0.1 s. No Gust lean. No Stagger drop.

Modifiers:
- **Resonance** (up to +150%, `SPEC.md:140`): at +50%, +100% and +150% the reaction ring's look grows to x1.25, x1.5 and x2.0 in height and a second ring follows 80 ms later. The footprint stays at the rule radius (L1).
- **Double reaction** (Secret Fusion trait, `SPEC.md:271-274`): both looks play, the second 60 ms later, and the two rings link as a figure of 8 with a pale rim.
- **Primed**: a waiting aura (2.5 s) is a 1 pixel rim on the enemy in the aura's element colour.
- **Refused** (0.5 s cooldown or lockout): 3 grey specks and no ring. Needs a new sim event. Optional.

Every mark with a rule time (reaction marks, pools, lockout rings) lives in the 96 quad mark pool on every Detail level, never in the stain map, so its end is exact (6.7).

Pass (needs eyes): each reaction is named correctly by a tester from a 10 fps strip.
Pass: measured ring radius is within 5% of the rule radius. Measured mark time is within 2 frames of the rule time.

---

## 4. BIG MOMENTS

Routine hits never shake or freeze the screen. That rule (`design/feedback-feel.md:17`) stands. Big moments are few, earned and metered.

**The fairness rule.** Hit-stop and slow motion are waits in the view. They change no tick and no replay hash (`src/main.js:397-399`). But they do give the player more real time per tick. So the choice to stop is made from the tick event stream only. It never depends on frame time, settings or the drop ladder. Every player and every replay of one tape gets the same stops at the same ticks. Settings change what the screen shows during a stop, not whether it happens.

### 4.1 The full-screen events (our own designs)

| Event | Trigger | Class | What the screen does |
|---|---|---|---|
| Fusion Landing | A Fusion or God Fusion arrives | A | Two glowing floor cards (3 m by 4.2 m, ground marks in the two parent elements) slide together over 6 frames and overlap into one floor card 8 m by 11.2 m (11 m by 15.4 m for a God Fusion) in the Fusion's element with a #b26bff rim. The Fusion rises through it in 12 frames. Hit-stop 100 ms. An impact frame in the Fusion's element. A card-shaped shockwave (ratio 5:7) to 9 m (12 m for a God Fusion) through the distortion pass. A column 40 m tall. FOV kick 5% for 0.5 s. Shake 0.7. Slow motion 0.3x for 0.4 s where allowed (decision 3). The duelist holds a cast pose and the Fusion holds its hold pose for 12 frames, with the white outline at 2 art pixels. The floor card stays as a mark for 30 s |
| Tablebreak | The screen tier first reaches 5 in a run | A | **The picture itself breaks.** Hit-stop 120 ms. 3 straight fault lines run from the duelist to the screen edges at seeded angles at least 70 degrees apart. The 3 pieces of the picture shift 4, 6 and 8 art pixels along their faults, hold for 100 ms with a 1 art pixel gap in the lead element's core tone, then ease back over 67 ms. One shift, no strobe. Then every live rim wall and sky column shoots to full height inside 12 ticks, in order of distance from the duelist, so a wave of pillars runs out to the horizon. The world dims 20% over 0.6 s with slow ramps. The sky tint and flame band roll in over 2.0 s. The faults stay for the rest of the run as 1 art pixel hairlines from the screen edge to the border of the centre 60% by 60% box. The HUD timer plate pulses once. The duelist (keyhole) and all priority pixels never shift. No flash. This is the frame a player screenshots |
| Boss phase, boss kill, gate kill | existing sim events | A | As today (`src/main.js:278` and the lines round it), but through the flash gate and the budgets below. Gate kills use the card-shaped shockwave |
| Signature moment | 3.0 trigger, one per element | B | As the element tables say. The source summon holds its hold pose for 12 frames |
| Cap Burst | The first tick one of the five stat ceilings of 1.4 is reached. Once per ceiling per run | B | A ring of 12 card quads bursts from the duelist to 6 m and the matching HUD stat pulses. 40 ms hit-stop. No flash |
| Clean Sweep | 100 kills or more inside 120 ticks (guess). At most once per 1,800 ticks | B | A single stepped shockwave from the duelist to the screen edge, in the lead element. The kill counter punches to 150% size for 200 ms. No hit-stop |
| Ascension | The screen tier first reaches 3 in a stage | C | A column 12 m tall in the monster's element at the monster that reached form 3. A 6 m ground light disc for 6 frames. Hit-stop 40 ms. The camera pull-back begins on this beat |
| Field Set | The screen tier first reaches 2 in a stage | C | Every own monster's floor card flashes once in its element (a ground mark, not a screen flash) and a 3 m ring leaves each. No hit-stop |
| Summon Call | Every summon | C | The floor card slams down with a 6 m column in its element for 0.3 s and a dusk halo. No hit-stop, no screen effect |
| Elite kill, reaction on an elite or boss | sim events | C | Hit-stop 40 ms or 50 ms. Local ring. No screen effect |
| Ground Record (optional) | Stage end, on the results beat | C | The camera lifts straight up to 40 m over 1.0 s and shows the stain map of the last 64 m: what the build burned, froze and poisoned. View only. Skipped under Reduce motion |

Shockwave shapes: card-shaped rings are for class A moments. Round rings are for everything that marks a rule radius. One glance at a clip then says which game it is.

Poses use existing rig clips until the owner makes hold poses (section 9).

### 4.2 Budgets

| Budget | Limit |
|---|---|
| Hit-stop per event | routine hit 0 ms. Elite kill and Ascension 40 ms. Reaction on elite or boss 50 ms. Boss phase 60 ms (today's value, `main.js:278`). Signature 80 ms to 100 ms. Fusion Landing 100 ms. Tablebreak 120 ms |
| Hit-stop total | at most 250 ms in any 300 ticks. At least 24 ticks between two |
| Slow motion (decision 3) | 0.3x for at most 0.4 s, back to 1.0 over 0.2 s. Class A events and the ice signature only. At most 1 per 1,200 ticks. At most 1.0 s of slowed real time a minute. Never in a run that can post to a verified board |
| Screen flashes | at most 2 in any rolling 1.0 s. At least 350 ms apart. At most 6 in any rolling 10 s and 20 in any rolling 60 s (guess). Flash colour is the element's bright tone, never white. Strength = min(0.35, 0.20 / (1.0 - stage luminance)), so the full-screen luminance rise is never over 0.20 of full white. Stage luminance is a constant per stage: 0.55, 0.10, 0.12 (guess). No flash at screen tier 1 to 3 from own attacks: they light a ground disc |
| What counts as a flash | Screen flashes, impact frames, wide bolts with a core (3.3), screen edge pulses, and any world dim that ramps faster than 0.5 s each way. All of them draw on the same gate |
| When the gate says no | The flash is dropped, not queued. In its place the element's hit sound plays one step louder with a 30 ms rumble. Heavy builds feel heavier without more light |
| Impact frame | 33 ms. Strength at most 0.35: the world is mixed 35% toward a 2 tone picture in the element's bright tone and ink tone. Never the core tone, never full strength. It never touches protected pixels (6.2). The duelist stays in true colour inside it, through the keyhole |
| Enemy hit flash | One enemy flashes at most once per 350 ms. Peak mix 0.6, never pure white. At most 24 enemies take a full-body flash in any 100 ms. The rest take a rim-only flash. With Reduce flashing on, every hit flash is rim-only and held 120 ms |
| Shake | Travel = min(0.25 m, 2% of the current camera distance), so it is always inside the 0.3 m collision probe (today 0.4 m at `src/view/fx.js:189`). Roll at most 0.6 degrees. Frequency at most 12 Hz. Routine own attacks add 0 trauma. Own events add at most 0.3 in any 1.0 s. Trauma may be over 0.3 for at most 0.6 s in any 3.0 s. After that it is clamped to 0.3. Hurt shake at most once per 350 ms |
| World dim | Ramps in over at least 150 ms and out over at least 300 ms. At most 1.0 s unless it is a held light state (3.7). At least 2.0 s between two. Cap 30% on Stage 1, 15% on Stage 2, 10% on Stage 3. Never applied to protected pixels |
| Full-screen distortion | At most once per 600 ticks. Ring life at most 0.5 s. Other shockwaves are ring meshes. Heat haze shift at most 2 pixels |

### 4.3 The director: how moments stack without turning to mush

One small view-side queue, `MomentDirector`. It reads sim events and counts in sim ticks.

1. One big moment owns the screen at a time.
2. Priority: class A, then B, then C. A higher class interrupts a lower one. The lower one finishes its world-space parts (column, ring, marks) but loses its screen parts (flash, dim, edge, distortion).
3. Same class: the first one wins. A second one within 90 ticks is downgraded one class. A class C that is downgraded keeps only its local ring.
4. Cooldowns: class A at least 180 ticks apart. Class B at least 90 ticks apart, and each signature at most once per 1,200 ticks. Tablebreak once per run. Cap Burst once per ceiling per run. Ascension and Field Set once per stage.
5. **Waits are decided from ticks only.** Whether a hit-stop or slow motion plays depends on the tick event stream and the tick budgets in 4.2. Nothing else.
6. **Screen parts ask their budget.** Each flash, dim, impact frame and distortion asks its real-time budget in 4.2. If the budget says no, that part is dropped, not queued. Nothing ever plays late.
7. During an offer, a reveal or a pause, no moment starts. Class A events that fire then are held for at most 30 ticks after the panel closes, then dropped.
8. A moment's first frame is within 2 frames of its trigger.

Pass: a 60 s Tier 5 log shows no hit-stop on a routine hit, at most 250 ms of hit-stop in any 300 ticks, at most 2 flashes in any 1.0 s and 6 in any 10 s, and at most 1.0 s slowed a minute.
Pass: a script that fires 20 signature triggers in 1 s logs 1 signature with screen parts, and 19 with world parts only or none.
Pass (fairness): one tape played at 60 fps and at 120 fps, with Big moments Full and Off, with Reduce motion on and off, logs the same list of (tick, stop length).
Pass: the replay hash is the same with the director on and off.
Pass (Tablebreak): a frame capture at trigger + 50 ms shows 3 regions shifted by 4, 6 and 8 art pixels, and the duelist and every red tell unshifted.

---

## 5. COMFORT AND SETTINGS

`menus-spec.md:977` says there is no separate effects tab. So these rows go into the existing pages. `menus-spec.md:856` says the sim never reads view settings. That holds for all of them.

### 5.1 Rows

| Page | Row | Control | Choices | Default (all devices) | What it does |
|---|---|---|---|---|---|
| Access | Spell effects (changed, `menus-spec.md:952`) | segmented | Auto / Full / Soft | Auto | Your own effects only. Sets `uInk`, the governor limits and own particles as in 2.5. Enemy effects are never touched |
| Access | Reduce flashing (in the menus spec at `:951`, not built) | switch | On / Off | Off | On: no screen flash, no impact frame, no bolt re-shaping, no glow mask bloom, every hit flash rim-only. A 120 ms tint of a frame 5% wide at the screen edge takes the place of a flash, with under 10% luminance change |
| Access | Big moments (new) | segmented | Full / Short / Off | Full | Short: flash, dim and impact frame at half strength, no FOV kick. Off: no flash, no dim, no impact frame, no FOV kick, no shake from moments, no picture shift (Tablebreak leaves hairlines only). The waits themselves stay at every choice, with the picture simply held (fairness rule, section 4). World-space parts still play |
| Access | Duelist marker (new) | segmented | Auto / Always | Auto | Always shows the white chevron over the duelist on every frame (2.8) |
| Access | Reduce motion (exists) | switch | On / Off | system | As today, plus: Big moments acts as Off. The offset pass is off, shockwaves are ring meshes, no heat haze, no screen-edge scroll. Camera pull-back stays on at 0.5 per second (decision 4). The low-LP border stops pulsing, as today (`index.html:111-113, 129`). Note: today Reduce motion removes hit-stop (`src/view/fx.js:62`). Under the fairness rule the wait stays and only its screen parts go |
| Game | Screen shake (exists) | slider | 0 to 100, step 10 | 100 today (`src/core/save.js:7`) | Scales all trauma. 0 means 0 m |
| Game | Camera distance (in the menus spec) | segmented | Near / Standard / Far | Standard | Arm x0.85, x1.0, x1.15 before pull-back |
| Display | Detail (in the menus spec, `:883`) | segmented | Low / Medium / High | Medium on phone, High elsewhere | Sets the effect quality tier in 6.10 |

Spell effects default changes from Full to Auto. Reason: check 2 must pass at the default setting, so a broken build stays playable without the player opening Settings. That another game does the same is the owner's report, not verified here. This is part of OWNER DECISION 4.

### 5.2 Hard limits that hold at every setting, including maximum

1. **Flashes.** A flash is one pair of opposing relative-luminance changes of 10% or more. A large flash is one seen in more than 16 cells inside any 11 x 6 cell window of a 32 x 18 grid over the screen (25% of a 10 degree field on a PC monitor). At most 2 large flashes in any rolling 1.0 s. (General guidance, W3C WCAG 2.3.1, allows at most 3. We stay under it.)
2. Full-screen overlay strength never above 0.35, and never a luminance rise over 0.20 of full white.
3. No saturated red full-screen flash, ever. The hurt cue stays a vignette.
4. Glow is clamped in the composite: glow adds at most 0.35 per channel (6.8). A halo is at most 0.3 strong, and a new halo within 3 m of a live one refreshes that one instead of stacking.
5. The screen edge effect is at most 6% of H deep from every side at any aspect, at most 18% of the screen at 16:9, and never over protected pixels. The Tablebreak hairlines are the one exception: 3 lines, 1 art pixel wide, outside the centre 60% by 60%.
6. Shake travel at most min(0.25 m, 2% of camera distance). 0 m with the slider at 0.
7. Own effects never exceed the governor limits of the chosen Spell effects mode (2.5): rasterised sum 5.0 screens, painted share 55%, 65% or 35%, and 35% of the centre box.
8. The duelist rule (2.8), the warning rule (2.12) and the pickup rule hold at Full exactly as at Soft.
9. No setting and no effect can dim, thin, shift, recolour or hide an enemy warning.
10. No own effect blinks a large area on a clock. Every periodic brightness change over more than 5% of the screen is under 10% luminance per step or slower than 1 Hz.

Pass (flashes): run the grid test on Stage 1, Stage 2 and Stage 3, each with a chain-lightning build with Volley 6, a fire build and a light build, at Spell effects Full, Detail High, Big moments Full, Shake 100, captured at 60 Hz and at 120 Hz, 10 min of Overtime each. 0 windows over limit 1. With Reduce flashing on: 0 large flashes in the whole replay.
Pass: with Spell effects at Soft, a pixel sampled inside each enemy warning matches the Full setting within 2%.
Pass: for one own effect covering 20% of the screen in the lab, fill pixels at Soft are 45% to 55% of Auto. Rim pixels are equal.
Pass (shake): a 10 min Overtime log at Shake 100 holds the shake row of 4.2, and check 4 passes with shake on at the 2.2 m pull-in.

---

## 6. TECH PLAN

Everything is plain GLSL ES 3.00: `texelFetch`, bit operations, flat varyings, instancing, RGBA8 targets only. No float targets, no depth reads, no geometry or compute stages. In the browser (three.js r128) the same maths goes in through `onBeforeCompile` patches, as the two existing dithers do, or through `RawShaderMaterial` with `glslVersion: THREE.GLSL3`. That r128 takes the ES 3.00 text unchanged is not verified. Check it in build step 5 before relying on it.

Precision rules, because on phone GPUs `mediump` can be a 16 bit float and a 16 bit int:
- **Time.** Every time uniform is declared `highp` in both shader stages (`highp float` is required in ES 3.00 fragment shaders). `uTime` and `uReal` are seconds since the stage began and are never wrapped inside a stage. A stage is under 30 minutes, so float steps there are under 0.001 s. Age is computed in the vertex shader and passed to the fragment shader as a 0..1 value.
- **Position.** World position varyings, UVs, the disc radius varying and `gl_FragCoord` maths are `highp`. At `mediump` a world position hundreds of metres out steps by 0.125 m or more.
- **Hashes.** Shaders that hash declare `precision highp int`. Use integer hashes or the noise texture. Never `fract(sin(x))`.
- `fwidth` is taken in the first line of `main()`, before any branch or discard.

Pass: a 5 minute lab run shows no frame where live particle count or mark count drops by more than the spawn cap, and no jump in any scrolling noise.

### 6.1 Shared pieces, built once

| # | Piece | New or extend | Where |
|---|---|---|---|
| 1 | `dsDither` (Bayer, 2.1) | replaces noise | `src/view/scenery.js:78`, `src/view/mapMesh.js:30` |
| 2 | Porthole (2.2) | replaces capsule | `src/view/mapMesh.js:27-31`, uniforms at `src/main.js:426` |
| 3 | `dsCorridor` plus `nearKeep` (2.3, 2.4) | new chunk, patched into each material | `scenery.js:76-93` (delete the loop at `:95-107` and its call at `main.js:427`), `src/view/props.js:6-7`, `src/view/actors.js:12-13, 98-105` |
| 4 | Stencil silhouette and 2 tone outline (2.8) | new | duelist material in `src/view/rig.js:82`, meshes at `rig.js:95`, draw in `actors.js` (duelist block from `:249`) |
| 5 | Ramp texture 8 x 8 and noise texture 64 x 64 R8, tileable, made at boot | new | `src/view/fxkit.js` (new file) |
| 6 | Effect material family (6.3) | new | `src/view/fxkit.js` |
| 7 | GPU particles (6.4) | replaces the CPU loop | `src/view/fx.js:17-23, 129-137` |
| 8 | Lightning ribbon (6.5) | replaces 3-box bolts | `src/view/actors.js:136, 473-477` |
| 9 | Status in the body shader plus overlay draw (6.6) | extends the swarm material | `src/view/actors.js:98-105, 343-365` |
| 10 | Ground mark pool, then stain map (6.7) | new | `src/view/fxkit.js` |
| 11 | Glow: dusk halos, then mask bloom (6.8) | new | `src/view/fxkit.js`, `src/view/post.js` (new file) |
| 12 | Offset (distortion) pass and composite (6.8) | new | `src/view/post.js`, render at `src/main.js:443` |
| 13 | Flash gate, shake budget, moment director (4) | extends | `src/view/fx.js:61-63, 187-195` |
| 14 | Camera changes (2.9, 2.10) | extends | `src/view/camera.js:12-18, 26-29, 38-49`, `src/main.js:57, 420-423`, `src/data/config.js:15-19` (cam block only) |
| 15 | FX lab page `?fxlab` and budget script | new | `src/view/fxlab.js`, `test/browser-budget.mjs` (new files) |

Fixed pools, allocated once: particles 4,096 on PC and 1,200 on phone and handheld. Bolts 64. Volumes 32. Ground marks 96. Halos 24 on High, 12 on Medium, 6 on Low. Distortion sources 8. Ghost corpses 48. Link arcs 24. Shards 96 (in force, `feedback-feel.md:160`).

Pass: `test/browser-alloc.mjs` shows 0 bytes allocated per frame in a 60 s Tier 5 lab run.
Pass: the build adds 0 image files for effects.

### 6.2 Render path

Today: one render straight to a half-size canvas (`src/main.js:68-70, 443`). New, on Detail Medium and High:

1. **Scene pass** at internal size. Targets: scene colour RGBA8 plus DEPTH24_STENCIL8. The alpha channel is a free mask with three levels:
   - **1.0 = world.** The target is cleared to alpha 1. three.js opaque materials already write alpha 1, so zero world materials change. Dithered fills and ground marks also write 1.0.
   - **0.5 = protected actor**: the duelist, enemies and bosses. Their materials are patched anyway for status and fades, and write 0.5.
   - **0.0 = glow**: rims, bolt cores, bright flame tones and particles flagged glow.
   - Halos use `glBlendFuncSeparate(GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_ZERO, GL_ONE)`. Every other blended draw that survives (contact shadows at `src/view/actors.js:133-135`, the sand ring at `actors.js:499`, the gate seal, sprites) uses a blend with alpha source ZERO and alpha destination ONE. So no blended draw disturbs the mask.
2. **Offset pass** at 1/4 internal size, RGBA8. Shockwave, fault and haze quads write screen offsets. Runs only when a source is alive. Off under Reduce motion.
3. **Glow passes** at 1/4 and 1/8 internal size. Bright pass = colour of glow pixels only. So bright sand never blooms. Detail High, screen tier 3 and up only.
4. **Composite** at internal size into its own RGBA8 colour target, which shares the scene's depth-stencil attachment. One shader does distortion, stepped glow, world dim, colour drain, screen edge, impact frame and the gated flash. The three HTML overlays (`#flash`, `#fxflash`, `#lowhp`, `index.html:110-113, 171-173`) become terms in it for the native port.
5. **Priority pass** into the composite target (2.12).
6. **Blit** to the screen with `glBlitFramebuffer` and GL_NEAREST, not a shader quad. The HUD is drawn after it, so the HUD is never distorted.

Tile-based GPU care: every target is cleared at the start of its pass. `glInvalidateFramebuffer` is called on depth-stencil after the priority pass and on each small target after its last read.

No copy of the screen is ever made. The scene texture is the copy. Phone internal height is at most 540 pixels at every Render scale.

On Detail Low there is no composite and the scene draws to the window. The EGL config asks for 24 bit depth and 8 bit stencil. See 6.10.

Pass: with all screen effects on, a frame capture shows scene and composite at internal size, at most 3 passes at 1/4 size or smaller, and 1 blit.
Pass: a scene with no effects has 0 pixels with alpha under 0.25.
Pass (protected pixels): a pixel inside an enemy and a pixel inside the duelist are unchanged (within 2%) with world dim at its cap, Dark Tier 5 drain, screen edge at 1.0, an impact frame and bloom all on.

### 6.3 Effect material family

One vertex layout and four fragment variants. All take a ramp row, a seed, a birth time, and the ink and keyhole values of 2.5.

```glsl
vec3 ramp(int row, int tone) { return texelFetch(uRamp, ivec2(tone, row), 0).rgb; }
```

**Flame, gas, steam, dust** (one shader. Only the row, speed and picture rate change. The sky flame band of 1.4 runs the same maths inside the sky shader):

```glsl
#version 300 es
precision mediump float;
in highp vec2 vUV; in float vHeat; flat in int vRow; flat in vec3 vK;   // vK: x pictures a second, y rise speed, z cut
uniform sampler2D uNoise, uRamp; uniform highp float uTime; out vec4 o;
void main() {
  highp float ts = floor(uTime * vK.x) / vK.x;              // stepped: 12 a second for fire, 8 for gas
  highp vec2 uv = floor(vUV * 32.0) / 32.0;                 // hard texels
  float n = texture(uNoise, uv * vec2(1.0, 0.5) + vec2(0.0, -ts * vK.y)).r * 0.6
          + texture(uNoise, uv * 2.0 + vec2(ts * 0.3, -ts * vK.y * 1.9)).r * 0.4;
  float f = n + vHeat - vUV.y * 1.2;                        // hot at the base, thin at the top
  f += (bayer4(gl_FragCoord.xy, ivec2(1)) - 0.5) * 0.12;    // ordered dither between tones
  if (f < vK.z) discard;
  int tone = 3 - int(clamp((f - vK.z) / (1.0 - vK.z), 0.0, 0.999) * 4.0);
  o = vec4(ramp(vRow, tone), tone < 2 ? 0.0 : 1.0);         // core and bright tones glow (alpha 0)
}
```

**Volume with rim** (domes, walls, giant shapes): rim from 2.5, fill by `DS_FADE(vFillKeep * keyholeKeep, ivec2(1))`, and the camera-side cap: `if ((vViewZ < uHole.z || vViewZ < 8.0) && vWY > uFeetY + 1.5) discard;`. A rim wall is a strip with 1 segment per 2 m of rim, so the 32 volumes are budgeted at 8,000 triangles, not 3,000.

**Ground area** (discs, fans, rings): `fwidth` rim from 2.5, hatch fill where a mesh fill is drawn at all. Extends the existing ring and fan meshes (`src/view/fx.js:25-30`, `src/view/actors.js:131, 137-150`). All arc angles become one mesh with the angle as an instance value, so the "one fan mesh per arc angle" draw growth goes away.

**Ice shell** (bodies and spikes. No screen read):

```glsl
precision highp int;                                                // the hash needs 32 bit ints
// vWorld is a highp varying
float fr = 1.0 - max(dot(normalize(vN), normalize(vV)), 0.0);
int band = fr > 0.66 ? 0 : fr > 0.33 ? 1 : 2;                       // 3 hard fresnel steps
vec3 inner = texture(uAlbedo, vUV + vN.xy * 0.06).rgb * 0.55;       // shifted lookup reads as bent light
vec3 c = mix(inner, ramp(ICE, band), 0.7);
ivec3 cell = ivec3(floor(vWorld * 10.0));                           // sparkle cells 0.1 m wide
uint hsh = uint(cell.x) * 73856093U ^ uint(cell.y) * 19349663U ^ uint(cell.z) * 83492791U ^ uint(uTime * 6.0) * 2654435761U;
if (((hsh >> 8) & 255U) > 250U) c = ramp(ICE, 0);                   // about 2% of cells light up in the core tone, 6 times a second
col = mix(col, c, ice);
```

Two clocks go to every effect shader. `uTime` stops during hit-stop. `uReal` never stops. An instance flagged unscaled uses `mix(uTime, uReal, vUnscaled)`, so the strike that caused the freeze still crackles.

Pass: a Tier 4 fire cone in the lab adds under 0.5 screens of kept effect pixels.

### 6.4 GPU particles, one instanced draw

Each particle is uploaded once, at spawn, 48 bytes. `feedback-feel.md:164` already asks for this in the native port.

```glsl
#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;   // quad corner, -0.5..0.5
layout(location=1) in vec4 iP0;       // xyz spawn position in m, w birth time in s
layout(location=2) in vec4 iV0;       // xyz velocity in m/s, w life in s
layout(location=3) in vec4 iK;        // x gravity in m/s2, y drag in 1/s, z size in m, w ramp row
uniform mat4 uV, uP; uniform float uTime; flat out ivec2 vTone;
void main() {
  float t = uTime - iP0.w, u = t / iV0.w;
  if (t < 0.0 || u >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // dead: off screen
  float e = iK.y > 0.0 ? (1.0 - exp(-iK.y * t)) / iK.y : t;                      // drag in closed form
  vec3 p = iP0.xyz + iV0.xyz * e; p.y -= 0.5 * iK.x * t * t;
  float sz = iK.z * (u < 0.65 ? 1.0 : (1.0 - u) / 0.35); sz = ceil(sz * 16.0) / 16.0;   // shrinks in steps
  vec4 c = uV * vec4(p, 1.0);
  if (-c.z < 2.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }            // never a big square on the lens
  c.xy += aCorner * sz;
  vTone = ivec2(int(u * 4.0), int(iK.w));
  gl_Position = uP * c;
}
```

The fragment shader writes `ramp(vTone.y, vTone.x)` as a hard square. No texture. No blending.

- A particle cannot bounce on stepped ground. It ends at its life.
- Homing wisps (Drain, pickups) stay on the CPU, 16 at most.
- The flame sprites (`actors.js:523-539`, 7 draws per breath) and smoke sprites (`actors.js:505-521`, 8 draws per Hatchling) move into this pool. That removes up to 15 draws per monster.
- The pool on phone and handheld is 1,200, so the draw submits 2,400 triangles there, not 8,192. The 1,200 live cap (`feedback-feel.md:158`) stays until a device run says otherwise.
- Browser: the ring buffer wraps, and r128 allows 1 update range per attribute per frame. On a wrap frame upload the whole buffer once (196 kB at most, once per 4,096 spawns).
- Which bursts spawn is decided by the feedback-feel degrade ladder (`feedback-feel.md:163`). The drop order in 6.10 only lowers the live cap that ladder reads. Neither overrides the other.
- Fallback: today's CPU loop, capped at 600 live.

Pass: with 1,200 live particles the JS profile shows under 0.1 ms a frame in effect update, and particles are 1 draw call.

### 6.5 Lightning ribbon

One static strip of 17 points by 2 sides, drawn instanced. 1 instance per bolt, chain jump, fork, link arc, cage bolt or Wildfire ribbon. Midpoint displacement is summed in closed form in the vertex shader. Nothing is uploaded after spawn. The sim already sends each bolt with both end points and a seed (`src/view/actors.js:473`).

```glsl
#version 300 es
precision highp float; precision highp int;
layout(location=0) in vec2 aTS;   // x = t along the bolt, 0..1 in 16 steps. y = side, -1 or +1
layout(location=1) in vec4 iA;    // xyz start in m, w width in m
layout(location=2) in vec4 iB;    // xyz end in m, w birth time in s
layout(location=3) in vec4 iC;    // x seed, y life in s, z ramp row, w jag 0..1
layout(location=4) in float iCore; // 1 = may show the core tone and the glow mask. Set by the wide-bolt gate (3.3)
uniform mat4 uVP; uniform vec3 uCam; uniform float uTime, uStepHz;   // uStepHz 20, or 0 with Reduce flashing
out vec2 vUV; out float vU; flat out int vRow; flat out float vCore;
uint h(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }
float r1(uint s, int L, uint j) { return float(h(s ^ (uint(L) * 0x9e3779b9U) ^ (j * 0x85ebca6bU)) & 0xffffU) / 32767.5 - 1.0; }
vec3 bolt(float t, uint s, vec3 a, vec3 b, vec3 n1, vec3 n2, float amp) {
  vec2 o = vec2(0.0); float w = 1.0;
  for (int L = 0; L < 4; L++) {
    float u = t * float(1 << L); uint j = uint(u); float hat = 1.0 - abs(2.0 * fract(u) - 1.0);
    o += hat * w * vec2(r1(s, L, j), r1(s + 77U, L, j)); w *= 0.5; }
  return mix(a, b, t) + (n1 * o.x + n2 * o.y) * amp;
}
void main() {
  float age = uTime - iB.w, u = age / iC.y;
  if (age < 0.0 || u >= 1.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float hz = iA.w > 0.2 ? 0.0 : uStepHz;                             // wide bolts keep one shape for life
  uint s = uint(iC.x) + uint(age * hz) * 7919U;                      // thin bolts: a new shape every 50 ms
  vec3 d = iB.xyz - iA.xyz; float len = max(length(d), 0.001); vec3 dir = d / len;
  vec3 n1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), n2 = cross(dir, n1);
  float amp = min(len * 0.16, 1.2) * iC.w, t = aTS.x, e = t < 0.99 ? 0.03125 : -0.03125;   // jag at most 1.2 m
  vec3 p = bolt(t, s, iA.xyz, iB.xyz, n1, n2, amp), q = bolt(t + e, s, iA.xyz, iB.xyz, n1, n2, amp);
  vec3 side = normalize(cross(normalize((q - p) * sign(e)), uCam - p));
  p += side * aTS.y * iA.w * 0.5 * (1.0 - 0.6 * t);                  // thinner toward the far end
  vUV = vec2(t * len, aTS.y); vU = u; vRow = int(iC.z); vCore = iCore;
  gl_Position = uVP * vec4(p, 1.0);
}
// fragment: core, element body, ink edge. No blending
void main() {
  float a = abs(vUV.y);
  if (vU > 0.6 && bayer4(gl_FragCoord.xy, ivec2(1)) < (vU - 0.6) * 2.5) discard;   // dies as a screen-door
  int tone = (a < 0.3 && vCore > 0.5) ? 0 : a < 0.7 ? 2 : 4;
  o = vec4(ramp(vRow, tone), (tone < 4 && vCore > 0.5) ? 0.0 : 1.0);               // alpha 0 = glow mask
}
```

Cost: 1 draw, 64 instances, 2,048 triangles. Fallback: today's 3-box bolt.

Pass: a script that fires 20 sky strikes in 1 s logs at most 2 screen flashes and at most 2 wide bolts with a core, and bolts are 1 draw call.

### 6.6 Status on 300 enemies

Three normalised byte vec4s per enemy (12 bytes). The view loop already reads the per-enemy state arrays each frame (`src/view/actors.js:343-365`).

- `iFxA`: flash 0..1, flash row (which element hit), seed, aura row.
- `iFxB`: burn, chill (0 to 0.5 creeps up. 1.0 is frozen solid), venom, kick (arc outline, gust lean, stagger drop).
- `iFxC`: reveal, shred, mire, lockout ring.

```glsl
// in the swarm body fragment shader, after the base colour c is known. y = 0 at the feet, 1 at the head
// vFxA, vFxB, vFxC are flat varyings. uTime is highp
if (vFxB.z > 0.0 && fract(y * 3.0 + uTime * 0.8 + vFxA.z) < 0.1 + 0.25 * vFxB.z) c = ramp(POISON, 2);   // venom bands
if (vFxB.x > 0.0) {                                                                                     // ember band. The noise read is inside the branch
  float n = textureLod(uNoise, vec2(vFxA.z + y * 0.25, floor(uTime * 8.0) / 64.0), 0.0).r;
  if (y < vFxB.x * 0.45 + n * 0.15) c = ramp(FIRE, y < 0.1 ? 1 : 2);
}
if (vFxB.y > 0.0 && y < (vFxB.y > 0.99 ? 2.0 : vFxB.y * 2.0)) c = iceShell(c);                          // 6.3
if (vFxA.w > 0.0 && rim > 0.8) c = ramp(int(vFxA.w * 8.0 + 0.5) - 1, 2);                                // aura rim
if (vFxA.x > 0.0) c = mix(c, ramp(int(vFxA.y * 8.0 + 0.5), 1), min(vFxA.x, 0.6) * (uRimOnly > 0.5 ? step(0.6, rim) : 1.0));   // hit flash, 4.2
```

The vertex shader does the motion: bob times (1 minus frozen), the 0.06 m push and 0.12 m grid snap for the ice block, the gust lean, the stagger drop. The view applies the hit flash limits of 4.2 when it fills `iFxA` (once per 350 ms per enemy, 24 full-body per 100 ms).

A status overlay quad draws the flame tongue, bubble, Reveal brackets and lockout ring. It is skipped beyond 25 m.

How many draws and bytes this really costs:
- **Native:** all enemy kinds share one interleaved instance buffer of 28 bytes per enemy (position 12, yaw, scale, kind and seed 4, `iFx` 12). Kinds are contiguous ranges. Each kind draw sets its attribute pointer offset. The body matrix is built in the vertex shader. The overlay draws the whole range in 1 call. One `glBufferSubData` of live enemies only: at most 8.4 kB a frame.
- **Browser:** there are 7 enemy kinds, each with its own instance buffers (`actors.js:98-105`), and three.js uploads whole arrays (about 257 kB a frame today, by count from code, not measured). Set `updateRange` to the live count on every instanced attribute. The overlay costs 1 draw per kind.

Burn and root have no visual today. Burn gets the ember band. Root gets 4 cream card-corner stakes (#f0e8d4, ink edge) at the feet in the overlay quad for the 2 s. Not gold: gold means "use me".

Fallback: tint and flash only, no overlay draw.

Pass: 300 enemies with every status set draw in (kinds + 1) calls native and (2 x kinds) calls in the browser. Native upload is under 10 kB a frame. The flash colour matches the hitting element in a lab strip.

### 6.7 Ground marks

**Step A, the mark pool (every Detail level, for every mark with a rule time):** 96 flat quads in 1 instanced draw. Depth test on, depth write off, polygon offset. At spawn the 4 corners are checked with `heightAt`. The radius shrinks until all corners are within 0.3 m in height. When the pool is full the oldest mark goes.

```glsl
in highp vec2 vUV; flat in vec4 vD;        // x ramp row, y age 0..1 (from the vertex shader), z seed, w radius in m
void main() {
  highp vec2 uv = floor(vUV * vD.w * 8.0) / (vD.w * 8.0);            // 8 texels a metre, fixed to the world
  float fade = max(0.0, (vD.y - 0.7) / 0.3);
  float r = length(uv);
  if (r > 1.0 || bayer4(gl_FragCoord.xy, ivec2(0)) < fade) discard;  // cheap rejects before the noise read
  float n = texture(uNoise, uv * 0.35 + vD.z).r, edge = r + n * 0.35;   // ragged outline
  if (edge > 1.0) discard;
  int tone = edge > 0.85 ? 4 : edge > 0.55 ? 3 : 2;                  // ink rim, shade, body
  o = vec4(ramp(int(vD.x), tone), 1.0);
}
```

Marks stack, kills cluster round the duelist, and Detail Low is the weakest device. So:
- A new mark retires any older mark whose centre is within half the new radius and whose radius is not larger.
- Mark radius is at most 4 m in the pool. Anything wider is a rim plus the stain map, or a rim plus hatch on Low.
- The view sums mark screen cover each frame and retires the oldest marks until the sum is 1.0 screen or less (the marks share of the governor, 2.5).
- Fire and poison marks use shade and bright, not body, wherever a tell can overlap (2.5).

**Step B, the stain map (native, Detail Medium and High):** cosmetic residue and the Tier 5 ground fill. Nothing with a rule time.
- 512 x 512 RGBA8 over a 64 m by 64 m window. 0.125 m a texel, the same as Step A. 1 MB.
- Addressed toroidally: `uv = worldXZ / 64.0` with REPEAT and NEAREST. When the duelist moves, the rows and columns that leave the window are cleared with scissored clears. No copy.
- Channels: R ramp row x 32, G strength, B seed, A unused. A new stamp overwrites. A live Tier 5 footprint re-stamps on the fade beat.
- The fade pass runs at 4 Hz with blend equation GL_FUNC_REVERSE_SUBTRACT on G and a constant of 2/255, so every stain reaches exactly 0. Full strength lasts about 32 s.
- The ground shader reads it once per pixel and recolours the floor. The ground's own pixel pattern stays, so this is not a solid fill, and nothing new is sampled, so it cannot shimmer:

```glsl
vec4 st = texture(uStain, vWorldXZ / 64.0);                   // vWorldXZ is highp
if (st.g > 0.0) {
  int row = int(st.r * 255.0 / 32.0 + 0.5);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  int mid = (row == FIRE || row == POISON) ? 3 : 2;           // never the body tone under a tell (2.5)
  int tone = l < 0.35 ? 3 : (l < 0.6 ? mid : 1);              // ground dark, mid, light -> shade, body, bright
  float quiet = distance(vWorldXZ, uDuelist.xz) < 3.0 ? 0.7 : 1.0;   // the quiet eye (1.4)
  c = mix(c, ramp(row, tone), min(st.g, 0.7) * quiet);
}
```

Marks then follow steps and slopes, cost the same at Tier 1 and Tier 5, and add 0 layers of fill. This is what makes "the ground is the weapon" possible. Cost: 1 stamp draw and 1 fade draw at 4 Hz.

Pass: 500 marks spawned on one spot in 10 s never raise draw calls or allocations, and leave rasterised mark cover at 1.0 screen or less. No mark floats over or cuts into a step by more than 0.3 m.
Pass: a 240 frame slow camera pan over a 40 m stained area shows 0 pixels that change tone while their world point is unchanged.
Pass: a red tell on fully stained fire ground differs from the ground by 30 delta E or more.
Pass: a stain stamped at full strength reads exactly 0 in G after 35 s.

### 6.8 Glow, distortion and the composite

Glow has three levels. Use the lowest that does the job.
1. Ink edge and contrast. Free. All devices.
2. **Dusk halo** quads, on every Detail level. One instanced draw, the only blended own-effect draw. Each halo first darkens the ground, then lights it, so a glow reads even on bright Stage 1 sand:

```glsl
float r = length(vUV);                                              // vUV -1..1 across the quad
float g = floor((1.0 - r) * 4.0 + bayer4(gl_FragCoord.xy, ivec2(1))) / 4.0;   // 4 rings, dithered between
if (g <= 0.0) discard;
o = g <= 0.5 ? vec4(0.0, 0.0, 0.0, g <= 0.25 ? 0.15 : 0.30)        // outer 2 rings: the ground drops 15% and 30%
             : vec4(ramp(vRow, 1) * (g - 0.5) * 2.0 * vStrength, 0.0);   // inner 2 rings: added light
// blend: glBlendFuncSeparate(GL_ONE, GL_ONE_MINUS_SRC_ALPHA, GL_ZERO, GL_ONE). Stencil NOTEQUAL 1, so never over the duelist
```

   Halo limits: strength at most 0.3. At most 0.6 H across. Pool 24 on High, 12 on Medium, 6 on Low (the old `feedback-feel.md:165` number). A new halo within 3 m of a live one refreshes that one instead of stacking. The view sums halo screen cover and drops the smallest until the sum is 1.0 screen or less.
3. Stepped bloom from the glow mask, Detail High only. Two tiny passes:

```glsl
// bright pass into 1/4 internal size. uScene is NEAREST. Only pixels the effects marked (alpha under 0.25)
vec4 a = texture(uScene, vUV + uPx * vec2(-1.0, -1.0)), b = texture(uScene, vUV + uPx * vec2(1.0, -1.0));
vec4 c = texture(uScene, vUV + uPx * vec2(-1.0,  1.0)), d = texture(uScene, vUV + uPx * vec2(1.0,  1.0));
o = vec4((a.rgb * step(a.a, 0.25) + b.rgb * step(b.a, 0.25) + c.rgb * step(c.a, 0.25) + d.rgb * step(d.a, 0.25)) * 0.25, 1.0);
// blur pass into 1/8 size: 4 linear taps at 1.5 texels
```

Distortion sources draw into the 1/4 size offset target. One quad per source, blend ONE, ONE, target RGBA8 cleared to 0. Channels: R = +x, G = -x, B = +y, A = -y (signed targets cannot be drawn to in ES 3.0). Four kinds:

```glsl
in vec2 vUV; in vec3 vK; flat in vec4 vF;                          // vK: x progress 0..1, y strength 0..1, z kind. vF: kind 2 fault normal xy, shift direction zw
uniform highp float uTime;
void main() {
  vec2 dir; float w;
  if (vK.z < 0.5) { float r = length(vUV);                         // kind 0: round shockwave ring
    w = max(0.0, 1.0 - abs(r - vK.x) / 0.12) * (1.0 - vK.x); dir = vUV / max(r, 0.001); }
  else if (vK.z < 1.5) { float n = texture(uNoise, vUV * 0.5 + vec2(0.0, -uTime * 0.6)).r - 0.5;   // kind 1: heat haze column, strength capped so the shift is 2 pixels at most
    w = abs(n) * 2.0 * (1.0 - abs(vUV.x)); dir = vec2(sign(n), 0.0); }
  else if (vK.z < 2.5) { w = step(0.0, dot(vUV, vF.xy)); dir = vF.zw; }   // kind 2: half-plane shift (Tablebreak faults). Full-screen quad
  else { vec2 q = abs(vUV) / vec2(5.0 / 7.0, 1.0); float r = max(q.x, q.y);   // kind 3: card-shaped ring, ratio 5:7
    w = max(0.0, 1.0 - abs(r - vK.x) / 0.12) * (1.0 - vK.x); dir = normalize(vUV + 0.0001); }
  vec2 v = dir * w * vK.y;
  o = vec4(max(v.x, 0.0), max(-v.x, 0.0), max(v.y, 0.0), max(-v.y, 0.0));
}
```

The composite:

```glsl
#version 300 es
precision mediump float;
in highp vec2 vUV; out vec4 o;
uniform sampler2D uScene, uOffset, uGlow, uNoise, uRamp;
uniform highp vec2 uRes;      // internal size in pixels
uniform vec4 uEdge;           // x amount 0..1, y ramp row, z noise scale, w scroll
uniform vec4 uMood;           // x world dim, y flash strength 0..0.35, z impact 0 or 1, w keyhole radius
uniform vec2 uFx;             // x colour drain 0..0.2, y flash ramp row
uniform highp vec2 uHero;     // duelist chest in UV
void main() {
  highp vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float key = smoothstep(uMood.w, uMood.w * 1.6, distance(vUV * asp, uHero * asp));
  vec4 d = texture(uOffset, vUV);
  highp vec2 off = floor((d.rb - d.ga) * 8.0 * key + 0.5) / uRes;      // whole pixels, at most 8
  vec4 s = texture(uScene, vUV + off); vec3 c = s.rgb;
  float world = step(0.75, s.a);                                       // 1 on world pixels
  float notProt = world + step(s.a, 0.25);                             // 0 on protected actors (alpha 0.5)
  c *= 1.0 - uMood.x * world;                                          // dim the world, not effects, not actors
  c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), uFx.x * world);  // Dark colour drain
  float b = bayer4(gl_FragCoord.xy, ivec2(0));
  vec3 g = floor(texture(uGlow, vUV).rgb * 4.0 + b) / 4.0;             // stepped bloom
  c += min(g, vec3(1.0)) * 0.35 * notProt;                             // glow adds at most 0.35 a channel (5.2 limit 4)
  if (uMood.z > 0.5) {                                                 // impact frame: 35% toward 2 tones, world only, never over the hero
    vec3 two = dot(c, vec3(0.299, 0.587, 0.114)) > 0.45 ? ramp(int(uEdge.y), 1) : ramp(int(uEdge.y), 4);
    c = mix(c, two, 0.35 * world * key);
  }
  highp vec2 dE = (0.5 - abs(vUV - 0.5)) * asp;                        // distance to the nearest screen side, in units of H
  float e = 1.0 - 2.0 * min(dE.x, dE.y);
  float n = texture(uNoise, floor(vUV * vec2(96.0, 54.0)) * uEdge.z / 64.0 + vec2(0.0, uEdge.w)).r;
  float m = e + n * 0.06 - (1.0 - 0.06 * uEdge.x);                     // reaches at most 6% of H in, at any aspect
  if (m > 0.0 && b < m * 8.0) c = mix(c, ramp(int(uEdge.y), m > 0.06 ? 3 : 1), 0.85 * notProt);
  o = vec4(mix(c, ramp(int(uFx.y), 1), uMood.y), 1.0);                 // the gated flash, in the element's bright tone
}
```

Rules:
- Distortion is in whole pixels, at most 8. The picture tears in hard steps, which keeps it retro. The keyhole sets the shift to 0 over the duelist. Distortion ignores depth, so a shockwave bends walls in front of it. This is accepted.
- Distortion, world dim, colour drain, impact frame, flash and screen edge never touch a priority-pass pixel, because that pass is drawn after the composite (2.12). Dim, drain, impact frame, edge and glow never touch a protected actor pixel either. Enemies may be shifted by a shockwave by up to 8 pixels for up to 0.5 s. This is accepted.
- One element owns the screen edge at a time: the one with the largest share of damage in the last 5 s. The view tallies this from the element bits the hit event already carries (`src/sim/combat.js:41`, `src/sim/specials.js:71`).
- Edge looks: frost crystals creep in as a frame (ice). A bubbling rim that scrolls up (poison). Ember specks and shimmer (fire). Speed lines (wind). Dust specks (earth). Pale ray wedges (light). Moon-white pinpoints streaming in with 15% darkening at most (dark). A single arc along the frame, through the flash gate (lightning).
- Steady edge amount: up to 0.5 at Tier 4, 0.6 at Tier 5. Amount 1.0 is for moments only, at most 1.0 s.
- When LP is 30% or less the low-LP border wins and the element edge goes to 0 (`src/main.js:433`).

Pass: a frame capture shows 0 copies of the screen. The duelist's pixels are the same with distortion on and off.
Pass: in a Stage 1 screenshot no sand pixel gets brighter with bloom on.
Pass: the edge pixel count is 18% of the screen or less at amount 1.0 at 16:9, and no edge pixel is deeper than 6% of H at 4:3, 16:9 and 20:9. At 25% LP with a Tier 5 dark build only the low-LP border shows.
Pass (dusk halo): on Stage 1 lit sand, on Detail Low, the mean luminance in a ring 1.0 to 1.6 radii round a Tier 2 shot is 15% or more below the sand, and the centre is 20 delta E or more above it.

### 6.9 Fill safety

- Keep `discard` out of the common path. On tile-based phone GPUs a shader with `discard` forces a late depth test for that draw (Arm guidance). Build two programs per faded material. Per material kind (at most 12), one CPU test a frame of the kind's merged bounds against the corridor and the near distance picks the discard or no-discard program. No per-instance work and no upload. Warm both behind the stage card. (Guess: measure in step 15. If the saving is under 0.3 ms, ship the discard program only.)
- Draw order as 2.12: opaque with no discard, ground, discard draws, sky last.
- `DS_FADE` is the first statement of `main()` in every own-effect fragment shader, before any texture read.
- Own-effect draws never write depth, so their discard costs no early depth test.
- At most 24 area fills drawn per frame, and the rasterised sum of 2.5 (5.0 screens) on top. Merge or drop the smallest.
- Effect fragment shaders: at most 2 noise reads and 1 ramp read.
- No alpha-to-coverage. It needs a multisampled target, which softens the hard pixels.

### 6.10 Budget

Phone internal picture: 1200 x 540 = 648,000 px on a 2400 x 1080 screen at half size (guess for the native build). PC today: 960 x 540 = 518,400 px.

**The fixed cost first.** On the phone, 1 internal layer is 648,000 px. The blit to the 2400 x 1080 screen is 2,592,000 px, which is 4.0 internal layers. So the fixed passes at the top tier are: scene 1.0 + composite 1.0 + blit 4.0 + small passes 0.14 = 6.14 internal layers, or 478 million px a second at 120 Hz, before any overdraw. This is why the ladder below locks 120 Hz screens to 60 Hz before it touches resolution.

Effects only, per screen tier, on the phone at Detail Medium:

| Screen tier | Effect draw calls | Effect triangles | Small passes (1/4 or less) | Rasterised effect fill, peak | Kept effect pixels, peak |
|---|---|---|---|---|---|
| 1 Opening Hand | 5 | 1,500 | 0 | 0.3 screens | 0.1 screens |
| 2 Full Field | 9 | 4,000 | 0 | 0.8 | 0.3 |
| 3 Ascendant | 14 | 9,000 | 1 (offset, when alive) | 1.5 | 0.6 |
| 4 Cataclysm | 19 | 16,000 | 3 on High, 1 on Medium | 3.0 | 1.0 |
| 5 Tablebreak | 23 | 22,000 | 3 on High, 1 on Medium, + stain stamp and fade at 4 Hz | 5.0 (the governor's hard limit) | 1.5 |

"Kept effect pixels" here means everything own that reaches the picture: fills, rims, particles, bolts and marks, with overlap counted. Own fill alone never passes the governor's kept-sum limit. All numbers in this table are guesses until a device run.

Tier 5 effect draws, itemised:

| Item | Draw calls | Triangles |
|---|---|---|
| Status in the body shader | 0 | 0 |
| Status overlay quads (native. 1 per kind in the browser) | 1 | 600 |
| Lightning, chains, links, cage, flame ribbons | 1 | 2,048 |
| GPU particles (pool 1,200 phone and handheld, 4,096 PC) | 1 | 2,400 to 8,192 |
| Volumes: dome, cone, column, rim wall | 4 | 8,000 |
| Spikes, teeth, monoliths, bubble stacks (one instanced mesh family) | 1 | 1,500 |
| Ground mark pool | 1 | 192 |
| Stain stamp and fade (4 Hz) | 2 | 4 |
| Halos | 1 | 48 |
| Shards and slabs | 1 | 480 |
| Rings and fans | 2 | 3,000 |
| Signature mesh | 2 | 2,000 |
| Ghost statues (one shared low mesh) | 1 | 1,920 |
| Grand Card | 1 | 28 |
| Offset sources | 1 | 16 |
| Bright pass, blur pass | 2 | 4 |
| Composite (the blit is not a draw) | 1 | 2 |
| Total | 23 | 22,000 phone, 28,000 PC |

Whole frame at Tier 5 with 300 enemies, native, with real models (guess, counted from code and specs, not measured):

| Part | Draw calls | Triangles |
|---|---|---|
| World (`environment-bar.md:166-167`) | 40 | 60,000 |
| Enemies, bosses, duelist, summons, shots, pickups, shadows | 45 | 120,000 |
| See-through extras: duelist silhouette and 2 hulls (6, with a 2 mesh rig), summon hulls (6), warnings through summons and scenery (2), shot hull (1), marker (1), exit beacon (1) | 17 | 18,500 |
| Effects | 23 | 28,000 |
| HUD and damage numbers (as one glyph atlas, `feedback-feel.md:88`. Today up to 64 draws) | 5 | 1,000 |
| Total | 130 | 227,500 |
| Budget | 150 | 250,000 |

Headroom is 20 draws and 22,500 triangles. That is thin. Two honest warnings:
- The 45 draws for actors is a target, not what the code does today. The staff alone is about 12 draws (`src/view/actors.js:168-177`). The budget script prints draws per group so the 45 is proven or the gap is known.
- The browser build pays more: 7 enemy hull draws for flat stand-in bodies (2.3) and 6 more overlay draws (6.6), about 143 in all. The browser is the lab. The budget is judged on native.

Time target: effects take at most 2.5 ms GPU and 0.5 ms CPU of the 8.3 ms frame at 120 Hz on the handheld (guess).

**Quality tiers** (set by Detail):

| | Low (Battery) | Medium (phone default) | High (handheld, PC) |
|---|---|---|---|
| Composite pass | no. Edge is one alpha-tested quad. Flash is a quad | yes | yes |
| Distortion | no. Shockwaves are ring meshes. Tablebreak leaves hairlines only | yes | yes |
| Mask bloom | no | no | yes, at screen tier 3 and up |
| Dusk halos | 6 | 12 | 24 |
| Ground | mark pool, hatch for wide fills | stain map (native), pool and hatch (browser) | same as Medium |
| Sky flame band | no. Tint only | yes | yes |
| Particles live | 600 | 1,200 | 1,200 handheld, 4,000 PC |
| Flame shader | 1 noise read, 6 pictures a second, no inside volume at any size | full | full |
| Ice shell | palette swap only | full | full |
| Status overlay | off beyond 12 m | 25 m | 25 m |
| Glow rule of `feedback-feel.md:165` | holds as written | amended (decision 1) | amended (decision 1) |

**Drop order.** GLES 3.0 has no GPU timer in core, so the ladder reads frame intervals from the display clock. A step fires when more than 5% of the last 30 frames missed their slot. One step per 0.5 s. Steps come back in reverse after 3 s with no miss.
1. Mask bloom off. Halos stay.
2. Offset pass off. Shockwaves fall back to ring meshes.
3. Particle live cap halves, twice. (The feedback-feel ladder then drops trails and glints first, `feedback-feel.md:163`.)
4. All volume insides off. Rim and ground only at every size.
5. On a 120 Hz screen, lock to 60 Hz (swap interval 2). This halves the fill needed and keeps the hard pixels perfect.
6. Status overlay off beyond 12 m. Body tint stays.
7. Bolt forks off. Bolt pool 64 to 24. Mark pool 96 to 48.
8. Internal picture to 1/3 size (800 x 360 on the phone). A whole-number scale, so pixels stay even. Never a fractional render scale.

The ladder never changes a hit-stop or slow motion choice (fairness rule, section 4).

Never dropped: red enemy tells, the rim hit flash on enemies, status tint, crit numbers, the duelist silhouette and outline, the rim of any own attack, the core shape of a signature moment.

Pass: see checks 8 to 11 in section 7.

### 6.11 What the view needs from the sim (contracts, no rule change)

- Per-enemy status columns the view can read: chill, venom, reveal, shred, mire, aura element, lockout timers. Only `burn`, `flash`, `mark`, `root` exist (`src/sim/enemies.js:20-21`).
- The hit event already carries crit and the element mask (`src/sim/combat.js:41`). The kill event should carry the element bits of the killing hit (`src/main.js:270` gets kind and position only). The signature trigger, death looks and Clean Sweep need it.
- The chain effect record carries both end points (`combat.js:62`).
- The view reads `burn` and its starting value directly. No sim change.
- A reaction event with id, position and enemy index (EV_REACT, `SPEC.md:427`).
- Every `g.fx` record gets an `owner` field (2.5). Put `owner: 2` in the reset object in `addFx` (`combat.js:109-112`) so a pooled record never keeps a stale owner.
- Slow motion, if decision 3 allows it in a mode: a view-side time scale in the main loop, `acc += dtReal * fx.slow`, beside the existing hit-stop wait (`src/main.js:397-399`). The sim still runs the same fixed ticks.
- When REACH is wired: it multiplies area on area kinds only, as `loadout.js:161` does. No per-shot scale. No change to `src/sim/weapons.js`.

---

## 7. CHECKS

Headless checks run in the style of the existing `test/browser-*.mjs` scripts, seeds 1, 2 and 3. Checks 1, 2, 3, 7 and 12 run at 1920 x 1080, 2400 x 1080 and 1440 x 1080. The rest run at 1920 x 1080. "Pixel test" means: draw the duelist alone into an id buffer, count its pixels, and compare with the duelist's pixels in the final frame. It needs a new debug hook, `__ds.duelistPixels()` in `src/main.js`, that returns `{alone, visible, silhouette}`.

**Headless**

1. **Pylon.** Walk a full circle round a gate pylon on the circle the old test uses (half the pylon's long side plus 2.7 m from its centre), 120 steps. Duelist body pixels visible are 60% or more of unoccluded on 120 of 120 steps. This replaces the geometric test in `test/browser-pylon.mjs:6`.
2. **Screen-sized own effect.** With a lab switch that sets every own effect to 4 times its radius, at the default Spell effects setting, on 240 of 240 sampled frames: duelist pixels 60% or more. Every enemy warning 90% or more of its pixels. Every pickup within 15 m keeps 90% or more of the pixels it has with own effects switched off. The exit 90% or more. Enemy pixels 70% or more and boss pixels 85% or more of their count with own effects off. No own pixel above 1.5 m lies on the camera side of the duelist. Repeat at Reach radius x1.58 and x2.0.
3. **Each occluder kind.** For each of: tree canopy, trunk, boulder, pylon, wall, pillar, cliff edge, chest, statue, Witness Stone, Broker canopy, a 5.4 m own Fusion, a 14.4 m swollen God Fusion, an elite, the 18 m gate boss. Place it on the sight line, orbit the camera 360 degrees in 120 steps. Duelist body-or-silhouette pixels are 60% or more on 120 of 120 steps.
4. **No camera inside solids.** 60 s autorun hugging cliffs, with Shake 100: 0 frames where the centre or any corner of the near plane is inside ground or a wall. 0 frames with a black or back-face region over 2% of the screen. Camera height never changes by more than 0.10 m between two frames, and pitch by more than 1.0 degree. 0 frames where scenery nearer than the duelist covers over 50% of the screen for more than 0.5 s.
5. **No pops.** In check 3 (3 degree steps), no object's keep changes by more than 25 points between two steps. In the 2.3 walk test, no more than 12.5 points between two frames. No `visible` flag flips for line-of-sight reasons.
6. **Danger over own effects.** A red tell under a Tier 5 own effect keeps 90% or more of its pixels, at the same position and colour within 2% (2.12 Pass). Behind an own God Fusion it keeps 45% or more. A hue scan of every own effect at Tier 5 finds 0 pixels in hue 345 to 25 degrees over more than 0.1% of the effect, and 0 ground-fill pixels in hue 340 to 35.
7. **Run-wide duelist bar.** 60 s autorun at 10 Hz: duelist visible 60% or more on 97% or more of samples (`environment-bar.md:154`). The duelist is never taller than 25% of H outside a forced pull-in, and never shorter than `minShare` of H outside a boss zoom (2.9).
8. **Budget.** New script `test/browser-budget.mjs` fails when draws pass 150 or triangles pass 250,000 in the Tier 5 stress scene (300 enemies, all 8 elements, a signature every 20 s). It prints draws per group (world, actors, see-through, effects, HUD) and stores its numbers in `test/golden/`.
9. **No draw growth.** Draw calls at 300 enemies with every status set are at most draw calls at 10 enemies plus the 6.6 Pass number. Draw calls with 1,200 particles, 64 bolts and 96 marks live are the same as with 1 of each.
10. **Frame time at the top tier.** The stress scene holds p95 of 16.7 ms on the PC test machine in real GL. On the handheld: p95 of 8.3 ms at 120 Hz. On the phone: p95 of 16.7 ms. On a phone with a 120 Hz screen: p95 of 8.3 ms at Tier 1 to 3 with no ladder step, and no worse than ladder step 5 at Tier 5. No frame over 33 ms. Device numbers need a device. Software GL numbers are not valid.
11. **Overdraw, two readings** on the stress replay (each fragment adds 1/16 into a single-channel buffer). Reading A, with a debug define that turns every discard off: 6.0 layers or less on average, 12 or less in the worst 16 x 16 block. Reading B, normal shaders: 3.0 layers or less on average, 6 or less in the worst block. Reading A is the one that catches dither cost.
12. **Flash and shake limits.** Section 5.2 Pass lines.
13. **Big moment budgets.** Section 4.3 Pass lines, including the fairness Pass.
14. **Purity.** Same replay hash across Detail Low, Medium, High, Spell effects Auto, Full, Soft, Big moments Full and Off, and with the director on and off.
15. **Allocation.** 0 bytes per frame in a 60 s Tier 5 lab run (`test/browser-alloc.mjs`).
16. **Rule truth.** Rim radius within 5% of the sim radius. Reaction mark time within 2 frames of the rule time.
17. **Owner tags and names.** A unit test fails if any effect spawn call has no owner. A grep of `src/` and `index.html` for the game name in the owner's quote finds 0 hits.
18. **Tier order.** The logged screen tier never drops in a stage, claimed share rises in order across the 5 timed screenshots, and the screen-breaking Pass of 1.4 holds.
19. **Governor.** On the stress replay: rasterised sum 5.0 screens or less, painted share inside the 2.5 table, painted share of the centre box 35% or less, on every frame.
20. **Ramp table.** Unit test: no tone in the fire, earth or light rows has hue under 28 or over 345. No tone in any row is #ffffff. Core, bright and body match `design/art-book/make.mjs:59`.

**Needs eyes**

21. Bayer against the old noise on a faded pylon and a faded canopy: which reads as pixel art.
22. Amber fire reads as fire on Stage 1 sand without any red.
23. Lightning against ice in one scene: both blue, told apart at a glance.
24. Poison on Stage 1 meadow and beside Stage 2 ghost-light. Earth on Stage 1 sandstone. Dark, ice and lightning on Stage 3. Light on Stage 1 sand. Each reads at a glance.
25. The 8 greyscale clips test (3.0). The 9 reaction strips test (3.9). A frozen enemy is named "frozen" from a 6 frame clip.
26. Tablebreak at maximum Reach: does one screenshot make a new player say it is huge, and can the owner still point to the duelist, a red tell and a chest in under 0.5 s each.
27. The camera in a grove and round a pylon for 60 s: no snap, no swim.
28. A ghosted 7.2 m God Fusion still looks like a proud monster, not a bug. The violet summon outline reads on Stage 3 and beside a Dark build.
29. Tells under colour-blind simulation on all 8 element grounds (2.5 Pass). The hatch pan clip on Detail Low (2.5 Pass).
30. The lab's "Worst case" button (step 5) shows a green light for 10 s.

---

## 8. BUILD ORDER FOR THE PC

Smallest shippable first. Each step ends green on its checks. The "When" column says plainly what each step touches outside the view.

| # | Step | Files | Checks | When |
|---|---|---|---|---|
| 1 | **START NOW. See-through camera for scenery and props.** `dsDither` (Bayer, and note which WebGL path the browser takes). Screen-space porthole on the map mesh. `dsCorridor` plus `nearKeep` on trees (per-variant canopy material, trunk test), boulders, bushes, specials and every prop. Delete the tree CPU loop. New debug hook `__ds.duelistPixels()`. Rewrite the pylon test as a pixel count. This fixes the pylon | `src/view/mapMesh.js:27-31`, `src/view/scenery.js:76-107`, `src/view/props.js`, `src/main.js:426-427`, `test/browser-pylon.mjs`, `test/browser-fade.mjs` | 1, 3 (canopy, boulder, pylon, wall, pillar, cliff, statue, Witness Stone, Broker canopy rows), 5, 21 | View only. If the shrine rework is editing `props.js`, land the prop part right after it |
| 2 | **Duelist always visible.** Stencil silhouette, 2 tone outline, marker. Count the rig meshes and report the draw cost | `src/view/rig.js:82, 95`, `src/view/actors.js` (duelist block from `:249`), `src/main.js:46` | 2.8 Pass lines, 7, 3 (trunk and chest rows) | View only |
| 3 | **Ghost, do not hide.** Enemies fade to 50% with a solid edge (hull for stand-ins). Own summons ghost with an outline. Bosses get the 50% inner band. Remove every line-of-sight `visible = false` | `src/view/actors.js:240-246, 311, 350, 371-380` | 3 (monster and boss rows), 5, 28 | View only |
| 4 | **Camera.** Near plane 0.15 m. Pass-behind rule with the 4 ray test and hysteresis. Arm swing before close pull-in. Smooth rise. Colliders under 2.0 m fade-only. Own-size pull-back with 2 s hold, max not product, size-floor cap. Shake travel clamp. Fix the stale comment at `config.js:16` | `src/view/camera.js:12-18, 26-29, 38-49`, `src/main.js:57, 420-423`, `src/data/config.js:15-19` | 4, 7, 27, 2.9 Pass lines, and `test/browser-camera.mjs` for boss framing | Touches the `cam` block of `src/data/config.js` only. The pacing retune edits the same file: rebase on it |
| 5 | **FX kit and FX lab.** Ramp (from the art book) and noise textures. `?fxlab` page with 300 dummy enemies, pickers for element, tier, status, reaction, a 4x size switch, and a readout of draws per group, triangles, claimed and painted share, rasterised sum, pools. A "Worst case" button: Stage 2, chain lightning, Volley 6, Reach at cap, 300 enemies, a boss wind-up, Spell effects Full, Shake 100, with the 5.2 grid test live and a red or green light. Budget script. Check that r128 takes ES 3.00 text | new `src/view/fxkit.js`, `src/view/fxlab.js`, `test/browser-budget.mjs` | 8, 15, 20 | View only, new files |
| 6 | **GPU particles and the lightning ribbon.** Move flame and smoke sprites into the particle pool. Element colours from the ramp | `src/view/fx.js:6, 17-23, 129-137`, `src/view/actors.js:136, 473-477, 505-539`, `src/view/hud.js:22` | 9, 6.4 Pass, 6.5 Pass | After the feedback-feel `fx.js` work lands (it is rebuilding the same particle code), or done by the same builder |
| 7 | **Own-effect material.** Ink rule, solid rim, camera-side cap, keyhole, two-sum governor, owner tags, draw order with sky last, hatch for Low. One fan mesh for all arcs. Solid tells with ink and pale edges | `src/view/fx.js:25-37`, `src/view/actors.js:128-131, 137-150, 482-487`, `src/sim/combat.js:109-114` (owner field only), `src/main.js:52-56` | 2, 6, 11, 17, 19 | After the pacing retune merges: it touches `src/sim/combat.js`. The `owner` field is one data field with no rule effect. Confirm with the purity test |
| 8 | **Status on bodies, and fire and lightning live.** `iFx` attributes, overlay draw, Burn band, root stakes, chain arcs with source point, hit flash limits, Tier 1 to 4 looks, death looks and the mark pool for the two wired elements | `src/view/actors.js:98-105, 343-365`, `src/sim/combat.js:62` (source point in the effect record) | 9, 16, 22 | After the pacing retune merges: it touches `src/sim/combat.js` |
| 9 | **Flash gate, shake budget, moment director.** Tick-counted hit-stop budgets and the fairness rule. Fusion Landing, Summon Call, Field Set, Ascension through the director. Hold poses from existing clips | `src/view/fx.js:57-63, 187-195`, `index.html:111-113, 129`, `src/main.js:264-278, 397-399, 433`, `src/view/actors.js:225-232` | 12, 13, 14 | After the feedback-feel `fx.js` work lands, or done by the same builder |
| 10 | **Composite path.** Scene target with `stencilBuffer: true` and a depth-stencil shared with the composite target. Three-level alpha mask. Offset pass with the 4 kinds, bloom passes, composite, priority pass after it, blit. Screen edge. Impact frame. World dim. Dusk halos. Drop ladder. Re-run the 2.8 Pass | new `src/view/post.js`, `src/main.js:443`, `index.html:110-113, 171-173` | 6.2 Pass lines, 6.8 Pass lines, 2.12 Pass lines, 10, 11 | Waits for OWNER DECISION 1 |
| 11 | **Settings rows.** Spell effects Auto / Full / Soft. Reduce flashing. Big moments. Duelist marker. Detail. Camera distance | the settings panel in `index.html` (pause screen from `:207`), `src/core/save.js:7`, settings code near `src/main.js:116` | 5.2 Pass lines | Waits for the menus work. Until then the values are debug flags in the lab |
| 12 | **Size wiring.** REACH as area on area kinds, VOLLEY, tier computation live, Reach wall height, Overtime swell, orbit bias | `src/data/stats.js`, `src/sim/field.js:33-43`, `src/view/actors.js` | 1.2 Pass, 1.3 Pass lines, 16, 18 | Waits for the pacing retune (it changes clear speed). Swell waits for OWNER DECISION 5. Boundless Hand waits for OWNER DECISION 2 and a probe re-run |
| 13 | **Six unwired elements in the lab.** All tier looks, statuses, ground marks, death looks. Then the 9 reaction looks | `src/view/fxkit.js`, `src/view/fxlab.js` | 23, 24, 25 | Lab work can run any time after step 8. Going live waits for the sim to wire statuses and reactions (`SPEC.md:382-411`) |
| 14 | **Signatures, Tablebreak, Cap Burst, Clean Sweep. Tier 5 hollow giants, tall pieces for all 8 elements, Grand Card. Stain map and ground recolour. Sky tint and flame band. Ground Record.** Slow motion where allowed | `src/view/fxkit.js`, `src/view/post.js`, `src/main.js:397-399` | 13, 18, 26 | After 10 and 12. Slow motion waits for OWNER DECISION 3. The sky parts follow the engine plan's sky |
| 15 | **Device run.** Measure on the phone and the handheld. Replace every cost guess. Tune the drop ladder and the two-program choice | native port | 10, 11 | When the native renderer runs |

Steps 1 to 4 are the "be a pro" camera ask. They ship without any new effect. Steps 5 to 9 make the two live elements look right. Steps 10 to 14 are the awe.

---

## 9. ASSETS

What the owner must make: **nothing for the effects.**

Made in code at boot:
- Noise: one 64 x 64 R8 tileable texture (4 kB of memory).
- Ramp: one 8 x 8 RGBA8 texture (256 bytes), filled from the art book palette.
- Bayer pattern: inside the shaders, as bit maths.
- Stain map: one 512 x 512 RGBA8 render target (1 MB of memory, native).
- The seal disc: 5 rectangles and 1 ring (3.0).
- About 12 shaders, under 20 kB of text before compression (guess).

Meshes made in code: quad, ring, fan, dome, column, rim wall strip, bolt strip, card quad, slab, monolith, shard, spike (a 5 sided cone), bubble, blob (20 triangles).

What this makes unnecessary in the Asset Tool:
- Painted flame, smoke, spark, frost, gas and explosion sprite sheets.
- Lightning bolt sheets.
- Glow and halo sprites.
- Decal sheets (scorch, crack, puddle, frost).
- Screen overlay art (frost frame, speed lines, vignettes).
- Per-element projectile models. Shots are code shapes with the element shader.

Optional, later, only if the owner wants them:
- A hold pose clip per summon and a cast pose for each duelist (12 frames each), for Fusion Landing and signature moments. Existing rig clips stand in until then.
- His own seal symbol, if he wants one in place of the code-drawn seal disc.
- Sounds for the hooks in section 3. That is the audio job, not this one.

---

## 10. OPEN OWNER DECISIONS

**1. Allow one composite pass on handheld at Detail Medium and High.**
`feedback-feel.md:165` forbids any full-screen pass on handheld and caps glow at 6 quads. Distortion, bloom, world dim, the screen edge, impact frames and the Tablebreak picture break all need one composite. Because the game already draws small and scales up, that composite costs no screen copy.
Recommendation: yes. Keep the old rule exactly as written for Detail Low and the Battery profile. Measure on the handheld in step 15 and keep the drop ladder as the safety net.

**2. Boundless Hand: a Secret Fusion trait that lifts the Reach cap.**
Reach stays an area stat with a +150% cap, as the stat spec says. The proposal is one cap-lift trait: Reach to +300% area (radius x2.0), Overtime only, after the boundedness probe is re-run with it.
Recommendation: yes. Looks are free of this by law L2, so the screen breaks at Tier 5 whatever is decided here.

**3. Slow motion.**
0.3x for 0.4 s on Fusion Landing, gate boss kills and the ice signature. At most 1.0 s a minute. It changes no tick and no replay, but it gives more real time to aim.
Recommendation: allow it only in runs that cannot post to a verified board. Verified runs get hit-stop only, the same for every player.

**4. Comfort defaults.**
(a) Spell effects defaults to Auto, not Full. (b) Camera pull-back stays on, slower, under Reduce motion. (c) Two new Access rows: Big moments (Full / Short / Off) and Duelist marker (Auto / Always).
Recommendation: yes to all three. Auto is what keeps a broken build playable without the player ever opening Settings.

**5. Overtime swell.**
In Overtime, own Fusions and God Fusions grow +12.5% each minute up to double size (a God Fusion ends at 14.4 m, still under the 18 m gate boss). Look only. It amends "the size chart is law" for Overtime.
Recommendation: yes. It is the direct answer to "the size of the screen" for monsters.

Not a decision, but worth his eye: the art book says lightning is blue-white and dark has a moon-white edge. This spec follows the book. If he wants yellow lightning or violet dark, the book changes first, because gold and violet are reserved colours.

---

## 11. EVERY NUMBER THAT IS A GUESS

Not derived from code or a source. Tune in the lab or on a device.

- Tier times in 1.4, and the claimed share bands (2%, 8%, 20%, 45%). The 45% screen-breaking bar.
- Overtime swell: +12.5% a minute, cap +100%, pulse shape. Orbit bias 1.5 m.
- Reach thresholds for tiers (+50%, +100%). Reach wall heights (3 m to 12 m, 16 m to 40 m, 60 m). Boundless Hand +300%.
- Grand Card: every 8th card, 12 m. Quiet eye: 3 m, 30%.
- Porthole radii 0.9 and 1.3 times duelist height. Band edges 0.55 and 1.0. Front offset 0.8 m. Feet offset 0.4 m.
- Corridor ramp length 3 m. Every keep value per kind in 2.3. Enemy bound 0.6 x size.
- Near fade distances: 0.8 m, 2.4 m, 2.0 m, 5.0 m, 1.4 m.
- Ink: `uInk` 0.05, 0.08, 0.025. Floor 12.5%. Kept-sum limits 0.35, 0.50, 0.20 screens. Painted share limits 55%, 65%, 35%, and 35% of the centre box. Rasterised limits 5.0, 3.0, 1.0, 1.0 screens. Smoothing 0.3 s. Keyhole 12% of H. Rim 2 pixels.
- Camera-side cap: 1.5 m and 8 m.
- Hatch: 1.0 m period, 25% duty cap, the 6 art pixel switch, 20 L* points. Tell contrast gap 25 L* points. Stain mix cap 70%.
- Summon ghost threshold 25% of screen, 0.35 s step limit, 10% and 0.5 m hysteresis.
- Boss keep floor 50%, and the 85%, 70% and 45% pass bars.
- Marker: 40% for 0.5 s, 0.5 m chevron.
- Camera: fit factor 0.8, `minShare` 0.075 and 0.085, in rate 0.7, Reduce motion rate 0.5, height gain 0.2 rad, pass-behind span 8 m and 10 m, the 4 m ray offsets, hold 0.5 s, swing 0.5 rad at 1.0 rad a second before 4.0 m, rise 6 m/s, 12 m a second, Camera distance x0.85 and x1.15, FOV kick 5%. Pickup floor 6 art pixels, chest 14.
- Every shade and ink tone in the ramp, and the light bright tone. Every effect size, height, count and timing in section 3. The stage contrast edge cases.
- Signature trigger 25 kills in 60 ticks, the 2.0 factor, once per 1,200 ticks. Clean Sweep 100 kills in 120 ticks, once per 1,800 ticks.
- Hit-stop values other than the existing 60 ms. The 250 ms per 300 ticks and 24 tick gap. Slow motion 0.3x, 0.4 s, 1.0 s a minute.
- Flash: peak 0.35, luminance rise 0.20, 350 ms gap, 6 per 10 s, 20 per 60 s, stage luminance 0.55, 0.10, 0.12. (The 2 per second sits under the sourced limit of 3. The 16 of 66 cell window is the sourced 25% of a 10 degree field, worked for a PC monitor.)
- Enemy hit flash: 350 ms, 0.6, 24 per 100 ms. Wide bolt limits: 0.2 m, 150 ms, 1.2 m, 2 per second.
- Shake: 0.25 m, 2%, 0.3 trauma per second, 0.6 s in 3.0 s, 0.6 degrees, 12 Hz.
- World dim caps 30%, 15%, 10%, ramps 150 ms and 300 ms, 1.0 s, 2.0 s gap. Sky tint 20%. Sky flame band 25% of the dome. Colour drain 20%.
- Tablebreak: 3 faults, 70 degrees, 4, 6 and 8 art pixels, 100 ms hold, 67 ms return. Fusion Landing card sizes.
- Director cooldowns 180 and 90 ticks, hold 30 ticks. Distortion once per 600 ticks, 0.5 s.
- Screen edge 6% of H, 18% of screen, amounts 0.5 and 0.6.
- Dusk halo: 15% and 30% darkening, strength 0.3, 1.6 times radius, pools 24, 12, 6, the 3 m refresh, 1.0 screen.
- Stain map 512 x 512 over 64 m at 4 Hz. Mark lifetimes. Pool sizes. Mark radius cap 4 m.
- Phone internal size 1200 x 540. Every draw, triangle, pass, fill and millisecond figure in 6.10, including the 45 actor draws and the 2 mesh rig. Overdraw 6.0 and 12, 3.0 and 6 layers. 24 area fills. The 5% of 30 frames ladder trigger.
- Shader text under 20 kB.
- Not verified: that three.js r128 accepts the ES 3.00 shader text unchanged, takes the bit-maths Bayer on its WebGL 2 path, and can share one depth-stencil texture between two targets.
- Taste calls: that Bayer reads better than noise. That amber fire reads as fire. That blue lightning and milky ice read apart. That dark reads on Stage 3.
- Estimates, not runs: check 1 passing after step 1 alone. The 478 million px a second fixed cost. The 257 kB a frame browser upload.

---

## 12. REVIEW NOTES

Four reviews were applied: player eyes, frame time, rules and code, awe. The finalizer also re-read the source and the art book.

**Found while re-checking references (not raised by any reviewer)**
- **Element colours now follow the art book.** The draft claimed the book gives lightning #ffe14a, ice #8ae8ff and a violet dark. It does not. `look.mjs:33` and `make.mjs:59` say lightning is blue-white "not gold", ice is milky "not XP cyan", dark is black "with a moon-white edge". The whole ramp, every element table and the root stakes were redone from the book. This also removes the draft's clashes with gold pickups and violet summon outlines.
- The camera already holds the duelist's share of H constant across aspects through `fovK` (`main.js:59-62`). The pull-back cap was rewritten on that fact.
- File and line references were re-checked against `src/` and corrected throughout (for example summon hide `actors.js:311`, enemy hide `:350`, bolts `:473-477`, shake `fx.js:189`, hit-stop `main.js:397-399`, boss zoom `main.js:420-423`, near plane `main.js:57`, low-LP border `index.html:111-113` and `main.js:433`, reserved white `look.mjs:31`). `hud.js` has no 8 colour table. It has a 2 entry one at `:22`.

**Changed: rules and determinism**
- Reach is area (radius x1.58 at the cap), as the stat spec and probed sim say. Linear Reach, the shared card-roll cap and per-shot hit radius were removed. Shot merge removed.
- Tier 5 and Cap Burst trigger on five named stat ceilings, not on per-minute cap pips.
- Hit-stop and slow motion choices are made from sim ticks only and are the same for every player. Settings remove screen parts, not waits. Slow motion is kept off verified runs. All trigger windows are in ticks.
- The Fusion "first attack within 12 frames" rule was cut to a look-only line.
- Orbit bias and chain stagger were given their honesty fixes. Reaction looks follow the rules for specials.

**Changed: comfort**
- Flash gate gained 10 s and 60 s limits, element-tone flashes and a luminance cap. Impact frames are 35% strength and world-only. Enemy hit flashes, wide bolts, Burn, fire ground, light dims and edge pulses are all inside the rules now. The large-flash test was redefined and its Pass names stages, builds and settings.
- Shake travel, sustained trauma and frequency are capped. Shake stays inside the collision probe.
- Camera-side cap on tall walls. All own fills share one dither offset. The governor is two sums with painted share limits. The hatch was tamed and mostly replaced.
- Three-level alpha mask and a priority pass after the composite protect tells, pickups, the exit, enemies and the duelist from every screen effect.
- Screen edge maths fixed to 6% of H. Pull-back capped by duelist size. Pass-behind needs a view and has hysteresis. Tells have edges and a sweep for colour-blind players. Corridor fade is a ramp on the unshaken camera. No pure white in effects. The exit joined the priority list. Frames defined as 16.7 ms. Clean Sweep and distortion rate-limited. Reduce motion turns the offset pass off.

**Changed: frame time**
- Rasterised fill is now bounded (5.0 screens), and the overdraw check has a discard-off reading. Bayer is highp bit maths. Time is highp and never wrapped. Precision rules for hashes, world positions and `fwidth`. Mark pool caps. Stain map rebuilt (512, toroidal, subtractive fade, cosmetic only). Wide ground fills moved into the ground shader. Halo cover capped. Fixed pass cost stated, blit is a framebuffer blit, tile care added. Mask inverted so world materials are untouched. One blend rule. Stencil masks. Status buffers and draw counts corrected. Budget tables rebuilt with the missing rows (130 draws, 227,500 triangles). Drop ladder uses 60 Hz lock and a whole-number scale. Draw order states where discard draws go. Particle near rule and wrap upload. Free afterimages.

**Changed: awe**
- Tier 5 ground is a floor recolour. Every element has a tall Tier 5 piece. The screen-breaking Pass now tests screen-breaking. Tablebreak breaks the picture. Dusk halos give glow on every device from Tier 1. Fire and poison signatures replaced (Cinder Card, The Great Bubble). Signature trigger fires on spikes. Overtime swell is visible. Fusion Landing uses floor cards. Tiers 2 and 3 have entry beats. The seal disc is defined. Contrast is checked on all 3 stages.
- Folded in from the "best" lists: far-side walls, Reach-driven wall height, quiet eye, sky flame band, Grand Card, card-shaped shockwaves, death looks, wave of pillars, Summon Call, lightning chain-of-6 beat, hold poses, Ground Record, sound and rumble as flash overflow, the lab "Worst case" button, the hero kept in true colour inside impact frames.

**Rejected or changed in form, with the reason**
- **Halo pool 48** (awe). Rejected. Halos are the only blended layer and are capped at 1.0 screen. Pools are 24, 12 and 6.
- **Glow mask moved to a stencil bit** (awe). Rejected. Halos simply leave the alpha mask alone.
- **Fixed zoom cap 1.75** (awe) and **cap by `minShare` 0.065 and 0.08** (player eyes). Merged into one size floor: 0.075 (40 art pixels) and 0.085. Boss zoom keeps today's framing with the marker shown, so the gate boss camera is not pulled in.
- **Fragment time wrapped at 64 s with whole-number rates** (rules). Rejected for the simpler rule: highp time, never wrapped (frame time).
- **Stain at most 35% through the hatch** (rules). Replaced by the floor recolour capped at 70% with a 30 delta E tell Pass, because the hatch shimmers and the recolour cannot.
- **Solid white silhouette** (rules, offered as one of two). Kept the 50% checker, which reads as "behind", and corrected the Pass bars to what a checker can reach.
- **Enemy inverted hull on every device** (rules). Kept for flat stand-ins only. Real models use a smooth-normal rim at 0 draws, because a hull would double enemy triangles.
- **Ghost statues at 4 draws** (frame time count). One shared low mesh, 1 draw.
- **Tablebreak as a held picture with no shift** (player eyes) against **3 shifting pieces for 6 frames** (awe). Both kept: one shift, held 100 ms, eased back, no strobe, never on protected pixels, hairlines only under Reduce motion or Big moments Off.
- **Shake added before the collision probe** (player eyes). Replaced by a travel clamp of 0.25 m, which is always inside the 0.3 m probe and needs no reorder.
- **Card area rolls share the Reach cap** (draft). Dropped. It is a balance change this spec does not need.
