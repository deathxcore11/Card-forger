# Enemy AI and feel tech v1 (Randall, 27 Nov 2026, 6:33 PM ET)

Randall's ask: use what modern game AI and physics know, so enemies treat a fast rider in a sculpted world contextually and smartly. Everything here must hold the 120 fps bar (8.3 ms a frame with the full horde at 1920x1080).

## The core problem

A rider moves 15 to 30 m/s. A walker moves 4 to 6 m/s. A horde that only chases is a tail behind you that never matters. On foot that worked, but on the card it does not. So threat has to come from **ahead and around**, not behind. Every rule below serves that.

## 1. Audit: what is already in the code (27 Nov, 790c569)

| Technique | State | Where |
| --- | --- | --- |
| One flow field for the horde, not per-enemy paths | IN, but breadth-first: every passable step costs the same, so it ignores slope | src/sim/flow.js |
| Separation so enemies don't stack | IN | src/sim/enemies.js (E.separation, spatial grid) |
| Shooters lead their shots | IN for bolts (capped lead), and a small lead for big enemies against a rider over 12 m/s | src/sim/enemies.js, src/sim/steer.js |
| Overtime hunters burst to your speed | IN | src/sim/enemies.js |
| Coyote time 0.12 s, jump buffer 0.15 s | IN | src/data/feel.js |
| Heavier fall after the apex | IN (1.6x gravity) | feel pass 1ea54b5 |
| Critically damped spring camera, rate-limited | IN | src/view/camera.js |
| Hit-stop | PARTLY: a flat 0.04 s on slam kills only | src/data/feel.js |
| Per-minute caps as token buckets | IN for drops and procs, not for attacks | src/sim/caps.js |
| Attack tokens, pacing director, utility AI, context steering, interceptors | MISSING | — |

## 2. Horde movement

- **Weighted flow field.** Replace breadth-first with a bucketed Dijkstra over the same 2 m cells. Uphill costs 1 + 2 x grade, downhill costs 0.8, sand banks cost 1.2, and cliffs stay walls. That is still one pass from the duelist. Spread the recompute across frames: cells within 60 m refresh at 10 Hz, and the rest at 2 Hz. Budget: 0.6 ms a frame at most.
- **Aim the field at where you will be.** Seed the field 0.8 s ahead of the rider along their velocity, clamped to walkable ground. Close in (under 12 m), enemies switch to direct steering at your real position, as now.
- **Context steering** for anything that is not a plain walker: 8 directions, each scored by interest (toward the target or the field direction) minus danger (other enemies, hazards, the slam ring, steep drops, the summons' attack zones). Pick the best slot and smooth it. This stops conga lines and makes elites move around obstacles and each other.
- **Separation plus alignment** inside a pack (light flocking), so groups move as a mass with a front, which reads better at speed than single dots.
- **Slope physics for enemies.** Enemies keep momentum: they slide and tumble down slip faces, struggle up windward slopes, and fly on knockback with real mass (light ones fly far, heavy ones stagger). A slam on a crest throws husks down the face, which is free spectacle that the terrain gives us.
- **Update LOD.** Enemies on screen think at 60 Hz. Those off screen and within 80 m think at 20 Hz, and those farther out at 5 Hz, moving along the field with no checks. All of it uses struct-of-arrays data and the existing spatial grid, so nothing allocates per frame.

## 3. Threat from ahead: roles that fit a rider

- **Interceptors.** They predict where you will be in 1 to 2 s, using your velocity plus the terrain ahead (a rider on a downhill line will run into the bowl), and run to cut you off instead of trailing.
- **Line blockers.** They gather on run-outs, landing slopes and rail ends, since those are the places you must pass. A Slam Drop or a trick line clears them. This is the "fun kill corner" Randall asked for, made by AI instead of placement.
- **Shooters** stand on high ground and lead you with a visible lead line (a thin ground line that shows where the shot will land, telegraphed at least 0.5 s). A shot at a rider is aimed at the predicted point, capped so that a sharp carve or a powerslide always dodges it. Dodging must always be possible.
- **Pack hunters** at Overtime: they mirror your line from the side, then converge when you slow down. Speed is safety, and stopping is risk.
- **Spawn ahead, off screen.** Spawns already happen off screen only. They are now weighted toward your heading (a 60 degree cone ahead, beyond the fog-in distance), so the horde is something you ride into.

## 4. Fairness

- **Attack tokens.** Only N enemies may be in an attack wind-up at once: melee 4, ranged 3, elite 1, plus the boss. An enemy without a token circles, pressures and waits. Tokens pass to whoever is best placed. This keeps a 1,000-strong horde readable and stops 40 hits landing in one frame.
- **Telegraph rules.** Every attack has a tell of at least 0.4 s (at least 0.6 s for elites and bosses). A red line is drawn only when it is close (the standing rule), and danger red is used only for telegraphs, never on scenery or bodies.
- **Pacing director.** It sits on top of the stage clock, which still sets the baseline. It tracks an intensity value from damage taken, enemies within 15 m, and how long since your last kill streak. It runs a cycle: build-up, then a peak (it adds a spawn wave or an elite), then relax (it holds spawns for 10 to 20 s once intensity is high for a while). It never relaxes during the boss hunt or Overtime pressure. Struggling players get longer relax windows (the rubber-band pillar in the bible). Players at the top get shorter ones.
- **Damage grace.** After a hit, 0.5 s of i-frames. Trick i-frames (0.25 s on pop and on Slam Drop landing) stay as in controls-v2.

## 5. Elites, bosses and the rival: utility AI

- Each tick (5 to 10 Hz) score every option: charge, shoot, summon adds, take high ground, retreat, guard the bowl, and break line of sight. The score uses distance, your speed, health, cooldowns, terrain (does a slope favour a charge?), and the attack tokens. Pick the best option, then **commit** to it for its duration before choosing again, so it never jitters.
- Add a small random factor per enemy (personality), so two elites of a kind do not mirror each other.
- **Bosses** are utility AI plus phases. Each phase unlocks options and changes the weights. A boss reads the terrain: it waits in a basin, jumps from crests and drives you off rails.
- **Rival duelist** (design in the rivals page): the same utility layer drives an AI stick on the player's ride controller, so it carves, pops and grinds with the same physics.

## 6. Feel tech (on the card)

| Technique | Action |
| --- | --- |
| Coyote and buffer | Keep. Add a crest coyote of 0.1 s, so a pop just past the lip still counts. |
| Variable gravity | Keep 1.6x after the apex. Releasing ollie early cuts the rise (short hop). |
| Speed-keeping landings | Measure the angle between the card and the slope normal. Under 20 degrees on a downslope keeps 100% of speed plus a small boost, under 35 degrees keeps 85%, and anything worse keeps 70% with no bail. |
| Spring camera | Keep the damped spring. Lead the camera along the velocity at speed (look-ahead up to 4 m), widen the field of view up to +8 degrees with speed, and add a small roll in carves (already 3 degrees). |
| Hit-stop scaled by impact | 0 s for small hits, 0.02 s for an elite kill, 0.04 s for a slam kill, 0.06 s for a boss stagger, capped at 0.08 s a second in total so a horde never stutters the game. The rider's own speed never pauses, only the impact visuals do. |
| Input feel | Read input every frame, simulate at a fixed 120 Hz with render interpolation, so physics is the same at 60 and 144 Hz screens. |

## 7. How we check it

- A bot rides 20 runs on 2 seeds at 1920x1080 and reports:
  - frame median, p99 and worst
  - AI ms per frame
  - hits taken per minute, and how many came from ahead versus behind
  - the largest number of simultaneous attacks (must not exceed the token caps)
  - director cycles per stage
  - clear and death rates against the current build
- The target is that over half the threat comes from ahead or the side while riding, with no hit lacking a tell of at least 0.4 s.
- Judge by eye from the real play camera, then by Randall's hands in the gym and preview.

## Build order

1. Attack tokens and telegraph rules.
2. Weighted, predicted flow field and update LOD.
3. Interceptors, line blockers and heading-weighted spawns.
4. Pacing director.
5. Context steering for elites, then utility AI for elites and bosses.
6. Feel table items (scaled hit-stop, landing angles, camera look-ahead, 120 Hz fixed step).
7. Enemy slope physics and knockback mass.
