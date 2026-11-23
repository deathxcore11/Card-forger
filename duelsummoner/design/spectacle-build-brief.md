SPECTACLE SPEC: build brief for the PC builder

What this is. The owner asked for awe-striking, screen-breaking effects, a camera that sees through things like a pro, and all 8 elements looking great. The spec covers: growth through 5 tiers to screen size, one see-through camera system, 8 element looks plus 9 reaction looks, big moments with budgets, comfort limits, a tech plan in plain GLSL ES 3.00, 30 checks and a 15 step build order. It is final after four reviews. Nothing in it has been run. Every guess is listed in its section 11.

Where. The spec will be in the repo at duelsummoner/design/spectacle-spec.md. Read sections 2, 6 and 8 before you start. Section 12 lists what the reviews changed.

Three laws you must not break.
1. The ground footprint of every own attack is drawn at the true sim size. Everything above the ground is look only.
2. The view never feeds the sim. The replay hash is the same with every effect on, off, Soft or Low. test/purity.test.js guards it.
3. Hit-stop and slow motion are chosen from sim ticks only, never from frame time, settings or the drop ladder. Every player gets the same stops at the same ticks.

Build order. Each step ends green on its checks.

STEP 1, START NOW. See-through camera for scenery and props. View only.
- One Bayer dither chunk (bit maths, highp argument) replaces the noise in src/view/scenery.js:78 and src/view/mapMesh.js:30. Note which WebGL path your browser takes. On WebGL 1 use a 4 x 4 nearest DataTexture.
- Screen-space porthole on the map mesh replaces the 2.2 m capsule at mapMesh.js:27-31. Uniforms at src/main.js:426, from the unshaken camera and smoothed duelist.
- Vertex-shader corridor fade (a 3 m ramp in 1/8 steps) plus near fade on trees, boulders, bushes, specials and every prop. Trees: clone the canopy material per variant (still 4 draws), canopy sphere plus XZ trunk test, picked by aPart. Delete the CPU loop at scenery.js:95-107, its attributes at :92 and its call at main.js:427.
- New debug hook __ds.duelistPixels() in src/main.js returning {alone, visible, silhouette}. Rewrite test/browser-pylon.mjs as a pixel count on the same circle.
- Checks: 1, 3 (canopy, boulder, pylon, wall, pillar, cliff, statue, Witness Stone, Broker canopy rows), 5, 21.
- If the shrine rework is in src/view/props.js, land the prop part right after it.

Step 2. Duelist always visible: stencil silhouette (50% white checker), 2 tone outline (white inside, ink outside), marker. src/view/rig.js:82, 95 and the duelist block in actors.js from :249. Report how many rig meshes there are.
Step 3. Ghost, do not hide: remove the hides at src/view/actors.js:243, 311, 350. Enemies 50% with a solid edge, summons ghost with a violet outline, bosses never under 50%.
Step 4. Camera: near plane 0.15 m (main.js:57), pass-behind with the 4 ray test and hysteresis, swing before pull-in, smooth rise, skip colliders under 2.0 m in hitProp (camera.js:13-18), own-size pull-back capped by duelist size, shake clamp. It touches only the cam block of src/data/config.js: rebase on the pacing retune. Run test/browser-camera.mjs to prove boss framing is unchanged.
Step 5. FX kit and FX lab (?fxlab), ramp from the art book, noise texture, budget script, a Worst case button. Check that three r128 takes ES 3.00 text.
Step 6. GPU particles and lightning ribbon. After the feedback-feel fx.js work lands, or by the same builder.
Step 7. Own-effect material: ink rule, solid rim, camera-side cap, keyhole, two-sum governor, owner tags, sky drawn last. After the pacing retune merges (owner field in src/sim/combat.js:109-114).
Step 8. Status on bodies, fire and lightning live. After the pacing retune merges (source point at combat.js:62).
Step 9. Flash gate, shake budget, moment director. After the feedback-feel fx.js work.
Step 10. Composite path. Waits for owner decision 1.
Step 11. Settings rows. Waits for the menus work.
Step 12. Size wiring. Waits for the pacing retune. Reach is AREA on area kinds only, radius x1.58 at the cap. Shots keep the 0.95 m hit radius.
Step 13. Six unwired elements in the lab.
Step 14. Signatures, Tablebreak, Tier 5, stain map, sky. After 10 and 12.
Step 15. Device run.

Colours. The art book is law (design/art-book/make.mjs:59, look.mjs:33). Lightning is blue-white, not gold. Ice is milky, not XP cyan. Dark is black with a moon-white edge, not violet. No own effect uses pure white or hue 345 to 25. Fix src/view/fx.js:6 and src/view/hud.js:22 from the ramp in step 6.

Checks to report after each step.
- The check numbers listed for the step in section 8, each with pass or fail and the measured number.
- Draw calls and triangles from test/browser-draws.mjs before and after.
- For step 1: the pylon pixel result out of 120 steps, the worst step's percentage, and a 4x screenshot of a faded pylon and a faded canopy for the owner's taste call on Bayer against noise.
- For step 1: the count of gl.bufferData and gl.bufferSubData calls from scenery buffers in a 60 s walk. It must be 0.
- For step 2: rig mesh count and extra draws.
- For step 4: the boss framing result.
- Any spec number you had to change, and any file:line that did not match.
- Anything marked "not verified" in section 11 that you have now verified or disproved.

What not to touch.
- No sim file in steps 1 to 6. src/sim/colliders.js stays as is for good.
- No rule, cap or number in design/stat-engine/SPEC.md or src/data/tuning.js.
- src/sim/weapons.js: no per-shot scale, ever.
- The pacing retune, the shrine rework and the menus work own their files. Rebase on them, do not edit under them.
- The engine plan owns water, sky, fire and wind shaders. Use its sky. Do not write a second one.
- No image files for effects. Everything is code.
- No fractional render scale. No alpha-sorted effects. No discard in a shader that does not need it.
- Never dim, thin, shift, recolour or hide an enemy warning.
- Never write another game's name in code, comments, labels or commit text.

If a step cannot end green, stop and report the number that failed. Do not tune a Pass bar to make it pass.