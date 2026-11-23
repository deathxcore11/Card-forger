// Duel Summoner asset book: the look rules and the style blocks every prompt is built from.
// Plain data. make.mjs turns it into the book page and a Markdown copy.

export const LOOK_NAME = 'The Sunlit Kingdom';

export const PILLARS = [
  ['Flat faces, no textures on models', 'Every model is cut from big flat planes, 6 to 12 faces per part, one solid colour per face, with edges bevelled like the edge of a thick card. A shape must read as a black silhouette at 40 pixels tall. Only ground, cliffs and walls carry a soft grey detail tile, which the game colours.'],
  ['The card is the signature', 'Doors, platforms, bridges, shields, plaques and pedestals are card slabs with rounded corners and a carved frame. A standing stone card is 3 x 4.5 x 0.4 m; a colossal one is 18 to 24 m. The game never uses eyes in triangles, ankhs, puzzle pendants, millennium-style gold items, hieroglyph walls or pharaoh headdresses.'],
  ['One locked palette', 'Every colour comes from the ramps below. When I bake a model, each part is mapped to a named ramp, so a mixed batch of pictures still lands in one world.'],
  ['Four reserved colours', 'Gold means "use me". Cyan means XP. Violet means summons, Fusions and seals. Red means danger. Scenery never uses them, so 300 enemies on screen never hide the loot. Elites may wear a gold rim because they drop loot.'],
  ['Value before hue', 'The ground stays mid-bright. Landmarks are dark against a bright horizon. An actor\'s main body sits clearly lighter or darker than the ground under it and gets a thin ink outline; the player\'s outline is white. Props never get outlines, so actors always pop.'],
  ['The game owns light and motion', 'Fire, glow, water, falling sand, smoke, sparks, wind, light columns and the guide thread are made by the game. Pictures and models are drawn flat and evenly lit, with no glow and no painted shadow.'],
  ['Retro by render, modern by engine', 'A low-resolution picture with hard pixels and fog in the horizon colour. The pixel pattern is used only for fog, sky and see-through fades (scenery between the camera and the duelist, and your own screen-sized effects).'],
  ['Goofy summons, huge bosses', 'Summons are round and friendly with big heads and big feet. Swarm enemies are hunched, pointed and darker than the sand. Bosses are monuments. The size chart is law.'],
];

export const PALETTES = [
  { stage: 'Surface Ruins (Stage 1)', mood: 'Hot afternoon, bleached stone, shade under parasol trees. The only warm light in the game.', colours: [
    ['#8f7048', 'Sand shadow'], ['#c09c66', 'Sand'], ['#e2c896', 'Sand light'], ['#b09470', 'Road'], ['#3f6e4e', 'Canopy shadow'], ['#5a9a66', 'Canopy'], ['#9cc88a', 'Canopy light'],
    ['#8fa860', 'Meadow'], ['#5e5048', 'Bark'], ['#b0aa9e', 'Rock'], ['#dcd8ce', 'Rock light'], ['#a89578', 'Ruin stone'], ['#e6dcc0', 'Bone'], ['#4a4250', 'Landmark stone'], ['#b4643f', 'Terracotta'], ['#3e7f80', 'Cloth'], ['#2e3f66', 'Pool ink'], ['#8fb2cc', 'Sky'], ['#e8d6b0', 'Horizon']] },
  { stage: 'Ashen Orchard (Stage 2)', mood: 'Cold, damp, quiet. No sun: pale shafts of daylight and ghost-light lamps.', colours: [
    ['#0f1a26', 'Deep slate'], ['#23384d', 'Slate'], ['#3c5a73', 'Slate light'], ['#6e8aa0', 'Wet stone edge'], ['#9a917c', 'Old bone shadow'], ['#d9d0b8', 'Old bone'],
    ['#5a3020', 'Rust shadow'], ['#8c4a2f', 'Rust'], ['#3f5f52', 'Verdigris'], ['#5f8a74', 'Verdigris light'], ['#8fbf8a', 'Ghost-light (made by the game)'], ['#d8f0c8', 'Ghost-light core']] },
  { stage: 'Frostbound Archive (Stage 3)', mood: 'A cavern whose roof is lost in black. Basalt, ash-gold sand, moon-white crystal and crimson. No violet in the scenery.', colours: [
    ['#0d0b12', 'Void'], ['#1e1e2a', 'Basalt'], ['#2e2c3a', 'Basalt mid'], ['#46445a', 'Basalt light'], ['#8a7a5c', 'Ash-gold sand shadow'], ['#b8a37c', 'Ash-gold sand'], ['#d9c7a0', 'Sand light'],
    ['#9fb4d0', 'Moon-white shadow'], ['#d8e4f4', 'Moon-white'], ['#f4f8ff', 'Moon-white light'], ['#5a1420', 'Crimson shadow'], ['#a3203a', 'Crimson']] },
  { stage: 'Duelists, summons and enemies', mood: 'Duelists and summons are bright and clean. Enemies are earthy and darker than the sand, with amber eyes as their only bright spot.', colours: [
    ['#c08a64', 'Skin'], ['#e8b890', 'Skin light'], ['#c8462c', 'Ember costume'], ['#f08040', 'Ember light'], ['#2f7f86', 'Teal costume'], ['#6fc0c0', 'Teal light'], ['#5e4030', 'Leather'], ['#f0e8d4', 'Cream'], ['#18161c', 'Ink'],
    ['#4a4034', 'Enemy dust dark'], ['#6e604c', 'Enemy dust'], ['#9a8a70', 'Enemy dust light'], ['#4a5260', 'Enemy grave'], ['#e0a040', 'Amber eyes']] },
  { stage: 'Reserved colours (never on scenery)', mood: 'Shared meaning in every stage. These are the brightest things on screen.', colours: [
    ['#ffffff', 'Player outline'], ['#46e0ff', 'XP crystals only'], ['#e0b765', 'Gold: things you use, the goal, elite rim'], ['#fff0b8', 'Gold light'], ['#b26bff', 'Violet: summons, Fusions, seals'], ['#f4ecff', 'Violet light'], ['#ff3b30', 'Danger: enemy attack warnings']] },
  { stage: 'Element effects (made by the game, never on models)', mood: 'Bright moving light, each tuned so it cannot be mistaken for a reserved colour.', colours: [
    ['#ffc24a', 'Fire (yellow-white core, never red)'], ['#bfdcff', 'Lightning (blue-white, not gold)'], ['#cfeefc', 'Ice (milky, not XP cyan)'], ['#8fd14f', 'Poison'], ['#d9fff0', 'Wind'], ['#c08a3e', 'Earth'], ['#fffbe8', 'Light (white-hot)'], ['#2a2632', 'Dark (black with a moon-white edge)']] },
];

// Size chart: the duelist is 1.8 m = 1x. src/data/scale.js on the PC is the source of truth for the game.
export const SCALE = [
  ['Duelist (player)', '1x', '1.8 m', '1,800 to 2,600'],
  ['NPCs (Broker, keepers)', '1x', '1.7 to 1.9 m', '900 to 1,500'],
  ['Swarm enemies', '0.6 to 1x', '1.1 to 1.8 m', '150 to 450 (hundreds on screen)'],
  ['Elites', '1.5 to 2x, gold rim glow', '2.7 to 3.6 m', '900 to 1,400'],
  ['Timed bosses', '3 to 5x', '5.4 to 9 m', '1,500 to 2,800'],
  ['Gate bosses', '6.7 to 10x', '12 to 18 m', '3,000 to 5,000'],
  ['Summon form 1', '0.5x', '0.9 m', '450 to 700'],
  ['Summon form 2', '1x', '1.8 m', '700 to 1,100'],
  ['Summon form 3', '2x', '3.6 m', '1,100 to 1,600'],
  ['Fusions', '2 to 3x', '3.6 to 5.4 m', '1,600 to 2,400'],
  ['God Fusions', '4x', '7.2 m', '2,500 to 3,500'],
  ['Chests, shrines, pickups', 'Oversized x1.5', 'Chest 1.2 m long', '60 to 400'],
  ['Trees', 'Big', '9 to 16 m', '120 to 600 (instanced)'],
  ['Rocks', 'Low 1.2 to 1.5 m, tall 3 m, hero 4.5 to 6 m', '2 to 6 m', '60 to 300'],
  ['Landmarks (built by the game)', 'Huge', '20 to 40 m, mega 60 m and up', 'up to 600 each from the kit'],
];

export const BUDGETS = [
  ['Triangles on screen', 'Under 250,000 at 300 enemies (swarm drawn instanced, one draw per enemy type).'],
  ['Draw calls', 'Under 150 per frame. Props share one material atlas per stage.'],
  ['Model colour', 'No textures on models. One flat colour per face, taken from the locked palette when I bake the model.'],
  ['Ground and wall detail', 'Grey detail tiles, 64 x 64, repeated every 8 m. The game colours them from the stage palette.'],
  ['UI pictures', 'Drawn at 2x the size they show at, cut to 64 colours, shown with hard pixels.'],
  ['Frame time', '8.3 ms at 120 Hz on the two-screen handheld is the bar; the PC build runs the same content.'],
];

export const PIPELINE = [
  ['1. Picture', 'Paste the concept prompt into ChatGPT. You get one clean picture of the thing on a plain grey background.'],
  ['2. Model', 'In Meshy: Image to 3D with that picture. Settings are on each card (triangle target, symmetry, pose). If you skip the picture, the Meshy text prompt on the card works alone.'],
  ['3. Parts', 'Creatures that flap, swing or chew need their moving parts as separate models (a card says which). Make the body first, then each part with the part prompt.'],
  ['4. Rig', 'Two-legged people and husks: use Meshy\'s auto-rig and pick its walk, run, idle and attack clips. Everything else is animated in code from its parts.'],
  ['5. Save', 'Download both GLBs (textured and plain) into app art\\DS\\3d with the file name on the card. 2D pictures go to app art\\DS\\2d as PNG.'],
  ['6. My part', 'I pull the folder, weld and slim each model to its budget, give every part its colour from the locked palette (one flat colour per face), set its size from the chart, and send it to the PC build.'],
];

export const NEVER = 'Not allowed anywhere: text, letters, numbers, runes or writing of any kind; logos, watermarks or signatures; an eye inside a triangle, ankhs, puzzle-box pendants, gold millennium-style relics, hieroglyph walls, pharaoh headdresses, sphinx faces; any character, creature, card, logo or symbol from an existing game, anime, show or film; realistic gore; photo textures.';

// ---------------------------------------------------------------- style blocks (pasted at the top of prompts)
export const STYLE = {
  model: 'Style: a stylized low-poly 3D game asset, chunky toy-like proportions with thick parts and big exaggerated bevels, flat-shaded faces, small hand-painted pixel-art textures with hard square pixels and 2 to 3 painted shading tones, warm light from the upper left, a readable silhouette. Bright and cheerful but solid, like a carved and painted wooden toy. Colours are light, clear and sunlit, never dark, muddy or near black: the darkest tone on the object is a mid tone. The object is fully round and looks right from every side and from above, never flat like a cut-out. No realism, no photo textures, no glossy plastic, no tiny details that would vanish at small size.',
  creature: 'Style: a stylized low-poly 3D creature for a summoning game, cute-heroic proportions (big head, big hands or paws, big feet, short limbs, chunky body), flat-shaded faces, small hand-painted pixel-art textures with hard square pixels and 2 to 3 painted shading tones, bold readable silhouette, bright clean colours with one strong glow colour. Lovable and a little goofy, never scary. No realism, no fur strands, no photo textures.',
  enemy: 'Style: a stylized low-poly 3D enemy for a horde-survival game, chunky readable silhouette, flat-shaded faces, small hand-painted pixel-art textures with hard square pixels, earthy dusty colours with a dark outline-like rim colour so it reads against bright ground, one small glowing weak point or eye light. Menacing but playful, never gory.',
  boss: 'Style: a stylized low-poly 3D boss for a horde-survival game, monumental and heavy, carved-stone and bronze construction, chunky readable silhouette that reads from far away, flat-shaded faces, hand-painted pixel-art textures with hard square pixels, one bold glowing core colour that shows its weak point. Grand and serious, a little theatrical, never gory.',
  person: 'Style: a stylized low-poly 3D game character, chunky proportions (head about one fifth of the height, big hands and boots), flat-shaded faces, hand-painted pixel-art textures with hard square pixels, bold readable silhouette, clean bright costume colours with one signature accent colour, confident heroic stance. Friendly, not childish.',
  icon: 'Style: a game icon painted in crisp pixel art with a hand-painted feel, bold dark outline round every shape, hard light from the upper left, 2 to 3 tone shading, saturated colours. One big simple object filling most of the frame, readable at 48 by 48 pixels. No text.',
  ui: 'Style: a game interface piece for a sunlit fantasy card kingdom: carved pale sandstone, worn gold trim and teal enamel inlay, chunky bevels, pixel-art finish with hard square pixels, light from the upper left. Clean, readable, a little playful. No text, no letters, no numbers.',
  paint: 'Style: a game illustration in a bold painterly pixel-art look, chunky shapes, strong light and shadow, big readable forms, saturated sunlit colours, a sense of scale and adventure. Clean edges, hard square pixels at the end. No text.',
  swatch: 'Style: a seamless tileable game texture in hand-painted pixel art, hard square pixels, 2 to 3 tone painted shading, light from the upper left, no realism, no noise, no photo detail. The left edge must continue into the right edge and the top into the bottom with no visible seam. Seen exactly from above, flat, no perspective, no shadows cast from outside the tile. Draw ONE tile that fills the whole picture: do not repeat the pattern inside the picture, and scatter the shapes at random sizes and angles with no rows or stripes.',
  decal: 'Style: flat ground details for a game, painted in crisp hand-painted pixel art with hard square pixels and 2 to 3 shading tones, seen exactly from above, no outline, no cast shadow, bright clean colours matching a sunlit stylized world.',
  fx: 'Style: a game visual effect drawn as a sprite sheet in crisp pixel art, bright glowing colours on a pure black background, bold simple shapes, readable at small size, hard square pixels, no blur, no text. Each frame is a separate cell in a grid, all cells the same size, the effect centred in each cell.',
};

export const VIEW = {
  model: 'View: one object only, full and uncut, seen from a three-quarter front view slightly above, on a plain flat light grey background, no floor, no shadow, no other objects, evenly lit so every face is visible.',
  biped: 'View: one figure only, full body head to feet, standing in an A-pose (arms angled down and out about 45 degrees, legs slightly apart), facing the viewer straight on, on a plain flat light grey background, no floor, no shadow, nothing held unless named.',
  beast: 'View: one creature only, full body and uncut, in a neutral standing pose with legs straight under the body, wings or fins spread flat if it has them, tail straight out behind, mouth closed, seen from a three-quarter front view, on a plain flat light grey background, no floor, no shadow.',
  part: 'View: this one part only, uncut, laid out flat and seen straight from the side, on a plain flat light grey background, no body attached, no shadow.',
};

