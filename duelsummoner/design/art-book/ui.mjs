import { DUELISTS } from './cast.mjs';
// Pickups, item and stat icons, card art, effects, HUD, menus, cosmetics, achievements.
const I = (code, name, file, x) => ({ code, name, file, ...x });
const SHEET = (code, name, file, where, cells, x = {}) => I(code, name, file, { how: 'sheet', style: 'icon', px: '1024 x 1024 made (3 x 3), 64 x 64 each in game', where, cells, ...x });

export const PICKUPS = [
  I('PK01', 'XP crystal (small, medium, big)', 'pk-xp', { how: 'code', where: 'dropped by every enemy', subj: 'built in code: an 8-sided crystal, cyan / violet / gold by size, spins and bobs, streaks to you with a rising pitch.', state: 'have' }),
  I('PK02', 'Gold coin', 'pk-coin', { how: 'model', style: 'model', view: 'model', tris: 40, h: 0.5, where: 'enemy drops, jars, statues', subj: 'a thick chunky gold coin with a raised rim and a simple embossed card shape in the middle, seen standing on its edge.' }),
  I('PK03', 'Coin pile', 'pk-coin-pile', { how: 'model', style: 'model', view: 'model', tris: 120, h: 0.6, where: 'golden statue and Mimic drops', subj: 'a small heap of about twelve chunky gold coins.' }),
  I('PK04', 'LP heart', 'pk-heart', { how: 'model', style: 'model', view: 'model', tris: 80, h: 0.7, where: 'heals LP', subj: 'a plump faceted red heart-shaped gem with a gold cap and a small gold ring on top, glowing softly.' }),
  I('PK05', 'Magnet charm', 'pk-magnet', { how: 'model', style: 'model', view: 'model', tris: 80, h: 0.7, where: 'pulls every crystal to you', subj: 'a chunky horseshoe magnet, red body with silver tips, a cyan crystal fixed in the bend.' }),
  I('PK06', 'Seal Bomb card', 'pk-bomb', { how: 'model', style: 'model', view: 'model', tris: 60, h: 0.8, where: 'clears the enemies on screen', subj: 'a thick glowing playing card standing on its edge, crimson back with a black round bomb shape and a gold fuse spark painted on it.' }),
  I('PK07', 'Hourglass of Pause', 'pk-hourglass', { how: 'model', style: 'model', view: 'model', tris: 120, h: 0.8, where: 'freezes enemies for 6 s', subj: 'a chunky hourglass with a gold frame, three turned posts and pale blue sand.' }),
  I('PK08', 'Star Chip', 'pk-starchip', { how: 'model', style: 'model', view: 'model', tris: 60, h: 0.5, where: 'the meta currency; rare drop and quest reward', subj: 'a thick five-pointed star-shaped token cut from violet crystal with a gold rim, a small sparkle at one point.' }),
];

export const ITEM_SHEETS = [
  SHEET('IC01', 'Items sheet 1', 'items-s1', 'item slots, shop, chest reveal, Card Library Items tab', [
    ['Worn Duel Glove', 'a worn brown leather glove with a card holster strip on the back of the hand'],
    ['Sand Sandals', 'a pair of simple sandals with sand spilling off them and two small wing shapes on the straps'],
    ['Cracked Hourglass', 'an hourglass with a crack in the glass, sand leaking out'],
    ['Scarab Charm', 'a teal beetle charm on a gold cord, a coin held between its front legs'],
    ['Clay Heart', 'a red clay heart with a thumbprint pressed into it'],
    ['Lucky Coin', 'a gold coin with a four-leaf clover stamped on it'],
    ['Whetstone Tablet', 'a grey whetstone block with a short blade lying across it, a spark'],
    ['Travelling Cloak', 'a folded green hooded cloak with a bronze clasp'],
    ['Lodestone', 'a dark grey rock with small cyan crystals stuck to it from all sides'],
  ]),
  SHEET('IC02', 'Items sheet 2', 'items-s2', 'item slots, shop, chest reveal, Card Library Items tab', [
    ['Bandaged Hand', 'a hand wrapped in white bandage with a small green leaf tucked in'],
    ['Bronze Scale', 'a single large bronze fish-scale shaped armour plate with a rivet'],
    ['Dueling Boots', 'a pair of tall red boots with small feather wings on the heels'],
    ['Hunter\'s Mark', 'a red target circle painted on a bone tag with an arrow through it'],
    ['Burning Deck', 'a small stack of cards with flames rising from the top card'],
    ['Trader\'s Seal', 'a bronze wax-seal stamp with a coin shape on its face'],
    ['Paper Talisman', 'a long paper charm strip tied with red string, glowing white edges, blank'],
    ['Jar of Avarice', 'a fat clay jar overflowing with coins, a grinning face painted on it'],
    ['Graveyard Bell', 'a small iron bell with a bone handle'],
  ]),
  SHEET('IC03', 'Items sheet 3', 'items-s3', 'item slots, shop, chest reveal, Card Library Items tab', [
    ['Veiled Sandals', 'sandals wrapped in a drifting violet veil'],
    ['Serrated Fang', 'a big curved white fang with a jagged edge, a cord through it'],
    ['Humming Reed', 'a short reed flute with three small sound rings coming out of it'],
    ['Notched Tally', 'a wooden stick with many carved tally notches'],
    ['Thornbound Locket', 'a gold heart locket wrapped in a green thorny vine'],
    ['Recoil Seal', 'a round bronze seal with a curved arrow bouncing back off it'],
    ['Unmarked Card', 'a completely blank white card with a faint shimmer at one corner'],
    ['Herd Bell', 'a big bronze cowbell on a leather strap with a paw print stamped on it'],
    ['Shepherd\'s Crook', 'a wooden shepherd\'s crook with a small glowing card hanging from the hook'],
  ]),
  SHEET('IC12', 'Items sheet 4', 'items-s4', 'item slots, shop, chest reveal, Card Library Items tab', [
    ['Split Deck', 'a deck of cards cut cleanly in two halves, both glowing'],
    ['Gilded Edge', 'a single card with a sharp shining gold edge cutting through the air'],
    ['Twin Charm', 'two small charms, one flame and one snowflake, tied together on one cord'],
    ['Prism Shard', 'a triangular crystal prism splitting light into a rainbow fan'],
    ['Scar Ledger', 'a leather notebook with red tally scratches on the cover and a bandage strip as a bookmark'],
    ['Golden Tooth', 'a big shiny gold tooth with a sparkle'],
    ['Debt Ledger', 'a thick ledger book chained shut with a coin-shaped padlock'],
    ['Hunter\'s Chalk', 'a stick of red chalk drawing a target circle'],
    ['Iron Prayer Beads', 'a loop of heavy iron beads with one round shield-shaped bead'],
  ]),
  SHEET('IC04', 'Blessings sheet', 'items-blessings', 'Blessing offers and the pause screen', [
    ['Blessing of Might', 'a raised fist glowing orange inside a gold ring'],
    ['Blessing of Swiftness', 'a winged boot glowing mint inside a gold ring'],
    ['Blessing of Vigor', 'a red heart with a plus glow inside a gold ring'],
    ['Blessing of Haste', 'three small speed lines behind a paw print inside a gold ring'],
    ['Blessing of the Guard', 'a round shield inside a gold ring'],
    ['Blessing of Plenty', 'an overflowing cornucopia of cyan crystals inside a gold ring'],
    ['Blessing of Renewal', 'a green sprout curling into a circle inside a gold ring'],
    ['Blessing of Focus', 'a crosshair over a card inside a gold ring'],
    ['Feather Cape (item)', 'a small cape made of long white feathers spread out like wings'],
  ]),
  SHEET('IC05', 'Stats sheet 1', 'stats-s1', 'pause screen stats list, Card Library useful stats, level-up offers', [
    ['Max LP', 'a red heart'], ['LP regen', 'a red heart with a green plus'], ['Overheal', 'a red heart with a gold outline overflowing'],
    ['Shield', 'a light blue bubble shield'], ['Guard (armour)', 'a bronze breastplate'], ['Sidestep (evasion)', 'a boot leaving a dotted afterimage'],
    ['Lifesteal', 'a red drop curling into a heart'], ['Thorns', 'a green thorn vine curl'], ['Damage', 'an orange starburst'],
  ]),
  SHEET('IC06', 'Stats sheet 2', 'stats-s2', 'pause screen stats list, Card Library, offers', [
    ['Keen (crit chance)', 'a yellow lightning-shaped spark'], ['Crit damage', 'a broken red shield shard'], ['Attack speed', 'a card with speed lines'],
    ['Extra cards (projectile count)', 'three fanned cards'], ['Bounces', 'a card bouncing on a zigzag line'], ['Size', 'two arrows pointing apart'],
    ['Projectile speed', 'an arrow with a long trail'], ['Duration', 'a small hourglass'], ['Damage to elites', 'a gold crown with a crack'],
  ]),
  SHEET('IC07', 'Stats sheet 3', 'stats-s3', 'pause screen stats list, Card Library, offers', [
    ['Knockback', 'a fist pushing a small shock ring'], ['Move speed', 'a winged boot'], ['Extra jumps', 'a boot over two small cloud puffs'],
    ['Jump height', 'an up arrow over a cloud'], ['Fortune (luck)', 'a four-leaf clover'], ['Fervor', 'a flame inside a heart'],
    ['Pickup range', 'a horseshoe magnet'], ['XP gain', 'a cyan crystal with a plus'], ['Coin gain', 'a gold coin with a plus'],
  ]),
  SHEET('IC08', 'Elements', 'elements', 'monster cards, damage colours, Card Library filters', [
    ['Fire', 'an orange flame'], ['Lightning', 'a yellow zigzag bolt with a violet outline'], ['Ice', 'a pale cyan six-pointed snowflake crystal'],
    ['Poison', 'a green drop with two bubbles'], ['Wind', 'a mint white swirl of three curved lines'], ['Earth', 'a brown cracked rock'],
    ['Light', 'a cream-white sunburst'], ['Dark', 'a violet crescent moon with a small black star'], ['Neutral', 'a plain grey card shape'],
  ], { style: 'icon' }),
  SHEET('IC09', 'Status effects', 'status', 'over enemies and on the duelist', [
    ['Burning', 'small flames licking up'], ['Frozen', 'an ice cube block'], ['Shocked', 'a zigzag spark'],
    ['Poisoned', 'green bubbles rising'], ['Cursed', 'a violet skull wisp'], ['Slowed', 'a snail shell'],
    ['Stunned', 'three yellow stars circling'], ['Shielded', 'a blue bubble'], ['Marked', 'a red target circle'],
  ]),
  SHEET('IC10', 'Oath seals', 'oaths', 'Oaths screen, map select, results, leaderboard rows', [
    ['Oath of Glass', 'a cracked glass heart in a wax seal'], ['Oath of Haste', 'a sand timer spinning in a wax seal'], ['Oath of the Small', 'a tiny boot print in a wax seal'],
    ['Oath of Stillness', 'a boot chained to the ground in a wax seal'], ['Oath of Blindness', 'a blindfold knot in a wax seal'], ['Oath of the Pauper', 'an empty upside-down coin purse in a wax seal'],
    ['Oath of Swiftness', 'a winged hourglass in a wax seal'], ['Oath of Peace', 'a card with a white dove shape in a wax seal'], ['Oath of the Second Seal', 'two overlapping cracked crimson seals'],
  ], { note: 'Each is a round crimson wax seal with a raised picture; each seal a slightly different wax colour: crimson, orange, teal, slate, black, brown, mint, white, deep crimson.' }),
  SHEET('IC11', 'HUD symbols', 'hud-symbols', 'HUD counters, menus, minimap', [
    ['Clock', 'a round bronze pocket clock'], ['Coins', 'a gold coin'], ['Kills', 'a torn card in two halves'],
    ['Star Chips', 'a violet star token'], ['Level', 'a gold chevron badge'], ['Chest (minimap)', 'a small chest front'],
    ['Shrine (minimap)', 'a small standing stone'], ['Boss (minimap)', 'a red horned skull-less crown'], ['Gate (minimap)', 'a small arch'],
  ]),
];

// Card art: one painting per monster, Fusion, God and Spell/Trap. Same frame comes from code.
export const SPELLS = [
  ['Toll of Ash', 'a black iron bell crumbling into grey ash and embers, a single drop of red falling from it'],
  ['Elemental Litany', 'eight small floating orbs in a circle, each a different element: flame, snowflake, bolt, poison drop, wind swirl, rock, sunburst, crescent'],
  ['Deep Marks', 'claw marks glowing orange gouged deep into a stone wall, each mark a target ring'],
  ['Swift Draw', 'a hand whipping a card out of a deck in a blur of speed lines'],
  ['Whetted Focus', 'a whetstone sharpening the edge of a stone card, sparks flying, a crosshair glint'],
  ['Storm Lens', 'a big glass lens focusing a flame and an ice shard into one exploding bright point'],
  ['Ringing Rite', 'a bronze bell ringing with golden sound rings spreading out'],
  ['Pack Discipline', 'five small summon creatures running in a neat line behind a gold whistle'],
  ['Last Draw', 'a single glowing card caught in mid-air as a duelist falls, warm gold light'],
  ['Gust Ward (Trap)', 'a swirling mint wind barrier knocking stones away from a crouching figure'],
  ['Pit of Seals (Trap)', 'a round pit in the ground ringed with glowing seal plates, chains reaching up'],
  ['Mirror Seal (Trap)', 'a round mirror seal plate reflecting a fireball back the way it came'],
].map(([name, subj], i) => I('SP' + String(i + 1).padStart(2, '0'), name, 'card-' + name.toLowerCase().replace(/\(.*\)/, '').trim().replace(/[^a-z]+/g, '-').replace(/-$/, ''), { how: '2d', style: 'paint', px: '1024 x 768 made, 192 x 144 in game', where: 'the picture inside the Spell or Trap card (offers, Card Library, chest reveal)', subj }));

// ---------------------------------------------------------------- effects
const FX = (code, name, file, frames, where, subj, x = {}) => I(code, name, file, { how: 'fx', style: 'fx', frames, px: frames > 1 ? '1024 x 1024 made (4 x 4 cells), 64 x 64 per frame' : '1024 x 1024 made, 128 x 128 in game', where, subj, ...x });
export const EFFECTS = [
  FX('FX01', 'Card throw trail', 'fx-card-trail', 1, 'behind every thrown card', 'a single horizontal streak shape that is bright white at the right end and fades to violet then transparent black at the left end, slightly wavy edge.'),
  FX('FX02', 'Hit spark', 'fx-hit-spark', 8, 'every hit (tinted by element)', 'an 8-frame white starburst hit spark: frame 1 a small dot, frames 2-3 a sharp four-pointed star growing, frames 4-6 the star breaking into flying shards, frames 7-8 fading dots.'),
  FX('FX03', 'Crit burst', 'fx-crit', 8, 'critical hits', 'an 8-frame bigger burst: a yellow-white star with a red ring expanding behind it and jagged shards flying out.'),
  FX('FX04', 'Slash arc', 'fx-slash', 6, 'melee monster swipes, Executioner, Lynx', 'a 6-frame crescent slash arc sweeping left to right, white core with cyan edge, thinning and fading in the last frames.'),
  FX('FX05', 'Smoke puff', 'fx-smoke', 8, 'nose smoke, deaths, landings, dash', 'an 8-frame cartoon smoke puff: a small grey round cloud growing into three bumpy lobes then breaking apart and fading.'),
  FX('FX06', 'Dust ring', 'fx-dust-ring', 6, 'heavy landings, boss slams, charges', 'a 6-frame flat ring of sandy dust seen from above, expanding outward and breaking into clumps.'),
  FX('FX07', 'Flame tongue', 'fx-flame', 8, 'burning status, braziers, fire breath', 'an 8-frame looping cartoon flame: a teardrop of orange with a yellow core and a red tip, licking up and curling.'),
  FX('FX08', 'Fire breath', 'fx-breath-fire', 8, 'fire breath lines and cones', 'an 8-frame gout of cartoon fire travelling to the right, chunky rolling flame balls in orange and yellow with dark red edges.'),
  FX('FX09', 'Lightning bolt', 'fx-lightning', 8, 'chain lightning, Stormcrown Drake', 'an 8-frame jagged lightning bolt from left to right, white core, yellow glow, violet outer edge, flickering into different zigzags each frame.'),
  FX('FX10', 'Ice burst', 'fx-ice', 8, 'freeze, Rime Sprite, Colossus slam', 'an 8-frame burst of pale cyan ice shards growing out of a point, then shattering into small sparkles.'),
  FX('FX11', 'Frozen crust', 'fx-ice-crust', 1, 'over frozen enemies', 'a blocky shell of pale blue ice crystals, translucent looking, meant to sit over a creature, seen from the front.'),
  FX('FX12', 'Poison bubbles', 'fx-poison', 8, 'poison status and clouds', 'an 8-frame loop of green bubbles rising and popping, a few dark green drips.'),
  FX('FX13', 'Wind streaks', 'fx-wind', 8, 'wind attacks, Gust Ward, dash', 'an 8-frame swirl of three curved mint-white streak lines spinning.'),
  FX('FX14', 'Earth chunks', 'fx-earth', 8, 'earth attacks, slams', 'an 8-frame burst of brown rock chunks flying up from a crack and falling.'),
  FX('FX15', 'Light rays', 'fx-light', 8, 'light attacks, heals on kill', 'an 8-frame cream-gold sunburst with long thin rays spinning slowly.'),
  FX('FX16', 'Curse wisp', 'fx-curse', 8, 'dark attacks, cursed status', 'an 8-frame violet-black smoke wisp with a tiny cartoon skull shape forming and fading.'),
  FX('FX17', 'Summon circle', 'fx-summon-circle', 1, 'under every summon arrival', 'a round summoning circle seen from above: two thin violet rings, a ring of eight small card shapes, a six-pointed star made of two triangles of card outlines, glowing violet and gold lines on black.'),
  FX('FX18', 'Fusion vortex', 'fx-fusion-vortex', 16, 'Fusion merge', 'a 16-frame vortex of violet and gold light spiralling inward to a bright point, small card shapes caught in the spiral, ending in a white flash.'),
  FX('FX19', 'Level-up burst', 'fx-levelup', 12, 'level up around the duelist', 'a 12-frame column of gold light rising with small stars and card shapes flying upward, a ring at the base.'),
  FX('FX20', 'Death crumble', 'fx-crumble', 8, 'swarm deaths', 'an 8-frame burst of chunky dust-coloured cube fragments flying outward and falling, with one cyan crystal glint.'),
  FX('FX21', 'Card shatter', 'fx-card-shatter', 12, 'boss deaths, Tribute, Graveyard exit', 'a 12-frame playing card cracking into triangular shards that fly apart and fade into gold sparkles.'),
  FX('FX22', 'Shockwave ring', 'fx-shockwave', 1, 'Arbiter shockwave, bell ring, Colossus slam', 'a single flat ring texture seen from above: a thick white band with soft orange edge, transparent black inside and outside.'),
  FX('FX23', 'Danger telegraphs', 'fx-telegraph', 1, 'every enemy and boss tell on the ground', 'a sheet of four danger floor markings on black, each in a quarter of the picture: a filled circle with a bright red edge and darker red inside, a long rectangle line, a cone wedge, and a 3 by 3 grid of square slabs. Flat red-orange glow lines.'),
  FX('FX24', 'Ground crack', 'fx-crack', 1, 'Executioner crack line, slam marks', 'a long jagged ground crack seen from above, glowing orange-red inside, dark edges, on black.'),
  FX('FX25', 'Chain link line', 'fx-chain', 1, 'Chain Wight latch, Jailer hook, Weaver lines', 'a horizontal repeating chain of chunky iron links, tileable left to right, on black.'),
  FX('FX26', 'Coin sparkle', 'fx-sparkle', 8, 'loot glints, gold statues, Coin Thief', 'an 8-frame four-pointed white-gold twinkle growing and shrinking.'),
  FX('FX27', 'Sky beam', 'fx-sky-beam', 1, 'gate awake marker seen from anywhere', 'a tall vertical beam of light, white core and gold edges, fading to transparent at top and bottom.'),
  FX('FX28', 'Seal crack', 'fx-seal-crack', 6, 'Sealed Chest opening', 'a 6-frame round violet seal plate cracking in more lines each frame until it bursts.'),
  FX('FX29', 'Sand splash', 'fx-sand-splash', 8, 'falling into the gold sand, Abyss Hand', 'an 8-frame splash of gold sand rising in a crown shape and falling back.'),
  FX('FX30', 'Respawn blink', 'fx-blink', 6, 'after a fall', 'a 6-frame vertical violet ring sweeping up a figure outline then vanishing.'),
  FX('FX31', 'Ley Thread', 'fx-ley-thread', 8, 'thin ribbons of light that drift through the air toward the stage gate, so the player can follow them; crimson, turned gold in code after the gate boss dies', 'an 8-frame long thin horizontal ribbon of light, bright in the middle and fading to nothing at both ends, wavering slightly like a streak of wind, drawn in white so the game can colour it.'),
  FX('FX32', 'Chest light pillar', 'fx-chest-pillar', 8, 'rises out of a Trophy Chest so it shows from far away; coloured by rarity in code', 'an 8-frame tall narrow column of soft light, wider at the base, with small square sparkles rising inside it, drawn in white so the game can colour it.'),
  FX('FX33', 'Ace arrival ring', 'fx-ace-ring', 6, 'on the ground where an Ace (elite) enemy appears', 'a 6-frame gold ring seen from above that snaps outward from a point with four small star points on it, then fades.'),
];

// ---------------------------------------------------------------- HUD and menu pieces
const U = (code, name, file, px, where, subj, x = {}) => I(code, name, file, { how: '2d', style: 'ui', px, where, subj, ...x });
export const UIKIT = [
  U('UI01', 'Panel frame', 'ui-panel', '1024 x 1024 made, cut to a 9-slice', 'every window: pause, map, settings, inventory, stats, quests', 'one empty rectangular window frame filling the picture: a thick carved sandstone border with a thin worn gold inner line, four gold corner caps shaped like card corners with one rivet each, the inside a flat dark teal-slate field. The border must be the same all the way round so it can be stretched.'),
  U('UI02', 'Window title bar', 'ui-titlebar', '1536 x 256 made', 'the top strip of every window, holds its title', 'a wide flat title plate: teal enamel bar with a carved sandstone rim and gold card-corner caps at both ends, empty middle.'),
  U('UI03', 'Button (normal, hover, pressed)', 'ui-button', '1536 x 1024 made (three buttons stacked)', 'every menu button', 'three chunky rectangular stone buttons stacked one above another, the same size: top plain pale sandstone with a gold rim, middle the same but glowing gold rim and slightly lighter, bottom pressed in with darker stone. Empty, no text.'),
  U('UI04', 'Tab (off, on)', 'ui-tab', '1024 x 512 made (two tabs)', 'tabs in settings, Card Library, Quests', 'two tab shapes side by side: left a dim slate tab with a sandstone edge, right a bright teal tab with a gold edge and a small gold card notch on top.'),
  U('UI05', 'Toggles and arrows', 'ui-controls', '1024 x 1024 made (3 x 3)', 'settings rows', 'a 3 by 3 sheet of small control pieces on flat black: on switch (gold knob right on teal track), off switch (grey knob left on slate track), checkbox empty, checkbox ticked with a gold mark, left arrow, right arrow, slider track, slider knob (a small gold card), close button (a crimson square with a white X shape made of two bars).'),
  U('UI06', 'LP bar', 'hud-lp', '1536 x 256 made', 'top left of the run HUD', 'a long empty health bar frame: a sandstone tube with gold ends, a small red heart gem set at the left end, the inside empty dark.'),
  U('UI07', 'XP bar', 'hud-xp', '2048 x 128 made', 'across the bottom of the run HUD', 'a very long thin bar frame of sandstone with tiny gold notches every tenth of the length, empty dark inside, a cyan crystal cap at each end.'),
  U('UI08', 'Clock plate', 'hud-clock', '1024 x 384 made', 'top centre of the run HUD; the stage clock', 'a wide plaque of carved sandstone with a bronze pocket-clock emblem at the left, a dark recessed panel for the numbers, small gold wings either side.'),
  U('UI09', 'Counter plate', 'hud-counter', '768 x 256 made', 'coins, kills, Star Chips, level in the HUD', 'a small rounded-rectangle plate of dark slate with a thin gold edge and a round socket at the left for an icon. Empty.'),
  U('UI10', 'Minimap frame', 'hud-minimap', '1024 x 1024 made', 'top right of the run HUD', 'a round compass frame: a thick sandstone ring with gold card-corner studs at north, east, south and west, a small gold arrow notch at the top, the inside empty dark.'),
  U('UI11', 'Boss bar (elite, timed, gate)', 'hud-bossbar', '2048 x 768 made (three bars stacked)', 'top of the screen during elites and bosses', 'three long empty boss health bar frames stacked: top a simple bronze frame (elite), middle a gold frame with small horned ends (timed boss), bottom a huge ornate gold and basalt frame with a crown at the centre and wing shapes at the ends (gate boss). All empty dark inside.'),
  U('UI12', 'Item slot', 'hud-slot', '512 x 512 made', 'inventory grid, HUD item row', 'a square inventory slot: a sunken dark slate square inside a thin carved sandstone border with tiny gold corner dots. Empty.'),
  U('UI13', 'Monster field slot', 'hud-field-slot', '512 x 768 made', 'the five summoned-monster slots in the HUD', 'a card-shaped empty slot: a sunken violet-black card outline with a gold border and a faint sunburst etched in the middle, like a place to put a card.'),
  U('UI14', 'Offer card frames (5 rarities)', 'ui-card-frames', '2560 x 1024 made (five frames in a row)', 'level-up and chest offers, Card Library', 'five empty playing-card frames side by side, same shape, each with an art window at the top and a text box below, a round socket top-left for an element icon: 1 plain grey stone frame, 2 teal enamel frame (Bright), 3 gold frame (Gilded), 4 pearl-white frame with violet gems (Radiant), 5 crimson and gold frame with flame-shaped corners (Mythic). All windows empty.'),
  U('UI15', 'Card back', 'ui-card-back', '768 x 1024 made', 'offers before the flip, floor cards, Card Library locked entries', 'the back of our playing card: deep violet field, thick gold border with card-corner notches, a centred gold sunburst of eight simple rays round a plain circle. Nothing inside the circle.'),
  U('UI16', 'Fusion banner', 'ui-fusion-banner', '2048 x 512 made', 'screen-wide banner when a Fusion happens', 'a wide ribbon banner of violet cloth with gold trim, two dragon-wing shapes curling at the ends, empty middle for words.'),
  U('UI17', 'Stage title card', 'ui-stage-card', '2048 x 512 made', 'stage start: stage name and difficulty', 'a wide thin carved stone lintel with gold edges and two short horizontal gold lines going out from each end, empty middle for words.'),
  U('UI18', 'Boss name card', 'ui-boss-card', '1536 x 768 made', 'gate boss intro: slams onto the screen', 'a heavy crimson and gold plaque shaped like a card lying sideways, cracked stone edges, empty middle for the boss name.'),
  U('UI19', 'Rank medals', 'ui-rank-medals', '1536 x 512 made (three medals)', 'leaderboard top three', 'three round medals side by side: gold with a card emblem, silver with a card emblem, bronze with a card emblem, each with a short ribbon.'),
  U('UI20', 'Profile frame', 'ui-profile-frame', '768 x 768 made', 'leaderboard rows and results: frames the player\'s picture', 'a square portrait frame of carved sandstone with gold corners and a small duelist-icon socket at the bottom right. Empty inside.'),
  U('UI21', 'Quest rarity borders', 'ui-quest-borders', 'made in code', 'Quests rows: Plain, Bright, Gilded, Radiant, Mythic', 'built in code from the five rarity colours of UI14.', { how: 'code' }),
  U('UI22', 'Font: titles', 'font-title', 'chosen, not drawn', 'every title and button', 'a chunky blocky display face with wedge serifs, drawn as a pixel font at 16 and 32 px, white with a 2 px dark outline. I build it; no prompt.', { how: 'code' }),
  U('UI23', 'Font: numbers', 'font-numbers', 'chosen, not drawn', 'damage numbers, timers, stats', 'a wide bold pixel digit set with outlines, damage numbers tinted by element, crits bigger and gold. I build it; no prompt.', { how: 'code' }),
];

// Painted pictures for menus and the stage cards.
const A = (code, name, file, px, where, subj, x = {}) => I(code, name, file, { how: '2d', style: 'paint', px, where, subj, ...x });
export const SCREENART = [
  A('KA01', 'Title key art', 'key-title', '1920 x 1080 made', 'title screen and store page', 'a young duelist seen from behind on a cliff edge at golden hour, a fan of glowing cards in one hand, a big friendly baby dragon on their shoulder and a wyvern circling above, looking out over a vast valley of sandstone ruins and giant stone cards standing in the ground, a huge colosseum in the distance, teal sky with puffy clouds.'),
  A('KA02', 'Logo', 'logo', '2048 x 1024 made', 'title screen, loading, store', 'a game logo emblem with no letters: a chunky gold-edged stone card standing upright with a small dragon curled round it, wings spread behind, a violet glow from the card. Leave a wide empty band across the middle where I set the words DUEL SUMMONER in our title font.'),
  A('KA03', 'Main menu backdrop', 'bg-mainmenu', '1920 x 1080 made', 'behind the main menu', 'a cosy camp in the ruins at dusk: a campfire beside a fallen giant stone card, a deck box and bedroll, a small dragon asleep curled by the fire, ruins and olive trees silhouetted against an orange and teal sky. Keep the left third calm and dark for buttons.'),
  A('KA04', 'Duelist select backdrop', 'bg-duelists', '1920 x 1080 made', 'behind the duelist grid', 'the inside of a sunlit sandstone hall with a long row of empty stone pedestals, banners hanging between columns, warm light shafts, quiet and empty. The middle is open for the 3D duelist.'),
  A('KA05', 'Map card: Surface Ruins', 'map-surface-ruins', '1536 x 1024 made', 'map select', 'a bright aerial view of sun-bleached sandstone ruins: a round colosseum, a market of flat roofs with striped awnings, giant stone cards standing in fields, a long fossil dragon spine ridge, olive trees, teal sky.'),
  A('KA06', 'Map card: Sealed Catacombs', 'map-catacombs', '1536 x 1024 made', 'map select (later map) and the Stage 2 load card', 'a deep blue crypt: chain bridges over dark pits, walls of card niches, teal fire braziers, a huge round vault door with seven seals glowing at the far end.'),
  A('KA07', 'Map card: Vault of the Last Duel', 'map-vault', '1536 x 1024 made', 'map select (later map) and the Stage 3 load card', 'a vast black cavern over a sea of falling gold sand, floating giant stone cards as platforms, toppled statues of kings, amethyst crystals glowing, a throne on a grand stair at the far end.'),
  A('KA08', 'Map card: Quick Duel', 'map-quick-duel', '1536 x 1024 made', 'Quick Duel button', 'a close view of a sunlit arena floor with a ring of card-shaped slabs, a single stone card standing in the middle, dust in the air, dramatic and simple.'),
  A('KA09', 'Results backdrop (win)', 'bg-victory', '1920 x 1080 made', 'victory results', 'the duelist and their summons silhouetted on top of the vault stair, gold light pouring out of an opened gate, cards drifting in the air like confetti.'),
  A('KA10', 'Results backdrop (defeat)', 'bg-defeat', '1920 x 1080 made', 'death results', 'a lone deck of cards lying scattered on cracked sand at night, one card still glowing faintly, the ruins dark behind.'),
  A('KA11', 'Loading art 1', 'load-1', '1920 x 1080 made', 'loading screens', 'a baby dragon trying to pick up a card twice its size in its mouth, in a sunny ruin.'),
  A('KA12', 'Loading art 2', 'load-2', '1920 x 1080 made', 'loading screens', 'the Broker merchant pulling his cart up a sandstone road under a big teal sky, wares clinking.'),
  A('KA13', 'Loading art 3', 'load-3', '1920 x 1080 made', 'loading screens', 'a huge stone guardian with a card shield standing in a ruined gate, tiny duelist looking up at it.'),
  A('KA15', 'Map card: The Frostbound Archive', 'map-frostbound-archive', '1536 x 1024 made', 'map select (map 2)', 'a vast snowed-in library: towering bookshelves half buried in drifts, frozen waterfalls of pages, giant ice crystals, warm candle windows, a pale blue sky with snow falling.'),
  A('KA16', 'Map card: The Ember Foundry', 'map-ember-foundry', '1536 x 1024 made', 'map select (map 3)', 'a forge city built over rivers of lava: chimneys, chain lifts, giant anvils, glowing crucibles pouring molten gold, orange sky full of sparks.'),
  A('KA17', 'Map card: The Drowned Court', 'map-drowned-court', '1536 x 1024 made', 'map select (map 4)', 'a sunken palace half under turquoise water: coral growing over marble columns, jellyfish lanterns, a throne in a sunken hall lit by shafts of light.'),
  A('KA14', 'Full map parchment', 'ui-map-parchment', '1024 x 1024 made', 'the full map screen ground (fog is drawn on top in code)', 'an old sand-coloured parchment sheet with soft edges, faint compass rose in one corner made of card shapes, no writing, no drawn map.'),
];

// Duelist portraits for the select grid and leaderboards.
export const PORTRAITS = DUELISTS.map(d => d.name).map((n, i) =>
  I('PT' + String(i + 1).padStart(2, '0'), 'Portrait: ' + n, 'face-' + n.split(',')[0].toLowerCase().replace(/\s+/g, '-'), { how: '2d', style: 'paint', px: '1024 x 1024 made, 128 x 128 in game', where: 'duelist select grid, leaderboard rows, results', portraitOf: n, subj: 'a head-and-shoulders portrait of the duelist below, three-quarter view, friendly confident expression, plain warm sandstone background with a soft light behind the head. The duelist: ' }));

// Regalia: hats and cosmetics found or earned.
export const REGALIA = [
  ['Wyrm horn crown', 'a ring crown made of small curved dragon horns'], ['Card-feather cap', 'a floppy cap with three playing-card feathers'], ['Sun hat', 'a wide straw sun hat with a teal band'],
  ['Hatchling hood', 'a hood shaped like a baby dragon head with tiny wings'], ['Seal halo', 'a floating gold ring with seven small seal plates'], ['Lantern helm', 'a small iron helmet with a teal lantern on top'],
  ['Last King\'s crown', 'a tall plain gold crown with a crimson gem'], ['Bone tiara', 'a cartoon bone tiara with a skull in the middle'], ['Deck-box hat', 'a top hat shaped like a deck box with a card poking out'],
  ['Moth antennae', 'a headband with two fuzzy moth antennae'], ['Golem helm', 'a stone helmet with ram horns'], ['Star circlet', 'a thin circlet with a violet star token'],
].map(([name, subj], i) => I('RG' + String(i + 1).padStart(2, '0'), name, 'hat-' + name.toLowerCase().replace(/[^a-z]+/g, '-'), { how: 'model', style: 'model', view: 'model', tris: 200, h: 0.4, where: 'Regalia slot: worn on any duelist\'s head', subj: 'a hat for a game character, shown alone: ' + subj + '.' }));
