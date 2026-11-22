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
  D('CH05', 'Practice Duelist', 'duelist-practice', 'a wooden training dummy come to life: a jointed wooden mannequin with a round head with a painted simple smile, a straw-stuffed tunic, a cardboard card holster, rope belt.', [], { where: 'tutorial and Quick Duel stand-in; also the training dummy in menus' }),
];

// ---------------------------------------------------------------- summons (each has three forms: 0.5x, 1x, 2x)
const SUMMON_CLIPS = 'rise from the floor card, idle hover or stance, follow-move (walk or fly), attack (see attack), hurt, level-up sparkle, form-change burst, Tribute dissolve, Graveyard exit';
const M = (code, name, file, element, attack, forms, x = {}) => C(code, name, file, { style: 'creature', view: 'beast', element, attack, forms, rig: 'parts', anim: SUMMON_CLIPS, where: 'summoned monster, Card Library, offer cards', ...x });

export const SUMMONS = [
  M('SM01', 'Cinder Hatchling', 'mon-cinder-hatchling', 'fire', 'short fire breath cone', [
    ['a tiny round baby dragon with a huge head, stubby legs, tiny useless wings, a cracked eggshell still on its head like a hat, ember-orange body with a cream belly, little smoke puffs from the nose', 450],
    ['a chubby young dragon with a big head, short horns, small wings, glowing lava cracks on its back and tail tip, ember-orange with a cream belly', 600],
    ['a stocky teenage dragon with a big jaw, curved horns, stubby but proud wings, lava-glow belly plates, ember-orange and charcoal', 900],
  ], { state: 'have', have: 'Emberhorn Drake model is in game as form 2', parts: 'body, left wing (we mirror it), tail, jaw if possible' }),
  M('SM02', 'Ember Wyvern', 'mon-ember-wyvern', 'fire', 'swooping fireball lob', [
    ['a small round wyvern chick with huge wing-arms, big eyes, a short tail with a flame tuft, crimson and gold', 450],
    ['a lean young wyvern with wing-arms, a crest of flame-shaped spines, crimson with gold belly', 750],
    ['a big proud wyvern with wide wing-arms, a long tail ending in a flame tuft, crimson scales with gold edges, fire glowing in the throat', 1200],
  ], { state: 'have', have: 'Crimson Sky Tyrant model is in game as form 3', parts: 'body, left wing, tail' }),
  M('SM03', 'Sigil Familiar', 'mon-sigil-familiar', 'light', 'orbiting sigil bolts', [
    ['a tiny floating round owl-like spirit made of a paper-white body and two small paper wings, a glowing gold ring floating above its head', 400],
    ['a round floating owl spirit with folded-paper wings and tail, two gold rings orbiting it', 600],
    ['a large floating owl spirit with wide folded-paper wings, a crest of paper feathers and three gold rings orbiting it', 1000],
  ], { parts: 'body, left wing, rings (built in code)' }),
  M('SM04', 'Frost Lynx', 'mon-frost-lynx', 'ice', 'pouncing slash that slows', [
    ['a fluffy round ice-blue lynx kitten with huge ear tufts, big paws and frosty white cheeks', 450],
    ['a young lynx with tall ear tufts tipped with ice crystals, pale blue fur in chunky faceted tufts, a stubby tail', 700],
    ['a big armoured lynx with ice crystal plates growing along its back and shoulders, frost mane, glowing pale cyan eyes', 1100],
  ], { parts: 'body, tail; legs bent in code' }),
  M('SM05', 'Rime Sprite', 'mon-rime-sprite', 'ice', 'freezing burst around itself', [
    ['a tiny floating snowball creature with a happy face, two twig arms and a little ice-crystal crown', 350],
    ['a floating snowman-like sprite made of three snow lumps, icicle hair, two ice-crystal wings', 550],
    ['a large floating frost spirit made of stacked snow lumps wrapped in a ring of orbiting ice shards, an icicle crown', 900],
  ], { parts: 'body, wings; shards built in code' }),
  M('SM06', 'Hollow Shade', 'mon-hollow-shade', 'dark', 'curse touch that spreads on death', [
    ['a small round floating ghost blob in violet-black with a white mask-like face with two hollow eye holes and a sheet-like tail', 350],
    ['a floating ghost in tattered violet-black cloth with long floppy sleeve arms and a white smiling mask face', 550],
    ['a large ghost with a hooded tattered cloak, long clawed sleeve arms trailing smoke, a cracked white mask face, small violet flames floating round it', 900],
  ], { parts: 'body; cloth tail waved in code' }),
  M('SM07', 'Rune Apprentice', 'mon-rune-apprentice', 'light', 'rune bolt', [], { state: 'roster', note: 'Your rule: this is a person, not a monster. It stays a stand-in until the creature roster is done.' }),
  M('SM08', 'Cinder Penitent', 'mon-cinder-penitent', 'fire', 'burning chain sweep', [], { state: 'roster', note: 'A robed person today. Waiting on the creature roster.' }),
  M('SM09', 'Lantern Acolyte', 'mon-lantern-acolyte', 'light', 'healing lantern pulse', [], { state: 'roster', note: 'A robed person today. Waiting on the creature roster.' }),
];

const F = (code, name, file, element, attack, recipe, subj, tris, h, x = {}) => C(code, name, file, { style: 'creature', view: 'beast', element, attack, recipe, subj, tris, h, rig: 'parts', anim: 'Fusion unfold (merge vortex, card flip, creature unfolds), idle, follow-move, attacks, roar, hurt, form change, God ascent at the Final Altar', where: 'Fusion summon, Card Library, Fusion banner', ...x });
export const FUSIONS = [
  F('FU01', 'Twinflare Tyrant', 'fus-twinflare-tyrant', 'fire', 'twin fire breath lines', 'Ember Wyvern + Cinder Hatchling', 'a two-headed dragon, heavy chunky body, two long necks with different heads (one sleek wyvern head, one stubby horned head), wide bat wings, lava-glow cracks along the belly, crimson and ember-orange scales.', 1600, 4.5, { state: 'have', parts: 'body, left wing, tail, each neck' }),
  F('FU02', 'Hoarfrost Colossus', 'fus-hoarfrost-colossus', 'ice', 'ground slam that freezes a ring', 'Frost Lynx + Rime Sprite', 'a huge gentle ice golem with a round snowy body, a cat-like face with lynx ear tufts made of ice, giant ice-crystal fists, glacier plates on the shoulders, a frost mane.', 1800, 5.4, { parts: 'body, left arm, right arm' }),
  F('FU03', 'Stormcrown Drake', 'fus-stormcrown-drake', 'lightning', 'chain lightning from its crown', 'any fire dragon + a lightning monster (recipe set in the roster)', 'a sleek four-legged drake with a crown of jagged yellow crystal horns crackling with lightning, slate-blue scales with yellow zigzag stripes, wide feathered-looking wings made of faceted plates.', 1800, 4.5, { parts: 'body, left wing, tail', state: 'roster-ok' }),
  F('FU04', 'Gloam Herald', 'fus-gloam-herald', 'dark', 'bell toll that curses a wide ring', 'Hollow Shade + a bell creature (roster)', 'a giant bat-like creature with a body shaped like a bronze bell, wide tattered violet wings, a small white mask face on the front of the bell, glowing violet clapper hanging inside.', 1700, 4, { parts: 'body, left wing, clapper', state: 'roster-ok' }),
];

export const GODS = [
  F('GO01', 'Thermal Sovereign', 'god-thermal-sovereign', 'fire', 'sun breath that sweeps the screen', 'two fire Fusions', 'a colossal sun dragon coiled upright like a serpent, a halo of floating flame plates behind its head, gold and white-hot scales with molten cracks, four small arms, wings made of fire-shaped gold blades.', 3200, 7.2, { parts: 'body, halo, left wing', where: 'God Fusion at the Final Altar' }),
  F('GO02', 'Rimelight Seraph', 'god-rimelight-seraph', 'ice', 'falling crystal lances', 'two ice Fusions', 'a colossal crystal moth-dragon with six wide translucent ice-crystal wings in three pairs, a long gentle face, a body of pale blue faceted crystal with a white glowing core, feathery frost antennae.', 3000, 7.2, { parts: 'body, left wing x3', where: 'God Fusion at the Final Altar' }),
  F('GO03', 'Eventide Arcanum', 'god-eventide-arcanum', 'dark', 'night tide that drags enemies in', 'two dark Fusions', 'a colossal cosmic whale-serpent floating in the air, deep indigo body speckled with star dots, a long finned tail, a crescent-moon horn, slow drifting fins, glowing violet underbelly.', 3200, 7.2, { parts: 'body, tail, left fin', where: 'God Fusion at the Final Altar' }),
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
  E('EN17', 'Arbiter\'s stone beast', 'en-stone-beast', 'Stone Arbiter fight', 3, 600, 'a charging bull-like beast carved from a single stone card, flat body, card-frame carving on its sides, short thick horns.', 'charge down a lane, crash'),
];

const B = (code, name, file, kind, h, tris, subj, clips, x = {}) => C(code, name, file, { style: 'boss', view: x.view || 'beast', kind, h, tris, subj, anim: clips, rig: x.rig || 'parts', ...x });
export const BOSSES = [
  B('EL01', 'Grave Herald', 'el-grave-herald', 'elite, Stage 1 1:45', 3, 1100, 'a tall thin husk priest in long dusty robes and a stack of linen wraps, a tall pointed headdress made of stacked stone cards, holding a big bronze hand bell, amber eye dots.', 'rise with bell, idle sway, bell lift (tell), ring (calls 12 husks), walk, death', { view: 'biped', rig: 'meshy', where: 'Stage 1 elite' }),
  B('EL02', 'Chainbound Jailer', 'el-chain-jailer', 'elite, Stage 2 1:45', 3.4, 1300, 'a hulking crypt jailer in rusted iron armour plates, a bucket-like helmet with one glowing teal slit, a huge ring of keys on the belt, a long chain with a hook wrapped round one arm.', 'drag-in entrance, walk, chain glow (tell), hook throw, pull, death', { view: 'biped', rig: 'meshy', where: 'Stage 2 elite' }),
  B('EL03', 'Royal Executioner', 'el-executioner', 'elite, Stage 3 2:00', 3.6, 1400, 'a massive executioner of basalt and gold with a crimson hood, bare stone arms, a giant crescent axe.', 'drop from above, walk, axe rise (red glint tell), overhead slam, recover, death', { view: 'biped', rig: 'meshy', where: 'Stage 3 elite' }),
  B('TB01', 'Sealed Warden', 'tb-sealed-warden', 'timed boss A, Stage 1', 6.1, 2200, 'a tall stone knight-guardian with a tower shield shaped like a giant stone card covering its front, a carved round face plate with a glowing amber slit, a short heavy mace, exposed glowing core on its back where the armour opens.', 'break out of a stone card, idle, walk, shield glint (tell), slam, turn, exposed-back stagger, death into cards', { view: 'biped', rig: 'meshy', parts: 'body, shield' }),
  B('TB02', 'Twin Jackal Idols', 'tb-jackal-idol', 'timed boss B, Stage 1 (two copies)', 5.4, 1800, 'a huge sitting stone hound statue with tall ears and a long snout, sandstone body with gold collar plates, violet gem eyes, a crack down its chest; one copy painted with teal trim, the other with crimson trim.', 'hop off plinth, prowl, bite lunge, howl, tether glow, revive (cracks seal), death', { parts: 'body, jaw, tail' }),
  B('TB03', 'Coffin Sentinels', 'tb-coffin-sentinel', 'timed boss A, Stage 2 (four copies)', 5, 1200, 'a standing stone sarcophagus with stubby legs and two short arms, a lid carved as a sleeping face, iron bands; the lid can crack and glow gold.', 'stand up, shuffle, shield beam, gold-lid glow (tell), slam, death', { parts: 'body, lid' }),
  B('TB04', 'Mirror Duelist', 'tb-mirror-duelist', 'timed boss B, Stage 2', 5.4, 2200, 'a tall hooded rival duelist made of dark mirror glass, long coat, card belt, a featureless reflective face inside the hood, violet edges.', 'flip in from a card, idle, card throw, raise card (tell), summon shade, death', { view: 'biped', rig: 'meshy' }),
  B('TB05', 'Court of Three Masks', 'tb-mask', 'timed boss A, Stage 3 (three copies)', 4, 600, 'a giant floating theatre mask of gold and basalt with ribbons trailing behind, one large eye hole that can open to show a violet glow or close as a carved lid; three versions: smiling, frowning, blank.', 'assemble, orbit, eye open (tell), orb fire, eye close, shatter', { rig: 'bend', parts: 'mask, eyelid' }),
  B('TB06', 'The Hollow Heir', 'tb-hollow-heir', 'timed boss B, Stage 3', 5.4, 2400, 'a young crowned rival duelist in a long crimson and gold coat, a gold crown too big for the head, pale face with a calm smile, a card fan in one hand, shadow smoke at the coat hem.', 'walk out of mist, idle, arm flourish (tell), set trap card, summon shades, death', { view: 'biped', rig: 'meshy' }),
  B('GB01', 'The Stone Arbiter', 'gb-stone-arbiter', 'gate boss, Stage 1', 12, 3800, 'a colossal seated judge made of sandstone blocks, a tall square head with a flat carved face and glowing amber eyes, a judge\'s mantle of stone plates, holding a giant gavel-staff, two huge face-down stone cards floating at its sides.', 'intro (name card slam), idle, card flip (gong), gavel slam, shockwave ring, phase roar, stagger, Toll Bell enrage, death into cards', { parts: 'body, arm with gavel, two cards' }),
  B('GB02', 'The Seal Weaver', 'gb-seal-weaver', 'gate boss, Stage 2', 15, 4500, 'a giant jailer-spider: a round iron-plated body with seven round seal plates on its back, eight long jointed legs ending in iron hooks, a small hooded head with a teal glowing lantern face, chains hanging from its body.', 'intro, idle, walk, chain weave, seal glow, cage drop, wall climb, web bolt, phase roar, death', { parts: 'body, leg (we copy it 8 times), seal plates' }),
  B('GB03', 'The Hollow King', 'gb-hollow-king', 'gate boss, Stage 3', 18, 5000, 'a colossal hollow king: a huge crowned figure in a crimson and gold royal robe, the inside of the robe and hood is empty darkness with two violet lights for eyes, giant gauntleted hands, a long gold blade, a cape of falling gold sand.', 'intro on the throne, rise, idle, blade arc, summon husks, set traps, sand rise, echo moves, phase roar, death', { view: 'biped', rig: 'meshy', parts: 'body, blade, crown' }),
];

export const NPCS = [
  C('NP01', 'The Broker', 'npc-broker', { style: 'person', view: 'biped', tris: 1200, h: 1.7, rig: 'meshy', where: 'shop in every stage, Shop menu', subj: 'a cheerful round travelling merchant with a huge backpack of jars, cards and pots, a wide straw hat with a feather, a striped scarf, a big curly moustache, a coin pouch on the belt.', anim: 'idle bounce, wave, coin flip, thank-you bow' }),
  C('NP02', 'The Forge Keeper', 'npc-forge-keeper', { style: 'person', view: 'biped', tris: 1200, h: 1.9, rig: 'meshy', where: 'beside the Anvil shrine; upgrade menu', subj: 'a broad bald blacksmith with a braided black beard, a leather apron over bare arms, soot smudges, a big hammer on the shoulder.', anim: 'idle, hammer strike, nod' }),
  C('NP03', 'The Oath Keeper', 'npc-oath-keeper', { style: 'person', view: 'biped', tris: 1200, h: 1.8, rig: 'meshy', where: 'Oaths screen before a run', subj: 'a tall solemn keeper in grey and gold robes with a hood, a long white beard, holding a thick book bound with a crimson ribbon and wax seal.', anim: 'idle, open book, accept nod' }),
];
