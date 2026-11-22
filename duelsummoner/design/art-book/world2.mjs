// More world assets: variants, ground cover, small props and ambient life. The first book had the big landmarks; a stage that feels hand-made
// needs three to six versions of every common thing so no two patches of ground look alike. Same fields as world.mjs.
// P(code, name, file, triangles, height in metres, where it goes, subject, extra)
const P = (code, name, file, tris, h, where, subj, x = {}) => ({ code, name, file, how: 'model', style: 'model', view: 'model', tris, h, where, subj, ...x });

// ------------------------------------------------------------------ Stage 1: more trees, plants, rocks, ruins
export const MORE1 = [
  // trees: five crowns, five trunks, so a wood has rhythm
  P('W401', 'Round-crown tree', 'tree-round', 140, 6, 'Stage 1 groves and hillsides', 'a chunky tree with a short thick orange-brown trunk that leans slightly, and one big rounded crown built from six faceted leaf blobs, three greens from olive to lime, lit from top left.'),
  P('W402', 'Tall layered tree', 'tree-layered', 150, 8, 'Stage 1 ridges and edges of arenas', 'a tall tree with a thin bent trunk and three stacked flat-topped leaf plates like green plates on a stick, each plate a different size, bright greens.'),
  P('W403', 'Twin-trunk tree', 'tree-twin', 160, 6.5, 'Stage 1 groves', 'a tree whose trunk splits low into two thick curved trunks that lean apart, a leaf crown of five blobs between them, a knot hole painted on one trunk.'),
  P('W404', 'Fruit tree', 'tree-fruit', 150, 4.5, 'Stage 1 farms and the Market', 'a short round tree with a wide crown and a handful of big red and gold fruit as chunky spheres.'),
  P('W405', 'Dead tree', 'tree-dead', 90, 5, 'Stage 1 edges, Stage 2 entrances', 'a bare grey-brown tree with a thick trunk and four crooked branches that end in blunt points, no leaves, one hollow painted on the trunk.'),
  P('W406', 'Tree stump', 'tree-stump', 50, 0.8, 'near groves, clearings', 'a wide stump with flat cut top showing four pale tree rings, roots flaring out at the base, two little mushrooms growing on one side.'),
  P('W407', 'Fallen log', 'tree-log', 60, 0.9, 'forest floor, bridges over gaps', 'a thick fallen log lying on its side, bark in chunky ridges, one end broken into jagged splinters, a patch of moss on top.'),
  P('W408', 'Hollow log', 'tree-hollow', 70, 1.2, 'forest floor, hiding spot for loot', 'a fat hollow log lying on its side with the open end facing the viewer, dark inside, rim worn smooth, a small gold coin glinting inside.'),
  P('W409', 'Tree cluster (young)', 'tree-young-cluster', 140, 3, 'edges, to fill space cheaply', 'five thin young trees standing close together, each a bent stick trunk with a small round leaf head, different heights.'),
  P('W410', 'Branch pile', 'prop-branches', 50, 0.6, 'ground cover', 'a loose heap of seven sticks and branches, brown with pale cut ends, a few leaves caught in it.'),
  // ground cover
  P('W411', 'Grass tuft (short)', 'plant-grass-short', 24, 0.5, 'scattered everywhere, instanced in thousands', 'a small clump of seven chunky grass blades fanning out, bright yellow-green with a darker base, each blade a flat triangle bent at the tip.'),
  P('W412', 'Grass tuft (tall)', 'plant-grass-tall', 30, 0.9, 'scattered in meadows, instanced', 'a tall clump of nine long grass blades arching in different directions, mid green with pale tips, one blade seed head.'),
  P('W413', 'Grass tuft (dry)', 'plant-grass-dry', 28, 0.7, 'dry edges, terraces', 'a clump of eight straw-yellow grass blades, some bent over, thin and brittle looking, a few brown tips.'),
  P('W414', 'Fern', 'plant-fern', 40, 0.7, 'under trees, Stage 1 and Stage 2 damp corners', 'a fern with seven curved fronds fanning out from the centre, each frond a row of chunky leaflets, bright green fading to dark at the base.'),
  P('W415', 'Wildflowers (yellow)', 'plant-flowers-yellow', 40, 0.5, 'meadows, instanced', 'a tight clump of five yellow flowers with round petals and brown centres on thin green stems, a few leaves at the base.'),
  P('W416', 'Wildflowers (white)', 'plant-flowers-white', 40, 0.5, 'meadows, instanced', 'a tight clump of five white daisy-like flowers with yellow centres on thin green stems, a few leaves at the base.'),
  P('W417', 'Wildflowers (purple)', 'plant-flowers-purple', 40, 0.6, 'meadows and shade, instanced', 'a tight clump of four tall purple flower spikes made of stacked chunky bell shapes, green leaves at the base.'),
  P('W418', 'Poppies (red)', 'plant-poppies', 40, 0.5, 'ruins, graves, dry edges', 'a loose clump of five red poppies with black centres on thin curved stems, spiky grey-green leaves.'),
  P('W419', 'Mushrooms (red)', 'plant-mushroom-red', 40, 0.4, 'forest floor, under trees', 'a cluster of three mushrooms of different sizes with red caps painted with white dots and cream stalks.'),
  P('W420', 'Mushrooms (brown)', 'plant-mushroom-brown', 40, 0.4, 'logs, stumps, damp ground', 'a cluster of five small brown mushrooms with round caps, one big, four tiny, on short pale stalks.'),
  P('W421', 'Clover patch', 'plant-clover', 20, 0.2, 'ground cover', 'a flat patch of round three-leaf clover leaves in two greens, one four-leaf clover in the middle.'),
  P('W422', 'Thistle', 'plant-thistle', 36, 0.8, 'dry edges', 'a spiky thistle with a purple pom-pom flower on top, spiky grey-green leaves, thorny looking but chunky.'),
  P('W423', 'Cactus (tall)', 'plant-cactus-tall', 60, 2, 'Stage 1 dry edges, Stage 3 sand', 'a tall barrel-bodied cactus with two arms curving up, ridged vertical lines, a few pale spines painted on, one pink flower on top.'),
  P('W424', 'Cactus (round)', 'plant-cactus-round', 40, 0.6, 'dry edges', 'a small round cactus with ridges, three pale flowers on top, sitting in a ring of pebbles.'),
  P('W425', 'Vines on a wall', 'plant-vines', 60, 2, 'draped on ruined walls and columns', 'a curtain of hanging vines with big heart-shaped leaves, three long strands and two short, bright greens with a few tiny pink flowers.'),
  P('W426', 'Lily pads', 'plant-lilypads', 30, 0.1, 'on water', 'five round flat lily pads of different sizes with a notch cut in each, one with a pink flower, floating flat.'),
  // rocks: many silhouettes
  P('W427', 'Flat slab rock', 'rock-slab', 50, 0.7, 'ground cover, stepping stones', 'a wide flat faceted slab of pale grey stone lying on the ground, a thin crack across it, a tuft of grass in the crack.'),
  P('W428', 'Tall spire rock', 'rock-spire', 70, 4, 'cliff edges, landmarks', 'a tall narrow faceted spire of pale rock leaning very slightly, wider at the base, ledges where small bushes grow.'),
  P('W429', 'Mossy boulder', 'rock-mossy', 90, 2.2, 'Stage 1 groves, Stage 2 damp', 'a big rounded boulder pale grey on the sun side, with a thick cap of green moss on top and down one side.'),
  P('W430', 'Rock arch', 'rock-arch', 140, 4.5, 'landmark, jump route', 'a natural rock arch, two pillars of pale grey rock joined by a thick curved top, a person-sized opening, grass on top.'),
  P('W431', 'Small rocks (scatter)', 'rock-small', 40, 0.4, 'ground cover, instanced', 'three small faceted pebbles of different sizes touching, pale grey, a darker underside.'),
  P('W432', 'Stepping stones', 'rock-steps', 60, 0.2, 'across streams and mud', 'a line of five flat round stones of slightly different sizes set at an angle, as if crossing a stream.'),
  P('W433', 'Ore rock', 'rock-ore', 80, 1.2, 'ground cover, for coins when broken', 'a medium boulder with veins of bright gold showing in three chunky stripes, pale grey elsewhere.'),
  // ruins and small props
  P('W434', 'Wooden fence (section)', 'prop-fence', 60, 1.2, 'farms, Market edges', 'a section of rough wooden fence with three posts and two rails, the end post leaning, brown with pale cut ends.'),
  P('W435', 'Stone well', 'prop-well', 90, 1.8, 'the Market, farms', 'a round stone well with a little wooden roof on two posts and a rope with a bucket, sandstone with chunky blocks.'),
  P('W436', 'Signpost', 'prop-signpost', 40, 2, 'paths, route hints', 'a wooden post with three arrow-shaped boards pointing in different directions, painted with a plain stripe each and no writing.'),
  P('W437', 'Cart (broken)', 'prop-cart', 110, 1.6, 'roads, the Market', 'a two-wheeled wooden cart tipped onto one side, one wheel off, spilled amphorae beside it.'),
  P('W438', 'Barrel (breakable)', 'prop-barrel', 50, 1, 'everywhere; break for coins', 'a round wooden barrel with two iron bands, a small bung on the side, brown with pale highlights.'),
  P('W439', 'Haystack', 'prop-hay', 50, 2, 'farms', 'a big rounded haystack in straw yellow with dark stripes where the hay is bundled, one pitchfork leaning on it.'),
  P('W440', 'Scarecrow', 'prop-scarecrow', 80, 2.2, 'farms, a cute landmark', 'a scarecrow on a wooden cross, a pumpkin head with a stitched grin, a torn blue shirt, straw poking from sleeves, a crooked hat.'),
  P('W441', 'Cloth tent', 'prop-tent', 70, 2.5, 'camps, Market edges', 'a small A-frame tent of teal and cream striped cloth, flaps tied open, a wooden peg and rope at each corner.'),
  P('W442', 'Campfire', 'prop-campfire', 60, 0.8, 'camps, bonus spots', 'a ring of stones around a stack of logs with a chunky orange flame shape on top, a log seat beside it.'),
  P('W443', 'Gravestone (card)', 'prop-gravestone', 40, 1.2, 'graveyards, Stage 1 hills', 'a small upright stone shaped like a playing card with rounded corners, a carved diamond on it, tilted, a little grass at the foot.'),
  P('W444', 'Lantern post', 'prop-lamppost', 50, 2.6, 'paths, Market', 'a wooden post with a hook arm holding a square iron lantern with a warm yellow glow, a ribbon tied to the post.'),
  P('W445', 'Mile marker', 'prop-marker', 30, 1.2, 'paths', 'a short rounded stone post with a carved ring and three notches, tilted slightly, grass at the base.'),
  P('W446', 'Broken pillar stumps', 'ruin-stumps', 80, 1.3, 'ruins, ground clutter', 'three broken column stumps of different heights, fluted sides, the tallest with a jagged top, pale sandstone.'),
  P('W447', 'Collapsed wall pile', 'ruin-wallpile', 90, 1.5, 'ruins, cover from enemy shots', 'a heap of cut sandstone blocks tumbled from a wall, a short stretch of wall still standing at one end.'),
  P('W448', 'Stone bench', 'ruin-bench', 40, 0.8, 'plazas, terraces', 'a long sandstone bench with two block legs and a thick seat, one leg cracked, a few weeds at the base.'),
  P('W449', 'Fountain (dry)', 'ruin-fountain', 110, 2, 'plazas', 'a round stone fountain with a tiered bowl, dry and cracked, a small stone card standing in the middle as a statue, weeds in the bowl.'),
  P('W450', 'Hanging banner (tattered)', 'ruin-banner', 40, 2.5, 'plazas, Colosseum', 'a long cloth banner hanging from a crossbar, torn at the bottom in three strips, a plain gold diamond in the middle.'),
];

// ------------------------------------------------------------------ Stage 2: more crypt
export const MORE2 = [
  P('W501', 'Glow mushrooms', 'cave-mushroom-glow', 50, 0.6, 'Stage 2 damp corners', 'a cluster of five mushrooms with round caps that glow soft cyan-teal, dark blue stalks, tiny glowing dots floating above.'),
  P('W502', 'Stalagmites', 'cave-stalagmite', 70, 2, 'Stage 2 cave floor', 'four pointed stalagmites of different heights rising from the floor, blue-grey stone with pale mineral stripes, wet shine painted as light streaks.'),
  P('W503', 'Tree roots', 'cave-roots', 80, 2.5, 'Stage 2 ceilings and walls', 'a tangle of thick pale roots pushing through a stone wall, three big roots curving down and a few thin ones, dusty brown-grey.'),
  P('W504', 'Skeleton pile (sword)', 'crypt-skeleton', 100, 0.9, 'Stage 2 floors', 'a friendly cartoon heap of bones and one round skull with an old short sword stuck in the floor beside it, bones pale ivory.'),
  P('W505', 'Wall torch (cyan)', 'crypt-torch', 40, 1.2, 'Stage 2 walls', 'an iron wall bracket holding a torch with a cyan-teal seal-fire flame, soot stain above it.'),
  P('W506', 'Coffin lid (leaning)', 'crypt-coffinlid', 50, 2.2, 'Stage 2 walls, cover', 'a stone coffin lid with a carved card-shaped face leaning on a wall, a hand-print worn smooth, cracks at the corner.'),
  P('W507', 'Broken stairs', 'crypt-stairs', 90, 1.6, 'Stage 2 jump routes', 'a short flight of stone stairs that stops after five steps with a broken end, rubble below, damp dark stone.'),
  P('W508', 'Iron cage (floor)', 'crypt-cage-floor', 80, 1.6, 'Stage 2 floors, mimic spots', 'a round iron cage standing on the floor with its door hanging open, rusted bars, a skull inside.'),
  P('W509', 'Rusted chains (heap)', 'crypt-chains', 70, 0.5, 'Stage 2 floors near the Jailer', 'a heap of thick iron chain links with a big ring and shackle at one end, orange rust, dark iron.'),
  P('W510', 'Crypt lantern (floor)', 'crypt-lantern', 40, 0.7, 'Stage 2 floors', 'a squat iron lantern sitting on the floor with a cyan flame inside and glass painted as pale squares.'),
  P('W511', 'Ceiling lantern chain', 'crypt-ceiling-lantern', 60, 3, 'Stage 2 ceilings', 'a long chain hanging from the ceiling with a round iron lantern at the bottom holding a cyan flame.'),
  P('W512', 'Mausoleum door (small)', 'crypt-mausoleum', 140, 3, 'Stage 2 walls, landmark', 'a small stone doorway with a stepped lintel and two short columns, a heavy half-open door, a carved card on the lintel.'),
  P('W513', 'Dust urn (breakable)', 'crypt-urn', 50, 0.9, 'Stage 2 shelves, break for coins', 'a round grey ash urn with a lid and two small handles, a thin band of blue-teal paint, a chip in the rim.'),
  P('W514', 'Bone cart', 'crypt-bonecart', 90, 1.4, 'Stage 2 corridors', 'a small two-wheeled hand cart piled high with pale bones and a skull on top, a worn rope handle.'),
  P('W515', 'Cobweb draped chandelier', 'crypt-web-chandelier', 70, 2, 'Stage 2 ceilings', 'an iron ring chandelier with six candle stubs, thick pale cobwebs draped across it, a plump spider on one strand.'),
  P('W516', 'Water drip pool', 'crypt-drip', 30, 0.1, 'Stage 2 floors', 'a small round puddle on a stone floor with a ring of ripples and one hanging drop above it, blue-black water.'),
];

// ------------------------------------------------------------------ Stage 3: more vault
export const MORE3 = [
  P('W601', 'Coin heap (small)', 'vault-coins-small', 70, 0.7, 'Stage 3 floors, around the throne', 'a small heap of gold coins with a few rolling away, one jewelled goblet stuck in it, bright gold with orange shadow.'),
  P('W602', 'Crystal shards (floor)', 'vault-shards', 60, 0.8, 'Stage 3 floors', 'five thin amethyst shards sticking up from the floor at angles, bright violet with a pale glowing tip, a little glowing dust.'),
  P('W603', 'Sand ripple rock', 'vault-sandrock', 70, 1.5, 'Stage 3 dunes', 'a smooth rounded rock half buried in gold sand, wind ripples carved in the rock, a drift of sand piled on one side.'),
  P('W604', 'Hourglass (giant)', 'vault-hourglass', 120, 4, 'Stage 3 landmark', 'a giant hourglass with a gold frame and glass bulbs, golden sand falling, a thin crack in the lower bulb, a stone card beneath each foot.'),
  P('W605', 'Broken sword in sand', 'vault-sword', 50, 3, 'Stage 3 dunes', 'a giant broken sword blade sticking out of the sand at a lean, a simple cross guard, a jagged snapped end, a torn red ribbon tied to the hilt.'),
  P('W606', 'Fallen banner', 'vault-banner-fallen', 60, 0.5, 'Stage 3 floors', 'a long crimson banner lying across the floor with its pole snapped, gold fringe, a plain gold diamond in the middle.'),
  P('W607', 'Skull totem', 'vault-totem', 90, 3, 'Stage 3 edges', 'three stacked pale skulls on a black iron pole with violet candle flames on top, chains hanging from the pole.'),
  P('W608', 'Obsidian spikes', 'vault-spikes', 70, 2.5, 'Stage 3 cavern edges', 'five thin sharp black glassy spikes of different heights leaning out, violet sheen on the lit faces.'),
  P('W609', 'Gold fountain', 'vault-fountain', 120, 2.5, 'Stage 3 plazas', 'a round fountain overflowing with a thin stream of liquid gold, three tiers, a small crowned card on top.'),
  P('W610', 'Crimson throne guard statue', 'vault-guard-statue', 110, 4, 'Stage 3 throne stair sides', 'a stone knight statue with a big round shield and a short sword, helmet closed, a crimson cloth on its shoulders.'),
  P('W611', 'Floating shard ring', 'vault-shard-ring', 100, 3, 'Stage 3 air, decoration', 'a slow ring of seven large amethyst shards hanging in the air in a circle around nothing, glowing violet.'),
  P('W612', 'Sand cascade', 'vault-sandfall', 90, 6, 'Stage 3 cavern walls', 'a thin curtain of falling gold sand pouring from a crack high in the wall, a heap of sand below it.'),
];

// ------------------------------------------------------------------ ambient life: small creatures that make a stage feel alive (they do not fight)
export const AMBIENT = [
  P('WA01', 'Butterfly', 'life-butterfly', 24, 0.2, 'Stage 1 meadows', 'a small butterfly with orange and black wings spread flat, thin body, two feelers.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'flutters in loops, lands on flowers, wings open and close' }),
  P('WA02', 'Songbird (perched)', 'life-bird', 40, 0.3, 'Stage 1 trees and walls', 'a round chubby bird with a short beak, blue back and cream belly, perched, one eye dot.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'hops, pecks, turns its head, flies off when you come near' }),
  P('WA03', 'Rabbit', 'life-rabbit', 60, 0.5, 'Stage 1 meadows', 'a chunky rabbit sitting up with long ears, tan fur with a white tail, front paws held to its chest.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'sits up, ears twitch, hops away from the fight' }),
  P('WA04', 'Lizard', 'life-lizard', 50, 0.3, 'Stage 1 rocks, Stage 3 sand', 'a flat green lizard with a long tail curved to one side, chunky legs spread, a pale stripe down its back.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'darts, freezes, tail flicks' }),
  P('WA05', 'Beetle', 'life-beetle', 30, 0.2, 'everywhere on the ground', 'a round shiny beetle with a split shell in blue-black, six little legs, two short feelers.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'trundles along, wing cases open for a short buzz' }),
  P('WA06', 'Frog', 'life-frog', 50, 0.3, 'water edges', 'a plump green frog sitting with its back legs folded, a pale belly, big eyes on top of its head.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'sits, throat pulses, jumps' }),
  P('WA07', 'Dragonfly', 'life-dragonfly', 30, 0.2, 'water, Stage 1', 'a thin long dragonfly with four clear wings spread, a blue striped body.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'hovers and darts, wings blur' }),
  P('WA08', 'Bat', 'life-bat', 40, 0.4, 'Stage 2 ceilings', 'a small round bat with big ears and wide leathery wings spread, dark blue-grey fur, tiny pale fangs.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'hangs, then flaps in a loop' }),
  P('WA09', 'Rat', 'life-rat', 50, 0.3, 'Stage 2 floors', 'a chunky grey rat with a long thin pink tail, big round ears, small pink nose, whiskers as three thin shapes.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'scurries, sniffs, sits up' }),
  P('WA10', 'Spider (small)', 'life-spider', 40, 0.3, 'Stage 2 webs', 'a round purple-black spider with eight stubby legs bent at two joints and two big shiny eyes, hanging from a thread.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'creeps, legs ripple, drops on a thread' }),
  P('WA11', 'Glow moth', 'life-glowmoth', 24, 0.2, 'Stage 2 and Stage 3', 'a small round moth with soft fuzzy wings spread and a faintly glowing body, cyan in Stage 2, violet in Stage 3.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'drifts slowly, wings beat, glows' }),
  P('WA12', 'Sand crab', 'life-sandcrab', 50, 0.3, 'Stage 3 sand', 'a flat gold-brown crab with two raised claws and eyes on stalks, walking sideways.', { style: 'creature', view: 'beast', rig: 'parts', anim: 'walks sideways, claws snap' }),
];

export const ALL_MORE = [...MORE1, ...MORE2, ...MORE3, ...AMBIENT];


