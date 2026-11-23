# Reference run breakdown for Duel Summoner (22 Nov 2026)

Sources: three recordings Randall made of one run of the reference game on **Forest, Tier 3**:
- **Video A** `20261122-2212-26.9161500.mp4` (51 s): run 0:11 to 0:49, first level-up, first shrine, the free gold chest.
- **Video B** `20261122-2215-53.7204872.mp4` (81 s): run 0:55 to 2:01, the boss portal arch, second shrine, pots with a "Break pot" prompt, the Shady Guy shop, first elites (crowned bees), and an elite-dropped glowing chest.
- **Video C** `20261122-2219-14.4746533.mp4` (31 s): run 2:05 to 2:23, slimes, a paid chest (price 30, then 72), the Aura weapon, the swarm, death and the death screen.

Part 1 (sections 1 to 15) covers video A. **Part 2 (sections 16 to 30) covers videos B and C and Randall's notes on chest types and side achievements.**

How this was read: one frame per second for the whole clip, three to five frames per second around every event, crops of the HUD and minimap, and a pixel scan for red streaks across every frame. Reference stills are in `duel-summoner/megabonk-refs-1122/` (numbered to match the sections below).

**Rule for using this doc:** The reference game is a reference for *feel, pacing and readability only*. Nothing in it (names, art, items, UI layout, fonts, icons) is copied. Every "Our version" below is our own design in Duel Summoner's world: Yu-Gi-Oh-style summons, Fusions, Spells and Traps, three seeded stages each ending in a gate boss, PS1-era look, native in the CardStashy app at 60 fps or better, touch and controller, phone and AYN Thor.

**Marks:** SEEN = visible in the video. GUESSED = my inference (how it works, what it gives, numbers) that the video does not prove. RANDALL = what Randall told us about it.

---

## Quick list (everything named)

| # | Thing | Seen / guessed | One-line job | Our version (name is a placeholder) |
|---|---|---|---|---|
| 1 | Countdown stage timer | SEEN | 10:00 per stage, pressure clock | Gate Clock, one per stage |
| 2 | Objective line "Find the Boss Portal" | SEEN | Tells the one goal of the stage | Rite line: "Find the Gate" checkbox |
| 3 | Red wind lines | SEEN (meaning: RANDALL) | Air streaks that point to the exit | Ley Threads toward the Gate |
| 4 | Minimap with compass, rotating | SEEN | Shows chests, shrines, exit once near | Scrying Disc |
| 5 | Red square on minimap | SEEN | Exit marker (the arch in section 18) appears when close | Gate sigil on the Disc |
| 6 | Gold chest (free item) | SEEN (free: RANDALL) | Free random item, Banish or Take | Sealed Chest (ties to Fusion rule) |
| 7 | Small wooden chests | SEEN | Paid chests | Tribute Coffers |
| 8 | Chest price counter (30) | SEEN (confirmed in video C, see 16) | Cost of the next paid chest | Coffer price on HUD |
| 9 | Pots / jars | SEEN (prompt "Break pot" in video B, see 19) | Breakable loot | Offering Urns |
| 10 | Charge Shrine (stand in zone) | SEEN | Stand in a dome, then pick a stat reward | Witness Stone |
| 11 | Shrine reward card with rarities | SEEN | 3 offers + Ignore | Witness Offering |
| 12 | Shrine Logs | SEEN | List of every shrine reward taken | Rite Ledger |
| 13 | Level-up "Upgrade Offers" | SEEN | 3 choices, Banish / Skip / Refresh | Summon Draw |
| 14 | Weapons (Dice, Katana) | SEEN | Auto-attacks, 4 slots | Monster Zones (4) |
| 15 | Tomes (Luck Tome) | SEEN | Stat books, 4 slots | Spell/Trap Zones (4) |
| 16 | Items (Borgar) | SEEN | Passive, unlimited | Relics (slotless) |
| 17 | Banished item shown with red X | SEEN | Memory of what you removed | Exiled pile |
| 18 | XP crystals + "+2" text | SEEN | XP drops from kills | Soul Shards |
| 19 | Gold coins + "$2" text | SEEN | Run money | Duel Coins |
| 20 | Silver counter (1,371) | SEEN number, meaning GUESSED | Meta currency kept after run | Star Chips (Duel Summoner only) |
| 21 | Kill counter | SEEN | Score and feel | Kill tally |
| 22 | XP bar (top, rainbow on level) | SEEN | Progress to next level | Summon Gauge |
| 23 | Stat popups ("Luck +", "Size") | SEEN | Confirms a stat changed | Stat whisper |
| 24 | Damage numbers | SEEN | Hit feedback | Life Point numbers |
| 25 | White hit flash | SEEN | Enemy turns white when hit | Hit flash |
| 26 | Goblin horde | SEEN | Basic chasers in packs | Stage 1 fodder |
| 27 | Level-up light pillar + burst | SEEN | Big moment feedback | Summon Pillar |
| 28 | Chest reveal light rays | SEEN | Loot ceremony | Seal-break ceremony |
| 29 | Big outdoor map with ruins, cliffs | SEEN | Exploration space | Seeded stage generator |
| 30 | Jump | SEEN | Platforming | Jump + ledges |
| 31 | Stats panel | SEEN | Full stat sheet in menus | Ledger sheet |
| 32 | Pause screen (map, tier, multiplier) | SEEN | Run info | Pause altar |
| 33 | Pond, logs, boulders, ruins | SEEN | Set dressing, cover | PS1 set pieces |
| 34 | Floating rune letters | SEEN | Ambience during shrine pick | Glyph motes |

---

## 1. Stage clock and the one goal

**Seen.** Top centre shows a countdown, 9:48 at run time 0:11, so each stage is about 10:00. Top left shows the run clock (0:11, 0:49). Under the item slots is a black tag with an empty checkbox: "Find the Boss Portal". It never ticks in this clip because Randall did not reach it. The run clock and stage timer both freeze while a menu is open (0:49 / 9:10 stay still across the chest reveal and pause).

**What it does.** One plain goal per stage, plus a clock that tells you how long you can farm before it gets dangerous. The game pauses in every menu, so picking an offer never costs time.

**Our version.**
- **Gate Clock**: one countdown per stage (our current budget is 8 minutes a run before Overtime; the build thread should decide stage lengths so three stages fit, for example 3:00 / 3:00 / 2:00 plus gate fights, or switch to per-stage clocks).
- **Rite line**: a single objective tag under the slots in our glass-and-gold HUD, written in our voice ("Find the Gate", then "Defeat the Gatekeeper", then "Step through"). It ticks with a small seal-stamp animation.
- Freeze the run clock in every menu, exactly as standard for the genre, so touch players on a phone are never punished for slower taps.
- GUESSED: in the reference game the boss portal must be found before the timer runs out or things get harder. Ours: when the Gate Clock hits zero, the Gatekeeper comes to you and hunters start (fits our Overtime rule).

## 2. Red wind lines (guidance to the exit) — the big one

**Seen.** Thin red streaks, like wind or speed lines, fly through the air in straight lines. They show at run time 0:44 (faint pink streaks in the sky, top left), 0:46 to 0:47 (a long red streak low over the grass by the ruins, crossing the screen right to left) and 0:49 (two red streaks cutting through the tree canopy). At 0:47, at the same moment, a **red square appears on the minimap edge** for the first time. Before that, the minimap showed only yellow, cyan and green icons. Still: `06-red-wind-and-minimap.jpg`, `09-minimap-before-after.jpg`.

**RANDALL.** The red wind guides the player to the boss door. The map is big enough that you will not see the exit until you are close; he spawned near it by luck. He compares it to Elden Ring's golden guidance.

**What it does.** A diegetic, in-world pointer. No arrow on the HUD. The world itself breathes toward the exit, so the player learns "follow the wind" without a tutorial. GUESSED: the streaks only start once you are within a range of the portal, and get denser as you get closer. The minimap marker shows up at the same range.

**Our version: Ley Threads.**
- Thin ribbons of crimson light (our colour choice can change; red reads well against our dusk palettes) that drift low over the ground and through the air, always flowing from the player's area toward the Gate. Each thread is a short, fading trail, never a solid line, so it never covers the battlefield.
- Three intensity steps, driven by distance to the Gate:
  1. **Far**: a thread now and then, high in the sky, slow. Reads as weather.
  2. **Mid** (Gate within about a third of the map): threads every couple of seconds at head height, plus a soft hum in the sound mix from that direction.
  3. **Near**: steady threads hugging the ground like a path, the Gate sigil lights on the Scrying Disc, and the Gate's light column becomes visible over trees.
- **Lore hook**: the Gate is a sealed duel door, and the threads are the "summoning circle's pull", the same energy our Fusions draw on. After the gate boss dies the threads turn gold and pull toward the open Gate.
- **Rules**: threads never pass through UI; never drawn over enemies in a way that hides them; at most around 6 on screen; on low-end phones fall back to 3. PS1 look: flat-shaded additive quads, no bloom, vertex-colour fade, 15 to 20 fps texture flicker on purpose.
- **Accessibility**: a Settings toggle for "Thread colour" (crimson, white, gold) for colour-blind players, and "Thread strength" (subtle / normal / strong).
- **Controller and touch**: no input needed. Optional: holding the minimap button (Select on pad, tap the Disc on touch) sends one bright thread pulse toward the Gate with a 20-second cooldown. GUESSED as a nice extra; the reference game shows nothing like this.
- **Thor**: on the bottom screen the Scrying Disc can be a bigger map with the thread direction drawn as an arc on its edge.
- **Generator hook**: the seeded map generator must output the Gate position plus a "thread path" (a few waypoints around cliffs), so threads bend around walls instead of pointing through a mountain. This matters because our maps have real platforming.

## 3. Minimap (Scrying Disc)

**Seen.** Round minimap top right with N/E/S/W letters on the rim that **rotate with the camera** (the player arrow stays pointing up). Icons: yellow chest shapes (chests), cyan squares (the Charge Shrine was cyan; it was near the player at 0:35), a green square (GUESSED: another interactable, maybe a merchant or special shrine), white dots (GUESSED: pots or small pickups), and later the red square (exit). Dark grey blocks on the disc show terrain shape.

**Our version: Scrying Disc.** A round lens framed in tarnished gold, ours. Icon set ours: chest = small seal, Witness Stone = eye, Coffer = coin, Gate = crimson sigil, boss = horned mark. Rotating rim like the reference game is standard for a third-person camera and should stay. Fog of war: we only draw what the player has been near, which makes the threads matter. Touch: tap to open a full-screen map; pad: Select. Thor: the full map lives on the bottom screen all the time (no dead space).

## 4. Gold chest (free item) and the reveal

**Seen.** At 0:47 a bright gold chest sits on a dirt path. Randall runs into it at 0:48. The game pauses and shows a framed panel: the chest sits in the middle, a beam of cyan light shoots out the top (0:49), rays of white light burst behind the panel, the item flies up over the chest with its rarity in big letters ("COMMON") and its name ("Borgar"), then the item card shows its effect ("42% chance to spawn Borgar upon killing an enemy") with two buttons: **Banish** and **Take**. He pressed Banish; the world resumes with the item icon and the word "BANISH" floating over his head. Gold stayed at 13, so it cost nothing. On the pause screen the banished item sits in the inventory with a red X.

**RANDALL.** Gold chest means free item.

**What it does.** A free, random, rarity-rolled passive item, with a big ceremony so loot feels special. Banish removes it from the pool for the run (GUESSED: so it cannot roll again, which lets players steer builds).

**Our version: Sealed Chest.**
- Ours already exists in the rules: Sealed Chests give items, and when two partner monsters are at level 10, the next Sealed Chest is the **Fusion** chest. Keep that. This video shows why the reveal must be a ceremony.
- **Reveal**: camera holds, our card-back spins up out of the chest and flips, rarity band colour floods the frame, card name in our font, effect text, then **Claim** / **Exile** (Exile = our word for banish, it also fits Yu-Gi-Oh language). On a Fusion chest the reveal is bigger: both partners fly in, swirl, and the new monster card flips (this is our signature moment; the reference game has nothing like it).
- **Exile** puts the card in an Exiled pile shown on the pause screen, greyed with a seal stamp, not a red X.
- Free Sealed Chests should be rare on the map (2 to 4 per stage, GUESSED from the minimap showing about 5 chest icons in view at once, most of them paid).
- Touch: big buttons at thumb height. Pad: A = Claim, Y = Exile. Thor: the reveal plays on the top screen while the card text and buttons sit on the bottom.

## 5. Paid chests and the price counter

**Seen.** Small wooden chests with red-brown trim on the ground (0:23 two near the player, 0:26). Top right of the HUD shows a chest icon, a gold coin and "30" the whole time.

**GUESSED.** Wooden chests cost gold to open, the "30" is the next price, and the price rises each time. Randall did not open one in the clip (he had at most 13 gold).

**Our version: Tribute Coffers.** You pay Duel Coins as a tribute (fits our tribute theme). Price shown on the HUD beside the coin count, and above the coffer when you are near. Price climbs per opening in the run. A coffer opens with a smaller version of the Sealed Chest ceremony (no full-screen rays, just the card flip) so it does not drag.

## 6. Pots (Offering Urns)

**Seen.** Small orange and brown jars on the grass: one at 0:16 near the player, one by the log at 0:35, and a brown jar with a "+1" pop over it at 0:38 as Randall runs past. Still `02` and `04`.

**GUESSED.** Pots break when hit or touched and drop gold, XP or sometimes a pickup (magnet, heal). The "+1" may be coin or XP from one.

**Our version: Offering Urns.** Clay grave urns and lantern jars left at the ruins of the duel grounds. They break to your attacks or a touch, crack into 3 to 5 flat-shaded shards (PS1 style) and drop Duel Coins, Soul Shards, or rarely a pickup: **Heal Bread**, **Magnet Bell** (pull all shards), **Brief Shield**. Placement from the generator in small clusters near ruins and paths, so they lead the eye along the route (a second, quieter guide). Each break plays a crisp clay clink with a pitch shift so chains of urns feel good.

## 7. Charge Shrine (Witness Stone)

**Seen.** A stone lantern-like pillar with a big "!" over it (0:32). When Randall stands next to it, a large **yellow-green translucent dome** appears around it (0:34 to 0:38). He stays inside about 4 seconds while still fighting (kills go from 4 to 7). It "charges" (the word "Charged!" shows behind the panel), then a panel opens: **Charge Shrine — "The shrine offers you a reward"** with three offers in coloured bands with rarity labels: Rare "Gain +7 Thorns" (purple), Legendary "Gain 20% Powerup Multiplier" (gold), Uncommon "Gain 9.6% Difficulty" (blue), plus "Ignore Offers" (red). Hovering shows a tooltip ("Powerup Multiplier increases the power of powerups effect & duration"). Floating rune letters drift across the screen while the panel is open. He took the Legendary; text "20% Powerup Multiplier" floats over the player afterward. Stills `04`, `05`.

**What it does.** Risk for reward: you must hold a spot while the horde comes. The reward is a permanent stat for the run, with rarity bands. Some offers are traps (Difficulty up gives more enemies and more score, GUESSED).

**Our version: Witness Stone.** Our existing name in the old map spec; keep it.
- A worn stone tablet with an eye carved in it. Step in, and a **summoning circle** draws itself on the ground (flat PS1 decal, ring by ring) instead of a dome. You must stay in the circle about 4 seconds while monsters come; leaving pauses (GUESSED rule: in the reference game it seemed to pause; ours pauses and slowly drains).
- Reward: three **Witness Offerings** as small cards with our rarity bands (Common, Rare, Super Rare, Ultra Rare, Secret Rare, the Yu-Gi-Oh rarity ladder our players know). Plus **Decline**.
- One offer in some rolls is a **Pact**: a power gain with a cost (for example "+15% Fusion speed, enemies +10% HP"). This replaces the reference game's Difficulty offer with something that fits our duel theme.
- Glyph motes (our own glyphs) drift across the screen while picking, like the rune letters seen here.
- Tooltip on hover/focus for every stat word.

## 8. Shrine Logs (Rite Ledger)

**Seen.** Pause screen, left side, "Shrine Logs": 20% Powerup Multiplier, 50% Silver Gain, 1.2x Silver Gain, 5% Silver Gain. So shrines from before the clip or from meta bonuses were logged too.

**Our version: Rite Ledger** on the pause screen: every Witness Offering and Pact taken, in order, with the stage it came from. Ties into the "Ledger stat sheet" already planned.

## 9. Level-up offers (Summon Draw)

**Seen.** At 0:32 he hits level 1. A light pillar rises from the player, the XP bar at the top turns rainbow, white rays burst, coloured crystal shards fly, and the game pauses on **Upgrade Offers** with three cards: Katana "New" ("A sharp blade that targets the closest enemy"), Dice "Common, LVL 1" (Crit Chance 11% to 21%, Damage 0 to 2), Luck Tome "New" (Luck 0% to 8%). Three buttons under them: **Banish**, **Skip**, **Refresh**, each with a small number above (GUESSED: uses left). Inventory panel on the left (Weapons, Tomes, Items), full stat sheet on the right. He took Katana; the Katana icon fills weapon slot 2. Still `03`.

**What it does.** The core loop choice: new weapon, upgrade a weapon, or a stat book. Before/after numbers in green make the choice instant to read.

**Our version: Summon Draw.**
- Three face-up cards slide out of a deck on the table (our card frames, not plain bars). Each shows: card art, name, "New" or current level, and the exact change with before → after in green.
- Card types: **Summon** a new Monster (fills a Monster Zone), **Level up** a Monster (1 to 10, form changes at 5 and 10 get a special banner "EVOLVES"), **Set** a Spell or Trap (fills a Spell/Trap Zone), or level a Spell/Trap (1 to 5).
- Buttons: **Exile** (remove from pool), **Pass**, **Redraw** (with uses shown as small pips, not a raw number).
- Partner hint: when a card would complete a Fusion pair, a gold thread links it to its partner in your zones, so players learn Fusions without a wiki.
- Pad: D-pad to move, A pick, X redraw, Y exile, B pass. Touch: tap to pick, long press for full text. Thor: three cards across the top screen, stat sheet and zones on the bottom.

## 10. Weapons, Tomes, Items (Monster Zones, Spell/Trap Zones, Relics)

**Seen.** HUD top left: 4 weapon slots then 4 tome slots (2 rows of 4). Weapons seen: **Dice** (white dice thrown at enemies; they bounce, white impact puff; damage numbers 1 to 11) and **Katana** (yellow-white pixel slash streaks toward the closest enemy). Tome offered: Luck Tome. Item seen: Borgar (food spawns on kills, a heal, GUESSED).

**Our version.** Already decided in our rules: 4 Monster Zones (weapons, your summoned monsters fight beside you), 4 Spell/Trap Zones (tomes), slotless Relics (items). What this video adds for the build:
- Each attack needs a **readable signature shape** at gameplay distance: the dice were readable because they were white cubes on green. Ours: every monster's attack gets a distinct silhouette and colour against each stage palette.
- Slot icons show level as small pips under the icon (the reference writes "LVL 1"; we use pips plus a star at 5 and a crown at 10).

## 11. Pickups, currencies and counters

**Seen.**
- **XP**: pale blue crystals drop from kills and fly to the player, with "+2", "+4" pops in cyan.
- **Gold**: small coins, "$1", "$2", "$3", "$4" in yellow over the player.
- **HUD top bar**: run clock, a white coin with 1,371 (ticks to 1,372 during the run), gold (2 to 13), skull kills (2 to 13), chest price 30, LVL.
- **Stat pops** in white with green numbers float off to the side: "Luck 0.3%" when collecting crystals at 0:17 and 0:32 (GUESSED: a luck tick from something), "Size" after level-up, "20% Powerup Multiplier" after the shrine.

**GUESSED.** The 1,371 counter is "Silver", a meta currency kept after death (the stat sheet lists "Silver Gain 1.9x", and the pause screen shows "1.2x" with a silver icon under the map tier).

**Our version.** Soul Shards (XP), Duel Coins (run money), **Star Chips** (Duel Summoner's own meta currency; no currency crosses between games, and Marks stay facts about what the player did). Keep the floating number pops but group them into one short stack above the player (max 3 lines) so they never cover enemies on a small phone.

## 12. Game feel and effects

**Seen.**
- **Hit flash**: enemies flash pure white for a frame or two on hit (0:13, 0:42).
- **Damage numbers**: chunky white pixel digits with a dark outline, tilted, that pop and fall.
- **Level-up**: vertical light pillar from the player, ring on the ground, screen rays, coloured shards. About 1 second before the menu.
- **Chest reveal**: beam, rays, item rises. About 1 second.
- **Jump**: player jumps on logs and slopes (0:41, arms up).
- **Camera**: third person, behind and above, follows the run direction, tilts with slopes. Wide FOV.

**Our version.** Keep all of these feel beats with our own look: white hit flash (cheap, reads on any screen), our own digit font, a **Summon Pillar** in the monster's element colour on level-up, ground summoning circle under the player. Each beat must hold 60 fps on the Thor and a mid phone; effects are flat quads, vertex colours, no post-processing (also fits the PS1 era).

## 13. Enemies and horde shape

**Seen.** Only one enemy type in the first 50 s: green goblins, low-poly, in loin cloths. They come in loose packs; at 0:17 about ten run in from the left together. Kills are slow early (13 kills by 0:49).

**Our version.** Stage 1 fodder should be our own creatures (rule: monsters are creatures). The pacing match matters more than the look: a quiet first 30 seconds, a first pack at about 0:15, first level-up at about 0:30 (matches Randall saying our levelling is too fast; the reference game's first level took about 30 s here).

## 14. The map

**Seen.** Big open forest on rolling hills, steep grey cliff walls at the edges, ivy-covered brick ruins and broken towers, boulders, fallen logs, a small pond, dirt paths, background towers in fog. Plenty of space; Randall could not see the exit until it was close. Texture is low-res and pixelated, chunky trees with pixel leaves.

**Our version.** Our seeded generator (already planned) should place, per stage: 1 Gate (far from spawn, but with a thread path), 2 to 4 Sealed Chests, 6 to 10 Tribute Coffers, 2 to 3 Witness Stones, 15 to 30 Urns in clusters, ruins as landmarks so players can say "the Gate was by the broken tower". Paths of dirt should naturally lead toward the Gate (a third, quiet guide after threads and urns). GUESSED: the reference game tiers the same map (this was "Forest Tier 3"); our three stages each have their own biome and the gate boss.

## 15. Stats panel and pause screen

**Seen.** Stats panel lists: Max HP 101, HP Regen 10, Overheal, Shield, Armor, Evasion 6%, Lifesteal, Thorns; Damage, Crit Chance 6%, Crit Damage 2.0x, Attack Speed 100%, Projectile Count, Projectile Bounces; Size 1.1x, Projectile Speed, Duration, Damage to Elites, Knockback, Movement Speed; Extra Jumps, Jump Height 7, Luck 1%, Difficulty 0%; Pickup Range 10, XP Gain, Gold Gain, Silver Gain 1.9x, Elite Spawn Increase, Powerup Multiplier 1.2x, Powerup Drop Chance. Pause screen: map name and tier, currency multiplier, Inventory, Shrine Logs, Resume / Map / Settings / Restart / Exit.

**Our version.** Our Ledger sheet should cover the same ground in our words and groups: Life (Life Points, regen, shields), Attack (ATK, crit, speed, count), Field (area, duration, knockback, speed), Fate (luck, Pact level), Harvest (pickup range, Soul/Coin/Mark gain). Add rows only we have: Fusion progress, element reaction strength. Pause screen in our glass-and-gold style with a **Map** button (full map with threads drawn).

---

## What Randall did not reach in this clip (to record next)

The boss portal itself, the boss fight, a paid chest, the merchant or green minimap icon, death or stage clear, later-stage enemies and elites, Overtime. A second recording that reaches the portal would let us time the "near" range of the red wind (when it starts relative to the distance).

## Suggested build order for the Duel Summoner thread

1. Ley Threads + Gate sigil on the Scrying Disc (needs Gate position and thread path from the generator). Highest value: it is what Randall called out.
2. Sealed Chest ceremony with Claim / Exile (and the Fusion version).
3. Witness Stone (circle, hold, three offerings, Pact).
4. Offering Urns with drops.
5. Tribute Coffers with rising price.
6. Summon Draw screen polish (before/after numbers, partner thread, pips).
7. Pause screen: Rite Ledger, Exiled pile, Map.

---

# Part 2: videos B and C, plus Randall's notes

## 16. Three kinds of chest (the nuance Randall pointed out)

**RANDALL.** Gold chests are **seeded, set drops placed when the map is generated**. The open, glowing chest in video B dropped from his **first elite**, and elites have a **random chance** to drop one like that. Paid chests are the third kind.

**Seen, all three side by side:**

| Kind | Look (seen) | How you get it | What happened in the run |
|---|---|---|---|
| Gold chest | Solid bright gold, small, closed, sits on the map | Seeded on map spawn (RANDALL) | Free; Common "Borgar" (video A, 0:48), banished |
| Elite chest | Pale wood and white trim, lid **already open**, a tall beam of light rising out of it so you can see it from far away | Random drop from an elite (RANDALL) | Video B, 1:59 to 2:01: dropped in the middle of the swarm, ran over to it, "Open" button, cyan beam, **Rare "Phantom Shroud"** ("After evading, deal 2x damage next attack, and temporarily increase Attack Speed and Movement Speed"). Free. |
| Paid chest | Brown wood with red-brown trim, closed, price tag floating over it ("30") | Placed on the map, costs gold | Video C, 2:20: opened for 30, the HUD price then jumped from **30 to 72**. Gave an item (blue winged icon). |

So the HUD counter beside the chest icon (always "30" until then) **is** the price of the next paid chest, and it more than doubles after one purchase. This is now SEEN, not guessed.

The elite chest's ceremony is the same as the gold one (panel, beam, rays, rarity word, item card, Banish / Take), but its beam colour matched the rarity (cyan for Rare). GUESSED: beam colour shows rarity before you open it.

**Our version: three chests, each with a clear job.**
1. **Sealed Chest** (seeded, free): placed by the stage generator from the seed, so the same seed always has the same Sealed Chests in the same spots (good for leaderboards and replays, which already depend on deterministic seeds). Look: a black lacquer box bound in gold chains with a seal on the lid. Rewards Relics; when two partners are at level 10, the next one opened is the **Fusion chest**.
2. **Trophy Chest** (elite drop, free, random): when an elite dies there is a chance (we tune it; start around 15% for the first elite and decline per drop, GUESSED values) that its card "falls" out as a glowing open chest with a pillar of light in its rarity colour, visible across the map. This is the moment that makes elites exciting instead of scary. Must use the seeded RNG so replays verify.
3. **Tribute Coffer** (paid): price shown over it and on the HUD. Price curve to match the feel seen (30, then 72): roughly price = 30 × 2.4^n, capped, tuned by the build thread.

Reveal ceremony for all three is the same shell (keeps code and art small), with a bigger, slower version for the Fusion chest.

## 17. Elites (crowned enemies)

**Seen.** From about 1:24 in video B, some bees and later some slimes have a **small gold crown** over their heads. They are bigger, take more hits, and the crown is the only marker. The first elite kill came at about 1:59 and dropped the glowing chest. The stat sheet has "Damage to Elites" and "Elite Spawn Increase" rows, and a Charge Shrine offer pop said "Elite Spawn Increase / Powerup Drop Chance".

**Our version: Ace monsters.** A floating gold star-crest over the head (our symbol, not a crown), a thin gold outline, and an entrance cue (a short card-flip sound and a ring on the ground where it spawns). They carry the Trophy Chest roll. Stat rows: "Damage to Aces", "Ace spawn rate".

## 18. The boss portal (Gate) — what it actually looks like

**Seen (video B, 1:02 to 1:05).** A tall **stone arch with a skull on top**, standing on a **three-step octagonal stone platform**. When the player walks onto the platform a prompt shows: **"[E] Spawn Boss"**. Randall walks across it and leaves without pressing it, so the boss is **summoned on purpose** by the player, not forced. The minimap red square was this arch. Red/pink wind streaks were visible in the sky toward it in the frames just before. Still `10-boss-portal-arch.jpg`.

**What it does.** The player chooses when to fight the boss: farm longer and be stronger, or go early. The timer still runs (GUESSED: when it hits zero, something forces the issue).

**Our version: the Gate Dais.** A ring of standing stones around a sunken duel circle, with a sealed stone door in the middle carved with the stage's gatekeeper. Prompt: **"Challenge the Gatekeeper"** (pad A / touch button that appears only on the dais). Pressing it: the door's seal cracks, the gatekeeper is summoned from the door in a full summon animation (our Yu-Gi-Oh flavour), and the arena edge closes in. This keeps the reference game's good idea (player picks the moment) in our language. The Ley Threads (section 2) lead here.

## 19. Pots (now seen properly)

**Seen (video B, 1:10 to 1:12).** Two kinds of pot on the ground near the second shrine: **small orange clay pots** and **pale blue glass vases**. Walking up to one shows the prompt **"Break pot"**, and gold pops follow (a "$10" by it). One large cyan pot is knocked over in the shrine zone. Still `11-pots-and-shrine.jpg`.

**Our version.** Same as section 6, now confirmed as interactable. Two tiers: **Clay Urns** (common, coins and shards) and **Spirit Jars** (pale glass, rarer, chance of a pickup or a small card). Breaking is automatic when you attack them or walk into them; no button needed on touch (one less prompt on a small screen).

## 20. Second Charge Shrine

**Seen (video B, 1:11 to 1:15).** Same pillar, same dome (blue-white this time, not yellow), about 4 seconds. Offers: Uncommon "Gain 9% XP Gain", Common "Gain 10% Jump Height", Uncommon "Gain 7.2% Lifesteal" (tooltip explains lifesteal: "Your chance to heal for 1 when you hit an enemy. Over 100% will guarantee 1 heal, and give a chance to heal for a total of 2"). He took Lifesteal. The Shrine Log then lists it first.

**Note for ours.** The dome colour changed between shrines (GUESSED: dome colour = best rarity on offer). Ours: the summoning circle's colour shows the best rarity waiting, so a player can decide if it is worth standing in the swarm.

## 21. Shady Guy shop (merchant)

**Seen (video B, 1:33).** A small grey hooded figure stands in the field with a "!" over him. Walking up opens **"Shady Guy Shop"** with flavour text "Every item is suspiciously warm, as if he was just holding it under his coat", and three items with gold prices: Common Borgar 20, Common Cursed Doll 41 ("Curse an enemy, dealing 30% of their Max HP every second"), Rare Backpack 75 ("+1 Projectile Count for all Weapons"). He buys one (gold 69 to 29, so the Cursed Doll for 41 — the doll icon appears in Items) and the merchant says "Thanks" as you leave. He was the green square on the minimap (GUESSED from position).

**Our version: the Card Broker** (already in our older notes as "Broker"). A cloaked dealer with a folding table of face-down cards on a cloth. Three cards for sale at Duel Coin prices, one line of his own flavour text per visit (written by us, a pool of 20 or so so it stays fresh). Buying flips the card toward you. He leaves after one purchase or when the stage ends. Seeded position per stage.

## 22. Level-up offer details we missed in part 1

**Seen.**
- Video B 0:55: Shield Tome (Shield 0 to 25), Lightning Staff ("Summons lightning to smite nearby enemies"), Dice (crit 12.5% to 22.5%). He took Lightning Staff (third weapon).
- Video B 1:29: Knockback Tome, Size Tome, Chaos Tome ("Boost a random stat"). The Banish button carries a **gold cost (5)**, and Banish, Skip and Refresh each show **uses left** above them (6, 7, 7). Still `13-offers-banish-cost.jpg`.
- Video B 1:56: Shield Tome, Katana Size 100% to 120%, XP Tome. 
- Video C 2:18: HP Tome, **Aura** ("Damage enemies in an area around you"), Firestaff ("Shoots fireballs that explode on impact"). He took Aura: a white-blue ring of pixel arcs around the player from then on.
- After each pick a floating word confirms it: "Pickup Range 29.9%", "Speed — gotta go fast!", "XP Gain 5.5%", "Duration".

**Our version.** Exile costs Duel Coins and has limited uses (matches what is seen, and makes Exile a real decision). A **Chaos card** fits us perfectly: "Pot of Chaos" style card that boosts a random stat by a bigger amount than a normal tome (our own name, not a real card name). The confirmation word after picking should be in the monster's or card's voice ("Ignis answers!") rather than a stat name.

## 23. Enemy roster and the swarm curve (from all three videos)

**Seen.**
- 0:11 to 0:50: goblins only, small packs.
- From 1:05: **giant bees** arrive (big wings, fast, fly in lines), mixed with goblins.
- From 1:24: crowned elite bees.
- From 2:08: **green slimes** with faces, some crowned.
- By 1:45 to 1:55 the screen holds roughly 40 to 60 enemies in one dense moving clump; kills go from 13 (0:49) to 106 (2:23).
- HP falls from about 96 to 32 by 1:42, slowly recovers, then at 2:22 to 2:23 he is surrounded and goes from 21 to 0 in about one second.

**Our version.** Matches our planned difficulty curves. Things to copy in *feel only*: a new enemy family roughly every 60 seconds, the first Ace near 1:30, and swarms that move as a clump you can kite around. Things to avoid: deaths that feel instant (21 HP to 0 in one second). Ours: a red screen-edge warning and a heartbeat at 25% Life Points, so a phone player sees the danger before it is over.

## 24. Death and the death screen

**Seen (video C, 2:23).** The camera shrinks to a small box around the player, then the world goes black and only the character is left, frozen in a running pose, in the middle of a black screen. Text fades in: **"you ded"** and a joke line, then a **Confirm** button. Still `17-death-screen-sheet.jpg`.

**Our version: "Duel Lost".** The world fades to dark, your monsters turn to cards and fall around you, the player's life point counter rolls to 0 with the classic counter sound (our own), then a run summary: time, kills, stage, best Fusion, Star Chips earned, and buttons **Retry seed / New run / Leaderboard**. A short, dry joke line from a pool is fine; never mean.

## 25. Camera faults seen (to avoid)

**Seen.** Video B 1:42 and video C 2:23: the camera clips into a cliff wall and **half the screen goes black**. In tight spots between cliffs the view is blocked by rock.

**Our version.** Camera collision with a short pull-in, plus fade-out (dither) of any wall between camera and player. This matters more for us because our maps have real platforming and cliffs.

## 26. HUD extras seen in videos B and C

**Seen.**
- Status icons appear along the **bottom centre** of the screen in video C (small figures, GUESSED: active buffs like Phantom Shroud's speed up).
- "CRIT!" in yellow tilted letters on critical hits.
- "LEVEL UP!" in small letters over the player.
- Level-ups come about every 25 to 40 seconds by LVL 5 at 2:18.
- Lots of floating number pops stack up in the swarm and get hard to read.

**Our version.** Buff icons as small card corners under the HP bar, not at the bottom where thumbs sit on a phone. Merge damage numbers in big swarms (one number per enemy per 0.25 s). Crits in our gold.

## 27. Side achievements and secret unlocks (the music box)

**RANDALL.** Things like the **music box** are side achievements on the map that unlock other things, and we will have our own equivalent. (Not seen in these three videos.)

**What it is (GUESSED from his description).** A hidden, rare object on some maps; finding and using it counts as an achievement that unlocks something permanent (a character, item or mode), on top of the run.

**Our version: Lost Relics on the map.** A small set of rare, seeded **curiosity objects** that only appear on some seeds, each tied to an achievement in our shared Adventures achievement list (which pays packs), for example:
- **The Wind-Up Duelist**: a tiny clockwork toy on a broken pedestal. Wind it (stand next to it 3 seconds while it plays a music-box tune), and it walks off; follow it to a hidden Sealed Chest. Achievement unlocks a new starting monster.
- **The Shattered Seal**: our own relic design. One fragment per stage; collect all three in one run to unlock a secret character skin.
- **The Lonely Lantern**: light it at the start and keep it lit (no damage taken for 60 s) to unlock a Tome.
- **The Tribute Stone**: offer 300 coins; nothing happens (our "does nothing?" item from the Golden Ring note) until the gate boss dies, then it pays back triple.
These feed the cross-game achievements Randall approved for Adventures and pay packs in the app.

## 28. Pause screen, final state (end of video B)

**Seen.** Inventory now shows weapons Dice, Katana, Lightning Staff; items Cursed Doll, Phantom Shroud, banished Borgar (red X). Shrine Logs: 7.2% Lifesteal, 20% Powerup Multiplier, 50% Silver Gain, 1.2x Silver Gain, 5% Silver Gain.

## 29. Timing table (useful for our tuning)

| Event | Run time (seen) |
|---|---|
| First level-up | 0:32 |
| First shrine done | 0:39 |
| First free chest (gold) | 0:48 |
| Level 2 | 0:55 |
| Boss portal found | 1:03 |
| Second shrine | 1:15 |
| Level 3 | 1:29 |
| Shop | 1:33 |
| First elite seen | about 1:24 |
| Level 4 | 1:56 |
| First elite chest | 2:00 |
| Level 5 | 2:18 |
| Paid chest | 2:20 |
| Death | 2:23 |

## 30. Updated build order for the Duel Summoner thread

1. Ley Threads to the Gate Dais, and the "Challenge the Gatekeeper" prompt (player picks when the boss comes).
2. Three chests: seeded Sealed Chest, elite Trophy Chest (seeded random), paid Tribute Coffer with rising price.
3. Ace monsters (elites) with the crest marker.
4. Witness Stone with rarity-coloured circle.
5. Urns and Spirit Jars.
6. Card Broker.
7. Death screen and run summary.
8. Camera collision and wall fade.
9. Lost Relics (side achievements) tied to the Adventures achievement list.
