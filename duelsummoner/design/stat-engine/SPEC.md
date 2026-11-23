# Duel Summoner: Stat and Balance Engine ("The Ledger"), merged spec

Status: design spec, revised 22 Nov after the standalone prototype in `/home/user/dsengine` (`node --test`, `node sim/builds.mjs`; findings in `SIM-REPORT.md`). Numbers marked **Sim-measured** come from that prototype's 60 Hz combat sim, not from a played seed. Everything else stays **Not assessed** until a played seed confirms it (see section 15).

**Changed after the sim (22 Nov).** Each item is backed by a failing test or a sim number in `SIM-REPORT.md`:
1. **Rate and flat stats now have ceilings** (section 2.2). As written, TEMPO, DRAW, VOLLEY and EDGE were linear with no cap, so "every player bracket has a ceiling" was false and maxDPM was unbounded (the boundedness probe grows x100 when these stats grow x100; the ceiling build under the old formulas still held at 62 min with no end in sight). TEMPO and DRAW now use a knee (x3.0 asymptote), VOLLEY caps at 6, EDGE caps at 3000 (+30 flat).
2. **Per-minute caps use 7 buckets, not 6** (section 5.2). With 6 buckets, a burst at the end of one bucket and another 50 s later both pass, which is 2x the limit inside one real minute (caps test). With 7 buckets, every sliding 60 s window holds the limit.
3. **Thornbound Locket reads min(Guard, 120)** (section 6). Guard stops adding defence at about 114 points (85% cap), but it kept adding Locket damage up to the 1023 clamp.
4. **The 1 HP floor never raises LP** (section 6, step 6). If LP is already below 1, a SELF tick leaves it unchanged instead of healing it to 1.
5. **Level budget corrected** (section 8). A Fusion costs 21 level-ups to arrive and 30 to reach L10. A God Fusion costs 61, so it uses the whole pre-Overtime budget. A Secret Fusion costs 123. Overtime level income must be pinned down: with the Overtime Draw alone (1 a minute), a Secret Fusion arrives at about 71 min.
6. **R(t) defined before 8:00** as `R8 x (t/8)^2`, which matches the old 4-minute envelope value. The envelope (section 13) is replaced by sim-measured values.
7. **Overtime constants unchanged** (`otHpStep` 1.22). No real build is unbounded, and Overtime is not unbeatable early: the weakest real build holds to 16 min. But the sim does not match the old envelope. Normal holds to about 17.5 min, not 10.5, and the synthetic ceiling holds to 44.5 min, not 32. Section 13 has the sweep a designer needs to choose. Steepening `otHpStep` reaches the old targets only by squeezing the gap between normal and broken builds from 7 min to about 4 min.
8. **Overtime tables follow the run rule exactly** (section 13, rules review 22 Nov). HP grows ×1.22 and damage ×1.10 every 30 s with no hidden extra. The draft capped speed at 1.45 and then added ×1.01 HP per step, which made HP grow ×1.232 after 9:30 of Overtime. Speed now caps at 1.6, the value the game already uses (`waves.js` `speedCap`), and nothing else changes. R(20) is 1.22M, not 1.30M. Envelope re-run below.
9. **Balance skeptic review (22 Nov), three fixes** (`test/balance.test.mjs`):
   - **Edge scales with the weapon's cooldown** (section 2.2). A flat +30 per hit gave a 0.1 s beam monster ×18 and a God Fusion ×1.3, so four plain L10 Lantern Acolytes with capped Edge out-damaged a God Fusion 5× at 8:00 (58k against 11k effective DPM). Edge per hit is now `edge × cd / K.edgeRefCd` (1.0 s), the same DPS per target for every weapon. The same probe now gives 13k.
   - **On-event item copies have a ceiling** (section 6). Locket, Recoil Seal and Graveyard Bell bases grew linearly with copies, so the item BASE was bounded only by coins. A single Locket tank hit 4 times a second already holds alone to 24 min (with LP reset, so sustain is the real limit); 30 copies held to 32.5. Copies now count as `1 + 3(n−1)/((n−1)+2)`: 1, 2, 2.5, … toward ×4.
   - **Oren starts on Rime Sprite, not Frost Lynx** (section 11). Frost Lynx is an Ice strike (0.8 × 1.00), which reaches the 95% proc cap at about 7 Fervor, so Bound Pages did nothing for his starter after 3 Spell/Trap levels.

**Base design:** engine-first. It has integer stats, lookup-table curves, cached bracket products, a bounded kill queue and zero allocations per hit.

**Grafted from balance-first:**
- One tuning table, `src/data/tuning.js`, holding every constant by name.
- Knee soft-caps on the additive brackets that are easy to stack.
- A finite ceiling on every player bracket.
- A required-DPM line and a DPM envelope asserted by `run-sim`.
- An end-of-run breakdown by bracket.
- Graveyard Bell overflow banking.
- Secret Fusion traits that each lift exactly one cap.
- Overtime level-ups as the route to Secret Fusion.

**Grafted from player-first:**
- The tooltip shows the whole product and lists its sources.
- A visible "capped" pip and a per-minute counter in the tooltip.
- Breakpoint tooltips on curves.
- A hyperbolic Rewind curve for Ward and trap cooldowns.
- A soft cap on Stride.
- Reaction numbers drawn in their own colour and font.

**Rejected:**
- A 5th Spell/Trap Zone. It breaks the 4+4 rule.
- Spell or Trap levels above 5. They break the 1-5 rule.
- "Max reaction instead of sum." It breaks the add-within rule.
- Any rarity names, factors or caps that echo outside reference material.

**Rule for every number:** each constant lives in `K` (`src/data/tuning.js`) under the name used here. The sim never hard-codes a balance number.

---

## 1. Stat sheet

All stats are **Int32 points** in `sheet.pts` (an Int32Array indexed by the `STAT` enum in `src/data/stats.js`).

- Percent stats are stored in **basis points** (bp, where 100 bp = 1%).
- Curved stats are stored as raw points, clamped to 0..1023, and read through a lookup table (LUT).

| Group | Stat (id) | Unit | Feeds | Replaces |
|---|---|---|---|---|
| Offence | Might (MIGHT) | bp | bracket 1 | `dmgMult` |
| | Edge (EDGE) | flat ×100 | bracket 0 | new |
| | Keen (KEEN) | points, curved | crit chance | `crit` |
| | Ferocity (FERO) | bp | crit multiplier, linear | `critMult` |
| | Fervor (FERV) | points, curved | proc multiplier | new |
| | Resonance (RESO) | bp | bracket 6 | new |
| | Hunter (HUNT) | bp | bracket 4, specials only | `bossDmg` |
| | Swarmbane (SWARM) | bp | bracket 4, swarm only | new |
| | Mark Depth (MARKD) | bp | bracket 4, marked targets only | `markBonus` |
| | Affinity[e] (AFF_FIRE..AFF_DARK) | bp | bracket 3 | new (8 stats) |
| | Drill[src] (SRC_MON..SRC_ITEM) | bp | bracket 2 | new (5 stats) |
| | Tempo (TEMPO) | bp | monster attack rate | `monsterRate` |
| | Draw (DRAW) | bp | card throw rate | `cardRate` |
| | Rewind (REWIND) | bp | trap and Ward cooldown, curved | `trapRecharge` |
| | Reach (REACH) | bp | area size | new |
| | Volley (VOLLEY) | int | extra projectiles and chain jumps | new |
| Defence | Max LP (LP) | flat | | `maxLp` |
| | Guard (GUARD) | points, curved | mitigation | `armour` |
| | Sidestep (SIDE) | points, curved | evasion | new |
| | Renewal (REGEN) | LP/s ×100 | | `regen` |
| | Wards (WARD) | charges | full-hit block | Paper Talisman |
| Utility | Stride (STRIDE), Dash (DASH), Dash Recovery (DASHCD), Lift (LIFT) | bp / int | movement | movement keys |
| | Magnet (MAG), Greed (GREED), Insight (INSIGHT), Bargain (BARGAIN) | bp | | `pickup`, `coinMult`, `xp`, `shopDiscount` |
| | Fortune (FORT) | points, curved | rarity tilt | `luck` |

**Content conversion**

| Card | New value |
|---|---|
| Whetstone Tablet | Keen +6 |
| Bronze Scale | Guard +4 |
| Blessing of Guard | Guard +4 |
| Lucky Coin | Fortune +8 |
| Blessing of Might | Might +1000 bp |
| Hunter's Mark | Hunter +2500 bp |
| Deep Marks | Mark Depth (per level) |
| Paper Talisman | 1 Ward |

**Data shape:** every modifier in data is `[STAT, value]`. Spells carry `per: [[STAT, ptsPerLevel], …]`, so `recompute` loops over pairs and no longer has hand-unrolled keys.

**Clarity contract:**
- Every stat has a panel number.
- The tooltip shows the formula with its live inputs, plus a source list, for example "Might +35% = Blessing of Might 10% + Kindling Rite 15% + …".
- On a curved stat, the tooltip also shows the next breakpoint, for example "+4 Guard → 50% → 54.5%".

---

## 2. Damage brackets

**Rule: add within a bracket, multiply across brackets.** Each bracket id is a Uint8 `BR` enum value.

### 2.1 Exact formulas

```
base   = card.atk × lvlMul(L) × formMul(f) × T(tier) × (1 + tune.dmg/1e4) + min(EDGE, 3000)/100 × cd/K.edgeRefCd
B_i    = 1 + knee(Σ_i, K.knee_i, K.kneeK_i)            // for knee brackets
knee(s, a, k) = s ≤ a ? s : a + (s − a)·k / ((s − a) + k)

hitMul[src<<8 | elemMask] = B1 × B2[src] × B3[elemMask] × B7 × B8 × B9   // cached at recompute
d  = base × hitMul[src<<8 | elemMask]
d *= B4                     // target-dependent
d *= crit ? critMul : 1     // B5
d *= react ? R_eff : 1      // B6
```

Per hit this costs four multiplies, at most two RNG draws (crit, then proc) from `g.rngHit`, and zero allocations.

**Zero-allocation rules (Sim-measured).** In the prototype the per-hit path runs about 80-110 ns per hit. Over 1e6 hits it causes 0 GC events and about 300 B of heap growth. Getting there took three rules:
- **No doubles across calls.** A double passed as an argument or return value to a function that is not inlined gets boxed. Hot methods pass doubles through a scratch `Float64Array` (`this.f`) and write results to `out[]`.
- **Integer RNG.** The RNG returns 24-bit integers.
- **Integer proc threshold.** The proc test compares the roll with an integer threshold out of 2^24 (`min(floor(p·2^24), PROC_CAP_THR)`). Clamping a computed double against a constant forced boxing on every hit.

### 2.2 Bracket table

| Id | Bracket | Fed by | Formula | Ceiling (and why) |
|---|---|---|---|---|
| 0 | BASE | card attack × level × form × tier × Tuning, + Edge | additive flat | Bounded by content. This is the investment axis. |
| 1 | MIGHT | Might from blessings, items, Spells and Fusion tier auras | `1 + knee(ΣMIGHT/1e4, 1.0, 1.5)` | Approaches ×3.5. It is the easiest bracket to stack, so it must not crowd out the others. |
| 2 | SOURCE | Drill[src] for Monster, Card, Trap, Spell or Item | `1 + knee(ΣSRC/1e4, 1.0, 1.0)` | Approaches ×3.0. Rewards committing to one source. |
| 3 | AFFINITY | Affinity of the hit's element bits. A hit with several elements uses the **mean** of their Affinities. | `1 + min(mean/1e4, 2.0)` | Hard ×3.0. Competes with reactions. |
| 4 | TARGET | 0.30 base mark bonus + Mark Depth (if marked), Hunter (if special) or Swarmbane (if swarm), plus shred from Sandblast | `1 + knee(Σ, 1.0, 0.8)` | Approaches ×2.8. A boss gate cannot be skipped with one stat. |
| 5 | CRIT | Keen sets the chance. Ferocity sets the multiplier. | `critMul = min(1.75 + FERO/1e4, 6.0)` | Hard ×6.0. This is the deliberate breaking stat: it is linear up to the cap. |
| 6 | REACTION | Reaction R and Resonance | `R_eff = 1 + (R − 1)·(1 + min(RESO/1e4, 1.5))` | Eclipse peaks at ×4.75. Only one reaction per hit. |
| 7 | DUELIST | Duelist passive scalar (section 11) | own scalar | Per duelist, between ×2.2 and ×2.5. |
| (rate) | TEMPO / DRAW | Monster attack rate / card throw rate (not a damage bracket, but multiplies DPM) | `1 + knee(Σ/1e4, 1.0, 1.0)` | Approaches ×3.0. **Added 22 Nov**: it was linear and uncapped. |
| (count) | VOLLEY | Extra projectiles and chain jumps | `min(VOLLEY, 6)` | Hard 6. **Added 22 Nov**. |
| (flat) | EDGE | Flat add to BASE, scaled by the weapon's base cooldown | `min(EDGE, 3000)/100 × cd/K.edgeRefCd` | +30 per hit on a 1 s weapon, +3 on a 0.1 s beam: the same DPS per target. **Added 22 Nov**; cooldown scaling added by the skeptic review. |
| 8 | OVERTIME | Resolve: 1 + 0.04·n, where n is the Overtime step | linear | Grows without a cap, but linear growth always loses to the enemy's exponential growth. |
| 9 | HIDDEN | Unmarked Card banked points (section 12) | `1 + 0.03·min(banked, 60)` | ×2.8. |

**Unification.** `damageEnemy` and `damageSpecial` both call `resolveHit` (in `src/sim/hit.js`). This has three effects:
- The additive-vs-multiplicative split for `dmgMult` (specials.js:45 against combat.js:28) goes away.
- Specials now get marks, burn and elements.
- The Warden's frontal shield stays as a pre-check: it is skipped when the `AREA` flag is set.

**DoT decision (burn, venom).** A DoT **snapshots** `base_dot × B1 × B2 × B3 × B7 × B8 × B9` when it is applied.
- There is no crit, no TARGET and no REACTION on ticks. Each tick costs one multiply.
- Reapplying a DoT sets `dps = max(old, new)` and refreshes the duration. Today's code overwrites instead.
- Ticks route through `resolveTick`, which handles kill bookkeeping and `damageBy`, with a proc coefficient of 0.

**Player cards and traps** use the same path:
- Card throw base = `K.cardBase` (2) × (1 + Draw-independent tuning).
- Trap base = `T.dmg × (1 + dmgPerLevel·lv)`.
- Storm of Cards, Graveyard Bell and Astral Magus's explosion become bases inside BASE instead of flat damage that bypasses brackets.

**Tooltip and breakdown:**
- The tooltip prints the real product, for example: `Ember Wyvern: 6.8 × 1.35 × 1.10 × 1.20 × 1.30 × 1.0 × 1.0 × 1.18 × 1.0 × 1.0 = 17.2`.
- `stats.bracketDmg` is a Float64Array(10). It accumulates each bracket's log-share of damage dealt.
- The end-of-run screen shows which bracket broke the game.

---

## 3. Curves (hyperbolic, LUT-driven)

At boot, each curve is precomputed into a `Float32Array(1024)` indexed by integer points. No division happens per hit.

`hyp(x, k) = x/(k + x)`. A capped variant is `cap·hyp(x, k)`.

| Curve | Formula | k | Cap | Sample values |
|---|---|---|---|---|
| Guard mitigation | `min(G/(20+G), 0.85)` | 20 | 85% | 4 → 16.7%, 20 → 50%, 60 → 75% |
| Sidestep evade | `min(S/(60+S), 0.55)` | 60 | 55% | 15 → 20%, 60 → 50% |
| Crit chance | `0.05 + 0.75·K/(40+K)` | 40 | 80% asymptote | 6 → 14.8%, 40 → 42.5% |
| Fervor proc multiplier | `1 + F/(30+F)` | 30 | ×2 asymptote | 30 → ×1.5 |
| Fortune tilt φ | `F/(50+F)` | 50 | 1 | 8 → 13.8%, 50 → 50% |
| Rewind cooldown | `cd = base × 1e4/(1e4 + REWIND)` | 10 000 bp | floor 25% of base | +10 000 bp halves it |
| Bargain discount | `0.65·B/(5000+B)` | 5000 bp | 65% | +2500 bp → 21.7% |
| Stride (soft linear) | `s ≤ 0.6 ? s : 0.6 + (s − 0.6)/2` | n/a | n/a | +80% → +70% |
| Magnet radius | `r0·(1 + min(MAG/1e4, 1.8))` | n/a | +180% | n/a |
| Reach area | `1 + min(REACH/1e4, 1.5)` | n/a | +150% | n/a |

**Incoming damage:** `max(1, round(n × (1 − guardMit)))`.

**Proc chance:**

```
p = min(K.procCap = 0.95, p0 × coef × (1 + F/(30+F)))
```

The prototype implements this as an integer threshold out of 2^24, capped at `floor(0.95 × 2^24)`. A roll can never pass 100%.

- The proc coefficient gates burn, auras, chain starts and on-hit item effects. It does **not** gate crit, so crits stay readable.
- Combat RNG is its own seeded stream, `g.rngHit`. Adding procs never desyncs map or spawn generation.

---

## 4. Proc coefficients

Each shot carries a `shots.proc` Uint8 column, stored as value/200 (so 200 = 1.0). Direct calls pass an int in the same units.

| Source | coef | Notes |
|---|---|---|
| Monster single-target strike or homing bolt | 1.00 | |
| Monster line, each pierced target after the first | 0.60 | |
| Monster multi-projectile or spray | 0.45 | per projectile |
| Monster area pulse | 0.55 | |
| Monster cone | 0.40 | per target |
| Monster beam or aura tick (10 Hz or faster) | 0.15 | prevents tick spam |
| Player card throw | 0.80 | |
| Trap: Pit of Seals | 0.60 | |
| Trap: Gust Ward | 0.40 | |
| Spell one-shot (Storm of Cards) | 0.30 | |
| Item effect (Graveyard Bell, Thornbound Locket nova, Burning Deck) | 0.25 | |
| Monster mark attack (Rune Apprentice, Astral Magus) | 0.45 | per marked target |
| Mark-explode (Astral Magus) | 0.20 | |
| Lightning chain jump | 0.00 | cannot burn, aura or chain again |
| Reaction splash or burst | 0.00 | cannot set off another reaction |
| DoT tick | 0.00 | |

- God and Secret Fusions use their attack kind's value.
- A Tuning roll can add +0.05 coef, up to a cap of 1.00.

---

## 5. Caps

### 5.1 Per hit, per target and per tick

| Cap | Value (`K.` name) | Overflow |
|---|---|---|
| Reactions per hit | 1 (`reactPerHit`) | n/a |
| Element statuses applied per hit | 2 (`statusPerHit`) | lowest bits first |
| Reaction internal cooldown per enemy | 0.5 s, stored as 30 ticks in Uint8 `enemies.rlock` (`reactIcd`) | no reaction |
| Whiteout and Eclipse lockout per enemy | 6 s and 4 s | no reaction |
| Chain jumps per source hit | 1 + Volley, at most 6 (`chainMax`) | n/a |
| Chain jumps per tick (global) | 400 (`chainBudget`) | dropped |
| Mark-explode cascade depth | 1, so kills caused by an explosion do not explode (`explodeDepth`) | n/a |
| Explosions per tick | 32 (`explodeBudget`) | spill ring of 128 slots, then dropped |
| New FX and damage numbers per tick | 64 (`fxBudget`) | sampled at a fixed stride (deterministic) |
| Crit | once per hit, never on chain jumps or splash | n/a |

### 5.2 Per minute

Each cap is a rolling window: a `Uint16Array` of **7** buckets of 10 s per cap id, with bucket = `(tick/600) % 7`. The check sums the current bucket and the 6 before it, so the window is 60-70 s long. It is integer and deterministic.

**Why 7 (changed 22 Nov).** With 6 buckets the window is only 50-60 s long. A burst at the end of bucket 0 plus another at the start of bucket 6, 50 s later, both pass, so one real minute sees 2x the limit. With 7 buckets, every sliding 60 s window holds the limit. `test/caps.test.mjs` shows both cases.

**Burstiness (Sim-measured, not changed).** A rolling cap lets the whole allowance fire at once. In the broken build, Penitent self-ticks spend all 15 SELF_PROC Locket novas in about 6 s, and then nothing fires for about a minute. If that feels bad in play, switch to a token bucket that refills one charge every 60/limit s. The ceilings stay the same.

| Cap id | Limit/min | Overflow |
|---|---|---|
| HURT_TRAP ("when hurt" traps) | 30, of which at most 12 from SELF | ignored |
| SELF_PROC (on-hurt items fired by self-damage) | 15 | ignored |
| KILL_STACK (on-kill buff stacks gained) | 150 | ignored |
| BELL (Graveyard Bell tolls) | 20 | each skipped toll banks +10% on the next one, at most +250% |
| HEAL_ONHIT (Dark drain plus on-kill heals) | 8% of Max LP per 10 s bucket | clipped |
| MARK_EXPLODE starts | 540 | ignored |
| DUEL_GAIN (stack-based passives) | per passive (section 11) | dropped |

**UI:**
- A capped effect shows a small "capped" pip.
- The tooltip reads "17/20 this minute".

**Secret Fusion traits** each lift exactly one cap. Examples:
- Chain max 10.
- Explode depth 2.
- 2 reactions per hit.

That makes the cap table a menu for breaking the game.

---

## 6. Self-damage pipeline (1 HP floor)

`hurtPlayer(n, flags, src)` takes `flags` as a Uint8: `SELF = 1`, `PIERCE = 2`, `TRUE = 4`. The unused `big` argument is removed.

```
1  godMode || gameOver                          → return
2  dash i-frames && !(flags&SELF)               → emit EV_DODGE(src), return
3  !(flags&(SELF|PIERCE)) && rngHit() < evade   → emit EV_DODGE(src), return
4  !(flags&SELF) && wards > 0                   → wards--, emit EV_BLOCK(src), return
5  !(flags&(SELF|TRUE))                         → n = max(1, round(n·(1 − guardMit)))
6  hp = (flags&SELF) ? max(min(hp, 1), hp − n) : max(0, hp − n)   // 1 HP floor; never raises LP already below 1
7  damageBy[srcId] += n
8  if !(flags&SELF): grace = 0.25               // self ticks never grant i-frames
9  emit EV_HURT(n, flags, src)                  // traps, items, passives: caps HURT_TRAP and SELF_PROC
10 hp ≤ 0 → death                               // never reachable from SELF
```

- Wards recharge on `cd = 20 s × 1e4/(1e4 + REWIND)`.
- EV_DODGE and EV_BLOCK are real events that content can hook.

**Content that uses the path:**
- **Toll of Ash** (Spell, Lv1-5): every 5 s, pay 3% of current LP. Gives +10% Might per level.
- **Cinder Penitent** (monster): each attack costs 1 LP and has ×1.4 in BASE.
- **Thornbound Locket** (rare item): on EV_HURT, releases a nova of 6 × min(Guard, 120) points of base damage at coef 0.25. The 120 is `K.locketGuardCap` (changed 22 Nov). Guard adds no defence past about 114 points, so without the cap it kept adding damage only, up to the 1023-point clamp.
- **Item copies.** Items stack by count, but the on-event items (Thornbound Locket, Recoil Seal, Graveyard Bell) multiply their base by `copyEff(n) = 1 + (K.copyCap − 1)(n − 1)/((n − 1) + K.copyK)` with `copyCap` 4 and `copyK` 2: 1, 2, 2.5, 2.8, … toward ×4. Without it the item BASE was bounded only by coins (skeptic review, 22 Nov).
- **Recoil Seal** (rare item): on EV_BLOCK, reflects 200% of the blocked hit as Item-source base.

---

## 7. Scaling-curve families

| Family | Shape | Our example |
|---|---|---|
| Linear | a + b·n | Monster level multiplier 1 + 0.168(L−1); Clay Heart +15 LP per copy; Ferocity |
| Stepped | jumps at thresholds | Forms at levels 1/5/10; fx extras at 3/6/10; Graveyard Bell every 50th kill |
| Hyperbolic | x/(k+x) | Guard, Sidestep, Keen, Fervor, Fortune, Rewind, Bargain |
| Knee | linear, then hyperbolic | Brackets 1, 2 and 4 |
| Soft linear | linear, then halved | Stride above +60% |
| Square root | a·√x | Kael's Ante Up |
| Logarithmic | a·log₂(1 + x/c) | Mira's Graveyard Toll |
| Capped linear | min(a·n, cap) | Reach, Magnet, Unmarked Card |
| Compound | rⁿ | Enemy Overtime only |

**Rule:** player-side compound growth exists only through brackets multiplying against each other. No single player stat compounds by itself.

---

## 8. Monster levels, forms, Fusion tiers and Tuning rolls

```
lvlMul(L)  = 1 + K.lvlSlope·(L − 1)             // K.lvlSlope = 0.168 → L10 = 2.51
rateMul(L) = 1 + K.lvlRate·(L − 1)              // K.lvlRate = 0.025 → L10 = 1.225
formMul    = K.form[f] = [1.00, 1.30, 1.70]     // Forms I/II/III at L1/L5/L10
```

A level-10 Monster is therefore ×4.27 before Tuning (2.512 x 1.7).

| Tier | Recipe | Arrives at | T (`K.tier`) | Power on arrival | Compared with its parents |
|---|---|---|---|---|---|
| Monster | offer | L1 | 1.0 | 1.0 | n/a |
| Fusion | two L10 partners + next sealed chest | **L1** | 4.5 | 4.5 | 8.54 combined. A dip, but it frees a zone, and the Fusion reaches 19.2 at L10. |
| God Fusion | two L10 Fusions | **L10** | 12 | 51.2 | 38.4 combined, so +33% |
| Secret Fusion | two God Fusions | **L10** | 31 | 132.4 | 102.4 combined, so +29%, plus one cap-lifting trait |

- Fusions inherit 50% of the parents' summed Tuning bp, rounded down.
- Tier auras add team-wide MIGHT: Fusion +500 bp, God Fusion +1000 bp, Secret Fusion +1500 bp.
- **Level budget (corrected 22 Nov, counted by the planner in `src/loadout.js`):**
  - A Fusion line costs 21 level-ups to arrive: 2 × (1 to acquire + 9 levels) + 1 sealed chest. It costs 30 to reach L10. The duelist's free starter saves 1.
  - A God Fusion costs 61, which is the whole 60-level pre-Overtime budget. The God build in the sim fields Stormcrown Drake at exactly 8:00 with nothing else.
  - A Secret Fusion costs 123.
  - Overtime level income decides when a Secret Fusion is possible. With the Overtime Draw only (1 a minute), it lands at about 71 min. The sim assumes the Draw plus 2 XP level-ups a minute (`K.otXpLevelsPerMin`, an assumption), which puts it at about 29 min. **Pin this number down before tuning the late game.** It moves every Overtime result by 1-5 min (section 13 sweep).

**Tuning rolls (rarity factors).** Each level-up of a card adds the fixed curve above plus one Tuning roll. A stat is drawn from the card's pool:

| Pool entry | Base increment |
|---|---|
| dmg | +6% |
| rate | +4% |
| area | +5% |
| proc coef | +0.05 |
| projectile | +1 (weight 25%) |

The rarity factor then multiplies the increment. For a projectile, Radiant and above give +2.

| Rarity | Factor | Base weight /1000 |
|---|---|---|
| Plain | ×1.0 | 620 |
| Bright | ×1.3 | 250 |
| Gilded | ×1.7 | 100 |
| Radiant | ×2.2 | 26 |
| Mythic | ×3.0 | 4 |

- **Fortune tilt:** `w_i ← w_i × (1 + 1.5·φ·i)`, where i is the rarity index, then renormalise.
- Chest, shrine and Overtime Draw level-ups have a floor of Bright.
- Spells and Traps (Lv 1-5) use the same table on their `per` values.
- Storage is `Int16 tuning[slot][stat]` in bp.
- `param()` and `damageOf()` read a cached `slotStats` Float64Array that is rebuilt only on level-up or fusion. The per-attack `Object.keys` goes away.

---

## 9. Elements, statuses and reactions (bracket 6)

**Statuses.** Each element has a base chance p0, scaled by proc coefficient and Fervor.

| Element | Status | p0 | Effect |
|---|---|---|---|
| Fire | Burn | 1.0 | DoT of 0.25 × snapshot per second for 3 s |
| Ice | Chill | 0.8 | 30% slow for 2 s |
| Lightning | Arc | 0.6 | chain to the nearest enemy within 4.5 m at 0.5× |
| Poison | Venom | 0.8 | DoT of 0.15 × snapshot per second for 5 s |
| Wind | Gust | 0.5 | 1.5 m push (specials: none) |
| Earth | Stagger | 0.4 | 0.2 s stagger (specials immune) |
| Light | Reveal | 0.5 | +10% TARGET for 3 s |
| Dark | Drain | 0.3 | heal 1% of the hit, capped by HEAL_ONHIT |

**Auras.** Each enemy has `aura` (a Uint8 element mask) and `auraT` (a Uint8 timer of 2.5 s). A hit with element A on an aura holding B, where A ≠ B, fires the reaction `REACT[a*8+b]`.
- `REACT` is a 64-entry Uint8 lookup.
- The aura is consumed.
- A hit either applies an aura or reacts, never both.
- The reaction multiplies the **same hit** (bracket 6). It stacks with that hit's crit. Any splash it makes has coef 0.

| Pair | Reaction | R | Extra effect |
|---|---|---|---|
| Fire + Ice | Thermal Shock | 1.8 | consumes both auras |
| Fire + Poison | Toxic Flare | 1.2 | 40% splash, radius 2.5 m, coef 0 |
| Fire + Wind | Wildfire | 1.3 | spreads Burn to 3 nearby enemies |
| Lightning + Ice | Shatterbolt | 1.5 | 0.4 s stun (specials 0.1 s) |
| Lightning + Wind | Tempest | 1.2 | the chain gets +2 jumps, within chainMax |
| Earth + Wind | Sandblast | 1.1 | +20% TARGET shred for 3 s |
| Poison + Earth | Mire | 1.2 | 40% slow for 3 s |
| Ice + Wind | Whiteout | 1.3 | 1 s freeze, 6 s lockout |
| Light + Dark | Eclipse | 2.5 | 4 s lockout |

Reaction numbers are drawn in their own colour and font.

---

## 10. Event hooks

Content attaches to these five events only. Each event is compiled at recompute into an Int16 list of effect ids.

| Event | Fired by | Carries | Caps that apply |
|---|---|---|---|
| EV_HURT | step 9 of `hurtPlayer`, including SELF | n, flags, srcId | HURT_TRAP, SELF_PROC |
| EV_DODGE | dash i-frames or a Sidestep roll | srcId | none |
| EV_BLOCK | a Ward is spent | blocked n, srcId | none |
| EV_KILL | `drainKills` | idx, cause, depth | KILL_STACK, BELL, MARK_EXPLODE, explodeBudget |
| EV_REACT | `resolveHit` when a reaction fires | reaction id, idx | reactIcd, lockouts |

---

## 11. Duelist run-long passives (bracket 7, except Mira)

A passive's scalar is rebuilt only when its input changes: a `dirtyDuelist` flag is set, and the rebuild happens at most once per tick. The HUD badge shows the live value.

| Duelist | Passive | Formula | Ceiling | Sample values |
|---|---|---|---|---|
| Kael | Ante Up: coins held → damage | `1 + 0.025·√coins` | ×2.5 (3600 coins) | 400 coins → ×1.5. Spending visibly lowers it. |
| Mira | Graveyard Toll: kills → Tempo | `TEMPO += 800·log₂(1 + kills/500)` bp | +9000 bp | 10k kills → +35%, 300k → +74% |
| Vesh (new) | Hollow Hand: missing LP → damage | `1 + 1.2·(1 − hp/maxLp)` | ×2.2 (only at 1 HP) | pairs with Toll of Ash and the 1 HP floor |
| Oren (new) | Bound Pages: total Spell/Trap levels → Fervor | `FERV += 3 × ΣlevelsST` | 60 points (20 levels) | ×1.67 proc. Starts on Rime Sprite (Ice multi, 0.8 × 0.45), which stays below the 95% proc cap at 60 Fervor. |

Kael's value is recomputed on `g.coins` change at weapons.js:142 and cached.

---

## 12. Mystery item: Unmarked Card

- **Shop:** Plain rarity, 30 coins. Tooltip: "It does nothing?"
- **Hidden rule:** each level-up whose offers are all maxed or unusable (a full board, or Spells/Traps already at 5) banks 1 point instead of being wasted. So does each chest opened during Overtime.
- **Payoff:** each point adds +3% to its own bracket, HIDDEN (9), capped at 60 points (×2.8).
- **Reveal:** at 25 points the card turns face-up as **"The Wild Draw"**, and the tooltip then shows the real number.
- **Cost:** banking is deterministic and uses no RNG. It is one Uint8 counter, with zero per-frame cost.
- **Design intent:** it does nothing in a normal run and becomes a late-Overtime engine, which suits the Overtime Draw (section 13).

---

## 13. Overtime counter-scaling

**Enemy side:**
- `n` is the step count (an int, one step per 30 s).
- At boot, Float64 tables are built for n ≤ 400 (overflow is clamped and counted):
  - `HP_LUT[n] = 1.22ⁿ`
  - `DMG_LUT[n] = 1.10ⁿ`
  - `SPD_LUT[n] = min(1.02ⁿ, 1.6)`. 1.6 is the speed cap the game already uses. It is reached at step 24 (20:00).
- HP and damage never change their per-step factor. There is no extra HP once speed is capped (`K.otHpPostCap` = 1.0, asserted in `test/curves.test.mjs`).

**Player side:**
- **Resolve:** bracket 8 = 1 + 0.04·n, which is linear.
- **Overtime Draw:** +1 level-up every 60 s, with a Bright floor. Spells and Traps never pass level 5, so Overtime Draw picks that go to waste feed the Unmarked Card.
- **Guard** caps at 85% while enemy damage grows ×1.10 per step, so Sidestep and Wards become the late defence.

**Required DPM line** (balance target; Not assessed):

```
R(t) = K.R8 × (t/8)^2                              for t < 8   (added 22 Nov; gives 1,750 at 4 min)
R(t) = K.R8 × HP_LUT[n] × density(n)               for t ≥ 8   // K.R8 = 7000; HP_LUT ≈ 1.488 per minute
density(n) = 1 + K.densStep·n                      // K.densStep = 0.02 (gives 145k at 15 min)
T_end = 8 + ln(maxDPM / K.R8) / ln 1.488           (approximately)
```

**How the sim measures "holds" (Sim-measured).**
- Average enemy HP is `max(4, R(t)/360)` before Overtime and `R8/360 × HP_LUT[n]` after it. Spawns are `R(t)/HP`, which is 360 a minute, ×(1 + 0.02n) in Overtime. This makes R(t) exactly the HP arriving each minute.
- A build holds while its **effective** DPM (damage with overkill removed) is at least R(t).
- Raw DPM overstates early builds by 2-100×, because most of a 100-damage hit on a 5-HP enemy is wasted.

Every player bracket has a ceiling (section 2.2) except Resolve, which is linear. So maxDPM is finite and `T_end` exists. To move the end of a "perfect" run, tune `K.otHpStep`, never player content.

**Envelope (Sim-measured 22 Nov, effective DPM).** It replaces the old Not-assessed table. That table is kept below for reference.

| Build (sim id) | 4 min | 8 min | 12 min | 20 min | Holds until |
|---|---|---|---|---|---|
| Required R(t) | 1,750 | 7,000 | 39.9k | 1.22M | n/a |
| Fresh starter, no picks (`starter`) | 567 | 723 | 994 | 1.5k | 2.5 min |
| Normal: 4 monsters, 1 Fusion, about 2 brackets (`normal`) | 4.3k | 26.7k | 148k | 389k | **17.5 min** |
| Strong: 2-3 Fusion lines (`strong`) | 5.8k | 32.1k | 137k | 525k | 18.5 min |
| Focused Fusion pair with Thermal Shock (`fusionpair`) | 2.6k | 12.3k | 64k | 295k | 16 min |
| Self-damage + procs, Vesh (`broken`) | 5.6k | 21.7k | 81k | 794k | 16.5 min |
| God Fusion + Unmarked Card (`god`) | 7.3k | 23.6k | 134k | 1.59M | 21.5 min |
| Coins held, Kael (`kael`) | 2.6k | 20.1k | 146k | 2.93M | 24.5 min |
| Ceiling, synthetic: Secret Fusion + every bracket capped (`ceiling`) | 75k | 302k | 1.48M | 36M | 44.5 min |

**Old targets compared with the sim.** The old targets were Normal about 10.5 min, Strong about 14.5, Broken about 28 and Ceiling about 32.
- The sim's normal lasts 7 min longer than the target, and its ceiling 12.5 min longer.
- No budget-feasible build reaches 28 min. The best is Kael at 24.5.
- The knee brackets squeeze normal and strong together: they end only 1 min apart. Deliberate breaking (Kael, God) buys 4-7 min, which is a 4-8× DPM gap at 20 min.

**Overtime knob sweep (Sim-measured before the 22 Nov rules fix, on the old 1.45 speed cap with ×1.01 extra HP; each cell is up to 1 min early against the current tables; re-run before choosing; designer decision pending):**

| Setting | normal | strong | pair | broken | god | kael | ceiling |
|---|---|---|---|---|---|---|---|
| Old tables: otHpStep 1.22, OT levels 3/min | 17.5 | 18 | 16 | 16.5 | 21 | 24 | 43.5 |
| otHpStep 1.26 | 15.5 | 16.5 | 15 | 14.5 | 19.5 | 21.5 | 38.5 |
| otHpStep 1.30 | 14.5 | 15.5 | 14 | 14 | 18 | 19.5 | 35 |
| otHpStep 1.33 | 14 | 14.5 | 13.5 | 13 | 17 | 18 | 33 |
| OT levels 1/min (Draw only) | 16 | 16.5 | 14.5 | 14 | 18.5 | 19 | 43.5 |
| OT levels 2/min | 17 | 17.5 | 16 | 14.5 | 20.5 | 22 | 43.5 |

Pick by intent:
- To keep the reward gap and move only the "perfect run", leave `otHpStep` alone and cap the ceiling through content.
- To match the old 32-minute ceiling, use about 1.33 and accept a gap of about 4 min between normal and breaking builds.
- To end normal runs near 11 min without squeezing the gap, only a one-time Overtime entry multiplier of about ×13 HP works. That is a wall at 8:00 and is not recommended.

<details><summary>Old envelope (Not assessed, superseded)</summary>

| Build | 4 min | 8 min | 15 min | Holds until |
|---|---|---|---|---|
| Required R(t) | 1,800 | 7,000 | 147k | n/a |
| Normal (4 monsters, 1 Fusion, about 2 brackets invested) | 2,600 | 9,000 | 25k | about 10.5 min |
| Strong (2 Fusions, 4 brackets, tuned Spells) | 4,000 | 16,000 | 120k | about 14.5 min |
| Broken (God Fusion, reactions, duelist synergy, Fortune) | 6,000 | 30,000 | 600k | about 28 min |
| Ceiling (Secret Fusion, every bracket at its ceiling) | n/a | n/a | 2M | about 32 min |

</details>

**Defence in Overtime (Sim-measured).**
- The contact hit grows from 10.4 at 8:00 to 159 at 20 min and 1,389 at 30 min.
- At a stand-still contact rate of 0.25/s, with no healing pickups, builds that skip Guard and Sidestep (Kael, God) die 11-16 times a minute at 20 min, while their DPM still holds.
- Defence, not DPM, may end those runs first. This needs a played seed.

---

## 14. Performance plan (300k-600k kills)

1. **Stat sheet:**
   ```
   sheet = { pts: Int32Array(STAT_N), hitMul: Float64Array(2048), stamp: Uint32Array(2048), dirty }
   ```
   - `recompute(g, mask)` rebuilds only the dirty groups: items, spells, slots or duelist.
   - Element masks are filled lazily on first use after a recompute, using the stamp.
2. **Hit path without allocation.** The new signature is `damageEnemy(g, i, dmg, flags, proc)`:
   - `flags` is a Uint16 packing src(3), elem(8), NOCRIT, NOCHAIN, AREA and SELF.
   - Every `{…}` options literal is removed from the call sites (weapons.js:87,97,109,110; monsters.js:80,101,103,125,126,149; combat.js:53,84,89), along with `o = o || {}` (combat.js:25, specials.js:40).
3. **FX:** `addFx(type, x, y, z, a, b)` takes positional arguments and writes into SoA typed arrays, with no `Object.assign`. The pickup magnet uses scalar locals. `target()` writes into a module-level `tgtOut` Float64Array(4).
4. **Mark attack:** fixed top-K insertion into Int32 and Float32 scratch arrays. No push, no sort.
5. **Boss traps:** index scans, with no `find` or `filter`.
6. **O(1) pools:** shots, pickups, fx and telegraphs each get an Int32Array free-list stack. This replaces the linear `slot()`, `dropPickup` and `addFx` scans.
7. **No recursion:**
   - Kills push `(idx, cause, depth)` into the Int32 ring `killQ`. `drainKills()` runs after each system's update and applies the section 5 budgets.
   - Explosions, chains, cones and traps take their candidate list from `src/sim/scratch.js` (`takeBuf` / `freeBuf`, one slab per nesting depth, `resetBufs` at the top of every tick). Built: before it, `explode` iterated one shared list while a nested blast overwrote it.
8. **Events:** at recompute, EV_HURT, EV_DODGE, EV_BLOCK, EV_KILL and EV_REACT are each compiled into an Int16Array of effect ids. Dispatch is a `switch`, with no closures.
9. **Caps:** caps are Uint16 bucket arrays, rolled in the existing 1 Hz world tick.
10. **Counters:**
    - `g.kills` and the coin total are float64, exact to 2⁵³.
    - `damageBy` becomes a Float64Array indexed by a source enum.
    - `bracketDmg` is a Float64Array(10).
11. **Determinism:**
    - Crit and proc rolls draw from `g.rngHit` in a fixed order inside `resolveHit`.
    - Tuning rolls draw from `g.rng`.
    - The Overtime tables replace `Math.pow` (built as running products).
    - The Ledger's runtime code uses only + - * / floor sqrt, matching `src/sim/dmath.js`; Mira's log2 is `dlog2` (series, no `Math.log2`). `test/engine.test.mjs` scans for clocks, `Math.random` and transcendental calls.
    - Integration: the hit RNG should become a fifth named stream appended to `STREAMS` in `src/sim/rng.js` (appending never shifts the existing four); the prototype's own xorshift is a stand-in.

---

## 15. What the PC build changes

**New `src/data` files:**
- `src/data/tuning.js`: holds `K`, with every constant named in this spec. These are the curve k values and caps, bracket knees and ceilings, `lvlSlope`, `lvlRate`, `form`, `tier`, the rarity table, the proc table, the reaction R values, the duelist constants, the Overtime tables, `R8` and the envelope.
- `src/data/stats.js`: holds the `STAT` and `BR` enums, the source ids (`SRC_MON..SRC_ITEM`), the cap ids and the event ids.

**Edited `src/data` files:**
- `src/data/cards.js`:
  - In `FIELD_RULES`, `critChance` and `critMult` move to `K`.
  - In `LEVELS`, `damagePerLevel` is replaced by `K.lvlSlope`.
  - `OFFER.rarityOdds` is replaced by the Plain..Mythic table.
  - Spell `per` values become `[STAT, pts]` pairs.
  - Content is added: Toll of Ash, Cinder Penitent, and the Vesh and Oren duelists with passive ids.
  - Kael and Mira get their passives.
- `src/data/items.js`:
  - `mods` are converted to `[STAT, value]` pairs (see the content conversion table in section 1).
  - Unmarked Card, Thornbound Locket and Recoil Seal are added.
  - Blessings are converted.
- `src/data/elements.js`:
  - The six planned elements get statuses and p0 values.
  - `REACTIONS` becomes the `REACT[64]` table.
  - `shots.flame` is renamed to `elem` wherever it is referenced.
  - `TIERS` gain `T` and the aura values.
- `src/data/field.js`: `RARITIES` ids and weights become Plain, Bright, Gilded, Radiant and Mythic.

**New `src/sim` files:**
- `src/sim/ledger.js`: the sheet, `recompute(g, mask)` (replacing field.js:32-52), the curve LUTs, the `hitMul` cache and the duelist and HIDDEN scalars.
- `src/sim/hit.js`: `resolveHit`, `resolveTick`, auras and reactions, and the proc roll.
- `src/sim/caps.js`: rolling buckets, budgets and the pip state.
- `src/sim/killq.js`: the kill ring, `drainKills` and the per-depth scratch slabs.
- `src/sim/pools.js`: free-list stacks.
- `src/sim/events.js`: compiled event lists.

**Edited `src/sim` files:**
- `src/sim/combat.js`: `damageEnemy` delegates to `resolveHit`. `killEnemy` pushes to `killQ`. `chain` and `explode` use the scratch slabs. `addFx` takes positional arguments.
- `src/sim/specials.js`: `damageSpecial` delegates to `resolveHit` (shield pre-check kept). Boss trap placement uses index scans.
- `src/sim/enemies.js`: the burn tick at :81 becomes `resolveTick` over the status columns. Overtime HP at :63 reads `HP_LUT`.
- `src/sim/spawner.js`: `g.dmgMul` and `g.hpMul` read from the Overtime tables, with the speed cap.
- `src/sim/game.js`:
  - `hurtPlayer` (:160-170) is replaced by the section 6 pipeline.
  - The stale `mods` literal at :49 is removed.
  - The `recompute` call sites (:51, :155) move to `ledger.recompute`.
  - The Overtime Draw and Resolve step are added.
- `src/sim/field.js`: `param()` and `damageOf()` read `slotStats`. `rarityRoll` (:74-78) uses the Fortune tilt. Fusion carries Tuning forward and applies the tier aura. The pick and item recompute calls (:69, :155, :165, :166) pass dirty masks.
- `src/sim/monsters.js`:
  - Proc coefficients go on every attack kind.
  - Top-K replaces push and sort at :76-78.
  - `target()` writes into `tgtOut`.
  - Traps read Rewind through the curve (:117).
  - `onPlayerHurt` subscribes to EV_HURT with the caps.
- `src/sim/weapons.js`: a `shots.proc` Uint8 column is added and `flame` becomes `elem`. Free-list `slot()`. The magnet uses scalars (:133). A coin change sets the duelist dirty flag (:142).
- `src/sim/world.js`: Ward recharge replaces `talismanCd` (:114). The 1 Hz cap-bucket roll and Renewal are added.
- `src/sim/player.js`: reads the Stride soft curve, Dash, Dash Recovery and Lift from the sheet.

**New tests:**
- `test/ledger.test.js`: LUTs match the formulas for every k; add-within / multiply-across on hand-computed sheets; knee ceilings checked by stacking 99 copies.
- `test/selfdamage.test.js`: HP floors at 1; SELF still emits EV_HURT; HURT_TRAP and SELF_PROC caps hold; SELF never grants grace.
- `test/soak.test.js`: a seeded bot runs to 600k kills and checks four things:
  - the determinism hash is stable;
  - heap growth after warm-up stays under 1 MB (`--expose-gc`);
  - p99 tick time stays under 4 ms;
  - section 5 budgets are never exceeded.

  It also runs a cascade test on a 2,000-enemy marked pack.

**Extended tests:**
- `test/run-sim.mjs`: the DPM envelope assertions.
- `test/sim.test.js`: unified swarm and special damage parity (fixes the specials.js:45 mismatch).

**Verification status (22 Nov):** The prototype in `/home/user/dsengine` now checks most of this section without the game: 46 tests pass under `node --test`, and `node sim/builds.mjs` runs the build sim with its assertions. It covers:
- curves and LUTs, knee ceilings, add-within and multiply-across;
- the boundedness probe;
- the 7-bucket caps and the per-tick budgets;
- the self-damage pipeline: floor, EV_HURT on SELF, no grace, HURT_TRAP 30/12 and SELF_PROC 15;
- zero allocations per hit and 600k-kill counters;
- planner budgets and zones.

It does not cover the game's own `src/sim` integration, the heap and p99 soak inside the real tick, or any played seed. Those stay Not assessed.
