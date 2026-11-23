# Asset tool revision brief (from the style bible, draft 1, 23 Nov)

STATUS: waiting for Randall's yes. Do not rewrite the tool until he approves the bible:
https://claude.ai/artifact/W4TZoSQwHo8E8qrRZkssG9 (copy: ds-style-bible.html in this folder).

Owner of the change: the Duel Summoner build thread (tool source duelsummoner/design/art-book/ on
claude/project-thread-btj2gx: look/world/cast/ui/audio/screens.mjs, shell tool.html, `node make.mjs`).
Hard rules: ticks key on file names, so never rename an existing file key; republish to the same link
(https://claude.ai/artifact/LrQyhqYSLYMDANB9Ru5GMm, capabilities db) and update the PC copy.

## Locked decisions in the bible
1. Look = faceted flat colour. Models: one solid colour per face, no texture, flat even light in the
   reference picture. Only ground, cliffs and walls get a GREY detail tile (64 px = 8 m), coloured by the
   stage palette in the engine. Engine owns light, glow, motion, FX.
2. Reserved colours never on scenery: gold e0b765 (interactables, goal, jump lips, elite rim), XP cyan
   46e0ff, violet 2e1a52/b26bff/f4ecff (summons, Fusions, seals), danger ff3b30, player outline white.
3. Stage 3 drops violet: basalt, ash-gold sand (8a7a5c b8a37c d9c7a0), moon-white crystal, crimson.
   Stage 2 lamp fire = ghost-light 8fbf8a/d8f0c8 (engine glow), not teal.
Full ramps: pal.py here and the bible's palette section. Stage 1 ramps = environment-bar values.

## Prompt structure (replace the single "Style:" line everywhere)
MASTER block -> "becomes 3D" block (models only) -> ONE class block (scenery / living character /
enemy / something you use / ambient life / detail tile / painting / UI) -> PALETTE line for the
stage and class (hex) -> SUBJECT -> SIZE as L x W x H. Exact texts are in the bible's prompt section.

## Ranked fixes (same order as the bible)
1. Remove "pixel-art textures, hard square pixels, 2 to 3 painted tones, warm light from upper left"
   from every 3D reference prompt; ask for flat faceted colour, flat even light.
2. Master + class + stage palette blocks for all 628 prompts (stage 2/3 no longer "sunlit"; ambient
   creatures no longer "creature for a summoning game"; enemies get their own darker block).
3. Hex palette in every prompt; bake gets a per-model part->ramp list (blind nearest-colour fails, see
   concepttag.png); characters get a hand-set list of about 6 colours.
4. Sizes/colours match environment-bar.md and generator-spec 18.6: trees 9-16 m, rocks 2-6 m, hero
   4.5-6 m, walls on the 8 m grid, standing card 3 x 4.5 x 0.4 m, colossal 18-24 m, mega 60 m+.
   Size field shows L x W x H.
5. One chest design: sealed look (black lacquer 2a2026, gold chains, card pedestal, no rarity from
   outside). WX01/WX02/WX26/WX12 become variants. chest-card.glb is a remake.
6. Strip reserved colours from scenery (gold trims/lamp/fountain/treasure scenery, violet jump pad,
   floor card, Bone Oath card, teal fire S2, amethyst S3).
7. Add seeded-map kit group (~45 pieces, mostly "made by me"): structural kit on the 8 m grid, card
   family, ritual family, 15 district heroes, 3 mega landmarks, gate approach, summoning pools,
   marker card, card pedestal. Spec refs: generator-spec section 11, environment-bar kit additions.
8. Cut off-biome Stage 1 stock props (scarecrow, haystack, fruit tree, red spotted toadstools,
   clover, lily pads, frog, fence, well, signpost and similar).
9. Mark engine-made: grass, flowers, pebbles, cobwebs, drips, sand cascade, hourglass sand, liquid
   gold, flames (models are cold bases), most FX01-FX33.
10. Textures -> grey detail tiles. Keep as detail: bark, leaf, cliff, flagstone, sandstone,
    crypt-slate, niche-wall, grass-2, rooftile, cloth-awning, catacomb-brick (fill holes). Remake:
    path, grass-dry, bone (banding when tiled). cardstone -> stone-card face decal. Drop iron, bonepile.
11. Remove KA03/KA04 painted menu backdrops (menus are the live world); add camp/plinth/vista props.
12. Park KA15-KA17 (stages not in the run).
13. Egypt drift (jackal idols, scarabs, mummies, sarcophagi): note only, for the later roster project.
14. Lane rule: nothing solid 0.4-1.2 m; mark benches/logs/fences/stumps/carts breakable or non-solid.
15. Add Duel Statue and Broken Covenant (map spec encounters missing from the tool).
16. Card art, portraits, key art use the painting block; card art 2:3 shown 240 x 360, 48 colours.

## Salvage of finished art (keep names)
Keep + recolour in bake: tree-olive-a/-b, tree-acacia (= parasol species, 9-11 m), tree-palm,
tree-cypress, bush-round, rock-boulder-a/-b (b scales to hero), Kael, Mira, wyvern f1, butterfly,
coin, the four early Meshy models. Remake: chest-card. Engine notes (not tool): actor outline 1 px ink
(player white), props never outlined; ordered dither only in fog/sky.

## Folded in from the build thread (23 Nov 03:02Z), bible version 2
- Tool is now 700 assets / 1409 keys (6223b69). Fixes 1-3 apply to the 72 new entries too.
- Cuts (fixes 8, 11, 12) use the existing SKIP map / "Can skip" tag (`sk`), never delete keys.
- Dither exception: ordered dither allowed for fog, sky and see-through fades (occluders and own
  screen-sized effects), nowhere else.
- Element FX ramps (engine only, emissive), tuned off the reserved colours:
  fire fff4c8 ffc24a ff8a1f (yellow-white core, never red); lightning f4f9ff bfdcff 7fb8ff (not gold);
  ice f0fbff cfeefc 8ab8e0 (milky, not XP cyan); poison e8ff9a 8fd14f 4f8a2a; wind f4fff9 d9fff0 9ad8c0;
  earth e8c890 c08a3e 7a5428; light ffffff fffbe8 ffe9a8 (white-hot, no orange);
  dark d8e4f4 2a2632 0d0b12 (black with moon-white edge, not violet). Danger = red filling ground shape only.
- look.mjs BUDGETS: drop the 256 px character texture line on his yes.

## Added 23 Nov 03:10Z from Randall's pasted outside review (bible version 3, fixes 17-21)
17. Next up default queue = playable slice: one arena, Kael, Ember Wyvern f1-f3, one enemy, XP crystal,
    one chest, basic sfx/fx. Full catalogue behind a filter.
18. Two statuses per asset: Made (file found or ticked) and Approved in game (seen at game camera on
    Thor and phone: silhouette, ramps, rig deformation).
19. Prove the Wyvern rig in the real build (flap, turn, landing; stretching, shared pivots) before the
    skeleton step rolls out to other creatures.
20. Header shows "Saved on this device" or "Synced"; add progress export.
21. PK01 XP tiers stay in the cyan ramp (size, facets, glow), not cyan/violet/gold; amethyst shard is a
    shape reference only.
