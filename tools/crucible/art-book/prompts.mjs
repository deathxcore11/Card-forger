// Every picture prompt for Lost Memories. Each prompt is complete on its own: paste one into the image tool and nothing else.
import { FIELD, SUBJECT, SHEETS } from './assets.mjs';

const BAN = 'Not allowed anywhere in the picture: text, letters, numbers, runes or writing of any kind; logos or watermarks; eye symbols, an eye inside a triangle, ankhs, jackal-headed figures, hieroglyphs, sphinxes, pharaoh headdresses or Egyptian broad collars; crosses on graves; chain-link fences; any character, creature, card or symbol from an existing game, show or film.';
const PAL = 'Palette only: near-black plum shadow, wine, dusty rose-brown, sandstone in three tones, aged gold, ember orange, rust red, and one small touch of dull verdigris green.';
const PLACE = 'Place: inside a huge stepped pyramid built long ago by an invented city of record-keepers. It is not Egyptian. Square pillars, stepped lintels, big worn sandstone blocks, bronze fittings gone green at the edges, shelves of blank clay tablets. The only carved decoration allowed is plain hammers, chain links, keys and laurel leaves.';

const ROOM_STYLE = `Style: a background plate from a 1997 32-bit console dungeon game. Painted by hand over a very simple 3D render: big flat planes, slightly soft edges, coarse grain and visible dither dots, as if stored at low resolution in only 256 colours. Not photo-real, not modern, no lens flare, no bloom, no glossy reflections.
Light: the room is dark. The only light is small warm flames and what they reach. Everything past the middle distance sinks into black fog. No daylight, no white light.
${PAL}
${PLACE}`;
const ROOM_CAM = 'Camera: straight on to the far wall, at chest height, perfectly level, a symmetrical one-point view like a stage set. The far wall is flat and faces the camera. The floor shows in the lower third and runs toward the camera.';
const ROOM_FRAME = 'Framing: a wide picture, 1536 by 1024. Keep everything that matters inside the middle horizontal band. The top fifth and the bottom fifth will be cut off, so put only dark ceiling and plain floor there.';
const room = (subject, empty, cam = ROOM_CAM) => `${subject}\n\n${cam}\n${ROOM_FRAME}\nLeave empty: ${empty} No people and no creatures anywhere.\n\n${ROOM_STYLE}\n\n${BAN}`;

const FACE_STYLE = (turn = 'looking across the frame toward the left') => `Style: late-1990s console RPG character portrait, pixel-painted, visible dither grain, many small tones, no flat vector fills. Thin uneven dark-brown outlines, never pure black. Warm forge light from below left, soft ember rim light. Background: deep plum (#2d121d) with drifting ochre smoke, never a flat colour. Palette only: deep plum, wine, rust red, sandstone, aged gold, ember orange, one small touch of dusty verdigris green.
Framing: square, 1024 by 1024, chest up, three-quarter turn, ${turn}. Two or three worn objects of the person's trade in frame.
This portrait is shown at 64 by 64 pixels, so keep the head large (about a third of the picture's height), the shapes big and simple, and the light side and dark side of the face clearly split.`;
const face = (subject, turn) => `${FACE_STYLE(turn)}\n\nSubject: ${subject}\n\n${BAN}`;

const PROP_STYLE = `Style: one prop from a 1997 32-bit console dungeon game, painted as a clean reference for a low-polygon 3D model. Built from big flat planes and chunky blocks. No thin wires, no fine filigree, no loose small parts. Hand-painted surfaces with coarse grain and visible dither; worn edges picked out lighter.
Light: flat and even, from the upper left. No shadow cast on the ground, no glow, no smoke, no sparks.
View: three-quarter view from slightly above. The whole object is inside the picture with a clear margin all round, nothing cropped, nothing else in the picture.
Background: one flat plain mid-grey (#6b6b6b).
Palette only: sandstone, dark iron, bronze gone green at the edges, aged gold, plum cloth, rust red, bone.`;
const prop = subject => `One object alone: ${subject}\n\n${PROP_STYLE}\n\n${BAN}`;

const STILL_STYLE = `Style: a story picture from a 1997 32-bit console role-playing game, the kind shown as a still between scenes. Painted by hand, coarse grain, visible dither dots, a 256-colour look, big simple shapes, strong split between light and dark. Not photo-real, no lens effects, no bloom.
${PAL}
Framing: a wide picture, 1536 by 1024. Keep everything that matters inside the middle horizontal band; the top fifth and bottom fifth will be cut off.`;
const still = subject => `${subject}\n\n${STILL_STYLE}\n\n${BAN}`;

const RIM = { G: 'gold rim', C: 'bronze rim', F: 'bone rim', M: 'six-sided' };
const MED_STYLE = n => `Style: relic icons from a 1997 32-bit console dungeon game. Hand-painted pixel look with coarse dither grain, hard light from the upper left, a dark line round every shape. Each medallion is a thick struck coin: a raised rim, a flat coloured field inside it, and ONE bold object in raised relief that fills most of the field.
Each one is shown at 32 by 32 pixels, so: one big simple shape per medallion, thick forms, strong contrast between the object and its field, no small details, no thin lines.
Rims: "gold rim" is a thick aged-gold rim with a few dents. "bronze rim" is a dark bronze rim with four round rivets. "bone rim" is a pale bone-white rim with a thin gold line inside it. "six-sided" means that medallion is a hexagon with a heavy gold rim, not a circle.
Layout: ${n} medallions on a flat pure black background, all the same size, evenly spaced, none touching, each seen exactly from the front and fully inside the picture. 1024 by 1024.`;

const P = [];
const add = (id, wave, name, how, make, game, where, file, text, tip = '') => P.push({ id, wave, name, how, make, game, where, file, text, tip });

// ---------------- Wave 1: the pictures that change the game the most
add('K1', 1, 'Title backdrop', 'pic', '1536 x 1024', '512 x 240, 256 colours', 'Behind the whole title screen.', 'key-title.png',
`A wide establishing picture for the title screen of a dungeon game.

Scene: the head of a broad stone stair that goes straight down into blackness, inside a vast stepped pyramid.
Centre: the stair mouth, a tall square opening under a stepped lintel. The steps go down into black fog, with a faint ember glow very far below.
Left third: one small figure seen from behind, standing at the top step. A smith in a long worn coat, a forging hammer hanging from the right hand, head slightly bowed. The figure is no taller than a quarter of the picture's height.
Either side of the stair mouth: a bronze wall bracket holding a torch. Paint the wall near each bracket warm, as if the torch is lit.
Right third: calm, dark, plain wall with almost no detail. A menu is laid over this part.
Top fifth: dark and empty. A logo is laid over this part.
Floor: big worn flagstones with sand drifted into the corners.

${ROOM_CAM}
${ROOM_FRAME}

${ROOM_STYLE}

${BAN}`, 'If the figure comes out large, ask for it again "half the size, further away". The right third must stay plain or the menu will be hard to read.');

add('K3', 1, 'Crest', 'pic', '1024 x 1024', '48 x 48 and 16 x 16, 16 colours', 'Boot card, title, card back, save marks. Turns in 3D on the title.', 'key-crest.png',
`An emblem struck in aged gold, alone on a flat pure black background.

The emblem: a forging hammer standing upright, head at the top, inside a closed ring of laurel leaves. The hammer has a heavy square head and a short thick handle, a bold T-like shape. The wreath has about ten large leaves on each side, meeting at the top and tied with a plain band at the bottom.
Exactly from the front, perfectly symmetrical left to right, centred, filling about four fifths of the picture.

Style: a struck metal badge from a 1997 32-bit console game. Hand-painted pixel look with coarse dither grain, hard light from the upper left, a bright edge on the upper left of every shape and a dark edge on the lower right, a few dents and scratches. Flat pure black behind it, nothing else.
This emblem is shown as small as 16 by 16 pixels, so the shapes must be thick and simple, with clear black gaps between the hammer and the wreath.
Colours only: aged gold in four tones from dark bronze-gold to pale highlight.

${BAN}`);

add('K2', 1, 'Logo', 'pic', '1536 x 1024', '192 x 64, 16 colours', 'Top of the title screen and the boot card.', 'key-logo.png',
`A game logo on a flat pure black background. This is the one picture that must contain words.

The words: LOST on the first line and MEMORIES on the second line, centred, both lines the same width. Spelling must be exactly L-O-S-T and M-E-M-O-R-I-E-S. No other words, letters or marks anywhere.

Lettering: wide Roman capitals with small sharp serifs, as if cut from aged gold plate with a chisel. Flat faces, a bright bevel on the upper left edge of every stroke, a dark bevel on the lower right, small chips and dents, coarse dither grain. Thick strokes with clear black gaps between letters.
Under MEMORIES: one thin gold rule the width of the word, with a small plain hammer shape at its centre.

Style: the title logo of a 1997 32-bit console dungeon game. Hand-painted pixel look, hard light from the upper left, no glow, no lens flare, no gradient background.
Colours only: aged gold in four tones, on pure black.

Apart from the two words, nothing else from this list is allowed: logos or watermarks; eye symbols, an eye inside a triangle, ankhs, jackal-headed figures, hieroglyphs, pharaoh headdresses; any symbol from an existing game, show or film.`, 'Picture tools often misspell. If two tries come out wrong, stop: I can set the logo from the game\'s own carved capitals.');

add('P16', 1, 'The Last One', 'pic', '1024 x 1024', '64 x 64 and 96 x 96, 256 colours', 'Behind the hidden door, and as the fifth Forger.', 'face-last-one.png',
face(`the last keeper of the pyramid, very old, still on duty long after everyone else left. Thin, straight-backed, calm, neither clearly a man nor a woman. Close-cropped white hair, deep-set tired eyes. A plain bone-grey cloak with the hood down. One hand holds a shallow dish with a single short candle stub, burning. A plain ring with exactly one key hangs at the chest. Cloth colour: bone grey.
Three things are different from every other portrait in the set, on purpose: this person looks straight at the viewer; the light is the candle, from below right, paler and colder than forge light; and the background is bare grey-plum stone with one empty shelf and almost no smoke.`, 'facing the viewer'),
'Who The Last One is has been your call since 21 November. This draws my default. Tell me if they should be someone else and I rewrite it.');

add('O7', 1, 'Duel table top', 'build', '1024 x 1024', '128 x 128, 256 colours', 'The top of the 3D table in every duel.', 'prop-table.png',
`The top of a stone gaming table, seen from exactly straight above, filling the whole square picture edge to edge.

The slab: pale worn sandstone. Round its edge runs a border band of carved chain links. A darker inlaid stone line runs across the middle from left to right and divides the slab into two equal halves. Each corner has a square boss of bronze gone green. Fine cracks, chipped edges, sand lying in the low places.
Leave both halves plain and empty. Card spaces are cut into it later.

View and light: straight down, no perspective at all, no tilt. Flat even light. No shadows from anything outside the picture. Nothing lying on the table.
Style: a hand-painted texture from a 1997 32-bit console dungeon game: coarse grain, visible dither dots, big simple shapes, a 256-colour look. Not photo-real.
Palette only: sandstone in three tones, dusty rose-brown in the inlaid line, bronze green at the corners, near-black plum in the cracks.

${BAN}`);

add('R13', 1, 'Forgers\' hall', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind Choose your Forger and the starter kit.', 'room-forgers.png',
room(`The hall above the stair, where a descent begins.
Far wall, centre: the square mouth of a stair going down, black inside, under a stepped lintel.
Left of the stair mouth: a cold forge built into the wall, its hearth full of grey ash.
Right of the stair mouth: a row of four bronze hooks set in the wall at head height, all four empty, with a worn stone bench under them.
Two bronze torch brackets with small flames, one at each end of the far wall.`, 'the middle of the floor and the middle of the picture in front of the stair mouth. A portrait and a window of words are laid over the left and centre.'));

add('R7', 1, 'Guardian hall', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind the table in every guardian duel.', 'room-guardian.png',
room(`A tall, cold hall where a floor's guardian waits.
Far wall, centre: a stone dais of three wide steps. On it, a heavy high-backed stone seat, empty. Behind the seat, a tall narrow niche filled with black.
Either side of the dais: one square pillar, and in front of each pillar a low bronze brazier with a small flame.
The side walls run back into black fog. The roof is lost in darkness.`, 'the whole floor from the foot of the dais to the camera. A duel table stands there later.'));

add('O10', 1, 'The Forger\'s hammer', 'build', '1024 x 1024', 'about 60 triangles, 64 x 64 texture', 'On the anvil, turning in menus, and as the cursor.', 'prop-hammer.png',
prop('a smith\'s forging hammer, lying at a slant with its head toward the upper right. A short thick wooden handle wrapped in rust-red cord for the lower half. A heavy square iron head, one face flat and one face a blunt wedge. A band of aged gold where the head meets the handle. The iron is dark and pitted, bright only on the striking face.'));

// ---------------- Wave 2: people and medallions
const RIVALS = [
  ['drake-tamer', 'The Drake Tamer', 'a weathered woman who breaks wild drakes to the saddle. Sun-lined face, hair bound back. A rust-red scarf. A thick leather gauntlet, scarred with claw marks, up to the elbow of the raised arm. A long hooked goad rests on one shoulder, and a single large shed scale hangs on a cord at the chest. Cloth colour: rust red.'],
  ['lantern-scholar', 'The Lantern Scholar', 'a thin old man who reads the tablets nobody else can find. A long sandstone-coloured robe. He holds a small brass lantern up close beside his face, which lights it. A bundle of blank clay tablets under the other arm, ink-black fingertips, and a polished crystal reading stone on a chain. Cloth colour: pale sandstone.'],
  ['gearwright', 'The Gearwright', 'a stocky woman who keeps the pyramid\'s old door mechanisms turning. A dull verdigris-green head wrap, a heavy leather apron. A large brass cog hangs on a thong round the neck, a long bronze turning key is held across the chest, and there is a smear of dark oil on one cheek. Cloth colour: dull verdigris green.'],
  ['crypt-keeper', 'The Crypt Keeper', 'a tall gaunt man who keeps the burial shelves. A living man with an ordinary thin face, not a skull. A wine-dark mantle with the hood half up. A ring of heavy iron keys in one hand, a snuffed candle on an iron spike in the other, pale stone dust on the shoulders. Cloth colour: dark wine.'],
  ['beastcaller', 'The Beastcaller', 'a broad young man who calls animals out of the dark. A dusty plum mantle with a rough fur collar over a sandstone tunic. A bone whistle on a cord at the lips or chest, a coiled leather leash over one shoulder, three old claw scars along the forearm. Cloth colour: dusty plum.'],
  ['tidewatcher', 'The Tidewatcher', 'a woman with a long grey braid who measures the water under the pyramid. A stiff ochre-gold oilcloth hood and cape. A tall brass rod with notches cut along it held upright in one hand, a glass net float in a rope net hanging from the belt, salt-white staining on the cape. Cloth colour: ochre gold.'],
  ['cinder-monk', 'The Cinder Monk', 'a lean monk with a shaved head who tends fires that must never go out. An ash-grey wrap with an ember-orange sash across the chest. A small clay ember pot hangs on a chain from one hand with a dull orange glow inside. A stripe of grey ash across the brow, old burn scars on the hands. Cloth colour: ember orange.'],
  ['oathblade', 'The Oathblade', 'a stern woman who swore to hold one door and has never left it. Worn bronze scale armour under a bone-white tabard with a gold border. Both hands rest on the hilt of a broad plain sword standing point down in front of her. A cord tied in many knots is wound round the hilt, one knot for each vow. One shoulder plate is deeply notched. Cloth colour: bone white.'],
];
for (const [slug, name, subject] of RIVALS) add('P14-' + slug, 2, name, 'pic', '1024 x 1024', '64 x 64, 256 colours', 'On the right pillar whenever you duel them.', `face-${slug}.png`, face(subject));

const medLine = id => {
  if (id === 'memory') return 'no rim: a plain round clay token with one thumbprint pressed into its centre, pale sandstone colour';
  const r = RELICS[id]; const f = FIELD[r.family];
  return `${RIM[r.kind]}, ${f[1]} field: ${SUBJECT[id]}`;
};
let RELICS = {};
export function buildPrompts(relics) {
  RELICS = Object.fromEntries(relics.map(r => [r.id, r]));
  const out = P.filter(p => p.wave < 2 || p.id.startsWith('P14'));
  for (const s of SHEETS) {
    const g = s.grid || 3, rows = g === 3 ? ['Top row', 'Middle row', 'Bottom row'] : ['Top row', 'Bottom row'];
    const lines = rows.map((nm, ri) => `${nm}, left to right:\n` + s.ids.slice(ri * g, ri * g + g).map((id, i) => `${ri * g + i + 1}. ${medLine(id)}.`).join('\n')).join('\n');
    out.push({ id: 'M-' + s.id, wave: 2, name: `Medallion sheet ${s.id.slice(1)}: ${s.name}`, how: 'pic', make: '1024 x 1024', game: '32 x 32 and 24 x 24 each, 16 colours', where: 'Relic slots, Gift and reward screens, the Relics page.',
      file: `medals-${s.id.toLowerCase()}.png`, items: s.ids,
      text: `${g === 3 ? 'Nine struck medallions in a 3 by 3 grid' : 'Four struck medallions in a 2 by 2 grid'}.\n\n${MED_STYLE(g === 3 ? 'Nine' : 'Four')}\n\n${lines}\n\n${BAN}`,
      tip: 'I cut the sheet into single medallions myself. If one of them is wrong and the rest are good, do not redo the sheet: use the single medallion prompt for that one.' });
  }
  out.push({ id: 'M-one', wave: 2, name: 'Single medallion (to redo one)', how: 'pic', make: '1024 x 1024', game: '32 x 32 and 24 x 24, 16 colours', where: 'Replaces one medallion from a sheet.', file: 'relic-<name>.png',
    text: `One struck medallion, centred, filling about four fifths of the picture.\n\n${MED_STYLE('One')}\n\nThe medallion: [PASTE THE LINE FOR THAT MEDALLION FROM ITS SHEET HERE].\n\n${BAN}`,
    tip: 'Copy this, then replace the part in square brackets with that medallion\'s line from its sheet.' });
  return out.concat(P.filter(p => p.wave > 2));
}

// ---------------- Wave 3: rooms and the things in them
add('R8', 3, 'Sanctum', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind the shrine in a Sanctum.', 'room-sanctum.png',
room(`A small quiet room, the cleanest place in the pyramid.
Far wall, centre: one arched niche at chest height with a stone ledge, empty, lit softly from inside by a warm glow.
A band of carved laurel leaves runs along the far wall at head height.
Along the foot of the far wall: a shallow stone channel of still, dark water.
The stone here is smooth and pale and unbroken. There is no fog in this room and no torch: the glow of the niche is the only light.`, 'the middle of the floor. A small shrine stands there later.'));

add('R9', 3, 'Forge room', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind the anvil.', 'room-forge.png',
room(`A working forge deep in the pyramid.
Far wall, centre: a wide low forge mouth, an arch full of glowing coals. It is the main light in the room and it is ember orange.
Left of it: tongs and hammers hanging in a row on the wall.
Right of it: a stone quenching trough and a stack of iron bars.
Soot blackens the wall above the forge mouth in a wide fan.`, 'the middle of the floor. An anvil stands there later.'));

add('R10', 3, 'Bazaar corner', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind the Winnower\'s stall.', 'room-bazaar.png',
room(`A forgotten corner of the pyramid that a trader has made his own.
The corner where two walls meet stands a little right of centre.
Ropes are strung between the two walls, hung with strips of old cloth in plum and rust.
Against the left wall: a few clay jars and one wooden crate.
One bronze lamp hangs from a rope and is the only light.`, 'the middle of the floor in front of the corner. A market stall stands there later.',
'Camera: at chest height, perfectly level, looking into the corner. The two walls run back to the corner; the floor shows in the lower third and runs toward the camera.'));

add('R11', 3, 'Omen room', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind the Omen bowl.', 'room-omen.png',
room(`A round, low room for reading smoke.
The curved far wall is black with soot. A ring of low stone seats runs round it.
In the roof, a round smoke hole. A shaft of pale dusty light falls through it to the middle of the floor. This is the one room where a cold light is allowed.
No torches. The rest of the room is nearly black.`, 'the middle of the floor under the smoke hole. A stone bowl stands there later.'));

add('R12', 3, 'Treasure vault', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind Gifts, rewards and card picks.', 'room-vault.png',
room(`A store room of records and relics.
The far wall and both side walls are lined from floor to roof with stone shelves. The shelves are packed with sealed clay tablets, with a few small bronze caskets among them.
A wooden ladder leans on the shelves at the left.
One bronze lamp hangs from the roof in the centre and is the only light. The upper shelves fade into darkness.`, 'the whole floor. Stone pedestals and a chest stand there later.'));

add('R14', 3, 'The bare room', 'pic', '1536 x 1024', '352 x 144, 256 colours', 'Behind the hidden door and behind The Last One.', 'room-bare.png',
room(`A room where nothing was ever recorded.
Every wall is perfectly smooth and blank: no carving, no fittings, no shelves but one.
Far wall, centre, at chest height: a single empty stone shelf.
This room is colder and greyer than anywhere else in the pyramid: grey-plum stone, almost no gold, no orange.
The only light comes from low on the right, from outside the picture, as if from one candle. Long soft shadows. Thick black fog in the corners.`, 'everything. This room must feel empty. A duel table stands in the middle later.'));

add('O2', 3, 'Anvil', 'build', '1024 x 1024', 'about 80 triangles, 64 x 64 texture', 'The Anvil room.', 'prop-anvil.png',
prop('a blacksmith\'s anvil standing on a square block of sandstone. The anvil is dark pitted iron with a flat top worn bright, one short horn, and a thick waist. One band of bronze gone green binds the stone block. Nothing lying on the anvil.'));
add('O3', 3, 'The Winnower\'s stall', 'build', '1024 x 1024', 'about 120 triangles, 64 x 64 texture', 'The Bazaar.', 'prop-stall.png',
prop('a small market stall. Two thick square wooden posts hold a sagging cloth roof in wide stripes of rust red and bone. Between the posts, a plain wooden counter covered with a plum cloth that hangs down the front. Nothing on the counter. No trader.'));
add('O4', 3, 'Shrine', 'build', '1024 x 1024', 'about 80 triangles, 64 x 64 texture', 'The Sanctum.', 'prop-shrine.png',
prop('a small stone shrine, waist high. A square sandstone plinth with a shallow round basin cut into its top, and behind the basin a low stone back-piece carved with one wreath of laurel leaves. One unlit candle stands on the rim of the basin. The basin is empty.'));
add('O5', 3, 'Chest', 'build', '1024 x 1024', 'about 60 triangles, 64 x 64 texture', 'Treasure rooms.', 'prop-chest.png',
prop('a heavy storage chest with its lid closed. Dark wooden planks, three wide bands of bronze gone green, a flat lid, a big square bronze lock plate on the front with a plain keyhole, a ring handle on each end.'));
add('O6', 3, 'Omen bowl', 'build', '1024 x 1024', 'about 90 triangles, 64 x 64 texture', 'The Omen room.', 'prop-bowl.png',
prop('a wide, shallow stone bowl standing on three short, thick bronze legs. The bowl is pale sandstone, black with soot inside, with a thick plain rim. The legs are bronze gone green and end in plain square feet. The bowl is empty.'));

add('U4', 3, 'Materials sheet', 'pic', '1024 x 1024', '64 x 64 a material, 16 colours', 'The stone frame, plaques and the surfaces of the 3D things. Optional: the game has drawn stand-ins for all nine.', 'ui-materials.png',
`Nine square material swatches in a 3 by 3 grid, separated by thin flat black lines. Each swatch fills its square edge to edge and is seen from exactly straight on, with flat even light and no perspective. No objects, only surfaces.

Top row, left to right:
1. Pale sandstone blocks, large, with thin dark joints.
2. Mid-brown sandstone, one unbroken slab, pitted and scratched.
3. Dark worn stone, almost black plum, with fine cracks.
Middle row:
4. Hammered aged gold plate with dents.
5. Bronze gone green, patchy.
6. Dark pitted iron.
Bottom row:
7. Plum woven cloth, coarse weave.
8. Rust-red leather, creased.
9. Old bone, pale, with fine grain.

Style: hand-painted textures from a 1997 32-bit console dungeon game: coarse grain, visible dither dots, a 16-colour look in each swatch, big simple marks, nothing photo-real. Each swatch should look the same from edge to edge, with no feature in the middle, so it can be repeated side by side.

${BAN}`);

// ---------------- Wave 4: story pictures
add('X1', 4, 'The city above', 'pic', '1536 x 1024', '312 x 128, 256 colours', 'The first descent.', 'story-city.png',
still('A city of pale sandstone at dusk. Flat-roofed houses step up a hillside, with small warm lamps lit in a few windows. Behind and above everything stands a vast stepped pyramid, black against a rust and plum sky. No sun and no moon. In the foreground, one thin line of smoke rises from a forge chimney. No people.'));
add('X2', 4, 'Vessa and the seal', 'pic', '1536 x 1024', '312 x 128, 256 colours', 'When the story reaches the seal.', 'story-vessa.png',
still('A broad-shouldered woman smith seen from the side, in a leather apron, grey-streaked hair tied back, bringing a hammer down on a huge round bronze seal. The seal is taller than she is and lies tilted on a stone cradle. Its face is plain rings and chain links, with no writing and no eye. A burst of sparks at the hammer. Forge glow from the left; the rest of the workshop is black.'));
add('X3', 4, 'Oren at the gate', 'pic', '1536 x 1024', '312 x 128, 256 colours', 'When the story reaches the gate.', 'story-oren.png',
still('A gaunt man seen from behind, his shoulder against one leaf of a tall bronze gate, pushing it shut. Through the narrowing gap: darkness, and far off in it a scatter of small lantern lights. On the floor behind him lies a dropped clay tablet with its surface smeared blank. One lamp on the floor behind him throws his long shadow up the gate.'));
add('X4', 4, 'The forge at the bottom', 'pic', '1536 x 1024', '312 x 128, 256 colours', 'When the pyramid is cleared.', 'story-forge.png',
still('A vast dark chamber at the very bottom of the pyramid. In its centre stands a great forge as big as a house, built of black stone, its hearth long dead. On the anvil in front of it, one small ember still glows, the only light. Shelves of clay tablets run away into darkness on both sides. No people.'));
add('X5', 4, 'The lamp on the stair', 'pic', '1536 x 1024', '312 x 128, 256 colours', 'When a run ends.', 'story-lamp.png',
still('An empty stone stair seen from above, going down into blackness. On one step stands a small bronze oil lamp, still burning. Beside it lies a forging hammer, left behind. The lamp lights three or four steps and nothing more. No people.'));

// ---------------- Wave 5: the 3D tool test
add('G1', 5, 'The keeper statue', 'tool', '1024 x 1024', 'about 400 triangles, 64 x 64 texture', 'Either side of the guardian door, if the test works.', 'model-keeper.glb',
`One statue alone, for turning into a 3D model.

The statue: a hooded keeper, standing, carved from one block of pale sandstone. Both hands rest on the head of a long-handled hammer that stands upright on the ground in front of the figure. A heavy plain robe falling in a few big folds. The face is deep in the hood, with plain carved features. It stands on a low square plinth. Chipped edges, a crack across one shoulder.
The shape must be solid and compact: arms against the body, no gaps between the arms and the body, no thin parts, nothing sticking out.

View: the whole statue from head to plinth, seen from the front and slightly to one side, standing straight, centred, with a clear margin all round.
Light: flat and even. No shadow on the ground, no glow.
Background: one flat plain mid-grey (#6b6b6b), nothing else in the picture.
Style: a hand-painted stone prop from a 1997 32-bit console dungeon game: big flat planes, coarse grain, simple shapes.
Colours only: sandstone in three tones.

${BAN}`, 'Make this picture in ChatGPT, upload it to the picture-to-3D tool on your free credits, download the model as a GLB file and send it to me. Send the picture as well. One model is enough to decide.');

export const HOW = { pic: 'Used as it is (2D)', build: 'I build the 3D from it', tool: 'Goes through the 3D tool' };
export const WAVES = [
  [1, 'First', 'The eight pictures that change the game the most: the title, the crest, the logo, The Last One, the duel table, two halls and the hammer.'],
  [2, 'People and medallions', 'The eight rivals nobody has seen yet, and every missing relic in seven sheets.'],
  [3, 'Rooms and the things in them', 'Six more rooms, five objects and one sheet of surfaces.'],
  [4, 'Story pictures', 'Five paintings for the long story scenes. The game is complete without them; they make it richer.'],
  [5, 'The 3D tool test', 'One statue. Optional. Only to find out whether the tool is worth using.'],
];
