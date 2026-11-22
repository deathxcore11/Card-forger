// Builds the Duel Summoner Asset Tool: one self-contained HTML file.
//   node make.mjs <out.html> [web]
// "web" builds the copy published as a link (ticks saved online). Without it, the file is for the PC folder:
// ticks are saved in the browser and anything listed in asset-have.js (written by scan-art.mjs) ticks itself.
import fs from 'node:fs';
import { LOOK_NAME, PILLARS, PALETTES, SCALE, BUDGETS, NEVER, STYLE, VIEW } from './look.mjs';
import { SWATCHES, DECALS, STAGE1, STAGE2, STAGE3, INTERACT } from './world.mjs';
import { MORE1, MORE2, MORE3, AMBIENT } from './world2.mjs';
import { DUELISTS, SUMMONS, FUSIONS, GODS, ENEMIES, BOSSES, NPCS } from './cast.mjs';
import { PICKUPS, ITEM_SHEETS, SPELLS, EFFECTS, UIKIT, SCREENART, PORTRAITS, REGALIA } from './ui.mjs';
import { SOUND_RULES, SOUNDS, MUSIC_RULES, MUSIC } from './audio.mjs';
import { SCREENS } from './screens.mjs';

const out = process.argv[2] || 'asset-tool.html';
const WEB = process.argv[3] === 'web';
const achievements = JSON.parse(fs.readFileSync(new URL('./achievements.json', import.meta.url)));
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:]$/, '') + '.';
const rel = h => h >= 1.8 ? `${(h / 1.8).toFixed(h >= 18 ? 0 : 1)} times the height of the player` : `${Math.round(h / 1.8 * 100)} per cent of the player's height`;
const ROOT = 'app art\\DS\\';

// ---------------------------------------------------------------- context every prompt carries
const GAME = 'CONTEXT, READ THIS FIRST. This is an asset for Duel Summoner, a bright, stylized 3D horde-survival video game. The player is a duelist who throws cards and summons monsters out of them while hundreds of enemies swarm in the ruins of a sunlit kingdom built around giant stone playing cards. The camera sits behind and above the player, so everything is seen small and from above: big simple shapes and strong colours matter, and tiny details are lost. The whole game shares one look: chunky low-poly toy-like shapes, flat-shaded faces, and small hand-painted pixel-art textures with hard square pixels.';
const USE = {
  concept: 'WHAT THIS PICTURE IS FOR. It is the reference picture for a 3D model. I will upload it to an image-to-3D tool, which rebuilds exactly what it sees as a 3D object. So the picture must show ONE thing, complete from top to bottom with nothing cut off, evenly lit with no dark shadows, on a plain flat light grey background with no floor, no scenery, and nothing touching or overlapping it. No motion blur, no effects, no smoke, no glow clouds, no sparkles: the game adds those itself.',
  part: 'WHAT THIS PICTURE IS FOR. It is the reference picture for ONE SEPARATE PART of a 3D model. The game moves this part on its own (it flaps, swings, opens or turns), so I need it as its own 3D piece. I will upload the picture to an image-to-3D tool. So show only this part, complete, with a clean flat end where it joins the body, evenly lit, on a plain flat light grey background with nothing else in the picture.',
  swatch: 'WHAT THIS PICTURE IS FOR. It is a surface texture. The game repeats this one picture side by side across large 3D surfaces, thousands of times. So it must be ONE flat tile, seen exactly from above, filling the whole picture, whose left edge continues into its right edge and whose top continues into its bottom with no visible seam. Do not draw the pattern several times inside the picture. Scatter the shapes at random sizes and angles: no rows, no stripes, no grid, nothing that would look like wallpaper when repeated, and no single stand-out feature (it would repeat visibly). No perspective, no horizon, no shadows cast from outside the tile.',
  sheet: 'WHAT THIS PICTURE IS FOR. It is a sheet of small icons for the game\'s screens. I cut the sheet into separate icons, and each one is shown at only 48 to 96 pixels. So each icon must be one big bold shape with a thick dark outline, clearly separated from its neighbours, the same size and style as the others, with no small details.',
  ui: 'WHAT THIS PICTURE IS FOR. It is a piece of the game\'s interface (a frame, bar, button or plate). The game draws all words and numbers itself and stretches or fills this piece, so it must be EMPTY, seen flat from the front with no perspective, on a plain flat black background, with crisp edges.',
  paint: 'WHAT THIS PICTURE IS FOR. It is a painted illustration shown in the game\'s menus or on a card. It should feel like the game: the same chunky shapes and bright sunlit colours, readable at small size, with one clear subject.',
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
  return clip(`${lead}: ${(a.meshy || subject).replace(/\.?$/, '.')} Flat-shaded faces, hand-painted pixel-art texture, bright clean colours, no tiny details.`, 590);
};
const symOf = a => /tree|rock|rubble|cliff|bones|dune|crystal|web|stalactite|reeds|basalt|treasure/i.test(a.file) ? 'OFF (it is lopsided on purpose)' : 'ON';
const meshySteps = (a, tris, pic, glb, textPrompt) => ({ text: [
  `1. Open Meshy and choose "Image to 3D".`,
  `2. Upload the picture you just made (${pic}).`,
  `3. Settings: polygons about ${tris.toLocaleString('en')} (pick the lowest setting at or above that; I trim the rest), topology "Triangle", symmetry ${symOf(a)}${a.view === 'biped' ? ', pose "A-pose"' : ''}.`,
  `4. Generate. Pick the result that matches the picture best from every side. Check the back: no holes, no extra limbs, no melted face.`,
  `5. Download as GLB twice: once WITH texture, once WITHOUT (plain). Save them as ${glb} and ${glb.replace('.glb', '-plain.glb')}.`,
].join('\n'), alt: textPrompt });
const RIG_CLIPS = { person: 'Idle, Walking, Running', enemy: 'Idle, Walking (zombie or slow), Running', boss: 'Idle, Walking (heavy)' };
const rigSteps = (a, glb) => [
  `1. In Meshy, open the model you just made and choose "Rig" (or "Animate").`,
  `2. Choose the humanoid (two-legged) rig. Set the height to about ${a.h} m.`,
  `3. Place the markers it asks for (chin, shoulders, elbows, wrists, hips, knees, ankles) on the model and confirm.`,
  `4. From the FREE animation library add only these clips: ${RIG_CLIPS[a.style] || RIG_CLIPS.person}. If a name is missing, pick the closest one. Do not spend credits on Text to Motion: I make every other move in code.`,
  `5. Download as GLB "with animations" and save it as ${glb.replace('.glb', '-anim.glb')}.`,
  ``,
  `That is all you do. I retime the clips, blend them, and make every other move in code for free: ${a.anim}.`,
].join('\n');
const creatureRigSteps = (a, glb) => [
  `1. In Meshy, open the model you just made (${glb}) and choose "Rig" (or "Animate").`,
  `2. Let Meshy place the skeleton. If it asks for a type, pick the closest: four-legged, winged, or two-legged.`,
  `3. Look at the skeleton lines: they should run down the spine and tail to the tip, out along each wing to the tip, down each leg, and into the head. If a wing or the tail has no bones, try the rig once more.`,
  `4. Do NOT add any animation clips and do not use Text to Motion. No credits needed for movement.`,
  `5. Download as GLB and save it as ${glb.replace('.glb', '-rig.glb')}.`,
  ``,
  `That is all you do. One model with a skeleton replaces all the separate wing, tail and jaw models. I make every move in code for free: ${a.anim || 'idle, walk or fly, attack, hurt, defeat'}.`,
].join('\n');

const P = (lines) => lines.filter(Boolean).join('\n\n');
const conceptPrompt = (a, subject, o = {}) => P([
  GAME, USE.concept,
  `WHAT IT IS IN THE GAME. ${a.name}${o.sub ? ' (' + o.sub + ')' : ''}: ${a.where || ''}${a.attack ? '. Its attack: ' + a.attack : ''}.`,
  MOVES[(a.rig && a.rig.startsWith('meshy') ? 'meshy' : a.rig) || (a.anim ? 'bend' : 'none')],
  STYLE[a.style] || STYLE.model,
  'SUBJECT. ' + subject,
  VIEW[a.view] || VIEW.model,
  (o.h || a.h) ? `SIZE. In the game it is about ${o.h || a.h} m tall, ${rel(o.h || a.h)}.` : '',
  a.element ? `ELEMENT. Its element is ${a.element}: use that colour for its glow and markings.` : '',
  'Make the picture square, 1024 x 1024.',
  NEVER,
]);
const partPrompt = (a, part, subject) => P([GAME, USE.part, `WHAT IT BELONGS TO. ${a.name}: ${subject}`, STYLE[a.style] || STYLE.model, `SUBJECT. Only the ${part} of the ${a.style === 'model' ? 'object' : 'creature'} described above, on its own, matching its colours and shapes exactly.`, VIEW.part, 'Make the picture square, 1024 x 1024.', NEVER]);

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
    if (a.forms && a.forms.length) a.forms.forEach(([subj, tris], i) => variants.push({ sfx: `-f${i + 1}`, label: `Form ${i + 1} of 3`, subj: `${a.name}, form ${i + 1} of 3 (${['baby', 'young', 'grown'][i]}): ${subj}.`, short: subj, tris, h: [0.9, 1.8, 3.6][i] }));
    else if (a.formsAuto) [['young, smaller and softer, with rounder shapes, shorter horns, crests and wings, and a weaker glow', 0.7, 0.8], ['adult, exactly as described', 1, 1], ['fully grown and crowned: bigger and heavier, with extra armour plates, longer horns and crests, and a much stronger glow', 1.25, 1.2]].forEach(([m, k, hk], i) => variants.push({ sfx: `-f${i + 1}`, label: `Form ${i + 1} of 3`, subj: `${a.name}, form ${i + 1} of 3 (${m}): ${a.subj}`, short: a.subj, tris: Math.round(a.tris * k / 50) * 50, h: +(a.h * hk).toFixed(1) }));
    else if (a.subj) variants.push({ sfx: '', label: '', subj: a.subj, short: a.subj, tris: a.tris || 300, h: a.h });
    for (const v of variants) {
      const pic = `${a.file}${v.sfx}.png`, glb = `${a.file}${v.sfx}.glb`, L = v.label ? v.label + ': ' : '';
      add(pic, L + 'make the picture', 'ChatGPT', conceptPrompt(a, v.subj, { h: v.h, sub: v.label }), ROOT + '2d\\concepts\\' + pic, { copy: true });
      add(glb, L + 'turn the picture into a 3D model', 'Meshy', meshySteps(a, v.tris, pic, glb, meshyText(a, v.short)), ROOT + '3d\\' + glb);
    }
    (a.outfits || []).forEach(([nm, subj], i) => {
      const pic = `${a.file}-outfit${i + 1}.png`, glb = `${a.file}-outfit${i + 1}.glb`;
      add(pic, `Outfit ${i + 1} "${nm}": make the picture`, 'ChatGPT', conceptPrompt(a, `${subj}. Same face, hair, body and proportions as the base duelist, who is: ${a.subj}`, { sub: 'outfit: ' + nm }), ROOT + '2d\\concepts\\' + pic, { copy: true });
      add(glb, `Outfit ${i + 1} "${nm}": turn it into a 3D model`, 'Meshy', meshySteps(a, a.tris, pic, glb, meshyText(a, subj)), ROOT + '3d\\' + glb);
    });
    const raw = typeof a.parts === 'string' ? a.parts.split(/,\s*/) : Array.isArray(a.parts) ? a.parts : [];
    const parts = raw.filter(p => !/in code|if possible/.test(p)).map(p => p.replace(/\(.*\)/, '').trim()).filter(p => p && p !== 'body' && p !== 'frame' && p !== 'stand');
    const living = ['creature', 'enemy', 'boss'].includes(a.style) && !(a.rig && a.rig.startsWith('meshy')) && a.rig !== 'vat';
    if (living) { for (const v of variants) { const glb = `${a.file}${v.sfx}.glb`; add(glb.replace('.glb', '-rig.glb'), (v.label ? v.label + ': ' : '') + 'give it a skeleton', 'Meshy', creatureRigSteps(a, glb), ROOT + '3d\\' + glb.replace('.glb', '-rig.glb')); } }
    else if ((a.subj || (a.forms && a.forms.length)) && parts.length) {
      const base = a.forms && a.forms.length ? `${a.forms[a.forms.length - 1][0]} (the grown form)` : a.subj;
      for (const p of parts) {
        const f = `${a.file}-part-${p.replace(/\s+/g, '-')}`;
        add(f + '.png', `Moving part "${p}": make the picture`, 'ChatGPT', partPrompt(a, p, base), ROOT + '2d\\concepts\\' + f + '.png', { copy: true });
        add(f + '.glb', `Moving part "${p}": turn it into a 3D model`, 'Meshy', meshySteps(a, 150, f + '.png', f + '.glb', clip(`Low-poly stylized game asset part: only the ${p} of ${base.replace(/\.?$/, '.')} Flat-shaded, hand-painted pixel-art texture.`, 590)), ROOT + '3d\\parts\\' + f + '.glb');
      }
    }
    if (a.rig && a.rig.startsWith('meshy') && a.subj) add(`${a.file}-anim.glb`, 'Give it a skeleton and animations', 'Meshy', rigSteps(a, a.file + '.glb'), ROOT + '3d\\' + a.file + '-anim.glb');
  } else if (a.how === 'swatch') {
    add(a.file + '.png', 'Make the texture', 'ChatGPT', P([GAME, USE.swatch, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, STYLE.swatch, 'SUBJECT. ' + a.subj, 'Make the picture square, 1024 x 1024, one tile filling the whole picture edge to edge.', NEVER]), ROOT + '2d\\textures\\' + a.file + '.png', { copy: true });
  } else if (a.how === 'sheet') {
    const rows = ['Top row', 'Middle row', 'Bottom row'];
    const list = rows.map((r, ri) => `${r}, left to right:\n` + a.cells.slice(ri * 3, ri * 3 + 3).map((c, ci) => `${ri * 3 + ci + 1}. ${c[1]} (this is the icon for "${c[0]}")`).join('\n')).join('\n');
    add(a.file + '.png', 'Make the sheet of nine', 'ChatGPT', P([GAME, a.ctx || USE.sheet, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, STYLE[a.style] || STYLE.icon, `LAYOUT. Nine separate ${a.ctx ? 'decals' : 'icons'} in a 3 by 3 grid on a flat pure ${a.ctx ? 'white' : 'black'} background, all the same size, evenly spaced, none touching, each fully inside its cell and seen straight on.${a.note ? ' ' + a.note : ''}`, list, 'Make the picture square, 1024 x 1024.', NEVER]), ROOT + '2d\\icons\\' + a.file + '.png', { copy: true });
  } else if (a.how === 'fx') {
    const lay = a.frames > 1 ? `LAYOUT. ${a.frames} frames, left to right then top to bottom, in a 4 by 4 grid of equal square cells${a.frames < 16 ? ' (leave the unused cells pure black)' : ''}. The effect stays centred in each cell at the same scale, and each frame changes a little from the last so they play as smooth animation.` : 'LAYOUT. One single image, centred.';
    add(a.file + '.png', a.frames > 1 ? `Make the ${a.frames}-frame sheet` : 'Make the effect picture', 'ChatGPT', P([GAME, USE.fx, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, STYLE.fx, 'SUBJECT. ' + a.subj, lay, 'Make the picture square, 1024 x 1024.', NEVER]), ROOT + '2d\\fx\\' + a.file + '.png', { copy: true });
  } else if (a.how === '2d') {
    const isLogo = a.code === 'KA02', isUi = a.style === 'ui' || a.style === 'fx';
    const never = isLogo ? NEVER.replace('Not allowed anywhere: text, letters, numbers, runes or writing of any kind;', 'Not allowed anywhere: text or letters (I add the title myself);') : NEVER;
    const who = a.portraitOf ? ' ' + (DUELISTS.find(d => d.name === a.portraitOf) || {}).subj : '';
    add(a.file + '.png', 'Make the picture', 'ChatGPT', P([GAME, isUi ? USE.ui : USE.paint, `WHAT IT IS IN THE GAME. ${a.name}: ${a.where}.`, STYLE[a.style] || STYLE.ui, 'SUBJECT. ' + a.subj + who, `Make the picture ${a.px.split(' made')[0]}.`, never]), ROOT + '2d\\' + (isUi ? 'ui' : 'art') + '\\' + a.file + '.png', { copy: true });
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
const SND = SOUNDS.map(s => ({ code: s.code, name: s.name, file: s.file, how: 'sound', where: 'plays in the game', len: s.len, vars: s.vars, loop: s.loop,
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
const FIRST = ['MT01', 'MT29', 'MT04', 'MT05', 'MT08', 'MT09', 'MT11', 'W101', 'W103', 'W106', 'W109', 'W110', 'W111', 'W118', 'W119', 'W114', 'W116', 'EN01', 'EN02', 'EN03', 'EN04', 'EN05', 'EN06', 'UI01', 'UI02', 'UI03', 'UI06', 'UI07', 'UI10', 'UI14', 'IC11', 'WX01', 'WX02', 'PK02', 'PK04', 'IC01', 'IC02', 'CH01', 'SM01', 'SM02'];

const DATA = { groups: [], assets: [], have: [] };
const seen = new Set(), keys = new Set();
for (const g of GROUPS) {
  DATA.groups.push({ id: g.id, title: g.title, kind: g.kind, blurb: g.blurb });
  for (const a of g.items) {
    if (seen.has(a.code)) throw new Error('duplicate code ' + a.code); seen.add(a.code);
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
    DATA.assets.push({ c: a.code, n: a.name, g: g.id, w: a.where || '', anim, facts, steps, mine: a.how === 'code' || !steps.length });
    for (const f of a.haveFiles || []) { if (!keys.has(f)) throw new Error('haveFiles unknown ' + f); DATA.have.push(f); }
  }
}
for (const s of SCREENS) for (const u of s.uses) if (!seen.has(u)) throw new Error('screen ' + s.name + ' uses unknown ' + u);
for (const c of FIRST) if (!seen.has(c)) throw new Error('FIRST unknown ' + c);
DATA.first = FIRST;
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
console.log(JSON.stringify({ assets: DATA.assets.length, steps: nSteps, copyPrompts: DATA.assets.reduce((n, a) => n + a.steps.filter(s => s.copy).length, 0), kb: Math.round(html.length / 1024), web: WEB }));
