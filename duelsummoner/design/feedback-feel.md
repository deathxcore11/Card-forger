# Pickup and feedback feel: Duel Summoner spec for the PC builder

Scope: what the player sees, hears and feels when they pick up loot, earn a reward or land a hit. Everything is our own design. The reference is used only for its *structure* and *timing*. Its names, words, icons, shapes and colours are not used (see section 6).

Paths are relative to `duelsummoner/`. **H** means the duelist's height in world units. "On arrival" means the frame the sim emits the event (`pickup`, `levelup`, `kill` and so on). Timings are in real milliseconds. Easings use the usual names: `outCubic`, `inQuad`, `outBack(s)`, and `expo(tau)`, which means the value approaches its target as `1 - exp(-t/tau)`.

---

## 1. What makes the reference feel good

1. **Each reward plays in three beats, then glows.** The beats are a pop (0-100 ms), a trip to the player (200-400 ms), and a confirmation on the frame the loot arrives. An afterglow then runs for 300-900 ms. One button press on a pot paid out for about 900 ms: burst 100-300 ms, spray about 500 ms, twinkles 100-200 ms each, then ground glints until +900 ms.
2. **Loot comes to you, and you see it first.** Drops burst outward to about 1 H with an ease-out over 150-200 ms. They hang for 100-300 ms, then get pulled in with an accelerating magnet: the measured step grew from 25-30 px per frame to 45, then 80 px per frame. A drop from 5 m away reaches the hero in about 400 ms. Fast orbs stretch about 2:1 along their path.
3. **Everything confirms on the same frame.** The HUD counter, the "+N" popup and the start of the bar fill all change on the frame the item is absorbed, never before and never later. When 3 resources arrived together, all three readouts updated within 1 frame of each other.
4. **Merge, don't spam.** Each resource keeps one running total per streak ($1 → $15 → $20, +2 → +4 → +8), and the text re-pops at each bump. Totals last about 1.4 s. Stat lines last about 2.3 s, and no more than 2 are stacked at once. Ten coins never produce ten numbers.
5. **Bars jump, then settle.** Measured XP fills cover about 50% of the remaining distance every 100 ms (an expo curve with tau of about 140 ms). That puts 75-80% of the gain on screen within 200 ms, settled by 600-800 ms. You can read the amount at once, and the settle still feels like the bar is filling.
6. **Name first, then amount.** A stat label appears at 1.6-1.8x size and shrinks to 1x over 200-300 ms. The value arrives 200-300 ms later, in a "good" colour.
7. **Hits land in the world, not on the camera.** A hit turns the enemy white for 1 frame (≤100 ms) and adds an oversized bloom. A kill plays as a sequence: flash 100 ms, ring 100 ms, wisps 100 ms, debris 300-400 ms. The reference never shook the screen or froze time on routine hits, across a dozen checked kills.
8. **Afterglow stretches short events.** Twinkles last 1-2 frames each and ground motes take about 400 ms to fade, so a 300 ms collection reads as about 1 s of reward.
9. **Slow build, instant release.** The shrine charge built a colour tint over about 4.8 s (linear, then easing near full). The tint vanished in 0 ms, followed by a 500 ms burst. Level-up fired everything on one frame (light, number, bar), paused the world and every clock, and the menu scaled in over 200 ms.
10. **The feedback matches the game's theme.** The reference's effects are made of its own motifs. Ours must use **cards, seals and the duel**.

---

## 2. Event table

There are too many columns for one readable table, so it is split in two. **2a** (motion) and **2b** (channels) have the same rows in the same order, and together they hold every column requested.

### 2a. Trigger, world motion, particles, screen and HUD

| Event | Trigger | World motion (ms, easing) | Particles | Screen / HUD response |
|---|---|---|---|---|
| **XP crystal** | `pickup` kind 0 (`weapons.js:143`) | Spawn arc: rises 0.5 H in 140 ms (`outQuad`), falls to rest in 140 ms (`inQuad`), 1 small bounce of 0.08 H over 80 ms. Magnet (section 3.3): a 120 ms hop, then accelerating flight that curves toward the chest. Stretch along velocity of up to 1.8:1. On arrival: a violet seal-disc flash at the chest (our disc glyph, 0.35 H, 80 ms) | Trail: 1 speck every 40 ms of flight, lasting 200 ms, from the trail quota (section 3.8). On arrival: 3 specks (2 if the budget is above 70%) | No HUD mote. On the collect frame the bar ghost snaps forward and the fill eases with expo(110 ms). The leading edge glints for 300 ms |
| **Star Chip earned** | `game.starChips()` goes up (every 10 kills, elite, boss, Swift Seal), checked by the view each frame | A pearl 5-point star (0.3 H), matching the ★ HUD glyph, springs from the corpse that crossed the threshold: up 1.2 H in 220 ms (`outCubic`), holds 120 ms spinning, then flies in 450 ms (`inCubic`) to the ★ glyph on the existing COINS line. This flight is the only screen-space flight in the spec | 8 white specks on spawn; a ring of 6 pearl specks on arrival | No new row. The COINS line in `#topright` reads `COINS 15 · ★ 2` (same row, same font). Only the ★ number punches (section 3.4) |
| **Coin** | `pickup` kind 1 | Same arc as XP, but a vase or Ace scatters coins: each flies out radially 0.6-1.2 H in 160 ms (`outCubic`), hangs 120 ms, then is pulled in. Coins spin edge-on at 3 turns/s in flight | 2 gold specks on arrival. A burst of 6+ coins adds one gold ring of 0.9 H over 200 ms when the last coin lands | Coin counter changes on the collect frame, with a punch (at most 1 per 500 ms) and a digit roll for gains above 5. No HUD mote |
| **Heart / heal** | `pickup` kind 2 (+15 LP) | Arc as above, then pulled in. On arrival: a rose pulse ring rises up the body from feet to head in 260 ms (`outQuad`). At full LP: no ring | 5 rose specks drift up 0.6 H over 500 ms (none at full LP) | The LP bar gets a rose heal segment `#ff6f91` that fills from the old value to the new one over 300 ms (`outCubic`), then turns LP colour over 200 ms. The LP number punches |
| **Stat boon** (new: banded vase or shrine blessing gives a small permanent stat; until that ships, it fires on any stat gain from a blessing or item) | `boon` event (stat id, amount) | A boon slip (a small card, 0.5 H tall) flips out of the chest (180°, 220 ms, `outBack(1.4)`), holds face-up for 500 ms, then flies straight to its row in `#stats` (300 ms, `inOutCubic`). No rail | 10 specks in the stat's group colour as the card flips | When the slip lands, the stat row in `#stats` flashes and its value rolls over 300 ms |
| **Item gained** | An item card is chosen or bought (`field.js:208`) | Same slip as a boon, but full size (0.8 H), showing the item art and rarity border only. A rare or better item gets 1 extra spin before it flies straight to its new entry in `#itemsList` (300 ms) | 14 specks in the rarity colour; legendary adds a short beam (`fx.beams`, 500 ms) | When the slip lands, the new entry in `#itemsList` (with the item name) slides in from the left over 200 ms, with a 1 s rarity glow (a pre-made glow element whose opacity is animated) |
| **Card from chest** | An offer card is picked (`offer.js:18-27`, existing 520 ms flight to the field zone) | Keep the existing flight. Add a landing: the zone slot punches 1.12x over 160 ms (`outBack`), and a rarity-coloured rim flashes for 200 ms | 8 specks at the slot | The zone slot shows "NEW" or "LV n" for 1.2 s |
| **Chest open** | The existing reveal (`reveal.js:17-41`, `fx.js:91-93,155-162`) | Keep it as it is. **New:** a Card Chest opened in the world (`props.js:90`) gets a lid pop (lid rotates -70° in 180 ms, `outBack`) and a column of light 1.2 s tall that fades over 600 ms, before the reveal screen | 20 specks | Hand off to the reveal |
| **Shrine charge** | Hero inside the radius, `s.charge` rising (`world.js:118-122`) | See section 4 (curtain of light, basin water, arc fill) | Motes rise inside the curtain, at 4-12 per second as the charge grows | Shown only in the world: no HUD bar, and the `#prompt` text is removed (section 4.1) |
| **Shrine complete** | `s.charge >= hold` (`world.js:123`) | See section 4 (geyser, ring shockwave, 3 blessing cards rise) | 40 mint + 12 white | The view holds a freeze-frame for 600 ms, then the blessing offer opens. No banner |
| **Level up** | `levelup` event (`game.js:245-249`); the offer is already open in the sim | View-only beat over the frozen world, 420 ms. The XP bar flashes gold twice (80 ms on, 60 ms off). A white ring at the feet grows from 0 to 3.2 m over 400 ms (`outCubic`). 5 card backs fan up around the hero from feet to head over 360 ms (`outCubic`) and fade. Then the offer's staggered cards fly in (existing) | 22 gold (existing) + 10 white | The bar resets to the new level with the ghost carrying over. `#xpnum` (which reads `LV n …`, `hud.js:59`) punches on the frame the bar resets. That is the only level readout: no banner and no plaque after the offer closes |
| **Kill** | `kill` event | The enemy turns white (70% white mixed with its element colour) for 1 frame, then its body shatters into card shards: 6 flat quads (0.2 H) fly out 1 H in 250 ms (`outCubic`) with spin, and fade. At most 3 kills shatter per 100 ms; the rest get the flash and 3 specks. Above 50% of the particle budget, no shards | 6 shards + 6 in the enemy colour (existing) + 4 white specks (kill cap 16, section 3.8) | Kill counter ticks (no punch) |
| **Crit** | A hit with the crit flag (`fx.js:95-113`) | A gold round seal flare with a notched rim (0.6 H) behind the target for 90 ms. The target gets a 0.15 m knock offset, back over 120 ms. At most 1 flare per 100 ms; other crits get the number stamp only | 6 gold specks, with the flare only | None |
| **Damage taken** | `hurt` event (`game.js:261`) | Keep the existing red vignette (250 ms) and shake (0.28 / 0.55). The hero rim flashes red for 1 frame | 4 dark-red specks from the hit side | The LP bar flashes white for 60 ms, drops to the new value instantly, and leaves a red ghost that drains after a 250 ms delay over 400 ms (`inOutQuad`). The LP number shakes 2 px for 120 ms |
| **Magnet sweep** (new content: a Spell or Ace that pulls in all drops) | `sweep` event | Every live pickup does its hop, staggered 0-300 ms by distance, then flies in on the magnet curve with the speed cap raised to 48 m/s. No trails during a sweep. A thin violet `#8f6bff` ring (section 3.3) grows from the hero out to 40 m over 500 ms (`outQuad`). Its alpha falls from 0.6 to 0 by 25 m, and it is culled once off screen | 1 speck per pickup on arrival; above 20 arrivals, 1 per 3 | One merged coin chip (plus the heal chip if hearts are swept); XP shows on the bar only. Bars and counters update in batches of at most 1 per 50 ms |
| **Quest step done** | The view sees a quest goal crossed mid-run (`closestQuests` at run start, polled every 0.5 s) | None in the world | None | A toast slides down from the top centre in 180 ms (`outCubic`), holds 2.4 s, and fades over 250 ms |
| **Fusion ready** | `fusionsReady(g)` goes from 0 to 1 or more (`hud.js:86`) | Both parent monsters get a violet rim pulse (2 pulses × 300 ms). A violet tether arcs between them for 700 ms (one time). Sealed Chests pulse violet every 1.2 s until one is opened | 12 violet specks along the tether | The `#fusion` line slides in, 200 ms. Chest markers on the minimap pulse violet. No centre stamp |
| **Vase break** (drop source) | `breakVase` (`world.js:101`) | The vase is replaced by a puff (0.6 H, 120 ms), then 6-8 shard quads in the vase colour fly 1 H in 300 ms (`outCubic`, gravity 12) and fade 400 ms after landing. A banded vase adds a gold band ring | 8 dust + shards (shards count toward the budget) | None (its drops handle the rest) |

### 2b. Text popup, audio, pad rumble, Thor bottom screen, reduce motion

| Event | Text popup (wording, size at 1080p, colour, lane, life) | Audio cue (section 3.6) | Pad rumble weak/strong, ms | Thor bottom screen (Ledger) | Reduce-motion version |
|---|---|---|---|---|---|
| **XP crystal** | None (the XP bar ghost and glint are the confirmation) | XP ladder blip (C5-E6, rising) | None | Big XP bar mirrors the top bar (steps at 15 Hz); no log line | No arc or stretch; drops slide straight in. The bar fills with expo(110 ms) |
| **Star Chip earned** | None (the star flight and the ★ punch are the confirmation) | Star bell G6 (1568 Hz), 200 ms tail | 0.18 / 0, 40 ms | "Star Chips this run: n (×diff at the end)" updates | Star appears at the ★ glyph with a 150 ms fade, no flight |
| **Coin** | Tally chip `● +15`, 22 px, gold `#f0c040` glyph, cream number, lane T left slot, life 1200 ms after the streak closes | Coin ladder chink (semitone steps) | One 0.15 / 0, 30 ms tick at the start of a streak and on every 10th coin in it, at least 250 ms apart | Coin total updates; no log line | No scatter or hang; straight slide in. Chip fades in, no pop |
| **Heart / heal** | Tally chip `♥ +15`, rose `#ff6f91` glyph, cream number, lane T right slot, life 1200 ms. At full LP: no chip | Heal rise A5→E6. At full LP: the heal sound at -6 dB, nothing else | 0.25 / 0.10, 60 ms (none at full LP) | LP bar shows the rose segment | Ring replaced by a 150 ms tint on the hero |
| **Stat boon** | On the slip: the stat name in cream `#f3e6c8`, 20 px, in the game UI font (Courier New), on the ink slip. 250 ms later the value `+2%` stamps in as a small seal disc in the stat's group colour (1.4x → 1x, 120 ms, `outBack(1.6)`). No green text. The slip leaves the screen when it lands in `#stats` | Boon arpeggio C6-E6-G6 | 0.30 / 0.15, 80 ms | Run log line `Fortune +2%` (permanent until the run ends) | No flip: the slip fades in at the chest (150 ms), then the `#stats` row flashes |
| **Item gained** | None on the slip: item art and rarity border only, no text. The name appears in `#itemsList` when the slip lands | Item cue: boon arpeggio + low "seal stamp" (110 Hz, 80 ms) | 0.35 / 0.20, 100 ms (legendary 0.5 / 0.4, 160 ms) | Item icon added to the loadout grid with a rarity flash; run log line | No spin, no beam; the slip fades in at the chest, then the entry appears in `#itemsList` |
| **Card from chest** | Existing card faces; zone slot tag `NEW` / `LV n` 18 px | Card slap (filtered noise 40 ms + 220 Hz knock) on landing | 0.20 / 0, 40 ms | Field zone grid mirrors the slot | Existing instant choice (`offer.js:11`) |
| **Chest open** | Existing | Existing reveal tones (keep the `tone()` steps), routed through the new mixer | Rising per seam step: 0.2 → 0.35 → 0.5 → 0.65, each 50 ms; legendary 0.6 / 0.9, 300 ms | Card faces are shown large on the Ledger as static images during the reveal | Existing short reveal (`reveal.js:4`) |
| **Shrine charge** | None (the world is the gauge; the `#prompt` text from `game.js:219` is removed) | Drone gliding 220 → 440 Hz over the hold, plus a tick per second on rising notes. Leave and interrupt rules in 3.6 | Pulse every 1 s: weak 0.15 → 0.30 as it charges, 30 ms | Ring gauge with a % number | Curtain shown at a fixed 30% alpha with no motes; arc and water still fill |
| **Shrine complete** | None (the geyser, the shockwave and the rising blessing cards are the confirmation) | Completion chord + upward whoosh | 0.50 / 0.70, 220 ms | Run log line `Shrine: Blessing of X` once picked | No geyser or shockwave; a 200 ms flash on the basin, then the offer |
| **Level up** | None (the offer screen is the announcement) | Level arpeggio C5-E5-G5-C6 at 70 ms steps + shimmer | 0.4 strong 60 ms, gap 40 ms, 0.6 strong 90 ms | Level number updates; offer cards shown large (touch to pick) | No card fan or ring; a 150 ms bar flash, then the offer |
| **Kill** | None (the damage number covers it) | Kill pop (noise 30 ms + sine 400 → 180 Hz, 90 ms); at most 1 per 80 ms, louder rather than more, capped at +3 dB | None on routine kills. Elite: 0.4 / 0.5, 120 ms. Boss: 0.6 / 0.9, 250 ms | Kill counter | No shards; 3 specks |
| **Crit** | Existing crit number (bigger, gold `#ffd34a`) now **stamps**: 1.8x → 1x in 90 ms (`outBack(2)`), with a 2 px crimson outline. Damage lane D, existing 950 ms life **with the fade fixed** | Kill or hit sound + "ting" E6 (1319 Hz), 120 ms | 0.25 / 0.15, 35 ms | None | Stamp 1.2x → 1x; no flare |
| **Damage taken** | None (no number on the hero; LP bar only) | Thud 110 Hz 120 ms + filtered noise; big hits add a 60 Hz sub | 0.35 / 0.60, 120 ms; big hit 0.6 / 1.0, 200 ms. At most 1 per 350 ms; extra hits are dropped, not queued | LP bar with the drain ghost (steps at 15 Hz) | Vignette at 50% opacity, no shake (existing rule), no number shake |
| **Magnet sweep** | One coin chip (and heal chip), as above; no XP chip | Rising filtered-noise sweep 400 → 4000 Hz over 500 ms, then the ladders (capped as in 3.6) | Pulsed weak 0.15 → 0.30, 30 ms every 200 ms, for at most 800 ms | Totals | All drops credited in 1 frame; ring replaced by a 200 ms tint |
| **Quest step done** | Toast: "Quest complete: Horde Breaker", 24 px cream, with the reward on a second line, 18 px gold. Lane C top. 25/50/75% milestones appear on the Ledger only | Page flip (noise 60 ms) + bell A6 (1760 Hz) | 0.20 / 0, 50 ms × 2, gap 60 ms | Quest tracker bar fills; a tick mark at the step; run log line on completion | Fade only, no slide |
| **Fusion ready** | `#fusion` line (existing text) only | Two violet notes E5 → B5, then a soft held fifth for 600 ms | 0.3 / 0.3 80 ms, gap 80 ms, 0.3 / 0.3 80 ms | Fusion card art with both parents; "Open a Sealed Chest"; run log line when the Fusion is made | No tether or rim pulse; the chest marker turns violet without pulsing |
| **Vase break** | None | Clay crack (noise 50 ms, bandpass 900 Hz) + puff; banded adds a 1568 Hz ping | 0.15 / 0.05, 30 ms | None | Puff only, no shards |

---

## 3. Shared systems

### 3.1 Popup lanes

| Lane | Where | What goes there | Rules |
|---|---|---|---|
| **D: damage** | Over enemies, in the world (existing 5 lanes, `fx.js:95-113`) | Damage numbers | Keep merging within 150 ms and the cap of 8 per frame. At most 16 live numbers. When 60 or more enemies are within 15 m of the hero, show only crits and numbers on elites and bosses; routine hits show the white flash only. **Fix:** the fade at `fx.js:173` is trapped in a comment; move `sp.material.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;` onto its own line. Numbers rise; they never fall |
| **T: tally** | Screen space, a **horizontal row centred 0.45 H above the hero's head**, following the hero | ● coin and ♥ heal only. XP has no tally chip (the XP bar ghost and glint confirm it). Star Chips have no tally chip (the star flight and the ★ punch confirm them) | At most 2 chips, in fixed order. Slots are fixed: coin is always the left slot and heal the right, and an empty slot leaves a gap. Chips never slide sideways. A chip is a small ink card-slip (rounded 3 px, `#141018` at 85%, 1 px cream border). It shows the resource glyph in its colour and the number in cream `#f3e6c8`, Courier New bold, 22 px. No outlined free-floating text. Each chip shows the running total for its streak |
| **C: centre** | Top centre (existing banner) | Existing stage banners and quest toasts | Queued, never overlapping. Minimum spacing 400 ms. At most 2 in the queue. Drop any entry older than 3 s before it shows, and never show one while an offer or reveal screen is open |

There is no boon rail. Boon slips flip at the chest and fly straight to their row in `#stats`. Item slips fly to their new entry in `#itemsList` (table 2a).

**Text rendering.** All floating text in lanes D and T, and the slip labels while they are in the world, is drawn from one glyph atlas baked once at load from the UI font (Courier New): 0-9 + − × % ◆ ● ♥ ★ and A-Z, 32 px cells, 1 texture of 512×256 at most. Each glyph is one instanced quad, all in one draw call. A tally chip's ink slip is one more quad in the same batch. The cap is 24 strings × 8 glyphs = 192 quads. Changing a digit rewrites one instance and never uploads a texture. Delete the 64 per-number canvases in `fx.js`.

**Screen-space flights.** The Star Chip flight is a screen-space quad in the same glyph and particle batch, drawn in an ortho overlay pass, from a pool of 4 allocated once. No DOM node is ever created or removed per pickup.

### 3.2 Stacking rules (many pickups must never spam)

- **Streak window:** gains of one resource less than 900 ms apart join the same streak. After 900 ms with no gain, the chip starts its 1200 ms hold, and the next gain starts a new streak at +0. A streak closes 2.5 s after it started even if gains continue, then holds and fades as usual.
- **Re-pop:** each bump re-pops the chip at 1.25x → 1x over 120 ms. Bumps less than 60 ms apart only change the digits, without a new pop.
- **Size grows with the haul:** chip scale is `1 + min(0.25, log10(total) * 0.125)`, so +1 is 1x, +10 is 1.125x and +100 or more is 1.25x. It shrinks back to 1x over 300 ms after the streak ends.
- **Rings and flashes on arrival:** at most 1 per 60 ms per resource.
- **On-screen text cap:** 24 floating texts in total (lanes D + T), with lane D at 16 at most. Above that, new damage numbers merge into the nearest live one.
- **Full pickup pool** (`combat.js:84`, the silent XP add): credit it as one hidden crystal, so it still drives the bar ghost and the ladder note.

### 3.3 Magnet curve (sim, deterministic)

- **Settle:** a pickup newer than 280 ms ignores the magnet (new `born` field in `g.pick`). The sim spawns it at its rest spot, chosen with `g.rl()`, and the view plays the arc from the drop's origin to that spot. This changes the golden replays, so re-baseline `test/golden`.
- **Hop:** on entering range (`5 m × (1 + pickup)`), the pickup rises 0.6 m over 120 ms (`outQuad`) and starts moving.
- **Flight:** speed `v = min(32, 6 + 60·t)` m/s, where t is time since the hop. It steers toward the chest point (`p.y + 1.0`) at up to 14 rad/s, so paths curve instead of running straight. From 5 m it arrives in about 0.41 s, which matches the measured 0.3-0.5 s.
- **Collect radius:** 1.3 m (unchanged).
- **View:** stretch along velocity, `1 + min(0.8, v/40)` along and `1/sqrt` across. Spin speed rises with v.
- **Rings:** move the pickup collect ring out of the sim (`weapons.js:142`) into the view, so it no longer uses the sim's ring pool. Raise the view ring pool from 64 to 128 (`actors.js:130`) and `fx.js` POOL.rings from 48 to 96.
- **Large rings:** the shared ring is `RingGeometry(0.8, 1)` (`fx.js:28`), whose band is 20% of the radius. Rings that scale above 3 m (magnet sweep, shrine shockwave) use a second instanced ring with inner radius 0.97, so the band is 3% of the radius, or at most 0.4 m with per-instance thickness.

### 3.4 HUD counter tick and punch (ours: the HUD reacts, unlike the reference)

- Values change only on the collect frame.
- **Font:** all counters, chips, plaques and toasts use the existing UI font (Courier New, `index.html:10`). No pixel font and no outlined display font.
- **Punch:** scale 1 → 1.18 → 1 over 160 ms (`outBack(1.6)`), and the digits flash white for 60 ms. A counter punches at most once per 500 ms; changes in between only update or roll the digits. The kill counter never punches; it only ticks.
- **Roll:** for a gain above 5, the digits count up over `min(400, 40·delta)` ms (`outCubic`).
- **Star Chips:** shown on the existing COINS line as `COINS 15 · ★ 2`. Only the ★ number punches when a star lands.
- **Level:** `#xpnum` (`LV n …`, `hud.js:59`) punches on the frame the bar resets. It is the only level readout.
- **XP bar:** two layers. A ghost (`#e6dcff`, 70% alpha) snaps to the new value on the collect frame. The fill follows with expo(110 ms), which gives about 84% of the gain at 200 ms and is settled by 600 ms, inside the measured window. A white glint 6 px wide sits on the leading edge, fading 1 → 0 over 300 ms. When the bar is full, the gold double flash plays before the level beat.
- **LP bar:** heal uses the rose segment; damage uses a red ghost that drains (both in table 2a).
- **CSS:** no `transition` on the bars; they are driven in JS so timing stays frame-exact and reduce motion can switch it off. Bars are a fixed-size element filled with `transform: scaleX(v)` and `transform-origin: left`, never `width`. Write it only when the change is at least 0.5 px, and stop writing once |target − shown| < 0.5 px. Counters use `font-variant-numeric: tabular-nums` in a box of fixed width, and `textContent` is written only when the shown integer changes. The HUD root gets `contain: layout paint`. The rarity glow on the items list is a pre-made glow element whose `opacity` is animated, not an animated `box-shadow`.

### 3.5 Colour language (our tells, kept and extended)

| Colour | Meaning | Hex | Notes |
|---|---|---|---|
| White | Free / neutral, hit flash | `#ffffff` | Star Chips are pearl white; their **5-point star shape** (matching ★) is the tell ("shape before colour", `props.js:1`) |
| Gold | Coin, crit | `#f0c040` coin, `#ffd34a` crit | Crits always have a crimson outline, so they never read as coins |
| Red | Danger, LP loss | `#c8402c` (`--hp`) | Never used for a gain. Hearts and the heal segment are **rose** `#ff6f91`, not red |
| Violet | Fusion, seal; XP | `#b05cff` Fusion and seal; XP `#8f6bff` | **Decision needed (D1).** Recommendation: keep XP violet `#8f6bff` (our own existing look: `--xp:#8f6bff`, PCOL `0xb48cff`, ring `0xd79af0`). Fusion and seals keep violet but are told apart by shape: the seal ring and tether, the same "shape before colour" rule Star Chips use. Crystal tiers: small `#b48cff`, mid `#8f6bff`, big deep violet with a cream card-corner frame. No white-core or pale-blue tier. This also replaces today's gold big-crystal tier, which clashes with coin gold |
| Cream | Text on slips, plaques and chips | `#f3e6c8` | Values take the colour of their group seal, never one shared green |
| Shrine mint | Shrines only | `#7fffc8` (existing fill) | |
| Rarity | Cards and items | Existing rarity border colours | |

### 3.6 Sound (new `src/view/sfx.js`, built on the WebAudio approach of `reveal.js` `tone()`)

- **Mixer:** master, sfx and ui buses. Create the context with `latencyHint: 'interactive'`. Peak levels before the master: pickup blips −20 dBFS, kill −16, crit −14, hurt −10, level and shrine −8, ui −18. Put a `DynamicsCompressorNode` on the sfx bus (threshold −12 dB, ratio 8, attack 3 ms, release 120 ms).
- **Voices:** 12 in total, with pickups limited to 4 and kills to 3. Level, hurt, shrine and ui voices are never stolen by pickup or kill cues; otherwise steal the oldest.
- **Pre-rendered cues:** render every fixed cue (ladder notes, kill pop, thud, chink, bell) once at load with `OfflineAudioContext` into an AudioBuffer, and play it through a pooled `AudioBufferSourceNode`. No oscillator graph is built per note.
- **Minimum gaps:** XP and coin 70 ms, kill 80 ms, crit 100 ms. A cue that hits the gap merges into the next note, which plays at most +2 dB louder and never stacks across merges, instead of being dropped silently. Louder kills are capped at +3 dB.
- **XP ladder:** C5 D5 E5 G5 A5 C6 D6 E6 (523, 587, 659, 784, 880, 1047, 1175, 1319 Hz). Each crystal less than 350 ms after the previous one steps up 1 note. At the top it alternates between the top 2 notes at −4 dB, at most 6 per second; after 2 s at the top, only every 3rd pickup plays. After 600 ms of quiet it resets. Voice: sine + triangle, 2 ms attack, 60 ms decay.
- **Coin ladder:** `1047 · 2^(n/12)` with n from 0 to 12, one semitone per coin. Partials at f and 2f, 40 ms. Same streak, top and reset rules.
- **Kill streak:** every 10th kill is a Star Chip. Play the star bell (G6, 1568 Hz) there, not an extra kill sound.
- **Shrine drone:** when the hero leaves, the drone fades to 0 over 150 ms and freezes its pitch. Re-entering resumes from the current charge pitch with a 100 ms fade-in. Level up, the pause menu and the freeze-frame duck it by −12 dB. It always stops when the shrine completes or is used.
- **Listen to what the sim already emits:** wire `emit('sound', 3)` (trap fire, `monsters.js:143`) and `block` (a hit off the Warden's shield, as a dull clank).
- Settings: add **Volume** (default 70) and **Rumble** (default 60) sliders (0-100) next to Shake (`menus.js:133`).

### 3.7 Pad rumble

- Extend `host.haptic(kind)` (`core/host.js:45`, never called today) to `haptic(weak, strong, ms)`. Browser: `gamepad.vibrationActuator.playEffect('dual-rumble', {duration, weakMagnitude, strongMagnitude})`. Native host: the Android vibrator / the Thor's built-in pad. With amplitude control, use `VibrationEffect.createOneShot(ms, round(255·max(weak, strong)·setting))`.
- **Fallback:** when falling back to `navigator.vibrate`, or to an Android vibrator without `hasAmplitudeControl()`, play only cues with max(weak, strong) ≥ 0.4: level up, big hit, legendary item, shrine complete, elite kill.
- **Limits:** XP crystals and routine kills never rumble. Coins get one 0.15 / 0, 30 ms tick at the start of a streak and on every 10th coin, at least 250 ms apart. Hurt plays at most 1 per 350 ms; extra hits are dropped, not queued. A hurt rumble cancels and blocks pickup rumbles for its duration. Duty cap: 20% of any second in total, and 8% for pickup and kill together.
- **Floor:** a pulse under 30 ms or under 0.15 magnitude is not played (ERM motors will not spin up). Shrine pulses therefore run 0.15 → 0.30.
- Everything is scaled by the Rumble setting.

### 3.8 Particle budget (handheld)

- **Thor (handheld quality):** at most 1200 live particles out of the 4000 pool. New spawns are limited to 1800 per second, measured over a rolling 250 ms window (450 per window). Desktop: 4000 live, no spawn cap.
- **Per-event caps:** pickup 3, kill 16 (6 shards + 6 + 4), crit 6, vase 16, level 32, shrine 52, Fusion landing 60 (existing), Star Chip 14, heart 5, boon 10, item 14 (+1 beam), card landing 8, world chest 20, Fusion ready 12, Witness Stone 8.
- **Shards:** kill and vase shards share one instanced pool of 96 flat quads in a single draw call, and that pool counts toward the 1200 live cap. At most 3 kills shatter per 100 ms.
- **Trails:** trails come from their own quota. At most 12 flying pickups trail at once (the newest), with at most 72 live trail specks. Trails are off during a sweep. When spawns in the rolling window pass 60% of 450, trails and glints stop before any event burst is cut.
- **Priority:** event bursts are granted in priority order: level, shrine, item, crit, kill, pickup.
- **Degrade ladder:** above 50% of budget, no shards. Above 70%, pickups drop to 1, kills to 3, and trails and glints turn off. Above 90%, only rings, numbers and tallies remain. A debug overlay (`?debug`) shows live / cap and spawns per second.
- **Uploads:** upload only the live range: `pm.instanceMatrix.updateRange = {offset: 0, count: n*16}` and `pm.instanceColor.updateRange = {offset: 0, count: n*3}`. Do the same for rings and cards. Skip `needsUpdate` when n is 0. In the native GLES port, particles are integrated in the vertex shader from (spawn pos, vel, t0, life), so each particle is uploaded once, at spawn.
- **No post pass:** no post-process bloom, blur or fullscreen pass on handheld. All glow is additive sprites or quads at most 0.6 H across, with at most 6 such glows on screen at once.

---

## 4. Shrines and interactables

### 4.1 Shrine of Tribute (sim: radius 4.5 m, hold 5 s, grace 1.5 s, decay 0.6/s; `encounters.js:20`)

- **Idle:** the basin water is dark teal with a slow ripple. A seal sigil (our own disc glyph, 0.4 H) floats 2.2 m above it, bobbing 8 cm at 0.5 Hz. To read from far off, a thin vertical mint light thread (6 m tall, 20% alpha) is visible from 40 m. It is hidden while the curtain is up. It needs no "!" marker. Minimap: the existing white ring.
- **Enter:** remove the shrine prompt at `game.js:219`. The world is the only gauge on the top screen; the Ledger keeps its ring gauge. The prompt stays empty inside a shrine radius, charged or used. The ring track goes from 0.55 to 0.85 alpha in 150 ms. A **curtain of light** rises at r = 4.5 m: height `0.2 + 2.3·p` m (where p = charge / hold), additive mint, alpha `0.10 + 0.15·p` (peak 0.25), fading toward the top. Motes rise inside it at 4 + 8p per second. The floor arc keeps filling clockwise (existing). The water rises 0 → 0.3 m and shifts from teal to mint. Each whole second gives a ring pulse (0.9 → 1.05 → 1 scale, 200 ms) and a rising tick (5 notes). The timer itself stays linear; only glow intensity eases over the last 15%.
- **Curtain build:** an open cylinder, 24 segments, 1 height segment, no texture, alpha from vertex colour (top 0). `side: FrontSide` only, `depthWrite: false`. The wall nearer the camera has its alpha multiplied by 0.3 (by vertex, `dot(normal, toCamera) > 0`), so the hero and enemies stay readable.
- **Leave:** the curtain drops to 40% alpha at once. During the 1.5 s grace it flickers at 4 Hz. Once decay starts, the curtain height and the arc follow the charge down.
- **Complete:** all on one frame. The curtain stretches up to 6 m and disappears within 120 ms at most. A geyser 0.8 m wide shoots to 7 m in 180 ms (`outCubic`) and falls over 400 ms. A floor shockwave (thin ring, section 3.3) grows from 4.5 to 9 m over 350 ms, alpha 1 → 0. Then 40 mint + 12 white particles. 3 blessing card backs rise out of the water and flip (`fx` cards, 600 ms). The view holds a freeze-frame for those 600 ms (the sim already opened the offer, so this stays replay-safe), then the offer opens. No banner. Shrine complete never coincides with another additive object over 10% of the screen.
- **Used:** the water goes still and dark slate (`#1e2a2a`) with no ripple. The ring track turns grey (`#3a3a3a`, 35%). The sigil rests on the rim, grey, not bobbing. The light thread is off. The minimap ring turns grey `#6a6a72` (existing). Re-entering does nothing (no prompt, no curtain).

### 4.2 Other interactables

- **Vase:** shards and puff (table 2a). Vases break on hit or contact (`breakVasesNear`), so there is no prompt. Banded vases glint gold every 2 s (a 300 ms sweep) so they read as worth breaking.
- **Card Chest in the world:** lid pop + light column before the reveal (table 2a). Used state: open lid, no glow, grey minimap marker.
- **Witness Stone:** on use, the gem drains from colour to grey over 400 ms, top to bottom, with 8 specks rising. This replaces today's instant grey.
- **Relic Broker:** the bought item lifts 0.3 H and fades over 250 ms before it hides, and an item slip follows.
- **Sealed Chest with a Fusion ready:** pulses violet (table 2a). The prompt loses its Fusion suffix: drop "(a Fusion is ready!)" from `game.js:212`, so it reads "E: open the Sealed Chest".
- **Trophy chest:** keep the existing ring, burst and shake (`main.js:199`). The dropped item uses the item slip.

---

## 5. Build order

Each step ends with something **seen**. Drive the scenarios through `window.__ds` with the existing CDP harness (`test/cdp.mjs`, `b.shot`). Add `test/browser-feel-pickups.mjs`, which writes a 10 fps frame strip and a contact sheet per scenario into `test/out/feel/` (same style as the reference capture), plus the numeric samples listed.

1. **Fix the damage-number fade** (`fx.js:173`). *Proof:* extend `browser-numbers.mjs` to sample opacity at u = 0.85 and assert below 0.6, plus a 10 fps strip showing the numbers fading.
2. **Feedback module, lanes and glyph atlas** (`src/view/feedback.js`): streaks, merging, caps, and use of the `pickup` value at `main.js:201`. *Proof:* node unit test feeding 40 coin pickups in 300 ms expects 1 coin chip with total 40. 40 XP pickups produce no chip and no motes, and a continuous 4 s coin stream closes its streak at 2.5 s. Plus a screenshot with 1 chip and no number cloud.
3. **XP bar ghost + expo fill + counter punch** (bars on `scaleX`). *Proof:* call `addXp`, sample the fill's scale every 100 ms, and assert 75-90% of the gain by 200 ms and settled within 2% by 700 ms; 10 fps strip of the bar.
4. **Magnet curve + settle + spawn arc** (sim), re-baseline golden. *Proof:* sim test that a pickup from 5 m arrives in 0.35-0.50 s and ignores the magnet before 280 ms; strip of a kill drop showing arc, hang, curved pull and stretch.
5. **Arrival flash and trail (with the trail quota); collect ring moved to the view; ring pools raised; thin large ring.** *Proof:* strip with 20 crystals arriving together and no dropped rings (debug counter shows 0 rejected).
6. **sfx.js + mixer (gain staging, compressor, voice classes, pre-rendered buffers) + ladders + Volume setting.** *Proof:* debug overlay lists the last 8 cues with pitch. A test asserts that the 9th rapid crystal plays E6 (the top note) at −4 dB, not a 9th step. Owner check: a short screen recording with sound, on device.
7. **Rumble (`host.haptic` rework + Rumble setting).** *Proof:* a debug log of rumble calls during a 60 s horde run shows no XP or routine-kill rumble, coin ticks at least 250 ms apart, and hurt at most 1 per 350 ms. It also shows total duty ≤20% and pickup + kill ≤8% of any second, and no pulse under 30 ms or 0.15. On a vibrator without amplitude control, only the ≥0.4 cues play. Owner feels it on the Thor.
8. **Heart/heal segment and LP drain ghost.** *Proof:* strips of a heal and of a big hit.
9. **Vase shards, Card Chest world pop, Witness Stone drain.** *Proof:* one strip per prop.
10. **Kill shards and crit stamp.** *Proof:* strip of 5 kills and 3 crits; checked against the particle budget overlay, with no more than 3 shattering kills per 100 ms.
11. **Level-up beat** (view freeze-frame, card fan, ring, `#xpnum` punch). *Proof:* strip from bar-full to the offer open (420 ms ±50).
12. **Star Chip on the COINS line and star flight.** *Proof:* strip of the 10th kill; the ★ number matches `game.starChips()` and `#topright` does not grow taller.
13. **Boon and item slips.** *Proof:* strip of 4 boons in 1 s, each landing in its `#stats` row, with no slip left on screen 800 ms after the last one lands.
14. **Shrine** (curtain, water, ticks, leave/decay, completion, used state, prompt removed). *Proof:* strips of a full charge, leave-and-return, completion, and the used state seen 10 s later; `#prompt` stays empty inside the radius throughout.
15. **Fusion ready and quest toast.** *Proof:* strips; no centre stamp on Fusion, and the toast never overlaps a stage banner (lane C queue).
16. **Particle governor.** *Proof:* `browser-perf.mjs` on the Thor at 120 Hz on handheld quality (owner runs it on device). Normal play (≤150 enemies): frame time p95 ≤ 8.3 ms. 300 enemies: p95 ≤ 16.7 ms. A stress scenario of a 150-drop sweep + shrine completion + level-up within 2 s: p95 ≤ 16.7 ms, with no frame over 33 ms. Report JS time and GPU time separately, plus draw calls (handheld budget ≤ 150). The live particle count never goes above 1200.
17. **Thor Ledger screen** (`host.second`: an Android Presentation on display 1 in the native host; a docked panel with `?ledger` in the browser): XP, LP, counters, run log, boons, items, Fusion, quests. The Ledger never runs its own rAF animation loop. It redraws on events, at most 15 Hz. Bars snap or step at 15 Hz, with no expo animation and no WebGL on display 1. Card art is shown as static images. When nothing has changed for 2 s it stops redrawing. *Proof:* photo or screenshot of both screens during a coin streak and a level-up, plus a trace showing redraws at ≤15 Hz that stop after 2 s idle.
18. **Magnet sweep** (needs a content owner for the Spell or Ace). *Proof:* strip of 150 drops collected with one merged coin chip and no XP chip.
19. **Reduce-motion pass.** *Proof:* rerun every strip with reduce motion on, and check against the reduce-motion column in 2b.

---

## 6. Not copying: reference traits we deliberately do differently

General genre craft is fine to use: one-frame hit flash, magnet pull, ease-out bars, running totals. These are **not** used:

| Reference trait | Ours instead |
|---|---|
| Typewriter stage title card with a colour flick | Our existing stage banners |
| Dice everywhere (projectiles, death debris, damage scatter) | Card shards, seal flares, card backs |
| A tilted "CRIT!" word label that tumbles away | No word: a gold number with a crimson outline that stamps in, over a round notched seal flare |
| Damage numbers that fall with gravity and fly at the camera | Our numbers rise in 5 lanes and fade (with the fix) |
| A fixed screen-space stat line at right-middle, white name + green value | Boon slips that flip at the hero and fly straight into their `#stats` row; cream name, and the value stamps as a seal disc in the stat's group colour; no green text |
| A vertical per-resource stack to the right of the head, chunky outlined pixel font, coloured outlined numbers (yellow $, cyan +N, green +1 heal) | At most 2 ink card-slip chips (coin, heal) in fixed slots above the head, cream numbers in Courier New; XP and Star Chips have no popup |
| White 4-point pixel twinkles around pickups | Card-corner glints (an L-shaped flash, 2 frames) and seal discs |
| A cyan XP bar across the whole top edge, with silent HUD counters | Our panel bar with a ghost layer and edge glint, violet, our existing XP colour; counters punch and roll |
| Level-up: rainbow scrolling bar, god rays, gem confetti | A freeze-frame beat: gold bar double flash, ring at the feet, fan of card backs; the offer screen is the only announcement and `#xpnum` punches |
| Shrine: a pink dome over the world, a "!" marker, a spinning reward window, lightning that crosses the HUD | A mint curtain of light, rising basin water and floor arc, a geyser and a floor shockwave; the effects stay in the world, with no HUD text |
| A minimap of coloured squares and diamonds | Our existing map legend: a ring for the Shrine of Tribute, white when free, grey once used |
| Keycap "Break pot" prompts, a gold pot that sprays hearts | Vases break on hit with no prompt; banded vases glint gold; no hearts as a luck symbol |
| A pause-screen list of shrine bonuses | The Thor Ledger: one run log of boons, items, blessings, Fusions and completed quests |
| Their words: Luck, Silver, Tier, CRIT!, Break pot, Shrine Logs, Powerup Multiplier, LVL | Our words: Fortune, Star Chips, LP, LV, Tribute, Blessing, Boon, Fusion ready |

**Open decision D1, for the owner:** keep XP violet (recommended) and tell Fusion and seals apart from XP by shape (seal ring and tether), rather than moving XP to another hue.

---

## Review notes

- **Rejected: "the fade at `fx.js:171` is already active; keep it" (lane D, build step 1, 2b Crit, section 6).** In the source, `sp.material.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;` is on `fx.js:173`. It sits after the `// clamped to the screen…` comment at the end of the clamp line, so it is dead code. The original fix, step 1, "with the fade fixed" and "(with the fix)" all stay. The test proof in step 1 is the same in both versions.
- **Partly superseded: D1 review's "tally `◆` glyph `#b48cff`" and the tally-style review's "remove 'with dark outline' from the XP row".** Both are moot because a later review removes the XP tally chip altogether. All the other violet XP values are applied: bar ghost `#e6dcff` at 70%, violet sweep ring, violet seal-disc arrival flash, and the crystal tiers.
- **Superseded: the heart review's "At full LP: `♥ full`, grey, 900 ms".** A later review drops it: at full LP there is no chip and no ring, only the heal sound at −6 dB.
- **Merged: two kill-shard limits ("at most 3 kills shatter per 100 ms; above 50% of budget, no shards" vs "at most 8 kills per frame get shards").** The stricter 3-per-100 ms rule is kept, which already keeps a frame to 3 or fewer. The kill cap of 16, the shared 96-quad shard pool and the 1200-live accounting are applied.
- **Adapted: the motes and DOM review ("pool is 24 (6 per resource × 4)", "tally row … 4 nodes made at boot").** Another review removes XP and coin HUD motes, so the screen-space quad and overlay-pass rule applies only to the Star Chip flight, with a pool of 4. The glyph-atlas review places lane T in the instanced batch, so the conditional "if it is in the DOM" clause does not apply. "No DOM node is ever created or removed per pickup" is kept.
- **Merged: "LVL punches" fix and the `#xpnum` level review.** Both now read as: `#xpnum` (which reads `LV n …`) punches on the frame the bar resets. The plaque, the banner and step 11's plaque proof are removed.
- **Consistency edit: curtain alpha.** The old formula `0.12 + 0.18·p` peaked at 0.30, which breaks the new "peak alpha 0.25" rule, so it is now `0.10 + 0.15·p`.
- **Consistency edit: magnet-sweep rumble.** Pulses of weak 0.1 → 0.3, 30 ms every 100 ms, broke the new 0.15 floor and the 20% duty cap (30%). They are now 0.15 → 0.30, 30 ms every 200 ms (15%).
- **Clarified: step 13's "no slip left on screen after 800 ms".** A slip lives about 1020 ms (220 flip + 500 hold + 300 flight), so the 800 ms is counted from the last landing.
- **Consistency edit: lane C contents.** Level, shrine and Fusion announcements are removed, so lane C now carries only existing stage banners and quest toasts, under the new queue limit of 2 and the 3 s staleness rule.
- **Consistency edit: Ledger "punches".** Under the 15 Hz, no-animation Ledger rule, the Ledger cells that said "punches" now say "updates". Run log lines for Fusions and completed quests were added to match the run-log review.
- **Consistency edit: "twinkles" in the degrade ladder.** Renamed to "glints" to match the new section 6 row (card-corner glints instead of 4-point twinkles).