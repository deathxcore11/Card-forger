# Duel Summoner Ledger: sim report (22 Nov)

Prototype: `/home/user/dsengine`. It is standalone and dependency-free, uses Node ES modules, and was run on Node 22.
- `node --test` runs 38 tests; all pass.
- `node sim/builds.mjs` runs the build sim plus its assertions. It exits 1 if any assertion fails. The current run passes. Its output is deterministic: two runs gave identical tables apart from the ns timings.

Every number below is **Sim-measured**: it comes from the prototype's 60 Hz combat sim through the real hit pipeline, not from a played seed.

## What was built

- **`src/stats.js`: the Ledger.**
  - Int32 stat sheet. Damage brackets 0-9: add within a bracket, multiply across brackets, with a `hitMul` cache keyed by `src<<8 | elemMask` and checked against a stamp.
  - Knee soft caps and hard ceilings.
  - Hyperbolic `x/(k+x)` LUT curves: Guard, Sidestep, Keen, Fervor and Fortune; plus Rewind, Bargain and soft Stride.
  - Proc coefficients, with a proc cap of 95% applied as an integer threshold.
  - Elements and reactions, with an aura model, a reaction internal cooldown and lockouts.
  - DoT snapshots.
  - Per-hit and per-tick budgets: chain budget, explode budget with a spill ring, explode depth 1.
  - Rolling per-minute caps with an audit log.
  - Bounded kill ring and Overtime tables.
  - Self-damage pipeline `hurtPlayer`: SELF goes through the normal pipeline and fires EV_HURT. It skips evasion, Wards, Guard and grace, and has a 1 HP floor.
  - Compiled event lists, with `switch` dispatch and no closures.
- **`src/tuning.js`:** `K`, which holds every constant by name.
- **`src/content.js`:** sample content. All names are ours: 15 monsters across all four tiers, 14 Spells/Traps, 18 items including the Unmarked Card, 6 blessings and 5 duelists.
- **`src/loadout.js`:**
  - A level-up planner that follows the level budget, the 4+4 zones and the level ranges.
  - Tuning rolls with rarity factors (Plain 1.0, Bright 1.3, Gilded 1.7, Radiant 2.2, Mythic 3.0) and the Fortune tilt.
  - Fusion inheritance of 50%, and God and Secret Fusions arriving at L10.
  - The per-minute combat runner.
- **`src/bench.js`:** the microbenches.
- **`sim/builds.mjs`:** eight builds, the table, holds-until, and the assertions.
- **`test/*.test.mjs`:** curves, caps, self-damage, performance and the sim.

**What we took from the outside reference: four architecture lessons only.**
- Bracket ids: add within, multiply across.
- Hyperbolic curves for evasion, armour and proc stats.
- Self-damage through the normal hurt pipeline with a 1 HP floor.
- Proc coefficients plus per-minute stacking caps from day one.

Plus the idea of scaling-curve families and rarity factors on upgrade rolls. No names, numbers or content were copied. Our rarity factors and every constant are our own.

## Sim model and assumptions

- **Run timing.** Each cell is 30 s of warm-up plus 60 s measured at 60 Hz. Holds-until uses 15 s + 30 s per half-minute grid point.
- **Enemies.** A horde pool of 96. Weapons hit a shared front of enemies, so reactions come from different monsters hitting the same enemy. Average enemy HP is `max(4, R(t)/360)` before Overtime and `R8/360 × HP_LUT[n]` in Overtime, so the required line R(t) is exactly the HP arriving each minute.
- **Effective DPM.** Overkill is removed. A build *holds* while effective DPM ≥ R(t). Raw DPM is shown too.
- **Level budget.** 60 level-ups by 8:00, then the Overtime Draw (1/min) plus **an assumed 2 XP level-ups/min** (`K.otXpLevelsPerMin`).
- **Duelist inputs.** Mira's run kills are estimated at 1,200/min before Overtime and 12,000/min in Overtime. Kael's coins held follow keyframes: 90 at 2 min up to 5,500 at 30.
- **Contact hits.** 0.25/s, at 8 × (1 + 0.06/min from 3:00) × DMG_LUT. There are no healing pickups, so deaths/min is a stress figure, not a forecast.
- **The `ceiling` build is synthetic.** It has a Secret Fusion plus three L10 Fusions, and every stat above its ceiling. It is an upper bound, not a reachable build.

## Results (output of `node sim/builds.mjs`)

### Overtime curve (enemy side)
| min | OT step n | Overtime HP x (HP_LUT) | avg enemy HP | spawns/min | enemy contact hit | required DPM R(t) |
|---|---|---|---|---|---|---|
| 2 | - | 1.00 | 4.00 | 109 | 8.00 | 438 |
| 4 | - | 1.00 | 4.86 | 360 | 8.48 | 1750 |
| 8 | 0 | 1.00 | 19.4 | 360 | 10.4 | 7000 |
| 12 | 8 | 4.91 | 95.4 | 418 | 26.4 | 39.9k |
| 20 | 24 | 118 | 2298 | 533 | 159 | 1.22M |
| 30 | 44 | 6307 | 122.6k | 677 | 1389 | 83.00M |

### Builds by minute
| build | min | levels used/avail | raw DPM | eff. DPM | required | eff/req | procs/s | crit % | reacts/min | kills/min | EHP | avg LP | hits to die | deaths/min | B7 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| starter | 2 | 0/15 | 614 | 523 | 438 | 1.20 | 2.28 | 0.3 | 0.00 | 130 | 100 | 50.4 | 7.00 | 1.00 | 1.00 |
| starter | 4 | 0/30 | 654 | 567 | 1750 | 0.32 | 2.35 | 0.8 | 0.00 | 120 | 100 | 52.3 | 7.00 | 1.00 | 1.00 |
| starter | 8 | 0/60 | 734 | 723 | 7000 | 0.10 | 2.37 | 0.2 | 0.00 | 16.0 | 100 | 46.4 | 5.00 | 2.00 | 1.00 |
| starter | 12 | 0/72 | 994 | 994 | 39.9k | 0.02 | 2.33 | 0.4 | 0.00 | 0.00 | 100 | 65.1 | 3.00 | 4.00 | 1.00 |
| starter | 20 | 0/96 | 1459 | 1459 | 1.22M | 0.00 | 2.27 | 0.3 | 0.00 | 0.00 | 100 | 100 | 1.00 | 14.0 | 1.00 |
| starter | 30 | 0/126 | 2095 | 2095 | 83.00M | 0.00 | 2.47 | 0.3 | 0.00 | 0.00 | 100 | 100 | 1.00 | 10.0 | 1.00 |
| normal | 2 | 15/15 | 3659 | 2261 | 438 | 5.17 | 6.00 | 18.8 | 53.0 | 557 | 138 | 50.3 | 8.00 | 1.00 | 1.00 |
| normal | 4 | 30/30 | 8655 | 4253 | 1750 | 2.43 | 7.85 | 29.9 | 0.00 | 873 | 161 | 36.4 | 7.00 | 1.00 | 1.00 |
| normal | 8 | 60/60 | 64.2k | 26.7k | 7000 | 3.81 | 13.9 | 26.8 | 15.0 | 1370 | 324 | 103 | 27.0 | 0.00 | 1.00 |
| normal | 12 | 72/72 | 210.9k | 147.6k | 39.9k | 3.70 | 20.3 | 28.6 | 70.0 | 1539 | 360 | 66.4 | 8.00 | 0.00 | 1.00 |
| normal | 20 | 96/96 | 402.0k | 388.7k | 1.22M | 0.32 | 25.9 | 12.7 | 329 | 172 | 735 | 114 | 4.00 | 3.00 | 1.00 |
| normal | 30 | 126/126 | 715.9k | 715.9k | 83.00M | 0.01 | 27.8 | 10.8 | 379 | 0.00 | 1946 | 143 | 2.20 | 3.00 | 1.00 |
| strong | 2 | 15/15 | 4493 | 3171 | 438 | 7.25 | 8.82 | 14.5 | 0.00 | 788 | 138 | 61.1 | 9.00 | 1.00 | 1.00 |
| strong | 4 | 30/30 | 10.8k | 5841 | 1750 | 3.34 | 11.7 | 23.9 | 0.00 | 1199 | 184 | 56.6 | 12.0 | 1.00 | 1.00 |
| strong | 8 | 60/60 | 48.2k | 32.1k | 7000 | 4.59 | 16.0 | 12.1 | 0.00 | 1653 | 277 | 82.5 | 18.0 | 0.00 | 1.00 |
| strong | 12 | 72/72 | 204.3k | 136.8k | 39.9k | 3.43 | 20.6 | 22.7 | 147 | 1430 | 307 | 64.1 | 6.00 | 1.00 | 1.00 |
| strong | 20 | 96/96 | 544.3k | 525.3k | 1.22M | 0.43 | 33.7 | 10.0 | 504 | 230 | 338 | 68.8 | 2.00 | 3.00 | 1.00 |
| strong | 30 | 126/126 | 1.29M | 1.29M | 83.00M | 0.02 | 47.0 | 10.9 | 585 | 0.00 | 571 | 170 | 2.20 | 8.00 | 1.00 |
| fusionpair | 2 | 15/15 | 2652 | 1351 | 438 | 3.09 | 5.73 | 2.4 | 60.0 | 334 | 100 | 42.3 | 6.00 | 1.00 | 1.00 |
| fusionpair | 4 | 30/30 | 6311 | 2603 | 1750 | 1.49 | 9.62 | 0.8 | 9.00 | 530 | 100 | 48.2 | 7.00 | 1.00 | 1.00 |
| fusionpair | 8 | 60/60 | 46.4k | 12.3k | 7000 | 1.76 | 14.1 | 1.4 | 242 | 629 | 138 | 47.3 | 6.00 | 1.00 | 1.00 |
| fusionpair | 12 | 72/72 | 141.8k | 63.8k | 39.9k | 1.60 | 19.5 | 1.6 | 364 | 671 | 138 | 60.2 | 4.00 | 3.00 | 1.00 |
| fusionpair | 20 | 96/96 | 310.3k | 294.7k | 1.22M | 0.24 | 23.0 | 0.8 | 406 | 128 | 187 | 130 | 2.20 | 10.0 | 1.00 |
| fusionpair | 30 | 126/126 | 1.17M | 1.17M | 83.00M | 0.01 | 22.8 | 0.5 | 438 | 0.00 | 187 | 130 | 2.20 | 8.00 | 1.00 |
| god | 2 | 15/15 | 4609 | 2469 | 438 | 5.64 | 4.35 | 3.9 | 0.00 | 618 | 100 | 44.1 | 6.00 | 1.00 | 1.00 |
| god | 4 | 30/30 | 15.0k | 7347 | 1750 | 4.20 | 11.9 | 12.9 | 0.00 | 1510 | 100 | 50.3 | 7.00 | 1.00 | 1.00 |
| god | 8 | 60/60 | 123.7k | 23.6k | 7000 | 3.37 | 7.68 | 9.5 | 0.00 | 1213 | 138 | 68.6 | 8.00 | 1.00 | 1.00 |
| god | 12 | 72/72 | 277.5k | 133.6k | 39.9k | 3.35 | 8.88 | 8.5 | 0.00 | 1400 | 138 | 62.3 | 3.00 | 2.00 | 1.00 |
| god | 20 | 96/96 | 2.17M | 1.59M | 1.22M | 1.30 | 22.5 | 6.7 | 524 | 693 | 156 | 130 | 2.00 | 11.0 | 1.00 |
| god | 30 | 110/126 (+16 banked) | 6.86M | 6.83M | 83.00M | 0.08 | 29.3 | 3.2 | 708 | 18.0 | 187 | 130 | 2.20 | 15.0 | 1.00 |
| broken | 2 | 15/15 | 11.9k | 2455 | 438 | 5.61 | 5.88 | 5.4 | 3.00 | 610 | 100 | 44.1 | 6.00 | 2.00 | 1.67 |
| broken | 4 | 30/30 | 67.4k | 5592 | 1750 | 3.20 | 13.7 | 4.9 | 3.00 | 1149 | 190 | 43.9 | 11.0 | 2.00 | 1.67 |
| broken | 8 | 60/60 | 137.5k | 21.7k | 7000 | 3.10 | 14.9 | 3.9 | 5.00 | 1121 | 260 | 46.2 | 13.0 | 2.00 | 1.65 |
| broken | 12 | 72/72 | 238.9k | 81.4k | 39.9k | 2.04 | 20.4 | 1.5 | 366 | 845 | 312 | 53.0 | 8.20 | 3.00 | 1.56 |
| broken | 20 | 96/96 | 954.6k | 794.3k | 1.22M | 0.65 | 27.2 | 0.7 | 458 | 352 | 476 | 15.8 | 3.40 | 2.00 | 2.01 |
| broken | 30 | 126/126 | 2.31M | 2.31M | 83.00M | 0.03 | 27.2 | 0.5 | 531 | 0.00 | 924 | 70.3 | 3.40 | 8.00 | 1.36 |
| kael | 2 | 15/15 | 3317 | 1695 | 438 | 3.87 | 4.62 | 23.7 | 0.00 | 425 | 100 | 63.9 | 8.00 | 1.00 | 1.24 |
| kael | 4 | 30/30 | 12.7k | 2639 | 1750 | 1.51 | 4.95 | 21.3 | 0.00 | 545 | 100 | 51.2 | 7.00 | 1.00 | 1.40 |
| kael | 8 | 60/60 | 153.4k | 20.1k | 7000 | 2.87 | 11.8 | 37.5 | 0.00 | 1028 | 100 | 50.5 | 6.00 | 2.00 | 1.66 |
| kael | 12 | 72/72 | 423.0k | 146.0k | 39.9k | 3.66 | 12.0 | 38.0 | 0.00 | 1532 | 100 | 56.7 | 3.00 | 4.00 | 1.94 |
| kael | 20 | 96/96 | 4.39M | 2.93M | 1.22M | 2.39 | 15.9 | 24.1 | 82.0 | 1276 | 100 | 100 | 1.00 | 14.0 | 2.37 |
| kael | 30 | 126/126 | 8.03M | 7.89M | 83.00M | 0.10 | 14.3 | 6.6 | 105 | 48.0 | 100 | 100 | 1.00 | 13.0 | 2.50 |
| ceiling | 2 | synthetic (+60 banked) | 6.76B | 62.3k | 438 | 142.32 | 182 | 59.1 | 0.00 | 15.6k | 7407 | 500 | 1115 | 0.00 | 2.50 |
| ceiling | 4 | synthetic (+60 banked) | 6.69B | 75.5k | 1750 | 43.17 | 182 | 59.3 | 0.00 | 15.5k | 7407 | 500 | 1115 | 0.00 | 2.50 |
| ceiling | 8 | synthetic (+60 banked) | 6.73B | 302.2k | 7000 | 43.17 | 182 | 59.2 | 0.00 | 15.5k | 7407 | 500 | 560 | 0.00 | 2.50 |
| ceiling | 12 | synthetic (+60 banked) | 8.94B | 1.48M | 39.9k | 37.17 | 182 | 59.7 | 0.00 | 15.5k | 7407 | 500 | 282 | 0.00 | 2.50 |
| ceiling | 20 | synthetic (+60 banked) | 13.08B | 35.78M | 1.22M | 29.22 | 182 | 59.0 | 0.00 | 15.6k | 7407 | 500 | 50.7 | 0.00 | 2.50 |
| ceiling | 30 | synthetic (+60 banked) | 20.48B | 1.76B | 83.00M | 21.20 | 196 | 46.9 | 315 | 14.4k | 7407 | 500 | 10.7 | 0.00 | 2.50 |

### Holds until (first half-minute where effective DPM < required; 15 s warm-up + 30 s measured per point)
| build | falls below at | last holding point | eff. DPM there | required there |
|---|---|---|---|---|
| starter | 2.5 min | 2 | 576 | 684 |
| normal | 17.5 min | 17 | 349.2k | 422.5k |
| strong | 18.5 min | 18 | 506.9k | 647.1k |
| fusionpair | 16 min | 15.5 | 209.1k | 222.6k |
| god | 21.5 min | 21 | 1.97M | 2.31M |
| broken | 16.5 min | 16 | 275.4k | 275.6k |
| kael | 24.5 min | 24 | 7.28M | 8.22M |
| ceiling | 44.5 min | 44 | 34.16B | 34.70B |

### Caps observed (peak in any sliding 60 s window / limit, over all cells)
| cap | peak | limit |
|---|---|---|
| HURT_TRAP | 15 | 30 |
| HURT_TRAP_SELF | 12 | 12 |
| SELF_PROC | 15 | 15 |
| KILL_STACK | 150 | 150 |
| BELL | 20 | 20 |
| MARK_EXPLODE | 540 | 540 |
| DUEL_GAIN | 0 | 600 |

### Reactions per minute at 12 min
- starter: none
- normal: THERMAL 19.0, SHATTER 51.0
- strong: THERMAL 93.0, SHATTER 54.0
- fusionpair: THERMAL 364
- god: none
- broken: THERMAL 358, WILDFIRE 4.00, WHITEOUT 4.00
- kael: none
- ceiling: none

### Microbench
- 1e6 hits (mixed elements, crits, reactions, chains, kills, explosions, Bell, Tally, self-damage every 64 hits): 294.2 ns/hit, heap delta 671560 B (0.672 B/hit amortised, cold 1 Hz paths included), GC events in window: 0
- per-hit path only (all 8 elements, reactions, chains; no kill events): 130.2 ns/hit, heap delta 304 B, GC events 0

### All sim assertions passed

## Assertions (all hold)

| Assertion | Where | Result |
|---|---|---|
| No stat reaches 100% evasion, proc, crit or mitigation | `assertCell`; curves test (`pts = 1e9` is clamped to 1023) | Evasion at most 55%, proc at most 95% (integer threshold < 2^24), crit at most 77.2%, Guard at most 85% |
| No NaN or Infinity | every cell, every bracket, the benches; OT tables to n = 400 | none |
| Self-damage never kills | every cell (`SELF_DEATHS = 0`); 100k-case fuzz; Toll of Ash for 10 min | none. LP below 1 is never raised by SELF |
| Per-minute caps hold | audit log, checked over **sliding** 60 s windows, every cell | every peak ≤ limit: HURT_TRAP 15/30, HURT_TRAP_SELF 12/12, SELF_PROC 15/15, KILL_STACK 150/150, BELL 20/20, MARK_EXPLODE 540/540 |
| Zero per-hit allocations, 1e6 hits | `benchPerHitPath`; perf test | **0 GC events, about 300 B heap growth, about 80-120 ns/hit**. The mixed bench (kills, explosions, Bell, Tally, self-damage) runs about 170-215 ns/hit with 0-2 GC events in the window and about 0.3-0.8 B/hit amortised, all from interpreter-tier code that runs once a second |
| 600k kills | perf test | exact float64 kill count, no kill-queue drops |
| No build unbounded | boundedness probe (every offensive stat from 1e6 to 1e8 points < ×1.01); every build crosses R(t) before 60 min | holds. Under the **old** formulas, TEMPO, DRAW, VOLLEY and EDGE were unbounded (see Finding 1) |

## Findings

1. **The old spec had unbounded stats. Fixed in SPEC section 2.2.** TEMPO and DRAW were linear multipliers on attack rate. VOLLEY added projectiles without a cap, and EDGE was a flat add without a cap. So "every player bracket has a ceiling, therefore maxDPM is finite" was false. The probe shows these four growing ×100 when their points grow ×100. Under the old formulas, the synthetic ceiling still held at **62 min**, and it would last longer with more item stacks. Now TEMPO and DRAW use a knee at +100% (×3.0 asymptote), VOLLEY caps at 6 and EDGE caps at +30 flat. With those, the ceiling falls at **44.5 min** (43.5 before the 22 Nov Overtime rules fix, below).
2. **The old 6-bucket cap window leaked. Fixed: 7 buckets.** A burst of 20 Bell tolls at 9.98 s and another 20 at 60 s both pass with 6 buckets, which is 40 in one real minute. With 7 buckets (a window of 60-70 s), no sliding 60 s window exceeds the limit. The random-burst test covers all caps.
3. **Overtime is not unbeatable early, and no real build outpaces it.**
   - Every real build falls below R(t) between 16 and 24.5 min. The no-picks starter falls at 2.5 min.
   - Before Overtime, every real build runs 1.5-7× R(t). The base game is comfortable.
   - Overtime HP compounds at about 1.49/min. Player DPM grows only through Resolve (linear), Overtime level-ups, Mira's log-scaled Tempo and Kael's capped coins. So every build loses 8-16 min after 8:00. That is the design working.
4. **The sim does not match the old envelope. Overtime constants unchanged; the choice is the designer's.**
   - Normal holds to **17.5 min** (target about 10.5).
   - Strong holds to 18.5 (target about 14.5).
   - The best deliberate breaks reach 21.5-24.5 min (target about 28).
   - The synthetic ceiling reaches 44.5 (target about 32).
   - Normal and strong end only 1 min apart, because the knee brackets squeeze the investment axis.
   - Breaking buys 4-7 min: 4-8× effective DPM at 20 min.
   - SPEC section 13 now has a sweep table. `otHpStep` 1.33 brings the ceiling to 33 min but cuts the reward gap to about 4 min. Leaving it at 1.22 keeps the gap. I did not change it, because neither trigger was hit (no unbounded build, and Overtime not too early). It needs a designer call.
5. **The self-damage + proc build breaks the early game, not Overtime. The caps are working.**
   - At 4 min its raw DPM is 67k against a requirement of 1,750 (38×). Thornbound Locket novas are about 56% of its raw damage. Its effective DPM is only 3.2×, because the novas overkill 5-HP enemies.
   - In Overtime its engine is fixed by caps: 15 self-procs/min, a Locket base of at most 720, 12 self trap fires/min. The engine's DPM stops growing, so by 20 min the build lives on its two Fusions and holds to 16.5 min, below normal.
   - Vesh's ×2.2 needs exactly 1 HP. The sim averaged ×1.36-1.86.
   - If "breaking through self-damage" should reach Overtime, the lever is a cap-lifting Secret Fusion trait (for example SELF_PROC 30), not a bigger base. That matches the spec's "caps as a menu" design.
6. **Rolling caps are bursty.** A 2.4/s self-damage stream spends all 15 SELF_PROC charges in about 6 s, then nothing fires for about 60 s. A 30 s measuring window can show 0 Locket fires. If that feels bad in play, a token bucket (one charge every 4 s) keeps the same ceiling and evens it out. Noted in the spec; not changed.
7. **The level budget in the old spec was optimistic. Corrected in SPEC section 8.**
   - Fusion: 21 level-ups to arrive, 30 to L10.
   - God Fusion: 61, the entire pre-Overtime budget. The God build has Stormcrown Drake at 8:00 and nothing else.
   - Secret Fusion: 123. It needs Overtime XP income. With the Draw alone it lands at about 71 min.
   - Overtime level income moves every late-game result by 1-5 min, and the spec never defined it.
8. **Thornbound Locket kept scaling on dead stat points. Capped at min(Guard, 120).** Guard mitigation tops out at 85%, around 114 points, but Locket damage kept rising to the 1023 clamp. That was 8.5× more nova damage from points that do nothing defensively.
9. **Defence may end Overtime runs before DPM does.**
   - At 20 min the contact hit is 159, and at 30 min it is 1,389.
   - Builds with no Guard or Sidestep (Kael, God) take 11-16 deaths/min at 20 min under the stress contact rate, while their DPM still holds. Kael holds to 24.5 min on DPM.
   - Guard's 85% and Sidestep's 55% caps make Wards and LP the late defence, as the spec intends. This needs a played seed.
10. **Unmarked Card works as designed.** It banks nothing until the plan runs out. The God build banks 16 points by 30 min (×1.48 HIDDEN). The ceiling's 60 points give ×2.8.
11. **Performance.**
    - Three V8 traps showed up in the bench, each a boxed double:
      - doubles passed as arguments into non-inlined hot methods;
      - a double returned from the duelist scalar;
      - the proc clamp merging a computed double with a `K.procCap` constant.
    - Fixes: scratch registers (`this.f`), field writes and an integer threshold. These rules are written into the spec.
    - What remains: about 100 B/s from interpreter-tier code that runs once a second (Tally refresh, Bell toll). That cost is per second, not per hit.

## SPEC.md changes (22 Nov)

1. Ceilings added for TEMPO/DRAW (knee ×3.0), VOLLEY (6) and EDGE (+30) (section 2.2).
2. Per-minute caps use 7 buckets; burstiness noted (section 5.2).
3. Thornbound Locket reads min(Guard, 120) (section 6).
4. The 1 HP floor never raises LP already below 1 (section 6, step 6).
5. Level-budget numbers corrected; Overtime level income flagged as undefined (section 8).
6. R(t) defined before 8:00; density(n) made explicit; the sim's effective-DPM "holds" rule documented (section 13).
7. Envelope replaced with sim-measured values; old table kept for reference; Overtime knob sweep added; `otHpStep` unchanged (section 13).
8. Zero-allocation rules and the integer proc threshold documented (sections 2.1, 3).
9. Verification status updated (section 15).
10. Rules review (22 Nov): Overtime tables now follow the run rule exactly. HP ×1.22 and damage ×1.10 every 30 s with no hidden ×1.01 HP kicker; speed ×1.02 capped at 1.6, the game's own `speedCap` (was 1.45). R(20) is 1.22M (was 1.30M). Results above are re-run on the new tables: strong 18 → 18.5, god 21 → 21.5, kael 24 → 24.5, ceiling 43.5 → 44.5 min; normal, pair and broken are unchanged. The `otHpStep` sweep in SPEC section 13 was measured on the old tables.
11. Originality review (22 Nov): two item names renamed because they echoed an outside reference. "Mirror Veil" is now **Recoil Seal** (same effect), and "Humming Fork" is now **Humming Reed** (same effect).
12. Balance skeptic review (22 Nov, `test/balance.test.mjs`; probes run through `runMinute` and the Ledger):
    - **Edge scaled by weapon cooldown.** With capped Edge, four plain L10 Lantern Acolytes (0.1 s beam) reached 58k effective DPM at 8:00 against 11k for a lone God Fusion (Edge gave the beam ×18 and the God Fusion ×1.3). Now Edge per hit = `edge × cd / edgeRefCd`; the same probe gives 13k. No current content grants Edge, so the real builds do not move.
    - **On-event item copies capped** (`copyEff`, ×4 asymptote). The Locket base was linear in copies. In a swarm probe (hurt every 0.25 s, LP reset each hit, Might maxed), one Locket held alone to 24 min and 30 copies to 32.5 min. Sustain, not damage, is the real limit on that build, and enemy-sourced Locket fires are still capped only by grace (240/min): see open items.
    - **Oren's starter is now Rime Sprite.** Frost Lynx (Ice strike) hits the 95% proc cap at about 7 Fervor, so Bound Pages was dead on his starter after 3 Spell/Trap levels. The `fusionpair` build still holds to 16 min.
    - Re-run after the fixes: every holds-until result is unchanged (normal 17.5, strong 18.5, pair 16, broken 16.5, god 21.5, kael 24.5, ceiling 44.5 min); all assertions pass.

## Limitations

- This is a standalone model, not the game's `src/sim`.
- Enemy geometry is abstracted to target counts per attack kind. Density is capped at 12 targets.
- There are no healing pickups.
- Run kills (Mira) and coins held (Kael) are scripted estimates.
- Overtime XP level income is an assumption.
- The ceiling build is synthetic.
- None of it replaces a played seed. The heap/p99 soak inside the real tick is still Not assessed.
