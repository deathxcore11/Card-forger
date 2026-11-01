#!/usr/bin/env node
/* Planeswalk content check, v1 (content-ready plan, Phase 0): the gate every new hero, monster, act, figure and mat passes.
   Usage: node planeswalk-src/tools/content-check.cjs [dir] [--sim N]
     dir   holds the BUILT planeswalk.html, planeswalk-art-zen.css, planeswalk-cast/ and planeswalk-art/ (default: the repo root, .)
     --sim seeded runs per hero for the sim smoke (default 3; 0 skips it)
     --gates N  win-rate gates per hero (CAREFUL=1) at Spark 0 with an empty trail (TRAIL=0, a new player), and Spark 5 and 10 with the full trail (TRAIL=12):
                a player at Spark 5 has already won 5 runs, so the higher levels are judged with the whole pool open
   Stage 1, data (seconds): monsters, intents, acts, heroes, cards, figures, portraits and mats.
   Stage 2, sim smoke: every hero plays N seeded runs with no error, no NaN and no stuck fight (tools/sim.cjs).
   FAIL blocks the change. WARN is allowed (a figure not painted yet shows its own card-art portrait).
   Later stages (browser fight matrix, saves) arrive with the plan's next steps. */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), { execFileSync } = require('child_process');
const args = process.argv.slice(2), dir = path.resolve(args.find(a => !a.startsWith('--')) || '.');
const simN = args.includes('--sim') ? +args[args.indexOf('--sim') + 1] : 3;
const gateN = args.includes('--gates') ? +args[args.indexOf('--gates') + 1] : 0;
const GATES = [[0, 0], [5, 12], [10, 12]];  // reference policy: CAREFUL=1; TRAIL=0 is a new player (unset TRAIL reads the profile's growing XP)
const FAIL = [], WARN = [], fail = (k, m) => FAIL.push(`${k}: ${m}`), warn = (k, m) => WARN.push(`${k}: ${m}`);
const read = f => fs.readFileSync(path.join(dir, f), 'utf8'), exists = f => fs.existsSync(path.join(dir, f));

const html = read('planeswalk.html'), zen = exists('planeswalk-art-zen.css') ? read('planeswalk-art-zen.css') : '';
const gm = html.match(/<script id="pw-game">([\s\S]*?)<\/script>/);
if (!gm) { console.log('FAIL page: no <script id="pw-game"> (the game script)'); process.exit(1); }

/* ---------- load the game in a sandbox, like the sim ---------- */
const el = () => ({ innerHTML: '', dataset: {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: { setProperty() {} }, querySelector: () => null, querySelectorAll: () => [] });
const ctx = { console: { log() {}, warn() {}, error: (...a) => fail('console.error', a.join(' ')) }, Math, JSON, Object, Array, String, Number, structuredClone, Map, Set, setTimeout: f => f(),
  document: { getElementById: el, documentElement: el(), body: el(), querySelector: () => null, querySelectorAll: () => [], createElement: el, addEventListener() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {}, matchMedia: () => ({ matches: false }), PW_FORM: 1, PW_FEAT: { sig: 1, ante: 1, dun: 1 }, PW_DMG: {}, PW_SOAK: {} };
ctx.window = ctx; vm.createContext(ctx);
try {
  vm.runInContext(gm[1] + `;globalThis.G={get run(){return run},get c(){return c},ISSUES:typeof PW_CONTENT_ISSUES!=='undefined'?PW_CONTENT_ISSUES:[],newRun,startFight,intentLabel,intentOf,C,E,EMB,HEROES,ACTS,EASY,HARD};`, ctx);
} catch (e) { console.log('FAIL game script: ' + e.message); process.exit(1); }
const G = ctx.G, { C, E, HEROES, ACTS } = G;
for (const m of G.ISSUES) fail('boot', m);// the game's own validateContent() had to fill or drop something

/* ---------- monsters and their intents ---------- */
const NO_INTENTS = new Set(['thrall']);// a taken ally; it acts through its owner
const intentLists = d => [d.intents, d.pairIntents, d.phase2].filter(Array.isArray);
for (const [k, d] of Object.entries(E)) {
  if (!d || typeof d !== 'object') { fail('E.' + k, 'not an object'); continue }
  if (typeof d.name !== 'string' || !d.name) fail('E.' + k, 'no name (the name is the art key)');
  if (!(d.hp > 0)) fail('E.' + k, 'life (hp) must be above 0');
  if (!NO_INTENTS.has(k) && !(Array.isArray(d.intents) && d.intents.length)) fail('E.' + k, 'no intents');
  for (const list of intentLists(d)) for (const it of list) {
    if (!Array.isArray(it) || typeof it[0] !== 'string') { fail('E.' + k, 'intent is not [type, value]: ' + JSON.stringify(it)); continue }
    if ((it[0] === 'summon' || it[0] === 'transform') && !E[it[1]]) fail('E.' + k, `${it[0]} target '${it[1]}' is not a monster`);
  }
}

/* ---------- acts: every key they name exists ---------- */
for (let n = 1; n < ACTS.length; n++) {
  const A = ACTS[n]; if (!A) { fail('ACTS[' + n + ']', 'missing'); continue }
  const groups = [...(A.easy || (n === 1 ? G.EASY : [])), ...(A.hard || (n === 1 ? G.HARD : []))];
  if (!groups.length) fail('ACTS[' + n + ']', 'no monster groups');
  for (const k of [A.boss, ...(A.bosses || []), ...(A.elites || []), ...groups.flat()]) if (k && !E[k]) fail('ACTS[' + n + ']', `'${k}' is not a monster`);
  if (!(A.bosses || []).length) fail('ACTS[' + n + ']', 'no bosses');
}

/* ---------- heroes and cards ---------- */
const RAR = new Set(['S', 'C', 'U', 'R', 'M', 'K']);// K = Curse, never in pools
for (const [k, c] of Object.entries(C)) {
  if (!c.name) fail('C.' + k, 'no name');
  if (c.r && !RAR.has(c.r)) fail('C.' + k, `rarity '${c.r}' is not one of S C U R M K`);
}
for (const [k, h] of Object.entries(HEROES)) {
  if (!h.name) fail('HEROES.' + k, 'no name');
  if (!(h.life > 0)) fail('HEROES.' + k, 'no life');
  for (const s of h.starter || []) if (!C[s]) fail('HEROES.' + k, `starter card '${s}' is not a card`);
  if (h.sig && !G.EMB[h.sig]) fail('HEROES.' + k, `signature emblem '${h.sig}' is not an emblem`);
}

/* ---------- every intent renders as an icon chip, in a real fight, for every hero ---------- */
for (const hk of Object.keys(HEROES)) {
  for (let n = 1; n < ACTS.length; n++) for (const k of Object.keys(E)) {
    if (NO_INTENTS.has(k)) continue;
    const d = E[k], kind = d.rank === 'boss' ? 'boss' : d.rank === 'elite' ? 'elite' : 'normal';
    try {
      G.newRun(1234 + n, hk); G.run.act = n; G.startFight([k], kind, 0);
      const e = G.c && G.c.enemies && G.c.enemies[0]; if (!e) { fail(`fight ${hk} act ${n} ${k}`, 'no enemy created'); continue }
      const L = (e.phase2 && d.phase2) ? d.phase2 : d.intents;
      for (let i = 0; i < L.length; i++) { e.i = i; const h = G.intentLabel(e); if (!/class="intent/.test(h) || !/<svg/.test(h)) fail(`intent ${k}[${i}]`, 'does not render an icon chip: ' + h.slice(0, 80)) }
    } catch (err) { fail(`fight ${hk} act ${n} ${k}`, err.message) }
  }
}

/* ---------- figures (planeswalk-cast/cast.json) ---------- */
let cast = [];
try { cast = JSON.parse(read('planeswalk-cast/cast.json')) } catch (e) { fail('cast.json', e.message) }
const castNames = new Set(), castGames = new Set(), castKeys = new Set();
const am = html.match(/const ALIAS=(\{[^}]*\})/);// pw-cast.js: monster key -> figure key
const ALIAS = am ? Function('return ' + am[1])() : {};
for (const f of cast) {
  const id = 'figure ' + (f.key || '?');
  if (f.act !== 'allies') castNames.add(f.name);
  if (f.game) castGames.add(f.game);
  castKeys.add(f.key);
  for (const fld of ['key', 'name', 'rank', 'fw', 'fh', 'frames', 'idle', 'foot']) if (f[fld] == null) fail(id, 'missing ' + fld);
  if (f.frames && !f.frames[f.idle]) fail(id, `idle frame '${f.idle}' is not in frames`);
  if (!['webp', 'png'].some(x => exists(`planeswalk-cast/atlas/${f.file || f.key}.${x}`))) fail(id, 'no atlas file');
  for (const a of ['cx', 'hx', 'cw', 'bx']) if (f[a] == null) fail(id, `no '${a}' anchor: run tools/cast-anchors.py`);
}

/* ---------- every monster shows its own figure or its own portrait, never nothing ---------- */
const portrait = n => html.includes(`[data-n="${n}"]{--img:`) || zen.includes(`[data-n="${n}"]{--img:`);
for (const [k, d] of Object.entries(E)) {
  if (!d.name || NO_INTENTS.has(k)) continue;
  const an = d.art || d.name;// the art key, as the game draws it (e.art||e.name); figures match like pw-cast.js entryForFoe: game key, then name or art
  const fig = castGames.has(k) || castKeys.has(d.figure) || castKeys.has(ALIAS[k]) || castNames.has(an) || castNames.has(d.name), por = portrait(an);
  const rolled = ACTS.some(A => A && [...(A.elites || []), ...(A.bosses || [])].includes(k));
  if (d.figure && !castKeys.has(d.figure) && !por) { if (rolled) warn('art E.' + k, `figure '${d.figure}' not landed: stays out of the rolls until its frames do`); else fail('art E.' + k, `figure '${d.figure}' not landed and it is not a rolled elite or boss, so nothing keeps it hidden`); continue }
  if (!fig && !por) fail('art E.' + k, `'${an}' has no figure and no card-art portrait (it would show blank)`);
  else if (!fig) warn('art E.' + k, `'${an}' shows its portrait until its figure is painted`);
}

/* ---------- fight mats named in the page exist, with their phone-wide twins ---------- */
const mats = new Set([...html.matchAll(/--pw-x-([a-z0-9-]+):url\(\.\/planeswalk-art\/([a-z0-9-]+)\.webp\)/g)].map(m => m[2]));
for (const m of mats) {
  if (!exists(`planeswalk-art/${m}.webp`)) fail('mat ' + m, 'file missing');
  if (!m.endsWith('-wide') && !exists(`planeswalk-art/${m}-wide.webp`)) warn('mat ' + m, 'no -wide twin for phones');
}

/* ---------- probes: made-up rows with only the minimum fields still play (engine plan F04) ---------- */
{
  const inject = `E.probe={hp:12};E.probeboss={hp:30,rank:'boss',intents:[['atk',3],['summon','nope'],['bogus']]};ACTS[1].elites.push('probe','ghost');`;
  const pctx = { ...ctx, console: { log() {}, warn() {}, error() {} } }; pctx.window = pctx; vm.createContext(pctx);
  try {
    vm.runInContext(gm[1].replace('const PW_CONTENT_ISSUES=[];', inject + 'const PW_CONTENT_ISSUES=[];') + `;globalThis.P={get c(){return c},ISSUES:PW_CONTENT_ISSUES,newRun,startFight,intentLabel,E,ACTS};`, pctx);
    const P = pctx.P;
    if (!P.ISSUES.some(m => /ghost/.test(m))) fail('probe', 'a missing elite key was not reported');
    if (P.ACTS[1].elites.includes('ghost')) fail('probe', 'a missing elite key was not dropped');
    if (P.E.probeboss.intents.length !== 2) fail('probe', 'a summon of a missing monster was not dropped');
    for (const hk of Object.keys(HEROES)) for (const k of ['probe', 'probeboss']) {
      P.newRun(77, hk); P.startFight([k], P.E[k].rank === 'boss' ? 'boss' : 'normal', 0);
      const e = P.c && P.c.enemies[0]; if (!e) { fail('probe ' + k, 'no enemy created'); continue }
      for (let i = 0; i < P.E[k].intents.length; i++) { e.i = i; const h = P.intentLabel(e); if (!/<svg/.test(h)) fail(`probe ${k}[${i}]`, 'intent is not an icon chip: ' + h.slice(0, 80)) }
    }
  } catch (e) { fail('probe', e.message) }
}

/* ---------- stage 2: sim smoke ---------- */
if (simN > 0) {
  const sim = path.join(__dirname, 'sim.cjs');
  for (const hk of Object.keys(HEROES)) {
    let out = '';
    try { out = execFileSync(process.execPath, [sim, path.join(dir, 'planeswalk.html'), String(simN)], { env: { ...process.env, HERO: hk }, encoding: 'utf8', timeout: 600000, stdio: ['ignore', 'pipe', 'pipe'] }) }
    catch (e) { fail('sim ' + hk, (e.stderr || e.message || '').toString().split('\n').slice(0, 3).join(' ')); continue }
    const m = out.match(/errors:\s*\[([\s\S]*?)\]/);
    if (!m) fail('sim ' + hk, 'no result printed');
    else if (m[1].trim()) fail('sim ' + hk, 'errors: ' + m[1].replace(/\s+/g, ' ').slice(0, 300));
  }
}

/* ---------- stage 3 (on request): Spark win-rate gates ---------- */
const gateRows = [];
if (gateN > 0) {
  const sim = path.join(__dirname, 'sim.cjs');
  for (const hk of Object.keys(HEROES)) for (const [sp, tr] of GATES) {
    try {
      const out = execFileSync(process.execPath, [sim, path.join(dir, 'planeswalk.html'), String(gateN)], { env: Object.assign({ ...process.env, HERO: hk, SPARK: String(sp), CAREFUL: '1' }, tr == null ? {} : { TRAIL: String(tr) }), encoding: 'utf8', timeout: 1800000, stdio: ['ignore', 'pipe', 'pipe'] });
      const m = out.match(/winRate:\s*'([\d.]+)%'/);
      gateRows.push(`gate ${hk} Spark ${sp}${tr == null ? '' : ' trail ' + tr}: ${m ? m[1] + '%' : '?'}`);
    } catch (e) { fail(`gate ${hk} S${sp}`, (e.stderr || e.message || '').toString().split('\n')[0]) }
  }
}

/* ---------- report ---------- */
for (const g of gateRows) console.log(g);
for (const w of WARN) console.log('WARN ' + w);
for (const f of FAIL) console.log('FAIL ' + f);
console.log(`content-check: ${Object.keys(E).length} monsters, ${Object.keys(HEROES).length} heroes, ${ACTS.length - 1} acts, ${cast.length} figures, ${mats.size} mats | ${FAIL.length} FAIL, ${WARN.length} WARN${simN > 0 ? `, sim ${simN} runs per hero` : ''}`);
process.exit(FAIL.length ? 1 : 0);
