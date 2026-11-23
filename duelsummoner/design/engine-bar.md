# DUEL SUMMONER engine bar

For the PC builder, and for the owner to skim. Written 23 Nov against commit `6223b69`, which includes tonight's 72 new art-book entries.

**Status of the numbers:** nothing was run. Every ms figure is an estimate for the AYN Thor at 960x540 internal. Draw calls and triangles get measured on the PC at each build step. Frame time on the Thor and on a phone: **Not assessed on device.**

## 0. Amendments, 23 Nov (these win over anything below)

This plan was written before the Carved Cards style bible was locked and before the spectacle spec. Where they differ, the bible and `spectacle-spec.md` win.

1. **Dither.** The bible allows dither only for fog, sky and see-through fades. The post pass therefore snaps to the stage palette with the Bayer offset at strength 0 on models, ground and walls. The offset stays available on sky, fog and haze only. Models keep one flat colour per face; light bands come from the palette snap.
2. **No textures on models.** Anything below that samples a model texture (dissolve "model texels") uses object-space cells of 1/16 m instead. Grey detail tiles on ground and walls stay.
3. **Colours.** Reserved colours (gold e0b765, XP cyan 46e0ff, violet b26bff, danger ff3b30, white player outline) are exact palette entries and never appear on scenery. Stage 3 has no violet scenery. Stage 2 fire is ghost-light. Element ramps are the ones in the spectacle spec.
4. **Who owns what.** This plan owns water, sky, clouds, wind, grass, terrain blending, the shadow mask, fog, the retro pipeline and crowd animation. The spectacle spec owns the see-through camera, particles, fire as an attack, element looks, flashes, shake and the composite pass. Build one of each, not two: the particle system, noise texture, Bayer function and post pass are shared.
5. **Proof overlay (new step, owed to the owner).** One button or pad chord (hold Select + press Y; three-finger tap on touch) shows a small plate for clips: enemies on screen, frames a second (median over 2 s), draw calls, triangles, internal size, and the game's download size in MB read from the build manifest. It is step 0a made presentable: same numbers, one line, readable at phone size, hidden by default, never over the HUD's health or slots. It is view only.
6. **Line numbers are stale.** They were checked at `6223b69`; the code has moved a long way since. Find each hook by name, and report any that no longer exists.
7. **Order.** Nothing here goes ahead of spectacle steps 1 to 4 or fix list part 5. Then: 0a with the proof overlay, 0b, 0c, then water, sky, wind as the first three things the owner sees.
8. **Whole-number scale.** The PC already renders at whole-number pixel scale (playtest 4 item 13). Keep that rule; the table in section 3 is the target for it.


## 1. The bar in five lines

1. **The look stays retro.** Chunky flat-shaded models, hard square pixels, a low internal resolution scaled up, each stage on its art-book palette.
2. **The engine makes everything that moves or glows**, at run time: water, sky, clouds, wind, fire, particles, summon and dissolve, shadows, haze, light shafts, ground blending. Hand-made art is kept for things with a face or a designed shape.
3. **"Hits hard" means:** a still frame reads as pixel art, and in motion nothing is frozen. The pool reflects that difficulty's sky. One gust crosses grove, grass, banner and tree shadows as a single wave. A monster rises out of a card through a burning edge.
4. **It is small.** About 45 KB of shader source and one noise texture built at start-up; no effect pictures in the download. Estimated cost with everything on: about 3 ms of the Thor's 8.3 ms.
5. **It is written once.** Plain GLSL ES 3.00 in the PC web build; the Kotlin renderer loads the same text.

## 2. What the engine makes in code from now on

| Feature | What the player sees | Technique in one line | Cost on Thor (estimate) | Size | Tiers |
|---|---|---|---|---|---|
| Retro pipeline | Even square pixels, colours that stay on the stage palette, a thin dark outline | Scene into a low-res target, one post pass (palette lookup, 4x4 dither, depth outline, haze), then a sharp upscale | 0.3 ms | 4 KB | Low: palette, dither and upscale only |
| Sky | Morning, amber dusk or eclipse; drifting stepped clouds; sun disc, corona, stars | Analytic colour on the dome from one `skyColor(dir)` function, banded in direction space | 0.2 ms | 5 KB | Low: one cloud layer, no star twinkle |
| Water | Moving waves, the sky reflected, foam at the rim, ripples where you walk, sun glitter, a lit bed under shallow water | Opaque surface: summed sines for the normal, bed pattern looked up at a wobbled spot, shore distance baked per vertex | 0.2 ms at 10% of the screen | 6 KB | Low: 2 waves, no caustics, no ripples |
| Wind and grass | Gust fronts travel across canopies, grass, reeds and banners; grass parts round the duelist | One `gust(xz)` function read in every vertex shader; grass blades are single triangles built in code | 0.5 ms | 3 KB | Low: sine-only gusts, fewer blades, no parting |
| Fire and flame | Flickering flames in three hard colour bands on braziers, torches, candles, fireballs, breath | Two crossed quads, scrolling noise shaped into a flame | 0.2 to 0.4 ms with particles (mostly overdraw) | 5 KB with particles | Low: one quad per flame |
| GPU particles | Embers, sparks, smoke, dust, shards, sand, bubbles | Stateless instanced quads: position worked out from spawn data and time; written once at spawn | (in the fire figure) | (in the fire figure) | Low: 512 live, no smoke |
| Effect shapes | Rings, sigils, danger marks, beams, star glints, bolts, ribbons | One shape shader: discs, rings, card rectangles, stars and rays drawn by distance maths, all instances in one draw | about 0.1 ms | 5 KB | Same on all |
| Summon and dissolve | The floor card opens as a portal, the monster rises through a glowing edge; a kill burns away into shards | Noise threshold with a height sweep, snapped to model texels; portal is banded polar noise in a card-shaped border | under 0.1 ms | 4 KB | Low: no portal swirl |
| Terrain blending | Ragged, natural borders between sand, road, grass and stone; no 8 m colour steps | Shader picks the material per pixel from slope, height and noise; hand-painted swatches in one texture array, no cross-fade | 0.3 ms | 3 KB | Low: no large-scale tint |
| Light | Tree shadows that sway, cloud shadows that drift, height fog, shafts in groves and crypt holes, heat shimmer over fire | Top-down shadow mask baked once per stage; fog by formula; shafts as dithered additive cards; haze as whole-pixel offsets in the post pass | 0.3 ms | 4 KB | Low: per-vertex fog only. High: adds a 512² shadow map for hero and summons |
| Crowd animation | 300 enemies walking out of step, at a toy-like 12 poses a second | Bone poses stored in a texture, read per vertex; no CPU animation | 0.4 ms | 2 KB of shader plus about 170 KB of pose data | Low: shader bob only |
| Sound in code | Wind that rises with the gusts you see, water near pools, fire crackle, eclipse drone | Small synth voices driven by view events | no GPU; under 1% of a core | 3 to 6 KB | Low: 12 voices, no reverb |

The live menu world uses all of the above and adds no technique of its own.

## 3. The retro pipeline

**Internal resolution rule.** `s = max(2, round(screenHeight / target))`, where `target` is 540 lines (High, Medium, 120 Hz) or 360 lines (Low). Internal size is `ceil(screenWidth / s)` by `ceil(screenHeight / s)`.

| Screen | High / Medium / 120 Hz | Low |
|---|---|---|
| 1920x1080 (Thor top screen, 1080-line handhelds) | 960x540, x2 | 640x360, x3 |
| 2400x1080 phone | 1200x540, x2 | 800x360, x3 |
| 1600x720 phone | 800x360, x2 | 800x360, x2 |
| 3200x1440 phone | 1067x480, x3 | 800x360, x4 |
| PC window | by the rule | by the rule |

The Thor's bottom screen gets UI only, no 3D pass.

**Palette and dither.** At stage load, code builds a 32x32x32 RGBA8 lookup texture (128 KB in memory, 0 KB on disk) from the stage palette and duel colours in `look.mjs` plus the environment-bar table, each at four light levels. The post pass adds a 4x4 Bayer offset of about one palette step, then looks the colour up with NEAREST. Duel colours are exact entries, so danger red and loot gold pass through unchanged. Sky pixels skip the dither. A strength control (0 to 1) can back the snap off.

**Upscale.** Whole-number scales use nearest. Other scales use the sharp-edge formula from the technique sheet. Never plain bilinear, never CSS; the `LOW = 2` canvas trick (`main.js:46,68`) goes.

**Shimmer rules.**
1. Patterns are snapped in world, model or direction space: water to 1/16 m, dissolve noise to model texels, terrain to swatch texels, clouds and sky bands to a direction grid. Only the Bayer dither is fixed to the screen.
2. The camera focus point snaps to the world size of one internal pixel at the hero's distance.
3. Textures use NEAREST with mipmaps; snapped UVs pass their unsnapped derivatives to `textureGrad`.
4. Nothing is drawn thinner than one internal pixel: grass blades widen with distance, small scatter fades by dither.
5. The outline threshold scales with distance.

These reduce shimmer. A perspective camera cannot be made fully free of it.

## 4. Build order for the PC web build

Line numbers were checked at `6223b69`. Steps 0a to 0c are groundwork with almost nothing new to see; without them step 1 can be neither judged nor measured. Water, sky and wind are the first three things the owner sees.

**Budget run for every step:** seeds 1, 4242, 31337 and 48879, 1920x1080 window, 60 s autorun with 300 enemies, `?dev=1`. Record draw calls, triangles, median and worst frame time. Pass: under 150 draws and 250,000 triangles. PC frame time is a tripwire only: a step that adds more than 0.5 ms on the owner's PC is looked at before the next starts. PC times are not Thor times.

| # | Step | Hook | On-screen acceptance | Budget check with `?dev=1` |
|---|---|---|---|---|
| 0a | Measuring | `devTick`, `main.js:276`. Add `renderer.info.render.calls` and `.triangles` (summed over all passes), frame ms (median and worst over 2 s), live particles, WebGL2 yes or no, internal size, profile | The overlay shows the new lines | First real baseline. The 300-enemy run has never been done; the recorded world-only figures are 27 to 41 draws and 58.3k to 62.2k triangles |
| 0b | Low-res target and upscale | `resize()` `main.js:66`; `renderer.render` `main.js:438` | Screenshots at 1920x1080 and at 1367x771: every game pixel the same size, no uneven rows. Gate seal still at least 3 px wide (env bar check 4) | +2 draws, +2 triangles |
| 0c | Noise texture, palette lookup, dither | New post material; lookup built in `syncMap()` `main.js:86` | A/B shot with strength 0 and 1. Env bar checks 14, 15 and 16 (values, enemy contrast, reserved colours) pass through the post pass | +0 draws; post taps listed |
| 1 | Water in the Stage 1 pools, then shrine water | `poolSpots` discs, `mapMesh.js:123-124`; shrine disc, `props.js:66`. Ink preset for the two summoning pools; the teal oasis preset is the same shader | 10 s clip: waves move, foam at the rim, ripples follow the duelist and up to 7 others, glitter toward the sun. The pool stays flat and walkable. The pattern does not swim when the camera moves | +1 draw for all pools; shrine +0; under 200 triangles a pool |
| 2 | Sky per difficulty and stage | Dome material `main.js:51`; fog `:50`; lights `:63-64`; difficulty in `begin()` `:139`; stage in `syncMap()` `:86`; time at `:421` | Three shots, same seed and camera: Easy, Medium, Hard. Clouds drift. A full camera turn shows no crawl. The swap blends in 250 ms (menus spec 5.2). The pool reflection changes with it. Sky share stays 25 to 40% (check 12) | +0 draws; dome stays 16x8 |
| 3 | Wind in foliage and grass | `canopyMat` and `fadeOut`, `scenery.js:76-85`; time through `userData.fade`, `main.js:421-422`. Rewritten as raw GLSL 3 materials, because `onBeforeCompile` patches do not port | Clip: a gust front crosses a grove in the wind direction; trunks stay still; grass leans, then parts round the duelist. Grass at most 0.55 m tall and none within 4 m of the camera (check 18). Occlusion check 19 passes. Reduce motion cuts sway to a quarter | +0 draws; grass triangles reported |
| 4 | Fire, embers, GPU particles, effect shapes | Pool and loop, `fx.js:21,137`; keep `burst` and `spark`, `fx.js:65,77`; flames `props.js:74`; fireballs `actors.js:114`; rings `fx.js:29`; damage numbers `fx.js:109-118` | Altar flames flicker in three bands. A 300-enemy screen clear does not hitch. Callers of `burst` are unchanged. Live count stays under the cap (1200 on handheld, feel spec 3.8). No buffer upload between spawns | Particles at most 3 draws. Damage numbers 1 draw, down from up to 64 |
| 5 | Summon and dissolve | `_enter` `actors.js:223`, `_shock` `:230`; swarm bodies `:99`; `kill` event `main.js:266` | Summon: card-bordered portal, monster rises through a violet edge. Kill: body burns away in 0.35 s or less, then shards. The edge does not swim. Three kills per 100 ms do not hitch. Sim tests in `test/` give identical results | Dying bodies use a separate discard variant: at most +1 draw per enemy kind that has any |
| 6 | Terrain blending | `Builder.mesh` `mapMesh.js:20`; `groundTex` `:103` | No straight 8 m steps; road and pool edges ragged. Neighbouring cells within 6 L* (check 14); road 15 to 25% darker (check 17). No sparkle at distance | +0 draws; one texture array |
| 7 | Crowd animation | Swarm meshes `actors.js:41,99` and their CPU matrix loop | One enemy kind (Dust Husk) on the pose texture as proof, the rest on shader bob: 300 walk out of step at 12 poses a second. The actor update takes less CPU time in a profile | Draws unchanged (one per kind) |
| 8 | Haze, shafts, shadow mask, fog | Post pass from 0c; fog function in the shared shader file, dropping the patch at `mapMesh.js:26`; shadow mask baked in `syncMap()` | Tree shadows sway with the same gust as the canopies. Cloud shadows match the clouds. Haze over a brazier moves whole pixels only. Shafts show in a grove from the default camera. Fog still capped at 55% | +1 draw (shafts). The mask costs nothing per frame |
| 9 | Live menu world | Menu overlay in `index.html`; `camHold` `main.js:429`; ambient and thread updates `:423-424`; drop the second renderer at `preview.js:5` | Camp, Duelist select and Map select show the live world under the chosen difficulty's sky (menus spec 4.1a) | At most 120 draws, 150,000 triangles, 200 particles |

Sound runs as a side track from step 4 onward; it has no GPU cost.

**Sky set for step 2** (proposed from art-book and environment-bar colours; confirm on the shots):

| Difficulty | Top | Horizon and fog | Sun | Extras |
|---|---|---|---|---|
| Easy, clear morning | `0x8fb2cc` | `0xe8d6b0` (today's values) | pale gold disc `#fff3b8` | white stepped clouds |
| Medium, amber dusk | `#3c5a73` | `#e3b23c` under a `#c4623a` band | low amber disc `#ff8a1f` | long cloud bands, thicker low fog |
| Hard, eclipse | `#0d0814` | `#2a1840` down to `#9a6a1e` | black disc, corona `#ffe9a8` and `#f2c14e` | stars, drifting embers |

Stage rule (proposal): Stage 1 shows the whole dome. Stage 2 has no dome; difficulty shows as the colour of the shafts and fog. Stage 3 is a Void dome with stars, tinted the same way.

## 5. Rules for the native GLES 3 port

So nothing is written twice:

- **One source.** Shaders are text files in `src/view/gl/`: one per effect plus one shared file (noise lookup, `skyColor`, `gust`, fog, Bayer), joined by our own include line. Kotlin does the same join.
- **Dialect.** GLSL ES 3.00. Files carry no `#version` line: three adds it (`RawShaderMaterial`, `glslVersion: THREE.GLSL3`), Kotlin prepends `#version 300 es`.
- **No three-only code:** no `onBeforeCompile`, no `#include <chunk>`, no three defines such as `USE_FOG`. Matrices, camera and instance attributes are declared by hand under the names three uses.
- **Precision.** `precision highp float; precision highp int;` in every shader, plus a precision line for `sampler3D`, `sampler2DArray` and `sampler2DShadow`. Time is wrapped on the CPU (mod 512 s); anything that would jump at the wrap takes its phase from the CPU.
- **Noise.** Only the start-up noise texture and integer hashes. No `fract(sin())`.
- **Blending.** Opaque with dither `discard`, except additive (one, one, no depth write) for embers, glows and shafts. Additive draws do not write alpha: scene alpha is the haze mask.
- **Discard** switches off early depth on Adreno. Shaders that use it are separate variants drawn after the solid ones; the 300 live bodies stay in a shader without it.
- **Instancing.** Per-instance data in vertex buffers with divisor 1, at most 16 attributes. No uniform arrays for instances.
- **Depth** is a DEPTH24 texture with NEAREST, read only by the post pass.
- **CPU builders** (noise texture, palette lookup, shadow-mask bake) use integer maths, so both builds give the same bytes; compare a checksum.
- **Check.** Every shader must compile in WebGL2 with no extension enabled. That proves the dialect, not the speed.

| Must not be used | Use instead |
|---|---|
| Compute, geometry or tessellation shaders; shader storage buffers | Vertex and fragment shaders only |
| Float colour targets | RGBA8; ripples and particles by formula, not simulation |
| `layout(binding=)`, explicit uniform locations | Names, set by each builder |
| Base-instance or indirect draws | One buffer per instanced mesh |
| `texture()` in a vertex shader | `textureLod` or `texelFetch` |
| `gl_PointSize` sprites | Instanced quads |
| `gl_FragDepth`, `textureGather`, anisotropic filtering | Not needed |
| sRGB targets or textures | Raw RGBA8 values on both builds |
| A sampler array indexed by a variable | A texture array |
| Reading depth while it is attached | Read it in the post pass only |

## 6. Quality profiles

| | Low | Medium | High | 120 Hz |
|---|---|---|---|---|
| Frame cap | 60 | 60 | 60 | 120 |
| Internal lines | 360 | 540 | 540 | 540 |
| Post pass | palette, dither | adds haze | adds outline | as Medium |
| Sky | 1 cloud layer | 3 layers, twinkle | as Medium | as Medium |
| Water | 2 waves | 4 waves, ripples | adds caustics, glitter | as Medium |
| Grass blade ceiling | 6,000 | 12,000 | 20,000 | 12,000 |
| Gusts | sine only | noise | noise, grass parts | noise |
| Live particles | 512, no smoke | 1200 | 1200 handheld, 2048 PC | 1200 |
| Shadows and fog | blobs, per-vertex fog | adds shadow mask, cloud shadows | adds 512² shadow map | as Medium |
| Shafts | off | on | on | on |
| Crowd | shader bob | pose texture | pose texture | pose texture |

Grass grows only where the map already puts clumps and meadows. The main Stage 1 ground is the sand plain, so the blade ceilings are upper limits, not targets.

**How a device picks.** On first launch the GPU name chooses from a short table: Snapdragon 8 Gen 2 class gets High, or the 120 Hz profile on a 120 Hz screen; older Adreno and current Mali get Medium; small or old GPUs get Low; unknown gets Medium. The first stage load then runs a 2 s timed pass behind the stage card and moves one profile down if it is over budget. Settings can override it.

**Automatic step-down.** Budget is 16.7 ms, or 8.3 ms at 120 Hz. If the median frame time over a rolling 2 s is over budget, drop one rung and wait 2 s before judging again:

1. Outline and haze off.
2. Grass ceiling halved, smoke off.
3. Water and clouds to their Low tier.
4. Shadow mask and shafts off.
5. Internal lines 540 to 360.
6. On the 120 Hz profile only: cap to 60 and restore rungs 1 to 5.

It steps back up one rung only at a stage load, and keeps it if the next 10 s are clean. On Android a "moderate" thermal status drops one rung at once. `?dev=1` shows the profile and the rung.

## 7. What this removes from the owner's art list

Read from `world.mjs`, `world2.mjs`, `ui.mjs`, `cast.mjs` and `audio.mjs`. "Likely" means the technique is chosen but only proven at its build step; if that step's acceptance shot fails, I ask for that one asset back.

### 7a. Engine makes it: stop making these

| Code | Name | How the engine makes it | Proven at |
|---|---|---|---|
| MT28 | Water | Water shader, teal oasis preset | step 1 |
| MT53 | Summoning pool water | Same shader, ink preset: dark, slow bands, star glints | step 1 |
| MT31 | Grass to path blend | Terrain shader draws the ragged border itself | step 6 |
| MT48 | Sand to road blend | Same | step 6 |
| MT39 | Crypt puddle stone | MT13 slate with engine puddles on top | step 6, likely |
| W411, W412, W413 | Grass tufts (short, tall, dry) | Blades built in code, coloured from the palette | step 3 |
| W516 | Water drip pool | Water puddle, ripple source, one drip particle | step 1 |
| W612 | Sand cascade | Scrolling dithered curtain, gold-sand preset; heap built in code | step 4, likely |
| WX14 | Boss ring sigil | Sigil shape in danger red-orange | step 4 |
| WX23 | Floor card (summon spot) | Not generated: it is the same picture as UI15, which stays hand-made; the engine adds the glow and the portal | step 5 |
| WX30 | Urn shards | Shard particle pool (feel spec 3.8) | step 4 |
| FX01 | Card throw trail | Ribbon behind the card, white to violet in hard bands | step 4 |
| FX02 | Hit spark | Four-point star plus shard particles, tinted by element | step 4 |
| FX03 | Crit burst | Star, red ring and shards, larger | step 4 |
| FX04 | Slash arc | Crescent shape swept in 6 steps | step 4, likely |
| FX05 | Smoke puff | Dithered noise puffs; replaces `puff.png` | step 4 |
| FX06 | Dust ring | Ground ring broken up by noise | step 4 |
| FX07 | Flame tongue | Flame shader; teal and violet by uniform | step 4 |
| FX08 | Fire breath | Flame shader along the cone plus embers | step 4 |
| FX09 | Lightning bolt | Jagged ribbon re-drawn 12 times a second | step 4, likely |
| FX10 | Ice burst | Instanced crystal shards plus sparkles | step 4 |
| FX11 | Frozen crust | A frozen state in the body shader plus a few crystal chunks | step 5, likely |
| FX12 | Poison bubbles | Circle particles rising, pop ring | step 4 |
| FX13 | Wind streaks | Three curved ribbons | step 4 |
| FX14 | Earth chunks | Rock-coloured shard particles with gravity | step 4 |
| FX15 | Light rays | Ray shape, slowly turning | step 4 |
| FX17 | Summon circle | Sigil shape: rings, eight card rectangles, card-outline star | step 5 |
| FX18 | Fusion vortex | Polar noise spiral, card-shaped particles, flash | step 5 |
| FX19 | Level-up burst | Light column, base ring, rising star and card particles | step 4 |
| FX20 | Death crumble | Body dissolve plus cube shards | step 5 |
| FX21 | Card shatter | Card cut into triangle shards plus sparkles | step 5 |
| FX22 | Shockwave ring | Ring shape | step 4 |
| FX23 | Danger telegraphs | Circle, line, cone and 3x3 slabs as shapes in `#ff3b30`; the fill follows the tell timer | step 4 |
| FX26 | Coin sparkle | Four-point star, scaled | step 4 |
| FX27 | Sky beam | Beam quad with a banded fade | step 4 |
| FX28 | Seal crack | Cracks grown from cell noise on the chest's own seal plate, then shards | step 5, likely |
| FX29 | Sand splash | Gold particles in a crown | step 4 |
| FX30 | Respawn blink | Ring sweeping up plus a reverse dissolve on the duelist | step 5 |
| FX31 | Ley Thread | Ribbon waved by the shared gust | step 4 |
| FX32 | Chest light pillar | Light column with rising square sparkles | step 4 |
| FX33 | Ace arrival ring | Ring with four star points | step 4 |
| FX34 | Seal flashes (four marks) | Four shapes: disc with card cut-out, notched seal with rays, disc with flame cut-out, card-corner glint | step 4 |
| FX35 | Shrine geyser | Water particles and a column, mint preset | step 4, likely |
| FX36 | Chest reveal burst | Ray-fan shader drawn in the game canvas behind the chest picture | step 4, likely |
| FX37 | Seal Bomb ring | Ring with eight seal discs | step 4 |
| FX38 | Eclipse ring | Corona drawn by the sky shader | step 2 |
| KA03 | Main menu backdrop | Live Camp scene (menus spec 4.1a) | step 9 |
| KA04 | Duelist select backdrop | Live world behind the plinth (menus spec 4.1a) | step 9 |

Already made in code before tonight, unchanged: PK01, UI21, UI22, UI23.

### 7b. Decal sheets: still made, with fewer live cells

Each sheet is one picture, so it is still made. These cells are no longer used; do not redo a sheet because one of them came out badly.

| Sheet | Cells the engine now makes |
|---|---|
| DC01 Surface Ruins | Grass tuft, Sand drift |
| DC02 Catacombs | Puddle |
| DC03 Vault | Sand drift, Gold dust, Scorch mark |
| DC04 Roads | Scuffed dirt. The sheet's other job, breaking the road edge, is done by step 6, so make DC04 last |

### 7c. Still hand-made, but make them differently

| Code | Change |
|---|---|
| W127, W204, W210, W442, W505, W510, W511, W607, WX06, WX10 | Make them unlit: bowl, wick or grate empty. The engine adds the flame. One already made with a flame is kept; I will try to cut the flame off in my weld step (not checked) |
| W135, W217 | Rim stones only, no water surface |
| W609 | Fountain dry; the gold stream is the water shader with gold colours |
| FX16 Curse wisp | The engine makes the smoke. The tiny skull is a drawn face: make it as one small still picture, not an 8-frame sheet |

Glow dots, drifting dust and sparkles mentioned on any model card can be left off the model.

### 7d. Checked and still hand-made

| Code | Why |
|---|---|
| FX24 Ground crack | A jagged crack reads better painted. The engine adds the glow and the opening sweep |
| FX25 Chain link line | A picture of an object, not an effect |
| MT01 to MT27, MT29, MT30, MT32 to MT38, MT40 to MT47, MT49, MT52 | Painted surfaces. The engine chooses, tints and blends them; it does not paint them |
| KA18 Camp terrace | The Thor's bottom screen gets no 3D pass |
| KA19 Deck Box backdrop | An interior that does not exist as a level |
| KA09, KA10 Results backdrops | Kept for now. They could become the frozen last frame of the run; that is the owner's call |
| KA01, KA02, KA05 to KA08, KA11 to KA17 | Key art, logo, map cards, loading art, parchment |
| UI25 Low LP frame, UI29 Loading seal | Designed frame pieces. The engine adds the edge darkening under UI25 |
| All SF and MU codes | No sound comes off the list tonight. Code sound is an added layer (wind, water, fire crackle, drone) and is unproven. `feedback-feel.md` 3.6 already defines the XP and coin notes (SF080, SF081) as synthesised; that spec decides those two |

## 8. What stays hand-made and why

| What | Why |
|---|---|
| Duelists, NPCs, summons, Fusions, Gods, enemies, bosses, ambient creatures (`cast.mjs`, WA01 to WA12) | Faces and silhouettes. The game's character is in these |
| Props, trees, rocks, ruins, landmarks, interactables, pickups, Regalia | Designed shapes. The engine moves them (sway, bob, glints) but does not design them |
| Material swatches | A painted 64x64 tile carries the hand-made look |
| Icons, UI kit, card art, portraits, key art, logo, map cards | Designed pictures with meaning |
| Music and the listed sound effects | Character and material that code synthesis does not give |

The line: if a thing's job is to move or glow, the engine makes it. If its job is to be recognised, it is hand-made.

## 9. Risks, and what is Not assessed until it runs on the Thor and a phone

**Not assessed on device:** every ms figure in this file; whether 120 Hz holds for a full 8-minute stage once the Thor warms up; the cost of `discard` on Adreno; overdraw from flames, smoke and shafts; vertex texture reads on older Mali (wind, crowd); memory use.

**Not measured anywhere yet:** a 300-enemy frame, and whether the owner's PC gives a WebGL2 context, which the plan needs. Step 0a does both.

**Design risks:**
- The palette snap may flatten lighting or break the contrast checks. It has a strength control, and step 0c re-runs checks 14 to 16.
- Dusk and eclipse change the fog colour. Check 14 (horizon at least 12 L* above the ground) needs per-difficulty values, and enemy contrast must be re-checked under each sky.
- Triangles: 20,000 blades plus a full swarm at 450 triangles each comes close to 250,000. The grass ceiling is the lever.
- Eight items in 7a are marked "likely".

**Earlier rules this plan changes; the owner should confirm each:**

| Earlier rule | This plan |
|---|---|
| `feedback-feel.md` 3.8: no fullscreen pass on handheld | One post pass, with no blur and no bloom |
| `environment-bar.md`: no new transparent surfaces | Additive-only embers, glows and shafts, which need no sorting |
| `feedback-feel.md` 3.8: at most 6 glows on screen | Shafts either count toward the 6 or the limit is widened |
| `environment-bar.md`: about 640x360 for the native renderer | 540 lines on Medium and above, 360 on Low |
| `environment-bar.md`: 60 fps cap on 120 Hz panels | The Thor starts at 120 with automatic step-down |
| `environment-bar.md`: world at 60,000 triangles (marked a guess there) | Needs room for grass; re-set after step 3 is measured |
