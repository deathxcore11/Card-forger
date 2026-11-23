# Playtest 4 review (23 Nov, owner's 116 s run of the current build)

Source: `20261123-0157-09.3767538.mp4` (115.7 s, 1716x1206, 30 fps, about 125% display scale) checked against the code snapshot stamped 01:54 UTC. Paths are relative to the repo root.

Nothing here was run in a browser. Causes come from reading the code against frames, and fix numbers are starting values to tune. Two causes were reproduced headless: the Kael rig fault (item 1) and the enemy ramp routing (item 14).

## 1. Verdict

- **Improved:** the "small environment" complaint is answered. The world reads large in every wide shot, the hero holds 12-13% of screen height, Kael and the three summons are real models, and nothing fell through the floor. I had no playtest 3 write-up, so this is measured against his three complaints.
- **Cause 1, nothing guards the space near the camera.** Damage digits fill up to 62% of screen height, red guide ribbons become screen-edge slabs, and the camera cuts into boulders, stumps and canopies. This is most of "glitchy" and "messy".
- **Cause 2, the hero breaks on every card throw.** Kael's torso folds and his head flips upside-down, every 0.8 s for the whole run.
- **Cause 3, the reward loop and its text are broken.** Six level-up panels landed in 16 s, no chest was affordable in 1:48, and the "E:" prompt is hidden behind the slot bar.
- **Bottom line:** it does not meet the commercial bar. Items 1-7 are bugs, not missing art, and the 3D view at 1/2.5 resolution makes everything else look worse.

## 2. Run facts

The stage clock counts down from 7:00, so run time is 7:00 minus the clock. The recording starts 0:27 into the run, already at level 2.

| Video s | Clock (run time) | Level | LP | Kills | Coins | Event |
|---|---|---|---|---|---|---|
| 0.0 | 6:33 (0:27) | 2, 0/4 | 100/100 | 10 | 0 | Recording starts. Ember Wyvern L2 fielded. A bush covers the bottom-right. |
| 2.0-2.4 | 6:31 (0:29) | 2 | 92, then 84 | 11-12 | 0 | Two hits 0.4 s apart; the whole frame tints red twice. |
| 9.2-11.7 | 6:24 (0:36) | 2 to 3 | 84 | 19 | 0 | LEVEL UP 3, takes Cinder Hatchling. |
| 13.6-16.8 | 6:22 (0:38) | 3 | 84 | 20-22 | 0 | Chest 1 refused: costs 30, has 0. Prompt hidden. |
| 21.5 | 6:15 (0:45) | 3 | 84 | 26 | 0 | Camera snaps to close-up at a cliff base. |
| 26.8-29.5 | 6:09 (0:51) | 3 | 84 | 33-37 | 0 | Chest 2 refused, standing inside the violet gate column. |
| 29.7-33.7 | 6:07 (0:53) | 3 to 4 | 84 | 37 | 0 to 1 | LEVEL UP 4, takes Rune Apprentice. |
| 36.0-41.2 | 6:04 (0:56) | 4 | 84 | 45-48 | 2 | Shrine hold, 5 s, no visible progress. |
| 41.2-45.2 | 5:59 (1:01) | 4 | 84 | 51 | 2 | Blessing offer, takes Haste. |
| 45.2-57.8 | 5:59-5:46 | 4, stuck at 4/5 | 84 | 52 to 88 | 2 | Stands still 12 s. Summons make 36 kills; 30+ gems lie out of reach. |
| 58.0-74.1 | 5:46-5:42 (1:14-1:18) | 5 to 10 | 84, 71, 86, then 120/120 | 88 to 103 | 2 to 8 | Six level-up panels in 16 s. The clock moves 4 s. |
| 69.9, 76.3-78.0 | 5:43, 5:40 | 9, 10 | 86, 120 | 102-108 | 8 | Camera jams against a stump, then a boulder for 1.7 s. Kael's body folds in close-up. |
| 80.1-81.9 | 5:37 (1:23) | 10 to 11 | 120 to 140/140 | 116 | 8 | LEVEL UP 11, Heart of the Cards. |
| 82.8-86.6 | 5:36-5:32 | 11 | 140 | 116-123 | 8 | "An Ace approaches" in small text, easy to miss. |
| 97.2-99.3 | 5:22 (1:38) | 11 to 12 | 140 | 146 | 10 | LEVEL UP 12, Rune Apprentice to L4. |
| 105.6 | 5:16 (1:44) | 12 | 140 | about 160 | 11 | Chest 3 refused: costs 30, has 11. |
| 106.4 | 5:15 (1:45) | 12 | 140 | about 162 | 11 | Grave Herald arrives; banner and name plate together. |
| 109.8 | 5:11 (1:49) | 12, 6/13 | 140/140 | 168 | 11 | Last gameplay frame. |
| 110.0-115.7 | frozen | | | | | Pause, END RUN, results ("Time 1:48 · Level 12", 17 chips + 15 quest), main menu drawn over the run HUD. |

**Pacing against the owner's target (about 5 picks a minute, first level 0:50-1:30)**

| Measure | Observed | Target |
|---|---|---|
| First level-up | Before 0:27; level 3 at 0:36 | 0:50-1:30 |
| Level-ups, whole run | 11 in 1:48, 6.1 a minute | About 3-3.5 a minute, the rest from chests and shrines |
| All picks, whole run | 12 (11 levels + 1 shrine), 6.7 a minute | About 5 a minute |
| All picks, recorded 82 s of run time | 11, 8.0 a minute | About 5 a minute |
| Spread | Gaps of 17 s and 21 s, then six in 4 s of stage clock | Even |
| Time inside pick panels | 25.8 s of 110 s (23%); level-ups alone 20% | 10% or less |
| Chests opened | 0 of 3 tries; 11 coins at 1:44 | First paid chest before 1:45 |
| Pressure | 29 damage taken in 1:48; 12 s standing still untouched | Not set |

So picks arrive at 1.3-1.6 times the target, the first level is at least twice too early, and every pick came from XP. `src/data/cards.js:87` still targets level 8 at 60 s, and `design/run-structure.md` still says 7.5 picks a minute. Both need updating to the owner's answer.

## 3. Ranked fix list

### P0

**1. Kael's upper body folds and his head flips upside-down on every throw**
- **Seen:** 76.67-76.97 and 77.77-77.87 in close-up: face pointing straight up, hair crown at the bottom, head at chest level. At normal camera (65.1-66.6) the head top flickers between hair and skin.
- **Cause:** `src/view/procclips.js:8` assumes spine order Spine, Spine01, Spine02; Kael's GLB is the reverse.
  - The `stand` pose (`procclips.js:75`, applied at `:61`) therefore flips the top spine bone about 164 degrees, and every code-keyed clip starts and ends on it.
  - The crossfades at `src/view/rig.js:142-143` whip the head through face-up.
  - `rig.js:148` never fades the finished one-shot, so it blends about 50/50 with the run.
- **Fix:** in `boneMap` (`procclips.js:16-21`), sort the three spine bones by hierarchy depth. At `rig.js:148`, fade `curAct` when locomotion resumes. Add a head-up guard to `test/browser-rig.mjs`.
- **Headless result:** head tilt during a running throw goes from 165 degrees to never over 60.
- **Check:** against a boulder at 60 fps with auto-throws, a dash, a slide and a ledge drop, the hair crown is always the top of the head and the head never dips when a card leaves.
- **Docs:** none cover it. `design/kael-motion-prompts.md` says the clips work on Kael's bone names; correct it.

**2. Damage numbers fill the screen, pin to the edges and float off their targets**
- **Seen:** about 40 times. A 1-3 damage hit prints a blocky digit 15-62% of screen height at 11% or 89% across (4.6, 26.0, 36.4-38.2, 74.2, 102.0). Others sit on one line at the hero's row and stay put while the camera turns (27.6-28.8, 76.8). Neighbours read as "42" (9.0-12.4) and "33" (65.8). A yellow "5" rides on the hero for 0.9 s at 108.1.
- **Cause:**
  - `src/view/fx.js:173` clamps off-screen numbers onto the screen but keeps their depth, and `:171-172` sets a world-size floor.
  - `src/main.js:215` spawns every number at a fixed 1.7 m, even on ledges.
  - Enemies hidden near the camera (`src/view/actors.js:240-246`) still emit numbers.
  - `fx.js:110-111` spreads numbers sideways into each other, `:97-100` merges by position only, and `:7, :122` allow 64 live.
- **Fix:**
  1. Delete the clamp.
  2. Use a fixed on-screen size (`sizeAttenuation: false`, digit about 24 px at 1080p, crit 1.3x).
  3. Hide a number that is under 3 m deep, off-screen or under a HUD panel.
  4. Spawn at the target's real height.
  5. Put the enemy index in the hit event (`src/sim/combat.js:40`) and merge per target for 400 ms.
  6. Stack vertically, cap at 16 live, and make normal hits white.
- **Check:** circling through the horde for 2 minutes at 60 fps:
  - no digit is taller than 4% of screen height, and all are the same size at any distance;
  - each appears within 40 px of its target's head and moves with the world;
  - no two touch, and none sits over the hero or a HUD panel.
- **Docs:** `reference-run-1123.md:261` lists this as a do-not-repeat. `feedback-feel.md:82, 88, 98` has the cap of 16 and the 60-enemy rule but no size cap or edge rule; add them.

**3. Camera cuts to an extreme close-up beside boulders, stumps and cliffs**
- **Seen:** 21.47, 69.93-70.17 (two cuts in 0.25 s), 76.27-78.0 (jammed 1.7 s on a grey boulder face), 86.20, 95.23-95.43 (four cuts in 0.3 s), 104.27. The hero jumps from 12% to 40-60% of screen height in one frame, often seen from straight above.
- **Cause:**
  - `src/view/camera.js:43` pulls in instantly with no smoothing.
  - `camera.js:14` inflates props by 0.85 m against a 0.6 m player, and the pivot is pushed 0.6 m to the shoulder (`:33`). Touching a prop reads as fully blocked, so the arm drops to the 1.4 m minimum (`:42`, `src/data/config.js:18`).
  - The loop at `camera.js:50-58` then tips the view overhead.
- **Fix:**
  1. Remove props from the boom test; they fade instead (item 4).
  2. March terrain from the hero's unlagged centre, skipping the first 1.0 m.
  3. Smooth the boom both ways: about 0.08 s inward, and outward after 0.25 s clear.
  4. Lift the arm angle before shortening it.
  5. Raise `minDist` to 3.0 and cap the extra down-tilt at 20 degrees.
- **Check:** hug the boulder, the stump and the cliff base at 60 fps.
  - The hero stays at 10-22% of screen height and never changes by more than 15% between frames.
  - No prop covers more than 25% of the frame.
  - Add the 3.0 m and 1.5 m-per-frame assertions to `test/browser-camera.mjs`.
- **Docs:** `environment-bar.md:38` and item 21 specify fading, not pulling in. Boom smoothing is in no doc; add it.

**4. Trees and boulders block the view: canopy fly-through, static-like fade, solid trunk**
- **Seen:**
  - 7.4-8.8: a canopy covers 40-60% of the screen and hides the hero, with no fade.
  - 16.6-17.4: the fade is coarse black dots over the top half, and the trunk stays a solid bar.
  - 76.3: a boulder face fills 60% of the frame.
- **Cause:**
  - The fade volume is a sphere smaller than the drawn canopy (`src/view/scenery.js:100, :109-111`), tested only on the exact camera-to-hero line (`:104, :110`).
  - The fade is a noise `discard` (`:78`) at half resolution, with only 10% kept (`:112`).
  - The trunk test is too narrow (`:108`), and boulders have no fade (`:81`).
  - `test/browser-fade.mjs` reads an attribute that no longer exists, so it reports nothing.
- **Fix:**
  1. Use ellipsoids that contain the canopy, grown 2.5 m for the line test.
  2. Hide a canopy fully when the camera is inside it.
  3. Drop the stipple: collapse faded parts in the opaque mesh and draw them in a small alpha-blended ghost mesh at 30%. Interim: shrink the canopy to nothing over 0.15 s.
  4. Give trunks a closed-form axis test, and boulders of scale 2 or more the same fade.
  5. Repair the test.
- **Check:** on the 7-9 s ramp and the 16-17 s path:
  - no opaque canopy covers over 20% of the frame;
  - no dot pattern shows at 4x zoom;
  - a trunk within 2 m of the camera is see-through within 0.2 s;
  - the hero shows through the big boulder and is at least 60% visible in 97% of frames.
- **Docs:** `environment-bar.md` item 21 and check 19 cover the 30% target and rock fade. Check 19 says to judge the dither by eye: this recording is that check and it fails. Change the doc to "no stipple".

**5. Ley Threads draw as wide opaque red slabs and zigzags**
- **Seen:** 3.2-3.6, 7.6-19.0, 38.0-40.2, 65.4-66.4, 75.6, 83-86, 93.4-95.5, 97-104.
  - Crimson ribbons 4-8% of screen height, with quads up to 285 px near the lens.
  - Vertical red walls where a ribbon crosses a ledge.
  - One tints the hero solid red at 95.4 with LP unchanged.
  - Reviewers mistook them for enemy fire.
- **Cause:** in `src/view/threads.js`:
  - `:13` has no additive blending, and heads are fully opaque (`:65-67`).
  - `:53-54` makes ribbons 0.5-0.76 m wide.
  - `:49-51` spawns them 2-12 m behind the hero, where the camera sits.
  - `:40` takes raw ground height per point, so they climb pylons.
  - `:31` spawns one every 0.22 s near the gate.
  - `:12` uses the red reserved for enemy danger.
- **Fix:**
  1. Additive blending, alpha at most 0.6.
  2. Half-width 0.05 / 0.07 m, at most 4 render px on screen.
  3. Spawn only 4-18 m ahead toward the gate, never within 2 m sideways of the hero.
  4. Fade by `smoothstep(4, 9, distance to camera)`.
  5. Low-pass the height, and end a thread at a step over 1.5 m.
  6. Shorten the trail to under 5 m.
  7. Extend `test/browser-threads.mjs` with a coverage check.
- **Check:** standing 30 m from the gate for 30 s, sampled at 10 Hz:
  - thread pixels are at most 0.5% of the frame;
  - no thread is wider than 4 render px, within 4 m of the camera, or across the hero;
  - no vertical or Z-shaped ribbon appears at a ledge.
- **Docs:** `run-recordings-1122.md:80, :86, :90` already specify this ("thin… never a solid line", additive). The build does not meet it.

**6. The "E:" prompt and the shrine countdown are hidden behind the slot bar**
- **Seen:** 13.4-16.8, 26.8-29.5 and 105.2-107.8: "E: open the Card Chest (30 coins, you have 0)" shows only the top pixels of its letters. At 36.0-41.2 "Hold the ring: 3.6 / 5 s" is hidden the same way.
- **Cause:** `index.html:37` fixes `#prompt` at `bottom:176px`. The wide-window rules at `:146-147` raise the slot grid to 196-212 px, and `#zones` (`:191`) paints over it. `#fusion` (`:38`) has the same fault.
- **Fix:** put `#fusion`, `#prompt` and `#zones` in one bottom-anchored flex column with an 8-10 px gap. Give the prompt a plate (`#0d0810e0`, 1 px `#ffe08a` border, no text outline).
- **Check:** at 1373x1045, 1920x1080 and 1280x720, next to a chest and with a Fusion ready, the whole line is readable and at least 8 px above the slots.
- **Docs:** none. It is a regression from the text-floor media queries.

**7. Level-ups arrive in a flood, and pacing misses the owner's target**
- **Seen:** 58.0-74.1: six full-screen panels with 0.4-1.8 s of play between them, 11.5 s of menu against 4.6 s of play. The set-up is at 45-57.8: 36 summon kills while the XP readout sticks at 4/5 and gems lie in a ring just out of reach.
- **Cause:**
  - The XP curve is far flatter than documented (`src/data/cards.js:4`; levels 5-10 cost 5.2-9.8 XP), with the early slow-down off (`early: 0`, `src/sim/field.js:13-14`).
  - The magnet is 5 m, hero-only (`src/data/config.js:29`), and gems outside it never move (`src/sim/weapons.js:130-138`). Summons kill at 14-26 m (`src/sim/combat.js:71`).
  - `src/sim/game.js:203` opens the next offer on the first tick after one closes.
- **Fix:**
  1. An XP gem older than 1.5 s flies to the hero from any distance. Merge gems dropped within 1.2 m. Coins and hearts keep the range rule.
  2. Restore the documented curve (`4 + 2L + 0.15L²`, `run-structure.md:226`). This run's XP would then give about 3.3 level-ups a minute.
  3. That curve alone still puts the first level near 0:27 at today's kill rate, by my arithmetic. Use the `early` multiplier or the slower first-minute spawn rate (`reference-run-1123.md:304`) to reach 0:50-1:30.
  4. Hold 3 s of play between panels from separate gains. When several levels are pending, chain them inside one dim ("1 of 2").
  5. Update `TARGETS.levelAt` (`cards.js:87`) and verify with `test/run-sim.mjs` on 20 seeds.
- **Check:** on 3 seeds:
  - the first level-up falls between 0:50 and 1:30;
  - picks of all kinds are 4-6 a minute over the first 3 minutes;
  - never more than 2 panels in any 10 s, with no gameplay frame between chained panels;
  - panel time is 10% or less of the first 2 minutes;
  - standing still 15 s while summons kill 30+, no more than 8 gems rest in view.
- **Docs:** `feedback-feel.md` §3.3 specifies the magnet flight but keeps 5 m. `reference-run-1123.md:331` covers only two back-to-back panels.

### P1

**8. The chest loop is dead: no price shown, none affordable**
- **Seen:** three refusals (13.6, 26.8, 105.6). The tag reads "Card Chest: coins" with no number. Coins were 0, 8 and 11 at 0:51, 1:23 and 1:44 against a price of 30.
- **Cause:** `src/main.js:316` hard-codes the word "coins", though `chestPrice(g)` exists at `src/sim/world.js:93-98`. Income was never retuned: `coinChance: 1/6` (`src/data/waves.js:27`), one coin per drop (`src/sim/combat.js:73`), behind the same 5 m magnet.
- **Fix:** print the price on the tag (gold when affordable, dimmed with "need 19 more" when not). Add a "CHEST 30" line under COINS (`src/view/hud.js:59`). Retune income, not price: start at `coinChance` 1/3 and 2 coins a pickup.
- **Check:**
  - every paid chest shows a number from 30 m, matching the prompt;
  - on three watched runs COINS reaches 30 before 0:45, and a chest is opened before the Grave Herald;
  - after one open, all tags read 72.
- **Docs:** already asked for in `reference-run-1123.md:169, :255, :356-357` and `generator-spec.md:524`.

**9. The run HUD and frozen world show under every menu**
- **Seen:** 110-115.7. The main menu is drawn over the dead run, with "Star Chips 32" printed on top of "STAGE 1 5:11". Pause, results and every offer show ghost panels.
- **Cause:** `setMode` (`src/main.js:129-135`) toggles only the screens, which are 85% opaque (`index.html:42-43`). `.chipsTop` shares a corner with `#topright` (`index.html:121`).
- **Fix:** set `document.body.dataset.mode` in `setMode` and hide `.hud`, `#tags` and `#minimap` outside play (keep `#topleft` and `#zones` on offers). Make the start, menu and results screens opaque.
- **Check:** after pause, end run and main menu, no health bar, stage panel, minimap, slots or monsters are visible. Resume restores the HUD in the same frame.
- **Docs:** `menus-spec.md:1005` covers only the pause backdrop.

**10. Centre banners read as debug text**
- **Seen:**
  - No backing plate over sky and cliffs.
  - "Level 5" to "Level 10" on screen almost continuously, 58-74.
  - A ghost "Level N" above the LEVEL UP title (29.7, 70.7, 80.1, 97.2).
  - "Grave Herald in 5 seconds." static for 3.4 s (101.4-104.8).
  - Banner and name plate together at 106.4.
  - The chest refusal overwritten after 1 s.
- **Cause:** `#banner` has no background (`index.html:35`). `src/view/hud.js:123-125` is one slot on a 3.2 s wall-clock timer with no queue. `src/main.js:214` fires `showBanner('Level ' + a)`. `src/sim/stages.js:80` uses fixed text. `src/sim/specials.js:44` duplicates the plate (`main.js:259`).
- **Fix:**
  1. Delete the level banner.
  2. Add the lane C queue, and clear the banner on any non-play mode.
  3. Add a plate and `text-wrap:balance`.
  4. Use a live countdown or no number.
  5. Skip "approaches" when the plate fires.
  6. Move the chest refusal to a red pulse on the prompt plate.
- **Check:** five level-ups show no mid-screen "Level" text. Every banner reads over sky. Two banners 200 ms apart show in turn. One countdown ticks each second.
- **Docs:** `feedback-feel.md:42, :84, :253` already remove the level banner and specify the queue. The plate is in no doc.

**11. World tags draw through walls, over HUD panels and the hero, and get cut at the edge**
- **Seen:**
  - 8.2: a tag on a tree with no chest visible.
  - 19.8: a tag on the gate wall.
  - 50.0: on the hero's head.
  - 60.0: on the slots.
  - 77.2: cut to "Card Che" at the right edge.
  - 92.0: only "done" visible at the left edge.
  - "Shrine of Tribute: done" follows the spent shrine throughout.
- **Cause:** `drawTags` (`src/main.js:321-329`) only rejects points behind the camera. `#tags` sits above every panel (`index.html:72`). Spent landmarks keep a tag by design (`main.js:306, :313`).
- **Fix:** ray-test against colliders (dim or hide). Clamp tags 12 px inside the screen. Hide a tag that intersects a HUD rectangle or the hero. Drop tags for spent landmarks. Lower `#tags` below the panels.
- **Check:** circling a chest behind the gate tower and panning it across every edge and panel, the tag is whole or absent, never on a panel. A used shrine shows no tag.
- **Docs:** `feedback-feel.md:178` says a used shrine is shown in the world, with no label.

**12. The gate seal swallows the hero, and a chest spawned inside it**
- **Seen:** 23.0-28.6: a dark violet column fills half the width, with hero and summons near-black inside it and a Card Chest at its corner. At 47.8-58.0 it reads as a missing-texture wall.
- **Cause:** `src/view/gateseal.js:11-17` is a 4.5 x 90 m box from y = 0 at 0.85 opacity with no near-range rule. `take` in `src/gen/generate.js:228-237` keeps encounters away from spawn but not from the gate.
- **Fix:** keep encounters 12 m from the gate. Fade the core to about 0.2-0.3 opacity inside 30-10 m, and dissolve the bottom 10 m.
- **Check:** on 3 seeds no encounter is within 12 m of the gate. Walking through the gate, hero and monsters keep their colours. From spawn the seal is unchanged.
- **Docs:** `environment-bar.md:90` specifies the column as built; add the close-range rule (precedent at `feedback-feel.md:175`).

**13. The 3D view renders at 1/2.5 resolution with uneven blocks**
- **Seen:** the whole clip. Every 3D edge is a staircase of alternating 2 and 3 px blocks beside sharp HUD text, about 686x482 rendered pixels. At 77.0-77.4 the sand shows 40 px squares.
- **Cause:** `LOW = 2` with `setPixelRatio(1)` (`src/main.js:43, :65`) ignores `devicePixelRatio`, with `antialias: false` (`:42`) and `image-rendering:pixelated` (`index.html:12`). The ground texture uses nearest filtering (`src/view/mapMesh.js:104`).
- **Fix:** read `host.quality.renderScale` (`src/core/host.js:47`, currently unused), honour `devicePixelRatio`, and make any block a whole number of device pixels. Set `gtex.magFilter` to linear.
- **Recommended default:** full resolution with antialiasing on desktop, chunky as a setting.
- **Check:** a 400% zoom shows steps of 1 device pixel (or even whole-number blocks if chunky is kept). Ground close-ups have no squares. 60 fps holds with 300 enemies.
- **Docs:** `environment-bar.md:10, :175` endorse low resolution for a 400 px phone only. Nothing covers desktop.

**14. Enemies cannot route up ramps, funnel to one lip, and overlap**
- **Seen:** 47.8-60.0: 2-4 husks at one terrain lip for 10 s. At 29.4 and 60.0 clumps cut through each other.
- **Cause:** the flow field allows a 0.72 m step between 2 m cells (`src/sim/flow.js:7, :53, :73`), while walkers use 0.55 m on 1 m samples (`src/sim/terrain.js:34-45`). Every 1:2 ramp reads as a wall. Separation is one constant, 1.3 m (`src/data/config.js:23`), narrower than the 1.5-2.1 m bodies.
- **Fix:**
  1. Compute a per-edge pass mask from the 1 m lanes.
  2. Reject spawn spots that have no route.
  3. Relocate an enemy stuck for 2 s.
  4. Keep each enemy's lateral offset when steering.
  5. Use per-kind body widths for separation.
  6. Use `'YXZ'` order for the hit tilt.
- **Headless result (seeds 1-12):** plateau ramps routable go from 0 of 129 to 111 of 129; stalled enemies on a 3 m plateau go from 22-35 to 0. Golden replays need re-recording.
- **Check:** standing mid-plateau for 30 s, enemies come up both ramps and none press on the cliff base. A dev counter of stalled enemies reads 0 for 95% of a 2-minute run. Overlapping pairs read 0 in 95% of frames.
- **Docs:** `generator-spec.md:111-112` already states the sub-step rule.

**15. Rune Apprentice: bolts look like debug lines, effects start 2 m above it, staff is oversized**
- **Seen:**
  - 34.8-38.8 and 78-109: hard cyan polylines run off the screen edges, starting in mid-air beside a floating purple ring.
  - The staff is 2.1-2.4x the figure's height, and snaps between upright and diagonal in one frame.
- **Cause:**
  - Bolts are 0.07 m unlit boxes in three straight segments (`src/view/actors.js:135, :469-475`).
  - The sim keeps every summon hovering 2.2 m up (`src/sim/monsters.js:22, :92-93`) while walkers are drawn on the ground (`actors.js:288`).
  - The staff is a fixed 1.6 m (`actors.js:168`), with an instant tilt (`:305`).
- **Fix:**
  1. Start bolts at the staff crystal.
  2. Draw a tapered additive ribbon that fades in 0.15 s, with a flash at the target.
  3. Skip targets off-screen.
  4. Put the cast ring on the ground.
  5. Scale the staff to 1.15x body height and ease the tilt.
- **Check:** every bolt starts at the crystal, ends on a visible enemy, touches no screen edge and is gone in 10 frames. The crystal top is at most 1.3x the figure's height.
- **Docs:** none; the art book replaces this monster later.

**16. Projectiles are flat single-colour shapes, and the card spawns inside the hero**
- **Seen:** an orange hexagon up to 125 px (12.0, 54.2, 78-108) with a brown ring splash. A blank cream rectangle 300 px wide over the hero at 76.33, cutting through his torso at 77.6.
- **Cause:** unlit icosahedron and box stand-ins (`src/view/actors.js:113-115`). The splash is normal-blended (`actors.js:127, :130, :480`). The card spawns at body centre (`src/sim/monsters.js:40, :43`). Nothing hides shots near the camera.
- **Fix:**
  1. Fireball: lit core plus additive glow in amber, with a spark trail.
  2. Landing: additive ring plus embers.
  3. Card: 0.35 x 0.5 quad with card-back art, drawn from the hand bone for the first 0.08 s.
  4. Hide any projectile within 2.5 m of the camera.
- **Check:** no projectile is larger than 60 px on a 1144-wide frame. No cream quad overlaps the hero. No player shot is in hue 345-25 degrees.
- **Docs:** `stand-ins.md` lists them as waiting for art. `reference-run-1123.md:306, :379` bans red and orange-red on player effects.

**17. Taking a hit tints the whole frame and strobes**
- **Seen:** 2.0 and 2.4, and 65.3-66.0: the full frame goes pink-red twice in 0.4 s, with nothing showing the direction.
- **Cause:** the `#flash` gradient starts 40% out (`index.html:13`) and is driven to full on every hit (`src/view/hud.js:127-130`). The `hurt` event carries no attacker position (`src/sim/game.js:254`).
- **Fix:** restrict the gradient to the outer 15%. Hold the level, not retrigger, within 350 ms. Record the attacker's position, then add 4 specks from that side, a one-frame hero rim and a brighter vignette on that side.
- **Check:** two hits 0.4 s apart change centre pixels by under 3%, do not strobe, and the hit side is brighter.
- **Docs:** `feedback-feel.md:45` specifies the rim and specks; neither is built.

**18. Shrine: no visible hold progress, no payoff, ring breaks up**
- **Seen:**
  - 36.0-41.2: the ring stays dark green with a 1-2 px mint sliver.
  - 41.2: a hard cut to the dimmed offer, with "The shrine accepts your tribute." stuck under the dim.
  - 33.8 and 92.0: the ring is a row of dashes from 30 m.
  - 36-41: a fifth of the ring is buried by a step.
- **Cause:** the fill band shares the track's radius with `depthWrite: false`, and the baked track paints over it (`src/view/props.js:67-68`). The banner and offer fire on one tick (`src/sim/world.js:123`). The band is 0.25 m wide at half resolution. Placement tests ground only (`src/gen/generate.js:242`).
- **Fix:** keep the track out of the bake and give the fill `renderOrder = 2`. Widen the band to 0.6 m. Build the §4.1 curtain and completion (geyser, shockwave, 600 ms beat before the offer). Remove the banner. Require all 8 samples at 5 m within 0.15 m of shrine height.
- **Check:** a still at any moment shows roughly how far the hold is, with no text. Completion plays 0.6 s before any dim. The full ring is visible on 10 seeds.
- **Docs:** `feedback-feel.md` §4.1 and rows 40, 41, 63, 64 specify all of it. None is built.

**19. Offers repeat the same few cards, and upgrades are worth +0.12**
- **Seen:** Gust Ward NEW on six offers in a row (LU4-9). Rune Apprentice as the upgrade on six of eight, with "Damage: 1 → 1.12". Wyvern and Hatchling never offered after LU3.
- **Cause:** a new Trap is forced into every offer until taken (`src/sim/field.js:138-140`) and the starter pool has one (`src/data/meta.js:20`). `buildOffer` (`field.js:127-153`) has no memory of declined cards. The guaranteed upgrade is not rotated (`field.js:141-143`). `lvlSlope: 0.12` on base damage 1 (`src/data/tuning.js:48`).
- **Fix:** force the Trap once only. Exclude cards shown and declined from the next offer. Rotate the guaranteed upgrade to the monster offered longest ago. Print a percentage and always the next milestone.
- **Check:** over 10 offers on 3 seeds no untaken card repeats back to back. Over 1,000 `buildOffer` calls each of 3 monsters gets 25-42% of guaranteed upgrades.
- **Docs:** `reference-run-1123.md:296, :298` partly cover it. Nothing covers repeats.

**20. Offer screens look like text forms, and some wording misleads**
- **Seen:**
  - Cards span 62% of the width; their height changes between offers (43% then 37%); the lower 40% is empty; there is no art.
  - TAKE and BANISH are identical buttons on every card.
  - Close is a one-frame cut with the title and buttons left alone for 0.3 s.
  - "Blessing of Haste: Monsters attack 10% faster." reads as an enemy buff.
  - All blessings are "rare", and the picked blessing flies to the hotbar.
  - "20% faster a stack". "Life Points" on cards against "HEALTH" on the HUD.
  - Results says "What broke the game: Target".
- **Cause:** `index.html:85-91`; `src/view/offer.js:92-94, :105, :19-28, :13-18`; `src/data/items.js:32`; `src/sim/world.js:138`; `src/data/cards.js:57-64`; `src/main.js:200`.
- **Fix now (text and small code):**
  - "Your monsters attack 10% faster."
  - "per level" in place of "a stack", and one health term everywhere.
  - "Biggest damage boost: …" on results.
  - Roll blessing rarity, add Decline, and fly blessings to the stat row.
  - Fade the title and buttons with the siblings, and fade the overlay during the card flight.
- **Fix for the menu redesign:**
  - Fixed-height cards with an art panel and a NEW corner badge.
  - One filled TAKE per card.
  - One shared BANISH with pips and a pick-to-banish step.
- **Check:** all cards are the same height on every offer, with no empty band above the buttons. BANISH appears once. No card says "a stack". Haste starts "Your monsters". Brightness rises over at least 12 frames on close.
- **Docs:** `run-recordings-1122.md:155-158`, `reference-run-1123.md:297, :366-371`, `feedback-feel.md:36, :38`.

**21. Summons pass through scenery, pop onto stumps and bunch over the hero**
- **Seen:**
  - 46.8-47.2: Rune Apprentice inside the shrine basin.
  - 103.7-103.9: Wyvern vanishes into a boulder.
  - 69.8-70.2: Apprentice appears on a stump top.
  - 103-107.6: summons stacked on the hero's screen column.
  - 37.4-41.2: the hero stands in the basin stone.
- **Cause:** summons are an untested orbit point (`src/sim/monsters.js:21-25`) on a spinning ring with opposite slots. Colliders hold only trees and rocks (`src/sim/colliders.js:9-10`). Walker height snaps to ground (`src/view/actors.js:288`).
- **Fix:**
  1. Run `resolveColliders` on summons and their targets.
  2. Add prop colliders (basin, chest, stone, broker, altar) for summons; add the basin for everyone.
  3. Treat walkers as grounded bodies with `stepUp`.
  4. Replace the ring with fixed slots relative to camera yaw, plus summon-to-summon separation.
- **Check:** standing at a shrine, a boulder and a trunk for 10 s each, no summon is inside a prop or on a stump top. Feet never jump over 0.55 m per frame. No summon overlaps the hero's silhouette for over 0.2 s.
- **Docs:** `environment-bar.md:39, :84` cover enemies only; add the summon rule. Chests stay non-solid for the player (`:106`).

**22. Raised ground is flat untextured colour, sand has no small detail, props cast no shadow**
- **Seen:** every plateau, ramp and stand is one flat tan with a hard seam against the speckled ground. At 104.6-110 one beige surface fills 45% of the frame. No pebbles or scuffs anywhere. Trees, boulders, columns and chests have no ground shadow.
- **Cause:** only the ground builder has UVs (`src/view/mapMesh.js:107, :25`). The decal loop generates zero (`spots(0, …)`, `src/gen/scatter.js:123`). Blob shadows cover walkers only (`src/view/actors.js:132-134`).
- **Fix:** give prims UVs (sand on tops, strata bands on sides), a darker base and a lighter lip. Generate about 1,400 decals including plateau tops, plus rubble near kit pieces. Add one static instanced shadow mesh for about 450 props.
- **Check:** no walkable surface over 5% of the frame is a single colour. At least 8 decals sit within 20 m of the hero. Ground under every tree and boulder is 8 L* darker. Draw calls rise by at most 2.
- **Docs:** `environment-bar.md` step 5 covers only y = 0 ground; add a prim-surface rule and a decal density. `generator-spec.md:682` specifies blob shadows.

**23. Stage panel times run opposite to the clock; XP readout disagrees with its bar**
- **Seen:**
  - The clock counts down, but chips read elapsed times ("E 1:45" fires at clock 5:15).
  - The single letters are unexplained, and the next-threat line is the dimmest text on screen.
  - "2/4" shows with the bar at 84% (4.2-9.0).
  - The label shows the old level under every level-up panel.
- **Cause:** `src/view/hud.js:25` against `:33`, and letters at `:28`. `hud.js:58` floors and ceils fractional values while `src/view/bars.js:25` uses the true ratio. `drawHud` is not called on the offer event (`src/main.js:213, :357`).
- **Fix:** show chips on the countdown (`clock(S.clock - ev.t)`) with words. Strike a chip only on death. Brighten the threat line. Show "LV n" plus the bar only. Call `drawHud(game, true)` before `setMode('offer')`.
- **Check:** the big clock equals a chip's time within 1 s at spawn. Bar and text never disagree. The HUD level matches the panel title.
- **Docs:** `run-structure.md:59, :221` call for an icon strip and a small count-up timer, not built.

### P2

**24. Set pieces and props still read as grey-box**
- **Seen and cause:**
  - Royal Gate: near-black boxes with plain ochre slabs, 19-28.6 (`src/gen/kits.js:46-48`).
  - Dotted z-fight patch under the gold band, 11.8-18.8 (lintel and pylons share planes, `kits.js:46, :48`).
  - Colosseum columns are bare 8-sided cylinders (`kits.js:43-45` bypass `column()`).
  - Boulders are 20-facet grey icosahedra (`src/view/scenery.js:13, :48`).
  - The rim is plain slabs with a hairline gap, 82-87 (`src/view/mapMesh.js:123-135`).
  - Chests are black slabs with sand-coloured bands and no long-range marker (`src/view/props.js:88-91`).
  - A dark crack at ramp-to-ring joins, 24.6-27.6 (`kits.js:42`; cause is medium confidence).
- **Fix:**
  - Gate: plinth, grooved shafts and a door slab; lintel `y0: 24`.
  - Columns: route through `column()`.
  - Boulders: 80-face geometry in 3 variants with a warm tint.
  - Rim: strata bands and overlapped segments.
  - Chests: 3 m marker and a contact shadow.
  - Ramps: run them 0.4 m into the ring.
- **Check:**
  - No flat region covers over 12% of the frame at the gate.
  - No dots or shimmer on the pylon.
  - No plain flat-topped cylinder on the Colosseum floor.
  - An unopened chest covers 12 render px at 40 m.
- **Docs:** `environment-bar.md` steps 11, 12, 16 and 23 and check 26; `run-recordings-1122.md:266`; `generator-spec.md:524`. Mostly specified and not built. The z-fight and the crack are in no doc.

**25. Remaining polish batch**
- **Camera sinks below the ledge when looking up (24.9-25.9).** `pitchMin` -0.5 with the new arm (`src/data/config.js:16-17`, `src/view/camera.js:27`). Clamp the arm angle to 0 or more and tilt the look target instead. Check: the camera stays at feet + 1.0 m or higher.
- **Bush on the camera at spawn (0-2.6).** `farSpawn(px, pz, 10)` at `src/gen/scatter.js:121`; change to 16 and shrink bushes within 5 m of the camera (`scenery.js:82-83`). Check: no bush over 3% of the frame on 5 seeds.
- **Effects freeze behind menus, and the level-up burst plays late over the hero (9-12, 41-45, 70-74, 97-99.8).** `dtReal = 0` outside play (`src/main.js:134, :334-337, :380`). Add a view clock, and shorten the burst at `main.js:214`. Check: no digit is visible behind a panel after 1.0 s, and burst pieces are 14 px or less and gone in 0.45 s. Docs: `feedback-feel.md:42, :159`.
- **Minimap is 85% black, labels are buried, enemy dots are 2 px.** `src/view/minimap.js:7, :22, :43, :51`. Use a local 120 m view, opaque fog and 3 px dots. Docs: `environment-bar.md:108, :159`.
- **Slot bar takes 19% of height with typewriter meters ("**........").** `index.html:27-33, :146`, `src/view/hud.js:21, :71`. Interim: one row, at most 8% of height, with a segment bar.
- **Pause and results are raw text stacks.** `index.html:196-223`, `src/main.js:193`. Until the redesign: style the native Frame cap dropdown, make END RUN two-step, hide zero rows, and show one Star Chips total (17 + 15). Docs: `art-book/screens.mjs:17-22, :60-63`.
- **Frame pacing is unproven.** 8.9% of live-play frames are single repeats, but the stage clock kept true time and the rate does not follow load, so the recorder is the likely source. Before changing anything:
  - add a frame-time histogram to `__ds.perfRead()`;
  - fix the cap threshold (`src/main.js:332`, 14.7 ms against the doc's 12 ms);
  - get a 60 fps capture.
  
  Check: `?debug` reads 58-60 fps with no frame over 33 ms.

### Decisions the owner needs to make

- **XP gems fly to the hero after 1.5 s (item 7).** This removes "walk to collect" for XP. The fallback is a 10 m magnet plus merging.
- **Render resolution (item 13).** Full resolution on desktop, or keep the chunky look with even blocks.
- **Crit number style (item 2).** `reference-run-1123.md:309` (ice-white with a star) and `feedback-feel.md:67` (gold) conflict. I recommend ice-white, because gold means coin.
- **Ley Thread colour (item 5).** I recommend the gate's violet, with crimson as a setting, because red is reserved for enemy attacks.

### Checked and not a fault

- **Second slot row cut off at the bottom.** The capture is missing the bottom 110 px of the page. Check on the PC that 14 px of world shows under row 2.
- **"Wyvern fire", "card trails" and "chain lightning".** These were Ley Threads and Apprentice bolts.
- **Cards opening tilted.** This is the intended deal animation.
- **Camera flicks at 47.7 and 86.1.** These are the player's mouse.
- **Sparse enemies at 60-77 s.** This matches the wave table.
- **"HUD text about 11 px".** It is 14-16 CSS px; the low figure came from downscaled frames.
- **No chest was opened**, so the chest reveal is unreviewed.

## 4. What works now (keep)

- **World scale:** terraces, ramps, trees at several depths, hazy mesas and the 90 m seal read as a big place. No pop-in or terrain z-fighting.
- **Kael at normal camera:** run, jump, landing dust and the blob shadow that separates on jumps. The Wyvern and Hatchling models are easy to tell apart.
- **Camera in open ground:** steady follow, with the hero on target size.
- **Level-up mechanics:** the game pauses and the clock freezes. Cards show exact changes ("Damage: 2.24 → 2.48") with new values in yellow. The picked card flies to its slot, and the summon is on the field at once.
- **Shrine flow:** it works end to end, and the pool turns grey after use.
- **HEALTH and XP panel:** readable on every background, with the lighter chunk for recent damage and the ghost XP segment.
- **Hit feedback:** enemies flash white; landing rings and the level-up ground ring read well.
- **Mid-distance damage numbers:** small, outlined and readable. That is the size all of them should be.
- **XP gems:** easy to see on sand.
- **Menu transitions:** instant, with no long freeze anywhere in the run.

## 5. Three things to tell the owner

1. **The world now looks big; the mess is on the camera.** Giant damage numbers, red ribbons across the screen, the camera jumping into rocks and trees, and Kael's body folding on every throw are bugs we have traced to specific lines. They are items 1-5 and we fix them first.
2. **The reward loop misfired in your run.** You got six level-ups in 16 seconds because gems from your monsters' kills never came to you. You could not afford one chest in 1:48, and the "press E" line was hidden behind your monster bar. We are retuning to your target of about 5 picks a minute with the first level at 0:50-1:30, and making the first chest affordable before the first elite.
3. **The picture is blurrier than it should be on your PC, and text still looks like a prototype.** The 3D view renders at less than half your screen's resolution; we will make it sharp unless you want the chunky look. Banners, labels and the HUD showing under menus get fixed now; the full card and menu restyle follows with the redesign. Four small choices are listed above for you.