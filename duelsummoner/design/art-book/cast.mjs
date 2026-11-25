// Everyone who moves: duelists, summons, enemies, bosses, NPCs.
// rig: 'meshy' = two-legged, use Meshy auto-rig + its clips; 'parts' = separate part models animated in code;
//      'vat' = swarm, baked vertex animation; 'bend' = one piece, bent and bobbed in code.
const C = (code, name, file, x) => ({ code, name, file, how: 'model', ...x });

// ---------------------------------------------------------------- duelists (playable)
const DUELIST_CLIPS = 'idle (cards fanned, breathing), select-screen fidget, run 9 m/s, strafe, backpedal, jump rise, apex, fall, light land, heavy land, air-jump spin, dash, slide, card throw (upper body, plays while running), summon pose, Fusion pose (hands joined overhead), Tribute pose, hurt flinch, low-LP limp, chest kneel, shrine channel, level-up flourish, victory, defeat collapse';
const D = (code, name, file, look, outfits, x = {}) => C(code, name, file, { style: 'person', view: 'biped', tris: 2200, h: 1.8, rig: 'meshy', where: 'playable duelist: run, duelist select, results', subj: look, anim: DUELIST_CLIPS, outfits, ...x });

export const DUELISTS = [
  D('CH01', 'Kael, Ember Tamer', 'duelist-kael', 'a young dragon tamer with spiky dark-red hair tied back, a short ember-orange scarf, a sleeveless leather vest over a cream shirt, thick bronze bracers, one heavy leather glove with a card holster on the forearm, baggy brown trousers tucked into big boots, a small horn charm on his belt. Confident grin.', [
    ['Ashen Road', 'the same tamer in dusty grey travelling clothes with a long tattered scarf and goggles on the forehead'],
    ['Wyrmguard', 'the same tamer in chunky red-and-gold scale armour pieces shaped like dragon plates, a horned half-helm'],
    ['Festival', 'the same tamer in a bright festival outfit: white and orange robe jacket, paper lantern charms, sandals'],
  ]),
  D('CH02', 'Mira, Rune Scribe', 'duelist-mira', 'a sharp young scholar-duelist with a short silver-blue bob haircut, round glasses, a teal coat with big pockets stuffed with rolled scrolls and cards, a satchel, ink-stained fingerless gloves, a floating quill charm at her shoulder, sturdy short boots. Curious, clever look.', [
    ['Field Notes', 'the same scholar in an explorer outfit: khaki shorts, rolled sleeves, map case, a wide sun hat'],
    ['Archivist', 'the same scholar in a long indigo archive robe with gold page-edge trims and a tall collar'],
    ['Starlit', 'the same scholar in a midnight blue coat patterned with simple gold star dots, a crescent hair clip'],
  ]),
  D('CH03', 'Vesh, Hollow Hand', 'duelist-vesh', 'a lean quiet duelist in a hooded dusk-violet cloak with a ragged hem, a pale grey wrapped scarf over the lower face, one bare hand and one hand covered in a long black glove that fades into violet smoke at the fingertips, card belt across the chest, soft boots.', [
    ['Gravewalker', 'the same duelist in layered grey funeral wraps with a small iron lantern hanging from the belt'],
    ['Moonless', 'the same duelist in an all-black cloak with a white inner lining and silver clasps'],
    ['Penitent Silk', 'the same duelist in pale cream silks with a violet sash, hood down showing short white hair'],
  ]),
  D('CH04', 'Oren, Bound Pages', 'duelist-oren', 'a broad friendly older duelist with a thick grey beard, a big belly, a long brown coat covered in leather straps that hold a chained giant book on his back, a reading monocle, chunky rings, sandals. Warm and jolly.', [
    ['Librarian', 'the same duelist in a cosy green cardigan with elbow patches and a stack of books on his back'],
    ['Old Champion', 'the same duelist in a faded gold champion\'s sash and a dented old crown worn crooked'],
    ['Pilgrim', 'the same duelist in pilgrim grey with a walking staff and a scallop-shell-shaped card case'],
  ]),
  D('CH05', 'Tessa, Beast Warden', 'duelist-tessa', 'a sturdy cheerful beast warden with wild curly auburn hair held back by a leaf headband, freckles, a fur-trimmed earth-brown vest over a green shirt, many pouches of treats on her belt, a shepherd\'s whistle on a cord, thick gloves, big muddy boots.', [
    ['Herdmother', 'the same warden in a long patchwork coat covered in animal patches, a crook on her back'],
    ['Root and Stone', 'the same warden in earth-toned armour made of carved wood and stone plates, moss on the shoulders'],
    ['Market Day', 'the same warden in a bright market outfit: yellow apron, rolled sleeves, a basket of fruit on her hip'],
  ]),
  D('CH06', 'Juno, Storm Courier', 'duelist-juno', 'a fast lean courier with short spiky white-blond hair, a mint-green flight jacket with a tall collar, a big messenger bag full of cards, pale goggles round the neck, fingerless gloves, winged running shoes, a long scarf always blowing behind.', [
    ['Night Run', 'the same courier in a dark navy jacket with glowing mint trim and reflective stripes'],
    ['Sky Mail', 'the same courier in a classic postal uniform: peaked cap, satchel, brass buttons'],
    ['Thunderhead', 'the same courier in storm-grey armour plates with yellow lightning stripes and a crested helmet'],
  ]),
  D('CH07', 'Corvin, Gravekeeper', 'duelist-corvin', 'a tall gentle gravekeeper with a long black ponytail and tired kind eyes, a high-collared charcoal coat, a lantern on a hook, a small spade on his back, a crow perched on his shoulder, bone charms on the belt.', [
    ['Mourning Dress', 'the same gravekeeper in an elegant black suit with a violet cravat and a top hat'],
    ['Crowfeather', 'the same gravekeeper in a cloak of black feathers with a beaked half-mask pushed up'],
    ['Lantern Night', 'the same gravekeeper in warm brown work clothes with many small lanterns hanging from his belt'],
  ]),
  D('CH08', 'Pell, Card Sharp', 'duelist-pell', 'a slick smiling card sharp with slicked-back dark hair and a thin moustache, a crimson waistcoat over a white shirt with sleeve garters, cards tucked in the hat band of a small bowler hat, a fan of cards always in one hand, polished shoes.', [
    ['High Roller', 'the same card sharp in a gold-trimmed white suit with a long coat and rings on every finger'],
    ['Back Alley', 'the same card sharp in a patched brown coat, flat cap and a toothpick'],
    ['Showman', 'the same card sharp in a stage magician outfit: tailcoat, top hat, cape with a red lining'],
  ]),
  D('CH09', 'Ilse, Frost Twin', 'duelist-ilse', 'a calm young woman with long silver-white braids, pale blue eyes, a quilted ice-blue coat with white fur trim, mittens on strings, two matching snowflake hairpins, one small twin doll tied to her belt, fur boots.', [
    ['Glacier Crown', 'the same twin in a regal white and pale blue gown-coat with an ice crystal tiara'],
    ['Polar Hunter', 'the same twin in practical hunting furs with a hood and a short spear'],
    ['Thaw', 'the same twin in a light spring outfit of mint and cream with flowers in the braids'],
  ]),
  D('CH10', 'Rook, Trap Engineer', 'duelist-rook', 'a stocky inventive engineer with a buzz cut, big round welding goggles on the forehead, a canvas overall with rolled sleeves, a tool belt full of springs and gears, a mechanical arm brace on one forearm, heavy work boots.', [
    ['Sapper', 'the same engineer in a padded blast suit with a dented helmet and a coil of fuse'],
    ['Clockwork', 'the same engineer in a brass and leather outfit with clock gears on the vest'],
    ['Tinker\'s Holiday', 'the same engineer in a bright Hawaiian-style shirt, shorts and a toolbox'],
  ]),
  D('CH11', 'Saba, Sunwarden', 'duelist-saba', 'a warm tall sun guardian with dark skin, short curly hair with gold beads, a white and gold sleeveless tunic, a sun-disc shield on her back, gold arm rings, a light orange cape, sandals with shin wraps.', [
    ['Dawnguard', 'the same guardian in pale gold plate armour with a sunburst chest piece'],
    ['Desert Wind', 'the same guardian in flowing sand-coloured travelling robes and a head wrap'],
    ['Midsummer', 'the same guardian in a festive outfit of orange and gold with flower garlands'],
  ]),
  D('CH12', 'Brann, Golem Smith', 'duelist-brann', 'a huge broad-shouldered smith with a short red beard, a bald head with a soot smudge, a thick leather apron over a sleeveless shirt, stone gauntlets on both hands, a small stone golem head hanging as a charm, heavy boots.', [
    ['Mountainborn', 'the same smith in a full suit of chunky stone plate armour'],
    ['Forge Master', 'the same smith in a long heat-proof coat with brass buttons and tinted goggles'],
    ['Day Off', 'the same smith in a knitted sweater with a golem pattern and slippers'],
  ]),
  D('CH13', 'Practice Duelist', 'duelist-practice', 'a wooden training dummy come to life: a jointed wooden mannequin with a round head with a painted simple smile, a straw-stuffed tunic, a cardboard card holster, rope belt.', [], { where: 'tutorial and Quick Duel stand-in; also the training dummy in menus' }),
];

// ---------------------------------------------------------------- summons: 18 monsters in 9 pairs, three forms each (0.5x, 1x, 2x)
const SUMMON_CLIPS = 'rise from the floor card, idle hover or stance, follow-move (walk or fly), attack (see attack), hurt, level-up sparkle, form-change burst, Tribute dissolve, Graveyard exit';
const M = (code, name, file, element, attack, partner, forms, x = {}) => C(code, name, file, { style: 'creature', view: 'beast', element, attack, partner, forms, rig: 'parts', anim: SUMMON_CLIPS, where: 'summoned monster, Card Library, offer cards', ...x });

export const SUMMONS = [
  M('SM01', 'Ember Wyvern', 'mon-ember-wyvern', 'fire', 'swooping fire bolts that pierce a line', 'Cinder Hatchling', [
    ['a small round wyvern chick with huge wing-arms, big eyes, a short tail with a flame tuft, crimson and gold', 450],
    ['a lean young wyvern with wing-arms, a crest of flame-shaped spines, crimson with gold belly', 750],
    ['a big proud wyvern with wide wing-arms, a long tail ending in a flame tuft, crimson scales with gold edges, fire glowing in the throat', 1200],
  ], { have: 'Crimson Sky Tyrant model is in the game as form 3', haveFiles: ['mon-ember-wyvern-f3.glb'], parts: 'body, left wing (we mirror it), tail' }),
  M('SM02', 'Cinder Hatchling', 'mon-cinder-hatchling', 'fire', 'short breath cone, 3 hits, spreads Burn', 'Ember Wyvern', [
    ['a tiny round baby dragon with a huge head, stubby legs, tiny useless wings, a cracked eggshell still on its head like a hat, ember-orange body with a cream belly, little smoke puffs from the nose', 450],
    ['a chubby young dragon with a big head, short horns, small wings, glowing lava cracks on its back and tail tip, ember-orange with a cream belly', 600],
    ['a stocky teenage dragon with a big jaw, curved horns, stubby but proud wings, lava-glow belly plates, ember-orange and charcoal', 900],
  ], { have: 'Emberhorn Drake model is in the game as form 2', haveFiles: ['mon-cinder-hatchling-f2.glb'], parts: 'body, left wing (we mirror it), tail, jaw if possible' }),
  M('SM03', 'Rune Newt', 'mon-rune-newt', 'lightning', 'spits rune marks onto 3 enemies', 'Sigil Familiar', [
    ['a tiny chubby newt with a big round head, stubby legs, a curled tail, slate-blue skin with glowing yellow rune-like stripes (simple lines, no letters), a little spark on its tongue', 400],
    ['a plump salamander with a frilled head crest, glowing yellow stripe patterns along its back, small static sparks dancing over the frill', 600],
    ['a big lizard-salamander with a wide crackling frill like a fan of yellow crystal plates, glowing stripes, a long tail with a spark bulb at the tip', 950],
  ], { parts: 'body, tail; frill pulses in code', replaces: 'Rune Apprentice (a robed person)' }),
  M('SM04', 'Sigil Familiar', 'mon-sigil-familiar', 'lightning', 'fast single strike every 0.5 s, finishes marks', 'Rune Newt', [
    ['a tiny floating round owl-like spirit with a paper-white body, two small folded-paper wings, a small crackling yellow ring floating above its head', 400],
    ['a round floating owl spirit with folded-paper wings and tail, two crackling yellow rings orbiting it', 600],
    ['a large floating owl spirit with wide folded-paper wings, a crest of paper feathers and three crackling yellow rings orbiting it', 1000],
  ], { parts: 'body, left wing; rings built in code' }),
  M('SM05', 'Frost Lynx', 'mon-frost-lynx', 'ice', 'pounce and slash that Chills; hunts elites', 'Rime Sprite', [
    ['a fluffy round ice-blue lynx kitten with huge ear tufts, big paws and frosty white cheeks', 450],
    ['a young lynx with tall ear tufts tipped with ice crystals, pale blue fur in chunky faceted tufts, a stubby tail', 700],
    ['a big armoured lynx with ice crystal plates growing along its back and shoulders, frost mane, glowing pale cyan eyes', 1100],
  ], { parts: 'body, tail; legs bent in code' }),
  M('SM06', 'Rime Sprite', 'mon-rime-sprite', 'ice', 'freezing burst of 3 shards around itself', 'Frost Lynx', [
    ['a tiny floating snowball creature with a happy face, two twig arms and a little ice-crystal crown', 350],
    ['a floating snowman-like sprite made of three snow lumps, icicle hair, two ice-crystal wings', 550],
    ['a large floating frost spirit made of stacked snow lumps wrapped in a ring of orbiting ice shards, an icicle crown', 900],
  ], { parts: 'body, wings; shards built in code' }),
  M('SM07', 'Lantern Firefly', 'mon-lantern-firefly', 'light', 'steady beam that Reveals; heals you on kills', 'Hollow Shade', [
    ['a tiny round firefly with a huge glowing cream-gold lantern belly, small clear wings, big friendly eyes, short antennae', 350],
    ['a plump firefly with a glowing bulb belly framed by little bronze ribs like a lantern cage, four clear wings', 550],
    ['a large regal firefly with a big glowing lantern abdomen inside a bronze cage, long feathery antennae, six shimmering wings', 900],
  ], { parts: 'body, left wing x2', replaces: 'Lantern Acolyte (a robed person)' }),
  M('SM08', 'Hollow Shade', 'mon-hollow-shade', 'dark', 'curse touch that spreads on death', 'Lantern Firefly', [
    ['a small round floating ghost blob in violet-black with a white mask-like face with two hollow eye holes and a sheet-like tail', 350],
    ['a floating ghost in tattered violet-black cloth with long floppy sleeve arms and a white smiling mask face', 550],
    ['a large ghost with a hooded tattered cloak, long clawed sleeve arms trailing smoke, a cracked white mask face, small violet flames floating round it', 900],
  ], { parts: 'body; cloth tail waved in code' }),
  M('SM09', 'Burrow Mole', 'mon-burrow-mole', 'earth', 'burrows and bursts up under groups, Stagger', 'Pebble Golemling', [
    ['a tiny round mole with huge shovel paws, a pink star nose, tiny goggles pushed up on its head, brown velvet fur in chunky faceted tufts', 400],
    ['a chubby mole with a miner\'s helmet made of a stone bowl, big digging claws, a satchel of pebbles', 600],
    ['a big armoured mole with stone plates on its back like a shell, giant drill-shaped claws, goggles down, dust always falling off it', 950],
  ], { parts: 'body; digging done in code' }),
  M('SM10', 'Pebble Golemling', 'mon-pebble-golemling', 'earth', 'plants itself as a turret that taunts enemies near it', 'Burrow Mole', [
    ['a tiny golem made of five round river pebbles stacked into a body, head and two stubby arms, a moss tuft on top, two glowing amber dot eyes', 350],
    ['a sturdy little golem of stacked sandstone blocks with a slab shield for one arm, moss on the shoulders, amber eyes', 600],
    ['a big golem fortress of stacked boulders with a flat back like a wall, a slab shield, a little stone tower on one shoulder', 1000],
  ], { parts: 'body, shield arm' }),
  M('SM11', 'Bog Toad', 'mon-bog-toad', 'poison', 'lobs a puddle of Venom', 'Thornback Hedgehog', [
    ['a tiny round toad with a huge grin, big bulging eyes, bright green skin with purple spots, a lily pad on its head', 350],
    ['a fat toad with warty green skin, purple spots that glow, a throat sac that swells before it spits', 550],
    ['a huge bloated toad with a mossy back growing little mushrooms, glowing purple spots, a big throat sac', 900],
  ], { parts: 'body, throat sac swells in code' }),
  M('SM12', 'Thornback Hedgehog', 'mon-thornback-hedgehog', 'poison', 'rolls through enemies; fires a ring of spines when you are hurt', 'Bog Toad', [
    ['a tiny round hedgehog with a cute snout and short green thorn spines tipped with purple drops', 350],
    ['a plump hedgehog with long green thorn spines with purple venom tips, small leaf ears', 600],
    ['a big boar-sized hedgehog with huge curved thorn spines like a bramble bush, glowing purple tips, tusks', 950],
  ], { parts: 'body; rolling done in code' }),
  M('SM13', 'Gale Ferret', 'mon-gale-ferret', 'wind', 'dashes between enemies, each hit Gusts', 'Kite Ray', [
    ['a tiny long ferret kit with a fluffy tail, mint-white fur, a little scarf blowing behind it', 350],
    ['a sleek ferret with a long ribbon-like tail that curls into a swirl, mint-white fur, wind streaks painted on its sides', 550],
    ['a big swift ferret with two ribbon tails, a mane of wind-swept fur, pale green goggles, always mid-leap', 900],
  ], { parts: 'body, tail' }),
  M('SM14', 'Kite Ray', 'mon-kite-ray', 'wind', 'flies over you and sweeps a wind beam that pulls enemies in', 'Gale Ferret', [
    ['a tiny flat flying manta ray with big eyes, a long thin tail with a ribbon at the end, sky-teal on top and white underneath', 300],
    ['a flying manta ray with wide fins edged like a kite, a ribbon tail, painted swirl patterns', 500],
    ['a huge gliding manta ray with wide kite fins, three ribbon tails, wind swirling under its belly', 850],
  ], { parts: 'body, left fin, tail' }),
  M('SM15', 'Smolder Imp', 'mon-smolder-imp', 'fire', 'each attack costs you 1 LP and hits 40% harder', 'Bone Pup', [
    ['a tiny round imp with a big head, little horns, a cheeky grin, a charcoal body with glowing ember cracks, a tiny flame on its tail tip', 350],
    ['a small wiry imp with bat-like ear fins, ember cracks glowing brighter, a little bell on a chain round its neck', 550],
    ['a bigger imp with curled horns, glowing ember veins, small bat wings, a burning bell on a chain', 900],
  ], { parts: 'body, left wing (form 3)', replaces: 'Cinder Penitent (a robed person)' }),
  M('SM16', 'Bone Pup', 'mon-bone-pup', 'dark', 'bites harder the lower your LP (up to x2)', 'Smolder Imp', [
    ['a tiny friendly puppy made of smooth cartoon bones, a big round skull head with violet glowing eyes, a wagging bone tail', 350],
    ['a young bone hound with a ribcage body, violet flame in its chest, a collar with a little tag', 550],
    ['a big bone wolf with a cloak of violet smoke, heavy jaw, glowing chest flame, bone spikes on its back', 900],
  ], { parts: 'body, tail, jaw' }),
  M('SM17', 'Coin Crab', 'mon-coin-crab', 'earth', 'pinches; kills drop an extra coin 10% of the time', 'Lucky Kit', [
    ['a tiny crab wearing a gold coin as a shell, big claws, eyes on stalks', 300],
    ['a crab with a shell made of stacked gold coins, one oversized claw, a jewel on its back', 500],
    ['a big crab carrying a treasure chest as its shell, gold-plated claws, coins spilling out', 850],
  ], { parts: 'body, big claw' }),
  M('SM18', 'Lucky Kit', 'mon-lucky-kit', 'light', 'throws a gold coin that bounces 3 times; grows with coins held', 'Coin Crab', [
    ['a tiny fox kit with huge ears, cream and gold fur, holding a gold coin in its mouth, a curly tail', 350],
    ['a young fox with two fluffy tails, gold bell collar, a coin balanced on its nose', 600],
    ['a big elegant fox with three flowing tails tipped with gold, a gold coin halo, a lucky-knot ribbon', 950],
  ], { parts: 'body, tails' }),
];

// Fusions: three forms each, made by growing one design (form 1 young, form 2 adult, form 3 crowned).
const F = (code, name, file, element, attack, recipe, subj, tris, h, x = {}) => C(code, name, file, { style: 'creature', view: 'beast', element, attack, recipe, subj, tris, h, rig: 'parts', formsAuto: x.tier ? 0 : 3, anim: 'Fusion unfold (merge vortex, card flip, creature unfolds), idle, follow-move, attacks, roar, hurt, form change, God ascent at the Final Altar', where: 'Fusion summon, Card Library, Fusion banner', ...x });
export const FUSIONS = [
  F('FU01', 'Twinflare Tyrant', 'fus-twinflare-tyrant', 'fire', 'two heads: one breathes a line, one a cone', 'Ember Wyvern + Cinder Hatchling', 'a two-headed dragon, heavy chunky body, two long necks with different heads (one sleek wyvern head, one stubby horned head), wide bat wings, lava-glow cracks along the belly, crimson and ember-orange scales.', 1600, 4.5, { have: 'Molten Twinflare model is in the game as form 2', haveFiles: ['fus-twinflare-tyrant-f2.glb'], parts: 'body, left wing, tail, each neck' }),
  F('FU02', 'Astral Strix', 'fus-astral-strix', 'lightning', 'marks 6; marked kills explode into 5 new marks', 'Rune Newt + Sigil Familiar', 'a great owl-salamander: an owl body of folded paper feathers, a lizard tail with glowing yellow stripes, a crackling crystal frill behind its head like a halo, rings of lightning orbiting it.', 1700, 4.5, { parts: 'body, left wing, tail', replaces: 'Astral Magus (a robed person)' }),
  F('FU03', 'Hoarfrost Colossus', 'fus-hoarfrost-colossus', 'ice', 'ground slam freezes a ring; frozen enemies take +50% from the next hit', 'Frost Lynx + Rime Sprite', 'a huge gentle ice golem with a round snowy body, a cat-like face with lynx ear tufts made of ice, giant ice-crystal fists, glacier plates on the shoulders, a frost mane.', 1800, 5.4, { parts: 'body, left arm, right arm' }),
  F('FU04', 'Gloam Herald', 'fus-gloam-herald', 'light and dark', 'a beam that Reveals and curses at once (Eclipse)', 'Lantern Firefly + Hollow Shade', 'a giant bat-moth creature with a body shaped like a bronze bell, one wing glowing cream-gold and one wing tattered violet-black, a small white mask face on the front of the bell, a glowing lantern clapper inside.', 1700, 4, { parts: 'body, left wing, right wing, clapper' }),
  F('FU05', 'Bastion Tortoise', 'fus-bastion-tortoise', 'earth', 'taunts; its shell gives you Guard while near it', 'Burrow Mole + Pebble Golemling', 'a walking fortress tortoise: a shell built like a small stone castle with towers and a gate, a mole-like snout with goggles, huge digging forefeet, moss and pebbles on its back.', 1900, 5, { parts: 'body, head' }),
  F('FU06', 'Venomire Hydra', 'fus-venomire-hydra', 'poison', 'three heads spit Venom; when you are hurt each head spits at once', 'Bog Toad + Thornback Hedgehog', 'a squat three-headed swamp hydra: a fat toad-like body covered in green thorn spines with purple tips, three short necks each with a grinning toad head, glowing purple spots.', 1800, 4.5, { parts: 'body, each neck' }),
  F('FU07', 'Tempest Roc', 'fus-tempest-roc', 'wind', 'wing beats pull everything into a vortex, then a dive', 'Gale Ferret + Kite Ray', 'a giant bird with manta-ray kite wings, a long ferret-like body and two ribbon tails, mint and sky-teal feathers, wind always swirling round its wings.', 1800, 5, { parts: 'body, left wing, tails' }),
  F('FU08', 'Cinder Manticore', 'fus-cinder-manticore', 'fire and dark', 'costs 1 LP an attack; damage x3 at 1 LP', 'Smolder Imp + Bone Pup', 'a manticore with a bone-wolf body, a mane of ember flames, small imp horns, bat wings, a scorpion tail made of glowing vertebrae ending in a burning bell.', 1800, 4.5, { parts: 'body, left wing, tail' }),
  F('FU09', 'Hoard Drake', 'fus-hoard-drake', 'earth and light', 'sleeps on a coin pile; every 100 coins held adds a gold breath', 'Coin Crab + Lucky Kit', 'a plump gold dragon with fox ears and three fluffy fox tails, crab-claw hands, scales like stacked gold coins, sitting on a heap of treasure.', 1800, 4.5, { parts: 'body, tails' }),
];

export const GODS = [
  F('GO01', 'Stormcrown Drake', 'god-stormcrown-drake', 'fire and lightning', 'every breath chains lightning', 'Twinflare Tyrant + Astral Strix', 'a colossal four-legged drake with a crown of jagged yellow crystal horns crackling with lightning, crimson and slate scales with yellow zigzag stripes, wide wings made of faceted plates, fire in its throat.', 3000, 7.2, { tier: 'god', parts: 'body, left wing, tail', where: 'God Fusion' }),
  F('GO02', 'Thermal Sovereign', 'god-thermal-sovereign', 'fire and ice', 'alternates freezing and burning sweeps (Thermal Shock)', 'Twinflare Tyrant + Hoarfrost Colossus', 'a colossal sun dragon coiled upright like a serpent, one half white-hot gold with molten cracks and one half glacier blue with ice plates, a halo of floating flame and ice plates behind its head.', 3200, 7.2, { tier: 'god', parts: 'body, halo, left wing', where: 'God Fusion' }),
  F('GO03', 'Rimelight Seraph', 'god-rimelight-seraph', 'ice and light', 'crystal lances fall on marked enemies', 'Hoarfrost Colossus + Gloam Herald', 'a colossal crystal moth-dragon with six wide translucent ice-crystal wings in three pairs, a long gentle face, a body of pale blue faceted crystal with a white glowing lantern core, feathery frost antennae.', 3000, 7.2, { tier: 'god', parts: 'body, left wing x3', where: 'God Fusion' }),
  F('GO04', 'Dune Leviathan', 'god-dune-leviathan', 'wind and earth', 'swims through the ground, pulls packs into its wake (Sandblast)', 'Tempest Roc + Bastion Tortoise', 'a colossal sand whale with a fortress shell on its back, kite-like fins, a wide mouth full of stone teeth, sand pouring off it in streams.', 3200, 7.2, { tier: 'god', parts: 'body, left fin, tail', where: 'God Fusion' }),
  F('GO05', 'Pyre Hydra', 'god-pyre-hydra', 'poison and fire', 'five heads; each hurt you take fires all five (Toxic Flare)', 'Venomire Hydra + Cinder Manticore', 'a colossal five-headed hydra of charcoal and toxic green, ember cracks and glowing purple spots, thorn spines down its back, each head different (toad, wolf skull, imp, serpent, hedgehog snout).', 3400, 7.2, { tier: 'god', parts: 'body, each neck', where: 'God Fusion' }),
  F('GO06', 'Midas Wyrm', 'god-midas-wyrm', 'light and lightning', 'marked enemies drop coins when they explode', 'Hoard Drake + Astral Strix', 'a colossal serpent-dragon of pure gold coins and paper feathers, a crystal frill halo, fox-tail fins along its body, coins and sparks trailing from it.', 3200, 7.2, { tier: 'god', parts: 'body, frill', where: 'God Fusion' }),
  F('SX01', 'Eventide Arcanum', 'secret-eventide-arcanum', 'fire, lightning and ice', 'chains jump 10 times instead of 4', 'Stormcrown Drake + Rimelight Seraph (hidden)', 'a colossal cosmic whale-serpent floating in the air, deep indigo body speckled with star dots, a long finned tail, a crescent-moon horn, slow drifting fins, glowing violet underbelly.', 3400, 7.2, { tier: 'secret', parts: 'body, tail, left fin', where: 'Secret Fusion' }),
  F('SX02', 'The Endless Coil', 'secret-endless-coil', 'every element', 'hurt triggers uncapped for 20 s after each Toll Shade touch', 'Pyre Hydra + Dune Leviathan (hidden)', 'a colossal ouroboros serpent biting its own tail, forming a ring you stand inside, its scales cycling through ember, toxic green and sand gold, a crown of five small heads along its back.', 3400, 7.2, { tier: 'secret', parts: 'body', where: 'Secret Fusion' }),
];

// ---------------------------------------------------------------- enemies
const E = (code, name, file, stage, h, tris, subj, clips, x = {}) => C(code, name, file, { style: 'enemy', view: x.view || 'beast', stage, h, tris, subj, anim: clips + '; shared: spawn from sand or seal, hit flinch, knockback slide, death crumble into an XP crystal, element status overlays', rig: x.rig || 'vat', where: 'swarm enemy, ' + stage, ...x });

export const ENEMIES = [
  E('EN01', 'Dust Husk', 'en-dust-husk', 'Stage 1 (grey-blue tint in Stage 2)', 1.6, 300, 'a shambling sand mummy: a hunched humanoid made of packed sand wrapped in loose dusty linen strips, long dangling arms, two small glowing amber eye dots in a blank head, sand trickling from the joints.', 'shamble, lunge', { view: 'biped', rig: 'meshy then baked' }),
  E('EN02', 'Husk Runner', 'en-husk-runner', 'Stage 1 and 2', 1.4, 300, 'a lean fast sand mummy on all fours like a hound, linen strips flapping, a sharp face with a long jaw, amber eye dots.', 'sprint, leap'),
  E('EN03', 'Glass Seer', 'en-glass-seer', 'Stage 1 (gilded in Stage 3)', 1.5, 250, 'a floating creature made of a big glass lens orb held in a cage of bronze ribs, small tattered cloth skirt underneath, the lens glowing red when it aims.', 'float, aim (0.8 s red line), fire, recoil', { rig: 'bend' }),
  E('EN04', 'Ram Golem', 'en-ram-golem', 'Stage 1 (gilded in Stage 3)', 1.8, 400, 'a stocky sandstone golem with a huge ram skull carved as its head, curled stone horns, tiny legs and big front fists, cracks glowing orange when it charges.', 'plod, paw-scrape wind-up, rush loop, crash stun'),
  E('EN05', 'Sand Bloat', 'en-sand-bloat', 'Stage 1', 1.3, 250, 'a round swollen sack creature of stitched leather filled with sand, stubby legs, a tied-off top knot, glowing seams that blink faster before it pops.', 'waddle, swell (blinking glow), pop'),
  E('EN06', 'Tomb Scarab', 'en-tomb-scarab', 'Stage 1', 0.6, 150, 'a chunky flying beetle with a teal-and-bronze shell, two small buzzing wings, a horn on its head.', 'flap, dive, bank'),
  E('EN07', 'Overtime Hunter', 'en-overtime-hunter', 'Overtime only', 1.9, 450, 'a tall thin hunter made of black stone with a long hourglass for a body, gold sand running inside it, long scythe-like arms, a crown of broken clock hands.', 'glide, scythe swipe, blink step', { view: 'biped' }),
  E('EN08', 'Chain Wight', 'en-chain-wight', 'Stage 2', 1.7, 350, 'a floating ghostly jailer in grey rags, no legs, long iron chain wrapped round its arms ending in a hook, a lantern-like ribcage glowing teal.', 'float, throw, latch loop, snap'),
  E('EN09', 'Lantern Keeper', 'en-lantern-keeper', 'Stage 2', 1.2, 300, 'a small hunched crypt goblin-like keeper with a huge iron lantern on a pole bigger than itself, teal flame, a hooded cloak, long nose, scared expression.', 'hobble, ward pulse, flee', { view: 'biped' }),
  E('EN10', 'Seal Moth', 'en-seal-moth', 'Stage 2', 0.7, 120, 'a fat fuzzy moth with dusty grey wings marked with a simple round seal pattern, feathery antennae.', 'flutter, dim pulse'),
  E('EN11', 'Ossuary Crawler', 'en-ossuary-crawler', 'Stage 2', 1, 300, 'a spider-like crawler made of stacked cartoon bones with a round skull body and six bony legs.', 'wall crawl, drop, land'),
  E('EN12', 'Gilded Hound', 'en-gilded-hound', 'Stage 3', 1.2, 350, 'a lean jackal-like hound made of gold-plated stone segments, a long snout, tall ears, violet gem eyes, a crack glowing violet down its spine.', 'prowl, crouch-glow, gap leap, land'),
  E('EN13', 'Card Wraith', 'en-card-wraith', 'Stage 3', 1.6, 250, 'a floating wraith made of a swirl of loose violet and gold playing cards forming a hooded body and two arms, no face, just dark inside the hood.', 'drift, vanish into a card, reappear', { rig: 'bend' }),
  E('EN14', 'Throne Bowman', 'en-throne-bowman', 'Stage 3', 1.7, 400, 'a basalt statue archer come to life, crimson cloth sash, a gold longbow, a plain crowned helmet with a dark visor slit.', 'draw, lob, reload', { view: 'biped' }),
  E('EN15', 'Coin Thief Scarab', 'en-coin-scarab', 'Stage 3', 0.6, 150, 'a fast gold beetle carrying a sack of coins on its back, little legs blurring.', 'steal-dart, flee, coin burst'),
  E('EN16', 'Abyss Hand', 'en-abyss-hand', 'Stage 3', 2, 200, 'a giant hand made of dark gold sand rising from the ground, long fingers, a few coins stuck in it.', 'bubble, grab, drag, retreat', { rig: 'bend' }),
  E('EN18', 'Toll Shade', 'en-toll-shade', 'every stage when the clock runs out', 3, 300, 'a tall thin hooded ghost in a long violet-black robe that fades into smoke at the bottom, no face inside the hood except two cold white lights, a large bronze hand bell held in long pale fingers, a rope of small bells round its waist.', 'glide (never stops), bell ring, reach', { rig: 'bend', where: 'unkillable: rises when a stage clock hits 0:00 and pushes you into the Descent' }),
  E('EN17', 'Arbiter\'s stone beast', 'en-stone-beast', 'Stone Arbiter fight', 3, 600, 'a charging bull-like beast carved from a single stone card, flat body, card-frame carving on its sides, short thick horns.', 'charge down a lane, crash'),
];

const B = (code, name, file, kind, h, tris, subj, clips, x = {}) => C(code, name, file, { style: 'boss', view: x.view || 'beast', kind, h, tris, subj, anim: clips, rig: x.rig || 'parts', ...x });
export const BOSSES = [
  B('EL01', 'Grave Herald', 'el-grave-herald', 'elite, Stage 1 1:45', 3, 1100, 'a tall thin husk priest in long dusty robes and a stack of linen wraps, a tall pointed headdress made of stacked stone cards, holding a big bronze hand bell, amber eye dots.', 'rise with bell, idle sway, bell lift (tell), ring (calls 12 husks), walk, death', { view: 'biped', rig: 'meshy', where: 'Stage 1 elite' }),
  B('EL02', 'Chainbound Jailer', 'el-chain-jailer', 'elite, Stage 2 1:45', 3.4, 1300, 'a hulking crypt jailer in rusted iron armour plates, a bucket-like helmet with one glowing teal slit, a huge ring of keys on the belt, a long chain with a hook wrapped round one arm.', 'drag-in entrance, walk, chain glow (tell), hook throw, pull, death', { view: 'biped', rig: 'meshy', where: 'Stage 2 elite' }),
  B('EL03', 'Royal Executioner', 'el-executioner', 'elite, Stage 3 2:00', 3.6, 1400, 'a massive executioner of basalt and gold with a crimson hood, bare stone arms, a giant crescent axe.', 'drop from above, walk, axe rise (red glint tell), overhead slam, recover, death', { view: 'biped', rig: 'meshy', where: 'Stage 3 elite' }),
  B('TB01', 'Sealed Warden', 'tb-sealed-warden', 'timed boss A, Stage 1', 6.1, 2200, 'a tall stone knight-guardian with a tower shield shaped like a giant stone card covering its front, a carved round face plate with a glowing amber slit, a short heavy mace, exposed glowing core on its back where the armour opens.', 'break out of a stone card, idle, walk, shield glint (tell), slam, turn, exposed-back stagger, death into cards', { view: 'biped', rig: 'meshy', parts: 'body, shield' }),
  B('TB02', 'Twin Jackal Idols', 'tb-jackal-idol', 'timed boss B, Stage 1 (two copies)', 5.4, 1800, 'a huge stone hound statue standing on four legs, with tall ears and a long snout, sandstone body with gold collar plates, violet gem eyes, a crack down its chest; one copy painted with teal trim, the other with crimson trim.', 'hop off plinth, prowl, bite lunge, howl, tether glow, revive (cracks seal), death', { parts: 'body, jaw, tail' }),
  B('TB03', 'Coffin Sentinels', 'tb-coffin-sentinel', 'timed boss A, Stage 2 (four copies)', 5, 1200, 'a standing stone sarcophagus with stubby legs and two short arms, a lid carved as a sleeping face, iron bands; the lid can crack and glow gold.', 'stand up, shuffle, shield beam, gold-lid glow (tell), slam, death', { parts: 'body, lid' }),
  B('TB04', 'Mirror Duelist', 'tb-mirror-duelist', 'timed boss B, Stage 2', 5.4, 2200, 'a tall hooded rival duelist made of dark mirror glass, long coat, card belt, a featureless reflective face inside the hood, violet edges.', 'flip in from a card, idle, card throw, raise card (tell), summon shade, death', { view: 'biped', rig: 'meshy' }),
  B('TB05', 'Court of Three Masks', 'tb-mask', 'timed boss A, Stage 3 (three copies)', 4, 600, 'a giant floating theatre mask of gold and basalt with ribbons trailing behind, one large eye hole that can open to show a violet glow or close as a carved lid; three versions: smiling, frowning, blank.', 'assemble, orbit, eye open (tell), orb fire, eye close, shatter', { rig: 'bend', parts: 'mask, eyelid' }),
  B('TB06', 'The Hollow Heir', 'tb-hollow-heir', 'timed boss B, Stage 3', 5.4, 2400, 'a young crowned rival duelist in a long crimson and gold coat, a gold crown too big for the head, pale face with a calm smile, a card fan in one hand, shadow smoke at the coat hem.', 'walk out of mist, idle, arm flourish (tell), set trap card, summon shades, death', { view: 'biped', rig: 'meshy' }),
  B('GB01', 'The Stone Arbiter', 'gb-stone-arbiter', 'gate boss, Stage 1: it wakes at the gate and fights the duelist on open sand', 12, 3800, 'a colossal standing stone judge built from big dark grey-brown stone blocks held together with bronze bands, a tall square head with a flat carved face and two small amber eyes, a heavy mantle of stacked stone plates over the shoulders with crimson cloth hanging beneath, a broad flat stone plaque with a carved card frame (no symbols) on its chest, a huge stone gavel-staff held in its right hand.', 'rise from the gate seal, intro (name card slam), idle, heavy walk, gavel slam, shockwave ring, card flip (the game adds the two floating stone cards that circle it), phase roar, stagger, Toll Bell enrage, death into cards', { view: 'biped', rig: 'meshy', where: 'Stage 1 gate boss, about 7 times the duelist\'s height' }),
  B('GB02', 'The Seal Weaver', 'gb-seal-weaver', 'gate boss, Stage 2', 15, 4500, 'a giant jailer-spider: a round iron-plated body with seven round seal plates on its back, eight long jointed legs ending in iron hooks, a small hooded head with a teal glowing lantern face, chains hanging from its body.', 'intro, idle, walk, chain weave, seal glow, cage drop, wall climb, web bolt, phase roar, death', { parts: 'body, leg (we copy it 8 times), seal plates' }),
  B('GB03', 'The Hollow King', 'gb-hollow-king', 'gate boss, Stage 3', 18, 5000, 'a colossal hollow king: a huge crowned figure in a crimson and gold royal robe, the inside of the robe and hood is empty darkness with two violet lights for eyes, giant gauntleted hands, a long gold blade, a cape of falling gold sand.', 'intro on the throne, rise, idle, blade arc, summon husks, set traps, sand rise, echo moves, phase roar, death', { view: 'biped', rig: 'meshy', parts: 'body, blade, crown' }),
];

export const NPCS = [
  C('NP01', 'The Broker', 'npc-broker', { style: 'person', view: 'biped', tris: 1200, h: 1.7, rig: 'meshy', where: 'shop in every stage, Shop menu', subj: 'a cheerful round travelling merchant with a huge backpack of jars, cards and pots, a wide straw hat with a feather, a striped scarf, a big curly moustache, a coin pouch on the belt.', anim: 'idle bounce, wave, coin flip, thank-you bow' }),
  C('NP02', 'The Forge Keeper', 'npc-forge-keeper', { style: 'person', view: 'biped', tris: 1200, h: 1.9, rig: 'meshy', where: 'beside the Anvil shrine; upgrade menu', subj: 'a broad bald blacksmith with a braided black beard, a leather apron over bare arms, soot smudges, a big hammer on the shoulder.', anim: 'idle, hammer strike, nod' }),
  C('NP03', 'The Oath Keeper', 'npc-oath-keeper', { style: 'person', view: 'biped', tris: 1200, h: 1.8, rig: 'meshy', where: 'Oaths screen before a run', subj: 'a tall solemn keeper in grey and gold robes with a hood, a long white beard, holding a thick book bound with a crimson ribbon and wax seal.', anim: 'idle, open book, accept nod' }),
];
