// Builds the Duel Summoner Asset Book page.  node make.mjs <out.html>
import fs from 'node:fs';
import { LOOK_NAME, PILLARS, PALETTES, SCALE, BUDGETS, PIPELINE, NEVER, STYLE, VIEW } from './look.mjs';
import { SWATCHES, STAGE1, STAGE2, STAGE3, INTERACT } from './world.mjs';
import { DUELISTS, SUMMONS, FUSIONS, GODS, ENEMIES, BOSSES, NPCS } from './cast.mjs';
import { PICKUPS, ITEM_SHEETS, SPELLS, EFFECTS, UIKIT, SCREENART, PORTRAITS, REGALIA } from './ui.mjs';
import { SOUND_RULES, SOUNDS, MUSIC_RULES, MUSIC } from './audio.mjs';
import { SCREENS } from './screens.mjs';

const out = process.argv[2] || 'asset-book.html';
const achievements = JSON.parse(fs.readFileSync(new URL('./achievements.json', import.meta.url)));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,;:]$/, '') + '.';
const rel = h => h >= 1.8 ? `${(h / 1.8).toFixed(h >= 18 ? 0 : 1)} times the height of the player` : `${Math.round(h / 1.8 * 100)} per cent of the player\'s height`;

// ---------------------------------------------------------------- prompt builders
const meshy = (a, subject) => {
  const lead = { creature: 'Low-poly stylized cute creature, chunky proportions, big head and feet', enemy: 'Low-poly stylized game enemy, chunky readable silhouette', boss: 'Low-poly stylized giant boss, monumental chunky shapes', person: 'Low-poly stylized game character, chunky proportions, A-pose', model: 'Low-poly stylized game prop, chunky toy-like shapes, big bevels' }[a.style] || 'Low-poly stylized game asset';
  return clip(`${lead}: ${(a.meshy || subject).replace(/\.?$/, ".")} Flat-shaded faces, hand-painted pixel-art texture, bright clean colours, no tiny details.`, 590);
};
const meshySettings = (a, tris) => {
  const sym = /tree|rock|rubble|cliff|bones|dune|crystal|web|stalactite|reeds|basalt/i.test(a.file) ? 'off' : 'on';
  const pose = a.view === 'biped' ? 'A-pose, then Rig with the humanoid rig' : a.view === 'beast' ? 'neutral pose, no rig' : 'no rig';
  return `Meshy settings: Image to 3D (upload the picture). Target about ${tris.toLocaleString('en')} triangles, triangle mesh, symmetry ${sym}, ${pose}. Download the textured GLB and the plain GLB.`;
};
const concept = (a, subject, view = a.view, h = a.h) => [
  STYLE[a.style] || STYLE.model,
  'Subject: ' + subject,
  VIEW[view] || VIEW.model,
  h ? `Size in the game: about ${h} m tall, ${rel(h)}. Seen from a high camera, so the big shapes must read and small details will vanish.` : '',
  a.element ? `Its element is ${a.element}: use that colour for its glow and markings.` : '',
  'Make the picture 1024 x 1024.',
  NEVER,
].filter(Boolean).join('\n\n');
const partPrompt = (a, part, subject) => [STYLE[a.style] || STYLE.model, `Subject: only the ${part} of this ${a.style === "model" ? "object" : "creature"}, on its own, matching it exactly: ${subject}`, VIEW.part, 'Make the picture 1024 x 1024.', NEVER].join('\n\n');

function promptsFor(a) {
  const P = [];
  if (a.how === 'model') {
    const forms = a.forms && a.forms.length ? a.forms : null;
    if (forms) forms.forEach(([subj, tris], i) => {
      const h = [0.9, 1.8, 3.6][i];
      const full = `${a.name}, form ${i + 1} of 3: ${subj}`;
      P.push({ label: `Form ${i + 1} picture (ChatGPT)`, text: concept(a, full, a.view, h), file: `${a.file}-f${i + 1}.png` });
      P.push({ label: `Form ${i + 1} model (Meshy)`, text: meshy(a, subj) + '\n\n' + meshySettings(a, tris), file: `${a.file}-f${i + 1}.glb` });
    });
    else if (a.subj) {
      P.push({ label: 'Picture (ChatGPT)', text: concept(a, a.subj), file: a.file + '.png' });
      P.push({ label: 'Model (Meshy)', text: meshy(a, a.subj) + '\n\n' + meshySettings(a, a.tris || 300), file: a.file + '.glb' });
      (a.outfits || []).forEach(([nm, subj], i) => {
        P.push({ label: `Outfit ${i + 1}: ${nm} (ChatGPT)`, text: concept(a, subj + '. Same face, body and proportions as the base duelist: ' + a.subj), file: `${a.file}-outfit${i + 1}.png` });
      });
    }
    const parts = typeof a.parts === 'string' ? a.parts.split(/,\s*/).filter(p => !/body|built in code|bent in code|we copy|mirror/.test(p) || /left wing|leg/.test(p)) : Array.isArray(a.parts) ? a.parts.filter(p => p !== 'body') : [];
    if (a.subj && parts.length) parts.forEach(p => P.push({ label: `Part: ${p.replace(/\(.*\)/, '').trim()} (ChatGPT, then Meshy)`, text: partPrompt(a, p.replace(/\(.*\)/, '').trim(), a.subj), file: `${a.file}-${p.replace(/\(.*\)/, '').trim().replace(/\s+/g, '-')}.png` }));
  } else if (a.how === 'swatch') {
    P.push({ label: 'Texture (ChatGPT)', text: [STYLE.swatch, 'Subject: ' + a.subj, 'Make the picture 1024 x 1024, one tile filling the whole picture edge to edge.', NEVER].join('\n\n'), file: a.file + '.png' });
  } else if (a.how === 'sheet') {
    const rows = ['Top row', 'Middle row', 'Bottom row'];
    const list = rows.map((r, ri) => `${r}, left to right:\n` + a.cells.slice(ri * 3, ri * 3 + 3).map((c, ci) => `${ri * 3 + ci + 1}. ${c[1]} (for "${c[0]}")`).join('\n')).join('\n');
    P.push({ label: 'Sheet of nine (ChatGPT)', text: [STYLE[a.style] || STYLE.icon, `Nine separate game icons in a 3 by 3 grid on a flat pure black background, all the same size, evenly spaced, none touching, each fully inside its cell and seen straight on. Each one is shown at 48 to 64 pixels in the game, so one big bold shape each, thick outlines, no small details.${a.note ? ' ' + a.note : ''}`, list, 'Make the picture 1024 x 1024.', NEVER].join('\n\n'), file: a.file + '.png' });
  } else if (a.how === 'fx') {
    const lay = a.frames > 1 ? `Lay out ${a.frames} frames left to right, top to bottom, in a 4 by 4 grid of equal square cells${a.frames < 16 ? ' (leave the unused cells pure black)' : ''}. The effect stays centred in each cell and keeps the same scale so the frames play as a smooth loop.` : 'One single image, centred.';
    P.push({ label: a.frames > 1 ? `Sprite sheet, ${a.frames} frames (ChatGPT)` : 'Effect texture (ChatGPT)', text: [STYLE.fx, 'Subject: ' + a.subj, lay, 'Make the picture 1024 x 1024.', NEVER].join('\n\n'), file: a.file + '.png' });
  } else if (a.how === '2d') {
    const isLogo = a.code === 'KA02';
    P.push({ label: 'Picture (ChatGPT)', text: [STYLE[a.style] || STYLE.ui, 'Subject: ' + a.subj + (a.portraitOf ? ' ' + (DUELISTS.find(d => d.name === a.portraitOf) || {}).subj : ''), `Make the picture ${a.px.split(' made')[0]}.`, isLogo ? NEVER.replace('Not allowed anywhere: text, letters, numbers, runes or writing of any kind;', 'Not allowed anywhere: text or letters (I add the title myself);') : NEVER].join('\n\n'), file: a.file + '.png' });
  }
  return P;
}

// Card art for every creature: a painting for the card window.
const creatures = [...SUMMONS.filter(s => s.forms && s.forms.length), ...FUSIONS, ...GODS];
const CARDART = creatures.map((c, i) => ({ code: 'CA' + String(i + 1).padStart(2, '0'), name: 'Card art: ' + c.name, file: 'card-' + c.file.replace(/^(mon|fus|god)-/, ''), how: '2d', style: 'paint', px: '1024 x 768 made, 192 x 144 in game', where: 'the picture on its monster card (offers, Card Library, Fusion banner)',
  subj: `${c.forms ? c.forms[1][0] : c.subj} Shown in a heroic action pose doing its attack (${c.attack}), in a scene from the sunlit card-kingdom ruins, its ${c.element} colour lighting the scene.` }));

// Achievement badges in sheets of nine.
const cleanLore = s => (s.match(/Lore: '([^']+)'/) || [, ''])[1].replace(/Hollow Pharaoh|Pharaoh/g, 'Hollow King').replace(/Eye of the Sealed One/g, 'the secret boss');
const ACH = [];
for (let i = 0; i < achievements.length; i += 9) {
  const chunk = achievements.slice(i, i + 9);
  while (chunk.length < 9) chunk.push({ name: 'Spare', condition: "Lore: 'a plain gold laurel ring with nothing inside'" });
  ACH.push({ code: 'AC' + String(i / 9 + 1).padStart(2, '0'), name: `Achievement badges ${i + 1} to ${Math.min(i + 9, achievements.length)}`, file: `badges-s${i / 9 + 1}`, how: 'sheet', style: 'icon', px: '1024 x 1024 made (3 x 3), 96 x 96 each in game', where: 'Achievements page in the app, results, toasts',
    note: 'Each is a round badge: a thick gold laurel rim, a deep teal field, and one bold picture of the feat in the middle.', cells: chunk.map(a => [a.name, 'a badge for the feat "' + a.name + '": ' + (cleanLore(a.condition) || a.name)]) });
}

const GROUPS = [
  { id: 'materials', title: 'Ground and surface textures', blurb: 'Seamless pixel textures. Every prop in a stage is painted with these, so the whole stage shares one texture page and looks hand-made but costs almost nothing.', items: SWATCHES },
  { id: 'stage1', title: 'Stage 1: Surface Ruins', blurb: 'Trees, bushes, rocks, ruins and landmarks. This is what you circled in your screenshot, and more.', items: STAGE1 },
  { id: 'stage2', title: 'Stage 2: Sealed Catacombs', blurb: 'Crypt kit pieces and props. Boulders, cliffs and crates come back from Stage 1, re-tinted.', items: STAGE2 },
  { id: 'stage3', title: 'Stage 3: Vault of the Last Duel', blurb: 'The cavern, the sand sea, the statues and the throne.', items: STAGE3 },
  { id: 'interact', title: 'Chests, shrines, gates and things you use', blurb: 'Everything with a "used" moment. Moving parts are listed so the opening and lighting can be animated.', items: INTERACT },
  { id: 'pickups', title: 'Pickups', blurb: 'Oversized so they read from the camera.', items: PICKUPS },
  { id: 'duelists', title: 'Duelists and outfits', blurb: 'Playable characters, rigged in Meshy. Each has three outfits for mastery and quests.', items: DUELISTS },
  { id: 'summons', title: 'Summoned monsters (three forms each)', blurb: 'Form 1 is a baby (0.5x), form 2 young (1x), form 3 grown (2x). The creature roster is its own project with your approval; these are the monsters in the build today, written as creatures. Robed people are flagged.', items: SUMMONS },
  { id: 'fusions', title: 'Fusions and God Fusions', blurb: 'Two monsters become one. Big, proud and clever: each Fusion shows both of its parents in its shape.', items: [...FUSIONS, ...GODS] },
  { id: 'enemies', title: 'Swarm enemies', blurb: 'Hundreds on screen, so they are cheap: one model each, animation baked into the model, tinted per stage.', items: ENEMIES },
  { id: 'bosses', title: 'Elites, timed bosses and gate bosses', blurb: 'Big and theatrical. Every attack has a wind-up pose you can read.', items: BOSSES },
  { id: 'npcs', title: 'People in the world', blurb: 'At player size.', items: NPCS },
  { id: 'regalia', title: 'Regalia (hats)', blurb: 'Worn on any duelist. Found on maps or earned by quests.', items: REGALIA },
  { id: 'cardart', title: 'Card art', blurb: 'The painting inside every card: monsters, Fusions, Gods, Spells and Traps.', items: [...CARDART, ...SPELLS] },
  { id: 'icons', title: 'Item, stat, element and Oath icons', blurb: 'Sheets of nine. I cut them up.', items: ITEM_SHEETS },
  { id: 'ui', title: 'HUD and menu pieces', blurb: 'The frame of every window, bar and button. Pieces are empty; all words and numbers are drawn by the game.', items: UIKIT },
  { id: 'art', title: 'Key art, map cards, portraits and backdrops', blurb: 'The painted pictures that sell the game.', items: [...SCREENART, ...PORTRAITS] },
  { id: 'fx', title: 'Effects', blurb: 'Sprite sheets and textures. The game moves, scales, tints and stacks them; one picture serves many effects.', items: EFFECTS },
  { id: 'badges', title: 'Achievement badges', blurb: `All ${achievements.length} Duel Summoner achievements, nine to a sheet.`, items: ACH },
];
for (const g of GROUPS) for (const a of g.items) a.prompts = promptsFor(a);
const ALL = GROUPS.flatMap(g => g.items);
const codes = new Set(ALL.map(a => a.code));
for (const s of SCREENS) for (const u of s.uses) if (!codes.has(u)) throw new Error('screen ' + s.name + ' uses unknown ' + u);
const dup = ALL.map(a => a.code).filter((c, i, l) => l.indexOf(c) !== i); if (dup.length) throw new Error('duplicate codes ' + dup);
const nPrompts = ALL.reduce((n, a) => n + a.prompts.length, 0);
const nPieces = ALL.reduce((n, a) => n + (a.cells ? a.cells.length : a.forms && a.forms.length ? a.forms.length : 1) + (a.outfits ? a.outfits.length : 0), 0);
const STATE = { have: 'Have', roster: 'Waiting on the roster', 'roster-ok': 'Roster pick', need: 'Need' };

const FIRST = [
  ['Ground and trees', ['MT01', 'MT04', 'MT05', 'MT08', 'MT09', 'MT11', 'W101', 'W103', 'W106', 'W109', 'W110', 'W111']],
  ['The landmark look', ['W118', 'W119', 'W114', 'W116', 'W128', 'W132']],
  ['The swarm', ['EN01', 'EN02', 'EN03', 'EN04', 'EN05', 'EN06']],
  ['The frame of every screen', ['UI01', 'UI02', 'UI03', 'UI06', 'UI07', 'UI10', 'UI14', 'IC11']],
  ['Loot that pops', ['WX01', 'WX02', 'PK02', 'PK04', 'IC01', 'IC02']],
];

const ANIM = [
  ['How smooth motion is made', ['Every animation has anticipation (a wind-up), action, and follow-through (overshoot and settle). Nothing starts or stops dead.', 'Easing everywhere: ease-out for things arriving, ease-in for things leaving, a springy overshoot for anything cute.', 'Squash and stretch on hits, landings, jumps and summons (5 to 15 per cent, 80 to 120 ms).', 'Hit-stop: 2 to 4 frames on elite and boss hits, 1 frame on crits. Camera shake scales with hit size and is a setting.', 'Idle never freezes: breathing, bobbing, blinking, a fidget every 4 to 8 s, random offsets so a crowd never moves in step.', 'The game runs its simulation at a fixed 60 per second and draws in between, so motion is smooth at 120 Hz.']],
  ['Duelists, people, husks, humanoid bosses', ['Meshy auto-rig (humanoid) on the A-pose model. Pick from its library: idle, walk, run, jump, attack, hit, die. I retime and blend them.', 'Card throw plays on the upper body only, so you can throw while running.', 'Clips we add in code: summon pose, Fusion pose, chest kneel, level-up flourish.']],
  ['Creatures: dragons, beasts, ghosts, spirits', ['Made from parts: body plus wings, tail, jaw or legs as separate models (each card lists them).', 'Code moves the parts on curves: wing flap with a slow up-stroke and fast down-stroke, tail sway that lags behind the body, head bob, jaw open on attack, a breathing scale pulse.', 'Walk cycles for four-legged creatures: legs as parts that swing in pairs, body bob twice per cycle.', 'Nose smoke, lava glow, flickering flames and crystal shimmer are effects attached to points on the model.']],
  ['Swarm enemies', ['One model per type with the animation baked in (4 to 8 frame loops) so hundreds draw in one go.', 'Every one gets a random start frame and a speed of plus or minus 10 per cent.', 'Hit flash white, squash on hit, dissolve on death and status tints are done in the material, costing nothing extra.']],
  ['World and UI', ['Chests, gates, bells, scales and doors move by their parts (lid hinge, door swing, bell swing).', 'Platforms shake 1.5 s before they flip. Bridges sway. Jump pads pulse.', 'Cards deal in, flip with a slight lift and a shine sweep, and settle with a small bounce. Menus slide in 160 ms with ease-out; nothing pops in.']],
];
const FXRULES = ['Every effect is one of the sprite sheets or textures above, moved, tinted, scaled and stacked by the game, so 30 pictures give hundreds of effects.', 'Effects are additive light on dark ground and stay under 40 per cent screen cover so you never lose your duelist; your summons\' effects can be faded in Settings.', 'Every hit has three parts: a flash on the target, a spark at the contact point, and a number. Crits add a ring and a bigger number.', 'Danger is always red-orange on the ground with a clear edge and a fill that grows until it fires. Nothing hurts without a tell.', 'Loot always glints gold or cyan, and big loot gets a light beam you can see from far away.'];

// ---------------------------------------------------------------- page
const assetCard = (a, g) => {
  const meta = [
    a.how === 'model' ? (a.tris ? `${(a.forms && a.forms.length ? a.forms.map(f => f[1]).join(' / ') : a.tris).toLocaleString('en')} triangles` : '') : '',
    a.h ? `${a.h} m` : '', a.px || '', a.frames > 1 ? `${a.frames} frames` : '',
    a.rig ? { meshy: 'Meshy rig', parts: 'animated by parts', vat: 'baked animation', bend: 'animated in code', 'meshy then baked': 'Meshy rig, then baked' }[a.rig] : '',
  ].filter(Boolean).map(esc).join(' · ');
  const st = a.state || (a.how === 'code' ? 'code' : 'need');
  const stLabel = st === 'code' ? 'I make it' : STATE[st] || 'Need';
  const body = [
    `<dl class="facts"><dt>Save as</dt><dd><code>${esc(a.file)}</code></dd><dt>Where</dt><dd>${esc(a.where || '')}</dd>${a.anim ? `<dt>Moves</dt><dd>${esc(a.anim)}</dd>` : ''}${a.attack ? `<dt>Attack</dt><dd>${esc(a.attack)}</dd>` : ''}${a.recipe ? `<dt>Recipe</dt><dd>${esc(a.recipe)}</dd>` : ''}${a.parts ? `<dt>Parts</dt><dd>${esc(Array.isArray(a.parts) ? a.parts.join(', ') : a.parts)}</dd>` : ''}${a.have ? `<dt>Have</dt><dd>${esc(a.have)}</dd>` : ''}${a.note ? `<dt>Note</dt><dd>${esc(a.note)}</dd>` : ''}${a.how === 'code' ? `<dt>How</dt><dd>${esc(a.subj)}</dd>` : ''}</dl>`,
    ...a.prompts.map((p, i) => `<div class="prompt"><div class="ph"><span>${esc(p.label)}</span><span class="pf">${esc(p.file)}</span><button type="button" class="copy" data-t="${a.code}-${i}">Copy</button></div><pre id="${a.code}-${i}">${esc(p.text)}</pre></div>`),
  ].join('');
  return `<details class="asset" id="${a.code}" data-q="${esc((a.code + ' ' + a.name + ' ' + a.file + ' ' + (a.where || '')).toLowerCase())}"><summary><span class="code">${a.code}</span><span class="nm">${esc(a.name)}</span><span class="meta">${meta}</span><span class="st st-${st}">${stLabel}</span><label class="made" title="Tick when made"><input type="checkbox" data-made="${a.code}" aria-label="Made: ${esc(a.name)}"> made</label></summary><div class="ab">${body}</div></details>`;
};

const swatchRow = p => `<div class="pal"><h4>${esc(p.stage)}</h4><p>${esc(p.mood)}</p><div class="chips">${p.colours.map(([hx, n]) => `<span class="chip"><i style="background:${hx}"></i>${esc(n)}<small>${hx}</small></span>`).join('')}</div></div>`;
const table = (head, rows) => `<div class="tw"><table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const html = `<title>Duel Summoner Asset Book</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>
/* Layout: a field manual. Sandstone page, teal and gold like the game's own frames; a sticky index; every asset a row that opens to its prompts. */
:root{--bg:#f3ead6;--panel:#fbf6ea;--ink:#2a2118;--mute:#6f5d47;--line:#d8c6a2;--teal:#1f7f8c;--teal-ink:#fff;--gold:#b0801f;--warn:#a3203a;--code:#efe4cc;
--disp:'Pixelify Sans',ui-monospace,monospace;--body:'IBM Plex Sans',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121a22;--panel:#1a2530;--ink:#efe6d2;--mute:#a9b4bd;--line:#2f4050;--teal:#3fc2d0;--teal-ink:#0d1418;--gold:#e3b23c;--warn:#ff7a8a;--code:#0f161d;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#121a22;--panel:#1a2530;--ink:#efe6d2;--mute:#a9b4bd;--line:#2f4050;--teal:#3fc2d0;--teal-ink:#0d1418;--gold:#e3b23c;--warn:#ff7a8a;--code:#0f161d;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:15px/1.55 var(--body)}
.wrap{max-width:1100px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:24px 80px}
h1,h2,h3{font-family:var(--disp);text-wrap:balance;letter-spacing:.01em;line-height:1.15}
h1{font-size:clamp(34px,6vw,56px);margin:8px 0 4px;color:var(--teal)}
h2{font-size:28px;margin:48px 0 8px;padding-top:8px;border-top:3px solid var(--gold)}
h3{font-size:20px;margin:28px 0 6px}
h4{margin:0 0 2px;font-size:15px}
p{max-width:70ch}
.lede{font-size:17px;color:var(--mute);max-width:65ch}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}
.stat{background:var(--panel);border:1px solid var(--line);padding:10px 14px;min-width:130px}
.stat b{display:block;font:700 28px var(--disp);color:var(--teal);font-variant-numeric:tabular-nums}
nav.toc{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
nav.toc a{font:600 13px var(--body);color:var(--ink);text-decoration:none;padding:3px 8px;border:1px solid var(--line);background:var(--panel)}
nav.toc a:hover,nav.toc a:focus-visible{border-color:var(--teal);outline:none}
#q{flex:1 1 180px;min-width:0;font:14px var(--body);padding:6px 10px;border:1px solid var(--line);background:var(--panel);color:var(--ink)}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px}
.pill{background:var(--panel);border:1px solid var(--line);padding:12px 14px}
.pill p{margin:4px 0 0;color:var(--mute);font-size:14px}
.pal{margin:14px 0}.pal p{margin:2px 0 8px;color:var(--mute);font-size:14px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--panel);border:1px solid var(--line);padding:3px 8px 3px 3px;font-size:13px}
.chip i{width:22px;height:22px;display:inline-block;border:1px solid rgba(0,0,0,.25)}
.chip small{color:var(--mute);font-family:var(--mono);font-size:11px}
.tw{overflow-x:auto;margin:8px 0}
table{border-collapse:collapse;font-size:14px;min-width:520px}
th,td{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-family:var(--disp);font-weight:500;color:var(--teal)}
td{font-variant-numeric:tabular-nums}
.never{border-left:4px solid var(--warn);background:var(--panel);padding:10px 14px;font-size:14px}
.first{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:12px}
.first div{background:var(--panel);border:1px solid var(--line);padding:10px 14px}
.first a{color:var(--teal);font-family:var(--mono);font-size:13px;margin-right:6px;display:inline-block}
.screen{background:var(--panel);border:1px solid var(--line);padding:12px 16px;margin:10px 0}
.screen ul{margin:6px 0 0;padding-left:20px}.screen li{margin:3px 0;max-width:80ch}
.screen .uses a{font-family:var(--mono);font-size:12px;color:var(--teal);margin-right:6px}
.group-blurb{color:var(--mute)}
details.asset,h2,h3{scroll-margin-top:64px}
details.asset{border:1px solid var(--line);background:var(--panel);margin:6px 0}
details.asset[open]{border-color:var(--teal)}
details.asset>summary{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;padding:8px 12px;cursor:pointer;list-style:none}
details.asset>summary::-webkit-details-marker{display:none}
details.asset>summary:focus-visible{outline:2px solid var(--teal);outline-offset:-2px}
.code{font:700 14px var(--mono);color:var(--teal);min-width:48px}
.nm{font-weight:600;flex:1 1 200px;min-width:0}
.meta{color:var(--mute);font-size:13px;flex:1 1 220px;min-width:0}
.st{font-size:12px;padding:1px 7px;border:1px solid var(--line);white-space:nowrap}
.st-have{background:var(--teal);color:var(--teal-ink);border-color:var(--teal)}
.st-roster{color:var(--warn);border-color:var(--warn)}
.st-code{color:var(--gold);border-color:var(--gold)}
.made{font-size:12px;color:var(--mute);white-space:nowrap;display:inline-flex;gap:4px;align-items:center}
details.asset.is-made .nm{text-decoration:line-through;text-decoration-color:var(--gold)}
.ab{padding:4px 12px 12px}
dl.facts{display:grid;grid-template-columns:max-content 1fr;gap:3px 12px;margin:4px 0 10px;font-size:14px}
dl.facts dt{color:var(--mute)}dl.facts dd{margin:0;min-width:0}
dl.facts code,.pf{font-family:var(--mono);font-size:12px}
.prompt{margin:10px 0;border:1px solid var(--line)}
.ph{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:6px 10px;background:var(--code);border-bottom:1px solid var(--line);font-size:13px;font-weight:600}
.ph .pf{color:var(--mute);font-weight:400;flex:1;min-width:0;overflow-wrap:anywhere}
.copy{font:600 12px var(--body);padding:4px 12px;border:1px solid var(--teal);background:var(--teal);color:var(--teal-ink);cursor:pointer}
.copy:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
pre{margin:0;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere;font:12.5px/1.5 var(--mono);background:var(--code);color:var(--ink);max-height:340px;overflow:auto}
.sound{display:grid;grid-template-columns:64px minmax(0,1fr);gap:2px 10px;padding:8px 0;border-bottom:1px solid var(--line)}
.sound .code{grid-row:span 2}
.sound .sp{font-family:var(--mono);font-size:12.5px;color:var(--mute)}
.sound button{justify-self:start}
.hidden-by-q{display:none}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
</style>
<div class="wrap">
<p class="lede" style="margin:0;font-family:var(--disp);color:var(--gold)">Duel Summoner · art, motion and sound</p>
<h1>Asset Book</h1>
<p class="lede">Every model, picture, effect, sound and song the game needs, each with a ready prompt. Copy a prompt, paste it into ChatGPT or Meshy, save the result under the file name shown. Nothing else to add. The look is called <b>${LOOK_NAME}</b>.</p>
<div class="stats"><div class="stat"><b>${ALL.length}</b>asset cards</div><div class="stat"><b>${nPieces}</b>pieces of art</div><div class="stat"><b>${nPrompts}</b>ready prompts</div><div class="stat"><b>${SOUNDS.length}</b>sound cues</div><div class="stat"><b>${MUSIC.length}</b>music tracks</div><div class="stat"><b>${SCREENS.length}</b>screens laid out</div></div>
<nav class="toc" aria-label="Sections"><a href="#start">Start</a><a href="#look">Look</a><a href="#screens">Screens</a><a href="#assets">Assets</a><a href="#motion">Motion</a><a href="#sound">Sound</a><a href="#music">Music</a><input id="q" type="search" placeholder="Find an asset: tree, chest, W118, boss…" aria-label="Find an asset"></nav>

<h2 id="start">Start here</h2>
<div class="grid2">${PIPELINE.map(([t, d]) => `<div class="pill"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
<h3>Make these first</h3>
<p>These change the look of a run the most. Each code opens its card.</p>
<div class="first">${FIRST.map(([t, l]) => `<div><b>${esc(t)}</b><br>${l.map(c => `<a href="#${c}">${c}</a>`).join('')}</div>`).join('')}</div>

<h2 id="look">1. The look</h2>
<div class="grid2">${PILLARS.map(([t, d]) => `<div class="pill"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
<h3>Colours</h3>${PALETTES.map(swatchRow).join('')}
<h3>Sizes</h3><p>The duelist is 1.8 m and counts as 1x. The game reads every size from one table, so a model only has to be the right shape; I set its size.</p>
${table(['What', 'Size', 'Height', 'Triangles'], SCALE)}
<h3>Budgets</h3>${table(['What', 'Limit'], BUDGETS)}
<h3>Never</h3><p class="never">${esc(NEVER)}</p>

<h2 id="screens">2. Screens</h2>
<p>Where every piece sits. The pause, map and settings screens build on what you sent, with more on each.</p>
${SCREENS.map(s => `<div class="screen"><h4>${esc(s.name)}</h4><ul>${s.lay.map(l => `<li>${esc(l)}</li>`).join('')}</ul><div class="uses">Uses: ${s.uses.map(u => `<a href="#${u}">${u}</a>`).join('')}</div></div>`).join('')}

<h2 id="assets">3. Every asset</h2>
<p>Open a row for its prompts. Tick "made" as you go; the ticks stay in this browser.</p>
${GROUPS.map(g => `<section class="grp" id="g-${g.id}"><h3>${esc(g.title)} <small style="font-family:var(--body);font-size:14px;color:var(--mute)">${g.items.length}</small></h3><p class="group-blurb">${esc(g.blurb)}</p>${g.items.map(a => assetCard(a, g)).join('')}</section>`).join('')}

<h2 id="motion">4. Motion and effects</h2>
${ANIM.map(([t, l]) => `<h3>${esc(t)}</h3><ul>${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
<h3>Effects rules</h3><ul>${FXRULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul>

<h2 id="sound">5. Sound cues</h2>
${table(['Rule', ''], SOUND_RULES)}
<p>Each prompt is written for a sound-effect generator. Make the number of variants shown.</p>
${SOUNDS.map(s => `<div class="sound"><span class="code">${s.code}</span><div><b>${esc(s.name)}</b> <span class="pf" style="color:var(--mute)">${s.file}.wav · ${s.len} · ${s.vars} variant${s.vars > 1 ? 's' : ''}${s.loop ? ' · loops' : ''}</span></div><div><span class="sp" id="${s.code}">${esc(s.prompt)}</span> <button type="button" class="copy" data-t="${s.code}">Copy</button></div></div>`).join('')}

<h2 id="music">6. Music</h2>
<ul>${MUSIC_RULES.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
${MUSIC.map(m => { const t = `${m.name}. ${m.bpm ? m.bpm + ' BPM, ' : ''}${m.key}, ${m.len}. ${m.brief} Instrumental, no vocals with words.`; return `<div class="sound"><span class="code">${m.code}</span><div><b>${esc(m.name)}</b> <span class="pf" style="color:var(--mute)">${m.file}.wav · ${m.bpm ? m.bpm + ' BPM · ' : ''}${esc(m.key)} · ${esc(m.len)}</span></div><div><span class="sp" id="${m.code}">${esc(t)}</span> <button type="button" class="copy" data-t="${m.code}">Copy</button></div></div>`; }).join('')}
<p style="margin-top:40px;color:var(--mute);font-size:13px">Made from the game's own data on the PC build branch. Built ${new Date().toISOString().slice(0, 10)}.</p>
</div>
<script>
(function(){
  var KEY='ds-asset-book-made';var made={};try{made=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){}
  document.querySelectorAll('[data-made]').forEach(function(cb){var c=cb.getAttribute('data-made');cb.checked=!!made[c];cb.closest('details').classList.toggle('is-made',cb.checked);
    cb.addEventListener('click',function(e){e.stopPropagation()});
    cb.addEventListener('change',function(){made[c]=cb.checked;cb.closest('details').classList.toggle('is-made',cb.checked);try{localStorage.setItem(KEY,JSON.stringify(made))}catch(e){}})});
  document.addEventListener('click',function(e){var b=e.target.closest('.copy');if(!b)return;var el=document.getElementById(b.getAttribute('data-t'));if(!el)return;var t=el.textContent;
    var done=function(){var o=b.textContent;b.textContent='Copied';setTimeout(function(){b.textContent=o},1400)};
    var sel=function(){var r=document.createRange();r.selectNodeContents(el);var s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='Selected, press copy'};
    try{navigator.clipboard.writeText(t).then(done,sel)}catch(err){sel()}});
  function openHash(){var h=location.hash.slice(1);var d=h&&document.getElementById(h);if(d&&d.tagName==='DETAILS'){d.open=true;d.scrollIntoView({block:'start'})}}
  window.addEventListener('hashchange',openHash);openHash();
  var q=document.getElementById('q');q.addEventListener('input',function(){var v=q.value.trim().toLowerCase();
    document.querySelectorAll('details.asset').forEach(function(d){d.classList.toggle('hidden-by-q',!!v&&d.getAttribute('data-q').indexOf(v)<0)});
    document.querySelectorAll('section.grp').forEach(function(s){s.classList.toggle('hidden-by-q',!!v&&!s.querySelector('details.asset:not(.hidden-by-q)'))});
    if(v){var a=document.getElementById('assets');if(a.getBoundingClientRect().top>200)a.scrollIntoView()}});
})();
</script>`;
fs.writeFileSync(out, html);
console.log(JSON.stringify({ cards: ALL.length, pieces: nPieces, prompts: nPrompts, sounds: SOUNDS.length, music: MUSIC.length, kb: Math.round(html.length / 1024) }));
