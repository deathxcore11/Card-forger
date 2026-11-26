# Card Riding and a living desert: the build plan (26 Nov 2026)

Owner's ask (26 Nov, 12:10 PM ET):
- Board riding with grinds and tricks in a reactive world.
- Trick landings are a multiplier.
- A rad 90s console feel.
- Thousands of hours of unlocks.
- Broken builds that are still balanced.
- (The dog was dropped by the owner: summons that evolve and fuse fill that role.)
- A polished seeded world that generates in a fun, cool way.

He added: "Go hard and surprise me on how well this works and fits the world and game feel." The controller should play like the classic early-2000s skate games, and touch should be just as easy.

Everything here is our own design, names and art. Never write another game's name in the repo.

**One rule keeps it a fight game:** riding makes you fast and stylish, landing tricks makes you deadly, and bailing in a crowd gets you killed.

Rules that stay:
- Carved Cards style.
- Approved run feel on foot (LEG_DEG 30, camera).
- Stakes.
- No sponges (density, not hp).
- Door rules.
- Everything reachable with the starting kit.
- 60 fps.
- Big desert only (classic maps untouched).

## 1. The ride

- **Getting on and off.** Above about 10.5 m/s (a slide, a downhill, a fast flat) the duelist kicks a giant spell card under their feet and rides it. Below about 7 m/s they step off and run. Monsters, spells and traps keep fighting on their own.
- **Ride physics.** Downhill builds speed and uphill bleeds it. Soft sand slows you; flats keep speed. Top speed is about 24 m/s on long slopes. Carve turning.
- **Ollie.** Hold jump to crouch (up to 0.5 s), release to pop. Longer hold gives a higher pop: 2.2 m up to about 4.5 m.
- **Grind.** Within about 1.6 m of a grindable edge while airborne (or with the grind button), snap onto it. Speed is kept along the edge. A balance bar drifts and the stick corrects it. Losing balance is a bail. Flick to change grind type (3 types).
- **Air tricks.**
  - Flips: 8 directions, quick.
  - Grabs: hold; worth more the longer held; cannot land while held.
  - Spin: 180 steps.
  - Each trick has points; the same trick repeated in one combo is worth 0.75x each time.
- **Manual.** A balance trick on flat ground that keeps a combo alive between spots.
- **Revert.** A timed press when landing from a steep ramp keeps the combo going.
- **Landing.** Board within about 30 degrees of travel direction and not mid-grab is clean, and banks the combo. Otherwise it is a bail: lose the unbanked combo, lose one Flow step, knocked down for 0.6 s (no invulnerability).
- **Special.** One special trick per board when the Flow meter is full: big points and a shockwave.

## 2. Flow

- **Combo.** Points x count of distinct tricks. Banked on a clean landing.
- **Flow meter.** Steps x1 to x5 (thresholds tuned by bots). It drains one step per about 10 s without a banked trick.
- **What Flow multiplies:**
  - damage, x1 to x2 (linear over steps);
  - XP and coins from kills, x1 to x3;
  - score, x1 to x5.
- **Landing slam.** On a banked landing, a shockwave. Radius 4 to 14 m and damage from the combo just banked (capped per Flow step). It kills swarm enemies and staggers elites.
- **Grind sparks.** Damage ticks to enemies within about 2.5 m of the rail while grinding.
- **Flow feeds Stakes.** +5% Stakes per Flow step above 1, only while held.

## 3. The reactive desert

Grindable or launchable, and each reacts:

| Thing | What you do | What it does back |
|---|---|---|
| Half-sunk beams, fallen pillars | Grind | Sparks |
| Giant carved stone cards | Grind the top edge, wall-ride the face | Lights up, stays lit on the map |
| Mesa rims, canyon lips | Long grinds | |
| Dune crests | Launch ramps | |
| Canyon runs | Half-pipes, with revert | |
| Dry lakes | Manual flats | |
| Vases, dead trees | Smash at speed | Drops, plus a combo bonus |
| Dormant seal stones | Grind or slam | Lighting all five in a pocket within one combo opens a chest |
| Rare set pieces (bone ribs, rope bridges, chimes) | Ride | A signature line |

- **Generator lines.** Each pocket gets a line: 2 to 5 pieces placed so one flows into the next, aimed toward the neighbouring pocket. Deterministic per seed.
- **Line check tool.** Every line is rideable with the starter board, has no dead ends into walls, and nothing floats.

## 4. Controls

| Action | Controller | Touch |
|---|---|---|
| Ollie | Hold A, release | Hold the big right button, release |
| Grind | Y near an edge | Grind button, or Auto-grind (default on) |
| Flip | X + direction | Swipe on the right pad |
| Grab | B + direction, hold | Press-hold then drag on the right pad |
| Spin | L1 / R1 | Two-finger twist, or gyro option |
| Manual | Up then down quickly | Swipe down then up |
| Revert | R2 on landing | Tap the right button on landing |
| Special | Two directions + button, full meter | Draw a circle on the right pad |

- **Touch helpers** (each can be switched off): Auto-grind, landing assist at low Flow, big transparent zones.
- **Keyboard:** map sensibly.
- **Thor:** the bottom screen shows the combo, the meter and the trick list.
- **Tutorial:** a 20-second pocket near the start.

## 5. World polish

- **Region faces.** Each region type has its own skyline, sand colour, prop family and ride style.
- **Border features** where regions meet: cliff step, dry river, wall of stone cards, bone ridge. No plain blends.
- **One wonder per seed** within reach of the start, with its own long line and a reward.
- **Composed views.** The start faces a landmark; crests reveal the next thing; pockets sit where sight lines break.
- **No-junk rule.** Every prop can be ridden, broken or looted, or is part of a landmark. Cut the rest.
- **Contact sheets.** 12 seeds from the game camera at 412x915 and 915x412, plus drives along 3 lines per seed.

## 6. Balance

- Enemies spawn ahead along the direction of travel. Surges put packs across lines. Add fast runner and leaper behaviour so that riders get caught.
- Damage from Flow caps at x2.
- **Gate boss arena:** a ring with a few rails and a quarter-pipe rim. Its attacks punish long grinds.
- **Door:** widen the band for riders so the newbie door find stays 40 to 60%.
- **Bots:**
  - The newbie never tricks and keeps current numbers.
  - The rider lands simple combos and out-kills the newbie by 40% or more on clears.
  - The reckless rider tricks through surges and dies more than both.

## 7. Unlocks

- **Boards are card backs:** 30 planned, 8 first. Each has one stat lean, one passive and one special trick.
- **Duelist ride styles.**
- **About 30 ride items.**
- **Ride quests:** combo score, grind distance, gaps found, lines completed, slams.
- **Daily seeded line challenge.**
- **Boards for best combo and best slam.**
- **No dog (owner, 26 Nov 12:33 PM ET).** The summons are the companions:
  - summoned monsters keep pace with the card;
  - a banked landing makes every summon attack at once (a "chorus strike");
  - each evolution form and each Fusion adds its own flourish to the slam (its element on the shockwave).

## 8. Order

1. The ride (section 1), on code-made motion.
2. Flow and the slam (section 2).
3. Reactive desert and lines (section 3).
4. Controls and tutorial (section 4).
5. World polish and contact sheets (section 5).
6. Balance with bots (section 6).
7. Unlocks: 8 boards, ride items, quests, then summons that join your tricks (section 7).

After steps 1 and 2: commit, report with picture strips at 412x915 and 915x412, and continue. The owner plays 1 and 2 as soon as they are in the preview.

## 9. Land made for riding (owner, 26 Nov 1:08 PM ET)

His words: vast hills, flowing terrain like a wandering desert journey, ramps, cool dips, land-formed half pipes and full pipes. The map stays one open seeded square. Only the landforms change. Same seed, same land.

| Landform | Region | Shape and ride |
|---|---|---|
| Wave valleys | Dune sea | Long S-shaped valleys with banked sides; carving bank to bank gains speed |
| Rollers | Dune sea, lake edges | Rows of low bumps (about 1.2 m tall, 9 to 12 m apart); ollie the tops and absorb the dips for pump speed |
| Bowls | Dry lakes | Round basins 30 to 60 m across with a rideable lip |
| Half-pipes | Canyon runs | U cross-section, walls ride up to vertical; revert on re-entry |
| Full pipes | Ridge spines, ruin fields | Wind-carved stone tubes and giant buried card arches. Collision is a curved surface the card sticks to above a speed threshold, and falls off below it |
| Step-downs | Mesa fields | Ramp up one side, long landing slope off the other |
| Spines and hips | Region borders | Sharp ridges for transfers between valleys |
| Great drops | 1 or 2 per map | A cliff with a long run-out |

**Generator rules:**
- Every launch has a landing slope of matching angle within its range at 12 to 24 m/s.
- No flat landings from more than 4 m of air.
- Valleys lead toward pockets or landmarks.
- Everything stays reachable on foot by another way.
- The newbie door find and the pocket gap checks keep passing.

**Tool:** extend linecheck so that each launch and landing pair is simulated at 3 speeds.

## 10. Shrines you ride (replaces stand-in-the-circle as the main way)

Each shrine is a small course. How well you ride it sets the boon tier.

| Shrine | Course | Charged when |
|---|---|---|
| Ring Shrine | A stone ring rail around the altar | One full lap grinded; a second clean lap lifts the tier |
| Bowl Shrine | A bowl around the altar | Three carved laps; faster is better |
| Gate Shrine | A line of five arches | All five threaded in one go; each arch adds a fifth |
| Spire Shrine | A spire | You air over it; height and tricks lift the tier |
| Pipe Shrine | A full pipe | One clean loop |

- **Tier by style.**
  - A plain charge gives the normal 1-of-3 boons at the clock's tier.
  - Charged while holding Flow x3 guarantees a rare or better.
  - Flow x5 guarantees an epic or better.
- **On foot.** Standing inside any shrine still charges it, slowly (as now), for the base tier. A new player loses nothing.
- **The fight.** A charged shrine still spawns its pack.
- **Wager Shrines** become a dare: a marked gap or line to clear for the prize. Stakes rise either way.

## 11. Riding is the build

- **Trick answers.** Every monster, spell and trap gets ONE trick it answers. This is data on the card: `answers: 'grind' | 'flip' | 'grab' | 'spin' | 'land' | 'manual' | 'seal' | 'air'`. It carries an effect and a short cooldown. Examples:
  - Ember Wyvern: fire along the rail you grind.
  - Cinder Hatchling: a fireball where you land.
  - A trap arms on each seal stone lit.
  - A spell casts free on every third distinct trick in a combo.
- **Evolutions and Fusions.**
  - The answer grows at level 5 and at level 10.
  - Fusions answer two tricks.
- **Flow fuels summons.**
  - Attack rate rises per Flow step.
  - The special spends the whole meter for one large chorus strike.
- **Ride boons.** These join the boon list: pop, balance, spin speed, Flow hold, slam size, grind speed.
- **Land items.**
  - Dune items reward air.
  - Canyon items reward wall-to-wall.
  - Ruin items reward long grinds.
- **Land answers the slam.**
  - Salt flat: a wide star crack.
  - Dune: a rolling sand wave.
  - Pipe: a double echo.
- **Three reference builds for the bots:**
  - Rail Dragon: grinds.
  - Meteor: big air and slam.
  - Seal Runner: traps and seal lines.
- **Balance guard.**
  - Trick answers have cooldowns, so spam does not multiply.
  - A walker keeps all normal attacks and can still clear stage 1.
  - The rider bot out-kills the walker by 40% or more on clears.
  - Each reference build is viable, and none is more than about 1.5x the others in kills per minute at equal levels.

## 12. Order for sections 9 to 11

1. Landforms: wave valleys, rollers with pump, bowls, half-pipes, step-downs first. Then full pipes and great drops.
2. Ride shrines: Ring and Gate first, then Bowl, Spire, Pipe.
3. Trick answers on the existing 20 cards, plus ride boons.
4. Land items and slam land answers.
5. Bots for the three builds, then balance.

Contact sheets and drives for each. Report Pass, Fail or Not assessed.

## 13. Measured balance (26 Nov, build 4d29954 and the next push)

**The yardstick is clear rate and death rate on stage 1 Easy, not kills.** Riders out-killing a walker 2x is fine: the summons riding along into fresh enemies is the fantasy. Level pace is checked so it does not run away (rider level within about 1.3x of the walker at 4, 8 and 12 minutes).

Bots (`node tools/bigbot.mjs 24 --player <bot>`), 24 runs each:

| Bot | Cleared | Died | Door found | Kills/min | Level 4 / 8 / 12 min | Chorus a stage |
|---|---|---|---|---|---|---|
| Walker (never rides) | 42% | 42% | 54% | 484 | 25 / 39 / 58 | 0 |
| Newbie (no tricks) | 50% | 38% | 58% | 496 | 24 / 38 / 58 | 0 |
| Reckless rider | 33% | 42% | 38% | 682 | 24 / 38 / 59 | 111 |
| Meteor (air and slams) | 50% | 13% | 54% | 967 | 27 / 40 / 58 | 58 |
| Rail Dragon (grinds) | 33% | 58% | 75% | 914 | 28 / 44 / 62 | 72 |
| Seal Runner (seal lines, marks) | 42% | 54% | 58% | 1018 | 29 / 44 / 61 | 78 |

Targets: walker clears 35 to 45%; newbie door find 50 to 60%; skilled riders clear 50 to 65% and die 10 to 25%; builds within 1.5x on clear rate and kills a minute.
- Met: walker, newbie, rider level pace, builds on kills a minute, Meteor.
- Not yet: Rail Dragon and Seal Runner die 54 to 58%, so they clear 33 to 42%.

What the riders meet: the swarm and the elites lead a fast card; the door rises ahead of a fast card; the rise rumble throws sand on the door's side for 3 s (no beam and no map pin, the standing rule); the red wind reaches 160 m while riding (90 m on foot).
What riding gives: full slams (4 to 14 m), full trick answers, a chorus strike from a 600 combo at most every 6 s (its spectacle grows with the combo), Flow +5% damage and summon rate a step, summons spaced out at speed.

**Not assessed yet:** feel by hand on any device; phone fps while riding (desktop headless shows 60); touch swipe and draw gestures (touch uses buttons); the Thor bottom-screen ride panel (needs a mock and the owner's yes first).
