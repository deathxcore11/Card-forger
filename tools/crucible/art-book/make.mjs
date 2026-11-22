// Builds the Lost Memories asset book: one HTML page (for the artifact) and one Markdown copy (for the Library).
//   node tools/crucible/art-book/make.mjs <out dir> [art dir]
// The art dir (the folder of pictures the playable ships with) decides which medallions count as "have".
import fs from 'node:fs';
import path from 'node:path';
import { RELICS, LAB } from '../../../crucible/engine/relics.mjs';
import { SCREENS } from './screens.mjs';
import { MOCK_CSS, esc } from './kit.mjs';
import { GROUPS, ASSETS, FIELD, SUBJECT, SHEETS } from './assets.mjs';
import { buildPrompts, HOW, WAVES } from './prompts.mjs';

const out = process.argv[2], artDir = process.argv[3];
if (!out) { console.error('usage: make.mjs <out dir> [art dir]'); process.exit(1); }
const have = new Set(artDir && fs.existsSync(artDir) ? fs.readdirSync(artDir).map(f => f.replace(/\.[a-z0-9]+$/, '')) : []);
const relics = Object.entries({ ...RELICS, ...(LAB || {}) }).map(([id, r]) => ({ id, name: r.name, kind: r.kind, family: r.family, text: r.text }));
const PROMPTS = buildPrompts(relics);
const sheetOf = id => SHEETS.find(s => s.ids.includes(id));
const fileOf = r => (r.kind === 'M' ? 'masterwork-' : 'relic-') + r.id.replace(/_/g, '-');
const KIND = { G: 'Gift', C: 'Charm', M: 'Masterwork', F: 'Forger\'s rule' };
const MEDALS = relics.map(r => { const s = sheetOf(r.id), h = have.has(fileOf(r)); return { ...r, file: fileOf(r), sheet: s ? s.id : '', state: h ? 'have' : 'need' }; }); // every sheet came in on 22 November, so a picture in the art dir is the new one
for (const r of MEDALS) if (r.state !== 'have' && !SUBJECT[r.id]) throw new Error('no subject for ' + r.id);
for (const s of SHEETS) for (const id of s.ids) if (id !== 'memory' && !relics.find(r => r.id === id)) throw new Error('sheet names an unknown relic ' + id);
const missingSheet = MEDALS.filter(r => r.state === 'need' && !r.sheet);
if (missingSheet.length) throw new Error('no sheet for ' + missingSheet.map(r => r.id).join(', '));
const codes = new Set(ASSETS.map(a => a.code));
for (const s of SCREENS) for (const u of s.uses) if (!codes.has(u)) throw new Error(`screen ${s.id} uses unknown asset ${u}`);
const usedOn = code => SCREENS.filter(s => s.uses.includes(code)).map(s => s.name);

const count = { have: ASSETS.filter(a => a.state === 'have').length, need: ASSETS.filter(a => a.state === 'need').length, mine: ASSETS.filter(a => a.state === 'mine').length };
const medCount = { have: MEDALS.filter(m => m.state === 'have').length, need: MEDALS.filter(m => m.state === 'need').length, remake: MEDALS.filter(m => m.state === 'remake').length };
const pics = PROMPTS.filter(p => p.id !== 'M-one').length;
const TODO = PROMPTS.filter(p => p.wave >= 8).sort((a, b) => a.wave - b.wave); // waves 1 to 7 are made

// ---------------------------------------------------------------- words shared by both copies
const RULES = [
  ['The picture', '240 lines tall. 320 wide on a square-ish screen, 512 wide on a phone held sideways. Both are real modes of the console.', 'Everything is drawn on that grid, then enlarged by a whole number so every pixel stays a sharp square.'],
  ['Colour', '32,768 colours, with a fixed pattern of dots to fake the ones in between.', 'All colour is cut to that range and dotted with the same pattern, in every picture and in the 3D.'],
  ['Pictures', 'No picture bigger than 256 by 256. Each carries its own small palette of 16 or 256 colours.', 'Every picture you make is shrunk and cut to its palette when the game is built. The size of each is in the asset list.'],
  ['Memory', 'About one megabyte for the frame and every picture on screen at once.', 'Each screen has a budget. The build adds up what a screen shows and refuses to pass if it goes over.'],
  ['3D', 'A few thousand flat triangles a frame. Textures swim a little as things turn, and corners snap to whole pixels.', 'Under 800 triangles on any screen. The swim and the snap are kept, because they are the look.'],
  ['Light', 'No cast shadows. Brightness set at the corners of each triangle. Distance fades to black.', 'The same. Fog is black and it is doing real work: it hides what you have not earned the right to see.'],
  ['See-through', 'Four fixed ways to blend one thing over another.', 'Only those four. No blur, no frosted glass.'],
  ['Type', 'Letters are small pictures on a fixed grid.', 'Two bitmap faces and one set of carved capitals. Text never scales smoothly.'],
  ['Motion', 'Things move in whole pixels. Fades happen in steps.', 'The same: eight steps for a fade, whole pixels for a slide.'],
  ['Sound', '24 voices and short compressed samples, with one built-in echo.', 'Made in the sound thread. Not yet checked against these limits.'],
];
const BANNED = ['Rounded corners', 'Blur and frosted glass', 'Soft drop shadows', 'Smooth colour gradients', 'Text that scales smoothly', 'Thin vector lines and web icons', 'Emoji', 'Anything that resizes smoothly', 'Web scroll bars', 'A picture with more than 256 colours'];
const SPLIT = [
  ['2D', 'Rooms. Each room is one painted picture, seen straight on.', 'Your ChatGPT picture, shrunk.'],
  ['2D', 'Cards. They lie flat on the 3D table.', 'The app\'s own card art, shrunk.'],
  ['2D', 'People. Portraits in a gold frame.', 'Your ChatGPT picture, shrunk.'],
  ['2D', 'Relic medallions, the stone frame, panels, all text, story pictures.', 'Your pictures and my pixels.'],
  ['3D', 'Doors. Two leaves that swing open.', 'I build the shape; your door picture is the carving.'],
  ['3D', 'The duel table and everything on it.', 'I build the shape; your picture is the top.'],
  ['3D', 'Anvil, shrine, stall, Omen bowl, chest, pedestals, torches, the hammer.', 'One picture of each from you; I build the shape to match.'],
  ['Both', 'Menus. Flat stone panels and bitmap text, with a 3D thing turning inside: the card you are reading, a relic, the crest.', 'My pixels, plus the 3D things above.'],
];
const PALETTE = [
  ['#1a0f12', 'Shadow', 'The dark everything comes out of. Outlines, fog, the ground of every window.'],
  ['#2d121d', 'Plum', 'The ground of text windows.'],
  ['#411b28', 'Wine', 'Menus, card backs.'],
  ['#69404d', 'Dusty plum', 'The ledge, plaques that cannot be used.'],
  ['#7a543c', 'Sandstone, dark', 'The frame in shadow.'],
  ['#a87e4f', 'Sandstone', 'The frame, plaques.'],
  ['#c09660', 'Sandstone, light', 'Edges that catch the light.'],
  ['#dba459', 'Gold', 'Every thin line round a window, portrait frames, gauge frames.'],
  ['#e9c46a', 'Gold, light', 'Labels, names, what you earned.'],
  ['#bd7433', 'Ember', 'What is lit: the plaque you are on, Sparks, heat.'],
  ['#964034', 'Rust', 'Life, damage, danger, Traps.'],
  ['#4c8a7c', 'Verdigris', 'The one cool colour: Spells, builds, things that are old and still working.'],
  ['#f3ead8', 'Ink', 'All reading text.'],
];
const TOOK = ['A carved frame round a small window, so the game looks like an object and not a page.', 'Your portrait and gauges on one side of the window, the rival\'s on the other.', 'The hand as a row of small cards under the table, each with ATK over DEF.', 'Thin gold-line windows on a dark textured ground.', 'Carved slots your relics sit in, like a pack.', 'One text bar that says in words what just happened.', 'Grain, darkness, and distance that fades to black.'];
const LEFT = ['Any layout copied whole from one of those games.', 'Any of their characters, creatures, symbols, names or music.', 'The Egyptian look of the card game you sent: no eyes, ankhs, hieroglyphs or pharaohs. Our pyramid belongs to an invented city of record-keepers.'];
const MOTIFS = ['the forging hammer', 'the chain link (a meld)', 'the laurel leaf', 'the key', 'the blank clay tablet', 'the single flame'];
const STATE = { have: 'Have', need: 'Need from you', mine: 'I make it', part: 'Part done', remake: 'Remake' };
const HOWA = { pic: '2D picture', build: '3D, built from your picture', tool: '3D tool test', code: 'Made in code', app: 'From the app' };

// ---------------------------------------------------------------- HTML
const mockBox = s => `<div class="mkbox"><div class="mkw" tabindex="0" role="img" aria-label="Layout sketch of ${esc(s.name)}"><div class="mk">${s.mock}</div></div></div>`;
const chip = code => `<a class="chip" href="#a-${code}">${code}</a>`;
const screenHtml = (s, i) => `<article class="screen" id="s-${s.id}">
<h3><span class="no">${String(i + 1).padStart(2, '0')}</span> ${esc(s.name)}</h3>
<p class="when">${esc(s.when)}</p>
${mockBox(s)}
<ol class="parts">${s.parts.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
<p class="moves"><b>What moves.</b> ${esc(s.moves)}</p>
${s.uses.length ? `<p class="uses"><b>Uses.</b> ${s.uses.map(chip).join(' ')}</p>` : ''}
</article>`;
const assetHtml = a => `<div class="asset ${a.state}" id="a-${a.code}">
<div class="ac"><span class="code">${a.code}</span><span class="st ${a.state}">${STATE[a.state]}</span></div>
<div class="ab"><h4>${esc(a.name)}</h4><p>${esc(a.what)}</p>
<dl><dt>In the game</dt><dd>${esc(a.game)}</dd><dt>Made as</dt><dd>${HOWA[a.how]}${a.make && a.make !== 'none' ? ', ' + esc(a.make) : ''}</dd>${a.file && a.file !== 'none' ? `<dt>File</dt><dd><code>${esc(a.file)}</code></dd>` : ''}${a.until ? `<dt>Until then</dt><dd>${esc(a.until)}</dd>` : ''}${usedOn(a.code).length ? `<dt>Screens</dt><dd>${usedOn(a.code).map(esc).join(', ')}</dd>` : ''}</dl></div></div>`;
const medHtml = m => `<tr class="${m.state}"><td><b>${esc(m.name)}</b><span class="sub">${KIND[m.kind]}, ${FIELD[m.family][0]}</span></td><td>${esc(m.text)}</td><td><span class="st ${m.state}">${STATE[m.state]}</span>${m.sheet ? `<a class="chip" href="#p-M-${m.sheet}">Sheet ${m.sheet.slice(1)}</a>` : ''}</td></tr>`;
const promptHtml = p => `<article class="prompt" id="p-${p.id}">
<header><span class="code">${p.id}</span><h4>${esc(p.name)}</h4><label class="made"><input type="checkbox" data-made="${p.id}"> made</label></header>
<dl><dt>Size to make</dt><dd>${esc(p.make)}</dd><dt>In the game</dt><dd>${esc(p.game)}</dd><dt>Where it goes</dt><dd>${esc(p.where)}</dd><dt>What happens to it</dt><dd>${HOW[p.how]}</dd><dt>Save it as</dt><dd><code>${esc(p.file)}</code></dd></dl>
${p.items ? `<p class="tip">Holds: ${p.items.map(id => esc(id === 'memory' ? 'Memory token' : relics.find(r => r.id === id).name)).join(', ')}.</p>` : ''}
${p.tip ? `<p class="tip">${esc(p.tip)}</p>` : ''}
<button class="copy" type="button" data-copy="t-${p.id}">Copy prompt</button>
<pre id="t-${p.id}">${esc(p.text)}</pre>
</article>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="claude:viewport-fit-sides" content="cover">
<title>Lost Memories Asset Book</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DotGothic16&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#f3ead8;--panel:#eadcbf;--panel2:#e1cfa9;--ink:#1a0f12;--dim:#5c3743;--line:#c09660;--gold:#8a5a1c;--ember:#964034;--cool:#2f6558;--code:#fff8e8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1a0f12;--panel:#2d121d;--panel2:#411b28;--ink:#f3ead8;--dim:#c2b49c;--line:#69404d;--gold:#e9c46a;--ember:#f08a72;--cool:#9fd0c0;--code:#140a0d}}
:root[data-theme="dark"]{--bg:#1a0f12;--panel:#2d121d;--panel2:#411b28;--ink:#f3ead8;--dim:#c2b49c;--line:#69404d;--gold:#e9c46a;--ember:#f08a72;--cool:#9fd0c0;--code:#140a0d}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:56px}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-text-size-adjust:100%}
main{max-width:920px;margin:0 auto;padding:0 16px 80px}
h1,h2,h3,.code,.no,nav a,.st,.chip{font-family:'Silkscreen',ui-monospace,Menlo,monospace;font-weight:400;letter-spacing:.02em}
h1{font-size:28px;line-height:1.15;margin:28px 0 6px;color:var(--gold)}
h2{font-size:20px;margin:52px 0 10px;padding-top:14px;border-top:2px solid var(--line);color:var(--gold)}
h3{font-size:16px;margin:0 0 4px}
h4{font-size:16px;margin:0 0 4px}
p{margin:8px 0}
a{color:var(--cool)}
code{font:13px/1.4 ui-monospace,Menlo,Consolas,monospace;background:var(--panel2);padding:1px 5px}
.lede{font-size:17px;color:var(--dim);max-width:62ch}
.warn{border:2px solid var(--ember);background:var(--panel);padding:10px 14px;margin:16px 0}
.warn b{color:var(--ember)}
nav{position:sticky;top:0;z-index:20;background:var(--bg);border-bottom:2px solid var(--line);margin:0 -16px;padding:8px 16px;display:flex;gap:6px;overflow-x:auto;white-space:nowrap}
nav a{font-size:12px;text-decoration:none;color:var(--ink);background:var(--panel);border:1px solid var(--line);padding:6px 9px}
.tally{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:18px 0}
.tally div{background:var(--panel);border:1px solid var(--line);padding:10px 12px}
.tally b{display:block;font:400 26px/1 'Silkscreen',ui-monospace,monospace;color:var(--gold);margin-bottom:4px}
.tally span{font-size:13px;color:var(--dim)}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid var(--line)}
th{font:400 12px 'Silkscreen',ui-monospace,monospace;color:var(--gold)}
.scroll{overflow-x:auto;margin:10px 0}
.sub{display:block;font-size:12px;color:var(--dim)}
ul.plain{margin:8px 0;padding-left:20px}
ul.plain li{margin:4px 0}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
.card{background:var(--panel);border:1px solid var(--line);padding:12px 14px}
.card h3{color:var(--gold)}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:10px 0}
.sw div{display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:start;background:var(--panel);border:1px solid var(--line);padding:8px}
.sw i{width:40px;height:40px;border:2px solid var(--line);display:block}
.sw b{display:block;font-size:14px}.sw span{font-size:12px;color:var(--dim)}
.type{background:#1a0f12;color:#f3ead8;padding:14px;border:2px solid #dba459;margin:10px 0}
.type .cap{font:700 28px/1.1 Georgia,'Times New Roman',serif;letter-spacing:.12em;color:#e9c46a;text-shadow:2px 2px 0 #3a2419}
.type .tx{font:16px/20px 'DotGothic16',ui-monospace,monospace;margin:10px 0}
.type .lb{font:16px/20px 'Silkscreen',ui-monospace,monospace;color:#e9c46a}
.type small{display:block;font:12px ui-sans-serif,system-ui,sans-serif;color:#c2b49c;margin-top:2px}
.screen{margin:26px 0 34px;padding-top:6px}
.screen h3 .no{color:var(--gold);margin-right:6px}
.when{color:var(--dim);font-size:14px;margin:0 0 8px}
.mkbox{overflow-x:auto;margin:8px 0;-webkit-overflow-scrolling:touch}
.mkw{cursor:zoom-in}.mkw.big{cursor:zoom-out;width:1024px}
.parts{margin:10px 0;padding-left:26px;font-size:15px}
.parts li{margin:3px 0}.parts li::marker{color:var(--gold);font-family:'Silkscreen',ui-monospace,monospace;font-size:12px}
.moves,.uses{font-size:14px;color:var(--dim)}
.moves b,.uses b{color:var(--ink)}
.chip{display:inline-block;font-size:11px;text-decoration:none;color:var(--ink);background:var(--panel2);border:1px solid var(--line);padding:2px 6px;margin:2px 2px 2px 0}
.group{margin:30px 0 8px}
.group p{color:var(--dim);font-size:15px;margin:2px 0 10px}
.asset{display:grid;grid-template-columns:92px 1fr;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}
.ac{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.code{font-size:16px;color:var(--gold)}
.st{font-size:10px;padding:3px 5px;border:1px solid var(--line);white-space:nowrap}
.st.have{color:var(--cool);border-color:var(--cool)}.st.need,.st.remake,.st.part{color:var(--ember);border-color:var(--ember)}.st.mine{color:var(--dim)}
.ab p{margin:2px 0 6px;font-size:15px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:6px 0;font-size:14px}
dt{color:var(--dim)}dd{margin:0}
.prompt{background:var(--panel);border:1px solid var(--line);padding:14px;margin:16px 0}
.prompt header{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.prompt header h4{flex:1;min-width:160px;margin:0}
.made{font-size:13px;color:var(--dim);display:flex;align-items:center;gap:6px;min-height:32px}
.made input{width:20px;height:20px;accent-color:#bd7433}
.tip{font-size:14px;color:var(--dim);border-left:3px solid var(--line);padding-left:10px}
.copy{font:400 13px 'Silkscreen',ui-monospace,monospace;background:#bd7433;color:#1a0f12;border:2px solid;border-color:#f3ead8 #4a1c16 #4a1c16 #f3ead8;padding:10px 14px;margin:8px 0;cursor:pointer;min-height:44px}
.copy.ok{background:#4c8a7c}
pre{white-space:pre-wrap;word-break:break-word;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;background:var(--code);border:1px solid var(--line);padding:12px;margin:6px 0 0;max-height:320px;overflow:auto}
.wave{margin:34px 0 6px}
.wave h3{color:var(--gold);font-size:18px}
.wave p{color:var(--dim);margin:2px 0}
ol.steps{padding-left:22px}ol.steps li{margin:6px 0}
@media (max-width:560px){h1{font-size:22px}.asset{grid-template-columns:1fr}.ac{flex-direction:row;align-items:center}dl{grid-template-columns:1fr}dt{margin-top:6px}td,th{padding:6px}}
${MOCK_CSS}
</style>
</head>
<body>
<main>
<h1>Lost Memories Asset Book</h1>
<p class="lede">Every screen, every piece of art and every prompt, for Lost Memories as a real PlayStation-era game: built to what that console could do, with no cheating.</p>
<div class="warn"><b>Updated 22 November, afternoon.</b> Everything on both lists is in and built into the console look: title, logo, crest, table, rooms, faces, medals, story pictures, terrain grounds, Enchant marks, the hidden door, the reading room, the stair and the memories, and your chest, shrine, bowl, stall and keeper as console-size 3D props. Only the Snare redo and one answer are left. The layouts in part 3 are still sketches of where things go.</div>
<nav><a href="#todo">Still to make</a><a href="#rules">Console rules</a><a href="#look">Identity</a><a href="#screens">Screens</a><a href="#assets">Assets</a><a href="#prompts">Prompts</a><a href="#order">What to make first</a></nav>
<div class="tally">
<div><b>${SCREENS.length}</b><span>screens, each drawn to the pixel</span></div>
<div><b>${ASSETS.length + MEDALS.length}</b><span>pieces of art listed</span></div>
<div><b>${TODO.length + 1}</b><span>pictures still to make</span></div>
<div><b>${count.have + medCount.have}</b><span>pieces we already have</span></div>
</div>

<h2 id="todo">Still to make</h2>
<p>Your part: ${TODO.length ? TODO.length + ' pictures, the ones that change the game most first. Each links to its prompt.' : 'one redo and one answer.'}</p>
<ol class="todo">${TODO.map(p => `<li><a href="#p-${p.id}"><b>${esc(p.name)}</b></a> <span class="sub">${esc(p.file)}</span>${esc(p.where)}${p.wave === 7 ? ' Optional.' : ''}</li>`).join('')}
<li><a href="#p-M-one"><b>Snare medallion, redo</b></a> <span class="sub">relic-snare.png</span>It came out as a hanging noose on a dead tree, so it is left out. Use the single medallion prompt with: gold rim, deep violet plum field: ${esc(SUBJECT.snare)}.</li>
<li><b>Tell me: the three bound arrows</b> <span class="sub">relic-Single medallion.png</span>It matches no relic on the list. Say which medal it is meant to be, or it stays spare.</li></ol>
<p>My part, still to do: place the anvil and the hammer (both built), the crest as a turning coin from your crest and laurel medal, and the frame and plaques from your materials sheet. No more 3D files are needed: a picture of an object is enough, and I build it.</p>
<h2 id="rules">1. The console rules</h2>
<p>Your rule, 22 November: it must look like a real game of that console that could run on one, with no cheating. So the game is held to what the machine could do. If a thing could not be done on it, it is not in the game.</p>
<div class="scroll"><table><thead><tr><th></th><th>What the console could do</th><th>What Lost Memories does</th></tr></thead><tbody>
${RULES.map(r => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}
</tbody></table></div>
<div class="cols">
<div class="card"><h3>Never in the game</h3><ul class="plain">${BANNED.map(x => `<li>${x}</li>`).join('')}</ul><p class="sub">The build will check for these on every screen. That check is not written yet.</p></div>
<div class="card"><h3>The two liberties</h3><ul class="plain"><li>Pixels are square. A television of the time stretched them a little.</li><li>You touch the screen. Every plaque can be tapped, and the hammer cursor shows what your tap chose. A controller works the same way.</li></ul><p class="sub">Nothing else is allowed that the console could not do.</p></div>
</div>
<h3 style="margin-top:22px">What is 2D and what is 3D</h3>
<p>As you set it on 22 November: a painted backdrop with 3D things standing in it.</p>
<div class="scroll"><table><thead><tr><th></th><th>What</th><th>Where it comes from</th></tr></thead><tbody>
${SPLIT.map(r => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}
</tbody></table></div>

<h2 id="look">2. Identity</h2>
<p>One idea holds every screen: <b>the Frame</b>. The game is a carved stone object with a small window in it. You are on the left pillar, whoever faces you is on the right, the room is in the window, your hand lies on the ledge under it, and one bar of text says what is happening. It never changes shape, so after a minute you stop reading the screen and just play.</p>
${mockBox(SCREENS.find(s => s.id === 'chamber'))}
<p class="sub">The chamber of doors, as a sketch. Tap any sketch to see it twice the size.</p>
<div class="cols">
<div class="card"><h3>The feel</h3><p>Quiet, heavy, dark and patient. Menus do not bounce. Light is small and warm and there is never enough of it. The pyramid belongs to a city that wrote down ordinary lives in stone, so the carving is plain and the rooms are sad, not grand.</p></div>
<div class="card"><h3>Three materials</h3><p><b>Painted</b> people. <b>Carved</b> places. <b>Struck</b> things: relics and the crest are coins and medals. If a piece of art is none of the three, it does not belong.</p></div>
<div class="card"><h3>The marks we own</h3><p>${MOTIFS.join(', ')}. Nothing else is carved anywhere.</p></div>
</div>
<h3 style="margin-top:22px">Colours</h3>
<div class="sw">${PALETTE.map(p => `<div><i style="background:${p[0]}"></i><p style="margin:0"><b>${p[1]}</b><span>${p[0]}. ${esc(p[2])}</span></p></div>`).join('')}</div>
<h3 style="margin-top:22px">Type</h3>
<div class="type"><div class="cap">FLOOR TWO</div><small>Carved capitals. Titles only: a floor, a victory, the end of a run. Drawn once as a bitmap, 24 pixels tall.</small>
<div class="tx">The door is carved with an anvil. Something is waiting.</div><small>The text face, 16 pixels tall. Every sentence in the game.</small>
<div class="lb">LIFE 6400 &nbsp; SPARKS &nbsp; ATK 1700</div><small>The label face, 8 pixels tall, shown here at twice its size. Short labels and numbers.</small></div>
<div class="cols">
<div class="card"><h3>Taken from your pictures</h3><ul class="plain">${TOOK.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
<div class="card"><h3>Left behind</h3><ul class="plain">${LEFT.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
</div>

<h2 id="screens">3. Every screen</h2>
<p>${SCREENS.length} screens. Each sketch is the real frame, 512 by 240, so it shows exactly how much room every piece has. Numbers on a sketch match the list under it. Tap a sketch to see it twice the size.</p>
<p class="uses">${SCREENS.map((s, i) => `<a class="chip" href="#s-${s.id}">${String(i + 1).padStart(2, '0')} ${esc(s.name)}</a>`).join(' ')}</p>
${SCREENS.map(screenHtml).join('\n')}

<h2 id="assets">4. Every asset</h2>
<p><span class="st have">Have</span> is in the playable now. <span class="st need">Need from you</span> is a picture to make from a prompt in part 5. <span class="st mine">I make it</span> is drawn or built in the game's own code and needs nothing from you.</p>
${GROUPS.map(g => `<section class="group" id="g-${g.id}"><h3>${g.id}. ${esc(g.name)}</h3><p>${esc(g.note)}</p>${ASSETS.filter(a => a.code.replace(/[0-9]+$/, '') === g.id).map(assetHtml).join('')}${g.id === 'M' ? `<h4 style="margin-top:16px">All ${MEDALS.length} relics</h4><p>${medCount.have} have a picture and keep it. ${medCount.need} have none. ${medCount.remake} have one that is remade so the whole set is one shape language.</p><div class="scroll"><table><thead><tr><th>Relic</th><th>What it does</th><th>Picture</th></tr></thead><tbody>${MEDALS.map(medHtml).join('')}</tbody></table></div>` : ''}</section>`).join('\n')}

<h2 id="prompts">5. Every prompt</h2>
<p>${PROMPTS.length} prompts. Each one is complete: copy it, paste it into ChatGPT, and add nothing. Each says what size to make, what size it becomes in the game, where it goes, and what to save it as.</p>
<div class="card"><h3>How to use them</h3><ol class="steps"><li>Tap <b>Copy prompt</b> and paste it as it is.</li><li>If the picture has writing in it, an eye, a pharaoh, or something from a game you know, ask for it again.</li><li>Save it under the name shown and send it to me in the thread, in any batch size. A wrong name is fine: I can tell what it is.</li><li>Tick <b>made</b> so you can see what is left. The ticks are kept on this device only.</li></ol><p class="sub">Do not shrink anything yourself. I shrink and recolour every picture to console size, and I show you each one in the game before it counts as done.</p></div>
${WAVES.map(([w, name, note]) => `<section class="wave" id="w-${w}"><h3>Wave ${w}: ${esc(name)}</h3><p>${esc(note)}</p></section>${PROMPTS.filter(p => p.wave === w).map(promptHtml).join('\n')}`).join('\n')}

<h2 id="order">6. What to make first</h2>
<ol class="steps">
${WAVES.map(([w, name, note]) => `<li><a href="#w-${w}"><b>Wave ${w}: ${esc(name)}.</b></a> ${PROMPTS.filter(p => p.wave === w && p.id !== 'M-one').length} pictures. ${esc(note)}</li>`).join('')}
</ol>
<p>While you make pictures I build the Frame, the bitmap type, the console colour and the 3D doors and table into the playable, with stand-ins where a picture is missing. Each picture you send replaces its stand-in in the next version. You never have to wait on me and I never have to wait on you.</p>
<div class="card"><h3>Still open, yours to decide</h3><ul class="plain"><li>Who The Last One is. The prompt draws my default: the final keeper the City asked to stay.</li><li>Whether to try the 3D tool at all. Wave 5 is one statue on free credits. The game is complete without it.</li><li>The words on the boot card. The sketch says CARDSTASHY PRESENTS; it can say anything, or nothing.</li></ul></div>
</main>
<script>
(function(){
  function fit(w){var m=w.firstElementChild;if(!m)return;var s=w.clientWidth/512;m.style.transform='scale('+s+')';}
  var ws=[].slice.call(document.querySelectorAll('.mkw'));
  var ro=window.ResizeObserver?new ResizeObserver(function(es){es.forEach(function(e){fit(e.target);});}):null;
  ws.forEach(function(w){fit(w);if(ro)ro.observe(w);
    function tog(){w.classList.toggle('big');fit(w);}
    w.addEventListener('click',tog);w.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tog();}});});
  if(!ro)window.addEventListener('resize',function(){ws.forEach(fit);});
  function done(b){var o=b.textContent;b.textContent='Copied';b.classList.add('ok');setTimeout(function(){b.textContent=o;b.classList.remove('ok');},1600);}
  function fallback(t,b){var a=document.createElement('textarea');a.value=t;a.setAttribute('readonly','');a.style.position='fixed';a.style.left='-9999px';document.body.appendChild(a);a.select();try{document.execCommand('copy');done(b);}catch(e){b.textContent='Press and hold the text to copy';}document.body.removeChild(a);}
  [].forEach.call(document.querySelectorAll('.copy'),function(b){b.addEventListener('click',function(){var t=document.getElementById(b.getAttribute('data-copy')).textContent;
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(function(){done(b);},function(){fallback(t,b);});}else fallback(t,b);});});
  var KEY='lm-book-made',made={};try{made=JSON.parse(localStorage.getItem(KEY)||'{}')||{};}catch(e){made={};}
  [].forEach.call(document.querySelectorAll('[data-made]'),function(c){var id=c.getAttribute('data-made');c.checked=!!made[id];
    c.addEventListener('change',function(){made[id]=c.checked;try{localStorage.setItem(KEY,JSON.stringify(made));}catch(e){}});});
})();
</script>
</body>
</html>
`;

// ---------------------------------------------------------------- Markdown copy
const md = [];
md.push('# Lost Memories asset book', '', 'Every screen, every piece of art and every prompt, for Lost Memories as a real PlayStation-era game: built to what that console could do, with no cheating.', '',
  '**Updated 22 November, afternoon.** Everything on both lists is in and built into the console look. Only the Snare redo and one answer are left.', '',
  '## Still to make', '', ...TODO.map(p => `- ${p.name} (${p.file}): ${p.where}${p.wave === 7 ? ' Optional.' : ''}`), `- Snare medallion, redo: ${SUBJECT.snare}.`, '- Tell me which medal the three bound arrows are for.', '',
  'The page version has a pixel sketch of every screen and a copy button on every prompt. This file is the same words without the sketches.', '',
  `Counts: ${SCREENS.length} screens, ${ASSETS.length + MEDALS.length} pieces of art listed, ${TODO.length + 1} pictures still to make, ${count.have + medCount.have} pieces we already have.`, '');
md.push('## 1. The console rules', '', '| | What the console could do | What Lost Memories does |', '|---|---|---|', ...RULES.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} |`), '',
  'Never in the game: ' + BANNED.join('; ').toLowerCase() + '.', '', 'The two liberties: pixels are square (a television stretched them a little), and you touch the screen (every plaque can be tapped; a controller works the same way).', '',
  '### What is 2D and what is 3D', '', '| | What | Where it comes from |', '|---|---|---|', ...SPLIT.map(r => `| ${r[0]} | ${r[1]} | ${r[2]} |`), '');
md.push('## 2. Identity', '', 'One idea holds every screen: the Frame. The game is a carved stone object with a small window in it. You are on the left pillar, whoever faces you is on the right, the room is in the window, your hand lies on the ledge under it, and one bar of text says what is happening.', '',
  'The frame is 512 by 240: left pillar 96 wide, window 320 by 136, ledge 320 by 80, text bar 320 by 24, right pillar 96 wide.', '',
  'The feel: quiet, heavy, dark and patient. Three materials: painted people, carved places, struck things. The marks we own: ' + MOTIFS.join(', ') + '.', '',
  '### Colours', '', ...PALETTE.map(p => `- ${p[1]} ${p[0]}: ${p[2]}`), '',
  '### Type', '', '- Carved capitals, 24 pixels tall: titles only.', '- Text face, 16 pixels tall (DotGothic16): every sentence.', '- Label face, 8 pixels tall (Silkscreen): short labels and numbers.', '',
  '### Taken from your pictures', '', ...TOOK.map(x => '- ' + x), '', '### Left behind', '', ...LEFT.map(x => '- ' + x), '');
md.push('## 3. Every screen', '');
SCREENS.forEach((s, i) => md.push(`### ${String(i + 1).padStart(2, '0')}. ${s.name}`, '', `When: ${s.when}`, '', ...s.parts.map((p, j) => `${j + 1}. ${p}`), '', `What moves: ${s.moves}`, '', s.uses.length ? `Uses: ${s.uses.join(', ')}` : '', ''));
md.push('## 4. Every asset', '', 'Have = in the playable now. Need from you = a picture to make from a prompt in part 5. I make it = drawn or built in code.', '');
for (const g of GROUPS) {
  md.push(`### ${g.id}. ${g.name}`, '', g.note, '', '| Code | Name | State | In the game | Made as | File |', '|---|---|---|---|---|---|',
    ...ASSETS.filter(a => a.code.replace(/[0-9]+$/, '') === g.id).map(a => `| ${a.code} | ${a.name}: ${a.what} | ${STATE[a.state]} | ${a.game} | ${HOWA[a.how]}${a.make && a.make !== 'none' ? ', ' + a.make : ''} | ${a.file === 'none' ? '' : a.file} |`), '');
  if (g.id === 'M') md.push(`All ${MEDALS.length} relics: ${medCount.have} keep their picture, ${medCount.need} have none, ${medCount.remake} are remade.`, '', '| Relic | Kind | What it does | Picture |', '|---|---|---|---|',
    ...MEDALS.map(m => `| ${m.name} | ${KIND[m.kind]}, ${FIELD[m.family][0]} | ${m.text} | ${STATE[m.state]}${m.sheet ? ', sheet ' + m.sheet.slice(1) : ''} |`), '');
}
md.push('## 5. Every prompt', '', 'Each prompt is complete: paste it into ChatGPT and add nothing. Save the picture under the name shown and send it in the thread. Do not shrink anything yourself.', '');
for (const [w, name, note] of WAVES) {
  md.push(`### Wave ${w}: ${name}`, '', note, '');
  for (const p of PROMPTS.filter(x => x.wave === w)) md.push(`#### ${p.id}. ${p.name}`, '', `- Size to make: ${p.make}`, `- In the game: ${p.game}`, `- Where it goes: ${p.where}`, `- What happens to it: ${HOW[p.how]}`, `- Save it as: \`${p.file}\``, p.tip ? `- Note: ${p.tip}` : '', '', '```', p.text, '```', '');
}
md.push('## 6. What to make first', '', ...WAVES.map(([w, name, note]) => `${w}. Wave ${w}: ${name}. ${PROMPTS.filter(p => p.wave === w && p.id !== 'M-one').length} pictures. ${note}`), '',
  'Still open, yours to decide: who The Last One is; whether to try the 3D tool at all; the words on the boot card.', '');

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.writeFileSync(path.join(out, 'lost-memories-asset-book.md'), md.filter(x => x !== undefined).join('\n').replace(/\n{3,}/g, '\n\n'));
console.log(`${SCREENS.length} screens, ${ASSETS.length} assets (${count.have} have, ${count.need} need, ${count.mine} mine), ${MEDALS.length} relics (${medCount.have} have, ${medCount.need} need, ${medCount.remake} remake), ${PROMPTS.length} prompts (${pics} pictures), html ${html.length} bytes`);
