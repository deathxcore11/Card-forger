// Builds the Duel Summoner Asset Tool: one self-contained HTML file.
//   node make.mjs <out.html> [web]
// "web" builds the copy published as a link (ticks saved online). Without it, the file is for the PC folder:
// ticks are saved in the browser and anything listed in asset-have.js (written by scan-art.mjs) ticks itself.
import fs from 'node:fs';
import { LOOK_NAME, PILLARS, PALETTES, SCALE, BUDGETS, NEVER, STYLE, VIEW } from './look.mjs';
import { SWATCHES, DECALS, STAGE1, STAGE2, STAGE3, INTERACT } from './world.mjs';
import { MORE1, MORE2, MORE3, AMBIENT, MENUSCENE } from './world2.mjs';
import { DUELISTS, SUMMONS, FUSIONS, GODS, ENEMIES, BOSSES, NPCS } from './cast.mjs';
import { PICKUPS, ITEM_SHEETS, SPELLS, EFFECTS, UIKIT, SCREENART, PORTRAITS, REGALIA } from './ui.mjs';
import { SOUND_RULES, SOUNDS, MUSIC_RULES, MUSIC } from './audio.mjs';
import { SCREENS } from './screens.mjs';
import { EDITS, SKIP_BIBLE, SUBS } from './bible-edits.mjs';
import { KIT } from './kit.mjs';

const out = process.argv[2] || 'asset-tool.html';
const WEB = process.argv[3] === 'web';
const achievements = JSON.parse(fs.readFileSync(new URL('./achievements.json', import.meta.url)));
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:]$/, '') + '.';
const rel = h => h >= 1.8 ? `${(h / 1.8).toFixed(h >= 18 ? 0 : 1)} times the height of the player` : `${Math.round(h / 1.8 * 100)} per cent of the player's height`;
const ROOT = 'app art\\DS\\';

// ---------------------------------------------------------------- context every prompt carries
// Carved Cards style bible, locked by the owner 23 Nov. Every prompt is MASTER, then BECOMES 3D (models only), then ONE class block,
// then the PALETTE line(s), then the subject and size. Block texts are verbatim from design/style bible (tool-revision-data.md).
const MASTER = 'DUEL SUMMONER LOOK LOCK. Duel Summoner is a 3D horde-survival game played on phones, seen from behind and above. Its world is the Sunlit Kingdom: ruins built by card duelists, with giant stone playing cards, carved card frames, terraces, olive groves and bleached stone.\nOne look for everything: chunky faceted low-poly shapes, like a toy cut from big flat planes. Every face is ONE flat solid colour. Big simple shapes that still read as a black silhouette at 40 pixels tall. Edges are bevelled like the edge of a thick card.\nNo texture, no pixel art, no gradients, no painted light or shadow, no outlines, no shine, no glow, no smoke, no sparkles. The game adds light, glow and effects itself.\nUse only the colours listed under PALETTE, as flat fills.\nNever: text, letters, numbers or runes; logos or watermarks; an eye in a triangle, ankhs, puzzle pendants, millennium-style gold items, hieroglyphs, pharaoh headdresses, sphinx faces; anything from an existing game, anime, show or film; gore; photo textures.';
const WORLD = 'DUEL SUMMONER. Duel Summoner is a 3D horde-survival game played on phones, seen from behind and above. Its world is the Sunlit Kingdom: ruins built by card duelists, with giant stone playing cards, carved card frames, terraces, olive groves and bleached stone.';
const B3D_VIEW = {
  model: 'in a three-quarter view from slightly above',
  biped: 'standing in an A-pose (arms straight, angled down and out about 45 degrees, legs slightly apart, hands open), facing the viewer straight on, full body head to feet',
  beast: 'in a three-quarter front view from slightly above, in a neutral standing pose with legs straight under the body',
  part: 'laid flat and seen straight from the side, with a clean flat end where it joins the body',
};
const B3D = v => `THIS PICTURE becomes a 3D model in an image-to-3D tool. Show ONE thing, whole and uncut, ${B3D_VIEW[v] || B3D_VIEW.model}, on a plain flat light grey background (#c8c8c8), with no floor, no shadow and nothing else. Flat even light, so every face shows its true colour. Solid and round from every side, never a flat cut-out.`;
const CLASS = {
  scenery: 'SCENERY. Heavy and grounded: a wide base, flat top planes, 6 to 12 big faces per part. Calm, muted colours from the PALETTE. No gold, no violet, no bright cyan and no red anywhere: those colours mean something in the game. It does not move.',
  living: 'A LIVING CHARACTER. Big readable head, big hands or paws, big feet, short chunky limbs. One strong costume colour and clean bright fills. Neutral pose: A-pose for people; wings spread flat, tail straight out and mouth closed for creatures. Friendly and confident, never scary.',
  enemy: 'AN ENEMY. Hunched, pointed and leaning forward. Earthy colours that are darker than sand: dust browns, bone, slate. Small amber eyes are the only bright spot. Menacing but not gory.',
  boss: 'A BOSS. A monument that walks: a wide heavy stance, built like carved stone and bronze, with a card-shaped shield or plaque. Dark earthy colours from the PALETTE, crimson cloth, small amber eyes. Huge and serious, never gory.',
  use: 'SOMETHING THE PLAYER USES. The object sits on a square stone pedestal with a carved card frame on its front. This is the one kind of thing that may use gold. Slightly oversized so it reads from far away.',
  pickup: 'SOMETHING THE PLAYER PICKS UP. One small bold shape, slightly oversized so it reads from far away. This kind of thing may use gold.',
  ambient: 'BACKGROUND WILDLIFE. Tiny and low, dull colours from the stage palette, nothing bright, nothing glowing. It must never look like a pickup or an ally.',
  hat: 'A HAT worn on a character\'s head. Show the hat alone, upright, with no head inside it. One strong colour and clean flat fills. It may use a little gold.',
  tile: 'THIS PICTURE is a GREY detail tile that the game colours and repeats every 8 metres. Greyscale only, no colour. Soft, low-contrast shapes that average mid grey (#808080). One seamless square tile seen straight from above: the left edge continues into the right and the top into the bottom. Shapes scattered at random sizes and angles, with no rows, stripes or grid and no single stand-out feature.',
  paint: 'THIS IS A PAINTING made of flat colour planes, like cut paper: 5 to 7 values, one warm light from the upper left, crisp edges between planes, no texture noise. A dark plain background. Colours only from the PALETTE. For card art, frame it tall in a 2:3 shape with the subject filling the middle.',
  ui: 'THIS IS A FLAT GAME INTERFACE PIECE, empty, seen straight on: thick carved stone and dark lacquer with a carved card-frame edge, flat fills from the PALETTE, a 2 pixel dark edge, no text. Icons are one bold silhouette per cell on flat black, readable at 32 pixels.',
  decal: 'FLAT GROUND DETAILS, seen exactly from above: flat colour fills from the PALETTE, crisp edges, no outline, no cast shadow, nothing glowing.',
  fx: 'A GAME VISUAL EFFECT drawn as bright flat shapes on a pure black background: bold and simple, readable at small size, crisp edges, no blur, no text. If it has frames, each frame is a separate cell in a grid, all cells the same size, the effect centred in each cell.',
};
const FLAT2D = 'THIS ONE IS A FLAT PICTURE, NOT A 3D MODEL. Where the look lock above and the block below disagree, the block below wins.';
const PAL = {
  s1: 'PALETTE (Surface Ruins): sand #8f7048 #c09c66 #c8a46c #e2c896; road #b09470; canopy #3f6e4e #5a9a66 #74ae72 #9cc88a; meadow #6f8a4a #8fa860 #aebf78; bark #3e342f #5e5048 #7d6a5c; rock #8c8579 #b0aa9e #bdb8ae #dcd8ce; ruin stone #7a6a52 #a89578 #c9b896; bone #b8ab8c #e6dcc0 #f4eedc; landmark stone #2f2a36 #4a4250 #6a6272; terracotta #8a4a30 #b4643f #d0835a; cloth #2c5c60 #3e7f80 #e8dcc0; pool ink #1c2440 #2e3f66; sky #8fb2cc #e8d6b0.',
  s2: 'PALETTE (Sealed Catacombs): slate #0f1a26 #23384d #3c5a73 #6e8aa0; old bone #9a917c #d9d0b8; rust #5a3020 #8c4a2f; verdigris #3f5f52 #5f8a74; ghost-light #8fbf8a #d8f0c8.',
  s3: 'PALETTE (Vault of the Last Duel): basalt #0d0b12 #1e1e2a #2e2c3a #46445a; ash-gold sand #8a7a5c #b8a37c #d9c7a0; moon-white #9fb4d0 #d8e4f4 #f4f8ff; crimson #5a1420 #a3203a.',
  actor: 'PALETTE (duelists and summons): skin #8a5a40 #c08a64 #e8b890; ember #8a2a20 #c8462c #f08040; teal #1f4f5a #2f7f86 #6fc0c0; leather #3a2a20 #5e4030 #8a6448; cream #d8ccb0 #f0e8d4; ink #18161c #2a2632.',
  enemy: 'PALETTE (enemies): dust #4a4034 #6e604c #9a8a70; grave #2a3038 #4a5260 #7a8290; amber eyes #e0a040.',
  gold: 'PALETTE (only for things the player uses): gold #a07a2a #e0b765 #fff0b8.',
  reserved: 'PALETTE (meaning colours, use only where the subject names them): gold #a07a2a #e0b765 #fff0b8; xp cyan #46e0ff; violet #2e1a52 #b26bff #f4ecff; danger #ff3b30; white #ffffff.',
  fx: 'PALETTE (use these only where the subject names a colour; where it asks for white, keep it pure white so the game can colour it): fire #fff4c8 #ffc24a #ff8a1f; lightning #f4f9ff #bfdcff #7fb8ff; ice #f0fbff #cfeefc #8ab8e0; poison #e8ff9a #8fd14f #4f8a2a; wind #f4fff9 #d9fff0 #9ad8c0; earth #e8c890 #c08a3e #7a5428; light #ffffff #fffbe8 #ffe9a8; dark #d8e4f4 #2a2632 #0d0b12; gold #e0b765; xp cyan #46e0ff; violet #b26bff; danger #ff3b30.',
};
const ELHEX = { fire: '#ff8a1f', lightning: '#7fb8ff', ice: '#8ab8e0', poison: '#8fd14f', wind: '#9ad8c0', earth: '#c08a3e', light: '#ffe9a8', dark: '#2a2632' };
const stageOf = a => {
  if (a._g === 'stage2') return 's2'; if (a._g === 'stage3') return 's3'; if (a._g === 'stage1' || a._g === 'menuscene') return 's1';
  const t = ((a.stage || '') + ' ' + (a.where || '')).toLowerCase();
  if (/stage 3|vault|throne/.test(t) && !/stage 1|surface/.test(t)) return 's3';
  if (/stage 2|catacomb|crypt/.test(t) && !/stage 1|surface/.test(t)) return 's2';
  return 's1';
};
const lookOf = a => {
  const g = a._g, st = PAL[stageOf(a)];
  if (a.style === 'person' || g === 'duelists' || g === 'npcs') return { cls: CLASS.living, pal: [PAL.actor] };
  if (g === 'summons' || g === 'fusions') return { cls: CLASS.living, pal: [PAL.actor] };
  if (a.style === 'boss' || g === 'bosses') return { cls: CLASS.boss, pal: [PAL.enemy, st] };
  if (a.style === 'enemy' || g === 'enemies') return { cls: CLASS.enemy, pal: [PAL.enemy, st] };
  if (g === 'ambient') return { cls: CLASS.ambient, pal: [st] };
  if (g === 'interact') return { cls: CLASS.use, pal: [st, PAL.gold] };
  if (g === 'pickups') return { cls: CLASS.pickup, pal: [PAL.reserved] };
  if (g === 'regalia') return { cls: CLASS.hat, pal: [PAL.actor, PAL.gold] };
  return { cls: CLASS.scenery, pal: [st] };
};
const SOLID = 'Where the subject below mentions a glow, a flame, light, sparkles or pixel detail, draw only the solid object in flat colours: the game adds the light.';
const sizeLine = (a, h) => a.size ? `SIZE. In the game it is about ${a.size}.` : h ? `SIZE. In the game it is about ${h} m tall, ${rel(h)}.` : '';
const USE = {
  concept: 'WHAT THIS PICTURE IS FOR. It is the reference picture for a 3D model. I will upload it to an image-to-3D tool, which rebuilds exactly what it sees as a 3D object. So the picture must show ONE thing, complete from top to bottom with nothing cut off, evenly lit with no dark shadows, on a plain flat light grey background with no floor, no scenery, and nothing touching or overlapping it. No motion blur, no effects, no smoke, no glow clouds, no sparkles: the game adds those itself.',
  part: 'WHAT THIS PICTURE IS FOR. It is the reference picture for ONE SEPARATE PART of a 3D model. The game moves this part on its own (it flaps, swings, opens or turns), so I need it as its own 3D piece. I will upload the picture to an image-to-3D tool. So show only this part, complete, with a clean flat end where it joins the body, evenly lit, on a plain flat light grey background with nothing else in the picture.',
  swatch: 'WHAT THIS PICTURE IS FOR. It is a surface texture. The game repeats this one picture side by side across large 3D surfaces, thousands of times. So it must be ONE flat tile, seen exactly from above, filling the whole picture, whose left edge continues into its right edge and whose top continues into its bottom with no visible seam. Do not draw the pattern several times inside the picture. Scatter the shapes at random sizes and angles: no rows, no stripes, no grid, nothing that would look like wallpaper when repeated, and no single stand-out feature (it would repeat visibly). No perspective, no horizon, no shadows cast from outside the tile.',
  sheet: 'WHAT THIS PICTURE IS FOR. It is a sheet of small icons for the game\'s screens. I cut the sheet into separate icons, and each one is shown at only 48 to 96 pixels. So each icon must be one big bold shape with a thick dark outline, clearly separated from its neighbours, the same size and style as the others, with no small details.',
  ui: 'WHAT THIS PICTURE IS FOR. It is a piece of the game\'s interface (a frame, bar, button or plate). The game draws all words and numbers itself and stretches or fills this piece, so it must be EMPTY, seen flat from the front with no perspective, on a plain flat black background, with crisp edges.',
  paint: 'WHAT THIS PICTURE IS FOR. It is a painted illustration shown in the game\'s menus or on a card. It should feel like the game: the same chunky shapes and the same locked colours, readable at small size, with one clear subject.',
  fx: 'WHAT THIS PICTURE IS FOR. It is a visual effect. The game draws it as glowing light on top of the 3D world, so the background must be pure black (black becomes see-through). If it has several frames, the game plays the frames one after another as an animation, so every frame must sit in its own equal cell, centred, at the same scale.',
};
const MOVES = {
  meshy: 'HOW IT WILL MOVE. It gets a skeleton and is animated like a person (walking, running, attacking). So draw it standing in an A-pose: arms straight, angled down and away from the body about 45 degrees, legs slightly apart, facing the viewer straight on, hands open with fingers visible. Keep cloaks, coats, hair and anything loose short or close to the body so the arms and legs are clearly separate.',
  parts: 'HOW IT WILL MOVE. It gets a skeleton and the game moves its wings, tail, head and legs. So draw it in a neutral pose with every moving part clearly separate from the body: wings fully spread and flat, tail straight out, legs straight and apart, mouth closed.',
  vat: 'HOW IT WILL MOVE. Hundreds of these are on screen at once with a simple looping animation, so it must be very simple: a few big chunky shapes, limbs clearly separate from the body, neutral standing pose.',
  bend: 'HOW IT WILL MOVE. The game bobs, sways and bends it as one piece, so draw it in a calm neutral pose, upright and symmetrical.',
  none: 'HOW IT WILL MOVE. It does not move: it is scenery. Draw it sitting naturally as it would in the world.',
};

const meshyText = (a, subject) => {
  const lead = { creature: 'Low-poly stylized cute creature, chunky proportions, big head and feet', enemy: 'Low-poly stylized game enemy, chunky readable silhouette', boss: 'Low-poly stylized giant boss, monumental chunky shapes', person: 'Low-poly stylized game character, chunky proportions, A-pose', model: 'Low-poly stylized game prop, chunky toy-like shapes, big bevels' }[a.style] || 'Low-poly stylized game asset';
  return clip(`${lead}: ${(a.meshy || subject).replace(/\.?$/, '.')} Flat-shaded faces, one flat solid colour per face, no texture detail, no tiny details.`, 590);
};
const symOf = a => /tree|rock|rubble|cliff|bones|dune|crystal|web|stalactite|reeds|basalt|treasure/i.test(a.file) ? 'OFF (it is lopsided on purpose)' : 'ON';
const meshySteps = (a, tris, pic, glb, textPrompt, plain = true) => ({ text: [
  `1. Open Meshy and choose "Image to 3D".`,
  `2. Upload the picture you just made (${pic}).`,
  `3. Settings: polygons about ${tris.toLocaleString('en')} (pick the lowest setting at or above that; I trim the rest), topology "Triangle", symmetry ${symOf(a)}${a.view === 'biped' ? ', pose "A-pose"' : ''}.`,
  `4. Generate. Pick the result that matches the picture best from every side. Check the back: no holes, no extra limbs, no melted face.`,
  plain ? `5. Download as GLB twice. First the PLAIN model, before texturing: name it ${glb.replace('.glb', '-plain')}. Then texture it and download again WITH texture: name it ${glb.replace('.glb', '')}. Meshy adds .glb itself.` : `5. Download as GLB WITH texture. Name it ${glb.replace('.glb', '')} (Meshy adds .glb itself). No plain copy is needed for this one, because the skeleton copy comes next.`,
].join('\n'), alt: textPrompt, names: plain ? [glb.replace('.glb', '-plain'), glb.replace('.glb', '')] : undefined });
const RIG_CLIPS = { person: 'Idle, Walking, Running', enemy: 'Idle, Walking (zombie or slow), Running', boss: 'Idle, Walking (heavy)' };
const rigSteps = (a, glb) => [
  `1. In Meshy, open the model you just made and choose "Rig" (or "Animate").`,
  `2. Choose the humanoid (two-legged) rig. Set the height to about ${a.h} m.`,
  `3. Place the markers it asks for (chin, shoulders, elbows, wrists, hips, knees, ankles) on the model and confirm.`,
  `4. From the FREE animation library add only these clips: ${RIG_CLIPS[a.style] || RIG_CLIPS.person}. If a name is missing, pick the closest one. Do not spend credits on Text to Motion: I make every other move in code.`,
  `5. Download as GLB "with animations". Name it ${glb.replace('.glb', '-anim')} (Meshy adds .glb itself).`,
  ``,
  `That is all you do. I retime the clips, blend them, and make every other move in code for free: ${a.anim}.`,
].join('\n');
const creatureRigSteps = (a, glb) => [
  `1. In Meshy, open the model you just made (${glb}) and choose "Rig" (or "Animate").`,
  `2. Let Meshy place the skeleton. If it asks for a type, pick the closest: four-legged, winged, or two-legged.`,
  `3. Look at the skeleton lines: they should run down the spine and tail to the tip, out along each wing to the tip, down each leg, and into the head. If a wing or the tail has no bones, try the rig once more.`,
  `4. Do NOT add any animation clips and do not use Text to Motion. No credits needed for movement.`,
  `5. Download as GLB. Name it ${glb.replace('.glb', '-rig')} (Meshy adds .glb itself).`,
  ``,
  `That is all you do. One model with a skeleton replaces all the separate wing, tail and jaw models. I make every move in code for free: ${a.anim || 'idle, walk or fly, attack, hurt, defeat'}.`,
].join('\n');

const P = (lines) => lines.filter(Boolean).join('\n\n');
const conceptPrompt = (a, subject, o = {}) => { const L = lookOf(a); return P([
  MASTER, B3D(a.view), L.cls, L.pal.join('\n'),
  `WHAT IT IS IN THE GAME. ${a.name}${o.sub ? ' (' + o.sub + ')' : ''}: ${a.where || ''}${a.attack ? '. Its attack: ' + a.attack : ''}.`,
  MOVES[(a.rig && a.rig.startsWith('meshy') ? 'meshy' : a.rig) || (a.anim ? 'bend' : 'none')],
  SOLID,
  'SUBJECT. ' + subject,
  sizeLine(a, o.h || a.h),
  a.element && ELHEX[String(a.element).toLowerCase()] ? `ELEMENT. Its element is ${a.element}: use ${ELHEX[String(a.element).toLowerCase()]} as one flat accent colour on its markings. No glow: the game adds it.` : a.element ? `ELEMENT. Its element is ${a.element}: show it as one flat accent colour on its markings. No glow: the game adds it.` : '',
  'Make the picture square, 1024 x 1024.',
]); };
const partPrompt = (a, part, subject) => { const L = lookOf(a); return P([MASTER, B3D('part'), L.cls, L.pal.join('\n'), `WHAT IT BELONGS TO. ${a.name}: ${subject}`, SOLID, `SUBJECT. Only the ${part} of the ${a.style === 'model' ? 'object' : 'creature'} described above, on its own, matching its colours and shapes exactly.`, 'Make the picture square, 1024 x 1024.']); };

const ANIM_NOTE = {
  parts: 'You only add a skeleton in Meshy (no clips). I make every move in code',
  vat: 'You do nothing for animation. I bake a short looping animation into the model so hundreds can be on screen',
  bend: 'You do nothing for animation. I bob, sway and bend it in code',
};

function stepsFor(a) {
  const S = [];
  const add = (key, title, tool, body, save, o = {}) => S.push(typeof body === 'string' ? { key, title, tool, text: body, save, ...o } : { key, title, tool, ...body, save, ...o });
  if (a.how === 'model') {
    const variants = [];
    const living = ['creature', 'enemy', 'boss'].includes(a.style) && !(a.rig && a.rig.startsWith('meshy')) && a.rig !== 'vat';
    if (a.forms && a.forms.length) a.forms.forEach(([subj, tris], i) => variants.push({ sfx: `-f${i + 1}`, label: `Form ${i + 1} of 3`, subj: `${a.name}, form ${i + 1} of 3 (${['baby', 'young', 'grown'][i]}): ${subj}.`, short: subj, tris, h: [0.9, 1.8, 3.6][i] }));
    else if (a.formsAuto) [['young, smaller and softer, with rounder shapes, shorter horns, crests and wings, and a weaker glow', 0.7, 0.8], ['adult, exactly as described', 1, 1], ['fully grown and crowned: bigger and heavier, with extra armour plates, longer horns and crests, and a much stronger glow', 1.25, 1.2]].forEach(([m, k, hk], i) => variants.push({ sfx: `-f${i + 1}`, label: `Form ${i + 1} of 3`, subj: `${a.name}, form ${i + 1} of 3 (${m}): ${a.subj}`, short: a.subj, tris: Math.round(a.tris * k / 50) * 50, h: +(a.h * hk).toFixed(1) }));
    else if (a.subj) variants.push({ sfx: '', label: '', subj: a.subj, short: a.subj, tris: a.tris || 300, h: a.h });
    for (const v of variants) {
      const pic = `${a.file}${v.sfx}.png`, glb = `${a.file}${v.sfx}.glb`, L = v.label ? v.label + ': ' : '';
      add(pic, L + 'make the picture', 'ChatGPT', conceptPrompt(a, v.subj, { h: v.h, sub: v.label }), ROOT + '2d\\concepts\\' + pic, { copy: true });
      add(glb, L + 'turn the picture into a 3D model', 'Meshy', meshySteps(a, v.tris, pic, glb, meshyText(a, v.short), !(living || (a.rig && a.rig.startsWith('meshy')))), ROOT + '3d\\' + glb);
      if (living) add(glb.replace('.glb', '-rig.glb'), L + 'give it a skeleton', 'Meshy', creatureRigSteps(a, glb), ROOT + '3d\\' + glb.replace('.glb', '-rig.glb'));
    }
    (a.outfits || []).forEach(([nm, subj], i) => {
      const pic = `${a.file}-outfit${i + 1}.png`, glb = `${a.file}-outfit${i + 1}.glb`;
      add(pic, `Outfit ${i + 1} "${nm}": make the picture`, 'ChatGPT', conceptPrompt(a, `${subj}. Same face, hair, body and proportions as the base duelist, who is: ${a.subj}`, { sub: 'outfit: ' + nm }), ROOT + '2d\\concepts\\' + pic, { copy: true });
      add(glb, `Outfit ${i + 1} "${nm}": turn it into a 3D model`, 'Meshy', meshySteps(a, a.tris, pic, glb, meshyText(a, subj), !(a.rig && a.rig.startsWith('meshy'))), ROOT + '3d\\' + glb);
      if (a.rig && a.rig.startsWith('meshy')) add(glb.replace('.glb', '-rig.glb'), `Outfit ${i + 1} "${nm}": give it a skeleton`, 'Meshy', [`1. In Meshy, open the outfit model (${glb.replace('.glb', '')}) and choose "Rig".`, `2. Choose the two-legged rig and drop the markers, the same way as the base model.`, `3. Add NO clips. This outfit borrows every move from the base model's skeleton.`, `4. Download as GLB. Name it ${glb.replace('.glb', '-rig')} (Meshy adds .glb itself).`].join('\n'), ROOT + '3d\\' + glb.replace('.glb', '-rig.glb'));
    });
    const raw = typeof a.parts === 'string' ? a.parts.split(/,\s*/) : Array.isArray(a.parts) ? a.parts : [];
    const parts = raw.filter(p => !/in code|if possible/.test(p)).map(p => p.replace(/\(.*\)/, '').trim()).filter(p => p && p !== 'body' && p !== 'frame' && p !== 'stand');
    if (!living && (a.subj || (a.forms && a.forms.length)) && parts.length) {
      const base = a.forms && a.forms.length ? `${a.forms[a.forms.length - 1][0]} (the grown form)` : a.subj;
      for (const p of parts) {
        const f = `${a.file}-part-${p.replace(/\s+/g, '-')}`;
        add(f + '.png', `Moving part "${p}": make the picture`, 'ChatGPT', partPrompt(a, p, base), ROOT + '2d\\concepts\\' + f + '.png', { copy: true });
        add(f + '.glb', `Moving part "${p}": turn it into a 3D model`, 'Meshy', meshySteps(a, 150, f + '.png', f + '.glb', clip(`Low-poly stylized game asset part: only the ${p} of ${base.replace(/\.?$/, '.')} Flat-shaded, one flat colour per face.`, 590)), ROOT + '3d\\parts\\' + f + '.glb');
      }
    }
    if (a.rig && a.rig.startsWith('meshy') && a.subj) add(`${a.file}-anim.glb`, 'Give it a skeleton and animations', 'Meshy', rigSteps(a, a.file + '.glb'), ROOT + '3d\\' + a.file + '-anim.glb');
  } else if (a.how === 'swatch') {
    add(a.file + '.png', 'Make the texture', 'ChatGPT', P([WORLD, CLASS.tile, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}. The game repeats this one tile across large surfaces and adds the colour itself.`, 'SUBJECT (take the shapes only and ignore every colour word: the tile is grey). ' + a.subj, 'Make the picture square, 1024 x 1024, one tile filling the whole picture edge to edge.', NEVER]), ROOT + '2d\\textures\\' + a.file + '.png', { copy: true });
  } else if (a.how === 'sheet') {
    const rows = ['Top row', 'Middle row', 'Bottom row'];
    const list = rows.map((r, ri) => `${r}, left to right:\n` + a.cells.slice(ri * 3, ri * 3 + 3).map((c, ci) => `${ri * 3 + ci + 1}. ${c[1]} (this is the icon for "${c[0]}")`).join('\n')).join('\n');
    add(a.file + '.png', 'Make the sheet of nine', 'ChatGPT', P([MASTER, FLAT2D, a.ctx || USE.sheet, a.style === 'decal' ? CLASS.decal : CLASS.ui, a.style === 'decal' ? PAL[stageOf(a)] : PAL.s1 + '\n' + PAL.actor + '\n' + PAL.reserved, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, `LAYOUT. Nine separate ${a.ctx ? 'decals' : 'icons'} in a 3 by 3 grid on a flat pure ${a.ctx ? 'white' : 'black'} background, all the same size, evenly spaced, none touching, each fully inside its cell and seen straight on.${a.note ? ' ' + a.note : ''}`, list, 'Make the picture square, 1024 x 1024.']), ROOT + '2d\\icons\\' + a.file + '.png', { copy: true });
  } else if (a.how === 'fx') {
    const lay = a.frames > 1 ? `LAYOUT. ${a.frames} frames, left to right then top to bottom, in a 4 by 4 grid of equal square cells${a.frames < 16 ? ' (leave the unused cells pure black)' : ''}. The effect stays centred in each cell at the same scale, and each frame changes a little from the last so they play as smooth animation.` : (a.lay || 'LAYOUT. One single image, centred.');
    add(a.file + '.png', a.frames > 1 ? `Make the ${a.frames}-frame sheet` : 'Make the effect picture', 'ChatGPT', P([WORLD, USE.fx, CLASS.fx, PAL.fx, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, 'SUBJECT. ' + a.subj, lay, 'Make the picture square, 1024 x 1024.', NEVER]), ROOT + '2d\\fx\\' + a.file + '.png', { copy: true });
  } else if (a.how === '2d') {
    const isLogo = a.code === 'KA02', isUi = a.style === 'ui' || a.style === 'fx';
    const never = isLogo ? NEVER.replace('Not allowed anywhere: text, letters, numbers, runes or writing of any kind;', 'Not allowed anywhere: text or letters (I add the title myself);') : NEVER;
    const who = a.portraitOf ? ' ' + (DUELISTS.find(d => d.name === a.portraitOf) || {}).subj : '';
    add(a.file + '.png', 'Make the picture', 'ChatGPT', (a.style === 'fx' ? P([WORLD, USE.ui, CLASS.fx, PAL.fx, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, 'SUBJECT. ' + a.subj + who, `Make the picture ${a.px.split(' made')[0]}.`, never]) : P([MASTER, FLAT2D, isUi ? USE.ui : USE.paint, isUi ? CLASS.ui : CLASS.paint, PAL[stageOf(a)] + '\n' + PAL.actor + '\n' + PAL.reserved, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, 'SUBJECT. ' + a.subj + who, `Make the picture ${a.px.split(' made')[0]}.`])), ROOT + '2d\\' + (isUi ? 'ui' : 'art') + '\\' + a.file + '.png', { copy: true });
  }
  return S;
}

// ---------------------------------------------------------------- derived lists
const creatures = [...SUMMONS, ...FUSIONS, ...GODS];
const CARDART = creatures.map((c, i) => ({ code: 'CA' + String(i + 1).padStart(2, '0'), name: 'Card art: ' + c.name, file: 'card-' + c.file.replace(/^(mon|fus|god|secret)-/, ''), how: '2d', style: 'paint', px: '1024 x 768 made, 192 x 144 in game', where: 'the picture on its monster card (level-up offers, Card Library, Fusion banner)',
  subj: `${c.forms && c.forms.length ? c.forms[1][0] + '.' : c.subj} Shown in a heroic action pose doing its attack (${c.attack}), in a scene from the sunlit card-kingdom ruins, its ${c.element} colour lighting the scene.` }));
const cleanLore = s => (s.match(/Lore: '([^']+)'/) || [, ''])[1].replace(/Hollow Pharaoh|Pharaoh/g, 'Hollow King').replace(/Eye of the Sealed One/g, 'the secret boss');
const ACH = [];
for (let i = 0; i < achievements.length; i += 9) {
  const chunk = achievements.slice(i, i + 9);
  while (chunk.length < 9) chunk.push({ name: 'Spare', condition: "Lore: 'a plain gold laurel ring with nothing inside'" });
  ACH.push({ code: 'AC' + String(i / 9 + 1).padStart(2, '0'), name: `Achievement badges ${i + 1} to ${Math.min(i + 9, achievements.length)}`, file: `badges-s${i / 9 + 1}`, how: 'sheet', style: 'icon', px: '1024 x 1024 made (3 x 3), 96 x 96 each in game', where: 'the Achievements page in the app, results, pop-ups',
    note: 'Each is a round badge: a thick gold laurel rim, a deep teal field, and one bold picture of the feat in the middle.', cells: chunk.map(a => [a.name, 'a badge for the feat "' + a.name + '": ' + (cleanLore(a.condition) || a.name)]) });
}
const SOUND_CTX = 'CONTEXT. A sound effect for Duel Summoner, a bright stylized fantasy action game about a card duelist and summoned monsters in sunlit ruins. Sounds are chunky, punchy, warm and a little toy-like: wood, stone, paper, bronze, glass. One clean sound only, dry (no echo or room unless asked), no music, no voices or words, no background noise, starting instantly with no silence at the front.';
const SND = SOUNDS.map(s => ({ code: s.code, name: s.name, file: s.file, how: 'sound', where: 'plays in the game', len: s.len, vars: s.vars, loop: s.loop, added: s.added,
  steps: [{ key: s.file + '.wav', title: `Make the sound${s.vars > 1 ? ` (${s.vars} different takes)` : ''}`, tool: 'Sound tool', copy: true, save: ROOT + 'sound\\' + s.file + (s.vars > 1 ? `-1.wav to -${s.vars}.wav` : '.wav'),
    text: P([SOUND_CTX, `THE SOUND. ${s.name}: ${s.prompt}.`, `LENGTH. About ${s.len}.${s.loop ? ' It must loop seamlessly: the end flows back into the start.' : ''}`, s.vars > 1 ? `Make ${s.vars} takes that are clearly the same sound but each a little different, so repeats never sound identical.` : '']) }] }));
const MUS = MUSIC.map(m => ({ code: m.code, name: m.name, file: m.file, how: 'music', where: 'music', len: m.len,
  steps: [{ key: m.file + '.wav', title: 'Make the track', tool: 'Music tool', copy: true, save: ROOT + 'music\\' + m.file + '.wav',
    text: P(['CONTEXT. Music for Duel Summoner, a bright stylized fantasy action game about a card duelist and summoned monsters in the ruins of a sunlit desert kingdom. Warm and adventurous, never horror. Instruments of this world: oud, frame drums, darbuka, low brass, plucked strings, hand claps, bells, and a wordless choir for big moments. Instrumental only: no sung words.', `THE TRACK. ${m.name}: ${m.brief}`, `${m.bpm ? 'TEMPO ' + m.bpm + ' BPM. ' : ''}KEY ${m.key}. LENGTH ${m.len}.`, /loop/.test(m.len) ? 'It must loop seamlessly: the last bar leads back into the first with no gap, no fade-out and no ending chord.' : '', /layers/.test(m.len) ? 'Make it as three versions of the same piece, same length, tempo and key, so they can play on top of each other: CALM (bass and light drums), FIGHT (full drums and melody), DANGER (extra percussion and brass). Save them as -calm, -fight and -danger.' : '']) }] }));

const GROUPS = [
  { id: 'materials', title: 'Ground and wall textures', kind: 'Flat picture that repeats', blurb: 'Flat pictures the game repeats across the ground and walls. No 3D needed. Every prop in a stage is coloured with these, so the stage looks hand-made.', items: [...SWATCHES, ...DECALS] },
  { id: 'stage1', title: 'Stage 1 scenery: Surface Ruins', kind: '3D model', blurb: 'Trees, bushes, rocks, ruins and landmarks. These do not move.', items: [...STAGE1, ...MORE1] },
  { id: 'stage2', title: 'Stage 2 scenery: Sealed Catacombs', kind: '3D model', blurb: 'Crypt pieces and props. Boulders, cliffs and crates come back from Stage 1, re-coloured by me.', items: [...STAGE2, ...MORE2] },
  { id: 'stage3', title: 'Stage 3 scenery: Vault of the Last Duel', kind: '3D model', blurb: 'The cavern, the sand sea, the statues and the throne.', items: [...STAGE3, ...MORE3] },
  { id: 'ambient', title: 'Ambient life', kind: '3D model with a skeleton', blurb: 'Small creatures that make a stage feel alive: butterflies, birds, rabbits, bats, crabs. They wander and flutter and never fight.', items: AMBIENT },
  { id: 'interact', title: 'Chests, shrines and gates', kind: '3D model', blurb: 'Things you use in a run. Some have a moving part (a lid, a door) that needs its own model so it can open.', items: INTERACT },
  { id: 'menuscene', title: 'Menu scenes: the Camp, the plinth and the map views', kind: '3D model', blurb: 'These stand behind the menus as a real 3D place you look into, not a painted picture: the Camp behind the main menu, the hall where you pick a duelist, and the far view behind the map choice. Most of each place is built from stage scenery you already have on this list; these are only the extra pieces. The sky, the fire, the stone statues, the floor and the moving banners are made by the game, so none of these models has them.', items: MENUSCENE },
  { id: 'kit', title: 'Map kit and landmarks', kind: '3D model', blurb: 'The pieces every map is built from. The game builds almost all of them itself from exact sizes, so they always fit together. You make only the few carved hero pieces and the side-quest props.', items: KIT },
  { id: 'pickups', title: 'Pickups', kind: '3D model', blurb: 'Coins, hearts and power-ups. Small and simple.', items: PICKUPS },
  { id: 'duelists', title: 'Duelists and outfits', kind: '3D model with a skeleton', blurb: 'The 12 playable characters and the practice dummy. Each needs a skeleton and animations from Meshy, and has three outfits.', items: DUELISTS },
  { id: 'summons', title: 'Monsters (18, three forms each)', kind: '3D model with a skeleton', blurb: 'Your summons. Form 1 is a baby, form 2 young, form 3 grown. Each one gets a skeleton in Meshy so its wings, tail and legs can flap and swing.', items: SUMMONS },
  { id: 'fusions', title: 'Fusions, God Fusions and Secret Fusions', kind: '3D model with a skeleton', blurb: 'Fusions have three forms. Gods and Secrets have one giant form.', items: [...FUSIONS, ...GODS] },
  { id: 'enemies', title: 'Swarm enemies', kind: '3D model, very simple', blurb: 'Hundreds on screen, so each is one simple model. I add the animation.', items: ENEMIES },
  { id: 'bosses', title: 'Elites and bosses', kind: '3D model', blurb: 'Big and dramatic. Every one gets a Meshy skeleton; I make the moves in code.', items: BOSSES },
  { id: 'npcs', title: 'People in the world', kind: '3D model with a skeleton', blurb: 'The shopkeeper and keepers.', items: NPCS },
  { id: 'regalia', title: 'Hats (Regalia)', kind: '3D model', blurb: 'Worn on any duelist\'s head.', items: REGALIA },
  { id: 'cardart', title: 'Card art', kind: 'Painting', blurb: 'The painting inside every card. No 3D.', items: [...CARDART, ...SPELLS] },
  { id: 'icons', title: 'Icons', kind: 'Sheet of nine icons', blurb: 'Items, stats, elements, Oaths. One picture holds nine; I cut them apart.', items: ITEM_SHEETS },
  { id: 'ui', title: 'Screen pieces (HUD and menus)', kind: 'Flat picture', blurb: 'Frames, bars and buttons, all empty. The game writes the words.', items: UIKIT },
  { id: 'art', title: 'Big pictures: title, maps, portraits', kind: 'Painting', blurb: 'Key art, map cards, duelist portraits, backdrops.', items: [...SCREENART, ...PORTRAITS] },
  { id: 'fx', title: 'Effects', kind: 'Effect picture on black', blurb: 'Sparks, flames, smoke and magic. Flat pictures on black; the game makes them glow and move.', items: EFFECTS },
  { id: 'badges', title: 'Achievement badges', kind: 'Sheet of nine icons', blurb: `All ${achievements.length} achievements, nine to a sheet.`, items: ACH },
  { id: 'sound', title: 'Sound effects', kind: 'Sound', blurb: 'Each prompt goes into a sound-effect generator (ElevenLabs Sound Effects works). Save as WAV.', items: SND },
  { id: 'music', title: 'Music', kind: 'Music', blurb: 'Each brief goes to a music tool or a composer. Save as WAV.', items: MUS },
];
// Entries the owner can leave out: code -> short plain reason. Shown on the row as a grey "Can skip" tag. The entry itself is never changed.
export const SKIP = {
  KA03: 'The main menu now shows the real 3D Camp, so this painting is only a spare. Make it last or not at all.',
  KA04: 'Choosing a duelist now shows the real 3D hall, so this painting is only a spare. Make it last or not at all.',
  KA08: 'Quick duel is now a simple choice on the map screen and has no card of its own. Make it last or not at all.',
  FX38: 'The game now draws the whole eclipse by itself. Make it last or not at all.',
  UI01: 'The approved menus draw their own panels as dark glass with a gold line, so this stone frame is only a spare. Make it last or not at all.',
  UI02: 'The approved menus print their titles with no bar behind them, so this is only a spare. Make it last or not at all.',
  UI03: 'The approved menus draw their own buttons, so this stone button is only a spare. Make it last or not at all.',
  UI04: 'The approved menus draw their own tabs. Make it last or not at all.',
  UI05: 'The approved menus draw their own switches, arrows and sliders. Make it last or not at all.',
  UI20: 'The game now draws a plain gold ring round the player picture. Make it last or not at all.',
  SF100: 'The approved menus play the paper flick (SF164) when the gold ring moves, so this stone click is only a spare. Make it last or not at all.',
  SF102: 'The approved menus play the card slide (SF165) for going back, so this stone click is only a spare. Make it last or not at all.',
  WX37: 'The Card Chest (WX01) is now this same black lacquer chest, so make that one instead.',
};
Object.assign(SKIP, SKIP_BIBLE);

// The first ten are the approved menus (added 23 Nov): the Camp pieces, the plinth, the hall, the map view, the emblem, the button pictures, the Camp air and the menu theme.
const FIRST = ['W702', 'W703', 'W706', 'W704', 'W709', 'W711', 'UI30', 'IC30', 'SF154', 'MU01', 'MT47', 'MT49', 'W451', 'W455', 'W146', 'W147', 'WX37', 'WX38', 'FX34', 'FX36', 'SF121', 'IC16', 'MT01', 'MT29', 'MT04', 'MT05', 'MT08', 'MT09', 'MT11', 'W101', 'W103', 'W106', 'W109', 'W110', 'W111', 'W118', 'W119', 'W114', 'W116', 'EN01', 'EN02', 'EN03', 'EN04', 'EN05', 'EN06', 'UI01', 'UI02', 'UI03', 'UI06', 'UI07', 'UI10', 'UI14', 'IC11', 'WX01', 'WX02', 'PK02', 'PK04', 'IC01', 'IC02', 'CH01', 'SM01', 'SM02'];

const DATA = { groups: [], assets: [], have: [] };
const seen = new Set(), keys = new Set();
for (const g of GROUPS) {
  DATA.groups.push({ id: g.id, title: g.title, kind: g.kind, blurb: g.blurb });
  for (const a of g.items) {
    if (seen.has(a.code)) throw new Error('duplicate code ' + a.code); seen.add(a.code);
    a._g = g.id;
    if (EDITS[a.code]) { const e = EDITS[a.code]; if (e.subj && a.meshy) delete a.meshy; Object.assign(a, e); }
    if (SUBS[a.code]) for (const [f, t] of SUBS[a.code]) for (const k of ['subj', 'meshy']) if (typeof a[k] === 'string') a[k] = a[k].split(f).join(t);
    const steps = a.steps || stepsFor(a);
    for (const s of steps) { if (keys.has(s.key)) throw new Error('duplicate file ' + s.key); keys.add(s.key); }
    const rig = a.rig || '';
    const anim = a.how !== 'model' ? '' : rig.startsWith('meshy') ? `It gets a skeleton in Meshy (the last step), with ready-made clips. I add the rest in code: ${a.anim}.` : ANIM_NOTE[rig] ? `${ANIM_NOTE[rig]}: ${a.anim}.` : a.anim ? `You do nothing for animation. I do it in code: ${a.anim}.` : 'It does not move.';
    const facts = [];
    if (a.how === 'model') { if (a.h) facts.push(['Size in game', `${a.h} m tall (${rel(a.h)})`]); if (a.forms && a.forms.length) facts.push(['Forms', '3: baby 0.9 m, young 1.8 m, grown 3.6 m']); }
    if (a.px) facts.push(['Picture size', a.px]);
    if (a.len) facts.push(['Length', a.len + (a.vars > 1 ? `, ${a.vars} takes` : '') + (a.loop ? ', loops' : '')]);
    if (a.element) facts.push(['Element', a.element]);
    if (a.attack) facts.push(['Attack', a.attack]);
    if (a.partner) facts.push(['Fuses with', a.partner]);
    if (a.recipe) facts.push(['Made from', a.recipe]);
    if (a.kind) facts.push(['Role', a.kind]);
    if (a.stage) facts.push(['Appears', a.stage]);
    if (a.replaces) facts.push(['Replaces', a.replaces]);
    if (a.have) facts.push(['Already have', a.have]);
    if (a.note) facts.push(['Note', a.note]);
    if (a.how === 'code') facts.push(['Made by me', a.subj]);
    DATA.assets.push({ c: a.code, n: a.name, g: g.id, w: a.where || '', anim, facts, steps, mine: a.how === 'code' || !steps.length, nw: a.added || '' });
    if (SKIP[a.code]) DATA.assets[DATA.assets.length - 1].sk = SKIP[a.code];   // sk: why the owner can skip it, shown as a "Can skip" tag   // nw: the date an entry was added, shown as a "New" tag
    for (const f of a.haveFiles || []) { if (!keys.has(f)) throw new Error('haveFiles unknown ' + f); DATA.have.push(f); }
  }
}
for (const s of SCREENS) for (const u of s.uses) if (!seen.has(u)) throw new Error('screen ' + s.name + ' uses unknown ' + u);
for (const c of Object.keys(SKIP)) if (!seen.has(c)) throw new Error('SKIP unknown ' + c); for (const c of Object.keys(EDITS)) if (!seen.has(c)) throw new Error('EDITS unknown ' + c);
for (const c of FIRST) if (!seen.has(c)) throw new Error('FIRST unknown ' + c);
DATA.first = FIRST;
// The playable slice (style bible fix 17): the owner makes only these until the slice is approved in the game. code -> filter on file keys (null = every step).
const SLICE = [['CH01', k => !/outfit/.test(k)], ['SM01', null], ['EN01', null], ['WX01', null], ['W105', null], ['W101', null], ['W109', null], ['MT47', null], ['MT11', null], ['PK01', null], ['SF011', null], ['SF012', null], ['SF014', null], ['SF001', null]];
DATA.slice = []; DATA.sliceCodes = SLICE.map(x => x[0]);
for (const [c, f] of SLICE) { const a = DATA.assets.find(x => x.c === c); if (!a) throw new Error('SLICE unknown ' + c); for (const st of a.steps) if (!f || f(st.key)) DATA.slice.push(st.key); }
// Approved in game (fix 18): codes the builder has loaded and judged from the real game camera. Kept in approved.json: ["CODE", ...].
DATA.ok = JSON.parse(fs.readFileSync(new URL('./approved.json', import.meta.url)));
for (const c of DATA.ok) if (!seen.has(c)) throw new Error('approved.json unknown ' + c);
DATA.sliceOk = DATA.sliceCodes.every(c => DATA.ok.includes(c));
// Files made before the look was locked that must be made again: an old tick or a found file does not count for these.
DATA.redo = ['chest-card.png', 'chest-card.glb', 'chest-card-part-lid.png', 'chest-card-part-lid.glb', 'mat-path.png', 'mat-grass-dry.png', 'mat-bone.png'];
for (const k of DATA.redo) if (!keys.has(k)) throw new Error('redo unknown ' + k);
DATA.look = { name: LOOK_NAME, pillars: PILLARS, palettes: PALETTES, scale: SCALE, budgets: BUDGETS, never: NEVER };
DATA.screens = SCREENS;
DATA.soundRules = SOUND_RULES; DATA.musicRules = MUSIC_RULES;
DATA.built = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
DATA.web = WEB;

const shell = fs.readFileSync(new URL('./tool.html', import.meta.url), 'utf8');
const html = shell.replace('/*DATA*/null', () => JSON.stringify(DATA).replace(/</g, '\\u003c')).replace('<!--HAVE-->', WEB ? '' : '<script src="asset-have.js"></script>');
fs.writeFileSync(out, html);
fs.writeFileSync(new URL('./asset-keys.json', import.meta.url), JSON.stringify([...keys]));
const nSteps = DATA.assets.reduce((n, a) => n + a.steps.length, 0);
console.log(JSON.stringify({ assets: DATA.assets.length, steps: nSteps, newAssets: DATA.assets.filter(a => a.nw).length, copyPrompts: DATA.assets.reduce((n, a) => n + a.steps.filter(s => s.copy).length, 0), kb: Math.round(html.length / 1024), web: WEB }));
