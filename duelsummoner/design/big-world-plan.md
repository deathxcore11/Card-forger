# Big World, Rewards and Unlocks: the build plan (24 Nov 2026)

Stage length and door rule added at 10:14 PM ET: see section 2.

This is one plan for three requests from the owner on 24 Nov (10:10 to 10:13 PM ET). It replaces the "20x" plan.

1. **Map size.** "Make it 2000x bigger." The world should make you want to move, you should always be finding helpful upgrades, and it must stay balanced against the time spent on the map and the bosses.
2. **Rewards.** Chests hold only items. Level-ups give spells, traps and creatures. Boons are random stat increases. Rarities go up to legendary, and there should be tons of items.
3. **Difficulty and unlocks.**
   - A new player has about a 50% chance of even finding the door (the gate).
   - The world is seeded and procedural, but never a random mess of junk.
   - Vases crack open, with a rare chance of a pickup.
   - Everything is balanced hard. A first-time player may not get through stage 1.
   - It is a roguelite. You start with very little and unlock characters, weapons and everything else by dying and playing.
   - Keep the systems we already have (the free 1-of-3 item at the Witness Stone, shrines, the Broker, chests, Oaths and so on).
   - Art and assets come later.

Rules that stay in force:
- Copy how the reference videos play (readability, payout pace, density). Never copy their names, words, icons or art. Never write another game's name in the repo.
- Footage stays on the owner's PC.
- Stay with the Carved Cards style bible.
- Keep the approved run feel (LEG_DEG 30, chase camera).
- Gate guidance stays as is: no sky beam, red wind within about 80 to 90 m, and the gate is off the minimap until fog reveals it.

## 0. Research first (before any tuning)

Go back through every video in the owner's reference videos folder, including any new ones. Write the numbers into `reference videos\ref\findings-rewards.md` on the PC only, and summarise them in section 9 below. Record frame times for each number. Anything not seen stays "Not seen".

Measure:

- **Pickups:** every kind that drops from enemies, pots/vases or the ground (health, time stop, speed, magnet, bomb and so on). Record what each does, how long it lasts, how often it shows up per minute, and where it comes from.
- **Vases:** how many you see per minute of travel, what share drop something, and what they drop.
- **Chests:**
  - free chests found per stage and the time between them;
  - paid chest prices as the run goes on;
  - how often elites drop chests;
  - the rarity mix of what came out.
- **Other sources:** shrines, shops and free-pick stones. How many per stage and the time between each.
- **Pace:** items owned at 2, 5 and 10 minutes, and level-ups per minute over the run.
- **Enemies:**
  - pack sizes and enemies on screen at 1, 3, 5, 8 and 10 minutes;
  - when elites and bosses come;
  - how the deaths in the clips happened, and at what minute.
- **Gate:** distance and time from spawn to the gate when the player went for it, and anything that pointed them to it.
- **Unlocks:** what a run unlocks and what the menus show as locked (from the menu screenshots already studied).

Update the reference PDF with a new section: Rewards and Pace (theirs, ours now, what we change).

## 1. The world: 2000x the area

- The playable desert goes from about 720 m across to **about 32 km across**, ringed by far mountains. Map id stays `ruins`.
- The world is streamed in seeded chunks. Each chunk is made the same way from (seed, chunk x, chunk z), loaded around the player and dropped behind. The target is 60 fps on a phone, with no frame over 33 ms when a chunk loads. Rebase the origin when far from centre.
- **The land has a plan, not junk.** A seeded macro layer lays out regions of 1 to 3 km. Each region has one character:
  - a dune sea;
  - a mesa field;
  - a dry lake bed;
  - a canyon run;
  - a ruin field of old carved stone cards;
  - a dead forest;
  - a ridge spine.
  
  Every region has 1 or 2 landmarks you can see from far off (tall mesa, arch, giant half-sunk card, dead giant tree). Landmarks steer you without a beam. Same seed, same world.
- **Sight lines.** Ridges, mesa edges and dune crests hide points of interest until you are about 40 to 120 m away. High ground clears more fog around you, so climbing pays off.
- **Movement worth doing.**
  - Long downhill slides keep their speed.
  - Hop chains go off crests.
  - Wind-swept flats are fast lanes. Soft sand is slower, but nothing is ever sticky or janky.
  - Movement grows through the run from boons, items and pickups. Move speed ceilings are set for the big world (see section 4).
  - The starting kit reaches everything. Late builds only get shortcuts.
- **Density follows the player.** Things to do are placed per chunk in pockets: a camp, a shrine, a stone, a vase cluster, a chest, a sleeping elite, a puzzle or platforming pocket.
  - From anywhere, the next pocket is about 20 to 45 s of normal travel away.
  - Empty desert for more than about 60 s counts as a fault (check tool section 8).

## 2. Stage length and the exit door (owner, 10:14 PM ET 24 Nov)

Each stage is **12 minutes**, so a full run is 12 + 12 + 12. Feel target: switch off your brain, things explode, a steady stream of dopamine hits like the best horde games and loot games. The fun comes from fighting and finding things, never from doing chores.

- **The door appears near the player.** Between **8:00 and 10:00** on the clock (seeded), the exit door rises procedurally at a point about **150 to 300 m** from wherever the player is.
  - It is placed behind a ridge or mesa where it can be, so it has to be looked for.
  - It always sits on ground the starting kit can reach.
  - A slim banner and a low rumble say it has risen. There is no beam and no minimap pin until fog reveals it.
  - The red wind leads in within about 80 to 90 m.
- **Waking it is my call: no chores.** Hold to wake, as built, which brings the boss. Then the end horde comes and the way on opens.
- **Optional speed-up.** Sleeping elites and rumour stones found earlier each make the door rise 30 s sooner (down to 6:00 at the earliest) and closer. Exploring is rewarded but never required.
- **Clock end (12:00).** If the door has not been woken, the horde rises as now and keeps growing until the door is woken.
- **About 50% for a new player.** The new-player bot (fresh save, goes toward what it sees, takes the nearest pocket, simple dodging) should find and wake the door before 12:00 in **40 to 60%** of 200 seeds. A skilled bot should do it in 90% or more.
  - Tune with the spawn distance band, how well it is hidden, and how hard the late swarm is. Never with a beam.
  - Failing to find it is not instant death: the growing horde is the price.
- Timings scale: `stages.js` gets clock 720, doorRise [480, 600], and the wave tables are stretched to 12 minutes, with stages 2 and 3 starting harder.

## 3. Rewards: one source, one kind

| Source | Gives | Notes |
|---|---|---|
| Level-up | **Cards only**: spells, traps, creatures to summon, and level-ups of owned cards. Pick 1 of 3. | Fusion offers stay. |
| Chests (free placed, elite drop, paid) | **Items only.** | Rarity is rolled at opening and shown by the build-up reveal (common, rare, epic, legendary). Nothing on the outside shows rarity. Paid chest price rises with each one you buy. |
| Witness Stone | Free item, pick 1 of 3. | Kept. |
| Relic Broker | Items for coins. | Kept. |
| Shrine (boon) | **Random stat increase**: pick 1 of 3. | Each boon is one stat, with its size rolled by tier. |
| Vases | Coins and XP, with a rare chance of a **pickup** (section 5). | Banded vases always drop something. |
| Elites | Chance of an open item chest. | |
| Card Chest (old) | Retired. Level-ups now carry the cards. | Saves and quests that counted Card Chests now count chests. |

**Item count target: about 120 at launch.**

| Rarity | Count | What it is |
|---|---|---|
| Common | 45 | Plain stat items. |
| Rare | 40 | Conditional or proc items. |
| Epic | 25 | Build-defining. |
| Legendary | 10 | Run-changing, single only. |

- Reuse the 20 built items and the 12 planned names.
- Group them by what they help:
  - card throw;
  - monsters;
  - spells;
  - traps;
  - movement;
  - defence;
  - economy;
  - exploration (fog, rumours, landmark reveal);
  - risk/greed.
- Every item has a one-line effect a player can read. Stacking stats have ceilings (ITEM_CAPS).
- Legendaries change how a run plays. Some examples, all ours:
  - a crown that summons a second copy of each creature;
  - a deck that refills a spent spell on every 100 kills;
  - boots that turn slides into flight for 2 s.

## 4. Balance by the run clock, not by distance

- Enemy strength, pack size, elites and bosses follow the stage clock, as they do now. Spawns stay around the player.
- Reward value follows the clock too: chest and boon tiers, and Broker stock, scale with time. Going far away is not free power, and standing still is not safe.
- **Pace targets** (tune to section 0's numbers when they arrive):
  - about 5 level-ups a minute early, easing later;
  - first item by about 0:45;
  - 4 to 6 items by the gate on stage 1 for an explorer;
  - first Fusion 5:30 to 7:00.
- **Move speed ceiling:** +100% from all sources, as now. The big world is crossed by slides and fast lanes, not by uncapped speed.

## 5. Pickups (vase drops and rare enemy drops)

There are 10 kinds at launch. Each has its own look, one job, and reads from afar.

| Pickup | What it does |
|---|---|
| Heart | Heal 25. |
| Great Heart | Heal 60. |
| Coin Purse | Coins. |
| Lodestar | Pulls every XP crystal on screen. |
| Stopped Sand | Freezes all enemies for 5 s. |
| Wind Step | Double speed for 8 s. |
| War Drum | +50% damage for 10 s. |
| Ward | Blocks 3 hits. |
| Seal Burst | Clears normal enemies near you. |
| Rumour Shard | One gate bearing (section 2). |

- **Vase drop chances:**
  - 85%: coins and XP only;
  - 12%: one common pickup (heart, purse, Lodestar);
  - 3%: one rare pickup (the rest).
- Tune all of these to section 0.

## 6. Unlocks: start with very little

**A fresh save starts with:**
- 1 duelist (Kael);
- about 12 cards in the level-up pool;
- about 15 common items in the chest pool;
- 4 boons;
- Easy only;
- stage 1 only.

**Everything else unlocks by playing:**
- quests (kills, time survived, gates found, items found, deaths, Oaths);
- Star Chips spent in the Card Library;
- first-time finds in the world (a new item found counts toward its family's unlocks).

**Unlock targets:**

| What | Count |
|---|---|
| Duelists | 12 (4 now) |
| Starting creatures ("weapons") | each duelist has one; about 30 cards unlock across the game |
| Items | 120 |
| Boons | 16 |
| Pickups | 10 (6 start unlocked) |
| Stages | 3 |
| Difficulties | 3 |
| Oaths | as built |
| Cosmetics | later |

**Unlock curve target:**
- a new player unlocks something on almost every run for the first 10 runs;
- they clear stage 1 for the first time around run 3 to 6;
- the full game takes about 40 to 60 hours.

**First-run difficulty:**
- the new-player bot on a fresh save clears stage 1 in about **25 to 40%** of runs;
- the same bot with the first 10 runs' unlocks clears it in about 60%;
- a skilled bot fully unlocked clears stage 3 on Easy in 70% or more.

## 7. Order of work

1. Research (section 0). Write the numbers in section 9 and report a short summary.
2. Streamed 2000x world with regions, landmarks, pockets and sight lines (section 1). Check performance first.
3. 12-minute stages and the near-player exit door, tuned with the bots (section 2).
4. Reward split (section 3) and pickups (section 5).
5. Items to about 120, boons to 16 (data only, using shapes the game can already draw).
6. Unlocks and fresh-save start (section 6), with the save migration keeping everything older saves already own.
7. Balance passes with the bots until every target in sections 2, 4 and 6 is met. Write each pass in balance-log.md.

## 8. Checks before anyone sees it

- At least 3 seeds. Drive at least 8 spots, including 10 km or more from spawn.
- Both screen shapes: 412x915 and 915x412.
- Frame rate, and chunk-load spikes.
- Pocket gap timing on 3 drives (no gap over 60 s).
- Door find rates from the bots on 200 seeds, and the door distance and time on every seed.
- Clear rates on a fresh save and an unlocked save.
- Pace numbers against section 4.
- Report Pass, Fail or Not assessed honestly.

## 9. Research numbers (step 1, 24 Nov)

Method: contact sheets of the owner's recordings, one frame every 2 s with the video clock burned in. Small HUD text is often unreadable; those cells say "Not seen". Times are video time. All numbers are for the reference run on its first stage and the start of its second. Footage and names stay on the owner's PC.

**Level-ups** (run started at level 2, so the count is levels gained)
- Level 13 at 4:46, 31 at 9:36, 43 at 13:26. That is about 3.2 a minute over the first 10 minutes.
- Early gaps are slow: 24, 12, 28, 48, 52 s up to 3:10. Then 12 to 16 s once the swarm is being farmed (from 3:52).
- Horde bursts pay in bunches: 4 levels in 14 s at 9:36, 5 in 20 s at 5:00 to 5:20.
- Late gaps 30 to 70 s. Every level-up is a pause with 3 cards plus Banish, Skip and Refresh (Refresh costs about 25 coins early, 50 to 60 later).
- Ours: target about 5 a minute early. That is above theirs, so keep the first 3 minutes at 3 to 4 and let hordes spike it.

**Chests**
- 3 opened in the first 4:46, one per 80 s (0:36, 1:40, 3:32), all common. 8 unopened chests were seen on screen in the next 4:46 and 1 opened (rare, 8:36).
- Around the boss and portal the rate was 7 in 3.7 minutes (about 2 a minute): 10:00, 10:08, 11:24, 11:48, 12:32 (legendary), 12:42, 13:44.
- Rarity of the 8 that could be read: 6 common, 1 rare, 1 legendary. Rarity shows as beam colour during the opening reveal.
- Stage 2 first chest at 12 s in.
- Paid chest prices: Not seen. Elite chest drops: Not seen.
- Chest items offer Take or Banish.

**Vases and pots**
- Seen at about 0.4 to 2 a minute, in clusters (1:56 to 2:10, 6:10, 8:22). None seen broken, so share dropping something is Not seen.

**Pickups** (look only, the legend is not readable)
- XP crystals: constant, 5 to 20 a minute, burst on a horde kill.
- Gold coin type, a yellow oval: 1 to 3 on screen all the time from 0:48.
- White dice: the most common after crystals, 2 to 8 on screen from 5:00.
- Red heart: 4 in a cluster at 7:04 to 7:12, 2 at 12:16.
- Red magnet: 1:24 and 5:14.
- Cyan clock: 4:06, 10:48, 12:22.
- Purple lightning bolt 7:02, large yellow bubble 5:50, 6:28, 8:22, skull cage 11:14.
- A "Powerup Drop Chance" stat exists, so power-up drops are a rolled event.
- Roughly one rare pickup every 60 to 90 s.

**Shrines, shops, stones**
- Shrines: 1:16, 2:32, 7:36, 8:08, 8:50, 10:48. That is 2 in the first 4:46, 3 in 80 s at 7:36 to 9:00, then one at 10:48.
- Each shrine takes about 8 to 10 s to charge, then offers 3 stat boons plus Ignore. Rarity on offer: common, uncommon, rare. Typical boons are move speed, extra jumps, thorns, lifesteal, regen, armor, luck, XP gain, projectile speed, jump height.
- Shop: one stone figure at 3:12 with 2 item offers (one rare, one common) and Skip and Refresh.
- Free-pick stones: Not seen.

**Pace of items**
- Weapons plus tomes: 3 at 0:00, 5 at 1:00, 7 at 2:00, 8 at 3:00, then fixed at 8 (caps).
- Items: 0 at 0:00, 1 at 1:00, 3 at 2:00, 3 at 3:00, 5 at 4:00, 5 to 7 at 5:00 to 8:00, 8 to 9 at 9:00 to 11:00, about 12 at 13:00.
- So a player has about 3 items at 2 minutes, 5 to 7 at 5, 8 to 9 at 10. Our "4 to 6 by the gate on stage 1" fits.

**Enemies and bosses**
- On screen: 1 to 2 at 0:00, 12 to 18 at 0:28, 30 to 40 at 1:16, 25 to 50 at 2:30 to 3:00, boss plus 10 to 15 at 4:00, 100+ at 4:30 to 5:10.
- Horde peaks last 25 to 35 s with 60 to 90 s of calm between: 4:48 to 5:10, 6:04 to 6:30, 8:24 to 9:00, 9:14 to 9:18. Hundreds on screen at the peak.
- A banner warns before a swarm ("swarm incoming") about 2 s ahead.
- Elites are marked with a crown icon: first at 0:28, then every 1 to 2 minutes.
- First boss: appears at 3:10, 1,183 HP, dies at 4:30 (80 s fight), a swarm follows. The late boss is on the exit portal: spawns 11:42 (hold to wake), 18.9K HP, dies 12:16 (34 s). Another boss 4,989 HP died at 9:58 after about 20 s.
- Dust storm at 9:18 to 9:34: screen tint, minimap dims.

**Deaths** (two clips)
- Stage 1, death at 1:18 of a 1:23 run: the player woke a shrine, which spawned 15 to 20 melee scorpions on top of them at 58 s. HP 79 to 8 in 8 s (about 24 HP per 2 s), then 12 s at 4 to 6 HP with a red screen edge, dead at 78 s. The player had 1 level and 1 item. Lesson: a shrine trade (risk now, boon after) is lethal for a fresh build, and the red edge warns about 10 s early.
- Stage 2, level 45, 1:58 of a 2:04 clip: full 196 HP to 0 within 2 s from a boss attack, with two bosses of 76.5K HP and a screen full of damage numbers. Lesson: late deaths are one-shots from bosses, not slow grinds.
- Shrine spawns: a shrine charge (4 to 6 s dome) spawns 12 to 25 enemies around it. Shop (stage 1, 22 s): 3 items at 38, 81 and 87 coins (common, rare, rare), player had 30 coins and bought nothing. Shrine boons offered: 3 plus Ignore, rarities common, uncommon, rare, legendary seen once (21.5% projectile speed).
- Kills: 55 a minute early (219 in 236 s), a screen of 3 to 10 enemies; late builds show dozens of damage numbers at once.
- Stage 2 late build: 4 weapons, 4 tomes, 18 to 20 items, move speed 1.85x, luck 70 to 75%.

**The exit**
- The objective line reads "find the portal" the whole run. A stone arch is seen near the first boss at 3:10, again at 4:54 and 6:12, so a landmark is always near. The ring portal appears at 12:54 after the boss dies at 12:16, then the player stands in it for a charge (about 30 s) with a final swarm before it opens. Black screen at 13:28, new stage at 13:32.
- Pointing: a "!" glyph on screen edge and the minimap; no beam. Distance and time from spawn to portal: Not seen (the recording does not show the spawn point).

**Stage 2 first minute**: title card, first chest at 12 s, first enemies at 17 s, very few enemies for the first 30 s, no level-up in the first 28 s.

**Coins**
- 30 at 0:00, 72 at 1:44, 115 at 3:36, 159 at 10:14, 205 at 11:24, 256 at 12:12, 363 at 13:46. About 45 to 50 per few minutes. Coins are a trickle and spend on Refresh and the shop.

**HP**
- Full on every frame until the late boss: 113 max at level 13, 131 at level 31. At 12:00 to 12:16 HP dropped from 170 to 29 in 12 s (the boss fight), then healed to full by 12:30.

**What this means for the plan**
- Payout steady: a level-up every 12 to 50 s, a chest every 60 to 80 s, a shrine or shop every 60 to 90 s, a rare pickup every 60 to 90 s.
- The strongest rewards come as bursts during hordes and boss kills, not evenly. That is what feels like "things explode".
- Chests mostly common, rare and above are rarer than 1 in 5.
- Hordes with a warning banner, then a calm, then another.
