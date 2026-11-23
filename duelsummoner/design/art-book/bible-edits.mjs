// Carved Cards style bible (locked by the owner 23 Nov): per-entry changes, kept in ONE place so the source lists and every file key stay untouched.
// EDITS replaces fields of an entry by code (never its code or file). SKIP_BIBLE adds "Can skip" tags.
const cold = 'It holds no flame and nothing glows: the game adds the pale ghost-light itself.';
export const EDITS = {
  // ---- fix 4: sizes from the environment bar and the map spec
  W101: { h: 13, size: '13 m long, 12 m wide and 13 m tall (7 times the height of the player). The trunk is about 1.4 m wide and the leaves start 4.5 m up, so the player walks under it' },
  W102: { h: 9, size: '9 m long, 8 m wide and 9 m tall (5 times the height of the player)' },
  W103: { h: 10 }, W104: { h: 11 },
  W105: { name: 'Parasol acacia', h: 10, size: '9 m long, 9 m wide and 10 m tall (5.5 times the height of the player)', where: 'Surface Ruins everywhere: the main tree, about six in every ten',
    subj: 'a tall parasol tree: one upright trunk that rises straight for the first 4 m and only then leans a little, carrying a wide flat umbrella crown 8 to 10 m across made of three flat overlapping leaf plates. Leaves in the canopy greens; bark in the bark browns.' },
  W401: { h: 14 }, W405: { h: 9 },
  W109: { h: 5, size: '6 m long, 5 m wide and 5 m tall (a hero rock, almost 3 times the height of the player)' },
  W110: { h: 3.2 }, W111: { h: 1.4 }, W430: { h: 6, size: '6 m tall with an opening 3 m wide that the player can run through' },
  // ---- fix 5: one chest body for every chest
  WX01: { subj: 'a chunky chest with a black lacquer body (#2a2026), thick gold chains crossing the lid, sitting on a square stone card pedestal with a carved card frame on its front. No rarity colour anywhere: every chest looks the same from outside.' },
  WX02: { subj: 'the same chunky black lacquer chest (#2a2026) on a square stone card pedestal, wrapped by three thick gold chains that are held by one round gold seal plate on the front. No glow and no coloured light: the game adds the seal light itself.' },
  WX26: { subj: 'the same chunky black lacquer chest (#2a2026) on a square stone card pedestal, with its lid already thrown wide open and a plain ivory lining inside, gold chains hanging loose at the sides. No glow: the game adds the light itself.' },
  WX12: { subj: 'the same chunky black lacquer chest (#2a2026) wrapped in dusty linen strips with one loose strip, the lid slightly open showing a row of chunky teeth and a dark mouth.' },
  // ---- fix 6: reserved colours out of scenery
  W126: { subj: 'a tall wooden pole with a long hanging teal banner trimmed in bone-cream, the banner showing only a simple bone-white card shape.' },
  W450: { subj: 'a long cloth banner hanging from a crossbar, torn at the bottom in three strips, a plain bone-white diamond in the middle.' },
  W408: { h: 1.4, subj: 'a fat hollow log lying on its side with the open end facing the viewer, dark inside, rim worn smooth.' },
  W433: { h: 1.4, subj: 'a medium boulder with veins of pale bone-white quartz showing in three chunky stripes, pale grey elsewhere.' },
  W201: { h: 1.4, subj: 'a heavy stone sarcophagus with a lid carved as a plain sleeping figure holding a card on its chest, slate blue stone, a dull green-bronze rim on the lid.' },
  W204: { name: 'Ghost-light brazier', subj: 'a tall cold iron brazier on a square stand with an empty bowl. ' + cold },
  W210: { subj: 'a cluster of five fat melted wax candles of different heights with bare wicks. ' + cold },
  W214: { subj: 'a round iron chandelier ring decorated with small cartoon bones, eight unlit wax candles on top. ' + cold },
  W505: { name: 'Wall torch', subj: 'an iron wall bracket holding an unlit torch, a soot stain above it. ' + cold },
  W510: { subj: 'a squat iron lantern sitting on the floor with an empty cage and glass shown as pale flat squares. ' + cold },
  W511: { subj: 'a long chain hanging from the ceiling with a round iron lantern at the bottom, its cage empty. ' + cold },
  W217: { subj: 'a broken stone rim round a small dark pool, dull green-bronze moss on the stones. Nothing glows.' },
  W501: { name: 'Cave mushrooms', subj: 'a cluster of five mushrooms with round dull green-bronze caps and dark slate stalks. Nothing glows: the game adds a faint light itself.' },
  W513: { subj: 'a round grey ash urn with a lid and two small handles, a thin band of dull green-bronze paint, a chip in the rim.' },
  W301: { subj: 'an enormous stone playing card floating flat like a raft, 6 m long, a carved border frame on top, chunks of rock hanging below. No glow.', size: '6 m long, 4 m wide and 0.6 m thick' },
  W302: { subj: 'a colossal stone duel table 40 m long, dark basalt top inlaid with bone-white card zone lines, heavy stepped legs, bone-white corner caps.' },
  W303: { subj: 'a giant toppled basalt statue of a crowned monarch lying on its side, cracked in two, with a bone-white crown and a crimson sash, one hand still holding a stone card.' },
  W304: { subj: 'a towering basalt statue of a crowned monarch with arms crossed holding two stone cards, a bone-white crown and trims and a crimson sash, face plain and calm.' },
  W306: { subj: 'a massive basalt throne with a very tall back shaped like a standing card, bone-white trims, a crimson cushion, two short card-shaped side wings.' },
  W307: { subj: 'a wide grand basalt staircase of 20 steps with bone-white edges and a crimson runner carpet up the middle.' },
  W308: { name: 'Moon crystal cluster (big)', subj: 'a cluster of five big chunky hexagonal crystals bursting from a basalt base, pale blue-white like moonlight, each with flat faceted sides. No glow.' },
  W309: { name: 'Moon crystal cluster (small)', h: 1.4, subj: 'a small cluster of three short pale blue-white crystals with flat faceted sides. No glow.' },
  W602: { subj: 'five thin pale blue-white crystal shards sticking up from the floor at angles. No glow and no dust.' },
  W611: { subj: 'seven large pale blue-white crystal shards arranged upright in a circle around nothing, each one a separate chunky faceted piece. No glow.' },
  W310: { subj: 'a smooth wavy dune of pale ash-gold sand (a dusty tan, never bright gold) with a crisp ridge line, faceted gently.' },
  W603: { subj: 'a smooth rounded rock half buried in pale ash-gold sand, wind ripples carved in the rock, a drift of sand piled on one side.' },
  W312: { subj: 'a tall crimson banner hanging from a bone-white bar, a bone-white diamond border and a single bone-white card shape in the middle.' },
  W606: { subj: 'a long crimson banner lying across the floor with its pole snapped, a bone-white fringe, a plain bone-white diamond in the middle.' },
  W313: { name: 'Crystal lamp post', subj: 'a basalt lamp post with a cage holding one pale blue-white crystal. No glow: the game lights it.' },
  W314: { subj: 'three very long iron chains hanging straight down, each ending in a broken iron hook.' },
  W315: { subj: 'a round ash-grey clay jar with a crimson band and a lid.' },
  W316: { subj: 'a tall thin basalt pylon with a bone-white ring at the top holding one pale blue-white crystal.' },
  W604: { subj: 'a giant hourglass with a dull bronze and basalt frame and two empty glass bulbs, a thin crack in the lower bulb, a stone card beneath each foot. No sand inside: the game pours it.' },
  W605: { subj: 'a giant broken sword blade sticking out of the sand at a lean, a simple cross guard, a jagged snapped end, a torn crimson ribbon tied to the hilt.' },
  W607: { subj: 'three stacked pale skulls on a black iron pole with three unlit candle stubs on top, chains hanging from the pole. No flames.' },
  W608: { subj: 'five thin sharp black glassy spikes of different heights leaning out, with pale blue-white lit faces.' },
  W609: { name: 'Sand fountain', subj: 'a round basalt fountain of three tiers with a small crowned stone card on top, its bowls empty. The game adds the flowing sand.' },
  WA10: { subj: 'a round slate-black spider with eight stubby legs bent at two joints and two small dull eyes, hanging from a thread.' },
  WA11: { name: 'Dusty moth', subj: 'a small round moth with soft dull grey-brown wings spread flat and a plain body. It never glows.' },
  WA12: { subj: 'a flat sandy-brown crab with two raised claws and eyes on stalks, walking sideways.' },
  // ---- fix 14: nothing solid between 0.4 and 1.2 m in a running lane
  W212: { h: 1.4 }, W406: { h: 1.5 }, W407: { h: 1.3 }, W443: { h: 1.4 }, W445: { h: 1.4 }, W427: { h: 0.35 },
  // ---- fix 21: XP stays cyan
  PK01: { subj: 'built in code: an 8-sided crystal in XP cyan for all three sizes, told apart by size, number of facets and brightness. It spins and bobs, and streaks to you with a rising pitch.' },
};
const farm = 'This belongs to a farm or forest, not to the Sunlit Kingdom, so the game no longer uses it. Skip it.';
const game = 'The game now makes this by itself, because it moves or glows. There is nothing for you to make.';
const later = 'This map is not in the three-stage run. Parked for later.';
export const SKIP_BIBLE = {};
for (const c of ['W402', 'W403', 'W404', 'W409', 'W414', 'W419', 'W420', 'W421', 'W423', 'W424', 'W426', 'W434', 'W435', 'W436', 'W439', 'W440', 'W448', 'WA06']) SKIP_BIBLE[c] = farm;
for (const c of ['W411', 'W412', 'W413', 'W415', 'W416', 'W417', 'W418', 'W422', 'W431', 'W211', 'W516', 'W612']) SKIP_BIBLE[c] = game;
for (let i = 1; i <= 33; i++) if (i !== 5) SKIP_BIBLE['FX' + String(i).padStart(2, '0')] = 'The game now draws this effect itself with moving light, so no picture is needed.';
for (const c of ['KA15', 'KA16', 'KA17']) SKIP_BIBLE[c] = later;
SKIP_BIBLE.W112 = SKIP_BIBLE.W113 = 'The game builds its cliffs itself from exact pieces, so they always fit the map. Nothing for you to make.';
SKIP_BIBLE.W305 = SKIP_BIBLE.W601 = 'Treasure lying around as scenery would wear the gold that means "use me", so it is out. Skip it.';
// ---- 23 Nov: the engine now makes these itself (engine plan section 7a, spectacle spec). Shown as "Can skip".
const eng = 'The game now makes this itself in code, as moving water, light or particles, so no picture is needed.';
for (const c of ['MT28', 'MT53', 'MT31', 'MT48', 'WX14', 'WX30', 'FX05', 'FX35', 'FX36', 'FX37', 'FX38']) if (!SKIP_BIBLE[c]) SKIP_BIBLE[c] = eng;
for (const c of ['DC01', 'DC02', 'DC03', 'DC04']) SKIP_BIBLE[c] = 'Ground marks are now drawn by the game itself (stains, scorch, drifts), so these sheets are not needed.';
// Not solid, so the player is never snagged (builder note; shown on the card)
export const NONSOLID = ['W106', 'W107', 'W108', 'W208', 'W410', 'W504', 'W509', 'W510', 'W601', 'W602', 'W606'];
export const BREAKABLE = ['W123', 'W124', 'W125', 'W315', 'W438', 'W513'];
// Word swaps inside a subject (and its Meshy text), for entries where only a colour word is wrong.
const lm = [['Smooth cool grey-violet stone', 'Smooth dark landmark stone (#4a4250)'], ['smooth cool grey-violet', 'smooth dark landmark stone (#4a4250)'], ['Cool grey-violet', 'Dark landmark stone (#4a4250)'], ['cool grey-violet', 'dark landmark (#4a4250)'], ['grey-violet', 'dark grey']];
export const SUBS = {
  W140: lm, W141: lm, W142: lm, W143: lm, W144: lm, W703: [...lm, ['filled with old gold', 'filled with bone-white']], W709: lm,
  W702: [['Eight small square studs of old gold', 'Eight small square bone-white studs']],
  W704: [['with a thin old-gold rim', 'with a thin raised rim']],
  W706: [['warm brown-gold bronze', 'dull brown bronze'], ['a thick old-gold rim', 'a thick plain rim']],
  W444: [['a square iron lantern with a warm yellow glow', 'a square unlit iron lantern']],
  WX07: [['a cyan crystal set at the top', 'a pale quartz crystal set at the top']],
  WX08: [['a cracked violet card', 'a cracked bone-white card']],
  WX15: [[', violet light rising from it', '. No light: the game adds it']],
  WX22: [['a pulsing violet ring', 'a raised gold rim. Nothing glows']],
  WX37: [[' This one is the single exception to the rule about dark colours and is dark on purpose, so ignore any line that says the darkest tone must be a mid tone:', ' It has'], ['painted in flat tones, not shiny or mirror-like (deep black-violet with one soft painted sheen stripe so its shape still reads)', 'in flat black (#2a2026), not shiny']],
};
// Art-direction spot-check of version 14 (23 Nov): no summon violet and no loot gold on enemies; Vault map card; olive leaf value.
Object.assign(SUBS, {
  EN07: [['gold sand running inside it', 'pale ash-gold sand running inside it']],
  EN12: [['gold-plated stone segments', 'tarnished bronze stone segments'], ['violet gem eyes', 'amber gem eyes'], ['a crack glowing violet down its spine', 'a crimson crack down its spine']],
  EN13: [['loose violet and gold playing cards', 'loose crimson and bone-white playing cards']],
  EN15: [['a fast gold beetle', 'a fast tarnished bronze beetle']],
  EN16: [['dark gold sand', 'dark ash-gold sand']],
  EN18: [['a long violet-black robe', 'a long slate-black robe']],
  TB02: [['gold collar plates', 'tarnished bronze collar plates'], ['violet gem eyes', 'amber gem eyes']],
  TB04: [['violet edges', 'moon-white edges']],
  TB05: [['of gold and basalt', 'of tarnished bronze and basalt'], ['a violet glow', 'a crimson glow']],
  TB06: [['crimson and gold coat', 'crimson and bone-white coat'], ['a gold crown', 'a tarnished bronze crown']],
  EL03: [['of basalt and gold', 'of basalt and tarnished bronze']],
  GB03: [['crimson and gold royal robe', 'crimson and bone-white royal robe'], ['two violet lights for eyes', 'two moon-white lights for eyes'], ['a long gold blade', 'a long tarnished bronze blade'], ['a cape of falling gold sand', 'a cape of falling ash-gold sand']],
  KA07: [['a sea of falling gold sand', 'a sea of falling pale ash-gold sand'], ['amethyst crystals glowing', 'pale moon-white crystals, and the only violet in the picture is the seal on the Throne Gate']],
  W101: [['Leaves are light silvery sage green with pale yellow-green highlights; bark is warm light grey-brown.', 'Leaves in the canopy greens; bark in the bark browns.'], ['light sage green leaves, light grey-brown bark', 'mid green leaves, dark brown bark']],
});
