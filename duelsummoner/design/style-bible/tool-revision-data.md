# Asset tool revision data (bible v3, approved by Randall 23 Nov 03:08Z)

Plain-text source for the rewrite. Order inside every prompt: MASTER, then BECOMES 3D (models only), then ONE class block, then the PALETTE line for the stage and class, then SUBJECT, then SIZE as L x W x H, then the framing line the tool already has.

## Blocks (verbatim)

### MASTER (always first)
```
DUEL SUMMONER LOOK LOCK. Duel Summoner is a 3D horde-survival game played on phones, seen from behind and above. Its world is the Sunlit Kingdom: ruins built by card duelists, with giant stone playing cards, carved card frames, terraces, olive groves and bleached stone.
One look for everything: chunky faceted low-poly shapes, like a toy cut from big flat planes. Every face is ONE flat solid colour. Big simple shapes that still read as a black silhouette at 40 pixels tall. Edges are bevelled like the edge of a thick card.
No texture, no pixel art, no gradients, no painted light or shadow, no outlines, no shine, no glow, no smoke, no sparkles. The game adds light, glow and effects itself.
Use only the colours listed under PALETTE, as flat fills.
Never: text, letters, numbers or runes; logos or watermarks; an eye in a triangle, ankhs, puzzle pendants, millennium-style gold items, hieroglyphs, pharaoh headdresses, sphinx faces; anything from an existing game, anime, show or film; gore; photo textures.
```

### Becomes 3D (add for every model)
```
THIS PICTURE becomes a 3D model in an image-to-3D tool. Show ONE thing, whole and uncut, in a three-quarter view from slightly above, on a plain flat light grey background (#c8c8c8), with no floor, no shadow and nothing else. Flat even light, so every face shows its true colour. Solid and round from every side, never a flat cut-out.
```

### Class: scenery
```
SCENERY. Heavy and grounded: a wide base, flat top planes, 6 to 12 big faces per part. Calm, muted colours from the PALETTE. No gold, no violet, no bright cyan and no red anywhere: those colours mean something in the game. It does not move.
```

### Class: duelist or summon
```
A LIVING CHARACTER. Big readable head, big hands or paws, big feet, short chunky limbs. One strong costume colour and clean bright fills. Neutral pose: A-pose for people; wings spread flat, tail straight out and mouth closed for creatures. Friendly and confident, never scary.
```

### Class: enemy
```
AN ENEMY. Hunched, pointed and leaning forward. Earthy colours that are darker than sand: dust browns, bone, slate. Small amber eyes are the only bright spot. Menacing but not gory.
```

### Class: something you use
```
SOMETHING THE PLAYER USES. The object sits on a square stone pedestal with a carved card frame on its front. This is the one kind of thing that may use gold. Slightly oversized so it reads from far away.
```

### Class: ambient life
```
BACKGROUND WILDLIFE. Tiny and low, dull colours from the stage palette, nothing bright, nothing glowing. It must never look like a pickup or an ally.
```

### Detail tile (ground and walls)
```
THIS PICTURE is a GREY detail tile that the game colours and repeats every 8 metres. Greyscale only, no colour. Soft, low-contrast shapes that average mid grey (#808080). One seamless square tile seen straight from above: the left edge continues into the right and the top into the bottom. Shapes scattered at random sizes and angles, with no rows, stripes or grid and no single stand-out feature.
```

### Painting (card art, portraits, key art)
```
THIS IS A PAINTING made of flat colour planes, like cut paper: 5 to 7 values, one warm light from the upper left, crisp edges between planes, no texture noise. A dark plain background. Colours only from the PALETTE. For card art, frame it tall in a 2:3 shape with the subject filling the middle.
```

### Class: UI piece or icon
```
THIS IS A FLAT GAME INTERFACE PIECE, empty, seen straight on: thick carved stone and dark lacquer with a carved card-frame edge, flat fills from the PALETTE, a 2 pixel dark edge, no text. Icons are one bold silhouette per cell on flat black, readable at 32 pixels.
```

## Palette lines

Use the stage line for scenery, structural kit, interactable objects and ambient life. Use the actor line for duelists, summons, Fusions and NPCs; the enemy line for enemies, elites and bosses (add the stage line too for stage-specific enemies). Paintings and UI use stage + actor + reserved as needed.

**Stage 1 · Surface Ruins**
```
PALETTE (Surface Ruins): sand #8f7048 #c09c66 #c8a46c #e2c896; road #b09470; canopy #3f6e4e #5a9a66 #74ae72 #9cc88a; meadow #6f8a4a #8fa860 #aebf78; bark #3e342f #5e5048 #7d6a5c; rock #8c8579 #b0aa9e #bdb8ae #dcd8ce; ruin stone #7a6a52 #a89578 #c9b896; bone #b8ab8c #e6dcc0 #f4eedc; landmark stone #2f2a36 #4a4250 #6a6272; terracotta #8a4a30 #b4643f #d0835a; cloth #2c5c60 #3e7f80 #e8dcc0; pool ink #1c2440 #2e3f66; sky #8fb2cc #e8d6b0.
```

**Stage 2 · Ashen Orchard**
```
PALETTE (Ashen Orchard): slate #0f1a26 #23384d #3c5a73 #6e8aa0; old bone #9a917c #d9d0b8; rust #5a3020 #8c4a2f; verdigris #3f5f52 #5f8a74; ghost-light #8fbf8a #d8f0c8.
```

**Stage 3 · Frostbound Archive**
```
PALETTE (Frostbound Archive): basalt #0d0b12 #1e1e2a #2e2c3a #46445a; ash-gold sand #8a7a5c #b8a37c #d9c7a0; moon-white #9fb4d0 #d8e4f4 #f4f8ff; crimson #5a1420 #a3203a.
```

**Actors · duelists and summons**
```
PALETTE (duelists and summons): skin #8a5a40 #c08a64 #e8b890; ember #8a2a20 #c8462c #f08040; teal #1f4f5a #2f7f86 #6fc0c0; leather #3a2a20 #5e4030 #8a6448; cream #d8ccb0 #f0e8d4; ink #18161c #2a2632.
```

**Enemies**
```
PALETTE (Enemies): dust #4a4034 #6e604c #9a8a70; grave #2a3038 #4a5260 #7a8290; amber eyes #e0a040.
```

**Reserved · never on scenery**
```
PALETTE (never on scenery): gold #a07a2a #e0b765 #fff0b8; xp cyan #46e0ff; violet #2e1a52 #b26bff #f4ecff; danger #ff3b30; player #ffffff.
```

Element FX (engine only): fire #fff4c8 #ffc24a #ff8a1f; lightning #f4f9ff #bfdcff #7fb8ff; ice #f0fbff #cfeefc #8ab8e0; poison #e8ff9a #8fd14f #4f8a2a; wind #f4fff9 #d9fff0 #9ad8c0; earth #e8c890 #c08a3e #7a5428; light #ffffff #fffbe8 #ffe9a8; dark #d8e4f4 #2a2632 #0d0b12.
## Per-code actions (from the 628-entry build; the 72 entries added 23 Nov are not listed, apply the same rules)

Legend: SKIP = existing Can skip tag (`sk`), never delete the key. ENGINE = "made by me". SUBJ = change the subject words as given. SIZE = new size. SOLID = collision note for the 0.4-1.2 m lane rule.

### Fix 4: sizes (Stage 1 trees and rocks; environment bar + spec 18.6)
- W101 Olive tree (big): SIZE 13 x 12 x 13 m, the blob species; trunk 1.4 m wide, canopy from 4.5 m up.
- W102 Olive tree (young): SIZE 9 x 8 x 9 m.
- W103 Date palm: SIZE 10 m tall, accent only (not more than 1 in 8 trees).
- W104 Leaning cypress: SIZE 11 m tall, rare, terraces only.
- W105 Twisted acacia: becomes the PARASOL species, SIZE 9 x 9 x 10 m, flat canopy 8-10 m wide, trunk upright, canopy lean only above 4 m. About 60% of trees.
- W401 Round-crown tree: blob species variant, SIZE 14 m tall.
- W405 Dead tree: SIZE 9 m tall.
- W109 Boulder (big): hero rock, SIZE 6 x 5 x 5 m (4.5-6 m tall).
- W110 Boulder (medium): tall rock, SIZE 3.2 m tall.
- W111 Rock cluster: low rocks 1.2-1.5 m.
- W428 Tall spire rock: keep 4 m. W430 Rock arch: SIZE 6 m tall, opening 3 m.
- W112, W113 Cliff pieces: SKIP + ENGINE (rim butte kit 14/28/45 m with strata, 8 m segments).
- All other entries: show SIZE as L x W x H; anything on the grid snaps to 4 m or 8 m (walls 4 m, terrace 8 m, bridges 8 m).

### Fix 5: one chest body
- WX01 Card Chest: SUBJ "a chunky chest with a black lacquer body (#2a2026), thick gold chains crossing the lid, sitting on a square stone card pedestal with a carved card frame; no rarity colour anywhere". Remake (chest-card.glb).
- WX02 Sealed Chest: same body, three gold chains held by a round seal plate; the violet glow is ENGINE (seal colour allowed only as the engine glow).
- WX26 Trophy Chest: same body, lid already open, ivory inside; Trophy cyan only as ENGINE light.
- WX12 Wrapped Mimic chest: same body wrapped in dusty linen strips.

### Fix 6: reserved colours out of scenery (SUBJ edits)
Stage 1: W126 banner gold trim and card -> bone-cream trim and bone card; W450 gold diamond -> bone diamond; W408 remove the gold coin; W433 Ore rock gold veins -> pale quartz veins (bone-white); W404 SKIP (fix 8); W418 poppies red -> terracotta (and ENGINE).
Stage 2: W201 gold rim -> verdigris bronze rim; W204, W210, W214, W505, W510, W511 -> cold iron or wax bases only, no flame, flame and light are ENGINE ghost-light; W217 and W501 glowing teal moss/caps -> verdigris moss, glow is ENGINE; W513 teal band -> verdigris band.
Stage 3 (drops violet; gold sand -> ash-gold): W301 remove violet glow; W302 gold inlay -> bone inlay; W303, W304 gold crown and trims -> bone and crimson; W305 Treasure pile SKIP; W306, W307 gold trims -> bone trims, crimson stays; W308, W309, W602, W611 amethyst -> moon-white crystal (pale blue-white faceted), glow ENGINE; W310, W603 gold sand -> ash-gold sand; W312, W606 gold diamond/fringe -> bone; W313 gold lamp post with amethyst -> basalt post with a moon-white crystal; W314 broken gold hook -> broken iron hook; W315 gold/violet jar -> ash clay with a crimson band; W316 gold ring + amethyst -> bone ring + moon-white crystal; W601 Coin heap SKIP; W604 gold frame -> bronze and basalt frame, sand is ENGINE; W605 red ribbon -> crimson ribbon; W607 violet candle flames -> no flames (ENGINE); W608 violet sheen -> moon-white sheen; W609 Gold fountain -> basalt fountain, the flowing sand is ENGINE; W612 SKIP + ENGINE.
Ambient: WA10 purple-black spider -> slate-black; WA11 glow moth -> dull dusty moth, never glows; WA12 gold-brown crab -> sandy brown.
Allowed and unchanged: W121, W441 teal cloth (low-chroma cloth ramp #3e7f80, not XP cyan).

### Fix 8: off-biome Stage 1 stock props -> SKIP
W402 Tall layered tree, W403 Twin-trunk tree, W404 Fruit tree, W409 Tree cluster (young), W414 Fern, W419 Mushrooms (red), W420 Mushrooms (brown), W421 Clover patch, W423 Cactus (tall), W424 Cactus (round), W426 Lily pads, W434 Wooden fence, W435 Stone well, W436 Signpost, W439 Haystack, W440 Scarecrow, W448 Stone bench, WA06 Frog.
Keep (they suit the Kingdom or the menu Camp): W405, W406, W407, W408, W410, W425, W427-W433, W437, W438, W441, W442, W443-W447, W449, W450.

### Fix 9: ENGINE (made by me)
W411, W412, W413, W415, W416, W417, W418, W422 (grass and flowers), W431 (pebbles), W211 (cobweb), W516 (drip pool), W612 (sand cascade); every flame, glow and falling sand named in fix 6; FX01-FX04 and FX06-FX33 (FX05 Smoke puff may stay a painted sheet).

### Fix 12: SKIP
KA15, KA16, KA17 (stages not in the run). Fix 11 KA03, KA04 already SKIP in the menus pass.

### Fix 14: lane rule (nothing solid 0.4-1.2 m)
Non-solid: W106, W107, W108, W208, W410, W504, W509, W510, W601, W602, W606.
Breakable (already or now): W123, W124, W125, W315, W438, W513.
Resize to 1.4 m or more: W201 (1.3 -> 1.4), W212, W309, W406 (stump 1.5 m), W407 (log 1.3 m diameter), W408, W433, W443, W445.
Walk-on surfaces are exempt: W129, W135, W137, W205, W217, W301, W317. W427 Flat slab becomes 0.35 m (auto-step).

### Fix 15: new entries
- Duel Statue: an armed stone duelist statue on a square plinth, a card raised in one hand, red eye glow (ENGINE), a red banner; 3 m; class "something you use".
- Broken Covenant: a cracked stone tablet bound by two iron chains on a low plinth, falling dust (ENGINE); 2 m.

### Fix 7: kit group (new group, all ENGINE unless noted)
Structural (per stage skin): wall 4 m and corner, floor 4 m, ramp 1:2 (4 m), hop stair 1.4 m, pillar short and tall, arch, roof slab with parapet, bridge 8 m stone and bone, gully wall, rim butte 14/28/45 m + notch, backdrop mesa, rubble set x3.
Card family: standing card 3 x 4.5 x 0.4 m, leaning card, toppled card, stacked-card stair, colossal card 18-24 m, card pedestal, small marker card (flips when used); face decal = mat-cardstone.
Ritual family: summoning circle dais, terrace ring, obelisk, lure obelisk 6 m, sealed gate arch x3 sizes, gate approach obelisk pair, chain segment, summoning pool rim.
District heroes (5 per stage, 20-40 m): S1 twin standing cards, stepped obelisk, colosseum facade, fossil spine horn pair, stacked-card spire; S2 Seventh Door frame, ossuary arch, chain winch tower, sarcophagus colonnade, niche-wall shrine; S3 duel table rim, treasury stack, fallen king, card shoal spire, throne stair steps.
Mega landmarks: S1 colossal buried card (60 m+), S2 Seventh Door, S3 fallen king. ONE Meshy hero piece each is Randall's (head/crown/door face); the rest ENGINE.
Side-quest pockets: caged summon cage (Randall), glyph urn set x4 (Randall), relic plinth, Ace den dressing, coin-line markers (ENGINE).

### Salvage of finished art
See the table in tool-revision-brief.md (unchanged).


## Bible v4 changes (23 Nov 03:15Z, after the second outside review)
- Violet: no Vault scenery uses violet; summons, Fusions and seal FX keep violet in every stage; the Throne Gate seal is the only violet built into the Vault.
- Actor readability: main body at least 12 L* off the ground under it (lighter or darker) plus the 1 px outline; actors band is 30-85. Must be checked in motion at game zoom (sand, tree shade, crowd) before it is called readable.
- Painting block: no dither in prompts (reverted); the in-game 48-colour hard-pixel reduction gives the retro look.
- Fix 17 slice: Surface Ruins arena, Kael, Ember Wyvern (grey reference through the new bake before any redraw), one enemy, engine XP crystal, the sealed chest, one engine-built card bridge tested across a chunk seam. Rewrite all prompts in the one pass, but Next up shows only the slice; blocks get tuned from the slice before the rest is made.
- Slice gate: everything outside the slice shows as waiting until the slice is Approved in game on the Thor (player, ally, XP, danger tell readable in motion over bright sand, tree shade, crowd). Slice also includes one tree and one rock he already made, re-baked.
- Ley Thread (23 Nov 03:17Z ruling): inside the violet reserve (seal magic pointing at the seal). Engine line: core #f4ecff, halo #b26bff, plus a 1 px #2e1a52 under-stroke so it reads on bright Stage 1 sand; the pale core carries it on Stage 2 slate and Stage 3 basalt.

