# Duel Summoner: the 3-stage run, final v1

A run is one descent into the Buried Kingdom: **three stages**, each a freshly seeded map. In every stage the clock brings an elite and **two timed bosses**. A gate on the map wakes up, and the stage ends only when you walk into the gate and beat its gate boss. A Descent Circle then takes your whole build down to the next stage.

Beating the Stage 3 gate boss **wins the run**. The Final Altar then rises and offers a choice: bank the win, or Duel On into endless Overtime, the only place God Fusions can form.

The judges asked for these fixes, and all of them are applied here:

- **Fewer bosses.** Each stage has 2 timed bosses plus 1 gate boss. The opening slot is now an elite.
- **Shorter clocks.** 7 / 7 / 8 minutes.
- **Level-ups stay frequent** in every stage.
- **One theme kit for v1.**
- **Fall rules per stage.**
- **The Toll Bell pulls you into the boss's own arena.**
- **A Stage 3 timeout uses the same rule** as Stages 1 and 2.

---

## 1. Overview

| | Stage 1 Surface Ruins | Stage 2 Ashen Orchard | Stage 3 Frostbound Archive |
|---|---|---|---|
| Clock | 7:00 | 7:00 | 8:00 |
| Elite (Card Chest) | 1:45 Grave Herald | 1:45 Chainbound Jailer | 2:00 Royal Executioner |
| Timed boss A (Sealed Chest) | 3:45 Sealed Warden | 3:45 Coffin Sentinels | 4:15 Court of Three Masks |
| Timed boss B (Sealed Chest) | 5:30 Twin Jackal Idols | 5:30 Mirror Duelist | 6:15 The Hollow Heir |
| Gate wakes | when boss B falls, or at 6:00 | when boss B falls, or at 6:00 | when boss B falls, or at 7:00 |
| Gate boss (Sealed Chest) | The Stone Arbiter | The Seal Weaver | The Hollow King |
| Map | 360 m grid (≈312 m playable), 4 of 5 districts | 336 m (≈288 m) | 360 m (≈312 m), most height |
| Falls | none (gullies with ramps out) | pits: −10 LP, back on last safe ground | sand sea: −15 LP, back on last safe ground |
| Stage multiplier | ×1.0 | ×1.1 | ×1.2 |

- **Run length:** 22 minutes of clock plus three gate fights (about 1.5-2.5 min each) plus 2 Descents of 6 s each. That is about **26-28 minutes**.
- **Shorter alternative:** a 6/7/8 clock (about 24 min total) is kept as a StageSpec switch for a phone-length run. See the open questions.
- **Quick Duel** (secondary mode, sim-checked): one seeded Stage 1 map on an 8:00 clock, the Stage 1 timeline, and the Stone Arbiter as gate boss, then a results screen. There is no Overtime. It matches the bible's original 8-minute run, so the balance simulator can keep its target. It is built after the main mode works.

**Order and theme.** The stage order is fixed: Stage 1 is always Surface Ruins. The districts, layouts and encounter spots come from the seed.

**v1 production rule.** Ship all three stages on the Surface Ruins kit first:

- Stage 2 is a cool blue-grey palette swap built from sunken trenches with chain-bridge decks. There are no true stacked floors.
- Stage 3 is a gold-and-black palette swap with the sand sea, card platforms and jump pads.
- Each later stage adds 6-10 unique set pieces, including its gate arena.

Full Catacombs and Vault kits, and the remaining new enemies, come once Stage 1 is polished.

---

## 2. Stage timelines and bosses

Every timed event is announced 5 s ahead:

- a horn sounds;
- an edge-of-screen pulse plays;
- a minimap ping appears **on the boss ring the director has already chosen**.

That ring is the nearest valid one 25-40 m away, out of view and on your layer group. Its sigil scorches into the ground 1.5 s before the boss appears.

A HUD strip under the clock shows the elite, boss A, boss B and gate icons at their times.

### Stage 1: Surface Ruins

The sun-bleached top of the Kingdom. Five districts, of which the seed draws four:

- **Sunken Colosseum** (always drawn; it holds the gate);
- **Market of Tablets**: flat roofs and awnings;
- **Hall of Sealed Cards**: giant stone cards and a deck gallery;
- **Dragon's Spine**: a fossil bone ridge with bridges;
- **King's Stair**: stepped terraces. This replaces the old "Pharaoh's Stair".

The ground is open and readable for learning to kite, and the roofs and bone ridge are the first jump routes.

**Waves.** The bible's 8:00 table, compressed to 7:00:

| Time | What arrives |
|---|---|
| 0:00 | Husks |
| 0:40 | Runners |
| 1:20 | Seers |
| 2:20 | Golems |
| 4:20 | Bloats and Scarabs |
| from 6:00 | a 40-Husk ring every 30 s |

**Events**

- **1:45 Grave Herald (elite).** A tall husk priest with a bell.
  - Every 6 s it calls a ring of 12 Dust Husks around you.
  - Tell: the bell lifts, and a sand ripple runs outward 1 s before the husks rise.
  - Drops a Card Chest (free).
- **3:45 Sealed Warden (timed boss A).** Its shield blocks the front, so hit it from behind.
  - Tells: a shield glint, then the slam circle.
  - Drops a **Sealed Chest**. This is the planned first Fusion point.
- **5:30 Twin Jackal Idols (timed boss B).** Kill both within 10 s or the first one revives.
  - Tell: a tether line glows between them and turns red while the revive timer runs.
  - Drops a Sealed Chest.

**Gate boss: The Stone Arbiter, 2,400 HP at Heat 0.** It fights on the authored Colosseum floor, with the stands as escape ramps. The Arbiter flips one of its two face-down stone cards every 10 s, with a gong:

- **Monster card:** a stone beast charges down the lane the card points at.
- **Trap card:** a 3x3 grid of floor slabs lights up. Slabs glowing red erupt after 1.2 s.
- **Below 50%:** it flips both cards at once.
- **Below 25%:** its gavel-staff sends out a shockwave ring 0.8 m tall. You jump it, and a dust line shows it coming.

**The Arbiter's Gate** is a stepped gate with chains across it, and the chains glow once it is awake.

### Stage 2: Ashen Orchard

The crypt under the Colosseum, built for v1 as deep trench galleries:

- chain bridges over pits, which sway as a visual effect only (their collision stays still);
- walls of card niches and sarcophagus halls;
- blue seal-fire braziers;
- collapsed stairwells that form ramps.

The minimap shows a deck or ground indicator. Falling into a pit costs 10 LP and puts you back on the last safe ground. It never kills.

**Waves.** Dust Husks and Husk Runners come back tinted grey-blue. New enemies arrive in this order:

| New enemy | What it does | Tell |
|---|---|---|
| **Chain Wight** | latches a chain that slows you 30%; break it by moving 8 m away or dashing | a rattle and a dim chain line |
| **Lantern Keeper** | wards enemies within 6 m behind a blue rim, then flees; kill it first | the blue rim |
| **Seal Moth swarm** | flyers in groups of 8 that dim the light; Fire or Wind scatters them | |
| **Wrapped Mimic** | sits on chest spots; drops coins and a heart | the lid breathes, and its price reads "???" |
| **Ossuary Crawler** | drops from ceilings; deferred until stacked floors exist; for v1 it drops from trench walls | dust and a shadow 0.7 s before |

**Events**

- **1:45 Chainbound Jailer (elite).** A chain hook pulls you 6 m toward it.
  - Tell: the chain glows and a line is painted on the floor 0.8 s before the throw. Dash sideways or break line of sight.
  - Drops a Card Chest.
- **3:45 Coffin Sentinels (timed boss A).** Four sarcophagi stand up in a ring 14 m across.
  - Only the coffin with the glowing gold lid takes damage, while the other three shield it with beams.
  - The glow moves every 8 s, or when a coffin dies.
  - Tell: a chime and a gold crack down the lid.
  - Drops a Sealed Chest.
- **5:30 Mirror Duelist (timed boss B).** A hooded rival that copies your card throw and calls a shade of your highest-level monster.
  - Tell: it raises the card your summon came from, outlined in violet, 1 s before the shade appears.
  - Killing the Duelist dispels the shade.
  - Drops a Sealed Chest.

**Gate boss: The Seal Weaver, 3,600 HP.** A giant chained jailer-spider with seven seals on its back, fought in the authored Seventh Door vault.

- **Phase 1 (100-66%).** It weaves chain lines across the arena, alternating shin height and head height. Jump the shin lines, and slide or dash under the head lines. Each shows as a faint thread 1 s before it pulls tight.
- **Phase 2 (66-33%).** One floor sigil lights to match the seal glowing on its back. Stand in it for 2 s to break that seal, and the Weaver takes +50% damage for 6 s. Meanwhile it drops cages, each shown as a shadow circle for 1.2 s.
- **Phase 3 (below 33%).** The floor falls away in authored rings, leaving pillars and chain bridges. The falls lead into a shallow pit with ramps back up and cost 10 LP. The Weaver climbs the walls and spits web bolts with a 0.8 s line tell.

**The Seventh Door** is a round vault door with seven glowing seals, sitting at the lowest trench.

### Stage 3: Frostbound Archive

A vast cavern over a sea of slow-falling gold sand. It holds a giant stone duel table, floating stone card platforms, statues of fallen kings, a treasury terrace and a throne stair.

- **Card platforms** are always **optional routes**:
  - some flip face-down on a cycle, shaking and glowing for 1.5 s first;
  - some drift on fixed tracks;
  - summoning-circle jump pads throw you 6 m up.
- **Every required spot can be reached with all dynamic platforms off.** Their timing comes from the sim clock.
- Falling into the sand costs 15 LP and puts you back on the last safe ground.

**Waves.** Glass Seers and Ram Golems return as gilded variants. New enemies:

| New enemy | What it does | Tell |
|---|---|---|
| **Gilded Hound** | follows authored jump links across gaps | crouch and glow 0.5 s before the leap |
| **Card Wraith** | teleports between platforms | a fluttering card at the destination 0.6 s early |
| **Throne Bowman** | lobs at your predicted landing spot; change direction mid-air to dodge | a circle where you will land |
| **Coin Thief Scarab** | steals 3 coins on touch; killing it returns them | flashes gold |
| **Abyss Hand** | grabs you if you stand within 1 m of an edge for more than 1 s | sand bubbles |

**Events**

- **2:00 Royal Executioner (elite).** Its overhead slam leaves a crack line 12 m long that erupts 1 s later.
  - On a card platform, the crack flips that platform.
  - Tell: a red glint as the axe rises, and the line painted on the floor.
  - Drops a Card Chest.
- **4:15 Court of Three Masks (timed boss A).** Three masks orbit you, and only the one with its eye open takes damage.
  - The open eye passes to the next mask every 6 s. The closed masks fire slow orbs.
  - Tell: a chime and an eye-glow 0.5 s before the eye opens.
  - Drops a Sealed Chest.
- **6:15 The Hollow Heir (timed boss B).** A rival duelist that sets 3 face-down trap cards on the floor, visible as card backs, and calls two shade monsters from the card list.
  - Tell: an arm flourish before each play, and each trap flashes before it arms.
  - Drops a Sealed Chest.

**Gate boss: The Hollow King, 5,000 HP.** This is the old tomb king, renamed; "Pharaoh" appears nowhere. He fights on the giant duel table.

- **Phase 1 (100-66%).** A marked blade arc, and 10 Husks summoned every 12 s.
- **Phase 2 (66-33%).** He sets three face-down trap cards that burst when stepped on. The table's edge tiles shake for 1.5 s, then flip face-down on a cycle.
- **Phase 3 (below 33%).** Gold sand fills in from the table edge over 60 s and shrinks the space. Meanwhile he calls echoes of the earlier gate bosses' signature moves in turn: the Arbiter's slab grid, then the Weaver's shin lines.
- **Oath of the Second Seal:** if you took it, he gains one more named mechanic, which is shown on the Oath's door.

**The Throne Gate** sits at the top of the throne stair, with the Oath of the Second Seal door beside it.

---

## 3. Gate rules (all stages)

- **Wake.** The gate wakes when timed boss B falls, or at its wake time if B is still alive. You see the chains glow, dust fall from the gate, and a sky beam you can see from anywhere.
- **Early start.**
  - Once the gate is awake, hold the gate seal for 3 s to start the fight.
  - Both Sealed Chests are already behind you at that point, so starting early costs only the remaining clock: fewer crystals and picks.
  - It pays 1 Star Chip per 2 s left on the clock, plus a "Swift Seal" coin bonus.
  - The gate seal shows exactly what you give up ("forfeit: 0:48 of clock").
- **During the fight.** The clock freezes, normal spawning stops, and only the boss's summons appear.
- **Toll Bell.** If the clock reaches 0:00 with the gate unopened, the Toll Bell rings in any stage, including Stage 3.
  - A 2 s sigil pull draws you into the gate arena. Gate mechanics need their authored arena, so the boss never spawns on random terrain.
  - The boss is enraged: +30% damage and faster tells.
  - The swarm keeps spawning at the 0:00 rate, and a hunter pack joins every 30 s until the boss falls.
  - Stalling is never safe, and the stage can always still be finished.
- **On the gate boss's death:**
  - every enemy crumbles;
  - every crystal and coin on the map is pulled to you;
  - the boss's Sealed Chest descends;
  - in Stages 1-2, a Descent Circle opens. You get 15 s to open the chest and use anything within 20 m, then you step in or are pulled in.
  - In Stage 3, the Final Altar rises instead (see §6).

---

## 4. Clock, difficulty and pacing

- **HUD.** The stage countdown is big at the top. A small run timer counts up under it and appears on the results screen.
- **Enemy HP** = base × (1 + 0.18m + 0.02m²) × stage multiplier × Heat, where m is **cumulative run minutes**. By the end of Stage 3 (m ≈ 22, ×1.2), that is about 17.6×.
  - The simulator must check this against two level-10 Fusions before the numbers are locked.
  - Enemy damage rises 6% per run minute, as in the bible.
- **Heat 1-5** applies to the whole run: each step is +20% enemy HP, +10% speed and +25% Star Chips.
- **Level-ups stay steady and the picks are bigger (owner, 23 Nov).** The XP curve is the data table in `src/data/cards.js` (`XP.table`, fitted on 23 Nov): about 10 XP for the first level, 15, 20, 26, 33 ... rising about 8 XP a level, then a 7% tail. Stage 1 pace: level-ups per minute 0-1, 2, 2-3, 3, 3, 3-4, 4-5 (first level between 0:50 and 1:30, about 20 by 7:00). XP gems from kills by your monsters fly to the duelist after 1.5 s and gems within 1.2 m merge; after a level-up panel closes the next waits 3 s of play.

| Stage | Picks per minute | Picks in the stage |
|---|---|---|
| Stage 1 | about 5 | 30 to 38 (level-ups plus chests, shrines and stones) |
| Stage 2 | about 5, to be re-measured | to be re-measured |
| Stage 3 | about 5, to be re-measured | to be re-measured |

"Picks" means level-ups plus chest, shrine and stone choices. The earlier 7.5 a minute and 145 picks are retired.

- **Why a full board is still impossible.** Power is held back by choices, not by starving the player of picks:
  - filling the base board (4 monsters to 10 and 4 Spells or Traps to 5) costs 52;
  - each Fusion resets its monster to level 1, with 9 more levels to its full form;
  - each zone a Fusion frees takes 9 or more picks to grow a new monster;
  - two Fusions both at level 10 is about 70-80 picks on top of the base board.
- **Once every zone is locked and maxed**, extra picks become "Overflow" offers: small stacking stats, or 10 coins (the Pass value).
- **Fusion targets** (sim to confirm, with focused and spread players):
  - First Fusion at the **3:45 Warden** Sealed Chest. A focused player needs about 26 picks by about 3:30.
  - A spread player fuses at 5:30 (the Jackals) or at the Arbiter's chest.
  - Second Fusion in Stage 2.
  - Two level-10 Fusions late in Stage 3 is the "great run" line.
- **Sealed Chests per run: 9** (2 timed bosses plus 1 gate per stage). The generator never places one on the map.
- **Economy check.** The simulator must check coins left over at each gate. Card Chests run 8 / 7 / 6 per stage, and prices fall back to 70% at each stage. If later stages feel stingy, add chests through StageSpec.

---

## 5. Carry-over between stages

- **Carries over:**
  - the whole field (4 Monster Zones and 4 Spell/Trap Zones with their levels and forms) and all Fusions;
  - player level and XP;
  - all items and blessings;
  - Scales trades;
  - coins;
  - Redraws and Banishes, plus 1 free Redraw at the start of each new stage;
  - your Bone Oath count (its extra skeleton groups keep coming);
  - Star Chips earned;
  - golden statues found (7 per run: 2/2/3);
  - sealed fragments found (3 per run, one per stage);
  - any **unopened Sealed Chest you are carrying**. A Sealed Chest you leave on the map is lost.
- **Partly carries:**
  - LP keeps its value, and the Descent heals 40% of missing LP;
  - Card Chest prices drop back to 70% of where they had reached.
- **Does not carry:**
  - Broken Covenant bargains end at the gate;
  - Shrine progress, unused Anvils and Magnet Tablets stay with the map;
  - the Relic Broker restocks every stage.
- **Item text change:** Eye of the Sealed One becomes "hold all three sealed fragments, one per stage: the gate boss of Stage 3 falls instantly". It does **not** skip the Final Altar choice.
- **Descent interlude (about 6 s, hides the stage swap).** The next stage was already generated during the gate fight.
  1. The duelist steps into the circle and sinks through a card portal.
  2. A card flips to show the next stage's name and its **Seal Code**.
  3. The field panel shows a recap of the stage: kills, chests, time.

---

## 6. Win, Final Altar and Overtime

- **The Hollow King's death wins the run.** The swarm crumbles, a vacuum pulls in every crystal and coin, the King's Sealed Chest descends, and then the **Final Altar** rises.
- **The Final Altar** offers two choices:
  - **Close the Vault:** bank the win and go to results.
  - **Duel On:** the win is banked first, then Overtime starts.
- **Overtime** (Stage 3 only):
  - endless hunters that step up every 30 s with no cap, marked by a red horizon pulse and a horn;
  - XP and chests keep coming;
  - a **hunter captain** every 60 s drops a Sealed Chest;
  - the Final Altar stays in the arena as the **only place a God Fusion can form**: stand on it for 3 s while holding two Fusions at level 10.
  - Secret Fusions are formed the same way, from two specific God Fusions.
  - Overtime time goes on the results screen and into the Card Library records.
- **Death:** dying before the King falls is a defeat. Dying in Overtime still counts as a win, plus the Overtime time.

---

## 7. Generator hooks the run needs

Per StageSpec, the generator provides:

| Hook | What it gives the run |
|---|---|
| Clock and timeline | `clock_s`, `timeline[]` |
| Boss rings | 5-7 rings, every point within 70 m |
| Elite pockets | ambush spots |
| Gate set piece | arena, sigils, perches, charge lanes, Toll Bell pull point |
| `safeGround` | pit and sand respawn (Stages 2-3) |
| Dynamic platforms | flip and drift, tick-driven, optional only (Stage 3) |
| Hound links | jump links Gilded Hounds can follow (Stage 3) |
| `spawnMouths` | points for the 40-Husk rings and surges |
| Per-stage encounter counts | see the generator spec §8 |

---

## 8. Animation list

**Tech.** Each kind of model is animated in the cheapest way that works:

- **Swarm enemies:** vertex-animation textures on instanced meshes, one draw call per type, 4-8 frame loops, with per-instance phase offsets so they never move in lockstep.
- **Duelist, summons, elites and bosses:** small skeletal rigs of 12-24 bones on low-poly, flat-shaded meshes.
- **Every model:** hit flash, squash on hit, dissolve and seal-glow are shader parameters, so they cost no extra animation data.
- **Scenery and landmarks:** instance-transform tweens or shader-uniform tweens only.

**Duelist**

- **Locomotion:**
  - idle (breathing, cards fanned) and a select-screen fidget;
  - run cycle at 9 m/s, backpedal and strafe blends, sprint lean.
- **Jumping:**
  - jump takeoff, rise, apex, fall;
  - light land, and a heavy land with a dust ring;
  - air jump (a spin with a card burst).
- **Dash and slide:**
  - dash (a smear frame plus an afterimage trail of card silhouettes);
  - slide (low crouch, with sparks and dust downhill).
- **Combat:**
  - card throw on an upper-body layer, so it plays while running;
  - hurt flinch, knockback stumble, low-LP limp blend.
- **Card poses:**
  - summon pose (card raised, violet flash, during the 0.5 s time stop);
  - Fusion pose (hands joined overhead);
  - Tribute pose (a card burns at the altar).
- **Interactions:**
  - level-up flourish;
  - chest open (kneel and lift the lid);
  - shrine channel loop.
- **Stage and run:**
  - pit or sand fall and the respawn blink;
  - Toll Bell sigil pull;
  - Descent (step into the circle and sink through a card portal);
  - victory and defeat collapse.

**Summoned monsters** (per form, for each of the 3 forms)

- **Arrival:** rise from a glowing floor card.
- **Movement:** idle stance or hover; follow-move (walk or fly).
- **Attacks:** one animation per attack type: breath line, lob, bolt, sweep, charge, bite, burrow burst, turret deploy, chain zap, curse cast, chain pull.
- **Growth:**
  - special effects at levels 5 and 10;
  - level-up sparkle;
  - form-change morph (a light burst, then a scale tween from the old model to the new).
- **Fusion:**
  - Fusion merge (both monsters spiral to a point, a card flips, the new creature unfolds);
  - God Fusion ascent at the Final Altar (a slow rise, a halo ring, a camera orbit).
- **Leaving and returning:**
  - Tribute dissolve (burns into its card);
  - Graveyard exit (fades into a card that flies back);
  - Monster Reborn return.

**Swarm enemies (vertex animation)**

- **Base six:**
  - Dust Husk: shamble, lunge.
  - Husk Runner: sprint, leap.
  - Glass Seer: float, aim (the 0.8 s line), fire, recoil.
  - Ram Golem: plod, paw-scrape wind-up, rush loop, crash stun.
  - Sand Bloat: waddle, swell (blinking glow), pop.
  - Tomb Scarab: flap, dive, bank.
- **Stage 2:**
  - Chain Wight: float, throw, latch loop, snap.
  - Ossuary Crawler: wall crawl, drop, land.
  - Lantern Keeper: hobble, ward pulse, flee.
  - Seal Moth: flutter, dim pulse.
  - Wrapped Mimic: breathing lid, reveal snap, hop chase, bite.
- **Stage 3:**
  - Gilded Hound: prowl, crouch-glow, gap leap, land.
  - Card Wraith: drift, vanish into a card, reappear.
  - Throne Bowman: draw, lob, reload.
  - Coin Thief Scarab: steal-dart, flee, coin burst.
  - Abyss Hand: bubble, grab, drag, retreat.
- **Shared by all:**
  - spawn (rising from sand or a seal);
  - hit flinch, knockback slide;
  - death crumble into a crystal;
  - element status overlays (burning, frozen, shocked, poisoned, cursed).

**Elites and timed bosses**

- **Entrances:**
  - Herald rises with its bell;
  - Warden breaks out of a stone card;
  - Jackals hop off plinths;
  - Jailer drags in its chain;
  - Coffins stand upright;
  - Mirror Duelist flips in from a card;
  - Executioner drops from above;
  - Masks assemble;
  - Heir walks out of mist.
- **Every elite and timed boss** has idle, move, and every attack's wind-up, active and recover with its tell pose.
- **Vulnerable states:** the Warden's exposed back, a Coffin's gold lid, a Mask's open eye.
- **Also:** the Jackals' revive, death, and the chest drop.

**Gate bosses**

- **Gate:** gate wake (chains glow, dust falls, sky beam).
- **Intro:** about a 3 s cutscene in which the name card slams onto the screen.
- **Phase transitions:** a roar plus the arena change. The Arbiter's cards flip, the Weaver's floor falls away, the King's sand rises.
- **Attacks:** every attack has its wind-up and tell; plus a Toll Bell enraged variant and a stagger.
- **Death:** slow motion, the boss shatters into cards with a burst of gold light, and the Sealed Chest descends.

**World and encounters (tweens)**

- **Encounter use:**
  - landmark marker card flips face-up on use;
  - Card Chest open (the lid flies, a card rises and spins);
  - Sealed Chest seals cracking;
  - shrine rune ring filling;
  - Witness Stones lifting;
  - Anvil hammer strike;
  - altar bowls flaring;
  - Magnet Tablet crystal stream;
  - Bone Oath pile rattling;
  - Scales tipping;
  - Echo Forge twin flames;
  - vases shattering;
  - golden statues glinting.
- **Gates and circles:**
  - gate seam pulse, then open; gate chains breaking;
  - boss-ring sigil stamp-in (1.5 s);
  - Descent Circle opening;
  - Final Altar rising.
- **Platforms and traversal:**
  - bridge dust when landed on;
  - card platforms shaking, then flipping;
  - drifting platforms;
  - chain bridges swaying (visual only);
  - jump pads pulsing.

**Screen and UI motion**

- **Level-ups and cards:**
  - level-up card deal (three cards slide in and flip);
  - rarity shine;
  - a card hovered, then picked;
  - field slots snapping in;
  - Fusion banner.
- **Bosses and warnings:**
  - boss HP bar entrance;
  - timed-boss horn with an edge pulse and ring ping;
  - Overtime 30 s step pulse.
- **Results and Descent:**
  - stage recap and results flip;
  - Seal Code card on the Descent.
- **Hit feel:**
  - damage numbers;
  - crystal pickup streak (rising pitch);
  - screen shake scaled to hit size;
  - hit-stop of 2-4 frames on elite and boss hits.

---

## 9. Open questions for Randall

1. Clocks of 7/7/8 (about 27 min per run), or 6/7/8 (about 24 min) for phones?
2. Keep Quick Duel (one 8:00 map with the Arbiter as gate boss) as a short mode?
3. The gate now wakes after timed boss B, so starting early never costs a Sealed Chest, only clock time. Is that OK?
4. LP between stages: heal 40% of missing LP (proposed), a full heal, or none?
5. Falls: none in Stage 1, an LP penalty in Stages 2-3, and never deadly. OK?
6. Confirm the renames:
   - "Hollow Pharaoh" becomes The Hollow King.
   - "Pharaoh's Stair" becomes King's Stair.
   - One named gate per stage: the Arbiter's Gate, the Seventh Door, the Throne Gate.
7. The Mirror Duelist and the Hollow Heir are both rival duelists. Keep both, or change one (for example, turn the Heir into a "Card Croupier" that deals traps)?
8. Ship all three stages on the Surface Ruins kit first, with palette swaps and set pieces, before full Catacomb and Vault art?

