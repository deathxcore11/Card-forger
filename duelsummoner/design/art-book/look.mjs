// Duel Summoner asset book: the look rules and the style blocks every prompt is built from.
// Plain data. make.mjs turns it into the book page and a Markdown copy.

export const LOOK_NAME = 'The Sunlit Kingdom';

export const PILLARS = [
  ['Toy-chunky shapes', 'Every model is low-poly with big flat faces, thick parts and exaggerated bevels, like a carved wooden toy. Tops are a little wider than bases. A shape must read as a black silhouette at 40 pixels tall.'],
  ['Crunchy painted pixels', 'Surfaces carry small hand-painted pixel textures, drawn big and blocky and shown with hard square pixels (no smoothing). Shading is painted in 2 to 3 tones. No photo textures, no realistic wear, no shiny plastic.'],
  ['One bright sky, three moods', 'Stage 1 is warm and sunlit, Stage 2 cold and blue, Stage 3 black, gold and violet. Each stage keeps to its palette so a screenshot tells you where you are.'],
  ['Cards everywhere', 'The world was built by duelists: giant stone cards stand in the ground, doors are card backs, platforms are cards, monsters rise from glowing floor cards. The card is our signature shape. The game never uses eyes in triangles, ankhs, puzzle pendants, millennium-style gold items, hieroglyph walls or pharaoh headdresses.'],
  ['Readable chaos', 'Enemies are dark-rimmed and earthy; the duelist and summons are bright and clean; danger is red and orange; loot is gold, cyan and violet. With 300 enemies on screen the player still finds themself, their summons, danger and loot in under half a second.'],
  ['Goofy summons, huge bosses', 'Summons are cute-heroic, big heads and big feet, a bit silly next to the duelist. Bosses are enormous and serious. The size chart is law.'],
];

export const PALETTES = [
  { stage: 'Surface Ruins (Stage 1)', mood: 'Hot afternoon, bleached stone, deep teal sky, wind in olive trees.', colours: [
    ['#4fc6d8', 'Sky teal'], ['#bfeef2', 'Haze'], ['#e8cf9a', 'Sandstone light'], ['#c79a5b', 'Sandstone'], ['#8a5f37', 'Sandstone shadow'],
    ['#f2ead6', 'Bleached bone'], ['#c4623a', 'Terracotta'], ['#7fa04a', 'Olive leaf'], ['#4f7a3a', 'Leaf shadow'], ['#a7c76a', 'Grass'], ['#e3b23c', 'Old gold']] },
  { stage: 'Sealed Catacombs (Stage 2)', mood: 'Cold crypt, blue seal-fire, rust chains, dripping water, dust in light shafts.', colours: [
    ['#0f1a26', 'Deep shadow'], ['#23384d', 'Crypt slate'], ['#3c5a73', 'Slate light'], ['#6e8aa0', 'Wet stone edge'], ['#3fd6e0', 'Seal-fire teal'],
    ['#b8f4ff', 'Seal-fire core'], ['#8c4a2f', 'Rust'], ['#d9d0b8', 'Old bone'], ['#4b3a5c', 'Bruise violet'], ['#c9a24a', 'Tarnished gold']] },
  { stage: 'Vault of the Last Duel (Stage 3)', mood: 'A cavern of falling gold sand under a black sky, violet crystals, crimson banners, the last throne.', colours: [
    ['#0d0814', 'Void'], ['#2a1840', 'Cavern violet'], ['#5a3a8a', 'Amethyst'], ['#b48cff', 'Crystal glow'], ['#f2c14e', 'Gold sand'],
    ['#ffe9a8', 'Sand light'], ['#9a6a1e', 'Gold shadow'], ['#a3203a', 'Royal crimson'], ['#e8e0f0', 'Moon white'], ['#1e1e2a', 'Basalt']] },
  { stage: 'Duel colours (every stage)', mood: 'Shared meaning. Never use these for scenery.', colours: [
    ['#ffffff', 'Player outline'], ['#46e0ff', 'XP crystal'], ['#ffd23f', 'Coins and gold loot'], ['#b26bff', 'Summon and Fusion magic'], ['#ff3b30', 'Danger, telegraphs'],
    ['#ff8a1f', 'Fire'], ['#ffe14a', 'Lightning'], ['#8ae8ff', 'Ice'], ['#8fd14f', 'Poison'], ['#d9fff0', 'Wind'], ['#c08a3e', 'Earth'], ['#fff3b8', 'Light'], ['#6b3fa0', 'Dark']] },
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
  ['Trees', 'Big', '5 to 9 m', '120 to 350 (instanced)'],
  ['Landmarks', 'Huge', '10 to 40 m', '600 to 2,500'],
];

export const BUDGETS = [
  ['Triangles on screen', 'Under 250,000 at 300 enemies (swarm drawn instanced, one draw per enemy type).'],
  ['Draw calls', 'Under 150 per frame. Props share one material atlas per stage.'],
  ['Character textures', 'One 256 x 256 picture per character, 32 to 48 colours, shown with hard pixels.'],
  ['Prop textures', 'Props use the stage material swatches (64 x 64, tileable) instead of their own picture, so a whole stage is one texture page.'],
  ['UI pictures', 'Drawn at 2x the size they show at, cut to 64 colours, shown with hard pixels.'],
  ['Frame time', '8.3 ms at 120 Hz on the AYN Thor is the bar; the PC build runs the same content.'],
];

export const PIPELINE = [
  ['1. Picture', 'Paste the concept prompt into ChatGPT. You get one clean picture of the thing on a plain grey background.'],
  ['2. Model', 'In Meshy: Image to 3D with that picture. Settings are on each card (triangle target, symmetry, pose). If you skip the picture, the Meshy text prompt on the card works alone.'],
  ['3. Parts', 'Creatures that flap, swing or chew need their moving parts as separate models (a card says which). Make the body first, then each part with the part prompt.'],
  ['4. Rig', 'Two-legged people and husks: use Meshy\'s auto-rig and pick its walk, run, idle and attack clips. Everything else is animated in code from its parts.'],
  ['5. Save', 'Download both GLBs (textured and plain) into app art\\DS\\3d with the file name on the card. 2D pictures go to app art\\DS\\2d as PNG.'],
  ['6. My part', 'I pull the folder, weld and slim each model to its budget, cut its colours to the stage palette, set its size from the chart, and send it to the PC build.'],
];

export const NEVER = 'Not allowed anywhere: text, letters, numbers, runes or writing of any kind; logos, watermarks or signatures; an eye inside a triangle, ankhs, puzzle-box pendants, gold millennium-style relics, hieroglyph walls, pharaoh headdresses, sphinx faces; any character, creature, card, logo or symbol from an existing game, anime, show or film; realistic gore; photo textures.';

// ---------------------------------------------------------------- style blocks (pasted at the top of prompts)
export const STYLE = {
  model: 'Style: a stylized low-poly 3D game asset, chunky toy-like proportions with thick parts and big exaggerated bevels, flat-shaded faces, small hand-painted pixel-art textures with hard square pixels and 2 to 3 painted shading tones, warm light from the upper left, a readable silhouette. Bright and cheerful but solid, like a carved and painted wooden toy. No realism, no photo textures, no glossy plastic, no tiny details that would vanish at small size.',
  creature: 'Style: a stylized low-poly 3D creature for a summoning game, cute-heroic proportions (big head, big hands or paws, big feet, short limbs, chunky body), flat-shaded faces, small hand-painted pixel-art textures with hard square pixels and 2 to 3 painted shading tones, bold readable silhouette, bright clean colours with one strong glow colour. Lovable and a little goofy, never scary. No realism, no fur strands, no photo textures.',
  enemy: 'Style: a stylized low-poly 3D enemy for a horde-survival game, chunky readable silhouette, flat-shaded faces, small hand-painted pixel-art textures with hard square pixels, earthy dusty colours with a dark outline-like rim colour so it reads against bright ground, one small glowing weak point or eye light. Menacing but playful, never gory.',
  boss: 'Style: a stylized low-poly 3D boss for a horde-survival game, monumental and heavy, carved-stone and bronze construction, chunky readable silhouette that reads from far away, flat-shaded faces, hand-painted pixel-art textures with hard square pixels, one bold glowing core colour that shows its weak point. Grand and serious, a little theatrical, never gory.',
  person: 'Style: a stylized low-poly 3D game character, chunky proportions (head about one fifth of the height, big hands and boots), flat-shaded faces, hand-painted pixel-art textures with hard square pixels, bold readable silhouette, clean bright costume colours with one signature accent colour, confident heroic stance. Friendly, not childish.',
  icon: 'Style: a game icon painted in crisp pixel art with a hand-painted feel, bold dark outline round every shape, hard light from the upper left, 2 to 3 tone shading, saturated colours. One big simple object filling most of the frame, readable at 48 by 48 pixels. No text.',
  ui: 'Style: a game interface piece for a sunlit fantasy card kingdom: carved pale sandstone, worn gold trim and teal enamel inlay, chunky bevels, pixel-art finish with hard square pixels, light from the upper left. Clean, readable, a little playful. No text, no letters, no numbers.',
  paint: 'Style: a game illustration in a bold painterly pixel-art look, chunky shapes, strong light and shadow, big readable forms, saturated sunlit colours, a sense of scale and adventure. Clean edges, hard square pixels at the end. No text.',
  swatch: 'Style: a seamless tileable game texture in hand-painted pixel art, hard square pixels, 2 to 3 tone painted shading, light from the upper left, no realism, no noise, no photo detail. The left edge must continue into the right edge and the top into the bottom with no visible seam. Seen exactly from above, flat, no perspective, no shadows cast from outside the tile.',
  fx: 'Style: a game visual effect drawn as a sprite sheet in crisp pixel art, bright glowing colours on a pure black background, bold simple shapes, readable at small size, hard square pixels, no blur, no text. Each frame is a separate cell in a grid, all cells the same size, the effect centred in each cell.',
};

export const VIEW = {
  model: 'View: one object only, full and uncut, seen from a three-quarter front view slightly above, on a plain flat light grey background, no floor, no shadow, no other objects, evenly lit so every face is visible.',
  biped: 'View: one figure only, full body head to feet, standing in an A-pose (arms angled down and out about 45 degrees, legs slightly apart), facing the viewer straight on, on a plain flat light grey background, no floor, no shadow, nothing held unless named.',
  beast: 'View: one creature only, full body and uncut, in a neutral standing pose with legs straight under the body, wings or fins spread flat if it has them, tail straight out behind, mouth closed, seen from a three-quarter front view, on a plain flat light grey background, no floor, no shadow.',
  part: 'View: this one part only, uncut, laid out flat and seen straight from the side, on a plain flat light grey background, no body attached, no shadow.',
};
