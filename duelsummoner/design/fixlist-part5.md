# Duel Summoner fix list part 5

FIX LIST PART 5 (outside audit of the stat engine, movement and environment; each claim verified and challenged at b28f851)

Where it sits: NOW items join part 3 group A. Nothing here goes ahead of the playtest fixes (part 1) or the pad work for the device test. Already built from parts 2 to 4, not re-raised: boss brackets, Bell and mark caps, item stacking, 'block' event, decal removal. Still open from those: the 'sound' event has no handler.
Report Pass / Fail / Not assessed per item. After every step run node tools/trace.mjs --check, regenerate only what it lists, and bump BUILD_VERSION (src/sim/results.js:4) per outcome change. Fix package.json:6 to node --test test/*.test.js (today it runs zero tests).

NOW
1. combat.js explode, monsters.js cone and fireTrap: one shared buffer is overwritten by nested blasts, so enemies in a ring are missed or hit twice. Fix: new src/sim/scratch.js (takeBuf, freeBuf, resetBufs at the top of Game._tick), slabs grown on demand. Test: 4 Bloats + 40 husks against a brute-force list, each hit exactly once.
2. monsters.js fireTrap, locketNova: they end with g.curSrc = 0, so the rest of an attack loses Pack Drill and is logged as Other. Fix: save and restore. Test: every cone hit equals base x Drill, nothing under 'other'.
3. combat.js killEnemy line 79: the one-charge cap denies 62 to 72% of Astral Magus blasts. Fix: rename local K to kind; markDepth < K.explodeDepth tested first, then capTake; caps.js bucket size K.explodeBudget for marks. Rewrite test/items-stack.test.js:31-37 (its spawn arguments are NaN). Tests: 10 direct kills in a tick = 10 blasts, 40 = 32, victims of a blast do not blast.
4. Bell (combat.js:69): read K.bellEvery/bellBase, log under 'graveyard-bell', restore source. Test: same toll whoever kills.
5. field.js:55 and :61: Kindling Rite burn damage lacks * n. Fix both lines, reword cards.js:57. Test: level 5 gives 7.0 and the card prints it.
6. enemies.js:107: burn is never logged. Sum per tick, log once under 'burn', restore source. Test: results burn equals LP lost.
7. game.js hurtPlayer: 'hurt' fires on dodged and blocked hits. Order: over; dash emits 'dodge'; god emits 'hurt' (keeps golden record); Talisman emits 'ward'; Guard; LP; then 'hurt'. main.js: no flinch or shake when c is 1. Expect 3 golden event logs.
8. game.js:260: flat armour with stacking floors every swarm hit at 1 LP. Fix: guardPts = armour x K.guardPerArmour (4) through guardMit, no rounding; monsters.js:137 uses guardPts; K.locketRadius. Rewrite test/ledger2.test.js:26, item texts. Test: 10 Bronze Scales do not floor an 8 hit; never above 85%.
9. monsters.js 'mark' and 'homing': Mira's monsters never target elites or bosses. Fix: specials enter the mark pick list (mark, burn fields in specials.js make), no area flag (Warden shield stays), bracket 4 reads the mark; monsters.js:43 passes the flame flag. Add duelist argument to tools/balance.mjs and bosstime.mjs, one Mira golden. Test: Mira pair deals more than 0 to a lone boss; boss is marked with 10 swarm near.
10. items.js:27: ITEM_CAPS pickup 1.5 cuts Collector's Eye 5 to +10%. Delete it, clamp at K.magCap. Test: Eye 5 = 13.75 m.
11. props.js _rebuildChests/_syncChests: opened chests vanish. Keep body, open lid, grey minimap square.
12. main.js:267, 296, 298-299, fx.js:132: sigil, kill burst, circle and altar rings drawn at fixed height. Use one groundY in the view only; do not add y to sim events.
13. Text only, no reverts: SPEC.md:301, 313, 330, 335, 340-342, 559; ledger.js:3, :12; cards.js:42 ('about 11'); trap step in one place; delete dead constants (critMult, damagePerLevel, resolvePerStep, CFG.wyvern, CFG.card). Goldens must stay identical.

LEDGER PORT (before the final balance fit, in this order)
1. Shared hitMul for damageEnemy and damageSpecial with bracketDmg for bosses (SPEC 2).
2. Curves replacing ITEM_CAPS entries one by one (SPEC 3): Keen points, rewindMul with 25% floor, Bargain, Stride knee, dash floor, Wards as charges with Rewind.
3. Snapshot burn 0.25 x pre-crit, max rule, clear burnDps at enemies.js:83 and :107; reprice Burning Deck (SPEC 2, 5).
4. Tier aura +500 bp (SPEC 8); Kael and Mira passives with a per-tick dirty flag and dlog2 (SPEC 9).
5. Bell banking, SPEC 5.2 rewritten to the single hurt cap.
6. Add new state to stateHash.
Then re-fit once, both duelists: XP table, enemy and boss HP, enemy damage, TARGETS, Overtime envelope.
Owner decisions first: dash floor, Talisman and Bell copy rules, Stride ceiling, rateMul (default: out), Kindling Rite, Locket target count.

MOVEMENT FLOW
Extend first: new test/movement.test.js (pinned jumps 5.06, 7.20, 4.65 m), test/hopchain.test.js, test/sim.test.js ramp test with Ram Golem and Warden.
1. One sim commit, one regen (12 scenes): generator must not leave a 0.5 m block at ramp feet; terrain.js sloped ramp cells (cellHeight); moveXZ march every 0.5 m starting at o.y; player.js:58 threshold 0.9; dash exactly 9 ticks, exit at run speed with stick held, else C.speed x dashTail 0.25; magnet curve per feedback-feel 3.3 with speed at least player speed + 6, wall rule kept. Tests: no ramp snap over slope x 9/60 + 0.02; radii 0.7 to 2.2 climb every ramp; 100 uphill dashes reach 4 m.
2. Rerun balance, bosstime, pace: targets 5 picks a minute, Fusion 5:30 to 7:00. No tuning number reverts.
3. Slide-jump carry only after owner yes: airFriction 2.2, stick within 60 degrees, height charged on landing; 20 s flat hop never exceeds run speed.
4. src/view/sfx.js: cue table by art-book audio names, WAV with synth fallback, 'sound' branch.
Later: knock easing, kill shards.

ENVIRONMENT
Now: src/data/look.js STAGE_LOOK[3] from OUR palettes; applyStageLook in syncMap; buildMapMesh(map, look), buildGateSeal(map, look); kit.js stores p.c0 (hash-neutral) so trim stays gold. Stage 2 slate-blue; Stage 3 DARK floor, pale seal core. Test: entry 0 equals today; seed hashes unchanged; enemy contrast delta E 20. Fix test/browser-env.mjs:11.
Round 2, one regen: isGround helper + zero relief (byte-identical), then relief 0.6 m masked 12 m round all prims and mounds, gate approach, road cadence test, zone ground bias, shrine thread on UNUSED shrines. Decide the GEN_VERSION bump on purpose.

SKIP
- Revert 0.168, 0.35, 0.10, tiers 4.5/12/31: owner's choice; all three tiers were scaled on purpose.
- Chain overwrites explode buffer: cannot happen.
- Math.max ramp patch: leaves half steps.
- Slide-jump +10%, dash-slide x1.25, FOV kick: free speed before Overtime.
- Analytic hills, 8 m vertex displacement: 11 of 12 maps fall back.
- Boss stone circles, lit used shrines, audit hex values: against our specs.
- spots(260) decals: code removed.
- Split hurt caps, rateMul: against 22 Nov and tonight's pace.


## Decided 23 Nov (owner)

- In-run windows (shop, level-up, chest) use the menus' dark glass with a gold line, the same look as the approved menus (design/menus-spec.md). Built with the menus step.
- Map 2 is the Ashen Orchard. The Frostbound Archive follows it as map 3. The stage names in src/data/stages.js are renamed (ids unchanged). The old working names Sealed Catacombs and Vault of the Last Duel in the art book, the generator spec and the audio list are superseded; their content has NOT been redone and no map content is built yet.
